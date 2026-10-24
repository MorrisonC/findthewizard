import * as THREE from 'three';
import { GameEngine } from './core/Engine';
import { ASSETS } from './core/AssetManifest';
import { GlobalEventBus } from './core/EventBus';
import { RapierPhysics } from './physics/PhysicsWorld';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SoundFX } from './core/SoundFX';
import worldManifest from './data/world_manifest.json';

import itemsData from './data/items.json';
import questsData from './data/quests.json';
import puzzlesData from './data/puzzles.json';
import zonesData from './data/zones.json';
import dialogueData from './data/dialogue.json';

console.log('⚔️ VEILKEEP Initialized with:');
console.log(`- ${itemsData.length} items`);
console.log(`- ${questsData.length} quests (7 Main, 31 Side, 4 Hidden)`);
console.log(`- ${puzzlesData.length} illusionist puzzles`);
console.log(`- ${zonesData.length} fortress zones`);

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudZone = document.getElementById('hud-zone-name');
const hudQuest = document.getElementById('hud-active-quest');
const hpFill = document.querySelector('.bar-fill-hp') as HTMLElement | null;
const hudToast = document.getElementById('hud-toast');
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

function spawnDamagePopup(pos: { x: number; y: number; z: number }, text: string, isCrit = false): void {
  if (!damageContainer) return;
  const tempV = new THREE.Vector3(pos.x, pos.y + 0.8, pos.z);
  tempV.project(engine.cameraRig.camera);
  const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-(tempV.y * 0.5) + 0.5) * window.innerHeight;
  const el = document.createElement('div');
  el.className = 'damage-popup';
  el.textContent = text;
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  if (isCrit) {
    el.style.color = '#f59e0b';
    el.style.fontSize = '20px';
  }
  damageContainer.appendChild(el);
  setTimeout(() => el.remove(), 800);
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
type SceneId = 'S00' | 'OW1' | 'GH1' | 'GH2' | 'GH3' | 'HM1' | 'BQ1' | 'AG1' | 'MH1' | 'SAN1';
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
  hpBarEl?: HTMLDivElement;
  hpFillEl?: HTMLDivElement;
  hpBarTimer?: number;
}
interface ExitTrigger {
  x: number;
  z: number;
  to: SceneId;
  spawn?: Spawn;
  requires: string[];
}

const sceneById = new Map(worldManifest.scenes.map((scene) => [scene.id as SceneId, scene]));
const sceneSpawn = (id: SceneId): Spawn => {
  const scene = sceneById.get(id)!;
  return { x: scene.spawn[0], y: scene.spawn[1], z: scene.spawn[2] };
};

let currentSceneId: SceneId = 'S00';
const inventory = new Set<string>();
const solvedPuzzles = new Set<string>();
const abilities = new Set<string>();
let playerHP = 100;
let exitCooldown = 0;
let lockedMessageCooldown = 0;

const initialSpawn = sceneSpawn('S00');
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
  keys: { w: false, a: false, s: false, d: false, shift: false, ctrl: false },
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
let vaelorPhase2Triggered = false;

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
  const objs = [
    { desc: 'Infiltrate the Sunken Courtyard (S00)', done: true },
    { desc: 'Acquire Cold-Iron Nail Relic (OW1)', done: inventory.has('ITEM_IRON_NAIL') },
    { desc: 'Shatter Gatehouse Mirror Lock (GH2)', done: solvedPuzzles.has('PUZZLE_MIRROR_LOCK') },
    { desc: 'Neutralize Barbican Captain (GH3)', done: abilities.has('ABILITY_WALL_LEAP') },
    { desc: 'Infiltrate the Halls of Mirrors (HM1)', done: currentSceneId === 'HM1' },
    { desc: 'Shatter True Mirror & Banish Wraith (HM1)', done: solvedPuzzles.has('PUZZLE_TRUE_MIRROR') },
    { desc: 'Dispel the Cenacle Feast & Free Morvath (BQ1)', done: solvedPuzzles.has('PUZZLE_FEAST_SATIETY') },
    { desc: 'Commune with Yggdra the Ancient Bough (AG1)', done: solvedPuzzles.has('PUZZLE_ARBOREAL_WEAVE') },
    { desc: 'Solve Mother Hazel\'s Hospitality Gambit (MH1)', done: solvedPuzzles.has('PUZZLE_HOSPITALITY_GAMBIT') },
    { desc: 'Shatter Vaelor\'s Glass Heart & Liberate Cynthia (SAN1)', done: solvedPuzzles.has('PUZZLE_HOLLOW_GLASS') }
  ];
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
  cameraShake = 0.15;

  const dashDist = 3.2;
  const dx = Math.sin(playerMesh.rotation.y) * dashDist;
  const dz = Math.cos(playerMesh.rotation.y) * dashDist;
  const nextPos = physics.movePlayer(dx, dz);
  playerState.x = nextPos.x;
  playerState.z = nextPos.z;
  playerMesh.position.set(nextPos.x, nextPos.y, nextPos.z);
  flashMesh(playerMesh, 0x7c3aed, 220);
  showToast('Spell: Shadow Step');
}

