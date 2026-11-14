/**
 * AssetLoader.js — Centralised asset management
 *
 * Wraps Three.js loaders (GLTFLoader, TextureLoader) and exposes a simple
 * key-based cache so every class can request an asset without re-fetching.
 *
 * Usage:
 *   const loader = new AssetLoader();
 *   await loader.preload();
 *   const tex = loader.getTexture('card-back');
 *   const gltf = loader.getModel('table');
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ── Asset manifest ────────────────────────────────────────────────────────────
// Add paths here as real assets are created.
// Textures are loaded eagerly; models are loaded on demand or during preload.

const TEXTURES = {
  // 'card-back':   '/textures/cards/card_back.jpg',
  // 'felt':        '/textures/table/felt.jpg',
  // 'wood':        '/textures/table/wood.jpg',
};

const MODELS = {
  'table': '/models/tables/poker_table_empty.glb', // same model, chips & cards removed
  // 'chips': '/models/chips.glb',
};

// ─────────────────────────────────────────────────────────────────────────────

export class AssetLoader {
  constructor() {
    this._textureLoader = new THREE.TextureLoader();

    // DRACO decoder for compressed GLB files
    this._dracoLoader = new DRACOLoader();
    this._dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    this._gltfLoader = new GLTFLoader();
    this._gltfLoader.setDRACOLoader(this._dracoLoader);

    // Caches
    this._textures = new Map();
    this._models   = new Map();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Preload all registered assets.
   * Resolves when every asset in the manifests is loaded (or skipped if the
   * path is commented out).
   * @returns {Promise<void>}
   */
  async preload() {
    const texturePromises = Object.entries(TEXTURES).map(([key, path]) =>
      this._loadTexture(key, path)
    );
    const modelPromises = Object.entries(MODELS).map(([key, path]) =>
      this._loadModel(key, path)
    );

    await Promise.allSettled([...texturePromises, ...modelPromises]);
    console.log('[AssetLoader] Preload complete.');
  }

  /**
   * Retrieve a cached texture by key.
   * @param {string} key
   * @returns {THREE.Texture | undefined}
   */
  getTexture(key) {
    return this._textures.get(key);
  }

  /**
   * Retrieve a cached GLTF result by key.
   * @param {string} key
   * @returns {import('three/addons/loaders/GLTFLoader').GLTF | undefined}
   */
  getModel(key) {
    return this._models.get(key);
  }

  /**
   * Load a model on demand and cache it.
   * @param {string} key
   * @param {string} path
   * @returns {Promise<import('three/addons/loaders/GLTFLoader').GLTF>}
   */
  async loadModel(key, path) {
    if (this._models.has(key)) return this._models.get(key);
    return this._loadModel(key, path);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _loadTexture(key, path) {
    return new Promise((resolve, reject) => {
      this._textureLoader.load(
        path,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          this._textures.set(key, texture);
          resolve(texture);
        },
        undefined,
        (err) => {
          console.warn(`[AssetLoader] Failed to load texture "${key}":`, err);
          reject(err);
        }
      );
    });
  }

  _loadModel(key, path) {
    return new Promise((resolve, reject) => {
      this._gltfLoader.load(
        path,
        (gltf) => {
          this._models.set(key, gltf);
          resolve(gltf);
        },
        undefined,
        (err) => {
          console.warn(`[AssetLoader] Failed to load model "${key}":`, err);
          reject(err);
        }
      );
    });
  }
}
