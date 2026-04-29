/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Trophy, 
  ArrowLeft, 
  Copy, 
  Check, 
  Swords, 
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
  RotateCcw
} from 'lucide-react';
import { GameService, parseCard, DESPERATION_SLICES } from './services/gameService';
import { RoomData, PlayerData, Suit, CARD_UNICODE, SUITS, PlayerRole, Difficulty, GameSettings } from './types';

const SUIT_ICONS: Record<string, string> = {
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  Spades: '♠',
  Joker: '🃏'
};

const SUIT_COLORS: Record<string, string> = {
  Hearts: 'text-red-500',
  Diamonds: 'text-red-400',
  Clubs: 'text-emerald-400',
  Spades: 'text-blue-400',
  Joker: 'text-purple-400'
};

const DesperationVignette: React.FC<{ tier: number, totalTiers: number }> = ({ tier, totalTiers }) => {
  if (tier === 0 || totalTiers === 0) return null;
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
          <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest border-l-4 border-purple-400 pl-3">Desperation Protocol</h3>
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
        <div className="absolute right-[5%] w-[42%] flex items-center justify-center text-center">
          <span 
            className={`
              text-white font-black uppercase tracking-widest leading-tight
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
               <span className="text-[11px] font-black text-purple-500 uppercase tracking-[0.5em] mb-2">{isSpectator ? "OPPONENT DRAWN" : "OUTCOME ACQUIRED"}</span>
               <div className={`text-5xl sm:text-7xl font-black uppercase tracking-tighter ${result === "GAME OVER" ? "text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]" : "text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]"}`}>
                 {result.toUpperCase().replace("GAIN", "DRAW")}
               </div>
             </div>
             
             {!isSpectator && (
               <button 
                 onClick={onResolve}
                 className="bg-white text-emerald-950 px-20 py-4 rounded-full font-black uppercase tracking-[0.1em] text-[15px] transition-all hover:bg-yellow-400 active:scale-95 shadow-[0_0_60px_rgba(255,255,255,0.3)] animate-pulse"
               >
                 {result === "GAME OVER" ? "TERMINATE" : "EXECUTE RECOVERY"}
               </button>
             )}
          </motion.div>
        )}

        {!isSpinning && !result && !isSpectator && (
          <div className="flex flex-col items-center gap-4">
            <div className="px-6 py-2 bg-purple-900/30 rounded-full border border-purple-500/20">
              <span className="text-[12px] font-black text-purple-400 uppercase tracking-[0.2em]">PROTOCOL DEPTH: {currentTier} / {tiers.length}</span>
            </div>
            <p className="text-[11px] text-emerald-600 font-bold uppercase tracking-widest">{tiers[currentTier-1]}</p>
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
}

const WolfIcon = () => (
  <svg viewBox="0 0 100 125" className="w-full h-full opacity-60 fill-current">
    <path d="M84.9 34c6.4-7.7 7.9-18.6 3.6-27.8-.2-.5-.6-.8-1.1-1s-1-.2-1.5.1L65 15.1c-.5.2-1 .3-1.5.1C59.2 13.7 54.7 13 50 13s-9.2.8-13.4 2.2c-.5.2-1 .1-1.5-.1l-21-9.9c-.5-.2-1-.3-1.5-.1s-.9.5-1.1 1C7.1 15.3 8.6 26.3 15.1 34 8.6 43.7 5 55.2 5 67c0 1 .7 1.8 1.7 2l10.9 1.8c7.4 1.2 13.2 6.7 14.7 14l.1.7c1.2 5.5 6 9.4 11.5 9.5h12.2c5.5-.1 10.4-4.1 11.5-9.5l.1-.7c1.5-7.3 7.3-12.8 14.7-14L93.3 69c1-.2 1.7-1 1.7-2 0-11.8-3.6-23.3-10.1-33M54 91h-8v-2c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2zm27.8-24.2c-9 1.5-16.1 8.2-18 17.2l-.1.7c-.6 3-2.9 5.3-5.7 6.1V89c0-3.3-2.7-6-6-6h-4c-3.3 0-6 2.7-6 6v1.7c-2.8-.8-5.1-3.1-5.7-6.1l-.2-.6c-1.9-9-8.9-15.7-18-17.2L9 65.3c.4-11.9 4.6-23.4 12-32.7l3.5-4.4c.7-.9.5-2.1-.3-2.8s-2.1-.5-2.8.3l-3.5 4.4c-.1.2-.3.3-.4.5-4.5-5.9-5.8-13.9-3.2-20.9l19 9c1.5.7 3.1.8 4.5.3 3.8-1.3 7.9-2 12.1-2s8.3.7 12.1 2c1.5.5 3.1.4 4.5-.3l19-9c2.5 7 1.3 15-3.2 20.9-.1-.2-.2-.3-.4-.5l-3.5-4.4c-.7-.9-2-1-2.8-.3s-1 2-.3 2.8l3.5 4.4c7.4 9.3 11.7 20.8 12 32.7z"/>
    <path d="M35.8 49.7c-.8-.8-2-.8-2.8 0l-1.4 1.4c-3.1 3.1-3.1 8.2 0 11.3 1.6 1.5 3.6 2.3 5.7 2.3s4.1-.8 5.7-2.3l1.4-1.4c.4-.4.6-.9.6-1.4s-.2-1-.6-1.4zm-1.5 9.9c-1.6-1.6-1.6-4.1 0-5.7l5.7 5.7c-1.6 1.6-4.1 1.6-5.7 0m32.8-9.9c-.8-.8-2-.8-2.8 0l-8.5 8.5c-.8.8-.8 2 0 2.8l1.4 1.4c1.6 1.5 3.6 2.3 5.7 2.3s4.1-.8 5.7-2.3c3.1-3.1 3.1-8.2 0-11.3zm-1.4 9.9c-1.6 1.6-4.1 1.6-5.7 0l5.7-5.7c1.5 1.6 1.5 4.2 0 5.7"/>
  </svg>
);

const CardVisual: React.FC<CardVisualProps> = (props) => {
  const { card, selected, onClick, disabled, revealed = true, role, delay = 0, noAnimate = false } = props;
  const { suit, value, isJoker } = useMemo(() => (revealed ? parseCard(card) : { suit: '', value: '', isJoker: false }), [card, revealed]);
  
  const entrance = noAnimate ? {} : {
    initial: { x: 300, y: -100, opacity: 0, rotate: 45, scale: 0.5 },
    animate: { x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 },
    transition: { type: "spring", damping: 20, stiffness: 100, delay }
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
      whileHover={!disabled ? { y: -10, zIndex: 50, scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={`
        w-12 h-18 sm:w-24 sm:h-36 bg-white border-2 rounded-lg shadow-xl flex flex-col justify-between p-2 cursor-pointer relative overflow-hidden transition-all
        ${selected ? 'border-yellow-400 ring-4 ring-yellow-400/30' : 'border-gray-200'}
        ${disabled ? 'opacity-60 grayscale cursor-not-allowed' : ''}
      `}
    >
      <div className={`flex flex-col items-start leading-[0.7] ${SUIT_COLORS[suit]}`}>
        <span className="text-sm sm:text-xl font-black font-mono tracking-tighter">{value}</span>
        <span className="text-lg sm:text-3xl">{SUIT_ICONS[suit]}</span>
      </div>
      
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-5xl sm:text-8xl opacity-[0.08] ${SUIT_COLORS[suit]}`}>
          {isJoker ? '🃏' : SUIT_ICONS[suit]}
        </span>
      </div>

      <div className={`flex flex-col items-start leading-[0.7] self-end rotate-180 ${SUIT_COLORS[suit]}`}>
        <span className="text-sm sm:text-xl font-black font-mono tracking-tighter">{value}</span>
        <span className="text-lg sm:text-3xl">{SUIT_ICONS[suit]}</span>
      </div>
    </motion.div>
  );
};

