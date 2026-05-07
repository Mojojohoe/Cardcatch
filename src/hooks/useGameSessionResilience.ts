import { useEffect, useRef, type MutableRefObject } from 'react';
import type { GameService } from '../services/gameService';
import type { RoomData } from '../types';

const GUEST_INTERVAL_MS = 90000;

type WakeLockApi = {
  request: (type: 'screen') => Promise<WakeLockSentinel>;
};

/**
 * Reduces “stale UI after tab sleep” during an active match:
 * - Screen Wake Lock (when supported) so the tab is less aggressively suspended.
 * - On return to visible + on `online`, nudge host/guest sync via {@link GameService.notifySessionResync}.
 * - Guest-only slow interval while the tab is visible (safety net if a STATE_UPDATE was dropped).
 */
export function useGameSessionResilience(
  serviceRef: MutableRefObject<GameService>,
  room: RoomData | null,
) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const inActiveMatch =
    room !== null &&
    room.status !== 'waiting' &&
    Object.keys(room.players).length >= 2;

  useEffect(() => {
    if (!inActiveMatch) {
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      return;
    }

    const svc = serviceRef.current;

    const acquireWakeLock = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const nav = typeof navigator !== 'undefined' ? navigator : undefined;
      const wl = nav && 'wakeLock' in nav ? (nav as Navigator & { wakeLock?: WakeLockApi }).wakeLock : undefined;
      if (!wl?.request) return;
      try {
        await wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
        wakeLockRef.current = await wl.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch {
        /* user agent denied or not foreground */
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        svc.notifySessionResync('visibility');
        void acquireWakeLock();
      }
    };

    const onOnline = () => svc.notifySessionResync('online');

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);

    if (document.visibilityState === 'visible') {
      svc.notifySessionResync('mount');
      void acquireWakeLock();
    }

    const guestInterval =
      typeof window !== 'undefined' && !svc.getIsHost()
        ? window.setInterval(() => {
            if (document.visibilityState === 'visible') {
              svc.notifySessionResync('interval');
            }
          }, GUEST_INTERVAL_MS)
        : null;

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      if (guestInterval !== null) window.clearInterval(guestInterval);
      void wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [inActiveMatch, serviceRef]);
}
