// AI tests — run with `npm run test:ai`
// Checks that the JS side reproduces the C++ MCCFR exactly (keys, buckets)
// and that decisions are always legal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { packInfoSetKey, historyString, hashHistory } from '../src/shared/ai/mccfr/infosetKey.js';
import { evaluate, compareHands } from '../src/shared/poker/handEvaluator.js';
import { codeToCard, handType } from '../src/shared/poker/cards.js';
import { toAbstract } from '../src/shared/ai/mccfr/historyTranslator.js';
import { AbstractHand } from '../src/shared/ai/mccfr/bettingTree.js';
import { CardAbstraction, bucketFromEHS } from '../src/shared/ai/mccfr/cardAbstraction.js';
import { StrategyTable, packStrategy } from '../src/shared/ai/mccfr/StrategyTable.js';
import { PokerBot } from '../src/shared/ai/PokerBot.js';
import { legalActions, validateRaise } from '../src/shared/poker/betting.js';

const DATA = new URL('../public/ai/mccfr/', import.meta.url);
const PRIVATE_STRATEGY = new URL('../server/data/strategy.bin', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, DATA), 'utf8');
const pairs = (t) => new Map(t.trim().split('\n').map((l) => { const [k, v] = l.trim().split(/\s+/); return [k, +v]; }));
const nums = (t) => t.trim().split('\n').map(Number);

function loadAI() {
  const abstraction = new CardAbstraction({
    preflopBuckets: pairs(read('buckets.txt')),
    equity: pairs(read('equity_table.txt')),
    thresholds: { 1: nums(read('flop_thresholds.txt')), 2: nums(read('turn_thresholds.txt')), 3: nums(read('river_thresholds.txt')) },
  });
  const table = new StrategyTable(fs.readFileSync(PRIVATE_STRATEGY));
  return { ai: new PokerBot(abstraction, table), table };
}

const H = (s) => s.split(' ').map(codeToCard);
const A = (seat, type) => ({ seat, type });
const abs = (rounds, me, round) => {
  const a = toAbstract(rounds, me, round);
  return `p${a.player} ${historyString(a.rounds)}`;
};

test('FNV-1a matches the reference 64-bit values', () => {
  assert.equal(hashHistory(''), 0xcbf29ce484222325n);
  assert.equal(hashHistory('a'), 0xaf63dc4c8601ec8cn);
});

test('infoset keys match the strategy (every preflop bucket is found)', () => {
  const { table } = loadAI();
  const buckets = new Set(pairs(read('buckets.txt')).values());
  for (const b of buckets) {
    assert.ok(table.get(packInfoSetKey(0, 0, b, historyString([[]]))), `root key, bucket ${b}`);
  }
});

test('strategy.bin: packed rows read back, quantised to 1/255', () => {
  const t = new StrategyTable(packStrategy('42 0.2 0.8\n7 0.1 0.3 0.6 0\n18446744073709551615 1 0\n').buffer);
  assert.equal(t.size, 3);
  assert.deepEqual(t.get('7').map((p) => Math.round(p * 100)), [10, 30, 60, 0]);
  assert.deepEqual(t.get('18446744073709551615'), [1, 0]); // above 2^53
  assert.equal(t.get('8'), undefined);
});

test('the betting tree is the solver\'s: random abstract hands only meet known nodes', () => {
  // Plays random legal options in the abstract game (rules of GameState) and
  // checks every node is in the strategy with the same number of options
  const { table } = loadAI();
  const preflop = [...new Set(pairs(read('buckets.txt')).values())];
  let nodes = 0;
  for (let g = 0; g < 1500; g++) {
    const h = new AbstractHand();
    let round = 0;
    let acted = 0;
    while (round < 4) {
      const bucket = round === 0 ? preflop[g % preflop.length] : (g * 7 + acted) % 50;
      const options = h.options();
      const row = table.get(packInfoSetKey(round, h.player, bucket, h.historyString()));
      assert.ok(row, `node ${round} ${h.historyString()}`);
      assert.equal(row.length, options.length, `options at ${h.historyString()}`);
      nodes++;
      const legal = options.map((o, i) => (o.legal ? i : -1)).filter((i) => i >= 0);
      const i = legal[Math.floor(Math.random() * legal.length)];
      h.apply(i);
      acted++;
      if (options[i].type === 'fold') break;
      if (options[i].type === 'call' && acted >= 2 && h.bets[0] === h.bets[1]) {
        round++;
        acted = 0;
        if (round < 4) h.startRound(round);
      }
    }
  }
  assert.ok(nodes > 5000);
});

