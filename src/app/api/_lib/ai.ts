import { envFor } from './server';

export type AiProvider = 'ANTHROPIC' | 'OPENAI';
export type AiTurn = { role: 'user' | 'assistant'; content: string };
export type AiImage = { mediaType: string; data: string };
export type AiRequest = { provider: AiProvider | 'AUTO'; system?: string; messages: AiTurn[]; image?: AiImage; maxTokens?: number; model?: string };
export type AiResult = { ok: true; text: string; provider: AiProvider; model: string; usage?: { input?: number; output?: number } } | { ok: false; error: string; status?: number };

const ANTHROPIC_DEFAULT = 'claude-sonnet-5-5';
const OPENAI_DEFAULT = 'gpt-4o-mini';

export function aiStatus(tenant?: string) {
  return { anthropic: !!envFor('ANTHROPIC_API_KEY', tenant), openai: !!envFor('OPENAI_API_KEY', tenant) };
}

export function pickProvider(p: AiRequest['provider'], tenant?: string): AiProvider | null {
  const s = aiStatus(tenant);
  if (p === 'ANTHROPIC') return s.anthropic ? 'ANTHROPIC' : null;
  if (p === 'OPENAI') return s.openai ? 'OPENAI' : null;
  return s.anthropic ? 'ANTHROPIC' : s.openai ? 'OPENAI' : null;
}

/** Gọi Claude (Messages API) hoặc OpenAI (Chat Completions); ảnh gửi kèm tin nhắn người dùng cuối cùng */
export async function callAi(req: AiRequest, tenant?: string, f: typeof fetch = fetch): Promise<AiResult> {
  const provider = pickProvider(req.provider, tenant);
  if (!provider) return { ok: false, error: 'ai_not_configured', status: 503 };
  const maxTokens = Math.min(Math.max(req.maxTokens ?? 1024, 64), 8192);
  const turns = req.messages.slice(-30);
  const lastUser = turns.map((t) => t.role).lastIndexOf('user');
  try {
    if (provider === 'ANTHROPIC') {
      const model = req.model || envFor('ANTHROPIC_MODEL', tenant) || ANTHROPIC_DEFAULT;
      const att = req.image && (req.image.mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: req.image.data } }
        : req.image ? { type: 'image', source: { type: 'base64', media_type: req.image.mediaType, data: req.image.data } } : null);
      const messages = turns.map((t, i) => (i === lastUser && att
        ? { role: t.role, content: [att, { type: 'text', text: t.content }] }
        : { role: t.role, content: t.content }));
      const r = await f('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': envFor('ANTHROPIC_API_KEY', tenant), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, ...(req.system ? { system: req.system } : {}), messages }),
      });
      const d = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } };
      if (!r.ok) return { ok: false, error: d.error?.message ?? `anthropic_${r.status}`, status: r.status };
      return { ok: true, provider, model, text: (d.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n').trim(), usage: { input: d.usage?.input_tokens, output: d.usage?.output_tokens } };
    }
    if (req.image?.mediaType === 'application/pdf') return { ok: false, error: 'pdf_needs_claude', status: 400 };
    const model = req.model || envFor('OPENAI_MODEL', tenant) || OPENAI_DEFAULT;
    const messages = [
      ...(req.system ? [{ role: 'system', content: req.system }] : []),
      ...turns.map((t, i) => (i === lastUser && req.image
        ? { role: t.role, content: [{ type: 'text', text: t.content }, { type: 'image_url', image_url: { url: `data:${req.image.mediaType};base64,${req.image.data}` } }] }
        : { role: t.role, content: t.content })),
    ];
    const r = await f('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${envFor('OPENAI_API_KEY', tenant)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    });
    const d = (await r.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; error?: { message?: string } };
    if (!r.ok) return { ok: false, error: d.error?.message ?? `openai_${r.status}`, status: r.status };
    return { ok: true, provider, model, text: (d.choices?.[0]?.message?.content ?? '').trim(), usage: { input: d.usage?.prompt_tokens, output: d.usage?.completion_tokens } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'ai_failed', status: 502 };
  }
}
