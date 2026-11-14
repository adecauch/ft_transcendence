/**
 * FriendsMenu.js — The friends window, "Mes amis" (saloon theme)
 *
 * Opened from the badge (UserBadge, "👥 Amis"), logged-in players only. This
 * file is the window and the switching between tabs; each tab is a file of
 * tabs/:
 *   👥 Mes amis    tabs/friendsTab.js   online / at a table / offline, invite, remove
 *   📨 Demandes    tabs/requestsTab.js  received (accept, refuse), sent (cancel)
 *   ➕ Ajouter     tabs/addTab.js       search a player, send a request
 *
 * Same frame as the record book (StatsMenu: its CSS classes stats-*), and the
 * same tab contract: { id, label, open(view) } returns HTML, or { html, bind }.
 * bind() gets the tab's own element (new at every opening: its listeners go
 * with it). The view gives the tabs:
 *   get(call)          an API call; a failure is shown in the tab
 *   act(call, done)    a change (accept, remove…): runs it, says `done` (or
 *                      done(data)) or the error on the status line, then redraws the tab
 *   say(text, error?)  the status line under the tabs
 *   refresh() · open(id)
 *
 * Data: net/friendsApi.js (server/src/friends); redrawn by refresh() when the
 * live stream says something changed (main.js, net/socialLive.js).
 * onChange() runs after every change (the badge recounts who is online).
 * Under the tabs: the player's own friend code (Pseudo#1234), to copy and
 * send to a friend.
 */

import { injectStatsStyles } from '../stats/styles.js';
import { injectFriendsStyles } from './styles.js';
import { esc } from './html.js';
import { friendCode } from '../../../shared/auth/rules.js';
import { friendsApi } from '../../net/friendsApi.js';
import { friendsTab } from './tabs/friendsTab.js';
import { requestsTab } from './tabs/requestsTab.js';
import { addTab } from './tabs/addTab.js';

const TABS = [friendsTab, requestsTab, addTab];

