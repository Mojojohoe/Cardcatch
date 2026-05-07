/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { usePowerTooltipPosition } from './hooks/usePowerTooltipPosition';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Trophy, 
  Copy, 
  Check, 
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
  Flame,
  ZapOff,
  Star,
  Moon,
  Sun,
  Gavel,
  Globe,
  Coins,
  X,
  Play,
  Plus,
} from 'lucide-react';
import {
  GameService,
  type DiceTestRollPayload,
  parseCard,
  desperationSpinAllowed,
  describeWrathMinionTitle,
  displaySuitCardValue,
  GROVEL_CARD_ID,
  isCardBlockedByPride,
  reorderHandSlots,
  handReorderGapNeighborIndices,
  handIndexAfterReorder,
  handSlotOccurrenceRank,
  envyGreedySealSlots,
  playingCardUpgradeSteps,
  lustHeartUpgradeSteps,
  describeCardPlain,
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
} from './types';
import { FortuneWheelVisual, PowerDecisionModal } from './components/PowerInteraction';
import { DesperationWheel, TargetSuitWheel } from './components/GameWheels';
import { RoomChat } from './components/RoomChat';
import { OpponentDecisionStrip } from './components/OpponentDecisionStrip';
import { DiceBoxTestOverlay } from './components/DiceBoxTestOverlay';
import { diceTestCoinFlipPayload, diceTestRollPayloadFromValues } from './utils/diceTestRollPayload';
import { ChipDropperTest } from './components/ChipDropperTest';
import { CardShopModal } from './components/CardShopModal';
import { ShopOpponentCursorOverlay } from './components/ShopOpponentCursorOverlay';
import { DevilCurseSpinOverlay } from './components/DevilCurseSpinOverlay';
import { PanicClashResolution, type PanicClashDismissReason } from './components/PanicClashResolution';
import { SuitGlyph } from './components/SuitGlyphs';
import { SuitRasterOrGlyph } from './components/SuitRasterOrGlyph';
import { DualTableTrumpCard, DualTrumpTableLabel } from './components/DualTableTrumpCard';
import {
  CardVisual,
  CursePowerIcon,
  cursePowerIconClass,
  DesperationVignette,
  GreenEyedMonsterIcon,
  MajorArcanaIconGlyph,
  PowerCardVisual,
  SUIT_COLORS,
  WolfIcon,
} from './components/GameVisuals';
import { CurseZonePanel } from './components/CurseZonePanel';
import { ActiveCurseBackgroundTints, CompactTableGlyphRow } from './components/TableHudDecor';
import {
  ConfigurableWheel,
  resolveWheelSegments,
  slothDreamWheelDefinition,
} from './wheels';
import { desperationLadderLabel } from './utils/desperationUi';
import { resolutionLogLineClass } from './utils/resolutionLogColors';
import { HostLobbyPanel, GuestLobbyPanel } from './components/LobbyRoomPanels';
import { normalizeGameSettings, CUSTOM_LOBBY_PRESET_ID } from './settings/normalizeGameSettings';
import { sanitizeRoomDataForClient } from './settings/sanitizeRoomData';
import { useLayoutScaleBump } from './hooks/useLayoutScaleBump';
import { useGameSessionResilience } from './hooks/useGameSessionResilience';
import { useShopCursorBroadcast } from './hooks/useShopCursorBroadcast';
import { HoldDelayTooltip, HUD_INSTANT_TOOLTIP_PANEL_CLASS } from './components/HoldDelayTooltip';
import type { SavedLobbyPreset } from './settings/gameSettingsConstants';
import { jointTableTrumpPair, tableTrumpSuitNameClass } from './suitPresentation';
import { playerHandFanMotion, computeHandFanSqueeze } from './playerHandFan';
import { CARD_ART_HEIGHT, CARD_ART_WIDTH } from './cardArt/AssembledPlayingCardFace';
import { CardArtSessionBridge } from './cardArt/CardArtSessionBridge';
import { DisplayCardArtModeOverride, mergeCardArtWithRoom, useOptionalCardArt } from './cardArt/cardArtContext';
import { cardArtAssetUrl } from './cardArt/paths';
import { isShopPackPlaceholder } from './shopPack';
import { panicDiceSeatAllowed } from './services/panicDiceSeat';
import { warmCardArtImages } from './cardArt/preload';
import { shippedPlayingCardBackRasterUrl } from './cardArt/shippedRasterFallbacks';
import { CardCreator } from './cardCreator/CardCreator';
import { CardAnimationPreview } from './cardCreator/CardAnimationPreview';
import { PlayerSettingsMenu } from './components/PlayerSettingsMenu';
import { usePlayerDisplayPreferences } from './playerDisplayPreferences';
import { playSfx } from './audio/sfx';
import {
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_LUST,
  CURSE_PRIDE,
  CURSE_ENVY,
  CURSE_GREEN_EYED_MONSTER,
  CURSE_SLOTH,
  CURSE_WRATH,
  CURSES,
  CURSE_IDS,
  curseEffectActive,
  isCurseCardId,
  greedCurseActive,
  gluttonyCurseActive,
  lustCurseActive,
  prideCurseActive,
  envyCurseActive,
  wrathCurseActive,
} from './curses';

const SLOTH_DREAM_WHEEL_SEGMENTS = resolveWheelSegments(slothDreamWheelDefinition);

const PRIDE_WOUND_TOOLTIP = 'This card cannot be played for it would wound pride.';
const GROVEL_FEED_TOOLTIP = "Sometimes the only way to play the game is to feed one's pride";
const ENVY_COVET_CARD_TOOLTIP = 'The Green-Eyed Monster is envious of this card.';
const ENVY_SEALED_TOOLTIP = 'Envy has sealed this card — it cannot be played until the Green-Eyed Monster is defeated.';
const ENVY_RESOLUTION_MONSTER_TOOLTIP = 'The Green-Eyed Monster must be stopped!';

/** Round resolution: empower ladder — pause on each rank, then wiggle (see `ResolutionSequence` CARD_EMPOWER). */
const RESOLUTION_UPGRADE_INTRO_MS = 320;
const RESOLUTION_UPGRADE_PAUSE_MS = 200;
const RESOLUTION_UPGRADE_WIGGLE_MS = 380;

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

