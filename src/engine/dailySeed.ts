// Daily-challenge seeding utilities.
// Same calendar day → same RNG seed → same builds offered, same wheel
// outcomes, same spawn pattern, same shop ordering. Lets players compare
// runs without server infra.

// Captured at module load — Math.random is the native implementation here.
const NATIVE_RANDOM = Math.random.bind(Math);
let activeRandom: (() => number) | null = null;

/** Days since the Unix epoch — stable across timezones for our purposes. */
export function todaySeed(): number {
  const now = Date.now();
  return Math.floor(now / 86_400_000);
}

/** Tiny mulberry32 PRNG — fast, good distribution, ~32-bit period. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Begin daily mode — installs a deterministic Math.random for the run. */
export function beginDailyMode(): void {
  activeRandom = mulberry32(todaySeed());
  Math.random = activeRandom;
}

/** Restore the native Math.random. Idempotent. */
export function endDailyMode(): void {
  if (activeRandom != null) {
    activeRandom = null;
    Math.random = NATIVE_RANDOM;
  }
}

/** Pretty label for the current daily seed (e.g. "Daily · 2026-05-09"). */
export function dailyLabel(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `Daily · ${y}-${m}-${day}`;
}
