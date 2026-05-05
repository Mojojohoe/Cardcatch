import React, { useEffect, useRef, useState } from 'react';
import type { DiceTestRollPayload } from '../services/gameService';

type DiceBoxCtor = new (selector: string, config: Record<string, unknown>) => {
  init: () => Promise<void>;
  roll: (notation: string) => Promise<unknown> | unknown;
  clear?: () => void;
};

export const DiceBoxTestOverlay: React.FC<{ roll: DiceTestRollPayload | null }> = ({ roll }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<InstanceType<DiceBoxCtor> | null>(null);
  const readyRef = useRef(false);
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [result, setResult] = useState<{ dice: number[]; total: number } | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!roll) return;
    let cancelled = false;

    const run = async () => {
      setVisible(true);
      setFading(false);
      setResult(null);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);

      const hostEl = mountRef.current;
      if (!hostEl) return;
      try {
        if (!diceRef.current) {
          const mod = await import('@3d-dice/dice-box');
          const DiceBox = (mod.default ?? mod) as DiceBoxCtor;
          const selector = '#dice-box-test-overlay';
          diceRef.current = new DiceBox(selector, {
            assetPath: '/assets/dice-box',
            transparent: true,
            theme: 'default',
          });
        }
        if (!readyRef.current && diceRef.current) {
          await diceRef.current.init();
          readyRef.current = true;
        }
        if (cancelled) return;
        diceRef.current?.clear?.();
        await Promise.resolve(diceRef.current?.roll('2d6'));
      } catch {
        // keep fallback result display even if 3D init fails (missing assets/browser limits)
      }

      if (cancelled) return;
      setResult({ dice: roll.dice, total: roll.total });
      fadeTimerRef.current = window.setTimeout(() => setFading(true), 4000);
      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        setResult(null);
        setFading(false);
      }, 4700);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [roll?.rollId]);

  if (!visible) return null;
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[420] transition-opacity duration-700 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div id="dice-box-test-overlay" ref={mountRef} className="absolute inset-0" />
      {result && (
        <div className="absolute right-4 top-16 rounded-xl border border-white/30 bg-black/35 px-3 py-2 text-white backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">2d6</div>
          <div className="text-xs font-bold">[{result.dice.join(', ')}] = {result.total}</div>
        </div>
      )}
    </div>
  );
};

