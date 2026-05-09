// Lightweight audio manager — native Audio elements, no dependency.
// Each registered SFX `id` maps to a list of variant URLs; play() picks
// one at random for variety. Volumes flow through master * sfx for SFX
// and master * music for music tracks.

const BASE = import.meta.env.BASE_URL;
const SFX_DIR = `${BASE}assets/audio/sfx/kenney-impact/audio/`;

/** Categories supported by play(). Each maps to all matching variant files. */
export type SfxId =
  | 'hit_light'
  | 'hit_med'
  | 'hit_heavy'   // crit / boss
  | 'player_hurt'
  | 'level_up'
  | 'gem_pickup'
  | 'boss_intro'
  | 'boss_defeat'
  | 'wheel_tick'
  | 'wheel_stop';

/** All variant URLs for a given SfxId. */
const SFX_VARIANTS: Record<SfxId, string[]> = {
  hit_light:    range5('impactGeneric_light_'),
  hit_med:      range5('impactPlank_medium_'),
  hit_heavy:    range5('impactMetal_heavy_'),
  player_hurt:  range5('impactGlass_heavy_'),
  level_up:     range5('impactBell_heavy_'),
  gem_pickup:   range5('impactGlass_light_'),
  boss_intro:   range5('impactBell_heavy_'),
  boss_defeat:  range5('impactMining_'),
  wheel_tick:   range5('impactPlank_medium_'),
  wheel_stop:   range5('impactBell_heavy_'),
};

function range5(prefix: string): string[] {
  return Array.from({ length: 5 }, (_, i) => `${SFX_DIR}${prefix}${String(i).padStart(3, '0')}.ogg`);
}

interface PlayOpts {
  volume?: number;     // 0..1, multiplied with master*sfx volumes
  pitch?: number;      // 0.5..1.5 — random ±0.05 added by default for variety
}

class AudioManagerImpl {
  // Cache audio elements per URL so we don't re-fetch
  private cache = new Map<string, HTMLAudioElement>();
  private lastPlayMs = new Map<SfxId, number>();
  private cooldownMs: Record<SfxId, number> = {
    hit_light: 25,
    hit_med: 35,
    hit_heavy: 45,
    player_hurt: 100,
    level_up: 200,
    gem_pickup: 50,
    boss_intro: 0,
    boss_defeat: 0,
    wheel_tick: 30,
    wheel_stop: 200,
  };

  // Volume state — readers update via setVolumes when settings change.
  private volMaster = 0.7;
  private volSfx = 0.7;
  private volMusic = 0.5;

  // Music — supports crossfade between tracks
  private music: HTMLAudioElement | null = null;
  private musicFading: HTMLAudioElement | null = null;
  private musicId: string | null = null;
  private fadeRafId: number | null = null;

  setVolumes(master: number, sfx: number, music: number): void {
    this.volMaster = master;
    this.volSfx = sfx;
    this.volMusic = music;
    if (this.music) this.music.volume = this.musicTargetVol();
  }

  private musicTargetVol(): number {
    return this.volMaster * this.volMusic;
  }

  play(id: SfxId, opts: PlayOpts = {}): void {
    const now = performance.now();
    const cd = this.cooldownMs[id] ?? 0;
    if (cd > 0 && now - (this.lastPlayMs.get(id) ?? 0) < cd) return;
    this.lastPlayMs.set(id, now);

    const variants = SFX_VARIANTS[id];
    if (!variants?.length) return;
    const url = variants[Math.floor(Math.random() * variants.length)];
    const proto = this.cache.get(url) ?? new Audio(url);
    if (!this.cache.has(url)) this.cache.set(url, proto);
    // Cloning an HTMLAudioElement keeps the buffered file but allows overlapping playback
    const inst = proto.cloneNode(true) as HTMLAudioElement;
    inst.volume = (opts.volume ?? 1) * this.volMaster * this.volSfx;
    const pitch = opts.pitch ?? 1 + (Math.random() - 0.5) * 0.1;
    inst.playbackRate = pitch;
    inst.play().catch(() => {
      /* autoplay blocked or asset missing — silent fail */
    });
  }

  /**
   * Switch the looping music track with a 1.2s crossfade.
   * Pass null to fade out to silence.
   */
  playMusic(url: string | null, fadeMs = 1200): void {
    if (this.musicId === url) return;
    this.musicId = url;

    // Cancel any in-flight fade animation
    if (this.fadeRafId != null) {
      cancelAnimationFrame(this.fadeRafId);
      this.fadeRafId = null;
    }
    // Park the previous fading track if there's one — it'll get destroyed
    // immediately so we don't end up with three tracks on chained switches.
    if (this.musicFading) {
      this.musicFading.pause();
      this.musicFading = null;
    }
    this.musicFading = this.music;
    this.music = null;

    if (url) {
      const a = new Audio(url);
      a.loop = true;
      a.volume = 0;
      a.play().catch(() => {
        /* autoplay blocked — first user gesture will succeed */
      });
      this.music = a;
    }

    // Animate volumes
    const start = performance.now();
    const fadingFrom = this.musicFading?.volume ?? 0;
    const target = this.musicTargetVol();
    const step = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / fadeMs);
      // Fade out old
      if (this.musicFading) {
        this.musicFading.volume = fadingFrom * (1 - t);
      }
      // Fade in new
      if (this.music) {
        this.music.volume = target * t;
      }
      if (t < 1) {
        this.fadeRafId = requestAnimationFrame(step);
      } else {
        this.fadeRafId = null;
        if (this.musicFading) {
          this.musicFading.pause();
          this.musicFading = null;
        }
      }
    };
    this.fadeRafId = requestAnimationFrame(step);
  }
}

export const AudioManager = new AudioManagerImpl();
