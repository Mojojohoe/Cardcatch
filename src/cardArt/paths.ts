/** Vite serves `public/` at site root; respects `base` from vite.config. */
export function cardArtAssetUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = fileName.replace(/^\/+/, '');
  return `${base.endsWith('/') ? base : `${base}/`}assets/images/${path}`;
}

/** Raster extensions tried in order (svg included for vector suit packs). */
const RASTER_EXTS = ['.png', '.webp', '.jpg', '.svg'] as const;

export function cardBackgroundUrlCandidates(): string[] {
  return RASTER_EXTS.map((ext) => cardArtAssetUrl(`CardBasicLight${ext}`));
}

/**
 * Suit pip / corner art — tries several stems because asset packs vary (SuitHearts vs Hearts only, etc.).
 */
export function suitRasterUrlCandidates(suit: string): string[] {
  const stems = [
    `Suit${suit}`,
    `${suit}`,
    `${suit.toLowerCase()}`,
    `suit_${suit}`,
    `Suit_${suit}`,
    `suits/Suit${suit}`,
    `suits/${suit}`,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const stem of stems) {
    for (const ext of RASTER_EXTS) {
      const url = cardArtAssetUrl(`${stem}${ext}`);
      if (!seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
  }
  return out;
}

/** Full-bleed picture card: `Hearts-K.png` etc. */
export function pictureCardUrlCandidates(cardId: string): string[] {
  return RASTER_EXTS.map((ext) => cardArtAssetUrl(`${cardId}${ext}`));
}
