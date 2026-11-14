/**
 * BuildMode.js — 🖌️ Construire: paint your own range, save it to your account
 *
 * The brush (Brush.js) paints pure actions or a mix (« relance 60 %, suit 25 % »).
 * The range being painted is a draft kept in this browser (draftStore.js).
 * Logged in, it can be saved under a name (SavedRange table, net/rangesApi.js),
 * reopened, updated or deleted; guests keep only the draft.
 */

import { ALL_HANDS, RANGE_NAME_MAX, rangeStats } from '../../../shared/poker/ranges.js';
import { rangesApi } from '../../net/rangesApi.js';
import { esc, pct, comboLegendHtml, presetPickerHtml } from './html.js';
import { loadDraft, saveDraft } from './draftStore.js';
import { presetView } from './ExploreMode.js';
import { loadAiRanges } from './aiRanges.js';
import { Brush } from './Brush.js';

const ACTIONS_USED = ['raise', 'call', 'fold'];
/** A copied model's actions → the ones you can paint (fold = the rest) */
const TO_PAINT = { raise: 'raise', threebet: 'raise', call: 'call', check: 'call', callcheck: 'call', limp: 'call' };

const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const sorted = (range) => Object.fromEntries(Object.entries(range ?? {}).sort(([x], [y]) => (x < y ? -1 : 1)));

export class BuildMode {
  /**
   * @param {{ getUser: () => object | null }} deps
   */
  constructor({ getUser }) {
    this.id = 'build';
    this.paintable = true;
    this.getUser = getUser;
    this.brush = new Brush();
    this.draft = loadDraft();
    /** Saved ranges of the account (null: not loaded / guest) */
    this.saved = null;
    this.status = { text: '', error: false };
    this.confirmDelete = null;
  }

  /** Opening the tab: fetch the account's ranges. */
  enter(screen) {
    loadAiRanges(); // « Copier un modèle » can copy the AI's ranges
    this.status = { text: '', error: false };
    this.confirmDelete = null;
    if (!this.getUser()) {
      this.saved = null;
      return;
    }
    rangesApi.list().then((res) => {
      this.saved = res.ok ? res.data.ranges : [];
      if (!res.ok) this._say(res.error, true);
      screen.render();
    });
  }

  view() {
    return {
      name: this._current()?.name ?? 'Ma range',
      situation: 'Peins les cases avec un pinceau : clique, ou glisse sur plusieurs cases.',
      actions: ACTIONS_USED,
      range: Object.fromEntries(ALL_HANDS.map((h) => [h, this.draft.range[h] ?? { fold: 1 }])),
    };
  }

  sideHtml(view) {
    return `
      <h3>Pinceau</h3>
      ${this.brush.html()}
      <p class="dim">Clique sur une case, ou garde le bouton appuyé et glisse pour en peindre plusieurs.
      Les curseurs font un <b>mélange</b> : la main sera jouée de plusieurs façons, dans ces proportions (le reste : se coucher).
      La gomme remet en « se coucher ».</p>
      <h3>Ta range</h3>
      ${comboLegendHtml(view)}
      <p class="verdict">${verdict(view)}</p>
      <div class="row-btns">
        <button type="button" class="wood-btn wood-btn--grey ranges-clear">Tout effacer</button>
      </div>
      ${presetPickerHtml(null, { id: 'ranges-copy', label: 'Partir d’un modèle', placeholder: 'Choisir une range à copier…' })}
      <h3>Mes ranges enregistrées</h3>
      ${this._savedHtml()}`;
  }

