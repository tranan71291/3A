-- =====================================================================
--  3A CRM v55.3 — KIỂM TRA TRƯỜNG TÙY CHỈNH PHÍA MÁY CHỦ
--  Chạy 1 lần SAU supabase-v55.1.sql: Supabase > SQL Editor > New query > dán > Run. Chạy lại nhiều lần vẫn an toàn.
--  Không đổi bảng, không sửa dữ liệu đang có.
--
--  1. validate_custom_fields(p_tenant_id, p_entity, p_stage, p_cf [, p_old_cf]) -> jsonb: danh sách lỗi (rỗng = hợp lệ)
--     - Đọc định nghĩa trường từ _platform/customFields: đúng đối tượng ('sale' | 'customer' | 'lead' | 'product'),
--       đầu đơn (scope HEAD), áp dụng cho doanh nghiệp (toàn hệ thống / đúng mô hình / chọn riêng).
--     - Kiểu dữ liệu (mọi trường có giá trị): number, money = số; date = YYYY-MM-DD hợp lệ; check = true/false;
--       text, user = chuỗi; select = nằm trong danh sách lựa chọn (chỉ xét khi giá trị đổi so với p_old_cf,
--       vì 3A bỏ lựa chọn không xóa giá trị cũ trong bản ghi).
--     - Bắt buộc (trường đang dùng):
--         p_stage 'SAVE'   : bắt buộc "Khi lưu", có cờ "Form", không chỉ đọc trong bố cục form
--         p_stage 'APPROVE': bắt buộc "Khi lưu" hoặc "Khi duyệt"
--       Bắt buộc lấy theo bố cục form 3A đã phát hành cho doanh nghiệp (requiredOverride, readOnly), giống hệt app.
--  2. Trigger records_cf_guard trên public.records (bảng dữ liệu doanh nghiệp): chặn ghi bản ghi sai kể cả khi gọi thẳng API.
--     Chỉ kiểm tra khi: tạo bản ghi mới, sửa giá trị cf, hoặc đơn bán chuyển sang "Đã duyệt" (bước APPROVE).
--     Bản ghi cũ thiếu trường mới đặt bắt buộc vẫn ghi thu tiền / xuất kho / sửa thông tin khác bình thường.
--     Bỏ qua: dòng đánh dấu xóa, dữ liệu nền tảng (_platform), thao tác của quản trị 3A (khôi phục sao lưu, hỗ trợ).
--     Lỗi trả về mã P0001, thông điệp bắt đầu bằng 'CF_INVALID:'.
-- =====================================================================

-- Mô hình của một doanh nghiệp: 'TRADING' | 'MFG' (hồ sơ tenants; DN có sẵn chưa có hồ sơ: alux = Sản xuất)
create or replace function public.cf_tenant_profile(t text) returns text
language sql stable security definer set search_path = public as $$
  select case coalesce((select r.data->'org'->>'profile' from public.records r
                        where r.tenant_id = '_platform' and r.coll = 'tenants' and r.id = t and not r.deleted),
                       case when t = 'alux' then 'MANUFACTURING' else 'TRADING' end)
           when 'MANUFACTURING' then 'MFG' else 'TRADING' end
$$;

