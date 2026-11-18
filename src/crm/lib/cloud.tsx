'use client';

import { canonCache, DATA_VERSION, fileUrlMap, isEmbeddedFile } from './core';
import type { AnyRec, User } from './types';

/** Lỗi từ máy chủ -> câu tiếng Việt dễ hiểu */
export function cloudMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  if (/Invalid login credentials|invalid_grant/i.test(m)) return 'Email hoặc mật khẩu không đúng';
  if (/Email not confirmed/i.test(m)) return 'Tài khoản chưa xác nhận email. Nhờ quản trị bật "Auto Confirm" hoặc xác nhận trong Supabase.';
  if (/rate limit|too many/i.test(m)) return 'Thao tác quá nhanh, máy chủ tạm chặn. Thử lại sau ít phút.';
  if (/forbidden_target/.test(m)) return 'Không được đổi mật khẩu tài khoản thuộc doanh nghiệp khác hoặc tài khoản 3A Group.';
  if (/forbidden/.test(m)) return 'Tài khoản của bạn không có quyền cấp tài khoản cho doanh nghiệp này.';
  if (/weak_password|Password should be/i.test(m)) return 'Mật khẩu quá ngắn (tối thiểu 8 ký tự).';
  if (/no_user/.test(m)) return 'Chưa có tài khoản đăng nhập cho email này.';
  if (/row-level security|permission denied|42501/i.test(m)) return 'Tài khoản không có quyền ghi dữ liệu doanh nghiệp này.';
  return m;
}

export function canon(v: unknown): { json: string; files: string[] } {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'string' && isEmbeddedFile(v)) {
      const url = fileUrlMap.get(v);
      return url ? { json: JSON.stringify(url), files: [] } : { json: JSON.stringify(v.slice(0, 64) + '#' + v.length), files: [v] };
    }
    return { json: v === undefined ? 'null' : JSON.stringify(v), files: [] };
  }
  const hit = canonCache.get(v as object);
  if (hit && !hit.files.some((f) => fileUrlMap.has(f))) return hit;
  const files: string[] = [];
  let json: string;
  if (Array.isArray(v)) {
    json = '[' + v.map((x) => { const c = canon(x); files.push(...c.files); return c.json; }).join(',') + ']';
  } else {
    const keys = Object.keys(v as AnyRec).filter((k) => (v as AnyRec)[k] !== undefined).sort();
    json = '{' + keys.map((k) => { const c = canon((v as AnyRec)[k]); files.push(...c.files); return JSON.stringify(k) + ':' + c.json; }).join(',') + '}';
  }
  const out = { json, files };
  canonCache.set(v as object, out);
  return out;
}

/** Bản sao đã thay file nhúng bằng đường dẫn Storage (để gửi lên máy chủ) */
export function withFileUrls(v: unknown): unknown {
  if (typeof v === 'string') return isEmbeddedFile(v) ? fileUrlMap.get(v) ?? v : v;
  if (Array.isArray(v)) return v.map(withFileUrls);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as AnyRec).filter(([, x]) => x !== undefined).map(([k, x]) => [k, withFileUrls(x)]));
  return v;
}

export function statsOf(d: AnyRec) {
  const users = (Array.isArray(d.users) ? d.users : []) as User[];
  return { size: JSON.stringify(d).length * 2, version: DATA_VERSION, savedAt: Date.now(), users: users.length, activeUsers: users.filter((u) => u.active).length, customers: Array.isArray(d.customers) ? d.customers.length : 0, records: (Array.isArray(d.jobs) ? d.jobs.length : 0) + (Array.isArray(d.leads) ? d.leads.length : 0) };
}

