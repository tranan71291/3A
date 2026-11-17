import { envFor } from '../core/providers';
import type { UserDb } from '../core/supabase-user';
import type { AiContext, KnowledgeHit, KnowledgeSearch } from '../core/types';

/**
 * RAG theo namespace:
 *  - Mỗi Skill khai báo knowledge.namespaces (VD marketing_mdf: ['mdf_policy', 'vendor_3m']).
 *  - Engine tạo bộ tra cứu ĐÃ KHÓA vào đúng các namespace đó cho handler của Skill.
 *  - Hàm SQL match_kb_chunks chạy SECURITY INVOKER bằng JWT người dùng => RLS còn lọc thêm theo doanh nghiệp
 *    và vai trò được đọc namespace (bảng kb_namespaces.allowed_roles).
 *  => Thêm tài liệu kỹ thuật vào namespace 'tech_*' không thể lọt vào câu trả lời của Skill nhân sự / MDF.
 */
export function createKnowledgeSearch(ctx: AiContext, db: UserDb, allowed: readonly string[], embed: Embedder = openAiEmbedder(ctx.tenant)): KnowledgeSearch {
  return {
    async search(query, opts) {
      const wanted = opts?.namespaces?.length ? opts.namespaces.filter((n) => allowed.includes(n)) : [...allowed];
      if (!wanted.length || !query.trim()) return [];
      const vector = await embed(query.slice(0, 2000));
      const { data, error } = await db.rpc('match_kb_chunks', {
        p_tenant: ctx.tenant,
        p_namespaces: wanted,
        p_query: vector,
        p_limit: Math.min(Math.max(opts?.limit ?? 5, 1), 10),
        p_min_similarity: 0.25,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as { chunk_id: string; doc_title: string; namespace: string; content: string; similarity: number }[])
        .map((r): KnowledgeHit => ({ chunkId: r.chunk_id, docTitle: r.doc_title, namespace: r.namespace, content: r.content, similarity: r.similarity }));
    },
  };
}

export type Embedder = (text: string) => Promise<number[]>;

/**
 * Mô hình embedding cấu hình bằng biến môi trường. Số chiều vector trong SQL (vector(1536)) phải khớp mô hình.
 * Mặc định OpenAI text-embedding-3-small (1536 chiều) vì app đã có OPENAI_API_KEY cho tạo ảnh.
 */
export function openAiEmbedder(tenant: string, f: typeof fetch = fetch): Embedder {
  return async (text) => {
    const key = envFor('OPENAI_API_KEY', tenant);
    if (!key) throw new Error('embedding_not_configured');
    const r = await f('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: envFor('EMBEDDING_MODEL', tenant) || 'text-embedding-3-small', input: text }),
    });
    const d = (await r.json().catch(() => ({}))) as { data?: { embedding: number[] }[]; error?: { message?: string } };
    if (!r.ok || !d.data?.[0]) throw new Error(d.error?.message ?? `embedding_${r.status}`);
    return d.data[0].embedding;
  };
}
