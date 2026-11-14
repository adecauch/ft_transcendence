/**
 * Opponents.js — The AI players, sitting on their chairs around the table
 *
 * seat(names) puts one character per opponent on the chair of its seat
 * (seatLayout.js), clear() removes them. react(seat, kind) plays a small
 * gesture on one of them:
 *
 *   'raise' → a short double nod
 *   'fold'  → head drops, shoulders slump a little, then back up
 *   'lose'  → slow head shake
 *   'win'   → chin up, a little sway of the shoulders
 *   'out'   → slumps in the chair and stays so
 *
 * The body stays in the seated pose (last frame of SitDown). The pack's
 * reaction clips (Punch, Victory, Death…) are animated standing: played on a
 * seated character they swing the arms and torso through the table, so the
 * gestures are procedural instead — small rotations of the torso, neck and
 * head added every frame on top of the pose, like the dealer's idle life.
 *
 * The table is tall for the chairs (felt at y ≈ 2.3, seats at y ≈ 1.0): the
 * characters are scaled up (HEIGHT) so their shoulders clear the felt and
 * their heads end up level with the dealer's.
 */

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { seatLayouts } from '../seatLayout.js';
import { lookFor } from './characters.js';

const HEIGHT         = 6.0;  // standing height in world units (the dealer: 5.2)
const SEAT_Y         = 1.0;  // top of a chair's seat (measured)
const HIPS_OVER_SEAT = 0.2;
const HIPS_BACK      = 0.2;  // hips a bit behind the chair's centre, toward its back

/**
 * Gestures: bone → (s = seconds since the start) → added rotation, in radians.
 * Bones: local +x bends forward (head down), +y turns left, +z tilts sideways.
 * Kept small on purpose: the torso never leans more than a few degrees toward
 * the table.
 */
const bump = (s, dur) => (s < 0 || s > dur ? 0 : Math.sin((Math.PI * s) / dur)); // 0 → 1 → 0
const GESTURES = {
  raise: { dur: 0.9, head: (s) => ({ x: 0.14 * Math.max(0, Math.sin(s * 14)) * bump(s, 0.9) }) },
  fold: {
    dur: 1.6,
    head:  (s) => ({ x: 0.35 * bump(s, 1.6) }),
    torso: (s) => ({ x: -0.06 * bump(s, 1.6) }), // sits back
  },
  lose: { dur: 1.8, head: (s) => ({ y: 0.25 * Math.sin(s * 7) * bump(s, 1.8), x: 0.12 * bump(s, 1.8) }) },
  win: {
    dur: 1.8,
    head:  (s) => ({ x: -0.18 * bump(s, 1.8) }),
    torso: (s) => ({ z: 0.06 * Math.sin(s * 6) * bump(s, 1.8), x: -0.04 * bump(s, 1.8) }),
  },
};
const SLUMP_TIME = 0.8; // seconds to slump when eliminated

export class Opponents {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../../render/AssetLoader').AssetLoader} loader
   */
  constructor(scene, loader) {
    this.scene  = scene;
    this.loader = loader;
    this.paused = false;
    /** @type {(Character | undefined)[]} seat index → character (seat 0 = the player: none) */
    this._seats = [];
    this._run = 0;
    /** @type {Map<string, Promise<object | null>>} one load per model file */
    this._loads = new Map();
  }

  /**
   * Sit one character per opponent, in seat order (seat 1 = names[0]).
   * @param {string[]} names
   */
  async seat(names) {
    this.clear();
    const run = this._run;
    const layouts = seatLayouts(names.length);
    const gltfs = await Promise.all(names.map((n) => this._load(lookFor(n).model)));
    if (run !== this._run) return; // cleared or reseated meanwhile

    names.forEach((name, i) => {
      const gltf = gltfs[i];
      if (!gltf) return;
      const c = new Character(gltf, lookFor(name), layouts[i + 1].chair);
      this.scene.add(c.model);
      this._seats[i + 1] = c;
    });
  }

  clear() {
    this._run++;
    for (const c of this._seats) if (c) c.dispose();
    this._seats = [];
  }

  /**
   * @param {number} seat
   * @param {'raise' | 'fold' | 'lose' | 'win' | 'out'} kind
   */
  react(seat, kind) {
    this._seats[seat]?.react(kind);
  }

