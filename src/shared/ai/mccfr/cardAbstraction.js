/**
 * cardAbstraction.js — Card buckets, loaded from the solver's data files
 *
 *   preflop  — buckets.txt: hand type ("AKs", "72o", "QQ") → bucket 0..168
 *              (one bucket per hand type: the preflop abstraction is lossless)
 *   postflop — {flop,turn,river}_thresholds.txt: sorted EHS boundaries;
 *              bucket = number of thresholds ≤ EHS (0 = weakest), exactly like
 *              bucketFromEHS() (std::upper_bound)
 *   equity   — equity_table.txt: preflop win % vs a random hand (for fallbacks)
 */

import { handType } from '../../poker/cards.js';
import { ehs } from './handStrength.js';

function parsePairs(text) {
  const map = new Map();
  for (const line of text.split('\n')) {
    const [k, v] = line.trim().split(/\s+/);
    if (k && v !== undefined) map.set(k, Number(v));
  }
  return map;
}

function parseNumbers(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean).map(Number);
}

export class CardAbstraction {
  constructor({ preflopBuckets, equity, thresholds }) {
    this.preflopBuckets = preflopBuckets; // Map hand type → bucket
    this.equity = equity;                 // Map hand type → equity
    this.thresholds = thresholds;         // { 1: [...], 2: [...], 3: [...] }
  }

  /** The data files the abstraction is made of (the server reads them from disk, the browser over HTTP). */
  static FILES = ['buckets.txt', 'equity_table.txt', 'flop_thresholds.txt', 'turn_thresholds.txt', 'river_thresholds.txt'];

  /** Build from the files' contents, in FILES order. @param {string[]} texts */
  static fromTexts([buckets, equity, flop, turn, river]) {
    return new CardAbstraction({
      preflopBuckets: parsePairs(buckets),
      equity: parsePairs(equity),
      thresholds: { 1: parseNumbers(flop), 2: parseNumbers(turn), 3: parseNumbers(river) },
    });
  }

  /** Load every data file from a base URL (e.g. '/ai/mccfr/'). */
  static async load(baseUrl) {
    const get = async (name) => {
      const res = await fetch(`${baseUrl}${name}`);
      if (!res.ok) throw new Error(`[AI] Missing ${baseUrl}${name} (${res.status})`);
      return res.text();
    };
    return CardAbstraction.fromTexts(await Promise.all(CardAbstraction.FILES.map(get)));
  }

  /**
   * Bucket and hand strength of `hole` on `board` for the given round.
   * @returns {{ bucket: number, strength: number }} strength = equity (preflop) or EHS
   */
  describe(round, hole, board) {
    if (round === 0) {
      const type = handType(hole);
      return {
        bucket: this.preflopBuckets.get(type) ?? 0,
        strength: this.equity.get(type) ?? 0.5,
      };
    }
    const strength = ehs(hole, board);
    return { bucket: bucketFromEHS(this.thresholds[round], strength), strength };
  }
}

/** Number of thresholds ≤ value (upper_bound), i.e. the bucket index. */
export function bucketFromEHS(thresholds, value) {
  let lo = 0;
  let hi = thresholds.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (thresholds[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
