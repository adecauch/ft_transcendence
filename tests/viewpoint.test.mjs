/**
 * viewpoint.test.mjs — A shared table seen from each seat (shared/poker/viewpoint.js)
 *
 * The proof that matters: a whole game played at 3 seats, where every event is
 * turned for each player and fed to that player's own HandRecorder, gives each
 * player exactly the hero numbers of their real seat.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PokerGame } from '../src/shared/poker/PokerGame.js';
import { legalActions, toCall } from '../src/shared/poker/betting.js';
import { HandRecorder } from '../src/shared/stats/handRecord.js';
import { rotateSeat, rotateArray, rotateEvent, viewEvent, rotateRequest, gameOverFor } from '../src/shared/poker/viewpoint.js';

const randomAgent = {
  decide({ turn }) {
    const legal = legalActions(turn);
    const r = Math.random();
    if (legal.raise && r < 0.25) return { type: 'raise', to: Math.random() < 0.3 ? legal.raise.max : legal.raise.min };
    if (!legal.check && r < 0.35) return { type: 'fold' };
    return legal.check ? { type: 'check' } : { type: 'call', amount: toCall(turn) };
  },
};

test('seats and arrays turn so that `me` is seat 0', () => {
  assert.deepEqual([0, 1, 2, 3].map((s) => rotateSeat(s, 2, 4)), [2, 3, 0, 1]);
  assert.equal(rotateSeat(null, 2, 4), null);
  assert.equal(rotateSeat(-1, 2, 4), -1);
  assert.deepEqual(rotateArray(['a', 'b', 'c', 'd'], 2), ['c', 'd', 'a', 'b']);
  assert.equal(gameOverFor([0, 10, 5]), 'lost');
  assert.equal(gameOverFor([15, 0, 0]), 'won');
  assert.equal(gameOverFor([5, 0, 10]), null);
});

test('a shared game ends when one seat has every chip, not when seat 0 busts', async () => {
  const players = [0, 1, 2].map((i) => ({ name: `P${i}`, isHuman: true, agent: randomAgent }));
  const game = new PokerGame({ players, startingStack: 60, blinds: { small: 5, big: 10 }, endWhen: 'lastStanding' });
  let hands = 0;
  while (!game.gameOver && hands < 2000) { await game.playHand(); hands++; }
  assert.equal(game.gameOver, 'over');
  assert.equal(game.stacks.filter((s) => s > 0).length, 1);
  assert.equal(game.stacks.reduce((a, b) => a + b, 0), 180, 'no chip lost');
});

test('each player’s turned events give their own seat’s hero numbers', async () => {
  for (let run = 0; run < 20; run++) {
    const n = 3;
    const players = [0, 1, 2].map((i) => ({ name: `P${i}`, isHuman: true, agent: randomAgent }));
    const truth = new HandRecorder();                 // the table as it is
    const views = [0, 1, 2].map(() => new HandRecorder()); // each player's turned table
    const game = new PokerGame({
      players, startingStack: 200, blinds: { small: 1, big: 2 }, endWhen: 'lastStanding',
      onEvent: (e) => { truth.event(e); views.forEach((r, me) => r.event(rotateEvent(e, me, n))); },
    });
    await game.playHand();
    for (let me = 0; me < n; me++) {
      const mine = views[me].record;
      const real = truth.record.players[me];
      assert.equal(mine.hero.net, real.stackEnd - real.stackStart, `seat ${me} net`);
      assert.deepEqual(mine.hero.hole, real.hole, `seat ${me} hole`);
      assert.equal(mine.players[0].name, `P${me}`, 'I am seat 0');
      assert.equal(mine.players[1].name, `P${(me + 1) % n}`, 'next seat clockwise is 1');
      assert.equal(mine.button, rotateSeat(truth.record.button, me, n));
      assert.equal(mine.pot, truth.record.pot);
    }
  }
});

test('a player never sees the others’ cards at the deal; isHuman means "me"', () => {
  const deal = { type: 'deal', hole: [['AS', 'KD'], ['2C', '3C'], ['QH', 'QS']] };
  assert.deepEqual(viewEvent(deal, 1, 3).hole, [['2C', '3C'], null, null]);
  assert.deepEqual(rotateEvent(deal, 1, 3).hole, [['2C', '3C'], ['QH', 'QS'], ['AS', 'KD']], 'the recorder keeps everything');
  const start = rotateEvent({ type: 'handStart', handNo: 1, button: 0, sb: 1, bb: 2,
    seats: [0, 1, 2].map((index) => ({ index, name: `P${index}`, isHuman: index !== 2, stack: 10, out: false })) }, 1, 3);
  assert.deepEqual(start.seats.map((s) => [s.name, s.index, s.isHuman, s.remote]), [['P1', 0, true, false], ['P2', 1, false, false], ['P0', 2, false, true]]);
  assert.deepEqual([start.button, start.sb, start.bb], [2, 0, 1]);
  const end = rotateEvent({ type: 'handEnd', stacks: [30, 0, 0], result: { type: 'uncontested', seat: 0, amount: 4, lastFold: 2 }, gameOver: 'over' }, 1, 3);
  assert.deepEqual(end.stacks, [0, 0, 30]);
  assert.equal(end.gameOver, 'lost', 'computed for me');
  assert.deepEqual([end.result.seat, end.result.lastFold], [2, 1]);
});

test('a decision request turns its seat and its history', () => {
  const req = { seat: 2, round: 0, hole: ['AS', 'KD'], board: [], history: [[{ seat: 0, type: 'call' }, { seat: 1, type: 'raise', to: 6 }], [], [], []], turn: {} };
  const turned = rotateRequest(req, 2, 3);
  assert.equal(turned.seat, 0);
  assert.deepEqual(turned.history[0].map((a) => a.seat), [1, 2]);
  assert.equal(req.history[0][0].seat, 0, 'the original is untouched');
});
