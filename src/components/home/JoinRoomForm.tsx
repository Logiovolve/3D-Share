'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { errMsg } from '@/lib/util';

export default function JoinRoomForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.from('rooms').select('id, join_password').eq('join_code', code).maybeSingle();
      if (err) throw err;
      if (!data || data.join_password !== pw) return setError('ルームIDかパスワードが違います。もう一度たしかめてください。');
      router.push(`/room/${data.id}`);
    } catch (e) {
      setError(`入室できませんでした：${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      <div>
        <label className="label" htmlFor="code">ルームID（数字6桁）</label>
        <input id="code" className="input font-mono text-xl tracking-widest" inputMode="numeric" autoComplete="off" value={code} onChange={(e) => setCode(digits(e.target.value, 6))} placeholder="123456" />
      </div>
      <div>
        <label className="label" htmlFor="jpw">パスワード（数字4桁）</label>
        <input id="jpw" className="input font-mono text-xl tracking-widest" inputMode="numeric" autoComplete="off" value={pw} onChange={(e) => setPw(digits(e.target.value, 4))} placeholder="1234" />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy || code.length !== 6 || pw.length !== 4}>{busy ? '確認中…' : '入室する'}</button>
    </form>
  );
}
