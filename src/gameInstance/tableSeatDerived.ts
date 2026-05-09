/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CURSE_LUST,
  curseEffectActive,
  greedCurseActive,
  lustCurseActive,
} from '../curses';
import type { PendingPowerDecision, PlayerData, RoomData } from '../types';

/** Memoizable seat + power-phase derivations for the active table (two-player). */
export type TableSeatDerived = {
  me: PlayerData;
  opponent: PlayerData | null;
  opponentUid: string | undefined;
  isHost: boolean;
  myPendingDecision: PendingPowerDecision | null;
  opponentPendingDecision: PendingPowerDecision | null;
  powerShowdown: boolean;
  myWheelDecisionSpinning: boolean;
  opponentWheelDecisionSpinning: boolean;
  lustHeartUi: boolean;
  lustTripleWheel: boolean;
  greedHalveWheel: boolean;
  greedJointTrumpUi: boolean;
  curseSelectionLocked: boolean;
  hudPhaseLine: string | null;
  tableShopBrowsers: string[];
};

export function computeTableSeatDerived(
  room: RoomData,
  myUid: string,
  roomId: string | null,
): TableSeatDerived | null {
  const me = room.players[myUid];
  if (!me) return null;
  const opponentUid = Object.keys(room.players).find((uid) => uid !== myUid);
  const opponent = opponentUid ? room.players[opponentUid] ?? null : null;
  const isHost = Boolean(roomId && room.hostUid === myUid);
  const myPendingDecision = room.pendingPowerDecisions?.[myUid] ?? null;
  const opponentPendingDecision = opponentUid ? room.pendingPowerDecisions?.[opponentUid] ?? null : null;
  const powerShowdown = room.status === 'powering' && room.awaitingPowerShowdown === true;
  const myWheelDecisionSpinning =
    myPendingDecision?.powerCardId === 10 && myPendingDecision.selectedOption === 'SPIN_WHEEL';
  const opponentWheelDecisionSpinning =
    opponentPendingDecision?.powerCardId === 10 && opponentPendingDecision.selectedOption === 'SPIN_WHEEL';
  const lustHeartUi =
    room.settings.enableCurseCards &&
    (lustCurseActive(room.activeCurses ?? []) ||
      (room.status === 'powering' &&
        (me.currentPowerCard === CURSE_LUST || opponent?.currentPowerCard === CURSE_LUST)));
  const lustTripleWheel = room.settings.enableCurseCards && lustCurseActive(room.activeCurses ?? []);
  const greedHalveWheel = room.settings.enableCurseCards && greedCurseActive(room.activeCurses ?? []);
  const greedJointTrumpUi =
    room.settings.enableCurseCards &&
    greedCurseActive(room.activeCurses ?? []) &&
    room.targetSuit === 'Diamonds';
  const curseSelectionLocked =
    room.settings.enableCurseCards !== false && curseEffectActive(room.activeCurses);
  const hudPhaseLine =
    room.status === 'powering'
      ? powerShowdown
        ? 'Cards locked — choose power effects'
        : 'Resolving power cards…'
      : null;
  const tableShopBrowsers = Array.isArray(room.cardShopBrowsersUids) ? room.cardShopBrowsersUids : [];

  return {
    me,
    opponent,
    opponentUid,
    isHost,
    myPendingDecision,
    opponentPendingDecision,
    powerShowdown,
    myWheelDecisionSpinning,
    opponentWheelDecisionSpinning,
    lustHeartUi,
    lustTripleWheel,
    greedHalveWheel,
    greedJointTrumpUi,
    curseSelectionLocked,
    hudPhaseLine,
    tableShopBrowsers,
  };
}
