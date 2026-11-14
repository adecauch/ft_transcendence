/**
 * CardPicker.js — Mouse-to-3D-object hit detection
 *
 * Wraps THREE.Raycaster and provides two helpers:
 *  - getHoveredHand(event)  — returns the StartCard under the cursor (or null)
 *  - getClickedHand(event)  — same, intended for click events
 *
 * The caller (TableInput) is responsible for wiring the DOM events.
 */

import * as THREE from 'three';

export class CardPicker {
  /**
   * @param {THREE.Camera}  camera
   * @param {HTMLCanvasElement} canvas
   * @param {import('../scene/start/StartCards').StartCards} startCards
   */
  constructor(camera, canvas, startCards) {
    this.camera      = camera;
    this.canvas      = canvas;
    this.startCards = startCards;

    this._raycaster = new THREE.Raycaster();
    this._mouse     = new THREE.Vector2();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Cast a ray from the mouse position and return the first intersected StartCard.
   * @param {MouseEvent | PointerEvent} event
   * @returns {import('../scene/start/StartCard').StartCard | null}
   */
  getHandAtEvent(event) {
    if (!this.startCards.visible) return null;

    this._updateMouse(event);
    this._raycaster.setFromCamera(this._mouse, this.camera);

    // Collect all card meshes from all hands
    const meshes = this.startCards.hands.flatMap((h) => h.getMeshes());

    const intersects = this._raycaster.intersectObjects(meshes, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0].object;
    return this.startCards.getHandByMesh(hit) ?? null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Convert a DOM mouse event to normalised device coordinates (-1..+1).
   * @param {MouseEvent} event
   */
  _updateMouse(event) {
    const rect = this.canvas.getBoundingClientRect();
    this._mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
  }
}
