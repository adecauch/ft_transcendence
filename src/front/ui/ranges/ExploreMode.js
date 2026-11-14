/**
 * ExploreMode.js — 🔍 Explorer: the example ranges and their lessons
 *
 * Human ranges come from their notation (config/rangePresets.js); the AI's are
 * computed by the server from its MCCFR strategy (aiRanges.js, GET
 * /api/ai/preflop). Hovering a cell explains the hand: combos, equity, what
 * the range does.
 */

import { TOTAL_COMBOS, combos, handKind, handLabel, exampleCards, rangeFromNotation } from '../../../shared/poker/ranges.js';
import { aiRangesNow, loadAiRanges } from './aiRanges.js';
import { ACTIONS, RANGE_PRESETS } from '../../config/rangePresets.js';
import { esc, pct, cardHtml, legendRow, comboLegendHtml, presetPickerHtml, howtoHtml } from './html.js';

const WHY = {
  pair: 'Deux cartes du même rang : 6 façons de les recevoir (♠♥, ♠♦, ♠♣, ♥♦, ♥♣, ♦♣).',
  suited: 'Deux cartes de la même couleur : 4 façons (toutes deux ♠, ♥, ♦ ou ♣). Elles peuvent faire une couleur.',
  offsuit: 'Deux couleurs différentes : 12 façons, trois fois plus que la version assortie.',
};

export class ExploreMode {
  constructor() {
    this.id = 'explore';
    this.paintable = false;
    this.presetId = RANGE_PRESETS[0].id;
  }

  /** The AI's ranges come from the server: draw again once they are here. */
  enter(screen) {
    if (aiRangesNow() === undefined) loadAiRanges().then(() => screen.render());
  }

  /** The chosen example range, ready to draw. */
  view() {
    return presetView(this.presetId);
  }

  sideHtml(view, selected) {
    return `
      ${presetPickerHtml(this.presetId)}
      ${view.error ? `<p class="dim">⚠ ${esc(view.error)}</p>` : ''}
      <p>${esc(view.lesson)}</p>
      <h3>Ce que fait cette range</h3>
      ${comboLegendHtml(view)}
      <h3>La main</h3>
      <div class="detail" aria-live="polite">${this.detailHtml(selected, view)}</div>
      ${howtoHtml()}`;
  }

  detailHtml(hand, view) {
    if (!hand) return '<p class="dim">Passe la souris sur une case pour tout savoir sur cette main ; clique dessus pour la garder affichée.</p>';
    const n = combos(hand);
    const eq = aiRangesNow()?.equity?.[hand];
    const mix = view.range[hand] ?? {};
    const lines = view.actions.filter((a) => (mix[a] ?? 0) >= 0.005).map((a) => legendRow(a, ACTIONS[a].label, pct(mix[a], 0))).join('');
    return `
      <div class="detail-top">
        <span>${exampleCards(hand).map((c) => cardHtml(c)).join('')}</span>
        <span class="detail-name">${handLabel(hand)}<br><span class="detail-code">${hand}</span></span>
      </div>
      <p>${WHY[handKind(hand)]}</p>
      <p><b>${n}</b> combinaisons sur ${TOTAL_COMBOS} : tu la reçois environ <b>une fois toutes les ${Math.round(TOTAL_COMBOS / n)} mains</b>.</p>
      ${eq !== undefined ? `<p>Contre une main au hasard, elle gagne <b>${pct(eq, 0)}</b> du temps si on va jusqu’à l’abattage.</p>` : ''}
      <div class="legend">${lines || legendRow('fold', ACTIONS.fold.label, '100 %')}</div>`;
  }

  bind(side, screen) {
    side.querySelector('#ranges-picker').addEventListener('change', (e) => {
      this.presetId = e.target.value;
      screen.select(null);
      screen.render();
    });
  }
}

/**
 * An example range as a view: { name, situation, lesson, actions, range, error? }.
 * Also used by « Construire » to copy a model.
 */
export function presetView(id) {
  const p = RANGE_PRESETS.find((x) => x.id === id) ?? RANGE_PRESETS[0];
  if (p.notation) return { ...p, range: rangeFromNotation(p.notation, p.actions.at(-1)) };

  const ai = aiRangesNow();
  if (ai === undefined) return { ...p, range: {}, error: 'Chargement des ranges de l’IA…' };
  if (!ai) return { ...p, range: {}, error: 'Les ranges de l’IA sont indisponibles (serveur injoignable ou stratégie absente).' };
  const raw = ai.ranges[p.solver];
  if (!raw) return { ...p, range: {}, error: 'Cette situation n’est pas dans la stratégie de l’IA.' };
  const range = {};
  for (const [hand, mix] of Object.entries(raw)) {
    range[hand] = {};
    for (const [from, to] of Object.entries(p.solverActions)) range[hand][to] = (range[hand][to] ?? 0) + mix[from];
  }
  return { ...p, range };
}
