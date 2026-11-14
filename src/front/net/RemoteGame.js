/**
 * RemoteGame.js — Client adapter for the server-authoritative poker table.
 *
 * It keeps the small game contract that TableController needs while the real
 * PokerGame runs on the server. Events are delivered in order, action requests
 * are answered by the UI callback, and playHand() resolves on handEnd.
 *
 * Shared tables (online mode, server/src/table/shared.js): connect() with
 * `config.shared = { create: true, bots }` opens one (the player hosts it),
 * `{ join: 'ABC123' }` sits at one. The waiting room comes as `lobby` messages
 * (onLobby); the host starts the game with startTable(). The server turns the
 * table for each player (shared/poker/viewpoint.js): seat 0 is always this
 * player, so the rest of the front works unchanged.
 */

const PROTOCOL = 'table-websocket';
const VERSION = 1;

export class RemoteGameError extends Error {
  /** @param {string} message @param {string} [code] */
  constructor(message, code) {
    super(message);
    this.name = 'RemoteGameError';
    this.code = code;
  }
}

export class RemoteGame {
  /**
   * @param {object} [options]
   * @param {string} [options.url]
   * @param {typeof WebSocket} [options.WebSocketClass]
   * @param {(event: object) => Promise<void>|void} [options.onEvent]
   * @param {(request: object) => Promise<object>|object} [options.onActionRequest]
   * @param {(ids: string[]) => void} [options.onAchievements]
   * @param {(timer: { requestId: string, remainingMs: number, running: boolean }) => void} [options.onTimer]
   * @param {(message: { requestId: string, action: object }) => void} [options.onActionExpired]
   *   — the clock reached zero, the server played `action`: end the turn on
   *   screen (resolve `onActionRequest` with `null`, nothing is sent)
   * @param {(state: object) => void} [options.onLobby] — a shared table's waiting room (who sits, who hosts)
   * @param {(error: RemoteGameError) => void} [options.onError]
   */
  constructor({ url = defaultUrl(), WebSocketClass = globalThis.WebSocket, onEvent, onActionRequest, onAchievements, onTimer, onActionExpired, onLobby, onError } = {}) {
    this.url = url;
    this.WebSocketClass = WebSocketClass;
    this.onEvent = onEvent;
    this.onActionRequest = onActionRequest;
    this.onAchievements = onAchievements;
    this.onTimer = onTimer;
    this.onActionExpired = onActionExpired;
    this.onLobby = onLobby;
    this.onError = onError;
    this._paused = false;

    this.socket = null;
    this.table = null;
    this._connect = null;
    this._connectPromise = null;
    this._closed = false;
    this._config = null;
    this._playerToken = null;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._lastSeq = 0;
    this._dispatch = Promise.resolve();
    this._handResults = [];
    this._handWaiters = [];
    this._asking = null;       // requestId of the turn on screen
    this._expired = new Set(); // expired before being shown: skipped
  }

  /** @returns {boolean} */
  get connected() {
    return this.socket?.readyState === this.WebSocketClass.OPEN;
  }

  /** @returns {string|null} */
  get tableId() {
    return this.table?.tableId ?? null;
  }

  /**
   * Open the socket and join a table.
   * @param {object} config
   * @returns {Promise<object>} the server's `joined` message
   */
  connect(config) {
    if (this._connectPromise) return this._connectPromise;
    if (typeof this.WebSocketClass !== 'function') {
      return Promise.reject(new RemoteGameError('Les WebSockets ne sont pas disponibles dans ce navigateur.', 'NO_WEBSOCKET'));
    }

    this._closed = false;
    this._config = config;
    const promise = new Promise((resolve, reject) => {
      this._connect = { resolve, reject };
      let socket;
      try {
        socket = new this.WebSocketClass(this.url);
      } catch (err) {
        reject(err instanceof RemoteGameError
          ? err
          : new RemoteGameError(err.message, 'CONNECTION_ERROR'));
        this._connect = null;
        return;
      }
      this.socket = socket;
      socket.onopen = () => this._send(openMessage(config));
      socket.onmessage = (event) => this._receive(event.data);
      socket.onerror = () => this._fail(new RemoteGameError('La connexion à la table a échoué.', 'CONNECTION_ERROR'));
      socket.onclose = () => this._closedByServer();
    });
    this._connectPromise = promise.catch((err) => {
      this._connect = null;
      throw err;
    });
    return this._connectPromise;
  }

