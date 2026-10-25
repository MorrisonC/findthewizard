import * as THREE from 'three';

export type QualityTier = 'low' | 'medium' | 'high';

const PRESETS: Record<QualityTier, { dpr: number; shadows: boolean }> = {
  low: { dpr: 0.85, shadows: false },
  medium: { dpr: 1.25, shadows: true },
  high: { dpr: 2, shadows: true },
};

/** Quality presets and a small frame-time monitor for browser profiling. */
export class QualityManager {
  private tier: QualityTier = 'medium';
  private frames = 0;
  private elapsed = 0;
  private last = performance.now();
  private fps = 60;
  private readonly element: HTMLDivElement;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.element = document.createElement('div');
    this.element.style.cssText = 'position:fixed;right:20px;bottom:76px;padding:8px 12px;background:rgba(15,23,42,.85);border:1px solid rgba(212,175,55,.35);border-radius:8px;font:12px system-ui;color:#d4af37;pointer-events:none;z-index:5';
    document.body.appendChild(this.element);
    this.apply();
  }

  cycle(): void {
    this.tier = this.tier === 'low' ? 'medium' : this.tier === 'medium' ? 'high' : 'low';
    this.apply();
  }

  private apply(): void {
    const preset = PRESETS[this.tier];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr));
    this.renderer.shadowMap.enabled = preset.shadows;
    this.updateLabel();
  }

  frame(): void {
    this.frames++;
    const now = performance.now();
    this.elapsed += now - this.last;
    this.last = now;
    if (this.elapsed >= 1000) {
      this.fps = Math.round((this.frames * 1000) / this.elapsed);
      this.frames = 0;
      this.elapsed = 0;
      this.updateLabel();
    }
  }

  private updateLabel(): void {
    this.element.textContent = `${this.tier.toUpperCase()} · ${this.fps} FPS · DPR ${this.renderer.getPixelRatio().toFixed(2)}`;
  }

  get currentFps(): number { return this.fps; }
  get currentTier(): QualityTier { return this.tier; }
}
