'use client';
import { useEffect, useState } from 'react';
import type { Pin } from '@/lib/types';

export type PinFormValues = { title: string; description: string; file: File | null; removeImage: boolean };

export default function PinFormModal({ initial, busy, error, onSubmit, onCancel }: {
  initial?: Pin; busy: boolean; error: string | null; onSubmit: (v: PinFormValues) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const existing = !removeImage && !file ? initial?.image_url : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/70 p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (title.trim()) onSubmit({ title: title.trim(), description: description.trim(), file, removeImage }); }}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-xl font-bold">{initial ? 'ピンを編集' : '気づきを書く'}</h2>
        <div>
          <label className="label" htmlFor="pt">見出し（必須）</label>
          <input id="pt" className="input" autoFocus maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：色がちがう層がある" />
        </div>
        <div>
          <label className="label" htmlFor="pd">観察メモ</label>
          <textarea id="pd" className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="見つけたこと、考えたこと" />
        </div>
        <div>
          <p className="label">画像（任意）</p>
          {(preview || existing) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview ?? existing!} alt="添付画像のプレビュー" className="mb-2 max-h-40 rounded-lg" />
          )}
          <div className="flex flex-wrap gap-2">
            <label className="btn cursor-pointer">
              写真を撮る
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveImage(false); }} />
            </label>
            <label className="btn cursor-pointer">
              ファイルを選ぶ
              <input type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveImage(false); }} />
            </label>
            {(file || existing) && (
              <button type="button" className="btn btn-danger" onClick={() => { setFile(null); setRemoveImage(true); }}>画像を外す</button>
            )}
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={onCancel} disabled={busy}>キャンセル</button>
          <button className="btn btn-primary flex-1" disabled={busy || !title.trim()}>{busy ? '保存中…' : initial ? '変更を保存' : 'ピンを立てる'}</button>
        </div>
      </form>
    </div>
  );
}
