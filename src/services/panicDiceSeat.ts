import type { PlayerData, RoomData } from '../types';

/** Whether panic dice rules allow this player's seat — host/guest wording for Preydator is handled only in lobby UI labels. */
export function panicDiceSeatAllowed(
  room: Pick<RoomData, 'settings' | 'players' | 'hostUid'>,
  uid: string,
): boolean {
  const s = room.settings;
  if (!s.enablePanicDice) return false;
  const player = room.players[uid];
  if (!player) return false;

  if (s.hostRole === 'Preydator') {
    const hostOn = s.panicDicePreydatorHostEnabled !== false;
    const guestOn = s.panicDicePreydatorGuestEnabled !== false;
    return uid === room.hostUid ? hostOn : guestOn;
  }
  if (player.role === 'Predator') return s.panicDicePredatorEnabled !== false;
  if (player.role === 'Prey') return s.panicDicePreyEnabled !== false;
  return false;
}

export function opponentUidForPanic(roomPlayers: Record<string, PlayerData>, uid: string): string | undefined {
  return Object.keys(roomPlayers).find((id) => id !== uid);
}
