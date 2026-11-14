/**
 * pdfPage.js — What every PDF export of the game shares (jsPDF)
 *
 * jsPDF is loaded only when an export is asked (dynamic import: Vite puts it
 * in its own file, the game never downloads it otherwise). The pages are dark
 * brown like the leather of the stats menu, the text cream and gold.
 *
 * A PdfPage keeps a cursor `y` (mm from the top) and starts a new page when
 * something would not fit: the exports only say what to write, in order.
 *
 * The PDF's built-in fonts only know Latin-1 (é, à, ç, ½ are fine): the few
 * typographic signs outside it (−, ’, …, ⅓) are replaced.
 */

export const PAGE = { w: 210, h: 297, margin: 12 };
export const INK = [255, 241, 210];
export const DIM = [240, 217, 173];
export const GOLD = [247, 187, 42];
export const OUTLINE = [20, 10, 4];
const LEATHER = [52, 30, 18];

export const latin1 = (s) => String(s)
  .replace(/−/g, '-').replace(/[’‘]/g, "'").replace(/…/g, '...')
  .replace(/⅓/g, '1/3').replace(/⅔/g, '2/3')
  .replace(/[^\x20-\xff]/g, '');

/** '#43b04a' → [67, 176, 74] */
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export class PdfPage {
  /** Use PdfPage.create(): jsPDF has to be loaded first. */
  constructor(jsPDF) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' });
    this.width = PAGE.w - 2 * PAGE.margin;
    this._paint();
    this.y = PAGE.margin;
  }

  static async create() {
    const { jsPDF } = await import('jspdf');
    return new PdfPage(jsPDF);
  }

  _paint() {
    this.doc.setFillColor(...LEATHER);
    this.doc.rect(0, 0, PAGE.w, PAGE.h, 'F');
  }

  /** Start a new page unless `h` mm still fit below the cursor. */
  ensure(h) {
    if (this.y + h <= PAGE.h - PAGE.margin) return;
    this.doc.addPage();
    this._paint();
    this.y = PAGE.margin;
  }

  /** Big gold title, then the subtitle and the export date. */
  header(title, subtitle) {
    this.y += 6;
    this.doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(...GOLD);
    this.doc.text(latin1(`Poker Transcendence - ${title}`), PAGE.margin, this.y);
    this.y += 8;
    this.doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...DIM);
    const date = `exporté le ${new Date().toLocaleString('fr-FR')}`;
    this.doc.text(latin1(subtitle ? `${subtitle} · ${date}` : date), PAGE.margin, this.y);
    this.y += 8;
  }

  /** A paragraph wrapped to `width`; returns its height (mm). */
  paragraph(text, { size = 10, color = INK, bold = false, x = PAGE.margin, width = this.width, gap = 1.5 } = {}) {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...color);
    const lines = this.doc.splitTextToSize(latin1(text), width);
    const lineH = size * 0.42;
    this.ensure(lines.length * lineH + gap);
    this.doc.text(lines, x, this.y + lineH * 0.8);
    this.y += lines.length * lineH + gap;
    return lines.length * lineH + gap;
  }

  /** The numbers of the report, up to 4 per row, long labels wrapped: [value, label][] */
  tiles(tiles) {
    const cols = Math.min(4, tiles.length);
    const colW = this.width / cols;
    this.doc.setFont('helvetica', 'normal').setFontSize(9);
    const labels = tiles.map(([, label]) => this.doc.splitTextToSize(latin1(label), colW - 4));
    for (let start = 0; start < tiles.length; start += cols) {
      const lines = Math.max(...labels.slice(start, start + cols).map((l) => l.length));
      const rowH = 11 + lines * 3.8;
      this.ensure(rowH);
      tiles.slice(start, start + cols).forEach(([value], j) => {
        const x = PAGE.margin + j * colW;
        this.doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...INK).text(latin1(value), x, this.y + 5);
        this.doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...DIM).text(labels[start + j], x, this.y + 10);
      });
      this.y += rowH;
    }
    this.y += 4;
  }

  /** Download the file. */
  save(name) {
    this.doc.save(`${name}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
}
