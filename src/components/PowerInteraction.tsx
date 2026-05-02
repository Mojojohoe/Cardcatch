import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MAJOR_ARCANA, Suit } from '../types';
import { CardVisual, PowerCardVisual, SUIT_COLORS } from './GameVisuals';
import { SuitGlyph } from './SuitGlyphs';
import { ConfigurableWheel, fortuneWheelDefinition, resolveWheelSegments } from '../wheels';

const FORTUNE_WHEEL_SEGMENTS = resolveWheelSegments(fortuneWheelDefinition);

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
  /** Width / max-width utilities; wheel stays square via ConfigurableWheel’s aspect-ratio. */
  sizeClass?: string;
}> = ({
  spinning,
  offset,
  sizeClass = 'w-full max-w-[min(18rem,100%)] sm:max-w-[20rem]',
}) => (
  <div className={`mx-auto min-w-0 ${sizeClass}`}>
    <ConfigurableWheel
      definition={fortuneWheelDefinition}
      segments={FORTUNE_WHEEL_SEGMENTS}
      offset={offset}
      spinning={spinning}
      sizeClass="h-full w-full"
    />
  </div>
);

const optionMeta: Record<string, { title: string; description: string }> = {
  STEAL_JOKER: { title: 'Steal Joker', description: 'Take a Joker from the opponent if they have one.' },
  FROGIFY: { title: 'Frogify', description: 'Turn the opponent’s played card into a Frog (or bump an existing Frog).' },
  DEVIL_KING: { title: 'Upgrade to King', description: 'Discard 2 cards from hand. Your played card becomes a King.' },
  DEVIL_BLOCK: { title: 'Block power card', description: 'Discard 2 cards. Opponent’s power does nothing this round.' },
  DEVIL_RANDOMIZE: { title: 'Randomize suits', description: 'Discard 2 cards. Randomize both played suit cards.' },
  SPIN_WHEEL: { title: 'Spin the wheel', description: 'Seven weighted outcomes—including round swing, cards, and jackpot.' },
};

function reason(opt: string, decision: PendingDecisionView): string | null {
  const r = decision.disabledReasons?.[opt];
  if (!r || String(r).trim() === '') return null;
  return String(r);
}

