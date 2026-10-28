import * as THREE from 'three';
import type { MainCharacterRig } from './MainCharacterRig';

export type WeaponId =
  | 'hunter_blade'
  | 'glass_cleaver'
  | 'void_rapier'
  | 'sun_staff'
  | 'weapon_whisper'
  | 'weapon_mirror_blade'
  | 'weapon_shadow_claw'
  | 'weapon_void_edge'
  | 'weapon_astral_staff'
  | 'weapon_sunfire_bow';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  description: string;
  damageMultiplier: number;
  hitRadius: number;
  critChance?: number;
  staminaCost?: number;
  trailColor: number;
  trailGlowColor: number;
  baseOffset: [number, number, number];
  tipOffset: [number, number, number];
  createMesh: () => THREE.Group;
}

export interface ArmorStats {
  id: string;
  name: string;
  magicResist: number;
  physicalMitigation: number;
  staminaCostMultiplier: number;
  critChanceBonus: number;
  poiseBonus: number;
}

export const ARMOR_REGISTRY: Record<string, ArmorStats> = {
  armor_arch_robes: {
    id: 'armor_arch_robes',
    name: "Archmage's Ethereal Robes",
    magicResist: 0.15,
    physicalMitigation: 0.05,
    staminaCostMultiplier: 0.90, // -10% stamina cost
    critChanceBonus: 0.05,
    poiseBonus: 10,
  },
  armor_shadow_mail: {
    id: 'armor_shadow_mail',
    name: 'Shadowhand Brigandine Mail',
    magicResist: 0.05,
    physicalMitigation: 0.25, // +25% physical mitigation
    staminaCostMultiplier: 1.0,
    critChanceBonus: 0.10, // +10% crit
    poiseBonus: 20,
  },
  armor_astral_cuirass: {
    id: 'armor_astral_cuirass',
    name: 'Astral Sentinel Cuirass',
    magicResist: 0.20,
    physicalMitigation: 0.35, // +35% total mitigation
    staminaCostMultiplier: 1.1,
    critChanceBonus: 0.0,
    poiseBonus: 35, // +20% poise armor
  },
};

export interface EquippedWeapon {
  def: WeaponDefinition;
  group: THREE.Group;
  baseAnchor: THREE.Object3D;
  tipAnchor: THREE.Object3D;
  emissiveMeshes: THREE.Mesh[];
  pulseRunes: (intensity: number) => void;
}

export interface EquippedShield {
  group: THREE.Group;
  barrierMesh: THREE.Mesh;
  setWardActive: (active: boolean, parryFlash?: boolean) => void;
}

function mat(color: number, rough = 0.5, metal = 0.8, emissive = 0x000000, ei = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal,
    emissive,
    emissiveIntensity: ei,
  });
}

function addMesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, pos: [number, number, number], name?: string): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// 1. Hunter's Runic Blade (balanced steel & anti-arcane edge)
// ---------------------------------------------------------------------------
function buildHunterBlade(): { group: THREE.Group; emissive: THREE.Mesh[] } {
  const g = new THREE.Group();
  g.name = 'HunterBlade';
  const leather = mat(0x2d1f14, 0.9, 0.1);
  const brass = mat(0xc29b38, 0.35, 0.9);
  const steel = mat(0xa8b4c2, 0.25, 0.92);
  const runeMat = mat(0x60a5fa, 0.2, 0.9, 0x38bdf8, 2.2);

  addMesh(g, new THREE.CylinderGeometry(0.019, 0.019, 0.22, 8), leather, [0, 0, 0], 'Grip');
  addMesh(g, new THREE.SphereGeometry(0.03, 8, 8), brass, [0, -0.11, 0], 'Pommel');
  addMesh(g, new THREE.BoxGeometry(0.24, 0.035, 0.05), brass, [0, 0.11, 0], 'Guard');
  const blade = addMesh(g, new THREE.BoxGeometry(0.052, 0.92, 0.014), steel, [0, 0.58, 0], 'Blade');
  const rune = addMesh(g, new THREE.BoxGeometry(0.018, 0.72, 0.018), runeMat, [0, 0.56, 0], 'RuneCore');
  addMesh(g, new THREE.ConeGeometry(0.026, 0.12, 4), steel, [0, 1.1, 0], 'Tip').rotation.y = Math.PI / 4;

  return { group: g, emissive: [rune, blade] };
}

