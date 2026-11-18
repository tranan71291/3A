'use client';

import { CLOUD_ON, DATA_VERSION, dataKey, MIGRATIONS, orgOf, SNAP_KEEP, snapPrefix, storage, tenantCloudStats } from './core';
import type { AnyRec, StoredData, User } from './types';

/** Đọc thông số kỹ thuật dữ liệu của một doanh nghiệp từ khóa lưu riêng */
export function tenantStats(org: string) {
  if (CLOUD_ON) {
    const c = tenantCloudStats[org];
    return { raw: null as string | null, size: c?.size ?? 0, version: c?.version ?? 0, savedAt: c?.savedAt ?? 0, users: c?.users ?? 0, activeUsers: c?.activeUsers ?? 0, customers: c?.customers ?? 0, records: c?.records ?? 0 };
  }
  const raw = storage.get(dataKey(org));
  const out = { raw, size: raw ? raw.length * 2 : 0, version: 0, savedAt: 0, users: 0, activeUsers: 0, customers: 0, records: 0 };
  if (!raw) return out;
  try {
    const st = JSON.parse(raw) as StoredData;
    const d = (st.data ?? {}) as AnyRec;
    const users = (d.users ?? []) as User[];
    return { ...out, version: st.v ?? 0, savedAt: st.savedAt ?? 0, users: users.length, activeUsers: users.filter((u) => u.active).length, customers: (d.customers ?? []).length, records: orgOf(org).profile === 'MANUFACTURING' ? (d.jobs ?? []).length : (d.leads ?? []).length };
  } catch { return out; }
}

export function migrateData(data: AnyRec, from: number): { data: AnyRec; steps: number[] } {
  let d = { ...data };
  const steps: number[] = [];
  for (let v = from + 1; v <= DATA_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (m) { d = m(d); steps.push(v); }
  }
  return { data: d, steps };
}

/** Chụp nguyên bản dữ liệu hiện có trước khi nâng cấp / nhập / khôi phục; giữ 3 bản gần nhất */
export function takeSnapshot(org: string, reason: string): string | null {
  const raw = storage.get(dataKey(org));
  if (!raw) return null;
  let v = 0;
  try { v = (JSON.parse(raw) as StoredData).v ?? 0; } catch { /* bỏ qua */ }
  const key = `${snapPrefix(org)}${Date.now()}:v${v}:${reason}`;
  storage.set(key, raw);
  const old = listSnapshots(org).slice(SNAP_KEEP);
  old.forEach((s) => storage.del(s.key));
  return key;
}

export function listSnapshots(org: string): { key: string; version: number; at: number; reason: string }[] {
  return storage.keys().filter((k) => k.startsWith(snapPrefix(org))).map((key) => {
    const [at, v, reason] = key.slice(snapPrefix(org).length).split(':');
    return { key, at: Number(at), version: Number((v ?? 'v0').slice(1)), reason: reason ?? '' };
  }).sort((a, b) => b.at - a.at);
}

/** Lấp giá trị mặc định cho các khóa mới (vd. phân hệ / quyền / sự kiện vừa thêm ở bản app mới) */
export function withDefaults<T extends AnyRec>(value: unknown, defaults: T): T {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const out: AnyRec = { ...defaults };
  for (const [k, v] of Object.entries(value as AnyRec)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && defaults[k] && typeof defaults[k] === 'object' && !Array.isArray(defaults[k]) ? withDefaults(v, defaults[k]) : v;
  }
  return out as T;
}

