/**
 * PauseMenu.js — In-game menu button (top left) + pause screen
 *
 * The button only shows while a game is running (between `game:start` and
 * `game:quit`). Clicking it, or pressing Esc, pauses the game and opens the
 * pause screen:
 *  - Reprendre         → dispatches `game:resume`
 *  - Tableau des ranges → dispatches `ranges:open` (the range chart opens on top)
 *  - Options           → the Options page (OptionsPanel: amounts in chips / BB…),
 *                        "Retour" comes back to the pause screen
 *  - Quitter la partie → dispatches `game:quit`
 * Opening the pause screen dispatches `game:pause`.
 */

import { OptionsPanel } from './OptionsPanel.js';
import { injectPauseStyles } from './styles.js';

export class PauseMenu {
  constructor() {
    injectPauseStyles();

    this._inGame = false;
    this._paused = false;

    this._build();

    window.addEventListener('game:start', () => this._setInGame(true));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._inGame) this.toggle();
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  pause() {
    if (!this._inGame || this._paused) return;
    this._paused = true;
    this._showView('pause');
    this._backdrop.classList.add('visible');
    this._resumeBtn.focus();
    window.dispatchEvent(new CustomEvent('game:pause'));
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    this._backdrop.classList.remove('visible');
    this._button.focus();
    window.dispatchEvent(new CustomEvent('game:resume'));
  }

  quit() {
    this._paused = false;
    this._backdrop.classList.remove('visible');
    this._setInGame(false);
    window.dispatchEvent(new CustomEvent('game:quit'));
  }

  toggle() {
    if (this._paused) this.resume();
    else this.pause();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** 'pause' (the main buttons) or 'options'. */
  _showView(view) {
    this._pauseView.hidden = view !== 'pause';
    this._optionsView.hidden = view !== 'options';
    this._title.textContent = view === 'options' ? 'Options' : 'Pause';
    if (view === 'options') this._options.focus();
  }

  _setInGame(inGame) {
    this._inGame = inGame;
    this._button.classList.toggle('visible', inGame);
  }

  _build() {
    // ── Top-left button ──
    this._button = document.createElement('button');
    this._button.type = 'button';
    this._button.className = 'game-menu-btn wood-btn';
    this._button.setAttribute('aria-label', 'Menu — mettre en pause');
    this._button.innerHTML = `
      <span class="game-menu-icon" aria-hidden="true"><span></span><span></span><span></span></span>
      <span>Menu</span>
    `;
    this._button.addEventListener('click', () => this.pause());

    // ── Pause screen ──
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'pause-backdrop saloon-backdrop';
    this._backdrop.setAttribute('role', 'dialog');
    this._backdrop.setAttribute('aria-modal', 'true');
    this._backdrop.setAttribute('aria-labelledby', 'pause-title');
    this._backdrop.innerHTML = `
      <div class="pause-panel wood-panel">
        <h2 class="pause-title wood-sign saloon-ol" id="pause-title">Pause</h2>
        <div class="pause-view pause-main">
          <p class="pause-subtitle">La partie est en attente.</p>
          <div class="pause-actions">
            <button type="button" class="pause-resume wood-btn wood-btn--green">Reprendre</button>
            <button type="button" class="pause-ranges wood-btn wood-btn--gold">📖 Tableau des ranges</button>
            <button type="button" class="pause-options wood-btn">⚙️ Options</button>
            <button type="button" class="pause-quit wood-btn wood-btn--red">Quitter la partie</button>
          </div>
        </div>
        <div class="pause-view pause-options-view" hidden>
          <button type="button" class="pause-back wood-btn wood-btn--grey">← Retour</button>
        </div>
        <p class="pause-hint"><span class="saloon-key">Échap</span> pour reprendre</p>
      </div>
    `;

    this._title       = this._backdrop.querySelector('.pause-title');
    this._pauseView   = this._backdrop.querySelector('.pause-main');
    this._optionsView = this._backdrop.querySelector('.pause-options-view');
    this._options = new OptionsPanel({ isInGame: () => this._inGame });
    this._optionsView.prepend(this._options.el);
    const optionsBtn = this._backdrop.querySelector('.pause-options');
    optionsBtn.addEventListener('click', () => this._showView('options'));
    this._backdrop.querySelector('.pause-back').addEventListener('click', () => {
      this._showView('pause');
      optionsBtn.focus();
    });

    this._resumeBtn = this._backdrop.querySelector('.pause-resume');
    this._resumeBtn.addEventListener('click', () => this.resume());
    this._backdrop.querySelector('.pause-quit').addEventListener('click', () => this.quit());
    this._backdrop.querySelector('.pause-ranges').addEventListener('click', () => window.dispatchEvent(new CustomEvent('ranges:open')));

    // Click outside the panel resumes
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) this.resume();
    });

    document.body.append(this._button, this._backdrop);
  }
}
