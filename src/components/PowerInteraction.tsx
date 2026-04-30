import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';

export interface PendingDecisionView {
  powerCardId: number;
  options: string[];
  disabledReasons?: Record<string, string>;
  wheelResult?: string | null;
}

export const FortuneWheelVisual: React.FC<{
  spinning: boolean;
  offset: number;
  sizeClass?: string;
}> = ({ spinning, offset, sizeClass = 'w-60 h-60' }) => {
  const wheelSlices = [
    { label: 'LOSE_ROUND', size: 3, color: '#7f1d1d' },
    { label: 'WIN_ROUND', size: 3, color: '#14532d' },
    { label: 'WIN_2_CARDS', size: 5, color: '#1e3a8a' },
    { label: 'DOUBLE_JOKER', size: 1, color: '#581c87' },
    { label: 'JACKPOT', size: 2, color: '#854d0e' },
    { label: 'POWER_CARD', size: 1, color: '#0f766e' },
    { label: 'LOSE_2_CARDS', size: 5, color: '#7c2d12' }
  ];
  const totalSize = wheelSlices.reduce((acc, s) => acc + s.size, 0);
  const wheelRotation = useMemo(() => -(360 * 10 + offset * 360), [offset]);
  const wheelGradient = useMemo(() => {
    let start = 0;
    return wheelSlices.map((slice) => {
      const from = (start / totalSize) * 100;
      start += slice.size;
      const to = (start / totalSize) * 100;
      return `${slice.color} ${from}% ${to}%`;
    }).join(', ');
  }, [totalSize]);

  return (
    <div className={`relative ${sizeClass} mx-auto`}>
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[14px] border-t-yellow-400" />
      <motion.div
        animate={{ rotate: spinning ? wheelRotation : -(offset * 360) }}
        transition={{ duration: spinning ? 2.5 : 0.2, ease: [0.12, 0, 0, 1] }}
        className="w-full h-full rounded-full border-[10px] border-amber-600/60 overflow-hidden relative shadow-[0_0_40px_rgba(245,158,11,0.3)]"
      >
        <div className="absolute inset-0" style={{ background: `conic-gradient(${wheelGradient})` }} />
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-30 pointer-events-none">
          {(() => {
            let running = 0;
            return wheelSlices.map((slice, idx) => {
              running += slice.size;
              const angle = (running / totalSize) * 360;
              const x2 = 50 + 50 * Math.cos(((angle - 90) * Math.PI) / 180);
              const y2 = 50 + 50 * Math.sin(((angle - 90) * Math.PI) / 180);
              return <line key={idx} x1="50" y1="50" x2={x2} y2={y2} stroke="white" strokeWidth="0.4" />;
            });
          })()}
        </svg>
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="w-16 h-16 rounded-full bg-amber-700 border-4 border-amber-300 flex items-center justify-center">
          <span className="text-[10px] font-black text-black uppercase">Fortune</span>
        </div>
      </div>
    </div>
  );
};

export const PowerDecisionModal: React.FC<{
  decision: PendingDecisionView;
  onSubmit: (option: string, wheelOffset?: number) => void;
}> = ({ decision, onSubmit }) => {
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelOffset, setWheelOffset] = useState(0);
  const [revealed] = useState<string | null>(decision.wheelResult || null);
  const isWheel = decision.powerCardId === 10;

  const optionMeta: Record<string, { title: string; description: string }> = {
    STEAL_JOKER: { title: 'Steal Joker', description: 'Take one Joker from the opponent if they have one.' },
    FROGIFY: { title: 'Frogify', description: 'Transform opponent played card into Frogs-1.' },
    DEVIL_KING: { title: 'Royal Pact', description: 'Discard 2 random cards to make your played card a King.' },
    DEVIL_BLOCK: { title: 'Seal Their Arcana', description: 'Discard 2 random cards to block opponent power this round.' },
    DEVIL_RANDOMIZE: { title: 'Chaotic Suits', description: 'Discard 2 random cards and randomize both played suits.' }
  };

  const spinWheel = () => {
    const nextOffset = Math.random();
    setWheelOffset(nextOffset);
    setWheelSpinning(true);
    setTimeout(() => {
      setWheelSpinning(false);
      onSubmit('SPIN_WHEEL', nextOffset);
    }, 2500);
  };

  return (
    <div className="absolute inset-0 z-[260] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
      <div className="w-full max-w-xl rounded-2xl border border-yellow-500/40 bg-slate-950 p-6 space-y-4">
        <h3 className="text-xl font-black uppercase text-yellow-400">
          {decision.powerCardId === 1 ? 'Cast Spell' : decision.powerCardId === 15 ? 'Devil Deal' : 'Wheel Of Fortune'}
        </h3>
        {isWheel ? (
          <div className="space-y-4">
            <FortuneWheelVisual spinning={wheelSpinning} offset={wheelOffset} />
            <button
              onClick={spinWheel}
              disabled={wheelSpinning}
              className="w-full py-3 rounded-xl bg-amber-500 text-black font-black uppercase disabled:opacity-50"
            >
              {wheelSpinning ? 'Spinning...' : 'Spin'}
            </button>
            {revealed && <p className="text-center text-amber-300 font-bold">Outcome: {revealed.replaceAll('_', ' ')}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {decision.options.map(option => (
              <div key={option} className={`rounded-xl border p-3 ${decision.disabledReasons?.[option] ? 'border-slate-700 bg-slate-900/30 opacity-60' : 'border-emerald-600/40 bg-emerald-900/30'}`}>
                <button
                  onClick={() => onSubmit(option)}
                  disabled={Boolean(decision.disabledReasons?.[option])}
                  className="w-full text-left disabled:cursor-not-allowed"
                >
                  <div className="text-sm font-black uppercase text-white">{optionMeta[option]?.title || option.replaceAll('_', ' ')}</div>
                  <div className="text-[11px] text-slate-300 mt-1">{optionMeta[option]?.description || ''}</div>
                  {decision.disabledReasons?.[option] && (
                    <div className="text-[10px] text-red-300 mt-2 uppercase font-bold">{decision.disabledReasons[option]}</div>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
