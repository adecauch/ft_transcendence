/**
 * Dealer.js — The cowboy dealer standing behind the table
 *
 * Model: "Cowboy_Male" from Quaternius' Ultimate Animated Character Pack,
 * revolvers from his Ultimate Guns Pack (both CC0).
 *
 * The cowboy sits on a stack of whisky crates behind the table (the end pose
 * of his SitDown animation), breathing and glancing around. release(point)
 * makes him flick a card toward a spot on the felt: the nearest arm reaches
 * out, and the promise resolves at the moment the card leaves his hand, with
 * the hand's position. celebrate() —
 * played when someone goes all-in — draws two revolvers and fires them at the
 * ceiling: the arms are aimed upward procedurally on top of the pose, each
 * shot has recoil, a muzzle flash, a flash of light and a synthesized gunshot.
 *
 * update(delta) drives everything; `paused` freezes it. The revolvers are in
 * revolver.js, the crates in crates.js, the gunshot sound in Gunshot.js.
 */

import * as THREE from 'three';
import { Gunshot } from './Gunshot.js';
import { loadRevolver, mountGun, makeMuzzleFlash } from './revolver.js';
import { makeCrates } from './crates.js';

const MODEL_KEY  = 'dealer';
const MODEL_PATH = '/models/dealer/Cowboy_Male.gltf';
const FLOOR_Y  = -0.5;
const POSITION = { x: 0, z: 2.6 };  // behind the dealer's tray
const HEIGHT   = 5.2;
// The cowboy is short (big head, small body): seated on a stack of two
// crates, his hips sit at HIPS_Y so his shoulders clear the table.
const HIPS_Y         = 2.35;
const HIPS_OVER_SEAT = 0.15;

// Shots: [time (s) after the draw, hand]
const SHOTS = [
  [0.55, 'R'], [0.8, 'L'], [1.1, 'R'], [1.3, 'L'], [1.55, 'R'], [1.75, 'L'],
];
const RAISE_TIME = 0.35; // arms going up
const HOLD_TIME  = 2.2;  // arms up, until they come back down
const LOWER_TIME = 0.5;

// Dealing: one reach out and back; the card leaves the hand at RELEASE_AT
const REACH_TIME = 0.34;
const RELEASE_AT = 0.45; // fraction of REACH_TIME

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

export class Dealer {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../render/AssetLoader').AssetLoader} loader
   */
  constructor(scene, loader) {
    this.scene  = scene;
    this.loader = loader;
    this.paused = false;

    this.model   = null;
    /**
     * Camera viewpoint for the show: slightly to the side, between the pendant lamps,
     * above the player's seat, framing the hat and the raised guns.
     */
    this.showView = {
      position: new THREE.Vector3(POSITION.x + 1.4, 4.2, -2.8),
      target:   new THREE.Vector3(POSITION.x, 4.3, POSITION.z),
    };
    this._mixer  = null;
    this._arms   = {};    // R/L → { upper, lower, fist, gun, flash }
    this._show   = null;  // celebration state
    this._light  = null;
    this._sound  = new Gunshot();
  }

