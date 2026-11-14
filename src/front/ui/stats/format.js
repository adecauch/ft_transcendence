/**
 * format.js — Small text helpers shared by the tabs of the record book
 *
 * Everything the server sends that a player typed (names) goes through esc():
 * inserted as text, never as HTML.
 */

import { fmt } from '../../../shared/poker/betting.js';

export { fmt };

export const STATUS = {
  WON: { label: 'Gagnée', cls: 'won' },
  LOST: { label: 'Perdue', cls: 'lost' },
  QUIT: { label: 'Abandon', cls: 'quit' },
  PLAYING: { label: 'Interrompue', cls: 'quit' },
};
export const LEVEL = { beginner: 'Débutant', regular: 'Confirmé', expert: 'Expert' };
export const STREETS = ['Préflop', 'Flop', 'Turn', 'River'];
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };

/** Text → safe HTML ('<b>' shows as <b>, does not become bold). */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 3 out of 4 → '75 %'; nothing out of nothing → '—'. */
export const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '—');

/** +1 200 / −300 / 0: a result, with its sign. */
export const signed = (n) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '0');

/** Class of a result: green if won, red if lost. */
export const netClass = (n) => (n > 0 ? 'plus' : n < 0 ? 'minus' : '');

export const date = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const time = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** 'TD' → a little card "10♦" (red for hearts / diamonds). */
export function cardHtml(code) {
  const rank = code[0] === 'T' ? '10' : code[0];
  const red = code[1] === 'H' || code[1] === 'D';
  return `<span class="mini-card${red ? ' red' : ''}">${rank}${SUIT[code[1]]}</span>`;
}

/** Several cards, or a dash when there are none (cards never shown). */
export const cardsHtml = (codes) => (codes?.length ? codes.map(cardHtml).join('') : '<span class="dim">—</span>');

/** The number tiles: [value, label, hint?][] → a grid of tiles. */
export const tilesHtml = (tiles) => `<div class="tiles">${tiles.map(([value, label, hint]) => `
  <div class="tile">
    <div class="tile-value">${esc(value)}</div>
    <div class="tile-label">${label}</div>
    ${hint ? `<div class="tile-hint">${hint}</div>` : ''}
  </div>`).join('')}</div>`;

/** A message in the middle of an empty tab. */
export const emptyHtml = (text) => `<p class="stats-empty">${text}</p>`;
