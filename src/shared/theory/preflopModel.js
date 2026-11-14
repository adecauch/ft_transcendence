/**
 * preflopModel.js — What each preflop action is worth, in big blinds (heads-up)
 *
 * A simple, explainable model, to show where chips are won and lost:
 *
 *   - the OPPONENT answers with the reference heads-up ranges (huRanges.js):
 *     it folds, calls or raises as often as those ranges say;
 *   - once the chips are in, each player gets his share of the pot according
 *     to his EQUITY against the other's range (equityMatrix.js): no play after
 *     the flop, no bluffs later, as if everyone went to showdown;
 *   - sizes: open to 2.5 BB, raise over a limp to 4 BB, 3-bet to 8 BB, 4-bet
 *     to 22 BB; facing a re-raise, the model goes on only if it pays (against
 *     a 4-bet: all-in for 100 BB), otherwise folds.
 *   - equity realisation (REALIZE): less when out of position.
 *
 * EV = what the hand wins or loses on average, blinds included (folding the
 * small blind = −0.5 BB). Three spots, as in the player's history
 * (stats/rangeAnalysis.js):
 *   open     small blind, first to act          fold / call (limp) / raise
 *   vsLimp   big blind, the small blind limped  fold / call (check) / raise
 *   vsRaise  big blind facing a 2.5 BB open     fold / call / raise (3-bet)
 *
 * The theory range = the best action for each hand; actions within TIE BB of
 * the best are mixed. Rough on purpose: realistic enough to see the big
 * leaks, not a solver.
 */

import { ALL_HANDS, combos, rangeFromNotation, TOTAL_COMBOS } from '../poker/ranges.js';
import { SB_OPEN, SB_4BET, SB_VS_3BET, BB_VS_OPEN, BB_VS_LIMP } from './huRanges.js';

export const SIZES = { open: 2.5, iso: 4, threeBet: 8, fourBet: 22, stack: 100 };
/**
 * Equity realisation: a hand doesn't win its whole equity once cards are
 * dealt after the flop — less when you speak first (out of position).
 * Heads-up the small blind is the button (in position), the big blind is not.
 */
export const REALIZE = { inPosition: 0.95, outOfPosition: 0.75 };
export const TIE = 0.05; // BB: closer than this, the actions are mixed
export const SPOTS = ['open', 'vsLimp', 'vsRaise'];
const ACTIONS = ['fold', 'call', 'raise'];

/** Hands of one action of a notation range, as a Map hand → 1. */
function weights(byAction, action) {
  const range = rangeFromNotation(byAction, null);
  return new Map(Object.entries(range).filter(([, mix]) => mix[action]).map(([h]) => [h, 1]));
}
const complement = (map) => new Map(ALL_HANDS.filter((h) => !map.has(h)).map((h) => [h, 1]));
/** Share of all 1326 combos a range holds. */
const share = (map) => [...map].reduce((s, [h, f]) => s + f * combos(h), 0) / TOTAL_COMBOS;
/** A pot of `put` from each player: what it's worth to someone with equity `eq`. */
const showdown = (eq, put, realize = 1) => eq * realize * 2 * put - put;

export class PreflopModel {
  /** @param {import('./equityMatrix.js').EquityMatrix} matrix */
  constructor(matrix) {
    this.matrix = matrix;
    const all = new Map(ALL_HANDS.map((h) => [h, 1]));

    // The opponent's answers
    this.bb = {
      threebet: weights(BB_VS_OPEN, 'threebet'),
      call: weights(BB_VS_OPEN, 'call'),
      limpRaise: weights(BB_VS_LIMP, 'raise'),
    };
    this.bb.limpCheck = complement(this.bb.limpRaise);
    this.sb = { open: weights(SB_OPEN, 'raise'), all };
    // Facing a 3-bet, the small blind 4-bets some of its opens, calls with others, folds the rest
    const four = weights(SB_4BET, 'raise');
    const cont = weights(SB_VS_3BET, 'call');
    this.sb.fourBet = new Map([...four].filter(([h]) => this.sb.open.has(h)));
    this.sb.call3bet = new Map([...cont].filter(([h]) => this.sb.open.has(h) && !four.has(h)));
    // A limper facing a raise continues with the better half of its hands
    this.sb.limpContinue = this._bestShare(0.5);

    this._cache = new Map();
  }

