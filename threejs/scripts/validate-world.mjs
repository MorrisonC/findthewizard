#!/usr/bin/env node
/**
 * Static world-graph, manifest and asset validator for VEILKEEP.
 *
 *   node --experimental-strip-types scripts/validate-world.mjs
 *   npm run validate:world
 *
 * The playable door graph lives in `src/data/doorGraph.ts` and is the
 * authoritative one at runtime. `world_manifest.json` is the design manifest;
 * it is validated too, but drift between the two is reported as data debt
 * rather than a boot blocker.
 *
 * Exit code 1 when a P0 (softlock / broken reference / missing asset) is found.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FORTRESS_EXITS } from '../src/data/doorGraph.ts';
import { CAMPAIGN_ORDER, SCENE_PLANS } from '../src/autobattler/Campaign.ts';
import { ASSETS } from '../src/core/AssetManifest.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

const findings = [];
const add = (severity, area, message, detail) => findings.push({ severity, area, message, detail });

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const manifest = readJson('src/data/world_manifest.json');
const scenes = manifest.mvpVerticalSliceScenes;
const byId = new Map(scenes.map((s) => [s.id, s]));
const manifestIds = new Set(byId.keys());

const SECTION = (t) => console.log(`\n== ${t} ==`);

// ---------------------------------------------------------------- manifest
SECTION('manifest integrity');
if (scenes.length !== manifestIds.size) add('P0', 'manifest', `duplicate scene ids (${scenes.length} scenes, ${manifestIds.size} unique)`);

let manifestExitCount = 0;
const exitsWithoutId = [];
for (const scene of scenes) {
  if (!scene.id) add('P0', 'manifest', 'scene without id');
  if (!scene.name) add('P2', 'manifest', `${scene.id}: missing name`);
  if (!Array.isArray(scene.spawn) || scene.spawn.length !== 3) add('P1', 'manifest', `${scene.id}: invalid spawn`);
  if (!Array.isArray(scene.exits) || scene.exits.length === 0) add('P2', 'manifest', `${scene.id}: no exits`);

  const seen = new Set();
  for (const exit of scene.exits ?? []) {
    manifestExitCount++;
    if (!exit.id) exitsWithoutId.push(`${scene.id}->${exit.to}`);
    if (!manifestIds.has(exit.to)) add('P0', 'manifest', `${scene.id} -> ${exit.to}: target scene does not exist`);
    if (seen.has(exit.to)) add('P1', 'manifest', `${scene.id} -> ${exit.to}: duplicate exit`);
    seen.add(exit.to);
    if (!Array.isArray(exit.requires)) add('P2', 'manifest', `${scene.id} -> ${exit.to}: requires is not an array`);
    if (typeof exit.oneWay !== 'boolean') add('P3', 'manifest', `${scene.id} -> ${exit.to}: oneWay missing`);
    if (!Array.isArray(exit.spawn) || exit.spawn.length !== 3) add('P2', 'manifest', `${scene.id} -> ${exit.to}: exit spawn missing`);
  }
}
if (exitsWithoutId.length) {
  add('P3', 'manifest', `${exitsWithoutId.length}/${manifestExitCount} exits have no id (sample: ${exitsWithoutId.slice(0, 5).join(', ')})`);
}
console.log(`  ${scenes.length} scenes, ${manifestExitCount} exits`);

// Symmetry: a two-way door must exist in both directions; a one-way shortcut
// must leave a route back to where it came from.
const manifestGraph = new Map(scenes.map((s) => [s.id, s.exits ?? []]));
const directedReach = (start, graph, allowed = () => true) => {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const from = queue.shift();
    for (const edge of graph.get(from) ?? graph[from] ?? []) {
      if (!allowed(edge)) continue;
      if (!seen.has(edge.to)) {
        seen.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return seen;
};

let asymmetric = 0;
let oneWayBroken = 0;
for (const scene of scenes) {
  for (const exit of scene.exits ?? []) {
    if (!manifestIds.has(exit.to)) continue;
    const back = (byId.get(exit.to)?.exits ?? []).find((e) => e.to === scene.id);
    if (!exit.oneWay) {
      if (!back) {
        asymmetric++;
        add('P2', 'manifest-symmetry', `${scene.id} -> ${exit.to} is two-way but has no return exit`);
      } else if (back.oneWay) {
        asymmetric++;
        add('P2', 'manifest-symmetry', `${scene.id} -> ${exit.to} is two-way but the return exit is oneWay`);
      }
    } else if (!directedReach(exit.to, manifestGraph).has(scene.id)) {
      oneWayBroken++;
      add('P2', 'manifest-symmetry', `${scene.id} -> ${exit.to} is one-way and ${exit.to} cannot reach ${scene.id} again`);
    }
  }
}
console.log(`  asymmetric exits: ${asymmetric}, broken one-way shortcuts: ${oneWayBroken}`);

// ------------------------------------------------------------ runtime graph
SECTION('runtime door graph (src/data/doorGraph.ts)');
const runtimeIds = Object.keys(FORTRESS_EXITS);
console.log(`  ${runtimeIds.length} scenes, ${Object.values(FORTRESS_EXITS).flat().length} doors`);

for (const [from, doors] of Object.entries(FORTRESS_EXITS)) {
  if (!manifestIds.has(from)) add('P0', 'doorGraph', `${from}: scene not in world_manifest.json`);
  const seen = new Set();
  for (const door of doors) {
    if (!manifestIds.has(door.to)) add('P0', 'doorGraph', `${from} -> ${door.to}: target scene does not exist`);
    if (seen.has(door.to)) add('P1', 'doorGraph', `${from} -> ${door.to}: duplicate door`);
    seen.add(door.to);
    if (typeof door.x !== 'number' || typeof door.z !== 'number') add('P1', 'doorGraph', `${from} -> ${door.to}: door has no position`);
  }
}

const runtimeGraph = new Map(Object.entries(FORTRESS_EXITS));
let runtimeAsymmetric = 0;
for (const [from, doors] of Object.entries(FORTRESS_EXITS)) {
  for (const door of doors) {
    if (!FORTRESS_EXITS[door.to]) continue;
    const direct = FORTRESS_EXITS[door.to].some((d) => d.to === from);
    if (direct) continue;
    runtimeAsymmetric++;
    const loop = directedReach(door.to, runtimeGraph).has(from);
    if (loop) {
      add('P3', 'doorGraph-symmetry', `${from} -> ${door.to} has no return door (loop returns via another room)`);
    } else {
      add('P2', 'doorGraph-symmetry', `${from} -> ${door.to} is a dead end: ${door.to} cannot reach ${from}`);
    }
  }
}
console.log(`  doors without a direct return: ${runtimeAsymmetric}`);

const missingScenes = CAMPAIGN_ORDER.filter((id) => !FORTRESS_EXITS[id]);
for (const id of missingScenes) add('P0', 'campaign', `${id}: campaign scene has no doors`);
const missingPlans = CAMPAIGN_ORDER.filter((id) => !SCENE_PLANS[id]);
for (const id of missingPlans) add('P0', 'campaign', `${id}: campaign scene has no plan`);
const orphanScenes = runtimeIds.filter((id) => !CAMPAIGN_ORDER.includes(id));
for (const id of orphanScenes) add('P3', 'campaign', `${id}: has doors but is not in the campaign order`);
const manifestOnly = [...manifestIds].filter((id) => !FORTRESS_EXITS[id]);
if (manifestOnly.length) {
  add('P2', 'drift', `manifest scenes with no runtime doors: ${manifestOnly.join(', ')}`);
}

// ------------------------------------------------------------- lock-and-key
/** Tokens a scene hands out once the player can act in it. */
function tokenSourcesFromCampaign() {
  const sources = new Map();
  for (const [sceneId, plan] of Object.entries(SCENE_PLANS)) {
    const tokens = new Set();
    for (const task of plan.tasks) {
      if (task.item) tokens.add(task.item);
      if (task.puzzle) tokens.add(task.puzzle);
      for (const grant of task.grants ?? []) tokens.add(grant);
      // `grantsAny` is an either/or reward (e.g. Yggdra grants the ability or
      // the weave puzzle). Optimistically treat every branch as obtainable so a
      // gate is only flagged when no branch can ever satisfy it.
      for (const grant of task.grantsAny ?? []) tokens.add(grant);
    }
    sources.set(sceneId, tokens);
  }
  return sources;
}

