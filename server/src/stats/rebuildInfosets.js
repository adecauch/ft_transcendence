/**
 * rebuildInfosets.js — Rebuild the PlayerInfoset table from the hand history
 *
 * PlayerInfoset is derived data: every saved hand (Hand + Action, the source
 * of truth) is replayed again and its decisions re-filed under the CURRENT
 * abstraction. Needed after the solver is retrained with other buckets, or to
 * fill the table for hands saved before it existed.
 * Run it with `npm run db:rebuild-infosets` (scripts/rebuild-infosets.js).
 */

import { replayHand } from '../../../src/shared/stats/replay.js';
import { replayInputs } from '../../../src/shared/stats/savedHand.js';
import { seatsOf } from '../games/service.js';
import { recordInfosets } from './infosets.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {import('../ai/solverData.js').SolverData} solver
 * @param {{ userId?: number, onProgress?: (msg: string) => void }} [options] — one player, or everyone
 * @returns {Promise<{ users: number, hands: number, decisions: number, failed: number }>}
 */
export async function rebuildInfosets(prisma, solver, { userId, onProgress } = {}) {
  const users = await prisma.user.findMany({ where: userId ? { id: userId } : {}, select: { id: true, username: true } });
  const total = { users: users.length, hands: 0, decisions: 0, failed: 0 };

  for (const user of users) {
    await prisma.playerInfoset.deleteMany({ where: { userId: user.id } }); // every version: old ones are useless
    const games = await prisma.game.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
    for (const game of games) {
      const hands = await prisma.hand.findMany({
        where: { gameId: game.id },
        orderBy: { number: 'asc' },
        include: { actions: { orderBy: { seq: 'asc' } } },
      });
      const seats = seatsOf(game, user);
      const blinds = { small: game.smallBlind, big: game.bigBlind };
      for (const hand of hands) {
        try {
          const { state, log } = replayInputs(hand, seats, blinds);
          const { decisions } = await replayHand(state, log);
          total.decisions += await recordInfosets(prisma, solver, user.id, decisions);
          total.hands++;
        } catch (err) {
          total.failed++;
          onProgress?.(`  main ${hand.number} de la partie ${game.id} ignorée : ${err.message}`);
        }
      }
    }
    onProgress?.(`${user.username} : fait`);
  }
  return total;
}
