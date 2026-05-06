import React, { useEffect, useId, useRef, useState } from 'react';
import type { DiceTestRollPayload } from '../services/gameService';

/**
 * Dice test overlay — uses `@3d-dice/dice-box-threejs` **only**, no custom mesh overlay.
 *
 * Important: forced outcomes (`1d6@n`) are applied internally by swapping **geometry material indices**
 * on the library dice mesh — not by rotating another model. Replacing visuals with a child GLB
 * breaks that contract (wrong face vs network result). Roll flow also calls `spawnDice` twice per
 * die (create + reposition); async shell attachment could attach twice → overlapping dice.
 */

type DiceBoxThreeApi = {
  initialize: () => Promise<void>;
  roll: (notation: string) => Promise<unknown>;
};

type DiceBoxInternal = DiceBoxThreeApi & {
  clearDice?: () => void;
};

type DiceBoxCtor = new (selector: string, config: Record<string, unknown>) => DiceBoxThreeApi;

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
  const diceRef = useRef<DiceBoxThreeApi | null>(null);
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

  const clearDiceSafely = () => {
    const api = diceRef.current as DiceBoxInternal | null;
    api?.clearDice?.();
  };

  const runDiceAnimation = async (dice: DiceBoxThreeApi, notation: string): Promise<boolean> => {
    const startedAt = performance.now();
    const out = await dice.roll(notation);
    const elapsed = performance.now() - startedAt;
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
          theme_customColorset: {
            name: 'bone_die',
            foreground: '#f4efe6',
            background: ['#f1e5cc', '#dcc8a2', '#cab285', '#b89a6a'],
            outline: '#2a241c',
            texture: 'skulls',
            material: 'wood',
          },
          theme_material: 'wood',
          shadows: true,
          theme_surface: 'green-felt',
          baseScale: 170,
          strength: 1.05,
        });
      }
      await diceRef.current.initialize();
      if (mountRef.current) {
        const cv = mountRef.current.querySelector('canvas');
        if (!cv) throw new Error('DiceBox init completed but no canvas was mounted.');
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

        /** Always clear stale meshes before forcing a notation (library does too, but older builds / races exist). */
        clearDiceSafely();

        const ds = roll.dice;
        const forced =
          ds.length >= 2
            ? `@${ds.slice(0, 2).join(',')}`
            : ds.length === 1 && typeof ds[0] === 'number'
              ? `@${ds[0]}`
              : '';
        const baseNotation = ds.length <= 1 ? '1d6' : '2d6';
        const notation =
          ds.length <= 1 && forced ? `1d6${forced}` : ds.length >= 2 && forced ? `2d6${forced}` : baseNotation;
        let animated = false;
        try {
          animated = await runDiceAnimation(diceRef.current!, notation);
          if (!animated) {
            animated = await runDiceAnimation(diceRef.current!, baseNotation);
          }
        } catch {
          try {
            animated = await runDiceAnimation(diceRef.current!, baseNotation);
          } catch {
            animated = false;
          }
        }
        if (!animated) await sleep(700);
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
        <div className="absolute right-4 top-16 rounded-xl border border-white/45 bg-black/25 px-4 py-3 text-white backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-50">
            {roll?.notation ?? (result.dice.length <= 1 ? '1d6' : '2d6')}
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            Result: {result.total}
          </div>
          <div className="mt-0.5 text-[12px] font-medium text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
            Dice: [{result.dice.join(', ')}]
          </div>
        </div>
      )}
    </div>
  );
};
