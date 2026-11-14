// Hand logs and server-side replay — run with `npm run test:ai`
// Whole games are played by random-but-legal agents; every hand is logged
// (HandLogger, like the browser) and replayed (replayHand, like the server):
// the replay must end on exactly the same stacks. Tampered logs must be refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PokerGame } from '../src/shared/poker/PokerGame.js';
import { legalActions, toCall } from '../src/shared/poker/betting.js';
import { HandLogger } from '../src/shared/stats/handLog.js';
import { replayHand, ReplayError } from '../src/shared/stats/replay.js';
import { ACHIEVEMENTS, newlyUnlocked } from '../src/shared/stats/achievements.js';

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

const BLINDS = { small: 10, big: 20 };
const playersFor = (opponents) => Array.from({ length: opponents + 1 }, (_, i) => ({ name: `P${i}`, isHuman: i === 0, level: 'expert' }));

/** Play a game, collecting { state before, log, stacks after } per hand. */
async function playLogged(opponents, maxHands = 200) {
  const players = playersFor(opponents);
  const logger = new HandLogger();
  const logs = [];
  const game = new PokerGame({
    players: players.map((p) => ({ ...p, agent: randomAgent })),
    startingStack: 1000,
    blinds: BLINDS,
    onEvent: (e) => { const log = logger.event(e); if (log) logs.push(log); },
  });
  const hands = [];
  for (let h = 0; h < maxHands && !game.gameOver; h++) {
    const before = { players, blinds: BLINDS, stacks: [...game.stacks], button: game.button, handNo: game.handNo };
    await game.playHand();
    hands.push({ before, log: logs.at(-1), after: [...game.stacks], gameOver: game.gameOver });
  }
  return hands;
}

test('every logged hand replays to the same stacks (2 to 5 players)', async () => {
  for (const opponents of [1, 2, 4]) {
    for (let g = 0; g < 10; g++) {
      for (const { before, log, after, gameOver } of await playLogged(opponents)) {
        const out = await replayHand(before, log);
        assert.deepEqual(out.stacks, after, `hand ${log.handNo}`);
        assert.equal(out.gameOver, gameOver);
        const { record } = out;
        assert.equal(record.players.reduce((s, p) => s + p.collected, 0), record.pot, 'the whole pot is paid out');
        assert.equal(record.hero.net, after[0] - before.stacks[0]);
      }
    }
  }
});

test('a replayed hand carries on from the server state (button, hand number)', async () => {
  const [first, second] = await playLogged(1, 2);
  if (!second) return; // someone busted in one hand: nothing to chain
  const a = await replayHand(first.before, first.log);
  const b = await replayHand({ ...first.before, stacks: a.stacks, button: a.button, handNo: a.handNo }, second.log);
  assert.deepEqual(b.stacks, second.after);
});

test('tampered logs are refused', async () => {
  // A hand with at least one raise and a flop, to have something to break
  let hand;
  for (let tries = 0; tries < 200 && !hand; tries++) {
    hand = (await playLogged(1, 30)).find(({ log }) => log.board.length >= 3 && log.actions.some((a) => a.type === 'raise'));
  }
  assert.ok(hand, 'found a hand to tamper with');
  const { before, log } = hand;
  const edit = (fn) => { const copy = structuredClone(log); fn(copy); return copy; };
  const refused = (l) => assert.rejects(replayHand(before, l), ReplayError);

  await refused(edit((l) => { l.handNo += 1; }));                                  // hand skipped
  await refused(edit((l) => { l.board[0] = l.hole[0][0]; }));                      // same card twice
  await refused(edit((l) => { l.hole[1][0] = 'ZZ'; }));                            // not a card
  await refused(edit((l) => { l.actions.pop(); }));                                // decision missing
  await refused(edit((l) => { l.actions.push({ ...l.actions.at(-1) }); }));        // decision left over
  await refused(edit((l) => { l.actions[0].seat = (l.actions[0].seat + 1) % 2; })); // not their turn
  await refused(edit((l) => { l.actions.find((a) => a.type === 'raise').to = 1; })); // raise too small
  await refused(edit((l) => { l.actions.find((a) => a.type === 'raise').to = 999999; })); // more than the stack
});

test('achievements: ids are unique, tests only unlock once', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const ctx = {
    totals: { games: 1, gamesWon: 0, hands: 1, handsWon: 1, showdownsWon: 0 },
    hand: { result: 'uncontested', actions: [], hero: { net: 30, collected: 30, allIn: false, showdownWon: false, handCategory: null } },
    game: { status: 'PLAYING', opponents: [{ name: 'Le Baron', level: 'expert' }], bigBlind: 20 },
  };
  assert.deepEqual(newlyUnlocked(ctx, []), ['first_game', 'first_pot']);
  assert.deepEqual(newlyUnlocked(ctx, ['first_game']), ['first_pot']);
});

test("replayed hands give the player's decisions, filed under solver keys", async () => {
  const fs = await import('node:fs');
  const { CardAbstraction } = await import('../src/shared/ai/mccfr/cardAbstraction.js');
  const { playerInfosets, strategyGap } = await import('../src/shared/stats/playerInfosets.js');
  const DATA = new URL('../public/ai/mccfr/', import.meta.url);
  const abstraction = CardAbstraction.fromTexts(CardAbstraction.FILES.map((f) => fs.readFileSync(new URL(f, DATA), 'utf8')));
  let decisions = 0;
  let filed = 0;
  for (const { before, log } of await playLogged(1, 20)) {
    const out = await replayHand(before, log);
    const mine = out.decisions.filter((d) => d.seat === 0);
    assert.equal(mine.length, log.actions.filter((a) => a.seat === 0).length, 'one decision per logged action');
    const keys = playerInfosets(out.decisions, abstraction);
    for (const k of keys) {
      assert.match(k.key, /^\d+$/);
      assert.ok(['fold', 'call', 'raise'].includes(k.action));
    }
    decisions += mine.length;
    filed += keys.length;
  }
  assert.ok(filed <= decisions && filed > 0, 'off-tree decisions are skipped, the rest filed');
  assert.equal(strategyGap({ fold: 0, call: 2, raise: 2 }, [0, 0.5, 0.5]), 0);
  assert.equal(strategyGap({ fold: 4, call: 0, raise: 0 }, [0, 0, 1]), 1);
  // Several sizes: they add up into "raise"
  assert.equal(strategyGap({ fold: 0, call: 2, raise: 2 }, [0, 0.5, 0.2, 0.2, 0.1]), 0);
});
