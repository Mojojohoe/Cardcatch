import {
  envyGreedySealSlots,
  isCardBlockedByPride,
} from '../services/gameService';
import type { RoomData } from '../types';
import {
  CURSE_LUST,
  envyCurseActive,
  greedCurseActive,
  lustCurseActive,
  prideCurseActive,
} from '../curses';

/** Pride barrier blocks plays of the barrier suit at or above its clash rank (Grovel exempt). */
export function envySealBlocksHandIndex(
  room: RoomData,
  uid: string,
  hand: readonly string[],
  index: number,
): boolean {
  const curseOk = room.settings.enableCurseCards !== false;
  if (!curseOk || !envyCurseActive(room.activeCurses ?? [])) return false;
  return Boolean(envyGreedySealSlots(hand, room.envySealedCards?.[uid] ?? [])[index]);
}

export function prideBlocksCard(room: RoomData, uid: string, card: string): boolean {
  const curseOk = room.settings.enableCurseCards !== false;
  if (!curseOk || !prideCurseActive(room.activeCurses ?? []) || !room.prideCeilingCard) return false;
  const self = room.players[uid];
  const opponent = Object.values(room.players).find((p) => p.uid !== uid);
  const lustHr =
    lustCurseActive(room.activeCurses ?? []) ||
    (room.status === 'powering' &&
      (self?.currentPowerCard === CURSE_LUST || opponent?.currentPowerCard === CURSE_LUST));
  const greedTx = greedCurseActive(room.activeCurses ?? []);
  return isCardBlockedByPride(card, room.prideCeilingCard, lustHr, greedTx);
}
