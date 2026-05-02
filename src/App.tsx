/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePowerTooltipPosition } from './hooks/usePowerTooltipPosition';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Trophy, 
  Copy, 
  Check, 
  Shield, 
  Hash, 
  Info,
  RefreshCw,
  Zap,
  LayoutGrid,
  Monitor,
  Rabbit,
  Skull,
  Gamepad2,
  UtensilsCrossed,
  Layers,
  ChevronRight,
  Sparkles,
  Wand2,
  Eye,
  Crown,
  BookType,
  BookOpen,
  Heart,
  FastForward,
  BicepsFlexed,
  Lamp,
  Scale,
  Anchor,
  Waves,
  Cloud,
  Flame,
  ZapOff,
  Star,
  Moon,
  Sun,
  Gavel,
  Globe,
  Settings,
  X,
  Play,
  Plus,
} from 'lucide-react';
import {
  GameService,
  parseCard,
  desperationSpinAllowed,
  describeWrathMinionTitle,
  GROVEL_CARD_ID,
  isCardBlockedByPride,
  envyGreedySealSlots,
  ENVY_MONSTER_START_HP,
  playingCardUpgradeSteps,
  lustHeartUpgradeSteps,
} from './services/gameService';
import {
  RoomData,
  PlayerData,
  Suit,
  CARD_UNICODE,
  SUITS,
  PlayerRole,
  GameSettings,
  MAJOR_ARCANA,
  ResolutionEvent,
  ResolutionEventType,
  desperationTierRowsForDisplay,
  effectiveActiveDesperationTierCount,
  ActiveCurseState,
} from './types';
import { FortuneWheelVisual, PowerDecisionModal } from './components/PowerInteraction';
import { DesperationWheel, TargetSuitWheel } from './components/GameWheels';
import { RoomChat } from './components/RoomChat';
import { OpponentDecisionStrip } from './components/OpponentDecisionStrip';
import { SuitGlyph } from './components/SuitGlyphs';
import {
  CardVisual,
  CursePowerIcon,
  cursePowerIconClass,
  GreenEyedMonsterIcon,
  MajorArcanaIconGlyph,
  PowerCardVisual,
  SUIT_COLORS,
  WolfIcon,
} from './components/GameVisuals';
import { CssCoinEmbed, CssCoinFlipDegrees } from './coinflip/CssCoinEmbed';
import {
  ConfigurableWheel,
  resolveWheelSegments,
  slothDreamWheelDefinition,
} from './wheels';
import { desperationLadderLabel } from './utils/desperationUi';
import { HostLobbyPanel, GuestLobbyPanel } from './components/LobbyRoomPanels';
import { normalizeGameSettings, CUSTOM_LOBBY_PRESET_ID } from './settings/normalizeGameSettings';
import type { SavedLobbyPreset } from './settings/gameSettingsConstants';
import {
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_LUST,
  CURSE_PRIDE,
  CURSE_ENVY,
  CURSE_SLOTH,
  CURSE_WRATH,
  CURSES,
  CURSE_IDS,
  curseEffectActive,
  isCurseCardId,
  greedCurseActive,
  lustCurseActive,
  prideCurseActive,
  envyCurseActive,
  wrathCurseActive,
  slothCurseActive,
} from './curses';

const SLOTH_DREAM_WHEEL_SEGMENTS = resolveWheelSegments(slothDreamWheelDefinition);

const PRIDE_WOUND_TOOLTIP = 'This card cannot be played for it would wound pride.';
const GROVEL_FEED_TOOLTIP = "Sometimes the only way to play the game is to feed one's pride";
const ENVY_COVET_CARD_TOOLTIP = 'The Green-Eyed Monster is envious of this card.';
const ENVY_SEALED_TOOLTIP = 'Envy has sealed this card — it cannot be played until the Green-Eyed Monster is defeated.';
const ENVY_RESOLUTION_MONSTER_TOOLTIP = 'The Green-Eyed Monster must be stopped!';

/** Pride barrier blocks plays of the barrier suit at or above its clash rank (Grovel exempt). */
function envySealBlocksHandIndex(
  room: RoomData,
  uid: string,
  hand: readonly string[],
  index: number,
): boolean {
  const curseOk = room.settings.enableCurseCards !== false;
  if (!curseOk || !envyCurseActive(room.activeCurses ?? [])) return false;
  return Boolean(envyGreedySealSlots(hand, room.envySealedCards?.[uid] ?? [])[index]);
}

function prideBlocksCard(room: RoomData, uid: string, card: string): boolean {
  const curseOk = room.settings.enableCurseCards !== false;
  if (!curseOk || !prideCurseActive(room.activeCurses ?? []) || !room.prideCeilingCard) return false;
  const self = room.players[uid];
  const opponent = Object.values(room.players).find((p) => p.uid !== uid);
  const lustHr =
    lustCurseActive(room.activeCurses ?? []) ||
    (room.status === 'powering' &&
      (self?.currentPowerCard === CURSE_LUST || opponent?.currentPowerCard === CURSE_LUST));
  const greedTx = greedCurseActive(room.activeCurses ?? []);
  return isCardBlockedByPride(card, room.prideCeilingCard, lustHr, greedTx);
}

const TyrantCrownTablePiece: React.FC<{ crownTotal: number }> = ({ crownTotal }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const tip = 'The crown card will be awarded to the player that wins this round.';
  const tooltipStyle = usePowerTooltipPosition(open, rootRef, popRef);
  return (
    <div className="relative mt-5 flex flex-col items-center gap-2">
      <p className="max-w-[18rem] px-2 text-center text-[10px] font-black uppercase leading-snug tracking-widest text-amber-200/90">
        The Tyrant is dead. Only their crown remains.
      </p>
      <motion.div
        ref={rootRef}
        layout
        className="relative cursor-pointer"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        tabIndex={0}
      >
        <div className="flex h-[7.25rem] w-[5.25rem] flex-col items-center justify-between rounded-2xl border-4 border-amber-600 bg-linear-to-b from-amber-950 to-stone-950 px-1 py-2 shadow-[0_0_36px_rgba(245,158,11,0.35)] sm:h-[8.75rem] sm:w-[6.25rem]">
          <SuitGlyph suit="Crowns" className="h-16 w-16 text-amber-400 sm:h-20 sm:w-20" />
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-100/90">Crown</span>
          <span className="font-mono text-[11px] font-bold text-amber-200">{crownTotal}/17</span>
        </div>
        {open && (
          <div
            ref={popRef}
            style={tooltipStyle}
            className="pointer-events-none fixed z-[400] max-w-[min(18rem,calc(100vw-1.5rem))] rounded-lg border border-amber-800/80 bg-stone-950/98 px-3 py-2 text-[11px] font-semibold leading-snug text-amber-50 shadow-xl"
          >
            {tip}
          </div>
        )}
      </motion.div>
    </div>
  );
};

function gluttonyMoodCopy(phase: number): string {
  if (phase >= 2) return 'Gluttony is wasting away, gluttony wants more meat';
  if (phase >= 1) return 'Gluttony is starving, gluttony wants more meat';
  return 'Gluttony is hungry, gluttony wants more meat';
}

/** Compact wheel / resolution-style table suit glyphs (areas 13–14) — frees vertical space under the HUD banner. */
const CompactTableGlyphRow: React.FC<{
  suit: Suit | null | undefined;
  greedJointTrump: boolean;
}> = ({ suit, greedJointTrump }) => {
  if (!suit) return null;
  return (
    <div className="mb-2 flex flex-col items-center gap-1">
      <span className="text-[8px] font-black uppercase tracking-wider text-slate-500">Table suit</span>
      <div
        className={`flex items-center justify-center gap-1 rounded-full border-2 border-slate-600/90 bg-slate-950/90 px-2 py-1 shadow-md ${SUIT_COLORS[suit]}`}
      >
        {greedJointTrump ? (
          <>
            <SuitGlyph suit="Diamonds" className="h-7 w-7 sm:h-8 sm:w-8" />
            <SuitGlyph suit="Coins" className="h-7 w-7 sm:h-8 sm:w-8" />
          </>
        ) : (
          <SuitGlyph suit={suit} className="h-8 w-8 sm:h-9 sm:w-9 drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]" />
        )}
      </div>
    </div>
  );
};

