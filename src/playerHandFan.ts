/**
 * Client-only fan layout for the local player's hand (poker-style arc).
 * Rotation and spread scale with hand size so tops stay readable.
 * Horizontal span can be squeezed toward 1 via {@link computeHandFanSqueeze} when the row is narrow.
 */

/** Matches {@link PC_ASM_MD} (`w-[3.6rem] sm:w-[7.2rem]`) at 16px root. */
export const HAND_FAN_CARD_WIDTH_PX = { compact: 57.6, wide: 115.2 } as const;

/** Matches `-space-x-6` / `sm:-space-x-9` (1.5rem / 2.25rem). */
export const HAND_FAN_OVERLAP_PX = { compact: 24, wide: 36 } as const;

const CARD_ASPECT_H_OVER_W = 37 / 24;

export type HandFanBreakpoint = 'compact' | 'wide';

export function playerHandFanMotion(
  index: number,
  count: number,
  squeeze = 1,
): { rotate: number; x: number; y: number; baseZ: number } {
  if (count <= 1) {
    return { rotate: 0, x: 0, y: 0, baseZ: 16 };
  }
  const mid = (count - 1) / 2;
  const d = index - mid;
  const denom = count - 1;
  const squeezeForSpread = Math.max(0.12, squeeze * squeeze);
  /** Total arc across the hand (degrees), capped so large hands stay subtle. */
  const maxArcDeg = Math.min(58, 24 + denom * 3.15) * (0.65 + 0.35 * squeeze);
  const rotate = denom > 0 ? (d / denom) * maxArcDeg : 0;
  /** Horizontal spread (px) per step from center — aggressively compressed as hand grows. */
  const spreadPx = (8 + Math.max(0, 8 - count) * 0.75) * squeezeForSpread;
  const x = d * spreadPx;
  const edge = mid > 0 ? Math.abs(d) / mid : 0;
  /** Outer cards drop lower so top edge reads as a smooth curve (circular-arc easing). */
  const curveDepth = 12 + Math.min(26, count * 1.2) + (1 - squeeze) * 22;
  /** Lift the whole hand while keeping proportional outer drop. */
  const baseLift = 7 + Math.min(6, count * 0.3);
  const edgeEase = 1 - Math.cos(edge * (Math.PI / 2));
  const y = -baseLift + edgeEase * curveDepth;
  const baseZ = Math.round(14 + mid - Math.abs(index - mid));
  return { rotate, x, y, baseZ };
}

/** Bounding width (px) of the fanned hand for the given squeeze and breakpoint. */
export function estimateHandFanWidthPx(count: number, squeeze: number, layout: HandFanBreakpoint): number {
  if (count <= 0) return 0;
  const w = layout === 'wide' ? HAND_FAN_CARD_WIDTH_PX.wide : HAND_FAN_CARD_WIDTH_PX.compact;
  const o = layout === 'wide' ? HAND_FAN_OVERLAP_PX.wide : HAND_FAN_OVERLAP_PX.compact;
  const h = w * CARD_ASPECT_H_OVER_W;
  const stackW = count * w - (count - 1) * o;
  if (count <= 1) return stackW;

  const mid = (count - 1) / 2;
  const denom = count - 1;
  const squeezeForSpread = Math.max(0.12, squeeze * squeeze);
  const maxArcDeg = Math.min(58, 24 + denom * 3.15) * (0.65 + 0.35 * squeeze);
  const spreadPx = (8 + Math.max(0, 8 - count) * 0.75) * squeezeForSpread;

  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < count; i++) {
    const d = i - mid;
    const rotateDeg = denom > 0 ? (d / denom) * maxArcDeg : 0;
    const fanX = d * spreadPx;
    const cx = i * (w - o) + w / 2 + fanX;
    const rad = (rotateDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners = [
      { lx: -w / 2, ly: -h },
      { lx: w / 2, ly: -h },
      { lx: -w / 2, ly: 0 },
      { lx: w / 2, ly: 0 },
    ];
    for (const c of corners) {
      const wx = c.lx * cos - c.ly * sin + cx;
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
    }
  }
  return maxX - minX;
}

/**
 * Returns a squeeze factor in (0, 1] so the hand fits `containerWidthPx`.
 * Uses binary search on {@link estimateHandFanWidthPx} (see fan math discussion:
 * [Game Development SE](https://gamedev.stackexchange.com/questions/22162/how-can-i-evenly-fan-out-a-hand-of-cards)).
 */
export function computeHandFanSqueeze(
  count: number,
  containerWidthPx: number,
  layout: HandFanBreakpoint,
): number {
  if (count <= 1) return 1;
  const padding = 16;
  const target = Math.max(64, containerWidthPx - padding);
  if (estimateHandFanWidthPx(count, 1, layout) <= target) return 1;

  let lo = 0.1;
  let hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (estimateHandFanWidthPx(count, mid, layout) <= target) lo = mid;
    else hi = mid;
  }
  return lo;
}
