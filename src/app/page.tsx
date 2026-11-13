import CreateRoomForm from '@/components/home/CreateRoomForm';
import JoinRoomForm from '@/components/home/JoinRoomForm';

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold md:text-4xl">3D観察ルーム</h1>
      <p className="mt-2 max-w-prose text-slate-600">
        先生が用意した3Dモデルを、クラス全員で同時に観察。気づいた場所にピンを立てて、メモや写真を共有します。
      </p>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">先生：ルームをつくる</h2>
          <CreateRoomForm />
        </section>
        <section className="h-fit rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">生徒：ルームに入る</h2>
          <JoinRoomForm />
        </section>
      </div>
    </main>
  );
}
