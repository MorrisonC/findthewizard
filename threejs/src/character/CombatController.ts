import * as THREE from 'three';

export type DifficultyTierId =
  | 'novice'
  | 'apprentice'
  | 'adept'
  | 'expert'
  | 'master'
  | 'legendary';

export interface DifficultyPreset {
  id: DifficultyTierId;
  label: string;
  playerDamageMult: number;
  enemyDamageMult: number;
  enemyHpMult: number;
}

export const SKYRIM_DIFFICULTY_PRESETS: Record<DifficultyTierId, DifficultyPreset> = {
  novice: {
    id: 'novice',
    label: 'Novice (1.5x Player / 0.5x Enemy)',
    playerDamageMult: 1.5,
    enemyDamageMult: 0.5,
    enemyHpMult: 0.75,
  },
  apprentice: {
    id: 'apprentice',
    label: 'Apprentice (1.25x Player / 0.75x Enemy)',
    playerDamageMult: 1.25,
    enemyDamageMult: 0.75,
    enemyHpMult: 0.9,
  },
  adept: {
    id: 'adept',
    label: 'Adept (1.0x Balanced Default)',
    playerDamageMult: 1.0,
    enemyDamageMult: 1.0,
    enemyHpMult: 1.0,
  },
  expert: {
    id: 'expert',
    label: 'Expert (0.75x Player / 1.5x Enemy)',
    playerDamageMult: 0.75,
    enemyDamageMult: 1.5,
    enemyHpMult: 1.25,
  },
  master: {
    id: 'master',
    label: 'Master (0.5x Player / 2.0x Enemy)',
    playerDamageMult: 0.5,
    enemyDamageMult: 2.0,
    enemyHpMult: 1.55,
  },
  legendary: {
    id: 'legendary',
    label: 'Legendary (0.35x Player / 3.0x Enemy)',
    playerDamageMult: 0.35,
    enemyDamageMult: 3.0,
    enemyHpMult: 2.1,
  },
};

export interface EquipmentStats {
  weaponDamageMultiplier: number;
  critChance: number;
  critMultiplier: number;
  staminaCostMultiplier: number;
  damageMitigation: number;
  bladeLength: number;
}

export interface PlayerRPGState {
  level: number;
  xp: number;
  xpToNextLevel: number;
  perkPoints: number;
  maxHp: number;
  hp: number;
  maxStamina: number;
  stamina: number;
  maxFocus: number;
  focus: number;
  armorRating: number;
  baseAttackDamage: number;
  skills: {
    bladeAndParry: number;
    shadowcraftAndEvasion: number;
    arcaneLoreAndWards: number;
  };
  perks: {
    armsman: boolean;
    silentRoll: boolean;
    resonantWard: boolean;
  };
}

export const DODGE_COOLDOWN = 0.25;
export const DODGE_DURATION = 0.52;
export const DODGE_IFRAME_START = 0.05;
export const DODGE_IFRAME_END = 0.42;
export const DODGE_DISTANCE = 3.4;
export const PARRY_WINDOW_SECONDS = 0.24;

export class CombatController {
  public difficulty: DifficultyPreset = SKYRIM_DIFFICULTY_PRESETS.adept;
  public rpg: PlayerRPGState = {
    level: 1,
    xp: 0,
    xpToNextLevel: 120,
    perkPoints: 1,
    maxHp: 180,
    hp: 180,
    maxStamina: 120,
    stamina: 120,
    maxFocus: 80,
    focus: 80,
    armorRating: 110,
    baseAttackDamage: 20,
    skills: {
      bladeAndParry: 15,
      shadowcraftAndEvasion: 15,
      arcaneLoreAndWards: 15,
    },
    perks: {
      armsman: false,
      silentRoll: false,
      resonantWard: false,
    },
  };

  public isDodging: boolean = false;
  public dodgeTimer: number = 0;
  public dodgeCooldownTimer: number = 0;
  public isParrying: boolean = false;
  public parryTimer: number = 0;
  public shadowCounterBuffTimer: number = 0;

  public setDifficulty(tier: DifficultyTierId): void {
    this.difficulty = SKYRIM_DIFFICULTY_PRESETS[tier];
  }

  public get hasInvulnerabilityFrames(): boolean {
    if (!this.isDodging) return false;
    const elapsed = DODGE_DURATION - this.dodgeTimer;
    const extraIframe = this.rpg.perks.silentRoll ? 0.08 : 0.0;
    return elapsed >= DODGE_IFRAME_START && elapsed <= DODGE_IFRAME_END + extraIframe;
  }

  public tryStartDodge(): boolean {
    const staminaCost = this.rpg.perks.silentRoll ? 16 : 22;
    if (this.isDodging || this.dodgeCooldownTimer > 0 || this.rpg.stamina < staminaCost) {
      return false;
    }
    this.rpg.stamina -= staminaCost;
    this.isDodging = true;
    this.dodgeTimer = DODGE_DURATION;
    this.grantSkillXp('shadowcraftAndEvasion', 14);
    return true;
  }

  public tryStartParry(): boolean {
    if (this.isDodging || this.rpg.stamina < 10) return false;
    this.isParrying = true;
    this.parryTimer = PARRY_WINDOW_SECONDS;
    return true;
  }

