import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ open, onClose }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 z-[60] bg-emerald-950/98 backdrop-blur p-6 overflow-y-auto"
        >
          <div className="max-w-xs mx-auto space-y-6">
            <div className="flex justify-between items-center border-b border-emerald-800 pb-2">
              <h3 className="font-black uppercase text-yellow-400 tracking-tighter">Engagement Protocol</h3>
              <button onClick={onClose}><ArrowLeft className="w-4 h-4" /></button>
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
  );
};
