import React, { useCallback, useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
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

const COIN_R = 0.38;
const COIN_H = 0.16;
const DROP_Y = 9;

type CoinEntry = { mesh: Mesh; body: Body };

/**
 * Dev overlay: thick cylinder “chip” with Cannon-es gravity. Spawns from above the preview;
 * camera framing places the resting pile near the vertical center of the panel.
 */
export const ChipDropperTest: React.FC = () => {
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
      position: new Vec3((Math.random() - 0.5) * 0.35, DROP_Y, (Math.random() - 0.5) * 0.2),
    });
    body.velocity.set((Math.random() - 0.5) * 0.35, -0.2, (Math.random() - 0.5) * 0.25);
    body.angularVelocity.set((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2.5);
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

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const scene = new Scene();
    scene.background = new Color(0x0a1210);
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(48, 1, 0.1, 200);
    camera.position.set(0, 2.25, 11.25);
    camera.lookAt(0, 0.52, 0);
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
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

    const groundHalf = new Vec3(14, 0.18, 14);
    const groundShape = new Box(groundHalf);
    const ground = new Body({ mass: 0, shape: groundShape, material: feltMat });
    ground.position.set(0, -groundHalf.y, 0);
    world.addBody(ground);
    groundBodyRef.current = ground;

    const geom = new CylinderGeometry(COIN_R, COIN_R, COIN_H, 40);
    geomRef.current = geom;

    const mat = new MeshStandardMaterial({
      color: 0xc9a227,
      metalness: 0.55,
      roughness: 0.35,
    });
    matRef.current = mat;

    scene.add(new AmbientLight(0x6a7a72, 0.56));
    const key = new DirectionalLight(0xfff4e0, 1.14);
    key.position.set(4.8, 14, 6.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.8;
    key.shadow.camera.far = 44;
    key.shadow.camera.left = -11;
    key.shadow.camera.right = 11;
    key.shadow.camera.top = 9;
    key.shadow.camera.bottom = -8;
    scene.add(key);
    const fill = new DirectionalLight(0xa8c4ff, 0.26);
    fill.position.set(-5.2, 6.5, -4);
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
      t = Math.min(t, 0.095);
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
  }, []);

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-[480] flex w-[min(92vw,20rem)] flex-col gap-2 rounded-2xl border border-amber-700/40 bg-emerald-950/92 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-amber-400/95">Chip physics (dev)</span>
        <button
          type="button"
          onClick={spawnCoin}
          className="rounded-lg border border-amber-500/60 bg-amber-600/85 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-950 hover:bg-amber-500"
        >
          Drop chip
        </button>
      </div>
      <div
        ref={rootRef}
        className="relative h-52 w-full overflow-hidden rounded-xl border border-white/10 bg-black/30"
        aria-hidden
      />
      <p className="text-[8px] font-semibold leading-snug text-emerald-200/70">
        Three.js + cannon-es. Each drop spawns above the viewport; stacks settle near the middle of this panel (full-screen
        chip trays will use the same stack).
      </p>
    </div>
  );
};
