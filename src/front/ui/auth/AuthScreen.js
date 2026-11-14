/**
 * AuthScreen.js — Log in / create an account (saloon theme, like WelcomeScreen)
 *
 * A wooden panel over the room with two tabs:
 *   Connexion   — email + password
 *   Inscription — email + pseudo + password + confirmation
 * and "Jouer sans compte" (guest: nothing is saved).
 *
 * The fields are checked here first with the shared rules
 * (src/shared/auth/rules.js) so mistakes show at once under the right field;
 * the server checks again (only its check counts) and its answers — email
 * already taken, wrong password, too many tries, server down — show the same
 * way. The password never goes anywhere but the HTTPS request to the server.
 *
 *   const auth = new AuthScreen({ onDone: (user) => … });  // user = null for a guest
 *   auth.show('login' | 'register');
 */

import { authApi } from '../../net/authApi.js';
import { checkLogin, checkRegister, RULES } from '../../../shared/auth/rules.js';
import { injectAuthStyles } from './styles.js';

const TEXT = {
  login: {
    subtitle: 'Content de te revoir, cowboy !',
    submit: 'Se connecter',
    busy: 'Connexion…',
  },
  register: {
    subtitle: 'Crée ton compte pour garder tes parties et tes statistiques',
    submit: 'Créer mon compte',
    busy: 'Création…',
  },
};

export class AuthScreen {
  /** @param {{ onDone: (user: object | null) => void }} options */
  constructor({ onDone }) {
    injectAuthStyles();
    this.onDone = onDone;
    this.mode = 'login';
    this._busy = false;
    this._root = null;
  }

  /** @param {'login' | 'register'} [mode] */
  show(mode = 'login') {
    if (!this._root) this._build();
    this._setMode(mode);
    this._fields.email.input.focus();
  }

  hide() {
    const root = this._root;
    if (!root) return;
    this._root = null;
    root.classList.add('leaving');
    setTimeout(() => root.remove(), 350);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _build() {
    const root = document.createElement('div');
    root.className = 'auth saloon-backdrop';

    const { min: userMin, max: userMax } = RULES.username;
    root.innerHTML = `
      <div class="auth-panel wood-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h1 id="auth-title" class="auth-sign wood-sign saloon-ol">Poker Transcendence</h1>
        <p class="auth-subtitle"></p>

        <div class="auth-tabs" role="group" aria-label="Choisir">
          <button type="button" class="wood-btn" data-mode="login">Connexion</button>
          <button type="button" class="wood-btn" data-mode="register">Inscription</button>
        </div>

        <form class="auth-form leather" novalidate>
          <div class="auth-field" data-field="email">
            <label class="saloon-label" for="auth-email">Email</label>
            <input id="auth-email" class="auth-input" type="email" name="email"
                   autocomplete="email" placeholder="toi@exemple.fr" maxlength="${RULES.emailMax}">
            <p class="auth-error" id="auth-email-error" aria-live="polite"></p>
          </div>

          <div class="auth-field" data-field="username">
            <label class="saloon-label" for="auth-username">Pseudo</label>
            <input id="auth-username" class="auth-input" type="text" name="username"
                   autocomplete="username" placeholder="LuckyLuke" maxlength="${userMax}">
            <p class="auth-hint">${userMin} à ${userMax} caractères : lettres, chiffres, _ et -.
              Un numéro s'y ajoute (LuckyLuke#4821) : c'est ton code ami, et le pseudo peut être déjà porté.</p>
            <p class="auth-error" id="auth-username-error" aria-live="polite"></p>
          </div>

          <div class="auth-field" data-field="password">
            <label class="saloon-label" for="auth-password">Mot de passe</label>
            <div class="auth-input-row">
              <input id="auth-password" class="auth-input" type="password" name="password"
                     autocomplete="current-password" maxlength="${RULES.password.max}">
              <button type="button" class="auth-show wood-btn wood-btn--grey"
                      aria-controls="auth-password" aria-pressed="false">Afficher</button>
            </div>
            <p class="auth-hint auth-password-hint">Au moins ${RULES.password.min} caractères</p>
            <p class="auth-error" id="auth-password-error" aria-live="polite"></p>
          </div>

          <div class="auth-field" data-field="confirm">
            <label class="saloon-label" for="auth-confirm">Confirmer le mot de passe</label>
            <input id="auth-confirm" class="auth-input" type="password" name="confirm"
                   autocomplete="new-password" maxlength="${RULES.password.max}">
            <p class="auth-error" id="auth-confirm-error" aria-live="polite"></p>
          </div>

          <p class="auth-message" role="alert"></p>

          <button type="submit" class="auth-submit wood-btn wood-btn--red"></button>
        </form>

        <button type="button" class="auth-guest wood-btn wood-btn--grey">Jouer sans compte</button>
      </div>
    `;
    document.body.appendChild(root);
    this._root = root;

    const $ = (sel) => root.querySelector(sel);
    this._subtitle = $('.auth-subtitle');
    this._tabs = [...root.querySelectorAll('.auth-tabs .wood-btn')];
    this._form = $('.auth-form');
    this._message = $('.auth-message');
    this._submit = $('.auth-submit');
    this._passwordHint = $('.auth-password-hint');

    /** @type {Record<string, { box: HTMLElement, input: HTMLInputElement, error: HTMLElement }>} */
    this._fields = {};
    for (const box of root.querySelectorAll('.auth-field')) {
      const name = box.dataset.field;
      const input = box.querySelector('input');
      const error = box.querySelector('.auth-error');
      input.setAttribute('aria-describedby', error.id);
      // Typing again clears that field's complaint
      input.addEventListener('input', () => this._setError(name, null));
      this._fields[name] = { box, input, error };
    }

    this._tabs.forEach((tab) => tab.addEventListener('click', () => this._setMode(tab.dataset.mode)));

    // Show / hide the password (both password inputs)
    const show = $('.auth-show');
    show.addEventListener('click', () => {
      const visible = show.getAttribute('aria-pressed') !== 'true';
      show.setAttribute('aria-pressed', String(visible));
      show.textContent = visible ? 'Cacher' : 'Afficher';
      for (const name of ['password', 'confirm']) this._fields[name].input.type = visible ? 'text' : 'password';
    });

    this._form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._send();
    });

