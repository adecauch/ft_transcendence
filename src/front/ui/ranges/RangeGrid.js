/**
 * RangeGrid.js — The 13×13 chart of the 169 starting hands
 *
 * Draws any view { range, actions, counts?, colors? } (one colour band per
 * action; with `counts`, hands never seen are hatched; `colors` = a colour per
 * hand instead, e.g. a heat map), keeps the selected cell, and reports what
 * the pointer does (unless built with `interactive: false`, e.g. a mini grid):
 *   onHover(hand)   mouse over / keyboard focus on a cell
 *   onSelect(hand)  click (not in paint mode)
 *   onPaint(hand)   press or drag over a cell (paint mode)
 * The cells never change, only their colours: they are built once.
 */

import { cellHand, handKind, handLabel } from '../../../shared/poker/ranges.js';
import { ACTIONS } from '../../config/rangePresets.js';
import { cellBackground, pct } from './html.js';

export class RangeGrid {
  /**
   * @param {HTMLElement} el — an empty element that becomes the grid
   * @param {{ onHover?: (hand: string) => void, onSelect?: (hand: string) => void,
   *           onPaint?: (hand: string) => void, interactive?: boolean }} options
   */
  constructor(el, { onHover, onSelect, onPaint, interactive = true } = {}) {
    this.el = el;
    this.paintMode = false;
    this.selected = null;
    this._painting = false;

    /** @type {Map<string, HTMLButtonElement>} */
    this.cells = new Map();
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) {
        const hand = cellHand(r, c);
        const cell = document.createElement('button');
        cell.type = 'button';
        if (!interactive) cell.tabIndex = -1;
        cell.className = `cell ${handKind(hand)}`;
        cell.innerHTML = `<span>${hand}</span>`;
        cell.dataset.hand = hand;
        el.appendChild(cell);
        this.cells.set(hand, cell);
      }
    }

    this._stopPaint = () => { this._painting = false; };
    if (!interactive) return;

    const handAt = (e) => e.target.closest?.('.cell')?.dataset.hand;
    el.addEventListener('pointerover', (e) => {
      const hand = handAt(e);
      if (hand && !this.paintMode && e.pointerType === 'mouse') onHover?.(hand);
    });
    el.addEventListener('focusin', (e) => {
      const hand = handAt(e);
      if (hand && !this.paintMode) onHover?.(hand);
    });
    el.addEventListener('click', (e) => {
      const hand = handAt(e);
      if (hand && !this.paintMode) onSelect?.(hand);
    });
    // Painting: press on a cell, drag over others (works with touch too)
    el.addEventListener('pointerdown', (e) => {
      const hand = handAt(e);
      if (!hand || !this.paintMode) return;
      e.preventDefault();
      this._painting = true;
      onPaint?.(hand);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this._painting) return;
      const hand = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.cell')?.dataset.hand;
      if (hand) onPaint?.(hand);
    });
    window.addEventListener('pointerup', this._stopPaint);
  }

  /** Remove the window listener (the screen closes). */
  destroy() {
    window.removeEventListener('pointerup', this._stopPaint);
  }

  /** End the current stroke: the pointer stays down but paints nothing more (pipette). */
  stopPainting() {
    this._painting = false;
  }

  setPaintMode(on) {
    this.paintMode = on;
    this.el.style.touchAction = on ? 'none' : '';
  }

  setZones(on) {
    this.el.classList.toggle('zones', on);
  }

  /** Draw a whole view. */
  show(view) {
    for (const hand of this.cells.keys()) this.update(hand, view);
  }

  /** Redraw one cell (painting). */
  update(hand, view) {
    const cell = this.cells.get(hand);
    const mix = view.range[hand] ?? {};
    cell.style.background = view.colors?.[hand] ?? cellBackground(view.range[hand], view.actions);
    cell.classList.toggle('selected', hand === this.selected);
    cell.classList.toggle('empty', Boolean(view.counts) && !view.counts[hand]);
    const said = view.actions.filter((a) => (mix[a] ?? 0) >= 0.005).map((a) => `${ACTIONS[a].short} ${pct(mix[a], 0)}`);
    cell.setAttribute('aria-label', `${handLabel(hand)} (${hand}) : ${view.labels?.[hand] ?? (said.join(', ') || ACTIONS.fold.short)}`);
  }

  /** Outline one cell (null: none) and bring it into view. */
  select(hand, { scroll = false } = {}) {
    this.selected = hand;
    for (const [h, cell] of this.cells) cell.classList.toggle('selected', h === hand);
    if (hand && scroll) this.cells.get(hand)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
