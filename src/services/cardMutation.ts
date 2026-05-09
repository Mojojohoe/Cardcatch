/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ResolutionEvent } from '../types';

/**
 * Semantic operations that **change committed card identity** during resolution (what ends up in
 * `lastOutcome.cardsPlayed`) plus seat swaps. Each variant maps 1:1 onto recap events the UI
 * already handles (`CARD_EMPOWER`, `TRANSFORM`, `CARD_SWAP`).
 *
 * ---
 * Why clash **downgrades** (Wrath magnitude, panic sword exchanges, partial stamina loss) are
 * **not** modeled here (and often do **not** rewrite `cardsPlayed`):
 *
 * - **Different primitive.** Empower/transform swap one printed id for another; Wrath/panic subtract
 *   from *effective* clash stamina inside `evaluateTrickClash` / `computePanicCombatEffects` while
 *   the engage-time printed id often stays the same. Panic is strike-based, not “rank − N” on the
 *   card string.
 * - **Avoid fake ids.** Mapping “Hearts-10 minus 3 wrath” to a canonical lower printed id would
 *   require downgrade tables for every suit/rank edge case (faces, Grovel, Jokers, sealed copies,
 *   Greed tax, Lust virtual hearts) or risk lying to any feature that trusts `cardsPlayed` as printed
 *   truth (taxes, lust, envy, tooltips).
 * - **Existing anchors.** `initialCardsPlayed` locks engage ids; `wrathFx`, `panicFx`, and
 *   `clashDestroyedByPenalty` carry replay/state for penalties; `CLASH_DESTROYED` marks stamina
 *   floored to zero — see {@link ResolutionEventType}.
 *
 * Personal note (why we left it asymmetric): unifying “up” and “down” under one helper **felt**
 * simpler conceptually, but would either **duplicate** logic (modifier + fake transform) or force a
 * large rules pass to make every subsystem consume a single “effective printed id.” The cheaper,
 * honest split is: **CardMutation = printed identity edits**, **wrath/panic/greed-as-modifier =
 * clash math + dedicated outcome fields**.
 *
 * When unifying into CardMutation (or a sibling `ClashMutation`) might be worthwhile:
 * - New recap animations want stepped “chip damage” tied to the event list (not only `wrathFx`).
 * - More powers key off “stamina after penalties” and bugs appear from reading `cardsPlayed` alone.
 * - You introduce a first-class **effective rank overlay** on outcome and want one append helper
 *   so hosts never forget to push both a mutation event and a modifier blob.
 *
 * Until then: **never infer effective clash strength from `cardsPlayed` without applying wrath,
 * panic, greed tax, and lust bump flags the same way `calculateRoundOutcome` does.**
 */
export type CardMutation =
  | {
      kind: 'empower';
      uid: string;
      fromCardId: string;
      toCardId: string;
      message?: string;
    }
  | {
      kind: 'transform';
      uid: string;
      fromCardId: string;
      toCardId: string;
      /** Major arcana / attribution for transforms (Magician, Lovers, Star field, Sloth dream, …). */
      powerCardId?: number;
      message?: string;
    }
  | {
      kind: 'swap_seat_card';
      uid: string;
      cardId: string;
      message?: string;
    }
  | {
      kind: 'swap_both_committed';
      message?: string;
    };

export function resolutionEventFromCardMutation(m: CardMutation): ResolutionEvent {
  switch (m.kind) {
    case 'empower':
      return {
        type: 'CARD_EMPOWER',
        uid: m.uid,
        fromCardId: m.fromCardId,
        cardId: m.toCardId,
        message: m.message,
      };
    case 'transform':
      return {
        type: 'TRANSFORM',
        uid: m.uid,
        fromCardId: m.fromCardId,
        cardId: m.toCardId,
        powerCardId: m.powerCardId,
        message: m.message,
      };
    case 'swap_seat_card':
      return {
        type: 'CARD_SWAP',
        uid: m.uid,
        cardId: m.cardId,
        message: m.message,
      };
    case 'swap_both_committed':
      return {
        type: 'CARD_SWAP',
        message: m.message,
      };
    default: {
      const _exhaustive: never = m;
      return _exhaustive;
    }
  }
}

export function appendCardMutation(events: ResolutionEvent[], m: CardMutation): void {
  events.push(resolutionEventFromCardMutation(m));
}