export class FriendsMenu {
  /**
   * @param {{ onChange?: () => void, getUser?: () => { username: string, tag: number } | null,
   *           getTableId?: () => string | null }} [options] — getTableId: the shared table the
   *   player waits at (its code), so « Inviter » invites there
   */
  constructor({ onChange, getUser = () => null, getTableId = () => null } = {}) {
    injectStatsStyles();
    injectFriendsStyles();
    this.onChange = onChange;
    this.getUser = getUser;
    this.getTableId = getTableId;
    this._root = null;
    this._tab = null;
    // Escape closes this window only, not the pause menu under it (it is open
    // from a shared table's waiting room, already "in game"): capture + stop
    this._onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      this.hide();
    };
    const menu = this;
    this._view = {
      get: (call) => this._get(call),
      act: (call, done) => this._act(call, done),
      say: (text, error) => this._say(text, error),
      refresh: () => this._open(this._tab.id, { keepStatus: true }),
      open: (id) => this._open(id),
      get tableId() { return menu.getTableId(); },
    };
  }

  /** @param {string} [tab] — id of the tab to open ('friends' by default) */
  show(tab = 'friends') {
    if (!this._root) this._build();
    const user = this.getUser();
    this._root.querySelector('.friends-code').hidden = !user;
    if (user) this._root.querySelector('.friends-code-value').textContent = friendCode(user);
    this._open(tab);
  }

  /** Something changed on the server (live stream): redraw the open tab, if any. */
  refresh() {
    if (this._root && this._tab) this._view.refresh();
  }

  hide() {
    this._root?.remove();
    this._root = null;
    window.removeEventListener('keydown', this._onKey, true);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build() {
    const root = document.createElement('div');
    root.className = 'stats friends saloon-backdrop';
    root.innerHTML = `
      <div class="stats-panel wood-panel" role="dialog" aria-modal="true" aria-labelledby="friends-title">
        <button type="button" class="stats-close wood-btn wood-btn--red" aria-label="Fermer">✕</button>
        <div class="stats-head"><h2 id="friends-title" class="stats-sign wood-sign saloon-ol">Mes amis</h2></div>
        <div class="stats-tabs" role="tablist">
          ${TABS.map((t) => `<button type="button" role="tab" class="wood-btn" data-tab="${t.id}">${t.label}<span class="friends-count" hidden></span></button>`).join('')}
        </div>
        <p class="friends-code" hidden>Ton code ami : <b class="friends-code-value"></b>
          <button type="button" class="wood-btn wood-btn--gold friends-copy">📋 Copier</button></p>
        <p class="friends-status" role="status" aria-live="polite" hidden></p>
        <div class="stats-body leather saloon-scroll" role="tabpanel" tabindex="-1"></div>
      </div>`;
    document.body.appendChild(root);
    this._root = root;
    this._body = root.querySelector('.stats-body');
    this._status = root.querySelector('.friends-status');
    this._tabs = [...root.querySelectorAll('[data-tab]')];

    root.querySelector('.stats-close').addEventListener('click', () => this.hide());
    root.addEventListener('click', (e) => { if (e.target === root) this.hide(); });
    this._tabs.forEach((t) => t.addEventListener('click', () => this._open(t.dataset.tab)));
    root.querySelector('.friends-copy').addEventListener('click', () => this._copyCode());
    window.addEventListener('keydown', this._onKey, true);
    root.querySelector('.stats-close').focus();
  }

  async _open(id, { keepStatus = false } = {}) {
    const tab = TABS.find((t) => t.id === id) ?? TABS[0];
    this._tab = tab;
    if (!keepStatus) this._say('');
    this._tabs.forEach((t) => {
      const on = t.dataset.tab === tab.id;
      t.setAttribute('aria-pressed', String(on));
      t.setAttribute('aria-selected', String(on));
    });
    this._counts();

    const body = this._body;
    const token = (this._token = {});
    body.innerHTML = '<p class="stats-empty dim">Chargement…</p>';
    let result;
    try {
      result = await tab.open(this._view);
    } catch (err) {
      result = `<p class="stats-empty stats-error">⚠ ${esc(err.message)}</p>`;
    }
    if (token !== this._token || !this._root) return; // another tab was opened meanwhile
    const el = document.createElement('div');
    el.innerHTML = typeof result === 'string' ? result : result.html;
    body.replaceChildren(el);
    if (typeof result === 'object') result.bind?.(el);
  }

  /** Numbers on the tabs: friends online, requests received. */
  async _counts() {
    const [list, requests] = await Promise.all([friendsApi.list(), friendsApi.requests()]);
    if (!this._root) return;
    const online = list.ok ? list.data.friends.filter((f) => f.status !== 'offline').length : 0;
    const asking = requests.ok ? requests.data.incoming.length : 0;
    this._setCount('friends', online, `${online} en ligne`);
    this._setCount('requests', asking, `${asking} reçue${asking > 1 ? 's' : ''}`);
  }

  _setCount(id, n, title) {
    const badge = this._tabs.find((t) => t.dataset.tab === id)?.querySelector('.friends-count');
    if (!badge) return;
    badge.hidden = !n;
    badge.textContent = String(n);
    badge.title = title;
    badge.classList.toggle('friends-count--online', id === 'friends'); // green: good news, not an alert
  }

  /** Call the API; a failure becomes an error shown in the tab. */
  async _get(call) {
    const res = await call();
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }

  async _act(call, done) {
    const res = await call();
    if (!this._root) return;
    this._say(res.ok ? (typeof done === 'function' ? done(res.data) : done) : res.error, !res.ok);
    if (res.ok) this.onChange?.();
    this._view.refresh();
  }

  /** The player's friend code to the clipboard (to paste in a message to a friend). */
  async _copyCode() {
    const user = this.getUser();
    if (!user) return;
    try {
      await navigator.clipboard.writeText(friendCode(user));
      this._say(`Code copié : ${friendCode(user)}. Envoie-le à un ami pour qu’il t’ajoute.`);
    } catch {
      this._say(`Copie impossible ici : recopie ${friendCode(user)} à la main.`, true);
    }
  }

  _say(text, error = false) {
    if (!this._status) return;
    this._status.textContent = text;
    this._status.hidden = !text;
    this._status.classList.toggle('friends-status--error', error);
  }
}
