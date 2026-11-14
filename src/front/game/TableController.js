/**
 * TableController.js — Connects the game (back) to the 3D table and the UI (front)
 *
 * The rules live in shared/poker/PokerGame.js. This class:
 *  - uses either the local PokerGame (debug/tests) or RemoteGame (normal mode)
 *    from the new-game menu's config
 *  - turns every game event into animations (TableCards, TableChips, the
 *    cowboy's all-in show, the opponents' reactions) and awaits them, so the
 *    game goes at their pace
 *  - writes what happened in French for the action bar (AI notes, results)
 *  - chains the hands: the result stays NEXT_HAND_DELAY seconds, then the
 *    next hand starts; at the end of the game, a "Rejouer" button
 *
 * Every delay goes through TableChips.wait(), tied to the render loop, so the
 * pause menu freezes everything.
 *
 * `recorder` (GameRecorder) gets local game events. Remote games are recorded
 * by the server and are deliberately not sent a second time by the browser.
 */

import { PokerGame, GameAborted } from '../../shared/poker/PokerGame.js';
import { toCall } from '../../shared/poker/betting.js';
import { money, setBigBlind } from '../ui/chipUnit.js';
import { seatLayouts } from '../scene/seatLayout.js';
import { RemoteGame } from '../net/RemoteGame.js';

const AI_THINK = [0.5, 1.3];   // seconds before an AI acts (min, max)
const NEXT_HAND_DELAY = 3.5;   // seconds the result stays on screen before the next deal
const SHOWDOWN_READ = 1.2;     // seconds to read the hands before the pot moves

const STREET_NAMES = ['Préflop', 'Flop', 'Turn', 'River'];

export class TableController {
  /**
   * @param {object} deps
   * @param {import('../scene/cards/TableCards').TableCards} deps.cards
   * @param {import('../scene/chips/TableChips').TableChips} deps.chips
   * @param {import('../ui/actionBar/ActionBar').ActionBar} deps.actionBar
   * @param {boolean} [deps.remote] — use the server-authoritative game
   * @param {(ids: string[]) => void} [deps.onAchievements]
   */
  constructor({ cards, chips, actionBar, remote = false, onAchievements }) {
    this.cards = cards;
    this.chips = chips;
    this.actionBar = actionBar;
    this.remote = remote;
    this.onAchievements = onAchievements;

    /** @type {import('../../shared/ai/PokerBot').PokerBot | null} — without it, AIs check/call */
    this.bot = null;
    /** @type {import('../scene/opponents/Opponents').Opponents | null} — the AI characters */
    this.opponents = null;
    /** Awaited when a seat goes all-in (the cowboy's show) */
    this.onAllIn = null;
    /** @type {import('./GameRecorder').GameRecorder | null} — saves the games (logged in) */
    this.recorder = null;
    /** Called after each AI decision: (seat, action, debug, streetName) — AI debug panel */
    this.onAiDecision = null;
    /** @type {((state: object) => void) | null} a shared table's waiting room changed (main.js → WaitingRoom) */
    this.onLobby = null;
    /** The shared table's last waiting-room state, or null */
    this.lobby = null;
    this._seated = null; // names of the characters on the chairs (see _seatOpponents)

    /** The hand in progress, for debug tools: { id, seats } */
    this.current = null;

    this._game = null;
    this._run = 0;
    this._notes = [];
    this._positions = null;
  }

  /**
   * @param {{ opponents: { name: string, level: string }[], startingStack: number, blinds: { small: number, big: number },
   *           shared?: { create?: boolean, bots?: number, join?: string } }} config — `shared`: an online
   *   table (create one or join one by code); the players are only known from its waiting room
   */
  start(config) {
    this._config = config;
    if (config.blinds) setBigBlind(config.blinds.big); // amounts can be shown in big blinds
    this.stop();
    if (!this.remote) this.recorder?.start(config);
    this._seatOpponents((config.opponents ?? []).map((o) => o.name));

    if (this.remote) {
      this._game = new RemoteGame({
        onEvent: (event) => this._onEvent(event),
        onActionRequest: (request) => this._askPlayer(request),
        onAchievements: (ids) => this.onAchievements?.(ids),
        onTimer: (timer) => this.actionBar.countdown(timer.remainingMs, timer.running),
        onActionExpired: () => this.actionBar.expire(),
        onLobby: (state) => {
          setBigBlind(state.config.blinds.big);
          this.lobby = state;
          this.onLobby?.(state);
        },
        onError: (error) => this._onRemoteError(error),
      });
      this._loop(this._game, ++this._run);
      return;
    }

    const human = { decide: (request) => this._askPlayer(request) };
    const bot = { decide: (request) => this._askBot(request) };
    this._game = new PokerGame({
      players: [
        { name: 'Toi', isHuman: true, agent: human },
        ...config.opponents.map((o) => ({ name: o.name, isHuman: false, level: o.level, agent: bot })),
      ],
      startingStack: config.startingStack,
      blinds: config.blinds,
      onEvent: (event) => this._onEvent(event),
    });
    this._loop(this._game, ++this._run);
  }

