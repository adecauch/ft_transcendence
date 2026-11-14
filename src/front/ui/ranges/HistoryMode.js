/**
 * HistoryMode.js — 📜 Mon historique: the range the player REALLY played, next to the theory
 *
 * Rebuilt by the server from the saved hands (GET /api/stats/range,
 * shared/stats/rangeAnalysis.js): the first preflop decision per hand type, in
 * three situations (first to act / after a limp / facing a raise).
 *
 * Next to it, the THEORY range of the same situation (preflop EV model,
 * shared/theory/preflopModel.js, loaded by theoryData.js), in a mini grid.
 * Hovering a cell compares, over 100 times that hand, what the player's way
 * of playing it wins against the theory: the "manque à gagner". The main grid
 * can also be coloured by that loss (heat map). Plus the clear-cut preflop
 * mistakes and the biggest losses. Guests have nothing saved: no request.
 *
 * HTML pieces: theoryHtml.js (comparison), historyHtml.js (mistakes, losses).
 */

import { rangeStats } from '../../../shared/poker/ranges.js';
import { ACTIONS } from '../../config/rangePresets.js';
import { gamesApi } from '../../net/gamesApi.js';
import { esc, pct, legendRow } from './html.js';
import { RangeGrid } from './RangeGrid.js';
import { loadTheory } from './theoryData.js';
import { mistakesHtml, lossesHtml } from './historyHtml.js';
import {
  mixOf, heatColor, heatLegendHtml, lossSummary, summaryHtml, comparisonHtml, modelHowtoHtml,
} from './theoryHtml.js';

const GUEST = 'Connecte-toi pour voir ta vraie range : les parties des invités ne sont pas enregistrées.';

/** The three situations; `actions` = [raise-like, call-like, fold] names shown for the model's raise / call / fold. */
const SPOTS = {
  open: {
    id: 'open',
    label: 'Premier à parler',
    actions: ['raise', 'limp', 'fold'],
    situation: 'Ta première décision avant le flop, quand personne n’était encore entré dans le pot (en tête-à-tête : petite blinde).',
  },
  vsLimp: {
    id: 'vsLimp',
    label: 'Face à un limp',
    actions: ['raise', 'check', 'fold'],
    situation: 'Ta première décision quand un adversaire avait seulement complété (en tête-à-tête : grosse blinde, checker est gratuit).',
  },
  vsRaise: {
    id: 'vsRaise',
    label: 'Face à une relance',
    actions: ['threebet', 'call', 'fold'],
    situation: 'Ta première décision quand un adversaire avait déjà relancé.',
  },
};

/** Model frequencies ({ raise, call, fold }) → the situation's action ids. */
const named = (spot, mix) => ({ [spot.actions[0]]: mix.raise ?? 0, [spot.actions[1]]: mix.call ?? 0, fold: mix.fold ?? 0 });

export class HistoryMode {
  /** @param {{ getUser: () => object | null }} deps */
  constructor({ getUser }) {
    this.id = 'history';
    this.paintable = false;
    this.getUser = getUser;
    this.data = null;
    this.error = null;
    this.spot = SPOTS.open;
    this.display = 'range'; // main grid: 'range' (what you played) or 'loss' (heat map)
    this.model = null;
    this.mini = null;
  }

  /** Opening the tab: the analysis (fresh: new hands may have been played) and the theory model. */
  enter(screen) {
    this.data = null;
    this.error = null;
    loadTheory().then((model) => {
      this.model = model;
      screen.render();
    });
    if (!this.getUser()) {
      this.error = GUEST;
      return;
    }
    gamesApi.rangeHistory().then((res) => {
      if (res.ok) this.data = res.data;
      else this.error = res.status === 401 ? GUEST : res.error;
      screen.render();
    });
  }

  /** The player's range (or its heat map) in the chosen situation. */
  view() {
    const spot = this.spot;
    const view = { name: 'Ma vraie range', situation: spot.situation, actions: spot.actions, range: {}, counts: {}, total: 0 };
    const s = this.data?.situations[spot.id];
    if (!s) return view;
    for (const [hand, c] of Object.entries(s.hands)) {
      view.range[hand] = named(spot, mixOf(c));
      view.counts[hand] = c;
    }
    view.total = s.total;
    if (this.display === 'loss' && this.model) {
      view.name = 'Mon manque à gagner';
      view.colors = {};
      view.labels = {};
      for (const [hand, c] of Object.entries(view.counts)) {
        const loss = this.model.per100(spot.id, hand, mixOf(c)).loss;
        view.colors[hand] = heatColor(loss);
        view.labels[hand] = `${Math.round(loss)} BB perdues pour 100 mains`;
      }
    }
    return view;
  }

  /** The theory range of the situation, for the mini grid. */
  theoryView() {
    const range = {};
    const theory = this.model.theory(this.spot.id);
    for (const [hand, mix] of Object.entries(theory)) range[hand] = named(this.spot, mix);
    return { range, actions: this.spot.actions };
  }

