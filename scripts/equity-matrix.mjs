/**
 * equity-matrix.mjs — The 169 × 169 preflop equity table
 *
 *   npm run ai:equity        → public/ai/equity169.json
 *
 * For every pair of starting hand types (AKs vs QQ…), how often the first
 * wins at showdown (ties count half), all-in before the flop: Monte Carlo
 * over random suits and boards. Used by the preflop theory model
 * (src/shared/theory/preflopModel.js) to get a hand's equity against a range.
 *
 * Seeded random numbers: the same file every run. SAMPLES per pair gives
 * about ±1 % precision.
 */

import fs from 'node:fs';
import { ALL_HANDS, handKind } from '../src/shared/poker/ranges.js';
import { codeToCard } from '../src/shared/poker/cards.js';
import { evaluate } from '../src/shared/poker/handEvaluator.js';

const SAMPLES = 3000;
const SUITS = 'SHDC';
const OUT = new URL('../public/ai/equity169.json', import.meta.url);

/** mulberry32: small seeded PRNG */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = rng(42);

/** Every 2-card combo of a hand type, as card numbers. */
function combosOf(hand) {
  const [a, b] = hand;
  const out = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const kind = handKind(hand);
      if (kind === 'pair' && j <= i) continue;
      if (kind === 'suited' && i !== j) continue;
      if (kind === 'offsuit' && i === j) continue;
      out.push([codeToCard(a + SUITS[i]), codeToCard(b + SUITS[j])]);
    }
  }
  return out;
}

const COMBOS = ALL_HANDS.map(combosOf);
const n = ALL_HANDS.length;
const eq = Array.from({ length: n }, () => new Array(n).fill(0));
const deck = Array.from({ length: 52 }, (_, i) => i);
const t0 = Date.now();

for (let i = 0; i < n; i++) {
  for (let j = i; j < n; j++) {
    let score = 0;
    let done = 0;
    for (let s = 0; s < SAMPLES * 4 && done < SAMPLES; s++) {
      const h = COMBOS[i][Math.floor(random() * COMBOS[i].length)];
      const v = COMBOS[j][Math.floor(random() * COMBOS[j].length)];
      if (h[0] === v[0] || h[0] === v[1] || h[1] === v[0] || h[1] === v[1]) continue; // same card twice
      // 5 board cards from the rest (partial Fisher–Yates)
      const rest = deck.filter((c) => c !== h[0] && c !== h[1] && c !== v[0] && c !== v[1]);
      for (let k = 0; k < 5; k++) {
        const r = k + Math.floor(random() * (rest.length - k));
        [rest[k], rest[r]] = [rest[r], rest[k]];
      }
      const board = rest.slice(0, 5);
      const a = evaluate([...h, ...board]);
      const b = evaluate([...v, ...board]);
      score += a > b ? 1 : a === b ? 0.5 : 0;
      done++;
    }
    const e = done ? score / done : 0.5;
    eq[i][j] = e;
    eq[j][i] = 1 - e;
  }
  if (i % 20 === 0) console.log(`${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// Per mille, as integers: small file, enough precision (±1 % anyway)
fs.writeFileSync(OUT, JSON.stringify({
  about: 'Preflop all-in equity of hand type (row) vs hand type (column), per mille. scripts/equity-matrix.mjs',
  samples: SAMPLES,
  hands: ALL_HANDS,
  eq: eq.map((row) => row.map((x) => Math.round(x * 1000))),
}));
console.log(`Écrit ${OUT.pathname} en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
