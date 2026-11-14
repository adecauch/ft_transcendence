/**
 * Lamps.js — Pendant lamp models with spotlights and dust particle effects
 */

import * as THREE from 'three';

const LAMP_POSITIONS = [
  { x: -2.0, y: 5.5, z:  0.0 },
  { x:  2.0, y: 5.5, z:  0.0 },
  { x:  0.0, y: 5.5, z: -2.0 },
  { x:  5.0, y: 5.5, z: -6.0 },
  { x: -5.0, y: 5.5, z: -5.0 },
  { x:  5.0, y: 5.5, z: -5.0 },
];

const TARGET_HEIGHT      = 2.0;
const PARTICLES_PER_LAMP = 80;
const DUST_CONE_RADIUS   = 0.5;

export class Lamps {
  constructor(scene, loader) {
    this._scene       = scene;
    this._loader      = loader;
    this._spotLights  = [];
    this._dustSystems = [];
  }

  async build() {
    const gltf   = await this._loader.loadModel('lamp', '/models/lamp/lamp.glb');
    const useGLB = !!gltf;

    let scale = 1;

    if (useGLB) {
      const box  = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      scale = TARGET_HEIGHT / size.y;
      console.log(`[Lamps] GLB loaded — scale: ${scale.toFixed(4)}`);
    } else {
      console.warn('[Lamps] GLB failed, using fallback cylinder.');
    }

    LAMP_POSITIONS.forEach((pos, i) => {
      if (useGLB) {
        const model = gltf.scene.clone(true);
        model.scale.setScalar(scale);

        // ✅ Position directe sans calcul lampY
        model.position.set(pos.x, pos.y, pos.z);

        let meshCount = 0;
        model.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
            child.visible  = true;
            child.material = new THREE.MeshStandardMaterial({
              color:     0x8a6a3a,
              roughness: 0.3,
              metalness: 0.9,
            });
            child.castShadow    = true;
            child.receiveShadow = false;
          }
        });

        console.log(`[Lamps] Lamp ${i + 1} — ${meshCount} meshes found in clone`);
        this._scene.add(model);

      } else {
        const geo  = new THREE.CylinderGeometry(0.15, 0.35, TARGET_HEIGHT, 16);
        const mat  = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.9, roughness: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        this._scene.add(mesh);
      }

      // ── Light ─────────────────────────────────────────────────────────────
      const spot = new THREE.SpotLight(0xffd97a, 2.5);
      spot.angle    = Math.PI / 5;
      spot.penumbra = 0.5;
      spot.decay    = 2.0;
      spot.distance = 10.0;
      spot.castShadow = true;
      spot.shadow.mapSize.width  = 1024;
      spot.shadow.mapSize.height = 1024;
      spot.position.set(pos.x, pos.y, pos.z);
      spot.target.position.set(pos.x, 0, pos.z);
      this._scene.add(spot);
      this._scene.add(spot.target);
      this._spotLights.push(spot);

      console.log(`[Lamps] Lamp ${i + 1} placed at y=${pos.y}`);

      // ── Dust ──────────────────────────────────────────────────────────────
      this._dustSystems.push(this._buildDust(pos));
    });
  }

  update(delta) {
    const t = performance.now() * 0.001;
    this._dustSystems.forEach((sys) => {
      const positions = sys.points.geometry.attributes.position.array;
      for (let i = 0; i < PARTICLES_PER_LAMP; i++) {
        const idx = i * 3;
        positions[idx + 1] += Math.sin(t * sys.speeds[i] + sys.phases[i]) * 0.002;
        if (positions[idx + 1] > sys.yMax) positions[idx + 1] = sys.yMin;
        if (positions[idx + 1] < sys.yMin) positions[idx + 1] = sys.yMax;
      }
      sys.points.geometry.attributes.position.needsUpdate = true;
    });
  }

  _buildDust(lampPos) {
    const yMax = lampPos.y - 0.2;
    const yMin = lampPos.y - 3.0;

    const geometry = new THREE.BufferGeometry();
    const posArray  = new Float32Array(PARTICLES_PER_LAMP * 3);
    const phases    = new Float32Array(PARTICLES_PER_LAMP);
    const speeds    = new Float32Array(PARTICLES_PER_LAMP);

    for (let i = 0; i < PARTICLES_PER_LAMP; i++) {
      const idx = i * 3;
      const t = Math.random();
      const y = yMax - t * (yMax - yMin);
      const coneRadius = DUST_CONE_RADIUS * t;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * coneRadius;

      posArray[idx]     = lampPos.x + Math.cos(angle) * r;
      posArray[idx + 1] = y;
      posArray[idx + 2] = lampPos.z + Math.sin(angle) * r;

      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.3 + Math.random() * 0.7;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const material = new THREE.PointsMaterial({
      color:       0xffe8a0,
      size:        0.03,
      transparent: true,
      opacity:     0.4,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    this._scene.add(points);

    return { points, phases, speeds, yMin, yMax };
  }
}