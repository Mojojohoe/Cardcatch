import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import type { ResolvedWheelSegment, WheelDefinition } from './types';
import { conicGradientStops, wheelDiscRotationDeg } from './resolveSegments';

export interface ConfigurableWheelProps {
  definition: WheelDefinition;
  segments: ResolvedWheelSegment[];
  offset: number;
  spinning: boolean;
  sizeClass?: string;
  /** When set, overrides weight-based landing angle (target suit legacy motion). */
  discRotationDeg?: number;
  /** Replaces hub from definition (e.g. Desperation SPIN button). */
  renderCenter?: React.ReactNode;
  decorativeRings?: boolean;
  className?: string;
}

function Hub({
  definition,
  renderCenter,
}: {
  definition: WheelDefinition;
  renderCenter?: React.ReactNode;
}) {
  if (renderCenter != null) return <>{renderCenter}</>;
  const hub = definition.hub;
  if (!hub) return null;
  if (hub.mode === 'node') return <>{hub.node}</>;
  return (
    <div className={hub.className}>
      <span className={hub.innerClassName}>{hub.text}</span>
    </div>
  );
}

export const ConfigurableWheel: React.FC<ConfigurableWheelProps> = ({
  definition,
  segments,
  offset,
  spinning,
  sizeClass = 'w-72 h-72',
  discRotationDeg: explicitRotation,
  renderCenter,
  decorativeRings = false,
  className = '',
}) => {
  const gradient = useMemo(() => conicGradientStops(segments), [segments]);

  const rotateDeg =
    explicitRotation !== undefined
      ? explicitRotation
      : wheelDiscRotationDeg({
          offset,
          spinning,
          segments,
          extraSpins: definition.extraSpinsWhileSpinning,
        });

  const labelFontPx = Math.max(
    6.5,
    Math.min(14, Math.floor(215 / Math.max(segments.length, 3))),
  );

  const borderW = definition.outerEdgeWidthPx ?? 10;

  const totalW = segments.reduce((a, s) => a + s.weight, 0) || 1;

  return (
    <div
      className={`relative isolate mx-auto aspect-square shrink-0 min-h-0 min-w-0 ${sizeClass} ${className}`.trim()}
    >
      {decorativeRings && (
        <>
          <div className="animate-[spin_20s_linear_infinite] pointer-events-none absolute -inset-4 rounded-full border border-purple-500/10" />
          <div className="animate-[spin_30s_linear_infinite_reverse] pointer-events-none absolute -inset-8 rounded-full border border-purple-500/5" />
        </>
      )}

      <div
        className="pointer-events-none absolute left-1/2 z-40 flex -translate-x-1/2 flex-col items-center drop-shadow-[0_0_12px_rgba(250,204,21,0.45)]"
        style={{
          top: decorativeRings ? '-0.5rem' : '-0.35rem',
        }}
      >
        <div
          className="h-0 w-0 border-l-[12px] border-r-[12px] border-t-[14px] border-l-transparent border-r-transparent"
          style={{ borderTopColor: definition.tickerColor }}
        />
      </div>

      <motion.div
        animate={{ rotate: rotateDeg }}
        transition={{
          duration: spinning ? definition.spinDurationSeconds : 0.22,
          ease: [0.12, 0, 0, 1],
        }}
        className="absolute inset-0 overflow-hidden rounded-full shadow-[0_0_40px_rgba(0,0,0,0.35)]"
        style={{
          border: `${borderW}px solid ${definition.outerEdgeColor}`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `conic-gradient(${gradient})`,
          }}
        />

        {definition.showSliceDividers !== false && (
          <svg
            viewBox="0 0 100 100"
            className="pointer-events-none absolute inset-0 size-full"
            style={{ opacity: definition.dividerOpacity ?? 0.28 }}
          >
            {segments.map((_, idx) => {
              const wAtEnd = segments.slice(0, idx + 1).reduce((a, x) => a + x.weight, 0);
              const angle = (wAtEnd / totalW) * 360;
              const x2 = 50 + 50 * Math.cos(((angle - 90) * Math.PI) / 180);
              const y2 = 50 + 50 * Math.sin(((angle - 90) * Math.PI) / 180);
              return (
                <line key={`div-${idx}`} x1="50" y1="50" x2={x2} y2={y2} stroke="white" strokeWidth="0.35" />
              );
            })}
          </svg>
        )}

        {segments.map((s) => {
          const midDeg = s.startAngleDeg + s.sweepAngleDeg / 2;
          const textCls =
            s.textTone === 'danger'
              ? 'text-red-500'
              : s.textTone === 'muted'
                ? 'text-white/70'
                : 'text-white/90';

          return (
            <div
              key={s.id}
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ transform: `rotate(${midDeg - 90}deg)` }}
            >
              <div className="absolute right-[5%] flex w-[32%] flex-col items-center justify-center gap-0.5 text-center sm:right-[4%] sm:w-[30%]">
                {s.content != null ? (
                  <span className="flex items-center justify-center drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]">
                    {s.content}
                  </span>
                ) : (
                  <span
                    className={`whitespace-normal break-words font-black uppercase leading-tight tracking-wide ${textCls}`}
                    style={{
                      fontSize: `${labelFontPx}px`,
                      maxHeight: `${labelFontPx * 3}px`,
                      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                    }}
                  >
                    {s.display}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>

      <div className="pointer-events-auto absolute inset-0 z-[15] flex items-center justify-center">
        <Hub definition={definition} renderCenter={renderCenter} />
      </div>
    </div>
  );
};
