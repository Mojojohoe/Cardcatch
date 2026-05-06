import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
  CylinderGeometry,
  SRGBColorSpace,
} from 'three';
import { World, Vec3, Body, Box, Cylinder, ContactMaterial, Material } from 'cannon-es';

const COIN_R = 3.8;
const COIN_H = 1.6;
const DROP_Y = 52;

/** Shallow play slab on Z — chips stay near the focal plane so perspective doesn’t shrink “backward” motion. */
const PLAY_HALF_X = 3.05;
const PLAY_HALF_Z = 0.88;
const WALL_THICK = 0.32;
const WALL_HEIGHT_Y = 56;

/** Advance physics this many × wall-clock time → snappier fall. */
const SIM_SPEED = 2;

type CoinEntry = { mesh: Mesh; body: Body };

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
  const groundBodyRef = useRef<Body | null>(null);
  const physicsMatsRef = useRef<{ chip: Material } | null>(null);

  const spawnCoin = useCallback(() => {
    const world = worldRef.current;
    const scene = sceneRef.current;
    const geom = geomRef.current;
    const mat = matRef.current;
    const pm = physicsMatsRef.current;
    if (!world || !scene || !geom || !mat || !pm) return;

    const shape = new Cylinder(COIN_R, COIN_R, COIN_H, 24);
    const body = new Body({
      mass: 0.45,
      shape,
      material: pm.chip,
      linearDamping: 0.08,
      angularDamping: 0.22,
      position: new Vec3(
        (Math.random() - 0.5) * 2 * PLAY_HALF_X * 0.92,
        DROP_Y,
        (Math.random() - 0.5) * 2 * PLAY_HALF_Z * 0.88,
      ),
    });
    body.velocity.set((Math.random() - 0.5) * 1.05, -0.9, (Math.random() - 0.5) * 0.38);
    body.angularVelocity.set((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2.2);
    world.addBody(body);

    const mesh = new Mesh(geom, mat);
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
    world.defaultContactMaterial.friction = 0.45;
    world.defaultContactMaterial.restitution = 0.12;
    worldRef.current = world;

    const chipMat = new Material('chip');
    const feltMat = new Material('felt');
    world.addContactMaterial(new ContactMaterial(chipMat, feltMat, { friction: 0.52, restitution: 0.06 }));
    physicsMatsRef.current = { chip: chipMat };

    const groundHalf = new Vec3(220, 0.18, 220);
    const groundShape = new Box(groundHalf);
    const ground = new Body({ mass: 0, shape: groundShape, material: feltMat });
    ground.position.set(0, -groundHalf.y, 0);
    world.addBody(ground);
    groundBodyRef.current = ground;

    const wy = WALL_HEIGHT_Y / 2;
    const zExtent = PLAY_HALF_Z + WALL_THICK;
    const xExtent = PLAY_HALF_X + WALL_THICK;
    const chipWallMat = new Material('chipWall');
    world.addContactMaterial(new ContactMaterial(chipMat, chipWallMat, { friction: 0.42, restitution: 0.08 }));
    world.addContactMaterial(new ContactMaterial(chipWallMat, feltMat, { friction: 0.5, restitution: 0.05 }));

    const addWall = (half: Vec3, pos: Vec3) => {
      const b = new Body({ mass: 0, shape: new Box(half), material: chipWallMat });
      b.position.copy(pos);
      world.addBody(b);
    };
    const hx = WALL_THICK / 2;
    const hz = WALL_THICK / 2;
    addWall(new Vec3(hx, wy, zExtent), new Vec3(PLAY_HALF_X + hx, wy, 0));
    addWall(new Vec3(hx, wy, zExtent), new Vec3(-PLAY_HALF_X - hx, wy, 0));
    addWall(new Vec3(xExtent, wy, hz), new Vec3(0, wy, PLAY_HALF_Z + hz));
    addWall(new Vec3(xExtent, wy, hz), new Vec3(0, wy, -PLAY_HALF_Z - hz));

    const geom = new CylinderGeometry(COIN_R, COIN_R, COIN_H, 40);
    geomRef.current = geom;

    const mat = new MeshStandardMaterial({
      color: chipColor,
      emissive: chipEmissive,
      emissiveIntensity: 0.26,
      metalness: 0.48,
      roughness: 0.28,
    });
    matRef.current = mat;

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
        if (body.velocity.lengthSquared() < 0.00035 && body.angularVelocity.lengthSquared() < 0.00035) {
          body.sleep();
        }
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
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
      geom.dispose();
      mat.dispose();
      renderer.dispose();
      root.removeChild(renderer.domElement);
      sceneRef.current = null;
      worldRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      geomRef.current = null;
      matRef.current = null;
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
          className="absolute top-0 bottom-0 left-[calc(50%-35vw)] flex w-[min(32vw,28rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-red-500/45 bg-red-500/18 shadow-[inset_0_0_0_1px_rgba(248,113,113,0.25)]"
          title="Red chip catchment (debug)"
        >
          <ChipSimulationCanvas ref={leftRef} chipColor={0xef4444} chipEmissive={0x3b0000} className="min-h-0 flex-1" />
        </div>
        <div
          className="absolute top-0 bottom-0 left-[calc(50%+35vw)] flex w-[min(32vw,28rem)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-blue-500/45 bg-blue-500/18 shadow-[inset_0_0_0_1px_rgba(96,165,250,0.25)]"
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