function lockAndKey(graph, sources, start = 'S00') {
  const acquired = new Set();
  const reachable = new Set([start]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const scene of [...reachable]) {
      for (const token of sources.get(scene) ?? []) {
        if (!acquired.has(token)) {
          acquired.add(token);
          changed = true;
        }
      }
      for (const door of graph[scene] ?? []) {
        if (!door.requires.every((r) => acquired.has(r))) continue;
        if (!reachable.has(door.to)) {
          reachable.add(door.to);
          changed = true;
        }
      }
    }
  }
  const blocked = [];
  for (const scene of reachable) {
    for (const door of graph[scene] ?? []) {
      const missing = door.requires.filter((r) => !acquired.has(r));
      if (missing.length) blocked.push({ from: scene, to: door.to, missing });
    }
  }
  return { acquired, reachable, blocked };
}

SECTION('lock-and-key reachability (runtime graph)');
const sources = tokenSourcesFromCampaign();
const runtimeLK = lockAndKey(FORTRESS_EXITS, sources);
console.log(`  reachable from S00: ${runtimeLK.reachable.size}/${runtimeIds.length}`);
console.log(`  tokens acquired: ${runtimeLK.acquired.size}`);

const unreachableRuntime = runtimeIds.filter((id) => !runtimeLK.reachable.has(id));
for (const id of unreachableRuntime) add('P0', 'softlock', `${id}: unreachable from S00 even with every obtainable token`);

