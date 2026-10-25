import * as THREE from 'three';

interface ActiveParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
  initialSize: number;
  age: number;
  life: number;
  drag: number;
  gravity: number;
}

interface ActiveRing {
  mesh: THREE.Mesh;
  age: number;
  life: number;
  initialScale: number;
  maxScale: number;
  material: THREE.MeshBasicMaterial;
}

/**
 * High-performance combat particle system using instanced/batched buffer geometry.
 * Spawns directional impact sparks, expanding shockwave rings, dodge trails, and stagger dust.
 */
export class CombatParticles {
  private readonly scene: THREE.Scene;
  private readonly maxParticles = 300;
  private readonly particles: ActiveParticle[] = [];
  private readonly rings: ActiveRing[] = [];

  // Instanced mesh for 3D sparks/shards
  private readonly instancedSparks: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly sparkColor = new THREE.Color();

  // Shared geometries and materials
  private readonly ringGeo: THREE.RingGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Small sharp tetrahedron/shard for sparks
    const sparkGeo = new THREE.TetrahedronGeometry(0.04, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.instancedSparks = new THREE.InstancedMesh(sparkGeo, sparkMat, this.maxParticles);
    this.instancedSparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.instancedSparks.instanceColor) {
      this.instancedSparks.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.instancedSparks.count = 0;
    this.instancedSparks.frustumCulled = false;
    this.scene.add(this.instancedSparks);

    this.ringGeo = new THREE.RingGeometry(0.15, 0.28, 24);
    this.ringGeo.rotateX(-Math.PI / 2); // flat on horizontal plane
  }

  /**
   * Directional impact sparks when hitting an enemy with a melee weapon.
   */
  spawnHitSparks(
    pos: THREE.Vector3Like,
    dir?: THREE.Vector3Like,
    isFinisher = false,
    colorHex = 0x38bdf8,
  ): void {
    const count = isFinisher ? 36 : 18;
    const baseColor = new THREE.Color(colorHex);
    const goldColor = new THREE.Color(0xfbbf24);

    const forward = dir
      ? new THREE.Vector3(dir.x, 0, dir.z).normalize()
      : new THREE.Vector3(0, 0, 1);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      // Cone spray forward + random radial spread
      const spray = forward.clone();
      spray.x += (Math.random() - 0.5) * 1.4;
      spray.y += (Math.random() - 0.2) * 1.2;
      spray.z += (Math.random() - 0.5) * 1.4;
      spray.normalize();

      const speed = isFinisher ? 5.5 + Math.random() * 6.0 : 3.0 + Math.random() * 4.5;
      const life = 0.18 + Math.random() * (isFinisher ? 0.35 : 0.22);
      const size = (isFinisher ? 0.08 : 0.05) * (0.7 + Math.random() * 0.6);

      const pColor = isFinisher && Math.random() > 0.4 ? goldColor.clone() : baseColor.clone();
      // Emissive tint
      pColor.lerp(new THREE.Color(0xffffff), 0.35);

      this.particles.push({
        pos: new THREE.Vector3(pos.x, pos.y + 0.4, pos.z),
        vel: spray.multiplyScalar(speed),
        color: pColor,
        size,
        initialSize: size,
        age: 0,
        life,
        drag: 0.92,
        gravity: -7.5,
      });
    }

