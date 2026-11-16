import { authorize, json, rateLimited, readJson } from '../_lib/server';
import { callAi, type AiRequest } from '../_lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** POST /api/ai — trợ lý AI (Claude hoặc OpenAI theo cài đặt doanh nghiệp). Khóa API chỉ nằm trên máy chủ. */
export async function POST(req: Request) {
  const body = await readJson<AiRequest & { tenant: string }>(req, 8_000_000);
  if (!body || !Array.isArray(body.messages) || !body.messages.length) return json({ ok: false, error: 'bad_request' }, 400);
  const who = await authorize(req, String(body.tenant ?? ''));
  if (who instanceof Response) return who;
  if (rateLimited(`ai:${who.userId}`, Number(process.env.AI_RATE_PER_MIN ?? 20))) return json({ ok: false, error: 'rate_limited' }, 429);
  const messages = body.messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 40_000) }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ ok: false, error: 'bad_request' }, 400);
  const image = body.image && IMG_TYPES.includes(body.image.mediaType) && typeof body.image.data === 'string' && body.image.data.length < 7_000_000 ? body.image : undefined;
  const provider = body.provider === 'ANTHROPIC' || body.provider === 'OPENAI' ? body.provider : 'AUTO';
  const model = typeof body.model === 'string' && /^[\w.:-]{2,80}$/.test(body.model) ? body.model : undefined;
  const r = await callAi({ provider, system: typeof body.system === 'string' ? body.system.slice(0, 20_000) : undefined, messages, image, maxTokens: body.maxTokens, model }, body.tenant);
  return r.ok ? json(r) : json(r, r.status ?? 502);
}
