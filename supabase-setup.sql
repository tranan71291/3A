-- =====================================================================
--  3A CRM (VASSH / ALUX) — THIẾT LẬP SUPABASE (v26: thêm vai trò & quyền tin nhắn riêng)
--  Chạy 1 lần: Supabase > SQL Editor > New query > dán toàn bộ file > Run.
--  Chạy lại nhiều lần vẫn an toàn (không xóa dữ liệu).
--
--  Mô hình dữ liệu
--  - records: mỗi bản ghi nghiệp vụ (lead, khách hàng, báo giá, phiếu thu...) là 1 dòng,
--    tách theo doanh nghiệp (tenant_id = 'vassh' | 'alux'); '_platform' là dữ liệu nền tảng 3A.
--  - members: tài khoản đăng nhập (Supabase Auth) thuộc doanh nghiệp nào.
--  - platform_admins: tài khoản quản trị nền tảng 3A Group (xem được mọi doanh nghiệp).
--  - Row Level Security: nhân viên VASSH không đọc / ghi được dữ liệu ALUX và ngược lại.
--  - File (ảnh nghiệm thu, chứng từ, chữ ký) lưu ở Storage bucket 'crm-files',
--    tên file là mã băm nội dung (không đoán được).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Bảng
-- ---------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null check (tenant_id ~ '^[a-z0-9_-]{2,40}$' and tenant_id <> '_platform'),
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

create sequence if not exists public.records_seq;

create table if not exists public.records (
  tenant_id text not null,
  coll text not null,
  id text not null,
  data jsonb not null,
  rank double precision not null default 0,
  deleted boolean not null default false,
  seq bigint not null default nextval('public.records_seq'),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (tenant_id, coll, id)
);
create index if not exists records_tenant_seq_idx on public.records (tenant_id, seq);

-- Mỗi lần ghi: tăng số thứ tự thay đổi (để máy khác kéo phần mới), ghi thời điểm và người sửa
create or replace function public.records_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.seq := nextval('public.records_seq');
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- ---------------------------------------------------------------------
-- Hàm kiểm tra quyền (security definer để tránh vòng lặp RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

create or replace function public.is_member(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and tenant_id = t)
$$;

create or replace function public.is_tenant_admin(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and tenant_id = t and is_admin)
$$;

create or replace function public.has_any_membership() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------
-- v26: Vai trò & liên kết tài khoản app (bổ sung, không đổi dữ liệu cũ)
--  - members.role: BOD | MKT_LEAD | DEPT_HEAD | SALES_REP | ACCOUNTANT.
--    Để trống (NULL) = giữ hành vi cũ (được ghi như trước) → nâng cấp không làm gãy hệ thống đang chạy.
--  - members.app_user_id: mã nhân sự trong app (users.id) để kiểm tra quyền đọc tin nhắn riêng / nhóm kín.
-- ---------------------------------------------------------------------
alter table public.members add column if not exists role text;
alter table public.members add column if not exists app_user_id text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'members_role_check') then
    alter table public.members add constraint members_role_check check (role is null or role in ('BOD','MKT_LEAD','DEPT_HEAD','SALES_REP','ACCOUNTANT'));
  end if;
end $$;

create or replace function public.member_role(t text) returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid() and tenant_id = t limit 1
$$;

create or replace function public.member_app_user(t text) returns text
language sql stable security definer set search_path = public as $$
  select app_user_id from public.members where user_id = auth.uid() and tenant_id = t limit 1
$$;

