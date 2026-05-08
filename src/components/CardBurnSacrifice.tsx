import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CardVisual } from './GameVisuals';
import { cardArtAssetUrl } from '../cardArt/paths';
import './CardBurnSacrifice.css';

const BURN_START_DELAY_MS = 100;
/** Sprite run is 2s; hide face slightly before strip end. */
const HIDE_CARD_AFTER_MS = 1900;

/** Original CodePen viewport height — sprite keyframes authored at this height. */
export const CARD_BURN_DESIGN_VIEWPORT_H = 430;
/** Horizontal scroll extent of burn.jpg / burnline.jpg strip animation (50 steps). */
const STRIP_END_OFFSET_PX = -38145;

export interface CardBurnSacrificeProps {
  cardId: string;
  /** Large preview lab vs compact in-game overlay. */
  variant?: 'preview' | 'compact';
}

/**
 * Chernobyl-style horizontal sprite burn (burn.jpg + burnline.jpg strips).
 * Stage is card-shaped (24:37); sprite viewport (770×430 design) is scaled so **strip height = stage height**,
 * wider strip overflows horizontally and is clipped — matches card silhouette.
 * @see https://codepen.io/jcoulterdesign/pen/YbBoNb
 */
export const CardBurnSacrifice: React.FC<CardBurnSacrificeProps> = ({ cardId, variant = 'preview' }) => {
  const [burnOn, setBurnOn] = useState(false);
  const [hideFace, setHideFace] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stripEndPx, setStripEndPx] = useState(STRIP_END_OFFSET_PX);

  const burnUrl = cardArtAssetUrl('burn.jpg');
  const burnLineUrl = cardArtAssetUrl('burnline.jpg');

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const sync = () => {
      const h = el.getBoundingClientRect().height;
      if (h < 8) return;
      setStripEndPx((STRIP_END_OFFSET_PX * h) / CARD_BURN_DESIGN_VIEWPORT_H);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [variant, cardId]);

  useEffect(() => {
    const t0 = window.setTimeout(() => setBurnOn(true), BURN_START_DELAY_MS);
    const t1 = window.setTimeout(() => setHideFace(true), HIDE_CARD_AFTER_MS);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [cardId]);

  return (
    <div
      ref={stageRef}
      className={`card-burn-sacrifice__stage ${variant === 'compact' ? 'card-burn-sacrifice__stage--compact' : ''}`}
      style={{ ['--burn-strip-end' as string]: `${stripEndPx}px` }}
    >
      <div className={`card-burn-image ${burnOn ? 'card-burn-image--burn' : ''}`}>
        <div
          className="card-burn-image__layer card-burn-image__burn"
          style={{ backgroundImage: `url(${burnUrl})` }}
          aria-hidden
        />
        <div
          className={`card-burn-image__layer card-burn-image__original ${hideFace ? 'card-burn-image__original--hidden' : ''}`}
        >
          <div className="card-burn-image__cardMount">
            <CardVisual
              card={cardId}
              revealed
              noAnimate
              presentation="none"
              fillParent
              small={variant === 'compact'}
            />
          </div>
        </div>
        <div
          className="card-burn-image__layer card-burn-image__burnline"
          style={{ backgroundImage: `url(${burnLineUrl})` }}
          aria-hidden
        />
      </div>
    </div>
  );
};
