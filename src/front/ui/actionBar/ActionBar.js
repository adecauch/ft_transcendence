/**
 * ActionBar.js — The player's betting controls (bottom of the screen)
 *
 *   [ ½ pot ] [ ⅔ pot ] [ Pot ] [ Tapis ]      one click = the bet is played
 *   [ Se coucher ]  [ Check / Suivre X ]  [ Relancer ]
 *       red               green              gold
 *
 * Saloon theme (see ui/theme/saloon.css): a wooden bar with raised buttons.
 * This file is the bar itself: the situation (pot, to call, stack), the
 * one-click bets (quickBets() in betting.js, like Winamax: no panel, no
 * confirmation), the three buttons, and the end-of-hand message. "Relancer"
 * (or "Miser" when nobody has bet yet) opens RaisePanel.js for any other
 * amount; the CSS is in styles.js.
 *
 * Amounts follow the chips / big blinds toggle (chipUnit.js).
 *
 * Usage:
 *   const action = await actionBar.ask(turnState); // resolves with a PlayerAction
 *   actionBar.message('Tu gagnes 40', { label: 'Rejouer', onClick });
 *   actionBar.countdown(30_000, true);  // server game: time left to play
 */

import { legalActions, toCall, quickBets } from '../../../shared/poker/betting.js';
import { money, onUnitChange } from '../chipUnit.js';
import { injectActionBarStyles } from './styles.js';
import { RaisePanel } from './RaisePanel.js';

export class ActionBar {
  constructor() {
    injectActionBarStyles();
    this._resolve = null;
    this._state   = null;
    this._clock   = null; // setInterval of the countdown
    this._build();
    onUnitChange(() => this._onUnitChange());
  }

  /**
   * Show the controls for the player's turn.
   * @param {import('../../../shared/poker/betting').TurnState} state
   * @returns {Promise<import('../../../shared/poker/betting').PlayerAction>}
   */
  ask(state) {
    this._cancelPending();
    this._state = state;
    this._render();
    this._showMode('actions');
    this._root.classList.add('visible');

    return new Promise((resolve) => { this._resolve = resolve; });
  }

  /**
   * Show a message with an optional button (e.g. end of hand).
   * @param {string} text
   * @param {{ label: string, onClick: () => void }} [button]
   */
  message(text, button) {
    this._cancelPending();
    this._msgText.textContent = text;
    this._msgBtn.hidden = !button;
    this._msgBtn.onclick = button ? () => { this.hide(); button.onClick(); } : null;
    if (button) this._msgBtn.textContent = button.label;
    this._showMode('message');
    this._root.classList.add('visible');
  }

  hide() {
    this._cancelPending();
    this._root.classList.remove('visible');
  }

  /**
   * Show the time left for this turn (server game only: the server plays
   * fold / check at zero). Frozen while paused.
   * @param {number} remainingMs
   * @param {boolean} running
   */
  countdown(remainingMs, running) {
    this._stopClock();
    if (!this._resolve) return; // the turn is already answered
    const end = performance.now() + remainingMs;
    const draw = () => {
      const left = running ? Math.max(0, end - performance.now()) : remainingMs;
      const s = Math.ceil(left / 1000);
      this._timer.textContent = running ? `⏱ ${s} s` : `⏸ En pause · ${s} s`;
      this._timer.classList.toggle('urgent', running && s <= 10);
    };
    draw();
    this._timer.hidden = false;
    if (running) this._clock = setInterval(draw, 250);
  }