  async build() {
    const gltf = await this.loader.loadModel(MODEL_KEY, MODEL_PATH);
    if (!gltf) {
      console.warn('[Dealer] Failed to load the cowboy.');
      return;
    }

    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const scale = HEIGHT / box.getSize(_v1).y;
    model.scale.setScalar(scale);
    model.position.set(POSITION.x, FLOOR_Y - box.min.y * scale, POSITION.z);
    model.rotation.y = Math.PI; // face the player
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.scene.add(model);
    this.model = model;

    // ── Seated pose: the last frame of SitDown, held ──
    this._mixer = new THREE.AnimationMixer(model);
    this._clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
    const sit = this._mixer.clipAction(this._clips.SitDown);
    sit.setLoop(THREE.LoopOnce, 1);
    sit.clampWhenFinished = true;
    sit.play();
    this._mixer.update(this._clips.SitDown.duration);

    // Lift him so his hips are at HIPS_Y, and put the crates under them
    model.updateMatrixWorld(true);
    const hips = model.getObjectByName('Hips').getWorldPosition(new THREE.Vector3());
    model.position.y += HIPS_Y - hips.y;
    this.scene.add(makeCrates(hips.x, hips.z, HIPS_Y - HIPS_OVER_SEAT, FLOOR_Y));

    // Remember the seated pose: every frame starts from it (a clamped clip
    // doesn't re-apply itself, so small additive motions would pile up)
    this._rest = [];
    model.traverse((o) => { if (o.isBone) this._rest.push([o, o.quaternion.clone()]); });

    this._torso = model.getObjectByName('Torso');
    this._head  = model.getObjectByName('Head');
    this._time  = 0;

    // ── Arms + revolvers ──
    const gun = await loadRevolver();
    for (const side of ['R', 'L']) {
      const arm = {
        // GLTFLoader strips the dots from node names: "UpperArm.R" → "UpperArmR"
        upper: model.getObjectByName(`UpperArm${side}`),
        lower: model.getObjectByName(`LowerArm${side}`),
        fist:  model.getObjectByName(`Fist${side}`),
        kick:  0,
      };
      if (gun && arm.fist) {
        arm.gun = mountGun(gun.clone(), arm.fist, side);
        arm.flash = makeMuzzleFlash();
        arm.gun.add(arm.flash);
      }
      this._arms[side] = arm;
    }

    this._light = new THREE.PointLight(0xffc27a, 0, 12, 1.6);
    this.scene.add(this._light);

    // Soft warm light on the cowboy: he stands outside the lamps' cones
    const key = new THREE.SpotLight(0xffd9a0, 18, 9, Math.PI / 6, 0.6, 1.5);
    key.position.set(POSITION.x, 6.2, POSITION.z - 2.4);
    key.target.position.set(POSITION.x, 3.6, POSITION.z);
    this.scene.add(key, key.target);

    console.log('[Dealer] Cowboy ready — animations:', Object.keys(this._clips).join(', '));
  }

  /** Fire both revolvers at the ceiling. Resolves when the arms are back down. */
  celebrate() {
    if (!this.model || this._show) return this._show?.done ?? Promise.resolve();
    this._sound.unlock();

    let resolve;
    const done = new Promise((r) => { resolve = r; });
    this._show = { t: 0, shot: 0, resolve, done };
    Object.values(this._arms).forEach((a) => { if (a.gun) a.gun.visible = true; });
    return done;
  }

  /**
   * Flick a card toward `point` (world space) with the arm on that side.
   * Resolves with the hand's world position when the card should leave it.
   * @param {THREE.Vector3} point
   * @returns {Promise<THREE.Vector3>}
   */
  release(point) {
    const arms = Object.values(this._arms).filter((a) => a.upper && a.fist);
    if (!this.model || !arms.length) return Promise.resolve(point.clone());

    // The arm on the target's side of his body
    const side = (arm) => arm.upper.getWorldPosition(_v1).x - this.model.position.x;
    const towardRight = point.x - this.model.position.x;
    const arm = arms.find((a) => Math.sign(side(a)) === Math.sign(towardRight)) ?? arms[0];

    return new Promise((resolve) => {
      arm.reach?.resolve(arm.fist.getWorldPosition(new THREE.Vector3())); // interrupted reach
      arm.reach = { t: 0, point: point.clone(), resolve, released: false };
    });
  }

