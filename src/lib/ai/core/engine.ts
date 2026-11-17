import { buildBasePrompt, buildSystemPrompt } from './base-prompt';
import { routeIntents } from './intent';
import type { LlmMessage, LlmPart, LlmProvider, LlmToolDef } from './providers/types';
import type { ResolvedTool, SkillRegistry } from './registry';
import type { UserDb } from './supabase-user';
import { AiError, type AiContext, type ChatTurn, type CopilotAnswer, type KnowledgeSearch, type SkillManifest, type ToolCallTrace } from './types';
import { validateInput } from './validate';

export interface EngineDeps {
  registry: SkillRegistry;
  provider: LlmProvider;
  company: string;
  db: (jwt: string) => UserDb;
  /** Tạo bộ tra cứu đã khóa vào namespace của 1 Skill */
  kb: (ctx: AiContext, db: UserDb, namespaces: readonly string[]) => KnowledgeSearch;
  audit?: (db: UserDb, row: AuditRow) => Promise<void>;
  maxSteps?: number;
  maxTokens?: number;
  /** Tool ghi dữ liệu mà người dùng đã bấm xác nhận trong lượt này */
  confirmed?: readonly string[];
  /** Số liệu tóm tắt app gửi kèm (đã trong phạm vi quyền người dùng) — cho câu hỏi chưa có Skill riêng (SLA, dòng tiền…) */
  appContext?: string;
}
export interface AuditRow { request_id: string; tenant_id: string; user_id: string; role: string; skill: string; skill_version: string; tool: string; ok: boolean; ms: number; error?: string; args_digest: string }

const RESULT_LIMIT = 12_000;

/**
 * Vòng lặp Copilot: chọn Skill -> dựng system prompt -> gọi LLM -> chạy tool -> trả kết quả cho LLM -> lặp đến khi có câu trả lời.
 * Lõi không biết nghiệp vụ nào: mọi thứ nghiệp vụ đến từ SkillManifest.
 */
export async function runCopilot(deps: EngineDeps, ctx: AiContext, history: readonly ChatTurn[], signal?: AbortSignal): Promise<CopilotAnswer> {
  const { registry, provider } = deps;
  const db = deps.db(ctx.jwt);

  // 1) Lọc theo vai trò / doanh nghiệp, 2) định tuyến theo ý định
  const allowed = registry.available(ctx);
  const { picked, confident } = routeIntents(history, allowed);
  const active: SkillManifest[] = confident ? picked : allowed;
  const tools = registry.toolsFor(active, ctx.role);

  // 3) System prompt: nền + prompt đầy đủ của Skill được chọn (hoặc mô tả ngắn khi chưa chắc ý định)
  const system = buildSystemPrompt(buildBasePrompt(ctx, deps.company), active, confident ? 'full' : 'brief', deps.appContext);
  const toolDefs: LlmToolDef[] = tools.map((t) => ({ name: t.fullName, description: `[${t.skill.name}] ${t.tool.description}`, input: t.tool.input }));

  const messages: LlmMessage[] = history.slice(-20).map((t) => ({ role: t.role, content: t.content.slice(0, 8000) }));
  const trace: ToolCallTrace[] = [];
  const usage = { input: 0, output: 0 };
  let finalText = '';

  for (let step = 0; step < (deps.maxSteps ?? 5); step++) {
    const res = await provider.chat({ system, messages, tools: toolDefs, maxTokens: deps.maxTokens ?? 1500, signal }).catch((e: Error) => { throw new AiError('upstream', e.message, 502); });
    usage.input += res.usage?.input ?? 0; usage.output += res.usage?.output ?? 0;
    messages.push({ role: 'assistant', content: res.parts });
    finalText = res.parts.filter((p): p is Extract<LlmPart, { type: 'text' }> => p.type === 'text').map((p) => p.text).join('\n').trim();
    const calls = res.parts.filter((p): p is Extract<LlmPart, { type: 'tool_call' }> => p.type === 'tool_call');
    if (res.stop !== 'tool_use' || !calls.length) break;

    // Chạy song song các tool trong cùng một lượt, mỗi tool độc lập (lỗi 1 tool không làm hỏng tool khác)
    const results = await Promise.all(calls.map((c) => execTool(deps, ctx, db, c, trace, signal)));
    messages.push({ role: 'user', content: results });
    if (step === (deps.maxSteps ?? 5) - 1) finalText ||= 'Câu hỏi cần quá nhiều bước tra cứu. Hãy hỏi cụ thể hơn (một chỉ số, một kỳ, một phòng ban).';
  }

  return { text: finalText, skills: active.map((s) => s.id), tools: trace, provider: provider.id, model: provider.model, usage };
}

