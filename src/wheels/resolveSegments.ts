import type { ResolvedWheelSegment, WheelDefinition, WheelOutcomeInput } from './types';

function formatDisplay(o: WheelOutcomeInput): string {
  if (o.display != null && o.display !== '') return o.display;
  return o.label.replaceAll('_', ' ');
}

/**
 * Expands alternating colours, weights, and gradient stops for the renderer.
 */
export function resolveWheelSegments(def: WheelDefinition): ResolvedWheelSegment[] {
  const outcomes = [...def.outcomes];
  const weights = outcomes.map((o) => o.probability ?? 1);
  const totalW = weights.reduce((a, b) => a + b, 0);
  if (totalW <= 0) return [];

  let alt = 0;
  let angle = 0;
  let pct = 0;

  return outcomes.map((o, i) => {
    const w = weights[i];
    const sweepAngleDeg = (w / totalW) * 360;
    const sweepPct = (w / totalW) * 100;
    const startAngleDeg = angle;
    const startPercent = pct;

    let color: string;
    if (o.color === 'alternating') {
      color = alt % 2 === 0 ? def.color1 : def.color2;
      alt += 1;
    } else {
      color = o.color;
    }

    angle += sweepAngleDeg;
    pct += sweepPct;

    return {
      id: o.id,
      label: o.label,
      display: formatDisplay(o),
      weight: w,
      color,
      startAngleDeg,
      sweepAngleDeg,
      startPercent,
      endPercent: pct,
      content: o.content,
      textTone: o.textTone ?? 'default',
    };
  });
}

export function conicGradientStops(segments: ResolvedWheelSegment[]): string {
  return segments.map((s) => `${s.color} ${s.startPercent}% ${s.endPercent}%`).join(', ');
}

/**
 * Maps offset ∈ [0,1) (uniform in **weight** space) to clockwise degrees from top (0° = 12 o’clock),
 * matching how `GameService` picks a slice.
 */
export function weightedOffsetToLandingAngleDeg(
  offset: number,
  segments: readonly Pick<ResolvedWheelSegment, 'weight'>[],
): number {
  const total = segments.reduce((a, s) => a + s.weight, 0);
  if (total <= 0) return 0;
  const t = Math.max(0, Math.min(0.999999, offset)) * total;
  let runningW = 0;
  let runningAngle = 0;
  for (const s of segments) {
    const sliceAngle = (s.weight / total) * 360;
    if (t <= runningW + s.weight) {
      const within = s.weight > 0 ? (t - runningW) / s.weight : 0;
      return runningAngle + within * sliceAngle;
    }
    runningW += s.weight;
    runningAngle += sliceAngle;
  }
  return runningAngle % 360;
}

/**
 * CSS `rotate` for the wheel disc: pointer fixed at top; landing position at `offset` in weight space.
 */
export function wheelDiscRotationDeg(args: {
  offset: number;
  spinning: boolean;
  segments: readonly Pick<ResolvedWheelSegment, 'weight'>[];
  extraSpins: number;
}): number {
  const land = weightedOffsetToLandingAngleDeg(args.offset, args.segments);
  if (args.spinning) {
    return -(args.extraSpins * 360 + land);
  }
  return -land;
}
