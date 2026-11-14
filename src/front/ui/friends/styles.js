/**
 * styles.js — CSS of the friends window: the rows (status dot, name, buttons),
 * the search box, the counters on the tabs, the status line. The frame (window,
 * sign, tabs, body) is the record book's (stats/styles.js).
 * Colours, wood and leather come from theme/saloon.css. Big and contrasted:
 * the player's screen is damaged.
 */

let injected = false;

/** Add the CSS to the page, once. */
export function injectFriendsStyles() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .friends .stats-panel { width: min(720px, 100%); }

    .friends-count {
      display: inline-block;
      min-width: 1.7rem;
      margin-left: .45rem;
      padding: 0 .4rem;
      border-radius: 1rem;
      background: var(--red-lo);
      border: 2px solid var(--outline);
      color: var(--cream);
      font-size: 1.05rem;
      line-height: 1.5rem;
    }

    .friends-count--online { background: var(--green-lo); }
    .friends-count[hidden] { display: none; }

    .friends-status {
      margin: 0;
      padding: .55rem .9rem;
      border-radius: 10px;
      background: var(--green-lo);
      border: 3px solid var(--outline);
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 1.2rem;
      color: var(--cream);
    }

    .friends-status--error { background: var(--red-lo); }
    .friends-status[hidden] { display: none; }

    .friend-list { list-style: none; margin: 0 0 1.4rem; padding: 0; display: grid; gap: .6rem; }

    .friend-row {
      display: flex;
      align-items: center;
      gap: .9rem;
      padding: .7rem .9rem;
      border-radius: 12px;
      background: rgba(0, 0, 0, .28);
      border: 2px solid rgba(255, 241, 210, .18);
    }

    .friend-row--off .friend-name { color: var(--cream-dim); }

    .friend-dot {
      flex: none;
      width: 1.2rem;
      height: 1.2rem;
      border-radius: 50%;
      border: 3px solid var(--outline);
    }

    .friend-dot--online  { background: #5ee05a; box-shadow: 0 0 10px #5ee05a; }
    .friend-dot--playing { background: var(--gold); box-shadow: 0 0 10px var(--gold); }
    .friend-dot--offline { background: #6d6257; }

    .friend-who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .friend-name {
      font-family: var(--font-ui);
      font-size: 1.45rem;
      color: var(--cream);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .friend-sub { font-size: 1.05rem; color: var(--cream-dim); }
    .friend-tag { color: var(--gold); font-size: 1.15rem; margin-left: .1rem; }

    .friends-code {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: .4rem .8rem;
      margin: 0;
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 1.25rem;
      color: var(--cream);
    }
    .friends-code b { font-family: var(--font-ui); font-weight: 400; font-size: 1.45rem; color: var(--gold); }
    .friends-code .wood-btn { padding: .3rem .8rem; font-size: 1.1rem; }
    .friends-code[hidden] { display: none; }

    .friend-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
    .friend-actions .wood-btn { padding: .4rem .9rem; font-size: 1.15rem; }

    .friend-search { margin-bottom: 1.2rem; }
    .friend-search-row { display: flex; gap: .6rem; margin-top: .4rem; }
    .friend-search-row .wood-btn { flex: none; white-space: nowrap; padding: .5rem 1rem; font-size: 1.2rem; }
    .friend-input {
      flex: 1;
      min-width: 0;
      padding: .6rem .8rem;
      border-radius: 10px;
      border: 3px solid var(--outline);
      background: var(--cream);
      color: var(--outline);
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 1.3rem;
    }
    .friend-input:focus { outline: 4px solid var(--focus); outline-offset: 1px; }

    @media (max-width: 560px) {
      .friend-row { flex-wrap: wrap; }
      .friend-actions { width: 100%; justify-content: flex-start; }
    }
  `;
  document.head.appendChild(style);
}
