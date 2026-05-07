import React, { useEffect, useId, useRef, useState } from 'react';
import type { DicePresentation, DiceTestRollPayload } from '../services/gameService';

/**
 * Dice test overlay — uses `@3d-dice/dice-box-threejs` **only**, no custom mesh overlay.
 *
 * Important: forced outcomes (`1dpip@n`) are applied internally by swapping **geometry material indices**
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
  const placement: DicePresentation = roll?.presentation ?? 'hudBottom';
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
          baseScale: 200,
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
        const coinLegends = roll.coinFlipLegends;
        const pre = roll.notation?.trim() ?? '';
        const isSilverCoinRoll = Boolean(coinLegends) || pre.startsWith('1dc');
        const pipFallbackNotation = ds.length <= 1 ? '1dpip' : '2dpip';

        let notation: string;
        if (
          isSilverCoinRoll &&
          ds.length === 1 &&
          (ds[0] === 0 || ds[0] === 1)
        ) {
          const v = ds[0];
          notation = /^1dc@\d+$/.test(pre) ? pre : `1dc@${v}`;
        } else {
          const forced =
            ds.length >= 2
              ? `@${ds.slice(0, 2).join(',')}`
              : ds.length === 1 && typeof ds[0] === 'number'
                ? `@${ds[0]}`
                : '';
          notation =
            ds.length <= 1 && forced ? `1dpip${forced}` : ds.length >= 2 && forced ? `2dpip${forced}` : pipFallbackNotation;
        }
        let animated = false;
        try {
          animated = await runDiceAnimation(diceRef.current!, notation);
          if (!animated) {
            const retryNotation = isSilverCoinRoll ? notation : pipFallbackNotation;
            animated = await runDiceAnimation(diceRef.current!, retryNotation);
          }
        } catch {
          try {
            const retryNotation = isSilverCoinRoll ? notation : pipFallbackNotation;
            animated = await runDiceAnimation(diceRef.current!, retryNotation);
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

  const outerHud =
    'pointer-events-none fixed inset-x-0 bottom-0 z-[425] flex h-[min(42dvh,22rem)] flex-col justify-end transition-opacity duration-700 sm:h-[min(46dvh,26rem)]';
  const outerPage =
    'pointer-events-none fixed inset-0 z-[425] flex items-center justify-center bg-transparent transition-opacity duration-700';
  const mountHud = 'dice-box-test-mount relative h-full min-h-[12rem] w-full';
  const mountPage =
    'dice-box-test-mount relative h-[min(48dvh,28rem)] w-[min(96vw,48rem)] max-w-[100vw]';
  /** `1dc` coin needs an almost-square viewport — wide rects read as a squashed disc. */
  const mountResolutionCoin =
    'dice-box-test-mount relative aspect-square h-[min(56vmin,24rem)] w-[min(56vmin,24rem)] max-h-[88dvh] max-w-[min(92vw,24rem)]';

  const coinLegendsShowing = overlayOpaque && Boolean(roll?.coinFlipLegends);

  return (
    <div
      className={`${placement === 'resolutionPage' ? outerPage : outerHud} ${
        overlayOpaque && !fading ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden={!overlayOpaque}
    >
      {coinLegendsShowing && roll?.coinFlipLegends && (
        <div className="pointer-events-none absolute left-4 right-4 top-[14%] z-[426] flex flex-col items-center gap-2 text-center">
          <div className="max-w-xl rounded-xl border border-amber-500/55 bg-black/42 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/96 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:text-[11px]">
            <span className="block text-emerald-200/98">Silver coin toss</span>
            <span className="mt-1.5 block font-bold tracking-wide text-white/95 normal-case">
              <span className="text-red-400">Heads</span> · {roll.coinFlipLegends!.heads}{' '}
              <span className="mx-1 text-white/55">│</span>
              <span className="text-sky-400">Tails</span> · {roll.coinFlipLegends!.tails}
            </span>
          </div>
        </div>
      )}
      <div
        id={mountId}
        ref={mountRef}
        className={
          placement === 'resolutionPage' && Boolean(roll?.coinFlipLegends)
            ? mountResolutionCoin
            : placement === 'resolutionPage'
              ? mountPage
              : mountHud
        }
      />
      {overlayOpaque && !diceReady && (
        <div className="pointer-events-none absolute left-4 top-2 rounded-xl border border-rose-300/40 bg-black/45 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-rose-200 backdrop-blur-sm">
          Dice render init failed (see console)
        </div>
      )}
      {result && overlayOpaque && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-xl border border-white/45 bg-black/25 px-4 py-3 text-white backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-50">
            {roll?.notation ?? (result.dice.length <= 1 ? '1dpip' : '2dpip')}
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            {roll?.coinFlipLegends ? (
              <>
                Lands:{' '}
                <span className={result.total === 1 ? 'text-red-300' : 'text-sky-300'}>
                  {result.total === 1 ? 'Heads' : 'Tails'}
                </span>
              </>
            ) : (
              <>Result: {result.total}</>
            )}
          </div>
          <div className="mt-0.5 text-[12px] font-medium text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">
            {roll?.coinFlipLegends
              ? `Coin: ${result.total === 1 ? 'heads' : 'tails'}`
              : `Dice: [${result.dice.join(', ')}]`}
          </div>
        </div>
      )}
    </div>
  );
};
