import type { Suit } from './types';

/**
 * Canonical Tailwind `text-*` classes for suit glyphs & labels across UI.
 * Prefer importing from `./suitPresentation` or re-export `./GameVisuals` for visuals.
 */
export const SUIT_COLORS: Record<string, string> = {
  Hearts: 'text-red-500',
  Diamonds: 'text-red-500',
  Clubs: 'text-emerald-400',
  Spades: 'text-blue-400',
  Stars: 'text-yellow-400',
  Moons: 'text-white',
  Frogs: 'text-lime-400',
  Coins: 'text-amber-400',
  Crowns: 'text-amber-300',
  Grovels: 'text-violet-300',
  Swords: 'text-red-400',
  Bones: 'text-stone-300',
  Joker: 'text-purple-400',
};

/**
 * Approximate foreground for non-Tailwind consumers (analytics, MCP, exports).
 * Keep in sync visually with {@link SUIT_COLORS}.
 */
export const SUIT_HEX_FG: Record<string, string> = {
  Hearts: '#ef4444',
  Diamonds: '#ef4444',
  Clubs: '#34d399',
  Spades: '#60a5fa',
  Stars: '#facc15',
  Moons: '#f8fafc',
  Frogs: '#a3e635',
  Coins: '#fbbf24',
  Crowns: '#fcd34d',
  Grovels: '#c4b5fd',
  Swords: '#f87171',
  Bones: '#d6d3d1',
  Joker: '#c084fc',
};

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
