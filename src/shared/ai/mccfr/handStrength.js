/**
 * handStrength.js — Effective Hand Strength, same estimators as the C++ solver
 *
 *   river — exact, against all 990 opponent hands
 *   turn  — sampled: TURN_EHS_ROLLOUTS × (river card + opponent hand)
 *   flop  — sampled: FLOP_EHS_ROLLOUTS × (turn + river + opponent hand)
 *
 * The postflop bucket thresholds were computed with these exact estimators
 * (abstraction/ehs.cpp); using different ones would shift every bucket.
 * Result: probability of winning (ties count half), 0..1.
 */

import { compareHands } from '../../poker/handEvaluator.js';

export const TURN_EHS_ROLLOUTS = 45;
export const FLOP_EHS_ROLLOUTS = 50;

function remainingDeck(used) {
  const taken = new Set(used);
  const rest = [];
  for (let c = 0; c < 52; c++) if (!taken.has(c)) rest.push(c);
  return rest;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const score = (r) => (r > 0 ? 1 : r === 0 ? 0.5 : 0);

/** @param {number[]} hole — 2 cards  @param {number[]} board — 5 cards */
export function riverEHS(hole, board) {
  const rest = remainingDeck([...hole, ...board]);
  const hero = [...hole, ...board];
  let wins = 0;
  let total = 0;
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      wins += score(compareHands(hero, [rest[i], rest[j], ...board]));
      total++;
    }
  }
  return wins / total;
}

/** @param {number[]} board — 4 cards */
export function turnEHS(hole, board, rollouts = TURN_EHS_ROLLOUTS) {
  const rest = remainingDeck([...hole, ...board]);
  let wins = 0;
  let tested = 0;
  while (tested < rollouts) {
    shuffle(rest);
    for (let i = 0; i + 2 < rest.length && tested < rollouts; i += 3) {
      const full = [...board, rest[i]];
      wins += score(compareHands([...hole, ...full], [rest[i + 1], rest[i + 2], ...full]));
      tested++;
    }
  }
  return wins / tested;
}

/** @param {number[]} board — 3 cards */
export function flopEHS(hole, board, rollouts = FLOP_EHS_ROLLOUTS) {
  const rest = remainingDeck([...hole, ...board]);
  let wins = 0;
  let tested = 0;
  while (tested < rollouts) {
    shuffle(rest);
    for (let i = 0; i + 3 < rest.length && tested < rollouts; i += 4) {
      const full = [...board, rest[i], rest[i + 1]];
      wins += score(compareHands([...hole, ...full], [rest[i + 2], rest[i + 3], ...full]));
      tested++;
    }
  }
  return wins / tested;
}

/** EHS for the current street (board of 3, 4 or 5 cards). */
export function ehs(hole, board) {
  if (board.length === 5) return riverEHS(hole, board);
  if (board.length === 4) return turnEHS(hole, board);
  return flopEHS(hole, board);
}