  /** At a shared (online) table? */
  get shared() {
    return Boolean(this._config?.shared);
  }

  /** The shared table's code while sitting at one (for invitations), else null. */
  get tableId() {
    return this.shared ? this._game?.tableId ?? null : null;
  }

  /** Shared table, host only: start the game. */
  startShared() {
    if (this.shared) this._game?.startTable();
  }

  /** Put a character on each opponent's chair, unless the same names sit there already. */
  _seatOpponents(names) {
    const key = names.join('\u0000');
    if (key === this._seated) return;
    this._seated = key;
    this.opponents?.seat(names);
  }

  /** Pause menu opened / closed: a server game freezes the player's clock. */
  pause() {
    if (this.remote) this._game?.pause();
  }

  resume() {
    if (this.remote) this._game?.resume();
  }

  /** Abandon the game (quit). */
  stop() {
    this._run++;
    if (this._game) {
      if (this.remote) this._game.stop();
      else this._game.abort();
    }
    this._game = null;
    this.recorder?.stop();
    this.current = null;
    this.actionBar.hide();
    this.cards.stop();
    this.chips.clear();
    this.opponents?.clear();
    this._seated = null;
    this.lobby = null;
  }

  // ── Hands, one after another ────────────────────────────────────────────────

  async _loop(game, run) {
    try {
      if (this.remote) await game.connect(this._config);
      for (;;) {
        const { result, gameOver } = await game.playHand();
        if (run !== this._run) return;

        const text = this._resultText(result);
        // A shared table can't be replayed alone: back to the room instead
        const restart = this.shared
          ? { label: 'Quitter la table', onClick: () => window.dispatchEvent(new CustomEvent('game:quit')) }
          : { label: 'Rejouer', onClick: () => this.start(this._config) };
        if (gameOver === 'lost') return this.actionBar.message(`${text} Tu n'as plus de jetons : partie terminée.`, restart);
        if (gameOver === 'won') return this.actionBar.message(`${text} Tu as ruiné toute la table, partie gagnée !`, restart);

        this.actionBar.message(text);
        await this.chips.wait(NEXT_HAND_DELAY);
        if (run !== this._run) return;
        this.actionBar.hide();
      }
    } catch (err) {
      if (this.remote) {
        if (run !== this._run || err.code === 'STOPPED') return; // the player quit
        // The server closed the table or refused it (pause too long, unknown code…)
        const back = { label: 'Retour à la salle', onClick: () => window.dispatchEvent(new CustomEvent('game:quit')) };
        if (err.code === 'idle') this.actionBar.message('Pause trop longue : la table a été fermée.', back);
        else if (err.code === 'left') return;
        else if (!['won', 'lost', 'over'].includes(err.code)) this.actionBar.message(err.message, back);
        return;
      }
      if (!(err instanceof GameAborted)) throw err;
    }
  }

  // ── Game events → animations ────────────────────────────────────────────────

  async _onEvent(e) {
    if (!this.remote) this.recorder?.event(e);
    switch (e.type) {
      case 'handStart': {
        this._notes = [];
        this._positions = { button: e.button, sb: e.sb, bb: e.bb };
        // An online table: the other players are known once the game starts
        this._seatOpponents(e.seats.slice(1).map((s) => s.name));
        const layouts = seatLayouts(e.seats.length - 1);
        this.chips.reset(e.seats.map((s) => ({ ...s, layout: layouts[s.index] })));
        this.current = { id: e.handNo, seats: e.seats };
        break;
      }

      case 'blind':
        await this.chips.bet(e.seat, e.bet, e.stack);
        if (e.allIn) await this.onAllIn?.();
        break;

      case 'deal': {
        // The server hides the opponents' cards (null): a seat still in the
        // hand gets two face-down cards anyway, given their face at showdown.
        // Only a seat that is out of the game gets nothing.
        const hole = e.hole.map((cards, seat) => cards ?? (this.current?.seats[seat]?.out ? null : [null, null]));
        await this.cards.newHand(e.hole.length - 1, hole);
        break;
      }

      case 'street':
        await this.cards.dealStreet(e.cards);
        break;

      case 'turn':
        if (!e.isHuman) {
          const [lo, hi] = AI_THINK;
          await this.chips.wait(lo + Math.random() * (hi - lo));
        }
        break;

      case 'action': {
        const seat = this._seats()[e.seat];
        const { action } = e;
        if (action.type === 'fold') {
          this.opponents?.react(e.seat, 'fold');
          this.chips.fold(e.seat);
          this._note(seat, 'se couche');
          await this.cards.foldSeat(e.seat);
        } else if (action.type === 'check') {
          this._note(seat, 'checke');
        } else {
          if (action.type === 'raise') this.opponents?.react(e.seat, 'raise');
          await this.chips.bet(e.seat, e.bet, e.stack);
          if (action.type === 'call') this._note(seat, `${e.stack === 0 ? 'fait tapis à' : 'suit'} ${money(e.paid)}`);
          else this._note(seat, `${e.stack === 0 ? 'fait tapis à' : e.isBet ? 'mise' : 'relance à'} ${money(e.bet)}`);
          if (e.allIn) await this.onAllIn?.();
        }
        break;
      }

      case 'roundEnd':
        await this.chips.collect(e.pot);
        break;

      case 'win':
        await this.chips.collect(e.amount);
        this.opponents?.react(e.seat, 'win');
        await this.chips.payout([{ seat: e.seat, amount: e.amount, stack: e.stack }]);
        break;

      case 'showdown':
        await Promise.all(e.reveals.map((r) => this.cards.reveal(r.seat, r.cards)));
        e.reveals.forEach((r) => this.chips.showHand(r.seat, r.hand));
        await this.chips.wait(SHOWDOWN_READ);
        for (const r of e.reveals) {
          const won = e.winnings.some((w) => w.seat === r.seat && w.amount > 0);
          this.opponents?.react(r.seat, won ? 'win' : 'lose');
        }
        await this.chips.payout(e.winnings);
        break;

      case 'handEnd':
        // Busted AIs fall off their chair
        e.stacks.forEach((stack, seat) => { if (seat > 0 && stack === 0) this.opponents?.react(seat, 'out'); });
        this.current?.seats.forEach((seat, index) => { seat.stack = e.stacks[index]; });
        break;

      default:
        break;
    }
  }

