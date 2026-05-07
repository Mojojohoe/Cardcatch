import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  CylinderGeometry,
  SRGBColorSpace,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { World, Vec3, Body, Box, Cylinder, ContactMaterial, Material } from 'cannon-es';
import type { PlayerRole, RoomData } from '../types';
import { useChipPileSync } from '../hooks/useChipPileSync';
import { HoldDelayTooltip } from './HoldDelayTooltip';

/**
 * Chip radius must stay **inside** {@link PLAY_HALF_X} / {@link PLAY_HALF_Z} with margin — larger coins than the
 * pen caused overlap explosions / tunneling so meshes vanished until random luck on spawn.
 */
const COIN_R = 5.16;
const COIN_H = 1.48;
const DROP_Y = 52;
const CONTAINER_HALF_X = 22;
const CONTAINER_HALF_Z = 13;
const CONTAINER_WALL_THICK = 0.56;
const CONTAINER_WALL_HEIGHT_Y = 90;
/** Lower the felt so stacks sit deeper in frame. */
const FLOOR_Y = -3.35;
/** Nudge the front (+Z) containment wall toward the camera so chips can tip forward slightly before contact. */
const FRONT_WALL_Z_EXTRA = 6;
/** Narrow interior half-width so ±X slabs sit slightly inside nominal bounds (fewer sideways escapes). */
const PLAY_MARGIN_X_SHRINK = 1.9;

/** Tiny spawn spread so chips fall into one stack lane. */
const STACK_SPAWN_JITTER = 0.18;

/** Advance physics this many × wall-clock time → snappier fall. */
const SIM_SPEED = 2;
const REST_LINEAR_V2 = 0.00018;
const REST_ANGULAR_W2 = 0.0003;
const REST_FLATNESS_MIN = 0.82;
const REST_TIME_FLAT_S = 1.1;
const REST_TIME_ANY_S = 2.6;
const UPRIGHT_BIAS_TORQUE = 2.35;
const UPRIGHT_BIAS_DAMP = 1.05;
const NEAR_REST_LATERAL_DAMP = 0.86;
const CHIP_GLTF_URL = `${import.meta.env.BASE_URL}assets/models/poker_chip.glb`;

type CoinEntry = { mesh: Object3D; body: Body };

function prepareTintedChipTemplate(template: Object3D, chipColorHex: number, chipEmissiveHex: number): Object3D {
  const out = template.clone(true);
  out.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = mats.map((m) => {
      const sm = (m as MeshStandardMaterial).clone();
      sm.emissive.setHex(chipEmissiveHex);
      sm.emissiveIntensity = 0.06;
      return sm;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return out;
}

function instantiateTintedChip(template: Object3D): Object3D {
  return template.clone(true);
}

function disposeObjectMaterials(root: Object3D | null) {
  if (!root) return;
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => (m as MeshStandardMaterial).dispose());
  });
}

export type ChipSimulationHandle = {
  spawn: () => void;
  resetToCount: (count: number) => void;
};

function tokenPalette(role: PlayerRole | undefined): { chipColor: number; chipEmissive: number } {
  if (role === 'Prey') {
    return { chipColor: 0xef4444, chipEmissive: 0x3b0000 };
  }
  if (role === 'Preydator') {
    return { chipColor: 0xef4444, chipEmissive: 0x3b0000 };
  }
  return { chipColor: 0xef4444, chipEmissive: 0x3b0000 };
}

function tokenHueFilter(role: PlayerRole | undefined): string {
  if (role === 'Prey') return 'hue-rotate(200deg)';
  if (role === 'Preydator') return 'hue-rotate(300deg)';
  return 'none';
}

type SimulationProps = {
  /** Chip body colour */
  chipColor: number;
  chipEmissive: number;
  /** Panel fills this region (fixed / absolute sizing by caller) */
  className?: string;
  /** Hover / focus on Cash Chips button: brighter emissive on spawned chips only. */
  pileAccent?: boolean;
};

