-- =====================================================================
--  3A CRM — AI Copilot: kho kiến thức RAG theo namespace + nhật ký gọi tool
--  Chạy SAU supabase-setup.sql và supabase-v32.sql. Chạy lại nhiều lần vẫn an toàn.
--  Dùng các hàm có sẵn: is_member(t), member_role(t), is_platform_admin(), is_tenant_admin(t).
-- =====================================================================
-- Supabase: bật pgvector ở Database > Extensions (schema extensions) hoặc dòng dưới. match_kb_chunks tìm cả schema public và extensions.
create extension if not exists vector;

-- ---------------------------------------------------------------------
-- Namespace: "ngăn" tài liệu. Mỗi Skill khai báo namespace nó đọc; RLS khai báo vai trò nào được đọc.
-- VD: mdf_policy (BOD, MKT_LEAD, ACCOUNTANT, DEPT_HEAD) · tech_alux (BOD, DEPT_HEAD, SALES_REP) · hr_policy (BOD)
-- ---------------------------------------------------------------------
create table if not exists public.kb_namespaces (
  tenant_id     text not null,
  key           text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  title         text not null,
  allowed_roles text[] not null default '{BOD}',
  created_at    timestamptz not null default now(),
  primary key (tenant_id, key)
);

create table if not exists public.kb_documents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  namespace   text not null,
  title       text not null,
  source_url  text,
  version     int  not null default 1,
  checksum    text,                       -- sha256 nội dung: nạp lại tài liệu không đổi thì bỏ qua
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  foreign key (tenant_id, namespace) references public.kb_namespaces (tenant_id, key) on delete cascade
);

-- Số chiều phải khớp mô hình embedding (EMBEDDING_MODEL). text-embedding-3-small = 1536.
create table if not exists public.kb_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents (id) on delete cascade,
  tenant_id   text not null,
  namespace   text not null,
  ord         int  not null,
  content     text not null,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now()
);
create index if not exists kb_chunks_ns_idx on public.kb_chunks (tenant_id, namespace);
create index if not exists kb_chunks_hnsw on public.kb_chunks using hnsw (embedding vector_cosine_ops);