  // ── Agents ──────────────────────────────────────────────────────────────────

  /** The player's decision, through the action bar. */
  _askPlayer(request) {
    return this.actionBar.ask({
      ...request.turn,
      street: [STREET_NAMES[request.round], this._positionName(request.seat)].filter(Boolean).join(' · '),
      note: this._notes.splice(0).join(' · '),
    });
  }

  /** An AI's decision: PokerBot (MCCFR) if loaded, otherwise check/call. */
  _askBot(request) {
    if (!this.bot) {
      const owed = toCall(request.turn);
      return owed === 0 ? { type: 'check' } : { type: 'call', amount: owed };
    }
    const { action, debug } = this.bot.decide(request);
    const name = this._seats()[request.seat].name;
    const street = STREET_NAMES[request.round];
    this.onAiDecision?.(request.seat, action, debug, street);
    if (import.meta.env?.DEV) {
      const source = debug.fromSolver ? 'solver' : debug.offTree ? `fallback — off-tree: ${debug.offTree}` : 'fallback — key not in table';
      console.debug(`[AI] ${name} (${request.level}) → ${action.type} · ${source} · ${street} ${debug.history}`, action, debug);
    }
    return action;
  }

  // ── Texts ───────────────────────────────────────────────────────────────────

  /** What the AIs did since the player's last decision (shown in the action bar). */
  _note(seat, text) {
    if (!seat.isHuman) this._notes.push(`${seat.name} ${text}`);
  }

  _positionName(seat) {
    const p = this._positions;
    if (!p) return null;
    if (seat === p.sb) return 'Petite blinde';
    if (seat === p.bb) return 'Grosse blinde';
    if (seat === p.button) return 'Bouton';
    return null;
  }

  _seats() {
    return this.remote ? (this.current?.seats ?? []) : (this._game?.seats ?? []);
  }

  _onRemoteError(error) {
    this.actionBar.message(`La connexion à la table a échoué : ${error.message}`);
  }

  _resultText(result) {
    const seats = this._seats();
    const who = (i) => (seats[i].isHuman ? 'Tu' : seats[i].name);

    if (result.type === 'uncontested') {
      const winner = seats[result.seat];
      if (winner.isHuman) return `Tout le monde s'est couché : tu remportes ${money(result.amount)} !`;
      const youFolded = result.lastFold !== null && seats[result.lastFold].isHuman;
      return `${youFolded ? 'Tu t\'es couché. ' : ''}${winner.name} remporte ${money(result.amount)}.`;
    }

    // Showdown
    const hand = (i) => result.hands[i].toLowerCase();
    const describe = ({ amount, winners, eligible }) => {
      if (winners.length > 1) {
        const names = winners.map((i) => (seats[i].isHuman ? 'toi' : seats[i].name)).join(' et ');
        return `Partage de ${money(amount)} entre ${names} (${hand(winners[0])})`;
      }
      const w = winners[0];
      // Same hand name as a loser: it was decided by the side cards
      const kicker = eligible.some((s) => s !== w && result.hands[s] === result.hands[w]) ? ' (au kicker)' : '';
      return `${who(w)} ${seats[w].isHuman ? 'gagnes' : 'gagne'} ${money(amount)} avec ${hand(w)}${kicker}`;
    };
    // Pots only one seat could win are bets nobody could call: they just go back
    const contested = result.pots.filter((r) => r.eligible.length > 1);
    const returned = result.pots.filter((r) => r.eligible.length === 1);
    let text = contested.length === 1
      ? describe(contested[0])
      : contested.map((r, k) => `${k === 0 ? 'Pot principal' : `Pot secondaire${contested.length > 2 ? ` ${k}` : ''}`} : ${describe(r)}`).join(' · ');
    for (const r of returned) {
      const w = r.winners[0];
      text += ` · ${who(w)} ${seats[w].isHuman ? 'récupères' : 'récupère'} ${money(r.amount)} non suivis`;
    }
    return `${text}.`;
  }
}
