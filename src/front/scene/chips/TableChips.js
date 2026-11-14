/**
 * TableChips.js — The chips on the felt, always matching the real amounts
 *
 * Per seat: a stack (the player's chips) and a bet (chips put in during the
 * current betting round). In the middle: the pot. Plus small labels with the
 * exact amounts, projected from 3D to the screen every frame.
 *
 *   reset(seats)              — new hand: every seat's stack, no bets, empty pot
 *   bet(i, totalBet, stack)   — chips fly from seat i's stack to its bet
 *   collect(pot)              — all bets slide into the pot
 *   payout(results)           — the pot splits between winners: [{ seat, amount, stack }]
 *   showHand(i, text)         — shows a hand name under seat i's label (showdown)
 *   fold(i)                   — dims seat i's label
 *   clearLabels(i, on)        — fades seat i's labels away (the player looks at
 *                               their cards, raised right under them)
 *   clearPot(on)              — same for the pot's label (the player looks at the board)
 *
 * All motion runs through update(delta); `paused` freezes it.
 */

import * as THREE from 'three';
import { ChipModel, CHIP_SIZE } from './ChipModel.js';
import { exactChips, stackChips } from './chipStacks.js';
import { POT_SPOT } from '../seatLayout.js';
import { money, onUnitChange } from '../../ui/chipUnit.js';
import { injectChipLabelStyles } from './labelStyles.js';

