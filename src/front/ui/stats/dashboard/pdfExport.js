/**
 * pdfExport.js — The dashboard as a PDF file (downloaded at once)
 *
 * The page itself (jsPDF, leather background, title, tiles) comes from
 * stats/pdf/pdfPage.js; here only the charts. They are drawn in cream for the
 * screen, they stay readable on the dark page as they are.
 */

import { PdfPage, PAGE, GOLD, latin1 } from '../pdf/pdfPage.js';

/**
 * @param {{ subtitle: string, tiles: [string, string][], charts: { title: string, canvas: HTMLCanvasElement, wide?: boolean }[] }} report
 */
export async function exportPdf({ subtitle, tiles, charts }) {
  const page = await PdfPage.create();
  const { doc } = page;
  page.header('Tableau de bord', subtitle);
  page.tiles(tiles);

  // ── Charts, two per row; a wide one (the curve) takes a whole row ──
  const gap = 6;
  const half = (page.width - gap) / 2;
  let col = 0;
  let rowH = 0;
  const newRow = () => { page.y += rowH + 12; col = 0; rowH = 0; };
  charts.forEach(({ title, canvas, wide }) => {
    if (wide && col) newRow();
    const w = wide ? page.width : half;
    const h = Math.min(wide ? 80 : 70, (w * canvas.height) / canvas.width);
    if (col === 0) page.ensure(h + 8);
    const x = PAGE.margin + col * (half + gap);
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...GOLD).text(latin1(title), x, page.y + 4);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, page.y + 6, w, h);
    rowH = Math.max(rowH, h);
    if (wide || col === 1) newRow();
    else col = 1;
  });

  page.save('tableau-de-bord-poker');
}
