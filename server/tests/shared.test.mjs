/**
 * shared.test.mjs — Shared tables (table/shared.js): several logged-in players,
 * each with their own WebSocket, each seeing the table from their seat
 */

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import { testApp } from './helpers.mjs';
import { legalActions, toCall } from '../../src/shared/poker/betting.js';

let t;
let url;
let ben; // reused by the last test: 10 sign-ups / minute / IP
before(async () => {
  t = await testApp();
  t.app.config.tableTiming = { actionMs: 3000, displayMs: 6000 };
  await t.app.listen({ port: 0, host: '127.0.0.1' });
  url = `ws://127.0.0.1:${t.app.server.address().port}/ws/table`;
});
after(async () => { await t.close(); });

/** A player's socket: a queue of messages, next(pred) waits for one. */
function connect(p) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: p ? { cookie: `sid=${p.sid}` } : {} });
    ws.queue = []; ws.waiters = []; ws.log = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(raw);
      ws.log.push(m);
      const i = ws.waiters.findIndex((w) => w.pred(m));
      if (i >= 0) ws.waiters.splice(i, 1)[0].resolve(m); else ws.queue.push(m);
    });
    ws.next = (pred = () => true, ms = 8000) => {
      const i = ws.queue.findIndex(pred);
      if (i >= 0) return Promise.resolve(ws.queue.splice(i, 1)[0]);
      return new Promise((res, rej) => {
        const timer = setTimeout(() => rej(new Error(`timeout waiting (${ws.log.at(-1)?.type})`)), ms);
        ws.waiters.push({ pred, resolve: (m) => { clearTimeout(timer); res(m); } });
      });
    };
    ws.say = (m) => ws.send(JSON.stringify(m));
    ws.on('open', async () => { await ws.next((m) => m.type === 'hello'); resolve(ws); });
    ws.on('error', reject);
  });
}
const is = (type) => (m) => m.type === type;
const isEvent = (type) => (m) => m.type === 'event' && m.event.type === type;

/** Answer every turn with a random legal action (sometimes all-in: games end fast). */
function autoPlay(ws) {
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.type !== 'actionRequest') return;
    ws.say({ type: 'actionShown', requestId: m.requestId });
    const legal = legalActions(m.turn);
    const r = Math.random();
    const action = legal.raise && r < 0.4 ? { type: 'raise', to: legal.raise.max }
      : legal.check ? { type: 'check' } : r < 0.2 ? { type: 'fold' } : { type: 'call', amount: toCall(m.turn) };
    ws.say({ type: 'action', requestId: m.requestId, action });
  });
}

async function createTable(host, config = { startingStack: 40, blinds: { small: 1, big: 2 }, bots: 0 }) {
  const ws = await connect(host);
  ws.say({ type: 'createTable', requestId: 'create', config });
  const joined = await ws.next(is('joined'));
  return { ws, code: joined.tableId, joined };
}
async function joinTable(p, code) {
  const ws = await connect(p);
  ws.say({ type: 'joinShared', requestId: 'join', tableId: code });
  return { ws, answer: await ws.next((m) => m.type === 'joined' || m.type === 'error') };
}