export const PowerDecisionModal: React.FC<{
  compactPane?: boolean;
  decision: PendingDecisionView;
  priestessLockedCard?: string | null;
  priestessHand?: string[];
  tableSuit?: Suit | null;
  onSubmit: (option: string, wheelOffset?: number, priestessSwapToCard?: string | null) => void;
}> = ({
  compactPane = false,
  decision,
  priestessLockedCard = null,
  priestessHand = [],
  tableSuit = null,
  onSubmit,
}) => {
  const [wheelOffsetPreview] = useState(0.25);
  const [priestessSwapIndex, setPriestessSwapIndex] = useState<number | null>(null);
  const [dockBottom, setDockBottom] = useState(false);

  const isPriestess = decision.powerCardId === 2;
  const isWheel = decision.powerCardId === 10;

  const eligibleSwap = priestessHand.filter((c) => c && c !== priestessLockedCard);

  const headerAccent = tableSuit ? SUIT_COLORS[tableSuit as string] ?? 'text-yellow-400' : 'text-yellow-400';

  return (
    <div
      className={`absolute inset-0 z-[200] flex min-h-0 flex-col p-0 sm:p-6 ${dockBottom ? 'justify-end' : 'justify-end sm:justify-center'}`}
    >
      <div className="pointer-events-auto absolute inset-0 bg-black/82 backdrop-blur-[2px]" aria-hidden />
      {dockBottom && (
        <button
          type="button"
          onClick={() => setDockBottom(false)}
          title="Expand panel"
          className="pointer-events-auto absolute left-1/2 top-3 z-[260] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/25 bg-slate-900/95 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-200 shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
        >
          <ChevronUp className="h-4 w-4" aria-hidden /> Expand
        </button>
      )}
      <AnimatePresence>
        <motion.div
          key="panel"
          initial={{ y: 48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className={`relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl border border-white/20 bg-slate-950/97 p-5 shadow-[0_-20px_80px_rgba(0,0,0,0.55)] sm:rounded-[2rem] sm:border-2 sm:p-8 ${
            dockBottom
              ? compactPane
                ? 'max-h-[min(46%,21rem)] sm:max-h-[min(52%,23rem)]'
                : 'max-h-[min(58%,52rem)] sm:max-h-[min(72%,52rem)]'
              : 'max-h-[min(92vh,52rem)]'
          }`}
        >
          <div className="absolute right-3 top-3 z-40 sm:right-4 sm:top-4">
            <button
              type="button"
              className="rounded-full bg-white/10 p-2 text-white hover:bg-white/18"
              onClick={() => setDockBottom((d) => !d)}
              title={dockBottom ? 'Expand panel' : 'Dock to bottom'}
            >
              {dockBottom ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>

          <div className="mb-4 space-y-1 pr-11 text-center">
            <h2 className={`flex flex-wrap items-center justify-center gap-x-2 text-base font-black uppercase tracking-[0.12em] sm:text-lg ${headerAccent}`}>
              <span>{MAJOR_ARCANA[decision.powerCardId]?.name ?? `Power ${decision.powerCardId}`}</span>
              {tableSuit && (
                <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                  <span className="text-slate-500">· table</span>
                  <SuitGlyph suit={tableSuit} className={`h-5 w-5 sm:h-7 sm:w-7 ${SUIT_COLORS[tableSuit] ?? ''}`} />
                  <span className={SUIT_COLORS[tableSuit] ?? 'text-white'}>{tableSuit}</span>
                </span>
              )}
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
              {isWheel ? 'Wheel of Fortune' : isPriestess ? 'High Priestess' : 'Pick your effect'}
            </p>
          </div>

          {!dockBottom && isPriestess && (
            <div className="mb-4 space-y-3 rounded-2xl border border-purple-500/25 bg-purple-950/40 p-4 text-center">
              {decision.priestessOpponentUsesPower ? (
                <p className="text-[11px] font-black uppercase italic text-purple-200">
                  <span className="text-purple-400">{decision.priestessOpponentName ?? 'Opponent'}</span> committed a Major
                  — one of three shown powers is theirs.
                </p>
              ) : (
                <p className="text-[11px] font-black uppercase italic text-purple-300/95">
                  No opposing Major — Priestess glimpses stash only.
                </p>
              )}

              {decision.priestessPeekStashEmpty && (
                <p className="text-[10px] font-bold uppercase text-amber-200/95">Peek stash unavailable this round.</p>
              )}

              {!decision.priestessOpponentUsesPower &&
                typeof decision.priestessPeekStashPowerId === 'number' && (
                  <div className="flex justify-center pt-2">
                    <PowerCardVisual cardId={decision.priestessPeekStashPowerId} small />
                  </div>
                )}

              {decision.priestessPowerCandidates?.length === 3 && (
                <div className="flex flex-wrap justify-center gap-4 pt-3">
                  {decision.priestessPowerCandidates.map((pid) => (
                    <PowerCardVisual key={pid} cardId={pid} small revealed />
                  ))}
                </div>
              )}

              {eligibleSwap.length > 0 && priestessLockedCard && (
                <div className="border-t border-purple-900/50 pt-3">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-purple-400">
                    Optional — swap locked play ({priestessLockedCard.replace('-', ' ')})
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={() => setPriestessSwapIndex(null)}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black uppercase ${
                        priestessSwapIndex === null ? 'border-yellow-400 bg-yellow-400/15 text-yellow-100' : 'border-slate-700 text-slate-400'
                      }`}
                    >
                    Keep locked
                    </button>
                    {eligibleSwap.map((card, idx) => (
                      <button
                        key={`${card}-${idx}`}
                        type="button"
                        onClick={() => setPriestessSwapIndex(idx)}
                        className={`shrink-0 rounded-xl border-2 p-2 transition-colors ${
                          priestessSwapIndex === idx ? 'border-yellow-400 bg-black/35' : 'border-slate-800'
                        }`}
                      >
                        <CardVisual card={card} small revealed noAnimate />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  void onSubmit(
                    'PRIESTESS_RESOLVE',
                    undefined,
                    priestessSwapIndex !== null && eligibleSwap[priestessSwapIndex]
                      ? eligibleSwap[priestessSwapIndex]
                      : null,
                  )
                }
                className="mt-2 w-full rounded-2xl bg-yellow-400 py-4 text-[12px] font-black uppercase tracking-widest text-emerald-950 shadow-lg transition-all hover:bg-yellow-300"
              >
                Confirm Priestess
              </button>
            </div>
          )}

          {!dockBottom &&
            !isPriestess &&
            decision.options.map((opt) => {
              if (opt === 'PRIESTESS_RESOLVE') return null;
              if (opt === 'SPIN_WHEEL') {
                const why = reason(opt, decision);
                return (
                  <div key={opt} className="mb-6 space-y-4 rounded-3xl border border-amber-500/25 bg-black/55 p-4">
                    {!why && (
                      <>
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-center">
                          <div className="mx-auto min-w-0 shrink-0 sm:mx-0">
                            <FortuneWheelVisual
                              spinning={false}
                              offset={wheelOffsetPreview}
                              sizeClass="w-[min(16rem,100%)] max-w-[min(16rem,88vw)] sm:w-[min(18rem,42vw)]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onSubmit('SPIN_WHEEL', Math.random())}
                            className="rounded-full bg-yellow-400 px-10 py-6 text-[12px] font-black uppercase tracking-widest text-emerald-950 shadow-[0_0_48px_rgba(250,204,21,0.35)] transition-all hover:scale-[1.02] active:scale-95 sm:self-center"
                          >
                      Spin Wheel
                          </button>
                        </div>
                        <p className="text-center text-[10px] font-bold uppercase leading-relaxed tracking-wide text-amber-200/90">
                          {optionMeta.SPIN_WHEEL.description}
                        </p>
                      </>
                    )}
                    {why && <p className="text-center text-[11px] font-bold uppercase text-red-400">{why}</p>}
                  </div>
                );
              }

              const meta = optionMeta[opt];
              const why = reason(opt, decision);

              return (
                <div
                  key={opt}
                  className="mb-3 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/6 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="text-[13px] font-black uppercase tracking-wide text-yellow-300">
                      {meta?.title ?? opt.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold capitalize leading-snug text-slate-200/92">
                      {meta?.description ?? ''}
                    </p>
                    {why && (
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-red-400/95">{why}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={why != null}
                    onClick={() => onSubmit(opt)}
                    className={`shrink-0 rounded-full px-8 py-3 text-[11px] font-black uppercase tracking-wider transition-all ${
                      why
                        ? 'cursor-not-allowed bg-white/15 text-white/38'
                        : 'bg-purple-700 text-purple-50 hover:bg-purple-500'
                    }`}
                  >
                Activate
                  </button>
                </div>
              );
            })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
