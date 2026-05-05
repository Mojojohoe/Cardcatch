import React, { useEffect, useId, useRef, useState } from 'react';
import type { DiceTestRollPayload } from '../services/gameService';
import { Box3, FrontSide, Quaternion, TextureLoader, Vector3, type Object3D, type Texture } from 'three';

/** World-space “table to sky” axis for DiceBox/Ammo setups (three.js convention is Y-up). */
const DICE_SCENE_WORLD_UP = new Vector3(0, 1, 0);

const DIE_PENDING_FACE_PIN = 'boneDiePendingFacePin';

/** Outward face normals in shell/d6 local space (must match how the GLB maps pips to axes). */
function faceValueLocalNormal(value: number): Vector3 {
  switch (value) {
    case 1:
      return new Vector3(0, 0, 1);
    case 2:
      return new Vector3(0, 1, 0);
    case 3:
      return new Vector3(1, 0, 0);
    case 4:
      return new Vector3(-1, 0, 0);
    case 5:
      return new Vector3(0, -1, 0);
    case 6:
      return new Vector3(0, 0, -1);
    default:
      return new Vector3(0, 0, 1);
  }
}

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
  const boneTemplateRef = useRef<Object3D | null>(null);
  const boneLoadPromiseRef = useRef<Promise<Object3D | null> | null>(null);
  const boneTextureRef = useRef<Texture | null>(null);
  const boneTexturePromiseRef = useRef<Promise<Texture | null> | null>(null);
  const patchedSpawnRef = useRef(false);
  /** Locks shell/invisible-die bbox ratio so successive spawns aren’t jittery. */
  const attachScaleKRef = useRef<number | null>(null);
  const scratchPinQuatDie = useRef(new Quaternion());
  const hideTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    };
  }, []);

  const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const loadBoneTexture = async (): Promise<Texture | null> => {
    if (boneTextureRef.current) return boneTextureRef.current;
    if (boneTexturePromiseRef.current) return boneTexturePromiseRef.current;
    boneTexturePromiseRef.current = (async () => {
      const loader = new TextureLoader();
      const texUrl = `${import.meta.env.BASE_URL}assets/models/Bone-dice-tex.png`;
      const tex = await loader.loadAsync(texUrl);
      // Keep texture brightness faithful (modern three.js uses colorSpace, older uses encoding).
      (tex as any).colorSpace = (tex as any).colorSpace ?? 'srgb';
      tex.flipY = false;
      tex.needsUpdate = true;
      boneTextureRef.current = tex;
      return tex;
    })();
    try {
      return await boneTexturePromiseRef.current;
    } finally {
      boneTexturePromiseRef.current = null;
    }
  };

  const loadBoneTemplate = async (): Promise<Object3D | null> => {
    if (boneTemplateRef.current) return boneTemplateRef.current;
    if (boneLoadPromiseRef.current) return boneLoadPromiseRef.current;
    boneLoadPromiseRef.current = (async () => {
      const [{ GLTFLoader }] = await Promise.all([import('three/examples/jsm/loaders/GLTFLoader.js')]);
      const loader = new GLTFLoader();
      const base = import.meta.env.BASE_URL ?? '/';
      const candidates = ['/assets/models/Dice.glb', '/assets/models/bone_dice.glb', '/assets/models/bone_die.glb'];

      let gltf: any;
      let choseDiceGlb = false;
      let lastErr: unknown;
      for (const rel of candidates) {
        const url = `${base.endsWith('/') ? base.slice(0, -1) : base}${rel}`.replace(/\/{2,}/g, '/');
        try {
          gltf = await loader.loadAsync(url);
          choseDiceGlb = rel.includes('Dice.glb');
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!gltf) throw lastErr ?? new Error('No dice shell GLB loaded');

      const root = gltf.scene.clone(true);
      root.updateMatrixWorld(true);
      /** Authoring at non-origin: re-center bbox to pivot at (0,0,0). */
      const box = new Box3().setFromObject(root);
      const size = new Vector3();
      const center = new Vector3();
      box.getSize(size);
      box.getCenter(center);
      root.position.sub(center);
      root.updateMatrixWorld(true);

      const maxAxis = Math.max(size.x, size.y, size.z);
      if (maxAxis > 0) {
        const targetSize = 1.75;
        const uniform = targetSize / maxAxis;
        root.scale.setScalar(uniform);
      }

      const overrideTex = choseDiceGlb ? null : await loadBoneTexture();

      root.traverse((obj: any) => {
        obj.userData = { ...(obj.userData ?? {}), boneDieShell: true };
        if (obj.material) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          if (Array.isArray(obj.material)) {
            for (const m of obj.material) {
              if (!m) continue;
              m.transparent = false;
              m.opacity = 1;
              m.depthWrite = true;
              m.depthTest = true;
              m.side = FrontSide;
              if (overrideTex) {
                m.alphaTest = 0.38;
                m.map = overrideTex;
              } else {
                m.alphaTest = 0;
              }
              if (overrideTex && m.color?.multiplyScalar) m.color.multiplyScalar(1.28);
              if (overrideTex && 'toneMapped' in m) m.toneMapped = false;
              if (overrideTex && 'emissive' in m && m.emissive?.setRGB) m.emissive.setRGB(0.16, 0.12, 0.08);
              if (overrideTex && 'emissiveIntensity' in m) m.emissiveIntensity = 0.65;
              m.needsUpdate = true;
            }
          } else {
            const m = obj.material;
            m.transparent = false;
            m.opacity = 1;
            m.depthWrite = true;
            m.depthTest = true;
            m.side = FrontSide;
            if (overrideTex) {
              m.alphaTest = 0.38;
              m.map = overrideTex;
            } else {
              m.alphaTest = 0;
            }
            if (overrideTex && m.color?.multiplyScalar) m.color.multiplyScalar(1.28);
            if (overrideTex && 'toneMapped' in m) m.toneMapped = false;
            if (overrideTex && 'emissive' in m && m.emissive?.setRGB) m.emissive.setRGB(0.16, 0.12, 0.08);
            if (overrideTex && 'emissiveIntensity' in m) m.emissiveIntensity = 0.65;
            m.needsUpdate = true;
          }
        }
      });
      boneTemplateRef.current = root;
      return root;
    })();
    try {
      return await boneLoadPromiseRef.current;
    } finally {
      boneLoadPromiseRef.current = null;
    }
  };

  const scheduleAttachBoneShell = (dieObj: any) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void attachBoneShell(dieObj);
      });
    });
  };

  /** Shell is a visual child of the physics die mesh: rotate shell in die-local space so `faceValue` faces world up (authoritative pin). */
  const pinBoneShellToFaceValue = (dieObj: Object3D, faceValueRaw: unknown): boolean => {
    const shell = dieObj.getObjectByName?.('bone-die-shell-root');
    if (!shell || typeof shell.quaternion?.setFromUnitVectors !== 'function') return false;
    const faceValue = Math.round(Number(faceValueRaw));
    if (!Number.isFinite(faceValue) || faceValue < 1 || faceValue > 6) return false;

    dieObj.updateWorldMatrix(true);
    const nFaceLocal = faceValueLocalNormal(faceValue).normalize();

    const qDieWorld = scratchPinQuatDie.current;
    dieObj.getWorldQuaternion(qDieWorld);
    const qInv = qDieWorld.clone().invert();
    const targetDieLocal = DICE_SCENE_WORLD_UP.clone().normalize().applyQuaternion(qInv);
    shell.quaternion.setFromUnitVectors(nFaceLocal, targetDieLocal.normalize());
    shell.updateWorldMatrix(true);
    return true;
  };

  const reconcileAllShellPinsForRoll = async (values: readonly number[]): Promise<void> => {
    const dice = diceRef.current as DiceBoxInstance & { diceList?: unknown[] };
    const list = Array.isArray(dice?.diceList) ? dice.diceList : [];
    if (!list.length || !values.length) return;

    const maxAttempts = 90;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let allPinsApplied = true;
      for (let di = 0; di < list.length; di++) {
        const dieObj = list[di];
        const vi = Math.min(di, values.length - 1);
        const value = Math.max(1, Math.min(6, Math.round(values[vi]!)));
        const hasShell =
          !!dieObj && typeof dieObj.getObjectByName === 'function' && !!dieObj.getObjectByName('bone-die-shell-root');
        if (!hasShell) {
          allPinsApplied = false;
          continue;
        }
        pinBoneShellToFaceValue(dieObj as Object3D, value);
      }
      if (allPinsApplied) break;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
  };

  const attachBoneShell = async (dieObj: any): Promise<void> => {
    if (!dieObj || typeof dieObj.add !== 'function') return;
    if (dieObj.getObjectByName?.('bone-die-shell-root')) return;
    const template = await loadBoneTemplate();
    if (!template) return;
    const shell = template.clone(true);
    shell.name = 'bone-die-shell-root';

    dieObj.updateMatrixWorld(true);
    shell.updateMatrixWorld(true);
    const dieBox = new Box3().setFromObject(dieObj);
    const dieSize = new Vector3();
    dieBox.getSize(dieSize);
    const shellBox = new Box3().setFromObject(shell);
    const shellSize = new Vector3();
    shellBox.getSize(shellSize);
    const shellMax = Math.max(shellSize.x, shellSize.y, shellSize.z);
    const dieMax = Math.max(dieSize.x, dieSize.y, dieSize.z);
    if (shellMax > 0 && dieMax > 0) {
      const k = (dieMax / shellMax) * 0.98;
      const kUse = attachScaleKRef.current ?? k;
      if (attachScaleKRef.current == null) attachScaleKRef.current = kUse;
      shell.scale.multiplyScalar(kUse);
    }
    shell.position.set(0, 0, 0);
    shell.quaternion.identity();
    dieObj.add(shell);

    const pending = dieObj.userData?.[DIE_PENDING_FACE_PIN];
    if (pending != null) {
      pinBoneShellToFaceValue(dieObj as Object3D, pending);
    }

    const mats: any[] = Array.isArray(dieObj.material) ? dieObj.material : dieObj.material ? [dieObj.material] : [];
    for (const m of mats) {
      m.transparent = true;
      m.opacity = 0;
      m.depthWrite = false;
      m.colorWrite = false;
    }
  };

  const patchSpawnForBoneShell = (dice: DiceBoxInstance): void => {
    if (patchedSpawnRef.current) return;
    const anyDice = dice as any;
    if (typeof anyDice.spawnDice !== 'function') return;
    const originalSpawn = anyDice.spawnDice.bind(anyDice);
    anyDice.spawnDice = (...args: any[]) => {
      const beforeLen = Array.isArray(anyDice.diceList) ? anyDice.diceList.length : 0;
      const out = originalSpawn(...args);
      const reusedDie = args.length > 1 ? args[1] : null;
      if (reusedDie && typeof reusedDie.add === 'function') {
        scheduleAttachBoneShell(reusedDie);
      } else if (Array.isArray(anyDice.diceList)) {
        // spawnDice() returns void in this library; pick the newly appended die object.
        const afterLen = anyDice.diceList.length;
        if (afterLen > beforeLen) {
          const spawnedDie = anyDice.diceList[afterLen - 1];
          scheduleAttachBoneShell(spawnedDie);
        }
      }
      return out;
    };
    if (typeof anyDice.swapDiceFace === 'function') {
      const originalSwapDiceFace = anyDice.swapDiceFace.bind(anyDice);
      anyDice.swapDiceFace = (dieObj: any, forcedValue: unknown) => {
        if (dieObj?.userData) dieObj.userData[DIE_PENDING_FACE_PIN] = forcedValue;
        const out = originalSwapDiceFace(dieObj, forcedValue);
        pinBoneShellToFaceValue(dieObj as Object3D, forcedValue);
        return out;
      };
    }
    patchedSpawnRef.current = true;
  };

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
          // Bone die first-pass: remap built-in "skulls" texture file to extracted GLB texture.
          theme_customColorset: {
            name: 'bone_die',
            foreground: '#2f2a22',
            background: ['#f1e5cc', '#dcc8a2', '#cab285', '#b89a6a'],
            outline: '#1f1b16',
            texture: 'skulls',
            material: 'wood',
          },
          theme_material: 'wood',
          shadows: true,
          theme_surface: 'green-felt',
          baseScale: 85,
          strength: 1.05,
        });
      }
      await diceRef.current.initialize();
      patchSpawnForBoneShell(diceRef.current);
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
          animated = await runDiceAnimation(diceRef.current, notation);
          if (!animated) {
            animated = await runDiceAnimation(diceRef.current, baseNotation);
          }
        } catch {
          try {
            animated = await runDiceAnimation(diceRef.current, baseNotation);
          } catch {
            animated = false;
          }
        }
        if (!animated) {
          // Avoid instant result pop when physics path failed.
          await sleep(700);
        }
        await reconcileAllShellPinsForRoll(ds);
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
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
            {roll?.notation ?? (result.dice.length <= 1 ? '1d6' : '2d6')}
          </div>
          <div className="text-xs font-bold">
            [{result.dice.join(', ')}]{result.dice.length > 1 ? ` = ${result.total}` : ''}
          </div>
        </div>
      )}
    </div>
  );
};
