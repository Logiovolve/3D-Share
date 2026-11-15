'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AnimState, CameraSync, Vec3 } from '@/lib/types';

export type ViewerPin = { id: string; position: Vec3; normal: Vec3; color: string; number: number };
export type ClipInfo = { name: string; duration: number };
export type ViewerApi = {
  getCamera: () => { position: Vec3; target: Vec3 } | null;
  getAnimTime: () => number;
};
type Bounds = { center: THREE.Vector3; size: number };
type Orbit = { target: THREE.Vector3; update: () => void };

/* ---------- モデル（アニメーション付き） ---------- */
function Model({ url, placeMode, onPlace, onBounds, onClips, anim, animTimeRef }: {
  url: string; placeMode: boolean; onPlace: (p: Vec3, n: Vec3) => void; onBounds: (b: Bounds) => void;
  onClips: (c: ClipInfo[]) => void; anim: AnimState | null; animTimeRef: MutableRefObject<() => number>;
}) {
  const { scene, animations } = useGLTF(url);
  const cloned = useMemo(() => cloneSkinned(scene), [scene]); // スキンメッシュも壊さず複製
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const animRef = useRef(anim);
  animRef.current = anim;
  const rev = anim?.rev ?? -1;

  useEffect(() => {
    cloned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    onBounds({ center: box.getCenter(new THREE.Vector3()), size: Math.max(sphere.radius * 2, 0.001) });
  }, [cloned, onBounds]);

  useEffect(() => {
    onClips(animations.map((a) => ({ name: a.name, duration: a.duration })));
  }, [animations, onClips]);

  useEffect(() => {
    animTimeRef.current = () => actionRef.current?.time ?? 0;
    return () => { animTimeRef.current = () => 0; };
  }, [animTimeRef]);

  useFrame((_, dt) => mixer.update(dt));
  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);

  // 教員の操作（rev が変わったとき）だけアニメーションをやり直す
  useEffect(() => {
    const a = animRef.current;
    if (!a) return;
    if (!animations.length) return;
    mixer.stopAllAction();
    const loop = a.loop !== false;
    // すべてのクリップを同時に再生する
    const actions = animations.map((clip) => {
      const action = mixer.clipAction(clip);
      action.reset();
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = true; // ループOFFのときは最後のポーズで止まる
      action.time = loop ? (clip.duration > 0 ? a.time % clip.duration : 0) : Math.min(a.time, clip.duration);
      action.timeScale = a.speed;
      action.paused = !a.playing;
      action.play();
      return action;
    });
    mixer.update(0);
    // 再生位置の基準は一番長いクリップ
    actionRef.current = actions.reduce((m, x) => (x.getClip().duration > m.getClip().duration ? x : m), actions[0]);
  }, [rev, animations, mixer]);

  const place = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.face) return;
    const n = e.face.normal.clone().transformDirection(e.object.matrixWorld).normalize();
    onPlace([e.point.x, e.point.y, e.point.z], [n.x, n.y, n.z]);
  };

  return (
    <primitive
      object={cloned}
      onClick={(e: ThreeEvent<MouseEvent>) => { if (placeMode && e.delta <= 5) place(e); }}
      onDoubleClick={(e: ThreeEvent<MouseEvent>) => { if (!placeMode) place(e); }}
    />
  );
}

/* ---------- ピン（3D位置に追従するバッジ） ---------- */
const tmp = new THREE.Vector3();

