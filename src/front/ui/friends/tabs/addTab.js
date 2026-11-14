/**
 * addTab.js — "Ajouter": find a player and send a friend request
 *
 * By friend code ("CalamityJane#1852": exactly that player) or by a piece of
 * pseudo (several players may wear the same one: the #tag tells them apart).
 * The search runs on submit (button or Entrée), not at every key: one request
 * per search once the server answers. The button of each result follows the
 * relation: ajouter · demande envoyée · accepter (they asked you) · déjà ami.
 */

import { friendsApi } from '../../../net/friendsApi.js';
import { esc, rowHtml } from '../html.js';

const MIN_QUERY = 2;

export const addTab = {
  id: 'add',
  label: '➕ Ajouter',
  query: '',

  async open(view) {
    const tab = this;
    const results = tab.query.length >= MIN_QUERY ? (await view.get(() => friendsApi.search(tab.query))).players : null;
    return {
      html: `
        <form class="friend-search" role="search">
          <label class="saloon-label" for="friend-query">Code ami ou pseudo</label>
          <div class="friend-search-row">
            <input id="friend-query" class="friend-input" type="search" autocomplete="off"
                   maxlength="40" placeholder="ex. CalamityJane#1852" value="${esc(tab.query)}">
            <button type="submit" class="wood-btn wood-btn--gold">🔍 Chercher</button>
          </div>
        </form>
        ${resultsHtml(results, tab.query)}`,
      bind(body) {
        const input = body.querySelector('#friend-query');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        body.querySelector('.friend-search').addEventListener('submit', (e) => {
          e.preventDefault();
          const query = input.value.trim();
          if (query.length < MIN_QUERY) return view.say(`Tape au moins ${MIN_QUERY} lettres.`, true);
          tab.query = query;
          view.refresh();
        });
        body.querySelector('.friend-list')?.addEventListener('click', (e) => {
          const b = e.target.closest('button[data-act]');
          if (!b) return;
          const p = results.find((r) => r.id === Number(b.dataset.id));
          if (b.dataset.act === 'add') {
            view.act(() => friendsApi.add(p.id), (data) => (data.friend
              ? `${p.username} t’avait déjà demandé : vous êtes amis !`
              : `Demande envoyée à ${p.username}.`));
          }
          else view.open('requests'); // they asked you: accept it there
        });
      },
    };
  },
};

function resultsHtml(results, query) {
  if (!results) return '<p class="dim">Tape son <b>code ami</b> (Pseudo#1234) pour trouver exactement ce joueur, ou un bout de pseudo : plusieurs joueurs peuvent porter le même.</p>';
  if (!results.length) return `<p class="dim">Personne ne correspond à « ${esc(query)} ».</p>`;
  return `<ul class="friend-list">${results.map((p) => rowHtml({ name: p.username, tag: p.tag, sub: SUB[p.relation], buttons: buttonHtml(p) })).join('')}</ul>`;
}

const SUB = {
  none: 'Pas encore ami',
  friend: 'Déjà dans tes amis',
  outgoing: 'Demande envoyée, en attente',
  incoming: 'Il t’a demandé en ami',
};

function buttonHtml(p) {
  if (p.relation === 'none') return `<button type="button" class="wood-btn wood-btn--gold" data-act="add" data-id="${p.id}">➕ Ajouter</button>`;
  if (p.relation === 'incoming') return `<button type="button" class="wood-btn wood-btn--green" data-act="answer" data-id="${p.id}">Répondre</button>`;
  return `<button type="button" class="wood-btn wood-btn--grey" disabled>${p.relation === 'friend' ? 'Déjà ami' : 'Envoyée'}</button>`;
}
