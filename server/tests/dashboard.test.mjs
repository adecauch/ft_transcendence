/**
 * Dashboard, CSV export and real-time stream, against the real database
 * (PostgreSQL running: `make postgres-up`).
 *
 *   npm test
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testApp, playGame, CONFIG } from './helpers.mjs';
import { csvCell } from '../src/stats/exportCsv.js';
import { sampleCurve } from '../src/stats/dashboard.js';

let ctx;
let me;
let hands;
before(async () => {
  ctx = await testApp();
  me = await ctx.player('dash');
  // One game against an expert, saved hand by hand
  const id = (await me.post('/api/games', CONFIG)).json().game.id;
  const { logs } = await playGame(60);
  for (const log of logs) assert.equal((await me.post(`/api/games/${id}/hands`, log)).statusCode, 201);
  hands = logs.length;
});
after(() => ctx.close());

const q = (params) => new URLSearchParams(params).toString();

test('dashboard: totals match the saved hands, in big blinds', async () => {
  const res = await me.get('/api/stats/dashboard?tz=Europe/Paris');
  assert.equal(res.statusCode, 200, res.body);
  const d = res.json();
  assert.equal(d.summary.hands, hands);
  assert.equal(d.summary.games, 1);

  const rows = await ctx.app.prisma.hand.findMany({ where: { game: { userId: me.id } }, select: { heroNet: true } });
  const netBB = rows.reduce((a, h) => a + h.heroNet, 0) / CONFIG.blinds.big;
  assert.ok(Math.abs(d.summary.netBB - netBB) < 1e-9);
  // The curve ends on the total; the groups add up to every hand
  assert.ok(Math.abs(d.curve.at(-1).total - netBB) < 1e-9);
  assert.equal(d.curve.at(-1).hand, hands);
  assert.deepEqual(d.byLevel.map((l) => [l.key, l.hands]), [['expert', hands]]);
  assert.equal(d.byPosition.reduce((a, p) => a + p.hands, 0), hands);
  assert.equal(d.timeline.points.reduce((a, p) => a + p.hands, 0), hands);
  assert.ok(d.actions.every((a) => ['fold', 'check', 'call', 'bet', 'raise'].includes(a.type)));
});

test('dashboard: filters (level, number of AIs, period)', async () => {
  const count = async (params) => (await me.get(`/api/stats/dashboard?${q(params)}`)).json().summary.hands;
  assert.equal(await count({ level: 'expert' }), hands);
  assert.equal(await count({ level: 'beginner' }), 0);
  assert.equal(await count({ opponents: 1 }), hands);
  assert.equal(await count({ opponents: 3 }), 0);
  assert.equal(await count({ from: new Date(Date.now() + 3600e3).toISOString() }), 0);
  assert.equal(await count({ from: new Date(Date.now() - 3600e3).toISOString(), to: new Date(Date.now() + 3600e3).toISOString() }), hands);
  // Bad values are refused, not guessed; an unknown time zone falls back to UTC
  assert.equal((await me.get('/api/stats/dashboard?level=god')).statusCode, 400);
  assert.equal((await me.get('/api/stats/dashboard?from=hier')).statusCode, 400);
  assert.equal((await me.get('/api/stats/dashboard?tz=Mars/Olympus')).statusCode, 200);
});

test('dashboard: reserved to the player, nobody else sees their hands', async () => {
  assert.equal((await ctx.app.inject({ url: '/api/stats/dashboard' })).statusCode, 401);
  const other = await ctx.player('other');
  assert.equal((await other.get('/api/stats/dashboard')).json().summary.hands, 0);
});

test('CSV export: one line per hand, filters applied, formulas neutralised', async () => {
  const res = await me.get('/api/stats/export.csv');
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.headers['content-disposition'], /attachment; filename="poker-mains-/);
  const lines = res.body.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(lines.length, hands + 1);
  assert.ok(lines[0].startsWith('date,partie,main,niveau_ia'));
  assert.equal((await me.get('/api/stats/export.csv?level=beginner')).body.trim().split('\r\n').length, 1);

  assert.equal(csvCell(-40), '-40');
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('Full aux rois, par les sept'), '"Full aux rois, par les sept"');
});

test('curve sampling keeps the last hand and at most 300 points', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ at: new Date(i), total: i }));
  const s = sampleCurve(rows);
  assert.ok(s.length <= 300);
  assert.equal(s.at(-1).hand, 1000);
  assert.deepEqual(sampleCurve(rows.slice(0, 3)).map((p) => p.hand), [1, 2, 3]);
});

test('live: a saved hand is pushed to the open dashboard stream', async () => {
  const { app } = ctx;
  await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const player = await ctx.player('live');
  // Log in over HTTP to get a real cookie for fetch()
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `live-${ctx.run}@test.invalid`, password: 'un-bon-mot-de-passe' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const stream = await fetch(`${base}/api/stats/live`, { headers: { cookie } });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type'), /text\/event-stream/);
  const reader = stream.body.getReader();

  const id = (await player.post('/api/games', CONFIG)).json().game.id;
  const { logs } = await playGame(1);
  assert.equal((await player.post(`/api/games/${id}/hands`, logs[0])).statusCode, 201);

  let text = '';
  while (!text.includes('event: hand')) text += new TextDecoder().decode((await reader.read()).value);
  assert.match(text, new RegExp(`"gameId":${id}`));
  await reader.cancel();
});
