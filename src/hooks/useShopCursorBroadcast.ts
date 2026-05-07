import { useEffect, useRef } from 'react';

const PERIOD_MS = 64;

function normalizedFromClientXY(clientX: number, clientY: number): { nx: number; ny: number } {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (vv && vv.width > 0 && vv.height > 0) {
    const nx = (clientX - vv.offsetLeft) / vv.width;
    const ny = (clientY - vv.offsetTop) / vv.height;
    return {
      nx: Math.max(0, Math.min(1, nx)),
      ny: Math.max(0, Math.min(1, ny)),
    };
  }
  const w = typeof window !== 'undefined' ? window.innerWidth : 1;
  const h = typeof window !== 'undefined' ? window.innerHeight : 1;
  return {
    nx: Math.max(0, Math.min(1, clientX / w)),
    ny: Math.max(0, Math.min(1, clientY / h)),
  };
}

/**
 * While `enabled`, sends normalized viewport cursor coords at ~15 Hz with trailing-edge coalescing.
 * Pair with host-side debounce (~72 ms) so replication stays light.
 */
export function useShopCursorBroadcast(enabled: boolean, send: (nx: number, ny: number) => void) {
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!enabled) return;

    let lastEv: PointerEvent | null = null;
    let lastFlush = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      trailing = null;
      const e = lastEv;
      if (!e) return;
      const { nx, ny } = normalizedFromClientXY(e.clientX, e.clientY);
      sendRef.current(nx, ny);
      lastFlush = performance.now();
    };

    const onMove = (e: PointerEvent) => {
      lastEv = e;
      const now = performance.now();
      if (now - lastFlush >= PERIOD_MS) {
        if (trailing) {
          clearTimeout(trailing);
          trailing = null;
        }
        flush();
        return;
      }
      if (!trailing) {
        trailing = setTimeout(flush, PERIOD_MS - (now - lastFlush));
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (trailing) clearTimeout(trailing);
    };
  }, [enabled]);
}
