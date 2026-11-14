/**
 * Panel.js — Overlay panel (saloon theme, see ui/theme/saloon.css)
 *
 * A wooden panel with its title on a gold sign nailed across the top edge.
 * Structure:
 *   .overlay-panel.wood-panel
 *     .panel-header
 *       .panel-sign.wood-sign   (section label)
 *     .panel-body               (scrollable)
 *     close button              (injected by Overlay.js)
 */

import * as Sections from './panels.js';

const LABELS = {
  start: 'Nouvelle partie',
  online: 'Table en ligne',
};

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes panelDrop {
      0%   { transform: translateY(-40px) scale(.9); opacity: 0; }
      60%  { transform: translateY(6px) scale(1.01); opacity: 1; }
      100% { transform: none; }
    }

    .overlay-panel {
      width: min(640px, calc(100vw - 32px));
      max-height: calc(100vh - 90px);
      margin-top: 2.6rem;
      display: flex;
      flex-direction: column;
      animation: panelDrop 450ms var(--bounce) both;
    }

    /* The sign sticks out above the panel */
    .panel-header {
      display: flex;
      justify-content: center;
      margin: -2.6rem 3.5rem 0;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
    }

    .panel-sign {
      font-size: clamp(1.7rem, 4.5vw, 2.3rem);
    }

    .panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.2rem 1.6rem 1.8rem;
      position: relative;
      z-index: 1;
    }

    .panel-empty {
      font-family: var(--font-text);
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--cream-dim);
    }

    .overlay-close {
      position: absolute;
      top: -20px;
      right: -20px;
      z-index: 3;
      width: 3.2rem;
      height: 3.2rem;
      padding: 0;
      border-radius: 50%;
      font-size: 1.4rem;
    }

    @media (max-width: 480px) {
      .panel-header { margin-inline: 2.2rem; }
      .panel-body { padding-inline: 1rem; }
      .overlay-close { top: -14px; right: -8px; }
    }
  `;
  document.head.appendChild(style);
}

export class Panel {
  constructor() {
    this.element = this._createElement();
  }

  /**
   * @param {import('../../config/newGameOptions').Section} section
   */
  render(section) {
    this._label.textContent = LABELS[section.id] ?? section.label;

    // Re-trigger the drop-in animation
    this.element.style.animation = 'none';
    void this.element.offsetHeight;
    this.element.style.animation = '';

    const renderer = Sections[section.id];
    this._body.innerHTML = '';
    if (renderer) {
      this._body.appendChild(renderer(section));
    } else {
      this._body.innerHTML = `<p class="panel-empty">Section pas encore disponible.</p>`;
    }
  }

  _createElement() {
    injectStyles();

    const panel = document.createElement('div');
    panel.className = 'overlay-panel wood-panel';

    const header = document.createElement('div');
    header.className = 'panel-header';

    this._label = document.createElement('h2');
    this._label.className = 'panel-sign wood-sign saloon-ol';

    header.append(this._label);

    this._body = document.createElement('div');
    this._body.className = 'panel-body saloon-scroll';

    panel.append(header, this._body);

    return panel;
  }
}
