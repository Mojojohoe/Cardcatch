import type { CardArtDisplayMode, CardArtGlobalDefaults, CardArtManifest } from './types';

export const CARD_ART_PACK_KIND = 'cardcatch-card-art-pack' as const;
export const CARD_ART_PACK_VERSION = 1 as const;

export type CardArtPackV1 = {
  kind: typeof CARD_ART_PACK_KIND;
  version: typeof CARD_ART_PACK_VERSION;
  exportedAt: string;
  mode: CardArtDisplayMode;
  manifest: CardArtManifest;
  defaults: CardArtGlobalDefaults;
};

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

export function buildCardArtPackExport(
  mode: CardArtDisplayMode,
  manifest: CardArtManifest,
  defaults: CardArtGlobalDefaults,
): CardArtPackV1 {
  return {
    kind: CARD_ART_PACK_KIND,
    version: CARD_ART_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    mode,
    manifest: { ...manifest },
    defaults: defaults && typeof defaults === 'object' ? { ...defaults } : {},
  };
}

export function parseCardArtPackImport(
  raw: unknown,
): { ok: true; pack: CardArtPackV1 } | { ok: false; error: string } {
  if (!isPlainObject(raw)) return { ok: false, error: 'Root must be a JSON object.' };

  const kind = raw.kind;
  const version = raw.version;
  let mode: unknown;
  let manifest: unknown;
  let defaults: unknown;
  let exportedAt = '';

  if (kind === CARD_ART_PACK_KIND && version === 1) {
    mode = raw.mode;
    manifest = raw.manifest;
    defaults = raw.defaults;
    exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : '';
  } else if (kind == null && ('manifest' in raw || 'defaults' in raw || 'mode' in raw)) {
    mode = raw.mode ?? 'raster';
    manifest = raw.manifest ?? {};
    defaults = raw.defaults ?? {};
  } else {
    return { ok: false, error: 'Unrecognized file (expected cardcatch-card-art-pack version 1).' };
  }

  if (mode !== 'vector' && mode !== 'raster') {
    return { ok: false, error: 'Field "mode" must be "vector" or "raster".' };
  }
  if (manifest === undefined) manifest = {};
  if (!isPlainObject(manifest)) {
    return { ok: false, error: 'Field "manifest" must be an object.' };
  }
  for (const [k, v] of Object.entries(manifest)) {
    if (v != null && !isPlainObject(v)) {
      return { ok: false, error: `manifest["${k}"] must be an object or null.` };
    }
  }
  if (defaults === undefined) defaults = {};
  if (!isPlainObject(defaults)) {
    return { ok: false, error: 'Field "defaults" must be an object.' };
  }

  return {
    ok: true,
    pack: {
      kind: CARD_ART_PACK_KIND,
      version: CARD_ART_PACK_VERSION,
      exportedAt,
      mode,
      manifest: manifest as CardArtManifest,
      defaults: defaults as CardArtGlobalDefaults,
    },
  };
}
