import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MAJOR_ARCANA, Suit } from '../types';
import { CardVisual, PowerCardVisual, SUIT_COLORS } from './GameVisuals';
import { SuitGlyph } from './SuitGlyphs';

export interface PendingDecisionView {
  powerCardId: number;
  options: string[];
  disabledReasons?: Record<string, string>;
  wheelResult?: string | null;
  priestessOpponentUsesPower?: boolean;
  priestessOpponentName?: string;
  priestessPowerCandidates?: number[] | null;
  priestessPeekStashPowerId?: number | null;
  priestessPeekStashEmpty?: boolean;
}

export const FortuneWheelVisual: React.FC<{
  spinning: boolean;
  offset: number;
  sizeClass?: string;
}> = ({ spinning, offset, sizeClass = 'w-72 h-72' }) => {
  const wheelSlices = [
    { label: 'LOSE_ROUND', size: 3, color: '#7f1d1d' },
    { label: 'WIN_ROUND', size: 3, color: '#14532d' },
    { label: 'WIN_2_CARDS', size: 5, color: '#1e3a8a' },
    { label: 'DOUBLE_JOKER', size: 1, color: '#581c87' },
    { label: 'JACKPOT', size: 2, color: '#854d0e' },
    { label: 'POWER_CARD', size: 1, color: '#0f766e' },
    { label: 'LOSE_2_CARDS', size: 5, color: '#7c2d12' }
  ];
  const totalSize = wheelSlices.reduce((acc, s) => acc + s.size, 0);
  const wheelRotation = useMemo(() => -(360 * 10 + offset * 360), [offset]);
  const wheelGradient = useMemo(() => {
    let start = 0;
    return wheelSlices.map((slice) => {
      const from = (start / totalSize) * 100;
      start += slice.size;
      const to = (start / totalSize) * 100;
      return `${slice.color} ${from}% ${to}%`;
    }).join(', ');
  }, [totalSize]);

  return (
    <div className={`relative ${sizeClass} mx-auto`}>
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[14px] border-t-yellow-400" />
      <motion.div
        animate={{ rotate: spinning ? wheelRotation : -(offset * 360) }}
        transition={{ duration: spinning ? 2.5 : 0.2, ease: [0.12, 0, 0, 1] }}
        className="w-full h-full rounded-full border-[10px] border-amber-600/60 overflow-hidden relative shadow-[0_0_40px_rgba(245,158,11,0.3)]"
      >
        <div className="absolute inset-0" style={{ background: `conic-gradient(${wheelGradient})` }} />
        {(() => {
          let running = 0;
          return wheelSlices.map((slice, idx) => {
            const start = (running / totalSize) * 360;
            running += slice.size;
            const end = (running / totalSize) * 360;
            const mid = (start + end) / 2;
            return (
              <div
                key={`${slice.label}-${idx}`}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ transform: `rotate(${mid - 90}deg)` }}
              >
                <div className="absolute right-[2%] w-[36%] text-center">
                  <span className="text-[8px] sm:text-[9px] font-black uppercase text-white/90 leading-none tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {slice.label.replaceAll('_', ' ')}
                  </span>
                </div>
              </div>
            );
          });
        })()}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-30 pointer-events-none">
          {(() => {
            let running = 0;
            return wheelSlices.map((slice, idx) => {
              running += slice.size;
              const angle = (running / totalSize) * 360;
              const x2 = 50 + 50 * Math.cos(((angle - 90) * Math.PI) / 180);
              const y2 = 50 + 50 * Math.sin(((angle - 90) * Math.PI) / 180);
              return <line key={idx} x1="50" y1="50" x2={x2} y2={y2} stroke="white" strokeWidth="0.4" />;
            });
          })()}
        </svg>
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="w-16 h-16 rounded-full bg-amber-700 border-4 border-amber-300 flex items-center justify-center">
          <span className="text-[10px] font-black text-black uppercase">Wheel</span>
        </div>
      </div>
    </div>
  );
};