  /** One cell painted: the draft, that cell and the numbers (not the whole panel: the pointer is still down). */
  paint(hand, screen) {
    // Pipette: read the cell instead of painting it
    if (this.brush.picking) {
      this.brush.take(this.draft.range[hand]);
      screen.grid.stopPainting();
      this.brush.refresh?.();
      return;
    }
    const next = this.brush.mix();
    if (JSON.stringify(this.draft.range[hand]) === JSON.stringify(next)) return;
    if (next) this.draft.range[hand] = next;
    else delete this.draft.range[hand];
    saveDraft(this.draft);
    const view = this.view();
    screen.grid.update(hand, view);
    const side = screen.side;
    const legend = side.querySelector('.legend');
    if (legend) legend.outerHTML = comboLegendHtml(view);
    const v = side.querySelector('.verdict');
    if (v) v.textContent = verdict(view);
    const dirty = side.querySelector('.dirty');
    if (dirty) dirty.hidden = !this._dirty();
  }

  bind(side, screen) {
    this.brush.bind(side);
    side.querySelector('.ranges-clear').addEventListener('click', () => {
      this._setRange({});
      screen.render();
    });
    side.querySelector('#ranges-copy').addEventListener('change', (e) => {
      if (!e.target.value) return;
      this._setRange(copyOf(presetView(e.target.value)));
      screen.render();
    });

    // ── Saved ranges ──
    const nameInput = side.querySelector('#range-name');
    side.querySelector('.saved-create')?.addEventListener('click', () => this._create(nameInput.value, screen));
    side.querySelector('.saved-update')?.addEventListener('click', () => this._update(nameInput.value, screen));
    side.querySelector('.saved-new')?.addEventListener('click', () => {
      this.draft.savedId = null;
      saveDraft(this.draft);
      this._say('');
      screen.render();
    });
    side.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
      const r = this.saved.find((x) => x.id === Number(b.dataset.open));
      this.draft = { range: structuredClone(r.range), savedId: r.id };
      saveDraft(this.draft);
      this._say(`« ${r.name} » ouverte.`);
      screen.render();
    }));
    side.querySelectorAll('[data-delete]').forEach((b) => b.addEventListener('click', () => this._delete(Number(b.dataset.delete), screen)));
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** The saved range the draft came from, if any. */
  _current() {
    return this.saved?.find((r) => r.id === this.draft.savedId) ?? null;
  }

  _dirty() {
    const cur = this._current();
    return Boolean(cur) && !same(cur.range, this.draft.range);
  }

  _setRange(range) {
    this.draft.range = range;
    saveDraft(this.draft);
  }

  _say(text, error = false) {
    this.status = { text, error };
  }

  _savedHtml() {
    if (!this.getUser()) {
      return '<p class="notice">Connecte-toi pour enregistrer tes ranges sur ton compte et les retrouver sur n’importe quel ordinateur. En attendant, ta range reste dans ce navigateur.</p>';
    }
    if (!this.saved) return '<p class="dim">Chargement de tes ranges…</p>';
    const cur = this._current();
    const status = `<p class="status${this.status.error ? ' error' : ''}" aria-live="polite">${esc(this.status.text)}</p>`;
    const form = `
      <label class="saloon-label" for="range-name">Nom</label>
      <div class="saved-form">
        <input id="range-name" class="ranges-picker" type="text" maxlength="${RANGE_NAME_MAX}"
               value="${esc(cur?.name ?? '')}" placeholder="Mon ouverture au bouton">
        ${cur
          ? `<button type="button" class="wood-btn wood-btn--green saved-update">Enregistrer les modifications</button>
             <button type="button" class="wood-btn saved-new">Nouvelle range</button>`
          : '<button type="button" class="wood-btn wood-btn--green saved-create">Enregistrer sur mon compte</button>'}
      </div>
      ${cur ? `<p class="dim dirty"${this._dirty() ? '' : ' hidden'}>Modifications pas encore enregistrées.</p>` : ''}`;
    const list = this.saved.length
      ? `<div class="saved-list">${this.saved.map((r) => `
          <div class="saved-item${r.id === this.draft.savedId ? ' current' : ''}">
            <span class="saved-name">${esc(r.name)}<br><span class="dim">${playedShare(r.range)} des mains · ${new Date(r.updatedAt).toLocaleDateString('fr-FR')}</span></span>
            <button type="button" class="wood-btn" data-open="${r.id}">Ouvrir</button>
            <button type="button" class="wood-btn wood-btn--red" data-delete="${r.id}">${this.confirmDelete === r.id ? 'Confirmer ?' : 'Supprimer'}</button>
          </div>`).join('')}</div>`
      : '<p class="dim">Aucune range enregistrée pour l’instant.</p>';
    return `${form}${status}${list}`;
  }

  async _create(name, screen) {
    if (!name.trim()) return this._fail('Donne un nom à ta range.', screen);
    const res = await rangesApi.create(name.trim(), this.draft.range);
    if (!res.ok) return this._fail(res.error, screen);
    this.saved.unshift(res.data.range);
    this.draft.savedId = res.data.range.id;
    saveDraft(this.draft);
    this._say(`« ${res.data.range.name} » enregistrée sur ton compte.`);
    screen.render();
  }

  async _update(name, screen) {
    if (!name.trim()) return this._fail('Donne un nom à ta range.', screen);
    const res = await rangesApi.update(this.draft.savedId, { name: name.trim(), range: this.draft.range });
    if (!res.ok) return this._fail(res.error, screen);
    this.saved = [res.data.range, ...this.saved.filter((r) => r.id !== res.data.range.id)];
    this._say('Modifications enregistrées.');
    screen.render();
  }

  /** First click asks, second click deletes. */
  async _delete(id, screen) {
    if (this.confirmDelete !== id) {
      this.confirmDelete = id;
      return screen.render();
    }
    this.confirmDelete = null;
    const res = await rangesApi.remove(id);
    if (!res.ok) return this._fail(res.error, screen);
    const gone = this.saved.find((r) => r.id === id);
    this.saved = this.saved.filter((r) => r.id !== id);
    if (this.draft.savedId === id) {
      this.draft.savedId = null; // the painting stays, as an unsaved draft
      saveDraft(this.draft);
    }
    this._say(`« ${gone?.name ?? 'La range'} » supprimée.`);
    screen.render();
  }

  _fail(text, screen) {
    this._say(text, true);
    screen.render();
  }
}

