/**
 * styles.js — CSS of the login / sign-up screen.
 * Colours, wood and leather come from theme/saloon.css.
 */

let injectAuthStylesDone = false;

/** Add the CSS to the page, once. */
export function injectAuthStyles() {
  if (injectAuthStylesDone) return;
  injectAuthStylesDone = true;
  const style = document.createElement('style');
  style.textContent = `
    .auth {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4rem 16px 16px; /* room for the sign sticking out above the panel */
      overflow-y: auto;
    }

    .auth.leaving { opacity: 0; transition: opacity 350ms ease; }

    .auth-panel {
      width: min(560px, 100%);
      margin: auto;
      padding: 1.4rem 2rem 1.8rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.1rem;
      text-align: center;
      animation: saloonPop 450ms var(--bounce) both;
    }

    .auth-sign {
      margin: -4.2rem 0 0;
      font-size: clamp(2rem, 7vw, 2.6rem);
    }

    .auth-subtitle {
      margin: 0;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.15rem;
      color: var(--cream);
      text-shadow: 0 2px 0 var(--outline);
    }

    .auth-tabs {
      display: flex;
      gap: .7rem;
      width: 100%;
    }

    .auth-tabs .wood-btn {
      flex: 1;
      padding: .55rem 1rem;
      font-size: 1.4rem;
    }

    .auth-form {
      width: 100%;
      margin: 0;
      padding: 1.2rem 1.3rem 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      text-align: left;
    }

    .auth-field {
      display: flex;
      flex-direction: column;
      gap: .35rem;
    }

    .auth-field[hidden] { display: none; }

    .auth-input-row {
      display: flex;
      gap: .5rem;
    }

    .auth-input {
      flex: 1;
      min-width: 0;
      padding: .6rem .8rem;
      border: 4px solid var(--outline);
      border-radius: 10px;
      background: #fff6e0;
      box-shadow: inset 0 3px 0 rgba(0, 0, 0, .15);
      color: #1c0f06;
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.3rem;
    }

    .auth-input::placeholder { color: #8a7355; }

    .auth-input:focus-visible {
      outline: 4px solid var(--focus);
      outline-offset: 2px;
    }

    .auth-input[aria-invalid="true"] {
      border-color: #d8301c;
      background: #ffe3dc;
    }

    .auth-show {
      flex: none;
      padding: 0 .8rem;
      font-size: 1.05rem;
    }

    .auth-hint,
    .auth-error {
      margin: 0;
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 1.05rem;
    }

    .auth-hint { color: var(--cream-dim); }
    /* The error replaces the hint, no need for both */
    .auth-field:has([aria-invalid="true"]) .auth-hint { display: none; }

    .auth-error {
      color: #ffc2b5;
      text-shadow: 0 2px 0 var(--outline);
    }

    .auth-error:empty { display: none; }
    .auth-error::before { content: '⚠ '; }

    /* Answer from the server (wrong password, server down…) */
    .auth-message {
      margin: 0;
      padding: .6rem .8rem;
      border: 3px solid var(--outline);
      border-radius: 10px;
      background: #b52c1c;
      color: #fff;
      font-family: var(--font-text);
      font-weight: 900;
      font-size: 1.1rem;
      text-align: center;
      animation: saloonPop 250ms var(--bounce) both;
    }

    .auth-message:empty { display: none; }

    .auth-submit {
      margin-top: .3rem;
      padding: .7rem 1rem;
      font-size: 1.6rem;
    }

    .auth-guest {
      padding: .45rem 1.4rem;
      font-size: 1.15rem;
    }

    @media (max-width: 480px) {
      .auth-panel { padding-inline: 1rem; }
      .auth-form { padding-inline: .9rem; }
    }
  `;
  document.head.appendChild(style);
}
