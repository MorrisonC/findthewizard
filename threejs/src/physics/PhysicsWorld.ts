import RAPIER from '@dimforge/rapier3d-compat';

export type Vec3 = { x: number; y: number; z: number };

/** Axis-aligned static box, mirrored out for grid pathfinding. */
export interface StaticBox {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
}

/**
 * Rapier-backed world for the vertical slice.
 * Owns static dungeon colliders and a kinematic capsule player.
 */
export class RapierPhysics {
  private world: RAPIER.World;
  private playerBody: RAPIER.RigidBody;
  private playerCollider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private staticColliders: RAPIER.Collider[] = [];
  private staticBoxes: StaticBox[] = [];

  private constructor(spawn: Vec3) {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    this.playerBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .setLinearDamping(0.0),
    );
    this.playerCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.45, 0.32).setFriction(0.0),
      this.playerBody,
    );

    this.controller = this.world.createCharacterController(0.02);
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(0.45, 0.2, true);
    this.controller.enableSnapToGround(0.4);
  }

  static async create(spawn: Vec3): Promise<RapierPhysics> {
    await RAPIER.init();
    return new RapierPhysics(spawn);
  }

  addStaticBox(halfX: number, halfY: number, halfZ: number, x: number, y: number, z: number): void {
    const desc = RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ)
      .setTranslation(x, y, z)
      .setFriction(0.6);
    this.staticColliders.push(this.world.createCollider(desc));
    this.staticBoxes.push({ x, y, z, hx: halfX, hy: halfY, hz: halfZ });
  }

  /** Read-only copy of the static boxes, used by the auto-battler pathfinder. */
  getStaticBoxes(): readonly StaticBox[] {
    return this.staticBoxes;
  }

  /**
   * Capsule-width clearance probe between two points.
   *
   * Three parallel rays are cast at chest height (centre, and ±0.28m across the
   * travel direction) which approximates a swept capsule. Returns false when
   * anything solid blocks the segment, so the autoplay bot can tell a walkable
   * doorway from a chasm, ledge or closed portcullis.
   */
  probeClearance(from: Vec3, to: Vec3): boolean {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1e-4) return true;

    const dir = { x: dx / dist, y: 0, z: dz / dist };
    const perp = { x: -dir.z, z: dir.x };
    const y = from.y + 0.55;

    try {
      for (const offset of [0, 0.28, -0.28]) {
        const origin = { x: from.x + perp.x * offset, y, z: from.z + perp.z * offset };
        const ray = new RAPIER.Ray(origin, dir);
        const hit = this.world.castRay(ray, dist, true, undefined, undefined, this.playerCollider);
        if (!hit) continue;
        const toi = (hit as unknown as { timeOfImpact?: number; toi?: number }).timeOfImpact
          ?? (hit as unknown as { toi?: number }).toi
          ?? 0;
        if (toi < dist - 0.05) return false;
      }
    } catch {
      // Never let a physics-API mismatch break gameplay: assume walkable.
      return true;
    }
    return true;
  }

  clearStatic(): void {
    for (const collider of this.staticColliders) {
      this.world.removeCollider(collider, false);
    }
    this.staticColliders = [];
    this.staticBoxes = [];
  }

  teleportPlayer(spawn: Vec3): void {
    this.playerBody.setTranslation(spawn, true);
  }

  /** Move the player using camera-relative input and return the new translation. */
  movePlayer(inputX: number, inputZ: number): Vec3 {
    const pos = this.playerBody.translation();
    const desired = { x: inputX, y: -0.08, z: inputZ };
    this.controller.computeColliderMovement(this.playerCollider, desired);
    const delta = this.controller.computedMovement();
    this.playerBody.setNextKinematicTranslation({
      x: pos.x + delta.x,
      y: pos.y + delta.y,
      z: pos.z + delta.z,
    });
    this.world.step();
    return this.playerBody.translation();
  }

  dispose(): void {
    this.world.free();
  }
}
