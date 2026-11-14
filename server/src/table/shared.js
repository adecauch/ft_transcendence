/**
 * shared.js — A table several logged-in players sit at (online mode)
 *
 * Life of a shared table:
 *   waiting   the host created it (createTable); friends join with its code
 *             (joinShared: from an invitation, or typed); everyone gets the
 *             waiting room (`lobby` messages: who sits, who is connected)
 *   playing   the host started it (startTable, 2 players at least): one
 *             PokerGame, humans first then the AIs the host asked for
 *   ended     one seat has every chip (endWhen 'lastStanding'), or everyone left
 *
 * Each player sees the table from their own seat (shared/poker/viewpoint.js):
 * the events are turned so that they are seat 0, and the other players' hole
 * cards are hidden until a showdown. The same turned events feed each player's
 * own HandRecorder, so every hand is saved for every player (their own Game
 * row, their stats, achievements and solver comparison) with the solo code
 * unchanged (games/service.js saveServerHand).
 *
 * Turns: each human has ACTION_MS once their browser shows the turn
 * (`actionShown`), like the solo table, but **no pause**: one player can't
 * freeze the others. A player who leaves or loses the connection is folded /
 * checked when the clock runs out; if nobody is connected for the grace period,
 * the table closes.
 *
 * Same contract as the solo table (session.js) for routes.js and the registry:
 * receive(), detach(), owns(), canReconnect(), attach(), close().
 */

import { randomInt } from 'node:crypto';
import { PokerBot } from '../../../src/shared/ai/PokerBot.js';
import { PokerGame, GameAborted } from '../../../src/shared/poker/PokerGame.js';
import { toCall } from '../../../src/shared/poker/betting.js';
import { rotateArray, rotateEvent, rotateRequest, rotateSeat, viewEvent, gameOverFor } from '../../../src/shared/poker/viewpoint.js';
import { HandRecorder } from '../../../src/shared/stats/handRecord.js';
import { recordInfosets } from '../stats/infosets.js';
import { saveServerHand, startGame, quitGame } from '../games/service.js';
import { PlayerChannel } from './channel.js';
import { checkedAction, DEFAULT_TIMING } from './session.js';

export const MAX_SEATS = 5;
export const MIN_HUMANS = 2;
const BOT_NAMES = ['Le Baron', 'Lucky Lou', 'Madame Rouge', 'Doc Holliday'];
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I: easy to read aloud

/** A table code people can type: 6 letters / digits. */
export function newTableCode() {
  return Array.from({ length: 6 }, () => CODE_LETTERS[randomInt(CODE_LETTERS.length)]).join('');
}

/** The host's settings, checked: { startingStack, blinds, bots }. */
export function checkedSharedConfig(config = {}) {
  const startingStack = Number(config.startingStack ?? 1000);
  const small = Number(config.blinds?.small ?? 10);
  const big = Number(config.blinds?.big ?? 20);
  const bots = Number(config.bots ?? 0);
  if (!Number.isInteger(startingStack) || startingStack < big * 10 || startingStack > 1_000_000) throw new Error('Tapis de départ invalide');
  if (!Number.isInteger(small) || !Number.isInteger(big) || small < 1 || big < small) throw new Error('Blinds invalides');
  if (!Number.isInteger(bots) || bots < 0 || bots > MAX_SEATS - MIN_HUMANS) throw new Error('Nombre d’IA invalide');
  return { startingStack, blinds: { small, big }, bots };
}

const player = (user) => ({ id: user.id, username: user.username, tag: user.tag });

export class SharedTable {
  /**
   * @param {{ host: object, config: object, solver: object, prisma: object, live: object,
   *           registry: import('./registry.js').TableRegistry, log: object, timing?: object }} options
   */
  constructor({ host, config, solver, prisma, live, registry, log, timing }) {
    this.tableId = newTableCode();
    this.host = host;
    this.config = checkedSharedConfig(config);
    this.solver = solver;
    this.prisma = prisma;
    this.live = live;
    this.registry = registry;
    this.log = log;
    this.timing = { ...DEFAULT_TIMING, ...timing };
    this.status = 'waiting';
    /** Humans, in seat order: { user, channel, recorder, savedGame, done, left } */
    this.seats = [];
    this.game = null;
    this.closed = false;
    this.decisions = [];
    this._idleTimer = null;
  }

