/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Layers, Sparkles, X } from 'lucide-react';
import {
  CURSES,
  CURSE_GREEN_EYED_MONSTER,
  CURSE_IDS,
} from '../curses';
import {
  CursePowerIcon,
  cursePowerIconClass,
  MajorArcanaIconGlyph,
} from '../components/GameVisuals';
import { MAJOR_ARCANA } from '../types';

export const DevPowerMenu: React.FC<{
  onSelect: (id: number) => void;
  onClose: () => void;
  onOpenAnimationPreview?: () => void;
  curseControlsEnabled?: boolean;
  onActivateCurseOnTable?: (curseId: number) => void;
  onClearActiveCurses?: () => void;
  deckCount?: number;
  handCards?: string[];
  onTrimDeck?: (removeCount: number) => void;
  onDiscardHandCard?: (cardId: string) => void;
}> = ({
  onSelect,
  onClose,
  onOpenAnimationPreview,
  curseControlsEnabled = false,
  onActivateCurseOnTable,
  onClearActiveCurses,
  deckCount,
  handCards,
  onTrimDeck,
  onDiscardHandCard,
}) => {
  return (
    <div className="absolute inset-x-4 top-16 bottom-20 z-[250] bg-black/90 backdrop-blur-xl p-4 overflow-y-auto rounded-3xl border-2 border-yellow-400 shadow-[0_0_100px_rgba(250,204,21,0.2)]">
      <div className="flex justify-between items-center mb-6 sticky top-0 bg-black/90 pb-4 z-10 border-b border-white/10">
        <div className="flex flex-col">
          <h3 className="text-yellow-400 font-black uppercase text-sm tracking-[0.2em] flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Architect Mode
          </h3>
          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Deck / hand testing + forcing powers</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-violet-500/40 bg-violet-950/20 p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">Card art</p>
        <p className="text-[10px] text-slate-400 leading-snug">
          Full-screen card creator (#card-creator). Author raster faces / export bundles for{' '}
          <span className="font-mono text-slate-300">public/</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#card-creator';
            onClose();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-600/55 bg-violet-900/50 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-violet-50 transition-colors hover:border-violet-400/75 hover:bg-violet-800/65"
        >
          <Layers className="h-4 w-4 shrink-0" strokeWidth={2} />
          Open card creator
        </button>
        <button
          type="button"
          onClick={() => {
            if (onOpenAnimationPreview) onOpenAnimationPreview();
            else window.location.hash = '#card-anim-preview';
            onClose();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-600/55 bg-violet-900/35 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-violet-100 transition-colors hover:border-violet-400/75 hover:bg-violet-800/65"
        >
          <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2} />
          Open animation preview lab
        </button>
      </div>

      {onActivateCurseOnTable && onClearActiveCurses && (
        <div className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-950/25 p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Curses · table zone</p>
          <p className="text-[10px] text-slate-400 leading-snug">
            Activates curse effects as if resolved on the board (syncs via host). Use Envy for the table curse (Green-Eyed Monster is the same curse when played from hand). Clearing removes active curses, seals, wrath targets, greed coin injection from the pile, and restores Sloth suit list when applicable.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!curseControlsEnabled}
              onClick={() => onClearActiveCurses()}
              className="rounded-lg border border-amber-800/65 bg-black/35 px-3 py-1.5 text-[10px] font-black uppercase text-amber-200 transition-colors hover:border-amber-500/65 hover:bg-amber-950/60 disabled:pointer-events-none disabled:opacity-35"
            >
              Clear active curses
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CURSE_IDS.filter((id) => id !== CURSE_GREEN_EYED_MONSTER).map((curseId) => {
              const def = CURSES[curseId];
              return (
                <button
                  key={`table-${curseId}`}
                  type="button"
                  disabled={!curseControlsEnabled}
                  onClick={() => {
                    onActivateCurseOnTable(curseId);
                    onClose();
                  }}
                  className="flex items-center gap-3 rounded-xl border border-amber-950/55 bg-black/35 p-2.5 text-left transition-colors hover:border-amber-500/55 hover:bg-amber-950/35 disabled:pointer-events-none disabled:opacity-35"
                >
                  <CursePowerIcon curseId={curseId} className={`h-7 w-7 shrink-0 ${cursePowerIconClass(curseId)}`} />
                  <span className="min-w-0 truncate text-[10px] font-black uppercase text-amber-100">{def.name} → table</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {typeof deckCount === 'number' && onTrimDeck && (
        <div className="mb-5 p-4 rounded-2xl border border-cyan-500/35 bg-cyan-950/30 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Thin the deck</p>
          <p className="text-[10px] text-slate-400 leading-snug">
            Removes from the draw pile ({deckCount} left). Hits famine faster—host executes.
          </p>
          <div className="flex flex-wrap gap-2">
            {[5, 10, 25, 50].map((n) => (
              <button
                key={n}
                type="button"
                disabled={deckCount <= 0}
                onClick={() => onTrimDeck(Math.min(n, deckCount))}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-cyan-900/70 border border-cyan-700/60 text-cyan-100 disabled:opacity-30 hover:bg-cyan-800/90 transition-colors"
              >
                −{n}
              </button>
            ))}
            <button
              type="button"
              disabled={deckCount <= 0}
              onClick={() => onTrimDeck(Math.max(0, deckCount - 5))}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-cyan-900/40 border border-cyan-800/40 text-cyan-200 disabled:opacity-30 hover:bg-cyan-800/70 transition-colors"
            >
              Leave 5
            </button>
            <button
              type="button"
              disabled={deckCount <= 0}
              onClick={() => onTrimDeck(deckCount)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-cyan-900/40 border border-cyan-800/40 text-cyan-200 disabled:opacity-30 hover:bg-cyan-800/70 transition-colors"
            >
              Drain all
            </button>
          </div>
        </div>
      )}

      {handCards && onDiscardHandCard && handCards.length > 0 && (
        <div className="mb-5 p-4 rounded-2xl border border-rose-500/35 bg-rose-950/20 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-300">Discard from my hand</p>
          <p className="text-[10px] text-slate-400 leading-snug">Tap a card to drop it immediately (still obeys host sync).</p>
          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
            {[...handCards].sort().map((cid) => (
              <button
                key={cid}
                type="button"
                onClick={() => onDiscardHandCard(cid)}
                className="px-2 py-1 rounded-md text-[9px] font-mono font-bold uppercase bg-slate-900 border border-slate-700 text-slate-200 hover:border-rose-400/70 hover:bg-slate-800 transition-colors"
              >
                {cid.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
        {MAJOR_ARCANA.map((card, i) => {
          return (
            <button
              key={i}
              onClick={() => {
                onSelect(i);
                onClose();
              }}
              className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-yellow-400/50 hover:bg-slate-800 transition-all text-left group"
            >
              <div className="bg-slate-800 p-2 rounded-lg group-hover:bg-yellow-400 group-hover:text-black transition-colors">
                <MajorArcanaIconGlyph iconName={card.icon} className="w-5 h-5" size={22} />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-500 font-mono">#{i}</span>
                  <span className="text-[11px] font-black text-white uppercase truncate">{card.name}</span>
                </div>
                <p className="text-[9px] text-slate-400 leading-tight line-clamp-1 italic">{card.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="border-t border-white/10 pt-6 mt-2 pb-8">
        <p className="text-[10px] font-black uppercase tracking-widest text-red-400/95 mb-3">
          Curse cards · current power slot
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CURSE_IDS.map((curseId) => {
            const def = CURSES[curseId];
            return (
              <button
                key={curseId}
                type="button"
                onClick={() => {
                  onSelect(curseId);
                  onClose();
                }}
                className="flex items-center gap-3 p-3 rounded-2xl border border-red-950/55 bg-zinc-950/80 text-left hover:border-red-500/55 hover:bg-zinc-900/95 transition-colors group"
              >
                <div className="rounded-lg border border-red-900/70 bg-black p-2 group-hover:border-red-500/40">
                  <CursePowerIcon curseId={curseId} className={`h-8 w-8 ${cursePowerIconClass(curseId)}`} />
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-mono text-[10px] font-black text-red-500/90">#{curseId}</span>
                  <span className="truncate text-[11px] font-black uppercase text-red-100">{def.name}</span>
                  <span className="line-clamp-2 text-[9px] font-medium italic leading-snug text-red-200/80">
                    {def.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-emerald-800/40 pt-4 mt-4">
        <button
          type="button"
          onClick={() => {
            window.location.hash = '#layout-editor';
            onClose();
          }}
          className="w-full rounded-lg border border-emerald-700/70 bg-emerald-950/70 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-200 hover:bg-emerald-900/90"
        >
          Layout editor (#layout-editor)
        </button>
      </div>
    </div>
  );
};
