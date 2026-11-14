/**
 * preflop.js — The AI's three preflop ranges, computed on the server
 *
 * The browser no longer gets strategy.bin (the table runs on the server), so
 * the range chart's « vraies ranges de l'IA » (🔍 Explorer) come from here:
 * the same reading as before (shared/ai/preflopRanges.js), done once, and only
 * these three grids leave the server — never the strategy, never a postflop
 * spot. Charts like these are public anyway (preflop GTO charts are
 * everywhere): no help to cheat at the table.
 *
 * Also sends each hand's equity against a random hand (equity_table.txt, a
 * public file), shown when a cell is described.
 */

import { SOLVER_SPOTS, solverPreflopRange } from '../../../src/shared/ai/preflopRanges.js';

const round = (p) => Math.round(p * 1000) / 1000;

/**
 * @param {import('./solverData.js').SolverData} solver
 * @returns {Promise<{ ranges: Record<string, Record<string, { fold: number, call: number, raise: number }> | null>, equity: Record<string, number> }>}
 */
export async function aiPreflop(solver) {
  // The strategy the server's bot plays (table/session.js reads the same one)
  const [{ abstraction }, strategy] = await Promise.all([solver.abstraction(), solver.strategy()]);
  const ranges = {};
  for (const spot of Object.keys(SOLVER_SPOTS)) {
    const raw = solverPreflopRange(abstraction, strategy, spot);
    ranges[spot] = raw && Object.fromEntries(Object.entries(raw).map(([hand, mix]) => [hand, {
      fold: round(mix.fold), call: round(mix.call), raise: round(mix.raise),
    }]));
  }
  const equity = Object.fromEntries([...abstraction.equity].map(([hand, e]) => [hand, round(e)]));
  return { ranges, equity };
}