  // ── Registry / routes contract ────────────────────────────────────────────

  /** Is this player sitting here while the cards are dealt? (presence: "en partie") */
  isPlaying(userId) {
    return !this.closed && this.status === 'playing' && this.seats.some((s) => s.user.id === userId && !s.left);
  }

  owns(socket) {
    return this.seats.some((s) => s.channel.socket === socket);
  }

  canReconnect(token, user) {
    return !this.closed && this.seats.some((s) => !s.left && s.channel.playerToken === token && s.user.id === user?.id);
  }

  sequenceFor(token) {
    return this.seats.find((s) => s.channel.playerToken === token)?.channel.sequence;
  }

  attach(socket, lastSeq, token) {
    const seat = this.seats.find((s) => s.channel.playerToken === token);
    if (!seat) return;
    clearTimeout(seat.leaveTimer);
    clearTimeout(this._idleTimer);
    seat.channel.attach(socket, lastSeq, seat.pending ? this._actionRequest(seat.pending) : null);
    seat.channel.send({ type: 'reconnected', requestId: null, tableId: this.tableId, seat: 0, playerToken: seat.channel.playerToken, shared: true });
    this._broadcastLobby();
  }

  /** A socket closed: the seat stays (a reconnection may come), the others see it. */
  detach(socket) {
    const seat = this.seats.find((s) => s.channel.socket === socket);
    if (!seat || this.closed) return;
    seat.channel.detach();
    this._broadcastLobby();
    if (this.status === 'waiting') {
      // Not back in time → the seat is freed for someone else
      seat.leaveTimer = setTimeout(() => { if (!seat.channel.connected) this._leave(seat); }, this.registry.reconnectMs);
    }
    if (!this.seats.some((s) => s.channel.connected)) {
      clearTimeout(this._idleTimer);
      this._idleTimer = setTimeout(() => this.close('aborted'), this.registry.reconnectMs);
    }
  }

  /** @param {object} message @param {{ socket: import('ws') }} context */
  receive(message, { socket } = {}) {
    const seat = this.seats.find((s) => s.channel.socket === socket);
    if (!seat) return;
    switch (message.type) {
      case 'startTable': return this._start(seat, message.requestId);
      case 'action': return this._receiveAction(seat, message);
      case 'actionShown': return this._actionShown(seat, message);
      case 'leaveTable': return this._leave(seat);
      case 'pause':
      case 'resume':
        return undefined; // several players: nobody can freeze the others
      default:
        return seat.channel.sendError('BAD_MESSAGE', `Message inattendu à une table partagée : ${message.type}.`, message.requestId);
    }
  }

  // ── Waiting room ─────────────────────────────────────────────────────────

  /**
   * A player sits down (the host when the table is created, then their friends).
   * @returns {{ ok: true } | { ok: false, code: string, message: string }}
   */
  join(user, socket, requestId) {
    if (this.closed || this.status !== 'waiting') return { ok: false, code: 'TABLE_STARTED', message: 'Cette table a déjà commencé (ou elle est fermée).' };
    if (this.seats.some((s) => s.user.id === user.id)) return { ok: false, code: 'ALREADY_SEATED', message: 'Tu es déjà assis à cette table (dans un autre onglet ?).' };
    const existing = this.registry.tableForUser(user.id);
    if (existing && existing !== this) return { ok: false, code: 'ALREADY_IN_TABLE', message: 'Tu es déjà à une autre table. Quitte-la avant d’en rejoindre une nouvelle.' };
    if (this.seats.length + this.config.bots >= MAX_SEATS) return { ok: false, code: 'TABLE_FULL', message: 'Cette table est complète.' };
    const seat = { user, channel: new PlayerChannel({ socket, tableId: this.tableId }), recorder: null, savedGame: null, done: false, left: false, pending: null };
    this.seats.push(seat);
    clearTimeout(this._idleTimer);
    seat.channel.send({ type: 'joined', requestId, tableId: this.tableId, seat: 0, playerToken: seat.channel.playerToken, shared: true });
    this._broadcastLobby();
    return { ok: true };
  }