    // Expanding shockwave on finisher
    if (isFinisher) {
      this.spawnShockwaveRing(pos, 0.3, 2.2, 0.32, colorHex);
    }
  }

  /**
   * Ethereal shadow/phase dust trailing the protagonist during a dodge roll or shadow step.
   */
  spawnDodgeDust(pos: THREE.Vector3Like, dir?: THREE.Vector3Like): void {
    const count = 14;
    const shadowColor = new THREE.Color(0x8b5cf6); // violet

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.2 - (dir?.x ?? 0) * 0.8,
        0.3 + Math.random() * 1.2,
        (Math.random() - 0.5) * 1.2 - (dir?.z ?? 0) * 0.8,
      );

      const life = 0.25 + Math.random() * 0.25;
      const size = 0.07 + Math.random() * 0.05;

      this.particles.push({
        pos: new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * 0.3,
          pos.y + 0.1 + Math.random() * 0.4,
          pos.z + (Math.random() - 0.5) * 0.3,
        ),
        vel,
        color: shadowColor.clone().lerp(new THREE.Color(0x38bdf8), Math.random() * 0.5),
        size,
        initialSize: size,
        age: 0,
        life,
        drag: 0.88,
        gravity: 0.5, // gentle float
      });
    }

    this.spawnShockwaveRing(pos, 0.2, 1.4, 0.28, 0x7c3aed);
  }

  /**
   * Harmonic shockwave ring and deflection sparks on parry or block.
   */
  spawnParryBurst(pos: THREE.Vector3Like, isPerfect = false): void {
    const colorHex = isPerfect ? 0xfbbf24 : 0x38bdf8;
    const ringColor = new THREE.Color(colorHex);

    // Exploding deflection shards
    const count = isPerfect ? 28 : 16;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const vel = new THREE.Vector3(
        Math.cos(angle) * (4.0 + Math.random() * 3.5),
        0.8 + Math.random() * 2.0,
        Math.sin(angle) * (4.0 + Math.random() * 3.5),
      );

      this.particles.push({
        pos: new THREE.Vector3(pos.x, pos.y + 0.6, pos.z),
        vel,
        color: ringColor.clone().lerp(new THREE.Color(0xffffff), 0.4),
        size: isPerfect ? 0.07 : 0.045,
        initialSize: isPerfect ? 0.07 : 0.045,
        age: 0,
        life: 0.22 + Math.random() * 0.2,
        drag: 0.9,
        gravity: -5.0,
      });
    }

    this.spawnShockwaveRing(pos, 0.2, isPerfect ? 2.6 : 1.6, isPerfect ? 0.35 : 0.22, colorHex);
  }

  /**
   * Stagger grit / blood impact fragments flying when the player is damaged.
   */
  spawnStaggerBurst(pos: THREE.Vector3Like): void {
    const count = 18;
    const bloodColor = new THREE.Color(0xef4444);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 4.0,
        1.5 + Math.random() * 3.0,
        (Math.random() - 0.5) * 4.0,
      );

      this.particles.push({
        pos: new THREE.Vector3(pos.x, pos.y + 0.7, pos.z),
        vel,
        color: bloodColor.clone().lerp(new THREE.Color(0x7f1d1d), Math.random() * 0.5),
        size: 0.06 + Math.random() * 0.04,
        initialSize: 0.06 + Math.random() * 0.04,
        age: 0,
        life: 0.25 + Math.random() * 0.2,
        drag: 0.91,
        gravity: -9.8,
      });
    }
  }

  /**
   * Internal: spawn an expanding horizontal shockwave ring.
   */
  private spawnShockwaveRing(
    pos: THREE.Vector3Like,
    initialScale: number,
    maxScale: number,
    life: number,
    colorHex: number,
  ): void {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(pos.x, pos.y + 0.08, pos.z);
    mesh.scale.setScalar(initialScale);
    this.scene.add(mesh);

    this.rings.push({
      mesh,
      age: 0,
      life,
      initialScale,
      maxScale,
      material: mat,
    });
  }

  /**
   * Update all active particles and rings. Call every frame.
   */
  update(dt: number): void {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vel.y += p.gravity * dt;
      p.vel.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.pos.addScaledVector(p.vel, dt);

      // Shrink with life
      const progress = p.age / p.life;
      p.size = p.initialSize * (1.0 - progress);
    }

    // 2. Rebuild instanced mesh matrices
    const count = Math.min(this.particles.length, this.maxParticles);
    this.instancedSparks.count = count;

    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      this.dummy.position.copy(p.pos);
      this.dummy.scale.setScalar(Math.max(0.001, p.size));
      this.dummy.rotation.x += dt * 8;
      this.dummy.rotation.y += dt * 10;
      this.dummy.updateMatrix();

      this.instancedSparks.setMatrixAt(i, this.dummy.matrix);
      this.sparkColor.copy(p.color);
      this.instancedSparks.setColorAt(i, this.sparkColor);
    }

    this.instancedSparks.instanceMatrix.needsUpdate = true;
    if (this.instancedSparks.instanceColor) {
      this.instancedSparks.instanceColor.needsUpdate = true;
    }

    // 3. Update shockwave rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age >= r.life) {
        this.scene.remove(r.mesh);
        r.material.dispose();
        this.rings.splice(i, 1);
        continue;
      }

      const progress = r.age / r.life;
      const currentScale = r.initialScale + (r.maxScale - r.initialScale) * Math.sin((progress * Math.PI) / 2);
      r.mesh.scale.setScalar(currentScale);
      r.material.opacity = (1.0 - progress) * 0.85;
    }
  }

  dispose(): void {
    this.scene.remove(this.instancedSparks);
    this.instancedSparks.geometry.dispose();
    (this.instancedSparks.material as THREE.Material).dispose();

    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      r.material.dispose();
    }
    this.rings.length = 0;
    this.ringGeo.dispose();
    this.particles.length = 0;
  }
}