  public computePlayerStrike(kind: 'light' | 'heavy'): {
    rawDamage: number;
    poiseDamage: number;
    isCrit: boolean;
  } | null {
    const staminaCost = kind === 'heavy' ? 28 : 12;
    if (this.rpg.stamina < staminaCost) return null;
    this.rpg.stamina -= staminaCost;

    const skillMult = 1 + (this.rpg.skills.bladeAndParry - 15) * 0.015;
    const perkMult = this.rpg.perks.armsman ? 1.2 : 1.0;
    const heavyMult = kind === 'heavy' ? 1.95 : 1.0;
    const counterMult = this.shadowCounterBuffTimer > 0 ? 1.4 : 1.0;

    const critChance = 0.1 + (this.rpg.skills.shadowcraftAndEvasion - 15) * 0.004;
    const isCrit = Math.random() < critChance;
    const critMult = isCrit ? 1.65 : 1.0;

    const rawDamage = Math.round(
      this.rpg.baseAttackDamage *
        skillMult *
        perkMult *
        heavyMult *
        counterMult *
        critMult *
        this.difficulty.playerDamageMult
    );
    const poiseDamage = kind === 'heavy' ? 38 : 14;

    this.shadowCounterBuffTimer = 0;
    this.grantSkillXp('bladeAndParry', kind === 'heavy' ? 22 : 12);
    return { rawDamage, poiseDamage, isCrit };
  }

  public receiveEnemyAttack(
    enemyBaseDamage: number,
    attackType: 'light_parriable' | 'heavy_unblockable' | 'aoe_nova'
  ): { outcome: 'dodged_iframe' | 'parried' | 'hit'; damageTaken: number } {
    if (this.hasInvulnerabilityFrames) {
      this.shadowCounterBuffTimer = 3.0;
      this.grantSkillXp('shadowcraftAndEvasion', 28);
      return { outcome: 'dodged_iframe', damageTaken: 0 };
    }

    if (this.isParrying && attackType === 'light_parriable') {
      this.grantSkillXp('bladeAndParry', 30);
      if (this.rpg.perks.resonantWard) {
        this.rpg.focus = Math.min(this.rpg.maxFocus, this.rpg.focus + 18);
      }
      return { outcome: 'parried', damageTaken: 0 };
    }

    const mitigation = Math.min(0.8, this.rpg.armorRating * 0.0012);
    const damageTaken = Math.max(
      4,
      Math.round(enemyBaseDamage * this.difficulty.enemyDamageMult * (1 - mitigation))
    );
    this.rpg.hp = Math.max(0, this.rpg.hp - damageTaken);
    return { outcome: 'hit', damageTaken };
  }

  public grantSkillXp(skill: keyof PlayerRPGState['skills'], amount: number): boolean {
    this.rpg.skills[skill] += Math.max(1, Math.round(amount / 15));
    this.rpg.xp += amount;
    if (this.rpg.xp >= this.rpg.xpToNextLevel) {
      this.rpg.xp -= this.rpg.xpToNextLevel;
      this.rpg.level += 1;
      this.rpg.xpToNextLevel = Math.round(this.rpg.xpToNextLevel * 1.35);
      this.rpg.perkPoints += 1;
      this.rpg.maxHp += 25;
      this.rpg.hp = this.rpg.maxHp;
      this.rpg.maxStamina += 15;
      this.rpg.stamina = this.rpg.maxStamina;
      this.rpg.baseAttackDamage += 3;
      return true;
    }
    return false;
  }

  public attachWeaponTrail(_trail: unknown): void {}
  public attachParticles(_particles: unknown): void {}
  public attachWeapon(_weapon: unknown): void {}
  public attachShield(_shield: unknown): void {}

  public consumeRootMotion(): THREE.Vector3 { return new THREE.Vector3(); }
  public setMove(_x: number, _z: number, _sprint: boolean): void {}
  public setAimYaw(_yaw: number): void {}
  public pressAttack(_kind: string): void {}
  public receiveHit(_amount: number): void {}

  public update(dt: number): void {
    if (this.isDodging) {
      this.dodgeTimer -= dt;
      if (this.dodgeTimer <= 0) {
        this.isDodging = false;
        this.dodgeCooldownTimer = DODGE_COOLDOWN;
      }
    } else if (this.dodgeCooldownTimer > 0) {
      this.dodgeCooldownTimer = Math.max(0, this.dodgeCooldownTimer - dt);
    }

    if (this.isParrying) {
      this.parryTimer -= dt;
      if (this.parryTimer <= 0) {
        this.isParrying = false;
      }
    }

    if (this.shadowCounterBuffTimer > 0) {
      this.shadowCounterBuffTimer = Math.max(0, this.shadowCounterBuffTimer - dt);
    }

    // Regenerate stamina and focus when not dodging
    if (!this.isDodging) {
      this.rpg.stamina = Math.min(this.rpg.maxStamina, this.rpg.stamina + 18 * dt);
      this.rpg.focus = Math.min(this.rpg.maxFocus, this.rpg.focus + 8 * dt);
    }
  }
}
