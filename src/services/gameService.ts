import Peer, { DataConnection } from 'peerjs';
import {
  RoomData,
  PlayerData,
  Suit,
  SUITS,
  VALUES,
  PANIC_BLADE_RANK_VALUES,
  isPanicBladeNumericValue,
  GameSettings,
  PlayerRole,
  MAJOR_ARCANA,
  ResolutionEvent,
  PendingPowerDecision,
  PendingCardShopPurchase,
  ChatMessageEntry,
  ActiveCurseState,
  SlothDreamResult,
  CardShopState,
  type CardArtSessionPayload,
} from '../types';
import { CARD_ART_TOOLS_ENABLED } from '../cardArt/toolsAccess';
import { DESPERATION_GAME_SLICES, FORTUNE_GAME_SLICES, SLOTH_DREAM_GAME_SLICES } from '../wheels/presets';
import {
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_IDS,
  CURSE_LUST,
  CURSE_PRIDE,
  CURSE_ENVY,
  CURSE_GREEN_EYED_MONSTER,
  CURSE_SLOTH,
  CURSE_WRATH,
  CURSES,
  cursePlayedActivatesEnvyTable,
  pickDevilCurseFromOffset,
  curseEffectActive,
  gluttonyCurseActive,
  greedCurseActive,
  LUST_METER_MAX,
  greedTaxAmount,
  isCurseCardId,
  isMajorArcanaId,
  lustCurseActive,
  envyCurseActive,
  prideCurseActive,
  wrathCurseActive,
  slothCurseActive,
} from '../curses';
import {
  normalizeGameSettings as normalizeLobbyGameSettings,
  loadPersistedLobbySettings,
  persistLobbyDefaults,
} from '../settings/normalizeGameSettings';
import { sanitizeRoomDataForClient } from '../settings/sanitizeRoomData';
import { panicDiceSeatAllowed } from './panicDiceSeat';
import {
  createInitialCardShop,
  refreshDiscountSlot,
  slotChargeTokens,
  describeShopOfferLine,
} from '../cardShop';
import { isShopPackPlaceholder, shopPackCardId } from '../shopPack';

export const createDeck = (disableJokers: boolean): string[] => {
  const deck: string[] = [];
  SUITS.forEach((suit) => {
    VALUES.forEach((value) => {
      deck.push(`${suit}-${value}`);
    });
  });
  if (!disableJokers) {
    deck.push('Joker-1');
    deck.push('Joker-2');
  }
  return shuffle(deck);
};

/** Multiple standard piles shuffled into one physical draw pile. */
export const createMultiDeck = (multiplier: number, disableJokers: boolean): string[] => {
  const copies = Math.max(1, Math.floor(multiplier || 1));
  const combined: string[] = [];
  for (let i = 0; i < copies; i++) {
    combined.push(...createDeck(disableJokers));
  }
  return shuffle(combined);
};

export const shuffle = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

/** Lust-only rank: past Ace walks to God of Hearts (clash/satiation value 19). */
export const HEART_GOD_RANK = 'G';

function standardPlayingCardRankValue(suit: string, value: string, greedTax: boolean): number {
  /** Post-Ace “Ascendant” rank (Emperor/Strength overflow); same clash tier as God of Hearts. */
  if (value === HEART_GOD_RANK) return 19;

  let base: number;
  if (value === 'A') base = 14;
  else if (value === 'K') base = 13;
  else if (value === 'Q') base = 12;
  else if (value === 'J') base = 11;
  else {
    const n = parseInt(value, 10);
    base = Number.isFinite(n) ? n : 0;
  }

  if (greedTax) {
    if (suit === 'Diamonds') base = Math.max(0, base - 1);
    else if (suit === 'Coins') base = Math.max(0, base - 2);
  }
  return base;
}

/**
 * Printed heart after Lust (+3 ladder steps once). Past Ace ⇒ `Hearts-G`.
 * Idempotent for God. Non-hearts ⇒ null (caller keeps original).
 */
export function lustBumpHeartIfApplicable(cardStr: string): string | null {
  const pc = parseCard(cardStr);
  if (pc.isJoker || pc.suit !== 'Hearts') return null;
  if (pc.value === HEART_GOD_RANK) return cardStr;

  const idx = (VALUES as readonly string[]).indexOf(pc.value);
  if (idx < 0) return null;
  const nextIdx = idx + 3;
  if (nextIdx >= VALUES.length) return `Hearts-${HEART_GOD_RANK}`;
  return `Hearts-${VALUES[nextIdx]}`;
}

/** Any Heart id still among the draw pile, players’ hands, or committed tricks. */
export function heartsRemainInDeckHandsOrCommits(
  deck: readonly string[],
  players: Record<string, PlayerData>,
): boolean {
  const heart = (c: string | null | undefined): boolean => {
    if (!c) return false;
    const p = parseCard(c);
    return !p.isJoker && p.suit === 'Hearts';
  };
  if (deck.some(heart)) return true;
  for (const p of Object.values(players)) {
    for (const c of p.hand) {
      if (heart(c)) return true;
    }
    if (heart(p.currentMove)) return true;
  }
  return false;
}

export const getCardValue = (cardStr: string, lustHeartRules = false, greedTax = false): number => {
  if (cardStr.startsWith('Joker')) return 20; // Beat Ace (14)
  const [suit, value] = cardStr.split('-');
  if (suit === 'Grovels') return 0;
  /** Wrath agents use letter values (not in VALUES); panic blades use numeric ranks incl. `1`. */
  if (suit === 'Swords') {
    if (isPanicBladeNumericValue(value)) return standardPlayingCardRankValue(suit, value, greedTax);
    return 0;
  }
  if (suit === 'Crowns' && value === 'E') return 17;

  let effSuit = suit;
  let effVal = value;
  if (lustHeartRules && suit === 'Hearts') {
    const bumpedId = lustBumpHeartIfApplicable(cardStr) ?? cardStr;
    const bp = parseCard(bumpedId);
    effSuit = bp.suit;
    effVal = bp.value;
  }

  return standardPlayingCardRankValue(effSuit, effVal, greedTax);
};

/** Display rank text for suit cards. Crowns are always numeric with 3-digit zero padding (e.g. 017). */
export function displaySuitCardValue(suit: string, value: string): string {
  if (suit === 'Crowns') {
    const n = value === 'E' ? 17 : standardPlayingCardRankValue(suit, value, false);
    return String(Math.max(0, Math.trunc(n))).padStart(3, '0');
  }
  return value;
}

/** Special playable card while Pride is active — clash rank 1; ends Pride when played. */
export const GROVEL_CARD_ID = 'Grovels-1';

/** Wrath agents by round index (1–5): card id, display title, corner letter, clash penalty. */
export const WRATH_MINION_BY_ROUND = [
  { id: 'Swords-T', title: 'Thug of Swords', letter: 'T', magnitude: 1 },
  { id: 'Swords-B', title: 'Bandit of Swords', letter: 'B', magnitude: 2 },
  { id: 'Swords-H', title: 'Highwayman of Swords', letter: 'H', magnitude: 3 },
  { id: 'Swords-C', title: 'Champion of Swords', letter: 'C', magnitude: 4 },
  { id: 'Swords-W', title: 'Warlord of Swords', letter: 'W', magnitude: 5 },
] as const;

export function wrathMinionCardForRound(wrathRound: number): string {
  const clamped = Math.min(Math.max(wrathRound, 1), 5);
  return WRATH_MINION_BY_ROUND[clamped - 1].id;
}

export function getWrathMagnitude(minionCardId: string): number {
  const row = WRATH_MINION_BY_ROUND.find((r) => r.id === minionCardId);
  return row?.magnitude ?? 0;
}

export function describeWrathMinionTitle(minionCardId: string): string {
  const row = WRATH_MINION_BY_ROUND.find((r) => r.id === minionCardId);
  return row?.title ?? minionCardId;
}

/** Bracket label for card hover: printed rank only (no Lust virtual bump, no Greed tax). */
export function tooltipPrintedStrengthLabel(cardStr: string): string {
  const p = parseCard(cardStr);
  if (p.isJoker) return 'N/A';
  if (p.suit === 'Grovels') return '0';
  if (p.suit === 'Swords') {
    if (isPanicBladeNumericValue(p.value))
      return String(standardPlayingCardRankValue(p.suit, p.value, false));
    return 'N/A';
  }
  if (p.suit === 'Crowns') return displaySuitCardValue(p.suit, p.value);
  return String(standardPlayingCardRankValue(p.suit, p.value, false));
}

/** Pre–Lust-bump friendly label for resolution lines ("3 of Hearts"). */
export function plainCardLabelForLustEmpower(cardStr: string): string {
  const p = parseCard(cardStr);
  if (p.isJoker) return 'Joker';
  if (p.suit === 'Grovels') return 'Grovel';
  if (p.suit === 'Swords') {
    if (isPanicBladeNumericValue(p.value)) return `${p.value} of Swords`;
    return describeWrathMinionTitle(cardStr);
  }
  if (p.suit === 'Crowns') return `${displaySuitCardValue(p.suit, p.value)} of Crowns`;
  return `${p.value} of ${p.suit}`;
}

export function isCardBlockedByPride(
  cardStr: string,
  prideCeilingCard: string | undefined | null,
  lustHeartRules: boolean,
  greedTaxActive: boolean,
): boolean {
  if (!prideCeilingCard) return false;
  if (cardStr === GROVEL_CARD_ID) return false;
  const pc = parseCard(cardStr);
  if (pc.isJoker) return false;
  const ceilingParsed = parseCard(prideCeilingCard);
  if (ceilingParsed.isJoker) return false;
  if (pc.suit !== ceilingParsed.suit) return false;
  return (
    getCardValue(cardStr, lustHeartRules, greedTaxActive) >=
    getCardValue(prideCeilingCard, lustHeartRules, greedTaxActive)
  );
}

export function handHasLegalPridePlay(
  hand: readonly string[],
  prideCeilingCard: string | undefined | null,
  lustHeartRules: boolean,
  greedTaxActive: boolean,
): boolean {
  if (!prideCeilingCard) return true;
  return hand.some((c) => !isCardBlockedByPride(c, prideCeilingCard, lustHeartRules, greedTaxActive));
}

/** Green-Eyed Monster HP when Envy curse first hits the table. */
export const ENVY_MONSTER_START_HP = 10;

/** New curse layer matching post-resolution cheats / Devil pact injection. */
export function createFreshCurseState(curseId: number): ActiveCurseState {
  switch (curseId) {
    case CURSE_LUST:
      return { id: CURSE_LUST, lustAccumulated: 0 };
    case CURSE_GLUTTONY:
      return { id: CURSE_GLUTTONY, gluttonyPhase: 0, gluttonyNoHeartStreak: 0 };
    case CURSE_GREED:
      return { id: CURSE_GREED, greedCrown: 0 };
    case CURSE_PRIDE:
      return { id: CURSE_PRIDE };
    case CURSE_WRATH:
      return { id: CURSE_WRATH, wrathRound: 1 };
    case CURSE_ENVY:
    case CURSE_GREEN_EYED_MONSTER:
      return { id: CURSE_ENVY, envyMonsterHp: ENVY_MONSTER_START_HP };
    case CURSE_SLOTH:
      return { id: CURSE_SLOTH };
    default:
      return { id: curseId };
  }
}

const SLOTH_DREAM_LABEL_TO_RESULT: Record<string, SlothDreamResult> = {
  NOTHING: 'NOTHING',
  STARS: 'STARS',
  MOONS: 'MOONS',
  STARS_AND_MOONS: 'STARS_AND_MOONS',
  SUN: 'SUN',
};

/** Map wheel offset ∈ [0,1) in weight-space to Sloth dream outcome (for resolution + tests). */
export function pickSlothDreamResult(offset: number): SlothDreamResult {
  const slices = SLOTH_DREAM_GAME_SLICES;
  const total = slices.reduce((a, s) => a + s.weight, 0) || 1;
  const t = Math.max(0, Math.min(0.999999, offset)) * total;
  let acc = 0;
  for (const s of slices) {
    acc += s.weight;
    if (t < acc) {
      return SLOTH_DREAM_LABEL_TO_RESULT[s.label] ?? 'NOTHING';
    }
  }
  return 'SUN';
}

/** Marks hand slots sealed by envy ( multiset: first occurrences in scan order consume sealed counts ). */
export function envyGreedySealSlots(hand: readonly string[], sealedIds: readonly string[]): boolean[] {
  const need = new Map<string, number>();
  for (const c of sealedIds) need.set(c, (need.get(c) ?? 0) + 1);
  const out = hand.map(() => false);
  for (let i = 0; i < hand.length; i++) {
    const c = hand[i];
    const n = need.get(c) ?? 0;
    if (n > 0) {
      need.set(c, n - 1);
      out[i] = true;
    }
  }
  return out;
}

function samePlayingHandMultiset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const tallies = new Map<string, number>();
  for (const c of a) tallies.set(c, (tallies.get(c) ?? 0) + 1);
  for (const c of b) {
    const n = (tallies.get(c) ?? 0) - 1;
    if (n < 0) return false;
    tallies.set(c, n);
  }
  return true;
}

/** Which occurrence (0-based) of `hand[idx]` that index is among equal card ids. */
export function handSlotOccurrenceRank(hand: readonly string[], idx: number): number {
  const id = hand[idx];
  let k = 0;
  for (let i = 0; i <= idx; i++) {
    if (hand[i] === id) {
      if (i === idx) break;
      k++;
    }
  }
  return k;
}

/** New hand order after moving one slot from `from` to `to` (insert-before semantics). */
export function reorderHandSlots(hand: readonly string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= hand.length || to >= hand.length) return [...hand];
  const next = [...hand];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Original hand indices of the cards immediately left/right of the insertion gap while reordering
 * (matches {@link reorderHandSlots}: remove `from`, then insert at `to` in the shortened array).
 */
export function handReorderGapNeighborIndices(
  from: number,
  to: number,
  n: number,
): { left: number | null; right: number | null } {
  if (n <= 1 || from === to || from < 0 || to < 0 || from >= n || to >= n) {
    return { left: null, right: null };
  }
  const orig = (shortIdx: number) => (shortIdx < from ? shortIdx : shortIdx + 1);
  const left = to > 0 ? orig(to - 1) : null;
  const right = to < n - 1 ? orig(to) : null;
  return { left, right };
}

/** Map a hand index through a pure permutation (same multiset); stable for duplicate card ids. */
export function handIndexAfterReorder(
  handBefore: readonly string[],
  handAfter: readonly string[],
  indexBefore: number,
): number {
  if (indexBefore < 0 || indexBefore >= handBefore.length) return indexBefore;
  const id = handBefore[indexBefore];
  const rank = handSlotOccurrenceRank(handBefore, indexBefore);
  let seen = 0;
  for (let i = 0; i < handAfter.length; i++) {
    if (handAfter[i] === id) {
      if (seen === rank) return i;
      seen++;
    }
  }
  return Math.min(Math.max(indexBefore, 0), Math.max(handAfter.length - 1, 0));
}

export function mergeEnvySealDeltas(
  prev: Record<string, string[]> | undefined,
  delta: Record<string, string[]> | undefined,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (prev) {
    for (const [uid, xs] of Object.entries(prev)) {
      if (xs.length) out[uid] = [...xs];
    }
  }
  if (delta) {
    for (const [uid, xs] of Object.entries(delta)) {
      if (!xs.length) continue;
      out[uid] = [...(out[uid] ?? []), ...xs];
    }
  }
  return out;
}

export function handHasLegalEnvyPlay(
  hand: readonly string[],
  uid: string,
  sealedCards: Record<string, string[]> | undefined,
): boolean {
  const slots = envyGreedySealSlots(hand, sealedCards?.[uid] ?? []);
  return hand.some((_, i) => !slots[i]);
}

export function envyFreeCopiesInHand(
  hand: readonly string[],
  uid: string,
  cardId: string,
  sealedCards: Record<string, string[]> | undefined,
): number {
  const slots = envyGreedySealSlots(hand, sealedCards?.[uid] ?? []);
  let n = 0;
  for (let i = 0; i < hand.length; i++) {
    if (hand[i] === cardId && !slots[i]) n++;
  }
  return n;
}

/** True if the player may commit this card id while Envy is active (some copy is not seal-blocked). */
export function envyAllowsPlayCardId(
  hand: readonly string[],
  uid: string,
  cardId: string,
  sealedCards: Record<string, string[]> | undefined,
): boolean {
  return envyFreeCopiesInHand(hand, uid, cardId, sealedCards) > 0;
}

/** Advance along {@link VALUES}; steps past Ace become `${suit}-G` (clash 19). */
export function bumpPlayingCardRank(cardId: string, steps: number): string {
  const pc = parseCard(cardId);
  if (pc.isJoker || steps === 0) return cardId;
  const ladder = VALUES as readonly string[];
  const ix = ladder.indexOf(pc.value as (typeof VALUES)[number]);
  if (ix < 0) {
    return cardId;
  }
  const j = ix + steps;
  if (j < ladder.length) return `${pc.suit}-${ladder[j]!}`;
  return `${pc.suit}-${HEART_GOD_RANK}`;
}

export const parseCard = (cardStr: string): { suit: string, value: string, isJoker: boolean } => {
  if (cardStr == null || typeof cardStr !== 'string') {
    return { suit: '', value: '', isJoker: false };
  }
  const trimmed = cardStr.trim();
  if (!trimmed) {
    return { suit: '', value: '', isJoker: false };
  }
  if (trimmed.startsWith('Joker')) {
    return { suit: 'Joker', value: 'Joker', isJoker: true };
  }
  const [suit, value = ''] = trimmed.split('-');
  return { suit: suit ?? '', value, isJoker: false };
};

/** Card ids per frame for CARD_EMPOWER “upgrade” resolution animation (Strength / Emperor rank walks). */
export function playingCardUpgradeSteps(fromCard: string, toCard: string): string[] {
  if (fromCard === toCard) return [fromCard];
  const pf = parseCard(fromCard);
  const pt = parseCard(toCard);
  if (pf.isJoker || pt.isJoker) return [fromCard, toCard];

  const valueIndex = (v: string): number =>
    (VALUES as readonly string[]).indexOf(v);

  const vi = valueIndex(pf.value);
  const vj = valueIndex(pt.value);
  if (vi < 0 || vj < 0) return [fromCard, toCard];

  if (pf.suit === pt.suit) {
    if (vj >= vi) {
      return VALUES.slice(vi, vj + 1).map((v) => `${pf.suit}-${v}`);
    }
    const rev = [...VALUES.slice(vj, vi + 1)].reverse();
    return rev.map((v) => `${pf.suit}-${v}`);
  }

  // Cross-suit: walk ranks along the destination suit between the two ranks.
  const low = Math.min(vi, vj);
  const high = Math.max(vi, vj);
  return VALUES.slice(low, high + 1).map((v) => `${pt.suit}-${v}`);
}

/** Resolution ladder for Hearts bumped into God (`VALUES` omit `G`, so specialized). */
export function lustHeartUpgradeSteps(fromCard: string, toCard: string): string[] {
  if (fromCard === toCard) return [fromCard];
  const pf = parseCard(fromCard);
  const pt = parseCard(toCard);
  if (pf.isJoker || pt.isJoker) return [fromCard, toCard];
  if (pf.suit !== 'Hearts' || pt.suit !== 'Hearts') {
    return playingCardUpgradeSteps(fromCard, toCard);
  }
  if (pt.value === HEART_GOD_RANK) {
    const vi = (VALUES as readonly string[]).indexOf(pf.value);
    if (vi < 0) return [fromCard, toCard];
    const steps = VALUES.slice(vi, VALUES.length).map((v) => `Hearts-${v}`);
    if (steps[steps.length - 1] !== toCard) steps.push(toCard);
    return steps.filter((s, i) => i === 0 || s !== steps[i - 1]);
  }
  return playingCardUpgradeSteps(fromCard, toCard);
}

const RANK_WORDS: Record<string, string> = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Jack',
};

/** Mid-sentence card label: "the Ace of Hearts", "a Joker". */
export const describeCardPlain = (cardStr: string): string => {
  const p = parseCard(cardStr);
  if (p.isJoker) return 'a Joker';
  if (p.suit === 'Swords') {
    if (isPanicBladeNumericValue(p.value)) {
      const rk = RANK_WORDS[p.value] ?? p.value;
      return `the ${rk} of Swords`;
    }
    return `the ${describeWrathMinionTitle(cardStr)}`;
  }
  if (p.suit === 'Grovels') return 'Grovel';
  if (p.suit === 'Crowns') return `the ${displaySuitCardValue(p.suit, p.value)} of Crowns`;
  if (p.value === HEART_GOD_RANK) {
    return p.suit === 'Hearts' ? 'God of Hearts' : `the Ascendant of ${p.suit}`;
  }
  const rk = RANK_WORDS[p.value] ?? p.value;
  return `the ${rk} of ${p.suit}`;
};

function sentenceCard(cardStr: string): string {
  const mid = describeCardPlain(cardStr);
  return mid.replace(/^the /, 'The ').replace(/^a /, 'A ');
}

/** Log / Hermit swap line: "Ace of Hearts", "Joker" — never "Joker of 1". */
export function compactCardLabel(cardStr: string): string {
  const p = parseCard(cardStr);
  if (p.isJoker) return 'Joker';
  if (p.suit === 'Grovels') return 'Grovel';
  if (p.suit === 'Crowns') return `${displaySuitCardValue(p.suit, p.value)} of Crowns`;
  if (p.suit === 'Hearts' && p.value === HEART_GOD_RANK) return 'God of Hearts';
  if (p.suit === 'Swords') {
    if (isPanicBladeNumericValue(p.value)) return `${p.value} of Swords`;
    return describeWrathMinionTitle(cardStr);
  }
  const rk = RANK_WORDS[p.value] ?? p.value;
  return `${rk} of ${p.suit}`;
}

function isOnTargetField(cardStr: string, targetSuit: Suit, greedJointDiamondsCoins = false): boolean {
  const p = parseCard(cardStr);
  if (p.isJoker) return false;
  if (p.suit === 'Grovels') return false;
  if (targetSuit === 'Stars') return true;
  if (p.suit === targetSuit) return true;
  if (greedJointDiamondsCoins && targetSuit === 'Diamonds' && p.suit === 'Coins') return true;
  return false;
}

type EnvyCovetCand = { uid: string; cardId: string; handIndex: number; v: number };

function collectEnvyCovetCandidates(
  players: Record<string, PlayerData>,
  p1Uid: string,
  p2Uid: string,
  targetSuit: Suit,
  sealedCards: Record<string, string[]> | undefined,
  lustHeartRules: boolean,
  greedTaxActive: boolean,
  greedJointTrump: boolean,
  requireOnTargetField: boolean,
): EnvyCovetCand[] {
  const cands: EnvyCovetCand[] = [];
  const consider = (uid: string) => {
    const hand = players[uid]?.hand;
    if (!hand) return;
    const sealedSlots = envyGreedySealSlots(hand, sealedCards?.[uid] ?? []);
    for (let i = 0; i < hand.length; i++) {
      if (sealedSlots[i]) continue;
      const cid = hand[i];
      if (cid === GROVEL_CARD_ID) continue;
      const pc = parseCard(cid);
      if (pc.isJoker) continue;
      if (requireOnTargetField && !isOnTargetField(cid, targetSuit, greedJointTrump)) continue;
      const v = getCardValue(cid, lustHeartRules, greedTaxActive);
      cands.push({ uid, cardId: cid, handIndex: i, v });
    }
  };
  consider(p1Uid);
  consider(p2Uid);
  return cands;
}

function pickBestEnvyCovetRandomTie(cands: EnvyCovetCand[]): { uid: string; cardId: string; handIndex: number } {
  const best = Math.max(...cands.map((c) => c.v));
  const top = cands.filter((c) => c.v === best);
  return top[Math.floor(Math.random() * top.length)]!;
}

/**
 * Envy covet target: best clash value among table-suit (trump-field) cards in open hands;
 * if none on suit, best among all eligible non-Joker cards (same sealed / Grovel rules).
 */
export function pickEnvyCovetedForRound(
  players: Record<string, PlayerData>,
  p1Uid: string,
  p2Uid: string,
  targetSuit: Suit,
  sealedCards: Record<string, string[]> | undefined,
  lustHeartRules: boolean,
  greedTaxActive: boolean,
  greedJointTrump: boolean,
): { uid: string; cardId: string; handIndex: number } | null {
  let cands = collectEnvyCovetCandidates(
    players,
    p1Uid,
    p2Uid,
    targetSuit,
    sealedCards,
    lustHeartRules,
    greedTaxActive,
    greedJointTrump,
    true,
  );
  if (cands.length === 0) {
    cands = collectEnvyCovetCandidates(
      players,
      p1Uid,
      p2Uid,
      targetSuit,
      sealedCards,
      lustHeartRules,
      greedTaxActive,
      greedJointTrump,
      false,
    );
  }
  if (cands.length === 0) return null;
  return pickBestEnvyCovetRandomTie(cands);
}

/** Main trick winner when p1 plays `cr1` and p2 plays `cr2` (Hermit swaps = p1 Hermit candidate). */
export function evaluateTrickClash(
  cr1: string,
  cr2: string,
  targetSuit: Suit,
  lustHeartRules = false,
  greedTaxActive = false,
  greedJointDiamondsCoins = false,
  clashValuePenaltyCr1 = 0,
  clashValuePenaltyCr2 = 0,
  /** Override lust virtual bump per side after `Hearts` have been bumped to printed rank on the trick. */
  lustHeartRulesPerSeat?: readonly [boolean, boolean],
): 'p1' | 'p2' | 'draw' {
  const pr1 = parseCard(cr1);
  const pr2 = parseCard(cr2);
  if (pr1.isJoker && pr2.isJoker) return 'draw';

  if (pr1.isJoker && !pr2.isJoker) {
    if (targetSuit === 'Stars') return 'p1';
    if (targetSuit === 'Moons') return pr2.suit === 'Moons' ? 'p1' : 'p2';
    return isOnTargetField(cr2, targetSuit, greedJointDiamondsCoins) ? 'p1' : 'p2';
  }
  if (pr2.isJoker && !pr1.isJoker) {
    if (targetSuit === 'Stars') return 'p2';
    if (targetSuit === 'Moons') return pr1.suit === 'Moons' ? 'p2' : 'p1';
    return isOnTargetField(cr1, targetSuit, greedJointDiamondsCoins) ? 'p2' : 'p1';
  }

  const p1Target = isOnTargetField(cr1, targetSuit, greedJointDiamondsCoins);
  const p2Target = isOnTargetField(cr2, targetSuit, greedJointDiamondsCoins);

  if (p1Target && !p2Target) return 'p1';
  if (!p1Target && p2Target) return 'p2';

  const lh1 = lustHeartRulesPerSeat?.[0] ?? lustHeartRules;
  const lh2 = lustHeartRulesPerSeat?.[1] ?? lustHeartRules;
  const raw1 = getCardValue(cr1, lh1, greedTaxActive);
  const raw2 = getCardValue(cr2, lh2, greedTaxActive);
  const v1 = parseCard(cr1).isJoker ? raw1 : Math.max(0, raw1 - clashValuePenaltyCr1);
  const v2 = parseCard(cr2).isJoker ? raw2 : Math.max(0, raw2 - clashValuePenaltyCr2);
  if (v1 > v2) return 'p1';
  if (v2 > v1) return 'p2';
  return 'draw';
}

/** Map 2d6 sum (2–12) onto an ephemeral Suit-Swords blade for panic rerolls. */
export function panicDiceTotalToCardId(total: number): string {
  const t = Math.min(12, Math.max(2, Math.round(total)));
  const ranks: Record<number, string> = {
    2: '2',
    3: '3',
    4: '4',
    5: '5',
    6: '6',
    7: '7',
    8: '8',
    9: '9',
    10: '10',
    11: 'J',
    12: 'Q',
  };
  return `Swords-${ranks[t]}`;
}