// Spell 3: Glass Dart ([V])
function castGlassDart(): void {
  if (playerState.fp < 15) {
    showToast('Insufficient Focus Points (Requires 15 FP)');
    SoundFX.playLocked();
    return;
  }
  playerState.fp -= 15;
  SoundFX.playGlassDart();

  const geom = new THREE.ConeGeometry(0.08, 0.45, 6);
  geom.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.5,
    roughness: 0.1
  });
  const projectileMesh = new THREE.Mesh(geom, mat);
  projectileMesh.position.set(playerState.x, 0.8, playerState.z);
  projectileMesh.rotation.y = playerMesh.rotation.y;
  engine.scene.add(projectileMesh);

  const dir = new THREE.Vector3(Math.sin(playerMesh.rotation.y), 0, Math.cos(playerMesh.rotation.y)).normalize();
  activeProjectiles.push({
    mesh: projectileMesh,
    dir,
    distTraveled: 0,
    maxDist: 9.0
  });
  showToast('Spell: Glass Dart Thrown');
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
  }
};

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
];

function openLore(obj: LoreObject): void {
  if (!loreModal || !loreModalTitle || !loreText) return;
  loreModalTitle.textContent = obj.title;
  loreText.textContent = obj.text;
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
});

// Harmonic Parry Stance
function tryParry(): void {
  if (parryTimer > 0) return;
  parryTimer = 0.35;
  parryBadge?.classList.add('active');
  SoundFX.playSlash();
  flashMesh(playerMesh, 0xf59e0b, 160);
}

const magicalBushes: {
  mesh: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  originalScale: THREE.Vector3;
  targetScale: THREE.Vector3;
}[] = [];

