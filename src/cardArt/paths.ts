/** Vite serves `public/` at site root; respects `base` from vite.config. */
export function cardArtAssetUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = fileName.replace(/^\/+/, '');
  return `${base.endsWith('/') ? base : `${base}/`}assets/images/${path}`;
}

/** Try these in order until one loads (png / webp / jpg). */
const RASTER_EXTS = ['.png', '.webp', '.jpg'] as const;

export function cardBackgroundUrlCandidates(): string[] {
  return RASTER_EXTS.map((ext) => cardArtAssetUrl(`CardBasicLight${ext}`));
}

/** Suit pip / corner art: `SuitHearts.png`, `SuitDiamonds.webp`, … */
export function suitRasterUrlCandidates(suit: string): string[] {
  return RASTER_EXTS.map((ext) => cardArtAssetUrl(`Suit${suit}${ext}`));
}

/** Full-bleed picture card: `Hearts-K.png` etc. */
export function pictureCardUrlCandidates(cardId: string): string[] {
  const out: string[] = [];
  for (const ext of RASTER_EXTS) {
    out.push(cardArtAssetUrl(`${cardId}${ext}`));
  }
  return out;
}
