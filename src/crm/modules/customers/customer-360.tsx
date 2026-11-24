'use client';

import { useState } from 'react';
import { Coins, Copy, Download, Eye, FileSpreadsheet, Pencil, Phone, Plus, Trash2, Upload } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { CommentButton } from '../../components/comments';
import { BulkBar, Fab, MobileRow, Pagination, RowMenu, usePaged, useSelection } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Drawer } from '../../components/drawer';
import { ChipFilter, FilterBar } from '../../components/filters';
import { ImportModal } from '../../components/import-csv';
import { Chip, Code, EmptyState, Field, Modal, MoneyInput, Panel, ProgressBar, Table, Tabs, useSort, useSticky } from '../../components/ui';
import { claimState, roiRating } from '../../lib/business';
import { boqIsEstimate, boqTotal, btnBase, btnGhost, btnPrimary, btnSm, cfMissing, cfSet, compact, CUSTOMER_SOURCE, CUSTOMER_STATUS, digits, EMAIL_RE, EMPTY_CUSTOMER, inputBase, inputCls, LEAD_STATUS, lListCols, mdfOfCustomer, MST_RE, nextCode, progName, PROGRAM_STATUS, quotesOfCustomer, REGION_LABEL, REVENUE_BAND, rowCls, SEGMENT_LABEL, segName, tdCls, tdFirst, tdLast, tierFor, tierInfo, TIERS, todayISO, uid, useApp, vnd } from '../../lib/core';
import { downloadCsv, matchEnum } from '../../lib/csv';
import type { ConfirmState, Customer, CustomerForm, CustomerStatus, DeptCode, ImportSpec, LBlockCfg, MenuItem, Region, RevenueBand, Segment, Tier } from '../../lib/types';
import { cn } from '../../lib/utils';
import { GetflyOrdersPanel } from './getfly-history';
import { SourceManagerModal } from './sources';
import { QuoteHistory } from '../projects/projects';
import { GeneratedDocList } from '../sales/quote';
import { ActivityList } from '../staff/staff';
import { ReservedGoodsPanel } from '../supply/inventory';
import { cfText, EntityCfDetail, EntityCfForm, EntityListPage, useEntityCf, useEntityFormLayout } from '../page-builder';

export function validateCustomer(f: CustomerForm, customers: Customer[], selfId?: string) {
  const e: Partial<Record<keyof CustomerForm, string>> = {};
  if (f.name.trim().length < 3) e.name = 'Nhập tên khách hàng';
  if (!MST_RE.test(f.taxCode.trim())) e.taxCode = 'MST gồm 10 số hoặc 13 số (dạng 0123456789-001)';
  else {
    const dup = customers.find((c) => c.taxCode === f.taxCode.trim() && c.id !== selfId);
    if (dup) e.taxCode = `MST đã thuộc khách hàng ${dup.code}`;
  }
  if (!f.contactName.trim()) e.contactName = 'Nhập người liên hệ';
  if (f.contactEmail && !EMAIL_RE.test(f.contactEmail)) e.contactEmail = 'Email chưa đúng định dạng';
  return e;
}

