/**
 * UserBadge.js — Who is playing, top right of the room
 *
 *   🤠 alice#4821  [Ranges] [Amis ● 2] [Mes stats] [Déconnexion]   logged in (#4821: friend code)
 *   🤠 Invité  [Ranges] [Se connecter]                         guest
 * "Ranges" opens the range chart (event `ranges:open`, main.js); "Amis" the
 * friends window, with how many friends are online (setOnline()).
 *
 * Hidden during a game (the pause menu sits top left; the table needs the room).
 * The buttons call back to main.js: reopen the AuthScreen, open the StatsMenu.
 * onUser(user | null) runs whenever the player changes (login, logout, guest).
 */

import { authApi } from '../net/authApi.js';
import { friendCode } from '../../shared/auth/rules.js';

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .user-badge {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 20;
      display: none;
      align-items: center;
      gap: .8rem;
      padding: .45rem .55rem .45rem 1rem;
      border-radius: 14px;
      animation: saloonPop 350ms var(--bounce) both;
    }

    .user-badge.visible { display: inline-flex; }
    .user-badge::before { display: none; } /* no rivets on something this small */

    .user-badge-name {
      max-width: 14rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 1.35rem;
      color: var(--cream);
    }

    .user-badge .wood-btn {
      padding: .35rem .9rem;
      font-size: 1.1rem;
    }

    .user-badge .wood-btn[hidden] { display: none; }
    .user-badge-tag { color: var(--gold); margin-left: .1rem; }
    .user-badge-online {
      margin-left: .45rem;
      padding: 0 .45rem;
      border-radius: 1rem;
      border: 2px solid var(--outline);
      background: var(--green-lo);
      color: var(--cream);
    }

    .user-badge-online[hidden] { display: none; }
  `;
  document.head.appendChild(style);
}

export class UserBadge {
  /** @param {{ onSignIn: () => void, onStats: () => void, onFriends: () => void, onUser?: (user: object | null) => void }} options */
  constructor({ onSignIn, onStats, onFriends, onUser }) {
    injectStyles();
    this.onSignIn = onSignIn;
    this.onUser = onUser;
    this.user = null;
    this._shown = false;
    this._inGame = false;

    const el = document.createElement('div');
    el.className = 'user-badge wood-panel';
    el.innerHTML = `
      <span class="user-badge-name saloon-ol"></span>
      <button type="button" class="user-badge-ranges wood-btn">📖 Ranges</button>
      <button type="button" class="user-badge-friends wood-btn">👥 Amis<span class="user-badge-online" hidden></span></button>
      <button type="button" class="user-badge-stats wood-btn wood-btn--gold">📊 Mes stats</button>
      <button type="button" class="user-badge-account wood-btn"></button>`;
    document.body.appendChild(el);
    this._el = el;
    this._name = el.querySelector('.user-badge-name');
    el.querySelector('.user-badge-ranges').addEventListener('click', () => window.dispatchEvent(new CustomEvent('ranges:open')));
    this._friends = el.querySelector('.user-badge-friends');
    this._friends.addEventListener('click', () => onFriends());
    this._online = el.querySelector('.user-badge-online');
    this._stats = el.querySelector('.user-badge-stats');
    this._stats.addEventListener('click', () => onStats());
    this._button = el.querySelector('.user-badge-account');
    this._button.addEventListener('click', () => this._onButton());

    window.addEventListener('game:start', () => { this._inGame = true; this._refresh(); });
    window.addEventListener('game:quit',  () => { this._inGame = false; this._refresh(); });
  }

  /** @param {object | null} user — null = guest */
  set(user) {
    this.user = user;
    this._shown = true;
    this._name.textContent = `🤠 ${user ? user.username : 'Invité'}`;
    if (user) {
      const tag = document.createElement('span');
      tag.className = 'user-badge-tag';
      tag.textContent = `#${user.tag}`;
      this._name.append(tag);
      this._name.title = `Ton code ami : ${friendCode(user)}`;
    } else this._name.title = '';
    this._button.textContent = user ? 'Déconnexion' : 'Se connecter';
    this._button.className = `user-badge-account wood-btn ${user ? 'wood-btn--grey' : 'wood-btn--gold'}`;
    this._stats.hidden = !user;
    this._friends.hidden = !user;
    this.setOnline(0);
    this._refresh();
    this.onUser?.(user);
  }

  /** How many friends are online, next to "Amis" (0: nothing shown). */
  setOnline(n) {
    this._online.hidden = !n;
    this._online.textContent = `● ${n}`;
    this._friends.title = n ? `${n} ami${n > 1 ? 's' : ''} en ligne` : '';
  }

  hide() {
    this._shown = false;
    this._refresh();
  }

  async _onButton() {
    if (this.user) {
      this._button.disabled = true;
      await authApi.logout(); // even if it fails, forget the user here
      this._button.disabled = false;
      this.user = null;
      this.onUser?.(null);
    }
    this.hide();
    this.onSignIn();
  }

  _refresh() {
    this._el.classList.toggle('visible', this._shown && !this._inGame);
  }
}
