import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RemoteGame } from '../src/front/net/RemoteGame.js';

class FakeSocket {
  static OPEN = 1;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    queueMicrotask(() => {
      this.readyState = FakeSocket.OPEN;
      this.onopen?.();
    });
  }

  send(raw) {
    const message = JSON.parse(raw);
    this.sent.push(message);
    if (message.type === 'joinTable') {
      queueMicrotask(() => {
        this.emit({ type: 'hello', protocol: 'table-websocket', version: 1, connectionId: 'connection-1' });
        this.emit({ type: 'joined', seq: 1, requestId: message.requestId, tableId: 'table-1', seat: 0 });
        this.emit({ type: 'event', seq: 2, event: { type: 'handStart', handNo: 1 } });
        this.emit({ type: 'event', seq: 3, event: { type: 'deal', hole: [['AS', 'KD'], null] } });
        this.emit({ type: 'actionRequest', seq: 4, requestId: 'turn-1', seat: 0, round: 0, hole: ['AS', 'KD'], board: [], turn: { stack: 18, playerBet: 0, currentBet: 2, lastRaise: 2, bigBlind: 2, pot: 3, preflop: true } });
      });
    }
    if (message.type === 'action') {
      queueMicrotask(() => {
        this.emit({ type: 'event', seq: 5, event: { type: 'action', seat: 0, action: message.action } });
        this.emit({ type: 'event', seq: 6, event: { type: 'handEnd', result: { type: 'uncontested' }, stacks: [18, 22], gameOver: null } });
      });
    }
  }

  close() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }

  emit(message) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

test('RemoteGame joins, serializes events and answers the human turn', async () => {
  const events = [];
  const requests = [];
  const game = new RemoteGame({
    url: 'wss://example.test/ws/table',
    WebSocketClass: FakeSocket,
    onEvent: (event) => events.push(event),
    onActionRequest: (request) => {
      requests.push(request);
      return { type: 'fold' };
    },
  });

  const joined = await game.connect({ opponents: [{ name: 'Le Baron', level: 'expert' }] });
  const result = await game.playHand();

  assert.equal(joined.tableId, 'table-1');
  assert.equal(game.tableId, 'table-1');
  assert.deepEqual(events.map((event) => event.type), ['handStart', 'deal', 'action', 'handEnd']);
  assert.equal(requests[0].requestId, 'turn-1');
  assert.deepEqual(game.socket.sent.at(-1), { type: 'action', requestId: 'turn-1', action: { type: 'fold' } });
  assert.equal(result.gameOver, null);
  assert.equal(result.stacks[0], 18);

  game.stop();
  assert.equal(game.socket, null);
});

test('RemoteGame starts the turn clock when shown, relays the timer and the pause', async () => {
  const timers = [];
  let sentBeforeAsk;
  const game = new RemoteGame({
    WebSocketClass: FakeSocket,
    onActionRequest: () => {
      sentBeforeAsk = game.socket.sent.map((message) => message.type);
      game.socket.emit({ type: 'actionTimer', requestId: 'turn-1', remainingMs: 30000, running: true });
      game.pause();
      game.resume();
      return { type: 'fold' };
    },
    onTimer: (timer) => timers.push(timer),
  });

  await game.connect({});
  await game.playHand();

  assert.deepEqual(sentBeforeAsk, ['joinTable', 'actionShown'], 'the clock starts when the turn is on screen');
  assert.equal(game.socket.sent[1].requestId, 'turn-1');
  assert.deepEqual(timers.map((t) => [t.remainingMs, t.running]), [[30000, true]]);
  assert.deepEqual(game.socket.sent.slice(2, 4).map((m) => m.type), ['pause', 'resume']);
  game.stop();
});

test('RemoteGame ends the turn on screen when the server plays for the player at zero', async () => {
  const events = [];
  let expired;
  const game = new RemoteGame({
    WebSocketClass: FakeSocket,
    onEvent: (event) => events.push(event),
    // Never clicked: only the expiry can end this turn
    onActionRequest: () => new Promise((resolve) => {
      game.onActionExpired = (message) => { expired = message; resolve(null); };
      queueMicrotask(() => {
        game.socket.emit({ type: 'actionExpired', seq: 5, requestId: 'turn-1', action: { type: 'fold' } });
        game.socket.emit({ type: 'event', seq: 6, event: { type: 'action', seat: 0, action: { type: 'fold' } } });
        game.socket.emit({ type: 'event', seq: 7, event: { type: 'handEnd', result: { type: 'uncontested' }, stacks: [18, 22], gameOver: null } });
      });
    }),
  });

  await game.connect({});
  const result = await game.playHand();

  assert.equal(expired.requestId, 'turn-1');
  assert.deepEqual(events.map((event) => event.type), ['handStart', 'deal', 'action', 'handEnd']);
  assert.ok(!game.socket.sent.some((message) => message.type === 'action'), 'nothing sent for an expired turn');
  assert.equal(result.stacks[0], 18);
  game.stop();
});

