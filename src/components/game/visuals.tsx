import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, RotateCcw, Rabbit, Skull, Trophy, UtensilsCrossed } from 'lucide-react';
import { parseCard, DESPERATION_SLICES } from '../../services/gameService';
import { PlayerRole, Suit } from '../../types';

export const SUIT_ICONS: Record<string, string> = {
  Hearts: '♥',
  Diamonds: '♦',
  Clubs: '♣',
  Spades: '♠',
  Joker: '🃏',
};

export const SUIT_COLORS: Record<string, string> = {
  Hearts: 'text-red-500',
  Diamonds: 'text-red-400',
  Clubs: 'text-emerald-400',
  Spades: 'text-blue-400',
  Joker: 'text-purple-400',
};

export const WolfIcon = () => (
  <svg viewBox="0 0 100 125" className="w-full h-full opacity-60 fill-current">
    <path d="M84.9 34c6.4-7.7 7.9-18.6 3.6-27.8-.2-.5-.6-.8-1.1-1s-1-.2-1.5.1L65 15.1c-.5.2-1 .3-1.5.1C59.2 13.7 54.7 13 50 13s-9.2.8-13.4 2.2c-.5.2-1 .1-1.5-.1l-21-9.9c-.5-.2-1-.3-1.5-.1s-.9.5-1.1 1C7.1 15.3 8.6 26.3 15.1 34 8.6 43.7 5 55.2 5 67c0 1 .7 1.8 1.7 2l10.9 1.8c7.4 1.2 13.2 6.7 14.7 14l.1.7c1.2 5.5 6 9.4 11.5 9.5h12.2c5.5-.1 10.4-4.1 11.5-9.5l.1-.7c1.5-7.3 7.3-12.8 14.7-14L93.3 69c1-.2 1.7-1 1.7-2 0-11.8-3.6-23.3-10.1-33M54 91h-8v-2c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2zm27.8-24.2c-9 1.5-16.1 8.2-18 17.2l-.1.7c-.6 3-2.9 5.3-5.7 6.1V89c0-3.3-2.7-6-6-6h-4c-3.3 0-6 2.7-6 6v1.7c-2.8-.8-5.1-3.1-5.7-6.1l-.2-.6c-1.9-9-8.9-15.7-18-17.2L9 65.3c.4-11.9 4.6-23.4 12-32.7l3.5-4.4c.7-.9.5-2.1-.3-2.8s-2.1-.5-2.8.3l-3.5 4.4c-.1.2-.3.3-.4.5-4.5-5.9-5.8-13.9-3.2-20.9l19 9c1.5.7 3.1.8 4.5.3 3.8-1.3 7.9-2 12.1-2s8.3.7 12.1 2c1.5.5 3.1.4 4.5-.3l19-9c2.5 7 1.3 15-3.2 20.9-.1-.2-.2-.3-.4-.5l-3.5-4.4c-.7-.9-2-1-2.8-.3s-1 2-.3 2.8l3.5 4.4c7.4 9.3 11.7 20.8 12 32.7z" />
    <path d="M35.8 49.7c-.8-.8-2-.8-2.8 0l-1.4 1.4c-3.1 3.1-3.1 8.2 0 11.3 1.6 1.5 3.6 2.3 5.7 2.3s4.1-.8 5.7-2.3l1.4-1.4c.4-.4.6-.9.6-1.4s-.2-1-.6-1.4zm-1.5 9.9c-1.6-1.6-1.6-4.1 0-5.7l5.7 5.7c-1.6 1.6-4.1 1.6-5.7 0m32.8-9.9c-.8-.8-2-.8-2.8 0l-8.5 8.5c-.8.8-.8 2 0 2.8l1.4 1.4c1.6 1.5 3.6 2.3 5.7 2.3s4.1-.8 5.7-2.3c3.1-3.1 3.1-8.2 0-11.3zm-1.4 9.9c-1.6 1.6-4.1 1.6-5.7 0l5.7-5.7c1.5 1.6 1.5 4.2 0 5.7" />
  </svg>
);

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

