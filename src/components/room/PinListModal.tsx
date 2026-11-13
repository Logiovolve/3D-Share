'use client';
import type { Pin } from '@/lib/types';
import { downloadCsv, pinsToCsv } from '@/lib/csv';
import { formatDateTime } from '@/lib/util';

export default function PinListModal({ pins, numbers, roomTitle, onSelect, onDeleteAll, onClose }: {
  pins: Pin[]; numbers: Map<string, number>; roomTitle: string;
  onSelect: (id: string) => void; onDeleteAll: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/70 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
          <h2 className="flex-1 text-lg font-bold">発見リスト（{pins.length}件）</h2>
          <button className="btn" disabled={!pins.length} onClick={() => downloadCsv(`${roomTitle}_発見リスト.csv`, pinsToCsv(pins))}>CSVをダウンロード</button>
          <button className="btn btn-danger" disabled={!pins.length} onClick={onDeleteAll}>全ピンを削除</button>
          <button className="btn" onClick={onClose}>閉じる</button>
        </div>
        <div className="overflow-auto p-4">
          {pins.length === 0 ? (
            <p className="py-10 text-center text-slate-500">まだピンがありません。</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-slate-500">
                <tr><th className="p-2">#</th><th className="p-2">班</th><th className="p-2">ニックネーム</th><th className="p-2">見出し</th><th className="p-2">観察メモ</th><th className="p-2">画像</th><th className="p-2">作成日時</th></tr>
              </thead>
              <tbody>
                {pins.map((p) => (
                  <tr key={p.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => onSelect(p.id)}>
                    <td className="p-2 font-bold">{numbers.get(p.id)}</td>
                    <td className="p-2"><span className="font-bold" style={{ color: p.group_color }}>{p.group_name}</span></td>
                    <td className="p-2">{p.author_name}</td>
                    <td className="p-2 font-bold">{p.title}</td>
                    <td className="max-w-xs truncate p-2">{p.description}</td>
                    <td className="p-2">{p.image_url ? 'あり' : '—'}</td>
                    <td className="whitespace-nowrap p-2">{formatDateTime(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
