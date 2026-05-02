/** Curse card IDs — disjoint from Major Arcana (0–21). */
export const CURSE_LUST = 100;
export const CURSE_GLUTTONY = 101;
export const CURSE_GREED = 102;
export const CURSE_PRIDE = 103;
export const CURSE_WRATH = 104;
export const CURSE_ENVY = 105;
export const CURSE_SLOTH = 106;

export const CURSE_IDS = [
  CURSE_LUST,
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_PRIDE,
  CURSE_WRATH,
  CURSE_ENVY,
  CURSE_SLOTH,
] as const;

export type CurseCardId = (typeof CURSE_IDS)[number];

export interface CurseDefinition {
  id: number;
  sin: string;
  name: string;
  description: string;
}

export const CURSES: Record<number, CurseDefinition> = {
  [CURSE_LUST]: {
    id: CURSE_LUST,
    sin: 'Lust',
    name: 'Lust',
    description:
      'Hearts dominate the target wheel. Heart plays gain power; lust feeds until sated (150).',
  },
  [CURSE_GLUTTONY]: {
    id: CURSE_GLUTTONY,
    sin: 'Gluttony',
    name: 'Gluttony',
    description:
      'Heart plays return to owners as bone cards. Feed it hearts or it starves away after six heartless rounds.',
  },
  [CURSE_GREED]: {
    id: CURSE_GREED,
    sin: 'Greed',
    name: 'Greed',
    description:
      'Diamond plays lose 1 clash value and Coins lose 2 (tax to the crown). A full Coins suit enters the deck. Hearts, Clubs, and Spades are halved on the trump wheel; on Diamonds, Coins count as trump too. Ends at crown 17 or when no Diamonds or Coins remain in deck or hands.',
  },
  [CURSE_PRIDE]: {
    id: CURSE_PRIDE,
    sin: 'Pride',
    name: 'Pride',
    description:
      'Each round a random card of the table suit sets a pride barrier — you cannot play that suit at or above its rank. If you cannot play otherwise, you receive Grovel (face shows Grovel text; clashes as rank 0, never trump). Pride ends when someone plays Grovel.',
  },
  [CURSE_WRATH]: {
    id: CURSE_WRATH,
    sin: 'Wrath',
    name: 'Wrath',
    description:
      'Each round a black coin marks one player; an agent of Swords drains their played card’s clash rank (−1 to −5 over five rounds). Jokers are spared. Ends after the Warlord.',
  },
  [CURSE_ENVY]: {
    id: CURSE_ENVY,
    sin: 'Envy',
    name: 'Envy',
    description:
      'The Green-Eyed Monster covets the highest table-suit card in play (Jokers ignored). Feed it that card or the envy seals it. After each round your plays strike its HP; at 0 the curse ends. Grovel can free a trapped hand without ending Envy.',
  },
  [CURSE_SLOTH]: {
    id: CURSE_SLOTH,
    sin: 'Sloth',
    name: 'Sloth',
    description:
      'The table drifts into dream: the trump wheel shows only Stars and Moons until the curse ends. Each resolved round spins a dream wheel—Nothing, Stars, Moons, both suits on the field, or rare Sun light that wakes Sloth and restores the wheel.',
  },
};

export function isCurseCardId(id: number | null | undefined): id is number {
  return typeof id === 'number' && id >= 100 && id in CURSES;
}

export function isMajorArcanaId(id: number | null | undefined): id is number {
  return typeof id === 'number' && id >= 0 && id <= 21;
}

export function getCurseDefinition(id: number): CurseDefinition | undefined {
  return CURSES[id];
}

export function lustCurseActive(active: readonly { id: number }[] | undefined): boolean {
  return Boolean(active?.some((c) => c.id === CURSE_LUST));
}

export function gluttonyCurseActive(active: readonly { id: number }[] | undefined): boolean {
  return Boolean(active?.some((c) => c.id === CURSE_GLUTTONY));
}

export function greedCurseActive(active: readonly { id: number }[] | undefined): boolean {
  return Boolean(active?.some((c) => c.id === CURSE_GREED));
}

export function prideCurseActive(active: readonly { id: number }[] | undefined): boolean {
  return Boolean(active?.some((c) => c.id === CURSE_PRIDE));
}

export function wrathCurseActive(active: readonly { id: number }[] | undefined): boolean {
  return Boolean(active?.some((c) => c.id === CURSE_WRATH));
}

export function envyCurseActive(active: readonly { id: number }[] | undefined): boolean {
  return Boolean(active?.some((c) => c.id === CURSE_ENVY));
}

export function slothCurseActive(active: readonly { id: number }[] | undefined): boolean {
  return Boolean(active?.some((c) => c.id === CURSE_SLOTH));
}

/** True while any curse effect is active on the table (only one curse runs at a time). */
export function curseEffectActive(active: readonly { id: number }[] | undefined): boolean {
  return (active?.length ?? 0) > 0;
}

/** Combat value for Hearts while Lust rules apply (face ranks promoted; pip/J +3). */
export function getHeartValueUnderLust(cardStr: string): number {
  const [suit, value] = cardStr.split('-');
  if (suit !== 'Hearts') return getStandardNumericRank(value);
  if (value === 'Q') return 17;
  if (value === 'K') return 18;
  if (value === 'A') return 19;
  if (value === 'J') return 11 + 3;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n + 3 : 0;
}

/** Raw clash tax routed to the Greed crown (Diamonds −1, Coins −2). */
export function greedTaxAmount(cardStr: string): number {
  const [suit] = cardStr.split('-');
  if (cardStr.startsWith('Joker')) return 0;
  if (suit === 'Diamonds') return 1;
  if (suit === 'Coins') return 2;
  return 0;
}

function getStandardNumericRank(value: string): number {
  if (value === 'A') return 14;
  if (value === 'K') return 13;
  if (value === 'Q') return 12;
  if (value === 'J') return 11;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
}