async function execTool(deps: EngineDeps, ctx: AiContext, db: UserDb, call: { id: string; name: string; input: Record<string, unknown> }, trace: ToolCallTrace[], signal?: AbortSignal): Promise<LlmPart> {
  const t0 = Date.now();
  const done = (content: unknown, ok: boolean, r?: ResolvedTool, error?: string): LlmPart => {
    const ms = Date.now() - t0;
    trace.push({ tool: call.name, skill: r?.skill.id ?? '?', ok, ms, ...(error ? { error } : {}) });
    // Ghi cả lần bị từ chối (LLM gọi tool ngoài quyền) để phát hiện prompt injection / lạm dụng
    if (deps.audit) void deps.audit(db, { request_id: ctx.requestId, tenant_id: ctx.tenant, user_id: ctx.userId, role: ctx.role, skill: r?.skill.id ?? 'unknown', skill_version: r?.skill.version ?? '-', tool: call.name, ok, ms, error, args_digest: digest(call.input) }).catch(() => undefined);
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return { type: 'tool_result', id: call.id, name: call.name, content: text.length > RESULT_LIMIT ? `${text.slice(0, RESULT_LIMIT)}…(đã cắt)` : text, ...(ok ? {} : { isError: true }) };
  };

  // Phòng thủ lớp 2: kiểm lại quyền ngay trước khi chạy, kể cả khi LLM "bịa" tên tool không được cấp
  const r = deps.registry.resolve(call.name, ctx);
  if (!r) return done({ error: 'forbidden', message: 'Công cụ không tồn tại hoặc vai trò hiện tại không được dùng.' }, false, undefined, 'forbidden');
  if (r.tool.mutates && !deps.confirmed?.includes(call.name)) return done({ needs_confirmation: true, message: 'Thao tác ghi dữ liệu: hỏi người dùng xác nhận trước.' }, false, r, 'needs_confirmation');

  const v = validateInput(r.tool.input, call.input);
  if (!v.ok) return done({ error: 'invalid_input', details: v.errors }, false, r, 'invalid_input');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), r.tool.timeoutMs ?? 10_000);
  signal?.addEventListener('abort', () => ac.abort(), { once: true });
  try {
    const out = await r.tool.handler(v.value, {
      ctx, db, signal: ac.signal,
      kb: deps.kb(ctx, db, r.skill.knowledge?.namespaces ?? []),
      log: (msg, extra) => console.info(`[ai:${ctx.requestId}] ${r.skill.id}: ${msg}`, extra ?? {}),
    });
    return done(out ?? { result: null }, true, r);
  } catch (e) {
    const msg = ac.signal.aborted ? 'timeout' : e instanceof Error ? e.message : 'tool_failed';
    return done({ error: 'tool_failed', message: msg }, false, r, msg);
  } finally { clearTimeout(timer); }
}

/** Không lưu nguyên văn tham số (có thể chứa dữ liệu khách hàng), chỉ lưu dấu vết để đối chiếu */
function digest(o: unknown): string {
  const s = JSON.stringify(o) ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(16)}`;
}
