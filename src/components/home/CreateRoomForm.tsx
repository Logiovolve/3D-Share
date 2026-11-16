'use client';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { uploadFile } from '@/lib/upload';
import { setTeacherAuthed } from '@/lib/identity';
import { errMsg, uuid } from '@/lib/util';
import { imageToGlb, imageToUsdz } from '@/lib/imageModel';

export default function CreateRoomForm() {
  const [title, setTitle] = useState('');
  const [tkey, setTkey] = useState(''); // 教員用リンクに埋め込む入室キー（自動発行）
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'glb' | 'image'>('glb');
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [widthCm, setWidthCm] = useState(30);
  const imgRef = useRef<HTMLInputElement>(null);
  const hasModel = mode === 'glb' ? !!file : !!imgFile;

  useEffect(() => {
    if (!imgFile) return setImgUrl(null);
    const u = URL.createObjectURL(imgFile);
    setImgUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [imgFile]);

  const pickImage = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('画像ファイルを選んでください。');
    setError(null);
    setImgFile(f);
  };

  const downloadUsdz = async () => {
    if (!imgFile) return;
    setBusy(true);
    try {
      const blob = await imageToUsdz(imgFile, widthCm);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'card_model.usdz';
      a.click();
    } catch (e) {
      setError(`USDZを作成できませんでした：${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f?: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.glb')) return setError('.glb ファイルを選んでください。');
    setError(null);
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasModel || !title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const blob = mode === 'image' ? await imageToGlb(imgFile!, widthCm) : file!;
      const glb_url = await uploadFile(`models/${uuid()}.glb`, blob, 'model/gltf-binary');
      // 6桁のルームIDを自動発行（重複したら作り直す）
      const key = uuid();
      let created: { id: string; code: string } | null = null;
      for (let i = 0; i < 5 && !created; i++) {
        const c = String(Math.floor(Math.random() * 900000) + 100000);
        const { data, error: err } = await supabase
          .from('rooms')
          .insert({ title: title.trim(), glb_url, teacher_passcode: key, join_code: c, join_password: pw })
          .select('id')
          .single();
        if (!err) created = { id: data.id, code: c };
        else if (err.code !== '23505') throw err;
      }
      if (!created) throw new Error('ルームIDを発行できませんでした。もう一度お試しください。');
      setTkey(key);
      setTeacherAuthed(created.id); // 作成した端末はそのまま教員として入室できる
      setCode(created.code);
      setRoomId(created.id);
    } catch (e) {
      setError(`ルームを作成できませんでした：${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (roomId) {
    const origin = window.location.origin;
    const studentUrl = `${origin}/room/${roomId}`;
    const teacherUrl = `${studentUrl}?role=teacher&key=${tkey}`;
    return (
      <div className="mt-4 space-y-5">
        <p className="font-bold text-emerald-700">ルームをつくりました。</p>
        <div className="rounded-xl bg-slate-900 p-4 text-white">
          <p className="text-sm text-slate-300">生徒はトップ画面でこの2つを入力して入室します</p>
          <p className="mt-2 text-lg">ルームID　<span className="font-mono text-3xl font-bold tracking-widest">{code}</span></p>
          <p className="text-lg">パスワード　<span className="font-mono text-3xl font-bold tracking-widest">{pw}</span></p>
        </div>
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
            <QRCodeSVG value={studentUrl} size={148} />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <p className="label">生徒用URL（QRコードと同じ）</p>
              <p className="break-all rounded-lg bg-slate-100 p-2 text-sm">{studentUrl}</p>
              <button className="btn mt-2" onClick={() => copy('s', studentUrl)}>{copied === 's' ? 'コピーしました' : 'URLをコピー'}</button>
            </div>
            <p className="text-sm text-slate-600">ルームID：<span className="break-all font-mono">{roomId}</span></p>
          </div>
        </div>
        <div>
          <p className="label">教員用入室リンク（先生だけの入口です。生徒には共有しないでください）</p>
          <p className="break-all rounded-lg bg-slate-100 p-2 text-sm">{teacherUrl}</p>
          <div className="mt-2 flex gap-2">
            <button className="btn" onClick={() => copy('t', teacherUrl)}>{copied === 't' ? 'コピーしました' : 'リンクをコピー'}</button>
            <a className="btn btn-primary" href={teacherUrl}>先生として入室</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div>
        <label className="label" htmlFor="t">授業タイトル</label>
        <input id="t" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：地層の観察の振り返り" required />
      </div>
      <div>
        <p className="label">観察する教材</p>
        <div className="mb-3 grid grid-cols-2 gap-2" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'glb'} className={`btn ${mode === 'glb' ? 'btn-on' : ''}`} onClick={() => setMode('glb')}>3Dモデル（.glb）</button>
          <button type="button" role="tab" aria-selected={mode === 'image'} className={`btn ${mode === 'image' ? 'btn-on' : ''}`} onClick={() => setMode('image')}>写真・画像から作る</button>
        </div>

        {mode === 'glb' ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm ${drag ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
          >
            {file ? <span className="font-bold">{file.name}（{(file.size / 1024 / 1024).toFixed(1)} MB）</span> : 'ここに .glb をドラッグ＆ドロップ、またはクリックして選ぶ'}
            <input ref={inputRef} type="file" accept=".glb,model/gltf-binary" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        ) : (
          <div className="space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pickImage(e.dataTransfer.files[0]); }}
              onClick={() => imgRef.current?.click()}
              className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center text-sm ${drag ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
            >
              {imgUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgUrl} alt="選んだ画像" className="mx-auto max-h-40 rounded-lg" />
              ) : '写真・地図・資料の画像をドラッグ＆ドロップ、またはクリックして選ぶ'}
              <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
            </div>
            <div>
              <div className="flex justify-between text-sm"><label htmlFor="w" className="font-bold">3Dでの幅（ARで置いたときの大きさ）</label><span>{widthCm} cm</span></div>
              <input id="w" type="range" min={10} max={100} step={5} value={widthCm} onChange={(e) => setWidthCm(Number(e.target.value))} className="w-full" />
            </div>
            <button type="button" className="btn w-full" disabled={!imgFile || busy} onClick={downloadUsdz}>iPadのAR用に USDZ でも保存</button>
            <p className="text-xs text-slate-500">画像は板状の3Dモデルになり、ルームではその上にピンを立てて観察できます。</p>
          </div>
        )}
      </div>
      <div>
        <label className="label" htmlFor="jp">生徒用パスワード（数字4桁）</label>
        <input id="jp" className="input" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={pw} onChange={(e) => setPw(e.target.value.replace(/\D/g, ''))} placeholder="例：1234" required />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy || !hasModel || !title.trim() || pw.length !== 4}>
        {busy ? 'アップロード中…' : 'ルームをつくる'}
      </button>
    </form>
  );
}
