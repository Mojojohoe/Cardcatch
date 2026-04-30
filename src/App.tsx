import React, { useState } from 'react';
import { LayoutGrid, Monitor } from 'lucide-react';
import { GameInstance } from './components/game/GameInstance';

export default function App() {
  const [isDual, setIsDual] = useState(false);

  return (
    <div className="min-h-screen bg-emerald-950 text-white selection:bg-yellow-400 selection:text-black font-sans overflow-hidden">
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

      <div className="h-screen transition-all duration-500 flex bg-emerald-950">
        <div className={`h-full transition-all duration-500 overflow-hidden ${isDual ? 'w-1/2' : 'w-full'}`}>
          <GameInstance instanceId="p1" />
        </div>
        {isDual && (
          <div className="w-1/2 h-full overflow-hidden">
            <GameInstance instanceId="p2" isDual />
          </div>
        )}
      </div>

      <footer className="fixed bottom-4 left-4 pointer-events-none opacity-20 text-[8px] font-black uppercase tracking-[0.4em]">
        TACTICAL NEXUS v2.0.0 - PURE P2P NO-BACKEND MODE
      </footer>
    </div>
  );
}
