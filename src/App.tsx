/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  RotateCcw,
  Plus,
} from 'lucide-react';
import { GameService, parseCard, DESPERATION_SLICES, desperationSpinAllowed } from './services/gameService';
import { usePowerTooltipPosition } from './hooks/usePowerTooltipPosition';
import { RoomData, PlayerData, Suit, CARD_UNICODE, SUITS, PlayerRole, Difficulty, GameSettings, MAJOR_ARCANA, ResolutionEvent, ResolutionEventType } from './types';
import { FortuneWheelVisual, PowerDecisionModal } from './components/PowerInteraction';
import { OpponentDecisionStrip } from './components/OpponentDecisionStrip';
import { SuitGlyph, SuitWheelMarkerG } from './components/SuitGlyphs';

const SUIT_COLORS: Record<string, string> = {
  Hearts: 'text-red-500',
  Diamonds: 'text-red-400',
  Clubs: 'text-emerald-400',
  Spades: 'text-blue-400',
  Stars: 'text-yellow-400',
  Moons: 'text-white',
  Frogs: 'text-lime-400',
  Coins: 'text-amber-400',
  Bones: 'text-stone-300',
  Joker: 'text-purple-400'
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
  Bones: 'Bone',
  Joker: '🃏'
};

function preySideLabel(role: PlayerRole): string {
  if (role === 'Predator') return 'Guest';
  if (role === 'Prey') return 'Host';
  return 'Either player';
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

const DesperationWheel: React.FC<{
  onSpin: (offset: number) => void;
  onClose: () => void;
  onResolve: () => void;
  isSpinning: boolean;
  result: string | null;
  offset: number;
  tiers: string[];
  currentTier: number;
  isSpectator?: boolean;
}> = ({ onSpin, onClose, onResolve, isSpinning, result, offset, tiers, currentTier, isSpectator = false }) => {
  const [showResult, setShowResult] = useState(false);
  
  const totalWeight = DESPERATION_SLICES.reduce((acc, s) => acc + s.weight, 0);

  const rotation = useMemo(() => {
    const extraSpins = 360 * 15; // 15 full spins for tension
    return -(extraSpins + (offset * 360));
  }, [offset]);

  useEffect(() => {
    if (isSpinning) {
      setShowResult(false);
      const timer = setTimeout(() => {
        setShowResult(true);
      }, 12000);
      return () => clearTimeout(timer);
    } else if (result) {
      setShowResult(true);
    }
  }, [isSpinning, result]);

  return (
    <div className={`
      absolute inset-0 z-[200] flex flex-col items-center justify-center p-4 overflow-hidden rounded-3xl transition-all duration-1000
      ${isSpectator ? "bg-black/40 backdrop-blur-sm" : "bg-black/95 backdrop-blur-2xl"}
    `}>
      {!isSpectator && (
        <div className="absolute top-8 left-8 space-y-4 hidden sm:block">
          <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest border-l-4 border-purple-400 pl-3">Desperation</h3>
          <div className="space-y-4">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${i + 1 === currentTier ? "bg-purple-500 shadow-[0_0_10px_purple]" : "bg-emerald-900/40"}`} />
                <span className={`text-[9px] font-black uppercase transition-colors ${i + 1 === currentTier ? "text-white" : "text-emerald-800"}`}>
                  {tier}
                </span>
                {i + 1 === currentTier && <ChevronRight className="w-3 h-3 text-purple-500" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {isSpectator && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30">
          <Skull className="w-8 h-8 text-purple-500 animate-pulse" />
          <span className="text-[11px] font-black text-purple-400 uppercase tracking-[0.4em] drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            OPPONENT SPINNING
          </span>
        </div>
      )}

      <div className={`relative transition-all duration-1000 ${isSpectator ? "scale-50 sm:scale-75 -translate-y-12" : "scale-100"} mb-8`}>
        <div className="relative w-72 h-72 sm:w-[480px] sm:h-[480px]">
          {/* External Rings */}
          <div className="absolute -inset-4 border border-purple-500/10 rounded-full animate-[spin_20s_linear_infinite]" />
          <div className="absolute -inset-8 border border-purple-500/5 rounded-full animate-[spin_30s_linear_infinite_reverse]" />
          
          <motion.div 
            initial={{ rotate: 0 }}
            animate={{ rotate: isSpinning ? rotation : -(offset * 360) }}
            transition={{ duration: isSpinning ? 12 : 0.5, ease: [0.12, 0, 0, 1] }}
            className="w-full h-full rounded-full border-[10px] border-purple-900/40 relative shadow-[0_0_80px_rgba(168,85,247,0.2)] overflow-hidden"
          >
            {/* Background Slices */}
            <div className="absolute inset-0" 
                 style={{ 
                   background: `conic-gradient(${
                     (() => {
                        let currentW = 0;
                        return DESPERATION_SLICES.map((slice, i) => {
                          const start = (currentW / totalWeight) * 100;
                          currentW += slice.weight;
                          const end = (currentW / totalWeight) * 100;
                          const color = slice.label === "GAME OVER" ? "#2d0606" : i % 2 === 0 ? "#1e1b4b" : "#110e2d";
                          return `${color} ${start}% ${end}%`;
                        }).join(", ");
                     })()
                   })`
                 }} 
            />
            
            {/* Divider Lines */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-20 pointer-events-none">
              {(() => {
                let divW = 0;
                return DESPERATION_SLICES.map((_, i) => {
                   divW += DESPERATION_SLICES[i].weight;
                   const angle = (divW / totalWeight) * 360;
                   const x2 = 50 + 50 * Math.cos(((angle - 90) * Math.PI) / 180);
                   const y2 = 50 + 50 * Math.sin(((angle - 90) * Math.PI) / 180);
                   return <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke="white" strokeWidth="0.2" />;
                });
              })()}
            </svg>

            {/* Precision Labels */}
            {(() => {
              let textWeight = 0;
              return DESPERATION_SLICES.map((slice, i) => {
    const angle = (slice.weight / totalWeight) * 360;
    const startAngle = (textWeight / totalWeight) * 360;
    textWeight += slice.weight;
    const midAngle = startAngle + angle / 2;
    return (
      <div 
        key={i}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ transform: `rotate(${midAngle - 90}deg)` }}
      >
        <div className="absolute right-[4%] w-[28%] flex items-center justify-center text-center">
          <span 
            className={`
              text-white font-black uppercase tracking-widest leading-none whitespace-nowrap
              ${slice.label === 'GAME OVER' ? 'text-[11px] sm:text-[15px] text-red-500' : 'text-[8px] sm:text-[11px] opacity-70'}
            `}
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}
          >
            {slice.label === "GAME OVER" ? "SYSTEM FAIL" : slice.label.toUpperCase().replace("GAIN", "DRAW")}
          </span>
        </div>
      </div>
    );
  });
})()}
          </motion.div>

          <div className="absolute inset-0 flex items-center justify-center z-20">
            {!isSpectator ? (
              <button 
                onClick={() => !isSpinning && !result && onSpin(Math.random())}
                disabled={isSpinning || !!result}
                className={`
                  w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white/10 bg-purple-600 shadow-2xl flex items-center justify-center
                  transition-all active:scale-95 group relative
                  ${(isSpinning || !!result) ? "opacity-50 grayscale cursor-not-allowed" : "hover:scale-110 hover:bg-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.5)]"}
                `}
              >
                <div className="bg-emerald-950 px-4 py-1.5 rotate-[-8deg] shadow-xl group-hover:rotate-0 transition-transform">
                  <span className="text-white text-xl sm:text-2xl font-black uppercase tracking-[0.1em] italic">SPIN</span>
                </div>
              </button>
            ) : (
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-purple-500/20 bg-purple-950 flex items-center justify-center">
                <Skull className="w-10 h-10 text-purple-700 animate-pulse" />
              </div>
            )}
          </div>

          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center">
            <div className="w-10 h-12 bg-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)]" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
          </div>
        </div>
      </div>

      <div className="text-center h-48 flex flex-col justify-center max-w-lg w-full">
        {isSpinning && !showResult && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-[14px] font-black text-purple-400 animate-pulse uppercase tracking-[0.5em] italic">SIMULATING OUTCOME</div>
            <div className="w-64 h-1 bg-emerald-950 rounded-full overflow-hidden border border-purple-500/20">
               <motion.div 
                 className="h-full bg-purple-500"
                 initial={{ width: "0%" }}
                 animate={{ width: "100%" }}
                 transition={{ duration: 12, ease: "linear" }}
               />
            </div>
            {isSpectator && <span className="text-[10px] text-emerald-800 uppercase font-black tracking-widest mt-2 animate-pulse">Monitoring Live Feed...</span>}
          </div>
        )}

        {showResult && result && (
          <motion.div initial={{ scale: 0.8, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="flex flex-col items-center gap-6">
             <div className="flex flex-col items-center">
               <span className="text-[11px] font-black text-purple-500 uppercase tracking-[0.5em] mb-2">{isSpectator ? 'Opponent spun' : 'Result'}</span>
               <div className={`text-5xl sm:text-7xl font-black uppercase tracking-tighter ${result === "GAME OVER" ? "text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]" : "text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]"}`}>
                 {result.toUpperCase().replace("GAIN", "DRAW")}
               </div>
             </div>
             
             {!isSpectator && (
               <button 
                 onClick={onResolve}
                 className="bg-white text-emerald-950 px-20 py-4 rounded-full font-black uppercase tracking-[0.1em] text-[15px] transition-all hover:bg-yellow-400 active:scale-95 shadow-[0_0_60px_rgba(255,255,255,0.3)] animate-pulse"
               >
                 {result === 'GAME OVER' ? 'End game' : 'Continue'}
               </button>
             )}
          </motion.div>
        )}

        {!isSpinning && !result && !isSpectator && (
          <div className="flex flex-col items-center gap-4">
            <div className="px-6 py-2 bg-purple-900/30 rounded-full border border-purple-500/20">
              <span className="text-[12px] font-black text-purple-400 uppercase tracking-[0.2em]">
                Desperation {currentTier} / {tiers.length}
              </span>
            </div>
            <p className="text-[11px] text-emerald-600 font-bold uppercase tracking-widest">{tiers[currentTier - 1]}</p>
            <button onClick={onClose} className="text-[10px] font-black text-emerald-800 uppercase hover:text-white transition-all flex items-center gap-2 group">
              <RotateCcw className="w-4 h-4 group-hover:rotate-[-90deg] transition-transform" /> ABORT
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface CardVisualProps {
  card: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  revealed?: boolean;
  role?: PlayerRole;
  delay?: number;
  noAnimate?: boolean;
  /** Round-resolution entrance: card lifts from below like drawing from the deck. */
  presentation?: 'default' | 'deckPull' | 'none';
  deckPullSide?: 'left' | 'right';
  /** Slower draw when famine / deliberate acquisition pacing is shown */
  presentationPace?: 'normal' | 'slow';
}

const WolfIcon = () => (
  <svg viewBox="0 0 100 125" className="w-full h-full opacity-60 fill-current">
    <path d="M84.9 34c6.4-7.7 7.9-18.6 3.6-27.8-.2-.5-.6-.8-1.1-1s-1-.2-1.5.1L65 15.1c-.5.2-1 .3-1.5.1C59.2 13.7 54.7 13 50 13s-9.2.8-13.4 2.2c-.5.2-1 .1-1.5-.1l-21-9.9c-.5-.2-1-.3-1.5-.1s-.9.5-1.1 1C7.1 15.3 8.6 26.3 15.1 34 8.6 43.7 5 55.2 5 67c0 1 .7 1.8 1.7 2l10.9 1.8c7.4 1.2 13.2 6.7 14.7 14l.1.7c1.2 5.5 6 9.4 11.5 9.5h12.2c5.5-.1 10.4-4.1 11.5-9.5l.1-.7c1.5-7.3 7.3-12.8 14.7-14L93.3 69c1-.2 1.7-1 1.7-2 0-11.8-3.6-23.3-10.1-33M54 91h-8v-2c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2zm27.8-24.2c-9 1.5-16.1 8.2-18 17.2l-.1.7c-.6 3-2.9 5.3-5.7 6.1V89c0-3.3-2.7-6-6-6h-4c-3.3 0-6 2.7-6 6v1.7c-2.8-.8-5.1-3.1-5.7-6.1l-.2-.6c-1.9-9-8.9-15.7-18-17.2L9 65.3c.4-11.9 4.6-23.4 12-32.7l3.5-4.4c.7-.9.5-2.1-.3-2.8s-2.1-.5-2.8.3l-3.5 4.4c-.1.2-.3.3-.4.5-4.5-5.9-5.8-13.9-3.2-20.9l19 9c1.5.7 3.1.8 4.5.3 3.8-1.3 7.9-2 12.1-2s8.3.7 12.1 2c1.5.5 3.1.4 4.5-.3l19-9c2.5 7 1.3 15-3.2 20.9-.1-.2-.2-.3-.4-.5l-3.5-4.4c-.7-.9-2-1-2.8-.3s-1 2-.3 2.8l3.5 4.4c7.4 9.3 11.7 20.8 12 32.7z"/>
    <path d="M35.8 49.7c-.8-.8-2-.8-2.8 0l-1.4 1.4c-3.1 3.1-3.1 8.2 0 11.3 1.6 1.5 3.6 2.3 5.7 2.3s4.1-.8 5.7-2.3l1.4-1.4c.4-.4.6-.9.6-1.4s-.2-1-.6-1.4zm-1.5 9.9c-1.6-1.6-1.6-4.1 0-5.7l5.7 5.7c-1.6 1.6-4.1 1.6-5.7 0m32.8-9.9c-.8-.8-2-.8-2.8 0l-8.5 8.5c-.8.8-.8 2 0 2.8l1.4 1.4c1.6 1.5 3.6 2.3 5.7 2.3s4.1-.8 5.7-2.3c3.1-3.1 3.1-8.2 0-11.3zm-1.4 9.9c-1.6 1.6-4.1 1.6-5.7 0l5.7-5.7c1.5 1.6 1.5 4.2 0 5.7"/>
  </svg>
);

const CardVisual: React.FC<CardVisualProps> = (props) => {
  const {
    card,
    selected,
    onClick,
    disabled,
    revealed = true,
    role,
    delay = 0,
    noAnimate = false,
    presentation = 'default',
    deckPullSide = 'left',
    presentationPace = 'normal',
  } = props;
  const { suit, value, isJoker } = useMemo(() => (revealed ? parseCard(card) : { suit: '', value: '', isJoker: false }), [card, revealed]);
  const isMoonSuit = suit === 'Moons';
  const deckSlow = presentationPace === 'slow' && presentation === 'deckPull';
  
  const entrance =
    noAnimate || presentation === 'none'
      ? {}
      : presentation === 'deckPull'
        ? {
            initial: {
              y: deckSlow ? 168 : 130,
              opacity: 0,
              rotateX: 22,
              rotateZ: deckPullSide === 'left' ? -6 : 6,
              scale: 0.82,
            },
            animate: { y: 0, opacity: 1, rotateX: 0, rotateZ: 0, scale: 1 },
            transition: {
              duration: deckSlow ? 1.35 : 0.58,
              delay: deckSlow ? delay * 1.25 : delay,
              ease: [0.22, 1, 0.36, 1],
            },
          }
        : {
            initial: { x: 300, y: -100, opacity: 0, rotate: 45, scale: 0.5 },
            animate: { x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 },
            transition: { type: 'spring', damping: 20, stiffness: 100, delay },
          };

  if (!revealed) {
    const isPredator = role === 'Predator';
    const isPreydator = role === 'Preydator';
    
    let backClasses = 'bg-blue-950 border-blue-800/80 text-blue-500 bg-[radial-gradient(circle_at_center,#172554_1px,transparent_1px)] bg-[size:8px_8px]';
    if (isPredator) {
      backClasses = 'bg-red-950 border-red-800/80 text-red-500 bg-[radial-gradient(circle_at_center,#450a0a_1px,transparent_1px)] bg-[size:8px_8px]';
    } else if (isPreydator) {
      backClasses = 'bg-purple-950 border-purple-800/80 text-purple-500 bg-[radial-gradient(circle_at_center,#3b0764_1px,transparent_1px)] bg-[size:8px_8px]';
    }

    return (
      <motion.div 
        layout
        {...entrance}
        whileHover={!disabled ? { y: -8, zIndex: 50 } : {}}
        className={`
          w-10 h-14 sm:w-16 sm:h-24 rounded-lg shadow-xl flex items-center justify-center p-1.5 border-2 transition-colors relative
          ${backClasses}
        `}
      >
        {isPreydator ? (
           <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-60">
              <div className="w-6 h-6"><WolfIcon /></div>
              <Rabbit className="w-6 h-6 text-purple-400" />
           </div>
        ) : isPredator ? <WolfIcon /> : <Rabbit className="w-full h-full opacity-60" />}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      {...entrance}
      style={{ transformPerspective: presentation === 'deckPull' ? 900 : undefined }}
      whileHover={!disabled ? { y: -10, zIndex: 50, scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={`
        w-12 h-18 sm:w-24 sm:h-36 border-2 rounded-lg shadow-xl flex flex-col justify-between p-2 cursor-pointer relative overflow-hidden transition-all
        ${presentation === 'deckPull' ? 'perspective-[900px] origin-bottom' : ''}
        ${isMoonSuit ? 'bg-black' : 'bg-white'}
        ${selected ? 'border-yellow-400 ring-4 ring-yellow-400/30' : 'border-gray-200'}
        ${disabled ? 'opacity-80 saturate-[0.72] brightness-95 cursor-not-allowed' : ''}
      `}
    >
      <div className={`flex flex-col items-start leading-[0.7] ${SUIT_COLORS[suit]}`}>
        <span className="text-sm sm:text-xl font-black font-mono tracking-tighter">{value}</span>
        <SuitGlyph suit={suit} className="w-5 h-5 sm:w-8 sm:h-8" />
      </div>
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`text-5xl sm:text-8xl opacity-[0.08] ${SUIT_COLORS[suit]}`}>
          {isJoker ? '🃏' : <SuitGlyph suit={suit} className="w-16 h-16 sm:w-24 sm:h-24" />}
        </div>
      </div>

      <div className={`flex flex-col items-start leading-[0.7] self-end rotate-180 ${SUIT_COLORS[suit]}`}>
        <span className="text-sm sm:text-xl font-black font-mono tracking-tighter">{value}</span>
        <SuitGlyph suit={suit} className="w-5 h-5 sm:w-8 sm:h-8" />
      </div>
    </motion.div>
  );
};

const PowerCardVisual: React.FC<{ 
  cardId: number, 
  revealed?: boolean, 
  onClick?: () => void, 
  selected?: boolean,
  disabled?: boolean,
  small?: boolean;
  /** Tower blocked — greyed but hover still shows text */
  destroyed?: boolean;
}> = ({ cardId, revealed = true, onClick, selected, disabled, small = false, destroyed = false }) => {
  const card = MAJOR_ARCANA[cardId];
  const tip = card ? `${card.name}: ${card.description}` : '';
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const tooltipStyle = usePowerTooltipPosition(tipOpen && !disabled, rootRef, popRef);
  
  const IconComponent = useMemo(() => {
    const iconName = card.icon;
    const icons: Record<string, any> = {
      Sparkles, Wand2, Eye, Crown, Shield, BookOpen, Heart, RefreshCw, Scale, 
      Anchor, Skull, Waves, Flame, ZapOff, Star, Moon, Sun, Globe,
      BookType, FastForward, BicepsFlexed, Lamp, Gavel
    };
    return icons[iconName] || Sparkles;
  }, [card.icon]);

  if (!revealed) {
    return (
      <motion.div 
        whileHover={!disabled ? { scale: 1.1, rotateY: 10 } : {}}
        onClick={onClick}
        className={`
          ${small ? 'w-14 h-22' : 'w-32 h-52 sm:w-40 sm:h-64'} 
          bg-slate-300 border-2 border-slate-400 rounded-lg shadow-lg flex items-center justify-center relative overflow-hidden
          bg-[radial-gradient(circle_at_center,#94a3b8_1px,transparent_1px)] bg-[size:10px_10px]
          perspective-1000
          ${selected ? 'ring-4 ring-yellow-400' : ''}
          ${disabled ? 'opacity-75 saturate-[0.72] brightness-95 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="absolute inset-0 bg-linear-to-br from-slate-400/20 to-transparent" />
        <div className="text-slate-500 font-black text-2xl sm:text-4xl">🃳</div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      ref={rootRef}
      layout
      title={tip}
      whileHover={!disabled ? { 
        scale: small ? 1.14 : 1.06, 
        zIndex: 200,
        transition: { type: 'spring', stiffness: 380, damping: 28 }
      } : {}}
      onMouseEnter={() => !disabled && setTipOpen(true)}
      onMouseLeave={() => setTipOpen(false)}
      onFocus={() => !disabled && setTipOpen(true)}
      onBlur={() => setTipOpen(false)}
      onClick={onClick}
      className={`
        ${small ? 'w-18 h-28 text-[9px]' : 'w-52 h-80 sm:w-64 sm:h-96 text-[12px]'}
        group relative bg-slate-50 border-4 border-slate-800 rounded-2xl shadow-2xl p-3 flex flex-col items-center text-center justify-between overflow-visible
        ${selected ? 'ring-4 ring-yellow-400 border-yellow-500' : ''}
        ${disabled ? 'opacity-80 saturate-[0.72] brightness-95 cursor-not-allowed' : 'cursor-pointer'}
        ${destroyed ? 'opacity-[0.48] grayscale border-orange-950 ring-2 ring-orange-600/35 shadow-[inset_0_0_24px_rgba(0,0,0,0.45)]' : ''}
        transition-shadow origin-center
      `}
    >
      <div className="absolute top-0 left-0 w-full h-full bg-linear-to-b from-white/20 to-slate-900/5 pointer-events-none rounded-[13px] overflow-hidden" />
      
      <div className="flex flex-col items-center gap-0.5 z-10 w-full mb-1">
         <span className={`font-black border-b-2 border-slate-800 w-full pb-1 px-1 uppercase tracking-tighter leading-[0.9] text-slate-800 ${small ? 'text-[8px]' : 'text-[18px] sm:text-[32px]'}`}>
            {card.name}
         </span>
         <span className="font-mono text-slate-400 font-bold italic text-[6px] sm:text-[9px] tracking-[0.2em] uppercase opacity-70 mt-1">Power card</span>
      </div>

      <div className={`z-10 bg-slate-900 ${small ? 'p-1.5' : 'p-4 sm:p-6'} rounded-full border-2 border-slate-800 shadow-xl group-hover:scale-105 transition-transform my-2`}>
        <IconComponent className="text-yellow-400" size={small ? 16 : 40} />
      </div>

      <div className={`text-slate-700 font-bold leading-snug z-10 w-full px-2 mt-auto ${small ? 'hidden' : 'block'}`}>
        <p className={`text-slate-500 font-medium ${small ? 'text-[7px]' : 'text-[11px] sm:text-sm'} line-clamp-3 min-h-[3em]`}>{card.description}</p>
      </div>

      <div className={`mt-auto pt-3 font-black text-slate-400 uppercase tracking-[0.3em] ${small ? 'hidden' : 'block text-[8px] sm:text-[10px]'}`}>
         {cardId} / 21
      </div>

      {!disabled &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popRef}
            style={tooltipStyle}
            className={`rounded-xl border border-yellow-500/40 bg-slate-950/98 px-3 py-2.5 shadow-[0_16px_50px_rgba(0,0,0,0.65)] backdrop-blur-md ${destroyed ? 'ring-1 ring-orange-500/35' : ''}`}
            aria-hidden={!tipOpen}
          >
            <div className="flex gap-3 items-start text-left">
              <div className="shrink-0 rounded-lg bg-slate-900 p-2 border border-slate-700">
                <IconComponent className="text-yellow-400" size={small ? 20 : 26} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-yellow-400/95 font-black text-[11px] uppercase tracking-wide border-b border-yellow-500/25 pb-1 mb-1.5">
                  {card.name}
                </p>
                <p className="text-sm leading-snug text-slate-100 font-medium normal-case">{card.description}</p>
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

interface TargetSuitWheelProps {
  suit: Suit | null;
  isSpinning: boolean;
  offset?: number;
  availableSuits?: Suit[];
}

const TargetSuitWheel: React.FC<TargetSuitWheelProps> = ({ suit, isSpinning, offset = 0.5, availableSuits = SUITS as any }) => {
  const rotation = useMemo(() => {
    const suitIndex = availableSuits.indexOf(suit || availableSuits[0]);
    const sliceAngle = 360 / availableSuits.length;
    const baseRotation = -(sliceAngle / 2); 
    const suitOffset = suitIndex * sliceAngle;
    const extraSpins = 360 * 8; 
    const sliceOffset = (offset * (sliceAngle - 10)) - (sliceAngle / 2 - 5);
    return baseRotation - suitOffset - extraSpins + sliceOffset;
  }, [suit, offset, availableSuits]);

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <div className="absolute -top-6 z-40 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]">
        <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[14px] border-t-yellow-500" />
      </div>

      <motion.div
        animate={{ rotate: rotation }}
        transition={isSpinning ? { duration: 5, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
        className="w-full h-full rounded-full border-8 border-emerald-950 overflow-hidden bg-emerald-950 relative shadow-[0_0_60px_rgba(0,0,0,0.9)]"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {availableSuits.map((s, i) => {
            const angle = 360 / availableSuits.length;
            const startAngle = i * angle;
            const endAngle = (i + 1) * angle;
            const centerAngle = startAngle + angle / 2;
            
            const x1 = 50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180);
            const y1 = 50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180);
            const x2 = 50 + 50 * Math.cos((endAngle - 90) * Math.PI / 180);
            const y2 = 50 + 50 * Math.sin((endAngle - 90) * Math.PI / 180);
            
            const largeArcFlag = angle > 180 ? 1 : 0;
            const path = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
            const fillColor = s === 'Moons' ? '#000000' : (s === 'Stars' ? '#1e1b4b' : (s === 'Diamonds' || s === 'Hearts' ? '#0f172a' : '#f8fafc'));
            const markFill =
              s === 'Moons'
                ? '#ffffff'
                : s === 'Stars'
                  ? '#facc15'
                  : s === 'Diamonds' || s === 'Hearts'
                    ? '#ef4444'
                    : '#0f172a';

            return (
              <g key={s}>
                <path d={path} fill={fillColor} stroke="#1e293b" strokeWidth="0.5" />
                <g transform={`rotate(${centerAngle} 50 50)`}>
                  <SuitWheelMarkerG suit={s} size={11} x={50} y={19} fill={markFill} />
                </g>
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-0 m-auto w-12 h-12 bg-emerald-900 rounded-full border-4 border-emerald-800 flex items-center justify-center z-20 shadow-inner">
          <Skull className="w-5 h-5 text-emerald-400" />
        </div>
      </motion.div>

      <div className="absolute inset-0 rounded-full bg-linear-to-tr from-white/10 to-transparent pointer-events-none z-30" />
    </div>
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
            {settings.tiers.length > 0 && (
              <p className="text-[11px] text-emerald-300/95 pl-4">
                Labels this match uses:{' '}
                <span className="font-semibold text-emerald-100">{settings.tiers.join(', ')}</span>
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
  deckCount?: number;
  handCards?: string[];
  onTrimDeck?: (removeCount: number) => void;
  onDiscardHandCard?: (cardId: string) => void;
}> = ({ onSelect, onClose, deckCount, handCards, onTrimDeck, onDiscardHandCard }) => {
  const icons: Record<string, any> = {
    Sparkles, Wand2, Eye, Crown, Shield, BookOpen, Heart, RefreshCw, Scale,
    Anchor, Skull, Waves, Flame, ZapOff, Star, Moon, Sun, Globe,
    BookType, FastForward, BicepsFlexed, Lamp, Gavel
  };

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
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-8">
        {MAJOR_ARCANA.map((card, i) => {
          const IconComp = icons[card.icon] || Sparkles;

          return (
            <button 
              key={i} 
              onClick={() => { onSelect(i); onClose(); }}
              className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-yellow-400/50 hover:bg-slate-800 transition-all text-left group"
            >
              <div className="bg-slate-800 p-2 rounded-lg group-hover:bg-yellow-400 group-hover:text-black transition-colors">
                <IconComp className="w-5 h-5" />
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
    </div>
  );
};

type ResolutionFx =
  | null
  | { kind: 'death_slash'; victimUid: string }
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
  | { kind: 'wheel_chaos'; uid: string };

function deriveResolutionFx(event: ResolutionEvent, hostUid: string, guestUid: string): ResolutionFx {
  const otherUid = (uid: string) => (uid === hostUid ? guestUid : hostUid);

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
    if (event.uid && (event.powerCardId === 1 || (event.cardId?.startsWith('Frogs') ?? false))) {
      return { kind: 'frog_curse', uid: event.uid };
    }
  }

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

/** Priority coin: identical ⚖ faces while spinning, then a clear predator / prey / preydator panel (no mirrored “backwards wolf”). */
const PriorityFlipCard: React.FC<{
  winnerUid: string | null;
  room: RoomData;
}> = ({ winnerUid, room }) => {
  const role = winnerUid ? room.players[winnerUid]?.role : null;
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const ms = winnerUid ? 4150 : 3400;
    const t = window.setTimeout(() => setLanded(true), ms);
    return () => window.clearTimeout(t);
  }, [winnerUid]);

  return (
    <div className="mb-6 flex flex-col items-center gap-4 [perspective:1400px]">
      <div className="relative h-[8rem] w-[12.5rem] sm:h-[8.5rem] sm:w-[13.25rem]">
        {!landed && (
          <motion.div
            initial={{ rotateY: -14, scale: 0.92, opacity: 0.88 }}
            animate={{ rotateY: [-14, 360 * 14], scale: 1, opacity: 1 }}
            transition={{ duration: 4.05, ease: [0.18, 0.72, 0.16, 0.99] }}
            className="absolute inset-0 origin-center [transform-style:preserve-3d]"
          >
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-amber-500/65 bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 text-amber-100 shadow-[0_12px_40px_rgba(245,158,11,0.28)]"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(0deg) translateZ(5px)',
              }}
            >
              <span className="text-4xl sm:text-5xl font-black text-amber-200/95 drop-shadow-lg">⚖</span>
              <span className="mt-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.32em] text-amber-300/90">Priority</span>
            </div>
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 border-amber-500/60 bg-gradient-to-br from-slate-950 via-amber-950/85 to-black text-amber-50 shadow-[0_12px_40px_rgba(251,191,36,0.22)]"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg) translateZ(5px)',
              }}
            >
              <span className="text-4xl sm:text-5xl font-black text-amber-200/95 drop-shadow-lg">⚖</span>
              <span className="mt-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.32em] text-amber-200/88">Priority</span>
            </div>
          </motion.div>
        )}

        {landed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateY: -6 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 overflow-hidden shadow-[0_16px_52px_rgba(0,0,0,0.5)]"
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
            if (event.uid && event.cardId) {
               setCurrentCards(prev => ({ ...prev, [event.uid!]: event.cardId! }));
            }
            break;
          case 'SUMMON_CARD':
            if (event.uid && event.cardId) {
               setSummoned(prev => ({ ...prev, [event.uid!]: event.cardId! }));
            }
            break;
          case 'POWER_TRIGGER':
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
          case 'TRANSFORM':
            if (event.uid && event.cardId) {
              setCurrentCards(prev => ({ ...prev, [event.uid!]: event.cardId! }));
            }
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
                  ? 1050
                  : 1150;
        if (fx?.kind === 'death_slash' || fx?.kind === 'tower_shield') pauseMs = Math.max(pauseMs, 1380);
        if (fx?.kind === 'judgement_flash' || fx?.kind === 'temperance_balance') pauseMs = Math.max(pauseMs, 1240);
        if (fx?.kind === 'fool_swap') pauseMs = Math.max(pauseMs, 1180);
        await new Promise(r => setTimeout(r, pauseMs));
        if (!active) return;
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
    };
  }, [outcome.events, outcome.cardsPlayed, room.hostUid, room.players]);

  const hostUid = room.hostUid;
  const guestUid = Object.keys(room.players).find(id => id !== hostUid)!;

  return (
    <div className="relative overflow-hidden flex flex-col items-center w-full h-full max-h-screen p-4 sm:p-6 justify-center rounded-2xl border border-slate-800/50 bg-[radial-gradient(ellipse_80%_55%_at_50%_0%,rgba(251,191,36,0.14),transparent_58%),linear-gradient(180deg,#020617_0%,#0f172a_50%,#020617_100%)] shadow-[inset_0_0_100px_rgba(15,23,42,0.55)]">
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

      <div className="relative flex-none mb-4">
        <AnimatePresence>
          {resolutionFx?.kind === 'lovers_hearts' && (
            <>
              <motion.div
                key="lover-h1"
                initial={{ opacity: 0, y: 8, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0.85], y: [8, -10, -4], scale: [0.5, 1.1, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75 }}
                className="pointer-events-none absolute -left-6 top-1/2 -translate-y-1/2 z-10"
              >
                <Heart className="w-5 h-5 text-pink-400 fill-pink-500/35 drop-shadow-[0_0_10px_rgba(244,114,182,0.6)]" />
              </motion.div>
              <motion.div
                key="lover-h2"
                initial={{ opacity: 0, y: 8, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0.85], y: [8, -14, -6], scale: [0.5, 1.05, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.75, delay: 0.06 }}
                className="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 z-10"
              >
                <Heart className="w-5 h-5 text-pink-400 fill-pink-500/35 drop-shadow-[0_0_10px_rgba(244,114,182,0.6)]" />
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center"
        >
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-widest">Table suit</span>
            <motion.div
              key={currentTarget || 'none'}
              initial={{ scale: 0.75, opacity: 0.4, filter: 'drop-shadow(0 0 0 rgba(251,191,36,0))' }}
              animate={{ scale: 1.06, opacity: 1, filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.45))' }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              className={`w-[3.35rem] h-[3.35rem] sm:w-16 sm:h-16 flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-600 shadow-2xl ${SUIT_COLORS[currentTarget || 'Hearts']}`}
            >
              <SuitGlyph suit={currentTarget || 'Hearts'} className="w-[2.35rem] h-[2.35rem] sm:w-11 sm:h-11 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]" />
            </motion.div>
            <span className="text-xs sm:text-sm font-black text-slate-400 uppercase tracking-widest">this round</span>
          </div>
        </motion.div>
      </div>

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
                  />
                  <AnimatePresence>
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

const OpposingHandOverlayStack: React.FC<{
  opponent: PlayerData;
  roomStatus: RoomData['status'];
  roomHasWinner: boolean;
  powerShowdown: boolean;
  opponentPendingDecision: any;
  opponentWheelDecisionSpinning: boolean;
}> = ({
  opponent,
  roomStatus,
  roomHasWinner,
  powerShowdown,
  opponentPendingDecision,
  opponentWheelDecisionSpinning,
}) => {
  return (
    <>
      {!powerShowdown && roomStatus === 'powering' && opponentPendingDecision && (
        <OpponentDecisionStrip opponentName={opponent.name} decision={opponentPendingDecision} />
      )}

      {(opponent.desperationSpinning || opponent.desperationResult) && !roomHasWinner && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center pt-1">
          <div className="rounded-xl border border-purple-500/45 bg-black/55 px-3 py-2.5 backdrop-blur-sm text-center max-w-[min(100%,18rem)]">
            <div className="flex items-center justify-center gap-2">
              <Skull className={`w-4 h-4 text-purple-400 ${opponent.desperationSpinning ? 'animate-pulse' : ''}`} />
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-300">{opponent.name} desperation</span>
            </div>
            {opponent.desperationSpinning ? (
              <p className="mt-1 text-[8px] font-black uppercase tracking-wider text-emerald-300/90">Spinning outcome...</p>
            ) : opponent.desperationResult ? (
              <p className={`mt-1 text-[10px] font-black uppercase tracking-wider ${opponent.desperationResult === 'GAME OVER' ? 'text-red-400' : 'text-yellow-300'}`}>
                {opponent.desperationResult.replace('GAIN', 'DRAW')}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {roomStatus === 'powering' && opponentWheelDecisionSpinning && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
          <div className="rounded-xl border border-amber-500/45 bg-black/55 px-3 py-2 mb-2 backdrop-blur-sm">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">
              Wheel spinning for {opponent.name}
            </span>
          </div>
          <FortuneWheelVisual
            spinning
            offset={opponentPendingDecision?.wheelOffset ?? 0}
            sizeClass="w-40 h-40 sm:w-52 sm:h-52"
          />
        </div>
      )}
    </>
  );
};

interface GameInstanceProps {
  instanceId: string;
  isDual?: boolean;
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
    }
  }, [room, room?.currentTurn, room?.status, room?.players[myUid]?.confirmed, myUid]);

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
    return () => {
      serviceRef.current.destroy();
    };
  }, []);

  const handleCreateRoom = async () => {
    if (!playerName) { setError('Please enter your name'); return; }
    setLoading(true);
    setError(null);
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
    const preyStarter =
      room.settings.difficulty === 'Fair'
        ? 10
        : room.settings.difficulty === 'Normal'
          ? 6
          : room.settings.difficulty === 'Hard'
            ? 4
            : 2;

    return (
      <div className="h-full flex flex-col p-6 space-y-6 overflow-y-auto">
        <div className="flex justify-between items-center bg-emerald-900/30 p-4 rounded-xl border border-emerald-800">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">TABLE LINK</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-mono font-black text-white">{roomId}</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(roomId);
                  setShowCopySuccess(true);
                  setTimeout(() => setShowCopySuccess(false), 2000);
                }}
                className="text-yellow-400 p-1"
              >
                {showCopySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="text-right">
             <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">STATUS</span>
             <div className="text-xs font-black text-emerald-400 animate-pulse uppercase">
               {Object.keys(room.players).length < 2
                 ? 'WAITING FOR PLAYER 2'
                 : isHost
                   ? guestLobbyReady
                     ? 'OPPONENT READY'
                     : 'WAITING FOR READY'
                   : guestLobbyReady
                     ? 'YOU ARE READY'
                     : 'CHECK SETTINGS & READY UP'}
             </div>
          </div>
        </div>

        {isHost ? (
          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-yellow-400 uppercase tracking-widest border-l-4 border-yellow-400 pl-3">Table setup</h3>
              
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-emerald-500 uppercase">Host Primary Identity</label>
                  <div className="flex bg-emerald-900/50 p-1 rounded-xl border border-emerald-800">
                    {(['Predator', 'Prey', 'Preydator'] as const).map(r => (
                      <button 
                        key={r}
                        onClick={() => handleUpdateSettings({...room.settings, hostRole: r})}
                        className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${room.settings.hostRole === r ? 'bg-yellow-400 text-emerald-950 shadow-lg' : 'text-emerald-500 hover:text-white'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-emerald-500 uppercase">
                      Handicap (smaller prey hand)
                      <span className="ml-2 text-yellow-500/80 normal-case opacity-90">Prey seats: {preyLab}</span>
                    </label>
                  </div>
                  <div className="flex bg-emerald-900/50 p-1 rounded-xl border border-emerald-800">
                    {(['Fair', 'Normal', 'Hard', 'Impossible'] as const).map(d => {
                      const hostIsPrey = room.settings.hostRole === 'Prey';
                      const guestIsPrey = room.settings.hostRole === 'Predator' || room.settings.hostRole === 'Preydator';
                      
                      let ratio = '';
                      if (d === 'Fair') ratio = '10 vs 10';
                      if (d === 'Normal') ratio = '10 vs 6';
                      if (d === 'Hard') ratio = '10 vs 4';
                      if (d === 'Impossible') ratio = '10 vs 2';

                      return (
                        <button 
                          key={d}
                          onClick={() => handleUpdateSettings({...room.settings, difficulty: d})}
                          className={`flex-1 py-3 px-1 text-[8px] font-black uppercase rounded-lg transition-all flex flex-col items-center gap-0.5 ${room.settings.difficulty === d ? 'bg-yellow-400 text-emerald-950 shadow-lg' : 'text-emerald-500 hover:text-white'}`}
                        >
                          <span>{d}</span>
                          <span className="opacity-70 text-[7px]">{ratio}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-3 py-3 bg-yellow-500/10 rounded-xl border border-yellow-500/30">
                     <p className="text-[11px] text-yellow-400 font-black leading-relaxed uppercase tracking-tight">
                        {room.settings.difficulty === 'Fair' && 'Fair: both seats start with ten cards.'}
                        {room.settings.difficulty === 'Normal' &&
                          `Normal: predator ten cards vs prey (${preyLab}) ${preyStarter} cards.`}
                        {room.settings.difficulty === 'Hard' &&
                          `Hard: predator ten vs prey (${preyLab}) ${preyStarter} cards.`}
                        {room.settings.difficulty === 'Impossible' &&
                          `Impossible: predator ten vs prey (${preyLab}) ${preyStarter} cards — tiny margin for error.`}
                     </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handleUpdateSettings({...room.settings, disableJokers: !room.settings.disableJokers})}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${room.settings.disableJokers ? 'border-red-900/50 bg-red-950/20 text-red-500' : 'border-emerald-800 bg-emerald-900/20 text-emerald-500'}`}
                >
                  <Skull className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-black uppercase">Jokers</span>
                  <span className="text-[8px] font-bold">{room.settings.disableJokers ? 'DISABLED' : 'ACTIVE'}</span>
                </button>
                <button 
                  onClick={() => handleUpdateSettings({...room.settings, disablePowerCards: !room.settings.disablePowerCards})}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${room.settings.disablePowerCards ? 'border-red-900/50 bg-red-950/20 text-red-500' : 'border-emerald-800 bg-emerald-900/20 text-emerald-500'}`}
                >
                  <Zap className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-black uppercase">Power Cards</span>
                  <span className="text-[8px] font-bold">{room.settings.disablePowerCards ? 'DISABLED' : 'ACTIVE'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest border-l-4 border-purple-400 pl-3">Last-chance wheel</h3>
              <div className="bg-purple-950/20 border border-purple-900/50 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-purple-400 uppercase">Desperation wheel on</span>
                  <button 
                    onClick={() => handleUpdateSettings({...room.settings, enableDesperation: !room.settings.enableDesperation})}
                    className={`w-12 h-6 rounded-full relative transition-colors ${room.settings.enableDesperation ? 'bg-purple-600' : 'bg-emerald-900'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${room.settings.enableDesperation ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {room.settings.enableDesperation && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between gap-4 pb-2 border-b border-purple-900/40">
                      <span className="text-[10px] text-purple-100/95 leading-snug normal-case font-bold">
                        Tier 0 from deal: when on, prey begin at desperation tier 0. When off, they have no desperation tier until their first in-match spin, which moves them to tier 1.
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateSettings({
                            ...room.settings,
                            desperationStarterTierEnabled: !room.settings.desperationStarterTierEnabled
                          })
                        }
                        className={`shrink-0 w-12 h-6 rounded-full relative transition-colors ${
                          room.settings.desperationStarterTierEnabled ? 'bg-amber-500' : 'bg-emerald-900'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                            room.settings.desperationStarterTierEnabled ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div
                      className={`rounded-xl border p-4 space-y-3 transition-opacity ${
                        room.settings.hostRole !== 'Preydator'
                          ? 'opacity-40 pointer-events-none border-purple-950/55 bg-purple-950/10'
                          : 'border-purple-800/55 bg-purple-950/25'
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-purple-200 uppercase tracking-wider">
                          Preydator · desperation access
                        </span>
                        <span className="text-[9px] text-purple-400/95 leading-snug normal-case font-bold">
                          Only applies when Host role is Preydator. Outside that, prey-side rules stay default.
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { id: 'guest' as const, label: 'Guest only', sub: 'Prey-aligned seat spins' },
                            { id: 'host' as const, label: 'Host only', sub: 'Host seat spins' },
                            { id: 'both' as const, label: 'Both', sub: 'Either seat spins' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={room.settings.hostRole !== 'Preydator'}
                            onClick={() =>
                              handleUpdateSettings({ ...room.settings, preydatorDesperationSeats: opt.id })
                            }
                            className={`flex-1 min-w-[8rem] py-2 px-2 rounded-lg border text-left transition-all ${
                              (room.settings.preydatorDesperationSeats ?? 'guest') === opt.id &&
                              room.settings.hostRole === 'Preydator'
                                ? 'border-amber-400 bg-amber-400/15 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.15)]'
                                : 'border-purple-900/70 bg-purple-950/40 text-purple-300/90 hover:border-purple-600'
                            }`}
                          >
                            <span className="block text-[9px] font-black uppercase">{opt.label}</span>
                            <span className="block text-[7px] text-purple-500/95 font-bold mt-1 leading-tight">{opt.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {room.settings.tiers.map((tier, idx) => (
                      <div key={idx} className="flex gap-2">
                        <div className="bg-purple-900/50 border border-purple-800 rounded px-2 py-1 flex items-center justify-center min-w-[60px]">
                          <span className="text-[8px] font-black text-purple-300">TIER {idx}</span>
                        </div>
                        <input 
                          type="text"
                          value={tier}
                          onChange={(e) => {
                            const newTiers = [...room.settings.tiers];
                            newTiers[idx] = e.target.value;
                            handleUpdateSettings({...room.settings, tiers: newTiers});
                          }}
                          placeholder="Tier objective..."
                          className="flex-1 bg-emerald-900/50 border border-emerald-800 rounded px-3 py-1 text-[10px] text-white focus:outline-none focus:border-purple-500"
                        />
                        <button 
                          onClick={() => {
                            const newTiers = room.settings.tiers.filter((_, i) => i !== idx);
                            handleUpdateSettings({...room.settings, tiers: newTiers});
                          }}
                          className="text-red-500 hover:bg-red-950/40 p-1 rounded"
                        >
                          <Hash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => handleUpdateSettings({...room.settings, tiers: [...room.settings.tiers, `TIER ${room.settings.tiers.length}`]})}
                      className="w-full text-center py-2 border border-dashed border-purple-800 rounded text-[8px] font-black text-purple-400 uppercase hover:bg-purple-900/20"
                    >
                      + Add wheel tier label
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
               {Object.keys(room.players).length < 2 ? (
                  <div className="text-center py-4 bg-emerald-900/20 rounded-xl border border-dashed border-emerald-800">
                    <span className="text-[10px] font-black text-emerald-700 animate-pulse uppercase">WAITING FOR PLAYER 2...</span>
                  </div>
               ) : (
                  <button 
                    onClick={handleStartGame}
                    disabled={loading || Object.keys(room.players).length < 2 || !guestLobbyReady}
                    className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(250,204,21,0.3)] ${loading || Object.keys(room.players).length < 2 || !guestLobbyReady ? 'bg-emerald-900 text-emerald-700 cursor-not-allowed opacity-70' : 'bg-yellow-400 text-emerald-950 hover:scale-[1.02] active:scale-95'}`}
                  >
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>
                      <Play className="w-5 h-5" />
                      DEAL & START
                    </>}
                  </button>
               )}
               <p className="text-[8px] text-emerald-600 text-center font-bold uppercase tracking-tight leading-relaxed px-2">
                 {Object.keys(room.players).length >= 2 && !guestLobbyReady
                   ? 'You can tweak options until your opponent taps Ready on their screen.'
                   : 'Only the host can start once the guest has confirmed Ready.'}
               </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            {room.guestLobbyNotice && (
              <div className="rounded-xl border border-amber-500/60 bg-amber-950/50 px-4 py-4 text-center shadow-[0_0_28px_rgba(245,158,11,0.12)]">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-100">{room.guestLobbyNotice}</p>
                <p className="text-[10px] text-amber-400/90 mt-2 font-bold uppercase leading-snug">
                  Settings changed — tap Ready below after you have re-read everything.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-xs font-black text-yellow-400 uppercase tracking-widest border-l-4 border-yellow-400 pl-3">Host confirmed setup</h3>

              <div className="rounded-xl border border-emerald-800/80 bg-emerald-950/45 p-4 space-y-3">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Role focus</span>
                <div className="flex flex-wrap gap-2">
                  {(['Predator', 'Prey', 'Preydator'] as const).map(r => (
                    <div
                      key={r}
                      className={`min-w-[5.5rem] py-2 px-3 text-[10px] font-black uppercase rounded-full border ${
                        room.settings.hostRole === r
                          ? 'bg-yellow-400/95 text-emerald-950 border-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.26)]'
                          : 'bg-emerald-900/30 text-emerald-400 border-emerald-800/70'
                      }`}
                    >
                      {r}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-800/70 bg-emerald-950/35 p-4 space-y-2.5">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Handicap selected</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['Fair', 'Normal', 'Hard', 'Impossible'] as const).map(d => {
                    let ratio = '';
                    if (d === 'Fair') ratio = '10 vs 10';
                    if (d === 'Normal') ratio = '10 vs 6';
                    if (d === 'Hard') ratio = '10 vs 4';
                    if (d === 'Impossible') ratio = '10 vs 2';
                    const active = room.settings.difficulty === d;
                    return (
                      <div key={d} className={`rounded-lg border px-2 py-2 ${active ? 'border-yellow-300 bg-yellow-400/90 text-emerald-950' : 'border-emerald-800 bg-emerald-950/40 text-emerald-500'}`}>
                        <p className="text-[9px] font-black uppercase tracking-widest text-center">{d}</p>
                        <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-center opacity-80">{ratio}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-yellow-200/90 font-bold leading-snug normal-case pt-1">
                  {room.settings.difficulty === 'Fair' && 'Fair: both seats start with ten cards.'}
                  {room.settings.difficulty === 'Normal' &&
                    `Normal: predator ten cards vs prey (${preyLab}) ${preyStarter} cards.`}
                  {room.settings.difficulty === 'Hard' &&
                    `Hard: predator ten vs prey (${preyLab}) ${preyStarter} cards.`}
                  {room.settings.difficulty === 'Impossible' &&
                    `Impossible: predator ten vs prey (${preyLab}) ${preyStarter} cards.`}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-800/70 bg-emerald-950/30 p-4">
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider block mb-2">Deck options</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-lg border px-3 py-2.5 ${room.settings.disableJokers ? 'border-red-900/60 bg-red-950/20 text-red-300' : 'border-emerald-800 bg-emerald-900/35 text-emerald-200'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Skull className="w-3.5 h-3.5" /> Jokers</p>
                    <p className="mt-1 text-[8px] font-bold uppercase">{room.settings.disableJokers ? 'Removed' : 'In deck'}</p>
                  </div>
                  <div className={`rounded-lg border px-3 py-2.5 ${room.settings.disablePowerCards ? 'border-red-900/60 bg-red-950/20 text-red-300' : 'border-emerald-800 bg-emerald-900/35 text-emerald-200'}`}>
                    <p className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Power cards</p>
                    <p className="mt-1 text-[8px] font-bold uppercase">{room.settings.disablePowerCards ? 'Off' : 'Draft picks'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest border-l-4 border-purple-400 pl-3">Desperation wheel</h3>
              <div className="bg-purple-950/25 border border-purple-900/50 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-purple-200 uppercase tracking-wider">Enabled</span>
                  <span className={`text-[10px] font-black uppercase ${room.settings.enableDesperation ? 'text-purple-300' : 'text-slate-500'}`}>
                    {room.settings.enableDesperation ? 'Yes' : 'No'}
                  </span>
                </div>
                {room.settings.enableDesperation && (
                  <>
                    <div className="flex items-center justify-between gap-4 border-t border-purple-900/35 pt-3">
                      <span className="text-[10px] text-purple-100/95 leading-snug normal-case font-bold">
                        Tier 0 from deal (prey on ladder at deal)
                      </span>
                      <span className={`text-[10px] font-black shrink-0 ${room.settings.desperationStarterTierEnabled ? 'text-amber-300' : 'text-slate-500'}`}>
                        {room.settings.desperationStarterTierEnabled ? 'On' : 'Off'}
                      </span>
                    </div>
                    {room.settings.hostRole === 'Preydator' && (
                      <div className="flex items-center justify-between gap-4 border-t border-purple-900/35 pt-3">
                        <span className="text-[10px] text-purple-100/95 leading-snug font-bold uppercase tracking-tight">
                          Preydator spin access
                        </span>
                        <span className="text-[10px] font-black shrink-0 text-amber-200 text-right uppercase max-w-[52%]">
                          {(room.settings.preydatorDesperationSeats ?? 'guest') === 'host'
                            ? 'Host seat only'
                            : (room.settings.preydatorDesperationSeats ?? 'guest') === 'both'
                              ? 'Both seats'
                              : 'Guest seat only'}
                        </span>
                      </div>
                    )}
                    <div className="pt-1 border-t border-purple-900/35 space-y-2">
                      <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block">Tier labels</span>
                      <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {room.settings.tiers.map((tier, idx) => (
                          <li key={idx} className="text-[11px] text-purple-50/95 flex gap-2">
                            <span className="font-mono text-[9px] text-purple-500 w-14 shrink-0">Tier {idx}</span>
                            <span className="leading-snug">{tier}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void serviceRef.current.setLobbyReady(!guestLobbyReady)}
                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 border-2 transition-all ${
                  guestLobbyReady
                    ? 'bg-emerald-800/70 border-emerald-500 text-emerald-50 hover:bg-emerald-800'
                    : 'bg-yellow-400 border-yellow-300 text-emerald-950 hover:scale-[1.01]'
                }`}
              >
                {guestLobbyReady ? (
                  <>
                    <Check className="w-5 h-5" />
                    READY — TAP TO REVOKE
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    READY — LOCK IN TABLE
                  </>
                )}
              </button>
              <p className="text-[9px] text-center text-emerald-600 font-bold uppercase tracking-tight px-2">
                Ready tells the host you have reviewed the rules above. Changing host settings clears Ready.
              </p>
            </div>
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

  return (
    <div className="h-full bg-emerald-950/40 relative flex flex-col p-4 overflow-hidden border-x border-emerald-900/50">
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
      <DesperationVignette tier={me.desperationTier} totalTiers={room.settings.tiers.length} />

      {!powerShowdown && room.status === 'powering' && myPendingDecision && myPendingDecision.selectedOption === null && (
        <PowerDecisionModal
          decision={myPendingDecision}
          priestessLockedCard={myPendingDecision.powerCardId === 2 ? (room.engageMoves?.[myUid] ?? me.currentMove ?? null) : null}
          priestessHand={myPendingDecision.powerCardId === 2 ? me.hand : []}
          tableSuit={room.targetSuit ?? null}
          onSubmit={handleSubmitPowerDecision}
        />
      )}
      
      {isDevMenuOpen && (
        <DevPowerMenu 
          onSelect={(id) => serviceRef.current.cheatPowerCard(id)} 
          onClose={() => setIsDevMenuOpen(false)}
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
          tiers={room.settings.tiers}
          currentTier={
            me.desperationResult ? me.desperationTier : Math.max(1, me.desperationTier + 1)
          }
          isSpectator={false}
        />
      )}

      {/* Opponent desperation context is rendered in the opposing hand area. */}
      {/* HUD Small */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-emerald-500 uppercase">{roomId}</span>
            <button
               onClick={() => {
                 navigator.clipboard.writeText(roomId);
                 setShowCopySuccess(true);
                 setTimeout(() => setShowCopySuccess(false), 2000);
               }}
               className="text-emerald-700 hover:text-yellow-400"
            >
              {showCopySuccess ? <Check className="w-2 h-2" /> : <Copy className="w-2 h-2" />}
            </button>
          </div>
          <span className="text-xs font-black italic uppercase leading-none">{me.role}</span>
        </div>
        <div className="flex items-center justify-end gap-2 sm:gap-4 flex-wrap">
          <button 
            onClick={() => setIsDevMenuOpen(true)}
            className="p-2 rounded-lg bg-emerald-900/40 border border-emerald-800 text-emerald-600 hover:bg-yellow-400 hover:text-emerald-950 hover:border-yellow-500 transition-all flex items-center gap-2 text-[10px] font-black uppercase group"
          >
            <Sparkles className="w-3 h-3 group-hover:rotate-12" /> Dev
          </button>
          <button 
            onClick={() => setShowRules(true)}
            className="bg-yellow-400/20 text-yellow-400 hover:bg-yellow-400 hover:text-emerald-950 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border border-yellow-400/40 px-4 py-2 rounded-lg transition-all"
          >
            <Info className="w-4 h-4" /> Rules
          </button>
          <div className="flex items-center gap-2">
            {opponent?.confirmed && <Check className="w-3 h-3 text-yellow-400 animate-bounce" />}
            <span className="text-[10px] font-bold text-emerald-500 uppercase">{opponent?.name || '...'}</span>
          </div>
        </div>
      </div>

      {seenIntel && (
        <InsightModal 
          intel={seenIntel} 
          onClose={() => setSeenIntel(null)} 
        />
      )}

      {/* Opposing hand area (top mockup cards + opponent-only context overlays) */}
      {opponent && (
        <div className="relative mb-4">
          <div className="text-center mb-1">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Cards: {opponent.hand.length}</span>
          </div>
          <div className="flex justify-center -space-x-8 sm:-space-x-12 opacity-80 scale-90 sm:scale-100 flex-nowrap h-28 items-center px-4">
            {Array.from({ length: opponent.hand.length }).map((_, i) => (
              <CardVisual key={`opp-${i}`} card="" revealed={false} disabled role={opponent.role} delay={i * 0.08} />
            ))}
          </div>
          {/* Opponent Power Cards */}
          <div className="absolute right-0 top-0 flex flex-col gap-1 pr-2 opacity-60">
            {Array.from({ length: opponent.powerCards.length }).map((_, i) => (
               <PowerCardVisual key={`opp-p-${i}`} cardId={0} revealed={false} small />
            ))}
          </div>
          <OpposingHandOverlayStack
            opponent={opponent}
            roomStatus={room.status}
            roomHasWinner={Boolean(room.winner)}
            powerShowdown={powerShowdown}
            opponentPendingDecision={opponentPendingDecision}
            opponentWheelDecisionSpinning={opponentWheelDecisionSpinning}
          />
        </div>
      )}

      {/* Board Mini */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 relative">
          {/* Own Power Cards Stack */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-2 pl-2 z-40">
             {me.powerCards.map((pId, i) => (
               <PowerCardVisual 
                 key={`${pId}-${i}`} 
                 cardId={pId} 
                 small 
                 selected={selectedPowerCard === pId}
                 onClick={() => !me.confirmed && handleTogglePowerCard(pId)}
                 disabled={me.confirmed}
               />
             ))}
          </div>

          {/* Central Deck */}
         <div className="absolute right-12 top-1/2 -translate-y-1/2 hidden lg:flex flex-col items-center">
            <div className="relative group">
              {/* Stack of Cards */}
              <div className="relative w-20 h-28">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div 
                    key={i}
                    className="absolute inset-0 bg-purple-950 border-2 border-purple-600/50 rounded-lg shadow-2xl"
                    style={{ transform: `translate(${-i * 2}px, ${-i * 2}px)` }}
                  >
                    <div className="w-full h-full opacity-20 flex flex-col items-center justify-center p-3">
                       <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                          <WolfIcon />
                          <Rabbit className="w-8 h-8 text-purple-400" />
                       </div>
                    </div>
                    {/* Pattern Overlay */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,#ffffff_1px,transparent_1px)] bg-[size:10px_10px]" />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col items-center">
                <div className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em] font-mono">{room.deck.length}</div>
                <div className="text-[8px] font-bold uppercase text-emerald-800 tracking-widest">REMAINING</div>
              </div>
            </div>
          </div>

          {room.status === 'playing' || room.status === 'powering' ? (
            <div className="flex flex-col items-center transition-all duration-500">
               {opponent?.desperationTier > 0 && (
                 <div className="absolute top-0 flex flex-col items-center gap-1 bg-purple-950/40 border border-purple-800/50 px-4 py-1.5 rounded-full mb-4">
                    <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">Opponent desperation</span>
                    <span className="text-[10px] font-black text-white uppercase">{room.settings.tiers[opponent.desperationTier - 1]}</span>
                 </div>
               )}

               <span className="text-base sm:text-2xl md:text-3xl font-black uppercase tracking-[0.18em] sm:tracking-[0.22em] text-yellow-400 mb-8 sm:mb-10 text-center px-2 leading-tight max-w-[min(100%,28rem)]">
                 {room.status === 'powering'
                     ? powerShowdown
                     ? 'Cards locked — choose power effects next'
                     : 'Resolving power cards…'
                   : isWheelSpinning
                     ? 'DRAWING THIS ROUND’S TABLE SUIT…'
                     : 'TABLE SUIT FOR THIS ROUND'}
               </span>
               
               <AnimatePresence mode="wait">
                 {room.status === 'powering' && me.currentMove && opponent?.currentMove ? (
                   <motion.div
                     key="powering-cards"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="flex flex-col items-center gap-4"
                   >
                     {room.targetSuit && (
                       <div className="flex flex-col items-center gap-2 -mt-2 mb-2">
                         <span className="text-sm sm:text-base font-black uppercase tracking-widest text-slate-400">Table suit</span>
                         <div className={`flex items-center gap-3 sm:gap-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] ${SUIT_COLORS[room.targetSuit]}`}>
                           <SuitGlyph suit={room.targetSuit} className="w-10 h-10 sm:w-12 sm:h-12" />
                           <span className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight">{room.targetSuit}</span>
                         </div>
                       </div>
                     )}
                     <div className="flex items-center gap-8">
                       <div className="flex flex-col items-center gap-2">
                         <span className="text-[9px] uppercase font-black text-emerald-400">{me.name}</span>
                         <CardVisual card={me.currentMove} revealed />
                         {powerShowdown && me.currentPowerCard !== null && (
                           <div className="relative -mt-1 flex flex-col items-center gap-0.5">
                             <PowerCardVisual cardId={0} small revealed={false} />
                             <span className="text-[6px] font-black uppercase tracking-widest text-slate-500">Power</span>
                           </div>
                         )}
                       </div>
                       <div className="flex flex-col items-center gap-2">
                         <span className="text-[9px] uppercase font-black text-emerald-500">{opponent.name}</span>
                         <CardVisual card={opponent.currentMove} revealed />
                         {powerShowdown && opponent.currentPowerCard !== null && (
                           <div className="relative -mt-1 flex flex-col items-center gap-0.5">
                             <PowerCardVisual cardId={0} small revealed={false} />
                             <span className="text-[6px] font-black uppercase tracking-widest text-slate-500">Power</span>
                           </div>
                         )}
                       </div>
                     </div>
                    {myWheelDecisionSpinning && (
                       <div className="flex flex-col items-center gap-2">
                         <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">
                          Wheel spinning for {me.name}
                         </span>
                         <FortuneWheelVisual
                           spinning
                          offset={myPendingDecision?.wheelOffset ?? 0}
                           sizeClass="w-56 h-56 sm:w-72 sm:h-72"
                         />
                       </div>
                     )}
                   </motion.div>
                 ) : isWheelSpinning ? (
                   <motion.div
                     key="wheel"
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 1.2 }}
                   >
                     <TargetSuitWheel suit={room.status === 'results' ? (room.lastOutcome?.targetSuit || room.targetSuit) : room.targetSuit} isSpinning={isWheelSpinning} offset={room.wheelOffset} availableSuits={room.availableSuits} />
                   </motion.div>
                 ) : (
                   <motion.div
                     key="target-card"
                     initial={{ opacity: 0, rotateY: 90 }}
                     animate={{ opacity: 1, rotateY: 0 }}
                     className="flex flex-col items-center gap-3"
                   >
                     {/* The Target Card */}
                     <div
                       className={`
                         w-[7.25rem] h-[10.75rem] sm:w-[8.75rem] sm:h-[13.25rem] bg-yellow-400 rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.3)]
                         flex flex-col items-center justify-center border-4 border-yellow-200 relative
                       `}
                     >
                        <div className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden">
                          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[size:10px_10px]" />
                        </div>
                        {(() => {
                          const ts = (room.status === 'results' ? (room.lastOutcome?.targetSuit || room.targetSuit) : room.targetSuit) as Suit | null;
                          const color = ts ? SUIT_COLORS[ts] : '';
                          return ts ? (
                            <div className={`relative z-10 flex items-center justify-center ${color} drop-shadow-[0_6px_22px_rgba(0,0,0,0.35)]`}>
                              <SuitGlyph suit={ts} className="w-[4.75rem] h-[4.75rem] sm:w-[7.25rem] sm:h-[7.25rem]" />
                            </div>
                          ) : (
                            <span className="relative z-10 text-5xl font-black text-yellow-950">?</span>
                          );
                        })()}
                     </div>
                     <span
                       className={`text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight ${room.targetSuit ? SUIT_COLORS[room.targetSuit] : ''}`}
                     >
                       {room.targetSuit}
                     </span>
                   </motion.div>
                 )}
               </AnimatePresence>
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
                      <CardVisual
                        card={room.lastOutcome!.cardsPlayed[uid]}
                        revealed
                        presentation="none"
                        noAnimate
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

      {/* Hand Small */}
      <div className="mt-auto px-4 pb-4">
        {me.desperationTier > 0 && (
          <div className="flex flex-col items-center mb-2">
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest animate-pulse">
              Desperation Tier: {room.settings.tiers[me.desperationTier - 1]}
            </span>
          </div>
        )}

        <div className="flex justify-between items-end mb-2">
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
                      {room.settings.tiers[Math.max(0, me.desperationTier)]}
                    </span>
                  </button>
                </motion.div>
             )}
             {selectedCardIndex !== null && !me.confirmed && (
               <button onClick={handlePlayCard} disabled={loading} className="bg-yellow-400 text-emerald-950 px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-yellow-400/20 active:scale-90 transition-all">Play card</button>
             )}
             {me.confirmed && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Locked in — waiting</span>}
           </div>
        </div>
        <div className={`flex justify-center -space-x-8 sm:-space-x-12 flex-nowrap h-44 items-end transition-[filter,opacity] duration-300 ${me.confirmed ? 'saturate-[0.68] brightness-95 opacity-[0.92]' : ''}`}>
           {me.hand.map((card, i) => {
             const selected = selectedCardIndex === i;
             return (
               <motion.div
                 key={`${card}-${i}`}
                 animate={selected ? { y: -26, scale: 1.04 } : { y: 0, scale: 1 }}
                 transition={{ type: 'spring', stiffness: 310, damping: 24 }}
                 className="relative"
               >
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
                   onClick={() => !me.confirmed && setSelectedCardIndex(i)}
                   role={me.role}
                   delay={i * 0.08}
                 />
               </motion.div>
             );
           })}
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
                       {room.settings.tiers[me.desperationTier - 1]} 
                       {me.desperationResult && <span className="text-purple-400 ml-2">[{me.desperationResult}]</span>}
                    </span>
                  </div>
                )}
                {opponent && opponent.desperationTier > 0 && (
                  <div className="flex flex-col items-center opacity-60">
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Opponent&apos;s desperation tier</span>
                    <span className="text-xs text-purple-300 font-bold uppercase text-center">
                       {room.settings.tiers[opponent.desperationTier - 1]}
                       {opponent.desperationResult && <span className="text-purple-500 ml-2">[{opponent.desperationResult}]</span>}
                    </span>
                  </div>
                )}
             </div>
           )}
           <button onClick={() => setRoomId(null)} className="mt-8 text-[12px] text-emerald-500 hover:text-white uppercase font-black tracking-[0.3em] border border-emerald-800 px-8 py-3 rounded-full hover:bg-emerald-900 transition-all">Back to menu</button>
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
          <GameInstance 
            instanceId="p1"
          />
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
