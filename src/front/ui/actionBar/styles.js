/**
 * styles.js — CSS of the betting controls: the bar, the one-click bets, its
 * three buttons, the raise panel and the end-of-hand message.
 * Colours, wood and leather come from theme/saloon.css.
 */

let injected = false;

/** Add the CSS to the page, once. */
export function injectActionBarStyles() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .action-bar {
      position: fixed;
      left: 50%;
      bottom: 24px;
      z-index: 15;
      width: min(620px, calc(100vw - 32px));
      transform: translate(-50%, 24px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 200ms ease, transform 300ms var(--bounce);
      font-family: var(--font-ui);
      color: var(--cream);
    }

    .action-bar.visible {
      opacity: 1;
      transform: translate(-50%, 0);
      pointer-events: auto;
    }

    .action-card {
      padding: 1rem 1.2rem 1.4rem;
    }

    .action-actions,
    .action-message {
      position: relative;
      z-index: 1;
    }

    .action-timer {
      text-align: center;
      font-size: 1.6rem;
      color: var(--cream);
      text-shadow: 0 2px 0 var(--outline);
      padding-bottom: .4rem;
    }

    .action-timer.urgent {
      color: var(--red-hi);
      font-size: 1.9rem;
    }

    .action-timer[hidden] { display: none; }

    .action-note {
      text-align: center;
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 1.1rem;
      color: var(--gold);
      text-shadow: 0 2px 0 var(--outline);
      padding-bottom: .5rem;
    }

    .action-info {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: .4rem 1.4rem;
      padding: 0 0 .9rem;
      font-size: 1.15rem;
      color: var(--cream-dim);
      text-shadow: 0 2px 0 var(--outline);
      font-variant-numeric: tabular-nums;
    }

    .action-info b {
      color: var(--gold);
      font-weight: 400;
    }

    .action-buttons {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: .7rem;
    }

    .action-btn {
      min-height: 3.9rem;
      padding: .45rem .4rem;
      font-size: 1.35rem;
      font-variant-numeric: tabular-nums;
    }

    .action-btn .sub {
      display: block;
      margin-top: .15rem;
      font-size: 1rem;
      opacity: .9;
    }

    /* One-click bets: one row, every button the same width */
    .action-quick {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      gap: .5rem;
      margin-bottom: .7rem;
    }

    .action-quick[hidden] { display: none; }

    .action-quick .wood-btn {
      min-height: 3.2rem;
      padding: .3rem .25rem;
      font-size: 1.2rem;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .action-quick .sub {
      display: block;
      font-size: .95rem;
      opacity: .9;
    }

    /* All-in stands out: one click puts the whole stack in */
    .action-quick .quick-allin {
      outline: 4px solid var(--red-lo);
      outline-offset: -8px;
    }

    .action-raise[aria-expanded="true"] {
      transform: translateY(4px);
      box-shadow: inset 0 3px 0 rgba(255, 255, 255, .4), 0 1px 0 var(--outline);
    }

    /* ── Raise panel ── */
    .raise-panel {
      display: none;
      flex-direction: column;
      gap: .8rem;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .raise-panel.open {
      display: flex;
      animation: saloonPop 260ms var(--bounce) both;
    }

    .raise-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .8rem;
    }

    .raise-label { white-space: nowrap; }

    .raise-input {
      width: 8rem;
      padding: .4rem .7rem;
      border: 4px solid var(--outline);
      border-radius: 10px;
      background: var(--cream);
      color: var(--outline);
      box-shadow: inset 0 3px 0 rgba(0, 0, 0, .18);
      font-family: var(--font-ui);
      font-size: 1.4rem;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .raise-input[aria-invalid="true"] {
      border-color: var(--red-lo);
      background: #ffd9cf;
    }

    .raise-slider {
      flex: 1 1 8rem;
      min-width: 0;
      height: 1.8rem;
      accent-color: var(--gold);
      cursor: pointer;
    }

    /* Rows fill up: a lone last button (often "Tapis") stretches */
    .raise-presets {
      display: flex;
      flex-wrap: wrap;
      gap: .6rem;
    }

    .raise-presets .wood-btn {
      flex: 1 1 6.2rem;
      padding: .3rem .4rem;
      font-size: 1.15rem;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .raise-presets .sub {
      display: block;
      font-size: .95rem;
      opacity: .8;
    }

    .raise-presets .wood-btn[aria-pressed="true"] .sub { opacity: 1; }

    .raise-error {
      min-height: 1.3em;
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 1.05rem;
      color: #ffb4a6;
      text-shadow: 0 2px 0 var(--outline);
    }

    .raise-confirm-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: .7rem;
    }

    .raise-confirm-row .wood-btn {
      padding: .5rem 1.2rem;
      font-size: 1.2rem;
      font-variant-numeric: tabular-nums;
    }

    .raise-input:focus-visible,
    .raise-slider:focus-visible {
      outline: 4px solid var(--focus);
      outline-offset: 3px;
    }

    .action-message {
      text-align: center;
      padding: .3rem 0 .1rem;
      font-size: 1.4rem;
      text-shadow: 0 2px 0 var(--outline);
    }

    .action-message .wood-btn {
      margin-top: .9rem;
      padding: .6rem 1.6rem;
      font-size: 1.35rem;
      text-shadow: none;
    }

    @media (max-width: 480px) {
      .action-bar { bottom: 14px; }
      .action-card { padding-inline: .7rem; }
      .action-btn { font-size: 1.1rem; }
      .action-btn .sub { font-size: .85rem; }
      .action-quick .wood-btn { font-size: 1rem; }
      .action-quick .sub { font-size: .8rem; }
      .raise-slider { flex-basis: 100%; }
    }
  `;
  document.head.appendChild(style);
}