// ---------------------------------------------------------------------------
// 2. Aether Glass Cleaver (heavy crystalline executioner prism)
// ---------------------------------------------------------------------------
function buildGlassCleaver(): { group: THREE.Group; emissive: THREE.Mesh[] } {
  const g = new THREE.Group();
  g.name = 'GlassCleaver';
  const obsidian = mat(0x18181b, 0.2, 0.9);
  const silver = mat(0xe2e8f0, 0.2, 0.95);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x5eead4,
    emissive: 0x14b8a6,
    emissiveIntensity: 1.8,
    roughness: 0.1,
    metalness: 0.1,
    transmission: 0.5,
    thickness: 0.08,
    transparent: true,
    opacity: 0.92,
  });

  addMesh(g, new THREE.CylinderGeometry(0.022, 0.02, 0.26, 8), obsidian, [0, 0, 0], 'Grip');
  addMesh(g, new THREE.BoxGeometry(0.28, 0.045, 0.06), silver, [0, 0.14, 0], 'CrossGuard');
  const cleaverBlade = addMesh(g, new THREE.BoxGeometry(0.12, 1.12, 0.02), glassMat, [0.03, 0.72, 0], 'CleaverPrism');
  const coreRune = addMesh(g, new THREE.CylinderGeometry(0.016, 0.016, 0.85, 6), mat(0x2dd4bf, 0.1, 0, 0x2dd4bf, 3.0), [0.03, 0.72, 0], 'AetherVein');

  return { group: g, emissive: [cleaverBlade, coreRune] };
}

// ---------------------------------------------------------------------------
// 3. Astral Void Rapier (slender needle with orbital ring)
// ---------------------------------------------------------------------------
function buildVoidRapier(): { group: THREE.Group; emissive: THREE.Mesh[] } {
  const g = new THREE.Group();
  g.name = 'VoidRapier';
  const voidSteel = mat(0x2e1065, 0.3, 0.9);
  const gold = mat(0xfacc15, 0.3, 0.9);
  const voidEdge = mat(0xc084fc, 0.15, 0.95, 0xa855f7, 2.5);

  addMesh(g, new THREE.CylinderGeometry(0.015, 0.015, 0.2, 8), voidSteel, [0, 0, 0], 'Grip');
  const basket = addMesh(g, new THREE.TorusGeometry(0.07, 0.012, 8, 16), gold, [0, 0.09, 0], 'Basket');
  basket.rotation.x = Math.PI / 2;
  const rapierBlade = addMesh(g, new THREE.CylinderGeometry(0.006, 0.018, 0.98, 8), voidEdge, [0, 0.6, 0], 'RapierNeedle');
  addMesh(g, new THREE.ConeGeometry(0.008, 0.08, 6), voidEdge, [0, 1.12, 0], 'RapierTip');

  return { group: g, emissive: [rapierBlade] };
}

// ---------------------------------------------------------------------------
// 4. Gilded Sun-Staff (solar battle-stave / crescent khopesh)
// ---------------------------------------------------------------------------
function buildSunStaff(): { group: THREE.Group; emissive: THREE.Mesh[] } {
  const g = new THREE.Group();
  g.name = 'SunStaff';
  const carvedWood = mat(0x451a03, 0.85, 0.1);
  const sunGold = mat(0xf59e0b, 0.25, 0.9);
  const sunCore = mat(0xfde047, 0.1, 0.2, 0xfbbf24, 3.2);

  addMesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.36, 8), carvedWood, [0, 0, 0], 'Shaft');
  addMesh(g, new THREE.BoxGeometry(0.18, 0.04, 0.04), sunGold, [0, 0.18, 0], 'SolarRing');
  const head = addMesh(g, new THREE.TorusGeometry(0.12, 0.02, 8, 20, Math.PI * 1.5), sunGold, [0, 0.55, 0], 'SunCrescent');
  head.rotation.z = Math.PI / 4;
  const orb = addMesh(g, new THREE.SphereGeometry(0.055, 12, 12), sunCore, [0, 0.55, 0], 'SunOrb');
  const spearTip = addMesh(g, new THREE.ConeGeometry(0.024, 0.35, 6), sunGold, [0, 0.88, 0], 'SunSpearTip');

  return { group: g, emissive: [orb, spearTip] };
}