  /**
   * Resolve with the next completed hand. Events continue to be delivered to
   * `onEvent` independently of this promise.
   * @returns {Promise<{ result: object, stacks: number[], gameOver: string|null }>}
   */
  playHand() {
    if (this._handResults.length) return Promise.resolve(this._handResults.shift());
    return new Promise((resolve, reject) => this._handWaiters.push({ resolve, reject }));
  }

  /** @param {object} action @param {string} requestId */
  sendAction(action, requestId) {
    this._send({ type: 'action', requestId, action });
  }

  /** Shared table, host only: start the game (2 players at least). */
  startTable() {
    this._trySend({ type: 'startTable', requestId: `start-${randomId()}` });
  }

  /** The pause menu opened: the server freezes the player's clock. */
  pause() {
    this._paused = true;
    this._trySend({ type: 'pause' });
  }

  /** The pause menu closed: the clock goes on. */
  resume() {
    this._paused = false;
    this._trySend({ type: 'resume' });
  }

  /** Stop the remote table and close the connection. */
  stop() {
    if (!this.socket) return;
    if (this.connected) this._send({ type: 'leaveTable', requestId: `leave-${randomId()}` });
    this._closed = true;
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    if (this._connect) {
      this._connect.reject(new RemoteGameError('La partie distante a été arrêtée.', 'STOPPED'));
      this._connect = null;
      this._connectPromise = null;
    }
    this._rejectHands(new RemoteGameError('La partie distante a été arrêtée.', 'STOPPED'));
    this.socket.close();
    this.socket = null;
    this.table = null;
  }

  /** @param {string|object} raw */
  _receive(raw) {
    let message;
    try {
      message = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(new TextDecoder().decode(raw));
    } catch {
      return this._fail(new RemoteGameError('Le serveur a envoyé un message invalide.', 'BAD_MESSAGE'));
    }
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      return this._fail(new RemoteGameError('Le serveur a envoyé un message invalide.', 'BAD_MESSAGE'));
    }
    if (Number.isInteger(message.seq)) {
      if (message.seq <= this._lastSeq) return;
      if (this._lastSeq && message.seq !== this._lastSeq + 1 && message.type !== 'state') {
        this.socket?.close();
        return;
      }
      this._lastSeq = message.seq;
    }

