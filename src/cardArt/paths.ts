import type { CardArtGlobalDefaults } from './types';

/** Vite serves `public/` at site root; respects `base` from vite.config. */
export function cardArtAssetUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = fileName.replace(/^\/+/, '');
  return `${base.endsWith('/') ? base : `${base}/`}assets/images/${path}`;
}

/** Keep auto-probing strict to PNG unless an explicit extension is provided. */
const RASTER_EXTS = ['.png'] as const;

function hasImageExtension(path: string): boolean {
  return /\.(png|gif|webp|jpg|jpeg|svg)$/i.test(path.trim());
}

function pushStemUrls(stem: string, exts: readonly string[], seen: Set<string>, out: string[]) {
  const trimmed = stem.trim();
  if (!trimmed) return;
  if (hasImageExtension(trimmed)) {
    const exact = cardArtAssetUrl(trimmed);
    if (!seen.has(exact)) {
      seen.add(exact);
      out.push(exact);
    }
    return;
  }
  for (const ext of exts) {
    const url = cardArtAssetUrl(`${trimmed}${ext}`);
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
}

export function cardBackgroundUrlCandidates(): string[] {
  return RASTER_EXTS.map((ext) => cardArtAssetUrl(`CardBasicLight${ext}`));
}

/**
 * Suit pip / corner art — **pack-first** stems like `SuitHearts.png`, `SuitSpades.png`, `SuitCoins.png`
 * (`Suit{suit}`) before lowercase `suit*` / legacy aliases.
 */
export function suitRasterUrlCandidates(suit: string, defaults?: CardArtGlobalDefaults): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const suitSingularIfPlural = suit.endsWith('s') ? suit.slice(0, -1) : suit;
  const configuredFile = defaults?.suitIconFile?.[suit]?.trim();
  if (configuredFile) {
    pushStemUrls(configuredFile, RASTER_EXTS, seen, out);
  }

  const stems = Array.from(
    new Set(
      [
        `Suit${suit}`,
        `suit${suit}`,
        suitSingularIfPlural !== suit ? `Suit${suitSingularIfPlural}` : null,
        suitSingularIfPlural !== suit ? `suit${suitSingularIfPlural}` : null,
        suit,
        suit.toLowerCase(),
        `suit_${suit}`,
        `Suit_${suit}`,
        `suits/Suit${suit}`,
        `suits/${suit}`,
      ].filter((s): s is string => Boolean(s)),
    ),
  );

  for (const stem of stems) {
    pushStemUrls(stem, RASTER_EXTS, seen, out);
  }

  return out;
}

/**
 * Centre-picture stems that do not match the card id (`Hearts-A`).
 * Aces/Gods resolve through pack suit art (`SuitHearts.png` etc.) via {@link suitRasterUrlCandidates} — not forced `Suit*Ace`.
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

  if (value === 'G') {
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
 * Aces/Gods:** after preferred stem**, tries **`Suit{Suit}.png`** etc. ({@link suitRasterUrlCandidates}),
 * then royalty-specific bundled stems (`Suit{Suit}King`…), then `{cardId}.png`.
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
