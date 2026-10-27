import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';

export type DoorPosition = THREE.Vector3 | { x: number; y?: number; z: number };

export interface DoorHandle {
  doorType: string;
  group: THREE.Group;
  model: THREE.Group;
  modelPath: string;
  isOpen: boolean;
  open: () => Promise<void>;
  close: () => Promise<void>;
}

function toVector3(position: DoorPosition): THREE.Vector3 {
  if (position instanceof THREE.Vector3) return position.clone();
  return new THREE.Vector3(position.x, position.y ?? 0, position.z);
}

function normalizeType(doorType: string): string {
  return String(doorType ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveKitFile(doorType: string): string {
  const t = normalizeType(doorType);
  if (t.includes('portcullis') || t.includes('port') || t.includes('gate') || t.includes('lift')) {
    return 'KIT_Gate_Portcullis_3.glb';
  }
  if (t.includes('mirror')) return 'KIT_Door_Mirror_2.glb';
  if (t.includes('iron')) return 'KIT_Door_Iron_2.glb';
  if (t.includes('wood')) return 'KIT_Door_Wood_2.glb';
  if (t.includes('gothic')) return 'KIT_Arch_Gothic_4.glb';
  if (t.includes('round')) return 'KIT_Arch_Round_4.glb';
  if (t.includes('fog')) return 'KIT_Arch_FogGate_4.glb';
  // Allow direct filename/stem.
  if (t.startsWith('kit')) {
    return `${doorType}.glb`;
  }
  // Default to wood door.
  return 'KIT_Door_Wood_2.glb';
}

function isPortcullis(doorType: string): boolean {
  const t = normalizeType(doorType);
  const file = resolveKitFile(doorType);
  return t.includes('portcullis') || t.includes('port') || t.includes('gate') || t.includes('lift') || file.includes('Portcullis');
}

function candidatePaths(doorType: string): string[] {
  const file = resolveKitFile(doorType);
  const paths = new Set<string>();
  const add = (p: string) => paths.add(p);
  add(`/assets/models/kit/${file}`);
  // If caller passed a direct filename.
  add(`/assets/models/kit/${doorType}.glb`);
  add(`/assets/models/kit/${doorType}`);
  const collected = Array.from(paths);
  const variants: string[] = [];
  for (const p of collected) {
    variants.push(p);
    variants.push(p.replace(/^\//, ''));
    variants.push(p.replace('/assets/', 'assets/'));
  }
  return variants;
}

async function loadModel(doorType: string): Promise<{ scene: THREE.Group; path: string }> {
  let lastError: unknown;
  for (const url of candidatePaths(doorType)) {
    try {
      const loaded = await AssetLoader.load(url);
      return { scene: loaded.scene, path: url };
    } catch (err) {
      lastError = err;
    }
  }
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x6b4f2a }),
  );
  const group = new THREE.Group();
  group.add(box);
  void lastError;
  return { scene: group, path: `/assets/models/kit/${resolveKitFile(doorType)}` };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class DoorFactory {
  static async spawn(doorType: string, position: DoorPosition, scene?: THREE.Scene): Promise<DoorHandle> {
    const loaded = await loadModel(doorType);
    const pos = toVector3(position);

    const group = new THREE.Group();
    group.add(loaded.scene);
    group.position.copy(pos);

    const portcullis = isPortcullis(doorType);
    const swingAngle = portcullis ? 0 : Math.PI / 2;
    const liftHeight = 2.4;

    const baseY = group.position.y;
    const baseRotY = group.rotation.y;

    let isOpen = false;

    const animate = (open: boolean): Promise<void> => {
      return new Promise<void>((resolve) => {
        const duration = 600;
        const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const startY = group.position.y;
        const startRotY = group.rotation.y;
        const targetY = open ? baseY + liftHeight : baseY;
        const targetRotY = open ? baseRotY + swingAngle : baseRotY;

        const step = () => {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const t = Math.min(1, (now - start) / duration);
          const e = easeInOutCubic(t);
          if (portcullis) {
            group.position.y = startY + (targetY - startY) * e;
          } else {
            group.rotation.y = startRotY + (targetRotY - startRotY) * e;
          }
          if (t < 1) {
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(step);
            else setTimeout(step, 16);
          } else {
            if (portcullis) group.position.y = targetY;
            else group.rotation.y = targetRotY;
            isOpen = open;
            group.userData.isOpen = open;
            resolve();
          }
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(step);
        else setTimeout(step, 16);
      });
    };

    const handle: DoorHandle = {
      doorType,
      group,
      model: loaded.scene,
      modelPath: loaded.path,
      isOpen: false,
      open: async () => {
        if (isOpen) return;
        await animate(true);
        handle.isOpen = true;
      },
      close: async () => {
        if (!isOpen) return;
        await animate(false);
        handle.isOpen = false;
      },
    };

    // Keep handle.isOpen in sync.
    Object.defineProperty(handle, 'isOpen', {
      get: () => isOpen,
      set: (v: boolean) => { isOpen = v; },
    });

    group.userData.doorType = doorType;
    group.userData.modelPath = loaded.path;
    group.userData.isOpen = isOpen;
    group.userData.open = handle.open;
    group.userData.close = handle.close;
    group.userData.doorHandle = handle;
    group.userData.isPortcullis = portcullis;
    group.userData.colliderType = 'box';

    if (scene) scene.add(group);

    return handle;
  }

  static update(_handleOrGroup: DoorHandle | THREE.Group | any, _dt: number): void {
    // Doors are animated via open(); nothing per-frame required.
  }
}

export default DoorFactory;
