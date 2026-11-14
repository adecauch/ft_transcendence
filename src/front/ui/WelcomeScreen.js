/**
 * WelcomeScreen.js — First screen: title, controls, "Entrer dans la salle"
 *
 * Saloon theme (see ui/theme/saloon.css). Removed from the DOM once the
 * player enters the room; `onEnter` then runs (main.js: log in or not).
 */

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    .welcome {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      pointer-events: none;
    }

    .welcome-panel {
      width: min(540px, 100%);
      margin-top: 2.4rem;
      padding: 1.6rem 2rem 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.3rem;
      text-align: center;
      pointer-events: auto;
      animation: saloonPop 450ms var(--bounce) backwards; /* no fill after: .leaving must win */
      transition: opacity 400ms ease, transform 400ms ease;
    }

    .welcome-panel.leaving {
      opacity: 0;
      transform: scale(.9);
    }

    .welcome-sign {
      margin: -4.4rem 0 0;
      font-size: clamp(2rem, 7vw, 2.8rem);
    }

    .welcome-subtitle {
      margin: 0;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.15rem;
      color: var(--cream);
      text-shadow: 0 2px 0 var(--outline);
    }

    .welcome-controls {
      width: 100%;
      margin: 0;
      padding: 1rem 1.2rem;
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: .8rem 1rem;
      text-align: left;
    }

    .welcome-controls dt { justify-self: end; }

    .welcome-controls dd {
      margin: 0;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--cream);
    }

    .welcome-enter {
      padding: .75rem 2rem;
      font-size: 1.6rem;
    }

    @media (max-width: 480px) {
      .welcome-panel { padding-inline: 1rem; }
      .welcome-controls { grid-template-columns: 1fr; gap: .3rem; }
      .welcome-controls dt { justify-self: start; margin-top: .5rem; }
    }
  `;
  document.head.appendChild(style);
}

export class WelcomeScreen {
  /** @param {{ onEnter?: () => void }} [options] */
  constructor({ onEnter } = {}) {
    injectStyles();
    this.onEnter = onEnter;
    this._build();
  }

  _build() {
    const overlay = document.createElement('div');
    overlay.className = 'welcome';

    const panel = document.createElement('div');
    panel.className = 'welcome-panel wood-panel';
    panel.innerHTML = `
      <h1 class="welcome-sign wood-sign saloon-ol">Poker Transcendence</h1>
      <p class="welcome-subtitle">Texas Hold'em contre des intelligences artificielles</p>
      <dl class="welcome-controls leather">
        <dt><span class="saloon-key">Clic gauche</span></dt><dd>Tourner la caméra</dd>
        <dt><span class="saloon-key">Molette</span></dt><dd>Zoomer / dézoomer</dd>
        <dt><span class="saloon-key">Clic sur la carte</span></dt><dd>Lancer une partie</dd>
      </dl>
      <button type="button" class="welcome-enter wood-btn wood-btn--red">Entrer dans la salle</button>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    panel.querySelector('.welcome-enter').addEventListener('click', () => {
      panel.classList.add('leaving');
      setTimeout(() => overlay.remove(), 400);
      this.onEnter?.();
    });
  }
}
