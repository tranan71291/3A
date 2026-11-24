-- =====================================================================
--  3A CRM v56 — ĐỘNG CƠ ĐA NGÀNH (VERTICAL ENGINE) PHÍA MÁY CHỦ
--  Chạy 1 lần SAU supabase-v55.3.sql: Supabase > SQL Editor > New query > dán > Run. Chạy lại nhiều lần vẫn an toàn.
--  Không đổi bảng, không sửa / xóa dữ liệu doanh nghiệp đang có.
--
--  1. validate_custom_fields: thêm kiểu trường chuyên ngành
--       datetime_range  = chuỗi "YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm", kết thúc sau bắt đầu
--       resource_picker = chuỗi mã tài nguyên
--       formula         = số (app tự tính)
--       checklist       = chuỗi JSON mảng tên công đoạn
--       media_gallery   = chuỗi JSON mảng ảnh {url, path?...}
--       signature       = chuỗi JSON {url, sha256 (64 ký tự hex), at}
--  2. cf_resource_conflict: chống trùng lịch tài nguyên (đội thợ, xe, phòng chụp…) — cùng doanh nghiệp, cùng loại bản ghi,
--     cùng trường chọn tài nguyên, khoảng thời gian giao nhau, bản ghi chưa xóa / chưa hủy. Khóa giao dịch theo tài nguyên
--     (pg_advisory_xact_lock) để 2 người lưu cùng lúc không cùng chiếm một lịch.
--  3. Trigger records_cf_guard: gọi thêm kiểm tra trùng lịch khi tạo mới / sửa trường tùy chỉnh. Lỗi trả mã P0001,
--     thông điệp bắt đầu bằng 'CF_INVALID:' (app đã hiểu mã này từ v55.3, giữ bản ghi chờ gửi và báo người dùng).
--  4. Nạp hồ sơ ngành vào _platform / industryProfiles: thương mại, sản xuất & lắp đặt (đủ bộ trường + bố cục mẫu),
--     studio ảnh, thuê xe, đặt lịch, căng tin (hạ tầng: thuật ngữ, trạng thái, loại tài nguyên). Chỉ thêm khi chưa có:
--     3A đã sửa hồ sơ ngành trong Console thì giữ nguyên bản của 3A.
--  Quyền đọc: người dùng doanh nghiệp đọc được industryProfiles dùng chung (đã mở ở v55.1, platform_row_visible).
-- =====================================================================

-- Đọc chuỗi JSON an toàn (sai cú pháp = null)
create or replace function public.cf_json(s text) returns jsonb
language plpgsql immutable set search_path = public as $$
begin
  return s::jsonb;
exception when others then
  return null;
end $$;

-- Khoảng thời gian "YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm" -> tsrange (sai định dạng = null)
create or replace function public.cf_range(s text) returns tsrange
language plpgsql immutable set search_path = public as $$
declare a text; b text;
begin
  if s is null or s !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then return null; end if;
  a := split_part(s, '/', 1); b := split_part(s, '/', 2);
  if b::timestamp <= a::timestamp then return null; end if;
  return tsrange(a::timestamp, b::timestamp, '[)');
exception when others then
  return null;
end $$;