function computeOverkillTokenAward(params: {
  p1Uid: string;
  p2Uid: string;
  c1: string;
  c2: string;
  targetSuit: Suit;
  greedJointTrump: boolean;
  greedTaxActive: boolean;
  clashPenaltyByUid: Record<string, number>;
  lustPlayedByUid?: Record<string, boolean>;
}): Record<string, number> {
  const valFor = (uid: string, card: string): number => {
    const pc = parseCard(card);
    if (pc.isJoker) return 0;
    if (!isOnTargetField(card, params.targetSuit, params.greedJointTrump)) return 0;
    const lh = params.lustPlayedByUid?.[uid] ?? false;
    const raw = getCardValue(card, lh, params.greedTaxActive);
    const pen = params.clashPenaltyByUid[uid] ?? 0;
    return Math.max(0, raw - pen);
  };

  const v1 = valFor(params.p1Uid, params.c1);
  const v2 = valFor(params.p2Uid, params.c2);
  const out: Record<string, number> = { [params.p1Uid]: 0, [params.p2Uid]: 0 };
  if (v1 > v2) out[params.p1Uid] = v1 - v2;
  else if (v2 > v1) out[params.p2Uid] = v2 - v1;
  return out;
}

export function panicSwordStrikeStrength(cardId: string): number {
  const p = parseCard(cardId);
  if (!p.isJoker && p.suit === 'Swords' && isPanicBladeNumericValue(p.value)) {
    return standardPlayingCardRankValue(p.suit, p.value, false);
  }
  return 0;
}

export function computePanicCombatEffects(args: {
  panicCardId: string;
  opponentCardId: string;
  opponentWrathPenalty: number;
  greedTaxActive: boolean;
  /** Align opponent stamina with calculateOutcome / evaluateTrickClash (Lust virtual hearts). */
  opponentLustBump?: boolean;
}): {
  exchanges: number;
  panicDestroyed: boolean;
  opponentDestroyed: boolean;
  extraOpponentPenalty: number;
} {
  let panicPow = panicSwordStrikeStrength(args.panicCardId);
  const oppPc = parseCard(args.opponentCardId);
  const oppLh = args.opponentLustBump ?? false;
  if (panicPow <= 0 || args.opponentCardId === GROVEL_CARD_ID || oppPc.isJoker) {
    return {
      exchanges: 0,
      panicDestroyed: true,
      opponentDestroyed: false,
      extraOpponentPenalty: 0,
    };
  }
  const raw = getCardValue(args.opponentCardId, oppLh, args.greedTaxActive);
  const effStart = Math.max(0, raw - args.opponentWrathPenalty);
  let eff = effStart;
  let exchanges = 0;
  while (panicPow > 0 && eff > 0) {
    panicPow -= 1;
    eff -= 1;
    exchanges += 1;
  }
  const opponentDestroyed = eff <= 0;
  const panicDestroyed = panicPow <= 0;
  const extraOpponentPenalty = Math.max(0, effStart - eff);
  return { exchanges, panicDestroyed, opponentDestroyed, extraOpponentPenalty };
}

/** Wrath magnitude applied to opponent clash stamina during panic reroll (frozen tableau). */
export function panicOpponentWrathPenaltyFromOutcome(
  outcome: NonNullable<RoomData['lastOutcome']>,
  opponentUid: string,
  opponentCardId: string,
): number {
  const wf = outcome.wrathFx;
  if (!wf || wf.targetUid !== opponentUid || !wf.minionCard) return 0;
  const pc = parseCard(opponentCardId);
  if (pc.isJoker || opponentCardId === GROVEL_CARD_ID) return 0;
  return getWrathMagnitude(wf.minionCard);
}

/** Mirrors calculateOutcome’s lust handling when replaying the frozen trick after panic dice. */
export type LustReplayContext = {
  lustHeartRules: boolean;
  /** When true, {@link getCardValue} applies Lust’s virtual heart ladder for this printed trick card. */
  lhPlayed: (cardStr: string) => boolean;
};

export function lustReplayContextFromOutcome(
  roomData: Pick<RoomData, 'settings' | 'activeCurses'>,
  outcome: Pick<
    NonNullable<RoomData['lastOutcome']>,
    'powerCardIdsPlayed' | 'curseClashSuppressed' | 'powerCardTowerBlocked' | 'cardsPlayed' | 'initialCardsPlayed'
  >,
  hostUid: string,
  guestUid: string,
): LustReplayContext {
  const curseEnabled = roomData.settings.enableCurseCards !== false;
  const pidHost = outcome.powerCardIdsPlayed?.[hostUid] ?? null;
  const pidGuest = outcome.powerCardIdsPlayed?.[guestUid] ?? null;
  const suppressed = outcome.curseClashSuppressed ?? {};
  const towerBlocked = outcome.powerCardTowerBlocked ?? {};
  const lustHeartRules =
    curseEnabled &&
    (lustCurseActive(roomData.activeCurses ?? []) ||
      (pidHost === CURSE_LUST && !towerBlocked[hostUid] && !suppressed[hostUid]) ||
      (pidGuest === CURSE_LUST && !towerBlocked[guestUid] && !suppressed[guestUid]));

  let lustPrintedHeartsBump = false;
  for (const uid of [hostUid, guestUid] as const) {
    const init = outcome.initialCardsPlayed?.[uid];
    const fin = outcome.cardsPlayed?.[uid];
    if (!init || !fin || typeof init !== 'string' || typeof fin !== 'string') continue;
    if (parseCard(init).suit === 'Hearts' && init !== fin) {
      lustPrintedHeartsBump = true;
      break;
    }
  }

  const lhPlayed = (cardStr: string) =>
    lustHeartRules && !(lustPrintedHeartsBump && parseCard(cardStr).suit === 'Hearts');

  return { lustHeartRules, lhPlayed };
}

export type PanicExchangeFrame = { panicRemaining: number; opponentEffective: number };

/** One snapshot after each simultaneous −1 panic / opponent stamina tick (aligned with {@link computePanicCombatEffects}). */
export function buildPanicExchangeFrames(args: {
  panicCardId: string;
  opponentCardId: string;
  opponentWrathPenalty: number;
  greedTaxActive: boolean;
  opponentLustBump?: boolean;
}): { frames: PanicExchangeFrame[]; exchanges: number } {
  let panicPow = panicSwordStrikeStrength(args.panicCardId);
  const oppPc = parseCard(args.opponentCardId);
  const oppLh = args.opponentLustBump ?? false;
  const frames: PanicExchangeFrame[] = [];
  if (panicPow <= 0 || args.opponentCardId === GROVEL_CARD_ID || oppPc.isJoker) {
    const raw = getCardValue(args.opponentCardId, oppLh, args.greedTaxActive);
    const eff = Math.max(0, raw - args.opponentWrathPenalty);
    frames.push({ panicRemaining: Math.max(0, panicPow), opponentEffective: eff });
    return { frames, exchanges: 0 };
  }
  const raw = getCardValue(args.opponentCardId, oppLh, args.greedTaxActive);
  let eff = Math.max(0, raw - args.opponentWrathPenalty);
  let exchanges = 0;
  frames.push({ panicRemaining: panicPow, opponentEffective: eff });
  while (panicPow > 0 && eff > 0) {
    panicPow -= 1;
    eff -= 1;
    exchanges += 1;
    frames.push({ panicRemaining: panicPow, opponentEffective: eff });
  }
  return { frames, exchanges };
}

function panicRankLadderForVisual(parsed: ReturnType<typeof parseCard>): readonly string[] | null {
  if (parsed.isJoker) return null;
  if (parsed.suit === 'Swords' && isPanicBladeNumericValue(parsed.value)) return PANIC_BLADE_RANK_VALUES;
  return VALUES as readonly string[];
}

/** Match {@link PanicClashResolution} — step printed ranks down panic exchange beats for HUD / stored outcome. */
export function reduceCardRankForPanicDisplay(cardId: string, downBy: number): string {
  if (downBy <= 0) return cardId;
  const parsed = parseCard(cardId);
  if (parsed.isJoker) return cardId;
  const ladder = panicRankLadderForVisual(parsed);
  if (!ladder?.length) return cardId;
  const idx = ladder.indexOf(parsed.value as (typeof ladder)[number]);
  if (idx <= 0) return cardId;
  const nextIdx = Math.max(0, idx - downBy);
  return `${parsed.suit}-${ladder[nextIdx]}`;
}

export function panicClashDisplayedCardPair(args: {
  panicCardId: string;
  opponentCardId: string;
  opponentWrathPenalty: number;
  greedTaxActive: boolean;
  opponentLustBump?: boolean;
}): { panicDisplayed: string; opponentDisplayed: string } {
  const { frames } = buildPanicExchangeFrames(args);
  if (!frames.length) {
    return { panicDisplayed: args.panicCardId, opponentDisplayed: args.opponentCardId };
  }
  const f0 = frames[0]!;
  const fLast = frames[frames.length - 1]!;
  const initialPanic = f0.panicRemaining ?? panicSwordStrikeStrength(args.panicCardId);
  const initialOpp = f0.opponentEffective ?? 0;
  const panicDisplayed = reduceCardRankForPanicDisplay(
    args.panicCardId,
    Math.max(0, initialPanic - fLast.panicRemaining),
  );
  const opponentDisplayed = reduceCardRankForPanicDisplay(
    args.opponentCardId,
    Math.max(0, initialOpp - fLast.opponentEffective),
  );
  return { panicDisplayed, opponentDisplayed };
}

/** Replay trick winner using frozen outcome cards (+ Justice summons) with appended clash penalties — host is always `calculateOutcome`'s historical p1. */
export function resolveFrozenTrickWinnerForPanic(params: {
  roomData: Pick<RoomData, 'settings' | 'activeCurses'>;
  hostUid: string;
  guestUid: string;
  frozen: Pick<NonNullable<RoomData['lastOutcome']>, 'cardsPlayed' | 'summonedCards' | 'targetSuit' | 'wrathFx'>;
  extraClashPenaltyByUid: Record<string, number>;
  lustReplay?: LustReplayContext;
}): string | 'draw' {
  const { hostUid: p1Uid, guestUid: p2Uid, frozen } = params;
  const curseEnabled = params.roomData.settings.enableCurseCards !== false;
  const greedTaxActive = curseEnabled && greedCurseActive(params.roomData.activeCurses ?? []);
  const greedJointTrump = greedTaxActive && frozen.targetSuit === 'Diamonds';

  const c1 = frozen.cardsPlayed[p1Uid];
  const c2 = frozen.cardsPlayed[p2Uid];
  if (!c1 || !c2 || typeof c1 !== 'string' || typeof c2 !== 'string') return 'draw';
  const lustCtx = params.lustReplay;
  const lhBase = lustCtx?.lustHeartRules ?? false;
  const lhPlayed = lustCtx?.lhPlayed ?? ((_card: string) => false);

  const wrathTar = frozen.wrathFx?.targetUid ?? null;
  const wrathMag =
    wrathTar && frozen.wrathFx?.minionCard ? getWrathMagnitude(frozen.wrathFx.minionCard) : 0;
  const penFor = (uid: string, card: string): number => {
    let pen = wrathTar === uid && wrathMag && !parseCard(card).isJoker && card !== GROVEL_CARD_ID ? wrathMag : 0;
    pen += params.extraClashPenaltyByUid[uid] ?? 0;
    return pen;
  };

  const wp1 = penFor(p1Uid, c1);
  const wp2 = penFor(p2Uid, c2);

  const mainSides = [lhPlayed(c1), lhPlayed(c2)] as const;
  const res = evaluateTrickClash(
    c1,
    c2,
    frozen.targetSuit,
    lhBase,
    greedTaxActive,
    greedJointTrump,
    wp1,
    wp2,
    mainSides,
  );

  const s1 = frozen.summonedCards?.[p1Uid];
  const s2 = frozen.summonedCards?.[p2Uid];

  if (s1 && s2) {
    const r1 = evaluateTrickClash(
      s1,
      s2,
      frozen.targetSuit,
      lhBase,
      greedTaxActive,
      greedJointTrump,
      penFor(p1Uid, s1),
      penFor(p2Uid, s2),
      [lhPlayed(s1), lhPlayed(s2)],
    );
    if (res === 'p1' || r1 === 'p1') return p1Uid;
    if (res === 'p2' || r1 === 'p2') return p2Uid;
    return 'draw';
  }
  if (s1) {
    const rS = evaluateTrickClash(
      s1,
      c2,
      frozen.targetSuit,
      lhBase,
      greedTaxActive,
      greedJointTrump,
      penFor(p1Uid, s1),
      penFor(p2Uid, c2),
      [lhPlayed(s1), lhPlayed(c2)],
    );
    if (res === 'p1' || rS === 'p1') return p1Uid;
    if (res === 'p2' && rS === 'p2') return p2Uid;
    return 'draw';
  }
  if (s2) {
    const rS = evaluateTrickClash(
      s2,
      c1,
      frozen.targetSuit,
      lhBase,
      greedTaxActive,
      greedJointTrump,
      penFor(p2Uid, s2),
      penFor(p1Uid, c1),
      [lhPlayed(s2), lhPlayed(c1)],
    );
    if (res === 'p2' || rS === 'p2') return p2Uid;
    if (res === 'p1' && rS === 'p1') return p1Uid;
    return 'draw';
  }

  return res === 'p1' ? p1Uid : res === 'p2' ? p2Uid : 'draw';
}

type OutcomeGain = NonNullable<RoomData['lastOutcome']>['gains'][string][number];

function cloneOutcomeGains(
  gains: NonNullable<RoomData['lastOutcome']>['gains'],
): NonNullable<RoomData['lastOutcome']>['gains'] {
  const keys = Object.keys(gains || {});
  const out: Record<string, OutcomeGain[]> = {};
  for (const k of keys) {
    out[k] = [...(gains[k] || [])];
  }
  return out;
}

/** Re-stitch draw-based acquisitions after clash-only panic rerolls (standard ladder + famine penalty). */
export function rebuildGainsAfterPanicWinnerChange(
  prevOutcome: NonNullable<RoomData['lastOutcome']>,
  nextWinner: string | 'draw',
  roomSnap: Pick<RoomData, 'hostUid' | 'famineActive'>,
): NonNullable<RoomData['lastOutcome']>['gains'] {
  const gains = cloneOutcomeGains(prevOutcome.gains);
  const uids = Object.keys(gains);
  if (uids.length < 2) return gains;

  const p1Uid = roomSnap.hostUid;
  const p2Uid = uids.find((id) => id !== p1Uid)!;

  for (const uid of [p1Uid, p2Uid]) {
    gains[uid] = gains[uid].filter((g) => !(g.type === 'draw' && g.id === 'standard'));
  }
  /** Famine loser penalty stacks as one “card loss” marker on the prior loser snapshot; strip and optionally re-append. */
  for (const uid of [p1Uid, p2Uid]) {
    gains[uid] = gains[uid].filter((g) => !(g.type === 'draw' && typeof g.id === 'number' && g.id < 0));
  }

  if (nextWinner === 'draw' || !nextWinner) return gains;

  const famineRule = !!roomSnap.famineActive;
  const newLoser = nextWinner === p1Uid ? p2Uid : p1Uid;

  if (famineRule) {
    gains[newLoser].push({ type: 'draw', id: -1 });
  } else {
    gains[nextWinner].push({ type: 'draw', id: 'standard' });
  }

  const chariotPatch = (
    loserUid: string | null,
    winnerWas: typeof nextWinner | 'draw',
  ): { uid: string; cardId: string } | null => {
    if (winnerWas === 'draw' || !loserUid) return null;
    const maj = prevOutcome.powerCardIdsPlayed[loserUid];
    if (maj !== 7 || prevOutcome.powerCardTowerBlocked?.[loserUid]) return null;
    const played = prevOutcome.cardsPlayed[loserUid];
    const pc = parseCard(played);
    if (pc.isJoker) return null;
    const ix = (VALUES as readonly string[]).indexOf(pc.value as (typeof VALUES)[number]);
    if (ix < 0) return null;
    const newVal = VALUES[Math.min(ix + 1, VALUES.length - 1)];
    return { uid: loserUid, cardId: `${pc.suit}-${newVal}` };
  };

  const magicianPatch = (
    loserUid: string | null,
    winnerWas: typeof nextWinner | 'draw',
  ): string | null => {
    if (winnerWas === 'draw' || !loserUid) return null;
    const maj = prevOutcome.powerCardIdsPlayed[loserUid];
    if (maj !== 2 || prevOutcome.powerCardTowerBlocked?.[loserUid]) return null;
    return loserUid;
  };

  /** Remove salvage lines tied to whichever seat *lost* previously, then replay for the recomputed loser. */
  const oldLoserUid =
    prevOutcome.winnerUid === 'draw'
      ? null
      : prevOutcome.winnerUid === p1Uid
        ? p2Uid
        : p1Uid;
  const oldChariot = chariotPatch(oldLoserUid, prevOutcome.winnerUid);
  if (oldChariot) {
    gains[oldChariot.uid] = gains[oldChariot.uid].filter(
      (g) => !(g.type === 'card' && g.id === oldChariot.cardId),
    );
  }
  const oldMag = magicianPatch(oldLoserUid, prevOutcome.winnerUid);
  if (oldMag) {
    gains[oldMag] = gains[oldMag].filter((g) => !(g.type === 'draw' && g.id === 1));
  }

  const nc = chariotPatch(newLoser, nextWinner);
  if (nc) gains[nc.uid].push({ type: 'card', id: nc.cardId });
  const nm = magicianPatch(newLoser, nextWinner);
  if (nm) gains[nm].push({ type: 'draw', id: 1 });

  return gains;
}

/**
 * One-line reason the winning card beats the losing card (winner card first), aligned with evaluateTrickClash.
 */
export function explainPlainClash(
  winningCardStr: string,
  losingCardStr: string,
  targetSuit: Suit,
  lustHeartRules = false,
  greedTaxActive = false,
  greedJointDiamondsCoins = false,
  /** [winner virtual lust?, loser virtual lust?] aligned to winner/loser card order. */
  lustHeartRulesSides?: readonly [boolean, boolean],
  /** Optional clash stamina penalties (Wrath + panic), same order as winner/loser cards — mirrors evaluateTrickClash. */
  clashValuePenaltySides?: readonly [number, number],
): string {
  const prW = parseCard(winningCardStr);
  const prL = parseCard(losingCardStr);
  const targ = targetSuit;
  const lMid = describeCardPlain(losingCardStr);
  const trumpLabel =
    greedJointDiamondsCoins && targ === 'Diamonds' ? 'Diamonds or Coins' : `${targ}`;

  if (prW.isJoker && prL.isJoker) return 'Both played a Joker — tie.';

  if (prW.isJoker && !prL.isJoker) {
    if (targ === 'Stars') {
      return `A Joker wins on Stars — normal cards take the Star field, but a Joker never becomes a Star.`;
    }
    if (targ === 'Moons') {
      return `A Joker wins — ${sentenceCard(losingCardStr)} is Moons on a Moons table.`;
    }
    return `A Joker wins over ${sentenceCard(losingCardStr)} — it matched table suit (${trumpLabel}).`;
  }

  if (!prW.isJoker && prL.isJoker) {
    if (targ === 'Stars') {
      return `On Stars, a suited card should not outrank a lone Joker — if you see this, report a bug.`;
    }
    if (targ === 'Moons') {
      return `${sentenceCard(winningCardStr)} is not Moons on a Moons table — that beats a Joker.`;
    }
    return `${sentenceCard(winningCardStr)} did not match table suit (${trumpLabel}); that beats a Joker (Frogs, Bones never count as trump).`;
  }

  const wField = isOnTargetField(winningCardStr, targ, greedJointDiamondsCoins);
  const lField = isOnTargetField(losingCardStr, targ, greedJointDiamondsCoins);
  const lhW = lustHeartRulesSides?.[0] ?? lustHeartRules;
  const lhL = lustHeartRulesSides?.[1] ?? lustHeartRules;
  let wv = getCardValue(winningCardStr, lhW, greedTaxActive);
  let lv = getCardValue(losingCardStr, lhL, greedTaxActive);
  if (clashValuePenaltySides) {
    const penW = clashValuePenaltySides[0] ?? 0;
    const penL = clashValuePenaltySides[1] ?? 0;
    if (!prW.isJoker) wv = Math.max(0, wv - penW);
    if (!prL.isJoker) lv = Math.max(0, lv - penL);
  }

  if (wField && !lField)
    return `${sentenceCard(winningCardStr)} matched table suit (${trumpLabel}); ${lMid} did not — table suit wins.`;
  if (wv !== lv) {
    const scope = wField ? `both on table suit (${trumpLabel})` : `neither matched table suit (${trumpLabel}), so ranks decide`;
    return `${sentenceCard(winningCardStr)} (${wv}) beats ${lMid} (${lv}) — ${scope}.`;
  }
  const tieScope = wField ? `both on (${trumpLabel})` : `neither matched (${trumpLabel})`;
  return `${sentenceCard(winningCardStr)} and ${lMid} tie — ${tieScope}.`;
}

function labelCommittedPowerOrCurse(id: number | null): string {
  if (id === null) return 'None';
  if (isCurseCardId(id)) return CURSES[id]?.name ?? 'Curse';
  return MAJOR_ARCANA[id]?.name ?? `Power ${id}`;
}

type GameEvent = 
  | { type: 'STATE_UPDATE', state: RoomData }
  | { type: 'PLAYER_JOIN', name: string, uid: string }
  | { type: 'PLAY_CARD', uid: string, cardId: string }
  | { type: 'REORDER_HAND', uid: string, hand: string[] }
  | { type: 'PROCEED_NEXT', uid: string }
  | { type: 'UPDATE_SETTINGS', settings: GameSettings }
  | { type: 'SPIN_DESPERATION', uid: string, offset: number }
  | { type: 'RESOLVE_DESPERATION', uid: string }
  | { type: 'SELECT_DRAFT', uid: string, powerCardId: number }
  | { type: 'CHEAT_POWER', uid: string, powerCardId: number }
  | { type: 'CHEAT_TRIM_DECK', uid: string, removeCount: number }
  | { type: 'CHEAT_DISCARD_HAND_CARD', uid: string, cardId: string }
  | { type: 'CHEAT_ACTIVATE_CURSE'; uid: string; curseId: number }
  | { type: 'CHEAT_CLEAR_ACTIVE_CURSES'; uid: string }
  | { type: 'PLAY_POWER_CARD', uid: string, powerCardId: number | null }
  | { type: 'SUBMIT_POWER_DECISION', uid: string, option: string, wheelOffset?: number; priestessSwapToCard?: string | null }
  | { type: 'SET_LOBBY_READY', uid: string, ready: boolean }
  | { type: 'SEND_CHAT', uid: string, text: string }
  | { type: 'USE_PANIC_DICE', uid: string }
  | {
      type: 'ROLL_DICE_TEST_BROADCAST',
      uid: string,
      rollId: string,
      notation: string,
      dice: number[],
      total: number,
      startedAt: number;
      presentation?: 'hudBottom' | 'resolutionPage';
    }
  | { type: 'CARD_SHOP_SET_OPEN'; uid: string; open: boolean }
  | { type: 'CARD_SHOP_BUY'; uid: string; slotId: string }
  | { type: 'SHOP_CURSOR'; uid: string; nx: number; ny: number }
  /** Guest asks host to push a full snapshot (tab focus, network recovery, periodic safety). */
  | { type: 'REQUEST_STATE_SYNC'; uid: string };

export type DicePresentation = 'hudBottom' | 'resolutionPage';

export type DiceTestRollPayload = {
  uid: string;
  rollId: string;
  notation: string;
  dice: number[];
  total: number;
  startedAt: number;
  /** Panic HUD strip vs fullscreen transparent resolution layer. */
  presentation?: DicePresentation;
  /** Silver coin (`1dc`) leg labels for Cash Chips / coin-style rolls. */
  coinFlipLegends?: { heads: string; tails: string };
};

const STORAGE_KEY = 'preydator_settings';

