import { CURSE_IDS } from '../curses';
import { SUITS, VALUES } from '../types';
import { cardArtAssetUrl, bundledCourtPictureStems } from './paths';
import { shippedBundledPowerBackUrl, shippedBundledPowerFaceUrl, shippedPlayingCardBackRasterUrl } from './shippedRasterFallbacks';
import type { CardArtManifest } from './types';

const warmed = new Set<string>();

function warmUrl(url: string) {
  if (!url || warmed.has(url)) return;
  warmed.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.loading = 'eager';
  img.src = url;
}

function maybeWarmImageFile(fileName?: string | null) {
  const t = fileName?.trim();
  if (!t) return;
  warmUrl(cardArtAssetUrl(t));
}

/**
 * Best-effort background warmup for commonly used card-art assets.
 * Keeps requests deduped and non-blocking; failed requests are harmless.
 */
export function warmCardArtImages(manifest?: CardArtManifest | null) {
  // Global surfaces used across multiple views.
  warmUrl(cardArtAssetUrl('Background.png'));
  warmUrl(cardArtAssetUrl('GoldCard.png'));
  const powerBack = shippedBundledPowerBackUrl();
  if (powerBack) warmUrl(powerBack);
  for (const backKey of ['back-power', 'back-prey', 'back-predator', 'back-preydator', 'back-deck']) {
    const u = shippedPlayingCardBackRasterUrl(backKey);
    if (u) warmUrl(u);
  }

  // Suit symbols (png-first convention for this project).
  for (const suit of [...SUITS, 'Stars', 'Moons', 'Frogs', 'Coins', 'Bones']) {
    warmUrl(cardArtAssetUrl(`suit${suit}.png`));
    warmUrl(cardArtAssetUrl(`Suit${suit}.png`));
  }

  // Shipped power / curse face fallbacks.
  for (let i = 0; i <= 21; i++) {
    const u = shippedBundledPowerFaceUrl(i, false);
    if (u) warmUrl(u);
  }
  for (const cid of CURSE_IDS) {
    const u = shippedBundledPowerFaceUrl(cid, true);
    if (u) warmUrl(u);
  }

  // Common court stems (first-choice png convention).
  for (const suit of [...SUITS, 'Stars', 'Moons', 'Frogs', 'Coins', 'Bones']) {
    for (const value of ['A', 'J', 'Q', 'K', 'G']) {
      const cardId = `${suit}-${value}`;
      for (const stem of bundledCourtPictureStems(cardId)) {
        warmUrl(cardArtAssetUrl(`${stem}.png`));
      }
    }
  }

  // User-provided manifest overrides.
  if (!manifest) return;
  for (const ov of Object.values(manifest)) {
    if (!ov || typeof ov !== 'object') continue;
    maybeWarmImageFile(ov.customImageFile);
    maybeWarmImageFile(ov.centrePictureFile);
    const dataUrl = ov.customDataUrl?.trim();
    if (dataUrl) warmUrl(dataUrl);
  }
}

