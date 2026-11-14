/**
 * OptionsPanel.js — The "Options" page of the pause menu
 *
 * One row per entry of config/preferences.js: a title, one button per choice
 * (the chosen one is golden, aria-pressed) and a hint. Clicking a button
 * changes the option at once (ui/preferences.js); the views that use it
 * redraw themselves.
 *
 * Also handles the options' keyboard shortcuts (`key`), only while a game
 * runs and never while the player types in a field.
 */

import { PREFERENCES } from '../../config/preferences.js';
import { getPref, setPref, cyclePref, onPrefChange } from '../preferences.js';
import { injectOptionsStyles } from './styles.js';

export class OptionsPanel {
  /** @param {{ isInGame: () => boolean }} deps */
  constructor({ isInGame }) {
    injectOptionsStyles();
    this._isInGame = isInGame;
    this.el = this._build();
    onPrefChange(() => this._draw());

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !this._isInGame()) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return; // typing an amount
      const pref = PREFERENCES.find((p) => p.key?.toLowerCase() === e.key.toLowerCase());
      if (pref) cyclePref(pref.id);
    });
  }

  /** Focus the first choice (when the page opens). */
  focus() {
    this.el.querySelector('button')?.focus();
  }

  _build() {
    const list = document.createElement('div');
    list.className = 'options-list';
    for (const pref of PREFERENCES) {
      const row = document.createElement('div');
      row.className = 'option-row leather';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-labelledby', `option-${pref.id}`);

      const title = document.createElement('span');
      title.className = 'saloon-label';
      title.id = `option-${pref.id}`;
      title.textContent = pref.label;

      const choices = document.createElement('div');
      choices.className = 'option-choices';
      for (const choice of pref.choices) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'wood-btn';
        b.dataset.pref = pref.id;
        b.dataset.value = choice.value;
        b.textContent = choice.label;
        b.addEventListener('click', () => setPref(pref.id, choice.value));
        choices.appendChild(b);
      }
      row.append(title, choices);

      if (pref.hint || pref.key) {
        const hint = document.createElement('p');
        hint.className = 'option-hint';
        hint.textContent = pref.hint ?? '';
        if (pref.key) {
          const key = document.createElement('span');
          key.className = 'saloon-key';
          key.textContent = pref.key;
          hint.append(pref.hint ? ' Raccourci en partie : ' : 'Raccourci en partie : ', key);
        }
        row.appendChild(hint);
      }
      list.appendChild(row);
    }
    this._list = list;
    this._draw();
    return list;
  }

  _draw() {
    for (const b of this._list.querySelectorAll('button[data-pref]')) {
      b.setAttribute('aria-pressed', String(getPref(b.dataset.pref) === b.dataset.value));
    }
  }
}