-- Ghi dữ liệu: cấu hình phân quyền & chính sách bảo mật chỉ Giám đốc (BOD) / quản trị doanh nghiệp được sửa
create or replace function public.can_write(t text, c text, i text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or (
    t <> '_platform' and public.is_member(t) and (
      not (c = '$' and i in ('perms', 'security'))
      or public.is_tenant_admin(t)
      or coalesce(public.member_role(t), 'BOD') = 'BOD'
    )
  )
$$;

-- Đọc dữ liệu riêng tư: tin nhắn trực tiếp (dm:<a>:<b>) và nhóm chat kín chỉ thành viên đọc được
create or replace function public.can_read_private(t text, c text, d jsonb) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  me text := public.member_app_user(t);
  ent text;
  ch jsonb;
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
  return true;
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.records enable row level security;
alter table public.members enable row level security;
alter table public.platform_admins enable row level security;

drop policy if exists records_read on public.records;
create policy records_read on public.records for select to authenticated using (
  public.is_platform_admin()
  or (public.is_member(tenant_id) and public.can_read_private(tenant_id, coll, data))
  or (tenant_id = '_platform' and public.has_any_membership())
);

drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert to authenticated with check (
  public.can_write(tenant_id, coll, id)
);

drop policy if exists records_update on public.records;
create policy records_update on public.records for update to authenticated
  using (public.can_write(tenant_id, coll, id))
  with check (public.can_write(tenant_id, coll, id));

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (
  user_id = auth.uid() or public.is_platform_admin() or public.is_tenant_admin(tenant_id)
);

drop policy if exists platform_admins_read on public.platform_admins;
create policy platform_admins_read on public.platform_admins for select to authenticated using (
  user_id = auth.uid() or public.is_platform_admin()
);

revoke all on public.records, public.members, public.platform_admins from anon;
grant select, insert, update on public.records to authenticated;
grant select on public.members, public.platform_admins to authenticated;
grant usage on sequence public.records_seq to authenticated;

-- ---------------------------------------------------------------------
-- Hàm gọi từ app (RPC)
-- ---------------------------------------------------------------------

-- Doanh nghiệp mà tài khoản đang đăng nhập được truy cập
create or replace function public.my_access()
returns table (tenant_id text, is_admin boolean, platform boolean)
language sql stable security definer set search_path = public as $$
  select m.tenant_id, m.is_admin, false from public.members m where m.user_id = auth.uid()
  union all
  select '_platform', true, true from public.platform_admins p where p.user_id = auth.uid()
$$;

-- Cấp quyền / đặt mật khẩu tạm cho nhân sự (Giám đốc doanh nghiệp hoặc quản trị 3A).
-- Tài khoản Supabase Auth phải tồn tại trước (app tự tạo bằng đăng ký email + mật khẩu tạm).
create or replace function public.provision_member(p_email text, p_tenant text, p_password text default null, p_admin boolean default false)
returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_uid uuid;
  v_platform boolean := public.is_platform_admin();
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_tenant = '_platform' or p_tenant !~ '^[a-z0-9_-]{2,40}$' then raise exception 'invalid_tenant'; end if;
  if not (v_platform or public.is_tenant_admin(p_tenant)) then raise exception 'forbidden'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'no_user'; end if;
  if not v_platform then
    -- Giám đốc doanh nghiệp không được đụng tới tài khoản 3A hoặc tài khoản thuộc doanh nghiệp khác
    if exists (select 1 from public.platform_admins where user_id = v_uid) then raise exception 'forbidden_target'; end if;
    if exists (select 1 from public.members m where m.user_id = v_uid and m.tenant_id <> p_tenant and not public.is_tenant_admin(m.tenant_id)) then
      raise exception 'forbidden_target';
    end if;
  end if;
  if p_password is not null then
    if length(p_password) < 8 then raise exception 'weak_password'; end if;
    update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now() where id = v_uid;
  end if;
  insert into public.members (user_id, tenant_id, email, is_admin)
  values (v_uid, p_tenant, lower(trim(p_email)), coalesce(p_admin, false))
  on conflict (user_id, tenant_id) do update set is_admin = excluded.is_admin, email = excluded.email;
  return v_uid;
end $$;

-- Thu hồi quyền truy cập dữ liệu (khi khóa / nghỉ việc)
create or replace function public.revoke_member(p_email text, p_tenant text)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid;
begin
  if not (public.is_platform_admin() or public.is_tenant_admin(p_tenant)) then raise exception 'forbidden'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then return; end if;
  if v_uid = auth.uid() then raise exception 'cannot_revoke_self'; end if;
  delete from public.members where user_id = v_uid and tenant_id = p_tenant;
end $$;

-- v26: gán vai trò + liên kết mã nhân sự app cho tài khoản (Giám đốc doanh nghiệp hoặc quản trị 3A)
create or replace function public.set_member_profile(p_email text, p_tenant text, p_role text, p_app_user_id text default null)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid;
begin
  if not (public.is_platform_admin() or public.is_tenant_admin(p_tenant)) then raise exception 'forbidden'; end if;
  if p_role is not null and p_role not in ('BOD','MKT_LEAD','DEPT_HEAD','SALES_REP','ACCOUNTANT') then raise exception 'invalid_role'; end if;
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then raise exception 'no_user'; end if;
  update public.members set role = p_role, app_user_id = coalesce(p_app_user_id, app_user_id) where user_id = v_uid and tenant_id = p_tenant;
  if not found then raise exception 'not_member'; end if;
end $$;
revoke execute on function public.set_member_profile(text, text, text, text) from public, anon;
grant execute on function public.set_member_profile(text, text, text, text) to authenticated;
grant execute on function public.member_role(text), public.member_app_user(text), public.can_write(text, text, text), public.can_read_private(text, text, jsonb) to authenticated;

revoke execute on function public.my_access(), public.provision_member(text, text, text, boolean), public.revoke_member(text, text) from public, anon;
grant execute on function public.my_access(), public.provision_member(text, text, text, boolean), public.revoke_member(text, text) to authenticated;
grant execute on function public.is_platform_admin(), public.is_member(text), public.is_tenant_admin(text), public.has_any_membership() to authenticated;

-- ---------------------------------------------------------------------
-- Lưu file: bucket 'crm-files', thư mục đầu = mã doanh nghiệp (vd. vassh/ab12...e9.jpg)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('crm-files', 'crm-files', true)
on conflict (id) do nothing;

drop policy if exists "crm files upload" on storage.objects;
create policy "crm files upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'crm-files' and (public.is_platform_admin() or public.is_member((storage.foldername(name))[1]))
);
drop policy if exists "crm files read" on storage.objects;
create policy "crm files read" on storage.objects for select to authenticated using (
  bucket_id = 'crm-files' and (public.is_platform_admin() or public.is_member((storage.foldername(name))[1]))
);

-- =====================================================================
--  BƯỚC CUỐI (chạy riêng, SAU KHI đã tạo tài khoản quản trị 3A ở
--  Authentication > Users > Add user > Create new user, tick "Auto Confirm User"):
--
--  insert into public.platform_admins (user_id, email)
--  select id, email from auth.users where email = 'admin@3agroup.vn'
--  on conflict (user_id) do nothing;
-- =====================================================================
