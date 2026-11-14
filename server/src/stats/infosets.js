/**
 * infosets.js — Count the player's decisions per solver infoset (PlayerInfoset table)
 *
 * After each saved hand, the replay's decisions are filed under the solver's
 * keys (src/shared/stats/playerInfosets.js) and added to the player's counters,
 * tagged with the current abstraction version.
 */

import { playerInfosets } from '../../../src/shared/stats/playerInfosets.js';

const FIELD = { fold: 'folds', call: 'calls', raise: 'raises' };

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {import('../ai/solverData.js').SolverData} solver
 * @param {number} userId
 * @param {object[]} decisions — replayHand()'s `decisions`
 * @returns {Promise<number>} decisions filed
 */
export async function recordInfosets(prisma, solver, userId, decisions) {
  const { abstraction, version } = await solver.abstraction();
  const filed = playerInfosets(decisions, abstraction);
  if (!filed.length) return 0;

  // One row per key, even if the key came up twice in the hand
  const rows = new Map();
  for (const f of filed) {
    const row = rows.get(f.key) ?? { ...f, folds: 0, calls: 0, raises: 0 };
    row[FIELD[f.action]]++;
    rows.set(f.key, row);
  }

  await prisma.$transaction([...rows.values()].map(({ key, round, player, bucket, history, folds, calls, raises }) =>
    prisma.playerInfoset.upsert({
      where: { userId_version_key: { userId, version, key } },
      create: { userId, version, key, round, player, bucket, history, folds, calls, raises },
      update: { folds: { increment: folds }, calls: { increment: calls }, raises: { increment: raises } },
    })));
  return filed.length;
}
