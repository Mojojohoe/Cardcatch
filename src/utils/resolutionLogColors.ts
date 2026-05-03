import type { ResolutionEvent } from '../types';
import {
  CURSE_ENVY,
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_LUST,
  CURSE_PRIDE,
  CURSE_SLOTH,
  CURSE_WRATH,
  isMajorArcanaId,
} from '../curses';

/**
 * Tailwind text + glow classes for round-resolution / results event log lines.
 */
export function resolutionLogLineClass(evt: ResolutionEvent): string {
  const t = evt.type;

  if (
    t === 'ENVY_COVET' ||
    t === 'ENVY_STRIKE' ||
    t === 'ENVY_DEFEATED' ||
    t === 'ENVY_DEPARTS'
  ) {
    return 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.22)]';
  }

  if (t === 'SLOTH_DREAM') {
    return 'text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.2)]';
  }

  if (t === 'GLUTTONY_DIGEST') {
    return 'text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.2)]';
  }

  if (t === 'POWER_TRIGGER') {
    const p = evt.powerCardId;
    if (p === CURSE_LUST) return 'text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.22)]';
    if (p === CURSE_GREED) return 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.2)]';
    if (p === CURSE_GLUTTONY) return 'text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.2)]';
    if (p === CURSE_ENVY) return 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.22)]';
    if (p === CURSE_WRATH) return 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.18)]';
    if (p === CURSE_PRIDE) return 'text-slate-100 drop-shadow-[0_0_8px_rgba(248,250,252,0.15)]';
    if (p === CURSE_SLOTH) return 'text-sky-400 drop-shadow-[0_0_10px_rgba(56,189,248,0.2)]';
    if (typeof p === 'number' && isMajorArcanaId(p)) {
      return 'text-violet-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.22)]';
    }
    return 'text-slate-400';
  }

  if (t === 'CARD_EMPOWER') {
    const msg = evt.message ?? '';
    if (/^Lust empowers\b/i.test(msg)) {
      return 'text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.22)]';
    }
    return 'text-slate-400';
  }

  if (t === 'TRANSFORM' || t === 'CARD_SWAP') {
    const p = evt.powerCardId;
    if (typeof p === 'number' && isMajorArcanaId(p)) {
      return 'text-violet-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.18)]';
    }
    return 'text-slate-400';
  }

  if (t === 'POWER_DESTROYED') return 'text-orange-400/95';

  if (t === 'COIN_FLIP' || t === 'INTEL_REVEAL') return 'text-slate-400';

  if (t === 'CLASH_DESTROYED') return 'text-red-400/95';

  return 'text-slate-400';
}
