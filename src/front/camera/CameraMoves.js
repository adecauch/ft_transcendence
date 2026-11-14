/**
 * CameraMoves.js — Smooth camera transitions
 *
 * Provides the transitions:
 *  - zoomToSeat(i)      — to a seat's viewpoint (the menu's start cards)
 *  - focus(view)        — to any viewpoint (the dealer's show)
 *  - backToSeat(i)      — back to the seat, look-around mode
 *  - closeUp(area)      — straight above some cards, very close
 *  - zoomToDefault()    — restore the default overview position
 *
 * Delegates the actual move to CameraController.tweenTo().
 */

import * as THREE from 'three';

// Default camera overview position
// Default overview: from the player's side of the table, facing the dealer
const DEFAULT_POSITION = new THREE.Vector3(0, 9.5, -10); // high enough that the lamp above the seat clears his face
const DEFAULT_LOOKAT   = new THREE.Vector3(0, 2.6, 0.8);

// Seat viewpoints (index 0 = the player's seat; every start object of StartCards.js zooms there)
// Each entry: { position, lookAt, waypoint? } — as if the player is sitting at that seat
const SEAT_POSITIONS = [
  { // 0 — the player's seat, facing the dealer
    // Pulled back enough to see the opponents on their chairs; the cards
    // still show above the action bar
    position: new THREE.Vector3(0, 6.2, -6.4),
    lookAt:   new THREE.Vector3(0, 2.3, 0.4),
  },
];

const TWEEN_DURATION = 800; // ms
const CLOSE_UP_MARGIN = 1.25;  // free space around the cards in a close-up
const CLOSE_UP_SHIFT  = 0.12;  // cards drawn a bit above the centre, clear of the action bar
const CLOSE_UP_MIN    = { width: 1.2, depth: 0.8 }; // two cards look as big as the board, not bigger

export class CameraMoves {
  /** @param {import('./CameraController').CameraController} controller */
  constructor(controller) {
    this.controller = controller;
  }

  /**
   * Animate the camera to the seat viewpoint for the given hand index.
   * @param {number} handIndex
   */
  zoomToSeat(handIndex) {
    const seat = SEAT_POSITIONS[handIndex];
    if (!seat) return;
    this.controller.setMode('fixed');

    if (seat.waypoint) {
      const halfDuration = TWEEN_DURATION / 2;

      this.controller.tweenTo(seat.waypoint.position, seat.waypoint.lookAt, halfDuration, () => {
        this.controller.tweenTo(seat.position, seat.lookAt, halfDuration);
      });
    } else {
      this.controller.tweenTo(seat.position, seat.lookAt, TWEEN_DURATION);
    }
  }

  /**
   * Move to a viewpoint (e.g. facing the dealer).
   * @param {{ position: THREE.Vector3, target: THREE.Vector3 }} view
   * @param {number} [duration] ms
   * @returns {Promise<void>}
   */
  focus({ position, target }, duration = 500) {
    this.controller.setMode('fixed');
    return new Promise((resolve) => {
      this.controller.tweenTo(position, target, duration, resolve);
    });
  }

  /**
   * Look straight down on an area of the felt, as close as fits it, the
   * player's side at the bottom of the screen (cards read the right way up).
   * @param {{ centre: THREE.Vector3, width: number, depth: number }} area
   *   width along x, depth along z
   * @returns {Promise<void>}
   */
  closeUp({ centre, width, depth }, duration = 600) {
    const camera = this.controller.camera;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const tanH = tanV * camera.aspect;
    const height = CLOSE_UP_MARGIN * Math.max(
      Math.max(width, CLOSE_UP_MIN.width) / 2 / tanH,
      Math.max(depth, CLOSE_UP_MIN.depth) / 2 / tanV,
    );
    // Screen down = toward the player (-z): look a little below the cards
    const look = centre.clone();
    look.z -= CLOSE_UP_SHIFT * 2 * height * tanV;
    // A hair toward the player, so "up" on screen is well defined (+z)
    const position = look.clone().add(new THREE.Vector3(0, height, -height * 0.01));
    return this.focus({ position, target: look }, duration);
  }

  /**
   * Straight back to a seat's viewpoint (no waypoint), then look-around mode.
   * @returns {Promise<void>}
   */
  backToSeat(handIndex, duration = 550) {
    const seat = SEAT_POSITIONS[handIndex];
    this.controller.setMode('seat');
    return new Promise((resolve) => {
      this.controller.tweenTo(seat.position, seat.lookAt, duration, resolve);
    });
  }

  /**
   * Restore the default overview camera position.
   * Re-enables OrbitControls once the animation completes.
   */
  zoomToDefault() {
    this.controller.tweenTo(
      DEFAULT_POSITION,
      DEFAULT_LOOKAT,
      TWEEN_DURATION,
      () => this.controller.resumeOrbit()
    );
  }
}
