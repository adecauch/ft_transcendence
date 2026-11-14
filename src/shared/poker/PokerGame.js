/**
 * PokerGame.js — A No-Limit Hold'em table: stacks, dealer button, and the
 * rules of every hand. Pure logic (no DOM, no Three.js): meant to run on the
 * server later; for now the browser runs it.
 *
 * The game owns the deck and the numbers. It never draws anything: it emits
 * events (`onEvent`, awaited — the front animates each one before the game
 * goes on) and asks each seat's `agent` for its decisions.
 *
 *   const game = new PokerGame({ players, startingStack, blinds, onEvent });
 *   // optional `deck: () => string[]` — the cards of each hand, drawn with pop()
 *   // (default: a freshly shuffled deck; the server passes the recorded cards
 *   // to replay a hand, see shared/stats/replay.js)
 *   const { result, gameOver } = await game.playHand();
 *
 * Players: seat 0 first, then clockwise. `agent.decide(request)` returns a
 * PlayerAction (betting.js) — a human answers through the UI, a bot through
 * PokerBot. The request is exactly what PokerBot.decide() expects.
 *
 * Rules implemented:
 *  - the button moves to the next seat still in the game each hand; heads-up
 *    the button is the small blind (acts first preflop, last after the flop)
 *  - four betting rounds; a raise reopens the action for everyone else
 *  - everyone else folds → the last seat takes the pot
 *  - showdown → main and side pots to the best hands, ties split (showdown.js)
 *  - stacks carry over; a seat with no chips is out
 *
 * Events (all carry `type`):
 *   handStart  { handNo, seats, button, sb, bb }
 *   blind      { seat, amount, bet, stack, pot, allIn }
 *   deal       { hole }                        hole[seat] = ['AS','KD'] | null (out)
 *   street     { street, cards, board }        street 1..3, cards = the new ones
 *   turn       { seat, street, isHuman }       before each decision
 *   action     { seat, street, action, paid, bet, stack, pot, isBet, allIn }
 *   roundEnd   { street, pot }                 bets go to the pot
 *   win        { seat, amount, stack, lastFold }  everyone else folded
 *   showdown   { reveals, pots, winnings }     reveals: [{ seat, cards, hand }]
 *   handEnd    { result, stacks, gameOver }
 */

import { createDeck, shuffle } from './cards.js';
import { buildPots, splitPots, scoreHand, handName } from './showdown.js';

/** Cards dealt to the board on each street. */
const BOARD_CARDS = [0, 3, 1, 1];

/** Thrown out of playHand() after abort() (the player quit). */
export class GameAborted extends Error {}

export class PokerGame {
  /**
   * @param {object} o
   * @param {{ name: string, isHuman: boolean, level?: string, agent: { decide(request): Promise<object>|object } }[]} o.players
   * @param {number} o.startingStack
   * @param {{ small: number, big: number }} o.blinds
   * @param {(event: object) => Promise<void>|void} [o.onEvent]
   * @param {() => string[]} [o.deck]
   * @param {'hero' | 'lastStanding'} [o.endWhen] — 'hero' (default): over when seat 0
   *   busts or busts everyone; 'lastStanding': a shared table (several players),
   *   over when one seat has all the chips
   */
  constructor({ players, startingStack, blinds, onEvent, deck, endWhen = 'hero' }) {
    this.players = players;
    this.endWhen = endWhen;
    this.newDeck = deck ?? (() => shuffle(createDeck()));
    this.blinds = blinds;
    this.onEvent = onEvent;
    this.stacks = players.map(() => startingStack);
    this.button = -1;
    this.handNo = 0;
    /** Seats of the hand in progress (read-only for debug tools) */
    this.seats = [];
    this._aborted = false;
  }

  /** Stop at the next step: playHand() then throws GameAborted. */
  abort() {
    this._aborted = true;
  }

  /**
   * 'lost' (seat 0 is out), 'won' (every other seat is out) or null; with
   * endWhen 'lastStanding': 'over' once a single seat has chips.
   */
  get gameOver() {
    if (this.endWhen === 'lastStanding') return this.stacks.filter((s) => s > 0).length <= 1 ? 'over' : null;
    if (this.stacks[0] <= 0) return 'lost';
    if (this.stacks.slice(1).every((s) => s <= 0)) return 'won';
    return null;
  }

