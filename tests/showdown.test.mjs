// Showdown tests — run with `npm run test:ai`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPots, splitPots, handName, scoreHand } from '../src/shared/poker/showdown.js';

test('single pot when nobody is all-in', () => {
  assert.deepEqual(buildPots([100, 100, 100], [false, false, false]), [{ amount: 300, eligible: [0, 1, 2] }]);
});

test('side pots with a short all-in', () => {
  // seat 0 all-in for 50, seats 1 and 2 put 200
  assert.deepEqual(buildPots([50, 200, 200], [false, false, false]), [
    { amount: 150, eligible: [0, 1, 2] },
    { amount: 300, eligible: [1, 2] },
  ]);
});

test('folded chips stay in, folded seats cannot win', () => {
  // seat 2 put 80 then folded
  const pots = buildPots([200, 200, 80], [false, false, true]);
  assert.equal(pots.reduce((s, p) => s + p.amount, 0), 480);
  assert.deepEqual(pots, [{ amount: 480, eligible: [0, 1] }]);
});

test('uncalled excess goes back to the bettor', () => {
  // seat 0 shoved 500, seat 1 could only call 300
  const pots = buildPots([500, 300], [false, false]);
  assert.deepEqual(pots, [{ amount: 600, eligible: [0, 1] }, { amount: 200, eligible: [0] }]);
});

test('ties split, odd chip to the first seat after the button', () => {
  const scores = new Map([[0, 10], [1, 10], [2, 3]]);
  const { winnings } = splitPots([{ amount: 301, eligible: [0, 1, 2] }], scores, [1, 2, 0]);
  assert.equal(winnings.get(1), 151);
  assert.equal(winnings.get(0), 150);
  assert.equal(winnings.get(2), undefined);
});

test('short stack wins main pot, big stack wins side pot', () => {
  const pots = buildPots([50, 200, 200], [false, false, false]);
  const scores = new Map([[0, 99], [1, 50], [2, 10]]);
  const { winnings } = splitPots(pots, scores, [0, 1, 2]);
  assert.equal(winnings.get(0), 150);
  assert.equal(winnings.get(1), 300);
});

test('hand names in French', () => {
  const n = (s) => handName(s.split(' '));
  assert.equal(n('AS KS QS JS TS 2D 3C'), 'Quinte flush royale');
  assert.equal(n('9S 9H 9D 9C 2S 3S 4D'), 'Carré de neuf');
  assert.equal(n('KS KH KD QC QS 3S 4D'), 'Full aux rois par les dames');
  assert.equal(n('AS AH AD TC TS 3S 4D'), 'Full aux as par les dix');
  assert.equal(n('AS 9S 7S 4S 2S KD QC'), 'Couleur hauteur as');
  assert.equal(n('AS 2D 3C 4H 5S 9D KC'), 'Quinte hauteur cinq');
  assert.equal(n('JS JH 5D 5C 2S 7D KD'), 'Deux paires, valets et cinq');
  assert.equal(n('QS QH 5D 3C 2S 7D KD'), 'Paire de dames');
  assert.equal(n('AS AH 5D 3C 2S 7D KD'), "Paire d'as");
  assert.equal(n('AS JH 5D 3C 2S 7D KD'), 'Carte haute as');
  assert.ok(scoreHand('AS AH 5D 3C 2S 7D KD'.split(' ')) > scoreHand('KS KH 5D 3C 2S 7D QD'.split(' ')));
});
