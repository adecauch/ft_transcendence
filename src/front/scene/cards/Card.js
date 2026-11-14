/**
 * Card.js — A single 3D playing card
 *
 * Thin rounded-corner card: face (SVG texture), back (card.jpg) and a cream
 * edge. Geometry is shared by every card; only the face material differs.
 *
 * Hierarchy (so each rotation stays independent):
 *   group      — position on the table + yaw (which way the card's top points)
 *   └ peek     — the player looking at the card: lift, tilt toward them, scale
 *     └ tilt   — lays the card flat on the felt
 *       └ flip — 0 = face up, π = face down (turns around the card's long axis)
 *         └ face / back / edge meshes
 *
 * The peek is a pose added on top of wherever the card lies (peek(pose)),
 * eased in and out every frame, independent of moveTo(): a card being looked
 * at can still be moved, and dropping the peek puts it back as it was.
 *
 * Usage:
 *   const card = new Card('AS', textures);
 *   scene.add(card.group);
 *   await card.moveTo({ position, yaw, faceUp: true, duration: 0.6 });
 *   card.update(delta) // every frame
 */

import * as THREE from 'three';

export const CARD_SIZE = {
  width:  0.3,
  height: 0.42,   // poker ratio 2.5 × 3.5 in
  depth:  0.0015,
  radius: 0.015,  // matches the SVG corner (rx 12 / 240)
};

// Card back image has its own rounded corners — crop them away slightly.
const BACK_UV_INSET = 0.015;

// ── Shared geometry & materials ─────────────────────────────────────────────

let _shared = null;

function roundedRect(w, h, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/** Remap ShapeGeometry UVs (shape coordinates) to 0..1, with optional inset. */
function normaliseUVs(geo, w, h, inset = 0) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = (uv.getX(i) + w / 2) / w;
    const v = (uv.getY(i) + h / 2) / h;
    uv.setXY(i, inset + u * (1 - 2 * inset), inset + v * (1 - 2 * inset));
  }
  uv.needsUpdate = true;
}

function getShared(textures) {
  if (_shared) return _shared;

  const { width: w, height: h, depth: d, radius: r } = CARD_SIZE;
  const shape = roundedRect(w, h, r);
  const curveSegments = 6;

  const front = new THREE.ShapeGeometry(shape, curveSegments);
  normaliseUVs(front, w, h);
  front.translate(0, 0, d / 2 + 0.0002);

  const back = new THREE.ShapeGeometry(shape, curveSegments);
  normaliseUVs(back, w, h, BACK_UV_INSET);
  back.rotateY(Math.PI);
  back.translate(0, 0, -d / 2 - 0.0002);

  const edge = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: false,
    curveSegments,
  });
  edge.translate(0, 0, -d / 2);

  const cardFinish = {
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  };

  _shared = {
    front,
    back,
    edge,
    backMat: new THREE.MeshPhysicalMaterial({ ...cardFinish, map: textures.back() }),
    // ExtrudeGeometry groups: 0 = caps (hidden, faces are drawn on top), 1 = sides
    edgeMats: [
      new THREE.MeshBasicMaterial({ visible: false }),
      new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.6 }),
    ],
    cardFinish,
  };
  return _shared;
}