  /** What the waiting room shows (also sent once the game is on: who is connected). */
  lobbyState() {
    return {
      type: 'lobby',
      tableId: this.tableId,
      status: this.status,
      host: player(this.host),
      players: this.seats.map((s) => ({ ...player(s.user), connected: s.channel.connected, left: s.left })),
      bots: this.config.bots,
      maxSeats: MAX_SEATS,
      minPlayers: MIN_HUMANS,
      config: { startingStack: this.config.startingStack, blinds: this.config.blinds },
    };
  }

  /** Everyone gets the waiting room, with `you` (their id: am I the host?). */
  _broadcastLobby() {
    const state = this.lobbyState();
    for (const s of this.seats) if (!s.left) s.channel.send({ ...state, you: s.user.id });
  }

  _leave(seat) {
    clearTimeout(seat.leaveTimer);
    if (seat.left || this.closed) return;
    if (this.status === 'waiting') {
      this.seats = this.seats.filter((s) => s !== seat);
      seat.channel.send({ type: 'gameEnd', tableId: this.tableId, reason: 'left' });
      seat.channel.close(1000, 'Left the table');
      if (!this.seats.length) return this.close('aborted');
      if (seat.user.id === this.host.id) this.host = this.seats[0].user; // the next one hosts
      return this._broadcastLobby();
    }
    // During the game: the seat stays (the engine needs it), folded at every turn
    seat.left = true;
    if (seat.pending) this._play(seat, this._fallback(seat.pending.request));
    seat.channel.send({ type: 'gameEnd', tableId: this.tableId, reason: 'left' });
    seat.channel.close(1000, 'Left the table');
    if (!seat.done && seat.savedGame) {
      void quitGame(this.prisma, seat.savedGame).catch((err) => this.log.warn({ err }, 'shared game not closed'));
    }
    this.registry.onChange?.(seat.user.id);
    if (this.seats.every((s) => s.left || s.done)) return this.close('aborted');
    return this._broadcastLobby();
  }

  // ── The game ─────────────────────────────────────────────────────────────

  async _start(seat, requestId) {
    if (seat.user.id !== this.host.id) return seat.channel.sendError('NOT_HOST', 'Seul l’hôte peut lancer la partie.', requestId);
    if (this.status !== 'waiting') return seat.channel.sendError('TABLE_STARTED', 'La partie est déjà lancée.', requestId);
    const humans = this.seats.filter((s) => s.channel.connected);
    if (humans.length !== this.seats.length) return seat.channel.sendError('PLAYER_AWAY', 'Un joueur n’est plus connecté : attends-le ou qu’il parte.', requestId);
    if (this.seats.length < MIN_HUMANS) return seat.channel.sendError('NOT_ENOUGH_PLAYERS', `Il faut au moins ${MIN_HUMANS} joueurs.`, requestId);

    this.status = 'playing';
    try {
      await this._initialize();
    } catch (err) {
      this.log.error({ err, tableId: this.tableId }, 'shared table start failed');
      this.close('serverError');
    }
  }

