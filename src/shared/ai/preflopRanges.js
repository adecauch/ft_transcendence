/**
 * preflopRanges.js — The AI's real preflop ranges, read from the MCCFR strategy
 *
 * Preflop, the solver gives each of the 169 hand types its own bucket (buckets.txt);
 * the strategy gives fold / call / raise probabilities per bucket and betting
 * history. Reading it for every hand type draws the AI's range as a grid
 * (the range chart, front/ui/ranges/RangeScreen.js).
 *
 * The solver's game (heads-up): player 0 = small blind, acts first preflop;
 * player 1 = big blind. History characters are option indexes
 * (mccfr/bettingTree.js): c = call / check, then the node's sizes — at the
 * root '2' = the 2 BB open, '3' = the 2.5 BB open, '4' = all-in. Every size
 * and the all-in add up into `raise`.
 */

import { packInfoSetKey, historyString } from './mccfr/infosetKey.js';
import { ALL_HANDS } from '../poker/ranges.js';

/** Preflop situations of the solver's game. `history` = the moves before the AI's decision. */
export const SOLVER_SPOTS = {
  sbOpen:     { player: 0, history: [] },          // small blind, first to act
  bbVsLimp:   { player: 1, history: ['c'] },       // big blind, the small blind just called
  bbVsRaise:  { player: 1, history: ['3'] },       // big blind, the small blind opened to 2.5 BB (the texts of rangePresets.js say so)
};

/**
 * @param {import('./mccfr/cardAbstraction.js').CardAbstraction} abstraction
 * @param {import('./mccfr/StrategyTable.js').StrategyTable} strategy
 * @param {keyof SOLVER_SPOTS} spot
 * @returns {Record<string, { fold: number, call: number, raise: number }> | null}
 *   null when the strategy doesn't cover this spot
 */
export function solverPreflopRange(abstraction, strategy, spot) {
  const { player, history } = SOLVER_SPOTS[spot];
  const h = historyString([history]);
  const range = {};
  for (const hand of ALL_HANDS) {
    const bucket = abstraction.preflopBuckets.get(hand);
    const probs = bucket === undefined ? null : strategy.get(packInfoSetKey(0, player, bucket, h));
    if (!probs) return null;
    const [fold, call, ...raises] = probs;
    range[hand] = { fold, call, raise: raises.reduce((a, b) => a + b, 0) };
  }
  return range;
}
