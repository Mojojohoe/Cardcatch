import type { PlayerData, RoomData, Suit } from '../types';
import { SUITS } from '../types';
import { normalizeGameSettings } from './normalizeGameSettings';

function ensureArray<T>(v: unknown, fallback: T[]): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
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
    players[uid] = {
      ...p,
      hand: ensureArray(p.hand, []),
      powerCards: ensureArray(p.powerCards, []),
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
  };
}
