import { envFor, sha256Hex } from './server';

/**
 * Zalo Official Account (OA API v3) và Zalo ZNS.
 * Biến môi trường (có thể thêm hậu tố __<MÃ_DOANH_NGHIỆP> để mỗi doanh nghiệp dùng OA riêng):
 *  ZALO_APP_ID, ZALO_APP_SECRET            — ứng dụng Zalo for Developers
 *  ZALO_OA_ACCESS_TOKEN                     — access token OA (hết hạn sau một thời gian)
 *  ZALO_OA_REFRESH_TOKEN                    — để máy chủ tự làm mới access token (giữ trong bộ nhớ tiến trình)
 *  ZALO_OA_SECRET_KEY                       — khóa bí mật OA, dùng xác thực chữ ký webhook
 *  ZALO_INGEST_TOKEN                        — chuỗi bí mật webhook dùng ghi tin nhắn vào Supabase (khớp set_integration_token)
 */
type Tok = { access: string; refresh: string; exp: number };
const cache = new Map<string, Tok>();

export function zaloStatus(tenant?: string) {
  return {
    oa: !!(envFor('ZALO_OA_ACCESS_TOKEN', tenant) || (envFor('ZALO_OA_REFRESH_TOKEN', tenant) && envFor('ZALO_APP_ID', tenant) && envFor('ZALO_APP_SECRET', tenant))),
    webhook: !!(envFor('ZALO_OA_SECRET_KEY', tenant) && envFor('ZALO_INGEST_TOKEN', tenant)),
  };
}

async function refresh(tenant: string | undefined, f: typeof fetch): Promise<string> {
  const key = tenant ?? '_';
  const cur = cache.get(key);
  const rt = cur?.refresh || envFor('ZALO_OA_REFRESH_TOKEN', tenant);
  const appId = envFor('ZALO_APP_ID', tenant);
  const secret = envFor('ZALO_APP_SECRET', tenant);
  if (!rt || !appId || !secret) return '';
  const r = await f('https://oauth.zaloapp.com/v4/oa/access_token', {
    method: 'POST',
    headers: { secret_key: secret, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: rt, app_id: appId, grant_type: 'refresh_token' }).toString(),
  });
  const d = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: string | number };
  if (!d.access_token) return '';
  cache.set(key, { access: d.access_token, refresh: d.refresh_token || rt, exp: Date.now() + (Number(d.expires_in) || 3600) * 1000 - 120_000 });
  return d.access_token;
}

async function accessToken(tenant: string | undefined, f: typeof fetch, force = false): Promise<string> {
  const c = cache.get(tenant ?? '_');
  if (!force && c && c.exp > Date.now()) return c.access;
  if (!force && !c && envFor('ZALO_OA_ACCESS_TOKEN', tenant)) return envFor('ZALO_OA_ACCESS_TOKEN', tenant);
  return (await refresh(tenant, f)) || envFor('ZALO_OA_ACCESS_TOKEN', tenant);
}

type ZaloResp = { error?: number; message?: string; data?: Record<string, unknown> };
/** Gọi API Zalo có tự làm mới token một lần khi token hết hạn / không hợp lệ */
async function zcall(tenant: string | undefined, f: typeof fetch, url: string, init: RequestInit): Promise<ZaloResp> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const tok = await accessToken(tenant, f, attempt > 0);
    if (!tok) return { error: -1, message: 'zalo_not_configured' };
    const r = await f(url, { ...init, headers: { ...(init.headers as Record<string, string>), access_token: tok } });
    const d = (await r.json().catch(() => ({ error: -2, message: `http_${r.status}` }))) as ZaloResp;
    if ((d.error === -216 || d.error === -124 || r.status === 401) && attempt === 0) continue;
    return d;
  }
  return { error: -3, message: 'zalo_failed' };
}