export const PowerDecisionModal: React.FC<{
  decision: PendingDecisionView;
  /** Locked engage card — must equal what was submitted with Engage. */
  priestessLockedCard?: string | null;
  /** Full hand (includes locked card): swap target must exist here. */
  priestessHand?: string[];
  /** Table suit for this round — shown in modal header during resolution */
  tableSuit?: Suit | null;
  onSubmit: (option: string, wheelOffset?: number, priestessSwapToCard?: string | null) => void;
}> = ({ decision, priestessLockedCard = null, priestessHand = [], tableSuit = null, onSubmit }) => {
  const [wheelOffset] = useState(0.25);
  const [priestessPickIndex, setPriestessPickIndex] = useState<number | null>(null);
  const [panelDockedBottom, setPanelDockedBottom] = useState(false);
  const isWheel = decision.powerCardId === 10;
  const isPriestess = decision.powerCardId === 2;

  const optionMeta: Record<string, { title: string; description: string }> = {
    STEAL_JOKER: { title: 'Steal Joker', description: 'Take a Joker from the opponent if they have one.' },
    FROGIFY: { title: 'Frogify', description: 'Turn the opponent\'s played card into Frogs-1.' },
    DEVIL_KING: { title: 'Upgrade to King', description: 'Discard 2 cards from hand. Your played card becomes a King.' },
    DEVIL_BLOCK: { title: 'Block power card', description: 'Discard 2 cards. The opponent\'s power card does nothing this round.' },
    DEVIL_RANDOMIZE: { title: 'Randomize suits', description: 'Discard 2 cards. Randomize both played suit cards.' },
  };

  const spinWheel = () => {
    const nextOffset = Math.random();
    onSubmit('SPIN_WHEEL', nextOffset);
  };

  const oppName = decision.priestessOpponentName || 'Opponent';
  const oppUsesPower = Boolean(decision.priestessOpponentUsesPower);
  const stashEmpty = Boolean(decision.priestessPeekStashEmpty);
  const stashId =
    typeof decision.priestessPeekStashPowerId === 'number' ? decision.priestessPeekStashPowerId : null;
  const locked = priestessLockedCard || '';
  const swapCard =
    priestessPickIndex !== null && priestessPickIndex >= 0 && priestessPickIndex < priestessHand.length
      ? priestessHand[priestessPickIndex]
      : null;
  const swapIsValid =
    swapCard !== null && swapCard !== locked && priestessHand.some((c) => c === swapCard);

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[260] flex flex-col px-2 sm:px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.35rem,env(safe-area-inset-bottom))] transition-all duration-500 ${panelDockedBottom ? 'justify-end' : 'justify-center'}`}
    >
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className={`pointer-events-auto w-full mx-auto flex flex-col bg-slate-950/96 backdrop-blur-xl border border-yellow-500/45 shadow-[0_24px_70px_rgba(0,0,0,0.55)] overflow-hidden sm:max-w-2xl lg:max-w-4xl transition-[max-height,border-radius] duration-500 ${
          panelDockedBottom
            ? 'max-h-[4.75rem] sm:max-h-[5.25rem] rounded-2xl border-b'
            : 'max-h-[min(85vh,760px)] rounded-3xl'
        }`}
      >
        <div className="relative shrink-0 flex flex-col gap-2 border-b border-yellow-500/20 pt-2 pb-2.5 px-14">
          <div className="flex justify-center pt-1">
            <div className="h-1 w-14 rounded-full bg-slate-600/70" aria-hidden />
          </div>
          {tableSuit ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center px-2 min-h-[2.25rem]">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Table suit</span>
              <span className={`inline-flex items-center gap-2 font-black uppercase tracking-wider text-xs sm:text-sm ${SUIT_COLORS[tableSuit] ?? ''}`}>
                <SuitGlyph suit={tableSuit} className="w-6 h-6 sm:w-7 sm:h-7 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]" />
                {tableSuit}
              </span>
            </div>
          ) : (
            <div className="min-h-[0.25rem]" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => setPanelDockedBottom((v) => !v)}
            className="absolute right-2 top-2 flex items-center justify-center min-w-[2.75rem] min-h-[2.75rem] rounded-xl bg-slate-800/95 border border-slate-600 text-yellow-400 hover:bg-slate-700/95 hover:text-yellow-300 shadow-lg z-10"
            aria-label={panelDockedBottom ? 'Move power menu to center' : 'Dock power menu to bottom'}
          >
            {panelDockedBottom ? (
              <ChevronUp strokeWidth={2.75} className="w-8 h-8" />
            ) : (
              <ChevronDown strokeWidth={2.75} className="w-8 h-8" />
            )}
          </button>
        </div>
        <div
          className={`overflow-y-auto px-4 pt-3 space-y-4 flex-1 min-h-0 transition-all duration-350 ${
            panelDockedBottom ? 'opacity-0 max-h-0 pb-0 pointer-events-none' : 'opacity-100 pb-6'
          } ${isPriestess ? '' : ''}`}
        >
        <h3 className="text-lg sm:text-xl font-black uppercase text-yellow-400">
          {decision.powerCardId === 1
            ? 'Magician'
            : decision.powerCardId === 15
              ? 'Devil Deal'
              : decision.powerCardId === 2
                ? 'High Priestess'
                : 'Wheel of Fortune'}
        </h3>
        {isPriestess && locked ? (
          <div className="space-y-4">
            <p className="text-center text-[11px] sm:text-xs font-bold text-slate-400 leading-relaxed normal-case px-2">
              Your suit card stays locked unless you swap below. Priestess shows whether they played a power card this round.
            </p>
            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/40 px-4 py-3 text-center">
              <p className="text-[11px] font-black uppercase tracking-wider text-indigo-200 normal-case">
                {oppUsesPower ? (
                  <>
                    <span className="text-yellow-300">{oppName}</span> played a power card this round.
                  </>
                ) : (
                  <>
                    <span className="text-slate-200">{oppName}</span> did not play a power card this round.
                  </>
                )}
              </p>
            </div>

            {oppUsesPower && decision.priestessPowerCandidates && decision.priestessPowerCandidates.length >= 3 && (
              <div className="space-y-3 rounded-xl border border-amber-500/35 bg-black/35 px-3 py-4">
                <p className="text-center text-[10px] font-bold text-amber-200/95 normal-case px-2">
                  Their active power card is one of these three — the order shown does not imply which one they played.
                </p>
                <div className="grid grid-cols-3 gap-3 sm:gap-5 w-full max-w-md mx-auto place-items-center justify-items-center">
                  {decision.priestessPowerCandidates.slice(0, 3).map((id, idx) => (
                    <div key={`${id}-${idx}`} className="flex justify-center w-full">
                      <PowerCardVisual cardId={id} panel revealed />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!oppUsesPower && (
              <div className="space-y-3 rounded-xl border border-violet-500/35 bg-violet-950/30 px-3 py-4 text-center">
                <p className="text-[10px] font-bold text-violet-100/95 normal-case px-2 leading-relaxed">
                  {stashEmpty ? (
                    <>
                      They did not play a power card and have no spare power cards in hand to reveal.
                    </>
                  ) : stashId !== null ? (
                    <>
                      They did not play a power card — you see one spare power card they are holding ({' '}
                      <span className="text-yellow-300 font-black">{oppName}</span>
                      ).
                    </>
                  ) : (
                    <>Confirm when ready.</>
                  )}
                </p>
                {stashId !== null && (
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <PowerCardVisual cardId={stashId} small revealed />
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">
                      {MAJOR_ARCANA[stashId]?.name ?? stashId}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Your locked play</span>
              <div className="scale-90 origin-top">
                <CardVisual card={locked} revealed noAnimate />
              </div>
            </div>

            {oppUsesPower && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 text-center">
                  Your hand · select a different card to swap · tap again to deselect
                </p>
                <div className="flex flex-wrap justify-center gap-2 py-2 max-h-[220px] overflow-y-auto rounded-xl border border-slate-800/80 bg-black/40 p-3">
                  {priestessHand.map((card, idx) => (
                    <button
                      type="button"
                      key={`pv-${idx}-${card}`}
                      onClick={() => setPriestessPickIndex((cur) => (cur === idx ? null : idx))}
                      className={`rounded-lg outline-none ring-offset-2 ring-offset-slate-950 transition-transform hover:scale-105 active:scale-95 ${
                        priestessPickIndex === idx ? 'ring-2 ring-yellow-400' : 'ring-0'
                      }`}
                    >
                      <div className={`scale-[0.55] sm:scale-[0.65] origin-center ${card === locked ? 'opacity-100' : ''}`}>
                        <CardVisual card={card} revealed noAnimate disabled={false} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {oppUsesPower ? (
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onSubmit('PRIESTESS_RESOLVE')}
                  className="flex-1 py-3 rounded-xl border border-emerald-600/60 bg-emerald-900/40 text-emerald-200 font-black uppercase text-xs tracking-widest hover:bg-emerald-800/50"
                >
                  Hold committed card
                </button>
                <button
                  type="button"
                  disabled={!swapIsValid}
                  onClick={() => onSubmit('PRIESTESS_RESOLVE', undefined, swapCard)}
                  className={`flex-1 py-3 rounded-xl font-black uppercase text-xs tracking-widest border ${
                    swapIsValid
                      ? 'border-yellow-500 bg-yellow-500 text-black hover:bg-yellow-400'
                      : 'border-slate-700 bg-slate-900 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  Swap to chosen card
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSubmit('PRIESTESS_RESOLVE')}
                className="w-full py-3 rounded-xl border border-violet-500/60 bg-violet-900/50 text-violet-100 font-black uppercase text-xs tracking-widest hover:bg-violet-800/55"
              >
                Continue
              </button>
            )}
          </div>
        ) : null}
        {isWheel ? (
          <div className="space-y-4">
            <FortuneWheelVisual spinning={false} offset={wheelOffset} sizeClass="w-80 h-80 sm:w-96 sm:h-96" />
            <button
              onClick={spinWheel}
              className="w-full py-3 rounded-xl bg-amber-500 text-black font-black uppercase disabled:opacity-50"
            >
              Spin Wheel
            </button>
            <p className="text-center text-amber-300/90 text-xs font-bold normal-case">
              Spin once — result applies when the round resolves.
            </p>
          </div>
        ) : !isPriestess ? (
          <div className="grid grid-cols-1 gap-3">
            {decision.options.map(option => (
              <div key={option} className={`rounded-xl border p-3 ${decision.disabledReasons?.[option] ? 'border-slate-700 bg-slate-900/30 opacity-60' : 'border-emerald-600/40 bg-emerald-900/30'}`}>
                <button
                  type="button"
                  onClick={() => onSubmit(option)}
                  disabled={Boolean(decision.disabledReasons?.[option])}
                  className="w-full text-left disabled:cursor-not-allowed"
                >
                  <div className="text-sm font-black uppercase text-white">{optionMeta[option]?.title || option.replaceAll('_', ' ')}</div>
                  <div className="text-[11px] text-slate-300 mt-1">{optionMeta[option]?.description || ''}</div>
                  {decision.disabledReasons?.[option] && (
                    <div className="text-[10px] text-red-300 mt-2 uppercase font-bold">{decision.disabledReasons[option]}</div>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        </div>
      </motion.div>
    </div>
  );
};
