/**
 * Table.js — Poker table construction
 *
 * If a real GLB model exists at /models/table.glb it is loaded and placed.
 * Otherwise a procedural fallback is used (an elliptical felt surface with a
 * rounded wooden rail), so the scene always has something to look at.
 *
 * The table sits at y = 0; the felt surface is at y ≈ 0.
 */

import * as THREE from 'three';

// Table dimensions (procedural fallback)
const TABLE = {
  radiusX: 4.5,   // half-width of the oval
  radiusZ: 2.8,   // half-depth
  railHeight: 0.15,
  feltColor: 0x1a5c2a,   // classic casino green
  railColor: 0x3b1e0a,   // dark walnut
  legColor:  0x2a1205,
};

export class Table {
  /**
   * @param {THREE.Scene}   scene
   * @param {import('../../render/AssetLoader').AssetLoader} loader
   */
  constructor(scene, loader) {
    this.scene  = scene;
    this.loader = loader;
    this.group  = new THREE.Group();
    this.group.name = 'poker-table';

    /** Y coordinate of the felt surface — set by build(), read by StartCards */
    this.feltY = 0.06;
  }

  /** Load or build the table, then add it to the scene. */
  async build() {
    // Try the real model first
    const gltf = this.loader.getModel('table');
    if (gltf) {
      this._useGLTF(gltf);
    } else {
      this._buildProcedural();
    }

    this.group.position.y = -0.4;
    this.feltY -= 0.4;
    this.scene.add(this.group);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _useGLTF(gltf) {
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
      }
    });

    // Scale so the widest horizontal span matches TABLE.radiusX * 2 (9 units)
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const targetWidth = TABLE.radiusX * 2;
    const scale = targetWidth / Math.max(size.x, size.z);
    model.scale.setScalar(scale);

    // Re-center XZ at origin; lift so the model's bottom rests at Y = 0
    const box2 = new THREE.Box3().setFromObject(model);
    const center = box2.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;

    // Felt surface is near the top of the table body
    const tableHeight = box2.max.y - box2.min.y;
    this.feltY = tableHeight * 0.92 + 0.08;

    console.log(
      `[Table] GLTF loaded — scale ×${scale.toFixed(3)}, ` +
      `tableH: ${tableHeight.toFixed(3)}, feltY: ${this.feltY.toFixed(3)}`
    );

    this.group.add(model);
  }

  _buildProcedural() {
    this.feltY = 0.06; // top of the 0.06-tall felt cylinder centred at Y=0

    // ── Felt surface (ellipse approximated by scaled circle) ──
    const feltGeo = new THREE.CylinderGeometry(1, 1, 0.06, 64);
    feltGeo.scale(TABLE.radiusX, 1, TABLE.radiusZ);

    const feltMat = new THREE.MeshStandardMaterial({
      color: TABLE.feltColor,
      roughness: 0.9,
      metalness: 0.0,
    });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.receiveShadow = true;
    felt.position.y = 0;
    felt.name = 'felt';
    this.group.add(felt);

    // ── Outer rail (torus-like ring, scaled to oval) ──
    const railGeo = new THREE.TorusGeometry(1, 0.22, 16, 80);
    railGeo.scale(TABLE.radiusX, TABLE.radiusZ, 1);
    // Rotate so the torus lies flat
    railGeo.rotateX(Math.PI / 2);

    const railMat = new THREE.MeshStandardMaterial({
      color: TABLE.railColor,
      roughness: 0.6,
      metalness: 0.1,
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.castShadow    = true;
    rail.receiveShadow = true;
    rail.position.y = 0.05;
    this.group.add(rail);

    // ── Four legs ──
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 3, 12);
    const legMat = new THREE.MeshStandardMaterial({
      color: TABLE.legColor,
      roughness: 0.7,
    });

    const legPositions = [
      [-TABLE.radiusX * 0.65, -1.5,  TABLE.radiusZ * 0.7],
      [ TABLE.radiusX * 0.65, -1.5,  TABLE.radiusZ * 0.7],
      [-TABLE.radiusX * 0.65, -1.5, -TABLE.radiusZ * 0.7],
      [ TABLE.radiusX * 0.65, -1.5, -TABLE.radiusZ * 0.7],
    ];

    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      this.group.add(leg);
    });
  }
}
