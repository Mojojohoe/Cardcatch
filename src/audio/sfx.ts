const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Play a one-shot UI/game SFX from `public/` with user-scaled volume.
 * `volumePercent` is 0..100, where 100 means full authored sample level.
 */
export function playSfx(path: string, volumePercent: number) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
  const audio = new Audio(path);
  audio.volume = clamp01((Number.isFinite(volumePercent) ? volumePercent : 50) / 100);
  void audio.play().catch(() => {});
}

