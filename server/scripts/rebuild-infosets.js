/**
 * rebuild-infosets.js — `npm run db:rebuild-infosets [-- <userId>]`
 *
 * Rebuilds the PlayerInfoset table from the hand history (src/stats/rebuildInfosets.js):
 * after retraining the solver, or to fill it for hands saved before it existed.
 */

import { PrismaClient } from '@prisma/client';
import { loadConfig } from '../src/config.js';
import { SolverData } from '../src/ai/solverData.js';
import { rebuildInfosets } from '../src/stats/rebuildInfosets.js';

const config = loadConfig();
const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
const userId = process.argv[2] ? Number(process.argv[2]) : undefined;

try {
  const solver = new SolverData();
  const { version } = await solver.abstraction();
  console.log(`Abstraction ${version} — reconstruction ${userId ? `du joueur ${userId}` : 'de tous les joueurs'}…`);
  const t = await rebuildInfosets(prisma, solver, { userId, onProgress: (m) => console.log(m) });
  console.log(`Terminé : ${t.users} joueur(s), ${t.hands} main(s), ${t.decisions} décision(s) classées${t.failed ? `, ${t.failed} main(s) ignorée(s)` : ''}.`);
} finally {
  await prisma.$disconnect();
}