  async _initialize() {
    const { abstraction } = await this.solver.abstraction();
    const strategy = await this.solver.strategy().catch(() => null);
    if (this.closed) return;
    const bot = new PokerBot(abstraction, strategy);
    const botAgent = { decide: (request) => this._decideBot(bot, request) };
    const players = [
      ...this.seats.map((s) => ({ name: s.user.username, isHuman: true, agent: { decide: (request) => this._ask(request) } })),
      ...BOT_NAMES.slice(0, this.config.bots).map((name) => ({ name, isHuman: false, level: 'expert', agent: botAgent })),
    ];
    const n = players.length;
    this.game = new PokerGame({
      players,
      startingStack: this.config.startingStack,
      blinds: this.config.blinds,
      endWhen: 'lastStanding',
      onEvent: (event) => this._onEvent(event),
    });

    // A saved game per player, seen from their seat (opponents: the others, clockwise)
    const created = await Promise.allSettled(this.seats.map(async (s, i) => {
      const opponents = rotateArray(players, i).slice(1).map((p) => ({ name: p.name, level: p.isHuman ? 'human' : p.level }));
      s.savedGame = await startGame(this.prisma, s.user, { opponents, startingStack: this.config.startingStack, blinds: this.config.blinds });
    }));
    // Wait for every write before cleanup, including writes finishing after a departure.
    for (const s of this.seats) {
      if ((this.closed || s.left) && s.savedGame) await quitGame(this.prisma, s.savedGame);
    }
    if (this.closed) return;
    const failed = created.find((r) => r.status === 'rejected');
    if (failed) throw failed.reason;
    this.n = n;
    this._broadcastLobby();
    for (const s of this.seats) this.registry.onChange?.(s.user.id); // friends: "en partie"
    this._loop();
  }

  async _loop() {
    try {
      while (!this.closed && !this.game.gameOver) await this.game.playHand();
      if (!this.closed) this._end();
    } catch (err) {
      if (!(err instanceof GameAborted) && !this.closed) {
        this.log.error({ err, tableId: this.tableId }, 'shared table failed');
        this.close('serverError');
      }
    }
  }

  async _onEvent(event) {
    if (this.closed) throw new GameAborted();
    if (event.type === 'handStart') this.decisions = [];
    for (const [i, s] of this.seats.entries()) {
      if (event.type === 'handStart') {
        s.recorder = new HandRecorder();
        s.channel.handEvents = [];
      }
      s.recorder?.event(rotateEvent(event, i, this.n));
      const view = viewEvent(event, i, this.n);
      s.channel.handEvents.push(view);
      if (!s.left) s.channel.send({ type: 'event', tableId: this.tableId, event: view });
    }
    if (event.type === 'handEnd') await this._saveHand(event);
  }

  /** Every player still in the game gets the hand saved, from their seat. */
  async _saveHand() {
    await Promise.all(this.seats.map(async (s, i) => {
      if (s.done || s.left || !s.savedGame || !s.recorder?.record) return;
      const stacks = rotateArray(this.game.stacks, i);
      const gameOver = gameOverFor(stacks);
      try {
        const saved = await saveServerHand(this.prisma, s.user, s.savedGame, s.recorder.record, {
          stacks, button: rotateSeat(this.game.button, i, this.n), gameOver,
        });
        s.savedGame = saved.dbGame;
        if (gameOver) s.done = true; // busted (or the winner): nothing more to save
        if (saved.achievements.length) s.channel.send({ type: 'achievements', ids: saved.achievements });
        const mine = this.decisions.filter((d) => d.seat === i).map((d) => ({ ...rotateRequest(d, i, this.n), type: d.type }));
        await recordInfosets(this.prisma, this.solver, s.user.id, mine).catch((err) => this.log.warn({ err }, 'player infosets not recorded'));
        this.live.publish(s.user.id, 'hand', { gameId: s.savedGame.id, handNo: s.recorder.record.number });
      } catch (err) {
        this.log.warn({ err, tableId: this.tableId, userId: s.user.id }, 'shared hand not saved');
      }
    }));
  }

  _end() {
    this.status = 'ended';
    for (const [i, s] of this.seats.entries()) {
      if (s.left) continue;
      s.channel.send({ type: 'gameEnd', tableId: this.tableId, reason: gameOverFor(rotateArray(this.game.stacks, i)) ?? 'over' });
    }
    this.close('ended');
  }

  // ── Turns ────────────────────────────────────────────────────────────────

