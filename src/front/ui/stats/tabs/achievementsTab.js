/**
 * achievementsTab.js — "Succès": every achievement, unlocked ones with their date
 *
 * The list and its words come from shared/stats/achievements.js (the server
 * unlocks them with the same file); GET /api/stats says which are unlocked.
 */

import { gamesApi } from '../../../net/gamesApi.js';
import { ACHIEVEMENTS } from '../../../../shared/stats/achievements.js';
import { date } from '../format.js';

export const achievementsTab = {
  id: 'achievements',
  label: 'Succès',

  async open(view) {
    const { achievements } = await view.get(gamesApi.stats);
    const unlocked = new Map(achievements.map((a) => [a.id, a.unlockedAt]));
    return `
      <h3>${unlocked.size} / ${ACHIEVEMENTS.length} succès débloqués</h3>
      <div class="achievements">${ACHIEVEMENTS.map((a) => achievementHtml(a, unlocked.get(a.id))).join('')}</div>`;
  },
};

/** One achievement: its icon and date if unlocked, a padlock otherwise. */
function achievementHtml(a, when) {
  return `
    <div class="achievement${when ? '' : ' locked'}">
      <span class="achievement-icon" aria-hidden="true">${when ? a.icon : '🔒'}</span>
      <span>
        <span class="achievement-name">${a.name}</span><br>
        <span class="achievement-desc">${a.description}${when ? ` · le ${date(when)}` : ''}</span>
      </span>
    </div>`;
}
