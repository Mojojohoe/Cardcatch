/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createFixtureRoom } from '../../services/gameService.fixtures';
import { normalizeGameSettings } from '../../settings/normalizeGameSettings';
import type { RoomData } from '../../types';
import { CURSE_LUST, CURSE_WRATH } from '../../curses';

/** Room snapshot rich enough for layout-editor live previews (no GameService). */
export function createLayoutEditorPreviewRoom(): RoomData {
  const base = createFixtureRoom();
  return {
    ...base,
    settings: normalizeGameSettings({
      ...base.settings,
      enablePokerChips: true,
      enablePanicDice: true,
      panicDicePredatorEnabled: true,
      panicDicePreyEnabled: true,
      enableCurseCards: true,
      enableDesperation: true,
      desperationStarterTierEnabled: true,
      tiers: ['Tier 1', 'Tier 2'],
    }),
    players: {
      ...base.players,
      host: {
        ...base.players.host,
        tokenBalance: 12,
        hand: ['Hearts-7', 'Spades-K', 'Diamonds-3', 'Clubs-9', 'Joker-1'],
        powerCards: [0, 10, 14, 17],
        panicDiceUsed: false,
      },
      guest: {
        ...base.players.guest,
        tokenBalance: 7,
        hand: ['Hearts-5', 'Clubs-A', 'Moons-8', 'Stars-2'],
        powerCards: [1, 11, 20, 6],
        panicDiceUsed: false,
        /** So {@link OpponentDesperationTopStrip} renders in the layout preview. */
        desperationSpinning: true,
      },
    },
    activeCurses: [
      { id: CURSE_LUST, lustAccumulated: 22 },
      {
        id: CURSE_WRATH,
        wrathRound: 2,
      },
    ],
    wrathTargetUid: 'guest',
    wrathMinionCard: 'Swords-3',
    prideCeilingCard: 'Hearts-Q',
    tyrantCrownPending: { crownTotal: 9 },
    chatMessages: [
      { uid: 'guest', name: 'Guest', text: 'Example chat line', at: Date.now() - 60_000 },
      { uid: 'host', name: 'Host', text: 'Second line', at: Date.now() - 30_000 },
    ],
    cardShop: {
      slots: {
        a: { id: 'a', soldOut: false, offer: { type: 'major', powerId: 3 } },
        b: { id: 'b', soldOut: false, offer: { type: 'curse', curseId: CURSE_LUST } },
      },
    },
  };
}
