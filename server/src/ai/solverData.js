/**
 * solverData.js — The MCCFR solver's files, read from disk once, on demand
 *
 *   abstraction()  card buckets (CardAbstraction) — to file the player's decisions
 *                  and its version: hash of the bucket / threshold files and of
 *                  the betting abstraction (bet sizes, bettingTree.js BETTING_ID).
 *                  PlayerInfoset rows carry it; a retrained solver with other
 *                  buckets or sizes gets another version (then: npm run db:rebuild-infosets)
 *   strategy()     the REFERENCE the player is compared with (~49 MB): the
 *                  analysis strategy if there is one, otherwise the bot's
 *                  strategy.bin. `reference` says which one was loaded.
 *
 * Abstraction files: public/ai/mccfr/ (copied from the solver by
 * `npm run ai:sync`), or MCCFR_DIR if set. The bot strategy is private:
 * server/data/strategy.bin by default. Analysis strategy: server/data/analysis.bin
 * (`npm run ai:analysis`), or MCCFR_ANALYSIS if set.
 *
 * Why two strategies: the bot plays a strategy the browser downloads; the
 * player deserves the best reference available (more iterations = closer to
 * the equilibrium), read by the server only. Both must come from the SAME
 * abstraction (buckets, bet sizes, key layout): the player's decisions are
 * filed once, under keys that must exist in both. ai:analysis checks it.
 */

import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CardAbstraction } from '../../../src/shared/ai/mccfr/cardAbstraction.js';
import { StrategyTable } from '../../../src/shared/ai/mccfr/StrategyTable.js';
import { BETTING_ID } from '../../../src/shared/ai/mccfr/bettingTree.js';

const DEFAULT_DIR = new URL('../../../public/ai/mccfr/', import.meta.url);
const DEFAULT_ANALYSIS = new URL('../../data/analysis.bin', import.meta.url);
const DEFAULT_STRATEGY = new URL('../../data/strategy.bin', import.meta.url);

const toUrl = (path) => (path instanceof URL ? path : new URL(`file://${path}`));

export class SolverData {
  /** @param {string | URL} [dir] @param {string | URL} [analysis] @param {string | URL} [strategy] */
  constructor(dir = process.env.MCCFR_DIR || DEFAULT_DIR, analysis = process.env.MCCFR_ANALYSIS || DEFAULT_ANALYSIS, strategy) {
    this.dir = dir instanceof URL ? dir : new URL(`file://${dir.endsWith('/') ? dir : `${dir}/`}`);
    this.analysis = toUrl(analysis);
    const strategyPath = strategy ?? process.env.MCCFR_BOT_STRATEGY
      ?? (process.env.MCCFR_DIR ? new URL('strategy.bin', this.dir) : DEFAULT_STRATEGY);
    this.strategyFile = toUrl(strategyPath);
    this._abstraction = null;
    this._strategy = null;
    /** @type {{ kind: 'analysis' | 'bot', id: string } | null} set once strategy() has loaded */
    this.reference = null;
  }

  /** @returns {Promise<{ abstraction: CardAbstraction, version: string }>} */
  abstraction() {
    this._abstraction ??= (async () => {
      const texts = await Promise.all(CardAbstraction.FILES.map((f) => readFile(new URL(f, this.dir), 'utf8')));
      const version = createHash('sha256').update([...texts, BETTING_ID].join('\u0000')).digest('hex').slice(0, 16);
      return { abstraction: CardAbstraction.fromTexts(texts), version };
    })();
    return this._abstraction;
  }

  /** The reference strategy: analysis.bin if present, else the bot's strategy.bin. @returns {Promise<StrategyTable>} */
  strategy() {
    this._strategy ??= (async () => {
      const kind = await access(this.analysis).then(() => 'analysis', () => 'bot');
      const buf = await readFile(kind === 'analysis' ? this.analysis : this.strategyFile);
      // Short fingerprint of the file, to tell two trainings apart on screen
      this.reference = { kind, id: createHash('sha256').update(buf).digest('hex').slice(0, 10) };
      return new StrategyTable(buf);
    })();
    return this._strategy;
  }
}
