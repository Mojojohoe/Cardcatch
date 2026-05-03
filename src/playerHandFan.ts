/**
 * Client-only fan layout for the local player's hand (poker-style arc).
 * Rotation and spread scale with hand size so tops stay readable.
 */
export function playerHandFanMotion(
  index: number,
  count: number,
): { rotate: number; x: number; baseZ: number } {
  if (count <= 1) {
    return { rotate: 0, x: 0, baseZ: 16 };
  }
  const mid = (count - 1) / 2;
  const d = index - mid;
  const denom = count - 1;
  /** Total arc across the hand (degrees), capped so large hands stay subtle. */
  const maxArcDeg = Math.min(50, 16 + denom * 4.25);
  const rotate = denom > 0 ? (d / denom) * maxArcDeg : 0;
  /** Horizontal spread (px) per step from center — wider when fewer cards. */
  const spreadPx = 11 + Math.max(0, 10 - count) * 1.15;
  const x = d * spreadPx;
  const baseZ = Math.round(14 + mid - Math.abs(index - mid));
  return { rotate, x, baseZ };
}
