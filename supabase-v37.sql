-- =====================================================================
--  3A CRM v37 — Quyền ghi chỉ tiêu KPI (bảng records, coll = 'kpiTargets')
--  Chạy SAU supabase-setup.sql và supabase-v32.sql. Chạy lại nhiều lần vẫn an toàn, không đổi dữ liệu.
--  id bản ghi: DEPT:<mã phòng>:<YYYY-MM> | USER:<mã nhân sự>:<YYYY-MM> | CFG:company:*
--   - Giám đốc (BOD) / quản trị doanh nghiệp / quản trị 3A: ghi mọi chỉ tiêu.
--   - Trưởng phòng (DEPT_HEAD): chỉ ghi USER:* của nhân viên cùng phòng (không tự giao cho mình).
--   - Vai trò khác: chỉ đọc.
-- =====================================================================

create or replace function public.can_write_kpi(t text, i text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or public.is_tenant_admin(t)
    or coalesce(public.member_role(t), 'BOD') = 'BOD'
    or (
      public.member_role(t) = 'DEPT_HEAD' and i like 'USER:%' and exists (
        select 1
        from public.records me
        join public.records u on u.tenant_id = me.tenant_id and u.coll = 'users'
        where me.tenant_id = t and me.coll = 'users' and me.id = public.member_app_user(t) and not me.deleted
          and u.id = split_part(i, ':', 2) and not u.deleted and u.id <> me.id
          and coalesce(me.data->>'dept', '') <> '' and u.data->>'dept' = me.data->>'dept'
      )
    )
$$;
grant execute on function public.can_write_kpi(text, text) to authenticated;

-- Giữ nguyên quy tắc cũ, thêm điều kiện riêng cho kpiTargets
create or replace function public.can_write(t text, c text, i text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or (
    t <> '_platform' and public.is_member(t) and (
      not (c = '$' and i in ('perms', 'security'))
      or public.is_tenant_admin(t)
      or coalesce(public.member_role(t), 'BOD') = 'BOD'
    )
    and (c <> 'kpiTargets' or public.can_write_kpi(t, i))
  )
$$;
