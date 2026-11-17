import type { UserDb } from '../core/supabase-user';
import type { Embedder } from './retriever';

/**
 * Nạp tài liệu vào MỘT namespace. Chạy bằng JWT người nạp => RLS kb_can_write quyết định ai được nạp vào đâu.
 * Tài liệu kỹ thuật mới vào 'tech_alux' chỉ ảnh hưởng Skill khai báo namespace đó.
 */
export async function ingestDocument(db: UserDb, embed: Embedder, doc: { tenant: string; namespace: string; title: string; text: string; sourceUrl?: string }) {
  const checksum = await sha256(doc.text);
  const { data: same } = await db.from('kb_documents').select('id').eq('tenant_id', doc.tenant).eq('namespace', doc.namespace).eq('checksum', checksum).maybeSingle();
  if (same) return { skipped: true as const, id: (same as { id: string }).id };

  const { data: d, error } = await db.from('kb_documents').insert({ tenant_id: doc.tenant, namespace: doc.namespace, title: doc.title, source_url: doc.sourceUrl, checksum }).select('id').single();
  if (error) throw new Error(error.message);
  const chunks = chunkText(doc.text);
  for (let i = 0; i < chunks.length; i += 16) {
    const batch = chunks.slice(i, i + 16);
    const vectors = await Promise.all(batch.map((c) => embed(`${doc.title}\n${c}`)));
    const { error: e2 } = await db.from('kb_chunks').insert(batch.map((content, k) => ({ document_id: (d as { id: string }).id, tenant_id: doc.tenant, namespace: doc.namespace, ord: i + k, content, embedding: vectors[k] })));
    if (e2) throw new Error(e2.message);
  }
  return { skipped: false as const, id: (d as { id: string }).id, chunks: chunks.length };
}

/** Cắt theo đoạn văn, gộp đến ~1.200 ký tự, gối 150 ký tự để không mất ngữ cảnh giữa hai đoạn */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const paras = text.replace(/\r/g, '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > size && cur) { out.push(cur); cur = cur.slice(-overlap); }
    cur = cur ? `${cur}\n\n${p}` : p;
    while (cur.length > size * 1.5) { out.push(cur.slice(0, size)); cur = cur.slice(size - overlap); }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
