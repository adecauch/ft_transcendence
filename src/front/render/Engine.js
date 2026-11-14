/**
 * Engine.js — Three.js core setup
 *
 * Responsibilities:
 *  - Create the WebGLRenderer and attach it to the canvas
 *  - Create the PerspectiveCamera
 *  - Create the Scene with fog for atmosphere
 *  - Handle window resize
 *  - Run the animation loop via requestAnimationFrame
 */

import * as THREE from 'three';

export class Engine {
  /**
   * @param {string} canvasSelector — CSS selector for the <canvas> element
   */
  constructor(canvasSelector) {
    this.canvas = document.querySelector(canvasSelector);

    // ── Scene ──────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();
    // Dark casino atmosphere — exponential fog to soften the edges
    this.scene.background = new THREE.Color(0x0d0d0d);
    this.scene.fog = new THREE.FogExp2(0x0d0d0d, 0.035);

    // ── Camera ─────────────────────────────────────────────────────────────
    const { innerWidth: w, innerHeight: h } = window;
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    // Default position: slightly above and back, looking at the table center
    // Overview from the player's side, facing the dealer (see CameraMoves DEFAULT_*)
    this.camera.position.set(0, 9.5, -10);
    this.camera.lookAt(0, 2.6, 0.8);

    // ── Renderer ───────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Physically-correct tone mapping for warm casino lighting
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // ── Clock for delta time ───────────────────────────────────────────────
    this.clock = new THREE.Clock();

    // Optional callback invoked each frame before render
    this._updateCallback = null;

    // ── Resize handling ────────────────────────────────────────────────────
    window.addEventListener('resize', this._onResize.bind(this));
  }

  /**
   * Register a per-frame update function.
   * Called with delta time (seconds) every frame.
   * @param {(delta: number) => void} fn
   */
  setUpdateCallback(fn) {
    this._updateCallback = fn;
  }

  /** Start the render loop */
  start() {
    this.renderer.setAnimationLoop(() => {
      const delta = this.clock.getDelta();
      if (this._updateCallback) this._updateCallback(delta);
      this.renderer.render(this.scene, this.camera);
    });
  }

  /** Stop the render loop */
  stop() {
    this.renderer.setAnimationLoop(null);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
}