export const CardVisual: React.FC<CardVisualProps> = (props) => {
  const { card, selected, onClick, disabled, revealed = true, role, delay = 0, noAnimate = false } = props;
  const { suit, value, isJoker } = useMemo(() => (revealed ? parseCard(card) : { suit: '', value: '', isJoker: false }), [card, revealed]);
  const entrance = noAnimate
    ? {}
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
        className={`w-10 h-14 sm:w-16 sm:h-24 rounded-lg shadow-xl flex items-center justify-center p-1.5 border-2 transition-colors relative ${backClasses}`}
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
      className={`w-12 h-18 sm:w-24 sm:h-36 bg-white border-2 rounded-lg shadow-xl flex flex-col justify-between p-2 cursor-pointer relative overflow-hidden transition-all ${selected ? 'border-yellow-400 ring-4 ring-yellow-400/30' : 'border-gray-200'} ${disabled ? 'opacity-60 grayscale cursor-not-allowed' : ''}`}
    >
      <div className={`flex flex-col items-start leading-[0.7] ${SUIT_COLORS[suit]}`}>
        <span className="text-sm sm:text-xl font-black font-mono tracking-tighter">{value}</span>
        <span className="text-lg sm:text-3xl">{SUIT_ICONS[suit]}</span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className={`text-5xl sm:text-8xl opacity-[0.08] ${SUIT_COLORS[suit]}`}>{isJoker ? '🃏' : SUIT_ICONS[suit]}</span>
      </div>
      <div className={`flex flex-col items-start leading-[0.7] self-end rotate-180 ${SUIT_COLORS[suit]}`}>
        <span className="text-sm sm:text-xl font-black font-mono tracking-tighter">{value}</span>
        <span className="text-lg sm:text-3xl">{SUIT_ICONS[suit]}</span>
      </div>
    </motion.div>
  );
};

export const DesperationVignette: React.FC<{ tier: number; totalTiers: number }> = ({ tier, totalTiers }) => {
  if (tier === 0 || totalTiers === 0) return null;
  const intensity = Math.min(tier / totalTiers, 1);
  return (
    <div
      className="absolute inset-0 pointer-events-none z-[60] transition-all duration-1000 rounded-3xl"
      style={{
        boxShadow: `inset 0 0 ${intensity * 180}px ${intensity * 120}px rgba(126, 34, 206, ${intensity * 0.4}), inset 0 0 ${intensity * 100}px ${intensity * 80}px rgba(0,0,0,${intensity * 0.8})`,
      }}
    />
  );
};

