/**
 * RaisePanel.js — The panel that opens above the bar to choose a raise amount
 *
 * Number field, slider and quick amounts sized for the situation (big blinds
 * preflop, ×bet facing a raise, pot fractions postflop — see raisePresets()
 * in betting.js).
 * The amount is checked with validateRaise() on every keystroke; the confirm
 * button stays disabled and the reason is shown until the amount is legal.
 *
 * Every amount follows the chips / big blinds toggle (chipUnit.js); in big
 * blinds the amount is also typed in big blinds ("2,5"), turned back into
 * chips before validation.
 *
 * Usage (by ActionBar):
 *   const panel = new RaisePanel({ onConfirm: (to) => …, onCancel: () => … });
 *   bar.appendChild(panel.el);
 *   panel.open(turnState);  panel.close();  panel.isOpen
 */

import { legalActions, validateRaise, raisePresets, parseBB } from '../../../shared/poker/betting.js';
import { money, inBB, getBigBlind } from '../chipUnit.js';

export class RaisePanel {
  /**
   * @param {{ onConfirm: (to: number) => void, onCancel: () => void }} handlers
   *   onConfirm gets a legal "raise to" amount in chips; onCancel runs on
   *   Escape or "Annuler" (the bar gives the focus back to its button).
   */
  constructor({ onConfirm, onCancel }) {
    this._onConfirm = onConfirm;
    this._onCancel = onCancel;
    this._state = null;
    this._build();
  }

  get isOpen() {
    return this.el.classList.contains('open');
  }

  /** Open on the smallest legal raise. */
  open(state) {
    this._state = state;
    const legal = legalActions(state);
    if (!legal.raise) return;

    const { min, max } = legal.raise;
    this._slider.min  = String(min);
    this._slider.max  = String(max);
    this._slider.step = '1';
    this._slider.disabled = min === max;

    this.refreshLabel(state);
    this._drawPresets();
    this._setAmount(min);
    this.el.classList.add('open');
    this._input.focus();
    this._input.select();
  }

  close() {
    this.el.classList.remove('open');
  }

  /** "Miser" / "Relancer à", with the unit; the keyboard to show on phones. */
  refreshLabel(state) {
    this._state = state;
    const legal = legalActions(state);
    this._label.textContent = `${legal.isBet ? 'Miser' : 'Relancer à'}${inBB() ? ' (BB)' : ''}`;
    this._input.inputMode = inBB() ? 'decimal' : 'numeric';
  }

  /** Chips ↔ big blinds: redraw, keeping the chosen amount. */
  onUnitChange() {
    if (!this.isOpen) return;
    // The field is still written in the old unit: keep its last legal amount
    this._drawPresets();
    this._setAmount(this._lastLegal ?? this._exact);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _drawPresets() {
    this._presets.innerHTML = '';
    raisePresets(this._state).forEach(({ label, to }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wood-btn';
      b.dataset.to = String(to);
      const amount = money(to);
      b.innerHTML = amount === label ? label : `${label}<span class="sub">${amount}</span>`; // not "2,5 BB" twice
      b.addEventListener('click', () => this._setAmount(to));
      this._presets.appendChild(b);
    });
  }

  /** Write `to` (chips) in the field, in the current unit. */
  _setAmount(to) {
    this._exact = to;
    this._lastLegal = null;
    this._input.value = inBB()
      ? (to / getBigBlind()).toLocaleString('fr-FR', { maximumFractionDigits: 2, useGrouping: false })
      : String(to);
    this._shown = this._input.value;
    this._validate();
  }

  /** The field's amount in chips, or an error when it can't be read. */
  _readAmount() {
    const text = this._input.value;
    // Untouched since _setAmount: exact chips (a BB value shown may be rounded)
    if (text === this._shown) return validateRaise(this._state, this._exact, money);
    if (!inBB()) return validateRaise(this._state, text, money);
    if (text.trim() === '') return { ok: false, error: 'Entre un montant.' };
    const chips = parseBB(text, getBigBlind());
    if (chips === null) return { ok: false, error: 'Entre un nombre de grosses blindes, par exemple 2,5.' };
    return validateRaise(this._state, chips, money);
  }

  /** Re-check the typed amount; update slider, error text and confirm button. */
  _validate() {
    const result = this._readAmount();
    this._lastLegal = result.ok ? result.to : this._lastLegal;
    const legal  = legalActions(this._state);

    this._input.setAttribute('aria-invalid', String(!result.ok));
    this._error.textContent = result.ok ? '' : result.error;
    this._confirm.disabled = !result.ok;

    // Light up the quick amount matching the typed one, if any
    for (const b of this._presets.children) {
      b.setAttribute('aria-pressed', String(result.ok && Number(b.dataset.to) === result.to));
    }

    if (result.ok) {
      this._slider.value = String(result.to);
      const allIn = result.to === legal.raise.max;
      const verb  = legal.isBet ? 'Miser' : 'Relancer à';
      this._confirm.textContent = allIn ? `Tapis · ${money(result.to)}` : `${verb} ${money(result.to)}`;
    } else {
      this._confirm.textContent = legal.isBet ? 'Miser' : 'Relancer';
    }
    return result;
  }

  _confirmRaise() {
    const result = this._validate();
    if (!result.ok) {
      this._input.focus();
      return;
    }
    this._onConfirm(result.to);
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'raise-panel leather';
    el.id = 'raise-panel';
    el.innerHTML = `
      <div class="raise-row">
        <label class="raise-label saloon-label" for="raise-input">Relancer à</label>
        <input class="raise-input" id="raise-input" type="text" inputmode="numeric" autocomplete="off"
               aria-describedby="raise-error">
        <input class="raise-slider" type="range" aria-label="Montant">
      </div>
      <div class="raise-presets"></div>
      <div class="raise-error" id="raise-error" role="alert"></div>
      <div class="raise-confirm-row">
        <button type="button" class="raise-cancel wood-btn wood-btn--grey">Annuler</button>
        <button type="button" class="raise-confirm wood-btn wood-btn--gold">Relancer</button>
      </div>
    `;

    this.el       = el;
    this._label   = el.querySelector('.raise-label');
    this._input   = el.querySelector('.raise-input');
    this._slider  = el.querySelector('.raise-slider');
    this._presets = el.querySelector('.raise-presets');
    this._error   = el.querySelector('.raise-error');
    this._confirm = el.querySelector('.raise-confirm');

    this._input.addEventListener('input', () => this._validate());
    this._input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._confirmRaise();
      } else if (e.key === 'Escape') {
        e.stopPropagation(); // close the panel, don't open the pause menu
        this._onCancel();
      }
    });
    this._slider.addEventListener('input', () => this._setAmount(Number(this._slider.value)));
    el.querySelector('.raise-cancel').addEventListener('click', () => this._onCancel());
    this._confirm.addEventListener('click', () => this._confirmRaise());
  }
}
