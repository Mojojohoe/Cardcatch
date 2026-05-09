/** Playing-card / HUD strings shared across table UI (tooltips, panic strip, hold captions). */

import { lustCurseActive } from '../curses';
import type { RoomData } from '../types';

export const PRIDE_WOUND_TOOLTIP = 'This card cannot be played for it would wound pride.';
export const GROVEL_FEED_TOOLTIP = "Sometimes the only way to play the game is to feed one's pride";
export const ENVY_COVET_CARD_TOOLTIP = 'The Green-Eyed Monster is envious of this card.';
export const ENVY_SEALED_TOOLTIP =
  'Envy has sealed this card — it cannot be played until the Green-Eyed Monster is defeated.';

/** Bottom-strip panic dice: not usable until `results` (strip only shows during playing / powering). */
export const PANIC_DICE_STRIP_HOVER_HELP =
  "Panic dice can be used after a round has resolved to remove value from the opponent's cards. Panic dice can only be used once.";

export const PANIC_DICE_STRIP_CLICK_HELP =
  "Panic dice can be used after the round has resolved. Panic dice will roll and create a card based on the rolled value. That value will be subtracted from the opponent's roll. The round is then re-evaluated. Panic dice are one-use only.";

export const PANIC_DICE_USED_HOVER = 'You have used your Panic Dice this game.';

/** ~700ms hold tooltips — same slate + yellow framing as playing-card hints. */
export const HUD_HOLD_DECK_CAPTION =
  'The cards remaining in the game. There are other ways to get cards than the deck, but once this reaches 0, starvation mode will begin.';

export const HUD_HOLD_OPPONENT_HAND_CAPTION =
  "Your opponent's hand. You cannot see their cards. Unless power cards are used, only winning a round allows you to draw a card. Your objective is to win enough rounds that they run out of cards.";

export const HUD_HOLD_OPPONENT_POWERS_CAPTION =
  'Your opponent’s power cards. You both had the same choices of power cards at the start of the game. They can use up to one of these per round.';

export const HUD_HOLD_PLAYER_TOKENS_CAPTION =
  'Your Poker Chips. You earn 1 token for every value above your opponent’s in a round. This is called “overkill”. You can cash out your chips during a round to buy new cards.';

export const HUD_HOLD_OPPONENT_TOKENS_CAPTION =
  'Your opponent’s Poker Chips. They can spend these in the shared shop to buy new cards.';

export const HUD_HOLD_TARGET_SUIT_CAPTION =
  'This is the target suit for this round. This suit trumps all other suits. A 2 of the target suit will trump an Ace of a non-target suit.';

export const HUD_HOLD_OPPONENT_DESPERATION_CAPTION =
  'The current Desperation tier for the opponent. If they lose the game, this is the effect they will suffer.';

/** UI time to show “deck empty / dealing bones” before the full-screen FAMINE callout */
export const FAMINE_BONE_DEAL_UI_MS = 6400;

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
