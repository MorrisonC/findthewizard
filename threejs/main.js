import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TILE_SIZE, TILESET_KEYS, buildFromAscii, OVERVIEW } from './assets/art/tiles.js';

// ---- Palette (art direction: Moonlit Painterly Diorama) ----
const PALETTE = {
  bg: 0x141a2c, fog: 0x1a2340,
  floor: 0x736a78, floorAccent: 0x8a7c90,
  wall: 0x5b4a73, wallTop: 0x7a5f8e,
  mirror: 0x9b7cff, gold: 0xd4af37,
};

const MIRROR_TEX_URL = './assets/art/magic_mirror.png';
const CHEST_TEX_URL = './assets/art/chest2.png';
const SCENE00_TEX_URL = './assets/art/scene00_approach_sunken.png';

function loadTexture(url) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
}

export async function boot() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.bg);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0008);

  const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 4000);
  camera.position.set(650, 900, 650);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.minDistance = 300;
  controls.maxDistance = 2200;

  // --- lights ---
  const hemi = new THREE.HemisphereLight(0x8899ff, 0x221133, 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.5);
  sun.position.set(500, 1000, 350);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1000; sun.shadow.camera.right = 1000;
  sun.shadow.camera.top = 1000; sun.shadow.camera.bottom = -1000;
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  const rim = new THREE.PointLight(PALETTE.mirror, 1.2, 1600, 1.6);
  rim.position.set(-450, 300, -350);
  scene.add(rim);
  const fill = new THREE.PointLight(0x77ccff, 0.5, 1400, 1.6);
  fill.position.set(400, 200, -300);
  scene.add(fill);

  // --- textures (props only) ---
  const [mirrorTex, chestTex, scene00Tex] = await Promise.all([
    loadTexture(MIRROR_TEX_URL), loadTexture(CHEST_TEX_URL), loadTexture(SCENE00_TEX_URL),
  ]);
  [mirrorTex, chestTex, scene00Tex].forEach(t => { t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; });
  scene.background = scene00Tex;
  scene.backgroundIntensity = 0.55;

  // --- materials ---
  const floorMat = new THREE.MeshStandardMaterial({ color: PALETTE.floor, roughness: 0.92, metalness: 0.02 });
  const wallMat = new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.75, metalness: 0.05 });
  const wallTopMat = new THREE.MeshStandardMaterial({ color: PALETTE.wallTop, roughness: 0.7 });
  const mirrorMat = new THREE.MeshStandardMaterial({ color: PALETTE.mirror, emissive: PALETTE.mirror, emissiveIntensity: 0.9, roughness: 0.2, transparent: true, opacity: 0.85 });
  const chestMat = new THREE.MeshStandardMaterial({ map: chestTex, transparent: true });

  const tiles = buildFromAscii(OVERVIEW);
  const floors = [], walls = [], doors = [], props = [];
  for (const t of tiles) {
    const px = (t.x - 24) * TILE_SIZE, pz = (t.y - 12) * TILE_SIZE;
    if (t.kind === 'floor') floors.push({ x: px, z: pz });
    else if (t.kind === 'wall') walls.push({ x: px, z: pz });
    else if (t.kind === 'door') doors.push({ x: px, z: pz });
    else if (t.kind === 'room') props.push({ x: px, z: pz, label: t.label });
    else if (t.kind === 'hero') props.push({ x: px, z: pz, hero: true });
  }

  const tileGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  const wallGeo = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE * 1.2, TILE_SIZE);
  const capGeo = new THREE.BoxGeometry(TILE_SIZE * 1.05, TILE_SIZE * 0.15, TILE_SIZE * 1.05);

  function instanced(geo, mat, list, y, castShadow = true) {
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    inst.castShadow = castShadow; inst.receiveShadow = true;
    list.forEach((p, i) => {
      const mtx = new THREE.Matrix4().makeTranslation(p.x, y, p.z);
      inst.setMatrixAt(i, mtx);
    });
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
    return inst;
  }

  const floorInst = new THREE.InstancedMesh(tileGeo, floorMat, floors.length);
  floorInst.receiveShadow = true;
  const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  floors.forEach((p, i) => {
    const mtx = new THREE.Matrix4().makeTranslation(p.x, 0, p.z).multiply(rot);
    floorInst.setMatrixAt(i, mtx);
  });
  floorInst.instanceMatrix.needsUpdate = true;
  scene.add(floorInst);

  instanced(wallGeo, wallMat, walls, 19.2);
  instanced(capGeo, wallTopMat, walls, 41.4, false);
  instanced(wallGeo, mirrorMat, doors, 19.2);

  // a large base plane for soft shadow grounding
  const base = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.ShadowMaterial({ opacity: 0.35 }));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.5; base.receiveShadow = true;
  scene.add(base);

  for (const p of props) {
    if (p.label) {
      const g = new THREE.SphereGeometry(TILE_SIZE * 0.3, 16, 16);
      const mat = new THREE.MeshStandardMaterial({ color: PALETTE.mirror, emissive: PALETTE.mirror, emissiveIntensity: 1.8, roughness: 0.25 });
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(p.x, 26, p.z);
      mesh.castShadow = true;
      scene.add(mesh);
      const light = new THREE.PointLight(PALETTE.mirror, 0.6, 120);
      light.position.set(p.x, 35, p.z);
      scene.add(light);
    } else if (p.hero) {
      const g = new THREE.ConeGeometry(TILE_SIZE * 0.4, TILE_SIZE * 1.2, 4);
      const mat = new THREE.MeshStandardMaterial({ color: PALETTE.gold, emissive: PALETTE.gold, emissiveIntensity: 0.7, roughness: 0.4 });
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(p.x, 30, p.z);
      mesh.castShadow = true;
      scene.add(mesh);
    } else {
      const geo = new THREE.BoxGeometry(TILE_SIZE, TILE_SIZE, TILE_SIZE);
      const mesh = new THREE.Mesh(geo, chestMat);
      mesh.position.set(p.x, 24, p.z);
      mesh.castShadow = true;
      scene.add(mesh);
    }
  }

  // --- postprocessing ---
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.5, 0.9);
  composer.addPass(bloom);
  const smaa = new SMAAPass();
  composer.addPass(smaa);

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    composer.render();
  }
  animate();
  console.log('[VEILKEEP] three.js diorama booted with', floors.length, 'floors,', walls.length, 'walls,', doors.length, 'doors.');
}

boot();
