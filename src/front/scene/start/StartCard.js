/**
 * StartCard.js — A clickable pair of face-down cards on the table
 */

import * as THREE from 'three';

const CARD = {
  width:  0.2,
  height: 0.4,
  depth:  0.012,
  gap:    0.18,
  fan:    0.12,
};

export class StartCard {
  constructor({ index, position, rotation, section, loader }) {
    this.index    = index;
    this.loader   = loader;
    this.section  = section;

    this.group = new THREE.Group();
    this.group.name = `hand-${index}`;
    this.group.position.copy(position);
    this.group.rotation.y = rotation;

    this._baseY = position.y;
    this.state = 'resting';
    this._flipProgress = 0;
    this.cards = [];
    this.isHovered = false;

    this._build();
  }

  flip() {
    if (this.state === 'flipped' || this.state === 'flipping') return;
    this.state = 'flipping';
  }

  unflip() {
    if (this.state === 'resting' || this.state === 'unflipping') return;
    this.state = 'unflipping';
  }

  update(delta) {
    const speed = 2.0;

    if (this.state === 'flipping') {
      this._flipProgress = Math.min(1, this._flipProgress + delta * speed);
      this._applyFlip(this._flipProgress);
      if (this._flipProgress >= 1) this.state = 'flipped';
    }

    if (this.state === 'unflipping') {
      this._flipProgress = Math.max(0, this._flipProgress - delta * speed);
      this._applyFlip(this._flipProgress);
      if (this._flipProgress <= 0) this.state = 'resting';
    }

    const targetY = this.isHovered ? this._baseY + 0.12 : this._baseY;
    this.group.position.y += (targetY - this.group.position.y) * 0.1;
  }

  /** Meshes the mouse can hit: the cards plus a larger invisible box around them. */
  getMeshes() {
    return this._hitbox ? [...this.cards, this._hitbox] : this.cards;
  }

  _build() {
    const loader = new THREE.TextureLoader();
    const cardTex = loader.load('/textures/cards/card.jpg');
    cardTex.colorSpace = THREE.SRGBColorSpace;

    // MeshPhysicalMaterial — effet vernis brillant comme une vraie carte
    const backMat = new THREE.MeshPhysicalMaterial({
      map: cardTex,
      roughness: 0.1,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    });

    const frontMat = new THREE.MeshPhysicalMaterial({
      map: cardTex,
      roughness: 0.1,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    });

    const edgeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf0e8d0,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });

    const materials = [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, backMat];

    for (let i = 0; i < 2; i++) {
      const geo = new THREE.BoxGeometry(CARD.width, CARD.height, CARD.depth);
      const card = new THREE.Mesh(geo, materials);

      const side = i === 0 ? -1 : 1;
      card.position.x = side * (CARD.gap / 2);
      card.rotation.z = side * CARD.fan * 0.5;

      // Cartes à plat sur le tapis
      card.rotation.x = -Math.PI / 2;

      card.castShadow    = true;
      card.receiveShadow = true;
      card.userData.handIndex = this.index;
      card.userData.cardIndex = i;
      card.userData.noOutline = true; // paper-thin (see render/ToonStyle.js)

      this.group.add(card);
      this.cards.push(card);
    }

    // Seen flat from across the table the cards are a thin target, and they
    // lift on hover — an invisible box keeps them easy to click.
    this._hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.4, 0.8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this._hitbox.position.y = 0.15;
    this._hitbox.userData.handIndex = this.index;
    this.group.add(this._hitbox);
  }

  _applyFlip(t) {
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    this.cards.forEach((card, i) => {
      const side = i === 0 ? -1 : 1;
      card.rotation.x = -Math.PI / 2 + (Math.PI / 2) * ease;
      card.rotation.z = side * CARD.fan * (0.5 + ease * 0.5);
      card.position.y = ease * 0.3;
    });
  }
}