-- Trường áp dụng cho doanh nghiệp: toàn hệ thống | đúng mô hình | chọn riêng (giống cfApplies trong app)
create or replace function public.cf_applies(d jsonb, t text, prof text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce((d->'levels'->>'sys')::boolean, false)
      or (prof = 'MFG' and coalesce((d->'levels'->>'mfg')::boolean, false))
      or (prof = 'TRADING' and coalesce((d->'levels'->>'tr')::boolean, false))
      or coalesce(d->'levels'->'tenants', '[]'::jsonb) ? t
$$;

-- Ô trường của khối Form (K-RecordForm) trong bố cục form đang áp dụng cho doanh nghiệp
-- (riêng DN → mô hình → toàn hệ thống; vai trò của người ghi trước, chung sau — như useTenantLayout trong app)
create or replace function public.cf_form_items(t text, p_entity text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  pg text := case p_entity when 'sale' then 'sale-form' when 'customer' then 'customer-detail' when 'lead' then 'lead-detail' else null end;
  prof text := public.cf_tenant_profile(t);
  rl text;
  ver text;
begin
  if pg is null then return '[]'::jsonb; end if;
  begin rl := public.member_role(t); exception when others then rl := null; end;
  select a.data->>'verId' into ver
  from public.records a
  where a.tenant_id = '_platform' and a.coll = 'layoutAssigns' and not a.deleted and a.data->>'page' = pg
    and (a.data->>'level' = 'SYSTEM'
      or (a.data->>'level' = 'PROFILE' and a.data->>'profile' = prof)
      or (a.data->>'level' = 'TENANT' and a.data->>'tenantId' = t))
    and (a.data->>'role' is null or a.data->>'role' = rl)
  order by case a.data->>'level' when 'TENANT' then 0 when 'PROFILE' then 1 else 2 end, (a.data->>'role' is null)
  limit 1;
  if ver is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(f)
    from public.records l,
         jsonb_array_elements(coalesce(l.data->'blocks', '[]'::jsonb)) b,
         jsonb_array_elements(coalesce(b->'config'->'sections', '[]'::jsonb)) s,
         jsonb_array_elements(coalesce(s->'fields', '[]'::jsonb)) f
    where l.tenant_id = '_platform' and l.coll = 'layouts' and l.id = ver and not l.deleted and b->>'type' = 'K-RecordForm'
  ), '[]'::jsonb);
end $$;

-- Giá trị trống (tích chọn bắt buộc: phải là true)
create or replace function public.cf_is_empty(v jsonb, typ text) returns boolean
language sql immutable set search_path = public as $$
  select case when typ = 'check' then v is null or v <> 'true'::jsonb
              else v is null or jsonb_typeof(v) = 'null' or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '') end
$$;

