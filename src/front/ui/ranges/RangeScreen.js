/**
 * RangeScreen.js — The range chart window (badge "📖 Ranges", pause menu)
 *
 * The window only: the sign, the tabs, the grid on the left, the tab's panel
 * on the right, closing (✕, click outside, Esc). Each tab is its own module:
 *   🔍 Explorer        ExploreMode.js   example ranges and their lessons
 *   🖌️ Construire      BuildMode.js     paint a range, save it to the account
 *   📜 Mon historique  HistoryMode.js   the range really played, mistakes, losses
 * The grid is RangeGrid.js; shared HTML pieces html.js; CSS styles.js.
 *
 * The detail box describes the hand under the pointer, until a cell is
 * clicked: that hand then stays (pinned) while the pointer crosses other
 * cells on its way, e.g. while scrolling to read the panel. Clicking it
 * again (or another cell) releases or moves the pin.
 *
 * A tab (mode) provides:
 *   id, paintable             its name, and whether the grid paints
 *   enter?(screen)            the tab opens (load data, then screen.render())
 *   view()                    what the grid shows: { name, situation, actions, range, counts? }
 *   sideHtml(view, selected)  the right-hand panel
 *   bind(side, screen)        its panel's events
 *   detailHtml?(hand, view)   the hand described (panel's `.detail` box)
 *   onHover?(hand)            the hand described (e.g. to outline it elsewhere)
 *   afterRender?(screen)      the panel is in the page (e.g. to build a mini grid in it)
 *   paint?(hand, screen)      a cell painted
 *
 *   const screen = new RangeScreen({ getUser });
 *   screen.show();
 */

import { injectRangeStyles } from './styles.js';
import { RangeGrid } from './RangeGrid.js';
import { ExploreMode } from './ExploreMode.js';
import { BuildMode } from './BuildMode.js';
import { HistoryMode } from './HistoryMode.js';

const TABS = [
  { id: 'explore', label: '🔍 Explorer' },
  { id: 'build', label: '🖌️ Construire' },
  { id: 'history', label: '📜 Mon historique' },
];

export class RangeScreen {
  /**
   * @param {{ getUser?: () => object | null }} [deps] — the logged-in player
   *   (the AI's ranges come from the server: aiRanges.js)
   */
  constructor({ getUser = () => null } = {}) {
    injectRangeStyles();
    this.modes = {
      explore: new ExploreMode(),
      build: new BuildMode({ getUser }),
      history: new HistoryMode({ getUser }),
    };
    this.mode = this.modes.explore;
    this.root = null;
    this.grid = null;
    this.side = null;

    // Escape closes this window only (not the pause menu under it): capture + stop
    this._onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      this.hide();
    };
  }

  show() {
    if (this.root) return;
    this._build();
    this._open(this.mode.id);
  }

  hide() {
    if (!this.root) return;
    this.grid.destroy();
    this.root.remove();
    this.root = null;
    window.removeEventListener('keydown', this._onKey, true);
  }

  /** Redraw the grid and the tab's panel. */
  render() {
    if (!this.root) return;
    this.root.querySelectorAll('[data-mode]').forEach((b) => {
      const on = b.dataset.mode === this.mode.id;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-selected', String(on));
    });
    const view = this.mode.view();
    this.root.querySelector('.ranges-title').textContent = view.name;
    this.root.querySelector('.ranges-situation').textContent = view.situation;
    this.grid.setPaintMode(this.mode.paintable);
    this.grid.show(view);
    this.side.innerHTML = this.mode.sideHtml(view, this.grid.selected);
    this.mode.bind(this.side, this);
    this.mode.afterRender?.(this);
    if (this.grid.selected) this._describe(this.grid.selected);
  }

  /** Outline a hand in the grid (null: none) and describe it in the panel. */
  select(hand, options) {
    this.grid.select(hand, options);
    if (hand) this._describe(hand);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _open(id) {
    this.mode = this.modes[id];
    this.grid.select(null);
    this.mode.enter?.(this);
    this.render();
    this.root.querySelector('.ranges-main').scrollTop = 0;
  }

  /** A hand in the panel's detail box (if the tab has one), with a note when it is pinned. */
  _describe(hand) {
    const box = this.side.querySelector('.detail');
    if (box && this.mode.detailHtml) {
      const pin = hand === this.grid.selected
        ? '<p class="detail-pin">📌 Case fixée : clique-la de nouveau pour revenir au survol.</p>'
        : '';
      box.innerHTML = pin + this.mode.detailHtml(hand, this.mode.view());
    }
    this.mode.onHover?.(hand);
  }

  _build() {
    const root = document.createElement('div');
    root.className = 'ranges saloon-backdrop';
    root.innerHTML = `
      <div class="ranges-panel wood-panel" role="dialog" aria-modal="true" aria-labelledby="ranges-title">
        <button type="button" class="ranges-close wood-btn wood-btn--red" aria-label="Fermer">✕</button>
        <div class="ranges-head"><h2 id="ranges-title" class="ranges-sign wood-sign saloon-ol">Tableau des ranges</h2></div>
        <div class="ranges-modes" role="tablist">
          ${TABS.map((t) => `<button type="button" role="tab" class="wood-btn" data-mode="${t.id}">${t.label}</button>`).join('')}
        </div>
        <div class="ranges-main saloon-scroll">
          <div class="ranges-left">
            <div>
              <h3 class="ranges-title"></h3>
              <p class="ranges-situation"></p>
            </div>
            <div class="range-wrap"><div class="range-grid" role="grid" aria-label="Les 169 mains de départ"></div></div>
            <button type="button" class="ranges-toggle wood-btn" aria-pressed="false">Montrer les zones</button>
            <div class="zone-legend" hidden>
              <span style="--swatch:#f7bb2a">Paires (diagonale)</span>
              <span style="--swatch:#2f7de1">Assorties « s » (en haut à droite)</span>
              <span style="--swatch:#9b4dca">Dépareillées « o » (en bas à gauche)</span>
            </div>
          </div>
          <div class="ranges-side leather"></div>
        </div>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.side = root.querySelector('.ranges-side');
    this.grid = new RangeGrid(root.querySelector('.range-grid'), {
      onHover: (hand) => { if (!this.grid.selected) this._describe(hand); }, // a clicked cell stays
      onSelect: (hand) => {
        const pinned = this.grid.selected !== hand;
        this.grid.select(pinned ? hand : null);
        this._describe(hand); // released: the same hand, without the pin note
      },
      onPaint: (hand) => this.mode.paint?.(hand, this),
    });

    root.querySelector('.ranges-close').addEventListener('click', () => this.hide());
    root.addEventListener('click', (e) => { if (e.target === root) this.hide(); });
    root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => this._open(b.dataset.mode)));

    const zones = root.querySelector('.ranges-toggle');
    zones.addEventListener('click', () => {
      const on = zones.getAttribute('aria-pressed') !== 'true';
      zones.setAttribute('aria-pressed', String(on));
      zones.textContent = on ? 'Cacher les zones' : 'Montrer les zones';
      this.grid.setZones(on);
      root.querySelector('.zone-legend').hidden = !on;
    });
    window.addEventListener('keydown', this._onKey, true);
    root.querySelector('.ranges-close').focus();
  }
}
