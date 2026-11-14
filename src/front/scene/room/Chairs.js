import * as THREE from 'three';
import { CHAIRS } from '../seatLayout.js';

const MODEL_KEY  = 'chair';
const MODEL_PATH = '/models/chair/old_western_saloon_chair.glb';

// Chair bottom sits at y=0 (table surface level) so the seat is visible from above
const FLOOR_Y = -0.5;

export class Chairs {
  constructor(scene, loader) {
    this.scene  = scene;
    this.loader = loader;
  }

  async build() {
    const TARGET_HEIGHT = 2.7;

    const gltf = await this.loader.loadModel(MODEL_KEY, MODEL_PATH);
    if (!gltf) {
      console.warn('[Chairs] Failed to load chair model.');
      return;
    }

    const template = gltf.scene;

    // The model ships a plain white, fully metallic material: black in PBR
    // (nothing to reflect), white in toon. Give it a saloon wood colour.
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.7, metalness: 0 });
    template.traverse((child) => {
      if (child.isMesh) child.material = wood;
    });

    // Auto-scale so chair height = TARGET_HEIGHT
    const box = new THREE.Box3().setFromObject(template);
    const size = box.getSize(new THREE.Vector3());
    const modelHeight = size.y;
    const scale = TARGET_HEIGHT / modelHeight;
    console.log(`[Chairs] model size: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}, auto-scale: ${scale.toFixed(4)}`);

    // Bottom of chair after scaling sits at FLOOR_Y
    const chairY = FLOOR_Y - box.min.y * scale;

    for (const pos of CHAIRS) {
      const chair = template.clone();
      chair.scale.setScalar(scale);
      chair.position.set(pos.x, chairY, pos.z);
      chair.rotation.y = pos.rot;
      this.scene.add(chair);
    }

    console.log(`[Chairs] ${CHAIRS.length} chairs placed at y=${chairY.toFixed(3)}`);
  }
}
