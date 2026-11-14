/**
 * handEvaluator.js — Best 5-card hand out of 5 to 7 cards
 *
 * Returns a single comparable number: higher = better hand. Any correct
 * evaluator orders hands like OMPEval (used by the C++ solver), which is all
 * the EHS computation needs.
 *
 * Score = category * 13^5 + tie-breakers (ranks 0..12, most significant first)
 *   8 straight flush · 7 quads · 6 full house · 5 flush · 4 straight
 *   3 trips · 2 two pair · 1 pair · 0 high card
 */

import { rankOf, suitOf } from './cards.js';

const BASE = 13;
const CAT  = BASE ** 5;

function pack(category, ranks) {
  let v = 0;
  for (let i = 0; i < 5; i++) v = v * BASE + (ranks[i] ?? 0);
  return category * CAT + v;
}

/** Highest straight in a rank bitmask (bit r = rank present), or -1. Top rank returned. */
function straightTop(mask) {
  for (let top = 12; top >= 4; top--) {
    const need = 0b11111 << (top - 4);
    if ((mask & need) === need) return top;
  }
  // Wheel: A-2-3-4-5
  if ((mask & 0b1000000001111) === 0b1000000001111) return 3;
  return -1;
}

/** @param {number[]} cards — 5 to 7 cards (0..51) */
export function evaluate(cards) {
  const counts = new Array(13).fill(0);
  const suitMasks = [0, 0, 0, 0];
  const suitCounts = [0, 0, 0, 0];
  let mask = 0;

  for (const c of cards) {
    const r = rankOf(c);
    const s = suitOf(c);
    counts[r]++;
    suitMasks[s] |= 1 << r;
    suitCounts[s]++;
    mask |= 1 << r;
  }

  // Flush / straight flush
  const flushSuit = suitCounts.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    const sf = straightTop(suitMasks[flushSuit]);
    if (sf >= 0) return pack(8, [sf]);
  }

  // Ranks grouped by count, high to low
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 12; r >= 0; r--) {
    if (counts[r] === 4) quads.push(r);
    else if (counts[r] === 3) trips.push(r);
    else if (counts[r] === 2) pairs.push(r);
    else if (counts[r] === 1) singles.push(r);
  }

  if (quads.length) {
    const kicker = Math.max(...trips, ...pairs, ...singles, ...quads.slice(1));
    return pack(7, [quads[0], kicker]);
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pairRank = Math.max(trips[1] ?? -1, pairs[0] ?? -1);
    return pack(6, [trips[0], pairRank]);
  }
  if (flushSuit >= 0) {
    const ranks = [];
    for (let r = 12; r >= 0 && ranks.length < 5; r--) if (suitMasks[flushSuit] & (1 << r)) ranks.push(r);
    return pack(5, ranks);
  }
  const st = straightTop(mask);
  if (st >= 0) return pack(4, [st]);
  if (trips.length) return pack(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) {
    const kicker = Math.max(pairs[2] ?? -1, singles[0] ?? -1);
    return pack(2, [pairs[0], pairs[1], kicker]);
  }
  if (pairs.length) return pack(1, [pairs[0], ...singles.slice(0, 3)]);
  return pack(0, singles.slice(0, 5));
}

/** -1 | 0 | +1, like compareHands() in the solver */
export function compareHands(a, b) {
  const d = evaluate(a) - evaluate(b);
  return d > 0 ? 1 : d < 0 ? -1 : 0;
}
