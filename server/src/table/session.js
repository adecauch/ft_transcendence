/**
 * session.js — One server-authoritative poker table connected to one browser.
 *
 * The session owns PokerGame and never exposes its internal state directly.
 * WebSocket messages are the only way for the human agent to answer a turn.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { PokerBot } from '../../../src/shared/ai/PokerBot.js';
import { PokerGame, GameAborted } from '../../../src/shared/poker/PokerGame.js';
import { legalActions, toCall, validateRaise } from '../../../src/shared/poker/betting.js';
import { HandRecorder } from '../../../src/shared/stats/handRecord.js';
import { recordInfosets } from '../stats/infosets.js';
import { saveServerHand, startGame, quitGame } from '../games/service.js';
import { HumanAgent } from './humanAgent.js';

const OPEN = 1;

/**
 * Turn clock. The 30 s start when the browser shows the turn (`actionShown`),
 * not when the request leaves: the browser may still be animating the bots'
 * moves. A browser that never says so still gets `displayMs` to show it.
 * `pause` freezes the clock (vs. the AI only one human waits); a pause longer
 * than `maxPauseMs` closes the table, so it can't be kept open forever.
 */
export const DEFAULT_TIMING = {
  actionMs: 30_000,
  displayMs: 60_000,
  maxPauseMs: 10 * 60_000,
  minResumeMs: 5_000, // time left after a resume, at least: no fold on the spot
};
const DEFAULT_CONFIG = {
  opponents: [{ name: 'Le Baron', level: 'expert' }],
  startingStack: 400,
  blinds: { small: 1, big: 2 },
};

const LEVELS = new Set(['beginner', 'regular', 'expert']);

export class TableSession {
  /**
   * @param {{ socket: import('ws'), solver: import('../ai/solverData.js').SolverData, prisma: object, user: object|null, live: object, registry: object, log: object, timing?: Partial<typeof DEFAULT_TIMING> }} options
   */
  constructor({ socket, solver, prisma, user, live, registry, log, timing }) {
    this.socket = socket;
    this.solver = solver;
    this.prisma = prisma;
    this.user = user;
    this.live = live;
    this.registry = registry;
    this.log = log;
    this.timing = { ...DEFAULT_TIMING, ...timing };
    this.paused = false;
    this._pauseTimer = null;
    this.tableId = `table-${randomUUID()}`;
    this.playerToken = randomBytes(24).toString('base64url');
    this.humanSeat = 0;
    this.sequence = 0;
    this.game = null;
    this.savedGame = null;
    this.recorder = null;
    this.decisions = [];
    this.pending = null;
    this.joined = false;
    this.closed = false;
    this._run = 0;
    this._disconnectTimer = null;
    this._history = [];
    this._publicEvents = [];
  }

  /** @param {object} message */
  async join(message) {
    if (this.joined || this._joining) return this.sendError('BAD_MESSAGE', 'Cette connexion est déjà rattachée à une table.', message.requestId);

    const config = checkedConfig(message.config);
    if (this.user && this.registry.tableForUser(this.user.id)) {
      return this.sendError('ALREADY_IN_TABLE', 'Tu es déjà à une autre table.', message.requestId);
    }
    this._joining = true;
    this.registry.add(this); // Reserve before database / solver awaits, even across sockets.
    if (this.user) this.savedGame = await startGame(this.prisma, this.user, config);
    if (this.closed) {
      if (this.savedGame) await quitGame(this.prisma, this.savedGame);
      return;
    }
    const [{ abstraction }, strategy] = await Promise.all([
      this.solver.abstraction(),
      this.solver.strategy().catch((err) => {
        this.log.warn({ err }, 'MCCFR strategy unavailable; using bot fallback policy');
        return null;
      }),
    ]);
    if (this.closed) return;
    const bot = new PokerBot(abstraction, strategy);
    const human = new HumanAgent(this);
    const botAgent = { decide: (request) => this.decideBot(bot, request) };
    const players = [
      { name: 'Toi', isHuman: true, agent: human },
      ...config.opponents.map((opponent) => ({ ...opponent, isHuman: false, agent: botAgent })),
    ];

    this.game = new PokerGame({
      players,
      startingStack: config.startingStack,
      blinds: config.blinds,
      onEvent: (event) => this.onEvent(event),
    });
    this.joined = true;
    this.send({
      type: 'joined',
      requestId: message.requestId,
      tableId: this.tableId,
      seat: this.humanSeat,
      playerToken: this.playerToken,
    });
    this.play(this._run + 1);
  }

