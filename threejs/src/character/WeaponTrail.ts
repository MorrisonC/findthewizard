import * as THREE from 'three';
import type { EquippedWeapon } from './WeaponArsenal';

export interface WeaponTrailOptions {
  maxSamples?: number;
  lifetime?: number;
  widthMultiplier?: number;
}

interface TrailSample {
  base: THREE.Vector3;
  tip: THREE.Vector3;
  time: number;
  age: number; // 0 (new) to 1 (expired)
  tier: 1 | 2 | 3;
}

/**
 * Dynamic ribbon trail for melee weapons attached to the scene.
 * Creates an animated luminous sweep between baseAnchor and tipAnchor during attacks.
 */
export class WeaponTrail {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.MeshBasicMaterial;

  private readonly maxSamples: number;
  private readonly lifetime: number;
  private readonly widthMult: number;

  private samples: TrailSample[] = [];
  private equippedWeapon: EquippedWeapon | null = null;

  // Pre-allocated flat buffers for fast GPU upload
  private posArray: Float32Array;
  private colArray: Float32Array;
  private uvArray: Float32Array;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private uvAttr: THREE.BufferAttribute;

  private readonly _vBase = new THREE.Vector3();
  private readonly _vTip = new THREE.Vector3();
  private readonly _cBase = new THREE.Color();
  private readonly _cTip = new THREE.Color();

  constructor(private readonly scene: THREE.Scene, opts: WeaponTrailOptions = {}) {
    this.maxSamples = opts.maxSamples ?? 28;
    this.lifetime = opts.lifetime ?? 0.24; // seconds
    this.widthMult = opts.widthMultiplier ?? 1.0;

    const maxQuads = this.maxSamples - 1;
    const maxVerts = maxQuads * 6;

    this.posArray = new Float32Array(maxVerts * 3);
    this.colArray = new Float32Array(maxVerts * 4); // RGBA
    this.uvArray = new Float32Array(maxVerts * 2);

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.posArray, 3);
    this.colAttr = new THREE.BufferAttribute(this.colArray, 4);
    this.uvAttr = new THREE.BufferAttribute(this.uvArray, 2);

    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.uvAttr.setUsage(THREE.DynamicDrawUsage);

    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('color', this.colAttr);
    this.geometry.setAttribute('uv', this.uvAttr);
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'WeaponTrailRibbon';
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  setWeapon(weapon: EquippedWeapon): void {
    this.equippedWeapon = weapon;
  }

  /**
   * Update the ribbon trail each frame.
   * @param dt Delta time in seconds
   * @param isSwinging True if the hitbox/swing window is currently active
   * @param comboTier 1 for attack 1, 2 for attack 2, 3 for finisher
   */
  update(dt: number, isSwinging: boolean, comboTier: 1 | 2 | 3 = 1): void {
    if (!this.equippedWeapon) {
      this.clear();
      return;
    }

    // 1. Age existing samples
    const now = performance.now() * 0.001;
    for (let i = 0; i < this.samples.length; i++) {
      this.samples[i].age += dt / this.lifetime;
    }
    // Remove expired samples
    while (this.samples.length > 0 && this.samples[this.samples.length - 1].age >= 1.0) {
      this.samples.pop();
    }

    // 2. Sample new point if swinging
    if (isSwinging) {
      this.equippedWeapon.baseAnchor.getWorldPosition(this._vBase);
      this.equippedWeapon.tipAnchor.getWorldPosition(this._vTip);

      // Finisher extends tip slightly for an exaggerated cinematic slash arc
      if (comboTier === 3) {
        const dir = new THREE.Vector3().subVectors(this._vTip, this._vBase);
        this._vTip.addScaledVector(dir, 0.25 * this.widthMult);
      }

      const shouldAdd =
        this.samples.length === 0 ||
        this.samples[0].tip.distanceToSquared(this._vTip) > 0.0004 || // ~2cm movement threshold
        this.samples[0].age > 0.03;

      if (shouldAdd) {
        this.samples.unshift({
          base: this._vBase.clone(),
          tip: this._vTip.clone(),
          time: now,
          age: 0,
          tier: comboTier,
        });

        if (this.samples.length > this.maxSamples) {
          this.samples.length = this.maxSamples;
        }
      }
    }

    // 3. Rebuild ribbon mesh buffers
    const numSamples = this.samples.length;
    if (numSamples < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    const trailColor = this.equippedWeapon.def.trailColor;
    const glowColor = this.equippedWeapon.def.trailGlowColor;
    this._cBase.setHex(trailColor);
    this._cTip.setHex(glowColor);

    let vIdx = 0;
    const numQuads = numSamples - 1;

    for (let i = 0; i < numQuads; i++) {
      const s0 = this.samples[i];
      const s1 = this.samples[i + 1];

      // Alpha drops smoothly from head (age=0) to tail (age=1)
      const a0 = Math.max(0, 1.0 - s0.age) * (s0.tier === 3 ? 1.0 : 0.85);
      const a1 = Math.max(0, 1.0 - s1.age) * (s1.tier === 3 ? 1.0 : 0.85);

      const u0 = i / numQuads;
      const u1 = (i + 1) / numQuads;

      // Color flare on combo finisher
      const r0 = s0.tier === 3 ? 1.0 : this._cTip.r;
      const g0 = s0.tier === 3 ? 0.85 : this._cTip.g;
      const b0 = s0.tier === 3 ? 0.3 : this._cTip.b;

      const rBase = this._cBase.r;
      const gBase = this._cBase.g;
      const bBase = this._cBase.b;

      // Triangle 1: s0.base -> s0.tip -> s1.base
      this.setVertex(vIdx++, s0.base, rBase, gBase, bBase, a0 * 0.4, u0, 0);
      this.setVertex(vIdx++, s0.tip, r0, g0, b0, a0, u0, 1);
      this.setVertex(vIdx++, s1.base, rBase, gBase, bBase, a1 * 0.4, u1, 0);

      // Triangle 2: s1.base -> s0.tip -> s1.tip
      this.setVertex(vIdx++, s1.base, rBase, gBase, bBase, a1 * 0.4, u1, 0);
      this.setVertex(vIdx++, s0.tip, r0, g0, b0, a0, u0, 1);
      this.setVertex(vIdx++, s1.tip, r0, g0, b0, a1, u1, 1);
    }

    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.uvAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, vIdx);
  }

  private setVertex(
    idx: number,
    pos: THREE.Vector3,
    r: number,
    g: number,
    b: number,
    a: number,
    u: number,
    v: number,
  ): void {
    const p3 = idx * 3;
    this.posArray[p3] = pos.x;
    this.posArray[p3 + 1] = pos.y;
    this.posArray[p3 + 2] = pos.z;

    const c4 = idx * 4;
    this.colArray[c4] = r;
    this.colArray[c4 + 1] = g;
    this.colArray[c4 + 2] = b;
    this.colArray[c4 + 3] = a;

    const u2 = idx * 2;
    this.uvArray[u2] = u;
    this.uvArray[u2 + 1] = v;
  }

  clear(): void {
    this.samples = [];
    this.geometry.setDrawRange(0, 0);
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
