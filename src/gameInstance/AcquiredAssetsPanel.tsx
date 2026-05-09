/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Flame, Plus, Zap } from 'lucide-react';
import { parseCard, displaySuitCardValue } from '../services/gameService';
import type { OutcomeGainItem, Suit } from '../types';
import { CardVisual, PowerCardVisual, SUIT_COLORS } from '../components/GameVisuals';
import { SuitGlyph } from '../components/SuitGlyphs';

export const InsightModal: React.FC<{
  intel: { type: string; cards: string[]; powerCards: number[] };
  onClose: () => void;
}> = ({ intel, onClose }) => {
  const isPriestess = intel.type === 'Priestess'; // Hypothetical flag or check name
  const revealPool = useMemo(
    () => [
      ...intel.cards.map((card) => ({ kind: 'card' as const, value: card })),
      ...intel.powerCards.map((power) => ({ kind: 'power' as const, value: power })),
    ],
    [intel.cards, intel.powerCards]
  );
  const revealOrder = useMemo(() => {
    const indices = revealPool.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [revealPool]);
  const revealTarget = isPriestess ? revealPool.length : Math.ceil(revealPool.length / 2);
  const [revealedCount, setRevealedCount] = useState(isPriestess ? revealPool.length : 0);

  useEffect(() => {
    if (isPriestess) {
      setRevealedCount(revealPool.length);
      return;
    }
    setRevealedCount(0);
    let idx = 0;
    const timer = setInterval(() => {
      idx += 1;
      setRevealedCount(idx);
      if (idx >= revealTarget) clearInterval(timer);
    }, 180);
    return () => clearInterval(timer);
  }, [isPriestess, revealPool.length, revealTarget]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl">
      <div className="w-full max-w-4xl bg-gradient-to-br from-slate-900 to-black p-8 rounded-3xl border-4 border-yellow-500/30 shadow-2xl flex flex-col items-center gap-8 relative overflow-visible">
        <div className="absolute top-0 left-0 w-full h-1 bg-yellow-500/50 shadow-[0_0_20px_yellow]" />
        <div className="text-center space-y-2">
          <h2 className="text-4xl sm:text-7xl font-black text-yellow-400 uppercase tracking-tight italic">
            {intel.type === 'Priestess' ? 'High Priestess (post-lock)' : 'Hierophant intel'}
          </h2>
          <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-xs">
            {intel.type === 'Priestess'
              ? 'You already locked a card; Priestess hints let you reconsider your play before chips hit the felt.'
              : 'You skim half their hand—including any majors they’re still sitting on.'}
          </p>
        </div>
        <div className="flex flex-col gap-8 w-full items-center">
          <div className="w-full">
            <h3 className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-4 text-center border-b border-slate-800 pb-2">
              {intel.type === 'Priestess' ? 'Opponent lineup snapshot' : 'Hierophant reveal order'}
            </h3>
            <div className="flex flex-wrap gap-4 items-center justify-center overflow-visible py-2">
              {revealPool.map((entry, i) => (
                <div key={`${entry.kind}-${i}`}>
                  {revealOrder.slice(0, revealedCount).includes(i) ? (
                    entry.kind === 'card' ? (
                      <CardVisual card={entry.value as string} noAnimate />
                    ) : (
                      <PowerCardVisual cardId={entry.value as number} small />
                    )
                  ) : entry.kind === 'card' ? (
                    <CardVisual card="" revealed={false} disabled noAnimate />
                  ) : (
                    <PowerCardVisual cardId={0} small revealed={false} />
                  )}
                </div>
              ))}
            </div>
            {!isPriestess && (
              <p className="text-center text-[10px] uppercase tracking-widest text-yellow-500/80 mt-3">
                Revealed {Math.min(revealedCount, revealTarget)} of {revealPool.length} cards and powers
              </p>
            )}
            {intel.type === 'Priestess' && intel.powerCards.length > 0 && (
              <div className="mt-4 text-center text-[10px] uppercase tracking-widest text-yellow-500/80">
                Opponent has {intel.powerCards.length} held power card{intel.powerCards.length === 1 ? '' : 's'}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="bg-yellow-500 text-black px-12 py-4 rounded-full font-black uppercase tracking-widest text-base shadow-[0_0_40px_rgba(234,179,8,0.3)] transition-all hover:scale-110 active:scale-95"
        >
          {intel.type === 'Priestess' ? 'Back to table' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

/** Compact playing-card tile matching TOKEN / DRAW hologram boxes (vector corners, not shrunk CardVisual). */
const AcquiredCardMiniTile: React.FC<{ cardId: string }> = ({ cardId }) => {
  const pc = parseCard(cardId);
  const rankText = pc.isJoker
    ? 'J'
    : pc.suit && pc.value
      ? displaySuitCardValue(pc.suit, pc.value)
      : '?';
  const suitKey = pc.isJoker ? 'Joker' : pc.suit || 'Stars';
  const cornerCls = `${SUIT_COLORS[suitKey as Suit] ?? 'text-slate-900'}`;

  return (
    <div className="flex h-16 w-12 sm:h-24 sm:w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-blue-400/45 bg-blue-900/25 px-0.5 pb-1 pt-1 shadow-[0_0_22px_rgba(59,130,246,0.18)] backdrop-blur-sm">
      <div className="relative flex h-[2.55rem] w-[1.8rem] flex-col rounded-[3px] border-[1.5px] border-slate-300/95 bg-white shadow-md sm:h-[3rem] sm:w-[2.15rem]">
        <div className={`flex flex-1 flex-col items-start px-[2px] pt-[2px] ${cornerCls}`}>
          <span className="max-w-[1.65rem] truncate text-[5px] font-black leading-none sm:text-[6px]">{rankText}</span>
          <SuitGlyph suit={suitKey} className="mt-px h-2 w-2 shrink-0 sm:h-2.5 sm:w-2.5" />
        </div>
        <div className={`mt-auto flex rotate-180 flex-col items-start self-end px-[2px] pb-[2px] ${cornerCls}`}>
          <span className="max-w-[1.65rem] truncate text-[5px] font-black leading-none sm:text-[6px]">{rankText}</span>
          <SuitGlyph suit={suitKey} className="mt-px h-2 w-2 shrink-0 sm:h-2.5 sm:w-2.5" />
        </div>
      </div>
      <span className="text-[6px] font-black uppercase tracking-tighter text-blue-100 sm:text-[7px]">CARD</span>
    </div>
  );
};

export const AcquiredAssets: React.FC<{
  gains: OutcomeGainItem[];
  side: 'left' | 'right';
  label: string;
  /** Slower staggers + draw arcs when deck has just emptied into bones */
  acquisitionPace?: 'normal' | 'deliberate';
}> = ({ gains, side, label, acquisitionPace = 'normal' }) => {
  if (!gains || gains.length === 0) return null;

  const deliberate = acquisitionPace === 'deliberate';

  return (
    <div
      className={`absolute top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50 ${side === 'left' ? 'left-6 sm:left-16' : 'right-6 sm:right-16'}`}
    >
      <div className={`flex flex-col mb-4 ${side === 'left' ? 'items-start' : 'items-end'}`}>
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">{label}</span>
        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-900 border-t border-emerald-900/30 pt-1">
          Acquired
        </span>
      </div>
      <div className={`flex flex-col gap-4 ${side === 'left' ? 'items-start' : 'items-end'}`}>
        {gains.map((gain, i) => (
          <motion.div
            key={i}
            initial={{ x: side === 'left' ? -20 : 20, opacity: 0, scale: 0.8 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            transition={
              deliberate
                ? {
                    delay: 1.15 + i * 0.68,
                    type: 'spring',
                    damping: 26,
                    stiffness: 38,
                  }
                : { delay: 0.8 + i * 0.15, type: 'spring', damping: 15 }
            }
            className="relative"
          >
            {gain.type === 'card' && typeof gain.id === 'string' && <AcquiredCardMiniTile cardId={gain.id} />}
            {gain.type === 'power' && (
              <div className="scale-65 sm:scale-90 origin-center">
                <PowerCardVisual cardId={gain.id as number} small />
              </div>
            )}
            {gain.type === 'draw' &&
              (() => {
                const isLose = typeof gain.id === 'number' && gain.id < 0;
                const isPowerGain = gain.id === 'random-power';
                const isWorldCurse = gain.id === 'world-curse';
                const isNewCard = gain.id === 'new-card';
                const isFamineBone = gain.id === 'famine-bone';
                const hologramClasses = isLose
                  ? 'bg-red-900/25 border-red-400/45 shadow-[0_0_24px_rgba(239,68,68,0.2)]'
                  : isPowerGain
                    ? 'bg-white/[0.08] border-white/35 shadow-[0_0_22px_rgba(255,255,255,0.12)]'
                    : isWorldCurse
                      ? 'bg-violet-950/35 border-violet-400/45 shadow-[0_0_22px_rgba(167,139,250,0.22)]'
                      : isFamineBone
                        ? 'bg-emerald-900/24 border-emerald-500/35 shadow-[0_0_22px_rgba(16,185,129,0.14)]'
                        : isNewCard
                          ? 'bg-blue-900/25 border-blue-400/45 shadow-[0_0_22px_rgba(59,130,246,0.18)]'
                          : 'bg-emerald-900/20 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]';
                const haloClasses = isLose
                  ? 'bg-red-500/20 border-red-500/55 text-red-300'
                  : isPowerGain
                    ? 'bg-white/15 border-white/50 text-white'
                    : isWorldCurse
                      ? 'bg-violet-600/25 border-violet-400/55 text-violet-100'
                      : isFamineBone
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : isNewCard
                          ? 'bg-blue-500/20 border-blue-400/55 text-blue-200'
                          : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
                let drawLabel =
                  typeof gain.id === 'number' && gain.id < 0
                    ? 'LOSE'
                    : gain.id === 'random-power'
                      ? 'POWER'
                      : isWorldCurse
                        ? 'CURSE'
                        : isFamineBone
                          ? 'BONE'
                          : gain.id === 'new-card'
                            ? 'NEW CARD'
                            : 'DRAW';
                return (
                  <div
                    className={`w-12 h-16 sm:w-16 sm:h-24 rounded-lg border flex flex-col items-center justify-center gap-1 backdrop-blur-sm ${hologramClasses}`}
                  >
                    <div
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border flex flex-col items-center justify-center shrink-0 ${haloClasses}`}
                    >
                      {gain.id === 'standard' ? (
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                      ) : isFamineBone ? (
                        <SuitGlyph suit="Bones" className="w-3 h-3 sm:w-4 sm:h-4" />
                      ) : isNewCard ? (
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4 text-blue-200" />
                      ) : typeof gain.id === 'number' && gain.id > 0 ? (
                        <>
                          <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="text-[8px] sm:text-[9px] font-black leading-none">{gain.id}</span>
                        </>
                      ) : typeof gain.id === 'number' && gain.id < 0 ? (
                        <span className="text-[9px] sm:text-[10px] font-black">{Math.abs(gain.id)}</span>
                      ) : gain.id === 'random-power' ? (
                        <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
                      ) : isWorldCurse ? (
                        <Flame className="w-3 h-3 sm:w-4 sm:h-4 text-violet-200" />
                      ) : (
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                      )}
                    </div>
                    <span
                      className={`text-[6px] sm:text-[7px] font-black uppercase tracking-tighter opacity-95 ${
                        isLose
                          ? 'text-red-200'
                          : isPowerGain
                            ? 'text-white/95'
                            : isWorldCurse
                              ? 'text-violet-100'
                              : isFamineBone
                                ? 'text-emerald-200'
                                : isNewCard
                                  ? 'text-blue-100'
                                  : 'text-emerald-300'
                      }`}
                    >
                      {drawLabel}
                    </span>
                  </div>
                );
              })()}
            {gain.type === 'token' && typeof gain.id === 'number' && gain.id > 0 && (
              <div className="w-12 h-16 sm:w-16 sm:h-24 rounded-lg border border-yellow-400/55 bg-yellow-900/20 shadow-[0_0_24px_rgba(250,204,21,0.18)] flex flex-col items-center justify-center gap-1 backdrop-blur-sm">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border border-yellow-300/65 bg-yellow-500/20 flex items-center justify-center">
                  <svg viewBox="0 0 300 300" className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" aria-hidden>
                    <g fill="currentColor">
                      <path d="M244.63,35.621c-21.771-18.635-47.382-29.855-73.767-33.902C121.871-5.797,70.223,11.421,35.622,51.847 c-53.236,62.198-45.972,155.773,16.226,209.01c21.771,18.634,47.381,29.853,73.766,33.901 c48.991,7.517,100.641-9.703,135.241-50.13C314.091,182.431,306.826,88.856,244.63,35.621z M273.361,191.241l-45.305-15.618 c6.102-17.803,6.028-37.107,0.014-54.724l45.257-15.575c3.577,10.453,5.862,21.429,6.74,32.741 C281.489,156.374,279.152,174.388,273.361,191.241z M247.935,61.472l-36.069,31.332c-2.669-3.055-5.579-5.961-8.752-8.677 c-11.467-9.814-24.81-15.995-38.637-18.692l9.095-46.741c22.33,4.33,43.21,14.294,60.635,29.209 C239.147,52.131,243.728,56.669,247.935,61.472z M103.251,23.983c6.428-2.315,13.021-4.109,19.71-5.388l9.087,46.843 c-17.789,3.467-34.584,12.651-47.393,27.341L48.55,61.38C63.334,44.416,82.206,31.568,103.251,23.983z M23.124,105.236 l45.297,15.617c-6.102,17.803-6.028,37.105-0.015,54.723l-45.295,15.588c-3.562-10.441-5.837-21.4-6.713-32.688 C14.976,140.151,17.32,122.11,23.124,105.236z M48.467,235.066l36.145-31.395c2.669,3.056,5.58,5.964,8.754,8.68 c11.466,9.814,24.808,15.993,38.634,18.691l-9.143,46.997c-22.325-4.348-43.185-14.422-60.604-29.333 C57.288,244.458,52.689,239.898,48.467,235.066z M193.203,272.635c-6.409,2.309-12.986,4.11-19.658,5.403l-9.117-47 c17.789-3.467,34.585-12.651,47.394-27.342l36.121,31.409C233.154,252.087,214.257,265.047,193.203,272.635z" />
                      <circle cx="93.372" cy="53.498" r="8" />
                      <circle cx="38.758" cy="148.382" r="8" />
                      <circle cx="93.623" cy="243.123" r="8" />
                      <circle cx="203.105" cy="242.977" r="8.001" />
                      <circle cx="257.717" cy="148.091" r="8" />
                      <circle cx="202.853" cy="53.351" r="8" />
                    </g>
                  </svg>
                </div>
                <span className="text-[10px] sm:text-xs font-black text-yellow-200 leading-none">{gain.id}</span>
                <span className="text-[6px] sm:text-[7px] font-black uppercase tracking-tighter text-yellow-300/90">TOKEN</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
