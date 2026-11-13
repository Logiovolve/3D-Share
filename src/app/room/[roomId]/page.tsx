import { Suspense } from 'react';
import RoomClient from '@/components/room/RoomClient';

async function RoomLoader({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomClient roomId={roomId} />;
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  return (
    <Suspense fallback={<div className="grid h-dvh place-items-center text-slate-600">読み込み中…</div>}>
      <RoomLoader params={params} />
    </Suspense>
  );
}
