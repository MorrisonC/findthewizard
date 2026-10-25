/**
 * BossVaelorEncounter: Multi-phase boss fight for Arch-Illusionist Vaelor in SAN1.
 *
 * Phase 1: High Poise (120), Starlight Thrust telegraphs (0.60s), expanding Void Shockwaves.
 * Phase 2 (<= 50% HP): Dimensional inversion, summons 2 Mirror Mirage Clones,
 * faster attack wind-ups (0.42s), and violent teleport dashes.
 * Defeat: Spawns the legendary Sun-Staff ground pickup with glowing beacon.
 */
import * as THREE from 'three';
import { POISE_CONSTANTS } from './EnemyCombatAI';

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
  public phase: 1 | 2 = 1;
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

  public clones: THREE.Group[] = [];
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
    // Elegant arched robes with emissive indigo runic glow
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

    // Floating Starlight Nimbus / Gimbal Halo
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true });
    this.haloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), haloMat);
    this.haloMesh.position.set(0, 1.05, 0);
    this.haloMesh.rotation.x = Math.PI / 2;
    this.mesh.add(this.haloMesh);

    // Faceless Mirror Mask
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

    // Dynamic Boss Aura Light
    this.bossLight = new THREE.PointLight(0x818cf8, 2.8, 9);
    this.bossLight.position.set(0, 1.1, 0);
    this.mesh.add(this.bossLight);
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    isDodging: boolean,
    isBlocking: boolean
  ): { shockwaveDamage: number; playerHitOutcome?: 'hit' | 'blocked' | 'evaded' } {
    if (this.isDead) {
      if (this.lootDrop && !this.lootDrop.claimed) {
        this.lootDrop.group.rotation.y += dt * 1.5;
        this.lootDrop.beaconLight.intensity = 2.0 + Math.sin(Date.now() * 0.005) * 0.8;
      }
      return { shockwaveDamage: 0 };
    }

    // Spin halo
    if (this.haloMesh) {
      this.haloMesh.rotation.z += dt * (this.phase === 2 ? 3.0 : 1.2);
    }

    // Stun logic
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

    // Poise regen
    if (this.poiseRegenTimer > 0) {
      this.poiseRegenTimer -= dt;
    } else if (this.poise < this.maxPoise) {
      this.poise = Math.min(this.maxPoise, this.poise + POISE_CONSTANTS.POISE_REGEN_RATE * 1.2 * dt);
    }

    // Cooldown & shockwave timers
    if (this.cooldown > 0) this.cooldown -= dt;
    this.shockwaveTimer -= dt;

    if (this.shockwaveTimer <= 0 && this.mesh.parent) {
      this.spawnShockwave(this.mesh.parent);
      this.shockwaveTimer = this.phase === 2 ? 3.2 : 5.0;
    }

    // Update active shockwaves
    let totalShockwaveDmg = 0;
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += sw.speed * dt;
      sw.mesh.scale.set(sw.radius, sw.radius, 1);

      // Fade out
      const progress = sw.radius / sw.maxRadius;
      const mat = sw.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1.0 - progress);

      // Collision with player
      const distToPlayer = Math.hypot(
        sw.mesh.position.x - playerPos.x,
        sw.mesh.position.z - playerPos.z
      );
      if (
        !sw.hasHitPlayer &&
        Math.abs(distToPlayer - sw.radius) < 0.65
      ) {
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

    // Update clones: mimic rotation and subtle bobbing
    for (const clone of this.clones) {
      clone.rotation.y = this.mesh.rotation.y;
      clone.position.y = 1.2 + Math.sin(Date.now() * 0.004 + clone.position.x) * 0.1;
    }

    return { shockwaveDamage: totalShockwaveDmg };
  }

  public spawnShockwave(parent: THREE.Object3D): void {
    const geom = new THREE.RingGeometry(0.1, 0.45, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: this.phase === 2 ? 0xec4899 : 0x818cf8,
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

  public spawnMirageClones(parent: THREE.Object3D): void {
    this.clearClones();
    const offsets = [
      new THREE.Vector3(-2.8, 1.2, -2.6),
      new THREE.Vector3(2.8, 1.2, -2.6),
    ];

    for (let i = 0; i < offsets.length; i++) {
      const cloneGroup = new THREE.Group();
      cloneGroup.position.copy(offsets[i]);
      cloneGroup.name = `vaelor_clone_${i}`;

      const cloneMat = new THREE.MeshStandardMaterial({
        color: 0x4338ca,
        emissive: 0x818cf8,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.65,
        wireframe: true,
      });
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 8), cloneMat);
      cloneGroup.add(robe);

      parent.add(cloneGroup);
      this.clones.push(cloneGroup);
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

  public receivePlayerHit(
    damage: number,
    poiseDamage: number
  ): {
    phaseShift: boolean;
    guardBroken: boolean;
    isExecution: boolean;
    isDead: boolean;
    damageDealt: number;
  } {
    if (this.isDead) return { phaseShift: false, guardBroken: false, isExecution: false, isDead: true, damageDealt: 0 };

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

    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      this.clearClones();
      return {
        phaseShift: false,
        guardBroken: false,
        isExecution,
        isDead: true,
        damageDealt: actualDmg,
      };
    }

    // Phase 2 transition at 50% HP (<= 90 HP)
    let phaseShift = false;
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
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
    }

    return {
      phaseShift,
      guardBroken: false,
      isExecution,
      isDead: false,
      damageDealt: actualDmg,
    };
  }

  public dropBossLoot(parent: THREE.Object3D): BossLootDrop {
    const group = new THREE.Group();
    group.position.set(this.mesh.position.x, 0.4, this.mesh.position.z);

    // Glowing vertical light beacon
    const beaconLight = new THREE.PointLight(0xfacc15, 3.5, 7);
    beaconLight.position.set(0, 0.8, 0);
    group.add(beaconLight);

    // Golden vertical pillar beam
    const beamGeom = new THREE.CylinderGeometry(0.12, 0.12, 4.0, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    beam.position.set(0, 2.0, 0);
    group.add(beam);

    // Rotating ground ring halo
    const haloGeom = new THREE.TorusGeometry(0.65, 0.05, 8, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, wireframe: true });
    const halo = new THREE.Mesh(haloGeom, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 0.05, 0);
    group.add(halo);

    // Floating Sun-Staff relic mesh
    const staffShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.6, roughness: 0.3 })
    );
    const staffOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 1.2,
      })
    );
    staffOrb.position.set(0, 0.65, 0);
    const staffGroup = new THREE.Group();
    staffGroup.add(staffShaft);
    staffGroup.add(staffOrb);
    staffGroup.position.set(0, 0.75, 0);
    staffGroup.rotation.z = Math.PI / 6;
    group.add(staffGroup);

    parent.add(group);

    this.lootDrop = {
      group,
      weaponId: 'sun_staff',
      position: group.position,
      claimed: false,
      beaconLight,
    };
    return this.lootDrop;
  }

  public updateHUD(
    hudContainer: HTMLElement | null,
    hpFill: HTMLElement | null,
    poiseFill: HTMLElement | null,
    subtitle: HTMLElement | null
  ): void {
    if (!hudContainer) return;
    if (this.isDead) {
      hudContainer.classList.remove('visible');
      return;
    }

    hudContainer.classList.add('visible');
    if (hpFill) {
      const pct = Math.max(0, (this.hp / this.maxHp) * 100);
      hpFill.style.width = `${pct}%`;
    }
    if (poiseFill) {
      const pct = Math.max(0, (this.poise / this.maxPoise) * 100);
      poiseFill.style.width = `${pct}%`;
    }
    if (subtitle) {
      subtitle.textContent =
        this.phase === 1
          ? 'THE WEAVER OF MIRRORS • PHASE 1'
          : 'THE MIRROR INVERSION • PHASE 2';
    }
  }

  public dispose(): void {
    this.clearClones();
    for (const sw of this.shockwaves) {
      sw.mesh.geometry.dispose();
      (sw.mesh.material as THREE.Material).dispose();
      sw.mesh.parent?.remove(sw.mesh);
    }
    this.shockwaves = [];
    if (this.lootDrop) {
      this.lootDrop.group.parent?.remove(this.lootDrop.group);
      this.lootDrop = null;
    }
    this.mesh.parent?.remove(this.mesh);
  }
}
