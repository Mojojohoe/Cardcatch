import React, { forwardRef, useId, useMemo } from 'react';
import { cardArtAssetUrl } from '../cardArt/paths';
import './SacrificialBowl.css';

const BURN_COUNT = 40;

/** Deterministic pseudo-random for flame particle params (stable across renders). */
function burnParam(index: number, slot: number): { h: number; heatH: number; ml: number; dur: number; delay: number } {
  let s = (index * 9973 + slot * 7919 + 104729) >>> 0;
  const rnd = (n: number) => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s % n;
  };
  return {
    heatH: 1 + rnd(10),
    h: 4 + rnd(46),
    ml: rnd(500) - 250,
    dur: 1000 + rnd(2000),
    delay: -3000,
  };
}

const VectorBowlBack: React.FC<{ className?: string; gradId: string }> = ({ className, gradId }) => (
  <svg className={className} viewBox="0 0 200 200" aria-hidden>
    <defs>
      <radialGradient id={gradId} cx="50%" cy="42%" r="65%">
        <stop offset="0%" stopColor="#1c1917" />
        <stop offset="55%" stopColor="#292524" />
        <stop offset="100%" stopColor="#0c0a09" />
      </radialGradient>
    </defs>
    <ellipse cx="100" cy="118" rx="88" ry="42" fill={`url(#${gradId})`} opacity="0.95" />
    <ellipse cx="100" cy="112" rx="78" ry="30" fill="#451a03" opacity="0.55" />
  </svg>
);

const VectorBowlFront: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 200 200" aria-hidden>
    <ellipse
      cx="100"
      cy="118"
      rx="90"
      ry="44"
      fill="none"
      stroke="#d6d3d1"
      strokeWidth="5"
      opacity="0.92"
    />
    <ellipse cx="100" cy="118" rx="84" ry="38" fill="none" stroke="#78716c" strokeWidth="2" opacity="0.7" />
    <path
      d="M 28 118 Q 100 88 172 118"
      fill="none"
      stroke="#a8a29e"
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.85"
    />
  </svg>
);

export interface SacrificialBowlProps {
  /** Raster artwork mode: PNG layers; otherwise vector SVG bowl. */
  rasterMode: boolean;
  /** Compact table placement vs centered focus overlay. */
  expanded: boolean;
  /** Red rim when a dragged card is over the catchment. */
  catchGlow: boolean;
  burnsRemaining: number;
  /** Short post-burn emphasis pulse (expanded overlay). */
  breathe?: boolean;
  className?: string;
}

export const SacrificialBowl = forwardRef<HTMLDivElement, SacrificialBowlProps>(function SacrificialBowl(
  { rasterMode, expanded, catchGlow, burnsRemaining, breathe = false, className },
  ref,
) {
  const uid = useId().replace(/:/g, '');
  const innerGradId = `sb-in-${uid}`;

  const burnStyles = useMemo(() => {
    const rows: React.CSSProperties[] = [];
    for (let i = 0; i < BURN_COUNT * 2; i++) {
      const p = burnParam(i, i < BURN_COUNT ? 0 : 1);
      const isHeat = i < BURN_COUNT;
      rows.push({
        height: isHeat ? p.heatH : p.h,
        marginLeft: p.ml,
        animation: `sacrificial-bowl-burning ${p.dur}ms ${p.delay}ms infinite linear`,
      });
    }
    return rows;
  }, []);

  const bowlInner = rasterMode ? (
    <img
      src={cardArtAssetUrl('firebowl-inner.png')}
      alt=""
      draggable={false}
      className="pointer-events-none h-full w-full object-contain"
    />
  ) : (
    <VectorBowlBack gradId={innerGradId} className="pointer-events-none h-full w-full object-contain" />
  );

  const bowlOuter = rasterMode ? (
    <img
      src={cardArtAssetUrl('firebowl-outer.png')}
      alt=""
      draggable={false}
      className="pointer-events-none h-full w-full object-contain"
    />
  ) : (
    <VectorBowlFront className="pointer-events-none h-full w-full object-contain" />
  );

  const glowRing = catchGlow
    ? 'ring-[3px] ring-red-500/90 ring-offset-[3px] ring-offset-black/25 shadow-[0_0_32px_rgba(239,68,68,0.8)]'
    : 'ring-2 ring-stone-500/55 ring-offset-2 ring-offset-emerald-950/30';

  const bowlFrameClass = expanded
    ? 'sacrificial-bowl-ui sacrificial-bowl-ui--expanded relative h-[min(72vmin,28rem)] w-[min(72vmin,28rem)]'
    : 'sacrificial-bowl-ui relative h-[7rem] w-[7rem] sm:h-[7.5rem] sm:w-[7.5rem]';

  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center justify-center ${className ?? ''}`}
      style={{ pointerEvents: 'auto', ['--sb-fire-compact-scale' as string]: '0.36' } as React.CSSProperties}
    >
      <div
        className={`sacrificial-bowl-breathe-ring relative flex flex-col items-center rounded-full p-1.5 transition-[box-shadow,transform] duration-200 ${glowRing} ${breathe ? 'sacrificial-bowl-breathe-ring--pulse' : ''}`}
      >
        <div className={bowlFrameClass}>
          <div className="pointer-events-none absolute inset-x-2 top-1 z-[32] flex justify-center">
            <span className="font-mono text-[clamp(14px,3.8vmin,20px)] font-black tabular-nums leading-none text-amber-200/95 drop-shadow-[0_0_10px_rgba(0,0,0,0.9),0_0_12px_rgba(251,191,36,0.45)]">
              {burnsRemaining}
              <span className="text-[0.72em] font-bold text-amber-200/65">/2</span>
            </span>
          </div>

          <div className="pointer-events-none absolute inset-[8%] z-0 translate-y-[40%]">{bowlInner}</div>

          <div className="sacrificial-bowl-fire-host overflow-visible">
            <div className="sacrificial-bowl-fire">
              {burnStyles.map((st, i) => (
                <div
                  key={i}
                  className={`sacrificial-bowl-smoke ${i < BURN_COUNT ? 'opacity-80' : ''}`}
                  style={st}
                />
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-[6%] z-10 translate-y-[40%]">{bowlOuter}</div>
        </div>
      </div>
    </div>
  );
});
