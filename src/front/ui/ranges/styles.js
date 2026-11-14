/**
 * styles.js — The range chart's CSS (saloon theme: see ui/theme/saloon.css)
 *
 * Injected once, the first time the screen opens.
 */

let injected = false;

export function injectRangeStyles() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .ranges {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: flex;
      padding: 4rem 16px 16px;
    }

    .ranges-panel {
      width: min(1180px, 100%);
      max-height: 100%;
      margin: 0 auto;
      padding: 1.1rem 1.4rem 1.3rem;
      display: flex;
      flex-direction: column;
      gap: .9rem;
      animation: saloonPop 400ms var(--bounce) both;
    }

    .ranges-head { display: flex; justify-content: center; margin-top: -3.6rem; }
    .ranges-sign { margin: 0; font-size: clamp(1.6rem, 5vw, 2.3rem); }

    .ranges-close {
      position: absolute;
      top: -1rem;
      right: -1rem;
      width: 3.2rem;
      height: 3.2rem;
      border-radius: 50%;
      font-size: 1.5rem;
      z-index: 3;
    }

    .ranges-modes { display: flex; flex-wrap: wrap; gap: .6rem; }
    .ranges-modes .wood-btn { flex: 1 1 9rem; padding: .5rem .8rem; font-size: 1.3rem; }

    .ranges-main {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(19rem, 1fr);
      gap: 1rem;
      align-items: start;
    }

    /* The chart stays in view while the side panel scrolls */
    .ranges-left { position: sticky; top: 0; }

    .ranges-left, .ranges-side {
      display: flex;
      flex-direction: column;
      gap: .8rem;
      min-width: 0;
    }

    .ranges-side {
      padding: 1rem 1.1rem;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--cream);
    }

    .ranges-title {
      margin: 0;
      font-family: var(--font-ui);
      font-weight: 400;
      font-size: 1.6rem;
      color: var(--cream);
      text-shadow: 0 3px 0 var(--outline);
    }

    .ranges-situation {
      margin: 0;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--cream-dim);
      text-shadow: 0 2px 0 var(--outline);
    }

    .ranges-side h3 {
      margin: .2rem 0 0;
      font-family: var(--font-ui);
      font-weight: 400;
      font-size: 1.1rem;
      color: var(--gold);
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    .ranges-side p { margin: 0; line-height: 1.4; }
    .dim { color: var(--cream-dim); }

    /* ── The grid ── */
    .range-wrap { position: relative; }

    .range-grid {
      display: grid;
      grid-template-columns: repeat(13, 1fr);
      gap: 3px;
      width: 100%;
      max-width: max(20rem, calc(100vh - 22rem)); /* the whole grid fits on screen */
      aspect-ratio: 1;
      padding: 5px;
      background: var(--outline);
      border: 4px solid var(--outline);
      border-radius: 12px;
      box-shadow: 0 6px 0 rgba(0, 0, 0, .45);
      user-select: none;
      transition: filter 250ms;
    }

    /* History: a hand never received in this situation */
    .cell.empty {
      background: repeating-linear-gradient(45deg, #2b2621 0 4px, #231f1b 4px 8px) !important;
      color: #8d8272;
      text-shadow: none;
    }

    .cell {
      position: relative;
      display: grid;
      place-items: center;
      min-width: 0;
      padding: 0;
      border: 0;
      border-radius: 4px;
      color: #fff;
      font-family: var(--font-ui);
      font-size: clamp(.55rem, 1.25vw, 1.02rem);
      line-height: 1;
      letter-spacing: -.02em;
      text-shadow: 0 0 2px #000, 0 1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000;
      cursor: pointer;
      overflow: hidden;
    }

    .cell:hover { filter: brightness(1.2); }
    .cell:focus-visible { outline: 3px solid var(--focus); outline-offset: -3px; z-index: 2; }
    .cell.selected { box-shadow: inset 0 0 0 3px var(--focus), 0 0 0 2px var(--focus); z-index: 2; }

    /* Zones: the kind of hand replaces the range's colours (the label stays on top) */
    .cell span { position: relative; z-index: 1; pointer-events: none; }
    .range-grid.zones .cell::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .range-grid.zones .cell.pair::after    { background: #f7bb2a; }
    .range-grid.zones .cell.suited::after  { background: #2f7de1; }
    .range-grid.zones .cell.offsuit::after { background: #9b4dca; }

    .zone-legend[hidden] { display: none; }
    .zone-legend { display: flex; flex-wrap: wrap; gap: .4rem 1rem; font-family: var(--font-text); font-weight: 800; font-size: 1rem; }
    .zone-legend span::before {
      content: '';
      display: inline-block;
      width: .9em;
      height: .9em;
      margin-right: .35em;
      border: 2px solid var(--outline);
      border-radius: 3px;
      vertical-align: -.1em;
      background: var(--swatch);
    }

    .ranges-toggle {
      align-self: flex-start;
      padding: .35rem .9rem;
      font-size: 1.05rem;
    }

    /* ── Picker ── */
    .ranges-picker {
      width: 100%;
      padding: .5rem .7rem;
      border: 4px solid var(--outline);
      border-radius: 10px;
      background: #fff6e0;
      color: #1c0f06;
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 1.15rem;
    }
    .ranges-picker:focus-visible { outline: 4px solid var(--focus); outline-offset: 2px; }

    /* ── Legend ── */
    .legend { display: flex; flex-direction: column; gap: .45rem; }
    .legend-row { display: grid; grid-template-columns: 1.4rem 1fr auto; gap: .6rem; align-items: center; }
    .swatch { width: 1.4rem; height: 1.4rem; border: 3px solid var(--outline); border-radius: 5px; }
    .legend-num { font-family: var(--font-ui); font-size: 1.2rem; color: var(--gold); text-align: right; }
    .legend-sub { display: block; font-size: .92rem; color: var(--cream-dim); }

    .mixbar {
      display: flex;
      height: 1.1rem;
      border: 3px solid var(--outline);
      border-radius: 6px;
      overflow: hidden;
    }
    .mixbar span { height: 100%; }

    /* ── Hand detail ── */
    .detail {
      display: flex;
      flex-direction: column;
      gap: .5rem;
      padding: .8rem;
      background: rgba(255, 230, 180, .1);
      border: 3px solid rgba(0, 0, 0, .45);
      border-radius: 12px;
    }
    .detail-pin {
      margin: 0;
      padding: .35rem .7rem;
      border: 3px solid var(--outline);
      border-radius: 10px;
      background: var(--gold);
      color: var(--outline);
      font-weight: 900;
    }
    .detail-top { display: flex; align-items: center; gap: .8rem; }
    .detail-name { font-family: var(--font-ui); font-size: 1.4rem; line-height: 1.1; }
    .detail-code { color: var(--gold); }

    .play-card {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 2.6rem;
      height: 3.6rem;
      margin-right: .25rem;
      border: 3px solid var(--outline);
      border-radius: 7px;
      background: #fffaf0;
      box-shadow: 0 3px 0 var(--outline);
      color: #151515;
      font-family: var(--font-ui);
      line-height: 1;
    }
    .play-card b { font-weight: 400; font-size: 1.35rem; }
    .play-card i { font-style: normal; font-size: 1.35rem; }
    .play-card.red { color: #c0201a; }
    .play-card.small { width: 2.1rem; height: 2.9rem; border-width: 2px; border-radius: 6px; }
    .play-card.small b, .play-card.small i { font-size: 1.05rem; }

    .howto { background: rgba(0, 0, 0, .2); border: 3px solid rgba(0, 0, 0, .45); border-radius: 12px; }
    .howto > summary { padding: .6rem .8rem; cursor: pointer; font-family: var(--font-ui); font-size: 1.2rem; color: var(--gold); }
    .howto > summary:focus-visible { outline: 4px solid var(--focus); outline-offset: -4px; }
    .howto-body { padding: 0 .9rem .9rem; display: flex; flex-direction: column; gap: .6rem; line-height: 1.4; }
    .howto-body b { color: var(--gold-hi); }

    /* ── Build ── */
    .brushes { display: flex; flex-wrap: wrap; gap: .5rem; }
    .brushes .wood-btn { flex: 1 1 7rem; padding: .45rem .6rem; font-size: 1.1rem; display: inline-flex; align-items: center; gap: .4rem; justify-content: center; }
    .brushes .swatch { width: 1.1rem; height: 1.1rem; }
    .row-btns { display: flex; flex-wrap: wrap; gap: .5rem; }
    .row-btns .wood-btn { padding: .4rem .9rem; font-size: 1.05rem; }

    /* ── History ── */
    .seg-row { display: flex; flex-wrap: wrap; gap: .5rem; }
    .seg-row .wood-btn { flex: 1 1 9rem; padding: .45rem .6rem; font-size: 1.05rem; }
    .notes { display: flex; flex-direction: column; gap: .6rem; }
    .note {
      display: flex;
      flex-direction: column;
      gap: .35rem;
      width: 100%;
      padding: .7rem .8rem;
      background: rgba(255, 230, 180, .1);
      border: 3px solid rgba(0, 0, 0, .45);
      border-left: 8px solid var(--note, var(--red-hi));
      border-radius: 12px;
      color: var(--cream);
      font: inherit;
      text-align: left;
    }
    button.note { cursor: pointer; transition: background 150ms; }
    button.note:hover { background: rgba(255, 230, 180, .2); }
    button.note:focus-visible { outline: 4px solid var(--focus); outline-offset: 2px; }
    .note-head { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .7rem; }
    .note-title { font-family: var(--font-ui); font-size: 1.2rem; }
    .note-meta { font-size: .95rem; color: var(--cream-dim); }
    .note-bad { color: #ffb0a0; font-family: var(--font-ui); font-size: 1.15rem; margin-left: auto; }
    .notice { padding: .7rem .8rem; border: 3px dashed rgba(247, 187, 42, .5); border-radius: 10px; }

    @media (max-width: 860px) {
      .ranges-main { grid-template-columns: 1fr; }
      .ranges-left { position: static; }
    }

    @media (max-width: 480px) {
      .ranges-panel { padding-inline: .7rem; }
      .range-grid { gap: 2px; padding: 3px; }
      .ranges-side { padding: .8rem; }
    }

    /* ── Brush: mixes (Construire) ── */
    .mix {
      display: flex;
      flex-direction: column;
      gap: .55rem;
      padding: .75rem .8rem;
      background: rgba(255, 230, 180, .08);
      border: 3px solid rgba(0, 0, 0, .45);
      border-radius: 12px;
    }
    .mix-preview { display: flex; align-items: center; gap: .7rem; }
    .mix-swatch {
      flex: none;
      width: 3.2rem;
      height: 2.2rem;
      border: 3px solid var(--outline);
      border-radius: 6px;
    }
    .mix-text { font-family: var(--font-ui); font-size: 1.2rem; color: var(--gold-hi); }
    .mix-row { display: grid; grid-template-columns: 7.5rem 1fr 3.6rem; align-items: center; gap: .6rem; }
    .mix-label { display: inline-flex; align-items: center; gap: .4rem; }
    .mix-label .swatch { width: 1.1rem; height: 1.1rem; }
    .mix-slider { width: 100%; height: 2rem; accent-color: var(--gold); cursor: pointer; }
    .mix-slider:focus-visible { outline: 4px solid var(--focus); outline-offset: 2px; }
    .mix-out { font-family: var(--font-ui); font-size: 1.2rem; color: var(--gold); text-align: right; font-variant-numeric: tabular-nums; }
    .mix-chips { display: flex; flex-wrap: wrap; gap: .4rem; }
    .mix-chip { display: inline-flex; align-items: center; gap: .35rem; padding: .3rem .6rem; font-size: .98rem; }
    .mix-chip .swatch { width: 1.6rem; height: 1rem; }
    .mix-pipette { align-self: flex-start; padding: .35rem .8rem; font-size: 1.02rem; }

    /* ── Theory (Mon historique) ── */
    .theory { display: flex; flex-direction: column; gap: .7rem; }
    .range-grid.mini {
      max-width: 100%;
      gap: 1px;
      padding: 2px;
      border-width: 3px;
      border-radius: 8px;
      box-shadow: none;
      pointer-events: none;
    }
    .range-grid.mini .cell { font-size: clamp(.45rem, .75vw, .72rem); border-radius: 2px; letter-spacing: -.04em; }
    .range-grid.mini .cell.selected { box-shadow: inset 0 0 0 2px var(--focus), 0 0 0 2px var(--focus); }

    .heat-legend { display: flex; flex-direction: column; gap: .25rem; }
    .heat-bar { height: 1rem; border: 3px solid var(--outline); border-radius: 6px; }
    .heat-labels { display: flex; justify-content: space-between; font-size: .92rem; color: var(--cream-dim); }

    .loss-box {
      display: flex;
      align-items: center;
      gap: .9rem;
      padding: .7rem .9rem;
      background: rgba(181, 44, 28, .25);
      border: 3px solid var(--outline);
      border-radius: 12px;
    }
    .loss-big { flex: none; font-family: var(--font-ui); font-size: 2rem; color: #ffb0a0; text-shadow: 0 3px 0 var(--outline); }
    .worst { display: flex; flex-wrap: wrap; gap: .4rem; }
    .worst-hand { padding: .3rem .7rem; font-size: 1rem; }
    .worst-hand .dim { color: #6b4a22; }

    .per100 { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
    .per100 > span {
      display: flex;
      flex-direction: column;
      padding: .45rem .5rem;
      background: rgba(0, 0, 0, .25);
      border: 3px solid rgba(0, 0, 0, .45);
      border-radius: 10px;
      text-align: center;
      font-size: .95rem;
    }
    .per100 b { font-family: var(--font-ui); font-weight: 400; font-size: 1.45rem; }
    .plus { color: #9fe89a; }
    .minus { color: #ffb0a0; }

    .ev-table { width: 100%; border-collapse: collapse; font-size: 1.02rem; }
    .ev-table th { font-family: var(--font-ui); font-weight: 400; color: var(--gold); text-align: left; padding: .2rem .3rem; }
    .ev-table td { padding: .3rem; border-top: 2px solid rgba(0, 0, 0, .35); }
    .ev-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .ev-table .swatch { display: inline-block; width: 1rem; height: 1rem; vertical-align: -.15em; }

    @media (max-width: 480px) {
      .per100 b { font-size: 1.2rem; }
    }

    /* ── Saved ranges (Construire) ── */
    .saved-form { display: flex; flex-wrap: wrap; gap: .5rem; }
    .saved-form .ranges-picker { flex: 1 1 12rem; width: auto; }
    .saved-form .wood-btn { padding: .4rem .9rem; font-size: 1.05rem; }
    .saved-list { display: flex; flex-direction: column; gap: .45rem; }
    .saved-item {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .4rem .7rem;
      padding: .5rem .7rem;
      background: rgba(255, 230, 180, .1);
      border: 3px solid rgba(0, 0, 0, .45);
      border-radius: 10px;
    }
    .saved-item.current { border-color: var(--gold); }
    .saved-name { flex: 1 1 8rem; min-width: 0; font-family: var(--font-ui); font-size: 1.15rem; overflow-wrap: anywhere; }
    .saved-item .wood-btn { padding: .3rem .7rem; font-size: 1rem; }
    .status { min-height: 1.4em; }
    .status.error { color: #ffc2b5; }
  `;
  document.head.appendChild(style);
}
