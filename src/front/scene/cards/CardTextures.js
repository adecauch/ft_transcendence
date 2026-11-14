/**
 * CardTextures.js — Lazy texture cache for card faces and the card back
 *
 * Faces are SVGs (public/textures/cards/deck/<code>.svg). Each one is
 * rasterised into a canvas at FACE_HEIGHT px the first time it is needed, so
 * only the cards actually on the table take GPU memory.
 */

import * as THREE from 'three';

const FACE_DIR    = '/textures/cards/deck/';
const BACK_URL    = '/textures/cards/card.jpg';
const FACE_HEIGHT = 1024;
const FACE_WIDTH  = Math.round(FACE_HEIGHT * (240 / 336)); // SVG viewBox ratio

export class CardTextures {
  /** @param {THREE.WebGLRenderer} [renderer] — used for max anisotropy */
  constructor(renderer) {
    this._anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;

    /** @type {Map<string, THREE.CanvasTexture>} */
    this._faces = new Map();
    this._back  = null;
  }

  /** @returns {THREE.Texture} */
  back() {
    if (!this._back) {
      this._back = new THREE.TextureLoader().load(BACK_URL);
      this._setup(this._back);
    }
    return this._back;
  }

  /**
   * Face texture for a card code. Returned immediately; the image is drawn
   * into it once the SVG has loaded.
   * @param {string} code — e.g. 'AS'
   * @returns {THREE.CanvasTexture}
   */
  face(code) {
    let tex = this._faces.get(code);
    if (tex) return tex;

    const canvas = document.createElement('canvas');
    canvas.width  = FACE_WIDTH;
    canvas.height = FACE_HEIGHT;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, FACE_WIDTH, FACE_HEIGHT);

    tex = new THREE.CanvasTexture(canvas);
    this._setup(tex);
    this._faces.set(code, tex);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, FACE_WIDTH, FACE_HEIGHT);
      tex.needsUpdate = true;
    };
    img.onerror = () => console.warn(`[CardTextures] Missing face: ${code}`);
    img.src = `${FACE_DIR}${code}.svg`;

    return tex;
  }

  _setup(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this._anisotropy;
  }
}