    if (message.type === 'hello') return this._hello(message);
    if (message.type === 'joined') return this._joined(message);
    if (message.type === 'reconnected') return this._reconnected(message);
    if (message.type === 'event') return this._enqueue(() => this._event(message.event));
    if (message.type === 'actionRequest') return this._enqueue(() => this._actionRequest(message));
    if (message.type === 'achievements') return this.onAchievements?.(message.ids ?? []);
    if (message.type === 'actionTimer') return this.onTimer?.(message);
    if (message.type === 'actionExpired') return this._actionExpired(message);
    if (message.type === 'lobby') return this.onLobby?.(message);
    if (message.type === 'actionRejected' || message.type === 'error') {
      const error = new RemoteGameError(message.message, message.code);
      if (this._connect) this._fail(error);
      else this.onError?.(error);
      return;
    }
    if (message.type === 'gameEnd') return this._failHands(new RemoteGameError(`La partie est terminée (${message.reason}).`, message.reason));
    if (message.type === 'state') return this._enqueue(() => this._restoreState(message));
    this._fail(new RemoteGameError(`Message serveur inconnu : ${message.type}.`, 'BAD_MESSAGE'));
  }

  /** @param {object} message */
  _hello(message) {
    if (message.protocol !== PROTOCOL || message.version !== VERSION) {
      this._fail(new RemoteGameError('La version du serveur est incompatible.', 'INCOMPATIBLE_PROTOCOL'));
    }
  }

  /** @param {object} message */
  _joined(message) {
    this.table = message;
    this._playerToken = message.playerToken;
    this._reconnectAttempts = 0;
    if (!this._connect) return;
    const { resolve } = this._connect;
    this._connect = null;
    this._connectPromise = null;
    resolve(message);
  }

  _reconnected(message) {
    this.table = { ...this.table, ...message };
    this._reconnectAttempts = 0;
    // A pause / resume sent during the cut was lost: say it again
    this._trySend({ type: this._paused ? 'pause' : 'resume' });
  }

  /** @param {object} event */
  async _event(event) {
    if (!event || typeof event.type !== 'string') throw new RemoteGameError('Événement de partie invalide.', 'BAD_EVENT');
    await this.onEvent?.(event);
    if (event.type !== 'handEnd') return;
    const result = { result: event.result, stacks: event.stacks, gameOver: event.gameOver };
    const waiter = this._handWaiters.shift();
    if (waiter) waiter.resolve(result);
    else this._handResults.push(result);
  }

  /** @param {object} message */
  async _actionRequest(message) {
    if (!this.onActionRequest) return;
    // Expired while the previous events were still being animated: never shown
    if (this._expired.delete(message.requestId)) return;
    // The events before it are animated: the turn is on screen now, its clock
    // starts on the server (not when the request left it)
    this._trySend({ type: 'actionShown', requestId: message.requestId });
    this._asking = message.requestId;
    try {
      const action = await this.onActionRequest(message);
      if (action) this.sendAction(action, message.requestId);
    } finally {
      this._asking = null;
    }
  }

  /**
   * The server played fold / check for the player at zero. Handled out of the
   * queue: the turn on screen must end, or the events after it wait forever.
   * @param {object} message
   */
  _actionExpired(message) {
    if (this._asking === message.requestId) return this.onActionExpired?.(message);
    this._expired.add(message.requestId); // still queued: skip it when its turn comes
  }

  /** @param {object} message */
  async _restoreState(message) {
    for (const event of message.events ?? []) await this._event(event);
    if (message.event) await this._event(message.event);
    if (message.actionRequest) await this._actionRequest(message.actionRequest);
  }

  /** @param {() => Promise<void>} work */
  _enqueue(work) {
    this._dispatch = this._dispatch.then(work).catch((err) => this._fail(err));
    return this._dispatch;
  }

  /** @param {object} message */
  _send(message) {
    if (!this.connected) throw new RemoteGameError('La table n’est pas connectée.', 'NOT_CONNECTED');
    this.socket.send(JSON.stringify(message));
  }

  /** Send if connected; otherwise drop it (the reconnection says it again). */
  _trySend(message) {
    if (this.connected) this.socket.send(JSON.stringify(message));
  }

  /** @param {Error} error */
  _fail(error) {
    const err = error instanceof RemoteGameError ? error : new RemoteGameError(error.message, 'CONNECTION_ERROR');
    if (this._connect) {
      const { reject } = this._connect;
      this._connect = null;
      this._connectPromise = null;
      reject(err);
    } else {
      this.onError?.(err);
    }
    this._rejectHands(err);
    return err;
  }

  /** @param {Error} error */
  _failHands(error) {
    for (const waiter of this._handWaiters.splice(0)) waiter.reject(error);
    this._handResults.length = 0;
  }

  /** @param {Error} error */
  _rejectHands(error) {
    this._failHands(error);
  }

  _closedByServer() {
    this.socket = null;
    if (this._closed) return;
    if (this._connect) return this._fail(new RemoteGameError('La connexion à la table a été fermée.', 'CONNECTION_CLOSED'));
    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    if (this._closed || this._reconnectTimer || !this.tableId || !this._playerToken) return;
    if (this._reconnectAttempts >= 10) {
      this._fail(new RemoteGameError('La reconnexion à la table a échoué.', 'RECONNECT_FAILED'));
      return;
    }
    const delay = Math.min(1000 * 2 ** this._reconnectAttempts, 10_000);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnectAttempts++;
      this._openReconnectSocket();
    }, delay);
  }

  _openReconnectSocket() {
    if (this._closed) return;
    let socket;
    try {
      socket = new this.WebSocketClass(this.url);
    } catch {
      this._scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => this._send({
      type: 'reconnect',
      requestId: `reconnect-${randomId()}`,
      tableId: this.tableId,
      playerToken: this._playerToken,
      lastSeq: this._lastSeq,
    });
    socket.onmessage = (event) => this._receive(event.data);
    socket.onerror = () => socket.close();
    socket.onclose = () => this._closedByServer();
  }
}

/** The first message: a solo table, or create / join a shared one. */
function openMessage(config) {
  const requestId = `join-${randomId()}`;
  const { shared } = config;
  if (shared?.join) return { type: 'joinShared', requestId, tableId: shared.join };
  if (shared?.create) {
    return { type: 'createTable', requestId, config: { startingStack: config.startingStack, blinds: config.blinds, bots: shared.bots ?? 0 } };
  }
  return { type: 'joinTable', requestId, config };
}

function defaultUrl() {
  if (typeof location === 'undefined') return 'ws://127.0.0.1:3100/ws/table';
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws/table`;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}
