import { parseCard } from '../services/gameService';
import { SUITS, VALUES } from '../types';

const EXTENDED_RANK_SUITS = ['Stars', 'Moons', 'Frogs', 'Coins', 'Bones'] as const;

/** Cards that use {@link AssembledPlayingCardFace} when table art mode is raster. */
export function isAssembledRasterCardId(cardStr: string): boolean {
  if (!cardStr) return false;
  if (cardStr.startsWith('Joker-')) return true;

  const p = parseCard(cardStr);
  if (p.isJoker) return true;

  if ((SUITS as readonly string[]).includes(p.suit) && (VALUES as readonly string[]).includes(p.value as (typeof VALUES)[number])) {
    return true;
  }

  if (p.suit === 'Hearts' && p.value === 'G') return true;
  if (p.suit === 'Crowns' && p.value === 'E') return true;
  if (p.suit === 'Grovels' && p.value === '1') return true;
  if (p.suit === 'Swords' && ['T', 'B', 'H', 'C', 'W'].includes(p.value)) return true;

  if ((EXTENDED_RANK_SUITS as readonly string[]).includes(p.suit as (typeof EXTENDED_RANK_SUITS)[number])) {
    return (VALUES as readonly string[]).includes(p.value as (typeof VALUES)[number]);
  }

  return false;
}
