/**
 * NewGameMenu.js — "Nouvelle partie" menu
 *
 * Lets the player set up a game before sitting down:
 *  - number of AI opponents (1..MAX_OPPONENTS)
 *  - the level of each opponent, or of all of them at once
 *  - starting stack and blinds
 *
 * "Lancer la partie" dispatches `game:start` on window with the GameConfig as
 * `event.detail`, then closes the overlay. "Annuler" just closes it.
 */

import {
  LEVELS,
  MAX_OPPONENTS,
  OPPONENT_NAMES,
  STACK_OPTIONS,
  BLIND_OPTIONS,
  DEFAULT_CONFIG,
} from '../../config/newGameOptions.js';
import { injectNewGameStyles } from './styles.js';

const SUITS = ['♠', '♥', '♦', '♣'];

/**
 * Build a segmented control.
 * @param {{ label: string, value: any }[]} options
 * @param {any} selected
 * @param {(value: any) => void} onChange
 * @param {{ small?: boolean, ariaLabel?: string }} [opts]
 */
function segmented(options, selected, onChange, { small = false, ariaLabel = '' } = {}) {
  const seg = document.createElement('div');
  seg.className = small ? 'seg seg--small' : 'seg';
  seg.setAttribute('role', 'group');
  if (ariaLabel) seg.setAttribute('aria-label', ariaLabel);

  const buttons = options.map(({ label, value }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wood-btn';
    btn.textContent = label;
    btn.setAttribute('aria-pressed', String(value === selected));
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      onChange(value);
    });
    seg.appendChild(btn);
    return btn;
  });

  return seg;
}

function block(label, right) {
  const wrap = document.createElement('div');
  wrap.className = 'start-block leather';
  const head = document.createElement('div');
  head.className = 'start-block-head';

  const title = document.createElement('span');
  title.className = 'saloon-label';
  title.textContent = label;

  head.appendChild(title);
  if (right) head.appendChild(right);
  wrap.appendChild(head);
  return wrap;
}

function levelById(id) {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

export function renderNewGameMenu() {
  injectNewGameStyles();

  // Levels are kept for every seat so that lowering then raising the
  // opponent count doesn't lose what the player picked.
  const levels = OPPONENT_NAMES.map((_, i) => DEFAULT_CONFIG.opponents[i]?.level ?? DEFAULT_CONFIG.opponents[0].level);
  let count         = DEFAULT_CONFIG.opponents.length;
  let startingStack = DEFAULT_CONFIG.startingStack;
  let blinds        = DEFAULT_CONFIG.blinds;

  const menu = document.createElement('div');
  menu.className = 'start-menu';

  // ── Intro ────────────────────────────────────────────────────────────────
  const intro = document.createElement('div');
  intro.className = 'start-intro';
  intro.innerHTML = `
    <h3 class="start-title saloon-ol">Prêt à affronter les IA ?</h3>
    <p class="start-subtitle">Choisis tes adversaires et les règles de la table.</p>
  `;

  // ── Opponents ────────────────────────────────────────────────────────────
  const countOptions = Array.from({ length: MAX_OPPONENTS }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
  const countSeg = segmented(countOptions, count, (v) => {
    count = v;
    renderOpponents();
  }, { ariaLabel: "Nombre d'adversaires" });

  const opponentsBlock = block('Adversaires', countSeg);
  const list = document.createElement('div');
  list.className = 'opponents';

  const all = document.createElement('div');
  all.className = 'start-all';

  function renderAllRow() {
    all.innerHTML = '';
    const label = document.createElement('span');
    label.textContent = 'Tous au niveau :';
    const shared = levels.slice(0, count).every((l) => l === levels[0]) ? levels[0] : null;
    const seg = segmented(
      LEVELS.map((l) => ({ label: l.label, value: l.id })),
      shared,
      (v) => {
        levels.fill(v);
        renderOpponents();
      },
      { small: true, ariaLabel: 'Niveau de tous les adversaires' },
    );
    all.append(label, seg);
  }

  function renderOpponents() {
    list.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'opponent';

      const suit = SUITS[i % SUITS.length];
      const avatar = document.createElement('div');
      avatar.className = 'opponent-avatar';
      avatar.dataset.suit = suit;
      avatar.textContent = suit;

      const info = document.createElement('div');
      info.className = 'opponent-info';
      const name = document.createElement('div');
      name.className = 'opponent-name';
      name.textContent = OPPONENT_NAMES[i];
      const hint = document.createElement('div');
      hint.className = 'opponent-hint';
      hint.textContent = levelById(levels[i]).hint;
      info.append(name, hint);

      const seg = segmented(
        LEVELS.map((l) => ({ label: l.label, value: l.id })),
        levels[i],
        (v) => {
          levels[i] = v;
          hint.textContent = levelById(v).hint;
          renderAllRow();
        },
        { small: true, ariaLabel: `Niveau de ${OPPONENT_NAMES[i]}` },
      );

      row.append(avatar, info, seg);
      list.appendChild(row);
    }
    renderAllRow();
  }

  renderOpponents();
  opponentsBlock.append(list, all);

  // ── Table settings ───────────────────────────────────────────────────────
  const settingsBlock = block('Table');
  const settings = document.createElement('div');
  settings.className = 'start-settings';

  const setting = (label, control) => {
    const row = document.createElement('div');
    row.className = 'start-setting';
    const text = document.createElement('span');
    text.className = 'start-setting-label';
    text.textContent = label;
    row.append(text, control);
    return row;
  };

  settings.append(
    setting('Tapis de départ', segmented(
      STACK_OPTIONS.map((v) => ({ label: v.toLocaleString('fr-FR'), value: v })),
      startingStack,
      (v) => { startingStack = v; },
      { small: true, ariaLabel: 'Tapis de départ' },
    )),
    setting('Blinds', segmented(
      BLIND_OPTIONS.map((b) => ({ label: `${b.small} / ${b.big}`, value: b })),
      blinds,
      (v) => { blinds = v; },
      { small: true, ariaLabel: 'Blinds' },
    )),
  );
  settingsBlock.appendChild(settings);

  // ── Actions ──────────────────────────────────────────────────────────────
  const close = () => menu.closest('.overlay-panel')?.querySelector('.overlay-close')?.click();

  const actions = document.createElement('div');
  actions.className = 'start-actions';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'start-cancel wood-btn wood-btn--grey';
  cancel.textContent = 'Annuler';
  cancel.addEventListener('click', close);

  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'start-go wood-btn wood-btn--red';
  go.textContent = 'Lancer la partie';
  go.addEventListener('click', () => {
    /** @type {import('../../config/newGameOptions').GameConfig} */
    const config = {
      opponents: levels.slice(0, count).map((level, i) => ({ name: OPPONENT_NAMES[i], level })),
      startingStack,
      blinds,
    };
    window.dispatchEvent(new CustomEvent('game:start', { detail: config }));
    close();
  });

  actions.append(cancel, go);

  menu.append(intro, opponentsBlock, settingsBlock, actions);
  return menu;
}