interface TargetSuitWheelProps {
  suit: Suit | null;
  isSpinning: boolean;
  offset?: number;
}

const TargetSuitWheel: React.FC<TargetSuitWheelProps> = ({ suit, isSpinning, offset = 0.5 }) => {
  // Ordered Suits: Diamond -> Spade -> Heart -> Club
  const OrderedSuits: Suit[] = ['Diamonds', 'Spades', 'Hearts', 'Clubs'];
  
  const rotation = useMemo(() => {
    const suitIndex = OrderedSuits.indexOf(suit || 'Hearts');
    // baseRotation -45 puts the center of the first quarter at top.
    // We add room.wheelOffset * 80 - 40 to stay within the 90deg slice with 5deg padding.
    const sliceOffset = (offset * 80) - 40;
    const baseRotation = -45; 
    const suitOffset = suitIndex * 90;
    const extraSpins = 360 * 8; 
    return baseRotation - suitOffset - extraSpins + sliceOffset;
  }, [suit, offset]);

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Selector pointer */}
      <div className="absolute -top-6 z-10 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
        <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-yellow-400" />
      </div>

      <motion.div
        animate={isSpinning ? { rotate: rotation } : { rotate: rotation }}
        transition={isSpinning ? { duration: 5, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
        className="w-full h-full rounded-full border-8 border-emerald-950 overflow-hidden bg-emerald-950 relative shadow-[0_0_60px_rgba(0,0,0,0.8)]"
      >
        {OrderedSuits.map((s, i) => (
          <div
            key={s}
            className="absolute top-0 left-0 w-full h-full"
            style={{ 
              transform: `rotate(${i * 90}deg)`,
              backgroundColor: (s === 'Diamonds' || s === 'Hearts') ? '#000000' : '#FFFFFF',
              clipPath: 'polygon(50% 50%, 100% 50%, 100% 0, 50% 0)',
              borderRight: '1px solid rgba(128, 128, 128, 0.2)'
            }}
          >
            <div 
              className={`absolute top-[15%] left-[75%] -translate-x-1/2 flex flex-col items-center gap-1 ${SUIT_COLORS[s]}`}
              style={{ transform: `rotate(${-i * 90}deg)` }}
            >
              <span className="text-3xl filter drop-shadow-lg">{SUIT_ICONS[s]}</span>
            </div>
          </div>
        ))}
        {/* Hub */}
        <div className="absolute inset-0 m-auto w-12 h-12 bg-emerald-900 rounded-full border-4 border-emerald-800 flex items-center justify-center z-20">
          <Skull className="w-5 h-5 text-emerald-400" />
        </div>
      </motion.div>

      {/* Glass overlay */}
      <div className="absolute inset-0 rounded-full bg-linear-to-tr from-white/5 to-transparent pointer-events-none z-30" />
    </div>
  );
};

