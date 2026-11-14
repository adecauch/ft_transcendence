/**
 * The player's infosets (PlayerInfoset): filled at each saved hand with the
 * same keys as the solver, compared with the solver, and rebuilt from the
 * hand history. Against the real database.
 *
 *   npm test
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testApp, playGame, CONFIG } from './helpers.mjs';
import { rebuildInfosets } from '../src/stats/rebuildInfosets.js';
import { packInfoSetKey } from '../../src/shared/ai/mccfr/infosetKey.js';

let ctx;
before(async () => { ctx = await testApp(); });
after(() => ctx.close());

const totalDecisions = (rows) => rows.reduce((s, r) => s + r.folds + r.calls + r.raises, 0);

test('each saved hand files the player’s decisions under solver keys', async () => {
  const me = await ctx.player('nora');
  const { prisma, solver } = ctx.app;
  const { version } = await solver.abstraction();

  const id = (await me.post('/api/games', CONFIG)).json().game.id;
  const { logs } = await playGame(40);
  for (const log of logs) assert.equal((await me.post(`/api/games/${id}/hands`, log)).statusCode, 201);

  const rows = await prisma.playerInfoset.findMany({ where: { userId: me.id } });
  const mine = logs.flatMap((l) => l.actions).filter((a) => a.seat === 0).length;
  assert.ok(rows.length > 0);
  assert.ok(totalDecisions(rows) <= mine, 'at most one per decision (off-tree ones skipped)');
  for (const r of rows) {
    assert.equal(r.version, version);
    assert.match(r.key, /^\d+$/);
    assert.match(r.history, /^[fc2-7/]*$/); // option indexes (bettingTree.js)
  }

  // Rebuilt from the history: same number of decisions filed
  const before = totalDecisions(rows);
  const t = await rebuildInfosets(prisma, solver, { userId: me.id });
  assert.equal(t.failed, 0);
  assert.equal(t.hands, logs.length);
  assert.equal(totalDecisions(await prisma.playerInfoset.findMany({ where: { userId: me.id } })), before);
});

test('the solver report compares every street, sizes added up into "raise"', async () => {
  const me = await ctx.player('omar');
  const { version, abstraction } = await ctx.app.solver.abstraction();
  const strategy = await ctx.app.solver.strategy();
  // A flop infoset of the solver, and the small blind's first preflop decision
  const flopKey = String(strategy.keys.find((k) => (k & 3n) === 1n));
  const preKey = packInfoSetKey(0, 0, abstraction.preflopBuckets.get('72o'), '////');
  const data = { userId: me.id, version, folds: 0, calls: 0, raises: 0 };
  await ctx.app.prisma.playerInfoset.createMany({ data: [
    { ...data, key: flopKey, round: 1, player: 1, bucket: 10, history: '2c////', raises: 6 },
    { ...data, key: preKey, round: 0, player: 0, bucket: 3, history: '////', folds: 9 },
    { ...data, key: '12345', round: 0, player: 0, bucket: 3, history: '////', folds: 9 }, // not a solver key
  ] });

  const report = (await me.get('/api/stats/solver')).json();
  // The reference: the analysis strategy if installed, otherwise the bot's (server/src/ai/solverData.js)
  assert.ok(['analysis', 'bot'].includes(report.reference.kind));
  assert.match(report.reference.id, /^[0-9a-f]{10}$/);
  assert.equal(report.decisions, 24);
  assert.equal(report.fromRound, 0);
  assert.equal(report.compared, 2, 'keys the solver doesn\'t know are skipped');
  const spot = report.spots.find((s) => s.round === 1);
  assert.deepEqual(spot.you, { fold: 0, call: 0, raise: 1 });
  const [f, c, ...raises] = strategy.get(flopKey);
  const raise = raises.reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(spot.solver.raise - raise) < 1e-9, 'every size counts as a raise');
  // Half the sum of the differences with (0, 0, 1)
  const expected = (f + c + Math.abs(1 - raise)) / 2;
  assert.ok(Math.abs(spot.gap - expected) < 1e-9, 'gap = how differently the solver plays');
  assert.ok(spot.strength[0] <= spot.strength[1]);
});

test('guests have no solver report', async () => {
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/stats/solver' })).statusCode, 401);
});
