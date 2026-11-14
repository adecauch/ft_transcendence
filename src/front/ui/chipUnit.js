/**
 * chipUnit.js — Amounts shown in chips or in big blinds
 *
 * Follows the "Montants" option (pause menu → Options, or the B key). Stacks,
 * bets and pot on the felt (TableChips), the action bar, the AI notes and the
 * hand results all write their amounts with money(), and redraw on
 * onUnitChange().
 *
 * Display only: the game, the raise amounts sent to PokerGame and the saved
 * hands are always in chips.
 */

import { fmt, fmtBB } from '../../shared/poker/betting.js';
import { getPref, onPrefChange } from './preferences.js';

let bigBlind = null; // the running game's big blind (TableController.start)
const listeners = new Set();

onPrefChange((id) => { if (id === 'chipUnit') notify(); });

/** An amount of chips, written in the current unit ("1 240" or "62 BB"). */
export function money(n) {
  return inBB() ? fmtBB(n, bigBlind) : fmt(n);
}

/** True when amounts are shown in big blinds. */
export function inBB() {
  return getPref('chipUnit') === 'bb' && bigBlind > 0;
}

export function getBigBlind() {
  return bigBlind;
}

export function setBigBlind(bb) {
  bigBlind = bb;
  notify();
}

/** Called after every change of unit. Returns a function that stops listening. */
export function onUnitChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}
