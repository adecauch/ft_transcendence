/**
 * solverTab.js — "Face au solveur": the player's play next to the solver's
 *
 * GET /api/stats/solver (server/src/stats/solverReport.js): for the spots met
 * most often, how the player spreads their actions (fold / call / raise) vs
 * the solver's strategy at the same infoset, with a sentence on the biggest
 * difference. The "⬇ PDF" button writes the same report to a file
 * (pdf/solverPdf.js, loaded on click only): the words below are exported so
 * the PDF says exactly the same thing.
 */

import { describeHistory } from '../../../../shared/ai/mccfr/historyWords.js';
import { gamesApi } from '../../../net/gamesApi.js';
import { tilesHtml, emptyHtml } from '../format.js';

export const ACTIONS = ['fold', 'call', 'raise'];
export const COLORS = { fold: '#4a4f5c', call: '#43b04a', raise: '#e8503a' };
export const LABELS = { fold: 'Se coucher', call: 'Suivre / checker', raise: 'Miser / relancer' };
const VERBS = { fold: 'te couches', call: 'suis ou checkes', raise: 'mises ou relances' };
export const POSITION = ['petite blinde (tu parles en dernier après le flop)', 'grosse blinde (tu parles en premier après le flop)'];

export const pct = (x) => `${Math.round(100 * x)} %`;

let injected = false;
function injectStyles() {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = `
    .solver-intro { margin: 0 0 1rem; line-height: 1.45; }
    .solver-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .6rem; }
    .solver-head h3 { margin: 0; }
    .solver-sum { display: flex; flex-wrap: wrap; gap: .8rem; margin-bottom: 1rem; }
    .spots { display: flex; flex-direction: column; gap: .8rem; }
    .spot {
      display: flex;
      flex-direction: column;
      gap: .45rem;
      padding: .8rem .9rem;
      background: rgba(255, 230, 180, .1);
      border: 3px solid rgba(0, 0, 0, .45);
      border-radius: 12px;
    }
    .spot-title { font-family: var(--font-ui); font-size: 1.25rem; }
    .spot-sub { font-size: 1rem; color: var(--cream-dim); }
    .spot-bars { display: grid; grid-template-columns: 5.5rem 1fr; gap: .35rem .7rem; align-items: center; }
    .spot-bar { display: flex; height: 1.3rem; border: 3px solid var(--outline); border-radius: 6px; overflow: hidden; }
    .spot-bar span { height: 100%; }
    .spot-verdict { color: var(--gold-hi); }
    .spot-legend { display: flex; flex-wrap: wrap; gap: .3rem 1rem; font-size: .98rem; }
    .spot-legend span::before {
      content: ''; display: inline-block; width: .9em; height: .9em; margin-right: .35em;
      border: 2px solid var(--outline); border-radius: 3px; vertical-align: -.1em; background: var(--c);
    }
  `;
  document.head.appendChild(style);
}

/** A bar split in three: fold, call, raise, each as wide as its share. */
const bar = (mix) => `<span class="spot-bar">${ACTIONS
  .map((a) => `<span style="width:${(100 * mix[a]).toFixed(1)}%;background:${COLORS[a]}" title="${LABELS[a]} ${pct(mix[a])}"></span>`).join('')}</span>`;

/** The player's hand group: its strength after the flop, its hand types before. */
export function handWords(spot) {
  if (spot.strength) return `ta main gagnerait entre ${pct(spot.strength[0])} et ${pct(spot.strength[1])} du temps à l’abattage`;
  const shown = spot.hands.slice(0, 8).join(', ');
  return `ta main est dans le groupe ${shown}${spot.hands.length > 8 ? '…' : ''}`;
}

/** The one difference worth saying: the action where the two differ most. */
export function verdict(spot) {
  const a = ACTIONS.reduce((x, y) => (Math.abs(spot.you[y] - spot.solver[y]) > Math.abs(spot.you[x] - spot.solver[x]) ? y : x));
  return `Tu ${VERBS[a]} ${pct(spot.you[a])} du temps ici, le solveur ${pct(spot.solver[a])}.`;
}

