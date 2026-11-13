import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }, // 生徒・教員ともSupabase Authは使わない
  realtime: { params: { eventsPerSecond: 10 } },
});

export const BUCKET = 'classroom-assets';
