import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePowerTooltipPosition } from '../hooks/usePowerTooltipPosition';
import { motion } from 'motion/react';
import {
  BicepsFlexed,
  BookType,
  Cloud,
  Coins,
  Crown,
  FastForward,
  Flame,
  Gavel,
  Globe,
  Heart,
  Hash,
  Lamp,
  Moon,
  Rabbit,
  RefreshCw,
  Scale,
  Skull,
  Sparkles,
  Star,
  Sun,
  Swords,
  UtensilsCrossed,
  Wand2,
  Waves,
  Eye,
  Shield,
  Anchor,
  ZapOff,
} from 'lucide-react';
import { playingCardEntranceMotion, type CardPresentationMode, type DeckPullSide, type PresentationPace } from '../animations/cardMotion';
import {
  CURSES,
  CURSE_ENVY,
  CURSE_GLUTTONY,
  CURSE_GREED,
  CURSE_LUST,
  CURSE_PRIDE,
  CURSE_SLOTH,
  CURSE_WRATH,
  isCurseCardId,
} from '../curses';
import {
  HEART_GOD_RANK,
  getCardValue,
  getWrathMagnitude,
  parseCard,
} from '../services/gameService';
import { MAJOR_ARCANA, PlayerRole } from '../types';
import { SuitGlyph } from './SuitGlyphs';

/** Corner rank / pip letters on playing-card faces (`GameVisuals` only; tooltips/UI stay sans). */
const CARD_FACE_RANK_CLASS = 'font-card-rank tracking-tighter';

/** Text color classes per suit — shared by card visuals & power UI */
export const SUIT_COLORS: Record<string, string> = {
  Hearts: 'text-red-500',
  Diamonds: 'text-red-400',
  Clubs: 'text-emerald-400',
  Spades: 'text-blue-400',
  Stars: 'text-yellow-400',
  Moons: 'text-white',
  Frogs: 'text-lime-400',
  Coins: 'text-amber-400',
  Crowns: 'text-amber-300',
  Grovels: 'text-violet-300',
  Swords: 'text-red-400',
  Bones: 'text-stone-300',
  Joker: 'text-purple-400'
};

const PLAYING_CARD_RANK_TITLE: Record<string, string> = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Jack',
};

/** Title + clash value for delayed suit-card hover (“King of Hearts — (13)”). */
function playingCardHoverCaption(cardStr: string, lustHeartRulesActive: boolean): string | null {
  const p = parseCard(cardStr);
  if (p.isJoker) return `Joker — (${getCardValue(cardStr)})`;
  if (p.suit === 'Grovels') return null;
  if (p.suit === 'Crowns' && p.value === 'E') return `Emperor of Crowns — (${getCardValue(cardStr)})`;
  if (p.suit === 'Hearts' && p.value === HEART_GOD_RANK) {
    return `God of Hearts — (${getCardValue(cardStr, lustHeartRulesActive)})`;
  }
  const rank = PLAYING_CARD_RANK_TITLE[p.value] ?? p.value;
  const v = getCardValue(cardStr, lustHeartRulesActive);
  return `${rank} of ${p.suit} — (${v})`;
}

/** Lucide (SVG) mapping for major arcana `icon` field — placeholder until final artwork. */
const MAJOR_ARCANA_LUCIDE: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  Sparkles,
  Wand2,
  Eye,
  Crown,
  Shield,
  BookType,
  Heart,
  FastForward,
  BicepsFlexed,
  Lamp,
  RefreshCw,
  Scale,
  Anchor,
  Skull,
  Waves,
  Flame,
  ZapOff,
  Star,
  Moon,
  Sun,
  Gavel,
  Globe,
};

export function MajorArcanaIconGlyph({
  iconName,
  className,
  size,
}: {
  iconName: string;
  className?: string;
  size?: number;
}) {
  const Comp = MAJOR_ARCANA_LUCIDE[iconName] || Sparkles;
  return <Comp className={className} size={size} />;
}

export const GreenEyedMonsterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="-0.5 8 39 26"
    className={className}
    aria-hidden
  >
    <path
      fill="currentColor"
      d="M0 16q0.064 0.128 0.16 0.352t0.48 0.928 0.832 1.344 1.248 1.536 1.664 1.696 2.144 1.568 2.624 1.344 3.136 0.896 3.712 0.352 3.712-0.352 3.168-0.928 2.592-1.312 2.144-1.6 1.664-1.632 1.248-1.6 0.832-1.312 0.48-0.928l0.16-0.352q-0.032-0.128-0.16-0.352t-0.48-0.896-0.832-1.344-1.248-1.568-1.664-1.664-2.144-1.568-2.624-1.344-3.136-0.896-3.712-0.352-3.712 0.352-3.168 0.896-2.592 1.344-2.144 1.568-1.664 1.664-1.248 1.568-0.832 1.344-0.48 0.928zM10.016 16q0-2.464 1.728-4.224t4.256-1.76 4.256 1.76 1.76 4.224-1.76 4.256-4.256 1.76-4.256-1.76-1.728-4.256zM12 16q0 1.664 1.184 2.848t2.816 1.152 2.816-1.152 1.184-2.848-1.184-2.816-2.816-1.184-2.816 1.184l2.816 2.816h-4z"
    />
  </svg>
);

