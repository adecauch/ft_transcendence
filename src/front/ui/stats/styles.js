/**
 * styles.js — CSS of the record book: the window, its tabs, and the pieces
 * several tabs use (tiles, rows, badges, mini cards). Each tab with a layout
 * of its own keeps it (dashboard/styles.js, tabs/solverTab.js).
 * Colours, wood and leather come from theme/saloon.css.
 */

let injected = false;

/** Add the CSS to the page, once. */
export function injectStatsStyles() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .stats {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: flex;
      padding: 4rem 16px 16px;
    }

    .stats-panel {
      width: min(860px, 100%);
      max-height: 100%;
      margin: 0 auto;
      padding: 1.2rem 1.6rem 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      animation: saloonPop 400ms var(--bounce) both;
    }

    .stats-head {
      display: flex;
      justify-content: center;
      margin-top: -3.7rem;
    }

    .stats-sign { font-size: clamp(1.7rem, 5vw, 2.3rem); margin: 0; }

    .stats-close {
      position: absolute;
      top: -1rem;
      right: -1rem;
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 50%;
      font-size: 1.5rem;
      z-index: 3;
    }

    .stats-tabs { display: flex; flex-wrap: wrap; gap: .6rem; }
    .stats-tabs .wood-btn { flex: 1 1 8rem; padding: .5rem .8rem; font-size: 1.3rem; }

    .stats-body {
      flex: 1;
      min-height: 12rem;
      overflow-y: auto;
      padding: 1.1rem;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.15rem;
      color: var(--cream);
    }

    .stats-body h3 {
      margin: 0 0 .8rem;
      font-family: var(--font-ui);
      font-weight: 400;
      font-size: 1.5rem;
    }

    .dim { color: var(--cream-dim); }
    .stats-empty { text-align: center; padding: 2rem 1rem; font-size: 1.25rem; }
    .stats-error { color: #ffc2b5; }

    /* ── Tiles (Statistiques, Face au solveur) ── */
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
      gap: .8rem;
    }

    .tile {
      padding: .8rem .9rem;
      background: rgba(255, 230, 180, .1);
      border: 3px solid rgba(0, 0, 0, .45);
      border-radius: 12px;
    }

    .tile-value {
      font-family: var(--font-ui);
      font-size: 2rem;
      color: var(--gold);
      text-shadow: 0 3px 0 var(--outline);
    }

    .tile-label { font-size: 1.05rem; }
    .tile-hint { font-size: .95rem; color: var(--cream-dim); }

    /* ── Historique ── */
    .rows { display: flex; flex-direction: column; gap: .6rem; }

    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .5rem 1rem;
      width: 100%;
      padding: .7rem .9rem;
      background: rgba(255, 230, 180, .1);
      border: 3px solid rgba(0, 0, 0, .45);
      border-radius: 12px;
      color: var(--cream);
      font: inherit;
      text-align: left;
    }

    button.row { cursor: pointer; transition: background 150ms, transform 200ms var(--bounce); }
    button.row:hover { background: rgba(255, 230, 180, .2); transform: translateY(-2px); }
    button.row:focus-visible { outline: 4px solid var(--focus); outline-offset: 2px; }

    .row-main { flex: 1 1 14rem; min-width: 0; }
    .row-title { font-family: var(--font-ui); font-size: 1.3rem; }
    .row-sub { font-size: 1rem; color: var(--cream-dim); }
    .row-net { font-family: var(--font-ui); font-size: 1.4rem; min-width: 5rem; text-align: right; }
    .plus { color: #9fe89a; }
    .minus { color: #ffb0a0; }

    .badge {
      padding: .15rem .7rem;
      border: 3px solid var(--outline);
      border-radius: 999px;
      font-family: var(--font-ui);
      font-size: 1.05rem;
      color: #fff;
      text-shadow: 0 2px 0 rgba(0, 0, 0, .45);
    }
    .badge.won  { background: var(--green-lo); }
    .badge.lost { background: var(--red-lo); }
    .badge.quit { background: #6b5a44; }

    .stats-more, .stats-back { align-self: center; padding: .45rem 1.3rem; font-size: 1.15rem; }
    .stats-back { align-self: flex-start; margin-bottom: .8rem; }

    .mini-card {
      display: inline-block;
      min-width: 2.3em;
      margin-right: .25em;
      padding: .05em .3em;
      border: 2px solid var(--outline);
      border-radius: 6px;
      background: #fffaf0;
      color: #151515;
      font-family: var(--font-ui);
      font-size: 1.1rem;
      text-align: center;
    }
    .mini-card.red { color: #c0201a; }

    .hand { padding: 0; overflow: hidden; }
    .hand > summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .4rem 1rem;
      padding: .7rem .9rem;
      cursor: pointer;
      list-style: none;
    }
    .hand > summary::-webkit-details-marker { display: none; }
    .hand > summary::before { content: '▸'; color: var(--gold); font-size: 1.3rem; }
    .hand[open] > summary::before { content: '▾'; }
    .hand > summary:focus-visible { outline: 4px solid var(--focus); outline-offset: -4px; }

    .moves { padding: 0 1rem 1rem 2.2rem; display: flex; flex-direction: column; gap: .5rem; }
    .moves-street { font-family: var(--font-ui); font-size: 1.15rem; color: var(--gold); }
    .moves-list { margin: 0; padding-left: 1.2rem; }
    .moves-list li { margin: .15rem 0; }
    .moves-end { color: var(--gold-hi); }

    /* ── Succès ── */
    .achievements {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
      gap: .8rem;
    }

    .achievement {
      display: flex;
      gap: .8rem;
      align-items: center;
      padding: .8rem;
      background: rgba(255, 230, 180, .12);
      border: 3px solid var(--gold);
      border-radius: 12px;
    }
    .achievement.locked { border-color: rgba(0, 0, 0, .45); background: rgba(0, 0, 0, .2); }
    .achievement.locked .achievement-icon { filter: grayscale(1) brightness(.7); }
    .achievement-icon { font-size: 2.4rem; line-height: 1; }
    .achievement-name { font-family: var(--font-ui); font-size: 1.25rem; }
    .achievement-desc { font-size: 1rem; color: var(--cream-dim); }

    /* ── Classement ── */
    .board { width: 100%; border-collapse: separate; border-spacing: 0 .4rem; }
    .board th { font-family: var(--font-ui); font-weight: 400; font-size: 1.1rem; color: var(--gold); text-align: left; padding: 0 .6rem; }
    .board td { padding: .55rem .6rem; background: rgba(255, 230, 180, .1); }
    .board td:first-child { border-radius: 10px 0 0 10px; font-family: var(--font-ui); font-size: 1.3rem; }
    .board td:last-child { border-radius: 0 10px 10px 0; }
    .board .num { text-align: right; font-variant-numeric: tabular-nums; }
    .board tr.me td { background: linear-gradient(180deg, var(--gold-hi), var(--gold-lo)); color: var(--outline); }
    .board tr.gap td { background: none; text-align: center; color: var(--cream-dim); padding: 0; }

    @media (max-width: 560px) {
      .stats-panel { padding-inline: .9rem; }
      .stats-body { padding: .8rem; }
      .board .hide-small { display: none; }
    }
  `;
  document.head.appendChild(style);
}
