import * as THREE from 'three';

export type VaelorEndingId =
  | 'thiefs_contract'
  | 'mercy_of_unmaking'
  | 'new_sovereign'
  | 'awakening_of_the_mind';

export interface BossPhaseSpec {
  phase: 1 | 2 | 3;
  title: string;
  hpThreshold: number;
  attackSpeedMultiplier: number;
  abilities: string[];
  arenaEffect: string;
}

export const BOSS_THREE_PHASE_TABLE: Record<string, BossPhaseSpec[]> = {
  ENC_GH3_CAPTAIN: [
    {
      phase: 1,
      title: 'Phase I: Disciplined Bastion',
      hpThreshold: 1.0,
      attackSpeedMultiplier: 1.0,
      abilities: ['Halberd Thrust', 'Shield Wall Advance'],
      arenaEffect: 'Standard Torchlight',
    },
    {
      phase: 2,
      title: 'Phase II: Iron Juggernaut',
      hpThreshold: 0.66,
      attackSpeedMultiplier: 1.22,
      abilities: ['Flaming Overhead Cleave (Red Unblockable)', 'Shield Bash Charge'],
      arenaEffect: 'Braziers Ignite Oil Channels',
    },
    {
      phase: 3,
      title: 'Phase III: Last Stand of the Gate',
      hpThreshold: 0.33,
      attackSpeedMultiplier: 1.45,
      abilities: ['360° Halberd Whirlwind', 'Portcullis Shockwave'],
      arenaEffect: 'Counterweight Cage Primed Above Center Grate',
    },
  ],
  ENC_WIZARD_FINAL: [
    {
      phase: 1,
      title: 'Phase I: Master of Mirrors',
      hpThreshold: 1.0,
      attackSpeedMultiplier: 1.0,
      abilities: ['Arcane Bolt Volley', 'Mirror Decoy Clone Summon'],
      arenaEffect: 'Octagonal Mirror Monoliths Active',
    },
    {
      phase: 2,
      title: 'Phase II: Chronomantic Fracture',
      hpThreshold: 0.66,
      attackSpeedMultiplier: 1.28,
      abilities: ['Temporal Slow Dome', 'Rotating Mirror Beam Sweep (Roll i-Frame Required)'],
      arenaEffect: 'Astrolabe Rings Spin in Reverse-Entropy',
    },
    {
      phase: 3,
      title: 'Phase III: Shattered Veil Reality Shift',
      hpThreshold: 0.33,
      attackSpeedMultiplier: 1.55,
      abilities: ['Astral Scythe Blink', 'Meteoric Glass Storm', 'Unmaking Nova'],
      arenaEffect: 'Sanctum Shifts to Astral Void (Conduit Sabotage Available)',
    },
  ],
};

export interface VaelorEnding {
  index: 1 | 2 | 3 | 4;
  key: 'contract' | 'unmaking' | 'sovereign' | 'awakening';
  id: VaelorEndingId;
  title: string;
  description: string;
}

/** The four canonical GDD endings offered once Vaelor is unmade. */
export const VAELOR_ENDINGS: VaelorEnding[] = [
  {
    index: 1,
    key: 'contract',
    id: 'thiefs_contract',
    title: "The Thief's Contract",
    description: 'Take the commission, the coin, and the silence. Vaelor is forgotten; the guild keeps its ledger.',
  },
  {
    index: 2,
    key: 'unmaking',
    id: 'mercy_of_unmaking',
    title: 'The Mercy of Unmaking',
    description: 'Unravel the illusion gently. The man beneath the mirror is allowed to end without becoming a monument.',
  },
  {
    index: 3,
    key: 'sovereign',
    id: 'new_sovereign',
    title: 'The New Sovereign',
    description: 'Wear the hollow crown. The keep kneels, and every mirror learns your face.',
  },
  {
    index: 4,
    key: 'awakening',
    id: 'awakening_of_the_mind',
    title: 'The Awakening of the Mind',
    description: 'Break the glass and wake the sleepers. No throne remains, only the difficult morning after.',
  },
];

