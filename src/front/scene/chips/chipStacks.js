/**
 * chipStacks.js — Chip values and colours, and how amounts turn into chips
 *
 * Classic casino colours. Every amount is represented exactly: what you see
 * on the felt always adds up to the real stack, bet or pot.
 */

/** @typedef {{ value: number, base: string, insert: string, inlay: string, text: string }} Denomination */

/** @type {Denomination[]} — largest first */
export const DENOMINATIONS = [
  { value: 1000, base: '#d9a21b', insert: '#1a1a1a', inlay: '#f4ead2', text: '#7a5406' },
  { value: 500,  base: '#5b2a86', insert: '#f2f0e8', inlay: '#f4ead2', text: '#4a1f70' },
  { value: 100,  base: '#1d1d1f', insert: '#f2f0e8', inlay: '#f4ead2', text: '#1d1d1f' },
  { value: 25,   base: '#1f7a3d', insert: '#f2f0e8', inlay: '#f4ead2', text: '#16582c' },
  { value: 5,    base: '#b3261e', insert: '#f2f0e8', inlay: '#f4ead2', text: '#8f1d17' },
  { value: 1,    base: '#efece3', insert: '#2d5fa8', inlay: '#ffffff', text: '#2d5fa8' },
];

/**
 * Fewest chips for an amount (how a dealer "colours up" the pot, or a bet).
 * @returns {number[]} chip values, largest first
 */
export function exactChips(amount) {
  const chips = [];
  let rest = Math.max(0, Math.round(amount));
  for (const { value } of DENOMINATIONS) {
    while (rest >= value) {
      chips.push(value);
      rest -= value;
    }
  }
  return chips;
}

/**
 * A player's stack: same total, but spread over a few colours the way a real
 * stack looks (not a single 1000 chip). About half of what's left goes into
 * each colour from the top one down, then the remainder is made exactly.
 * @returns {number[]} chip values, largest first
 */
export function stackChips(amount) {
  let rest = Math.max(0, Math.round(amount));
  const chips = [];
  for (const { value } of DENOMINATIONS) {
    if (value < 25 || value > rest / 4) continue; // keep the top colour to ≥ 4 chips
    const n = Math.floor((rest * 0.5) / value);
    for (let i = 0; i < n; i++) chips.push(value);
    rest -= n * value;
  }
  return [...chips, ...exactChips(rest)].sort((a, b) => b - a);
}

export function denomination(value) {
  return DENOMINATIONS.find((d) => d.value === value);
}