  /** Start hands sequentially; the server does not wait for visual delays. */
  async play(run) {
    this._run = run;
    try {
      while (!this.closed && run === this._run && !this.game.gameOver) {
        await this.game.playHand();
      }
      if (!this.closed && run === this._run) {
        this.send({ type: 'gameEnd', tableId: this.tableId, reason: this.game.gameOver });
      }
    } catch (err) {
      if (!(err instanceof GameAborted) && !this.closed) {
        this.log.error({ err, tableId: this.tableId }, 'table game failed');
        this.send({ type: 'gameEnd', tableId: this.tableId, reason: 'serverError' });
      }
    }
  }

  /** @param {object} event */
  async onEvent(event) {
    if (this.closed) throw new GameAborted();
    if (event.type === 'handStart') {
      this.recorder = new HandRecorder();
      this.decisions = [];
      this._publicEvents = [];
    }
    this.recorder?.event(event);
    if (event.type === 'handEnd') await this.saveHand();
    const publicEvent = this.publicEvent(event);
    this._publicEvents.push(publicEvent);
    this.send({ type: 'event', tableId: this.tableId, event: publicEvent });
  }

  async saveHand() {
    if (!this.user || !this.savedGame || !this.recorder?.record) return;
    const saved = await saveServerHand(this.prisma, this.user, this.savedGame, this.recorder.record, {
      stacks: this.game.stacks,
      button: this.game.button,
      gameOver: this.game.gameOver,
    });
    this.savedGame = saved.dbGame;
    if (saved.achievements.length) this.send({ type: 'achievements', ids: saved.achievements });
    await recordInfosets(this.prisma, this.solver, this.user.id, this.decisions)
      .catch((err) => this.log.warn({ err }, 'player infosets not recorded'));
    this.live.publish(this.user.id, 'hand', { gameId: this.savedGame.id, handNo: this.recorder.record.number });
  }

  /**
   * Wait for the human's response to one PokerGame request.
   * @param {object} request
   * @returns {Promise<object>}
   */
  waitForAction(request) {
    if (this.closed) return Promise.reject(new GameAborted());
    if (this.pending) return Promise.reject(new Error('A human action is already pending'));

    const requestId = `turn-${randomUUID()}`;
    const promise = new Promise((resolve, reject) => {
      // Until the browser shows the turn, only the display allowance runs
      this.pending = { requestId, request, resolve, reject, timeout: null, deadline: 0, remainingMs: this.timing.displayMs, shown: false };
      if (!this.paused) this._armClock(this.pending.remainingMs);
    });
    this.send(this.actionRequest({ requestId, request }));
    return promise;
  }

  /** The browser shows the turn: the player's own clock starts (once per turn). */
  actionShown(message) {
    const current = this.pending;
    if (!current || message.requestId !== current.requestId) return;
    if (!current.shown) {
      current.shown = true;
      current.remainingMs = this.timing.actionMs;
      if (!this.paused) this._armClock(current.remainingMs);
    }
    this.sendTimer(); // again after a reconnect: the clock is not reset
  }

  /** The pause menu is open: freeze the clock. */
  pause() {
    if (this.paused || !this.joined) return;
    this.paused = true;
    const current = this.pending;
    if (current?.timeout) {
      clearTimeout(current.timeout);
      current.timeout = null;
      current.remainingMs = Math.max(0, current.deadline - Date.now());
    }
    this._pauseTimer = setTimeout(() => this.close('idle'), this.timing.maxPauseMs);
    this.sendTimer();
  }

  /** Back from the pause menu: the clock goes on, never below `minResumeMs`. */
  resume() {
    if (!this.paused) return;
    this.paused = false;
    clearTimeout(this._pauseTimer);
    this._pauseTimer = null;
    const current = this.pending;
    if (current) this._armClock(Math.max(current.remainingMs, current.shown ? this.timing.minResumeMs : 0));
    this.sendTimer();
  }

  /** Start (or restart) the pending turn's clock; at zero the server plays fold / check. */
  _armClock(ms) {
    const current = this.pending;
    clearTimeout(current.timeout);
    current.remainingMs = ms;
    current.deadline = Date.now() + ms;
    current.timeout = setTimeout(() => {
      if (this.pending !== current) return;
      this.pending = null;
      const fallback = toCall(current.request.turn) > 0 ? { type: 'fold' } : { type: 'check' };
      // The browser is still waiting for a click: tell it the turn is over
      this.send({ type: 'actionExpired', tableId: this.tableId, requestId: current.requestId, action: fallback });
      this.rememberDecision(current.request, fallback);
      current.resolve(fallback);
    }, ms);
  }

