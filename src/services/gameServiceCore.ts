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
  type OutcomeGainItem,
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
import { appendCardMutation } from './cardMutation';
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

export function samePlayingHandMultiset(a: readonly string[], b: readonly string[]): boolean {
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

export function sentenceCard(cardStr: string): string {
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

export function isOnTargetField(cardStr: string, targetSuit: Suit, greedJointDiamondsCoins = false): boolean {
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

export function computeOverkillTokenAward(params: {
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

/**
 * Panic chips **effective** opponent stamina (and stacks with Wrath on that baseline). This is not a
 * CardMutation (`cardMutation.ts`) identity change — opponent `cardsPlayed` id stays the same unless something
 * else transforms it. See that module’s doc for the identity vs clash-modifier split.
 */
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

function stripChariotEchoLines(
  list: OutcomeGain[],
  echoSuitId: string | undefined,
  echoPowerId: number | null | undefined,
): OutcomeGain[] {
  return list.filter((g) => {
    const flagged = Boolean((g as { fromChariot?: boolean }).fromChariot);
    if (!flagged) return true;
    if (g.type === 'card' && echoSuitId && g.id === echoSuitId) return false;
    if (g.type === 'power' && echoPowerId != null && g.id === echoPowerId) return false;
    return true;
  });
}

/** Chariot (7): losing seat echoes the winner’s committed suit + power (Tower still blocks *their* major). */
function chariotEchoGainLines(params: {
  loserUid: string | null;
  winnerUid: string | 'draw';
  snap: Pick<
    NonNullable<RoomData['lastOutcome']>,
    'initialCardsPlayed' | 'cardsPlayed' | 'powerCardIdsPlayed' | 'powerCardTowerBlocked'
  >;
}): OutcomeGain[] {
  const { loserUid, winnerUid, snap } = params;
  if (winnerUid === 'draw' || !loserUid) return [];
  if (snap.powerCardIdsPlayed[loserUid] !== 7 || snap.powerCardTowerBlocked?.[loserUid]) return [];
  const w = winnerUid as string;
  const suitEcho = snap.initialCardsPlayed[w] ?? snap.cardsPlayed[w];
  const majEcho = snap.powerCardIdsPlayed[w];
  const out: OutcomeGain[] = [];
  if (typeof suitEcho === 'string' && suitEcho.trim()) {
    out.push({ type: 'card', id: suitEcho, fromChariot: true });
  }
  if (majEcho != null && typeof majEcho === 'number' && !snap.powerCardTowerBlocked?.[w]) {
    out.push({ type: 'power', id: majEcho, fromChariot: true });
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
  const oldWinnerUid =
    prevOutcome.winnerUid === 'draw' ? null : (prevOutcome.winnerUid as string);
  if (
    oldLoserUid &&
    oldWinnerUid &&
    prevOutcome.powerCardIdsPlayed[oldLoserUid] === 7 &&
    !prevOutcome.powerCardTowerBlocked?.[oldLoserUid]
  ) {
    const echoSuit = prevOutcome.initialCardsPlayed[oldWinnerUid] ?? prevOutcome.cardsPlayed[oldWinnerUid];
    const echoPow = prevOutcome.powerCardIdsPlayed[oldWinnerUid];
    gains[oldLoserUid] = stripChariotEchoLines(gains[oldLoserUid], echoSuit, echoPow ?? null);
  }
  const oldMag = magicianPatch(oldLoserUid, prevOutcome.winnerUid);
  if (oldMag) {
    gains[oldMag] = gains[oldMag].filter((g) => !(g.type === 'draw' && g.id === 1));
  }

  for (const line of chariotEchoGainLines({ loserUid: newLoser, winnerUid: nextWinner, snap: prevOutcome })) {
    gains[newLoser].push(line);
  }
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
  if (!winningCardStr || !losingCardStr) {
    return 'Panic clash rewrote this trick — outcome updated.';
  }
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

export function labelCommittedPowerOrCurse(id: number | null): string {
  if (id === null) return 'None';
  if (isCurseCardId(id)) return CURSES[id]?.name ?? 'Curse';
  return MAJOR_ARCANA[id]?.name ?? `Power ${id}`;
}

export type GameEvent = 
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
  | { type: 'REQUEST_STATE_SYNC'; uid: string }
  | { type: 'SACRIFICIAL_BOWL_BURN'; uid: string; handIndex: number };

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

export function rollFairD6(): number {
  return 1 + Math.floor(Math.random() * 6);
}

/** `true` ⇒ “first contender” wins (~50%); matches legacy `Math.random() > 0.5`-style halves. */
export function fairHalfFromD6(d: number): boolean {
  return d <= 3;
}

export const normalizeGameSettings = (raw: Partial<GameSettings> | GameSettings): GameSettings =>
  normalizeLobbyGameSettings(raw);

export const loadSettings = (): GameSettings => loadPersistedLobbySettings(STORAGE_KEY);

export const saveSettings = (settings: GameSettings) => persistLobbyDefaults(STORAGE_KEY, settings);

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

export function calculateRoundOutcome(
  p1Uid: string,
  roomData: RoomData,
  players: Record<string, PlayerData>,
): NonNullable<RoomData['lastOutcome']> {
    const uids = Object.keys(players);
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

    const gains: Record<string, OutcomeGainItem[]> = {
      [p1Uid]: [],
      [p2Uid]: [],
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
        appendCardMutation(priestessFront, {
          kind: 'swap_seat_card',
          uid,
          cardId: finalCard,
          message: `${players[uid].name} swaps their played suit card before the flop.`,
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
        appendCardMutation(events, {
          kind: 'transform',
          uid: oppUid,
          fromCardId: targetCard,
          toCardId: frogged,
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
        appendCardMutation(events, { kind: 'swap_both_committed', message: `Cards have been swapped!` });
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
          appendCardMutation(events, {
            kind: 'transform',
            uid,
            fromCardId: fromCard,
            toCardId: next,
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
          appendCardMutation(events, {
            kind: 'empower',
            uid: p1Uid,
            fromCardId: fromCard,
            toCardId: c1,
            message: `${players[p1Uid].name}'s card upgraded to target suit!`,
          });
        } else {
          const fromCard = c2;
          const stepped = bumpPlayingCardRank(c2, 2);
          c2 = parseCard(stepped).isJoker ? c2 : `${targetSuit}-${parseCard(stepped).value}`;
          appendCardMutation(events, {
            kind: 'empower',
            uid: p2Uid,
            fromCardId: fromCard,
            toCardId: c2,
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
          appendCardMutation(events, {
            kind: 'empower',
            uid: p1Uid,
            fromCardId: fromCard,
            toCardId: c1,
            message: `${players[p1Uid].name}'s card value increased!`,
          });
        } else {
          const pc = parseCard(c2);
          const fromCard = c2;
          c2 = pc.isJoker ? c2 : bumpPlayingCardRank(c2, 4);
          appendCardMutation(events, {
            kind: 'empower',
            uid: p2Uid,
            fromCardId: fromCard,
            toCardId: c2,
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
        appendCardMutation(events, {
          kind: 'transform',
          uid: p1Uid,
          fromCardId: fromCard,
          toCardId: c1,
          powerCardId: 17,
          message: `${players[p1Uid].name}'s card became a Star!`,
        });
      }
      if (!pc2.isJoker && pc2.suit !== 'Stars') {
        const fromCard = c2;
        c2 = `Stars-${pc2.value}`;
        appendCardMutation(events, {
          kind: 'transform',
          uid: p2Uid,
          fromCardId: fromCard,
          toCardId: c2,
          powerCardId: 17,
          message: `${players[p2Uid].name}'s card became a Star!`,
        });
      }
    }

    const greedJointTrump = greedWasActive && targetSuit === 'Diamonds';

    /**
     * Wrath applies a **clash penalty** to the marked seat’s printed play — it does **not** rewrite
     * `cardsPlayed` to a weaker card id (contrast `CardMutation` in `cardMutation.ts`). Consumers must pass
     * `wp1`/`wp2` into `evaluateTrickClash` (and kin); do not infer stamina from the string alone.
     * Rationale and future-unification notes: `cardMutation.ts`.
     */
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
            appendCardMutation(events, {
              kind: 'swap_seat_card',
              uid: p1Uid,
              cardId: c1,
              message: `${players[p1Uid].name} swapped to ${compactCardLabel(c1)}.`,
            });
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
            appendCardMutation(events, {
              kind: 'swap_seat_card',
              uid: p2Uid,
              cardId: c2,
              message: `${players[p2Uid].name} swapped to ${compactCardLabel(c2)}.`,
            });
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
            appendCardMutation(events, {
              kind: 'empower',
              uid,
              fromCardId: cur,
              toCardId: bumped,
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
          gains[p1Uid].push({ type: 'card', id: c2, fromChariot: true });
          if (committedPower2 !== null && !blockedPowers[p2Uid]) {
            gains[p1Uid].push({ type: 'power', id: committedPower2, fromChariot: true });
          }
          events.push({
            type: 'POWER_TRIGGER',
            uid: p1Uid,
            powerCardId: 7,
            message: `${players[p1Uid].name}'s Chariot echoes ${players[p2Uid].name}'s play into their hand.`,
          });
        }
        if (power2 === 7 && winnerUid === p1Uid) {
          gains[p2Uid].push({ type: 'card', id: c1, fromChariot: true });
          if (committedPower1 !== null && !blockedPowers[p1Uid]) {
            gains[p2Uid].push({ type: 'power', id: committedPower1, fromChariot: true });
          }
          events.push({
            type: 'POWER_TRIGGER',
            uid: p2Uid,
            powerCardId: 7,
            message: `${players[p2Uid].name}'s Chariot echoes ${players[p1Uid].name}'s play into their hand.`,
          });
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
        appendCardMutation(events, {
          kind: 'transform',
          uid,
          fromCardId: prev,
          toCardId: next,
          powerCardId: 17,
          message: `${players[uid].name}'s card became a Star!`,
        });
      };
      const pushMoon = (uid: string, prev: string, next: string) => {
        if (prev === next) return;
        appendCardMutation(events, {
          kind: 'transform',
          uid,
          fromCardId: prev,
          toCardId: next,
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
    const clashEffForOverkillUi = (uid: string, card: string): number => {
      const pc = parseCard(card);
      if (pc.isJoker) return 0;
      if (!isOnTargetField(card, targetSuit, greedJointTrump)) return 0;
      const lh = lhToken(card);
      const raw = getCardValue(card, lh, greedTaxActive);
      const pen = wrathPen(card, uid);
      return Math.max(0, raw - pen);
    };
    const overkillV1 = clashEffForOverkillUi(p1Uid, c1);
    const overkillV2 = clashEffForOverkillUi(p2Uid, c2);
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
      const winnerVal = uid === p1Uid ? overkillV1 : overkillV2;
      const loserVal = uid === p1Uid ? overkillV2 : overkillV1;
      events.push({
        type: 'POWER_TRIGGER',
        uid,
        message: `${players[uid].name} gains ${n} token${n === 1 ? '' : 's'} (overkill).`,
        tokenOverkillDetail: { winnerVal, loserVal, tokens: n },
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