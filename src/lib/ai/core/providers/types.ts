import type { JsonSchema } from '../types';

/** Định dạng trung lập: engine chỉ nói chuyện bằng các kiểu này, mỗi adapter tự dịch sang API của hãng */
export type LlmPart =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; content: string; isError?: boolean };

export interface LlmMessage { role: 'user' | 'assistant'; content: string | LlmPart[] }
export interface LlmToolDef { name: string; description: string; input: JsonSchema & { type: 'object' } }

export interface LlmRequest { system: string; messages: LlmMessage[]; tools: LlmToolDef[]; maxTokens: number; signal?: AbortSignal }
export interface LlmResponse {
  parts: LlmPart[];
  stop: 'end' | 'tool_use' | 'max_tokens' | 'other';
  usage?: { input?: number; output?: number };
}

export interface LlmProvider {
  readonly id: 'anthropic' | 'gemini';
  readonly model: string;
  chat(req: LlmRequest): Promise<LlmResponse>;
}
