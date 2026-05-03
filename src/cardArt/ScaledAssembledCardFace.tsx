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
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / CARD_ART_WIDTH);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full overflow-hidden rounded-[inherit] ${className ?? ''}`}
      style={{ aspectRatio: `${CARD_ART_WIDTH} / ${CARD_ART_HEIGHT}` }}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: CARD_ART_WIDTH,
          height: CARD_ART_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <AssembledPlayingCardFace card={card} override={override} defaults={defaults} />
      </div>
    </div>
  );
};