  /** @param {number} delta */
  update(delta) {
    if (!this.model || this.paused) return;
    for (const [bone, q] of this._rest) bone.quaternion.copy(q);
    this._breathe(delta);
    this._updateReaches(delta);

    const show = this._show;
    if (!show) return;
    show.t += delta;

    // Weight of the "arms up" pose: raise, hold, lower
    const t = show.t;
    const end = HOLD_TIME + LOWER_TIME;
    const w = t < RAISE_TIME ? smooth(t / RAISE_TIME)
      : t < HOLD_TIME ? 1
      : t < end ? 1 - smooth((t - HOLD_TIME) / LOWER_TIME)
      : 0;

    // Shots
    while (show.shot < SHOTS.length && t >= SHOTS[show.shot][0]) {
      this._fire(this._arms[SHOTS[show.shot][1]]);
      show.shot++;
    }

    for (const arm of Object.values(this._arms)) {
      arm.kick = Math.max(0, arm.kick - delta * 9);
      if (arm.upper) this._aimArmAt(arm, this._skyward(arm), w);
      if (arm.flash) {
        arm.flash.userData.life -= delta;
        arm.flash.visible = arm.flash.userData.life > 0;
      }
    }

    if (this._light.intensity > 0) {
      this._light.intensity = Math.max(0, this._light.intensity - delta * 260);
    }

    if (t >= end) {
      Object.values(this._arms).forEach((a) => { if (a.gun) a.gun.visible = false; });
      this._show = null;
      show.resolve();
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** Small life on top of the held pose: breathing, and a look around now and then. */
  _breathe(delta) {
    this._time += delta;
    const t = this._time;
    if (this._torso) this._torso.rotation.x += Math.sin(t * 1.7) * 0.025;
    if (this._head) {
      this._head.rotation.y += Math.sin(t * 0.35) * 0.35 * Math.max(0, Math.sin(t * 0.13));
      this._head.rotation.x += Math.sin(t * 1.7 + 0.6) * 0.02;
    }
  }

  /** Arms reaching out to deal: out and back, card released on the way out. */
  _updateReaches(delta) {
    for (const arm of Object.values(this._arms)) {
      const r = arm.reach;
      if (!r) continue;
      r.t += delta / REACH_TIME;
      const w = Math.sin(Math.PI * Math.min(1, r.t)) * 0.85;
      // Aim from the shoulder toward the spot, a little above it (a flick)
      arm.upper.getWorldPosition(_v1);
      const dir = new THREE.Vector3(r.point.x, r.point.y + 0.6, r.point.z).sub(_v1).normalize();
      this._aimArmAt(arm, dir, w);

      if (!r.released && r.t >= RELEASE_AT) {
        r.released = true;
        r.resolve(arm.fist.getWorldPosition(new THREE.Vector3()));
      }
      if (r.t >= 1) arm.reach = null;
    }
  }

  /** Celebration aim: straight up, slightly outward, leaning back with recoil. */
  _skyward(arm) {
    arm.upper.getWorldPosition(_v1);
    const out = Math.sign(_v1.x - this.model.position.x) || 1; // the arm's side of the body
    return new THREE.Vector3(out * 0.35, 1, 0.12 + arm.kick * 0.35).normalize();
  }

  /** Blend upper and lower arm toward pointing along `target` (world space). */
  _aimArmAt(arm, target, w) {
    if (!arm.upper || w <= 0) return;
    for (const bone of [arm.upper, arm.lower]) {
      if (!bone) continue;
      // Current direction of the bone (its +Y axis) in world space
      bone.getWorldQuaternion(_q1);
      const dir = _v1.set(0, 1, 0).applyQuaternion(_q1);
      // Rotation that turns it toward the target, applied in world space
      _q2.setFromUnitVectors(dir, target);
      _q2.slerp(_q1.identity(), 1 - w);
      bone.getWorldQuaternion(_q1);
      _q1.premultiply(_q2);
      // Back to the bone's local space
      bone.parent.getWorldQuaternion(_q2).invert();
      bone.quaternion.copy(_q2.multiply(_q1));
      bone.updateMatrixWorld(true);
    }
  }

  _fire(arm) {
    if (!arm?.gun) return;
    arm.kick = 1;
    arm.flash.userData.life = 0.06;
    arm.flash.rotation.y = Math.random() * Math.PI;
    arm.flash.getWorldPosition(this._light.position);
    this._light.intensity = 40;
    this._sound.play();
  }
}

function smooth(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
