'use client';
import { useState } from 'react';

export default function TeacherAuthModal({ onSubmit, onCancel }: { onSubmit: (passcode: string) => boolean; onCancel: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/70 p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); setError(!onSubmit(value)); }}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
      >
        <h2 className="text-xl font-bold">先生として入室</h2>
        <div>
          <label className="label" htmlFor="pc">管理パスコード</label>
          <input id="pc" type="password" autoFocus className="input" value={value} onChange={(e) => setValue(e.target.value)} />
          {error && <p role="alert" className="mt-1 text-sm text-red-700">パスコードが違います。</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={onCancel}>戻る</button>
          <button className="btn btn-primary flex-1" disabled={!value}>入室する</button>
        </div>
      </form>
    </div>
  );
}
