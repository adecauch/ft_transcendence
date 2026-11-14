/**
 * Overlay.js — Overlay manager (darkened backdrop + wooden panel)
 *
 * Shows a darkened backdrop + a Panel containing section content.
 * Dispatches a custom 'overlay:close' event on the window when dismissed,
 * so TableInput can restore the camera and unflip the cards.
 *
 * DOM structure injected into #overlay:
 *
 *   <div class="overlay-backdrop">
 *     <div class="overlay-panel">
 *       <!-- Panel content here -->
 *       <button class="overlay-close">✕</button>
 *     </div>
 *   </div>
 */

import { Panel }    from './Panel.js';
import { fadeIn, fadeOut } from './fade.js';

export class Overlay {
  constructor() {
    this._container = document.getElementById('overlay');
    this._backdrop  = null;
    this._panel     = null;
    this._visible   = false;

    this._build();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Show the overlay with the given section data.
   * @param {import('../../config/newGameOptions').Section} section
   */
  async show(section) {
    if (this._visible) return;
    this._visible = true;

    // Update panel content
    this._panel.render(section);

    // Fade in the backdrop
    this._backdrop.style.display = 'flex';
    await fadeIn(this._backdrop, 350);
  }

  /** Hide the overlay and notify listeners. */
  async hide() {
    if (!this._visible) return;

    await fadeOut(this._backdrop, 300);
    this._visible = false;

    // Notify TableInput
    window.dispatchEvent(new CustomEvent('overlay:close'));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build() {
    // ── Backdrop ──
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'overlay-backdrop saloon-backdrop';
    Object.assign(this._backdrop.style, {
      display:        'none',
      position:       'fixed',
      inset:          '0',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         '10',
    });

    // ── Panel ──
    this._panel = new Panel();

    // ── Close button (styled in Panel.js) ──
    const closeBtn = document.createElement('button');
    closeBtn.type        = 'button';
    closeBtn.textContent = '✕';
    closeBtn.className   = 'overlay-close wood-btn wood-btn--red';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.addEventListener('click', () => this.hide());

    this._panel.element.appendChild(closeBtn);
    this._backdrop.appendChild(this._panel.element);
    this._container.appendChild(this._backdrop);

    // Close on backdrop click (outside the panel)
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) this.hide();
    });
  }
}
