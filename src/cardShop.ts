import { CURSE_IDS } from './curses';
import type { CardShopOffer, CardShopSlot, CardShopState } from './types';
import { VALUES } from './types';

const MAIN_SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'] as const;
const DISCOUNT_SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades', 'Stars', 'Moons'] as const;

function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function rankTokenValue(value: string): number {
  if (value === 'J') return 11;
  if (value === 'Q') return 12;
  if (value === 'K') return 13;
  if (value === 'A') return 14;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 10;
}

/** Suit / standard playing-card lines only (no Crowns special ranks here). */
export function suitCardTokenPrice(cardId: string): number {
  const dash = cardId.indexOf('-');
  const value = dash >= 0 ? cardId.slice(dash + 1) : '';
  return 2 * rankTokenValue(value);
}

export function baseOfferPrice(offer: CardShopOffer): number {
  switch (offer.type) {
    case 'curse':
      return 40;
    case 'major':
      return 60;
    case 'joker':
      return 50;
    case 'suit':
      return suitCardTokenPrice(offer.cardId);
    default:
      return 0;
  }
}

export function slotChargeTokens(slot: CardShopSlot): number {
  const base = baseOfferPrice(slot.offer);
  const pct = slot.discountPercent ?? 0;
  if (pct <= 0) return base;
  return Math.max(1, Math.ceil(base * (1 - pct / 100)));
}

function rollDiscountOffer(): CardShopOffer {
  const r = Math.random();
  if (r < 0.28) {
    const pool = shuffle([...CURSE_IDS]);
    return { type: 'curse', curseId: pool[0]! };
  }
  if (r < 0.52) {
    return { type: 'major', powerId: Math.floor(Math.random() * 22) };
  }
  if (r < 0.64) {
    return { type: 'joker', cardId: Math.random() < 0.5 ? 'Joker-1' : 'Joker-2' };
  }
  const suit = DISCOUNT_SUITS[Math.floor(Math.random() * DISCOUNT_SUITS.length)]!;
  const value = VALUES[Math.floor(Math.random() * VALUES.length)]!;
  return { type: 'suit', cardId: `${suit}-${value}` };
}

export function createInitialCardShop(): CardShopState {
  const majors = shuffle(Array.from({ length: 22 }, (_, i) => i));
  const cursePick = shuffle([...CURSE_IDS])[0]!;
  const jokerId = Math.random() < 0.5 ? 'Joker-1' : 'Joker-2';

  const slots: Record<string, CardShopSlot> = {
    curse_random: { id: 'curse_random', soldOut: false, offer: { type: 'curse', curseId: cursePick } },
    pow_a: { id: 'pow_a', soldOut: false, offer: { type: 'major', powerId: majors[0]! } },
    pow_b: { id: 'pow_b', soldOut: false, offer: { type: 'major', powerId: majors[1]! } },
    joker: { id: 'joker', soldOut: false, offer: { type: 'joker', cardId: jokerId } },
    discount: { id: 'discount', soldOut: false, discountPercent: 25, offer: rollDiscountOffer() },
  };

  for (const s of MAIN_SUITS) {
    slots[`ace_${s}`] = {
      id: `ace_${s}`,
      soldOut: false,
      offer: { type: 'suit', cardId: `${s}-A` },
    };
    slots[`two_${s}`] = {
      id: `two_${s}`,
      soldOut: false,
      offer: { type: 'suit', cardId: `${s}-2` },
    };
  }

  return { slots };
}

/** New random discount offer each round; clears sold-out on that slot only. */
export function refreshDiscountSlot(state: CardShopState): CardShopState {
  const disc = state.slots.discount;
  if (!disc) return state;
  return {
    ...state,
    slots: {
      ...state.slots,
      discount: {
        ...disc,
        soldOut: false,
        offer: rollDiscountOffer(),
      },
    },
  };
}
