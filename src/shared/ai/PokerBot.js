/**
 * PokerBot.js — AI opponents driven by the MCCFR strategy table
 *
 * For each decision:
 *   1. bucket the bot's cards (preflop table, or EHS → postflop bucket)
 *   2. translate the betting so far into the solver's heads-up history: each
 *      real bet becomes the closest solver size (mccfr/historyTranslator.js)
 *   3. look the infoset key up → one probability per option of the node
 *      (fold, call, the node's bet sizes, all-in — mccfr/bettingTree.js),
 *      unless the hand left the solver's tree (`offTree`)
 *   4. blend with a simple strength-vs-pot-odds policy according to the
 *      level (and use that policy alone off-tree or when the key is missing)
 *   5. sample an option and turn it into a legal move: a size is computed
 *      on the REAL table with the solver's formula (½ pot of the real pot…)
 *
 * Pure logic: no DOM, no Three.js — it can move to the back-end as is.
 */

import { CardAbstraction } from './mccfr/cardAbstraction.js';
import { StrategyTable } from './mccfr/StrategyTable.js';
import { describeInfoset } from './mccfr/infoset.js';
import { CALL, FOLD, optionLabel, sizeTo } from './mccfr/bettingTree.js';
import { legalActions, minRaiseTo, maxRaiseTo, toCall } from '../poker/betting.js';

/**
 * Facing a raise the solver's tree can't represent (a 5th bet in a street…),
 * the fallback asks for more than pot odds: call or fold, never raise.
 *   all-in     — preflop equity vs a random hand ≥ 0.62 (≈ 77+, AJ+, KQs),
 *                or postflop EHS ≥ 0.75
 *   other bet  — odds + OVERSIZE_MARGIN, capped at the all-in threshold
 * Starting points, to tune by playing.
 */
export const CALL_SHOVE_PREFLOP  = 0.62;
export const CALL_SHOVE_POSTFLOP = 0.75;
export const OVERSIZE_MARGIN     = 0.10;

/**
 * Options used when the solver has no node (off-tree): fold, call, a pot-sized
 * raise, all-in — the simple policy's raise goes to the pot-sized one.
 */
const DEFAULT_OPTIONS = [
  { type: 'fold', legal: true },
  { type: 'call', legal: true },
  { type: 'raise', spec: { kind: 'pot', value: 1 }, legal: true },
  { type: 'raise', spec: { kind: 'allin' }, legal: true },
];

/**
 * How much of the MCCFR strategy each level follows (the rest is the simple
 * policy below), and how "sharp" it plays it: temperature < 1 favours the
 * strategy's best action, > 1 flattens it. Beginners are also looser.
 * `purify` drops options below that probability (leftover noise of the
 * average strategy — an expert shouldn't fold aces 0.1% of the time).
 */
// For now every level plays the pure solver strategy; set to true to use the
// per-level blends below.
const USE_LEVELS = false;
const PURE = { solver: 1.0, temperature: 1.0, looseness: 0, purify: 0.03 };

const LEVELS = {
  expert:   { solver: 1.0,  temperature: 1.0, looseness: 0,   purify: 0.03 },
  regular:  { solver: 0.7,  temperature: 1.3, looseness: 0.1, purify: 0 },
  beginner: { solver: 0.35, temperature: 1.8, looseness: 0.3, purify: 0 },
};

export class PokerBot {
  /**
   * @param {CardAbstraction} abstraction
   * @param {StrategyTable | null} strategy
   */
  constructor(abstraction, strategy) {
    this.abstraction = abstraction;
    this.strategy = strategy;
    this.stats = { lookups: 0, hits: 0 };
  }

  /** Load buckets + strategy from a base URL; a missing strategy leaves the fallback only. */
  static async load(baseUrl = '/ai/mccfr/') {
    const abstraction = await CardAbstraction.load(baseUrl);
    let strategy = null;
    try {
      strategy = await StrategyTable.load(`${baseUrl}strategy.bin`);
      console.info(`[AI] MCCFR strategy loaded: ${strategy.size} infosets`);
    } catch (err) {
      console.warn(err.message, '— AI plays its fallback policy only');
    }
    return new PokerBot(abstraction, strategy);
  }

