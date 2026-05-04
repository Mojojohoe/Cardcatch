import type { CardArtDisplayMode, CardArtGlobalDefaults, CardArtManifest, CardArtOverride } from './types';
import { SHIPPED_CARD_ART_MODE } from './shippedPack';

const MANIFEST_KEY = 'cardcatch-card-art-manifest';
const DEFAULTS_KEY = 'cardcatch-card-art-defaults';
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
  /** Match {@link SHIPPED_CARD_ART_MODE} so dev without prefs uses the bundled table (raster + public assets). */
  return SHIPPED_CARD_ART_MODE;
}

export function saveDisplayMode(mode: CardArtDisplayMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function loadCardArtDefaults(): CardArtGlobalDefaults {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as CardArtGlobalDefaults;
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

export function saveCardArtDefaults(d: CardArtGlobalDefaults): void {
  try {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}