const MAX_PILE      = 20;                      // chips per pile before starting another
const PILE_SPACING  = CHIP_SIZE.radius * 2.15;
const LAYER         = CHIP_SIZE.height * 1.02;
const JITTER        = CHIP_SIZE.radius * 0.06; // piles are never perfectly straight

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class TableChips {
  /**
   * @param {object} deps
   * @param {THREE.Scene} deps.scene
   * @param {THREE.Camera} deps.camera
   * @param {THREE.WebGLRenderer} deps.renderer
   * @param {number} deps.feltY
   */
  constructor({ scene, camera, renderer, feltY }) {
    this.camera  = camera;
    this.canvas  = renderer.domElement;
    this.feltY   = feltY;
    this.paused  = false;

    this.factory = new ChipModel(renderer);
    this.factory.warmUp();

    this._group = new THREE.Group();
    this._group.name = 'chips';
    scene.add(this._group);

    injectChipLabelStyles();
    this._labelLayer = document.createElement('div');
    this._labelLayer.className = 'chip-labels';
    document.body.appendChild(this._labelLayer);
    onUnitChange(() => this._drawLabels()); // chips ↔ big blinds

    this._seats  = [];
    this._pot    = null;
    this._tweens = [];
    this._timers = [];
    this._tmp    = new THREE.Vector3();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * New hand: show every seat's stack, no bets, empty pot.
   * @param {{ name: string, layout: { stack: object, stackDir: object, bet: object }, stack: number, out?: boolean }[]} seats
   *   `out`: busted seat, sitting out
   */
  reset(seats) {
    this.clear();

    this._seats = seats.map(({ name, layout, stack, out }) => {
      const seat = {
        name,
        layout,
        out,
        stack: null,
        bet: null,
        betAmount: 0,
        stackLabel: this._label(''),
        betLabel: this._label('', 'bet'),
      };
      this._setStack(seat, stack);
      return seat;
    });

    this._pot = { group: null, label: this._label('', 'pot'), amount: 0 };
    this._setPot(0);
  }

  /**
   * Seat i now has `totalBet` in front of it this round and `stack` behind.
   * The added chips fly from the stack to the bet.
   */
  async bet(i, totalBet, stack) {
    const seat = this._seats[i];
    if (!seat) return;
    const added = totalBet - (seat.betAmount ?? 0);

    this._setStack(seat, stack);
    if (added > 0) {
      const flying = this._pile(exactChips(added), seat.layout.stackDir);
      flying.position.copy(this._onFelt(seat.layout.stack));
      this._group.add(flying);
      await this._tween(flying, this._onFelt(seat.layout.bet), 0.45, 0.18);
      this._group.remove(flying);
    }
    this._setBet(seat, totalBet);
  }

  /** End of a betting round: every bet slides into the pot. */
  async collect(potTotal) {
    const moves = this._seats
      .filter((s) => s.bet)
      .map((s) => {
        const g = s.bet;
        s.bet = null;
        s.betAmount = 0;
        s.betLabel.hidden = true;
        return this._tween(g, this._onFelt(POT_SPOT), 0.5, 0.1).then(() => this._group.remove(g));
      });
    await Promise.all(moves);
    this._setPot(potTotal);
  }

  /**
   * The pot goes to the winners: each one's share slides from the middle to
   * their stack, which then becomes `stack`.
   * @param {{ seat: number, amount: number, stack: number }[]} results
   */
  async payout(results) {
    const pot = this._pot;
    if (!pot) return;
    if (pot.group) this._group.remove(pot.group);
    pot.group = null;
    this._setPot(0);

    await Promise.all(results.map(async ({ seat: i, amount, stack }) => {
      const seat = this._seats[i];
      if (!seat) return;
      if (amount > 0) {
        const share = this._pile(exactChips(amount), { x: 1, z: 0 });
        share.position.copy(this._onFelt(POT_SPOT));
        this._group.add(share);
        await this._tween(share, this._onFelt(seat.layout.stack), 0.6, 0.15);
        this._group.remove(share);
      }
      this._setStack(seat, stack);
    }));
  }

  /** Showdown: the hand's name under the seat's label. */
  showHand(i, text) {
    const seat = this._seats[i];
    if (!seat) return;
    seat.handText = text; // kept until the next hand (stack updates redraw the label)
    this._drawStackLabel(seat);
  }

  /** Grey out a seat that folded. */
  fold(i) {
    this._seats[i]?.stackLabel.classList.add('folded');
  }

  /** Fade a seat's stack and bet labels out of the way (HTML stays above the 3D cards). */
  clearLabels(i, on) {
    const seat = this._seats[i];
    if (!seat) return;
    seat.stackLabel.classList.toggle('cleared', on);
    seat.betLabel.classList.toggle('cleared', on);
  }

  /** Fade the pot's label out of the way (the raised board cards cover the pot). */
  clearPot(on) {
    this._pot?.label.classList.toggle('cleared', on);
  }

  /** Pause-aware delay, advanced by update(). */
  wait(seconds) {
    return new Promise((resolve) => this._timers.push({ remaining: seconds, resolve }));
  }

  /** Remove every chip and label. */
  clear() {
    this._group.clear();
    this._labelLayer.innerHTML = '';
    this._seats  = [];
    this._pot    = null;
    this._tweens = [];
    this._timers = [];
  }

  /** @param {number} delta */
  update(delta) {
    if (!this.paused) {
      this._tweens = this._tweens.filter((tw) => {
        tw.t = Math.min(1, tw.t + delta / tw.duration);
        const e = easeInOut(tw.t);
        tw.obj.position.lerpVectors(tw.from, tw.to, e);
        tw.obj.position.y += Math.sin(Math.PI * tw.t) * tw.lift;
        if (tw.t < 1) return true;
        tw.resolve();
        return false;
      });

      this._timers = this._timers.filter((t) => {
        t.remaining -= delta;
        if (t.remaining > 0) return true;
        t.resolve();
        return false;
      });
    }
    this._placeLabels();
  }

  // ── Private: chips ─────────────────────────────────────────────────────────

  _setStack(seat, amount) {
    if (seat.stack) this._group.remove(seat.stack);
    seat.stackAmount = amount;
    seat.stack = amount > 0 ? this._pile(stackChips(amount), seat.layout.stackDir) : null;
    if (seat.stack) {
      seat.stack.position.copy(this._onFelt(seat.layout.stack));
      this._group.add(seat.stack);
    }
    this._drawStackLabel(seat);
    seat.stackAnchor = this._onFelt(seat.layout.stack);
    seat.stackAnchor.y += this._pileHeight(seat.stack) + 0.05;
  }

  _drawStackLabel(seat) {
    const amount = seat.stackAmount;
    seat.stackLabel.innerHTML = `${seat.name} <b>${amount > 0 ? money(amount) : seat.out ? 'Éliminé' : 'Tapis !'}</b>`
      + (seat.handText ? `<span class="hand">${seat.handText}</span>` : '');
    seat.stackLabel.classList.toggle('out', !!seat.out);
  }

  _drawBetLabel(seat) {
    seat.betLabel.textContent = money(seat.betAmount);
    seat.betLabel.hidden = seat.betAmount <= 0;
  }

  _drawPotLabel() {
    const { label, amount } = this._pot;
    label.innerHTML = `Pot <b>${money(amount)}</b>`;
    label.hidden = amount <= 0;
  }

  /** Every label again, in the current unit (after the chips / BB toggle). */
  _drawLabels() {
    for (const seat of this._seats) {
      this._drawStackLabel(seat);
      this._drawBetLabel(seat);
    }
    if (this._pot) this._drawPotLabel();
  }

  _setBet(seat, amount) {
    if (seat.bet) this._group.remove(seat.bet);
    seat.betAmount = amount;
    seat.bet = amount > 0 ? this._pile(exactChips(amount), seat.layout.stackDir) : null;
    if (seat.bet) {
      seat.bet.position.copy(this._onFelt(seat.layout.bet));
      this._group.add(seat.bet);
    }
    this._drawBetLabel(seat);
    seat.betAnchor = this._onFelt(seat.layout.bet);
    seat.betAnchor.y += this._pileHeight(seat.bet) + 0.04;
  }

  _setPot(amount) {
    const pot = this._pot;
    if (pot.group) this._group.remove(pot.group);
    pot.amount = amount;
    pot.group = amount > 0 ? this._pile(exactChips(amount), { x: 1, z: 0 }) : null;
    if (pot.group) {
      pot.group.position.copy(this._onFelt(POT_SPOT));
      this._group.add(pot.group);
    }
    this._drawPotLabel();
    pot.anchor = this._onFelt(POT_SPOT);
    pot.anchor.y += this._pileHeight(pot.group) + 0.05;
  }

  /**
   * Piles of chips, one colour per pile (a new pile every MAX_PILE chips),
   * lined up along `dir` and centred on the group's origin.
   * @param {number[]} values — largest first
   */
  _pile(values, dir) {
    const group = new THREE.Group();
    const piles = [];
    let current = null;
    for (const v of values) {
      if (!current || current.value !== v || current.chips.length >= MAX_PILE) {
        current = { value: v, chips: [] };
        piles.push(current);
      }
      current.chips.push(v);
    }

    const offset = (piles.length - 1) / 2;
    piles.forEach((pile, p) => {
      const along = (p - offset) * PILE_SPACING;
      pile.chips.forEach((v, k) => {
        const chip = this.factory.create(v);
        chip.position.set(
          dir.x * along + (Math.random() - 0.5) * JITTER,
          CHIP_SIZE.height / 2 + k * LAYER,
          dir.z * along + (Math.random() - 0.5) * JITTER,
        );
        chip.rotation.y = Math.random() * Math.PI * 2;
        group.add(chip);
      });
    });
    group.userData.height = Math.min(values.length, MAX_PILE) * LAYER;
    group.userData.tallest = piles.reduce((h, pl) => Math.max(h, pl.chips.length), 0) * LAYER;
    return group;
  }

  _pileHeight(group) {
    return group ? group.userData.tallest : 0;
  }

  _onFelt({ x, z }) {
    return new THREE.Vector3(x, this.feltY, z);
  }

  _tween(obj, to, duration, lift) {
    return new Promise((resolve) => {
      this._tweens.push({ obj, from: obj.position.clone(), to: to.clone(), t: 0, duration, lift, resolve });
    });
  }

  // ── Private: labels ────────────────────────────────────────────────────────

  _label(html, kind = '') {
    const el = document.createElement('div');
    el.className = `chip-label ${kind}`.trim();
    el.innerHTML = html;
    this._labelLayer.appendChild(el);
    return el;
  }

  _placeLabels() {
    const place = (el, anchor) => {
      if (!anchor || el.hidden) return;
      const p = this._tmp.copy(anchor).project(this.camera);
      const visible = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      el.style.visibility = visible ? 'visible' : 'hidden';
      const rect = this.canvas.getBoundingClientRect();
      const x = rect.left + (p.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (-p.y * 0.5 + 0.5) * rect.height;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    };
    for (const s of this._seats) {
      place(s.stackLabel, s.stackAnchor);
      place(s.betLabel, s.betAnchor);
    }
    if (this._pot) place(this._pot.label, this._pot.anchor);
  }
}
