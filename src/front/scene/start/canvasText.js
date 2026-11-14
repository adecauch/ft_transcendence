/**
 * canvasText.js — Text drawn on a canvas, for the start objects on the table
 *
 * The page's fonts (Rye, Lilita One: @fontsource, main.js) may not be loaded
 * yet when the scene is built: whenFonts() redraws once they are, otherwise
 * the canvas would keep its fallback font.
 */

import * as THREE from 'three';

/** A canvas texture redrawn by `draw(ctx, w, h)`; call `.redraw()` to update it. */
export function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.redraw = () => {
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
    texture.needsUpdate = true;
  };
  texture.redraw();
  whenFonts(() => texture.redraw());
  return texture;
}

/** Run `fn` once the page's fonts are ready (right away if they are). */
function whenFonts(fn) {
  document.fonts?.ready.then(fn);
  for (const font of ['48px Rye', '48px "Lilita One"']) document.fonts?.load(font).then(fn).catch(() => {});
}

/** Label height, as a share of the screen height (constant at any distance). */
const LABEL_SCREEN_HEIGHT = 0.065;
const TAN_HALF_FOV = Math.tan((45 / 2) * Math.PI / 180); // render/Engine.js: fov 45

/**
 * A big label next to an object, always facing the camera and **the same size
 * on screen at any distance** (sizeAttenuation off): dark wood, thick outline,
 * cream text — the player's screen is damaged, it must read from the far view.
 * It starts at the object and goes `toward` one side, so two labels side by
 * side never overlap.
 * @param {string} text
 * @param {{ toward?: 'left' | 'right' }} [options] — side of the screen it extends to
 * @returns {THREE.Sprite & { setText(text: string): void }}
 */
export function makeLabel(text, { toward = 'right' } = {}) {
  const W = 1024;
  const H = 220;
  let shown = text;
  const texture = canvasTexture(W, H, (ctx) => {
    const text = shown;
    ctx.font = '120px "Lilita One", "Trebuchet MS", sans-serif';
    const width = Math.min(W - 40, ctx.measureText(text).width + 110);
    // The pill sits against the anchored edge of the canvas (see sprite.center)
    const x = toward === 'right' ? 20 : W - 20 - width;
    ctx.fillStyle = '#22120a';
    roundRect(ctx, x, 20, width, H - 40, 46);
    ctx.fill();
    ctx.fillStyle = '#6c4020';
    roundRect(ctx, x + 12, 32, width - 24, H - 64, 36);
    ctx.fill();
    ctx.fillStyle = '#fff1d2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + width / 2, H / 2 + 6, width - 70);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, depthTest: false, transparent: true, sizeAttenuation: false,
  }));
  // Without size attenuation the scale is a share of the view's height × 2·tan(fov/2)
  const h = LABEL_SCREEN_HEIGHT * 2 * TAN_HALF_FOV;
  sprite.scale.set(h * (W / H), h, 1);
  sprite.center.set(toward === 'right' ? 0 : 1, 0.5); // anchored at the object's side
  sprite.setText = (next) => {
    if (next === shown) return;
    shown = next;
    texture.redraw();
  };
  sprite.renderOrder = 10; // above the table and the dealer
  sprite.userData.noOutline = true;
  return sprite;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
