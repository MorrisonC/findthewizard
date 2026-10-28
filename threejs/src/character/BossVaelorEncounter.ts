import * as THREE from 'three';
import { POISE_CONSTANTS } from './EnemyCombatAI';

export type VaelorEndingId =
  | 'thiefs_contract'
  | 'mercy_of_unmaking'
  | 'new_sovereign'
  | 'awakening_of_the_mind';

export interface EndingOption {
  id: VaelorEndingId;
  title: string;
  description: string;
  requiresAllMemoryShards?: boolean;
}

export const VAELOR_ENDINGS: EndingOption[] = [
  {
    id: 'thiefs_contract',
    title: "Ending 1: The Thief's Contract",
    description: 'Steal ITEM_HEART_OF_MIRRORS for Guildmaster Sable and escape Veilkeep into the winter night.',
  },
  {
    id: 'mercy_of_unmaking',
    title: 'Ending 2: The Mercy of Unmaking',
    description: "Shatter the Heart of Mirrors with Whisper to fulfill Lady Cynthia's final wish.",
  },
  {
    id: 'new_sovereign',
    title: 'Ending 3: The New Sovereign',
    description: "Claim the Astral Staff and take Vaelor's place at the illusion loom of Veilkeep.",
  },
  {
    id: 'awakening_of_the_mind',
    title: 'Ending 4: The Awakening of the Mind',
    description: 'Reconcile all 7 Memory Shards to release Cynthia, Vaelor, and Veilkeep from the 80-winter loop.',
    requiresAllMemoryShards: true,
  },
];

export interface BossShockwave {
  mesh: THREE.Mesh;
  radius: number;
  maxRadius: number;
  speed: number;
  hasHitPlayer: boolean;
}

export interface BossLootDrop {
  group: THREE.Group;
  weaponId: string;
  position: THREE.Vector3;
  claimed: boolean;
  beaconLight: THREE.PointLight;
}

export class BossVaelorEncounter {
  public mesh: THREE.Group;
  public phase: 1 | 2 | 3 | 4 = 1;
  public hp = 180;
  public maxHp = 180;
  public poise = 120;
  public maxPoise = 120;
  public isStunned = false;
  public stunTimer = 0;
  public poiseRegenTimer = 0;
  public windupTimer = 0;
  public cooldown = 1.0;
  public speed = 2.4;
  public shockwaveTimer = 4.5;
  public isDead = false;

  // 4-Phase Sanctum mechanics & 4-Ending choice state
  public truthLensActive = false;
  public gravityTiltAngle = 0;
  public endingModalOpen = false;
  public selectedEnding: VaelorEndingId | null = null;
  public clones: THREE.Group[] = [];
  public starlightBeams: THREE.Mesh[] = [];
  public steamTelegraphs: THREE.Mesh[] = [];
  public tetherBeam: THREE.Mesh | null = null;
  public shockwaves: BossShockwave[] = [];
  public lootDrop: BossLootDrop | null = null;

  private robeMesh: THREE.Mesh | null = null;
  private haloMesh: THREE.Mesh | null = null;
  private bossLight: THREE.PointLight | null = null;

