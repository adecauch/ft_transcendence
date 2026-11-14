import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import { loadConfig } from '../src/config.js';
import { buildApp } from '../src/app.js';

let app;
let url;

function nextMessage(socket, timeoutMs = 10000) {
  if (socket._messages.length) return Promise.resolve(socket._messages.shift());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = socket._waiters.indexOf(waiter);
      if (index >= 0) socket._waiters.splice(index, 1);
      reject(new Error('Timed out waiting for WebSocket message'));
    }, timeoutMs);
    const waiter = { resolve: (message) => { clearTimeout(timer); resolve(message); } };
    socket._waiters.push(waiter);
  });
}

function openSocket(address, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(address, options);
    socket._messages = [];
    socket._waiters = [];
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      const waiter = socket._waiters.shift();
      if (waiter) waiter.resolve(message);
      else socket._messages.push(message);
    });
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

before(async () => {
  const config = loadConfig();
  config.tableReconnectMs = 50;
  app = await buildApp(config, { logger: false });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  url = `ws://127.0.0.1:${address.port}/ws/table`;
});

after(async () => {
  await app.close();
});

test('table WebSocket sends hello and validates the transport', async () => {
  const socket = await openSocket(url);
  const hello = await nextMessage(socket);

  assert.deepEqual(hello, {
    type: 'hello',
    protocol: 'table-websocket',
    version: 1,
    connectionId: hello.connectionId,
  });
  assert.match(hello.connectionId, /^[0-9a-f-]{36}$/);

  socket.send(JSON.stringify({ type: 'action', requestId: 'turn-1', action: { type: 'check' } }));
  assert.deepEqual(await nextMessage(socket), {
    type: 'error',
    code: 'NOT_JOINED',
    message: 'La connexion n’est pas rattachée à une table.',
    requestId: 'turn-1',
    seq: 1,
  });

  socket.send(JSON.stringify({
    type: 'joinTable',
    requestId: 'join-1',
    config: {
      opponents: [{ name: 'Le Baron', level: 'expert' }],
      startingStack: 20,
      blinds: { small: 1, big: 2 },
    },
  }));
  const joined = await nextMessage(socket);
  assert.equal(joined.type, 'joined');
  assert.equal(joined.requestId, 'join-1');
  assert.equal(joined.seat, 0);
  assert.match(joined.playerToken, /^[A-Za-z0-9_-]{32}$/);

  let privateDeal;
  let actionRequest;
  let handEnd;
  for (;;) {
    const message = await nextMessage(socket);
    if (message.type === 'event' && message.event.type === 'deal') privateDeal = message.event;
    if (message.type === 'actionRequest') {
      actionRequest = message;
      break;
    }
  }

  assert.deepEqual(privateDeal.hole[1], null);
  assert.equal(privateDeal.hole[0].length, 2);

  socket.send(JSON.stringify({
    type: 'action',
    requestId: actionRequest.requestId,
    action: { type: 'raise', to: 0 },
  }));
  const rejected = await nextMessage(socket);
  assert.equal(rejected.type, 'actionRejected');
  assert.equal(rejected.code, 'ILLEGAL_ACTION');
  assert.equal(rejected.requestId, actionRequest.requestId);
  assert.equal(rejected.seq, actionRequest.seq + 1);

  socket.send(JSON.stringify({
    type: 'action',
    requestId: actionRequest.requestId,
    action: { type: 'fold' },
  }));
  while (!handEnd) {
    const message = await nextMessage(socket);
    if (message.type === 'event' && message.event.type === 'handEnd') handEnd = message;
  }
  assert.equal(handEnd.event.gameOver, null);

  socket.close();
});

