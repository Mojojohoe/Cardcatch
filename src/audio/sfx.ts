const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
let unlocked = false;
const queued: Array<{ path: string; volumePercent: number }> = [];

function resolveAssetPath(path: string): string {
  const clean = path.replace(/^\/+/, '');
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${clean}`;
}

function markUnlocked() {
  unlocked = true;
  while (queued.length) {
    const next = queued.shift()!;
    const audio = new Audio(resolveAssetPath(next.path));
    audio.volume = clamp01(next.volumePercent / 100);
    void audio.play().catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  const opts: AddEventListenerOptions = { once: true, passive: true };
  const unlock = () => markUnlocked();
  window.addEventListener('pointerdown', unlock, opts);
  window.addEventListener('touchstart', unlock, opts);
  window.addEventListener('keydown', unlock, opts);
}

/**
 * Play a one-shot UI/game SFX from `public/` with user-scaled volume.
 * `volumePercent` is 0..100, where 100 means full authored sample level.
 */
export function playSfx(path: string, volumePercent: number) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  const vol = clamp01((Number.isFinite(volumePercent) ? volumePercent : 50) / 100);
  if (!unlocked) {
    queued.push({ path, volumePercent: vol * 100 });
    return;
  }
  const audio = new Audio(resolveAssetPath(path));
  audio.volume = vol;
  void audio.play().catch(() => {});
}