  /**
   * EV of each action, in big blinds.
   * @param {'open' | 'vsLimp' | 'vsRaise'} spot
   * @param {string} hand — 'AKs'
   * @returns {{ fold: number, call: number, raise: number }}
   */
  evs(spot, hand) {
    const key = `${spot}:${hand}`;
    if (!this._cache.has(key)) this._cache.set(key, this._evs(spot, hand));
    return this._cache.get(key);
  }

  /** The theory's mix for a hand: the best action(s). */
  best(spot, hand) {
    const ev = this.evs(spot, hand);
    const top = Math.max(...ACTIONS.map((a) => ev[a]));
    const near = ACTIONS.filter((a) => top - ev[a] < TIE);
    return Object.fromEntries(near.map((a) => [a, 1 / near.length]));
  }

  /** The whole theory range of a spot: hand → mix. */
  theory(spot) {
    return Object.fromEntries(ALL_HANDS.map((h) => [h, this.best(spot, h)]));
  }

  /**
   * Playing `mix` instead of the theory, over 100 times this hand.
   * @param {{ fold?: number, call?: number, raise?: number }} mix — the player's frequencies
   * @returns {{ player: number, theory: number, loss: number }} BB per 100 hands (loss ≥ 0)
   */
  per100(spot, hand, mix) {
    const ev = this.evs(spot, hand);
    const player = ACTIONS.reduce((s, a) => s + (mix[a] ?? 0) * ev[a], 0);
    const theory = Math.max(...ACTIONS.map((a) => ev[a]));
    return { player: 100 * player, theory: 100 * theory, loss: 100 * (theory - player) };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _evs(spot, hand) {
    const { open, iso, threeBet, stack } = SIZES;
    // In position when opening from the small blind (button), out of position in the big blind
    const r = spot === 'open' ? REALIZE.inPosition : REALIZE.outOfPosition;
    const eq = (range) => this.matrix.vsRange(hand, range) * r;

    if (spot === 'open') {
      // Limp: the big blind raises to 4 with its raising hands (we go on only if it pays), checks the rest
      const pr = share(this.bb.limpRaise);
      const limp = pr * Math.max(-1, showdown(eq(this.bb.limpRaise), iso))
        + (1 - pr) * showdown(eq(this.bb.limpCheck), 1);
      // Open: the big blind folds, calls or 3-bets
      const pt = share(this.bb.threebet);
      const pc = share(this.bb.call);
      const raise = (1 - pt - pc) * 1
        + pc * showdown(eq(this.bb.call), open)
        + pt * Math.max(-open, showdown(eq(this.bb.threebet), threeBet));
      return { fold: -0.5, call: limp, raise };
    }

    if (spot === 'vsLimp') {
      // Check: see the flop against any hand. Raise to 4: the limper folds its worse half
      const pc = share(this.sb.limpContinue);
      return {
        fold: -1,
        call: showdown(eq(this.sb.all), 1),
        raise: (1 - pc) * 1 + pc * showdown(eq(this.sb.limpContinue), iso),
      };
    }

    // vsRaise: the small blind opened with its range; a 3-bet makes it fold, call or 4-bet
    const opens = share(this.sb.open);
    const p4 = share(this.sb.fourBet) / opens;
    const pc = share(this.sb.call3bet) / opens;
    // Facing the 4-bet: all-in (equity fully realised) only if it pays, else fold the 8 BB
    const vs4 = Math.max(-threeBet, showdown(this.matrix.vsRange(hand, this.sb.fourBet), stack));
    return {
      fold: -1,
      call: showdown(eq(this.sb.open), open),
      raise: (1 - pc - p4) * open + pc * showdown(eq(this.sb.call3bet), threeBet) + p4 * vs4,
    };
  }

  /** The best `fraction` of all hands (by equity vs a random hand), as a range. */
  _bestShare(fraction) {
    const all = new Map(ALL_HANDS.map((h) => [h, 1]));
    const ranked = [...ALL_HANDS].sort((a, b) => this.matrix.vsRange(b, all) - this.matrix.vsRange(a, all));
    const out = new Map();
    let taken = 0;
    for (const h of ranked) {
      if (taken >= fraction * TOTAL_COMBOS) break;
      out.set(h, 1);
      taken += combos(h);
    }
    return out;
  }
}
