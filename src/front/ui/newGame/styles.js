/**
 * styles.js — CSS of the new game menu (opponents, level, stacks, blinds).
 * Colours, wood and leather come from theme/saloon.css.
 */

let injectNewGameStylesDone = false;

/** Add the CSS to the page, once. */
export function injectNewGameStyles() {
  if (injectNewGameStylesDone) return;
  injectNewGameStylesDone = true;
  const style = document.createElement('style');
  style.textContent = `
    .start-menu {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      font-family: var(--font-ui);
      color: var(--cream);
    }

    .start-intro {
      display: flex;
      flex-direction: column;
      gap: .3rem;
      text-align: center;
    }

    .start-title {
      margin: 0;
      font-family: var(--font-ui);
      font-weight: 400;
      font-size: 1.7rem;
      color: var(--cream);
    }

    .start-subtitle {
      margin: 0;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.12rem;
      color: var(--cream-dim);
      text-shadow: 0 2px 0 var(--outline);
    }

    .start-block {
      display: flex;
      flex-direction: column;
      gap: .9rem;
      padding: 1rem;
    }

    .start-block-head,
    .start-setting {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: .7rem 1rem;
    }

    /* ── Segmented control: a row of wooden buttons ── */
    .seg {
      display: inline-flex;
      flex-wrap: wrap;
      gap: .5rem;
    }

    .seg .wood-btn {
      padding: .35rem .9rem;
      font-size: 1.2rem;
      font-variant-numeric: tabular-nums;
    }

    .seg--small .wood-btn {
      padding: .25rem .6rem;
      font-size: 1rem;
    }

    /* ── Opponent rows ── */
    .opponents {
      display: flex;
      flex-direction: column;
      gap: .7rem;
    }

    .opponent {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .6rem .9rem;
      padding: .6rem .7rem;
      background: rgba(255, 230, 180, .1);
      border: 3px solid rgba(0, 0, 0, .45);
      border-radius: 12px;
      animation: saloonPop 320ms var(--bounce) both;
    }

    .opponent-avatar {
      flex: none;
      width: 3.4rem;
      height: 3.4rem;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: radial-gradient(circle at 40% 35%, #fff8e6, #e6cf9f);
      border: 5px solid var(--brass);
      box-shadow: 0 0 0 3px var(--outline), 0 4px 0 3px var(--outline);
      font-size: 1.8rem;
      color: #1a1a1a;
    }

    .opponent-avatar[data-suit="♥"],
    .opponent-avatar[data-suit="♦"] { color: #c0302a; }

    .opponent-info {
      flex: 1 1 8rem;
      min-width: 0;
    }

    .opponent-name {
      font-size: 1.35rem;
      color: var(--cream);
    }

    .opponent-hint {
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1rem;
      color: var(--cream-dim);
    }

    .start-all {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .6rem;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.05rem;
      color: var(--cream-dim);
    }

    /* ── Table settings ── */
    .start-settings {
      display: flex;
      flex-direction: column;
      gap: .9rem;
    }

    .start-setting-label {
      font-size: 1.25rem;
      color: var(--cream);
    }

    /* ── Actions ── */
    /* Stays pinned to the bottom of the scrolling panel body on short screens */
    .start-actions {
      position: sticky;
      bottom: -1.8rem;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: .9rem;
      margin-inline: -1.6rem;
      padding: 1rem 1.6rem 1.8rem;
      margin-bottom: -1.8rem;
      background: linear-gradient(180deg, rgba(108, 64, 32, 0), var(--wood-lo) 35%);
    }

    .start-actions .wood-btn {
      padding: .6rem 1.4rem;
      font-size: 1.3rem;
    }

    .start-actions .start-go {
      padding: .7rem 1.8rem;
      font-size: 1.5rem;
    }

    @media (max-width: 480px) {
      .start-actions { margin-inline: -1rem; padding-inline: 1rem; }
      .opponent .seg { width: 100%; }
      .opponent .seg .wood-btn { flex: 1; }
    }
  `;
  document.head.appendChild(style);
}
