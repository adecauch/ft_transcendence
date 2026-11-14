/**
 * CameraController.js — OrbitControls setup and constraints
 *
 * Wraps Three.js OrbitControls with:
 *  - Constrained polar angle (no going under the table)
 *  - Limited zoom range
 *  - Smooth damping
 *  - Helpers for animated camera moves (used by CameraMoves.js)
 *
 * Three modes (setMode):
 *  - 'overview' — the menus: orbit, zoom and pan within wide limits
 *  - 'seat'     — in game, at the player's seat: drag to look around a little
 *                 (±SEAT_AZIMUTH sideways, ±SEAT_POLAR up/down), no zoom, no pan
 *  - 'fixed'    — no input, no limits (close-ups, the dealer's show)
 * A tween lifts every limit while it runs; the mode's limits are then set
 * around wherever the camera arrived.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Constraint constants ──────────────────────────────────────────────────────
const POLAR_MIN    = THREE.MathUtils.degToRad(15);  // can't look from below 15°
const POLAR_MAX    = THREE.MathUtils.degToRad(75);  // can't look straight down
const AZIMUTH_RANGE = THREE.MathUtils.degToRad(80); // horizontal arc, each side of the current seat
const ZOOM_MIN     = 4;   // closest (perspective: near distance to target)
const ZOOM_MAX     = 16;  // farthest
const DAMPING      = 0.07;
const SEAT_AZIMUTH = THREE.MathUtils.degToRad(30);  // 60° of look-around at the seat
const SEAT_POLAR   = THREE.MathUtils.degToRad(10);

export class CameraController {
  /**
   * @param {THREE.Camera}     camera
   * @param {THREE.WebGLRenderer} renderer
   */
  constructor(camera, renderer) {
    this.camera   = camera;
    this.renderer = renderer;

    /** @type {OrbitControls} */
    this.controls = null;

    // RAF-based tween state
    this._rafId = null;

    /** @type {'overview' | 'seat' | 'fixed'} */
    this.mode = 'overview';
    this._paused = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Initialise OrbitControls with casino constraints. */
  setup() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);

    controls.target.set(0, 2.6, 0.8);

    // Damping (inertia)
    controls.enableDamping   = true;
    controls.dampingFactor   = DAMPING;

    // Zoom
    controls.minDistance     = ZOOM_MIN;
    controls.maxDistance     = ZOOM_MAX;

    // Vertical limits (no going under the table)
    controls.minPolarAngle   = POLAR_MIN;
    controls.maxPolarAngle   = POLAR_MAX;

    // Horizontal limits (constrained arc around the current viewpoint)
    this.controls = controls;
    this._centerAzimuthLimits(controls.getAzimuthalAngle());

    controls.panSpeed  = 0.5;

    // Rotate speed
    controls.rotateSpeed = 0.6;

    controls.update();
  }

  /** Must be called every frame inside the render loop. */
  update() {
    if (!this.controls) return;

    this.controls.update();
  }

  /**
   * Switch mode (see the header). Applied now, or when the running tween ends.
   * @param {'overview' | 'seat' | 'fixed'} mode
   */
  setMode(mode) {
    this.mode = mode;
    if (this._rafId === null) this._applyMode();
  }

  /** Pause menu open: no dragging the camera behind it. */
  setPaused(paused) {
    this._paused = paused;
    if (this._rafId === null) this._applyMode();
  }

  /**
   * Smooth fixed-duration camera tween using a smoothstep easing.
   * Cancels any previous tween. OrbitControls are disabled for the duration.
   *
   * @param {THREE.Vector3} targetPos
   * @param {THREE.Vector3} targetLookAt
   * @param {number}        [duration=800]   ms
   * @param {Function}      [onComplete]     called when tween finishes
   */
  tweenTo(targetPos, targetLookAt, duration = 800, onComplete) {
    // Cancel any running RAF tween
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.controls.enabled = false;

    // Lift every limit during the move (OrbitControls clamps on each update):
    // the camera can reach any seat, or look straight down on the cards.
    this._liftLimits();

    const startPos    = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const endPos      = targetPos.clone();
    const endTarget   = targetLookAt.clone();
    const startTime   = performance.now();

    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      // Smoothstep: ease-in-out
      const s = t * t * (3 - 2 * t);

      this.camera.position.lerpVectors(startPos, endPos, s);
      this.controls.target.lerpVectors(startTarget, endTarget, s);
      this.controls.update();

      if (t < 1) {
        this._rafId = requestAnimationFrame(tick);
      } else {
        this._rafId = null;
        this._applyMode();
        if (onComplete) onComplete();
      }
    };

    this._rafId = requestAnimationFrame(tick);
  }

  /** Re-enable OrbitControls and stop any in-progress animation. */
  resumeOrbit() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.mode = 'overview';
    this._applyMode();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _liftLimits() {
    const c = this.controls;
    c.minAzimuthAngle = -Infinity;
    c.maxAzimuthAngle =  Infinity;
    c.minPolarAngle = 0;
    c.maxPolarAngle = Math.PI;
    c.minDistance = 0;
    c.maxDistance = Infinity;
  }

  /** Limits and inputs of the current mode, around where the camera is now. */
  _applyMode() {
    const c = this.controls;
    if (this.mode === 'fixed') {
      this._liftLimits();
      c.enabled = false;
      return;
    }
    if (this.mode === 'seat') {
      const polar = c.getPolarAngle();
      this._centerAzimuthLimits(c.getAzimuthalAngle(), SEAT_AZIMUTH);
      c.minPolarAngle = Math.max(POLAR_MIN, polar - SEAT_POLAR);
      c.maxPolarAngle = Math.min(POLAR_MAX, polar + SEAT_POLAR);
      c.minDistance = 0;
      c.maxDistance = Infinity;
      c.enableZoom = false;
      c.enablePan  = false;
    } else {
      this._centerAzimuthLimits(c.getAzimuthalAngle());
      c.minPolarAngle = POLAR_MIN;
      c.maxPolarAngle = POLAR_MAX;
      c.minDistance = ZOOM_MIN;
      c.maxDistance = ZOOM_MAX;
      c.enableZoom = true;
      c.enablePan  = true;
    }
    c.enabled = !this._paused;
  }

  /** Allow `range` each side of `azimuth` (OrbitControls handles wrap-around). */
  _centerAzimuthLimits(azimuth, range = AZIMUTH_RANGE) {
    const wrap = (a) => THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI;
    this.controls.minAzimuthAngle = wrap(azimuth - range);
    this.controls.maxAzimuthAngle = wrap(azimuth + range);
  }
}
