import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BicepsFlexed,
  BookOpen,
  BookType,
  ChevronRight,
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
  RotateCcw,
  Scale,
  Skull,
  Sparkles,
  Star,
  Sun,
  Wand2,
  Waves,
  Eye,
  Shield,
  Anchor,
  ZapOff
} from 'lucide-react';
import { DESPERATION_SLICES, parseCard } from '../services/gameService';
import { MAJOR_ARCANA, PlayerRole, Suit, SUITS } from '../types';
import { SuitGlyph, SuitWheelMarkerG } from './SuitGlyphs';

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

export const DesperationWheel: React.FC<{
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
  const rotation = useMemo(() => -(360 * 15 + (offset * 360)), [offset]);

  useEffect(() => {
    if (isSpinning) {
      setShowResult(false);
      const timer = setTimeout(() => setShowResult(true), 12000);
      return () => clearTimeout(timer);
    }
    if (result) setShowResult(true);
  }, [isSpinning, result]);

  return (
    <div className={`absolute inset-0 z-[200] flex flex-col items-center justify-center p-4 overflow-hidden rounded-3xl transition-all duration-1000 ${isSpectator ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/95 backdrop-blur-2xl'}`}>
      {!isSpectator && (
        <div className="absolute top-8 left-8 space-y-4 hidden sm:block">
          <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest border-l-4 border-purple-400 pl-3">Desperation</h3>
          <div className="space-y-4">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${i + 1 === currentTier ? 'bg-purple-500 shadow-[0_0_10px_purple]' : 'bg-emerald-900/40'}`} />
                <span className={`text-[9px] font-black uppercase transition-colors ${i + 1 === currentTier ? 'text-white' : 'text-emerald-800'}`}>{tier}</span>
                {i + 1 === currentTier && <ChevronRight className="w-3 h-3 text-purple-500" />}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className={`relative transition-all duration-1000 ${isSpectator ? 'scale-50 sm:scale-75 -translate-y-12' : 'scale-100'} mb-8`}>
        <div className="relative w-72 h-72 sm:w-[480px] sm:h-[480px]">
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: isSpinning ? rotation : -(offset * 360) }}
            transition={{ duration: isSpinning ? 12 : 0.5, ease: [0.12, 0, 0, 1] }}
            className="w-full h-full rounded-full border-[10px] border-purple-900/40 relative shadow-[0_0_80px_rgba(168,85,247,0.2)] overflow-hidden"
          >
            <div className="absolute inset-0" style={{ background: `conic-gradient(${(() => {
              let currentW = 0;
              return DESPERATION_SLICES.map((slice, i) => {
                const start = (currentW / totalWeight) * 100;
                currentW += slice.weight;
                const end = (currentW / totalWeight) * 100;
                const color = slice.label === 'GAME OVER' ? '#2d0606' : i % 2 === 0 ? '#1e1b4b' : '#110e2d';
                return `${color} ${start}% ${end}%`;
              }).join(', ');
            })()})` }} />
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center z-20">
            {!isSpectator ? (
              <button onClick={() => !isSpinning && !result && onSpin(Math.random())} disabled={isSpinning || !!result} className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white/10 bg-purple-600 shadow-2xl flex items-center justify-center transition-all active:scale-95 group relative ${(isSpinning || !!result) ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-110 hover:bg-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.5)]'}`}>
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
        </div>
      </div>
      {!isSpinning && !result && !isSpectator && (
        <button onClick={onClose} className="text-[10px] font-black text-emerald-800 uppercase hover:text-white transition-all flex items-center gap-2 group">
          <RotateCcw className="w-4 h-4 group-hover:rotate-[-90deg] transition-transform" /> ABORT
        </button>
      )}
      {showResult && result && !isSpectator && (
        <button onClick={onResolve} className="bg-white text-emerald-950 px-20 py-4 rounded-full font-black uppercase tracking-[0.1em] text-[15px] transition-all hover:bg-yellow-400 active:scale-95 shadow-[0_0_60px_rgba(255,255,255,0.3)] animate-pulse">
          {result === 'GAME OVER' ? 'TERMINATE' : 'EXECUTE RECOVERY'}
        </button>
      )}
    </div>
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
}

export const CardVisual: React.FC<CardVisualProps> = ({ card, selected, onClick, disabled, revealed = true, role, delay = 0, noAnimate = false }) => {
  const { suit, value, isJoker } = useMemo(() => (revealed ? parseCard(card) : { suit: '', value: '', isJoker: false }), [card, revealed]);
  const isMoonSuit = suit === 'Moons';
  const entrance = noAnimate ? {} : {
    initial: { x: 300, y: -100, opacity: 0, rotate: 45, scale: 0.5 },
    animate: { x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 },
    transition: { type: 'spring', damping: 20, stiffness: 100, delay }
  };

  if (!revealed) {
    const isPredator = role === 'Predator';
    const isPreydator = role === 'Preydator';
    let backClasses = 'bg-blue-950 border-blue-800/80 text-blue-500 bg-[radial-gradient(circle_at_center,#172554_1px,transparent_1px)] bg-[size:8px_8px]';
    if (isPredator) backClasses = 'bg-red-950 border-red-800/80 text-red-500 bg-[radial-gradient(circle_at_center,#450a0a_1px,transparent_1px)] bg-[size:8px_8px]';
    else if (isPreydator) backClasses = 'bg-purple-950 border-purple-800/80 text-purple-500 bg-[radial-gradient(circle_at_center,#3b0764_1px,transparent_1px)] bg-[size:8px_8px]';
    return (
      <motion.div layout {...entrance} whileHover={!disabled ? { y: -8, zIndex: 50 } : {}} className={`w-10 h-14 sm:w-16 sm:h-24 rounded-lg shadow-xl flex items-center justify-center p-1.5 border-2 transition-colors relative ${backClasses}`}>
        {isPreydator ? <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-60"><div className="w-6 h-6"><WolfIcon /></div><Rabbit className="w-6 h-6 text-purple-400" /></div> : isPredator ? <WolfIcon /> : <Rabbit className="w-full h-full opacity-60" />}
      </motion.div>
    );
  }

  return (
    <motion.div layout {...entrance} whileHover={!disabled ? { y: -10, zIndex: 50, scale: 1.05 } : {}} whileTap={!disabled ? { scale: 0.95 } : {}} onClick={onClick}
      className={`w-12 h-18 sm:w-24 sm:h-36 border-2 rounded-lg shadow-xl flex flex-col justify-between p-2 cursor-pointer relative overflow-hidden transition-all ${isMoonSuit ? 'bg-black' : 'bg-white'} ${selected ? 'border-yellow-400 ring-4 ring-yellow-400/30' : 'border-gray-200'} ${disabled ? 'opacity-60 grayscale cursor-not-allowed' : ''}`}>
      <div className={`flex flex-col items-start leading-[0.7] ${SUIT_COLORS[suit]}`}>
        <span className="text-sm sm:text-xl font-black font-mono tracking-tighter">{value}</span>
        {isJoker ? <span className="text-lg sm:text-3xl">🃏</span> : <SuitGlyph suit={suit} className="text-lg sm:text-3xl w-6 h-6 sm:w-10 sm:h-10" />}
      </div>
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${SUIT_COLORS[suit]} opacity-[0.12]`}>
        {isJoker ? <span className="text-5xl sm:text-8xl">🃏</span> : <SuitGlyph suit={suit} className="text-5xl sm:text-8xl w-[2.8rem] h-[2.8rem] sm:w-[5.5rem] sm:h-[5.5rem]" />}
      </div>
      <div className={`flex flex-col items-start leading-[0.7] self-end rotate-180 ${SUIT_COLORS[suit]}`}>
        <span className="text-sm sm:text-xl font-black font-mono tracking-tighter">{value}</span>
        {isJoker ? <span className="text-lg sm:text-3xl">🃏</span> : <SuitGlyph suit={suit} className="text-lg sm:text-3xl w-6 h-6 sm:w-10 sm:h-10" />}
      </div>
    </motion.div>
  );
};

export const PowerCardVisual: React.FC<{
  cardId: number;
  revealed?: boolean;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  small?: boolean;
  destroyed?: boolean;
}> = ({ cardId, revealed = true, onClick, selected, disabled, small = false, destroyed = false }) => {
  const card = MAJOR_ARCANA[cardId];
  const tip = card ? `${card.name}: ${card.description}` : '';
  const IconComponent = useMemo(() => {
    const icons: Record<string, any> = { Sparkles, Wand2, Eye, Crown, Shield, BookOpen, Heart, RefreshCw, Scale, Anchor, Skull, Waves, Flame, ZapOff, Star, Moon, Sun, Globe, BookType, FastForward, BicepsFlexed, Lamp, Gavel };
    return icons[card.icon] || Sparkles;
  }, [card.icon]);

  if (!revealed) {
    return <motion.div whileHover={!disabled ? { scale: 1.1, rotateY: 10 } : {}} onClick={onClick} className={`${small ? 'w-14 h-22' : 'w-32 h-52 sm:w-40 sm:h-64'} bg-slate-300 border-2 border-slate-400 rounded-lg shadow-lg flex items-center justify-center relative overflow-hidden bg-[radial-gradient(circle_at_center,#94a3b8_1px,transparent_1px)] bg-[size:10px_10px] perspective-1000 ${selected ? 'ring-4 ring-yellow-400' : ''} ${disabled ? 'opacity-50 grayscale' : 'cursor-pointer'}`}><div className="text-slate-500 font-black text-2xl sm:text-4xl">🃳</div></motion.div>;
  }

  return (
    <motion.div
      layout
      title={tip}
      whileHover={!disabled ? { scale: small ? 1.14 : 1.06, zIndex: 200, transition: { type: 'spring', stiffness: 380, damping: 28 } } : {}}
      onClick={onClick}
      className={`${small ? 'w-18 h-28 text-[9px]' : 'w-52 h-80 sm:w-64 sm:h-96 text-[12px]'} group relative bg-slate-50 border-4 border-slate-800 rounded-2xl shadow-2xl p-3 flex flex-col items-center text-center justify-between overflow-visible ${selected ? 'ring-4 ring-yellow-400 border-yellow-500' : ''} ${disabled ? 'opacity-50 grayscale' : 'cursor-pointer'} ${destroyed ? 'opacity-[0.48] grayscale border-orange-950 ring-2 ring-orange-600/35' : ''} transition-shadow origin-center`}
    >
      <div className="absolute top-0 left-0 w-full h-full bg-linear-to-b from-white/20 to-slate-900/5 pointer-events-none rounded-[13px] overflow-hidden" />
      <div className="flex flex-col items-center gap-0.5 z-10 w-full mb-1">
        <span className={`font-black border-b-2 border-slate-800 w-full pb-1 px-1 uppercase tracking-tighter leading-[0.9] text-slate-800 ${small ? 'text-[8px]' : 'text-[18px] sm:text-[32px]'}`}>{card.name}</span>
        {!small && (
          <span className="font-mono text-slate-400 font-bold italic text-[6px] sm:text-[9px] tracking-[0.2em] uppercase opacity-70">Power card</span>
        )}
      </div>
      <div className={`z-10 bg-slate-900 ${small ? 'p-1.5' : 'p-4 sm:p-6'} rounded-full border-2 border-slate-800 shadow-xl group-hover:scale-105 transition-transform my-2`}>
        <IconComponent className="text-yellow-400" size={small ? 16 : 40} />
      </div>
      <div className={`text-slate-700 font-bold leading-snug z-10 w-full px-2 mt-auto ${small ? 'hidden' : 'block'}`}>
        <p className={`text-slate-500 font-medium ${small ? 'text-[7px]' : 'text-[11px] sm:text-sm'} line-clamp-3 min-h-[3em]`}>{card.description}</p>
      </div>
      <div className={`mt-auto pt-3 font-black text-slate-400 uppercase tracking-[0.3em] ${small ? 'hidden' : 'block text-[8px] sm:text-[10px]'}`}>{cardId} / 21</div>
      {!disabled && (
        <div className="absolute left-1/2 top-full z-[300] mt-2 w-[min(22rem,calc(100vw-1.25rem))] max-w-[calc(100vw-1.25rem)] -translate-x-1/2 rounded-xl border border-yellow-500/40 bg-slate-950/98 px-3 py-2.5 shadow-[0_16px_50px_rgba(0,0,0,0.65)] backdrop-blur-md pointer-events-none opacity-0 translate-y-1 scale-[0.98] group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-200 ease-out">
          <div className="flex gap-3 items-start text-left">
            <div className="shrink-0 rounded-lg bg-slate-900 p-2 border border-slate-700">
              <IconComponent className="text-yellow-400" size={small ? 20 : 26} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-yellow-400/95 font-black text-[11px] uppercase tracking-wide border-b border-yellow-500/25 pb-1 mb-1.5">{card.name}</p>
              <p className="text-sm leading-snug text-slate-100 font-medium normal-case">{card.description}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export const TargetSuitWheel: React.FC<{ suit: Suit | null; isSpinning: boolean; offset?: number; availableSuits?: Suit[] }> = ({ suit, isSpinning, offset = 0.5, availableSuits = SUITS as unknown as Suit[] }) => {
  const rotation = useMemo(() => {
    const suitIndex = availableSuits.indexOf(suit || availableSuits[0]);
    const sliceAngle = 360 / availableSuits.length;
    const centerOffset = sliceAngle / 2;
    const jitter = ((offset - 0.5) * (sliceAngle * 0.8));
    return -(360 * 8 + suitIndex * sliceAngle + centerOffset - jitter);
  }, [suit, offset, availableSuits]);

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <div className="absolute -top-6 z-10 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]"><div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-yellow-400" /></div>
      <motion.div animate={{ rotate: rotation }} transition={isSpinning ? { duration: 5, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }} className="w-full h-full rounded-full border-8 border-emerald-950 overflow-hidden bg-emerald-950 relative shadow-[0_0_60px_rgba(0,0,0,0.9)]">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {availableSuits.map((s, i) => {
            const angle = 360 / availableSuits.length;
            const startAngle = i * angle;
            const endAngle = (i + 1) * angle;
            const x1 = 50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180);
            const y1 = 50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180);
            const x2 = 50 + 50 * Math.cos((endAngle - 90) * Math.PI / 180);
            const y2 = 50 + 50 * Math.sin((endAngle - 90) * Math.PI / 180);
            const centerAngle = startAngle + angle / 2;
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
                <path d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} fill={fillColor} stroke="#1e293b" strokeWidth="0.5" />
                <g transform={`rotate(${centerAngle} 50 50)`}>
                  <SuitWheelMarkerG suit={s} size={11} x={50} y={19} fill={markFill} />
                </g>
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 m-auto w-12 h-12 bg-emerald-900 rounded-full border-4 border-emerald-800 flex items-center justify-center z-20 shadow-inner"><Skull className="w-5 h-5 text-emerald-400" /></div>
      </motion.div>
    </div>
  );
};
