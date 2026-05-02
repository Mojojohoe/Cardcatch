import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Crown, Rabbit, Shuffle, Sparkles, Wand2 } from 'lucide-react';
import { MAJOR_ARCANA, Suit } from '../types';
import { CardVisual, MajorArcanaIconGlyph, PowerCardVisual, SUIT_COLORS } from './GameVisuals';
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
  /** Smaller labels + hub for scaled-down overlays (opponent powering view). */
  dense?: boolean;
}> = ({
  spinning,
  offset,
  sizeClass = 'w-full max-w-[min(18rem,100%)] sm:max-w-[20rem]',
  dense = false,
}) => (
  <div className={`mx-auto min-w-0 ${sizeClass}`}>
    <ConfigurableWheel
      definition={fortuneWheelDefinition}
      segments={FORTUNE_WHEEL_SEGMENTS}
      offset={offset}
      spinning={spinning}
      sizeClass="h-full w-full"
      labelSizeMultiplier={dense ? 0.56 : 0.84}
      hubScale={dense ? 0.76 : 0.9}
    />
  </div>
);

const optionMeta: Record<string, { title: string; description: string }> = {
  STEAL_JOKER: { title: 'Steal Joker', description: 'Take a Joker from the opponent if they have one.' },
  FROGIFY: { title: 'Frogify', description: 'Turn the opponent’s played card into a Frog (or bump an existing Frog).' },
  DEVIL_KING: {
    title: 'Crown Your Play — King',
    description:
      'Your committed suit card becomes a King (same pip suit). Summons a random curse next round if the table has none. If you lose, you discard 1 random card.',
  },
  DEVIL_RANDOMIZE: {
    title: 'Spin Opponent Suit',
    description:
      'Spins the current trump/target wheel against the opponent’s play — their suit becomes the result (rank unchanged). Same curse / lose-card pact as Crown.',
  },
  SPIN_WHEEL: { title: 'Spin the wheel', description: 'Seven weighted outcomes—including round swing, cards, and jackpot.' },
};

