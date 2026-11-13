import { supabase, BUCKET } from './supabase';

export async function uploadFile(path: string, file: Blob, contentType?: string): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** タブレットで撮影した大きな写真を長辺1280pxのJPEGに縮小（失敗時は元ファイル） */
export async function prepareImage(
  file: File,
  max = 1280,
): Promise<{ blob: Blob; ext: string; type: string }> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    if (blob) return { blob, ext: 'jpg', type: 'image/jpeg' };
  } catch {
    /* fallthrough */
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  return { blob: file, ext, type: file.type || 'image/jpeg' };
}
