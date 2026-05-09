/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Skull } from 'lucide-react';
import { desperationSpinAllowed } from '../services/gameService';
import {
  desperationTierRowsForDisplay,
  type GameSettings,
  type PendingPowerDecision,
  type PlayerData,
  type RoomData,
} from '../types';
import { FortuneWheelVisual } from '../components/PowerInteraction';
import { DesperationWheel } from '../components/GameWheels';
import { HoldDelayTooltip } from '../components/HoldDelayTooltip';
import { SuitGlyph } from '../components/SuitGlyphs';
import { usePowerTooltipPosition } from '../hooks/usePowerTooltipPosition';
import { desperationLadderLabel } from '../utils/desperationUi';
import { ornatePurplePanelRasterStyle } from '../ui/ornateFrame';
import { HUD_HOLD_OPPONENT_DESPERATION_CAPTION } from '../ui/hudCopy';
import { useOptionalCardArt } from '../cardArt/cardArtContext';

export const TyrantCrownTablePiece: React.FC<{ crownTotal: number }> = ({ crownTotal }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const tip = 'The crown card will be awarded to the player that wins this round.';
  const tooltipStyle = usePowerTooltipPosition(open, rootRef, popRef);
  return (
    <div className="relative mt-5 flex flex-col items-center gap-2">
      <p className="max-w-[18rem] px-2 text-center text-[10px] font-black uppercase leading-snug tracking-widest text-amber-200/90">
        The Tyrant is dead. Only their crown remains.
      </p>
      <motion.div
        ref={rootRef}
        layout
        className="relative cursor-pointer"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
      >
        <div className="flex h-[7.25rem] w-[5.25rem] flex-col items-center justify-between rounded-2xl border-4 border-amber-600 bg-linear-to-b from-amber-950 to-stone-950 px-1 py-2 shadow-[0_0_36px_rgba(245,158,11,0.35)] sm:h-[8.75rem] sm:w-[6.25rem]">
          <SuitGlyph suit="Crowns" className="h-16 w-16 text-amber-400 sm:h-20 sm:w-20" />
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-100/90">Crown</span>
          <span className="font-mono text-[11px] font-bold text-amber-200">{crownTotal}/17</span>
        </div>
        {open && (
          <div
            ref={popRef}
            style={tooltipStyle}
            className="pointer-events-none fixed z-[400] max-w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-amber-800/80 bg-stone-950/98 px-3 py-2 text-[11px] font-semibold leading-snug text-amber-50 shadow-xl"
          >
            {tip}
          </div>
        )}
      </motion.div>
    </div>
  );
};

function opponentDesperationUiRelevant(room: RoomData, opp: PlayerData): boolean {
  if (!room.settings.enableDesperation || room.winner) return false;
  if (opp.desperationSpinning || opp.desperationResult != null) return true;
  if (!desperationSpinAllowed(room, opp.uid, opp)) return false;
  return opp.desperationTier >= 0;
}

/** Opponent desperation capsule — napkin cell 7: top-center strip (under phase line), both seats. */
export const OpponentDesperationTopStrip: React.FC<{ opponent: PlayerData; room: RoomData; className?: string }> = ({
  opponent,
  room,
  className = '',
}) => {
  const cardArt = useOptionalCardArt();
  const rasterOrnate = Boolean(cardArt?.mode === 'raster');
  if (!opponentDesperationUiRelevant(room, opponent)) return null;
  const oppLadderLabel =
    opponent.desperationTier >= 0 ? desperationLadderLabel(room.settings.tiers, opponent.desperationTier) : null;
  return (
    <HoldDelayTooltip caption={HUD_HOLD_OPPONENT_DESPERATION_CAPTION} className={`z-[28] w-full max-w-full shrink-0 ${className}`}>
      <div
        style={rasterOrnate ? ornatePurplePanelRasterStyle() : undefined}
        className={
          rasterOrnate
            ? 'w-full max-w-full py-2'
            : 'w-full max-w-full rounded-lg border border-purple-800/65 bg-purple-950/93 py-1.5 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12)]'
        }
      >
        <div className="flex w-full max-w-full items-start gap-1.5 px-2">
          <Skull
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400 ${opponent.desperationSpinning ? 'animate-pulse' : ''}`}
          />
          <div className="min-w-0 flex-1 text-left leading-snug">
            <span className="block truncate text-[8px] font-black uppercase tracking-wider text-purple-200/95">
              {opponent.name} · desperation
            </span>
            {opponent.desperationSpinning ? (
              <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wide text-emerald-300/95">
                Wheel spinning…
              </span>
            ) : opponent.desperationResult ? (
              <span
                className={`mt-0.5 block truncate text-[9px] font-black uppercase tracking-wide ${opponent.desperationResult === 'GAME OVER' ? 'text-red-400' : 'text-yellow-200/95'}`}
              >
                {opponent.desperationResult.replace('GAIN', 'DRAW')}
              </span>
            ) : oppLadderLabel ? (
              <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-wide text-white/95">
                {oppLadderLabel}
              </span>
            ) : (
              <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-slate-500">
                Off ladder until first spin
              </span>
            )}
          </div>
        </div>
      </div>
    </HoldDelayTooltip>
  );
};

export const OpposingHandOverlayStack: React.FC<{
  opponent: PlayerData;
  roomSettings: GameSettings;
  roomSnapshot: RoomData;
  roomStatus: RoomData['status'];
  powerShowdown: boolean;
  opponentPendingDecision: PendingPowerDecision | null | undefined;
  opponentWheelDecisionSpinning: boolean;
}> = ({
  opponent,
  roomSettings,
  roomSnapshot,
  roomStatus,
  opponentPendingDecision,
  opponentWheelDecisionSpinning,
}) => {
  const oppTierRows = desperationTierRowsForDisplay(roomSettings);
  const showOppTierBanner = opponentDesperationUiRelevant(roomSnapshot, opponent);

  return (
    <>
      {(opponent.desperationSpinning || opponent.desperationResult != null) && showOppTierBanner && (
        <DesperationWheel
          opposingHandOverlay
          allTierLabels={roomSettings.tiers}
          desperationTier={opponent.desperationTier}
          tierRows={oppTierRows}
          isSpectator
          isSpinning={opponent.desperationSpinning}
          offset={opponent.desperationOffset}
          result={opponent.desperationResult}
          onClose={() => {}}
          onResolve={() => {}}
          onSpin={() => {}}
        />
      )}

      {roomStatus === 'powering' && opponentWheelDecisionSpinning && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
          <div className="mb-2 rounded-xl border border-amber-500/45 bg-black/55 px-3 py-2 backdrop-blur-sm">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">
              Wheel spinning for {opponent.name}
            </span>
          </div>
          <div className="w-[min(11rem,78vw)] max-w-full shrink-0 sm:w-52">
            <FortuneWheelVisual
              spinning
              dense
              offset={opponentPendingDecision?.wheelOffset ?? 0}
              sizeClass="w-full"
            />
          </div>
        </div>
      )}
    </>
  );
};
