-- =====================================================================
--  3A CRM v38 — Hạn mức gợi ý viết tiếp (ghost text) theo người / ngày + khóa ghi cấu hình hạn mức
--  Chạy SAU supabase-setup.sql, supabase-v32.sql, supabase-v37.sql. Chạy lại nhiều lần vẫn an toàn, không đổi dữ liệu cũ.
--
--  - Cấu hình nằm ở bản ghi records (coll '$', id 'aiQuota'):
--      { "ghost": { "enabled": true, "dailyLimit": 50, "extraUsers": [...], "blockedUsers": [...] } }
--    Chỉ Giám đốc (BOD) / quản trị doanh nghiệp / quản trị 3A ghi được bản ghi này (sửa can_write bên dưới).
--  - Được dùng: vai trò BOD, MKT_LEAD, hoặc nhân sự phòng MARKETING, hoặc có trong extraUsers; trừ người trong blockedUsers.
--  - Bảng ai_usage chỉ đọc được dòng của chính mình; chỉ hàm ai_ghost_take (security definer) được ghi.
--  - Ngày tính theo giờ Việt Nam.
-- =====================================================================

create table if not exists public.ai_usage (
  tenant_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null,
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id, day, kind)
);
alter table public.ai_usage enable row level security;
drop policy if exists ai_usage_read_own on public.ai_usage;
create policy ai_usage_read_own on public.ai_usage for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.ai_usage from anon, authenticated;

-- Người gọi có được dùng gợi ý viết tiếp không, và giới hạn bao nhiêu (jsonb: {allowed, limit, reason})
create or replace function public.ai_ghost_policy(t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb;
  g jsonb;
  r text;
  app_user text;
  dept text;
  lim integer;
begin
  if not public.is_member(t) and not public.is_platform_admin() then
    return jsonb_build_object('allowed', false, 'reason', 'forbidden', 'limit', 0);
  end if;
  select data into cfg from public.records where tenant_id = t and coll = '$' and id = 'aiQuota' and not deleted;
  g := coalesce(cfg->'ghost', '{}'::jsonb);
  lim := greatest(1, least(1000, coalesce((g->>'dailyLimit')::integer, 50)));
  if coalesce((g->>'enabled')::boolean, true) = false then
    return jsonb_build_object('allowed', false, 'reason', 'ghost_disabled', 'limit', lim);
  end if;
  r := coalesce(public.member_role(t), 'BOD');
  app_user := public.member_app_user(t);
  if app_user is not null and coalesce(g->'blockedUsers', '[]'::jsonb) ? app_user then
    return jsonb_build_object('allowed', false, 'reason', 'not_allowed', 'limit', lim);
  end if;
  if app_user is not null then
    select data->>'dept' into dept from public.records where tenant_id = t and coll = 'users' and id = app_user and not deleted;
  end if;
  if r in ('BOD', 'MKT_LEAD') or dept = 'MARKETING' or (app_user is not null and coalesce(g->'extraUsers', '[]'::jsonb) ? app_user) or public.is_platform_admin() then
    return jsonb_build_object('allowed', true, 'reason', null, 'limit', lim);
  end if;
  return jsonb_build_object('allowed', false, 'reason', 'not_allowed', 'limit', lim);
end $$;

create or replace function public.ai_ghost_status(t text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p jsonb := public.ai_ghost_policy(t);
  u integer;
begin
  if p->>'reason' = 'forbidden' then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select used into u from public.ai_usage
   where tenant_id = t and user_id = auth.uid() and kind = 'ghost' and day = (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  return jsonb_build_object('ok', true, 'allowed', (p->>'allowed')::boolean, 'used', coalesce(u, 0), 'limit', (p->>'limit')::integer);
end $$;

-- Lấy 1 lượt: kiểm quyền + hạn mức rồi cộng 1 (một câu lệnh, an toàn khi gọi đồng thời)
create or replace function public.ai_ghost_take(t text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  p jsonb := public.ai_ghost_policy(t);
  lim integer := coalesce((p->>'limit')::integer, 50);
  d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  u integer;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'unauthorized'); end if;
  if not coalesce((p->>'allowed')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', coalesce(p->>'reason', 'not_allowed'));
  end if;
  insert into public.ai_usage as a (tenant_id, user_id, day, kind, used)
  values (t, auth.uid(), d, 'ghost', 1)
  on conflict (tenant_id, user_id, day, kind) do update set used = a.used + 1, updated_at = now()
    where a.used < lim
  returning used into u;
  if u is null then
    return jsonb_build_object('ok', false, 'error', 'quota_exceeded', 'used', lim, 'limit', lim);
  end if;
  return jsonb_build_object('ok', true, 'used', u, 'limit', lim);
end $$;

revoke all on function public.ai_ghost_policy(text) from public, anon;
grant execute on function public.ai_ghost_status(text) to authenticated;
grant execute on function public.ai_ghost_take(text) to authenticated;
grant execute on function public.ai_ghost_policy(text) to authenticated;

-- Giữ nguyên quy tắc v37, thêm: cấu hình hạn mức AI ('$'/aiQuota) chỉ BOD / quản trị được ghi
create or replace function public.can_write(t text, c text, i text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or (
    t <> '_platform' and public.is_member(t) and (
      not (c = '$' and i in ('perms', 'security', 'aiQuota'))
      or public.is_tenant_admin(t)
      or coalesce(public.member_role(t), 'BOD') = 'BOD'
    )
    and (c <> 'kpiTargets' or public.can_write_kpi(t, i))
  )
$$;

-- Dọn số liệu cũ hơn 90 ngày (tùy chọn, chạy tay khi cần):
-- delete from public.ai_usage where day < (now() at time zone 'Asia/Ho_Chi_Minh')::date - 90;