test('the bot bets the solver\'s sizes on the real table', () => {
  const { ai } = loadAI();
  // Flop, the bot (big blind, seat 0) speaks first into a pot of 120 (blinds 10/20)
  const turn = { stack: 1940, playerBet: 0, currentBet: 0, lastRaise: 0, bigBlind: 20, pot: 120 };
  const history = [[{ seat: 1, type: 'raise', to: 50, potBefore: 30 }, { seat: 0, type: 'call' }], []];
  const seen = new Set();
  for (const hole of [['AS', 'AH'], ['KS', 'QS'], ['7D', '2C'], ['JH', 'TH']]) {
    for (let i = 0; i < 150; i++) {
      const { action, debug } = ai.decide({ level: 'expert', round: 1, hole, board: ['AD', '9S', '4H'], seat: 0, opponents: 1, history, turn });
      assert.equal(debug.fromSolver, true);
      assert.deepEqual(debug.options, ['Se coucher', 'Checker', '⅓ pot', '½ pot', '⅔ pot', 'Pot', 'Tapis']);
      if (action.type === 'raise') seen.add(action.to);
    }
  }
  for (const to of seen) assert.ok([40, 60, 80, 120, 1940].includes(to), `bet to ${to}`);
});

test('hand evaluator ranks categories correctly', () => {
  const cat = (s) => Math.floor(evaluate(H(s)) / 13 ** 5);
  assert.equal(cat('AS KS QS JS TS 2D 3C'), 8);
  assert.equal(cat('AS 2S 3S 4S 5S 9D 9C'), 8);
  assert.equal(cat('9S 9H 9D 9C 2S 3S 4D'), 7);
  assert.equal(cat('9S 9H 9D 2C 2S 2D 4D'), 6);
  assert.equal(cat('AS 9S 7S 4S 2S KD QC'), 5);
  assert.equal(cat('AS 2D 3C 4H 5S 9D KC'), 4);
  assert.equal(cat('9S 9H 5D 5C 2S 2D KD'), 2);
  assert.equal(compareHands(H('AS AH KD QC 2S 3D 7C'), H('AD AC KS JC 2S 3D 7C')), 1);
  assert.equal(compareHands(H('KS KH 2D 2C 3S 3D AC'), H('KD KC 2S 2H 3C 3H QS')), 1);
});

test('hand types and EHS buckets', () => {
  assert.equal(handType(H('AS KS')), 'AKs');
  assert.equal(handType(H('2D 7C')), '72o');
  assert.equal(handType(H('QH QS')), 'QQ');
  assert.equal(bucketFromEHS([0.2, 0.5, 0.8], 0.1), 0);
  assert.equal(bucketFromEHS([0.2, 0.5, 0.8], 0.5), 2); // upper_bound: equal goes up
  assert.equal(bucketFromEHS([0.2, 0.5, 0.8], 0.95), 3);
});

test('real betting → heads-up solver history', () => {
  // Heads-up: seat 1 = small blind, seat 0 = big blind. Raises without sizes
  // take the node's first size ('2'): the open, the 3-bet, the ⅓-pot bet…
  assert.equal(abs([[]], 1, 0), 'p0 ////');
  assert.equal(abs([[A(1, 'call')]], 0, 0), 'p1 c////');
  assert.equal(abs([[A(1, 'raise'), A(0, 'raise')]], 1, 0), 'p0 22////');
  assert.equal(abs([[A(1, 'call'), A(0, 'check')], []], 0, 1), 'p1 cc////');
  assert.equal(abs([[A(1, 'raise'), A(0, 'call')], [A(0, 'raise'), A(1, 'raise'), A(0, 'call')], [A(0, 'check')]], 1, 2), 'p0 2c/22c/c//');
  // Multiway: opponents merge, folds are dropped
  assert.equal(abs([[A(3, 'raise'), A(0, 'fold'), A(1, 'call')]], 2, 0), 'p1 2////');
});

