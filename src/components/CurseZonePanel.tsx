import React, { memo } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import {
  CardVisual,
  PowerCardVisual,
  SUIT_COLORS,
} from './GameVisuals';
import { SuitGlyph } from './SuitGlyphs';
import {
  describeWrathMinionTitle,
  displaySuitCardValue,
  ENVY_MONSTER_START_HP,
  parseCard,
} from '../services/gameService';
import {
  CURSE_ENVY,
  CURSE_GREEN_EYED_MONSTER,
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_LUST,
  CURSE_PRIDE,
  CURSE_SLOTH,
  CURSE_WRATH,
  LUST_METER_MAX,
} from '../curses';
import type { ActiveCurseState, GameSettings } from '../types';

function gluttonyMoodCopy(phase: number): string {
  if (phase >= 2) return 'Gluttony is wasting away, gluttony wants more meat';
  if (phase >= 1) return 'Gluttony is starving, gluttony wants more meat';
  return 'Gluttony is hungry, gluttony wants more meat';
}

const CurseZonePanelInner: React.FC<{
  settings: GameSettings;
  activeCurses?: ActiveCurseState[];
  prideCeilingCard?: string | null;
  wrathMinionCard?: string | null;
}> = ({ settings, activeCurses, prideCeilingCard, wrathMinionCard }) => {
  if (!settings.enableCurseCards) {
    return <div className="w-12 sm:w-[4.75rem] shrink-0" aria-hidden />;
  }
  const lust = activeCurses?.find((c) => c.id === CURSE_LUST);
  const gluttony = activeCurses?.find((c) => c.id === CURSE_GLUTTONY);
  const greed = activeCurses?.find((c) => c.id === CURSE_GREED);
  const pride = activeCurses?.find((c) => c.id === CURSE_PRIDE);
  const envy = activeCurses?.find((c) => c.id === CURSE_ENVY);
  const wrath = activeCurses?.find((c) => c.id === CURSE_WRATH);
  const sloth = activeCurses?.find((c) => c.id === CURSE_SLOTH);
  if (!lust && !gluttony && !greed && !pride && !envy && !wrath && !sloth)
    return <div className="w-12 sm:w-[4.75rem] shrink-0" aria-hidden />;
  const curseCol = 'relative flex w-[7.5rem] shrink-0 flex-col items-center gap-1.5 overflow-visible sm:w-[8rem]';
  return (
    <div className="relative flex w-full max-w-none shrink-0 flex-row flex-wrap items-start justify-center gap-x-5 gap-y-6 overflow-visible px-0.5 pt-1 pb-2">
      {lust && (
        <motion.div layout className={curseCol}>
          <PowerCardVisual cardId={CURSE_LUST} revealed matchHandCard curseRackPeek />
          <p className="text-center text-[9px] font-black uppercase tracking-wider text-pink-400">Lust</p>
          <p className="text-center font-mono text-[12px] font-bold tabular-nums leading-tight text-pink-200">
            {lust.lustAccumulated ?? 0}
            <span className="text-pink-500/80">/{LUST_METER_MAX}</span>{' '}
            <span className="block text-[8px] font-bold uppercase tracking-wide text-pink-400/90">Hunger</span>
          </p>
        </motion.div>
      )}
      {gluttony && (
        <motion.div layout className={curseCol}>
          <PowerCardVisual cardId={CURSE_GLUTTONY} revealed matchHandCard curseRackPeek />
          <p className="text-center text-[9px] font-black uppercase tracking-wider text-orange-400">Gluttony</p>
          <p className="max-w-[12rem] px-0.5 text-center text-[9px] font-bold leading-snug normal-case text-orange-200/95">
            {gluttonyMoodCopy(gluttony.gluttonyPhase ?? 0)}
          </p>
        </motion.div>
      )}
      {greed && (
        <motion.div layout className={curseCol}>
          <PowerCardVisual cardId={CURSE_GREED} revealed matchHandCard curseRackPeek />
          <p className="text-center text-[9px] font-black uppercase tracking-wider text-yellow-400">Greed</p>
          <div className="mt-0.5 flex flex-col items-center gap-0.5">
            <SuitGlyph suit="Crowns" className="h-7 w-7 text-yellow-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)] sm:h-8 sm:w-8" />
            <p className="text-center font-mono text-[11px] font-bold tabular-nums text-yellow-200">
              {(greed.greedCrown ?? 0).toString()}/17
            </p>
            <p className="px-0.5 text-center text-[8px] font-bold uppercase tracking-wide text-yellow-500/90">Tax</p>
          </div>
        </motion.div>
      )}
      {pride && (
        <motion.div
          layout
          className={`${curseCol} rounded-xl border-2 border-white/25 bg-zinc-950 px-1.5 py-2 shadow-[0_14px_44px_rgba(0,0,0,0.55)]`}
        >
          <Sparkles className="mx-auto h-5 w-5 text-white sm:h-6 sm:w-6" />
          <p className="mt-1 text-center text-[9px] font-black uppercase tracking-wider text-slate-100">Pride</p>
          {prideCeilingCard ? (
            <div className="mt-1 flex flex-col items-center gap-0.5">
              <p className="text-center text-[8px] font-bold uppercase tracking-wide text-violet-300/90">Barrier</p>
              <div className={`flex items-center gap-1 ${SUIT_COLORS[parseCard(prideCeilingCard).suit] ?? 'text-violet-200'}`}>
                <SuitGlyph suit={parseCard(prideCeilingCard).suit} className="h-6 w-6 sm:h-7 sm:w-7" />
                <span className="font-card-rank text-[11px] font-black tabular-nums">
                  {(() => {
                    const pc = parseCard(prideCeilingCard);
                    return pc.suit === 'Crowns' ? displaySuitCardValue(pc.suit, pc.value) : pc.value;
                  })()}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-1 px-0.5 text-center text-[8px] font-bold text-violet-300/80">Next round…</p>
          )}
        </motion.div>
      )}
      {envy && (
        <motion.div
          layout
          className={`${curseCol} gap-1 rounded-xl border-2 border-emerald-700/70 bg-zinc-950 px-1 py-2 shadow-[0_14px_44px_rgba(0,0,0,0.55)]`}
        >
          <div className="flex items-start gap-1.5">
            <PowerCardVisual cardId={CURSE_ENVY} revealed matchHandCard curseRackPeek />
            <div className="relative">
              <PowerCardVisual cardId={CURSE_GREEN_EYED_MONSTER} revealed matchHandCard curseRackPeek />
              <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/70 px-1 py-[1px] font-mono text-[9px] font-black tabular-nums text-emerald-200">
                {(typeof envy.envyMonsterHp === 'number' ? envy.envyMonsterHp : ENVY_MONSTER_START_HP).toString()}
              </span>
            </div>
          </div>
          <p className="text-center text-[9px] font-black uppercase tracking-wider text-emerald-400">Envy</p>
        </motion.div>
      )}
      {wrath && (
        <motion.div layout className={curseCol}>
          <div className="flex items-start gap-1.5">
            <PowerCardVisual cardId={CURSE_WRATH} revealed matchHandCard curseRackPeek />
            {wrathMinionCard ? (
              <div className="origin-center scale-[0.52]">
                <CardVisual
                  card={wrathMinionCard}
                  revealed
                  noAnimate
                  small
                  detailTooltip={`${describeWrathMinionTitle(wrathMinionCard)} — mark is chosen when the round resolves.`}
                />
              </div>
            ) : (
              <div className="flex h-[4.1rem] w-[2.7rem] items-center justify-center rounded-md border border-red-900/50 bg-black/40 text-[7px] font-bold uppercase text-red-300/80">
                Soon
              </div>
            )}
          </div>
          <p className="text-center text-[9px] font-black uppercase tracking-wider text-red-500">Wrath</p>
          <p className="text-center font-mono text-[10px] font-bold tabular-nums text-red-200/95">{(wrath.wrathRound ?? 1)}/5</p>
        </motion.div>
      )}
      {sloth && (
        <motion.div layout className={curseCol}>
          <PowerCardVisual cardId={CURSE_SLOTH} revealed matchHandCard curseRackPeek />
          <p className="text-center text-[9px] font-black uppercase tracking-wider text-indigo-300">Sloth</p>
          <p className="mt-0.5 px-0.5 text-center text-[8px] font-bold leading-snug normal-case text-indigo-100/95">
            The sloth is dreaming
          </p>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-amber-200">
            <SuitGlyph suit="Stars" className="h-5 w-5 sm:h-6 sm:w-6" />
            <SuitGlyph suit="Moons" className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </motion.div>
      )}
    </div>
  );
};

export const CurseZonePanel = memo(CurseZonePanelInner);
