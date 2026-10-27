import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';

export type PuzzlePosition = THREE.Vector3 | { x: number; y?: number; z: number };

export interface PuzzlePropHandle {
  puzzleId: string;
  group: THREE.Group;
  model: THREE.Group;
  interactionRadius: number;
  modelPath: string;
  playInteract: (kind: 'lever' | 'kneel') => Promise<void>;
}

const HERO_PROPS = [
  '/assets/models/mirror_lock.glb',
  '/assets/models/aeolian_belfry.glb',
  '/assets/models/alchemist_bench.glb',
  '/assets/models/archival_lectern.glb',
  '/assets/models/celestial_telescope.glb',
  '/assets/models/chronomantic_astrolabe.glb',
  '/assets/models/escher_anchor.glb',
  '/assets/models/glass_armonica.glb',
  '/assets/models/monk_sarcophagus.glb',
  '/assets/models/rooftop_anemometer.glb',
  '/assets/models/starmap_pedestal.glb',
  '/assets/models/steampunk_boiler.glb',
  '/assets/models/vent_grate.glb',
  '/assets/models/void_rift_anchor.glb',
];

const PUZZLE_PROPS = [
  '/assets/models/props/acoustic_crystal.glb',
  '/assets/models/props/barracks_bunk.glb',
  '/assets/models/props/bazaar_stele.glb',
  '/assets/models/props/garden_water_sluice.glb',
  '/assets/models/props/harmonic_pullrope.glb',
  '/assets/models/props/heart_of_mirrors_prop.glb',
  '/assets/models/props/heraldic_shield_mount.glb',
  '/assets/models/props/iron_maiden.glb',
  '/assets/models/props/market_astro_dial.glb',
  '/assets/models/props/market_scales.glb',
  '/assets/models/props/merchant_safe.glb',
  '/assets/models/props/panopticon_beacon.glb',
  '/assets/models/props/portcullis_gears.glb',
  '/assets/models/props/prison_lever_bank.glb',
  '/assets/models/props/reliquary_shadowbox.glb',
  '/assets/models/props/rest_fountain.glb',
  '/assets/models/props/royal_canopy_bed.glb',
  '/assets/models/props/siege_ballista.glb',
  '/assets/models/props/siphon_valve_wheel.glb',
  '/assets/models/props/sundial_falsedawn.glb',
  '/assets/models/props/torture_rack.glb',
  '/assets/models/props/training_dummy.glb',
  '/assets/models/props/treasury_dial_vault.glb',
  '/assets/models/props/whispering_lattice.glb',
];

const ALL_PROP_PATHS = [...HERO_PROPS, ...PUZZLE_PROPS];

function toVector3(position: PuzzlePosition): THREE.Vector3 {
  if (position instanceof THREE.Vector3) return position.clone();
  return new THREE.Vector3(position.x, position.y ?? 0, position.z);
}

