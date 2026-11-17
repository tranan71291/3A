import { toGeminiSchema } from '../validate';
import type { LlmMessage, LlmPart, LlmProvider, LlmRequest, LlmResponse } from './types';

type GPart = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: { name: string; response: Record<string, unknown> } };

/**
 * Gemini generateContent với function calling (v1beta). Dùng khi doanh nghiệp chọn Gemini.
 * Gemini không có id cho mỗi lời gọi: adapter tự đánh id theo thứ tự để engine ghép kết quả.
 * Lưu ý: adapter này được viết theo tài liệu công khai, cần chạy thử với khóa thật trước khi bật.
 */
export class GeminiProvider implements LlmProvider {
  readonly id = 'gemini' as const;
  constructor(private readonly apiKey: string, readonly model: string, private readonly f: typeof fetch = fetch) {}

  async chat(req: LlmRequest): Promise<LlmResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const r = await this.f(url, {
      method: 'POST',
      signal: req.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages.map(toGemini),
        ...(req.tools.length ? { tools: [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, parameters: toGeminiSchema(t.input) })) }] } : {}),
        generationConfig: { maxOutputTokens: req.maxTokens },
      }),
    });
    const d = (await r.json().catch(() => ({}))) as { candidates?: { content?: { parts?: GPart[] }; finishReason?: string }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }; error?: { message?: string } };
    if (!r.ok) throw new Error(d.error?.message ?? `gemini_${r.status}`);
    const c = d.candidates?.[0];
    let n = 0;
    const parts: LlmPart[] = (c?.content?.parts ?? []).flatMap((p): LlmPart[] => (p.functionCall ? [{ type: 'tool_call', id: `g${n++}`, name: p.functionCall.name, input: p.functionCall.args ?? {} }] : p.text ? [{ type: 'text', text: p.text }] : []));
    const stop = parts.some((p) => p.type === 'tool_call') ? 'tool_use' : c?.finishReason === 'MAX_TOKENS' ? 'max_tokens' : c?.finishReason === 'STOP' ? 'end' : 'other';
    return { parts, stop, usage: { input: d.usageMetadata?.promptTokenCount, output: d.usageMetadata?.candidatesTokenCount } };
  }
}

function toGemini(m: LlmMessage): { role: 'user' | 'model'; parts: GPart[] } {
  const role = m.role === 'assistant' ? 'model' : 'user';
  if (typeof m.content === 'string') return { role, parts: [{ text: m.content }] };
  return {
    role,
    parts: m.content.map((p): GPart => (p.type === 'text' ? { text: p.text }
      : p.type === 'tool_call' ? { functionCall: { name: p.name, args: p.input } }
      : { functionResponse: { name: p.name, response: { result: safeJson(p.content), ...(p.isError ? { error: true } : {}) } } })),
  };
}
const safeJson = (s: string): unknown => { try { return JSON.parse(s); } catch { return s; } };
