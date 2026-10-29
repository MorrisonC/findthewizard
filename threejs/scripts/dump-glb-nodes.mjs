// Dump glTF node hierarchy + mesh bounds for a .glb
// Usage: node scripts/dump-glb-nodes.mjs <file>
import fs from 'node:fs/promises';
import * as THREE from 'three';

globalThis.self ??= globalThis;
if (!globalThis.URL.createObjectURL) globalThis.URL.createObjectURL = () => 'blob:stub';
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

const file = process.argv[2];
const buffer = await fs.readFile(file);
const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const loader = new GLTFLoader();
const gltf = await new Promise((res, rej) => loader.parse(ab, './', res, rej));
gltf.scene.updateWorldMatrix(true, true);
const rows = [];
gltf.scene.traverse((o) => {
  const e = o.matrixWorld.elements;
  const row = {
    name: o.name || o.type,
    type: o.type,
    parent: o.parent?.name || '',
    pos: [o.position.x, o.position.y, o.position.z].map((n) => +n.toFixed(3)),
    wpos: [e[12], e[13], e[14]].map((n) => +n.toFixed(3)),
  };
  if (o.isMesh) {
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox;
    row.geoMin = b.min.toArray().map((n) => +n.toFixed(3));
    row.geoMax = b.max.toArray().map((n) => +n.toFixed(3));
  }
  rows.push(row);
});
for (const r of rows) console.log(JSON.stringify(r));
