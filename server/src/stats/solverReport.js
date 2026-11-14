/**
 * solverReport.js — The player compared with the solver, infoset by infoset
 *
 * For each infoset the player met often enough (MIN_SAMPLES), their action
 * frequencies against the solver's strategy at the same key; the gap is half
 * the sum of the differences (0 = plays exactly like the solver, 1 = opposite).
 *
 * Every street, preflop included, since the solver plays real sizes (2 / 2.5 BB
 * opens, 3-bets, ⅓ to pot bets, all-in). Its sizes are added up into one
 * "raise": the player's decisions are counted as fold / call / raise.
 * FROM_ROUND can skip the first streets again if a solver's preflop is off.
 *
 * The reference is SolverData.strategy(): the analysis strategy (more
 * iterations than the bot's) when installed, otherwise the bot's own.
 */

import { foldCallRaise, strategyGap } from '../../../src/shared/stats/playerInfosets.js';

export const MIN_SAMPLES = 4;
export const FROM_ROUND = 0;
const TOP = 8;

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {import('../ai/solverData.js').SolverData} solver
 */
export async function solverReport(prisma, solver, userId) {
  const [{ abstraction, version }, strategy] = await Promise.all([solver.abstraction(), solver.strategy()]);
  const rows = await prisma.playerInfoset.findMany({ where: { userId, version } });

  const decisions = rows.reduce((s, r) => s + r.folds + r.calls + r.raises, 0);
  const spots = [];
  for (const r of rows) {
    const n = r.folds + r.calls + r.raises;
    if (r.round < FROM_ROUND || n < MIN_SAMPLES) continue;
    const probs = strategy.get(r.key);
    if (!probs) continue;
    const counts = { fold: r.folds, call: r.calls, raise: r.raises };
    const th = abstraction.thresholds[r.round];
    spots.push({
      round: r.round,
      player: r.player,
      bucket: r.bucket,
      // After the flop, the bucket as a hand strength range (EHS: chance to win
      // at showdown, roughly); preflop, the hand types grouped in that bucket
      strength: th ? [th[r.bucket - 1] ?? 0, th[r.bucket] ?? 1] : null,
      hands: th ? null : [...abstraction.preflopBuckets].filter(([, b]) => b === r.bucket).map(([h]) => h),
      history: r.history,
      n,
      you: { fold: r.folds / n, call: r.calls / n, raise: r.raises / n },
      solver: (([fold, call, raise]) => ({ fold, call, raise }))(foldCallRaise(probs)),
      gap: strategyGap(counts, probs),
    });
  }

  // Weighted by how often the spot happens: a big gap seen 30 times matters more
  const weight = spots.reduce((s, x) => s + x.n, 0);
  const averageGap = weight ? spots.reduce((s, x) => s + x.gap * x.n, 0) / weight : null;
  spots.sort((a, b) => b.gap * Math.sqrt(b.n) - a.gap * Math.sqrt(a.n));

  return {
    version,
    reference: solver.reference, // { kind: 'analysis' | 'bot', id }
    decisions,
    infosets: rows.length,
    compared: spots.length,
    minSamples: MIN_SAMPLES,
    fromRound: FROM_ROUND,
    averageGap,
    spots: spots.slice(0, TOP),
  };
}
