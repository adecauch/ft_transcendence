import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SharedTable } from '../src/table/shared.js';
import { TableRegistry } from '../src/table/registry.js';

function socket() {
  return { readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); }, close() { this.readyState = 3; } };
}

function fixture(options = {}) {
  const registry = new TableRegistry({ reconnectMs: 1000 });
  const table = new SharedTable({ host: { id: 1 }, config: {}, registry,
    solver: { abstraction: async () => ({ abstraction: {} }), strategy: async () => null },
    log: { error() {}, warn() {} }, ...options });
  registry.add(table);
  table.join({ id: 1 }, socket(), 'host');
  table.join({ id: 2 }, socket(), 'guest');
  return { table, registry };
}

test('shared reconnect validates the authenticated player channel sequence', () => {
  const { table, registry } = fixture();
  try {
    const seat = table.seats[1];
    // The host has a higher sequence: it must not be used to validate the guest.
    table.seats[0].channel.send({ type: 'lobby' });
    const args = { tableId: table.tableId, playerToken: seat.channel.playerToken, user: seat.user, socket: socket() };
    assert.equal(registry.reconnect({ ...args, lastSeq: seat.channel.sequence + 1 }).code, 'BAD_MESSAGE');
    table.detach(seat.channel.socket);
    assert.equal(registry.reconnect({ ...args, lastSeq: seat.channel.sequence }).ok, true);
    table.status = 'playing';
    table._leave(seat);
    assert.equal(registry.reconnect({ ...args, lastSeq: seat.channel.sequence }).code, 'PLAYER_NOT_FOUND');
  } finally { table.close(); }
});

test('one account cannot join another table until it explicitly leaves', () => {
  const { table, registry } = fixture();
  const other = new SharedTable({ host: { id: 3 }, config: {}, registry, log: console });
  try {
    table.detach(table.seats[1].channel.socket);
    assert.equal(other.join({ id: 2 }, socket(), 'join').code, 'ALREADY_IN_TABLE');
    table._leave(table.seats[1]);
    assert.equal(other.join({ id: 2 }, socket(), 'join').ok, true);
  } finally { table.close(); other.close(); }
});

test('solver startup failure is contained and releases the table', async () => {
  const { table, registry } = fixture({ solver: { abstraction: async () => { throw new Error('unavailable'); } } });
  const hostSocket = table.seats[0].channel.socket;
  await table.receive({ type: 'startTable' }, { socket: hostSocket });
  assert.equal(table.closed, true);
  assert.equal(registry.get(table.tableId), null);
  for (const seat of table.seats) assert.ok(seat.channel.socket.messages.some((m) => m.type === 'gameEnd' && m.reason === 'serverError'));
});

test('partial database startup waits for late writes and closes the created games', async () => {
  const games = [];
  const prisma = {
    game: {
      updateMany: async ({ where, data }) => { for (const game of games) if (game.id === where.id) Object.assign(game, data); },
      create: async ({ data }) => {
        if (data.userId === 1) throw new Error('database failure');
        await new Promise((resolve) => setTimeout(resolve, 10));
        const game = { ...data, id: 20, status: 'PLAYING' };
        games.push(game);
        return game;
      },
    },
    $transaction: (operations) => Promise.all(operations),
  };
  const { table, registry } = fixture({ prisma });
  await table.receive({ type: 'startTable' }, { socket: table.seats[0].channel.socket });
  assert.equal(table.closed, true);
  assert.equal(registry.get(table.tableId), null);
  assert.equal(games.length, 1);
  assert.equal(games[0].status, 'QUIT');
});
