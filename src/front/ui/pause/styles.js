/**
 * styles.js — CSS of the pause menu (the ☰ button and its window) and of
 * the options panel shown inside it.
 * Colours, wood and leather come from theme/saloon.css.
 */

let injectPauseStylesDone = false;

/** Add the CSS to the page, once. */
export function injectPauseStyles() {
  if (injectPauseStylesDone) return;
  injectPauseStylesDone = true;
  const style = document.createElement('style');
  style.textContent = `
    .game-menu-btn {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 20;
      display: none;
      align-items: center;
      gap: .6rem;
      padding: .5rem 1.1rem .5rem .85rem;
      font-size: 1.3rem;
    }

    .game-menu-btn.visible { display: inline-flex; }

    .game-menu-icon {
      display: inline-flex;
      flex-direction: column;
      gap: 4px;
    }

    .game-menu-icon span {
      display: block;
      width: 20px;
      height: 3px;
      background: currentColor;
      border-radius: 2px;
    }

    .pause-backdrop {
      position: fixed;
      inset: 0;
      z-index: 30;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }

    .pause-backdrop.visible {
      display: flex;
      animation: pauseFade 200ms ease-out both;
    }

    @keyframes pauseFade {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .pause-panel {
      width: min(400px, 100%);
      margin-top: 2.4rem;
      padding: 1.4rem 1.8rem 1.8rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.2rem;
      text-align: center;
      animation: saloonPop 380ms var(--bounce) both;
    }

    .pause-title {
      margin: -4rem 0 0;
      font-size: 2.4rem;
    }

    .pause-subtitle {
      margin: 0;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.15rem;
      color: var(--cream);
      text-shadow: 0 2px 0 var(--outline);
    }

    .pause-actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: .9rem;
    }

    .pause-actions .wood-btn {
      width: 100%;
      padding: .7rem 1rem;
      font-size: 1.4rem;
    }

    .pause-view {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.2rem;
    }

    .pause-view[hidden] { display: none; }

    .pause-back {
      align-self: stretch;
      padding: .6rem 1rem;
      font-size: 1.3rem;
    }

    .pause-hint {
      margin: 0;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.05rem;
      color: var(--cream-dim);
    }
  `;
  document.head.appendChild(style);
}

let injectOptionsStylesDone = false;

/** Add the CSS to the page, once. */
export function injectOptionsStyles() {
  if (injectOptionsStylesDone) return;
  injectOptionsStylesDone = true;
  const style = document.createElement('style');
  style.textContent = `
    .options-list {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .option-row {
      display: flex;
      flex-direction: column;
      gap: .6rem;
      padding: .9rem 1rem 1rem;
      text-align: left;
    }

    .option-choices {
      display: flex;
      flex-wrap: wrap;
      gap: .6rem;
    }

    .option-choices .wood-btn {
      flex: 1 1 8rem;
      padding: .55rem .7rem;
      font-size: 1.2rem;
    }

    .option-hint {
      margin: 0;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.05rem;
      color: var(--cream-dim);
    }
  `;
  document.head.appendChild(style);
}
