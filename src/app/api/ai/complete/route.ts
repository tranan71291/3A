import { authorize, envFor, json, rateLimited, readJson, supabaseEnv } from '../../_lib/server';
import { callAi, pickProvider } from '../../_lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Gợi ý viết tiếp (ghost text) cho Content Studio v38.
 *  GET  /api/ai/complete?tenant=x  -> { ok, allowed, used, limit }  (số lượt đã dùng hôm nay)
 *  POST /api/ai/complete { tenant, title, heading, before, keyword } -> { ok, text, used, limit }
 * Hạn mức đếm trong Supabase (supabase-v38.sql, hàm ai_ghost_take) bằng chính phiên đăng nhập của người dùng,
 * không dùng khóa service_role. Ai được dùng và giới hạn bao nhiêu lượt / ngày đọc từ cấu hình doanh nghiệp (chỉ Giám đốc sửa được).
 * Chạy cục bộ không có Supabase: đếm trong bộ nhớ, giới hạn AI_GHOST_DAILY_LIMIT (mặc định 50).
 */
type Quota = { ok: boolean; allowed?: boolean; used?: number; limit?: number; error?: string };

const localUse = new Map<string, number>();
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

async function rpc(req: Request, fn: 'ai_ghost_status' | 'ai_ghost_take', tenant: string): Promise<Quota> {
  const sb = supabaseEnv();
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const r = await fetch(`${sb.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: sb.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ t: tenant }),
  }).catch(() => null);
  if (!r) return { ok: false, error: 'quota_unavailable' };
  if (r.status === 404) return { ok: false, error: 'quota_not_installed' };
  const d = (await r.json().catch(() => null)) as Quota | null;
  return d && typeof d === 'object' ? d : { ok: false, error: `quota_${r.status}` };
}

function local(take: boolean, userId: string): Quota {
  const limit = Math.max(1, Number(process.env.AI_GHOST_DAILY_LIMIT ?? 50));
  const k = `${userId}:${today()}`;
  const used = localUse.get(k) ?? 0;
  if (!take) return { ok: true, allowed: true, used, limit };
  if (used >= limit) return { ok: false, error: 'quota_exceeded', used, limit };
  localUse.set(k, used + 1);
  return { ok: true, allowed: true, used: used + 1, limit };
}

export async function GET(req: Request) {
  const tenant = new URL(req.url).searchParams.get('tenant') ?? '';
  const who = await authorize(req, tenant);
  if (who instanceof Response) return who;
  const q = who.local ? local(false, who.userId) : await rpc(req, 'ai_ghost_status', tenant);
  return json(q, q.ok ? 200 : 503);
}

export async function POST(req: Request) {
  const body = await readJson<{ tenant?: string; title?: string; heading?: string; before?: string; keyword?: string }>(req, 20_000);
  if (!body || typeof body.before !== 'string' || body.before.trim().length < 20) return json({ ok: false, error: 'bad_request' }, 400);
  const tenant = String(body.tenant ?? '');
  const who = await authorize(req, tenant);
  if (who instanceof Response) return who;
  // Chặn gõ dồn: tối đa AI_GHOST_RATE_PER_MIN lượt / phút / người (mặc định 12)
  if (rateLimited(`ghost:${who.userId}`, Number(process.env.AI_GHOST_RATE_PER_MIN ?? 12))) return json({ ok: false, error: 'rate_limited' }, 429);
  // Mô hình nhỏ, nhanh cho gợi ý: AI_COMPLETE_MODEL_ANTHROPIC / AI_COMPLETE_MODEL_OPENAI ghi đè
  const provider = pickProvider('AUTO', tenant);
  if (!provider) return json({ ok: false, error: 'ai_not_configured' }, 503);
  const model = provider === 'ANTHROPIC' ? envFor('AI_COMPLETE_MODEL_ANTHROPIC', tenant) || 'claude-haiku-5-5' : envFor('AI_COMPLETE_MODEL_OPENAI', tenant) || 'gpt-4o-mini';
  // Đếm lượt trước khi gọi AI (máy chủ quyết định, trình duyệt không tự cộng / trừ được)
  const q = who.local ? local(true, who.userId) : await rpc(req, 'ai_ghost_take', tenant);
  if (!q.ok) return json(q, q.error === 'quota_exceeded' ? 429 : q.error === 'not_allowed' || q.error === 'ghost_disabled' ? 403 : 503);

  const clip = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const before = String(body.before).slice(-1500);
  const r = await callAi({
    provider,
    model,
    maxTokens: 90,
    system: [
      'Bạn gợi ý viết tiếp cho biên tập viên nội dung B2B tiếng Việt.',
      'Chỉ trả phần viết tiếp của câu / đoạn đang dở, tối đa 30 từ, không lặp lại chữ đã có, không xuống dòng, không dùng dấu ngoặc kép bao quanh, không giải thích.',
      'Không bịa số liệu, giá, thông số kỹ thuật cụ thể; nếu cần số liệu thì viết chung chung.',
    ].join(' '),
    messages: [{ role: 'user', content: `Bài: ${clip(body.title, 200)}\nMục: ${clip(body.heading, 200)}\nTừ khóa: ${clip(body.keyword, 80) || 'không có'}\n\nVăn bản đến con trỏ:\n${before}` }],
  }, tenant);
  if (!r.ok) return json({ ok: false, error: r.error, used: q.used, limit: q.limit }, r.status ?? 502);
  const words = r.text.replace(/^["“'`]+|["”'`]+$/g, '').replace(/\s+/g, ' ').trim().split(' ');
  return json({ ok: true, text: words.slice(0, 32).join(' '), used: q.used, limit: q.limit, model: r.model });
}

