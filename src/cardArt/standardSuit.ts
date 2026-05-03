import { SUITS, VALUES } from '../types';
import { parseCard } from '../services/gameService';

/** Standard 52 + jokers use these suits in the base deck. */
export function isStandardSuitRasterCard(cardStr: string): boolean {
  if (!cardStr) return false;
  const p = parseCard(cardStr);
  if (p.isJoker) return false;
  if (!(SUITS as readonly string[]).includes(p.suit)) return false;
  return (VALUES as readonly string[]).includes(p.value as (typeof VALUES)[number]);
}
