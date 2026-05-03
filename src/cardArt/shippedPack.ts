/**
 * Release card-art source of truth: bundled JSON shipped with the app (GitHub Pages, etc.).
 * Every client loads the same instructions + `public/assets/images/` paths — no P2P image transfer.
 *
 * Before release: export manifest + defaults from Card Creator (dev) and paste into `shippedPack.json`
 * (or replace this file via your build pipeline). File names in `manifest` reference static URLs only.
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
