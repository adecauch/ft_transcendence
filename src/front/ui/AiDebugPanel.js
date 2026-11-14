/**
 * AiDebugPanel.js — `npm run debug_ia`: every card and every AI decision,
 * in very large, high-contrast text (readability over looks — debug only).
 *
 * Reads the hand in progress from TableController.current (the game's seats)
 * and the dealt cards from TableCards; TableController calls record() after
 * each AI decision.
 * Four-colour suits so they can't be confused: ♠ white, ♥ red, ♦ blue, ♣ green.
 */

const SUITS = {
  S: { sym: '♠', color: '#ffffff' },
  H: { sym: '♥', color: '#ff4d4d' },
  D: { sym: '♦', color: '#4da6ff' },
  C: { sym: '♣', color: '#3ddc84' },
};
const RANK = { T: '10', J: 'V', Q: 'D', K: 'R', A: 'A' };

const ACTION = { fold: 'SE COUCHE', check: 'CHECK', call: 'SUIT', raise: 'RELANCE' };

function card(code) {
  const s = SUITS[code[1]];
  return `<span class="aid-card" style="color:${s.color}">${RANK[code[0]] ?? code[0]}${s.sym}</span>`;
}

function cards(codes) {
  return codes.length ? codes.map(card).join('') : '<span class="aid-dim">—</span>';
}

const pct = (p) => `${Math.round(p * 100)}%`;

export class AiDebugPanel {
  /**
   * @param {import('../game/TableController').TableController} tableController
   * @param {import('../scene/cards/TableCards').TableCards} tableCards
   */
  constructor(tableController, tableCards) {
    this.tableController = tableController;
    this.tableCards = tableCards;
    /** seat index → last decision */
    this.decisions = new Map();
    this._handId = null;

    const style = document.createElement('style');
    style.textContent = `
      .aid {
        position: fixed; top: 70px; right: 12px; z-index: 40;
        width: min(760px, 58vw); max-height: calc(100vh - 90px); overflow-y: auto;
        background: #000; color: #fff; border: 4px solid #ffd400; border-radius: 10px;
        padding: 16px 20px; font: 700 26px/1.3 Arial, Helvetica, sans-serif;
        pointer-events: none;
      }
      .aid h3 { margin: 0 0 6px; font-size: 22px; color: #ffd400; letter-spacing: 0.08em; }
      .aid-row { margin-bottom: 14px; }
      .aid-card {
        display: inline-block; min-width: 2.2em; margin-right: 10px; padding: 2px 8px;
        background: #1a1a1a; border: 2px solid #555; border-radius: 8px;
        font-size: 48px; line-height: 1.1; text-align: center;
      }
      .aid-seat { border-top: 2px solid #444; padding-top: 10px; margin-top: 10px; }
      .aid-name { font-size: 30px; }
      .aid-dim { color: #888; }
      .aid-act { font-size: 34px; color: #ffd400; }
      .aid-src-solver { color: #3ddc84; }
      .aid-src-fallback { color: #ff9f43; }
      .aid-probs span { display: inline-block; margin-right: 22px; }
    `;
    document.head.appendChild(style);

    this.el = document.createElement('div');
    this.el.className = 'aid';
    document.body.appendChild(this.el);

    setInterval(() => this._render(), 250);
  }

  /** Called by TableController after each AI decision. */
  record(seat, action, debug, street) {
    this._syncHand();
    this.decisions.set(seat, { action, debug, street });
    this._render();
  }

  /** New hand: forget the previous hand's decisions. */
  _syncHand() {
    const id = this.tableController.current?.id ?? null;
    if (id !== this._handId) {
      this._handId = id;
      this.decisions.clear();
    }
  }

  _render() {
    const hand = this.tableController.current;
    if (!hand) {
      this.el.innerHTML = '<h3>DEBUG IA</h3>Lance une partie : clique sur la carte devant le croupier.';
      return;
    }
    this._syncHand();

    const board = this.tableCards.boardCodes();
    let html = `<h3>DEBUG IA · MAIN ${hand.id}</h3>
      <div class="aid-row"><div class="aid-dim">TABLEAU</div>${cards(board)}</div>`;

    for (const seat of hand.seats) {
      const hole = this.tableCards.holeCodes(seat.index);
      const status = seat.out ? ' · ÉLIMINÉ' : seat.folded ? ' · COUCHÉ' : '';
      html += `<div class="aid-seat">
        <div class="aid-name">${seat.name.toUpperCase()} <span class="aid-dim">${seat.stack} jetons${status}</span></div>
        <div>${cards(hole)}</div>`;

      const d = this.decisions.get(seat.index);
      if (d && !seat.isHuman) {
        const { action, debug, street } = d;
        const amount = action.type === 'raise' ? ` À ${action.to}` : action.type === 'call' ? ` ${action.amount}` : '';
        const source = debug.fromSolver
          ? '<span class="aid-src-solver">SOLVEUR MCCFR</span>'
          : `<span class="aid-src-fallback">REPLI — ${debug.offTree ? `hors abstraction : ${debug.offTree}` : 'clé absente de la table'}</span>`;
        // One probability per option of the solver's node: fold, call, each size, all-in
        const probs = debug.probs
          .map((p, i) => ({ p, label: debug.options[i] }))
          .filter(({ p }, i) => p > 0 || i === debug.choice)
          .map(({ p, label }) => `<span>${label} ${pct(p)}</span>`).join('');
        html += `
          <div class="aid-act">→ ${ACTION[action.type]}${amount} <span class="aid-dim">(${street})</span></div>
          <div>${source}</div>
          <div class="aid-probs">${probs}</div>
          <div class="aid-dim">Force ${pct(debug.strength)} · bucket ${debug.bucket} · historique ${debug.history}</div>`;
      }
      html += '</div>';
    }
    this.el.innerHTML = html;
  }
}
