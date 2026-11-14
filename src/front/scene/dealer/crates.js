/**
 * crates.js — The two stacked whisky crates the dealer sits on
 * (plain boxes with dark bands and corner posts, no model file).
 */

import * as THREE from 'three';

/** Two stacked whisky crates, the top one under his hips. */
export function makeCrates(x, z, seatY, floorY) {
  const group = new THREE.Group();
  const bottomH = (seatY - floorY) * 0.55;
  const topH    = seatY - floorY - bottomH;
  const bottom  = crate(2.0, bottomH, 1.6);
  const top     = crate(1.6, topH, 1.3);
  top.position.y = bottomH;
  top.rotation.y = 0.12; // not perfectly stacked
  group.add(bottom, top);
  group.position.set(x, floorY, z);
  return group;
}

function crate(width, height, depth) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2e1d10, roughness: 0.9 });
  const crate = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wood);
  body.position.y = height / 2;
  crate.add(body);
  // Dark bands and corner posts, so it reads as a crate
  for (const y of [0.06, height - 0.06]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.08, depth + 0.02), dark);
    band.position.y = y;
    crate.add(band);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, height, 0.1), dark);
    post.position.set(sx * (width / 2 - 0.04), height / 2, sz * (depth / 2 - 0.04));
    crate.add(post);
  }
  crate.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return crate;
}
