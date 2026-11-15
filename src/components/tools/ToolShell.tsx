import Link from 'next/link';

export default function ToolShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Link href="/" className="btn !min-h-9 !px-3">← ホーム</Link>
        <h1 className="text-base font-bold">{title}</h1>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
