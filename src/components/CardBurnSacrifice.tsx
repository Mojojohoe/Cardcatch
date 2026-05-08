import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CardVisual } from './GameVisuals';
import { cardArtAssetUrl } from '../cardArt/paths';
import { PC_HAND } from '../cardUiDimensions';
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
 * The JPG strips are scaled to **hand-card height** ({@link PC_HAND} / {@link PC_HAND_VEC_SM}), not the other way around.
 * Wider 770:430 viewport overflows horizontally and is clipped to the card silhouette.
 * Preview mode wraps the stack in a uniform CSS scale so the lab stays readable.
 * @see https://codepen.io/jcoulterdesign/pen/YbBoNb
 */
export const CardBurnSacrifice: React.FC<CardBurnSacrificeProps> = ({ cardId, variant = 'preview' }) => {
  const [burnOn, setBurnOn] = useState(false);
  const [hideFace, setHideFace] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const [stripEndPx, setStripEndPx] = useState(STRIP_END_OFFSET_PX);

  const burnUrl = cardArtAssetUrl('burn.jpg');
  const burnLineUrl = cardArtAssetUrl('burnline.jpg');

  /** In-game overlay matches full hand-card footprint (not the narrow SM vector slot). */
  const sizerClass = PC_HAND;

  useLayoutEffect(() => {
    const el = measureRef.current;
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

  const burnStack = (
    <div ref={measureRef} className={`card-burn-sacrifice__sizer relative ${sizerClass}`}>
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
            <CardVisual card={cardId} revealed noAnimate presentation="none" small={false} />
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

  return (
    <div
      className={`card-burn-sacrifice__stage ${variant === 'preview' ? 'card-burn-sacrifice__stage--preview' : ''} ${variant === 'compact' ? 'card-burn-sacrifice__stage--compact' : ''}`}
      style={{ ['--burn-strip-end' as string]: `${stripEndPx}px` }}
    >
      {variant === 'preview' ? <div className="card-burn-sacrifice__zoom">{burnStack}</div> : burnStack}
    </div>
  );
};