/** One independent chip pile (own scene / world). */
export const ChipSimulationCanvas = forwardRef<ChipSimulationHandle, SimulationProps>(function ChipSimulationCanvas(
  { chipColor, chipEmissive, className, pileAccent = false },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const coinsRef = useRef<CoinEntry[]>([]);
  const rafRef = useRef<number>(0);
  const geomRef = useRef<CylinderGeometry | null>(null);
  const matRef = useRef<MeshStandardMaterial | null>(null);
  const chipTemplateRef = useRef<Object3D | null>(null);
  const groundBodyRef = useRef<Body | null>(null);
  const physicsMatsRef = useRef<{ chip: Material } | null>(null);
  const stillForRef = useRef<WeakMap<Body, number>>(new WeakMap());
  const pileAccentRef = useRef(pileAccent);
  pileAccentRef.current = pileAccent;

  const applyPileAccentToMeshRoot = useCallback((root: Object3D) => {
    const emissiveMul = pileAccentRef.current ? 6.5 : 1;
    root.traverse((node) => {
      const m = node as Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        const sm = mat as MeshStandardMaterial;
        if (sm?.emissiveIntensity !== undefined) sm.emissiveIntensity = 0.06 * emissiveMul;
      }
    });
  }, []);

  const spawnCoin = useCallback(() => {
    const world = worldRef.current;
    const scene = sceneRef.current;
    const geom = geomRef.current;
    const mat = matRef.current;
    const template = chipTemplateRef.current;
    const pm = physicsMatsRef.current;
    if (!world || !scene || !pm || (!template && (!geom || !mat))) return;

    const shape = new Cylinder(COIN_R, COIN_R, COIN_H, 24);
    const sx = STACK_SPAWN_JITTER;
    const sz = STACK_SPAWN_JITTER;
    const body = new Body({
      mass: 0.45,
      shape,
      material: pm.chip,
      linearDamping: 0.46,
      angularDamping: 0.88,
      position: new Vec3((Math.random() - 0.5) * 2 * sx, DROP_Y, (Math.random() - 0.5) * 2 * sz),
    });
    body.quaternion.setFromAxisAngle(new Vec3(0, 1, 0), Math.random() * Math.PI * 2);
    body.velocity.set(0, -0.75, 0);
    body.angularVelocity.set((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.2);
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.03;
    body.sleepTimeLimit = 2.8;
    world.addBody(body);

    const mesh = template ? instantiateTintedChip(template) : new Mesh(geom!, mat!);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(body.position.x, body.position.y, body.position.z);
    mesh.quaternion.set(
      body.quaternion.x,
      body.quaternion.y,
      body.quaternion.z,
      body.quaternion.w,
    );
    scene.add(mesh);
    coinsRef.current.push({ mesh, body });
    applyPileAccentToMeshRoot(mesh);
  }, [applyPileAccentToMeshRoot]);

  const clearCoins = useCallback(() => {
    const world = worldRef.current;
    const scene = sceneRef.current;
    if (!world || !scene) return;
    for (const { mesh, body } of coinsRef.current) {
      scene.remove(mesh);
      world.removeBody(body);
    }
    coinsRef.current = [];
  }, []);

  const resetToCount = useCallback(
    (count: number) => {
      clearCoins();
      const n = Math.min(140, Math.max(0, Math.floor(count)));
      for (let i = 0; i < n; i++) spawnCoin();
    },
    [clearCoins, spawnCoin],
  );

  useImperativeHandle(ref, () => ({ spawn: spawnCoin, resetToCount }), [spawnCoin, resetToCount]);

  useEffect(() => {
    for (const { mesh } of coinsRef.current) applyPileAccentToMeshRoot(mesh);
  }, [pileAccent, applyPileAccentToMeshRoot]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const scene = new Scene();
    sceneRef.current = scene;

    /** Higher / tighter view reduces depth foreshortening vs a low wide camera. */
    const camera = new PerspectiveCamera(40, 1, 0.1, 500);
    camera.position.set(0, 36, 54);
    camera.lookAt(0, 3.2, 0);
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;
    root.appendChild(renderer.domElement);

    const world = new World({ gravity: new Vec3(0, -24, 0) });
    world.defaultContactMaterial.friction = 0.58;
    world.defaultContactMaterial.restitution = 0.06;
    worldRef.current = world;

    const chipMat = new Material('chip');
    const feltMat = new Material('felt');
    world.addContactMaterial(new ContactMaterial(chipMat, feltMat, { friction: 0.84, restitution: 0.02 }));
    const wallMat = new Material('chip-wall');
    world.addContactMaterial(new ContactMaterial(chipMat, wallMat, { friction: 0.9, restitution: 0.005 }));
    world.addContactMaterial(new ContactMaterial(feltMat, wallMat, { friction: 0.86, restitution: 0.005 }));
    physicsMatsRef.current = { chip: chipMat };

    const fallbackGeom = new CylinderGeometry(COIN_R, COIN_R, COIN_H, 40);
    const fallbackMat = new MeshStandardMaterial({
      color: chipColor,
      emissive: chipEmissive,
      emissiveIntensity: 0.26,
      metalness: 0.48,
      roughness: 0.28,
    });
    geomRef.current = fallbackGeom;
    matRef.current = fallbackMat;

    const groundHalf = new Vec3(220, 0.18, 220);
    const groundShape = new Box(groundHalf);
    const ground = new Body({ mass: 0, shape: groundShape, material: feltMat });
    ground.position.set(0, FLOOR_Y - groundHalf.y, 0);
    world.addBody(ground);
    groundBodyRef.current = ground;

    const wy = CONTAINER_WALL_HEIGHT_Y / 2;
    const hx = CONTAINER_WALL_THICK / 2;
    const hz = CONTAINER_WALL_THICK / 2;
    const ix = Math.max(8, CONTAINER_HALF_X - PLAY_MARGIN_X_SHRINK);
    /** Side slabs extend in Z to match the forward-shifted front wall (`FRONT_WALL_Z_EXTRA`). */
    const zExtentSide = CONTAINER_HALF_Z + CONTAINER_WALL_THICK + FRONT_WALL_Z_EXTRA;
    const xExtent = ix + CONTAINER_WALL_THICK;
    const addWall = (half: Vec3, pos: Vec3) => {
      const wall = new Body({ mass: 0, shape: new Box(half), material: wallMat });
      wall.position.copy(pos);
      world.addBody(wall);
    };
    addWall(new Vec3(hx, wy, zExtentSide), new Vec3(ix + hx, wy, 0));
    addWall(new Vec3(hx, wy, zExtentSide), new Vec3(-ix - hx, wy, 0));
    addWall(new Vec3(xExtent, wy, hz), new Vec3(0, wy, CONTAINER_HALF_Z + hz + FRONT_WALL_Z_EXTRA));
    addWall(new Vec3(xExtent, wy, hz), new Vec3(0, wy, -CONTAINER_HALF_Z - hz));

    let mounted = true;
    const loader = new GLTFLoader();
    loader.load(
      CHIP_GLTF_URL,
      (gltf) => {
        if (!mounted) return;
        const rootModel = gltf.scene;
        const bounds = new Box3().setFromObject(rootModel);
        const size = bounds.getSize(new Vector3());
        const center = bounds.getCenter(new Vector3());
        const modelWidth = Math.max(size.x, size.z, 0.0001);
        const modelHeight = Math.max(size.y, 0.0001);
        const sxz = (2 * COIN_R) / modelWidth;
        const sy = COIN_H / modelHeight;

        const centered = rootModel.clone(true);
        centered.position.set(-center.x, -center.y, -center.z);
        centered.scale.set(sxz, sy, sxz);

        const wrapped = new Group();
        wrapped.add(centered);
        chipTemplateRef.current = prepareTintedChipTemplate(wrapped, chipColor, chipEmissive);
      },
      undefined,
      () => {
        // Keep cylinder fallback when model load fails.
      },
    );

    scene.add(new AmbientLight(0xffffff, 0.72));
    const key = new DirectionalLight(0xfff4e0, 1.14);
    key.position.set(32, 55, 18);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.8;
    key.shadow.camera.far = 240;
    key.shadow.camera.left = -42;
    key.shadow.camera.right = 42;
    key.shadow.camera.top = 48;
    key.shadow.camera.bottom = -28;
    scene.add(key);
    const fill = new DirectionalLight(0xffcaca, 0.45);
    fill.position.set(-40, 24, -22);
    scene.add(fill);
    // Keep front/back containment in physics only (no opaque render blockers).

    const resize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      if (w < 2 || h < 2) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const fixed = 1 / 90;
    let last = performance.now() / 1000;
    const onVisibilityChange = () => {
      if (!document.hidden) {
        /** After tab sleep the next frame’s wall-clock gap is useless for physics; restart integration clock. */
        last = performance.now() / 1000;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const loop = () => {
      if (document.hidden) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const now = performance.now() / 1000;
      let t = now - last;
      last = now;
      t = Math.min(t, 0.095) * SIM_SPEED;
      world.step(fixed, t, 5);

      for (const { mesh, body } of coinsRef.current) {
        // Soft stabilization: nudge toward flatter posture without hard axis-locking motion.
        const qx = body.quaternion.x;
        const qz = body.quaternion.z;
        body.torque.x += -qx * UPRIGHT_BIAS_TORQUE - body.angularVelocity.x * UPRIGHT_BIAS_DAMP;
        body.torque.z += -qz * UPRIGHT_BIAS_TORQUE - body.angularVelocity.z * UPRIGHT_BIAS_DAMP;

        // Reduce long-run "ice skating" in tall stacks while preserving regular fall dynamics.
        const nearRest = body.velocity.lengthSquared() < 0.045;
        if (nearRest) {
          body.velocity.x *= NEAR_REST_LATERAL_DAMP;
          body.velocity.z *= NEAR_REST_LATERAL_DAMP;
        }

        mesh.position.set(body.position.x, body.position.y, body.position.z);
        mesh.quaternion.set(
          body.quaternion.x,
          body.quaternion.y,
          body.quaternion.z,
          body.quaternion.w,
        );
        const linV2 = body.velocity.lengthSquared();
        const angW2 = body.angularVelocity.lengthSquared();
        const nearlyStill = linV2 < REST_LINEAR_V2 && angW2 < REST_ANGULAR_W2;
        const prior = stillForRef.current.get(body) ?? 0;
        const stillFor = nearlyStill ? prior + t : 0;
        stillForRef.current.set(body, stillFor);

        /**
         * Prefer sleeping chips once they're face-up/face-down to avoid frozen-on-edge snapshots.
         * Fallback long-idle sleep avoids endless micro-jitter if one leans in a corner.
         */
        const axisY = Math.abs(1 - 2 * (body.quaternion.x * body.quaternion.x + body.quaternion.z * body.quaternion.z));
        const flatEnough = axisY >= REST_FLATNESS_MIN;
        if (!body.sleepState && nearlyStill && ((flatEnough && stillFor >= REST_TIME_FLAT_S) || stillFor >= REST_TIME_ANY_S)) {
          body.sleep();
        }
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      for (const { mesh, body } of coinsRef.current) {
        scene.remove(mesh);
        world.removeBody(body);
      }
      coinsRef.current = [];
      if (groundBodyRef.current) world.removeBody(groundBodyRef.current);
      groundBodyRef.current = null;
      physicsMatsRef.current = null;
      geomRef.current?.dispose();
      matRef.current?.dispose();
      renderer.dispose();
      root.removeChild(renderer.domElement);
      sceneRef.current = null;
      worldRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      geomRef.current = null;
      matRef.current = null;
      disposeObjectMaterials(chipTemplateRef.current);
      chipTemplateRef.current = null;
    };
  }, [chipColor, chipEmissive]);

  return (
    <div ref={rootRef} className={`pointer-events-none h-full min-h-[120px] w-full touch-none overflow-hidden ${className ?? ''}`} aria-hidden />
  );
});

/** Dev physics chip test: two viewports ±35vw from table centre, beneath round-resolution overlay (z-[300]). */
export const ChipDropperTest: React.FC<{
  room: RoomData;
  myUid: string;
  selfBalance: number;
  opponentBalance: number;
  /** True while Cash Chips control is hovered/focused — your pile glows (not the frame). */
  highlightSelfTokens?: boolean;
  selfTokensHoldCaption: string;
  opponentTokensHoldCaption: string;
}> = ({
  room,
  myUid,
  selfBalance,
  opponentBalance,
  highlightSelfTokens = false,
  selfTokensHoldCaption,
  opponentTokensHoldCaption,
}) => {
  const leftRef = useRef<ChipSimulationHandle | null>(null);
  const rightRef = useRef<ChipSimulationHandle | null>(null);

  const opponentUid = Object.keys(room.players).find((uid) => uid !== myUid) ?? null;
  const me = room.players[myUid];
  const opponent = opponentUid ? room.players[opponentUid] : null;
  const myPalette = tokenPalette(me?.role);
  const oppPalette = tokenPalette(opponent?.role);

  useChipPileSync(rightRef, selfBalance);
  useChipPileSync(leftRef, opponentBalance);

  return (
    <>
      {/* Below results / panic overlays (z-[300]+); above main table (z-[20]) */}
      <div className="fixed inset-0 z-[40] pointer-events-none">
        <HoldDelayTooltip
          caption={opponentTokensHoldCaption}
          className="pointer-events-auto absolute top-[35%] left-[calc(50%-18vw)] flex h-[min(40vh,25rem)] w-[min(22vw,19rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl"
          style={{ filter: tokenHueFilter(opponent?.role) }}
        >
          <div className="pointer-events-none absolute top-1 left-2 z-10 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-100">
            Their tokens: {opponentBalance}
          </div>
          <ChipSimulationCanvas ref={leftRef} chipColor={oppPalette.chipColor} chipEmissive={oppPalette.chipEmissive} className="min-h-0 flex-1" />
        </HoldDelayTooltip>
        <HoldDelayTooltip
          caption={selfTokensHoldCaption}
          className="pointer-events-auto absolute top-1/2 left-[calc(50%+28vw)] flex h-[min(56vh,34rem)] w-[min(32vw,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl"
          style={{ filter: tokenHueFilter(me?.role) }}
        >
          <div className="pointer-events-none absolute top-1 left-2 z-10 rounded-md bg-black/55 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-100">
            Your tokens: {selfBalance}
          </div>
          <ChipSimulationCanvas
            ref={rightRef}
            chipColor={myPalette.chipColor}
            chipEmissive={myPalette.chipEmissive}
            pileAccent={highlightSelfTokens}
            className="min-h-0 flex-1"
          />
        </HoldDelayTooltip>
      </div>
    </>
  );
};
