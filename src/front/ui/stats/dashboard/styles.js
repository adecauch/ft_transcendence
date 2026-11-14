/**
 * styles.js — Layout of the dashboard tab (colours and buttons: theme/saloon.css,
 * tiles: StatsMenu). Big and contrasted, like the rest of the menus.
 */

let injected = false;

export function injectDashboardStyles() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .stats-panel.stats-panel--wide { width: min(1240px, 100%); }

    .dash { display: flex; flex-direction: column; gap: 1rem; }

    .dash-filters { display: flex; flex-wrap: wrap; gap: .7rem 1rem; align-items: center; }
    .dash-periods, .dash-streets { display: flex; flex-wrap: wrap; gap: .5rem; }
    .dash-periods .wood-btn, .dash-streets .wood-btn { padding: .4rem .9rem; font-size: 1.15rem; }
    .dash-dates { display: flex; flex-wrap: wrap; gap: .6rem; font-family: var(--font-ui); font-size: 1.15rem; }
    .dash-dates[hidden] { display: none; }
    .dash-selects { display: flex; flex-wrap: wrap; gap: .6rem; }

    .dash input[type=date], .dash select {
      font: 800 1.1rem var(--font-text);
      color: var(--outline);
      background: var(--cream);
      border: 3px solid var(--outline);
      border-radius: 10px;
      padding: .35rem .6rem;
      min-height: 2.6rem;
    }

    .dash-bar { display: flex; flex-wrap: wrap; gap: .8rem; align-items: center; justify-content: space-between; }
    .dash-exports { display: flex; gap: .6rem; }
    .dash-exports .wood-btn { padding: .45rem 1.1rem; font-size: 1.2rem; text-decoration: none; }

    .dash-live { display: inline-flex; align-items: center; gap: .6rem; font-size: 1.1rem; color: var(--cream-dim); }
    .dash-dot { width: 1rem; height: 1rem; border-radius: 50%; background: #8a8a8a; border: 2px solid var(--outline); }
    .dash-live.on .dash-dot { background: #5cc957; box-shadow: 0 0 10px #5cc957; }
    .dash-live.flash { animation: dashFlash 1.2s ease-out; }
    @keyframes dashFlash { 0% { color: var(--gold-hi); transform: scale(1.08); } 100% { color: var(--cream-dim); transform: none; } }

    .dash-tiles { grid-template-columns: repeat(auto-fill, minmax(8.4rem, 1fr)); }
    .dash-tiles .tile-value { font-size: 1.6rem; white-space: nowrap; }

    .dash-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .dash-card {
      padding: .9rem 1rem 1rem;
      background: rgba(0, 0, 0, .22);
      border: 3px solid rgba(0, 0, 0, .5);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      gap: .5rem;
      min-width: 0;
    }
    .dash-card--wide { grid-column: 1 / -1; }
    .dash-card h3 { margin: 0; color: var(--gold); }
    .dash-hint { margin: 0; font-size: 1rem; color: var(--cream-dim); }
    .dash-canvas { position: relative; height: 18rem; flex: 1; min-height: 18rem; }
    .dash-card--wide .dash-canvas { height: 22rem; }

    @media (max-width: 760px) {
      .dash-grid { grid-template-columns: 1fr; }
      .dash-canvas, .dash-card--wide .dash-canvas { height: 16rem; }
    }
  `;
  document.head.appendChild(style);
}
