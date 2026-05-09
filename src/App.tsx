/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LayoutGrid, Monitor } from 'lucide-react';
import { CardCreator } from './cardCreator/CardCreator';
import { CardAnimationPreview } from './cardCreator/CardAnimationPreview';
import { GameInstance } from './gameInstance';

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

