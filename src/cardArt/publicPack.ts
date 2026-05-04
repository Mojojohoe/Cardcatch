import { parseCardArtPackImport, type CardArtPackV1 } from './packExport';

/**
 * Optional runtime pack: place the Card Creator export as this file under `public/`
 * (same folder as `index.html` in the dev server / build output). It is merged over
 * bundled {@link ./shippedPack.json} for every client — host and guest — so Artwork
 * mode matches without P2P or localStorage. Dev: localStorage still layers on top when
 * {@link ./toolsAccess.CARD_ART_TOOLS_ENABLED} is true.
 */
export const PUBLIC_CARD_ART_PACK_FILENAME = 'cardcatch-card-art-pack.json';

export function publicCardArtPackFetchUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}${PUBLIC_CARD_ART_PACK_FILENAME}`.replace(/\/{2,}/g, '/');
}

/** Returns `null` if missing, not JSON, or invalid (404 is silent). */
export async function tryLoadPublicCardArtPack(): Promise<CardArtPackV1 | null> {
  try {
    const res = await fetch(publicCardArtPackFetchUrl(), { cache: 'no-store' });
    if (!res.ok) return null;
    const parsed = parseCardArtPackImport(await res.json());
    if (parsed.ok === false) return null;
    return parsed.pack;
  } catch {
    return null;
  }
}
