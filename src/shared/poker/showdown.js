/**
 * showdown.js — Pots, winners and hand names (pure logic, no DOM)
 *
 *   buildPots(contributions, folded)  — main pot + side pots from what each
 *                                       seat put in during the hand
 *   splitPots(pots, scores, order)    — who wins what (ties split, odd chips
 *                                       to the first winner after the button)
 *   handName(cards)                   — "Paire de rois", "Full aux dames par les dix"…
 */

import { evaluate } from './handEvaluator.js';
import { codeToCard } from './cards.js';

/**
 * @param {number[]} contributions — chips each seat put in this hand (index = seat)
 * @param {boolean[]} folded       — folded seats can't win, but their chips stay in
 * @returns {{ amount: number, eligible: number[] }[]} main pot first
 */
export function buildPots(contributions, folded) {
  const levels = [...new Set(
    contributions.filter((c, s) => c > 0 && !folded[s]),
  )].sort((a, b) => a - b);

  const pots = [];
  let previous = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of contributions) amount += Math.max(0, Math.min(c, level) - previous);
    const eligible = contributions
      .map((c, s) => (c >= level && !folded[s] ? s : -1))
      .filter((s) => s >= 0);
    if (amount > 0) pots.push({ amount, eligible });
    previous = level;
  }

  // Chips put in above the last live level (by seats that later folded) join the last pot
  const counted = pots.reduce((sum, p) => sum + p.amount, 0);
  const total = contributions.reduce((a, b) => a + b, 0);
  if (pots.length && total > counted) pots[pots.length - 1].amount += total - counted;
  return pots;
}

/**
 * @param {{ amount: number, eligible: number[] }[]} pots
 * @param {Map<number, number>} scores — seat → evaluate() score
 * @param {number[]} order — seats from the first after the button (for odd chips)
 * @returns {{ winnings: Map<number, number>, pots: { amount: number, winners: number[], eligible: number[] }[] }}
 *   a pot with a single eligible seat is a bet nobody could call: it goes back
 */
export function splitPots(pots, scores, order) {
  const winnings = new Map();
  const results = [];
  for (const pot of pots) {
    const best = Math.max(...pot.eligible.map((s) => scores.get(s)));
    const winners = order.filter((s) => pot.eligible.includes(s) && scores.get(s) === best);
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    for (const s of winners) {
      const extra = odd > 0 ? 1 : 0;
      odd -= extra;
      winnings.set(s, (winnings.get(s) ?? 0) + share + extra);
    }
    results.push({ amount: pot.amount, winners, eligible: pot.eligible });
  }
  return { winnings, pots: results };
}

/** Score of 2 hole + board card codes. */
export function scoreHand(codes) {
  return evaluate(codes.map(codeToCard));
}

// ── Hand names (French) ──────────────────────────────────────────────────────

const ONE    = ['deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'valet', 'dame', 'roi', 'as'];
const MANY   = ['deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'valets', 'dames', 'rois', 'as'];
const BASE   = 13;
const CAT    = BASE ** 5;

/** Split an evaluate() score into its category and 5 rank digits. */
function decode(score) {
  const category = Math.floor(score / CAT);
  let rest = score % CAT;
  const ranks = [];
  for (let i = 0; i < 5; i++) {
    ranks.unshift(rest % BASE);
    rest = Math.floor(rest / BASE);
  }
  return { category, ranks };
}

const de = (rank) => (MANY[rank] === 'as' ? "d'as" : `de ${MANY[rank]}`);
const aux = (rank) => (MANY[rank] === 'as' ? 'aux as' : `aux ${MANY[rank]}`);
const par = (rank) => (MANY[rank] === 'as' ? 'par les as' : `par les ${MANY[rank]}`);
const hauteur = (rank) => `hauteur ${ONE[rank]}`;

/** @param {string[]} codes — 5 to 7 card codes */
export function handName(codes) {
  const { category, ranks: [a, b] } = decode(scoreHand(codes));
  switch (category) {
    case 8: return a === 12 ? 'Quinte flush royale' : `Quinte flush ${hauteur(a)}`;
    case 7: return `Carré ${de(a)}`;
    case 6: return `Full ${aux(a)} ${par(b)}`;
    case 5: return `Couleur ${hauteur(a)}`;
    case 4: return `Quinte ${hauteur(a)}`;
    case 3: return `Brelan ${de(a)}`;
    case 2: return `Deux paires, ${MANY[a]} et ${MANY[b]}`;
    case 1: return `Paire ${de(a)}`;
    default: return `Carte haute ${ONE[a]}`;
  }
}