  /**
   * The clock reached zero and the server played for the player: close the
   * controls and resolve the pending ask() with `null` (nothing to send).
   */
  expire() {
    this._answer(null);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** A new ask() or hide() drops the previous, unanswered turn. */
  _cancelPending() {
    this._resolve = null;
    this._stopClock();
    this._closeRaise();
  }

  _stopClock() {
    clearInterval(this._clock);
    this._clock = null;
    if (this._timer) this._timer.hidden = true;
  }

  _answer(action) {
    const resolve = this._resolve;
    if (!resolve) return;
    this._resolve = null;
    this._stopClock();
    this._root.classList.remove('visible');
    this._closeRaise();
    resolve(action);
  }

  _showMode(mode) {
    this._actionsEl.hidden = mode !== 'actions';
    this._messageEl.hidden = mode !== 'message';
  }

  _render() {
    const s = this._state;
    const legal = legalActions(s);

    this._note.textContent = s.note ?? '';
    this._note.hidden = !s.note;

    this._info.innerHTML = `
      ${s.street ? `<span><b>${s.street}</b></span>` : ''}
      <span>Pot <b>${money(s.pot)}</b></span>
      <span>À suivre <b>${money(toCall(s))}</b></span>
      <span>Ton tapis <b>${money(s.stack)}</b></span>
    `;

    // Check / call
    if (legal.check) {
      this._callBtn.innerHTML = 'Check';
    } else {
      this._callBtn.innerHTML = `${legal.callIsAllIn ? 'Tapis' : 'Suivre'}<span class="sub">${money(legal.call)}</span>`;
    }

    // Raise / bet
    const verb = legal.isBet ? 'Miser' : 'Relancer';
    this._raiseBtn.disabled = !legal.raise;
    this._raiseBtn.innerHTML = legal.raise
      ? `${verb}<span class="sub">${money(legal.raise.min)} – ${money(legal.raise.max)}</span>`
      : `${verb}<span class="sub">impossible</span>`;
    this._raise.refreshLabel(s);
    this._drawQuickBets();
  }

  /** The one-click bets of this turn: a click plays the raise at once. */
  _drawQuickBets() {
    const bets = quickBets(this._state);
    this._quick.innerHTML = '';
    this._quick.hidden = !bets.length || this._raise.isOpen;
    const verb = legalActions(this._state).isBet ? 'Miser' : 'Relancer à';
    for (const { label, to } of bets) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `wood-btn${label === 'Tapis' ? ' quick-allin' : ''}`;
      const amount = money(to);
      b.innerHTML = amount === label ? label : `${label}<span class="sub">${amount}</span>`; // not "2 BB" twice
      b.setAttribute('aria-label', label === 'Tapis' ? `Tapis, ${amount}` : `${verb} ${amount} (${label})`);
      b.addEventListener('click', () => this._answer({ type: 'raise', to }));
      this._quick.appendChild(b);
    }
  }

  /** Chips ↔ big blinds: redraw the open turn, keeping the chosen amount. */
  _onUnitChange() {
    if (!this._state) return;
    this._render();
    this._raise.onUnitChange();
  }

  _openRaise() {
    if (!legalActions(this._state).raise) return;
    this._raise.open(this._state);
    this._raiseBtn.setAttribute('aria-expanded', 'true');
    this._quick.hidden = true; // the panel has its own quick amounts
  }

  _closeRaise() {
    this._raise?.close();
    this._raiseBtn?.setAttribute('aria-expanded', 'false');
    if (this._quick && this._state && this._resolve) this._quick.hidden = !quickBets(this._state).length;
  }

  _build() {
    const root = document.createElement('div');
    root.className = 'action-bar';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Actions du joueur');
    root.innerHTML = `
      <div class="action-card wood-panel">
        <div class="action-actions">
          <div class="action-timer" role="timer" hidden></div>
          <div class="action-note" aria-live="polite"></div>
          <div class="action-info"></div>
          <div class="action-quick" role="group" aria-label="Mises rapides"></div>
          <div class="action-buttons">
            <button type="button" class="action-btn action-fold wood-btn wood-btn--red">Se coucher</button>
            <button type="button" class="action-btn action-call wood-btn wood-btn--green">Check</button>
            <button type="button" class="action-btn action-raise wood-btn wood-btn--gold" aria-expanded="false" aria-controls="raise-panel">Relancer</button>
          </div>
        </div>

        <div class="action-message" hidden>
          <div class="action-message-text"></div>
          <button type="button" class="wood-btn wood-btn--gold"></button>
        </div>
      </div>
    `;

    this._root      = root;
    this._actionsEl = root.querySelector('.action-actions');
    this._messageEl = root.querySelector('.action-message');
    this._msgText   = root.querySelector('.action-message-text');
    this._msgBtn    = root.querySelector('.action-message button');
    this._info      = root.querySelector('.action-info');
    this._note      = root.querySelector('.action-note');
    this._timer     = root.querySelector('.action-timer');
    this._callBtn   = root.querySelector('.action-call');
    this._raiseBtn  = root.querySelector('.action-raise');
    this._quick     = root.querySelector('.action-quick');

    // The raise panel sits between the situation line and the buttons
    this._raise = new RaisePanel({
      onConfirm: (to) => this._answer({ type: 'raise', to }),
      onCancel: () => {
        this._closeRaise();
        this._raiseBtn.focus();
      },
    });
    this._info.after(this._raise.el);

    root.querySelector('.action-fold').addEventListener('click', () => this._answer({ type: 'fold' }));

    this._callBtn.addEventListener('click', () => {
      const legal = legalActions(this._state);
      this._answer(legal.check ? { type: 'check' } : { type: 'call', amount: legal.call });
    });

    this._raiseBtn.addEventListener('click', () => {
      if (this._raise.isOpen) this._closeRaise();
      else this._openRaise();
    });

    document.body.appendChild(root);
  }
}
