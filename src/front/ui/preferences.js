/**
 * preferences.js — The player's options: current values, remembered in the browser
 *
 * The list of options lives in config/preferences.js. Values are kept in the
 * localStorage (one JSON object); if it is unavailable (private mode), the
 * defaults apply and changes last until the page is closed.
 */

import { PREFERENCES } from '../config/preferences.js';

const STORAGE_KEY = 'poker.preferences';

const values = load();
const listeners = new Set();

/** Current value of an option (its first choice by default). */
export function getPref(id) {
  return values[id];
}

export function setPref(id, value) {
  if (values[id] === value || !isChoice(id, value)) return;
  values[id] = value;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch { /* not remembered */ }
  listeners.forEach((fn) => fn(id, value));
}

/** Move to the option's next choice (keyboard shortcut). */
export function cyclePref(id) {
  const { choices } = PREFERENCES.find((p) => p.id === id);
  const i = choices.findIndex((c) => c.value === values[id]);
  setPref(id, choices[(i + 1) % choices.length].value);
}

/** fn(id, value) after every change. Returns a function that stops listening. */
export function onPrefChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function isChoice(id, value) {
  return !!PREFERENCES.find((p) => p.id === id)?.choices.some((c) => c.value === value);
}

function load() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; } catch { /* defaults */ }
  return Object.fromEntries(PREFERENCES.map((p) => [
    p.id,
    isChoice(p.id, saved[p.id]) ? saved[p.id] : p.choices[0].value,
  ]));
}
