/**
 * WaitingRoom.js — The waiting room of a shared table (online mode)
 *
 * Shown over the 3D table while the shared table waits for its players
 * (server `lobby` messages, through TableController.onLobby): the table code
 * to give to friends, who sits there (👑 the host, connected or not), the AIs
 * the host added. The host starts the game (2 players at least, everyone
 * connected); anyone can invite friends or leave. Gone once the cards are dealt.
 *
 *   const room = new WaitingRoom({ onStart, onInvite, onLeave });
 *   room.update(lobbyState);   room.hide();
 */

import { esc } from '../friends/html.js';
import { injectFriendsStyles } from '../friends/styles.js';
import { injectOnlineStyles } from './styles.js';

export class WaitingRoom {
  /** @param {{ onStart: () => void, onInvite: () => void, onLeave: () => void }} actions */
  constructor({ onStart, onInvite, onLeave }) {
    injectFriendsStyles();
    injectOnlineStyles();
    this.state = null;
    const root = document.createElement('div');
    root.className = 'waiting-room wood-panel';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Salle d’attente de la table');
    root.hidden = true;
    document.body.appendChild(root);
    this._root = root;
    root.addEventListener('click', (e) => {
      const act = e.target.closest('button[data-act]')?.dataset.act;
      if (act === 'start') onStart();
      else if (act === 'invite') onInvite();
      else if (act === 'leave') onLeave();
      else if (act === 'copy') this._copy();
    });
  }

  /** A new state of the table: redraw (or hide once the game is on). */
  update(state) {
    this.state = state;
    if (state.status !== 'waiting') return this.hide();
    const isHost = state.host.id === state.you;
    const away = state.players.some((p) => !p.connected);
    const enough = state.players.length >= state.minPlayers;
    const seats = state.players.length + state.bots;
    const hint = !isHost ? `En attente que ${esc(state.host.username)} lance la partie…`
      : !enough ? `Il faut au moins ${state.minPlayers} joueurs : donne le code à un ami, ou invite-le.`
        : away ? 'Un joueur s’est déconnecté : attends son retour.'
          : 'Tout le monde est là ? Lance la partie !';
    this._root.innerHTML = `
      <div class="waiting-head">
        <h2 class="wood-sign saloon-ol waiting-sign">Table ${esc(state.tableId)}</h2>
      </div>
      <p class="online-text waiting-code">Code de la table : <b class="online-code">${esc(state.tableId)}</b>
        <button type="button" class="wood-btn wood-btn--gold" data-act="copy">📋 Copier</button></p>
      <p class="friends-status" role="status" aria-live="polite" hidden></p>
      <section class="leather online-block">
        <h3>🤠 Joueurs <span class="dim">(${seats} / ${state.maxSeats})</span></h3>
        <ul class="friend-list">${state.players.map((p) => playerRow(p, state)).join('')}</ul>
        ${state.bots ? `<p class="online-text">+ ${state.bots} IA ${state.bots > 1 ? 'complètent' : 'complète'} la table</p>` : ''}
        <p class="online-text dim">Tapis ${state.config.startingStack} · blinds ${state.config.blinds.small} / ${state.config.blinds.big}</p>
      </section>
      <p class="online-text waiting-hint">${hint}</p>
      <div class="online-actions">
        ${isHost ? `<button type="button" class="wood-btn wood-btn--green" data-act="start" ${enough && !away ? '' : 'disabled'}>▶ Lancer la partie</button>` : ''}
        <button type="button" class="wood-btn" data-act="invite">👥 Inviter des amis</button>
        <button type="button" class="wood-btn wood-btn--red" data-act="leave">Quitter la table</button>
      </div>`;
    this._root.hidden = false;
  }

  hide() {
    this._root.hidden = true;
  }

  async _copy() {
    const line = this._root.querySelector('.friends-status');
    try {
      await navigator.clipboard.writeText(this.state.tableId);
      line.textContent = `Code ${this.state.tableId} copié : envoie-le à un ami.`;
    } catch {
      line.textContent = `Copie impossible ici : recopie ${this.state.tableId} à la main.`;
    }
    line.hidden = false;
  }
}

function playerRow(p, state) {
  const sub = p.id === state.host.id ? '👑 Hôte de la table' : 'Assis à la table';
  return `
    <li class="friend-row ${p.connected ? '' : 'friend-row--off'}">
      <span class="friend-dot friend-dot--${p.connected ? 'online' : 'offline'}" aria-hidden="true"></span>
      <span class="friend-who">
        <span class="friend-name">${esc(p.username)}<span class="friend-tag">#${p.tag}</span>${p.id === state.you ? ' (toi)' : ''}</span>
        <span class="friend-sub">${p.connected ? sub : 'Déconnecté… (il peut revenir)'}</span>
      </span>
    </li>`;
}