  constructor(position = new THREE.Vector3(0, 1.2, -3.2)) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.buildBossModel();
  }

  private buildBossModel(): void {
    const robeMat = new THREE.MeshStandardMaterial({
      color: 0x2e1065,
      emissive: 0x4338ca,
      emissiveIntensity: 0.9,
      roughness: 0.3,
      metalness: 0.2,
    });
    this.robeMesh = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 12), robeMat);
    this.robeMesh.castShadow = true;
    this.mesh.add(this.robeMesh);

    const haloMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true });
    this.haloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), haloMat);
    this.haloMesh.position.set(0, 1.05, 0);
    this.haloMesh.rotation.x = Math.PI / 2;
    this.mesh.add(this.haloMesh);

    const maskMat = new THREE.MeshStandardMaterial({
      color: 0xe0e7ff,
      emissive: 0x6366f1,
      emissiveIntensity: 0.6,
      metalness: 0.95,
      roughness: 0.08,
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), maskMat);
    head.position.set(0, 0.85, 0);
    this.mesh.add(head);

    this.bossLight = new THREE.PointLight(0x818cf8, 2.8, 9);
    this.bossLight.position.set(0, 1.1, 0);
    this.mesh.add(this.bossLight);
  }

  public setTruthLensActive(active: boolean): void {
    this.truthLensActive = active;
    if (this.robeMesh) {
      const mat = this.robeMesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(active ? 0x38bdf8 : this.phase >= 2 ? 0xec4899 : 0x4338ca);
      mat.emissiveIntensity = active ? 1.6 : 0.9;
    }
    for (const clone of this.clones) {
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          (child.material as THREE.MeshStandardMaterial).opacity = active ? 0.2 : 0.65;
        }
      });
    }
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    isDodging: boolean,
    isBlocking: boolean,
  ): { shockwaveDamage: number; playerHitOutcome?: 'hit' | 'blocked' | 'evaded' } {
    if (this.isDead) {
      if (this.lootDrop && !this.lootDrop.claimed) {
        this.lootDrop.group.rotation.y += dt * 1.5;
        this.lootDrop.beaconLight.intensity = 2.0 + Math.sin(Date.now() * 0.005) * 0.8;
      }
      return { shockwaveDamage: 0 };
    }

    if (this.haloMesh) {
      this.haloMesh.rotation.z += dt * (this.phase >= 2 ? 3.0 : 1.2);
    }

    // Rotate Phase 2 refracted starlight beams
    for (const beam of this.starlightBeams) {
      beam.rotation.y += dt * 0.85;
    }

    // Smoothly slerp Phase 3 Escher gravity tilt
    if (this.phase === 3) {
      this.gravityTiltAngle = THREE.MathUtils.lerp(this.gravityTiltAngle, Math.PI / 12, dt * 2.0);
    } else if (this.phase === 4) {
      this.gravityTiltAngle = THREE.MathUtils.lerp(this.gravityTiltAngle, 0, dt * 3.0);
    }

    if (this.isStunned) {
      this.stunTimer -= dt;
      this.mesh.rotation.z = Math.sin(this.stunTimer * 12) * 0.12;
      if (this.stunTimer <= 0) {
        this.isStunned = false;
        this.poise = this.maxPoise;
        this.mesh.rotation.z = 0;
      }
      return { shockwaveDamage: 0 };
    }

    if (this.poiseRegenTimer > 0) {
      this.poiseRegenTimer -= dt;
    } else if (this.poise < this.maxPoise) {
      this.poise = Math.min(this.maxPoise, this.poise + POISE_CONSTANTS.POISE_REGEN_RATE * 1.2 * dt);
    }

    if (this.cooldown > 0) this.cooldown -= dt;
    this.shockwaveTimer -= dt;

    if (this.shockwaveTimer <= 0 && this.mesh.parent) {
      this.spawnShockwave(this.mesh.parent);
      this.shockwaveTimer = this.phase >= 2 ? 3.2 : 5.0;
    }

    let totalShockwaveDmg = 0;
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      sw.mesh.scale.set(sw.radius, sw.radius, 1);

      const progress = sw.radius / sw.maxRadius;
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1.0 - progress);

      const distToPlayer = Math.hypot(
        sw.mesh.position.x - playerPos.x,
        sw.mesh.position.z - playerPos.z,
      );
      if (!sw.hasHitPlayer && Math.abs(distToPlayer - sw.radius) < 0.65) {
        sw.hasHitPlayer = true;
        if (!isDodging) {
          totalShockwaveDmg += isBlocking ? 5 : 16;
        }
      }

      if (sw.radius >= sw.maxRadius) {
        sw.mesh.geometry.dispose();
        (sw.mesh.material as THREE.Material).dispose();
        sw.mesh.parent?.remove(sw.mesh);
        this.shockwaves.splice(i, 1);
      }
    }

    for (const clone of this.clones) {
      clone.rotation.y = this.mesh.rotation.y;
      clone.position.y = 1.2 + Math.sin(Date.now() * 0.004 + clone.position.x) * 0.1;
    }

    return { shockwaveDamage: totalShockwaveDmg };
  }

  public spawnShockwave(parent: THREE.Object3D): void {
    const geom = new THREE.RingGeometry(0.1, 0.45, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: this.phase >= 2 ? 0xec4899 : 0x818cf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(geom, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(this.mesh.position.x, 0.08, this.mesh.position.z);
    parent.add(ring);

    this.shockwaves.push({
      mesh: ring,
      radius: 0.4,
      maxRadius: 5.5,
      speed: 4.2,
      hasHitPlayer: false,
    });
  }

  public spawnMirageClones(parent: THREE.Object3D, count = 4): void {
    this.clearClones();
    const offsets = [
      new THREE.Vector3(-2.8, 1.2, -2.6),
      new THREE.Vector3(2.8, 1.2, -2.6),
      new THREE.Vector3(-2.8, 1.2, 2.2),
      new THREE.Vector3(2.8, 1.2, 2.2),
    ].slice(0, count);

    for (let i = 0; i < offsets.length; i++) {
      const cloneGroup = new THREE.Group();
      cloneGroup.position.copy(offsets[i]);
      cloneGroup.name = `vaelor_clone_${i}`;

      const cloneMat = new THREE.MeshStandardMaterial({
        color: 0x4338ca,
        emissive: 0x818cf8,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: this.truthLensActive ? 0.2 : 0.65,
        wireframe: true,
      });
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 8), cloneMat);
      robe.castShadow = false; // Clones never cast shadows; only the true Vaelor casts a shadow
      cloneGroup.add(robe);

      parent.add(cloneGroup);
      this.clones.push(cloneGroup);
    }
  }

  public spawnPhantasmLaserBeams(parent: THREE.Object3D): void {
    for (const b of this.starlightBeams) {
      b.geometry.dispose();
      (b.material as THREE.Material).dispose();
      b.parent?.remove(b);
    }
    this.starlightBeams = [];
    for (let i = 0; i < 2; i++) {
      const geom = new THREE.CylinderGeometry(0.06, 0.06, 10, 12);
      geom.rotateZ(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.7,
      });
      const beam = new THREE.Mesh(geom, mat);
      beam.position.set(this.mesh.position.x, 0.9, this.mesh.position.z);
      beam.rotation.y = (i * Math.PI) / 2;
      parent.add(beam);
      this.starlightBeams.push(beam);
    }
  }

  public spawnSteamVentTelegraphs(parent: THREE.Object3D): void {
    for (const t of this.steamTelegraphs) {
      t.geometry.dispose();
      (t.material as THREE.Material).dispose();
      t.parent?.remove(t);
    }
    this.steamTelegraphs = [];
    const positions = [
      new THREE.Vector3(-2.2, 0.05, -1.5),
      new THREE.Vector3(2.2, 0.05, -1.5),
      new THREE.Vector3(0, 0.05, 1.8),
    ];
    for (const pos of positions) {
      const geom = new THREE.RingGeometry(0.2, 1.3, 24);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      });
      const decal = new THREE.Mesh(geom, mat);
      decal.rotation.x = -Math.PI / 2;
      decal.position.copy(pos);
      parent.add(decal);
      this.steamTelegraphs.push(decal);
    }
  }

  public clearClones(): void {
    for (const c of this.clones) {
      c.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      });
      c.parent?.remove(c);
    }
    this.clones = [];
  }

  public getAvailableEndings(memoryShardCount = 0): EndingOption[] {
    return VAELOR_ENDINGS.filter((e) => !e.requiresAllMemoryShards || memoryShardCount >= 7);
  }

  public selectEnding(endingId: VaelorEndingId): EndingOption | undefined {
    this.selectedEnding = endingId;
    this.endingModalOpen = false;
    return VAELOR_ENDINGS.find((e) => e.id === endingId);
  }

  public receivePlayerHit(
    damage: number,
    poiseDamage: number,
  ): {
    phaseShift: boolean;
    guardBroken: boolean;
    isExecution: boolean;
    isDead: boolean;
    damageDealt: number;
    endingTriggered?: boolean;
  } {
    if (this.isDead) {
      return { phaseShift: false, guardBroken: false, isExecution: false, isDead: true, damageDealt: 0 };
    }

    let isExecution = false;
    let actualDmg = damage;

    if (this.isStunned) {
      isExecution = true;
      actualDmg = Math.round(damage * 2.2);
      this.hp -= actualDmg;
      this.isStunned = false;
      this.stunTimer = 0;
      this.poise = this.maxPoise;
      this.mesh.rotation.z = 0;
    } else {
      this.hp -= actualDmg;
      this.poise = Math.max(0, this.poise - poiseDamage);
      this.poiseRegenTimer = 3.0;

      if (this.poise <= 0) {
        this.isStunned = true;
        this.stunTimer = 2.5;
        this.windupTimer = 0;
        return {
          phaseShift: false,
          guardBroken: true,
          isExecution: false,
          isDead: this.hp <= 0,
          damageDealt: actualDmg,
        };
      }
    }

    if (this.hp <= this.maxHp * 0.05) {
      this.endingModalOpen = true;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.endingModalOpen = true;
      this.clearClones();
      return {
        phaseShift: false,
        guardBroken: false,
        isExecution,
        isDead: true,
        damageDealt: actualDmg,
        endingTriggered: true,
      };
    }

    let phaseShift = false;
    const hpRatio = this.hp / this.maxHp;

    // Preserve <= 50% HP phaseShift contract for unit tests while supporting 4 distinct phases
    if (this.phase === 1 && hpRatio <= 0.5) {
      this.phase = 2;
      phaseShift = true;
      this.speed = 3.4;
      this.poise = this.maxPoise;
      if (this.robeMesh) {
        (this.robeMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0xec4899);
      }
      if (this.bossLight) {
        this.bossLight.color.setHex(0xec4899);
        this.bossLight.intensity = 3.6;
      }
      if (this.mesh.parent) {
        this.spawnPhantasmLaserBeams(this.mesh.parent);
      }
    } else if (this.phase === 2 && hpRatio <= 0.35) {
      this.phase = 3;
      phaseShift = true;
      this.speed = 3.8;
      if (this.mesh.parent) {
        this.spawnSteamVentTelegraphs(this.mesh.parent);
      }
    } else if (this.phase === 3 && hpRatio <= 0.2) {
      this.phase = 4;
      phaseShift = true;
      this.clearClones();
      if (this.robeMesh) {
        (this.robeMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x38bdf8);
      }
    }

    return {
      phaseShift,
      guardBroken: false,
      isExecution,
      isDead: false,
      damageDealt: actualDmg,
      endingTriggered: this.endingModalOpen,
    };
  }

  public dropBossLoot(parent: THREE.Object3D): BossLootDrop {
    const group = new THREE.Group();
    group.position.set(this.mesh.position.x, 0.4, this.mesh.position.z);

    const beaconLight = new THREE.PointLight(0xfacc15, 3.5, 7);
    beaconLight.position.set(0, 0.8, 0);
    group.add(beaconLight);

    const beamGeom = new THREE.CylinderGeometry(0.12, 0.12, 4.0, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.35,
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.set(0, 2.0, 0);
    group.add(beam);

    this.lootDrop = {
      group,
      weaponId: 'sun_staff',
      position: group.position,
      claimed: false,
      beaconLight,
    };
    parent.add(group);
    return this.lootDrop;
  }
}
