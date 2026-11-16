'use client';
import { useMemo, useState } from 'react';
import type { FollowMode, FollowState, PartInfo } from '@/lib/types';

const MODES: { mode: FollowMode; title: string; note: string }[] = [
  { mode: 'center', title: '① 対象物の中心（一人称視点）', note: 'パーツの中に入って、一緒に動きます。' },
  { mode: 'behind', title: '② 少し後ろから追従（後方視点）', note: '進む向きの後ろから、前後の様子を見渡せます。' },
];

export default function PartPanel({ parts, selectedId, follow, mode, blockedReason, isTeacher, onSelect, onEnter, onExit, onMode }: {
  parts: PartInfo[]; selectedId: string | null; follow: FollowState | null; mode: FollowMode;
  blockedReason: 'lock' | 'busy' | null; isTeacher: boolean;
  onSelect: (id: string) => void; onEnter: () => void; onExit: () => void; onMode: (m: FollowMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? parts.filter((p) => p.name.toLowerCase().includes(s)) : parts;
  }, [parts, q]);

  if (parts.length === 0) return null;
  const sel = selectedId ? byId.get(selectedId) : undefined;
  const cur = follow ? byId.get(follow.id) : undefined;

  // 先生がロック中／カメラを先生に預けている間は、選択も切り替えもできない（一覧・ボタンは出さない）
  if (blockedReason) {
    return (
      <div role="status" className="rounded-full bg-white/95 px-3 py-2 text-xs font-bold text-slate-600 shadow ring-1 ring-slate-200">
        {follow && cur ? `「${cur.name}」の視点（先生が固定中）` : blockedReason === 'lock' ? 'パーツ視点：先生がロック中' : 'パーツ視点：先生の視点に合わせています'}
      </div>
    );
  }

  return (
    <section className="w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-slate-200 backdrop-blur">
      {follow && (
        <button className="btn btn-primary mb-2 w-full" onClick={onExit}>全体視点に戻る</button>
      )}
      <button className="flex w-full items-center justify-between text-left font-bold" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>パーツ視点{follow && cur ? `：${cur.name}` : ''}</span>
        <span aria-hidden>{open ? '−' : '＋'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="label">追従のしかた</p>
            <div className="grid gap-2" role="group" aria-label="追従のしかた">
              {MODES.map((m) => (
                <button key={m.mode} className={`btn !items-start !justify-start !text-left ${mode === m.mode ? 'btn-on' : ''}`} aria-pressed={mode === m.mode} onClick={() => onMode(m.mode)}>
                  <span className="flex flex-col">
                    <span className="text-sm">{m.title}</span>
                    <span className="text-[11px] font-normal opacity-80">{m.note}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm">
              選んだパーツ：<span className="font-bold">{sel ? sel.name : 'まだ選んでいません'}</span>
            </p>
            <p className="text-xs text-slate-500">モデルをタップ、または下の一覧から選びます。</p>
            <button className="btn btn-primary mt-2 w-full" disabled={!sel} onClick={onEnter}>この視点になる</button>
            {isTeacher && <p className="mt-1 text-xs text-slate-500">この状態で「注目！」を押すと、全員が同じパーツ・同じ追従のしかたになります。</p>}
          </div>

          <div>
            <label className="sr-only" htmlFor="pq">パーツを検索</label>
            <input id="pq" className="input !py-1.5 !text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`パーツを検索（${parts.length}個）`} />
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {filtered.slice(0, 200).map((p) => (
                <li key={p.id}>
                  <button
                    className={`flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-sm ${p.id === selectedId ? 'border-cyan-500 bg-cyan-50 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                    onClick={() => onSelect(p.id)}
                    aria-pressed={p.id === selectedId}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="ml-2 shrink-0 text-[10px] text-slate-500">{follow?.id === p.id ? '追従中' : p.kind === 'mesh' ? 'メッシュ' : 'Empty'}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="p-2 text-sm text-slate-500">見つかりません。</li>}
              {filtered.length > 200 && <li className="p-1 text-center text-xs text-slate-500">先頭200件を表示。検索で絞り込めます。</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