const engine = new GameEngine({
  canvas,
  onUpdate: (dt) => {
    // Pause movement during dialogue, inventory, quest log, lore archival, or pause menu
    let moveX = 0;
    let moveZ = 0;
    if (!activeDialogue && !isInventoryOpen && !isQuestLogOpen && !isLoreOpen && !isPaused) {
      if (playerState.keys.w) { moveX -= 1; moveZ -= 1; }
      if (playerState.keys.s) { moveX += 1; moveZ += 1; }
      if (playerState.keys.a) { moveX -= 1; moveZ -= 1; }
      if (playerState.keys.d) { moveX += 1; moveZ += 1; }
    }

    // Parry Timer Stance Update
    if (parryTimer > 0) {
      parryTimer -= dt;
      if (parryTimer <= 0) {
        parryBadge?.classList.remove('active');
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
    if (playerState.keys.shift && isMoving && playerState.stamina > 2 && !playerState.isSneaking && !activeDialogue && !isInventoryOpen && !isQuestLogOpen && !isLoreOpen && !isPaused) {
      playerState.isSprinting = true;
      playerState.speed = 8.4;
      playerState.stamina = Math.max(0, playerState.stamina - 28 * dt);
    } else {
      playerState.isSprinting = false;
      playerState.speed = playerState.isSneaking ? 3.2 : 5.5;
      playerState.stamina = Math.min(playerState.maxStamina, playerState.stamina + 20 * dt);
    }
    if (staFill) staFill.style.width = `${Math.round((playerState.stamina / playerState.maxStamina) * 100)}%`;

    // Footstep Sound Synthesis Cadence (Silent while sneaking)
    if (isMoving && !playerState.isSneaking && !activeDialogue && !isInventoryOpen && !isQuestLogOpen && !isLoreOpen && !isPaused) {
      footstepTimer -= dt;
      if (footstepTimer <= 0) {
        SoundFX.playFootstep(playerState.isSprinting);
        footstepTimer = playerState.isSprinting ? 0.22 : 0.36;
      }
    }

    // Music State Controller based on Enemy Alertness
    const anyEnemyChasing = (guard && guard.state === 'chase' && guard.sceneId === currentSceneId) ||
      (captain && captain.state === 'chase' && captain.sceneId === currentSceneId) ||
      (wraith && wraith.state === 'chase' && wraith.sceneId === currentSceneId) ||
      (treeGuardian && treeGuardian.state === 'chase' && treeGuardian.sceneId === currentSceneId) ||
      (vaelorBoss && vaelorBoss.state === 'chase' && vaelorBoss.sceneId === currentSceneId);
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

      const enemies = [guard, captain, wraith, treeGuardian, vaelorBoss].filter((g): g is Guard => !!g && g.state !== 'dead' && g.sceneId === currentSceneId);
      let hitTarget = false;
      for (const g of enemies) {
        const d = Math.hypot(g.mesh.position.x - p.mesh.position.x, g.mesh.position.z - p.mesh.position.z);
        if (d < 0.9) {
          hitTarget = true;
          g.hp -= 20;
          SoundFX.playGlassShatter();
          flashMesh(g.mesh, 0x67e8f9, 140);
          spawnDamagePopup(g.mesh.position, '-20 HP');
          g.hpBarTimer = 3.5;

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
        if (parryTimer > 0) {
          SoundFX.playParry();
          cameraShake = 0.18;
          spawnDamagePopup(playerMesh.position, 'BOLT REFLECTED!', true);
          flashMesh(playerMesh, 0xf59e0b, 180);
          showToast('Mirror Bolt Reflected with Harmonic Parry!');
        } else {
          playerHP -= 14;
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

    let nextPos = { x: playerState.x, y: 0.6, z: playerState.z };
    if (isMoving && !isPaused) {
      const len = Math.hypot(moveX, moveZ);
      nextPos = physics.movePlayer((moveX / len) * playerState.speed * dt, (moveZ / len) * playerState.speed * dt);
    } else {
      nextPos = physics.movePlayer(0, 0);
    }
    playerState.x = nextPos.x;
    playerState.z = nextPos.z;

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
        lore.mesh.rotation.y += 1.8 * dt;
        lore.mesh.position.y = lore.pos.y + Math.sin(Date.now() * 0.003) * 0.08;
      }
    }

    // Smooth player rotation to face movement direction
    if (moveX !== 0 || moveZ !== 0) {
      targetPlayerYaw = Math.atan2(moveX, moveZ);
    }
    let yawDiff = targetPlayerYaw - playerMesh.rotation.y;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    playerMesh.rotation.y += yawDiff * Math.min(1, 16 * dt);

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
      const dist = Math.hypot(bush.mesh.position.x - playerState.x, bush.mesh.position.z - playerState.z);
      if (dist < 2.5) {
        bush.targetScale.set(0.3, 0.08, 0.3);
        bush.mat.emissiveIntensity = THREE.MathUtils.lerp(bush.mat.emissiveIntensity, 0.1, 0.1);
      } else {
        bush.targetScale.copy(bush.originalScale);
        bush.mat.emissiveIntensity = THREE.MathUtils.lerp(bush.mat.emissiveIntensity, 0.85, 0.05);
      }
      bush.mesh.scale.lerp(bush.targetScale, 0.08);
    }

    // Interaction Proximity Detection
    let hasPrompt = false;

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
    }
    if (!hasPrompt) hideInteractPrompt();

    // Rotate Cynthia's Dodecahedron crystal in SAN1
    if (currentSceneId === 'SAN1' && cynthiaCrystal) {
      cynthiaCrystal.rotation.y += 0.8 * dt;
    }

    if (guard) updateGuard(guard, dt);
    if (captain) updateGuard(captain, dt);
    if (wraith) updateGuard(wraith, dt);
    if (treeGuardian) updateGuard(treeGuardian, dt);
    if (vaelorBoss) updateGuard(vaelorBoss, dt);

    if (exitCooldown > 0) exitCooldown -= dt;
    if (lockedMessageCooldown > 0) lockedMessageCooldown -= dt;
    checkExits();
  },
});

new THREE.TextureLoader().load(ASSETS.CONCEPT.SCENE00_APPROACH_SUNKEN, (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  engine.scene.background = tex;
  engine.scene.backgroundIntensity = 0.5;
});

// ---------- S00 authored courtyard ----------
const s00Group = new THREE.Group();
const gltfLoader = new GLTFLoader();
const [courtyardScene, kaelenModel, guardModel, roomShellModel, gateArchModel, mirrorLockModel] = await Promise.all([
  gltfLoader.loadAsync('/assets/models/s00_courtyard.glb').then((g) => g.scene),
  gltfLoader.loadAsync('/assets/models/kaelen.glb').then((g) => g.scene),
  gltfLoader.loadAsync('/assets/models/keep_guard.glb').then((g) => g.scene),
  gltfLoader.loadAsync('/assets/models/room_shell.glb').then((g) => g.scene),
  gltfLoader.loadAsync('/assets/models/gate_arch.glb').then((g) => g.scene),
  gltfLoader.loadAsync('/assets/models/mirror_lock.glb').then((g) => g.scene),
]);
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
  const bushGroup = new THREE.Group();
  bushGroup.position.set(x, 0.2, z);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, emissive: 0x7c3aed, emissiveIntensity: 0.85, roughness: 0.65, metalness: 0.2 });
  const thornMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65 * scaleMultiplier, 1), foliageMat);
  thornMesh.castShadow = true;
  thornMesh.receiveShadow = true;
  bushGroup.add(thornMesh);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0xa855f7, emissiveIntensity: 1.2, roughness: 0.2 });
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.25 * scaleMultiplier, 8, 8), coreMat);
  coreMesh.position.set(0, 0.3 * scaleMultiplier, 0);
  bushGroup.add(coreMesh);
  s00Group.add(bushGroup);
  const origScale = new THREE.Vector3(1, 1, 1);
  magicalBushes.push({ mesh: bushGroup, mat: foliageMat, originalScale: origScale, targetScale: origScale.clone() });
}
createMagicalBush(-2.2, -1.8, 1.2);
createMagicalBush(2.2, -1.8, 1.2);
createMagicalBush(-3.5, 0.5, 0.9);
createMagicalBush(3.5, 0.5, 0.9);
createMagicalBush(-1.2, 0.8, 0.7);
createMagicalBush(1.2, 0.8, 0.7);

