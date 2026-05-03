import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, RotateCcw, Skull } from 'lucide-react';
import {
  ConfigurableWheel,
  buildTargetSuitWheelDefinition,
  desperationWheelDefinition,
  resolveWheelSegments,
  wheelDiscRotationDeg,
} from '../wheels';
import { DesperationTierRow, Suit, SUITS } from '../types';
import { desperationLadderLabel, desperationSidebarHighlightLadderIdx } from '../utils/desperationUi';

const DESPERATION_WHEEL_SEGMENTS = resolveWheelSegments(desperationWheelDefinition);

export const DesperationWheel: React.FC<{
  onSpin: (offset: number) => void;
  onClose: () => void;
  onResolve: () => void;
  isSpinning: boolean;
  result: string | null;
  offset: number;
  /** Ladder indices + labels omitting inactive tier slot when tier-0-from-deal is off. */
  tierRows: DesperationTierRow[];
  /** Full tiers text for footer “next step” lookups (indexed by desperationTier). */
  allTierLabels: string[];
  desperationTier: number;
  isSpectator?: boolean;
  /** Compact wheel over the opposing-hand mockups (spectator sizing). */
  opposingHandOverlay?: boolean;
}> = ({
  onSpin,
  onClose,
  onResolve,
  isSpinning,
  result,
  offset,
  tierRows,
  allTierLabels,
  desperationTier,
  isSpectator = false,
  opposingHandOverlay = false,
}) => {
  const [showResult, setShowResult] = useState(false);

  const spinSeconds = desperationWheelDefinition.spinDurationSeconds;

  const highlightIdx = desperationSidebarHighlightLadderIdx(desperationTier, isSpinning, result);

  useEffect(() => {
    if (isSpinning) {
      setShowResult(false);
      const timer = setTimeout(() => {
        setShowResult(true);
      }, spinSeconds * 1000);
      return () => clearTimeout(timer);
    } else if (result) {
      setShowResult(true);
    }
  }, [isSpinning, result, spinSeconds]);

  const nextLadderIdx = desperationTier < 0 ? 1 : desperationTier + 1;

  const rootTone = opposingHandOverlay
    ? 'bg-gradient-to-b from-purple-950/75 via-purple-950/25 to-transparent'
    : isSpectator
      ? 'bg-black/40 backdrop-blur-sm'
      : 'bg-black/95 backdrop-blur-2xl';

  const layoutClass = opposingHandOverlay
    ? 'relative z-[24] mx-auto mt-10 flex w-full max-w-[min(100%,20rem)] flex-col items-center justify-start overflow-visible px-1 py-1 sm:mt-14'
    : 'absolute inset-0 z-[200] flex flex-col items-center justify-center p-4 overflow-hidden rounded-3xl transition-all duration-1000';

  return (
    <div className={`${layoutClass} ${rootTone}`}>
      {!isSpectator && !opposingHandOverlay && (
        <div className="absolute top-8 left-8 hidden space-y-4 sm:block">
          <h3 className="text-[10px] font-black uppercase tracking-widest border-l-4 border-purple-400 pl-3 text-purple-400">
            Desperation
          </h3>
          <div className="space-y-4">
            {tierRows.map(({ ladderIdx, label }) => (
              <div key={ladderIdx} className="flex items-center gap-3">
                <div
                  className={`h-2 w-2 rounded-full ${ladderIdx === highlightIdx ? 'bg-purple-500 shadow-[0_0_10px_purple]' : 'bg-emerald-900/40'}`}
                />
                <span
                  className={`text-[9px] font-black uppercase transition-colors ${ladderIdx === highlightIdx ? 'text-white' : 'text-emerald-800'}`}
                >
                  {label}
                </span>
                {ladderIdx === highlightIdx && <ChevronRight className="h-3 w-3 text-purple-500" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {isSpectator && !opposingHandOverlay && (
        <div className="pointer-events-none absolute top-8 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
          <Skull className="h-8 w-8 animate-pulse text-purple-500" />
          <span className="text-[11px] font-black uppercase tracking-[0.4em] text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            OPPONENT SPINNING
          </span>
        </div>
      )}

      <div
        className={`relative mb-2 transition-all duration-1000 ${
          opposingHandOverlay ? 'scale-[0.48] sm:scale-[0.52]' : isSpectator ? 'scale-50 sm:scale-75 -translate-y-12' : 'mb-8 scale-100'
        } `}
      >
        <div
          className={`relative mx-auto shadow-[0_0_80px_rgba(168,85,247,0.2)] ${
            opposingHandOverlay
              ? 'aspect-square w-[min(11rem,72vw)] max-w-full sm:w-52'
              : 'aspect-square w-[min(18rem,85vw)] sm:w-[min(30rem,90vw)]'
          }`}
        >
          <ConfigurableWheel
            definition={desperationWheelDefinition}
            segments={DESPERATION_WHEEL_SEGMENTS}
            offset={offset}
            spinning={isSpinning}
            decorativeRings={!opposingHandOverlay && !isSpectator}
            className="shadow-[0_0_80px_rgba(168,85,247,0.2)]"
            sizeClass="h-full w-full min-h-0"
            renderCenter={
              !isSpectator ? (
                <button
                  type="button"
                  onClick={() => !isSpinning && !result && onSpin(Math.random())}
                  disabled={isSpinning || !!result}
                  className={`
                  relative z-20 flex h-24 w-24 sm:h-32 sm:w-32 shrink-0 cursor-pointer items-center justify-center rounded-full border-4 border-white/10 bg-purple-600 shadow-2xl transition-all active:scale-95
                  ${isSpinning || !!result ? 'cursor-not-allowed opacity-50 grayscale' : 'hover:scale-110 hover:bg-purple-500 hover:shadow-[0_0_50px_rgba(168,85,247,0.5)]'}
                `}
                >
                  <div className="rotate-[-8deg] bg-emerald-950 px-4 py-1.5 shadow-xl transition-transform group-hover:rotate-0">
                    <span className="text-xl font-black uppercase italic tracking-[0.1em] text-white sm:text-2xl">SPIN</span>
                  </div>
                </button>
              ) : (
                <div className="z-20 flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-purple-500/20 bg-purple-950 sm:h-32 sm:w-32">
                  <Skull className="h-10 w-10 animate-pulse text-purple-700" />
                </div>
              )
            }
          />
        </div>
      </div>

      {!opposingHandOverlay && (
        <div className="flex h-48 w-full max-w-lg flex-col justify-center text-center">
          {isSpinning && !showResult && (
            <div className={`flex flex-col items-center gap-4 ${opposingHandOverlay ? 'scale-75' : ''}`}>
              <div className="text-[14px] font-black italic uppercase tracking-[0.5em] text-purple-400 animate-pulse">
                SIMULATING OUTCOME
              </div>
              <div className="h-1 w-64 overflow-hidden rounded-full border border-purple-500/20 bg-emerald-950">
                <motion.div
                  className="h-full bg-purple-500"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: spinSeconds, ease: 'linear' }}
                />
              </div>
              {isSpectator && !opposingHandOverlay && (
                <span className="mt-2 animate-pulse text-[10px] font-black uppercase tracking-widest text-emerald-800">
                  Monitoring Live Feed...
                </span>
              )}
            </div>
          )}

          {showResult && result && (
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className={`flex flex-col items-center gap-6 ${opposingHandOverlay ? 'scale-[0.82]' : ''}`}
            >
              <div className="flex flex-col items-center">
                <span className="mb-2 text-[11px] font-black uppercase tracking-[0.5em] text-purple-500">
                  {isSpectator ? 'Opponent spun' : 'Result'}
                </span>
                <div
                  className={`text-5xl font-black uppercase tracking-tighter sm:text-7xl ${result === 'GAME OVER' ? 'text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]'}`}
                >
                  {result.toUpperCase().replace('GAIN', 'DRAW')}
                </div>
              </div>

              {!isSpectator && (
                <button
                  onClick={onResolve}
                  className="animate-pulse rounded-full bg-white px-20 py-4 font-black uppercase tracking-[0.1em] text-[15px] text-emerald-950 shadow-[0_0_60px_rgba(255,255,255,0.3)] transition-all hover:bg-yellow-400 active:scale-95"
                >
                  {result === 'GAME OVER' ? 'End game' : 'Continue'}
                </button>
              )}
            </motion.div>
          )}

          {!isSpinning && !result && !isSpectator && (
            <div className={`flex flex-col items-center gap-4 ${opposingHandOverlay ? 'hidden' : ''}`}>
              <div className="rounded-full border border-purple-500/20 bg-purple-900/30 px-6 py-2">
                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-purple-400">
                  Next ladder index {nextLadderIdx} · {tierRows.length} rungs configured
                </span>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                {desperationLadderLabel(allTierLabels, nextLadderIdx) ?? '—'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="group flex items-center gap-2 text-[10px] font-black uppercase text-emerald-800 transition-all hover:text-white"
              >
                <RotateCcw className="h-4 w-4 transition-transform group-hover:rotate-[-90deg]" /> ABORT
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export interface TargetSuitWheelProps {
  suit: Suit | null;
  isSpinning: boolean;
  offset?: number;
  /** Read-only: callers may pass duplicate suits per slice or any `Suit` union member. */
  availableSuits?: readonly Suit[];
  /** Lust curse: Hearts slice gets triple weight on the dial. */
  lustTripleHearts?: boolean;
  /** Greed curse: Hearts, Clubs, Spades slices each get half weight. */
  greedHalveBasicSuits?: boolean;
  /** Greed joint trump visual on the Diamonds wedge (Diamonds + Coins). */
  greedJointDiamondCoinGlyphs?: boolean;
  /** Raster / artwork table: suit art + felt-coloured slices on the dial. */
  artworkTable?: boolean;
}

export const TargetSuitWheel: React.FC<TargetSuitWheelProps> = ({
  suit: _chosenSuit,
  isSpinning,
  offset = 0.5,
  availableSuits = SUITS,
  lustTripleHearts = false,
  greedHalveBasicSuits = false,
  greedJointDiamondCoinGlyphs = false,
  artworkTable = false,
}) => {
  const wheelDef = useMemo(
    () =>
      buildTargetSuitWheelDefinition(availableSuits, {
        lustTripleHearts,
        greedHalveBasicSuits,
        greedJointDiamondCoinGlyphs,
        artworkTable,
      }),
    [availableSuits, lustTripleHearts, greedHalveBasicSuits, greedJointDiamondCoinGlyphs, artworkTable],
  );
  const segments = useMemo(() => resolveWheelSegments(wheelDef), [wheelDef]);

  const discRotation = useMemo(
    () =>
      wheelDiscRotationDeg({
        offset,
        spinning: isSpinning,
        segments,
        extraSpins: wheelDef.extraSpinsWhileSpinning,
      }),
    [offset, isSpinning, segments, wheelDef.extraSpinsWhileSpinning],
  );

  return (
    <div className="relative flex flex-col items-center pt-5">
      <div className="relative z-10 aspect-square w-[min(14.4rem,92vw)] shrink-0 sm:w-[14.4rem]">
        <div className="pointer-events-none absolute inset-0 z-[5] rounded-full bg-linear-to-tr from-white/10 to-transparent" />
        <ConfigurableWheel
          definition={wheelDef}
          segments={segments}
          offset={0}
          spinning={isSpinning}
          discRotationDeg={discRotation}
          sizeClass="h-full w-full min-h-0"
          className="shadow-[0_0_52px_rgba(0,0,0,0.88)]"
        />
      </div>
    </div>
  );
};
