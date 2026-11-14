/**
 * playerInfosets.js — The player's decisions, filed under the solver's infoset keys
 *
 * Each decision of a replayed hand (replay.js → `decisions`) goes through the
 * same chain as the bot (ai/mccfr/infoset.js) and becomes:
 *   { key, round, player, bucket, history, action }   action: fold | call | raise
 * Counting them per key gives the player's own strategy — so it can be
 * compared with the solver's, key by key. The comparison is on fold / call /
 * raise: the solver's sizes are added up into one "raise" (foldCallRaise).
 *
 * Decisions outside the solver's game (all-ins, oversized raises: `offTree`)
 * have no meaningful key and are skipped.
 */

import { describeInfoset } from '../ai/mccfr/infoset.js';

/** Our action types → the solver's three actions (a check is a "call" of nothing). */
const SOLVER_ACTION = { fold: 'fold', check: 'call', call: 'call', raise: 'raise' };

/**
 * @param {object[]} decisions — replay.js `decisions`
 * @param {import('../ai/mccfr/cardAbstraction.js').CardAbstraction} abstraction
 * @param {number} [seat] — whose decisions (0 = the player)
 */
export function playerInfosets(decisions, abstraction, seat = 0) {
  const out = [];
  for (const d of decisions) {
    if (d.seat !== seat) continue;
    const info = describeInfoset(abstraction, d);
    if (info.offTree) continue;
    out.push({
      key: info.key, round: info.round, player: info.player, bucket: info.bucket,
      history: info.history, action: SOLVER_ACTION[d.type],
    });
  }
  return out;
}

/**
 * A solver row (fold, call, then one probability per size and the all-in)
 * → [fold, call, raise].
 * @param {number[]} probs
 */
export function foldCallRaise([fold, call, ...raises]) {
  return [fold, call, raises.reduce((a, b) => a + b, 0)];
}

/**
 * How far the player's frequencies are from the solver's at one infoset:
 * half the sum of the absolute differences (0 = identical, 1 = opposite).
 * @param {{ fold: number, call: number, raise: number }} counts
 * @param {number[]} probs — the solver's row (see foldCallRaise)
 */
export function strategyGap(counts, probs) {
  const solver = foldCallRaise(probs);
  const n = counts.fold + counts.call + counts.raise;
  if (!n) return 0;
  const mine = [counts.fold / n, counts.call / n, counts.raise / n];
  return mine.reduce((sum, p, i) => sum + Math.abs(p - solver[i]), 0) / 2;
}
