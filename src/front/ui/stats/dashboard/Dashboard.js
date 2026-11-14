/**
 * Dashboard.js — The "Tableau de bord" tab of the record book (StatsMenu)
 *
 *   filters     period (7 / 30 / 90 days, all, chosen dates), AI level, number of AIs
 *   tiles       hands, games, result, bb/100, VPIP, PFR, showdowns won
 *   charts      result curve (line), result per day (bar), VPIP / PFR over time
 *               (line), bb/100 per AI level, position and number of AIs
 *               (bars), the player's moves per street (doughnut) — charts.js
 *   export      CSV (the server builds it: same filters) and PDF (pdfExport.js)
 *   real time   an event stream (net/statsLive.js): a hand saved in another
 *               tab or device reloads the numbers here
 *
 * Every amount is in big blinds: games with different blinds add up.
 * mount() builds it inside the given element; destroy() stops everything
 * (charts, stream) — StatsMenu calls it when another tab opens.
 */

import { gamesApi } from '../../../net/gamesApi.js';
import { watchHands } from '../../../net/statsLive.js';
import { Chart, curveChart, resultByDayChart, styleChart, rateChart, actionsChart, STREETS } from './charts.js';
import { PERIODS, LEVELS, OPPONENTS, defaultFilters, toQuery, describe } from './filters.js';
import { injectDashboardStyles } from './styles.js';

const LIVE_DEBOUNCE_MS = 600; // several hands saved in a row → one reload