export const TargetSuitWheel: React.FC<{ suit: Suit | null; isSpinning: boolean; offset?: number }> = ({ suit, isSpinning, offset = 0.5 }) => {
  const orderedSuits: Suit[] = ['Diamonds', 'Spades', 'Hearts', 'Clubs'];
  const rotation = useMemo(() => {
    const suitIndex = orderedSuits.indexOf(suit || 'Hearts');
    const sliceOffset = (offset * 80) - 40;
    return -45 - (suitIndex * 90) - (360 * 8) + sliceOffset;
  }, [suit, offset]);

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      <div className="absolute -top-6 z-10 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
        <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-yellow-400" />
      </div>
      <motion.div
        animate={isSpinning ? { rotate: rotation } : { rotate: rotation }}
        transition={isSpinning ? { duration: 5, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
        className="w-full h-full rounded-full border-8 border-emerald-950 overflow-hidden bg-emerald-950 relative shadow-[0_0_60px_rgba(0,0,0,0.8)]"
      >
        {orderedSuits.map((s, i) => (
          <div
            key={s}
            className="absolute top-0 left-0 w-full h-full"
            style={{
              transform: `rotate(${i * 90}deg)`,
              backgroundColor: (s === 'Diamonds' || s === 'Hearts') ? '#000000' : '#FFFFFF',
              clipPath: 'polygon(50% 50%, 100% 50%, 100% 0, 50% 0)',
              borderRight: '1px solid rgba(128, 128, 128, 0.2)',
            }}
          >
            <div className={`absolute top-[15%] left-[75%] -translate-x-1/2 flex flex-col items-center gap-1 ${SUIT_COLORS[s]}`} style={{ transform: `rotate(${-i * 90}deg)` }}>
              <span className="text-3xl filter drop-shadow-lg">{SUIT_ICONS[s]}</span>
            </div>
          </div>
        ))}
        <div className="absolute inset-0 m-auto w-12 h-12 bg-emerald-900 rounded-full border-4 border-emerald-800 flex items-center justify-center z-20">
          <Skull className="w-5 h-5 text-emerald-400" />
        </div>
      </motion.div>
      <div className="absolute inset-0 rounded-full bg-linear-to-tr from-white/5 to-transparent pointer-events-none z-30" />
    </div>
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
          <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-widest border-l-4 border-purple-400 pl-3">Desperation Protocol</h3>
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
      {isSpectator && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30">
          <Skull className="w-8 h-8 text-purple-500 animate-pulse" />
          <span className="text-[11px] font-black text-purple-400 uppercase tracking-[0.4em] drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">OPPONENT SPINNING</span>
        </div>
      )}

      <div className={`relative transition-all duration-1000 ${isSpectator ? 'scale-50 sm:scale-75 -translate-y-12' : 'scale-100'} mb-8`}>
        <div className="relative w-72 h-72 sm:w-[480px] sm:h-[480px]">
          <div className="absolute -inset-4 border border-purple-500/10 rounded-full animate-[spin_20s_linear_infinite]" />
          <div className="absolute -inset-8 border border-purple-500/5 rounded-full animate-[spin_30s_linear_infinite_reverse]" />
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: isSpinning ? rotation : -(offset * 360) }}
            transition={{ duration: isSpinning ? 12 : 0.5, ease: [0.12, 0, 0, 1] }}
            className="w-full h-full rounded-full border-[10px] border-purple-900/40 relative shadow-[0_0_80px_rgba(168,85,247,0.2)] overflow-hidden"
          >
            <div
              className="absolute inset-0"
              style={{
                background: `conic-gradient(${(() => {
                  let currentW = 0;
                  return DESPERATION_SLICES.map((slice, i) => {
                    const start = (currentW / totalWeight) * 100;
                    currentW += slice.weight;
                    const end = (currentW / totalWeight) * 100;
                    const color = slice.label === 'GAME OVER' ? '#2d0606' : i % 2 === 0 ? '#1e1b4b' : '#110e2d';
                    return `${color} ${start}% ${end}%`;
                  }).join(', ');
                })()})`,
              }}
            />
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
            {(() => {
              let textWeight = 0;
              return DESPERATION_SLICES.map((slice, i) => {
                const angle = (slice.weight / totalWeight) * 360;
                const startAngle = (textWeight / totalWeight) * 360;
                textWeight += slice.weight;
                const midAngle = startAngle + angle / 2;
                return (
                  <div key={i} className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ transform: `rotate(${midAngle - 90}deg)` }}>
                    <div className="absolute right-[5%] w-[42%] flex items-center justify-center text-center">
                      <span className={`text-white font-black uppercase tracking-widest leading-tight ${slice.label === 'GAME OVER' ? 'text-[11px] sm:text-[15px] text-red-500' : 'text-[8px] sm:text-[11px] opacity-70'}`} style={{ textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}>
                        {slice.label === 'GAME OVER' ? 'SYSTEM FAIL' : slice.label.toUpperCase().replace('GAIN', 'DRAW')}
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
                className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white/10 bg-purple-600 shadow-2xl flex items-center justify-center transition-all active:scale-95 group relative ${(isSpinning || !!result) ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-110 hover:bg-purple-500 shadow-[0_0_50px_rgba(168,85,247,0.5)]'}`}
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
            <div className="w-10 h-12 bg-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)]" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
          </div>
        </div>
      </div>

      <div className="text-center h-48 flex flex-col justify-center max-w-lg w-full">
        {isSpinning && !showResult && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-[14px] font-black text-purple-400 animate-pulse uppercase tracking-[0.5em] italic">SIMULATING OUTCOME</div>
            <div className="w-64 h-1 bg-emerald-950 rounded-full overflow-hidden border border-purple-500/20">
              <motion.div className="h-full bg-purple-500" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 12, ease: 'linear' }} />
            </div>
            {isSpectator && <span className="text-[10px] text-emerald-800 uppercase font-black tracking-widest mt-2 animate-pulse">Monitoring Live Feed...</span>}
          </div>
        )}
        {showResult && result && (
          <motion.div initial={{ scale: 0.8, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="flex flex-col items-center gap-6">
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-black text-purple-500 uppercase tracking-[0.5em] mb-2">{isSpectator ? 'OPPONENT DRAWN' : 'OUTCOME ACQUIRED'}</span>
              <div className={`text-5xl sm:text-7xl font-black uppercase tracking-tighter ${result === 'GAME OVER' ? 'text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]'}`}>
                {result.toUpperCase().replace('GAIN', 'DRAW')}
              </div>
            </div>
            {!isSpectator && (
              <button onClick={onResolve} className="bg-white text-emerald-950 px-20 py-4 rounded-full font-black uppercase tracking-[0.1em] text-[15px] transition-all hover:bg-yellow-400 active:scale-95 shadow-[0_0_60px_rgba(255,255,255,0.3)] animate-pulse">
                {result === 'GAME OVER' ? 'TERMINATE' : 'EXECUTE RECOVERY'}
              </button>
            )}
          </motion.div>
        )}
        {!isSpinning && !result && !isSpectator && (
          <div className="flex flex-col items-center gap-4">
            <div className="px-6 py-2 bg-purple-900/30 rounded-full border border-purple-500/20">
              <span className="text-[12px] font-black text-purple-400 uppercase tracking-[0.2em]">PROTOCOL DEPTH: {currentTier} / {tiers.length}</span>
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

export const EndGameOverlay: React.FC<{
  iWon: boolean;
  meRole: PlayerRole;
  opponentName?: string;
  meDesperationTier: number;
  meDesperationResult: string | null;
  opponentDesperationTier: number;
  opponentDesperationResult: string | null;
  tiers: string[];
  onExit: () => void;
}> = ({ iWon, meRole, opponentName, meDesperationTier, meDesperationResult, opponentDesperationTier, opponentDesperationResult, tiers, onExit }) => (
  <div className="absolute inset-0 z-50 bg-emerald-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
    {iWon ? (
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
    <span className="text-lg font-black uppercase text-white tracking-[0.2em] px-8 max-w-sm">
      {iWon ? (meRole === 'Predator' ? 'YOU DEVOURED YOUR PREY' : meRole === 'Prey' ? 'YOU ESCAPED THE PREDATOR' : `YOU DEVOURED ${opponentName || 'TARGET'}`) : (meRole === 'Predator' ? 'YOUR PREY ESCAPED' : meRole === 'Prey' ? 'YOU WERE DEVOURED' : `${opponentName || 'PREYDATOR'} DEVOURED YOU`)}
    </span>
    {(meDesperationTier > 0 || opponentDesperationTier > 0) && (
      <div className="mt-4 flex flex-col items-center gap-2">
        {meDesperationTier > 0 && (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Your Final Protocol</span>
            <span className="text-xs text-white font-black uppercase text-center">
              {tiers[meDesperationTier - 1]}
              {meDesperationResult && <span className="text-purple-400 ml-2">[{meDesperationResult}]</span>}
            </span>
          </div>
        )}
        {opponentDesperationTier > 0 && (
          <div className="flex flex-col items-center opacity-60">
            <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Opponent Protocol</span>
            <span className="text-xs text-purple-300 font-bold uppercase text-center">
              {tiers[opponentDesperationTier - 1]}
              {opponentDesperationResult && <span className="text-purple-500 ml-2">[{opponentDesperationResult}]</span>}
            </span>
          </div>
        )}
      </div>
    )}
    <button onClick={onExit} className="mt-8 text-[12px] text-emerald-500 hover:text-white uppercase font-black tracking-[0.3em] border border-emerald-800 px-8 py-3 rounded-full hover:bg-emerald-900 transition-all">Return to Command Center</button>
  </div>
);
