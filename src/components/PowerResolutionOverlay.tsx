import React from 'react';
import { motion } from 'motion/react';
import type { PendingPowerDecision, PlayerData, RoomData } from '../types';
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
  const opponent = (Object.values(room.players) as PlayerData[]).find((p) => p.uid !== myUid);
  const me = room.players[myUid]!;
  if (!opponent || !me.currentMove || !opponent.currentMove) return null;

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-[25] flex items-center justify-center px-3 py-6 sm:px-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="pointer-events-auto flex w-full max-w-[min(100%,52rem)] flex-col items-center gap-4 rounded-2xl border border-indigo-500/35 bg-[radial-gradient(ellipse_78%_52%_at_50%_0%,rgba(129,140,248,0.14),transparent_58%),linear-gradient(180deg,#0f172a_0%,#020617_52%,#020617_100%)] px-4 py-5 shadow-[inset_0_0_80px_rgba(30,27,75,0.35),0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-md sm:gap-5 sm:px-7 sm:py-7"
        role="region"
        aria-label="Power resolution"
      >
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.35em] text-indigo-300/90 sm:text-[10px]">
            Power clash
          </span>
          <div className="h-px w-[min(100%,18rem)] bg-linear-to-r from-transparent via-indigo-400/35 to-transparent" />
        </div>
        {room.targetSuit && (
          <HoldDelayTooltip caption={HUD_HOLD_TARGET_SUIT_CAPTION} className="flex flex-col items-center">
            <CompactTableGlyphRow suit={room.targetSuit} greedJointTrump={greedJointTrumpUi} />
          </HoldDelayTooltip>
        )}
        {!powerShowdown && opponentPendingDecision && (
          <OpponentDecisionStrip opponentName={opponent.name} decision={opponentPendingDecision} />
        )}
        <div className="flex items-start justify-center gap-6 sm:gap-14 md:gap-20">
          <div className="relative flex flex-col items-center gap-2 pt-4 sm:pt-6">
            <span className="max-w-[11rem] truncate text-[10px] uppercase font-black text-emerald-400 sm:text-[11px]">
              {me.name}
            </span>
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
                  <div className="origin-top scale-[0.72] opacity-95 drop-shadow-[0_0_20px_rgba(220,38,38,0.45)] sm:scale-[0.78]">
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
                  <div className="origin-center scale-[0.72] opacity-95 drop-shadow-[0_0_20px_rgba(16,185,129,0.48)] sm:scale-[0.78]">
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
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Power</span>
              </div>
            )}
          </div>

          <div className="relative flex flex-col items-center gap-2 pt-4 sm:pt-6">
            <span className="max-w-[11rem] truncate text-[10px] uppercase font-black text-emerald-500 sm:text-[11px]">
              {opponent.name}
            </span>
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
                  <div className="origin-top scale-[0.72] opacity-95 drop-shadow-[0_0_20px_rgba(220,38,38,0.45)] sm:scale-[0.78]">
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
                  <div className="origin-center scale-[0.72] opacity-95 drop-shadow-[0_0_20px_rgba(16,185,129,0.48)] sm:scale-[0.78]">
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
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Power</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

