/**
 * html.js — Small HTML pieces shared by the range chart's tabs
 *
 * Anything that came from the server or the player is inserted through esc().
 */

import { TOTAL_COMBOS, rangeStats } from '../../../shared/poker/ranges.js';
import { ACTIONS, RANGE_PRESETS } from '../../config/rangePresets.js';

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 0.456 → '45,6 %' (French decimal comma, no trailing ',0') */
export const pct = (x, digits = 1) => `${(100 * x).toFixed(digits).replace('.', ',').replace(/,0$/, '')} %`;

/** A playing card: 'KS' → K♠ ; size '' or 'small' */
export function cardHtml(code, size = '') {
  const rank = code[0] === 'T' ? '10' : code[0];
  const red = code[1] === 'H' || code[1] === 'D';
  return `<span class="play-card ${size}${red ? ' red' : ''}"><b>${rank}</b><i>${SUIT[code[1]]}</i></span>`;
}

/** CSS background of a cell: one colour band per action, in proportion. */
export function cellBackground(mix, actions) {
  const parts = [];
  let at = 0;
  for (const id of actions) {
    const f = mix?.[id] ?? 0;
    if (f <= 0.001) continue;
    const end = Math.min(100, at + f * 100);
    parts.push(`${ACTIONS[id].color} ${at.toFixed(1)}% ${end.toFixed(1)}%`);
    at = end;
  }
  if (!parts.length) return ACTIONS.fold.color;
  if (at < 99.9) parts.push(`${ACTIONS.fold.color} ${at.toFixed(1)}% 100%`);
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

/** One legend line: colour, label (+ small text), number on the right. */
export function legendRow(action, label, num, sub = '') {
  return `
    <div class="legend-row">
      <span class="swatch" style="background:${ACTIONS[action].color}"></span>
      <span>${label}${sub ? `<span class="legend-sub">${sub}</span>` : ''}</span>
      <span class="legend-num">${num}</span>
    </div>`;
}

/** Share of each action in a range, counted in combos, with a stacked bar. */
export function comboLegendHtml(view) {
  const stats = rangeStats(view.range, view.actions);
  const rows = view.actions.map((id) => {
    const c = Math.round(stats[id].combos);
    return legendRow(id, ACTIONS[id].label, pct(stats[id].share), `${c} combinaison${c > 1 ? 's' : ''} sur ${TOTAL_COMBOS}`);
  }).join('');
  const bar = view.actions.map((id) => `<span style="width:${(100 * stats[id].share).toFixed(2)}%;background:${ACTIONS[id].color}"></span>`).join('');
  return `<div class="legend">${rows}<div class="mixbar" aria-hidden="true">${bar}</div></div>`;
}

/** The example ranges, grouped, as a <select>. */
export function presetPickerHtml(selectedId, { id = 'ranges-picker', label = 'Choisir une range', placeholder = null } = {}) {
  const groups = [...new Set(RANGE_PRESETS.map((p) => p.group))];
  return `
    <label class="saloon-label" for="${id}">${label}</label>
    <select id="${id}" class="ranges-picker">
      ${placeholder ? `<option value="">${esc(placeholder)}</option>` : ''}
      ${groups.map((g) => `<optgroup label="${esc(g)}">${RANGE_PRESETS.filter((p) => p.group === g)
        .map((p) => `<option value="${p.id}"${p.id === selectedId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}
    </select>`;
}

/** "How to read this chart", for beginners. */
export function howtoHtml() {
  return `
    <details class="howto">
      <summary>📖 Comment lire ce tableau ?</summary>
      <div class="howto-body">
        <p>Au poker, on reçoit 2 cartes parmi 52 : cela fait <b>1 326</b> combinaisons, mais seulement <b>169 sortes</b> de mains,
        car les couleurs ne comptent que pour savoir si les deux cartes sont assorties. Le tableau les range toutes.</p>
        <p><b>La diagonale</b> contient les <b>paires</b> (AA en haut à gauche, 22 en bas à droite).
        <b>Au-dessus</b>, les mains <b>assorties</b> (« s », même couleur, ex. AKs). <b>En dessous</b>, les <b>dépareillées</b>
        (« o », couleurs différentes, ex. AKo). Appuie sur « Montrer les zones » pour les voir.</p>
        <p>Plus une case est <b>en haut à gauche</b>, plus les cartes sont hautes. Les cases près de la diagonale
        sont des <b>connecteurs</b> (T9s, 87s…) : ils font facilement des suites.</p>
        <p>La <b>couleur</b> d’une case dit ce que la range fait avec cette main. Une case <b>coupée en plusieurs couleurs</b>
        est une main <b>mixte</b> : on la joue de plusieurs façons, au hasard, dans ces proportions.</p>
        <p>Le <b>%</b> d’une action compte les combinaisons, pas les cases : une case « o » pèse 12, une paire 6, une case « s » 4.</p>
      </div>
    </details>`;
}