  _decideBot(bot, request) {
    const { action } = bot.decide(request);
    this._remember(request, action);
    return action;
  }

  _remember(request, action) {
    this.decisions.push({
      seat: request.seat, round: request.round, hole: [...request.hole], board: [...request.board],
      history: structuredClone(request.history), type: action.type,
    });
  }

  _fallback(request) {
    return toCall(request.turn) > 0 ? { type: 'fold' } : { type: 'check' };
  }

  /** A human's turn: ask their browser, with a clock (fold / check at zero). */
  _ask(request) {
    const seat = this.seats[request.seat];
    if (!seat || seat.left) {
      const action = this._fallback(request);
      this._remember(request, action);
      return action;
    }
    return new Promise((resolve) => {
      const requestId = `turn-${this.tableId}-${request.seat}-${randomInt(1e9)}`;
      seat.pending = { requestId, request, resolve, shown: false, timeout: null };
      this._arm(seat, this.timing.displayMs);
      seat.channel.send(this._actionRequest(seat.pending));
    });
  }

  _actionRequest({ requestId, request }) {
    const mine = rotateRequest(request, request.seat, this.n);
    return { type: 'actionRequest', tableId: this.tableId, requestId, seat: 0, round: mine.round, hole: [...mine.hole], board: [...mine.board], turn: { ...mine.turn } };
  }

  _arm(seat, ms) {
    const pending = seat.pending;
    clearTimeout(pending.timeout);
    pending.deadline = Date.now() + ms;
    pending.timeout = setTimeout(() => {
      if (seat.pending !== pending) return;
      const fallback = this._fallback(pending.request);
      // The browser is still waiting for a click: tell it the turn is over
      seat.channel.send({ type: 'actionExpired', tableId: this.tableId, requestId: pending.requestId, action: fallback });
      this._play(seat, fallback);
    }, ms);
  }

  _actionShown(seat, message) {
    const pending = seat.pending;
    if (!pending || pending.requestId !== message.requestId) return;
    if (!pending.shown) {
      pending.shown = true;
      this._arm(seat, this.timing.actionMs);
    }
    seat.channel.send({ type: 'actionTimer', tableId: this.tableId, requestId: pending.requestId, remainingMs: Math.max(0, pending.deadline - Date.now()), running: true });
  }

  _receiveAction(seat, message) {
    const pending = seat.pending;
    if (!pending) return seat.channel.sendError('NOT_YOUR_TURN', 'Ce n’est pas ton tour.', message.requestId);
    if (message.requestId !== pending.requestId) return seat.channel.sendError('STALE_REQUEST', 'Cette demande d’action a expiré.', message.requestId);
    const action = checkedAction(message.action, pending.request.turn);
    if (!action.ok) return seat.channel.send({ type: 'actionRejected', code: 'ILLEGAL_ACTION', message: action.error, requestId: message.requestId });
    return this._play(seat, action.value);
  }

  _play(seat, action) {
    const pending = seat.pending;
    if (!pending) return;
    clearTimeout(pending.timeout);
    seat.pending = null;
    this._remember(pending.request, action);
    pending.resolve(action);
  }

  // ── End ──────────────────────────────────────────────────────────────────

  close(reason = 'aborted') {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this._idleTimer);
    this.game?.abort();
    for (const s of this.seats) {
      clearTimeout(s.leaveTimer);
      if (s.pending) {
        clearTimeout(s.pending.timeout);
        s.pending.resolve(this._fallback(s.pending.request)); // lets the engine reach the abort
        s.pending = null;
      }
      if (reason !== 'ended' && !s.left) s.channel.send({ type: 'gameEnd', tableId: this.tableId, reason });
      if (!s.done && s.savedGame) void quitGame(this.prisma, s.savedGame).catch((err) => this.log.warn({ err }, 'shared game not closed'));
    }
    this.registry.remove(this);
    for (const s of this.seats) this.registry.onChange?.(s.user.id);
  }
}