-- Kiểu dữ liệu một giá trị trường (true = hợp lệ)
create or replace function public.cf_type_ok(typ text, v jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
declare j jsonb;
begin
  case typ
    when 'number', 'money', 'formula' then return jsonb_typeof(v) = 'number';
    when 'check' then return jsonb_typeof(v) = 'boolean';
    when 'date' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
      perform (v #>> '{}')::date; return true;
    when 'datetime_range' then return jsonb_typeof(v) = 'string' and public.cf_range(v #>> '{}') is not null;
    when 'checklist' then
      if jsonb_typeof(v) <> 'string' then return false; end if;
      j := public.cf_json(v #>> '{}');
      return j is not null and jsonb_typeof(j) = 'array' and not exists (select 1 from jsonb_array_elements(j) e where jsonb_typeof(e) <> 'string');
    when 'media_gallery' then
      if jsonb_typeof(v) <> 'string' then return false; end if;
      j := public.cf_json(v #>> '{}');
      return j is not null and jsonb_typeof(j) = 'array' and not exists (select 1 from jsonb_array_elements(j) e where jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'url') <> 'string' or (e->>'url') like 'data:%' and length(e->>'url') > 400000);
    when 'signature' then
      if jsonb_typeof(v) <> 'string' then return false; end if;
      j := public.cf_json(v #>> '{}');
      return j is not null and jsonb_typeof(j) = 'object' and jsonb_typeof(j->'url') = 'string' and coalesce(j->>'sha256', '') ~ '^[0-9a-f]{64}$';
    else return jsonb_typeof(v) = 'string';
  end case;
exception when others then
  return false;
end $$;

create or replace function public.cf_type_need(typ text) returns text
language sql immutable set search_path = public as $$
  select case typ when 'number' then 'số' when 'money' then 'số tiền' when 'formula' then 'số' when 'date' then 'ngày YYYY-MM-DD' when 'check' then 'true/false'
    when 'datetime_range' then 'khoảng thời gian bắt đầu/kết thúc' when 'checklist' then 'danh sách công đoạn' when 'media_gallery' then 'danh sách ảnh'
    when 'signature' then 'chữ ký có mã SHA-256' else 'chữ' end
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
    -- Kiểu dữ liệu (chỉ xét khi giá trị đổi so với bản cũ: 3A đổi định nghĩa không chặn bản ghi cũ)
    if v is not null and jsonb_typeof(v) <> 'null' and (p_old_cf is null or (p_old_cf -> k) is distinct from v) then
      ok := public.cf_type_ok(typ, v);
      if ok and typ = 'select' and not coalesce(d->'options', '[]'::jsonb) ? (v #>> '{}') then
        errs := errs || jsonb_build_object('key', k, 'code', 'OPTION', 'msg', format('%s: "%s" không có trong danh sách chọn', lab, v #>> '{}'));
      elsif not ok then
        errs := errs || jsonb_build_object('key', k, 'code', 'TYPE', 'msg', format('%s: sai kiểu dữ liệu (cần %s)', lab, public.cf_type_need(typ)));
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
-- Chống trùng lịch tài nguyên: thông điệp lỗi đầu tiên (null = không trùng)
-- ---------------------------------------------------------------------
create or replace function public.cf_resource_conflict(p_tenant_id text, p_coll text, p_id text, p_cf jsonb, p_old_cf jsonb default null)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  ent text := case p_coll when 'salesOrders' then 'sale' when 'customers' then 'customer' when 'leads' then 'lead' else null end;
  prof text := public.cf_tenant_profile(p_tenant_id);
  d jsonb; k text; rk text; res text; rg tsrange; hit record; nm text;
begin
  if ent is null or p_cf is null or jsonb_typeof(p_cf) <> 'object' then return null; end if;
  for d in
    select r.data from public.records r
    where r.tenant_id = '_platform' and r.coll = 'customFields' and not r.deleted
      and r.data->>'entity' = ent and r.data->>'type' = 'resource_picker' and coalesce(r.data->>'status', 'ACTIVE') = 'ACTIVE'
      and coalesce(r.data->>'rangeKey', '') <> ''
  loop
    if not public.cf_applies(d, p_tenant_id, prof) then continue; end if;
    k := d->>'key'; rk := d->>'rangeKey';
    res := p_cf->>k; rg := public.cf_range(p_cf->>rk);
    if res is null or res = '' or rg is null then continue; end if;
    -- không đổi tài nguyên lẫn thời gian: bản ghi cũ giữ nguyên (không chặn sửa thông tin khác)
    if p_old_cf is not null and (p_old_cf->>k) is not distinct from res and (p_old_cf->>rk) is not distinct from (p_cf->>rk) then continue; end if;
    perform pg_advisory_xact_lock(hashtext(p_tenant_id || '|' || p_coll || '|' || k || '|' || res));
    select r.id, coalesce(r.data->>'code', r.data->>'name', r.id) as code, r.data->'cf'->>rk as rng into hit
    from public.records r
    where r.tenant_id = p_tenant_id and r.coll = p_coll and r.id <> p_id and not r.deleted
      and coalesce(r.data->>'status', '') <> 'CANCELLED'
      and r.data->'cf'->>k = res
      and public.cf_range(r.data->'cf'->>rk) && rg
    limit 1;
    if found then
      select coalesce(x.data->>'name', res) into nm from public.records x where x.tenant_id = p_tenant_id and x.coll = 'resources' and x.id = res and not x.deleted;
      return format('%s: %s đã có lịch trùng giờ ở %s (%s)', coalesce(d->>'label', k), coalesce(nm, res), hit.code, replace(replace(coalesce(hit.rng, ''), 'T', ' '), '/', ' – '));
    end if;
  end loop;
  return null;
end $$;
revoke all on function public.cf_resource_conflict(text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.cf_resource_conflict(text, text, text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Trigger: như v55.3 + kiểm tra trùng lịch tài nguyên
-- ---------------------------------------------------------------------
create or replace function public.records_cf_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ent text; stage text; errs jsonb; old_cf jsonb; is_new boolean := false; prev record; leg jsonb; clash text;
begin
  if NEW.tenant_id = '_platform' or NEW.deleted then return NEW; end if;
  ent := case NEW.coll when 'salesOrders' then 'sale' when 'customers' then 'customer' when 'leads' then 'lead' when 'skus' then 'product' else null end;
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
  errs := public.validate_custom_fields(NEW.tenant_id, ent, stage, NEW.data->'cf', case when is_new then null else old_cf end);
  if jsonb_array_length(errs) > 0 then
    raise exception using errcode = 'P0001', message = 'CF_INVALID: ' || (errs->0->>'msg'), detail = errs::text, hint = format('%s/%s', NEW.coll, NEW.id);
  end if;
  -- v56: bản ghi đã hủy không giữ lịch; bản ghi đang dùng thì chặn trùng lịch tài nguyên
  if coalesce(NEW.data->>'status', '') <> 'CANCELLED' then
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

-- ---------------------------------------------------------------------
-- Hồ sơ ngành (sinh từ src/crm/lib/industry.ts — INDUSTRY_BUILTIN). Chỉ thêm khi chưa có.
-- ---------------------------------------------------------------------
insert into public.records (tenant_id, coll, id, data)
select '_platform', 'industryProfiles', e->>'id', e
from jsonb_array_elements($seed$
[{"id":"trade","label":"Phân phối thương mại","desc":"Bán buôn, đại lý, giao hàng theo tuyến, công nợ theo hạn mức","ready":true,"terms":{},"workflowStates":[{"id":"quote","label":"Báo giá","tone":"muted"},{"id":"approve","label":"Chờ duyệt","tone":"orange"},{"id":"issue","label":"Chờ xuất kho","tone":"blue"},{"id":"ship","label":"Đang giao","tone":"blue"},{"id":"done","label":"Hoàn thành","tone":"teal"}],"resourceKinds":[{"id":"xe_giao","label":"Xe giao hàng"}],"cfTemplates":[{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":true,"filter":true},"key":"tuyen_giao","label":"Tuyến giao","type":"select","options":["Nội thành","Miền Đông","Miền Tây","Miền Trung","Miền Bắc"]},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":false,"filter":false},"key":"xe_giao","label":"Xe giao hàng","type":"resource_picker","resourceKind":"xe_giao","rangeKey":"khung_giao"},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":false,"filter":false},"key":"khung_giao","label":"Khung giờ giao","type":"datetime_range"},{"entity":"customer","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":true,"filter":false},"key":"han_no_ngay","label":"Thời hạn nợ","type":"number","unit":"ngày"}],"layoutTemplates":[{"page":"sale-list","blocks":[{"id":"tr-sl","type":"K-SaleList","pos":{"lg":{"x":0,"y":0,"w":12,"h":8},"sm":{"w":12,"order":1}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Danh sách đơn hàng","ds":"sales"}}]},{"page":"sale-detail","blocks":[{"id":"tr-sd","type":"K-RecordDetail","pos":{"lg":{"x":0,"y":0,"w":8,"h":3},"sm":{"w":12,"order":1}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Thông tin đơn hàng","ds":"sales","entity":"sale","sections":[{"id":"tr-sd-s1","title":"","cols":4,"fields":[{"id":"tr-sd-cus","fieldKey":"customer","colSpan":6},{"id":"tr-sd-code","fieldKey":"code","colSpan":3},{"id":"tr-sd-by","fieldKey":"by","colSpan":3},{"id":"tr-sd-wh","fieldKey":"wh","colSpan":3,"labelOverride":"Kho xuất"},{"id":"tr-sd-tg","fieldKey":"cf:tuyen_giao","colSpan":3},{"id":"tr-sd-or","fieldKey":"origin","colSpan":3},{"id":"tr-sd-inv","fieldKey":"invNo","colSpan":3}]},{"id":"tr-sd-s2","title":"Giao hàng","cols":2,"fields":[{"id":"tr-sd-xe","fieldKey":"cf:xe_giao","colSpan":6},{"id":"tr-sd-kg","fieldKey":"cf:khung_giao","colSpan":6}]}]}},{"id":"tr-sd-flow","type":"K-Order-Flow","pos":{"lg":{"x":8,"y":0,"w":4,"h":3},"sm":{"w":12,"order":2}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Quy trình xử lý","ds":"sales"}},{"id":"tr-sd-lines","type":"K-Order-Lines","pos":{"lg":{"x":0,"y":3,"w":8,"h":5},"sm":{"w":12,"order":3}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Hàng hóa & chứng từ","ds":"sales"}},{"id":"tr-sd-pay","type":"K-Order-Pay","pos":{"lg":{"x":8,"y":3,"w":4,"h":4},"sm":{"w":12,"order":4}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Thanh toán","ds":"sales"}},{"id":"tr-sd-profit","type":"K-Order-Profit","pos":{"lg":{"x":8,"y":7,"w":4,"h":3},"sm":{"w":12,"order":5}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Lãi trên đơn","ds":"sales"}},{"id":"tr-sd-log","type":"K-Order-Log","pos":{"lg":{"x":0,"y":8,"w":8,"h":4},"sm":{"w":12,"order":6}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Trao đổi & nhật ký","ds":"sales"}},{"id":"tr-sd-debt","type":"K-Order-Debt","pos":{"lg":{"x":8,"y":10,"w":4,"h":2},"sm":{"w":12,"order":7}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Công nợ khách","ds":"sales"}}]},{"page":"sale-form","blocks":[{"id":"tr-sf","type":"K-RecordForm","pos":{"lg":{"x":0,"y":0,"w":12,"h":4},"sm":{"w":12,"order":1}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Giao hàng","ds":"sales","entity":"sale","sections":[{"id":"tr-sf-s1","title":"","cols":3,"fields":[{"id":"tr-sf-tg","fieldKey":"cf:tuyen_giao","colSpan":4},{"id":"tr-sf-xe","fieldKey":"cf:xe_giao","colSpan":4},{"id":"tr-sf-kg","fieldKey":"cf:khung_giao","colSpan":4}]}]}}]},{"page":"customer-list","blocks":[{"id":"tr-cl","type":"K-RecordList","pos":{"lg":{"x":0,"y":0,"w":12,"h":8},"sm":{"w":12,"order":1}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Danh sách khách hàng","ds":"customers","entity":"customer"}}]},{"page":"customer-detail","blocks":[{"id":"tr-cd","type":"K-RecordDetail","pos":{"lg":{"x":0,"y":0,"w":12,"h":3},"sm":{"w":12,"order":1}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Công nợ","ds":"customers","entity":"customer","sections":[{"id":"tr-cd-s1","title":"","cols":3,"fields":[{"id":"tr-cd-hm","fieldKey":"creditLimit","colSpan":4,"labelOverride":"Hạn mức nợ"},{"id":"tr-cd-debt","fieldKey":"debt","colSpan":4},{"id":"tr-cd-hn","fieldKey":"cf:han_no_ngay","colSpan":4}]}]}},{"id":"tr-cf","type":"K-RecordForm","pos":{"lg":{"x":0,"y":3,"w":12,"h":4},"sm":{"w":12,"order":2}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Thông tin thêm (form)","ds":"customers","entity":"customer","sections":[{"id":"tr-cf-s1","title":"","cols":2,"fields":[{"id":"tr-cf-hn","fieldKey":"cf:han_no_ngay","colSpan":6}]}]}}]}],"at":0,"by":"seed-v56"},{"id":"mfg_install","label":"Sản xuất & lắp đặt","desc":"Gia công tại xưởng, lắp đặt tại công trình, nghiệm thu có ảnh và chữ ký","ready":true,"terms":{"module.sales":"Lệnh SX & lắp đặt","sale":"Lệnh sản xuất & lắp đặt","saleShort":"Lệnh","saleList":"Quản lý lệnh sản xuất & lắp đặt","newSale":"Tạo lệnh","createSale":"Tạo lệnh sản xuất & lắp đặt","editSale":"Sửa lệnh","resource":"Đội thợ"},"workflowStates":[{"id":"survey","label":"Khảo sát","tone":"muted"},{"id":"quote","label":"Thiết kế & báo giá","tone":"muted"},{"id":"make","label":"Sản xuất","tone":"blue"},{"id":"install","label":"Lắp đặt","tone":"orange"},{"id":"accept","label":"Nghiệm thu","tone":"orange"},{"id":"done","label":"Hoàn thành","tone":"teal"}],"resourceKinds":[{"id":"doi_tho","label":"Đội thợ lắp đặt"},{"id":"xe_tai","label":"Xe tải chở hàng"}],"cfTemplates":[{"entity":"sale","scope":"HEAD","required":"SAVE","where":{"form":true,"info":true,"list":true,"filter":false},"key":"dia_chi_cong_trinh","label":"Địa chỉ công trình","type":"text"},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":true,"filter":false},"key":"khoi_luong_m2","label":"Khối lượng","type":"number","unit":"m²"},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":false,"filter":false},"key":"don_gia_lap_dat","label":"Đơn giá lắp đặt / m²","type":"money"},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":false,"filter":false},"key":"gia_tri_lap_dat","label":"Giá trị lắp đặt","type":"formula","formula":"khoi_luong_m2 * don_gia_lap_dat","unit":"đ"},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":true,"filter":false},"key":"lich_lap_dat","label":"Lịch lắp đặt","type":"datetime_range"},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":true,"filter":false},"key":"doi_lap_dat","label":"Đội lắp đặt","type":"resource_picker","resourceKind":"doi_tho","rangeKey":"lich_lap_dat"},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":false,"filter":false},"key":"checklist_ky_thuat","label":"Checklist kỹ thuật","type":"checklist","options":["Khảo sát hiện trạng","Đo đạc kích thước","Gia công tại xưởng","Vận chuyển đến công trình","Lắp khung","Lắp kính và phụ kiện","Vệ sinh, bàn giao"]},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":false,"filter":false},"key":"anh_nghiem_thu","label":"Ảnh nghiệm thu","type":"media_gallery"},{"entity":"sale","scope":"HEAD","required":"NONE","where":{"form":true,"info":true,"list":false,"filter":false},"key":"chu_ky_nghiem_thu","label":"Chữ ký nghiệm thu","type":"signature"}],"layoutTemplates":[{"page":"sale-list","blocks":[{"id":"mf-sl","type":"K-SaleList","pos":{"lg":{"x":0,"y":0,"w":12,"h":8},"sm":{"w":12,"order":1}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Danh sách lệnh","ds":"sales"}}]},{"page":"sale-detail","blocks":[{"id":"mf-sd","type":"K-RecordDetail","pos":{"lg":{"x":0,"y":0,"w":8,"h":7},"sm":{"w":12,"order":1}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Thông tin lệnh","ds":"sales","entity":"sale","sections":[{"id":"mf-sd-s1","title":"","cols":4,"fields":[{"id":"mf-sd-cus","fieldKey":"customer","colSpan":6},{"id":"mf-sd-code","fieldKey":"code","colSpan":2},{"id":"mf-sd-by","fieldKey":"by","colSpan":2},{"id":"mf-sd-wh","fieldKey":"wh","colSpan":2}]},{"id":"mf-sd-s2","title":"Công trình","cols":3,"fields":[{"id":"mf-sd-dc","fieldKey":"cf:dia_chi_cong_trinh","colSpan":12},{"id":"mf-sd-kl","fieldKey":"cf:khoi_luong_m2","colSpan":4},{"id":"mf-sd-dg","fieldKey":"cf:don_gia_lap_dat","colSpan":4},{"id":"mf-sd-gt","fieldKey":"cf:gia_tri_lap_dat","colSpan":4}]},{"id":"mf-sd-s3","title":"Lắp đặt","cols":2,"fields":[{"id":"mf-sd-lich","fieldKey":"cf:lich_lap_dat","colSpan":6},{"id":"mf-sd-doi","fieldKey":"cf:doi_lap_dat","colSpan":6}]},{"id":"mf-sd-s4","title":"Nghiệm thu","cols":1,"fields":[{"id":"mf-sd-ck","fieldKey":"cf:checklist_ky_thuat","colSpan":12},{"id":"mf-sd-anh","fieldKey":"cf:anh_nghiem_thu","colSpan":12},{"id":"mf-sd-ky","fieldKey":"cf:chu_ky_nghiem_thu","colSpan":12}]}]}},{"id":"mf-sd-flow","type":"K-Order-Flow","pos":{"lg":{"x":8,"y":0,"w":4,"h":3},"sm":{"w":12,"order":2}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Quy trình xử lý","ds":"sales"}},{"id":"mf-sd-pay","type":"K-Order-Pay","pos":{"lg":{"x":8,"y":3,"w":4,"h":4},"sm":{"w":12,"order":3}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Thanh toán","ds":"sales"}},{"id":"mf-sd-lines","type":"K-Order-Lines","pos":{"lg":{"x":0,"y":7,"w":8,"h":5},"sm":{"w":12,"order":4}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Hàng hóa & chứng từ","ds":"sales"}},{"id":"mf-sd-profit","type":"K-Order-Profit","pos":{"lg":{"x":8,"y":7,"w":4,"h":3},"sm":{"w":12,"order":5}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Lãi trên đơn","ds":"sales"}},{"id":"mf-sd-debt","type":"K-Order-Debt","pos":{"lg":{"x":8,"y":10,"w":4,"h":2},"sm":{"w":12,"order":6}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Công nợ khách","ds":"sales"}},{"id":"mf-sd-log","type":"K-Order-Log","pos":{"lg":{"x":0,"y":12,"w":8,"h":4},"sm":{"w":12,"order":7}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Trao đổi & nhật ký","ds":"sales"}}]},{"page":"sale-form","blocks":[{"id":"mf-sf","type":"K-RecordForm","pos":{"lg":{"x":0,"y":0,"w":12,"h":6},"sm":{"w":12,"order":1}},"show":{"lg":true,"md":true,"sm":true},"config":{"title":"Công trình & lắp đặt","ds":"sales","entity":"sale","sections":[{"id":"mf-sf-s1","title":"Công trình","cols":3,"fields":[{"id":"mf-sf-dc","fieldKey":"cf:dia_chi_cong_trinh","colSpan":12,"placeholder":"Số nhà, đường, phường / xã, tỉnh"},{"id":"mf-sf-kl","fieldKey":"cf:khoi_luong_m2","colSpan":4},{"id":"mf-sf-dg","fieldKey":"cf:don_gia_lap_dat","colSpan":4},{"id":"mf-sf-gt","fieldKey":"cf:gia_tri_lap_dat","colSpan":4,"readOnly":true,"helpText":"Tự tính = Khối lượng × Đơn giá"}]},{"id":"mf-sf-s2","title":"Lắp đặt","cols":2,"fields":[{"id":"mf-sf-lich","fieldKey":"cf:lich_lap_dat","colSpan":6},{"id":"mf-sf-doi","fieldKey":"cf:doi_lap_dat","colSpan":6,"helpText":"Hệ thống chặn đội đã có lịch trùng giờ"}]},{"id":"mf-sf-s3","title":"Nghiệm thu","cols":1,"fields":[{"id":"mf-sf-ck","fieldKey":"cf:checklist_ky_thuat","colSpan":12},{"id":"mf-sf-anh","fieldKey":"cf:anh_nghiem_thu","colSpan":12},{"id":"mf-sf-ky","fieldKey":"cf:chu_ky_nghiem_thu","colSpan":12}]}]}}]}],"at":0,"by":"seed-v56"},{"id":"studio","label":"Studio ảnh","desc":"Lịch chụp theo phòng và nhiếp ảnh gia, hậu kỳ, giao ảnh","ready":false,"terms":{"module.sales":"Lịch chụp","sale":"Lịch chụp","saleShort":"Lịch chụp","saleList":"Quản lý lịch chụp","newSale":"Đặt lịch chụp","createSale":"Đặt lịch chụp","editSale":"Sửa lịch chụp","resource":"Phòng chụp"},"workflowStates":[{"id":"book","label":"Đặt lịch","tone":"muted"},{"id":"shoot","label":"Chụp","tone":"blue"},{"id":"edit","label":"Hậu kỳ","tone":"orange"},{"id":"deliver","label":"Giao ảnh","tone":"teal"}],"resourceKinds":[{"id":"phong_chup","label":"Phòng chụp"},{"id":"nhiep_anh","label":"Nhiếp ảnh gia"}],"cfTemplates":[],"layoutTemplates":[],"at":0,"by":"seed-v56"},{"id":"car_rental","label":"Thuê xe","desc":"Hợp đồng thuê theo giờ / ngày, giao nhận xe, chống trùng lịch xe","ready":false,"terms":{"module.sales":"Thuê xe","sale":"Hợp đồng thuê xe","saleShort":"Hợp đồng","saleList":"Quản lý hợp đồng thuê xe","newSale":"Lập hợp đồng","createSale":"Lập hợp đồng thuê xe","editSale":"Sửa hợp đồng","resource":"Xe"},"workflowStates":[{"id":"book","label":"Đặt xe","tone":"muted"},{"id":"handover","label":"Giao xe","tone":"blue"},{"id":"renting","label":"Đang thuê","tone":"orange"},{"id":"return","label":"Nhận lại xe","tone":"blue"},{"id":"settle","label":"Quyết toán","tone":"teal"}],"resourceKinds":[{"id":"xe","label":"Xe cho thuê"}],"cfTemplates":[],"layoutTemplates":[],"at":0,"by":"seed-v56"},{"id":"booking","label":"Đặt lịch dịch vụ","desc":"Lịch hẹn theo nhân viên / phòng, xác nhận, phục vụ","ready":false,"terms":{"module.sales":"Lịch hẹn","sale":"Lịch hẹn","saleShort":"Lịch hẹn","saleList":"Quản lý lịch hẹn","newSale":"Đặt lịch hẹn","createSale":"Đặt lịch hẹn","editSale":"Sửa lịch hẹn","resource":"Nhân viên phục vụ"},"workflowStates":[{"id":"book","label":"Đặt lịch","tone":"muted"},{"id":"confirm","label":"Xác nhận","tone":"blue"},{"id":"serve","label":"Đang phục vụ","tone":"orange"},{"id":"done","label":"Hoàn thành","tone":"teal"}],"resourceKinds":[{"id":"nhan_vien","label":"Nhân viên phục vụ"},{"id":"phong","label":"Phòng / ghế"}],"cfTemplates":[],"layoutTemplates":[],"at":0,"by":"seed-v56"},{"id":"canteen","label":"Căng tin","desc":"Bán suất ăn theo ca, chốt ca nhanh tại quầy","ready":false,"terms":{"module.sales":"Bán suất","sale":"Phiếu bán suất","saleShort":"Phiếu","saleList":"Quản lý phiếu bán suất","newSale":"Bán suất","createSale":"Lập phiếu bán suất","editSale":"Sửa phiếu","resource":"Quầy"},"workflowStates":[{"id":"open","label":"Mở ca","tone":"muted"},{"id":"selling","label":"Đang bán","tone":"orange"},{"id":"close","label":"Chốt ca","tone":"teal"}],"resourceKinds":[{"id":"quay","label":"Quầy bán"}],"cfTemplates":[],"layoutTemplates":[],"at":0,"by":"seed-v56"}]
$seed$::jsonb) e
on conflict (tenant_id, coll, id) do nothing;

-- =====================================================================
--  HOÀN TÁC (chỉ khi cần; chạy riêng): chạy lại supabase-v55.3.sql để về trigger / hàm kiểm tra của v55.3, rồi
--    drop function if exists public.cf_resource_conflict(text, text, text, jsonb, jsonb);
--    drop function if exists public.cf_type_ok(text, jsonb);
--    drop function if exists public.cf_type_need(text);
--    drop function if exists public.cf_range(text);
--    drop function if exists public.cf_json(text);
--  Hồ sơ ngành đã nạp giữ lại (chỉ là cấu hình); muốn bỏ: update public.records set deleted = true
--    where tenant_id = '_platform' and coll = 'industryProfiles' and data->>'by' = 'seed-v56';
-- =====================================================================
