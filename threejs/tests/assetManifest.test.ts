import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Texture } from 'three';
import {
  PBR_INDEX,
  PBR_NIGHT_SKY,
  PBR_SLUGS,
  buildPbrMaterial,
  getPbrEntry,
} from '../src/core/MaterialLibrary';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(HERE, '../public');
const MODELS = path.join(PUBLIC, 'assets/models');

const ROLES = new Set(['floor', 'wall', 'metal', 'wood', 'cloth', 'roof', 'ground']);
const REQUIRED_MAPS = ['color', 'normal', 'roughness'] as const;

function publicFile(webPath: string): string {
  return path.join(PUBLIC, webPath.replace(/^\//, '').split('/').join(path.sep));
}

interface GlbSummary {
  animations: string[];
  joints: number;
  materials: number;
  tris: number;
  meshes: number;
}

function readGlb(file: string): GlbSummary {
  const buf = fs.readFileSync(file);
  expect(buf.readUInt32LE(0), `${path.basename(file)} is not a GLB`).toBe(0x46546c67);
  let offset = 12;
  let json: any = null;
  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) json = JSON.parse(buf.subarray(offset + 8, offset + 8 + length).toString('utf8'));
    offset += 8 + length + ((4 - (length % 4)) % 4);
  }
  expect(json, `${path.basename(file)} has no JSON chunk`).toBeTruthy();
  const tris = (json.meshes ?? []).reduce((total: number, mesh: any) => {
    for (const primitive of mesh.primitives ?? []) {
      const count = primitive.indices != null ? json.accessors[primitive.indices].count : 0;
      total += count / 3;
    }
    return total;
  }, 0);
  return {
    animations: (json.animations ?? []).map((a: any) => String(a.name)),
    joints: (json.skins ?? []).reduce((total: number, skin: any) => total + skin.joints.length, 0),
    materials: (json.materials ?? []).length,
    tris: Math.round(tris),
    meshes: (json.meshes ?? []).length,
  };
}

describe('Staged PBR surface kit (ambientCG, CC0)', () => {
  it('indexes every curated material with a role and a real-world tile size', () => {
    expect(PBR_INDEX.version).toBe(1);
    expect(PBR_INDEX.license).toBe('CC0-1.0');
    expect(PBR_SLUGS.length).toBeGreaterThanOrEqual(16);
    for (const slug of PBR_SLUGS) {
      const entry = getPbrEntry(slug);
      expect(ROLES.has(entry.role), `${slug} has role "${entry.role}"`).toBe(true);
      expect(entry.metresCovered).toBeGreaterThanOrEqual(0.25);
      expect(entry.metresCovered).toBeLessThanOrEqual(8);
      expect(entry.assetId).toMatch(/^[A-Za-z]+\d/);
      expect(entry.sourceUrl).toContain('ambientcg.com/a/');
    }
  });

  it('ships every map it advertises on disk at the advertised byte size', () => {
    for (const slug of PBR_SLUGS) {
      const entry = getPbrEntry(slug);
      let bytes = 0;
      for (const kind of REQUIRED_MAPS) {
        const webPath = entry.maps[kind];
        expect(webPath, `${slug} is missing a ${kind} map`).toBeTruthy();
        const file = publicFile(webPath as string);
        expect(fs.existsSync(file), `${slug}/${kind} missing at ${file}`).toBe(true);
        bytes += fs.statSync(file).size;
      }
      if (entry.maps.ao) {
        const file = publicFile(entry.maps.ao);
        expect(fs.existsSync(file), `${slug}/ao missing at ${file}`).toBe(true);
        bytes += fs.statSync(file).size;
      }
      // Guards against a stale index after a re-export.
      expect(Math.abs(bytes - entry.bytes), `${slug} index bytes drifted from disk`).toBeLessThan(1024);
    }
  });

  it('stages the night-sky HDRI used for the PMREM backdrop', () => {
    expect(PBR_NIGHT_SKY.assetId).toBe('NightSkyHDRI003');
    const file = publicFile(PBR_NIGHT_SKY.path);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.statSync(file).size).toBeGreaterThan(200_000);
    expect(PBR_NIGHT_SKY.path.endsWith('.exr') || PBR_NIGHT_SKY.path.endsWith('.hdr')).toBe(true);
  });

  it('assembles a MeshStandardMaterial with correct colour space, tiling and metalness', () => {
    const maps = {
      color: new Texture(),
      normal: new Texture(),
      roughness: new Texture(),
    };
    const floor = buildPbrMaterial('dungeon_slab', maps, { repeat: 2, anisotropy: 8 });
    expect(floor.map?.colorSpace).toBe('srgb');
    expect(floor.normalMap?.colorSpace).toBe('');
    expect(floor.map?.repeat.x).toBe(2);
    expect(floor.map?.wrapS).toBe(1000); // THREE.RepeatWrapping
    expect(floor.metalness).toBe(0);
    expect(floor.roughness).toBe(1);
    expect(floor.userData.pbrSlug).toBe('dungeon_slab');

    const metal = buildPbrMaterial('copper_dirty', { color: new Texture() });
    expect(metal.metalness).toBeCloseTo(0.9);
  });

  it('rejects unknown slugs instead of silently rendering untextured', () => {
    expect(() => getPbrEntry('not_a_material')).toThrow(/unknown PBR material/);
  });
});

describe('Model inventory matches the integration manifest', () => {
  const files = fs.readdirSync(MODELS).filter((f) => f.endsWith('.glb'));

  it('parses every shipped GLB', () => {
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const file of files) {
      const summary = readGlb(path.join(MODELS, file));
      expect(summary.meshes, `${file} has no meshes`).toBeGreaterThan(0);
      expect(summary.tris, `${file} has no triangles`).toBeGreaterThan(0);
    }
  });

  it('keeps the two rigged humanoids inside the bone and clip contract', () => {
    for (const [file, clips] of [
      ['kaelen.glb', ['Idle', 'Walk', 'Run', 'Attack', 'Death']],
      ['keep_guard.glb', ['Idle', 'Walk', 'Attack', 'Hit', 'Death']],
    ] as const) {
      const summary = readGlb(path.join(MODELS, file));
      expect(summary.joints, `${file} joint count`).toBeGreaterThanOrEqual(20);
      expect(summary.joints, `${file} joint count`).toBeLessThanOrEqual(32);
      for (const clip of clips) {
        expect(summary.animations, `${file} is missing clip ${clip}`).toContain(clip);
      }
      expect(summary.tris, `${file} tri budget`).toBeLessThanOrEqual(4000);
    }
  });

  it('keeps environment pieces inside the per-piece triangle budget', () => {
    const budgets: Record<string, number> = {
      'room_shell.glb': 15_000,
      'gate_arch.glb': 5_000,
      'mirror_lock.glb': 6_000,
      'ag1_tree.glb': 12_000,
      'mh1_hearth.glb': 15_000,
      'san1_sanctum.glb': 8_000,
      'bq1_feast.glb': 22_000,
      's00_courtyard.glb': 32_000,
    };
    for (const [file, budget] of Object.entries(budgets)) {
      const summary = readGlb(path.join(MODELS, file));
      expect(summary.tris, `${file} exceeds its ${budget} tri budget`).toBeLessThanOrEqual(budget);
    }
  });
});
