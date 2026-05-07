import { useEffect, useState } from 'react';

/**
 * Bumps a counter when layout/root metrics likely changed (viewport, zoom, root font).
 * Used to recompute rem-derived raster card scale — same intent as a window `resize` listener,
 * coalesced via rAF and augmented with ResizeObserver where available.
 */
export function useLayoutScaleBump(): number {
  const [bump, setBump] = useState(0);
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBump((n) => n + 1));
    };

    window.addEventListener('resize', schedule);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && typeof document !== 'undefined') {
      ro = new ResizeObserver(schedule);
      ro.observe(document.documentElement);
    }

    return () => {
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);
  return bump;
}