function PinMarker({ pin, radius, selected, onSelect }: { pin: ViewerPin; radius: number; selected: boolean; onSelect: (id: string) => void }) {
  const normal = useMemo(() => new THREE.Vector3(...pin.normal).normalize(), [pin.normal]);
  const pos = useMemo(() => new THREE.Vector3(...pin.position).addScaledVector(normal, radius * 1.5), [pin.position, normal, radius]);
  const badge = useRef<HTMLButtonElement>(null);

  useFrame(({ camera }) => {
    if (!badge.current) return;
    const facing = tmp.copy(camera.position).sub(pos).dot(normal) > 0;
    badge.current.style.opacity = facing ? '1' : '0.25';
    badge.current.style.pointerEvents = facing ? 'auto' : 'none';
  });

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <group position={pos}>
      <mesh raycast={() => null}>
        <sphereGeometry args={[radius * 0.5, 16, 16]} />
        <meshBasicMaterial color={pin.color} />
      </mesh>
      <Html center zIndexRange={[20, 0]}>
        <button
          ref={badge}
          type="button"
          aria-label={`ピン${pin.number}`}
          onPointerDown={stop}
          onPointerUp={stop}
          onDoubleClick={stop}
          onClick={(e) => { e.stopPropagation(); onSelect(pin.id); }}
          style={{
            background: pin.color,
            width: selected ? 38 : 30,
            height: selected ? 38 : 30,
            boxShadow: selected ? '0 0 0 4px #fff, 0 2px 8px rgba(0,0,0,.5)' : '0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.4)',
          }}
          className="grid place-items-center rounded-full text-sm font-bold text-white"
        >
          {pin.number}
        </button>
      </Html>
    </group>
  );
}

/* ---------- カメラ（初期位置・視点シンクロ） ---------- */
function CameraRig({ bounds, cameraSync, followSync, apiRef, animTimeRef, liveRef, streaming, onStream }: {
  bounds: Bounds | null; cameraSync: CameraSync | null; followSync: boolean;
  apiRef: MutableRefObject<ViewerApi | null>; animTimeRef: MutableRefObject<() => number>;
  liveRef: MutableRefObject<{ position: Vec3; target: Vec3 } | null>;
  streaming: boolean; onStream?: (c: { position: Vec3; target: Vec3 }) => void;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Orbit | null;
  const anim = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const lastSync = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    apiRef.current = {
      getCamera: () =>
        controls
          ? { position: [camera.position.x, camera.position.y, camera.position.z], target: [controls.target.x, controls.target.y, controls.target.z] }
          : null,
      getAnimTime: () => animTimeRef.current(),
    };
    return () => { apiRef.current = null; };
  }, [camera, controls, apiRef, animTimeRef]);

  const syncRef = useRef({ cameraSync, followSync });
  syncRef.current = { cameraSync, followSync };

  useEffect(() => {
    if (!bounds || !controls) return;
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = bounds.size / 1000;
    cam.far = bounds.size * 100;
    cam.updateProjectionMatrix();
    const { cameraSync: cs, followSync: fs } = syncRef.current;
    if ((cs?.locked || cs?.follow) && fs) {
      // ロック／視点共有中に入室した場合は、最初から先生の視点にする
      camera.position.set(...cs.position);
      controls.target.set(...cs.target);
    } else {
      const d = bounds.size * 1.6;
      camera.position.set(bounds.center.x + d * 0.6, bounds.center.y + d * 0.5, bounds.center.z + d * 0.9);
      controls.target.copy(bounds.center);
    }
    controls.update();
  }, [bounds, controls, camera]);

  useEffect(() => {
    const key = cameraSync?.updated_at ?? null;
    if (lastSync.current === undefined) { lastSync.current = key; return; }
    if (key === lastSync.current) return;
    lastSync.current = key;
    if (!followSync || !cameraSync) return;
    anim.current = { pos: new THREE.Vector3(...cameraSync.position), target: new THREE.Vector3(...cameraSync.target) };
  }, [cameraSync, followSync]);

  const streamRef = useRef(onStream);
  streamRef.current = onStream;
  const live = useRef({ p: new THREE.Vector3(), t: new THREE.Vector3() });
  const last = useRef({ time: 0, p: new THREE.Vector3(), t: new THREE.Vector3() });

  useFrame((_, dt) => {
    if (!controls) return;
    const a = anim.current;
    const following = !!cameraSync?.follow; // 視点共有（先生の動きを真似る）
    if (!following) liveRef.current = null;

    if (a) {
      // 「注目！」：滑らかに先生の視点へ移動
      const k = 1 - Math.exp(-dt * 5);
      camera.position.lerp(a.pos, k);
      controls.target.lerp(a.target, k);
      controls.update();
      const eps = (bounds?.size ?? 1) * 0.002;
      if (camera.position.distanceTo(a.pos) < eps && controls.target.distanceTo(a.target) < eps) anim.current = null;
    } else if (followSync && following && liveRef.current) {
      // 視点連動中：先生のカメラの動きをそのまま追いかける
      const k = 1 - Math.exp(-dt * 12);
      live.current.p.set(...liveRef.current.position);
      live.current.t.set(...liveRef.current.target);
      camera.position.lerp(live.current.p, k);
      controls.target.lerp(live.current.t, k);
      controls.update();
    }

    if (streaming) {
      // 先生側：カメラが動いたら約12回/秒で配信
      const now = performance.now();
      if (now - last.current.time > 80) {
        const eps = (bounds?.size ?? 1) * 0.0005;
        if (camera.position.distanceTo(last.current.p) > eps || controls.target.distanceTo(last.current.t) > eps) {
          last.current.time = now;
          last.current.p.copy(camera.position);
          last.current.t.copy(controls.target);
          streamRef.current?.({
            position: [camera.position.x, camera.position.y, camera.position.z],
            target: [controls.target.x, controls.target.y, controls.target.z],
          });
        }
      }
    }
  });

  return null;
}

class ModelErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/* ---------- 本体 ---------- */
export default function Viewer3D({ modelUrl, pins, selectedId, placeMode, onPlace, onSelect, cameraSync, followSync, apiRef, animState, onClips, liveCamRef, streaming, onCameraStream }: {
  modelUrl: string; pins: ViewerPin[]; selectedId: string | null; placeMode: boolean;
  onPlace: (p: Vec3, n: Vec3) => void; onSelect: (id: string | null) => void;
  cameraSync: CameraSync | null; followSync: boolean; apiRef: MutableRefObject<ViewerApi | null>;
  animState: AnimState | null; onClips: (c: ClipInfo[]) => void;
  liveCamRef: MutableRefObject<{ position: Vec3; target: Vec3 } | null>;
  streaming: boolean; onCameraStream: (c: { position: Vec3; target: Vec3 }) => void;
}) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [failed, setFailed] = useState(false);
  const animTimeRef = useRef<() => number>(() => 0);
  const pinRadius = (bounds?.size ?? 1) * 0.012;

  return (
    <div className="relative h-full w-full">
      <Canvas
        className={placeMode ? '!cursor-crosshair' : ''}
        camera={{ fov: 50, position: [3, 2, 4], near: 0.01, far: 1000 }}
        dpr={[1, 2]}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={['#0f172a']} />
        <hemisphereLight args={['#ffffff', '#64748b', 1.4]} />
        <directionalLight position={[5, 10, 7]} intensity={2} />
        <directionalLight position={[-6, -4, -5]} intensity={0.8} />

        <ModelErrorBoundary onError={() => setFailed(true)}>
          <Suspense fallback={null}>
            <Model url={modelUrl} placeMode={placeMode} onPlace={onPlace} onBounds={setBounds} onClips={onClips} anim={animState} animTimeRef={animTimeRef} />
          </Suspense>
        </ModelErrorBoundary>

        {pins.map((p) => (
          <PinMarker key={p.id} pin={p} radius={pinRadius} selected={p.id === selectedId} onSelect={onSelect} />
        ))}

        <OrbitControls makeDefault enabled={!(followSync && (!!cameraSync?.locked || !!cameraSync?.follow))} enableDamping dampingFactor={0.12} screenSpacePanning />
        <CameraRig bounds={bounds} cameraSync={cameraSync} followSync={followSync} apiRef={apiRef} animTimeRef={animTimeRef} liveRef={liveCamRef} streaming={streaming} onStream={onCameraStream} />
      </Canvas>
      {!bounds && !failed && (
        <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-200">3Dモデルを読み込み中…</p>
      )}
      {failed && (
        <p className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="rounded-lg bg-white p-3 text-sm font-bold text-red-700">3Dモデルを読み込めませんでした。</span>
        </p>
      )}
    </div>
  );
}
