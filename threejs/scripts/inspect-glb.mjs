// Inspect .glb bounds / node names without a browser.
// Usage: node scripts/inspect-glb.mjs <file...>
import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';

// GLTFLoader touches DOM-ish globals when a material references an embedded
// texture. The kit assets are untextured, but the loader still probes them.
globalThis.self ??= globalThis;
if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:stub';

const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/inspect-glb.mjs <file...>');
  process.exit(1);
}
const loader = new GLTFLoader();

function parse(buffer, base) {
  return new Promise((resolve, reject) => loader.parse(buffer, base, resolve, reject));
}

for (const file of files) {
  const buffer = await fs.readFile(file);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const gltf = await parse(ab, path.dirname(path.resolve(file)) + '/');
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const names = [];
  gltf.scene.traverse((o) => {
    if (o.isMesh) names.push(o.name || o.type);
  });
  console.log(
    JSON.stringify({
      file,
      size: size.toArray().map((n) => +n.toFixed(3)),
      min: box.min.toArray().map((n) => +n.toFixed(3)),
      max: box.max.toArray().map((n) => +n.toFixed(3)),
      meshes: names.length,
      names: names.slice(0, 12),
      animations: gltf.animations.map((a) => a.name),
    }),
  );
}