/** Gửi tin tư vấn (CS) văn bản cho người quan tâm OA */
export async function sendText(tenant: string | undefined, userId: string, text: string, f: typeof fetch = fetch) {
  return zcall(tenant, f, 'https://openapi.zalo.me/v3.0/oa/message/cs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { user_id: userId }, message: { text: text.slice(0, 2000) } }),
  });
}

/** Gửi ảnh qua đường dẫn công khai (https) */
export async function sendImage(tenant: string | undefined, userId: string, url: string, text: string, f: typeof fetch = fetch) {
  return zcall(tenant, f, 'https://openapi.zalo.me/v3.0/oa/message/cs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { user_id: userId }, message: { text: text.slice(0, 2000), attachment: { type: 'template', payload: { template_type: 'media', elements: [{ media_type: 'image', url }] } } } }),
  });
}

export async function userDetail(tenant: string | undefined, userId: string, f: typeof fetch = fetch) {
  const d = await zcall(tenant, f, `https://openapi.zalo.me/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({ user_id: userId }))}`, { method: 'GET' });
  const data = (d.data ?? {}) as { display_name?: string; avatar?: string; shared_info?: { phone?: string | number; name?: string; address?: string } };
  return { name: data.display_name, avatar: data.avatar, phone: data.shared_info?.phone ? String(data.shared_info.phone) : undefined, address: data.shared_info?.address };
}

/** Số điện thoại VN -> định dạng 84xxxxxxxxx cho ZNS */
export const zPhone = (p: string) => { const d = p.replace(/\D/g, ''); return d.startsWith('84') ? d : d.startsWith('0') ? `84${d.slice(1)}` : d; };

export async function sendZns(tenant: string | undefined, phone: string, templateId: string, data: Record<string, string>, trackingId: string, f: typeof fetch = fetch) {
  return zcall(tenant, f, 'https://business.openapi.zalo.me/message/template', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: zPhone(phone), template_id: templateId, template_data: data, tracking_id: trackingId.slice(0, 48) }),
  });
}

/**
 * Xác thực chữ ký webhook: header X-ZEvent-Signature = "mac=" + sha256(appId + body + timestamp + OA secret key).
 * Kiểm tra lại công thức theo tài liệu Zalo hiện hành khi cấu hình; ZALO_SKIP_SIGNATURE=1 chỉ dùng khi thử nghiệm.
 */
export async function verifySignature(tenant: string | undefined, header: string | null, body: string, appId: string, timestamp: string): Promise<boolean> {
  if (process.env.ZALO_SKIP_SIGNATURE === '1') return true;
  const secret = envFor('ZALO_OA_SECRET_KEY', tenant);
  if (!secret || !header) return false;
  const mac = header.replace(/^mac=/, '').trim().toLowerCase();
  return mac === (await sha256Hex(`${appId}${body}${timestamp}${secret}`));
}

/** Danh sách bài viết (tin bài) mới nhất của OA — API Article: GET /v2.0/article/getslice */
export async function listArticles(tenant: string | undefined, limit = 10, f: typeof fetch = fetch) {
  const d = await zcall(tenant, f, `https://openapi.zalo.me/v2.0/article/getslice?offset=0&limit=${Math.min(Math.max(limit, 1), 20)}&type=normal`, { method: 'GET' });
  if (d.error) return { ok: false as const, error: d.message === 'zalo_not_configured' ? 'zalo_not_configured' : 'upstream' };
  const medias = (Array.isArray((d.data as { medias?: unknown })?.medias) ? (d.data as { medias: Record<string, unknown>[] }).medias : []);
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    ok: true as const,
    items: medias.map((m) => ({ id: String(m.id ?? ''), title: str(m.title), thumb: str(m.thumb) || str(m.cover) || str(m.cover_url), url: str(m.link) || str(m.url) || str(m.share_link), at: Number(m.create_date ?? m.update_date ?? 0) || 0 })).filter((x) => x.id && x.title),
  };
}
