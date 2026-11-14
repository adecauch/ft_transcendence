// Preflop theory model — run with `npm run test:ai`
// The equity table (public/ai/equity169.json, scripts/equity-matrix.mjs) and
// the heads-up EV model built on it (src/shared/theory/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EquityMatrix } from '../src/shared/theory/equityMatrix.js';
import { PreflopModel, SPOTS } from '../src/shared/theory/preflopModel.js';
import { ALL_HANDS, rangeStats } from '../src/shared/poker/ranges.js';

const matrix = new EquityMatrix(JSON.parse(fs.readFileSync(new URL('../public/ai/equity169.json', import.meta.url))));
const model = new PreflopModel(matrix);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('equity table: known match-ups, symmetric', () => {
  near(matrix.vs('AA', 'KK'), 0.82, 0.015, 'AA vs KK');
  near(matrix.vs('AKs', 'QQ'), 0.46, 0.015, 'AKs vs QQ');
  near(matrix.vs('JTs', 'AKo'), 0.41, 0.015, 'JTs vs AKo');
  for (const [a, b] of [['AA', '72o'], ['T9s', '55'], ['AKo', 'KQs']]) near(matrix.vs(a, b) + matrix.vs(b, a), 1, 0.002, `${a}/${b}`);
  near(matrix.vsRange('AA', { KK: 1 }), matrix.vs('AA', 'KK'), 1e-9, 'range of one hand');
});

test('the model plays the obvious hands the obvious way', () => {
  for (const spot of SPOTS) assert.deepEqual(model.best(spot, 'AA'), { raise: 1 }, `AA ${spot}`);
  assert.deepEqual(model.best('vsRaise', '72o'), { fold: 1 }, '72o facing a raise');
  // Checking is free: folding the big blind after a limp is never best
  for (const h of ALL_HANDS) assert.ok(!model.best('vsLimp', h).fold, `fold ${h} after a limp`);
});

test('playing the theory costs nothing; anything else costs something', () => {
  for (const spot of SPOTS) {
    for (const h of ['AKs', 'T9s', '55', 'K7o', '32o']) {
      assert.ok(model.per100(spot, h, model.best(spot, h)).loss < 5 + 1e-9, `${spot} ${h} theory`);
      for (const a of ['fold', 'call', 'raise']) assert.ok(model.per100(spot, h, { [a]: 1 }).loss >= -1e-9, `${spot} ${h} ${a}`);
    }
  }
  assert.ok(model.per100('open', 'AA', { fold: 1 }).loss > 150, 'folding aces costs a lot');
});

test('theory ranges look like heads-up play', () => {
  const s = (spot) => rangeStats(model.theory(spot), ['raise', 'call', 'fold']);
  const open = s('open');
  assert.ok(open.raise.share + open.call.share > 0.85, 'the small blind plays most hands');
  const vsRaise = s('vsRaise');
  assert.ok(vsRaise.raise.share > 0.1 && vsRaise.raise.share < 0.35, '3-bets some');
  assert.ok(vsRaise.fold.share > 0.15 && vsRaise.fold.share < 0.5, 'folds the worst');
});