  /** Play one full hand. @returns {Promise<{ result: object, stacks: number[], gameOver: string|null }>} */
  async playHand() {
    if (this.gameOver) throw new Error(`PokerGame: the game is over (${this.gameOver})`);
    const emit = async (event) => {
      await this.onEvent?.(event);
      if (this._aborted) throw new GameAborted();
    };
    const { blinds } = this;

    // ── Seats ──
    const seats = this.players.map((p, index) => {
      const stack = this.stacks[index];
      return { ...p, index, stack, bet: 0, total: 0, out: stack <= 0, folded: stack <= 0 };
    });
    this.seats = seats;
    const n = seats.length;
    const next = (from) => {
      for (let k = 1; k <= n; k++) {
        const s = (from + k) % n;
        if (!seats[s].out) return s;
      }
      return from;
    };
    const playing = seats.filter((s) => !s.out).length;
    const button = (this.button = next(this.button));
    const sb = playing === 2 ? button : next(button);
    const bb = next(sb);
    let pot = 0;

    /** Move chips from a seat's stack to its bet. @returns chips actually put in */
    const put = (seat, amount) => {
      const chips = Math.min(amount, seat.stack);
      seat.stack -= chips;
      seat.bet += chips;
      seat.total += chips;
      pot += chips;
      return chips;
    };

    await emit({
      type: 'handStart', handNo: ++this.handNo, button, sb, bb,
      seats: seats.map(({ index, name, isHuman, stack, out }) => ({ index, name, isHuman, stack, out })),
    });

    // ── Blinds ──
    for (const [seatIndex, amount] of [[sb, blinds.small], [bb, blinds.big]]) {
      const seat = seats[seatIndex];
      const paid = put(seat, amount);
      await emit({ type: 'blind', seat: seatIndex, amount: paid, bet: seat.bet, stack: seat.stack, pot, allIn: seat.stack === 0 });
    }

    // ── Cards ──
    const deck = this.newDeck();
    const hole = seats.map(() => null);
    for (let round = 0; round < 2; round++) {
      for (let k = 1; k <= n; k++) {
        const s = (button + k) % n; // dealing starts left of the button
        if (seats[s].out) continue;
        (hole[s] ??= []).push(deck.pop());
      }
    }
    const board = [];
    await emit({ type: 'deal', hole: hole.map((h) => (h ? [...h] : null)) });

    // Voluntary actions per round (blinds excluded), with sizes: the AI's history
    const history = BOARD_CARDS.map(() => []);
    const inHand = () => seats.filter((s) => !s.folded);
    let lastFold = null;

    for (let street = 0; street < BOARD_CARDS.length; street++) {
      if (BOARD_CARDS[street]) {
        deck.pop(); // burn
        const cards = [];
        for (let i = 0; i < BOARD_CARDS[street]; i++) cards.push(deck.pop());
        board.push(...cards);
        await emit({ type: 'street', street, cards, board: [...board] });
      }

      // ── Betting round ──
      const preflop = street === 0;
      let currentBet = preflop ? blinds.big : 0;
      let lastRaise = preflop ? blinds.big : 0;
      if (!preflop) seats.forEach((s) => { s.bet = 0; });

      const canAct = (s) => !s.folded && s.stack > 0;
      // Preflop: after the big blind. After the flop: first seat after the button
      let i = preflop ? next(bb) : next(button);
      const pending = new Set(seats.filter(canAct));

      while (pending.size) {
        const seat = seats[i];
        i = (i + 1) % n;
        if (!pending.has(seat)) continue;
        pending.delete(seat);

        // Nobody left to bet against (everyone else all-in): nothing to decide
        if (seat.bet >= currentBet && !seats.some((s) => s !== seat && canAct(s))) continue;

        const turn = { stack: seat.stack, playerBet: seat.bet, currentBet, lastRaise, bigBlind: blinds.big, pot, preflop };
        await emit({ type: 'turn', seat: seat.index, street, isHuman: seat.isHuman });

        const action = await seat.agent.decide({
          seat: seat.index,
          level: seat.level,
          round: street,
          hole: hole[seat.index],
          board: [...board],
          opponents: inHand().length - 1,
          history,
          turn,
          button, sb, bb,
        });
        if (this._aborted) throw new GameAborted();

        // ── Apply it ──
        const record = { seat: seat.index, type: action.type };
        history[street].push(record);
        let paid = 0;
        let isBet = false;

        if (action.type === 'fold') {
          seat.folded = true;
          lastFold = seat.index;
        } else if (action.type === 'call') {
          paid = put(seat, action.amount);
          if (seat.stack === 0) Object.assign(record, { to: seat.bet, potBefore: turn.pot, allIn: true });
        } else if (action.type === 'raise') {
          isBet = currentBet === 0;
          lastRaise = Math.max(lastRaise, action.to - currentBet);
          currentBet = action.to;
          paid = put(seat, action.to - seat.bet);
          Object.assign(record, { to: seat.bet, potBefore: turn.pot, allIn: seat.stack === 0 });
          // Everyone else still in the hand must answer the raise
          seats.forEach((s) => { if (s !== seat && canAct(s)) pending.add(s); });
        }

        await emit({
          type: 'action', seat: seat.index, street, action, paid,
          bet: seat.bet, stack: seat.stack, pot, isBet, allIn: paid > 0 && seat.stack === 0,
        });

        // Everyone else folded: the last seat standing takes the pot
        const left = inHand();
        if (action.type === 'fold' && left.length === 1) {
          const winner = left[0];
          winner.stack += pot;
          await emit({ type: 'win', seat: winner.index, amount: pot, stack: winner.stack, lastFold });
          return this._endHand(seats, { type: 'uncontested', seat: winner.index, amount: pot, lastFold }, emit);
        }
      }

      await emit({ type: 'roundEnd', street, pot });
    }

    // ── Showdown ──
    const live = inHand();
    const reveals = live.map((s) => {
      const cards = [...hole[s.index], ...board];
      return { seat: s.index, cards: hole[s.index], score: scoreHand(cards), hand: handName(cards) };
    });
    const scores = new Map(reveals.map((r) => [r.seat, r.score]));
    // Odd chips go to the first winner after the button
    const order = seats.map((_, k) => (next(button) + k) % n);
    const pots = buildPots(seats.map((s) => s.total), seats.map((s) => s.folded));
    const { winnings, pots: results } = splitPots(pots, scores, order);
    for (const [seat, amount] of winnings) seats[seat].stack += amount;

    const paid = [...winnings].map(([seat, amount]) => ({ seat, amount, stack: seats[seat].stack }));
    await emit({ type: 'showdown', reveals, pots: results, winnings: paid });

    const hands = Object.fromEntries(reveals.map((r) => [r.seat, r.hand]));
    return this._endHand(seats, { type: 'showdown', pots: results, hands }, emit);
  }

  async _endHand(seats, result, emit) {
    this.stacks = seats.map((s) => s.stack);
    const summary = { result, stacks: [...this.stacks], gameOver: this.gameOver };
    await emit({ type: 'handEnd', ...summary });
    return summary;
  }
}
