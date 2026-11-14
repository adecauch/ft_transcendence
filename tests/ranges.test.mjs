// Range chart logic — run with `npm run test:ai`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ALL_HANDS, cellHand, combos, parseRange, rangeFromNotation, rangeStats, typeOfCards, handLabel, TOTAL_COMBOS,
} from '../src/shared/poker/ranges.js';
import { solverPreflopRange } from '../src/shared/ai/preflopRanges.js';
import { StrategyTable } from '../src/shared/ai/mccfr/StrategyTable.js';

const set = (text) => [...parseRange(text)].sort();

test('the grid: 169 distinct hands, 1326 combos, pairs on the diagonal', () => {
  assert.equal(new Set(ALL_HANDS).size, 169);
  assert.equal(ALL_HANDS.reduce((s, h) => s + combos(h), 0), TOTAL_COMBOS);
  assert.equal(cellHand(0, 0), 'AA');
  assert.equal(cellHand(0, 1), 'AKs'); // above the diagonal: suited
  assert.equal(cellHand(1, 0), 'AKo'); // below: offsuit
  assert.equal(cellHand(12, 11), '32o');
});

test('notation', () => {
  assert.deepEqual(set('QQ+'), ['AA', 'KK', 'QQ']);
  assert.deepEqual(set('55-22'), ['22', '33', '44', '55']);
  assert.deepEqual(set('ATs+'), ['AJs', 'AKs', 'AQs', 'ATs']);
  assert.deepEqual(set('A5s-A3s'), ['A3s', 'A4s', 'A5s']);
  assert.deepEqual(set('KQ'), ['KQo', 'KQs']);
  assert.deepEqual(set('qjs, t9s'), ['QJs', 'T9s']);
  assert.deepEqual(set('KAo'), ['AKo'], 'ranks in any order');
  assert.equal(parseRange('22+, A2+, K2+, Q2+, J2+, T2+, 92+, 82+, 72+, 62+, 52+, 42+, 32').size, 169);
  assert.throws(() => parseRange('AKx'), /Notation inconnue/);
});

test('ranges: first action wins overlaps, the rest folds, stats add up', () => {
  const r = rangeFromNotation({ raise: 'QQ+, AKs', call: 'JJ-22, AKs' });
  assert.deepEqual(r.AKs, { raise: 1 });
  assert.deepEqual(r['72o'], { fold: 1 });
  const s = rangeStats(r, ['raise', 'call', 'fold']);
  assert.equal(s.raise.combos, 3 * 6 + 4);
  assert.equal(s.call.combos, 10 * 6);
  assert.equal(s.raise.combos + s.call.combos + s.fold.combos, TOTAL_COMBOS);
});

test('cards → hand type, French names', () => {
  assert.equal(typeOfCards(['KD', 'AS']), 'AKo');
  assert.equal(typeOfCards(['9H', 'TH']), 'T9s');
  assert.equal(typeOfCards(['7C', '7D']), '77');
  assert.equal(handLabel('AKs'), 'As-Roi assortis');
  assert.equal(handLabel('QQ'), 'Paire de dames');
});

test("the AI's preflop ranges cover every hand", () => {
  const DATA = new URL('../public/ai/mccfr/', import.meta.url);
  const PRIVATE_STRATEGY = new URL('../server/data/strategy.bin', import.meta.url);
  const read = (f) => fs.readFileSync(new URL(f, DATA), 'utf8');
  const buckets = new Map(read('buckets.txt').trim().split('\n').map((l) => { const [k, v] = l.trim().split(/\s+/); return [k, +v]; }));
  const strategy = new StrategyTable(fs.readFileSync(PRIVATE_STRATEGY));
  for (const spot of ['sbOpen', 'bbVsLimp', 'bbVsRaise']) {
    const range = solverPreflopRange({ preflopBuckets: buckets }, strategy, spot);
    assert.ok(range, spot);
    for (const h of ALL_HANDS) {
      const { fold, call, raise } = range[h];
      assert.ok(Math.abs(fold + call + raise - 1) < 0.01, `${spot} ${h}`);
    }
  }
});