create or replace function public.validate_custom_fields(p_tenant_id text, p_entity text, p_stage text, p_cf jsonb, p_old_cf jsonb default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  prof text := public.cf_tenant_profile(p_tenant_id);
  items jsonb := public.cf_form_items(p_tenant_id, p_entity);
  cf jsonb := coalesce(p_cf, '{}'::jsonb);
  errs jsonb := '[]'::jsonb;
  d jsonb; k text; typ text; lab text; v jsonb; it jsonb; req text; ro boolean; ok boolean;
begin
  if jsonb_typeof(cf) <> 'object' then
    return jsonb_build_array(jsonb_build_object('key', '', 'code', 'TYPE', 'msg', 'Trường tùy chỉnh (cf) phải là đối tượng JSON'));
  end if;
  for d in
    select r.data from public.records r
    where r.tenant_id = '_platform' and r.coll = 'customFields' and not r.deleted
      and r.data->>'entity' = p_entity and coalesce(r.data->>'scope', 'HEAD') = 'HEAD'
  loop
    if not public.cf_applies(d, p_tenant_id, prof) then continue; end if;
    k := d->>'key'; typ := d->>'type'; lab := coalesce(d->>'label', k);
    v := cf -> k;
    -- Kiểu dữ liệu
    if v is not null and jsonb_typeof(v) <> 'null' then
      ok := case typ
        when 'number' then jsonb_typeof(v) = 'number'
        when 'money' then jsonb_typeof(v) = 'number'
        when 'check' then jsonb_typeof(v) = 'boolean'
        when 'date' then jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
        when 'select' then jsonb_typeof(v) = 'string'
        else jsonb_typeof(v) = 'string' end;
      if ok and typ = 'date' then
        begin perform (v #>> '{}')::date; exception when others then ok := false; end;
      end if;
      if ok and typ = 'select' and (p_old_cf is null or (p_old_cf -> k) is distinct from v)
         and not coalesce(d->'options', '[]'::jsonb) ? (v #>> '{}') then
        errs := errs || jsonb_build_object('key', k, 'code', 'OPTION', 'msg', format('%s: "%s" không có trong danh sách chọn', lab, v #>> '{}'));
      elsif not ok then
        errs := errs || jsonb_build_object('key', k, 'code', 'TYPE', 'msg', format('%s: sai kiểu dữ liệu (cần %s)', lab,
          case typ when 'number' then 'số' when 'money' then 'số tiền' when 'date' then 'ngày YYYY-MM-DD' when 'check' then 'true/false' else 'chữ' end));
      end if;
    end if;
    -- Bắt buộc
    if coalesce(d->>'status', 'ACTIVE') <> 'ACTIVE' then continue; end if;
    select x into it from jsonb_array_elements(items) x where x->>'fieldKey' = 'cf:' || k limit 1;
    req := coalesce(it->>'requiredOverride', d->>'required', 'NONE');
    ro := coalesce((it->>'readOnly')::boolean, false);
    if p_stage = 'SAVE' then
      if req = 'SAVE' and coalesce((d->'where'->>'form')::boolean, false) and not ro and public.cf_is_empty(v, typ) then
        errs := errs || jsonb_build_object('key', k, 'code', 'REQUIRED', 'msg', format('%s %s', case when typ = 'check' then 'Cần tích' else 'Nhập' end, lab));
      end if;
    elsif p_stage = 'APPROVE' then
      if req in ('SAVE', 'APPROVE') and public.cf_is_empty(v, typ) then
        errs := errs || jsonb_build_object('key', k, 'code', 'REQUIRED', 'msg', format('Thiếu %s để duyệt', lab));
      end if;
    end if;
  end loop;
  return errs;
end $$;
revoke all on function public.validate_custom_fields(text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.validate_custom_fields(text, text, text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Trigger: chặn ghi bản ghi có trường tùy chỉnh sai (kể cả gọi thẳng REST API)
-- ---------------------------------------------------------------------
create or replace function public.records_cf_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ent text; stage text; errs jsonb; old_cf jsonb; is_new boolean := false; prev record; leg jsonb;
begin
  if NEW.tenant_id = '_platform' or NEW.deleted then return NEW; end if;
  ent := case NEW.coll when 'salesOrders' then 'sale' when 'customers' then 'customer' when 'leads' then 'lead' when 'skus' then 'product' else null end;
  if ent is null then return NEW; end if;
  if public.is_platform_admin() then return NEW; end if;
  if TG_OP = 'INSERT' then
    -- upsert (insert ... on conflict do update): dòng đã có thì để trigger UPDATE xét
    select r.data, r.deleted into prev from public.records r where r.tenant_id = NEW.tenant_id and r.coll = NEW.coll and r.id = NEW.id;
    if found then
      if not prev.deleted then return NEW; end if;
    end if;
    -- chuyển đổi dữ liệu cũ (v55.1): đơn còn trong dòng gộp '$' là bản ghi đã có, không phải đơn mới
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
  errs := public.validate_custom_fields(NEW.tenant_id, ent, stage, NEW.data->'cf', case when is_new then null else old_cf end);
  if jsonb_array_length(errs) > 0 then
    raise exception using errcode = 'P0001', message = 'CF_INVALID: ' || (errs->0->>'msg'), detail = errs::text, hint = format('%s/%s', NEW.coll, NEW.id);
  end if;
  return NEW;
end $$;

drop trigger if exists records_cf_guard on public.records;
create trigger records_cf_guard before insert or update on public.records
  for each row execute function public.records_cf_guard();

-- =====================================================================
--  HOÀN TÁC (chỉ khi cần; chạy riêng):
--    drop trigger if exists records_cf_guard on public.records;
--    drop function if exists public.records_cf_guard();
--    drop function if exists public.validate_custom_fields(text, text, text, jsonb, jsonb);
--    drop function if exists public.cf_form_items(text, text);
--    drop function if exists public.cf_is_empty(jsonb, text);
--    drop function if exists public.cf_applies(jsonb, text, text);
--    drop function if exists public.cf_tenant_profile(text);
-- =====================================================================
