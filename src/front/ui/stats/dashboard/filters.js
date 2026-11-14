/**
 * filters.js — The dashboard's filters: period, AI level, number of AIs
 *
 * State → query string for the server (server/src/stats/schemas.js). Days are
 * the player's own: "7 jours" starts at midnight, local time, 6 days ago, and
 * the browser sends its time zone so the server cuts the time line the same way.
 */

export const PERIODS = [
  { id: '7', label: '7 jours', days: 7 },
  { id: '30', label: '30 jours', days: 30 },
  { id: '90', label: '3 mois', days: 90 },
  { id: 'all', label: 'Tout' },
  { id: 'custom', label: 'Dates…' },
];

export const LEVELS = [
  { id: '', label: 'Tous les niveaux' },
  { id: 'beginner', label: 'Débutant' },
  { id: 'regular', label: 'Confirmé' },
  { id: 'expert', label: 'Expert' },
  { id: 'mixed', label: 'Niveaux mélangés' },
];

export const OPPONENTS = [
  { id: '', label: 'Toutes les tables' },
  { id: '1', label: 'Tête-à-tête' },
  { id: '2', label: '2 IA' },
  { id: '3', label: '3 IA' },
  { id: '4', label: '4 IA' },
];

/** @typedef {{ period: string, from: string, to: string, level: string, opponents: string }} Filters */

/** @returns {Filters} from, to = 'YYYY-MM-DD' (used by the "Dates…" period only) */
export function defaultFilters() {
  const today = dayString(new Date());
  return { period: 'all', from: today, to: today, level: '', opponents: '' };
}

/** @param {Filters} f */
export function toQuery(f) {
  const q = new URLSearchParams();
  const range = dateRange(f);
  if (range.from) q.set('from', range.from.toISOString());
  if (range.to) q.set('to', range.to.toISOString());
  if (f.level) q.set('level', f.level);
  if (f.opponents) q.set('opponents', f.opponents);
  q.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  return q.toString();
}

/** First and last instant of the period (last excluded), local days. */
export function dateRange(f) {
  const period = PERIODS.find((p) => p.id === f.period);
  if (period?.days) {
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - (period.days - 1));
    return { from, to: null };
  }
  if (f.period === 'custom') {
    const from = f.from ? parseDay(f.from) : null;
    const to = f.to ? parseDay(f.to) : null;
    to?.setDate(to.getDate() + 1); // the whole last day
    return { from, to };
  }
  return { from: null, to: null };
}

/** "30 jours · Expert · Tête-à-tête" — for the PDF. */
export function describe(f) {
  const range = dateRange(f);
  const period = f.period === 'custom'
    ? `du ${fr(range.from)} au ${fr(new Date(range.to - 1))}`
    : PERIODS.find((p) => p.id === f.period).label;
  const parts = [period];
  if (f.level) parts.push(LEVELS.find((l) => l.id === f.level).label);
  if (f.opponents) parts.push(OPPONENTS.find((o) => o.id === f.opponents).label);
  return parts.join(' · ');
}

const pad = (n) => String(n).padStart(2, '0');
const dayString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fr = (d) => (d ? d.toLocaleDateString('fr-FR') : '…');
