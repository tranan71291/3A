import { authorize, envFor, json, rateLimited, readJson } from '../../_lib/server';
import { checkImageModel, imageErrCode, type ImageMode, imageModel } from '../../_lib/image';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Aspect = 'landscape' | 'square' | 'portrait';
type Body = {
  tenant: string; prompt?: string; aspect?: Aspect; reference?: { mediaType: string; data: string }; strength?: number; brandPalette?: boolean;
  /** v56.0.1: 'fast' (mặc định) | 'detail' (chi tiết cao / chỉnh sửa sâu) */
  mode?: ImageMode;
  /** v56.0.1: chỉ kiểm tra 2 mô hình còn dùng được (không tạo ảnh, không tốn phí) */
  check?: boolean;
};

function sizeFor(model: string, a: Aspect): string {
  if (/^dall-e-3/.test(model)) return a === 'landscape' ? '1792x1024' : a === 'portrait' ? '1024x1792' : '1024x1024';
  return a === 'landscape' ? '1536x1024' : a === 'portrait' ? '1024x1536' : '1024x1024';
}

/**
 * OpenAI Images không có tham số "denoising strength" như Stable Diffusion. Quy đổi thanh trượt 0..1 thành:
 *  - câu chỉ dẫn mức bám ảnh gốc trong prompt,
 *  - input_fidelity="high" khi cần giữ chi tiết sản phẩm / logo (strength ≤ 0.35) — mô hình không nhận tham số này thì tự bỏ và gửi lại.
 */
function strengthGuide(s: number): string {
  if (s <= 0.25) return 'Giữ NGUYÊN sản phẩm, hình dáng, màu, nhãn và bố cục của ảnh tham chiếu; chỉ cải thiện ánh sáng, phông nền, độ nét.';
  if (s <= 0.5) return 'Giữ nguyên sản phẩm trong ảnh tham chiếu; được đổi bối cảnh, góc chụp và bố cục.';
  if (s <= 0.75) return 'Lấy sản phẩm và ý tưởng chính từ ảnh tham chiếu, sáng tạo bố cục và bối cảnh mới.';
  return 'Chỉ lấy cảm hứng về chủ đề và màu sắc từ ảnh tham chiếu, tạo hình ảnh mới hoàn toàn.';
}

const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Opt = { size: string; fidelity: boolean };
type OaRes = { ok: boolean; status: number; data?: { b64_json?: string; url?: string }[]; message: string };

/** Gọi OpenAI; lỗi 400 vì tham số tùy chọn (size, input_fidelity) mà mô hình mới không nhận thì bỏ tham số đó, gửi lại 1 lần */
async function callOpenAI(key: string, model: string, b: Body, prompt: string, aspect: Aspect, strength: number): Promise<OaRes> {
  const send = async (o: Opt): Promise<OaRes> => {
    let r: Response;
    if (b.reference) {
      const form = new FormData();
      form.append('model', model);
      form.append('prompt', `${prompt.slice(0, 3000)}\n\n${strengthGuide(strength)}`);
      form.append('size', o.size);
      form.append('n', '1');
      if (o.fidelity) form.append('input_fidelity', 'high');
      const bytes = Buffer.from(b.reference.data, 'base64');
      form.append('image', new Blob([bytes], { type: b.reference.mediaType }), `reference.${b.reference.mediaType.split('/')[1]}`);
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
    } else {
      const body: Record<string, unknown> = { model, prompt: prompt.slice(0, 3800), n: 1, size: o.size };
      if (/^dall-e/.test(model)) body.response_format = 'b64_json';
      r = await fetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    const d = (await r.json().catch(() => ({}))) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string; param?: string } };
    return { ok: r.ok, status: r.status, data: d.data, message: `${d.error?.param ? `[${d.error.param}] ` : ''}${d.error?.message ?? ''}` };
  };
  let o: Opt = { size: sizeFor(model, aspect), fidelity: !!b.reference && strength <= 0.35 };
  let res = await send(o);
  for (let i = 0; i < 2 && !res.ok && res.status === 400; i++) {
    const m = res.message.toLowerCase();
    if (o.fidelity && m.includes('input_fidelity')) o = { ...o, fidelity: false };
    else if (o.size !== 'auto' && /size/.test(m)) o = { ...o, size: 'auto' };
    else break;
    res = await send(o);
  }
  return res;
}

