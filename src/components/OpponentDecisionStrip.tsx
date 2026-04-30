import React from 'react';

export const OpponentDecisionStrip: React.FC<{
  opponentName: string;
  decision: { powerCardId: number; options: string[]; selectedOption: string | null } | null;
}> = ({ opponentName, decision }) => {
  if (!decision) return null;

  const headline =
    decision.powerCardId === 1
      ? `${opponentName} is casting a spell`
      : decision.powerCardId === 15
        ? `${opponentName} is making a deal`
        : decision.powerCardId === 2
          ? `${opponentName} is consulting the High Priestess`
        : `${opponentName} is spinning fate`;

  if (decision.powerCardId === 2) {
    return (
      <div className="mt-2 flex flex-col items-center gap-1 max-w-[min(100%,18rem)] text-center px-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">{headline}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 leading-snug">
          The veil listens · held card may shift before reveal
        </span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col items-center gap-2">
      <span className="text-[9px] font-black uppercase tracking-widest text-amber-300">{headline}</span>
      <div className="flex gap-2 flex-wrap justify-center">
        {(decision.options || []).map((option) => (
          <div
            key={option}
            className={`w-[130px] min-h-[64px] px-2 py-2 rounded-lg border text-[8px] font-black uppercase flex flex-col justify-between ${
              decision.selectedOption === option
                ? 'border-yellow-400 text-yellow-300 bg-yellow-400/10 shadow-[0_0_18px_rgba(250,204,21,0.2)]'
                : 'border-slate-700 text-slate-300 bg-slate-900/60'
            }`}
          >
            <span>{option.replaceAll('_', ' ')}</span>
            <span className="text-[7px] text-slate-400 normal-case leading-tight mt-1">
              {decision.powerCardId === 1 && option === 'STEAL_JOKER' && 'Attempts to steal a Joker.'}
              {decision.powerCardId === 1 && option === 'FROGIFY' && 'Turns target into Frogs-1.'}
              {decision.powerCardId === 15 && option === 'DEVIL_KING' && 'Pays 2 cards for a King.'}
              {decision.powerCardId === 15 && option === 'DEVIL_BLOCK' && 'Pays 2 cards to block power.'}
              {decision.powerCardId === 15 && option === 'DEVIL_RANDOMIZE' && 'Pays 2 cards to randomize suits.'}
              {decision.powerCardId === 10 && 'Spins outcome wheel.'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
