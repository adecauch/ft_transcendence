/**
 * revolver.js — The dealer's revolvers (Quaternius' Ultimate Guns Pack, CC0)
 *
 * loadRevolver() reads the OBJ once and repaints it (walnut grip, steel);
 * mountGun() puts a copy in a fist, barrel along the arm; makeMuzzleFlash()
 * is the flash at the barrel tip, shown for a few hundredths of a second on
 * each shot (Dealer.celebrate()).
 */

import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

const GUN_DIR   = '/models/dealer/';
const GUN_NAME  = 'Revolver_2';
const GUN_SCALE = 0.6;                   // OBJ units → world units (≈ 1.1 long, cartoon-sized)
const MUZZLE    = { x: -0.52, y: 1.85 }; // barrel tip, in the turned gun's space

/** @returns {Promise<THREE.Object3D|null>} null when the files are missing */
export async function loadRevolver() {
  try {
    const materials = await new MTLLoader().setPath(GUN_DIR).loadAsync(`${GUN_NAME}.mtl`);
    materials.preload();
    const obj = await new OBJLoader().setMaterials(materials).setPath(GUN_DIR).loadAsync(`${GUN_NAME}.obj`);
    obj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        // Swap the OBJ's near-black Phong materials for PBR ones that read
        // against the dark saloon: walnut grip, polished steel
        const pbr = (m) => (m.name.includes('Wood')
          ? new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.6 })
          : new THREE.MeshStandardMaterial({
            color: m.name === 'LightMetal' ? 0xc9ccd2 : 0x9a9ea6,
            metalness: 0.9,
            roughness: 0.3,
          }));
        o.material = Array.isArray(o.material) ? o.material.map(pbr) : pbr(o.material);
      }
    });
    return obj;
  } catch (err) {
    console.warn('[Dealer] Revolver failed to load:', err);
    return null;
  }
}

/** Put a revolver in a fist, barrel along the arm (the bone's +Y). */
export function mountGun(gun, fist, side) {
  // Revolver_2.obj: barrel along +X (tip at x ≈ 1.8, y ≈ 0.52), grip down -Y
  // around the origin. Turn it so the barrel follows the arm.
  gun.rotation.z = Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(gun);
  // Undo the character's scale so the gun keeps its own size
  const worldScale = fist.getWorldScale(new THREE.Vector3()).x;
  holder.scale.setScalar(GUN_SCALE / worldScale);
  if (side === 'L') holder.rotation.y = Math.PI;
  holder.visible = false;
  fist.add(holder);
  return holder;
}

/** Muzzle flash: an open cone and a star, additive, hidden until a shot. */
export function makeMuzzleFlash() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffd27a,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flash = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 8, 1, true), mat);
  cone.position.y = 0.3;
  const star = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat);
  star.rotation.x = -Math.PI / 2;
  flash.add(cone, star);
  flash.position.set(MUZZLE.x, MUZZLE.y, 0);
  flash.scale.setScalar(1 / GUN_SCALE); // sizes above are in world units
  flash.visible = false;
  flash.userData.life = 0;
  return flash;
}
