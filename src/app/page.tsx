import Link from 'next/link';

const ITEMS = [
  {
    href: '/observe',
    no: '01',
    title: '3D観察ルーム',
    desc: '先生の3Dモデルをクラス全員で同時に観察。気づいた場所にピンを立てて、メモや写真を共有します。',
    tag: '授業で使う',
    color: '#1f2a44',
    icon: (
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3 6.6 3.7L12 11.7 5.4 8 12 4.3ZM5 9.7l6 3.4v6.6l-6-3.4V9.7Zm8 10v-6.6l6-3.4v6.6l-6 3.4Z" />
    ),
  },
  {
    href: '/tools/image-to-usdz',
    no: '02',
    title: '画像 → USDZ（3Dの板）',
    desc: '写真・地図・資料を3Dの板にして、iPadのARで机の上に置いて見られる USDZ に変換します。GLBでも保存できます。',
    tag: '変換ツール',
    color: '#0b7bc4',
    icon: (
      <path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm9-.5V10h5.5L13 4.5ZM7 18l3-4 2 2.5 2.5-3.5 3 5H7Z" />
    ),
  },
  {
    href: '/tools/usdz-to-glb',
    no: '03',
    title: 'USDZ → GLB コンバーター',
    desc: 'iPhone・iPadの3Dスキャンなど USDZ を GLB に変換。アニメーションの確認もできます。変換したファイルは観察ルームの教材に使えます。',
    tag: '変換ツール',
    color: '#0f766e',
    icon: (
      <path d="M7 7h9.2l-2.1-2.1L15.5 3.5 20.5 8.5l-5 5-1.4-1.4L16.2 10H7V7Zm10 10H7.8l2.1 2.1-1.4 1.4-5-5 5-5 1.4 1.4L7.8 14H17v3Z" />
    ),
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center px-4 py-12">
      <p className="text-sm font-bold tracking-widest text-slate-500">3D EDUCATION TOOLS</p>
      <h1 className="mt-2 text-4xl font-bold md:text-5xl">3D教材ラボ</h1>
      <p className="mt-3 max-w-prose text-slate-600">
        3Dの教材をつくって、みんなで観察する。やりたいことを選んでください。
      </p>

      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {ITEMS.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="group flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-3 focus-visible:outline-blue-400"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl text-white" style={{ background: it.color }}>
                  <svg viewBox="0 0 24 24" className="size-7 fill-current" aria-hidden>{it.icon}</svg>
                </span>
                <span className="font-mono text-sm text-slate-400">{it.no}</span>
              </div>
              <h2 className="mt-5 text-xl font-bold leading-snug">{it.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{it.desc}</p>
              <div className="mt-5 flex items-center justify-between text-sm font-bold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">{it.tag}</span>
                <span style={{ color: it.color }} className="transition group-hover:translate-x-1">ひらく →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-slate-500">
        ヒント：③で変換した GLB は、①の観察ルームを作るときにそのまま選べます。
      </p>
    </main>
  );
}
