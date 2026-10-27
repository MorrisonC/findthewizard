import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  skinned: boolean;
}

export interface AssetRegistryEntry {
  url: string;
  gltf: any;
  clones: number;
}

const CACHE = new Map<string, AssetRegistryEntry>();
const LOADER = new GLTFLoader();

export class AssetLoader {
  static async load(url: string): Promise<LoadedModel> {
    let entry = CACHE.get(url);
    if (!entry) {
      const gltf = await new Promise<any>((resolve, reject) => {
        LOADER.load(url, resolve, undefined, reject);
      });
      entry = { url, gltf, clones: 0 };
      CACHE.set(url, entry);
      // Enhance materials
      gltf.scene.traverse((node: THREE.Object3D) => {
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
          }
        }
      });
    }
    entry.clones++;
    const clone = SkeletonUtils.clone(entry.gltf.scene) as THREE.Group;
    return {
      scene: clone,
      animations: entry.gltf.animations ?? [],
      skinned: clone.children.some((c) => (c as any).isSkinnedMesh),
    };
  }

  static cloneSkinned(cached: LoadedModel): THREE.Group {
    return SkeletonUtils.clone(cached.scene) as THREE.Group;
  }

  static clearCache(): void {
    CACHE.clear();
  }
}

export default AssetLoader;
