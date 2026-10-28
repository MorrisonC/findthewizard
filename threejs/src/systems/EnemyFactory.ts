import * as THREE from 'three';

/**
 * Grounding & Y-Offset Utility (`snapObjectToFloor`)
 * Fixes the bug where `box.min.y` was subtracted blindly or sampled after keyframe transforms:
 * 1. Resets any skinned mesh skeleton to rest pose before sampling bounds.
 * 2. Computes accurate world-space bounding box (`Box3.setFromObject`).
 * 3. Aligns the bottom-most vertex strictly to `floorY` (0.0m by default),
 *    adding `hoverHeight` ONLY when `floating === true`.
 */
export function snapObjectToFloor(
  object: THREE.Object3D,
  floorY: number = 0,
  floating: boolean = false,
  hoverHeight: number = 0
): number {
  object.traverse((child) => {
    const skinned = child as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh && skinned.skeleton) {
      skinned.skeleton.pose();
    }
  });

  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) {
    object.position.y = floorY + (floating ? hoverHeight : 0);
    return object.position.y;
  }

  const bottomOffsetFromOrigin = box.min.y - object.position.y;
  const targetMinY = floorY + (floating ? hoverHeight : 0);
  object.position.y = targetMinY - bottomOffsetFromOrigin;
  object.updateMatrixWorld(true);
  return object.position.y;
}

export interface EnemySpawnConfig {
  encounterId: string;
  sceneId: string;
  modelId: string;
  name: string;
  position: [number, number, number];
  level: number;
  baseHp: number;
  baseArmor: number;
  baseDamage: number;
  basePoise: number;
  isBoss?: boolean;
  floating?: boolean;
  hoverHeight?: number;
}

export interface EnemyHandle {
  encounterId: string;
  sceneId: string;
  modelId: string;
  name: string;
  group: THREE.Group;
  level: number;
  hp: number;
  maxHp: number;
  armorRating: number;
  baseDamage: number;
  poise: number;
  maxPoise: number;
  bossPhase: 1 | 2 | 3;
  isBoss: boolean;
  floating: boolean;
  baseGroundY: number;
  hoverHeight: number;
  dead: boolean;
  isStunned: boolean;
  stunTimer: number;
  attackState: 'idle' | 'windup' | 'active_swing' | 'recovery';
  attackType: 'light_parriable' | 'heavy_unblockable' | 'aoe_nova';
  stateTimer: number;
  telegraphRing: THREE.Mesh;
  update: (dt: number, playerPos: THREE.Vector3) => void;
  takeDamage: (rawDamage: number, poiseDamage: number, isCounterHit?: boolean) => {
    finalDamage: number;
    guardBroken: boolean;
    phaseTransitioned: boolean;
    newPhase: 1 | 2 | 3;
  };
  playDeath: () => void;
}

