/**
 * InviteCard.js — The invitation card on the table: "Table en ligne"
 *
 * A cream card, "INVITATION" in Rye, a red wax seal, next to the deck of
 * StartCard ("Contre l'IA"). Clicking it opens the online panel. A red badge
 * shows how many invitations are waiting (setCount()).
 *
 * Same interface as StartCard (StartCards and CardPicker treat both alike):
 * group, section, index, isHovered, getMeshes(), flip(), unflip(), update().
 * The flip here lifts the card and stands it up toward the player.
 */

import * as THREE from 'three';
import { canvasTexture } from './canvasText.js';

const SIZE = { width: 0.36, height: 0.5, depth: 0.01 };

export class InviteCard {
  constructor({ index, position, rotation, section }) {
    this.index = index;
    this.section = section;
    this.isHovered = false;
    this.count = 0;

    this.group = new THREE.Group();
    this.group.name = `invite-${index}`;
    this.group.position.copy(position);
    this.group.rotation.y = rotation;
    this._baseY = position.y;
    this._flip = 0;
    this._target = 0;
    this._build();
  }

  /** Invitations waiting: a red badge with the number (0: none). */
  setCount(n) {
    if (n === this.count) return;
    this.count = n;
    this._face.redraw();
  }

  flip() { this._target = 1; }
  unflip() { this._target = 0; }

  update(delta) {
    this._flip += Math.sign(this._target - this._flip) * Math.min(Math.abs(this._target - this._flip), delta * 2);
    const t = this._flip < 0.5 ? 4 * this._flip ** 3 : 1 - (-2 * this._flip + 2) ** 3 / 2;
    this._card.rotation.x = -Math.PI / 2 + t * (Math.PI / 2.4); // stands up toward the player
    this._card.position.y = SIZE.depth + t * 0.3;

    const targetY = this.isHovered ? this._baseY + 0.12 : this._baseY;
    this.group.position.y += (targetY - this.group.position.y) * 0.1;
  }

  getMeshes() {
    return [this._card, this._hitbox];
  }

  _build() {
    this._face = canvasTexture(512, 712, (ctx, w, h) => this._drawFace(ctx, w, h));
    const face = new THREE.MeshStandardMaterial({ map: this._face, roughness: 0.6 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xf3e2bd, roughness: 0.7 });
    // BoxGeometry faces: +x, -x, +y, -y, +z (front), -z — lying flat, +z looks up
    this._card = new THREE.Mesh(
      new THREE.BoxGeometry(SIZE.width, SIZE.height, SIZE.depth),
      [paper, paper, paper, paper, face, paper],
    );
    this._card.rotation.x = -Math.PI / 2;
    this._card.position.y = SIZE.depth;
    this._card.castShadow = true;
    this._card.receiveShadow = true;
    this._card.userData.handIndex = this.index;
    this._card.userData.noOutline = true; // paper-thin (see render/ToonStyle.js)
    this.group.add(this._card);

    // Flat on the felt it is a thin target: an invisible box makes it easy to click
    this._hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.4, 0.7),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this._hitbox.position.y = 0.15;
    this._hitbox.userData.handIndex = this.index;
    this.group.add(this._hitbox);
  }

  _drawFace(ctx, w, h) {
    // Paper and a double gold frame
    ctx.fillStyle = '#f7e7c4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b07a1e';
    ctx.lineWidth = 14;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    ctx.lineWidth = 4;
    ctx.strokeRect(46, 46, w - 92, h - 92);

    ctx.fillStyle = '#5a2a12';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '70px Rye, Georgia, serif';
    ctx.fillText('INVITATION', w / 2, 150, w - 110);
    ctx.font = '44px "Lilita One", "Trebuchet MS", sans-serif';
    ctx.fillText('Table en ligne', w / 2, 240, w - 110);

    // Red wax seal with a spade
    ctx.fillStyle = '#a3241a';
    ctx.beginPath();
    ctx.arc(w / 2, 450, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#7a160f';
    ctx.stroke();
    ctx.fillStyle = '#f2c9a0';
    ctx.font = '140px Georgia, serif';
    ctx.fillText('♠', w / 2, 462);

    ctx.fillStyle = '#5a2a12';
    ctx.font = '38px "Lilita One", "Trebuchet MS", sans-serif';
    ctx.fillText('Joue contre tes amis', w / 2, 630, w - 110);

    if (this.count > 0) {
      // Red badge, top right: invitations waiting
      ctx.fillStyle = '#22120a';
      ctx.beginPath();
      ctx.arc(w - 78, 78, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d93a26';
      ctx.beginPath();
      ctx.arc(w - 78, 78, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff1d2';
      ctx.font = '84px "Lilita One", "Trebuchet MS", sans-serif';
      ctx.fillText(String(Math.min(this.count, 9)), w - 78, 84);
    }
  }
}
