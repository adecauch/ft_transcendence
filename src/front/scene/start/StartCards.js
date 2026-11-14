/**
 * StartCards.js — Manages the clickable cards on the table
 *
 * Two objects on the felt in front of the dealer, one per way to play, each
 * with a big label floating above it:
 *   the deck (StartCard)          « Contre l'IA »   → the new-game menu
 *   the invitation (InviteCard)   « Table en ligne » → the online panel
 *
 * setInvites(n) shows the invitations waiting on the invitation card.
 *
 * Responsibilities:
 *  - Instantiate StartCard objects and add them to the scene
 *  - Forward update() calls to each hand
 *  - Track which hand (if any) is currently selected/flipped
 *  - Expose helpers used by TableInput (getHandByMesh, selectHand, etc.)
 */

import * as THREE from 'three';
import { StartCard } from './StartCard.js';
import { InviteCard } from './InviteCard.js';
import { makeLabel } from './canvasText.js';
import { START_SECTION, ONLINE_SECTION } from '../../config/newGameOptions.js';

const FELT_Y_DEFAULT = 0.15;

// x, z : on the felt. Seen from the player's side (z < 0, looking toward +z),
//        +x is on the LEFT and +z is toward the dealer
// rot  : Y rotation in radians — the cards read the right way up from the player
// Labels: plain text (a canvas has no emoji font everywhere: they'd be boxes)
// toward: the side of the screen its label extends to (outward: no overlap)
const HAND_POSITIONS = [
  { x: 0.8,  z: 0.55, rot: Math.PI, section: START_SECTION, Kind: StartCard, label: 'Contre l\'IA', toward: 'left' },     // 0 — the deck
  { x: -0.8, z: 0.55, rot: Math.PI, section: ONLINE_SECTION, Kind: InviteCard, label: 'Table en ligne', toward: 'right' }, // 1 — the invitation
];
const SCALE = 1.6;   // bigger than real cards: they must read from the overview (hidden in game)
const LABEL_Y = 0.5; // labels float this high above the felt

export class StartCards {
  /**
   * @param {THREE.Scene}   scene
   * @param {import('../../render/AssetLoader').AssetLoader} loader
   */
  constructor(scene, loader) {
    this.scene  = scene;
    this.loader = loader;

    /** @type {StartCard[]} */
    this.hands = [];

    /** @type {{ sign: THREE.Sprite, label: string, hand: object }[]} */
    this._labels = [];

    /** Index of the currently selected hand, or null */
    this.selectedIndex = null;

    this._group = new THREE.Group();
    this._group.name = 'hands';
    this.scene.add(this._group);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Instantiate all hands at their fixed positions.
   * @param {number} [feltY] — felt surface Y from Table.js
   */
  buildAll(feltY = FELT_Y_DEFAULT) {
    HAND_POSITIONS.forEach(({ x, z, rot, section, Kind, label, toward }, i) => {
      const position = new THREE.Vector3(x, feltY, z);

      const hand = new Kind({
        index: i,
        position,
        rotation: rot,
        section,
        loader: this.loader,
      });

      hand.group.scale.setScalar(SCALE);
      this.hands.push(hand);
      this._group.add(hand.group);

      const sign = makeLabel(label, { toward });
      sign.position.set(x, feltY + LABEL_Y, z);
      this._group.add(sign);
      this._labels.push({ sign, label, hand });
    });

    console.log(`[StartCards] ${this.hands.length} hands placed on the table.`);
  }

  /**
   * Per-frame update — forwards to all hands.
   * @param {number} delta
   */
  update(delta) {
    this.hands.forEach((h) => h.update(delta));
  }

  /**
   * Find the StartCard that owns the given mesh (used after raycasting).
   * @param {THREE.Mesh} mesh
   * @returns {StartCard | undefined}
   */
  getHandByMesh(mesh) {
    const idx = mesh.userData.handIndex;
    return typeof idx === 'number' ? this.hands[idx] : undefined;
  }

  /**
   * Select (flip) a hand. Unflip any previously selected hand first.
   * @param {number} index — hand index
   */
  selectHand(index) {
    if (this.selectedIndex !== null && this.selectedIndex !== index) {
      this.hands[this.selectedIndex].unflip();
    }
    this.selectedIndex = index;
    this.hands[index].flip();
  }

  /** Deselect and unflip the currently active hand. */
  deselectAll() {
    if (this.selectedIndex !== null) {
      this.hands[this.selectedIndex].unflip();
      this.selectedIndex = null;
    }
  }

  /**
   * Set hover state on a hand (clears previous hover).
   * @param {StartCard | null} hand
   */
  setHovered(hand) {
    this.hands.forEach((h) => {
      h.isHovered = h === hand;
    });
  }

  /** Invitations waiting (online mode): a badge on the card, and « · n » on its label (readable from afar). */
  setInvites(n) {
    for (const { sign, label, hand } of this._labels) {
      if (!hand.setCount) continue;
      hand.setCount(n);
      sign.setText(n ? `${label} · ${n}` : label);
    }
  }

  /** Show or hide the cards (hidden hands can't be hovered or clicked). */
  setVisible(visible) {
    this._group.visible = visible;
  }

  get visible() {
    return this._group.visible;
  }
}