#!/usr/bin/env node
/**
 * Công cụ thử AI Copilot trên Supabase test — chạy trên máy, từ thư mục gốc dự án.
 *
 *   node --env-file=.env.local scripts/copilot-test.mjs whoami  --tenant vassh
 *   node --env-file=.env.local scripts/copilot-test.mjs ingest  docs/quy-dinh-mdf.md --tenant vassh --ns mdf_policy --title "Quy định quỹ MDF 2026"
 *   node --env-file=.env.local scripts/copilot-test.mjs search  "hóa đơn VAT cần những gì" --tenant vassh --ns mdf_policy
 *   node --env-file=.env.local scripts/copilot-test.mjs ask     "Quỹ 3M năm nay còn bao nhiêu?" --tenant vassh
 *   node scripts/copilot-test.mjs chunks docs/quy-dinh-mdf.md          (xem cách cắt đoạn, không cần mạng)
 *
 * Đăng nhập BẰNG TÀI KHOẢN NGƯỜI DÙNG (không dùng service_role):
 *   TEST_EMAIL + TEST_PASSWORD  (tài khoản Supabase Auth của người thử), hoặc
 *   TEST_ACCESS_TOKEN           (access_token copy từ trình duyệt đang đăng nhập app)
 * => Mọi thao tác chịu RLS y như trên app: nạp tài liệu cần quyền ghi namespace (BOD / quản trị, hoặc Trưởng MKT với mdf_*, mkt_*).
 *
 * Biến khác: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, OPENAI_API_KEY (embedding),
 *            EMBEDDING_MODEL (mặc định text-embedding-3-small), APP_URL (mặc định http://localhost:3000, cho lệnh ask).
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const cmd = argv[0];
const pos = argv.filter((a, i) => i > 0 && !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i > 0 ? argv[i + 1] : d; };
const env = (k, d = '') => (process.env[k] ?? d).trim();
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };

/** Giống lib/ai/rag/ingest.ts: cắt theo đoạn văn, ~1.200 ký tự, gối 150 */
function chunkText(text, size = 1200, overlap = 150) {
  const paras = text.replace(/\r/g, '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  let cur = '';
  for (const p of paras) {
    if ((cur + '\n\n' + p).length > size && cur) { out.push(cur); cur = cur.slice(-overlap); }
    cur = cur ? `${cur}\n\n${p}` : p;
    while (cur.length > size * 1.5) { out.push(cur.slice(0, size)); cur = cur.slice(size - overlap); }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

async function client() {
  const url = env('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const anon = env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) die('Thiếu NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (chạy với --env-file=.env.local)');
  if (anon.startsWith('sb_secret_') || /service_role/.test(Buffer.from(anon.split('.')[1] ?? '', 'base64url').toString())) die('Đây là khóa service_role / secret. Chỉ dùng khóa anon / publishable.');
  const { createClient } = await import('@supabase/supabase-js');
  let token = env('TEST_ACCESS_TOKEN');
  if (!token) {
    const email = env('TEST_EMAIL'), password = env('TEST_PASSWORD');
    if (!email || !password) die('Khai báo TEST_EMAIL + TEST_PASSWORD hoặc TEST_ACCESS_TOKEN');
    const auth = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error) die(`Đăng nhập thất bại: ${error.message}`);
    token = data.session.access_token;
  }
  const db = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  return { db, token };
}

async function embed(text) {
  const key = env('OPENAI_API_KEY');
  if (!key) die('Thiếu OPENAI_API_KEY (dùng cho embedding)');
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env('EMBEDDING_MODEL', 'text-embedding-3-small'), input: text }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.data?.[0]) die(`Embedding lỗi: ${d.error?.message ?? r.status}`);
  return d.data[0].embedding;
}

const tenant = () => opt('tenant') || die('Thiếu --tenant <mã doanh nghiệp>, VD --tenant vassh');

const commands = {
  async chunks() {
    const file = pos[0] || die('Thiếu đường dẫn file');
    const parts = chunkText(readFileSync(file, 'utf8'));
    parts.forEach((c, i) => console.log(`\n── Đoạn ${i + 1} (${c.length} ký tự) ──\n${c.slice(0, 300)}${c.length > 300 ? '…' : ''}`));
    console.log(`\n${parts.length} đoạn`);
  },

  async whoami() {
    const t = tenant();
    const { db } = await client();
    const { data: u } = await db.auth.getUser();
    const { data: access, error } = await db.rpc('my_access');
    if (error) die(`my_access lỗi: ${error.message}`);
    const { data: role } = await db.rpc('member_role', { t });
    const { data: ns, error: e2 } = await db.from('kb_namespaces').select('key,title,allowed_roles').eq('tenant_id', t);
    console.log({ email: u?.user?.email, tenant: t, member_of: (access ?? []).map((r) => r.tenant_id), role: role ?? '(chưa gán)' });
    if (e2) console.log(`kb_namespaces: ${e2.message} — đã chạy ai-copilot.sql chưa?`);
    else console.table(ns);
  },

  async ingest() {
    const t = tenant();
    const file = pos[0] || die('Thiếu đường dẫn file .md / .txt');
    const ns = opt('ns', 'mdf_policy');
    const text = readFileSync(file, 'utf8').trim();
    if (text.length < 50) die('File quá ngắn');
    const title = opt('title') || text.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').slice(0, 120) || file;
    const { db } = await client();
    const checksum = createHash('sha256').update(text).digest('hex');
    const { data: same } = await db.from('kb_documents').select('id').eq('tenant_id', t).eq('namespace', ns).eq('checksum', checksum).maybeSingle();
    if (same) return console.log(`= Bỏ qua: tài liệu này đã nạp (id ${same.id})`);
    const { data: d, error } = await db.from('kb_documents').insert({ tenant_id: t, namespace: ns, title, source_url: opt('source') ?? null, checksum }).select('id').single();
    if (error) die(`Ghi kb_documents bị từ chối: ${error.message}\n  → Kiểm tra vai trò (whoami) và namespace "${ns}" đã có trong kb_namespaces`);
    const parts = chunkText(text);
    for (let i = 0; i < parts.length; i += 16) {
      const batch = parts.slice(i, i + 16);
      const vectors = await Promise.all(batch.map((c) => embed(`${title}\n${c}`)));
      const { error: e2 } = await db.from('kb_chunks').insert(batch.map((content, k) => ({ document_id: d.id, tenant_id: t, namespace: ns, ord: i + k, content, embedding: vectors[k] })));
      if (e2) { await db.from('kb_documents').delete().eq('id', d.id); die(`Ghi kb_chunks lỗi: ${e2.message} (đã gỡ tài liệu dở dang)`); }
      process.stdout.write(`\r  đã nạp ${Math.min(i + 16, parts.length)}/${parts.length} đoạn`);
    }
    console.log(`\n✓ "${title}" → ${t}/${ns}, ${parts.length} đoạn, id ${d.id}`);
  },

  async search() {
    const t = tenant();
    const q = pos[0] || die('Thiếu câu tìm kiếm');
    const { db } = await client();
    const { data, error } = await db.rpc('match_kb_chunks', { p_tenant: t, p_namespaces: (opt('ns', 'mdf_policy')).split(','), p_query: await embed(q), p_limit: 5, p_min_similarity: Number(opt('min', '0.25')) });
    if (error) die(`match_kb_chunks lỗi: ${error.message}`);
    if (!data?.length) return console.log('Không có đoạn nào khớp (hoặc vai trò này không được đọc namespace).');
    for (const r of data) console.log(`\n[${r.similarity.toFixed(3)}] ${r.doc_title} · ${r.namespace}\n${r.content.slice(0, 400)}`);
  },

  async ask() {
    const t = tenant();
    const q = pos[0] || die('Thiếu câu hỏi');
    const { token } = await client();
    const app = env('APP_URL', 'http://localhost:3000').replace(/\/+$/, '');
    const r = await fetch(`${app}/api/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: t, messages: [{ role: 'user', content: q }] }),
    }).catch((e) => die(`Không gọi được ${app}/api/chat: ${e.message} — app đã chạy (npm run dev) chưa?`));
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) die(`HTTP ${r.status}: ${d.error ?? ''} ${d.message ?? ''}`);
    console.log(`\n${d.text ?? d.answer ?? JSON.stringify(d, null, 2)}\n`);
    const meta = { ...d }; delete meta.text; delete meta.answer; delete meta.ok;
    console.log('— chi tiết:', JSON.stringify(meta, null, 2));
  },
};

if (!commands[cmd]) {
  console.log('Lệnh: whoami | ingest <file> | search "<câu>" | ask "<câu hỏi>" | chunks <file>   (thêm --tenant <mã>)');
  process.exit(cmd ? 1 : 0);
}
await commands[cmd]();
