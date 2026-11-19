-- =====================================================================
--  3A CRM v39 — NHIỀU DOANH NGHIỆP + ĐƯỜNG DẪN RIÊNG (crm.3agroup.vn/<mã>)
--  Chạy 1 lần SAU các file trước (setup, v32, v37, v38): Supabase > SQL Editor > New query > dán > Run.
--  Chạy lại nhiều lần vẫn an toàn, không xóa / sửa dữ liệu.
--
--  - Danh mục doanh nghiệp nằm trong hồ sơ nền tảng (records: tenant_id '_platform', coll 'tenants'),
--    do 3A Platform Console tạo / sửa. Không có bảng mới, không đổi RLS hiện có.
--  - tenant_brand: trang đăng nhập theo đường dẫn /<mã> đọc tên, màu, logo của doanh nghiệp TRƯỚC khi đăng nhập.
--    Chỉ trả các trường nhận diện công khai; không trả gói, hợp đồng, module, người quản trị hay dữ liệu nghiệp vụ.
--  - Tài khoản quản trị đầu tiên của doanh nghiệp mới tạo bằng provision_member (đã có từ bản setup),
--    chỉ quản trị 3A (platform_admins) được gọi cho doanh nghiệp chưa có thành viên.
-- =====================================================================

create or replace function public.tenant_brand(p_id text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'id', r.id,
           'name', coalesce(r.data->'org'->>'name', r.data->'org'->>'shortName'),
           'shortName', r.data->'org'->>'shortName',
           'domain', r.data->'org'->>'domain',
           'profile', r.data->'org'->>'profile',
           'color', r.data->'org'->>'color',
           'logo', r.data->'org'->>'logo')
  from public.records r
  where r.tenant_id = '_platform'
    and r.coll = 'tenants'
    and r.id = lower(trim(p_id))
    and not r.deleted
    and r.data ? 'org'
    and coalesce(r.data->>'status', 'ACTIVE') <> 'SUSPENDED'
  limit 1
$$;
revoke all on function public.tenant_brand(text) from public;
grant execute on function public.tenant_brand(text) to anon, authenticated;
