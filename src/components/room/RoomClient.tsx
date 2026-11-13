'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRoomRealtime } from '@/hooks/useRoomRealtime';
import { ANON_COLOR } from '@/lib/groups';
import { isTeacherAuthed, loadIdentity, setTeacherAuthed } from '@/lib/identity';
import { prepareImage, uploadFile } from '@/lib/upload';
import { errMsg, uuid } from '@/lib/util';
import type { AnimState, Identity, Pin, Room, Vec3 } from '@/lib/types';
import type { ClipInfo, ViewerApi, ViewerPin } from './Viewer3D';
import JoinModal from './JoinModal';
import TeacherAuthModal from './TeacherAuthModal';
import PinFormModal, { type PinFormValues } from './PinFormModal';
import PinDetailPanel from './PinDetailPanel';
import TeacherPanel from './TeacherPanel';
import PinListModal from './PinListModal';

const Viewer3D = dynamic(() => import('./Viewer3D'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-slate-300">3Dビューアーを準備しています…</div>,
});

type FormState = { mode: 'create'; pos: Vec3; norm: Vec3 } | { mode: 'edit'; pin: Pin } | null;

export default function RoomClient({ roomId }: { roomId: string }) {
  const { room, pins, status, setRoom, upsertPin, removePin, removeAllPins } = useRoomRealtime(roomId);

  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [saved, setSaved] = useState<Identity | null>(null); // 入室モーダルの初期値（前回の班・名前）
  const [isTeacher, setIsTeacher] = useState(false);
  const [askTeacher, setAskTeacher] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const [groupFilter, setGroupFilter] = useState('all');
  const [listOpen, setListOpen] = useState(false);
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const apiRef = useRef<ViewerApi | null>(null);

  // 入室状態の復元（localStorage はクライアントのみ）
  useEffect(() => {
    const wantsTeacher = new URLSearchParams(window.location.search).get('role') === 'teacher';
    if (wantsTeacher) {
      if (isTeacherAuthed(roomId)) setIsTeacher(true);
      else setAskTeacher(true);
    } else {
      setSaved(loadIdentity());
    }
    setReady(true);
  }, [roomId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const numbers = useMemo(() => {
    const m = new Map<string, number>();
    [...pins].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((p, i) => m.set(p.id, i + 1));
    return m;
  }, [pins]);

  const visiblePins = useMemo(() => (groupFilter === 'all' ? pins : pins.filter((p) => p.group_name === groupFilter)), [pins, groupFilter]);

  const anonymous = room?.display_mode === 'anonymous';
  const viewerPins: ViewerPin[] = useMemo(
    () => visiblePins.map((p) => ({
      id: p.id,
      position: [p.pos_x, p.pos_y, p.pos_z],
      normal: [p.norm_x, p.norm_y, p.norm_z],
      color: anonymous ? ANON_COLOR : p.group_color,
      number: numbers.get(p.id) ?? 0,
    })),
    [visiblePins, numbers, anonymous],
  );

  if (status === 'loading' || !ready) {
    return <div className="grid h-dvh place-items-center text-slate-600">読み込み中…</div>;
  }
  if (status !== 'ready' || !room) {
    return (
      <div className="grid h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-bold">{status === 'notfound' ? 'ルームが見つかりません。' : 'ルームを読み込めませんでした。'}</p>
          <p className="mt-1 text-sm text-slate-600">URLを確かめるか、少し待ってからもう一度ひらいてください。</p>
          <Link href="/" className="btn btn-primary mt-4">トップへ戻る</Link>
        </div>
      </div>
    );
  }

  const locked = room.is_locked && !isTeacher;
  const canPlace = !isTeacher && !!identity && !locked;
  const selectedPin = visiblePins.find((p) => p.id === selectedId) ?? null;

  /* ---------- 操作 ---------- */
  const updateRoom = async (patch: Partial<Pick<Room, 'display_mode' | 'is_locked' | 'camera_sync' | 'anim_state'>>) => {
    setRoom((r) => (r ? { ...r, ...patch } : r));
    const { error } = await supabase.from('rooms').update(patch).eq('id', roomId);
    if (error) showToast(`設定を保存できませんでした：${errMsg(error)}`);
  };

  // 注目！：全員の視点を先生の視点にそろえる（ロック状態は維持）
  const syncCamera = (opts?: { lock?: boolean }) => {
    const cam = apiRef.current?.getCamera();
    if (!cam) return showToast('カメラの準備ができていません。');
    const locked = opts?.lock ?? room.camera_sync?.locked ?? false;
    void updateRoom({ camera_sync: { ...cam, locked, updated_at: new Date().toISOString() } });
    showToast(locked ? '全員の視点をそろえて、ロックしました。' : '全員の視点をそろえました。');
  };

  // 視点ロック：ONで先生の視点にそろえて固定／OFFで固定だけ解除（画面は動かない）
  const toggleCamLock = () => {
    const cur = room.camera_sync;
    if (cur?.locked) {
      void updateRoom({ camera_sync: { ...cur, locked: false } });
      showToast('視点のロックを解除しました。');
    } else {
      syncCamera({ lock: true });
    }
  };

  // アニメーション操作：現在位置を引き継いで、全員へ配信（rev が変わると各端末でやり直す）
  const sendAnim = (patch: Partial<AnimState>) => {
    if (!clips.length) return;
    const cur: AnimState = room.anim_state ?? { playing: false, time: 0, speed: 1, loop: true, rev: 0 };
    const time = apiRef.current?.getAnimTime() ?? cur.time;
    const next: AnimState = { ...cur, time, ...patch, rev: cur.rev + 1 };
    // ループOFFで最後まで再生済みのとき、再生を押したら最初からやり直す
    const maxDur = Math.max(0, ...clips.map((c) => c.duration));
    if (patch.playing && next.loop === false && next.time >= maxDur - 0.02) next.time = 0;
    void updateRoom({ anim_state: next });
  };

  const handlePlace = (pos: Vec3, norm: Vec3) => {
    if (isTeacher) return;
    if (locked) return showToast('現在、先生のお話タイム中です。');
    setPlaceMode(false);
    setFormError(null);
    setForm({ mode: 'create', pos, norm });
  };

  const savePin = async (v: PinFormValues) => {
    if (!form) return;
    setFormBusy(true);
    setFormError(null);
    try {
      let image_url: string | null | undefined;
      if (v.file) {
        const img = await prepareImage(v.file);
        image_url = await uploadFile(`pins/${roomId}/${uuid()}.${img.ext}`, img.blob, img.type);
      } else if (v.removeImage) {
        image_url = null;
      }

      if (form.mode === 'create') {
        if (!identity) return;
        const { data, error } = await supabase
          .from('pins')
          .insert({
            room_id: roomId,
            author_id: identity.author_id,
            author_name: identity.author_name,
            group_name: identity.group_name,
            group_color: identity.group_color,
            pos_x: form.pos[0], pos_y: form.pos[1], pos_z: form.pos[2],
            norm_x: form.norm[0], norm_y: form.norm[1], norm_z: form.norm[2],
            title: v.title,
            description: v.description || null,
            image_url: image_url ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        upsertPin(data as Pin);
        setSelectedId((data as Pin).id);
      } else {
        const patch: Partial<Pin> = { title: v.title, description: v.description || null };
        if (image_url !== undefined) patch.image_url = image_url;
        const { data, error } = await supabase
          .from('pins')
          .update(patch)
          .eq('id', form.pin.id)
          .eq('author_id', form.pin.author_id)
          .select()
          .single();
        if (error) throw error;
        upsertPin(data as Pin);
      }
      setForm(null);
    } catch (e) {
      setFormError(`保存できませんでした：${errMsg(e)}`);
    } finally {
      setFormBusy(false);
    }
  };

  const deletePin = async (pin: Pin) => {
    if (!confirm(`「${pin.title}」を削除しますか？`)) return;
    let q = supabase.from('pins').delete().eq('id', pin.id);
    if (!isTeacher && identity) q = q.eq('author_id', identity.author_id);
    const { error } = await q;
    if (error) return showToast(`削除できませんでした：${errMsg(error)}`);
    removePin(pin.id);
    setSelectedId(null);
  };

  const deleteAllPins = async () => {
    if (!confirm('このルームの全ピンを削除します。元に戻せません。よろしいですか？')) return;
    const { error } = await supabase.from('pins').delete().eq('room_id', roomId);
    if (error) return showToast(`削除できませんでした：${errMsg(error)}`);
    removeAllPins();
    setSelectedId(null);
  };

  /* ---------- 入室モーダル ---------- */
  if (askTeacher && !isTeacher) {
    return (
      <TeacherAuthModal
        onCancel={() => { setAskTeacher(false); setSaved(loadIdentity()); }}
        onSubmit={(pass) => {
          if (pass !== room.teacher_passcode) return false;
          setTeacherAuthed(roomId);
          setIsTeacher(true);
          setAskTeacher(false);
          return true;
        }}
      />
    );
  }
  if (!isTeacher && !identity) {
    return <JoinModal roomTitle={room.title} initial={saved} onJoin={setIdentity} onTeacher={() => setAskTeacher(true)} />;
  }

  /* ---------- メイン画面 ---------- */
  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-slate-900">
      <div className="absolute inset-0">
        <Viewer3D
          modelUrl={room.glb_url}
          pins={viewerPins}
          selectedId={selectedPin?.id ?? null}
          placeMode={placeMode}
          onPlace={handlePlace}
          onSelect={setSelectedId}
          cameraSync={room.camera_sync}
          followSync={!isTeacher}
          apiRef={apiRef}
          animState={room.anim_state ?? null}
          onClips={setClips}
        />
      </div>

      <header className="pointer-events-none absolute left-3 top-3 z-20">
        <div className="pointer-events-auto rounded-xl bg-white/95 px-3 py-2 shadow ring-1 ring-slate-200">
          <h1 className="text-sm font-bold leading-tight">{room.title}</h1>
          <p className="text-xs text-slate-600">
            {isTeacher ? '先生' : (
              <>
                <span className="font-bold" style={{ color: identity!.group_color }}>{identity!.group_name}</span>　{identity!.author_name}
              </>
            )}
          </p>
          {!isTeacher && (
            <button className="mt-1 text-xs text-slate-500 underline" onClick={() => { setSaved(identity); setIdentity(null); setSelectedId(null); setPlaceMode(false); }}>
              班・名前を変更
            </button>
          )}
        </div>
      </header>

      {locked && (
        <div role="status" className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 shadow">
          現在、先生のお話タイム中です
        </div>
      )}
      {isTeacher && room.is_locked && (
        <div role="status" className="absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 shadow">
          投稿ロック中
        </div>
      )}

      {!isTeacher && room.camera_sync?.locked && (
        <div role="status" className="absolute left-1/2 top-14 z-20 -translate-x-1/2 rounded-full bg-sky-500 px-4 py-2 text-sm font-bold text-white shadow">
          先生の画面を見てください（視点が固定されています）
        </div>
      )}

      {isTeacher && (
        <TeacherPanel
          room={room}
          pinCount={pins.length}
          groupFilter={groupFilter}
          clips={clips}
          onAnim={sendAnim}
          onFilter={setGroupFilter}
          onMode={(m) => void updateRoom({ display_mode: m })}
          onLock={(v) => void updateRoom({ is_locked: v })}
          onSync={() => syncCamera()}
          camLocked={!!room.camera_sync?.locked}
          onCamLock={toggleCamLock}
          onOpenList={() => setListOpen(true)}
        />
      )}

      {!isTeacher && (
        <div className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-2">
          {placeMode && <p className="rounded-lg bg-white/95 px-3 py-1 text-sm font-bold shadow">ピンを立てたい場所をタップ</p>}
          <button className={`btn shadow ${placeMode ? 'btn-on' : ''}`} disabled={!canPlace} onClick={() => setPlaceMode((v) => !v)}>
            {placeMode ? 'キャンセル' : 'ピンを立てる'}
          </button>
          {!placeMode && <p className="rounded bg-slate-900/60 px-2 py-0.5 text-xs text-white">モデルをダブルタップでも立てられます</p>}
        </div>
      )}

      {selectedPin && (
        <PinDetailPanel
          pin={selectedPin}
          number={numbers.get(selectedPin.id) ?? 0}
          showAuthor={!anonymous}
          canEdit={!isTeacher && !locked && selectedPin.author_id === identity?.author_id}
          canDelete={isTeacher || selectedPin.author_id === identity?.author_id}
          onEdit={() => { setFormError(null); setForm({ mode: 'edit', pin: selectedPin }); }}
          onDelete={() => void deletePin(selectedPin)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {form && (
        <PinFormModal
          initial={form.mode === 'edit' ? form.pin : undefined}
          busy={formBusy}
          error={formError}
          onSubmit={(v) => void savePin(v)}
          onCancel={() => setForm(null)}
        />
      )}

      {listOpen && (
        <PinListModal
          pins={[...pins].sort((a, b) => a.created_at.localeCompare(b.created_at))}
          numbers={numbers}
          roomTitle={room.title}
          onSelect={(id) => { setSelectedId(id); setListOpen(false); }}
          onDeleteAll={() => void deleteAllPins()}
          onClose={() => setListOpen(false)}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
