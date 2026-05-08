import React, { memo } from 'react';
import { CURSE_TINT_HEX } from '../curses';
import type { ActiveCurseState, Suit } from '../types';
import { jointTableTrumpPair, SUIT_COLORS } from '../suitPresentation';
import { cardArtAssetUrl } from '../cardArt/paths';
import { useOptionalCardArt } from '../cardArt/cardArtContext';
import { DualTableTrumpCard } from './DualTableTrumpCard';
import { SuitRasterOrGlyph } from './SuitRasterOrGlyph';
import { SuitGlyph } from './SuitGlyphs';
/** Compact wheel / resolution-style table suit glyphs (areas 13–14) — frees vertical space under the HUD banner. */
export const CompactTableGlyphRow = memo(function CompactTableGlyphRow({
  suit,
  greedJointTrump,
}: {
  suit: Suit | null | undefined;
  greedJointTrump: boolean;
}) {
  const cardArt = useOptionalCardArt();
  if (!suit) return null;
  const joint = jointTableTrumpPair(suit, { greedActive: greedJointTrump });
  const artwork = cardArt?.mode === 'raster';
  return (
    <div className="mb-2 flex flex-col items-center gap-1">
      <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Table suit</span>
      {joint ? (
        <DualTableTrumpCard suits={joint} density="compact" appearance="hud" />
      ) : artwork ? (
        <div className="relative flex h-12 min-w-[4.85rem] max-w-[5.85rem] items-center justify-center overflow-hidden rounded-xl border-2 border-amber-800/80 shadow-md shadow-black/35">
          <img
            src={cardArtAssetUrl('GoldCard.png')}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
          <div className="relative z-10 flex h-full w-full items-center justify-center p-1.5">
            <SuitRasterOrGlyph
              suit={suit}
              className="h-8 w-8 max-h-[88%] max-w-[88%] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.42)] sm:h-9 sm:w-9"
            />
          </div>
        </div>
      ) : (
        <div
          className={`flex items-center justify-center gap-1 rounded-full border-2 border-slate-600/90 bg-slate-950/90 px-2 py-1 shadow-md ${SUIT_COLORS[suit]}`}
        >
          <SuitGlyph suit={suit} className="h-8 w-8 sm:h-9 sm:w-9 drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]" />
        </div>
      )}
    </div>
  );
});

/** Full-bleed vertical tint per active table curse (`mix-blend-mode: color`). */
export const ActiveCurseBackgroundTints = memo(function ActiveCurseBackgroundTints({
  enabled,
  activeCurses,
}: {
  enabled: boolean;
  activeCurses?: ActiveCurseState[];
}) {
  if (!enabled || !activeCurses?.length) return null;
  return (
    <>
      {activeCurses.map((c) => {
        const hex = CURSE_TINT_HEX[c.id];
        if (!hex) return null;
        const gid = `curse-scene-${c.id}`;
        return (
          <div
            key={c.id}
            className="pointer-events-none absolute inset-0 z-[1] mix-blend-color"
            aria-hidden
          >
            <svg className="block h-full w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={hex} stopOpacity={0} />
                  <stop offset="50%" stopColor={hex} stopOpacity={1} />
                  <stop offset="100%" stopColor={hex} stopOpacity={0} />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill={`url(#${gid})`} />
            </svg>
          </div>
        );
      })}
    </>
  );
});