const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '—');
const bb = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} BB`;
const options = (list, value) => list.map((o) => `<option value="${o.id}"${o.id === value ? ' selected' : ''}>${o.label}</option>`).join('');

const CHARTS = [
  { id: 'curve', title: 'Courbe de gains', wide: true, hint: 'Ton résultat cumulé, main après main' },
  { id: 'days', title: 'Résultat par jour', hint: 'Gagné ou perdu chaque jour' },
  { id: 'style', title: 'VPIP / PFR dans le temps', hint: 'Clique une légende pour masquer la courbe' },
  { id: 'level', title: 'Gains par niveau d’IA', hint: 'BB gagnées pour 100 mains' },
  { id: 'position', title: 'Gains par position', hint: 'BB gagnées pour 100 mains' },
  { id: 'opponents', title: 'Gains selon le nombre d’IA', hint: 'BB gagnées pour 100 mains' },
  { id: 'actions', title: 'Tes actions', hint: 'Ce que tu fais quand c’est à toi', streets: true },
];

export class Dashboard {
  /** @param {HTMLElement} root */
  constructor(root) {
    injectDashboardStyles();
    this.root = root;
    this.filters = defaultFilters();
    this.street = null; // actions chart: all streets
    /** @type {Map<string, Chart>} */
    this.charts = new Map();
    this.data = null;
    this.live = null;
    this._timer = null;
    this._destroyed = false;
  }

  async mount() {
    this.root.innerHTML = `
      <div class="dash">
        <div class="dash-filters">
          <div class="dash-periods" role="group" aria-label="Période">
            ${PERIODS.map((p) => `<button type="button" class="wood-btn" data-period="${p.id}">${p.label}</button>`).join('')}
          </div>
          <div class="dash-dates" hidden>
            <label>Du <input type="date" name="from"></label>
            <label>au <input type="date" name="to"></label>
          </div>
          <div class="dash-selects">
            <select name="level" aria-label="Niveau des IA">${options(LEVELS, '')}</select>
            <select name="opponents" aria-label="Nombre d’IA">${options(OPPONENTS, '')}</select>
          </div>
        </div>
        <div class="dash-bar">
          <span class="dash-live" aria-live="polite"><span class="dash-dot"></span><span class="dash-live-text">Connexion au direct…</span></span>
          <span class="dash-exports">
            <a class="wood-btn wood-btn--green dash-csv" download>⬇ CSV</a>
            <button type="button" class="wood-btn wood-btn--gold dash-pdf">⬇ PDF</button>
          </span>
        </div>
        <div class="dash-content"></div>
      </div>`;

    const $ = (s) => this.root.querySelector(s);
    this.$content = $('.dash-content');
    this.$dates = $('.dash-dates');
    this.$csv = $('.dash-csv');
    this.$liveText = $('.dash-live-text');
    this.$live = $('.dash-live');

    this.root.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => {
      this.filters.period = b.dataset.period;
      this._syncFilters();
      this.refresh();
    }));
    const from = $('input[name=from]');
    const to = $('input[name=to]');
    from.value = this.filters.from;
    to.value = this.filters.to;
    for (const input of [from, to, $('select[name=level]'), $('select[name=opponents]')]) {
      input.addEventListener('change', () => {
        this.filters[input.name] = input.value;
        this.refresh();
      });
    }
    $('.dash-pdf').addEventListener('click', (e) => this._pdf(e.currentTarget));

    this._syncFilters();
    this.live = watchHands({
      onHand: () => {
        clearTimeout(this._timer);
        this._timer = setTimeout(() => this.refresh(true), LIVE_DEBOUNCE_MS);
      },
      onStatus: (on) => this._liveStatus(on ? 'En direct : chaque main jouée s’ajoute ici' : 'Direct coupé, reconnexion…', on),
    });
    await this.refresh();
  }

  destroy() {
    this._destroyed = true;
    clearTimeout(this._timer);
    this.live?.close();
    this.charts.forEach((c) => c.destroy());
    this.charts.clear();
  }

  /** Load the numbers for the current filters and draw them. */
  async refresh(fromLive = false) {
    const query = toQuery(this.filters);
    this.$csv.href = gamesApi.exportCsvUrl(query);
    const res = await gamesApi.dashboard(query);
    if (this._destroyed) return;
    if (!res.ok) {
      this._clearCharts();
      this.$content.innerHTML = `<p class="stats-empty stats-error">⚠ ${res.error}</p>`;
      return;
    }
    this.data = res.data;
    this._render();
    if (fromLive) this._liveStatus(`Mis à jour à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, true, true);
  }

  // ── Private ──

  _syncFilters() {
    this.root.querySelectorAll('[data-period]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.period === this.filters.period)));
    this.$dates.hidden = this.filters.period !== 'custom';
  }

  _render() {
    const { summary: s } = this.data;
    if (!s.hands) {
      this._clearCharts();
      this.$content.innerHTML = '<p class="stats-empty">Aucune main pour ces filtres.<br>Change la période ou joue une partie : elle apparaîtra ici en direct.</p>';
      return;
    }
    // Build the layout once; later refreshes only update tiles and chart data
    if (!this.$content.querySelector('.dash-grid')) {
      this.$content.innerHTML = `
        <div class="tiles dash-tiles"></div>
        <div class="dash-grid">
          ${CHARTS.map((c) => `
            <section class="dash-card${c.wide ? ' dash-card--wide' : ''}">
              <h3>${c.title}</h3>
              <p class="dash-hint">${c.hint}</p>
              ${c.streets ? `<div class="dash-streets" role="group" aria-label="Tour d’enchères">
                <button type="button" class="wood-btn" data-street="">Tous</button>
                ${STREETS.map((name, i) => `<button type="button" class="wood-btn" data-street="${i}">${name}</button>`).join('')}
              </div>` : ''}
              <div class="dash-canvas"><canvas data-chart="${c.id}" role="img" aria-label="${c.title}"></canvas></div>
            </section>`).join('')}
        </div>`;
      this.$content.querySelectorAll('[data-street]').forEach((b) => b.addEventListener('click', () => {
        this.street = b.dataset.street === '' ? null : Number(b.dataset.street);
        this._drawCharts();
      }));
    }
    this.$content.querySelector('.dash-tiles').innerHTML = this._tiles()
      .map(([value, label, hint]) => `
        <div class="tile">
          <div class="tile-value">${value}</div>
          <div class="tile-label">${label}</div>
          ${hint ? `<div class="tile-hint">${hint}</div>` : ''}
        </div>`).join('');
    this._drawCharts();
  }

  /** [value, label, hint?] — also the numbers of the PDF */
  _tiles() {
    const s = this.data.summary;
    return [
      [s.hands.toLocaleString('fr-FR'), 'Mains jouées', `${s.games} partie${s.games > 1 ? 's' : ''}`],
      [bb(s.netBB), 'Résultat'],
      [bb(s.bbPer100), 'Pour 100 mains', 'Ton rythme de gain'],
      [pct(s.handsWon, s.hands), 'Mains gagnées'],
      [pct(s.vpip, s.hands), 'VPIP', 'Mains jouées de toi-même avant le flop'],
      [pct(s.pfr, s.hands), 'PFR', 'Mains relancées avant le flop'],
      [`${s.showdownsWon} / ${s.showdowns}`, 'Abattages gagnés'],
    ];
  }

  _drawCharts() {
    const d = this.data;
    const configs = {
      curve: curveChart(d.curve),
      days: resultByDayChart(d.timeline),
      style: styleChart(d.timeline),
      level: rateChart(d.byLevel, 'level'),
      position: rateChart(d.byPosition, 'position'),
      opponents: rateChart(d.byOpponents, 'opponents'),
      actions: actionsChart(d.actions, this.street),
    };
    this.$content.querySelectorAll('[data-street]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.street === '' ? null : Number(b.dataset.street)) === this.street)));
    for (const [id, config] of Object.entries(configs)) {
      const chart = this.charts.get(id);
      if (chart) {
        chart.data = config.data;
        chart.options = config.options;
        chart.update();
      } else {
        const canvas = this.$content.querySelector(`[data-chart="${id}"]`);
        this.charts.set(id, new Chart(canvas, config));
      }
    }
  }

  _clearCharts() {
    this.charts.forEach((c) => c.destroy());
    this.charts.clear();
  }

  _liveStatus(text, on, flash = false) {
    this.$liveText.textContent = text;
    this.$live.classList.toggle('on', on);
    if (flash) {
      this.$live.classList.remove('flash');
      void this.$live.offsetWidth; // restart the animation
      this.$live.classList.add('flash');
    }
  }

  async _pdf(button) {
    if (!this.data?.summary.hands) return;
    button.disabled = true;
    try {
      const { exportPdf } = await import('./pdfExport.js');
      await exportPdf({
        subtitle: describe(this.filters),
        tiles: this._tiles().map(([value, label]) => [value, label]),
        charts: CHARTS.map((c) => ({ title: c.id === 'actions' && this.street !== null ? `${c.title} (${STREETS[this.street]})` : c.title, canvas: this.charts.get(c.id).canvas, wide: c.wide })),
      });
    } finally {
      button.disabled = false;
    }
  }
}
