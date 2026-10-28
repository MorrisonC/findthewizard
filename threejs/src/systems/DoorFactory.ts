import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';

export type DoorPosition = THREE.Vector3 | { x: number; y?: number; z: number };

export interface DoorHandle {
  doorType: string;
  group: THREE.Group;
  model: THREE.Group;
  modelPath: string;
  isOpen: boolean;
  isMirrorDoor: boolean;
  colliderEnabled: boolean;
  open: () => Promise<void>;
  close: () => Promise<void>;
  setMirrorPhasePassable: (passable: boolean) => void;
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
  if (t.includes('gatearch') || t === 'arch') {
    return 'gate_arch.glb';
  }
  if (t.includes('portcullis') || t.includes('port') || t.includes('gate') || t.includes('lift')) {
    return 'KIT_Gate_Portcullis_3.glb';
  }
  if (t.includes('mirror')) return 'KIT_Door_Mirror_2.glb';
  if (t.includes('iron') || t.includes('cell') || t.includes('vault')) return 'KIT_Door_Iron_2.glb';
  if (t.includes('wood')) return 'KIT_Door_Wood_2.glb';
  if (t.includes('gothic')) return 'KIT_Arch_Gothic_4.glb';
  if (t.includes('round')) return 'KIT_Arch_Round_4.glb';
  if (t.includes('fog')) return 'KIT_Arch_FogGate_4.glb';
  if (t.startsWith('kit')) {
    return doorType.endsWith('.glb') ? doorType : `${doorType}.glb`;
  }
  return 'KIT_Door_Wood_2.glb';
}

function isPortcullis(doorType: string): boolean {
  const t = normalizeType(doorType);
  const file = resolveKitFile(doorType);
  return (
    t.includes('portcullis') ||
    t.includes('port') ||
    t.includes('gate') ||
    t.includes('lift') ||
    file.includes('Portcullis')
  );
}

function candidatePaths(doorType: string): string[] {
  const file = resolveKitFile(doorType);
  const paths = new Set<string>();
  const add = (p: string) => paths.add(p);

  if (file === 'gate_arch.glb') {
    add('/assets/models/gate_arch.glb');
    add('assets/models/gate_arch.glb');
  }
  add(`/assets/models/kit/${file}`);
  add(`assets/models/kit/${file}`);
  add(`/assets/models/${file}`);
  add(`assets/models/${file}`);
  if (doorType) {
    const clean = doorType.replace(/\.glb$/i, '');
    add(`/assets/models/kit/${clean}.glb`);
    add(`assets/models/kit/${clean}.glb`);
  }
  return Array.from(paths);
}

async function loadModel(doorType: string): Promise<{ scene: THREE.Group; path: string }> {
  const file = resolveKitFile(doorType);
  const canonicalPath = file === 'gate_arch.glb' ? '/assets/models/gate_arch.glb' : `/assets/models/kit/${file}`;
  let lastError: unknown;
  for (const url of candidatePaths(doorType)) {
    try {
      const loaded = await AssetLoader.load(url);
      return { scene: loaded.scene, path: url.startsWith('/') ? url : `/${url}` };
    } catch (err) {
      lastError = err;
    }
  }
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.7, metalness: 0.2 }),
  );
  const group = new THREE.Group();
  group.add(box);
  void lastError;
  return { scene: group, path: canonicalPath };
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

    const file = resolveKitFile(doorType);
    const portcullis = isPortcullis(doorType);
    const mirrorDoor = file === 'KIT_Door_Mirror_2.glb' || normalizeType(doorType).includes('mirror');
    const swingAngle = portcullis ? 0 : Math.PI / 2;
    const liftHeight = 2.4;

    const baseY = group.position.y;
    const baseRotY = group.rotation.y;

    let isOpen = false;
    let colliderEnabled = true;
    let activeTransitionId = 0;

    group.userData.rapierCollider = {
      type: 'cuboid',
      halfExtents: { x: 0.9, y: 1.2, z: 0.15 },
      translation: { x: pos.x, y: pos.y + 1.2, z: pos.z },
      rotationY: baseRotY,
      enabled: true,
      sensor: false,
    };

    const syncCollider = (openState: boolean) => {
      colliderEnabled = !openState;
      handle.colliderEnabled = colliderEnabled;
      if (group.userData.rapierCollider) {
        group.userData.rapierCollider.enabled = colliderEnabled;
        group.userData.rapierCollider.sensor = openState;
        group.userData.rapierCollider.translation.y = group.position.y + 1.2;
        group.userData.rapierCollider.rotationY = group.rotation.y;
      }
    };

    const animate = (open: boolean): Promise<void> => {
      const transitionId = ++activeTransitionId;
      return new Promise<void>((resolve) => {
        const duration = 600;
        const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const startY = group.position.y;
        const startRotY = group.rotation.y;
        const targetY = open ? baseY + liftHeight : baseY;
        const targetRotY = open ? baseRotY + swingAngle : baseRotY;

        const step = () => {
          if (transitionId !== activeTransitionId) {
            resolve();
            return;
          }
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          const t = Math.min(1, (now - start) / duration);
          const e = easeInOutCubic(t);
          if (portcullis) {
            group.position.y = startY + (targetY - startY) * e;
          } else {
            group.rotation.y = startRotY + (targetRotY - startRotY) * e;
          }
          syncCollider(t > 0.5 ? open : isOpen);

          if (t < 1) {
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(step);
            else setTimeout(step, 16);
          } else {
            if (portcullis) group.position.y = targetY;
            else group.rotation.y = targetRotY;
            isOpen = open;
            handle.isOpen = open;
            group.userData.isOpen = open;
            syncCollider(open);
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
      isMirrorDoor: mirrorDoor,
      colliderEnabled: true,
      open: async () => {
        if (isOpen && activeTransitionId > 0) return;
        await animate(true);
      },
      close: async () => {
        if (!isOpen && activeTransitionId > 0) return;
        await animate(false);
      },
      setMirrorPhasePassable: (passable: boolean) => {
        if (!mirrorDoor) return;
        syncCollider(passable || isOpen);
        group.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.transparent = true;
            mat.opacity = passable ? 0.38 : 1.0;
            if ('emissive' in mat) {
              mat.emissive.setHex(passable ? 0x38bdf8 : 0x000000);
              mat.emissiveIntensity = passable ? 0.65 : 0.0;
            }
          }
        });
      },
    };

    group.userData.doorHandle = handle;
    if (scene) scene.add(group);
    return handle;
  }
}
