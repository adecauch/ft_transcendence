import * as THREE from 'three';
import { AssetLoader } from '../../render/AssetLoader.js';

const WIDTH  = 22;
const DEPTH  = 16;
const HEIGHT = 10;

export class Room {
  constructor(scene, loader = null) {
    this.scene  = scene;
    this.loader = loader ?? new AssetLoader();
  }

  async build() {
    const scene = this.scene;

    // Fog
    scene.fog = new THREE.FogExp2(0x0a0505, 0.035);

    // ── Floor ────────────────────────────────────────────────────────────────
    const textureLoader = new THREE.TextureLoader();
    const diffMap = textureLoader.load('/textures/floor/worn_planks_diff_4k.jpg');
    const dispMap = textureLoader.load('/textures/floor/worn_planks_disp_4k.png');

    for (const tex of [diffMap, dispMap]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 4);
    }

    const floorGeo = new THREE.PlaneGeometry(20, 14);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x8a5a3a,
      map: diffMap,
      displacementMap: dispMap,
      displacementScale: 0.05,
      roughness: 0.85,
      metalness: 0.0,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    console.log(
      `[Room] Floor built — position y=${floor.position.y}`,
      '| diff: worn_planks_diff_4k.jpg',
      '| disp: worn_planks_disp_4k.png',
      '| repeat: 4×4'
    );

    // Vignette plane
    const vigGeo = new THREE.PlaneGeometry(WIDTH, DEPTH);
    const vigMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const vignette = new THREE.Mesh(vigGeo, vigMat);
    vignette.rotation.x = -Math.PI / 2;
    vignette.position.y = -0.49;
    scene.add(vignette);

    // ── Wall textures ─────────────────────────────────────────────────────────
    const wallDiff  = textureLoader.load('/textures/wall/fabric_leather_02_diff_4k.jpg');
    const wallRough = textureLoader.load('/textures/wall/fabric_leather_02_rough_4k.jpg');
    const wallDisp  = textureLoader.load('/textures/wall/fabric_leather_02_disp_4k.png');

    for (const tex of [wallDiff, wallRough, wallDisp]) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(3, 2);
    }

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x6b4a2e,
      map: wallDiff,
      roughnessMap: wallRough,
      displacementMap: wallDisp,
      displacementScale: 0.03,
      roughness: 0.6,
      metalness: 0.0,
    });

    const ceilMat = new THREE.MeshStandardMaterial({
      color: 0x080808,
      roughness: 0.9,
      metalness: 0.0,
    });

    const WALL_W = 20;
    const WALL_D = 14;
    const WALL_H = 8;
    const WALL_Y = -0.5 + WALL_H / 2;

    // ── Walls ─────────────────────────────────────────────────────────────────
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H), wallMat);
    backWall.position.set(0, WALL_Y, -WALL_D / 2);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W, WALL_H), wallMat);
    frontWall.rotation.y = Math.PI;
    frontWall.position.set(0, WALL_Y, WALL_D / 2);
    frontWall.receiveShadow = true;
    scene.add(frontWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_D, WALL_H), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-WALL_W / 2, WALL_Y, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(WALL_D, WALL_H), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(WALL_W / 2, WALL_Y, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // ── Ceiling ───────────────────────────────────────────────────────────────
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, DEPTH), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = HEIGHT;
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    // Big flat surfaces: no cartoon outline (see render/ToonStyle.js)
    for (const m of [floor, backWall, frontWall, leftWall, rightWall, ceiling]) m.userData.noOutline = true;

    console.log(`[Room] Walls/ceiling built — W:${WIDTH} D:${DEPTH} H:${HEIGHT}`);

    // ── Door model ────────────────────────────────────────────────────────────
    try {
      const gltf = await this.loader.loadModel('door', '/models/doors/door.glb');
      const door = gltf.scene.clone();

      // Scale calculé avant tout
      const boxRaw  = new THREE.Box3().setFromObject(door);
      const sizeRaw = new THREE.Vector3();
      boxRaw.getSize(sizeRaw);
      const scale = 5 / sizeRaw.y;
      door.scale.setScalar(scale);

      // ✅ Textures originales conservées — juste les ombres
      door.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true;
          child.receiveShadow = true;
        }
      });

      door.position.set(-5, -0.5, -6.95);
      door.rotation.y = 0;
      scene.add(door);
      console.log(
        `[Room] Door — position: x=${door.position.x} y=${door.position.y} z=${door.position.z}`,
        `| scale: ${scale.toFixed(4)}`
      );
    } catch (err) {
      console.warn('[Room] Door model failed to load:', err);
    }

    // ── Cabinet model ─────────────────────────────────────────────────────────
    try {
      const cabinetGltf = await this.loader.loadModel('cabinet', '/models/cabinet/Cabinet.glb');
      const cabinet = cabinetGltf.scene.clone();

      const boxRaw  = new THREE.Box3().setFromObject(cabinet);
      const sizeRaw = new THREE.Vector3();
      boxRaw.getSize(sizeRaw);
      const cabinetScale = 3.5 / sizeRaw.y;
      cabinet.scale.setScalar(cabinetScale);

      cabinet.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true;
          child.receiveShadow = true;
        }
      });

      cabinet.position.set(5, -0.5, -6.9);
      cabinet.rotation.y = 0;
      scene.add(cabinet);

      console.log(
        `[Room] Cabinet — position: x=${cabinet.position.x} y=${cabinet.position.y} z=${cabinet.position.z}`,
        `| scale: ${cabinetScale.toFixed(4)}`
      );
    } catch (err) {
      console.warn('[Room] Cabinet model failed to load:', err);
    }
  }
}