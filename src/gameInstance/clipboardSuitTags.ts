/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PlayerRole } from '../types';

/** Plain forum-export tags when a unicode playing card glyph is not defined. */
export const CLIPBOARD_SUIT_TAG: Record<string, string> = {
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  Spades: '♠',
  Stars: '★',
  Moons: 'Moon',
  Frogs: 'Frog',
  Coins: 'Coin',
  Crowns: 'Crown',
  Grovels: 'Grovel',
  Swords: 'Wrath',
  Bones: 'Bone',
  Joker: '🃏',
};

export function preySideLabel(role: PlayerRole): string {
  if (role === 'Predator') return 'Guest';
  if (role === 'Prey') return 'Host';
  return 'Either player';
}
