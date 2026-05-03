import { VALUES } from '../types';
import type {
  BackgroundCaptionConfig,
  CardArtGlobalDefaults,
  CardArtOverride,
  PipOrient,
  PipSlot,
} from './types';

/** Effective opacity for assembled / vector face typography; card override wins. */
export function resolvedFaceTextOpacity(
  override?: CardArtOverride,
  defaults?: CardArtGlobalDefaults,
): number {
  const r = override?.faceTextOpacity ?? defaults?.faceTextOpacity;
  if (r == null || !Number.isFinite(r)) return 1;
  return Math.min(1, Math.max(0, Number(r)));
}
import { cardArtAssetUrl, cardBackgroundUrlCandidates } from './paths';
import { defaultPipCellsForRank } from './pipLayouts';

export function rankValueIndex(v: string): number {
  const i = (VALUES as readonly string[]).indexOf(v as (typeof VALUES)[number]);
  if (i >= 0) return i;
  if (v === 'G') return VALUES.length;
  return -1;
}

export function rankInClosedRange(rank: string, from: string, to: string): boolean {
  const r = rankValueIndex(rank);
  const a = rankValueIndex(from);
  const b = rankValueIndex(to);
  if (r < 0 || a < 0 || b < 0) return false;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return r >= lo && r <= hi;
}

export function resolvePipScale(rank: string, defaults?: CardArtGlobalDefaults): number {
  let scale = 1;
  for (const range of defaults?.pipScaleRanges ?? []) {
    if (rankInClosedRange(rank, range.from, range.to)) scale = range.scale;
  }
  return scale;
}

/** Corner rank + notifier suit — independent from centre pip scale. */
export function resolveNotifierScale(rank: string, defaults?: CardArtGlobalDefaults): number {
  let scale = 1;
  for (const range of defaults?.notifierScaleRanges ?? []) {
    if (rankInClosedRange(rank, range.from, range.to)) scale = range.scale;
  }
  return scale;
}

const RASTER_EXT_ORDER = ['.png', '.webp', '.jpg', '.svg'] as const;

/** Single stem → URLs with extension fallbacks. */
export function rasterCandidatesForFileStem(stem: string): string[] {
  const trimmed = stem.trim();
  if (!trimmed) return [];
  if (/\.(png|webp|jpg|jpeg|svg)$/i.test(trimmed)) {
    return [cardArtAssetUrl(trimmed)];
  }
  return RASTER_EXT_ORDER.map((ext) => cardArtAssetUrl(`${trimmed}${ext}`));
}

/**
 * Face background: suit-specific file(s) first, then CardBasicLight fallbacks.
 */
export function resolveFaceBackgroundCandidates(suit: string, defaults?: CardArtGlobalDefaults): string[] {
  const raw = defaults?.suitBackgroundFile?.[suit];
  const suitChain = raw ? rasterCandidatesForFileStem(raw) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of [...suitChain, ...cardBackgroundUrlCandidates()]) {
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

export function normalizePipOrient(o: PipOrient | undefined): PipOrient {
  if (o === 1 || o === 2 || o === 3) return o;
  return 0;
}

/** Click cycle: empty → o0 → o1 → o2 → o3 → remove. */
export function cyclePipAtCell(slots: PipSlot[], col: number, row: number): PipSlot[] {
  const next = [...slots];
  const i = next.findIndex((s) => s.col === col && s.row === row);
  if (i < 0) {
    next.push({ col, row, o: 0 });
    return next;
  }
  const cur = next[i];
  const o = normalizePipOrient(cur.o);
  if (o >= 3) {
    next.splice(i, 1);
    return next;
  }
  const nextO = (o + 1) as PipOrient;
  next[i] = { ...cur, o: nextO };
  return next;
}

export function normalizePipSlot(p: PipSlot): PipSlot {
  return { col: p.col, row: p.row, o: normalizePipOrient(p.o) };
}

/** Merged caption for background-only faces (override wins per field; text can fall back to defaults). */
export function mergedBackgroundCaption(
  defaultsCap?: BackgroundCaptionConfig,
  overrideCap?: BackgroundCaptionConfig,
): BackgroundCaptionConfig | undefined {
  const text = (overrideCap?.text?.trim() || defaultsCap?.text?.trim()) ?? '';
  if (!text) return undefined;
  const colorRaw = overrideCap?.color?.trim() || defaultsCap?.color?.trim();
  return {
    text,
    color: colorRaw || undefined,
    scale: overrideCap?.scale ?? defaultsCap?.scale,
    anchorXPct: overrideCap?.anchorXPct ?? defaultsCap?.anchorXPct ?? 50,
    anchorYPct: overrideCap?.anchorYPct ?? defaultsCap?.anchorYPct ?? 50,
    maxWidthPct: overrideCap?.maxWidthPct ?? defaultsCap?.maxWidthPct ?? 88,
    mirrorDual:
      overrideCap?.mirrorDual !== undefined
        ? Boolean(overrideCap.mirrorDual)
        : defaultsCap?.mirrorDual !== undefined
          ? Boolean(defaultsCap.mirrorDual)
          : false,
  };
}

export function resolvePipSlots(
  rank: string,
  cardOverride: CardArtOverride | undefined,
  defaults: CardArtGlobalDefaults | undefined,
): PipSlot[] {
  const fromCard = cardOverride?.pipGrid?.length ? cardOverride.pipGrid : null;
  const fromShared = defaults?.sharedPipLayoutByRank?.[rank]?.length
    ? defaults.sharedPipLayoutByRank[rank]
    : null;
  const builtIn = defaultPipCellsForRank(rank);
  const raw = fromCard ?? fromShared ?? builtIn ?? [];
  return raw.map(normalizePipSlot);
}