export const solverTab = {
  id: 'solver',
  label: 'Face au solveur',

  async open(view) {
    const report = await view.get(gamesApi.solverReport);
    return { html: reportHtml(report), bind: (body) => bindPdf(body, report) };
  },
};

/** The "⬇ PDF" button: jsPDF and the PDF code are loaded on the first click. */
function bindPdf(body, report) {
  const button = body.querySelector('.solver-pdf');
  button?.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const { exportSolverPdf } = await import('../pdf/solverPdf.js');
      await exportSolverPdf(report);
    } finally {
      button.disabled = false;
    }
  });
}

/** Which strategy the player is compared with (server/src/ai/solverData.js). */
export function referenceWords(reference) {
  if (reference?.kind === 'analysis') return `la stratégie d’analyse du solveur MCCFR (plus entraînée que celle de l’IA, empreinte ${reference.id})`;
  return `la stratégie du solveur MCCFR, celle que joue l’IA${reference ? ` (empreinte ${reference.id})` : ''}`;
}

/** The whole tab: explanation, numbers, then the spots that differ most. */
function reportHtml(report) {
  injectStyles();
  const intro = `
    <p class="solver-intro">Chacune de tes décisions est classée comme le fait notre IA : la force de ta main (en « groupes »),
    et ce qui s’est passé avant. Pour les situations que tu as rencontrées au moins ${report.minSamples} fois,
    on compare ta façon de jouer avec ${referenceWords(report.reference)}. <span class="dim">Le solveur connaît plusieurs tailles de mise
    (⅓, ½, ⅔ ou tout le pot, relance ×3, tapis) : ici elles sont toutes comptées ensemble dans « Miser / relancer ».
    ${report.fromRound > 0 ? 'Seulement après le flop pour l’instant.' : ''}</span></p>`;
  if (!report.decisions) return `${intro}${emptyHtml('Aucune décision enregistrée pour l’instant : joue quelques mains connecté.')}`;

  const tiles = `<div class="solver-sum">${tilesHtml([
    [report.decisions, 'Décisions classées'],
    [report.compared, 'Situations comparées', `${report.fromRound > 0 ? 'après le flop, ' : ''}${report.minSamples} fois ou plus`],
    [report.averageGap === null ? '—' : pct(report.averageGap), 'Écart moyen', '0 % = tu joues comme le solveur'],
  ])}</div>`;
  if (!report.spots.length) return `${intro}${tiles}${emptyHtml(`Pas encore assez de mains pour comparer : chaque situation doit revenir au moins ${report.minSamples} fois.`)}`;

  const head = `<div class="solver-head"><h3>Là où tu joues le plus différemment</h3>
    <button type="button" class="wood-btn wood-btn--gold solver-pdf">⬇ PDF</button></div>`;
  const legend = `<div class="spot-legend">${ACTIONS.map((a) => `<span style="--c:${COLORS[a]}">${LABELS[a]}</span>`).join('')}</div>`;
  return `${intro}${tiles}${head}${legend}<div class="spots">${report.spots.map(spotHtml).join('')}</div>`;
}

/** One spot: what happened, the player's hand, the two bars, the verdict. */
function spotHtml(s) {
  return `
    <div class="spot">
      <span class="spot-title">${describeHistory(s.history, s.round, s.player)}</span>
      <span class="spot-sub">Tu es ${POSITION[s.player]} · ${handWords(s)} · vu ${s.n} fois</span>
      <div class="spot-bars"><span>Toi</span>${bar(s.you)}<span>Solveur</span>${bar(s.solver)}</div>
      <span class="spot-verdict">${verdict(s)} Écart : ${pct(s.gap)}.</span>
    </div>`;
}