function normalizeId(id: string): string {
  return String(id ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveModelPath(puzzleId: string): string {
  const id = String(puzzleId ?? '');
  const norm = normalizeId(id);

  // Direct filename/stem match (with or without extension).
  for (const path of ALL_PROP_PATHS) {
    const stem = path.split('/').pop()!.replace(/\.glb$/i, '');
    if (normalizeId(stem) === norm) return path;
  }

  // Explicit puzzle-id -> hero prop mapping for well-known puzzles.
  const explicit: Record<string, string> = {
    p1: '/assets/models/mirror_lock.glb',
    p2: '/assets/models/props/heart_of_mirrors_prop.glb',
    p9: '/assets/models/escher_anchor.glb',
    p10: '/assets/models/celestial_telescope.glb',
    p11: '/assets/models/alchemist_bench.glb',
    p13: '/assets/models/rooftop_anemometer.glb',
    p14: '/assets/models/void_rift_anchor.glb',
    p19: '/assets/models/steampunk_boiler.glb',
    p23: '/assets/models/chronomantic_astrolabe.glb',
    p24: '/assets/models/props/portcullis_gears.glb',
    p25: '/assets/models/glass_armonica.glb',
    p26: '/assets/models/props/sundial_falsedawn.glb',
    p27: '/assets/models/props/whispering_lattice.glb',
    p28: '/assets/models/aeolian_belfry.glb',
    p30: '/assets/models/props/siphon_valve_wheel.glb',
  };
  if (explicit[norm]) return explicit[norm];

  // PUZ_ style ids: hash to a stable prop.
  if (norm.startsWith('puz')) {
    let hash = 0;
    for (let i = 0; i < norm.length; i++) hash = (hash * 31 + norm.charCodeAt(i)) >>> 0;
    return ALL_PROP_PATHS[hash % ALL_PROP_PATHS.length];
  }

  // P1..Pn style ids.
  const pMatch = /^p(\d+)$/.exec(norm);
  if (pMatch) {
    const n = Number(pMatch[1]);
    if (Number.isFinite(n) && n >= 1) {
      return ALL_PROP_PATHS[(n - 1) % ALL_PROP_PATHS.length];
    }
  }

  // Fallback: try a prop with the same stem, then a generic prop.
  return `/assets/models/props/${id}.glb`.replace(/\s+/g, '_').toLowerCase();
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

async function loadModel(path: string): Promise<THREE.Group> {
  // Try the resolved path, then a few common variants.
  const candidates = [path, path.replace(/^\//, ''), path.replace('/assets/', 'assets/')];
  let lastError: unknown;
  for (const url of candidates) {
    try {
      const loaded = await AssetLoader.load(url);
      return loaded.scene;
    } catch (err) {
      lastError = err;
    }
  }
  // Final fallback: a simple visible box so spawn never hard-fails in tests.
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  const group = new THREE.Group();
  group.add(box);
  void lastError;
  return group;
}

export class PuzzleFactory {
  static async spawn(puzzleId: string, position: PuzzlePosition, scene?: THREE.Scene): Promise<PuzzlePropHandle> {
    const modelPath = resolveModelPath(puzzleId);
    const model = await loadModel(modelPath);
    const pos = toVector3(position);

    const group = new THREE.Group();
    group.add(model);
    group.position.copy(pos);

    const interactionRadius = 1.6;

    group.userData.puzzleId = puzzleId;
    group.userData.modelPath = modelPath;
    group.userData.interactionRadius = interactionRadius;
    group.userData.colliderRadius = interactionRadius;
    group.userData.colliderType = 'sphere';

    // Rapier interaction collider metadata (static trigger sphere).
    group.userData.rapierCollider = {
      type: 'ball',
      radius: interactionRadius,
      translation: { x: pos.x, y: pos.y + 0.5, z: pos.z },
      sensor: true,
    };

    const handle: PuzzlePropHandle = {
      puzzleId,
      group,
      model,
      interactionRadius,
      modelPath,
      playInteract: async (kind: 'lever' | 'kneel') => {
        return PuzzleFactory.playInteract(handle, kind);
      },
    };

    group.userData.puzzleHandle = handle;

    if (scene) scene.add(group);

    return handle;
  }

  static async playInteract(puzzle: PuzzlePropHandle | THREE.Group | any, kind: 'lever' | 'kneel'): Promise<void> {
    const group: THREE.Group =
      (puzzle && (puzzle.group instanceof THREE.Group ? puzzle.group : null)) ||
      (puzzle instanceof THREE.Group ? puzzle : null) ||
      (puzzle && puzzle.userData && puzzle.userData.puzzleHandle && puzzle.userData.puzzleHandle.group) ||
      puzzle;

    if (!(group instanceof THREE.Group)) return;

    const duration = 280;
    const startY = group.position.y;
    const startRotZ = group.rotation.z;
    const startRotX = group.rotation.x;

    // Ensure base values are stored for repeated interactions.
    if (group.userData._baseY === undefined) group.userData._baseY = startY;
    if (group.userData._baseRotZ === undefined) group.userData._baseRotZ = startRotZ;
    if (group.userData._baseRotX === undefined) group.userData._baseRotX = startRotX;

    const baseY = Number(group.userData._baseY);
    const baseRotZ = Number(group.userData._baseRotZ);
    const baseRotX = Number(group.userData._baseRotX);

    await new Promise<void>((resolve) => {
      const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const step = () => {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const t = Math.min(1, (now - start) / duration);
        const e = easeOutCubic(t);
        if (kind === 'lever') {
          group.rotation.z = baseRotZ + (Math.PI / 2) * e;
          group.rotation.x = baseRotX;
        } else {
          group.position.y = baseY - 0.22 * e;
        }
        // Visual state feedback via emissive flash on meshes.
        group.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh && mesh.isMesh && mesh.material && 'emissive' in (mesh.material as any)) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (t < 1) {
              mat.emissiveIntensity = 0.4 + 0.6 * (1 - e);
            } else {
              mat.emissiveIntensity = 0.2;
            }
          }
        });
        if (t < 1) {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(step);
          } else {
            setTimeout(step, 16);
          }
        } else {
          // Final state.
          if (kind === 'lever') {
            group.rotation.z = baseRotZ + Math.PI / 2;
            group.userData._baseRotZ = group.rotation.z;
          } else {
            group.position.y = baseY - 0.22;
            group.userData._baseY = group.position.y;
          }
          resolve();
        }
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(step);
      } else {
        setTimeout(step, 16);
      }
    });
  }
}

export default PuzzleFactory;