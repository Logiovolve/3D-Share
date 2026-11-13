export type DisplayMode = 'anonymous' | 'group';
export type Vec3 = [number, number, number];

export type CameraSync = { position: Vec3; target: Vec3; updated_at: string; locked?: boolean };

// 全アニメーションを同時再生。loop が false なら1回だけ再生して最後で止まる
export type AnimState = { playing: boolean; time: number; speed: number; loop?: boolean; rev: number };

export type Room = {
  id: string;
  title: string;
  glb_url: string;
  teacher_passcode: string;
  display_mode: DisplayMode;
  is_locked: boolean;
  camera_sync: CameraSync | null;
  join_code: string | null;
  join_password: string | null;
  anim_state: AnimState | null;
  created_at: string;
};

export type Pin = {
  id: string;
  room_id: string;
  author_id: string;
  author_name: string;
  group_name: string;
  group_color: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  norm_x: number;
  norm_y: number;
  norm_z: number;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

export type Identity = {
  author_id: string;
  group_name: string;
  group_color: string;
  author_name: string;
};
