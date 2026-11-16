'use client';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AnimState, CameraSync, FollowMode, FollowState, PartInfo, Vec3 } from '@/lib/types';

export type ViewerPin = { id: string; position: Vec3; normal: Vec3; color: string; number: number };
export type ClipInfo = { name: string; duration: number };
export type ViewerApi = {
  getCamera: () => { position: Vec3; target: Vec3 } | null;
  getAnimTime: () => number;
  goOverview: () => void; // 全体視点（最初の見え方）へ滑らかに戻る
};
type Bounds = { center: THREE.Vector3; size: number };
type Orbit = {
  target: THREE.Vector3; update: () => void;
  rotateSpeed: number; enableZoom: boolean; enablePan: boolean;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};
type PartObjMap = MutableRefObject<Map<string, THREE.Object3D>>;

/* ---------- パーツの「中心」のワールド座標（アニメーションに追従） ---------- */
const _box = new THREE.Box3();
function partCenter(o: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
  const m = o as THREE.Mesh;
  if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh) {
    _box.setFromObject(o);
    if (!_box.isEmpty()) return _box.getCenter(out);
  }
  return o.getWorldPosition(out); // Empty などは原点（動きに合わせて移動）
}

/* ---------- モデル（アニメーション・パーツ選択付き） ---------- */
function Model({ url, placeMode, partsEnabled, onPlace, onBounds, onClips, onParts, onPartSelect, objMapRef, anim, animTimeRef }: {
  url: string; placeMode: boolean; partsEnabled: boolean; onPlace: (p: Vec3, n: Vec3) => void; onBounds: (b: Bounds) => void;
  onClips: (c: ClipInfo[]) => void; onParts: (p: PartInfo[]) => void; onPartSelect: (id: string) => void;
  objMapRef: PartObjMap; anim: AnimState | null; animTimeRef: MutableRefObject<() => number>;
}) {
  const { scene, animations } = useGLTF(url);
  const cloned = useMemo(() => cloneSkinned(scene), [scene]); // スキンメッシュも壊さず複製
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const animRef = useRef(anim);
  animRef.current = anim;
  const rev = anim?.rev ?? -1;

  // パーツ一覧：名前のある Mesh / Empty。走査順は全端末で同じなので「番号:名前」を共通IDにする
  const parts = useMemo(() => {
    const list: { id: string; name: string; kind: 'mesh' | 'empty'; obj: THREE.Object3D }[] = [];
    let i = 0;
    cloned.traverse((o) => {
      const idx = i++;
      const x = o as THREE.Object3D & { isBone?: boolean; isCamera?: boolean; isLight?: boolean; isMesh?: boolean };
      if (o === cloned || !o.name || x.isBone || x.isCamera || x.isLight) return;
      list.push({ id: `${idx}:${o.name}`, name: o.name, kind: x.isMesh ? 'mesh' : 'empty', obj: o });
    });
    return list;
  }, [cloned]);
  const idOf = useMemo(() => new Map(parts.map((p) => [p.obj, p.id])), [parts]);

  // 体内・回路の「中」に入っても壁が消えないよう、全メッシュを両面描画に
  useEffect(() => {
    cloned.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      (Array.isArray(mat) ? mat : [mat]).forEach((m) => { m.side = THREE.DoubleSide; m.needsUpdate = true; });
    });
  }, [cloned]);

  // 追従カメラが参照できるよう、先にパーツを登録（下の onBounds より前に実行される）
  useEffect(() => {
    objMapRef.current = new Map(parts.map((p) => [p.id, p.obj]));
    onParts(parts.map(({ id, name, kind }) => ({ id, name, kind })));
    return () => { objMapRef.current = new Map(); };
  }, [parts, objMapRef, onParts]);

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

  // アニメーションはカメラ更新より先に進める（追従カメラが1フレーム遅れないように）
  useFrame((_, dt) => mixer.update(dt), -1);
  useEffect(() => () => { mixer.stopAllAction(); }, [mixer]);

  // 教員の操作（rev が変わったとき）だけアニメーションをやり直す
  useEffect(() => {
    const a = animRef.current;
    if (!a) return;
    if (!animations.length) return;
    mixer.stopAllAction();
    const loop = a.loop !== false;
    const actions = animations.map((clip) => {
      const action = mixer.clipAction(clip);
      action.reset();
      action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = true;
      action.time = loop ? (clip.duration > 0 ? a.time % clip.duration : 0) : Math.min(a.time, clip.duration);
      action.timeScale = a.speed;
      action.paused = !a.playing;
      action.play();
      return action;
    });
    mixer.update(0);
    actionRef.current = actions.reduce((m, x) => (x.getClip().duration > m.getClip().duration ? x : m), actions[0]);
  }, [rev, animations, mixer]);

  const place = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!e.face) return;
    const n = e.face.normal.clone().transformDirection(e.object.matrixWorld).normalize();
    if (n.dot(e.ray.direction) > 0) n.negate(); // 裏側をタップしたときも、手前向きに
    onPlace([e.point.x, e.point.y, e.point.z], [n.x, n.y, n.z]);
  };

  // クリックしたメッシュ（名前がなければ親をたどる）をパーツとして選択
  const pick = (e: ThreeEvent<MouseEvent>) => {
    let o: THREE.Object3D | null = e.object;
    while (o) {
      const id = idOf.get(o);
      if (id) { e.stopPropagation(); onPartSelect(id); return; }
      o = o.parent;
    }
  };

  return (
    <primitive
      object={cloned}
      // 追加モード中は1タップでピン配置。それ以外は1タップでパーツ選択／ダブルタップでピン配置
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 5) return;
        if (placeMode) place(e);
        else if (partsEnabled) pick(e);
      }}
      onDoubleClick={(e: ThreeEvent<MouseEvent>) => { if (!placeMode) place(e); }}
    />
  );
}