/** Distinct placeholder per curse card (SVG / Lucide). */
/** Class names for curse icon tint (placeholder art). */
export function cursePowerIconClass(curseId: number): string {
  switch (curseId) {
    case CURSE_LUST:
      return 'text-rose-500';
    case CURSE_GLUTTONY:
      return 'text-orange-500';
    case CURSE_GREED:
      return 'text-amber-400';
    case CURSE_PRIDE:
      return 'text-violet-400';
    case CURSE_WRATH:
      return 'text-red-500';
    case CURSE_ENVY:
      return 'text-emerald-400';
    case CURSE_SLOTH:
      return 'text-sky-300';
    default:
      return 'text-red-400';
  }
}

export function CursePowerIcon({ curseId, className }: { curseId: number; className?: string }) {
  const cn = className ?? 'h-10 w-10';
  switch (curseId) {
    case CURSE_LUST:
      return <Heart className={cn} strokeWidth={2.2} aria-hidden />;
    case CURSE_GLUTTONY:
      return <UtensilsCrossed className={cn} strokeWidth={2.2} aria-hidden />;
    case CURSE_GREED:
      return <Coins className={cn} strokeWidth={2} aria-hidden />;
    case CURSE_PRIDE:
      return <Sparkles className={cn} strokeWidth={2} aria-hidden />;
    case CURSE_WRATH:
      return <Swords className={cn} strokeWidth={2.2} aria-hidden />;
    case CURSE_ENVY:
      return <GreenEyedMonsterIcon className={cn} aria-hidden />;
    case CURSE_SLOTH:
      return <Cloud className={cn} strokeWidth={1.85} aria-hidden />;
    default:
      return <Skull className={cn} strokeWidth={2} aria-hidden />;
  }
}

export const WolfIcon = () => (
  <svg viewBox="0 0 100 125" className="w-full h-full opacity-60 fill-current">
    <path d="M84.9 34c6.4-7.7 7.9-18.6 3.6-27.8-.2-.5-.6-.8-1.1-1s-1-.2-1.5.1L65 15.1c-.5.2-1 .3-1.5.1C59.2 13.7 54.7 13 50 13s-9.2.8-13.4 2.2c-.5.2-1 .1-1.5-.1l-21-9.9c-.5-.2-1-.3-1.5-.1s-.9.5-1.1 1C7.1 15.3 8.6 26.3 15.1 34 8.6 43.7 5 55.2 5 67c0 1 .7 1.8 1.7 2l10.9 1.8c7.4 1.2 13.2 6.7 14.7 14l.1.7c1.2 5.5 6 9.4 11.5 9.5h12.2c5.5-.1 10.4-4.1 11.5-9.5l.1-.7c1.5-7.3 7.3-12.8 14.7-14L93.3 69c1-.2 1.7-1 1.7-2 0-11.8-3.6-23.3-10.1-33M54 91h-8v-2c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2zm27.8-24.2c-9 1.5-16.1 8.2-18 17.2l-.1.7c-.6 3-2.9 5.3-5.7 6.1V89c0-3.3-2.7-6-6-6h-4c-3.3 0-6 2.7-6 6v1.7c-2.8-.8-5.1-3.1-5.7-6.1l-.2-.6c-1.9-9-8.9-15.7-18-17.2L9 65.3c.4-11.9 4.6-23.4 12-32.7l3.5-4.4c.7-.9.5-2.1-.3-2.8s-2.1-.5-2.8.3l-3.5 4.4c-.1.2-.3.3-.4.5-4.5-5.9-5.8-13.9-3.2-20.9l19 9c1.5.7 3.1.8 4.5.3 3.8-1.3 7.9-2 12.1-2s8.3.7 12.1 2c1.5.5 3.1.4 4.5-.3l19-9c2.5 7 1.3 15-3.2 20.9-.1-.2-.2-.3-.4-.5l-3.5-4.4c-.7-.9-2-1-2.8-.3s-1 2-.3 2.8l3.5 4.4c7.4 9.3 11.7 20.8 12 32.7z"/>
    <path d="M35.8 49.7c-.8-.8-2-.8-2.8 0l-1.4 1.4c-3.1 3.1-3.1 8.2 0 11.3 1.6 1.5 3.6 2.3 5.7 2.3s4.1-.8 5.7-2.3l1.4-1.4c.4-.4.6-.9.6-1.4s-.2-1-.6-1.4zm-1.5 9.9c-1.6-1.6-1.6-4.1 0-5.7l5.7 5.7c-1.6 1.6-4.1 1.6-5.7 0m32.8-9.9c-.8-.8-2-.8-2.8 0l-8.5 8.5c-.8.8-.8 2 0 2.8l1.4 1.4c1.6 1.5 3.6 2.3 5.7 2.3s4.1-.8 5.7-2.3c3.1-3.1 3.1-8.2 0-11.3zm-1.4 9.9c-1.6 1.6-4.1 1.6-5.7 0l5.7-5.7c1.5 1.6 1.5 4.2 0 5.7"/>
  </svg>
);