export interface BossHitResult {
  damageDealt: number;
  poiseDamage: number;
  guardBroken: boolean;
  isExecution: boolean;
  phaseShift: boolean;
  isDead: boolean;
  endingReady: boolean;
}

export interface BossUpdateOutcome {
  shockwaveDamage: number;
  playerHit: boolean;
  phase: 1 | 2 | 3 | 4;
  stunned: boolean;
  clonesActive: number;
}

export interface BossLoot {
  weaponId: string;
  name: string;
  claimed: boolean;
  mesh: THREE.Object3D;
}

interface Shockwave {
  mesh: THREE.Mesh;
  origin: THREE.Vector3;
  radius: number;
  maxRadius: number;
  speed: number;
  damage: number;
  hit: boolean;
}

const MAX_HP = 180;
const MAX_POISE = 120;
const BASE_SPEED = 2.6;
const STUN_DURATION = 2.5;
const EXECUTION_MULTIPLIER = 2.2;
/** Fraction of max HP at which each phase begins (index 0 = phase 1). */
const PHASE_HP_THRESHOLDS = [1, 0.75, 0.5, 0.25];
const PHASE_SPEED_MULTIPLIERS = [1, 1.35, 1.7, 2.05];
const ENDING_READY_FRACTION = 0.05;

/**
 * Archillusionist Vaelor: four-phase finale with a poise/guard-break riposte,
 * mirage clones, shieldable shockwaves and four canonical endings.
 *
 * The encounter is self-contained (mesh + timers + loot) so the arena code can
 * drive it with `update()` and react to `receivePlayerHit()` results.
 */
export class BossVaelorEncounter {
  public readonly mesh: THREE.Group;
  public readonly maxHp = MAX_HP;
  public readonly maxPoise = MAX_POISE;

  public hp = MAX_HP;
  public poise = MAX_POISE;
  public phase: 1 | 2 | 3 | 4 = 1;
  public speed = BASE_SPEED;
  public isDead = false;
  public isStunned = false;
  public stunTimer = 0;
  public endingChoiceAvailable = false;
  public selectedEnding: VaelorEnding | null = null;
  public lootDrop: BossLoot | null = null;

  public readonly clones: THREE.Mesh[] = [];
  public readonly shockwaves: Shockwave[] = [];

  private readonly body: THREE.Group;
  private readonly cloakMat: THREE.MeshStandardMaterial;
  private elapsed = 0;

