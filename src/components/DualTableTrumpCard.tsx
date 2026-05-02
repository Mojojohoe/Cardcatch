import React from 'react';
import type { Suit } from '../types';
import { SUIT_COLORS } from '../suitPresentation';
import { SuitGlyph } from './SuitGlyphs';

/** Diagonal-split “OR” trump card — light top-left / dark bottom-right (TR–BL seam). */
const CLIP_TRI_TOP_LEFT = 'polygon(0% 0%, 100% 0%, 0% 100%)';
const CLIP_TRI_BOTTOM_RIGHT = 'polygon(100% 0%, 100% 100%, 0% 100%)';

const sizePresets = {
  hero: {
    box: 'h-[9.75rem] w-[6.75rem] sm:h-[11.75rem] sm:w-[8.125rem]',
    glyph: 'h-[2.85rem] w-[2.85rem] sm:h-[4rem] sm:w-[4rem]',
    aPos: 'left-[30%] top-[27%]',
    bPos: 'right-[29%] bottom-[29%]',
  },
  compact: {
    box: 'h-[3rem] min-w-[4.85rem] max-w-[5.85rem]',
    glyph: 'h-7 w-7',
    aPos: 'left-[29%] top-[26%]',
    bPos: 'right-[28%] bottom-[29%]',
  },
} as const;

export function DualTrumpTableLabel(props: {
  suits: readonly [Suit, Suit];
  className?: string;
  dividerClassName?: string;
}) {
  const { suits, className = '', dividerClassName = 'text-slate-400' } = props;
  const [a, b] = suits;
  return (
    <span className={`inline-flex flex-wrap items-baseline justify-center gap-x-[0.35em] ${className}`}>
      <span className={SUIT_COLORS[a] ?? 'text-white'}>{a}</span>
      <span className={dividerClassName} aria-hidden="true">
        {' '}
        /{' '}
      </span>
      <span className={SUIT_COLORS[b] ?? 'text-white'}>{b}</span>
    </span>
  );
}

export const DualTableTrumpCard: React.FC<{
  suits: readonly [Suit, Suit];
  density?: keyof typeof sizePresets;
  /** `standee` = main table plaque; `hud` = slimmer slate frame under the banner. */
  appearance?: 'standee' | 'hud';
  className?: string;
}> = ({ suits, density = 'hero', appearance = 'standee', className = '' }) => {
  const { box, glyph, aPos, bPos } = sizePresets[density];
  const [a, b] = suits;
  const frame =
    appearance === 'hud'
      ? 'rounded-xl border-2 border-slate-600/95 bg-yellow-400 shadow-md shadow-black/35'
      : 'rounded-2xl border-4 border-yellow-200 bg-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.28)]';

  return (
    <div className={`relative isolate flex shrink-0 flex-col overflow-hidden ${frame} ${box} ${className}`.trim()}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[size:10px_10px] opacity-[0.10]" />

        {/* Top-left triangle — lighter gold */}
        <div
          className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-yellow-200/95 via-yellow-300/90 to-yellow-400/75"
          style={{ clipPath: CLIP_TRI_TOP_LEFT }}
          aria-hidden
        />
        {/* Bottom-right triangle — softened / darker (visual “OR”) */}
        <div
          className="absolute inset-0 rounded-[inherit] bg-gradient-to-tl from-amber-900/72 via-amber-800/38 to-transparent"
          style={{ clipPath: CLIP_TRI_BOTTOM_RIGHT }}
          aria-hidden
        />
      </div>

      {/* Centroids (~⅓ , ⅓) and (~⅔ , ⅔) for TR–BL split */}
      <div
        className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 transform ${aPos}`}
      >
        <div className={SUIT_COLORS[a] ?? 'text-red-500'}>
          <SuitGlyph suit={a} className={`${glyph} drop-shadow-[0_4px_14px_rgba(0,0,0,0.35)]`} />
        </div>
      </div>
      <div
        className={`pointer-events-none absolute z-10 translate-x-1/2 translate-y-1/2 transform ${bPos}`}
      >
        <div className={SUIT_COLORS[b] ?? 'text-amber-400'}>
          <SuitGlyph suit={b} className={`${glyph} drop-shadow-[0_4px_14px_rgba(0,0,0,0.4)]`} />
        </div>
      </div>
    </div>
  );
};
