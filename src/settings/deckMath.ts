import type { GameSettings } from '../types';

export function standardDeckComposition(
  settings: Pick<GameSettings, 'deckSizeMultiplier' | 'disableJokers'>,
): { multiplier: number; suitCards: number; jokers: number; total: number } {
  const mult = Math.max(1, Math.floor(Number(settings.deckSizeMultiplier) || 1));
  const suitCards = 52 * mult;
  const jokers = settings.disableJokers ? 0 : 2 * mult;
  return { multiplier: mult, suitCards, jokers, total: suitCards + jokers };
}

export function deckBlurb(settings: Pick<GameSettings, 'deckSizeMultiplier' | 'disableJokers'>): string {
  const c = standardDeckComposition(settings);
  const multWord = c.multiplier === 1 ? 'deck' : 'decks';
  return (
    `Total deck size is now ${c.total} (${c.multiplier} standard ${multWord}). ` +
    `${c.suitCards} suit cards and ${c.jokers} ${c.jokers === 1 ? 'Joker' : 'Jokers'}. ` +
    `Larger decks can increase game length and increase the chance of duplicate values that could result in round draws.`
  );
}
