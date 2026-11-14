/**
 * historyTab.js — "Historique": the games, then one game's hands
 *
 *   the list     GET /api/games, newest first, a page at a time ("Voir plus")
 *   one game     GET /api/games/:id: every hand (handHtml.js), each opening
 *                on its moves; "← Toutes les parties" goes back
 *
 * Both pages go through view.load(): a click that loads a page while another
 * tab opens is simply dropped (see StatsMenu._load).
 */

import { gamesApi } from '../../../net/gamesApi.js';
import { esc, fmt, signed, netClass, date, time, emptyHtml, STATUS, LEVEL } from '../format.js';
import { handHtml } from './handHtml.js';

export const historyTab = {
  id: 'history',
  label: 'Historique',

  /** The list of games. */
  async open(view) {
    const { games, next } = await view.get(gamesApi.list);
    if (!games.length) return emptyHtml('Aucune partie pour l’instant.');
    return { html: '<div class="rows"></div>', bind: (body) => appendGames(view, body.querySelector('.rows'), games, next) };
  },
};

/** Add a page of games to the list, and a "Voir plus" button if more remain. */
function appendGames(view, rows, games, next) {
  rows.querySelector('.stats-more')?.remove();
  for (const g of games) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row';
    row.innerHTML = gameRowHtml(g);
    row.addEventListener('click', () => view.load(() => openGame(view, g.id)));
    rows.appendChild(row);
  }
  if (!next) return;
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'stats-more wood-btn';
  more.textContent = 'Voir plus';
  more.addEventListener('click', async () => {
    more.disabled = true;
    const res = await gamesApi.list(next);
    if (res.ok) appendGames(view, rows, res.data.games, res.data.next);
    else more.disabled = false;
  });
  rows.appendChild(more);
}

/** One line of the list: status, opponents, date, hands, blinds, result. */
function gameRowHtml(g) {
  const status = STATUS[g.status];
  const opponents = g.opponents.map((o) => `${esc(o.name)} (${LEVEL[o.level] ?? esc(o.level)})`).join(', ');
  return `
    <span class="badge ${status.cls}">${status.label}</span>
    <span class="row-main">
      <span class="row-title">Contre ${opponents}</span><br>
      <span class="row-sub">${date(g.startedAt)} à ${time(g.startedAt)} · ${g.handsPlayed} main${g.handsPlayed > 1 ? 's' : ''} · tapis ${fmt(g.startingStack)} · blindes ${g.blinds.small}/${g.blinds.big}</span>
    </span>
    <span class="row-net ${netClass(g.net)}">${signed(g.net)}</span>`;
}

/** One game: every hand, and the way back to the list. */
async function openGame(view, id) {
  const { game, hands } = await view.get(() => gamesApi.get(id));
  const status = STATUS[game.status];
  const names = ['Toi', ...game.opponents.map((o) => o.name)];
  return {
    html: `
      <button type="button" class="stats-back wood-btn wood-btn--grey">← Toutes les parties</button>
      <h3>Partie du ${date(game.startedAt)} <span class="badge ${status.cls}">${status.label}</span></h3>
      <div class="rows">
        ${hands.length ? hands.map((h) => handHtml(h, names)).join('') : '<p class="stats-empty dim">Aucune main terminée.</p>'}
      </div>`,
    bind: (body) => body.querySelector('.stats-back').addEventListener('click', () => view.load(() => historyTab.open(view))),
  };
}