interface GameInstanceProps {
  instanceId: string;
  isDual?: boolean;
}

const GameInstance: React.FC<GameInstanceProps> = ({ instanceId, isDual }) => {
  const serviceRef = useRef(new GameService());
  const [playerName, setPlayerName] = useState(isDual ? `Tester ${instanceId.slice(-1)}` : '');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<RoomData | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showCopySuccess, setShowCopySuccess] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showDesperationWheel, setShowDesperationWheel] = useState(false);
  const [isWheelSpinning, setIsWheelSpinning] = useState(false);
  const lastTurnRef = useRef(0);
  const myUid = serviceRef.current.getUid();

  useEffect(() => {
    if (room?.currentTurn && room.status === 'playing') {
      setIsWheelSpinning(true);
      const timer = setTimeout(() => setIsWheelSpinning(false), 5000);
      lastTurnRef.current = room.currentTurn;
      return () => clearTimeout(timer);
    }
  }, [room?.currentTurn, room?.status]);

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
        if (state.status === 'playing' && state.players[myUid]?.confirmed === false) {
          setSelectedCard(null);
        }
      });
      setRoomId(id);
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
        if (state.status === 'playing' && state.players[myUid]?.confirmed === false) {
          setSelectedCard(null);
        }
      });
      setRoomId(roomCode);
    } catch (err: any) {
      setError(`Failed to join: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayCard = async () => {
    if (!selectedCard || !roomId) return;
    setLoading(true);
    try {
      await serviceRef.current.playCard(selectedCard);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
    const { cardsPlayed, winnerUid, message } = room.lastOutcome;
    const uids = Object.keys(cardsPlayed);
    
    const formatCard = (cardId: string) => {
      const { suit, value, isJoker } = parseCard(cardId);
      const color = (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black';
      const unicode = CARD_UNICODE[cardId] || (isJoker ? '🃏' : SUIT_ICONS[suit]);
      const fullName = isJoker ? 'The Joker' : `${value} of ${suit}`;
      return `[color=${color}]${unicode}[/color][sub](${fullName})[/sub]`;
    };

    const summary = `
[b]🃏 PREDATOR VS PREY - ROUND RESULTS 🃏[/b]
------------------------------------
${message}
Winner: ${winnerUid === 'draw' ? 'DRAW' : room.players[winnerUid].name}

Moves:
${uids.map(uid => `${room.players[uid].name}: ${formatCard(cardsPlayed[uid])}`).join('\n')}
------------------------------------
    `.trim();
    navigator.clipboard.writeText(summary);
    setShowCopySuccess(true);
    setTimeout(() => setShowCopySuccess(false), 2000);
  };

  const isHost = roomId && room && Object.keys(room.players)[0] === myUid;

  const handleUpdateSettings = (settings: any) => {
    serviceRef.current.syncSettings(settings);
  };

  const handleOpenDesperationWheel = () => {
    setShowDesperationWheel(true);
  };

  const handleSpinDesperation = async (offset: number) => {
    try {
      await serviceRef.current.spinDesperation();
    } catch (err: any) {
      setError(err.message);
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
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1">P2P Tactical Sandbox</p>
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
      ESTABLISHING P2P LINK...
    </div>
  );

  if (room.status === 'waiting') {
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
               {Object.keys(room.players).length < 2 ? 'WAITING FOR PLAYER 2' : 'READY TO ENGAGE'}
             </div>
          </div>
        </div>

        {isHost ? (
          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-yellow-400 uppercase tracking-widest border-l-4 border-yellow-400 pl-3">Combat Parameters</h3>
              
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
                      Engagement Difficulty 
                      <span className="ml-2 text-yellow-500/80">({room.settings.hostRole === 'Prey' ? 'Host' : 'Guest'} Size)</span>
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
                        {room.settings.difficulty === 'Fair' && "EQUAL FOOTING. BOTH SIDES HOLD FULL 10-CARD HANDS."}
                        {room.settings.difficulty === 'Normal' && `STANDARD HUNT. ${room.settings.hostRole === 'Predator' ? 'GUEST' : room.settings.hostRole === 'Prey' ? 'HOST' : 'TARGET'} ENTERS WITH 6 CARDS.`}
                        {room.settings.difficulty === 'Hard' && `DESPERATE SURVIVAL. ${room.settings.hostRole === 'Predator' ? 'GUEST' : room.settings.hostRole === 'Prey' ? 'HOST' : 'TARGET'} HOLDS ONLY 4 CARDS.`}
                        {room.settings.difficulty === 'Impossible' && `ONE MISTAKE ENDS IT. ${room.settings.hostRole === 'Predator' ? 'GUEST' : room.settings.hostRole === 'Prey' ? 'HOST' : 'TARGET'} HAS 2 CARDS.`}
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
              <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest border-l-4 border-purple-400 pl-3">Desperation Protocols</h3>
              <div className="bg-purple-950/20 border border-purple-900/50 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-purple-400 uppercase">Enable Desperation Mode</span>
                  <button 
                    onClick={() => handleUpdateSettings({...room.settings, enableDesperation: !room.settings.enableDesperation})}
                    className={`w-12 h-6 rounded-full relative transition-colors ${room.settings.enableDesperation ? 'bg-purple-600' : 'bg-emerald-900'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${room.settings.enableDesperation ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {room.settings.enableDesperation && (
                  <div className="space-y-3 pt-2">
                    {room.settings.tiers.map((tier, idx) => (
                      <div key={idx} className="flex gap-2">
                        <div className="bg-purple-900/50 border border-purple-800 rounded px-2 py-1 flex items-center justify-center min-w-[60px]">
                           <span className="text-[8px] font-black text-purple-300">TIER {idx + 1}</span>
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
                      onClick={() => handleUpdateSettings({...room.settings, tiers: [...room.settings.tiers, `TIER ${room.settings.tiers.length + 1}`]})}
                      className="w-full text-center py-2 border border-dashed border-purple-800 rounded text-[8px] font-black text-purple-400 uppercase hover:bg-purple-900/20"
                    >
                      + Add Protocol Tier
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
                    disabled={loading}
                    className="w-full py-4 bg-yellow-400 text-emerald-950 rounded-xl font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(250,204,21,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>
                      <Swords className="w-5 h-5" />
                      COMMENCE ENGAGEMENT
                    </>}
                  </button>
               )}
               <p className="text-[8px] text-emerald-600 text-center font-bold uppercase tracking-tight">Only the host can initiate combat</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-6">
            <h3 className="text-xs font-black text-yellow-400 uppercase tracking-widest border-l-4 border-yellow-400 pl-3">Host Strategy</h3>
            <div className="bg-emerald-900/20 border border-emerald-800 p-6 rounded-2xl space-y-6 grayscale opacity-60">
               <div className="space-y-2">
                 <span className="text-[10px] font-black text-emerald-500 uppercase">Host Identity</span>
                 <div className="text-xl font-black">{room.settings.hostRole}</div>
               </div>
               <div className="space-y-2">
                 <span className="text-[10px] font-black text-emerald-500 uppercase">Combat Difficulty</span>
                 <div className="text-xl font-black">{room.settings.difficulty}</div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-black text-emerald-500 uppercase">Jokers</span>
                   <span className="text-sm font-black">{room.settings.disableJokers ? 'OFF' : 'ON'}</span>
                 </div>
                 <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-black text-emerald-500 uppercase">Desperation</span>
                   <span className="text-sm font-black">{room.settings.enableDesperation ? 'ACTIVE' : 'OFF'}</span>
                 </div>
               </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-black text-emerald-600 animate-pulse">SYNCHRONIZING COMBAT PARAMETERS...</div>
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

  return (
    <div className="h-full bg-emerald-950/40 relative flex flex-col p-4 overflow-hidden border-x border-emerald-900/50">
      <DesperationVignette tier={me.desperationTier} totalTiers={room.settings.tiers.length} />
      
      {(showDesperationWheel || me.desperationSpinning || me.desperationResult) && !room.winner && (
        <DesperationWheel 
          onSpin={handleSpinDesperation}
          onClose={() => setShowDesperationWheel(false)}
          onResolve={handleResolveDesperation}
          isSpinning={me.desperationSpinning}
          result={me.desperationResult}
          offset={me.desperationOffset}
          tiers={room.settings.tiers}
          currentTier={me.desperationTier + 1}
          isSpectator={false}
        />
      )}

      {/* Opponent Desperation Sync */}
      {opponent && (opponent.desperationSpinning || opponent.desperationResult) && !room.winner && (
        <DesperationWheel 
          onSpin={() => {}}
          onClose={() => {}}
          onResolve={() => {}}
          isSpinning={opponent.desperationSpinning}
          result={opponent.desperationResult}
          offset={opponent.desperationOffset}
          tiers={room.settings.tiers}
          currentTier={opponent.desperationTier}
          isSpectator={true}
        />
      )}
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
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowRules(true)}
            className="text-emerald-500 hover:text-white flex items-center gap-1 text-[8px] font-black uppercase tracking-widest border border-emerald-800 px-2 py-1 rounded"
          >
            <Info className="w-2 h-2" /> Rules
          </button>
          <div className="flex items-center gap-2">
            {opponent?.confirmed && <Check className="w-3 h-3 text-yellow-400 animate-bounce" />}
            <span className="text-[10px] font-bold text-emerald-500 uppercase">{opponent?.name || '...'}</span>
          </div>
        </div>
      </div>

      {/* Opponent Hand Backs */}
      {opponent && (
        <div className="flex justify-center -space-x-8 sm:-space-x-12 mb-4 opacity-80 scale-90 sm:scale-100 flex-nowrap h-28 items-center px-4">
          {Array.from({ length: opponent.hand.length }).map((_, i) => (
            <CardVisual key={`opp-${i}`} card="" revealed={false} disabled role={opponent.role} delay={i * 0.08} />
          ))}
        </div>
      )}

      {/* Board Mini */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 relative">

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

          {room.status === 'playing' ? (
            <div className="flex flex-col items-center transition-all duration-500">
               {opponent?.desperationTier > 0 && (
                 <div className="absolute top-0 flex flex-col items-center gap-1 bg-purple-950/40 border border-purple-800/50 px-4 py-1.5 rounded-full mb-4">
                    <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">OPPONENT DESPERATION</span>
                    <span className="text-[10px] font-black text-white uppercase">{room.settings.tiers[opponent.desperationTier - 1]}</span>
                 </div>
               )}

               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-400 mb-6 h-4 text-center">
                 {isWheelSpinning ? 'RE-ALIGNING ENGAGEMENT PROTOCOLS...' : 'TARGET IDENTIFIED'}
               </span>
               
               <AnimatePresence mode="wait">
                 {isWheelSpinning ? (
                   <motion.div
                     key="wheel"
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 1.2 }}
                   >
                     <TargetSuitWheel suit={room.targetSuit} isSpinning={isWheelSpinning} offset={room.wheelOffset} />
                   </motion.div>
                 ) : (
                   <motion.div
                     key="target-card"
                     initial={{ opacity: 0, rotateY: 90 }}
                     animate={{ opacity: 1, rotateY: 0 }}
                     className="flex flex-col items-center gap-3"
                   >
                     {/* The Target Card */}
                     <div className={`
                       w-24 h-36 sm:w-32 sm:h-48 bg-yellow-400 rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.3)]
                       flex flex-col items-center justify-center border-4 border-yellow-200 relative overflow-hidden
                     `}>
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,#000_1px,transparent_1px)] bg-[size:10px_10px]" />
                        <span className={`text-7xl sm:text-9xl drop-shadow-2xl ${room.targetSuit ? SUIT_COLORS[room.targetSuit] : ''}`}>
                          {room.targetSuit ? SUIT_ICONS[room.targetSuit] : '?'}
                        </span>
                     </div>
                     <span className={`text-xs font-black uppercase tracking-widest ${room.targetSuit ? SUIT_COLORS[room.targetSuit] : ''}`}>
                       {room.targetSuit}
                     </span>
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          ) : room.status === 'results' && room.lastOutcome ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="mb-4">
                {room.lastOutcome.winnerUid !== 'draw' ? (
                  <div className="flex flex-col items-center">
                    <span className={`text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-2 ${
                      room.players[room.lastOutcome.winnerUid].role === 'Predator' ? 'text-red-500' :
                      room.players[room.lastOutcome.winnerUid].role === 'Prey' ? 'text-blue-400' :
                      'text-purple-500'
                    }`}>
                      {room.players[room.lastOutcome.winnerUid].name} WINS
                    </span>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">CLASH RESOLUTION COMPLETE</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-2 text-emerald-500">STALEMATE</span>
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">NO ASSETS RECOVERED</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-12 sm:gap-20 mb-12">
                {Object.entries(room.lastOutcome.cardsPlayed).map(([uid, card]) => (
                  <div key={uid} className="flex flex-col items-center gap-4">
                    <span className={`text-[10px] font-black uppercase ${uid === myUid ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      {room.players[uid].name}
                    </span>
                    <div className="relative">
                      <CardVisual card={card} noAnimate />
                      {room.lastOutcome?.winnerUid === uid && (
                        <motion.div 
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1.2, opacity: 1 }}
                          className="absolute -top-4 -right-4 bg-yellow-400 text-emerald-950 p-1.5 rounded-full shadow-lg z-10"
                        >
                          <Trophy className="w-4 h-4" />
                        </motion.div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <span className="text-sm font-bold text-white/80 max-w-xs mb-10">{room.lastOutcome.message}</span>
              
              <button 
                onClick={handleNextRound}
                disabled={me.readyForNextRound}
                className={`flex items-center gap-3 px-12 py-4 rounded-full font-black uppercase tracking-widest text-sm transition-all ${
                  me.readyForNextRound 
                    ? 'bg-emerald-900/30 text-emerald-700 border border-emerald-800' 
                    : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.3)]'
                }`}
              >
                {me.readyForNextRound ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Waiting for Response
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-5 h-5" />
                    Engage Next Round
                  </>
                )}
              </button>
            </motion.div>
          ) : null}
      </div>

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
             {me.hand.length === 1 && me.role !== 'Predator' && room.settings.enableDesperation && !me.confirmed && me.desperationTier < room.settings.tiers.length && (
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
                    <span className="relative z-10">Desperation Protocol</span>
                    <span className="text-[10px] opacity-60 relative z-10">{room.settings.tiers[me.desperationTier]}</span>
                  </button>
                </motion.div>
             )}
             {selectedCard && !me.confirmed && (
               <button onClick={handlePlayCard} disabled={loading} className="bg-yellow-400 text-emerald-950 px-6 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-yellow-400/20 active:scale-90 transition-all">Engage</button>
             )}
             {me.confirmed && <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Target Locked</span>}
           </div>
        </div>
        <div className="flex justify-center -space-x-8 sm:-space-x-12 flex-nowrap h-40 items-end">
           {me.hand.map((card, i) => (
             <CardVisual key={card} card={card} selected={selectedCard === card} disabled={me.confirmed} onClick={() => !me.confirmed && setSelectedCard(card)} role={me.role} delay={i * 0.08} />
           ))}
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
               me.role === 'Preydator' ? `YOU DEVOURED ${opponent?.name || 'TARGET'}` :
               'OBJECTIVE ACHIEVED'
             ) : (
               me.role === 'Predator' ? 'YOUR PREY ESCAPED' : 
               me.role === 'Prey' ? 'YOU WERE DEVOURED' :
               me.role === 'Preydator' ? `${opponent?.name || 'PREYDATOR'} DEVOURED YOU` :
               'PROTOCOL TERMINATED'
             )}
           </span>

           {(me.desperationTier > 0 || (opponent && opponent.desperationTier > 0)) && (
             <div className="mt-4 flex flex-col items-center gap-2">
                {me.desperationTier > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Your Final Protocol</span>
                    <span className="text-xs text-white font-black uppercase text-center">
                       {room.settings.tiers[me.desperationTier - 1]} 
                       {me.desperationResult && <span className="text-purple-400 ml-2">[{me.desperationResult}]</span>}
                    </span>
                  </div>
                )}
                {opponent && opponent.desperationTier > 0 && (
                  <div className="flex flex-col items-center opacity-60">
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Opponent Protocol</span>
                    <span className="text-xs text-purple-300 font-bold uppercase text-center">
                       {room.settings.tiers[opponent.desperationTier - 1]}
                       {opponent.desperationResult && <span className="text-purple-500 ml-2">[{opponent.desperationResult}]</span>}
                    </span>
                  </div>
                )}
             </div>
           )}
           <button onClick={() => setRoomId(null)} className="mt-8 text-[12px] text-emerald-500 hover:text-white uppercase font-black tracking-[0.3em] border border-emerald-800 px-8 py-3 rounded-full hover:bg-emerald-900 transition-all">Return to Command Center</button>
        </div>
      )}

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRules(false)}
            className="absolute inset-0 z-[60] bg-emerald-950/98 backdrop-blur p-6 overflow-y-auto"
          >
            <div className="max-w-xs mx-auto space-y-6">
              <div className="flex justify-between items-center border-b border-emerald-800 pb-2">
                <h3 className="font-black uppercase text-yellow-400 tracking-tighter">Engagement Protocol</h3>
                <button onClick={() => setShowRules(false)}><ArrowLeft className="w-4 h-4" /></button>
              </div>
              
              <div className="space-y-4 text-[10px] leading-relaxed font-bold text-emerald-100 uppercase tracking-tight">
                <p><span className="text-yellow-400">01. THE TARGET:</span> Every round, a random Suit is designated "TARGET".</p>
                <p><span className="text-yellow-400">02. HEIRARCHY:</span> The Target Suit trumps all other suits. If both play Target or both play non-Target, <span className="text-white">HIGHER VALUE WINS (Ace is High)</span>.</p>
                <p><span className="text-yellow-400">03. THE JOKER:</span> A Joker WINS if the opponent plays the Target Suit. It LOSES if the opponent plays any other suit.</p>
                <p><span className="text-yellow-400">04. REWARD:</span> The winner of the round draws a new card from the central deck.</p>
                <p><span className="text-yellow-400">05. OBJECTIVE:</span> Predator wins by exhausting the Prey's hand. Prey wins by exhausting the Predator's hand or the deck.</p>
              </div>

              <button className="w-full bg-emerald-800 py-3 rounded-lg font-black uppercase text-[10px]">Close Dossier</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [isDual, setIsDual] = useState(false);

  return (
    <div className="min-h-screen bg-emerald-950 text-white selection:bg-yellow-400 selection:text-black font-sans overflow-hidden">
      {/* Dev Toggle */}
      <div className="fixed top-4 right-4 z-[100] flex gap-2">
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
