-- =====================================================================
--  3A CRM v32 — Zalo Hub: nhận tin nhắn Zalo OA qua webhook (chạy SAU file supabase-setup.sql các bản trước)
--  - Webhook trên máy chủ Next.js gọi zalo_ingest bằng khóa anon + mã bí mật ZALO_INGEST_TOKEN.
--  - Bảng integration_tokens chỉ lưu mã băm SHA-256 của mã bí mật, bật RLS và không có policy => không ai đọc trực tiếp.
--  - Tin nhắn ghi vào public.records (coll zaloConvs / zaloMsgs) nên CRM đồng bộ như dữ liệu khác, tách theo doanh nghiệp.
-- =====================================================================

create table if not exists public.integration_tokens (
  tenant_id text not null,
  kind text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, kind)
);
alter table public.integration_tokens enable row level security;

-- Giám đốc / quản trị doanh nghiệp hoặc quản trị 3A đặt mã bí mật (ví dụ: select public.set_integration_token('vassh','zalo','<chuỗi ngẫu nhiên dài>');)
create or replace function public.set_integration_token(p_tenant text, p_kind text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_platform_admin() or public.is_tenant_admin(p_tenant) or coalesce(public.member_role(p_tenant), '') = 'BOD') then
    raise exception 'forbidden';
  end if;
  if length(coalesce(p_token, '')) < 24 then raise exception 'token_too_short'; end if;
  insert into public.integration_tokens (tenant_id, kind, token_hash)
  values (p_tenant, p_kind, encode(sha256(convert_to(p_token, 'UTF8')), 'hex'))
  on conflict (tenant_id, kind) do update set token_hash = excluded.token_hash, created_at = now();
end $$;

-- Ghi 1 tin nhắn + cập nhật hội thoại (chỉ khi mã bí mật đúng)
create or replace function public.zalo_ingest(p_tenant text, p_token text, p_conv jsonb, p_msg jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  cid text := p_conv->>'id';
  mid text := p_msg->>'id';
  cur jsonb;
begin
  if not exists (
    select 1 from public.integration_tokens
    where tenant_id = p_tenant and kind = 'zalo' and token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  ) then
    raise exception 'forbidden';
  end if;
  if cid is null or cid !~ '^z_[0-9]{3,40}$' or mid is null or length(mid) > 80 or (p_msg->>'convId') is distinct from cid then
    raise exception 'bad_payload';
  end if;
  insert into public.records (tenant_id, coll, id, data) values (p_tenant, 'zaloMsgs', mid, p_msg)
  on conflict (tenant_id, coll, id) do nothing;
  if not found then return 'duplicate'; end if;
  select data into cur from public.records where tenant_id = p_tenant and coll = 'zaloConvs' and id = cid and not deleted;
  if cur is null then
    insert into public.records (tenant_id, coll, id, data)
    values (p_tenant, 'zaloConvs', cid, p_conv || jsonb_build_object('unread', case when p_msg->>'dir' = 'IN' then 1 else 0 end, 'createdAt', p_msg->'at', 'tags', '[]'::jsonb, 'links', '[]'::jsonb))
    on conflict (tenant_id, coll, id) do update set data = excluded.data, deleted = false;
    return 'new';
  end if;
  update public.records set data = cur
    || jsonb_strip_nulls(jsonb_build_object('lastAt', p_conv->'lastAt', 'lastText', p_conv->'lastText', 'followed', p_conv->'followed',
         'avatar', coalesce(cur->'avatar', p_conv->'avatar'), 'phone', coalesce(cur->'phone', p_conv->'phone'), 'address', coalesce(cur->'address', p_conv->'address')))
    || jsonb_build_object('unread', coalesce((cur->>'unread')::int, 0) + case when p_msg->>'dir' = 'IN' then 1 else 0 end,
         'status', case when p_msg->>'dir' = 'IN' and cur->>'status' = 'CLOSED' then 'OPEN' else coalesce(cur->>'status', 'OPEN') end)
  where tenant_id = p_tenant and coll = 'zaloConvs' and id = cid;
  return 'ok';
end $$;

revoke all on function public.zalo_ingest(text, text, jsonb, jsonb) from public;
grant execute on function public.zalo_ingest(text, text, jsonb, jsonb) to anon, authenticated;
revoke all on function public.set_integration_token(text, text, text) from public;
grant execute on function public.set_integration_token(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Bảo mật hội thoại Zalo: Giám đốc / Marketing / Trưởng phòng xem tất cả; nhân viên (Sales, Kế toán) chỉ xem
-- hội thoại được giao cho mình hoặc chưa ai nhận, trừ khi Cài đặt bật "Nhân viên xem mọi hội thoại".
-- Giữ nguyên quy tắc cũ cho kênh chat / tin nhắn riêng.
-- ---------------------------------------------------------------------
create or replace function public.can_read_private(t text, c text, d jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  me text := public.member_app_user(t);
  ent text;
  ch jsonb;
  cfg jsonb;
  cv jsonb;
begin
  if me is null then return true; end if; -- chưa liên kết tài khoản app: giữ hành vi cũ
  if c = 'channels' then
    return coalesce(jsonb_array_length(d->'members'), 0) = 0 or (d->'members') ? me or d->>'createdBy' = me;
  end if;
  if c = 'comments' and d->>'entity' = 'channel' then
    ent := d->>'entityId';
    if ent like 'dm:%' then return me = any (string_to_array(ent, ':')); end if;
    select r.data into ch from public.records r where r.tenant_id = t and r.coll = 'channels' and r.id = ent and not r.deleted;
    if ch is null then return true; end if;
    return coalesce(jsonb_array_length(ch->'members'), 0) = 0 or (ch->'members') ? me or ch->>'createdBy' = me;
  end if;
  if c in ('zaloConvs', 'zaloMsgs') then
    if coalesce(public.member_role(t), 'BOD') in ('BOD', 'MKT_LEAD', 'DEPT_HEAD') then return true; end if;
    select r.data into cfg from public.records r where r.tenant_id = t and r.coll = '$' and r.id = 'hubCfg' and not r.deleted;
    if coalesce((cfg->'zalo'->>'salesSeeAll')::boolean, false) then return true; end if;
    if c = 'zaloConvs' then cv := d;
    else select r.data into cv from public.records r where r.tenant_id = t and r.coll = 'zaloConvs' and r.id = d->>'convId' and not r.deleted;
    end if;
    if cv is null then return true; end if;
    return coalesce(cv->>'assignee', '') = '' or cv->>'assignee' = me;
  end if;
  return true;
end $$;
