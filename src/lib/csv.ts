import type { Pin } from './types';
import { formatDateTime } from './util';

const esc = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;

export function pinsToCsv(pins: Pin[]): string {
  const header = ['班名', 'ニックネーム', '見出し', '観察メモ', '画像URL', '作成日時'].map(esc).join(',');
  const rows = pins.map((p) =>
    [p.group_name, p.author_name, p.title, p.description, p.image_url, formatDateTime(p.created_at)]
      .map(esc)
      .join(','),
  );
  return '\uFEFF' + [header, ...rows].join('\r\n'); // BOM付き（Excelの文字化け防止）
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