function addS00Colliders(): void {
  physics.addStaticBox(6, 0.2, 6, 0, -0.2, 0);
  physics.addStaticBox(0.25, 2, 6.5, -6.2, 2, 0);
  physics.addStaticBox(0.25, 2, 6.5, 6.2, 2, 0);
  physics.addStaticBox(6.5, 2, 0.25, 0, 2, 6.2);
  physics.addStaticBox(6.5, 2, 0.25, 0, 2, -6.2);
  physics.addStaticBox(1.25, 3, 1, -4.5, 2.8, -5);
  physics.addStaticBox(1.25, 3, 1, 4.5, 2.8, -5);
  physics.addStaticBox(3.25, 2.25, 0.6, 0, 2.05, -5.4);
}

// ---------- Interactive NPC Entities ----------
let ravenMesh: THREE.Group | null = null;
let orinMesh: THREE.Group | null = null;

function createStarlightRaven(): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-2.5, 0.9, -4.8);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b,
    emissive: 0x4338ca,
    emissiveIntensity: 0.8,
    roughness: 0.4
  });
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 6), bodyMat);
  body.rotation.x = Math.PI / 4;
  body.castShadow = true;
  group.add(body);

  const headMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), headMat);
  head.position.set(0, 0.2, 0.14);
  group.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), eyeMat);
  eyeL.position.set(0.06, 0.22, 0.22);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 4), eyeMat);
  eyeR.position.set(-0.06, 0.22, 0.22);
  group.add(eyeL, eyeR);

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
  g.position.set(obj.pos.x, obj.pos.y, obj.pos.z);

  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd4af37,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), orbMat);
  orb.castShadow = true;
  g.add(orb);

  const light = new THREE.PointLight(0xd4af37, 1.2, 3.0);
  light.position.set(0, 0.2, 0);
  g.add(light);

  obj.mesh = g;
  return g;
}

// Add S00 Cynthia's Glass Rose Lore Orb
s00Group.add(createLoreOrb(loreObjects[0]));

function makeGuardMesh(color: number): THREE.Group {
  const mesh = guardModel.clone();
  mesh.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.material = node.material.clone();
      node.material.color.setHex(color);
    }
  });
  return mesh;
}

function createGuard(sceneId: SceneId, x: number, z: number, captainFlag = false): Guard {
  const mesh = makeGuardMesh(captainFlag ? 0xb91c1c : 0x7f1d1d);
  mesh.position.set(x, 0.6, z);
  const hp = captainFlag ? 80 : 40;

  // Floating enemy HP bar DOM elements
  const barEl = document.createElement('div');
  barEl.className = 'enemy-hp-bar';
  const fillEl = document.createElement('div');
  fillEl.className = 'enemy-hp-fill';
  barEl.appendChild(fillEl);
  damageContainer?.appendChild(barEl);

  return {
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
  };
}

function createMirrorWraith(sceneId: SceneId, x: number, z: number): Guard {
  const mesh = new THREE.Group();
  mesh.position.set(x, 1.1, z);

  const cloakMat = new THREE.MeshStandardMaterial({
    color: 0x2e1065,
    emissive: 0x3b0764,
    emissiveIntensity: 0.6,
    roughness: 0.35,
  });
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 8), cloakMat);
  cloak.castShadow = true;
  mesh.add(cloak);

  const headMat = new THREE.MeshStandardMaterial({
    color: 0x581c87,
    emissive: 0x7c3aed,
    emissiveIntensity: 1.1,
    roughness: 0.1,
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), headMat);
  head.position.set(0, 0.6, 0);
  head.castShadow = true;
  mesh.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), eyeMat);
  eyeL.position.set(0.08, 0.62, 0.16);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), eyeMat);
  eyeR.position.set(-0.08, 0.62, 0.16);
  mesh.add(eyeL, eyeR);

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

  return {
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
  };
}

function createBossVaelor(sceneId: SceneId, x: number, z: number): Guard {
  const mesh = new THREE.Group();
  mesh.position.set(x, 1.2, z);

  const robeMat = new THREE.MeshStandardMaterial({
    color: 0x312e81,
    emissive: 0x4338ca,
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 8), robeMat);
  robe.castShadow = true;
  mesh.add(robe);

  const haloMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 24), haloMat);
  halo.position.set(0, 0.95, 0);
  halo.rotation.x = Math.PI / 2;
  mesh.add(halo);

  const maskMat = new THREE.MeshStandardMaterial({
    color: 0xe0e7ff,
    emissive: 0x818cf8,
    emissiveIntensity: 0.7,
    metalness: 0.9,
    roughness: 0.1,
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), maskMat);
  head.position.set(0, 0.8, 0);
  mesh.add(head);

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

  return {
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
  };
}

