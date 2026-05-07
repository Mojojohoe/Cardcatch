import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { RoomData } from '../types';
import {
  buildPanicExchangeFrames,
  lustReplayContextFromOutcome,
  panicOpponentWrathPenaltyFromOutcome,
  panicSwordStrikeStrength,
  reduceCardRankForPanicDisplay,
} from '../services/gameService';
import { greedCurseActive } from '../curses';
import { CardVisual } from './GameVisuals';

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

const PanicStrikeCut: React.FC = () => (
  <motion.div
    className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-xl"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="absolute left-[-28%] top-1/2 h-[7px] w-[155%] origin-center -translate-y-1/2 rotate-[-36deg] bg-linear-to-r from-transparent via-white to-red-600 shadow-[0_0_32px_rgba(239,68,68,1)]"
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    />
    <motion.div
      className="pointer-events-none absolute inset-0 z-[29] flex overflow-hidden rounded-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
    >
      <motion.div
        className="h-full w-1/2 bg-black/50 backdrop-blur-[0.5px]"
        initial={{ x: 0 }}
        animate={{ x: '-32%' }}
        transition={{ delay: 0.15, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div
        className="h-full w-1/2 bg-black/50 backdrop-blur-[0.5px]"
        initial={{ x: 0 }}
        animate={{ x: '32%' }}
        transition={{ delay: 0.15, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.div>
  </motion.div>
);

const PanicTearFx: React.FC = () => (
  <motion.div
    className="pointer-events-none absolute inset-0 z-[34]"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="absolute inset-0"
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x: -44, y: 58, rotate: -16, opacity: [1, 1, 0.05] }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      style={{ clipPath: 'polygon(0% 0%, 53% 0%, 49% 12%, 55% 24%, 47% 38%, 56% 50%, 48% 64%, 54% 79%, 50% 100%, 0% 100%)' }}
    />
    <motion.div
      className="absolute inset-0"
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x: 44, y: 58, rotate: 16, opacity: [1, 1, 0.05] }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      style={{ clipPath: 'polygon(47% 0%, 100% 0%, 100% 100%, 50% 100%, 54% 82%, 46% 66%, 53% 50%, 45% 34%, 51% 17%)' }}
    />
  </motion.div>
);

const INTRO_REVEAL_MS = 580;
/** Card stays centered after reveal (before reposition / exchange loop). */
const INTRO_HOLD_MS = 1000;
/** Delay after centered card before repositioning (“re-resolve”). */
const PAUSE_BEFORE_CLASH_LAYOUT_MS = 1000;
const LAYOUT_SWITCH_MS = 420;
/** Simultaneous −1 panic vs opponent stamina, every beat. */
const EXCHANGE_STEP_MS = 600;
const OUTRO_PAUSE_MS = 900;

export type PanicClashDismissReason = 'aborted' | 'complete';

export const PanicClashResolution: React.FC<{
  room: RoomData;
  /** `complete` after the scripted exchange + outro; `aborted` when there is nothing to animate (immediate dismiss). */
  onComplete: (reason: PanicClashDismissReason) => void;
}> = ({
  room,
  onComplete,
}) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const outcome = room.lastOutcome!;
  const fx = outcome.panicFx!;
  const opponentUid = fx.opponentUid;
  const panicCardId = fx.panicCardId;
  const oppCardId =
    outcome.initialCardsPlayed?.[opponentUid] ?? outcome.cardsPlayed[opponentUid];
  const opponentName = room.players[opponentUid]?.name ?? 'Opponent';

  const greedTax =
    room.settings.enableCurseCards !== false && greedCurseActive(room.activeCurses ?? []);
  const wrathPen = oppCardId ? panicOpponentWrathPenaltyFromOutcome(outcome, opponentUid, oppCardId) : 0;
  const hostUid = room.hostUid;
  const guestUid = Object.keys(room.players).find((id) => id !== hostUid) ?? '';
  const opponentLustBump =
    guestUid && oppCardId
      ? lustReplayContextFromOutcome(room, outcome, hostUid, guestUid).lhPlayed(oppCardId)
      : false;

  const { frames, exchanges } = useMemo(
    () =>
      oppCardId
        ? buildPanicExchangeFrames({
            panicCardId,
            opponentCardId: oppCardId,
            opponentWrathPenalty: wrathPen,
            greedTaxActive: greedTax,
            opponentLustBump,
          })
        : { frames: [] as { panicRemaining: number; opponentEffective: number }[], exchanges: 0 },
    [panicCardId, oppCardId, wrathPen, greedTax, opponentLustBump],
  );

  const [phase, setPhase] = useState<'intro' | 'clash' | 'done'>('intro');
  const [frameIdx, setFrameIdx] = useState(0);
  const [showCut, setShowCut] = useState(false);
  const [strikeKey, setStrikeKey] = useState(0);
  const [tearPanic, setTearPanic] = useState(false);
  const [tearOpp, setTearOpp] = useState(false);
  const initialPanic = frames[0]?.panicRemaining ?? panicSwordStrikeStrength(panicCardId);
  const initialOpponent = frames[0]?.opponentEffective ?? 0;
  const f = frames[Math.min(frameIdx, Math.max(0, frames.length - 1))] ?? {
    panicRemaining: 0,
    opponentEffective: 0,
  };
  const panicCardFx = reduceCardRankForPanicDisplay(panicCardId, Math.max(0, initialPanic - f.panicRemaining));
  const opponentCardFx =
    oppCardId == null ? '' : reduceCardRankForPanicDisplay(oppCardId, Math.max(0, initialOpponent - f.opponentEffective));

  useEffect(() => {
    if (!oppCardId || frames.length === 0) {
      onCompleteRef.current('aborted');
      return;
    }
    let cancelled = false;

    const run = async () => {
      await sleep(INTRO_REVEAL_MS);
      await sleep(INTRO_HOLD_MS);
      if (cancelled) return;

      await sleep(PAUSE_BEFORE_CLASH_LAYOUT_MS);
      if (cancelled) return;
      setPhase('clash');
      await sleep(LAYOUT_SWITCH_MS);
      if (cancelled) return;

      /** After layout: frameIdx 0 = before first exchange */
      let idx = 0;
      setFrameIdx(0);

      if (exchanges <= 0) {
        await sleep(EXCHANGE_STEP_MS);
        if (cancelled) return;
      } else {
        for (let step = 0; step < exchanges; step++) {
          await sleep(EXCHANGE_STEP_MS);
          if (cancelled) return;
          idx += 1;
          setStrikeKey((k) => k + 1);
          setShowCut(true);
          await sleep(480);
          if (cancelled) return;
          setShowCut(false);
          setFrameIdx(idx);
          const next = frames[Math.min(idx, frames.length - 1)];
          if (next && next.opponentEffective <= 0 && !tearOpp) setTearOpp(true);
          if (next && next.panicRemaining <= 0 && !tearPanic) setTearPanic(true);
        }
      }

      setPhase('done');
      await sleep(OUTRO_PAUSE_MS);
      if (cancelled) return;
      onCompleteRef.current('complete');
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [oppCardId, frames.length, exchanges]);

  return (
    <motion.div
      className="absolute inset-0 z-[318] flex flex-col items-center justify-center bg-black/94 px-4 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      role="presentation"
    >
      <p className="mb-10 max-w-xl text-center text-[10px] font-black uppercase tracking-[0.28em] text-amber-400/90">
        Panic blade — exchanging clash stamina
      </p>

      {phase === 'intro' ? (
        <motion.div
          className="flex flex-col items-center gap-8"
          initial={{ scale: 0.45, opacity: 0, y: 18 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        >
          <span className="text-center text-xs font-black uppercase italic tracking-wide text-white/90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]">
            Rolled blade
          </span>
          <CardVisual card={panicCardId} revealed noAnimate presentation="none" lustHeartRulesActive={false} />
          <div className="-mt-6 rounded-xl border border-red-900/55 bg-black/45 px-4 py-2 text-center shadow-[inset_0_0_0_1px_rgba(220,38,38,0.15)] backdrop-blur-sm">
            <span className="text-[16px] font-black tabular-nums text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.45)]">
              Panic stamina{' '}
              {frames.length > 0 ? frames[0].panicRemaining : panicSwordStrikeStrength(panicCardId)}
            </span>
          </div>
        </motion.div>
      ) : phase === 'done' ? (
        <motion.div
          className="text-center text-[11px] font-bold uppercase tracking-widest text-emerald-300/90"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Outcome restored — recap below
        </motion.div>
      ) : (
        <div className="relative flex flex-col items-center gap-14">
          <motion.div
            key="panic-slot"
            className="relative z-10"
            initial={{ y: -120, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <div className="relative rounded-xl shadow-[0_22px_50px_rgba(127,29,29,0.45)]">
              <AnimatePresence mode="wait">
                {showCut ? <PanicStrikeCut key={`panic-cut-${strikeKey}`} /> : null}
              </AnimatePresence>
              <AnimatePresence>{tearPanic ? <PanicTearFx key="panic-tear" /> : null}</AnimatePresence>
              {!tearPanic && (
                <CardVisual card={panicCardFx} revealed noAnimate presentation="none" lustHeartRulesActive={false} />
              )}
            </div>
            <StatBadge tone="panic" label="Panic" value={f.panicRemaining} />
          </motion.div>

          <div className="relative flex flex-col items-center gap-5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{opponentName}</span>
            <div className="relative rounded-xl shadow-[0_22px_50px_rgba(0,0,0,0.55)]">
              <AnimatePresence mode="wait">
                {showCut ? <PanicStrikeCut key={`opp-cut-${strikeKey}`} /> : null}
              </AnimatePresence>
              <AnimatePresence>{tearOpp ? <PanicTearFx key="opp-tear" /> : null}</AnimatePresence>
              {!tearOpp && (
                <CardVisual
                  card={opponentCardFx}
                  revealed
                  noAnimate
                  presentation="none"
                  lustHeartRulesActive={false}
                  clashGhost={Boolean(outcome.clashDestroyedByPenalty?.[opponentUid])}
                />
              )}
            </div>
            <StatBadge tone="opp" label="Clash stamina" value={f.opponentEffective} />
          </div>
        </div>
      )}
    </motion.div>
  );
};

function StatBadge({ label, value, tone }: { label: string; value: number; tone: 'panic' | 'opp' }) {
  const hue =
    tone === 'panic' ? 'border-red-800/65 text-red-200 bg-red-950/35' : 'border-sky-900/65 text-sky-100 bg-sky-950/35';
  return (
    <div className={`mt-5 flex min-w-[8.5rem] flex-col items-center gap-1 rounded-xl border px-4 py-2 ${hue}`}>
      <span className="text-[8px] font-black uppercase tracking-widest opacity-85">{label}</span>
      <span className="text-[22px] font-black tabular-nums leading-none">{value}</span>
    </div>
  );
}
