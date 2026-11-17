import { askCopilot } from '@/lib/ai/copilot';
import { resolveAiContext } from '@/lib/ai/core/context';
import { AiError, type ChatTurn } from '@/lib/ai/core/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hits = new Map<string, number[]>();
const limited = (key: string, max: number) => {
  const now = Date.now();
  const l = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  l.push(now); hits.set(key, l);
  return l.length > max;
};
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

/**
 * POST /api/chat  { tenant, messages: [{role, content}], confirmed?: string[] }
 * Header: Authorization: Bearer <access_token Supabase của người dùng>
 */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 200_000) throw new AiError('bad_request', 'payload_too_large', 413);
    const body = JSON.parse(raw || '{}') as { tenant?: string; messages?: ChatTurn[]; confirmed?: string[] };
    const messages = (body.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim());
    if (!messages.length || messages[messages.length - 1].role !== 'user') throw new AiError('bad_request', 'last_message_must_be_user');

    const ctx = await resolveAiContext(req, String(body.tenant ?? ''));                 // 1. Middleware: ai, vai trò, doanh nghiệp
    if (limited(`chat:${ctx.userId}`, Number(process.env.AI_RATE_PER_MIN ?? 20))) throw new AiError('rate_limited', 'rate_limited', 429);

    const answer = await askCopilot(ctx, messages, { company: process.env.COMPANY_NAME ?? ctx.tenant.toUpperCase(), confirmed: body.confirmed, signal: req.signal });
    if (!answer) throw new AiError('not_configured', 'ai_not_configured', 503);
    return json({ ok: true, ...answer });
  } catch (e) {
    if (e instanceof AiError) return json({ ok: false, error: e.code, message: e.message }, e.status);
    if (e instanceof SyntaxError) return json({ ok: false, error: 'bad_request' }, 400);
    console.error('[api/chat]', e);
    return json({ ok: false, error: 'internal' }, 500);
  }
}