  /** @param {number} delta */
  update(delta) {
    if (this.paused) return;
    for (const c of this._seats) if (c) c.update(delta);
  }

  _load(path) {
    if (!this._loads.has(path)) this._loads.set(path, this.loader.loadModel(path, path).catch(() => null));
    return this._loads.get(path);
  }
}

class Character {
  /**
   * @param {import('three/addons/loaders/GLTFLoader.js').GLTF} gltf
   * @param {import('./characters').Look} look
   * @param {{ x: number, z: number, rot: number }} chair
   */
  constructor(gltf, look, chair) {
    const model = cloneSkinned(gltf.scene);
    this.model = model;
    this.out = false;
    this._time = Math.random() * 100; // so they don't all breathe in sync
    this._gesture = null;             // { g, s } the gesture playing
    this._slump = 0;                  // 0 → 1 once eliminated

    // Own materials, recoloured
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const recolour = (m) => {
        const copy = m.clone();
        const c = look.colors?.[m.name];
        if (c !== undefined) copy.color.setHex(c);
        return copy;
      };
      o.material = Array.isArray(o.material) ? o.material.map(recolour) : recolour(o.material);
    });

    // Size from the standing bind pose
    const box = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(HEIGHT / box.getSize(new THREE.Vector3()).y);

    // Seated pose: last frame of SitDown, held
    const sit = gltf.animations.find((c) => c.name === 'SitDown');
    this._mixer = new THREE.AnimationMixer(model);
    if (sit) {
      const a = this._mixer.clipAction(sit);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();
      this._mixer.update(sit.duration);
    }

    // ── On the chair, facing the table ──
    model.rotation.y = chair.rot;
    model.position.set(chair.x, 0, chair.z);
    model.updateMatrixWorld(true);
    const hips = model.getObjectByName('Hips').getWorldPosition(new THREE.Vector3());
    const back = { x: -Math.sin(chair.rot), z: -Math.cos(chair.rot) };
    model.position.x += chair.x + back.x * HIPS_BACK - hips.x;
    model.position.z += chair.z + back.z * HIPS_BACK - hips.z;
    model.position.y += SEAT_Y + HIPS_OVER_SEAT - hips.y;

    // A clamped action is not reapplied: remember the pose, restore it each frame
    this._bones = {};
    this._pose = {};
    for (const name of ['Torso', 'Neck', 'Head']) {
      const b = model.getObjectByName(name);
      if (!b) continue;
      this._bones[name] = b;
      this._pose[name] = b.quaternion.clone();
    }
  }

  react(kind) {
    if (this.out) return;
    if (kind === 'out') {
      this.out = true;
      this._gesture = null;
      return;
    }
    const g = GESTURES[kind];
    if (g) this._gesture = { g, s: 0 };
  }

  update(delta) {
    this._time += delta;
    const { Torso: torso, Neck: neck, Head: head } = this._bones;
    for (const [name, b] of Object.entries(this._bones)) b.quaternion.copy(this._pose[name]);

    const add = (bone, r) => {
      if (!bone || !r) return;
      bone.rotation.x += r.x || 0;
      bone.rotation.y += r.y || 0;
      bone.rotation.z += r.z || 0;
    };

    if (this.out) {
      // Slumped in the chair: sits back, head hanging
      this._slump = Math.min(1, this._slump + delta / SLUMP_TIME);
      const k = this._slump * (2 - this._slump); // ease out
      add(torso, { x: -0.12 * k, z: 0.08 * k });
      add(neck,  { x: 0.2 * k });
      add(head,  { x: 0.3 * k });
      return;
    }

    // Idle life: breathing, a look around now and then
    const t = this._time;
    add(torso, { x: Math.sin(t * 1.6) * 0.02 });
    add(head, {
      y: Math.sin(t * 0.4) * 0.25 * Math.max(0, Math.sin(t * 0.15)),
      x: Math.sin(t * 1.6 + 0.6) * 0.02,
    });

    const gs = this._gesture;
    if (gs) {
      gs.s += delta;
      add(torso, gs.g.torso?.(gs.s));
      add(head,  gs.g.head?.(gs.s));
      if (gs.s >= gs.g.dur) this._gesture = null;
    }
  }

  dispose() {
    this._mixer.stopAllAction();
    this.model.removeFromParent();
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      [].concat(o.material).forEach((m) => m.dispose());
    });
  }
}
