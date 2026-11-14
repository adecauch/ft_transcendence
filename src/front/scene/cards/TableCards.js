/**
 * TableCards.js — The cards on the felt: deck, hole cards, board, muck
 *
 * Visual only. The game (shared/poker/PokerGame.js) decides which cards are
 * dealt; TableController tells this class to animate them:
 *   newHand(n, hole)  — a face-down deck, two cards to every seat that has
 *                       some (hole[seat] = ['AS','KD'], [null, null] when
 *                       hidden — faces given by reveal() — or null: seat
 *                       out), all face down, the player's too (as at a real table)
 *   peekHand(mode)    — the player looks at their cards: 'look' (hover: they
 *                       rise and turn toward the seat), 'flat' (close-up from
 *                       above: face up where they lie), null (face down again)
 *   peekBoard(on)     — the same 'look' for the community cards (hover the board)
 *   dealStreet(cards) — burn one card, turn the given community cards face up
 *   foldSeat(i)    — a seat's cards go face down to the muck
 *   reveal(i)      — a seat shows its cards (showdown)
 *   holeCodes(i), boardCodes() — what's been dealt, for the game logic / AI
 *   handMeshes(), boardMeshes() — the player's cards / the board, for the hover (TableInput)
 *   closeUpTarget(mesh) — the player's hand or the board, under the mouse,
 *                         for the camera's close-up (TableInput)
 * Opponents' cards stay face down until a showdown.
 *
 * If `dealer` is set (scene/Dealer.js), every dealt card leaves the cowboy's
 * hand as he flicks it toward its spot.
 *
 * All timing runs through update(delta), so `paused` freezes the deal.
 */

import * as THREE from 'three';
import { Card, CARD_SIZE } from './Card.js';
import { CardTextures } from './CardTextures.js';
import { PLAYER_SPOT, DECK_SPOT, seatSpots, seatFrame, yawTowardCentre } from '../seatLayout.js';

const BOARD_Z        = 0.0;
const BOARD_SPACING  = CARD_SIZE.width + 0.06;
const HOLE_SPACING   = CARD_SIZE.width * 0.55;
const HOLE_FAN       = 0.08;                // radians

// The player looking at their hand: the cards rise toward the seat, turn face
// up to it (the camera looks down at ~35°, so ~55° of tilt faces it), grow
// and spread apart so both read at a glance, clear of the stack and bet labels.
const PEEK_POSES = {
  look: (side) => ({ reveal: 1, tilt: 0.95, lift: 0.55, scale: 2.3, shift: side * 0.36, toward: 0.9 }),
  flat: () => ({ reveal: 1 }),
};

// The player looking at the board: the same rise toward the seat, smaller (up
// to five cards must fit on screen); each card also slides away from the
// middle as it grows, so they never overlap. `offset` = the card's distance
// from the middle of the board (world x; the player's right is -x).
const BOARD_LOOK_SCALE = 1.7;
const boardLookPose = (offset) => ({
  tilt: 0.95, lift: 0.7, scale: BOARD_LOOK_SCALE, toward: 0.45,
  shift: -offset * (BOARD_LOOK_SCALE - 1) * 1.05,
});

// Community cards are read from the player's seat.
const PLAYER_YAW = yawTowardCentre(PLAYER_SPOT);