function buildGenericScene(id: SceneId): THREE.Group {
  const group = new THREE.Group();
  const tint = id === 'OW1' ? 0x89a0aa
    : id === 'GH1' ? 0x9a86aa
    : id === 'GH2' ? 0x7f96b5
    : id === 'HM1' ? 0x6d28d9
    : id === 'BQ1' ? 0x881337
    : id === 'AG1' ? 0x065f46
    : id === 'MH1' ? 0x9a3412
    : id === 'SAN1' ? 0x1e1b4b
    : 0xa68196;

  const shell = roomShellModel.clone();
  shell.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      node.material = node.material.clone();
      node.material.color.multiply(new THREE.Color(tint).convertSRGBToLinear());
    }
  });
  group.add(shell);

  const northGate = gateArchModel.clone();
  northGate.position.set(0, 0, -5.2);
  northGate.scale.setScalar(0.75);
  northGate.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
  group.add(northGate);
  const southGate = gateArchModel.clone();
  southGate.position.set(0, 0, 5.2);
  southGate.scale.setScalar(0.75);
  southGate.rotation.y = Math.PI;
  southGate.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
  group.add(southGate);

  if (id === 'OW1') {
    ironNailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: 0xd4af37, emissive: 0xd4af37, emissiveIntensity: 0.7 }));
    ironNailMesh.position.set(2, 0.5, -1);
    group.add(ironNailMesh);

    // Gatekeeper Orin
    orinMesh = guardModel.clone();
    orinMesh.position.set(-2.2, 0.6, -1.8);
    orinMesh.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.material = node.material.clone();
        node.material.color.setHex(0x38bdf8);
      }
    });
    const orinLight = new THREE.PointLight(0x38bdf8, 1.0, 3.5);
    orinLight.position.set(0, 1.2, 0);
    orinMesh.add(orinLight);
    group.add(orinMesh);

    // OW1 Duke Vaelor's Despatch Lore Orb
    group.add(createLoreOrb(loreObjects[1]));

    guard = createGuard('OW1', 1.2, -2.2);
    group.add(guard.mesh);
  } else if (id === 'GH2') {
    mirrorMesh = mirrorLockModel.clone();
    mirrorMesh.position.set(0, 0.1, -2.5);
    mirrorMesh.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = true; });
    group.add(mirrorMesh);

    // GH2 Garrison Daguerreotype Lore Orb
    group.add(createLoreOrb(loreObjects[2]));
  } else if (id === 'GH3') {
    captain = createGuard('GH3', 0, -2.2, true);
    group.add(captain.mesh);
  } else if (id === 'HM1') {
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
    // The Cenacle of Eternal Satiety
    const tableTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.7, 6.2),
      new THREE.MeshStandardMaterial({ color: 0x271711, roughness: 0.4 })
    );
    tableTop.position.set(0, 0.35, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    group.add(tableTop);

    const cloth = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.05, 6.3),
      new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.7 })
    );
    cloth.position.set(0, 0.72, 0);
    group.add(cloth);

    // Silver tableware & candelabras
    for (let zi = -2.2; zi <= 2.2; zi += 0.88) {
      const plateL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 }));
      plateL.position.set(-0.7, 0.75, zi);
      const plateR = plateL.clone();
      plateR.position.set(0.7, 0.75, zi);
      group.add(plateL, plateR);

      const candelabra = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8 }));
      candelabra.position.set(0, 0.85, zi);
      const candleLight = new THREE.PointLight(0xf59e0b, 0.6, 2.5);
      candleLight.position.set(0, 0.25, 0);
      candelabra.add(candleLight);
      group.add(candelabra);
    }

    // Roast Boar illusion center-piece
    const isFeastDispelled = solvedPuzzles.has('PUZZLE_FEAST_SATIETY');
    banquetBoarMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.45, 1.2, 8),
      new THREE.MeshStandardMaterial({
        color: isFeastDispelled ? 0x374151 : 0xb45309,
        emissive: isFeastDispelled ? 0x111827 : 0xd97706,
        emissiveIntensity: 0.8,
        roughness: isFeastDispelled ? 0.9 : 0.3
      })
    );
    banquetBoarMesh.rotation.z = Math.PI / 2;
    banquetBoarMesh.position.set(0, 0.95, 0);
    banquetBoarMesh.castShadow = true;
    group.add(banquetBoarMesh);

    // Themis balance scale
    themisScaleMesh = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9 }));
    col.position.set(0, 1.0, -2.6);
    themisScaleMesh.add(col);
    group.add(themisScaleMesh);

    // Lord Morvath NPC
    morvathMesh = makeGuardMesh(0x7e22ce);
    morvathMesh.position.set(1.6, 0.6, -1.8);
    const morvathLight = new THREE.PointLight(0xca8a04, 1.2, 4);
    morvathLight.position.set(0, 1.2, 0);
    morvathMesh.add(morvathLight);
    group.add(morvathMesh);

    group.add(createLoreOrb(loreObjects[3]));
  } else if (id === 'AG1') {
    // The Ancient Bough
    yggdraMesh = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.5, 4.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 })
    );
    trunk.position.set(0, 2.1, 0);
    trunk.castShadow = true;
    yggdraMesh.add(trunk);

    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x38bdf8, emissiveIntensity: 1.8 })
    );
    eye.position.set(0, 2.4, 0.85);
    yggdraMesh.add(eye);

    const treeLight = new THREE.PointLight(0x06b6d4, 2.2, 7);
    treeLight.position.set(0, 2.5, 1.0);
    yggdraMesh.add(treeLight);

    yggdraMesh.position.set(0, 0, -2.8);
    group.add(yggdraMesh);

    // Thorny root wall blocking north portal
    rootWallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x2e1065, emissive: 0x3b0764, emissiveIntensity: 0.5, wireframe: true })
    );
    rootWallMesh.position.set(0, 1.2, -5.0);
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
    // Mother Hazel's Hearth
    const hearth = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.8, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 })
    );
    hearth.position.set(0, 0.9, -4.8);
    group.add(hearth);

    const hearthLight = new THREE.PointLight(0xf97316, 3.0, 7);
    hearthLight.position.set(0, 0.8, -4.3);
    group.add(hearthLight);

    kettleMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.4 })
    );
    kettleMesh.position.set(0, 0.6, -4.4);
    group.add(kettleMesh);

    // Dollhouse shelf with miniature porcelain figurines
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.8, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 })
    );
    shelf.position.set(-4.5, 0.4, 0);
    group.add(shelf);

    for (let di = -1.2; di <= 1.2; di += 0.5) {
      const doll = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.3, 6),
        new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xec4899, emissiveIntensity: 0.6 })
      );
      doll.position.set(-4.5, 0.95, di);
      group.add(doll);
    }

    hazelMesh = makeGuardMesh(0xbe123c);
    hazelMesh.position.set(1.8, 0.6, -1.8);
    const hazelLight = new THREE.PointLight(0xf59e0b, 1.2, 4);
    hazelLight.position.set(0, 1.2, 0);
    hazelMesh.add(hazelLight);
    group.add(hazelMesh);

    group.add(createLoreOrb(loreObjects[5]));
  } else if (id === 'SAN1') {
    // The Sanctum of the Glass Heart
    cynthiaCrystal = new THREE.Group();
    const outerDodec = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.2, 0),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.85 })
    );
    const innerSpirit = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xec4899, emissiveIntensity: 2.2 })
    );
    cynthiaCrystal.add(outerDodec, innerSpirit);
    const crystalLight = new THREE.PointLight(0xec4899, 2.5, 9);
    crystalLight.position.set(0, 0, 0);
    cynthiaCrystal.add(crystalLight);
    cynthiaCrystal.position.set(0, 1.8, -1.0);
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
  }
  return group;
}

