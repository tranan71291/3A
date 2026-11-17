import type { LlmMessage, LlmPart, LlmProvider, LlmRequest, LlmResponse } from './types';

type ABlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/** Claude Messages API với tool use. Khóa chỉ đọc từ biến môi trường máy chủ. */
export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic' as const;
  constructor(private readonly apiKey: string, readonly model: string, private readonly f: typeof fetch = fetch) {}

  async chat(req: LlmRequest): Promise<LlmResponse> {
    const r = await this.f('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: req.signal,
      headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages.map(toAnthropic),
        ...(req.tools.length ? { tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input })) } : {}),
      }),
    });
    const d = (await r.json().catch(() => ({}))) as { content?: ABlock[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number }; error?: { message?: string } };
    if (!r.ok) throw new Error(d.error?.message ?? `anthropic_${r.status}`);
    const parts: LlmPart[] = (d.content ?? []).flatMap((b): LlmPart[] => (b.type === 'text' ? [{ type: 'text', text: b.text }] : b.type === 'tool_use' ? [{ type: 'tool_call', id: b.id, name: b.name, input: b.input ?? {} }] : []));
    const stop = d.stop_reason === 'tool_use' ? 'tool_use' : d.stop_reason === 'end_turn' || d.stop_reason === 'stop_sequence' ? 'end' : d.stop_reason === 'max_tokens' ? 'max_tokens' : 'other';
    return { parts, stop, usage: { input: d.usage?.input_tokens, output: d.usage?.output_tokens } };
  }
}

function toAnthropic(m: LlmMessage): { role: 'user' | 'assistant'; content: string | ABlock[] } {
  if (typeof m.content === 'string') return { role: m.role, content: m.content };
  return {
    role: m.role,
    content: m.content.map((p): ABlock => (p.type === 'text' ? { type: 'text', text: p.text }
      : p.type === 'tool_call' ? { type: 'tool_use', id: p.id, name: p.name, input: p.input }
      : { type: 'tool_result', tool_use_id: p.id, content: p.content, ...(p.isError ? { is_error: true } : {}) })),
  };
}
