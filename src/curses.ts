/** Curse card IDs — disjoint from Major Arcana (0–21). */
export const CURSE_LUST = 100;
export const CURSE_GLUTTONY = 101;
export const CURSE_GREED = 102;
export const CURSE_PRIDE = 103;
export const CURSE_WRATH = 104;
export const CURSE_ENVY = 105;
export const CURSE_SLOTH = 106;
/** Playable curse card; puts the same Envy table mechanics on the board as {@link CURSE_ENVY}. */
export const CURSE_GREEN_EYED_MONSTER = 107;

export const CURSE_IDS = [
  CURSE_LUST,
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_PRIDE,
  CURSE_WRATH,
  CURSE_ENVY,
  CURSE_GREEN_EYED_MONSTER,
  CURSE_SLOTH,
] as const;

export type CurseCardId = (typeof CURSE_IDS)[number];

/** Hunger meter threshold — when reached while hearts feed, Lust clears (unless hearts exhausted first). */
export const LUST_METER_MAX = 100;

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
      'Hearts dominate the target wheel. Hearts played bump +3 ranks (past Ace becomes God at 19). Lust meter feeds until 100 or no hearts remain in deck or hands.',
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
      'While Envy holds the table, the Green-Eyed Monster covets the highest table-suit card in play (Jokers ignored). Feed it that card or envy seals it. Each round your plays strike the monster’s HP; at 0 the curse ends. Grovel can free a trapped hand without ending Envy.',
  },
  [CURSE_GREEN_EYED_MONSTER]: {
    id: CURSE_GREEN_EYED_MONSTER,
    sin: 'Envy',
    name: 'Green-Eyed Monster',
    description:
      'The creature itself: same curse as Envy — it covets the highest table-suit card showing (no Jokers), seals copies you refuse to feed, and loses HP each round until slain or the table breaks the spell.',
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

/** Power card IDs that summon the envy table curse (active entry is always stored as {@link CURSE_ENVY}). */
export function cursePlayedActivatesEnvyTable(powerCardId: number | null | undefined): boolean {
  return powerCardId === CURSE_ENVY || powerCardId === CURSE_GREEN_EYED_MONSTER;
}

export function slothCurseActive(active: readonly { id: number }[] | undefined): boolean {
  return Boolean(active?.some((c) => c.id === CURSE_SLOTH));
}

/** True while any curse effect is active on the table (only one curse runs at a time). */
export function curseEffectActive(active: readonly { id: number }[] | undefined): boolean {
  return (active?.length ?? 0) > 0;
}

/** Raw clash tax routed to the Greed crown (Diamonds −1, Coins −2). */
export function greedTaxAmount(cardStr: string): number {
  const [suit] = cardStr.split('-');
  if (cardStr.startsWith('Joker')) return 0;
  if (suit === 'Diamonds') return 1;
  if (suit === 'Coins') return 2;
  return 0;
}
