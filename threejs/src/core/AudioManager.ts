import * as THREE from 'three';

const FALLBACK_TRACK = 'audio/dungeon002_0.ogg';

const ZONE_TRACKS: Record<string, string> = {
  S00: 'audio/dungeon002_0.ogg',
  OW1: 'audio/dungeon002_0.ogg',
  GH1: 'audio/dungeon_theme.mp3',
  GH2: 'audio/dungeon_theme.mp3',
  GH3: 'audio/dungeon_theme.mp3',
  HM1: 'audio/dungeon_theme.mp3',
  BQ1: 'audio/idle_chambers_silver_lining.mp3',
  AG1: 'audio/dark_woods_in_game.ogg',
  MH1: 'audio/apparitions_ball.ogg',
  SAN1: 'audio/sinister_boss_appears.ogg',
  RC1: 'audio/dark_woods_in_game.ogg',
  BT1: 'audio/apparitions_ball_piano.ogg',
  CO1: 'audio/spooky_dungeon.ogg',
  U1: 'audio/ps2_horror_ambience.mp3',
  U2: 'audio/ps2_horror_ambience.mp3',
  U3: 'audio/ps2_horror_ambience.mp3',
  U4: 'audio/ps2_horror_ambience.mp3',
  TR1: 'audio/sinister_abode.ogg',
  TR2: 'audio/sinister_abode.ogg',
  TR3: 'audio/sinister_abode.ogg',
  TR4: 'audio/sinister_abode.ogg',
  AT1: 'audio/snowfall_loop.ogg',
  AT2: 'audio/snowfall_loop.ogg',
  AT3: 'audio/snowfall_loop.ogg',
  AL1: 'audio/darkest_dungeon_v2.mp3',
  AL2: 'audio/darkest_dungeon_v2.mp3',
  AL3: 'audio/darkest_dungeon_v2.mp3',
  PB1: 'audio/spooky_dungeon.ogg',
  PB2: 'audio/spooky_dungeon.ogg',
  PB3: 'audio/spooky_dungeon.ogg',
  PB4: 'audio/spooky_dungeon.ogg',
  RG1: 'audio/snowfall_loop.ogg',
  RG2: 'audio/snowfall_loop.ogg',
  RG3: 'audio/snowfall_loop.ogg',
  RG4: 'audio/snowfall_loop.ogg',
  VR1: 'audio/apparitions_ball_piano.ogg',
  VR2: 'audio/apparitions_ball_piano.ogg',
  VR3: 'audio/apparitions_ball_piano.ogg',
  RS1: 'audio/dark_woods_in_game.ogg',
  RS2: 'audio/dark_woods_in_game.ogg',
  RS3: 'audio/dark_woods_in_game.ogg',
  RS4: 'audio/dark_woods_in_game.ogg',
  RS5: 'audio/dark_woods_in_game.ogg',
  RS6: 'audio/dark_woods_in_game.ogg',
};

export class AudioManager {
  private listener: THREE.AudioListener;
  private music: THREE.Audio;
  private currentUrl = '';
  private started = false;
  private failedUrls = new Set<string>();

  constructor(camera: THREE.Camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.music = new THREE.Audio(this.listener);
    this.music.setLoop(true);
    this.music.setVolume(0.35);
  }

  ensureStarted(): void {
    if (this.started) return;
    this.started = true;
    if (this.listener.context.state === 'suspended') this.listener.context.resume().catch(() => {});
  }

  playZoneMusic(sceneId: string): void {
    const rawUrl = ZONE_TRACKS[sceneId] || FALLBACK_TRACK;
    const url = rawUrl.startsWith('/') ? rawUrl.slice(1) : rawUrl;
    if (url === this.currentUrl) return;
    this.currentUrl = url;
    this.loadTrack(url, true);
  }

  /** A missing or undecodable track must never break a room transition. */
  private loadTrack(url: string, allowFallback: boolean): void {
    const sanitizedUrl = url.startsWith('/') ? url.slice(1) : url;
    const loader = new THREE.AudioLoader();
    loader.load(
      sanitizedUrl,
      (buffer) => {
        this.music.stop();
        this.music.setBuffer(buffer);
        this.music.play();
      },
      undefined,
      () => {
        if (!this.failedUrls.has(sanitizedUrl)) {
          this.failedUrls.add(sanitizedUrl);
          console.warn(`[audio] could not load ${sanitizedUrl}${allowFallback ? '; using fallback track' : ''}`);
        }
        if (allowFallback && sanitizedUrl !== FALLBACK_TRACK) {
          this.currentUrl = FALLBACK_TRACK;
          this.loadTrack(FALLBACK_TRACK, false);
        }
      },
    );
  }

  setVolume(v: number): void { this.music.setVolume(Math.max(0, Math.min(1, v))); }
}
