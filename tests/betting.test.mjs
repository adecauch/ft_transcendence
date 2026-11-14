import { test } from 'node:test';
import assert from 'node:assert/strict';
import { raisePresets, quickBets, fmtBB, parseBB, validateRaise } from '../src/shared/poker/betting.js';

const labels = (ps) => ps.map((p) => `${p.label}:${p.to}`);

test('preflop open: big-blind sizings between Min and Tapis', () => {
  // SB to act heads-up, blinds 10/20, 1000 behind
  const s = { stack: 990, playerBet: 10, currentBet: 20, lastRaise: 20, bigBlind: 20, pot: 30, preflop: true };
  assert.deepEqual(labels(raisePresets(s)), [
    'Min:40', '2,5 BB:50', '3 BB:60', '4 BB:80', 'Tapis:1000',
  ]);
});

test('facing a raise: multiples of the bet; a pot raise equal to one is merged', () => {
  // Pot raise = 60 + (80 + 40) = 180, same as ×3: only one button
  const s = { stack: 980, playerBet: 20, currentBet: 60, lastRaise: 40, bigBlind: 20, pot: 80, preflop: true };
  assert.deepEqual(labels(raisePresets(s)), ['Min:100', '×2,5:150', '×3:180', '×4:240', 'Tapis:1000']);
});

test('postflop first bet: pot fractions and an overbet', () => {
  const s = { stack: 900, playerBet: 0, currentBet: 0, lastRaise: 0, bigBlind: 20, pot: 120, preflop: false };
  assert.deepEqual(labels(raisePresets(s)), [
    'Min:20', '⅓ pot:40', '½ pot:60', '⅔ pot:80', '¾ pot:90', 'Pot:120', '1,5 pot:180', 'Tapis:900',
  ]);
});

test('short stack: sizes above the stack are dropped, Tapis wins ties', () => {
  const s = { stack: 70, playerBet: 0, currentBet: 0, lastRaise: 0, bigBlind: 20, pot: 120, preflop: false };
  assert.deepEqual(labels(raisePresets(s)), ['Min:20', '⅓ pot:40', '½ pot:60', 'Tapis:70']);

  const allInOnly = { stack: 30, playerBet: 0, currentBet: 0, lastRaise: 0, bigBlind: 40, pot: 120, preflop: false };
  assert.deepEqual(labels(raisePresets(allInOnly)), ['Tapis:30']);
});

test('amounts in big blinds: display, typing back, error messages', () => {
  assert.equal(fmtBB(1234, 20), '61,7 BB');
  assert.equal(fmtBB(50, 20), '2,5 BB');
  assert.equal(fmtBB(1000, 20), '50 BB');

  assert.equal(parseBB('2,5', 20), 50);
  assert.equal(parseBB('2.5', 20), 50);
  assert.equal(parseBB(' 3 bb', 20), 60);
  assert.equal(parseBB('abc', 20), null);
  assert.equal(parseBB('', 20), null);

  const s = { stack: 990, playerBet: 10, currentBet: 20, lastRaise: 20, bigBlind: 20, pot: 30, preflop: true };
  const inBB = (n) => fmtBB(n, 20);
  assert.equal(validateRaise(s, 30, inBB).error, 'La relance minimum est de 2 BB.');
  assert.equal(validateRaise(s, 2000, inBB).error, 'Tu ne peux pas miser plus que ton tapis (50 BB).');
});

test('one-click bets: a short row per situation, Tapis last', () => {
  // Preflop open, blinds 10/20: 2 BB is the min-raise and stays
  const open = { stack: 990, playerBet: 10, currentBet: 20, lastRaise: 20, bigBlind: 20, pot: 30, preflop: true };
  assert.deepEqual(labels(quickBets(open)), ['2 BB:40', '2,5 BB:50', '3 BB:60', 'Tapis:1000']);
  // Facing a raise to 60: ×3 (180) and Pot (180) are one button
  const facing = { stack: 980, playerBet: 20, currentBet: 60, lastRaise: 40, bigBlind: 20, pot: 80, preflop: true };
  assert.deepEqual(labels(quickBets(facing)), ['×2,5:150', '×3:180', 'Tapis:1000']);
  // Postflop first bet: the solver's sizes
  const flop = { stack: 900, playerBet: 0, currentBet: 0, lastRaise: 0, bigBlind: 20, pot: 120, preflop: false };
  assert.deepEqual(labels(quickBets(flop)), ['⅓ pot:40', '½ pot:60', '⅔ pot:80', 'Pot:120', 'Tapis:900']);
});

test('one-click bets: short stacks and no raise', () => {
  // Every size at or above the stack: only Tapis
  const short = { stack: 30, playerBet: 0, currentBet: 0, lastRaise: 0, bigBlind: 40, pot: 120, preflop: false };
  assert.deepEqual(labels(quickBets(short)), ['Tapis:30']);
  // Sizes too small for the min-raise (big re-raise): Min stands in
  const big = { stack: 2000, playerBet: 0, currentBet: 400, lastRaise: 380, bigBlind: 20, pot: 430, preflop: true };
  assert.deepEqual(labels(quickBets(big)).at(-1), 'Tapis:2000');
  assert.ok(quickBets(big).every((b) => b.to >= 780));
  // Can only call (or not even): no bets
  const callOnly = { stack: 50, playerBet: 0, currentBet: 100, lastRaise: 80, bigBlind: 20, pot: 150, preflop: false };
  assert.deepEqual(quickBets(callOnly), []);
});