const sourceOf = new Map();
for (const [sceneId, tokens] of sources) for (const token of tokens) if (!sourceOf.has(token)) sourceOf.set(token, sceneId);
for (const gate of runtimeLK.blocked) {
  for (const token of gate.missing) {
    const origin = sourceOf.get(token);
    if (!origin) {
      add('P0', 'softlock', `${gate.from} -> ${gate.to} needs ${token}, which no scene grants`);
    } else if (!runtimeLK.reachable.has(origin)) {
      add('P0', 'softlock', `${gate.from} -> ${gate.to} needs ${token} from ${origin}, which is behind the same gate`);
    } else {
      add('P1', 'softlock', `${gate.from} -> ${gate.to} still blocked by ${token} after acquiring everything reachable`);
    }
  }
}
if (runtimeLK.blocked.length === 0) console.log('  no blocked gates: every requirement is obtainable first');

// The design manifest is validated with the same algorithm, but it is not the
// runtime graph; gaps here are data debt.
SECTION('lock-and-key reachability (world_manifest.json)');
const manifestSources = new Map();
for (const scene of scenes) {
  const tokens = new Set();
  for (const puzzle of scene.puzzles ?? []) tokens.add(puzzle.id);
  for (const item of scene.items ?? []) tokens.add(typeof item === 'string' ? item : item.id);
  for (const ability of scene.abilities ?? []) tokens.add(ability);
  manifestSources.set(scene.id, tokens);
}
// The manifest does not model the runtime item grants, so fold those in as a
// second source table when the scene exists there too.
for (const [sceneId, tokens] of sources) {
  if (!manifestSources.has(sceneId)) continue;
  for (const token of tokens) manifestSources.get(sceneId).add(token);
}
const manifestLK = lockAndKey(
  Object.fromEntries([...manifestGraph].map(([id, exits]) => [id, exits.map((e) => ({ to: e.to, requires: e.requires ?? [] }))])),
  manifestSources,
);
console.log(`  reachable from S00: ${manifestLK.reachable.size}/${manifestIds.size}`);
const unreachableManifest = [...manifestIds].filter((id) => !manifestLK.reachable.has(id));
if (unreachableManifest.length) {
  add(
    'P2',
    'manifest-graph',
    `${unreachableManifest.length} manifest scenes unreachable from S00 (design manifest is stale; runtime uses doorGraph.ts): ${unreachableManifest.join(', ')}`,
  );
}
for (const gate of manifestLK.blocked) {
  add('P3', 'manifest-graph', `${gate.from} -> ${gate.to} blocked by ${gate.missing.join(', ')}`);
}

// ------------------------------------------------------------------ assets
SECTION('assets');
const missingAssets = new Map();
const checkAsset = (url, owner) => {
  if (!url || !url.startsWith('/')) return;
  const file = path.join(PUBLIC, url.replace(/^\//, ''));
  if (!fs.existsSync(file)) {
    if (!missingAssets.has(url)) missingAssets.set(url, new Set());
    missingAssets.get(url).add(owner);
  }
};

for (const [group, entries] of Object.entries(ASSETS)) {
  for (const [key, url] of Object.entries(entries)) checkAsset(url, `ASSETS.${group}.${key}`);
}
for (const scene of scenes) checkAsset(scene.model ? `/${scene.model.replace(/^assets\//, 'assets/')}` : null, `${scene.id}.model`);

// Zone music: read the table straight out of AudioManager.
const audioSrc = fs.readFileSync(path.join(ROOT, 'src/core/AudioManager.ts'), 'utf8');
const trackMatches = audioSrc.matchAll(/'(\/audio\/[^']+)'/g);
for (const match of trackMatches) checkAsset(match[1], 'AudioManager');

console.log(`  checked ${Object.values(ASSETS).reduce((n, g) => n + Object.keys(g).length, 0)} textures, ${scenes.length} models, zone tracks`);
for (const [url, owners] of missingAssets) {
  add('P1', 'assets', `missing file ${url} (referenced by ${[...owners].slice(0, 3).join(', ')})`);
}

// ----------------------------------------------------------------- report
SECTION('report');
const order = ['P0', 'P1', 'P2', 'P3'];
findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
for (const severity of order) {
  const group = findings.filter((f) => f.severity === severity);
  if (!group.length) continue;
  console.log(`\n${severity} (${group.length})`);
  for (const f of group) console.log(`  [${f.area}] ${f.message}`);
}

const counts = Object.fromEntries(order.map((s) => [s, findings.filter((f) => f.severity === s).length]));
console.log(`\nP0=${counts.P0} P1=${counts.P1} P2=${counts.P2} P3=${counts.P3}`);
process.exit(counts.P0 > 0 ? 1 : 0);
