'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildPlane, imageToGlb, imageToUsdz, loadResized } from '@/lib/imageModel';
import { errMsg } from '@/lib/util';

type Stage = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; mesh: THREE.Mesh | null };

function placeholder(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 24;
  ctx.strokeRect(64, 64, 896, 896);
  ctx.beginPath();
  ctx.arc(512, 512, 200, 0, Math.PI * 2);
  ctx.stroke();
  return c;
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function ImageToUsdzTool() {
  const mountRef = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [widthCm, setWidthCm] = useState(30);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 3Dプレビューの土台
  useEffect(() => {
    const el = mountRef.current!;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
    camera.position.set(0, 0, 0.8);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.AmbientLight(0xffffff, 2.5));

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    stage.current = { scene, camera, controls, mesh: null };

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      stage.current = null;
    };
  }, []);

  // 画像・幅が変わったら板を作り直す
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const canvas = imgFile ? await loadResized(imgFile, 2048) : placeholder();
        const st = stage.current;
        if (cancelled || !st) return;
        if (st.mesh) {
          st.scene.remove(st.mesh);
          st.mesh.geometry.dispose();
          const m = st.mesh.material as THREE.MeshStandardMaterial;
          m.map?.dispose();
          m.dispose();
        }
        const mesh = buildPlane(canvas, widthCm, false);
        st.mesh = mesh;
        st.scene.add(mesh);
        st.camera.position.set(0, 0, (widthCm / 100) * 2);
        st.controls.target.set(0, 0, 0);
        st.controls.update();
      } catch (e) {
        setError(`画像を読み込めませんでした：${errMsg(e)}`);
      }
    })();
    return () => { cancelled = true; };
  }, [imgFile, widthCm]);

  const pick = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('画像ファイルを選んでください。');
    setError(null);
    setImgFile(f);
  };

  const baseName = imgFile ? imgFile.name.replace(/\.[^.]+$/, '') : 'card_model';
  const run = async (kind: 'usdz' | 'glb') => {
    if (!imgFile) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === 'usdz') save(await imageToUsdz(imgFile, widthCm), `${baseName}.usdz`);
      else save(await imageToGlb(imgFile, widthCm), `${baseName}.glb`);
    } catch (e) {
      setError(`変換できませんでした：${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[22rem_minmax(0,1fr)] md:grid-rows-1">
      <div className="max-h-[50dvh] space-y-5 overflow-y-auto border-b border-slate-200 bg-white p-4 md:max-h-none md:border-b-0 md:border-r">
        <div>
          <p className="label">1. 画像を選ぶ</p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm ${drag ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
          >
            {imgFile ? <span className="font-bold">{imgFile.name}</span> : '画像をドロップ、またはクリックして選ぶ'}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm">
            <label htmlFor="w" className="label !mb-0">2. ARで置くときの幅</label>
            <span className="font-bold">{widthCm} cm</span>
          </div>
          <input id="w" type="range" min={10} max={100} step={5} value={widthCm} onChange={(e) => setWidthCm(Number(e.target.value))} className="mt-2 w-full" />
        </div>

        <div className="space-y-2">
          <p className="label !mb-0">3. 保存する</p>
          <button className="btn btn-primary w-full" disabled={!imgFile || busy} onClick={() => run('usdz')}>{busy ? '変換中…' : 'USDZ で保存（iPadのAR用）'}</button>
          <button className="btn w-full" disabled={!imgFile || busy} onClick={() => run('glb')}>GLB で保存（観察ルーム用）</button>
          {!imgFile && <p className="text-xs text-slate-500">画像を選ぶと保存できます。</p>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <p className="text-xs leading-relaxed text-slate-500">
          USDZ は iPad の「ファイル」アプリや Safari で開くと、ARで机の上に置いて見られます。
          GLB は、観察ルームの「写真・画像から作る」でも同じものが作れます。
        </p>
      </div>

      <div className="relative min-h-[40dvh] bg-slate-900 md:min-h-0">
        <div ref={mountRef} className="absolute inset-0 [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full" />
        <p className="pointer-events-none absolute right-3 top-3 rounded-md bg-slate-900/80 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700">ドラッグで回転 / ズーム</p>
      </div>
    </div>
  );
}