-- Vai trò hiện tại có được đọc namespace này không (quản trị 3A đọc tất cả)
create or replace function public.kb_can_read(t text, ns text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or (
    public.is_member(t) and exists (
      select 1 from public.kb_namespaces n
      where n.tenant_id = t and n.key = ns
        and coalesce(public.member_role(t), case when public.is_tenant_admin(t) then 'BOD' else 'SALES_REP' end) = any (n.allowed_roles)
    )
  )
$$;
-- Ghi tài liệu: Giám đốc / quản trị doanh nghiệp, hoặc Trưởng MKT với namespace bắt đầu bằng mkt_ hoặc mdf_
create or replace function public.kb_can_write(t text, ns text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or public.is_tenant_admin(t) or public.member_role(t) = 'BOD'
      or (public.member_role(t) = 'MKT_LEAD' and (ns like 'mkt\_%' or ns like 'mdf\_%'))
$$;
grant execute on function public.kb_can_read(text, text), public.kb_can_write(text, text) to authenticated;

alter table public.kb_namespaces enable row level security;
alter table public.kb_documents  enable row level security;
alter table public.kb_chunks     enable row level security;

drop policy if exists kb_ns_read on public.kb_namespaces;
create policy kb_ns_read on public.kb_namespaces for select to authenticated using (public.is_member(tenant_id) or public.is_platform_admin());
drop policy if exists kb_ns_admin on public.kb_namespaces;
create policy kb_ns_admin on public.kb_namespaces for all to authenticated
  using (public.is_platform_admin() or public.is_tenant_admin(tenant_id)) with check (public.is_platform_admin() or public.is_tenant_admin(tenant_id));

drop policy if exists kb_doc_read on public.kb_documents;
create policy kb_doc_read on public.kb_documents for select to authenticated using (public.kb_can_read(tenant_id, namespace));
drop policy if exists kb_doc_write on public.kb_documents;
create policy kb_doc_write on public.kb_documents for all to authenticated using (public.kb_can_write(tenant_id, namespace)) with check (public.kb_can_write(tenant_id, namespace));

drop policy if exists kb_chunk_read on public.kb_chunks;
create policy kb_chunk_read on public.kb_chunks for select to authenticated using (public.kb_can_read(tenant_id, namespace));
drop policy if exists kb_chunk_write on public.kb_chunks;
create policy kb_chunk_write on public.kb_chunks for all to authenticated using (public.kb_can_write(tenant_id, namespace)) with check (public.kb_can_write(tenant_id, namespace));

revoke all on public.kb_namespaces, public.kb_documents, public.kb_chunks from anon;
grant select, insert, update, delete on public.kb_namespaces, public.kb_documents, public.kb_chunks to authenticated;

-- ---------------------------------------------------------------------
-- Tìm kiếm ngữ nghĩa. SECURITY INVOKER (mặc định): chạy bằng quyền người gọi => RLS ở trên vẫn lọc.
-- Engine chỉ truyền namespace của Skill đang chạy => tài liệu của Skill khác không thể lẫn vào.
-- ---------------------------------------------------------------------
create or replace function public.match_kb_chunks(p_tenant text, p_namespaces text[], p_query vector(1536), p_limit int default 5, p_min_similarity float default 0.25)
returns table (chunk_id uuid, doc_title text, namespace text, content text, similarity float)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, d.title, c.namespace, c.content, 1 - (c.embedding <=> p_query) as similarity
  from public.kb_chunks c join public.kb_documents d on d.id = c.document_id
  where c.tenant_id = p_tenant and c.namespace = any (p_namespaces)
    and 1 - (c.embedding <=> p_query) >= p_min_similarity
  order by c.embedding <=> p_query
  limit least(greatest(p_limit, 1), 10)
$$;
grant execute on function public.match_kb_chunks(text, text[], vector, int, float) to authenticated;

-- ---------------------------------------------------------------------
-- Nhật ký gọi tool: ai hỏi, Skill / tool nào, phiên bản nào, thành công không. Không lưu nguyên văn tham số.
-- Người dùng chỉ ghi được dòng của chính mình; BOD / quản trị đọc nhật ký doanh nghiệp.
-- ---------------------------------------------------------------------
create table if not exists public.ai_tool_audit (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  request_id    text not null,
  tenant_id     text not null,
  user_id       uuid not null default auth.uid(),
  role          text not null,
  skill         text not null,
  skill_version text not null,
  tool          text not null,
  ok            boolean not null,
  ms            int not null,
  error         text,
  args_digest   text
);
create index if not exists ai_tool_audit_tenant_at on public.ai_tool_audit (tenant_id, at desc);
alter table public.ai_tool_audit enable row level security;
drop policy if exists ai_audit_insert on public.ai_tool_audit;
create policy ai_audit_insert on public.ai_tool_audit for insert to authenticated with check (user_id = auth.uid() and (public.is_member(tenant_id) or public.is_platform_admin()));
drop policy if exists ai_audit_read on public.ai_tool_audit;
create policy ai_audit_read on public.ai_tool_audit for select to authenticated using (public.is_platform_admin() or public.is_tenant_admin(tenant_id) or public.member_role(tenant_id) = 'BOD');
revoke all on public.ai_tool_audit from anon;
grant select, insert on public.ai_tool_audit to authenticated;
grant usage on sequence public.ai_tool_audit_id_seq to authenticated;

-- Namespace mẫu cho VASSH (sửa vai trò theo nhu cầu)
insert into public.kb_namespaces (tenant_id, key, title, allowed_roles) values
  ('vassh', 'mdf_policy', 'Quy định quỹ MDF / CS nội bộ', '{BOD,MKT_LEAD,ACCOUNTANT,DEPT_HEAD}'),
  ('vassh', 'vendor_3m',  'Tài liệu chương trình Hãng 3M', '{BOD,MKT_LEAD,ACCOUNTANT,DEPT_HEAD}'),
  ('vassh', 'hr_policy',  'Quy chế nhân sự',               '{BOD}')
on conflict do nothing;
