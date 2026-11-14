/**
 * equityMatrix.js — Preflop equity: hand vs hand, hand vs range
 *
 * Built from public/ai/equity169.json (scripts/equity-matrix.mjs): for every
 * pair of the 169 hand types, how often the first wins at showdown when both
 * are all-in before the flop.
 *
 * Against a range, the hand types are weighted by how often the range holds
 * them (combos × frequency). Card removal (my ace makes their aces rarer) is
 * ignored: a small approximation, fine for teaching.
 */

import { combos } from '../poker/ranges.js';

export class EquityMatrix {
  /** @param {{ hands: string[], eq: number[][] }} data — eq in per mille */
  constructor({ hands, eq }) {
    this.index = new Map(hands.map((h, i) => [h, i]));
    this.eq = eq;
  }

  /** Equity of `hand` against `other` (0..1). */
  vs(hand, other) {
    return this.eq[this.index.get(hand)][this.index.get(other)] / 1000;
  }

  /**
   * Equity of `hand` against a weighted range.
   * @param {string} hand
   * @param {Map<string, number> | Record<string, number>} weights — hand type → frequency in the range (0..1)
   * @returns {number} 0..1 (0.5 if the range is empty)
   */
  vsRange(hand, weights) {
    let sum = 0;
    let total = 0;
    for (const [other, f] of weights instanceof Map ? weights : Object.entries(weights)) {
      if (!f) continue;
      const w = f * combos(other);
      sum += w * this.vs(hand, other);
      total += w;
    }
    return total ? sum / total : 0.5;
  }
}
