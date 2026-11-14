/**
 * AchievementToast.js — "Succès débloqué !" announcements, top centre
 *
 * A gold plaque drops in for each new achievement (GameRecorder gets the ids
 * in the server's answer), stays TOAST_TIME seconds, then slides away.
 * Several in a row stack up.
 */

import { ACHIEVEMENTS } from '../../shared/stats/achievements.js';

const TOAST_TIME = 5000; // ms

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .toasts {
      position: fixed;
      top: 16px;
      left: 50%;
      z-index: 40;
      transform: translateX(-50%);
      width: min(520px, calc(100vw - 32px));
      display: flex;
      flex-direction: column;
      gap: .8rem;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: .7rem 1.2rem;
      transform: rotate(-1deg);
      animation: toastIn 500ms var(--bounce) both;
    }

    .toast.leaving { animation: toastOut 350ms ease-in both; }

    @keyframes toastIn  { from { transform: translateY(-60px) scale(.8); opacity: 0; } to { transform: rotate(-1deg); opacity: 1; } }
    @keyframes toastOut { to { transform: translateY(-40px) scale(.9); opacity: 0; } }

    .toast-icon {
      flex: none;
      font-size: 2.6rem;
      line-height: 1;
      filter: drop-shadow(0 3px 0 var(--outline));
    }

    .toast-text { text-align: left; }

    .toast-title {
      font-family: var(--font-ui);
      font-size: 1.05rem;
      color: var(--outline);
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    .toast-name {
      font-family: var(--font-title);
      font-size: 1.6rem;
      line-height: 1.1;
    }

    .toast-desc {
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 1.05rem;
      color: var(--outline);
    }
  `;
  document.head.appendChild(style);
}

export class AchievementToast {
  constructor() {
    injectStyles();
    this._box = document.createElement('div');
    this._box.className = 'toasts';
    this._box.setAttribute('role', 'status');
    document.body.appendChild(this._box);
  }

  /** @param {string[]} ids */
  show(ids) {
    for (const id of ids) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a) continue;
      const el = document.createElement('div');
      el.className = 'toast wood-sign';
      el.innerHTML = `
        <span class="toast-icon" aria-hidden="true"></span>
        <span class="toast-text">
          <span class="toast-title">Succès débloqué !</span><br>
          <span class="toast-name saloon-ol"></span><br>
          <span class="toast-desc"></span>
        </span>`;
      el.querySelector('.toast-icon').textContent = a.icon;
      el.querySelector('.toast-name').textContent = a.name;
      el.querySelector('.toast-desc').textContent = a.description;
      this._box.appendChild(el);
      setTimeout(() => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 350);
      }, TOAST_TIME);
    }
  }
}
