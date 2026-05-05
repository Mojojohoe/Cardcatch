import React, { useEffect, useId, useRef, useState } from 'react';
import type { DiceTestRollPayload } from '../services/gameService';

type DiceBoxInstance = {
  initialize: () => Promise<void>;
  roll: (notation: string) => Promise<unknown>;
  clear?: () => void;
};

type DiceBoxCtor = new (selector: string, config: Record<string, unknown>) => DiceBoxInstance;

function diceAssetPath(): string {
  let base = import.meta.env.BASE_URL ?? '/';
  if (base === '.' || base === './') base = '/';
  if (!base.endsWith('/')) base = `${base}/`;
  return `${base}assets/dice-box-threejs/`;
}

export const DiceBoxTestOverlay: React.FC<{ roll: DiceTestRollPayload | null }> = ({ roll }) => {
  const reactId = useId().replace(/:/g, '');
  const mountId = `dice-box-test-${reactId}`;
  const mountRef = useRef<HTMLDivElement>(null);
  const diceRef = useRef<DiceBoxInstance | null>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const readyRef = useRef(false);
  const [overlayOpaque, setOverlayOpaque] = useState(false);
  const [fading, setFading] = useState(false);
  const [result, setResult] = useState<{ dice: number[]; total: number } | null>(null);
  const [diceReady, setDiceReady] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const runDiceAnimation = async (dice: DiceBoxInstance, notation: string): Promise<boolean> => {
    const startedAt = performance.now();
    const out = await dice.roll(notation);
    const elapsed = performance.now() - startedAt;
    // When this lib cannot build throw vectors / parse notation it can resolve immediately with no animation.
    const hasStructuredResult = Boolean(
      out &&
        typeof out === 'object' &&
        'sets' in (out as Record<string, unknown>) &&
        Array.isArray((out as { sets?: unknown[] }).sets),
    );
    return hasStructuredResult || elapsed > 260;
  };

  const ensureReady = async (selector: string): Promise<void> => {
    if (readyRef.current) return;
    if (initPromiseRef.current) return initPromiseRef.current;
    initPromiseRef.current = (async () => {
      if (!diceRef.current) {
        const mod = await import('@3d-dice/dice-box-threejs');
        const DiceBox = (mod.default ?? mod) as DiceBoxCtor;
        diceRef.current = new DiceBox(selector, {
          assetPath: diceAssetPath(),
          sounds: false,
          // Keep this path resilient even if packaged textures are unavailable.
          theme_texture: 'none',
          theme_material: 'plastic',
          shadows: true,
          theme_surface: 'green-felt',
          baseScale: 85,
          strength: 1.05,
        });
      }
      await diceRef.current.initialize();
      if (mountRef.current) {
        const cv = mountRef.current.querySelector('canvas');
        if (!cv) {
          throw new Error('DiceBox init completed but no canvas was mounted.');
        }
      }
      readyRef.current = true;
      setDiceReady(true);
    })();
    try {
      await initPromiseRef.current;
    } finally {
      initPromiseRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const selector = `#${mountId}`;
    const warmup = async () => {
      if (!mountRef.current || readyRef.current) return;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled || !mountRef.current) return;
      await ensureReady(selector);
    };
    void warmup().catch((err) => {
      console.error('DiceBox warmup failed', err);
      setDiceReady(false);
    });
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
        await ensureReady(selector);
        if (cancelled) return;
        diceRef.current?.clear?.();
        const [d1, d2] = roll.dice;
        const notation = `2d6@${d1},${d2}`;
        let animated = false;
        try {
          animated = await runDiceAnimation(diceRef.current, notation);
          if (!animated) {
            // Deterministic notation parsed but produced no throw; retry plain notation.
            animated = await runDiceAnimation(diceRef.current, '2d6');
          }
        } catch {
          // Fallback animation path if predetermined notation throws in runtime/browser.
          try {
            animated = await runDiceAnimation(diceRef.current, '2d6');
          } catch {
            animated = false;
          }
        }
        if (!animated) {
          // Avoid instant result pop when physics path failed.
          await sleep(700);
        }
      } catch (err) {
        console.warn('DiceBoxTestOverlay roll failed', err);
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
      {overlayOpaque && !diceReady && (
        <div className="absolute left-4 top-16 rounded-xl border border-rose-300/40 bg-black/45 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-rose-200 backdrop-blur-sm">
          Dice render init failed (see console)
        </div>
      )}
      {result && overlayOpaque && (
        <div className="absolute right-4 top-16 rounded-xl border border-white/30 bg-black/35 px-3 py-2 text-white backdrop-blur-sm">
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">2d6</div>
          <div className="text-xs font-bold">[{result.dice.join(', ')}] = {result.total}</div>
        </div>
      )}
    </div>
  );
};
