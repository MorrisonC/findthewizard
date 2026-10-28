import * as THREE from 'three';

export interface IsometricCameraOptions {
  aspect: number;
  viewSize?: number;
  near?: number;
  far?: number;
}

export type CameraViewMode = 'isometric' | 'first_person';

/**
 * Dual-Mode Camera Rig:
 * 1. Classic Dimetric Isometric Orthographic View (35.264° pitch tilt, 45° yaw)
 * 2. Grounded First-Person Perspective View (1.68m eye height, stride head-bob,
 *    dodge-roll crouch, smooth yaw/pitch clamping, and zero snap transition).
 */
export class IsometricCameraRig {
  public camera: THREE.OrthographicCamera;
  public perspectiveCamera: THREE.PerspectiveCamera;
  public target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public mode: CameraViewMode = 'isometric';

  // First-person orientation state
  public yaw: number = Math.PI; // Facing North (-Z) by default
  public pitch: number = -0.06;
  public eyeHeight: number = 1.68;
  public crouchOffset: number = 0;
  public rollTilt: number = 0;
  private walkBobPhase: number = 0;
  private viewSize: number;

  constructor(options: IsometricCameraOptions) {
    this.viewSize = options.viewSize ?? 16;
    const aspect = options.aspect;

    this.camera = new THREE.OrthographicCamera(
      (-this.viewSize * aspect) / 2,
      (this.viewSize * aspect) / 2,
      this.viewSize / 2,
      -this.viewSize / 2,
      options.near ?? 0.1,
      options.far ?? 1000
    );

    this.perspectiveCamera = new THREE.PerspectiveCamera(
      75,
      aspect,
      0.08,
      250
    );
    this.perspectiveCamera.rotation.order = 'YXZ';

    this.updatePosition();
  }

  public get activeCamera(): THREE.Camera {
    return this.mode === 'first_person' ? this.perspectiveCamera : this.camera;
  }

  public toggleMode(playerRotationY?: number): CameraViewMode {
    if (this.mode === 'isometric') {
      this.mode = 'first_person';
      if (typeof playerRotationY === 'number') {
        this.yaw = playerRotationY;
      }
      this.pitch = -0.05;
    } else {
      this.mode = 'isometric';
    }
    this.updatePosition(0, false, false);
    return this.mode;
  }

  public applyLookDelta(deltaX: number, deltaY: number, sensitivity: number = 0.0022): void {
    this.yaw -= deltaX * sensitivity;
    const maxPitch = THREE.MathUtils.degToRad(78);
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - deltaY * sensitivity,
      -maxPitch,
      maxPitch
    );
  }

  public getForwardXZ(): THREE.Vector3 {
    if (this.mode === 'first_person') {
      return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    }
    // In classic isometric view, W moves Up-North (-Z, -X diagonal or world -Z)
    return new THREE.Vector3(0, 0, -1);
  }

  public getRightXZ(): THREE.Vector3 {
    if (this.mode === 'first_person') {
      return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
    }
    return new THREE.Vector3(1, 0, 0);
  }

  public updatePosition(
    dt: number = 0,
    isMoving: boolean = false,
    isDodgeRolling: boolean = false
  ): void {
    // 1. Update Classic Isometric Camera
    const distance = 40;
    const isoPitch = Math.atan(1 / Math.SQRT2); // ~35.264 degrees
    const isoYaw = Math.PI / 4; // 45 degrees

    const isoX = this.target.x + distance * Math.cos(isoPitch) * Math.sin(isoYaw);
    const isoY = this.target.y + distance * Math.sin(isoPitch);
    const isoZ = this.target.z + distance * Math.cos(isoPitch) * Math.cos(isoYaw);

    this.camera.position.set(isoX, isoY, isoZ);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();

    // 2. Update Grounded First-Person Camera
    if (isMoving && !isDodgeRolling) {
      this.walkBobPhase += dt * 9.5;
    } else {
      this.walkBobPhase = THREE.MathUtils.lerp(this.walkBobPhase, 0, Math.min(1, dt * 8));
    }

    const targetCrouch = isDodgeRolling ? -0.78 : 0.0;
    this.crouchOffset = THREE.MathUtils.lerp(this.crouchOffset, targetCrouch, Math.min(1, dt * 14));

    const targetTilt = isDodgeRolling ? 0.11 : 0.0;
    this.rollTilt = THREE.MathUtils.lerp(this.rollTilt, targetTilt, Math.min(1, dt * 12));

    const bobY = isMoving ? Math.sin(this.walkBobPhase * 2) * 0.035 : 0;
    const bobX = isMoving ? Math.cos(this.walkBobPhase) * 0.018 : 0;

    // Anchor strictly to grounded target.y + eyeHeight (never clipping below floor)
    const groundedEyeY = Math.max(
      this.target.y + 0.55,
      this.target.y + this.eyeHeight + this.crouchOffset + bobY
    );

    // Slight forward offset (0.12m) in look direction + self-mesh head culling prevents geometry clipping
    const fwdX = -Math.sin(this.yaw) * 0.12 + Math.cos(this.yaw) * bobX;
    const fwdZ = -Math.cos(this.yaw) * 0.12 - Math.sin(this.yaw) * bobX;

    this.perspectiveCamera.position.set(
      this.target.x + fwdX,
      groundedEyeY,
      this.target.z + fwdZ
    );
    this.perspectiveCamera.rotation.set(this.pitch, this.yaw, this.rollTilt, 'YXZ');
  }

  public setTarget(x: number, y: number, z: number, dt: number = 0, isMoving: boolean = false, isDodgeRolling: boolean = false): void {
    this.target.set(x, y, z);
    this.updatePosition(dt, isMoving, isDodgeRolling);
  }

  public updateAspect(aspect: number): void {
    this.handleResize(aspect);
  }

  public handleResize(aspect: number): void {
    this.camera.left = (-this.viewSize * aspect) / 2;
    this.camera.right = (this.viewSize * aspect) / 2;
    this.camera.top = this.viewSize / 2;
    this.camera.bottom = -this.viewSize / 2;
    this.camera.updateProjectionMatrix();

    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();
  }
}
