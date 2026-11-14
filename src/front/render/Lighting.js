import * as THREE from 'three';

export class Lighting {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.lights = [];
  }

  setup() {
    this._addAmbient();
    this._addHemisphere();
  }

  _addAmbient() {
    // Fill doux pour éviter les ombres totalement noires
    const ambient = new THREE.AmbientLight(0xffe0c0, 1.2);
    this.scene.add(ambient);
    this.lights.push(ambient);
  }

  _addHemisphere() {
    // Gradient chaud du ciel / sol sombre
    const hemi = new THREE.HemisphereLight(0x8b6914, 0x0a0a0a, 0.6);
    this.scene.add(hemi);
    this.lights.push(hemi);
  }
}