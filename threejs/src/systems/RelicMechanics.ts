import * as THREE from 'three';
import { SoundFX } from '../core/SoundFX';
import { GlobalEventBus } from '../core/EventBus';

export interface TruthLensUniforms {
  uTruthLensActive: { value: number };
  uPlayerPosition: { value: THREE.Vector3 };
  uRadius: { value: number };
}

export class TruthLensSystem {
  public active = false;
  public uniforms: TruthLensUniforms;
  private illusoryObjects: THREE.Object3D[] = [];
  private decoyObjects: THREE.Object3D[] = [];

  constructor() {
    this.uniforms = {
      uTruthLensActive: { value: 0.0 },
      uPlayerPosition: { value: new THREE.Vector3() },
      uRadius: { value: 12.0 },
    };
  }

  public registerIllusoryObject(obj: THREE.Object3D): void {
    this.illusoryObjects.push(obj);
  }

  public registerDecoyObject(obj: THREE.Object3D): void {
    this.decoyObjects.push(obj);
  }

  public setActive(active: boolean, playerPos?: THREE.Vector3): void {
    this.active = active;
    this.uniforms.uTruthLensActive.value = active ? 1.0 : 0.0;
    if (playerPos) {
      this.uniforms.uPlayerPosition.value.copy(playerPos);
    }

    if (active) {
      SoundFX.startTruthLensHum();
    } else {
      SoundFX.stopTruthLensHum();
    }

    // Dissolve illusory walls and reveal true decoys
    for (const obj of this.illusoryObjects) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat) {
            mat.transparent = true;
            mat.opacity = active ? 0.22 : 1.0;
          }
        }
      });
    }

    // Highlight true decoys in HM1, CO3, and SAN1 with cyan-violet rim glow
    for (const obj of this.decoyObjects) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat && 'emissive' in mat) {
            if (active) {
              mat.emissive.setHex(0xa855f7); // cyan-violet rim glow
              mat.emissiveIntensity = 2.4;
            } else {
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0.0;
            }
          }
        }
      });
    }

    GlobalEventBus.emit('ITEM_USED', { itemId: 'ITEM_TRUTH_LENS' });
  }

  public update(playerPos: THREE.Vector3): void {
    this.uniforms.uPlayerPosition.value.copy(playerPos);
  }

  /**
   * Phase through modular mirror doors (KIT_Door_Mirror_2.glb or crystal_theater_mirror.glb).
   */
  public phaseThroughMirror(
    playerGroup: THREE.Object3D,
    mirrorObject: THREE.Object3D,
    onComplete?: () => void
  ): void {
    SoundFX.playGlassShatter();
    const forward = new THREE.Vector3();
    mirrorObject.getWorldDirection(forward);

    const startPos = playerGroup.position.clone();
    const endPos = startPos.clone().addScaledVector(forward, 2.8);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.08;
      if (progress >= 1.0) {
        clearInterval(interval);
        playerGroup.position.copy(endPos);
        onComplete?.();
        GlobalEventBus.emit('ITEM_USED', { itemId: 'ABILITY_MIRROR_PHASE' });
      } else {
        playerGroup.position.lerpVectors(startPos, endPos, progress);
      }
    }, 16);
  }
}

export interface AcousticTarget {
  id: string;
  position: THREE.Vector3;
  type: 'spectral_enemy' | 'resonant_switch' | 'prop';
  onHit?: () => void;
}

export class EchoBellSystem {
  private activeRings: { mesh: THREE.Mesh; radius: number; maxRadius: number; speed: number; opacity: number }[] = [];

  public emitAcousticRing(
    scene: THREE.Scene,
    origin: THREE.Vector3,
    targets: AcousticTarget[] = []
  ): THREE.Mesh {
    SoundFX.playEchoBell();

    const geom = new THREE.TorusGeometry(0.3, 0.06, 16, 48);
    geom.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(geom, mat);
    ringMesh.position.set(origin.x, origin.y + 0.1, origin.z);
    scene.add(ringMesh);

    const ringData = {
      mesh: ringMesh,
      radius: 0.3,
      maxRadius: 8.5,
      speed: 7.2,
      opacity: 1.0,
    };
    this.activeRings.push(ringData);

    // Apply pushback to spectral enemies and activate resonant switches
    for (const target of targets) {
      const dist = origin.distanceTo(target.position);
      if (dist <= 8.5) {
        if (target.type === 'spectral_enemy') {
          // Push back spectral enemies (mirror_wraith, poltergeist, paradox_wraith)
          const pushDir = target.position.clone().sub(origin).setY(0).normalize();
          target.position.addScaledVector(pushDir, 3.5);
          target.onHit?.();
        } else if (target.type === 'resonant_switch') {
          target.onHit?.();
          SoundFX.playPuzzleSolved();
        }
      }
    }

    GlobalEventBus.emit('ITEM_USED', { itemId: 'relic_echo_bell' });
    return ringMesh;
  }

  public update(dt: number): void {
    for (let i = this.activeRings.length - 1; i >= 0; i--) {
      const ring = this.activeRings[i];
      ring.radius += ring.speed * dt;
      const s = ring.radius / 0.3;
      ring.mesh.scale.set(s, s, s);

      const progress = ring.radius / ring.maxRadius;
      const mat = ring.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1.0 - progress);

      if (ring.radius >= ring.maxRadius) {
        ring.mesh.geometry.dispose();
        (ring.mesh.material as THREE.Material).dispose();
        ring.mesh.parent?.remove(ring.mesh);
        this.activeRings.splice(i, 1);
      }
    }
  }
}

export class EscherGravitySystem {
  public currentGravityVector = new THREE.Vector3(0, -9.81, 0);
  public isAnchored = false;

  /**
   * Slerp the room's gravity vector and camera roll by 90°.
   */
  public activateGravityAnchor(
    cameraRig: { camera?: THREE.Camera; roll?: number },
    onComplete?: () => void
  ): void {
    SoundFX.playGravityFlip();

    // Slerp gravity vector 90 degrees
    const oldGrav = this.currentGravityVector.clone();
    const newGrav = new THREE.Vector3(-oldGrav.y, oldGrav.x, 0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.05;
      if (progress >= 1.0) {
        clearInterval(interval);
        this.currentGravityVector.copy(newGrav);
        this.isAnchored = true;
        onComplete?.();
        GlobalEventBus.emit('ITEM_USED', { itemId: 'ITEM_IRON_NAIL' });
      } else {
        this.currentGravityVector.lerpVectors(oldGrav, newGrav, progress);
        if (cameraRig.camera) {
          cameraRig.camera.rotation.z = THREE.MathUtils.lerp(
            cameraRig.camera.rotation.z,
            cameraRig.camera.rotation.z + Math.PI / 2,
            0.05
          );
        }
      }
    }, 16);
  }

  public pinIronNail(_anchorLocation: string): void {
    this.isAnchored = true;
    SoundFX.playPickup();
    GlobalEventBus.emit('ITEM_ACQUIRED', { itemId: 'ITEM_IRON_NAIL', quantity: 1 });
  }
}
