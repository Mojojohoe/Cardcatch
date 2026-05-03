import React, { useEffect, useMemo, useState } from 'react';
import { useOptionalCardArt } from '../cardArt/cardArtContext';
import { suitRasterUrlCandidates } from '../cardArt/paths';
import { SuitGlyph } from './SuitGlyphs';

/**
 * In **artwork** table mode (`raster`), tries `suitHearts.png`, etc. (see {@link suitRasterUrlCandidates});
 * otherwise renders vector {@link SuitGlyph}.
 */
export function SuitRasterOrGlyph({
  suit,
  className = 'h-8 w-8',
}: {
  suit: string;
  className?: string;
}) {
  const ctx = useOptionalCardArt();
  const useRaster = ctx?.mode === 'raster';
  const candidates = useMemo(() => (useRaster ? suitRasterUrlCandidates(suit) : []), [suit, useRaster]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [suit, useRaster]);

  if (!useRaster) {
    return <SuitGlyph suit={suit as any} className={className} />;
  }

  if (attempt >= candidates.length) {
    return <SuitGlyph suit={suit as any} className={className} />;
  }

  return (
    <img
      src={candidates[attempt]}
      alt=""
      draggable={false}
      className={`pointer-events-none object-contain ${className}`}
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}
