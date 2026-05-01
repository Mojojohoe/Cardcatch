export type { WheelDefinition, WheelOutcomeInput, ResolvedWheelSegment, WheelHubConfig } from './types';
export { resolveWheelSegments, conicGradientStops, weightedOffsetToLandingAngleDeg, wheelDiscRotationDeg } from './resolveSegments';
export { ConfigurableWheel } from './ConfigurableWheel';
export type { ConfigurableWheelProps } from './ConfigurableWheel';
export { DESPERATION_SLICE_ROWS, DESPERATION_GAME_SLICES, FORTUNE_SLICE_ROWS, FORTUNE_GAME_SLICES } from './presets';
export {
  desperationWheelDefinition,
  fortuneWheelDefinition,
  buildTargetSuitWheelDefinition,
} from './definitions';