/** A friendly word on how wide the range is. */
function verdict(view) {
  const s = rangeStats(view.range, ACTIONS_USED);
  const played = s.raise.share + s.call.share;
  if (played === 0) return 'Pour l’instant, tu te couches avec tout. Choisis un pinceau et peins les mains que tu veux jouer !';
  if (played < 0.08) return `Tu joues ${pct(played)} des mains : très serré, comme un joueur prudent en début de parole.`;
  if (played < 0.25) return `Tu joues ${pct(played)} des mains : solide, typique d’une table pleine.`;
  if (played < 0.5) return `Tu joues ${pct(played)} des mains : large, bien pour le bouton ou une table courte.`;
  return `Tu joues ${pct(played)} des mains : très large, à réserver au tête-à-tête ou au bluff.`;
}

/** Share of hands a saved range plays, for the list. */
function playedShare(range) {
  const s = rangeStats(range, ['raise', 'call']);
  return pct(s.raise.share + s.call.share, 0);
}

/** A model copied into paintable actions, mixes kept (rounded to the brush's steps). */
function copyOf(view) {
  const step = (f) => Math.round(f * 20) / 20; // 5 %
  const range = {};
  for (const hand of ALL_HANDS) {
    const out = {};
    for (const [action, f] of Object.entries(view.range[hand] ?? {})) {
      const to = TO_PAINT[action];
      if (to) out[to] = (out[to] ?? 0) + f;
    }
    for (const k of Object.keys(out)) {
      out[k] = step(out[k]);
      if (!out[k]) delete out[k];
    }
    if ((out.raise ?? 0) + (out.call ?? 0) > 1) out.call = 1 - out.raise; // rounding
    if (Object.keys(out).length) range[hand] = out;
  }
  return range;
}