  /**
   * Choose an action.
   * @param {object} view
   * @param {string} view.level            — 'beginner' | 'regular' | 'expert'
   * @param {number} view.round            — 0 preflop … 3 river
   * @param {string[]} view.hole           — the bot's 2 card codes ('AS', 'TD')
   * @param {string[]} view.board          — community card codes
   * @param {number} view.seat             — the bot's seat
   * @param {number} view.opponents        — opponents still in the hand
   * @param {import('./mccfr/historyTranslator.js').SeatAction[][]} view.history
   * @param {import('../poker/betting.js').TurnState} view.turn
   * @returns {{ action: import('../poker/betting.js').PlayerAction, debug: object }}
   */
  decide(view) {
    const level = USE_LEVELS ? (LEVELS[view.level] ?? LEVELS.regular) : PURE;
    const legal = legalActions(view.turn);

    // -- MCCFR lookup, only inside the solver's game --
    const info = describeInfoset(this.abstraction, view);
    const { key, bucket, strength, history, facing: offFacing } = info;
    let solver = info.offTree ? undefined : this.strategy?.get(key);
    // A row with another number of options comes from another betting abstraction
    if (solver && solver.length !== info.options.length) solver = undefined;
    const options = info.offTree ? DEFAULT_OPTIONS : info.options;
    this.stats.lookups++;
    if (solver) this.stats.hits++;

    // -- Blend with the simple policy according to the level --
    const facing = legal.check ? null : offFacing;
    const simple = spread(simplePolicy(strength, view.turn, view.opponents, level.looseness, facing, view.round), options);
    let probs;
    if (solver) {
      const sharp = withTemperature(solver, level.temperature);
      probs = sharp.map((p, a) => level.solver * p + (1 - level.solver) * simple[a]);
    } else {
      probs = simple;
    }

    // Only what's legal right now, on the real table
    const allowed = (o) => (o.type === 'fold' ? !legal.check : o.type === 'call' ? true : !!legal.raise);
    probs = normalise(probs.map((p, a) => (allowed(options[a]) ? p : 0)));
    // Purify only the solver's noise, never the fallback's folds
    if (level.purify && solver) probs = normalise(probs.map((p) => (p < level.purify ? 0 : p)));
    const choice = sample(probs);
    const owed = !legal.check;

    return {
      action: this._toAction(options[choice], view.turn, legal),
      debug: {
        key, bucket, strength, history, player: info.player,
        fromSolver: !!solver, offTree: info.offTree, facing, probs,
        options: options.map((o) => optionLabel(o, owed)), choice,
      },
    };
  }

  /** Abstract option → legal PlayerAction, sized on the real table. */
  _toAction(option, turn, legal) {
    if (option.type === 'fold' && !legal.check) return { type: 'fold' };
    if (option.type === 'raise' && legal.raise) {
      const max = maxRaiseTo(turn);
      const to = sizeTo(option.spec, {
        currentBet: turn.currentBet, toCall: toCall(turn), pot: turn.pot, bigBlind: turn.bigBlind, maxTo: max,
      });
      return { type: 'raise', to: Math.min(max, Math.max(minRaiseTo(turn), to)) };
    }
    return legal.check ? { type: 'check' } : { type: 'call', amount: toCall(turn) };
  }
}

/**
 * Strength vs pot odds, used alone when the solver has no answer and mixed in
 * for lower levels. Strength is equity (preflop) or EHS vs one random hand,
 * so it's discounted for each extra opponent.
 *
 * `facing` = an off-tree bet to answer: then it's call-or-fold against a
 * higher threshold (see CALL_SHOVE_*), never a raise.
 * Returns [fold, call, raise]; spread() turns it into the node's options.
 */
function simplePolicy(strength, turn, opponents, looseness, facing = null, round = 0) {
  const s = strength ** Math.max(1, opponents * 0.85);
  const owed = toCall(turn);
  const odds = owed > 0 ? owed / (turn.pot + owed) : 0;

  if (facing && owed > 0) {
    const shove = round === 0 ? CALL_SHOVE_PREFLOP : CALL_SHOVE_POSTFLOP;
    const required = facing.allIn ? shove : Math.min(shove, odds + OVERSIZE_MARGIN);
    return s >= required ? [0, 1, 0] : [1, 0, 0];
  }

  let p;
  if (s > 0.8)                 p = [0.0, 0.4, 0.6];
  else if (s > 0.6)            p = [0.05, 0.7, 0.25];
  else if (s >= odds + 0.05)   p = [0.1, 0.85, 0.05];
  else                         p = [0.7, 0.25, 0.05];

  // Looser players fold less and call more
  p = [p[FOLD] * (1 - looseness), p[CALL] + p[FOLD] * looseness, p[2]];
  return p;
}

/**
 * [fold, call, raise] → one probability per option: the raise share is split
 * between the sizes (the all-in only gets it when it's the only raise).
 */
function spread([fold, call, raise], options) {
  const raises = options.map((o, i) => (o.type === 'raise' ? i : -1)).filter((i) => i >= 0);
  const sized = raises.length > 1 ? raises.slice(0, -1) : raises;
  return options.map((o, i) => (i === FOLD ? fold : i === CALL ? call : sized.includes(i) ? raise / sized.length : 0));
}

function withTemperature(probs, t) {
  return normalise(probs.map((p) => Math.pow(Math.max(p, 0), 1 / t)));
}

function normalise(p) {
  const sum = p.reduce((a, b) => a + b, 0);
  return sum > 0 ? p.map((x) => x / sum) : p.map((_, i) => (i === CALL ? 1 : 0));
}

function sample(p) {
  let r = Math.random();
  for (let a = 0; a < p.length; a++) {
    r -= p[a];
    if (r <= 0) return a;
  }
  return CALL;
}
