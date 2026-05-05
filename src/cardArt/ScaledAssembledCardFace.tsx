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
 * Scales 256×374 art to fit inside the parent box (uniform scale, centered) so hand rows match vector footprints.
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
      const h = rect.height > 0.5 ? rect.height : el.clientHeight;
      if (w > 0.5 && h > 0.5) {
        setScale(Math.min(w / CARD_ART_WIDTH, h / CARD_ART_HEIGHT));
      } else if (w > 0.5) {
        setScale(w / CARD_ART_WIDTH);
      }
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
      className={`relative h-full w-full min-h-0 overflow-hidden rounded-[inherit] ${className ?? ''}`}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: CARD_ART_WIDTH + 2,
          height: CARD_ART_HEIGHT + 2,
          marginLeft: -(CARD_ART_WIDTH + 2) / 2,
          marginTop: -(CARD_ART_HEIGHT + 2) / 2,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <div style={{ position: 'relative', left: -1, top: -1 }}>
          <AssembledPlayingCardFace card={card} override={override} defaults={defaults} />
        </div>
      </div>
    </div>
  );
};
