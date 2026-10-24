import * as THREE from 'three';

export interface IsometricCameraOptions {
  aspect: number;
  viewSize?: number;
  near?: number;
  far?: number;
}

/**
 * Dimetric / Isometric Orthographic Camera Rig
 * Enforces true dimetric projection: 35.264° pitch tilt (asin(tan(30°))), 45° yaw.
 */
export class IsometricCameraRig {
  public camera: THREE.OrthographicCamera;
  public target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private viewSize: number;

  constructor(options: IsometricCameraOptions) {
    this.viewSize = options.viewSize ?? 18;
    const aspect = options.aspect;

    this.camera = new THREE.OrthographicCamera(
      (-this.viewSize * aspect) / 2,
      (this.viewSize * aspect) / 2,
      this.viewSize / 2,
      -this.viewSize / 2,
      options.near ?? 0.1,
      options.far ?? 1000
    );

    this.updatePosition();
  }

  public updatePosition(): void {
    // True dimetric isometric distance vector
    const distance = 40;
    const isoPitch = Math.atan(1 / Math.SQRT2); // ~35.264 degrees
    const isoYaw = Math.PI / 4; // 45 degrees

    const x = this.target.x + distance * Math.cos(isoPitch) * Math.sin(isoYaw);
    const y = this.target.y + distance * Math.sin(isoPitch);
    const z = this.target.z + distance * Math.cos(isoPitch) * Math.cos(isoYaw);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  public setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this.updatePosition();
  }

  public handleResize(aspect: number): void {
    this.camera.left = (-this.viewSize * aspect) / 2;
    this.camera.right = (this.viewSize * aspect) / 2;
    this.camera.top = this.viewSize / 2;
    this.camera.bottom = -this.viewSize / 2;
    this.camera.updateProjectionMatrix();
  }
}
