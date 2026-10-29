import * as THREE from 'three';
import { IsometricCameraRig } from './IsometricCamera';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
  onUpdate?: (fixedDeltaTime: number) => void;
  onRender?: (alpha: number) => void;
}

export class GameEngine {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public cameraRig: IsometricCameraRig;
  public perspectiveCamera: THREE.PerspectiveCamera;
  public activeCamera: THREE.Camera;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedTimeStep: number = 1 / 60; // 60Hz physics

  private onUpdateCallback?: (fixedDeltaTime: number) => void;
  private onRenderCallback?: (alpha: number) => void;

  constructor(config: EngineConfig) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090d16');
    this.scene.fog = new THREE.FogExp2('#090d16', 0.009);

    const aspect = window.innerWidth / window.innerHeight;
    this.cameraRig = new IsometricCameraRig({ aspect, viewSize: 16 });
    this.perspectiveCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.activeCamera = this.cameraRig.camera;

    this.renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.onUpdateCallback = config.onUpdate;
    this.onRenderCallback = config.onRender;

    this.setupLighting();
    this.setupResizeListener();
  }

  private setupLighting(): void {
    // Edward Hopper cinematic lighting: cool navy ambient + warm directional key light.
    // The key stays warm but only lightly saturated — a lemon-yellow key turned every
    // stone surface olive-green against the blue night backdrop.
    const ambientLight = new THREE.AmbientLight(new THREE.Color('#243247'), 0.75);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(new THREE.Color('#f3e3c3'), 1.55);
    keyLight.position.set(32, 48, 36);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 160;
    keyLight.shadow.bias = -0.0005;

    const d = 48;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;

    this.scene.add(keyLight);

    // Subtle blue rim light from opposite angle
    const rimLight = new THREE.DirectionalLight(new THREE.Color('#4f9dd4'), 0.55);
    rimLight.position.set(-28, 20, -28);
    this.scene.add(rimLight);
  }

  private setupResizeListener(): void {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.renderer.setSize(width, height);
      this.cameraRig.handleResize(width / height);
      this.perspectiveCamera.aspect = width / height;
      this.perspectiveCamera.updateProjectionMatrix();
    });
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
  }

  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    let delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Prevent spiral of death on lag spikes
    if (delta > 0.25) delta = 0.25;

    this.accumulator += delta;
    while (this.accumulator >= this.fixedTimeStep) {
      if (this.onUpdateCallback) {
        this.onUpdateCallback(this.fixedTimeStep);
      }
      this.accumulator -= this.fixedTimeStep;
    }

    const alpha = this.accumulator / this.fixedTimeStep;
    if (this.onRenderCallback) {
      this.onRenderCallback(alpha);
    }

    this.renderer.render(this.scene, this.activeCamera);
    requestAnimationFrame(this.loop);
  };

  public dispose(): void {
    this.stop();
    this.renderer.dispose();
  }
}
