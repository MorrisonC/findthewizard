import * as THREE from 'three';
import { AssetLoader } from '../core/AssetLoader';

export const PLAYER_CLIP_NAMES = [
  'Idle',
  'Run',
  'Sprint_Stealth',
  'Attack_Combo_1_3',
  'Dodge_Roll',
  'Cast_Illusion',
  'Hit_React',
  'Stagger_Heavy',
  'Death',
  'Interact_Kneel',
  'Interact_Lever',
  'AirDash_Starlight',
  'WallLeap',
  'MirrorPhase_Enter',
  'MirrorPhase_Exit',
  'Parley_Gesture',
] as const;

export type PlayerClipName = (typeof PLAYER_CLIP_NAMES)[number];

export const PLAYER_SOCKET_NAMES = [
  'socket_hand_r',
  'socket_hand_l',
  'socket_spell_origin',
  'socket_chest',
  'socket_back',
] as const;

export type PlayerSocketName = (typeof PLAYER_SOCKET_NAMES)[number];

export interface PlayerCharacterHandle {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  sockets: Record<PlayerSocketName, THREE.Object3D | null>;
  clips: string[];
  playClip: (name: string, fade?: number) => void;
  attachItem: (socketName: string, itemGlbUrl: string) => Promise<void>;
}

function originToUrl(originId: string): string {
  const key = (originId ?? '').toLowerCase();
  if (key.includes('alchemist')) return '/assets/models/kaelen_alchemist.glb';
  if (key.includes('charlatan')) return '/assets/models/kaelen_charlatan.glb';
  if (key.includes('enforcer')) return '/assets/models/kaelen_enforcer.glb';
  if (key.includes('antiquarian')) return '/assets/models/kaelen_antiquarian.glb';
  return '/assets/models/kaelen.glb';
}

export async function loadPlayerCharacter(originId: string): Promise<PlayerCharacterHandle> {
  const url = originToUrl(originId);
  const loaded = await AssetLoader.load(url);

  const root = loaded.scene;
  const mixer = new THREE.AnimationMixer(root);

  // Register clips (all available in the GLB; missing ones are simply skipped).
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of loaded.animations) {
    const action = mixer.clipAction(clip);
    actions.set(clip.name, action);
  }

  // Sockets resolution with canonical bone fallbacks
  const resolveSocket = (name: PlayerSocketName): THREE.Object3D | null => {
    let found = root.getObjectByName(name);
    if (found) return found;

    if (name === 'socket_hand_r') {
      found = root.getObjectByName('hand_r_socket')
        ?? root.getObjectByName('WeaponSocket')
        ?? root.getObjectByName('hand_r')
        ?? root.getObjectByName('RightHand');
    } else if (name === 'socket_hand_l') {
      found = root.getObjectByName('hand_l')
        ?? root.getObjectByName('LeftHand')
        ?? root.getObjectByName('LeftLowerArm')
        ?? root.getObjectByName('forearm_l');
    } else if (name === 'socket_spell_origin') {
      found = root.getObjectByName('SpellOrigin')
        ?? root.getObjectByName('socket_hand_l')
        ?? root.getObjectByName('LeftHand');
    } else if (name === 'socket_chest') {
      found = root.getObjectByName('Chest') ?? root.getObjectByName('chest');
    } else if (name === 'socket_back') {
      found = root.getObjectByName('BackSocket') ?? root.getObjectByName('back');
      if (!found) {
        const chest = root.getObjectByName('Chest') ?? root.getObjectByName('chest') ?? root;
        const b = new THREE.Object3D();
        b.name = 'socket_back';
        b.position.set(0, 0.15, -0.15);
        b.rotation.set(0, Math.PI, 0);
        chest.add(b);
        found = b;
      }
    }
    return found ?? null;
  };

  const sockets = {} as Record<PlayerSocketName, THREE.Object3D | null>;
  for (const name of PLAYER_SOCKET_NAMES) {
    sockets[name] = resolveSocket(name);
  }

  let currentAction: THREE.AnimationAction | null = null;
  const playClip = (name: string, fade = 0.15): void => {
    const action = actions.get(name);
    if (!action) return;
    if (action === currentAction) return;
    if (currentAction) currentAction.fadeOut(fade);
    action.reset().fadeIn(fade).play();
    currentAction = action;
  };

  const attachItem = async (socketName: string, itemGlbUrl: string): Promise<void> => {
    const socket = sockets[socketName as PlayerSocketName]
      ?? resolveSocket(socketName as PlayerSocketName)
      ?? root.getObjectByName(socketName);
    if (!socket) return;
    // Clear previous attachments
    while (socket.children.length) socket.remove(socket.children[0]);
    const candidates = [
      itemGlbUrl,
      itemGlbUrl.replace(/^\//, ''),
      `/assets/models/items/${itemGlbUrl.split('/').pop()}`,
      `assets/models/items/${itemGlbUrl.split('/').pop()}`,
    ];
    let loadedItem: any = null;
    for (const url of candidates) {
      try {
        loadedItem = await AssetLoader.load(url);
        break;
      } catch {
        // try next
      }
    }
    if (loadedItem) {
      socket.add(loadedItem.scene);
    }
  };

  // Kick off idle if present
  if (actions.has('Idle')) playClip('Idle', 0);

  return {
    root,
    mixer,
    sockets,
    clips: loaded.animations.map((c) => c.name),
    playClip,
    attachItem,
  };
}

export default loadPlayerCharacter;