-- =====================================================================
--  3A Platform — v58: Kế toán & Hóa đơn (bút toán lưu thật, khóa kỳ, yêu cầu xuất hóa đơn bảng riêng)
--  Chạy SAU supabase-v56.2.sql (chưa cài v55.1 → v55.3 → v56 → v56.2 thì chạy lần lượt trước).
--  Chạy lại nhiều lần không sao (chỉ thay hàm trigger / policy). Không đổi bảng, không đổi / xóa dữ liệu.
--
--  Dữ liệu mới vẫn nằm trong public.records, mỗi bản ghi 1 dòng, RLS theo tenant_id như cũ:
--    coll 'invoiceRequests' : yêu cầu xuất hóa đơn (tách từ SalesOrder.invReqs; đơn vẫn giữ bản cũ để đọc ngược)
--    coll 'journalEntries'  : bút toán đã ghi sổ
--
--  1. journal_guard (bút toán):
--     - chỉ thêm; không sửa nội dung, không xóa (kể cả xóa mềm); chỉ được đánh dấu "đã đảo" (reversedBy) 1 lần;
--       ghi trùng y nguyên (cùng mã, cùng nội dung — 2 máy ghi cùng lúc) được bỏ qua;
--     - mã theo nguồn: CE: / SV: / SVC: / INV: (+ ~n khi ghi lại), REV:<mã gốc> (bút toán đảo, mã gốc phải có);
--     - mỗi dòng: TK Nợ, TK Có khác nhau, số tiền nguyên dương; tổng = total (Nợ = Có theo từng dòng);
--     - ngày phải sau ngày khóa kỳ (mfgConfig.acct.lockedUntil);
--     - người ghi: Kế toán / Giám đốc / quản trị doanh nghiệp.
--  2. acct_cfg_guard: đổi cấu hình kế toán (mfgConfig.acct: khóa kỳ, số dư đầu kỳ, thời điểm ghi doanh thu…)
--     chỉ Kế toán / Giám đốc; mở lại kỳ đã khóa (lùi ngày khóa) chỉ Giám đốc / quản trị doanh nghiệp.
--  3. invoice_req_guard (yêu cầu xuất hóa đơn):
--     - tạo mới ở trạng thái PENDING, người yêu cầu là chính mình (trừ bản chuyển từ invReqs cũ do Kế toán / Giám đốc chuyển);
--     - PENDING → ISSUED / REJECTED, ISSUED → CANCELLED: chỉ Kế toán / Giám đốc;
--     - không tự xuất hóa đơn cho yêu cầu của chính mình (v46); ngoại lệ Giám đốc, bắt buộc có selfLog;
--     - người yêu cầu được rút yêu cầu đang chờ (PENDING → REJECTED); đơn đã hủy thì ai cũng trả lại được;
--     - hóa đơn đã xuất: chỉ bổ sung tệp PDF / XML, không sửa số / ngày / tiền; không xóa.
--  4. Kho tệp riêng 'crm-attach': thư mục <doanh nghiệp>/invoices/ chỉ Kế toán / Giám đốc tải lên / xóa (thành viên vẫn đọc).
-- =====================================================================

