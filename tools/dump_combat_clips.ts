/**
 * Dumps the combat clip library + bone layout to JSON so Blender can bake the
 * exact same animations (and hit/i-frame timings) into main_character.glb.
 *
 *   cd threejs && npx -y tsx ../tools/dump_combat_clips.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCombatClips } from '../threejs/src/character/CombatAnimations';
import { BONE_DEFS } from '../threejs/src/character/MainCharacterRig';

const here = dirname(fileURLToPath(import.meta.url));
const clips = buildCombatClips(false);
const out: Record<string, unknown> = { bones: BONE_DEFS, clips: {} };
for (const [name, clip] of Object.entries(clips)) {
  const tracks: Record<string, { times: number[]; values: number[] }> = {};
  for (const t of clip.tracks) tracks[t.name] = { times: Array.from(t.times), values: Array.from(t.values) };
  (out.clips as Record<string, unknown>)[name] = { duration: clip.duration, tracks };
}
const target = resolve(here, 'main_character_clips.json');
writeFileSync(target, JSON.stringify(out));
console.log('wrote', target, Object.keys(clips).length, 'clips');
