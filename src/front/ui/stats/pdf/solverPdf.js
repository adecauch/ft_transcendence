/**
 * solverPdf.js — "Face au solveur" as a PDF file (downloaded at once)
 *
 * The same report as the tab (GET /api/stats/solver) and the same words
 * (tabs/solverTab.js): the numbers, then each spot with the player's bar and the
 * solver's bar, drawn as rectangles (sharp at any zoom, unlike a capture).
 */

import { describeHistory } from '../../../../shared/ai/mccfr/historyWords.js';
import { COLORS, LABELS, POSITION, pct, handWords, verdict, referenceWords } from '../tabs/solverTab.js';
import { PdfPage, PAGE, INK, DIM, GOLD, OUTLINE, rgb } from './pdfPage.js';

const ACTIONS = ['fold', 'call', 'raise'];
const BAR = { label: 20, h: 6 };

/** @param {object} report — GET /api/stats/solver, with at least one spot */
export async function exportSolverPdf(report) {
  const page = await PdfPage.create();
  const { doc } = page;
  page.header('Face au solveur', 'Ta façon de jouer comparée à la stratégie du solveur MCCFR');

  page.paragraph(`Chacune de tes décisions est classée comme le fait notre IA : la force de ta main (en « groupes ») et ce qui s’est passé avant. `
    + `Pour les situations rencontrées au moins ${report.minSamples} fois, on compare ta façon de jouer avec ${referenceWords(report.reference)}. `
    + 'Ses tailles de mise (1/3, ½, 2/3 ou tout le pot, relance ×3, tapis) sont comptées ensemble dans « Miser / relancer ».', { color: DIM, gap: 5 });
  page.tiles([
    [String(report.decisions), 'Décisions classées'],
    [String(report.compared), `Situations comparées (${report.minSamples} fois ou plus)`],
    [report.averageGap === null ? '-' : pct(report.averageGap), 'Écart moyen (0 % = comme le solveur)'],
  ]);

  // ── Legend ──
  page.paragraph('Là où tu joues le plus différemment', { size: 14, color: GOLD, bold: true, gap: 2 });
  let x = PAGE.margin;
  doc.setFont('helvetica', 'normal').setFontSize(10);
  for (const a of ACTIONS) {
    doc.setFillColor(...rgb(COLORS[a])).setDrawColor(...INK).setLineWidth(0.3).rect(x, page.y, 4, 4, 'FD');
    doc.setTextColor(...INK).text(LABELS[a], x + 6, page.y + 3.4);
    x += 12 + doc.getTextWidth(LABELS[a]);
  }
  page.y += 9;

  // ── One block per spot, never cut between two pages ──
  for (const s of report.spots) {
    page.ensure(52);
    const top = page.y;
    page.y += 2;
    const inner = { x: PAGE.margin + 4, width: page.width - 8 };
    page.paragraph(describeHistory(s.history, s.round, s.player), { size: 12, bold: true, ...inner });
    page.paragraph(`Tu es ${POSITION[s.player]} · ${handWords(s)} · vu ${s.n} fois`, { size: 9.5, color: DIM, gap: 2.5, ...inner });
    bar(page, inner, 'Toi', s.you);
    bar(page, inner, 'Solveur', s.solver);
    page.paragraph(`${verdict(s)} Écart : ${pct(s.gap)}.`, { size: 10, color: GOLD, gap: 2, ...inner });
    doc.setDrawColor(...OUTLINE).setLineWidth(0.6).roundedRect(PAGE.margin, top, page.width, page.y - top, 2, 2, 'S');
    page.y += 4;
  }

  page.save('face-au-solveur-poker');
}

/** "Toi [■■■■■■■■■■]": the three shares side by side, a % inside when it fits. */
function bar(page, { x, width }, label, mix) {
  const { doc } = page;
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INK).text(label, x, page.y + 4.5);
  const left = x + BAR.label;
  const w = width - BAR.label;
  let at = left;
  for (const a of ACTIONS) {
    const part = w * mix[a];
    if (part > 0) {
      doc.setFillColor(...rgb(COLORS[a])).rect(at, page.y, part, BAR.h, 'F');
      if (part > 12) doc.setFontSize(8.5).setTextColor(255, 255, 255).text(pct(mix[a]), at + part / 2, page.y + 4.3, { align: 'center' });
    }
    at += part;
  }
  doc.setDrawColor(...INK).setLineWidth(0.4).rect(left, page.y, w, BAR.h, 'S');
  page.y += BAR.h + 2;
}
