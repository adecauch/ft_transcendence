/**
 * ai.test.mjs — GET /api/ai/preflop: the AI's three preflop ranges, nothing more
 */

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { testApp } from './helpers.mjs';

let t;
before(async () => { t = await testApp(); });
after(async () => { await t.close(); });

test('the AI preflop ranges are public and contain only the three grids', async () => {
  const res = await t.app.inject({ method: 'GET', url: '/api/ai/preflop' }); // no cookie: guests too
  assert.equal(res.statusCode, 200);
  const { ranges, equity, ...rest } = res.json();
  assert.deepEqual(rest, {});
  assert.deepEqual(Object.keys(ranges).sort(), ['bbVsLimp', 'bbVsRaise', 'sbOpen']);
  for (const [spot, range] of Object.entries(ranges)) {
    assert.equal(Object.keys(range).length, 169, spot);
    for (const [hand, mix] of Object.entries(range)) {
      assert.deepEqual(Object.keys(mix).sort(), ['call', 'fold', 'raise'], hand);
      assert.ok(Math.abs(mix.fold + mix.call + mix.raise - 1) < 0.01, `${spot} ${hand}`);
    }
  }
  // The AI never folds aces first to act
  assert.ok(ranges.sbOpen.AA.fold < 0.05);
  assert.equal(Object.keys(equity).length, 169);
  assert.ok(equity.AA > 0.8 && equity['32o'] < 0.4);
});