/* ---------- 選択中パーツの目印 ---------- */
function PartHighlight({ objMapRef, id, size }: { objMapRef: PartObjMap; id: string | null; size: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const o = id ? objMapRef.current.get(id) : null;
    if (!o) { m.visible = false; return; }
    partCenter(o, m.position);
    m.visible = true;
  });
  return (
    <mesh ref={ref} visible={false} raycast={() => null} renderOrder={999}>
      <sphereGeometry args={[size * 0.02, 16, 12]} />
      <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.9} depthTest={false} />
    </mesh>
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

/* ---------- カメラ（初期位置・視点シンクロ・対象物追従） ---------- */
type FollowRt = {
  mode: FollowMode; obj: THREE.Object3D; phase: 'enter' | 'track';
  offset: THREE.Vector3; prev: THREE.Vector3; p0: THREE.Vector3; t0: number; vdirDone: boolean;
};

function applyControls(c: Orbit, mode: FollowMode | null) {
  if (mode === 'center') { c.rotateSpeed = -0.6; c.enableZoom = false; c.enablePan = false; } // 見回す（ゆっくり・向きは「世界をつかんで回す」）
  else if (mode === 'behind') { c.rotateSpeed = 0.8; c.enableZoom = true; c.enablePan = false; }
  else { c.rotateSpeed = 1; c.enableZoom = true; c.enablePan = true; }
}