const CHOICE_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  STEAL_JOKER: Wand2,
  FROGIFY: Rabbit,
  DEVIL_KING: Crown,
  DEVIL_RANDOMIZE: Shuffle,
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
  /** True when any curse is already active — Devil’s “summon curse” clause is dormant. */
  curseHoldsTable?: boolean;
  onSubmit: (option: string, wheelOffset?: number, priestessSwapToCard?: string | null) => void;
}> = ({
  compactPane = false,
  decision,
  priestessLockedCard = null,
  priestessHand = [],
  tableSuit = null,
  curseHoldsTable = false,
  onSubmit,
}) => {
  const [wheelOffsetPreview] = useState(0.25);
  const [priestessSwapIndex, setPriestessSwapIndex] = useState<number | null>(null);
  const [dockBottom, setDockBottom] = useState(false);

  const isPriestess = decision.powerCardId === 2;
  const isWheel = decision.powerCardId === 10;
  const isChoicePowerTap = decision.powerCardId === 1 || decision.powerCardId === 15;

  /** Docked mode hides table blur — never dock an empty Priestess panel. */
  useEffect(() => {
    if (isPriestess && dockBottom) setDockBottom(false);
  }, [isPriestess, dockBottom]);

  const eligibleSwap = priestessHand.filter((c) => c && c !== priestessLockedCard);

  const headerAccent = tableSuit ? SUIT_COLORS[tableSuit as string] ?? 'text-yellow-400' : 'text-yellow-400';

  return (
    <div
      className={`absolute inset-0 z-[200] flex min-h-0 flex-col p-0 sm:p-6 ${dockBottom ? 'justify-end' : 'justify-end sm:justify-center'}`}
    >
      {!dockBottom ? (
        <div className="pointer-events-auto absolute inset-0 bg-black/82 backdrop-blur-[2px]" aria-hidden />
      ) : null}
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
                ? 'max-h-[4.75rem] sm:max-h-[5rem]'
                : 'max-h-[5.25rem] sm:max-h-[5.5rem]'
              : 'max-h-[min(92vh,52rem)]'
          }`}
        >
          {!isPriestess && (
            <div className="absolute right-3 top-3 z-40 sm:right-4 sm:top-4">
              <button
                type="button"
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/18"
                onClick={() => setDockBottom((d) => !d)}
                title={dockBottom ? 'Expand panel' : 'Dock to collapse bar'}
              >
                {dockBottom ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            </div>
          )}

          {!dockBottom && (
            <div className={`mb-4 space-y-1 ${isPriestess ? 'pr-2' : 'pr-11'} text-center`}>
              <h2
                className={`flex flex-wrap items-center justify-center gap-x-2 text-base font-black uppercase tracking-[0.12em] sm:text-lg ${headerAccent}`}
              >
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
          )}

          {dockBottom && !isPriestess && (
            <button
              type="button"
              onClick={() => setDockBottom(false)}
              className="flex min-h-[2.75rem] w-full items-center justify-center gap-3 rounded-xl border border-yellow-500/45 bg-yellow-500/15 px-3 py-2 text-center hover:bg-yellow-500/22"
            >
              <PowerCardVisual cardId={decision.powerCardId} small />
              <span className="truncate text-[10px] font-black uppercase tracking-wide text-yellow-100">
                {MAJOR_ARCANA[decision.powerCardId]?.name ?? `Power ${decision.powerCardId}`} — tap expand to choose effect
              </span>
            </button>
          )}

          {!dockBottom && isPriestess && (
            <div className="mb-4 space-y-3 rounded-2xl border border-purple-500/25 bg-purple-950/40 p-4 text-center">
              {decision.priestessOpponentUsesPower ? (
                <p className="text-[11px] font-bold normal-case italic text-purple-200">
                  <span className="font-black text-purple-400">{decision.priestessOpponentName ?? 'Opponent'}</span> uses a
                  power card — one of three shown powers is theirs.
                </p>
              ) : (
                <p className="text-[11px] font-bold normal-case italic text-purple-300/95">
                  Opponent did not use a power card — Priestess only peeks a spare from their pile.
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

          {!dockBottom && !isPriestess && isChoicePowerTap && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {decision.options.map((opt) => {
                if (opt === 'PRIESTESS_RESOLVE') return null;
                const meta = optionMeta[opt];
                const why = reason(opt, decision);
                const OptIc = CHOICE_ICONS[opt] ?? Sparkles;
                const arcIc = MAJOR_ARCANA[decision.powerCardId]?.icon ?? 'Sparkles';
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={why != null}
                    onClick={() => onSubmit(opt)}
                    className={`flex min-h-[10rem] flex-col gap-3 rounded-2xl border-2 border-yellow-500/50 bg-zinc-950 p-4 text-left shadow-[0_14px_48px_rgba(0,0,0,0.6)] outline-none ring-1 ring-yellow-900/35 transition-colors ${
                      why
                        ? 'cursor-not-allowed opacity-45 saturate-[0.7]'
                        : 'hover:border-yellow-300 hover:shadow-[0_18px_56px_rgba(250,204,21,0.14)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <MajorArcanaIconGlyph iconName={arcIc} className="h-7 w-7 text-yellow-400" size={28} />
                      <OptIc className="h-6 w-6 shrink-0 text-yellow-200" />
                    </div>
                    <p className="text-[12px] font-black uppercase tracking-wide leading-tight text-yellow-100">
                      {meta?.title ?? opt.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] font-semibold leading-snug text-yellow-50/82">{meta?.description ?? ''}</p>
                    {decision.powerCardId === 15 && curseHoldsTable && (
                      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        Extra curse dormant — another curse holds the table.
                      </p>
                    )}
                    {why && <p className="text-[10px] font-bold uppercase text-red-400">{why}</p>}
                  </button>
                );
              })}
            </div>
          )}

          {!dockBottom &&
            !isPriestess &&
            !isChoicePowerTap &&
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
