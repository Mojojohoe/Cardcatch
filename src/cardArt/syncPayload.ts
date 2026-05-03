import type { CardArtDisplayMode, CardArtGlobalDefaults, CardArtManifest, CardArtOverride } from './types';

/** Dev-only wire format for `room.cardArtSession` (structured stems + grids — not image bytes). */
export type CardArtSessionPayload = {
  mode: CardArtDisplayMode;
  manifest: CardArtManifest;
  defaults: CardArtGlobalDefaults;
  /** Bumps when the host publishes a new pack so guests re-layout / re-fetch. */
  seq: number;
};

function stripBlobFromOverride(o: CardArtOverride): CardArtOverride {
  if (!o.customDataUrl?.startsWith('blob:')) return o;
  const { customDataUrl: _drop, ...rest } = o;
  return rest;
}

/** Blob URLs are session-local and cannot be deserialized on another browser; keep file paths and data: URLs. */
export function sanitizeManifestForSession(m: CardArtManifest): CardArtManifest {
  const out: CardArtManifest = {};
  for (const [k, v] of Object.entries(m)) {
    if (!v || typeof v !== 'object') continue;
    out[k] = stripBlobFromOverride(v);
  }
  return out;
}

export function buildCardArtSessionPayload(
  mode: CardArtDisplayMode,
  manifest: CardArtManifest,
  defaults: CardArtGlobalDefaults,
): CardArtSessionPayload {
  return {
    mode,
    manifest: sanitizeManifestForSession(manifest),
    defaults: defaults && typeof defaults === 'object' ? { ...defaults } : {},
    seq: Date.now(),
  };
}