    $('.auth-guest').addEventListener('click', () => {
      if (this._busy) return;
      this.hide();
      this.onDone(null);
    });
  }

  _setMode(mode) {
    this.mode = mode;
    const register = mode === 'register';
    this._tabs.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.mode === mode)));
    this._subtitle.textContent = TEXT[mode].subtitle;
    this._submit.textContent = TEXT[mode].submit;
    this._submit.classList.toggle('wood-btn--red', !register);
    this._submit.classList.toggle('wood-btn--green', register);
    this._fields.username.box.hidden = !register;
    this._fields.confirm.box.hidden = !register;
    this._passwordHint.hidden = !register;
    // Lets the browser's password manager offer to save / fill the right thing
    this._fields.password.input.autocomplete = register ? 'new-password' : 'current-password';
    this._message.textContent = '';
    for (const name of Object.keys(this._fields)) this._setError(name, null);
  }

  _values() {
    const v = (name) => this._fields[name].input.value;
    return this.mode === 'register'
      ? { email: v('email'), username: v('username'), password: v('password'), confirm: v('confirm') }
      : { email: v('email'), password: v('password') };
  }

  async _send() {
    if (this._busy) return;
    this._message.textContent = '';

    const values = this._values();
    const errors = this.mode === 'register' ? checkRegister(values) : checkLogin(values);
    for (const name of Object.keys(this._fields)) this._setError(name, errors[name] ?? null);
    const first = Object.keys(this._fields).find((name) => errors[name]);
    if (first) {
      this._fields[first].input.focus();
      return;
    }

    this._setBusy(true);
    const { confirm, ...body } = values;
    const res = this.mode === 'register' ? await authApi.register(body) : await authApi.login(body);
    this._setBusy(false);

    if (res.ok) {
      this.hide();
      this.onDone(res.user);
      return;
    }
    if (res.field && this._fields[res.field]) {
      this._setError(res.field, res.error);
      this._fields[res.field].input.focus();
    } else {
      this._message.textContent = res.error;
      // Wrong password: start the password again, keep the email
      if (this.mode === 'login' && !res.offline) {
        this._fields.password.input.value = '';
        this._fields.password.input.focus();
      }
    }
  }

  _setError(name, message) {
    const f = this._fields[name];
    f.error.textContent = message ?? '';
    f.input.setAttribute('aria-invalid', String(Boolean(message)));
  }

  _setBusy(busy) {
    this._busy = busy;
    this._submit.disabled = busy;
    this._submit.textContent = TEXT[this.mode][busy ? 'busy' : 'submit'];
    this._tabs.forEach((t) => { t.disabled = busy; });
  }
}
