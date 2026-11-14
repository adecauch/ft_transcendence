/**
 * leaderboardTab.js — "Classement": the players ranked by games won
 *
 * GET /api/leaderboard (public ranks, SQL RANK()). The player's row is gold;
 * if they are not in the top, their row comes after a "…". Names carry their
 * #tag: two players may share a pseudo.
 */

import { gamesApi } from '../../../net/gamesApi.js';
import { esc, fmt, pct, emptyHtml } from '../format.js';

export const leaderboardTab = {
  id: 'leaderboard',
  label: 'Classement',

  async open(view) {
    const { players, me } = await view.get(gamesApi.leaderboard);
    if (!players.length) return emptyHtml('Personne au classement pour l’instant : termine une partie !');
    const outside = me && !players.some((p) => p.isMe);
    return `
      <table class="board">
        <thead><tr><th>#</th><th>Joueur</th><th class="num">Victoires</th><th class="num">Parties</th><th class="num">%</th><th class="num hide-small">Mains</th></tr></thead>
        <tbody>
          ${players.map(rowHtml).join('')}
          ${outside ? `<tr class="gap"><td colspan="6">…</td></tr>${rowHtml(me)}` : ''}
        </tbody>
      </table>
      ${me ? '' : '<p class="dim">Termine une partie pour apparaître au classement.</p>'}`;
  },
};

/** One player's line. */
function rowHtml(p) {
  return `
    <tr class="${p.isMe ? 'me' : ''}">
      <td>${p.rank}</td>
      <td>${esc(p.username)}<span class="dim">#${p.tag}</span>${p.isMe ? ' (toi)' : ''}</td>
      <td class="num">${p.wins}</td>
      <td class="num">${p.games}</td>
      <td class="num">${pct(p.wins, p.games)}</td>
      <td class="num hide-small">${fmt(p.hands)}</td>
    </tr>`;
}
