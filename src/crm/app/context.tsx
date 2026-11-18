'use client';

import { type Dispatch, type SetStateAction } from 'react';
import type { ToastT } from '../lib/types';

/** Xóa có Hoàn tác: gỡ bản ghi, toast 7 giây kèm nút "Hoàn tác" chèn lại đúng vị trí cũ (không tạo bản sao nếu đã có) */
export function removeWithUndo<T extends { id: string }>(set: Dispatch<SetStateAction<T[]>>, item: T, notify: (msg: string, tone?: ToastT['tone'], action?: ToastT['action']) => void, msg: string, onUndo?: () => void) {
  let idx = -1;
  set((p) => { idx = p.findIndex((x) => x.id === item.id); return p.filter((x) => x.id !== item.id); });
  notify(msg, 'orange', { label: 'Hoàn tác', run: () => { set((p) => { if (p.some((x) => x.id === item.id)) return p; const at = idx < 0 ? p.length : Math.min(idx, p.length); return [...p.slice(0, at), item, ...p.slice(at)]; }); onUndo?.(); } });
}

