/**
 * theoryHtml.js — « Mon historique »: the player's range next to the theory
 *
 * Pieces built on the preflop theory model (shared/theory/preflopModel.js):
 *   the heat map colours (big blinds lost per 100 hands, per cell),
 *   the "manque à gagner" summary and its worst hands,
 *   the per-hand comparison (what each action is worth, you vs the theory),
 *   how the model works, for the curious.
 * Model actions are fold / call / raise; `spot.actions` gives their names in
 * this situation (limp, check, 3-bet…).
 */

import { handLabel, exampleCards } from '../../../shared/poker/ranges.js';
import { SIZES, REALIZE } from '../../../shared/theory/preflopModel.js';
import { ACTIONS } from '../../config/rangePresets.js';
import { cardHtml, pct } from './html.js';
import { bbText } from './historyHtml.js';

/** Model action → position in the situation's action ids ([raise-like, call-like, fold]). */
const SLOT = { raise: 0, call: 1, fold: 2 };
const MODEL = ['raise', 'call', 'fold'];

/** The player's frequencies in model terms, from the counts of a cell. */
export const mixOf = (c) => ({ raise: c.raise / c.n, call: c.call / c.n, fold: c.fold / c.n });

/** Heat map colour: green (plays like the theory) → yellow → red (≥ HOT BB lost per 100 hands). */
const HOT = 60;
export function heatColor(lossPer100) {
  const t = Math.max(0, Math.min(1, lossPer100 / HOT));
  const stops = [[0, [58, 138, 74]], [0.35, [214, 162, 30]], [1, [216, 48, 28]]];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const k = (t - t0) / (t1 - t0);
  const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
  return `rgb(${c.join(',')})`;
}

export function heatLegendHtml() {
  return `
    <div class="heat-legend">
      <span class="heat-bar" style="background:linear-gradient(90deg, ${heatColor(0)}, ${heatColor(HOT * 0.35)}, ${heatColor(HOT)})"></span>
      <span class="heat-labels"><span>0 : comme la théorie</span><span>${HOT}+ BB perdues / 100 mains</span></span>
    </div>`;
}

/**
 * What the player's decisions cost in this situation, against the theory.
 * @returns {{ total: number, decisions: number, per100: number, worst: { hand: string, lost: number, n: number }[] }}
 */
export function lossSummary(model, spotId, counts) {
  let total = 0;
  let decisions = 0;
  const byHand = [];
  for (const [hand, c] of Object.entries(counts)) {
    const lost = (c.n * model.per100(spotId, hand, mixOf(c)).loss) / 100; // BB over those hands
    total += lost;
    decisions += c.n;
    if (lost > 0.05) byHand.push({ hand, lost, n: c.n });
  }
  byHand.sort((a, b) => b.lost - a.lost);
  return { total, decisions, per100: decisions ? (100 * total) / decisions : 0, worst: byHand.slice(0, 5) };
}

export function summaryHtml(s) {
  if (!s.decisions) return '';
  return `
    <div class="loss-box">
      <span class="loss-big">${s.total < 0.05 ? '0' : `−${bbText(s.total)}`} BB</span>
      <span>de manque à gagner estimé sur tes <b>${s.decisions}</b> décisions dans cette situation,
      soit <b>${bbText(s.per100)} BB pour 100 décisions</b>.</span>
    </div>
    ${s.worst.length ? `
      <p class="dim">Là où tu perds le plus (clique pour voir la main) :</p>
      <div class="worst">${s.worst.map((w) => `
        <button type="button" class="wood-btn worst-hand" data-hand="${w.hand}">
          <b>${w.hand}</b> −${bbText(w.lost)} BB <span class="dim">(${w.n} fois)</span>
        </button>`).join('')}</div>` : ''}`;
}

/**
 * One hand: what each action is worth, how the player played it, how the theory would.
 * @param {object | undefined} c — the player's counts for this hand (undefined: never dealt here)
 */