test('decisions are always legal, at every level', () => {
  const { ai } = loadAI();
  const turns = [
    { stack: 990, playerBet: 10, currentBet: 20, lastRaise: 20, bigBlind: 20, pot: 30 },
    { stack: 900, playerBet: 0, currentBet: 0, lastRaise: 0, bigBlind: 20, pot: 200 },
    { stack: 15, playerBet: 0, currentBet: 20, lastRaise: 20, bigBlind: 20, pot: 50 },
  ];
  for (const level of ['beginner', 'regular', 'expert']) {
    for (const turn of turns) {
      for (let i = 0; i < 200; i++) {
        const { action } = ai.decide({ level, round: 0, hole: ['7S', '2H'], board: [], seat: 1, opponents: 2, history: [[]], turn });
        const legal = legalActions(turn);
        if (action.type === 'check') assert.ok(legal.check);
        if (action.type === 'call') assert.equal(action.amount, legal.call);
        if (action.type === 'raise') assert.ok(validateRaise(turn, action.to).ok, `raise to ${action.to}`);
        if (action.type === 'fold') assert.ok(!legal.check, 'no folding when checking is free');
      }
    }
  }
});

// ── Real sizes → the solver's sizes ───────────────────────────────────────────
// Blinds 10/20, 100 BB stacks (2000). Seat 1 = small blind, seat 0 = big blind (the bot).
const OPEN_3BB = { seat: 1, type: 'raise', to: 60, potBefore: 30, allIn: false };   // closest: the 2.5 BB open
const SHOVE    = { seat: 1, type: 'raise', to: 2000, potBefore: 30, allIn: true };
const OVERBET  = { seat: 1, type: 'raise', to: 400, potBefore: 30, allIn: false };  // 20 BB, not all-in
const opened = [{ seat: 1, type: 'raise', to: 50, potBefore: 30 }, { seat: 0, type: 'call' }]; // 2.5 BB open ('3'), flop pot: 100
const flopBet = (to) => toAbstract([opened, [{ seat: 0, type: 'check' }, { seat: 1, type: 'raise', to, potBefore: 100 }]], 0, 1);

test('translation: each real size becomes the closest solver size', () => {
  // Root: '2' = 2 BB open, '3' = 2.5 BB open, '4' = all-in
  assert.equal(historyString(toAbstract([[OPEN_3BB]], 0, 0).rounds), '3////');
  const shove = toAbstract([[SHOVE]], 0, 0);
  assert.equal(historyString(shove.rounds), '4////');          // the all-in option of the root
  assert.equal(shove.offTree, null);
  assert.deepEqual(shove.options.map((o) => o.type), ['fold', 'call']);
  // A big raise that isn't all-in never becomes the solver's all-in
  assert.equal(historyString(toAbstract([[OVERBET]], 0, 0).rounds), '3////');
  // A short all-in (5 BB) is closer to the open than to a 200 BB shove
  assert.equal(historyString(toAbstract([[{ ...SHOVE, to: 100 }]], 0, 0).rounds), '3////');
  // A min-raise to 2 BB: Slumbot's open
  assert.equal(historyString(toAbstract([[{ ...OPEN_3BB, to: 40 }]], 0, 0).rounds), '2////');

  // Flop, pot 100 (5 BB): ⅓ ½ ⅔ pot are '2' '3' '4' '5'
  assert.equal(historyString(flopBet(33).rounds), '3c/c2///');
  assert.equal(historyString(flopBet(50).rounds), '3c/c3///');
  assert.equal(historyString(flopBet(70).rounds), '3c/c4///');
  assert.equal(historyString(flopBet(100).rounds), '3c/c5///');
  assert.equal(historyString(flopBet(250).rounds), '3c/c5///');  // an overbet: the pot size
  assert.equal(flopBet(250).offTree, null);
  // In a limped pot (4 solver chips) ⅓ pot is under the minimum bet: '2' is ½ pot there
  const limped = [{ seat: 1, type: 'call' }, { seat: 0, type: 'check' }];
  assert.equal(historyString(toAbstract([limped, [{ seat: 0, type: 'raise', to: 20, potBefore: 40 }]], 1, 1).rounds), 'cc/2///');

  // Beyond the tree: a 5th bet in a round (the 4th is the all-in)
  const five = toAbstract([[A(1, 'raise'), A(0, 'raise'), A(1, 'raise'), A(0, 'raise'), A(1, 'raise')]], 0, 0);
  assert.match(five.offTree, /beyond/);
});

