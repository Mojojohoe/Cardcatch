export type { WheelDefinition, WheelOutcomeInput, ResolvedWheelSegment, WheelHubConfig } from './types';
export { resolveWheelSegments, conicGradientStops, weightedOffsetToLandingAngleDeg, wheelDiscRotationDeg } from './resolveSegments';
export { ConfigurableWheel } from './ConfigurableWheel';
export type { ConfigurableWheelProps } from './ConfigurableWheel';
export {
  DESPERATION_SLICE_ROWS,
  DESPERATION_GAME_SLICES,
  FORTUNE_SLICE_ROWS,
  FORTUNE_GAME_SLICES,
  SLOTH_DREAM_SLICE_ROWS,
  SLOTH_DREAM_GAME_SLICES,
} from './presets';
export type { SlothDreamWheelLabel } from './presets';
export {
  desperationWheelDefinition,
  fortuneWheelDefinition,
  slothDreamWheelDefinition,
  buildTargetSuitWheelDefinition,
} from './definitions';
