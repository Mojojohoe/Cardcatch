import { useEffect, useRef, type RefObject } from 'react';

/** Minimal surface for {@link ChipSimulationCanvas} imperative API. */
export type ChipPileHandle = {
  spawn: () => void;
  resetToCount: (count: number) => void;
};

/**
 * Keeps a physics chip pile in sync with an integer balance: increase spawns coins,
 * decrease clears and respawns the target count (matches prior ChipDropperTest behavior).
 */
export function useChipPileSync(ref: RefObject<ChipPileHandle | null>, balance: number): void {
  const prevRef = useRef<number | null>(null);
  useEffect(() => {
    const b = Math.max(0, Math.floor(balance));
    const pile = ref.current;
    if (prevRef.current === null) {
      prevRef.current = b;
      pile?.resetToCount(b);
      return;
    }
    const prev = prevRef.current;
    if (b < prev) pile?.resetToCount(b);
    else if (b > prev) {
      for (let i = prev; i < b; i++) pile?.spawn();
    }
    prevRef.current = b;
  }, [balance, ref]);
}
