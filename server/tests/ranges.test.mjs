/**
 * Saved ranges (/api/ranges), against the real database.
 *
 *   npm test
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testApp } from './helpers.mjs';

let ctx;
before(async () => { ctx = await testApp(); });
after(() => ctx.close());

const OPEN = { AA: { raise: 1 }, AKs: { raise: 1 }, '77': { call: 1 }, KQs: { raise: 0.5, call: 0.5 } };

test('save, list, rename, change and delete a range', async () => {
  const me = await ctx.player('kim');
  const created = await me.post('/api/ranges', { name: '  Mon bouton  ', range: { ...OPEN, '72o': { raise: 0 } } });
  assert.equal(created.statusCode, 201);
  const { range } = created.json();
  assert.equal(range.name, 'Mon bouton', 'name trimmed');
  assert.deepEqual(range.range, OPEN, 'zero frequencies dropped (= fold)');

  const updated = await me.put(`/api/ranges/${range.id}`, { name: 'Bouton large', range: { ...OPEN, '22': { call: 1 } } });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().range.name, 'Bouton large');
  assert.deepEqual(updated.json().range.range['22'], { call: 1 });

  const list = (await me.get('/api/ranges')).json().ranges;
  assert.deepEqual(list.map((r) => r.name), ['Bouton large']);

  assert.equal((await me.del(`/api/ranges/${range.id}`)).statusCode, 204);
  assert.deepEqual((await me.get('/api/ranges')).json().ranges, []);
});

test('bad ranges, duplicate names and other players are refused', async () => {
  const me = await ctx.player('lea');
  const other = await ctx.player('max');
  const bad = [
    { name: 'x', range: { AX: { raise: 1 } } },          // not a hand
    { name: 'x', range: { AA: { shove: 1 } } },          // unknown action
    { name: 'x', range: { AA: { raise: 0.8, call: 0.5 } } }, // more than 100 %
    { name: 'x', range: { AA: { raise: 2 } } },          // frequency > 1 (schema)
    { name: '', range: OPEN },                           // no name
  ];
  for (const payload of bad) assert.equal((await me.post('/api/ranges', payload)).statusCode, 400, JSON.stringify(payload));

  const id = (await me.post('/api/ranges', { name: 'A', range: OPEN })).json().range.id;
  const twice = await me.post('/api/ranges', { name: 'A', range: OPEN });
  assert.equal(twice.statusCode, 409);
  assert.match(twice.json().error, /déjà une range avec ce nom/);

  assert.equal((await other.put(`/api/ranges/${id}`, { name: 'volée' })).statusCode, 404);
  assert.equal((await other.del(`/api/ranges/${id}`)).statusCode, 404);
  assert.deepEqual((await other.get('/api/ranges')).json().ranges, []);
});

test('guests have no saved ranges', async () => {
  assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/ranges' })).statusCode, 401);
});
