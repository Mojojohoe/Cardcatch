import React, { useEffect, useState } from 'react';
import { CardVisual } from './GameVisuals';
import { cardArtAssetUrl } from '../cardArt/paths';
import './CardBurnSacrifice.css';

const BURN_START_DELAY_MS = 100;
/** Sprite run is 2s; hide face slightly before strip end. */
const HIDE_CARD_AFTER_MS = 1900;

export interface CardBurnSacrificeProps {
  cardId: string;
  /** Optional scale for the whole burn block (default matches pen layout). */
  scale?: number;
}

/**
 * Chernobyl-style horizontal sprite burn (burn.jpg + burnline.jpg strips).
 * @see https://codepen.io/jcoulterdesign/pen/YbBoNb
 */
export const CardBurnSacrifice: React.FC<CardBurnSacrificeProps> = ({ cardId, scale = 0.34 }) => {
  const [burnOn, setBurnOn] = useState(false);
  const [hideFace, setHideFace] = useState(false);

  const burnUrl = cardArtAssetUrl('burn.jpg');
  const burnLineUrl = cardArtAssetUrl('burnline.jpg');

  useEffect(() => {
    const t0 = window.setTimeout(() => setBurnOn(true), BURN_START_DELAY_MS);
    const t1 = window.setTimeout(() => setHideFace(true), HIDE_CARD_AFTER_MS);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [cardId]);

  return (
    <div className="card-burn-sacrifice">
      <div
        className="card-burn-sacrifice__scale"
        style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
      >
        <div className={`card-burn-image ${burnOn ? 'card-burn-image--burn' : ''}`}>
          <div
            className="card-burn-image__layer card-burn-image__burn card-burn-image__smoke-sprite"
            style={{ backgroundImage: `url(${burnUrl})` }}
            aria-hidden
          />
          <div
            className={`card-burn-image__layer card-burn-image__original ${hideFace ? 'card-burn-image__original--hidden' : ''}`}
          >
            <div className="card-burn-image__cardMount">
              <CardVisual card={cardId} revealed noAnimate presentation="none" />
            </div>
          </div>
          <div
            className="card-burn-image__layer card-burn-image__burnline card-burn-image__smoke-sprite"
            style={{ backgroundImage: `url(${burnLineUrl})` }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
};