test('an authenticated remote table is recorded by the server', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const registration = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: `table-${suffix}@test.invalid`,
      username: `table_${suffix.slice(0, 12)}`,
      password: 'un-bon-mot-de-passe',
    },
  });
  assert.equal(registration.statusCode, 201);
  const user = registration.json().user;
  const sid = registration.cookies.find((cookie) => cookie.name === 'sid').value;
  const socket = await openSocket(url, { headers: { Cookie: `sid=${sid}` } });

  await nextMessage(socket); // hello
  socket.send(JSON.stringify({
    type: 'joinTable',
    requestId: 'join-recorded',
    config: {
      opponents: [{ name: 'Le Baron', level: 'expert' }],
      startingStack: 20,
      blinds: { small: 1, big: 2 },
    },
  }));
  assert.equal((await nextMessage(socket)).type, 'joined');

  let handEnd = false;
  while (!handEnd) {
    const message = await nextMessage(socket);
    if (message.type === 'actionRequest') {
      socket.send(JSON.stringify({ type: 'action', requestId: message.requestId, action: { type: 'fold' } }));
    }
    if (message.type === 'event' && message.event.type === 'handEnd') handEnd = true;
  }
  socket.close();

  const game = await app.prisma.game.findFirst({
    where: { userId: user.id },
    include: { hands: { include: { actions: true } } },
  });
  assert.ok(game);
  assert.equal(game.hands.length, 1);
  assert.ok(game.hands[0].actions.length >= 3, 'blindes et actions humaines/IA enregistrées');
  assert.equal(game.hands[0].heroHole.length, 2);

  await app.prisma.user.delete({ where: { id: user.id } });
});

test('a disconnected table can be resumed with its private token', async () => {
  const first = await openSocket(url);
  const hello = await nextMessage(first);
  assert.equal(hello.type, 'hello');
  first.send(JSON.stringify({
    type: 'joinTable',
    requestId: 'join-reconnect',
    config: { opponents: [{ name: 'Le Baron', level: 'expert' }], startingStack: 20, blinds: { small: 1, big: 2 } },
  }));
  const joined = await nextMessage(first);
  assert.equal(joined.type, 'joined');
  first.close();

  const second = await openSocket(url);
  await nextMessage(second); // hello
  second.send(JSON.stringify({
    type: 'reconnect',
    requestId: 'resume-1',
    tableId: joined.tableId,
    playerToken: joined.playerToken,
    lastSeq: joined.seq,
  }));

  let reconnected;
  let actionRequest;
  while (!reconnected || !actionRequest) {
    const message = await nextMessage(second);
    if (message.type === 'reconnected') reconnected = message;
    if (message.type === 'actionRequest') actionRequest = message;
  }
  assert.equal(reconnected.tableId, joined.tableId);
  assert.equal(reconnected.playerToken, joined.playerToken);
  second.send(JSON.stringify({ type: 'action', requestId: actionRequest.requestId, action: { type: 'fold' } }));

  // The action must reach the resumed table, not the socket's throwaway session
  let played;
  while (!played) {
    const message = await nextMessage(second);
    assert.notEqual(message.type, 'error', message.message);
    if (message.type === 'event' && message.event.type === 'action' && message.event.seat === 0) played = message.event;
  }
  assert.equal(played.action.type, 'fold');

  // A second network cut must start the grace period of the resumed table
  second.close();
  await new Promise((resolve) => setTimeout(resolve, app.config.tableReconnectMs + 200));
  assert.equal(app.tables.get(joined.tableId), null, 'table closed after the grace period');
});

test('reconnection rejects a token belonging to another table', async () => {
  const first = await openSocket(url);
  await nextMessage(first);
  first.send(JSON.stringify({
    type: 'joinTable',
    requestId: 'join-token',
    config: { opponents: [{ name: 'Le Baron', level: 'expert' }], startingStack: 20, blinds: { small: 1, big: 2 } },
  }));
  const joined = await nextMessage(first);
  first.close();

  const second = await openSocket(url);
  await nextMessage(second);
  second.send(JSON.stringify({
    type: 'reconnect',
    requestId: 'resume-invalid',
    tableId: joined.tableId,
    playerToken: `${joined.playerToken.slice(0, -1)}x`,
    lastSeq: joined.seq,
  }));
  const error = await nextMessage(second);
  assert.equal(error.type, 'error');
  assert.equal(error.code, 'PLAYER_NOT_FOUND');
  second.close();
});

