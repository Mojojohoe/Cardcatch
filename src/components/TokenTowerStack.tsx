import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import type { ChipPileHandle } from '../hooks/useChipPileSync';

const MAX_VISIBLE = 140;
const SPAWN_STAGGER_MS = 72;
/** Vertical spacing between stacked chips (screen space, pre-stage rotate). */
const STACK_STEP_PX = 10;

/** Top face — wider reads as a chip, not a sticker. */
const FACE_W_PX = 60;
const FACE_H_PX = 22;
/**
 * Distance between top face and bottom rim = visible “thickness” before the parent tilt.
 * Larger = fatter poker-chip feel.
 */
const CHIP_THICKNESS_PX = 16;

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
 * Stacked “poker chips”: top face + darker bottom rim reads as a short cylinder instead of a paper-thin ellipse.
 * Gentler perspective (moderate rotateX + slight rotateY) avoids the old sheared-paper look.
 */
export const TokenTowerStack = forwardRef<ChipPileHandle, TokenTowerStackProps>(function TokenTowerStack(
  { chipColor, chipEmissive, className, pileAccent = false },
  ref,
) {
  const [target, setTarget] = useState(0);
  const [visible, setVisible] = useState(0);

  const base = useMemo(() => hexToRgb(chipColor), [chipColor]);
  const glow = useMemo(() => hexToRgb(chipEmissive), [chipEmissive]);

  const darker = useMemo(
    () => ({
      r: Math.max(0, Math.round(base.r * 0.52)),
      g: Math.max(0, Math.round(base.g * 0.52)),
      b: Math.max(0, Math.round(base.b * 0.52)),
    }),
    [base.r, base.g, base.b],
  );

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

  const faceGrad = `radial-gradient(120% 165% at 32% 24%, rgba(255,255,255,0.42), rgba(${base.r},${base.g},${base.b},0.08)),
    linear-gradient(188deg, rgba(${base.r},${base.g},${base.b},1) 0%, rgba(${Math.max(base.r - 28, 0)},${Math.max(base.g - 28, 0)},${Math.max(base.b - 28, 0)},1) 55%, rgba(${darker.r},${darker.g},${darker.b},1) 100%)`;

  const rimGrad = `linear-gradient(180deg, rgba(${darker.r},${darker.g},${darker.b},0.55) 0%, rgba(8,8,12,0.92) 100%)`;

  return (
    <div
      className={`pointer-events-none relative h-full min-h-[120px] w-full overflow-hidden touch-none ${className ?? ''}`}
      aria-hidden
    >
      <div
        className="absolute inset-0 flex items-end justify-center"
        style={{ perspective: '980px', perspectiveOrigin: '50% 92%' }}
      >
        <div
          className="relative mx-auto mb-[7%] w-[min(7.5rem,40%)] max-w-none"
          style={{
            aspectRatio: '1 / 1.12',
            /** ~isometric: enough depth to read stack, not so much that ellipses squash to ribbons. */
            transform: 'rotateX(44deg) rotateY(-14deg) rotateZ(-4deg)',
            transformOrigin: '50% 100%',
            transformStyle: 'preserve-3d',
          }}
        >
          <div className="absolute inset-x-0 bottom-0 h-[82%]">
            {Array.from({ length: visible }).map((_, i) => {
              const lift = i * STACK_STEP_PX;
              const isTop = i === visible - 1;
              const outerBlur = pileAccent ? 16 : 9;
              const alpha = 0.48 + (pileAccent ? 0.08 : 0);
              return (
                <motion.div
                  key={i}
                  className="absolute left-1/2"
                  style={{
                    width: FACE_W_PX,
                    height: FACE_H_PX + CHIP_THICKNESS_PX + 6,
                    marginLeft: -FACE_W_PX / 2,
                    bottom: lift,
                    zIndex: i,
                  }}
                  initial={{ y: -dropTravel, opacity: 0.5, scale: 0.92 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 26,
                    mass: 0.72,
                  }}
                >
                  {/* Bottom rim — reads as the far edge of the cylinder. */}
                  <div
                    className="pointer-events-none absolute left-1/2 rounded-full border border-black/40"
                    style={{
                      width: FACE_W_PX * 0.92,
                      height: FACE_H_PX * 0.72,
                      marginLeft: -(FACE_W_PX * 0.92) / 2,
                      bottom: 2,
                      background: rimGrad,
                      boxShadow:
                        'inset 0 2px 3px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(255,255,255,0.06)',
                    }}
                    aria-hidden
                  />
                  {/* Side wall — short band between rims for “fat” chip body. */}
                  <div
                    className="pointer-events-none absolute left-1/2 overflow-hidden rounded-[10px] border-x border-black/30"
                    style={{
                      width: FACE_W_PX * 0.88,
                      height: CHIP_THICKNESS_PX * 0.72,
                      marginLeft: -(FACE_W_PX * 0.88) / 2,
                      bottom: FACE_H_PX * 0.38,
                      background: `linear-gradient(90deg,
                        rgba(0,0,0,0.35) 0%,
                        rgba(${darker.r},${darker.g},${darker.b},0.95) 22%,
                        rgba(${base.r},${base.g},${base.b},0.85) 50%,
                        rgba(${darker.r},${darker.g},${darker.b},0.95) 78%,
                        rgba(0,0,0,0.35) 100%)`,
                      boxShadow: 'inset 0 0 6px rgba(0,0,0,0.35)',
                    }}
                    aria-hidden
                  />
                  {/* Top face */}
                  <div
                    className="pointer-events-none absolute left-1/2 rounded-full border border-black/35"
                    style={{
                      width: FACE_W_PX,
                      height: FACE_H_PX,
                      marginLeft: -FACE_W_PX / 2,
                      bottom: CHIP_THICKNESS_PX * 0.92,
                      background: faceGrad,
                      boxShadow:
                        `0 ${1.5 + i * 0.05}px ${outerBlur}px rgba(0,0,0,${alpha}), ` +
                        `inset 0 2px 2px rgba(255,255,255,${0.26 + (pileAccent && isTop ? 0.18 : 0)}), ` +
                        `inset 0 -3px 5px rgba(0,0,0,0.5)` +
                        (pileAccent && isTop ? `, 0 0 20px rgba(${glow.r},${glow.g},${glow.b},0.88)` : ''),
                    }}
                    aria-hidden
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