function addGenericColliders(): void {
  physics.addStaticBox(6, 0.2, 6, 0, -0.2, 0);
  physics.addStaticBox(0.25, 2, 6.5, -6.2, 2, 0);
  physics.addStaticBox(0.25, 2, 6.5, 6.2, 2, 0);
  physics.addStaticBox(6.5, 2, 0.25, 0, 2, 6.2);
  physics.addStaticBox(6.5, 2, 0.25, 0, 2, -6.2);
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
    else hudQuest.textContent = 'Q0 — Infiltrate Fortress Barbican';
  }
  if (hpFill) hpFill.style.width = `${Math.max(0, playerHP)}%`;
}

function saveCheckpoint(): void {
  const data = {
    scene: currentSceneId,
    pos: [playerState.x, 0.6, playerState.z],
    inventory: [...inventory],
    puzzles: [...solvedPuzzles],
    abilities: [...abilities],
  };
  localStorage.setItem('veilkeep.save.v1', JSON.stringify(data));
  updateHUD();
}

function loadScene(id: SceneId, spawn = sceneSpawn(id)): void {
  engine.scene.remove(activeGroup);
  physics.clearStatic();
  activeGroup = sceneGroups.get(id) ?? buildGenericScene(id);
  sceneGroups.set(id, activeGroup);
  engine.scene.add(activeGroup);
  if (id === 'S00') addS00Colliders(); else addGenericColliders();
  currentSceneId = id;
  physics.teleportPlayer(spawn);
  playerState.x = spawn.x;
  playerState.z = spawn.z;
  playerMesh.position.set(spawn.x, spawn.y, spawn.z);
  engine.cameraRig.setTarget(spawn.x, 0, spawn.z);
  updateHUD();
  saveCheckpoint();
}

