import * as THREE from 'three';

/** 写真を長辺 max px に縮小（大きすぎるGLB/USDZを避ける） */
export async function loadResized(file: File, max = 2048): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * s));
  c.height = Math.max(1, Math.round(bmp.height * s));
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

/** 画像の縦横比そのままの平面（1.0 = 1m。幅は cm 指定） */
export function buildPlane(canvas: HTMLCanvasElement, widthCm: number, unlit: boolean): THREE.Mesh {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const w = widthCm / 100;
  const h = (w * canvas.height) / canvas.width;
  const material = unlit
    ? new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }) // 写真の色をそのまま見せる（光の影響なし）
    : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }); // USDZ互換性重視
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  mesh.name = 'image-card';
  mesh.updateMatrixWorld(true);
  return mesh;
}

/** 観察ルーム用の .glb を作る */
export async function imageToGlb(file: File, widthCm: number): Promise<Blob> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const mesh = buildPlane(await loadResized(file), widthCm, true);
  const out = await new GLTFExporter().parseAsync(mesh, { binary: true });
  return new Blob([out as ArrayBuffer], { type: 'model/gltf-binary' });
}

/** iPadのAR表示（Quick Look）用の .usdz を作る */
export async function imageToUsdz(file: File, widthCm: number): Promise<Blob> {
  const { USDZExporter } = await import('three/examples/jsm/exporters/USDZExporter.js');
  const mesh = buildPlane(await loadResized(file), widthCm, false);
  const data = await new USDZExporter().parseAsync(mesh);
  return new Blob([data as unknown as BlobPart], { type: 'model/vnd.usdz+zip' });
}
