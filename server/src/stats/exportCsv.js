/**
 * exportCsv.js — The player's hands as a CSV file (the dashboard's filters)
 *
 * One line per hand, oldest first, amounts in chips AND in big blinds.
 * Opens in Excel / LibreOffice / pandas: comma separator, fields quoted when
 * needed, UTF-8 with a BOM (without it Excel shows "Ã©" instead of "é").
 * A cell starting with = + - @ would run as a formula in a spreadsheet
 * (CSV injection): text cells get a leading apostrophe; plain numbers are left alone.
 */

import { filteredHands } from './dashboard.js';

const MAX_ROWS = 100000;
const POSITION = { button: 'bouton', sb: 'petite blinde', bb: 'grosse blinde', other: 'autre' };
const LEVEL = { beginner: 'débutant', regular: 'confirmé', expert: 'expert', mixed: 'mélangé' };

const COLUMNS = [
  ['date', (h) => h.playedAt.toISOString()],
  ['partie', (h) => h.gameId],
  ['main', (h) => h.number],
  ['niveau_ia', (h) => LEVEL[h.level] ?? h.level],
  ['adversaires', (h) => h.nopp],
  ['position', (h) => POSITION[h.position]],
  ['cartes', (h) => h.heroHole.join(' ')],
  ['board', (h) => h.board.join(' ')],
  ['grosse_blinde', (h) => h.big],
  ['resultat_jetons', (h) => h.heroNet],
  ['resultat_bb', (h) => Math.round((100 * h.heroNet) / h.big) / 100],
  ['pot', (h) => h.pot],
  ['vpip', (h) => (h.heroVpip ? 1 : 0)],
  ['pfr', (h) => (h.heroPfr ? 1 : 0)],
  ['abattage', (h) => (h.heroShowdown ? 1 : 0)],
  ['abattage_gagne', (h) => (h.heroShowdownWon ? 1 : 0)],
  ['main_montree', (h) => h.heroHandName ?? ''],
];

/** @param {import('@prisma/client').PrismaClient} prisma @returns {Promise<string>} */
export async function exportCsv(prisma, userId, query = {}) {
  const rows = await prisma.$queryRaw`
    SELECT f.*, CASE WHEN f.button = 0 THEN 'button' WHEN f.sb = 0 THEN 'sb'
                     WHEN f.bb = 0 THEN 'bb' ELSE 'other' END AS position
    FROM ${filteredHands(userId, query)}
    ORDER BY f."playedAt", f.id
    LIMIT ${MAX_ROWS}`;
  const lines = [COLUMNS.map(([name]) => name), ...rows.map((h) => COLUMNS.map(([, get]) => get(h)))];
  return `﻿${lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export function csvCell(value) {
  if (typeof value === 'number') return String(value);
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
