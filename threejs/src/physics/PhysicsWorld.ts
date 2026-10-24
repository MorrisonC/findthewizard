import RAPIER from '@dimforge/rapier3d-compat';

export type Vec3 = { x: number; y: number; z: number };

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
  }

  clearStatic(): void {
    for (const collider of this.staticColliders) {
      this.world.removeCollider(collider, false);
    }
    this.staticColliders = [];
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
