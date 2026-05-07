import type {
  CardShopOffer,
  CardShopSlot,
  CardShopState,
  PlayerData,
  RoomData,
  ShopRemoteCursorState,
  Suit,
} from '../types';
import { SUITS } from '../types';
import { normalizeGameSettings } from './normalizeGameSettings';

function ensureArray<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

function sanitizeCardShopOffer(o: unknown): CardShopOffer | null {
  if (!o || typeof o !== 'object') return null;
  const t = (o as { type?: string }).type;
  if (t === 'curse') {
    const id = (o as { curseId?: unknown }).curseId;
    return typeof id === 'number' && Number.isFinite(id) ? { type: 'curse', curseId: id } : null;
  }
  if (t === 'major') {
    const id = (o as { powerId?: unknown }).powerId;
    return typeof id === 'number' && Number.isFinite(id) ? { type: 'major', powerId: id } : null;
  }
  if (t === 'joker') {
    const cardId = (o as { cardId?: unknown }).cardId;
    return typeof cardId === 'string' && cardId ? { type: 'joker', cardId } : null;
  }
  if (t === 'suit') {
    const cardId = (o as { cardId?: unknown }).cardId;
    return typeof cardId === 'string' && cardId ? { type: 'suit', cardId } : null;
  }
  return null;
}

function sanitizeCardShopSlot(val: unknown, key: string): CardShopSlot | null {
  if (!val || typeof val !== 'object') return null;
  const rec = val as {
    id?: unknown;
    soldOut?: unknown;
    discountPercent?: unknown;
    offer?: unknown;
  };
  const id = typeof rec.id === 'string' && rec.id ? rec.id : key;
  const offer = sanitizeCardShopOffer(rec.offer);
  if (!offer) return null;
  const soldOut = Boolean(rec.soldOut);
  const slot: CardShopSlot = { id, soldOut, offer };
  const dp = rec.discountPercent;
  if (typeof dp === 'number' && Number.isFinite(dp)) slot.discountPercent = dp;
  return slot;
}

/** Preserve valid shop slots; drop malformed entries so UI never indexes invalid offers. */
function sanitizeCardShop(raw: RoomData['cardShop']): RoomData['cardShop'] {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw !== 'object' || raw === null) return null;
  const slotsIn = (raw as { slots?: unknown }).slots;
  if (!slotsIn || typeof slotsIn !== 'object') return null;
  const slots: Record<string, CardShopSlot> = {};
  for (const [key, val] of Object.entries(slotsIn as Record<string, unknown>)) {
    const slot = sanitizeCardShopSlot(val, key);
    if (slot) slots[key] = slot;
  }
  return { slots } satisfies CardShopState;
}

function sanitizeShopBrowsingUid(raw: RoomData['shopBrowsingUid']): RoomData['shopBrowsingUid'] {
  if (raw === null || raw === undefined) return raw;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function sanitizeShopRemoteCursor(raw: RoomData['shopRemoteCursor']): RoomData['shopRemoteCursor'] {
  if (raw === null || raw === undefined) return raw;
  if (typeof raw !== 'object' || raw === null) return null;
  const uid = (raw as { uid?: unknown }).uid;
  const nx = (raw as { nx?: unknown }).nx;
  const ny = (raw as { ny?: unknown }).ny;
  const seq = (raw as { seq?: unknown }).seq;
  if (typeof uid !== 'string' || uid.length === 0) return null;
  if (typeof nx !== 'number' || typeof ny !== 'number' || !Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  const cx = Math.max(0, Math.min(1, nx));
  const cy = Math.max(0, Math.min(1, ny));
  const sq = typeof seq === 'number' && Number.isFinite(seq) ? seq : 0;
  return { uid, nx: cx, ny: cy, seq: sq } satisfies ShopRemoteCursorState;
}

/**
 * Coerce synced / stored room snapshots into shapes the React UI expects.
 * Peer deserialization or partial merges must never whitescreen `.length` / `.map` paths.
 */
export function sanitizeRoomDataForClient(room: RoomData): RoomData {
  const settings = normalizeGameSettings(room.settings ?? {});
  const rawPlayers = room.players && typeof room.players === 'object' ? room.players : {};
  const players: Record<string, PlayerData> = {};
  for (const uid of Object.keys(rawPlayers)) {
    const p = rawPlayers[uid];
    if (!p || typeof p !== 'object') continue;
    const tb = (p as PlayerData).tokenBalance;
    players[uid] = {
      ...p,
      hand: ensureArray(p.hand, []),
      powerCards: ensureArray(p.powerCards, []),
      tokenBalance: typeof tb === 'number' && Number.isFinite(tb) ? tb : 0,
    };
  }

  const availableSuits: Suit[] =
    Array.isArray(room.availableSuits) && room.availableSuits.length > 0 ? [...room.availableSuits] : [...SUITS];

  return {
    ...room,
    settings,
    players,
    deck: ensureArray(room.deck, []),
    powerDeck: ensureArray(room.powerDeck, []),
    draftSets: Array.isArray(room.draftSets) ? room.draftSets : [],
    availableSuits,
    activeCurses: ensureArray(room.activeCurses, []),
    chatMessages: ensureArray(room.chatMessages, []),
    draftPowerAppearances: Array.isArray(room.draftPowerAppearances) ? room.draftPowerAppearances : undefined,
    cardShop: sanitizeCardShop(room.cardShop),
    shopBrowsingUid: sanitizeShopBrowsingUid(room.shopBrowsingUid),
    shopRemoteCursor: sanitizeShopRemoteCursor(room.shopRemoteCursor),
  };
}
