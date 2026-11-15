'use client';
import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Vec3 } from '@/lib/types';

export type LiveCamera = { position: Vec3; target: Vec3 };

/** 先生のカメラ移動を、DBを通さず(Broadcast)全員へ高速配信する。同じルームの全員が同じ topic を使う */
export function useCameraChannel(roomId: string, onReceive: (c: LiveCamera) => void) {
  const chRef = useRef<RealtimeChannel | null>(null);
  const cbRef = useRef(onReceive);
  cbRef.current = onReceive;

  useEffect(() => {
    let cancelled = false;
    let ch: RealtimeChannel | null = null;
    (async () => {
      // 開発モードの二重実行などで同名チャンネルが残っていたら先に片付ける
      for (const c of supabase.getChannels()) {
        if (c.topic === `realtime:cam:${roomId}`) await supabase.removeChannel(c);
      }
      if (cancelled) return;
      ch = supabase.channel(`cam:${roomId}`, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'cam' }, ({ payload }) => cbRef.current(payload as LiveCamera)).subscribe();
      chRef.current = ch;
    })();
    return () => {
      cancelled = true;
      chRef.current = null;
      if (ch) void supabase.removeChannel(ch);
    };
  }, [roomId]);

  return useCallback((c: LiveCamera) => {
    void chRef.current?.send({ type: 'broadcast', event: 'cam', payload: c });
  }, []);
}