test('RemoteGame skips a turn that expired before it was shown', async () => {
  class LateSocket extends FakeSocket {
    send(raw) {
      const message = JSON.parse(raw);
      this.sent.push(message);
      if (message.type !== 'joinTable') return;
      queueMicrotask(() => {
        this.emit({ type: 'hello', protocol: 'table-websocket', version: 1, connectionId: 'connection-1' });
        this.emit({ type: 'joined', seq: 1, requestId: message.requestId, tableId: 'table-1', seat: 0 });
        this.emit({ type: 'event', seq: 2, event: { type: 'handStart', handNo: 1 } });
        this.emit({ type: 'actionRequest', seq: 3, requestId: 'turn-1', seat: 0, round: 0, hole: ['AS', 'KD'], board: [], turn: { stack: 18, playerBet: 0, currentBet: 2, lastRaise: 2, bigBlind: 2, pot: 3, preflop: true } });
        this.emit({ type: 'actionExpired', seq: 4, requestId: 'turn-1', action: { type: 'fold' } });
        this.emit({ type: 'event', seq: 5, event: { type: 'handEnd', result: { type: 'uncontested' }, stacks: [18, 22], gameOver: null } });
      });
    }
  }
  let asked = 0;
  // handStart is still being animated when the request and its expiry arrive
  const game = new RemoteGame({
    WebSocketClass: LateSocket,
    onEvent: () => new Promise((resolve) => setTimeout(resolve, 10)),
    onActionRequest: () => { asked += 1; return { type: 'fold' }; },
  });

  await game.connect({});
  await game.playHand();

  assert.equal(asked, 0, 'an expired turn is never shown');
  assert.ok(!game.socket.sent.some((message) => message.type === 'actionShown' || message.type === 'action'));
  game.stop();
});

test('RemoteGame rejects an incompatible protocol', async () => {
  class BadSocket extends FakeSocket {
    send(raw) {
      const message = JSON.parse(raw);
      if (message.type === 'joinTable') queueMicrotask(() => this.emit({ type: 'hello', protocol: 'old', version: 1 }));
    }
  }

  const game = new RemoteGame({ WebSocketClass: BadSocket });
  await assert.rejects(game.connect({}), { code: 'INCOMPATIBLE_PROTOCOL' });
});

test('RemoteGame reconnects with the last sequence and token', async () => {
  class ReconnectSocket extends FakeSocket {
    static instances = 0;

    constructor(url) {
      super(url);
      this.number = ++ReconnectSocket.instances;
    }

    send(raw) {
      const message = JSON.parse(raw);
      this.sent.push(message);
      if (message.type === 'joinTable') {
        queueMicrotask(() => {
          this.emit({ type: 'hello', protocol: 'table-websocket', version: 1, connectionId: 'connection-1' });
          this.emit({ type: 'joined', seq: 1, tableId: 'table-1', seat: 0, playerToken: 'a'.repeat(32) });
          this.emit({ type: 'event', seq: 2, event: { type: 'handStart', handNo: 1 } });
          this.close();
        });
      }
      if (message.type === 'reconnect') {
        assert.equal(message.tableId, 'table-1');
        assert.equal(message.playerToken, 'a'.repeat(32));
        assert.equal(message.lastSeq, 2);
        queueMicrotask(() => {
          this.emit({ type: 'hello', protocol: 'table-websocket', version: 1, connectionId: 'connection-2' });
          this.emit({ type: 'reconnected', seq: 3, tableId: 'table-1', seat: 0, playerToken: 'a'.repeat(32) });
          this.emit({ type: 'event', seq: 4, event: { type: 'handEnd', result: {}, stacks: [20, 20], gameOver: null } });
        });
      }
    }
  }

  const game = new RemoteGame({ WebSocketClass: ReconnectSocket });
  await game.connect({});
  const result = await game.playHand();
  assert.equal(result.gameOver, null);
  game.stop();
});

test('RemoteGame opens or joins a shared table, relays its waiting room, and starts it', async () => {
  const sent = [];
  class SharedSocket extends FakeSocket {
    send(raw) {
      const message = JSON.parse(raw);
      sent.push(message);
      if (message.type === 'createTable' || message.type === 'joinShared') {
        queueMicrotask(() => {
          this.emit({ type: 'hello', protocol: 'table-websocket', version: 1, connectionId: 'c' });
          this.emit({ type: 'joined', seq: 1, tableId: 'K7QX2M', seat: 0, playerToken: 'a'.repeat(32), shared: true });
          this.emit({ type: 'lobby', seq: 2, tableId: 'K7QX2M', status: 'waiting', you: 7, host: { id: 7 }, players: [], bots: 1, config: { blinds: { small: 1, big: 2 } } });
        });
      }
    }
  }
  const lobbies = [];
  const host = new RemoteGame({ WebSocketClass: SharedSocket, onLobby: (s) => lobbies.push(s) });
  await host.connect({ shared: { create: true, bots: 1 }, startingStack: 500, blinds: { small: 5, big: 10 } });
  assert.deepEqual(sent[0].config, { startingStack: 500, blinds: { small: 5, big: 10 }, bots: 1 });
  assert.equal(sent[0].type, 'createTable');
  assert.equal(lobbies[0].tableId, 'K7QX2M');
  host.startTable();
  assert.equal(sent.at(-1).type, 'startTable');
  host.stop();

  const guest = new RemoteGame({ WebSocketClass: SharedSocket });
  await guest.connect({ shared: { join: 'K7QX2M' } });
  assert.deepEqual([sent.at(-1).type, sent.at(-1).tableId], ['joinShared', 'K7QX2M']);
  guest.stop();
});