  sideHtml(view, selected) {
    const seg = `
      <div class="seg-row" role="group" aria-label="Situation">
        ${Object.values(SPOTS).map((s) => `<button type="button" class="wood-btn" data-spot="${s.id}" aria-pressed="${s === this.spot}">${s.label}</button>`).join('')}
      </div>`;
    if (this.error) return `${seg}<p class="notice">⚠ ${esc(this.error)}</p>${this._theoryHtml()}`;
    if (!this.data) return `${seg}<p class="dim">Chargement de tes mains…</p>`;
    if (!this.data.hands) return `${seg}<p class="notice">Aucune main enregistrée pour l’instant. Joue quelques parties connecté : ta range se dessinera ici, main après main.</p>${this._theoryHtml()}`;

    const display = `
      <div class="seg-row" role="group" aria-label="Couleurs du tableau">
        <button type="button" class="wood-btn" data-display="range" aria-pressed="${this.display === 'range'}">🎨 Ce que j’ai joué</button>
        <button type="button" class="wood-btn" data-display="loss" aria-pressed="${this.display === 'loss'}" ${this.model ? '' : 'disabled'}>🔥 Mon manque à gagner</button>
      </div>
      ${this.display === 'loss' ? heatLegendHtml() : ''}`;

    return `
      ${seg}
      ${display}
      ${this.model ? `<h3>Manque à gagner</h3>${summaryHtml(lossSummary(this.model, this.spot.id, view.counts))}` : ''}
      <h3>La main</h3>
      <div class="detail" aria-live="polite">${this.detailHtml(selected, view)}</div>
      ${this._theoryHtml()}
      <h3>Ce que tu as joué</h3>
      ${this._legendHtml(view)}
      <h3>Tes plus grosses erreurs</h3>
      ${mistakesHtml(this.data.mistakes)}
      <h3>Tes plus grosses pertes</h3>
      ${lossesHtml(this.data.losses)}
      ${this.model ? modelHowtoHtml() : ''}`;
  }

  detailHtml(hand, view) {
    if (!hand) return '<p class="dim">Passe la souris sur une case, ou clique dessus pour la garder affichée : combien de fois tu l’as reçue, ce que tu en as fait, et combien tu gagnes ou perds sur 100 mains par rapport à la théorie.</p>';
    if (!this.model) return '<p class="dim">Chargement de la théorie…</p>';
    return comparisonHtml(this.model, this.spot, hand, view.counts[hand]);
  }

  onHover(hand) {
    this.mini?.select(hand);
  }

  /** The mini theory grid, once the panel is in the page. */
  afterRender(screen) {
    const el = screen.side.querySelector('.theory-grid');
    this.mini = null;
    if (!el || !this.model) return;
    this.mini = new RangeGrid(el, { interactive: false });
    this.mini.show(this.theoryView());
    this.mini.select(screen.grid.selected);
  }

  bind(side, screen) {
    side.querySelectorAll('[data-spot]').forEach((b) => b.addEventListener('click', () => {
      this.spot = SPOTS[b.dataset.spot];
      screen.select(null);
      screen.render();
    }));
    side.querySelectorAll('[data-display]').forEach((b) => b.addEventListener('click', () => {
      this.display = b.dataset.display;
      screen.render();
    }));
    // A mistake or a costly hand: show it in the grid (switching situation if needed)
    side.querySelectorAll('.note[data-hand], .worst-hand').forEach((b) => b.addEventListener('click', () => {
      const hand = b.dataset.hand;
      const s = this.data.situations;
      if (!s[this.spot.id].hands[hand]) {
        const where = Object.keys(SPOTS).find((id) => s[id].hands[hand]);
        if (where) this.spot = SPOTS[where];
      }
      screen.select(hand, { scroll: true });
      screen.render();
    }));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** The theory range of this situation: mini grid + what it does. */
  _theoryHtml() {
    if (!this.model) return '';
    const view = this.theoryView();
    const stats = rangeStats(view.range, view.actions);
    const rows = view.actions.map((id) => legendRow(id, ACTIONS[id].label, pct(stats[id].share))).join('');
    return `
      <h3>La range théorique</h3>
      <div class="theory">
        <div class="theory-grid range-grid mini" aria-hidden="true"></div>
        <div class="legend">${rows}</div>
      </div>
      <p class="dim">Ce qu’il vaut mieux faire dans cette situation d’après le modèle (voir « Comment c’est calculé ? » en bas).</p>`;
  }

  /** What the player did, counted in hands (not combos: these are real hands). */
  _legendHtml(view) {
    const total = view.total;
    if (!total) return '<p class="dim">Aucune décision dans cette situation pour l’instant.</p>';
    const counts = Object.values(view.counts);
    const sum = (k) => counts.reduce((a, c) => a + c[k], 0);
    const by = { [view.actions[0]]: sum('raise'), [view.actions[1]]: sum('call'), fold: sum('fold') };
    const rows = view.actions.map((id) => legendRow(id, ACTIONS[id].label, pct(by[id] / total), `${by[id]} main${by[id] > 1 ? 's' : ''} sur ${total}`)).join('');
    const bar = view.actions.map((id) => `<span style="width:${(100 * by[id] / total).toFixed(2)}%;background:${ACTIONS[id].color}"></span>`).join('');
    const note = total < 200
      ? `${total} décision${total > 1 ? 's' : ''} seulement : chaque case ne compte que quelques mains, ta range se précisera avec le temps. Les cases rayées sont des mains que tu n’as jamais reçues ici.`
      : 'Les cases rayées sont des mains que tu n’as jamais reçues dans cette situation.';
    return `<div class="legend">${rows}<div class="mixbar" aria-hidden="true">${bar}</div></div><p class="dim">${note}</p>`;
  }
}
