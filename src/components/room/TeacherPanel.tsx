'use client';
import { useState } from 'react';
import { GROUPS } from '@/lib/groups';
import type { AnimState, DisplayMode, Room } from '@/lib/types';

export default function TeacherPanel({ room, pinCount, groupFilter, clips, camLocked, onFilter, onMode, onLock, onSync, onCamLock, onOpenList, onAnim }: {
  room: Room; pinCount: number; groupFilter: string; clips: { name: string; duration: number }[]; camLocked: boolean;
  onFilter: (g: string) => void; onMode: (m: DisplayMode) => void; onLock: (v: boolean) => void;
  onSync: () => void; onCamLock: () => void; onOpenList: () => void; onAnim: (patch: Partial<AnimState>) => void;
}) {
  const [open, setOpen] = useState(true);
  const anim = room.anim_state;
  const loop = anim?.loop !== false;

  return (
    <section className="fixed left-3 top-16 z-20 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl bg-white/95 p-3 shadow-xl ring-1 ring-slate-200 backdrop-blur">
      <button className="flex w-full items-center justify-between font-bold" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        教員コントロール <span aria-hidden>{open ? '−' : '＋'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-4">
          <div>
            <p className="label">ピンの見せ方</p>
            <div className="grid grid-cols-2 gap-2">
              <button className={`btn ${room.display_mode === 'anonymous' ? 'btn-on' : ''}`} onClick={() => onMode('anonymous')}>匿名</button>
              <button className={`btn ${room.display_mode === 'group' ? 'btn-on' : ''}`} onClick={() => onMode('group')}>班別カラー</button>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="gf">表示する班</label>
            <select id="gf" className="input" value={groupFilter} onChange={(e) => onFilter(e.target.value)}>
              <option value="all">全員分を表示</option>
              {GROUPS.map((g) => <option key={g.name} value={g.name}>{g.name}のみ</option>)}
            </select>
          </div>
          <button className={`btn w-full ${room.is_locked ? 'btn-on' : ''}`} onClick={() => onLock(!room.is_locked)} aria-pressed={room.is_locked}>
            {room.is_locked ? '投稿ロック中（タップで解除）' : '投稿をロックする'}
          </button>

          <div className="space-y-2 rounded-xl bg-slate-50 p-2">
            <p className="label !mb-0">生徒の視点</p>
            <button className="btn btn-primary w-full" onClick={onSync}>注目！ 視点をそろえる</button>
            <button className={`btn w-full ${camLocked ? 'btn-on' : ''}`} onClick={onCamLock} aria-pressed={camLocked}>
              {camLocked ? '視点ロック中（タップで解除）' : 'そろえて視点をロック'}
            </button>
          </div>

          {clips.length > 0 && (
            <div className="space-y-2 rounded-xl bg-slate-50 p-2">
              <p className="label !mb-0">アニメーション（{clips.length}個を同時に再生・全員の画面で動きます）</p>
              <div className="grid grid-cols-2 gap-2">
                <button className={`btn ${anim?.playing ? 'btn-on' : ''}`} onClick={() => onAnim({ playing: !anim?.playing })}>{anim?.playing ? '一時停止' : '再生'}</button>
                <button className="btn" onClick={() => onAnim({ time: 0, playing: true })}>最初から</button>
              </div>
              <button className={`btn w-full ${loop ? 'btn-on' : ''}`} onClick={() => onAnim({ loop: !loop })} aria-pressed={loop}>
                ループ：{loop ? 'ON' : 'OFF（1回だけ）'}
              </button>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="再生速度">
                {[0.5, 1, 2].map((s) => (
                  <button key={s} className={`btn !px-2 ${(anim?.speed ?? 1) === s ? 'btn-on' : ''}`} onClick={() => onAnim({ speed: s })}>×{s}</button>
                ))}
              </div>
            </div>
          )}

          <button className="btn w-full" onClick={onOpenList}>発見リスト（{pinCount}件）</button>
        </div>
      )}
    </section>
  );
}