const CurseZonePanel: React.FC<{
  settings: GameSettings;
  activeCurses?: ActiveCurseState[];
  prideCeilingCard?: string | null;
  wrathMinionCard?: string | null;
  wrathTargetUid?: string | null;
  hostUid?: string;
  players?: Record<string, PlayerData>;
}> = ({ settings, activeCurses, prideCeilingCard, wrathMinionCard, wrathTargetUid, hostUid, players }) => {
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
  return (
    <div className="relative flex w-full max-w-[14rem] shrink-0 flex-col items-stretch gap-3 pt-1 sm:max-w-none">
      {lust && (
        <motion.div layout className="relative flex w-full flex-col items-center gap-1.5">
          <PowerCardVisual cardId={CURSE_LUST} revealed matchHandCard curseRackPeek />
          <p className="text-center text-[7px] font-black uppercase tracking-wider text-red-400">Lust</p>
          <p className="text-center font-mono text-[10px] font-bold tabular-nums leading-tight text-red-200">
            {lust.lustAccumulated ?? 0}
            <span className="text-red-500/80">/150</span>{' '}
            <span className="block text-[6px] font-bold uppercase tracking-wide text-red-400/90">Hunger</span>
          </p>
        </motion.div>
      )}
      {gluttony && (
        <motion.div layout className="relative flex w-full flex-col items-center gap-1.5">
          <PowerCardVisual cardId={CURSE_GLUTTONY} revealed matchHandCard curseRackPeek />
          <p className="text-center text-[7px] font-black uppercase tracking-wider text-red-400">Gluttony</p>
          <p className="max-w-[12rem] px-0.5 text-center text-[7px] font-bold leading-snug normal-case text-red-200/95">
            {gluttonyMoodCopy(gluttony.gluttonyPhase ?? 0)}
          </p>
        </motion.div>
      )}
      {greed && (
        <motion.div
          layout
          className="relative flex w-full flex-col items-center rounded-xl border-2 border-red-900/75 bg-zinc-950 px-1.5 py-2 shadow-[0_14px_44px_rgba(0,0,0,0.55)]"
        >
          <div className="flex items-center gap-1 text-amber-500">
            <SuitGlyph suit="Diamonds" className="h-4 w-4 sm:h-5 sm:w-5" />
            <SuitGlyph suit="Coins" className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <p className="mt-1 text-center text-[7px] font-black uppercase tracking-wider text-red-400">Greed</p>
          <div className="mt-1 flex flex-col items-center gap-0.5">
            <SuitGlyph suit="Crowns" className="h-8 w-8 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)] sm:h-9 sm:w-9" />
            <p className="text-center font-mono text-[9px] font-bold tabular-nums text-amber-200">
              {(greed.greedCrown ?? 0).toString()}/17
            </p>
            <p className="px-0.5 text-center text-[6px] font-bold uppercase tracking-wide text-amber-500/90">Tax</p>
          </div>
        </motion.div>
      )}
      {pride && (
        <motion.div
          layout
          className="relative flex w-full flex-col items-center rounded-xl border-2 border-red-900/75 bg-zinc-950 px-1.5 py-2 shadow-[0_14px_44px_rgba(0,0,0,0.55)]"
        >
          <Sparkles className="mx-auto h-5 w-5 text-violet-400 sm:h-6 sm:w-6" />
          <p className="mt-1 text-center text-[7px] font-black uppercase tracking-wider text-red-400">Pride</p>
          {prideCeilingCard ? (
            <div className="mt-1 flex flex-col items-center gap-0.5">
              <p className="text-center text-[6px] font-bold uppercase tracking-wide text-violet-300/90">Barrier</p>
              <div className={`flex items-center gap-1 ${SUIT_COLORS[parseCard(prideCeilingCard).suit] ?? 'text-violet-200'}`}>
                <SuitGlyph suit={parseCard(prideCeilingCard).suit} className="h-6 w-6 sm:h-7 sm:w-7" />
                <span className="font-card-rank text-[11px] font-black tabular-nums">
                  {parseCard(prideCeilingCard).value}
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-1 px-0.5 text-center text-[6px] font-bold text-violet-300/80">Next round…</p>
          )}
        </motion.div>
      )}
      {envy && (
        <motion.div
          layout
          className="relative flex w-full flex-col items-center rounded-xl border-2 border-emerald-900/80 bg-zinc-950 px-1.5 py-2 shadow-[0_14px_44px_rgba(0,0,0,0.55)]"
        >
          <GreenEyedMonsterIcon className="mx-auto h-6 w-14 text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.45)] sm:h-7 sm:w-16" />
          <p className="mt-1 text-center text-[7px] font-black uppercase tracking-wider text-emerald-400">Envy</p>
          <p className="text-center font-mono text-[11px] font-black tabular-nums text-emerald-200">
            {(typeof envy.envyMonsterHp === 'number' ? envy.envyMonsterHp : ENVY_MONSTER_START_HP).toString()}
            <span className="text-[7px] font-bold text-emerald-500/90"> HP</span>
          </p>
        </motion.div>
      )}
      {wrath && (
        <motion.div
          layout
          className="relative flex w-full flex-col items-center rounded-xl border-2 border-red-900/75 bg-zinc-950 px-1.5 py-2 shadow-[0_14px_44px_rgba(0,0,0,0.55)]"
        >
          <div className="flex gap-0.5">
            <div
              className={`h-5 w-5 rounded-full border-2 border-zinc-600 sm:h-6 sm:w-6 ${wrathTargetUid && hostUid && wrathTargetUid === hostUid ? 'bg-zinc-100 ring-2 ring-amber-400' : 'bg-black'}`}
              title="Host seat"
            />
            <div
              className={`h-5 w-5 rounded-full border-2 border-zinc-600 sm:h-6 sm:w-6 ${wrathTargetUid && hostUid && wrathTargetUid !== hostUid ? 'bg-zinc-100 ring-2 ring-amber-400' : 'bg-black'}`}
              title="Guest seat"
            />
          </div>
          <p className="mt-1 text-center text-[7px] font-black uppercase tracking-wider text-red-400">Wrath</p>
          <p className="text-center font-mono text-[8px] font-bold tabular-nums text-red-200/95">
            {(wrath.wrathRound ?? 1)}/5
          </p>
          {wrathMinionCard ? (
            <div className="mt-1 flex flex-col items-center gap-0.5">
              <p className="text-center text-[6px] font-bold uppercase tracking-wide text-red-300/90">Agent</p>
              <div className="origin-center scale-[0.52]">
                <CardVisual
                  card={wrathMinionCard}
                  revealed
                  noAnimate
                  small
                  detailTooltip={`${describeWrathMinionTitle(wrathMinionCard)} threatens the marked player's clash rank this round.`}
                />
              </div>
            </div>
          ) : (
            <p className="mt-1 px-0.5 text-center text-[6px] font-bold text-red-300/80">Next round…</p>
          )}
          {wrathTargetUid && players?.[wrathTargetUid] && (
            <p className="mt-1 px-0.5 text-center text-[6px] font-bold leading-tight text-amber-200/95">
              Mark: {players[wrathTargetUid].name}
            </p>
          )}
        </motion.div>
      )}
      {sloth && (
        <motion.div
          layout
          className="relative flex w-full flex-col items-center rounded-xl border-2 border-indigo-900/80 bg-zinc-950 px-1.5 py-2 shadow-[0_14px_44px_rgba(0,0,0,0.55)]"
        >
          <Cloud className="mx-auto h-5 w-5 text-indigo-300/90 sm:h-6 sm:w-6" strokeWidth={1.65} />
          <p className="mt-1 text-center text-[7px] font-black uppercase tracking-wider text-indigo-300">Sloth</p>
          <p className="mt-1 px-0.5 text-center text-[6px] font-bold leading-snug normal-case text-indigo-100/95">
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

/** Plain forum-export tags when a unicode playing card glyph is not defined. */
const CLIPBOARD_SUIT_TAG: Record<string, string> = {
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  Spades: '♠',
  Stars: '★',
  Moons: 'Moon',
  Frogs: 'Frog',
  Coins: 'Coin',
  Crowns: 'Crown',
  Grovels: 'Grovel',
  Swords: 'Wrath',
  Bones: 'Bone',
  Joker: '🃏'
};

function preySideLabel(role: PlayerRole): string {
  if (role === 'Predator') return 'Guest';
  if (role === 'Prey') return 'Host';
  return 'Either player';
}

function opponentDesperationUiRelevant(room: RoomData, opp: PlayerData): boolean {
  if (!room.settings.enableDesperation || room.winner) return false;
  if (opp.desperationSpinning || opp.desperationResult != null) return true;
  if (!desperationSpinAllowed(room, opp.uid, opp)) return false;
  return opp.desperationTier >= 0;
}

const DesperationVignette: React.FC<{ tier: number, totalTiers: number }> = ({ tier, totalTiers }) => {
  if (tier <= 0 || totalTiers === 0) return null;
  const intensity = Math.min(tier / totalTiers, 1);
  return (
    <div 
      className="absolute inset-0 pointer-events-none z-[60] transition-all duration-1000 rounded-3xl"
      style={{
        boxShadow: `inset 0 0 ${intensity * 180}px ${intensity * 120}px rgba(126, 34, 206, ${intensity * 0.4}), inset 0 0 ${intensity * 100}px ${intensity * 80}px rgba(0,0,0,${intensity * 0.8})`
      }}
    />
  );
};

const InsightModal: React.FC<{ 
  intel: { type: string, cards: string[], powerCards: number[] }, 
  onClose: () => void 
}> = ({ intel, onClose }) => {
  const isPriestess = intel.type === 'Priestess'; // Hypothetical flag or check name
  const revealPool = useMemo(
    () => [
      ...intel.cards.map(card => ({ kind: 'card' as const, value: card })),
      ...intel.powerCards.map(power => ({ kind: 'power' as const, value: power }))
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
        <button onClick={onClose} className="bg-yellow-500 text-black px-12 py-4 rounded-full font-black uppercase tracking-widest text-base shadow-[0_0_40px_rgba(234,179,8,0.3)] transition-all hover:scale-110 active:scale-95">
           {intel.type === 'Priestess' ? 'Back to table' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

const AcquiredAssets: React.FC<{
  gains: { type: 'card' | 'power' | 'draw', id: string | number | 'new-card' }[];
  side: 'left' | 'right';
  label: string;
  /** Slower staggers + draw arcs when deck has just emptied into bones */
  acquisitionPace?: 'normal' | 'deliberate';
}> = ({ gains, side, label, acquisitionPace = 'normal' }) => {
  if (!gains || gains.length === 0) return null;

  const deliberate = acquisitionPace === 'deliberate';

  return (
    <div className={`absolute top-1/2 -translate-y-1/2 flex flex-col gap-2 z-50 ${side === 'left' ? 'left-6 sm:left-16' : 'right-6 sm:right-16'}`}>
      <div className={`flex flex-col mb-4 ${side === 'left' ? 'items-start' : 'items-end'}`}>
        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">{label}</span>
        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-900 border-t border-emerald-900/30 pt-1">Acquired</span>
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
            {gain.type === 'card' && (
              <div className="scale-[0.4] sm:scale-[0.6] origin-center">
                {deliberate ? (
                  <CardVisual
                    card={gain.id as string}
                    revealed
                    presentation="deckPull"
                    deckPullSide={side === 'left' ? 'left' : 'right'}
                    delay={i * 0.06}
                    presentationPace="slow"
                  />
                ) : (
                  <CardVisual card={gain.id as string} revealed />
                )}
              </div>
            )}
            {gain.type === 'power' && (
              <div className="scale-65 sm:scale-90 origin-center">
                <PowerCardVisual cardId={gain.id as number} small />
              </div>
            )}
            {gain.type === 'draw' &&
              (() => {
                const isLose = typeof gain.id === 'number' && gain.id < 0;
                const isPowerGain = gain.id === 'random-power';
                const isNewCard = gain.id === 'new-card';
                const isFamineBone = gain.id === 'famine-bone';
                const hologramClasses = isLose
                  ? 'bg-red-900/25 border-red-400/45 shadow-[0_0_24px_rgba(239,68,68,0.2)]'
                  : isPowerGain
                    ? 'bg-white/[0.08] border-white/35 shadow-[0_0_22px_rgba(255,255,255,0.12)]'
                    : isFamineBone
                      ? 'bg-emerald-900/24 border-emerald-500/35 shadow-[0_0_22px_rgba(16,185,129,0.14)]'
                    : isNewCard
                      ? 'bg-blue-900/25 border-blue-400/45 shadow-[0_0_22px_rgba(59,130,246,0.18)]'
                      : 'bg-emerald-900/20 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]';
                const haloClasses = isLose
                  ? 'bg-red-500/20 border-red-500/55 text-red-300'
                  : isPowerGain
                    ? 'bg-white/15 border-white/50 text-white'
                    : isFamineBone
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : isNewCard
                      ? 'bg-blue-500/20 border-blue-400/55 text-blue-200'
                      : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
                let label =
                  typeof gain.id === 'number' && gain.id < 0
                    ? 'LOSE'
                    : gain.id === 'random-power'
                      ? 'POWER'
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
                        : isFamineBone
                          ? 'text-emerald-200'
                        : isNewCard
                          ? 'text-blue-100'
                          : 'text-emerald-300'
                  }`}
                >
                  {label}
                </span>
              </div>
                );
              })()}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const RulesSheet: React.FC<{ settings: GameSettings; onClose: () => void }> = ({ settings, onClose }) => {
  const isPreydatorLobby = settings.hostRole === 'Preydator';
  const despairSeatPhrase =
    (settings.preydatorDesperationSeats ?? 'guest') === 'both'
      ? 'either seat'
      : (settings.preydatorDesperationSeats ?? 'guest') === 'host'
        ? 'the host seat'
        : 'the guest seat';
  const desperationDisplayRows = desperationTierRowsForDisplay(settings);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-[60] bg-emerald-950/98 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-lg mx-auto space-y-5 pb-10"
      >
        <div className="flex justify-between items-center border-b border-emerald-800 pb-3">
          <h3 className="font-black uppercase text-yellow-400 tracking-tight text-sm sm:text-base">Rules</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-emerald-900/80 transition-colors">
            <X className="w-5 h-5 text-emerald-200" />
          </button>
        </div>

        <div className="space-y-2 text-xs sm:text-sm text-emerald-100/95 leading-snug font-medium">
          <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Basics</p>
          <ul className="list-disc pl-4 space-y-1.5">
            <li>Each round there is one <strong>table suit</strong>. It acts as trump—cards in that suit outrank plays that stay off-suit.</li>
            <li>If both plays are trump or both are off-suit, you compare rank (Ace highest, then King, Queen, Jack, numbers).</li>
            <li>Round winner draws from the shared deck.</li>
            <li>
              Predator trims the prey to an empty hand. Prey tries to drain the predator or the deck before that happens (details follow your role badge).
              {isPreydatorLobby ? ' In Preydator mode the table hunts until one side survives.' : ''}
            </li>
          </ul>
        </div>

        {!settings.disableJokers && (
          <div className="space-y-2 text-xs sm:text-sm text-emerald-100/95 leading-snug font-medium">
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Jokers</p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>
                <strong>Stars table:</strong> a Joker always wins against a single non-Joker — other cards join the Star field,
                but a Joker never becomes a Star.
              </li>
              <li>
                <strong>Moons table:</strong> if the opponent played <strong>Moons</strong>, the Joker wins; if they did not play
                Moons, the Joker loses.
              </li>
              <li>
                <strong>Normal trump (Hearts, Clubs, Diamonds, Spades):</strong> the Joker wins only if the opponent&apos;s card
                matched that table suit; any off-trump card wins against the Joker.
              </li>
              <li>
                Suits like <strong>Frogs, Coins, Bones</strong> are never chosen as table trump, so they never &quot;match&quot; the
                table suit — the Joker loses to them.
              </li>
              <li>Two Jokers tie unless another effect breaks the stalemate.</li>
            </ul>
          </div>
        )}

        {!settings.disablePowerCards && (
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Power cards</p>
            <p className="text-xs text-emerald-200/90 leading-snug mb-2">
              One-shot majors you draft at the start. Tap a row to read its effect—only what applies in this lobby is enforced.
            </p>
            <div className="space-y-1.5 rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-2 max-h-[42vh] overflow-y-auto">
              {MAJOR_ARCANA.map((p) => (
                <details key={p.id} className="group rounded-lg border border-emerald-900/70 bg-black/25 open:bg-black/35">
                  <summary className="cursor-pointer select-none px-3 py-2 text-left text-[11px] sm:text-xs font-black uppercase tracking-wide text-yellow-400/95 list-none [&::-webkit-details-marker]:hidden flex justify-between gap-2 items-center">
                    <span>{p.name}</span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="px-3 pb-2.5 pt-0 text-[11px] sm:text-xs text-emerald-100/90 leading-snug font-normal normal-case border-t border-emerald-900/40">
                    {p.description}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {settings.enableDesperation && (
          <div className="space-y-2 text-xs sm:text-sm text-emerald-100/95 leading-snug font-medium">
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Desperation</p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>When desperation is allowed, prey-side players can spin a dangerous wheel instead of conceding—or to fight back.</li>
              {!isPreydatorLobby ? (
                <li>Normally only the prey seat may desperation-spin; predator cannot.</li>
              ) : (
                <li>In Preydator mode the host chooses which seat may spin ({despairSeatPhrase}).</li>
              )}
              <li>Worst wedge can instantly end your game—good wedges add cards.</li>
              {settings.desperationStarterTierEnabled ? (
                <li>Starter tier is on—you begin on the desperation ladder sooner.</li>
              ) : (
                <li>Starter tier may be off—your first desperation spin pulls you onto the ladder.</li>
              )}
            </ul>
            {desperationDisplayRows.length > 0 && (
              <p className="text-[11px] text-emerald-300/95 pl-4">
                Ladder labels in play this match:{' '}
                <span className="font-semibold text-emerald-100">
                  {desperationDisplayRows.map((r) => r.label).join(', ')}
                </span>
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-emerald-800 hover:bg-emerald-700 py-3 rounded-xl font-black uppercase text-xs tracking-wider text-emerald-50 transition-colors"
        >
          Close
        </button>
      </div>
    </motion.div>
  );
};

const DevPowerMenu: React.FC<{
  onSelect: (id: number) => void;
  onClose: () => void;
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

      {onActivateCurseOnTable && onClearActiveCurses && (
        <div className="mb-5 rounded-2xl border border-amber-500/40 bg-amber-950/25 p-4 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Curses · table zone</p>
          <p className="text-[10px] text-slate-400 leading-snug">
            Activates curse effects as if resolved on the board (syncs via host). Clearing removes active curses, seals, wrath targets, greed coin injection from the pile, and restores Sloth suit list when applicable.
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
            {CURSE_IDS.map((curseId) => {
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
              onClick={() => { onSelect(i); onClose(); }}
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
                  <CursePowerIcon
                    curseId={curseId}
                    className={`h-8 w-8 ${cursePowerIconClass(curseId)}`}
                  />
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
    </div>
  );
};

type ResolutionFx =
  | null
  | { kind: 'death_slash'; victimUid: string }
  | { kind: 'clash_shatter'; uid: string; cardId: string }
  | { kind: 'tower_shield'; towerUid: string }
  | { kind: 'fool_swap' }
  | { kind: 'judgement_flash' }
  | { kind: 'temperance_balance' }
  | { kind: 'star_sparkle'; uid: string }
  | { kind: 'frog_curse'; uid: string }
  | { kind: 'emperor_glow'; uid: string }
  | { kind: 'strength_pulse'; uid: string }
  | { kind: 'lovers_hearts' }
  | { kind: 'chariot_zip'; uid: string }
  | { kind: 'hangman_drop'; uid: string }
  | { kind: 'empress_pull'; uid: string }
  | { kind: 'hermit_glow'; uid: string }
  | { kind: 'devil_flame'; uid: string }
  | { kind: 'justice_echo'; uid: string }
  | { kind: 'priestess_glimpse'; uid: string }
  | { kind: 'magician_steal'; uid: string }
  | { kind: 'wheel_chaos'; uid: string }
  | { kind: 'envy_lunge'; uid: string }
  | { kind: 'moon_glow'; uid: string };

function deriveResolutionFx(event: ResolutionEvent, hostUid: string, guestUid: string): ResolutionFx {
  const otherUid = (uid: string) => (uid === hostUid ? guestUid : hostUid);

  if (event.type === 'CLASH_DESTROYED' && event.uid && event.cardId) {
    return { kind: 'clash_shatter', uid: event.uid, cardId: event.cardId };
  }

  if (event.type === 'POWER_TRIGGER') {
    const id = event.powerCardId;
    const uid = event.uid;
    if (id === 13 && uid) return { kind: 'death_slash', victimUid: otherUid(uid) };
    if (id === 16 && uid) return { kind: 'tower_shield', towerUid: uid };
    if (id === 0) return { kind: 'fool_swap' };
    if (id === 20) return { kind: 'judgement_flash' };
    if (id === 14) return { kind: 'temperance_balance' };
    if (id === 4 && uid) return { kind: 'emperor_glow', uid };
    if (id === 8 && uid) return { kind: 'strength_pulse', uid };
    if (id === 6) return { kind: 'lovers_hearts' };
    if (id === 7 && uid) return { kind: 'chariot_zip', uid };
    if (id === 12 && uid) return { kind: 'hangman_drop', uid };
    if (id === 3 && uid) return { kind: 'empress_pull', uid };
    if (id === 9 && uid) return { kind: 'hermit_glow', uid };
    if (id === 15 && uid) return { kind: 'devil_flame', uid };
    if (id === 11 && uid) return { kind: 'justice_echo', uid };
    if (id === 2 && uid) return { kind: 'priestess_glimpse', uid };
    if (id === 1 && uid) return { kind: 'magician_steal', uid };
    if (id === 10 && uid) return { kind: 'wheel_chaos', uid };
    return null;
  }

  if (event.type === 'TRANSFORM') {
    if (event.uid && event.powerCardId === 17) return { kind: 'star_sparkle', uid: event.uid };
    if (event.uid && event.powerCardId === 18) return { kind: 'moon_glow', uid: event.uid };
    if (event.uid && (event.powerCardId === 1 || (event.cardId?.startsWith('Frogs') ?? false))) {
      return { kind: 'frog_curse', uid: event.uid };
    }
  }

  if (event.type === 'ENVY_STRIKE' && event.uid) return { kind: 'envy_lunge', uid: event.uid };

  return null;
}

function resolutionColumnMotion(fx: ResolutionFx, uid: string) {
  if (!fx) return {};
  if (fx.kind === 'fool_swap') return { x: [0, -7, 7, -5, 5, 0], y: [0, 4, -4, 0], rotate: [0, -5, 5, 0] };
  if (fx.kind === 'death_slash' && fx.victimUid === uid) return { x: [0, -9, 9, -5, 5, 0], scale: [1, 0.94, 1] };
  if (fx.kind === 'strength_pulse' && fx.uid === uid) return { scale: [1, 1.09, 1] };
  if (fx.kind === 'emperor_glow' && fx.uid === uid)
    return { scale: [1, 1.05, 1], filter: ['brightness(1)', 'brightness(1.28)', 'brightness(1)'] };
  if (fx.kind === 'chariot_zip' && fx.uid === uid) return { x: [0, -14, 6, 0], opacity: [1, 0.82, 1] };
  if (fx.kind === 'hangman_drop' && fx.uid === uid) return { y: [0, 18, 0], opacity: [1, 0.55, 1] };
  if (fx.kind === 'empress_pull' && fx.uid === uid) return { scale: [1, 1.06, 1], rotate: [0, 3, 0] };
  if (fx.kind === 'hermit_glow' && fx.uid === uid)
    return { filter: ['brightness(1)', 'brightness(1.18)', 'brightness(1)'] };
  if (fx.kind === 'devil_flame' && fx.uid === uid) return { scale: [1, 1.04, 1], rotate: [0, -2, 2, 0] };
  if (fx.kind === 'justice_echo' && fx.uid === uid) return { scale: [1, 1.06, 1] };
  if (fx.kind === 'priestess_glimpse' && fx.uid === uid) return { scale: [1, 1.04, 1] };
  if (fx.kind === 'magician_steal' && fx.uid === uid) return { rotate: [0, -4, 4, 0] };
  if (fx.kind === 'wheel_chaos' && fx.uid === uid) return { rotate: [0, -7, 7, -4, 0], x: [0, 4, -4, 0] };
  if (fx.kind === 'star_sparkle' && fx.uid === uid) return { scale: [1, 1.07, 1] };
  if (fx.kind === 'frog_curse' && fx.uid === uid) return { scale: [1, 0.96, 1] };
  if (fx.kind === 'envy_lunge' && fx.uid === uid)
    return { y: [0, -34, -8, 0], rotate: [0, -7, 2, 0], scale: [1, 1.08, 1] };
  if (fx.kind === 'moon_glow' && fx.uid === uid)
    return { scale: [1, 1.065, 1], filter: ['brightness(1)', 'brightness(1.2)', 'brightness(1)'] };
  return {};
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferCoinFlipWinnerUid(message: string, room: RoomData): string | null {
  const uids = Object.keys(room.players).sort(
    (a, b) => room.players[b].name.length - room.players[a].name.length
  );
  for (const uid of uids) {
    const raw = room.players[uid].name.trim();
    if (raw.length < 2) continue;
    const re = new RegExp(`${escapeRegex(raw)}(?:'s)?\\s+wins\\b`, 'i');
    if (re.test(message)) return uid;
  }
  return null;
}

/** Cosmetic-only: matches bundled coinflip (720deg vs 900deg) outcome so the landed face aligns with resolved priority. */
function priorityFlipLandingDegrees(winnerUid: string | null, room: RoomData): CssCoinFlipDegrees {
  if (!winnerUid || !room.players[winnerUid]) return '720deg';
  const role = room.players[winnerUid].role;
  if (role === 'Predator') return '900deg';
  if (role === 'Prey') return '720deg';
  const k = winnerUid.charCodeAt(Math.min(7, winnerUid.length - 1));
  return k % 2 === 0 ? '720deg' : '900deg';
}

/** Priority coin from /coinflip (CSS 3D O/I coin), then predator / prey / preydator readout (unchanged). */
const PriorityFlipCard: React.FC<{
  winnerUid: string | null;
  room: RoomData;
}> = ({ winnerUid, room }) => {
  const role = winnerUid ? room.players[winnerUid]?.role : null;
  const [landed, setLanded] = useState(false);
  const landingFlip = priorityFlipLandingDegrees(winnerUid, room);

  return (
    <div className="mb-6 flex flex-col items-center gap-4 [perspective:1400px]">
      <div className="relative flex min-h-[12.75rem] w-full max-w-[22rem] items-center justify-center overflow-hidden rounded-2xl shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] ring-2 ring-black/40">
        {!landed && (
          <CssCoinEmbed
            key={`flip-${winnerUid ?? 'neutral'}-${landingFlip}`}
            flipDegrees={landingFlip}
            autoPlay
            onAnimationEnd={() => setLanded(true)}
            className="w-full rounded-2xl"
          />
        )}

        {landed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateY: -6 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 overflow-hidden bg-emerald-950/10 shadow-[0_16px_52px_rgba(0,0,0,0.5)]"
          >
            {winnerUid ? (
              role === 'Predator' ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-red-900 to-black" />
                  <div className="relative z-10 flex flex-col items-center gap-2 text-red-100">
                    <div className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] text-red-200">
                      <WolfIcon />
                    </div>
                    <span className="text-sm sm:text-base font-black uppercase tracking-[0.22em] text-red-50">Predator</span>
                  </div>
                </>
              ) : role === 'Prey' ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900" />
                  <div className="relative z-10 flex flex-col items-center gap-2 text-sky-100">
                    <Rabbit className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem] opacity-95" strokeWidth={1.5} />
                    <span className="text-sm sm:text-base font-black uppercase tracking-[0.22em] text-sky-100">Prey</span>
                  </div>
                </>
              ) : role === 'Preydator' ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-fuchsia-950 to-slate-950" />
                  <div className="relative z-10 flex flex-col items-center gap-3 text-purple-50">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 text-red-200">
                        <WolfIcon />
                      </div>
                      <Rabbit className="h-14 w-14 text-sky-200" strokeWidth={1.5} />
                    </div>
                    <span className="text-xs sm:text-sm font-black uppercase tracking-[0.24em] text-purple-100">Preydator</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-black" />
                  <span className="relative z-10 text-lg font-black uppercase tracking-widest text-white">Leads</span>
                </>
              )
            ) : (
              <>
                <div className="absolute inset-0 bg-black/88 backdrop-blur-[2px]" />
                <div className="relative z-10 flex flex-col items-center gap-1.5 text-center px-2">
                  <span className="text-4xl sm:text-5xl text-amber-300 drop-shadow-lg">⚖</span>
                  <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-100/95">Seat order only</span>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1 text-center px-4">
        <span className="text-xs sm:text-sm font-black uppercase tracking-[0.28em] text-amber-200/95">Priority flip</span>
        {winnerUid && (
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="max-w-[20rem] text-sm sm:text-base font-bold uppercase italic tracking-wide text-yellow-300/95 leading-snug"
          >
            {room.players[winnerUid].name} — leads (
            {room.players[winnerUid].role === 'Preydator'
              ? 'Preydator'
              : room.players[winnerUid].role === 'Predator'
                ? 'Predator'
                : 'Prey'}
            )
          </motion.span>
        )}
      </div>
    </div>
  );
};

const ResolutionSequence: React.FC<{ 
  room: RoomData, 
  myUid: string, 
  onComplete: () => void 
}> = ({ room, myUid, onComplete }) => {
  const outcome = room.lastOutcome!;
  const [eventIndex, setEventIndex] = useState(-1);
  const [currentCards, setCurrentCards] = useState(() => ({ ...(outcome as any).initialCardsPlayed || outcome.cardsPlayed }));
  const [currentTarget, setCurrentTarget] = useState(room.targetSuit);
  const [summoned, setSummoned] = useState<Record<string, string>>({});
  const [devilStolen, setDevilStolen] = useState<Record<string, number>>({});
  const [visibleEvents, setVisibleEvents] = useState<
    { id: number; message: string; eventType?: ResolutionEventType; coinWinnerUid?: string | null }
  >([]);
  const [isDone, setIsDone] = useState(false);
  const [towerScorch, setTowerScorch] = useState<Record<string, boolean>>({});
  const [resolutionFx, setResolutionFx] = useState<ResolutionFx>(null);
  const [lustHeartBurst, setLustHeartBurst] = useState(false);
  /** Per-seat resolution morph overlay on the played card (`transform` = identity swap flip, `upgrade` = rank/suit flicker ladder). */
  const [resolutionCardMorph, setResolutionCardMorph] = useState<Record<string, 'transform' | 'upgrade'>>({});

  const lustHeartParticles = useMemo(() => {
    if (!outcome.lustRoundFx?.contributions.length) return [] as { uid: string; k: string }[];
    const out: { uid: string; k: string }[] = [];
    let g = 0;
    for (const c of outcome.lustRoundFx.contributions) {
      const pts = Math.max(0, Math.floor(c.lustPointsAdded));
      for (let h = 0; h < pts; h++) {
        out.push({ uid: c.uid, k: `lust-${g++}-${h}` });
      }
    }
    return out;
  }, [outcome.lustRoundFx]);
  const [postClashGhost, setPostClashGhost] = useState<Record<string, boolean>>({});
  const [envyShownHp, setEnvyShownHp] = useState<number | null>(
    outcome.envyRoundFx ? outcome.envyRoundFx.monsterHpStart : null,
  );
  const [slothDreamWheel, setSlothDreamWheel] = useState<{ offset: number; spinning: boolean } | null>(null);

  useEffect(() => {
    if (!isDone) return;
    setTowerScorch((prev) => {
      const next = { ...prev };
      Object.keys(room.players).forEach((uid) => {
        if (outcome.powerCardTowerBlocked?.[uid]) next[uid] = true;
      });
      return next;
    });
  }, [isDone, outcome.powerCardTowerBlocked, room.players]);

  useEffect(() => {
    let active = true;
    const processNext = async () => {
      await new Promise(r => setTimeout(r, 800));
      if (!active) return;

      const hostUid = room.hostUid;
      const guestUid = Object.keys(room.players).find(id => id !== hostUid)!;
      
      const events = outcome.events || [];
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const fx = deriveResolutionFx(event, hostUid, guestUid);
        setResolutionFx(fx);
        setEventIndex(i);
        setVisibleEvents(prev => [
          ...prev,
          {
            id: Date.now() + i,
            message: event.message,
            eventType: event.type,
            coinWinnerUid:
              event.type === 'COIN_FLIP' ? inferCoinFlipWinnerUid(event.message, room) : undefined,
          },
        ]);
        
        switch (event.type) {
          case 'CARD_SWAP':
            if (event.uid && event.cardId) {
               setCurrentCards(prev => ({ ...prev, [event.uid!]: event.cardId! }));
            } else if (!event.uid) {
               setCurrentCards(prev => {
                 const uids = Object.keys(prev);
                 if (uids.length < 2) return prev;
                 return { [uids[0]]: prev[uids[1]], [uids[1]]: prev[uids[0]] };
               });
            }
            break;
          case 'TARGET_CHANGE':
            if (event.suit) setCurrentTarget(event.suit);
            break;
          case 'CARD_EMPOWER':
            if (event.uid && event.cardId && event.fromCardId) {
              const f = parseCard(event.fromCardId);
              const t = parseCard(event.cardId);
              const steps = (
                f.suit === 'Hearts' && t.suit === 'Hearts'
                  ? lustHeartUpgradeSteps(event.fromCardId, event.cardId)
                  : playingCardUpgradeSteps(event.fromCardId, event.cardId)
              ).filter(Boolean);
              if (steps.length > 1) {
                setResolutionCardMorph((m) => ({ ...m, [event.uid!]: 'upgrade' }));
                for (let s = 0; s < steps.length; s++) {
                  const stepCard = steps[s];
                  setCurrentCards((prev) => ({ ...prev, [event.uid!]: stepCard }));
                  await new Promise((r) => setTimeout(r, s === 0 ? 120 : 280));
                  if (!active) return;
                }
                setResolutionCardMorph((m) => {
                  const next = { ...m };
                  delete next[event.uid!];
                  return next;
                });
              } else {
                setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.cardId! }));
              }
            } else if (event.uid && event.cardId) {
              setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.cardId! }));
            }
            break;
          case 'SUMMON_CARD':
            if (event.uid && event.cardId) {
               setSummoned(prev => ({ ...prev, [event.uid!]: event.cardId! }));
            }
            break;
          case 'POWER_TRIGGER':
            if (event.powerCardId === CURSE_LUST && (event.lustFeedPts ?? 0) > 0 && event.uid) {
              setLustHeartBurst(true);
              if (event.lustSurgeHeart) {
                setResolutionCardMorph((m) => ({ ...m, [event.uid!]: 'upgrade' }));
                await new Promise((r) => setTimeout(r, 460));
                if (!active) return;
                setResolutionCardMorph((m) => {
                  const next = { ...m };
                  delete next[event.uid!];
                  return next;
                });
              }
            }
            if (event.uid) {
               // Devil specific UI feedback
               if (event.powerCardId === 15) {
                 const oUid = Object.keys(room.players).find(id => id !== event.uid)!;
                 const oPower = outcome.powerCardIdsPlayed[oUid];
                 if (oPower !== null && oPower !== 15 && oPower !== 16) {
                    setDevilStolen(prev => ({ ...prev, [event.uid!]: oPower }));
                 }
               }
               const finalCard = outcome.cardsPlayed[event.uid];
               if (finalCard) {
                  setCurrentCards(prev => {
                    if (prev[event.uid!] === finalCard) return prev;
                    return { ...prev, [event.uid!]: finalCard };
                  });
               }
            }
            break;
          case 'POWER_DESTROYED':
            if (event.uid) {
              setTowerScorch((prev) => ({ ...prev, [event.uid!]: true }));
            }
            break;
          case 'COIN_FLIP':
          case 'INTEL_REVEAL':
            break;
          case 'CLASH_DESTROYED':
            if (event.uid) setPostClashGhost((p) => ({ ...p, [event.uid]: true }));
            break;
          case 'TRANSFORM':
            if (event.uid && event.cardId && event.fromCardId && event.fromCardId !== event.cardId) {
              setResolutionCardMorph((m) => ({ ...m, [event.uid!]: 'transform' }));
              /** Swap near the rotateY flat edge (~48% · see CardVisual `times`) */
              await new Promise((r) => setTimeout(r, 440));
              if (!active) return;
              setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.cardId! }));
              await new Promise((r) => setTimeout(r, 520));
              if (!active) return;
              setResolutionCardMorph((m) => {
                const next = { ...m };
                delete next[event.uid!];
                return next;
              });
            } else if (event.uid && event.cardId) {
              setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.cardId! }));
            }
            break;
          case 'ENVY_COVET':
            if (
              outcome.envyRoundFx &&
              typeof outcome.envyRoundFx.monsterHpAfterFeed === 'number' &&
              (event.envyDamage ?? 0) > 0
            ) {
              setEnvyShownHp(outcome.envyRoundFx.monsterHpAfterFeed);
            }
            break;
          case 'ENVY_STRIKE':
            if (typeof event.envyHpAfter === 'number') setEnvyShownHp(event.envyHpAfter);
            break;
          case 'SLOTH_DREAM':
            break;
        }
        let pauseMs =
          event.type === 'COIN_FLIP'
            ? 5800
            : event.type === 'POWER_DESTROYED'
              ? 1500
              : event.type === 'CARD_EMPOWER' || event.type === 'TARGET_CHANGE'
                ? 980
                : event.type === 'POWER_TRIGGER'
                  ? (event.powerCardId === CURSE_LUST && (event.lustFeedPts ?? 0) > 0 ? 1320 : 1050)
                  : event.type === 'ENVY_COVET' || event.type === 'ENVY_STRIKE' || event.type === 'ENVY_DEFEATED' || event.type === 'ENVY_DEPARTS'
                  ? 1280
                  : event.type === 'SLOTH_DREAM'
                    ? typeof event.slothDreamSpinOffset === 'number'
                      ? Math.round(slothDreamWheelDefinition.spinDurationSeconds * 1000 + 750)
                      : 1200
                    : 1150;
        if (fx?.kind === 'death_slash' || fx?.kind === 'tower_shield') pauseMs = Math.max(pauseMs, 1380);
        if (fx?.kind === 'envy_lunge') pauseMs = Math.max(pauseMs, 1380);
        if (fx?.kind === 'clash_shatter') pauseMs = Math.max(pauseMs, 1640);
        if (fx?.kind === 'judgement_flash' || fx?.kind === 'temperance_balance') pauseMs = Math.max(pauseMs, 1240);
        if (fx?.kind === 'fool_swap') pauseMs = Math.max(pauseMs, 1180);
        if (
          event.type === 'SLOTH_DREAM' &&
          typeof event.slothDreamSpinOffset === 'number' &&
          outcome.slothDreamFx
        ) {
          setSlothDreamWheel({ offset: event.slothDreamSpinOffset, spinning: true });
        }
        await new Promise(r => setTimeout(r, pauseMs));
        if (!active) return;
        if (
          event.type === 'SLOTH_DREAM' &&
          typeof event.slothDreamSpinOffset === 'number' &&
          outcome.slothDreamFx
        ) {
          setSlothDreamWheel({ offset: event.slothDreamSpinOffset, spinning: false });
          await new Promise((r) => setTimeout(r, 520));
          if (!active) return;
          setSlothDreamWheel(null);
        }
        setResolutionFx(null);
      }
      
      setCurrentCards(prev => {
        const next = { ...outcome.cardsPlayed };
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
      
      setEventIndex(events.length);
      setIsDone(true);
      // Increased delay to 3.5s to let the final state sink in
      await new Promise(r => setTimeout(r, 3500));
      if (!active) return;
      onComplete();
    };
    processNext();
    return () => {
      active = false;
      setResolutionFx(null);
      setSlothDreamWheel(null);
    };
  }, [outcome.events, outcome.cardsPlayed, outcome.slothDreamFx, room.hostUid, room.players]);

  const hostUid = room.hostUid;
  const guestUid = Object.keys(room.players).find(id => id !== hostUid)!;

  const lustHeartResolution =
    room.settings.enableCurseCards &&
    (lustCurseActive(room.activeCurses ?? []) ||
      outcome.powerCardIdsPlayed[hostUid] === CURSE_LUST ||
      outcome.powerCardIdsPlayed[guestUid] === CURSE_LUST);

  return (
    <div className="relative overflow-hidden flex flex-col items-center w-full h-full max-h-screen p-4 sm:p-6 justify-center rounded-2xl border border-slate-800/50 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(251,191,36,0.14),transparent_58%),linear-gradient(180deg,#020617_0%,#0f172a_50%,#020617_100%)] shadow-[inset_0_0_100px_rgba(15,23,42,0.55)]">
      <AnimatePresence>
        {slothDreamWheel && (
          <motion.div
            key="sloth-dream-wheel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none absolute inset-x-4 top-[16%] z-[95] mx-auto flex max-w-md flex-col items-center gap-2 sm:inset-x-8"
          >
            <span className="text-center text-[11px] font-black uppercase italic tracking-[0.2em] text-indigo-200/95">
              Sloth is dreaming of…
            </span>
            <ConfigurableWheel
              definition={slothDreamWheelDefinition}
              segments={SLOTH_DREAM_WHEEL_SEGMENTS}
              offset={slothDreamWheel.offset}
              spinning={slothDreamWheel.spinning}
              sizeClass="w-[14.5rem] h-[14.5rem] sm:w-64 sm:h-64"
              decorativeRings
            />
          </motion.div>
        )}
      </AnimatePresence>
      {lustHeartBurst && lustHeartParticles.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-[85] overflow-hidden">
          {lustHeartParticles.map((part, i) => (
            <motion.div
              key={part.k}
              initial={{
                opacity: 0,
                scale: 0.22,
                left: part.uid === hostUid ? '36%' : '64%',
                top: '54%',
              }}
              animate={{
                opacity: [0, 1, 0.9, 0],
                scale: [0.22, 0.94, 0.72],
                left: lustHeartResolution ? '12%' : part.uid === hostUid ? '36%' : '64%',
                top: lustHeartResolution ? '21%' : '48%',
              }}
              transition={{
                duration: lustHeartResolution ? 1.28 : 0.85,
                delay: i * 0.042,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 sm:h-8 sm:w-8"
            >
              <Heart className="h-full w-full fill-red-600 text-red-300 drop-shadow-[0_0_14px_rgba(239,68,68,0.95)]" />
            </motion.div>
          ))}
        </div>
      )}
      <AnimatePresence>
        {resolutionFx?.kind === 'judgement_flash' && (
          <motion.div
            key="judgement-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.72, 0.28, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.88 }}
            className="pointer-events-none absolute inset-0 z-[70] bg-fuchsia-600/35 mix-blend-screen"
          />
        )}
        {resolutionFx?.kind === 'temperance_balance' && (
          <motion.div
            key="temperance-balance"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0.22, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.92 }}
            className="pointer-events-none absolute inset-0 z-[70] bg-[radial-gradient(ellipse_55%_45%_at_50%_50%,rgba(34,211,238,0.28),transparent_72%)]"
          />
        )}
      </AnimatePresence>

      <div className="relative mb-4 flex w-full max-w-[52rem] flex-none flex-col px-2">
        <AnimatePresence>
          {resolutionFx?.kind === 'lovers_hearts' && (
            <>
              <motion.div
                key="lover-h1"
                initial={{ opacity: 0, y: 8, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0.85], y: [8, -10, -4], scale: [0.5, 1.1, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75 }}
                className="pointer-events-none absolute -left-6 top-1/2 z-10 -translate-y-1/2"
              >
                <Heart className="h-5 w-5 fill-pink-500/35 text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.6)]" />
              </motion.div>
              <motion.div
                key="lover-h2"
                initial={{ opacity: 0, y: 8, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0.85], y: [8, -14, -6], scale: [0.5, 1.05, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75, delay: 0.06 }}
                className="pointer-events-none absolute -right-6 top-1/2 z-10 -translate-y-1/2"
              >
                <Heart className="h-5 w-5 fill-pink-500/35 text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.6)]" />
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <div
          className={`grid w-full items-start gap-y-6 ${lustHeartResolution ? 'sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,7.5rem)] sm:gap-x-4' : ''}`}
        >
          <div className="flex flex-col items-center gap-1.5 sm:items-end sm:pt-1">
            {lustHeartResolution && (
              <>
                <span className="text-[9px] font-black uppercase tracking-wider text-rose-400/95">Lust</span>
                <PowerCardVisual cardId={CURSE_LUST} small revealed />
                {outcome.lustRoundFx && (
                  <span className="text-center text-[10px] font-black tabular-nums text-rose-200/95 sm:text-right">
                    {outcome.lustRoundFx.previousMeter}
                    <span className="text-rose-500/80"> → </span>
                    {outcome.lustRoundFx.sated ? 0 : outcome.lustRoundFx.nextMeter}
                  </span>
                )}
              </>
            )}
          </div>
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 sm:text-sm">Table suit</span>
              <motion.div
                key={currentTarget || 'none'}
                initial={{ scale: 0.75, opacity: 0.4, filter: 'drop-shadow(0 0 0 rgba(251,191,36,0))' }}
                animate={{ scale: 1.06, opacity: 1, filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.45))' }}
                transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                className={`flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-full border-2 border-slate-600 bg-slate-900 shadow-2xl sm:h-16 sm:w-16 ${SUIT_COLORS[currentTarget || 'Hearts']}`}
              >
                <SuitGlyph
                  suit={currentTarget || 'Hearts'}
                  className="h-[2.35rem] w-[2.35rem] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:h-11 sm:w-11"
                />
              </motion.div>
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 sm:text-sm">this round</span>
            </div>
          </motion.div>
          {lustHeartResolution ? <div className="hidden sm:block" aria-hidden /> : null}
        </div>
      </div>

      {outcome.envyRoundFx && envyShownHp !== null && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          title={ENVY_RESOLUTION_MONSTER_TOOLTIP}
          className="mb-4 flex flex-col items-center gap-2"
        >
          <GreenEyedMonsterIcon className="h-12 w-28 text-emerald-400 drop-shadow-[0_0_26px_rgba(16,185,129,0.45)] sm:h-14 sm:w-32" />
          <span className="font-mono text-lg font-black tabular-nums text-emerald-200 sm:text-2xl">
            {envyShownHp}{' '}
            <span className="text-xs font-black uppercase tracking-wider text-emerald-500">HP</span>
          </span>
        </motion.div>
      )}

      <div className="flex-none w-full max-w-4xl flex items-center justify-center gap-4 sm:gap-12">
        {[hostUid, guestUid].map((uid, idx) => (
          <div key={uid} className="flex flex-col items-center gap-3 relative scale-90 sm:scale-100">
            <motion.div 
              initial={{ x: idx === 0 ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className={`px-2 py-0.5 rounded border border-slate-800 bg-slate-950/80 backdrop-blur-sm ${room.players[uid].role === 'Predator' ? 'text-red-500 border-red-900/30' : (room.players[uid].role === 'Preydator' ? 'text-purple-500 border-purple-900/30' : 'text-blue-400 border-blue-900/30')}`}
            >
               <span className="text-[8px] font-black uppercase tracking-widest leading-none block">{room.players[uid].name}</span>
            </motion.div>

            {outcome.wrathFx && outcome.wrathFx.targetUid === uid && (
              <motion.div
                className="pointer-events-none absolute -top-6 left-1/2 z-40 flex w-[10rem] -translate-x-1/2 justify-center sm:w-[11rem]"
                initial={{ y: -10, opacity: 1 }}
                animate={{ y: [0, -12, 0], opacity: 1 }}
                transition={{
                  y: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' },
                }}
              >
                <div className="origin-top scale-[0.62] drop-shadow-[0_0_28px_rgba(220,38,38,0.5)] sm:scale-[0.68]">
                  <CardVisual card={outcome.wrathFx.minionCard} revealed noAnimate presentation="none" small />
                </div>
              </motion.div>
            )}

            <div className="relative">
              <div className="flex items-end gap-2">
                <motion.div
                  className="relative z-10 rounded-xl shadow-[0_0_32px_rgba(250,204,21,0.18)] overflow-visible"
                  animate={resolutionColumnMotion(resolutionFx, uid)}
                  transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                >
                  <CardVisual
                    card={currentCards[uid]}
                    revealed
                    presentation="deckPull"
                    deckPullSide={idx === 0 ? 'left' : 'right'}
                    delay={idx * 0.07}
                    lustHeartRulesActive={lustHeartResolution}
                    clashGhost={Boolean(postClashGhost[uid])}
                    resolutionMorph={resolutionCardMorph[uid] ?? null}
                  />
                  <AnimatePresence>
                    {resolutionFx?.kind === 'clash_shatter' && resolutionFx.uid === uid && (
                      <motion.div
                        key="clash-shatter"
                        className="pointer-events-none absolute inset-0 z-[32] flex items-center justify-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <div className="relative h-[102%] w-[92%]">
                          <motion.div
                            className="absolute inset-0 overflow-hidden rounded-xl"
                            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                            animate={{ x: -26, y: -18, rotate: -11, opacity: 0 }}
                            transition={{ duration: 0.88, ease: [0.22, 1, 0.36, 1] }}
                            style={{ clipPath: 'polygon(0 0, 100% 0, 52% 52%, 0 100%)' }}
                          >
                            <div className="flex h-full w-full items-center justify-center">
                              <div className="origin-center scale-[0.98]">
                                <CardVisual
                                  card={resolutionFx.cardId}
                                  revealed
                                  noAnimate
                                  presentation="none"
                                  small
                                />
                              </div>
                            </div>
                          </motion.div>
                          <motion.div
                            className="absolute inset-0 overflow-hidden rounded-xl"
                            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                            animate={{ x: 26, y: 18, rotate: 11, opacity: 0 }}
                            transition={{ duration: 0.88, ease: [0.22, 1, 0.36, 1] }}
                            style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%, 52% 52%)' }}
                          >
                            <div className="flex h-full w-full items-center justify-center">
                              <div className="origin-center scale-[0.98]">
                                <CardVisual
                                  card={resolutionFx.cardId}
                                  revealed
                                  noAnimate
                                  presentation="none"
                                  small
                                />
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                    {resolutionFx?.kind === 'death_slash' && resolutionFx.victimUid === uid && (
                      <motion.div
                        key="death-slash"
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
                          className="pointer-events-none absolute inset-0 z-[29] flex rounded-xl overflow-hidden"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                        >
                          <motion.div
                            className="w-1/2 h-full bg-black/50 backdrop-blur-[0.5px]"
                            initial={{ x: 0 }}
                            animate={{ x: '-32%' }}
                            transition={{ delay: 0.15, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                          />
                          <motion.div
                            className="w-1/2 h-full bg-black/50 backdrop-blur-[0.5px]"
                            initial={{ x: 0 }}
                            animate={{ x: '32%' }}
                            transition={{ delay: 0.15, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                          />
                        </motion.div>
                      </motion.div>
                    )}
                    {resolutionFx?.kind === 'tower_shield' && resolutionFx.towerUid === uid && (
                      <motion.div
                        key="tower-shield"
                        className="pointer-events-none absolute inset-[-14px] z-[26] flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.65 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                      >
                        <div className="absolute inset-2 rounded-full bg-sky-400/20 blur-2xl" />
                        <Shield className="relative w-[5.25rem] h-[5.25rem] text-sky-200/95 drop-shadow-[0_0_28px_rgba(56,189,248,0.85)]" strokeWidth={1.35} />
                      </motion.div>
                    )}
                    {resolutionFx?.kind === 'star_sparkle' && resolutionFx.uid === uid && (
                      <motion.div
                        key="star-sparkle"
                        className="pointer-events-none absolute -inset-4 z-[24] flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1, rotate: [0, 8, -6, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.65 }}
                      >
                        <Sparkles className="w-[4.5rem] h-[4.5rem] text-amber-300 drop-shadow-[0_0_22px_rgba(253,224,71,0.95)]" />
                      </motion.div>
                    )}
                    {resolutionFx?.kind === 'moon_glow' && resolutionFx.uid === uid && (
                      <motion.div
                        key="moon-glow"
                        className="pointer-events-none absolute -inset-4 z-[24] flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.72 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                      >
                        <Moon className="w-[4rem] h-[4rem] text-indigo-100 drop-shadow-[0_0_26px_rgba(199,210,254,0.92)] sm:h-[4.25rem] sm:w-[4.25rem]" strokeWidth={1.6} />
                      </motion.div>
                    )}
                    {resolutionFx?.kind === 'frog_curse' && resolutionFx.uid === uid && (
                      <motion.div
                        key="frog-curse"
                        className="pointer-events-none absolute inset-0 z-[22] rounded-xl ring-[3px] ring-lime-400/80 shadow-[0_0_36px_rgba(163,230,53,0.55)]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0.75] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.55 }}
                      />
                    )}
                  </AnimatePresence>
                  <div className="absolute -top-2 -right-2 z-20">
                    {outcome.powerCardIdsPlayed[uid] !== null && (
                      <div className="relative">
                        <motion.div
                          animate={
                            towerScorch[uid]
                              ? {
                                  scale: [1, 1.08, 0.92],
                                  filter: [
                                    'brightness(1) grayscale(0)',
                                    'brightness(1.35) sepia(0.35)',
                                    'brightness(0.75) grayscale(1)',
                                  ],
                                }
                              : { scale: 1, filter: 'brightness(1) grayscale(0)' }
                          }
                          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                          className={`p-1 rounded-full bg-black border border-slate-700 shadow-xl overflow-visible scale-65 origin-top-right ${outcome.powerCardIdsPlayed[uid] === 15 ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
                        >
                          <PowerCardVisual
                            cardId={outcome.powerCardIdsPlayed[uid]!}
                            small
                            destroyed={Boolean(
                              towerScorch[uid] ||
                                (isDone && outcome.powerCardTowerBlocked?.[uid])
                            )}
                          />
                        </motion.div>
                        <AnimatePresence>
                          {devilStolen[uid] !== undefined && (
                            <motion.div 
                              initial={{ scale: 0, x: -5, opacity: 0 }}
                              animate={{ scale: 0.5, x: -15, opacity: 1 }}
                              className="absolute top-0 right-0 p-1 rounded-full bg-slate-900 border border-red-500 shadow-2xl overflow-hidden"
                            >
                              <PowerCardVisual cardId={devilStolen[uid]} small />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>

                <AnimatePresence>
                  {summoned[uid] && (
                    <div className="origin-left scale-[0.72] sm:scale-[0.78]">
                      <CardVisual
                        card={summoned[uid]}
                        revealed
                        presentation="deckPull"
                        deckPullSide={idx === 0 ? 'right' : 'left'}
                        delay={0.14 + idx * 0.05}
                        lustHeartRulesActive={lustHeartResolution}
                      />
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-none w-full max-w-xl mt-6 flex flex-col items-center">
        <div className="min-h-[64px] flex flex-col items-center justify-center relative overflow-visible w-full">
          <AnimatePresence mode="wait">
            {(() => {
              const lastEcho = visibleEvents[visibleEvents.length - 1];
              if (!lastEcho || lastEcho.eventType !== 'COIN_FLIP') return null;
              return (
                <motion.div
                  key={lastEcho.id}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16, scale: 0.96 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="mb-2 flex w-full justify-center"
                >
                  <PriorityFlipCard winnerUid={lastEcho.coinWinnerUid ?? null} room={room} />
                </motion.div>
              );
            })()}
          </AnimatePresence>
          <AnimatePresence mode="popLayout">
            {visibleEvents.slice(-2).map((evt, i) => (
              <motion.div 
                key={evt.id} 
                initial={{ opacity: 0, y: 26, scale: 0.9, filter: 'blur(8px)' }}
                animate={{
                  opacity: i === 1 ? 1 : 0.38,
                  y: i === 1 ? 0 : -16,
                  scale: i === 1 ? 1.04 : 0.92,
                  filter: 'blur(0px)'
                }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                exit={{ opacity: 0, y: -30 }}
                className={`text-center font-black uppercase tracking-widest italic text-[10px] sm:text-sm ${i === 1 ? 'text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.35)]' : 'text-slate-500'}`}
              >
                {evt.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-4 flex flex-col items-center justify-center min-h-[60px]">
          <AnimatePresence>
            {isDone && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0, filter: "blur(8px)" }} 
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }} 
                className="flex flex-col items-center"
              >
                <span className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter italic drop-shadow-2xl ${
                  outcome.winnerUid === 'draw' ? 'text-purple-500' : 
                  (room.players[outcome.winnerUid].role === 'Preydator' ? 'text-purple-500' :
                   (room.players[outcome.winnerUid].role === 'Predator' ? 'text-red-500' : 'text-blue-400'))
                }`}>
                  {outcome.winnerUid === 'draw' ? 'STALEMATE' : `${room.players[outcome.winnerUid].name} WINS`}
                </span>
                <p className="text-white/60 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{outcome.message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const DraftingPhase: React.FC<{ 
  draftSets: number[][], 
  currentSetIdx: number, 
  onSelect: (powerId: number) => void,
  myPowerCards: number[] 
}> = ({ draftSets, currentSetIdx, onSelect, myPowerCards }) => {
  const currentSet = draftSets[currentSetIdx] || [];
  const hasSelectedThisTurn = myPowerCards.length > currentSetIdx;

  return (
    <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center p-4 bg-emerald-950/95 backdrop-blur-3xl overflow-y-auto">
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
          {currentSet.map(id => (
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

/** Opponent desperation capsule — napkin cell 7: top-center strip (under phase line), both seats. */
const OpponentDesperationTopStrip: React.FC<{ opponent: PlayerData; room: RoomData; className?: string }> = ({
  opponent,
  room,
  className = '',
}) => {
  if (!opponentDesperationUiRelevant(room, opponent)) return null;
  const oppLadderLabel =
    opponent.desperationTier >= 0
      ? desperationLadderLabel(room.settings.tiers, opponent.desperationTier)
      : null;
  return (
    <div
      className={`pointer-events-none z-[28] w-full max-w-full shrink-0 rounded-lg border border-purple-800/65 bg-purple-950/93 py-1.5 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12)] ${className}`}
    >
      <div className="flex w-full max-w-full items-start gap-1.5 px-2">
        <Skull
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-400 ${opponent.desperationSpinning ? 'animate-pulse' : ''}`}
        />
        <div className="min-w-0 flex-1 text-left leading-snug">
          <span className="block truncate text-[8px] font-black uppercase tracking-wider text-purple-200/95">
            {opponent.name} · desperation
          </span>
          {opponent.desperationSpinning ? (
            <span className="mt-0.5 block text-[9px] font-black uppercase tracking-wide text-emerald-300/95">
              Wheel spinning…
            </span>
          ) : opponent.desperationResult ? (
            <span
              className={`mt-0.5 block truncate text-[9px] font-black uppercase tracking-wide ${opponent.desperationResult === 'GAME OVER' ? 'text-red-400' : 'text-yellow-200/95'}`}
            >
              {opponent.desperationResult.replace('GAIN', 'DRAW')}
            </span>
          ) : oppLadderLabel ? (
            <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-wide text-white/95">
              {oppLadderLabel}
            </span>
          ) : (
            <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wide text-slate-500">
              Off ladder until first spin
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const OpposingHandOverlayStack: React.FC<{
  opponent: PlayerData;
  roomSettings: GameSettings;
  roomSnapshot: RoomData;
  roomStatus: RoomData['status'];
  powerShowdown: boolean;
  opponentPendingDecision: any;
  opponentWheelDecisionSpinning: boolean;
}> = ({
  opponent,
  roomSettings,
  roomSnapshot,
  roomStatus,
  powerShowdown,
  opponentPendingDecision,
  opponentWheelDecisionSpinning,
}) => {
  const oppTierRows = desperationTierRowsForDisplay(roomSettings);
  const showOppTierBanner = opponentDesperationUiRelevant(roomSnapshot, opponent);

  return (
    <>
      {!powerShowdown && roomStatus === 'powering' && opponentPendingDecision && (
        <OpponentDecisionStrip opponentName={opponent.name} decision={opponentPendingDecision} />
      )}

      {(opponent.desperationSpinning || opponent.desperationResult != null) && showOppTierBanner && (
        <DesperationWheel
          opposingHandOverlay
          allTierLabels={roomSettings.tiers}
          desperationTier={opponent.desperationTier}
          tierRows={oppTierRows}
          isSpectator
          isSpinning={opponent.desperationSpinning}
          offset={opponent.desperationOffset}
          result={opponent.desperationResult}
          onClose={() => {}}
          onResolve={() => {}}
          onSpin={() => {}}
        />
      )}

      {roomStatus === 'powering' && opponentWheelDecisionSpinning && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
          <div className="mb-2 rounded-xl border border-amber-500/45 bg-black/55 px-3 py-2 backdrop-blur-sm">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">
              Wheel spinning for {opponent.name}
            </span>
          </div>
          <div className="w-[min(11rem,78vw)] max-w-full shrink-0 sm:w-52">
            <FortuneWheelVisual
              spinning
              offset={opponentPendingDecision?.wheelOffset ?? 0}
              sizeClass="w-full"
            />
          </div>
        </div>
      )}
    </>
  );
};

interface GameInstanceProps {
  instanceId: string;
  isDual?: boolean;
}

/** Split local test — persist room JSON so toggling panels can resume the same Peer id + identities. */
function dualReconnectStorageKey(instanceId: string) {
  return `cc_dual_session_${instanceId}_v2`;
}

function wipeDualReconnectSnapshots() {
  try {
    sessionStorage.removeItem(dualReconnectStorageKey('p1'));
    sessionStorage.removeItem(dualReconnectStorageKey('p2'));
  } catch {
    /* quota / privacy mode */
  }
}

/** UI time to show “deck empty / dealing bones” before the full-screen FAMINE callout */
const FAMINE_BONE_DEAL_UI_MS = 6400;

type FamineBannerPhase = 'idle' | 'bone_deal' | 'famine_title';

const GameInstance: React.FC<GameInstanceProps> = ({ instanceId, isDual }) => {
  const serviceRef = useRef(new GameService());
  const [playerName, setPlayerName] = useState(isDual ? `Tester ${instanceId.slice(-1)}` : '');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<RoomData | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [selectedPowerCard, setSelectedPowerCard] = useState<number | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showDesperationWheel, setShowDesperationWheel] = useState(false);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const [isDevMenuOpen, setIsDevMenuOpen] = useState(false);
  const [showResolutionSequence, setShowResolutionSequence] = useState(false);
  const [seenIntel, setSeenIntel] = useState<PlayerData['secretIntel']>(null);
  const lastTurnRef = useRef(0);
  const cardSelectionTurnRef = useRef<number | null>(null);
  const myUid = serviceRef.current.getUid();
  const [famineBannerPhase, setFamineBannerPhase] = useState<FamineBannerPhase>('idle');
  const famineActivePrev = useRef(false);
  const dualSnapRef = useRef({ instanceId, isDual, playerName, roomId, room });
  dualSnapRef.current = { instanceId, isDual, playerName, roomId, room };
  const dualResumeStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      const svc = serviceRef.current;
      const snap = dualSnapRef.current;
      try {
        if (
          snap.isDual &&
          snap.roomId &&
          snap.room &&
          (snap.room.status !== 'waiting' || Object.keys(snap.room.players ?? {}).length > 1)
        ) {
          const st = svc.getState();
          if (st) {
            sessionStorage.setItem(
              dualReconnectStorageKey(snap.instanceId),
              JSON.stringify({
                savedAt: Date.now(),
                roomId: snap.roomId,
                myUid: svc.getUid(),
                playerName: snap.playerName,
                isHost: svc.getIsHost(),
                room: st,
              }),
            );
          }
        }
      } catch {
        /* ignore */
      }
      svc.destroy();
    };
  }, []);

  useEffect(() => {
    if (!isDual) {
      dualResumeStartedRef.current = false;
      return;
    }
    if (roomId) return;

    let alive = true;
    const raw = sessionStorage.getItem(dualReconnectStorageKey(instanceId));
    if (!raw || dualResumeStartedRef.current) return;

    let snap: {
      savedAt: number;
      roomId: string;
      myUid: string;
      playerName: string;
      isHost: boolean;
      room: RoomData;
    };
    try {
      snap = JSON.parse(raw) as typeof snap;
    } catch {
      return;
    }
    if (!snap?.room || !snap.roomId || !snap.myUid || !snap.playerName || typeof snap.isHost !== 'boolean') return;
    if (Date.now() - (snap.savedAt ?? 0) > 2 * 60 * 60 * 1000) {
      sessionStorage.removeItem(dualReconnectStorageKey(instanceId));
      return;
    }

    dualResumeStartedRef.current = true;
    void (async () => {
      try {
        if (!snap.isHost) {
          await new Promise((r) => setTimeout(r, 420));
        }
        if (!alive) return;
        if (snap.isHost) {
          await serviceRef.current.resumeDualHost(
            {
              roomId: snap.roomId,
              myUid: snap.myUid,
              room: snap.room,
              playerName: snap.playerName,
            },
            (st) => {
              if (alive) setRoom(st);
            },
          );
        } else {
          await serviceRef.current.resumeDualGuest(
            { roomId: snap.roomId, myUid: snap.myUid, playerName: snap.playerName },
            (st) => {
              if (alive) setRoom(st);
            },
          );
        }
        if (!alive) return;
        setRoomId(snap.roomId);
        if (!snap.isHost) setRoomCode(snap.roomId);
        setPlayerName(snap.playerName);
      } catch {
        dualResumeStartedRef.current = false;
        sessionStorage.removeItem(dualReconnectStorageKey(instanceId));
      }
    })();

    return () => {
      alive = false;
    };
  }, [instanceId, isDual, roomId]);

  useEffect(() => {
    if (!room) return;
    const on = Boolean(room.famineActive);
    if (!famineActivePrev.current && on) {
      setFamineBannerPhase('bone_deal');
      const tid = window.setTimeout(() => setFamineBannerPhase('famine_title'), FAMINE_BONE_DEAL_UI_MS);
      famineActivePrev.current = on;
      return () => window.clearTimeout(tid);
    }
    if (famineActivePrev.current && !on) {
      setFamineBannerPhase('idle');
    }
    famineActivePrev.current = on;
  }, [room?.famineActive]);

  useEffect(() => {
    if (!room || room.status !== 'playing') return;
    const mePlayer = room.players[myUid];
    if (!mePlayer) return;
    const turn = room.currentTurn;
    if (mePlayer.confirmed) {
      cardSelectionTurnRef.current = turn;
      return;
    }
    if (cardSelectionTurnRef.current !== turn) {
      cardSelectionTurnRef.current = turn;
      setSelectedCardIndex(null);
      return;
    }
    if (selectedCardIndex !== null) {
      const card = mePlayer.hand[selectedCardIndex];
      if (!card) {
        setSelectedCardIndex(null);
      } else if (prideBlocksCard(room, myUid, card)) {
        setSelectedCardIndex(null);
      }
    }
  }, [
    room,
    room?.currentTurn,
    room?.status,
    room?.players[myUid]?.confirmed,
    room?.prideCeilingCard,
    room?.activeCurses,
    selectedCardIndex,
    myUid,
  ]);

  useEffect(() => {
    const handleHashChange = () => {
      if (roomId) return; // Don't react to hash changes if already in a game
      const hash = window.location.hash.substring(1);
      if (hash && hash.length === 7) {
        setRoomCode(hash.toUpperCase());
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [roomId]);

  const [lastSeenIntelTurn, setLastSeenIntelTurn] = useState(-1);

  useEffect(() => {
    if (room?.status === 'playing' && lastTurnRef.current !== room.currentTurn) {
      setIsWheelSpinning(true);
      const timer = setTimeout(() => setIsWheelSpinning(false), 5000);
      lastTurnRef.current = room.currentTurn;
      return () => clearTimeout(timer);
    }
  }, [room?.currentTurn, room?.status]);

  const [lastResolvedTurn, setLastResolvedTurn] = useState(-1);

  useEffect(() => {
    if (room?.status === 'results' && room.currentTurn > lastResolvedTurn) {
        setShowResolutionSequence(true);
        setLastResolvedTurn(room.currentTurn);
    }
    if (room?.status === 'playing' && room.players[myUid]?.secretIntel && lastSeenIntelTurn !== room.currentTurn) {
       setSeenIntel(room.players[myUid].secretIntel);
       setLastSeenIntelTurn(room.currentTurn);
    }
  }, [room?.status, room?.players[myUid]?.secretIntel, room?.currentTurn, lastResolvedTurn]);

  const handleCreateRoom = async () => {
    if (!playerName) { setError('Please enter your name'); return; }
    setLoading(true);
    setError(null);
    wipeDualReconnectSnapshots();
    try {
      const id = await serviceRef.current.createRoom(playerName, (state) => {
        setRoom(state);
      });
      setRoomId(id);
      window.location.hash = id;
    } catch (err: any) {
      setError(`Failed to create: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName || !roomCode) { setError('Please enter name and code'); return; }
    setLoading(true);
    setError(null);
    wipeDualReconnectSnapshots();
    try {
      await serviceRef.current.joinRoom(roomCode, playerName, (state) => {
        setRoom(state);
      });
      setRoomId(roomCode);
      window.location.hash = roomCode;
    } catch (err: any) {
      setError(`Failed to join: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayCard = async () => {
    if (selectedCardIndex === null || !roomId || !room?.players[myUid]) return;
    setLoading(true);
    try {
      if (selectedPowerCard !== null) {
        await serviceRef.current.selectPowerCard(selectedPowerCard);
      }
      const selected = room.players[myUid].hand[selectedCardIndex];
      if (!selected) return;
      if (prideBlocksCard(room, myUid, selected)) return;
      await serviceRef.current.playCard(selected);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSelectedPowerCard(null);
      setLoading(false);
    }
  };

  const handleDraftSelect = async (powerId: number) => {
    setLoading(true);
    try {
      await serviceRef.current.selectDraftPowerCard(powerId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePowerCard = (powerId: number) => {
    if (
      room &&
      room.settings.enableCurseCards !== false &&
      curseEffectActive(room.activeCurses) &&
      isCurseCardId(powerId)
    ) {
      return;
    }
    if (selectedPowerCard === powerId) {
      setSelectedPowerCard(null);
      serviceRef.current.selectPowerCard(null);
    } else {
      setSelectedPowerCard(powerId);
      serviceRef.current.selectPowerCard(powerId);
    }
  };

  const handleNextRound = async () => {
    setLoading(true);
    try {
      await serviceRef.current.proceedToNextRound();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyUnicodeSummary = () => {
    if (!room?.lastOutcome) return;
    const { cardsPlayed, winnerUid, message, powerCardsPlayed } = room.lastOutcome;
    const uids = Object.keys(cardsPlayed);
    
    const formatCard = (cardId: string) => {
      const { suit, value, isJoker } = parseCard(cardId);
      const color = (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black';
      const unicode =
        CARD_UNICODE[cardId] ||
        (isJoker ? '🃏' : `[${CLIPBOARD_SUIT_TAG[suit] || suit}]`);
      const fullName = isJoker ? 'The Joker' : `${value} of ${suit}`;
      return `[color=${color}]${unicode}[/color][sub](${fullName})[/sub]`;
    };

    const summary = `
[b]🃏 PREDATOR VS PREY - ROUND RESULTS 🃏[/b]
------------------------------------
${message}
Winner: ${winnerUid === 'draw' ? 'DRAW' : room.players[winnerUid].name}

Moves:
${uids.map(uid => `${room.players[uid].name}: ${formatCard(cardsPlayed[uid])} ${powerCardsPlayed?.[uid] ? `(Power: ${powerCardsPlayed[uid]})` : ''}`).join('\n')}
------------------------------------
    `.trim();
    navigator.clipboard.writeText(summary);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000);
  };

  const isHost = roomId && room && room.hostUid === myUid;

  const handleUpdateSettings = (settings: GameSettings) => {
    serviceRef.current.syncSettings(settings);
  };

  const handleOpenDesperationWheel = () => {
    setShowDesperationWheel(true);
  };

  const handleSpinDesperation = async (_offset: number) => {
    try {
      await serviceRef.current.spinDesperation();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmitPowerDecision = async (option: string, wheelOffset?: number, priestessSwapToCard?: string | null) => {
    try {
      await serviceRef.current.submitPowerDecision(option, wheelOffset, priestessSwapToCard);
    } catch (err: any) {
      setError(err.message || String(err));
    }
  };

  const handleResolveDesperation = async () => {
    try {
      await serviceRef.current.resolveDesperation();
      setShowDesperationWheel(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStartGame = async () => {
    setLoading(true);
    try {
      await serviceRef.current.startGame();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!roomId) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xs w-full bg-emerald-900/50 border border-emerald-800 rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-black text-white uppercase tracking-tight">{isDual ? 'Guest Player' : 'Table Menu'}</h2>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Peer-to-peer table</p>
          </div>
          <div className="space-y-3">
            <input 
              type="text" 
              value={playerName} 
              onChange={(e) => setPlayerName(e.target.value)} 
              placeholder="Your Nickname..." 
              className="w-full bg-emerald-800/50 border-2 border-emerald-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-400" 
            />
            {!isDual && (
              <button 
                onClick={handleCreateRoom} 
                disabled={loading} 
                className="w-full bg-yellow-400 text-emerald-950 font-black py-2 rounded-lg text-sm uppercase flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : 'Host New Table'}
              </button>
            )}
            <div className="flex gap-2">
              <input 
                type="text" 
                value={roomCode} 
                onChange={(e) => setRoomCode(e.target.value)} 
                placeholder="Table Code..." 
                className="flex-1 bg-emerald-800/50 border-2 border-emerald-700 rounded-lg px-3 text-sm text-white uppercase" 
              />
              <button 
                onClick={handleJoinRoom} 
                disabled={loading} 
                className="bg-emerald-700 py-2 px-3 rounded-lg text-white font-bold text-sm"
              >
                {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Users className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <div className="text-[10px] text-red-400 animate-pulse bg-red-950/20 p-2 rounded border border-red-900/50">{error}</div>}
        </motion.div>
      </div>
    );
  }

  if (!room) return (
    <div className="h-full flex items-center justify-center text-emerald-400 text-[10px] font-mono animate-pulse">
      Connecting…
    </div>
  );

  if (room.status === 'waiting') {
    const lobbyGuestUid = Object.keys(room.players).find(uid => uid !== room.hostUid);
    const guestLobbyReady = !!(lobbyGuestUid && room.players[lobbyGuestUid]?.lobbyGuestReady);
    const preyLab = preySideLabel(room.settings.hostRole);
    const linkCode = roomId ?? room.code;

    const copyRoomId = () => {
      navigator.clipboard.writeText(linkCode);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    };

    const patchLobbySettings = (partial: Partial<GameSettings>) => {
      handleUpdateSettings(
        normalizeGameSettings({ ...room.settings, ...partial, lobbyPresetId: CUSTOM_LOBBY_PRESET_ID }),
      );
    };

    const applyBuiltinPreset = (presetId: string, partial?: Partial<GameSettings>) => {
      handleUpdateSettings(normalizeGameSettings({ ...(partial ?? {}), lobbyPresetId: presetId }));
    };

    const applySavedLobbyPreset = (entry: SavedLobbyPreset) => {
      handleUpdateSettings(
        normalizeGameSettings({ ...(entry.settings as Partial<GameSettings>), lobbyPresetId: entry.id }),
      );
    };

    return (
      <div className="flex h-full flex-col space-y-6 overflow-y-auto p-6">
        {isHost ? (
          <HostLobbyPanel
            room={room}
            tableCode={linkCode}
            preySideLabelShort={preyLab}
            loading={loading}
            guestLobbyReady={guestLobbyReady}
            showCopySuccess={showCopySuccess}
            onRoomIdCopy={copyRoomId}
            onPatchSettings={patchLobbySettings}
            onApplyPreset={applyBuiltinPreset}
            onApplySavedPreset={applySavedLobbyPreset}
            onStartGame={handleStartGame}
          />
        ) : (
          <div className="flex-1 space-y-6">
            {room.guestLobbyNotice && (
              <div className="rounded-xl border border-amber-500/60 bg-amber-950/50 px-4 py-4 text-center shadow-[0_0_28px_rgba(245,158,11,0.12)]">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-100">{room.guestLobbyNotice}</p>
                <p className="mt-2 text-[10px] font-bold uppercase leading-snug text-amber-400/90">
                  Settings changed — tap Ready below after you have re-read everything.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-emerald-800 bg-emerald-900/30 p-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">TABLE LINK</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl font-black text-white">{linkCode}</span>
                  <button type="button" onClick={copyRoomId} className="p-1 text-yellow-400">
                    {showCopySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">STATUS</span>
                <div className="animate-pulse text-xs font-black uppercase text-emerald-400">
                  {Object.keys(room.players).length < 2
                    ? 'WAITING FOR PLAYER 2'
                    : guestLobbyReady
                      ? 'YOU ARE READY'
                      : 'CHECK SETTINGS & READY UP'}
                </div>
              </div>
            </div>

            <GuestLobbyPanel
              room={room}
              preyLab={preyLab}
              guestLobbyReady={guestLobbyReady}
              onToggleReady={() => void serviceRef.current.setLobbyReady(!guestLobbyReady)}
            />
            <p className="px-2 text-center text-[9px] font-bold uppercase tracking-tight text-emerald-600">
              Ready tells the host you have reviewed the rules above. Changing host settings clears Ready.
            </p>
          </div>
        )}
      </div>
    );
  }

  const me = room.players[myUid];
  if (!me) return <div className="h-full flex items-center justify-center text-[10px] uppercase">DESYNCED</div>;
  
  const opponentUid = Object.keys(room.players).find(uid => uid !== myUid);
  const opponent = opponentUid ? room.players[opponentUid] : null;
  const myPendingDecision = room.pendingPowerDecisions?.[myUid] || null;
  const opponentPendingDecision = opponentUid ? room.pendingPowerDecisions?.[opponentUid] || null : null;
  const powerShowdown = room.status === 'powering' && room.awaitingPowerShowdown === true;
  const myWheelDecisionSpinning =
    myPendingDecision?.powerCardId === 10 && myPendingDecision.selectedOption === 'SPIN_WHEEL';
  const opponentWheelDecisionSpinning =
    opponentPendingDecision?.powerCardId === 10 && opponentPendingDecision.selectedOption === 'SPIN_WHEEL';

  const lustHeartUi =
    room.settings.enableCurseCards &&
    (lustCurseActive(room.activeCurses ?? []) ||
      (room.status === 'powering' &&
        (me.currentPowerCard === CURSE_LUST || opponent?.currentPowerCard === CURSE_LUST)));

  const lustTripleWheel =
    room.settings.enableCurseCards && lustCurseActive(room.activeCurses ?? []);
  const greedHalveWheel =
    room.settings.enableCurseCards && greedCurseActive(room.activeCurses ?? []);
  const greedJointTrumpUi =
    room.settings.enableCurseCards &&
    greedCurseActive(room.activeCurses ?? []) &&
    room.targetSuit === 'Diamonds';
  const slothDreamTableOverlay =
    room.settings.enableCurseCards && slothCurseActive(room.activeCurses ?? []);
  const curseSelectionLocked =
    room.settings.enableCurseCards !== false && curseEffectActive(room.activeCurses);

  const hudPhaseLine =
    room.status === 'powering'
      ? powerShowdown
        ? 'Cards locked — choose power effects'
        : 'Resolving power cards…'
      : null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden border-x border-emerald-900/50 bg-emerald-950/40 p-4">
      {room.famineActive && famineBannerPhase === 'bone_deal' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[241] bg-stone-900/95 border border-stone-500 px-5 py-2 rounded-full shadow-lg max-w-[min(94vw,32rem)]">
          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-stone-100 text-center block">
            Deck empty · dealing bone cards to even hands
          </span>
        </div>
      )}
      {room.famineActive && famineBannerPhase === 'famine_title' && (
        <>
          <div
            className="pointer-events-none absolute inset-0 z-[233] bg-[radial-gradient(ellipse_95%_75%_at_50%_50%,rgba(120,53,15,0.10)_0%,rgba(120,53,15,0.16)_44%,rgba(41,37,36,0.52)_72%,rgba(12,10,9,0.82)_100%)]"
            aria-hidden
          />
          <div className="pointer-events-none absolute top-8 sm:top-10 left-1/2 -translate-x-1/2 z-[239] text-center">
            <span className="block text-[clamp(2.5rem,10vw,5.5rem)] font-black uppercase tracking-[0.12em] text-amber-950 drop-shadow-[0_4px_0_rgba(254,243,199,0.25),0_0_40px_rgba(251,191,36,0.35)]">
              FAMINE
            </span>
            <span className="mt-2 block text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.35em] text-amber-100/80">
              The draw pile is gone — bones only
            </span>
          </div>
        </>
      )}
      <DesperationVignette
        tier={me.desperationTier}
        totalTiers={effectiveActiveDesperationTierCount(room.settings)}
      />

      {!powerShowdown && room.status === 'powering' && myPendingDecision && myPendingDecision.selectedOption === null && (
        <PowerDecisionModal
          compactPane={Boolean(isDual)}
          decision={myPendingDecision}
          priestessLockedCard={myPendingDecision.powerCardId === 2 ? (room.engageMoves?.[myUid] ?? me.currentMove ?? null) : null}
          priestessHand={myPendingDecision.powerCardId === 2 ? me.hand : []}
          tableSuit={room.targetSuit ?? null}
          onSubmit={handleSubmitPowerDecision}
        />
      )}

      {opponent && <RoomChat room={room} myUid={myUid} serviceRef={serviceRef} />}

      {isDevMenuOpen && (
        <DevPowerMenu 
          onSelect={(id) => serviceRef.current.cheatPowerCard(id)} 
          onClose={() => setIsDevMenuOpen(false)}
          curseControlsEnabled={Boolean(
            room.settings.enableCurseCards !== false &&
              (room.status === 'playing' || room.status === 'powering' || room.status === 'results'),
          )}
          onActivateCurseOnTable={(id: number) => void serviceRef.current.cheatActivateCurseOnTable(id)}
          onClearActiveCurses={() => void serviceRef.current.cheatClearActiveCursesOnTable()}
          {...(room.status === 'playing' || room.status === 'powering' || room.status === 'results'
            ? {
                deckCount: room.deck.length,
                handCards: me.hand,
                onTrimDeck: (n: number) => serviceRef.current.cheatTrimDeck(n),
                onDiscardHandCard: (cid: string) => serviceRef.current.cheatDiscardFromHand(cid),
              }
            : {})}
        />
      )}

      {room.status === 'drafting' && room.draftSets && (
        <DraftingPhase 
          draftSets={room.draftSets} 
          currentSetIdx={room.draftTurn} 
          onSelect={handleDraftSelect}
          myPowerCards={me.powerCards}
        />
      )}

      {(showDesperationWheel || me.desperationSpinning || me.desperationResult) && !room.winner && (
        <DesperationWheel
          onSpin={handleSpinDesperation}
          onClose={() => setShowDesperationWheel(false)}
          onResolve={handleResolveDesperation}
          isSpinning={me.desperationSpinning}
          result={me.desperationResult}
          offset={me.desperationOffset}
          tierRows={desperationTierRowsForDisplay(room.settings)}
          allTierLabels={room.settings.tiers}
          desperationTier={me.desperationTier}
        />
      )}

      {/* Opponent desperation strip: top HUD center (napkin div7). */}
      {/* HUD: room / role · phase strip (center) · dev & rules */}
      <div className="mb-3 grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-1">
        <div className="min-w-0 justify-self-start">
          <div className="flex items-center gap-2">
            <span className="truncate text-[8px] font-bold uppercase text-emerald-500">{roomId}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(roomId);
                setShowCopySuccess(true);
                setTimeout(() => setShowCopySuccess(false), 2000);
              }}
              className="shrink-0 text-emerald-700 hover:text-yellow-400"
            >
              {showCopySuccess ? <Check className="h-2 w-2" /> : <Copy className="h-2 w-2" />}
            </button>
          </div>
          <span className="text-[10px] font-black italic uppercase leading-none sm:text-xs">{me.role}</span>
        </div>
        <div className="min-w-0 max-w-[min(22rem,calc(100vw-11rem))] justify-self-center text-center px-1">
          {hudPhaseLine && (
            <span className="block truncate text-[9px] font-black uppercase tracking-wider text-yellow-400/95 sm:text-[10px]">
              {hudPhaseLine}
            </span>
          )}
          {(room.status === 'playing' || room.status === 'powering') &&
            room.famineActive &&
            !hudPhaseLine && (
              <span className="block truncate text-[8px] font-black uppercase tracking-wider text-amber-200/85">
                Famine — bones replace draws
              </span>
            )}
          {(room.status === 'playing' || room.status === 'powering') &&
            opponent &&
            room.settings.enableDesperation &&
            opponentDesperationUiRelevant(room, opponent) && (
              <div className="mt-1 flex w-full justify-center">
                <OpponentDesperationTopStrip
                  opponent={opponent}
                  room={room}
                  className="max-w-[min(100%,20rem)]"
                />
              </div>
            )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2 justify-self-end sm:gap-4">
          <button
            type="button"
            onClick={() => setIsDevMenuOpen(true)}
            className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-800 bg-emerald-900/40 p-1.5 text-[9px] font-black uppercase text-emerald-600 transition-all hover:border-yellow-500 hover:bg-yellow-400 hover:text-emerald-950 sm:p-2 sm:text-[10px]"
          >
            <Sparkles className="h-3 w-3 group-hover:rotate-12" /> Dev
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-yellow-400/40 bg-yellow-400/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-yellow-400 transition-all hover:bg-yellow-400 hover:text-emerald-950 sm:px-4 sm:py-2 sm:text-[10px]"
          >
            <Info className="h-4 w-4 shrink-0" /> Rules
          </button>
          <div className="flex shrink-0 items-center gap-1">
            {opponent?.confirmed && <Check className="h-3 w-3 shrink-0 animate-bounce text-yellow-400" />}
            <span className="truncate text-[10px] font-bold uppercase text-emerald-500">{opponent?.name || '...'}</span>
          </div>
        </div>
      </div>

      {(room.status === 'playing' || room.status === 'powering') && isWheelSpinning && (
        <div className="pointer-events-none w-full shrink-0 border-b border-amber-800/40 bg-emerald-950/90 py-2 text-center shadow-[inset_0_-1px_0_rgba(251,191,36,0.12)]">
          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300 sm:text-[11px]">
            Drawing this round&apos;s table suit…
          </span>
        </div>
      )}

      {seenIntel && (
        <InsightModal 
          intel={seenIntel} 
          onClose={() => setSeenIntel(null)} 
        />
      )}

      {/* Opponent strip when not at the active table grid (draft / brief transitions) */}
      {opponent && !(room.status === 'playing' || room.status === 'powering') && (
        <div
          className={`relative mb-3 px-1 ${
            room.settings.enableDesperation || opponentWheelDecisionSpinning ? 'min-h-[11.5rem]' : ''
          } ${opponentWheelDecisionSpinning ? 'min-h-[17rem] sm:min-h-[18.5rem]' : ''}`}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="flex-1 text-center text-[10px] font-black uppercase tracking-widest text-emerald-500">
              Cards: {opponent.hand.length}
            </span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex h-28 items-center justify-center -space-x-8 overflow-x-auto px-2 opacity-80 flex-nowrap sm:-space-x-12 sm:scale-100 scale-90">
                {Array.from({ length: opponent.hand.length }).map((_, i) => (
                  <CardVisual key={`opp-${i}`} card="" revealed={false} disabled role={opponent.role} delay={i * 0.08} />
                ))}
              </div>
              <OpposingHandOverlayStack
                opponent={opponent}
                roomSettings={room.settings}
                roomSnapshot={room}
                roomStatus={room.status}
                powerShowdown={powerShowdown}
                opponentPendingDecision={opponentPendingDecision}
                opponentWheelDecisionSpinning={opponentWheelDecisionSpinning}
              />
            </div>
            <div className="flex max-w-full shrink-0 flex-row flex-wrap items-end justify-end gap-x-4 gap-y-2 overflow-visible py-1 pr-1 opacity-80 sm:flex-nowrap sm:gap-x-5">
              {opponent.powerCards.map((pid, i) => (
                <PowerCardVisual key={`opp-p-${pid}-${i}`} cardId={pid} revealed={false} small staticBackdrop />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table grid: opp row · deck column share one rail — no overlapping absolutes */}
      <div className="relative flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
          {myWheelDecisionSpinning && (
            <div className="pointer-events-none absolute inset-0 z-[130] flex flex-col items-center justify-center gap-3 bg-black/45 px-2 backdrop-blur-[2px]">
              <span className="text-center text-[9px] font-black uppercase tracking-widest text-amber-300">
                Wheel spinning for {me.name}
              </span>
              <div className="w-[min(14rem,80vw)] max-w-full shrink-0">
                <FortuneWheelVisual
                  spinning
                  offset={myPendingDecision?.wheelOffset ?? 0}
                  sizeClass="w-full"
                />
              </div>
            </div>
          )}

          {(room.status === 'playing' || room.status === 'powering') && opponent ? (
            <div className="grid min-h-0 w-full max-w-full flex-1 grid-cols-[minmax(5rem,7rem)_minmax(0,1fr)_minmax(5rem,7rem)] grid-rows-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 px-1 transition-all duration-500 sm:gap-x-3 md:gap-y-1.5">
              {/* Row 1 napkin sketch: spacer | opp hand | opp powers — deck stacks row2 col3 */}
              <div className="hidden min-h-[0.125rem] sm:col-start-1 sm:row-start-1 sm:block" aria-hidden />
              <div
                className={`relative col-span-full min-h-0 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1 ${
                  opponentWheelDecisionSpinning ? 'min-h-[10rem] sm:min-h-[12rem]' : 'min-h-[5.75rem] sm:min-h-[6.5rem]'
                }`}
              >
                <div className="mb-1 text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    Cards: {opponent.hand.length}
                  </span>
                </div>
                <div className="flex h-24 flex-nowrap items-center justify-center -space-x-7 px-3 opacity-[0.82] sm:h-28 sm:-space-x-10 sm:px-4 sm:opacity-95">
                  {Array.from({ length: opponent.hand.length }).map((_, i) => (
                    <CardVisual key={`og-${i}`} card="" revealed={false} disabled role={opponent.role} delay={i * 0.08} />
                  ))}
                </div>
                <OpposingHandOverlayStack
                  opponent={opponent}
                  roomSettings={room.settings}
                  roomSnapshot={room}
                  roomStatus={room.status}
                  powerShowdown={powerShowdown}
                  opponentPendingDecision={opponentPendingDecision}
                  opponentWheelDecisionSpinning={opponentWheelDecisionSpinning}
                />
              </div>
              <div className="col-span-full flex min-h-[3.5rem] flex-row flex-wrap justify-center gap-x-4 gap-y-2 self-start overflow-visible py-2 pt-3 opacity-95 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:w-full sm:max-w-none sm:flex-nowrap sm:justify-end sm:gap-x-5 sm:self-stretch sm:px-1 sm:pb-1 sm:pt-3">
                {opponent.powerCards.map((pid, i) => (
                  <PowerCardVisual key={`ogr-${pid}-${i}`} cardId={pid} revealed={false} small staticBackdrop />
                ))}
              </div>

              <aside className="relative z-[6] col-span-full flex min-h-0 w-full min-w-0 flex-col items-center gap-2 overflow-hidden pb-1 sm:col-span-1 sm:col-start-1 sm:row-start-2 sm:w-auto sm:max-w-[min(11rem,calc((100vw-2rem)*0.28))] sm:self-stretch sm:pb-2">
                <div className="flex max-h-[min(32vh,12.75rem)] w-full shrink-0 flex-col items-center overflow-y-auto overflow-x-hidden pb-1 [-ms-overflow-style:auto] [scrollbar-gutter:stable]">
                  <CurseZonePanel
                    settings={room.settings}
                    activeCurses={room.activeCurses}
                    prideCeilingCard={room.prideCeilingCard}
                    wrathMinionCard={room.wrathMinionCard}
                    wrathTargetUid={room.wrathTargetUid}
                    hostUid={room.hostUid}
                    players={room.players}
                  />
                </div>
              </aside>

              <div
                className={`relative z-0 col-span-full flex min-h-0 min-w-0 flex-col items-center rounded-3xl px-1 pb-2 pt-1 sm:col-span-1 sm:col-start-2 sm:row-start-2 sm:px-3 ${
                  slothDreamTableOverlay
                    ? 'ring-2 ring-indigo-300/30 shadow-[0_0_48px_rgba(99,102,241,0.14)]'
                    : ''
                }`}
              >
                {slothDreamTableOverlay && (
                  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
                    <div className="absolute inset-0 bg-slate-950/20" />
                    <div className="absolute -left-[12%] top-[8%] h-[52%] w-[64%] rounded-full bg-slate-200/25 blur-3xl" />
                    <div className="absolute -right-[8%] top-[18%] h-[48%] w-[58%] rounded-full bg-indigo-200/20 blur-3xl" />
                    <div className="absolute left-[12%] -bottom-[6%] h-[55%] w-[78%] rounded-full bg-slate-300/18 blur-[2.5rem]" />
                    <div className="absolute inset-0 opacity-[0.14] bg-[radial-gradient(circle_at_center,#fff_1px,transparent_1.5px)] bg-[size:14px_14px]" />
                  </div>
                )}
                <div className="relative z-10 flex w-full min-w-0 flex-col items-center">
               {!(
                 room.status === 'powering' &&
                 me.currentMove &&
                 opponent?.currentMove
               ) && (
                 <span className="mb-2 max-w-[min(100%,22rem)] px-2 text-center text-[10px] font-black uppercase leading-tight tracking-[0.24em] text-yellow-400/95 sm:mb-3 sm:text-[11px] sm:tracking-[0.26em]">
                   {room.status === 'powering'
                     ? powerShowdown
                       ? 'Cards locked — choose power effects next'
                       : 'Resolving power cards…'
                     : isWheelSpinning
                       ? 'DRAWING THIS ROUND’S TABLE SUIT…'
                       : 'TABLE SUIT FOR THIS ROUND'}
                 </span>
               )}

               <AnimatePresence mode="wait">
                 {room.status === 'powering' && me.currentMove && opponent?.currentMove ? (
                   <motion.div
                     key="powering-cards"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="flex flex-col items-center gap-3"
                   >
                     {room.targetSuit && (
                       <CompactTableGlyphRow suit={room.targetSuit} greedJointTrump={greedJointTrumpUi} />
                     )}
                     <div className="flex items-center gap-8">
                       <div className="relative flex flex-col items-center gap-2 pt-8 sm:pt-10">
                         <span className="text-[9px] uppercase font-black text-emerald-400">{me.name}</span>
                         {room.settings.enableCurseCards &&
                           wrathCurseActive(room.activeCurses ?? []) &&
                           room.wrathTargetUid === myUid &&
                           room.wrathMinionCard && (
                             <motion.div
                               className="pointer-events-none absolute top-0 left-1/2 z-40 flex -translate-x-1/2 justify-center"
                               initial={{ y: -4, opacity: 1 }}
                               animate={{ y: [0, -8, 0] }}
                               transition={{ y: { repeat: Infinity, duration: 1.15, ease: 'easeInOut' } }}
                             >
                               <div className="origin-top scale-[0.52] opacity-95 drop-shadow-[0_0_20px_rgba(220,38,38,0.45)]">
                                 <CardVisual card={room.wrathMinionCard} revealed noAnimate presentation="none" small />
                               </div>
                             </motion.div>
                           )}
                         <CardVisual
                           card={me.currentMove}
                           revealed
                           lustHeartRulesActive={lustHeartUi}
                           envyCovetedGlow={Boolean(
                             room.settings.enableCurseCards &&
                               envyCurseActive(room.activeCurses ?? []) &&
                               room.envyCovet?.uid === myUid &&
                               room.envyCovet.cardId === me.currentMove,
                           )}
                         />
                         {powerShowdown && me.currentPowerCard !== null && (
                           <div className="relative -mt-1 flex flex-col items-center gap-0.5">
                             <PowerCardVisual cardId={0} small revealed={false} />
                             <span className="text-[6px] font-black uppercase tracking-widest text-slate-500">Power</span>
                           </div>
                         )}
                       </div>
                       <div className="relative flex flex-col items-center gap-2 pt-8 sm:pt-10">
                         <span className="text-[9px] uppercase font-black text-emerald-500">{opponent.name}</span>
                         {room.settings.enableCurseCards &&
                           wrathCurseActive(room.activeCurses ?? []) &&
                           room.wrathTargetUid === opponent?.uid &&
                           room.wrathMinionCard && (
                             <motion.div
                               className="pointer-events-none absolute top-0 left-1/2 z-40 flex -translate-x-1/2 justify-center"
                               initial={{ y: -4, opacity: 1 }}
                               animate={{ y: [0, -8, 0] }}
                               transition={{ y: { repeat: Infinity, duration: 1.15, ease: 'easeInOut' } }}
                             >
                               <div className="origin-top scale-[0.52] opacity-95 drop-shadow-[0_0_20px_rgba(220,38,38,0.45)]">
                                 <CardVisual card={room.wrathMinionCard} revealed noAnimate presentation="none" small />
                               </div>
                             </motion.div>
                           )}
                         <CardVisual
                           card={opponent.currentMove}
                           revealed
                           lustHeartRulesActive={lustHeartUi}
                           envyCovetedGlow={Boolean(
                             room.settings.enableCurseCards &&
                               envyCurseActive(room.activeCurses ?? []) &&
                               room.envyCovet?.uid === opponent.uid &&
                               room.envyCovet.cardId === opponent.currentMove,
                           )}
                         />
                         {powerShowdown && opponent.currentPowerCard !== null && (
                           <div className="relative -mt-1 flex flex-col items-center gap-0.5">
                             <PowerCardVisual cardId={0} small revealed={false} />
                             <span className="text-[6px] font-black uppercase tracking-widest text-slate-500">Power</span>
                           </div>
                         )}
                       </div>
                     </div>
                   </motion.div>
                 ) : isWheelSpinning ? (
                   <motion.div
                     key="wheel"
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 1.2 }}
                   >
                     <TargetSuitWheel
                       suit={room.status === 'results' ? (room.lastOutcome?.targetSuit || room.targetSuit) : room.targetSuit}
                       isSpinning={isWheelSpinning}
                       offset={room.wheelOffset}
                       availableSuits={room.availableSuits}
                       lustTripleHearts={lustTripleWheel}
                       greedHalveBasicSuits={greedHalveWheel}
                     />
                   </motion.div>
                 ) : (
                   <motion.div
                     key="target-card"
                     initial={{ opacity: 0, rotateY: 90 }}
                     animate={{ opacity: 1, rotateY: 0 }}
                     className="flex flex-col items-center gap-3"
                   >
                     <div
                       className={`
                         relative flex h-[9.75rem] w-[6.75rem] flex-col items-center justify-center rounded-2xl border-4 border-yellow-200 bg-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.28)]
                         sm:h-[11.75rem] sm:w-[8.125rem]
                       `}
                     >
                       <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[size:10px_10px] opacity-10" />
                       </div>
                       {(() => {
                         const ts = (room.status === 'results'
                           ? room.lastOutcome?.targetSuit || room.targetSuit
                           : room.targetSuit) as Suit | null;
                         const color = ts ? SUIT_COLORS[ts] : '';
                         const joint =
                           ts === 'Diamonds' &&
                           room.settings.enableCurseCards &&
                           greedCurseActive(room.activeCurses ?? []);
                         return ts ? (
                           <div
                             className={`relative z-10 flex items-center justify-center gap-2 sm:gap-3 ${color} drop-shadow-[0_6px_22px_rgba(0,0,0,0.35)]`}
                           >
                             {joint ? (
                               <>
                                 <SuitGlyph suit="Diamonds" className="h-[3.25rem] w-[3.25rem] sm:h-[5rem] sm:w-[5rem]" />
                                 <SuitGlyph suit="Coins" className="h-[3.25rem] w-[3.25rem] sm:h-[5rem] sm:w-[5rem]" />
                               </>
                             ) : (
                               <SuitGlyph suit={ts} className="h-[4.75rem] w-[4.75rem] sm:h-[7.25rem] sm:w-[7.25rem]" />
                             )}
                           </div>
                         ) : (
                           <span className="relative z-10 text-5xl font-black text-yellow-950">?</span>
                         );
                       })()}
                     </div>
                     <span
                       className={`pointer-events-none text-center text-[11px] font-black uppercase tracking-[0.12em] sm:text-xs ${room.targetSuit ? SUIT_COLORS[room.targetSuit] : ''} opacity-[0.82]`}
                     >
                       {room.targetSuit === 'Diamonds' &&
                       room.settings.enableCurseCards &&
                       greedCurseActive(room.activeCurses ?? [])
                         ? 'Diamonds / Coins'
                         : room.targetSuit ?? ''}
                     </span>
                   </motion.div>
                 )}
               </AnimatePresence>
               {room.tyrantCrownPending != null && room.settings.enableCurseCards && (
                 <TyrantCrownTablePiece crownTotal={room.tyrantCrownPending.crownTotal} />
               )}
                </div>
              </div>

              <aside className="relative z-0 hidden min-h-0 w-full min-w-0 flex-col items-center justify-between gap-2 pt-1 sm:col-span-1 sm:col-start-3 sm:row-start-2 sm:flex sm:max-w-[min(7.5rem,calc((100vw-2rem)*0.2))] sm:pt-2">
                <div className="relative group shrink-0">
                  <div className="relative h-28 w-20">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute inset-0 rounded-lg border-2 border-purple-600/50 bg-purple-950 shadow-2xl"
                        style={{ transform: `translate(${-i * 2}px, ${-i * 2}px)` }}
                      >
                        <div className="flex h-full w-full flex-col items-center justify-center p-3 opacity-20">
                          <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                            <WolfIcon />
                            <Rabbit className="h-8 w-8 text-purple-400" />
                          </div>
                        </div>
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,#ffffff_1px,transparent_1px)] bg-[length:10px_10px] opacity-10" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-col items-center">
                    <div className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">
                      {room.deck.length}
                    </div>
                    <div className="text-[8px] font-bold uppercase tracking-widest text-emerald-800">REMAINING</div>
                  </div>
                </div>
              </aside>
            </div>
          ) : null}
      </div>

      {room.status === 'results' && room.lastOutcome && (
        <motion.div 
          key="results-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/98 z-[300] flex flex-col items-center justify-start overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {showResolutionSequence ? (
              <motion.div
                key="sequence"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.8 }}
                className="w-full h-full"
              >
                <ResolutionSequence 
                  room={room} 
                  myUid={myUid} 
                  onComplete={() => setShowResolutionSequence(false)} 
                />
              </motion.div>
            ) : (
              <motion.div 
                key="static-results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 sm:gap-6 py-12 px-4 w-full h-full justify-center max-w-4xl mx-auto overflow-y-auto relative"
              >
                {/* Captured Assets Section */}
                {room.lastOutcome.gains && (
                  <>
                    <AcquiredAssets
                      gains={room.lastOutcome.gains[room.hostUid] || []}
                      side="left"
                      label={room.players[room.hostUid].name}
                      acquisitionPace={famineBannerPhase === 'bone_deal' ? 'deliberate' : 'normal'}
                    />
                    <AcquiredAssets
                      gains={
                        room.lastOutcome.gains[Object.keys(room.players).find((id) => id !== room.hostUid)!] || []
                      }
                      side="right"
                      label={room.players[Object.keys(room.players).find((id) => id !== room.hostUid)!].name}
                      acquisitionPace={famineBannerPhase === 'bone_deal' ? 'deliberate' : 'normal'}
                    />
                  </>
                )}

                <div className="flex flex-col items-center mb-2">
                  <span className="text-[8px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-1">Round Result</span>
                  <h2 className={`text-4xl sm:text-7xl font-black uppercase italic tracking-tighter text-center leading-none ${
                    room.lastOutcome.winnerUid === 'draw' ? 'text-purple-500' : 
                    (room.players[room.lastOutcome.winnerUid].role === 'Preydator' ? 'text-purple-500' :
                     (room.players[room.lastOutcome.winnerUid].role === 'Predator' ? 'text-red-500' : 'text-blue-400'))
                  }`}>
                    {room.lastOutcome.winnerUid === 'draw' ? 'STALEMATE' : `${room.players[room.lastOutcome.winnerUid].name} WINS`}
                  </h2>
                </div>

                <div className="flex items-center justify-center gap-6 sm:gap-16 w-full py-4">
                  {[room.hostUid, Object.keys(room.players).find(id => id !== room.hostUid)!].map(uid => (
                    <div key={uid} className="flex flex-col items-center gap-3 relative scale-90 sm:scale-100">
                      <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest bg-slate-900 border border-slate-700 mb-1 ${room.players[uid].role === 'Predator' ? 'text-red-400' : (room.players[uid].role === 'Preydator' ? 'text-purple-400' : 'text-blue-400')}`}>
                        {room.players[uid].name}
                      </div>
                      {room.lastOutcome?.wrathFx && room.lastOutcome.wrathFx.targetUid === uid && (
                        <motion.div
                          className="pointer-events-none absolute top-10 left-1/2 z-40 flex w-[10rem] -translate-x-1/2 justify-center sm:w-[11rem]"
                          initial={{ y: -6, opacity: 1 }}
                          animate={{ y: [0, -10, 0], opacity: 1 }}
                          transition={{
                            y: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' },
                          }}
                        >
                          <div className="origin-top scale-[0.62] drop-shadow-[0_0_28px_rgba(220,38,38,0.5)] sm:scale-[0.68]">
                            <CardVisual
                              card={room.lastOutcome.wrathFx.minionCard}
                              revealed
                              noAnimate
                              presentation="none"
                              small
                            />
                          </div>
                        </motion.div>
                      )}
                      <CardVisual
                        card={room.lastOutcome!.cardsPlayed[uid]}
                        revealed
                        presentation="none"
                        noAnimate
                        clashGhost={Boolean(room.lastOutcome.clashDestroyedByPenalty?.[uid])}
                      />
                      <div className="flex gap-1 h-6">
                         {room.lastOutcome?.powerCardIdsPlayed[uid] !== null && (
                           <div className="scale-75 origin-top group relative">
                             <PowerCardVisual
                               cardId={room.lastOutcome!.powerCardIdsPlayed[uid]!}
                               small
                               destroyed={Boolean(room.lastOutcome.powerCardTowerBlocked?.[uid])}
                             />
                           </div>
                         )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-6 w-full max-w-md">
                   <div className="h-px w-full bg-linear-to-r from-transparent via-slate-800 to-transparent" />
                   
                   <p className="text-white text-base sm:text-xl font-black italic text-center tracking-tight leading-snug">
                     {room.lastOutcome.message}
                   </p>

                   {/* Event Log Display */}
                   <div className="w-full flex flex-col gap-1.5 p-4 rounded-2xl bg-black/40 border border-white/5 max-h-[150px] overflow-y-auto custom-scrollbar">
                     {room.lastOutcome.events.map((evt: any, i: number) => (
                       <div key={i} className="flex gap-2 text-[9px] uppercase tracking-wider font-bold">
                         <span className="text-slate-600 font-mono">{(i+1).toString().padStart(2, '0')}</span>
                         <span
                           className={
                             evt.type === 'POWER_TRIGGER'
                               ? 'text-yellow-400'
                               : evt.type === 'POWER_DESTROYED'
                                 ? 'text-orange-400'
                                 : evt.type === 'COIN_FLIP'
                                   ? 'text-amber-300'
                                   : evt.type === 'CLASH_DESTROYED'
                                     ? 'text-rose-400'
                                     : evt.type === 'ENVY_COVET' ||
                                         evt.type === 'ENVY_STRIKE' ||
                                         evt.type === 'ENVY_DEFEATED' ||
                                         evt.type === 'ENVY_DEPARTS'
                                       ? 'text-emerald-400'
                                       : 'text-slate-400'
                           }
                         >
                           {evt.message}
                         </span>
                       </div>
                     ))}
                   </div>
                   
                   <button 
                    onClick={handleNextRound}
                    disabled={loading || me.readyForNextRound}
                    className="group relative bg-yellow-400 text-black px-16 sm:px-24 py-4 sm:py-5 rounded-full font-black uppercase text-sm sm:text-base shadow-[0_0_50px_rgba(250,204,21,0.2)] hover:shadow-[0_0_80px_rgba(250,204,21,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer mt-2"
                   >
                     <span className="relative z-10">{me.readyForNextRound ? 'WAITING FOR OTHER...' : 'READY FOR NEXT ROUND'}</span>
                     <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity rounded-full" />
                   </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Bottom strip: hand & powers · desperation capsule last (napkin div9 under cards) */}
      <div className="mt-auto shrink-0 px-4 pb-4">
        <div className="mb-2 flex items-end justify-between">
           <div className="flex flex-col">
              <span className="text-[10px] font-bold opacity-50 uppercase tracking-tighter">Cards: {me.hand.length}</span>
           </div>
           
           <div className="flex items-center gap-3">
             {me.hand.length === 1 &&
               desperationSpinAllowed(room, myUid, me) &&
               !me.confirmed &&
               me.desperationTier < room.settings.tiers.length && (
                <motion.div 
                  initial={{ scale: 0, y: 50, x: '-50%' }}
                  animate={{ scale: 1, y: 0, x: '-50%' }}
                  className="absolute left-1/2 bottom-64 z-[50]"
                >
                  <button 
                    onClick={handleOpenDesperationWheel}
                    className="bg-purple-900 border-2 border-purple-500 text-white px-10 py-6 rounded-3xl text-sm font-black uppercase flex flex-col items-center gap-3 hover:bg-purple-600 transition-all shadow-[0_0_60px_rgba(168,85,247,0.5)] hover:scale-110 active:scale-95 group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent group-hover:from-purple-500/40 transition-all" />
                    <Skull className="w-8 h-8 relative z-10 animate-pulse" /> 
                    <span className="relative z-10">Last-chance desperation spin</span>
                    <span className="text-[10px] opacity-60 relative z-10">
                      {desperationLadderLabel(
                        room.settings.tiers,
                        me.desperationTier < 0 ? 1 : me.desperationTier + 1,
                      ) ?? 'Next rung'}
                    </span>
                  </button>
                </motion.div>
             )}
             {selectedCardIndex !== null && !me.confirmed && (
               <button
                 onClick={handlePlayCard}
                 disabled={
                   loading ||
                   (me.hand[selectedCardIndex] != null &&
                     (prideBlocksCard(room, myUid, me.hand[selectedCardIndex]) ||
                       envySealBlocksHandIndex(room, myUid, me.hand, selectedCardIndex)))
                 }
                 className="bg-yellow-400 text-emerald-950 px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-yellow-400/20 active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
               >
                 Play card
               </button>
             )}
             {me.confirmed && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Locked in — waiting</span>}
           </div>
        </div>
        <div
          className={`flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center xl:flex-nowrap ${
            (room.status === 'playing' || room.status === 'powering') && me.powerCards.length
              ? 'sm:gap-x-0 sm:gap-y-1 md:justify-between lg:justify-center xl:justify-center xl:gap-2'
              : ''
          }`}
        >
          {(room.status === 'playing' || room.status === 'powering') && me.powerCards.length > 0 && (
            <div className="relative z-[14] flex w-full shrink-0 flex-col items-center sm:max-w-[min(46vw,22rem)] sm:items-start md:-mr-3 xl:mr-0">
              <span className="mb-1 w-full text-center text-[8px] font-black uppercase tracking-wider text-emerald-500/90 sm:text-left">
                Your powers
              </span>
              <div className="flex w-full max-w-full flex-nowrap items-end justify-center overflow-x-auto overflow-y-visible pb-1 -space-x-4 pl-1 [scrollbar-width:thin] sm:justify-start sm:-space-x-6 sm:pl-2">
                {me.powerCards.map((pId, i) => (
                  <div key={`bottom-pow-${pId}-${i}`} className="relative shrink-0" style={{ zIndex: 8 + i }}>
                    <PowerCardVisual
                      cardId={pId}
                      matchHandCard
                      selected={selectedPowerCard === pId}
                      onClick={() => !me.confirmed && handleTogglePowerCard(pId)}
                      disabled={me.confirmed || (curseSelectionLocked && isCurseCardId(pId))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div
            className={`relative z-[12] flex min-h-[11rem] min-w-0 flex-1 flex-col justify-end sm:min-h-0 xl:flex-initial ${
              (room.status === 'playing' || room.status === 'powering') && me.powerCards.length ? 'xl:max-w-max' : ''
            }`}
          >
            <div
              className={`flex h-44 items-end justify-center -space-x-8 flex-nowrap transition-[filter,opacity] duration-300 sm:-space-x-12 ${
                me.confirmed ? 'saturate-[0.68] brightness-95 opacity-[0.92]' : ''
              }`}
            >
              {me.hand.map((card, i) => {
                const selected = selectedCardIndex === i;
                const prideMuted = prideBlocksCard(room, myUid, card);
                const envyMuted = envySealBlocksHandIndex(room, myUid, me.hand, i);
                const envyCovetedHere = Boolean(
                  room.settings.enableCurseCards &&
                    envyCurseActive(room.activeCurses ?? []) &&
                    room.envyCovet?.uid === myUid &&
                    room.envyCovet.handIndex === i &&
                    room.envyCovet.cardId === card,
                );
                const detailTooltip = prideMuted
                  ? PRIDE_WOUND_TOOLTIP
                  : envyMuted
                    ? ENVY_SEALED_TOOLTIP
                    : envyCovetedHere
                      ? ENVY_COVET_CARD_TOOLTIP
                      : card === GROVEL_CARD_ID
                        ? GROVEL_FEED_TOOLTIP
                        : undefined;
                const combinedMuted = prideMuted || envyMuted;
                return (
                  <motion.div
                    key={`${card}-${i}`}
                    animate={selected ? { y: -26, scale: 1.04 } : { y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 310, damping: 24 }}
                    className="relative"
                  >
                    {envyCovetedHere && (
                      <div
                        className="pointer-events-none absolute -top-11 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center"
                        title={ENVY_COVET_CARD_TOOLTIP}
                      >
                        <GreenEyedMonsterIcon className="h-9 w-[4.25rem] text-emerald-400 drop-shadow-[0_0_14px_rgba(16,185,129,0.5)]" />
                      </div>
                    )}
                    {selected && !me.confirmed && (
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-widest text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.65)]">
                        choosing
                      </span>
                    )}
                    {selected && me.confirmed && (
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-widest text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.55)]">
                        committed
                      </span>
                    )}
                    <CardVisual
                      card={card}
                      selected={selected}
                      disabled={me.confirmed}
                      muted={combinedMuted}
                      envyCovetedGlow={Boolean(envyCovetedHere && !envyMuted)}
                      detailTooltip={detailTooltip}
                      lustHeartRulesActive={lustHeartUi}
                      onClick={() => !me.confirmed && !combinedMuted && setSelectedCardIndex(i)}
                      role={me.role}
                      delay={i * 0.08}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {(room.status === 'playing' || room.status === 'powering') &&
          room.settings.enableDesperation &&
          desperationSpinAllowed(room, myUid, me) && (
            <div className="mx-auto mt-3 flex w-full max-w-md min-h-[2.5rem] flex-col items-center justify-center rounded-xl border border-purple-800/55 bg-purple-950/55 px-4 py-2 text-center shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12)]">
              <span className="max-w-full text-[10px] font-black uppercase leading-snug tracking-widest text-purple-200/95">
                Desperation:{' '}
                {me.desperationTier >= 0
                  ? desperationLadderLabel(room.settings.tiers, me.desperationTier) ?? `step ${me.desperationTier}`
                  : 'Off ladder until first in-match spin'}
              </span>
            </div>
          )}
      </div>

      {/* Win Modal Mini */}
      {room.status === 'finished' && (
        <div className="absolute inset-0 z-50 bg-emerald-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
           <AnimatePresence>
             {room.winner === myUid ? (
               <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                  <Trophy className="w-16 h-16 text-yellow-400 mb-4 drop-shadow-[0_0_15px_rgba(250,204,21,0.3)]" />
                  <span className="text-5xl font-black text-yellow-400 mb-2 italic">WIN</span>
               </motion.div>
             ) : (
               <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex flex-col items-center">
                  <UtensilsCrossed className="w-16 h-16 text-red-500 mb-4 opacity-50" />
                  <span className="text-5xl font-black text-red-500 mb-2 italic">LOSE</span>
               </motion.div>
             )}
           </AnimatePresence>
           
           <span className="text-lg font-black uppercase text-white tracking-[0.2em] px-8 max-w-sm">
             {room.winner === myUid ? (
               me.role === 'Predator' ? 'YOU DEVOURED YOUR PREY' : 
               me.role === 'Prey' ? 'YOU ESCAPED THE PREDATOR' :
               me.role === 'Preydator' ? `YOU OUTLASTED ${opponent?.name || 'OPPONENT'}` :
               'OBJECTIVE ACHIEVED'
             ) : (
               me.role === 'Predator' ? 'YOUR PREY ESCAPED' : 
               me.role === 'Prey' ? 'YOU WERE DEVOURED' :
               me.role === 'Preydator' ? `${opponent?.name || 'PREYDATOR'} DEVOURED YOU` :
               'HAND OVER'
             )}
           </span>

           {(me.desperationTier > 0 || (opponent && opponent.desperationTier > 0)) && (
             <div className="mt-4 flex flex-col items-center gap-2">
                {me.desperationTier > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Your desperation tier</span>
                    <span className="text-xs text-white font-black uppercase text-center">
                       {desperationLadderLabel(room.settings.tiers, me.desperationTier) ?? ''} 
                       {me.desperationResult && <span className="text-purple-400 ml-2">[{me.desperationResult}]</span>}
                    </span>
                  </div>
                )}
                {opponent && opponent.desperationTier > 0 && (
                  <div className="flex flex-col items-center opacity-60">
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Opponent&apos;s desperation tier</span>
                    <span className="text-xs text-purple-300 font-bold uppercase text-center">
                       {desperationLadderLabel(room.settings.tiers, opponent.desperationTier) ?? ''}
                       {opponent.desperationResult && <span className="text-purple-500 ml-2">[{opponent.desperationResult}]</span>}
                    </span>
                  </div>
                )}
             </div>
           )}
           <button
             type="button"
             onClick={() => {
               wipeDualReconnectSnapshots();
               setRoomId(null);
             }}
             className="mt-8 text-[12px] text-emerald-500 hover:text-white uppercase font-black tracking-[0.3em] border border-emerald-800 px-8 py-3 rounded-full hover:bg-emerald-900 transition-all"
           >
             Back to menu
           </button>
        </div>
      )}

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && <RulesSheet key="rules-modal" settings={room.settings} onClose={() => setShowRules(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [isDual, setIsDual] = useState(false);

  return (
    <div className="min-h-screen bg-emerald-950 text-white selection:bg-yellow-400 selection:text-black font-sans overflow-hidden">
      {/* Dev Toggle */}
      <div className="fixed top-4 left-4 z-[220] flex gap-2">
        <button 
          onClick={() => setIsDual(!isDual)}
          className={`p-2 rounded-lg border transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest
            ${isDual ? 'bg-yellow-400 text-emerald-950 border-yellow-500' : 'bg-emerald-900 text-emerald-500 border-emerald-800'}
          `}
        >
          {isDual ? <LayoutGrid className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
          {isDual ? 'Standard View' : 'Enable Local Multiplayer Test'}
        </button>
      </div>

      <div className={`h-screen transition-all duration-500 flex bg-emerald-950`}>
        <div className={`h-full transition-all duration-500 overflow-hidden ${isDual ? 'w-1/2' : 'w-full'}`}>
          <GameInstance instanceId="p1" isDual={isDual} />
        </div>
        
        {isDual && (
          <div className="w-1/2 h-full overflow-hidden">
            <GameInstance 
              instanceId="p2"
              isDual
            />
          </div>
        )}
      </div>

      <footer className="fixed bottom-4 left-4 pointer-events-none opacity-20 text-[8px] font-black uppercase tracking-[0.4em]">
         TACTICAL NEXUS v2.0.0 - PURE P2P NO-BACKEND MODE
      </footer>
    </div>
  );
}