/** POST /api/ai/image — text2img hoặc img2img (khi có reference); { check: true } chỉ kiểm tra mô hình. Khóa API chỉ ở máy chủ. */
export async function POST(req: Request) {
  const b = await readJson<Body>(req, 8_000_000);
  if (!b) return json({ ok: false, error: 'bad_request' }, 400);
  const who = await authorize(req, String(b.tenant ?? ''));
  if (who instanceof Response) return who;
  const key = envFor('OPENAI_API_KEY', b.tenant);
  if (b.check) {
    const fast = imageModel('fast', b.tenant), detail = imageModel('detail', b.tenant);
    if (!key) return json({ ok: true, key: false, fast: { id: fast.model, ok: false, error: 'image_not_configured' }, detail: { id: detail.model, ok: false, error: 'image_not_configured' } });
    if (rateLimited(`imgchk:${who.userId}`, 20)) return json({ ok: false, error: 'rate_limited' }, 429);
    const [f, d] = await Promise.all([checkImageModel(key, fast.model), checkImageModel(key, detail.model)]);
    return json({ ok: true, key: true, fast: { ...f, retired: fast.retired ? fast.configured : undefined }, detail: { ...d, retired: detail.retired ? detail.configured : undefined } });
  }
  if (typeof b.prompt !== 'string' || b.prompt.trim().length < 3) return json({ ok: false, error: 'bad_request' }, 400);
  if (b.reference && (!IMG_TYPES.includes(b.reference.mediaType) || typeof b.reference.data !== 'string' || b.reference.data.length > 7_000_000)) return json({ ok: false, error: 'reference_invalid' }, 400);
  if (rateLimited(`img:${who.userId}`, Number(process.env.AI_IMAGE_RATE_PER_MIN ?? 6))) return json({ ok: false, error: 'rate_limited' }, 429);
  if (!key) return json({ ok: false, error: 'image_not_configured' }, 503);
  const mode: ImageMode = b.mode === 'detail' ? 'detail' : 'fast';
  const pick = imageModel(mode, b.tenant);
  const model = pick.model;
  if (pick.retired) console.warn(`[ai/image] ${b.tenant}: mô hình ${pick.configured} đã ngừng, dùng ${model}`);
  const aspect: Aspect = b.aspect === 'square' || b.aspect === 'portrait' ? b.aspect : 'landscape';
  const strength = Math.min(1, Math.max(0, Number.isFinite(b.strength) ? Number(b.strength) : 0.35));
  if (b.reference && /^dall-e/.test(model)) return json({ ok: false, error: 'reference_needs_gpt_image' }, 400);

  try {
    const r = await callOpenAI(key, model, b, b.prompt, aspect, strength);
    if (!r.ok) return json({ ok: false, error: imageErrCode(r.status, r.message), model }, r.status === 400 ? 400 : 502);
    const img = r.data?.[0];
    const out = { model, mode, kind: b.reference ? 'img2img' : 'text2img', replaced: pick.retired ? pick.configured : undefined };
    if (img?.b64_json) return json({ ok: true, b64: img.b64_json, mediaType: 'image/png', ...out });
    if (img?.url) {
      const f = await fetch(img.url);
      return json({ ok: true, b64: Buffer.from(await f.arrayBuffer()).toString('base64'), mediaType: f.headers.get('content-type') ?? 'image/png', ...out });
    }
    return json({ ok: false, error: 'image_empty', model }, 502);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? `image_network: ${e.message.slice(0, 120)}` : 'image_network', model }, 502);
  }
}
