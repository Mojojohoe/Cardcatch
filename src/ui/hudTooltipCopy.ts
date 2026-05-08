import { lustCurseActive } from '../curses';
import type { RoomData } from '../types';

const SACRIFICIAL_BOWL_BASE =
  'The Sacrificial Bowl gives you one free draw from the deck for every two cards you burn. Drag a card to the bowl to burn it.';

const SACRIFICIAL_BOWL_LUST_APPEND =
  ' While Curse Lust holds the table, the flame turns pink and refuses Hearts. After every second burn, your free draw pulls a Heart from the deck if any remain (otherwise the top card as usual).';

/** Hold tooltip for the sacrificial bowl — includes Lust-specific rules when that curse is active. */
export function sacrificialBowlHoldCaption(room: RoomData): string {
  const lust =
    room.settings.enableCurseCards !== false && lustCurseActive(room.activeCurses ?? []);
  if (!lust) return SACRIFICIAL_BOWL_BASE;
  return SACRIFICIAL_BOWL_BASE + SACRIFICIAL_BOWL_LUST_APPEND;
}
