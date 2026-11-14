/**
 * styles.js — CSS of the "Table en ligne" panel. Rows, status line and
 * buttons come from the friends window (friends/styles.js) and the saloon theme.
 */

let injected = false;

/** Add the CSS to the page, once. */
export function injectOnlineStyles() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .online-menu { display: grid; gap: 1rem; font-family: var(--font-text); font-weight: 800; color: var(--cream); }
    .online-text { margin: 0; font-size: 1.25rem; }
    .online-code { font-family: var(--font-ui); font-weight: 400; font-size: 1.45rem; color: var(--gold); }
    .online-block { padding: 1rem 1.1rem; }
    .online-block h3 { margin: 0 0 .8rem; font-family: var(--font-ui); font-weight: 400; font-size: 1.45rem; }
    .online-block .friend-list { margin-bottom: 0; }
    .online-actions { display: flex; flex-wrap: wrap; gap: .7rem; }
    .online-label { margin: .2rem 0 .4rem; font-size: 1.1rem; color: var(--gold); }
    .online-choices { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: .8rem; }
    .online-choices .wood-btn { padding: .4rem .9rem; font-size: 1.15rem; }
    .online-join .friend-input { text-transform: uppercase; letter-spacing: .12em; }
    .online-actions .wood-btn { flex: 1 1 12rem; padding: .6rem 1rem; font-size: 1.25rem; }

    /* ── Waiting room of a shared table (WaitingRoom.js) ── */
    .waiting-room {
      position: fixed;
      top: 4.5rem;
      /* Centred with margins: the pop-in animation (saloonPop) animates transform */
      left: 0;
      right: 0;
      margin-inline: auto;
      z-index: 30;
      width: min(600px, calc(100vw - 32px));
      max-height: calc(100vh - 6rem);
      overflow-y: auto;
      padding: 1.2rem 1.4rem 1.4rem;
      display: grid;
      gap: .9rem;
      font-family: var(--font-text);
      font-weight: 800;
      color: var(--cream);
      animation: saloonPop 350ms var(--bounce) both;
    }
    .waiting-room[hidden] { display: none; }
    .waiting-head { display: flex; justify-content: center; } /* inside: the panel scrolls, it would clip a sign sticking out */
    .waiting-sign { font-size: clamp(1.6rem, 4.5vw, 2.2rem); margin: 0; }
    .waiting-code { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .8rem; }
    .waiting-code .online-code { font-size: 1.8rem; letter-spacing: .12em; }
    .waiting-code .wood-btn { padding: .3rem .8rem; font-size: 1.1rem; }
    .waiting-hint { font-size: 1.3rem; color: var(--gold); text-align: center; }
    .waiting-room .wood-btn[disabled] { opacity: .55; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
}