function rollFairD6(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** `true` ⇒ “first contender” wins (~50%); matches legacy `Math.random() > 0.5`-style halves. */
function fairHalfFromD6(d: number): boolean {
  return d <= 3;
}

const normalizeGameSettings = (raw: Partial<GameSettings> | GameSettings): GameSettings =>
  normalizeLobbyGameSettings(raw);

const loadSettings = (): GameSettings => loadPersistedLobbySettings(STORAGE_KEY);

const saveSettings = (settings: GameSettings) => persistLobbyDefaults(STORAGE_KEY, settings);

/** Same slice weights as wheels module / UI */
export const DESPERATION_SLICES = DESPERATION_GAME_SLICES;

/** Whether `uid` may start a desperation spin under current role + Preydator seat rules. */
export function desperationSpinAllowed(room: RoomData, uid: string, player: PlayerData): boolean {
  const s = room.settings;
  if (!s || !s.enableDesperation) return false;
  if (s.hostRole === 'Preydator') {
    const mode = s.preydatorDesperationSeats ?? 'guest';
    if (mode === 'both') return true;
    if (mode === 'host') return uid === room.hostUid;
    return uid !== room.hostUid;
  }
  if (player.role === 'Predator') return false;
  return player.role === 'Prey';
}

export class GameService {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private isHost = false;
  private state: RoomData | null = null;
  private onStateChange: ((state: RoomData) => void) | null = null;
  private onDiceTestRoll: ((payload: DiceTestRollPayload) => void) | null = null;
  private myUid: string = '';
  private powerResolutionTimer: ReturnType<typeof setTimeout> | null = null;
  private powerShowdownClearTimer: ReturnType<typeof setTimeout> | null = null;
  private rescueHostRebindInFlight = false;
  /** Host: debounce shop cursor broadcasts (~14 Hz flush of latest coords). */
  private shopCursorFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private shopCursorPending: { uid: string; nx: number; ny: number } | null = null;
  /** Throttle host focus broadcasts / guest resync pings so tab wake storms stay cheap. */
  private lastHostSessionResyncAt = 0;
  private lastGuestSessionResyncRequestAt = 0;

  constructor() {
    this.myUid = Math.random().toString(36).substring(2, 9);
  }

  async init(onStateChange: (state: RoomData) => void): Promise<string> {
    this.onStateChange = onStateChange;
    return new Promise((resolve, reject) => {
      this.peer = new Peer();
      this.peer.on('open', (id) => resolve(id));
      this.peer.on('error', (err) => reject(err));
      
      this.peer.on('connection', (conn) => {
        if (!this.isHost) {
          conn.close();
          return;
        }

        const playerCount = this.state ? Object.keys(this.state.players).length : 0;
        const aliveRemote =
          !!this.connection && 'open' in this.connection ? (this.connection as DataConnection & { open: boolean }).open : false;

        if (aliveRemote && playerCount >= 2) {
          conn.close();
          return;
        }

        if (this.connection && !aliveRemote) {
          try {
            this.connection.close();
          } catch {
            /* ignore */
          }
        }

        this.connection = conn;
        this.setupConnection(conn);
      });
    });
  }

  getUid() {
    return this.myUid;
  }

  getIsHost(): boolean {
    return this.isHost;
  }

  getState(): RoomData | null {
    return this.state;
  }

  /** Dev only: publish Card Creator pack for guest browsers that do not share the host’s localStorage. */
  publishCardArtSession(payload: CardArtSessionPayload) {
    if (!CARD_ART_TOOLS_ENABLED || !this.isHost || !this.state) return;
    this.state = {
      ...this.state,
      cardArtSession: payload,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  /**
   * Local split-screen / tab refresh: reclaim the same PeerJS id and room state after UI unmount.
   * Caller should `await` a short delay before guest `resumeDualGuest` connects.
   */
  async resumeDualHost(
    snapshot: { roomId: string; myUid: string; room: RoomData; playerName: string },
    onStateChange: (state: RoomData) => void,
  ): Promise<void> {
    this.destroy();
    await new Promise<void>((r) => setTimeout(r, 80));
    this.myUid = snapshot.myUid;
    this.isHost = true;
    this.onStateChange = onStateChange;
    this.state = {
      ...snapshot.room,
      code: snapshot.roomId,
      updatedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      try {
        this.peer = new Peer(snapshot.roomId);
      } catch (e) {
        reject(e);
        return;
      }
      const t = setTimeout(() => reject(new Error('Host resume timeout')), 16000);
      this.peer!.on('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
      this.peer!.on('open', () => {
        clearTimeout(t);
        resolve();
      });
      this.peer!.on('connection', (conn) => {
        if (!this.isHost) {
          conn.close();
          return;
        }
        const playerCount = this.state ? Object.keys(this.state.players).length : 0;
        const aliveRemote =
          !!this.connection && 'open' in this.connection
            ? (this.connection as DataConnection & { open: boolean }).open
            : false;
        if (aliveRemote && playerCount >= 2) {
          conn.close();
          return;
        }
        if (this.connection && !aliveRemote) {
          try {
            this.connection.close();
          } catch {
            /* ignore */
          }
        }
        this.connection = conn;
        this.setupConnection(conn);
      });
    });
    onStateChange(this.state!);
  }

  async resumeDualGuest(
    snapshot: { roomId: string; myUid: string; playerName: string },
    onStateChange: (state: RoomData) => void,
  ): Promise<void> {
    return this.joinRoom(snapshot.roomId, snapshot.playerName, onStateChange, { reuseUid: snapshot.myUid });
  }

  async createRoom(playerName: string, onStateChange: (state: RoomData) => void): Promise<string> {
    this.isHost = true;
    const roomId = await this.init(onStateChange);
    
    this.state = {
      code: roomId,
      status: 'waiting',
      settings: loadSettings(),
      players: {
        [this.myUid]: {
          uid: this.myUid,
          name: playerName,
          role: 'Predator',
          hand: [],
          powerCards: [],
          currentMove: null,
          currentPowerCard: null,
          confirmed: false,
          readyForNextRound: false,
          desperationTier: 0,
          desperationResult: null,
          desperationSpinning: false,
          desperationOffset: 0,
          panicDiceUsed: false,
          tokenBalance: 0,
        }
      },
      currentTurn: 1,
      targetSuit: SUITS[Math.floor(Math.random() * SUITS.length)],
      availableSuits: [...SUITS],
      wheelOffset: Math.random(),
      deck: [],
      winner: null,
      hostUid: this.myUid,
      lobbySettingsRevision: 0,
      guestLobbyNotice: null,
      famineActive: false,
      pendingPowerDecisions: {},
      powerDeck: [],
      draftSets: [],
      draftTurn: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chatMessages: [],
      activeCurses: [],
    };

    this.onStateChange?.(this.state);
    return roomId;
  }

  async updateSettings(settings: GameSettings) {
    if (!this.isHost || !this.state) return;
    const normalized = normalizeGameSettings(settings);
    const guestUid = Object.keys(this.state.players).find(uid => uid !== this.myUid);
    const updatedPlayers = { ...this.state.players };
    let lobbySettingsRevision = this.state.lobbySettingsRevision ?? 0;
    let guestLobbyNotice: string | null = this.state.guestLobbyNotice ?? null;
    if (guestUid && this.state.status === 'waiting') {
      lobbySettingsRevision += 1;
      guestLobbyNotice = 'Game settings were updated.';
      updatedPlayers[guestUid] = { ...updatedPlayers[guestUid], lobbyGuestReady: false };
    }
    this.state = {
      ...this.state,
      settings: normalized,
      players: updatedPlayers,
      lobbySettingsRevision,
      guestLobbyNotice,
      updatedAt: Date.now()
    };
    saveSettings(normalized);
    this.broadcastState();
  }

  async joinRoom(
    roomId: string,
    playerName: string,
    onStateChange: (state: RoomData) => void,
    opts?: { reuseUid?: string },
  ): Promise<void> {
    this.onStateChange = onStateChange;
    this.isHost = false;
    if (opts?.reuseUid) {
      this.myUid = opts.reuseUid;
    }
    await this.init(onStateChange);

    return new Promise((resolve, reject) => {
      if (!this.peer) return reject('Peer not initialized');
      
      const timeout = setTimeout(() => {
        this.connection?.close();
        reject('Connection timeout');
      }, 10000);
      
      const conn = this.peer.connect(roomId);
      this.connection = conn;
      
      conn.on('open', () => {
        clearTimeout(timeout);
        this.setupConnection(conn);
        this.sendEvent({ type: 'PLAYER_JOIN', name: playerName, uid: this.myUid });
        resolve();
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      
      // Handle the case where the peer exists but connection fails
      this.peer!.on('error', (err) => {
        if (err.type === 'peer-unavailable' || err.type === 'unavailable-id') {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    conn.on('data', (data) => {
      const event = data as GameEvent;
      this.handleEvent(event);
    });

    conn.on('close', () => {
      console.log('Connection closed');
      if (this.connection === conn) this.connection = null;
      if (this.isHost) {
        if (this.state?.settings.enablePokerChips) {
          this.clearShopCursorPipeline();
          this.state = {
            ...this.state,
            cardShopBrowsersUids: [],
            shopBrowsingUid: null,
            shopRemoteCursor: null,
            updatedAt: Date.now(),
          };
          this.broadcastState();
        }
        return;
      }
      void this.promoteGuestToRescueHost();
    });
  }

  /**
   * Guest contingency: if the host disappears, rebind this client as host on the same room id so the match can continue.
   * Falls back to local host-authority mode even if room-id rebind fails.
   */
  private async promoteGuestToRescueHost() {
    if (this.isHost || this.rescueHostRebindInFlight || !this.state) return;
    this.rescueHostRebindInFlight = true;
    const roomId = this.state.code;

    const adoptLocalHostState = () => {
      this.isHost = true;
      if (!this.state) return;
      this.state = {
        ...this.state,
        hostUid: this.myUid,
        cardShopBrowsersUids: [],
        shopBrowsingUid: null,
        shopRemoteCursor: null,
        updatedAt: Date.now(),
      };
      this.onStateChange?.(this.state);
    };

    try {
      this.clearShopCursorPipeline();
      if (this.connection) {
        try {
          this.connection.close();
        } catch {
          /* noop */
        }
      }
      this.connection = null;
      if (this.peer) {
        try {
          this.peer.destroy();
        } catch {
          /* noop */
        }
      }
      this.peer = null;

      if (!roomId) {
        adoptLocalHostState();
        return;
      }

      await new Promise<void>((r) => setTimeout(r, 120));
      this.isHost = true;
      this.state = {
        ...this.state,
        hostUid: this.myUid,
        cardShopBrowsersUids: [],
        shopBrowsingUid: null,
        shopRemoteCursor: null,
        updatedAt: Date.now(),
      };

      await new Promise<void>((resolve, reject) => {
        try {
          this.peer = new Peer(roomId);
        } catch (err) {
          reject(err);
          return;
        }
        const timeout = setTimeout(() => reject(new Error('Rescue host rebind timeout')), 9000);
        this.peer!.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        this.peer!.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        this.peer!.on('connection', (nextConn) => {
          if (!this.isHost) {
            nextConn.close();
            return;
          }
          if (this.connection && (this.connection as DataConnection & { open?: boolean }).open) {
            nextConn.close();
            return;
          }
          this.connection = nextConn;
          this.setupConnection(nextConn);
        });
      });

      this.broadcastState();
    } catch {
      adoptLocalHostState();
    } finally {
      this.rescueHostRebindInFlight = false;
    }
  }

  private handleEvent(event: GameEvent) {
    if (this.isHost) {
      const remoteUid = this.getRemotePlayerUid();
      if (event.type === 'PLAYER_JOIN') {
        this.handlePlayerJoin(event.name, event.uid);
      } else if (event.type === 'PLAY_CARD') {
        if (remoteUid) {
          this.processMove(remoteUid, event.cardId);
        }
      } else if (event.type === 'REORDER_HAND') {
        if (remoteUid && event.uid === remoteUid) {
          this.processReorderHand(remoteUid, event.hand);
        }
      } else if (event.type === 'PROCEED_NEXT') {
        if (remoteUid) {
          this.handleProceedNext(remoteUid);
        }
      } else if (event.type === 'UPDATE_SETTINGS') {
        if (remoteUid) return;
        this.updateSettings(event.settings);
      } else if (event.type === 'SET_LOBBY_READY') {
        if (!remoteUid || event.uid !== remoteUid) return;
        this.handleSetLobbyReady(event.uid, event.ready);
      } else if (event.type === 'SPIN_DESPERATION') {
        if (remoteUid) {
          this.processSpinDesperation(remoteUid, Math.random());
        }
      } else if (event.type === 'RESOLVE_DESPERATION') {
        if (remoteUid) {
          this.handleResolveDesperation(remoteUid);
        }
      } else if (event.type === 'SELECT_DRAFT') {
        if (remoteUid) {
          this.handleSelectDraft(remoteUid, event.powerCardId, this.state?.draftTurn || 0);
        }
      } else if (event.type === 'CHEAT_POWER') {
        if (remoteUid) {
          this.handleCheatPower(remoteUid, event.powerCardId);
        }
      } else if (event.type === 'CHEAT_TRIM_DECK') {
        if (remoteUid) {
          this.handleCheatTrimDeck(event.removeCount);
        }
      } else if (event.type === 'CHEAT_DISCARD_HAND_CARD') {
        if (remoteUid) {
          this.handleCheatDiscardHandCard(remoteUid, event.cardId);
        }
      } else if (event.type === 'CHEAT_ACTIVATE_CURSE') {
        if (remoteUid) {
          this.handleCheatActivateCurse(event.curseId);
        }
      } else if (event.type === 'CHEAT_CLEAR_ACTIVE_CURSES') {
        if (remoteUid) {
          this.handleCheatClearActiveCurses();
        }
      } else if (event.type === 'PLAY_POWER_CARD') {
        if (remoteUid) {
          this.handlePlayPowerCard(remoteUid, event.powerCardId);
        }
      } else if (event.type === 'SUBMIT_POWER_DECISION') {
        if (remoteUid) {
          this.handleSubmitPowerDecision(remoteUid, event.option, event.wheelOffset, event.priestessSwapToCard);
        }
      } else if (event.type === 'SEND_CHAT') {
        if (remoteUid && event.uid === remoteUid) {
          this.handleChatMessage(remoteUid, event.text);
        }
      } else if (event.type === 'USE_PANIC_DICE') {
        if (remoteUid && event.uid === remoteUid) {
          this.handlePanicDiceUse(remoteUid);
        }
      } else if (event.type === 'CARD_SHOP_SET_OPEN') {
        if (remoteUid && event.uid === remoteUid) {
          this.handleCardShopSetBrowsing(event.uid, event.open);
        }
      } else if (event.type === 'CARD_SHOP_BUY') {
        if (remoteUid && event.uid === remoteUid) {
          this.tryPurchaseCardShopSlot(event.uid, event.slotId);
        }
      } else if (event.type === 'SHOP_CURSOR') {
        if (remoteUid && event.uid === remoteUid) {
          this.handleShopCursorDirect(event.uid, event.nx, event.ny);
        }
      } else if (event.type === 'REQUEST_STATE_SYNC') {
        if (remoteUid && event.uid === remoteUid && this.state) {
          this.broadcastState();
        }
      }
    } else {
      if (event.type === 'STATE_UPDATE') {
        /** Full snapshot sanitize: missing `deck` / `hand` / `tiers` after P2P sync whitescreens the table UI. */
        this.state = sanitizeRoomDataForClient(event.state);
        this.onStateChange?.(this.state);
      } else if (event.type === 'ROLL_DICE_TEST_BROADCAST') {
        this.onDiceTestRoll?.({
          uid: event.uid,
          rollId: event.rollId,
          notation: event.notation,
          dice: event.dice,
          total: event.total,
          startedAt: event.startedAt,
          presentation: event.presentation,
        });
      }
    }
  }

  private getRemotePlayerUid(): string | null {
    if (!this.state) return null;
    return Object.keys(this.state.players).find(uid => uid !== this.myUid) || null;
  }

  private handlePlayerJoin(name: string, uid: string) {
    if (!this.state) return;
    /** Dev / P2P: rejoin matches by player name — release builds should authenticate room + invite token before migration. */

    const existingPlayerUid = Object.keys(this.state.players).find((id) => this.state!.players[id].name === name);

    if (existingPlayerUid) {
      if (existingPlayerUid === uid) {
        this.broadcastState();
        return;
      }
      const player = this.state.players[existingPlayerUid];
      const updatedPlayers = { ...this.state.players };
      delete updatedPlayers[existingPlayerUid];
      updatedPlayers[uid] = { ...player, uid };

      let hostUid = this.state.hostUid;
      if (hostUid === existingPlayerUid) hostUid = uid;

      this.state = {
        ...this.state,
        hostUid,
        players: updatedPlayers,
        updatedAt: Date.now(),
      };
      this.broadcastState();
      return;
    }

    if (this.state.status !== 'waiting' || Object.keys(this.state.players).length >= 2) return;
    
    const settings = this.state.settings;

    let hostRole = settings.hostRole;
    let guestRole: PlayerRole;

    if (hostRole === 'Preydator') {
      // Internal roles for logic: Host is Pred, Guest is Prey
      hostRole = 'Predator';
      guestRole = 'Prey';
    } else {
      guestRole = hostRole === 'Predator' ? 'Prey' : 'Predator';
    }

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [uid]: {
          uid,
          name,
          role: 'Prey', // Initial placeholder
          hand: [],
          powerCards: [],
          currentMove: null,
          currentPowerCard: null,
          confirmed: false,
          readyForNextRound: false,
          lobbyGuestReady: false,
          desperationTier: 0,
          desperationResult: null,
          desperationSpinning: false,
          desperationOffset: 0,
          panicDiceUsed: false,
          tokenBalance: 0,
        }
      },
      updatedAt: Date.now()
    };

    this.broadcastState();
  }

  private handleSetLobbyReady(uid: string, ready: boolean) {
    if (!this.state || this.state.status !== 'waiting') return;
    if (uid === this.state.hostUid) return;
    const guest = this.state.players[uid];
    if (!guest) return;

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [uid]: { ...guest, lobbyGuestReady: ready }
      },
      guestLobbyNotice: ready ? null : this.state.guestLobbyNotice,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  async startGame() {
    if (!this.isHost || !this.state) return;
    const players = Object.keys(this.state.players);
    if (players.length < 2) return;
    const guestUid = players.find(uid => uid !== this.myUid);
    if (!guestUid || !this.state.players[guestUid].lobbyGuestReady) return;

    const settings = this.state.settings;
    const deck = createMultiDeck(settings.deckSizeMultiplier, settings.disableJokers);

    let hostRole = settings.hostRole;
    let guestRole: PlayerRole;

    if (hostRole === 'Preydator') {
      hostRole = 'Predator';
      guestRole = 'Prey';
    } else {
      guestRole = hostRole === 'Predator' ? 'Prey' : 'Predator';
    }

    const predatorHandSize = settings.predatorStartingCards;
    const preyHandSize = settings.preyStartingCards;

    const hostHandSize = hostRole === 'Predator' ? predatorHandSize : preyHandSize;
    const guestHandSize = guestRole === 'Predator' ? predatorHandSize : preyHandSize;

    const hostHand = deck.splice(0, hostHandSize);
    const guestHand = deck.splice(0, guestHandSize);

    let powerDeck = shuffle(Array.from({ length: 22 }, (_, i) => i));
    if (
      !settings.disablePowerCards &&
      settings.enableCurseCards &&
      settings.curseCardsInPowerDeck
    ) {
      powerDeck.push(
        CURSE_LUST,
        CURSE_LUST,
        CURSE_GLUTTONY,
        CURSE_GLUTTONY,
        CURSE_GREED,
        CURSE_GREED,
        CURSE_PRIDE,
        CURSE_PRIDE,
        CURSE_ENVY,
        CURSE_GREEN_EYED_MONSTER,
        CURSE_WRATH,
        CURSE_WRATH,
        CURSE_SLOTH,
        CURSE_SLOTH,
      );
      powerDeck = shuffle(powerDeck);
    }
    const draftSets: number[][] = [];
    if (!settings.disablePowerCards) {
      for (let i = 0; i < 3; i++) {
        draftSets.push(powerDeck.splice(0, 3));
      }
    }
    const draftPowerAppearances = settings.disablePowerCards ? [] : Array.from(new Set(draftSets.flat()));
    /** Prey seats: tier 0 on ladder when enabled; −1 = not on ladder until first spin → then tier 1. */
    const desperationOpenTier =
      settings.enableDesperation && settings.desperationStarterTierEnabled ? 0 : -1;

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [this.myUid]: {
          ...this.state.players[this.myUid],
          role: settings.hostRole === 'Preydator' ? 'Preydator' : hostRole,
          hand: hostHand,
          desperationTier:
            settings.enableDesperation && (settings.hostRole !== 'Predator') ? desperationOpenTier : 0,
          panicDiceUsed: false,
          tokenBalance: 0,
        },
        [guestUid]: {
          ...this.state.players[guestUid],
          role: settings.hostRole === 'Preydator' ? 'Preydator' : guestRole,
          hand: guestHand,
          desperationTier:
            settings.enableDesperation && guestRole !== 'Predator' ? desperationOpenTier : 0,
          panicDiceUsed: false,
          tokenBalance: 0,
        }
      },
      status: settings.disablePowerCards ? 'playing' : 'drafting',
      deck,
      powerDeck,
      draftSets,
      draftPowerAppearances,
      draftTurn: 0,
      guestLobbyNotice: null,
      pendingPowerDecisions: {},
      ...(settings.enablePokerChips
        ? {
            cardShop: createInitialCardShop(),
            cardShopBrowsersUids: [],
            shopBrowsingUid: null,
            pendingCardShopPurchases: [],
          }
        : {
            cardShop: undefined,
            cardShopBrowsersUids: undefined,
            shopBrowsingUid: undefined,
            pendingCardShopPurchases: undefined,
          }),
      updatedAt: Date.now()
    };

    this.broadcastState();
  }

  private processMove(uid: string, cardId: string) {
    if (!this.state || !this.state.players[uid]) return;

    const player = this.state.players[uid];
    if (player.confirmed) return;
    if (!player.hand.includes(cardId)) return;
    if (isShopPackPlaceholder(cardId)) return;

    const curseOk = this.state.settings.enableCurseCards !== false;
    const lustHr = curseOk && lustCurseActive(this.state.activeCurses);
    const greedTx = curseOk && greedCurseActive(this.state.activeCurses);
    if (
      curseOk &&
      prideCurseActive(this.state.activeCurses) &&
      this.state.prideCeilingCard &&
      isCardBlockedByPride(cardId, this.state.prideCeilingCard, lustHr, greedTx)
    ) {
      return;
    }
    if (
      curseOk &&
      envyCurseActive(this.state.activeCurses) &&
      !envyAllowsPlayCardId(player.hand, uid, cardId, this.state.envySealedCards)
    ) {
      return;
    }

    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...player,
      currentMove: cardId,
      confirmed: true
    };

    const allConfirmed = Object.values(updatedPlayers).every((p: PlayerData) => p.confirmed);

    if (allConfirmed) {
      const pendingPowerDecisions = this.createPendingPowerDecisions(
        updatedPlayers,
        this.state.draftPowerAppearances ?? []
      );
      const hasPendingDecisions = Object.values(pendingPowerDecisions).some(Boolean);
      if (hasPendingDecisions) {
        const uidsLocked = Object.keys(updatedPlayers);
        const engageMoves: Record<string, string> = {
          [uidsLocked[0]]: updatedPlayers[uidsLocked[0]].currentMove!,
          [uidsLocked[1]]: updatedPlayers[uidsLocked[1]].currentMove!
        };
        if (this.powerShowdownClearTimer) {
          clearTimeout(this.powerShowdownClearTimer);
          this.powerShowdownClearTimer = null;
        }
        this.state = {
          ...this.state,
          players: updatedPlayers,
          status: 'powering',
          engageMoves,
          awaitingPowerShowdown: true,
          pendingPowerDecisions,
          updatedAt: Date.now()
        };
        if (this.isHost) {
          this.powerShowdownClearTimer = setTimeout(() => {
            if (!this.state || this.state.status !== 'powering') return;
            this.state = { ...this.state, awaitingPowerShowdown: false, updatedAt: Date.now() };
            this.broadcastState();
            this.powerShowdownClearTimer = null;
          }, 2100);
        }
      } else {
        this.state = {
          ...this.state,
          players: updatedPlayers,
          status: 'results',
          pendingPowerDecisions: {},
          lastOutcome: this.calculateOutcome(this.state, updatedPlayers),
          updatedAt: Date.now()
        };
      }
    } else {
      this.state = {
        ...this.state,
        players: updatedPlayers,
        updatedAt: Date.now()
      };
    }

    this.broadcastState();
  }

  private processReorderHand(uid: string, newHandOrder: string[]) {
    if (!this.state || !this.state.players[uid]) return;

    const player = this.state.players[uid];
    if (player.confirmed) return;
    if (!samePlayingHandMultiset(player.hand, newHandOrder)) return;

    let nextEnvyCovet = this.state.envyCovet;
    const ec = nextEnvyCovet;
    if (ec && ec.uid === uid && player.hand.length) {
      const nextIdx = handIndexAfterReorder(player.hand, newHandOrder, ec.handIndex);
      if (nextIdx >= 0 && nextIdx < newHandOrder.length && nextIdx !== ec.handIndex) {
        nextEnvyCovet = { ...ec, handIndex: nextIdx };
      }
    }

    const updatedPlayers = {
      ...this.state.players,
      [uid]: {
        ...player,
        hand: [...newHandOrder],
      },
    };

    this.state = {
      ...this.state,
      players: updatedPlayers,
      ...(nextEnvyCovet !== this.state.envyCovet ? { envyCovet: nextEnvyCovet } : {}),
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  private handleProceedNext(uid: string) {
    if (!this.state || !this.state.players[uid]) return;

    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...updatedPlayers[uid],
      readyForNextRound: true
    };

    const allReady = Object.values(updatedPlayers).every((p: PlayerData) => p.readyForNextRound);
    
    if (allReady) {
      if (this.powerResolutionTimer) {
        clearTimeout(this.powerResolutionTimer);
        this.powerResolutionTimer = null;
      }
      this.state = this.applyRoundResults(this.state, updatedPlayers);
    } else {
      this.state = {
        ...this.state,
        players: updatedPlayers,
        updatedAt: Date.now()
      };
    }
    
    this.broadcastState();
  }

  private clearShopCursorPipeline() {
    if (this.shopCursorFlushTimer) {
      clearTimeout(this.shopCursorFlushTimer);
      this.shopCursorFlushTimer = null;
    }
    this.shopCursorPending = null;
  }

  private flushShopCursorToState = () => {
    this.shopCursorFlushTimer = null;
    if (!this.isHost || !this.state || !this.shopCursorPending) return;
    const { uid, nx, ny } = this.shopCursorPending;
    this.shopCursorPending = null;
    const shoppers = this.normalizeCardShopBrowsersUids();
    if (shoppers.length < 2 || !shoppers.includes(uid)) return;
    const prevSeq = this.state.shopRemoteCursor?.seq ?? 0;
    this.state = {
      ...this.state,
      shopRemoteCursor: { uid, nx, ny, seq: prevSeq + 1 },
      updatedAt: Date.now(),
    };
    this.broadcastState();
  };

  private handleShopCursorDirect(uid: string, nx: number, ny: number) {
    if (!this.isHost || !this.state?.settings.enablePokerChips) return;
    const shoppers = this.normalizeCardShopBrowsersUids();
    if (shoppers.length < 2 || !shoppers.includes(uid)) return;
    const cx = Math.max(0, Math.min(1, nx));
    const cy = Math.max(0, Math.min(1, ny));
    this.shopCursorPending = { uid, nx: cx, ny: cy };
    if (this.shopCursorFlushTimer) return;
    this.shopCursorFlushTimer = setTimeout(this.flushShopCursorToState, 24);
  }

  private normalizeCardShopBrowsersUids(): string[] {
    if (!this.state?.settings.enablePokerChips) return [];
    const raw = this.state.cardShopBrowsersUids;
    if (Array.isArray(raw)) {
      if (raw.length === 0) return [];
      const seen = new Set<string>();
      const out: string[] = [];
      for (const u of raw) {
        if (typeof u === 'string' && u.length > 0 && !seen.has(u)) {
          seen.add(u);
          out.push(u);
        }
      }
      return out;
    }
    const leg = this.state.shopBrowsingUid;
    return typeof leg === 'string' && leg.length > 0 ? [leg] : [];
  }

  private handleCardShopSetBrowsing(uid: string, open: boolean) {
    if (!this.isHost || !this.state?.settings.enablePokerChips) return;
    this.clearShopCursorPipeline();
    const prevSorted = [...this.normalizeCardShopBrowsersUids()].sort();
    let next: string[];
    if (open) {
      next = [...new Set([...prevSorted, uid])];
    } else {
      next = prevSorted.filter((u) => u !== uid);
    }
    next.sort();
    if (prevSorted.join('|') === next.join('|')) return;

    let shopRemoteCursor = this.state.shopRemoteCursor ?? null;
    if (next.length < 2) shopRemoteCursor = null;
    else if (shopRemoteCursor && !next.includes(shopRemoteCursor.uid)) shopRemoteCursor = null;

    this.state = {
      ...this.state,
      cardShopBrowsersUids: next,
      shopBrowsingUid: null,
      shopRemoteCursor,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  private tryPurchaseCardShopSlot(uid: string, slotId: string) {
    if (!this.isHost || !this.state?.settings.enablePokerChips || !this.state.cardShop) return;
    if (!['playing', 'powering', 'results'].includes(this.state.status)) return;
    const shop = this.state.cardShop;
    const slot = shop.slots[slotId];
    const player = this.state.players[uid];
    if (!slot || slot.soldOut || !player) return;

    const price = slotChargeTokens(slot);
    const balance = player.tokenBalance ?? 0;
    if (balance < price) return;

    const offer = slot.offer;
    if (offer.type === 'curse') {
      if (!isCurseCardId(offer.curseId)) return;
    } else if (offer.type === 'major') {
      if (!isMajorArcanaId(offer.powerId)) return;
    } else if (offer.type === 'joker') {
      if (offer.cardId !== 'Joker-1' && offer.cardId !== 'Joker-2') return;
    } else if (offer.type === 'suit') {
      parseCard(offer.cardId);
    }

    const mode = this.state.settings.cardShopConflictMode ?? 'coin_flip';

    /** Black Friday: first payer gets immediate delivery (sold out locks the row). */
    if (mode === 'black_friday') {
      const nextHand = [...player.hand];
      const nextPowers = [...player.powerCards];
      if (offer.type === 'curse') {
        nextPowers.push(offer.curseId);
      } else if (offer.type === 'major') {
        nextPowers.push(offer.powerId);
      } else {
        nextHand.push(offer.cardId);
      }

      this.state = {
        ...this.state,
        cardShop: {
          ...shop,
          slots: {
            ...shop.slots,
            [slotId]: { ...slot, soldOut: true },
          },
        },
        players: {
          ...this.state.players,
          [uid]: {
            ...player,
            hand: nextHand,
            powerCards: nextPowers,
            tokenBalance: balance - price,
          },
        },
        updatedAt: Date.now(),
      };
      this.broadcastState();
      return;
    }

    const packCardId = shopPackCardId(slotId);
    if (player.hand.includes(packCardId)) return;

    const turnNow = typeof this.state.currentTurn === 'number' && Number.isFinite(this.state.currentTurn) ? this.state.currentTurn : 1;
    const existing = [...(this.state.pendingCardShopPurchases ?? [])];
    if (existing.some((p) => p.uid === uid && p.slotId === slotId && p.scheduledResolveTurn === turnNow)) return;

    this.state = {
      ...this.state,
      players: {
        ...this.state.players,
        [uid]: {
          ...player,
          hand: [...player.hand, packCardId],
          tokenBalance: balance - price,
        },
      },
      pendingCardShopPurchases: [
        ...existing,
        { uid, slotId, tokensPaid: price, scheduledResolveTurn: turnNow },
      ],
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  /**
   * Coin Flip shop mode: when a trick resolves, packs bought during that trick (`scheduledResolveTurn === completingTurn`)
   * open — solo buyer gets delivery; paired buyers flip for the offer and the loser is refunded.
   */
  private flushCoinFlipShopPurchases(args: {
    completingTurn: number;
    players: Record<string, PlayerData>;
    cardShop: CardShopState;
    pendingAll: PendingCardShopPurchase[];
  }): { cardShop: CardShopState; pendingRemaining: PendingCardShopPurchase[]; extraEvents: ResolutionEvent[] } {
    const { players, cardShop, pendingAll } = args;
    const pendingRemaining = pendingAll.filter((p) => p.scheduledResolveTurn !== args.completingTurn);
    const due = pendingAll.filter((p) => p.scheduledResolveTurn === args.completingTurn);
    const extraEvents: ResolutionEvent[] = [];

    if (due.length === 0) {
      return { cardShop, pendingRemaining, extraEvents: [] };
    }

    let slots: CardShopState['slots'] = { ...cardShop.slots };

    const bySlot = new Map<string, PendingCardShopPurchase[]>();
    for (const p of due) {
      const list = bySlot.get(p.slotId) ?? [];
      list.push(p);
      bySlot.set(p.slotId, list);
    }

    const stripPackOnce = (hand: string[], slotIdS: string) => {
      const pid = shopPackCardId(slotIdS);
      const i = hand.indexOf(pid);
      if (i === -1) return false;
      hand.splice(i, 1);
      return true;
    };

    const nameOf = (u: string) => players[u]?.name ?? 'Player';

    const applyGrantOffer = (uidW: string, slotIdW: string): boolean => {
      const slotLive = slots[slotIdW];
      if (!slotLive || slotLive.soldOut) return false;
      const pl = players[uidW];
      if (!pl) return false;
      const { offer } = slotLive;
      if (offer.type === 'curse') {
        pl.powerCards = [...pl.powerCards, offer.curseId];
      } else if (offer.type === 'major') {
        pl.powerCards = [...pl.powerCards, offer.powerId];
      } else {
        pl.hand = [...pl.hand, offer.cardId];
      }
      slots = {
        ...slots,
        [slotIdW]: { ...slotLive, soldOut: true },
      };
      return true;
    };

    for (const [slotIdS, entries] of bySlot) {
      const slotLive = slots[slotIdS];
      if (!slotLive || slotLive.soldOut) {
        for (const e of entries) {
          const pl = players[e.uid];
          if (!pl) continue;
          stripPackOnce(pl.hand, slotIdS);
          pl.tokenBalance = (pl.tokenBalance ?? 0) + e.tokensPaid;
          extraEvents.push({
            type: 'COIN_FLIP',
            message: `${nameOf(e.uid)}: Cash Chips shelf unavailable — refunded ${e.tokensPaid} tokens.`,
          });
        }
        continue;
      }

      const dedupByUid = new Map<string, PendingCardShopPurchase>();
      for (const e of entries) {
        if (!dedupByUid.has(e.uid)) dedupByUid.set(e.uid, e);
      }
      const contenders = [...dedupByUid.values()];
      const offerLabel = describeShopOfferLine(slotLive.offer);

      if (contenders.length === 1) {
        const e = contenders[0]!;
        const pl = players[e.uid];
        if (!pl) continue;
        if (!stripPackOnce(pl.hand, slotIdS)) {
          extraEvents.push({
            type: 'COIN_FLIP',
            message: `${nameOf(e.uid)}: shop pack missing — refunded ${e.tokensPaid} chips.`,
          });
          pl.tokenBalance = (pl.tokenBalance ?? 0) + e.tokensPaid;
          continue;
        }
        if (applyGrantOffer(e.uid, slotIdS)) {
          extraEvents.push({
            type: 'COIN_FLIP',
            message: `${nameOf(e.uid)} unwraps Cash Chips (${offerLabel}).`,
          });
        } else {
          pl.tokenBalance = (pl.tokenBalance ?? 0) + e.tokensPaid;
          extraEvents.push({
            type: 'COIN_FLIP',
            message: `${nameOf(e.uid)} delivery failed — refunded ${e.tokensPaid} chips.`,
          });
        }
        continue;
      }

      const a = contenders[0]!;
      const b = contenders[1]!;
      /** First queued player = Heads, second = Tails (`1dc` coin: value 1 = heads, 0 = tails). */
      const headsUid = a.uid;
      const tailsUid = b.uid;
      extraEvents.push({
        type: 'COIN_FLIP',
        message: `Cash Chips — contested delivery\n${nameOf(headsUid)} → Heads\n${nameOf(tailsUid)} → Tails\nFlipping silver coin…`,
      });

      const plA = players[a.uid];
      const plB = players[b.uid];
      if (!plA || !plB) continue;

      const pk = shopPackCardId(slotIdS);
      const readyA = plA.hand.includes(pk);
      const readyB = plB.hand.includes(pk);
      if (!readyA || !readyB) {
        stripPackOnce(plA.hand, slotIdS);
        stripPackOnce(plB.hand, slotIdS);
        plA.tokenBalance = (plA.tokenBalance ?? 0) + a.tokensPaid;
        plB.tokenBalance = (plB.tokenBalance ?? 0) + b.tokensPaid;
        extraEvents.push({
          type: 'COIN_FLIP',
          message: `Contest dropped — missing packs; both players refunded their stakes.`,
        });
        continue;
      }
      stripPackOnce(plA.hand, slotIdS);
      stripPackOnce(plB.hand, slotIdS);

      const coinUp: 0 | 1 = Math.random() < 0.5 ? 1 : 0;
      const winnerEntry = coinUp === 1 ? a : b;
      const loserEntry = winnerEntry.uid === a.uid ? b : a;
      players[loserEntry.uid].tokenBalance = (players[loserEntry.uid].tokenBalance ?? 0) + loserEntry.tokensPaid;

      extraEvents.push({
        type: 'COIN_FLIP',
        coinFlipSides: { headsUid, tailsUid },
        message: `${nameOf(winnerEntry.uid)} wins — unwraps Cash Chips (${offerLabel}).\n${nameOf(loserEntry.uid)} refunded ${loserEntry.tokensPaid} chips. Coin: ${coinUp === 1 ? 'Heads' : 'Tails'} (${coinUp === 1 ? nameOf(headsUid) : nameOf(tailsUid)}).`,
        resolutionDice: [coinUp],
      });

      if (!applyGrantOffer(winnerEntry.uid, slotIdS)) {
        players[winnerEntry.uid].tokenBalance = (players[winnerEntry.uid].tokenBalance ?? 0) + winnerEntry.tokensPaid;
        extraEvents.push({
          type: 'COIN_FLIP',
          message: `${nameOf(winnerEntry.uid)} could not collect — refunded ${winnerEntry.tokensPaid} chips.`,
        });
      }
    }

    return { cardShop: { ...cardShop, slots }, pendingRemaining, extraEvents };
  }

  async playCard(cardId: string) {
    if (this.isHost) {
      this.processMove(this.myUid, cardId);
    } else {
      const me = this.state?.players?.[this.myUid];
      if (this.state && me && !me.confirmed && me.hand.includes(cardId)) {
        this.state = {
          ...this.state,
          players: {
            ...this.state.players,
            [this.myUid]: {
              ...me,
              currentMove: cardId,
              confirmed: true,
            },
          },
          updatedAt: Date.now(),
        };
        this.onStateChange?.(this.state);
      }
      this.sendEvent({ type: 'PLAY_CARD', uid: this.myUid, cardId });
    }
  }

  async reorderHand(newHandOrder: string[]) {
    if (this.isHost) {
      this.processReorderHand(this.myUid, newHandOrder);
    } else {
      this.sendEvent({ type: 'REORDER_HAND', uid: this.myUid, hand: newHandOrder });
    }
  }

  async syncSettings(settings: GameSettings) {
    if (!this.isHost || !this.state) return;
    this.updateSettings(settings);
  }

  async setLobbyReady(ready: boolean) {
    if (!this.state || this.state.status !== 'waiting') return;
    if (this.isHost) return;
    this.sendEvent({ type: 'SET_LOBBY_READY', uid: this.myUid, ready });
  }

  onDiceTestRollEvent(handler: ((payload: DiceTestRollPayload) => void) | null) {
    this.onDiceTestRoll = handler;
  }

  async setCardShopOpen(open: boolean) {
    if (this.isHost) {
      this.handleCardShopSetBrowsing(this.myUid, open);
    } else {
      this.sendEvent({ type: 'CARD_SHOP_SET_OPEN', uid: this.myUid, open });
    }
  }

  /** Normalized viewport pointer while this client has the cash shop open (throttle on the caller). */
  sendShopCursor(nx: number, ny: number) {
    if (!this.state?.settings.enablePokerChips) return;
    const shoppers = this.normalizeCardShopBrowsersUids();
    if (!shoppers.includes(this.myUid) || shoppers.length < 2) return;
    const cx = Math.max(0, Math.min(1, nx));
    const cy = Math.max(0, Math.min(1, ny));
    if (this.isHost) {
      this.handleShopCursorDirect(this.myUid, cx, cy);
    } else {
      this.sendEvent({ type: 'SHOP_CURSOR', uid: this.myUid, nx: cx, ny: cy });
    }
  }

  async buyCardShopSlot(slotId: string) {
    if (this.isHost) {
      this.tryPurchaseCardShopSlot(this.myUid, slotId);
    } else {
      this.sendEvent({ type: 'CARD_SHOP_BUY', uid: this.myUid, slotId });
    }
  }

  async usePanicDice() {
    if (this.isHost) this.handlePanicDiceUse(this.myUid);
    else this.sendEvent({ type: 'USE_PANIC_DICE', uid: this.myUid });
  }

  async proceedToNextRound() {
    if (this.isHost) {
      this.handleProceedNext(this.myUid);
    } else {
      this.sendEvent({ type: 'PROCEED_NEXT', uid: this.myUid });
    }
  }

  async spinDesperation() {
    // Offset is random start/end position for the wheel
    const offset = Math.random();
    if (this.isHost) {
      this.processSpinDesperation(this.myUid, offset);
    } else {
      this.sendEvent({ type: 'SPIN_DESPERATION', uid: this.myUid, offset });
    }
  }

  async resolveDesperation() {
    if (this.isHost) {
      this.handleResolveDesperation(this.myUid);
    } else {
      this.sendEvent({ type: 'RESOLVE_DESPERATION', uid: this.myUid });
    }
  }

  async selectDraftPowerCard(powerCardId: number) {
    if (this.isHost) {
      this.handleSelectDraft(this.myUid, powerCardId, this.state?.draftTurn || 0);
    } else {
      this.sendEvent({ type: 'SELECT_DRAFT', uid: this.myUid, powerCardId });
    }
  }

  async selectPowerCard(powerCardId: number | null) {
    if (this.isHost) {
      this.handlePlayPowerCard(this.myUid, powerCardId);
    } else {
      const me = this.state?.players?.[this.myUid];
      if (
        this.state &&
        me &&
        (powerCardId === null || me.powerCards.includes(powerCardId))
      ) {
        this.state = {
          ...this.state,
          players: {
            ...this.state.players,
            [this.myUid]: {
              ...me,
              currentPowerCard: powerCardId,
            },
          },
          updatedAt: Date.now(),
        };
        this.onStateChange?.(this.state);
      }
      this.sendEvent({ type: 'PLAY_POWER_CARD', uid: this.myUid, powerCardId });
    }
  }

  async cheatPowerCard(powerCardId: number) {
    if (this.isHost) {
      this.handleCheatPower(this.myUid, powerCardId);
    } else {
      this.sendEvent({ type: 'CHEAT_POWER', uid: this.myUid, powerCardId });
    }
  }

  async cheatTrimDeck(removeCount: number) {
    if (this.isHost) {
      this.handleCheatTrimDeck(removeCount);
    } else {
      this.sendEvent({ type: 'CHEAT_TRIM_DECK', uid: this.myUid, removeCount });
    }
  }

  async cheatDiscardFromHand(cardId: string) {
    if (this.isHost) {
      this.handleCheatDiscardHandCard(this.myUid, cardId);
    } else {
      this.sendEvent({ type: 'CHEAT_DISCARD_HAND_CARD', uid: this.myUid, cardId });
    }
  }

  async cheatActivateCurseOnTable(curseId: number) {
    if (!isCurseCardId(curseId)) return;
    if (this.isHost) {
      this.handleCheatActivateCurse(curseId);
    } else {
      this.sendEvent({ type: 'CHEAT_ACTIVATE_CURSE', uid: this.myUid, curseId });
    }
  }

  async cheatClearActiveCursesOnTable() {
    if (this.isHost) {
      this.handleCheatClearActiveCurses();
    } else {
      this.sendEvent({ type: 'CHEAT_CLEAR_ACTIVE_CURSES', uid: this.myUid });
    }
  }

  /** Dev: initial `ActiveCurseState` entries mirroring legal post-resolution state. */
  private freshCheatedActiveCurseLayer(curseId: number): ActiveCurseState {
    return createFreshCurseState(curseId);
  }

  private handleCheatActivateCurse(curseId: number) {
    if (!this.state?.players || !this.isHost || !isCurseCardId(curseId)) return;
    if (this.state.settings.enableCurseCards === false) return;
    const okStatuses: RoomData['status'][] = ['playing', 'powering', 'results'];
    if (!okStatuses.includes(this.state.status)) return;

    const layer = this.freshCheatedActiveCurseLayer(curseId);
    let nextActive = [...(this.state.activeCurses ?? [])];
    const envyTableCheat = curseId === CURSE_ENVY || curseId === CURSE_GREEN_EYED_MONSTER;
    if (envyTableCheat) {
      nextActive = nextActive.filter((c) => c.id !== CURSE_ENVY);
      nextActive.push(layer);
    } else {
      const ix = nextActive.findIndex((c) => c.id === curseId);
      if (ix >= 0) nextActive[ix] = layer;
      else nextActive.push(layer);
    }

    let deck = [...this.state.deck];
    let greedInjected = this.state.greedInjectedCoins;
    if (curseId === CURSE_GREED && (!greedInjected || greedInjected.length === 0)) {
      const coinCards = VALUES.map((v) => `Coins-${v}`);
      greedInjected = coinCards;
      deck.push(...coinCards);
      deck = shuffle(deck);
    }

    let prideCeilingCard = this.state.prideCeilingCard ?? null;
    if (curseId === CURSE_PRIDE) {
      const ts = this.state.targetSuit ?? SUITS[Math.floor(Math.random() * SUITS.length)];
      prideCeilingCard = `${ts}-${VALUES[Math.floor(Math.random() * VALUES.length)]}`;
    }

    const uids = Object.keys(this.state.players);
    let wrathTargetUid = this.state.wrathTargetUid ?? null;
    let wrathMinionCard = this.state.wrathMinionCard ?? null;
    if (curseId === CURSE_WRATH && uids.length >= 2) {
      wrathTargetUid = uids[Math.floor(Math.random() * uids.length)];
      wrathMinionCard = wrathMinionCardForRound(1);
    }

    let availableSuits = [...(this.state.availableSuits ?? SUITS)];
    let slothSavedAvailableSuits = this.state.slothSavedAvailableSuits ?? null;
    if (curseId === CURSE_SLOTH) {
      if (!slothCurseActive(this.state.activeCurses ?? []) && availableSuits.length > 0) {
        slothSavedAvailableSuits = [...availableSuits];
      }
      availableSuits = ['Stars', 'Moons'];
    }

    let nextEnvyCovet: RoomData['envyCovet'] = null;
    if (envyCurseActive(nextActive)) {
      const cheatUids = Object.keys(this.state.players);
      const p1Uid = this.myUid;
      const p2Uid = cheatUids.find((id) => id !== p1Uid);
      if (p2Uid) {
        const tableSuit: Suit = this.state.targetSuit ?? 'Stars';
        const lustHeartRules = lustCurseActive(nextActive);
        const greedTaxActive = greedCurseActive(nextActive);
        const joint = greedTaxActive && tableSuit === 'Diamonds';
        nextEnvyCovet = pickEnvyCovetedForRound(
          this.state.players,
          p1Uid,
          p2Uid,
          tableSuit,
          this.state.envySealedCards,
          lustHeartRules,
          greedTaxActive,
          joint,
        );
      }
    }

    this.state = {
      ...this.state,
      activeCurses: nextActive,
      deck,
      greedInjectedCoins: greedInjected,
      prideCeilingCard,
      wrathTargetUid,
      wrathMinionCard,
      availableSuits,
      slothSavedAvailableSuits,
      envyCovet: nextEnvyCovet,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  private handleCheatClearActiveCurses() {
    if (!this.state?.players || !this.isHost) return;
    const okStatuses: RoomData['status'][] = ['playing', 'powering', 'results'];
    if (!okStatuses.includes(this.state.status)) return;
    const hadSloth = slothCurseActive(this.state.activeCurses ?? []);

    let availableSuits =
      hadSloth && this.state.slothSavedAvailableSuits?.length
        ? [...this.state.slothSavedAvailableSuits]
        : [...(this.state.availableSuits ?? SUITS)];

    let deck = [...this.state.deck];
    const greedy = new Set(this.state.greedInjectedCoins ?? []);
    if (greedy.size > 0) {
      deck = deck.filter((c) => !greedy.has(c));
    }

    this.state = {
      ...this.state,
      activeCurses: [],
      prideCeilingCard: null,
      wrathTargetUid: null,
      wrathMinionCard: null,
      greedInjectedCoins: undefined,
      envyCovet: null,
      envySealedCards: {},
      envyBothGrovelTrap: false,
      slothSavedAvailableSuits: null,
      availableSuits,
      deck,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  async submitPowerDecision(option: string, wheelOffset?: number, priestessSwapToCard?: string | null) {
    if (this.isHost) {
      this.handleSubmitPowerDecision(this.myUid, option, wheelOffset, priestessSwapToCard);
    } else {
      const state = this.state;
      const pending = state?.pendingPowerDecisions?.[this.myUid];
      if (
        state &&
        state.status === 'powering' &&
        pending &&
        pending.selectedOption === null &&
        (pending.options.includes(option) || option === 'SPIN_WHEEL') &&
        !pending.disabledReasons?.[option]
      ) {
        const nextPendingAll = { ...(state.pendingPowerDecisions ?? {}) };
        const nextPendingSelf: PendingPowerDecision = { ...pending, selectedOption: option };
        if (nextPendingSelf.powerCardId === 10) {
          const resolvedOffset = typeof wheelOffset === 'number' ? wheelOffset : Math.random();
          nextPendingSelf.wheelOffset = resolvedOffset;
          nextPendingSelf.wheelResult = this.getWheelOutcome(resolvedOffset);
        }
        if (nextPendingSelf.powerCardId === 2) {
          nextPendingSelf.priestessSwapToCard =
            typeof priestessSwapToCard === 'string' && priestessSwapToCard.trim() !== ''
              ? priestessSwapToCard
              : null;
        }
        nextPendingAll[this.myUid] = nextPendingSelf;
        this.state = {
          ...state,
          pendingPowerDecisions: nextPendingAll,
          updatedAt: Date.now(),
        };
        this.onStateChange?.(this.state);
      }
      this.sendEvent({ type: 'SUBMIT_POWER_DECISION', uid: this.myUid, option, wheelOffset, priestessSwapToCard });
    }
  }

  private static normalizeChatBody(raw: string): string {
    return raw.replace(/\s+/g, ' ').trim().slice(0, 280);
  }

  private handleChatMessage(uid: string, text: string) {
    if (!this.state || !this.state.players[uid]) return;
    const body = GameService.normalizeChatBody(text);
    if (!body) return;
    const name = this.state.players[uid].name;
    const entry: ChatMessageEntry = { uid, name, text: body, at: Date.now() };
    const prev = this.state.chatMessages ?? [];
    this.state = {
      ...this.state,
      chatMessages: [...prev, entry].slice(-40),
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  async sendChat(rawText: string) {
    const text = GameService.normalizeChatBody(rawText);
    if (!text) return;
    if (this.isHost) {
      this.handleChatMessage(this.myUid, text);
    } else {
      /** Optimistic echo: guest sees their line immediately; next STATE_UPDATE replaces full history. */
      if (this.state?.players[this.myUid]) {
        const name = this.state.players[this.myUid].name;
        const entry: ChatMessageEntry = { uid: this.myUid, name, text, at: Date.now() };
        const prev = this.state.chatMessages ?? [];
        this.state = {
          ...this.state,
          chatMessages: [...prev, entry].slice(-40),
          updatedAt: Date.now(),
        };
        this.onStateChange?.(this.state);
      }
      this.sendEvent({ type: 'SEND_CHAT', uid: this.myUid, text });
    }
  }

  /**
   * Mitigate Chrome tab throttling / missed P2P deliveries: host rebroadcasts; guest asks host for a snapshot.
   * Called from visibility + online handlers while a match is active.
   */
  notifySessionResync(_reason?: string) {
    void _reason;
    if (!this.state) return;
    const conn = this.connection as (DataConnection & { open?: boolean }) | null;
    if (!conn?.open) return;

    const now = Date.now();
    if (this.isHost) {
      if (now - this.lastHostSessionResyncAt < 900) return;
      this.lastHostSessionResyncAt = now;
      this.broadcastState();
      return;
    }
    if (now - this.lastGuestSessionResyncRequestAt < 500) return;
    this.lastGuestSessionResyncRequestAt = now;
    this.sendEvent({ type: 'REQUEST_STATE_SYNC', uid: this.myUid });
  }

  private handleSelectDraft(uid: string, powerCardId: number, expectedTurn: number) {
    if (!this.state || this.state.status !== 'drafting') return;
    if (this.state.draftTurn !== expectedTurn) return;
    
    const player = this.state.players[uid];
    const currentSet = this.state.draftSets[this.state.draftTurn || 0] || [];
    if (!currentSet.includes(powerCardId)) return;
    if (player.powerCards.length > (this.state.draftTurn || 0)) return; // Already selected for this turn

    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...player,
      powerCards: [...player.powerCards, powerCardId]
    };

    const allSelected = Object.values(updatedPlayers).every(p => p.powerCards.length > this.state.draftTurn!);
    
    if (allSelected) {
      if (this.state.draftTurn === 2) {
        this.state = {
          ...this.state,
          players: updatedPlayers,
          status: 'playing',
          updatedAt: Date.now()
        };
      } else {
        this.state = {
          ...this.state,
          players: updatedPlayers,
          draftTurn: (this.state.draftTurn || 0) + 1,
          updatedAt: Date.now()
        };
      }
    } else {
      this.state = {
        ...this.state,
        players: updatedPlayers,
        updatedAt: Date.now()
      };
    }
    this.broadcastState();
  }

  private handlePlayPowerCard(uid: string, powerCardId: number | null) {
    if (!this.state || !this.state.players[uid]) return;
    if (
      powerCardId !== null &&
      isCurseCardId(powerCardId) &&
      this.state.settings.enableCurseCards === false
    ) {
      return;
    }
    if (
      powerCardId !== null &&
      isCurseCardId(powerCardId) &&
      curseEffectActive(this.state.activeCurses)
    ) {
      return;
    }
    if (powerCardId !== null && !this.state.players[uid].powerCards.includes(powerCardId)) return;
    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...updatedPlayers[uid],
      currentPowerCard: powerCardId
    };
    this.state = {
      ...this.state,
      players: updatedPlayers,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  private handleCheatPower(uid: string, powerCardId: number) {
    if (!this.state || !this.state.players[uid]) return;
    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...updatedPlayers[uid],
      currentPowerCard: powerCardId
    };
    this.state = {
      ...this.state,
      players: updatedPlayers,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  private handleCheatTrimDeck(removeCount: number) {
    if (!this.state || !this.isHost) return;
    const ok = ['playing', 'powering', 'results'].includes(this.state.status);
    if (!ok) return;
    const n = Math.max(0, Math.floor(removeCount));
    const deck = [...this.state.deck];
    const take = Math.min(n, deck.length);
    if (take === 0) return;
    deck.splice(0, take);
    const famineActive = deck.length === 0 ? true : Boolean(this.state.famineActive);
    this.state = {
      ...this.state,
      deck,
      famineActive,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  private handleCheatDiscardHandCard(uid: string, cardId: string) {
    if (!this.state || !this.isHost || !this.state.players[uid]) return;
    if (!['playing', 'powering', 'results'].includes(this.state.status)) return;
    const p = this.state.players[uid];
    const ix = p.hand.indexOf(cardId);
    if (ix < 0) return;
    const hand = [...p.hand];
    hand.splice(ix, 1);
    const updatedPlayers = {
      ...this.state.players,
      [uid]: { ...p, hand },
    };
    this.state = {
      ...this.state,
      players: updatedPlayers,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  // Exposed for optimistic UI updates on draft select
  public triggerDraftSelect(uid: string, powerCardId: number, turn: number) {
    this.handleSelectDraft(uid, powerCardId, turn);
  }

  private getWheelOutcome(offset: number): string {
    const slices = FORTUNE_GAME_SLICES;
    const total = slices.reduce((acc, s) => acc + s.weight, 0);
    const target = Math.max(0, Math.min(0.999999, offset)) * total;
    let running = 0;
    for (const slice of slices) {
      running += slice.weight;
      if (target <= running) return slice.label;
    }
    return 'LOSE_ROUND';
  }

  private createPendingPowerDecisions(
    players: Record<string, PlayerData>,
    draftAppearances: number[]
  ): Record<string, PendingPowerDecision | null> {
    const decisions: Record<string, PendingPowerDecision | null> = {};
    const uids = Object.keys(players);
    const p1 = uids[0];
    const p2 = uids[1];
    const p1Power = players[p1].currentPowerCard;
    const p2Power = players[p2].currentPowerCard;

    // Tower always resolves first and may prevent decisions.
    const blocked: Record<string, boolean> = { [p1]: false, [p2]: false };
    if (p1Power === 16 && p2Power === 16) {
      const p1WinsFlip = Math.random() > 0.5;
      blocked[p1WinsFlip ? p2 : p1] = true;
    } else if (p1Power === 16 && p2Power !== null) {
      blocked[p2] = true;
    } else if (p2Power === 16 && p1Power !== null) {
      blocked[p1] = true;
    }

    for (const uid of uids) {
      const oppUid = uids.find(id => id !== uid)!;
      const power = players[uid].currentPowerCard;
      if (blocked[uid] || power === null) {
        decisions[uid] = null;
        continue;
      }

      if (isCurseCardId(power)) {
        decisions[uid] = null;
        continue;
      }

      if (power === 1) {
        const opponentHasJoker = players[oppUid].hand.some(c => c.startsWith('Joker'));
        decisions[uid] = {
          powerCardId: 1,
          options: ['STEAL_JOKER', 'FROGIFY'],
          disabledReasons: {
            STEAL_JOKER: opponentHasJoker ? '' : 'Opponent has no Joker to steal.',
            FROGIFY: ''
          },
          selectedOption: null
        };
      } else if (power === 10) {
        decisions[uid] = {
          powerCardId: 10,
          options: ['SPIN_WHEEL'],
          selectedOption: null
        };
      } else if (power === 2) {
        const oppUsesPower = players[oppUid].currentPowerCard !== null;
        const realPowerId = players[oppUid].currentPowerCard;
        let priestessPowerCandidates: number[] | null = null;
        let priestessPeekStashPowerId: number | null | undefined = undefined;
        let priestessPeekStashEmpty = false;
        if (oppUsesPower && realPowerId !== null && isMajorArcanaId(realPowerId)) {
          const draftPool = [...new Set(draftAppearances)];
          const pool = [...new Set([...draftPool, realPowerId])];
          const others = pool.filter(id => id !== realPowerId);
          let d1: number;
          let d2: number;
          if (others.length >= 2) {
            const shuffled = shuffle([...others]);
            d1 = shuffled[0];
            d2 = shuffled[1];
          } else if (others.length === 1) {
            d1 = others[0];
            d2 = others[0];
          } else {
            d1 = realPowerId;
            d2 = realPowerId;
          }
          priestessPowerCandidates = shuffle([realPowerId, d1, d2]);
        } else {
          const stashPool = [...new Set(players[oppUid].powerCards)].filter(pid => pid !== players[oppUid].currentPowerCard);
          if (stashPool.length > 0) {
            priestessPeekStashPowerId = stashPool[Math.floor(Math.random() * stashPool.length)];
          } else {
            priestessPeekStashPowerId = null;
            priestessPeekStashEmpty = true;
          }
        }
        decisions[uid] = {
          powerCardId: 2,
          options: ['PRIESTESS_RESOLVE'],
          selectedOption: null,
          priestessOpponentUsesPower: oppUsesPower,
          priestessOpponentName: players[oppUid].name,
          priestessSwapToCard: null,
          priestessPowerCandidates,
          priestessPeekStashPowerId: priestessPeekStashPowerId ?? null,
          priestessPeekStashEmpty
        };
      } else if (power === 15) {
        decisions[uid] = {
          powerCardId: 15,
          options: ['DEVIL_KING', 'DEVIL_RANDOMIZE'],
          disabledReasons: {
            DEVIL_KING: '',
            DEVIL_RANDOMIZE: '',
          },
          selectedOption: null,
        };
      } else {
        decisions[uid] = null;
      }
    }

    return decisions;
  }

  private handleSubmitPowerDecision(uid: string, option: string, wheelOffset?: number, priestessSwapToCard?: string | null) {
    if (!this.state || this.state.status !== 'powering') return;
    const pending = { ...(this.state.pendingPowerDecisions || {}) };
    const current = pending[uid];
    if (!current || current.selectedOption !== null) return;
    if (!current.options.includes(option) && option !== 'SPIN_WHEEL') return;
    if (current.disabledReasons?.[option]) return;
    if (current.powerCardId === 2 && option !== 'PRIESTESS_RESOLVE') return;

    current.selectedOption = option;
    if (current.powerCardId === 2) {
      const player = this.state.players[uid];
      const locked = this.state.engageMoves?.[uid] ?? player.currentMove!;
      let swapAccepted: string | null = null;
      if (
        priestessSwapToCard &&
        priestessSwapToCard !== locked &&
        player.hand.includes(priestessSwapToCard)
      ) {
        swapAccepted = priestessSwapToCard;
        const curseOk = this.state.settings.enableCurseCards !== false;
        if (
          curseOk &&
          envyCurseActive(this.state.activeCurses ?? []) &&
          envyFreeCopiesInHand(player.hand, uid, swapAccepted, this.state.envySealedCards) <= 0
        ) {
          swapAccepted = null;
        }
      }
      current.priestessSwapToCard = swapAccepted;
    }
    if (current.powerCardId === 10) {
      const offset = typeof wheelOffset === 'number' ? wheelOffset : Math.random();
      current.wheelOffset = offset;
      current.wheelResult = this.getWheelOutcome(offset);
    }
    pending[uid] = current;

    const allResolved = Object.values(pending).every(d => !d || d.selectedOption !== null);
    if (!allResolved) {
      this.state = {
        ...this.state,
        pendingPowerDecisions: pending,
        updatedAt: Date.now()
      };
      this.broadcastState();
      return;
    }

    const hasWheel = Object.values(pending).some(d => d?.powerCardId === 10 && d.selectedOption === 'SPIN_WHEEL');
    this.state = {
      ...this.state,
      pendingPowerDecisions: pending,
      updatedAt: Date.now()
    };
    this.broadcastState();

    if (this.powerResolutionTimer) {
      clearTimeout(this.powerResolutionTimer);
      this.powerResolutionTimer = null;
    }

    const finalize = () => {
      if (!this.state || this.state.status !== 'powering') return;
      this.state = {
        ...this.state,
        status: 'results',
        lastOutcome: this.calculateOutcome(this.state, this.state.players),
        updatedAt: Date.now()
      };
      this.broadcastState();
      this.powerResolutionTimer = null;
    };

    if (hasWheel) {
      this.powerResolutionTimer = setTimeout(finalize, 2600);
    } else {
      finalize();
    }
  }

  private processSpinDesperation(uid: string, offset: number) {
    if (!this.state || !this.state.players[uid]) return;
    
    const player = this.state.players[uid];
    if (!desperationSpinAllowed(this.state, uid, player)) return;
    
    // Pick the result based on offset
    // Offset 0-1 matches 0-100% of the wheel
    const totalWeight = DESPERATION_SLICES.reduce((acc, s) => acc + s.weight, 0);
    let currentWeight = 0;
    let result = DESPERATION_SLICES[0].label;
    
    const targetWeight = offset * totalWeight;
    for (const slice of DESPERATION_SLICES) {
      currentWeight += slice.weight;
      if (targetWeight <= currentWeight) {
        result = slice.label;
        break;
      }
    }

    const updatedPlayers = { ...this.state.players };
    updatedPlayers[uid] = {
      ...player,
      desperationResult: result,
      desperationSpinning: true,
      desperationOffset: offset
    };

    this.state = {
      ...this.state,
      players: updatedPlayers,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  private handleResolveDesperation(uid: string) {
    if (!this.state || !this.state.players[uid]) return;
    
    const player = this.state.players[uid];
    if (!desperationSpinAllowed(this.state, uid, player)) return;
    const result = player.desperationResult;
    const updatedPlayers = { ...this.state.players };
    const newDeck = [...this.state.deck];
    let newWinner = this.state.winner;

    const advanceDesperationTier = (t: number) => (t < 0 ? 1 : t + 1);

    if (result === 'GAME OVER') {
      newWinner = Object.keys(this.state.players).find(id => id !== uid)!;
      updatedPlayers[uid] = {
        ...player,
        desperationTier: advanceDesperationTier(player.desperationTier),
        desperationSpinning: false
      };
    } else if (result?.startsWith('Gain')) {
      const numStr = result.split(' ')[1];
      const count = parseInt(numStr);
      const cards = newDeck.splice(0, count);
      updatedPlayers[uid] = {
        ...player,
        desperationTier: advanceDesperationTier(player.desperationTier),
        hand: [...player.hand, ...cards],
        desperationSpinning: false,
        desperationResult: null
      };
    } else {
      updatedPlayers[uid] = {
        ...player,
        desperationTier: advanceDesperationTier(player.desperationTier),
        desperationSpinning: false,
        // Keep desperationResult so it can be seen on Game Over screen
      };
    }

    this.state = {
      ...this.state,
      players: updatedPlayers,
      deck: newDeck,
      winner: newWinner,
      status: newWinner ? 'finished' : this.state.status,
      updatedAt: Date.now()
    };
    this.broadcastState();
  }

  private broadcastState() {
    if (this.state) {
      this.onStateChange?.(this.state);
      this.sendEvent({ type: 'STATE_UPDATE', state: this.state });
    }
  }

  private sendEvent(event: GameEvent) {
    if (this.connection && this.connection.open) {
      this.connection.send(event);
    }
  }

  /** HUD dice overlay (@3d-dice/dice-box-threejs pip dice + forced totals). */
  private broadcastHudDiceRoll(payload: DiceTestRollPayload) {
    this.onDiceTestRoll?.(payload);
    this.sendEvent({
      type: 'ROLL_DICE_TEST_BROADCAST',
      uid: payload.uid,
      rollId: payload.rollId,
      notation: payload.notation,
      dice: payload.dice,
      total: payload.total,
      startedAt: payload.startedAt,
      presentation: payload.presentation,
    });
  }

  private handlePanicDiceUse(uid: string) {
    if (!this.state || !this.isHost || this.state.status !== 'results' || !this.state.lastOutcome) return;

    const room = this.state;
    const me = room.players[uid];
    if (!me || me.panicDiceUsed || me.readyForNextRound) return;
    if (!room.settings.enablePanicDice || !panicDiceSeatAllowed(room, uid)) return;

    const oppUid = Object.keys(room.players).find((id) => id !== uid);
    if (!oppUid) return;

    const prev = room.lastOutcome;
    const oppCard = prev.cardsPlayed[oppUid];
    const hostUid = room.hostUid;
    const guestUid = Object.keys(room.players).find((id) => id !== hostUid)!;

    if (!oppCard || typeof oppCard !== 'string') return;

    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const total = d1 + d2;
    const panicCard = panicDiceTotalToCardId(total);
    const rollId = `panic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const greedTaxActive =
      room.settings.enableCurseCards !== false && greedCurseActive(room.activeCurses ?? []);

    const lustReplay = lustReplayContextFromOutcome(room, prev, hostUid, guestUid);

    let wrathPenOpp = 0;
    if (prev.wrathFx?.targetUid === oppUid && prev.wrathFx.minionCard) {
      const pc = parseCard(oppCard);
      if (!pc.isJoker && oppCard !== GROVEL_CARD_ID) {
        wrathPenOpp = getWrathMagnitude(prev.wrathFx.minionCard);
      }
    }

    const combat = computePanicCombatEffects({
      panicCardId: panicCard,
      opponentCardId: oppCard,
      opponentWrathPenalty: wrathPenOpp,
      greedTaxActive,
      opponentLustBump: lustReplay.lhPlayed(oppCard),
    });

    const extras: Record<string, number> = { [hostUid]: 0, [guestUid]: 0 };
    extras[oppUid] = combat.extraOpponentPenalty;

    /** Keep both players’ committed suit cards — panic only applies clash penalty to the opponent of the roller. */
    const panicFrozenCardsPlayed = { ...prev.cardsPlayed };

    const nw = resolveFrozenTrickWinnerForPanic({
      roomData: room,
      hostUid,
      guestUid,
      frozen: {
        cardsPlayed: panicFrozenCardsPlayed,
        summonedCards: prev.summonedCards,
        targetSuit: prev.targetSuit,
        wrathFx: prev.wrathFx,
      },
      extraClashPenaltyByUid: extras,
      lustReplay,
    });

    const tableauDisplay = panicClashDisplayedCardPair({
      panicCardId: panicCard,
      opponentCardId: oppCard,
      opponentWrathPenalty: wrathPenOpp,
      greedTaxActive,
      opponentLustBump: lustReplay.lhPlayed(oppCard),
    });
    const nextCardsPlayedVisual = {
      ...prev.cardsPlayed,
      [oppUid]: tableauDisplay.opponentDisplayed,
    };

    const clashDestroyed: Record<string, boolean> = { ...(prev.clashDestroyedByPenalty ?? {}) };
    if (!parseCard(oppCard).isJoker && oppCard !== GROVEL_CARD_ID) {
      clashDestroyed[oppUid] = combat.opponentDestroyed;
    }

    let finalMessage: string;
    if (nw === 'draw') {
      finalMessage = 'Panic dice — the field deadlocks again.';
    } else {
      const winnerCard = panicFrozenCardsPlayed[nw];
      const loserUid = nw === hostUid ? guestUid : hostUid;
      const loserCard = panicFrozenCardsPlayed[loserUid];
      const wrathTar = prev.wrathFx?.targetUid ?? null;
      const wrathMag =
        wrathTar && prev.wrathFx?.minionCard ? getWrathMagnitude(prev.wrathFx.minionCard) : 0;
      const clashPenFor = (cardUid: string, card: string) => {
        let pen =
          wrathTar === cardUid && wrathMag && !parseCard(card).isJoker && card !== GROVEL_CARD_ID
            ? wrathMag
            : 0;
        pen += extras[cardUid] ?? 0;
        return pen;
      };
      finalMessage = `${room.players[nw].name} wins — ${explainPlainClash(
        winnerCard,
        loserCard,
        prev.targetSuit,
        lustReplay.lustHeartRules,
        greedTaxActive,
        greedTaxActive && prev.targetSuit === 'Diamonds',
        [lustReplay.lhPlayed(winnerCard), lustReplay.lhPlayed(loserCard)],
        [clashPenFor(nw, winnerCard), clashPenFor(loserUid, loserCard)],
      )}`;
    }
    const clashPenByUid: Record<string, number> = {
      [hostUid]:
        (prev.wrathFx?.targetUid === hostUid && prev.wrathFx?.minionCard
          ? getWrathMagnitude(prev.wrathFx.minionCard)
          : 0) + (extras[hostUid] ?? 0),
      [guestUid]:
        (prev.wrathFx?.targetUid === guestUid && prev.wrathFx?.minionCard
          ? getWrathMagnitude(prev.wrathFx.minionCard)
          : 0) + (extras[guestUid] ?? 0),
    };
    const tokenByUid = computeOverkillTokenAward({
      p1Uid: hostUid,
      p2Uid: guestUid,
      c1: panicFrozenCardsPlayed[hostUid],
      c2: panicFrozenCardsPlayed[guestUid],
      targetSuit: prev.targetSuit,
      greedJointTrump: greedTaxActive && prev.targetSuit === 'Diamonds',
      greedTaxActive,
      clashPenaltyByUid: clashPenByUid,
      lustPlayedByUid: {
        [hostUid]: lustReplay.lhPlayed(panicFrozenCardsPlayed[hostUid]),
        [guestUid]: lustReplay.lhPlayed(panicFrozenCardsPlayed[guestUid]),
      },
    });

    // Panic re-resolution must not carry stale rewards from the pre-panic snapshot.
    const gains: NonNullable<RoomData['lastOutcome']>['gains'] = { [hostUid]: [], [guestUid]: [] };
    if (nw !== 'draw' && nw) {
      const loserUid = nw === hostUid ? guestUid : hostUid;
      if (room.famineActive) gains[loserUid].push({ type: 'draw', id: -1 });
      else gains[nw].push({ type: 'draw', id: 'standard' });
    }
    for (const uid of [hostUid, guestUid]) {
      const n = tokenByUid[uid] ?? 0;
      if (n > 0) gains[uid].push({ type: 'token', id: n });
    }

    if (nw !== 'draw') {
      const tn = tokenByUid[nw] ?? 0;
      if (tn > 0) finalMessage += ` (+${tn} token${tn === 1 ? '' : 's'})`;
    }

    const panicLine: ResolutionEvent = {
      type: 'POWER_TRIGGER',
      message: `${room.players[uid].name} rolls panic dice (${d1}+${d2}=${total}) — ${compactCardLabel(panicCard)} clashes with ${room.players[oppUid].name}'s play (${combat.exchanges} exchanges).`,
    };

    const nextOutcome: NonNullable<RoomData['lastOutcome']> = {
      ...prev,
      winnerUid: nw,
      message: finalMessage,
      gains,
      cardsPlayed: nextCardsPlayedVisual,
      clashDestroyedByPenalty: clashDestroyed,
      events: [...prev.events, panicLine],
      panicFx: {
        attackerUid: uid,
        opponentUid: oppUid,
        panicCardId: panicCard,
        dice: [d1, d2],
        diceRollId: rollId,
        exchanges: combat.exchanges,
        panicDestroyed: combat.panicDestroyed,
        opponentDestroyed: combat.opponentDestroyed,
        extraOpponentPenalty: combat.extraOpponentPenalty,
      },
    };

    const updatedPlayers = { ...room.players };
    for (const u of [hostUid, guestUid]) {
      const p = updatedPlayers[u];
      updatedPlayers[u] = {
        ...p,
        readyForNextRound: false,
        panicDiceUsed: u === uid ? true : p.panicDiceUsed,
      };
    }

    this.broadcastHudDiceRoll({
      uid,
      rollId,
      notation: '2dpip',
      dice: [d1, d2],
      total,
      startedAt: Date.now(),
    });

    this.state = {
      ...room,
      players: updatedPlayers,
      lastOutcome: nextOutcome,
      updatedAt: Date.now(),
    };
    this.broadcastState();
  }

  private calculateOutcome(roomData: RoomData, players: Record<string, PlayerData>) {
    const uids = Object.keys(players);
    const p1Uid = this.myUid;
    const p2Uid = uids.find(id => id !== p1Uid)!;

    let targetSuit = roomData.targetSuit!;
    const engageLocks =
      roomData.engageMoves && roomData.engageMoves[p1Uid] && roomData.engageMoves[p2Uid]
        ? { ...roomData.engageMoves }
        : ({ [p1Uid]: players[p1Uid].currentMove!, [p2Uid]: players[p2Uid].currentMove! } as Record<string, string>);
    const initialCardsPlayed = { ...engageLocks };
    let c1 = players[p1Uid].currentMove!;
    let c2 = players[p2Uid].currentMove!;
    const committedPower1 = players[p1Uid].currentPowerCard;
    const committedPower2 = players[p2Uid].currentPowerCard;
    let power1 = committedPower1;
    let power2 = committedPower2;
    const pendingDecisions = roomData.pendingPowerDecisions || {};
    const p1Decision = pendingDecisions[p1Uid];
    const p2Decision = pendingDecisions[p2Uid];
    
    let winnerUid: string | 'draw' = 'draw';
    let clashDestroyedForOutcome: Record<string, boolean> = { [p1Uid]: false, [p2Uid]: false };
    let coinFlip: string | undefined = undefined;
    const events: ResolutionEvent[] = [];
    const summonedCards: Record<string, string> = {};

    const gains: Record<string, { type: 'card' | 'power' | 'draw' | 'token', id: string | number }[]> = {
      [p1Uid]: [],
      [p2Uid]: []
    };
    let envyRoundFx: NonNullable<RoomData['lastOutcome']>['envyRoundFx'] = undefined;
    const blockedPowers: Record<string, boolean> = { [p1Uid]: false, [p2Uid]: false };

    // Phase 1: Pre-activation
    if ((power1 === 16 && power2 === 16) || ((power1 === 15 || power1 === 16) && (power2 === 15 || power2 === 16))) {
      const pip = rollFairD6();
      const p1WinsFlip = fairHalfFromD6(pip);
      coinFlip = p1WinsFlip ? 'Host' : 'Opponent';
      events.push({
        type: 'COIN_FLIP',
        message: `${coinFlip === 'Host' ? players[p1Uid].name : players[p2Uid].name} wins priority flip!`,
        coinFlipSides: { headsUid: p1Uid, tailsUid: p2Uid },
        resolutionDice: [p1WinsFlip ? 1 : 0],
      });
    }

    const resolvePowerPre = (pUid: string, oUid: string, p: number | null, oPower: number | null) => {
      if (p === 16) {
        // Tower blocks opponent majors and curse cards alike.
        if (oPower !== null && oPower !== 16) {
          const destroyedName = isCurseCardId(oPower)
            ? (CURSES[oPower]?.name ?? 'Curse')
            : (MAJOR_ARCANA[oPower]?.name ?? `Power ${oPower}`);
          events.push({
            type: 'POWER_TRIGGER',
            uid: pUid,
            powerCardId: 16,
            message: `${players[pUid].name}'s Tower blocks ${players[oUid].name}'s committed card.`,
          });
          events.push({
            type: 'POWER_DESTROYED',
            uid: oUid,
            powerCardId: isMajorArcanaId(oPower) ? oPower : undefined,
            message: `${players[oUid].name}'s ${destroyedName} is destroyed.`,
          });
          blockedPowers[oUid] = true;
          if (pUid === p1Uid) power2 = null;
          else power1 = null;
        }
      }
    };

    if (coinFlip === 'Opponent') {
      resolvePowerPre(p2Uid, p1Uid, power2, power1);
      resolvePowerPre(p1Uid, p2Uid, power1, power2);
    } else {
      resolvePowerPre(p1Uid, p2Uid, power1, power2);
      resolvePowerPre(p2Uid, p1Uid, power2, power1);
    }
    if (power1 === 16 && power2 === 16) {
      if (coinFlip === 'Host') blockedPowers[p2Uid] = true;
      else blockedPowers[p1Uid] = true;
    }

    const curseClashSuppressed: Record<string, boolean> = { [p1Uid]: false, [p2Uid]: false };
    const curseEnabled = roomData.settings.enableCurseCards !== false;
    if (
      curseEnabled &&
      committedPower1 !== null &&
      committedPower2 !== null &&
      isCurseCardId(committedPower1) &&
      isCurseCardId(committedPower2) &&
      !blockedPowers[p1Uid] &&
      !blockedPowers[p2Uid]
    ) {
      const pip = rollFairD6();
      const p1WinsClash = fairHalfFromD6(pip);
      const winnerUid = p1WinsClash ? p1Uid : p2Uid;
      const loserUid = p1WinsClash ? p2Uid : p1Uid;
      curseClashSuppressed[loserUid] = true;
      events.push({
        type: 'COIN_FLIP',
        message: `${players[winnerUid].name} wins the curse clash — their curse takes hold; ${players[loserUid].name}'s curse is spent.`,
        coinFlipSides: { headsUid: p1Uid, tailsUid: p2Uid },
        resolutionDice: [p1WinsClash ? 1 : 0],
      });
      events.push({
        type: 'POWER_TRIGGER',
        uid: loserUid,
        message: `${players[loserUid].name}'s curse was overwhelmed and dissipates.`,
      });
    }

    const lustHeartRules =
      curseEnabled &&
      (lustCurseActive(roomData.activeCurses ?? []) ||
        (committedPower1 === CURSE_LUST && !blockedPowers[p1Uid] && !curseClashSuppressed[p1Uid]) ||
        (committedPower2 === CURSE_LUST && !blockedPowers[p2Uid] && !curseClashSuppressed[p2Uid]));

    const greedWasActive = curseEnabled && greedCurseActive(roomData.activeCurses ?? []);
    const greedTaxActive = greedWasActive;

    if (curseEnabled && committedPower1 === CURSE_LUST && !blockedPowers[p1Uid] && !curseClashSuppressed[p1Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p1Uid,
        message: `${players[p1Uid].name} invokes the curse of Lust.`,
      });
    }
    if (curseEnabled && committedPower2 === CURSE_LUST && !blockedPowers[p2Uid] && !curseClashSuppressed[p2Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p2Uid,
        message: `${players[p2Uid].name} invokes the curse of Lust.`,
      });
    }
    if (curseEnabled && committedPower1 === CURSE_GLUTTONY && !blockedPowers[p1Uid] && !curseClashSuppressed[p1Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p1Uid,
        message: `${players[p1Uid].name} invokes the curse of Gluttony.`,
      });
    }
    if (curseEnabled && committedPower2 === CURSE_GLUTTONY && !blockedPowers[p2Uid] && !curseClashSuppressed[p2Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p2Uid,
        message: `${players[p2Uid].name} invokes the curse of Gluttony.`,
      });
    }
    if (curseEnabled && committedPower1 === CURSE_GREED && !blockedPowers[p1Uid] && !curseClashSuppressed[p1Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p1Uid,
        message: `${players[p1Uid].name} invokes the curse of Greed.`,
      });
    }
    if (curseEnabled && committedPower2 === CURSE_GREED && !blockedPowers[p2Uid] && !curseClashSuppressed[p2Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p2Uid,
        message: `${players[p2Uid].name} invokes the curse of Greed.`,
      });
    }
    if (curseEnabled && committedPower1 === CURSE_PRIDE && !blockedPowers[p1Uid] && !curseClashSuppressed[p1Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p1Uid,
        message: `${players[p1Uid].name} invokes the curse of Pride.`,
      });
    }
    if (curseEnabled && committedPower2 === CURSE_PRIDE && !blockedPowers[p2Uid] && !curseClashSuppressed[p2Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p2Uid,
        message: `${players[p2Uid].name} invokes the curse of Pride.`,
      });
    }
    if (curseEnabled && committedPower1 === CURSE_WRATH && !blockedPowers[p1Uid] && !curseClashSuppressed[p1Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p1Uid,
        message: `${players[p1Uid].name} invokes the curse of Wrath.`,
      });
    }
    if (curseEnabled && committedPower2 === CURSE_WRATH && !blockedPowers[p2Uid] && !curseClashSuppressed[p2Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p2Uid,
        message: `${players[p2Uid].name} invokes the curse of Wrath.`,
      });
    }
    if (
      curseEnabled &&
      cursePlayedActivatesEnvyTable(committedPower1) &&
      !blockedPowers[p1Uid] &&
      !curseClashSuppressed[p1Uid]
    ) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p1Uid,
        message:
          committedPower1 === CURSE_GREEN_EYED_MONSTER
            ? `${players[p1Uid].name} unleashes the Green-Eyed Monster.`
            : `${players[p1Uid].name} invokes the curse of Envy.`,
      });
    }
    if (
      curseEnabled &&
      cursePlayedActivatesEnvyTable(committedPower2) &&
      !blockedPowers[p2Uid] &&
      !curseClashSuppressed[p2Uid]
    ) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p2Uid,
        message:
          committedPower2 === CURSE_GREEN_EYED_MONSTER
            ? `${players[p2Uid].name} unleashes the Green-Eyed Monster.`
            : `${players[p2Uid].name} invokes the curse of Envy.`,
      });
    }
    if (curseEnabled && committedPower1 === CURSE_SLOTH && !blockedPowers[p1Uid] && !curseClashSuppressed[p1Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p1Uid,
        message: `${players[p1Uid].name} invokes the curse of Sloth.`,
      });
    }
    if (curseEnabled && committedPower2 === CURSE_SLOTH && !blockedPowers[p2Uid] && !curseClashSuppressed[p2Uid]) {
      events.push({
        type: 'POWER_TRIGGER',
        uid: p2Uid,
        message: `${players[p2Uid].name} invokes the curse of Sloth.`,
      });
    }

    const envyActiveThisResolution = curseEnabled && envyCurseActive(roomData.activeCurses ?? []);
    let envySealDeltaEarly: Record<string, string[]> = {};
    const envyCovetEventsEarly: ResolutionEvent[] = [];

    if (envyActiveThisResolution && roomData.envyCovet) {
      const ec = roomData.envyCovet;
      const locked = engageLocks[ec.uid];
      const playedCoveted = locked === ec.cardId;
      const absorbedEarly = playedCoveted
        ? getCardValue(ec.cardId, lustHeartRules, greedTaxActive)
        : 0;
      if (playedCoveted) {
        envyCovetEventsEarly.push({
          type: 'ENVY_COVET',
          uid: ec.uid,
          cardId: ec.cardId,
          envyDamage: absorbedEarly,
          message: `The Green-Eyed Monster coveted ${absorbedEarly} from ${players[ec.uid].name}'s ${sentenceCard(ec.cardId)}!`,
        });
      } else if (players[ec.uid].hand.includes(ec.cardId)) {
        envyCovetEventsEarly.push({
          type: 'ENVY_COVET',
          uid: ec.uid,
          cardId: ec.cardId,
          message: `The Green-Eyed Monster seethes — ${players[ec.uid].name} withheld ${sentenceCard(ec.cardId)}. Envy seals it.`,
        });
        envySealDeltaEarly = { [ec.uid]: [ec.cardId] };
      } else {
        envyCovetEventsEarly.push({
          type: 'ENVY_COVET',
          message: `The Green-Eyed Monster roars — ${sentenceCard(ec.cardId)} cannot be grasped.`,
        });
      }
    } else if (envyActiveThisResolution) {
      envyCovetEventsEarly.push({
        type: 'ENVY_COVET',
        message:
          'The Green-Eyed Monster finds no card to covet — only sealed slots, Grovels, or Jokers remain in the open hands.',
      });
    }

    const priestessFront: ResolutionEvent[] = [];
    const applyPriestessConsult = (
      uid: string,
      decision: PendingPowerDecision | null | undefined,
      isP1: boolean
    ) => {
      const playedPowerId = players[uid].currentPowerCard;
      if (playedPowerId !== 2 || blockedPowers[uid]) return;

      const locked = engageLocks[uid];
      const rawSwap =
        typeof decision?.priestessSwapToCard === 'string' && decision.priestessSwapToCard.trim() !== ''
          ? decision!.priestessSwapToCard
          : null;
      let finalCard = locked;
      if (
        rawSwap &&
        rawSwap !== locked &&
        players[uid].hand.includes(rawSwap)
      ) {
        finalCard = rawSwap;
      }
      if (
        curseEnabled &&
        prideCurseActive(roomData.activeCurses) &&
        roomData.prideCeilingCard &&
        isCardBlockedByPride(finalCard, roomData.prideCeilingCard, lustHeartRules, greedTaxActive)
      ) {
        finalCard = locked;
      }
      if (
        curseEnabled &&
        envyCurseActive(roomData.activeCurses) &&
        rawSwap &&
        rawSwap !== locked &&
        envyFreeCopiesInHand(players[uid].hand, uid, rawSwap, roomData.envySealedCards) <= 0
      ) {
        finalCard = locked;
      }
      const oppName = decision?.priestessOpponentName || 'Opponent';
      const oppUsed = Boolean(decision?.priestessOpponentUsesPower);

      if (!oppUsed) {
        if (decision?.priestessPeekStashEmpty) {
          priestessFront.push({
            type: 'POWER_TRIGGER',
            uid,
            powerCardId: 2,
            message: `${players[uid].name} (High Priestess): ${oppName} played no power card and has no spare power cards to reveal.`
          });
        } else if (typeof decision?.priestessPeekStashPowerId === 'number') {
          const peek = MAJOR_ARCANA[decision.priestessPeekStashPowerId];
          priestessFront.push({
            type: 'POWER_TRIGGER',
            uid,
            powerCardId: 2,
            message: `${players[uid].name} (High Priestess): glimpsed ${peek.name} among ${oppName}'s spare power cards.`
          });
        }
        return;
      }

      priestessFront.push({
        type: 'POWER_TRIGGER',
        uid,
        powerCardId: 2,
        message: `${players[uid].name} (High Priestess): ${oppName} played a power card${
          decision?.priestessPowerCandidates?.length === 3
            ? ' — three draft candidates are shown.'
            : '.'
        }`
      });
      if (finalCard !== locked) {
        priestessFront.push({
          type: 'CARD_SWAP',
          uid,
          cardId: finalCard,
          message: `${players[uid].name} swaps their played suit card before the flop.`
        });
      } else {
        priestessFront.push({
          type: 'POWER_TRIGGER',
          uid,
          powerCardId: 2,
          message: `${players[uid].name} keeps ${locked.replace('-', ' of ')} in play.`
        });
      }

      if (isP1) c1 = finalCard;
      else c2 = finalCard;
    };

    applyPriestessConsult(p1Uid, p1Decision, true);
    applyPriestessConsult(p2Uid, p2Decision, false);
    events.splice(0, 0, ...envyCovetEventsEarly, ...priestessFront);

    // Magician steal runs early; Fool / field powers run before Frogify so swaps apply first.
    const applyMagicianSteal = (uid: string, oppUid: string, decision?: PendingPowerDecision | null) => {
      if (!decision || decision.powerCardId !== 1 || blockedPowers[uid]) return;
      if (decision.selectedOption === 'STEAL_JOKER') {
        const oHand = players[oppUid].hand;
        const jokerStr = oHand.find(c => c.startsWith('Joker'));
        if (jokerStr) {
          events.push({ type: 'POWER_TRIGGER', uid, powerCardId: 1, message: `${players[uid].name} casts Magician and steals a Joker!` });
          gains[uid].push({ type: 'card', id: jokerStr });
        }
      }
    };

    const applyMagicianFrog = (uid: string, oppUid: string, decision?: PendingPowerDecision | null) => {
      if (!decision || decision.powerCardId !== 1 || blockedPowers[uid]) return;
      if (decision.selectedOption === 'FROGIFY') {
        const targetCard = uid === p1Uid ? c2 : c1;
        const targetParsed = parseCard(targetCard);
        let frogged = 'Frogs-1';
        if (!targetParsed.isJoker && targetParsed.suit === 'Frogs') {
          const idx = VALUES.indexOf(targetParsed.value as any);
          const nextVal = VALUES[Math.min(idx + 1, VALUES.length - 1)];
          frogged = `Frogs-${nextVal}`;
        }
        if (uid === p1Uid) c2 = frogged;
        else c1 = frogged;
        events.push({
          type: 'TRANSFORM',
          uid: oppUid,
          fromCardId: targetCard,
          cardId: frogged,
          powerCardId: 1,
          message: `${players[uid].name} casts Frogs and warps the opposing card to ${frogged.replace('-', ' of ')}!`,
        });
      }
    };

    const applyDevilDecision = (uid: string, oppUid: string, decision?: PendingPowerDecision | null) => {
      if (!decision || decision.powerCardId !== 15 || blockedPowers[uid]) return;
      if (decision.selectedOption === 'DEVIL_KING') {
        if (uid === p1Uid) {
          const pc = parseCard(c1);
          c1 = pc.isJoker ? c1 : `${pc.suit}-K`;
        } else {
          const pc = parseCard(c2);
          c2 = pc.isJoker ? c2 : `${pc.suit}-K`;
        }
        events.push({
          type: 'POWER_TRIGGER',
          uid,
          powerCardId: 15,
          message: `${players[uid].name} makes a Devil Deal: their card becomes a King!`,
        });
      } else if (decision.selectedOption === 'DEVIL_RANDOMIZE') {
        const wheel =
          roomData.availableSuits && roomData.availableSuits.length > 0
            ? [...roomData.availableSuits]
            : [...SUITS];
        const spunSuit = wheel[Math.floor(Math.random() * wheel.length)];
        if (uid === p1Uid) {
          const pcOpp = parseCard(c2);
          if (!pcOpp.isJoker) c2 = `${spunSuit}-${pcOpp.value}`;
        } else {
          const pcOpp = parseCard(c1);
          if (!pcOpp.isJoker) c1 = `${spunSuit}-${pcOpp.value}`;
        }
        events.push({
          type: 'POWER_TRIGGER',
          uid,
          powerCardId: 15,
          message: `${players[uid].name} spins the trump wheel — ${players[oppUid].name}'s card takes ${spunSuit}!`,
        });
      }
    };

    applyMagicianSteal(p1Uid, p2Uid, p1Decision);
    applyMagicianSteal(p2Uid, p1Uid, p2Decision);
    applyDevilDecision(p1Uid, p2Uid, p1Decision);
    applyDevilDecision(p2Uid, p1Uid, p2Decision);

    // Phase 2: Before Resolution
    const applyBefore = (pUid: string, oUid: string, p: number | null) => {
      if (blockedPowers[pUid]) return;
      let pc1 = parseCard(c1);
      let pc2 = parseCard(c2);
      
      if (p === 17) { // Star
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 17, message: `${players[pUid].name}'s Star transforms the field!` });
        targetSuit = 'Stars';
        events.push({ type: 'TARGET_CHANGE', suit: 'Stars', message: `Target suit is now Stars!` });
      }

      if (p === 0) { // Fool
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 0, message: `${players[pUid].name}'s Fool swaps the cards!` });
        const temp = c1; c1 = c2; c2 = temp;
        events.push({ type: 'CARD_SWAP', message: `Cards have been swapped!` });
      }
      if (p === 6) {
        // Lovers: both plays become Hearts (same printed rank); does not retarget the table suit.
        events.push({
          type: 'POWER_TRIGGER',
          uid: pUid,
          powerCardId: 6,
          message: `${players[pUid].name}'s Lovers baptize both plays in Hearts!`,
        });
        for (const uid of [p1Uid, p2Uid] as const) {
          const cur = uid === p1Uid ? c1 : c2;
          const pc = parseCard(cur);
          if (pc.isJoker || pc.suit === 'Hearts') continue;
          const fromCard = cur;
          const next = `Hearts-${pc.value}`;
          if (uid === p1Uid) c1 = next;
          else c2 = next;
          events.push({
            type: 'TRANSFORM',
            uid,
            fromCardId: fromCard,
            cardId: next,
            powerCardId: 6,
            message: `${players[uid].name}'s card becomes ${next.replace('-', ' of ')}.`,
          });
        }
      }
      if (p === 4) { // Emperor
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 4, message: `${players[pUid].name}'s Emperor empowers the card!` });
        if (pUid === p1Uid) {
          const fromCard = c1;
          const stepped = bumpPlayingCardRank(c1, 2);
          c1 = parseCard(stepped).isJoker ? c1 : `${targetSuit}-${parseCard(stepped).value}`;
          events.push({
            type: 'CARD_EMPOWER',
            uid: p1Uid,
            fromCardId: fromCard,
            cardId: c1,
            message: `${players[p1Uid].name}'s card upgraded to target suit!`,
          });
        } else {
          const fromCard = c2;
          const stepped = bumpPlayingCardRank(c2, 2);
          c2 = parseCard(stepped).isJoker ? c2 : `${targetSuit}-${parseCard(stepped).value}`;
          events.push({
            type: 'CARD_EMPOWER',
            uid: p2Uid,
            fromCardId: fromCard,
            cardId: c2,
            message: `${players[p2Uid].name}'s card upgraded to target suit!`,
          });
        }
      }
      if (p === 8) { // Strength
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 8, message: `${players[pUid].name}'s Strength boosts the card!` });
        if (pUid === p1Uid) {
          const pc = parseCard(c1);
          const fromCard = c1;
          c1 = pc.isJoker ? c1 : bumpPlayingCardRank(c1, 4);
          events.push({
            type: 'CARD_EMPOWER',
            uid: p1Uid,
            fromCardId: fromCard,
            cardId: c1,
            message: `${players[p1Uid].name}'s card value increased!`,
          });
        } else {
          const pc = parseCard(c2);
          const fromCard = c2;
          c2 = pc.isJoker ? c2 : bumpPlayingCardRank(c2, 4);
          events.push({
            type: 'CARD_EMPOWER',
            uid: p2Uid,
            fromCardId: fromCard,
            cardId: c2,
            message: `${players[p2Uid].name}'s card value increased!`,
          });
        }
      }
      if (p === 11) { // Justice
        events.push({ type: 'POWER_TRIGGER', uid: pUid, powerCardId: 11, message: `${players[pUid].name}'s Justice summons an ally!` });
        const summoned = `${targetSuit}-${VALUES[Math.floor(Math.random() * VALUES.length)]}`;
        summonedCards[pUid] = summoned;
        events.push({ type: 'SUMMON_CARD', uid: pUid, cardId: summoned, message: `Justice summoned ${summoned.replace('-', ' of ')}!` });
      }
    };

    const emperorLoversBothActive =
      ((power1 === 4 && power2 === 6) || (power1 === 6 && power2 === 4)) &&
      !blockedPowers[p1Uid] &&
      !blockedPowers[p2Uid];

    if (!emperorLoversBothActive) {
      applyBefore(p1Uid, p2Uid, power1);
      applyBefore(p2Uid, p1Uid, power2);
    } else {
      const emperorUid = power1 === 4 ? p1Uid : p2Uid;
      const loversUid = power1 === 6 ? p1Uid : p2Uid;
      const emperorOpp = emperorUid === p1Uid ? p2Uid : p1Uid;
      const loversOpp = loversUid === p1Uid ? p2Uid : p1Uid;

      let emperorFirst: boolean;
      if (coinFlip === 'Host') {
        emperorFirst = emperorUid === p1Uid;
      } else if (coinFlip === 'Opponent') {
        emperorFirst = emperorUid === p2Uid;
      } else {
        const pip = rollFairD6();
        emperorFirst = fairHalfFromD6(pip);
        coinFlip = emperorFirst === (emperorUid === p1Uid) ? 'Host' : 'Opponent';
      }

      events.push({
        type: 'COIN_FLIP',
        message: emperorFirst
          ? `${players[emperorUid].name}'s Emperor resolves before ${players[loversUid].name}'s Lovers.`
          : `${players[loversUid].name}'s Lovers resolve before ${players[emperorUid].name}'s Emperor.`,
        coinFlipSides: { headsUid: emperorUid, tailsUid: loversUid },
        resolutionDice: [emperorFirst ? 1 : 0],
      });

      if (emperorFirst) {
        applyBefore(emperorUid, emperorOpp, 4);
        applyBefore(loversUid, loversOpp, 6);
      } else {
        applyBefore(loversUid, loversOpp, 6);
        applyBefore(emperorUid, emperorOpp, 4);
      }
    }

    applyMagicianFrog(p1Uid, p2Uid, p1Decision);
    applyMagicianFrog(p2Uid, p1Uid, p2Decision);

    // TRANSFORMATION: If target suit is Stars, all normal cards transform to Stars
    if (targetSuit === 'Stars') {
      const pc1 = parseCard(c1);
      const pc2 = parseCard(c2);
      if (!pc1.isJoker && pc1.suit !== 'Stars') {
        const fromCard = c1;
        c1 = `Stars-${pc1.value}`;
        events.push({
          type: 'TRANSFORM',
          uid: p1Uid,
          fromCardId: fromCard,
          cardId: c1,
          powerCardId: 17,
          message: `${players[p1Uid].name}'s card became a Star!`,
        });
      }
      if (!pc2.isJoker && pc2.suit !== 'Stars') {
        const fromCard = c2;
        c2 = `Stars-${pc2.value}`;
        events.push({
          type: 'TRANSFORM',
          uid: p2Uid,
          fromCardId: fromCard,
          cardId: c2,
          powerCardId: 17,
          message: `${players[p2Uid].name}'s card became a Star!`,
        });
      }
    }

    const greedJointTrump = greedWasActive && targetSuit === 'Diamonds';

    const wrathActive =
      curseEnabled &&
      wrathCurseActive(roomData.activeCurses) &&
      roomData.wrathTargetUid &&
      roomData.wrathMinionCard;
    const wrathMag = wrathActive ? getWrathMagnitude(roomData.wrathMinionCard!) : 0;
    const wrathTargetUidForPenalty = wrathActive ? roomData.wrathTargetUid! : null;
    const wrathPen = (card: string, ownerUid: string) =>
      wrathTargetUidForPenalty === ownerUid &&
      !parseCard(card).isJoker &&
      card !== GROVEL_CARD_ID
        ? wrathMag
        : 0;

    const hermitEffectiveRank = (cardStr: string, ownerUid: string, pen: number) => {
      if (parseCard(cardStr).isJoker) return getCardValue(cardStr, lustHeartRules, greedTaxActive);
      return Math.max(0, getCardValue(cardStr, lustHeartRules, greedTaxActive) - pen);
    };

    const hermitSwap = (pUid: string, oUid: string, oCard: string) => {
      const p = players[pUid];
      const pool = p.hand.filter(card => card !== p.currentMove);

      const pickPreferNonJoker = (cands: string[]): string | null => {
        if (cands.length === 0) return null;
        const nonJoker = cands.find(c => !parseCard(c).isJoker);
        return nonJoker ?? cands[0];
      };

      const prideAllowsHermit = (card: string) =>
        !curseEnabled ||
        !prideCurseActive(roomData.activeCurses) ||
        !roomData.prideCeilingCard ||
        !isCardBlockedByPride(card, roomData.prideCeilingCard, lustHeartRules, greedTaxActive);

      const envyAllowsHermitPick = (card: string) =>
        !curseEnabled ||
        !envyCurseActive(roomData.activeCurses) ||
        envyFreeCopiesInHand(p.hand, pUid, card, roomData.envySealedCards) > 0;

      const winCandidates = pool.filter(
        card =>
          prideAllowsHermit(card) &&
          envyAllowsHermitPick(card) &&
          evaluateTrickClash(
            card,
            oCard,
            targetSuit,
            lustHeartRules,
            greedTaxActive,
            greedJointTrump,
            wrathPen(card, pUid),
            wrathPen(oCard, oUid),
          ) === 'p1',
      );
      winCandidates.sort(
        (a, b) =>
          hermitEffectiveRank(b, pUid, wrathPen(b, pUid)) -
          hermitEffectiveRank(a, pUid, wrathPen(a, pUid)),
      );
      const winPick = pickPreferNonJoker(winCandidates);
      if (winPick) {
        return { card: winPick, reason: 'win' as const };
      }

      const drawCandidates = pool.filter(
        card =>
          prideAllowsHermit(card) &&
          envyAllowsHermitPick(card) &&
          evaluateTrickClash(
            card,
            oCard,
            targetSuit,
            lustHeartRules,
            greedTaxActive,
            greedJointTrump,
            wrathPen(card, pUid),
            wrathPen(oCard, oUid),
          ) === 'draw',
      );
      drawCandidates.sort(
        (a, b) =>
          hermitEffectiveRank(b, pUid, wrathPen(b, pUid)) -
          hermitEffectiveRank(a, pUid, wrathPen(a, pUid)),
      );
      const drawPick = pickPreferNonJoker(drawCandidates);
      if (drawPick) {
        return { card: drawPick, reason: 'draw' as const };
      }
      return { card: null, reason: 'none' as const };
    };

    if (power1 === 9) {
        if (blockedPowers[p1Uid]) {
          events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 9, message: `${players[p1Uid].name}'s Hermit was blocked by Tower.` });
        } else {
          const better = hermitSwap(p1Uid, p2Uid, c2);
          if (better.card) {
            c1 = better.card;
            events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 9, message: `${players[p1Uid].name}'s Hermit found a ${better.reason === 'win' ? 'winning' : 'drawing'} line.` });
            events.push({ type: 'CARD_SWAP', uid: p1Uid, cardId: c1, message: `${players[p1Uid].name} swapped to ${compactCardLabel(c1)}.` });
          } else {
            events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 9, message: `${players[p1Uid].name}'s Hermit could not find a winning or drawing card.` });
          }
        }
    }
    if (power2 === 9) {
        if (blockedPowers[p2Uid]) {
          events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 9, message: `${players[p2Uid].name}'s Hermit was blocked by Tower.` });
        } else {
          const better = hermitSwap(p2Uid, p1Uid, c1);
          if (better.card) {
            c2 = better.card;
            events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 9, message: `${players[p2Uid].name}'s Hermit found a ${better.reason === 'win' ? 'winning' : 'drawing'} line.` });
            events.push({ type: 'CARD_SWAP', uid: p2Uid, cardId: c2, message: `${players[p2Uid].name} swapped to ${compactCardLabel(c2)}.` });
          } else {
            events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 9, message: `${players[p2Uid].name}'s Hermit could not find a winning or drawing card.` });
          }
        }
    }

    /** Filled after Lust empowerment on the trick; feed events fire after scoring. */
    let lustRoundFx: NonNullable<RoomData['lastOutcome']>['lustRoundFx'] = undefined;

    /** True once printed trick hearts mutate for clash (`Hearts-G` / +3 ranks). */
    let lustPrintedHeartsBump = false;

    // Phase 3: Resolution
    const deathVsTemperance =
      ((committedPower1 === 13 && committedPower2 === 14) || (committedPower1 === 14 && committedPower2 === 13)) &&
      !blockedPowers[p1Uid] &&
      !blockedPowers[p2Uid];

    if (deathVsTemperance) {
      const deathUid = committedPower1 === 13 ? p1Uid : p2Uid;
      const temperanceUid = deathUid === p1Uid ? p2Uid : p1Uid;
      const pip = rollFairD6();
      const deathClaims = fairHalfFromD6(pip);
      if (deathClaims) {
        winnerUid = deathUid;
        events.push({
          type: 'COIN_FLIP',
          message: `${players[deathUid].name}'s Death wins the struggle against Temperance.`,
          coinFlipSides: { headsUid: deathUid, tailsUid: temperanceUid },
          resolutionDice: [1],
        });
        events.push({
          type: 'POWER_TRIGGER',
          uid: deathUid,
          powerCardId: 13,
          message: `${players[deathUid].name}'s Death claims the round.`,
        });
      } else {
        winnerUid = 'draw';
        events.push({
          type: 'COIN_FLIP',
          message: `Temperance balances Death — the round ends in a draw.`,
          coinFlipSides: { headsUid: deathUid, tailsUid: temperanceUid },
          resolutionDice: [0],
        });
        events.push({
          type: 'POWER_TRIGGER',
          powerCardId: 14,
          message: 'Temperance forced transparency and balance.',
        });
      }
    } else if (power1 === 14 || power2 === 14) {
      winnerUid = 'draw';
      events.push({
        type: 'POWER_TRIGGER',
        powerCardId: 14,
        message: 'Temperance forced transparency and balance.',
      });
    } else {
        const wp1 = wrathPen(c1, p1Uid);
        const wp2 = wrathPen(c2, p2Uid);
        if (wrathActive && roomData.wrathMinionCard) {
          const blade = sentenceCard(roomData.wrathMinionCard);
          if (wrathTargetUidForPenalty === p1Uid && parseCard(c1).isJoker) {
            events.push({
              type: 'POWER_TRIGGER',
              message: `${blade} spared the fool.`,
            });
          }
          if (wrathTargetUidForPenalty === p2Uid && parseCard(c2).isJoker) {
            events.push({
              type: 'POWER_TRIGGER',
              message: `${blade} spared the fool.`,
            });
          }
        }

        if (curseEnabled && lustHeartRules) {
          for (const uid of [p1Uid, p2Uid] as const) {
            const isP1 = uid === p1Uid;
            const cur = isP1 ? c1 : c2;
            const pcCur = parseCard(cur);
            if (pcCur.isJoker || pcCur.suit !== 'Hearts') continue;
            const bumped = lustBumpHeartIfApplicable(cur);
            if (!bumped || bumped === cur) continue;
            lustPrintedHeartsBump = true;
            events.push({
              type: 'CARD_EMPOWER',
              uid,
              fromCardId: cur,
              cardId: bumped,
              message: `Lust empowers ${players[uid].name}'s ${plainCardLabelForLustEmpower(cur)}.`,
            });
            if (isP1) c1 = bumped;
            else c2 = bumped;
          }
        }

        if (curseEnabled && lustHeartRules) {
          const prevLust = roomData.activeCurses?.find((c) => c.id === CURSE_LUST)?.lustAccumulated ?? 0;
          const heartsRemainAll = heartsRemainInDeckHandsOrCommits(roomData.deck, players);
          const heartsExhaustedGlobally = !heartsRemainAll;

          type LustContrib = NonNullable<
            NonNullable<RoomData['lastOutcome']>['lustRoundFx']
          >['contributions'][number];
          const contributions: LustContrib[] = [];
          let hungerAdd = 0;
          for (const uid of [p1Uid, p2Uid]) {
            const trickCard = uid === p1Uid ? c1 : c2;
            const pcT = parseCard(trickCard);
            if (pcT.isJoker || pcT.suit !== 'Hearts') continue;
            const lustPts = Math.max(0, Math.round(getCardValue(trickCard, false, greedTaxActive)));
            hungerAdd += lustPts;
            contributions.push({
              uid,
              card: trickCard,
              engagedCard: initialCardsPlayed[uid],
              lustPointsAdded: lustPts,
            });
          }

          const nextRaw = prevLust + hungerAdd;
          const meterFull = nextRaw >= LUST_METER_MAX;
          const curseClears = heartsExhaustedGlobally || (contributions.length > 0 && meterFull);

          if (contributions.length > 0 || curseClears) {
            lustRoundFx = {
              contributions,
              previousMeter: prevLust,
              nextMeter: curseClears ? 0 : nextRaw,
              sated: contributions.length > 0 && meterFull,
              heartsExhausted: curseClears && heartsExhaustedGlobally,
            };
          }
        }

        const lhPlayed = (cardStr: string) =>
          lustHeartRules && !(lustPrintedHeartsBump && parseCard(cardStr).suit === 'Hearts');
        const playedLustSides = [lhPlayed(c1), lhPlayed(c2)] as const;

        const res = evaluateTrickClash(
          c1,
          c2,
          targetSuit,
          lustHeartRules,
          greedTaxActive,
          greedJointTrump,
          wp1,
          wp2,
          playedLustSides,
        );
        const s1 = summonedCards[p1Uid];
        const s2 = summonedCards[p2Uid];

        if (s1 && s2) {
          const r1 = evaluateTrickClash(
            s1,
            s2,
            targetSuit,
            lustHeartRules,
            greedTaxActive,
            greedJointTrump,
            0,
            0,
            [lhPlayed(s1), lhPlayed(s2)],
          );
          const rMain = res;
          if (rMain === 'p1' || r1 === 'p1') winnerUid = p1Uid;
          else if (rMain === 'p2' || r1 === 'p2') winnerUid = p2Uid;
          else winnerUid = 'draw';
        } else if (s1) {
          const resSummon = evaluateTrickClash(
            s1,
            c2,
            targetSuit,
            lustHeartRules,
            greedTaxActive,
            greedJointTrump,
            0,
            wp2,
            [lhPlayed(s1), lhPlayed(c2)],
          );
          if (res === 'p1' || resSummon === 'p1') winnerUid = p1Uid;
          else if (res === 'p2' && resSummon === 'p2') winnerUid = p2Uid;
          else winnerUid = 'draw';
        } else if (s2) {
          const resSummon = evaluateTrickClash(
            s2,
            c1,
            targetSuit,
            lustHeartRules,
            greedTaxActive,
            greedJointTrump,
            0,
            wp1,
            [lhPlayed(s2), lhPlayed(c1)],
          );
          if (res === 'p2' || resSummon === 'p2') winnerUid = p2Uid;
          else if (res === 'p1' && resSummon === 'p1') winnerUid = p1Uid;
          else winnerUid = 'draw';
        } else {
          winnerUid = res === 'p1' ? p1Uid : (res === 'p2' ? p2Uid : 'draw');
        }

        const refreshClashPenaltyDestroy = () => {
          for (const uid of [p1Uid, p2Uid] as const) {
            const card = uid === p1Uid ? c1 : c2;
            const pen = uid === p1Uid ? wp1 : wp2;
            const pc = parseCard(card);
            if (pc.isJoker || card === GROVEL_CARD_ID || pen <= 0) clashDestroyedForOutcome[uid] = false;
            else {
              const eff = Math.max(0, getCardValue(card, lhPlayed(card), greedTaxActive) - pen);
              clashDestroyedForOutcome[uid] = eff === 0;
            }
          }
        };
        refreshClashPenaltyDestroy();

        let wheelDjLock = false;

        type WheelEvt = { uid: string; res: string };
        const wheels: WheelEvt[] = [];
        if (power1 === 10 && !blockedPowers[p1Uid] && p1Decision?.wheelResult) wheels.push({ uid: p1Uid, res: p1Decision.wheelResult });
        if (power2 === 10 && !blockedPowers[p2Uid] && p2Decision?.wheelResult) wheels.push({ uid: p2Uid, res: p2Decision.wheelResult });

        if (wheels.length === 2) {
          let p1First: boolean;
          if (coinFlip === 'Host') {
            p1First = true;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p1Uid].name}'s Wheel resolves first (twin Wheels — initiative already ${coinFlip}).`,
            });
          } else if (coinFlip === 'Opponent') {
            p1First = false;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p2Uid].name}'s Wheel resolves first (twin Wheels — initiative already ${coinFlip}).`,
            });
          } else {
            const pip = rollFairD6();
            p1First = fairHalfFromD6(pip);
            coinFlip = p1First ? 'Host' : 'Opponent';
            events.push({
              type: 'COIN_FLIP',
              message: `${p1First ? players[p1Uid].name : players[p2Uid].name} wins Wheel order (${p1First ? players[p1Uid].name : players[p2Uid].name}'s Wheel resolves first, then ${p1First ? players[p2Uid].name : players[p1Uid].name}).`,
              coinFlipSides: { headsUid: p1Uid, tailsUid: p2Uid },
              resolutionDice: [p1First ? 1 : 0],
            });
          }

          wheels.sort((a, b) => {
            const aP1 = a.uid === p1Uid;
            const bP1 = b.uid === p1Uid;
            if (aP1 === bP1) return 0;
            if (p1First) return aP1 ? -1 : 1;
            return bP1 ? -1 : 1;
          });
        }

        const applyWheelStep = (uid: string, outcomeLabel: string) => {
          if (wheelDjLock && (outcomeLabel === 'LOSE_ROUND' || outcomeLabel === 'WIN_ROUND')) {
            events.push({
              type: 'POWER_TRIGGER',
              uid,
              powerCardId: 10,
              message: `${players[uid].name}'s Wheel (${outcomeLabel.replaceAll('_', ' ')}) is swallowed by twin Jokers on the table.`
            });
            return;
          }
          if (outcomeLabel === 'LOSE_ROUND') {
            winnerUid = uid === p1Uid ? p2Uid : p1Uid;
          } else if (outcomeLabel === 'WIN_ROUND') {
            if (!wheelDjLock) winnerUid = uid;
          } else if (outcomeLabel === 'WIN_2_CARDS') {
            gains[uid].push({ type: 'draw', id: 2 });
          } else if (outcomeLabel === 'DOUBLE_JOKER') {
            c1 = 'Joker-1';
            c2 = 'Joker-2';
            winnerUid = 'draw';
            wheelDjLock = true;
            clashDestroyedForOutcome[p1Uid] = false;
            clashDestroyedForOutcome[p2Uid] = false;
          } else if (outcomeLabel === 'JACKPOT') {
            if (uid === p1Uid) c1 = 'Coins-10';
            else c2 = 'Coins-10';
            clashDestroyedForOutcome[uid] = false;
          } else if (outcomeLabel === 'POWER_CARD') {
            gains[uid].push({ type: 'draw', id: 'random-power' });
          } else if (outcomeLabel === 'LOSE_2_CARDS') {
            gains[uid].push({ type: 'draw', id: -2 });
          }
          events.push({
            type: 'POWER_TRIGGER',
            uid,
            powerCardId: 10,
            message: `${players[uid].name}'s Wheel of Fortune outcome: ${outcomeLabel.replaceAll('_', ' ')}`
          });
        };

        for (const w of wheels) {
          applyWheelStep(w.uid, w.res);
        }

        for (const uid of [p1Uid, p2Uid] as const) {
          if (!clashDestroyedForOutcome[uid]) continue;
          const cid = uid === p1Uid ? c1 : c2;
          events.push({
            type: 'CLASH_DESTROYED',
            uid,
            cardId: cid,
            message: `${players[uid].name}'s play shatters — clash rank broken to nothing.`,
          });
        }

        if (power1 === 13 && power2 === 13 && !blockedPowers[p1Uid] && !blockedPowers[p2Uid]) {
          if (coinFlip === 'Host') {
            winnerUid = p1Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p1Uid].name} wins the duel of Death (initiative ${coinFlip}).`
            });
          } else if (coinFlip === 'Opponent') {
            winnerUid = p2Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p2Uid].name} wins the duel of Death (initiative ${coinFlip}).`
            });
          } else {
            const pip = rollFairD6();
            const hostWins = fairHalfFromD6(pip);
            coinFlip = hostWins ? 'Host' : 'Opponent';
            winnerUid = hostWins ? p1Uid : p2Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[winnerUid].name} wins the duel of Death (fresh flip — ${coinFlip}).`,
              coinFlipSides: { headsUid: p1Uid, tailsUid: p2Uid },
              resolutionDice: [hostWins ? 1 : 0],
            });
          }
          events.push({
            type: 'POWER_TRIGGER',
            uid: winnerUid,
            powerCardId: 13,
            message: `${players[winnerUid].name}'s Death wins the duel.`
          });
        } else {
          if (power1 === 13 && !blockedPowers[p1Uid]) {
            winnerUid = p1Uid;
            events.push({
              type: 'POWER_TRIGGER',
              uid: p1Uid,
              powerCardId: 13,
              message: `${players[p1Uid].name}'s Death claims the round.`
            });
          }
          if (power2 === 13 && !blockedPowers[p2Uid]) {
            winnerUid = p2Uid;
            events.push({
              type: 'POWER_TRIGGER',
              uid: p2Uid,
              powerCardId: 13,
              message: `${players[p2Uid].name}'s Death claims the round.`
            });
          }
        }

        const judgement1 = committedPower1 === 20 && !blockedPowers[p1Uid];
        const judgement2 = committedPower2 === 20 && !blockedPowers[p2Uid];
        if (judgement1 || judgement2) {
          const h1 = players[p1Uid].hand.length;
          const h2 = players[p2Uid].hand.length;
          events.push({
            type: 'POWER_TRIGGER',
            powerCardId: 20,
            message:
              judgement1 && judgement2
                ? `Judgement weighs both hands — fewer cards claim the round.`
                : `Judgement weighs the hands — fewer cards claim the round.`,
          });
          if (h1 < h2) winnerUid = p1Uid;
          else if (h2 < h1) winnerUid = p2Uid;
          else winnerUid = 'draw';
        }

        if (power1 === 7 && winnerUid === p2Uid) {
          const played = c1;
          const pc = parseCard(played);
          const newVal = VALUES[Math.min(VALUES.indexOf(pc.value as any) + 1, VALUES.length - 1)];
          gains[p1Uid].push({ type: 'card', id: `${pc.suit}-${newVal}` });
          events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 7, message: `${players[p1Uid].name}'s Chariot saves the card!` });
        }
        if (power2 === 7 && winnerUid === p1Uid) {
          const played = c2;
          const pc = parseCard(played);
          const newVal = VALUES[Math.min(VALUES.indexOf(pc.value as any) + 1, VALUES.length - 1)];
          gains[p2Uid].push({ type: 'card', id: `${pc.suit}-${newVal}` });
          events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 7, message: `${players[p2Uid].name}'s Chariot saves the card!` });
        }

        const bothHanged =
          committedPower1 === 12 &&
          committedPower2 === 12 &&
          !blockedPowers[p1Uid] &&
          !blockedPowers[p2Uid];

        if (bothHanged) {
          if (coinFlip === 'Host') {
            winnerUid = p1Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p1Uid].name} wins the twin Hanged Man tie (initiative ${coinFlip}).`,
            });
          } else if (coinFlip === 'Opponent') {
            winnerUid = p2Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[p2Uid].name} wins the twin Hanged Man tie (initiative ${coinFlip}).`,
            });
          } else {
            const pip = rollFairD6();
            const hostWins = fairHalfFromD6(pip);
            coinFlip = hostWins ? 'Host' : 'Opponent';
            winnerUid = hostWins ? p1Uid : p2Uid;
            events.push({
              type: 'COIN_FLIP',
              message: `${players[winnerUid].name} wins the twin Hanged Man tie (fresh flip — ${coinFlip}).`,
              coinFlipSides: { headsUid: p1Uid, tailsUid: p2Uid },
              resolutionDice: [hostWins ? 1 : 0],
            });
          }
          events.push({
            type: 'POWER_TRIGGER',
            powerCardId: 12,
            message: `${players[p1Uid].name} and ${players[p2Uid].name} both played The Hanged Man.`,
          });
        } else {
          if (power1 === 12 && !blockedPowers[p1Uid]) {
            winnerUid = p2Uid;
            events.push({
              type: 'POWER_TRIGGER',
              powerCardId: 12,
              message: `${players[p1Uid].name} forfeits via The Hanged Man.`,
            });
          }
          if (power2 === 12 && !blockedPowers[p2Uid]) {
            winnerUid = p1Uid;
            events.push({
              type: 'POWER_TRIGGER',
              powerCardId: 12,
              message: `${players[p2Uid].name} forfeits via The Hanged Man.`,
            });
          }
        }

        if (
          curseEnabled &&
          lustHeartRules &&
          lustRoundFx &&
          (lustRoundFx.contributions.length > 0 ||
            lustRoundFx.sated ||
            Boolean(lustRoundFx.heartsExhausted))
        ) {
          const fx = lustRoundFx;
          if (fx.contributions.length > 0) {
            events.push({
              type: 'POWER_TRIGGER',
              powerCardId: CURSE_LUST,
              message: 'Lust feeds its lusts.',
              lustFeedBegins: true,
            });
            for (const c of fx.contributions) {
              events.push({
                type: 'POWER_TRIGGER',
                uid: c.uid,
                powerCardId: CURSE_LUST,
                lustFeedPts: c.lustPointsAdded,
                lustSurgeHeart: true,
                message: `${players[c.uid].name}'s heart feeds Lust (+${c.lustPointsAdded} thirst).`,
              });
            }
          }
          if (fx.sated && fx.contributions.length > 0) {
            events.push({
              type: 'POWER_TRIGGER',
              powerCardId: CURSE_LUST,
              message: `Lust reached ${LUST_METER_MAX} hunger — thirst cleared.`,
            });
          }
          if (fx.heartsExhausted) {
            events.push({
              type: 'POWER_TRIGGER',
              powerCardId: CURSE_LUST,
              message:
                fx.sated && fx.contributions.length > 0
                  ? 'No hearts remain in deck or hands — Lust fades with the last bite.'
                  : 'No hearts remain in deck or hands — Lust departs.',
            });
          }
        }
    }

    // Hierophant 5
    if (power1 === 5) {
      events.push({ type: 'INTEL_REVEAL', uid: p1Uid, message: `${players[p1Uid].name} used The Hierophant to peek into ${players[p2Uid].name}'s hand!` });
    }
    if (power2 === 5) {
      events.push({ type: 'INTEL_REVEAL', uid: p2Uid, message: `${players[p2Uid].name} used The Hierophant to peek into ${players[p1Uid].name}'s hand!` });
    }
    const lhPlayedFinal = (cardStr: string) =>
      lustHeartRules && !(lustPrintedHeartsBump && parseCard(cardStr).suit === 'Hearts');
    let finalMessage = "";
    if (winnerUid === 'draw') {
       if (power1 === 14 || power2 === 14) finalMessage = "Temperance has balanced the scale of fate.";
       else if (
         (committedPower1 === 20 && !blockedPowers[p1Uid]) ||
         (committedPower2 === 20 && !blockedPowers[p2Uid])
       ) {
         finalMessage = `Judgement finds the hands evenly weighted.`;
       } else finalMessage = "A perfect deadlock. Zero sum.";
    } else {
       const wName = players[winnerUid].name;

       const hanged1 = committedPower1 === 12 && !blockedPowers[p1Uid];
       const hanged2 = committedPower2 === 12 && !blockedPowers[p2Uid];
       if (hanged1 || hanged2) finalMessage = `${wName} takes the round — The Hanged Man.`;
       else if (
         (committedPower1 === 20 && !blockedPowers[p1Uid]) ||
         (committedPower2 === 20 && !blockedPowers[p2Uid])
       ) {
         finalMessage = `Judgement names ${wName} — fewer cards in hand.`;
       }
       else {
          const winnerCardStr = winnerUid === p1Uid ? c1 : c2;
          const loserCardStr = winnerUid === p1Uid ? c2 : c1;
          finalMessage = `${wName} wins — ${explainPlainClash(
            winnerCardStr,
            loserCardStr,
            targetSuit,
            lustHeartRules,
            greedTaxActive,
            greedJointTrump,
            [lhPlayedFinal(winnerCardStr), lhPlayedFinal(loserCardStr)],
          )}`;
       }
    }

    if (envyActiveThisResolution) {
      const entry = roomData.activeCurses?.find((c) => c.id === CURSE_ENVY);
      const hpStart =
        typeof entry?.envyMonsterHp === 'number' ? entry.envyMonsterHp : ENVY_MONSTER_START_HP;
      const cov = roomData.envyCovet;
      const playedCovetedFeed = cov ? engageLocks[cov.uid] === cov.cardId : false;
      const absorbedClashFx = cov && playedCovetedFeed ? getCardValue(cov.cardId, lustHeartRules, greedTaxActive) : 0;
      const hpAfterFeed = hpStart + absorbedClashFx;
      const departedDoubleGrovel =
        Boolean(roomData.envyBothGrovelTrap) &&
        c1 === GROVEL_CARD_ID &&
        c2 === GROVEL_CARD_ID;

      const strikes: { uid: string; damage: number; hpAfter: number }[] = [];
      const envyStrikePack: ResolutionEvent[] = [];
      let hp = hpAfterFeed;

      if (!departedDoubleGrovel) {
        for (const uid of [p1Uid, p2Uid] as const) {
          const card = uid === p1Uid ? c1 : c2;
          const damage = Math.max(0, getCardValue(card, lhPlayedFinal(card), greedTaxActive));
          hp = Math.max(0, hp - damage);
          strikes.push({ uid, damage, hpAfter: hp });
          const plain = sentenceCard(card);
          envyStrikePack.push({
            type: 'ENVY_STRIKE',
            uid,
            cardId: card,
            message:
              damage <= 0
                ? `${players[uid].name}'s ${plain} swipes at the Green-Eyed Monster — no bite.`
                : `${players[uid].name}'s ${plain} strikes the Green-Eyed Monster for ${damage}! (${hp} HP remaining)`,
            envyDamage: damage,
            envyHpAfter: hp,
          });
        }
      }

      if (departedDoubleGrovel) {
        envyStrikePack.push({
          type: 'ENVY_DEPARTS',
          message:
            'There is nothing left to covet. The Green-Eyed Monster slips away, sated on shame alone.',
        });
      } else if (hp <= 0) {
        envyStrikePack.push({
          type: 'ENVY_DEFEATED',
          message: 'The Green-Eyed Monster was defeated!',
          envyHpAfter: hp,
        });
      }

      events.push(...envyStrikePack);
      envyRoundFx = {
        covetUid: cov?.uid ?? null,
        covetCardId: cov?.cardId ?? null,
        covetHandIndex: cov?.handIndex ?? null,
        playedCoveted: playedCovetedFeed,
        absorbedClash: absorbedClashFx,
        newSeals: { ...envySealDeltaEarly },
        monsterHpStart: hpStart,
        monsterHpAfterFeed: hpAfterFeed,
        strikes,
        monsterHpEnd: departedDoubleGrovel ? hpAfterFeed : hp,
        defeated: !departedDoubleGrovel && hp <= 0,
        departedDoubleGrovel,
      };
    }

    let slothDreamFx: NonNullable<RoomData['lastOutcome']>['slothDreamFx'] = undefined;
    const slothActiveThisResolution =
      curseEnabled && slothCurseActive(roomData.activeCurses ?? []);
    if (slothActiveThisResolution) {
      const spinOffset = Math.random();
      const dreamResult = pickSlothDreamResult(spinOffset);
      slothDreamFx = { result: dreamResult, spinOffset };
      events.push({
        type: 'SLOTH_DREAM',
        message: 'Sloth is dreaming of…',
        slothDreamSpinOffset: spinOffset,
      });

      const toStars = (card: string) => {
        if (card === GROVEL_CARD_ID) return card;
        const pc = parseCard(card);
        if (pc.isJoker || pc.suit === 'Stars') return card;
        return `Stars-${pc.value}`;
      };
      const toMoons = (card: string) => {
        if (card === GROVEL_CARD_ID) return card;
        const pc = parseCard(card);
        if (pc.isJoker || pc.suit === 'Moons') return card;
        return `Moons-${pc.value}`;
      };
      const pushStar = (uid: string, prev: string, next: string) => {
        if (prev === next) return;
        events.push({
          type: 'TRANSFORM',
          uid,
          fromCardId: prev,
          cardId: next,
          powerCardId: 17,
          message: `${players[uid].name}'s card became a Star!`,
        });
      };
      const pushMoon = (uid: string, prev: string, next: string) => {
        if (prev === next) return;
        events.push({
          type: 'TRANSFORM',
          uid,
          fromCardId: prev,
          cardId: next,
          powerCardId: 18,
          message: `${players[uid].name}'s card became a Moon!`,
        });
      };

      if (dreamResult === 'STARS') {
        const o1 = c1;
        const o2 = c2;
        c1 = toStars(c1);
        c2 = toStars(c2);
        pushStar(p1Uid, o1, c1);
        pushStar(p2Uid, o2, c2);
      } else if (dreamResult === 'MOONS') {
        const o1 = c1;
        const o2 = c2;
        c1 = toMoons(c1);
        c2 = toMoons(c2);
        pushMoon(p1Uid, o1, c1);
        pushMoon(p2Uid, o2, c2);
      } else if (dreamResult === 'STARS_AND_MOONS') {
        const pip = rollFairD6();
        const p1Stars = fairHalfFromD6(pip);
        events.push({
          type: 'COIN_FLIP',
          message: p1Stars
            ? `${players[p1Uid].name} reels toward Stars — ${players[p2Uid].name} toward Moons (Sloth).`
            : `${players[p2Uid].name} reels toward Stars — ${players[p1Uid].name} toward Moons (Sloth).`,
          coinFlipSides: { headsUid: p1Uid, tailsUid: p2Uid },
          resolutionDice: [p1Stars ? 1 : 0],
        });
        if (p1Stars) {
          const o1 = c1;
          const o2 = c2;
          c1 = toStars(c1);
          c2 = toMoons(c2);
          pushStar(p1Uid, o1, c1);
          pushMoon(p2Uid, o2, c2);
        } else {
          const o1 = c1;
          const o2 = c2;
          c1 = toMoons(c1);
          c2 = toStars(c2);
          pushMoon(p1Uid, o1, c1);
          pushStar(p2Uid, o2, c2);
        }
      } else if (dreamResult === 'NOTHING') {
        events.push({
          type: 'SLOTH_DREAM',
          message: 'The dream lingers quietly — nothing changes.',
          slothDreamResult: 'NOTHING',
        });
      } else if (dreamResult === 'SUN') {
        events.push({
          type: 'SLOTH_DREAM',
          message: 'Sloth has awoken. The dream ends.',
          slothDreamResult: 'SUN',
        });
      }
    }

    const gluttonyDigestActive = curseEnabled && gluttonyCurseActive(roomData.activeCurses ?? []);
    const empressCollectorUid: string | null = power1 === 3 ? p1Uid : power2 === 3 ? p2Uid : null;

    const boneIfGluttonyHeartEngaged = (ownerUid: string, tableCard: string): string => {
      if (!gluttonyDigestActive) return tableCard;
      const locked = initialCardsPlayed[ownerUid];
      const heartEngaged = locked ? parseCard(locked).suit === 'Hearts' : parseCard(tableCard).suit === 'Hearts';
      if (!heartEngaged || parseCard(tableCard).isJoker) return tableCard;
      return `Bones-${parseCard(tableCard).value}`;
    };

    if (gluttonyDigestActive) {
      for (const uid of [p1Uid, p2Uid] as const) {
        const card = uid === p1Uid ? c1 : c2;
        const pc = parseCard(card);
        if (pc.isJoker) continue;
        const locked = initialCardsPlayed[uid];
        const heartEngaged = locked ? parseCard(locked).suit === 'Hearts' : pc.suit === 'Hearts';
        if (!heartEngaged) continue;
        const boneId = boneIfGluttonyHeartEngaged(uid, card);
        if (boneId === card) continue;
        events.push({
          type: 'GLUTTONY_DIGEST',
          uid,
          cardId: card,
          gluttonyBoneId: boneId,
          message: `Gluttony devours ${players[uid].name}'s heart play (${sentenceCard(card)}) — it returns as ${boneId.replace('-', ' ')}.`,
        });
        if (empressCollectorUid == null || uid !== empressCollectorUid) {
          gains[uid].push({ type: 'card', id: boneId });
        }
      }
    }

    // Phase 4: Post-Resolution Gains Determination
    const lhToken = (cardStr: string) =>
      lustHeartRules && !(lustPrintedHeartsBump && parseCard(cardStr).suit === 'Hearts');
    const tokenByUid = computeOverkillTokenAward({
      p1Uid,
      p2Uid,
      c1,
      c2,
      targetSuit,
      greedJointTrump,
      greedTaxActive,
      clashPenaltyByUid: { [p1Uid]: wrathPen(c1, p1Uid), [p2Uid]: wrathPen(c2, p2Uid) },
      lustPlayedByUid: { [p1Uid]: lhToken(c1), [p2Uid]: lhToken(c2) },
    });
    for (const uid of [p1Uid, p2Uid]) {
      const n = tokenByUid[uid] ?? 0;
      if (n <= 0) continue;
      gains[uid].push({ type: 'token', id: n });
      events.push({
        type: 'POWER_TRIGGER',
        uid,
        message: `${players[uid].name} gains ${n} token${n === 1 ? '' : 's'} (overkill).`,
      });
    }
    if (winnerUid !== 'draw') {
      const tn = tokenByUid[winnerUid] ?? 0;
      if (tn > 0) finalMessage += ` (+${tn} token${tn === 1 ? '' : 's'})`;
    }

    if (winnerUid !== 'draw' && winnerUid) {
      const loserUid = winnerUid === p1Uid ? p2Uid : p1Uid;

      const devilPactSeat = (uid: string): boolean => {
        const d = uid === p1Uid ? p1Decision : p2Decision;
        return Boolean(
          d?.powerCardId === 15 &&
            (d.selectedOption === 'DEVIL_KING' || d.selectedOption === 'DEVIL_RANDOMIZE') &&
            !blockedPowers[uid],
        );
      };

      if (roomData.famineActive) {
        gains[loserUid].push({ type: 'draw', id: -1 });
        events.push({
          type: 'POWER_TRIGGER',
          uid: loserUid,
          message: `${players[loserUid].name} loses 1 random card (Famine rule).`,
        });
      } else {
        gains[winnerUid].push({ type: 'draw', id: 'standard' });
      }

      if (devilPactSeat(loserUid)) {
        gains[loserUid].push({ type: 'draw', id: -1 });
        events.push({
          type: 'POWER_TRIGGER',
          uid: loserUid,
          powerCardId: 15,
          message: `${players[loserUid].name}'s Devil pact claims a random card from the loser.`,
        });
      }
    }

    if (power1 === 3) {
      events.push({ type: 'POWER_TRIGGER', uid: p1Uid, powerCardId: 3, message: `${players[p1Uid].name}'s Empress collects both suit cards!` });
      gains[p1Uid].push({ type: 'card', id: boneIfGluttonyHeartEngaged(p1Uid, c1) });
      gains[p1Uid].push({ type: 'card', id: boneIfGluttonyHeartEngaged(p2Uid, c2) });
    }
    if (power2 === 3) {
      events.push({ type: 'POWER_TRIGGER', uid: p2Uid, powerCardId: 3, message: `${players[p2Uid].name}'s Empress collects both suit cards!` });
      gains[p2Uid].push({ type: 'card', id: boneIfGluttonyHeartEngaged(p1Uid, c1) });
      gains[p2Uid].push({ type: 'card', id: boneIfGluttonyHeartEngaged(p2Uid, c2) });
    }
    if (committedPower1 === 12 && !blockedPowers[p1Uid]) gains[p1Uid].push({ type: 'draw', id: 3 });
    if (committedPower2 === 12 && !blockedPowers[p2Uid]) gains[p2Uid].push({ type: 'draw', id: 3 });
    if (power1 === 2 && winnerUid === p2Uid) gains[p1Uid].push({ type: 'draw', id: 1 });
    if (power2 === 2 && winnerUid === p1Uid) gains[p2Uid].push({ type: 'draw', id: 1 });
    if (power1 === 19) {
      const ref = initialCardsPlayed[p1Uid] ?? c1;
      gains[p1Uid].push({ type: 'card', id: boneIfGluttonyHeartEngaged(p1Uid, ref) });
    }
    if (power2 === 19) {
      const ref = initialCardsPlayed[p2Uid] ?? c2;
      gains[p2Uid].push({ type: 'card', id: boneIfGluttonyHeartEngaged(p2Uid, ref) });
    }
    if (power1 === 18) {
      for (let i = 0; i < 2; i++) {
        const val = VALUES[Math.floor(Math.random() * VALUES.length)];
        gains[p1Uid].push({ type: 'card', id: `Moons-${val}` });
      }
    }
    if (power2 === 18) {
      for (let i = 0; i < 2; i++) {
        const val = VALUES[Math.floor(Math.random() * VALUES.length)];
        gains[p2Uid].push({ type: 'card', id: `Moons-${val}` });
      }
    }
    if (power1 === 21) {
      gains[p1Uid].push({ type: 'draw', id: 'random-power' });
      gains[p1Uid].push({ type: 'draw', id: 'world-curse' });
    }
    if (power2 === 21) {
      gains[p2Uid].push({ type: 'draw', id: 'random-power' });
      gains[p2Uid].push({ type: 'draw', id: 'world-curse' });
    }

    // Precompute famine spillover for the results log: if draw requests exceed deck, mark those gains as famine-bone draws.
    const hostUid = roomData.hostUid;
    const guestUid = hostUid === p1Uid ? p2Uid : p1Uid;
    const drawBudget: Record<string, number> = { [p1Uid]: 0, [p2Uid]: 0 };
    [p1Uid, p2Uid].forEach((uid) => {
      for (const g of gains[uid]) {
        if (g.type !== 'draw') continue;
        if (g.id === 'standard') drawBudget[uid] += 1;
        else if (typeof g.id === 'number' && g.id > 0) drawBudget[uid] += g.id;
      }
    });
    let projectedDeck = roomData.deck.length;
    const projectedFamineBones: Record<string, number> = { [p1Uid]: 0, [p2Uid]: 0 };
    const order = [hostUid, guestUid];
    while ((drawBudget[p1Uid] ?? 0) > 0 || (drawBudget[p2Uid] ?? 0) > 0) {
      let moved = false;
      for (const uid of order) {
        if ((drawBudget[uid] ?? 0) <= 0) continue;
        drawBudget[uid] -= 1;
        if (projectedDeck > 0) projectedDeck -= 1;
        else projectedFamineBones[uid] += 1;
        moved = true;
        break;
      }
      if (!moved) break;
    }
    const totalProjectedBones = projectedFamineBones[p1Uid] + projectedFamineBones[p2Uid];
    if (totalProjectedBones > 0) {
      events.push({ type: 'POWER_TRIGGER', message: 'Famine has begun.' });
      [p1Uid, p2Uid].forEach((uid) => {
        const n = projectedFamineBones[uid];
        if (n <= 0) return;
        events.push({
          type: 'POWER_TRIGGER',
          uid,
          message: `${players[uid].name} got ${n} bone${n === 1 ? '' : 's'} to balance hands.`,
        });
        for (let i = 0; i < n; i++) gains[uid].push({ type: 'draw', id: 'famine-bone' });
      });
    }

    let gluttonyPersistence: NonNullable<RoomData['lastOutcome']>['gluttonyPersistence'] = undefined;
    const gluttonyWasActive = curseEnabled && gluttonyCurseActive(roomData.activeCurses);
    const gluttonyEntry = roomData.activeCurses?.find((c) => c.id === CURSE_GLUTTONY);
    if (gluttonyWasActive && gluttonyEntry) {
      const anyHeart = parseCard(c1).suit === 'Hearts' || parseCard(c2).suit === 'Hearts';
      let phase = gluttonyEntry.gluttonyPhase ?? 0;
      let streak = gluttonyEntry.gluttonyNoHeartStreak ?? 0;
      let remove = false;
      if (anyHeart) {
        phase = Math.max(0, phase - 1);
        streak = 0;
      } else {
        streak += 1;
        if (streak >= 2) {
          streak = 0;
          phase += 1;
          if (phase > 2) {
            remove = true;
            events.push({
              type: 'POWER_TRIGGER',
              message: 'Gluttony has wasted away.',
            });
          }
        }
      }
      gluttonyPersistence = remove
        ? { remove: true, phase: 0, streak: 0 }
        : { remove: false, phase, streak };
    }

    let greedPersistence: NonNullable<RoomData['lastOutcome']>['greedPersistence'] = undefined;
    if (greedWasActive) {
      const prev = roomData.activeCurses?.find((c) => c.id === CURSE_GREED)?.greedCrown ?? 0;
      const tax = greedTaxAmount(c1) + greedTaxAmount(c2);
      const nextCrown = Math.min(17, prev + tax);
      const removeReason = nextCrown >= 17 ? ('crown' as const) : null;
      greedPersistence = { nextCrown, taxThisRound: tax, removeReason };
      const greedTaxMsg = (uid: string, card: string, pts: number) =>
        `${players[uid].name}'s ${card} tithes ${pts} toward the Tyrant's crown.`;
      const taxP1 = greedTaxAmount(c1);
      if (taxP1 > 0) {
        events.push({
          type: 'POWER_TRIGGER',
          uid: p1Uid,
          powerCardId: CURSE_GREED,
          greedTaxPts: taxP1,
          message: greedTaxMsg(p1Uid, c1, taxP1),
        });
      }
      const taxP2 = greedTaxAmount(c2);
      if (taxP2 > 0) {
        events.push({
          type: 'POWER_TRIGGER',
          uid: p2Uid,
          powerCardId: CURSE_GREED,
          greedTaxPts: taxP2,
          message: greedTaxMsg(p2Uid, c2, taxP2),
        });
      }
      if (removeReason === 'crown') {
        events.push({
          type: 'POWER_TRIGGER',
          message: 'The Tyrant is dead. Only their crown remains.',
        });
      }
    }

    let wrathFx: NonNullable<RoomData['lastOutcome']>['wrathFx'] = undefined;
    if (wrathActive && roomData.wrathTargetUid && roomData.wrathMinionCard) {
      wrathFx = {
        targetUid: roomData.wrathTargetUid,
        minionCard: roomData.wrathMinionCard,
        magnitude: wrathMag,
        sparedJoker:
          (wrathTargetUidForPenalty === p1Uid && parseCard(c1).isJoker) ||
          (wrathTargetUidForPenalty === p2Uid && parseCard(c2).isJoker),
      };
    }

    const hadCurseAtOutcomeStartCalc = curseEnabled && curseEffectActive(roomData.activeCurses ?? []);
    let devilForcedCurseId: number | undefined;
    let devilCurseSpin: { offset: number; curseId: number } | undefined;
    const devilPactSummonsCurse =
      curseEnabled &&
      !hadCurseAtOutcomeStartCalc &&
      [p1Uid, p2Uid].some((uid) => {
        const d = uid === p1Uid ? p1Decision : p2Decision;
        return Boolean(
          d?.powerCardId === 15 &&
            (d.selectedOption === 'DEVIL_KING' || d.selectedOption === 'DEVIL_RANDOMIZE') &&
            !blockedPowers[uid],
        );
      });
    if (devilPactSummonsCurse) {
      const offset = Math.random();
      const curseId = pickDevilCurseFromOffset(offset);
      devilForcedCurseId = curseId;
      devilCurseSpin = { offset, curseId };
      const label = CURSES[curseId]?.name ?? 'A curse';
      events.push({
        type: 'POWER_TRIGGER',
        powerCardId: 15,
        message: `The Devil curses the table — ${label}.`,
      });
    }

    return {
      targetSuit,
      winnerUid,
      message: finalMessage,
      cardsPlayed: { [p1Uid]: c1, [p2Uid]: c2 },
      initialCardsPlayed,
      powerCardsPlayed: {
        [p1Uid]: labelCommittedPowerOrCurse(committedPower1),
        [p2Uid]: labelCommittedPowerOrCurse(committedPower2),
      },
      powerCardIdsPlayed: { [p1Uid]: committedPower1, [p2Uid]: committedPower2 },
      powerCardTowerBlocked: { [p1Uid]: blockedPowers[p1Uid], [p2Uid]: blockedPowers[p2Uid] },
      curseClashSuppressed,
      coinFlip,
      events,
      summonedCards,
      gains,
      lustRoundFx,
      gluttonyPersistence,
      greedPersistence,
      wrathFx,
      envyRoundFx,
      slothDreamFx,
      clashDestroyedByPenalty: { ...clashDestroyedForOutcome },
      devilForcedCurseId,
      devilCurseSpin,
    };
  }

  private applyRoundResults(roomData: RoomData, players: Record<string, PlayerData>): RoomData {
    const outcome = roomData.lastOutcome!;
    const uids = Object.keys(players);
    const updatedPlayers = { ...players };
    const p1Uid = this.myUid;
    const p2Uid = uids.find(id => id !== p1Uid)!;
    const newDeck = [...roomData.deck];
    const powerDeck = [...roomData.powerDeck];
    let cardShopForRefresh: CardShopState | null | undefined = roomData.cardShop ?? undefined;
    let pendingAfterFlush: PendingCardShopPurchase[] | undefined = roomData.pendingCardShopPurchases ?? undefined;

    // Reset status and cards
    uids.forEach(uid => {
      const p = updatedPlayers[uid];
      const initialCard = outcome.initialCardsPlayed?.[uid] || outcome.cardsPlayed[uid];
      const cardIdx = p.hand.indexOf(initialCard);
      if (cardIdx !== -1) {
        p.hand.splice(cardIdx, 1);
      }
      
      const usedPower = outcome.powerCardIdsPlayed[uid];
      if (usedPower !== null) {
        const pIdx = p.powerCards.indexOf(usedPower);
        if (pIdx !== -1) p.powerCards.splice(pIdx, 1);
      }

      p.currentMove = null;
      p.currentPowerCard = null;
      p.confirmed = false;
      p.readyForNextRound = false;
      p.priestessVisionUsed = false;
      p.secretIntel = null;
    });

    // Vision power (Hierophant)
    const setVisionIntel = (pUid: string, oUid: string) => {
      if (outcome.powerCardTowerBlocked?.[pUid]) return;
      const pPower = outcome.powerCardIdsPlayed[pUid];
      if (pPower === 5) { // 5: Hierophant
        updatedPlayers[pUid].secretIntel = {
          type: 'Hierophant',
          cards: [...updatedPlayers[oUid].hand],
          powerCards: [...updatedPlayers[oUid].powerCards]
        };
      }
    };
    setVisionIntel(p1Uid, p2Uid);
    setVisionIntel(p2Uid, p1Uid);

    const winnerUid = outcome.winnerUid;
    const temperanceActive = Object.values(outcome.powerCardIdsPlayed).includes(14);
    const curseOk = roomData.settings.enableCurseCards !== false;
    const gluttonyWasActiveForRound = curseOk && gluttonyCurseActive(roomData.activeCurses);

    let nextTyrant: RoomData['tyrantCrownPending'] = roomData.tyrantCrownPending;
    let nextGreedInjected: RoomData['greedInjectedCoins'] = roomData.greedInjectedCoins;
    let outcomeForState: NonNullable<RoomData['lastOutcome']> = outcome;

    const greedPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_GREED &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_GREED &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    const pridePlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_PRIDE &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_PRIDE &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    // NOTE: Power-card post-round gains are authored in `calculateOutcome(...).gains`
    // and applied below in the generic gains pass. Keep this section side-effect free
    // to avoid duplicate grants (e.g. Chariot, Empress, Sun).

    const hostUid = roomData.hostUid;
    const guestUid = uids.find(id => id !== hostUid)!;

    /** Deck pulls from numbered draws + winner “standard”; host and guest alternate so neither eats the deck first. */
    const deckPullBudget: Record<string, number> = {};
    uids.forEach((uid) => {
      deckPullBudget[uid] = 0;
    });
    const famineBoneBudget: Record<string, number> = {};
    uids.forEach((uid) => {
      famineBoneBudget[uid] = 0;
    });
    const boneCursorByUid: Record<string, number> = {};
    uids.forEach((uid) => {
      boneCursorByUid[uid] = 0;
    });
    const nextBoneCard = (uid: string) => {
      const rank = VALUES[boneCursorByUid[uid] % VALUES.length];
      boneCursorByUid[uid] += 1;
      return `Bones-${rank}`;
    };

    // Generic outcome gains application (deck pulls aggregated into deckPullBudget and resolved below).
    uids.forEach(uid => {
      const uidGains = outcome.gains?.[uid] || [];
      uidGains.forEach(gain => {
        if (gain.type === 'card' && typeof gain.id === 'string') {
          updatedPlayers[uid].hand.push(gain.id);
        } else if (gain.type === 'power' && typeof gain.id === 'number') {
          updatedPlayers[uid].powerCards.push(gain.id);
        } else if (gain.type === 'draw') {
          if (gain.id === 'random-power') {
            if (powerDeck.length > 0) updatedPlayers[uid].powerCards.push(powerDeck.splice(0, 1)[0]);
          } else if (gain.id === 'standard') {
            deckPullBudget[uid] += 1;
          } else if (gain.id === 'famine-bone') {
            famineBoneBudget[uid] += 1;
          } else if (gain.id === 'new-card') {
            const s = SUITS[Math.floor(Math.random() * SUITS.length)];
            const v = VALUES[Math.floor(Math.random() * VALUES.length)];
            updatedPlayers[uid].hand.push(`${s}-${v}`);
          } else if (gain.id === 'world-curse') {
            const pool = shuffle([...CURSE_IDS]);
            if (pool.length > 0) updatedPlayers[uid].powerCards.push(pool[0]!);
          } else if (typeof gain.id === 'number' && gain.id > 0) {
            deckPullBudget[uid] += gain.id;
          } else if (typeof gain.id === 'number' && gain.id < 0) {
            const removeCount = Math.abs(gain.id);
            for (let i = 0; i < removeCount; i++) {
              if (updatedPlayers[uid].hand.length === 0) break;
              const randomIndex = Math.floor(Math.random() * updatedPlayers[uid].hand.length);
              updatedPlayers[uid].hand.splice(randomIndex, 1);
            }
          }
        } else if (gain.type === 'token' && typeof gain.id === 'number' && gain.id > 0) {
          updatedPlayers[uid].tokenBalance = (updatedPlayers[uid].tokenBalance ?? 0) + gain.id;
        }
      });
    });

    const turnOrder = [hostUid, guestUid];
    while ((deckPullBudget[hostUid] ?? 0) > 0 || (deckPullBudget[guestUid] ?? 0) > 0) {
      let moved = false;
      for (const uid of turnOrder) {
        if ((deckPullBudget[uid] ?? 0) <= 0) continue;
        deckPullBudget[uid] -= 1;
        if (newDeck.length > 0) {
          updatedPlayers[uid].hand.push(newDeck.shift()!);
        }
        moved = true;
        break;
      }
      if (!moved) break;
    }
    uids.forEach((uid) => {
      const count = famineBoneBudget[uid] ?? 0;
      for (let i = 0; i < count; i++) {
        updatedPlayers[uid].hand.push(nextBoneCard(uid));
      }
    });

    const slothDreamEnds =
      curseOk &&
      outcome.slothDreamFx?.result === 'SUN' &&
      slothCurseActive(roomData.activeCurses ?? []);

    let availableSuits = [...(roomData.availableSuits || SUITS)];
    if (slothDreamEnds) {
      const saved = roomData.slothSavedAvailableSuits;
      availableSuits = saved && saved.length > 0 ? [...saved] : [...SUITS];
    }

    uids.forEach((uid) => {
      const power = outcome.powerCardIdsPlayed[uid];
      if (power === 17 && !availableSuits.includes('Stars')) {
        availableSuits.push('Stars');
      }
      if (power === 18 && !availableSuits.includes('Moons')) {
        availableSuits.push('Moons');
        const moonCards = VALUES.map((v) => `Moons-${v}`);
        newDeck.push(...moonCards);
      }
    });

    if (greedPlayed) {
      const coinCards = VALUES.map((v) => `Coins-${v}`);
      nextGreedInjected = coinCards;
      newDeck.push(...shuffle([...coinCards]));
    }

    if (newDeck.length > roomData.deck.length) {
      // If we added cards, reshuffle
      const shuffledDeck = shuffle(newDeck);
      newDeck.length = 0;
      newDeck.push(...shuffledDeck);
    }

    if (temperanceActive || gluttonyWasActiveForRound) {
      uids.forEach((uid) => {
        const lockedId = outcome.initialCardsPlayed?.[uid];
        const finalId = outcome.cardsPlayed[uid];
        if (!finalId && !lockedId) return;

        const heartEngaged =
          lockedId != null ? parseCard(lockedId).suit === 'Hearts' : parseCard(finalId!).suit === 'Hearts';
        const digest =
          gluttonyWasActiveForRound && heartEngaged && finalId != null && !parseCard(finalId).isJoker;
        const boneFromDigest =
          digest && typeof finalId === 'string' ? `Bones-${parseCard(finalId).value}` : null;

        const alreadyFromGains =
          boneFromDigest != null &&
          (outcome.gains?.[uid] ?? []).some((g) => g.type === 'card' && g.id === boneFromDigest);

        if (alreadyFromGains) {
          return;
        }

        if (temperanceActive) {
          if (digest && boneFromDigest) {
            updatedPlayers[uid].hand.push(boneFromDigest);
          } else {
            updatedPlayers[uid].hand.push(finalId!);
          }
        } else if (digest && boneFromDigest) {
          updatedPlayers[uid].hand.push(boneFromDigest);
        }
      });
    }

    let famineActive = roomData.famineActive || false;
    if (!famineActive && newDeck.length === 0) {
      famineActive = true;
      const diff = updatedPlayers[p1Uid].hand.length - updatedPlayers[p2Uid].hand.length;
      if (diff !== 0) {
        const targetUid = diff < 0 ? p1Uid : p2Uid;
        const needed = Math.abs(diff);
        for (let i = 0; i < needed; i++) {
          updatedPlayers[targetUid].hand.push(nextBoneCard(targetUid));
        }
      }
    }

    if (curseOk && nextTyrant && winnerUid !== 'draw') {
      updatedPlayers[winnerUid].hand.push('Crowns-E');
      nextTyrant = undefined;
    }

    let nextActiveCurses: ActiveCurseState[] = curseOk ? [...(roomData.activeCurses ?? [])] : [];
    const hadCurseEnteringApply = curseOk && curseEffectActive(roomData.activeCurses ?? []);
    let nextSlothSaved: Suit[] | null | undefined = roomData.slothSavedAvailableSuits ?? null;
    let nextEnvySealed = mergeEnvySealDeltas(roomData.envySealedCards, outcome.envyRoundFx?.newSeals);
    if (outcome.envyRoundFx?.defeated || outcome.envyRoundFx?.departedDoubleGrovel) {
      nextEnvySealed = {};
    }

    const lustPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_LUST &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_LUST &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));
    if (lustPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_LUST);
      if (ix < 0) nextActiveCurses.push({ id: CURSE_LUST, lustAccumulated: 0 });
    }

    const gluttonyPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_GLUTTONY &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_GLUTTONY &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));
    if (gluttonyPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_GLUTTONY);
      const fresh: ActiveCurseState = { id: CURSE_GLUTTONY, gluttonyPhase: 0, gluttonyNoHeartStreak: 0 };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }
    if (greedPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_GREED);
      const fresh: ActiveCurseState = { id: CURSE_GREED, greedCrown: 0 };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }
    if (pridePlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_PRIDE);
      const fresh: ActiveCurseState = { id: CURSE_PRIDE };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }

    const envyPlayed =
      curseOk &&
      ((cursePlayedActivatesEnvyTable(outcome.powerCardIdsPlayed[p1Uid]) &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (cursePlayedActivatesEnvyTable(outcome.powerCardIdsPlayed[p2Uid]) &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    if (envyPlayed) {
      nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_ENVY);
      nextActiveCurses.push({ id: CURSE_ENVY, envyMonsterHp: ENVY_MONSTER_START_HP });
    }

    if (curseOk && outcome.slothDreamFx?.result === 'SUN' && slothCurseActive(roomData.activeCurses ?? [])) {
      nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_SLOTH);
      nextSlothSaved = null;
    }

    const slothPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_SLOTH &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_SLOTH &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    if (slothPlayed) {
      const hadSlothAtStart = slothCurseActive(roomData.activeCurses ?? []);
      const dreamSunEnded = outcome.slothDreamFx?.result === 'SUN';
      if (!hadSlothAtStart || dreamSunEnded) {
        nextSlothSaved = [...availableSuits];
      }
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_SLOTH);
      const fresh: ActiveCurseState = { id: CURSE_SLOTH };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }

    const wrathWasActiveAtStart = curseOk && wrathCurseActive(roomData.activeCurses);
    const wrathRoundAtStart = roomData.activeCurses?.find((c) => c.id === CURSE_WRATH)?.wrathRound ?? 1;

    const wrathPlayed =
      curseOk &&
      ((outcome.powerCardIdsPlayed[p1Uid] === CURSE_WRATH &&
        !outcome.powerCardTowerBlocked?.[p1Uid] &&
        !outcome.curseClashSuppressed?.[p1Uid]) ||
        (outcome.powerCardIdsPlayed[p2Uid] === CURSE_WRATH &&
          !outcome.powerCardTowerBlocked?.[p2Uid] &&
          !outcome.curseClashSuppressed?.[p2Uid]));

    if (wrathPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_WRATH);
      const fresh: ActiveCurseState = { id: CURSE_WRATH, wrathRound: 1 };
      if (ix >= 0) nextActiveCurses[ix] = fresh;
      else nextActiveCurses.push(fresh);
    }

    if (wrathWasActiveAtStart && !wrathPlayed) {
      const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_WRATH);
      if (ix >= 0) {
        if (wrathRoundAtStart >= 5) {
          nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_WRATH);
          outcomeForState = {
            ...outcomeForState,
            events: [
              ...outcomeForState.events,
              {
                type: 'POWER_TRIGGER',
                message: 'Wrath ends — the Warlord was the last stroke.',
              },
            ],
          };
        } else {
          nextActiveCurses[ix] = {
            ...nextActiveCurses[ix],
            wrathRound: wrathRoundAtStart + 1,
          };
        }
      }
    }

    const prideEndedByGrovel =
      curseOk &&
      prideCurseActive(roomData.activeCurses) &&
      (outcome.cardsPlayed[p1Uid] === GROVEL_CARD_ID || outcome.cardsPlayed[p2Uid] === GROVEL_CARD_ID);
    if (prideEndedByGrovel) {
      nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_PRIDE);
      uids.forEach((uid) => {
        updatedPlayers[uid].hand = updatedPlayers[uid].hand.filter((c) => c !== GROVEL_CARD_ID);
      });
      outcomeForState = {
        ...outcomeForState,
        events: [
          ...outcomeForState.events,
          { type: 'POWER_TRIGGER', message: 'Pride ends — someone groveled.' },
        ],
      };
    }

    if (curseOk && outcome.gluttonyPersistence) {
      if (outcome.gluttonyPersistence.remove) {
        nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_GLUTTONY);
      } else {
        const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_GLUTTONY);
        if (ix >= 0) {
          nextActiveCurses[ix] = {
            ...nextActiveCurses[ix],
            gluttonyPhase: outcome.gluttonyPersistence.phase,
            gluttonyNoHeartStreak: outcome.gluttonyPersistence.streak,
          };
        }
      }
    }

    if (curseOk && outcome.lustRoundFx) {
      const { nextMeter, sated, heartsExhausted } = outcome.lustRoundFx;
      if (sated || heartsExhausted) {
        nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_LUST);
      } else {
        const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_LUST);
        if (ix >= 0) {
          nextActiveCurses[ix] = { ...nextActiveCurses[ix], lustAccumulated: nextMeter };
        } else if (lustCurseActive(roomData.activeCurses ?? []) || lustPlayed) {
          nextActiveCurses.push({ id: CURSE_LUST, lustAccumulated: nextMeter });
        }
      }
    }

    if (curseOk && outcome.envyRoundFx && envyCurseActive(nextActiveCurses)) {
      const fx = outcome.envyRoundFx;
      if (fx.defeated || fx.departedDoubleGrovel) {
        nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_ENVY);
      } else {
        const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_ENVY);
        if (ix >= 0) {
          nextActiveCurses[ix] = { ...nextActiveCurses[ix], envyMonsterHp: fx.monsterHpEnd };
        }
      }
    }

    if (curseOk && outcome.devilForcedCurseId !== undefined && !hadCurseEnteringApply) {
      const cid = outcome.devilForcedCurseId;
      const layer = createFreshCurseState(cid);
      const ixC =
        cid === CURSE_ENVY || cid === CURSE_GREEN_EYED_MONSTER
          ? nextActiveCurses.findIndex((c) => c.id === CURSE_ENVY)
          : nextActiveCurses.findIndex((c) => c.id === cid);
      if (ixC >= 0) nextActiveCurses[ixC] = layer;
      else nextActiveCurses.push(layer);

      if (cid === CURSE_GREED && (!nextGreedInjected || nextGreedInjected.length === 0)) {
        const coinCards = VALUES.map((v) => `Coins-${v}`);
        nextGreedInjected = coinCards;
        newDeck.push(...shuffle([...coinCards]));
        const rd = shuffle(newDeck);
        newDeck.length = 0;
        newDeck.push(...rd);
      }

      if (cid === CURSE_SLOTH && !slothCurseActive(roomData.activeCurses ?? [])) {
        nextSlothSaved = [...availableSuits];
        availableSuits = ['Stars', 'Moons'];
      }
    }

    const stripGreedInjectedFromDeck = () => {
      if (!nextGreedInjected?.length) return;
      const rm = new Set(nextGreedInjected);
      const filtered = newDeck.filter((c) => !rm.has(c));
      newDeck.length = 0;
      newDeck.push(...filtered);
      nextGreedInjected = undefined;
    };

    const finishGreedCurse = (crownTotal: number) => {
      nextActiveCurses = nextActiveCurses.filter((c) => c.id !== CURSE_GREED);
      stripGreedInjectedFromDeck();
      if (winnerUid === 'draw') {
        nextTyrant = { crownTotal };
      } else {
        updatedPlayers[winnerUid].hand.push('Crowns-E');
      }
    };

    if (curseOk && outcome.greedPersistence && greedCurseActive(roomData.activeCurses)) {
      if (outcome.greedPersistence.removeReason !== 'crown') {
        const ix = nextActiveCurses.findIndex((c) => c.id === CURSE_GREED);
        if (ix >= 0) {
          nextActiveCurses[ix] = { ...nextActiveCurses[ix], greedCrown: outcome.greedPersistence.nextCrown };
        }
      }
    }

    if (
      curseOk &&
      outcome.greedPersistence?.removeReason === 'crown' &&
      greedCurseActive(roomData.activeCurses)
    ) {
      finishGreedCurse(outcome.greedPersistence.nextCrown);
    }

    if (
      roomData.settings.enablePokerChips === true &&
      roomData.settings.cardShopConflictMode === 'coin_flip' &&
      cardShopForRefresh &&
      pendingAfterFlush &&
      pendingAfterFlush.length > 0
    ) {
      const flush = this.flushCoinFlipShopPurchases({
        completingTurn: roomData.currentTurn,
        players: updatedPlayers,
        cardShop: cardShopForRefresh,
        pendingAll: pendingAfterFlush,
      });
      cardShopForRefresh = flush.cardShop;
      pendingAfterFlush = flush.pendingRemaining;
      outcomeForState = {
        ...outcomeForState,
        events: [...(outcomeForState.events ?? []), ...flush.extraEvents],
      };
    }

    if (curseOk && greedCurseActive(nextActiveCurses) && outcome.greedPersistence?.removeReason !== 'crown') {
      let diamCoin = 0;
      for (const c of newDeck) {
        const p = parseCard(c);
        if (!p.isJoker && (p.suit === 'Diamonds' || p.suit === 'Coins')) diamCoin += 1;
      }
      for (const uid of uids) {
        for (const c of updatedPlayers[uid].hand) {
          const p = parseCard(c);
          if (!p.isJoker && (p.suit === 'Diamonds' || p.suit === 'Coins')) diamCoin += 1;
        }
      }
      if (diamCoin === 0) {
        const entry = nextActiveCurses.find((c) => c.id === CURSE_GREED);
        finishGreedCurse(entry?.greedCrown ?? 0);
        outcomeForState = {
          ...outcome,
          events: [
            ...outcome.events,
            { type: 'POWER_TRIGGER', message: 'The Tyrant is dead. Only their crown remains.' },
          ],
        };
      }
    }

    if (curseOk && slothCurseActive(nextActiveCurses)) {
      availableSuits = ['Stars', 'Moons'];
    }

    const lustForWheel = curseOk && lustCurseActive(nextActiveCurses);
    const greedForWheel = curseOk && greedCurseActive(nextActiveCurses);
    const suitWeights = availableSuits.map((s) => {
      let w = s === 'Hearts' && lustForWheel ? 3 : 1;
      if (greedForWheel && (s === 'Hearts' || s === 'Clubs' || s === 'Spades')) {
        w *= 0.5;
      }
      return w;
    });
    const totalW = suitWeights.reduce((a, b) => a + b, 0) || 1;
    const wheelOffset = Math.random();
    const r = wheelOffset * totalW;
    let accPick = 0;
    let targetSuit = availableSuits[availableSuits.length - 1];
    for (let i = 0; i < availableSuits.length; i++) {
      accPick += suitWeights[i];
      if (r < accPick) {
        targetSuit = availableSuits[i];
        break;
      }
    }

    let nextPrideCeiling: string | null = null;
    if (curseOk && prideCurseActive(nextActiveCurses)) {
      const rank = VALUES[Math.floor(Math.random() * VALUES.length)];
      nextPrideCeiling = `${targetSuit}-${rank}`;
    }

    if (!curseOk || (!prideCurseActive(nextActiveCurses) && !envyCurseActive(nextActiveCurses))) {
      uids.forEach((uid) => {
        updatedPlayers[uid].hand = updatedPlayers[uid].hand.filter((c) => c !== GROVEL_CARD_ID);
      });
    } else if (nextPrideCeiling) {
      const lustNext = curseOk && lustCurseActive(nextActiveCurses);
      const greedNext = curseOk && greedCurseActive(nextActiveCurses);
      for (const uid of uids) {
        const hand = updatedPlayers[uid].hand;
        if (hand.includes(GROVEL_CARD_ID)) continue;
        if (!handHasLegalPridePlay(hand, nextPrideCeiling, lustNext, greedNext)) {
          updatedPlayers[uid].hand = [...hand, GROVEL_CARD_ID];
        }
      }
    }

    let nextEnvyBothTrap = false;
    if (curseOk && envyCurseActive(nextActiveCurses)) {
      const lustNext = curseOk && lustCurseActive(nextActiveCurses);
      const greedNext = curseOk && greedCurseActive(nextActiveCurses);
      const p1Trap = !handHasLegalEnvyPlay(updatedPlayers[p1Uid].hand, p1Uid, nextEnvySealed);
      const p2Trap = !handHasLegalEnvyPlay(updatedPlayers[p2Uid].hand, p2Uid, nextEnvySealed);
      for (const uid of uids) {
        const hand = updatedPlayers[uid].hand;
        if (hand.includes(GROVEL_CARD_ID)) continue;
        if (!handHasLegalEnvyPlay(hand, uid, nextEnvySealed)) {
          updatedPlayers[uid].hand = [...hand, GROVEL_CARD_ID];
        }
      }
      nextEnvyBothTrap = p1Trap && p2Trap;
    }

    let nextEnvyCovet: RoomData['envyCovet'] = null;
    if (curseOk && envyCurseActive(nextActiveCurses)) {
      const lustNext = curseOk && lustCurseActive(nextActiveCurses);
      const greedNext = curseOk && greedCurseActive(nextActiveCurses);
      const jointNext = greedNext && targetSuit === 'Diamonds';
      nextEnvyCovet = pickEnvyCovetedForRound(
        updatedPlayers,
        p1Uid,
        p2Uid,
        targetSuit,
        nextEnvySealed,
        lustNext,
        greedNext,
        jointNext,
      );
    }

    let nextWrathTarget: string | null = null;
    let nextWrathMinion: string | null = null;
    if (curseOk && wrathCurseActive(nextActiveCurses)) {
      const wrathEntry = nextActiveCurses.find((c) => c.id === CURSE_WRATH);
      const kr = wrathEntry?.wrathRound ?? 1;
      nextWrathMinion = wrathMinionCardForRound(kr);
      nextWrathTarget = Math.random() > 0.5 ? hostUid : guestUid;
    }

    const nextStatus = (updatedPlayers[p1Uid].hand.length === 0 || updatedPlayers[p2Uid].hand.length === 0) ? 'finished' : 'playing';
    let winner = roomData.winner;
    if (nextStatus === 'finished' && !winner) {
      if (updatedPlayers[p1Uid].hand.length === 0 && updatedPlayers[p2Uid].hand.length > 0) winner = p2Uid;
      else if (updatedPlayers[p2Uid].hand.length === 0 && updatedPlayers[p1Uid].hand.length > 0) winner = p1Uid;
      else if (updatedPlayers[p1Uid].hand.length === 0 && updatedPlayers[p2Uid].hand.length === 0 && outcome.winnerUid !== 'draw') winner = outcome.winnerUid;
    }

    if (
      nextStatus === 'finished' &&
      roomData.settings.enablePokerChips === true &&
      roomData.settings.cardShopConflictMode === 'coin_flip' &&
      pendingAfterFlush &&
      pendingAfterFlush.length > 0
    ) {
      const refundEv: ResolutionEvent[] = [];
      for (const p of pendingAfterFlush) {
        const pl = updatedPlayers[p.uid];
        if (!pl) continue;
        const pk = shopPackCardId(p.slotId);
        const ix = pl.hand.indexOf(pk);
        if (ix !== -1) pl.hand.splice(ix, 1);
        pl.tokenBalance = (pl.tokenBalance ?? 0) + p.tokensPaid;
        const label =
          cardShopForRefresh?.slots[p.slotId]?.offer != null
            ? describeShopOfferLine(cardShopForRefresh.slots[p.slotId]!.offer)
            : p.slotId;
        refundEv.push({
          type: 'COIN_FLIP',
          message: `${pl.name}'s pending Cash Chips pack (${label}) — match ended; refunded ${p.tokensPaid} tokens.`,
        });
      }
      pendingAfterFlush = [];
      outcomeForState = {
        ...outcomeForState,
        events: [...(outcomeForState.events ?? []), ...refundEv],
      };
    }

    const chipsOn = roomData.settings.enablePokerChips === true;

    return {
      ...roomData,
      players: updatedPlayers,
      lastOutcome: outcomeForState,
      status: nextStatus,
      winner,
      currentTurn: roomData.currentTurn + 1,
      targetSuit,
      availableSuits,
      wheelOffset,
      deck: newDeck,
      powerDeck,
      pendingPowerDecisions: {},
      engageMoves: null,
      awaitingPowerShowdown: false,
      famineActive,
      activeCurses: curseOk ? nextActiveCurses : [],
      tyrantCrownPending: nextTyrant,
      greedInjectedCoins: nextGreedInjected,
      prideCeilingCard: nextPrideCeiling,
      wrathTargetUid: curseOk ? nextWrathTarget : null,
      wrathMinionCard: curseOk ? nextWrathMinion : null,
      envySealedCards: curseOk ? nextEnvySealed : {},
      envyCovet: curseOk ? nextEnvyCovet : null,
      envyBothGrovelTrap: curseOk ? nextEnvyBothTrap : false,
      slothSavedAvailableSuits: curseOk ? nextSlothSaved ?? null : null,
      ...(chipsOn
        ? {
            shopBrowsingUid: null,
            cardShopBrowsersUids: [],
            shopRemoteCursor: null,
            pendingCardShopPurchases:
              roomData.settings.cardShopConflictMode === 'coin_flip' ? pendingAfterFlush ?? [] : undefined,
            ...(cardShopForRefresh ? { cardShop: refreshDiscountSlot(cardShopForRefresh) } : {}),
          }
        : {}),
      updatedAt: Date.now()
    };
  }

  destroy() {
    this.clearShopCursorPipeline();
    if (this.powerShowdownClearTimer) {
      clearTimeout(this.powerShowdownClearTimer);
      this.powerShowdownClearTimer = null;
    }
    if (this.powerResolutionTimer) {
      clearTimeout(this.powerResolutionTimer);
      this.powerResolutionTimer = null;
    }
    if (this.connection) this.connection.close();
    if (this.peer) this.peer.destroy();
  }
}

export const gameService = new GameService();