  /** Tell the browser how long the player has left (only once the turn is shown). */
  sendTimer() {
    const current = this.pending;
    if (!current?.shown) return;
    const running = Boolean(current.timeout);
    this.send({
      type: 'actionTimer',
      tableId: this.tableId,
      requestId: current.requestId,
      remainingMs: running ? Math.max(0, current.deadline - Date.now()) : current.remainingMs,
      running,
    });
  }

  /** @param {object} message */
  receive(message, context = {}) {
    if (message.type === 'joinTable') return this.join(message).catch((err) => {
      this.log.error({ err, tableId: this.tableId }, 'table join failed');
      this.sendError('SERVER_ERROR', 'Impossible de rejoindre la table.', message.requestId);
      this.close('serverError');
    });
    if (message.type === 'action') return this.receiveAction(message);
    if (message.type === 'actionShown') return this.actionShown(message);
    if (message.type === 'pause') return this.pause();
    if (message.type === 'resume') return this.resume();
    if (message.type === 'leaveTable') return this.close('left');
    if (message.type === 'reconnect') return this.reconnect(message, context);
    return this.sendError('BAD_MESSAGE', `Type de message inconnu : ${message.type}.`, message.requestId);
  }

  reconnect(message, { socket, user } = {}) {
    if (!socket || typeof message.tableId !== 'string' || message.tableId.length > 100
      || typeof message.playerToken !== 'string' || message.playerToken.length < 32
      || message.playerToken.length > 100 || !Number.isInteger(message.lastSeq)
      || message.lastSeq < 0) {
      return this.sendError('BAD_MESSAGE', 'La séquence de reconnexion est invalide.', message.requestId);
    }
    const result = this.registry.reconnect({
      tableId: message.tableId,
      playerToken: message.playerToken,
      lastSeq: message.lastSeq,
      socket,
      user,
    });
    if (!result.ok) return this.sendError(result.code, result.message, message.requestId);
    this.socket = null;
    this.closed = true;
    return result;
  }

  /** @param {object} message */
  receiveAction(message) {
    const current = this.pending;
    if (!this.joined) return this.sendError('NOT_JOINED', 'La connexion n’est pas rattachée à une table.', message.requestId);
    if (!current) return this.sendError('NOT_YOUR_TURN', 'Ce n’est pas ton tour.', message.requestId);
    if (message.requestId !== current.requestId) return this.sendError('STALE_REQUEST', 'Cette demande d’action a expiré.', message.requestId);

    const action = checkedAction(message.action, current.request.turn);
    if (!action.ok) return this.sendActionRejected(action.error, message.requestId);

    clearTimeout(current.timeout);
    this.pending = null;
    this.rememberDecision(current.request, action.value);
    current.resolve(action.value);
  }

  decideBot(bot, request) {
    const { action } = bot.decide(request);
    this.rememberDecision(request, action);
    return action;
  }

  rememberDecision(request, action) {
    this.decisions.push({
      seat: request.seat,
      round: request.round,
      hole: [...request.hole],
      board: [...request.board],
      history: structuredClone(request.history),
      type: action.type,
    });
  }

  /** Close the table and reject an agent waiting for an action. */
  close(reason = 'aborted') {
    if (this.closed) return;
    if (this.socket?.readyState === OPEN && reason !== 'aborted') {
      this.send({ type: 'gameEnd', tableId: this.tableId, reason });
    }
    this.closed = true;
    clearTimeout(this._disconnectTimer);
    this._disconnectTimer = null;
    clearTimeout(this._pauseTimer);
    this._pauseTimer = null;
    this._run++;
    this.game?.abort();
    if (this.pending) {
      clearTimeout(this.pending.timeout);
      this.pending.reject(new GameAborted());
      this.pending = null;
    }
    if (this.user && this.savedGame) {
      void quitGame(this.prisma, this.savedGame).catch((err) => this.log.warn({ err }, 'table game could not be closed'));
    }
    this.registry.remove(this);
  }

  /** Keep the server game alive briefly after a network failure. */
  detach(socket) {
    if (this.socket !== socket || this.closed) return;
    this.socket = null;
    clearTimeout(this._disconnectTimer);
    this._disconnectTimer = setTimeout(() => this.close('aborted'), this.registry.reconnectMs);
  }

