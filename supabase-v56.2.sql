-- =====================================================================
--  3A Platform — v56.2: Nhiệm vụ nội dung (Auto Content) dùng trường tùy chỉnh của 3A (entity 'content_task')
--  Chạy SAU supabase-v56.sql. Chạy lại nhiều lần không sao (chỉ thay hàm trigger).
--
--  1. Trigger records_cf_guard: nhận thêm coll 'mktTasks' -> entity 'content_task'.
--     Nhiệm vụ nội dung chỉ kiểm tra KIỂU dữ liệu của trường tùy chỉnh (số, ngày, danh sách chọn…) phía máy chủ.
--     "Bắt buộc" của nhiệm vụ nội dung nghĩa là "trước khi giao AI" (không chặn lưu nháp), nên kiểm tra ở bảng
--     Nhiệm vụ nội dung trước khi đưa vào hàng đợi soạn bài — máy chủ không chặn lưu khi còn thiếu.
--  2. Không đổi bảng, không đổi dữ liệu; không đổi RLS (mktTasks vẫn theo tenant_id như mọi coll của doanh nghiệp).
-- =====================================================================

create or replace function public.records_cf_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ent text; stage text; errs jsonb; old_cf jsonb; is_new boolean := false; prev record; leg jsonb; clash text;
begin
  if NEW.tenant_id = '_platform' or NEW.deleted then return NEW; end if;
  ent := case NEW.coll when 'salesOrders' then 'sale' when 'customers' then 'customer' when 'leads' then 'lead' when 'skus' then 'product'
    when 'mktTasks' then 'content_task' else null end;
  if ent is null then return NEW; end if;
  if public.is_platform_admin() then return NEW; end if;
  if TG_OP = 'INSERT' then
    select r.data, r.deleted into prev from public.records r where r.tenant_id = NEW.tenant_id and r.coll = NEW.coll and r.id = NEW.id;
    if found then
      if not prev.deleted then return NEW; end if;
    end if;
    select e into leg from public.records r, jsonb_array_elements(case when jsonb_typeof(r.data) = 'array' then r.data else '[]'::jsonb end) e
      where r.tenant_id = NEW.tenant_id and r.coll = '$' and r.id = NEW.coll and not r.deleted and e->>'id' = NEW.id limit 1;
    if leg is not null then old_cf := leg->'cf';
    else is_new := true; end if;
    if leg is not null then
      if ent = 'sale' and NEW.data->'approval'->>'status' = 'APPROVED' and coalesce(leg->'approval'->>'status', '') <> 'APPROVED' then stage := 'APPROVE';
      elsif (NEW.data->'cf') is distinct from old_cf then stage := 'SAVE';
      else return NEW; end if;
    end if;
  else
    if OLD.deleted then is_new := true; else old_cf := OLD.data->'cf'; end if;
  end if;
  if stage is null then
    if ent = 'sale' and NEW.data->'approval'->>'status' = 'APPROVED'
       and (is_new or coalesce(OLD.data->'approval'->>'status', '') <> 'APPROVED') then stage := 'APPROVE';
    elsif is_new or (NEW.data->'cf') is distinct from old_cf then stage := 'SAVE';
    else return NEW; end if;
  end if;
  -- v56.2 nhiệm vụ nội dung: chỉ kiểm tra kiểu dữ liệu ('TYPE' không xét bắt buộc trong validate_custom_fields)
  if ent = 'content_task' then
    if NEW.data->'cf' is null then return NEW; end if;
    stage := 'TYPE';
  end if;
  errs := public.validate_custom_fields(NEW.tenant_id, ent, stage, NEW.data->'cf', case when is_new then null else old_cf end);
  if jsonb_array_length(errs) > 0 then
    raise exception using errcode = 'P0001', message = 'CF_INVALID: ' || (errs->0->>'msg'), detail = errs::text, hint = format('%s/%s', NEW.coll, NEW.id);
  end if;
  -- v56: bản ghi đã hủy không giữ lịch; bản ghi đang dùng thì chặn trùng lịch tài nguyên
  if ent <> 'content_task' and coalesce(NEW.data->>'status', '') <> 'CANCELLED' then
    clash := public.cf_resource_conflict(NEW.tenant_id, NEW.coll, NEW.id, NEW.data->'cf', case when is_new then null else old_cf end);
    if clash is not null then
      raise exception using errcode = 'P0001', message = 'CF_INVALID: ' || clash, detail = jsonb_build_array(jsonb_build_object('code', 'RESOURCE_BUSY', 'msg', clash))::text, hint = format('%s/%s', NEW.coll, NEW.id);
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists records_cf_guard on public.records;
create trigger records_cf_guard before insert or update on public.records
  for each row execute function public.records_cf_guard();

-- =====================================================================
--  HOÀN TÁC (chỉ khi cần; chạy riêng): chạy lại supabase-v56.sql (trigger của v56 bỏ qua mktTasks).
-- =====================================================================
