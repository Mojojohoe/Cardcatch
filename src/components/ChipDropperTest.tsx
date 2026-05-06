import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  BoxGeometry,
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
const CONTAINER_WALL_HEIGHT_Y = 74;

/** Tiny spawn spread so chips fall into one stack lane. */
const STACK_SPAWN_JITTER = 0.18;

/** Advance physics this many × wall-clock time → snappier fall. */
const SIM_SPEED = 2;
const REST_LINEAR_V2 = 0.00018;
const REST_ANGULAR_W2 = 0.0003;
const REST_FLATNESS_MIN = 0.82;
const REST_TIME_FLAT_S = 1.1;
const REST_TIME_ANY_S = 2.6;
const CHIP_GLTF_URL = `${import.meta.env.BASE_URL}assets/models/casino_poker_chip.glb`;

type CoinEntry = { mesh: Object3D; body: Body };

function prepareTintedChipTemplate(template: Object3D, chipColorHex: number, chipEmissiveHex: number): Object3D {
  const out = template.clone(true);
  out.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = mats.map((m) => {
      const sm = (m as MeshStandardMaterial).clone();
      // Preserve the GLB's native poker texture; only add subtle seat glow.
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
};

type SimulationProps = {
  /** Chip body colour */
  chipColor: number;
  chipEmissive: number;
  /** Panel fills this region (fixed / absolute sizing by caller) */
  className?: string;
};

/** One independent chip pile (own scene / world). */
export const ChipSimulationCanvas = forwardRef<ChipSimulationHandle, SimulationProps>(function ChipSimulationCanvas(
  { chipColor, chipEmissive, className },
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
      linearDamping: 0.35,
      angularDamping: 0.82,
      position: new Vec3((Math.random() - 0.5) * 2 * sx, DROP_Y, (Math.random() - 0.5) * 2 * sz),
    });
    body.quaternion.setFromAxisAngle(new Vec3(0, 1, 0), Math.random() * Math.PI * 2);
    body.velocity.set(0, -0.75, 0);
    body.angularVelocity.set(0, (Math.random() - 0.5) * 0.08, 0);
    body.angularFactor.set(0, 1, 0);
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
  }, []);

  useImperativeHandle(ref, () => ({ spawn: spawnCoin }), [spawnCoin]);

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
    world.addContactMaterial(new ContactMaterial(chipMat, feltMat, { friction: 0.66, restitution: 0.03 }));
    const wallMat = new Material('chip-wall');
    world.addContactMaterial(new ContactMaterial(chipMat, wallMat, { friction: 0.72, restitution: 0.01 }));
    world.addContactMaterial(new ContactMaterial(feltMat, wallMat, { friction: 0.75, restitution: 0.01 }));
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
    ground.position.set(0, -groundHalf.y, 0);
    world.addBody(ground);
    groundBodyRef.current = ground;

    const wy = CONTAINER_WALL_HEIGHT_Y / 2;
    const hx = CONTAINER_WALL_THICK / 2;
    const hz = CONTAINER_WALL_THICK / 2;
    const zExtent = CONTAINER_HALF_Z + CONTAINER_WALL_THICK;
    const xExtent = CONTAINER_HALF_X + CONTAINER_WALL_THICK;
    const addWall = (half: Vec3, pos: Vec3) => {
      const wall = new Body({ mass: 0, shape: new Box(half), material: wallMat });
      wall.position.copy(pos);
      world.addBody(wall);
    };
    addWall(new Vec3(hx, wy, zExtent), new Vec3(CONTAINER_HALF_X + hx, wy, 0));
    addWall(new Vec3(hx, wy, zExtent), new Vec3(-CONTAINER_HALF_X - hx, wy, 0));
    addWall(new Vec3(xExtent, wy, hz), new Vec3(0, wy, CONTAINER_HALF_Z + hz));
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
    const guardMat = new MeshStandardMaterial({ color: 0x070707, metalness: 0, roughness: 0.96 });
    const guardW = 2 * (CONTAINER_HALF_X + CONTAINER_WALL_THICK);
    const guardH = CONTAINER_WALL_HEIGHT_Y;
    const guardD = CONTAINER_WALL_THICK;
    const frontGuard = new Mesh(new BoxGeometry(guardW, guardH, guardD), guardMat);
    frontGuard.position.set(0, guardH / 2, CONTAINER_HALF_Z + CONTAINER_WALL_THICK / 2);
    frontGuard.receiveShadow = true;
    scene.add(frontGuard);
    const backGuard = new Mesh(new BoxGeometry(guardW, guardH, guardD), guardMat.clone());
    backGuard.position.set(0, guardH / 2, -CONTAINER_HALF_Z - CONTAINER_WALL_THICK / 2);
    backGuard.receiveShadow = true;
    scene.add(backGuard);

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
    const loop = () => {
      const now = performance.now() / 1000;
      let t = now - last;
      last = now;
      t = Math.min(t, 0.095) * SIM_SPEED;
      world.step(fixed, t, 5);

      for (const { mesh, body } of coinsRef.current) {
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
export const ChipDropperTest: React.FC = () => {
  const leftRef = useRef<ChipSimulationHandle | null>(null);
  const rightRef = useRef<ChipSimulationHandle | null>(null);

  const spawnBoth = useCallback(() => {
    leftRef.current?.spawn();
    rightRef.current?.spawn();
  }, []);

  return (
    <>
      {/* Below results / panic overlays (z-[300]+); above main table (z-[20]) */}
      <div className="pointer-events-none fixed inset-0 z-[40]" aria-hidden>
        <div
          className="absolute top-1/2 left-[calc(50%-35vw)] flex h-[min(56vh,34rem)] w-[min(32vw,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-red-500/45 bg-red-500/18 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.25)]"
          title="Red chip catchment (debug)"
        >
          <ChipSimulationCanvas ref={leftRef} chipColor={0xef4444} chipEmissive={0x3b0000} className="min-h-0 flex-1" />
        </div>
        <div
          className="absolute top-1/2 left-[calc(50%+35vw)] flex h-[min(56vh,34rem)] w-[min(32vw,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-blue-500/45 bg-blue-500/18 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.25)]"
          title="Blue chip catchment (debug)"
        >
          <ChipSimulationCanvas ref={rightRef} chipColor={0x3b82f6} chipEmissive={0x000838} className="min-h-0 flex-1" />
        </div>
      </div>
      <button
        type="button"
        onClick={spawnBoth}
        className="pointer-events-auto fixed top-[max(4.75rem,calc(env(safe-area-inset-top,0px)+4.25rem))] right-[max(1rem,env(safe-area-inset-right,0px)+0.5rem)] z-[480] rounded-lg border border-red-400/75 bg-red-500/90 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-red-950 shadow-[0_6px_18px_rgba(0,0,0,0.35)] hover:bg-red-400"
      >
        Drop chip
      </button>
    </>
  );
};
