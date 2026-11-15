'use client';
import type { Pin } from '@/lib/types';
import { formatDateTime } from '@/lib/util';

export default function PinDetailPanel({ pin, number, showAuthor, offsetTop, canEdit, canDelete, onEdit, onDelete, onClose }: {
  pin: Pin; number: number; showAuthor: boolean; offsetTop?: boolean; canEdit: boolean; canDelete: boolean;
  onEdit: () => void; onDelete: () => void; onClose: () => void;
}) {
  return (
    <aside
      aria-label="ピンの詳細"
      className={`fixed inset-x-0 bottom-0 z-30 max-h-[55dvh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:inset-x-auto md:bottom-auto md:right-0 md:top-0 md:h-full md:max-h-none md:w-96 md:rounded-none ${offsetTop ? 'md:pt-24' : ''}`}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: showAuthor ? pin.group_color : '#475569' }}>
          {number}
        </span>
        <h2 className="flex-1 text-lg font-bold leading-snug">{pin.title}</h2>
        <button className="btn !min-h-9 !px-3" onClick={onClose} aria-label="閉じる">✕</button>
      </div>

      {showAuthor && (
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-bold" style={{ color: pin.group_color }}>{pin.group_name}</span>　{pin.author_name}
        </p>
      )}
      <p className="text-xs text-slate-500">{formatDateTime(pin.created_at)}</p>

      {pin.description && <p className="mt-4 whitespace-pre-wrap leading-relaxed">{pin.description}</p>}
      {pin.image_url && (
        <a href={pin.image_url} target="_blank" rel="noreferrer" className="mt-4 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pin.image_url} alt={`${pin.title}の添付画像`} className="w-full rounded-lg" />
        </a>
      )}

      {(canEdit || canDelete) && (
        <div className="mt-5 flex gap-2">
          {canEdit && <button className="btn flex-1" onClick={onEdit}>編集</button>}
          {canDelete && <button className="btn btn-danger flex-1" onClick={onDelete}>削除</button>}
        </div>
      )}
    </aside>
  );
}