// ---------------------------------------------------------------------------
// 5. Harmonic Ward Aegis (Shield mounted on LeftLowerArm)
// ---------------------------------------------------------------------------
export function buildRunicShield(): EquippedShield {
  const g = new THREE.Group();
  g.name = 'HarmonicAegis';
  const darkMetal = mat(0x1e293b, 0.4, 0.85);
  const goldTrim = mat(0xd97706, 0.3, 0.9);
  const crystalMat = mat(0x60a5fa, 0.15, 0.5, 0x3b82f6, 1.8);

  // Buckler baseplate
  addMesh(g, new THREE.CylinderGeometry(0.16, 0.18, 0.035, 6), darkMetal, [0, 0, 0], 'ShieldPlate');
  addMesh(g, new THREE.TorusGeometry(0.18, 0.015, 6, 6), goldTrim, [0, 0.01, 0], 'ShieldTrim').rotation.x = Math.PI / 2;
  addMesh(g, new THREE.OctahedronGeometry(0.055), crystalMat, [0, 0.04, 0], 'WardCrystal');

  // Translucent harmonic energy barrier (scaled up and visible during block/parry)
  const barrierGeo = new THREE.CircleGeometry(0.48, 6);
  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const barrierMesh = new THREE.Mesh(barrierGeo, barrierMat);
  barrierMesh.name = 'HarmonicBarrier';
  barrierMesh.position.set(0, 0.12, 0);
  barrierMesh.rotation.x = -Math.PI / 2;
  barrierMesh.visible = false;
  g.add(barrierMesh);

  // Offset so it straps neatly onto the outside of the left forearm
  g.position.set(0.08, -0.12, 0.04);
  g.rotation.set(0, 0, Math.PI / 2);

  const setWardActive = (active: boolean, parryFlash = false) => {
    barrierMesh.visible = active || parryFlash;
    if (active) {
      barrierMat.opacity = parryFlash ? 0.9 : 0.55;
      barrierMat.emissiveIntensity = parryFlash ? 4.0 : 1.8;
      crystalMat.emissiveIntensity = parryFlash ? 5.0 : 2.5;
      barrierMesh.scale.setScalar(parryFlash ? 1.25 : 1.0);
    } else {
      barrierMat.opacity = 0;
      crystalMat.emissiveIntensity = 1.8;
      barrierMesh.scale.setScalar(1.0);
    }
  };

  return { group: g, barrierMesh, setWardActive };
}