  constructor(position = new THREE.Vector3(0, 0, 0)) {
    this.mesh = new THREE.Group();
    this.mesh.name = 'BossVaelor';
    this.mesh.position.copy(position);

    this.body = new THREE.Group();
    this.mesh.add(this.body);

    this.cloakMat = new THREE.MeshStandardMaterial({
      color: 0x2a1b4d,
      emissive: 0x6d28d9,
      emissiveIntensity: 0.55,
      roughness: 0.45,
      metalness: 0.2,
    });

    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 12), this.cloakMat);
    cloak.position.y = 1.1;
    this.body.add(cloak);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xe9d5ff, emissive: 0x8b5cf6, emissiveIntensity: 0.35 }),
    );
    head.position.y = 2.35;
    this.body.add(head);

    const crown = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.055, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.9, metalness: 0.8 }),
    );
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 2.62;
    this.body.add(crown);

    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x3b0764, emissive: 0x7c3aed, emissiveIntensity: 0.4 }),
    );
    staff.position.set(0.85, 1.3, 0.1);
    staff.rotation.z = -0.12;
    this.body.add(staff);

    const glass = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.4,
        transparent: true,
        opacity: 0.85,
      }),
    );
    glass.position.set(0.85, 2.62, 0.1);
    this.body.add(glass);

    const aura = new THREE.PointLight(0x8b5cf6, 2.2, 8, 2);
    aura.position.y = 1.6;
    this.mesh.add(aura);
  }

  // ------------------------------------------------------------------ combat

  public receivePlayerHit(damage: number, poiseDamage: number): BossHitResult {
    const result: BossHitResult = {
      damageDealt: 0,
      poiseDamage: 0,
      guardBroken: false,
      isExecution: false,
      phaseShift: false,
      isDead: this.isDead,
      endingReady: false,
    };
    if (this.isDead) return result;

    let dealt = Math.max(0, damage);

    if (this.isStunned) {
      // A stunned Vaelor eats a lethal riposte and recovers his full guard.
      dealt *= EXECUTION_MULTIPLIER;
      this.isStunned = false;
      this.stunTimer = 0;
      this.poise = this.maxPoise;
      result.isExecution = true;
    } else if (poiseDamage > 0) {
      const applied = Math.min(this.poise, poiseDamage);
      this.poise = Math.max(0, this.poise - poiseDamage);
      result.poiseDamage = applied;
      if (this.poise === 0) {
        this.isStunned = true;
        this.stunTimer = STUN_DURATION;
        result.guardBroken = true;
      }
    }

    this.hp = Math.max(0, this.hp - dealt);
    result.damageDealt = dealt;

    if (this.hp <= 0) {
      this.isDead = true;
      result.isDead = true;
    } else {
      this.tryPhaseShift(result);
      if (this.hp <= this.maxHp * ENDING_READY_FRACTION) {
        this.endingChoiceAvailable = true;
        result.endingReady = true;
      }
    }

    return result;
  }

  private tryPhaseShift(result: BossHitResult): void {
    const nextPhase = (this.phase + 1) as 1 | 2 | 3 | 4;
    if (nextPhase > 4) return;
    if (this.hp > this.maxHp * PHASE_HP_THRESHOLDS[nextPhase - 1]) return;

    this.phase = nextPhase;
    this.poise = this.maxPoise;
    this.speed = BASE_SPEED * PHASE_SPEED_MULTIPLIERS[nextPhase - 1];
    this.cloakMat.emissive.setHex(nextPhase >= 3 ? 0xdc2626 : 0x6d28d9);
    this.cloakMat.emissiveIntensity = 0.55 + nextPhase * 0.25;
    result.phaseShift = true;
  }

  // ------------------------------------------------------------------- ticks

  public update(
    dt: number,
    playerPosition: THREE.Vector3,
    isDodging = false,
    isBlocking = false,
  ): BossUpdateOutcome {
    this.elapsed += dt;

    if (!this.isDead) {
      this.body.position.y = Math.sin(this.elapsed * 1.6) * 0.06;
      this.body.rotation.y += dt * 0.25;
    }

    if (this.isStunned) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      if (this.stunTimer === 0) {
        this.isStunned = false;
        this.poise = this.maxPoise;
      }
    }

    let shockwaveDamage = 0;
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i];
      wave.radius += wave.speed * dt;
      const scale = Math.max(0.001, wave.radius);
      wave.mesh.scale.setScalar(scale);
      wave.mesh.position.y = 0.08;

      if (!wave.hit && wave.radius >= wave.origin.distanceTo(playerPosition)) {
        wave.hit = true;
        if (!isDodging) {
          const applied = isBlocking ? wave.damage * 0.5 : wave.damage;
          shockwaveDamage += applied;
        }
      }

      if (wave.radius >= wave.maxRadius) {
        this.removeShockwaveAt(i);
      }
    }

    return {
      shockwaveDamage,
      playerHit: shockwaveDamage > 0,
      phase: this.phase,
      stunned: this.isStunned,
      clonesActive: this.clones.length,
    };
  }

  // ---------------------------------------------------------------- mirages

  public spawnMirageClones(scene: THREE.Scene): THREE.Mesh[] {
    this.clearClones();
    for (let i = 0; i < 2; i++) {
      const angle = (Math.PI * 2 * i) / 2 + Math.PI / 2;
      const clone = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 1.8, 10),
        new THREE.MeshStandardMaterial({
          color: 0x8b5cf6,
          emissive: 0x22d3ee,
          emissiveIntensity: 0.9,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      clone.name = `VaelorMirage_${i}`;
      clone.position.set(
        this.mesh.position.x + Math.cos(angle) * 2.2,
        0.9,
        this.mesh.position.z + Math.sin(angle) * 2.2,
      );
      this.clones.push(clone);
      scene.add(clone);
    }
    return [...this.clones];
  }

  public clearClones(): void {
    for (const clone of this.clones) {
      clone.parent?.remove(clone);
      clone.geometry.dispose();
      if (Array.isArray(clone.material)) {
        for (const material of clone.material) material.dispose();
      } else {
        clone.material.dispose();
      }
    }
    this.clones.length = 0;
  }

  // ------------------------------------------------------------- shockwaves

  public spawnShockwave(scene: THREE.Scene): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 48), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.mesh.position.x, 0.08, this.mesh.position.z);

    this.shockwaves.push({
      mesh: ring,
      origin: this.mesh.position.clone(),
      radius: 1.0,
      maxRadius: 9,
      speed: 6,
      damage: 18,
      hit: false,
    });
    scene.add(ring);
    return ring;
  }

  private removeShockwaveAt(index: number): void {
    const wave = this.shockwaves[index];
    if (!wave) return;
    wave.mesh.parent?.remove(wave.mesh);
    wave.mesh.geometry.dispose();
    if (Array.isArray(wave.mesh.material)) {
      for (const material of wave.mesh.material) material.dispose();
    } else {
      wave.mesh.material.dispose();
    }
    this.shockwaves.splice(index, 1);
  }

  // ------------------------------------------------------------------- loot

  public dropBossLoot(scene: THREE.Scene): BossLoot {
    if (this.lootDrop) return this.lootDrop;

    const group = new THREE.Group();
    group.name = 'Loot_SunStaff';

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 0.8, metalness: 0.9 }),
    );
    shaft.position.y = 0.95;
    group.add(shaft);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfbbf24, emissiveIntensity: 2.2 }),
    );
    sun.position.y = 1.95;
    group.add(sun);

    const light = new THREE.PointLight(0xfbbf24, 2.4, 6, 2);
    light.position.y = 1.95;
    group.add(light);

    group.position.set(this.mesh.position.x, 0.1, this.mesh.position.z);
    scene.add(group);

    this.lootDrop = {
      weaponId: 'sun_staff',
      name: 'Sun-Staff of the Unmade Dawn',
      claimed: false,
      mesh: group,
    };
    return this.lootDrop;
  }

  // ---------------------------------------------------------------- endings

  public selectEnding(choice: number | string): VaelorEnding {
    const ending =
      typeof choice === 'number'
        ? VAELOR_ENDINGS.find((entry) => entry.index === choice)
        : VAELOR_ENDINGS.find((entry) => entry.key === choice || entry.id === choice);

    const resolved = ending ?? VAELOR_ENDINGS[0];
    this.selectedEnding = resolved;
    this.isDead = true;
    this.endingChoiceAvailable = false;
    return resolved;
  }

  public dispose(): void {
    this.clearClones();
    for (let i = this.shockwaves.length - 1; i >= 0; i--) this.removeShockwaveAt(i);
    if (this.lootDrop) {
      this.lootDrop.mesh.parent?.remove(this.lootDrop.mesh);
      this.lootDrop = null;
    }
    this.mesh.parent?.remove(this.mesh);
    this.mesh.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) {
          for (const material of node.material) material.dispose();
        } else {
          node.material.dispose();
        }
      }
    });
  }
}