const AcquiredAssets: React.FC<{
  gains: { type: 'card' | 'power' | 'draw' | 'token', id: string | number | 'new-card' | 'world-curse' }[];
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
            {gain.type === 'card' && typeof gain.id === 'string' && (
              <AcquiredCardMiniTile cardId={gain.id} />
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
                let label =
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
                    <Flame className="w-3 h-3 sm:w-4 sm:w-4 text-violet-200" />
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
                  {label}
                </span>
              </div>
                );
              })()}
            {gain.type === 'token' && typeof gain.id === 'number' && gain.id > 0 && (
              <div className="w-12 h-16 sm:w-16 sm:h-24 rounded-lg border border-yellow-400/55 bg-yellow-900/20 shadow-[0_0_24px_rgba(250,204,21,0.18)] flex flex-col items-center justify-center gap-1 backdrop-blur-sm">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border border-yellow-300/65 bg-yellow-500/20 flex items-center justify-center">
                  <svg viewBox="0 0 300 300" className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" aria-hidden>
                    <g fill="currentColor">
                      <path d="M244.63,35.621c-21.771-18.635-47.382-29.855-73.767-33.902C121.871-5.797,70.223,11.421,35.622,51.847 c-53.236,62.198-45.972,155.773,16.226,209.01c21.771,18.634,47.381,29.853,73.766,33.901 c48.991,7.517,100.641-9.703,135.241-50.13C314.091,182.431,306.826,88.856,244.63,35.621z M273.361,191.241l-45.305-15.618 c6.102-17.803,6.028-37.107,0.014-54.724l45.257-15.575c3.577,10.453,5.862,21.429,6.74,32.741 C281.489,156.374,279.152,174.388,273.361,191.241z M247.935,61.472l-36.069,31.332c-2.669-3.055-5.579-5.961-8.752-8.677 c-11.467-9.814-24.81-15.995-38.637-18.692l9.095-46.741c22.33,4.33,43.21,14.294,60.635,29.209 C239.147,52.131,243.728,56.669,247.935,61.472z M103.251,23.983c6.428-2.315,13.021-4.109,19.71-5.388l9.087,46.843 c-17.789,3.467-34.584,12.651-47.393,27.341L48.55,61.38C63.334,44.416,82.206,31.568,103.251,23.983z M23.124,105.236 l45.297,15.617c-6.102,17.803-6.028,37.105-0.015,54.723l-45.295,15.588c-3.562-10.441-5.837-21.4-6.713-32.688 C14.976,140.151,17.32,122.11,23.124,105.236z M48.467,235.066l36.145-31.395c2.669,3.056,5.58,5.964,8.754,8.68 c11.466,9.814,24.808,15.993,38.634,18.691l-9.143,46.997c-22.325-4.348-43.185-14.422-60.604-29.333 C57.288,244.458,52.689,239.898,48.467,235.066z M193.203,272.635c-6.409,2.309-12.986,4.11-19.658,5.403l-9.117-47 c17.789-3.467,34.585-12.651,47.394-27.342l36.121,31.409C233.154,252.087,214.257,265.047,193.203,272.635z"/>
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

const RULES_ACCORDION_SHELL =
  'group rounded-xl border border-emerald-800/65 bg-emerald-950/45 open:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]';
const RULES_ACCORDION_SUMMARY =
  'cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden flex justify-between items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[11px] font-black uppercase tracking-wide text-yellow-400/95 transition-colors hover:bg-emerald-900/35 sm:py-3 sm:text-xs';
const RULES_ACCORDION_BODY = 'space-y-2 border-t border-emerald-900/45 px-3 py-3 text-xs leading-relaxed text-emerald-100/95 sm:text-sm';

const RulesSheet: React.FC<{ settings: GameSettings; onClose: () => void }> = ({ settings, onClose }) => {
  const isPreydatorLobby = settings.hostRole === 'Preydator';
  const despairSeatPhrase =
    (settings.preydatorDesperationSeats ?? 'guest') === 'both'
      ? 'either seat'
      : (settings.preydatorDesperationSeats ?? 'guest') === 'host'
        ? 'the host seat'
        : 'the guest seat';
  const desperationDisplayRows = desperationTierRowsForDisplay(settings);
  const panicOnForTable =
    settings.enablePanicDice &&
    (isPreydatorLobby
      ? settings.panicDicePreydatorHostEnabled || settings.panicDicePreydatorGuestEnabled
      : settings.panicDicePredatorEnabled || settings.panicDicePreyEnabled);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="absolute inset-0 z-[60] overflow-y-auto bg-emerald-950/98 p-4 backdrop-blur-md sm:p-6 lg:p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-3xl space-y-4 pb-14 xl:max-w-4xl"
      >
        <div className="flex flex-col gap-2 border-b border-emerald-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-black uppercase tracking-tight text-yellow-400 text-sm sm:text-lg">Rules</h3>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-emerald-200/90 sm:text-sm">
              Cardcatch is a two-player trick game with specials. Open a section below to read it—only mechanics enabled for
              this lobby are listed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="shrink-0 self-end rounded-lg p-2 transition-colors hover:bg-emerald-900/80 sm:self-start"
          >
            <X className="h-5 w-5 text-emerald-200" />
          </button>
        </div>

        <div className="space-y-3">
          <details open className={RULES_ACCORDION_SHELL}>
            <summary className={RULES_ACCORDION_SUMMARY}>
              <span>Round flow & scoring</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
            </summary>
            <div className={RULES_ACCORDION_BODY}>
              <ul className="list-disc space-y-1.5 pl-4 font-medium marker:text-emerald-600">
                <li>
                  Each round has one <strong>table suit</strong>. Cards on that suit beat cards that stayed off-suit.
                </li>
                <li>If both plays are trump or both are off-suit, higher rank wins (Ace high, then face cards, then numbers).</li>
                <li>The winner draws one card from the shared deck.</li>
                <li>
                  Predator tries to empty the prey&apos;s hand. Prey tries to outlast predator or drain the deck first.
                  {isPreydatorLobby ? ' Preydator mode keeps both seats in the hunt until someone falls.' : ''}
                </li>
                {settings.deckSizeMultiplier > 1 ? (
                  <li>This lobby shuffles multiple copies of the deck together, so duplicates can appear.</li>
                ) : null}
              </ul>
            </div>
          </details>

          {!settings.disableJokers ? (
            <details open className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Jokers</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <ul className="list-disc space-y-1.5 pl-4 font-medium marker:text-emerald-600">
                  <li>If a Joker is played against a card on the <strong>table suit</strong>, the Joker always wins.</li>
                  <li>If a Joker is played against a card <strong>not</strong> on the table suit, the Joker always loses.</li>
                  <li>If both players play a Joker, the round is a draw.</li>
                </ul>
              </div>
            </details>
          ) : null}

          {settings.enablePokerChips ? (
            <details className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Poker chips & shop</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <p>
                  Winning a round by more points than needed earns poker chips—that bonus is usually called{' '}
                  <strong>overkill</strong>. You can cash chips in mid-round to open the shop and buy new cards or boosts.
                </p>
                <p>Your opponent spends from the same store, so keep an eye on what&apos;s left in stock.</p>
              </div>
            </details>
          ) : null}

          {panicOnForTable ? (
            <details className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Panic dice</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <p>
                  When your seat gets panic dice, you may use them <strong>once per match</strong> right after the table
                  scores a round. They force a chaotic reroll—powerful, but risky.
                </p>
              </div>
            </details>
          ) : null}

          {settings.enableCurseCards ? (
            <details className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Deadly sins / curses</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <p>Curses layer extra flair onto the felt while they run. Active curses appear on the table UI—peek there anytime you need the short version.</p>
                <p>Most cards behave exactly like the basics above; curiosities show up inline when you play.</p>
              </div>
            </details>
          ) : null}

          {settings.enableDesperation ? (
            <details className={RULES_ACCORDION_SHELL}>
              <summary className={RULES_ACCORDION_SUMMARY}>
                <span>Desperation wheel</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
              </summary>
              <div className={RULES_ACCORDION_BODY}>
                <ul className="list-disc space-y-1.5 pl-4 font-medium marker:text-emerald-600">
                  <li>Eligible players may spin instead of quitting when the round allows it—dramatic swings either way.</li>
                  {!isPreydatorLobby ? (
                    <li>Normally only the prey seat may spin desperation; predator cannot.</li>
                  ) : (
                    <li>For Preydator lobbies your host picks which seats may spin ({despairSeatPhrase}).</li>
                  )}
                  <li>Worst wedge can end your run on the spot; lucky wedges sling fresh cards onto your side.</li>
                  {settings.desperationStarterTierEnabled ? (
                    <li>Starter tiers are on—you show up closer to the danger ladder immediately.</li>
                  ) : (
                    <li>Starter tiers start quiet—your first eligible spin climbs you onto the ladder.</li>
                  )}
                </ul>
                {desperationDisplayRows.length > 0 ? (
                  <p className="text-[11px] text-emerald-300/95">
                    Ladder texts this match:{' '}
                    <span className="font-semibold text-emerald-100">
                      {desperationDisplayRows.map((r) => r.label).join(', ')}
                    </span>
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}

          {!settings.disablePowerCards ? (
            <div className="space-y-2 rounded-xl border border-emerald-800/65 bg-emerald-950/40 p-3 sm:p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-500">Major arcana powers</p>
              <p className="text-xs leading-relaxed text-emerald-200/90">
                Draft these once before the duel. Expand a row to read the effect—anything disabled in setup simply won&apos;t
                trigger.
              </p>
              <div className="max-h-[min(42vh,28rem)] space-y-1.5 overflow-y-auto pr-1 sm:max-h-[min(48vh,30rem)]">
                {MAJOR_ARCANA.map((p) => (
                  <details key={p.id} className="group rounded-lg border border-emerald-900/70 bg-black/25 open:bg-black/35">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-yellow-400/95 [&::-webkit-details-marker]:hidden sm:text-xs">
                      <span>{p.name}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-emerald-500 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="border-t border-emerald-900/40 px-3 pt-0 pb-2.5 text-[11px] font-normal leading-snug text-emerald-100/90 normal-case sm:text-xs">
                      {p.description}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <p className="text-center text-[11px] leading-relaxed text-emerald-500/90">
          Still unsure? Hover the hints on cards and HUD pieces—they echo this sheet in bite-sized bursts.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-emerald-800 py-3 text-xs font-black uppercase tracking-wider text-emerald-50 transition-colors hover:bg-emerald-700"
        >
          Got it
        </button>
      </div>
    </motion.div>
  );
};

const DevPowerMenu: React.FC<{
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
  | { kind: 'wrath_cut'; victimUid: string }
  | { kind: 'clash_shatter'; uid: string; cardId: string }
  | { kind: 'power_tear'; uid: string }
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
  | { kind: 'moon_glow'; uid: string }
  | { kind: 'gluttony_bite'; uid: string; cardId: string }
  | { kind: 'greed_coin_drain'; uid: string; pts: number };

function deriveResolutionFx(event: ResolutionEvent, hostUid: string, guestUid: string): ResolutionFx {
  const otherUid = (uid: string) => (uid === hostUid ? guestUid : hostUid);

  if (event.type === 'GLUTTONY_DIGEST' && event.uid && event.cardId) {
    return { kind: 'gluttony_bite', uid: event.uid, cardId: event.cardId };
  }

  if (event.type === 'CLASH_DESTROYED' && event.uid && event.cardId) {
    return { kind: 'clash_shatter', uid: event.uid, cardId: event.cardId };
  }
  if (event.type === 'POWER_DESTROYED' && event.uid) {
    return { kind: 'power_tear', uid: event.uid };
  }

  if (event.type === 'POWER_TRIGGER') {
    const id = event.powerCardId;
    const uid = event.uid;
    if (id === CURSE_GREED && uid && (event.greedTaxPts ?? 0) > 0) {
      return { kind: 'greed_coin_drain', uid, pts: event.greedTaxPts! };
    }
    if (id === 13 && uid) return { kind: 'death_slash', victimUid: otherUid(uid) };
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
  if ((fx.kind === 'death_slash' || fx.kind === 'wrath_cut') && fx.victimUid === uid)
    return { x: [0, -9, 9, -5, 5, 0], scale: [1, 0.94, 1] };
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
  if (fx.kind === 'greed_coin_drain' && fx.uid === uid)
    return {
      scale: [1, 1.048, 1],
      filter: ['brightness(1)', 'brightness(1.12)', 'brightness(1)'],
    };
  return {};
}

const HUD_TABLE_ACTION_BTN =
  'rounded-xl border-2 border-amber-500/85 bg-amber-400/95 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-950 shadow-[0_8px_26px_rgba(0,0,0,0.38)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 sm:px-8 sm:py-3 sm:text-[11px]';

/** Power/curse card under the playing card: same footprint as suit (`PC_HAND`), peeking from left/right with a 30° tilt. */
const PowerTuckedUnderSuit: React.FC<{
  side: 'left' | 'right';
  children: React.ReactNode;
}> = ({ side, children }) => (
  <div
    className={`pointer-events-auto absolute left-1/2 top-1/2 z-0 h-[10.8rem] w-[7.2rem] -translate-y-1/2 ${
      side === 'left'
        ? '-translate-x-[calc(50%+1.35rem)] rotate-[30deg]'
        : '-translate-x-[calc(50%-1.35rem)] -rotate-[30deg]'
    }`}
  >
    {children}
  </div>
);

const RESOLUTION_TEAR_LEFT_CLIP =
  'polygon(0% 0%, 53% 0%, 49% 12%, 55% 24%, 47% 38%, 56% 50%, 48% 64%, 54% 79%, 50% 100%, 0% 100%)';
const RESOLUTION_TEAR_RIGHT_CLIP =
  'polygon(47% 0%, 100% 0%, 100% 100%, 50% 100%, 54% 82%, 46% 66%, 53% 50%, 45% 34%, 51% 17%)';

const ResolutionTearOverlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    key="resolution-tear"
    className="pointer-events-none absolute inset-0 z-[34]"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="absolute inset-0"
      style={{ clipPath: RESOLUTION_TEAR_LEFT_CLIP }}
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x: -52, y: 72, rotate: -19, opacity: [1, 1, 0.05] }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{children}</div>
    </motion.div>
    <motion.div
      className="absolute inset-0"
      style={{ clipPath: RESOLUTION_TEAR_RIGHT_CLIP }}
      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      animate={{ x: 52, y: 72, rotate: 19, opacity: [1, 1, 0.05] }}
      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">{children}</div>
    </motion.div>
    <motion.div
      className="absolute inset-y-[10%] left-1/2 z-[36] w-[2px] -translate-x-1/2 bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.65)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.95, 0] }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    />
  </motion.div>
);

const ResolutionSequence: React.FC<{
  room: RoomData;
  myUid: string;
  onComplete: () => void;
  /** Fullscreen dice replay for host-authored `resolutionDice` (synced values). */
  onResolutionDiceRoll?: (payload: DiceTestRollPayload) => void;
  /** Bumps when recap replays so dice `rollId`s stay unique across runs. */
  replayNonce: number;
}> = ({ room, myUid, onComplete, onResolutionDiceRoll, replayNonce }) => {
  const { sfxVolume } = usePlayerDisplayPreferences();
  const outcome = room.lastOutcome!;
  const [eventIndex, setEventIndex] = useState(-1);
  const [currentCards, setCurrentCards] = useState(() => ({ ...(outcome as any).initialCardsPlayed || outcome.cardsPlayed }));
  const [currentTarget, setCurrentTarget] = useState(room.targetSuit);
  const [summoned, setSummoned] = useState<Record<string, string>>({});
  const [devilStolen, setDevilStolen] = useState<Record<string, number>>({});
  const [visibleEvents, setVisibleEvents] = useState<
    {
      id: number;
      message: string;
      eventType?: ResolutionEventType;
      logClass?: string;
    }
  >([]);
  const [isDone, setIsDone] = useState(false);
  const [towerScorch, setTowerScorch] = useState<Record<string, boolean>>({});
  const [resolutionFx, setResolutionFx] = useState<ResolutionFx>(null);
  const [lustHeartBurst, setLustHeartBurst] = useState(false);
  /** Per-seat resolution morph on the played card (`transform` = identity flip only). */
  const [resolutionCardMorph, setResolutionCardMorph] = useState<Record<string, 'transform_out' | 'transform_in'>>({});
  const [resolutionCardMorphTick, setResolutionCardMorphTick] = useState<Record<string, number>>({});
  /** Bumped after each empower step so `CardVisual` replays a short wiggle without dropping artwork mode. */
  const [resolutionEmpowerWiggleTick, setResolutionEmpowerWiggleTick] = useState<Record<string, number>>({});
  const [resolutionEmpowerCaption, setResolutionEmpowerCaption] = useState<{ uid: string; text: string } | null>(null);

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
  const [wrathAnim, setWrathAnim] = useState<
    null | { stage: 'center' | 'fly' | 'cutting'; cutIndex: number }
  >(null);
  const [wrathRevealDone, setWrathRevealDone] = useState(false);

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

      const wf = outcome.wrathFx;
      if (wf && !wf.sparedJoker && wf.magnitude > 0 && wf.minionCard && wf.targetUid) {
        setWrathRevealDone(false);
        setWrathAnim({ stage: 'center', cutIndex: 0 });
        await new Promise((r) => setTimeout(r, 700));
        if (!active) return;
        setWrathAnim({ stage: 'fly', cutIndex: 0 });
        await new Promise((r) => setTimeout(r, 650));
        if (!active) return;
        setWrathAnim({ stage: 'cutting', cutIndex: 0 });
        for (let i = 1; i <= wf.magnitude; i++) {
          setWrathAnim({ stage: 'cutting', cutIndex: i });
          setResolutionFx({ kind: 'wrath_cut', victimUid: wf.targetUid });
          await new Promise((r) => setTimeout(r, 500));
          if (!active) return;
          setResolutionFx(null);
        }
        setWrathAnim(null);
        setWrathRevealDone(true);
      } else if (wf?.targetUid) {
        setWrathRevealDone(true);
      }
      
      const events = outcome.events || [];
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const fx = deriveResolutionFx(event, hostUid, guestUid);
        setResolutionFx(fx);
        if (fx?.kind === 'power_tear' || fx?.kind === 'clash_shatter') {
          playSfx('/assets/sounds/Card-Tear.mp3', sfxVolume);
        }
        if (fx?.kind === 'death_slash' || fx?.kind === 'wrath_cut') {
          playSfx('/assets/sounds/Card-Slice.mp3', sfxVolume);
        }
        if (event.type === 'TRANSFORM') {
          playSfx('/assets/sounds/Card-Transform.mp3', sfxVolume);
        }
        if (event.type === 'COIN_FLIP' && (event.message ?? '').includes('unwraps Cash Chips')) {
          playSfx('/assets/sounds/Card-Buy.mp3', sfxVolume);
        }
        setEventIndex(i);
        setVisibleEvents((prev) => [
          ...prev,
          {
            id: Date.now() + i,
            message: event.message ?? '',
            eventType: event.type,
            logClass: resolutionLogLineClass(event),
          },
        ]);

        if (event.resolutionDice?.length && onResolutionDiceRoll) {
          const dice = event.resolutionDice;
          const sides = event.coinFlipSides;
          const coinVal = dice[0];
          const isCoinBeat =
            sides &&
            dice.length === 1 &&
            (coinVal === 0 || coinVal === 1) &&
            room.players[sides.headsUid] &&
            room.players[sides.tailsUid];

          if (isCoinBeat) {
            onResolutionDiceRoll(
              diceTestCoinFlipPayload({
                coinValue: coinVal as 0 | 1,
                headsPlayerName: room.players[sides!.headsUid].name,
                tailsPlayerName: room.players[sides!.tailsUid].name,
                rollId: `reso-${room.currentTurn}-${i}-${replayNonce}`,
                uid: room.hostUid,
                presentation: 'resolutionPage',
              }),
            );
          } else {
            onResolutionDiceRoll(
              diceTestRollPayloadFromValues({
                dice,
                rollId: `reso-${room.currentTurn}-${i}-${replayNonce}`,
                uid: room.hostUid,
                presentation: 'resolutionPage',
              }),
            );
          }
        }

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
              const heartsLustLadder = f.suit === 'Hearts' && t.suit === 'Hearts';
              const steps = (
                heartsLustLadder
                  ? lustHeartUpgradeSteps(event.fromCardId, event.cardId)
                  : playingCardUpgradeSteps(event.fromCardId, event.cardId)
              ).filter(Boolean);
              if (steps.length > 1) {
                setResolutionEmpowerCaption({
                  uid: event.uid!,
                  text:
                    event.message?.trim() ||
                    (heartsLustLadder ? 'Lust empowers this heart.' : 'Empowering.'),
                });
                await new Promise((r) => setTimeout(r, RESOLUTION_UPGRADE_INTRO_MS));
                if (!active) return;
                const uidK = event.uid!;
                try {
                  for (let s = 0; s < steps.length; s++) {
                    const stepCard = steps[s];
                    setCurrentCards((prev) => ({ ...prev, [uidK]: stepCard }));
                    await new Promise((r) => setTimeout(r, RESOLUTION_UPGRADE_PAUSE_MS));
                    if (!active) return;
                    setResolutionEmpowerWiggleTick((prev) => ({
                      ...prev,
                      [uidK]: (prev[uidK] ?? 0) + 1,
                    }));
                    await new Promise((r) => setTimeout(r, RESOLUTION_UPGRADE_WIGGLE_MS));
                    if (!active) return;
                  }
                } finally {
                  setResolutionEmpowerCaption(null);
                  setResolutionEmpowerWiggleTick((prev) => {
                    const next = { ...prev };
                    delete next[uidK];
                    return next;
                  });
                }
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
            if (event.powerCardId === CURSE_LUST && event.lustFeedBegins) {
              await new Promise((r) => setTimeout(r, 480));
              if (!active) return;
              setLustHeartBurst(true);
            }
            if (event.powerCardId === CURSE_LUST && (event.lustFeedPts ?? 0) > 0 && event.uid) {
              if (event.lustSurgeHeart) {
                const u = event.uid!;
                setResolutionEmpowerWiggleTick((prev) => ({ ...prev, [u]: (prev[u] ?? 0) + 1 }));
                await new Promise((r) => setTimeout(r, 480));
                if (!active) return;
                setResolutionEmpowerWiggleTick((prev) => {
                  const next = { ...prev };
                  delete next[u];
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
              setResolutionCardMorph((m) => ({ ...m, [event.uid!]: 'transform_out' }));
              setResolutionCardMorphTick((m) => ({ ...m, [event.uid!]: (m[event.uid!] ?? 0) + 1 }));
              /** Phase A: warm-up pulse then rotate to side-on edge (`rotateY=-90`). */
              await new Promise((r) => setTimeout(r, 560));
        if (!active) return;
              /** Midpoint handoff: card is edge-on, so swap to destination face now. */
              setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.cardId! }));
              /** Phase B: new face starts edge-on (`rotateY=90`) and unfolds to front. */
              setResolutionCardMorph((m) => ({ ...m, [event.uid!]: 'transform_in' }));
              await new Promise((r) => setTimeout(r, 560));
              if (!active) return;
              setResolutionCardMorph((m) => {
                const next = { ...m };
                delete next[event.uid!];
                return next;
              });
              setResolutionCardMorphTick((m) => {
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
          case 'GLUTTONY_DIGEST':
            break;
        }

        if (event.type === 'GLUTTONY_DIGEST' && event.uid && event.cardId && event.gluttonyBoneId) {
          await new Promise((r) => setTimeout(r, 760));
          if (!active) return;
          setCurrentCards((prev) => ({ ...prev, [event.uid!]: event.gluttonyBoneId! }));
          await new Promise((r) => setTimeout(r, 320));
          if (!active) return;
          setResolutionFx(null);
        }

        let pauseMs =
          event.type === 'COIN_FLIP'
            ? event.resolutionDice?.length
              ? 5200
              : 5800
            : event.type === 'POWER_DESTROYED'
              ? 1500
              : event.type === 'CARD_EMPOWER' || event.type === 'TARGET_CHANGE'
                ? 1180
                : event.type === 'GLUTTONY_DIGEST'
                  ? 3200
                  : event.type === 'POWER_TRIGGER'
                    ? event.powerCardId === 10 && event.uid
                      ? 4500
                      : event.powerCardId === CURSE_LUST && (event.lustFeedPts ?? 0) > 0
                        ? 1320
                        : event.powerCardId === CURSE_GREED && (event.greedTaxPts ?? 0) > 0
                          ? 1150
                          : 1050
                  : event.type === 'ENVY_COVET' || event.type === 'ENVY_STRIKE' || event.type === 'ENVY_DEFEATED' || event.type === 'ENVY_DEPARTS'
                  ? 1280
                  : event.type === 'SLOTH_DREAM'
                    ? typeof event.slothDreamSpinOffset === 'number'
                      ? Math.round(slothDreamWheelDefinition.spinDurationSeconds * 1000 + 750)
                      : 1200
                    : 1150;
        if (fx?.kind === 'death_slash' || fx?.kind === 'wrath_cut')
          pauseMs = Math.max(pauseMs, 1380);
        if (fx?.kind === 'envy_lunge') pauseMs = Math.max(pauseMs, 1380);
        if (fx?.kind === 'clash_shatter') pauseMs = Math.max(pauseMs, 1640);
        if (fx?.kind === 'power_tear') pauseMs = Math.max(pauseMs, 1640);
        if (fx?.kind === 'gluttony_bite') pauseMs = Math.max(pauseMs, 3400);
        if (fx?.kind === 'greed_coin_drain') pauseMs = Math.max(pauseMs, 1280);
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
      setResolutionEmpowerCaption(null);
      setWrathAnim(null);
      setWrathRevealDone(false);
    };
  }, [outcome.events, outcome.cardsPlayed, outcome.slothDreamFx, outcome.wrathFx, room.hostUid, room.players]);

  const hostUid = room.hostUid;
  const guestUid = Object.keys(room.players).find(id => id !== hostUid)!;

  const lustHeartResolution =
    room.settings.enableCurseCards &&
    (lustCurseActive(room.activeCurses ?? []) ||
      outcome.powerCardIdsPlayed[hostUid] === CURSE_LUST ||
      outcome.powerCardIdsPlayed[guestUid] === CURSE_LUST);

  const gluttonyShownInResolution =
    room.settings.enableCurseCards &&
    (gluttonyCurseActive(room.activeCurses ?? []) ||
      outcome.events?.some((e) => e.type === 'GLUTTONY_DIGEST'));

  const greedActiveResolution =
    room.settings.enableCurseCards && greedCurseActive(room.activeCurses ?? []);

  const jointTrump = jointTableTrumpPair(currentTarget, { greedActive: greedActiveResolution });

  const activeCursesSorted =
    room.settings.enableCurseCards && (room.activeCurses?.length ?? 0) > 0
      ? [...(room.activeCurses ?? [])].sort(
          (a, b) => CURSE_IDS.indexOf(a.id as (typeof CURSE_IDS)[number]) - CURSE_IDS.indexOf(b.id as (typeof CURSE_IDS)[number]),
        )
      : [];

  const lustHeartFlyCentered = activeCursesSorted.length > 1 && lustHeartResolution;

  const wfRes = outcome.wrathFx;
  const wrathTripleColumn = Boolean(wfRes && !wfRes.sparedJoker && wfRes.magnitude > 0);
  const wrathNeedsIntro = wrathTripleColumn;

  const showWrathAgentAbovePlayer = (uid: string) => {
    if (!wfRes || wfRes.targetUid !== uid || !wfRes.minionCard) return false;
    if (!wrathNeedsIntro) return true;
    if (wrathRevealDone) return true;
    if (wrathAnim && (wrathAnim.stage === 'fly' || wrathAnim.stage === 'cutting')) return true;
    return false;
  };

  return (
    <div className="relative flex max-h-screen w-full flex-col items-center overflow-hidden rounded-2xl border border-slate-800/50 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(251,191,36,0.14),transparent_58%),linear-gradient(180deg,#020617_0%,#0f172a_50%,#020617_100%)] px-4 py-2 shadow-[inset_0_0_100px_rgba(15,23,42,0.55)] sm:px-6 sm:py-3 justify-start pt-1">
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
                left: lustHeartFlyCentered
                  ? '50%'
                  : lustHeartResolution
                    ? '12%'
                    : part.uid === hostUid
                      ? '36%'
                      : '64%',
                top: lustHeartFlyCentered ? '22%' : lustHeartResolution ? '21%' : '48%',
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
      {resolutionFx?.kind === 'greed_coin_drain' && (
        <div className="pointer-events-none absolute inset-0 z-[86] overflow-hidden">
          {Array.from({ length: Math.min(5, Math.max(1, Math.floor(resolutionFx.pts))) }).map((_, i) => (
            <motion.div
              key={`greed-coin-${resolutionFx.uid}-${i}`}
              initial={{
                opacity: 0,
                scale: 0.2,
                left: resolutionFx.uid === hostUid ? '36%' : '64%',
                top: '54%',
              }}
              animate={{
                opacity: [0, 1, 0.88, 0],
                scale: [0.2, 0.92, 0.68],
                left: '50%',
                top: activeCursesSorted.length > 0 ? '20%' : '16%',
              }}
              transition={{
                duration: 1.12,
                delay: i * 0.055,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 sm:h-8 sm:w-8"
            >
              <Coins
                className="h-full w-full text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,72,0.95)]"
                strokeWidth={1.75}
              />
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

      <div className="relative mb-2 flex w-full max-w-[52rem] flex-none flex-col px-2">
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
        <div className="flex w-full flex-col items-center gap-3">
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
            className="flex w-full flex-col items-center"
          >
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 sm:text-sm">Table suit</span>
              {jointTrump ? (
                <>
                  {jointTrump.map((suit, ji) => (
                    <React.Fragment key={`${currentTarget ?? 'none'}-jt-${ji}-${suit}`}>
                      {ji === 1 && (
                        <span className="mx-1 text-[9px] font-black uppercase tracking-widest text-slate-500 sm:text-[10px]">
                          or
                        </span>
                      )}
                      <motion.div
                        key={`${currentTarget}-${suit}`}
                        initial={{ scale: 0.75, opacity: 0.4, filter: 'drop-shadow(0 0 0 rgba(251,191,36,0))' }}
                        animate={{
                          scale: 1.06,
                          opacity: 1,
                          filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.45))',
                        }}
                        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
                        className={`flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-full border-2 border-slate-600 bg-slate-900 shadow-2xl sm:h-16 sm:w-16 ${SUIT_COLORS[suit]}`}
                      >
                        <SuitGlyph
                          suit={suit}
                          className="h-[2.35rem] w-[2.35rem] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:h-11 sm:w-11"
                        />
                      </motion.div>
                    </React.Fragment>
                  ))}
                </>
              ) : (
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
              )}
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 sm:text-sm">this round</span>
          </div>
        </motion.div>

          {activeCursesSorted.length > 0 && (
            <div className="flex max-w-[52rem] flex-wrap justify-center gap-x-4 gap-y-4 px-1 sm:gap-x-5">
              {activeCursesSorted.map((entry) => (
                <div key={entry.id} className="flex max-w-[6.75rem] flex-col items-center gap-1">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider ${cursePowerIconClass(entry.id)}`}
                  >
                    {CURSES[entry.id]?.sin ?? 'Curse'}
                  </span>
                  <PowerCardVisual cardId={entry.id} small revealed curseRackPeek />
                  {entry.id === CURSE_LUST && outcome.lustRoundFx && (
                    <span className="text-center text-[9px] font-black tabular-nums text-rose-200/95">
                      {outcome.lustRoundFx.previousMeter}
                      <span className="text-rose-500/80"> → </span>
                      {outcome.lustRoundFx.sated ? 0 : outcome.lustRoundFx.nextMeter}
                    </span>
                  )}
                  {entry.id === CURSE_GLUTTONY && gluttonyShownInResolution && (
                    <span className="text-center text-[8px] font-bold uppercase leading-snug text-amber-200/85">
                      Hearts digest to bones after scoring.
                    </span>
                  )}
                  {entry.id === CURSE_GREED && outcome.greedPersistence && (
                    <span className="text-center text-[9px] font-black tabular-nums text-amber-100/95">
                      +{outcome.greedPersistence.taxThisRound} tithe · crown {outcome.greedPersistence.nextCrown}/17
                    </span>
                  )}
                  {entry.id === CURSE_ENVY &&
                    outcome.envyRoundFx &&
                    typeof envyShownHp === 'number' && (
                      <span className="text-center text-[9px] font-black tabular-nums text-emerald-200/95">
                        Monster {envyShownHp} HP
                      </span>
                    )}
                  {entry.id === CURSE_WRATH && outcome.wrathFx && (
                    <span className="text-center text-[8px] font-bold uppercase leading-snug text-red-300/90">
                      {describeWrathMinionTitle(outcome.wrathFx.minionCard)} · −{outcome.wrathFx.magnitude}
                      {outcome.wrathFx.sparedJoker ? ' · spared' : ''}
                    </span>
                  )}
                  {entry.id === CURSE_PRIDE && room.prideCeilingCard && (
                    <span className="break-words text-center text-[8px] font-bold uppercase leading-snug text-violet-200/85">
                      {(() => {
                        const pc = parseCard(room.prideCeilingCard);
                        const v = pc.suit === 'Crowns' ? displaySuitCardValue(pc.suit, pc.value) : pc.value;
                        return `Ceiling beats ${v} (${pc.suit}).`;
                      })()}
                    </span>
                  )}
                  {entry.id === CURSE_SLOTH && outcome.slothDreamFx && (
                    <span className="text-center text-[8px] font-bold uppercase leading-snug text-indigo-200/85">
                      Dream transforms apply after the wheel.
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {outcome.envyRoundFx && envyShownHp !== null && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          title={ENVY_RESOLUTION_MONSTER_TOOLTIP}
          className="mb-4 flex flex-col items-center gap-2"
        >
          <div className="origin-center scale-[0.92] drop-shadow-[0_12px_36px_rgba(16,185,129,0.4)] sm:scale-100">
            <PowerCardVisual cardId={CURSE_ENVY} small revealed curseRackPeek />
          </div>
          <span className="font-mono text-lg font-black tabular-nums text-emerald-200 sm:text-2xl">
            {envyShownHp}{' '}
            <span className="text-xs font-black uppercase tracking-wider text-emerald-500">HP</span>
          </span>
        </motion.div>
      )}

      <div
        className={`flex-none flex w-full max-w-5xl items-center justify-center ${
          wrathTripleColumn ? 'items-end gap-1 sm:gap-4' : 'gap-4 sm:gap-12'
        }`}
      >
        {[hostUid, guestUid].map((uid, idx) => (
          <React.Fragment key={uid}>
          <div className="flex flex-col items-center gap-3 relative scale-100 sm:scale-110 origin-top">
            <motion.div 
              initial={{ x: idx === 0 ? -20 : 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className={`px-2 py-0.5 rounded border border-slate-800 bg-slate-950/80 backdrop-blur-sm ${room.players[uid].role === 'Predator' ? 'text-red-500 border-red-900/30' : (room.players[uid].role === 'Preydator' ? 'text-purple-500 border-purple-900/30' : 'text-blue-400 border-blue-900/30')}`}
            >
               <span className="text-[8px] font-black uppercase tracking-widest leading-none block">{room.players[uid].name}</span>
            </motion.div>

            {showWrathAgentAbovePlayer(uid) && wfRes?.minionCard && (
              <motion.div
                className="pointer-events-none absolute -top-6 left-1/2 z-40 flex w-[10rem] -translate-x-1/2 justify-center sm:w-[11rem]"
                initial={
                  wrathAnim?.stage === 'fly'
                    ? { y: 26, opacity: 0.75 }
                    : { y: -10, opacity: 1 }
                }
                animate={
                  wrathAnim?.stage === 'fly'
                    ? { y: 0, opacity: 1 }
                    : { y: [0, -12, 0], opacity: 1 }
                }
                transition={
                  wrathAnim?.stage === 'fly'
                    ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
                    : {
                        y: { repeat: Infinity, duration: 1.2, ease: 'easeInOut' },
                      }
                }
              >
                <div className="origin-top scale-[0.62] drop-shadow-[0_0_28px_rgba(220,38,38,0.5)] sm:scale-[0.68]">
                  <CardVisual card={wfRes.minionCard} revealed noAnimate presentation="none" small />
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {resolutionEmpowerCaption?.uid === uid && (
                <motion.div
                  key={`empower-${resolutionEmpowerCaption.text}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="pointer-events-none z-[25] mb-1.5 max-w-[min(17rem,92vw)] px-2 text-center text-[10px] font-black uppercase italic leading-snug tracking-wide text-rose-200/95 drop-shadow-[0_0_12px_rgba(251,113,133,0.35)] sm:text-[11px]"
                >
                  {resolutionEmpowerCaption.text}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <div className="flex items-end gap-2">
                {idx === 0 && summoned[uid] && (
                  <div className="origin-center scale-[0.82] sm:scale-[0.9]">
                    <CardVisual
                      card={summoned[uid]}
                      revealed
                      presentation="deckPull"
                      deckPullSide="left"
                      delay={0.12}
                      lustHeartRulesActive={lustHeartResolution}
                    />
                  </div>
                )}
                <div className="relative inline-block shrink-0">
                  {outcome.powerCardIdsPlayed[uid] !== null && (
                    <PowerTuckedUnderSuit side={idx === 0 ? 'left' : 'right'}>
                      <div className="relative h-full w-full">
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
                          className={`overflow-visible rounded-xl shadow-[0_14px_32px_rgba(0,0,0,0.42)] ${
                            outcome.powerCardIdsPlayed[uid] === 15 ? 'ring-2 ring-red-500 animate-pulse' : ''
                          }`}
                        >
                          <PowerCardVisual
                            cardId={outcome.powerCardIdsPlayed[uid]!}
                            matchHandCard
                            destroyed={Boolean(
                              towerScorch[uid] ||
                                (isDone && outcome.powerCardTowerBlocked?.[uid])
                            )}
                          />
                        </motion.div>
                        <AnimatePresence>
                          {resolutionFx?.kind === 'power_tear' && resolutionFx.uid === uid && (
                            <ResolutionTearOverlay>
                              <PowerCardVisual
                                cardId={outcome.powerCardIdsPlayed[uid]!}
                                matchHandCard
                                destroyed
                              />
                            </ResolutionTearOverlay>
                          )}
                          {devilStolen[uid] !== undefined && (
                            <motion.div
                              initial={{ scale: 0, x: -5, opacity: 0 }}
                              animate={{ scale: 0.5, x: -12, opacity: 1 }}
                              className="absolute -right-0.5 -top-0.5 z-[2] rounded-full border border-red-500 bg-slate-900 p-0.5 shadow-2xl"
                            >
                              <PowerCardVisual cardId={devilStolen[uid]} small />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </PowerTuckedUnderSuit>
                  )}
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
                    resolutionMorphTick={resolutionCardMorphTick[uid] ?? 0}
                    resolutionWiggleTick={resolutionEmpowerWiggleTick[uid] ?? 0}
                  />
                  <AnimatePresence>
                    {resolutionFx?.kind === 'clash_shatter' && resolutionFx.uid === uid && (
                      <ResolutionTearOverlay>
                        <CardVisual
                          card={resolutionFx.cardId}
                          revealed
                          noAnimate
                          presentation="none"
                        />
                      </ResolutionTearOverlay>
                    )}
                    {(resolutionFx?.kind === 'death_slash' || resolutionFx?.kind === 'wrath_cut') &&
                      resolutionFx.victimUid === uid && (
                      <motion.div
                        key={resolutionFx?.kind === 'wrath_cut' ? 'wrath-cut' : 'death-slash'}
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
                    {resolutionFx?.kind === 'star_sparkle' && resolutionFx.uid === uid && (
                      <motion.div
                        key="star-sparkle"
                        className="pointer-events-none absolute inset-0 z-[24] flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1, rotate: [0, 8, -6, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.65 }}
                      >
                        <Sparkles className="w-[3.1rem] h-[3.1rem] text-amber-300 drop-shadow-[0_0_16px_rgba(253,224,71,0.88)]" />
                      </motion.div>
                    )}
                    {resolutionFx?.kind === 'moon_glow' && resolutionFx.uid === uid && (
                      <motion.div
                        key="moon-glow"
                        className="pointer-events-none absolute inset-0 z-[24] flex items-center justify-center"
                        initial={{ opacity: 0, scale: 0.72 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6 }}
                      >
                        <Moon className="h-[3rem] w-[3rem] text-indigo-100 drop-shadow-[0_0_18px_rgba(199,210,254,0.88)] sm:h-[3.35rem] sm:w-[3.35rem]" strokeWidth={1.6} />
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
                    {resolutionFx?.kind === 'gluttony_bite' && resolutionFx.uid === uid && (
                      <motion.div
                        key="gluttony-bite"
                        className="pointer-events-none absolute inset-0 z-[31] flex items-center justify-center overflow-visible rounded-xl"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <motion.div
                          className="absolute inset-[-4px] rounded-[13px]"
                          initial={{
                            clipPath: 'ellipse(138% 120% at 112% -12%)',
                            boxShadow: 'inset 0 0 0 0 rgba(15,23,42,0)',
                          }}
                          animate={{
                            clipPath: [
                              'ellipse(138% 120% at 112% -12%)',
                              'ellipse(55% 48% at 108% -4%)',
                              'ellipse(28% 24% at 96% 6%)',
                            ],
                            boxShadow: [
                              'inset 0 0 0 0 rgba(15,23,42,0)',
                              'inset 0 -12px 28px rgba(15,23,42,0.88)',
                              'inset 0 -26px 40px rgba(15,23,42,1)',
                            ],
                          }}
                          transition={{ duration: 0.74, ease: [0.5, 0, 0.5, 1] }}
                          style={{
                            background:
                              'radial-gradient(110% 80% at 95% -5%,rgba(254,243,199,0.12),transparent 58%),rgba(15,23,42,0.72)',
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                </div>
                {idx === 1 && summoned[uid] && (
                  <div className="origin-center scale-[0.82] sm:scale-[0.9]">
                    <CardVisual
                      card={summoned[uid]}
                      revealed
                      presentation="deckPull"
                      deckPullSide="right"
                      delay={0.16}
                      lustHeartRulesActive={lustHeartResolution}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
            {idx === 0 && wrathTripleColumn && (
              <div
                className="flex w-[5.5rem] shrink-0 flex-col items-center justify-end self-end pb-4 min-h-[9.5rem] sm:min-h-[10.5rem] sm:w-[6.5rem] sm:pb-6"
                aria-hidden={!wrathAnim}
              >
                {wrathAnim?.stage === 'center' && wfRes?.minionCard && (
                    <motion.div 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="origin-top scale-[0.62] drop-shadow-[0_0_24px_rgba(220,38,38,0.45)] sm:scale-[0.68]"
                  >
                    <CardVisual card={wfRes.minionCard} revealed noAnimate presentation="none" small />
                    </motion.div>
                  )}
            </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-10 flex w-full max-w-xl flex-none flex-col items-center sm:mt-14">
        <div className="relative flex min-h-[52px] w-full flex-col items-center justify-center overflow-visible">
          <AnimatePresence mode="popLayout">
            {visibleEvents
              .slice(-2)
              .filter((e) => e.message.trim().length > 0)
              .map((evt, i) => (
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
                className={`whitespace-pre-line text-center font-black uppercase tracking-widest italic text-[10px] sm:text-sm ${evt.logClass ?? 'text-slate-400'} ${i === 1 ? 'opacity-100' : 'opacity-[0.42]'}`}
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
    <HoldDelayTooltip caption={HUD_HOLD_OPPONENT_DESPERATION_CAPTION} className={`z-[28] w-full max-w-full shrink-0 ${className}`}>
    <div
      className={`w-full max-w-full rounded-lg border border-purple-800/65 bg-purple-950/93 py-1.5 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12)]`}
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
    </HoldDelayTooltip>
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
              dense
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

/** Bottom-strip panic dice: not usable until `results` (strip only shows during playing / powering). */
const PANIC_DICE_STRIP_HOVER_HELP =
  "Panic dice can be used after a round has resolved to remove value from the opponent's cards. Panic dice can only be used once.";

const PANIC_DICE_STRIP_CLICK_HELP =
  "Panic dice can be used after the round has resolved. Panic dice will roll and create a card based on the rolled value. That value will be subtracted from the opponent's roll. The round is then re-evaluated. Panic dice are one-use only.";

const PANIC_DICE_USED_HOVER = 'You have used your Panic Dice this game.';

/** ~700ms hold tooltips — same slate + yellow framing as playing-card hints. */
const HUD_HOLD_DECK_CAPTION =
  'The cards remaining in the game. There are other ways to get cards than the deck, but once this reaches 0, starvation mode will begin.';

const HUD_HOLD_OPPONENT_HAND_CAPTION =
  "Your opponent's hand. You cannot see their cards. Unless power cards are used, only winning a round allows you to draw a card. Your objective is to win enough rounds that they run out of cards.";

const HUD_HOLD_OPPONENT_POWERS_CAPTION =
  'Your opponent’s power cards. You both had the same choices of power cards at the start of the game. They can use up to one of these per round.';

const HUD_HOLD_PLAYER_TOKENS_CAPTION =
  'Your Poker Chips. You earn 1 token for every value above your opponent’s in a round. This is called “overkill”. You can cash out your chips during a round to buy new cards.';

const HUD_HOLD_OPPONENT_TOKENS_CAPTION =
  'Your opponent’s Poker Chips. They can spend these in the shared shop to buy new cards.';

const HUD_HOLD_TARGET_SUIT_CAPTION =
  'This is the target suit for this round. This suit trumps all other suits. A 2 of the target suit will trump an Ace of a non-target suit.';

const HUD_HOLD_OPPONENT_DESPERATION_CAPTION =
  'The current Desperation tier for the opponent. If they lose the game, this is the effect they will suffer.';

/** UI time to show “deck empty / dealing bones” before the full-screen FAMINE callout */
const FAMINE_BONE_DEAL_UI_MS = 6400;

type FamineBannerPhase = 'idle' | 'bone_deal' | 'famine_title';

const GameInstance: React.FC<GameInstanceProps> = ({ instanceId, isDual }) => {
  const serviceRef = useRef(new GameService());
  const [playerName, setPlayerName] = useState(isDual ? `Tester ${instanceId.slice(-1)}` : '');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<RoomData | null>(null);
  const ingestRoomState = useCallback((state: RoomData) => {
    setRoom(sanitizeRoomDataForClient(state));
  }, []);
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
  /** Bumps when panic clash finishes so {@link ResolutionSequence} remounts and replays with post-panic outcome. */
  const [resolutionReplayNonce, setResolutionReplayNonce] = useState(0);
  const [seenIntel, setSeenIntel] = useState<PlayerData['secretIntel']>(null);
  const lastTurnRef = useRef(0);
  const cardSelectionTurnRef = useRef<number | null>(null);
  const myUid = serviceRef.current.getUid();
  const [famineBannerPhase, setFamineBannerPhase] = useState<FamineBannerPhase>('idle');
  const [hudDiceRoll, setHudDiceRoll] = useState<DiceTestRollPayload | null>(null);
  const [cashShopOpen, setCashShopOpen] = useState(false);
  /** Hover on Cash Chips action button — boosts 3D token emissive on your pile only. */
  const [cashShopBtnHover, setCashShopBtnHover] = useState(false);
  /** True until `cardShopBrowsersUids` echoes us — avoids closing the modal during the async open race. */
  const cashShopPresencePendingRef = useRef(false);
  const layoutScaleBump = useLayoutScaleBump();
  useGameSessionResilience(serviceRef, room);
  const [panicDiceConfirmOpen, setPanicDiceConfirmOpen] = useState(false);
  const [panicDiceStripExplainOpen, setPanicDiceStripExplainOpen] = useState(false);
  const [panicDiceStripHover, setPanicDiceStripHover] = useState(false);
  const [panicDiceResultsHover, setPanicDiceResultsHover] = useState(false);
  const [panicClashOpen, setPanicClashOpen] = useState(false);
  /** Avoid scheduling duplicate timers (React Strict dev double-mount clears the first timeout). */
  const panicClashPlayedRollIdsRef = useRef<Set<string>>(new Set());
  const [handDragFromIndex, setHandDragFromIndex] = useState<number | null>(null);
  const [handDragHoverIndex, setHandDragHoverIndex] = useState<number | null>(null);
  const handHudLayoutRef = useRef<HTMLDivElement>(null);
  const [handHudNeedsStack, setHandHudNeedsStack] = useState(false);
  const handRowRef = useRef<HTMLDivElement>(null);
  const [handRowW, setHandRowW] = useState(400);
  const famineActivePrev = useRef(false);
  const dualSnapRef = useRef({ instanceId, isDual, playerName, roomId, room });
  dualSnapRef.current = { instanceId, isDual, playerName, roomId, room };
  const dualResumeStartedRef = useRef(false);
  const { highVisibilityMode } = usePlayerDisplayPreferences();

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
              if (alive) ingestRoomState(st);
            },
          );
        } else {
          await serviceRef.current.resumeDualGuest(
            { roomId: snap.roomId, myUid: snap.myUid, playerName: snap.playerName },
            (st) => {
              if (alive) ingestRoomState(st);
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

  useEffect(() => {
    serviceRef.current.onDiceTestRollEvent((payload) => {
      setHudDiceRoll(payload);
    });
    return () => {
      serviceRef.current.onDiceTestRollEvent(null);
    };
  }, []);

  useEffect(() => {
    if (room?.status !== 'results') setPanicClashOpen(false);
    if (room?.status === 'playing') panicClashPlayedRollIdsRef.current.clear();
  }, [room?.status]);

  useEffect(() => {
    const fx = room?.lastOutcome?.panicFx;
    if (!fx || room?.status !== 'results') return;
    if (panicClashPlayedRollIdsRef.current.has(fx.diceRollId)) return;
    /** After dice HUD fade (~4.7s) — show scripted panic exchange before recap. */
    const delayMs = 4600;
    const tid = window.setTimeout(() => {
      if (panicClashPlayedRollIdsRef.current.has(fx.diceRollId)) return;
      panicClashPlayedRollIdsRef.current.add(fx.diceRollId);
      setPanicClashOpen(true);
    }, delayMs);
    return () => window.clearTimeout(tid);
  }, [room?.lastOutcome?.panicFx?.diceRollId, room?.status]);

  const handLenForFan = room?.players?.[myUid]?.hand?.length ?? 0;
  const fanSqueeze = useMemo(
    () => computeHandFanSqueeze(handLenForFan, Math.max(240, handRowW), 'wide'),
    [handLenForFan, handRowW],
  );

  useEffect(() => {
    const el = handRowRef.current;
    if (!el) return;
    let roRaf = 0;
    const apply = () =>
      setHandRowW(el.clientWidth || Math.max(240, Math.floor(window.innerWidth * 0.82)));
    const update = () => {
      cancelAnimationFrame(roRaf);
      roRaf = requestAnimationFrame(apply);
    };
    apply();
    const raf = requestAnimationFrame(apply);
    let ro: ResizeObserver | null = null;
    const hasRO = typeof ResizeObserver !== 'undefined';
    if (hasRO) {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(roRaf);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, [room?.status, handLenForFan]);

  const cardArtCtx = useOptionalCardArt();
  const cardArtForUi = useMemo(() => {
    if (!cardArtCtx) return null;
    if (!room) return cardArtCtx;
    const isHostAtTable = room.hostUid === myUid || serviceRef.current.getIsHost();
    return mergeCardArtWithRoom(cardArtCtx, room, isHostAtTable);
  }, [cardArtCtx, room, room?.cardArtSession, room?.updatedAt, myUid]);
  const displayCardArt = useMemo(() => {
    if (!cardArtForUi) return null;
    if (highVisibilityMode) return { ...cardArtForUi, mode: 'vector' as const };
    return cardArtForUi;
  }, [cardArtForUi, highVisibilityMode]);

  const handUniformRasterScale = useMemo(() => {
    if (!displayCardArt || displayCardArt.mode !== 'raster') return undefined;
    void layoutScaleBump;
    const rootPx =
      typeof document !== 'undefined'
        ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
        : 16;
    const slotW = 7.2 * rootPx;
    const slotH = 10.8 * rootPx;
    return Math.min(1, slotW / CARD_ART_WIDTH, slotH / CARD_ART_HEIGHT);
  }, [displayCardArt?.mode, layoutScaleBump]);

  useEffect(() => {
    if (!cashShopOpen) return;
    const browsers = Array.isArray(room?.cardShopBrowsersUids) ? room.cardShopBrowsersUids : [];
    if (browsers.includes(myUid)) {
      cashShopPresencePendingRef.current = false;
    }
  }, [room?.cardShopBrowsersUids, cashShopOpen, myUid]);

  useEffect(() => {
    if (!room) return;
    if (['waiting', 'drafting', 'finished'].includes(room.status) || !room.settings.enablePokerChips) {
      cashShopPresencePendingRef.current = false;
      void serviceRef.current.setCardShopOpen(false);
      setCashShopOpen(false);
    }
  }, [room?.status, room?.settings?.enablePokerChips]);

  const deckBackRasterUrl = useMemo(() => {
    if (displayCardArt?.mode !== 'raster') return null;
    const m = displayCardArt?.manifest?.['back-deck'];
    const fromManifest =
      m?.customDataUrl ?? (m?.customImageFile?.trim() ? cardArtAssetUrl(m.customImageFile.trim()) : null);
    return fromManifest ?? shippedPlayingCardBackRasterUrl('back-deck');
  }, [displayCardArt?.mode, displayCardArt?.manifest, displayCardArt?.manifestVersion]);

  useEffect(() => {
    if (!displayCardArt || displayCardArt.mode !== 'raster') return;
    warmCardArtImages(displayCardArt.manifest);
  }, [displayCardArt?.mode, displayCardArt?.manifestVersion]);

  /** Warm raster assets in lobby so artwork is ready when the round starts (skipped for High Visibility / vector). */
  useEffect(() => {
    if (!room || room.status !== 'waiting') return;
    if (highVisibilityMode || !cardArtForUi || cardArtForUi.mode !== 'raster') return;
    warmCardArtImages(cardArtForUi.manifest);
  }, [
    room?.status,
    room?.cardArtSession?.seq,
    room?.updatedAt,
    highVisibilityMode,
    cardArtForUi?.mode,
    cardArtForUi?.manifestVersion,
  ]);

  useEffect(() => {
    if (!room || room.status === 'waiting') return;
    void import('@3d-dice/dice-box-threejs');
  }, [room?.status]);

  const handleCreateRoom = async () => {
    if (!playerName) { setError('Please enter your name'); return; }
    setLoading(true);
    setError(null);
    wipeDualReconnectSnapshots();
    try {
      const id = await serviceRef.current.createRoom(playerName, (state) => {
        ingestRoomState(state);
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
        ingestRoomState(state);
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

  const reorderMyHandSlots = useCallback(
    async (from: number, to: number) => {
      if (!room?.players[myUid] || loading) return;
      const player = room.players[myUid];
      if (player.confirmed) return;
      if (from === to || from < 0 || to < 0 || from >= player.hand.length || to >= player.hand.length) return;

      const oldHand = player.hand;
      const newOrder = reorderHandSlots(oldHand, from, to);
      setSelectedCardIndex((prev) =>
        prev === null || prev < 0 ? prev : handIndexAfterReorder(oldHand, newOrder, prev),
      );
      try {
        await serviceRef.current.reorderHand(newOrder);
      } catch (err: any) {
        setError(err?.message ?? String(err ?? 'Failed to reorder hand'));
      }
    },
    [room, myUid, loading],
  );

  /** Must run before any conditional returns — otherwise lobby → table changes hook count (React #310). */
  const confirmPanicDiceUse = useCallback(async () => {
    setLoading(true);
    try {
      await serviceRef.current.usePanicDice();
      setPanicDiceConfirmOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Panic dice failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissPanicClash = useCallback(
    (reason: PanicClashDismissReason) => {
      setPanicClashOpen(false);
      if (reason !== 'complete' || room?.status !== 'results') return;
      setResolutionReplayNonce((n) => n + 1);
      setShowResolutionSequence(true);
    },
    [room?.status],
  );

  /** Must run before any conditional return — same rule as other table hooks (React #310). */
  useLayoutEffect(() => {
    const el = handHudLayoutRef.current;
    const mePlayer = room?.players?.[myUid];
    if (!el || !room || !mePlayer || room.status === 'waiting') return;

    const fanSqueeze = 1;
    const handCardWidth = 115.2;
    const handOverlap = 36;
    const fanWidthPx =
      mePlayer.hand.length > 0
        ? mePlayer.hand.length * handCardWidth - Math.max(0, mePlayer.hand.length - 1) * handOverlap
        : 0;
    const powerCardWidth = 115.2;
    const powerOverlap = 24;
    const powerCount = mePlayer.powerCards.length;
    const powerBlockWidth =
      powerCount > 0 ? powerCount * powerCardWidth - Math.max(0, powerCount - 1) * powerOverlap : 0;
    const panicStripVisible =
      room.settings.enablePanicDice &&
      panicDiceSeatAllowed(room, myUid) &&
      (room.status === 'playing' || room.status === 'powering');

    const measure = () => {
      const cw = el.clientWidth;
      const cappedPowerW = Math.min(powerBlockWidth, 340);
      const panicReserve = panicStripVisible ? 128 : 0;
      const powerReserve = powerCount > 0 ? Math.round(cappedPowerW + 56) : 0;
      const gapReserve =
        ((powerCount > 0 ? 1 : 0) + (panicStripVisible ? 1 : 0)) * 28 + 40;
      const need = powerReserve + fanWidthPx + panicReserve + gapReserve;
      /** Keep 3-column [powers · hand · panic] unless the viewport is very narrow or genuinely overflowed */
      const veryNarrow = cw < 400;
      setHandHudNeedsStack(veryNarrow || need > cw + 112);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    room,
    myUid,
    handRowW,
    room?.status,
    room?.settings?.enablePanicDice,
    room?.players,
  ]);

  const pokerChipShopBrowsers = Array.isArray(room?.cardShopBrowsersUids) ? room.cardShopBrowsersUids : [];
  const shopCursorBroadcastEnabled =
    cashShopOpen &&
    room?.settings?.enablePokerChips === true &&
    pokerChipShopBrowsers.includes(myUid) &&
    pokerChipShopBrowsers.length >= 2;

  /** Before conditional returns — lobby → table would change hook count (React #310). */
  useShopCursorBroadcast(shopCursorBroadcastEnabled, (nx, ny) => {
    serviceRef.current.sendShopCursor(nx, ny);
  });

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

  const activePowerCardId = selectedPowerCard ?? room?.players?.[myUid]?.currentPowerCard ?? null;

  const handleTogglePowerCard = (powerId: number) => {
    if (
      room &&
      room.settings.enableCurseCards !== false &&
      curseEffectActive(room.activeCurses) &&
      isCurseCardId(powerId)
    ) {
      return;
    }
    if (activePowerCardId === powerId) {
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
      const fullName = isJoker ? 'The Joker' : `${suit === 'Crowns' ? displaySuitCardValue(suit, value) : value} of ${suit}`;
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
      <div className="relative h-full flex items-center justify-center p-4">
        <div className="absolute right-4 top-4 z-10">
          <PlayerSettingsMenu />
        </div>
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
    <div className="relative h-full flex items-center justify-center text-emerald-400 text-[10px] font-mono animate-pulse">
      <div className="absolute right-3 top-3 z-10">
        <PlayerSettingsMenu />
      </div>
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
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <PlayerSettingsMenu />
                  </div>
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
  const handCardWidth = 115.2;
  const handOverlap = 36;
  const fanWidthPx =
    me.hand.length > 0 ? me.hand.length * handCardWidth - Math.max(0, me.hand.length - 1) * handOverlap : 0;
  const fanOverflowPx = Math.max(0, Math.round((fanWidthPx - handRowW) / 2));
  const powerCardWidth = 115.2;
  const powerOverlap = 24;
  const powerCount = me.powerCards.length;
  const powerBlockWidth =
    powerCount > 0 ? powerCount * powerCardWidth - Math.max(0, powerCount - 1) * powerOverlap : 0;
  const powerClearancePx = powerCount > 0 ? Math.min(220, fanOverflowPx) : 0;
  const handPowerGapPx = 40 + Math.min(220, fanOverflowPx);

  const opponentUid = Object.keys(room.players).find(uid => uid !== myUid);
  const opponent = opponentUid ? room.players[opponentUid] : null;

  const tableShopBrowsers = Array.isArray(room.cardShopBrowsersUids) ? room.cardShopBrowsersUids : [];
  const showOpponentShopCursor = Boolean(
    room.settings.enablePokerChips &&
      cashShopOpen &&
      opponent &&
      tableShopBrowsers.length >= 2 &&
      tableShopBrowsers.includes(myUid) &&
      tableShopBrowsers.includes(opponent.uid) &&
      room.shopRemoteCursor &&
      room.shopRemoteCursor.uid !== myUid,
  );

  const panicDiceStripVisible =
    room.settings.enablePanicDice &&
    panicDiceSeatAllowed(room, myUid) &&
    (room.status === 'playing' || room.status === 'powering');

  const panicDiceStripInteractive = panicDiceStripVisible && !me.panicDiceUsed;

  const panicDiceResultsVisible =
    room.status === 'results' &&
    Boolean(room.lastOutcome) &&
    room.settings.enablePanicDice &&
    panicDiceSeatAllowed(room, myUid) &&
    !me.readyForNextRound;

  const panicDiceResultsInteractive = panicDiceResultsVisible && !me.panicDiceUsed;
  const panicDiceResultsUsedVisible =
    room.status === 'results' &&
    Boolean(room.lastOutcome) &&
    room.settings.enablePanicDice &&
    panicDiceSeatAllowed(room, myUid) &&
    !me.readyForNextRound &&
    me.panicDiceUsed;

  const panicStripHoverText = me.panicDiceUsed ? PANIC_DICE_USED_HOVER : PANIC_DICE_STRIP_HOVER_HELP;
  const panicStripFootnote = me.panicDiceUsed ? 'Used this game' : 'Locked until results';

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
  const curseSelectionLocked =
    room.settings.enableCurseCards !== false && curseEffectActive(room.activeCurses);

  const hudPhaseLine =
    room.status === 'powering'
      ? powerShowdown
        ? 'Cards locked — choose power effects'
        : 'Resolving power cards…'
      : null;

  const artworkFelt = displayCardArt?.mode === 'raster';

  return (
    <CardArtSessionBridge room={room} myUid={myUid} serviceRef={serviceRef}>
    <DisplayCardArtModeOverride highVisibilityMode={highVisibilityMode}>
    <div
      className={`relative flex h-full min-h-0 flex-col overflow-x-visible overflow-y-hidden border-x border-emerald-900/50 px-5 py-4 sm:px-7 ${
        artworkFelt ? 'bg-emerald-950/25' : 'bg-emerald-950/40'
      }`}
      style={
        artworkFelt
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(2, 44, 34, 0.5), rgba(2, 44, 34, 0.78)), url(${cardArtAssetUrl('Background.png')})`,
              backgroundSize: 'cover, cover',
              backgroundPosition: 'center, center',
            }
          : undefined
      }
    >
      <ActiveCurseBackgroundTints
        enabled={Boolean(artworkFelt && room.settings.enableCurseCards !== false)}
        activeCurses={room.activeCurses}
      />
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
      <DiceBoxTestOverlay roll={hudDiceRoll} />
      {room.settings.enablePokerChips &&
        (room.status === 'playing' || room.status === 'powering' || room.status === 'results') && (
          <>
            <ChipDropperTest
              room={room}
              myUid={myUid}
              selfBalance={me.tokenBalance ?? 0}
              opponentBalance={opponent ? opponent.tokenBalance ?? 0 : 0}
              highlightSelfTokens={cashShopBtnHover}
              selfTokensHoldCaption={HUD_HOLD_PLAYER_TOKENS_CAPTION}
              opponentTokensHoldCaption={HUD_HOLD_OPPONENT_TOKENS_CAPTION}
            />
            {cashShopOpen && room.cardShop ? (
              <CardShopModal
                cardShop={room.cardShop}
                tokenBalance={me.tokenBalance ?? 0}
                onBuy={(slotId) => void serviceRef.current.buyCardShopSlot(slotId)}
                onClose={() => {
                  cashShopPresencePendingRef.current = false;
                  setCashShopOpen(false);
                  void serviceRef.current.setCardShopOpen(false);
                }}
                purchaseMode={room.settings.cardShopConflictMode ?? 'coin_flip'}
                pendingPurchases={room.pendingCardShopPurchases ?? null}
                myUid={myUid}
              />
            ) : null}
            <ShopOpponentCursorOverlay
              visible={showOpponentShopCursor}
              nx={room.shopRemoteCursor?.nx ?? 0}
              ny={room.shopRemoteCursor?.ny ?? 0}
              opponentRole={opponent?.role ?? 'Prey'}
            />
          </>
        )}

      {(() => {
        const hudDockPhases = room.status === 'playing' || room.status === 'powering';
        const showDockCashBtn =
          room.settings.enablePokerChips && Boolean(room.cardShop) && hudDockPhases;
        const showDockPlayBtn = room.status === 'playing';
        if (!showDockCashBtn && !showDockPlayBtn) return null;
        const selectedCard = selectedCardIndex !== null ? me.hand[selectedCardIndex] ?? null : null;
        const playBlocked =
          !selectedCard ||
          (selectedCard != null &&
            (prideBlocksCard(room, myUid, selectedCard) ||
              envySealBlocksHandIndex(room, myUid, me.hand, selectedCardIndex!)));
        const playActionLocked = loading || me.confirmed || playBlocked;
        const playMuted =
          me.confirmed || !selectedCard || playBlocked || loading;
        const playReadyStyle =
          !playMuted && selectedCard
            ? 'rounded-xl border-2 border-amber-500/90 bg-amber-400/95 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-950 shadow-[0_8px_26px_rgba(0,0,0,0.38)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] sm:px-8 sm:py-3 sm:text-[11px]'
            : 'rounded-xl border-2 border-slate-600/80 bg-slate-800/90 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 shadow-none transition-[filter,transform] sm:px-8 sm:py-3 sm:text-[11px]';
        let playLabel = 'Play card';
        if (me.confirmed) playLabel = 'Waiting for opponent';
        else if (selectedCard && selectedPowerCard !== null) {
          playLabel = isCurseCardId(selectedPowerCard) ? 'Play card & curse' : 'Play card & power';
        }
        return (
          <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[486] flex justify-center px-3 pb-[env(safe-area-inset-bottom,0px)] sm:bottom-6">
            <div className="pointer-events-auto relative flex h-[3.5rem] w-full max-w-[min(100vw-1.5rem,52rem)] items-center justify-center sm:h-[3.9rem]">
              {showDockPlayBtn ? (
                <button
                  type="button"
                  onClick={() => void handlePlayCard()}
                  disabled={playActionLocked}
                  className={`${playReadyStyle} disabled:pointer-events-none disabled:opacity-50`}
                >
                  {playLabel}
                </button>
              ) : null}
              {showDockCashBtn ? (
                <button
                  type="button"
                  disabled={me.confirmed}
                  onMouseEnter={() => setCashShopBtnHover(true)}
                  onMouseLeave={() => setCashShopBtnHover(false)}
                  onFocus={() => setCashShopBtnHover(true)}
                  onBlur={() => setCashShopBtnHover(false)}
                  onClick={() => {
                    cashShopPresencePendingRef.current = true;
                    setCashShopOpen(true);
                    void serviceRef.current.setCardShopOpen(true);
                  }}
                  className={`${HUD_TABLE_ACTION_BTN} absolute right-0 top-1/2 -translate-y-1/2 disabled:pointer-events-none disabled:opacity-40 disabled:grayscale`}
                >
                  Cash Chips
                </button>
              ) : null}
            </div>
          </div>
        );
      })()}

      {panicDiceStripExplainOpen && (
        <div
          className="fixed inset-0 z-[458] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Panic dice information"
          onClick={() => setPanicDiceStripExplainOpen(false)}
        >
          <div
            className="max-w-md rounded-2xl border border-amber-900/55 bg-slate-950 p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-400">Panic dice</p>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-100">
              {PANIC_DICE_STRIP_CLICK_HELP}
            </p>
            <button
              type="button"
              className="mt-5 rounded-xl border border-slate-600 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-800"
              onClick={() => setPanicDiceStripExplainOpen(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {panicDiceConfirmOpen && (
        <div
          className="fixed inset-0 z-[460] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm panic dice"
        >
          <div className="max-w-md rounded-2xl border border-amber-900/50 bg-slate-950 p-6 shadow-[0_0_60px_rgba(0,0,0,0.55)]">
            <p className="text-[11px] font-black uppercase tracking-widest text-amber-400">Panic dice</p>
            <p className="mt-3 text-sm font-semibold leading-snug text-slate-100">
              Are you sure you want to use your panic dice? They can only be used once. The result of your panic dice
              roll will chip away at your opponent&apos;s committed clash rank and the round winner is rechecked from
              the frozen tableau (powers do not fire again).
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => setPanicDiceConfirmOpen(false)}
                className="rounded-xl border border-slate-600 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void confirmPanicDiceUse()}
                className="rounded-xl border border-amber-500/70 bg-amber-600/90 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-amber-950 hover:bg-amber-500 disabled:opacity-40"
              >
                Yes, roll
              </button>
            </div>
          </div>
        </div>
      )}

      {!powerShowdown && room.status === 'powering' && myPendingDecision && myPendingDecision.selectedOption === null && (
        <PowerDecisionModal
          compactPane={Boolean(isDual)}
          decision={myPendingDecision}
          priestessLockedCard={myPendingDecision.powerCardId === 2 ? (room.engageMoves?.[myUid] ?? me.currentMove ?? null) : null}
          priestessHand={myPendingDecision.powerCardId === 2 ? me.hand : []}
          tableSuit={room.targetSuit ?? null}
          curseHoldsTable={room.settings.enableCurseCards !== false && curseEffectActive(room.activeCurses)}
          onSubmit={handleSubmitPowerDecision}
        />
      )}

      {opponent && <RoomChat room={room} myUid={myUid} serviceRef={serviceRef} />}

      {isDevMenuOpen && (
        <DevPowerMenu 
          onSelect={(id) => serviceRef.current.cheatPowerCard(id)} 
          onClose={() => setIsDevMenuOpen(false)} 
          onOpenAnimationPreview={() => {
            window.location.hash = '#card-anim-preview';
          }}
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

      {room.settings.enableDesperation &&
        (room.status === 'playing' || room.status === 'powering' || room.status === 'results') && (
          <div className="mb-2 flex w-full justify-center px-1">
            {room.settings.hostRole === 'Preydator' && opponent ? (
              <div className="flex w-full max-w-[min(100%,34rem)] items-stretch justify-center gap-2 rounded-xl border border-purple-800/55 bg-purple-950/55 px-2 py-1.5 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12)]">
                {[me, opponent].map((p) => (
                  <div key={`tier-top-${p.uid}`} className="min-w-0 flex-1 rounded-lg border border-purple-700/40 bg-purple-900/35 px-2 py-1 text-center">
                    <span className="block truncate text-[9px] font-black uppercase tracking-wide text-purple-200/95">
                      {p.name}: {desperationLadderLabel(room.settings.tiers, p.desperationTier) ?? 'Off ladder'}
                    </span>
                  </div>
                ))}
              </div>
            ) : desperationSpinAllowed(room, myUid, me) ? (
              <div className="mx-auto flex w-full max-w-md min-h-[2.3rem] flex-col items-center justify-center rounded-xl border border-purple-800/55 bg-purple-950/55 px-4 py-1.5 text-center shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12)]">
                <span className="max-w-full text-[10px] font-black uppercase leading-snug tracking-widest text-purple-200/95">
                  {me.name}: {desperationLadderLabel(room.settings.tiers, me.desperationTier) ?? 'Off ladder'}
                </span>
              </div>
            ) : null}
          </div>
        )}

      {/* Opponent desperation strip: top HUD center (napkin div7). */}
      {/* HUD: room / role · phase strip (center) · dev & rules */}
      <div className="mb-3 grid w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-2 gap-y-1 [@media(max-height:1100px)]:mb-1">
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
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2 justify-self-end sm:gap-4">
          <PlayerSettingsMenu />
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
          className={`relative mb-3 flex w-full flex-col px-1 [@media(max-height:1100px)]:mb-1 ${
            room.settings.enableDesperation || opponentWheelDecisionSpinning ? 'min-h-[11.5rem]' : ''
          } ${opponentWheelDecisionSpinning ? 'min-h-[17rem] sm:min-h-[18.5rem]' : ''}`}
        >
          <div className="mb-1 flex w-full items-center justify-between gap-2 [@media(max-height:1100px)]:mb-0">
            <span className="flex-1 text-center text-[10px] font-black uppercase tracking-widest text-emerald-500">
              Cards: {opponent.hand.length}
            </span>
          </div>
          <div className="flex w-full items-start justify-between gap-2">
            <HoldDelayTooltip caption={HUD_HOLD_OPPONENT_HAND_CAPTION} className="flex min-w-0 flex-1 flex-col">
              <div className="mx-auto flex h-[13rem] w-max max-w-full flex-nowrap items-end justify-center overflow-x-visible -space-x-9 px-2 opacity-80 scale-90 sm:h-[13.5rem] sm:-space-x-14 sm:scale-100 [@media(max-height:1100px)]:h-[10.5rem] [@media(max-height:1100px)]:sm:h-[11rem] [@media(max-height:1100px)]:scale-[0.82] [@media(max-height:1100px)]:sm:scale-90">
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
            </HoldDelayTooltip>
            <HoldDelayTooltip
              caption={HUD_HOLD_OPPONENT_POWERS_CAPTION}
              className="flex max-w-full shrink-0 flex-row flex-wrap items-end justify-end gap-x-4 gap-y-2 overflow-visible py-1 pr-1 opacity-80 sm:flex-nowrap sm:gap-x-6"
            >
              {opponent.powerCards.map((pid, i) => (
                <div key={`opp-p-${pid}-${i}`} className="flex shrink-0 flex-none justify-center">
                  <PowerCardVisual cardId={pid} revealed={false} small staticBackdrop />
                </div>
              ))}
            </HoldDelayTooltip>
          </div>
        </div>
      )}

      {/* Table grid: opp row · deck column share one rail — no overlapping absolutes */}
      <div className="relative z-[20] isolate flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-x-visible overflow-y-auto overscroll-y-contain sm:gap-3">
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
            <div className="grid min-h-0 w-full max-w-full flex-1 grid-cols-[minmax(0,15.6rem)_minmax(0,1fr)_minmax(7.8rem,11.4rem)] grid-rows-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 px-1 transition-all duration-500 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(9rem,13.5rem)] sm:gap-x-3 md:gap-y-1.5 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(10rem,15rem)]">
              {/* Row 1 napkin sketch: spacer | opp hand | opp powers — deck stacks row2 col3 */}
              <div className="hidden min-h-[0.125rem] sm:col-start-1 sm:row-start-1 sm:block" aria-hidden />
              <div
                className={`relative col-span-full flex min-h-0 min-w-0 flex-col items-center justify-self-center sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:w-full sm:max-w-[min(100%,min(94vw,44rem))] md:max-w-[min(100%,min(92vw,52rem))] xl:max-w-[min(100%,min(92vw,64rem))] [@media(max-height:1100px)]:scale-[0.9] [@media(max-height:1100px)]:origin-top ${
                  opponentWheelDecisionSpinning ? 'min-h-[10rem] sm:min-h-[12rem]' : 'min-h-[11rem] sm:min-h-[12rem]'
                } [@media(max-height:1100px)]:min-h-[9.25rem] [@media(max-height:1100px)]:sm:min-h-[10.25rem]`}
              >
                {room.settings.enablePokerChips && tableShopBrowsers.includes(opponent.uid) ? (
                  <div className="pointer-events-none absolute inset-0 z-[36] flex items-center justify-center rounded-2xl bg-black/55 px-3 backdrop-blur-[2px]">
                    <span className="max-w-[16rem] text-center text-[11px] font-black uppercase leading-snug tracking-widest text-amber-200 shadow-black/60 drop-shadow-md">
                      Opponent is browsing the shop
                    </span>
                  </div>
                ) : null}
                <HoldDelayTooltip caption={HUD_HOLD_OPPONENT_HAND_CAPTION} className="relative flex min-h-0 w-full min-w-0 flex-col items-center">
                <div className="mb-1 text-center [@media(max-height:1100px)]:mb-0">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                    Cards: {opponent.hand.length}
                  </span>
                       </div>
                <div className="flex h-[13rem] w-full min-w-0 items-end justify-center gap-1.5 px-2 opacity-[0.82] sm:h-[13.5rem] sm:gap-2 sm:px-4 sm:opacity-95 [@media(max-height:1100px)]:h-[10.75rem] [@media(max-height:1100px)]:sm:h-[11.25rem]">
                  {room.status === 'playing' &&
                    room.settings.enableCurseCards &&
                    envyCurseActive(room.activeCurses ?? []) &&
                    room.envyCovet &&
                    room.envyCovet.uid === opponent.uid && (
                      <motion.div
                        className="pointer-events-none flex shrink-0 flex-col items-center justify-center opacity-[0.44]"
                        initial={{ opacity: 0.44 }}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 1.14, repeat: Infinity, ease: 'easeInOut' }}
                        title={`Green-Eyed Monster covets ${describeCardPlain(room.envyCovet.cardId)} in ${opponent.name}'s hand`}
                      >
                        <GreenEyedMonsterIcon className="h-[2.85rem] w-[4rem] sm:h-12 sm:w-[4.7rem]" />
                        <span className="mt-0.5 max-w-[4.25rem] text-center text-[5.5px] font-black uppercase leading-tight tracking-wide text-emerald-400/95">
                          Covets their hand
                        </span>
                      </motion.div>
                    )}
                  <div className="mx-auto flex w-max max-w-full min-w-0 flex-nowrap items-center justify-center -space-x-8 sm:-space-x-12">
                    {Array.from({ length: opponent.hand.length }).map((_, i) => (
                      <CardVisual key={`og-${i}`} card="" revealed={false} disabled role={opponent.role} delay={i * 0.08} />
                ))}
              </div>
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
                </HoldDelayTooltip>
                {opponent.powerCards.length > 0 ? (
                  <HoldDelayTooltip
                    caption={HUD_HOLD_OPPONENT_POWERS_CAPTION}
                    className="pointer-events-auto absolute right-0 top-3 z-[37] hidden flex-row gap-2 sm:flex sm:items-start sm:pr-1"
                  >
                    {opponent.powerCards.map((pid, i) => (
                      <div key={`ogr-float-${pid}-${i}`} className="flex shrink-0 flex-none justify-center">
                        <PowerCardVisual cardId={pid} revealed={false} small staticBackdrop />
                      </div>
                    ))}
                  </HoldDelayTooltip>
                ) : null}
            </div>
              <HoldDelayTooltip
                caption={HUD_HOLD_OPPONENT_POWERS_CAPTION}
                className="col-span-full flex min-h-[3.5rem] flex-row flex-wrap justify-center gap-x-4 gap-y-2 self-start overflow-visible py-2 pt-3 opacity-95 sm:hidden"
              >
                {opponent.powerCards.map((pid, i) => (
                  <div key={`ogr-${pid}-${i}`} className="flex shrink-0 flex-none justify-center">
                    <PowerCardVisual cardId={pid} revealed={false} small staticBackdrop />
                  </div>
                ))}
              </HoldDelayTooltip>

              <aside className="relative z-[6] col-span-full flex min-h-min w-full min-w-0 flex-col items-center gap-2 overflow-visible pb-2 pt-1 sm:col-span-1 sm:col-start-1 sm:row-start-2 sm:w-full sm:max-w-[15rem] sm:justify-self-start sm:self-stretch sm:pb-3">
                <div className="flex w-full shrink-0 flex-col items-stretch overflow-visible px-0.5 py-2">
                  <CurseZonePanel
                    settings={room.settings}
                    activeCurses={room.activeCurses}
                    prideCeilingCard={room.prideCeilingCard}
                    wrathMinionCard={room.wrathMinionCard}
                  />
                 </div>
              </aside>

              <div className="relative z-0 col-span-full flex min-h-0 min-w-0 flex-col items-center justify-self-center rounded-3xl px-1 pb-2 pt-1 sm:col-span-1 sm:col-start-2 sm:row-start-2 sm:w-full sm:max-w-[min(100%,min(94vw,44rem))] md:max-w-[min(100%,min(92vw,52rem))] xl:max-w-[min(100%,min(92vw,64rem))] sm:px-3">
                <div className="relative z-10 flex w-full min-w-0 flex-col items-center">
               {room.status === 'playing' &&
                 room.settings.enableCurseCards &&
                 envyCurseActive(room.activeCurses ?? []) &&
                 room.envyCovet &&
                 room.players[room.envyCovet.uid] && (
                   <p className="mb-2 max-w-[min(100%,26rem)] px-3 text-center text-[10px] font-black uppercase leading-snug tracking-wide text-emerald-300/95 drop-shadow-[0_0_14px_rgba(16,185,129,0.22)]">
                     Green-Eyed Monster covets {describeCardPlain(room.envyCovet.cardId)} from{' '}
                     {room.players[room.envyCovet.uid].name}.
                   </p>
                 )}
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
                       <HoldDelayTooltip
                         caption={HUD_HOLD_TARGET_SUIT_CAPTION}
                         className="flex flex-col items-center"
                       >
                         <CompactTableGlyphRow suit={room.targetSuit} greedJointTrump={greedJointTrumpUi} />
                       </HoldDelayTooltip>
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
                         {room.settings.enableCurseCards &&
                           envyCurseActive(room.activeCurses ?? []) &&
                           room.envyCovet &&
                           room.envyCovet.uid === myUid &&
                           room.envyCovet.cardId === me.currentMove && (
                             <motion.div
                               className="pointer-events-none absolute top-0 left-1/2 z-[41] flex -translate-x-1/2 flex-col items-center gap-0.5"
                               initial={{ y: -2, opacity: 1 }}
                               animate={{ y: [0, -7, 0] }}
                               transition={{ y: { repeat: Infinity, duration: 1.12, ease: 'easeInOut' } }}
                             >
                               <GreenEyedMonsterIcon className="h-11 w-[5.35rem] opacity-95 drop-shadow-[0_0_20px_rgba(16,185,129,0.48)] sm:h-12 sm:w-[5.85rem]" />
                               <span className="text-[7px] font-black uppercase tracking-wider text-emerald-400/95">
                                 Coveted
                               </span>
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
                         {room.settings.enableCurseCards &&
                           envyCurseActive(room.activeCurses ?? []) &&
                           room.envyCovet &&
                           room.envyCovet.uid === opponent.uid &&
                           room.envyCovet.cardId === opponent.currentMove && (
                             <motion.div
                               className="pointer-events-none absolute top-0 left-1/2 z-[41] flex -translate-x-1/2 flex-col items-center gap-0.5"
                               initial={{ y: -2, opacity: 1 }}
                               animate={{ y: [0, -7, 0] }}
                               transition={{ y: { repeat: Infinity, duration: 1.12, ease: 'easeInOut' } }}
                             >
                               <GreenEyedMonsterIcon className="h-11 w-[5.35rem] opacity-95 drop-shadow-[0_0_20px_rgba(16,185,129,0.48)] sm:h-12 sm:w-[5.85rem]" />
                               <span className="text-[7px] font-black uppercase tracking-wider text-emerald-400/95">
                                 Coveted
                               </span>
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
                     <HoldDelayTooltip caption={HUD_HOLD_TARGET_SUIT_CAPTION} className="flex justify-center">
                       <TargetSuitWheel
                         suit={room.status === 'results' ? (room.lastOutcome?.targetSuit || room.targetSuit) : room.targetSuit}
                         isSpinning={isWheelSpinning}
                         offset={room.wheelOffset}
                         availableSuits={room.availableSuits}
                         lustTripleHearts={lustTripleWheel}
                         greedHalveBasicSuits={greedHalveWheel}
                         greedJointDiamondCoinGlyphs={greedHalveWheel}
                         artworkTable={artworkFelt}
                       />
                     </HoldDelayTooltip>
                   </motion.div>
                 ) : (
                   <motion.div
                     key="target-card"
                     initial={{ opacity: 0, rotateY: 90 }}
                     animate={{ opacity: 1, rotateY: 0 }}
                     className="flex flex-col items-center gap-3"
                   >
                     <HoldDelayTooltip caption={HUD_HOLD_TARGET_SUIT_CAPTION} className="flex flex-col items-center gap-3">
                     {(() => {
                       const ts = (room.status === 'results'
                         ? room.lastOutcome?.targetSuit || room.targetSuit
                         : room.targetSuit) as Suit | null;
                       const greedActive =
                         room.settings.enableCurseCards && greedCurseActive(room.activeCurses ?? []);
                       const joint = jointTableTrumpPair(ts, { greedActive });
                       const envyCovetPlaying =
                         room.status === 'playing' &&
                         room.settings.enableCurseCards &&
                         envyCurseActive(room.activeCurses ?? []) &&
                         room.envyCovet;
                       return (
                         <>
                           {envyCovetPlaying && room.envyCovet && room.players[room.envyCovet.uid] && (
                             <div className="mb-2 flex flex-col items-center gap-2">
                               <GreenEyedMonsterIcon className="h-14 w-[6.25rem] shadow-[0_12px_36px_rgba(16,185,129,0.35)] sm:h-16 sm:w-[7rem]" />
                               <div className="pointer-events-auto origin-center scale-[0.42] drop-shadow-[0_10px_28px_rgba(16,185,129,0.35)]">
                                 <CardVisual
                                   card={room.envyCovet.cardId}
                                   revealed
                                   small
                                   noAnimate
                                   presentation="none"
                                   detailTooltip={`Coveted from ${room.players[room.envyCovet.uid].name}'s hand — play this suit card to feed the monster.`}
                                 />
                               </div>
                               <span className="max-w-[18rem] px-2 text-center text-[9px] font-bold uppercase tracking-wide text-emerald-400/95">
                                 Prey · {room.players[room.envyCovet.uid].name}
                        </span>
                     </div>
                           )}
                           {joint ? (
                             <DualTableTrumpCard suits={joint} />
                           ) : ts ? (
                             displayCardArt?.mode === 'raster' ? (
                               <div
                                 className={`
                         relative flex h-[9.75rem] w-[6.75rem] flex-col items-center justify-center overflow-hidden rounded-2xl border-4 border-amber-700/85 shadow-[0_0_40px_rgba(251,191,36,0.22)]
                         sm:h-[11.75rem] sm:w-[8.125rem]
                       `}
                               >
                                 <img
                                   src={cardArtAssetUrl('GoldCard.png')}
                                   alt=""
                                   draggable={false}
                                   className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
                                 />
                                 <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[size:10px_10px] opacity-[0.12]" />
                                 <div className="relative z-10 flex h-full w-full items-center justify-center p-[10%]">
                                   <SuitRasterOrGlyph
                                     suit={ts}
                                     className="max-h-[min(78%,10.5rem)] max-w-[min(78%,7.5rem)] object-contain drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)] sm:max-h-[min(78%,12.5rem)] sm:max-w-[min(78%,8.5rem)]"
                                   />
                                 </div>
                               </div>
                             ) : (
                               <div
                                 className={`
                         relative flex h-[9.75rem] w-[6.75rem] flex-col items-center justify-center rounded-2xl border-4 border-yellow-200 bg-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.28)]
                         sm:h-[11.75rem] sm:w-[8.125rem]
                       `}
                               >
                                 <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                                   <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[size:10px_10px] opacity-10" />
                                 </div>
                                 <div
                                   className={`relative z-10 ${SUIT_COLORS[ts] ?? 'text-white'} drop-shadow-[0_6px_22px_rgba(0,0,0,0.35)]`}
                                 >
                                   <SuitGlyph
                                     suit={ts}
                                     className="h-[4.75rem] w-[4.75rem] sm:h-[7.25rem] sm:w-[7.25rem]"
                                   />
                                 </div>
                               </div>
                             )
                           ) : (
                             <div
                               className={`
                         relative flex h-[9.75rem] w-[6.75rem] flex-col items-center justify-center rounded-2xl border-4 border-yellow-200 bg-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.28)]
                         sm:h-[11.75rem] sm:w-[8.125rem]
                       `}
                             >
                               <span className="relative z-10 text-5xl font-black text-yellow-950">?</span>
                             </div>
                           )}
                           <span className="pointer-events-none text-center text-[11px] font-black uppercase tracking-[0.12em] sm:text-xs opacity-[0.82]">
                             {joint ? (
                               <DualTrumpTableLabel
                                 suits={joint}
                                 className="uppercase tracking-[0.12em]"
                                 dividerClassName={displayCardArt?.mode === 'raster' ? 'text-slate-300' : 'text-slate-400'}
                                 suitNamesOnGreenFelt={displayCardArt?.mode === 'raster'}
                               />
                             ) : ts ? (
                               <span
                                 className={
                                   displayCardArt?.mode === 'raster' ? tableTrumpSuitNameClass(ts) : SUIT_COLORS[ts] ?? ''
                                 }
                               >
                                 {ts}
                     </span>
                             ) : null}
                           </span>
                         </>
                       );
                     })()}
                     </HoldDelayTooltip>
                   </motion.div>
                 )}
               </AnimatePresence>
               {room.tyrantCrownPending != null && room.settings.enableCurseCards && (
                 <TyrantCrownTablePiece crownTotal={room.tyrantCrownPending.crownTotal} />
               )}
                </div>
              </div>

              <aside className="relative z-0 hidden min-h-0 w-full min-w-0 flex-col items-center justify-between gap-2 pt-1 sm:col-span-1 sm:col-start-3 sm:row-start-2 sm:flex sm:max-w-[min(9rem,calc((100vw-2rem)*0.22))] sm:pt-2">
                <HoldDelayTooltip caption={HUD_HOLD_DECK_CAPTION} className="relative shrink-0">
                <div className="relative group shrink-0">
                  <div className="relative h-[8.4rem] w-[5.88rem] sm:h-[9.6rem] sm:w-[7.32rem]">
                    {deckBackRasterUrl
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="absolute inset-0 overflow-hidden rounded-lg shadow-2xl ring-1 ring-black/25"
                            style={{ transform: `translate(${-i * 2}px, ${-i * 2}px)` }}
                          >
                            <img
                              src={deckBackRasterUrl}
                              alt=""
                              draggable={false}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))
                      : Array.from({ length: 4 }).map((_, i) => (
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
                </HoldDelayTooltip>
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
          {panicClashOpen && room.lastOutcome?.panicFx && (
            <PanicClashResolution room={room} onComplete={dismissPanicClash} />
          )}
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
                  key={`rs-${room.currentTurn}-${resolutionReplayNonce}`}
                  room={room}
                  myUid={myUid}
                  replayNonce={resolutionReplayNonce}
                  onResolutionDiceRoll={setHudDiceRoll}
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
                {room.lastOutcome.devilCurseSpin && (
                  <DevilCurseSpinOverlay
                    offset={room.lastOutcome.devilCurseSpin.offset}
                    curseId={room.lastOutcome.devilCurseSpin.curseId}
                  />
                )}
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
                  {[room.hostUid, Object.keys(room.players).find(id => id !== room.hostUid)!].map((uid, seatIdx) => (
                    <div key={uid} className="flex flex-col items-center gap-3 relative scale-100 sm:scale-110 origin-top">
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
                      <div className="relative inline-block">
                        {room.lastOutcome?.powerCardIdsPlayed?.[uid] != null && (
                          <PowerTuckedUnderSuit side={seatIdx === 0 ? 'left' : 'right'}>
                            <div className="overflow-visible rounded-xl shadow-[0_14px_32px_rgba(0,0,0,0.42)]">
                              <PowerCardVisual
                                cardId={room.lastOutcome!.powerCardIdsPlayed[uid]!}
                                matchHandCard
                                destroyed={Boolean(room.lastOutcome.powerCardTowerBlocked?.[uid])}
                              />
                            </div>
                          </PowerTuckedUnderSuit>
                        )}
                        <div className="relative z-10">
                          <CardVisual
                            card={room.lastOutcome!.cardsPlayed[uid]}
                            revealed
                            presentation="none"
                            noAnimate
                            clashGhost={Boolean(room.lastOutcome.clashDestroyedByPenalty?.[uid])}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center gap-6 w-full max-w-md">
                   <div className="h-px w-full bg-linear-to-r from-transparent via-slate-800 to-transparent" />
                   
                   <p className="text-white text-sm sm:text-lg font-black italic text-center tracking-tight leading-snug">
                     {room.lastOutcome.message}
                   </p>

                   {/* Event Log Display */}
                   <div className="w-full flex flex-col gap-1.5 p-4 rounded-2xl bg-black/40 border border-white/5 max-h-[150px] overflow-y-auto custom-scrollbar">
                     {room.lastOutcome.events.map((evt: ResolutionEvent, i: number) => (
                       <div key={i} className="flex gap-2 text-[9px] uppercase tracking-wider font-bold">
                         <span className="text-slate-600 font-mono">{(i+1).toString().padStart(2, '0')}</span>
                         <span className={resolutionLogLineClass(evt)}>
                           {evt.message}
                         </span>
                       </div>
                     ))}
                   </div>
                   
                   <div className="mt-2 flex flex-nowrap items-center justify-center gap-3 sm:gap-5">
                     <button 
                      onClick={handleNextRound}
                      disabled={loading || me.readyForNextRound}
                      className="group relative bg-yellow-400 text-black px-12 sm:px-20 py-4 sm:py-5 rounded-full font-black uppercase text-sm sm:text-base shadow-[0_0_50px_rgba(250,204,21,0.2)] hover:shadow-[0_0_80px_rgba(250,204,21,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                     >
                       <span className="relative z-10">{me.readyForNextRound ? 'WAITING FOR OTHER...' : 'READY FOR NEXT ROUND'}</span>
                       <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity rounded-full" />
                     </button>
                     {(panicDiceResultsVisible || panicDiceResultsUsedVisible) && (
                      <div className="relative flex shrink-0 flex-col items-center">
                         {panicDiceResultsInteractive ? (
                           <button
                             type="button"
                             onClick={() => setPanicDiceConfirmOpen(true)}
                             title="Use panic dice once per game after the round is resolved."
                             className="group outline-none transition-transform hover:scale-[1.05] active:scale-95"
                           >
                             <img
                               src={cardArtAssetUrl('PanicDice.png')}
                               alt=""
                               draggable={false}
                                className="relative h-[4.4rem] w-auto max-w-[5.8rem] sm:h-[5rem] sm:max-w-[6.5rem] object-contain drop-shadow-[0_14px_28px_rgba(0,0,0,0.55)] transition-[filter] group-hover:brightness-110 group-hover:drop-shadow-[0_0_18px_rgba(251,191,36,0.45)]"
                             />
                             <span className="pointer-events-none block text-center text-[7px] font-black uppercase tracking-widest text-amber-400/95">
                               Use dice
                             </span>
                           </button>
                         ) : (
                           <>
                             <div
                               role="presentation"
                               className="cursor-not-allowed outline-none select-none"
                               onMouseEnter={() => setPanicDiceResultsHover(true)}
                               onMouseLeave={() => setPanicDiceResultsHover(false)}
                               aria-label={PANIC_DICE_USED_HOVER}
                             >
                               <img
                                 src={cardArtAssetUrl('PanicDice.png')}
                                 alt=""
                                 draggable={false}
                                className="pointer-events-none relative h-[4.4rem] w-auto max-w-[5.8rem] sm:h-[5rem] sm:max-w-[6.5rem] object-contain opacity-[0.5] saturate-0 grayscale contrast-95 brightness-110 drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                               />
                             </div>
                             <span className="pointer-events-none mt-0.5 block text-center text-[7px] font-black uppercase tracking-widest text-slate-500">
                               Dice used
                             </span>
                             {panicDiceResultsHover ? (
                               <div
                                 className={`pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-[340] max-w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 ${HUD_INSTANT_TOOLTIP_PANEL_CLASS}`}
                               >
                                 {PANIC_DICE_USED_HOVER}
                               </div>
                             ) : null}
                           </>
                         )}
                       </div>
                     )}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Bottom strip: hand & powers · desperation capsule last (napkin div9 under cards) */}
      <div className="relative z-10 mt-auto shrink-0 overflow-x-visible overflow-y-visible px-4 pb-4">
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
             {me.confirmed && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Locked in — waiting</span>}
           </div>
        </div>
        <div className="flex w-full min-w-0 flex-col items-stretch gap-4 overflow-x-visible overflow-y-visible px-0 pb-1 sm:px-1">
          <div
            ref={handHudLayoutRef}
            className={`mx-auto box-border w-full min-w-0 max-w-[min(100vw-1.25rem,120rem)] overflow-x-visible overflow-y-visible px-0 sm:px-1 ${
              handHudNeedsStack
                ? 'flex flex-col items-center gap-y-10'
                : 'grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-6 sm:gap-x-10 md:gap-x-14 lg:gap-x-16'
            }`}
          >
            {/* Powers — left of hand · extra left inset so overlaps / shadows aren’t clipped */}
            <div
              className={`relative z-[14] flex min-h-0 min-w-0 flex-col justify-end overflow-visible pb-2 pl-3 pt-4 sm:pl-6 ${
                handHudNeedsStack
                  ? 'order-1 w-full max-w-full items-center pb-4 pl-4 pt-8 sm:pl-6'
                  : 'col-span-1 col-start-1 row-start-1 items-end justify-end justify-self-stretch'
              }`}
            >
              {(room.status === 'playing' || room.status === 'powering') && me.powerCards.length > 0 ? (
                <div
                  className={`flex min-w-0 max-w-none shrink-0 flex-col overflow-visible ${
                    handHudNeedsStack ? 'w-full max-w-full items-center' : 'w-full items-end'
                  }`}
                >
                  <span className="mb-1 w-full text-center text-[8px] font-black uppercase tracking-wider text-emerald-500/90 sm:text-right">
                    Your powers
                  </span>
                  <div className="-space-x-4 flex w-max max-w-none min-w-0 flex-nowrap items-end justify-center overflow-visible px-2 pb-2 pt-1 sm:-space-x-6 sm:justify-end sm:pr-2 sm:pl-1">
                    {me.powerCards.map((pId, i) => (
                      <div key={`bottom-pow-${pId}-${i}`} className="relative shrink-0" style={{ zIndex: 8 + i }}>
                        <div
                          className={`rounded-xl transition-[filter,box-shadow] ${
                            activePowerCardId === pId
                              ? 'shadow-[0_0_30px_rgba(250,204,21,0.42)] drop-shadow-[0_0_14px_rgba(250,204,21,0.5)] saturate-110'
                              : ''
                          }`}
                        >
                          <PowerCardVisual
                            cardId={pId}
                            matchHandCard
                            selected={activePowerCardId === pId}
                            onClick={() => !me.confirmed && handleTogglePowerCard(pId)}
                            disabled={me.confirmed || (curseSelectionLocked && isCurseCardId(pId))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          {/* Hand — centred in the viewport row */}
          <div
            className={`relative mx-auto flex min-h-[13rem] min-w-0 max-w-none flex-col justify-end overflow-visible sm:min-h-[12rem] ${
              room.status === 'playing' && selectedCardIndex !== null && !me.confirmed ? 'z-[24]' : 'z-[12]'
            } ${handHudNeedsStack ? 'order-2 w-full max-w-full' : 'col-start-2 row-start-1 justify-self-center'}`}
          >
            <div
              ref={handRowRef}
              className={`select-none flex min-h-[12rem] w-full items-end justify-center overflow-visible -space-x-6 flex-nowrap px-1 transition-[filter,opacity] duration-300 sm:min-h-[11.5rem] sm:-space-x-9 ${
                me.confirmed ? 'saturate-[0.68] brightness-95 opacity-[0.92]' : ''
              }`}
              style={{ transform: 'translateY(-8px)' }}
            >
              {me.hand.map((card, i) => {
                const selected = selectedCardIndex === i;
                const fan = playerHandFanMotion(i, me.hand.length, fanSqueeze);
                const dragGapActive =
                  handDragFromIndex !== null &&
                  handDragHoverIndex !== null &&
                  handDragFromIndex !== handDragHoverIndex;
                const gapPush = dragGapActive ? 18 : 0;
                let gapShift = 0;
                if (
                  dragGapActive &&
                  handDragFromIndex !== null &&
                  handDragHoverIndex !== null &&
                  me.hand.length > 1
                ) {
                  const { left, right } = handReorderGapNeighborIndices(
                    handDragFromIndex,
                    handDragHoverIndex,
                    me.hand.length,
                  );
                  const fromIdx = handDragFromIndex;
                  if (left !== null && left !== fromIdx && i === left) gapShift -= gapPush;
                  if (right !== null && right !== fromIdx && i === right) gapShift += gapPush;
                }
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
                /** Stable identity per multiset slot so reorder doesn’t remap React keys → no deal entrance replay. */
                const occurrenceKey = handSlotOccurrenceRank(me.hand, i);
                const isShopPack = isShopPackPlaceholder(card);
                return (
                  <motion.div
                    key={`${card}#${occurrenceKey}`}
                    style={{ transformOrigin: 'bottom center' }}
                    animate={
                      selected
                        ? { y: -30 + fan.y, rotate: fan.rotate, x: fan.x + gapShift, zIndex: 55 }
                        : { y: fan.y, rotate: fan.rotate, x: fan.x + gapShift, zIndex: fan.baseZ }
                    }
                    transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
                    layout={false}
                    className={`relative ${!me.confirmed && !isShopPack ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    draggable={!me.confirmed && !isShopPack}
                    onDragStart={(e) => {
                      if (me.confirmed || isShopPack) return;
                      setHandDragFromIndex(i);
                      setHandDragHoverIndex(i);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(i));
                    }}
                    onDragOver={(e) => {
                      if (me.confirmed || isShopPack) return;
                      e.preventDefault();
                      setHandDragHoverIndex(i);
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (me.confirmed || isShopPack) return;
                      const from = Number(e.dataTransfer.getData('text/plain'));
                      setHandDragFromIndex(null);
                      setHandDragHoverIndex(null);
                      if (!Number.isFinite(from)) return;
                      void reorderMyHandSlots(from, i);
                    }}
                    onDragEnd={() => {
                      setHandDragFromIndex(null);
                      setHandDragHoverIndex(null);
                    }}
                  >
                    {envyCovetedHere && (
                      <motion.div
                        className="pointer-events-none absolute -top-[3.35rem] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-0.5"
                        title={ENVY_COVET_CARD_TOOLTIP}
                        initial={{ y: 0 }}
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <GreenEyedMonsterIcon className="h-10 w-[5.75rem] drop-shadow-[0_0_14px_rgba(16,185,129,0.5)] sm:h-11 sm:w-[6.25rem]" />
                      </motion.div>
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
                      onClick={() => !me.confirmed && !combinedMuted && !isShopPack && setSelectedCardIndex(i)}
                      role={me.role}
                      presentation="none"
                      delay={0}
                      motionLayout={false}
                      handUniformRasterScale={handUniformRasterScale}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
          {/* Panic dice — right of hand */}
          {!handHudNeedsStack ? (
            <div className="relative z-[13] col-start-3 row-start-1 flex min-h-0 min-w-0 flex-col items-start justify-end justify-self-stretch overflow-visible pb-2 pr-3 pt-4 pl-1 sm:pr-6 sm:pl-2 md:items-end">
              {panicDiceStripVisible ? (
                <>
                  <span className="mb-1 w-full text-center text-[8px] font-black uppercase tracking-wider text-emerald-500/90 sm:w-auto sm:text-left md:text-right">
                    Panic Dice
                  </span>
                  <div className="relative flex w-full max-w-none min-w-0 flex-col items-center overflow-visible sm:items-start md:items-end">
                    {panicDiceStripInteractive ? (
                      <button
                        type="button"
                        onMouseEnter={() => setPanicDiceStripHover(true)}
                        onMouseLeave={() => setPanicDiceStripHover(false)}
                        onFocus={() => setPanicDiceStripHover(true)}
                        onBlur={() => setPanicDiceStripHover(false)}
                        onClick={() => setPanicDiceStripExplainOpen(true)}
                        className="group relative cursor-help outline-none transition-transform hover:scale-[1.03] active:scale-95 [&:focus-visible]:ring-2 [&:focus-visible]:ring-amber-400/80"
                        aria-label="Panic dice — not usable until round results"
                      >
                        <img
                          src={cardArtAssetUrl('PanicDice.png')}
                          alt=""
                          draggable={false}
                          className="relative mx-auto h-28 w-auto max-w-[min(92vw,9.5rem)] opacity-85 object-contain saturate-[0.92] contrast-[1.03] grayscale-[0.12] transition-[filter,opacity] group-hover:opacity-95 group-hover:grayscale-[0.05] drop-shadow-[0_10px_22px_rgba(0,0,0,0.5)] sm:h-32"
                        />
                      </button>
                    ) : (
                      <div
                        role="presentation"
                        className="cursor-not-allowed select-none outline-none"
                        aria-label={PANIC_DICE_USED_HOVER}
                        onMouseEnter={() => setPanicDiceStripHover(true)}
                        onMouseLeave={() => setPanicDiceStripHover(false)}
                      >
                        <img
                          src={cardArtAssetUrl('PanicDice.png')}
                          alt=""
                          draggable={false}
                          className="pointer-events-none relative mx-auto h-28 w-auto max-w-[min(92vw,9.5rem)] object-contain opacity-[0.5] saturate-0 grayscale contrast-95 brightness-110 drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)] sm:h-32"
                        />
                      </div>
                    )}
                    {panicDiceStripHover ? (
                      <div
                        className={`pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-[60] max-w-[min(20rem,calc(100vw-3rem))] -translate-x-1/2 sm:left-0 sm:max-w-[min(22rem,calc(100vw-11rem))] sm:translate-x-0 ${HUD_INSTANT_TOOLTIP_PANEL_CLASS}`}
                      >
                        {panicStripHoverText}
                      </div>
                    ) : null}
                  </div>
                  <span className="pointer-events-none mt-1 w-full text-center text-[7px] font-black uppercase tracking-widest text-slate-500 sm:text-left md:text-right">
                    {panicStripFootnote}
                  </span>
                </>
              ) : null}
            </div>
          ) : panicDiceStripVisible ? (
            <div className="relative z-[13] order-3 flex w-full max-w-md flex-col items-center justify-end pb-4 pt-6">
              <span className="mb-1 w-full text-center text-[8px] font-black uppercase tracking-wider text-emerald-500/90">
                Panic Dice
              </span>
              <div className="relative flex flex-col items-center">
                {panicDiceStripInteractive ? (
                  <button
                    type="button"
                    onMouseEnter={() => setPanicDiceStripHover(true)}
                    onMouseLeave={() => setPanicDiceStripHover(false)}
                    onFocus={() => setPanicDiceStripHover(true)}
                    onBlur={() => setPanicDiceStripHover(false)}
                    onClick={() => setPanicDiceStripExplainOpen(true)}
                    className="group relative cursor-help outline-none transition-transform hover:scale-[1.03] active:scale-95 [&:focus-visible]:ring-2 [&:focus-visible]:ring-amber-400/80"
                    aria-label="Panic dice — not usable until round results"
                  >
                    <img
                      src={cardArtAssetUrl('PanicDice.png')}
                      alt=""
                      draggable={false}
                      className="relative mx-auto h-28 w-auto max-w-[min(92vw,9.5rem)] opacity-85 object-contain saturate-[0.92] contrast-[1.03] grayscale-[0.12] transition-[filter,opacity] group-hover:opacity-95 group-hover:grayscale-[0.05] drop-shadow-[0_10px_22px_rgba(0,0,0,0.5)] sm:h-32"
                    />
                  </button>
                ) : (
                  <div
                    role="presentation"
                    className="cursor-not-allowed select-none outline-none"
                    aria-label={PANIC_DICE_USED_HOVER}
                    onMouseEnter={() => setPanicDiceStripHover(true)}
                    onMouseLeave={() => setPanicDiceStripHover(false)}
                  >
                    <img
                      src={cardArtAssetUrl('PanicDice.png')}
                      alt=""
                      draggable={false}
                      className="pointer-events-none relative mx-auto h-28 w-auto max-w-[min(92vw,9.5rem)] object-contain opacity-[0.5] saturate-0 grayscale contrast-95 brightness-110 drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)] sm:h-32"
                    />
                  </div>
                )}
                {panicDiceStripHover ? (
                  <div
                    className={`pointer-events-none absolute bottom-full left-1/2 z-[60] mb-3 max-w-[min(22rem,calc(100vw-2.5rem))] -translate-x-1/2 ${HUD_INSTANT_TOOLTIP_PANEL_CLASS}`}
                  >
                    {panicStripHoverText}
                  </div>
                ) : null}
              </div>
              <span className="pointer-events-none mt-1 text-center text-[7px] font-black uppercase tracking-widest text-slate-500">
                {panicStripFootnote}
              </span>
            </div>
          ) : null}
        </div>
        </div>

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
    </DisplayCardArtModeOverride>
    </CardArtSessionBridge>
  );
};

function CardCreatorHashOverlay() {
  const [creatorOpen, setCreatorOpen] = useState(false);

  useEffect(() => {
    const sync = () => setCreatorOpen(window.location.hash === '#card-creator');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  if (!creatorOpen) return null;

  return (
    <CardCreator
      onClose={() => {
        window.location.hash = '';
        setCreatorOpen(false);
      }}
    />
  );
}

function CardAnimationPreviewHashOverlay() {
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const sync = () => setPreviewOpen(window.location.hash === '#card-anim-preview');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  if (!previewOpen) return null;

  return (
    <CardAnimationPreview
      onOpenCreator={() => {
        window.location.hash = '#card-creator';
      }}
      onClose={() => {
        window.location.hash = '';
        setPreviewOpen(false);
      }}
    />
  );
}

export default function App() {
  const [isDual, setIsDual] = useState(false);

  return (
    <>
      {/* CardCreator is fixed full-screen; keep outside overflow-hidden so it is not clipped. */}
      <CardCreatorHashOverlay />
      <CardAnimationPreviewHashOverlay />
    <div className="min-h-screen overflow-x-visible overflow-y-hidden bg-emerald-950 font-sans text-white selection:bg-yellow-400 selection:text-black">
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
        <div
          className={`h-full min-h-0 transition-all duration-500 overflow-x-visible overflow-y-hidden ${isDual ? 'w-1/2' : 'w-full'}`}
        >
          <GameInstance instanceId="p1" isDual={isDual} />
        </div>
        
        {isDual && (
          <div className="h-full min-h-0 w-1/2 overflow-x-visible overflow-y-hidden">
            <GameInstance 
              instanceId="p2"
              isDual
            />
          </div>
        )}
      </div>

      <footer className="fixed bottom-4 left-4 pointer-events-none opacity-20 text-[8px] font-black uppercase tracking-[0.4em]">
         Cardcatch - V0.8.5
      </footer>
    </div>
    </>
  );
}
