import type { CardArtDisplayMode, CardArtManifest, CardArtOverride } from './types';

const MANIFEST_KEY = 'cardcatch-card-art-manifest';
const MODE_KEY = 'cardcatch-card-art-mode';

export function loadCardArtManifest(): CardArtManifest {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as CardArtManifest;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

export function saveCardArtManifest(m: CardArtManifest): void {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function getCardOverride(cardId: string): CardArtOverride | undefined {
  return loadCardArtManifest()[cardId];
}

export function setCardOverride(cardId: string, o: CardArtOverride | null): void {
  const m = { ...loadCardArtManifest() };
  if (o == null) delete m[cardId];
  else m[cardId] = o;
  saveCardArtManifest(m);
}

export function loadDisplayMode(): CardArtDisplayMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'raster' || v === 'vector') return v;
  } catch {
    /* ignore */
  }
  return 'vector';
}

export function saveDisplayMode(mode: CardArtDisplayMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
