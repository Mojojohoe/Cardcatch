/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GameElementKey, GameUiElementKey } from './types';

export const GAME_ELEMENT_OPTIONS: { value: GameElementKey; label: string }[] = [
  { value: 'opponent_cards', label: 'Opponent cards' },
  { value: 'opponent_tokens', label: 'Opponent tokens' },
  { value: 'opponent_power_cards', label: 'Opponent power cards' },
  { value: 'play_area', label: 'Play area (target wheel & gold / target suit)' },
  { value: 'fire_bowl', label: 'Fire bowl (sacrificial bowl)' },
  { value: 'deck', label: 'Deck' },
  { value: 'player_power_cards', label: 'Player power cards' },
  { value: 'player_cards', label: 'Player cards' },
  { value: 'panic_dice_image', label: 'Panic dice (strip / image)' },
  { value: 'player_tokens', label: 'Player tokens' },
  { value: 'curse_zone', label: 'Curse zone panel' },
  { value: 'room_chat', label: 'Room chat' },
  { value: 'tyrant_crown', label: 'Tyrant crown (table)' },
  { value: 'other_game', label: 'Other (game)' },
];

export const GAME_UI_OPTIONS: { value: GameUiElementKey; label: string }[] = [
  { value: 'opponent_desperation', label: 'Opponent desperation' },
  { value: 'player_desperation', label: 'Player desperation' },
  { value: 'play_card_button', label: 'Play card button' },
  { value: 'cash_chips_button', label: 'Cash Chips button' },
  { value: 'panic_dice_button', label: 'Panic dice button (planned)' },
  { value: 'room_code_copy', label: 'Room code & copy' },
  { value: 'role_title', label: 'Role title (Pred / Prey / Preydator)' },
  { value: 'name_ready', label: 'Name / ready-up checkmark' },
  { value: 'settings_button', label: 'Settings button' },
  { value: 'rules_button', label: 'Rules button' },
  { value: 'local_multiplayer_toggle', label: 'Enable local multiplayer test (dev)' },
  { value: 'dev_menu_button', label: 'Dev menu button' },
  { value: 'other_ui', label: 'Other (UI)' },
];
