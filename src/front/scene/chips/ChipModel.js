/**
 * ChipModel.js — 3D casino chips, one look per denomination
 *
 * A chip is a short cylinder with canvas-drawn textures:
 *   face — base colour, six edge inserts, a thin ring, and a cream inlay with
 *          the value
 *   side — base colour with the same six inserts running across the edge
 * Geometry is shared by every chip; materials are shared per denomination.
 * Real size: 39 mm × 3.3 mm, at the same scale as the cards (63 mm = 0.3).
 */

import * as THREE from 'three';
import { DENOMINATIONS, denomination } from './chipStacks.js';

const MM = 0.3 / 63;

export const CHIP_SIZE = {
  radius: 19.5 * MM,
  height: 3.3 * MM,
};

const INSERTS     = 6;
const INSERT_DEG  = 18;  // angular width of an edge insert
const FACE_PX     = 256;

function drawFace(d) {
  const c = document.createElement('canvas');
  c.width = c.height = FACE_PX;
  const g = c.getContext('2d');
  const R = FACE_PX / 2;
  g.translate(R, R);

  // Base
  g.fillStyle = d.base;
  g.fillRect(-R, -R, FACE_PX, FACE_PX);

  // Edge inserts (outer ring)
  g.fillStyle = d.insert;
  const half = THREE.MathUtils.degToRad(INSERT_DEG / 2);
  for (let i = 0; i < INSERTS; i++) {
    const a = (i / INSERTS) * Math.PI * 2;
    g.beginPath();
    g.arc(0, 0, R, a - half, a + half);
    g.arc(0, 0, R * 0.78, a + half, a - half, true);
    g.closePath();
    g.fill();
  }

  // Thin ring between the rim and the inlay
  g.strokeStyle = d.insert;
  g.globalAlpha = 0.85;
  g.lineWidth = R * 0.025;
  g.setLineDash([R * 0.06, R * 0.045]);
  g.beginPath();
  g.arc(0, 0, R * 0.7, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;

  // Inlay
  g.fillStyle = d.inlay;
  g.beginPath();
  g.arc(0, 0, R * 0.6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = d.base;
  g.lineWidth = R * 0.03;
  g.beginPath();
  g.arc(0, 0, R * 0.54, 0, Math.PI * 2);
  g.stroke();

  // Value
  const label = String(d.value);
  g.fillStyle = d.text;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = label.length >= 4 ? R * 0.36 : label.length === 3 ? R * 0.44 : R * 0.56;
  g.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
  g.fillText(label, 0, R * 0.03);

  return c;
}

function drawSide(d) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = d.base;
  g.fillRect(0, 0, c.width, c.height);

  // Inserts: same angles as on the face
  g.fillStyle = d.insert;
  const w = (INSERT_DEG / 360) * c.width;
  for (let i = 0; i < INSERTS; i++) {
    const x = (i / INSERTS) * c.width - w / 2;
    g.fillRect(x, 0, w, c.height);
    if (x < 0) g.fillRect(x + c.width, 0, w, c.height); // wrap-around
  }

  // Slightly darker rims top and bottom
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, 0, c.width, 2);
  g.fillRect(0, c.height - 2, c.width, 2);
  return c;
}

export class ChipModel {
  /** @param {THREE.WebGLRenderer} [renderer] — for texture anisotropy */
  constructor(renderer) {
    this._anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 1;
    this._geometry = new THREE.CylinderGeometry(
      CHIP_SIZE.radius, CHIP_SIZE.radius, CHIP_SIZE.height, 40, 1,
    );
    /** @type {Map<number, THREE.Material[]>} */
    this._materials = new Map();
  }

  /**
   * @param {number} value — one of DENOMINATIONS
   * @returns {THREE.Mesh}
   */
  create(value) {
    const mesh = new THREE.Mesh(this._geometry, this._materialsFor(value));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.chipValue = value;
    return mesh;
  }

  /** Build every material up front so the first bet doesn't stutter. */
  warmUp() {
    DENOMINATIONS.forEach((d) => this._materialsFor(d.value));
  }

  _materialsFor(value) {
    let mats = this._materials.get(value);
    if (mats) return mats;

    const d = denomination(value);
    const tex = (canvas) => {
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = this._anisotropy;
      return t;
    };
    const sideTex = tex(drawSide(d));
    sideTex.wrapS = THREE.RepeatWrapping;

    // Clay chips: matte with a soft sheen
    const finish = { roughness: 0.55, metalness: 0.0 };
    const side = new THREE.MeshStandardMaterial({ ...finish, map: sideTex });
    const face = new THREE.MeshStandardMaterial({ ...finish, map: tex(drawFace(d)) });

    // CylinderGeometry groups: 0 = side, 1 = top, 2 = bottom
    mats = [side, face, face];
    this._materials.set(value, mats);
    return mats;
  }
}
