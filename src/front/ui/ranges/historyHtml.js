/**
 * historyHtml.js — « Mon historique »: the mistakes and biggest losses lists
 *
 * Data from GET /api/stats/range (shared/stats/rangeAnalysis.js).
 */

import { handLabel } from '../../../shared/poker/ranges.js';
import { esc, pct, cardHtml } from './html.js';

const date = (d) => new Date(d).toLocaleDateString('fr-FR');
export const bbText = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

/** Clear-cut preflop mistakes; each one is a button that shows its hand in the grid. */
export function mistakesHtml(mistakes) {
  if (!mistakes.length) return '<p class="notice">Aucune erreur nette avant le flop : bien joué ! (On ne relève ici que les fautes claires.)</p>';
  return `<div class="notes">${mistakes.map((m) => `
    <button type="button" class="note" data-hand="${m.type}" style="--note:${m.rule === 'call-trash' ? '#f0a414' : 'var(--red-hi)'}">
      <span class="note-head">
        <span>${m.example.cards.map((x) => cardHtml(x, 'small')).join('')}</span>
        <span class="note-title">${esc(m.title)}</span>
        <span class="note-bad">${m.count} fois</span>
      </span>
      <span>Avec ${handLabel(m.type)} (<b>${m.type}</b>)${m.equity !== null ? `, qui gagne ${pct(m.equity, 0)} contre une main au hasard` : ''}. ${esc(m.explain)}</span>
      <span class="note-meta">Par exemple : main ${m.example.number} du ${date(m.example.playedAt)}${m.costBB < 0 ? ` · ces mains t’ont coûté ${bbText(-m.costBB)} grosses blindes` : ''}</span>
    </button>`).join('')}</div>`;
}

/** The hands that cost the most big blinds, with the board and what the opponent showed. */
export function lossesHtml(losses) {
  if (!losses.length) return '<p class="dim">Aucune main perdue pour l’instant.</p>';
  return `<div class="notes">${losses.map((l) => {
    let how;
    if (l.result === 'showdown' && l.handName) {
      const opp = l.shown.map((o) => `${esc(o.name)} avait ${o.hole.map((x) => cardHtml(x, 'small')).join('')} : ${esc(o.handName.toLowerCase())}`).join(' ; ');
      how = `Abattage : tu avais ${esc(l.handName.toLowerCase())}. ${opp}.`;
    } else if (l.folded) {
      how = 'Tu t’es couché après avoir mis ces jetons dans le pot.';
    } else {
      how = 'L’adversaire a remporté le pot.';
    }
    return `
      <div class="note" style="--note:#8a8074">
        <span class="note-head">
          <span>${l.cards.map((x) => cardHtml(x, 'small')).join('')}</span>
          <span class="note-title">Main ${l.number}</span>
          <span class="note-bad">−${bbText(-l.bbs)} BB</span>
        </span>
        ${l.board.length ? `<span>Board : ${l.board.map((x) => cardHtml(x, 'small')).join('')}</span>` : ''}
        <span>${how}</span>
        <span class="note-meta">${date(l.playedAt)} · ${Math.abs(l.chips)} jetons perdus</span>
      </div>`;
  }).join('')}</div>`;
}
