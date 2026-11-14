/**
 * OnlineMenu.js — "Table en ligne": the panel behind the invitation card
 *
 * The entry of the online mode (invitations: net/lobbyApi.js, server/src/lobby):
 *  - a guest is asked to log in (friends find you by your friend code);
 *  - a player sees their friend code, the invitations received (Rejoindre:
 *    sits at the friend's table; Refuser), creates a table (AIs, stack, blinds)
 *    or joins one with its code.
 * Creating or joining sends `game:start` with `shared` (main.js →
 * TableController → RemoteGame): the waiting room then shows over the table.
 * The panel redraws itself when an invitation arrives or goes (`lobby:changed`).
 *
 * Opened by Overlay (section `online`, ui/overlay/panels.js). Talks to main.js
 * through window events: `auth:open` (login screen), `friends:open` (friends
 * window), `lobby:changed` (the invitation count on the 3D card).
 */

import { authApi } from '../../net/authApi.js';
import { lobbyApi } from '../../net/lobbyApi.js';
import { friendCode } from '../../../shared/auth/rules.js';
import { injectFriendsStyles } from '../friends/styles.js';
import { ago, esc, rowHtml } from '../friends/html.js';
import { injectOnlineStyles } from './styles.js';
import { STACK_OPTIONS, BLIND_OPTIONS, DEFAULT_CONFIG } from '../../config/newGameOptions.js';

const MAX_BOTS = 3; // a shared table seats 5 at most, 2 humans at least

/** @returns {HTMLElement} */
export function renderOnlineMenu() {
  injectFriendsStyles();
  injectOnlineStyles();
  const menu = document.createElement('div');
  menu.className = 'online-menu';
  menu.innerHTML = '<p class="online-text">Chargement…</p>';
  const close = () => menu.closest('.overlay-panel')?.querySelector('.overlay-close')?.click();
  let invitations = [];
  let note = ''; // message to show under the code after the next redraw
  // The table the player is about to create
  const table = { bots: 0, startingStack: DEFAULT_CONFIG.startingStack, blinds: DEFAULT_CONFIG.blinds };
  const sit = (shared, config = {}) => {
    close();
    window.dispatchEvent(new CustomEvent('game:start', { detail: { opponents: [], ...config, shared } }));
  };

  const draw = async () => {
    const me = await authApi.me();
    const user = me.ok ? me.user : null;
    if (!user) {
      menu.innerHTML = `
        <p class="online-text">Pour jouer en ligne, il faut un compte : tes amis te retrouvent
          grâce à ton <b>code ami</b> (Pseudo#1234).</p>
        <div class="online-actions">
          <button type="button" class="wood-btn wood-btn--gold" data-act="login">Se connecter / s’inscrire</button>
        </div>`;
      return;
    }

    const res = await lobbyApi.invitations();
    invitations = res.ok ? res.data.invitations : [];
    menu.innerHTML = `
      <p class="online-text">Ton code ami : <b class="online-code">${esc(friendCode(user))}</b></p>
      <p class="friends-status" role="status" aria-live="polite" ${note ? '' : 'hidden'}>${esc(note)}</p>
      <section class="leather online-block">
        <h3>📨 Invitations reçues <span class="dim">(${invitations.length})</span></h3>
        ${invitations.length ? `<ul class="friend-list">${invitations.map((i) => rowHtml({
          name: i.from.username,
          tag: i.from.tag,
          sub: `t’invite à sa table · ${ago(i.sentAt)}`,
          buttons: `<button type="button" class="wood-btn wood-btn--green" data-act="join" data-id="${i.id}">🎲 Rejoindre</button>
                    <button type="button" class="wood-btn wood-btn--grey" data-act="decline" data-id="${i.id}">Refuser</button>`,
        })).join('')}</ul>` : '<p class="dim">Aucune invitation pour l’instant.</p>'}
      </section>
      <section class="leather online-block">
        <h3>🃏 Créer une table</h3>
        <p class="online-label">IA pour compléter</p>
        <div class="online-choices" role="group" aria-label="Nombre d’IA">${Array.from({ length: MAX_BOTS + 1 }, (_, n) => choice('bots', n, n === 0 ? 'Aucune' : `${n} IA`, table.bots === n)).join('')}</div>
        <p class="online-label">Tapis de départ</p>
        <div class="online-choices" role="group" aria-label="Tapis de départ">${STACK_OPTIONS.map((v) => choice('stack', v, String(v), table.startingStack === v)).join('')}</div>
        <p class="online-label">Blinds</p>
        <div class="online-choices" role="group" aria-label="Blinds">${BLIND_OPTIONS.map((b, i) => choice('blinds', i, `${b.small} / ${b.big}`, table.blinds === b)).join('')}</div>
        <div class="online-actions">
          <button type="button" class="wood-btn wood-btn--gold" data-act="create">➕ Ouvrir la table</button>
        </div>
      </section>
      <section class="leather online-block">
        <h3>🔑 Rejoindre avec un code</h3>
        <form class="friend-search-row online-join">
          <input class="friend-input" name="code" maxlength="6" autocomplete="off" placeholder="ex. K7QX2M" aria-label="Code de la table">
          <button type="submit" class="wood-btn wood-btn--green">Rejoindre</button>
        </form>
      </section>`;
    menu.querySelector('.online-join')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = e.target.code.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) return say('Le code d’une table fait 6 lettres ou chiffres.');
      sit({ join: code });
    });
    note = '';
  };

  const say = (text) => {
    const line = menu.querySelector('.friends-status');
    if (!line) return;
    line.textContent = text;
    line.hidden = !text;
  };

  // One listener for the panel's whole life (the content is redrawn, not the panel)
  menu.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const invitation = invitations.find((i) => i.id === Number(b.dataset.id));
    if (b.dataset.act === 'login') {
      close();
      window.dispatchEvent(new CustomEvent('auth:open'));
    } else if (b.dataset.act === 'join') {
      if (!invitation.tableId) return say(`${invitation.from.username} n’a pas encore ouvert de table : demande-lui de t’inviter depuis sa table.`);
      sit({ join: invitation.tableId });
    } else if (b.dataset.act === 'decline') {
      const res = await lobbyApi.decline(invitation.id);
      note = res.ok ? `Invitation de ${invitation.from.username} refusée.` : res.error;
      window.dispatchEvent(new CustomEvent('lobby:changed')); // redraws this panel and the card's count
    } else if (b.dataset.act === 'create') {
      sit({ create: true, bots: table.bots }, { startingStack: table.startingStack, blinds: table.blinds });
    } else if (b.dataset.act === 'pick') {
      const { field, value } = b.dataset;
      if (field === 'bots') table.bots = Number(value);
      if (field === 'stack') table.startingStack = Number(value);
      if (field === 'blinds') table.blinds = BLIND_OPTIONS[Number(value)];
      b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }
  });

  // An invitation arrived or went (live stream or a refusal here): redraw while shown
  const onChanged = () => {
    if (!menu.isConnected) return window.removeEventListener('lobby:changed', onChanged);
    draw();
  };
  window.addEventListener('lobby:changed', onChanged);

  draw();
  return menu;
}

/** One choice of a segmented control (aria-pressed = chosen, gold). */
function choice(field, value, label, on) {
  return `<button type="button" class="wood-btn" data-act="pick" data-field="${field}" data-value="${value}" aria-pressed="${on}">${esc(label)}</button>`;
}
