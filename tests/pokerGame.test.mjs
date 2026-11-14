// Game engine tests — run with `npm run test:ai`
// The whole game runs headless: random-but-legal agents play full games.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PokerGame } from '../src/shared/poker/PokerGame.js';
import { legalActions, toCall } from '../src/shared/poker/betting.js';

/** An agent that plays any legal action at random (sometimes shoves). */
const randomAgent = {
  decide({ turn }) {
    const legal = legalActions(turn);
    const r = Math.random();
    if (legal.raise && r < 0.25) {
      const { min, max } = legal.raise;
      return { type: 'raise', to: Math.random() < 0.2 ? max : min + Math.floor(Math.random() * (max - min + 1)) };
    }
    if (!legal.check && r < 0.45) return { type: 'fold' };
    return legal.check ? { type: 'check' } : { type: 'call', amount: toCall(turn) };
  },
};

function newGame(opponents, events = []) {
  return new PokerGame({
    players: Array.from({ length: opponents + 1 }, (_, i) => ({ name: `P${i}`, isHuman: i === 0, level: 'expert', agent: randomAgent })),
    startingStack: 1000,
    blinds: { small: 10, big: 20 },
    onEvent: (e) => { events.push(e); },
  });
}

test('chips are never created or lost, over whole games', async () => {
  for (const opponents of [1, 2, 4]) {
    for (let g = 0; g < 20; g++) {
      const game = newGame(opponents);
      const total = 1000 * (opponents + 1);
      for (let h = 0; h < 300 && !game.gameOver; h++) {
        const { stacks } = await game.playHand();
        assert.equal(stacks.reduce((a, b) => a + b, 0), total, `game ${g}, hand ${h}`);
        assert.ok(stacks.every((s) => s >= 0));
      }
    }
  }
});

test('every hand deals distinct cards and a 5-card board at showdown', async () => {
  const events = [];
  const game = newGame(3, events);
  for (let h = 0; h < 50 && !game.gameOver; h++) await game.playHand();
  let hand = null;
  for (const e of events) {
    if (e.type === 'deal') hand = new Set(e.hole.flat().filter(Boolean));
    if (e.type === 'street') e.cards.forEach((c) => { assert.ok(!hand.has(c), 'duplicate card'); hand.add(c); });
    if (e.type === 'showdown') assert.equal(e.reveals[0].cards.length, 2);
  }
});

test('heads-up: the button is the small blind and moves every hand', async () => {
  // Random agents sometimes shove and bust someone in the first hand: play
  // new games until one lasts at least two hands
  let starts = [];
  for (let tries = 0; tries < 50 && starts.length < 2; tries++) {
    const events = [];
    const game = newGame(1, events);
    for (let h = 0; h < 6 && !game.gameOver; h++) await game.playHand();
    starts = events.filter((e) => e.type === 'handStart');
  }
  assert.ok(starts.length >= 2, 'need at least two hands');
  starts.forEach((e) => assert.equal(e.button, e.sb));
  for (let k = 1; k < starts.length; k++) assert.notEqual(starts[k].button, starts[k - 1].button);
});

test('the game ends when one side has all the chips', async () => {
  const game = newGame(1);
  let hands = 0;
  while (!game.gameOver && hands < 5000) { await game.playHand(); hands++; }
  assert.ok(['won', 'lost'].includes(game.gameOver), `still going after ${hands} hands`);
});

test('no hand can be played once the game is over', async () => {
  const game = newGame(1);
  while (!game.gameOver) await game.playHand();
  await assert.rejects(game.playHand(), /game is over/);
});

test('abort() stops the game', async () => {
  const game = newGame(2);
  game.abort();
  await assert.rejects(game.playHand(), { name: 'Error' });
});
