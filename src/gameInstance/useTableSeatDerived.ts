/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import type { RoomData } from '../types';
import { computeTableSeatDerived, type TableSeatDerived } from './tableSeatDerived';

export function useTableSeatDerived(
  room: RoomData | null,
  myUid: string,
  roomId: string | null,
): TableSeatDerived | null {
  return useMemo(() => {
    if (!room) return null;
    return computeTableSeatDerived(room, myUid, roomId);
  }, [room, myUid, roomId]);
}
