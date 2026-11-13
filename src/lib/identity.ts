import type { Identity } from './types';

// localStorage キー（仕様書どおり）
const K = { id: 'author_id', group: 'group_name', color: 'group_color', name: 'author_name' } as const;

export function loadIdentity(): Identity | null {
  try {
    const author_id = localStorage.getItem(K.id);
    const group_name = localStorage.getItem(K.group);
    const group_color = localStorage.getItem(K.color);
    const author_name = localStorage.getItem(K.name);
    if (!author_id || !group_name || !group_color || !author_name) return null;
    return { author_id, group_name, group_color, author_name };
  } catch {
    return null;
  }
}

export function saveIdentity(i: Identity) {
  localStorage.setItem(K.id, i.author_id);
  localStorage.setItem(K.group, i.group_name);
  localStorage.setItem(K.color, i.group_color);
  localStorage.setItem(K.name, i.author_name);
}

/** 他ルームでも同じ端末なら同じ author_id を使い回す */
export function loadAuthorId(): string | null {
  try {
    return localStorage.getItem(K.id);
  } catch {
    return null;
  }
}

const teacherKey = (roomId: string) => `teacher_ok:${roomId}`;
export const isTeacherAuthed = (roomId: string) => {
  try {
    return localStorage.getItem(teacherKey(roomId)) === '1';
  } catch {
    return false;
  }
};
export const setTeacherAuthed = (roomId: string) => localStorage.setItem(teacherKey(roomId), '1');
