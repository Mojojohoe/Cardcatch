import type { ReactNode } from 'react';

/**
 * Single outcome row for a configurable wheel. `probability` acts as a weight multiplier
 * (same relative scale as `gameService` slice weights).
 */
export type WheelOutcomeInput = {
  id: string;
  /** Logical / message key (e.g. GAME OVER, LOSE_ROUND) */
  label: string;
  /** Text on the slice; falls back to formatted `label` */
  display?: string;
  color: string | 'alternating';
  probability?: number;
  /** Rich content inside the slice (SVG, icon). If set, used instead of text when provided. */
  content?: ReactNode;
  /** Style hint for default text rendering */
  textTone?: 'default' | 'danger' | 'muted';
};

export type WheelHubConfig =
  | { mode: 'text'; text: string; className?: string; innerClassName?: string }
  | { mode: 'node'; node: ReactNode };

export type WheelDefinition = {
  /** Stable id (telemetry, tests) */
  id: string;
  /** Human name */
  name: string;
  outerEdgeColor: string;
  color1: string;
  color2: string;
  tickerColor: string;
  /** Seconds for one full spin animation (Framer motion) */
  spinDurationSeconds: number;
  /** Full 360° spins added while `spinning` is true */
  extraSpinsWhileSpinning: number;
  /** Center disk (optional if `renderCenter` passed to component) */
  hub?: WheelHubConfig;
  outcomes: readonly WheelOutcomeInput[];
  /** Border width in px (Tailwind-like ring) */
  outerEdgeWidthPx?: number;
  /** Slice divider lines */
  showSliceDividers?: boolean;
  dividerOpacity?: number;
};

export type ResolvedWheelSegment = {
  id: string;
  label: string;
  display: string;
  weight: number;
  color: string;
  startAngleDeg: number;
  sweepAngleDeg: number;
  startPercent: number;
  endPercent: number;
  content?: ReactNode;
  textTone: NonNullable<WheelOutcomeInput['textTone']>;
};
