import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { ChipPileHandle } from '../hooks/useChipPileSync';

const MAX_VISIBLE = 140;
const SPAWN_STAGGER_MS = 72;
/** Vertical offset between disc centers in the tipped stack (screen px before rotateX). */
const STACK_STEP_PX = 5.5;
const DISC_W_PX = 52;
const DISC_H_PX = 13;

function hexToRgb(hex: number): { r: number; g: number; b: number } {
  return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
}

type TokenTowerStackProps = {
  chipColor: number;
  chipEmissive: number;
  className?: string;
  pileAccent?: boolean;
};

/**
 * Deterministic “poker chip” tower: fake-3D via CSS perspective + stacked ellipses.
 * Drops settle in tight sequence ({@link SPAWN_STAGGER_MS}); {@link ChipPileHandle.resetToCount} snaps instantly.
 */
export const TokenTowerStack = forwardRef<ChipPileHandle, TokenTowerStackProps>(function TokenTowerStack(
  { chipColor, chipEmissive, className, pileAccent = false },
  ref,
) {
  const [target, setTarget] = useState(0);
  const [visible, setVisible] = useState(0);

  const base = useMemo(() => hexToRgb(chipColor), [chipColor]);
  const glow = useMemo(() => hexToRgb(chipEmissive), [chipEmissive]);

  useImperativeHandle(
    ref,
    () => ({
      spawn: () => setTarget((t) => Math.min(t + 1, MAX_VISIBLE)),
      resetToCount: (count) => {
        const n = Math.min(MAX_VISIBLE, Math.max(0, Math.floor(count)));
        setTarget(n);
        setVisible(n);
      },
    }),
    [],
  );

  useEffect(() => {
    if (visible >= target) return;
    const id = window.setTimeout(() => {
      setVisible((v) => Math.min(v + 1, target));
    }, SPAWN_STAGGER_MS);
    return () => window.clearTimeout(id);
  }, [visible, target]);

  const dropTravel = Math.min(220, 140 + visible * 0.35);

  return (
    <div
      className={`pointer-events-none relative h-full min-h-[120px] w-full overflow-hidden touch-none ${className ?? ''}`}
      aria-hidden
    >
      <div
        className="absolute inset-0 flex items-end justify-center"
        style={{ perspective: '820px', perspectiveOrigin: '50% 88%' }}
      >
        <div
          className="relative mx-auto mb-[8%] w-[min(7rem,38%)] max-w-none"
          style={{
            aspectRatio: '1 / 1.15',
            transform: 'rotateX(66deg) rotateZ(-11deg)',
            transformOrigin: '50% 100%',
            transformStyle: 'preserve-3d',
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-[78%]">
            {Array.from({ length: visible }).map((_, i) => {
              const lift = i * STACK_STEP_PX;
              const isTop = i === visible - 1;
              const outerBlur = pileAccent ? 15 : 8;
              const alpha = 0.45 + (pileAccent ? 0.08 : 0);
              return (
                <motion.div
                  key={i}
                  className="absolute left-1/2 rounded-[999px] border border-black/35"
                  style={{
                    width: DISC_W_PX,
                    height: DISC_H_PX,
                    marginLeft: -DISC_W_PX / 2,
                    bottom: lift,
                    zIndex: i,
                    background: `radial-gradient(120% 180% at 28% 22%, rgba(255,255,255,0.38), rgba(${base.r},${base.g},${base.b},0.05)),
                      linear-gradient(185deg, rgba(${base.r},${base.g},${base.b},1) 0%, rgba(${Math.max(base.r - 35, 0)},${Math.max(base.g - 35, 0)},${Math.max(base.b - 35, 0)},1) 48%, rgba(12,12,18,1) 100%)`,
                    boxShadow:
                      `0 ${2 + i * 0.06}px ${outerBlur}px rgba(0,0,0,${alpha}), ` +
                      `inset 0 1px 1px rgba(255,255,255,${0.22 + (pileAccent && isTop ? 0.2 : 0)}), ` +
                      `inset 0 -2px 4px rgba(0,0,0,0.52)` +
                      (pileAccent && isTop ? `, 0 0 18px rgba(${glow.r},${glow.g},${glow.b},0.85)` : ''),
                  }}
                  initial={{ y: -dropTravel, opacity: 0.45, scaleX: 0.88, scaleY: 0.78 }}
                  animate={{ y: 0, opacity: 1, scaleX: 1, scaleY: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 26,
                    mass: 0.72,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
