/**
 * totalsTab.js — "Statistiques": the player's totals, in tiles
 *
 * GET /api/stats (server/src/stats/totals.js): games won / lost / quit,
 * hands, showdowns, chips won, biggest pot, VPIP and PFR.
 */

import { gamesApi } from '../../../net/gamesApi.js';
import { fmt, pct, signed, tilesHtml, emptyHtml } from '../format.js';

export const totalsTab = {
  id: 'stats',
  label: 'Statistiques',

  async open(view) {
    const { totals: t } = await view.get(gamesApi.stats);
    if (!t.games) return emptyHtml('Aucune partie pour l’instant.<br>Lance une partie : elle sera enregistrée ici.');
    const finished = t.gamesWon + t.gamesLost + t.gamesQuit;
    return tilesHtml([
      [t.games, 'Parties jouées'],
      [t.gamesWon, 'Parties gagnées'],
      [t.gamesLost, 'Parties perdues'],
      [t.gamesQuit, 'Abandons'],
      [pct(t.gamesWon, finished), 'De victoires', 'Parties terminées gagnées'],
      [fmt(t.hands), 'Mains jouées'],
      [pct(t.handsWon, t.hands), 'Mains gagnées', `${fmt(t.handsWon)} mains`],
      [`${t.showdownsWon} / ${t.showdowns}`, 'Abattages gagnés'],
      [signed(t.net), 'Jetons gagnés', 'Total, toutes parties'],
      [fmt(t.biggestPot), 'Plus gros pot'],
      [pct(t.vpipHands, t.hands), 'VPIP', 'Mains où tu as misé de toi-même avant le flop'],
      [pct(t.pfrHands, t.hands), 'PFR', 'Mains où tu as relancé avant le flop'],
    ]);
  },
};
