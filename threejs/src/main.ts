import * as THREE from 'three';
import { GameEngine } from './core/Engine';
import { ASSETS } from './core/AssetManifest';
import { GlobalEventBus } from './core/EventBus';
import { QualityManager } from './core/Quality';
import { AudioManager } from './core/AudioManager';
import { RapierPhysics } from './physics/PhysicsWorld';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { spawnMainCharacter, type WeaponId } from './character';
import { SoundFX } from './core/SoundFX';
import worldManifest from './data/world_manifest.json';
import itemsData from './data/items.json';
import questsData from './data/quests.json';

import puzzlesData from './data/puzzles.json';

import zonesData from './data/zones.json';

import dialogueData from './data/dialogue.json';

import { FORTRESS_EXITS, doorRequirementsMet } from './data/doorGraph';

import {

  CAMPAIGN_ORDER,

  TOTAL_TASKS,

  completedTaskCount,

  nextGoal,

  nextPendingTask,

  planRoute,

  taskReady,

  type AutoProgressState,

} from './autobattler/Campaign';
import { doorApproachPoint, findPath, type ObstacleRect } from './autobattler/Pathfinder';
import { AutoplayController, type AutoplayHost, type AutoplayMode } from './systems/AutoplayController';
import { QuestPuzzleRuntime } from './systems/QuestPuzzleRuntime';
console.log('⚔️ VEILKEEP Initialized with:');

console.log(`- ${itemsData.length} items`);
console.log(`- ${questsData.length} quests (7 Main, 31 Side, 4 Hidden)`);
console.log(`- ${puzzlesData.length} illusionist puzzles`);
console.log(`- ${zonesData.length} fortress zones`);
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// ---------- QA runtime error capture ----------
/** Ring buffer of runtime failures, surfaced through __veilkeep.getDiagnostics(). */
const runtimeErrors: string[] = [];
const MAX_RUNTIME_ERRORS = 50;
function describeError(value: unknown): string {

  if (value instanceof Error) return `${value.name}: ${value.message}`;

  if (typeof value === 'string') return value;

  try {

    return JSON.stringify(value);

  } catch {

    return String(value);

  }

}

function recordRuntimeError(kind: string, value: unknown): void {

  runtimeErrors.push(`[${kind}] ${describeError(value)}`);

  if (runtimeErrors.length > MAX_RUNTIME_ERRORS) runtimeErrors.shift();

}

const nativeConsoleError = console.error.bind(console);

console.error = (...args: unknown[]): void => {

  recordRuntimeError('console.error', args.map(describeError).join(' '));

  nativeConsoleError(...args);

};

window.addEventListener('error', (event) => {

  recordRuntimeError('window.error', event.error ?? event.message);

});

window.addEventListener('unhandledrejection', (event) => {

  recordRuntimeError('unhandledrejection', event.reason);

});

const hudZone = document.getElementById('hud-zone-name');

const hudQuest = document.getElementById('hud-active-quest');

const hpFill = document.querySelector('.bar-fill-hp') as HTMLElement | null;

const hudToast = document.getElementById('hud-toast');

const lowHpOverlay = document.getElementById('hud-lowhp');

const hudInteract = document.getElementById('hud-interact');

const hudInteractText = document.getElementById('hud-interact-text');

const damageContainer = document.getElementById('hud-damage-container');

const staFill = document.querySelector('.bar-fill-sta') as HTMLElement | null;

const fpFill = document.querySelector('.bar-fill-fp') as HTMLElement | null;

const stealthBadge = document.getElementById('hud-stealth-badge');

const questModal = document.getElementById('hud-quest-modal');

const questObjectivesList = document.getElementById('quest-objectives-list');

const questCloseBtn = document.getElementById('quest-close-btn');

const hudQuestCard = document.getElementById('hud-quest-card');

const minimapCanvas = document.getElementById('hud-minimap') as HTMLCanvasElement | null;

const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

// Dialogue UI Elements

const dialogueModal = document.getElementById('hud-dialogue-modal');

const dialogueSpeaker = document.getElementById('dialogue-speaker');

const dialogueTitle = document.getElementById('dialogue-title');

const dialogueText = document.getElementById('dialogue-text');

const dialogueChoices = document.getElementById('dialogue-choices');

// Inventory UI Elements

const invModal = document.getElementById('hud-inventory-modal');

const invGrid = document.getElementById('inv-grid');

const invDetailsTitle = document.getElementById('inv-details-title');

const invDetailsBody = document.getElementById('inv-details-body');

const invCloseBtn = document.getElementById('inv-close-btn');

// Truth Lens UI

const truthLensOverlay = document.getElementById('hud-truth-lens');

const parryBadge = document.getElementById('hud-parry-badge');

// Lore Archival UI Elements

const loreModal = document.getElementById('hud-lore-modal');

const loreModalTitle = document.getElementById('lore-modal-title');

const loreText = document.getElementById('lore-text');

const loreCloseBtn = document.getElementById('lore-close-btn');

// Pause Settings UI Elements

const pauseModal = document.getElementById('hud-pause-modal');

const pauseCloseBtn = document.getElementById('pause-close-btn');

const volMusic = document.getElementById('vol-music') as HTMLInputElement | null;

const btnResume = document.getElementById('btn-resume');

const btnRestartCp = document.getElementById('btn-restart-cp');

// Cartography Map UI Elements

const mapModal = document.getElementById('hud-map-modal');

const mapCloseBtn = document.getElementById('map-close-btn');

const hudMapCard = document.getElementById('hud-map-card');

const hudMapSubtitle = document.getElementById('hud-map-subtitle');

const mapDiscoveryBadge = document.getElementById('map-discovery-badge');

const mapNodesContainer = document.getElementById('map-nodes-container');

const mapDossierTitle = document.getElementById('map-dossier-title');

const mapDossierTag = document.getElementById('map-dossier-tag');

const mapDossierDesc = document.getElementById('map-dossier-desc');

const mapDossierStatus = document.getElementById('map-dossier-status');

const btnFastTravel = document.getElementById('btn-fast-travel') as HTMLButtonElement | null;

// Character & Relic Folio UI Elements

const charModal = document.getElementById('hud-character-modal');

const charCloseBtn = document.getElementById('char-close-btn');

const hudCharCard = document.getElementById('hud-char-card');

const charRelicLoreTitle = document.getElementById('char-relic-lore-title');

const charRelicLoreBody = document.getElementById('char-relic-lore-body');

let isCharFolioOpen = false;

// Audio Toggle Button

const hudAudioBtn = document.getElementById('hud-audio-btn');

const hudAudioLabel = document.getElementById('hud-audio-label');

// Ending Epilogue Modal

const endingModal = document.getElementById('hud-ending-modal');

const endingChoicesGrid = document.getElementById('ending-choices-grid');

const endingEpilogueScroll = document.getElementById('ending-epilogue-scroll');

let isEndingModalOpen = false;

void endingChoicesGrid;

void isEndingModalOpen;

let toastTimer: number | null = null;

function showToast(message: string, duration = 2400): void {

  if (!hudToast) return;

  hudToast.textContent = message;

  hudToast.classList.add('visible');

  if (toastTimer) clearTimeout(toastTimer);

  toastTimer = window.setTimeout(() => {

    hudToast.classList.remove('visible');

    toastTimer = null;

  }, duration);

}

function showInteractPrompt(text: string): void {

  if (!hudInteract || !hudInteractText) return;

  hudInteractText.textContent = text;

  hudInteract.classList.add('visible');

}

function hideInteractPrompt(): void {

  if (!hudInteract) return;

  hudInteract.classList.remove('visible');

}

let recentPopupTime = 0;
let recentPopupCount = 0;

function spawnDamagePopup(pos: { x: number; y: number; z: number }, text: string, isCrit = false): void {
  if (!damageContainer) return;

  const now = performance.now();
  if (now - recentPopupTime < 160) {
    recentPopupCount++;
  } else {
    recentPopupCount = 0;
  }
  recentPopupTime = now;

  // Differentiate status banners (COUNTER HIT!, GUARD BROKEN!, etc.) from numeric HP damage
  const isStatus = isCrit || text.includes('!') || !text.includes('HP');

  // Status banners float visibly higher above the character so they never overlap numeric damage
  const heightOffset = isStatus ? 1.45 : 0.82;
  const tempV = new THREE.Vector3(pos.x, pos.y + heightOffset, pos.z);
  tempV.project(engine.cameraRig.camera);

  // Apply subtle vertical stacking and horizontal stagger to prevent overlapping popups
  const staggerY = recentPopupCount * 22;
  const jitterX = (Math.random() - 0.5) * 16;
  const x = (tempV.x * 0.5 + 0.5) * window.innerWidth + jitterX;
  const y = (-(tempV.y * 0.5) + 0.5) * window.innerHeight - staggerY;

  const el = document.createElement('div');
  el.className = `damage-popup ${isStatus ? 'status-popup' : ''}`;
  el.textContent = text;
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;

  if (isStatus) {
    el.style.color = '#fbbf24';
    el.style.fontSize = '18px';
  } else if (isCrit) {
    el.style.color = '#f59e0b';
    el.style.fontSize = '20px';
  }

  damageContainer.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

function flashMesh(group: THREE.Group, colorHex: number, durationMs = 140): void {

  const originals: { mat: THREE.MeshStandardMaterial; emissive: THREE.Color; intensity: number }[] = [];

  group.traverse((node) => {

    if (node instanceof THREE.Mesh && node.material && 'emissive' in node.material) {

      const stdMat = node.material as THREE.MeshStandardMaterial;

      originals.push({ mat: stdMat, emissive: stdMat.emissive.clone(), intensity: stdMat.emissiveIntensity });

      stdMat.emissive.setHex(colorHex);

      stdMat.emissiveIntensity = 1.3;

    }

  });

  setTimeout(() => {

    originals.forEach(({ mat, emissive, intensity }) => {

      mat.emissive.copy(emissive);

      mat.emissiveIntensity = intensity;

    });

  }, durationMs);

}

type Spawn = { x: number; y: number; z: number };

type SceneId = 'S00' | 'OW1' | 'GH1' | 'B1' | 'SQ1' | 'GH2' | 'GH3' | 'GH4' | 'HM1' | 'BQ1' | 'AG1' | 'MH1' | 'SAN1' | 'RC1' | 'BT1' | 'CO1' | 'CO3' | 'U1' | 'U2' | 'U3' | 'U4' | 'TR1' | 'TR2' | 'TR3' | 'TR4' | 'AT1' | 'AT2' | 'AT3' | 'AL1' | 'AL2' | 'AL3' | 'PB1' | 'PB2' | 'PB3' | 'PB4' | 'RG1' | 'RG2' | 'RG3' | 'RG4' | 'VR1' | 'VR2' | 'VR3' | 'RS1' | 'RS2' | 'RS3' | 'RS4' | 'RS5' | 'RS6' | 'CR1' | 'MS3';

type GuardState = 'patrol' | 'chase' | 'dead';

interface Guard {

  sceneId: SceneId;

  mesh: THREE.Group;

  hp: number;

  maxHp: number;

  patrol: THREE.Vector3[];

  patrolIndex: number;

  state: GuardState;

  cooldown: number;

  speed: number;

  captain: boolean;

  isWraith?: boolean;

  isVaelorClone?: boolean;

  isHound?: boolean;

  hpBarEl?: HTMLDivElement;

  hpFillEl?: HTMLDivElement;

  hpBarTimer?: number;

  alertEl?: HTMLDivElement;

  detection?: number;
  poise?: number;
  maxPoise?: number;
  poiseRegenTimer?: number;
  isStunned?: boolean;
  stunTimer?: number;
  windupTimer?: number;
  poiseFillEl?: HTMLDivElement;
  mixer?: THREE.AnimationMixer;
  actions?: Record<string, THREE.AnimationAction>;
  currentAction?: string;
}

/**

 * Every hostile instantiated anywhere in the fortress. Scene builders used to

 * keep block-scoped `guard` / `captain` locals (U2/U4/TR1-4/PB1-4/CO1), so

 * those enemies were never ticked or attackable. Every spawner registers here.

 */

const activeGuards: Guard[] = [];

interface ExitTrigger {

  x: number;

  z: number;

  to: SceneId;

  spawn?: Spawn;

  requires: string[];

}

const exits: Record<SceneId, ExitTrigger[]> = FORTRESS_EXITS as unknown as Record<SceneId, ExitTrigger[]>;

const sceneById = new Map(worldManifest.mvpVerticalSliceScenes.map((scene) => [scene.id as SceneId, scene]));

const sceneSpawn = (id: SceneId): Spawn => {

  const scene = sceneById.get(id)!;

  return { x: scene.spawn[0], y: scene.spawn[1], z: scene.spawn[2] };

};

let currentSceneId: SceneId = 'S00';

const inventory = new Set<string>();

const solvedPuzzles = new Set<string>();

const discoveredLore = new Set<string>();

let bestCombo = Number(localStorage.getItem('veilkeep.bestCombo') || '0');

// Combo counter

let comboCount = 0;

let comboTimer = 0;

// Retrocausal rewind history (Relativity Cloister)

const positionHistory: { x: number; z: number; t: number }[] = [];

let rewindCooldown = 0;

const abilities = new Set<string>();

const discoveredScenes = new Set<SceneId>(['S00']);

let isMapOpen = false;

let selectedMapSceneId: SceneId = 'S00';

let playerHP = 100;

let exitCooldown = 0;

let lockedMessageCooldown = 0;

const initialSpawn = sceneSpawn('S00');

const stats = { STR: 10, AGI: 10, VIT: 10, INT: 10, CHA: 10, LCK: 10 };

const playerOrigin = {

  id: '',

  staggerBonus: 0,

  socialDisguise: false,

  cursePenaltyReduction: 0,

  tag: '',

  traits: [] as string[],

  flags: {} as Record<string, boolean | number>,

};

// ---------- Quest, puzzle and encounter runtime ----------

const questPickupMeshes: { id: string; mesh: THREE.Mesh }[] = [];

const questRuntime = new QuestPuzzleRuntime({

  inventory,

  abilities,

  solvedPuzzles,

  stats,

  originId: () => playerOrigin.id,

  socialDisguise: () => playerOrigin.socialDisguise,

});

const playerState = {

  x: initialSpawn.x,

  z: initialSpawn.z,

  speed: 5.5,

  stamina: 100,

  maxStamina: 100,

  fp: 100,

  maxFp: 100,

  isSprinting: false,

  isSneaking: false,

  surfaceNoise: 1.0,

  keys: { w: false, a: false, s: false, d: false, shift: false, ctrl: false },

};

// ---------- Auto-battler runtime state ----------

type AutoStatus = 'off' | 'travel' | 'task' | 'combat' | 'finale' | 'done';

const autoVisited = new Set<SceneId>(['S00']);

const autoCleared = new Set<SceneId>();

const autoFlags = new Set<string>();

let autoEnabled = false;

let autoStatus: AutoStatus = 'off';

let autoGoalId: SceneId | null = null;

let autoTaskId: string | null = null;

let autoRoute: SceneId[] = [];

let autoPath: { x: number; z: number }[] = [];

let autoPathTarget: { x: number; z: number } | null = null;

let autoRepathTimer = 0;

let autoStuckTimer = 0;

let autoStuckAnchor = { x: playerState.x, z: playerState.z };

let autoNudgeUntil = 0;

let autoAttackTimer = 0;

let autoActionTimer = 0;

let autoDialogueTurns = 0;

let autoDialogueNpc = '';

let autoDialogueDelay = 0;

let autoExitTarget: SceneId | null = null;

let autoInput = { x: 0, z: 0 };

let autoplaySpeedScale = 1;

let autoCombatTimer = 0;

let autoEndingShown = false;

let autoTaskSince = 0;

let autoTaskWatch = '';

let autoLastError = '';

let autoNudges = 0;

let autoHudTimer = 0;

// ---------- Deterministic QA state: quest log & convictions ----------

type ConvictionAxis = 'empathy' | 'rationalism' | 'solipsism';

const convictions: Record<ConvictionAxis, number> = { empathy: 0, rationalism: 0, solipsism: 0 };

const convictionAwards = new Set<string>();

/**

 * Shift the epistemic conviction triangle (GDD 5b). `reason` makes an award

 * idempotent, so replaying a room or reopening a dialogue cannot farm ranks.

 */

function awardConviction(axis: ConvictionAxis, amount = 1, reason = ''): void {

  if (reason) {

    if (convictionAwards.has(reason)) return;

    convictionAwards.add(reason);

  }

  convictions[axis] = Math.max(0, Math.min(5, convictions[axis] + amount));

}

interface QuestObjectiveView {

  id: string;

  desc: string;

  scene: SceneId;

  done: boolean;

}

/** Single source of truth for the journal UI, the HUD and QA diagnostics. */

function questObjectives(): QuestObjectiveView[] {

  return [

    { id: 'Q_INFILTRATE_COURTYARD', scene: 'S00', desc: 'Infiltrate the Sunken Courtyard (S00)', done: true },

    { id: 'Q_GATEKEEPER_DOUBT', scene: 'GH1', desc: 'Ground Gatekeeper Orin and take the Gatehouse Key (GH1)', done: questRuntime.isQuestComplete('Q_GATEKEEPER_DOUBT') },

    { id: 'Q_BRAMBLES', scene: 'S00', desc: 'Part the Moonlit Brambles (S00)', done: questRuntime.isPuzzleSolved('PUZ_S00_BRAMBLES') },

    { id: 'Q_PANOPTICON', scene: 'OW1', desc: 'Blind the Panopticon Gaze (OW1)', done: questRuntime.isPuzzleSolved('PUZ_38_PANOPTICON_GAZE') },

    { id: 'Q_IRON_NAIL', scene: 'OW1', desc: 'Acquire Cold-Iron Nail Relic (OW1)', done: inventory.has('ITEM_IRON_NAIL') },

    { id: 'Q_RELATIVITY_STAIRS', scene: 'RC1', desc: 'Anchor Escher Stairs in Relativity Cloister (RC1)', done: solvedPuzzles.has('PUZZLE_RELATIVITY_STAIRS') },

    { id: 'Q_MIRROR_LOCK', scene: 'GH2', desc: 'Shatter Gatehouse Mirror Lock (GH2)', done: solvedPuzzles.has('PUZZLE_MIRROR_LOCK') },

    { id: 'Q_AEOLIAN_CHIME', scene: 'BT1', desc: 'Tune Aeolian Baffles in Bell Tower (BT1)', done: solvedPuzzles.has('PUZZLE_AEOLIAN_CHIME') },

    { id: 'Q_BARBICAN_CAPTAIN', scene: 'GH3', desc: 'Neutralize Barbican Captain (GH3)', done: abilities.has('ABILITY_WALL_LEAP') },

    { id: 'Q_ENTER_MIRROR_HALL', scene: 'HM1', desc: 'Infiltrate the Halls of Mirrors (HM1)', done: discoveredScenes.has('HM1') },

    { id: 'Q_TRUE_MIRROR', scene: 'HM1', desc: 'Shatter True Mirror & Banish Wraith (HM1)', done: solvedPuzzles.has('PUZZLE_TRUE_MIRROR') },

    { id: 'Q_FEAST_SATIETY', scene: 'BQ1', desc: 'Dispel the Cenacle Feast & Free Morvath (BQ1)', done: solvedPuzzles.has('PUZZLE_FEAST_SATIETY') },

    { id: 'Q_ARBOREAL_WEAVE', scene: 'AG1', desc: 'Commune with Yggdra the Ancient Bough (AG1)', done: solvedPuzzles.has('PUZZLE_ARBOREAL_WEAVE') },

    { id: 'Q_HOSPITALITY_GAMBIT', scene: 'MH1', desc: "Solve Mother Hazel's Hospitality Gambit (MH1)", done: solvedPuzzles.has('PUZZLE_HOSPITALITY_GAMBIT') },

    { id: 'Q_HOLLOW_GLASS', scene: 'SAN1', desc: "Shatter Vaelor's Glass Heart & Liberate Cynthia (SAN1)", done: solvedPuzzles.has('PUZZLE_HOLLOW_GLASS') },

    { id: 'Q_PRISON_ESCAPE', scene: 'PB4', desc: 'Liberate the Abyssal Prison Block (PB4)', done: solvedPuzzles.has('PUZZLE_PRISON_ESCAPE') },

    { id: 'Q_WIND_SECRET', scene: 'RG4', desc: "Reveal the Wind's Secret in Rooftop Gardens (RG4)", done: solvedPuzzles.has('PUZZLE_WIND_SECRET') },

    { id: 'Q_DREAM_DESCENT', scene: 'VR3', desc: 'Complete the Dream Descent in Void Realm (VR3)', done: solvedPuzzles.has('PUZZLE_DREAM_DESCENT') },

    { id: 'Q_HUNTERS_LIE', scene: 'TR4', desc: "Expose the Hunter's Lie in Trophy Hall (TR4)", done: solvedPuzzles.has('PUZZLE_HUNTERS_LIE') },

    { id: 'Q_MONK_TOMBS', scene: 'U2', desc: 'Lay Monk Spirits to Rest in Undercrypt (U2)', done: solvedPuzzles.has('PUZZLE_MONK_TOMBS') },

    { id: 'Q_STAR_MAP', scene: 'AT3', desc: 'Align the Star Map in Astronomy Tower (AT3)', done: solvedPuzzles.has('PUZZLE_STAR_MAP') },

    { id: 'Q_UNSTABLE_FORMULA', scene: 'AL3', desc: 'Stabilize the Unstable Formula in Alchemist Lab (AL3)', done: solvedPuzzles.has('PUZZLE_UNSTABLE_FORMULA') },

    { id: 'Q_CRYSTAL_THEATER', scene: 'CO3', desc: 'Unveil the Crystal Theater (CO3)', done: solvedPuzzles.has('PUZZLE_CRYSTAL_THEATER') },

    { id: 'Q_RETROCAUSAL_PORTCULLIS', scene: 'CR1', desc: 'Solve Retrocausal Portcullis (CR1)', done: solvedPuzzles.has('PUZZLE_RETROCAUSAL_PORTCULLIS') },

    { id: 'Q_RESONANT_HARMONIES', scene: 'MS3', desc: 'Perform Resonant Harmonies (MS3)', done: solvedPuzzles.has('PUZZLE_RESONANT_HARMONIES') },

    { id: 'Q_GATEHOUSE_EXTERIOR', scene: 'GH1', desc: 'Clear the Gatehouse Exterior (GH1)', done: solvedPuzzles.has('PUZZLE_GATEHOUSE_EXTERIOR') },

    { id: 'Q_VENT_ASCENT', scene: 'GH4', desc: 'Ascend the Vent Passage (GH4)', done: solvedPuzzles.has('PUZZLE_VENT_ASCENT') },

    { id: 'Q_SERVANT_SECRET', scene: 'SQ1', desc: 'Uncover the Servant Secret (SQ1)', done: solvedPuzzles.has('PUZZLE_SERVANT_SECRET') },

    { id: 'Q_BARRACKS_RAID', scene: 'B1', desc: 'Raid the Barracks Armory (B1)', done: solvedPuzzles.has('PUZZLE_BARRACKS_RAID') },

    { id: 'Q_RELATIVITY_ANCHOR', scene: 'RC1', desc: 'Anchor the Relativity Cloister (RC1)', done: solvedPuzzles.has('PUZZLE_RELATIVITY_ANCHOR') },

    { id: 'Q_MIRROR_VAULT', scene: 'U4', desc: 'Phase Through Sealed Vault in Undercrypt (U4)', done: solvedPuzzles.has('PUZZLE_MIRROR_VAULT') },

  ];

}

const questLog = {

  get objectives(): QuestObjectiveView[] { return questObjectives(); },

  get active(): string[] { return questObjectives().filter((o) => !o.done).map((o) => o.id); },

  get completed(): string[] { return questObjectives().filter((o) => o.done).map((o) => o.id); },

  get activeCount(): number { return questObjectives().filter((o) => !o.done).length; },

  get completedCount(): number { return questObjectives().filter((o) => o.done).length; },

  get percent(): number {

    const all = questObjectives();

    return all.length === 0 ? 0 : Math.round((all.filter((o) => o.done).length / all.length) * 100);

  },

  isComplete(id: string): boolean {

    return questObjectives().some((o) => o.id === id && o.done);

  },

};

const physics = await RapierPhysics.create(initialSpawn);

let targetPlayerYaw = 0;

let attackLungeOffset = 0;

let cameraShake = 0;

let footstepTimer = 0;

let truthLensActive = false;

let isInventoryOpen = false;

let isQuestLogOpen = false;

let isLoreOpen = false;

let isPaused = false;

let parryTimer = 0;

// Active Spells & Decoys

let activeDecoy: { mesh: THREE.Group; timer: number } | null = null;

interface ActiveProjectile {

  mesh: THREE.Mesh;

  dir: THREE.Vector3;

  distTraveled: number;

  maxDist: number;

}

const activeProjectiles: ActiveProjectile[] = [];

const enemyProjectiles: ActiveProjectile[] = [];

// Extended Room Entities & Boss State

let morvathMesh: THREE.Group | null = null;

let banquetBoarMesh: THREE.Mesh | null = null;

let themisScaleMesh: THREE.Group | null = null;

let yggdraMesh: THREE.Group | null = null;

let rootWallMesh: THREE.Mesh | null = null;

let treeGuardian: Guard | null = null;

let hazelMesh: THREE.Group | null = null;

let kettleMesh: THREE.Mesh | null = null;

let vaelorBoss: Guard | null = null;

let cynthiaCrystal: THREE.Group | null = null;

let vaelorPhase: 1 | 2 | 3 | 4 = 1;

let vaelorPhase2Triggered = false;

const vaelorClones: Guard[] = [];

const phantasmalHounds: Guard[] = [];

let gravityInversionTimer = 0;

void vaelorPhase;

void vaelorClones;

void phantasmalHounds;

void gravityInversionTimer;

// Quest Log Modal

function toggleQuestLog(): void {

  isQuestLogOpen = !isQuestLogOpen;

  if (!questModal) return;

  if (isQuestLogOpen) {

    questModal.classList.add('visible');

    SoundFX.playInventoryToggle(true);

    renderQuestObjectives();

  } else {

    questModal.classList.remove('visible');

    SoundFX.playInventoryToggle(false);

  }

}

function renderQuestObjectives(): void {

  if (!questObjectivesList) return;

  const objs = questObjectives();

  questObjectivesList.innerHTML = '';

  objs.forEach((o) => {

    const item = document.createElement('div');

    item.className = `quest-objective-item ${o.done ? 'done' : ''}`;

    item.innerHTML = `<span>${o.done ? '✓' : '○'}</span> <span>${o.desc}</span>`;

    questObjectivesList.appendChild(item);

  });

}
questCloseBtn?.addEventListener('click', () => {
  if (isQuestLogOpen) toggleQuestLog();

});

hudQuestCard?.addEventListener('click', () => {

  toggleQuestLog();

});

// Victorian Parchment Cartography Map Modal

interface SceneDossierEntry {

  chapter: string;

  subtitle: string;

  desc: string;

  hazards: string;

  isCleansed: () => boolean;

}

const SCENE_DOSSIER: Record<SceneId, SceneDossierEntry> = {

  S00: {

    chapter: 'Prologue: The Arrival',

    subtitle: 'Sunken Courtyard',

    desc: 'A submerged flagstone courtyard choked with photophobic purple briars. Guildmaster Sable\'s starlight raven roosts upon the south balustrade overlooking the mountain mist.',

    hazards: 'Photophobic veil brambles (retreat under light). Safe threshold.',

    isCleansed: () => true,

  },

  OW1: {

    chapter: 'Chapter 1: The Threshold',

    subtitle: 'Outer Barbican',

    desc: 'Outer watchtower ramparts guarded by automaton sentries. Gatekeeper Orin stands at the threshold with a trembling halberd, whispering of forgotten dawn.',

    hazards: 'Clockwork sentry patrols. Grounding required.',

    isCleansed: () => inventory.has('ITEM_IRON_NAIL'),

  },

  GH1: {

    chapter: 'Chapter 1: The Ascent',

    subtitle: 'Guardhouse Vestibule',

    desc: 'A cold-vaulted antechamber echoing with water drips. The iron portcullis bars passage to the upper gatehouse without cold-iron anchoring.',

    hazards: 'Heavy portcullis. Requires Cold-Iron Nail grounding.',

    isCleansed: () => inventory.has('ITEM_IRON_NAIL'),

  },

  GH2: {

    chapter: 'Chapter 1: The Reflection',

    subtitle: 'Gatehouse Upper Tier',

    desc: 'A silver-paned corridor sealed by Duke Vaelor\'s enchanted mirror lock. The silver silhouettes of forgotten guardsmen watch your reflection.',

    hazards: 'Enchanted Mirror Lock mechanism.',

    isCleansed: () => solvedPuzzles.has('PUZZLE_MIRROR_LOCK'),

  },

  GH3: {

    chapter: 'Chapter 1: The Parapet',

    subtitle: 'Barbican Parapet',

    desc: 'Wind-whipped parapet battlements where the heavily armored Gatehouse Captain patrols with a lethal halberd.',

    hazards: 'Gatehouse Captain encounter (Heavy strikes).',

    isCleansed: () => abilities.has('ABILITY_WALL_LEAP'),

  },

  GH4: {

    chapter: 'Chapter 1: The Ascent',

    subtitle: 'Vent Passage',

    desc: 'A narrow vertical shaft connecting the gatehouse to the servants quarters via a dumbwaiter-style climbing puzzle.',

    hazards: 'Falling debris. Requires Climbing 2.',

    isCleansed: () => solvedPuzzles.has('PUZZLE_VENT_ASCENT'),

  },

  B1: {

    chapter: 'Chapter 2: The Servants Hall',

    subtitle: 'Barracks Hall',

    desc: 'Guard quarters with steam-heated radiator pipes. Combat-heavy; an armory holds rare illusion-bane reagents.',

    hazards: 'Guard patrols. Combat encounters.',
    isCleansed: () => solvedPuzzles.has('PUZZLE_BARRACKS_RAID'),
  },
  SQ1: {
    chapter: 'Chapter 2: The Servants Hall',
    subtitle: 'Servants Quarters Main Hall',
    desc: 'Hub of the servant district. NPCs, quests, rumors, and a save point. A hearth mantle hides a servant diary.',

    hazards: 'None. Safe hub.',
    isCleansed: () => solvedPuzzles.has('PUZZLE_SERVANT_SECRET'),
  },
HM1: {
    chapter: 'Chapter 2: Hall of Mirrors',
    subtitle: 'The Glass Gallery',
    desc: 'A kaleidoscopic labyrinth of silver mirrors inhabited by a phasing Mirror Wraith. The True Mirror conceals a hidden portal.',

    hazards: 'Phasing Mirror Wraith & reflective mirror bolts.',
    isCleansed: () => solvedPuzzles.has('PUZZLE_TRUE_MIRROR'),
  },
  BQ1: {
    chapter: 'Chapter 3: The Cenacle',
    subtitle: 'The Cenacle of Eternal Satiety',
    desc: 'A grand banquet hall hosting an unending Victorian feast. Aristocrats chew cold fireplace ash under Nozick\'s phantom satiety glamour.',

    hazards: 'Gastronomic phantom glamour. Requires Truth Lens or Tantalus Goblet.',

    isCleansed: () => solvedPuzzles.has('PUZZLE_FEAST_SATIETY'),

  },

  AG1: {

    chapter: 'Chapter 4: The Arboreal Bough',

    subtitle: 'The Weeping Heartwood',

    desc: 'A moss-carpeted primordial glade housing Yggdra the Ancient Bough. Thorny root brambles choke the mountain passage.',

    hazards: 'Thorny root wall & Ancient Tree Guardian.',

    isCleansed: () => solvedPuzzles.has('PUZZLE_ARBOREAL_WEAVE'),

  },

  MH1: {

    chapter: 'Chapter 5: The Dollhouse',

    subtitle: 'Mother Hazel\'s Hearth',

    desc: 'A quaint gingerbread cottage with a boiling confectionery hearth and shelves of petrified porcelain dolls.',

    hazards: 'Drugged chamomile tea & boiling phantasmic kettle.',

    isCleansed: () => solvedPuzzles.has('PUZZLE_HOSPITALITY_GAMBIT'),

  },

  SAN1: {

    chapter: 'Finale: The Apex Spire',

    subtitle: 'Sanctum of the Glass Heart',

    desc: 'The crystalline throne room of Archillusionist Vaelor. Cynthia\'s spirit is imprisoned within the spinning dodecahedron Glass Heart.',

    hazards: 'Archillusionist Vaelor (Phase 2 Inversion, Levitation, Starlight Beams).',

    isCleansed: () => solvedPuzzles.has('PUZZLE_HOLLOW_GLASS'),

  },

  RC1: {

    chapter: 'Secret Vault: Non-Euclidean Cloister',

    subtitle: 'The Relativity Cloister',

    desc: 'An impossible Escher-like cloister where stone stairways wrap onto vertical walls. Cold-iron grounding is required to stabilize the perspective flux.',

    hazards: 'Non-Euclidean gravitational flux & vertigo loops.',

    isCleansed: () => solvedPuzzles.has('PUZZLE_RELATIVITY_STAIRS'),

  },

  CR1: {

    chapter: 'Act III: The Chronomantic Scriptorium',

    subtitle: 'Threshold of Backward Rain',

    desc: 'A sanctuary of inverted entropy. Rain falls upward, clocks run backward, and the portcullis of retrocausality guards the vault.',

    hazards: 'Temporal paradox. Requires Tachyon Phial.',

    isCleansed: () => solvedPuzzles.has('PUZZLE_RETROCAUSAL_PORTCULLIS'),

  },

  MS3: {

    chapter: 'Act III: The Gilded Music Salon',

    subtitle: 'Parquet of Resonant Harmonies',

    desc: 'A 3-lane rhythm floor of glass-armonica keys. Strike the lanes in harmony to break the stasis.',

    hazards: 'Dissonant resonance. Requires Glass-Armonica Mallet.',
    isCleansed: () => solvedPuzzles.has('PUZZLE_RESONANT_HARMONIES'),
  },
BT1: {
    chapter: 'Secret Spire: The Aeolian Baffles',
    subtitle: 'The Aeolian Bell Tower',
    desc: 'A windswept Victorian bell tower housing giant bronze acoustic baffles. Ringing the Echo Bell harmonizes the gale-force chime resonance.',

    hazards: 'Gale dissonance & resonant shockwaves.',
    isCleansed: () => solvedPuzzles.has('PUZZLE_AEOLIAN_CHIME'),
  },
  CO1: {
    chapter: 'Act IV: The Veil Colosseum',
    subtitle: 'The Veil Colosseum',
    desc: 'An illusionist arena with silent bulb-headed spectators, combat gauntlets, and puzzle-trials. Hidden passage leads to the Undercrypt.',
    hazards: 'Colosseum Beast and arena waves.',

    isCleansed: () => solvedPuzzles.has('PUZZLE_HOLLOW_GLASS'),

  },

  CO3: {

    chapter: 'Act IV: Crystal Theater',

    subtitle: 'Crystal Theater',

    desc: 'A crystalline theater where Duchess Seraphina Vane performs her phantasmal plays. The Mirror Phase brand is hidden behind the shattered vanity mirror.',

    hazards: 'Phantom audience and illusion traps.',

    isCleansed: () => solvedPuzzles.has('PUZZLE_MIRROR_VAULT'),

  },

  U1: { chapter: 'Undercrypt', subtitle: 'Undercrypt Entrance', desc: 'Real undead and broken monk spirits beneath the keep.', hazards: 'Undead monks.', isCleansed: () => true },

  U2: { chapter: 'Undercrypt', subtitle: 'Monk Tombs', desc: 'Three monk spirits must be laid to rest.', hazards: 'Undead monks.', isCleansed: () => solvedPuzzles.has('PUZZLE_ECHO_CHAMBER') },

  U3: { chapter: 'Undercrypt', subtitle: 'Echo Chamber', desc: 'Repeat Vaelor\'s oath via Echo Bell.', hazards: 'Echo puzzle.', isCleansed: () => solvedPuzzles.has('PUZZLE_ECHO_CHAMBER') },

  U4: { chapter: 'Undercrypt', subtitle: 'Secret Vault', desc: 'True backstory and Heart hint.', hazards: 'None.', isCleansed: () => true },

  TR1: { chapter: 'Trophy Hall', subtitle: 'Gallery Entrance', desc: 'Mounted beasts line the walls; Curator greets.', hazards: 'Mimic chests.', isCleansed: () => true },
  TR2: { chapter: 'Trophy Hall', subtitle: 'Beast Row', desc: 'Five trophies; examine each.', hazards: 'Mimic chests.', isCleansed: () => true },
  TR3: { chapter: 'Trophy Hall', subtitle: 'The Slain Beast', desc: 'Hidden passage behind largest trophy.', hazards: 'Mimic chests.', isCleansed: () => true },
  TR4: { chapter: 'Trophy Hall', subtitle: 'Curator\'s Alcove', desc: 'Confront Curator; lore reveal.', hazards: 'None.', isCleansed: () => true },
  AT1: { chapter: 'Astronomy Tower', subtitle: 'Star Chamber', desc: 'Telescope and star-map floor.', hazards: 'None.', isCleansed: () => true },
  AT2: { chapter: 'Astronomy Tower', subtitle: 'Constellation Floor', desc: 'Align telescope to 3 constellations.', hazards: 'Puzzle.', isCleansed: () => solvedPuzzles.has('PUZZLE_CONSTELLATION') },
  AT3: { chapter: 'Astronomy Tower', subtitle: 'Hidden Room', desc: 'Star map reveals secret doors at night.', hazards: 'None.', isCleansed: () => true },

  AL1: { chapter: 'Alchemist\'s Lab', subtitle: 'Lab', desc: 'Brewing bench and reagents.', hazards: 'Unstable experiments.', isCleansed: () => true },

  AL2: { chapter: 'Alchemist\'s Lab', subtitle: 'Storage', desc: 'Explosive reagents.', hazards: 'Explosions.', isCleansed: () => true },

  AL3: { chapter: 'Alchemist\'s Lab', subtitle: 'Vex Office', desc: 'Recipes and crafting.', hazards: 'None.', isCleansed: () => true },

  PB1: { chapter: 'Prison Block', subtitle: 'Cell Row', desc: 'Real prisoners in cells.', hazards: 'Guards.', isCleansed: () => true },

  PB2: { chapter: 'Prison Block', subtitle: 'Guard Post', desc: 'Guard patrols.', hazards: 'Guards.', isCleansed: () => true },

  PB3: { chapter: 'Prison Block', subtitle: 'Warden Office', desc: 'Warden\'s office.', hazards: 'Warden.', isCleansed: () => true },

  PB4: { chapter: 'Prison Block', subtitle: 'Escape Tunnel', desc: 'Escape route.', hazards: 'None.', isCleansed: () => true },

  RG1: { chapter: 'Rooftop Gardens', subtitle: 'Terrace', desc: 'Exterior terraces with wind puzzles.', hazards: 'Wind.', isCleansed: () => true },

  RG2: { chapter: 'Rooftop Gardens', subtitle: 'Wind Maze', desc: 'Redirect gusts.', hazards: 'Wind.', isCleansed: () => true },

  RG3: { chapter: 'Rooftop Gardens', subtitle: 'Glider Launch', desc: 'Unlock glider.', hazards: 'None.', isCleansed: () => true },

  RG4: { chapter: 'Rooftop Gardens', subtitle: 'Vista Point', desc: 'Glider shortcut.', hazards: 'None.', isCleansed: () => true },

  VR1: { chapter: 'Void Realm', subtitle: 'Threshold', desc: 'Enter at midnight.', hazards: 'Dream logic.', isCleansed: () => true },

  VR2: { chapter: 'Void Realm', subtitle: 'Dream Logic Room', desc: 'Survive dream-logic.', hazards: 'Dream logic.', isCleansed: () => true },

  VR3: { chapter: 'Void Realm', subtitle: 'The Core', desc: 'Return sane.', hazards: 'None.', isCleansed: () => true },

  RS1: { chapter: 'Relativity Cloister', subtitle: 'Entry Landing', desc: 'First stairway; gravity feels normal.', hazards: 'Dreamwalkers.', isCleansed: () => true },

  RS2: { chapter: 'Relativity Cloister', subtitle: 'Double-Sided Stair', desc: 'One stroller walks above, another walks below upside-down.', hazards: 'Dreamwalkers.', isCleansed: () => true },

  RS3: { chapter: 'Relativity Cloister', subtitle: 'Wall-Floor Gallery', desc: 'A wall here is a floor to a Dreamwalker; window opens onto a park illusion.', hazards: 'Dreamwalkers.', isCleansed: () => true },

  RS4: { chapter: 'Relativity Cloister', subtitle: 'Perspective Hub', desc: 'Central hub; set landing as floor via interact.', hazards: 'Dreamwalkers.', isCleansed: () => true },

  RS5: { chapter: 'Relativity Cloister', subtitle: 'Window Garden', desc: 'Doorway leads to park-like outdoor setting.', hazards: 'Dreamwalkers.', isCleansed: () => true },

  RS6: { chapter: 'Relativity Cloister', subtitle: 'The Dining Table', desc: 'The Diner sits eternally.', hazards: 'None.', isCleansed: () => true },

};

const ORDERED_SCENES: SceneId[] = ['S00', 'OW1', 'GH1', 'GH2', 'GH3', 'HM1', 'BQ1', 'AG1', 'MH1', 'SAN1', 'RC1', 'BT1', 'CO1', 'CO3', 'U1', 'U2', 'U3', 'U4', 'TR1', 'TR2', 'TR3', 'TR4', 'AT1', 'AT2', 'AT3', 'AL1', 'AL2', 'AL3', 'PB1', 'PB2', 'PB3', 'PB4', 'RG1', 'RG2', 'RG3', 'RG4', 'VR1', 'VR2', 'VR3', 'RS1', 'RS2', 'RS3', 'RS4', 'RS5', 'RS6'];

function toggleMap(): void {

  isMapOpen = !isMapOpen;

  if (!mapModal) return;

  if (isMapOpen) {

    selectedMapSceneId = currentSceneId;

    mapModal.classList.add('visible');

    SoundFX.playMapToggle(true);

    renderMap();

  } else {

    mapModal.classList.remove('visible');

    SoundFX.playMapToggle(false);

  }

}

function renderMap(): void {

  if (!mapNodesContainer || !mapDiscoveryBadge || !hudMapSubtitle) return;

  const exploredCount = discoveredScenes.size;

  mapDiscoveryBadge.textContent = `${exploredCount} / ${ORDERED_SCENES.length} Explored`;

  hudMapSubtitle.textContent = `${exploredCount} / ${ORDERED_SCENES.length} Explored`;

  mapNodesContainer.innerHTML = '';

  ORDERED_SCENES.forEach((sId) => {

    const isDiscovered = discoveredScenes.has(sId);

    const sceneInfo = sceneById.get(sId);

    const dossier = SCENE_DOSSIER[sId];

    const isCurrent = sId === currentSceneId;

    const isSelected = sId === selectedMapSceneId;

    const isCleansed = dossier ? dossier.isCleansed() : false;

    const card = document.createElement('div');

    card.className = `map-room-card ${isCurrent ? 'current-player' : ''} ${isSelected ? 'active' : ''} ${!isDiscovered ? 'undiscovered' : ''}`;

    if (isDiscovered && sceneInfo && dossier) {

      card.innerHTML = `

        <div class="map-room-top">

          <span class="map-room-code">${sId}</span>

          ${isCurrent ? '<span class="status-current" style="font-size:11px; font-weight:700">🧭 HERE</span>' : isCleansed ? '<span class="status-cleansed" style="font-size:11px; font-weight:700">✓ CLEANSED</span>' : '<span class="status-hazardous" style="font-size:11px; font-weight:700">⚔️ UNCLEANSED</span>'}

        </div>

        <div class="map-room-name">${sceneInfo.name}</div>

        <div class="map-room-status ${isCurrent ? 'status-current' : isCleansed ? 'status-cleansed' : 'status-hazardous'}">

          ${isCurrent ? '<span>● Active Infiltration Post</span>' : isCleansed ? '<span>● Citadel Ward Restored</span>' : '<span>● Hostile Phantasms</span>'}

        </div>

      `;

      card.addEventListener('click', () => {

        selectedMapSceneId = sId;

        renderMap();

      });

    } else {

      card.innerHTML = `

        <div class="map-room-top">

          <span class="map-room-code">${sId}</span>

          <span class="status-unknown" style="font-size:11px; font-weight:700">🌫️ FOG</span>

        </div>

        <div class="map-room-name" style="color: #78716c">??? [Terra Incognita]</div>

        <div class="map-room-status status-unknown">

          <span>● Undiscovered Chamber</span>

        </div>

      `;

    }

    mapNodesContainer.appendChild(card);

  });

  renderMapDossier(selectedMapSceneId);

}

function renderMapDossier(sId: SceneId): void {

  if (!mapDossierTitle || !mapDossierTag || !mapDossierDesc || !mapDossierStatus || !btnFastTravel) return;

  const isDiscovered = discoveredScenes.has(sId);

  const sceneInfo = sceneById.get(sId);

  const dossier = SCENE_DOSSIER[sId];

  if (!isDiscovered || !sceneInfo || !dossier) {

    mapDossierTag.textContent = 'Uncharted Sector';

    mapDossierTitle.textContent = 'Terra Incognita';

    mapDossierDesc.textContent = 'This sector has not yet been surveyed. Advance through the fortress corridors to ink this chamber onto your map.';

    mapDossierStatus.textContent = 'Veil mists obscure all topological details.';

    mapDossierStatus.style.color = '#78716c';

    btnFastTravel.disabled = true;

    btnFastTravel.textContent = '⚡ Fast Travel Unavailable';

    return;

  }

  const isCurrent = sId === currentSceneId;

  const isCleansed = dossier.isCleansed();

  mapDossierTag.textContent = dossier.chapter;

  mapDossierTitle.textContent = `${sceneInfo.name} (${sId})`;

  mapDossierDesc.textContent = dossier.desc;

  mapDossierStatus.textContent = dossier.hazards;

  mapDossierStatus.style.color = isCleansed ? '#10b981' : '#f59e0b';

  if (isCurrent) {

    btnFastTravel.disabled = true;

    btnFastTravel.textContent = '🧭 Currently Present';

  } else {

    btnFastTravel.disabled = false;

    btnFastTravel.textContent = `⚡ Fast Travel to ${sceneInfo.name}`;

    btnFastTravel.onclick = () => {

      loadScene(sId);

      toggleMap();

      SoundFX.playShadowStep();

      SoundFX.playEchoBell();

      showToast(`Fast Traveled to: ${sceneInfo.name}`);

    };

  }

}

mapCloseBtn?.addEventListener('click', () => {

  if (isMapOpen) toggleMap();

});

hudMapCard?.addEventListener('click', () => {

  toggleMap();

});

// Spell 1: Mirror Decoy ([R])

function castMirrorDecoy(): void {

  if (playerState.fp < 25) {

    showToast('Insufficient Focus Points (Requires 25 FP)');

    SoundFX.playLocked();

    return;

  }

  playerState.fp -= 25;

  SoundFX.playDecoyCast();

  if (activeDecoy) {

    engine.scene.remove(activeDecoy.mesh);

    activeDecoy = null;

  }

  const decoyMesh = kaelenModel.clone();

  decoyMesh.position.set(playerState.x, 0.6, playerState.z);

  decoyMesh.rotation.y = playerMesh.rotation.y;

  decoyMesh.traverse((node) => {

    if (node instanceof THREE.Mesh) {

      node.material = new THREE.MeshBasicMaterial({

        color: 0x38bdf8,

        wireframe: true,

        transparent: true,

        opacity: 0.65

      });

    }

  });

  const decoyLight = new THREE.PointLight(0x38bdf8, 2.0, 5);

  decoyMesh.add(decoyLight);

  engine.scene.add(decoyMesh);

  activeDecoy = { mesh: decoyMesh, timer: 5.5 };

  showToast('Spell: Mirror Decoy Dispatched');

}

// Spell 2: Shadow Step / Smoke Dash ([C])

function castShadowStep(): void {
  if (playerState.fp < 15) {
    showToast('Insufficient Focus Points (Requires 15 FP)');
    SoundFX.playLocked();
    return;
  }
  playerState.fp -= 15;
  SoundFX.playShadowStep();
  SoundFX.playDodgeRoll();
  const dirX = Math.sin(playerMesh.rotation.y);
  const dirZ = Math.cos(playerMesh.rotation.y);
  if (mainChar) {
    mainChar.combat.pressDodge(dirX, dirZ);
    mainChar.combatParticles?.spawnDodgeDust(playerMesh.position, { x: dirX, y: 0, z: dirZ });
  }
  cameraShake = 0.15;
  flashMesh(playerMesh, 0x7c3aed, 220);
  showToast('Spell: Shadow Step');
}

// Spell 3: Glass Dart ([V])

function spawnGlassDartProjectile(originPos?: THREE.Vector3, shootDir?: THREE.Vector3): void {
  const geom = new THREE.ConeGeometry(0.08, 0.45, 6);
  geom.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
    roughness: 0.1
  });
  const projectileMesh = new THREE.Mesh(geom, mat);
  if (originPos) {
    projectileMesh.position.copy(originPos);
  } else {
    projectileMesh.position.set(playerState.x, 0.8, playerState.z);
  }
  const dir = shootDir ? shootDir.clone().normalize() : new THREE.Vector3(Math.sin(playerMesh.rotation.y), 0, Math.cos(playerMesh.rotation.y)).normalize();
  projectileMesh.rotation.y = Math.atan2(dir.x, dir.z);
  engine.scene.add(projectileMesh);
  activeProjectiles.push({
    mesh: projectileMesh,
    dir,
    distTraveled: 0,
    maxDist: 9.0
  });
}

function castGlassDart(): void {
  if (playerState.fp < 15) {
    showToast('Insufficient Focus Points (Requires 15 FP)');
    SoundFX.playLocked();
    return;
  }
  playerState.fp -= 15;
  if (mainChar) {
    mainChar.combat.setAimYaw(playerMesh.rotation.y);
    mainChar.combat.pressCast();
  } else {
    SoundFX.playGlassDart();
    spawnGlassDartProjectile();
  }
  showToast('Spell: Glass Dart');
}

// 3D Echo Bell Rings

const echoRings: { mesh: THREE.Mesh; scale: number; opacity: number }[] = [];

function triggerEchoBellRing(origin: THREE.Vector3): void {

  const geom = new THREE.RingGeometry(0.2, 0.38, 36);

  geom.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshBasicMaterial({

    color: 0x38bdf8,

    transparent: true,

    opacity: 0.95,

    side: THREE.DoubleSide

  });

  const ringMesh = new THREE.Mesh(geom, mat);

  ringMesh.position.set(origin.x, 0.08, origin.z);

  engine.scene.add(ringMesh);

  echoRings.push({ mesh: ringMesh, scale: 1.0, opacity: 1.0 });

}

// Dialogue Controller

interface DialogueChoice {

  text: string;

  nextDialogueNodeId?: string;

  requiredItemId?: string;

  requiredStat?: { stat: string; minVal: number };

  actionTrigger?: string;

  actionPayload?: string;

}

interface DialogueNode {

  id: string;

  speaker: string;

  speakerTitle?: string;

  text: string;

  choices: DialogueChoice[];

}

let activeDialogue: { npcKey: string; currentNodeId: string } | null = null;

function openDialogue(npcKey: string, startNodeId?: string): void {

  const npcData = (dialogueData as Record<string, any>)[npcKey];

  if (!npcData) return;

  const nodeId = startNodeId || npcData.rootNodeId;

  activeDialogue = { npcKey, currentNodeId: nodeId };

  renderDialogueNode(npcKey, nodeId);

  dialogueModal?.classList.add('visible');

  SoundFX.playDialogueNext();

}

function closeDialogue(): void {

  activeDialogue = null;

  dialogueModal?.classList.remove('visible');

  SoundFX.playDialogueNext();

}

function renderDialogueNode(npcKey: string, nodeId: string): void {

  const npcData = (dialogueData as Record<string, any>)[npcKey];

  const node: DialogueNode | undefined = npcData?.nodes[nodeId];

  if (!node || !dialogueSpeaker || !dialogueTitle || !dialogueText || !dialogueChoices) {

    closeDialogue();

    return;

  }

  dialogueSpeaker.textContent = node.speaker;

  dialogueTitle.textContent = node.speakerTitle || '';

  dialogueText.textContent = node.text;

  dialogueChoices.innerHTML = '';

  let validCount = 0;

  node.choices.forEach((choice) => {

    if (choice.requiredItemId) {

      const hasItem = inventory.has(choice.requiredItemId) || (choice.requiredItemId === 'relic_iron_nails' && inventory.has('ITEM_IRON_NAIL'));

      if (!hasItem) return;

    }

    if (choice.requiredStat) {

      const statVal = stats[choice.requiredStat.stat as keyof typeof stats] ?? 0;

      if (statVal < choice.requiredStat.minVal) return;

    }

    validCount++;

    const btn = document.createElement('button');

    btn.className = 'dialogue-choice-btn';

    btn.innerHTML = `<kbd>${validCount}</kbd> <span>${choice.text}</span>`;

    btn.addEventListener('click', () => chooseDialogueOption(choice));

    dialogueChoices.appendChild(btn);

  });

  if (validCount === 0) {

    const btn = document.createElement('button');

    btn.className = 'dialogue-choice-btn';

    btn.innerHTML = `<kbd>E</kbd> <span>[Farewell / Close]</span>`;

    btn.addEventListener('click', closeDialogue);

    dialogueChoices.appendChild(btn);

  }

}

function chooseDialogueOption(choice: DialogueChoice): void {

  SoundFX.playDialogueNext();

  if (choice.actionTrigger === 'GIVE_ITEM' && choice.actionPayload) {

    if (choice.actionPayload.startsWith('ABILITY_')) {

      abilities.add(choice.actionPayload);

    } else {

      inventory.add(choice.actionPayload);

    }

    SoundFX.playPickup();

    showToast(`Acquired: ${choice.actionPayload.replace(/_/g, ' ').toUpperCase()}`);

    awardConviction('empathy', 1, `gift:${activeDialogue?.npcKey ?? choice.actionPayload}`);

    // Trigger associated room puzzle resolution upon quest dialogue completion

    if (choice.actionPayload === 'ITEM_TANTALUS_GOBLET') {

      solvedPuzzles.add('PUZZLE_FEAST_SATIETY');

      SoundFX.playFeastWaltz();

      if (banquetBoarMesh) {

        (banquetBoarMesh.material as THREE.MeshStandardMaterial).color.setHex(0x374151);

        (banquetBoarMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x111827);

      }

    } else if (choice.actionPayload === 'ABILITY_STARLIGHT_DASH') {

      solvedPuzzles.add('PUZZLE_ARBOREAL_WEAVE');

      if (rootWallMesh) rootWallMesh.visible = false;

      SoundFX.playTreeGroan();

    } else if (choice.actionPayload === 'ITEM_SUGAR_SPOON') {

      solvedPuzzles.add('PUZZLE_HOSPITALITY_GAMBIT');

      SoundFX.playWitchGiggle();

    }

    saveCheckpoint();

  } else if (choice.actionTrigger === 'START_COMBAT') {

    closeDialogue();

    if (choice.actionPayload === 'tree_guardian' && treeGuardian) {

      treeGuardian.state = 'chase';

    }

    showToast('Encounter Initiated: Defend yourself!');

    return;

  } else if (choice.actionTrigger === 'ORIN_BLUFF') {

    if (stats.CHA >= 9) {

      questRuntime.setFlag('ORIN_CHA_CHECK_PASSED', true);

      questRuntime.completeQuest('Q_GATEKEEPER_DOUBT');

      if (activeDialogue) {

        activeDialogue.currentNodeId = 'ORIN_REWARD';

        renderDialogueNode(activeDialogue.npcKey, 'ORIN_REWARD');

      }

      return;

    } else {

      closeDialogue();

      if (orinMesh) {

        orinMesh.traverse((node) => {

          if (node instanceof THREE.Mesh && node.material && 'emissive' in node.material) {

            (node.material as THREE.MeshStandardMaterial).emissive.setHex(0xef4444);

          }

        });

      }

      questRuntime.triggerSteamJam('GH1', 0, -2);

      questRuntime.setFlag('ORIN_CHA_CHECK_FAILED', true);

      showToast('Orin panics! The portcullis jams half-open and scalding steam floods the gatehouse.');

      SoundFX.playGlassShatter();

      return;

    }

  }

  if (choice.nextDialogueNodeId === 'ORIN_GROUNDED') {

    questRuntime.completeQuest('Q_GATEKEEPER_DOUBT');

    questRuntime.setFlag('ORIN_GROUNDED', true);

  }

  if (choice.nextDialogueNodeId === 'ORIN_REWARD') {

    questRuntime.completeQuest('Q_GATEKEEPER_DOUBT');

    questRuntime.setFlag('QUEST_Q1_REWARDED', true);

  }

  if (choice.nextDialogueNodeId === 'ORIN_COMBAT') {

    questRuntime.setFlag('ORIN_STR_CHECK_PASSED', true);

  }

  if (choice.nextDialogueNodeId && activeDialogue) {

    activeDialogue.currentNodeId = choice.nextDialogueNodeId;

    renderDialogueNode(activeDialogue.npcKey, choice.nextDialogueNodeId);

  } else {

    closeDialogue();

  }

}

// Inventory Database & Modal

const ITEM_LORE_DATABASE: Record<string, { name: string; tier: string; category: string; stats: string; desc: string; icon: string }> = {

  stiletto_shadowhand: {

    name: 'Stiletto of the Shadowhand',

    tier: 'Master Thief Weapon',

    category: 'Dagger',

    stats: '+25 Piercing Dmg, 1.35m Reach',

    desc: 'Folded Victorian carbon steel tempered in whale-oil. Light, silent, and balanced specifically for severing clockwork tension springs.',

    icon: '🗡️'

  },

  ITEM_IRON_NAIL: {

    name: 'Iron Nail (Grounding Relic)',

    tier: 'Common Relic',

    category: 'Tactical Curio',

    stats: '+5 Ethereal Resistance, Grounding',

    desc: 'A heavy forged cold-iron carpenter nail. When driven into stone or held tightly, its sheer material density dispels local phantasms, anchors non-Euclidean perspective stairways, and awakens clockwork automatons from their dream stasis.',

    icon: '📌'

  },

  ABILITY_WALL_LEAP: {

    name: 'Wall Leap',

    tier: 'Acrobatic Traversal',

    category: 'Infiltration Feat',

    stats: 'Enables vertical rebound across walls',

    desc: 'Technique claimed from the Gatehouse Captain. Spring from vertical stonework to reach high parapet embrasures and bypass floor pressure plates.',

    icon: '⚡'

  },

  key_gatehouse: {

    name: 'Gatehouse Key',

    tier: 'Essential Key',

    category: 'Door Mechanism',

    stats: 'Unlocks Inner Barbican Portcullis',

    desc: 'A heavy brass mortise key stamped with Duke Vaelor\'s twin-raven crest. Given by Gatekeeper Orin after his mind was grounded by cold iron.',

    icon: '🗝️'

  },

  ITEM_TANTALUS_GOBLET: {

    name: 'The Tantalus Goblet',

    tier: 'Ethereal Relic',

    category: 'Vessel of Ash',

    stats: 'Dispels Phantom Satiety & Gastronomic Glamours',

    desc: 'Forged in Nozick\'s Crucible. Liquid poured into it drains through invisible capillaries into the nether, demonstrating the hollow nature of phantom sustenance.',

    icon: '🍷'

  },

  ABILITY_STARLIGHT_DASH: {

    name: 'Starlight Dash',

    tier: 'Ancient Arboreal Feat',

    category: 'Phase Traversal',

    stats: 'Surges forward with starlight phase evasion',

    desc: 'Bestowed by Yggdra the Ancient Bough. Uncoils spatial knots and pierces thorny root barriers with pure starlight acceleration.',

    icon: '✨'

  },

  ABILITY_MIRROR_PHASE: {

    name: 'Mirror Phase',

    tier: 'Prismatic Traversal',

    category: 'Phase Traversal',

    stats: 'Phases through iron portcullises and cracked illusion seams',

    desc: 'Acquired by shattering the True Mirror in the Halls of Mirrors. Dash forward into barred gates and cracked illusion seams, phasing through them.',

    icon: 'Prismatic'

  },

  ITEM_SUGAR_SPOON: {

    name: 'Witch\'s Sugar Spoon',

    tier: 'Alchemical Relic',

    category: 'Confectionery Tool',

    stats: 'Stirs Phantasmic Concoctions & Reveals Flues',

    desc: 'Carved by Mother Hazel from petrified sugar cane. Dissolves confectionery illusions and unlocks chimney flue escape routes.',

    icon: '🥄'

  },

  ABILITY_GRAVITON_INVERSION: {

    name: 'Graviton Inversion',

    tier: 'Master Illusionist Feat',

    category: 'Transmutation',

    stats: 'Inverts local gravitational flux',

    desc: 'Acquired upon shattering Archillusionist Vaelor\'s Glass Heart. Inverts local gravitational flux, allowing ascension to the Highest Spire.',

    icon: '🌌'

  },

  ITEM_COLD_IRON_KEY: {

    name: 'Cold-Iron Cloister Key',

    tier: 'Ancient Key',

    category: 'Non-Euclidean Vault',

    stats: 'Unlocks Escherian Wall Portals',

    desc: 'Found in the Relativity Cloister. Stamped with impossible geometry runes, this key stabilizes perspective stairs.',

    icon: '🗝️'

  },

  ITEM_CHIME_TUNER: {

    name: 'Aeolian Chime Tuner',

    tier: 'Harmonic Relic',

    category: 'Acoustic Tool',

    stats: 'Harmonizes Baffle Resonance & Echo Bells',

    desc: 'Constructed of resonant bronze from the Aeolian Bell Tower. Vibrates with pure fourths and fifths when brought near secret passageways.',

    icon: '🔔'

  }

};

// Crafting / Alchemy System

const CRAFTING_RECIPES: { id: string; name: string; icon: string; requires: Record<string, number>; result: string; desc: string }[] = [

  { id: 'smoke_pellet', name: 'Smoke Pellet x3', icon: '💨', requires: { 'ITEM_SULFUR': 2, 'ITEM_CHARCOAL': 1 }, result: 'ITEM_SMOKE_PELLET', desc: 'Break line of sight for 4 seconds. Requires 2 Sulfur + 1 Charcoal.' },

  { id: 'starlight_vial', name: 'Starlight Vial', icon: '✨', requires: { 'ITEM_STARLIGHT_PEPPER': 1, 'ITEM_GLASS_VIAL': 1 }, result: 'ITEM_STARLIGHT_VIAL', desc: 'Restore 40 STA, cure Confused. Requires 1 Starlight Pepper + 1 Glass Vial.' },

  { id: 'focus_draught', name: 'Focus Draught', icon: '👁️', requires: { 'ITEM_MIRROR_SHARD': 1, 'ITEM_STARLIGHT_PEPPER': 1 }, result: 'ITEM_FOCUS_DRAUGHT', desc: '+20% crit for 60s. Requires 1 Mirror Shard + 1 Starlight Pepper.' },

  { id: 'iron_nail', name: 'Iron Nail x5', icon: '📌', requires: { 'ITEM_IRON_ORE': 2 }, result: 'ITEM_IRON_NAIL', desc: 'Grounding relic. Requires 2 Iron Ore.' },

];

let isCraftingOpen = false;

let selectedRecipeId: string | null = null;

function toggleCrafting(): void {

  isCraftingOpen = !isCraftingOpen;

  const modal = document.getElementById('hud-crafting-modal');

  if (!modal) return;

  if (isCraftingOpen) {

    modal.classList.add('visible');

    renderCraftingRecipes();

    SoundFX.playInventoryToggle(true);

  } else {

    modal.classList.remove('visible');

    SoundFX.playInventoryToggle(false);

  }

}

function renderCraftingRecipes(): void {

  const container = document.getElementById('craft-recipes');

  const titleEl = document.getElementById('craft-details-title');

  const bodyEl = document.getElementById('craft-details-body');

  if (!container) return;

  container.innerHTML = '';

  for (const recipe of CRAFTING_RECIPES) {

    const canCraft = Object.entries(recipe.requires).every(([item, count]) => {

      let have = 0;

      for (const inv of inventory) if (inv === item) have++;

      return have >= count;

    });

    const btn = document.createElement('button');

    btn.className = 'inv-slot';

    btn.style.cssText = 'width:100%;aspect-ratio:auto;padding:10px 14px;flex-direction:row;justify-content:flex-start;gap:12px;cursor:pointer;';

    btn.innerHTML = `<span style="font-size:22px">${recipe.icon}</span><div style="flex:1;text-align:left;"><div style="font-size:13px;font-weight:600;color:#f8fafc">${recipe.name}</div><div style="font-size:10px;color:${canCraft ? '#10b981' : '#ef4444'}">${canCraft ? 'Ready to brew' : 'Missing reagents'}</div></div>`;

    btn.addEventListener('click', () => {

      selectedRecipeId = recipe.id;

      if (titleEl) titleEl.textContent = recipe.name;

      if (bodyEl) bodyEl.innerHTML = `${recipe.desc}<br><br><button id="brew-btn" style="background:#0284c7;border:1px solid #38bdf8;color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;${canCraft ? '' : 'opacity:0.4;pointer-events:none;'}" ${canCraft ? '' : 'disabled'}>Brew</button>`;

      const brewBtn = document.getElementById('brew-btn');

      if (brewBtn) brewBtn.addEventListener('click', () => brewRecipe(recipe.id));

    });

    container.appendChild(btn);

  }

  if (titleEl && !selectedRecipeId) titleEl.textContent = 'Select a recipe';

  if (bodyEl && !selectedRecipeId) bodyEl.textContent = 'Click a recipe to see requirements and brew.';

}

function brewRecipe(recipeId: string): void {

  const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);

  if (!recipe) return;

  const canCraft = Object.entries(recipe.requires).every(([item, count]) => {

    let have = 0;

    for (const inv of inventory) if (inv === item) have++;

    return have >= count;

  });

  if (!canCraft) { showToast('Missing reagents'); return; }

  // Consume reagents

  for (const [item, count] of Object.entries(recipe.requires)) {

    let removed = 0;

    for (const inv of [...inventory]) {

      if (inv === item && removed < count) { inventory.delete(inv); removed++; }

    }

  }

  // Add result

  inventory.add(recipe.result);

  showToast(`Brewed: ${recipe.name}`);

  SoundFX.playPickup();

  saveCheckpoint();

  renderCraftingRecipes();

  // Update details

  const titleEl = document.getElementById('craft-details-title');

  const bodyEl = document.getElementById('craft-details-body');

  if (titleEl) titleEl.textContent = recipe.name;

  if (bodyEl) bodyEl.innerHTML = `${recipe.desc}<br><br><span style="color:#10b981">Brewed successfully!</span>`;

}

// Lore Codex toggle

let isLoreCodexOpen = false;

function toggleLoreCodex(): void {

  isLoreCodexOpen = !isLoreCodexOpen;

  const modal = document.getElementById('hud-lore-codex-modal');

  if (!modal) return;

  if (isLoreCodexOpen) {

    modal.classList.add('visible');

    renderLoreCodex();

    SoundFX.playInventoryToggle(true);

  } else {

    modal.classList.remove('visible');

    SoundFX.playInventoryToggle(false);

  }

}

function renderLoreCodex(): void {

  const list = document.getElementById('lore-codex-list');

  const titleEl = document.getElementById('lore-codex-title');

  const bodyEl = document.getElementById('lore-codex-body');

  if (!list) return;

  list.innerHTML = '';

  for (const lore of loreObjects) {

    const discovered = discoveredLore.has(lore.id);

    const btn = document.createElement('button');

    btn.className = 'inv-slot';

    btn.style.cssText = 'width:100%;aspect-ratio:auto;padding:10px 14px;flex-direction:row;justify-content:flex-start;gap:12px;cursor:pointer;';

    btn.innerHTML = '<span style="font-size:18px">' + (discovered ? 'scroll' : 'fog') + '</span><div style="flex:1;text-align:left;"><div style="font-size:13px;font-weight:600;color:' + (discovered ? '#f8fafc' : '#64748b') + '">' + (discovered ? lore.name : 'Undiscovered Record') + '</div><div style="font-size:10px;color:#94a3b8">' + (discovered ? lore.sceneId : '???') + '</div></div>';

    if (discovered) {

      btn.addEventListener('click', () => {

        if (titleEl) titleEl.textContent = lore.title;

        if (bodyEl) bodyEl.textContent = lore.text;

      });

    } else {

      btn.style.opacity = '0.4';

      btn.style.cursor = 'default';

    }

    list.appendChild(btn);

  }

  if (titleEl && !discoveredLore.size) titleEl.textContent = 'No records discovered yet';

  if (bodyEl && !discoveredLore.size) bodyEl.textContent = 'Inspect lore objects in the world to fill this codex.';

}

document.getElementById('lore-codex-close-btn')?.addEventListener('click', () => toggleLoreCodex());

// Inventory toggle

function toggleInventory(): void {

  isInventoryOpen = !isInventoryOpen;

  if (!invModal) return;

  if (isInventoryOpen) {

    invModal.classList.add('visible');

    SoundFX.playInventoryToggle(true);

    renderInventorySlots();

  } else {

    invModal.classList.remove('visible');

    SoundFX.playInventoryToggle(false);

  }

}

function renderInventorySlots(): void {

  if (!invGrid || !invDetailsTitle || !invDetailsBody) return;

  invGrid.innerHTML = '';

  const allItems = ['stiletto_shadowhand', ...Array.from(inventory), ...Array.from(abilities)];

  allItems.forEach((id, idx) => {

    const info = ITEM_LORE_DATABASE[id] || {

      name: id.replace(/_/g, ' '),

      tier: 'Curio',

      category: 'Item',

      stats: 'Mysterious artifact',

      desc: 'An artifact recovered from the corridors of Veilkeep.',

      icon: '📦'

    };

    const slot = document.createElement('div');

    slot.className = `inv-slot ${idx === 0 ? 'active' : ''}`;

    slot.innerHTML = `<span>${info.icon}</span><span class="inv-slot-name">${info.name}</span>`;

    slot.addEventListener('click', () => {

      document.querySelectorAll('.inv-slot').forEach(s => s.classList.remove('active'));

      slot.classList.add('active');

      invDetailsTitle.innerHTML = `<span style="color:#d4af37">${info.name}</span> <span style="font-size:11px; color:#94a3b8">(${info.tier} · ${info.category})</span>`;

      invDetailsBody.innerHTML = `<div style="color:#38bdf8; font-weight:600; margin-bottom:4px;">${info.stats}</div><div>${info.desc}</div>`;

    });

    invGrid.appendChild(slot);

  });

  if (allItems.length > 0) {

    const first = ITEM_LORE_DATABASE[allItems[0]] || { name: allItems[0], tier: '', category: '', stats: '', desc: '' };

    invDetailsTitle.innerHTML = `<span style="color:#d4af37">${first.name}</span> <span style="font-size:11px; color:#94a3b8">(${first.tier} · ${first.category})</span>`;

    invDetailsBody.innerHTML = `<div style="color:#38bdf8; font-weight:600; margin-bottom:4px;">${first.stats}</div><div>${first.desc}</div>`;

  }

}

invCloseBtn?.addEventListener('click', () => {

  if (isInventoryOpen) toggleInventory();

});

// Victorian Character & Relic Folio Modal

function toggleCharacterFolio(): void {

  isCharFolioOpen = !isCharFolioOpen;

  if (!charModal) return;

  if (isCharFolioOpen) {

    charModal.style.display = 'block';

    SoundFX.playFolioToggle();

    renderCharacterFolio();

  } else {

    charModal.style.display = 'none';

  }

}

function renderCharacterFolio(): void {

  const strEl = document.getElementById('stat-str');

  const dexEl = document.getElementById('stat-dex');

  const intEl = document.getElementById('stat-int');

  const cynthiaTierEl = document.getElementById('cynthia-resonance-tier');

  const strBonus = inventory.has('ITEM_IRON_NAIL') || inventory.has('ITEM_COLD_IRON_KEY') ? 2 : 0;

  const dexBonus = abilities.has('ABILITY_STARLIGHT_DASH') || abilities.has('ABILITY_WALL_LEAP') ? 3 : 0;

  const intBonus = solvedPuzzles.has('PUZZLE_TRUE_MIRROR') || inventory.has('ITEM_CHIME_TUNER') ? 4 : 0;

  if (strEl) strEl.textContent = `${14 + strBonus} (+${Math.floor((14 + strBonus - 10) / 2)})`;

  if (dexEl) dexEl.textContent = `${16 + dexBonus} (+${Math.floor((16 + dexBonus - 10) / 2)})`;

  if (intEl) intEl.textContent = `${18 + intBonus} (+${Math.floor((18 + intBonus - 10) / 2)})`;

  if (cynthiaTierEl) {

    const solvedCount = solvedPuzzles.size;

    cynthiaTierEl.textContent = solvedCount >= 4 ? 'Tier IV · Transcendental Synthesis' :

      solvedCount >= 2 ? 'Tier III · Harmonic Resonance' : 'Tier II · Harmonic Reverberation';

  }

  // Relic Click Listeners

  const relicCards = document.querySelectorAll('.relic-slot-card');

  const relicInfo: Record<string, { title: string; desc: string }> = {

    truth_lens: {

      title: 'Truth Lens (Nozick Glaze Glass)',

      desc: 'Forged in the Royal Lensworks. Holding [Q] pierces phantom satieties, reveals secret passages, and highlights invisible ethereal triggers.'

    },

    echo_bell: {

      title: 'Echo Bell (Aeolian Acoustic Tuning)',

      desc: 'Tapping [F] sends forth an expanding acoustic pulse that vibrates chime crystals, opens echo doors, and disrupts stealth.'

    },

    iron_nails: {

      title: 'Cold-Iron Nails (Grounding Artifact)',

      desc: 'Dense cold-iron nails that pin down dream-flux, stabilize non-Euclidean stairways, and awaken clockwork guards from illusion stasis.'

    },

    starlight_dash: {

      title: 'Starlight Dash (Arboreal Phase Surge)',

      desc: 'Claimed from Yggdra the Ancient Bough. Pressing [C] or [Shift] propels Kaelen through solid thorns and hazardous traps with invulnerability.'

    },

    graviton: {

      title: 'Graviton Inversion (The Highest Spire)',

      desc: 'Bestowed upon shattering the Glass Heart. Inverts local gravitational vectors, permitting vertical ascent and non-Euclidean traversal.'

    },

    tantalus: {

      title: 'Tantalus Goblet (Vessel of Emptiness)',

      desc: 'Acquired in the Cenacle of Eternal Satiety. Drains phantom wine into the void, dissolving false feasts and breaking illusions of satiety.'

    }

  };

  relicCards.forEach((card) => {

    card.addEventListener('click', () => {

      const relicKey = card.getAttribute('data-relic') || '';

      const data = relicInfo[relicKey];

      if (data && charRelicLoreTitle && charRelicLoreBody) {

        charRelicLoreTitle.textContent = data.title;

        charRelicLoreBody.textContent = data.desc;

        SoundFX.playMenuClick();

      }

    });

  });

}

charCloseBtn?.addEventListener('click', () => {

  if (isCharFolioOpen) toggleCharacterFolio();

});

hudCharCard?.addEventListener('click', () => {

  toggleCharacterFolio();

});

// Audio Toggle Button Handler

hudAudioBtn?.addEventListener('click', () => {

  const isMuted = SoundFX.toggleMute();

  if (hudAudioLabel) {

    hudAudioLabel.textContent = isMuted ? 'Music: OFF' : 'Music: ON';

  }

});

// Ending Epilogue Modal Handlers

function openEndingModal(): void {

  isEndingModalOpen = true;

  if (!endingModal) return;

  endingModal.style.display = 'block';

  SoundFX.playChimeTune();

  const endingCards = document.querySelectorAll('.ending-card');

  endingCards.forEach((card) => {

    card.addEventListener('click', () => {

      const endingType = card.getAttribute('data-ending');

      const endingAxis = endingType === 'weave' ? 'empathy' : endingType === 'crown' ? 'solipsism' : 'rationalism';

      awardConviction(endingAxis, 2, `ending:${endingType}`);

      SoundFX.playPuzzleSolved();

      renderEndingEpilogue(endingType || 'shatter');

    });

  });

}

document.getElementById('ending-close-btn')?.addEventListener('click', () => {

  isEndingModalOpen = false;

  if (endingModal) endingModal.style.display = 'none';

});

void openEndingModal;

function renderEndingEpilogue(type: string): void {

  if (!endingEpilogueScroll) return;

  endingEpilogueScroll.style.display = 'block';

  let title = '';

  let body = '';

  if (type === 'shatter') {

    title = 'EPILOGUE I — EXILE OF THE TRUE SKY';

    body = 'You drive your silver stiletto into the facets of the Glass Heart. The crystal explodes into a blinding tempest of starlight, tearing away all illusions, mirrors, and gilded glamours from the mountain citadel. Cynthia\'s spirit ascends like an incandescent comet into the aurora above. As the stone towers crumble into silent ruins, you step onto the mountain pass alone—free of dreams, unburdened by false comfort, facing the cold, beautiful dawn of mortal reality.';

  } else if (type === 'crown') {

    title = 'EPILOGUE II — SOVEREIGN OF THE FRACTAL THRONE';

    body = 'Stepping past the fallen form of Duke Vaelor, you ascend the three obsidian tiers of the Dais and don the Starlight Diadem. The infinite reflections in every corridor bow in unison. The spinning Glass Heart becomes your eternal lamp, and Cynthia remains preserved within the crystal cage as your muse. The outer gates of Veilkeep seal shut against the mundane world. You have become the new Archillusionist, monarch of a kingdom that never was and never shall fade.';

  } else if (type === 'weave') {

    title = 'EPILOGUE III — THE LUCID SANCTUARY';

    body = 'Refusing both destruction and tyranny, you channel your own illusionist will into the resonant frequency of the Glass Heart. Your mind merges with Cynthia\'s spirit in gentle harmony. The cold nightmare of Veilkeep softens into a radiant, lucid sanctuary where weary wanderers find peace and lost souls are sheltered from the harsh world. Together, you weave the living starlight into an everlasting haven between dream and memory.';

  } else {

    title = 'EPILOGUE IV — GROUNDED IN COLD IRON';

    body = 'You draw the heavy cold-iron nail and the ancient mortise key from your satchel and drive them straight into the heart of the obsidian dais. A deep resonant shockwave shudders through the rock. Every mirror shatters, every starlight spire dematerializes, and the gilded phantasms vanish like smoke. What remains is a quiet, weathered Victorian manor of damp slate and moss, washed clean by the morning autumn rain. The spell is broken. The world is awake.';

  }

  endingEpilogueScroll.innerHTML = `

    <div style="font-size: 15px; font-weight: 700; color: #fbbf24; margin-bottom: 8px;">${title}</div>

    <div style="font-family: 'Inter', sans-serif; font-size: 12.5px; line-height: 1.8; color: #e2e8f0; margin-bottom: 14px;">${body}</div>

    <div style="text-align: center;">

      <button class="map-travel-btn" style="display: inline-flex; width: auto; padding: 8px 18px;" onclick="location.reload()">↺ Begin New Expedition</button>

    </div>

  `;

}

// Inspectable Lore Objects

interface LoreObject {

  id: string;

  sceneId: SceneId;

  name: string;

  pos: { x: number; y: number; z: number };

  title: string;

  text: string;

  mesh?: THREE.Group;

}

const loreObjects: LoreObject[] = [

  {

    id: 'LORE_S00',

    sceneId: 'S00',

    name: "Cynthia's Glass Rose",

    pos: { x: -3.5, y: 0.5, z: 2.0 },

    title: "Archival Record — Cynthia's Glass Rose",

    text: "A delicate spun-glass rose left on the sunken courtyard balustrade.\n\nEtched into the stem with an artisan's diamond burr:\n'To Alistair, before the clocks stop and the reflections take the throne. Never look into the Grand Mirror with both eyes open.'",

  },

  {

    id: 'LORE_OW1',

    sceneId: 'OW1',

    name: "Duke Vaelor's Despatch",

    pos: { x: -3.5, y: 0.5, z: 2.0 },

    title: "Archival Record — Despatch from Duke Vaelor",

    text: "Field Orders recovered from an abandoned courier pouch:\n\n'The mirror seals are holding along the outer barbican, but the reflection in the Great Hall has ceased to imitate my movements. It watches. It smiles. Orin has grounded his post with cold iron, but even iron cannot stop a dream once it learns to breathe.'",

  },

  {

    id: 'LORE_GH2',

    sceneId: 'GH2',

    name: "Garrison Daguerreotype",

    pos: { x: 3.5, y: 0.5, z: -1.0 },

    title: "Archival Record — Garrison Daguerreotype (1888)",

    text: "A silver-plate photograph of the Gatehouse garrison dated Autumn 1888.\n\nThe faces of all twelve guardsmen have been scratched away with a cold-iron stylus, leaving only silver silhouettes reflecting the room behind you.",

  },

  {

    id: 'LORE_BQ1',

    sceneId: 'BQ1',

    name: "Banquet of Ashes Menu",

    pos: { x: 3.2, y: 0.5, z: 0.5 },

    title: "Archival Record — Archival Menu of the Eve of Betrothal (1886)",

    text: "An ornate gold-leaf menu recovered from Lord Morvath's place setting:\n\n'First Course: Roasted Swan in Spun Amber.\nSecond Course: Candied Nightingale Tongue in Fig Wine.\n\nNote in margins: We have chewed these phantom figs for two hundred years. Our teeth are worn to dust, yet the hunger never ceases.'",

  },

  {

    id: 'LORE_AG1',

    sceneId: 'AG1',

    name: "Yggdra's Heartwood Rings",

    pos: { x: 3.2, y: 0.5, z: 0.5 },

    title: "Archival Record — Arborist's Chronicle of the World Bough",

    text: "Inscribed upon a ring of petrified sapwood:\n\n'The root does not hunger for light, nor does the branch fear the night. Speak three truths to the ringed eye, and the bramble road shall yield.'",

  },

  {

    id: 'LORE_MH1',

    sceneId: 'MH1',

    name: "Hazel's Confectionery Ledger",

    pos: { x: -3.2, y: 0.5, z: 0.5 },

    title: "Archival Record — Mother Hazel's Recipe Folio",

    text: "A sticky parchment bound with dried peppermint bark:\n\n'Three parts marzipan to six parts spun starlight. Let the guests sip until their feet turn into gingerbread pedestals. True hospitality never lets a traveler leave hungry.'",

  },

  {

    id: 'LORE_SAN1',

    sceneId: 'SAN1',

    name: "Vaelor's Final Epilogue",

    pos: { x: 3.2, y: 0.5, z: -3.0 },

    title: "Archival Record — Archillusionist Vaelor's Testament",

    text: "Fragment of crystalline glass suspended in midair:\n\n'The Glass Heart beats not with blood, but with the memory of light. Break the mirror, and you break the world we built to keep out the void.'",

  },

  {

    id: 'LORE_HM1',

    sceneId: 'HM1',

    name: "Mirror Wraith's Reflection",

    pos: { x: 0, y: 0.5, z: -2.0 },

    title: "Archival Record - The True Mirror",

    text: "A silvered glass shard from the shattered True Mirror.\n\nWithin its fractured surface, a single eye stares back - not your own. It blinks. It smiles. It remembers every face that ever looked into it, and it has been waiting for yours since the fortress was built.",

  },

  {

    id: 'LORE_BQ1',

    sceneId: 'BQ1',

    name: "Lord Morvath's Menu",

    pos: { x: 2.0, y: 0.5, z: 1.0 },

    title: "Archival Record - The Cenacle Menu",

    text: "A handwritten menu card, the ink still wet despite decades of abandonment.\n\nFirst Course: Phantasmic Roast Boar (served with Hollow Satiety). Second Course: Starlight Pepper Consomme. Third Course: The Glass Heart (Vaelor's own recipe - not for consumption).\n\nA footnote reads: The feast is eternal. The guests are not.",

  },

  {

    id: 'LORE_AG1',

    sceneId: 'AG1',

    name: "Yggdra's Ring Count",

    pos: { x: -2.0, y: 0.5, z: 0.0 },

    title: "Archival Record - The Ancient Bough",

    text: "Carved into the bark of the great tree, in a script older than the fortress:\n\nEach ring is a year Vaelor stole from the world above. I have counted seven hundred and twelve. He will take seven hundred and thirteen unless the thief with the cold-iron nail finds the root of the lie.",

  },

  {

    id: 'LORE_MH1',

    sceneId: 'MH1',

    name: "Hazel's Recipe Book",

    pos: { x: 1.5, y: 0.5, z: -1.5 },

    title: "Archival Record - Mother Hazel's Confectionery",

    text: "A sugar-stained recipe book, open to a page titled Phantasmic Confectionery:\n\n1 part Starlight Pepper, 2 parts Dream-Sugar, 1 pinch of Truth. Stir counter-clockwise with the Sugar Spoon. The resulting confection will dissolve any illusion it touches - including the illusion of safety.",

  },

  {

    id: 'LORE_SAN1',

    sceneId: 'SAN1',

    name: "Vaelor's Confession",

    pos: { x: 0, y: 0.5, z: 2.0 },

    title: "Archival Record - The Archillusionist's Confession",

    text: "A parchment nailed to the Starlight Throne with a cold-iron nail:\n\nI built this fortress to protect Cynthia's heart from the world. Instead, I imprisoned her in glass and called it love. The thief who reads this has already gone further than I ever dared. Shatter the heart. Free her. And forgive me, if you can.",

  },

  {

    id: 'LORE_CO3',

    sceneId: 'CO3',

    name: "Duchess Seraphina's Playbill",

    pos: { x: 0, y: 0.5, z: -2.0 },

    title: "Archival Record - The Crystal Theater",

    text: "A playbill for 'The Mirror's Lament' by Duchess Seraphina Vane.\n\nThe performance requires a volunteer from the audience. The volunteer will be asked to look into the Crystal Mirror and describe what they see. WARNING: The mirror does not reflect what is. It reflects what was. Or what will be.\n\nA handwritten note: I tried to warn them. The mirror shows not the future, but the truth. And the truth is that the fortress is already broken. We are all just reflections of what we used to be.",

  },

  {

    id: 'LORE_PB1',

    sceneId: 'PB1',
    name: "Warden's Logbook",
    pos: { x: 2.0, y: 0.5, z: -1.0 },
    title: "Archival Record - The Abyssal Prison",
    text: "Warden Malakor's logbook, entries spanning three centuries:\n\n'Day 1: The first prisoner arrived. He claimed to be a mirror-maker. He said the mirrors in the fortress were not reflections but windows. I had him locked in the deepest cell.\n\nDay 400: The mirror-maker is dead, but his mirrors still show things that are not there. The guards refuse to patrol past Cell 7.\n\nDay 1200: I have become what I guarded against. The cold iron keyring burns in my hand, and I can hear the mirrors whispering my name. I am no longer the warden. I am the prisoner.'",
  },
  {
    id: 'LORE_RG1',
    sceneId: 'RG1',
    name: "Gardener's Almanac",
    pos: { x: -2.0, y: 0.5, z: 1.0 },
    title: "Archival Record - The Rooftop Gardens",
    text: "A gardener's almanac, entries in increasingly frantic handwriting:\n\n'Spring: The starlight peppers are blooming early this year. The wind carries their scent down into the fortress, and the guards say they can taste starlight on their tongues.\n\nSummer: The wind cones are spinning backward. I have tried to stop them, but they seem to be powered by something deeper than wind. The vista point shows a view of the fortress that does not match the architecture.\n\nAutumn: I climbed to the vista point today and saw myself standing in the courtyard below. I was not there. I was here. The wind knows something I do not.'",
  },
  {
    id: 'LORE_TR1',
    sceneId: 'TR1',

    name: "Curator's Catalogue",
    pos: { x: 1.0, y: 0.5, z: 0.0 },
    title: "Archival Record - The Trophy Hall",
    text: "A curator's catalogue of the fortress's collected trophies:\n\n'Item 1: The Glass Heart of Cynthia (on loan from the Sanctum). Item 2: The Captain's Halberd (recovered from the Gatehouse). Item 3: The Warden's Keyring (confiscated). Item 4: The Starlight Lens (donated by Astromancer Zephyra).\n\nNOTE: Item 7 (The Mimic Chest) has been reclassified from 'Decorative' to 'Active Threat' after it consumed a junior curator. Please do not open. Please do not touch. Please do not look at it for too long. It is watching.'",
  },
  {
    id: 'LORE_CR1',
    sceneId: 'CR1',

    name: "Archivist Aurelia's Inverted Journal",
    pos: { x: 0, y: 0.5, z: -2.0 },
    title: "Archival Record - The Chronomantic Scriptorium",
    text: "Lady Aurelia the Inverted's journal, written in reverse chronology:\\n\\n'I have already told you the answer to the bridge. You will ask me tomorrow. I am writing this yesterday.\\n\\nThe portcullis does not lock forward. It locks backward. To unlock it, you must present the ending before the beginning. The ash is the memory of the fire. The fire is the memory of the spark. Deposit the Ouroboros, reverse-ignite the braziers, and turn the key against the clock. Only then will the vault remember that it was always open.'",
  },
  {
    id: 'LORE_MS3',
    sceneId: 'MS3',
    name: "Maestro's Annotated Score",
    pos: { x: 0, y: 0.5, z: -2.0 },
    title: "Archival Record - The Gilded Music Salon",
    text: "Maestro Niccolo's annotated score for 'The Cadence of Resonant Harmonies':\\n\\n'The salon is trapped in dissonant stasis. The spirits of the Royal Starlight Consort play eternally, never resolving. To break the loop, one must strike the three glass-armonica lanes in harmonic sequence. The mallet must be wielded by one who has heard the true chord. The score is written in starlight ink; it can only be read by moonlight.'",
  },
  {
    id: 'LORE_GH1',
    sceneId: 'GH1',
    name: "Guard Captain's Patrol Ledger",
    pos: { x: 2, y: 0.5, z: -1 },
    title: "Archival Record - Gatehouse Exterior",
    text: "Captain Malakor's patrol ledger, water-stained and dog-eared:\\n\\n'0600: Perimeter check. East cliff trellis secure. 0800: Orin reported at the gatehouse door. Refused entry to a hooded figure. 1200: Steam-jam in the lift gate. Iron nail required. 1800: Dreamwalker patrol spotted on the battlements. They do not attack, but they watch. 2200: All quiet. The mirrors in the gatehouse reflect things that are not there. I have stopped looking.'",
  },
  {
    id: 'LORE_B1',
    sceneId: 'B1',
    name: "Barracks Quartermaster's Inventory",
    pos: { x: 0, y: 0.5, z: 2 },
    title: "Archival Record - Barracks Hall",
    text: "A quartermaster's inventory of the barracks armory:\\n\\n'Standard issue: 12 halberds, 6 crossbows, 200 iron bolts. Special issue: 1 Cold-Iron Nail (confiscated from Gatehouse), 1 Tachyon Phial (on loan from Chronomantic Scriptorium), 1 Brass Cog (jam repair kit). NOTE: The armory key has been duplicated. The warden holds one copy. The other is hidden in the warden's desk, beneath the false bottom. Do not tell the captain.'",
  },
  {
    id: 'LORE_SQ1',
    sceneId: 'SQ1',
    name: "Servant's Hidden Diary",
    pos: { x: -2, y: 0.5, z: 1 },
    title: "Archival Record - Servants Quarters",
    text: "A servant's diary, hidden beneath the hearth mantle:\\n\\n'Mother says the fortress is alive. She says the mirrors are its eyes and the steam pipes are its veins. I think she is right. Last night I saw the Dreamwalkers walking through the walls. They did not see me. I think they are looking for something. Or someone. The warden's daughter. She is not dead. She is in the mirrors. I heard her singing.'",
  },
  {
    id: 'LORE_RC1',
    sceneId: 'RC1',
    name: "Escher's Perspective Notes",
    pos: { x: 0, y: 0.5, z: -2 },
    title: "Archival Record - Relativity Cloister",
    text: "Architect Escher's perspective notes, found pinned to a ceiling that functions as a floor:\\n\\n'Gravity is a convention, not a law. The cloister has no single up. Each stairway landing declares itself the floor, and the world rearranges to agree. The Dreamwalkers walk on whatever plane they believe is down. To navigate, one must choose a floor and commit. Iron Nails anchor the choice. Without them, the perspective shifts beneath your feet. The dining table at the center is the only place where all perspectives agree.'",
  },
  {
    id: 'LORE_AL1',
    sceneId: 'AL1',
    name: "Vex's Lab Notebook",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Alchemist's Lab",
    text: "Vex's lab notebook, pages stained with volatile compounds:\\n\\n'Experiment 47: The unstable formula reacts to starlight. When exposed to moonlight, it crystallizes into a stable compound. When exposed to sunlight, it detonates. I have lost three apprentices to sunlight.\\n\\nExperiment 52: The formula can be stabilized with a catalyst. The catalyst is starlight pepper extract, found only in the Rooftop Gardens. The gardener will not sell it. I will have to steal it.'",
  },
  {
    id: 'LORE_AT1',
    sceneId: 'AT1',
    name: "Astromancer Zephyra's Star Chart",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Astronomy Tower",
    text: "Astromancer Zephyra's star chart, annotated in silver ink:\\n\\n'The constellation of the Veil is not a constellation. It is a map. Each star corresponds to a room in the fortress. When the stars align, the hidden door in the Star Chamber opens. The alignment occurs once per century, during the midnight bell toll. Vaelor built the tower to watch for this alignment. He is waiting for something. Or someone.'",
  },
  {
    id: 'LORE_BT1',
    sceneId: 'BT1',
    name: "Bell Ringer's Journal",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Belfry of the Void",
    text: "The bell ringer's journal, found in the belfry:\\n\\n'The bells do not ring. They sing. Each bell produces a note that corresponds to a floor of the fortress. When all five bells ring in harmony, the Aeolian baffles open, and the wind carries the sound to the void. The void listens. The void answers. I have heard it answer. It said: The mirror is already broken. You are just the last to know.",
  },
  {
    id: 'LORE_VR1',
    sceneId: 'VR1',
    name: "Dreamwalker's Testimony",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Void Realm Threshold",
    text: "A Dreamwalker's testimony, transcribed by a scribe who has since forgotten his own name:\\n\\n'I walked through the wall. I did not choose to. The wall chose for me. On the other side, there is no fortress. There is no courtyard. There is only the dream. The dream is not Vaelor's. The dream is ours. We are all dreaming the same dream, and the dream is that the fortress is real. It is not. It never was.'",
  },
  {
    id: 'LORE_TR2',
    sceneId: 'TR2',
    name: "Beast Handler's Field Notes",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Trophy Hall Beast Row",
    text: "A beast handler's field notes, found beside a trophy case:\\n\\n'Beast 7: The Colosseum Beast. Captured from the Void Realm. It is not a beast. It is a reflection of a beast. It has no body. It has only a shape. When the shape is broken, the reflection shatters. The curator wants to display it. I have told him: do not display it. It will show the audience what they are afraid of. And the audience is always afraid of themselves.'",
  },
  {
    id: 'LORE_U1',
    sceneId: 'U1',
    name: "Monk's Prayer Beads",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Undercrypt Entrance",
    text: "A monk's prayer beads, each bead engraved with a name:\\n\\n'These are the names of the monks who built the Undercrypt. They came to the fortress to pray for Vaelor's daughter. Vaelor thanked them by sealing them in the crypt. They did not mind. They said the crypt was closer to God. They were wrong. The crypt is closer to the mirrors. And the mirrors are closer to the truth. And the truth is that God is a reflection, and the reflection is broken.'",
  },
  {
    id: 'LORE_AL2',
    sceneId: 'AL2',
    name: "Storage Room Inventory",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Alchemist Storage",
    text: "An inventory of the alchemist's storage room:\\n\\n'Standard reagents: 12 flasks of starlight extract, 6 vials of volatile sulfur, 3 crucibles. Special items: 1 Cracked Pocket Watch (on loan from Master Vane), 1 Tachyon Phial (on loan from Chronomantic Scriptorium). WARNING: Do not store volatile sulfur near open flame. The last accident cost us the east wall.'",
  },
  {
    id: 'LORE_AT2',
    sceneId: 'AT2',
    name: "Constellation Floor Inscription",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Constellation Floor",
    text: "An inscription on the constellation floor, worn smooth by centuries of footsteps:\\n\\n'When the stars are right, the floor becomes a map. Each constellation is a room. Each line is a door. The door opens only when the star it points to is directly overhead. The Astromancer watches. The Astromancer waits. The Astromancer knows that the alignment will come, and when it comes, the hidden room will reveal what Vaelor hid there: the truth about Cynthia.'",
  },
  {
    id: 'LORE_GH4',
    sceneId: 'GH4',
    name: "Vent Passage Graffiti",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Gatehouse Vent",
    text: "Graffiti scratched into the vent passage wall by a desperate hand:\\n\\n'I climbed up through the vent to escape the guards. The vent goes up, but it also goes sideways. I think it goes everywhere. The fortress is hollow. The walls are not walls. They are pipes. The steam is not steam. It is breath. The fortress is breathing. I can hear it breathing. I am inside its lungs.'",
  },
  {
    id: 'LORE_PB2',
    sceneId: 'PB2',
    name: "Guard Post Orders",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Prison Guard Post",
    text: "Standing orders posted at the guard post:\\n\\n'1. Do not speak to the prisoners. 2. Do not look in the mirrors. 3. Do not enter Cell 7 after midnight. 4. If you hear singing, report to the warden immediately. 5. If the singing stops, do not investigate. 6. If the singing starts again, pray. NOTE: The singing has not stopped in 300 years. The guards who pray are the ones who survive.'",
  },
  {
    id: 'LORE_RG2',
    sceneId: 'RG2',
    name: "Wind Maze Carving",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Rooftop Wind Maze",
    text: "A carving on the wind maze wall, weathered by centuries of wind:\\n\\n'The wind does not blow. It speaks. Each gust is a word. Each silence is a sentence. The maze is a message, written in wind, for anyone who can read it. The message is: the fortress is a mirror. The mirror is a door. The door is a dream. The dream is yours. Wake up.'",
  },
  {
    id: 'LORE_U2',
    sceneId: 'U2',
    name: "Monk Tomb Inscription",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Monk Tombs",
    text: "An inscription on a monk's tomb:\\n\\n'Brother Aldric. He prayed for 40 years. He never saw the sun. He said the mirrors were enough. He said the mirrors showed him God. On his deathbed, he said: God is not in the mirrors. The mirrors are in God. And God is broken. And we are the pieces.'",
  },
  {
    id: 'LORE_AL3',
    sceneId: 'AL3',
    name: "Vex's Final Formula",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Vex's Office",
    text: "Vex's final formula, written on a scrap of parchment:\\n\\n'The unstable formula is not a weapon. It is a key. When stabilized, it opens a door that has no physical location. The door is in the mirrors. The mirrors are in the mind. The mind is in the dream. And the dream is the fortress. The fortress is the formula. The formula is unstable because the fortress is unstable. Stabilize the formula, and the fortress stabilizes. Or shatters.'",
  },
  {
    id: 'LORE_AT3',
    sceneId: 'AT3',
    name: "Hidden Room Star Map",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Hidden Room",
    text: "A star map hidden behind a false wall in the astronomy tower:\\n\\n'The hidden room contains the answer to the constellation puzzle. The constellation of the Veil, when mapped onto the fortress floor, reveals the location of Vaelor's sanctum. The sanctum is not in the fortress. It is beneath it. The entrance is in the courtyard, beneath the fountain. The fountain is a mirror. The mirror is a door. The door is sealed with starlight.'",
  },
  {
    id: 'LORE_PB3',
    sceneId: 'PB3',
    name: "Warden's Confession",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Warden Office",
    text: "The warden's confession, found in a locked drawer:\\n\\n'I have been the warden for 300 years. I did not choose this. The fortress chose me. The mirrors chose me. I see things in the mirrors that are not there. I see Cynthia. She is not dead. She is in the mirrors. She is in all the mirrors. She is the mirrors. Vaelor did not crystallize her. He crystallized himself. Cynthia is the fortress. And the fortress is dreaming.'",
  },
  {
    id: 'LORE_PB4',
    sceneId: 'PB4',
    name: "Escape Tunnel Map",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Escape Tunnel",
    text: "A map of the escape tunnel, drawn in charcoal on a scrap of cloth:\\n\\n'The tunnel leads from the prison block to the outer wards. It was dug by a prisoner who escaped 200 years ago. He did not escape. He came back. He said the outside was worse than the inside. He said the fortress is the only real place. Everything outside is a dream. He went back to his cell. He locked the door from the inside. He never left again.'",
  },
  {
    id: 'LORE_RG3',
    sceneId: 'RG3',
    name: "Glider Launch Instructions",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Glider Launch",
    text: "Instructions for the glider launch, carved into the launch platform:\\n\\n'The glider is not a glider. It is a mirror. When you launch, you do not fly. You reflect. The wind carries your reflection to the vista point. At the vista point, you will see yourself standing in the courtyard. You were never in the courtyard. You were always here. The glider does not move you. It moves the world.'",
  },
  {
    id: 'LORE_U3',
    sceneId: 'U3',
    name: "Echo Chamber Resonance",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Echo Chamber",
    text: "A resonance map of the echo chamber:\\n\\n'The chamber amplifies sound. But it also amplifies thought. When you speak in the chamber, your words echo. But the echoes are not your words. They are the words of someone else. Someone who spoke here before you. Someone who will speak here after you. The chamber does not echo the past. It echoes the future. Listen carefully. The future is trying to warn you.'",
  },
  {
    id: 'LORE_CO1',
    sceneId: 'CO1',
    name: "Colosseum Spectator's Note",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - The Veil Colosseum",
    text: "A note found beneath a spectator's seat in the colosseum:\\n\\n'The audience is not watching the fight. The audience is the fight. Each spectator is a Dreamwalker, and each Dreamwalker is a mirror. When the fighter dies, the mirror shatters, and the audience sees themselves. Vaelor stages these trials to watch his subjects confront their own reflections. The beast in the arena is not a beast. It is the fighter's fear, given form.'",
  },
  {
    id: 'LORE_GH3',
    sceneId: 'GH3',
    name: "Captain's Last Orders",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Captain's Landing",
    text: "The captain's last orders, found on his body:\\n\\n'If you are reading this, I am dead. The hooded figure who entered the gatehouse was not a thief. It was a mirror. It wore my face. It knew my name. It knew my wife's name. I could not strike it. You cannot strike a mirror. You can only shatter it. And when you shatter it, you shatter yourself. Do not look in the gatehouse mirrors. They are not mirrors. They are doors. And the doors are opening.'",
  },
  {
    id: 'LORE_RG4',
    sceneId: 'RG4',
    name: "Vista Point Inscription",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Rooftop Vista",
    text: "An inscription at the vista point, overlooking the fortress:\\n\\n'From here, you can see the entire fortress. You can see the courtyard, the gatehouse, the spire, the gardens. You can see everything. But you cannot see yourself. Because you are not here. You are in the courtyard. You are in the gatehouse. You are in the spire. You are everywhere. And you are nowhere. The fortress is a mirror, and you are the reflection.'",
  },
  {
    id: 'LORE_TR3',
    sceneId: 'TR3',
    name: "The Slain Beast's Tag",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - The Slain Beast",
    text: "A tag attached to a trophy in the hall:\\n\\n'Specimen 7: The Colosseum Beast. Origin: Void Realm. Classification: Reflection. Status: Slain. Note: The beast was not slain. It was unmade. When the fighter struck the killing blow, the beast's reflection shattered, and the beast ceased to exist. It was never real. It was a mirror. And the mirror is broken. And the fighter is now a mirror. And the mirror is watching.'",
  },
  {
    id: 'LORE_TR4',
    sceneId: 'TR4',
    name: "Curator's Final Entry",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Curator's Alcove",
    text: "The curator's final entry, written in a shaking hand:\\n\\n'I have catalogued 47 trophies. I have not catalogued the 48th. The 48th trophy is a mirror. It shows the curator. I am the curator. The mirror shows me sitting at my desk, cataloguing trophies. I am cataloguing the mirror. The mirror is cataloguing me. I do not know which of us is real. I think neither of us is. I think the trophy hall is the mirror, and we are all trophies.'",
  },
  {
    id: 'LORE_U4',
    sceneId: 'U4',
    name: "Sealed Vault Inscription",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Secret Vault",
    text: "An inscription on the sealed vault door:\\n\\n'The vault contains what Vaelor feared most. Not his daughter's death. Not his own madness. The truth. The truth is that the fortress is a mirror, and the mirror is a door, and the door is a dream, and the dream is a reflection, and the reflection is Cynthia. Cynthia is not in the mirrors. Cynthia is the mirrors. And the mirrors are breaking. And when they break, the dream ends. And when the dream ends, we wake up. And waking up is dying.'",
  },
  {
    id: 'LORE_VR2',
    sceneId: 'VR2',
    name: "Dream Logic Room Notes",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Dream Logic Room",
    text: "Notes found in the dream logic room, written in a hand that is not the author's:\\n\\n'The room does not follow logic. It follows dream. In the dream, up is down, left is right, and the door you entered through is not the door you will exit through. The Dreamwalkers know this. They have always known this. They are not walking. They are dreaming. And the dream is the fortress. And the fortress is a mirror. And the mirror is you.'",
  },
  {
    id: 'LORE_VR3',
    sceneId: 'VR3',
    name: "The Core's Whisper",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - The Void Core",
    text: "A whisper, transcribed by a scribe who has since forgotten his own name:\\n\\n'At the core of the void, there is no void. There is a mirror. The mirror shows the dreamer. The dreamer is you. You are dreaming the fortress. The fortress is dreaming you. Neither of you is real. Both of you are real. The mirror does not lie. The mirror does not tell the truth. The mirror shows what is. And what is, is a dream. And the dream is waking up.'",
  },
  {
    id: 'LORE_RS6',
    sceneId: 'RS6',
    name: "The Diner's Perspective Lens",
    pos: { x: 0, y: 0.5, z: -1 },
    title: "Archival Record - Relativity Cloister Dining Table",
    text: "A perspective lens, found on the dining table where a Dreamwalker sits eternally:\\n\\n'The diner has been sitting here for 300 years. He has not eaten. He has not spoken. He has only watched. When you sit across from him and share the meal, he will give you the lens. The lens shows the true up. The true up is not above. The true up is inside. The fortress is inside you. You are inside the fortress. The mirror is inside the mirror. And the mirror is you.'",
  },
];
function openLore(obj: LoreObject): void {
  if (!loreModal || !loreModalTitle || !loreText) return;
  loreModalTitle.textContent = obj.title;
  loreText.textContent = obj.text;
  discoveredLore.add(obj.id);
  loreModal.classList.add('visible');
  SoundFX.playLoreInspect();
  isLoreOpen = true;
}
function closeLore(): void {

  loreModal?.classList.remove('visible');

  isLoreOpen = false;

}

loreCloseBtn?.addEventListener('click', closeLore);

// Pause Menu Handlers

function togglePause(force?: boolean): void {

  isPaused = force !== undefined ? force : !isPaused;

  if (!pauseModal) return;

  if (isPaused) {

    pauseModal.classList.add('visible');

  } else {

    pauseModal.classList.remove('visible');

  }

}

pauseCloseBtn?.addEventListener('click', () => togglePause(false));

btnResume?.addEventListener('click', () => togglePause(false));

btnRestartCp?.addEventListener('click', () => {

  togglePause(false);

  respawn();

});

volMusic?.addEventListener('input', (e) => {

  const val = Number((e.target as HTMLInputElement).value);

  SoundFX.setMusicVolume(val / 100);

  audioManager.setVolume(val / 100);

});

// Harmonic Parry Stance

function tryParry(): void {

  if (parryTimer > 0) return;

  parryTimer = 0.35;

  parryBadge?.classList.remove('parry-ready');

  parryBadge?.classList.add('active');

  parryBadge?.classList.add('active');

    const cState = mainChar?.combat.state ?? 'Light_Attack_1';
    const tier: 1 | 2 | 3 = cState === 'Heavy_Combo_Finisher' ? 3 : (cState === 'Light_Attack_2' ? 2 : 1);
    SoundFX.playComboSlash(tier);

  mainChar.combat.setBlock(true);
  setTimeout(() => mainChar.combat.setBlock(false), 350);

  flashMesh(playerMesh, 0xf59e0b, 160);

}

const magicalBushes: {
  mesh: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  mixer?: THREE.AnimationMixer;
  idleAction?: THREE.AnimationAction;
  retractAction?: THREE.AnimationAction;
  isRetracted: boolean;
  originalScale: THREE.Vector3;
  targetScale: THREE.Vector3;
}[] = [];

let quality: QualityManager;

const engine = new GameEngine({
  canvas,

  onRender: () => { quality.frame(); drawMinimap(); },

  onUpdate: (dt) => {

    const steamDps = questRuntime.hazardDamageAt(currentSceneId, playerState.x, playerState.z);

    if (steamDps > 0) {

      // The half-open portcullis vents are a hazard, never a softlock: HP floors at 1.

      playerHP = Math.max(1, playerHP - steamDps * dt);

    }

    for (const marker of questPickupMeshes) {

      marker.mesh.visible = !questRuntime.pickupCollected(marker.id);

    }

  if (typeof playerMixer !== 'undefined' && playerMixer) playerMixer.update(dt);
  if (ravenMixer) ravenMixer.update(dt);
  if (orinMixer) orinMixer.update(dt);
  if (hazelMixer) hazelMixer.update(dt);
  mainChar.combat.update(dt);

    // Pause movement during dialogue, inventory, quest log, lore archival, or pause menu

    playerState.surfaceNoise = currentSceneId === 'GH2' ? 0.35 : currentSceneId === 'OW1' ? 0.85 : 1.0;

    let moveX = 0;

    let moveZ = 0;

    if (!activeDialogue && !isInventoryOpen && !isQuestLogOpen && !isLoreOpen && !isPaused && !isMapOpen) {

      if (playerState.keys.w) { moveX -= 1; moveZ -= 1; }

      if (playerState.keys.s) { moveX += 1; moveZ += 1; }

      if (playerState.keys.a) { moveX -= 1; moveZ += 1; }

      if (playerState.keys.d) { moveX += 1; moveZ -= 1; }

    }
    if (autoEnabled) autoTick(dt);

    else if (autoplayController.running) autoplayController.tick(dt);

    if (autoEnabled || autoplayController.running) {

      moveX = autoInput.x;

      moveZ = autoInput.z;

    }

    // Parry Timer Stance Update

    if (parryTimer > 0) {

      parryTimer -= dt;

      if (parryTimer <= 0) {

        parryBadge?.classList.remove('active');

        parryBadge?.classList.add('parry-ready');

      }

    }

    if (parryTimer > 0) parryBadge?.classList.remove('parry-ready');

    else parryBadge?.classList.add('parry-ready');

    if (rewindCooldown > 0) rewindCooldown -= dt;

    if (comboTimer > 0) {

      comboTimer -= dt;

      if (comboTimer <= 0) {

        if (comboCount > bestCombo) {

          bestCombo = comboCount;

          localStorage.setItem('veilkeep.bestCombo', String(bestCombo));

          if (comboCount > 3) showToast('New Best Combo: x' + bestCombo + '!');

        }

        comboCount = 0;

      }

    }

    // Sneaking Mode & FP Regeneration

    playerState.isSneaking = playerState.keys.ctrl;

    if (playerState.isSneaking) {

      stealthBadge?.classList.add('active');

      playerMesh.scale.y = THREE.MathUtils.lerp(playerMesh.scale.y, 0.78, 12 * dt);

    } else {

      stealthBadge?.classList.remove('active');

      playerMesh.scale.y = THREE.MathUtils.lerp(playerMesh.scale.y, 1.0, 12 * dt);

    }

    playerState.fp = Math.min(playerState.maxFp, playerState.fp + 4.5 * dt);

    if (fpFill) fpFill.style.width = `${Math.round((playerState.fp / playerState.maxFp) * 100)}%`;

    // Sprinting & Stamina Regeneration Loop

    const isMoving = moveX !== 0 || moveZ !== 0;
    mainChar.combat.setMove(moveX, moveZ, !!playerState.keys.shift && playerState.stamina > 2);

    if (playerMixer) {

      if (!isMoving) playPlayerAnim('Idle');

      else if (playerState.keys.shift && playerState.stamina > 2) playPlayerAnim('Run');

      else playPlayerAnim('Walk');

    }

    if (playerState.keys.shift && isMoving && playerState.stamina > 2 && !playerState.isSneaking && !activeDialogue && !isInventoryOpen && !isQuestLogOpen && !isLoreOpen && !isPaused && !isMapOpen) {

      playerState.isSprinting = true;

      playerState.speed = 8.4;

      playerState.stamina = Math.max(0, playerState.stamina - 28 * dt);

    } else {

      playerState.isSprinting = false;
      playerState.speed = autoEnabled ? 8.6 : (playerState.isSneaking ? 3.2 : 5.5);
      playerState.stamina = Math.min(playerState.maxStamina, playerState.stamina + 20 * dt);
    }
    if (staFill) {
      staFill.style.width = `${Math.round((playerState.stamina / playerState.maxStamina) * 100)}%`;

      if (playerState.stamina <= 0) {

        staFill.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';

        staFill.classList.remove('sta-regen');

      } else if (playerState.stamina < playerState.maxStamina) {

        staFill.style.background = 'linear-gradient(90deg, #10b981, #059669)';

        staFill.classList.add('sta-regen');

      } else {

        staFill.style.background = 'linear-gradient(90deg, #10b981, #059669)';

        staFill.classList.remove('sta-regen');

      }

    }

    // Footstep Sound Synthesis Cadence (Silent while sneaking)

    if (isMoving && !playerState.isSneaking && !activeDialogue && !isInventoryOpen && !isQuestLogOpen && !isLoreOpen && !isPaused && !isMapOpen) {

      footstepTimer -= dt;

      if (footstepTimer <= 0) {

        SoundFX.playFootstep(playerState.isSprinting);

        footstepTimer = (playerState.isSprinting ? 0.22 : 0.36) * playerState.surfaceNoise;

      }

    }

    // Music State Controller based on Enemy Alertness

    const anyEnemyChasing = activeGuards.some((g) => g.state === 'chase' && g.sceneId === currentSceneId);

    SoundFX.setMusicState(anyEnemyChasing ? 'combat' : 'explore');

    // Decoy Timer Update

    if (activeDecoy) {

      activeDecoy.timer -= dt;

      if (activeDecoy.timer <= 0) {

        engine.scene.remove(activeDecoy.mesh);

        activeDecoy = null;

      }

    }

    // Player Projectile Movement & Collision

    for (let i = activeProjectiles.length - 1; i >= 0; i--) {

      const p = activeProjectiles[i];

      const stepDist = 18 * dt;

      p.mesh.position.addScaledVector(p.dir, stepDist);

      p.distTraveled += stepDist;

      const enemies = activeGuards.filter((g) => g.state !== 'dead' && g.sceneId === currentSceneId);

      let hitTarget = false;

      for (const g of enemies) {

        const d = Math.hypot(g.mesh.position.x - p.mesh.position.x, g.mesh.position.z - p.mesh.position.z);

        if (d < 0.9) {

          hitTarget = true;

          comboCount++;

          comboTimer = 2.0;

          const comboMult2 = Math.min(2.0, 1.0 + (comboCount - 1) * 0.1);

          g.hp -= Math.round(20 * comboMult2);

          SoundFX.playGlassShatter();

          flashMesh(g.mesh, 0x67e8f9, 140);

          spawnDamagePopup(g.mesh.position, '-20 HP');

          g.hpBarTimer = 3.5;
          if (g.hp > 0) playGuardAnim(g, 'Hit');

          if (g.isWraith && g.hp > 0) {
            const spots = [
              new THREE.Vector3(-3.5, 1.1, -1.0),
              new THREE.Vector3(3.5, 1.1, -1.0),
              new THREE.Vector3(-2.5, 1.1, 2.5),
              new THREE.Vector3(2.5, 1.1, 2.5),
            ];
            const spot = spots[Math.floor(Math.random() * spots.length)];
            g.mesh.position.x = spot.x;
            g.mesh.position.z = spot.z;
            SoundFX.playWraithTeleport();
            flashMesh(g.mesh, 0xc084fc, 250);
            spawnDamagePopup(g.mesh.position, 'TELEPORT!', true);
          }

          if (g.hp <= 0) {
            g.state = 'dead';
            playGuardAnim(g, 'Death');
            g.mesh.parent?.remove(g.mesh);

            if (g === vaelorBoss) {

              solvedPuzzles.add('PUZZLE_HOLLOW_GLASS');

              abilities.add('ABILITY_GRAVITON_INVERSION');

              SoundFX.playPuzzleSolved();

              cameraShake = 0.5;

              showToast('VICTORY: Archillusionist Vaelor Defeated! Cynthia Liberated!');

              if (starlightPortalMesh) starlightPortalMesh.visible = true;

              saveCheckpoint();

              openDialogue('cynthia', 'CYNTHIA_01');

            } else if (g === treeGuardian) {

              solvedPuzzles.add('PUZZLE_ARBOREAL_WEAVE');

              abilities.add('ABILITY_STARLIGHT_DASH');

              if (rootWallMesh) rootWallMesh.visible = false;

              SoundFX.playTreeGroan();

              SoundFX.playPuzzleSolved();

              showToast('Tree Guardian Uprooted: Starlight Dash Claimed!');

              saveCheckpoint();

            } else if (g.isWraith) {

              showToast('Mirror Wraith Banished: Halls of Mirrors Cleansed!');

              SoundFX.playPuzzleSolved();

            } else {

              showToast('Enemy Neutralized with Glass Dart');

            }

          }

          break;

        }

      }

      if (hitTarget || p.distTraveled >= p.maxDist) {

        engine.scene.remove(p.mesh);

        p.mesh.geometry.dispose();

        (p.mesh.material as THREE.Material).dispose();

        activeProjectiles.splice(i, 1);

      }

    }

    // Enemy Projectile Movement & Collision

    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {

      const ep = enemyProjectiles[i];

      const stepDist = 9.5 * dt;

      ep.mesh.position.addScaledVector(ep.dir, stepDist);

      ep.distTraveled += stepDist;

      const playerDist = Math.hypot(ep.mesh.position.x - playerState.x, ep.mesh.position.z - playerState.z);

      let hit = false;

      if (playerDist < 0.85) {
        hit = true;
        const outcome = mainChar ? mainChar.combat.receiveHit({ damage: 14, kind: 'spell' }) : (parryTimer > 0 ? 'parried' : 'hit');
        if (outcome === 'evaded') {
          spawnDamagePopup(playerMesh.position, 'EVADED!', true);
        } else if (outcome === 'parried' || outcome === 'countered' || parryTimer > 0) {
          SoundFX.playParry();
          cameraShake = 0.18;
          spawnDamagePopup(playerMesh.position, outcome === 'countered' ? 'SPELL DISPELLED!' : 'BOLT REFLECTED!', true);
          flashMesh(playerMesh, 0xf59e0b, 180);
          showToast(outcome === 'countered' ? 'Arcane Burst Dispelled Enemy Bolt!' : 'Mirror Bolt Reflected with Harmonic Parry!');
        } else if (outcome === 'blocked') {
          playerHP -= 4;
          SoundFX.playShieldBlock();
          cameraShake = 0.1;
          spawnDamagePopup(playerMesh.position, '-4 HP (BLOCKED)');
          flashMesh(playerMesh, 0x38bdf8, 140);
          updateHUD();
          if (playerHP <= 0) respawn();
        } else {
          playerHP -= 14;
          comboCount = 0;
          comboTimer = 0;
          SoundFX.playPlayerHurt();
          cameraShake = 0.22;
          spawnDamagePopup(playerMesh.position, '-14 HP');
          flashMesh(playerMesh, 0xef4444, 160);
          updateHUD();
          if (playerHP <= 0) respawn();
        }
      }

      if (hit || ep.distTraveled >= ep.maxDist) {

        engine.scene.remove(ep.mesh);

        ep.mesh.geometry.dispose();

        (ep.mesh.material as THREE.Material).dispose();

        enemyProjectiles.splice(i, 1);

      }

    }

    const rootMotion = mainChar ? mainChar.combat.consumeRootMotion() : new THREE.Vector3();
    const isBusy = mainChar ? mainChar.combat.busy : false;
    let nextPos = { x: playerState.x, y: 0.6, z: playerState.z };
    let deltaX = rootMotion.x;
    let deltaZ = rootMotion.z;
    if (isMoving && !isPaused && !isBusy) {
      const len = Math.hypot(moveX, moveZ);
      deltaX += (moveX / len) * playerState.speed * dt * autoplaySpeedScale;
      deltaZ += (moveZ / len) * playerState.speed * dt * autoplaySpeedScale;
    }
    nextPos = physics.movePlayer(deltaX, deltaZ);

    playerState.x = nextPos.x;

    playerState.z = nextPos.z;

    // Record position history for retrocausal rewind (Relativity Cloister)

    if (currentSceneId.startsWith('RS')) {

      const now = performance.now();

      positionHistory.push({ x: playerState.x, z: playerState.z, t: now });

      while (positionHistory.length > 0 && now - positionHistory[0].t > 5000) positionHistory.shift();

    } else {

      positionHistory.length = 0;

    }

    // Update combo display

    const comboEl = document.getElementById('hud-combo');

    if (comboEl) {

      if (comboCount > 1) {

        comboEl.style.opacity = '1';

        const timerBar = document.getElementById('hud-combo-timer');

        if (timerBar) timerBar.style.width = (comboTimer / 2.0 * 100) + '%';

        const textDiv = comboEl.querySelector('div');

        if (textDiv) textDiv.textContent = 'Combo x' + comboCount;

      } else {

        comboEl.style.opacity = '0';

      }

    }

    // Update Echo Bell expanding 3D rings

    for (let i = echoRings.length - 1; i >= 0; i--) {

      const ring = echoRings[i];

      ring.scale += dt * 8.5;

      ring.opacity -= dt * 0.85;

      ring.mesh.scale.set(ring.scale, ring.scale, ring.scale);

      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, ring.opacity);

      if (ring.opacity <= 0) {

        engine.scene.remove(ring.mesh);

        ring.mesh.geometry.dispose();

        (ring.mesh.material as THREE.Material).dispose();

        echoRings.splice(i, 1);

      }

    }

    // Portal rotation & True mirror pulse under Truth Lens

    if (starlightPortalMesh && starlightPortalMesh.visible) {

      starlightPortalMesh.rotation.z += 1.2 * dt;

    }

    if (currentSceneId === 'HM1' && trueMirrorMesh && trueMirrorMesh.visible) {

      trueMirrorMesh.traverse((node) => {

        if (node instanceof THREE.Mesh && node.material && 'emissive' in node.material) {

          if (truthLensActive) {

            node.material.emissive.setHex(0xfbbf24);

            node.material.emissiveIntensity = 1.4;

          } else {

            node.material.emissive.setHex(0x38bdf8);

            node.material.emissiveIntensity = 0.5;

          }

        }

      });

    }

    // Rotate active lore orbs

    for (const lore of loreObjects) {

      if (lore.sceneId === currentSceneId && lore.mesh) {

        const orb = lore.mesh.getObjectByName('LoreOrbMesh');

        if (orb) {

          orb.rotation.y += 1.8 * dt;

          orb.position.y = 1.25 + Math.sin(Date.now() * 0.003) * 0.08;

        } else {

          lore.mesh.rotation.y += 1.8 * dt;

          lore.mesh.position.y = lore.pos.y + Math.sin(Date.now() * 0.003) * 0.08;

        }

      }

    }

    // Smooth player rotation to face movement direction

    if (moveX !== 0 || moveZ !== 0) {

      targetPlayerYaw = Math.atan2(moveX, moveZ);

    }

    let yawDiff = targetPlayerYaw - playerMesh.rotation.y;

    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

    if (!mainChar || !mainChar.combat.busy) {
      playerMesh.rotation.y += yawDiff * Math.min(1, 16 * dt);
    }

    // Attack lunge decay & positioning

    attackLungeOffset = THREE.MathUtils.lerp(attackLungeOffset, 0, 10 * dt);

    const lungeX = Math.sin(playerMesh.rotation.y) * attackLungeOffset;

    const lungeZ = Math.cos(playerMesh.rotation.y) * attackLungeOffset;

    playerMesh.position.set(nextPos.x + lungeX, nextPos.y, nextPos.z + lungeZ);

    // Camera shake application

    if (cameraShake > 0) {

      cameraShake = Math.max(0, cameraShake - dt * 2.5);

      const shakeX = (Math.random() - 0.5) * cameraShake * 0.4;

      const shakeZ = (Math.random() - 0.5) * cameraShake * 0.4;

      engine.cameraRig.setTarget(nextPos.x + shakeX, 0, nextPos.z + shakeZ);

    } else {

      engine.cameraRig.setTarget(nextPos.x, 0, nextPos.z);

    }

    for (const bush of magicalBushes) {
      if (currentSceneId !== 'S00') continue;
      if (bush.mixer) {
        bush.mixer.update(dt);
      }
      const dist = Math.hypot(bush.mesh.position.x - playerState.x, bush.mesh.position.z - playerState.z);
      if (dist < 2.5) {
        if (!bush.isRetracted) {
          bush.isRetracted = true;
          if (bush.retractAction) {
            bush.retractAction.reset().fadeIn(0.2).play();
          }
          if (bush.idleAction) {
            bush.idleAction.fadeOut(0.2);
          }
        }
        bush.targetScale.set(0.35 * bush.originalScale.x, 0.12 * bush.originalScale.y, 0.35 * bush.originalScale.z);
        bush.mat.emissiveIntensity = THREE.MathUtils.lerp(bush.mat.emissiveIntensity, 0.2, 0.1);
      } else {
        if (bush.isRetracted) {
          bush.isRetracted = false;
          if (bush.idleAction) {
            bush.idleAction.reset().fadeIn(0.3).play();
          }
          if (bush.retractAction) {
            bush.retractAction.fadeOut(0.3);
          }
        }
        bush.targetScale.copy(bush.originalScale);
        bush.mat.emissiveIntensity = THREE.MathUtils.lerp(bush.mat.emissiveIntensity, 2.8, 0.05);
      }
      bush.mesh.scale.lerp(bush.targetScale, 0.08);
    }

    // Interaction Proximity Detection

    let hasPrompt = false;

    if (!hasPrompt) hasPrompt = updateQuestRuntimePrompt();

    // Check Lore Objects

    for (const lore of loreObjects) {

      if (lore.sceneId === currentSceneId && !activeDialogue && !isLoreOpen) {

        const d = Math.hypot(lore.pos.x - playerState.x, lore.pos.z - playerState.z);

        if (d < 2.0) {

          showInteractPrompt(`Inspect ${lore.name}`);

          hasPrompt = true;

          break;

        }

      }

    }

    if (!hasPrompt && currentSceneId === 'S00' && ravenMesh && !activeDialogue) {

      const d = Math.hypot(ravenMesh.position.x - playerState.x, ravenMesh.position.z - playerState.z);

      if (d < 2.5) {

        showInteractPrompt('Speak with Starlight Raven (Guildmaster Sable)');

        hasPrompt = true;

      }

    } else if (!hasPrompt && currentSceneId === 'OW1' && orinMesh && !activeDialogue) {

      const d = Math.hypot(orinMesh.position.x - playerState.x, orinMesh.position.z - playerState.z);

      if (d < 2.5) {

        showInteractPrompt('Speak with Gatekeeper Orin');

        hasPrompt = true;

      }

    }

    if (!hasPrompt && ironNailMesh && currentSceneId === 'OW1' && !inventory.has('ITEM_IRON_NAIL')) {

      const d = Math.hypot(ironNailMesh.position.x - playerState.x, ironNailMesh.position.z - playerState.z);

      if (d < 1.8) {

        showInteractPrompt('Pick up Iron Nail');

        hasPrompt = true;

      }

      if (d < 0.9) {

        inventory.add('ITEM_IRON_NAIL');

        ironNailMesh.parent?.remove(ironNailMesh);

        ironNailMesh = null;

        SoundFX.playPickup();

        showToast('Acquired: Iron Nail (Grounding Relic)');

        saveCheckpoint();

      }

    } else if (!hasPrompt && currentSceneId === 'GH2' && mirrorMesh && mirrorMesh.visible) {

      const d = Math.hypot(mirrorMesh.position.x - playerState.x, mirrorMesh.position.z - playerState.z);

      if (d < 2.5) {

        if (inventory.has('ITEM_IRON_NAIL')) {

          showInteractPrompt('Shatter Mirror Lock with Iron Nail');

        } else {

          showInteractPrompt('Mirror Lock (Requires Iron Nail)');

        }

        hasPrompt = true;

      }

    } else if (!hasPrompt && currentSceneId === 'HM1' && trueMirrorMesh && trueMirrorMesh.visible) {

      const d = Math.hypot(trueMirrorMesh.position.x - playerState.x, trueMirrorMesh.position.z - playerState.z);

      if (d < 2.5) {

        if (truthLensActive) {

          showInteractPrompt('Shatter True Mirror to Unseal Portal');

        } else {

          showInteractPrompt('Suspicious Mirror (Requires Truth Lens Resonance)');

        }

        hasPrompt = true;

      }

    } else if (!hasPrompt && currentSceneId === 'BQ1' && !activeDialogue) {

      if (morvathMesh && Math.hypot(morvathMesh.position.x - playerState.x, morvathMesh.position.z - playerState.z) < 2.5) {

        showInteractPrompt('Speak with Lord Morvath (Master of the Cenacle)');

        hasPrompt = true;

      } else if (banquetBoarMesh && !solvedPuzzles.has('PUZZLE_FEAST_SATIETY') && Math.hypot(banquetBoarMesh.position.x - playerState.x, banquetBoarMesh.position.z - playerState.z) < 2.8) {

        showInteractPrompt(inventory.has('ITEM_TANTALUS_GOBLET') || truthLensActive ? 'Expose Phantom Feast with Tantalus Goblet' : 'Phantom Roast Boar (Requires Tantalus Goblet or Truth Lens)');

        hasPrompt = true;

      }

    } else if (!hasPrompt && currentSceneId === 'AG1' && !activeDialogue) {

      if (yggdraMesh && Math.hypot(yggdraMesh.position.x - playerState.x, yggdraMesh.position.z - playerState.z) < 3.2) {

        showInteractPrompt('Commune with Yggdra the Ancient Bough');

        hasPrompt = true;

      } else if (rootWallMesh && rootWallMesh.visible && Math.hypot(rootWallMesh.position.x - playerState.x, rootWallMesh.position.z - playerState.z) < 2.5) {

        showInteractPrompt(abilities.has('ABILITY_STARLIGHT_DASH') ? 'Pierce Root Wall with Starlight Dash' : 'Thorny Root Wall (Requires Starlight Dash)');

        hasPrompt = true;

      }

    } else if (!hasPrompt && currentSceneId === 'MH1' && !activeDialogue) {

      if (hazelMesh && Math.hypot(hazelMesh.position.x - playerState.x, hazelMesh.position.z - playerState.z) < 2.5) {

        showInteractPrompt('Speak with Mother Hazel (The Confectioner)');

        hasPrompt = true;

      } else if (kettleMesh && !solvedPuzzles.has('PUZZLE_HOSPITALITY_GAMBIT') && Math.hypot(kettleMesh.position.x - playerState.x, kettleMesh.position.z - playerState.z) < 2.5) {

        showInteractPrompt(inventory.has('ITEM_SUGAR_SPOON') ? 'Stir Boiling Kettle with Sugar Spoon' : 'Boiling Hearth Kettle (Requires Sugar Spoon)');

        hasPrompt = true;

      }

    } else if (!hasPrompt && currentSceneId === 'SAN1' && !activeDialogue) {

      if (cynthiaCrystal && Math.hypot(cynthiaCrystal.position.x - playerState.x, cynthiaCrystal.position.z - playerState.z) < 2.8) {

        showInteractPrompt(solvedPuzzles.has('PUZZLE_HOLLOW_GLASS') ? 'Commune with Liberated Cynthia' : 'Cynthia in Glass Heart (Defeat Archillusionist Vaelor)');

        hasPrompt = true;

      } else if (vaelorBoss && vaelorBoss.hp > 0 && Math.hypot(vaelorBoss.mesh.position.x - playerState.x, vaelorBoss.mesh.position.z - playerState.z) < 2.8) {

        showInteractPrompt('Confront Archillusionist Vaelor');

        hasPrompt = true;

      }

    } else if (!hasPrompt && currentSceneId.startsWith('RS') && !solvedPuzzles.has('PUZZLE_RELATIVITY_STAIRS')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(inventory.has('ITEM_IRON_NAIL') || inventory.has('ITEM_COLD_IRON_KEY') ? 'Anchor Escher Stairs with Cold Iron' : 'Escher Stair Anchor (Requires Iron Nail or Cold-Iron Key)');

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'PB1' && !inventory.has('ITEM_WARDEN_KEYRING')) {

      const d = Math.hypot(3 - playerState.x, -2 - playerState.z);

      if (d < 1.8) {

        showInteractPrompt("Pick up Warden's Abyssal Keyring");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'PB4' && !solvedPuzzles.has('PUZZLE_PRISON_ESCAPE')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(inventory.has('ITEM_WARDEN_KEYRING') ? "Liberate Prison Block with Warden's Keyring" : "Warden Office (Requires Warden's Keyring)");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'RG2' && !inventory.has('ITEM_WIND_VANE')) {

      const d = Math.hypot(2 - playerState.x, -1 - playerState.z);

      if (d < 1.8) {

        showInteractPrompt("Pick up Wind Vane");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'RG4' && !solvedPuzzles.has('PUZZLE_WIND_SECRET')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(inventory.has('ITEM_WIND_VANE') ? "Reveal the Wind's Secret" : "Vista Point (Requires Wind Vane)");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'VR2' && !inventory.has('ITEM_DREAM_CORE')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 1.8) {

        showInteractPrompt("Pick up Dream Core");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'VR3' && !solvedPuzzles.has('PUZZLE_DREAM_DESCENT')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(inventory.has('ITEM_DREAM_CORE') ? "Complete Dream Descent" : "Core Return (Requires Dream Core)");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'TR2' && !inventory.has('ITEM_CURATOR_TROPHY')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 1.8) {

        showInteractPrompt("Open Mimic Chest");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'TR4' && !solvedPuzzles.has('PUZZLE_HUNTERS_LIE')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(inventory.has('ITEM_CURATOR_TROPHY') ? "Expose the Hunter's Lie" : "Curator's Lore Orb (Requires Trophy)");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'U1' && !inventory.has('ITEM_PRAYER_BEADS')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 1.8) {

        showInteractPrompt("Pick up Prayer Beads");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'U2' && !solvedPuzzles.has('PUZZLE_MONK_TOMBS')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(inventory.has('ITEM_PRAYER_BEADS') ? "Lay Monk Spirits to Rest" : "Monk Tombs (Requires Prayer Beads)");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'U3' && !solvedPuzzles.has('PUZZLE_ECHO_CHAMBER')) {

      const d = Math.hypot(0 - playerState.x, -2.5 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt("Resonate the Echo Bell");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'AT1' && !inventory.has('ITEM_ASTROMANCERS_LENS')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 1.8) {

        showInteractPrompt("Pick up Astromancer's Lens");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'AT2' && !solvedPuzzles.has('PUZZLE_CONSTELLATION')) {

      const d = Math.hypot(0 - playerState.x, -2.0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt("Align Constellations with Telescope");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'AT3' && !solvedPuzzles.has('PUZZLE_STAR_MAP')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(inventory.has('ITEM_ASTROMANCERS_LENS') ? "Align Star Map" : "Star Map Pedestal (Requires Lens)");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'BT1' && !solvedPuzzles.has('PUZZLE_AEOLIAN_CHIME')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt("Tune Aeolian Baffles");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'AL1' && !inventory.has('ITEM_VOLATILE_SULFUR')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 1.8) {

        showInteractPrompt("Pick up Volatile Sulfur");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'AL3' && !solvedPuzzles.has('PUZZLE_UNSTABLE_FORMULA')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(inventory.has('ITEM_VOLATILE_SULFUR') ? "Stabilize Unstable Formula" : "Brewing Bench (Requires Sulfur)");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'U4' && !solvedPuzzles.has('PUZZLE_MIRROR_VAULT')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(abilities.has('ABILITY_MIRROR_PHASE') ? "Phase Through Sealed Vault" : "Sealed Vault (Requires Mirror Phase)");

        hasPrompt = true;

      }

    }

    if (!hasPrompt && currentSceneId === 'CO3' && !solvedPuzzles.has('PUZZLE_CRYSTAL_THEATER')) {

      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

      if (d < 2.5) {

        showInteractPrompt(abilities.has('ABILITY_MIRROR_PHASE') ? "Unveil Crystal Theater" : "Crystal Mirror (Requires Mirror Phase)");

        hasPrompt = true;

      }

    }

    // GH1

    if (!hasPrompt && currentSceneId === 'GH1' && !inventory.has('ITEM_CAPTAIN_LEDGER')) {

      const d = Math.hypot(2 - playerState.x, -1 - playerState.z);

      if (d < 1.8) { showInteractPrompt("Pick up Captain's Patrol Ledger"); hasPrompt = true; }

    }
    if (!hasPrompt && currentSceneId === 'GH1' && !solvedPuzzles.has('PUZZLE_GATEHOUSE_EXTERIOR')) {
      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
      if (d < 2.5) { showInteractPrompt(inventory.has('ITEM_CAPTAIN_LEDGER') ? "Clear Gatehouse Exterior" : "Gatehouse Exterior (Requires Captain's Patrol Ledger)"); hasPrompt = true; }
    }
    // GH4
    if (!hasPrompt && currentSceneId === 'GH4' && !inventory.has('ITEM_VENT_KEY')) {

      const d = Math.hypot(1 - playerState.x, 0 - playerState.z);
      if (d < 1.8) { showInteractPrompt("Pick up Vent Grate Key"); hasPrompt = true; }
    }
    if (!hasPrompt && currentSceneId === 'GH4' && !solvedPuzzles.has('PUZZLE_VENT_ASCENT')) {
      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
      if (d < 2.5) { showInteractPrompt(inventory.has('ITEM_VENT_KEY') ? "Ascend the Vent Passage" : "Vent Ascent (Requires Vent Grate Key)"); hasPrompt = true; }
    }
    // SQ1
    if (!hasPrompt && currentSceneId === 'SQ1' && !inventory.has('ITEM_SERVANT_DIARY')) {
      const d = Math.hypot(-2 - playerState.x, 1 - playerState.z);
      if (d < 1.8) { showInteractPrompt("Pick up Servant's Diary"); hasPrompt = true; }
    }
    if (!hasPrompt && currentSceneId === 'SQ1' && !solvedPuzzles.has('PUZZLE_SERVANT_SECRET')) {
      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
      if (d < 2.5) { showInteractPrompt(inventory.has('ITEM_SERVANT_DIARY') ? "Uncover Servant Secret" : "Servant Secret (Requires Servant's Diary)"); hasPrompt = true; }
    }
    // B1
    if (!hasPrompt && currentSceneId === 'B1' && !inventory.has('ITEM_ARMORY_KEY')) {
      const d = Math.hypot(0 - playerState.x, 2 - playerState.z);
      if (d < 1.8) { showInteractPrompt("Pick up Barracks Armory Key"); hasPrompt = true; }
    }
    if (!hasPrompt && currentSceneId === 'B1' && !solvedPuzzles.has('PUZZLE_BARRACKS_RAID')) {
      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
      if (d < 2.5) { showInteractPrompt(inventory.has('ITEM_ARMORY_KEY') ? "Raid Barracks Armory" : "Barracks Raid (Requires Armory Key)"); hasPrompt = true; }
    }
    // RC1
    if (!hasPrompt && currentSceneId === 'RC1' && !inventory.has('ITEM_IRON_NAILS')) {
      const d = Math.hypot(0 - playerState.x, -2 - playerState.z);
      if (d < 1.8) { showInteractPrompt("Pick up Iron Nail Bundle"); hasPrompt = true; }
    }
    if (!hasPrompt && currentSceneId === 'RC1' && !solvedPuzzles.has('PUZZLE_RELATIVITY_ANCHOR')) {
      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
      if (d < 2.5) { showInteractPrompt(inventory.has('ITEM_IRON_NAILS') ? "Anchor the Relativity Cloister" : "Anchor Cloister (Requires Iron Nails)"); hasPrompt = true; }
    }
    // CR1
    if (!hasPrompt && currentSceneId === 'CR1' && !inventory.has('ITEM_TACHYON_PHIAL')) {
      const d = Math.hypot(2 - playerState.x, -1 - playerState.z);
      if (d < 1.8) { showInteractPrompt("Pick up Tachyon Phial"); hasPrompt = true; }
    }
    if (!hasPrompt && currentSceneId === 'CR1' && !solvedPuzzles.has('PUZZLE_RETROCAUSAL_PORTCULLIS')) {
      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
      if (d < 2.5) { showInteractPrompt(inventory.has('ITEM_TACHYON_PHIAL') ? "Solve Retrocausal Portcullis" : "Portcullis (Requires Tachyon Phial)"); hasPrompt = true; }
    }
    // MS3
    if (!hasPrompt && currentSceneId === 'MS3' && !inventory.has('ITEM_GLASS_MALLET')) {

      const d = Math.hypot(2 - playerState.x, -1 - playerState.z);
      if (d < 1.8) { showInteractPrompt("Pick up Glass-Armonica Mallet"); hasPrompt = true; }
    }
    if (!hasPrompt && currentSceneId === 'MS3' && !solvedPuzzles.has('PUZZLE_RESONANT_HARMONIES')) {
      const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
      if (d < 2.5) { showInteractPrompt(inventory.has('ITEM_GLASS_MALLET') ? "Perform Resonant Harmonies" : "Harmonies (Requires Glass-Armonica Mallet)"); hasPrompt = true; }
    }
    if (!hasPrompt) hideInteractPrompt();
    // Rotate Cynthia's Dodecahedron crystal in SAN1

    if (currentSceneId === 'SAN1' && cynthiaCrystal) {
      cynthiaCrystal.rotation.y += 0.8 * dt;
    }
    for (const g of activeGuards) updateGuard(g, dt);
    // Update detection meter HUD
    const detEl = document.getElementById('hud-detection');
    const detFill = document.getElementById('hud-detection-fill');
    if (detEl && detFill) {
      const guards = activeGuards.filter((g) => g.sceneId === currentSceneId && g.state !== 'dead');
      const maxDet = guards.reduce((m, g) => Math.max(m, g.detection || 0), 0);

      detFill.style.width = (maxDet * 100) + '%';

      detEl.style.opacity = maxDet > 0.05 ? '1' : '0';

    }

    if (exitCooldown > 0) exitCooldown -= dt;

    if (lockedMessageCooldown > 0) lockedMessageCooldown -= dt;

    checkExits();

  },

});

quality = new QualityManager(engine.renderer);

const audioManager = new AudioManager(engine.cameraRig.camera);

new THREE.TextureLoader().load(ASSETS.CONCEPT.SCENE00_APPROACH_SUNKEN, (tex) => {

  tex.colorSpace = THREE.SRGBColorSpace;

  engine.scene.background = tex;

  engine.scene.backgroundIntensity = 0.5;

});

// ---------- S00 authored courtyard ----------
const s00Group = new THREE.Group();
const gltfLoader = new GLTFLoader();
let kaelenAnimations: THREE.AnimationClip[] = [];
let brambleAnimations: THREE.AnimationClip[] = [];
let guardAnimations: THREE.AnimationClip[] = [];
let vaelorAnimations: THREE.AnimationClip[] = [];
let ravenAnimations: THREE.AnimationClip[] = [];
let wraithAnimations: THREE.AnimationClip[] = [];
let hazelAnimations: THREE.AnimationClip[] = [];
let orinAnimations: THREE.AnimationClip[] = [];

let ravenMixer: THREE.AnimationMixer | null = null;
let ravenActions: Record<string, THREE.AnimationAction> = {};
let orinMixer: THREE.AnimationMixer | null = null;
let orinActions: Record<string, THREE.AnimationAction> = {};
let hazelMixer: THREE.AnimationMixer | null = null;
let hazelActions: Record<string, THREE.AnimationAction> = {};

const [
  courtyardScene,
  kaelenModel,
  guardModel,
  roomShellModel,
  gateArchModel,
  mirrorLockModel,
  bq1FeastModel,
  ag1TreeModel,
  mh1HearthModel,
  san1SanctumModel,
  brambleModel,
  vaelorModel,
  ravenModel,
  wraithModel,
  hazelModel,
  orinModel,
  archivalLecternModel,
  patrolDeskModel,
  ventGrateModel,
  servantHearthModel,
  barracksArmoryModel,
  escherAnchorModel,
  chronomanticAstrolabeModel,
  glassArmonicaModel,
  wardenDeskModel,
  rooftopAnemometerModel,
  celestialTelescopeModel,
  starmapPedestalModel,
  alchemistBenchModel,
  mimicChestModel,
  monkSarcophagusModel,
  aeolianBelfryModel,
  voidRiftAnchorModel,
  crystalTheaterMirrorModel,
  steampunkBoilerModel,
  starlightPlanterModel,
] = await Promise.all([
  gltfLoader.loadAsync('assets/models/s00_courtyard.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/kaelen.glb').then((g) => { kaelenAnimations = g.animations || []; return g.scene; }),
  gltfLoader.loadAsync('assets/models/keep_guard.glb').then((g) => { guardAnimations = g.animations || []; return g.scene; }),
  gltfLoader.loadAsync('assets/models/room_shell.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/gate_arch.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/mirror_lock.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/bq1_feast.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/ag1_tree.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/mh1_hearth.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/san1_sanctum.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/veil_bramble.glb').then((g) => { brambleAnimations = g.animations || []; return g.scene; }),
  gltfLoader.loadAsync('assets/models/vaelor.glb').then((g) => { vaelorAnimations = g.animations || []; return g.scene; }),
  gltfLoader.loadAsync('assets/models/starlight_raven.glb').then((g) => { ravenAnimations = g.animations || []; return g.scene; }),
  gltfLoader.loadAsync('assets/models/mirror_wraith.glb').then((g) => { wraithAnimations = g.animations || []; return g.scene; }),
  gltfLoader.loadAsync('assets/models/mother_hazel.glb').then((g) => { hazelAnimations = g.animations || []; return g.scene; }),
  gltfLoader.loadAsync('assets/models/gatekeeper_orin.glb').then((g) => { orinAnimations = g.animations || []; return g.scene; }),
  gltfLoader.loadAsync('assets/models/archival_lectern.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/patrol_desk.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/vent_grate.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/servant_hearth.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/barracks_armory.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/escher_anchor.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/chronomantic_astrolabe.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/glass_armonica.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/warden_desk.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/rooftop_anemometer.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/celestial_telescope.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/starmap_pedestal.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/alchemist_bench.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/mimic_chest.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/monk_sarcophagus.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/aeolian_belfry.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/void_rift_anchor.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/crystal_theater_mirror.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/steampunk_boiler.glb').then((g) => g.scene),
  gltfLoader.loadAsync('assets/models/starlight_planter.glb').then((g) => g.scene),
]);

[
  archivalLecternModel,
  patrolDeskModel,
  ventGrateModel,
  servantHearthModel,
  barracksArmoryModel,
  escherAnchorModel,
  chronomanticAstrolabeModel,
  glassArmonicaModel,
  wardenDeskModel,
  rooftopAnemometerModel,
  celestialTelescopeModel,
  starmapPedestalModel,
  alchemistBenchModel,
  mimicChestModel,
  monkSarcophagusModel,
  aeolianBelfryModel,
  voidRiftAnchorModel,
  crystalTheaterMirrorModel,
  steampunkBoilerModel,
  starlightPlanterModel,
].forEach((m) => {
  m.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
});

courtyardScene.traverse((node) => {
  // The GLB contains decorative thorn/veil meshes; hide those and keep the
  // interactive photophobic bushes below as the single source of truth.
  if (node.name.includes('Thorn') || node.name.includes('Veil')) node.visible = false;
  if (node instanceof THREE.Mesh) {
    node.castShadow = true;
    node.receiveShadow = true;
  }
});

s00Group.add(courtyardScene);

function createMagicalBush(x: number, z: number, scaleMultiplier = 1.0): void {
  const bushInstance = SkeletonUtils.clone(brambleModel) as THREE.Group;
  bushInstance.position.set(x, 0.05, z);
  bushInstance.scale.setScalar(scaleMultiplier);

  let coreMat: THREE.MeshStandardMaterial | undefined;
  bushInstance.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        node.material = (node.material as THREE.Material).clone();
        if (node.material.name === 'VK_Veil_Core' || node.material.name === 'VK_Veil_Amethyst') {
          coreMat = node.material as THREE.MeshStandardMaterial;
        }
      }
    }
  });

  let mixer: THREE.AnimationMixer | undefined;
  let idleAction: THREE.AnimationAction | undefined;
  let retractAction: THREE.AnimationAction | undefined;

  if (brambleAnimations.length > 0) {
    mixer = new THREE.AnimationMixer(bushInstance);
    const idleClip = THREE.AnimationClip.findByName(brambleAnimations, 'Idle');
    const retractClip = THREE.AnimationClip.findByName(brambleAnimations, 'Retract');
    if (idleClip) {
      idleAction = mixer.clipAction(idleClip);
      idleAction.play();
    }
    if (retractClip) {
      retractAction = mixer.clipAction(retractClip);
      retractAction.setLoop(THREE.LoopOnce, 1);
      retractAction.clampWhenFinished = true;
    }
  }

  s00Group.add(bushInstance);

  const origScale = new THREE.Vector3(scaleMultiplier, scaleMultiplier, scaleMultiplier);
  magicalBushes.push({
    mesh: bushInstance,
    mat: coreMat ?? new THREE.MeshStandardMaterial({ color: 0x4c1d95, emissive: 0x7c3aed }),
    mixer,
    idleAction,
    retractAction,
    isRetracted: false,
    originalScale: origScale,
    targetScale: origScale.clone(),
  });
}

createMagicalBush(-2.2, -1.8, 1.2);

createMagicalBush(2.2, -1.8, 1.2);

createMagicalBush(-3.5, 0.5, 0.9);

createMagicalBush(3.5, 0.5, 0.9);

createMagicalBush(-1.2, 0.8, 0.7);

createMagicalBush(1.2, 0.8, 0.7);

function addS00Colliders(): void {
  addGenericColliders();
}


// ---------- Interactive NPC Entities ----------

let ravenMesh: THREE.Group | null = null;

let orinMesh: THREE.Group | null = null;

function createStarlightRaven(): THREE.Group {
  const group = SkeletonUtils.clone(ravenModel) as THREE.Group;
  group.position.set(-2.5, 0.9, -4.8);
  group.scale.setScalar(1.2);
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  if (ravenAnimations.length > 0) {
    ravenMixer = new THREE.AnimationMixer(group);
    for (const clip of ravenAnimations) {
      ravenActions[clip.name] = ravenMixer.clipAction(clip);
    }
    if (ravenActions['Idle']) {
      ravenActions['Idle'].play();
    }
  }

  const ravenLight = new THREE.PointLight(0x38bdf8, 1.4, 4);
  ravenLight.position.set(0, 0.35, 0.2);
  group.add(ravenLight);

  return group;
}

ravenMesh = createStarlightRaven();

s00Group.add(ravenMesh);

// ---------- Generic manifest rooms ----------

const sceneGroups = new Map<SceneId, THREE.Group>([['S00', s00Group]]);

let activeGroup: THREE.Group = s00Group;

let ironNailMesh: THREE.Mesh | null = null;

let mirrorMesh: THREE.Group | null = null;

let trueMirrorMesh: THREE.Group | null = null;

let starlightPortalMesh: THREE.Mesh | null = null;

let guard: Guard | null = null;

let captain: Guard | null = null;

let wraith: Guard | null = null;

function shootMirrorBolt(origin: THREE.Vector3, target: THREE.Vector3): void {

  SoundFX.playMirrorBolt();

  const geom = new THREE.SphereGeometry(0.18, 8, 8);

  const mat = new THREE.MeshStandardMaterial({

    color: 0xc084fc,

    emissive: 0x9333ea,

    emissiveIntensity: 1.8,

    roughness: 0.1

  });

  const mesh = new THREE.Mesh(geom, mat);

  mesh.position.copy(origin);

  engine.scene.add(mesh);

  const dir = new THREE.Vector3(target.x - origin.x, 0, target.z - origin.z).normalize();

  enemyProjectiles.push({

    mesh,

    dir,

    distTraveled: 0,

    maxDist: 14.0

  });

}

function createLoreOrb(obj: LoreObject): THREE.Group {

  const g = new THREE.Group();

  g.position.set(obj.pos.x, 0, obj.pos.z);

  const lectern = archivalLecternModel.clone();
  lectern.position.set(0, 0, 0);
  g.add(lectern);

  const orbGroup = new THREE.Group();
  orbGroup.name = 'LoreOrbMesh';
  orbGroup.position.set(0, 1.25, 0);

  const orbMat = new THREE.MeshStandardMaterial({

    color: 0xf59e0b,

    emissive: 0xd4af37,

    emissiveIntensity: 1.2,

    roughness: 0.2,

  });

  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), orbMat);

  orb.castShadow = true;

  orbGroup.add(orb);

  const light = new THREE.PointLight(0xd4af37, 1.2, 3.0);

  light.position.set(0, 0.1, 0);

  orbGroup.add(light);

  g.add(orbGroup);

  obj.mesh = g;

  return g;

}

// Add S00 Cynthia's Glass Rose Lore Orb

s00Group.add(createLoreOrb(loreObjects[0]));

function makeGuardMesh(color: number): THREE.Group {
  const mesh = SkeletonUtils.clone(guardModel) as THREE.Group;
  mesh.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        node.material = (node.material as THREE.Material).clone();
        if ('color' in node.material) {
          (node.material as THREE.MeshStandardMaterial).color.setHex(color);
        }
      }
    }
  });
  return mesh;
}

function playGuardAnim(g: Guard, name: string): void {
  if (!g.mixer || !g.actions || !g.actions[name]) return;
  if (g.currentAction === name) return;
  const nextAction = g.actions[name];
  if (g.currentAction && g.actions[g.currentAction]) {
    g.actions[g.currentAction].fadeOut(0.2);
  }
  nextAction.reset().fadeIn(0.2).play();
  g.currentAction = name;
}

function createGuard(sceneId: SceneId, x: number, z: number, captainFlag = false): Guard {
  const mesh = makeGuardMesh(captainFlag ? 0xb91c1c : 0x7f1d1d);
  mesh.position.set(x, 0.6, z);
  const hp = captainFlag ? 80 : 40;

  let mixer: THREE.AnimationMixer | undefined;
  const actions: Record<string, THREE.AnimationAction> = {};
  if (guardAnimations.length > 0) {
    mixer = new THREE.AnimationMixer(mesh);
    for (const clip of guardAnimations) {
      actions[clip.name] = mixer.clipAction(clip);
    }
    if (actions['Idle']) {
      actions['Idle'].play();
    }
  }

  // Floating enemy HP bar DOM elements
  const barEl = document.createElement('div');
  barEl.className = 'enemy-hp-bar';
  const fillEl = document.createElement('div');
  fillEl.className = 'enemy-hp-fill';
  barEl.appendChild(fillEl);
  const poiseEl = document.createElement('div');
  poiseEl.className = 'enemy-poise-fill';
  barEl.appendChild(poiseEl);
  damageContainer?.appendChild(barEl);

  const guard: Guard = {
    sceneId,
    mesh,
    hp,
    maxHp: hp,
    patrol: [new THREE.Vector3(x - 1.5, 0.6, z), new THREE.Vector3(x + 1.5, 0.6, z)],
    patrolIndex: 0,
    state: 'patrol',
    cooldown: 0,
    speed: captainFlag ? 2.3 : 1.8,
    captain: captainFlag,
    hpBarEl: barEl,
    hpFillEl: fillEl,
    hpBarTimer: 0,
    detection: 0,
    poise: captainFlag ? 85 : 45,
    maxPoise: captainFlag ? 85 : 45,
    poiseRegenTimer: 0,
    isStunned: false,
    stunTimer: 0,
    windupTimer: 0,
    poiseFillEl: poiseEl,
    mixer,
    actions,
    currentAction: 'Idle',
    alertEl: (() => {
      const el = document.createElement('div');
      el.textContent = '!';
      el.style.cssText = 'position:absolute;font-size:20px;font-weight:900;color:#f59e0b;text-shadow:0 0 6px #ef4444;pointer-events:none;opacity:0;transition:opacity 0.15s ease;z-index:96;';
      damageContainer?.appendChild(el);
      return el;
    })(),
  };

  activeGuards.push(guard);
  return guard;
}

function createMirrorWraith(sceneId: SceneId, x: number, z: number): Guard {
  const mesh = SkeletonUtils.clone(wraithModel) as THREE.Group;
  mesh.position.set(x, 1.1, z);
  mesh.scale.setScalar(1.15);
  mesh.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  let mixer: THREE.AnimationMixer | undefined;
  const actions: Record<string, THREE.AnimationAction> = {};
  if (wraithAnimations.length > 0) {
    mixer = new THREE.AnimationMixer(mesh);
    for (const clip of wraithAnimations) {
      actions[clip.name] = mixer.clipAction(clip);
    }
    if (actions['Idle']) {
      actions['Idle'].play();
    }
  }

  const wraithLight = new THREE.PointLight(0xa855f7, 1.8, 6);
  wraithLight.position.set(0, 0.8, 0);
  mesh.add(wraithLight);

  const barEl = document.createElement('div');
  barEl.className = 'enemy-hp-bar';
  const fillEl = document.createElement('div');
  fillEl.className = 'enemy-hp-fill';
  fillEl.style.background = 'linear-gradient(90deg, #a855f7, #6366f1)';
  barEl.appendChild(fillEl);
  damageContainer?.appendChild(barEl);

  const wraithGuard: Guard = {
    sceneId,
    mesh,
    hp: 60,
    maxHp: 60,
    patrol: [new THREE.Vector3(x - 2, 1.1, z), new THREE.Vector3(x + 2, 1.1, z)],
    patrolIndex: 0,
    state: 'patrol',
    cooldown: 1.0,
    speed: 2.1,
    captain: false,
    isWraith: true,
    hpBarEl: barEl,
    hpFillEl: fillEl,
    hpBarTimer: 0,
    detection: 0,
    mixer,
    actions,
    currentAction: 'Idle',
    alertEl: (() => {
      const el = document.createElement('div');
      el.textContent = '!';
      el.style.cssText = 'position:absolute;font-size:20px;font-weight:900;color:#f59e0b;text-shadow:0 0 6px #ef4444;pointer-events:none;opacity:0;transition:opacity 0.15s ease;z-index:96;';
      damageContainer?.appendChild(el);
      return el;
    })(),
  };

  activeGuards.push(wraithGuard);
  return wraithGuard;
}

function createBossVaelor(sceneId: SceneId, x: number, z: number): Guard {
  const mesh = SkeletonUtils.clone(vaelorModel) as THREE.Group;
  mesh.position.set(x, 1.2, z);
  mesh.scale.setScalar(1.25);
  mesh.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  let mixer: THREE.AnimationMixer | undefined;
  const actions: Record<string, THREE.AnimationAction> = {};
  if (vaelorAnimations.length > 0) {
    mixer = new THREE.AnimationMixer(mesh);
    for (const clip of vaelorAnimations) {
      actions[clip.name] = mixer.clipAction(clip);
    }
    if (actions['Idle']) {
      actions['Idle'].play();
    }
  }

  const bossLight = new THREE.PointLight(0x818cf8, 2.5, 8);
  bossLight.position.set(0, 1.0, 0);
  mesh.add(bossLight);

  const barEl = document.createElement('div');
  barEl.className = 'enemy-hp-bar boss-hp-bar';
  const fillEl = document.createElement('div');
  fillEl.className = 'enemy-hp-fill';
  fillEl.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
  barEl.appendChild(fillEl);
  damageContainer?.appendChild(barEl);

  const bossGuard: Guard = {
    sceneId,
    mesh,
    hp: 120,
    maxHp: 120,
    patrol: [new THREE.Vector3(x - 3, 1.2, z), new THREE.Vector3(x + 3, 1.2, z)],
    patrolIndex: 0,
    state: 'patrol',
    cooldown: 0.8,
    speed: 2.4,
    captain: true,
    isWraith: true,
    hpBarEl: barEl,
    hpFillEl: fillEl,
    hpBarTimer: 0,
    detection: 0,
    mixer,
    actions,
    currentAction: 'Idle',
    alertEl: (() => {
      const el = document.createElement('div');
      el.textContent = '!';
      el.style.cssText = 'position:absolute;font-size:20px;font-weight:900;color:#f59e0b;text-shadow:0 0 6px #ef4444;pointer-events:none;opacity:0;transition:opacity 0.15s ease;z-index:96;';
      damageContainer?.appendChild(el);
      return el;
    })(),
  };

  activeGuards.push(bossGuard);
  return bossGuard;
}

function buildModularFloor(gridX = 3, gridZ = 3, tintColor?: number, roomExits?: ExitTrigger[]): THREE.Group {
  const floorGroup = new THREE.Group();
  floorGroup.name = 'ModularTiledFloor';

  const totalW = gridX * 12.0;
  const totalD = gridZ * 12.0;

  // Single foundation base slab below the entire arena
  const slabGeo = new THREE.BoxGeometry(totalW + 0.35, 0.56, totalD + 0.35);
  const slabMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.9,
    metalness: 0.1,
  });
  const slab = new THREE.Mesh(slabGeo, slabMat);
  slab.position.set(0, -0.28, 0);
  slab.receiveShadow = true;
  floorGroup.add(slab);

  // Tile the 7 floor submeshes across the grid
  for (let gx = 0; gx < gridX; gx++) {
    for (let gz = 0; gz < gridZ; gz++) {
      const posX = (gx - (gridX - 1) / 2) * 12.0;
      const posZ = (gz - (gridZ - 1) / 2) * 12.0;

      const tile = roomShellModel.clone();
      tile.position.set(posX, 0, posZ);

      tile.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          // Hide outer rim/wall meshes on all tiled floor units so interior has zero seams!
          if (
            node.name.includes('BlueBlack') ||
            node.name.includes('Pale_Edges') ||
            node.name.includes('Slate_Worn') ||
            node.name.includes('Rim') ||
            node.name.includes('Wall')
          ) {
            node.visible = false;
            return;
          }
          node.castShadow = true;
          node.receiveShadow = true;
          if (node.material) {
            node.material = (node.material as THREE.Material).clone();
            if (tintColor !== undefined && 'color' in node.material) {
              (node.material as THREE.MeshStandardMaterial).color.multiply(
                new THREE.Color(tintColor).convertSRGBToLinear()
              );
            }
          }
        }
      });

      floorGroup.add(tile);
    }
  }

  // Outer perimeter rims & coping along outer boundaries
  const halfW = totalW / 2;
  const halfD = totalD / 2;

  const rimColor = tintColor ? new THREE.Color(tintColor).multiplyScalar(0.65).getHex() : 0x1e293b;
  const copingColor = tintColor ? new THREE.Color(tintColor).multiplyScalar(0.85).getHex() : 0x334155;

  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    roughness: 0.8,
    metalness: 0.2,
  });
  const copingMat = new THREE.MeshStandardMaterial({
    color: copingColor,
    roughness: 0.65,
    metalness: 0.25,
  });

  const activeExits = roomExits ?? (currentBuildingSceneId ? exits[currentBuildingSceneId] : undefined);
  const hasNorthGate = activeExits ? activeExits.some((e) => e.z <= -4.0) : true;
  const hasSouthGate = activeExits ? activeExits.some((e) => e.z >= 4.0) : true;
  const hasEastGate = activeExits ? activeExits.some((e) => e.x >= 4.0) : false;
  const hasWestGate = activeExits ? activeExits.some((e) => e.x <= -4.0) : false;

  const gateOpeningHalf = 2.0;

  // West outer boundary kerbs
  if (hasWestGate) {
    const westSegLen = halfD - gateOpeningHalf;
    if (westSegLen > 0) {
      const westGeo = new THREE.BoxGeometry(0.36, 0.45, westSegLen);
      const westCopingGeo = new THREE.BoxGeometry(0.44, 0.12, westSegLen);
      const westOffset = gateOpeningHalf + westSegLen / 2;

      const wNorthRim = new THREE.Mesh(westGeo, rimMat);
      wNorthRim.position.set(-halfW + 0.18, 0.15, -westOffset);
      wNorthRim.castShadow = true;
      wNorthRim.receiveShadow = true;
      floorGroup.add(wNorthRim);

      const wNorthCoping = new THREE.Mesh(westCopingGeo, copingMat);
      wNorthCoping.position.set(-halfW + 0.18, 0.42, -westOffset);
      wNorthCoping.castShadow = true;
      floorGroup.add(wNorthCoping);

      const wSouthRim = new THREE.Mesh(westGeo, rimMat);
      wSouthRim.position.set(-halfW + 0.18, 0.15, westOffset);
      wSouthRim.castShadow = true;
      wSouthRim.receiveShadow = true;
      floorGroup.add(wSouthRim);

      const wSouthCoping = new THREE.Mesh(westCopingGeo, copingMat);
      wSouthCoping.position.set(-halfW + 0.18, 0.42, westOffset);
      wSouthCoping.castShadow = true;
      floorGroup.add(wSouthCoping);
    }
  } else {
    const sideGeo = new THREE.BoxGeometry(0.36, 0.45, totalD);
    const sideCopingGeo = new THREE.BoxGeometry(0.44, 0.12, totalD);
    const westRim = new THREE.Mesh(sideGeo, rimMat);
    westRim.position.set(-halfW + 0.18, 0.15, 0);
    westRim.castShadow = true;
    westRim.receiveShadow = true;
    floorGroup.add(westRim);

    const westCoping = new THREE.Mesh(sideCopingGeo, copingMat);
    westCoping.position.set(-halfW + 0.18, 0.42, 0);
    westCoping.castShadow = true;
    westCoping.receiveShadow = true;
    floorGroup.add(westCoping);
  }

  // East outer boundary kerbs
  if (hasEastGate) {
    const eastSegLen = halfD - gateOpeningHalf;
    if (eastSegLen > 0) {
      const eastGeo = new THREE.BoxGeometry(0.36, 0.45, eastSegLen);
      const eastCopingGeo = new THREE.BoxGeometry(0.44, 0.12, eastSegLen);
      const eastOffset = gateOpeningHalf + eastSegLen / 2;

      const eNorthRim = new THREE.Mesh(eastGeo, rimMat);
      eNorthRim.position.set(halfW - 0.18, 0.15, -eastOffset);
      eNorthRim.castShadow = true;
      eNorthRim.receiveShadow = true;
      floorGroup.add(eNorthRim);

      const eNorthCoping = new THREE.Mesh(eastCopingGeo, copingMat);
      eNorthCoping.position.set(halfW - 0.18, 0.42, -eastOffset);
      eNorthCoping.castShadow = true;
      floorGroup.add(eNorthCoping);

      const eSouthRim = new THREE.Mesh(eastGeo, rimMat);
      eSouthRim.position.set(halfW - 0.18, 0.15, eastOffset);
      eSouthRim.castShadow = true;
      eSouthRim.receiveShadow = true;
      floorGroup.add(eSouthRim);

      const eSouthCoping = new THREE.Mesh(eastCopingGeo, copingMat);
      eSouthCoping.position.set(halfW - 0.18, 0.42, eastOffset);
      eSouthCoping.castShadow = true;
      floorGroup.add(eSouthCoping);
    }
  } else {
    const sideGeo = new THREE.BoxGeometry(0.36, 0.45, totalD);
    const sideCopingGeo = new THREE.BoxGeometry(0.44, 0.12, totalD);
    const eastRim = new THREE.Mesh(sideGeo, rimMat);
    eastRim.position.set(halfW - 0.18, 0.15, 0);
    eastRim.castShadow = true;
    eastRim.receiveShadow = true;
    floorGroup.add(eastRim);

    const eastCoping = new THREE.Mesh(sideCopingGeo, copingMat);
    eastCoping.position.set(halfW - 0.18, 0.42, 0);
    eastCoping.castShadow = true;
    eastCoping.receiveShadow = true;
    floorGroup.add(eastCoping);
  }

  // North outer boundary kerbs
  if (hasNorthGate) {
    const segLength = halfW - gateOpeningHalf;
    if (segLength > 0) {
      const northSouthGeo = new THREE.BoxGeometry(segLength, 0.45, 0.36);
      const northSouthCopingGeo = new THREE.BoxGeometry(segLength, 0.12, 0.44);
      const segOffset = gateOpeningHalf + segLength / 2;

      const nwRim = new THREE.Mesh(northSouthGeo, rimMat);
      nwRim.position.set(-segOffset, 0.15, -halfD + 0.18);
      nwRim.castShadow = true;
      nwRim.receiveShadow = true;
      floorGroup.add(nwRim);

      const nwCoping = new THREE.Mesh(northSouthCopingGeo, copingMat);
      nwCoping.position.set(-segOffset, 0.42, -halfD + 0.18);
      nwCoping.castShadow = true;
      floorGroup.add(nwCoping);

      const neRim = new THREE.Mesh(northSouthGeo, rimMat);
      neRim.position.set(segOffset, 0.15, -halfD + 0.18);
      neRim.castShadow = true;
      neRim.receiveShadow = true;
      floorGroup.add(neRim);

      const neCoping = new THREE.Mesh(northSouthCopingGeo, copingMat);
      neCoping.position.set(segOffset, 0.42, -halfD + 0.18);
      neCoping.castShadow = true;
      floorGroup.add(neCoping);
    }
  } else {
    const fullGeo = new THREE.BoxGeometry(totalW, 0.45, 0.36);
    const fullCopingGeo = new THREE.BoxGeometry(totalW, 0.12, 0.44);

    const nRim = new THREE.Mesh(fullGeo, rimMat);
    nRim.position.set(0, 0.15, -halfD + 0.18);
    nRim.castShadow = true;
    nRim.receiveShadow = true;
    floorGroup.add(nRim);

    const nCoping = new THREE.Mesh(fullCopingGeo, copingMat);
    nCoping.position.set(0, 0.42, -halfD + 0.18);
    nCoping.castShadow = true;
    floorGroup.add(nCoping);
  }

  // South outer boundary kerbs
  if (hasSouthGate) {
    const segLength = halfW - gateOpeningHalf;
    if (segLength > 0) {
      const northSouthGeo = new THREE.BoxGeometry(segLength, 0.45, 0.36);
      const northSouthCopingGeo = new THREE.BoxGeometry(segLength, 0.12, 0.44);
      const segOffset = gateOpeningHalf + segLength / 2;

      const swRim = new THREE.Mesh(northSouthGeo, rimMat);
      swRim.position.set(-segOffset, 0.15, halfD - 0.18);
      swRim.castShadow = true;
      swRim.receiveShadow = true;
      floorGroup.add(swRim);

      const swCoping = new THREE.Mesh(northSouthCopingGeo, copingMat);
      swCoping.position.set(-segOffset, 0.42, halfD - 0.18);
      swCoping.castShadow = true;
      floorGroup.add(swCoping);

      const seRim = new THREE.Mesh(northSouthGeo, rimMat);
      seRim.position.set(segOffset, 0.15, halfD - 0.18);
      seRim.castShadow = true;
      seRim.receiveShadow = true;
      floorGroup.add(seRim);

      const seCoping = new THREE.Mesh(northSouthCopingGeo, copingMat);
      seCoping.position.set(segOffset, 0.42, halfD - 0.18);
      seCoping.castShadow = true;
      floorGroup.add(seCoping);
    }
  } else {
    const fullGeo = new THREE.BoxGeometry(totalW, 0.45, 0.36);
    const fullCopingGeo = new THREE.BoxGeometry(totalW, 0.12, 0.44);

    const sRim = new THREE.Mesh(fullGeo, rimMat);
    sRim.position.set(0, 0.15, halfD - 0.18);
    sRim.castShadow = true;
    sRim.receiveShadow = true;
    floorGroup.add(sRim);

    const sCoping = new THREE.Mesh(fullCopingGeo, copingMat);
    sCoping.position.set(0, 0.42, halfD - 0.18);
    sCoping.castShadow = true;
    floorGroup.add(sCoping);
  }

  // 4 Corner Buttress Plinths
  const pillarGeo = new THREE.BoxGeometry(0.72, 0.9, 0.72);
  const pillarCapGeo = new THREE.BoxGeometry(0.82, 0.18, 0.82);
  const corners = [
    [-halfW + 0.36, -halfD + 0.36],
    [halfW - 0.36, -halfD + 0.36],
    [-halfW + 0.36, halfD - 0.36],
    [halfW - 0.36, halfD - 0.36],
  ];
  for (const [cx, cz] of corners) {
    const pillar = new THREE.Mesh(pillarGeo, rimMat);
    pillar.position.set(cx, 0.45, cz);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    floorGroup.add(pillar);

    const cap = new THREE.Mesh(pillarCapGeo, copingMat);
    cap.position.set(cx, 0.95, cz);
    cap.castShadow = true;
    floorGroup.add(cap);
  }

  return floorGroup;
}

// Expand S00 Courtyard into a full 36x36m modular arena with perimeter walls & north gate
const s00Floor = buildModularFloor(3, 3, 0x1e293b, exits['S00']);
s00Group.add(s00Floor);

const s00NorthGate = gateArchModel.clone();
s00NorthGate.position.set(0, 0, -17.5);
s00NorthGate.scale.setScalar(1.2);
s00NorthGate.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
s00Group.add(s00NorthGate);

let currentBuildingSceneId: SceneId | null = null;

function buildGenericScene(id: SceneId): THREE.Group {
  currentBuildingSceneId = id;
  const group = new THREE.Group();

  const isCustomCompound = id === 'MH1' || id === 'SAN1' || id === 'BQ1' || id === 'AG1';
  const isExtendedHall = id === 'CO1' || id === 'CO3';
  const gateZ = isCustomCompound ? 5.5 : (isExtendedHall ? 23.5 : 17.5);
  const gateX = isCustomCompound ? 5.5 : 17.5;
  const gateScale = isCustomCompound ? 0.95 : 1.2;

  const roomExits = exits[id] ?? [];
  const northExit = roomExits.find((e) => e.z <= -4.0);
  const southExit = roomExits.find((e) => e.z >= 4.0);
  const eastExit = roomExits.find((e) => e.x >= 4.0);
  const westExit = roomExits.find((e) => e.x <= -4.0);

  if (northExit) {
    const northGate = gateArchModel.clone();
    northGate.position.set(0, 0, -gateZ);
    northGate.scale.setScalar(gateScale);
    northGate.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    group.add(northGate);
  }

  if (southExit) {
    const southGate = gateArchModel.clone();
    southGate.position.set(0, 0, gateZ);
    southGate.scale.setScalar(gateScale);
    southGate.rotation.y = Math.PI;
    southGate.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    group.add(southGate);
  }

  if (eastExit) {
    const eastGate = gateArchModel.clone();
    eastGate.position.set(gateX, 0, 0);
    eastGate.scale.setScalar(gateScale);
    eastGate.rotation.y = -Math.PI / 2;
    eastGate.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    group.add(eastGate);
  }

  if (westExit) {
    const westGate = gateArchModel.clone();
    westGate.position.set(-gateX, 0, 0);
    westGate.scale.setScalar(gateScale);
    westGate.rotation.y = Math.PI / 2;
    westGate.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    group.add(westGate);
  }

  if (id === 'OW1') {
    const shell = buildModularFloor(3, 3, 0x89a0aa);
    group.add(shell);

    ironNailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: 0xd4af37, emissive: 0xd4af37, emissiveIntensity: 0.7 }));

    ironNailMesh.position.set(2, 0.5, -1);

    group.add(ironNailMesh);

    questPickupMeshes.length = 0;

    if (ironNailMesh) questPickupMeshes.push({ id: 'ITEM_IRON_NAIL', mesh: ironNailMesh });

    const brassCogMesh = new THREE.Mesh(

      new THREE.TorusGeometry(0.22, 0.08, 8, 16),

      new THREE.MeshStandardMaterial({ color: 0xb08d57, emissive: 0x6b4f1d, emissiveIntensity: 0.7 }),

    );

    brassCogMesh.position.set(3, 0.5, 2);

    brassCogMesh.rotation.x = Math.PI / 2;

    group.add(brassCogMesh);

    questPickupMeshes.push({ id: 'ITEM_BRASS_COG', mesh: brassCogMesh });

    const memoryShardMesh = new THREE.Mesh(

      new THREE.OctahedronGeometry(0.24),

      new THREE.MeshStandardMaterial({ color: 0xbfdbfe, emissive: 0x3b82f6, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }),

    );

    memoryShardMesh.position.set(6, 0.7, -4);

    group.add(memoryShardMesh);

    questPickupMeshes.push({ id: 'SHARD_01_GATE', mesh: memoryShardMesh });

    // Gatekeeper Orin
    orinMesh = SkeletonUtils.clone(orinModel) as THREE.Group;
    orinMesh.position.set(-2.2, 0.6, -1.8);
    orinMesh.scale.setScalar(1.05);
    orinMesh.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    if (orinAnimations.length > 0) {
      orinMixer = new THREE.AnimationMixer(orinMesh);
      for (const clip of orinAnimations) {
        orinActions[clip.name] = orinMixer.clipAction(clip);
      }
      if (orinActions['Idle']) {
        orinActions['Idle'].play();
      }
    }
    const orinLight = new THREE.PointLight(0x38bdf8, 1.0, 3.5);
    orinLight.position.set(0, 1.2, 0);
    orinMesh.add(orinLight);
    group.add(orinMesh);

    // OW1 Duke Vaelor's Despatch Lore Orb

    group.add(createLoreOrb(loreObjects[1]));

    const boilerOW1 = steampunkBoilerModel.clone();
    boilerOW1.position.set(-6, 0, -4);
    group.add(boilerOW1);

    guard = createGuard('OW1', 1.2, -2.2);

    group.add(guard.mesh);

  } else if (id === 'GH2') {
    const shell = buildModularFloor(3, 3, 0x7f96b5);
    group.add(shell);

    mirrorMesh = mirrorLockModel.clone();
    mirrorMesh.position.set(0, 0.1, -2.5);
    mirrorMesh.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    group.add(mirrorMesh);

    const boilerGH2 = steampunkBoilerModel.clone();
    boilerGH2.position.set(6, 0, -4);
    group.add(boilerGH2);

    // GH2 Garrison Daguerreotype Lore Orb
    group.add(createLoreOrb(loreObjects[2]));

  } else if (id === 'GH3') {
    const shell = buildModularFloor(3, 3, 0x9a86aa);
    group.add(shell);

    const deskGH3 = patrolDeskModel.clone();
    deskGH3.position.set(-4, 0, -2);
    group.add(deskGH3);

    const boilerGH3 = steampunkBoilerModel.clone();
    boilerGH3.position.set(6, 0, -4);
    group.add(boilerGH3);

    captain = createGuard('GH3', 0, -2.2, true);
    group.add(captain.mesh);

    const gh3Lore = loreObjects.find((l) => l.sceneId === 'GH3');
    if (gh3Lore) group.add(createLoreOrb(gh3Lore));

  } else if (id === 'HM1') {
    const shell = buildModularFloor(3, 3, 0x6d28d9);
    group.add(shell);

    const mirrorL = mirrorLockModel.clone();

    mirrorL.position.set(-4.5, 0.1, 0);

    mirrorL.rotation.y = Math.PI / 2;

    group.add(mirrorL);

    const mirrorR = mirrorLockModel.clone();

    mirrorR.position.set(4.5, 0.1, 0);

    mirrorR.rotation.y = -Math.PI / 2;

    group.add(mirrorR);

    trueMirrorMesh = mirrorLockModel.clone();

    trueMirrorMesh.position.set(0, 0.1, -4.8);

    trueMirrorMesh.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });

    group.add(trueMirrorMesh);

    const portalGeom = new THREE.TorusGeometry(1.2, 0.08, 16, 48);

    const portalMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });

    starlightPortalMesh = new THREE.Mesh(portalGeom, portalMat);

    starlightPortalMesh.position.set(0, 1.5, -4.8);

    starlightPortalMesh.visible = solvedPuzzles.has('PUZZLE_TRUE_MIRROR');

    group.add(starlightPortalMesh);

    if (solvedPuzzles.has('PUZZLE_TRUE_MIRROR')) {

      trueMirrorMesh.visible = false;

    }

    wraith = createMirrorWraith('HM1', 0, -2.0);

    group.add(wraith.mesh);

  } else if (id === 'BQ1') {

    // The Cenacle of Eternal Satiety: Blender-sculpted Mahogany Feast, Silver Platter & Themis Scale

    const feastScene = bq1FeastModel.clone();

    feastScene.traverse((node) => {

      if (node instanceof THREE.Mesh) {

        node.castShadow = true;

        node.receiveShadow = true;

      }

    });

    group.add(feastScene);

    // Warm Victorian candlelight along table

    const candleLightN = new THREE.PointLight(0xf59e0b, 1.2, 5.0);

    candleLightN.position.set(0, 1.4, -1.4);

    group.add(candleLightN);

    const candleLightS = new THREE.PointLight(0xf59e0b, 1.2, 5.0);

    candleLightS.position.set(0, 1.4, 1.4);

    group.add(candleLightS);

    // Roast Boar illusion center-piece

    const isFeastDispelled = solvedPuzzles.has('PUZZLE_FEAST_SATIETY');

    const boarNode = feastScene.getObjectByName('RoastBoarBody') as THREE.Mesh | undefined;

    if (boarNode) {

      if (boarNode.material) boarNode.material = (boarNode.material as THREE.Material).clone();

      banquetBoarMesh = boarNode;

      if (boarNode.material && 'color' in boarNode.material) {

        const mat = boarNode.material as THREE.MeshStandardMaterial;

        mat.color.setHex(isFeastDispelled ? 0x374151 : 0xb45309);

        mat.emissive.setHex(isFeastDispelled ? 0x111827 : 0xd97706);

        mat.emissiveIntensity = isFeastDispelled ? 0.2 : 0.8;

      }

    } else {

      banquetBoarMesh = new THREE.Mesh(

        new THREE.CylinderGeometry(0.32, 0.45, 1.2, 8),

        new THREE.MeshStandardMaterial({

          color: isFeastDispelled ? 0x374151 : 0xb45309,

          emissive: isFeastDispelled ? 0x111827 : 0xd97706,

          emissiveIntensity: 0.8,

        })

      );

      banquetBoarMesh.position.set(0, 0.95, 0);

      group.add(banquetBoarMesh);

    }

    // Themis balance scale

    themisScaleMesh = (feastScene.getObjectByName('ThemisScaleBase') as THREE.Group) || new THREE.Group();

    themisScaleMesh.position.set(0, 0.81, -2.5);

    // Lord Morvath NPC

    morvathMesh = makeGuardMesh(0x7e22ce);

    morvathMesh.position.set(1.6, 0.6, -1.8);

    const morvathLight = new THREE.PointLight(0xca8a04, 1.2, 4);

    morvathLight.position.set(0, 1.2, 0);

    morvathMesh.add(morvathLight);

    group.add(morvathMesh);

    group.add(createLoreOrb(loreObjects[3]));

  } else if (id === 'AG1') {

    // The Ancient Bough: Blender-sculpted Gnarled Ancient Heartwood Tree & Thorny Root Wall

    const treeScene = ag1TreeModel.clone();

    treeScene.traverse((node) => {

      if (node instanceof THREE.Mesh) {

        node.castShadow = true;

        node.receiveShadow = true;

      }

    });

    group.add(treeScene);

    // Sacred Starlight Eye pulsating light

    const treeLight = new THREE.PointLight(0x06b6d4, 2.5, 7.5);

    treeLight.position.set(0, 2.4, -1.8);

    group.add(treeLight);

    // Yggdra interaction anchor at ancient trunk center

    yggdraMesh = new THREE.Group();

    yggdraMesh.position.set(0, 0, -2.8);

    const eyeNode = treeScene.getObjectByName('EyeCoreStarlight');

    if (eyeNode) yggdraMesh.add(eyeNode);

    group.add(yggdraMesh);

    // Thorny root wall barrier blocking north exit at z = -5.0

    const rootWallGroup = new THREE.Group();

    for (let bi = 0; bi < 8; bi++) {

      const bar = treeScene.getObjectByName(`RootWallBar_${bi}`);

      if (bar) rootWallGroup.add(bar);

    }

    rootWallMesh = new THREE.Mesh(

      new THREE.BoxGeometry(4.2, 2.4, 0.6),

      new THREE.MeshStandardMaterial({ visible: false })

    );

    rootWallMesh.position.set(0, 1.2, -5.0);

    rootWallMesh.add(rootWallGroup);

    rootWallMesh.visible = !solvedPuzzles.has('PUZZLE_ARBOREAL_WEAVE');

    group.add(rootWallMesh);

    treeGuardian = createGuard('AG1', 0, 0, true);

    treeGuardian.mesh.traverse((node) => {

      if (node instanceof THREE.Mesh && node.material && 'color' in node.material) {

        (node.material as THREE.MeshStandardMaterial).color.setHex(0x15803d);

      }

    });

    group.add(treeGuardian.mesh);

    group.add(createLoreOrb(loreObjects[4]));

  } else if (id === 'MH1') {
    // Mother Hazel's Hearth & Witch Compound (Cottage, hearth, sunken cellar, outdoor herb garden, combat glade)
    const hearthScene = mh1HearthModel.clone();
    hearthScene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    group.add(hearthScene);
    // Firebox warm glowing illumination inside cottage hearth
    const hearthLight = new THREE.PointLight(0xf97316, 3.5, 12);
    hearthLight.position.set(0, 1.2, -20.4);
    group.add(hearthLight);
    // Aetheric green illumination from sunken root cellar / basement
    const cellarLight = new THREE.PointLight(0x22c55e, 2.5, 14);
    cellarLight.position.set(-11.5, 1.2, -16.0);
    group.add(cellarLight);
    // Violet botanical aura over enchanted herb garden
    const gardenLight = new THREE.PointLight(0xa855f7, 2.2, 16);
    gardenLight.position.set(16.0, 1.5, -16.0);
    group.add(gardenLight);
    // Interactive hanging cast-iron kettle
    const kettleNode = hearthScene.getObjectByName('KettlePotBelly') as THREE.Mesh | undefined;
    if (kettleNode) {
      kettleMesh = kettleNode;
      kettleMesh.position.set(0, 0.62, -4.4);
    } else {
      kettleMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.4 })
      );
      kettleMesh.position.set(0, 0.6, -4.4);
      group.add(kettleMesh);
    }
    hazelMesh = SkeletonUtils.clone(hazelModel) as THREE.Group;
    hazelMesh.position.set(1.8, 0.6, -1.8);
    hazelMesh.scale.setScalar(1.0);
    hazelMesh.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
    if (hazelAnimations.length > 0) {
      hazelMixer = new THREE.AnimationMixer(hazelMesh);
      for (const clip of hazelAnimations) {
        hazelActions[clip.name] = hazelMixer.clipAction(clip);
      }
      if (hazelActions['Idle']) {
        hazelActions['Idle'].play();
      }
    }
    const hazelLight = new THREE.PointLight(0xf59e0b, 1.2, 4);
    hazelLight.position.set(0, 1.2, 0);
    hazelMesh.add(hazelLight);
    group.add(hazelMesh);
    group.add(createLoreOrb(loreObjects[5]));

  } else if (id === 'SAN1') {

    // The Sanctum of the Glass Heart: Blender-sculpted Crystalline Throne & Multifaceted Glass Heart

    const sanctumScene = san1SanctumModel.clone();

    sanctumScene.traverse((node) => {

      if (node instanceof THREE.Mesh) {

        node.castShadow = true;

        node.receiveShadow = true;

      }

    });

    group.add(sanctumScene);

    // Multifaceted Glass Heart Dodecahedron & Cynthia Soul Crystal

    cynthiaCrystal = new THREE.Group();

    cynthiaCrystal.position.set(0, 1.8, -1.0);

    const cageNode = sanctumScene.getObjectByName('GlassHeartOuterCage');

    const soulNode = sanctumScene.getObjectByName('CynthiaSoulCrystal');

    const ring1Node = sanctumScene.getObjectByName('StarlightGimbalRing1');

    const ring2Node = sanctumScene.getObjectByName('StarlightGimbalRing2');

    if (cageNode) {

      cageNode.position.set(0, 0, 0);

      cynthiaCrystal.add(cageNode);

    }

    if (soulNode) {

      soulNode.position.set(0, 0, 0);

      cynthiaCrystal.add(soulNode);

    }

    if (ring1Node) {

      ring1Node.position.set(0, 0, 0);

      cynthiaCrystal.add(ring1Node);

    }

    if (ring2Node) {

      ring2Node.position.set(0, 0, 0);

      cynthiaCrystal.add(ring2Node);

    }

    const crystalLight = new THREE.PointLight(0xec4899, 2.5, 9);

    crystalLight.position.set(0, 0, 0);

    cynthiaCrystal.add(crystalLight);

    group.add(cynthiaCrystal);

    // Starlight Victory Portal unsealed upon Vaelor's defeat

    const portalGeom = new THREE.TorusGeometry(1.6, 0.1, 16, 64);

    const portalMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });

    starlightPortalMesh = new THREE.Mesh(portalGeom, portalMat);

    starlightPortalMesh.position.set(0, 1.8, -4.8);

    starlightPortalMesh.visible = solvedPuzzles.has('PUZZLE_HOLLOW_GLASS');

    group.add(starlightPortalMesh);

    vaelorBoss = createBossVaelor('SAN1', 0, -3.2);

    group.add(vaelorBoss.mesh);

    group.add(createLoreOrb(loreObjects[6]));

  } else if (id === 'CO1') {

    const shell = buildModularFloor(3, 4, 0x6b3f2a);

    group.add(shell);

    const captain = createGuard('CO1', 0, 0, true);

    group.add(captain.mesh);

    group.add(createLoreOrb(loreObjects[7] ?? loreObjects[0]));

  } else if (id === 'CO3') {

    const shell = buildModularFloor(3, 4, 0x7c3aed);

    group.add(shell);

    const mirror = crystalTheaterMirrorModel.clone();
    mirror.position.set(0, 0, -3.0);
    group.add(mirror);

    const co3Lore = loreObjects.find((l) => l.sceneId === 'CO3');
    if (co3Lore) group.add(createLoreOrb(co3Lore));

  } else if (id === 'GH1') {

    const shell = buildModularFloor(3, 3, 0x8b5a2b);
    group.add(shell);

    const desk = patrolDeskModel.clone();
    desk.position.set(2, 0, -1);
    group.add(desk);

    const boiler = steampunkBoilerModel.clone();
    boiler.position.set(-6, 0, -4);
    group.add(boiler);

    const gh1Lore = loreObjects.find((l) => l.sceneId === 'GH1');
    if (gh1Lore) group.add(createLoreOrb(gh1Lore));

  } else if (id === 'GH4') {
    const shell = buildModularFloor(3, 3, 0x4a4a4a);
    group.add(shell);

    const vent = ventGrateModel.clone();
    vent.position.set(0, 0, 0);
    group.add(vent);

    const boiler = steampunkBoilerModel.clone();
    boiler.position.set(-6, 0, -4);
    group.add(boiler);

    const gh4Lore = loreObjects.find((l) => l.sceneId === 'GH4') ?? loreObjects.find((l) => l.sceneId === 'GH2');
    if (gh4Lore) group.add(createLoreOrb(gh4Lore));

  } else if (id === 'SQ1') {
    const shell = buildModularFloor(3, 3, 0xc9a227);
    group.add(shell);

    const hearth = servantHearthModel.clone();
    hearth.position.set(-2, 0, 1);
    group.add(hearth);

    const sq1Lore = loreObjects.find((l) => l.sceneId === 'SQ1');
    if (sq1Lore) group.add(createLoreOrb(sq1Lore));

  } else if (id === 'B1') {
    const shell = buildModularFloor(3, 3, 0x7a2e2e);
    group.add(shell);

    const armory = barracksArmoryModel.clone();
    armory.position.set(0, 0, -2);
    group.add(armory);

    const b1Lore = loreObjects.find((l) => l.sceneId === 'B1');
    if (b1Lore) group.add(createLoreOrb(b1Lore));

  } else if (id === 'RC1') {
    const shell = buildModularFloor(3, 3, 0x2e5a7a);
    group.add(shell);

    const escher = escherAnchorModel.clone();
    escher.position.set(0, 0, -1.5);
    group.add(escher);

    const rc1Lore = loreObjects.find((l) => l.sceneId === 'RC1');
    if (rc1Lore) group.add(createLoreOrb(rc1Lore));

  } else if (id === 'CR1') {
    const shell = buildModularFloor(3, 3, 0x2e7a6a);
    group.add(shell);

    const astrolabe = chronomanticAstrolabeModel.clone();
    astrolabe.position.set(0, 0, -1.5);
    group.add(astrolabe);

    const cr1Lore = loreObjects.find((l) => l.sceneId === 'CR1');
    if (cr1Lore) group.add(createLoreOrb(cr1Lore));

  } else if (id === 'MS3') {
    const shell = buildModularFloor(3, 3, 0xc9a227);
    group.add(shell);

    const armonica = glassArmonicaModel.clone();
    armonica.position.set(0, 0, -1.5);
    group.add(armonica);

    const ms3Lore = loreObjects.find((l) => l.sceneId === 'MS3');
    if (ms3Lore) group.add(createLoreOrb(ms3Lore));

  } else if (id === 'BT1') {
    const shell = buildModularFloor(3, 3, 0x4a4a5a);
    group.add(shell);

    const belfry = aeolianBelfryModel.clone();
    belfry.position.set(0, 0, -2.0);
    group.add(belfry);

    const bt1Lore = loreObjects.find((l) => l.sceneId === 'BT1');
    if (bt1Lore) group.add(createLoreOrb(bt1Lore));

  } else if (id === 'U1' || id === 'U2' || id === 'U3' || id === 'U4') {
    const shell = buildModularFloor(3, 3, 0x2b2b3a);
    group.add(shell);
    if (id === 'U3') {
      mirrorMesh = mirrorLockModel.clone();
      mirrorMesh.position.set(0, 0.1, -2.5);
      mirrorMesh.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
      group.add(mirrorMesh);
    } else {
      const sarcophagus = monkSarcophagusModel.clone();
      sarcophagus.position.set(0, 0, -2.5);
      group.add(sarcophagus);
    }
    if (id === 'U2' || id === 'U4') {
      const guard = createGuard(id, 0, -2, false);

      group.add(guard.mesh);

    }

    const uLore = loreObjects.find((l) => l.sceneId === id) ?? (id === 'U4' ? loreObjects[8] : undefined);
    if (uLore) {

      group.add(createLoreOrb(uLore));

    }

  } else if (id === 'TR1' || id === 'TR2' || id === 'TR3' || id === 'TR4') {

    const shell = buildModularFloor(3, 3, 0x5a4a3a);

    group.add(shell);

    const chest = mimicChestModel.clone();
    chest.position.set(0, 0, -2.0);
    group.add(chest);

    const curator = createGuard(id, 0, -2, false);

    group.add(curator.mesh);

    const trLore = loreObjects.find((l) => l.sceneId === id) ?? loreObjects[9];
    if (trLore) group.add(createLoreOrb(trLore));

  } else if (id === 'AT1' || id === 'AT2' || id === 'AT3') {

    const shell = buildModularFloor(3, 3, 0x1e2a4a);

    group.add(shell);

    if (id === 'AT3') {
      const starmap = starmapPedestalModel.clone();
      starmap.position.set(0, 0, -2.0);
      group.add(starmap);
    } else {
      const telescope = celestialTelescopeModel.clone();
      telescope.position.set(0, 0, -2.0);
      group.add(telescope);
    }

    const atLore = loreObjects.find((l) => l.sceneId === id) ?? loreObjects[10];
    if (atLore) group.add(createLoreOrb(atLore));

  } else if (id === 'AL1' || id === 'AL2' || id === 'AL3') {

    const shell = buildModularFloor(3, 3, 0x3a5a2b);

    group.add(shell);

    const bench = alchemistBenchModel.clone();
    bench.position.set(0, 0, -2.0);
    group.add(bench);

    const alLore = loreObjects.find((l) => l.sceneId === id) ?? loreObjects[11];
    if (alLore) group.add(createLoreOrb(alLore));

  } else if (id === 'RG1' || id === 'RG2' || id === 'RG3' || id === 'RG4') {

    const shell = buildModularFloor(3, 3, 0x3a5a2b);

    group.add(shell);

    const anemometer = rooftopAnemometerModel.clone();
    anemometer.position.set(0, 0, -2.0);
    group.add(anemometer);

    const planterL = starlightPlanterModel.clone();
    planterL.position.set(-6, 0, -4);
    group.add(planterL);

    const planterR = starlightPlanterModel.clone();
    planterR.position.set(6, 0, -4);
    group.add(planterR);

    const rgLore = loreObjects.find((l) => l.sceneId === id) ?? loreObjects[13];
    if (rgLore) group.add(createLoreOrb(rgLore));

  } else if (id === 'VR1' || id === 'VR2' || id === 'VR3') {

    const shell = buildModularFloor(3, 3, 0x1e1b4b);

    group.add(shell);

    const rift = voidRiftAnchorModel.clone();
    rift.position.set(0, 0, -2.0);
    group.add(rift);

    const vrLore = loreObjects.find((l) => l.sceneId === id) ?? loreObjects[14];
    if (vrLore) group.add(createLoreOrb(vrLore));

  } else if (id === 'RS1' || id === 'RS2' || id === 'RS3' || id === 'RS4' || id === 'RS5' || id === 'RS6') {

    const shell = buildModularFloor(3, 3, 0x4a3a5a);

    group.add(shell);

    const escher = escherAnchorModel.clone();
    escher.position.set(0, 0, -2.0);
    group.add(escher);

    const rsLore = loreObjects.find((l) => l.sceneId === id) ?? loreObjects[15];
    if (rsLore) group.add(createLoreOrb(rsLore));

  } else if (id === 'PB1' || id === 'PB2' || id === 'PB3' || id === 'PB4') {

    const shell = buildModularFloor(3, 3, 0x3a3a3a);

    group.add(shell);

    const wardenDesk = wardenDeskModel.clone();
    wardenDesk.position.set(-3.5, 0, -2.0);
    group.add(wardenDesk);

    const guard = createGuard(id, 0, -2, false);

    group.add(guard.mesh);

    const pbLore = loreObjects.find((l) => l.sceneId === id) ?? loreObjects[12];
    if (pbLore) group.add(createLoreOrb(pbLore));

  } else {

    const shell = buildModularFloor(3, 3);

    group.add(shell);

    const genericLore = loreObjects.find((l) => l.sceneId === id);
    if (genericLore) group.add(createLoreOrb(genericLore));

  }

  return group;

}

function getRoomHalfExtents(sceneId: SceneId | string): { hw: number; hh: number; isExpanded: boolean } {
  const isCustomCompound = sceneId === 'MH1' || sceneId === 'SAN1' || sceneId === 'BQ1' || sceneId === 'AG1';
  const isExtendedHall = sceneId === 'CO1' || sceneId === 'CO3';
  if (isCustomCompound) {
    const b = sceneById.get(sceneId as SceneId)?.bounds ?? { width: 12, height: 12 };
    return { hw: b.width / 2, hh: b.height / 2, isExpanded: false };
  }
  return { hw: 18.0, hh: isExtendedHall ? 24.0 : 18.0, isExpanded: true };
}

function getEffectiveDoorPos(sceneId: SceneId | string, door: { x: number; z: number }): { x: number; z: number } {
  const { hw, hh, isExpanded } = getRoomHalfExtents(sceneId);
  if (!isExpanded) {
    return { x: door.x, z: door.z };
  }
  let effX = door.x;
  let effZ = door.z;
  if (door.z <= -4.0) effZ = -hh + 1.0;
  else if (door.z >= 4.0) effZ = hh - 1.0;

  if (door.x >= 4.0) effX = hw - 1.0;
  else if (door.x <= -4.0) effX = -hw + 1.0;

  return { x: effX, z: effZ };
}

function getTransitionSpawn(
  fromSceneId: SceneId | string,
  toSceneId: SceneId | string,
  explicitSpawn?: Partial<Spawn>,
): Partial<Spawn> {
  const { hw: toHw, hh: toHh, isExpanded: toExpanded } = getRoomHalfExtents(toSceneId);

  // Transitioning into S00 (courtyard)
  if (toSceneId === 'S00') {
    if (fromSceneId === 'OW1') return { x: 0, y: 0.6, z: -14.8 };
    return explicitSpawn ?? { x: 0, y: 0.6, z: 2.0 };
  }

  // Transitioning into an expanded room
  if (toExpanded) {
    const reverseDoor = (FORTRESS_EXITS[toSceneId] ?? []).find((d) => d.to === fromSceneId);
    if (reverseDoor) {
      if (reverseDoor.z >= 4.0) {
        return { x: reverseDoor.x, y: 0.6, z: toHh - 3.2 };
      }
      if (reverseDoor.z <= -4.0) {
        return { x: reverseDoor.x, y: 0.6, z: -toHh + 3.2 };
      }
      if (reverseDoor.x >= 4.0) {
        return { x: toHw - 3.2, y: 0.6, z: reverseDoor.z };
      }
      if (reverseDoor.x <= -4.0) {
        return { x: -toHw + 3.2, y: 0.6, z: reverseDoor.z };
      }
    }
    return { x: 0, y: 0.6, z: toHh - 3.2 };
  }

  return explicitSpawn ?? {};
}

function addGenericColliders(): void {
  const { hw, hh, isExpanded } = getRoomHalfExtents(currentSceneId);

  // Floor static box
  physics.addStaticBox(hw, 0.2, hh, 0, -0.2, 0);

  if (!isExpanded) {
    physics.addStaticBox(0.25, 3, hh + 0.5, -hw - 0.25, 3, 0);
    physics.addStaticBox(0.25, 3, hh + 0.5, hw + 0.25, 3, 0);
    physics.addStaticBox(hw + 0.5, 3, 0.25, 0, 3, hh + 0.25);
    physics.addStaticBox(hw + 0.5, 3, 0.25, 0, 3, -hh - 0.25);
  } else {
    const roomExits = exits[currentSceneId] ?? [];
    const northExit = roomExits.find((e) => e.z <= -4.0);
    const southExit = roomExits.find((e) => e.z >= 4.0);
    const eastExit = roomExits.find((e) => e.x >= 4.0);
    const westExit = roomExits.find((e) => e.x <= -4.0);

    const northPassable = !!northExit && requirementsMet(northExit.requires);
    const southPassable = !!southExit && requirementsMet(southExit.requires);
    const eastPassable = !!eastExit && requirementsMet(eastExit.requires);
    const westPassable = !!westExit && requirementsMet(westExit.requires);

    const gateOpeningHalf = 2.0;

    // North wall
    if (northExit && northPassable) {
      const segW = (hw - gateOpeningHalf) / 2;
      const segCenter = gateOpeningHalf + segW;
      physics.addStaticBox(segW, 3, 0.25, -segCenter, 3, -hh - 0.25);
      physics.addStaticBox(segW, 3, 0.25, segCenter, 3, -hh - 0.25);
      physics.addStaticBox(gateOpeningHalf + 0.5, 3, 0.25, 0, 3, -hh - 1.25);
      // Enclose sides of the door alcove so player cannot walk off the edge
      physics.addStaticBox(0.25, 3, 0.65, -gateOpeningHalf - 0.15, 3, -hh - 0.75);
      physics.addStaticBox(0.25, 3, 0.65, gateOpeningHalf + 0.15, 3, -hh - 0.75);
    } else {
      physics.addStaticBox(hw + 0.5, 3, 0.25, 0, 3, -hh - 0.25);
      if (northExit) {
        // Barred gate physical barrier right in front of the gate arch
        const eff = getEffectiveDoorPos(currentSceneId, northExit);
        physics.addStaticBox(gateOpeningHalf + 0.5, 3, 0.35, eff.x, 3, eff.z);
      }
    }

    // South wall
    if (southExit && southPassable) {
      const segW = (hw - gateOpeningHalf) / 2;
      const segCenter = gateOpeningHalf + segW;
      physics.addStaticBox(segW, 3, 0.25, -segCenter, 3, hh + 0.25);
      physics.addStaticBox(segW, 3, 0.25, segCenter, 3, hh + 0.25);
      physics.addStaticBox(gateOpeningHalf + 0.5, 3, 0.25, 0, 3, hh + 1.25);
      // Enclose sides of the door alcove so player cannot walk off the edge
      physics.addStaticBox(0.25, 3, 0.65, -gateOpeningHalf - 0.15, 3, hh + 0.75);
      physics.addStaticBox(0.25, 3, 0.65, gateOpeningHalf + 0.15, 3, hh + 0.75);
    } else {
      physics.addStaticBox(hw + 0.5, 3, 0.25, 0, 3, hh + 0.25);
      if (southExit) {
        const eff = getEffectiveDoorPos(currentSceneId, southExit);
        physics.addStaticBox(gateOpeningHalf + 0.5, 3, 0.35, eff.x, 3, eff.z);
      }
    }

    // East wall
    if (eastExit && eastPassable) {
      const segH = (hh - gateOpeningHalf) / 2;
      const segCenter = gateOpeningHalf + segH;
      physics.addStaticBox(0.25, 3, segH, hw + 0.25, 3, -segCenter);
      physics.addStaticBox(0.25, 3, segH, hw + 0.25, 3, segCenter);
      physics.addStaticBox(0.25, 3, gateOpeningHalf + 0.5, hw + 1.25, 3, 0);
      physics.addStaticBox(0.65, 3, 0.25, hw + 0.75, 3, -gateOpeningHalf - 0.15);
      physics.addStaticBox(0.65, 3, 0.25, hw + 0.75, 3, gateOpeningHalf + 0.15);
    } else {
      physics.addStaticBox(0.25, 3, hh + 0.5, hw + 0.25, 3, 0);
      if (eastExit) {
        const eff = getEffectiveDoorPos(currentSceneId, eastExit);
        physics.addStaticBox(0.35, 3, gateOpeningHalf + 0.5, eff.x, 3, eff.z);
      }
    }

    // West wall
    if (westExit && westPassable) {
      const segH = (hh - gateOpeningHalf) / 2;
      const segCenter = gateOpeningHalf + segH;
      physics.addStaticBox(0.25, 3, segH, -hw - 0.25, 3, -segCenter);
      physics.addStaticBox(0.25, 3, segH, -hw - 0.25, 3, segCenter);
      physics.addStaticBox(0.25, 3, gateOpeningHalf + 0.5, -hw - 1.25, 3, 0);
      physics.addStaticBox(0.65, 3, 0.25, -hw - 0.75, 3, -gateOpeningHalf - 0.15);
      physics.addStaticBox(0.65, 3, 0.25, -hw - 0.75, 3, gateOpeningHalf + 0.15);
    } else {
      physics.addStaticBox(0.25, 3, hh + 0.5, -hw - 0.25, 3, 0);
      if (westExit) {
        const eff = getEffectiveDoorPos(currentSceneId, westExit);
        physics.addStaticBox(0.35, 3, gateOpeningHalf + 0.5, eff.x, 3, eff.z);
      }
    }
  }
}

function refreshRoomColliders(): void {
  physics.clearStatic();
  if (currentSceneId === 'S00') {
    addS00Colliders();
  } else {
    addGenericColliders();
  }
}

function requirementsMet(requires: string[]): boolean {

  return requires.every((req) => {

    if (req.startsWith('ITEM_')) return inventory.has(req);

    if (req.startsWith('PUZZLE_')) return solvedPuzzles.has(req);

    if (req.startsWith('ABILITY_')) return abilities.has(req);

    return false;

  });

}

function updateHUD(): void {

  const scene = sceneById.get(currentSceneId)!;

  if (hudZone) hudZone.textContent = scene.name;

  if (hudQuest) {

    if (currentSceneId === 'GH3') hudQuest.textContent = 'Q0 — Defeat the Barbican Captain';

    else if (currentSceneId === 'HM1') hudQuest.textContent = 'Q1 — Banish the Mirror Wraith';

    else if (currentSceneId === 'BQ1') hudQuest.textContent = 'S38 — The Cenacle of Eternal Satiety';

    else if (currentSceneId === 'AG1') hudQuest.textContent = 'Q2 — Commune with the Ancient Bough';

    else if (currentSceneId === 'MH1') hudQuest.textContent = 'Q3 — Mother Hazel\'s Hearth';

    else if (currentSceneId === 'SAN1') hudQuest.textContent = 'Q4 — Shatter the Glass Heart of Vaelor';

    else if (currentSceneId === 'CO1') hudQuest.textContent = 'S7 — Trial of the Veil';

    else if (currentSceneId === 'CO3') hudQuest.textContent = 'S14 - The Crystal Theater';

    else if (currentSceneId === 'CR1') hudQuest.textContent = 'S24 - The Hourglass Turned Backwards';

    else if (currentSceneId === 'MS3') hudQuest.textContent = 'S25 - The Maestros Devilish Caprice';

    else if (currentSceneId === 'GH1') hudQuest.textContent = 'Q1 - Clear the Gatehouse Exterior';

    else if (currentSceneId === 'GH4') hudQuest.textContent = 'Q1 - Ascend the Vent Passage';

    else if (currentSceneId === 'SQ1') hudQuest.textContent = 'Q2 - Uncover the Servant Secret';

    else if (currentSceneId === 'B1') hudQuest.textContent = 'Q3 - Raid the Barracks Armory';

    else if (currentSceneId === 'RC1') hudQuest.textContent = 'S6 - Anchor the Relativity Cloister';

    else if (currentSceneId === 'U1' || currentSceneId === 'U2' || currentSceneId === 'U3' || currentSceneId === 'U4') hudQuest.textContent = 'S3 — Rest for the Weary';

    else if (currentSceneId === 'TR1' || currentSceneId === 'TR2' || currentSceneId === 'TR3' || currentSceneId === 'TR4') hudQuest.textContent = 'S8 — The Hunter\'s Lie';

    else if (currentSceneId === 'AT1' || currentSceneId === 'AT2' || currentSceneId === 'AT3') hudQuest.textContent = 'S9 — The Star That Lies';
    else if (currentSceneId === 'AL1' || currentSceneId === 'AL2' || currentSceneId === 'AL3') hudQuest.textContent = 'S10 — The Unstable Formula';
    else if (currentSceneId === 'RG1' || currentSceneId === 'RG2' || currentSceneId === 'RG3' || currentSceneId === 'RG4') hudQuest.textContent = 'S12 — The Wind\'s Secret';
    else if (currentSceneId === 'VR1' || currentSceneId === 'VR2' || currentSceneId === 'VR3') hudQuest.textContent = 'S13 — The Dreamer\'s Descent';
    else if (currentSceneId === 'RS1' || currentSceneId === 'RS2' || currentSceneId === 'RS3' || currentSceneId === 'RS4' || currentSceneId === 'RS5' || currentSceneId === 'RS6') hudQuest.textContent = 'S6 — The Stair That Remembers';
    else if (currentSceneId === 'PB1' || currentSceneId === 'PB2' || currentSceneId === 'PB3' || currentSceneId === 'PB4') hudQuest.textContent = 'S11 — Free the Forgotten';
    else hudQuest.textContent = 'Q0 — Infiltrate Fortress Barbican';
  }
  if (hpFill) hpFill.style.width = `${Math.max(0, playerHP)}%`;

  if (lowHpOverlay) lowHpOverlay.style.opacity = playerHP < 30 ? '1' : '0';

  if (hudMapSubtitle) hudMapSubtitle.textContent = `${discoveredScenes.size} / ${CAMPAIGN_ORDER.length} Explored`;

  if (mapDiscoveryBadge) mapDiscoveryBadge.textContent = `${discoveredScenes.size} / ${CAMPAIGN_ORDER.length} Explored`;

}

function drawMinimap(): void {

  if (!minimapCtx || !minimapCanvas) return;

  const ctx = minimapCtx;

  const size = minimapCanvas.width;

  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(9, 13, 22, 0.9)';

  ctx.fillRect(0, 0, size, size);

  // Room bounds (assume 14x14 world units centered at origin)

  const half = 7;

  const scale = size / (half * 2);

  const cx = size / 2;

  const cz = size / 2;

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';

  ctx.lineWidth = 1;

  ctx.strokeRect(cx - half * scale, cz - half * scale, half * 2 * scale, half * 2 * scale);

  // Exits

  const sceneExits = exits[currentSceneId] || [];

  for (const ex of sceneExits) {

    const exX = cx + ex.x * scale;

    const exZ = cz + ex.z * scale;

    ctx.fillStyle = requirementsMet(ex.requires) ? '#10b981' : '#f59e0b';

    ctx.beginPath();

    ctx.arc(exX, exZ, 3, 0, Math.PI * 2);

    ctx.fill();

  }

  // Enemy dots

  const enemyList = [guard, captain, wraith, treeGuardian, vaelorBoss].filter((g): g is Guard => !!g && g.state !== 'dead' && g.sceneId === currentSceneId);

  for (const g of enemyList) {

    const gx = cx + g.mesh.position.x * scale;

    const gz = cz + g.mesh.position.z * scale;

    ctx.fillStyle = '#ef4444';

    ctx.beginPath();

    ctx.arc(gx, gz, 3, 0, Math.PI * 2);

    ctx.fill();

  }

  // Player dot

  const px = cx + playerState.x * scale;

  const pz = cz + playerState.z * scale;

  ctx.fillStyle = '#38bdf8';

  ctx.beginPath();

  ctx.arc(px, pz, 4, 0, Math.PI * 2);

  ctx.fill();

  ctx.strokeStyle = '#fff';

  ctx.lineWidth = 1;

  ctx.stroke();

}

function showAutoSaveIndicator(): void {

  const el = document.getElementById('hud-autosave');

  if (!el) return;

  el.style.opacity = '1';

  window.setTimeout(() => { el.style.opacity = '0'; }, 1200);

}

function saveCheckpoint(): void {

  const data = {

    scene: currentSceneId,

    pos: [playerState.x, 0.6, playerState.z],

    inventory: [...inventory],

    puzzles: [...solvedPuzzles],

    abilities: [...abilities],

    discovered: [...discoveredScenes],

    convictions: { ...convictions },

    convictionAwards: [...convictionAwards],

    origin: playerOrigin.id,

    originTraits: [...playerOrigin.traits],

    stats: { ...stats },

    flags: { ...playerOrigin.flags },

    quests: questLog.completed,

    questRuntime: questRuntime.serialize(),

  };

  localStorage.setItem('veilkeep.save.v1', JSON.stringify(data));

  updateHUD();

  showAutoSaveIndicator();

}

/**

 * Teleport into a scene. Returns false for unknown ids so QA harnesses get a

 * clean failure instead of a half-loaded room. `spawn` may be partial: any

 * missing axis falls back to the manifest spawn.

 */

function loadScene(id: SceneId, spawn?: Partial<Spawn>): boolean {

  if (!sceneById.has(id)) {

    console.warn(`[veilkeep] loadScene: unknown scene "${id}"`);

    return false;

  }

  const target: Spawn = { ...sceneSpawn(id), ...(spawn ?? {}) };

  engine.scene.remove(activeGroup);

  physics.clearStatic();

  currentSceneId = id;

  activeGroup = sceneGroups.get(id) ?? buildGenericScene(id);

  sceneGroups.set(id, activeGroup);

  engine.scene.add(activeGroup);

  if (id === 'S00') addS00Colliders(); else addGenericColliders();

  discoveredScenes.add(id);

  selectedMapSceneId = id;

  physics.teleportPlayer(target);

  playerState.x = target.x;

  playerState.z = target.z;

  playerMesh.position.set(target.x, target.y, target.z);

  engine.cameraRig.setTarget(target.x, 0, target.z);

  updateHUD();

  audioManager.playZoneMusic(currentSceneId);

  if (isMapOpen) renderMap();

  saveCheckpoint();

  if (autoEnabled) autoOnSceneEnter(id);

  return true;

}

function respawn(): void {

  playerHP = 100;

  loadScene(currentSceneId, sceneSpawn(currentSceneId));

}

function updateGuard(g: Guard, dt: number): void {
  if (g.mixer) {
    g.mixer.update(dt);
  }

  if (g.state === 'dead' || g.sceneId !== currentSceneId) {
    if (g.hpBarEl) g.hpBarEl.classList.remove('visible');
    if (g.alertEl) g.alertEl.style.opacity = '0';
    return;
  }
  // Stun / Guard Break state: stooped in place, cannot chase or attack
  if (g.isStunned) {
    playGuardAnim(g, 'Hit');
    g.stunTimer = (g.stunTimer || 0) - dt;
    g.mesh.rotation.x = 0.35;
    if (g.alertEl) { g.alertEl.textContent = '💫'; g.alertEl.style.color = '#fbbf24'; g.alertEl.style.opacity = '1'; }
    if (g.hpBarEl) g.hpBarEl.classList.add('visible');
    if (g.stunTimer <= 0) {
      g.isStunned = false;
      g.poise = g.maxPoise || 45;
      g.mesh.rotation.x = 0;
      if (g.alertEl) { g.alertEl.textContent = '!'; g.alertEl.style.color = '#f59e0b'; }
      playGuardAnim(g, 'Idle');
    }
    return;
  }
  // Posture / Poise recovery
  if (g.poiseRegenTimer && g.poiseRegenTimer > 0) {
    g.poiseRegenTimer -= dt;
  } else if ((g.poise || 0) < (g.maxPoise || 45)) {
    g.poise = Math.min(g.maxPoise || 45, (g.poise || 0) + 20 * dt);
  }
  if (g.poiseFillEl) {
    g.poiseFillEl.style.width = Math.max(0, ((g.poise || 0) / (g.maxPoise || 45)) * 100) + '%';
  }

  // Update floating HP bar position over guard head

  if (g.hpBarEl && g.hpFillEl) {

    if (g.hpBarTimer && g.hpBarTimer > 0) {

      g.hpBarTimer -= dt;

      g.hpBarEl.classList.add('visible');

      const tempPos = new THREE.Vector3(g.mesh.position.x, g.mesh.position.y + 1.7, g.mesh.position.z);

      tempPos.project(engine.cameraRig.camera);

      const sx = (tempPos.x * 0.5 + 0.5) * window.innerWidth;

      const sy = (-(tempPos.y * 0.5) + 0.5) * window.innerHeight;

      g.hpBarEl.style.left = `${Math.round(sx)}px`;

      g.hpBarEl.style.top = `${Math.round(sy)}px`;

      g.hpFillEl.style.width = `${Math.max(0, (g.hp / g.maxHp) * 100)}%`;

    } else {

      g.hpBarEl.classList.remove('visible');

    }

  }

  if (g.cooldown > 0) g.cooldown -= dt;

  // Alert indicator above guard when chasing

  if (g.alertEl) {

    if (g.state === 'chase') {

      g.alertEl.style.opacity = '1';

      const tempPos = new THREE.Vector3(g.mesh.position.x, g.mesh.position.y + 2.0, g.mesh.position.z);

      tempPos.project(engine.cameraRig.camera);

      const sx = (tempPos.x * 0.5 + 0.5) * window.innerWidth;

      const sy = (-(tempPos.y * 0.5) + 0.5) * window.innerHeight;

      g.alertEl.style.left = (sx - 6) + 'px';

      g.alertEl.style.top = (sy - 12) + 'px';

    } else {

      g.alertEl.style.opacity = '0';

    }

  }

  // Target Decoy if active, otherwise player

  const targetX = activeDecoy ? activeDecoy.mesh.position.x : playerState.x;

  const targetZ = activeDecoy ? activeDecoy.mesh.position.z : playerState.z;

  const tdx = targetX - g.mesh.position.x;

  const tdz = targetZ - g.mesh.position.z;

  const targetDist = Math.hypot(tdx, tdz);

  const alertRange = activeDecoy ? 8.0 : (playerState.isSneaking ? 2.2 : 4.8);

  // Gradual detection meter

  const detectRate = (activeDecoy ? 2.0 : (playerState.isSneaking ? 0.4 : 1.0)) / Math.max(0.5, targetDist);

  if (targetDist < alertRange) {

    g.detection = Math.min(1.0, (g.detection || 0) + detectRate * 0.016);

  } else {

    g.detection = Math.max(0, (g.detection || 0) - 0.008);

  }

  if ((g.detection || 0) >= 1.0) g.state = 'chase'; else if ((g.detection || 0) <= 0.1) g.state = 'patrol';

  if (g.isWraith) {

    g.mesh.position.y = 1.1 + Math.sin(Date.now() * 0.0035) * 0.18;

    if (g.state === 'chase' && targetDist < 9.0 && g.cooldown <= 0) {
      if (g.actions?.['Attack']) g.actions['Attack'].reset().play();
      shootMirrorBolt(new THREE.Vector3(g.mesh.position.x, 1.0, g.mesh.position.z), new THREE.Vector3(targetX, 0.8, targetZ));
      g.cooldown = 3.2;
    }

  }

  if (g.state === 'chase') {

    if (targetDist > 0.85) {
      playGuardAnim(g, g.actions?.['Walk'] ? 'Walk' : 'Idle');
      g.windupTimer = 0;
      if (g.alertEl && g.alertEl.textContent === '⚔️') {
        g.alertEl.textContent = '!';
        g.alertEl.style.color = '#f59e0b';
      }
      g.mesh.position.x += (tdx / targetDist) * g.speed * dt;
      g.mesh.position.z += (tdz / targetDist) * g.speed * dt;
    } else if (g.cooldown <= 0 && !activeDecoy) {
      if (!g.windupTimer || g.windupTimer <= 0) {
        playGuardAnim(g, g === vaelorBoss ? (g.actions?.['Cast'] ? 'Cast' : 'Attack') : 'Attack');
        g.windupTimer = g.captain ? 0.6 : 0.45;
        flashMesh(g.mesh, 0xf97316, 250);
        if (g.alertEl) {
          g.alertEl.textContent = '⚔️';
          g.alertEl.style.color = '#ef4444';
        }
        SoundFX.playMenuClick();
      } else {
        g.windupTimer -= dt;
        g.mesh.rotation.y = Math.atan2(tdx, tdz);
        if (g.windupTimer <= 0) {
          if (g.alertEl) {
            g.alertEl.textContent = '!';
            g.alertEl.style.color = '#f59e0b';
          }
          const rawDmg = g.captain ? 18 : 10;
          const outcome = mainChar ? mainChar.combat.receiveHit({ damage: rawDmg, kind: 'melee' }) : (parryTimer > 0 ? 'parried' : 'hit');
          if (outcome === 'evaded') {
            spawnDamagePopup(playerMesh.position, 'EVADED!', true);
            g.cooldown = 0.8;
          } else if (outcome === 'parried' || parryTimer > 0) {
            SoundFX.playParry();
            const perfectParry = parryTimer > 0.25 || outcome === 'parried';
            g.cooldown = perfectParry ? 3.6 : 2.8;
            cameraShake = perfectParry ? 0.4 : 0.28;
            g.poise = Math.max(0, (g.poise || 45) - (perfectParry ? 50 : 35));
            if (g.poise <= 0) {
              g.isStunned = true;
              g.stunTimer = 2.5;
              g.windupTimer = 0;
              SoundFX.playGlassShatter();
              cameraShake = 0.3;
              spawnDamagePopup(g.mesh.position, 'GUARD BROKEN!', true);
              flashMesh(g.mesh, 0xfacc15, 500);
              showToast('Enemy Guard Broken! Strike now for lethal execution!');
              mainChar?.combatParticles?.spawnParryBurst(g.mesh.position, true);
            } else if (perfectParry) {
              g.hp -= 15;
              spawnDamagePopup(g.mesh.position, '-15 HP (Perfect Parry!)', true);
              flashMesh(g.mesh, 0xfbbf24, 400);
              showToast('PERFECT PARRY! Enemy Staggered & Damaged');
            } else {
              spawnDamagePopup(playerMesh.position, 'PARRIED!', true);
              flashMesh(g.mesh, 0xf59e0b, 300);
              showToast('Harmonic Parry! Enemy Staggered');
            }
            const kx = (tdx / targetDist) * (perfectParry ? 1.6 : 1.2);
            const kz = (tdz / targetDist) * (perfectParry ? 1.6 : 1.2);
            g.mesh.position.x -= kx;
            g.mesh.position.z -= kz;
            parryTimer = 0;
            parryBadge?.classList.remove('active');
          } else if (outcome === 'blocked') {
            const blockedDmg = Math.round(rawDmg * 0.25);
            playerHP -= blockedDmg;
            SoundFX.playShieldBlock();
            cameraShake = 0.12;
            spawnDamagePopup(playerMesh.position, '-' + blockedDmg + ' HP (BLOCKED)');
            flashMesh(playerMesh, 0x38bdf8, 160);
            g.cooldown = 1.4;
            updateHUD();
            if (playerHP <= 0) respawn();
          } else {
            playerHP -= rawDmg;
            comboCount = 0;
            comboTimer = 0;
            g.cooldown = 1.1;
            SoundFX.playPlayerHurt();
            cameraShake = 0.22;
            spawnDamagePopup(playerMesh.position, '-' + rawDmg + ' HP');
            flashMesh(playerMesh, 0xef4444, 160);
            updateHUD();
            if (playerHP <= 0) respawn();
          }
        }
      }
    }
  } else {
    const target = g.patrol[g.patrolIndex];
    const pdx = target.x - g.mesh.position.x;
    const pdz = target.z - g.mesh.position.z;
    const pd = Math.hypot(pdx, pdz);
    if (pd < 0.15) {
      g.patrolIndex = (g.patrolIndex + 1) % g.patrol.length;
      playGuardAnim(g, 'Idle');
    } else {
      playGuardAnim(g, g.actions?.['Walk'] ? 'Walk' : 'Idle');
      g.mesh.position.x += (pdx / pd) * g.speed * 0.55 * dt;
      g.mesh.position.z += (pdz / pd) * g.speed * 0.55 * dt;
    }
  }

}

function tryAttack(): void {
  // Swing animation is driven by the combat controller; damage resolves when its hitbox window opens.
  mainChar.combat.setAimYaw(playerMesh.rotation.y);
  mainChar.combat.pressAttack();
}
let pendingMeleeMult = 1;
function resolveMeleeHits(): void {

  SoundFX.playSlash();

  attackLungeOffset = 0.28;

  const targets = activeGuards.filter((g) => g.state !== 'dead' && g.sceneId === currentSceneId);

  for (const g of targets) {

    const dist = Math.hypot(g.mesh.position.x - playerState.x, g.mesh.position.z - playerState.z);

    if (dist < 1.45) {

      // Check for Stealth Backstab

      const dx = playerState.x - g.mesh.position.x;

      const dz = playerState.z - g.mesh.position.z;

      const guardFacingZ = g.patrol.length > 1 ? (g.patrol[g.patrolIndex].z - g.mesh.position.z) : 1;

      const isBehind = (dz * guardFacingZ) < 0 && Math.abs(dx) < 1.2;

      if (playerState.isSneaking && isBehind) {

        g.hp -= 80;

        SoundFX.playCriticalHit();

        cameraShake = 0.35;

        flashMesh(g.mesh, 0xf59e0b, 200);

        spawnDamagePopup(g.mesh.position, 'CRITICAL! -80 HP', true);

        showToast('Master Thief: Lethal Backstab Executed!');
        mainChar?.combatParticles?.spawnHitSparks(g.mesh.position, { x: Math.sin(playerMesh.rotation.y), y: 0, z: Math.cos(playerMesh.rotation.y) }, true, 0xf59e0b);

      } else {

        comboCount++;

        comboTimer = 2.0;

        const comboMult = Math.min(2.0, 1.0 + (comboCount - 1) * 0.1);

        const critChance = 0.1 + stats.LCK * 0.01;

        const isCrit = Math.random() < critChance;

        let finalDmg = Math.round(25 * pendingMeleeMult * comboMult * (isCrit ? 2 : 1));
        const weaponColor = mainChar?.equippedWeapon?.def.trailColor ?? 0x38bdf8;
        const attackDir = { x: Math.sin(playerMesh.rotation.y), y: 0, z: Math.cos(playerMesh.rotation.y) };
        const cState = mainChar?.combat.state ?? 'Light_Attack_1';
        const isFinisher = cState === 'Heavy_Combo_Finisher' || isCrit;

        if (g.isStunned) {
          finalDmg = Math.round(finalDmg * 2.2);
          g.hp -= finalDmg;
          SoundFX.playCriticalHit();
          cameraShake = 0.35;
          spawnDamagePopup(g.mesh.position, 'EXECUTION! -' + finalDmg + ' HP', true);
          flashMesh(g.mesh, 0xfbbf24, 300);
          mainChar?.combatParticles?.spawnHitSparks(g.mesh.position, attackDir, true, 0xfbbf24);
          g.isStunned = false;
          g.poise = g.maxPoise || 45;
          g.mesh.rotation.x = 0;
          if (g.alertEl) { g.alertEl.textContent = '!'; g.alertEl.style.color = '#f59e0b'; }
        } else {
          g.hp -= finalDmg;
          const tier: 1 | 2 | 3 = cState === 'Heavy_Combo_Finisher' ? 3 : (cState === 'Light_Attack_2' ? 2 : 1);
          const poiseDmg = (tier === 3 ? 40 : (tier === 2 ? 22 : 15)) * (isCrit ? 1.5 : 1);
          g.poise = Math.max(0, (g.poise || (g.maxPoise || 45)) - poiseDmg);
          g.poiseRegenTimer = 2.5;

          if (isCrit) {
            SoundFX.playCriticalHit();
            spawnDamagePopup(g.mesh.position, '-' + finalDmg + ' HP (CRIT!)', true);
            flashMesh(g.mesh, 0xfbbf24, 300);
            cameraShake = 0.2;
          } else {
            spawnDamagePopup(g.mesh.position, '-' + finalDmg + ' HP');
            flashMesh(g.mesh, 0xef4444, 140);
            cameraShake = 0.12;
            SoundFX.playHit();
          }

          mainChar?.combatParticles?.spawnHitSparks(g.mesh.position, attackDir, isFinisher, weaponColor);

          if (g.poise <= 0) {
            g.isStunned = true;
            g.stunTimer = 2.5;
            g.windupTimer = 0;
            SoundFX.playGlassShatter();
            cameraShake = 0.28;
            spawnDamagePopup(g.mesh.position, 'GUARD BROKEN!', true);
            flashMesh(g.mesh, 0xfacc15, 500);
            showToast('Enemy Guard Broken! Strike now for lethal execution!');
            mainChar?.combatParticles?.spawnParryBurst(g.mesh.position, true);
          } else if ((g.windupTimer || 0) > 0) {
            g.windupTimer = 0;
            spawnDamagePopup(g.mesh.position, 'COUNTER HIT!', true);
            g.cooldown = 1.0;
          }
        }
      }

      // Stagger knockback away from player

      const kx = Math.sin(playerMesh.rotation.y) * 0.38;

      const kz = Math.cos(playerMesh.rotation.y) * 0.38;

      g.mesh.position.x += kx;

      g.mesh.position.z += kz;

      g.hpBarTimer = 3.5;
      if (g.hp > 0) playGuardAnim(g, 'Hit');

      // Boss Vaelor Phase 2 Shift at 50% HP
      if (g === vaelorBoss && g.hp <= 60 && !vaelorPhase2Triggered && g.hp > 0) {
        vaelorPhase2Triggered = true;
        if (vaelorBoss.actions?.['Phase2_Invert']) {
          vaelorBoss.actions['Phase2_Invert'].reset().play();
        }
        SoundFX.playBossPhaseShift();
        cameraShake = 0.45;
        showToast('Archillusionist Vaelor: Phase 2 Inversion — The Mirror Shatters!');
        g.speed = 3.2;
        g.mesh.position.set(0, 1.2, -3.2);
        flashMesh(g.mesh, 0xf59e0b, 500);
      }

      // Mirror Wraith / Boss Dimensional Teleport on Hit
      if (g.isWraith && g.hp > 0) {
        const spots = [
          new THREE.Vector3(-3.5, 1.1, -1.0),
          new THREE.Vector3(3.5, 1.1, -1.0),
          new THREE.Vector3(-2.5, 1.1, 2.5),
          new THREE.Vector3(2.5, 1.1, 2.5),
        ];
        const spot = spots[Math.floor(Math.random() * spots.length)];
        g.mesh.position.x = spot.x;
        g.mesh.position.z = spot.z;
        SoundFX.playWraithTeleport();
        flashMesh(g.mesh, 0xc084fc, 250);
        spawnDamagePopup(g.mesh.position, 'TELEPORT!', true);
      }

      if (g.hp <= 0) {
        g.state = 'dead';
        playGuardAnim(g, 'Death');
        g.mesh.parent?.remove(g.mesh);

        if (g === vaelorBoss) {

          solvedPuzzles.add('PUZZLE_HOLLOW_GLASS');

          abilities.add('ABILITY_GRAVITON_INVERSION');

          SoundFX.playPuzzleSolved();

          cameraShake = 0.5;

          showToast('VICTORY: Archillusionist Vaelor Defeated! Cynthia Liberated!');

          if (starlightPortalMesh) starlightPortalMesh.visible = true;

          saveCheckpoint();

          openDialogue('cynthia', 'CYNTHIA_01');

        } else if (g === treeGuardian) {

          solvedPuzzles.add('PUZZLE_ARBOREAL_WEAVE');

          abilities.add('ABILITY_STARLIGHT_DASH');

          if (rootWallMesh) rootWallMesh.visible = false;

          SoundFX.playTreeGroan();

          SoundFX.playPuzzleSolved();

          showToast('Tree Guardian Uprooted: Starlight Dash Claimed!');

          saveCheckpoint();

        } else if (g.isWraith) {

          showToast('Mirror Wraith Banished: Halls of Mirrors Cleansed!');

          SoundFX.playPuzzleSolved();

        } else if (g.captain) {

          questRuntime.resolve('ENC_GH3_CAPTAIN', 'lethal');

          abilities.add('ABILITY_WALL_LEAP');

          inventory.add('ITEM_GATEHOUSE_KEY');

          questRuntime.completeQuest('Q_GATEKEEPER_DOUBT');

          SoundFX.playPuzzleSolved();

          cameraShake = 0.35;

          showToast('Victory: Captain Defeated — Wall Leap and Gatehouse Key claimed!');

          saveCheckpoint();

        } else {

          questRuntime.recordKill(true);

          showToast('Guard Neutralized');

        }

      }

      return;

    }

  }

}

let puzzlePanel: HTMLDivElement | null = null;

function closePuzzlePanel(): void {

  if (puzzlePanel) {

    puzzlePanel.remove();

    puzzlePanel = null;

  }

}

function humanizeId(id: string): string {

  return id.replace(/^PUZ_/, '').replace(/^ITEM_/, '').replace(/_/g, ' ');

}

/**

 * Multi-solution puzzle panel. Every documented method is listed with its

 * prerequisites; locked methods stay clickable so the player gets an explicit

 * "requires X" message instead of a dead end.

 */

function openPuzzlePanel(puzzleId: string): void {

  const puzzle = questRuntime.puzzle(puzzleId);

  if (!puzzle) return;

  closePuzzlePanel();

  const panel = document.createElement('div');

  panel.id = 'puzzle-solution-panel';

  panel.style.cssText =

    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(3,7,18,0.72);z-index:60;';

  const card = document.createElement('div');

  card.style.cssText =

    'width:min(560px,92vw);background:#0b1220;border:1px solid #334155;border-radius:12px;padding:20px 22px;color:#e2e8f0;box-shadow:0 24px 60px rgba(0,0,0,0.6);';

  card.innerHTML =

    `<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#7dd3fc">${puzzle.sceneId} &middot; Multi-Solution Puzzle</div>` +

    `<h2 style="margin:6px 0 4px;font-size:20px">${humanizeId(puzzle.id)}</h2>` +

    `<p style="margin:0 0 14px;color:#94a3b8;font-size:13px">Choose any documented path. A locked path never consumes the attempt.</p>`;

  if (puzzleId === 'PUZ_GH2_MIRROR_LOCK') {

    const dial = document.createElement('div');

    dial.id = 'mirror-dial';

    dial.style.cssText = 'display:flex;gap:8px;margin:0 0 12px;';

    for (const angle of [45, 90, 135]) {

      const button = document.createElement('button');

      button.type = 'button';

      button.dataset.angle = String(angle);

      button.className = 'mirror-rotate-btn';

      button.textContent = `Rotate ${angle}\u00b0`;

      button.style.cssText =

        'flex:1;padding:9px 10px;border-radius:8px;border:1px solid #7c3aed;background:#2e1065;color:#ede9fe;cursor:pointer;font-size:13px;';

      button.addEventListener('click', () => {

        const rotation = questRuntime.rotateMirror(angle);

        if (!rotation.accepted) {

          showToast('The mirror rig only accepts 45, 90 or 135 degree turns.');

          return;

        }

        showToast(`Mirror rig at ${rotation.angle}\u00b0${rotation.solved ? ' \u2014 beam aligned!' : '.'}`);

        if (rotation.solved) {

          SoundFX.playPuzzleSolved();

          cameraShake = 0.25;

          closePuzzlePanel();

          saveCheckpoint();

        }

      });

      dial.appendChild(button);

    }

    card.appendChild(dial);

  }

  const list = document.createElement('div');

  list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

  for (const solution of puzzle.solutions) {

    const button = document.createElement('button');

    button.type = 'button';

    button.dataset.method = solution.method;

    button.className = 'puzzle-solution-btn';

    const prerequisite = solution.requires.length

      ? ` \u2014 requires ${solution.requires.join(', ')}`

      : ' \u2014 no prerequisite';

    button.textContent = `${humanizeId(solution.method)}${prerequisite}`;

    button.style.cssText =

      `text-align:left;padding:10px 12px;border-radius:8px;border:1px solid ${solution.available ? '#0ea5e9' : '#475569'};` +

      `background:${solution.available ? '#0c4a6e' : '#111827'};color:${solution.available ? '#e0f2fe' : '#94a3b8'};` +

      'cursor:pointer;font-size:13px;';

    button.addEventListener('click', () => {

      const result = questRuntime.attempt(puzzleId, solution.method);

      if (result.ok) {

        SoundFX.playPuzzleSolved();

        cameraShake = 0.25;

        showToast(`Puzzle Solved: ${humanizeId(puzzleId)} (${humanizeId(solution.method)})`);

        closePuzzlePanel();

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast(`Locked: requires ${result.missing.join(', ') || result.outcome}`);

      }

    });

    list.appendChild(button);

  }

  const leave = document.createElement('button');

  leave.type = 'button';

  leave.id = 'puzzle-panel-close';

  leave.textContent = 'Leave it for now';

  leave.style.cssText =

    'margin-top:14px;padding:8px 14px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#cbd5e1;cursor:pointer;font-size:13px;';

  leave.addEventListener('click', closePuzzlePanel);

  card.appendChild(list);

  card.appendChild(leave);

  panel.appendChild(card);

  panel.addEventListener('click', (event) => {

    if (event.target === panel) closePuzzlePanel();

  });

  document.body.appendChild(panel);

  puzzlePanel = panel;

}

/**

 * Per-frame proximity prompt for manifest puzzles, pickups and the GH3

 * counterweight-cage sabotage. Returns true when it claimed the prompt.

 */

function updateQuestRuntimePrompt(): boolean {

  if (activeDialogue) return false;

  const puzzle = questRuntime.puzzleAt(currentSceneId, playerState.x, playerState.z, 2.2);

  if (puzzle && !puzzle.solved) {

    const available = puzzle.solutions.filter((solution) => solution.available).length;

    showInteractPrompt(`${humanizeId(puzzle.id)} (${available}/${puzzle.solutions.length} methods)`);

    return true;

  }

  const sabotage = questRuntime.encounterAt(currentSceneId, playerState.x, playerState.z, 2.0);

  if (sabotage && sabotage.id === 'ENC_GH3_CAPTAIN' && !questRuntime.encounterResult(sabotage.id)) {

    showInteractPrompt('Sabotage the counterweight cage (non-lethal)');

    return true;

  }

  const pickup = questRuntime.pickupAt(currentSceneId, playerState.x, playerState.z, 1.9);

  if (pickup && !questRuntime.pickupCollected(pickup.id)) {

    const missing = questRuntime.missingRequirements(pickup.requires);

    showInteractPrompt(

      missing.length ? `Pickup locked (${missing.join(', ')})` : `Pick up ${humanizeId(pickup.id)}`,

    );

    return true;

  }

  return false;

}

/** Interact hook for the quest runtime. Returns true when it handled the press. */

function interactQuestRuntime(): boolean {

  if (activeDialogue) return false;

  const sabotage = questRuntime.encounterAt(currentSceneId, playerState.x, playerState.z, 2.0);

  if (sabotage && sabotage.id === 'ENC_GH3_CAPTAIN' && !questRuntime.encounterResult(sabotage.id)) {

    const sabotageMethod = sabotage.nonLethal.find(

      (entry) => questRuntime.missingRequirements(entry.requires).length === 0,

    )?.method;

    const resolution = questRuntime.resolve(sabotage.id, 'non-lethal', sabotageMethod);

    if (resolution.ok) {

      if (captain && captain.state !== 'dead') {

        captain.hp = 0;

        captain.state = 'dead';

        captain.mesh.parent?.remove(captain.mesh);

      }

      questRuntime.completeQuest('Q_GATEKEEPER_DOUBT');

      SoundFX.playPuzzleSolved();

      cameraShake = 0.35;

      showToast('Shadowhand: the counterweight cage drops — Wall Leap and Gatehouse Key claimed.');

      saveCheckpoint();

    } else {

      SoundFX.playLocked();

      showToast(`Sabotage unavailable: ${resolution.missing.join(', ') || resolution.outcome}`);

    }

    return true;

  }

  const puzzle = questRuntime.puzzleAt(currentSceneId, playerState.x, playerState.z, 2.2);

  if (puzzle && !puzzle.solved) {
    if (autoEnabled || autoplayController.running) {
      const solution = puzzle.solutions.find((s) => s.available);
      if (solution) {
        const result = questRuntime.attempt(puzzle.id, solution.method);
        if (result.ok) {
          if (result.runtimePuzzleId) solvedPuzzles.add(result.runtimePuzzleId);
          solvedPuzzles.add(puzzle.id);
          SoundFX.playPuzzleSolved();
          cameraShake = 0.25;
          showToast(`Puzzle Solved: ${humanizeId(puzzle.id)}`);
          closePuzzlePanel();
          saveCheckpoint();
          return true;
        }
      }
    }
    openPuzzlePanel(puzzle.id);
    return true;
  }

  const pickup = questRuntime.pickupAt(currentSceneId, playerState.x, playerState.z, 1.9);

  if (pickup && !questRuntime.pickupCollected(pickup.id)) {

    const collected = questRuntime.collectPickup(pickup.id);

    if (collected.ok) {

      SoundFX.playPickup();

      showToast(

        pickup.id === 'SHARD_01_GATE'

          ? 'Memory Shard I: The Shard of the Gate'

          : `Acquired: ${humanizeId(pickup.id)}`,

      );

      saveCheckpoint();

    } else {

      SoundFX.playLocked();

      showToast(`Locked: requires ${collected.missing.join(', ')}`);

    }

    return true;

  }

  return false;

}

function interact(skipLore = false): void {

  if (interactQuestRuntime()) return;

  // Inspectable Lore Objects (the auto-battler skips these so a nearby orb

  // cannot swallow a puzzle interaction).

  for (const lore of skipLore ? [] : loreObjects) {

    if (lore.sceneId === currentSceneId) {

      const d = Math.hypot(lore.pos.x - playerState.x, lore.pos.z - playerState.z);

      if (d < 2.0) {

        if (isLoreOpen) closeLore();

        else openLore(lore);

        return;

      }

    }

  }

  // S00 Starlight Raven
  if (currentSceneId === 'S00' && ravenMesh) {
    const d = Math.hypot(ravenMesh.position.x - playerState.x, ravenMesh.position.z - playerState.z);
    if (d < 2.5) {
      if (activeDialogue) {
        closeDialogue();
      } else {
        if (ravenActions['Flap_Caw']) ravenActions['Flap_Caw'].reset().play();
        openDialogue('sable', 'SABLE_01');
      }
      return;
    }
  }

  // OW1 Gatekeeper Orin
  if (currentSceneId === 'OW1' && orinMesh) {
    const d = Math.hypot(orinMesh.position.x - playerState.x, orinMesh.position.z - playerState.z);
    if (d < 2.5) {
      if (activeDialogue) {
        closeDialogue();
      } else {
        if (orinActions['Talk']) orinActions['Talk'].reset().play();
        openDialogue('orin', 'ORIN_01');
      }
      return;
    }
  }

  // OW1 Iron Nail
  if (currentSceneId === 'OW1' && !inventory.has('ITEM_IRON_NAIL')) {
    const d = Math.hypot(2 - playerState.x, -1 - playerState.z);
    if (d < 2.5) {
      inventory.add('ITEM_IRON_NAIL');
      if (ironNailMesh) {
        ironNailMesh.parent?.remove(ironNailMesh);
        ironNailMesh = null;
      }
      SoundFX.playPickup();
      showToast('Acquired: Cold-Iron Nail Relic');
      saveCheckpoint();
      return;
    }
  }

  // GH2 Mirror Lock

  if (currentSceneId === 'GH2' && mirrorMesh && mirrorMesh.visible) {

    const d = Math.hypot(mirrorMesh.position.x - playerState.x, mirrorMesh.position.z - playerState.z);

    if (d < 2.5) {

      if (inventory.has('ITEM_IRON_NAIL')) {

        solvedPuzzles.add('PUZZLE_MIRROR_LOCK');

        mirrorMesh.visible = false;

        SoundFX.playPuzzleSolved();

        cameraShake = 0.28;

        showToast('Puzzle Solved: Mirror Lock Shattered!');

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast('Locked: The mirror lock requires an Iron Nail');

      }

      return;

    }

  }

  // U3 Echo Chamber

  if (currentSceneId === 'U3' && mirrorMesh && mirrorMesh.visible) {

    const d = Math.hypot(mirrorMesh.position.x - playerState.x, mirrorMesh.position.z - playerState.z);

    if (d < 2.5) {

      solvedPuzzles.add('PUZZLE_ECHO_CHAMBER');

      mirrorMesh.visible = false;

      SoundFX.playEchoBell();

      showToast('Puzzle Solved: Echo Chamber Resonates!');

      saveCheckpoint();

      return;

    }

  }

  // RS Relativity Cloister - Anchor Escher Stairs

  if (currentSceneId.startsWith('RS') && !solvedPuzzles.has('PUZZLE_RELATIVITY_STAIRS')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (inventory.has('ITEM_IRON_NAIL') || inventory.has('ITEM_COLD_IRON_KEY')) {

        solvedPuzzles.add('PUZZLE_RELATIVITY_STAIRS');

        SoundFX.playPuzzleSolved();

        cameraShake = 0.25;

        showToast('Puzzle Solved: Escher Stairs Anchored!');

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast('Locked: Requires Iron Nail or Cold-Iron Key to anchor the stairs');

      }

      return;

    }

  }

  // PB1 Prison Block - Warden's Keyring pickup

  if (currentSceneId === 'PB1' && !inventory.has('ITEM_WARDEN_KEYRING')) {

    const d = Math.hypot(3 - playerState.x, -2 - playerState.z);

    if (d < 1.8) {

      inventory.add('ITEM_WARDEN_KEYRING');

      SoundFX.playPickup();

      showToast("Acquired: Warden's Abyssal Keyring");

      saveCheckpoint();

      return;

    }

  }

  // PB4 Warden Office - Solve prison escape

  if (currentSceneId === 'PB4' && !solvedPuzzles.has('PUZZLE_PRISON_ESCAPE')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (inventory.has('ITEM_WARDEN_KEYRING')) {

        solvedPuzzles.add('PUZZLE_PRISON_ESCAPE');

        SoundFX.playPuzzleSolved();

        cameraShake = 0.25;

        showToast('Puzzle Solved: Prison Block Liberated!');

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast("Locked: Requires Warden's Keyring");

      }

      return;

    }

  }

  // RG2 Rooftop Gardens - Wind Vane pickup

  if (currentSceneId === 'RG2' && !inventory.has('ITEM_WIND_VANE')) {

    const d = Math.hypot(2 - playerState.x, -1 - playerState.z);

    if (d < 1.8) {

      inventory.add('ITEM_WIND_VANE');

      SoundFX.playPickup();

      showToast("Acquired: Wind Vane (Glider Shortcut)");

      saveCheckpoint();

      return;

    }

  }

  // RG4 Rooftop Gardens - Vista Point wind secret

  if (currentSceneId === 'RG4' && !solvedPuzzles.has('PUZZLE_WIND_SECRET')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (inventory.has('ITEM_WIND_VANE')) {

        solvedPuzzles.add('PUZZLE_WIND_SECRET');

        SoundFX.playPuzzleSolved();

        cameraShake = 0.2;

        showToast('Puzzle Solved: The Wind\'s Secret Revealed!');

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast("Locked: Requires Wind Vane");

      }

      return;

    }

  }

  // VR2 Void Realm - Dream Core pickup

  if (currentSceneId === 'VR2' && !inventory.has('ITEM_DREAM_CORE')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 1.8) {

      inventory.add('ITEM_DREAM_CORE');

      SoundFX.playPickup();

      showToast("Acquired: Dream Core (Void Anchor)");

      saveCheckpoint();

      return;

    }

  }

  // VR3 Void Realm - Core Return dream descent

  if (currentSceneId === 'VR3' && !solvedPuzzles.has('PUZZLE_DREAM_DESCENT')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (inventory.has('ITEM_DREAM_CORE')) {

        solvedPuzzles.add('PUZZLE_DREAM_DESCENT');

        SoundFX.playPuzzleSolved();

        cameraShake = 0.25;

        showToast('Puzzle Solved: Dream Descent Complete!');

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast("Locked: Requires Dream Core");

      }

      return;

    }

  }

  // TR2 Trophy Hall - Curator's Trophy pickup (mimic chest)

  if (currentSceneId === 'TR2' && !inventory.has('ITEM_CURATOR_TROPHY')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 1.8) {

      inventory.add('ITEM_CURATOR_TROPHY');

      SoundFX.playPickup();

      showToast("Acquired: Curator's Trophy (Mimic Chest)");

      saveCheckpoint();

      return;

    }

  }

  // TR4 Trophy Hall - Solve the Hunter's Lie

  if (currentSceneId === 'TR4' && !solvedPuzzles.has('PUZZLE_HUNTERS_LIE')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (inventory.has('ITEM_CURATOR_TROPHY')) {

        solvedPuzzles.add('PUZZLE_HUNTERS_LIE');

        SoundFX.playPuzzleSolved();

        cameraShake = 0.2;

        showToast("Puzzle Solved: The Hunter's Lie Exposed!");

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast("Locked: Requires Curator's Trophy");

      }

      return;

    }

  }

  // U1 Undercrypt - Prayer Beads pickup

  if (currentSceneId === 'U1' && !inventory.has('ITEM_PRAYER_BEADS')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 1.8) {

      inventory.add('ITEM_PRAYER_BEADS');

      SoundFX.playPickup();

      showToast("Acquired: Monk's Prayer Beads");

      saveCheckpoint();

      return;

    }

  }

  // U2 Undercrypt - Lay monk spirits to rest

  if (currentSceneId === 'U2' && !solvedPuzzles.has('PUZZLE_MONK_TOMBS')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (inventory.has('ITEM_PRAYER_BEADS')) {

        solvedPuzzles.add('PUZZLE_MONK_TOMBS');

        SoundFX.playEchoBell();

        SoundFX.playPuzzleSolved();

        cameraShake = 0.2;

        showToast('Puzzle Solved: Monk Spirits Laid to Rest!');

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast("Locked: Requires Prayer Beads");

      }

      return;

    }

  }

  // AT1 Astronomy Tower - Astromancer's Lens pickup

  if (currentSceneId === 'AT1' && !inventory.has('ITEM_ASTROMANCERS_LENS')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 1.8) {

      inventory.add('ITEM_ASTROMANCERS_LENS');

      SoundFX.playPickup();

      showToast("Acquired: Astromancer's Lens");

      saveCheckpoint();

      return;

    }

  }

  // AT3 Astronomy Tower - Star Map reward

  if (currentSceneId === 'AT3' && !solvedPuzzles.has('PUZZLE_STAR_MAP')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (inventory.has('ITEM_ASTROMANCERS_LENS')) {

        solvedPuzzles.add('PUZZLE_STAR_MAP');

        SoundFX.playChimeTune();

        SoundFX.playPuzzleSolved();

        cameraShake = 0.2;

        showToast('Puzzle Solved: Star Map Aligned!');

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast("Locked: Requires Astromancer's Lens");

      }

      return;

    }

  }

  // BT1 Bell Tower - Tune Aeolian Baffles

  if (currentSceneId === 'BT1' && !solvedPuzzles.has('PUZZLE_AEOLIAN_CHIME')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      solvedPuzzles.add('PUZZLE_AEOLIAN_CHIME');

      SoundFX.playChimeTune();

      SoundFX.playPuzzleSolved();

      cameraShake = 0.2;

      showToast('Puzzle Solved: Aeolian Baffles Tuned!');

      saveCheckpoint();

      return;

    }

  }

  // AL1 Alchemist's Lab - Volatile Sulfur pickup

  if (currentSceneId === 'AL1' && !inventory.has('ITEM_VOLATILE_SULFUR')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 1.8) {

      inventory.add('ITEM_VOLATILE_SULFUR');

      SoundFX.playPickup();

      showToast("Acquired: Volatile Sulfur");

      saveCheckpoint();

      return;

    }

  }

  // AL3 Alchemist's Lab - Solve Unstable Formula

  if (currentSceneId === 'AL3' && !solvedPuzzles.has('PUZZLE_UNSTABLE_FORMULA')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (inventory.has('ITEM_VOLATILE_SULFUR')) {

        solvedPuzzles.add('PUZZLE_UNSTABLE_FORMULA');

        SoundFX.playPuzzleSolved();

        cameraShake = 0.2;

        showToast('Puzzle Solved: Unstable Formula Stabilized!');

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast("Locked: Requires Volatile Sulfur");

      }

      return;

    }

  }

  // U4 Undercrypt - Mirror Phase through sealed vault

  if (currentSceneId === 'U4' && !solvedPuzzles.has('PUZZLE_MIRROR_VAULT')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (abilities.has('ABILITY_MIRROR_PHASE')) {

        solvedPuzzles.add('PUZZLE_MIRROR_VAULT');

        SoundFX.playGlassShatter();

        SoundFX.playPuzzleSolved();

        cameraShake = 0.25;

        showToast('Puzzle Solved: Phased Through Sealed Vault!');

        saveCheckpoint();

      } else {

        SoundFX.playLocked();

        showToast("Locked: Requires Mirror Phase (Shatter True Mirror in HM1)");

      }

      return;

    }

  }

  // CO3 Crystal Theater - Duchess Seraphina's Mirror

  if (currentSceneId === 'CO3' && !solvedPuzzles.has('PUZZLE_CRYSTAL_THEATER')) {

    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);

    if (d < 2.5) {

      if (abilities.has('ABILITY_MIRROR_PHASE')) {

        solvedPuzzles.add('PUZZLE_CRYSTAL_THEATER');

        SoundFX.playGlassShatter();

        SoundFX.playPuzzleSolved();

        cameraShake = 0.3;

        showToast('Puzzle Solved: Crystal Theater Unveiled!');

        saveCheckpoint();

      } else {
        SoundFX.playLocked();
        showToast('Locked: Requires Mirror Phase');
      }
      return;
    }
  }
  // AT2 Constellation Telescope
  if (currentSceneId === 'AT2') {
    const d = Math.hypot(0 - playerState.x, -2.0 - playerState.z);
    if (d < 2.5) {
      solvedPuzzles.add('PUZZLE_CONSTELLATION');
      SoundFX.playChimeTune();
      showToast('Puzzle Solved: Constellation Aligned!');
      saveCheckpoint();
      return;
    }
  }

  // HM1 True Mirror

  if (currentSceneId === 'HM1' && trueMirrorMesh && trueMirrorMesh.visible) {

    const d = Math.hypot(trueMirrorMesh.position.x - playerState.x, trueMirrorMesh.position.z - playerState.z);

    if (d < 2.5) {

      solvedPuzzles.add('PUZZLE_TRUE_MIRROR');

      abilities.add('ABILITY_MIRROR_PHASE');

      trueMirrorMesh.visible = false;

      if (starlightPortalMesh) starlightPortalMesh.visible = true;

      SoundFX.playGlassShatter();

      SoundFX.playPuzzleSolved();

      cameraShake = 0.35;

      showToast('Puzzle Solved: True Mirror Shattered — Starlight Portal Unsealed!');

      saveCheckpoint();

      return;

    }

  }

  // BQ1 Lord Morvath & Phantom Feast

  if (currentSceneId === 'BQ1') {

    if (morvathMesh) {

      const d = Math.hypot(morvathMesh.position.x - playerState.x, morvathMesh.position.z - playerState.z);

      if (d < 2.5) {

        if (activeDialogue) closeDialogue();

        else openDialogue('morvath', 'MORVATH_01');

        return;

      }

    }

    if (banquetBoarMesh && !solvedPuzzles.has('PUZZLE_FEAST_SATIETY')) {

      const d = Math.hypot(banquetBoarMesh.position.x - playerState.x, banquetBoarMesh.position.z - playerState.z);

      if (d < 2.8) {

        if (inventory.has('ITEM_TANTALUS_GOBLET') || truthLensActive) {

          solvedPuzzles.add('PUZZLE_FEAST_SATIETY');

          (banquetBoarMesh.material as THREE.MeshStandardMaterial).color.setHex(0x374151);

          (banquetBoarMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x111827);

          SoundFX.playFeastWaltz();

          SoundFX.playPuzzleSolved();

          cameraShake = 0.28;

          showToast('Puzzle Solved: The Feast Dissolves to Cold Ash!');

          saveCheckpoint();

        } else {

          SoundFX.playLocked();

          showToast('Phantom Satiety: Requires Truth Lens or the Tantalus Goblet');

        }

        return;

      }

    }

  }

  // AG1 Yggdra the Ancient Bough & Root Wall

  if (currentSceneId === 'AG1') {

    if (yggdraMesh) {

      const d = Math.hypot(yggdraMesh.position.x - playerState.x, yggdraMesh.position.z - playerState.z);

      if (d < 3.2) {

        if (activeDialogue) closeDialogue();

        else openDialogue('yggdra', 'YGGDRA_01');

        return;

      }

    }

    if (rootWallMesh && rootWallMesh.visible) {

      const d = Math.hypot(rootWallMesh.position.x - playerState.x, rootWallMesh.position.z - playerState.z);

      if (d < 2.5) {

        if (abilities.has('ABILITY_STARLIGHT_DASH')) {

          solvedPuzzles.add('PUZZLE_ARBOREAL_WEAVE');

          rootWallMesh.visible = false;

          SoundFX.playTreeGroan();

          SoundFX.playPuzzleSolved();

          showToast('Arboreal Roots Parted with Starlight Dash!');

          saveCheckpoint();

        } else {

          SoundFX.playLocked();

          showToast('Thorny Root Wall: Commune with Yggdra or claim Starlight Dash');

        }

        return;

      }

    }

  }

  // MH1 Mother Hazel & Confectionery Kettle

  if (currentSceneId === 'MH1') {

    if (hazelMesh) {

      const d = Math.hypot(hazelMesh.position.x - playerState.x, hazelMesh.position.z - playerState.z);

      if (d < 2.5) {
        if (activeDialogue) {
          closeDialogue();
        } else {
          if (hazelActions['Talk']) hazelActions['Talk'].reset().play();
          openDialogue('hazel', 'HAZEL_01');
        }
        return;
      }

    }

    if (kettleMesh && !solvedPuzzles.has('PUZZLE_HOSPITALITY_GAMBIT')) {

      const d = Math.hypot(kettleMesh.position.x - playerState.x, kettleMesh.position.z - playerState.z);

      if (d < 2.5) {

        if (inventory.has('ITEM_SUGAR_SPOON')) {

          solvedPuzzles.add('PUZZLE_HOSPITALITY_GAMBIT');

          SoundFX.playWitchGiggle();

          SoundFX.playPuzzleSolved();

          cameraShake = 0.25;

          showToast('Puzzle Solved: Flue Unlocked with Sugar Spoon!');

          saveCheckpoint();

        } else {

          SoundFX.playLocked();

          showToast('Boiling Confectionery Kettle: Requires Witch\'s Sugar Spoon');

        }

        return;

      }

    }

  }

  // GH1 Gatehouse Exterior - Captain's Patrol Ledger pickup

  if (currentSceneId === 'GH1' && !inventory.has('ITEM_CAPTAIN_LEDGER')) {

    const d = Math.hypot(2 - playerState.x, -1 - playerState.z);

    if (d < 1.8) {

      inventory.add('ITEM_CAPTAIN_LEDGER');

      SoundFX.playPickup();

      showToast("Acquired: Captain's Patrol Ledger");

      saveCheckpoint();

      return;

    }

  }

  // GH1 Gatehouse Exterior - Clear the gatehouse
  if (currentSceneId === 'GH1' && !solvedPuzzles.has('PUZZLE_GATEHOUSE_EXTERIOR')) {
    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
    if (d < 2.5) {
      if (inventory.has('ITEM_CAPTAIN_LEDGER')) {
        solvedPuzzles.add('PUZZLE_GATEHOUSE_EXTERIOR');
        SoundFX.playPuzzleSolved();
        cameraShake = 0.25;
        showToast('Puzzle Solved: Gatehouse Exterior Cleared!');
        saveCheckpoint();
      } else {

        SoundFX.playLocked();
        showToast("Locked: Requires Captain's Patrol Ledger");
      }
      return;
    }
  }
  // GH4 Vent Passage - Vent Grate Key pickup
  if (currentSceneId === 'GH4' && !inventory.has('ITEM_VENT_KEY')) {
    const d = Math.hypot(1 - playerState.x, 0 - playerState.z);
    if (d < 1.8) {
      inventory.add('ITEM_VENT_KEY');
      SoundFX.playPickup();
      showToast("Acquired: Vent Grate Key");
      saveCheckpoint();
      return;
    }
  }

  // GH4 Vent Passage - Ascend the vent
  if (currentSceneId === 'GH4' && !solvedPuzzles.has('PUZZLE_VENT_ASCENT')) {
    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
    if (d < 2.5) {
      if (inventory.has('ITEM_VENT_KEY')) {
        solvedPuzzles.add('PUZZLE_VENT_ASCENT');
        SoundFX.playPuzzleSolved();
        cameraShake = 0.25;
        showToast('Puzzle Solved: Vent Ascent Cleared!');
        saveCheckpoint();
      } else {

        SoundFX.playLocked();
        showToast("Locked: Requires Vent Grate Key");
      }
      return;
    }
  }
  // SQ1 Servants Quarters - Servant's Diary pickup
  if (currentSceneId === 'SQ1' && !inventory.has('ITEM_SERVANT_DIARY')) {
    const d = Math.hypot(-2 - playerState.x, 1 - playerState.z);
    if (d < 1.8) {
      inventory.add('ITEM_SERVANT_DIARY');
      SoundFX.playPickup();
      showToast("Acquired: Servant's Diary");
      saveCheckpoint();
      return;
    }
  }

  // SQ1 Servants Quarters - Uncover the servant's secret
  if (currentSceneId === 'SQ1' && !solvedPuzzles.has('PUZZLE_SERVANT_SECRET')) {
    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
    if (d < 2.5) {
      if (inventory.has('ITEM_SERVANT_DIARY')) {
        solvedPuzzles.add('PUZZLE_SERVANT_SECRET');
        SoundFX.playPuzzleSolved();
        cameraShake = 0.25;
        showToast('Puzzle Solved: Servant Secret Uncovered!');
        saveCheckpoint();
      } else {

        SoundFX.playLocked();
        showToast("Locked: Requires Servant's Diary");
      }
      return;
    }
  }
  // B1 Barracks Hall - Barracks Armory Key pickup
  if (currentSceneId === 'B1' && !inventory.has('ITEM_ARMORY_KEY')) {
    const d = Math.hypot(0 - playerState.x, 2 - playerState.z);
    if (d < 1.8) {
      inventory.add('ITEM_ARMORY_KEY');
      SoundFX.playPickup();
      showToast("Acquired: Barracks Armory Key");
      saveCheckpoint();
      return;
    }
  }

  // B1 Barracks Hall - Raid the barracks armory
  if (currentSceneId === 'B1' && !solvedPuzzles.has('PUZZLE_BARRACKS_RAID')) {
    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
    if (d < 2.5) {
      if (inventory.has('ITEM_ARMORY_KEY')) {
        solvedPuzzles.add('PUZZLE_BARRACKS_RAID');
        SoundFX.playPuzzleSolved();
        cameraShake = 0.25;
        showToast('Puzzle Solved: Barracks Armory Raided!');
        saveCheckpoint();
      } else {

        SoundFX.playLocked();
        showToast("Locked: Requires Barracks Armory Key");
      }
      return;
    }
  }
  // RC1 Relativity Cloister - Iron Nail Bundle pickup
  if (currentSceneId === 'RC1' && !inventory.has('ITEM_IRON_NAILS')) {
    const d = Math.hypot(0 - playerState.x, -2 - playerState.z);
    if (d < 1.8) {
      inventory.add('ITEM_IRON_NAILS');
      SoundFX.playPickup();
      showToast("Acquired: Iron Nail Bundle");
      saveCheckpoint();
      return;
    }
  }

  // RC1 Relativity Cloister - Anchor the cloister
  if (currentSceneId === 'RC1' && !solvedPuzzles.has('PUZZLE_RELATIVITY_ANCHOR')) {
    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
    if (d < 2.5) {
      if (inventory.has('ITEM_IRON_NAILS')) {
        solvedPuzzles.add('PUZZLE_RELATIVITY_ANCHOR');
        SoundFX.playPuzzleSolved();
        cameraShake = 0.25;
        showToast('Puzzle Solved: Relativity Cloister Anchored!');
        saveCheckpoint();
      } else {

        SoundFX.playLocked();
        showToast("Locked: Requires Iron Nail Bundle");
      }
      return;
    }
  }
  // CR1 Chronomantic Scriptorium - Tachyon Phial pickup
  if (currentSceneId === 'CR1' && !inventory.has('ITEM_TACHYON_PHIAL')) {
    const d = Math.hypot(2 - playerState.x, -1 - playerState.z);
    if (d < 1.8) {
      inventory.add('ITEM_TACHYON_PHIAL');
      SoundFX.playPickup();
      showToast("Acquired: Tachyon Phial");
      saveCheckpoint();
      return;
    }
  }

  // CR1 Chronomantic Scriptorium - Solve retrocausal portcullis
  if (currentSceneId === 'CR1' && !solvedPuzzles.has('PUZZLE_RETROCAUSAL_PORTCULLIS')) {
    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
    if (d < 2.5) {
      if (inventory.has('ITEM_TACHYON_PHIAL')) {
        solvedPuzzles.add('PUZZLE_RETROCAUSAL_PORTCULLIS');
        inventory.add('ITEM_RETROGRADE_OUROBOROS');
        SoundFX.playPuzzleSolved();
        cameraShake = 0.3;
        showToast('Puzzle Solved: Retrocausal Portcullis Unlocked!');
        showToast('Acquired: Retrograde Ouroboros');

        saveCheckpoint();
      } else {
        SoundFX.playLocked();
        showToast("Locked: Requires Tachyon Phial");
      }
      return;
    }
  }
  // MS3 Music Salon - Glass-Armonica Mallet pickup
  if (currentSceneId === 'MS3' && !inventory.has('ITEM_GLASS_MALLET')) {
    const d = Math.hypot(2 - playerState.x, -1 - playerState.z);
    if (d < 1.8) {
      inventory.add('ITEM_GLASS_MALLET');
      SoundFX.playPickup();
      showToast("Acquired: Glass-Armonica Mallet");
      saveCheckpoint();
      return;
    }
  }

  // MS3 Music Salon - Cadence of Resonant Harmonies
  if (currentSceneId === 'MS3' && !solvedPuzzles.has('PUZZLE_RESONANT_HARMONIES')) {
    const d = Math.hypot(0 - playerState.x, 0 - playerState.z);
    if (d < 2.5) {
      if (inventory.has('ITEM_GLASS_MALLET')) {
        solvedPuzzles.add('PUZZLE_RESONANT_HARMONIES');
        inventory.add('ITEM_UNBROKEN_CHORD_SCORE');
        SoundFX.playPuzzleSolved();
        cameraShake = 0.3;
        showToast('Puzzle Solved: Resonant Harmonies Restored!');
        showToast('Acquired: Score of the Unbroken Chord');

        saveCheckpoint();
      } else {
        SoundFX.playLocked();
        showToast("Locked: Requires Glass-Armonica Mallet");
      }
      return;
    }
  }
  // SAN1 Liberated Cynthia & Archillusionist Vaelor
  if (currentSceneId === 'SAN1') {
    if (cynthiaCrystal) {
      const d = Math.hypot(cynthiaCrystal.position.x - playerState.x, cynthiaCrystal.position.z - playerState.z);
      if (d < 2.8) {
        if (solvedPuzzles.has('PUZZLE_HOLLOW_GLASS')) {
          if (activeDialogue) closeDialogue();
          else openDialogue('cynthia', 'CYNTHIA_01');
        } else {
          showToast('Cynthia Trapped in the Glass Heart! Defeat Archillusionist Vaelor!');
        }

        return;

      }

    }

    if (vaelorBoss && vaelorBoss.hp > 0) {

      const d = Math.hypot(vaelorBoss.mesh.position.x - playerState.x, vaelorBoss.mesh.position.z - playerState.z);

      if (d < 2.8) {

        if (activeDialogue) closeDialogue();

        else openDialogue('vaelor', 'VAELOR_01');

        return;

      }

    }

  }

}

function showOriginSelector(): Promise<string> {

  return new Promise((resolve) => {

    const modal = document.createElement('div');

    modal.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.78);z-index:9999;';

    const panel = document.createElement('div');

    panel.style.cssText = 'background:rgba(15,23,42,.96);border:1px solid rgba(212,175,55,.4);border-radius:12px;padding:24px;max-width:460px;width:90%;color:#e2e8f0;font-family:system-ui,sans-serif;';

    panel.innerHTML = '<h2 style="font-family:Cinzel,serif;color:#d4af37;margin-bottom:12px">Choose Your Origin</h2><p style="font-size:13px;color:#94a3b8;margin-bottom:16px">Your past shapes your first steps in the Veilkeep.</p>';

    const list = document.createElement('div');

    list.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    const origins = [

      { id: 'ORIGIN_ALCHEMIST', label: 'Gutter-Alchemist of Greyport', desc: '+2 INT, +1 LCK, -1 STR; volatile sulfur pouch' },

      { id: 'ORIGIN_CHARLATAN', label: 'Velvet-Tongued Confidence Man', desc: '+2 CHA, +1 AGI, -1 VIT; social disguise' },

      { id: 'ORIGIN_ENFORCER', label: 'Dockside Pit-Cutthroat', desc: '+2 STR, +1 VIT, -1 CHA; stagger bonus' },

      { id: 'ORIGIN_ANTIQUARIAN', label: 'Occult Reliquary Fence', desc: '+2 LCK, +1 INT, -1 AGI; curse penalty reduction' },

    ];

    origins.forEach((o) => {

      const btn = document.createElement('button');

      btn.style.cssText = 'padding:10px 12px;border-radius:8px;border:1px solid rgba(212,175,55,.3);background:rgba(30,41,59,.8);color:#e2e8f0;cursor:pointer;text-align:left;';

      btn.innerHTML = `<strong>${o.label}</strong><br><span style="font-size:11px;color:#94a3b8">${o.desc}</span>`;

      btn.addEventListener('click', () => { modal.remove(); resolve(o.id); });

      list.appendChild(btn);

    });

    panel.appendChild(list);

    modal.appendChild(panel);

    document.body.appendChild(modal);

  });

}

function resetStats(): void {

  Object.assign(stats, questRuntime.baseStats);

}

/**

 * Apply a Shadow Past origin (GDD 5b.1). `applyLoadout` is false on the boot

 * path when a checkpoint already restored stats and inventory, so a reload

 * cannot double-apply stat modifiers or duplicate starting items.

 */

function applyOrigin(id: string, applyLoadout = true): void {

  const loadout = questRuntime.buildOriginLoadout(id);

  if (applyLoadout) {

    resetStats();

    for (const [key, value] of Object.entries(loadout.statMods)) {

      stats[key as keyof typeof stats] += Number(value ?? 0);

    }

    for (const item of loadout.startingItems) inventory.add(item);

    playerOrigin.flags = { ...loadout.flags };

    playerOrigin.traits = [];

    questRuntime.setTraits([]);

  }

  playerOrigin.id = id;

  playerOrigin.tag = loadout.tag;

  playerOrigin.staggerBonus = Number(loadout.flags.staggerBonus ?? 0);

  playerOrigin.socialDisguise = Boolean(loadout.flags.socialDisguise);

  playerOrigin.cursePenaltyReduction = Number(loadout.flags.cursePenaltyReduction ?? 0);

  questRuntime.setOrigin(id);

  localStorage.setItem('veilkeep.origin.v1', id);

}

/** Apply up to `maxTraits` Kleptomaniac Quirks (GDD 5b.1). */

function applyTraits(ids: string[]): string[] {

  const accepted = questRuntime.setTraits(ids);

  playerOrigin.traits = [...accepted];

  for (const id of accepted) {

    const trait = questRuntime.trait(id);

    if (trait) Object.assign(playerOrigin.flags, trait.flags);

  }

  return accepted;

}

function throwDistraction(): void {

  if (isPaused || activeDialogue || isInventoryOpen || isQuestLogOpen || isLoreOpen || isMapOpen) return;

  const coin = new THREE.Mesh(

    new THREE.SphereGeometry(0.12, 8, 8),

    new THREE.MeshStandardMaterial({ color: 0xd4af37, emissive: 0xd4af37, emissiveIntensity: 1.2 }),

  );

  coin.position.set(playerState.x, 0.6, playerState.z - 2.0);

  engine.scene.add(coin);

  SoundFX.playPickup();

  const distractTarget = activeGuards

    .filter((g) => g.sceneId === currentSceneId && g.state !== 'dead')

    .sort((a, b) => Math.hypot(a.mesh.position.x - playerState.x, a.mesh.position.z - playerState.z) - Math.hypot(b.mesh.position.x - playerState.x, b.mesh.position.z - playerState.z))[0];

  if (distractTarget) {

    distractTarget.patrol = [new THREE.Vector3(coin.position.x, 0.6, coin.position.z)];

    distractTarget.patrolIndex = 0;

    distractTarget.state = 'patrol';

  }

  setTimeout(() => engine.scene.remove(coin), 4000);

}

function checkExits(): void {
  if (exitCooldown > 0) return;

  for (const exit of exits[currentSceneId]) {
    // The automaton only commits to the door its route chose; otherwise it
    // would be yanked through any side door it happens to walk past.
    if (autoEnabled && autoExitTarget !== exit.to) continue;

    const doorPos = getEffectiveDoorPos(currentSceneId, exit);
    const d = Math.hypot(doorPos.x - playerState.x, doorPos.z - playerState.z);

    if (d < 1.8) {
      if (requirementsMet(exit.requires)) {
        exitCooldown = 1.5;
        const spawn = getTransitionSpawn(currentSceneId, exit.to, exit.spawn);
        loadScene(exit.to, spawn);
        return;
      } else {
        // Enforce physical boundary clamping when pressing against a barred gate
        let clamped = false;
        if (exit.z <= -4.0 && playerState.z < doorPos.z + 0.25) {
          playerState.z = doorPos.z + 0.3;
          clamped = true;
        } else if (exit.z >= 4.0 && playerState.z > doorPos.z - 0.25) {
          playerState.z = doorPos.z - 0.3;
          clamped = true;
        } else if (exit.x <= -4.0 && playerState.x < doorPos.x + 0.25) {
          playerState.x = doorPos.x + 0.3;
          clamped = true;
        } else if (exit.x >= 4.0 && playerState.x > doorPos.x - 0.25) {
          playerState.x = doorPos.x - 0.3;
          clamped = true;
        }

        if (clamped) {
          const py = playerMesh.position.y || 0.6;
          physics.teleportPlayer({ x: playerState.x, y: py, z: playerState.z });
          playerMesh.position.set(playerState.x, py, playerState.z);
        }

        if (lockedMessageCooldown <= 0) {
          const reqLabels = exit.requires.map(r =>
            r === 'ITEM_IRON_NAIL' ? 'Iron Nail'
            : r === 'PUZZLE_MIRROR_LOCK' ? 'Mirror Lock'
            : r === 'PUZZLE_TRUE_MIRROR' ? 'True Mirror Cleansed'
            : r === 'PUZZLE_FEAST_SATIETY' ? 'Feast Satiety Dispelled'
            : r === 'PUZZLE_ARBOREAL_WEAVE' ? 'Arboreal Root Weave'
            : r === 'PUZZLE_HOSPITALITY_GAMBIT' ? 'Hospitality Gambit Solved'
            : r === 'PUZZLE_HOLLOW_GLASS' ? 'Glass Heart Shattered'
            : r
          );
          showToast(`Barred Gate: Requires ${reqLabels.join(', ')}`);
          lockedMessageCooldown = 2.2;
        }
        return;
      }
    }

  }

}

// ---------- Auto-battler runtime ----------

function autoProgress(): AutoProgressState {

  return {

    inventory,

    solvedPuzzles,

    abilities,

    visited: autoVisited,

    cleared: autoCleared,

    flags: autoFlags,

  };

}

/** Static colliders that overlap the capsule's walking band. */

function autoObstacles(): ObstacleRect[] {

  const out: ObstacleRect[] = [];

  for (const box of physics.getStaticBoxes()) {

    if (box.y + box.hy <= 0.35 || box.y - box.hy >= 1.6) continue;

    out.push({ x: box.x, z: box.z, hx: box.hx, hz: box.hz });

  }

  return out;

}

function autoNearestGuard(): Guard | null {

  let best: Guard | null = null;

  let bestDist = Infinity;

  for (const g of activeGuards) {

    if (g.sceneId !== currentSceneId || g.state === 'dead' || g.hp <= 0) continue;

    const d = Math.hypot(g.mesh.position.x - playerState.x, g.mesh.position.z - playerState.z);

    if (d < bestDist) {

      bestDist = d;

      best = g;

    }

  }

  return best;

}

/** Grid-navigates to a point. Returns true once inside `arriveRadius`. */

function autoNavigate(tx: number, tz: number, arriveRadius: number, dt: number): boolean {

  const distance = Math.hypot(tx - playerState.x, tz - playerState.z);

  if (distance <= arriveRadius) {

    autoInput.x = 0;

    autoInput.z = 0;

    return true;

  }

  autoRepathTimer -= dt;

  const targetChanged = !autoPathTarget || Math.hypot(autoPathTarget.x - tx, autoPathTarget.z - tz) > 0.35;

  if (autoRepathTimer <= 0 || targetChanged) {
    const { hw, hh } = getRoomHalfExtents(currentSceneId);
    const bounds = { minX: -hw + 0.5, maxX: hw - 0.5, minZ: -hh + 0.5, maxZ: hh - 0.5 };
    autoPath = findPath(
      { x: playerState.x, z: playerState.z },
      { x: tx, z: tz },
      autoObstacles(),
      bounds,
    );

    autoPathTarget = { x: tx, z: tz };

    autoRepathTimer = 0.45;
  }

  while (autoPath.length > 0) {

    const head = autoPath[0];

    if (Math.hypot(head.x - playerState.x, head.z - playerState.z) > 0.22) break;

    autoPath.shift();

  }

  const waypoint = autoPath[0] ?? { x: tx, z: tz };

  let dx = waypoint.x - playerState.x;

  let dz = waypoint.z - playerState.z;

  const len = Math.hypot(dx, dz);

  if (len < 1e-4) {

    autoInput.x = 0;

    autoInput.z = 0;

    return false;

  }

  dx /= len;

  dz /= len;

  if (performance.now() < autoNudgeUntil) {

    // Slide sideways along the obstacle when the straight line is wedged.

    const px = dx;

    dx = -dz;

    dz = px;

  }

  autoInput.x = dx;

  autoInput.z = dz;

  return false;

}

function autoTrackStuck(dt: number): void {

  autoStuckTimer += dt;

  if (autoStuckTimer < 1.1) return;

  const moved = Math.hypot(playerState.x - autoStuckAnchor.x, playerState.z - autoStuckAnchor.z);

  const trying = Math.abs(autoInput.x) + Math.abs(autoInput.z) > 0.01;

  if (trying && moved < 0.1) {

    autoNudgeUntil = performance.now() + 500;

    autoPath = [];

    autoRepathTimer = 0;

    // Sliding along a wall is ordinary pathfinding traffic, not a failure;

    // the HUD watchdog only reports conditions that need a human.

    autoNudges++;

  }

  autoStuckAnchor = { x: playerState.x, z: playerState.z };

  autoStuckTimer = 0;

}

function autoDialogueChoices(npcKey: string, nodeId: string): DialogueChoice[] {

  const npcData = (dialogueData as Record<string, any>)[npcKey];

  const node: DialogueNode | undefined = npcData?.nodes?.[nodeId];

  if (!node) return [];

  return node.choices.filter((choice) => {

    if (choice.requiredItemId) {

      const hasItem = inventory.has(choice.requiredItemId) ||

        (choice.requiredItemId === 'relic_iron_nails' && inventory.has('ITEM_IRON_NAIL'));

      if (!hasItem) return false;

    }

    if (choice.requiredStat) {

      const value = (stats as Record<string, number>)[choice.requiredStat.stat] ?? 0;

      if (value < choice.requiredStat.minVal) return false;

    }

    return choice.actionTrigger !== 'START_COMBAT' && choice.actionTrigger !== 'ORIN_BLUFF';

  });

}

/**

 * First step of the shortest dialogue branch that ends in a GIVE_ITEM reward

 * (Tantalus Goblet, Sugar Spoon, Starlight Dash...). Falls back to a closing

 * branch for conversations that are pure flavour.

 */

function autoPickDialogueChoice(npcKey: string, nodeId: string): DialogueChoice | null {

  const rootChoices = autoDialogueChoices(npcKey, nodeId);

  if (rootChoices.length === 0) return null;

  const visited = new Set<string>([nodeId]);

  const queue: { nodeId: string; first: DialogueChoice }[] = [];

  let fallback: DialogueChoice | null = null;

  for (const choice of rootChoices) {

    if (choice.actionTrigger === 'GIVE_ITEM') return choice;

    if (!choice.nextDialogueNodeId) {

      if (!fallback) fallback = choice;

      continue;

    }

    queue.push({ nodeId: choice.nextDialogueNodeId, first: choice });

  }

  while (queue.length > 0) {

    const current = queue.shift() as { nodeId: string; first: DialogueChoice };

    if (visited.has(current.nodeId)) continue;

    visited.add(current.nodeId);

    const choices = autoDialogueChoices(npcKey, current.nodeId);

    for (const choice of choices) {

      if (choice.actionTrigger === 'GIVE_ITEM') return current.first;

      if (!choice.nextDialogueNodeId && !fallback) fallback = current.first;

      if (choice.nextDialogueNodeId) queue.push({ nodeId: choice.nextDialogueNodeId, first: current.first });

    }

  }

  return fallback ?? rootChoices[0];

}

function autoDialogueTick(dt: number): void {

  autoInput.x = 0;

  autoInput.z = 0;

  if (!activeDialogue) {

    autoDialogueTurns = 0;

    autoDialogueNpc = '';

    autoDialogueDelay = 0;

    return;

  }

  if (autoDialogueNpc !== activeDialogue.npcKey) {

    autoDialogueNpc = activeDialogue.npcKey;

    autoDialogueTurns = 0;

    autoDialogueDelay = 0;

  }

  // Merely opening a conversation counts as talking for quest flags.

  autoFlags.add(`talk:${activeDialogue.npcKey}`);

  autoDialogueTurns++;

  if (autoDialogueTurns > 40) {

    closeDialogue();

    return;

  }

  autoDialogueDelay -= dt;

  if (autoDialogueDelay > 0) return;

  autoDialogueDelay = 0.16;

  const choice = autoPickDialogueChoice(activeDialogue.npcKey, activeDialogue.currentNodeId);

  if (!choice) {

    closeDialogue();

    return;

  }

  chooseDialogueOption(choice);

}

function autoUpdateHud(): void {

  const panel = document.getElementById('hud-autobattler');

  if (!panel) return;

  panel.classList.toggle('active', autoEnabled);

  const stateEl = document.getElementById('auto-state-label');

  const sceneEl = document.getElementById('auto-scene-label');

  const taskEl = document.getElementById('auto-task-label');

  const fillEl = document.getElementById('auto-bar-fill');

  const done = completedTaskCount(autoProgress());

  if (stateEl) stateEl.textContent = autoEnabled ? autoStatus.toUpperCase() : 'OFFLINE';

  if (sceneEl) sceneEl.textContent = `${currentSceneId} · ${autoVisited.size}/${CAMPAIGN_ORDER.length}`;

  if (fillEl) fillEl.style.width = `${Math.round((done / Math.max(1, TOTAL_TASKS)) * 100)}%`;

  if (taskEl) {

    if (!autoEnabled) taskEl.textContent = 'Press P to engage the automaton.';

    else if (autoStatus === 'done') taskEl.textContent = 'Expedition complete.';

    else {

      const pending = nextPendingTask(currentSceneId, autoProgress());

      taskEl.textContent = pending

        ? pending.label

        : autoGoalId

          ? `Route: ${currentSceneId} → ${autoGoalId}`

          : 'Finale: return to the courtyard.';

    }

  }

}

function toggleAutoBattler(force?: boolean): void {

  const next = force !== undefined ? force : !autoEnabled;

  if (next === autoEnabled) return;

  autoEnabled = next;

  autoRoute = [];

  autoPath = [];

  autoPathTarget = null;

  autoExitTarget = null;

  autoInput = { x: 0, z: 0 };

  autoStuckAnchor = { x: playerState.x, z: playerState.z };

  autoStuckTimer = 0;

  autoActionTimer = 0;

  autoAttackTimer = 0;

  autoDialogueTurns = 0;

  autoDialogueNpc = '';

  autoDialogueDelay = 0;

  autoTaskSince = 0;

  autoTaskWatch = '';

  autoLastError = '';

  if (autoEnabled) {

    autoStatus = 'travel';

    autoVisited.add(currentSceneId);

    autoEndingShown = false;

    showToast('Auto-Battler Engaged — the automaton takes the wheel.');

  } else {

    autoStatus = 'off';

    playerState.keys = { w: false, a: false, s: false, d: false, shift: false, ctrl: false };

    showToast('Auto-Battler Disengaged — manual control restored.');

  }

  autoUpdateHud();

}

function autoOnSceneEnter(id: SceneId): void {

  autoVisited.add(id);

  autoRoute = [];

  autoPath = [];

  autoPathTarget = null;

  autoExitTarget = null;

  autoRepathTimer = 0;

  autoStuckTimer = 0;

  autoStuckAnchor = { x: playerState.x, z: playerState.z };

  autoNudgeUntil = 0;

  autoActionTimer = 0;

  autoAttackTimer = 0;

  autoDialogueTurns = 0;

  autoDialogueNpc = '';

  autoDialogueDelay = 0;

  autoTaskSince = 0;

  autoTaskWatch = '';

  autoLastError = '';

  autoNudges = 0;

  autoUpdateHud();

}

function autoTick(dt: number): void {

  if (!autoEnabled) return;

  autoHudTimer -= dt;

  if (autoHudTimer <= 0) {

    autoHudTimer = 0.2;

    autoUpdateHud();

  }

  if (isLoreOpen) closeLore();

  if (isEndingModalOpen) {

    autoInput.x = 0;

    autoInput.z = 0;

    autoStatus = 'done';

    return;

  }

  if (activeDialogue) {

    autoDialogueTick(dt);

    return;

  }

  autoDialogueNpc = '';

  autoDialogueTurns = 0;

  autoVisited.add(currentSceneId);

  const progress = autoProgress();

  const pending = nextPendingTask(currentSceneId, progress);

  const guard = autoNearestGuard();

  if (!guard) autoCleared.add(currentSceneId);

  // Watchdog: a task that never resolves is a bug worth surfacing on the HUD.

  if (pending && pending.id !== autoTaskWatch) {

    autoTaskWatch = pending.id;

    autoTaskSince = 0;

  }

  autoTaskSince += dt;

  if (autoTaskSince > 30) autoLastError = `timeout:${autoTaskWatch}`;

  // Combat takes priority over everything else.

  const guardDistance = guard

    ? Math.hypot(guard.mesh.position.x - playerState.x, guard.mesh.position.z - playerState.z)

    : Infinity;

  if (guard && (pending?.kind === 'clear' || guardDistance < 3.4)) {

    autoStatus = 'combat';

    autoTaskId = pending?.kind === 'clear' ? pending.id : null;

    autoCombatTimer = 3;

    autoTrackStuck(dt);

    if (guardDistance > 1.15) {

      autoNavigate(guard.mesh.position.x, guard.mesh.position.z, 1.0, dt);

    } else {

      autoInput.x = 0;

      autoInput.z = 0;

    }

    autoAttackTimer -= dt;

    if (guardDistance <= 1.55 && autoAttackTimer <= 0) {

      tryAttack();

      autoAttackTimer = 0.42;

    }

    return;

  }

  // Out-of-combat regeneration keeps a long expedition from soft-locking.

  autoCombatTimer = Math.max(0, autoCombatTimer - dt);

  if (autoCombatTimer <= 0 && playerHP < 100) {

    playerHP = Math.min(100, playerHP + 9 * dt);

    if (hpFill) hpFill.style.width = `${Math.round(playerHP)}%`;

  }

  if (pending) {

    autoTaskId = pending.id;

    if (!taskReady(pending, progress)) {

      autoStatus = 'task';

      autoInput.x = 0;

      autoInput.z = 0;

      autoLastError = `blocked:${pending.id}`;

      return;

    }

    if (pending.kind === 'clear') {

      // The room's guard is gone but the clear flag was not recorded yet.

      autoCleared.add(currentSceneId);

      return;

    }

    if (typeof pending.x !== 'number' || typeof pending.z !== 'number') {

      autoLastError = `no-position:${pending.id}`;

      return;

    }

    autoStatus = 'task';

    autoTrackStuck(dt);

    const arrived = autoNavigate(pending.x, pending.z, 0.6, dt);

    if (arrived) {

      autoInput.x = 0;

      autoInput.z = 0;

      autoActionTimer -= dt;

      if (autoActionTimer <= 0) {

        autoActionTimer = 0.55;

        interact(true);

      }

    }

    return;

  }

  autoTaskId = null;

  const goal = nextGoal(progress);

  autoGoalId = (goal ?? null) as SceneId | null;

  const destination = (goal ?? 'S00') as SceneId;

  if (destination === currentSceneId) {

    // All campaign work is done and we are standing in the courtyard.

    autoStatus = 'done';

    autoInput.x = 0;

    autoInput.z = 0;

    autoExitTarget = null;

    if (!autoEndingShown) {

      autoEndingShown = true;

      openEndingModal();

    }

    autoUpdateHud();

    return;

  }

  autoStatus = 'travel';

  autoTrackStuck(dt);

  if (

    autoRoute.length === 0 ||

    autoRoute[0] !== currentSceneId ||

    autoRoute[autoRoute.length - 1] !== destination

  ) {

    const route = planRoute(currentSceneId, destination, FORTRESS_EXITS, (door) =>

      doorRequirementsMet(door.requires ?? [], inventory, solvedPuzzles, abilities),

    );

    if (!route) {

      autoLastError = `no-route:${currentSceneId}->${destination}`;

      autoInput.x = 0;

      autoInput.z = 0;

      return;

    }

    autoRoute = route as SceneId[];

  }

  const nextScene = autoRoute[1];

  if (!nextScene) {

    autoLastError = `empty-route:${currentSceneId}->${destination}`;

    return;

  }

  const door = (FORTRESS_EXITS[currentSceneId] ?? []).find((d) => d.to === nextScene);

  if (!door) {

    autoLastError = `no-door:${currentSceneId}->${nextScene}`;

    autoInput.x = 0;

    autoInput.z = 0;

    return;

  }

  autoExitTarget = nextScene;

  const effDoor = getEffectiveDoorPos(currentSceneId, door);

  const approach = doorApproachPoint(effDoor, { x: 0, z: 0 }, 0.8);

  const arrived = autoNavigate(approach.x, approach.z, 0.22, dt);

  if (arrived) {

    // Trigger radius is 1.8, but the door point itself sits near or inside the wall
    // collider; nudge straight at it for the final centimetres.

    autoNavigate(effDoor.x, effDoor.z, 0.1, dt);

  }

}

// Player hero

// Main character: Blender-authored rigged + animated GLB (procedural fallback if missing).
const mainChar = await spawnMainCharacter({
  scene: engine.scene,
  urls: ['assets/models/main_character.glb'],
  callbacks: {
    onHitboxOpen: (state) => {
      const weaponMult = mainChar?.equippedWeapon?.def.damageMultiplier ?? 1;
      pendingMeleeMult = (state === 'Heavy_Combo_Finisher' ? 1.8 : 1) * weaponMult;
      resolveMeleeHits();
    },
    onSpell: (e) => {
      SoundFX.playGlassDart();
      spawnGlassDartProjectile(e.origin, e.direction);
    },
  },
});
const playerMesh = mainChar.rig.group;

const WEAPON_CYCLE: WeaponId[] = ['hunter_blade', 'glass_cleaver', 'void_rapier', 'sun_staff'];
let currentWeaponIdx = 0;
function cycleNextWeapon(): void {
  if (!mainChar) return;
  currentWeaponIdx = (currentWeaponIdx + 1) % WEAPON_CYCLE.length;
  const nextId = WEAPON_CYCLE[currentWeaponIdx];
  const equipped = mainChar.equipWeapon(nextId);
  SoundFX.playEchoBell();
  flashMesh(playerMesh, equipped.def.trailColor, 200);
  showToast('Equipped: ' + equipped.def.name + ' (' + equipped.def.damageMultiplier + 'x Dmg)');
}

  // Animation mixer for Kaelen (rigged GLB)

  const playerMixer = new THREE.AnimationMixer(playerMesh);

  let playerCurrentAnim = 'Idle';

  let playerCurrentAction: THREE.AnimationAction | null = null;

  function playPlayerAnim(name: string): void {

    if (mainChar) return; // CombatController owns the player's animation now
    if (playerCurrentAnim === name) return;

    const clip = (kaelenAnimations || []).find((c) => c.name === name);

    if (!clip) return;

    const action = playerMixer.clipAction(clip);

    if (playerCurrentAction) playerCurrentAction.fadeOut(0.15);

    action.reset().fadeIn(0.15).play();

    playerCurrentAction = action;
    playerCurrentAnim = name;
  }
  const idleClip = (kaelenAnimations || []).find((c) => c.name === 'Idle');
  if (idleClip && !mainChar) playerMixer.clipAction(idleClip).play();
playerMesh.traverse((node) => {
  if (node instanceof THREE.Mesh) node.castShadow = true;
});
playerMesh.position.set(initialSpawn.x, 0.6, initialSpawn.z);
engine.scene.add(playerMesh);
const playerLight = new THREE.PointLight(0xfef08a, 1.8, 9);
playerLight.position.set(0, 0.6, 0);
playerMesh.add(playerLight);
// Controls
canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();

  tryParry();

});

canvas.addEventListener('mousedown', (e) => {

  SoundFX.ensureInit();

  SoundFX.startAmbientMusic();

  audioManager.ensureStarted();

  if (e.button === 2) {

    tryParry();

  } else if (e.button === 0) {

    tryAttack();

  }

});

window.addEventListener('keydown', (e) => {

  SoundFX.ensureInit();

  SoundFX.startAmbientMusic();

  audioManager.ensureStarted();

  const k = e.key.toLowerCase();

  // If dialogue is open, handle choice numbers and escape

  if (activeDialogue) {

    if (k === '1' || k === '2' || k === '3' || k === '4') {

      const idx = parseInt(k, 10) - 1;

      const btns = dialogueChoices?.querySelectorAll('.dialogue-choice-btn');

      if (btns && btns[idx]) (btns[idx] as HTMLButtonElement).click();

      return;

    }

  }

  // Cascading Escape Key: Closes topmost open modal or toggles Pause Menu

  if (k === 'escape') {

    if (activeDialogue) {

      closeDialogue();

      return;

    }

    if (isLoreOpen) {

      closeLore();

      return;

    }

    if (isMapOpen) {

      toggleMap();

      return;

    }

    if (isInventoryOpen) {

      toggleInventory();

      return;

    }

    if (isQuestLogOpen) {

      toggleQuestLog();

      return;

    }

    togglePause();

    return;

  }

  // Inventory toggle

  if (k === 'i' || k === 'tab') {

    e.preventDefault();

    toggleInventory();

    return;

  }

  // Lore Codex toggle ([L])

  if (k === 'l') {

    e.preventDefault();

    toggleLoreCodex();

    return;

  }

  // Retrocausal rewind ([B]) - Relativity Cloister

  if (k === 'b' && currentSceneId.startsWith('RS')) {

    e.preventDefault();

    if (rewindCooldown > 0) { showToast('Rewind on cooldown'); return; }

    if (positionHistory.length < 2) { showToast('No rewind point available'); return; }

    // Find position ~3 seconds ago

    const now = performance.now();

    const target = positionHistory.find((p) => now - p.t >= 3000) || positionHistory[0];

    if (target) {

      playerState.x = target.x;

      playerState.z = target.z;

      playerMesh.position.set(target.x, 0.6, target.z);

      physics.teleportPlayer({ x: target.x, y: 0.6, z: target.z });

      engine.cameraRig.setTarget(target.x, 0, target.z);

      rewindCooldown = 10;

      SoundFX.playEchoBell();

      cameraShake = 0.2;

      showToast('Retrocausal Rewind: Position Reverted');

      positionHistory.length = 0;

    }

    return;

  }

  // Cartography Map toggle ([M])

  if (k === 'm') {

    toggleMap();

    return;

  }

  // Auto-battler toggle ([P])

  if (k === 'p') {

    e.preventDefault();

    toggleAutoBattler();

    return;

  }

    if (k === 't') {
      e.preventDefault();
      cycleNextWeapon();
      return;
    }

  // Movement keys

  if (k === 'w' || k === 'arrowup') playerState.keys.w = true;

  if (k === 's' || k === 'arrowdown') playerState.keys.s = true;

  if (k === 'a' || k === 'arrowleft') playerState.keys.a = true;

  if (k === 'd' || k === 'arrowright') playerState.keys.d = true;

  if (e.key === 'Shift') playerState.keys.shift = true;

  // Actions

  if (k === ' ') tryAttack();

  if (k === 'x') tryParry();

  if (k === 'e') interact();

  if (k === 'q') quality.cycle();

  if (k === 't') throwDistraction();

  if (k === 'c' && (currentSceneId === 'AL1' || currentSceneId === 'AL2' || currentSceneId === 'AL3')) toggleCrafting();

  // Relic: Truth Lens ([Q] hold)

  if (k === 'q' && !truthLensActive) {

    truthLensActive = true;

    awardConviction('rationalism', 1, `truth-lens:${currentSceneId}`);

    truthLensOverlay?.classList.add('active');

    SoundFX.startTruthLensHum();

    playerLight.color.setHex(0xa855f7);

    playerLight.intensity = 2.6;

    showToast('Truth Lens Activated: Ethereal Resonance');

  }

  // Relic: Echo Bell ([F] tap)

  if (k === 'f') {

    SoundFX.playEchoBell();

    cameraShake = 0.08;

    triggerEchoBellRing(playerMesh.position);

    showToast('Echo Bell: Resonance Pulse Dispatched');

  }

  // Spells & Stealth Keys

  if (e.key === 'Control') playerState.keys.ctrl = !playerState.keys.ctrl;

  if (k === 'r' || k === '1') castMirrorDecoy();

  if (k === 'c') castShadowStep();

  if (k === 'v') castGlassDart();

  // Quest Log / Journal ([J])

  if (k === 'j') {

    toggleQuestLog();

  }

});

window.addEventListener('keyup', (e) => {

  const k = e.key.toLowerCase();

  if (k === 'w' || k === 'arrowup') playerState.keys.w = false;

  if (k === 's' || k === 'arrowdown') playerState.keys.s = false;

  if (k === 'a' || k === 'arrowleft') playerState.keys.a = false;

  if (k === 'd' || k === 'arrowright') playerState.keys.d = false;

  if (e.key === 'Shift') playerState.keys.shift = false;

  // Relic: Truth Lens release

  if (k === 'q' && truthLensActive) {

    truthLensActive = false;

    truthLensOverlay?.classList.remove('active');

    SoundFX.stopTruthLensHum();

    playerLight.color.setHex(0xfef08a);

    playerLight.intensity = 1.8;

  }

});

window.addEventListener('blur', () => {

  playerState.keys = { w: false, a: false, s: false, d: false, shift: false, ctrl: false };

  if (truthLensActive) {

    truthLensActive = false;

    truthLensOverlay?.classList.remove('active');

    SoundFX.stopTruthLensHum();

    playerLight.color.setHex(0xfef08a);

    playerLight.intensity = 1.8;

  }

});

GlobalEventBus.on('ZONE_ENTER', (data) => console.log(`Entering zone: ${data.zoneId}`));

GlobalEventBus.emit('ZONE_ENTER', { zoneId: 'outer', spawnTile: [0, 3] });

// Title screen gate. "New Game" reloads with a one-shot session flag so the

// boot below starts a clean run instead of restoring the autosave that the

// previous boot just wrote (which used to make fresh profiles unstartable).

const NEW_RUN_FLAG = 'veilkeep.newrun';

const startingNewRun = sessionStorage.getItem(NEW_RUN_FLAG) === '1';

if (startingNewRun) {

  sessionStorage.removeItem(NEW_RUN_FLAG);

  localStorage.removeItem('veilkeep.save.v1');

  localStorage.removeItem('veilkeep.origin.v1');

}

// ---------- URL-driven autoplay boot (?autoplay=1&speed=4&mode=full_campaign) ----------

const autoplayParams = new URLSearchParams(location.search);

const autoplayQueryValue = (autoplayParams.get('autoplay') ?? '').toLowerCase();

const autoplayRequested = autoplayQueryValue === '1' || autoplayQueryValue === 'true' || autoplayQueryValue === 'yes';

function autoplayQuerySpeed(): number {

  const raw = Number(autoplayParams.get('speed') ?? '1');

  return Number.isFinite(raw) && raw > 0 ? raw : 1;

}

function autoplayQueryMode(): AutoplayMode {

  const raw = (autoplayParams.get('mode') ?? 'full_campaign') as AutoplayMode;

  const allowed: AutoplayMode[] = ['mvp_slice', 'full_campaign', 'pacifist_shadowhand', 'all_quests'];

  return allowed.includes(raw) ? raw : 'full_campaign';

}

const hadSaveAtBoot = !!localStorage.getItem('veilkeep.save.v1') || !!localStorage.getItem('veilkeep.origin.v1');

const titlePromise = new Promise<void>((resolve) => {

  const screen = document.getElementById('title-screen');

  const newBtn = document.getElementById('title-new-game');

  const contBtn = document.getElementById('title-continue');

  const dismissTitle = (): void => {

    if (screen) screen.style.display = 'none';

    resolve();

  };

  if (newBtn) newBtn.addEventListener('click', () => {

    sessionStorage.setItem(NEW_RUN_FLAG, '1');

    location.reload();

  });

  if (contBtn) contBtn.addEventListener('click', dismissTitle);

  if (startingNewRun || autoplayRequested) dismissTitle();

  else if (!hadSaveAtBoot && contBtn) contBtn.style.display = 'none';

});

// Boot from checkpoint if present, otherwise start at S00.

const saved = localStorage.getItem('veilkeep.save.v1');

let resumed = false;

let restoredFromSave = false;

if (saved) {

  try {

    const data = JSON.parse(saved) as {

      scene: SceneId;

      pos: number[];

      inventory: string[];

      puzzles: string[];

      abilities: string[];

      discovered?: SceneId[];

      convictions?: Partial<Record<ConvictionAxis, number>>;

      convictionAwards?: string[];

      origin?: string;

      originTraits?: string[];

      stats?: Record<string, number>;

      flags?: Record<string, boolean | number>;

      quests?: string[];

      questRuntime?: ReturnType<typeof questRuntime.serialize>;

    };

    data.inventory.forEach((i) => inventory.add(i));

    data.puzzles.forEach((p) => solvedPuzzles.add(p));

    data.abilities.forEach((a) => abilities.add(a));

    if (data.convictions) Object.assign(convictions, data.convictions);

    if (data.convictionAwards) data.convictionAwards.forEach((reason) => convictionAwards.add(reason));

    if (data.discovered) data.discovered.forEach((d) => discoveredScenes.add(d));

    if (data.stats) Object.assign(stats, data.stats);

    if (data.flags) playerOrigin.flags = { ...data.flags };

    if (data.originTraits) playerOrigin.traits = [...data.originTraits];

    if (data.origin) playerOrigin.id = data.origin;

    if (data.questRuntime) questRuntime.restore(data.questRuntime);

    restoredFromSave = true;

    if (sceneById.has(data.scene)) {

      loadScene(data.scene, { x: data.pos[0], y: data.pos[1], z: data.pos[2] });

      resumed = true;

    }

  } catch {

    localStorage.removeItem('veilkeep.save.v1');

  }

}

if (!resumed) loadScene('S00', initialSpawn);

const savedOrigin = localStorage.getItem('veilkeep.origin.v1');

titlePromise.then(() => {

  const bootEngine = (): void => {

    engine.start();

    console.log('VEILKEEP slice running: WASD move, Space attack, E interact, M cartography map. Progress autosaves on transitions.');

    if (autoplayRequested) startAutoplayFromQuery();

  };

  if (savedOrigin) {

    applyOrigin(savedOrigin, !restoredFromSave);

    bootEngine();

    return;

  }

  if (autoplayRequested) {

    // Hands-free boot: no human is present to choose an origin.

    applyOrigin('ORIGIN_ALCHEMIST');

    bootEngine();

    return;

  }

  showOriginSelector().then((origin) => {

    applyOrigin(origin);

    bootEngine();

  });

});

// Touch / mobile controls

function setupTouchControls(): void {

  const joystick = document.getElementById('joystick');

  const knob = document.getElementById('joystick-knob');

  const buttons = document.querySelectorAll<HTMLButtonElement>('#action-buttons button');

  if (!joystick || !knob) return;

  let activeTouchId: number | null = null;

  let center = { x: 0, y: 0 };

  const radius = 55;

  function updateKeysFromVector(dx: number, dy: number): void {

    playerState.keys.w = dy < -0.35;

    playerState.keys.s = dy > 0.35;

    playerState.keys.a = dx < -0.35;

    playerState.keys.d = dx > 0.35;

  }

  joystick.addEventListener('touchstart', (e) => {

    if (activeTouchId !== null) return;

    const t = e.changedTouches[0];

    activeTouchId = t.identifier;

    const rect = joystick.getBoundingClientRect();

    center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    e.preventDefault();

  }, { passive: false });

  joystick.addEventListener('touchmove', (e) => {

    if (activeTouchId === null) return;

    const t = Array.from(e.changedTouches).find((touch) => touch.identifier === activeTouchId);

    if (!t) return;

    let dx = t.clientX - center.x;

    let dy = t.clientY - center.y;

    const len = Math.hypot(dx, dy);

    if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }

    knob.style.left = `calc(50% + ${dx}px)`;

    knob.style.top = `calc(50% + ${dy}px)`;

    updateKeysFromVector(dx / radius, dy / radius);

    e.preventDefault();

  }, { passive: false });

  const resetJoystick = (): void => {

    activeTouchId = null;

    knob.style.left = '50%';

    knob.style.top = '50%';

    playerState.keys.w = false;

    playerState.keys.a = false;

    playerState.keys.s = false;

    playerState.keys.d = false;

  };

  joystick.addEventListener('touchend', resetJoystick, { passive: false });

  joystick.addEventListener('touchcancel', resetJoystick, { passive: false });

  buttons.forEach((btn) => {

    const key = btn.dataset.key || '';

    const dispatch = (type: 'keydown' | 'keyup') => {

      const k = key === ' ' ? ' ' : key.toLowerCase();

      window.dispatchEvent(new KeyboardEvent(type, { key: k, code: k === ' ' ? 'Space' : k.toUpperCase() }));

    };

    btn.addEventListener('touchstart', (e) => { dispatch('keydown'); e.preventDefault(); }, { passive: false });

    btn.addEventListener('touchend', () => dispatch('keyup'), { passive: false });

  });

}

setupTouchControls();

// Manual save slots in the pause menu

function createSaveSlots(): void {

  const pauseBody = document.querySelector('.pause-body');

  if (!pauseBody) return;

  const section = document.createElement('div');

  section.style.cssText = 'margin-top:14px;border-top:1px solid rgba(212,175,55,.3);padding-top:12px;';

  section.innerHTML = '<div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Manual Save Slots</div>';

  for (let i = 1; i <= 3; i++) {

    const row = document.createElement('div');

    row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';

    const saveBtn = document.createElement('button');

    saveBtn.className = 'pause-btn';

    saveBtn.textContent = `Save Slot ${i}`;

    saveBtn.addEventListener('click', () => {

      const data = {

        scene: currentSceneId,

        pos: [playerState.x, 0.6, playerState.z],

        inventory: [...inventory],

        puzzles: [...solvedPuzzles],

        abilities: [...abilities],

        origin: playerOrigin.id,

        stats,

      };

      localStorage.setItem(`veilkeep.save.slot${i}`, JSON.stringify(data));

      showToast(`Saved to Slot ${i}`);

    });

    const loadBtn = document.createElement('button');

    loadBtn.className = 'pause-btn';

    loadBtn.textContent = `Load Slot ${i}`;

    loadBtn.addEventListener('click', () => {

      const raw = localStorage.getItem(`veilkeep.save.slot${i}`);

      if (!raw) { showToast(`Slot ${i} empty`); return; }

      try {

        const data = JSON.parse(raw) as { scene: SceneId; pos: number[]; inventory: string[]; puzzles: string[]; abilities: string[]; origin: string; stats: typeof stats };

        inventory.clear();

        data.inventory.forEach((item) => inventory.add(item));

        solvedPuzzles.clear();

        data.puzzles.forEach((puzzle) => solvedPuzzles.add(puzzle));

        abilities.clear();

        data.abilities.forEach((ability) => abilities.add(ability));

        Object.assign(stats, data.stats);

        playerOrigin.id = data.origin;

        loadScene(data.scene, { x: data.pos[0], y: data.pos[1], z: data.pos[2] });

        togglePause(false);

        showToast(`Loaded Slot ${i}`);

      } catch {

        showToast('Load failed');

      }

    });

    row.appendChild(saveBtn);

    row.appendChild(loadBtn);

    section.appendChild(row);

  }

  pauseBody.appendChild(section);

}

createSaveSlots();

document.getElementById('craft-close-btn')?.addEventListener('click', () => toggleCrafting());

// Lightweight debug hook for smoke tests and future MCP inspection.

/** One-call snapshot for automated QA (Playwright, MCP, WebView probes). */

function getDiagnostics(): {

  currentSceneId: SceneId;

  playerPos: { x: number; y: number; z: number };

  fps: number;

  drawCalls: number;

  triangles: number;

  geometries: number;

  textures: number;

  activeQuests: string[];

  completedQuests: string[];

  consoleErrors: string[];

} {

  return {

    currentSceneId,

    playerPos: { x: playerState.x, y: playerMesh.position.y, z: playerState.z },

    fps: quality.currentFps,

    drawCalls: engine.renderer.info.render.calls,

    triangles: engine.renderer.info.render.triangles,

    geometries: engine.renderer.info.memory.geometries,

    textures: engine.renderer.info.memory.textures,

    activeQuests: questLog.active,

    completedQuests: questLog.completed,

    consoleErrors: [...runtimeErrors],

  };

}

(window as unknown as { __veilkeep: unknown }).__veilkeep = {

  // Scene identity + live Three.js objects for visual verification.

  get scene() { return currentSceneId; },

  get sceneId() { return currentSceneId; },

  get sceneName() { return sceneById.get(currentSceneId)?.name ?? ''; },

  threeScene: engine.scene,

  renderer: engine.renderer,

  camera: engine.cameraRig.camera,

  player: playerMesh,

  // Deterministic game state.

  playerState,

  stats,

  playerOrigin,

  inventory,

  solvedPuzzles,

  abilities,

  discoveredScenes,

  questLog,

  convictions,

  questRuntime,

  origins: questRuntime.origins(),

  traits: questRuntime.traits(),

  encounters: questRuntime.encounters(),

  // Deterministic controls.

  loadScene,

  getDiagnostics,

  awardConviction,

  toggleMap,

  spawnDamagePopup,

  quality,

  physics,

  audioManager,

  exits: FORTRESS_EXITS,

  qa: {

    sceneIds: () => [...sceneById.keys()],

    spawnFor: (id: string) => sceneSpawn(id as SceneId),

    boundsFor: (id: string) => sceneById.get(id as SceneId)?.bounds ?? null,

    teleport: (x: number, z: number, y = 0.6) => {
      const matchDoor = (exits[currentSceneId] ?? []).find((d) => Math.hypot(d.x - x, d.z - z) < 0.6);
      const target = matchDoor ? getEffectiveDoorPos(currentSceneId, matchDoor) : { x, z };
      physics.teleportPlayer({ x: target.x, y, z: target.z });
      playerState.x = target.x;
      playerState.z = target.z;
      playerMesh.position.set(target.x, y, target.z);
      exitCooldown = 0;
    },

    refreshColliders: () => {
      refreshRoomColliders();
    },

    stepPhysics: (ticks: number) => {

      let pos = physics.movePlayer(0, 0);

      for (let i = 1; i < ticks; i++) pos = physics.movePlayer(0, 0);

      return { x: pos.x, y: pos.y, z: pos.z };

    },

    setHealth: (hp: number) => {

      playerHP = Math.max(0, Math.min(100, hp));

    },

    clearExitCooldown: () => {

      exitCooldown = 0;

    },

    // ---------- Quest, puzzle, origin and encounter verification ----------

    health: () => playerHP,

    getStats: () => ({ ...stats }),

    setStats: (next: Record<string, number>) => {

      Object.assign(stats, next);

      return { ...stats };

    },

    getOrigin: () => ({ ...playerOrigin, traits: [...playerOrigin.traits], flags: { ...playerOrigin.flags } }),

    getFlags: () => ({ ...playerOrigin.flags }),

    applyOrigin: (id: string) => {

      applyOrigin(id);

      return { ...stats };

    },

    applyTraits: (ids: string[]) => applyTraits(ids),

    resetStats: () => {

      resetStats();

      return { ...stats };

    },

    puzzles: () => questRuntime.puzzles(),

    puzzleAt: (sceneId: string, x: number, z: number) => questRuntime.puzzleAt(sceneId, x, z),

    attemptPuzzle: (puzzleId: string, method: string) => questRuntime.attempt(puzzleId, method),

    rotateMirror: (degrees: number) => questRuntime.rotateMirror(degrees),

    mirrorAngle: () => questRuntime.mirrorAngle,

    resetMirror: () => questRuntime.resetMirror(),

    interactLever: (puzzleId: string, leverId: string) => questRuntime.interactLever(puzzleId, leverId),

    collectPickup: (id: string) => questRuntime.collectPickup(id),

    collectShard: (id: string) => questRuntime.collectShard(id),

    memoryShards: () => questRuntime.memoryShards,

    memoryShardCount: () => questRuntime.memoryShardCount,

    encounters: () => questRuntime.encounters(),

    resolveEncounter: (encounterId: string, approach: 'lethal' | 'non-lethal', method?: string) =>

      questRuntime.resolve(encounterId, approach, method),

    encounterResult: (encounterId: string) => questRuntime.encounterResult(encounterId),

    kills: () => questRuntime.kills,

    humanKills: () => questRuntime.humanKills,

    achievements: () => questRuntime.achievements,

    hasAchievement: (id: string) => questRuntime.hasAchievement(id),

    setSkill: (name: string, level: number) => questRuntime.setSkill(name, level),

    setFlag: (id: string, value: boolean | number) => questRuntime.setFlag(id, value),

    flag: (id: string) => questRuntime.flag(id),

    completeQuest: (id: string) => questRuntime.completeQuest(id),

    getConvictions: () => ({ ...convictions }),

    awardConviction: (axis: 'empathy' | 'rationalism' | 'solipsism', amount = 1, reason = '') => {

      awardConviction(axis, amount, reason);

      return { ...convictions };

    },

    getQuestLog: () => ({ objectives: questLog.objectives, active: questLog.active, completed: questLog.completed }),

    serializeRuntime: () => questRuntime.serialize(),

    restoreRuntime: (data: ReturnType<typeof questRuntime.serialize>) => {

      questRuntime.restore(data);

      return questRuntime.serialize();

    },

    skillLevel: (name: string) => questRuntime.skillLevel(name),

    triggerSteamJam: (sceneId = 'GH1', x = 0, z = -2) => questRuntime.triggerSteamJam(sceneId, x, z),

    clearSteamJam: () => questRuntime.clearSteamJam(),

    steamJam: () => questRuntime.steamJam,

    hazardDamageAt: (sceneId: string, x: number, z: number) => questRuntime.hazardDamageAt(sceneId, x, z),

    portcullisPassable: () => questRuntime.portcullisPassable,

    completedQuests: () => questRuntime.completedQuests,

    isQuestComplete: (id: string) => questRuntime.isQuestComplete(id),

    openPuzzlePanel: (puzzleId: string) => openPuzzlePanel(puzzleId),

    closePuzzlePanel: () => closePuzzlePanel(),

    saveNow: () => saveCheckpoint(),

    clearSave: () => {

      localStorage.removeItem('veilkeep.save.v1');

      localStorage.removeItem('veilkeep.origin.v1');

    },

    defeatCaptain: () => {

      const resolution = questRuntime.resolve('ENC_GH3_CAPTAIN', 'lethal');

      abilities.add('ABILITY_WALL_LEAP');

      inventory.add('ITEM_GATEHOUSE_KEY');

      questRuntime.completeQuest('Q_GATEKEEPER_DOUBT');

      if (captain && currentSceneId === 'GH3') {

        const px = captain.mesh.position.x;

        const pz = captain.mesh.position.z + 1.0;

        physics.teleportPlayer({ x: px, y: 0.6, z: pz });

        playerState.x = px;

        playerState.z = pz;

        playerMesh.position.set(px, 0.6, pz);

        captain.hp = 0;

        tryAttack();

      }

      saveCheckpoint();

      return resolution;

    },

    resetRun: (originId = 'ORIGIN_ALCHEMIST') => {

      inventory.clear();

      abilities.clear();

      solvedPuzzles.clear();

      discoveredScenes.clear();

      discoveredScenes.add('S00');

      convictions.empathy = 0;

      convictions.rationalism = 0;

      convictions.solipsism = 0;

      convictionAwards.clear();

      questRuntime.reset();

      if (activeDialogue) closeDialogue();

      closePuzzlePanel();

      playerOrigin.id = '';

      playerOrigin.traits = [];

      playerOrigin.flags = {};

      playerOrigin.tag = '';

      playerOrigin.staggerBonus = 0;

      playerOrigin.socialDisguise = false;

      playerOrigin.cursePenaltyReduction = 0;

      playerHP = 100;

      resetStats();

      applyOrigin(originId);

      loadScene('S00', sceneSpawn('S00'));

      saveCheckpoint();

      return { origin: originId, stats: { ...stats } };

    },

    showEnding: (type?: string) => {
      openEndingModal();
      if (type) renderEndingEpilogue(type);
    },

    closeEnding: () => {
      isEndingModalOpen = false;
      if (endingModal) endingModal.style.display = 'none';
    },

    isEndingOpen: () => isEndingModalOpen,

  },

  auto: {

    get enabled() { return autoEnabled; },

    get status() { return autoStatus; },

    get scene() { return currentSceneId; },

    get goal() { return autoGoalId; },

    get task() { return autoTaskId; },

    get visited() { return [...autoVisited]; },

    get visitedCount() { return autoVisited.size; },

    get cleared() { return [...autoCleared]; },

    get tasksDone() { return completedTaskCount(autoProgress()); },

    get totalTasks() { return TOTAL_TASKS; },

    get route() { return [...autoRoute]; },

    get error() { return autoLastError; },

    get nudges() { return autoNudges; },

    get dialogue() { return activeDialogue ? { ...activeDialogue } : null; },

    toggle: (force?: boolean) => toggleAutoBattler(force),

    enable: () => toggleAutoBattler(true),

    disable: () => toggleAutoBattler(false),

  },

};

// ---------- Phase 2: deterministic full-game autoplay host ----------

/**

 * Adapter that lets `AutoplayController` drive the real game. Everything here

 * is a thin mapping onto systems that already exist, so the controller stays

 * unit-testable and there is exactly one movement authority.

 */

/**

 * Fires a traversal brand. The fortress implements wall-leap / air-dash /

 * gravity-inversion / mirror-phase as gated room interactions, so triggering a

 * brand means performing that interaction from the current position.

 */

function castMovementBrand(brand: string): boolean {

  if (!abilities.has(brand)) return false;

  const entry = ITEM_LORE_DATABASE[brand];

  const label = entry?.name ?? brand.replace(/^ABILITY_/, '').replace(/_/g, ' ').toLowerCase();

  showToast(`Autoplay traversal: ${label}`);

  SoundFX.playShadowStep();

  cameraShake = 0.12;

  interact(true);

  return true;

}

const autoplayHost: AutoplayHost = {

  getSceneId: () => currentSceneId,

  getPosition: () => ({ x: playerState.x, y: playerMesh.position.y, z: playerState.z }),

  getState: () => autoProgress(),

  getObstacles: () => autoObstacles(),

  planRoute: (from, to) =>

    planRoute(from, to, FORTRESS_EXITS, (door) =>

      doorRequirementsMet(door.requires ?? [], inventory, solvedPuzzles, abilities)),

  doorAt: (sceneId, to) => {

    const door = (FORTRESS_EXITS[sceneId] ?? []).find((d) => d.to === to);

    return door ? getEffectiveDoorPos(sceneId, door) : null;

  },

  getBounds: () => {
    const { hw, hh } = getRoomHalfExtents(currentSceneId);
    return { minX: -hw + 0.5, maxX: hw - 0.5, minZ: -hh + 0.5, maxZ: hh - 0.5 };
  },

  sceneExists: (id) => sceneById.has(id as SceneId),

  setInput: (x, z) => { autoInput = { x, z }; },

  navigate: (x, z, radius, dt) => autoNavigate(x, z, radius, dt),

  interact: () => interact(true),

  attack: () => tryAttack(),

  nearestGuard: () => {

    const guard = autoNearestGuard();

    if (!guard) return null;

    return {

      x: guard.mesh.position.x,

      z: guard.mesh.position.z,

      distance: Math.hypot(guard.mesh.position.x - playerState.x, guard.mesh.position.z - playerState.z),

    };

  },

  hasDialogue: () => !!activeDialogue,

  advanceDialogue: (dt) => autoDialogueTick(dt),

  castMovementBrand: (brand) => castMovementBrand(brand),

  isEndingOpen: () => isEndingModalOpen,

  showEnding: () => openEndingModal(),

  closeEnding: () => {

    isEndingModalOpen = false;

    if (endingModal) endingModal.style.display = 'none';

  },

  markCleared: (sceneId) => autoCleared.add(sceneId as SceneId),

  markVisited: (sceneId) => { autoVisited.add(sceneId as SceneId); },
  probeClearance: (from, to) => physics.probeClearance(from, to),
  nudge: () => {
    autoNudgeUntil = performance.now() + 500;
    autoPath = [];

    autoPathTarget = null;
    autoRepathTimer = 0;

  },

  setSpeedMultiplier: (multiplier) => { autoplaySpeedScale = multiplier; },

  toast: (message) => showToast(message),

  questState: () => ({ active: questLog.active, completed: questLog.completed, total: questObjectives().length }),

};

const autoplayController = new AutoplayController(autoplayHost);

(window as unknown as { __veilkeep: { autoplay: AutoplayController } }).__veilkeep.autoplay = autoplayController;

// ---------- HUD toggle (🤖 Autoplay) ----------

const autoplayButton = document.getElementById('autoplay-toggle');

function syncAutoplayButton(): void {

  if (!autoplayButton) return;

  const running = autoplayController.running;

  autoplayButton.classList.toggle('active', running);

  autoplayButton.textContent = running ? '⏹ Autoplay' : '🤖 Autoplay';

  autoplayButton.title = running

    ? `Autoplay ${autoplayController.modeName} @ ${autoplayController.speed}x — click to stop`

    : 'Play the game hands-free';

}

autoplayButton?.addEventListener('click', () => {

  if (autoplayController.running) autoplayController.stop();

  else autoplayController.start({ mode: autoplayQueryMode(), speedMultiplier: autoplayQuerySpeed() });

  syncAutoplayButton();

});

setInterval(syncAutoplayButton, 500);

/** Boot path for `?autoplay=1&speed=4&mode=full_campaign`. */

function startAutoplayFromQuery(): void {

  const started = autoplayController.start({

    mode: autoplayQueryMode(),

    speedMultiplier: autoplayQuerySpeed(),

  });

  if (!started) console.warn('[autoplay] could not start from URL query');

  syncAutoplayButton();

}

syncAutoplayButton();

