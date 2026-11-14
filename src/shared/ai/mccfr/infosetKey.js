/**
 * infosetKey.js — Same infoset keys as the C++ MCCFR solver (../CFR)
 *
 * Mirrors utils/key_utils.cpp (KEY_LAYOUT_VERSION 2) and CFRSolver::infoSetKey():
 *
 *   history string: for each of the 4 rounds, its option indexes ('f' 'c'
 *                   then '2'..'7', see bettingTree.js) followed by '/'
 *                   →  e.g. "2c/c3///"
 *   key (64 bits):  [0-1] round | [2] player | [3-12] bucket
 *                   | [13-21] depth (starting stack in BB) | [22-63] FNV-1a(history)
 *
 * The depth keeps each stack depth's nodes apart in the strategy; the solver
 * is trained at SOLVER_DEPTH (200 BB) only, so that is the depth looked up.
 *
 * Keys go above 2^53, so they are computed with BigInt and compared as
 * decimal strings (the format of the solver's strategy file).
 */

import { SOLVER_DEPTH } from './bettingTree.js';

const MASK_64    = (1n << 64n) - 1n;
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME  = 0x100000001b3n;

export const NUM_ROUNDS = 4;

/** FNV-1a over the bytes of an ASCII string, wrapped to 64 bits. */
export function hashHistory(history) {
  let hash = FNV_OFFSET;
  for (let i = 0; i < history.length; i++) {
    hash ^= BigInt(history.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/**
 * Build the history string from per-round action letters.
 * @param {string[][]} rounds — rounds[r] = ['2', 'c', ...] (missing rounds are empty)
 */
export function historyString(rounds) {
  let s = '';
  for (let r = 0; r < NUM_ROUNDS; r++) s += (rounds[r] ?? []).join('') + '/';
  return s;
}

/**
 * @param {number} round  — 0 preflop … 3 river
 * @param {number} player — 0 = small blind (acts first preflop), 1 = big blind
 * @param {number} bucket — 0..1023
 * @param {string} history — see historyString()
 * @param {number} [depth] — starting stack in big blinds, 1..511
 * @returns {string} the key as a decimal string
 */
export function packInfoSetKey(round, player, bucket, history, depth = SOLVER_DEPTH) {
  let key = BigInt(round & 0x3);
  key |= BigInt(player & 0x1) << 2n;
  key |= BigInt(bucket & 0x3ff) << 3n;
  key |= BigInt(depth & 0x1ff) << 13n;
  key |= (hashHistory(history) << 22n) & MASK_64;
  return key.toString();
}
