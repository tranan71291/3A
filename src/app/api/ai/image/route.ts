import { authorize, envFor, json, rateLimited, readJson } from '../../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Aspect = 'landscape' | 'square' | 'portrait';
type Body = { tenant: string; prompt: string; aspect?: Aspect; reference?: { mediaType: string; data: string }; strength?: number; brandPalette?: boolean };

function sizeFor(model: string, a: Aspect): string {
  if (/^dall-e-3/.test(model)) return a === 'landscape' ? '1792x1024' : a === 'portrait' ? '1024x1792' : '1024x1024';
  if (/^dall-e-2/.test(model)) return '1024x1024';
  return a === 'landscape' ? '1536x1024' : a === 'portrait' ? '1024x1536' : '1024x1024';
}

/**
 * OpenAI Images không có tham số "denoising strength" như Stable Diffusion. Quy đổi thanh trượt 0..1 thành:
 *  - câu chỉ dẫn mức bám ảnh gốc trong prompt,
 *  - input_fidelity="high" khi cần giữ chi tiết sản phẩm / logo (strength ≤ 0.35).
 * Muốn strength đúng nghĩa denoising: thêm adapter nhà cung cấp SD (cùng hợp đồng body này), không đổi client.
 */
function strengthGuide(s: number): string {
  if (s <= 0.25) return 'Giữ NGUYÊN sản phẩm, hình dáng, màu, nhãn và bố cục của ảnh tham chiếu; chỉ cải thiện ánh sáng, phông nền, độ nét.';
  if (s <= 0.5) return 'Giữ nguyên sản phẩm trong ảnh tham chiếu; được đổi bối cảnh, góc chụp và bố cục.';
  if (s <= 0.75) return 'Lấy sản phẩm và ý tưởng chính từ ảnh tham chiếu, sáng tạo bố cục và bối cảnh mới.';
  return 'Chỉ lấy cảm hứng về chủ đề và màu sắc từ ảnh tham chiếu, tạo hình ảnh mới hoàn toàn.';
}

const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** POST /api/ai/image — text2img hoặc img2img (khi có reference). Khóa API chỉ ở máy chủ. */
export async function POST(req: Request) {
  const b = await readJson<Body>(req, 8_000_000);
  if (!b || typeof b.prompt !== 'string' || b.prompt.trim().length < 3) return json({ ok: false, error: 'bad_request' }, 400);
  if (b.reference && (!IMG_TYPES.includes(b.reference.mediaType) || typeof b.reference.data !== 'string' || b.reference.data.length > 7_000_000)) return json({ ok: false, error: 'reference_invalid' }, 400);
  const who = await authorize(req, String(b.tenant ?? ''));
  if (who instanceof Response) return who;
  if (rateLimited(`img:${who.userId}`, Number(process.env.AI_IMAGE_RATE_PER_MIN ?? 6))) return json({ ok: false, error: 'rate_limited' }, 429);
  const key = envFor('OPENAI_API_KEY', b.tenant);
  if (!key) return json({ ok: false, error: 'image_not_configured' }, 503);
  const model = envFor('OPENAI_IMAGE_MODEL', b.tenant) || 'gpt-image-1';
  const aspect: Aspect = b.aspect === 'square' || b.aspect === 'portrait' ? b.aspect : 'landscape';
  const strength = Math.min(1, Math.max(0, Number.isFinite(b.strength) ? Number(b.strength) : 0.35));

  try {
    let r: Response;
    if (b.reference) {
      if (!/^gpt-image/.test(model)) return json({ ok: false, error: 'reference_needs_gpt_image' }, 400);
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', `${b.prompt.slice(0, 3000)}\n\n${strengthGuide(strength)}`);
      form.append('size', sizeFor(model, aspect));
      form.append('n', '1');
      if (strength <= 0.35) form.append('input_fidelity', 'high');
      const bytes = Buffer.from(b.reference.data, 'base64');
      form.append('image', new Blob([bytes], { type: b.reference.mediaType }), `reference.${b.reference.mediaType.split('/')[1]}`);
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
    } else {
      const body: Record<string, unknown> = { model, prompt: b.prompt.slice(0, 3800), n: 1, size: sizeFor(model, aspect) };
      if (/^dall-e/.test(model)) body.response_format = 'b64_json';
      r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    const d = (await r.json().catch(() => ({}))) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string } };
    if (!r.ok) return json({ ok: false, error: d.error?.message ?? `openai_${r.status}` }, r.status === 400 ? 400 : 502);
    const img = d.data?.[0];
    if (img?.b64_json) return json({ ok: true, b64: img.b64_json, mediaType: 'image/png', model, mode: b.reference ? 'img2img' : 'text2img' });
    if (img?.url) {
      const f = await fetch(img.url);
      return json({ ok: true, b64: Buffer.from(await f.arrayBuffer()).toString('base64'), mediaType: f.headers.get('content-type') ?? 'image/png', model, mode: b.reference ? 'img2img' : 'text2img' });
    }
    return json({ ok: false, error: 'image_empty' }, 502);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'image_failed' }, 502);
  }
}
