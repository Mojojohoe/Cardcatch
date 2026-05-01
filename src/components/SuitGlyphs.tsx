import React from 'react';

/** Bootstrap Icons `moon-fill` (MIT) — viewBox 0 0 16 16 */
const MOON_FILL_D =
  'M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278';

/** Bootstrap Icons `c-circle-fill` — viewBox 0 0 16 16 */
const C_CIRCLE_FILL_D =
  'M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M8.146 4.992c.961 0 1.641.633 1.729 1.512h1.295v-.088c-.094-1.518-1.348-2.572-3.03-2.572-2.068 0-3.269 1.377-3.269 3.638v1.073c0 2.267 1.178 3.603 3.27 3.603 1.675 0 2.93-1.02 3.029-2.467v-.093H9.875c-.088.832-.75 1.418-1.729 1.418-1.224 0-1.927-.891-1.927-2.461v-1.06c0-1.583.715-2.503 1.927-2.503';

const BONE_D =
  'M505.352,118.176c-7.68-66.438-74.119-48.552-99.658-28.111c-25.548,20.45-6.404-16.61,15.323-28.102   c25.262-13.38,15.333-38.327-12.77-56.223c-28.102-17.886-88.165,6.394-93.264,67.725c-3.84,45.893,10.216,56.213-25.567,91.987c0,0-78.407,80.294-103.974,105.861c-25.548,25.557-61.321,45.988-106.042,44.711c-44.711-1.276-76.654,30.666-72.88,74.139c3.773,43.473,62.674,53.631,69.83,32.056c7.176-21.594,29.874-23.137,29.874-23.137c-3.84,6.384-38.317,56.214-1.276,95.828c37.059,39.613,108.615,6.385,99.658-58.787c-8.234-60.148-43.168-16.199-13.77-45.588   c29.388-29.38,175.235-175.244,175.235-175.244c23.013-23.004,43.454-24.281,69.002-26.844   C460.64,185.882,510.945,166.672,505.352,118.176z';

const FROG_D =
  'M446.53 97.43C439.67 60.23 407.19 32 368 32c-39.23 0-71.72 28.29-78.54 65.54C126.75 112.96-.5 250.12 0 416.98.11 451.9 29.08 480 64 480h304c8.84 0 16-7.16 16-16 0-17.67-14.33-32-32-32h-79.49l35.8-48.33c24.14-36.23 10.35-88.28-33.71-106.6-23.89-9.93-51.55-4.65-72.24 10.88l-32.76 24.59c-7.06 5.31-17.09 3.91-22.41-3.19-5.3-7.08-3.88-17.11 3.19-22.41l34.78-26.09c36.84-27.66 88.28-27.62 125.13 0 10.87 8.15 45.87 39.06 40.8 93.21L469.62 480H560c8.84 0 16-7.16 16-16 0-17.67-14.33-32-32-32h-53.63l-98.52-104.68 154.44-86.65A58.16 58.16 0 0 0 576 189.94c0-21.4-11.72-40.95-30.48-51.23-40.56-22.22-98.99-41.28-98.99-41.28zM368 136c-13.26 0-24-10.75-24-24 0-13.26 10.74-24 24-24 13.25 0 24 10.74 24 24 0 13.25-10.75 24-24 24z';

/** Bootstrap Icons suit/glyph paths (MIT) */
const HEART_D = 'M4.318 6.318C3.56 5.56 3.433 4.433 4.22 3.646c.77-.77 1.952-.812 2.775-.084L8 4.454l1.004-.892c.823-.728 2.006-.686 2.775.084.787.787.661 1.914-.097 2.672L8 10z';
const DIAMOND_D = 'M8 1.314 3.3 8 8 14.686 12.7 8z';
const CLUB_D = 'M8 1a2.5 2.5 0 0 1 2.495 2.336A2.5 2.5 0 1 1 8 8a2.5 2.5 0 1 1-2.495-4.664A2.5 2.5 0 0 1 8 1m0 7.5c.552 0 1 .448 1 1v1.05c0 .478.134.947.386 1.353L10 13H6l.614-1.097A2.75 2.75 0 0 0 7 10.55V9.5c0-.552.448-1 1-1';
const SPADE_D = 'M7.184 1.122a1 1 0 0 1 1.632 0c1.743 2.18 4.816 4.4 4.816 6.878a2.75 2.75 0 0 1-5.378.86h-.508a2.75 2.75 0 0 1-5.378-.86c0-2.478 3.073-4.698 4.816-6.878M8 9.5c.552 0 1 .448 1 1v.05c0 .478.134.947.386 1.353L10 13H6l.614-1.097A2.75 2.75 0 0 0 7 10.55v-.05c0-.552.448-1 1-1';
const STAR_D = 'm8 1.2 1.95 3.95 4.35.63-3.15 3.07.74 4.33L8 11.15l-3.89 2.03.74-4.33L1.7 5.78l4.35-.63z';

