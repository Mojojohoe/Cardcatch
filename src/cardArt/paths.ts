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
    /** Pack convention: `public/assets/images/suitHearts.png`, `suitDiamonds.png`, … */
    `suit${suit}`,
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

/**
 * Common shipped stems under `public/assets/images/` that do not match the game id (`Hearts-A`)
 * e.g. `SuitHeartAce.png`, `SuitDiamondsAce.png`, `SuitHeartsKing.png`.
 */
export function bundledCourtPictureStems(cardId: string): string[] {
  const i = cardId.indexOf('-');
  if (i <= 0) return [];
  const suit = cardId.slice(0, i);
  const value = cardId.slice(i + 1);
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (stem: string) => {
    if (seen.has(stem)) return;
    seen.add(stem);
    out.push(stem);
  };

  const suitSingularIfPlural = suit.endsWith('s') ? suit.slice(0, -1) : suit;
  const suitPluralIfSingular = suit.endsWith('s') ? suit : `${suit}s`;

  if (value === 'A') {
    add(`Suit${suit}Ace`);
    add(`Suit${suitSingularIfPlural}Ace`);
    if (suitPluralIfSingular !== suit && suitPluralIfSingular !== suitSingularIfPlural) {
      add(`Suit${suitPluralIfSingular}Ace`);
    }
  } else if (value === 'G') {
    add(`Suit${suit}God`);
    add(`Suit${suitSingularIfPlural}God`);
    if (suitPluralIfSingular !== suit && suitPluralIfSingular !== suitSingularIfPlural) {
      add(`Suit${suitPluralIfSingular}God`);
    }
  } else if (value === 'J' || value === 'Q' || value === 'K') {
    const rank = value === 'J' ? 'Jack' : value === 'Q' ? 'Queen' : 'King';
    add(`Suit${suit}${rank}`);
    add(`Suit${suitSingularIfPlural}${rank}`);
    if (suitPluralIfSingular !== suit && suitPluralIfSingular !== suitSingularIfPlural) {
      add(`Suit${suitPluralIfSingular}${rank}`);
    }
  }

  return out;
}

function pushUrlsFromStems(stems: string[], seen: Set<string>, out: string[]) {
  for (const stem of stems) {
    for (const ext of RASTER_EXTS) {
      const url = cardArtAssetUrl(`${stem}${ext}`);
      if (!seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
  }
}

/**
 * Centre / court picture URLs for a card id.
 * Ace & God of Hearts: after any `centrePictureFile` stem, tries **standard suit rasters**
 * ({@link suitRasterUrlCandidates} — e.g. `SuitHearts.png`) so the centre can match corners without a dedicated ace PNG;
 * then bundled stems like `SuitHeartAce.png`, then `Hearts-A.png`.
 */
export function pictureCardUrlCandidates(cardId: string, preferredStem?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const t = preferredStem?.trim();
  if (t) pushUrlsFromStems([t], seen, out);

  const dash = cardId.indexOf('-');
  const suit = dash > 0 ? cardId.slice(0, dash) : '';
  const value = dash > 0 ? cardId.slice(dash + 1) : '';
  if (suit && (value === 'A' || value === 'G')) {
    for (const url of suitRasterUrlCandidates(suit)) {
      if (!seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
  }

  pushUrlsFromStems(bundledCourtPictureStems(cardId), seen, out);
  pushUrlsFromStems([cardId], seen, out);
  return out;
}
