import { authorize, envFor, json, rateLimited, readJson } from '../../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Aspect = 'landscape' | 'square' | 'portrait';

/** Kích thước hợp lệ theo dòng mô hình (gpt-image-* và dall-e-3 khác nhau) */
function sizeFor(model: string, a: Aspect): string {
  if (/^dall-e-3/.test(model)) return a === 'landscape' ? '1792x1024' : a === 'portrait' ? '1024x1792' : '1024x1024';
  if (/^dall-e-2/.test(model)) return '1024x1024';
  return a === 'landscape' ? '1536x1024' : a === 'portrait' ? '1024x1536' : '1024x1024';
}

/**
 * POST /api/ai/image — tạo ảnh minh họa bằng OpenAI Images (OPENAI_API_KEY, OPENAI_IMAGE_MODEL).
 * Trả base64 để trình duyệt thu nhỏ rồi lưu; khóa API chỉ nằm trên máy chủ.
 */
export async function POST(req: Request) {
  const b = await readJson<{ tenant: string; prompt: string; aspect?: Aspect }>(req, 20_000);
  if (!b || typeof b.prompt !== 'string' || b.prompt.trim().length < 3) return json({ ok: false, error: 'bad_request' }, 400);
  const who = await authorize(req, String(b.tenant ?? ''));
  if (who instanceof Response) return who;
  if (rateLimited(`img:${who.userId}`, Number(process.env.AI_IMAGE_RATE_PER_MIN ?? 6))) return json({ ok: false, error: 'rate_limited' }, 429);
  const key = envFor('OPENAI_API_KEY', b.tenant);
  if (!key) return json({ ok: false, error: 'image_not_configured' }, 503);
  const model = envFor('OPENAI_IMAGE_MODEL', b.tenant) || 'gpt-image-1';
  const aspect: Aspect = b.aspect === 'square' || b.aspect === 'portrait' ? b.aspect : 'landscape';
  const body: Record<string, unknown> = { model, prompt: b.prompt.slice(0, 3800), n: 1, size: sizeFor(model, aspect) };
  if (/^dall-e/.test(model)) body.response_format = 'b64_json';
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => ({}))) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } };
    if (!r.ok) return json({ ok: false, error: d.error?.message ?? `openai_${r.status}` }, r.status === 400 ? 400 : 502);
    const img = d.data?.[0];
    if (img?.b64_json) return json({ ok: true, b64: img.b64_json, mediaType: 'image/png', model });
    if (img?.url) {
      const f = await fetch(img.url);
      const bytes = new Uint8Array(await f.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return json({ ok: true, b64: btoa(bin), mediaType: f.headers.get('content-type') ?? 'image/png', model });
    }
    return json({ ok: false, error: 'image_empty' }, 502);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'image_failed' }, 502);
  }
}