// ── Easing ──────────────────────────────────────────────────────────────────

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function shortestAngle(from, to) {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

// ── Peek ────────────────────────────────────────────────────────────────────

const REST = Object.freeze({ reveal: 0, tilt: 0, lift: 0, scale: 1, shift: 0, toward: 0 });
const PEEK_SPEED = 12; // 1/s: about 0.25 s to settle

// ── Card ────────────────────────────────────────────────────────────────────

export class Card {
  /**
   * @param {string|null} code — rank + suit, e.g. 'AS', 'TD'; null = not known yet
   *   (a face-down card of the deck), see setCode()
   * @param {import('./CardTextures').CardTextures} textures
   */
  constructor(code, textures) {
    this.code   = code;
    this._textures = textures;
    this.faceUp = false;

    const shared = getShared(textures);

    this.group = new THREE.Group();
    this.group.name = `card-${code}`;

    this._peek = new THREE.Group();
    this.group.add(this._peek);

    this._tilt = new THREE.Group();
    this._tilt.rotation.x = -Math.PI / 2;
    this._peek.add(this._tilt);

    this._flip = new THREE.Group();
    this._tilt.add(this._flip);
    this._flipAngle = Math.PI; // face down by default; the peek may turn it up on top

    /** Current and target peek pose (see peek()) */
    this._pose = { ...REST };
    this._poseTarget = REST;
    this._applyPose();

    // Unknown cards show the back texture on their face side too (never
    // visible: they're face down), so the material keeps a map and setCode()
    // only swaps the texture.
    const faceMat = new THREE.MeshPhysicalMaterial({
      ...shared.cardFinish,
      map: code ? textures.face(code) : textures.back(),
    });

    const meshes = [
      new THREE.Mesh(shared.front, faceMat),
      new THREE.Mesh(shared.back, shared.backMat),
      new THREE.Mesh(shared.edge, shared.edgeMats),
    ];
    meshes.forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.card = this;
      m.userData.noOutline = true; // paper-thin: a hull would stick through the felt
      this._flip.add(m);
    });
    this.meshes = meshes;

    /** Active tween, or null */
    this._tween = null;
  }

  /** Give the card its face (the game tells which card it is when it's dealt). */
  setCode(code) {
    this.code = code;
    this.group.name = `card-${code}`;
    this.meshes[0].material.map = this._textures.face(code);
  }

  /**
   * Place the card instantly.
   * @param {{ position?: THREE.Vector3, yaw?: number, faceUp?: boolean }} state
   */
  set({ position, yaw, faceUp } = {}) {
    this._tween = null;
    if (position) this.group.position.copy(position);
    if (yaw !== undefined) this.group.rotation.y = yaw;
    if (faceUp !== undefined) {
      this.faceUp = faceUp;
      this._flipAngle = faceUp ? 0 : Math.PI;
      this._applyPose();
    }
  }

  /**
   * Look at the card (or stop): eased toward `pose` over a few frames.
   * @param {{ reveal?: number, tilt?: number, lift?: number, scale?: number, shift?: number } | null} pose
   *   reveal — 0..1, how far a face-down card turns face up
   *   tilt   — radians, the card's face turned up toward the player
   *   lift   — height above where it lies
   *   scale  — size factor
   *   shift  — sideways move (card's own x: + = the player's right)
   *   toward — move toward the player (opposite to where the card's top points)
   *   null   — back to rest
   */
  peek(pose) {
    this._poseTarget = pose ? { ...REST, ...pose } : REST;
  }

  /**
   * Animate to a new position / orientation. Anything left out keeps its
   * current value. Resolves when the animation ends.
   *
   * @param {object} opts
   * @param {THREE.Vector3} [opts.position]
   * @param {number}  [opts.yaw]       — radians, direction the card's top points
   * @param {boolean} [opts.faceUp]
   * @param {number}  [opts.duration]  — seconds
   * @param {number}  [opts.delay]     — seconds before starting
   * @param {number}  [opts.lift]      — height of the arc in the middle of the move
   * @returns {Promise<void>}
   */
  moveTo({ position, yaw, faceUp, duration = 0.5, delay = 0, lift = 0.15 } = {}) {
    this._tween?.resolve();

    return new Promise((resolve) => {
      const fromYaw  = this.group.rotation.y;
      const fromFlip = this._flipAngle;
      const toFlip   = faceUp === undefined ? fromFlip : (faceUp ? 0 : Math.PI);

      this._tween = {
        t: -delay,
        duration,
        lift,
        fromPos:  this.group.position.clone(),
        toPos:    (position ?? this.group.position).clone(),
        fromYaw,
        deltaYaw: yaw === undefined ? 0 : shortestAngle(fromYaw, yaw),
        fromFlip,
        toFlip,
        resolve,
      };
      if (faceUp !== undefined) this.faceUp = faceUp;
    });
  }

  /** Turn the card over where it lies. */
  flip({ duration = 0.45, delay = 0 } = {}) {
    return this.moveTo({ faceUp: !this.faceUp, duration, delay, lift: CARD_SIZE.height * 0.4 });
  }

  /** @param {number} delta — seconds */
  update(delta) {
    this._stepTween(delta);
    this._stepPose(delta);
  }

  _stepTween(delta) {
    const tw = this._tween;
    if (!tw) return;

    tw.t += delta;
    if (tw.t < 0) return;

    const raw = Math.min(1, tw.t / tw.duration);
    const e   = easeInOutCubic(raw);

    this.group.position.lerpVectors(tw.fromPos, tw.toPos, e);
    this.group.position.y += Math.sin(Math.PI * raw) * tw.lift;
    this.group.rotation.y = tw.fromYaw + tw.deltaYaw * e;
    this._flipAngle = tw.fromFlip + (tw.toFlip - tw.fromFlip) * e;
    this._applyPose();

    if (raw >= 1) {
      this._tween = null;
      tw.resolve();
    }
  }

  /** Ease the peek pose toward its target (frame-rate independent). */
  _stepPose(delta) {
    const k = 1 - Math.exp(-PEEK_SPEED * delta);
    let moving = false;
    for (const key in this._pose) {
      const diff = this._poseTarget[key] - this._pose[key];
      if (Math.abs(diff) < 1e-4) { this._pose[key] = this._poseTarget[key]; continue; }
      this._pose[key] += diff * k;
      moving = true;
    }
    if (moving) this._applyPose();
  }

  _applyPose() {
    const p = this._pose;
    this._peek.position.set(p.shift, p.lift, p.toward);
    this._peek.rotation.x = p.tilt; // same axis as the tilt: turns the face toward the player
    this._peek.scale.setScalar(p.scale);
    this._flip.rotation.y = this._flipAngle * (1 - p.reveal);
  }
}
