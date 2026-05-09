/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { PowerCardVisual } from '../components/GameVisuals';

export const DraftingPhase: React.FC<{
  draftSets: number[][];
  currentSetIdx: number;
  onSelect: (powerId: number) => void;
  myPowerCards: number[];
  /** True when display mode is raster / art — lighter full-screen scrim so ornate gold frames read clearly. */
  rasterHud: boolean;
}> = ({ draftSets, currentSetIdx, onSelect, myPowerCards, rasterHud }) => {
  const currentSet = draftSets[currentSetIdx] || [];
  const hasSelectedThisTurn = myPowerCards.length > currentSetIdx;

  return (
    <div
      className={`absolute inset-0 z-[150] flex flex-col items-center justify-center overflow-y-auto p-4 ${
        rasterHud ? 'bg-black/55 backdrop-blur-md' : 'bg-emerald-950/95 backdrop-blur-3xl'
      }`}
    >
      <div className="w-full max-w-6xl flex flex-col items-center gap-8 py-10">
        <div className="text-center space-y-2">
          <motion.h2
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl sm:text-7xl font-black text-white italic uppercase tracking-tighter"
          >
            Draft powers
          </motion.h2>
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-20 bg-emerald-800" />
            <p className="text-sm text-emerald-400 font-black uppercase tracking-[0.4em]">Power draft {currentSetIdx + 1} / 3</p>
            <div className="h-px w-20 bg-emerald-800" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 sm:gap-14 items-center justify-center w-full">
          {currentSet.map((id) => (
            <PowerCardVisual
              key={id}
              cardId={id}
              onClick={() => !hasSelectedThisTurn && onSelect(id)}
              disabled={hasSelectedThisTurn}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-col items-center gap-6">
          {hasSelectedThisTurn ? (
            <div className="bg-emerald-900 px-10 py-4 rounded-full border-2 border-emerald-700 shadow-[0_0_30px_rgba(16,185,129,0.1)] flex items-center gap-3 animate-pulse">
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
              <span className="text-white font-black uppercase text-xs tracking-widest">Waiting for Opponent...</span>
            </div>
          ) : (
            <p className="text-yellow-400/80 font-bold uppercase text-[10px] sm:text-xs tracking-widest italic text-center max-w-xs">
              Pick one of the three face-up majors — you keep its effect for exactly one trick.
            </p>
          )}

          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full border-2 ${i < myPowerCards.length ? 'bg-yellow-400 border-yellow-400' : 'border-emerald-800'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