export class EnemyFactory {
  public static spawnEnemy(
    scene: THREE.Scene | null,
    config: EnemySpawnConfig,
    playerLevel: number = 1,
    difficultyScale: { hpMult: number; dmgMult: number } = { hpMult: 1.0, dmgMult: 1.0 }
  ): EnemyHandle {
    const group = new THREE.Group();
    group.name = `enemy_${config.encounterId}`;

    // Build articulated rig (Legs, Torso, Head, Weapon Arm, Shield/Offhand)
    const isBoss = Boolean(config.isBoss);
    const scale = isBoss ? 1.25 : 1.0;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: isBoss ? 0x5b21b6 : config.floating ? 0x0284c7 : 0x475569,
      roughness: 0.45,
      metalness: 0.4,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: isBoss ? 0xf59e0b : 0x94a3b8,
      roughness: 0.3,
      metalness: 0.7,
    });

    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.48 * scale, 0.18 * scale), accentMat);
    leftBoot.position.set(-0.15 * scale, 0.24 * scale, 0);
    leftBoot.castShadow = true;

    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.48 * scale, 0.18 * scale), accentMat);
    rightBoot.position.set(0.15 * scale, 0.24 * scale, 0);
    rightBoot.castShadow = true;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.68 * scale, 0.3 * scale), bodyMat);
    torso.position.set(0, 0.82 * scale, 0);
    torso.castShadow = true;

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28 * scale, 0.3 * scale, 0.28 * scale), accentMat);
    head.position.set(0, 1.34 * scale, 0);
    head.castShadow = true;

    const weaponArm = new THREE.Group();
    weaponArm.position.set(0.36 * scale, 1.05 * scale, 0);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.06 * scale, 0.85 * scale, 0.12 * scale),
      accentMat
    );
    blade.position.set(0, 0.35 * scale, 0.25 * scale);
    blade.rotation.x = Math.PI / 4;
    weaponArm.add(blade);

    group.add(leftBoot, rightBoot, torso, head, weaponArm);

    // Telegraph ring flat on the floor (Y = 0.02)
    const ringGeo = new THREE.RingGeometry(0.65 * scale, 1.45 * scale, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const telegraphRing = new THREE.Mesh(ringGeo, ringMat);
    telegraphRing.position.set(0, 0.02, 0);
    group.add(telegraphRing);

    // Set XZ position first, then enforce strict Y=0 floor snapping
    group.position.set(config.position[0], config.position[1], config.position[2]);
    const floating = Boolean(config.floating);
    const hoverHeight = floating ? (config.hoverHeight ?? 0.45) : 0.0;
    const baseGroundY = snapObjectToFloor(group, config.position[1], floating, hoverHeight);

    scene?.add(group);

    // Skyrim-style level & difficulty scaling (prevents 1-2 hit kills)
    const effectiveLevel = Math.max(config.level, Math.round(playerLevel * 0.85 + config.level * 0.3));
    const maxHp = Math.round(
      config.baseHp * (1 + 0.18 * (effectiveLevel - 1)) * difficultyScale.hpMult
    );
    const maxPoise = Math.round(config.basePoise * (1 + 0.1 * (effectiveLevel - 1)));
    let elapsed = 0;

    const handle: EnemyHandle = {
      encounterId: config.encounterId,
      sceneId: config.sceneId,
      modelId: config.modelId,
      name: config.name,
      group,
      level: effectiveLevel,
      hp: maxHp,
      maxHp,
      armorRating: config.baseArmor + effectiveLevel * 12,
      baseDamage: Math.round(config.baseDamage * (1 + 0.14 * (effectiveLevel - 1)) * difficultyScale.dmgMult),
      poise: maxPoise,
      maxPoise,
      bossPhase: 1,
      isBoss,
      floating,
      baseGroundY,
      hoverHeight,
      dead: false,
      isStunned: false,
      stunTimer: 0,
      attackState: 'idle',
      attackType: 'light_parriable',
      stateTimer: 1.2,
      telegraphRing,

      update(dt: number, playerPos: THREE.Vector3) {
        if (this.dead) return;
        elapsed += dt;

        // Maintain strict grounding or intentional floating oscillation
        if (this.floating) {
          this.group.position.y = this.baseGroundY + Math.sin(elapsed * 2.4) * 0.12;
        } else {
          this.group.position.y = this.baseGroundY;
        }

        if (this.isStunned) {
          this.stunTimer -= dt;
          ringMat.opacity = 0;
          torso.rotation.z = Math.sin(elapsed * 18) * 0.12;
          if (this.stunTimer <= 0) {
            this.isStunned = false;
            this.poise = this.maxPoise;
            torso.rotation.z = 0;
          }
          return;
        }

        // Face player on XZ plane
        const dx = playerPos.x - this.group.position.x;
        const dz = playerPos.z - this.group.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.1) {
          this.group.rotation.y = Math.atan2(dx, dz);
        }

        // Leg walk animation when closing distance
        if (dist > 2.4 && dist < 14.0 && this.attackState === 'idle') {
          const speed = (this.isBoss ? 2.6 : 2.1) * (1 + (this.bossPhase - 1) * 0.18);
          this.group.position.x += (dx / dist) * speed * dt;
          this.group.position.z += (dz / dist) * speed * dt;
          leftBoot.position.z = Math.sin(elapsed * 8) * 0.16;
          rightBoot.position.z = -Math.sin(elapsed * 8) * 0.16;
        } else {
          leftBoot.position.z = 0;
          rightBoot.position.z = 0;
        }

        // Attack state machine with telegraph rings
        this.stateTimer -= dt;
        if (this.attackState === 'idle' && dist <= 3.2 && this.stateTimer <= 0) {
          this.attackState = 'windup';
          // Phase 2 & 3 bosses mix unblockable heavy attacks & AoE novas
          const roll = Math.random();
          if (this.isBoss && this.bossPhase === 3 && roll < 0.4) {
            this.attackType = 'aoe_nova';
            this.stateTimer = 1.05;
            ringMat.color.setHex(0xef4444); // Red = Dodge-Roll required
          } else if (roll < 0.35 + (this.bossPhase - 1) * 0.15) {
            this.attackType = 'heavy_unblockable';
            this.stateTimer = 0.85;
            ringMat.color.setHex(0xef4444); // Red = Unblockable
          } else {
            this.attackType = 'light_parriable';
            this.stateTimer = 0.65;
            ringMat.color.setHex(0xfacc15); // Yellow = Parriable
          }
        } else if (this.attackState === 'windup') {
          ringMat.opacity = 0.55;
          weaponArm.rotation.x = -1.1;
          if (this.stateTimer <= 0) {
            this.attackState = 'active_swing';
            this.stateTimer = 0.22;
            weaponArm.rotation.x = 0.85;
          }
        } else if (this.attackState === 'active_swing') {
          ringMat.opacity = 0.85;
          if (this.stateTimer <= 0) {
            this.attackState = 'recovery';
            this.stateTimer = Math.max(0.55, 1.35 - (this.bossPhase - 1) * 0.25);
            ringMat.opacity = 0.0;
            weaponArm.rotation.x = 0;
          }
        } else if (this.attackState === 'recovery' && this.stateTimer <= 0) {
          this.attackState = 'idle';
          this.stateTimer = 0.4;
        }
      },

      takeDamage(rawDamage: number, poiseDamage: number, isCounterHit: boolean = false) {
        if (this.dead) {
          return { finalDamage: 0, guardBroken: false, phaseTransitioned: false, newPhase: this.bossPhase };
        }
        // Skyrim hyperbolic armor mitigation: max 80% damage reduction
        const mitigation = Math.min(0.8, this.armorRating * 0.0012);
        const stunBonus = this.isStunned || isCounterHit ? 1.45 : 1.0;
        const finalDamage = Math.max(2, Math.round(rawDamage * (1 - mitigation) * stunBonus));

        this.hp = Math.max(0, this.hp - finalDamage);
        this.poise = Math.max(0, this.poise - poiseDamage);

        let guardBroken = false;
        if (this.poise <= 0 && !this.isStunned) {
          this.isStunned = true;
          this.stunTimer = 2.5;
          this.attackState = 'idle';
          guardBroken = true;
        }

        // Check 3-Phase Boss Transitions (66% -> Phase 2, 33% -> Phase 3)
        let phaseTransitioned = false;
        const hpRatio = this.hp / this.maxHp;
        if (this.isBoss) {
          if (hpRatio <= 0.33 && this.bossPhase < 3) {
            this.bossPhase = 3;
            phaseTransitioned = true;
            bodyMat.emissive.setHex(0x7c3aed);
            bodyMat.emissiveIntensity = 0.6;
          } else if (hpRatio <= 0.66 && this.bossPhase < 2) {
            this.bossPhase = 2;
            phaseTransitioned = true;
            bodyMat.emissive.setHex(0xd97706);
            bodyMat.emissiveIntensity = 0.35;
          }
        }

        if (this.hp <= 0) {
          this.playDeath();
        }

        return { finalDamage, guardBroken, phaseTransitioned, newPhase: this.bossPhase };
      },

      playDeath() {
        this.dead = true;
        ringMat.opacity = 0;
        this.group.rotation.x = -Math.PI / 2;
        this.group.position.y = this.baseGroundY + 0.15;
      },
    };

    return handle;
  }

  /**
   * Async convenience spawn used by the scene builders. The handle is detached
   * (callers reparent `handle.group`), so this does not need a live scene.
   */
  public static spawn(
    encounterId: string,
    sceneId: string,
    position: { x: number; y: number; z: number },
    options: Partial<Omit<EnemySpawnConfig, 'encounterId' | 'sceneId' | 'position'>> = {},
  ): Promise<EnemyHandle> {
    const config: EnemySpawnConfig = {
      encounterId,
      sceneId,
      modelId: options.modelId ?? 'procedural_rig',
      name: options.name ?? encounterId,
      position: [position.x, position.y, position.z],
      level: options.level ?? 3,
      baseHp: options.baseHp ?? 180,
      baseArmor: options.baseArmor ?? 10,
      baseDamage: options.baseDamage ?? 18,
      basePoise: options.basePoise ?? 120,
      isBoss: options.isBoss ?? true,
      floating: options.floating ?? false,
      hoverHeight: options.hoverHeight,
    };
    return Promise.resolve(EnemyFactory.spawnEnemy(null, config));
  }
}
