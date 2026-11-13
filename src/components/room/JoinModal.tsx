'use client';
import { useState } from 'react';
import { GROUPS } from '@/lib/groups';
import { saveIdentity } from '@/lib/identity';
import { uuid } from '@/lib/util';
import type { Identity } from '@/lib/types';

export default function JoinModal({ roomTitle, initial, onJoin, onTeacher }: {
  roomTitle: string; initial: Identity | null; onJoin: (i: Identity) => void; onTeacher: () => void;
}) {
  const [group, setGroup] = useState<string | null>(initial?.group_name ?? null);
  const [name, setName] = useState(initial?.author_name ?? '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const g = GROUPS.find((x) => x.name === group);
    if (!g || !name.trim()) return;
    const nick = name.trim();
    // 班・名前が前回と同じなら同じ author_id（自分のピンを編集できる）。違えば別人として新規発行
    const same = initial && initial.group_name === g.name && initial.author_name === nick;
    const identity: Identity = {
      author_id: same ? initial.author_id : uuid(),
      group_name: g.name,
      group_color: g.color,
      author_name: nick,
    };
    saveIdentity(identity);
    onJoin(identity);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/70 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow-2xl">
        <div>
          <h2 className="text-xl font-bold">{roomTitle}</h2>
          <p className="text-sm text-slate-600">
            {initial ? '前回の班とニックネームです。あなたであれば、そのまま入室できます。' : '班とニックネームを入れて入室しましょう。'}
          </p>
        </div>
        <div>
          <p className="label">班を選ぶ</p>
          <div className="grid grid-cols-4 gap-2">
            {GROUPS.map((g) => (
              <button
                type="button"
                key={g.name}
                onClick={() => setGroup(g.name)}
                aria-pressed={group === g.name}
                className="flex min-h-12 items-center justify-center gap-1 rounded-lg border-2 text-sm font-bold"
                style={{ borderColor: group === g.name ? g.color : '#e2e8f0', background: group === g.name ? `${g.color}22` : '#fff' }}
              >
                <span className="inline-block size-3 rounded-full" style={{ background: g.color }} />
                {g.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="nick">ニックネーム</label>
          <input id="nick" className="input" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} placeholder="例：たろう" />
        </div>
        <button className="btn btn-primary w-full" disabled={!group || !name.trim()}>入室する</button>
        <button type="button" onClick={onTeacher} className="w-full text-center text-sm text-slate-500 underline">先生はこちら</button>
      </form>
    </div>
  );
}
