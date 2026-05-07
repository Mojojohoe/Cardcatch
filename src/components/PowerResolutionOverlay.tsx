import React from 'react';
import { motion } from 'motion/react';
import type { PendingPowerDecision, RoomData } from '../types';
import { CardVisual, PowerCardVisual } from './GameVisuals';
import { CompactTableGlyphRow } from './TableHudDecor';
import { HoldDelayTooltip } from './HoldDelayTooltip';
import { OpponentDecisionStrip } from './OpponentDecisionStrip';
import { CURSE_GREEN_EYED_MONSTER, wrathCurseActive, envyCurseActive } from '../curses';

const HUD_HOLD_TARGET_SUIT_CAPTION =
  'Each round has one table suit. Cards on this suit beat cards that are off-suit.';

export const PowerResolutionOverlay: React.FC<{
  room: RoomData;
  myUid: string;
  lustHeartRules: boolean;
  powerShowdown: boolean;
  greedJointTrumpUi: boolean;
  /** Opponent power decision UI (e.g. Wheel options) — shown inside this overlay above modals. */
  opponentPendingDecision: PendingPowerDecision | null;
}> = ({ room, myUid, lustHeartRules, powerShowdown, greedJointTrumpUi, opponentPendingDecision }) => {
  if (room.status !== 'powering') return null;
  const opponent = Object.values(room.players).find((p) => p.uid !== myUid);
  const me = room.players[myUid];
  if (!opponent || !me.currentMove || !opponent.currentMove) return null;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[280] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="pointer-events-auto flex max-w-[min(100%,44rem)] flex-col items-center gap-3 rounded-2xl border border-slate-700/60 bg-black/60 px-3 py-3 backdrop-blur-md">
        {room.targetSuit && (
          <HoldDelayTooltip caption={HUD_HOLD_TARGET_SUIT_CAPTION} className="flex flex-col items-center">
            <CompactTableGlyphRow suit={room.targetSuit} greedJointTrump={greedJointTrumpUi} />
          </HoldDelayTooltip>
        )}
        {!powerShowdown && opponentPendingDecision && (
          <OpponentDecisionStrip opponentName={opponent.name} decision={opponentPendingDecision} />
        )}
        <div className="flex items-center gap-8">
          <div className="relative flex flex-col items-center gap-2 pt-8 sm:pt-10">
            <span className="text-[9px] uppercase font-black text-emerald-400">{me.name}</span>
            {room.settings.enableCurseCards &&
              wrathCurseActive(room.activeCurses ?? []) &&
              room.wrathTargetUid === myUid &&
              room.wrathMinionCard && (
                <motion.div
                  className="pointer-events-none absolute top-0 left-1/2 z-40 flex -translate-x-1/2 justify-center"
                  initial={{ y: -4, opacity: 1 }}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ y: { repeat: Infinity, duration: 1.15, ease: 'easeInOut' } }}
                >
                  <div className="origin-top scale-[0.52] opacity-95 drop-shadow-[0_0_20px_rgba(220,38,38,0.45)]">
                    <CardVisual card={room.wrathMinionCard} revealed noAnimate presentation="none" small />
                  </div>
                </motion.div>
              )}
            {room.settings.enableCurseCards &&
              envyCurseActive(room.activeCurses ?? []) &&
              room.envyCovet &&
              room.envyCovet.uid === myUid &&
              room.envyCovet.cardId === me.currentMove && (
                <motion.div
                  className="pointer-events-none absolute top-0 left-1/2 z-[41] flex -translate-x-1/2 flex-col items-center gap-0.5"
                  initial={{ y: -2, opacity: 1 }}
                  animate={{ y: [0, -7, 0] }}
                  transition={{ y: { repeat: Infinity, duration: 1.12, ease: 'easeInOut' } }}
                >
                  <div className="origin-center scale-[0.52] opacity-95 drop-shadow-[0_0_20px_rgba(16,185,129,0.48)] sm:scale-[0.56]">
                    <PowerCardVisual cardId={CURSE_GREEN_EYED_MONSTER} small revealed curseRackPeek />
                  </div>
                </motion.div>
              )}
            <CardVisual
              card={me.currentMove}
              revealed
              lustHeartRulesActive={lustHeartRules}
              envyCovetedGlow={Boolean(
                room.settings.enableCurseCards &&
                  envyCurseActive(room.activeCurses ?? []) &&
                  room.envyCovet?.uid === myUid &&
                  room.envyCovet.cardId === me.currentMove,
              )}
            />
            {powerShowdown && me.currentPowerCard !== null && (
              <div className="relative -mt-1 flex flex-col items-center gap-0.5">
                <PowerCardVisual cardId={0} small revealed={false} />
                <span className="text-[6px] font-black uppercase tracking-widest text-slate-500">Power</span>
              </div>
            )}
          </div>

          <div className="relative flex flex-col items-center gap-2 pt-8 sm:pt-10">
            <span className="text-[9px] uppercase font-black text-emerald-500">{opponent.name}</span>
            {room.settings.enableCurseCards &&
              wrathCurseActive(room.activeCurses ?? []) &&
              room.wrathTargetUid === opponent.uid &&
              room.wrathMinionCard && (
                <motion.div
                  className="pointer-events-none absolute top-0 left-1/2 z-40 flex -translate-x-1/2 justify-center"
                  initial={{ y: -4, opacity: 1 }}
                  animate={{ y: [0, -8, 0] }}
                  transition={{ y: { repeat: Infinity, duration: 1.15, ease: 'easeInOut' } }}
                >
                  <div className="origin-top scale-[0.52] opacity-95 drop-shadow-[0_0_20px_rgba(220,38,38,0.45)]">
                    <CardVisual card={room.wrathMinionCard} revealed noAnimate presentation="none" small />
                  </div>
                </motion.div>
              )}
            {room.settings.enableCurseCards &&
              envyCurseActive(room.activeCurses ?? []) &&
              room.envyCovet &&
              room.envyCovet.uid === opponent.uid &&
              room.envyCovet.cardId === opponent.currentMove && (
                <motion.div
                  className="pointer-events-none absolute top-0 left-1/2 z-[41] flex -translate-x-1/2 flex-col items-center gap-0.5"
                  initial={{ y: -2, opacity: 1 }}
                  animate={{ y: [0, -7, 0] }}
                  transition={{ y: { repeat: Infinity, duration: 1.12, ease: 'easeInOut' } }}
                >
                  <div className="origin-center scale-[0.52] opacity-95 drop-shadow-[0_0_20px_rgba(16,185,129,0.48)] sm:scale-[0.56]">
                    <PowerCardVisual cardId={CURSE_GREEN_EYED_MONSTER} small revealed curseRackPeek />
                  </div>
                </motion.div>
              )}
            <CardVisual
              card={opponent.currentMove}
              revealed
              lustHeartRulesActive={lustHeartRules}
              envyCovetedGlow={Boolean(
                room.settings.enableCurseCards &&
                  envyCurseActive(room.activeCurses ?? []) &&
                  room.envyCovet?.uid === opponent.uid &&
                  room.envyCovet.cardId === opponent.currentMove,
              )}
            />
            {powerShowdown && opponent.currentPowerCard !== null && (
              <div className="relative -mt-1 flex flex-col items-center gap-0.5">
                <PowerCardVisual cardId={0} small revealed={false} />
                <span className="text-[6px] font-black uppercase tracking-widest text-slate-500">Power</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

