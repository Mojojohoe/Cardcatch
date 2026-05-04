/**
 * Release card-art baseline: bundled JSON compiled into the app.
 * Optional runtime overlay: drop Card Creator export as `public/cardcatch-card-art-pack.json`
 * (see {@link ./publicPack.ts}) — merged on top for every client in Artwork mode without P2P.
 *
 * Paths in `manifest` / defaults should reference `public/assets/images/` (or data URLs from export).
 */
import type { CardArtDisplayMode, CardArtGlobalDefaults, CardArtManifest } from './types';
import raw from './shippedPack.json';

type ShippedShape = {
  mode?: string;
  manifest?: CardArtManifest;
  defaults?: CardArtGlobalDefaults;
};

const pack = raw as ShippedShape;

export const SHIPPED_CARD_ART_MODE: CardArtDisplayMode =
  pack.mode === 'vector' ? 'vector' : 'raster';

export const SHIPPED_CARD_ART_MANIFEST: CardArtManifest =
  pack.manifest && typeof pack.manifest === 'object' ? pack.manifest : {};

export const SHIPPED_CARD_ART_DEFAULTS: CardArtGlobalDefaults =
  pack.defaults && typeof pack.defaults === 'object' ? pack.defaults : {};
