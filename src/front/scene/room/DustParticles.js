/**
 * DustParticles.js — Ambient dust / sparkle particle system
 *
 * Creates a field of slowly drifting golden dust particles above the table
 * to enhance the casino atmosphere. Uses a single Points object with a custom
 * Float32Array buffer for performance.
 */

import * as THREE from 'three';

const PARTICLE_COUNT = 300;
const SPREAD = { x: 6, y: 3, z: 5 };  // volume above the table
const BASE_Y = 0.5;                     // minimum height
const DRIFT_SPEED = 0.08;              // upward drift speed
const TWINKLE_SPEED = 1.5;

export class DustParticles {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this._points = null;
    this._velocities = [];
    this._phases = [];    // per-particle phase offset for twinkle
    this._time = 0;
  }

  /** Build and add the particle system to the scene. */
  init() {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes     = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * SPREAD.x * 2;
      positions[i * 3 + 1] = BASE_Y + Math.random() * SPREAD.y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD.z * 2;

      sizes[i] = Math.random() * 4 + 1; // pixels

      this._velocities.push({
        x: (Math.random() - 0.5) * 0.01,
        y: DRIFT_SPEED * (0.5 + Math.random()),
        z: (Math.random() - 0.5) * 0.01,
      });

      this._phases.push(Math.random() * Math.PI * 2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color:       0xffd080,
      size:        0.04,
      sizeAttenuation: true,
      transparent: true,
      opacity:     0.55,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });

    this._points = new THREE.Points(geo, mat);
    this._points.name = 'ambient-particles';
    this.scene.add(this._points);
  }

  /**
   * Per-frame update — drift particles upward and wrap them.
   * @param {number} delta
   */
  update(delta) {
    if (!this._points) return;
    this._time += delta;

    const pos = this._points.geometry.attributes.position;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const vel = this._velocities[i];

      pos.array[i * 3]     += vel.x;
      pos.array[i * 3 + 1] += vel.y * delta;
      pos.array[i * 3 + 2] += vel.z;

      // Wrap back to bottom when particle drifts too high
      if (pos.array[i * 3 + 1] > BASE_Y + SPREAD.y) {
        pos.array[i * 3 + 1] = BASE_Y;
      }
    }

    pos.needsUpdate = true;

    // Twinkle the opacity
    const twinkle = 0.4 + 0.2 * Math.sin(this._time * TWINKLE_SPEED);
    this._points.material.opacity = twinkle;
  }
}
