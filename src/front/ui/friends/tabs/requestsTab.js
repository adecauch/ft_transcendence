/**
 * requestsTab.js — "Demandes": the requests received (accept / refuse) and
 * the ones sent, still waiting (cancel).
 */

import { friendsApi } from '../../../net/friendsApi.js';
import { ago, rowHtml, sectionHtml } from '../html.js';

export const requestsTab = {
  id: 'requests',
  label: '📨 Demandes',

  async open(view) {
    const { incoming, outgoing } = await view.get(friendsApi.requests);
    const button = (act, r, label, colour) =>
      `<button type="button" class="wood-btn wood-btn--${colour}" data-act="${act}" data-id="${r.id}">${label}</button>`;
    return {
      html: `
        ${sectionHtml('Reçues', incoming.length)}
        ${incoming.length ? `<ul class="friend-list">${incoming.map((r) => rowHtml({
          name: r.user.username,
          tag: r.user.tag,
          sub: `Veut être ton ami · ${ago(r.sentAt)}`,
          buttons: button('accept', r, '✔ Accepter', 'green') + button('decline', r, 'Refuser', 'grey'),
        })).join('')}</ul>` : '<p class="dim">Aucune demande reçue.</p>'}
        ${sectionHtml('Envoyées', outgoing.length)}
        ${outgoing.length ? `<ul class="friend-list">${outgoing.map((r) => rowHtml({
          name: r.user.username,
          tag: r.user.tag,
          sub: `En attente · ${ago(r.sentAt)}`,
          buttons: button('cancel', r, 'Annuler', 'grey'),
        })).join('')}</ul>` : '<p class="dim">Aucune demande en attente.</p>'}`,
      bind(body) {
        body.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-act]');
          if (!b) return;
          const id = Number(b.dataset.id);
          const name = [...incoming, ...outgoing].find((r) => r.id === id).user.username;
          if (b.dataset.act === 'accept') view.act(() => friendsApi.accept(id), `${name} est maintenant ton ami !`);
          else if (b.dataset.act === 'decline') view.act(() => friendsApi.decline(id), `Demande de ${name} refusée.`);
          else view.act(() => friendsApi.decline(id), `Demande à ${name} annulée.`);
        });
      },
    };
  },
};