test("history: the player's real range and their mistakes", async () => {
  const { analyseHands } = await import('../src/shared/stats/rangeAnalysis.js');
  const equity = new Map([['AA', 0.85], ['72o', 0.35], ['K9o', 0.55]]);
  const hand = (heroHole, preflop, heroNet, extra = {}) => ({
    gameId: 1, number: 1, playedAt: '2026-09-26', bb: 1, bigBlind: 20, heroHole, heroNet,
    board: [], result: 'uncontested', heroHandName: null, players: [{ seat: 0, folded: false }, { seat: 1 }],
    preflop: [{ seat: 0, type: 'blind' }, { seat: 1, type: 'blind' }, ...preflop], ...extra,
  });
  const out = analyseHands([
    hand(['AS', 'AH'], [{ seat: 0, type: 'raise' }], 40),                            // open AA
    hand(['AD', 'AC'], [{ seat: 0, type: 'fold' }], -10),                            // folded AA: mistake
    hand(['7S', '2H'], [{ seat: 1, type: 'raise' }, { seat: 0, type: 'call' }], -200, { bb: 0 }), // paid a raise with 72o
    hand(['KS', '9H'], [{ seat: 1, type: 'call' }, { seat: 0, type: 'fold' }], -20, { bb: 0 }),  // folded a free check
  ], equity);

  assert.equal(out.situations.open.hands.AA.n, 2);
  assert.equal(out.situations.open.hands.AA.raise, 1);
  assert.equal(out.situations.vsLimp.hands.K9o.fold, 1, 'the big blind after a limp');
  assert.equal(out.situations.vsRaise.hands['72o'].call, 1);
  assert.deepEqual(out.mistakes.map((m) => `${m.rule}:${m.type}`).sort(), ['call-trash:72o', 'fold-free:K9o', 'fold-strong:AA']);
  assert.equal(out.losses[0].bbs, -10, 'the biggest loss first (in big blinds)');
});

test('saved ranges: cleanRange keeps valid data, refuses the rest', async () => {
  const { cleanRange } = await import('../src/shared/poker/ranges.js');
  assert.deepEqual(cleanRange({ AA: { raise: 1 }, '72o': { raise: 0, call: 0 }, KQs: { raise: 0.5, call: 0.5 } }),
    { AA: { raise: 1 }, KQs: { raise: 0.5, call: 0.5 } });
  assert.throws(() => cleanRange({ AX: { raise: 1 } }), /n’est pas une main/);
  assert.throws(() => cleanRange({ AA: { shove: 1 } }), /action inconnue/);
  assert.throws(() => cleanRange({ AA: { raise: 0.7, call: 0.6 } }), /dépassent 100/);
  assert.throws(() => cleanRange([]), /objet/);
});

test('the bot and the stats file a decision under the same infoset key', async () => {
  const { describeInfoset } = await import('../src/shared/ai/mccfr/infoset.js');
  const { CardAbstraction } = await import('../src/shared/ai/mccfr/cardAbstraction.js');
  const { PokerBot } = await import('../src/shared/ai/PokerBot.js');
  const DATA = new URL('../public/ai/mccfr/', import.meta.url);
  const abstraction = CardAbstraction.fromTexts(CardAbstraction.FILES.map((f) => fs.readFileSync(new URL(f, DATA), 'utf8')));
  const bot = new PokerBot(abstraction, null);
  // Preflop: buckets are exact (no rollouts)
  const view = {
    level: 'expert', round: 0, seat: 1, hole: ['AS', 'KD'], board: [], opponents: 1,
    history: [[{ seat: 0, type: 'raise', to: 40, potBefore: 30, allIn: false }], [], [], []],
    turn: { stack: 980, playerBet: 20, currentBet: 40, lastRaise: 20, bigBlind: 20, pot: 60, preflop: true },
    button: 0, sb: 0, bb: 1,
  };
  assert.equal(bot.decide(view).debug.key, describeInfoset(abstraction, view).key);
});

test('abstract histories in French', async () => {
  const { describeHistory } = await import('../src/shared/ai/mccfr/historyWords.js');
  assert.equal(describeHistory('////', 0, 0), 'Avant le flop, tu parles en premier.');
  // Digits are option indexes: which size they mean depends on the node
  assert.equal(describeHistory('2////', 0, 1), 'Avant le flop, l’adversaire relance à 2 grosses blindes.');
  assert.equal(describeHistory('3////', 0, 1), 'Avant le flop, l’adversaire relance à 2,5 grosses blindes.');
  assert.equal(describeHistory('32////', 0, 0), 'Avant le flop, tu relances à 2,5 grosses blindes, l’adversaire relance ×3.');
  assert.equal(describeHistory('c4////', 0, 0), 'Avant le flop, tu suis, l’adversaire fait tapis.');
  assert.equal(describeHistory('2c/2///', 1, 0), 'Au flop, l’adversaire mise ⅓ pot.');
  assert.equal(describeHistory('2c/c5///', 1, 1), 'Au flop, tu checkes, l’adversaire mise la taille du pot.');
  assert.equal(describeHistory('2c/32///', 1, 1), 'Au flop, tu mises ½ pot, l’adversaire relance ×3.');
  assert.equal(describeHistory('cc/2///', 1, 0), 'Au flop, l’adversaire mise ½ pot.'); // limped pot: no ⅓
});
