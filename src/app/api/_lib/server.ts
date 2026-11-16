/**
 * Tiện ích dùng chung cho các route máy chủ (Next.js App Router, thư mục _lib không tạo route).
 *  - Khóa bí mật (Zalo OA, Claude, OpenAI) chỉ đọc từ biến môi trường của máy chủ, không bao giờ trả về trình duyệt.
 *  - Mỗi doanh nghiệp có thể dùng khóa riêng: ZALO_OA_ACCESS_TOKEN__VASSH ghi đè ZALO_OA_ACCESS_TOKEN cho doanh nghiệp "vassh".
 *  - Có Supabase: bắt buộc phiên đăng nhập hợp lệ và là thành viên doanh nghiệp. Không có Supabase (chạy cục bộ):
 *    chỉ mở khi NODE_ENV khác production hoặc đặt ALLOW_LOCAL_API=1.
 */
export const TENANT_RE = /^[a-z0-9_-]{2,40}$/;

export function envFor(name: string, tenant?: string): string {
  const t = tenant ? process.env[`${name}__${tenant.toUpperCase().replace(/-/g, '_')}`] : undefined;
  return (t ?? process.env[name] ?? '').trim();
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export const supabaseEnv = () => ({
  url: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, ''),
  key: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
});

export type Caller = { userId: string; email: string; local: boolean };

/** Xác thực người gọi và quyền thành viên doanh nghiệp. Trả về Response khi bị từ chối. */
export async function authorize(req: Request, tenant: string): Promise<Caller | Response> {
  if (!TENANT_RE.test(tenant)) return json({ ok: false, error: 'tenant_invalid' }, 400);
  const sb = supabaseEnv();
  if (!sb.url || !sb.key) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_API !== '1') return json({ ok: false, error: 'auth_unavailable' }, 401);
    return { userId: 'local', email: 'local', local: true };
  }
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ ok: false, error: 'unauthorized' }, 401);
  const h = { apikey: sb.key, Authorization: `Bearer ${token}` };
  const u = await fetch(`${sb.url}/auth/v1/user`, { headers: h }).catch(() => null);
  if (!u || !u.ok) return json({ ok: false, error: 'unauthorized' }, 401);
  const user = (await u.json()) as { id: string; email?: string };
  const a = await fetch(`${sb.url}/rest/v1/rpc/my_access`, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
  const rows = a && a.ok ? ((await a.json()) as { tenant_id: string; platform: boolean }[]) : [];
  if (!rows.some((r) => r.tenant_id === tenant || r.platform)) return json({ ok: false, error: 'forbidden' }, 403);
  return { userId: user.id, email: user.email ?? '', local: false };
}

/** Giới hạn tần suất đơn giản theo người dùng (bộ nhớ của tiến trình máy chủ) */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now); hits.set(key, list);
  return false;
}

/** Đọc JSON có giới hạn kích thước */
export async function readJson<T>(req: Request, maxBytes: number): Promise<T | null> {
  const text = await req.text().catch(() => '');
  if (!text || text.length > maxBytes) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
