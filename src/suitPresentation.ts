import type { Suit } from './types';

/**
 * Canonical Tailwind `text-*` classes for suit glyphs & labels across UI.
 * Prefer importing from `./suitPresentation` or re-export `./GameVisuals` for visuals.
 */
export const SUIT_COLORS: Record<string, string> = {
  Hearts: 'text-red-600',
  Diamonds: 'text-white',
  Clubs: 'text-emerald-900',
  Spades: 'text-blue-900',
  Stars: 'text-fuchsia-500',
  Moons: 'text-gray-300',
  Frogs: 'text-lime-400',
  Coins: 'text-yellow-400',
  Crowns: 'text-orange-500',
  Grovels: 'text-violet-300',
  Swords: 'text-neutral-600',
  Bones: 'text-[#dcb896]',
  Joker: 'text-purple-400',
};

/** Assembled-face rank text, caption tint, approximate hex for MCP/exports — aligned with {@link SUIT_COLORS}. */
export const SUIT_FACE_TEXT_HEX: Record<string, string> = {
  Hearts: '#dc2626',
  Diamonds: '#ffffff',
  Clubs: '#14532d',
  Spades: '#1e3a8a',
  Stars: '#d946ef',
  Moons: '#d1d5db',
  Frogs: '#84cc16',
  Coins: '#facc15',
  Crowns: '#f97316',
  Grovels: '#c4b5fd',
  Swords: '#57534e',
  Bones: '#e8cfa0',
  Joker: '#c084fc',
};

/**
 * Approximate foreground for non-Tailwind consumers (analytics, MCP, exports).
 * Matches {@link SUIT_FACE_TEXT_HEX} for suite keys that exist there.
 */
export const SUIT_HEX_FG: Record<string, string> = { ...SUIT_FACE_TEXT_HEX };

/** Resolved CSS `color` for assembled rank/caption — optional per-suit overrides from card art defaults. */
export function resolveSuitFaceTextColor(
  suitKey: string,
  defaults?: Partial<Record<string, string>> | undefined,
): string {
  const o = defaults?.[suitKey]?.trim();
  if (o) return o;
  return SUIT_FACE_TEXT_HEX[suitKey] ?? '#18181b';
}

/** Readable table line (sentence case-ish for display alongside uppercase HUD). */
export function suitCapitalizedDisplay(suit: Suit | string): string {
  const s = String(suit);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

/**
 * Table may treat two suits as joint trump (“OR”).
 * Extend here when adding new curse / table rules beyond Greed+Diamonds.
 */
export function jointTableTrumpPair(
  targetSuit: Suit | null | undefined,
  opts: { greedActive: boolean },
): readonly [Suit, Suit] | null {
  if (!targetSuit || !opts.greedActive) return null;
  if (targetSuit === 'Diamonds') return ['Diamonds', 'Coins'];
  return null;
}
