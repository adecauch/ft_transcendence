/**
 * Games, hands, stats, achievements and leaderboard, against the real database
 * (PostgreSQL running: `make postgres-up`). A game is played by random
 * agents with the real engine and each hand's log is posted like the browser
 * does; the server replays and stores it.
 *
 *   npm test
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { testApp, playGame, CONFIG } from './helpers.mjs';

let ctx;
let player;
let app;
before(async () => { ctx = await testApp(); ({ app, player } = ctx); });
after(() => ctx.close());

test('a whole game is saved hand by hand, then shows in history, stats and leaderboard', async () => {
  const me = await player('gina');
  const start = await me.post('/api/games', CONFIG);
  assert.equal(start.statusCode, 201);
  const id = start.json().game.id;

  const { logs, stacks, over } = await playGame();
  const unlocked = new Set();
  let last;
  for (const log of logs) {
    last = await me.post(`/api/games/${id}/hands`, log);
    assert.equal(last.statusCode, 201, last.body);
    last.json().achievements.forEach((a) => unlocked.add(a));
  }
  // The server's own replay ends where the local game ended
  assert.equal(last.json().game.stack, stacks[0]);
  if (over) assert.equal(last.json().game.status, over === 'won' ? 'WON' : 'LOST');
  assert.ok(unlocked.has('first_game'));

  // History: the game, then its hands with every action (blinds included)
  const list = (await me.get('/api/games')).json();
  assert.equal(list.games[0].id, id);
  assert.equal(list.games[0].handsPlayed, logs.length);
  const detail = (await me.get(`/api/games/${id}`)).json();
  assert.equal(detail.hands.length, logs.length);
  const first = detail.hands[0];
  assert.deepEqual(first.actions.slice(0, 2).map((a) => a.type), ['blind', 'blind']);
  assert.equal(first.actions.length, logs[0].actions.length + 2);
  // The AI's cards only when it showed them
  for (const h of detail.hands) {
    const ai = h.players[1];
    assert.equal(ai.hole !== null, ai.showed, `hand ${h.number}`);
    assert.equal(h.players[0].hole.length, 2);
  }

  // Stats
  const stats = (await me.get('/api/stats/me')).json();
  assert.equal(stats.totals.hands, logs.length);
  assert.equal(stats.totals.games, 1);
  assert.equal(stats.totals.net, stacks[0] - CONFIG.startingStack);
  assert.ok(stats.achievements.some((a) => a.id === 'first_game'));

  // The range really played: every hand with a preflop decision is counted
  const range = (await me.get('/api/stats/range')).json();
  assert.equal(range.hands, logs.length);
  const decided = Object.values(range.situations).reduce((s, x) => s + x.total, 0);
  assert.ok(decided > 0 && decided <= logs.length);
  assert.ok(Array.isArray(range.mistakes) && Array.isArray(range.losses));

  // Leaderboard: only finished games count
  if (over) {
    const board = (await me.get('/api/leaderboard')).json();
    assert.equal(board.me.games, 1);
    assert.equal(board.me.isMe, true);
  }
});

test('the server refuses illegal, repeated or foreign hands', async () => {
  const me = await player('hugo');
  const other = await player('iris');
  const id = (await me.post('/api/games', CONFIG)).json().game.id;
  const { logs } = await playGame(3);

  const cheat = structuredClone(logs[0]);
  cheat.board = cheat.board.length ? [cheat.hole[0][0], ...cheat.board.slice(1)] : [];
  cheat.actions.push({ seat: 0, street: 0, type: 'raise', to: 1 });
  const refused = await me.post(`/api/games/${id}/hands`, cheat);
  assert.equal(refused.statusCode, 422);
  assert.match(refused.json().error, /^Main refusée/);

  assert.equal((await me.post(`/api/games/${id}/hands`, logs[0])).statusCode, 201);
  assert.equal((await me.post(`/api/games/${id}/hands`, logs[0])).statusCode, 409, 'same hand again');
  assert.equal((await other.post(`/api/games/${id}/hands`, logs[1] ?? logs[0])).statusCode, 404, "someone else's game");
  assert.equal((await other.get(`/api/games/${id}`)).statusCode, 404);
});

test('quitting, and a new game closes the one left open', async () => {
  const me = await player('jade');
  const a = (await me.post('/api/games', CONFIG)).json().game.id;
  const b = (await me.post('/api/games', CONFIG)).json().game.id;
  assert.equal((await me.post(`/api/games/${b}/quit`)).statusCode, 204);
  const games = (await me.get('/api/games')).json().games;
  assert.deepEqual(games.map((g) => [g.id, g.status]), [[b, 'QUIT'], [a, 'QUIT']]);
});

test('guests: no recording, but the leaderboard is public', async () => {
  const guest = (method, url, payload) => app.inject({ method, url, payload });
  assert.equal((await guest('POST', '/api/games', CONFIG)).statusCode, 401);
  assert.equal((await guest('GET', '/api/stats/me')).statusCode, 401);
  assert.equal((await guest('GET', '/api/stats/range')).statusCode, 401);
  const board = await guest('GET', '/api/leaderboard');
  assert.equal(board.statusCode, 200);
  assert.equal(board.json().me, null);
});
