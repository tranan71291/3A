import { runCopilot, type AuditRow, type EngineDeps } from './core/engine';
import { providerFor } from './core/providers';
import { SkillRegistry } from './core/registry';
import { createUserClient, type UserDb } from './core/supabase-user';
import type { AiContext, ChatTurn } from './core/types';
import { createKnowledgeSearch } from './rag/retriever';
import { SKILLS } from './skills/_generated';

/** Một registry dùng chung cho mọi request (không trạng thái người dùng). Lỗi bản kê khai => lỗi ngay khi khởi động. */
export const registry = new SkillRegistry(SKILLS);

const audit = async (db: UserDb, row: AuditRow) => { await db.from('ai_tool_audit').insert(row); };

/** Điểm vào duy nhất cho route: ghép các phụ thuộc thật vào engine */
export async function askCopilot(ctx: AiContext, history: ChatTurn[], opts: { company: string; confirmed?: string[]; signal?: AbortSignal }) {
  const provider = providerFor(ctx.tenant);
  if (!provider) return null;
  const deps: EngineDeps = {
    registry, provider, company: opts.company, confirmed: opts.confirmed, audit,
    db: createUserClient,
    kb: (c, db, ns) => createKnowledgeSearch(c, db, ns),
  };
  return runCopilot(deps, ctx, history, opts.signal);
}
