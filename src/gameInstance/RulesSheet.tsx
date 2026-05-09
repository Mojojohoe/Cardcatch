/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, X } from 'lucide-react';
import { GameSettings, MAJOR_ARCANA, desperationTierRowsForDisplay } from '../types';

const RULES_ACCORDION_SHELL =
  'group rounded-xl border border-emerald-800/65 bg-emerald-950/45 open:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]';
const RULES_ACCORDION_SUMMARY =
  'cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex justify-between items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[11px] font-black uppercase tracking-wide text-yellow-400/95 transition-colors hover:bg-emerald-900/35 sm:py-3 sm:text-xs';
const RULES_ACCORDION_BODY =
  'space-y-2 border-t border-emerald-900/45 px-3 py-3 text-xs leading-relaxed text-emerald-100/95 sm:text-sm';

export const RulesSheet: React.FC<{ settings: GameSettings; onClose: () => void }> = ({ settings, onClose }) => {
  const isPreydatorLobby = settings.hostRole === 'Preydator';
  const despairSeatPhrase =
    (settings.preydatorDesperationSeats ?? 'guest') === 'both'
      ? 'either seat'
      : (settings.preydatorDesperationSeats ?? 'guest') === 'host'
        ? 'the host seat'
        : 'the guest seat';
  const desperationDisplayRows = desperationTierRowsForDisplay(settings);
  const panicOnForTable =
    settings.enablePanicDice &&
    (isPreydatorLobby
      ? settings.panicDicePreydatorHostEnabled || settings.panicDicePreydatorGuestEnabled
      : settings.panicDicePredatorEnabled || settings.panicDicePreyEnabled);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-[60] overflow-y-auto bg-emerald-950/98 p-4 backdrop-blur-md sm:p-6 lg:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-3xl space-y-4 pb-14 xl:max-w-4xl"
      >
        <div className="flex flex-col gap-2 border-b border-emerald-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-black uppercase tracking-tight text-yellow-400 text-sm sm:text-lg">Rules</h3>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-emerald-200/90 sm:text-sm">
              Cardcatch is a two-player trick game with specials. Open a section below to read it—only mechanics enabled for
              this lobby are listed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="shrink-0 self-end rounded-lg p-2 transition-colors hover:bg-emerald-900/80 sm:self-start"
          >
            <X className="h-5 w-5 text-emerald-200" />
          </button>
        </div>

        <div className="space-y-3">
          <details open className={RULES_ACCORDION_SHELL}>
            <summary className={RULES_ACCORDION_SUMMARY}>
              <span>Round flow & scoring</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
            </summary>
            <div className={RULES_ACCORDION_BODY}>
              <ul className="list-disc space-y-1.5 pl-4 font-medium marker:text-emerald-600">
                <li>
                  Each round has one <strong>table suit</strong>. Cards on that suit beat cards that stayed off-suit.
                </li>
                <li>If both plays are trump or both are off-suit, higher rank wins (Ace high, then face cards, then numbers).</li>
                <li>The winner draws one card from the shared deck.</li>
                <li>
                  Predator tries to empty the prey&apos;s hand. Prey tries to outlast predator or drain the deck first.
                  {isPreydatorLobby ? ' Preydator mode keeps both seats in the hunt until someone falls.' : ''}
                </li>
                {settings.deckSizeMultiplier > 1 ? (
                  <li>This lobby shuffles multiple copies of the deck together, so duplicates can appear.</li>
                ) : null}
              </ul>
            </div>
          </details>

          {!settings.disableJokers ? (
            <details open className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Jokers</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <ul className="list-disc space-y-1.5 pl-4 font-medium marker:text-emerald-600">
                  <li>If a Joker is played against a card on the <strong>table suit</strong>, the Joker always wins.</li>
                  <li>If a Joker is played against a card <strong>not</strong> on the table suit, the Joker always loses.</li>
                  <li>If both players play a Joker, the round is a draw.</li>
                </ul>
              </div>
            </details>
          ) : null}

          {settings.enablePokerChips ? (
            <details className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Poker chips & shop</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <p>
                  Winning a round by more points than needed earns poker chips—that bonus is usually called{' '}
                  <strong>overkill</strong>. You can cash chips in mid-round to open the shop and buy new cards or boosts.
                </p>
                <p>Your opponent spends from the same store, so keep an eye on what&apos;s left in stock.</p>
              </div>
            </details>
          ) : null}

          {panicOnForTable ? (
            <details className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Panic dice</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <p>
                  When your seat gets panic dice, you may use them <strong>once per match</strong> right after the table
                  scores a round. They force a chaotic reroll—powerful, but risky.
                </p>
              </div>
            </details>
          ) : null}

          {settings.enableCurseCards ? (
            <details className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Deadly sins / curses</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <p>Curses layer extra flair onto the felt while they run. Active curses appear on the table UI—peek there anytime you need the short version.</p>
                <p>Most cards behave exactly like the basics above; curiosities show up inline when you play.</p>
              </div>
            </details>
          ) : null}

          {settings.enableDesperation ? (
            <details className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Desperation wheel</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <ul className="list-disc space-y-1.5 pl-4 font-medium marker:text-emerald-600">
                  <li>Eligible players may spin instead of quitting when the round allows it—dramatic swings either way.</li>
                  {!isPreydatorLobby ? (
                    <li>Normally only the prey seat may spin desperation; predator cannot.</li>
                  ) : (
                    <li>For Preydator lobbies your host picks which seats may spin ({despairSeatPhrase}).</li>
                  )}
                  <li>Worst wedge can end your run on the spot; lucky wedges sling fresh cards onto your side.</li>
                  {settings.desperationStarterTierEnabled ? (
                    <li>Starter tiers are on—you show up closer to the danger ladder immediately.</li>
                  ) : (
                    <li>Starter tiers start quiet—your first eligible spin climbs you onto the ladder.</li>
                  )}
                </ul>
                {desperationDisplayRows.length > 0 ? (
                  <p className="text-[11px] text-emerald-300/95">
                    Ladder texts this match:{' '}
                    <span className="font-semibold text-emerald-100">
                      {desperationDisplayRows.map((r) => r.label).join(', ')}
                    </span>
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}

          {!settings.disablePowerCards ? (
            <div className="space-y-2 rounded-xl border border-emerald-800/65 bg-emerald-950/40 p-3 sm:p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Major arcana powers</p>
              <p className="text-xs leading-relaxed text-emerald-200/90">
                Draft these once before the duel. Expand a row to read the effect—anything disabled in setup simply won&apos;t
                trigger.
              </p>
              <div className="max-h-[min(42vh,28rem)] space-y-1.5 overflow-y-auto pr-1 sm:max-h-[min(48vh,30rem)]">
                {MAJOR_ARCANA.map((p) => (
                  <details key={p.id} className="group rounded-lg border border-emerald-900/70 bg-black/25 open:bg-black/35">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-yellow-400/95 [&::-webkit-details-marker]:hidden sm:text-xs">
                      <span>{p.name}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="border-t border-emerald-900/40 px-3 pt-0 pb-2.5 text-[11px] font-normal leading-snug text-emerald-100/90 normal-case sm:text-xs">
                      {p.description}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <p className="text-center text-[11px] leading-relaxed text-emerald-500/90">
          Still unsure? Hover the hints on cards and HUD pieces—they echo this sheet in bite-sized bursts.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-emerald-800 py-3 text-xs font-black uppercase tracking-wider text-emerald-50 transition-colors hover:bg-emerald-700"
        >
          Got it
        </button>
      </div>
    </motion.div>
  );
};
