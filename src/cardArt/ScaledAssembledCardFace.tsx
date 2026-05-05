import React, { useLayoutEffect, useRef, useState } from 'react';
import { AssembledPlayingCardFace, CARD_ART_HEIGHT, CARD_ART_WIDTH } from './AssembledPlayingCardFace';
import { useOptionalCardArt } from './cardArtContext';
import type { CardArtGlobalDefaults, CardArtOverride } from './types';

type Props = {
  card: string;
  override?: CardArtOverride;
  className?: string;
  /**
   * When provided, used instead of persisted context defaults (Card Creator live preview).
   * Pass `undefined` to use context only.
   */
  previewDefaults?: CardArtGlobalDefaults;
};

/**
 * Scales the 256×374 art to the width of the parent while locking aspect ratio.
 */
export const ScaledAssembledCardFace: React.FC<Props> = ({ card, override, className, previewDefaults }) => {
  const ctx = useOptionalCardArt();
  const defaults = previewDefaults !== undefined ? previewDefaults : ctx?.defaults;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width > 0.5 ? rect.width : el.clientWidth;
      if (w > 0.5) setScale(w / CARD_ART_WIDTH);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    /** One deferred measure is enough — double-rAF tended to amplify preview flicker in Card Creator. */
    const raf = requestAnimationFrame(measure);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative min-w-0 w-full overflow-visible rounded-[inherit] ${className ?? ''}`}
      style={{ aspectRatio: `${CARD_ART_WIDTH} / ${CARD_ART_HEIGHT}` }}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          // Tiny bleed prevents browser raster clipping on transformed edges.
          width: CARD_ART_WIDTH + 2,
          height: CARD_ART_HEIGHT + 2,
          left: -1,
          top: -1,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <AssembledPlayingCardFace card={card} override={override} defaults={defaults} />
      </div>
    </div>
  );
};
