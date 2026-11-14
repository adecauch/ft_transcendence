/**
 * friendsTab.js — "Mes amis": who is online, who is at a table, who is away
 *
 * Online first (in the room, then at a table), then offline by last seen.
 * "Inviter" sends a table invitation (lobbyApi: online friends only; joining
 * comes with the multi-player tables);
 * "Retirer" asks to confirm first (second click).
 */

import { friendsApi } from '../../../net/friendsApi.js';
import { lobbyApi } from '../../../net/lobbyApi.js';
import { rowHtml, sectionHtml, statusText } from '../html.js';

const ORDER = { online: 0, playing: 1, offline: 2 };

export const friendsTab = {
  id: 'friends',
  label: '👥 Mes amis',

  async open(view) {
    const { friends } = await view.get(friendsApi.list);
    if (!friends.length) {
      return '<p class="stats-empty dim">Pas encore d’amis : cherche un joueur dans « ➕ Ajouter ».</p>';
    }
    const sorted = [...friends].sort((a, b) => ORDER[a.status] - ORDER[b.status]
      || (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '') || a.username.localeCompare(b.username));
    const on = sorted.filter((f) => f.status !== 'offline');
    const off = sorted.filter((f) => f.status === 'offline');
    let confirming = null; // id of the friend whose « Retirer » waits for a second click

    return {
      html: `
        ${sectionHtml('En ligne', on.length)}
        ${on.length ? `<ul class="friend-list">${on.map(friendRow).join('')}</ul>` : '<p class="dim">Personne en ligne pour l’instant.</p>'}
        ${sectionHtml('Hors ligne', off.length)}
        <ul class="friend-list">${off.map(friendRow).join('')}</ul>`,
      bind(body) {
        body.addEventListener('click', async (e) => {
          const button = e.target.closest('button[data-act]');
          if (!button) return;
          const id = Number(button.dataset.id);
          const friend = friends.find((f) => f.id === id);
          if (button.dataset.act === 'invite') {
            const at = view.tableId; // waiting at a shared table: the invitation carries its code
            await view.act(() => lobbyApi.invite(id, at), at
              ? `Invitation envoyée à ${friend.username} : il peut rejoindre ta table ${at}.`
              : `Invitation envoyée à ${friend.username}. Ouvre une table (« Table en ligne ») pour qu’il puisse te rejoindre.`);
          } else if (confirming !== id) {
            confirming = id;
            button.textContent = 'Confirmer ?';
            button.classList.replace('wood-btn--grey', 'wood-btn--red');
          } else {
            await view.act(() => friendsApi.remove(id), `${friend.username} n’est plus dans tes amis.`);
          }
        });
      },
    };
  },
};

function friendRow(f) {
  const invite = f.status === 'online'
    ? `<button type="button" class="wood-btn wood-btn--green" data-act="invite" data-id="${f.id}">🎲 Inviter</button>`
    : '';
  return rowHtml({
    name: f.username,
    tag: f.tag,
    sub: statusText(f),
    dot: f.status,
    cls: f.status === 'offline' ? 'friend-row--off' : '',
    buttons: `${invite}<button type="button" class="wood-btn wood-btn--grey" data-act="remove" data-id="${f.id}">Retirer</button>`,
  });
}
