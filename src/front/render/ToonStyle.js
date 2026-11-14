/**
 * ToonStyle.js — Cartoon look for the whole 3D scene
 *
 * Two effects, applied to every mesh the first time it is rendered, so chips
 * and cards created during a game get them too (update() runs each frame):
 *
 *  1. Toon shading: PBR / Phong / Lambert materials are swapped for a
 *     MeshToonMaterial with the same colour and textures, lit through a
 *     3-tone ramp (shadow / mid / light). The swap is cached per material so
 *     shared materials stay shared, and it replaces `mesh.material` itself:
 *     code that later changes `mesh.material.map` (Card.setCode) edits the
 *     toon one.
 *
 *  2. Outlines, "inverted hull": a second copy of the mesh, pushed outwards
 *     along smoothed normals, drawn in black with back faces only. Only the
 *     part sticking out around the silhouette shows. The push grows with the
 *     distance to the camera, so the line keeps about OUTLINE_PX pixels on
 *     screen whatever the object's size. Skinned meshes (the cowboy) get a
 *     skinned hull bound to the same skeleton.
 *
 * Opt out of the outline with `mesh.userData.noOutline = true` (flat or
 * paper-thin things: floor, walls, cards). Add `?realiste` to the URL to
 * see the old look.
 */

import * as THREE from 'three';

export const OUTLINE_COLOR = 0x1a0d06;
export const OUTLINE_PX    = 2.2;

/** Half-lambert split in three flat tones (linear values). */
const RAMP = [95, 185, 255];

export class ToonStyle {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {THREE.WebGLRenderer} renderer
   */
  constructor(camera, renderer) {
    this.camera   = camera;
    this.renderer = renderer;
    this.enabled  = !new URLSearchParams(location.search).has('realiste');

    this._ramp = makeRamp();
    /** @type {WeakMap<THREE.Material, THREE.Material>} */
    this._toonOf = new WeakMap();

    // Shared by every hull: line width in pixels, and world units per pixel
    // at depth 1 (from the camera's field of view and the canvas height)
    this._uniforms = {
      outlinePx:  { value: OUTLINE_PX },
      worldPerPx: { value: 0.001 },
    };
    this._outlineMat = this._makeOutlineMaterial();
  }

  /** Call once per frame, before rendering. */
  update(scene) {
    if (!this.enabled) return;

    const h = this.renderer.domElement.clientHeight || window.innerHeight;
    this._uniforms.worldPerPx.value = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) / h;

    scene.traverse((o) => {
      if (!o.isMesh || o.userData.toonDone || o.userData.isOutline) return;
      o.userData.toonDone = true;

      o.material = Array.isArray(o.material)
        ? o.material.map((m) => this._toToon(m))
        : this._toToon(o.material);

      if (this._wantsOutline(o)) this._addOutline(o);
    });
  }

  // ── Materials ───────────────────────────────────────────────────────────────

  _toToon(m) {
    if (!m || !(m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshLambertMaterial)) return m;
    let toon = this._toonOf.get(m);
    if (toon) return toon;

    toon = new THREE.MeshToonMaterial({
      name: m.name,
      color: m.color,
      map: m.map,
      gradientMap: this._ramp,
      emissive: m.emissive,
      emissiveMap: m.emissiveMap,
      emissiveIntensity: m.emissiveIntensity,
      aoMap: m.aoMap,
      aoMapIntensity: m.aoMapIntensity,
      lightMap: m.lightMap,
      lightMapIntensity: m.lightMapIntensity,
      alphaMap: m.alphaMap,
      // Kept so displaced surfaces (floor, walls) keep their shape
      displacementMap: m.displacementMap,
      displacementScale: m.displacementScale,
      displacementBias: m.displacementBias,
      transparent: m.transparent,
      opacity: m.opacity,
      alphaTest: m.alphaTest,
      side: m.side,
      vertexColors: m.vertexColors,
      visible: m.visible,
      depthWrite: m.depthWrite,
      depthTest: m.depthTest,
      fog: m.fog,
    });
    this._toonOf.set(m, toon);
    return toon;
  }

  // ── Outlines ────────────────────────────────────────────────────────────────

  _wantsOutline(mesh) {
    if (mesh.userData.noOutline) return false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // Only solid, lit, visible surfaces: skips hitboxes, flashes, glass
    return mats.some((m) => m && m.visible && !m.transparent && m.isMeshToonMaterial);
  }

  _addOutline(mesh) {
    addSmoothNormals(mesh.geometry);

    let hull;
    if (mesh.isSkinnedMesh) {
      hull = new THREE.SkinnedMesh(mesh.geometry, this._outlineMat);
      hull.bindMode = mesh.bindMode;
      hull.bind(mesh.skeleton, mesh.bindMatrix);
    } else {
      hull = new THREE.Mesh(mesh.geometry, this._outlineMat);
    }
    hull.userData.isOutline = true;
    hull.castShadow    = false;
    hull.receiveShadow = false;
    hull.frustumCulled = mesh.frustumCulled;
    hull.raycast = () => {}; // never picked by the mouse
    mesh.add(hull);
  }

  _makeOutlineMaterial() {
    const mat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.outlinePx  = this._uniforms.outlinePx;
      shader.uniforms.worldPerPx = this._uniforms.worldPerPx;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec3 outlineNormal;
          uniform float outlinePx;
          uniform float worldPerPx;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            // Push along the smoothed normal, by a constant number of pixels:
            // world size of a pixel grows with the depth; divide by the
            // object's scale since we move in its local space
            vec3 n = normalize(outlineNormal);
            float depth = max(0.05, -(modelViewMatrix * vec4(position, 1.0)).z);
            float objScale = max(length((modelMatrix * vec4(n, 0.0)).xyz), 1e-6);
            transformed += n * (outlinePx * worldPerPx * depth / objScale);
          }`);
    };
    mat.customProgramCacheKey = () => 'toon-outline';
    return mat;
  }
}

/** 3 texels, nearest filtering: hard steps between the tones. */
function makeRamp() {
  const data = new Uint8Array(RAMP.flatMap((v) => [v, v, v, 255]));
  const tex = new THREE.DataTexture(data, RAMP.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Average the normals of vertices that share a position, so hard edges
 * (split normals) don't open gaps in the hull. Stored as `outlineNormal` on
 * the geometry itself, once.
 */
function addSmoothNormals(geometry) {
  if (geometry.attributes.outlineNormal) return;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;

  const sums = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    let s = sums.get(k);
    if (!s) sums.set(k, (s = new THREE.Vector3()));
    s.x += nor.getX(i);
    s.y += nor.getY(i);
    s.z += nor.getZ(i);
  }

  const out = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.copy(sums.get(key(i)));
    if (v.lengthSq() < 1e-12) v.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    v.normalize();
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  geometry.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
}
