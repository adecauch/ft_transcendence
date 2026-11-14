/**
 * Brush.js — The paint brush of « Construire »: pure actions or a mix
 *
 * A brush is a mix in percent: { raise, call } (the rest is fold), in steps of
 * STEP %. Painting a cell gives it that mix: « relance 60 %, suit 25 %,
 * couché 15 % » is how a solver plays a hand it mixes.
 *
 * Its panel:
 *   quick brushes   Relancer 100 % · Suivre 100 % · Gomme (fold)
 *   two sliders     Relancer % and Suivre % (their sum stays ≤ 100)
 *   shortcut chips  the usual mixes (50/50, 75/25, bluff 25 %…)
 *   pipette         the next cell clicked gives its mix to the brush
 * A preview swatch + text shows the current mix, like a cell of the grid.
 */

import { ACTIONS } from '../../config/rangePresets.js';
import { cellBackground } from './html.js';

export const STEP = 5;

const PURE = [
  { id: 'raise', label: ACTIONS.raise.label, raise: 100, call: 0 },
  { id: 'call', label: ACTIONS.call.label, raise: 0, call: 100 },
  { id: 'fold', label: 'Gomme', raise: 0, call: 0 },
];

/** Usual mixes, with what they are for (the title). */
const CHIPS = [
  { raise: 50, call: 50, title: 'Moitié relance, moitié suivi' },
  { raise: 75, call: 25, title: 'Surtout relancer' },
  { raise: 25, call: 75, title: 'Surtout suivre' },
  { raise: 25, call: 0, title: 'Relancer parfois (bluff), sinon se coucher' },
  { raise: 0, call: 50, title: 'Suivre une fois sur deux, sinon se coucher' },
];

export class Brush {
  constructor() {
    this.raise = 100; // percent
    this.call = 0;
    /** The next cell clicked is read, not painted */
    this.picking = false;
  }

  get fold() {
    return 100 - this.raise - this.call;
  }

  /** The mix a painted cell gets: fractions, zeros left out (all zero = fold = no entry). */
  mix() {
    const m = {};
    if (this.raise) m.raise = this.raise / 100;
    if (this.call) m.call = this.call / 100;
    return Object.keys(m).length ? m : undefined;
  }

  /** Take a cell's mix (pipette), rounded to the brush's steps. */
  take(mix) {
    const r = Math.round(((mix?.raise ?? 0) * 100) / STEP) * STEP;
    const c = Math.round(((mix?.call ?? 0) * 100) / STEP) * STEP;
    this.raise = r;
    this.call = Math.min(c, 100 - r);
    this.picking = false;
  }

  /** « Relance 60 % · Suit 25 % · Couché 15 % » */
  describe() {
    return [['Relance', this.raise], ['Suit', this.call], ['Couché', this.fold]]
      .filter(([, p]) => p > 0).map(([w, p]) => `${w} ${p} %`).join(' · ');
  }

  html() {
    const chip = (c) => `<button type="button" class="wood-btn mix-chip" data-mix="${c.raise},${c.call}" title="${c.title}">
      <span class="swatch" style="background:${cellBackground({ raise: c.raise / 100, call: c.call / 100 }, ['raise', 'call'])}"></span>${label(c)}</button>`;
    return `
      <div class="brushes">
        ${PURE.map((b) => `
          <button type="button" class="wood-btn" data-brush="${b.id}" aria-pressed="${this.raise === b.raise && this.call === b.call}">
            <span class="swatch" style="background:${ACTIONS[b.id].color}"></span>${b.label}
          </button>`).join('')}
      </div>
      <div class="mix">
        <div class="mix-preview">
          <span class="mix-swatch" aria-hidden="true"></span>
          <span class="mix-text" aria-live="polite"></span>
        </div>
        ${slider('raise', 'Relancer', this.raise)}
        ${slider('call', 'Suivre', this.call)}
        <div class="mix-chips" role="group" aria-label="Mélanges courants">${CHIPS.map(chip).join('')}</div>
        <button type="button" class="wood-btn mix-pipette" aria-pressed="${this.picking}">💧 Pipette : reprendre le mélange d’une case</button>
      </div>`;
  }

  /**
   * Wire the panel. Updates happen in place (a slider keeps the focus while dragged).
   * @param {HTMLElement} side
   */
  bind(side) {
    const $ = (s) => side.querySelector(s);
    const refresh = () => {
      $('#mix-raise').value = this.raise;
      $('#mix-call').value = this.call;
      $('#mix-raise-out').textContent = `${this.raise} %`;
      $('#mix-call-out').textContent = `${this.call} %`;
      $('.mix-swatch').style.background = cellBackground(this.mix() ?? { fold: 1 }, ['raise', 'call']);
      $('.mix-text').textContent = this.picking ? 'Clique sur une case pour reprendre son mélange…' : this.describe();
      side.querySelectorAll('[data-brush]').forEach((b) => {
        const p = PURE.find((x) => x.id === b.dataset.brush);
        b.setAttribute('aria-pressed', String(this.raise === p.raise && this.call === p.call));
      });
      $('.mix-pipette').setAttribute('aria-pressed', String(this.picking));
    };
    this.refresh = refresh; // after the pipette, BuildMode shows the new mix

    side.querySelectorAll('[data-brush]').forEach((b) => b.addEventListener('click', () => {
      const p = PURE.find((x) => x.id === b.dataset.brush);
      [this.raise, this.call, this.picking] = [p.raise, p.call, false];
      refresh();
    }));
    // The slider moved keeps its value; the other one gives way if the sum passes 100
    $('#mix-raise').addEventListener('input', (e) => {
      this.raise = Number(e.target.value);
      this.call = Math.min(this.call, 100 - this.raise);
      refresh();
    });
    $('#mix-call').addEventListener('input', (e) => {
      this.call = Number(e.target.value);
      this.raise = Math.min(this.raise, 100 - this.call);
      refresh();
    });
    side.querySelectorAll('[data-mix]').forEach((b) => b.addEventListener('click', () => {
      [this.raise, this.call] = b.dataset.mix.split(',').map(Number);
      this.picking = false;
      refresh();
    }));
    $('.mix-pipette').addEventListener('click', () => {
      this.picking = !this.picking;
      refresh();
    });
    refresh();
  }
}

function slider(id, name, value) {
  return `
    <div class="mix-row">
      <label for="mix-${id}" class="mix-label"><span class="swatch" style="background:${ACTIONS[id].color}"></span>${name}</label>
      <input id="mix-${id}" class="mix-slider" type="range" min="0" max="100" step="${STEP}" value="${value}">
      <output id="mix-${id}-out" for="mix-${id}" class="mix-out">${value} %</output>
    </div>`;
}

/** « Relance 25 % · Couché 75 % » */
function label({ raise, call }) {
  return [['Relance', raise], ['Suit', call], ['Couché', 100 - raise - call]]
    .filter(([, p]) => p > 0).map(([w, p]) => `${w} ${p} %`).join(' · ');
}
