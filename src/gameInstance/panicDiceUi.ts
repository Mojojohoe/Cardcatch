/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { panicDiceSeatAllowed } from '../services/panicDiceSeat';
import type { PlayerData, RoomData } from '../types';

/** Strip + results-phase panic dice affordances derived from room + seat. */
export function computePanicDiceUi(room: RoomData, myUid: string, me: PlayerData) {
  const panicDiceStripVisible =
    room.settings.enablePanicDice &&
    panicDiceSeatAllowed(room, myUid) &&
    (room.status === 'playing' || room.status === 'powering');

  const panicDiceStripInteractive = panicDiceStripVisible && !me.panicDiceUsed;

  const panicDiceResultsVisible =
    room.status === 'results' &&
    Boolean(room.lastOutcome) &&
    room.settings.enablePanicDice &&
    panicDiceSeatAllowed(room, myUid) &&
    !me.readyForNextRound;

  const panicDiceResultsInteractive = panicDiceResultsVisible && !me.panicDiceUsed;
  const panicDiceResultsUsedVisible =
    room.status === 'results' &&
    Boolean(room.lastOutcome) &&
    room.settings.enablePanicDice &&
    panicDiceSeatAllowed(room, myUid) &&
    !me.readyForNextRound &&
    me.panicDiceUsed;

  return {
    panicDiceStripVisible,
    panicDiceStripInteractive,
    panicDiceResultsVisible,
    panicDiceResultsInteractive,
    panicDiceResultsUsedVisible,
  };
}
