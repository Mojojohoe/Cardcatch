import React, { useEffect, useRef, useState } from 'react';
import { Cog } from 'lucide-react';
import { usePlayerDisplayPreferences } from '../playerDisplayPreferences';
import { CARD_ART_TOOLS_ENABLED } from '../cardArt/toolsAccess';

function ToggleRow(props: {
  id: string;
  label: string;
  description: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  const { id, label, description, pressed, onToggle } = props;
  return (
    <div className="border-b border-emerald-800/60 py-2.5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-[11px] font-bold text-slate-100">
            {label}
          </label>
          <p className="mt-1 text-[10px] leading-snug text-slate-500">{description}</p>
        </div>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={pressed}
          onClick={onToggle}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors ${
            pressed
              ? 'border-amber-400/80 bg-amber-500/35'
              : 'border-emerald-700 bg-emerald-950/80'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
              pressed ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function PlayerSettingsMenu({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    highVisibilityMode,
    simpleCardFonts,
    setHighVisibilityMode,
    setSimpleCardFonts,
  } = usePlayerDisplayPreferences();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="z-[260] flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-amber-400/50 bg-emerald-950/95 px-2 py-1.5 text-amber-100 shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition hover:border-amber-300 hover:bg-emerald-900/95 sm:gap-2 sm:px-3 sm:py-2"
        title="Player settings"
      >
        <Cog className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" aria-hidden />
        <span className="text-[9px] font-black uppercase tracking-widest sm:text-[10px]">Settings</span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Player settings"
          className="absolute right-0 top-full z-[250] mt-1.5 w-[min(19rem,calc(100vw-1.5rem))] rounded-xl border border-emerald-800 bg-emerald-950/98 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-sm"
        >
          <div className="mb-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
            Player settings
          </div>
          <ToggleRow
            id="setting-high-visibility"
            label="High Visibility Mode"
            description="Substitutes the artwork for simple graphics and vectors."
            pressed={highVisibilityMode}
            onToggle={() => setHighVisibilityMode(!highVisibilityMode)}
          />
          <ToggleRow
            id="setting-simple-fonts"
            label="Simple Card Fonts"
            description="Substitutes the card fonts for clearer ones. Swaps the olde font for the default sans style."
            pressed={simpleCardFonts}
            onToggle={() => setSimpleCardFonts(!simpleCardFonts)}
          />
          {CARD_ART_TOOLS_ENABLED && (
            <div className="pt-2">
              <button
                type="button"
                className="w-full rounded-lg border border-emerald-700 bg-emerald-900/50 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-800/70"
                onClick={() => {
                  window.location.hash = '#card-creator';
                  setOpen(false);
                }}
              >
                Card Creator
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