function respawn(): void {
  playerHP = 100;
  loadScene(currentSceneId, sceneSpawn(currentSceneId));
}

function updateGuard(g: Guard, dt: number): void {
  if (g.state === 'dead' || g.sceneId !== currentSceneId) {
    if (g.hpBarEl) g.hpBarEl.classList.remove('visible');
    return;
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

  // Target Decoy if active, otherwise player
  const targetX = activeDecoy ? activeDecoy.mesh.position.x : playerState.x;
  const targetZ = activeDecoy ? activeDecoy.mesh.position.z : playerState.z;
  const tdx = targetX - g.mesh.position.x;
  const tdz = targetZ - g.mesh.position.z;
  const targetDist = Math.hypot(tdx, tdz);

  const alertRange = activeDecoy ? 8.0 : (playerState.isSneaking ? 2.2 : 4.8);
  if (targetDist < alertRange) g.state = 'chase'; else g.state = 'patrol';

  if (g.isWraith) {
    g.mesh.position.y = 1.1 + Math.sin(Date.now() * 0.0035) * 0.18;
    if (g.state === 'chase' && targetDist < 9.0 && g.cooldown <= 0) {
      shootMirrorBolt(new THREE.Vector3(g.mesh.position.x, 1.0, g.mesh.position.z), new THREE.Vector3(targetX, 0.8, targetZ));
      g.cooldown = 3.2;
    }
  }

  if (g.state === 'chase') {
    if (targetDist > 0.75) {
      g.mesh.position.x += (tdx / targetDist) * g.speed * dt;
      g.mesh.position.z += (tdz / targetDist) * g.speed * dt;
    } else if (g.cooldown <= 0 && !activeDecoy) {
      if (parryTimer > 0) {
        SoundFX.playParry();
        g.cooldown = 2.8;
        cameraShake = 0.28;
        spawnDamagePopup(playerMesh.position, 'PARRIED!', true);
        flashMesh(g.mesh, 0xf59e0b, 300);
        const kx = (tdx / targetDist) * 1.2;
        const kz = (tdz / targetDist) * 1.2;
        g.mesh.position.x -= kx;
        g.mesh.position.z -= kz;
        showToast('Harmonic Parry! Enemy Staggered');
        parryTimer = 0;
        parryBadge?.classList.remove('active');
      } else {
        const dmg = g.captain ? 18 : 10;
        playerHP -= dmg;
        g.cooldown = 1.1;
        SoundFX.playPlayerHurt();
        cameraShake = 0.22;
        spawnDamagePopup(playerMesh.position, `-${dmg} HP`);
        flashMesh(playerMesh, 0xef4444, 160);
        updateHUD();
        if (playerHP <= 0) respawn();
      }
    }
  } else {
    const target = g.patrol[g.patrolIndex];
    const pdx = target.x - g.mesh.position.x;
    const pdz = target.z - g.mesh.position.z;
    const pd = Math.hypot(pdx, pdz);
    if (pd < 0.15) g.patrolIndex = (g.patrolIndex + 1) % g.patrol.length;
    else {
      g.mesh.position.x += (pdx / pd) * g.speed * 0.55 * dt;
      g.mesh.position.z += (pdz / pd) * g.speed * 0.55 * dt;
    }
  }
}

function tryAttack(): void {
  SoundFX.playSlash();
  attackLungeOffset = 0.28;

  const targets = [guard, captain, wraith, treeGuardian, vaelorBoss].filter((g): g is Guard => !!g && g.state !== 'dead' && g.sceneId === currentSceneId);
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
      } else {
        g.hp -= 25;
        SoundFX.playHit();
        cameraShake = 0.12;
        flashMesh(g.mesh, 0xef4444, 140);
        spawnDamagePopup(g.mesh.position, '-25 HP');
      }

      // Stagger knockback away from player
      const kx = Math.sin(playerMesh.rotation.y) * 0.38;
      const kz = Math.cos(playerMesh.rotation.y) * 0.38;
      g.mesh.position.x += kx;
      g.mesh.position.z += kz;
      g.hpBarTimer = 3.5;

      // Boss Vaelor Phase 2 Shift at 50% HP
      if (g === vaelorBoss && g.hp <= 60 && !vaelorPhase2Triggered && g.hp > 0) {
        vaelorPhase2Triggered = true;
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
          abilities.add('ABILITY_WALL_LEAP');
          SoundFX.playPuzzleSolved();
          cameraShake = 0.35;
          showToast('Victory: Captain Defeated — Wall Leap Unlocked!');
          saveCheckpoint();
        } else {
          showToast('Guard Neutralized');
        }
      }
      return;
    }
  }
}