function CameraRig({ bounds, cameraSync, followSync, apiRef, animTimeRef, liveRef, streaming, onStream, follow, objMapRef }: {
  bounds: Bounds | null; cameraSync: CameraSync | null; followSync: boolean;
  apiRef: MutableRefObject<ViewerApi | null>; animTimeRef: MutableRefObject<() => number>;
  liveRef: MutableRefObject<{ position: Vec3; target: Vec3 } | null>;
  streaming: boolean; onStream?: (c: { position: Vec3; target: Vec3 }) => void;
  follow: FollowState | null; objMapRef: PartObjMap;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Orbit | null;
  const anim = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const lastSync = useRef<string | null | undefined>(undefined);
  const followRt = useRef<FollowRt | null>(null);
  const size = bounds?.size ?? 1;
  const fid = follow?.id ?? null;
  const fmode = follow?.mode ?? null;

  useEffect(() => {
    apiRef.current = {
      getCamera: () =>
        controls
          ? { position: [camera.position.x, camera.position.y, camera.position.z], target: [controls.target.x, controls.target.y, controls.target.z] }
          : null,
      getAnimTime: () => animTimeRef.current(),
      goOverview: () => {
        if (!bounds) return;
        const d = bounds.size * 1.6;
        anim.current = {
          pos: new THREE.Vector3(bounds.center.x + d * 0.6, bounds.center.y + d * 0.5, bounds.center.z + d * 0.9),
          target: bounds.center.clone(),
        };
      },
    };
    return () => { apiRef.current = null; };
  }, [camera, controls, apiRef, animTimeRef, bounds]);

  const syncRef = useRef({ cameraSync, followSync });
  syncRef.current = { cameraSync, followSync };

  // 最初の全体視点（near は小さく：体内・回路の中でも壁が欠けない）
  useEffect(() => {
    if (!bounds || !controls) return;
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = Math.min(0.01, bounds.size / 1000);
    cam.far = bounds.size * 100;
    cam.updateProjectionMatrix();
    const { cameraSync: cs, followSync: fs } = syncRef.current;
    if ((cs?.locked || cs?.follow) && fs) {
      camera.position.set(...cs.position);
      controls.target.set(...cs.target);
    } else {
      const d = bounds.size * 1.6;
      camera.position.set(bounds.center.x + d * 0.6, bounds.center.y + d * 0.5, bounds.center.z + d * 0.9);
      controls.target.copy(bounds.center);
    }
    controls.update();
  }, [bounds, controls, camera]);

  // 対象物追従の開始／切り替え／終了
  useEffect(() => {
    if (!controls) return;
    const obj = fid ? objMapRef.current.get(fid) : undefined;
    if (!fid || !fmode || !obj) {
      followRt.current = null;
      applyControls(controls, null);
      return;
    }
    const P = partCenter(obj, new THREE.Vector3());
    const offset = new THREE.Vector3();
    if (fmode === 'center') {
      // 一人称：いま見ている向きのまま、パーツの中心に入る
      offset.copy(camera.getWorldDirection(new THREE.Vector3())).multiplyScalar(-size * 0.003);
    } else {
      // 後方視点：いまの方向を保ちつつ近づく（動き出したら進行方向の真後ろへ）
      offset.copy(camera.position).sub(P);
      if (offset.lengthSq() < 1e-12) offset.set(0, 0.35, 1);
      offset.normalize().multiplyScalar(size * 0.08);
    }
    followRt.current = { mode: fmode, obj, phase: 'enter', offset, prev: P.clone(), p0: P.clone(), t0: performance.now(), vdirDone: fmode === 'center' };
    applyControls(controls, fmode);
  }, [fid, fmode, controls, camera, objMapRef, size, bounds]);

  // ユーザーが自分で見回し始めたら、自動の位置合わせは止める
  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      const f = followRt.current;
      if (!f) return;
      f.vdirDone = true;
      f.phase = 'track';
      partCenter(f.obj, f.prev);
    };
    controls.addEventListener('start', onStart);
    return () => controls.removeEventListener('start', onStart);
  }, [controls]);

  // 「注目！」：updated_at が変わったら全生徒をその視点へ（入室時の既存値は無視）
  useEffect(() => {
    const key = cameraSync?.updated_at ?? null;
    if (lastSync.current === undefined) { lastSync.current = key; return; }
    if (key === lastSync.current) return;
    lastSync.current = key;
    if (!followSync || !cameraSync) return;
    const busy = !!cameraSync.locked || !!cameraSync.follow;
    if (cameraSync.target_id && !busy) return; // 対象物視点への切り替えは RoomClient 側で行う
    anim.current = { pos: new THREE.Vector3(...cameraSync.position), target: new THREE.Vector3(...cameraSync.target) };
  }, [cameraSync, followSync]);

  const streamRef = useRef(onStream);
  streamRef.current = onStream;
  const live = useRef({ p: new THREE.Vector3(), t: new THREE.Vector3() });
  const last = useRef({ time: 0, p: new THREE.Vector3(), t: new THREE.Vector3() });
  const v = useRef({ p: new THREE.Vector3(), g: new THREE.Vector3(), d: new THREE.Vector3() });

  useFrame((_, dt) => {
    if (!controls) return;
    const a = anim.current;
    const following = !!cameraSync?.follow; // 視点共有（先生の動きを真似る）
    if (!following) liveRef.current = null;
    const busy = followSync && (!!cameraSync?.locked || following); // 先生にカメラを預けている生徒
    const f = busy ? null : followRt.current;

    if (f) {
      const { p, g, d } = v.current;
      partCenter(f.obj, p);

      // 後方視点：最初の動きから進行方向を求め、真後ろ（少し上）へ回り込む
      if (f.mode === 'behind' && !f.vdirDone) {
        d.copy(p).sub(f.p0);
        const moved = d.length();
        if (moved > size * 0.004 || (performance.now() - f.t0) / 1000 > 0.8) {
          f.vdirDone = true;
          if (moved > size * 0.001) {
            f.offset.copy(d).normalize().negate().addScaledVector(camera.up, 0.35).normalize().multiplyScalar(size * 0.08);
            f.phase = 'enter';
          }
        }
      }

      if (f.phase === 'enter') {
        g.copy(p).add(f.offset);
        const k = 1 - Math.exp(-dt * 6);
        camera.position.lerp(g, k);
        controls.target.lerp(p, k);
        const eps = size * 0.001;
        if (camera.position.distanceTo(g) < eps && controls.target.distanceTo(p) < eps) { f.phase = 'track'; f.prev.copy(p); }
      } else {
        // パーツの移動量だけ、カメラと注視点を一緒に平行移動（見回しはそのまま）
        d.copy(p).sub(f.prev);
        camera.position.add(d);
        controls.target.add(d);
        f.prev.copy(p);
      }
      controls.update();
    } else if (a) {
      // 「注目！」／全体視点へ戻る：滑らかに移動
      const k = 1 - Math.exp(-dt * 5);
      camera.position.lerp(a.pos, k);
      controls.target.lerp(a.target, k);
      controls.update();
      const eps = size * 0.002;
      if (camera.position.distanceTo(a.pos) < eps && controls.target.distanceTo(a.target) < eps) anim.current = null;
    } else if (followSync && following && liveRef.current) {
      const k = 1 - Math.exp(-dt * 12);
      live.current.p.set(...liveRef.current.position);
      live.current.t.set(...liveRef.current.target);
      camera.position.lerp(live.current.p, k);
      controls.target.lerp(live.current.t, k);
      controls.update();
    }

    if (streaming) {
      const now = performance.now();
      if (now - last.current.time > 80) {
        const eps = size * 0.0005;
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
export default function Viewer3D({
  modelUrl, pins, selectedId, placeMode, onPlace, onSelect, cameraSync, followSync, apiRef, animState, onClips,
  liveCamRef, streaming, onCameraStream, follow, selectedPartId, partsEnabled, onPartSelect, onParts,
}: {
  modelUrl: string; pins: ViewerPin[]; selectedId: string | null; placeMode: boolean;
  onPlace: (p: Vec3, n: Vec3) => void; onSelect: (id: string | null) => void;
  cameraSync: CameraSync | null; followSync: boolean; apiRef: MutableRefObject<ViewerApi | null>;
  animState: AnimState | null; onClips: (c: ClipInfo[]) => void;
  liveCamRef: MutableRefObject<{ position: Vec3; target: Vec3 } | null>;
  streaming: boolean; onCameraStream: (c: { position: Vec3; target: Vec3 }) => void;
  follow: FollowState | null; selectedPartId: string | null; partsEnabled: boolean;
  onPartSelect: (id: string) => void; onParts: (p: PartInfo[]) => void;
}) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [failed, setFailed] = useState(false);
  const animTimeRef = useRef<() => number>(() => 0);
  const objMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const pinRadius = (bounds?.size ?? 1) * 0.012;

  return (
    <div className="relative h-full w-full">
      <Canvas
        className={placeMode ? '!cursor-crosshair' : ''}
        camera={{ fov: 50, position: [3, 2, 4], near: 0.01, far: 1000 }}
        gl={{ logarithmicDepthBuffer: true }} // nearを小さくしても奥行きが崩れにくい
        dpr={[1, 2]}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={['#0f172a']} />
        <hemisphereLight args={['#ffffff', '#64748b', 1.4]} />
        <directionalLight position={[5, 10, 7]} intensity={2} />
        <directionalLight position={[-6, -4, -5]} intensity={0.8} />

        <ModelErrorBoundary onError={() => setFailed(true)}>
          <Suspense fallback={null}>
            <Model
              url={modelUrl}
              placeMode={placeMode}
              partsEnabled={partsEnabled}
              onPlace={onPlace}
              onBounds={setBounds}
              onClips={onClips}
              onParts={onParts}
              onPartSelect={onPartSelect}
              objMapRef={objMapRef}
              anim={animState}
              animTimeRef={animTimeRef}
            />
          </Suspense>
        </ModelErrorBoundary>

        <PartHighlight objMapRef={objMapRef} id={follow ? null : selectedPartId} size={bounds?.size ?? 1} />

        {pins.map((p) => (
          <PinMarker key={p.id} pin={p} radius={pinRadius} selected={p.id === selectedId} onSelect={onSelect} />
        ))}

        <OrbitControls makeDefault enabled={!(followSync && (!!cameraSync?.locked || !!cameraSync?.follow))} enableDamping dampingFactor={0.12} screenSpacePanning />
        <CameraRig
          bounds={bounds}
          cameraSync={cameraSync}
          followSync={followSync}
          apiRef={apiRef}
          animTimeRef={animTimeRef}
          liveRef={liveCamRef}
          streaming={streaming}
          onStream={onCameraStream}
          follow={follow}
          objMapRef={objMapRef}
        />
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