// ---------------------------------------------------------------------------
// Weapon Arsenal Registry
// ---------------------------------------------------------------------------
export const WEAPON_REGISTRY: Record<WeaponId, WeaponDefinition> = {
  hunter_blade: {
    id: 'hunter_blade',
    name: "Rune-Etched Hunter's Blade",
    description: 'Standard-issue anti-arcane edge. Balanced speed, reach, and kinetic slice.',
    damageMultiplier: 1.0,
    hitRadius: 0.42,
    trailColor: 0x38bdf8,
    trailGlowColor: 0x0284c7,
    baseOffset: [0, 0.12, 0],
    tipOffset: [0, 1.15, 0],
    createMesh: () => buildHunterBlade().group,
  },
  glass_cleaver: {
    id: 'glass_cleaver',
    name: 'Aether Glass Cleaver',
    description: 'Heavy executioner prism. Slower swings with devastating cleaved reach.',
    damageMultiplier: 1.35,
    hitRadius: 0.56,
    trailColor: 0x2dd4bf,
    trailGlowColor: 0x059669,
    baseOffset: [0.03, 0.15, 0],
    tipOffset: [0.03, 1.35, 0],
    createMesh: () => buildGlassCleaver().group,
  },
  void_rapier: {
    id: 'void_rapier',
    name: 'Astral Void Rapier',
    description: 'Needle-point rapier forged from void meteorite. Rapid strikes with piercing crits.',
    damageMultiplier: 0.9,
    hitRadius: 0.38,
    trailColor: 0xc084fc,
    trailGlowColor: 0x7c3aed,
    baseOffset: [0, 0.1, 0],
    tipOffset: [0, 1.18, 0],
    createMesh: () => buildVoidRapier().group,
  },
  sun_staff: {
    id: 'sun_staff',
    name: 'Gilded Sun Khopesh-Staff',
    description: 'Solar battle-stave with crescent focus orb. Radiates searing arcane light.',
    damageMultiplier: 1.2,
    hitRadius: 0.48,
    trailColor: 0xfbbf24,
    trailGlowColor: 0xd97706,
    baseOffset: [0, 0.18, 0],
    tipOffset: [0, 1.05, 0],
    createMesh: () => buildSunStaff().group,
  },
  weapon_whisper: {
    id: 'weapon_whisper',
    name: 'Whisper (Silent Silver Edge)',
    description: "Kaelen's signature silent foil. Balanced speed, reach, and kinetic slice.",
    damageMultiplier: 1.0,
    hitRadius: 0.42,
    critChance: 0.15,
    staminaCost: 10,
    trailColor: 0x38bdf8,
    trailGlowColor: 0x0284c7,
    baseOffset: [0, 0.12, 0],
    tipOffset: [0, 1.15, 0],
    createMesh: () => buildHunterBlade().group,
  },
  weapon_mirror_blade: {
    id: 'weapon_mirror_blade',
    name: 'Mirror Blade of the Keep',
    description: 'Crystalline cleaver reflecting enemy enchantments back upon their casters.',
    damageMultiplier: 1.35,
    hitRadius: 0.56,
    critChance: 0.12,
    staminaCost: 16,
    trailColor: 0x2dd4bf,
    trailGlowColor: 0x059669,
    baseOffset: [0.03, 0.15, 0],
    tipOffset: [0.03, 1.35, 0],
    createMesh: () => buildGlassCleaver().group,
  },
  weapon_shadow_claw: {
    id: 'weapon_shadow_claw',
    name: 'Shadow Claw of the Cutpurse',
    description: 'Hooked steel claw with serrated edges for rapid counter-hit staggering.',
    damageMultiplier: 1.1,
    hitRadius: 0.38,
    critChance: 0.25,
    staminaCost: 8,
    trailColor: 0xc084fc,
    trailGlowColor: 0x7c3aed,
    baseOffset: [0, 0.1, 0],
    tipOffset: [0, 1.18, 0],
    createMesh: () => buildVoidRapier().group,
  },
  weapon_void_edge: {
    id: 'weapon_void_edge',
    name: 'Void Edge Greatsword',
    description: 'Heavy two-handed meteorite greatsword that cleaves through illusion barrier wards.',
    damageMultiplier: 1.6,
    hitRadius: 0.65,
    critChance: 0.20,
    staminaCost: 24,
    trailColor: 0xa855f7,
    trailGlowColor: 0x6b21a8,
    baseOffset: [0, 0.15, 0],
    tipOffset: [0, 1.45, 0],
    createMesh: () => buildGlassCleaver().group,
  },
  weapon_astral_staff: {
    id: 'weapon_astral_staff',
    name: 'Astral Battle Staff',
    description: 'Focus staff aligning celestial constellations to unleash starlight pulses.',
    damageMultiplier: 1.25,
    hitRadius: 0.50,
    critChance: 0.18,
    staminaCost: 14,
    trailColor: 0x818cf8,
    trailGlowColor: 0x4f46e5,
    baseOffset: [0, 0.18, 0],
    tipOffset: [0, 1.10, 0],
    createMesh: () => buildSunStaff().group,
  },
  weapon_sunfire_bow: {
    id: 'weapon_sunfire_bow',
    name: 'Sunfire Radiant Khopesh',
    description: 'Gilded solar armament firing searing sunfire projectile arcs.',
    damageMultiplier: 1.3,
    hitRadius: 0.48,
    critChance: 0.22,
    staminaCost: 15,
    trailColor: 0xfbbf24,
    trailGlowColor: 0xd97706,
    baseOffset: [0, 0.18, 0],
    tipOffset: [0, 1.12, 0],
    createMesh: () => buildSunStaff().group,
  },
};

