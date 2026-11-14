/**
 * StatsMenu.js — The player's record book, "Mon carnet" (saloon theme)
 *
 * Opened from the badge (UserBadge, "Mes stats"). This file is only the
 * window and the switching between tabs; each tab is a file of tabs/:
 *   Statistiques     tabs/totalsTab.js
 *   Tableau de bord  tabs/dashboardTab.js (dashboard/: charts, filters, CSV / PDF, live)
 *   Historique       tabs/historyTab.js (games → hands → moves, tabs/handHtml.js)
 *   Succès           tabs/achievementsTab.js
 *   Face au solveur  tabs/solverTab.js (PDF: pdf/solverPdf.js)
 *   Classement       tabs/leaderboardTab.js
 *
 * A tab is { id, label, wide?, open(view), close()? }. open() gets the view
 * ({ body, get, load }) and returns what to show:
 *   a string      HTML, put in the body
 *   { html, bind } HTML, then bind(body) to add its listeners
 *   null          the tab drew the body itself
 * close() (if any) runs when another tab opens or the book closes (the
 * dashboard stops its live stream there).
 *
 * Everything comes from the server (gamesApi.js); shared helpers and the
 * escaping of names are in format.js, the CSS in styles.js.
 */

import { injectStatsStyles } from './styles.js';
import { esc } from './format.js';
import { totalsTab } from './tabs/totalsTab.js';
import { dashboardTab } from './tabs/dashboardTab.js';
import { historyTab } from './tabs/historyTab.js';
import { achievementsTab } from './tabs/achievementsTab.js';
import { solverTab } from './tabs/solverTab.js';
import { leaderboardTab } from './tabs/leaderboardTab.js';

const TABS = [totalsTab, dashboardTab, historyTab, achievementsTab, solverTab, leaderboardTab];

export class StatsMenu {
  constructor() {
    injectStatsStyles();
    this._root = null;
    this._tab = null;
    this._onKey = (e) => { if (e.key === 'Escape') this.hide(); };
    // What a tab may use: its body, the API helper, the loader
    const menu = this;
    this._view = {
      get body() { return menu._body; },
      get: (call) => this._get(call),
      load: (loader) => this._load(loader),
    };
  }

  /** @param {string} [tab] — id of the tab to open ('stats' by default) */
  show(tab = 'stats') {
    if (!this._root) this._build();
    this._open(tab);
  }

  hide() {
    this._closeTab();
    this._root?.remove();
    this._root = null;
    window.removeEventListener('keydown', this._onKey);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build() {
    const root = document.createElement('div');
    root.className = 'stats saloon-backdrop';
    root.innerHTML = `
      <div class="stats-panel wood-panel" role="dialog" aria-modal="true" aria-labelledby="stats-title">
        <button type="button" class="stats-close wood-btn wood-btn--red" aria-label="Fermer">✕</button>
        <div class="stats-head"><h2 id="stats-title" class="stats-sign wood-sign saloon-ol">Mon carnet</h2></div>
        <div class="stats-tabs" role="tablist">
          ${TABS.map((t) => `<button type="button" role="tab" class="wood-btn" data-tab="${t.id}">${t.label}</button>`).join('')}
        </div>
        <div class="stats-body leather saloon-scroll" role="tabpanel" tabindex="-1"></div>
      </div>`;
    document.body.appendChild(root);
    this._root = root;
    this._body = root.querySelector('.stats-body');
    this._tabs = [...root.querySelectorAll('[data-tab]')];

    root.querySelector('.stats-close').addEventListener('click', () => this.hide());
    root.addEventListener('click', (e) => { if (e.target === root) this.hide(); });
    this._tabs.forEach((t) => t.addEventListener('click', () => this._open(t.dataset.tab)));
    window.addEventListener('keydown', this._onKey);
    root.querySelector('.stats-close').focus();
  }

  _open(id) {
    const tab = TABS.find((t) => t.id === id) ?? TABS[0];
    this._closeTab();
    this._tab = tab;
    this._root.querySelector('.stats-panel').classList.toggle('stats-panel--wide', Boolean(tab.wide));
    this._tabs.forEach((t) => {
      const on = t.dataset.tab === tab.id;
      t.setAttribute('aria-pressed', String(on));
      t.setAttribute('aria-selected', String(on));
    });
    this._load(() => tab.open(this._view));
  }

  _closeTab() {
    this._tab?.close?.();
    this._tab = null;
  }

  /** Show "Chargement…", run the loader, show what it returns (or the error). */
  async _load(loader) {
    const body = this._body;
    const token = (this._token = {});
    body.innerHTML = '<p class="stats-empty dim">Chargement…</p>';
    let result;
    try {
      result = await loader();
    } catch (err) {
      result = `<p class="stats-empty stats-error">⚠ ${esc(err.message)}</p>`;
    }
    if (token !== this._token || !this._root) return; // another tab was opened meanwhile
    if (typeof result === 'string') body.innerHTML = result;
    else if (result) {
      body.innerHTML = result.html;
      result.bind?.(body);
    }
    body.scrollTop = 0;
  }

  /** Call the API; a failure becomes an error shown in the tab. */
  async _get(call) {
    const res = await call();
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }
}