export function CustomerFormModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const { customers, setCustomers, users, departments, tierRules, sources, notify } = useApp();
  const [manageSources, setManageSources] = useState(false);
  const existing = customers.find((c) => c.id === id);
  const [f, setF] = useState<CustomerForm>(() => {
    if (!existing) return EMPTY_CUSTOMER;
    const { id: _i, code: _c, ...rest } = existing;
    void _i;
    void _c;
    return rest;
  });
  const [touched, setTouched] = useState(false);
  const errors = validateCustomer(f, customers, id);
  const set = <K extends keyof CustomerForm>(k: K, v: CustomerForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const reps = users.filter((u) => u.active && u.dept === f.dept && (u.role === 'SALES_REP' || u.role === 'DEPT_HEAD'));
  const suggested = tierFor(f.ytdRevenue, tierRules);
  // v55.3: trường tùy chỉnh khách hàng theo bố cục form 3A (cùng quy tắc kiểm tra với máy chủ)
  const fl = useEntityFormLayout('customer');
  const cfMiss = cfMissing(fl.formDefs, f.cf, 'SAVE');

  const save = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    if (cfMiss.length) return notify(`${cfMiss[0].type === 'check' ? 'Cần tích' : 'Nhập'} ${cfMiss[0].label}`, 'red');
    const clean = { ...f, name: f.name.trim(), taxCode: f.taxCode.trim(), cf: f.cf && Object.keys(f.cf).length ? f.cf : undefined };
    if (existing) {
      setCustomers((p) => p.map((c) => (c.id === existing.id ? { ...c, ...clean } : c)));
      notify(`Đã cập nhật ${clean.name}`, 'teal');
    } else {
      const code = nextCode(customers.map((c) => c.code), 'KH-', 6);
      setCustomers((p) => [...p, { id: uid('k'), code, ...clean, createdAt: clean.createdAt || todayISO() }]);
      notify(`Đã thêm khách hàng ${code}`, 'teal');
    }
    onClose();
  };
  const err = (k: keyof CustomerForm) => (touched ? errors[k] : undefined);

  return (
    <Modal
      title={existing ? `Sửa khách hàng ${existing.code}` : 'Thêm khách hàng'}
      onClose={onClose}
      wide
      footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>{existing ? 'Lưu thay đổi' : 'Thêm khách hàng'}</button></>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tên khách hàng *" error={err('name')} className="sm:col-span-2"><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Mã số thuế *" error={err('taxCode')}><input className={inputCls} value={f.taxCode} onChange={(e) => set('taxCode', e.target.value)} /></Field>
        <Field label="Nhóm khách hàng">
          <select className={inputCls} value={f.segment} onChange={(e) => set('segment', e.target.value as Segment)}>
            {(Object.keys(SEGMENT_LABEL) as Segment[]).map((s) => <option key={s} value={s}>{segName(s)}</option>)}
          </select>
        </Field>
        <Field label="Nguồn khách hàng">
          <div className="flex gap-2">
            <select className={inputCls} value={f.sourceId} onChange={(e) => set('sourceId', e.target.value)}>
              {sources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button type="button" className={cn(btnGhost, 'shrink-0')} onClick={() => setManageSources(true)}>Thêm / sửa</button>
          </div>
        </Field>
        <Field label="Trạng thái quan hệ">
          <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value as CustomerStatus)}>
            {(Object.keys(CUSTOMER_STATUS) as CustomerStatus[]).map((x) => <option key={x} value={x}>{CUSTOMER_STATUS[x].label}</option>)}
          </select>
        </Field>
        <Field label="Khu vực">
          <select className={inputCls} value={f.region} onChange={(e) => set('region', e.target.value as Region)}>
            {(Object.keys(REGION_LABEL) as Region[]).map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Địa chỉ" className="sm:col-span-2"><input className={inputCls} value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="Người liên hệ *" error={err('contactName')}><input className={inputCls} value={f.contactName} onChange={(e) => set('contactName', e.target.value)} /></Field>
        <Field label="Chức vụ"><input className={inputCls} value={f.contactTitle} onChange={(e) => set('contactTitle', e.target.value)} /></Field>
        <Field label="Điện thoại liên hệ"><input type="tel" autoComplete="tel" className={inputCls} inputMode="tel" value={f.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} /></Field>
        <Field label="Email liên hệ" error={err('contactEmail')}><input className={inputCls} type="email" value={f.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} /></Field>
        <Field label="Phòng ban quản lý">
          <select className={inputCls} value={f.dept} onChange={(e) => setF((p) => ({ ...p, dept: e.target.value, amId: undefined }))}>
            {departments.filter((d) => d.active).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Người phụ trách">
          <select className={inputCls} value={f.amId ?? ''} onChange={(e) => set('amId', e.target.value || undefined)}>
            <option value="">Chưa giao</option>
            {reps.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Hạn mức công nợ"><MoneyInput value={f.creditLimit} onChange={(n) => set('creditLimit', n)} /></Field>
        <Field label="Công nợ hiện tại" hint={f.creditLimit > 0 && f.debt > f.creditLimit ? 'Công nợ đang vượt hạn mức' : undefined}><MoneyInput value={f.debt} onChange={(n) => set('debt', n)} /></Field>
        <Field label="Doanh số lũy kế năm nay"><MoneyInput value={f.ytdRevenue} onChange={(n) => set('ytdRevenue', n)} /></Field>
        <Field label="Doanh số năm trước"><MoneyInput value={f.lastYearRevenue} onChange={(n) => set('lastYearRevenue', n)} /></Field>
        <Field label="Hạng khách hàng" hint={suggested !== f.tier ? `Theo quy tắc phân hạng, doanh số này thuộc hạng ${tierInfo(suggested).label}` : 'Khớp quy tắc phân hạng'}>
          <select className={inputCls} value={f.tier} onChange={(e) => set('tier', e.target.value as Tier)}>
            {TIERS.map((t) => <option key={t} value={t}>{tierInfo(t).label}</option>)}
          </select>
        </Field>

      </div>
      <div className="mt-4"><EntityCfForm entity="customer" vals={f.cf} onChange={(k, v) => set('cf', cfSet(f.cf, k, v))} /></div>
      {manageSources && <SourceManagerModal onClose={() => setManageSources(false)} />}
    </Modal>
  );
}

export function CustomersPage() {
  // Công nợ & tuổi nợ xem ở phân hệ Tài chính; Khách hàng chỉ còn danh sách (cột Công nợ vẫn hiện theo từng khách)
  // v55.3: 3A phát hành bố cục "Danh sách khách hàng" thì dựng theo khối (khối Danh sách bản ghi = bảng này)
  return <EntityListPage page="customer-list" render={(cfg) => <TradingCustomersList cfg={cfg} />} />;
}

export function TradingCustomersList({ cfg }: { cfg?: LBlockCfg } = {}) {
  // v55.3: cột trường tùy chỉnh khách hàng (theo khối Danh sách bản ghi; chưa có bố cục thì theo cờ "Danh sách")
  const cfCols = lListCols(useEntityCf('customer'), cfg);
  const { customers: allCustomers, myCustomers: customers, setCustomers, claims, programs, departments, notify, canDo, userName, dept, openCustomer, openCustomerForm, openProgramForm, presetQuery, getflyOrders, leads, sources, users } = useApp();
  const [q, setQ] = useSticky('TradingCustomersList.q', presetQuery, !!presetQuery);
  const [dp, setDp] = useState<'ALL' | DeptCode>('ALL');
  const [region, setRegion] = useState<'ALL' | Region>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [adv, setAdv] = useState<{ tier: string; source: string; band: RevenueBand; roiMin: number }>({ tier: 'ALL', source: 'ALL', band: 'ALL', roiMin: 0 });
  const [advOpen, setAdvOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const canEdit = canDo('customer.edit');
  const roiOf = (c: Customer) => { const m = mdfOfCustomer(c.id, claims, programs); return m > 0 ? c.ytdRevenue / m : null; };
  const advCount = [adv.tier !== 'ALL', adv.source !== 'ALL', adv.band !== 'ALL', adv.roiMin > 0].filter(Boolean).length;

  const list = customers
    .filter((c) => {
      const t = q.trim().toLowerCase();
      const orderHit = !!t && getflyOrders.some((o) => o.customerId === c.id && o.orderCode.toLowerCase().includes(t));
      return (!t || orderHit || [c.name, c.code, c.taxCode, c.contactName, c.contactPhone.replace(/\s/g, '')].some((v) => v.toLowerCase().includes(t.replace(/\s/g, '')) || v.toLowerCase().includes(t)))
        && (dp === 'ALL' || c.dept === dp) && (region === 'ALL' || c.region === region) && (status === 'ALL' || c.status === status)
        && (adv.tier === 'ALL' || c.tier === adv.tier) && (adv.source === 'ALL' || c.sourceId === adv.source) && REVENUE_BAND[adv.band].test(c.ytdRevenue)
        && (adv.roiMin <= 0 || (roiOf(c) ?? 0) >= adv.roiMin);
    })
    .sort((a, b) => b.ytdRevenue - a.ytdRevenue);
  const srt = useSort('TradingCustomers40', list, { 1: (c) => c.code, 2: (c) => c.name, 6: (c) => c.ytdRevenue, 7: (c) => c.debt, 8: (c) => c.creditLimit, 9: (c) => c.status });
  const paged = usePaged(srt.rows, 10);
  const sel = useSelection(list.map((c) => c.id));

  // ---- KPI có so sánh kỳ trước ----
  // Doanh số ghi nhận khi chốt đơn (trước VAT)

  const deptShort = Object.fromEntries(departments.map((d) => [d.code, d.short])) as Record<DeptCode, string>;
  const deptNames = Object.fromEntries(departments.map((d) => [d.code, d.name])) as Record<DeptCode, string>;
  const tierLabels = Object.fromEntries(TIERS.map((t) => [t, tierInfo(t).label])) as Record<Tier, string>;

  const importSpec: ImportSpec<CustomerForm> = {
    title: 'Nhập khách hàng từ file CSV',
    templateName: 'mau_nhap_khach_hang.csv',
    headers: ['ten_khach_hang', 'mst', 'nhom_khach_hang', 'hang', 'phong_ban', 'khu_vuc', 'nguon_khach', 'nguoi_lien_he', 'chuc_vu', 'sdt_lien_he', 'email_lien_he', 'dia_chi', 'han_muc_no', 'cong_no', 'doanh_so_nam_nay', 'doanh_so_nam_truoc'],
    sample: ['Công ty TNHH Thiết bị điện XYZ', '0319876543', 'Đại lý phân phối cấp 2', 'Silver', 'EMD Nam', 'Miền Nam', 'Marketing: Digital (Ads, Website, Zalo)', 'Nguyễn Văn B', 'Giám đốc', '0909123456', 'b@xyz.vn', '12 Lê Lợi, Q.1, TP.HCM', '500000000', '120000000', '350000000', '200000000'],
    parseRow: (r) => {
      const segment = r.nhom_khach_hang ? matchEnum(r.nhom_khach_hang, SEGMENT_LABEL) : 'OTHER';
      if (!segment) return { ok: false, error: `Nhóm khách hàng "${r.nhom_khach_hang}" không hợp lệ` };
      const t = r.hang ? matchEnum(r.hang, tierLabels) : TIERS[TIERS.length - 1];
      if (!t) return { ok: false, error: `Hạng "${r.hang}" không hợp lệ (Diamond, Gold, Silver, Mới)` };
      const d = matchEnum(r.phong_ban, deptShort) ?? matchEnum(r.phong_ban, deptNames);
      if (!d) return { ok: false, error: `Phòng ban "${r.phong_ban}" không hợp lệ` };
      const region: Region = /b[aắ]c/i.test(r.khu_vuc) ? 'NORTH' : 'SOUTH';
      const src = sources.find((x) => x.name.toLowerCase() === (r.nguon_khach ?? '').trim().toLowerCase() || x.id === r.nguon_khach)?.id;
      if (r.nguon_khach && !src) return { ok: false, error: `Nguồn khách "${r.nguon_khach}" chưa có, thêm ở form khách hàng trước` };
      const form: CustomerForm = {
        ...EMPTY_CUSTOMER, name: r.ten_khach_hang, taxCode: r.mst, segment, tier: t, dept: d, region, sourceId: src ?? 'SELF',
        contactName: r.nguoi_lien_he, contactTitle: r.chuc_vu, contactPhone: r.sdt_lien_he, contactEmail: r.email_lien_he, address: r.dia_chi,
        creditLimit: digits(r.han_muc_no), debt: digits(r.cong_no), ytdRevenue: digits(r.doanh_so_nam_nay), lastYearRevenue: digits(r.doanh_so_nam_truoc),
      };
      const first = Object.values(validateCustomer(form, allCustomers))[0];
      return first ? { ok: false, error: first } : { ok: true, item: form };
    },
    onImport: (items) => {
      const codes = allCustomers.map((c) => c.code);
      const seen = new Set<string>();
      const created: Customer[] = [];
      for (const f of items) {
        if (seen.has(f.taxCode)) continue;
        seen.add(f.taxCode);
        const code = nextCode(codes, 'KH-', 6);
        codes.push(code);
        created.push({ id: uid('k'), code, ...f });
      }
      setCustomers((p) => [...p, ...created]);
      notify(`Đã nhập ${created.length} khách hàng`, 'teal');
    },
  };

  const exportRows = (rows: Customer[]) =>
    downloadCsv('khach_hang_360.csv', [
      ['ma', 'ten_khach_hang', 'mst', 'nhom', 'hang', 'trang_thai', 'phong_ban', 'phu_trach', 'nguon', 'nguoi_lien_he', 'dien_thoai', 'han_muc_no', 'cong_no', 'doanh_so_nam_nay', 'mdf_da_nhan', 'mdf_roi'],
      ...rows.map((c) => {
        const mdf = mdfOfCustomer(c.id, claims, programs);
        return [c.code, c.name, c.taxCode, segName(c.segment), tierInfo(c.tier).label, CUSTOMER_STATUS[c.status].label, dept(c.dept)?.short ?? '', userName(c.amId), CUSTOMER_SOURCE[c.sourceId]?.name ?? '', c.contactName, c.contactPhone, c.creditLimit, c.debt, c.ytdRevenue, mdf, mdf ? (c.ytdRevenue / mdf).toFixed(1) : ''];
      }),
    ]);

  const deleteBlock = (c: Customer) => {
    const refs = [claims.some((x) => x.customerId === c.id) && 'hồ sơ claim', programs.some((x) => x.customerId === c.id) && 'chương trình quỹ', getflyOrders.some((x) => x.customerId === c.id) && 'đơn Getfly', leads.some((x) => x.customerId === c.id) && 'dự án đã chốt'].filter(Boolean);
    return refs.length ? `Khách hàng đang gắn ${refs.join(', ')}. Không thể xóa để giữ số liệu đối soát.` : undefined;
  };
  const askDelete = (c: Customer) => setConfirm({ title: 'Xóa khách hàng', message: <>Xóa <b>{c.name}</b> (MST {c.taxCode})?</>, blocked: deleteBlock(c), onConfirm: () => { removeWithUndo(setCustomers, c, notify, `Đã xóa ${c.name}`); } });
  const menuFor = (c: Customer): MenuItem[] => [
    { label: 'Xem hồ sơ 360', icon: Eye, onClick: () => openCustomer(c.id) },
    { label: `Gọi ${c.contactPhone}`, icon: Phone, onClick: () => { window.location.href = `tel:${c.contactPhone.replace(/\s/g, '')}`; }, disabled: !c.contactPhone },
    { label: 'Sao chép MST', icon: Copy, onClick: () => navigator.clipboard?.writeText(c.taxCode).then(() => notify(`Đã sao chép MST ${c.taxCode}`, 'teal'), () => notify('Trình duyệt chặn sao chép', 'red')) },
    { label: 'Đề xuất tài trợ quỹ 3M', icon: Coins, onClick: () => openProgramForm(c.id), disabled: !canDo('program.create') },
    { label: 'Xóa khách hàng', icon: Trash2, onClick: () => askDelete(c), danger: true, disabled: !canDo('customer.delete') },
  ];
  const bulkDelete = () => {
    const targets = customers.filter((c) => sel.has(c.id));
    const ok = targets.filter((c) => !deleteBlock(c));
    setConfirm({
      title: 'Xóa khách hàng đã chọn',
      message: <>Xóa {ok.length} / {targets.length} khách hàng đã chọn?{ok.length < targets.length ? ` ${targets.length - ok.length} khách đang gắn chứng từ đối soát sẽ được giữ lại.` : ''}</>,
      blocked: ok.length ? undefined : 'Tất cả khách đã chọn đều đang gắn hồ sơ quỹ, đơn Getfly hoặc dự án đã chốt.',
      onConfirm: () => { if (!canDo('customer.delete')) { notify('Bạn chưa có quyền xóa khách hàng', 'red'); return; } setCustomers((p) => p.filter((c) => !ok.some((x) => x.id === c.id))); sel.clear(); notify(`Đã xóa ${ok.length} khách hàng`, 'orange'); },
    });
  };
  const over = (c: Customer) => !!c.creditLimit && c.debt > c.creditLimit * 0.9;

  return (
    <div className="space-y-4">
      <FilterBar
        q={q} onQ={setQ} placeholder="Tìm MST, tên khách hàng, mã đơn, SĐT…"
        dept={dp} onDept={setDp} status={status} onStatus={setStatus}
        statusOptions={(Object.keys(CUSTOMER_STATUS) as CustomerStatus[]).map((x) => ({ value: x, label: CUSTOMER_STATUS[x].label }))}
        onAdvanced={() => setAdvOpen(true)} advancedCount={advCount} extraActive={region !== 'ALL' ? 1 : 0}
        chips={<ChipFilter total={customers.length} value={status as CustomerStatus | 'ALL'} onChange={(v) => setStatus(v)} options={(Object.keys(CUSTOMER_STATUS) as CustomerStatus[]).map((x) => ({ value: x, label: CUSTOMER_STATUS[x].label, count: customers.filter((c) => c.status === x).length })).filter((o) => o.count > 0)} />}
        actions={<>
          <RowMenu text="Nhập / xuất" icon={FileSpreadsheet} items={[{ label: 'Xuất CSV', icon: Download, onClick: () => exportRows(list) }, { label: 'Nhập từ file', icon: Upload, onClick: () => setImporting(true), disabled: !canEdit }]} />
          <button className={cn(btnPrimary, btnSm, 'max-lg:hidden')} disabled={!canEdit} onClick={() => openCustomerForm()}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm khách hàng</button>
        </>}
      >
        <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={region} onChange={(e) => setRegion(e.target.value as 'ALL' | Region)} aria-label="Khu vực">
          <option value="ALL">Tất cả khu vực</option>
          {(Object.keys(REGION_LABEL) as Region[]).map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
        </select>
      </FilterBar>

      <BulkBar count={sel.ids.length} onClear={sel.clear}>
        <button className={cn(btnGhost, btnSm)} onClick={() => exportRows(customers.filter((c) => sel.has(c.id)))}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>
        <select className={cn(inputBase, 'w-auto py-1 text-xs')} disabled={!canEdit} value="" onChange={(e) => { const v = e.target.value as CustomerStatus; if (!v) return; setCustomers((p) => p.map((c) => (sel.has(c.id) ? { ...c, status: v } : c))); notify(`Đã chuyển ${sel.ids.length} khách sang ${CUSTOMER_STATUS[v].label}`, 'teal'); }} aria-label="Đổi trạng thái">
          <option value="">Đổi trạng thái…</option>
          {(Object.keys(CUSTOMER_STATUS) as CustomerStatus[]).map((x) => <option key={x} value={x}>{CUSTOMER_STATUS[x].label}</option>)}
        </select>
        <select className={cn(inputBase, 'w-auto py-1 text-xs')} disabled={!canEdit} value="" onChange={(e) => { const u = users.find((x) => x.id === e.target.value); if (!u) return; setCustomers((p) => p.map((c) => (sel.has(c.id) ? { ...c, amId: u.id, dept: u.dept ?? c.dept } : c))); notify(`Đã giao ${sel.ids.length} khách cho ${u.name}`, 'teal'); }} aria-label="Giao phụ trách">
          <option value="">Giao phụ trách…</option>
          {users.filter((u) => u.active && (u.role === 'SALES_REP' || u.role === 'DEPT_HEAD')).map((u) => <option key={u.id} value={u.id}>{u.name} ({dept(u.dept)?.short})</option>)}
        </select>
        <button className={cn(btnGhost, btnSm, 'hover:text-[rgb(var(--danger-fg))]')} disabled={!canEdit} onClick={bulkDelete}><Trash2 className="h-3.5 w-3.5" aria-hidden />Xóa</button>
      </BulkBar>

      <Panel>
        {/* Mobile: danh sách thẻ */}
        <div className="space-y-2 md:hidden">
          {paged.slice.map((c) => (
            <MobileRow
              key={c.id}
              avatar={c.name}
              title={c.name}
              badge={<Chip tone={tierInfo(c.tier).tone}>{tierInfo(c.tier).label}</Chip>}
              sub={`${c.code}, ${c.contactPhone}`}
              value={compact(c.ytdRevenue)}
              status={<Chip tone={CUSTOMER_STATUS[c.status].tone}>{CUSTOMER_STATUS[c.status].label}</Chip>}
              onClick={() => openCustomer(c.id)}
            />
          ))}
        </div>
        {/* Desktop / tablet: bảng */}
        <div className="hidden md:block">
          <Table stt={Math.max(0, paged.from - 1)} head={[<input key="all" type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={sel.allOn} onChange={sel.toggleAll} aria-label="Chọn tất cả" />, 'Mã KH', 'Khách hàng', 'Điện thoại', 'Ngành hàng', 'AM', <span key="r" className="block text-right">Doanh số</span>, <span key="d" className="block text-right">Công nợ</span>, <span key="l" className="block text-right">Hạn mức</span>, 'Trạng thái', ...cfCols.map((d) => d.label), <span key="a" className="block text-right">Thao tác</span>]} minW={1000 + cfCols.length * 140} sort={srt.th}>
            {paged.slice.map((c) => {
              return (
                <tr key={c.id} className={cn(rowCls, 'cursor-pointer', sel.has(c.id) && 'bg-[rgb(var(--accent)/0.05)]')} onClick={() => openCustomer(c.id)}>
                  <td className={cn(tdFirst, 'w-10')} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={sel.has(c.id)} onChange={() => sel.toggle(c.id)} aria-label={`Chọn ${c.name}`} /></td>
                  <td className={tdCls}><Code>{c.code}</Code></td>
                  <td className={tdCls}><button className="block max-w-[260px] truncate text-left font-medium hover:underline" title={c.name} onClick={(e) => { e.stopPropagation(); openCustomer(c.id); }}>{c.name}</button></td>
                  <td className={cn(tdCls, 'tabular-nums text-[rgb(var(--fg2))]')}>{c.contactPhone || <span className="text-[rgb(var(--faint))]">—</span>}</td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{dept(c.dept)?.short}</td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[150px] truncate">{userName(c.amId)}</span></td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(c.ytdRevenue)}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums', over(c) && 'text-[rgb(var(--danger-fg))]')} title={over(c) ? 'Gần / vượt hạn mức công nợ' : undefined}>{compact(c.debt)}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{c.creditLimit ? compact(c.creditLimit) : '—'}</td>
                  <td className={tdCls}><Chip tone={CUSTOMER_STATUS[c.status].tone}>{CUSTOMER_STATUS[c.status].label}</Chip></td>
                  {cfCols.map((d) => { const tx = cfText(d, c.cf?.[d.key], userName); return <td key={d.id} className={cn(tdCls, (d.type === 'money' || d.type === 'number') && 'text-right tabular-nums')} data-cf={d.key}><span className="block max-w-[180px] truncate" title={tx}>{tx || <span className="text-[rgb(var(--faint))]">—</span>}</span></td>; })}
                  <td className={cn(tdLast, 'whitespace-nowrap text-right')} onClick={(e) => e.stopPropagation()}>
                    <span className="mr-1 inline-block align-middle"><CommentButton entity="customer" entityId={c.id} title={c.name} module="customers" /></span>
                    <RowMenu items={[{ label: 'Sửa', icon: Pencil, disabled: !canEdit, onClick: () => openCustomerForm(c.id) }, ...menuFor(c)]} />
                  </td>
                </tr>
              );
            })}
          </Table>
        </div>
        {!list.length && <EmptyState text={<>Không có khách hàng khớp bộ lọc.</>} art="search" />}
        <Pagination paged={paged} unit="khách hàng" />
      </Panel>

      <Fab label="Thêm khách hàng" onClick={() => openCustomerForm()} disabled={!canEdit} />
      {importing && <ImportModal spec={importSpec} onClose={() => setImporting(false)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
      {advOpen && (
        <Modal title="Bộ lọc nâng cao" onClose={() => setAdvOpen(false)} footer={<><button className={btnGhost} onClick={() => setAdv({ tier: 'ALL', source: 'ALL', band: 'ALL', roiMin: 0 })}>Xóa bộ lọc</button><button className={btnPrimary} onClick={() => setAdvOpen(false)}>Áp dụng</button></>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Hạng khách hàng">
              <select className={inputCls} value={adv.tier} onChange={(e) => setAdv({ ...adv, tier: e.target.value })}>
                <option value="ALL">Mọi hạng</option>
                {TIERS.map((t) => <option key={t} value={t}>{tierInfo(t).label}</option>)}
              </select>
            </Field>
            <Field label="Nguồn khách hàng">
              <select className={inputCls} value={adv.source} onChange={(e) => setAdv({ ...adv, source: e.target.value })}>
                <option value="ALL">Mọi nguồn</option>
                {sources.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Field>
            <Field label="Doanh số lũy kế">
              <select className={inputCls} value={adv.band} onChange={(e) => setAdv({ ...adv, band: e.target.value as RevenueBand })}>
                {(Object.keys(REVENUE_BAND) as RevenueBand[]).map((b) => <option key={b} value={b}>{REVENUE_BAND[b].label}</option>)}
              </select>
            </Field>
            <Field label="MDF ROI tối thiểu (lần)"><input className={inputCls} type="number" min={0} step={0.5} value={adv.roiMin} onChange={(e) => setAdv({ ...adv, roiMin: Number(e.target.value) })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function CustomerDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { customers, claims, programs, myLeads: leads, tierRules, segRules, policy, userName, dept, canDo, openClaim, openCustomerForm, openProgramForm, getflyOrders, quotes, openComposer } = useApp();
  const [tab, setTab] = useState<'overview' | 'quotes' | 'getfly'>('overview');
  const c = customers.find((x) => x.id === id);
  if (!c) return null;
  const gfCount = getflyOrders.filter((o) => o.customerId === c.id).length;
  const cClaims = claims.filter((x) => x.customerId === c.id);
  const cProgs = programs.filter((p) => p.customerId === c.id && p.status !== 'CLAIMING');
  const mdf = mdfOfCustomer(c.id, claims, programs);
  const cap = tierRules.find((r) => r.tier === c.tier)?.mdfCap ?? 0;
  const leverage = mdf > 0 ? c.ytdRevenue / mdf : null;
  const rating = roiRating(leverage);
  const growth = c.lastYearRevenue ? (c.ytdRevenue - c.lastYearRevenue) / c.lastYearRevenue : null;
  const suggested = tierFor(c.ytdRevenue, tierRules);
  const cLeads = leads.filter((l) => l.customerId === c.id || (l.taxCode && l.taxCode === c.taxCode));
  const eligible = !!segRules[c.segment]?.mdfEligible;
  const cQuotes = quotesOfCustomer(c, quotes, leads);

  return (
    <Drawer
      title={c.name}
      eyebrow={`${c.code}, MST ${c.taxCode}`}
      badge={<Chip tone={tierInfo(c.tier).tone}>{tierInfo(c.tier).label}</Chip>}
      onClose={onClose}
      actions={
        <>
          <button className={cn(btnGhost, btnSm)} disabled={!canDo('customer.edit')} onClick={() => openCustomerForm(c.id)}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa hồ sơ</button>
          <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent-fg))] hover:bg-[rgb(var(--accent)/0.25)]')} disabled={!canDo('program.create') || !eligible} title={eligible ? undefined : 'Nhóm khách hàng này không thuộc diện nhận MDF'} onClick={() => openProgramForm(c.id)}>
            <Coins className="h-3.5 w-3.5" aria-hidden />Đề xuất tài trợ MDF
          </button>
        </>
      }
    >
      <Tabs tabs={[{ id: 'overview', label: 'Tổng quan' }, { id: 'quotes', label: `Báo giá (${cQuotes.length})` }, { id: 'getfly', label: `Getfly (${gfCount})` }]} value={tab} onChange={setTab} />
      {tab === 'getfly' ? <GetflyOrdersPanel customer={c} /> : tab === 'quotes' ? <QuoteHistory customer={c} /> : <>
      {/* MDF ROI — chỉ số đòn bẩy chính */}
      <section className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">MDF ROI = Doanh thu mang lại / Chi phí quỹ đã cấp</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-[rgb(var(--fg))]">{leverage ? `${leverage.toFixed(1)} lần` : '—'}</p>
          </div>
          <Chip tone={rating.tone}>{rating.label}</Chip>
        </div>
        <p className="mt-2 text-sm tabular-nums text-[rgb(var(--muted))]">{vnd(c.ytdRevenue)} / {mdf ? vnd(mdf) : '0 ₫'}</p>
      </section>

      {/* v55.3 khối Chi tiết bản ghi do 3A thiết kế (trường tùy chỉnh + trường gốc đặt thêm) */}
      <EntityCfDetail entity="customer" vals={c.cf} builtin={(k) => ({ code: c.code, name: c.name, taxCode: c.taxCode, segment: segName(c.segment), tier: tierInfo(c.tier).label, region: REGION_LABEL[c.region], dept: dept(c.dept)?.short ?? '—', amId: userName(c.amId) || '—', contactName: c.contactName || '—', contactPhone: c.contactPhone || '—', contactEmail: c.contactEmail || '—', address: c.address || '—', creditLimit: c.creditLimit ? vnd(c.creditLimit) : '—', debt: vnd(c.debt) } as Record<string, string>)[k] ?? '—'} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded bg-[rgb(var(--raised))] p-4">
          <p className="text-xs text-[rgb(var(--muted))]">Doanh số lũy kế</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[rgb(var(--fg))]">{compact(c.ytdRevenue)}</p>
          {growth !== null && <p className={cn('mt-1 text-xs', growth >= 0 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>{growth >= 0 ? '+' : ''}{(growth * 100).toFixed(0)}% so với năm trước</p>}
        </div>
        <div className="rounded bg-[rgb(var(--raised))] p-4">
          <p className="text-xs text-[rgb(var(--muted))]">Hạn mức tài trợ hạng {tierInfo(c.tier).label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[rgb(var(--accent-fg))]">{compact(mdf)} / {compact(cap)}</p>
          <div className="mt-2"><ProgressBar value={mdf} max={cap} /></div>
        </div>
        <div className="rounded bg-[rgb(var(--raised))] p-4">
          <p className="text-xs text-[rgb(var(--muted))]">Hạn mức công nợ</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-[rgb(var(--fg))]">{compact(c.debt)} / {compact(c.creditLimit)}</p>
          <div className="mt-2"><ProgressBar value={c.debt} max={c.creditLimit} /></div>
        </div>
        <div className="rounded bg-[rgb(var(--raised))] p-4">
          <p className="text-xs text-[rgb(var(--muted))]">Phân hạng theo quy tắc</p>
          <p className="mt-1 text-xl font-semibold text-[rgb(var(--fg))]">{tierInfo(suggested).label}</p>
          <p className="mt-1 text-xs text-[rgb(var(--muted))]">{suggested === c.tier ? 'Khớp hạng hiện tại' : `Hạng hiện tại ${tierInfo(c.tier).label}, cần rà soát`}</p>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--fg))]">Thông tin doanh nghiệp và liên hệ</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            ['Nhóm khách hàng', `${segName(c.segment)}${eligible ? '' : ' (không nhận MDF)'}`],
            ['Phòng ban quản lý', dept(c.dept)?.name ?? ''],
            ['Người phụ trách', userName(c.amId)],
            ['Nguồn khách hàng', CUSTOMER_SOURCE[c.sourceId]?.name ?? 'Chưa phân loại'],
            ['Khu vực', REGION_LABEL[c.region]],
            ['Người liên hệ', `${c.contactName}${c.contactTitle ? `, ${c.contactTitle}` : ''}`],
            ['Điện thoại', c.contactPhone || 'Chưa có'],
            ['Email', c.contactEmail || 'Chưa có'],
            ['Địa chỉ', c.address || 'Chưa có'],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-[rgb(var(--muted))]">{k}</dt><dd className="mt-0.5 break-words text-[rgb(var(--fg))]">{v}</dd></div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--fg))]">Lịch sử nhận tài trợ quỹ Hãng</h3>
        {cProgs.length + cClaims.length === 0 ? (
          <p className="rounded border border-dashed border-[rgb(var(--line))] p-4 text-center text-sm text-[rgb(var(--muted))]">Khách hàng chưa nhận MDF.{eligible ? ' Bấm Đề xuất tài trợ MDF để bắt đầu.' : ''}</p>
        ) : (
          <ul className="divide-y divide-[rgb(var(--line))] rounded border border-[rgb(var(--line))]">
            {cClaims.map((x) => {
              const st = claimState(x, policy.rules);
              return (
                <li key={x.id}>
                  <button className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[rgb(var(--raised))]" onClick={() => openClaim(x.id)}>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[rgb(var(--fg))]">{x.programTitle}</p>
                      <p className="text-xs text-[rgb(var(--muted))]">{progName(x.programType)}, {x.period}, {compact(x.claimed)}</p>
                    </div>
                    <Chip tone={st.tone}>{st.label}</Chip>
                  </button>
                </li>
              );
            })}
            {cProgs.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm text-[rgb(var(--fg))]">{p.title}</p><p className="text-xs text-[rgb(var(--muted))]">{progName(p.type)}, {p.preApprovalId ?? `${p.code} (chờ 3M cấp mã)`}, {compact(p.held)}</p></div>
                <Chip tone={PROGRAM_STATUS[p.status].tone}>{PROGRAM_STATUS[p.status].label}</Chip>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[rgb(var(--fg))]">Hợp đồng & tạo báo giá</h3>
          <button className={cn(btnGhost, btnSm)} disabled={!(canDo('project.update') || canDo('customer.edit'))} onClick={() => openComposer({ customerId: c.id, mode: 'QUOTE' })}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo mới</button>
        </div>
        <GeneratedDocList customerId={c.id} compact />
      </section>

      <ActivityList customerId={c.id} />

      <ReservedGoodsPanel kind="CUSTOMER" refId={c.id} />

      <section>
        <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--fg))]">Lead và cơ hội liên quan</h3>
        {cLeads.length === 0 ? (
          <p className="text-sm text-[rgb(var(--muted))]">Chưa có lead nào gắn với MST này.</p>
        ) : (
          <ul className="space-y-2">
            {cLeads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 rounded bg-[rgb(var(--raised))] px-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm text-[rgb(var(--fg))]">{l.boqNote || l.company}</p><p className="text-xs text-[rgb(var(--muted))]">{l.code}, {boqIsEstimate(l) ? 'ước tính' : 'BOQ'} {compact(boqTotal(l))}</p></div>
                <Chip tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Chip>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>}
    </Drawer>
  );
}