test('guests can’t play online; codes are checked; only the host starts, with 2 players', async () => {
  const guest = await connect(null);
  guest.say({ type: 'createTable', requestId: 'g', config: {} });
  assert.equal((await guest.next(is('error'))).code, 'LOGIN_REQUIRED');
  guest.close();

  const ana = await t.player('ana');
  ben = await t.player('ben');
  const table = await createTable(ana);
  assert.match(table.code, /^[A-Z0-9]{6}$/);
  assert.equal((await table.ws.next(is('lobby'))).players.length, 1);
  table.ws.say({ type: 'startTable', requestId: 's0' });
  assert.equal((await table.ws.next(is('error'))).code, 'NOT_ENOUGH_PLAYERS');

  assert.equal((await joinTable(ben, 'ZZZZZZ')).answer.code, 'UNKNOWN_TABLE');
  const b = await joinTable(ben, table.code.toLowerCase());
  assert.equal(b.answer.type, 'joined', 'the code is case-insensitive');
  const lobby = await table.ws.next((m) => m.type === 'lobby' && m.players.length === 2);
  assert.deepEqual(lobby.players.map((p) => p.id), [ana.id, ben.id]);
  assert.ok(lobby.players.every((p) => p.connected && p.email === undefined));
  b.ws.say({ type: 'startTable', requestId: 's1' });
  assert.equal((await b.ws.next(is('error'))).code, 'NOT_HOST');
  assert.equal((await joinTable(ben, table.code)).answer.code, 'ALREADY_SEATED');
  const duplicate = await connect(ana);
  duplicate.say({ type: 'createTable', config: {} });
  assert.equal((await duplicate.next(is('error'))).code, 'ALREADY_IN_TABLE');
  duplicate.say({ type: 'joinTable', config: {} });
  assert.equal((await duplicate.next(is('error'))).code, 'ALREADY_IN_TABLE');
  duplicate.close();
  b.ws.say({ type: 'leaveTable' });
  await b.ws.next(is('gameEnd'));
  table.ws.close(); b.ws.close();
});

test('two players: each sees the table from their seat, never the other’s cards; hands saved for both', async () => {
  const cat = await t.player('cat');
  const dov = await t.player('dov');
  const table = await createTable(cat);
  const d = await joinTable(dov, table.code);
  await table.ws.next((m) => m.type === 'lobby' && m.players.length === 2);
  table.ws.say({ type: 'startTable', requestId: 'go' });

  const [startC, startD] = await Promise.all([table.ws.next(isEvent('handStart')), d.ws.next(isEvent('handStart'))]);
  assert.deepEqual(startC.event.seats.map((s) => [s.name, s.isHuman]), [[cat.username, true], [dov.username, false]]);
  assert.deepEqual(startD.event.seats.map((s) => [s.name, s.isHuman]), [[dov.username, true], [cat.username, false]]);
  assert.equal(startD.event.seats[1].remote, true, 'the other one is a remote human');
  const [dealC, dealD] = await Promise.all([table.ws.next(isEvent('deal')), d.ws.next(isEvent('deal'))]);
  assert.equal(dealC.event.hole[0].length, 2);
  assert.equal(dealC.event.hole[1], null, 'cat never sees dov’s cards');
  assert.equal(dealD.event.hole[1], null, 'dov never sees cat’s cards');
  assert.notDeepEqual(dealC.event.hole[0], dealD.event.hole[0]);
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(t.app.presence.isPlaying(cat.id) && t.app.presence.isPlaying(dov.id), 'both "en partie"');

  autoPlay(table.ws); autoPlay(d.ws);
  const [endC, endD] = await Promise.all([table.ws.next(is('gameEnd'), 60000), d.ws.next(is('gameEnd'), 60000)]);
  assert.deepEqual([endC.reason, endD.reason].sort(), ['lost', 'won']);
  await new Promise((r) => setTimeout(r, 500));

  const games = await t.app.prisma.game.findMany({ where: { userId: { in: [cat.id, dov.id] } }, include: { hands: { orderBy: { number: 'asc' } } } });
  assert.equal(games.length, 2, 'one game row per player');
  assert.deepEqual(games.map((g) => g.status).sort(), ['LOST', 'WON']);
  assert.equal(games[0].hands.length, games[1].hands.length, 'every hand saved for both');
  assert.ok(games[0].hands.length > 0);
  for (let i = 0; i < games[0].hands.length; i++) {
    assert.equal(games[0].hands[i].heroNet + games[1].hands[i].heroNet, 0, `hand ${i + 1}: one wins what the other loses`);
  }
  assert.ok(!t.app.presence.isPlaying(cat.id), 'table closed at the end');
  table.ws.close(); d.ws.close();
});

