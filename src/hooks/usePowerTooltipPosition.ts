import { RefObject, useCallback, useLayoutEffect, useState } from 'react';

/** Max logical width matching Tailwind ~22rem tooltip */
const FALLBACK_POP_W = 352;
const EDGE = 12;

/** Fixed-position `{ top, left }` clamped inside the viewport while anchored to anchor element. */
export function usePowerTooltipPosition(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  popRef: RefObject<HTMLElement | null>,
) {
  const [xy, setXy] = useState<{ top: number; left: number } | null>(null);

  const clamp = useCallback(() => {
    const root = rootRef.current;
    const pop = popRef.current;
    if (!root) return;

    const r = root.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let w = FALLBACK_POP_W;
    let h = 140;
    if (pop && pop.offsetParent !== null && pop.getClientRects().length > 0) {
      const pr = pop.getBoundingClientRect();
      if (pr.width > 40) w = pr.width;
      if (pr.height > 40) h = pr.height;
    }

    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(EDGE, Math.min(left, vw - EDGE - w));

    let gap = 8;
    let top = r.bottom + gap;
    if (top + h > vh - EDGE && r.top - gap - h > EDGE) top = r.top - gap - h;
    top = Math.max(EDGE, Math.min(top, vh - EDGE - h));

    setXy({ top, left });
  }, [rootRef, popRef]);

  useLayoutEffect(() => {
    if (!open) {
      setXy(null);
      return;
    }
    clamp();
    const id = requestAnimationFrame(() => clamp());
    const t1 = window.setTimeout(() => clamp(), 48);
    const t2 = window.setTimeout(() => clamp(), 200);
    window.addEventListener('scroll', clamp, true);
    window.addEventListener('resize', clamp);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('scroll', clamp, true);
      window.removeEventListener('resize', clamp);
    };
  }, [open, clamp]);

  if (!open || !xy) {
    return {
      position: 'fixed' as const,
      left: '-10000px',
      top: '-10000px',
      visibility: 'hidden' as const,
      opacity: 0,
      pointerEvents: 'none' as const,
      maxWidth: `min(${FALLBACK_POP_W}px, calc(100vw - ${EDGE * 2}px))`,
    };
  }

  return {
    position: 'fixed' as const,
    top: xy.top,
    left: xy.left,
    width: Math.min(FALLBACK_POP_W, vwSafe() - EDGE * 2),
    maxWidth: `calc(100vw - ${EDGE * 2}px)`,
    zIndex: 500,
    visibility: 'visible' as const,
    opacity: 1,
    pointerEvents: 'none' as const,
    transition: 'opacity 0.12s ease-out',
  };
}

function vwSafe(): number {
  return typeof window !== 'undefined' ? window.innerWidth : FALLBACK_POP_W;
}