function interact(): void {
  // Inspectable Lore Objects
  for (const lore of loreObjects) {
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
      if (activeDialogue) closeDialogue();
      else openDialogue('sable', 'SABLE_01');
      return;
    }
  }

  // OW1 Gatekeeper Orin
  if (currentSceneId === 'OW1' && orinMesh) {
    const d = Math.hypot(orinMesh.position.x - playerState.x, orinMesh.position.z - playerState.z);
    if (d < 2.5) {
      if (activeDialogue) closeDialogue();
      else openDialogue('orin', 'ORIN_01');
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

  // HM1 True Mirror
  if (currentSceneId === 'HM1' && trueMirrorMesh && trueMirrorMesh.visible) {
    const d = Math.hypot(trueMirrorMesh.position.x - playerState.x, trueMirrorMesh.position.z - playerState.z);
    if (d < 2.5) {
      solvedPuzzles.add('PUZZLE_TRUE_MIRROR');
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
        if (activeDialogue) closeDialogue();
        else openDialogue('hazel', 'HAZEL_01');
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

const exits: Record<SceneId, ExitTrigger[]> = {
  S00: [{ x: 0, z: -4.8, to: 'OW1', requires: [] }],
  OW1: [
    { x: 0, z: 5.0, to: 'S00', requires: [] },
    { x: 0, z: -5.0, to: 'GH1', requires: [] },
  ],
  GH1: [
    { x: 0, z: 5.0, to: 'OW1', requires: [] },
    { x: 0, z: -5.0, to: 'GH2', requires: ['ITEM_IRON_NAIL'] },
  ],
  GH2: [
    { x: 0, z: 5.0, to: 'GH1', requires: [] },
    { x: 0, z: -5.0, to: 'GH3', requires: ['PUZZLE_MIRROR_LOCK'] },
  ],
  GH3: [
    { x: 0, z: 5.0, to: 'GH2', requires: [] },
    { x: 0, z: -5.0, to: 'HM1', requires: [] },
    { x: 0, z: 4.0, to: 'S00', requires: [] },
  ],
  HM1: [
    { x: 0, z: 5.0, to: 'GH3', requires: [] },
    { x: 0, z: -5.0, to: 'BQ1', requires: ['PUZZLE_TRUE_MIRROR'] },
  ],
  BQ1: [
    { x: 0, z: 5.0, to: 'HM1', requires: [] },
    { x: 0, z: -5.0, to: 'AG1', requires: ['PUZZLE_FEAST_SATIETY'] },
  ],
  AG1: [
    { x: 0, z: 5.0, to: 'BQ1', requires: [] },
    { x: 0, z: -5.0, to: 'MH1', requires: ['PUZZLE_ARBOREAL_WEAVE'] },
  ],
  MH1: [
    { x: 0, z: 5.0, to: 'AG1', requires: [] },
    { x: 0, z: -5.0, to: 'SAN1', requires: ['PUZZLE_HOSPITALITY_GAMBIT'] },
  ],
  SAN1: [
    { x: 0, z: 5.0, to: 'MH1', requires: [] },
    { x: 0, z: -5.0, to: 'S00', requires: ['PUZZLE_HOLLOW_GLASS'] },
  ],
};

function checkExits(): void {
  if (exitCooldown > 0) return;
  for (const exit of exits[currentSceneId]) {
    const d = Math.hypot(exit.x - playerState.x, exit.z - playerState.z);
    if (d < 1.0) {
      if (requirementsMet(exit.requires)) {
        exitCooldown = 1.5;
        loadScene(exit.to, exit.spawn);
      } else if (lockedMessageCooldown <= 0) {
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

// Player hero
const playerMesh = kaelenModel.clone();
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
  if (e.button === 2) {
    tryParry();
  } else if (e.button === 0) {
    tryAttack();
  }
});

window.addEventListener('keydown', (e) => {
  SoundFX.ensureInit();
  SoundFX.startAmbientMusic();
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

  // Relic: Truth Lens ([Q] hold)
  if (k === 'q' && !truthLensActive) {
    truthLensActive = true;
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

// Boot from checkpoint if present, otherwise start at S00.
const saved = localStorage.getItem('veilkeep.save.v1');
let resumed = false;
if (saved) {
  try {
    const data = JSON.parse(saved) as { scene: SceneId; pos: number[]; inventory: string[]; puzzles: string[]; abilities: string[] };
    data.inventory.forEach((i) => inventory.add(i));
    data.puzzles.forEach((p) => solvedPuzzles.add(p));
    data.abilities.forEach((a) => abilities.add(a));
    if (sceneById.has(data.scene)) {
      loadScene(data.scene, { x: data.pos[0], y: data.pos[1], z: data.pos[2] });
      resumed = true;
    }
  } catch {
    localStorage.removeItem('veilkeep.save.v1');
  }
}
if (!resumed) loadScene('S00', initialSpawn);

engine.start();
console.log('🚀 VEILKEEP slice running: WASD move, Space attack, E interact. Progress autosaves on transitions.');

// Lightweight debug hook for smoke tests and future MCP inspection.
(window as unknown as { __veilkeep: unknown }).__veilkeep = {
  playerState,
  inventory,
  solvedPuzzles,
  abilities,
  get sceneId() { return currentSceneId; },
  loadScene,
};
