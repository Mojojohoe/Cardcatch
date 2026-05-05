import React, { useEffect, useId, useRef, useState } from 'react';
import type { DiceTestRollPayload } from '../services/gameService';
import '@3d-dice/dice-box/dist/style.css';

type DiceBoxInstance = {
  init: () => Promise<void>;
  roll: (notation: string | Array<Record<string, unknown>>) => Promise<unknown>;
  clear?: () => void;
};

type DiceBoxCtor = new (selector: string, config: Record<string, unknown>) => DiceBoxInstance;

function diceAssetPath(): string {
  let base = import.meta.env.BASE_URL ?? '/';
  if (base === '.' || base === './') base = '/';
  if (!base.endsWith('/')) base = `${base}/`;
  return `${base}assets/dice-box/`;
}

export const DiceBoxTestOverlay: React.FC<{ roll: DiceTestRollPayload | null }> = ({ roll }) => {
  const reactId = useId().replace(/:/g, '');
  const mountId = `dice-box-test-${reactId}`;
  const mountRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<DiceBoxInstance | null>(null);
  const readyRef = useRef(false);
  const [overlayOpaque, setOverlayOpaque] = useState(false);
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
    let cancelled = false;
    const selector = `#${mountId}`;
    const warmup = async () => {
      if (!mountRef.current || readyRef.current) return;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled || !mountRef.current) return;
      try {
        if (!diceRef.current) {
          const mod = await import('@3d-dice/dice-box');
          const DiceBox = (mod.default ?? mod) as DiceBoxCtor;
          diceRef.current = new DiceBox(selector, {
            assetPath: diceAssetPath(),
            transparent: true,
            theme: 'default',
          });
        }
        await diceRef.current.init();
        readyRef.current = true;
      } catch {
        /* warmup best-effort */
      }
    };
    void warmup();
    return () => {
      cancelled = true;
    };
  }, [mountId]);

  useEffect(() => {
    if (!roll) return;
    let cancelled = false;
    const selector = `#${mountId}`;

    const run = async () => {
      setOverlayOpaque(true);
      setFading(false);
      setResult(null);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);

      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      if (cancelled || !mountRef.current) return;

      try {
        if (!diceRef.current) {
          const mod = await import('@3d-dice/dice-box');
          const DiceBox = (mod.default ?? mod) as DiceBoxCtor;
          diceRef.current = new DiceBox(selector, {
            assetPath: diceAssetPath(),
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
        // Try to force authoritative values into the physics payload shape.
        const forcedNotation = roll.dice.map((v) => ({
          sides: 6,
          qty: 1,
          value: v,
          modifier: 0,
        }));
        await diceRef.current.roll(forcedNotation);
      } catch {
        // Fall back to generic notation if custom object form is rejected.
        try {
          await diceRef.current?.roll('2d6');
        } catch {
          /* fall through to synced result only */
        }
      }

      if (cancelled) return;
      setResult({ dice: roll.dice, total: roll.total });
      fadeTimerRef.current = window.setTimeout(() => setFading(true), 4000);
      hideTimerRef.current = window.setTimeout(() => {
        setOverlayOpaque(false);
        setResult(null);
        setFading(false);
      }, 4700);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [roll?.rollId, mountId]);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[420] transition-opacity duration-700 ${
        overlayOpaque && !fading ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden={!overlayOpaque}
    >
      <div
        id={mountId}
        ref={mountRef}
        className="dice-box-test-mount absolute inset-0 h-full min-h-[100dvh] w-full"
      />
      {result && overlayOpaque && (
        <div className="absolute right-4 top-16 rounded-xl border border-white/30 bg-black/35 px-3 py-2 text-white backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">2d6</div>
          <div className="text-xs font-bold">[{result.dice.join(', ')}] = {result.total}</div>
        </div>
      )}
    </div>
  );
};
