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
    let h = 160;
    // `position: fixed` tooltip nodes usually have offsetParent === null; still measure rects.
    const pr = pop?.getBoundingClientRect();
    if (pr && Number.isFinite(pr.width) && Number.isFinite(pr.height) && pr.width > 12 && pr.height > 12) {
      w = pr.width;
      h = pr.height;
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
    // Avoid huge negative coordinates — those extend scroll extents and clash with ancestor transforms.
    return {
      position: 'fixed' as const,
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      margin: 0,
      padding: 0,
      border: 'none',
      outline: 'none',
      overflow: 'hidden' as const,
      clipPath: 'inset(50%)',
      visibility: 'hidden' as const,
      opacity: 0,
      pointerEvents: 'none' as const,
      maxWidth: 0,
      zIndex: 0,
    };
  }

  return {
    position: 'fixed' as const,
    top: xy.top,
    left: xy.left,
    width: Math.min(FALLBACK_POP_W, vwSafe() - EDGE * 2),
    maxWidth: `calc(100vw - ${EDGE * 2}px)`,
    zIndex: 10050,
    visibility: 'visible' as const,
    opacity: 1,
    pointerEvents: 'none' as const,
    transition: 'opacity 0.12s ease-out',
  };
}

function vwSafe(): number {
  return typeof window !== 'undefined' ? window.innerWidth : FALLBACK_POP_W;
}
