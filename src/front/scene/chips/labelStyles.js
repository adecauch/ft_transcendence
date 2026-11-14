/**
 * labelStyles.js — CSS of the HTML labels floating over the table (each
 * seat's stack and bet, the pot, the hand shown at showdown). TableChips
 * places them on screen every frame.
 */

let injected = false;

/** Add the CSS to the page, once. */
export function injectChipLabelStyles() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    /* Saloon theme tags (see ui/theme/saloon.css) */
    .chip-labels {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      font-family: var(--font-ui);
    }
    .chip-label {
      position: absolute;
      left: 0;
      top: 0;
      transform: translate(-50%, -100%);
      white-space: nowrap;
      padding: 0.15rem 0.6rem;
      border-radius: 10px;
      background: linear-gradient(180deg, #fbe9c3, #d7b374);
      border: 3px solid var(--outline);
      box-shadow: 0 3px 0 var(--outline);
      color: var(--outline);
      font-size: 1rem;
      font-variant-numeric: tabular-nums;
      transition: opacity 200ms;
    }
    .chip-label b { color: var(--red-lo); font-weight: normal; }
    .chip-label.bet { font-size: 0.95rem; }
    .chip-label.pot {
      font-size: 1.15rem;
      background: linear-gradient(180deg, var(--gold-hi), var(--gold-lo));
    }
    .chip-label.pot b { color: var(--outline); }
    .chip-label.folded { opacity: 0.5; }
    .chip-label.cleared { opacity: 0; }
    .chip-label.out { opacity: 0.4; }
    .chip-label .hand {
      display: block;
      text-align: center;
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 0.85rem;
      color: var(--red-lo);
    }
    .chip-label[hidden] { display: none; }
  `;
  document.head.appendChild(style);
}