test('WebSocket rejects a foreign Origin and oversized messages', async () => {
  app.config.wsAllowedOrigins = ['https://allowed.example'];
  const foreign = await openSocket(url, { headers: { Origin: 'https://evil.example' } });
  const foreignClosed = new Promise((resolve) => foreign.once('close', (code) => resolve(code)));
  assert.equal(await foreignClosed, 1008);

  app.config.wsAllowedOrigins = [];
  app.config.wsMaxMessageBytes = 32;
  const socket = await openSocket(url);
  await nextMessage(socket);
  socket.send(JSON.stringify({ type: 'joinTable', config: { opponents: [], padding: 'x'.repeat(100) } }));
  const error = await nextMessage(socket);
  assert.equal(error.code, 'BAD_MESSAGE');
  assert.equal(await new Promise((resolve) => socket.once('close', (code) => resolve(code))), 1009);
  app.config.wsMaxMessageBytes = 16_384;
});

test('the turn clock starts once shown and freezes during a pause', async () => {
  const config = loadConfig();
  config.tableTiming = { actionMs: 300, displayMs: 600, maxPauseMs: 1500, minResumeMs: 300 };
  const timed = await buildApp(config, { logger: false });
  await timed.listen({ port: 0, host: '127.0.0.1' });
  const timedUrl = `ws://127.0.0.1:${timed.server.address().port}/ws/table`;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  try {
    const socket = await openSocket(timedUrl);
    await nextMessage(socket); // hello
    socket.send(JSON.stringify({
      type: 'joinTable',
      requestId: 'join-clock',
      config: { opponents: [{ name: 'Le Baron', level: 'expert' }], startingStack: 400, blinds: { small: 1, big: 2 } },
    }));
    let request;
    while (!request) {
      const message = await nextMessage(socket);
      if (message.type === 'actionRequest') request = message;
    }

    // Shown → the clock runs; pause → it stops, well past the 300 ms
    socket.send(JSON.stringify({ type: 'actionShown', requestId: request.requestId }));
    const started = await nextMessage(socket);
    assert.equal(started.type, 'actionTimer');
    assert.equal(started.running, true);
    socket.send(JSON.stringify({ type: 'pause' }));
    const frozen = await nextMessage(socket);
    assert.equal(frozen.running, false);
    await wait(900);
    assert.equal(socket._messages.length, 0, 'nothing played during the pause');

    // Resume → at least minResumeMs left, then the server plays for the player
    socket.send(JSON.stringify({ type: 'resume' }));
    const resumed = await nextMessage(socket);
    assert.equal(resumed.running, true);
    assert.ok(resumed.remainingMs >= 250);
    let expired;
    let auto;
    while (!auto) {
      const message = await nextMessage(socket, 3000);
      if (message.type === 'actionExpired') expired = message;
      if (message.type === 'event' && message.event.type === 'action' && message.event.seat === 0) auto = message.event;
    }
    assert.ok(['fold', 'check'].includes(auto.action.type));
    // Announced before the move, so the browser can end the turn on screen
    assert.equal(expired?.requestId, request.requestId);
    assert.equal(expired.action.type, auto.action.type);

    // A pause longer than maxPauseMs closes the table
    socket.send(JSON.stringify({ type: 'pause' }));
    let end;
    while (!end) {
      const message = await nextMessage(socket, 4000);
      if (message.type === 'gameEnd') end = message;
    }
    assert.equal(end.reason, 'idle');
    socket.close();
  } finally {
    await timed.close();
  }
});

test('a message sent the instant the socket opens is not lost (slow session lookup)', async () => {
  const sessions = app.sessions;
  const userFor = sessions.userFor.bind(sessions);
  sessions.userFor = async (sid) => { await new Promise((r) => setTimeout(r, 300)); return userFor(sid); };
  try {
    const socket = await openSocket(url);
    // Sent right away, while the server still waits for the (slowed) lookup
    socket.send(JSON.stringify({ type: 'joinTable', requestId: 'early', config: { opponents: [{ name: 'Le Baron', level: 'expert' }], startingStack: 40, blinds: { small: 1, big: 2 } } }));
    let joined;
    while (!joined) {
      const message = await nextMessage(socket, 5000);
      if (message.type === 'joined') joined = message;
    }
    assert.equal(joined.requestId, 'early');
    socket.close();
  } finally {
    sessions.userFor = userFor;
  }
});
