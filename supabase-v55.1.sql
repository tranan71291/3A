-- =====================================================================
--  3A CRM v55.1 — VÁ BẢO MẬT NỀN TẢNG + KHO TỆP RIÊNG TƯ + TÙY CHỌN CÁ NHÂN
--  Chạy 1 lần SAU các file trước (setup, v32, v37, v38, v39): Supabase > SQL Editor > New query > dán > Run.
--  Chạy lại nhiều lần vẫn an toàn, không xóa / sửa dữ liệu nghiệp vụ.
--
--  THỨ TỰ TRIỂN KHAI: chạy file này TRƯỚC, deploy code v55.1 NGAY SAU.
--  (Code cũ v54.1 vẫn đăng nhập được sau khi chạy file này nhưng không còn đọc được danh mục doanh nghiệp,
--   nên menu module có thể hiện theo mặc định cho tới khi lên code v55.1.)
--
--  1. Siết quyền đọc hồ sơ nền tảng (records, tenant_id '_platform'):
--     - Quản trị 3A (platform_admins) đọc tất cả như cũ.
--     - Người dùng doanh nghiệp chỉ đọc 4 nhóm: layouts, layoutAssigns, customFields, industryProfiles,
--       và chỉ bản ghi thuộc phạm vi của mình:
--         layoutAssigns : cấp SYSTEM | PROFILE đúng mô hình doanh nghiệp | TENANT đúng mã doanh nghiệp
--         layouts       : đã PUBLISHED và đang được một layoutAssign đọc được trỏ tới (bản nháp không lộ)
--         customFields  : levels.sys | đúng mô hình (tr / mfg) | levels.tenants chứa mã doanh nghiệp
--         industryProfiles: mẫu dùng chung (không gắn tenantId) | mẫu riêng đúng mã doanh nghiệp
--     - Chặn hoàn toàn tenants, logs và mọi nhóm khác.
--     - Hàng đã xóa mềm của 4 nhóm trên vẫn đọc được (data rỗng) để máy người dùng gỡ bản cũ khi 3A gỡ.
--     - "Doanh nghiệp của tôi" = mọi doanh nghiệp tài khoản là thành viên (members).
--  2. RPC get_my_tenant_info(): hồ sơ các doanh nghiệp của chính tài khoản (bỏ ghi chú nội bộ của 3A).
--  3. Bucket riêng tư 'crm-attach' cho tệp đính kèm đơn hàng: thư mục đầu = mã doanh nghiệp,
--     chỉ thành viên doanh nghiệp (và quản trị 3A) đọc / tải lên / xóa; tối đa 10 MB mỗi tệp.
--  4. Nhóm dữ liệu 'userPrefs' (tùy chọn "Lưu cho tôi"): mỗi người chỉ ghi hàng của chính mình
--     (id = mã nhân sự gắn với tài khoản); quản trị doanh nghiệp ghi được mọi hàng.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Hàm phạm vi (security definer: đọc members / tenants không vướng RLS, không vòng lặp)
-- ---------------------------------------------------------------------
create or replace function public.my_tenant_ids() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(m.tenant_id order by m.tenant_id), '{}')
  from public.members m where m.user_id = auth.uid()
$$;

-- Mô hình các doanh nghiệp của tôi: 'TRADING' | 'MFG' (đọc từ hồ sơ tenants; doanh nghiệp có sẵn chưa có hồ sơ
-- thì theo danh mục gốc trong code: alux = Sản xuất, còn lại = Thương mại)
create or replace function public.my_tenant_profiles() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct p), '{}') from (
    select case coalesce(r.data->'org'->>'profile', case when t.id = 'alux' then 'MANUFACTURING' else 'TRADING' end)
             when 'MANUFACTURING' then 'MFG' else 'TRADING' end as p
    from unnest(public.my_tenant_ids()) as t(id)
    left join public.records r on r.tenant_id = '_platform' and r.coll = 'tenants' and r.id = t.id and not r.deleted
  ) x
$$;

create or replace function public.layout_assign_visible(d jsonb, ts text[], ps text[]) returns boolean
language sql immutable set search_path = public as $$
  select case d->>'level'
           when 'SYSTEM' then true
           when 'PROFILE' then coalesce(d->>'profile', '') = any(ps)
           when 'TENANT' then coalesce(d->>'tenantId', '') = any(ts)
           else false end
$$;

