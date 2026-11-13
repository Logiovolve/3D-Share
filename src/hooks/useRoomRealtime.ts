'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Pin, Room } from '@/lib/types';
import { uuid } from '@/lib/util';

export type RoomStatus = 'loading' | 'ready' | 'notfound' | 'error';

const POLL_MS = 3000; // Realtimeが届かない環境向けの保険（通常はRealtimeで即時反映）

export function useRoomRealtime(roomId: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [status, setStatus] = useState<RoomStatus>('loading');

  const upsertPin = useCallback((pin: Pin) => {
    setPins((prev) => (prev.some((p) => p.id === pin.id) ? prev.map((p) => (p.id === pin.id ? pin : p)) : [...prev, pin]));
  }, []);
  const removePin = useCallback((id: string) => setPins((prev) => prev.filter((p) => p.id !== id)), []);
  const removeAllPins = useCallback(() => setPins([]), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [r, p] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('pins').select('*').eq('room_id', roomId).order('created_at', { ascending: true }),
      ]);
      if (cancelled) return;
      if (r.error || p.error) return setStatus((s) => (s === 'ready' ? s : 'error'));
      if (!r.data) return setStatus('notfound');
      // 内容が変わったときだけ更新（無駄な再描画を避ける）
      setRoom((prev) => (JSON.stringify(prev) === JSON.stringify(r.data) ? prev : (r.data as Room)));
      setPins((prev) => (JSON.stringify(prev) === JSON.stringify(p.data) ? prev : (p.data as Pin[])));
      setStatus('ready');
    };

    // 開発モード(StrictMode)の二重実行で同名チャンネルが再利用されないよう、毎回ユニークな名前にする
    const channel = supabase
      .channel(`room:${roomId}:${uuid()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) =>
        setRoom(payload.new as Room),
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pins', filter: `room_id=eq.${roomId}` }, (payload) =>
        upsertPin(payload.new as Pin),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pins', filter: `room_id=eq.${roomId}` }, (payload) =>
        upsertPin(payload.new as Pin),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pins' }, (payload) => {
        const id = (payload.old as { id?: string }).id;
        if (id) removePin(id);
      })
      .subscribe((s, err) => {
        console.info('[realtime]', s, err ?? '');
        if (s === 'SUBSCRIBED') void load();
      });

    void load(); // Realtimeの接続を待たず、まず初期表示
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [roomId, upsertPin, removePin]);

  return { room, pins, status, setRoom, upsertPin, removePin, removeAllPins };
}