const facingShove = { stack: 1980, playerBet: 20, currentBet: 2000, lastRaise: 1980, bigBlind: 20, pot: 2020 };
function decisions(ai, hole, { board = [], round = 0, history = [[SHOVE]], turn = facingShove, n = 200 } = {}) {
  const out = { fold: 0, call: 0, raise: 0, check: 0 };
  let debug;
  for (let i = 0; i < n; i++) {
    const d = ai.decide({ level: 'expert', round, hole, board, seat: 0, opponents: 1, history, turn });
    out[d.action.type]++;
    debug = d.debug;
  }
  return { out, debug };
}

test('facing a 100 BB preflop shove: the solver answers, weak hands fold, premiums call', () => {
  const { ai } = loadAI();
  for (const hole of [['7S', '2H'], ['9S', '4H'], ['JS', '4H'], ['AS', '5H']]) {
    const { out, debug } = decisions(ai, hole);
    assert.equal(out.fold, 200, `${hole} should fold, got ${JSON.stringify(out)}`);
    assert.equal(debug.fromSolver, true);
    assert.equal(debug.offTree, null);
  }
  for (const hole of [['AS', 'AH'], ['KS', 'KH'], ['QS', 'QH']]) {
    const { out } = decisions(ai, hole);
    assert.equal(out.call, 200, `${hole} should call, got ${JSON.stringify(out)}`);
  }
});

test('facing a normal 3 BB open: the decision comes from the solver', () => {
  const { ai } = loadAI();
  const turn = { stack: 1980, playerBet: 20, currentBet: 60, lastRaise: 40, bigBlind: 20, pot: 80 };
  for (const hole of [['7S', '2H'], ['AS', 'AH'], ['KS', 'QS']]) {
    const d = ai.decide({ level: 'expert', round: 0, hole, board: [], seat: 0, opponents: 1, history: [[OPEN_3BB]], turn });
    assert.equal(d.debug.fromSolver, true, `${hole}`);
    assert.equal(d.debug.offTree, null);
  }
});

test('facing a river shove: weak EHS folds, very strong EHS calls', () => {
  const { ai } = loadAI();
  const board = ['QS', 'JS', 'TS', '2D', '3C'];
  const history = [
    [{ seat: 1, type: 'call' }, { seat: 0, type: 'check' }],
    [{ seat: 0, type: 'check' }, { seat: 1, type: 'check' }],
    [{ seat: 0, type: 'check' }, { seat: 1, type: 'check' }],
    [{ seat: 0, type: 'check' }, { seat: 1, type: 'raise', to: 1980, potBefore: 40, allIn: true }],
  ];
  const turn = { stack: 1980, playerBet: 0, currentBet: 1980, lastRaise: 1980, bigBlind: 20, pot: 2020 };
  const weak = decisions(ai, ['7H', '4D'], { board, round: 3, history, turn });
  assert.equal(weak.out.fold, 200, JSON.stringify(weak.out));
  const nuts = decisions(ai, ['AS', 'KS'], { board, round: 3, history, turn });
  assert.equal(nuts.out.call, 200, JSON.stringify(nuts.out));
});

test('legal decisions facing a shove, including a call that puts the bot all-in', () => {
  const { ai } = loadAI();
  const short = { stack: 500, playerBet: 20, currentBet: 2000, lastRaise: 1980, bigBlind: 20, pot: 2020 };
  for (const hole of [['AS', 'AH'], ['7S', '2H'], ['QS', 'JS']]) {
    for (const turn of [facingShove, short]) {
      for (let i = 0; i < 100; i++) {
        const { action } = ai.decide({ level: 'expert', round: 0, hole, board: [], seat: 0, opponents: 1, history: [[SHOVE]], turn });
        const legal = legalActions(turn);
        assert.ok(action.type !== 'raise', 'nothing left to raise');
        if (action.type === 'call') assert.equal(action.amount, legal.call);
        if (action.type === 'fold') assert.ok(!legal.check);
      }
    }
  }
});
