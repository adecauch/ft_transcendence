/**
 * cards.js — Cards: codes, the deck, and the encoding shared with the C++ solver
 *
 * Codes:   2 characters rank + suit, e.g. 'AS', 'TD', '7H' (also the name of
 *          the face texture in public/textures/cards/deck/)
 * Solver:  card = rank * 4 + suit   rank 0..12 = 2..A, suit 0..3 = ♠ ♥ ♦ ♣
 */

const RANKS = '23456789TJQKA';
const SUITS = 'SHDC';

/** @returns {string[]} the 52 card codes, in order */
export function createDeck() {
  return [...SUITS].flatMap((suit) => [...RANKS].map((rank) => rank + suit));
}

/** Fisher–Yates shuffle, in place. */
export function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export const rankOf = (card) => card >> 2;
export const suitOf = (card) => card & 3;

/** 'AS' → 48 */
export function codeToCard(code) {
  const r = RANKS.indexOf(code[0]);
  const s = SUITS.indexOf(code[1]);
  if (r < 0 || s < 0) throw new Error(`Bad card code: ${code}`);
  return r * 4 + s;
}

/** Preflop hand type as in buckets.txt / equity_table.txt: 'AKs', 'T9o', 'QQ' */
export function handType([c1, c2]) {
  let r1 = rankOf(c1);
  let r2 = rankOf(c2);
  if (r1 < r2) [r1, r2] = [r2, r1];
  if (r1 === r2) return RANKS[r1] + RANKS[r2];
  return RANKS[r1] + RANKS[r2] + (suitOf(c1) === suitOf(c2) ? 's' : 'o');
}
