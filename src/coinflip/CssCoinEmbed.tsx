/**
 * React embed for the in-app CSS 3D coin (styles in ./coinflip.css).
 * Mirrors script.js: set --flips, strip .anim then add after a tick so keyframes rerun.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import './coinflip.css';

export type CssCoinFlipDegrees = '720deg' | '900deg';

const SEGMENT_COUNT = 16;
const LINE_COUNT = 12;

function SegmentList() {
  return (
    <>
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <div key={i} className="segment" />
      ))}
    </>
  );
}

function LineList() {
  return (
    <>
      {Array.from({ length: LINE_COUNT }, (_, i) => (
        <div key={i} className="line" />
      ))}
    </>
  );
}

export interface CssCoinEmbedProps {
  /** Same as vanilla: 900deg vs 720deg settles which face is up after the flip arc. */
  flipDegrees: CssCoinFlipDegrees;
  /** When true, kicks off one flip on mount / when flipDegrees changes. */
  autoPlay?: boolean;
  onAnimationEnd?: () => void;
  className?: string;
}

export const CssCoinEmbed: React.FC<CssCoinEmbedProps> = ({
  flipDegrees,
  autoPlay = true,
  onAnimationEnd,
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const onAnimationEndRef = useRef(onAnimationEnd);
  onAnimationEndRef.current = onAnimationEnd;

  const runFlip = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const coin = root.querySelector('.coin');
    const objs = root.querySelectorAll('.line, .coin');
    objs.forEach((el) => el.classList.remove('anim'));

    root.style.setProperty('--flips', flipDegrees);

    const settleBusy: EventListener = () => {
      coin?.removeEventListener('animationend', settleBusy);
      if (!rootRef.current) return;
      onAnimationEndRef.current?.();
    };

    coin?.removeEventListener('animationend', settleBusy);
    coin?.addEventListener('animationend', settleBusy);

    window.setTimeout(() => {
      objs.forEach((el) => el.classList.add('anim'));
    }, 0);
  }, [flipDegrees]);

  useEffect(() => {
    if (!autoPlay) return;
    const id = window.setTimeout(() => runFlip(), 50);
    return () => window.clearTimeout(id);
  }, [autoPlay, runFlip]);

  return (
    <div ref={rootRef} className={`coinflip-root rounded-2xl ${className}`} aria-hidden>
      <div className="coinflip-world">
        <div className="floor">
          <LineList />
        </div>
        <div className="coin">
          <div className="edge">
            <SegmentList />
          </div>
        </div>
      </div>
    </div>
  );
};