create or replace function public.platform_row_visible(c text, i text, d jsonb, del boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  ts text[];
  ps text[];
begin
  if c is null or c not in ('layouts', 'layoutAssigns', 'customFields', 'industryProfiles') then return false; end if;
  ts := public.my_tenant_ids();
  if coalesce(array_length(ts, 1), 0) = 0 then return false; end if;
  if del then return true; end if;
  ps := public.my_tenant_profiles();
  if c = 'layoutAssigns' then
    return public.layout_assign_visible(d, ts, ps);
  elsif c = 'layouts' then
    return coalesce(d->>'status', '') = 'PUBLISHED' and exists (
      select 1 from public.records a
      where a.tenant_id = '_platform' and a.coll = 'layoutAssigns' and not a.deleted
        and a.data->>'verId' = i and public.layout_assign_visible(a.data, ts, ps));
  elsif c = 'customFields' then
    return coalesce((d->'levels'->>'sys')::boolean, false)
      or ('TRADING' = any(ps) and coalesce((d->'levels'->>'tr')::boolean, false))
      or ('MFG' = any(ps) and coalesce((d->'levels'->>'mfg')::boolean, false))
      or exists (select 1 from jsonb_array_elements_text(case when jsonb_typeof(d->'levels'->'tenants') = 'array' then d->'levels'->'tenants' else '[]'::jsonb end) x(v) where x.v = any(ts));
  else
    -- industryProfiles: mẫu dùng chung đọc được; mẫu riêng một doanh nghiệp chỉ doanh nghiệp đó đọc
    return coalesce(d->>'tenantId', '') = '' or d->>'tenantId' = any(ts);
  end if;
end $$;

revoke all on function public.my_tenant_ids(), public.my_tenant_profiles(), public.platform_row_visible(text, text, jsonb, boolean) from public, anon;
grant execute on function public.my_tenant_ids(), public.my_tenant_profiles(), public.platform_row_visible(text, text, jsonb, boolean), public.layout_assign_visible(jsonb, text[], text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Policy đọc records: giữ nguyên phần dữ liệu doanh nghiệp, thay phần '_platform'
-- ---------------------------------------------------------------------
drop policy if exists records_read on public.records;
create policy records_read on public.records for select to authenticated using (
  public.is_platform_admin()
  or (tenant_id <> '_platform' and public.is_member(tenant_id) and public.can_read_private(tenant_id, coll, data))
  or (tenant_id = '_platform' and public.platform_row_visible(coll, id, data, deleted))
);

-- ---------------------------------------------------------------------
-- 3. RPC: hồ sơ các doanh nghiệp của chính tài khoản (thay cho việc đọc coll 'tenants')
--    Trả mảng JSON TenantReg; bỏ ghi chú nội bộ của 3A và mốc sao lưu
-- ---------------------------------------------------------------------
create or replace function public.get_my_tenant_info() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg((r.data - 'note' - 'lastBackupAt' - 'lastMigrationAt') order by r.id), '[]'::jsonb)
  from public.records r
  where r.tenant_id = '_platform' and r.coll = 'tenants' and not r.deleted
    and r.id = any(public.my_tenant_ids())
$$;
revoke all on function public.get_my_tenant_info() from public, anon;
grant execute on function public.get_my_tenant_info() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Ghi dữ liệu: giữ nguyên quy tắc v38, thêm userPrefs chỉ ghi hàng của chính mình
--    (tài khoản cũ chưa gắn mã nhân sự — app_user_id trống — giữ hành vi cũ để không gãy hệ thống đang chạy)
-- ---------------------------------------------------------------------
create or replace function public.can_write(t text, c text, i text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or (
    t <> '_platform' and public.is_member(t) and (
      not (c = '$' and i in ('perms', 'security', 'aiQuota'))
      or public.is_tenant_admin(t)
      or coalesce(public.member_role(t), 'BOD') = 'BOD'
    )
    and (c <> 'kpiTargets' or public.can_write_kpi(t, i))
    and (c <> 'userPrefs' or public.is_tenant_admin(t) or public.member_app_user(t) is null or i = public.member_app_user(t))
  )
$$;

-- ---------------------------------------------------------------------
-- 5. Kho tệp đính kèm riêng tư: bucket 'crm-attach', đường dẫn <mã doanh nghiệp>/sales/<mã đơn>/<băm>.<đuôi>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-attach', 'crm-attach', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "crm attach read" on storage.objects;
create policy "crm attach read" on storage.objects for select to authenticated using (
  bucket_id = 'crm-attach' and (public.is_platform_admin() or public.is_member((storage.foldername(name))[1]))
);
drop policy if exists "crm attach upload" on storage.objects;
create policy "crm attach upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'crm-attach' and (public.is_platform_admin() or public.is_member((storage.foldername(name))[1]))
);
drop policy if exists "crm attach delete" on storage.objects;
create policy "crm attach delete" on storage.objects for delete to authenticated using (
  bucket_id = 'crm-attach' and (public.is_platform_admin() or public.is_member((storage.foldername(name))[1]))
);

-- =====================================================================
--  HOÀN TÁC (chỉ khi cần quay lại v54.1; chạy riêng):
--
--  drop policy if exists records_read on public.records;
--  create policy records_read on public.records for select to authenticated using (
--    public.is_platform_admin()
--    or (public.is_member(tenant_id) and public.can_read_private(tenant_id, coll, data))
--    or (tenant_id = '_platform' and public.has_any_membership())
--  );
--  -- can_write: chạy lại đoạn can_write trong supabase-v38.sql
--  -- Bucket 'crm-attach' và các tệp trong đó giữ nguyên (không xóa dữ liệu).
-- =====================================================================