  /** @param {string} token @param {object|null} user */
  canReconnect(token, user) {
    if (this.closed || token !== this.playerToken) return false;
    return (this.user?.id ?? null) === (user?.id ?? null);
  }

  /** @param {import('ws')} socket @param {number} lastSeq */
  attach(socket, lastSeq) {
    clearTimeout(this._disconnectTimer);
    this._disconnectTimer = null;
    if (this.socket && this.socket !== socket && this.socket.readyState === OPEN) {
      this.socket.close(4000, 'Replaced by a newer connection');
    }
    this.socket = socket;
    const missed = this._history.filter((message) => message.seq > lastSeq);
    const complete = !missed.length || missed[0].seq === lastSeq + 1;
    if (complete) {
      for (const message of missed) socket.send(message.raw);
    } else {
      this.send({
        type: 'state',
        tableId: this.tableId,
        events: this._publicEvents,
        actionRequest: this.pending ? this.actionRequest(this.pending) : null,
      });
    }
    this.send({ type: 'reconnected', requestId: null, tableId: this.tableId, seat: this.humanSeat, playerToken: this.playerToken });
  }

  /** @param {object} message */
  send(message) {
    if (this.closed) return;
    const payload = { ...message, seq: ++this.sequence };
    const raw = JSON.stringify(payload);
    this._history.push({ seq: payload.seq, raw });
    if (this._history.length > 2048) this._history.shift();
    if (this.socket?.readyState === OPEN) this.socket.send(raw);
  }

  /** @param {string} code @param {string} message @param {string} [requestId] */
  sendError(code, message, requestId) {
    this.send({ type: 'error', code, message, ...(requestId ? { requestId } : {}) });
  }

  /** @param {string} message @param {string} requestId */
  sendActionRejected(message, requestId) {
    this.send({ type: 'actionRejected', code: 'ILLEGAL_ACTION', message, requestId });
  }

  actionRequest({ requestId, request }) {
    return {
      type: 'actionRequest',
      tableId: this.tableId,
      requestId,
      seat: request.seat,
      round: request.round,
      hole: [...request.hole],
      board: [...request.board],
      turn: { ...request.turn },
    };
  }

  /** @param {object} event */
  publicEvent(event) {
    if (event.type !== 'deal') return event;
    return {
      ...event,
      hole: event.hole.map((cards, seat) => seat === this.humanSeat && cards ? [...cards] : null),
    };
  }
}

function checkedConfig(config = DEFAULT_CONFIG) {
  if (!config || typeof config !== 'object') throw new Error('Invalid table config');
  const opponents = Array.isArray(config.opponents) && config.opponents.length >= 1 && config.opponents.length <= 4
    ? config.opponents.map((opponent) => {
      if (!opponent || typeof opponent.name !== 'string' || !opponent.name.trim() || !LEVELS.has(opponent.level)) {
        throw new Error('Invalid opponent config');
      }
      return { name: opponent.name.trim().slice(0, 40), level: opponent.level };
    })
    : DEFAULT_CONFIG.opponents;
  const startingStack = Number(config.startingStack ?? DEFAULT_CONFIG.startingStack);
  const small = Number(config.blinds?.small ?? DEFAULT_CONFIG.blinds.small);
  const big = Number(config.blinds?.big ?? DEFAULT_CONFIG.blinds.big);
  if (!Number.isInteger(startingStack) || startingStack < big * 10 || startingStack > 1_000_000) throw new Error('Invalid starting stack');
  if (!Number.isInteger(small) || !Number.isInteger(big) || small < 1 || big < small) throw new Error('Invalid blinds');
  return { opponents, startingStack, blinds: { small, big } };
}

export function checkedAction(action, turn) {
  if (!action || typeof action.type !== 'string') return { ok: false, error: 'Action invalide.' };
  const legal = legalActions(turn);
  if (action.type === 'fold') return { ok: true, value: action };
  if (action.type === 'check') return legal.check
    ? { ok: true, value: action }
    : { ok: false, error: 'Tu ne peux pas checker maintenant.' };
  if (action.type === 'call') {
    const amount = toCall(turn);
    return amount > 0 && action.amount === amount
      ? { ok: true, value: { type: 'call', amount } }
      : { ok: false, error: 'Le montant à suivre est incorrect.' };
  }
  if (action.type === 'raise' && legal.raise) {
    const result = validateRaise(turn, action.to);
    return result.ok ? { ok: true, value: { type: 'raise', to: result.to } } : result;
  }
  return { ok: false, error: 'Cette action n’est pas légale.' };
}
