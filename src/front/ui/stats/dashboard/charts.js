/**
 * charts.js — The dashboard's charts (Chart.js), in the saloon colours
 *
 * One function per chart: server data (server/src/stats/dashboard.js) →
 * a Chart.js config { type, data, options }. Dashboard.js creates the charts
 * and, on a refresh, swaps data and options in (no flicker).
 * Interactive by Chart.js itself: hover tooltips, click a legend entry to
 * hide / show its series. Big fonts, thick lines: the UI must read from afar.
 *
 * Only the parts used are registered (tree-shaking keeps the bundle small).
 */

import {
  Chart, LineController, BarController, DoughnutController, LineElement, PointElement,
  BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, Filler,
} from 'chart.js';

Chart.register(LineController, BarController, DoughnutController, LineElement, PointElement,
  BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const C = {
  cream: '#fff1d2',
  grid: 'rgba(255, 241, 210, .16)',
  gold: '#f7bb2a',
  green: '#5cc957',
  red: '#ff6a52',
  blue: '#6cc4ff',
};

Chart.defaults.color = C.cream;
Chart.defaults.font.family = "'Nunito', 'Trebuchet MS', sans-serif";
Chart.defaults.font.weight = 800;
Chart.defaults.font.size = 16;
Chart.defaults.borderColor = C.grid;
Chart.defaults.plugins.tooltip.titleFont = { size: 17, weight: 900 };
Chart.defaults.plugins.tooltip.bodyFont = { size: 16, weight: 800 };
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.legend.labels.font = { size: 16, weight: 800 };
Chart.defaults.maintainAspectRatio = false;

/** Actions of the doughnut, same colours as the range grid (config/rangePresets.js), lighter to read on leather */
export const ACTION_LABELS = {
  fold: { label: 'Se coucher', color: '#a9b0bf' },
  check: { label: 'Checker', color: '#9be08f' },
  call: { label: 'Suivre', color: '#43b04a' },
  bet: { label: 'Miser', color: C.gold },
  raise: { label: 'Relancer', color: '#e8503a' },
};
export const STREETS = ['Préflop', 'Flop', 'Turn', 'River'];
const LEVEL = { beginner: 'Débutant', regular: 'Confirmé', expert: 'Expert', mixed: 'Mélangés' };
const POSITION = { button: 'Bouton', sb: 'Petite blinde', bb: 'Grosse blinde', other: 'Autre' };
const TABLE = { 1: 'Tête-à-tête', 2: '2 IA', 3: '3 IA', 4: '4 IA' };
const GROUPS = { level: LEVEL, position: POSITION, opponents: TABLE };

const bb = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} BB`;
const signColor = (x) => (x >= 0 ? C.green : C.red);
const dayLabel = (s, unit) => {
  const d = new Date(`${s}T12:00:00`);
  const text = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return unit === 'week' ? `sem. du ${text}` : text;
};
const axis = (title, extra = {}) => ({ title: { display: !!title, text: title, font: { size: 15, weight: 900 } }, ...extra });

/** Cumulative result, hand after hand: green above zero, red below. */
export function curveChart(curve) {
  return {
    type: 'line',
    data: {
      datasets: [{
        label: 'Résultat cumulé',
        data: curve.map((p) => ({ x: p.hand, y: p.total, at: p.at })),
        borderWidth: 4,
        pointRadius: 0,
        pointHitRadius: 8,
        tension: 0.15,
        segment: { borderColor: (ctx) => signColor(ctx.p1.parsed.y) },
        fill: { target: 'origin', above: 'rgba(92, 201, 87, .18)', below: 'rgba(255, 106, 82, .18)' },
      }],
    },
    options: {
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: axis('Mains jouées', { type: 'linear', min: curve.length ? 0 : undefined, ticks: { precision: 0 } }),
        y: axis('Big blinds (BB)'),
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Main ${items[0].raw.x} · ${new Date(items[0].raw.at).toLocaleDateString('fr-FR')}`,
            label: (item) => `Total : ${bb(item.raw.y)}`,
          },
        },
      },
    },
  };
}

/** Result per day (or week): one bar each, green or red. */
export function resultByDayChart({ unit, points }) {
  return {
    type: 'bar',
    data: {
      labels: points.map((p) => dayLabel(p.day, unit)),
      datasets: [{
        label: 'Résultat',
        data: points.map((p) => p.netBB),
        backgroundColor: points.map((p) => signColor(p.netBB)),
        borderColor: '#22120a',
        borderWidth: 2,
        borderRadius: 6,
        hands: points.map((p) => p.hands),
      }],
    },
    options: {
      scales: { y: axis('Big blinds (BB)') },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => `${bb(item.raw)} en ${item.dataset.hands[item.dataIndex]} mains` } },
      },
    },
  };
}

/** VPIP and PFR per day (or week), in %. */
export function styleChart({ unit, points }) {
  const pct = (n, of) => (of ? Math.round((100 * n) / of) : null);
  const line = (label, color, key) => ({
    label, borderColor: color, backgroundColor: color, borderWidth: 4, pointRadius: 5, tension: 0.2,
    data: points.map((p) => pct(p[key], p.hands)),
  });
  return {
    type: 'line',
    data: {
      labels: points.map((p) => dayLabel(p.day, unit)),
      datasets: [line('VPIP (joue la main)', C.gold, 'vpip'), line('PFR (relance avant le flop)', C.blue, 'pfr')],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { y: axis('% des mains', { min: 0, max: 100 }) },
      plugins: { tooltip: { callbacks: { label: (item) => `${item.dataset.label} : ${item.raw} %` } } },
    },
  };
}

/** bb/100 per group (kind: level | position | opponents): how much is won per 100 hands. */
export function rateChart(rows, kind) {
  const names = GROUPS[kind];
  const order = Object.keys(names);
  const sorted = [...rows].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return {
    type: 'bar',
    data: {
      labels: sorted.map((r) => names[r.key] ?? r.key),
      datasets: [{
        label: 'BB gagnées pour 100 mains',
        data: sorted.map((r) => r.bbPer100),
        backgroundColor: sorted.map((r) => signColor(r.bbPer100)),
        borderColor: '#22120a',
        borderWidth: 2,
        borderRadius: 6,
        rows: sorted,
      }],
    },
    options: {
      scales: { y: axis('BB / 100 mains') },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const r = item.dataset.rows[item.dataIndex];
              return [`${bb(r.bbPer100)} pour 100 mains`, `${r.hands} mains, ${bb(r.netBB)} au total`];
            },
          },
        },
      },
    },
  };
}

/** The player's moves, all streets or one (street = null | 0..3). */
export function actionsChart(actions, street) {
  const rows = actions.filter((a) => street === null || a.street === street);
  const types = Object.keys(ACTION_LABELS).filter((t) => rows.some((r) => r.type === t));
  const count = (t) => rows.filter((r) => r.type === t).reduce((a, r) => a + r.count, 0);
  const total = rows.reduce((a, r) => a + r.count, 0);
  return {
    type: 'doughnut',
    data: {
      labels: types.map((t) => ACTION_LABELS[t].label),
      datasets: [{
        data: types.map(count),
        backgroundColor: types.map((t) => ACTION_LABELS[t].color),
        borderColor: '#22120a',
        borderWidth: 3,
        hoverOffset: 14,
      }],
    },
    options: {
      cutout: '50%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { callbacks: { label: (item) => ` ${item.label} : ${item.raw} fois (${Math.round((100 * item.raw) / total)} %)` } },
      },
    },
  };
}

export { Chart };