export function comparisonHtml(model, spot, hand, c) {
  const ev = model.evs(spot.id, hand);
  const theory = model.best(spot.id, hand);
  const mine = c ? mixOf(c) : null;
  const rows = MODEL.map((a) => {
    const id = spot.actions[SLOT[a]];
    return `
      <tr>
        <td><span class="swatch" style="background:${ACTIONS[id].color}"></span> ${ACTIONS[id].label}</td>
        <td class="num">${ev[a] >= 0 ? '+' : ''}${bbText(ev[a])}</td>
        <td class="num">${mine ? pct(mine[a], 0) : '—'}</td>
        <td class="num">${pct(theory[a] ?? 0, 0)}</td>
      </tr>`;
  }).join('');

  const head = `
    <div class="detail-top">
      <span>${exampleCards(hand).map((x) => cardHtml(x)).join('')}</span>
      <span class="detail-name">${handLabel(hand)}<br><span class="detail-code">${hand}</span></span>
    </div>`;
  const table = `
    <table class="ev-table">
      <thead><tr><th>Action</th><th class="num">Gain moyen</th><th class="num">Toi</th><th class="num">Théorie</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="dim">Gain moyen = ce que rapporte l’action à chaque fois, en grosses blindes, blindes comprises.</p>`;

  if (!c) return `${head}<p class="dim">Tu n’as jamais reçu cette main ici. Voici ce qu’en dit la théorie :</p>${table}`;
  const r = model.per100(spot.id, hand, mine);
  return `${head}
    <p>Reçue <b>${c.n} fois</b> ici. Sur <b>100 fois</b> cette main, en jouant comme toi :</p>
    <div class="per100">
      <span><span class="dim">Toi</span><b class="${r.player >= 0 ? 'plus' : 'minus'}">${r.player >= 0 ? '+' : ''}${bbText(r.player)} BB</b></span>
      <span><span class="dim">Théorie</span><b class="${r.theory >= 0 ? 'plus' : 'minus'}">${r.theory >= 0 ? '+' : ''}${bbText(r.theory)} BB</b></span>
      <span><span class="dim">Manque à gagner</span><b class="${r.loss < 1 ? 'plus' : 'minus'}">${r.loss < 1 ? '0' : `−${bbText(r.loss)}`} BB</b></span>
    </div>
    ${table}`;
}

/** How the numbers are made, in plain words. */
export function modelHowtoHtml() {
  return `
    <details class="howto">
      <summary>🧮 Comment c’est calculé ?</summary>
      <div class="howto-body">
        <p>Pour chaque main et chaque action, on estime le <b>gain moyen</b> en grosses blindes, en
        <b>tête-à-tête</b> (comme notre solveur) :</p>
        <p>• l’adversaire répond comme un bon joueur : il se couche, suit ou relance aussi souvent que ses
        ranges de référence (onglet Explorer, groupe « Tête-à-tête ») ;</p>
        <p>• ensuite, chacun récupère sa part du pot selon son <b>équité</b> (ses chances de gagner à l’abattage
        contre la range adverse, tirées d’une table de 169 × 169 duels de mains). On en récupère un peu moins
        quand on parle en premier après le flop : ${pct(REALIZE.inPosition, 0)} en position, ${pct(REALIZE.outOfPosition, 0)} hors de position ;</p>
        <p>• mises : ouverture à ${bbText(SIZES.open)} BB, relance sur un limp à ${SIZES.iso} BB, sur-relance à ${SIZES.threeBet} BB,
        re-sur-relance à ${SIZES.fourBet} BB.</p>
        <p>La <b>théorie</b> joue, pour chaque main, l’action qui rapporte le plus (plusieurs si elles se valent).
        Le <b>manque à gagner</b> est la différence entre ce que rapporte ta façon de jouer et la théorie.</p>
        <p class="dim">C’est un modèle simplifié (pas de jeu après le flop, pas de lecture de l’adversaire) : il montre bien
        les grosses fuites, pas les détails. À plusieurs joueurs, les chiffres sont approximatifs.</p>
      </div>
    </details>`;
}