export class TableCards {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.WebGLRenderer} renderer
   * @param {number} feltY — felt surface height from Table.js
   */
  constructor(scene, renderer, feltY) {
    this.scene    = scene;
    this.feltY    = feltY;
    this.textures = new CardTextures(renderer);

    /** @type {Card[]} */
    this.cards  = [];
    this.paused = false;

    /** @type {import('../dealer/Dealer').Dealer | null} */
    this.dealer = null;

    /** Called when the player's hand or the board changes: onChange('hand' | 'board') */
    this.onChange = null;

    /** Called when the player starts / stops looking at their raised hand or board: onLook('hand' | 'board', true | false) */
    this.onLook = null;

    /** Debug (npm run debug_ia): the AIs' cards are dealt face up too */
    this.revealAll = false;

    this._deck       = [];
    this._hands      = [];
    this._board      = [];
    this._boardIndex = 0;
    this._mucked     = 0;
    this._playerFolded = false;
    this._peekMode   = null;
    this._boardPeek  = false;

    /** Pending waits: { remaining (s), resolve } */
    this._timers = [];

    this._group = new THREE.Group();
    this._group.name = 'cards';
    this.scene.add(this._group);
  }

  /**
   * Clear the table and deal the given hole cards.
   * @param {number} opponentCount
   * @param {(string[]|null)[]} hole — per seat: two card codes, or null (seat out)
   */
  async newHand(opponentCount, hole) {
    this.clear();
    this._boardIndex = 0;
    this._board = [];
    this._mucked = 0;
    this._playerFolded = false;
    this._peekMode = null;

    // ── Deck stacked face down at the dealer's spot (faces set when dealt) ──
    this._deck = Array.from({ length: 52 }, (_, i) => {
      const card = new Card(null, this.textures);
      card.set({ position: this._onFelt(DECK_SPOT, i), yaw: PLAYER_YAW, faceUp: false });
      this._group.add(card.group);
      this.cards.push(card);
      return card;
    });

    await this._wait(0.4);

    // ── Hole cards: two rounds, player first, then each opponent ──
    const seats = seatSpots(opponentCount);
    this._hands = seats.map(() => []);
    const landings = [];

    for (let round = 0; round < 2; round++) {
      for (let s = 0; s < seats.length; s++) {
        if (!hole[s]) continue;
        const spot = seats[s];
        const card = this._draw(hole[s][round]);
        this._hands[s].push(card);
        landings.push((await this._toss(card, {
          position: this._holePosition(spot, round),
          yaw: yawTowardCentre(spot) + (round === 0 ? HOLE_FAN : -HOLE_FAN),
          faceUp: false,
          duration: 0.42,
          lift: 0.25,
        })).landed);
      }
    }
    await Promise.all(landings);
    this.onChange?.('hand');

    // The player's cards stay face down: hovering them shows them (peekHand)
    if (this.revealAll) await Promise.all(this._hands.slice(1).map((_, s) => this.reveal(s + 1)));
  }

  /**
   * Showdown: turn a seat's cards face up where they lie.
   * @param {number} seat
   * @param {string[]} [codes] — their faces, when they were dealt hidden (server game)
   */
  async reveal(seat, codes) {
    const hand = this._hands[seat] ?? [];
    if (codes) hand.forEach((c, i) => { if (codes[i] && c.code !== codes[i]) c.setCode(codes[i]); });
    await Promise.all(hand
      .filter((c) => !c.faceUp)
      .map((c, i) => c.flip({ delay: i * 0.1 })));
  }

  /** Card codes of a seat's hole cards ('AS', 'TD'). */
  holeCodes(seat) {
    return (this._hands[seat] ?? []).map((c) => c.code);
  }

  /** The player's cards while they hold them (not folded): hover to look at them. */
  handMeshes() {
    return this._playerHand().flatMap((c) => c.meshes);
  }

  /**
   * The player looks at their cards, or puts them down.
   * @param {'look' | 'flat' | null} mode
   */
  peekHand(mode) {
    if (mode === this._peekMode) return;
    this._peekMode = mode;
    this._playerHand().forEach((c, i) => c.peek(mode && PEEK_POSES[mode](i === 0 ? -1 : 1)));
    this.onLook?.('hand', mode === 'look');
  }

  /** The community cards turned so far: hover to look at them. */
  boardMeshes() {
    return this._board.filter((c) => c.faceUp).flatMap((c) => c.meshes);
  }

  /**
   * The player looks at the board (raised toward the seat), or puts it down.
   * @param {boolean} on
   */
  peekBoard(on) {
    if (on === this._boardPeek) return;
    this._boardPeek = on;
    this._poseBoard();
    this.onLook?.('board', on);
  }

  /** Meshes that can be clicked for a close-up: the player's hand and the board. */
  closeUpMeshes() {
    return [...this._playerHand(), ...this._board.filter((c) => c.faceUp)].flatMap((c) => c.meshes);
  }

  /**
   * The group of cards a clicked mesh belongs to, and the area it covers.
   * @param {THREE.Object3D} mesh — one of closeUpMeshes()
   * @returns {{ kind: 'hand' | 'board', centre: THREE.Vector3, width: number, depth: number } | null}
   */
  closeUpTarget(mesh) {
    const kind = this._board.some((c) => c.meshes.includes(mesh)) ? 'board'
      : (this._hands[0] ?? []).some((c) => c.meshes.includes(mesh)) ? 'hand' : null;
    return kind && this.closeUpArea(kind);
  }

  /** Area covered by the player's hand or the board (null if no card there). */
  closeUpArea(kind) {
    const cards = kind === 'board' ? this._board.filter((c) => c.faceUp) : this._playerHand();
    if (!cards.length) return null;
    // Where the cards lie, whatever their peek pose (it eases while the camera moves)
    const box = new THREE.Box3();
    cards.forEach((c) => box.expandByPoint(c.group.position));
    box.expandByScalar(CARD_SIZE.height / 2);
    const size = box.getSize(new THREE.Vector3());
    return { kind, centre: box.getCenter(new THREE.Vector3()), width: size.x, depth: size.z };
  }

  /** Card codes of the community cards dealt so far. */
  boardCodes() {
    return this._board.map((c) => c.code);
  }

  /**
   * Burn one card and turn the given community cards face up in the middle
   * (3 on the flop, 1 on the turn and river).
   * @param {string[]} codes
   */
  async dealStreet(codes) {
    await this._wait(0.6);
    this._draw(null); // burn card, stays on the deck (face unknown)

    const reveals = [];
    for (let i = 0; i < codes.length; i++, this._boardIndex++) {
      const card = this._draw(codes[i]);
      this._board.push(card);
      reveals.push((await this._toss(card, {
        position: this._onFelt({ x: (this._boardIndex - 2) * BOARD_SPACING, z: BOARD_Z }),
        yaw: PLAYER_YAW,
        faceUp: true,
        duration: 0.55,
        lift: 0.3,
      })).landed);
    }
    await Promise.all(reveals);
    if (this._boardPeek) this._poseBoard(); // a new card joins the raised ones: respread
    this.onChange?.('board');
  }

  /** A seat folds: its cards slide face down to the muck, by the deck. */
  async foldSeat(seat) {
    if (seat === 0) {
      this.peekHand(null);
      this._playerFolded = true;
    }
    const muck = { x: DECK_SPOT.x - CARD_SIZE.width * 1.4, z: DECK_SPOT.z };
    const layer = this._mucked++ * 2;
    await Promise.all((this._hands[seat] ?? []).map((c, i) => c.moveTo({
      position: this._onFelt(muck, layer + i),
      yaw: PLAYER_YAW + (i ? 0.25 : -0.1),
      faceUp: false,
      duration: 0.5,
      delay: i * 0.08,
      lift: 0.2,
    })));
    if (seat === 0) this.onChange?.('hand');
  }

  /** Stop any deal in progress and clear the table. */
  stop() {
    this.paused = false;
    this.clear();
  }

  /** Remove every card from the table. */
  clear() {
    this._timers = [];
    this._hands = [];
    this._board = [];
    this._playerFolded = false;
    if (this._peekMode) this.onLook?.('hand', false);
    if (this._boardPeek) this.onLook?.('board', false);
    this._peekMode = null;
    this._boardPeek = false;
    this.cards.forEach((c) => {
      this._group.remove(c.group);
      c.meshes[0].material.dispose(); // per-card face material
    });
    this.cards = [];
    this.onChange?.('hand');
    this.onChange?.('board');
  }

  /** @param {number} delta */
  update(delta) {
    if (this.paused) return;

    for (const c of this.cards) c.update(delta);

    this._timers = this._timers.filter((t) => {
      t.remaining -= delta;
      if (t.remaining > 0) return true;
      t.resolve();
      return false;
    });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** The player's two cards, or none once folded (they're in the muck). */
  _playerHand() {
    return this._playerFolded ? [] : this._hands[0] ?? [];
  }

  /** Raise the board cards (spread around their middle) or put them back down. */
  _poseBoard() {
    const n = this._board.length;
    this._board.forEach((c, i) => c.peek(this._boardPeek
      ? boardLookPose((i - (n - 1) / 2) * BOARD_SPACING)
      : null));
  }

  /** Top card of the deck, given its face if the game says which card it is. */
  _draw(code) {
    const card = this._deck.pop();
    if (card && code) card.setCode(code);
    return card;
  }

  /**
   * Send a card to its spot — from the dealer's hand when there is one,
   * otherwise straight from the deck. Resolves once the card is on its way,
   * with `{ landed }` (wrapped, so awaiting the toss doesn't also wait for the
   * landing — the next card can follow right away).
   */
  async _toss(card, move) {
    if (this.dealer) {
      const hand = await this.dealer.release(move.position);
      card.set({ position: hand });
      return { landed: card.moveTo({ ...move, lift: move.lift * 0.4 }) };
    }
    await this._wait(0.12);
    return { landed: card.moveTo(move) };
  }

  /** Pause-aware delay, advanced by update(). */
  _wait(seconds) {
    return new Promise((resolve) => this._timers.push({ remaining: seconds, resolve }));
  }

  /** World position on the felt; `layer` stacks cards without z-fighting. */
  _onFelt({ x, z }, layer = 0) {
    return new THREE.Vector3(x, this.feltY + CARD_SIZE.depth / 2 + layer * (CARD_SIZE.depth + 0.0003), z);
  }

  /** Hole card `index` (0 or 1) at a seat, side by side facing the centre. */
  _holePosition(spot, index) {
    const { left } = seatFrame(spot);
    const offset   = (index === 0 ? 1 : -1) * HOLE_SPACING; // first card on the left
    return this._onFelt(
      { x: spot.x + left.x * offset, z: spot.z + left.z * offset },
      index, // second card slightly above the first where they overlap
    );
  }
}
