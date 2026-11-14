/**
 * friends.test.mjs — /api/friends and /api/lobby: requests, friendships,
 * search by friend code, real presence (the live stream), table invitations
 */

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { testApp } from './helpers.mjs';

let t;
let base;
before(async () => {
  t = await testApp();
  await t.app.listen({ port: 0, host: '127.0.0.1' }); // the live stream needs a real connection
  base = `http://127.0.0.1:${t.app.server.address().port}`;
});
after(async () => { await t.close(); });

/** Open a player's live stream (= their page is open: online). Resolves once connected. */
async function goOnline(p) {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/friends/live`, { headers: { cookie: `sid=${p.sid}` }, signal: controller.signal });
  assert.equal(res.status, 200);
  const reader = res.body.getReader();
  const events = [];
  (async () => {
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const m of decoder.decode(value).matchAll(/^event: (\w+)$/gm)) events.push(m[1]);
      }
    } catch { /* aborted */ }
  })();
  await new Promise((r) => setTimeout(r, 50));
  return { events, close: () => controller.abort() };
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const statusOf = async (p, friendId) => (await p.get('/api/friends')).json().friends.find((f) => f.id === friendId);

test('guests get 401 everywhere', async () => {
  for (const url of ['/api/friends', '/api/friends/requests', '/api/friends/search?q=ab', '/api/lobby/invitations']) {
    assert.equal((await t.app.inject({ method: 'GET', url })).statusCode, 401, url);
  }
});

test('request → accept → friends; search by code; remove', async () => {
  const anna = await t.player('anna');
  const bob = await t.player('bob');

  // Search: a piece of pseudo, or the exact friend code; never yourself
  const byCode = (await anna.get(`/api/friends/search?q=${encodeURIComponent(`${bob.username}#${bob.tag}`)}`)).json().players;
  assert.deepEqual(byCode.map((p) => p.id), [bob.id]);
  assert.equal(byCode[0].relation, 'none');
  assert.equal(byCode[0].email, undefined, 'never an email');
  const byName = (await anna.get(`/api/friends/search?q=anna_${t.run}`)).json().players;
  assert.ok(!byName.some((p) => p.id === anna.id), 'not yourself');

  assert.equal((await anna.post('/api/friends/requests', { userId: anna.id })).statusCode, 400);
  const sent = await anna.post('/api/friends/requests', { userId: bob.id });
  assert.equal(sent.statusCode, 201);
  assert.equal((await anna.post('/api/friends/requests', { userId: bob.id })).statusCode, 409, 'twice');

  const { incoming } = (await bob.get('/api/friends/requests')).json();
  assert.equal(incoming.length, 1);
  assert.equal(incoming[0].user.id, anna.id);
  assert.equal((await anna.post(`/api/friends/requests/${incoming[0].id}/accept`)).statusCode, 404, 'only the addressee accepts');
  const accepted = await bob.post(`/api/friends/requests/${incoming[0].id}/accept`);
  assert.equal(accepted.json().friend.id, anna.id);

  const annaFriend = await statusOf(anna, bob.id);
  assert.equal(annaFriend.status, 'offline');
  assert.equal((await bob.get(`/api/friends/search?q=${encodeURIComponent(`${anna.username}#${anna.tag}`)}`)).json().players[0].relation, 'friend');

  assert.equal((await anna.del(`/api/friends/${bob.id}`)).statusCode, 204);
  assert.equal((await bob.get('/api/friends')).json().friends.length, 0, 'gone for both');
});

test('crossing requests become a friendship; refusing and cancelling', async () => {
  const cleo = await t.player('cleo');
  const dan = await t.player('dan');
  const eve = await t.player('eve');

  await cleo.post('/api/friends/requests', { userId: dan.id });
  const back = await dan.post('/api/friends/requests', { userId: cleo.id });
  assert.equal(back.statusCode, 200, 'dan asking back accepts cleo’s request');
  assert.equal(back.json().friend.id, cleo.id);

  const toEve = (await cleo.post('/api/friends/requests', { userId: eve.id })).json().request;
  assert.equal((await dan.del(`/api/friends/requests/${toEve.id}`)).statusCode, 404, 'not theirs');
  assert.equal((await eve.del(`/api/friends/requests/${toEve.id}`)).statusCode, 204, 'refused');
  assert.equal((await cleo.get('/api/friends/requests')).json().outgoing.length, 0);
});

test('presence: online while the page is open, playing at a table, last seen after', async () => {
  const fay = await t.player('fay');
  const gus = await t.player('gus');
  await fay.post('/api/friends/requests', { userId: gus.id });
  const req = (await gus.get('/api/friends/requests')).json().incoming[0];
  await gus.post(`/api/friends/requests/${req.id}/accept`);

  const fayPage = await goOnline(fay);
  const gusPage = await goOnline(gus);
  assert.equal((await statusOf(fay, gus.id)).status, 'online');
  assert.ok(fayPage.events.includes('friends'), 'fay was told gus came online');

  // At a server table → playing (the registry is what the table route fills)
  const table = { tableId: 'test-table', closed: false, user: { id: gus.id } };
  t.app.tables.add(table);
  assert.equal((await statusOf(fay, gus.id)).status, 'playing');
  t.app.tables.remove(table);

  gusPage.close();
  await pause(300);
  const gone = await statusOf(fay, gus.id);
  assert.equal(gone.status, 'offline');
  assert.ok(gone.lastSeen, 'last seen written');
  fayPage.close();
});

test('invitations: to an online friend only; listed, told live, declined', async () => {
  const hal = await t.player('hal');
  const ivy = await t.player('ivy');
  const stranger = await t.player('joe');
  await hal.post('/api/friends/requests', { userId: ivy.id });
  await ivy.post(`/api/friends/requests/${(await ivy.get('/api/friends/requests')).json().incoming[0].id}/accept`);

  assert.equal((await hal.post('/api/lobby/invitations', { userId: stranger.id })).statusCode, 404, 'not a friend');
  assert.equal((await hal.post('/api/lobby/invitations', { userId: ivy.id })).statusCode, 409, 'ivy is offline');

  const ivyPage = await goOnline(ivy);
  const sent = await hal.post('/api/lobby/invitations', { userId: ivy.id });
  assert.equal(sent.statusCode, 201);
  await pause(100);
  assert.ok(ivyPage.events.includes('invitations'), 'ivy was told at once');
  assert.equal((await hal.post('/api/lobby/invitations', { userId: ivy.id })).statusCode, 201, 'sent again: refreshed');

  const { invitations } = (await ivy.get('/api/lobby/invitations')).json();
  assert.equal(invitations.length, 1, 'one per pair');
  assert.equal(invitations[0].from.id, hal.id);
  assert.equal((await stranger.del(`/api/lobby/invitations/${invitations[0].id}`)).statusCode, 404);
  assert.equal((await ivy.del(`/api/lobby/invitations/${invitations[0].id}`)).statusCode, 204);
  assert.equal((await ivy.get('/api/lobby/invitations')).json().invitations.length, 0);
  ivyPage.close();
});