-- Vai trò kế toán: Kế toán, Giám đốc, quản trị doanh nghiệp; tài khoản cũ chưa có vai trò (NULL) giữ hành vi cũ như can_write (coi như BOD)
create or replace function public.is_acct_member(t text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or public.is_tenant_admin(t) or (public.is_member(t) and coalesce(public.member_role(t), 'BOD') in ('BOD', 'ACCOUNTANT'))
$$;
revoke all on function public.is_acct_member(text) from public, anon;
grant execute on function public.is_acct_member(text) to authenticated;

-- ---------------------------------------------------------------------
-- 1. Bút toán
-- ---------------------------------------------------------------------
create or replace function public.journal_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d jsonb; o jsonb; cfg jsonb; locked text; ln jsonb; tot numeric := 0; n int;
begin
  if TG_OP = 'DELETE' then
    if OLD.coll = 'journalEntries' and not public.is_platform_admin() then
      raise exception 'journal_immutable: không xóa bút toán đã ghi sổ (dùng bút toán đảo)' using errcode = '42501';
    end if;
    return OLD;
  end if;
  if NEW.coll <> 'journalEntries' or NEW.tenant_id = '_platform' then return NEW; end if;
  if public.is_platform_admin() then return NEW; end if; -- khôi phục bản sao lưu của 3A
  if not public.is_acct_member(NEW.tenant_id) then
    raise exception 'journal_role: chỉ Kế toán / Giám đốc ghi sổ' using errcode = '42501';
  end if;
  d := NEW.data;
  if TG_OP = 'UPDATE' then
    o := OLD.data;
    if NEW.deleted is distinct from OLD.deleted then raise exception 'journal_immutable: không xóa bút toán đã ghi sổ' using errcode = '42501'; end if;
    if (d - 'reversedBy' - 'reversedAt') is distinct from (o - 'reversedBy' - 'reversedAt') then
      raise exception 'journal_immutable: không sửa bút toán đã ghi sổ (dùng bút toán đảo)' using errcode = '42501';
    end if;
    if (o ? 'reversedBy') and (o->>'reversedBy') is distinct from (d->>'reversedBy') then
      raise exception 'journal_immutable: bút toán đã đảo' using errcode = '42501';
    end if;
    if (d ? 'reversedBy') and not (o ? 'reversedBy') and (d->>'reversedBy') is distinct from ('REV:' || NEW.id) then
      raise exception 'journal_rev: bút toán đảo của % phải có mã REV:%', NEW.id, NEW.id using errcode = '23514';
    end if;
    return NEW;
  end if;
  -- thêm mới (máy khách ghi kiểu upsert: dòng đã có thì để bước UPDATE kiểm tra)
  if exists (select 1 from public.records r where r.tenant_id = NEW.tenant_id and r.coll = NEW.coll and r.id = NEW.id) then return NEW; end if;
  if NEW.deleted then raise exception 'journal_invalid: bút toán mới không được ở trạng thái xóa' using errcode = '23514'; end if;
  if d->>'id' is distinct from NEW.id then raise exception 'journal_invalid: mã bút toán không khớp' using errcode = '23514'; end if;
  if not (NEW.id ~ '^(CE|SV|SVC|INV):[^~]+(~[0-9]+)?$' or NEW.id ~ '^REV:(CE|SV|SVC|INV):[^~]+(~[0-9]+)?$') then
    raise exception 'journal_invalid: mã bút toán % không theo nguồn (CE / SV / SVC / INV / REV)', NEW.id using errcode = '23514';
  end if;
  if d ? 'reversedBy' then raise exception 'journal_invalid: bút toán mới chưa thể đã đảo' using errcode = '23514'; end if;
  if coalesce(d->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'journal_invalid: thiếu ngày bút toán' using errcode = '23514'; end if;
  n := coalesce(jsonb_array_length(case when jsonb_typeof(d->'lines') = 'array' then d->'lines' end), 0);
  if n = 0 then raise exception 'journal_invalid: bút toán không có dòng' using errcode = '23514'; end if;
  for ln in select * from jsonb_array_elements(d->'lines') loop
    if coalesce(ln->>'dr', '') = '' or coalesce(ln->>'cr', '') = '' or ln->>'dr' = ln->>'cr' then
      raise exception 'journal_unbalanced: mỗi dòng cần TK Nợ và TK Có khác nhau' using errcode = '23514';
    end if;
    if jsonb_typeof(ln->'amount') <> 'number' or (ln->>'amount')::numeric <= 0 or (ln->>'amount')::numeric <> trunc((ln->>'amount')::numeric) then
      raise exception 'journal_unbalanced: số tiền mỗi dòng phải là số nguyên dương' using errcode = '23514';
    end if;
    tot := tot + (ln->>'amount')::numeric;
  end loop;
  if jsonb_typeof(d->'total') <> 'number' or (d->>'total')::numeric <> tot then
    raise exception 'journal_unbalanced: tổng Nợ (%) khác tổng Có ghi trên bút toán (%)', tot, d->>'total' using errcode = '23514';
  end if;
  select r.data into cfg from public.records r where r.tenant_id = NEW.tenant_id and r.coll = '$' and r.id = 'mfgConfig' and not r.deleted;
  locked := cfg->'acct'->>'lockedUntil';
  if locked is not null and (d->>'date') <= locked then
    raise exception 'journal_locked: kỳ đã khóa đến %, không ghi bút toán ngày %', locked, d->>'date' using errcode = '23514';
  end if;
  if NEW.id like 'REV:%' then
    if 'REV:' || coalesce(d->>'reverses', '') <> NEW.id or not exists (
      select 1 from public.records r where r.tenant_id = NEW.tenant_id and r.coll = 'journalEntries' and r.id = d->>'reverses' and not r.deleted
    ) then
      raise exception 'journal_rev: bút toán đảo phải trỏ tới bút toán gốc đã ghi' using errcode = '23514';
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists journal_guard on public.records;
create trigger journal_guard before insert or update or delete on public.records
  for each row execute function public.journal_guard();

-- ---------------------------------------------------------------------
-- 2. Cấu hình kế toán (mfgConfig.acct)
-- ---------------------------------------------------------------------
create or replace function public.acct_cfg_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  na jsonb; oa jsonb := null;
begin
  if NEW.coll <> '$' or NEW.id <> 'mfgConfig' or NEW.tenant_id = '_platform' then return NEW; end if;
  if public.is_platform_admin() then return NEW; end if;
  na := NEW.data->'acct';
  if TG_OP = 'INSERT' and exists (select 1 from public.records r where r.tenant_id = NEW.tenant_id and r.coll = '$' and r.id = 'mfgConfig') then return NEW; end if; -- upsert: bước UPDATE kiểm tra
  if TG_OP = 'UPDATE' and not OLD.deleted then oa := OLD.data->'acct'; end if;
  if na is not distinct from oa then return NEW; end if;
  if not public.is_acct_member(NEW.tenant_id) then
    raise exception 'acct_role: chỉ Kế toán / Giám đốc đổi cấu hình kế toán' using errcode = '42501';
  end if;
  -- mở lại kỳ đã khóa: lùi / bỏ ngày khóa
  if (oa->>'lockedUntil') is not null and ((na->>'lockedUntil') is null or (na->>'lockedUntil') < (oa->>'lockedUntil'))
     and not (public.is_tenant_admin(NEW.tenant_id) or coalesce(public.member_role(NEW.tenant_id), 'BOD') = 'BOD') then
    raise exception 'acct_lock: chỉ Giám đốc mở lại kỳ đã khóa' using errcode = '42501';
  end if;
  -- số dư đầu kỳ không đổi sau khi đã khóa kỳ chứa ngày bắt đầu ghi sổ
  if (oa->>'lockedUntil') is not null and (oa->>'journalSince') is not null and (oa->>'lockedUntil') >= (oa->>'journalSince')
     and (na->'opening') is distinct from (oa->'opening') then
    raise exception 'acct_lock: đã khóa kỳ, không sửa số dư đầu kỳ' using errcode = '42501';
  end if;
  return NEW;
end $$;

drop trigger if exists acct_cfg_guard on public.records;
create trigger acct_cfg_guard before insert or update on public.records
  for each row execute function public.acct_cfg_guard();

-- ---------------------------------------------------------------------
-- 3. Yêu cầu xuất hóa đơn
-- ---------------------------------------------------------------------
create or replace function public.invoice_req_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d jsonb; o jsonb; me text; acct boolean; role text; os text; ns text; sale_cancelled boolean;
begin
  if TG_OP = 'DELETE' then
    if OLD.coll = 'invoiceRequests' and not public.is_platform_admin() then
      raise exception 'invoice_immutable: không xóa yêu cầu xuất hóa đơn' using errcode = '42501';
    end if;
    return OLD;
  end if;
  if NEW.coll <> 'invoiceRequests' or NEW.tenant_id = '_platform' then return NEW; end if;
  if public.is_platform_admin() then return NEW; end if;
  d := NEW.data; ns := d->>'status';
  me := public.member_app_user(NEW.tenant_id);
  acct := public.is_acct_member(NEW.tenant_id);
  role := coalesce(public.member_role(NEW.tenant_id), 'BOD');
  if d->>'id' is distinct from NEW.id then raise exception 'invoice_invalid: mã yêu cầu không khớp' using errcode = '23514'; end if;
  if TG_OP = 'INSERT' then
    if exists (select 1 from public.records r where r.tenant_id = NEW.tenant_id and r.coll = NEW.coll and r.id = NEW.id) then return NEW; end if; -- upsert: bước UPDATE kiểm tra
    if NEW.deleted then raise exception 'invoice_invalid' using errcode = '23514'; end if;
    if ns = 'PENDING' then
      if me is not null and (d->>'requestedBy') is distinct from me and not (acct and (d->>'legacy') = 'true') then
        raise exception 'invoice_role: chỉ tạo yêu cầu đứng tên chính mình' using errcode = '42501';
      end if;
      return NEW;
    end if;
    -- bản chuyển từ invReqs cũ (đã xử lý): chỉ Kế toán / Giám đốc chuyển, phải khớp phiếu trong đơn
    if (d->>'legacy') = 'true' and acct and exists (
      select 1 from public.records r, jsonb_array_elements(coalesce(r.data->'invReqs', '[]'::jsonb)) e
      where r.tenant_id = NEW.tenant_id and r.coll = 'salesOrders' and r.id = d->>'saleId' and not r.deleted and e->>'id' = NEW.id
    ) then return NEW; end if;
    raise exception 'invoice_invalid: yêu cầu mới phải ở trạng thái chờ xuất' using errcode = '23514';
  end if;
  -- sửa
  o := OLD.data; os := o->>'status';
  if NEW.deleted is distinct from OLD.deleted then raise exception 'invoice_immutable: không xóa yêu cầu xuất hóa đơn' using errcode = '42501'; end if;
  if d = o then return NEW; end if;
  if os = ns then
    if os = 'ISSUED' and acct and (d - 'files') = (o - 'files') then return NEW; end if; -- bổ sung tệp hóa đơn
    if os = 'PENDING' and (acct or ((o->>'requestedBy') is not distinct from me)) and (d - 'buyer' - 'items' - 'note' - 'amount' - 'vat' - 'total' - 'code') = (o - 'buyer' - 'items' - 'note' - 'amount' - 'vat' - 'total' - 'code') then return NEW; end if;
    raise exception 'invoice_immutable: không sửa yêu cầu / hóa đơn đã xử lý' using errcode = '42501';
  end if;
  if os = 'PENDING' and ns in ('ISSUED', 'REJECTED') then
    if ns = 'REJECTED' and not acct then
      -- hủy đơn (người lên đơn / quản lý) trả lại yêu cầu đang chờ: đơn có thể được ghi sau yêu cầu trong cùng lượt đồng bộ
      select (r.data->>'status') = 'CANCELLED' into sale_cancelled from public.records r where r.tenant_id = NEW.tenant_id and r.coll = 'salesOrders' and r.id = d->>'saleId' and not r.deleted;
      if (o->>'requestedBy') is not distinct from me or coalesce(sale_cancelled, false) or (d->>'reason') = 'Đơn đã hủy' then return NEW; end if;
      raise exception 'invoice_role: chỉ Kế toán trả lại yêu cầu xuất hóa đơn' using errcode = '42501';
    end if;
    if not acct then raise exception 'invoice_role: chỉ Kế toán / Giám đốc xuất hóa đơn' using errcode = '42501'; end if;
    if me is not null and (d->>'decidedBy') is distinct from me then raise exception 'invoice_role: người xử lý phải là chính mình' using errcode = '42501'; end if;
    if ns = 'ISSUED' then
      if coalesce(d->'invoice'->>'no', '') = '' or coalesce(d->'invoice'->>'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'invoice_invalid: thiếu số / ngày hóa đơn' using errcode = '23514';
      end if;
      if me is not null and (o->>'requestedBy') = me then
        if role <> 'BOD' and not public.is_tenant_admin(NEW.tenant_id) then
          raise exception 'invoice_self: không tự xuất hóa đơn cho yêu cầu của chính mình' using errcode = '42501';
        end if;
        if coalesce(d->>'selfLog', '') = '' then raise exception 'invoice_self: Giám đốc tự xuất cần ghi nhật ký (selfLog)' using errcode = '23514'; end if;
      end if;
    end if;
    return NEW;
  end if;
  if os = 'ISSUED' and ns = 'CANCELLED' then
    if not acct then raise exception 'invoice_role: chỉ Kế toán / Giám đốc hủy hóa đơn' using errcode = '42501'; end if;
    if (d->'invoice') is distinct from (o->'invoice') or (d->>'total') is distinct from (o->>'total') then
      raise exception 'invoice_immutable: hủy hóa đơn không đổi số / tiền hóa đơn' using errcode = '42501';
    end if;
    if coalesce(d->>'reason', '') = '' then raise exception 'invoice_invalid: thiếu lý do hủy hóa đơn' using errcode = '23514'; end if;
    return NEW;
  end if;
  raise exception 'invoice_invalid: không chuyển % → %', os, ns using errcode = '23514';
end $$;

drop trigger if exists invoice_req_guard on public.records;
create trigger invoice_req_guard before insert or update or delete on public.records
  for each row execute function public.invoice_req_guard();

-- ---------------------------------------------------------------------
-- 4. Kho tệp riêng: thư mục invoices/ chỉ Kế toán / Giám đốc tải lên, xóa (đọc như cũ: thành viên doanh nghiệp)
-- ---------------------------------------------------------------------
drop policy if exists "crm attach upload" on storage.objects;
create policy "crm attach upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'crm-attach' and (public.is_platform_admin() or (public.is_member((storage.foldername(name))[1])
    and (coalesce((storage.foldername(name))[2], '') <> 'invoices' or public.is_acct_member((storage.foldername(name))[1]))))
);
drop policy if exists "crm attach delete" on storage.objects;
create policy "crm attach delete" on storage.objects for delete to authenticated using (
  bucket_id = 'crm-attach' and (public.is_platform_admin() or (public.is_member((storage.foldername(name))[1])
    and (coalesce((storage.foldername(name))[2], '') <> 'invoices' or public.is_acct_member((storage.foldername(name))[1]))))
);

-- =====================================================================
--  HOÀN TÁC (chỉ khi cần quay lại v57; chạy riêng):
--  drop trigger if exists journal_guard on public.records;      drop function if exists public.journal_guard();
--  drop trigger if exists acct_cfg_guard on public.records;     drop function if exists public.acct_cfg_guard();
--  drop trigger if exists invoice_req_guard on public.records;  drop function if exists public.invoice_req_guard();
--  -- policy crm-attach: chạy lại đoạn 5 của supabase-v55.1.sql
--  Dữ liệu invoiceRequests / journalEntries giữ nguyên (code cũ không đọc tới).
-- =====================================================================