test('three players and an AI; one leaves mid-game, the others go on', async () => {
  const eva = await t.player('eva');
  const fox = await t.player('fox');
  const gil = await t.player('gil');
  const table = await createTable(eva, { startingStack: 200, blinds: { small: 1, big: 2 }, bots: 1 });
  const f = await joinTable(fox, table.code);
  const g = await joinTable(gil, table.code);
  await table.ws.next((m) => m.type === 'lobby' && m.players.length === 3);
  table.ws.say({ type: 'startTable', requestId: 'go' });
  const start = await g.ws.next(isEvent('handStart'));
  assert.equal(start.event.seats.length, 4, '3 humans + 1 AI');
  // Seats: eva, fox, gil, the AI → seen from gil, clockwise: gil, the AI, eva, fox
  assert.deepEqual(start.event.seats.map((s) => s.name), [gil.username, 'Le Baron', eva.username, fox.username], 'gil’s own clockwise order');

  autoPlay(table.ws); autoPlay(f.ws);
  g.ws.say({ type: 'leaveTable', requestId: 'bye' });
  assert.equal((await g.ws.next(is('gameEnd'))).reason, 'left');
  // The game keeps going for the others: two more hands start
  const next = await table.ws.next((m) => isEvent('handStart')(m) && m.event.handNo >= 3, 30000);
  assert.ok(next.event.seats[2].name === gil.username || next.event.seats.some((x) => x.name === gil.username), 'gil’s seat stays (folded)');
  const gilGame = await t.app.prisma.game.findFirst({ where: { userId: gil.id } });
  assert.equal(gilGame.status, 'QUIT');
  table.ws.close(); f.ws.close();
});

test('waiting room: a cut shows as disconnected, the token brings the player back', async () => {
  const hal = await t.player('hal');
  const ida = await t.player('ida');
  const table = await createTable(hal);
  const i = await joinTable(ida, table.code);
  await table.ws.next((m) => m.type === 'lobby' && m.players.length === 2);
  i.ws.close();
  const away = await table.ws.next((m) => m.type === 'lobby' && m.players.some((p) => !p.connected));
  assert.equal(away.players.find((p) => p.id === ida.id).connected, false);

  const back = await connect(ida);
  back.say({ type: 'reconnect', requestId: 'r', tableId: table.code, playerToken: i.answer.playerToken, lastSeq: i.answer.seq });
  assert.equal((await back.next(is('reconnected'))).tableId, table.code);
  await table.ws.next((m) => m.type === 'lobby' && m.players.every((p) => p.connected));
  table.ws.close(); back.close();
});

test('an invitation carries the table code; sitting down clears it', async () => {
  const jo = await t.player('jo');
  const kim = ben;
  await jo.post('/api/friends/requests', { userId: kim.id });
  await kim.post(`/api/friends/requests/${(await kim.get('/api/friends/requests')).json().incoming[0].id}/accept`);
  const page = await fetch(`http://127.0.0.1:${t.app.server.address().port}/api/friends/live`, { headers: { cookie: `sid=${kim.sid}` } });

  assert.equal((await jo.post('/api/lobby/invitations', { userId: kim.id, tableId: 'ABCDEF' })).statusCode, 409, 'not seated there');
  const table = await createTable(jo);
  const sent = await jo.post('/api/lobby/invitations', { userId: kim.id, tableId: table.code });
  assert.equal(sent.statusCode, 201);
  const [invitation] = (await kim.get('/api/lobby/invitations')).json().invitations;
  assert.equal(invitation.tableId, table.code);

  const k = await joinTable(kim, invitation.tableId);
  assert.equal(k.answer.type, 'joined');
  await new Promise((r) => setTimeout(r, 200));
  assert.equal((await kim.get('/api/lobby/invitations')).json().invitations.length, 0, 'answered by sitting down');
  await page.body.cancel();
  table.ws.close(); k.ws.close();
});