export const DesperationVignette: React.FC<{ tier: number; totalTiers: number }> = ({ tier, totalTiers }) => {
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

export interface CardVisualProps {
  card: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  revealed?: boolean;
  role?: PlayerRole;
  delay?: number;
  noAnimate?: boolean;
  /** Compact footprint (e.g. Priestess swap row). */
  small?: boolean;
  /** Round-resolution entrance: card lifts from below like drawing from the deck. */
  presentation?: CardPresentationMode;
  deckPullSide?: DeckPullSide;
  presentationPace?: PresentationPace;
  /** Used for clash value in delayed tooltip while Lust is active (corner still shows Q/K/A). */
  lustHeartRulesActive?: boolean;
  /** Pride: illegal target-suit plays — greyed and not clickable (tooltip still works). */
  muted?: boolean;
  /** Hover caption (Pride barrier / Grovel flavor text). */
  detailTooltip?: string;
  /** Result / post-shatter ghost from clash penalties (half transparent). */
  clashGhost?: boolean;
  /** Envy: playable coveted card glows green. */
  envyCovetedGlow?: boolean;
  /** Round-resolution visual: distinguish identity flip vs rank/suit reinforcement. */
  resolutionMorph?: 'transform' | 'upgrade' | null;
}

export const CardVisual: React.FC<CardVisualProps> = (props) => {
  const {
    card,
    selected,
    onClick,
    disabled,
    revealed = true,
    role,
    delay = 0,
    noAnimate = false,
    small = false,
    presentation = 'default',
    deckPullSide = 'left',
    presentationPace = 'normal',
    lustHeartRulesActive = false,
    muted = false,
    detailTooltip,
    clashGhost = false,
    envyCovetedGlow = false,
    resolutionMorph = null,
  } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const holdTipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [holdTipOpen, setHoldTipOpen] = useState(false);
  const holdCaption = useMemo(
    () => (revealed && card ? playingCardHoverCaption(card, lustHeartRulesActive) : null),
    [card, lustHeartRulesActive, revealed],
  );
  const tooltipStyle = usePowerTooltipPosition(
    (Boolean(detailTooltip) && tipOpen) || (Boolean(holdCaption) && holdTipOpen),
    rootRef,
    popRef,
  );
  const { suit, value, isJoker } = useMemo(() => (revealed ? parseCard(card) : { suit: '', value: '', isJoker: false }), [card, revealed]);

  useEffect(() => {
    return () => {
      if (holdTipTimer.current) clearTimeout(holdTipTimer.current);
    };
  }, []);
  const isMoonSuit = suit === 'Moons';
  const isCrownsSuit = suit === 'Crowns';
  const isGrovelsSuit = suit === 'Grovels';
  const isSwordsSuit = suit === 'Swords';
  const wrathPen = isSwordsSuit && revealed && card ? getWrathMagnitude(card) : 0;
  const entrance = playingCardEntranceMotion({
    noAnimate,
    presentation,
    deckPullSide,
    presentationPace,
    delay,
  });

  const faceWrap = small
    ? 'w-10 h-[5.5rem] sm:w-14 sm:h-[8.25rem] border-2 rounded-lg p-1.5'
    : 'w-12 h-18 sm:w-24 sm:h-36 border-2 rounded-lg p-2';
  const cornerText = small ? 'text-xs sm:text-base' : 'text-sm sm:text-xl';
  const cornerGlyph = small ? 'w-4 h-4 sm:w-6 sm:h-6' : 'w-5 h-5 sm:w-8 sm:h-8';
  const centerGlyph = small ? 'w-12 h-12 sm:w-16 sm:h-16' : 'w-16 h-16 sm:w-24 sm:h-24';

  if (!revealed) {
    const isPredator = role === 'Predator';
    const isPreydator = role === 'Preydator';
    let backClasses = 'bg-blue-950 border-blue-800/80 text-blue-500 bg-[radial-gradient(circle_at_center,#172554_1px,transparent_1px)] bg-[size:8px_8px]';
    if (isPredator) backClasses = 'bg-red-950 border-red-800/80 text-red-500 bg-[radial-gradient(circle_at_center,#450a0a_1px,transparent_1px)] bg-[size:8px_8px]';
    else if (isPreydator) backClasses = 'bg-purple-950 border-purple-800/80 text-purple-500 bg-[radial-gradient(circle_at_center,#3b0764_1px,transparent_1px)] bg-[size:8px_8px]';
    const backSizing = small ? 'w-9 h-[4.75rem] sm:w-12 sm:h-[7.25rem]' : 'w-10 h-14 sm:w-16 sm:h-24';
    return (
      <motion.div
        layout
        {...entrance}
        transition={{ type: 'spring', stiffness: 720, damping: 38 }}
        whileHover={!disabled ? { y: -8, zIndex: 50 } : {}}
        className={`${backSizing} rounded-lg shadow-xl flex items-center justify-center p-1.5 border-2 transition-colors relative ${backClasses}`}
      >
        {isPreydator ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-60">
            <div className="w-6 h-6">
              <WolfIcon />
            </div>
            <Rabbit className="w-6 h-6 text-purple-400" />
          </div>
        ) : isPredator ? (
          <WolfIcon />
        ) : (
          <Rabbit className="w-full h-full opacity-60" />
        )}
      </motion.div>
    );
  }

  const allowHoverMotion =
    (!disabled && !muted) || Boolean(detailTooltip) || Boolean(!detailTooltip && holdCaption);

  const HOVER_HOLD_MS = 700;

  /** Static hit target: inner face translates on hover so pointer stays inside this box — avoids timer resets + neighbor stealing hover. */
  const syncHoldTip = () => {
    if (detailTooltip) {
      setTipOpen(true);
      return;
    }
    if (!holdCaption) return;
    if (holdTipTimer.current) clearTimeout(holdTipTimer.current);
    holdTipTimer.current = setTimeout(() => setHoldTipOpen(true), HOVER_HOLD_MS);
  };

  const clearHoldTip = () => {
    if (detailTooltip) setTipOpen(false);
    if (holdTipTimer.current) {
      clearTimeout(holdTipTimer.current);
      holdTipTimer.current = null;
    }
    setHoldTipOpen(false);
  };

  /**
   * Each card isolates painting so faded center SuitGlyphs can't composite over overlapping neighbors
   * (was worsened by `overflow-visible` on the face root).
   */
  return (
    <div
      ref={rootRef}
      style={{ isolation: 'isolate' }}
      className={`relative shrink-0 outline-none ${muted || disabled ? 'cursor-not-allowed' : holdCaption || detailTooltip || onClick ? 'cursor-pointer' : ''}`}
      onMouseEnter={syncHoldTip}
      onMouseLeave={clearHoldTip}
      onFocus={() => {
        syncHoldTip();
      }}
      onBlur={() => {
        clearHoldTip();
      }}
      tabIndex={detailTooltip ? 0 : undefined}
    >
      <motion.div
        layout
        {...entrance}
        style={{
          transformPerspective:
            presentation === 'deckPull' || resolutionMorph === 'transform'
              ? 900
              : undefined,
        }}
        transition={{ type: 'spring', stiffness: 720, damping: 38 }}
        whileHover={
          allowHoverMotion
            ? {
                y: -9,
                zIndex: 50,
                scale: muted && !detailTooltip && !holdCaption ? 1 : 1.05,
              }
            : {}
        }
        whileTap={!disabled && !muted ? { scale: 0.95 } : {}}
        onClick={muted ? undefined : onClick}
        className={`
          ${faceWrap} shadow-xl flex flex-col justify-between overflow-hidden rounded-lg
          transition-[box-shadow] outline-none will-change-transform
          ${presentation === 'deckPull' || resolutionMorph === 'transform' ? 'perspective-[900px] origin-bottom' : ''}
          ${isMoonSuit ? 'bg-black' : isCrownsSuit ? 'bg-gradient-to-br from-amber-950 via-stone-900 to-black' : isGrovelsSuit ? 'bg-gradient-to-br from-violet-950 via-slate-900 to-black' : isSwordsSuit ? 'bg-gradient-to-br from-zinc-950 via-red-950/55 to-black' : 'bg-white'}
          ${selected ? 'border-yellow-400 ring-4 ring-yellow-400/30' : isCrownsSuit ? 'border-amber-700/70' : isGrovelsSuit ? 'border-violet-700/70' : isSwordsSuit ? 'border-red-800/90' : 'border-gray-200'}
          ${envyCovetedGlow ? 'ring-2 ring-emerald-400/85 shadow-[0_0_20px_rgba(16,185,129,0.38)]' : ''}
          ${resolutionMorph === 'transform' ? 'ring-2 ring-fuchsia-500/80 shadow-[0_0_38px_rgba(168,85,247,0.55)]' : ''}
          ${disabled ? 'opacity-80 saturate-[0.72] brightness-95' : ''}
          ${muted ? 'opacity-[0.42] saturate-[0.48] brightness-[0.88]' : ''}
          ${clashGhost ? '!opacity-[0.5] saturate-[0.85]' : ''}
        `}
      >
      {isSwordsSuit && wrathPen > 0 && (
        <div
          className={`pointer-events-none absolute top-1 left-1/2 z-20 -translate-x-1/2 text-[9px] font-black tabular-nums text-red-500 sm:text-[11px] ${CARD_FACE_RANK_CLASS}`}
        >
          −{wrathPen}
        </div>
      )}
      <motion.div
        key={`${resolutionMorph ?? 'idle'}-${card}`}
        className={`relative z-[1] flex flex-1 flex-col justify-between overflow-hidden rounded-[inherit] ${small ? '' : 'min-h-[5.5rem] sm:min-h-[8.25rem]'}`}
        style={{ transformStyle: 'preserve-3d' }}
        animate={
          resolutionMorph === 'transform'
            ? {
                rotateY: [0, -90, -90, 0],
                scaleY: [1, 0.82, 0.82, 1],
                filter: [
                  'brightness(1)',
                  'brightness(1.2)',
                  'brightness(1.2)',
                  'brightness(1)',
                ],
              }
            : resolutionMorph === 'upgrade'
              ? { rotate: [0, -14, 10, -7, 0], x: [0, -10, 8, -4, 0], scale: [1, 1.04, 0.94, 1.06, 1] }
              : {}
        }
        transition={
          resolutionMorph === 'transform'
            ? { duration: 0.92, times: [0, 0.48, 0.52, 1], ease: [0.22, 1, 0.36, 1] }
            : resolutionMorph === 'upgrade'
              ? { duration: 0.36, ease: [0.22, 1, 0.36, 1] }
              : { duration: 0 }
        }
      >
        <div className={`relative z-[2] flex flex-col items-start leading-[0.9] ${SUIT_COLORS[suit] ?? 'text-red-400'}`}>
          {isGrovelsSuit ? (
            <span
              className={`${small ? 'text-[10px] sm:text-xs' : 'text-sm sm:text-xl'} font-black uppercase tracking-tighter text-violet-200 leading-none`}
            >
              Grovel
            </span>
          ) : (
            <>
              <span className={`${cornerText} font-black ${CARD_FACE_RANK_CLASS}`}>{value}</span>
              {isJoker ? (
                <SuitGlyph suit="Joker" className={`${cornerGlyph} text-purple-500`} />
              ) : (
                <SuitGlyph suit={suit} className={cornerGlyph} />
              )}
            </>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
          <div
            className={`${centerGlyph} ${isSwordsSuit ? 'opacity-[0.24]' : 'opacity-[0.08]'} ${SUIT_COLORS[suit] ?? 'text-red-500'}`}
          >
            {isGrovelsSuit ? (
              <SuitGlyph suit="Grovels" className={`text-violet-500/35 ${centerGlyph}`} />
            ) : isJoker ? (
              <SuitGlyph suit="Joker" className={`text-purple-600 ${centerGlyph}`} />
            ) : (
              <SuitGlyph suit={suit} className={centerGlyph} />
            )}
          </div>
        </div>

        <div className={`relative z-[2] flex flex-col items-start leading-[0.9] self-end rotate-180 ${SUIT_COLORS[suit] ?? 'text-red-400'}`}>
          {isGrovelsSuit ? (
            <span
              className={`${small ? 'text-[10px] sm:text-xs' : 'text-sm sm:text-xl'} font-black uppercase tracking-tighter text-violet-200 leading-none`}
            >
              Grovel
            </span>
          ) : (
            <>
              <span className={`${cornerText} font-black ${CARD_FACE_RANK_CLASS}`}>{value}</span>
              {isJoker ? (
                <SuitGlyph suit="Joker" className={`${cornerGlyph} text-purple-500`} />
              ) : (
                <SuitGlyph suit={suit} className={cornerGlyph} />
              )}
            </>
          )}
        </div>
      </motion.div>
      </motion.div>

      {(detailTooltip && tipOpen) || holdTipOpen
        ? typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={popRef}
              style={tooltipStyle}
              className={`max-w-[16rem] rounded-xl border px-3 py-2.5 text-left text-[11px] font-semibold leading-snug shadow-[0_16px_50px_rgba(0,0,0,0.65)] backdrop-blur-md sm:max-w-xs sm:text-[12px] ${
                detailTooltip && tipOpen
                  ? 'border-violet-800/85 bg-stone-950/98 text-violet-50'
                  : 'border-yellow-500/40 bg-slate-950/98 text-slate-100'
              }`}
            >
              {detailTooltip && tipOpen ? detailTooltip : holdCaption}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export const PowerCardVisual: React.FC<{
  cardId: number;
  revealed?: boolean;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  /** Outer size matches playing-card footprint in the bottom hand row (overlap-friendly). */
  matchHandCard?: boolean;
  /** Wide min-width + centered title clamp for Priestess-style pick rows */
  panel?: boolean;
  /** Tower blocked — greyed but hover still shows text */
  destroyed?: boolean;
  /** Anonymous opponent-major backs — no hover motion (prevents stray scrollbars in tight rows). */
  staticBackdrop?: boolean;
  /** Table curse slab (e.g. Lust): lift tooltip only, no pop/hover tween. */
  curseRackPeek?: boolean;
}> = ({
  cardId,
  revealed = true,
  onClick,
  selected,
  disabled,
  small = false,
  matchHandCard = false,
  panel = false,
  destroyed = false,
  staticBackdrop = false,
  curseRackPeek = false,
}) => {
  const curseDef = isCurseCardId(cardId) ? CURSES[cardId] : undefined;
  const card = curseDef ? null : MAJOR_ARCANA[cardId];
  const tip = curseDef
    ? `${curseDef.sin} — ${curseDef.name}: ${curseDef.description}`
    : card
      ? `${card.name}: ${card.description}`
      : '';
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const tooltipHudOpen = tipOpen && Boolean(tip) && (curseRackPeek || !disabled || destroyed);
  const tooltipStyle = usePowerTooltipPosition(tooltipHudOpen, rootRef, popRef);

  const dimClass = panel
    ? 'w-[6.875rem] sm:w-[7.5rem] min-h-[10rem] max-w-[8rem] text-[10px] p-2.5 pt-3 justify-start gap-2'
    : matchHandCard
      ? 'w-12 h-18 sm:w-24 sm:h-36 text-[6px] sm:text-[7px] p-1 sm:p-1.5 justify-between gap-0 min-h-0'
      : small
        ? 'w-18 h-28 text-[9px] p-3'
        : 'w-52 h-80 sm:w-64 sm:h-96 text-[12px] p-3';
  const titleClassPanel =
    'text-[7px] sm:text-[8px] leading-tight line-clamp-3 break-words hyphens-auto text-center normal-case px-0.5 w-full min-h-[2.75rem] flex items-center justify-center border-b pb-1.5 font-bold tracking-tight';
  const titleClassPanelStd = `${titleClassPanel} border-slate-800/70 text-slate-800`;
  const titleClassPanelCurse = `${titleClassPanel} border-red-800/70 text-red-200`;
  const titleClassDefault = `font-black border-b-2 w-full pb-1 px-1 uppercase tracking-tighter leading-[0.9] ${matchHandCard ? 'text-[6px] sm:text-[7px] border-b border-slate-700/60 pb-0.5' : small ? 'text-[8px]' : 'text-[18px] sm:text-[32px]'}`;
  const titleClassDefaultStd = `${titleClassDefault} border-slate-800 text-slate-800`;
  const titleClassDefaultCurse = `${titleClassDefault} border-red-800 text-red-300`;

  if (!curseDef && !card) {
    return (
      <div
        className={`${matchHandCard ? 'w-12 h-18 sm:w-24 sm:h-36' : small ? 'w-14 h-22' : 'w-32 h-52'} rounded-lg border border-slate-700 bg-slate-900 text-[10px] text-slate-500 flex items-center justify-center`}
      >
        ?
      </div>
    );
  }

  if (!revealed) {
    const backW = matchHandCard
      ? 'w-12 h-18 sm:w-24 sm:h-36'
      : panel
        ? 'w-[7rem] sm:w-[7.75rem] h-36'
        : small
          ? 'w-14 h-22'
          : 'w-32 h-52 sm:w-40 sm:h-64';
    const backCurse = curseDef
      ? 'bg-zinc-950 border-2 border-red-900/70 bg-[radial-gradient(circle_at_center,#450a0a_1px,transparent_1px)] bg-[size:9px_9px]'
      : 'bg-slate-300 border-2 border-slate-400 bg-[radial-gradient(circle_at_center,#94a3b8_1px,transparent_1px)] bg-[size:10px_10px]';
    const shellClass = `${backW} rounded-lg shadow-lg flex items-center justify-center relative overflow-hidden ${backCurse} ${selected ? 'ring-4 ring-yellow-400' : ''} ${disabled ? 'opacity-75 saturate-[0.72] brightness-95 cursor-not-allowed' : staticBackdrop ? 'cursor-default select-none' : 'cursor-pointer'}`;
    const backChildren = (
      <>
        <div className={`absolute inset-0 bg-linear-to-br ${curseDef ? 'from-red-950/40 to-transparent' : 'from-slate-400/20 to-transparent'}`} />
        <div className="relative z-10 flex items-center justify-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
          {curseDef ? (
            <CursePowerIcon
              curseId={cardId}
              className={`${matchHandCard ? 'h-5 w-5 sm:h-7 sm:w-7' : small ? 'h-7 w-7' : 'h-11 w-11 sm:h-12 sm:w-12'} ${cursePowerIconClass(cardId)}`}
            />
          ) : (
            <span
              className={`font-black tabular-nums text-slate-500 ${matchHandCard ? 'text-sm sm:text-xl leading-none' : small ? 'text-lg leading-none' : 'text-3xl sm:text-[2.65rem]'}`}
            >
              ?
            </span>
          )}
        </div>
      </>
    );
    if (staticBackdrop) {
      return (
        <div role="presentation" className={shellClass}>
          {backChildren}
        </div>
      );
    }
    return (
      <motion.div
        whileHover={!disabled ? { scale: 1.1, rotateY: 10 } : {}}
        onClick={onClick}
        className={`${shellClass} perspective-1000`}
      >
        {backChildren}
      </motion.div>
    );
  }

  const faceBorder = matchHandCard ? 'border-2' : 'border-4';
  const faceShell = curseDef
    ? `bg-zinc-950 ${faceBorder} border-red-900 text-red-400 ${matchHandCard ? 'shadow-lg' : 'shadow-[0_0_40px_rgba(127,29,29,0.35)]'}`
    : `bg-slate-50 ${faceBorder} border-slate-800 text-slate-800`;
  const gloss = curseDef
    ? 'from-red-950/30 to-transparent'
    : 'from-white/20 to-slate-900/5';

  const canLiftOnHover = !curseRackPeek && !disabled;

  return (
    <motion.div
      ref={rootRef}
      layout
      title={tip}
      tabIndex={curseRackPeek ? 0 : undefined}
      whileHover={
        canLiftOnHover
          ? matchHandCard
            ? { y: -6, scale: 1.04, zIndex: 55, transition: { type: 'spring', stiffness: 720, damping: 38 } }
            : { scale: panel ? 1.05 : small ? 1.14 : 1.06, zIndex: 200, transition: { type: 'spring', stiffness: 380, damping: 28 } }
          : {}
      }
      onMouseEnter={() => {
        if (!(curseRackPeek || !disabled || destroyed) || !tip) return;
        setTipOpen(true);
      }}
      onMouseLeave={() => setTipOpen(false)}
      onFocus={() => {
        if (!(curseRackPeek || !disabled || destroyed) || !tip) return;
        setTipOpen(true);
      }}
      onBlur={() => setTipOpen(false)}
      onClick={curseRackPeek ? undefined : onClick}
      className={`${dimClass} group relative ${matchHandCard ? 'rounded-lg' : 'rounded-2xl'} ${matchHandCard ? 'shadow-xl' : 'shadow-2xl'} flex flex-col items-center text-center justify-between ${matchHandCard ? 'overflow-hidden' : 'overflow-visible'} ${faceShell} ${selected ? `${matchHandCard ? 'ring-2 ring-yellow-400' : 'ring-4 ring-yellow-400'} border-yellow-500` : ''} ${curseRackPeek ? 'cursor-help' : disabled ? 'opacity-80 saturate-[0.72] brightness-95 cursor-not-allowed' : 'cursor-pointer'} ${destroyed ? 'opacity-[0.48] grayscale border-orange-950 ring-2 ring-orange-600/35 shadow-[inset_0_0_24px_rgba(0,0,0,0.45)]' : ''} transition-shadow ${matchHandCard ? 'origin-bottom' : 'origin-center'}`}
    >
      <div
        className={`absolute top-0 left-0 w-full h-full bg-linear-to-b ${gloss} pointer-events-none ${matchHandCard ? 'rounded-md' : 'rounded-[13px]'} overflow-hidden`}
      />

      <div className={`flex flex-col items-center gap-0.5 z-10 w-full min-w-0 ${panel ? 'mb-0' : matchHandCard ? 'mb-0' : 'mb-1'}`}>
        <span
          className={`line-clamp-2 ${curseDef ? (panel ? titleClassPanelCurse : titleClassDefaultCurse) : panel ? titleClassPanelStd : titleClassDefaultStd}`}
        >
          {curseDef ? curseDef.name : card!.name}
        </span>
        {!small && !panel && !matchHandCard && (
          <span
            className={`font-mono font-bold italic text-[6px] sm:text-[9px] tracking-[0.2em] uppercase opacity-70 mt-1 ${curseDef ? 'text-red-500' : 'text-slate-400'}`}
          >
            {curseDef ? curseDef.sin : 'Power card'}
          </span>
        )}
      </div>

      <div
        className={`z-10 shrink-0 rounded-full border-2 shadow-xl ${curseRackPeek || matchHandCard ? '' : 'group-hover:scale-105'} transition-transform ${panel ? 'p-2 my-1' : matchHandCard ? 'p-0.5 my-0.5' : small ? 'p-1.5' : 'p-4 sm:p-6'} ${panel ? '' : matchHandCard ? '' : 'my-2'} ${curseDef ? 'bg-black border-red-800' : 'bg-slate-900 border-slate-800'}`}
      >
        {curseDef ? (
          <CursePowerIcon
            curseId={cardId}
            className={`${matchHandCard ? 'h-4 w-4 sm:h-5 sm:w-5' : small ? 'h-4 w-4' : panel ? 'h-[22px] w-[22px]' : 'h-10 w-10'} ${cursePowerIconClass(cardId)}`}
          />
        ) : (
          <MajorArcanaIconGlyph
            iconName={card!.icon}
            className="text-yellow-400"
            size={panel ? 22 : matchHandCard ? 14 : small ? 16 : 40}
          />
        )}
      </div>

      <div
        className={`font-bold leading-snug z-10 w-full px-2 mt-auto ${curseDef ? 'text-red-200' : 'text-slate-700'} ${panel || small || matchHandCard ? 'hidden' : 'block'}`}
      >
        <p className={`font-medium ${small ? 'text-[7px]' : 'text-[11px] sm:text-sm'} line-clamp-3 min-h-[3em] ${curseDef ? 'text-red-300/95' : 'text-slate-500'}`}>
          {curseDef ? curseDef.description : card!.description}
        </p>
      </div>

      <div
        className={`mt-auto font-black uppercase tracking-[0.3em] ${curseDef ? 'text-red-500' : 'text-slate-400'} ${panel || small || matchHandCard ? 'hidden' : 'block pt-3 text-[8px] sm:text-[10px]'}`}
      >
        {curseDef ? 'Curse' : `${cardId} / 21`}
      </div>

      {(curseRackPeek || !disabled || destroyed) &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popRef}
            style={tooltipStyle}
            className={`rounded-xl px-3 py-2.5 shadow-[0_16px_50px_rgba(0,0,0,0.65)] backdrop-blur-md ${
              curseDef ? 'border border-red-600/50 bg-zinc-950/98' : 'border border-yellow-500/40 bg-slate-950/98'
            } ${destroyed ? 'ring-1 ring-orange-500/35' : ''}`}
            aria-hidden={!tipOpen}
          >
            <div className="flex gap-3 items-start text-left">
              <div className={`shrink-0 rounded-lg p-2 border ${curseDef ? 'bg-black border-red-900' : 'bg-slate-900 border-slate-700'}`}>
                {curseDef ? (
                  <CursePowerIcon
                    curseId={cardId}
                    className={`h-[26px] w-[26px] ${cursePowerIconClass(cardId)}`}
                  />
                ) : (
                  <MajorArcanaIconGlyph
                    iconName={card!.icon}
                    className="text-yellow-400"
                    size={panel ? 24 : small ? 20 : 26}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className={`font-black text-[11px] uppercase tracking-wide border-b pb-1 mb-1.5 ${
                    curseDef ? 'text-red-400 border-red-600/30' : 'text-yellow-400/95 border-yellow-500/25'
                  }`}
                >
                  {curseDef ? curseDef.name : card!.name}
                </p>
                <p className="text-sm leading-snug text-slate-100 font-medium normal-case">{curseDef ? curseDef.description : card!.description}</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {destroyed && small && (
        <span className="absolute bottom-0 left-0 right-0 text-[5px] font-black uppercase tracking-tighter text-center text-orange-100 bg-black/60 py-0.5 pointer-events-none z-[60]">
          Blocked
        </span>
      )}
    </motion.div>
  );
};