export const WEAPON_IDS: WeaponId[] = ['hunter_blade', 'glass_cleaver', 'void_rapier', 'sun_staff'];

/**
 * Mount a weapon from the registry onto the character's weaponSocket (hand_r_socket).
 * Repositions HitboxAnchor and adds base/tip anchors for weapon trail tracking.
 */
export function equipWeapon(rig: MainCharacterRig, weaponId: WeaponId): EquippedWeapon {
  const def = WEAPON_REGISTRY[weaponId] ?? WEAPON_REGISTRY.hunter_blade;

  // Clear existing attached weapon models from weaponSocket (preserve hitboxAnchor)
  const toRemove: THREE.Object3D[] = [];
  for (const child of rig.weaponSocket.children) {
    if (child.name !== 'HitboxAnchor' && child.name !== 'SpellOrigin') {
      toRemove.push(child);
    }
  }
  for (const child of toRemove) {
    rig.weaponSocket.remove(child);
  }

  // Build and attach the new weapon group
  const group = def.createMesh();
  rig.weaponSocket.add(group);

  // Position base and tip markers inside the weapon socket
  let baseAnchor = rig.weaponSocket.getObjectByName('WeaponBaseAnchor');
  if (!baseAnchor) {
    baseAnchor = new THREE.Object3D();
    baseAnchor.name = 'WeaponBaseAnchor';
    rig.weaponSocket.add(baseAnchor);
  }
  baseAnchor.position.set(...def.baseOffset);

  let tipAnchor = rig.weaponSocket.getObjectByName('WeaponTipAnchor');
  if (!tipAnchor) {
    tipAnchor = new THREE.Object3D();
    tipAnchor.name = 'WeaponTipAnchor';
    rig.weaponSocket.add(tipAnchor);
  }
  tipAnchor.position.set(...def.tipOffset);

  // Align hitboxAnchor to the mid-blade/tip for accurate sweep
  rig.hitboxAnchor.position.set(
    (def.baseOffset[0] + def.tipOffset[0]) * 0.5,
    (def.baseOffset[1] + def.tipOffset[1]) * 0.5,
    (def.baseOffset[2] + def.tipOffset[2]) * 0.5,
  );

  const emissiveMeshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).material) {
      emissiveMeshes.push(o as THREE.Mesh);
    }
  });

  const pulseRunes = (intensity: number) => {
    for (const m of emissiveMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive && mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = intensity;
      }
    }
  };

  return {
    def,
    group,
    baseAnchor,
    tipAnchor,
    emissiveMeshes,
    pulseRunes,
  };
}

/**
 * Mount the runic ward shield onto the character's LeftLowerArm / socket_hand_l bone.
 */
export function equipShield(rig: MainCharacterRig): EquippedShield {
  const mountParent = rig.group.getObjectByName('socket_hand_l')
    ?? rig.bones.LeftLowerArm.getObjectByName('socket_hand_l')
    ?? rig.bones.LeftLowerArm;

  const existing = mountParent.getObjectByName('HarmonicAegis') ?? rig.bones.LeftLowerArm.getObjectByName('HarmonicAegis');
  if (existing) {
    existing.removeFromParent();
  }
  const shield = buildRunicShield();
  mountParent.add(shield.group);
  return shield;
}

/**
 * Stow a two-handed weapon on the character's back (socket_back).
 */
export function stowWeaponOnBack(rig: MainCharacterRig, weaponId: WeaponId): THREE.Group {
  const backSocket = rig.group.getObjectByName('socket_back')
    ?? rig.bones.Chest.getObjectByName('socket_back')
    ?? rig.bones.Chest;

  const existing = backSocket.getObjectByName('StowedWeapon');
  if (existing) existing.removeFromParent();

  const def = WEAPON_REGISTRY[weaponId] ?? WEAPON_REGISTRY.hunter_blade;
  const mesh = def.createMesh();
  mesh.name = 'StowedWeapon';
  mesh.rotation.set(0, 0, Math.PI / 4);
  mesh.position.set(0, 0, 0);
  mesh.scale.setScalar(0.9);
  backSocket.add(mesh);
  return mesh;
}
