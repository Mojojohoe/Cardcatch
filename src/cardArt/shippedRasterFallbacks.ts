/**
 * When the manifest has no custom raster entry, fall back to files bundled under `public/assets/images/`
 * so “artwork” mode still shows table-ready art out of the box.
 */
import { cardArtAssetUrl } from './paths';
import {
  CURSE_ENVY,
  CURSE_GLUTTONY,
  CURSE_GREEN_EYED_MONSTER,
  CURSE_GREED,
  CURSE_LUST,
  CURSE_PRIDE,
  CURSE_SLOTH,
  CURSE_WRATH,
} from '../curses';

const PLAYING_BACK_SHIPPED: Record<string, string> = {
  'back-deck': 'CardTarotBack.png',
  'back-prey': 'CardBackPrey.png',
  'back-predator': 'CardBackPredator.png',
  'back-preydator': 'CardBackPreydator.png',
};

/** Bundled playing-card backs (opponent hand, deck column) when manifest has no override. */
export function shippedPlayingCardBackRasterUrl(backKey: string): string | null {
  const f = PLAYING_BACK_SHIPPED[backKey];
  return f ? cardArtAssetUrl(f) : null;
}

const CURSE_STEM: Partial<Record<number, string>> = {
  [CURSE_LUST]: 'CurseLust',
  [CURSE_GLUTTONY]: 'CurseGluttony',
  [CURSE_GREED]: 'CurseGreed',
  [CURSE_PRIDE]: 'CursePride',
  [CURSE_WRATH]: 'CurseWrath',
  [CURSE_ENVY]: 'CurseEnvy',
  [CURSE_GREEN_EYED_MONSTER]: 'CurseEnvy',
  [CURSE_SLOTH]: 'CurseSloth',
};

/** Major arcana id → `Tarot-*.png` stem (matches files in `public/assets/images/`). */
const MAJOR_TAROT_STEM: Record<number, string> = {
  0: 'Tarot-Fool',
  1: 'Tarot-Magician',
  2: 'Tarot-HighPriestess',
  3: 'Tarot-Empress',
  4: 'Tarot-Emperor',
  5: 'Tarot-Hierophant',
  6: 'Tarot-Lovers',
  7: 'Tarot-Chariot',
  8: 'Tarot-Strength',
  9: 'Tarot-Hermit',
  10: 'Tarot-WheelOfFortune',
  11: 'Tarot-Justice',
  12: 'Tarot-HangedMan',
  13: 'Tarot-Death',
  14: 'Tarot-Temperance',
  15: 'Tarot-Devil',
  16: 'Tarot-Tower',
  17: 'Tarot-Star',
  18: 'Tarot-Moon',
  19: 'Tarot-Sun',
  20: 'Tarot-Judgement',
  21: 'Tarot-World',
};

/** Power / curse face URL from shipped art when the manifest has no raster override. */
export function shippedBundledPowerFaceUrl(cardId: number, isCurse: boolean): string | null {
  const stem = isCurse ? CURSE_STEM[cardId] : MAJOR_TAROT_STEM[cardId];
  return stem ? cardArtAssetUrl(`${stem}.png`) : null;
}

/** Anonymous major-arcana power back when manifest has no `back-power` entry. */
export function shippedBundledPowerBackUrl(): string {
  return cardArtAssetUrl('CardTarotBack.png');
}
