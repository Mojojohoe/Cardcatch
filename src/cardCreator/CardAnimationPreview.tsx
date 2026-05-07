import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRightLeft, Clapperboard, Heart, Scissors, Sparkles, X } from 'lucide-react';
import { CardVisual } from '../components/GameVisuals';
import { SUITS, VALUES } from '../types';

type PreviewAnimationId = 'deckPull' | 'upgradeWiggle' | 'transformFlip' | 'cutSlash' | 'heartPulse';

const CARD_CHOICES: string[] = [];
for (const suit of SUITS) {
  for (const value of VALUES) CARD_CHOICES.push(`${suit}-${value}`);
}
CARD_CHOICES.push('Joker-1', 'Joker-2', 'Grovels-1', 'Crowns-E');

const ANIMATION_DEFS: Array<{ id: PreviewAnimationId; name: string; durationMs: number }> = [
  { id: 'deckPull', name: 'Deck Pull / Upgrade Entry', durationMs: 1900 },
  { id: 'upgradeWiggle', name: 'Upgrade Wiggle', durationMs: 1100 },
  { id: 'transformFlip', name: 'Transform Flip', durationMs: 2200 },
  { id: 'cutSlash', name: 'Cut Slash', durationMs: 1700 },
  { id: 'heartPulse', name: 'Heart Pulse', durationMs: 1300 },
];

export const CardAnimationPreview: React.FC<{ onClose: () => void; onOpenCreator: () => void }> = ({
  onClose,
  onOpenCreator,
}) => {
  const [cardId, setCardId] = useState<string>('Hearts-10');
  const [transformTarget, setTransformTarget] = useState<string>('Hearts-K');
  const [animationId, setAnimationId] = useState<PreviewAnimationId>('deckPull');
  const [loopTick, setLoopTick] = useState(0);
  const [transformCard, setTransformCard] = useState(cardId);

  const selectedAnim = useMemo(
    () => ANIMATION_DEFS.find((a) => a.id === animationId) ?? ANIMATION_DEFS[0],
    [animationId],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setLoopTick((n) => n + 1), selectedAnim.durationMs);
    return () => window.clearInterval(timer);
  }, [selectedAnim.durationMs]);

  useEffect(() => {
    setTransformCard(cardId);
  }, [cardId, animationId]);

  useEffect(() => {
    if (animationId !== 'transformFlip') return undefined;
    setTransformCard(cardId);
    const swapAt = window.setTimeout(() => {
      setTransformCard(transformTarget);
    }, Math.max(280, Math.floor(selectedAnim.durationMs * 0.48)));
    return () => window.clearTimeout(swapAt);
  }, [animationId, cardId, transformTarget, loopTick, selectedAnim.durationMs]);

  const iconForAnimation = (id: PreviewAnimationId) => {
    if (id === 'upgradeWiggle') return <Sparkles className="h-4 w-4" />;
    if (id === 'transformFlip') return <ArrowRightLeft className="h-4 w-4" />;
    if (id === 'cutSlash') return <Scissors className="h-4 w-4" />;
    if (id === 'heartPulse') return <Heart className="h-4 w-4" />;
    return <Clapperboard className="h-4 w-4" />;
  };

  return (
    <div className="fixed inset-0 z-[460] bg-black/90 p-3 text-white backdrop-blur-lg sm:p-5">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-3xl border border-violet-500/35 bg-slate-950/92 shadow-[0_0_80px_rgba(139,92,246,0.2)]">
        <div className="flex items-center justify-between border-b border-violet-900/45 px-4 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-300">Card Creator</p>
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-white sm:text-base">Animation Preview Lab</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-violet-700/70 bg-violet-900/30 p-2 text-violet-100 transition-colors hover:bg-violet-800/50"
            aria-label="Close preview lab"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[22rem,1fr]">
          <div className="min-h-0 space-y-4 overflow-y-auto rounded-2xl border border-slate-800 bg-black/25 p-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">Card to preview</label>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
              >
                {CARD_CHOICES.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">Animation loop</label>
              <div className="grid grid-cols-1 gap-2">
                {ANIMATION_DEFS.map((anim) => (
                  <button
                    key={anim.id}
                    type="button"
                    onClick={() => setAnimationId(anim.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                      animationId === anim.id
                        ? 'border-violet-400/80 bg-violet-700/35 text-violet-50'
                        : 'border-slate-700 bg-slate-900/65 text-slate-200 hover:border-violet-500/55'
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide">
                      {iconForAnimation(anim.id)}
                      {anim.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-300">{anim.durationMs}ms</span>
                  </button>
                ))}
              </div>
            </div>

            {animationId === 'transformFlip' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">Transform target card</label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white"
                  value={transformTarget}
                  onChange={(e) => setTransformTarget(e.target.value)}
                >
                  {CARD_CHOICES.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenCreator}
              className="w-full rounded-xl border border-violet-500/55 bg-violet-800/35 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-violet-100 transition-colors hover:bg-violet-700/50"
            >
              Open main Card Creator
            </button>
          </div>

          <div className="relative flex min-h-[26rem] items-center justify-center overflow-hidden rounded-2xl border border-violet-900/40 bg-[radial-gradient(circle_at_50%_40%,rgba(109,40,217,0.2),transparent_58%)]">
            <div className="absolute top-3 left-3 rounded-full border border-violet-500/45 bg-violet-900/35 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-violet-100">
              Loop #{loopTick + 1}
            </div>

            {(animationId === 'cutSlash' || animationId === 'heartPulse') ? (
              <motion.div
                key={`${animationId}-${loopTick}`}
                initial={{ scale: 1, x: 0, y: 0, rotate: 0 }}
                animate={
                  animationId === 'cutSlash'
                    ? {
                        x: [0, -8, 10, -6, 0],
                        rotate: [0, -2, 2, -1, 0],
                      }
                    : {
                        scale: [1, 1.05, 1],
                      }
                }
                transition={{
                  duration: Math.max(0.6, selectedAnim.durationMs / 1000),
                  ease: 'easeInOut',
                }}
                className="relative"
              >
                {animationId === 'heartPulse' && (
                  <motion.div
                    className="pointer-events-none absolute inset-[-16%] rounded-3xl border-2 border-rose-400/65"
                    initial={{ opacity: 0.75, scale: 0.88 }}
                    animate={{ opacity: 0, scale: 1.3 }}
                    transition={{ duration: 0.9, ease: 'easeOut', repeat: Infinity, repeatDelay: 0.1 }}
                  />
                )}
                {animationId === 'cutSlash' && (
                  <motion.div
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[3px] w-44 -translate-x-1/2 -translate-y-1/2 rotate-[-34deg] rounded-full bg-red-200/90 shadow-[0_0_16px_rgba(248,113,113,0.7)]"
                    initial={{ opacity: 0, scaleX: 0.15 }}
                    animate={{ opacity: [0, 1, 0], scaleX: [0.15, 1, 1.2] }}
                    transition={{ duration: 0.72, ease: 'easeOut' }}
                  />
                )}
                <CardVisual card={cardId} revealed />
              </motion.div>
            ) : (
              <CardVisual
                key={`${animationId}-${loopTick}-${animationId === 'transformFlip' ? transformCard : cardId}`}
                card={animationId === 'transformFlip' ? transformCard : cardId}
                revealed
                presentation={animationId === 'deckPull' ? 'deckPull' : 'default'}
                presentationPace="slow"
                resolutionMorph={animationId === 'transformFlip' ? 'transform' : null}
                resolutionWiggleTick={animationId === 'upgradeWiggle' ? loopTick + 1 : 0}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

