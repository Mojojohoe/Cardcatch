import React, { useLayoutEffect, useRef, useState } from 'react';
import { AssembledPlayingCardFace, CARD_ART_HEIGHT, CARD_ART_WIDTH } from './AssembledPlayingCardFace';
import { useOptionalCardArt } from './cardArtContext';
import type { CardArtGlobalDefaults, CardArtOverride } from './types';

/** Matches {@link PC_HAND} portrait ratio (`h/w`); used when layout reports width before height (mode toggle). */
const SLOT_H_OVER_W = 1.5;

type Props = {
  card: string;
  override?: CardArtOverride;
  className?: string;
  /**
   * When provided, used instead of persisted context defaults (Card Creator live preview).
   * Pass `undefined` to use context only.
   */
  previewDefaults?: CardArtGlobalDefaults;
  /**
   * When set, every card in a row can share the same raster scale (avoids per-slot measurement drift in the hand).
   */
  uniformScale?: number;
};

/**
 * Scales 256×374 art to fit inside the parent box (uniform scale, centered) so hand rows match vector footprints.
 */
export const ScaledAssembledCardFace: React.FC<Props> = ({ card, override, className, previewDefaults, uniformScale }) => {
  const ctx = useOptionalCardArt();
  const defaults = previewDefaults !== undefined ? previewDefaults : ctx?.defaults;
  /** Bumps effect when switching vector ↔ raster so we never keep a stale scale from the wrong layout pass. */
  const layoutEpoch = `${ctx?.mode ?? 'x'}:${ctx?.manifestVersion ?? 0}:${card}`;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    if (uniformScale != null && uniformScale > 0) {
      setScale(Math.min(1, uniformScale));
      return;
    }

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width > 0.5 ? rect.width : el.clientWidth;
      const hRaw = rect.height > 0.5 ? rect.height : el.clientHeight;
      if (w <= 0.5) return;
      /**
       * When height is not laid out yet (common right after leaving vector / flex timing), width-only scale
       * overshoots `min(w,h)` fit → overflow hidden clips the face (“cropped / zoomed”).
       * Assume the slot matches the playing-card footprint aspect until we get a real height.
       */
      const h = hRaw > 0.5 ? hRaw : w * SLOT_H_OVER_W;
      /** Fit inside slot but never scale below native art size (1:1 with 256×374 design canvas). */
      const fit = Math.min(w / CARD_ART_WIDTH, h / CARD_ART_HEIGHT);
      setScale(Math.min(1, fit));
    };

    measure();

    let alive = true;
    requestAnimationFrame(() => {
      if (!alive) return;
      measure();
      requestAnimationFrame(() => {
        if (!alive) return;
        measure();
      });
    });

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [layoutEpoch, uniformScale]);

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full min-h-0 overflow-visible rounded-[inherit] ${className ?? ''}`}
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