/** Suit icon for layouts that use Tailwind + `currentColor` (corners on cards, HUD, etc.). */
export const SuitGlyph: React.FC<{ suit: string; className?: string }> = ({ suit, className = 'w-4 h-4' }) => {
  if (suit === 'Moons') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden>
        <path fill="currentColor" d={MOON_FILL_D} />
      </svg>
    );
  }
  if (suit === 'Coins') {
    return (
      <svg viewBox="0 0 16 16" className={className} aria-hidden>
        <path fill="currentColor" d={C_CIRCLE_FILL_D} />
      </svg>
    );
  }
  if (suit === 'Bones') {
    return (
      <svg viewBox="0 0 520 520" className={className} aria-hidden>
        <path fill="currentColor" d={BONE_D} />
      </svg>
    );
  }
  if (suit === 'Frogs') {
    return (
      <svg viewBox="0 0 576 480" className={className} aria-hidden>
        <path fill="currentColor" d={FROG_D} />
      </svg>
    );
  }
  if (suit === 'Hearts') return <svg viewBox="0 0 16 16" className={className} aria-hidden><path fill="currentColor" d={HEART_D} /></svg>;
  if (suit === 'Diamonds') return <svg viewBox="0 0 16 16" className={className} aria-hidden><path fill="currentColor" d={DIAMOND_D} /></svg>;
  if (suit === 'Clubs') return <svg viewBox="0 0 16 16" className={className} aria-hidden><path fill="currentColor" d={CLUB_D} /></svg>;
  if (suit === 'Spades') return <svg viewBox="0 0 16 16" className={className} aria-hidden><path fill="currentColor" d={SPADE_D} /></svg>;
  return <svg viewBox="0 0 16 16" className={className} aria-hidden><path fill="currentColor" d={STAR_D} /></svg>;
};

type SuitSvgMarkerProps = { suit: string; size: number; x: number; y: number; fill: string };

/**
 * Inline SVG &lt;g&gt; for a target-wheel slice (parent SVG viewBox 0 0 100 100).
 * Center marker around (x, y) with rough pixel size `size`.
 */
export const SuitWheelMarkerG: React.FC<SuitSvgMarkerProps> = ({ suit, size, x, y, fill }) => {
  const half = size / 2;
  if (suit === 'Moons') {
    return (
      <g transform={`translate(${x - half} ${y - half}) scale(${size / 16})`}>
        <path fill={fill} d={MOON_FILL_D} />
      </g>
    );
  }
  if (suit === 'Coins') {
    return (
      <g transform={`translate(${x - half} ${y - half}) scale(${size / 16})`}>
        <path fill={fill} d={C_CIRCLE_FILL_D} />
      </g>
    );
  }
  if (suit === 'Bones') {
    return (
      <g transform={`translate(${x - half} ${y - half}) scale(${size / 520})`}>
        <path fill={fill} d={BONE_D} />
      </g>
    );
  }
  if (suit === 'Frogs') {
    return (
      <g transform={`translate(${x - half} ${y - half * 0.85}) scale(${size / 576})`}>
        <path fill={fill} d={FROG_D} />
      </g>
    );
  }
  if (suit === 'Hearts') return <g transform={`translate(${x - half} ${y - half}) scale(${size / 16})`}><path fill={fill} d={HEART_D} /></g>;
  if (suit === 'Diamonds') return <g transform={`translate(${x - half} ${y - half}) scale(${size / 16})`}><path fill={fill} d={DIAMOND_D} /></g>;
  if (suit === 'Clubs') return <g transform={`translate(${x - half} ${y - half}) scale(${size / 16})`}><path fill={fill} d={CLUB_D} /></g>;
  if (suit === 'Spades') return <g transform={`translate(${x - half} ${y - half}) scale(${size / 16})`}><path fill={fill} d={SPADE_D} /></g>;
  return <g transform={`translate(${x - half} ${y - half}) scale(${size / 16})`}><path fill={fill} d={STAR_D} /></g>;
};
