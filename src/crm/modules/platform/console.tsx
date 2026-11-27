'use client';

import { Fragment, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Bold, Building2, CalendarDays, Check as CheckIcon, CheckCircle2, ChevronLeft, ChevronRight, Columns3, Copy, Download, Eye, FileText, Filter, GripVertical, Hash, Heading2, Info, Italic, KeyRound, LayoutGrid, LayoutTemplate, Link2, List, ListChecks, Lock, LogIn, MessageSquare, Minus, Monitor, Paperclip, Pencil, Plug, Plus, Redo2, RefreshCw, Rocket, Rows3, Scale, Search, Settings, ShoppingBag, SlidersHorizontal, Smartphone, StickyNote, Tablet, Target, Trash2, TrendingUp, Truck, Undo2, Users, Wallet, X, XCircle } from 'lucide-react';
import { Pagination, RowMenu, usePaged } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Chip, Code, EmptyState, Field, Modal, MoneyInput, Panel, StatCard, Table, Tabs, useSort, useSticky } from '../../components/ui';
import { cloudMessage } from '../../lib/cloud';
import { btnGhost, btnPrimary, btnSm, BUSINESS_PROFILE, C, CF_ENTITY, CF_FILTERABLE, CF_TYPE, cfSlug, cloud, CLOUD_ON, CONSOLE_TABS, DATA_VERSION, dataKey, daysTo, defaultTenantReg, DEMO_PASSWORD, EMAIL_RE, fmtDate, fold, headRoleFor, INITIAL_PERMS, INITIAL_SECURITY, inputBase, inputCls, iso, isPlatformEmail, kpiGrid, L_ACT, L_ALL_PAGES, L_DS, L_GRID_FINE, L_ICONSET, L_KIND, lFineH, lGridOf, lToFine, L_LATER, L_PAGES, L_PER, L_PERIOD, L_ROLES, L_STAGE, L_TONE, L_TYPES, L_VAR_KEYS, lAssignLabel, lCondOk, lDrag, lEnsureCore, lFramed, lHasData, lHex, lIsCore, lKind, lMigrate, lNewBlock, lOnTab, lOrderSm, LPageC, lRoleProfit, lRoleSees, lSaleSampleShows, lStarter, L_PAGE_ENTITY, lHealthFull, type LHealth, lListCols, lStarterEntity, lStarterForm, lStarterList, lStarterSale, lTabList, lToneCls, lType, MODULE_DESC, MODULE_GROUP, MODULE_ICON, MODULE_LABEL, MODULES, OPEN_STATUSES, orgOf, ORGS, PAY_TRIGGER, pct, PLATFORM_DOMAIN, portal, PRICE_UNIT, PROVISION_MODULES, ROLE_LABEL, ROLES, rowCls, SNAP_KEEP, SO_FILTERS, SO_HEAD_BTNS, SO_LINE_F, SO_LIST_COLS, SO_LIST_TABS, SO_PERS, SO_SEARCH, SO_SEARCH_DEF, storage, tdCls, tdFirst, tdLast, tempPassword, TENANT_PLAN, todayISO, uid, useApp, verLabel, vnd } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import { AddTenantModal, OrgMark } from '../../lib/modules';
import { hashPassword } from '../../lib/security';
import { listSnapshots, tenantStats } from '../../lib/storage';
import type { AnyRec, AppCtx, CfDef, CfEntity, CfType, ConfirmState, ConsoleTab, DashPeriod, DateRange, Department, DeptCode, LayoutAssign, LayoutVer, LBlock, LBlockCfg, LBlockType, LBtn, LBtnAct, LDataset, LDevice, LDrop, LGrid, LPage, LPeriod, LPos, LPtr, LRow, LStage, LStyle, LTextKind, LTypeDef, MfgConfig, Module, Org, PayStage, PayTrigger, Perms, PriceItem, PriceUnit, Role, SecurityPolicy, SoColDef, StoredData, TenantPlan, TenantReg, Tone, User } from '../../lib/types';
import { cn } from '../../lib/utils';
import { SearchBox } from '../alux/orders';
import { dashRange } from '../dashboard/exec-dashboard';
import { CbSeg } from '../finance/cashbook';
import { LayoutView, lBindSample, LBlockBody, LBusinessView, lDesignCtx, lRowsSample, lSaleSample, lSettle, lSt, LTextBlock } from '../page-builder';
import { LFieldCanvas, LFieldInspector, LFieldPalette, useFieldLayout } from './field-layout';
import { cfKeyClash, formulaIssue, industryProfilesEff, tenantIndustry } from '../../lib/industry';
import { IndustrySheet } from './industry';
import { LDeviceExtra, LPageGridEditor, LSpacingEditor, LVerticalCfg } from './layout-spacing';
import { LContainerCfg } from './layout-containers';
import { ConsoleUiKit } from './ui-kit';

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40', on ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--line))]')}>
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export function PlatformConsole() {
  const { platform } = useApp();
  const tab = platform.consoleTab;
  const meta = CONSOLE_TABS.find((t) => t.id === tab)!;
  return (
    <div className="space-y-5">
      <div className="lg:hidden"><Tabs tabs={CONSOLE_TABS.map((t) => ({ id: t.id, label: t.label }))} value={tab} onChange={platform.setConsoleTab} /></div>
      <p className="sr-only">{meta.desc}</p>
      {tab === 'overview' && <ConsoleOverview />}
      {tab === 'tenants' && <ConsoleTenants />}
      {tab === 'modules' && <ConsoleModules />}
      {tab === 'users' && <ConsoleUsers />}
      {tab === 'design' && <ConsoleDesign />}
      {tab === 'uikit' && <ConsoleUiKit />}
      {tab === 'data' && <ConsoleData />}
      {tab === 'admins' && <ConsoleAdmins />}
    </div>
  );
}

export function usePlatformWho() {
  const { platform } = useApp();
  return platform.admins.find((a) => a.id === platform.userId)?.email ?? 'platform';
}

/** v55.2 URL của màn thiết kế: #/console/design/:page/:verId (verId = id phiên bản hoặc 'new') */
// v56: 'new@<mã doanh nghiệp>' = bản nháp mới của bố cục riêng một doanh nghiệp
const DESIGN_RE = /^#\/console\/design\/([\w-]+)\/([\w@-]+)$/;
/** Doanh nghiệp sở hữu bố cục đang mở ở Studio (null = bố cục chung của 3A) */
export const lOwnerOf = (verId: string, layouts: LayoutVer[]): string | null => (verId.startsWith('new@') ? verId.slice(4) : layouts.find((v) => v.id === verId)?.tenantId ?? null);

/** Mở / đóng màn thiết kế theo URL: tải lại trang, gửi link, nút Back của trình duyệt giữ đúng màn hình */
export function useDesignRoute() {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash));
  useEffect(() => {
    const h = () => setHash(window.location.hash);
    window.addEventListener('hashchange', h); window.addEventListener('popstate', h);
    return () => { window.removeEventListener('hashchange', h); window.removeEventListener('popstate', h); };
  }, []);
  const m = DESIGN_RE.exec(hash);
  const route = m && L_PAGES.some((p) => p.id === m[1] && p.open) ? { page: m[1] as LPage, verId: m[2] } : null;
  const go = (h: string, push: boolean) => { if (push) window.history.pushState({ pb: 1 }, '', h); else window.history.replaceState(window.history.state, '', h); setHash(h); };
  return {
    route,
    open: (p: LPage, verId = 'new') => go(`#/console/design/${p}/${verId}`, true),
    nav: (p: LPage, verId: string) => go(`#/console/design/${p}/${verId}`, false),
    /** mở từ danh sách thì lùi lịch sử (Back không quay lại màn thiết kế), vào thẳng bằng link thì thay URL */
    close: () => { if ((window.history.state as { pb?: number } | null)?.pb) window.history.back(); else go('#/console/design', false); },
  };
}

export function ConsoleDesign() {
  const { platform, notify } = useApp();
  const who = usePlatformWho();
  const [view, setView] = useSticky<'pages' | 'cf'>('Platform.design53', 'pages');
  const [kind, setKind] = useState<'ALL' | 'SUMMARY' | 'BUSINESS'>('ALL');
  const [q, setQ] = useState('');
  const dr = useDesignRoute();
  const setEdit = (p: LPage) => dr.open(p, draftOf(p)?.id ?? 'new');
  const [side, setSide] = useState<{ page: LPage; tab: 'pub' | 'hist'; owner?: string | null } | null>(null);
  // bố cục chung của 3A (bố cục riêng doanh nghiệp từ mẫu ngành mở ở Doanh nghiệp › Ngành & mẫu ngành)
  const vers = (p: LPage) => platform.layouts.filter((v) => v.page === p && !v.tenantId).sort((a, b) => b.version - a.version);
  const draftOf = (p: LPage) => vers(p).find((v) => v.status === 'DRAFT');
  const asg = (p: LPage) => platform.layoutAssigns.filter((a) => a.page === p);
  const verLabel = (id: string) => { const v = platform.layouts.find((x) => x.id === id); return v ? `v${v.version}` : '—'; };
  const cell = (p: LPage, lv: LayoutAssign['level'], prof?: 'TRADING' | 'MFG') => {
    const xs = asg(p).filter((a) => a.level === lv && (!prof || a.profile === prof));
    if (lv === 'TENANT') return xs.length ? `${xs.length} DN` : '—';
    return xs[0] ? verLabel(xs[0].verId) : lv === 'SYSTEM' ? <span className="text-[rgb(var(--muted))]">Giao diện gốc</span> : '—';
  };
  const list = L_PAGES.filter((p) => (kind === 'ALL' || p.kind === kind) && (!q.trim() || fold(p.label).includes(fold(q.trim()))));
  const editor = dr.route ? portal(<LayoutEditor key={dr.route.page} page={dr.route.page} verId={dr.route.verId} onNav={(v) => dr.nav(dr.route!.page, v)} onClose={(pub) => { const p = dr.route!.page; const ow = lOwnerOf(dr.route!.verId, platform.layouts); dr.close(); if (pub) setSide({ page: p, tab: 'pub', owner: ow }); }} />) : null;
  return (
    <div className="space-y-4">
      {editor}
      <div className="flex flex-wrap items-center gap-3">
        <div><h2 className="text-[17px] font-medium">Thiết kế giao diện</h2><p className="text-[13px] text-[rgb(var(--muted))]">Bố cục do 3A thiết kế, áp dụng xuống doanh nghiệp. Doanh nghiệp chỉ xem, không sửa</p></div>
        <div className="ml-4 flex gap-5 self-end" role="tablist">{([['pages', 'Trang'], ['cf', 'Trường tùy chỉnh']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cn('-mb-px border-b-2 py-2 text-[14px]', view === k ? 'border-[rgb(var(--accent))] font-medium' : 'border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>{l}</button>)}</div>
      </div>
      {view === 'cf' ? <ConsoleCustomFields /> : <div className={cn('grid grid-cols-1 gap-4', side && 'xl:grid-cols-[1fr_380px]')}>
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[300px]"><CbSeg label="Loại trang" items={[['ALL', 'Tất cả trang'], ['SUMMARY', 'Tổng hợp'], ['BUSINESS', 'Nghiệp vụ']]} value={kind} onChange={setKind} /></div>
            <div className="ml-auto w-[280px]"><SearchBox value={q} onChange={setQ} placeholder="Tìm trang" /></div>
          </div>
          <div className="glass-card overflow-x-auto rounded-xl">
            <table className="w-full min-w-[900px] whitespace-nowrap text-[13.5px]">
              <thead><tr className="border-b border-[rgb(var(--line))] text-left text-[12px] text-[rgb(var(--muted))]"><th className="px-4 py-2.5 font-normal">Trang</th><th className="px-3 py-2.5 font-normal">Loại</th><th className="px-3 py-2.5 font-normal">Toàn hệ thống</th><th className="px-3 py-2.5 font-normal">Thương mại</th><th className="px-3 py-2.5 font-normal">Xưởng</th><th className="px-3 py-2.5 font-normal">Riêng doanh nghiệp</th><th className="px-3 py-2.5 font-normal">Trạng thái</th><th className="px-4 py-2.5 text-right font-normal">Thao tác</th></tr></thead>
              <tbody>{list.map((p) => { const d = draftOf(p.id); const pub = asg(p.id).length > 0; return (
                <tr key={p.id} className={cn('border-b border-[rgb(var(--line)/0.6)]', side?.page === p.id && 'bg-[rgb(var(--accent)/0.05)]')}>
                  <td className="px-4 py-2.5 font-medium">{p.label}</td>
                  <td className="px-3 py-2.5 text-[rgb(var(--fg2))]">{p.kind === 'SUMMARY' ? 'Tổng hợp' : 'Nghiệp vụ'}</td>
                  <td className="px-3 py-2.5 tabular-nums">{p.open ? cell(p.id, 'SYSTEM') : <span className="text-[rgb(var(--muted))]">Giao diện gốc</span>}</td>
                  <td className="px-3 py-2.5 tabular-nums">{cell(p.id, 'PROFILE', 'TRADING')}</td>
                  <td className="px-3 py-2.5 tabular-nums">{cell(p.id, 'PROFILE', 'MFG')}</td>
                  <td className="px-3 py-2.5 tabular-nums">{cell(p.id, 'TENANT')}</td>
                  <td className="px-3 py-2.5">{!p.open ? <Chip tone="muted">{p.plan}</Chip> : d ? <Chip tone="orange">Nháp v{d.version}</Chip> : pub ? <Chip tone="teal">Đã phát hành</Chip> : <Chip tone="muted">Chưa thiết kế</Chip>}</td>
                  <td className="px-4 py-2 text-right">{p.open ? (
                    <div className="inline-flex gap-2">
                      <button className={cn(btnGhost, btnSm)} onClick={() => setEdit(p.id)}><LayoutTemplate className="h-3.5 w-3.5" aria-hidden />Thiết kế</button>
                      <button className={cn(btnGhost, btnSm)} disabled={!vers(p.id).length} onClick={() => setSide({ page: p.id, tab: 'pub' })}><Rocket className="h-3.5 w-3.5" aria-hidden />Phát hành</button>
                    </div>) : <span className="text-[12.5px] text-[rgb(var(--muted))]">chưa mở</span>}</td>
                </tr>
              ); })}</tbody>
            </table>
          </div>
          <p className="text-[12.5px] text-[rgb(var(--muted))]">Trang nghiệp vụ dùng chung một bố cục cho mọi vai trò, tự ẩn khối người xem không có quyền. Khối lõi của luồng (Duyệt, Xuất kho, Thu tiền, Hủy đơn, trường bắt buộc) di chuyển được, không xóa được. Chưa phát hành thì doanh nghiệp dùng giao diện gốc.</p>
        </div>
        {side && <LayoutPublishPanel key={`${side.page}-${side.owner ?? ''}`} page={side.page} owner={side.owner ?? null} tab={side.tab} setTab={(t) => setSide({ ...side, tab: t })} onClose={() => setSide(null)} onEdit={() => (side.owner ? dr.open(side.page, platform.layouts.find((v) => v.page === side.page && v.tenantId === side.owner && v.status === 'DRAFT')?.id ?? `new@${side.owner}`) : setEdit(side.page))} notify={notify} who={who} />}
      </div>}
    </div>
  );
}

/** 3A Platform › Thiết kế giao diện › Trường tùy chỉnh: 3A định nghĩa, doanh nghiệp chỉ nhập giá trị */
export function ConsoleCustomFields() {
  const { platform, notify } = useApp();
  const who = usePlatformWho();
  // v55.3: trường tùy chỉnh theo đối tượng: đơn bán, khách hàng, lead, sản phẩm (dòng hàng chỉ có ở đơn bán)
  const [entity, setEntity] = useSticky<CfEntity>('Platform.cfEntity553', 'sale');
  const [scope0, setScope] = useState<'HEAD' | 'LINE'>('HEAD');
  const scope = entity === 'sale' ? scope0 : 'HEAD';
  const sale = entity === 'sale';
  const [q, setQ] = useState('');
  const [ed, setEd] = useState<CfDef | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [opt, setOpt] = useState('');
  const tenants = platform.tenants.filter((t) => t.status !== 'SUSPENDED');
  const defs = platform.customFields.filter((d) => d.entity === entity && d.scope === scope).sort((a, b) => a.order - b.order);
  const list = defs.filter((d) => !q.trim() || fold(`${d.label} ${d.key}`).includes(fold(q.trim())));
  const blank = (): CfDef => ({ id: uid('cf'), entity, scope, key: '', label: '', type: 'text', options: [], required: 'NONE', levels: { sys: true, tr: false, mfg: false, tenants: [] },
    where: { form: true, info: true, list: scope === 'HEAD', filter: false }, status: 'ACTIVE', order: Math.max(0, ...platform.customFields.map((d) => d.order)) + 1, at: Date.now(), by: who });
  const lvText = (d: CfDef) => [d.levels.sys && 'Toàn hệ thống', d.levels.tr && 'Mô hình Thương mại', d.levels.mfg && 'Mô hình Xưởng', d.levels.tenants.length > 0 && `Riêng ${d.levels.tenants.map((t) => orgOf(t).shortName).join(', ')}`].filter(Boolean).join(' · ') || '—';
  const whereText = (d: CfDef) => (d.scope === 'LINE' ? [d.where.form && 'Nhập ở Cập nhật thông tin', d.where.info && 'Bảng hàng hóa'] : [d.where.form && 'Form', d.where.info && 'Thông tin', d.where.list && 'Danh sách', d.where.filter && 'Lọc']).filter(Boolean).join(' · ') || '—';
  // v56.2 Nhiệm vụ nội dung: "bắt buộc" = trước khi giao AI (nháp vẫn lưu được)
  const REQ: Record<CfDef['required'], string> = { NONE: 'Không', SAVE: sale ? 'Khi lưu đơn' : entity === 'content_task' ? 'Trước khi giao AI' : 'Khi lưu', APPROVE: 'Khi duyệt đơn' };
  // v56: cùng mã được dùng lại khi phạm vi riêng từng doanh nghiệp tách biệt (bản sao mẫu ngành của mỗi doanh nghiệp)
  const keyTaken = (k: string, id: string) => !!ed && platform.customFields.some((d) => d.entity === entity && d.key === k && d.id !== id && cfKeyClash(d, ed));
  const resKinds = useMemo(() => { const m = new Map<string, string>(); industryProfilesEff(platform.industryProfiles).forEach((p) => p.resourceKinds.forEach((k) => m.set(k.id, `${k.label} (${p.label})`))); return [...m]; }, [platform.industryProfiles]);
  const sameEnt = platform.customFields.filter((d) => d.entity === entity && d.scope === 'HEAD');
  const optList = ed?.type === 'select' || ed?.type === 'checklist';
  const W: Record<CfEntity, [string, string, string, string]> = {
    sale: ['Form lên đơn và Cập nhật thông tin', 'Khối Thông tin đơn hàng', 'Cột trong Quản lý đơn hàng (ẩn sẵn, bật ở Cột hiển thị)', 'Bộ lọc trong Quản lý đơn hàng'],
    customer: ['Form thêm / sửa khách hàng', 'Khối Chi tiết trong hồ sơ khách hàng', 'Cột trong Danh sách khách hàng', 'Bộ lọc (chưa dùng)'],
    lead: ['Form thêm / sửa lead', 'Khối Chi tiết trong hồ sơ dự án / lead', 'Cột trong Data MKT', 'Bộ lọc (chưa dùng)'],
    product: ['Form thêm / sửa sản phẩm', 'Chi tiết sản phẩm', 'Cột danh mục (chưa dùng)', 'Bộ lọc (chưa dùng)'],
    content_task: ['Bảng trượt Nhiệm vụ (tự vào Bước 1; kéo sang bước khác ở Studio) và ngữ cảnh gửi AI', 'Chi tiết (chưa dùng)', 'Cột danh sách nhiệm vụ (chưa dùng)', 'Bộ lọc (chưa dùng)'],
  };
  const errs: string[] = [];
  if (ed) {
    if (!ed.label.trim()) errs.push('Nhập tên trường');
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(ed.key)) errs.push('Mã lưu trữ: chữ thường không dấu, số, gạch dưới, bắt đầu bằng chữ, 2–32 ký tự');
    else if (keyTaken(ed.key, ed.id)) errs.push(`Mã lưu trữ ${ed.key} đã dùng cho trường khác`);
    if (ed.type === 'select' && !(ed.options ?? []).length) errs.push('Danh sách chọn cần ít nhất 1 lựa chọn');
    if (ed.type === 'checklist' && !(ed.options ?? []).length) errs.push('Danh sách công đoạn cần ít nhất 1 công đoạn');
    if (ed.type === 'resource_picker' && !ed.resourceKind) errs.push('Chọn loại tài nguyên');
    if (ed.type === 'formula') { const fi = formulaIssue(ed.formula ?? '', ed.key, sameEnt); if (fi) errs.push(fi); }
    if (ed.scope === 'LINE' && ['datetime_range', 'resource_picker', 'formula', 'checklist', 'media_gallery', 'signature'].includes(ed.type)) errs.push('Kiểu chuyên ngành chỉ dùng ở đầu đơn');
    if (!ed.levels.sys && !ed.levels.tr && !ed.levels.mfg && !ed.levels.tenants.length) errs.push('Chọn nơi áp dụng');
  }
  const open = (d: CfDef | null) => { setEd(d); setIsNew(false); setOpt(''); };
  const save = () => {
    if (!ed) return;
    if (errs.length) return notify(errs[0], 'red');
    const line = ed.scope === 'LINE';
    const d: CfDef = { ...ed, label: ed.label.trim(), at: Date.now(), by: who, options: ed.type === 'select' || ed.type === 'checklist' ? ed.options : undefined, required: line ? 'NONE' : ed.required,
      resourceKind: ed.type === 'resource_picker' ? ed.resourceKind : undefined, rangeKey: ed.type === 'resource_picker' ? ed.rangeKey || undefined : undefined,
      formula: ed.type === 'formula' ? ed.formula?.trim() : undefined, unit: ed.type === 'number' || ed.type === 'formula' ? ed.unit?.trim() || undefined : undefined,
      where: { form: ed.where.form, info: ed.where.info, list: line ? false : ed.where.list, filter: line || !CF_FILTERABLE.includes(ed.type) ? false : ed.where.filter } };
    platform.setCustomFields((all) => (all.some((x) => x.id === d.id) ? all.map((x) => (x.id === d.id ? d : x)) : [...all, d]));
    platform.log(isNew ? 'CF_CREATE' : 'CF_UPDATE', `${CF_ENTITY[entity]} ·${line ? 'dòng hàng' : 'đầu đơn'}: ${d.label} (${d.key}, ${CF_TYPE[d.type]}) · ${lvText(d)}`);
    notify(`Đã lưu trường ${d.label}`, 'teal');
    setIsNew(false); setEd(d);
  };
  const toggle = (d: CfDef) => {
    const st: CfDef['status'] = d.status === 'ACTIVE' ? 'OFF' : 'ACTIVE';
    platform.setCustomFields((all) => all.map((x) => (x.id === d.id ? { ...x, status: st, at: Date.now(), by: who } : x)));
    platform.log('CF_STATUS', `${d.label} (${d.key}): ${st === 'OFF' ? 'ngừng dùng, giữ dữ liệu cũ' : 'dùng lại'}`);
    notify(st === 'OFF' ? `Đã ngừng dùng ${d.label}. Dữ liệu cũ vẫn xem được trong đơn` : `Đã dùng lại ${d.label}`, st === 'OFF' ? 'orange' : 'teal');
    if (ed?.id === d.id) setEd({ ...ed, status: st });
  };
  const move = (d: CfDef, dir: -1 | 1) => { const i = defs.indexOf(d); const o = defs[i + dir]; if (!o) return; platform.setCustomFields((all) => all.map((x) => (x.id === d.id ? { ...x, order: o.order } : x.id === o.id ? { ...x, order: d.order } : x))); };
  const setE = (p: Partial<CfDef>) => ed && setEd({ ...ed, ...p });
  const box = (on: boolean, t: string, set: (v: boolean) => void, dis?: boolean, sub?: string) => (
    <label className={cn('flex items-start gap-2.5 py-1 text-[13.5px]', dis && 'opacity-50')}><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--fg))]" checked={on} disabled={dis} onChange={(e) => set(e.target.checked)} /><span className="flex-1">{t}</span>{sub && <span className="text-[12px] text-[rgb(var(--muted))]">{sub}</span>}</label>
  );
  const nOf = (prof: 'TRADING' | 'MFG') => tenants.filter((t) => (orgOf(t.id).profile === 'MANUFACTURING' ? 'MFG' : 'TRADING') === prof).length;
  return (
    <div className={cn('grid grid-cols-1 gap-4', ed && 'xl:grid-cols-[1fr_400px]')}>
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5 text-[13px]" role="radiogroup" aria-label="Đối tượng">{(Object.keys(CF_ENTITY) as CfEntity[]).map((x) => <button key={x} role="radio" aria-checked={entity === x} className={cn('rounded-md px-3 py-1', entity === x ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')} onClick={() => { setEntity(x); setEd(null); }}>{CF_ENTITY[x]}</button>)}</div>
          {sale && <div className="w-[260px]"><CbSeg label="Vị trí trường" items={[['HEAD', 'Đầu đơn'], ['LINE', 'Dòng hàng']]} value={scope} onChange={(v) => { setScope(v); setEd(null); }} /></div>}
          <div className="ml-auto w-[240px]"><SearchBox value={q} onChange={setQ} placeholder="Tìm trường" /></div>
          <button className={btnPrimary} onClick={() => { setEd(blank()); setIsNew(true); setOpt(''); }}><Plus className="h-4 w-4" aria-hidden />Thêm trường</button>
        </div>
        <div className="glass-card overflow-x-auto rounded-xl">
          <table className="w-full min-w-[860px] whitespace-nowrap text-[13.5px]">
            <thead><tr className="border-b border-[rgb(var(--line))] text-left text-[12px] text-[rgb(var(--muted))]"><th className="px-4 py-2.5 font-normal">Trường</th><th className="px-3 py-2.5 font-normal">Kiểu</th>{scope === 'HEAD' && <th className="px-3 py-2.5 font-normal">Bắt buộc</th>}<th className="px-3 py-2.5 font-normal">Áp dụng cho</th><th className="px-3 py-2.5 font-normal">Hiện ở</th><th className="px-3 py-2.5 font-normal">Trạng thái</th><th className="px-4 py-2.5 text-right font-normal">Thao tác</th></tr></thead>
            <tbody>{list.map((d) => (
              <tr key={d.id} className={cn('border-b border-[rgb(var(--line)/0.6)]', ed?.id === d.id && 'bg-[rgb(var(--accent)/0.05)]', d.status === 'OFF' && 'text-[rgb(var(--muted))]')}>
                <td className="px-4 py-2"><span className="block font-medium">{d.label}</span><Code>{d.key}</Code></td>
                <td className="px-3 py-2">{CF_TYPE[d.type]}{d.type === 'select' ? ` · ${(d.options ?? []).length}` : ''}</td>
                {scope === 'HEAD' && <td className="px-3 py-2">{REQ[d.required]}</td>}
                <td className="max-w-[220px] truncate px-3 py-2" title={lvText(d)}>{lvText(d)}</td>
                <td className="px-3 py-2 text-[rgb(var(--fg2))]">{whereText(d)}</td>
                <td className="px-3 py-2"><Chip tone={d.status === 'ACTIVE' ? 'teal' : 'muted'}>{d.status === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng'}</Chip></td>
                <td className="px-4 py-1.5 text-right"><div className="inline-flex gap-1">
                  <button className={cn(btnGhost, 'p-1.5')} disabled={defs.indexOf(d) === 0} onClick={() => move(d, -1)} aria-label={`Đưa ${d.label} lên`}><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
                  <button className={cn(btnGhost, 'p-1.5')} disabled={defs.indexOf(d) === defs.length - 1} onClick={() => move(d, 1)} aria-label={`Đưa ${d.label} xuống`}><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>
                  <button className={cn(btnGhost, 'p-1.5')} onClick={() => open(d)} aria-label={`Sửa ${d.label}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></button>
                </div></td>
              </tr>
            ))}{!list.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-[13px] text-[rgb(var(--muted))]">Chưa có trường {scope === 'HEAD' ? 'đầu đơn' : 'dòng hàng'}. Bấm Thêm trường</td></tr>}</tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-[rgb(var(--muted))]">Trường đã dùng không xóa được, chỉ ngừng dùng: dữ liệu cũ vẫn giữ và xem được trong đơn. Trường gốc (Khách hàng, Kho xuất, Đơn giá, CK, VAT…) không nằm ở đây. Trường dòng hàng chỉ để ghi chú, không cộng vào tiền.</p>
      </div>
      {ed && (
        <aside className="glass-card h-fit space-y-4 rounded-xl p-4" aria-label="Sửa trường">
          <div className="flex items-center gap-2"><h3 className="font-medium">{isNew ? 'Trường mới' : ed.label}</h3>{!isNew && <Chip tone={ed.status === 'ACTIVE' ? 'teal' : 'muted'}>{ed.status === 'ACTIVE' ? 'Đang dùng' : 'Ngừng dùng'}</Chip>}<button className={cn(btnGhost, 'ml-auto p-1.5')} onClick={() => open(null)} aria-label="Đóng"><X className="h-4 w-4" aria-hidden /></button></div>
          <Field label="Tên trường"><input className={inputCls} value={ed.label} onChange={(e) => setE({ label: e.target.value, ...(isNew ? { key: cfSlug(e.target.value) } : {}) })} placeholder="VD: Hình thức vận chuyển" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mã lưu trữ"><input className={cn(inputCls, 'font-mono text-[13px]')} value={ed.key} disabled={!isNew} onChange={(e) => setE({ key: e.target.value.toLowerCase() })} /></Field>
            <Field label="Kiểu"><select className={inputCls} value={ed.type} disabled={!isNew} onChange={(e) => setE({ type: e.target.value as CfType })}>{(Object.keys(CF_TYPE) as CfType[]).map((t) => <option key={t} value={t}>{CF_TYPE[t]}</option>)}</select></Field>
          </div>
          {!isNew && <p className="-mt-2 text-[12px] text-[rgb(var(--muted))]">Mã lưu trữ và kiểu cố định sau khi tạo để không lệch dữ liệu đã nhập</p>}
          {ed.type === 'resource_picker' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Loại tài nguyên"><select className={inputCls} value={ed.resourceKind ?? ''} onChange={(e) => setE({ resourceKind: e.target.value || undefined })}><option value="">Chọn</option>{resKinds.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></Field>
              <Field label="Kiểm tra trùng lịch theo" hint="Trường Khoảng thời gian cùng đối tượng"><select className={inputCls} value={ed.rangeKey ?? ''} onChange={(e) => setE({ rangeKey: e.target.value || undefined })}><option value="">Không kiểm tra</option>{sameEnt.filter((x) => x.type === 'datetime_range').map((x) => <option key={x.id} value={x.key}>{x.label}</option>)}</select></Field>
            </div>
          )}
          {ed.type === 'formula' && (
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Field label="Công thức" hint={`Mã trường số / tiền: ${sameEnt.filter((x) => (x.type === 'number' || x.type === 'money' || x.type === 'formula') && x.key !== ed.key).map((x) => x.key).join(', ') || 'chưa có'}`}><input className={cn(inputCls, 'font-mono text-[13px]')} value={ed.formula ?? ''} onChange={(e) => setE({ formula: e.target.value })} placeholder="khoi_luong_m2 * don_gia_lap_dat" /></Field>
              <Field label="Đơn vị"><input className={inputCls} value={ed.unit ?? ''} onChange={(e) => setE({ unit: e.target.value })} placeholder="đ" /></Field>
            </div>
          )}
          {ed.type === 'number' && <Field label="Đơn vị"><input className={inputCls} value={ed.unit ?? ''} onChange={(e) => setE({ unit: e.target.value })} placeholder="VD: m², ngày, kg" /></Field>}
          {(ed.type === 'media_gallery' || ed.type === 'signature') && <p className="-mt-1 text-[12px] text-[rgb(var(--muted))]">{ed.type === 'signature' ? 'Chữ ký vẽ trên màn hình, lưu ảnh ở kho tệp riêng của doanh nghiệp kèm mã SHA-256 để đối chiếu' : 'Ảnh nén và lưu ở kho tệp riêng của doanh nghiệp (tối đa 12 ảnh / bản ghi)'}</p>}
          {optList && (
            <Field label={ed.type === 'checklist' ? 'Công đoạn' : 'Lựa chọn'}>
              <div className="space-y-1.5">
                {(ed.options ?? []).map((o, i) => <div key={o} className="flex items-center gap-2 rounded-lg border border-[rgb(var(--line))] px-2.5 py-1.5 text-[13.5px]"><span className="flex-1">{o}</span><button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setE({ options: (ed.options ?? []).filter((_, j) => j !== i) })} aria-label={`Bỏ ${o}`}><X className="h-3.5 w-3.5" aria-hidden /></button></div>)}
                <div className="flex gap-2"><input className={inputCls} value={opt} onChange={(e) => setOpt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && opt.trim() && !(ed.options ?? []).includes(opt.trim())) { setE({ options: [...(ed.options ?? []), opt.trim()] }); setOpt(''); } }} placeholder="Thêm lựa chọn" aria-label="Thêm lựa chọn" /><button className={btnGhost} disabled={!opt.trim() || (ed.options ?? []).includes(opt.trim())} onClick={() => { setE({ options: [...(ed.options ?? []), opt.trim()] }); setOpt(''); }}><Plus className="h-4 w-4" aria-hidden />Thêm</button></div>
                {!isNew && <p className="text-[12px] text-[rgb(var(--muted))]">Bỏ lựa chọn không xóa giá trị đã nhập trong đơn cũ</p>}
              </div>
            </Field>
          )}
          {ed.scope === 'HEAD' && <Field label="Bắt buộc"><CbSeg label="Bắt buộc" items={sale ? [['NONE', 'Không'], ['SAVE', 'Khi lưu đơn'], ['APPROVE', 'Khi duyệt đơn']] : [['NONE', 'Không'], ['SAVE', REQ.SAVE]]} value={ed.required} onChange={(v) => setE({ required: v })} /></Field>}
          {ed.scope === 'HEAD' && ed.type === 'check' && ed.required !== 'NONE' && <p className="-mt-2 text-[12px] text-[rgb(var(--muted))]">Tích chọn bắt buộc: phải tích mới lưu / duyệt được</p>}
          <div className="border-t border-[rgb(var(--line))] pt-3">
            <p className="mb-1 text-[12px] text-[rgb(var(--muted))]">Áp dụng cho</p>
            {box(ed.levels.sys, 'Toàn hệ thống', (v) => setE({ levels: { ...ed.levels, sys: v } }))}
            {box(ed.levels.tr, 'Mô hình Thương mại', (v) => setE({ levels: { ...ed.levels, tr: v } }), ed.levels.sys, `${nOf('TRADING')} doanh nghiệp`)}
            {box(ed.levels.mfg, 'Mô hình Xưởng', (v) => setE({ levels: { ...ed.levels, mfg: v } }), ed.levels.sys, `${nOf('MFG')} doanh nghiệp`)}
            <p className="mb-1 mt-2 text-[12px] text-[rgb(var(--muted))]">Riêng doanh nghiệp</p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-[rgb(var(--line))] px-2.5 py-1">{tenants.map((t) => <Fragment key={t.id}>{box(ed.levels.tenants.includes(t.id), orgOf(t.id).name, (v) => setE({ levels: { ...ed.levels, tenants: v ? [...ed.levels.tenants, t.id] : ed.levels.tenants.filter((x) => x !== t.id) } }), ed.levels.sys)}</Fragment>)}</div>
          </div>
          <div className="border-t border-[rgb(var(--line))] pt-3">
            <p className="mb-1 text-[12px] text-[rgb(var(--muted))]">Hiện ở</p>
            {ed.scope === 'HEAD' ? (
              <>
                {box(ed.where.form, W[entity][0], (v) => setE({ where: { ...ed.where, form: v } }))}
                {box(ed.where.info, W[entity][1], (v) => setE({ where: { ...ed.where, info: v } }))}
                {box(ed.where.list, W[entity][2], (v) => setE({ where: { ...ed.where, list: v } }), entity === 'product')}
                {box(ed.where.filter && CF_FILTERABLE.includes(ed.type), W[entity][3], (v) => setE({ where: { ...ed.where, filter: v } }), !sale || !CF_FILTERABLE.includes(ed.type), sale && !CF_FILTERABLE.includes(ed.type) ? 'kiểu này chưa lọc' : undefined)}
              </>
            ) : (
              <>
                {box(ed.where.form, 'Nhập ở Cập nhật thông tin đơn', (v) => setE({ where: { ...ed.where, form: v } }))}
                {box(ed.where.info, 'Cột trong bảng Hàng hóa', (v) => setE({ where: { ...ed.where, info: v } }))}
              </>
            )}
          </div>
          <div className="flex gap-2 border-t border-[rgb(var(--line))] pt-3">
            {!isNew && <button className={btnGhost} onClick={() => toggle(ed)}>{ed.status === 'ACTIVE' ? 'Ngừng dùng' : 'Dùng lại'}</button>}
            <button className={cn(btnPrimary, 'ml-auto')} onClick={save}>{isNew ? 'Tạo trường' : 'Lưu trường'}</button>
          </div>
          {errs.length > 0 && <p className="text-[12.5px] text-[rgb(var(--danger-fg))]">{errs[0]}</p>}
        </aside>
      )}
    </div>
  );
}

export function LayoutPublishPanel({ page, tab, setTab, onClose, onEdit, notify, who, owner = null }: { page: LPage; tab: 'pub' | 'hist'; setTab: (t: 'pub' | 'hist') => void; onClose: () => void; onEdit: () => void; notify: AppCtx['notify']; who: string; /** v56 bố cục riêng của doanh nghiệp: chỉ phát hành cho chính doanh nghiệp đó */ owner?: string | null }) {
  const { platform } = useApp();
  const pg = L_PAGES.find((p) => p.id === page)!;
  const vers = platform.layouts.filter((v) => v.page === page && (v.tenantId ?? null) === owner).sort((a, b) => b.version - a.version);
  const draft = vers.find((v) => v.status === 'DRAFT');
  const target = draft ?? vers[0];
  const asg = platform.layoutAssigns.filter((a) => a.page === page && (!owner || (a.level === 'TENANT' && a.tenantId === owner)));
  const tenants = platform.tenants.filter((t) => t.status !== 'SUSPENDED');
  const profOf = (id: string) => (orgOf(id).profile === 'MANUFACTURING' ? 'MFG' : 'TRADING');
  const [lv, setLv] = useState<{ sys: boolean; tr: boolean; mfg: boolean; ten: boolean }>(owner ? { sys: false, tr: false, mfg: false, ten: true } : { sys: true, tr: false, mfg: false, ten: false });
  const [pilot, setPilot] = useState(false);
  const [tenant, setTenant] = useState(owner ?? tenants[0]?.id ?? '');
  const [note, setNote] = useState(draft?.note ?? '');
  const eff = owner ? { sys: false, tr: false, mfg: false, ten: true } : pilot ? { sys: false, tr: false, mfg: false, ten: true } : lv;
  const any = eff.sys || eff.tr || eff.mfg || (eff.ten && !!tenant);
  const publish = () => {
    if (!target || !any) return;
    const now = Date.now();
    platform.setLayouts((all) => all.map((v) => (v.id === target.id ? { ...v, status: 'PUBLISHED', note: note.trim() || v.note, publishedAt: now, publishedBy: who } : v)));
    const mk = (level: LayoutAssign['level'], profile: 'TRADING' | 'MFG' | null, tenantId: string | null): LayoutAssign => ({ id: `${page}|${level}|${profile ?? ''}|${tenantId ?? ''}|`, page, level, profile, tenantId, role: null, verId: target.id, at: now, by: who });
    const add = [...(eff.sys ? [mk('SYSTEM', null, null)] : []), ...(eff.tr ? [mk('PROFILE', 'TRADING', null)] : []), ...(eff.mfg ? [mk('PROFILE', 'MFG', null)] : []), ...(eff.ten && tenant ? [mk('TENANT', null, tenant)] : [])];
    platform.setLayoutAssigns((all) => [...all.filter((a) => !add.some((x) => x.id === a.id)), ...add]);
    platform.log('LAYOUT_PUBLISH', `${pg.label}${owner ? ' (bố cục riêng)' : ''} v${target.version} → ${add.map(lAssignLabel).join(', ')}${note.trim() ? `: ${note.trim()}` : ''}`, owner ?? undefined);
    notify(`Đã phát hành ${pg.label} v${target.version} cho ${add.map(lAssignLabel).join(', ')}`, 'teal');
    setNote('');
  };
  const unassign = (a: LayoutAssign) => { platform.setLayoutAssigns((all) => all.filter((x) => x.id !== a.id)); platform.log('LAYOUT_UNASSIGN', `${pg.label}: gỡ ${lAssignLabel(a)}, dùng cấp trên / giao diện gốc`); notify(`Đã gỡ ${lAssignLabel(a)}`, 'orange'); };
  const restore = (v: LayoutVer) => {
    const max = Math.max(0, ...vers.map((x) => x.version));
    platform.setLayouts((all) => (draft ? all.map((x) => (x.id === draft.id ? { ...x, blocks: v.blocks, at: Date.now(), by: who, note: `Khôi phục từ v${v.version}` } : x))
      : [{ id: uid('lv'), schema: 1, page, version: max + 1, status: 'DRAFT', role: null, blocks: v.blocks, by: who, at: Date.now(), note: `Khôi phục từ v${v.version}`, ...(owner ? { tenantId: owner, fromIndustry: v.fromIndustry } : {}) }, ...all]));
    platform.log('LAYOUT_RESTORE', `${pg.label}: khôi phục v${v.version} thành bản nháp`);
    notify(`Đã chép v${v.version} thành bản nháp, phát hành để áp dụng`, 'teal');
  };
  const box = (on: boolean, dis: boolean, t: string, s: string, set: () => void) => (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-lg border border-[rgb(var(--line))] px-3 py-2.5', dis && 'cursor-not-allowed opacity-50')}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--fg))]" checked={on} disabled={dis} onChange={set} />
      <span><span className="block text-[13.5px] font-medium">{t}</span><span className="block text-[12px] text-[rgb(var(--muted))]">{s}</span></span>
    </label>
  );
  const inUse = (v: LayoutVer) => asg.filter((a) => a.verId === v.id);
  return (
    <aside className="glass-card h-fit space-y-4 rounded-xl p-4" aria-label={`Phát hành ${pg.label}`}>
      <div className="flex items-center gap-2"><h3 className="font-medium">{pg.label}</h3>{draft ? <Chip tone="orange">Nháp v{draft.version}</Chip> : target ? <Chip tone="teal">v{target.version}</Chip> : null}<button className={cn(btnGhost, 'ml-auto p-1.5')} onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" aria-hidden /></button></div>
      <div className="flex gap-5 border-b border-[rgb(var(--line))]" role="tablist">
        {([['pub', 'Phát hành'], ['hist', `Lịch sử ${vers.length}`]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('-mb-px border-b-2 py-2 text-[13.5px]', tab === k ? 'border-[rgb(var(--accent))] font-medium' : 'border-transparent text-[rgb(var(--muted))]')}>{l}</button>)}
      </div>
      {tab === 'pub' ? (!target ? <p className="text-[13px] text-[rgb(var(--muted))]">Chưa có bản thiết kế. <button className="text-[rgb(var(--accent))] hover:underline" onClick={onEdit}>Thiết kế trang</button></p> : (
        <>
          <p className="text-[12px] text-[rgb(var(--muted))]">Phát hành v{target.version}{target.status === 'DRAFT' ? ' (bản nháp)' : ''} cho</p>
          {owner ? <p className="rounded-lg border border-[rgb(var(--line))] px-3 py-2.5 text-[13.5px]"><span className="block font-medium">Riêng {orgOf(owner).name}</span><span className="block text-[12px] text-[rgb(var(--muted))]">Bố cục riêng (nhân bản từ mẫu ngành) chỉ áp dụng cho doanh nghiệp này</span></p> : <>
          <div className="space-y-2">
            {box(eff.sys, pilot, 'Toàn hệ thống', 'mọi doanh nghiệp chưa có bố cục riêng', () => setLv({ ...lv, sys: !lv.sys }))}
            {box(eff.tr, pilot, 'Mô hình Thương mại', `${tenants.filter((t) => profOf(t.id) === 'TRADING').length} doanh nghiệp`, () => setLv({ ...lv, tr: !lv.tr }))}
            {box(eff.mfg, pilot, 'Mô hình Xưởng', `${tenants.filter((t) => profOf(t.id) === 'MFG').length} doanh nghiệp`, () => setLv({ ...lv, mfg: !lv.mfg }))}
            {box(eff.ten, pilot, 'Riêng doanh nghiệp', 'chọn doanh nghiệp bên dưới', () => setLv({ ...lv, ten: !lv.ten }))}
          </div>
          <p className="text-[12px] text-[rgb(var(--muted))]">Cấp nhỏ đè cấp lớn: riêng doanh nghiệp → mô hình → toàn hệ thống</p>
          <label className="flex items-center gap-2 text-[13.5px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={pilot} onChange={(e) => setPilot(e.target.checked)} />Phát hành thử cho 1 doanh nghiệp trước</label>
          {(pilot || lv.ten) && <select className={inputCls} value={tenant} onChange={(e) => setTenant(e.target.value)} aria-label="Doanh nghiệp">{tenants.map((t) => <option key={t.id} value={t.id}>{orgOf(t.id).name}</option>)}</select>}
          </>}
          <Field label="Ghi chú phiên bản"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: thêm khối Còn phải thu" /></Field>
          <button className={cn(btnPrimary, 'w-full justify-center')} disabled={!any} onClick={publish}><Rocket className="h-4 w-4" aria-hidden />Phát hành v{target.version}</button>
          {asg.length > 0 && (
            <div className="border-t border-[rgb(var(--line))] pt-3">
              <p className="mb-1 text-[12px] text-[rgb(var(--muted))]">Đang áp dụng</p>
              {asg.map((a) => <div key={a.id} className="flex items-center gap-2 py-1 text-[13px]"><span>{lAssignLabel(a)}</span><Code>{verLabel(platform.layouts, a.verId)}</Code><button className="ml-auto text-[12.5px] text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => unassign(a)}>Gỡ</button></div>)}
            </div>
          )}
        </>
      )) : (
        <div>{vers.map((v) => { const use = inUse(v); return (
          <div key={v.id} className="flex items-start gap-3 border-t border-[rgb(var(--line)/0.6)] py-2.5 first:border-t-0">
            <Code>v{v.version}</Code>
            <div className="min-w-0 flex-1"><p className="text-[13.5px]">{v.status === 'DRAFT' ? 'Nháp' : use.length ? `Đang áp dụng: ${use.map(lAssignLabel).join(', ')}` : 'Đã thay'}</p><p className="text-[12px] text-[rgb(var(--muted))]">{v.publishedBy ?? v.by} · {new Date(v.publishedAt ?? v.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {v.blocks.length} khối</p>{v.note && <p className="text-[12.5px]">{v.note}</p>}</div>
            {v.status === 'DRAFT' ? <button className={cn(btnGhost, btnSm)} onClick={onEdit}>Mở</button> : <button className={cn(btnGhost, btnSm)} onClick={() => restore(v)}>Khôi phục</button>}
          </div>
        ); })}</div>
      )}
    </aside>
  );
}

export function LGridEditor({ blocks, commit, sel, setSel, page, stage, cf, etab, health, grid }: { health?: (b: LBlock) => LHealth[]; blocks: LBlock[]; commit: (b: LBlock[]) => void; sel: string | null; setSel: (id: string | null) => void; page: LPage; stage: LStage; cf: CfDef[]; etab: string; /** v57a lưới trang */ grid?: LGrid }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1100);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
  // v57a lưới 8px: 1 hàng = 8px, khoảng cách dọc nằm trong chiều cao khối; cổ điển: 1 hàng = 56px + khoảng cách
  const G = lGridOf(grid);
  const L_GAP = G.gap;
  const colW = (W - 11 * L_GAP) / 12, cx = colW + L_GAP, cy = G.step;
  type Drag = { id: string; mode: 'move' | 'resize'; sx: number; sy: number; o: LPos; dx: number; dy: number };
  const [drag, setDrag] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<LPos | null>(null);
  const sample = useMemo(() => new Map<LDataset, LRow[]>(), []);
  const rowsOf = (ds: LDataset) => { if (!sample.has(ds)) sample.set(ds, lRowsSample(ds)); return sample.get(ds)!; };
  const want = (d: Drag): LPos => (d.mode === 'move'
    ? { ...d.o, x: Math.max(0, Math.min(12 - d.o.w, Math.round(d.o.x + d.dx / cx))), y: Math.max(0, Math.round(d.o.y + d.dy / cy)) }
    : { ...d.o, w: Math.max(1, Math.min(12 - d.o.x, Math.round(d.o.w + d.dx / cx))), h: Math.max(G.fine ? 2 : 1, Math.min(G.maxH, Math.round(d.o.h + d.dy / cy))) });
  const live = drag ? lSettle(blocks.map((b) => (b.id === drag.id ? { ...b, pos: { ...b.pos, lg: want(drag) } } : b)), drag.id, G.maxH) : blocks;
  const bottom = Math.max(G.fine ? 30 : 4, ...live.map((b) => b.pos.lg.y + b.pos.lg.h)) + (G.fine ? 20 : 3);
  const px = (p: LPos): CSSProperties => ({ left: p.x * cx, top: p.y * cy, width: p.w * colW + (p.w - 1) * L_GAP, height: Math.max(8, G.hPx(p.h)) });
  const start = (e: LPtr, b: LBlock, mode: Drag['mode']) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as Element).setPointerCapture(e.pointerId); setSel(b.id); setDrag({ id: b.id, mode, sx: e.clientX, sy: e.clientY, o: b.pos.lg, dx: 0, dy: 0 }); };
  const move = (e: LPtr) => { if (drag) setDrag({ ...drag, dx: e.clientX - drag.sx, dy: e.clientY - drag.sy }); };
  const end = () => { if (!drag) return; const moved = drag.dx || drag.dy; const next = live; setDrag(null); if (moved) commit(next); };
  const dropPos = (e: LDrop): LPos | null => {
    if (!lDrag.type || !ref.current) return null;
    const r = ref.current.getBoundingClientRect(); const d = lType(lDrag.type).def;
    return { x: Math.max(0, Math.min(12 - d.w, Math.floor((e.clientX - r.left) / cx))), y: Math.max(0, Math.floor((e.clientY - r.top) / cy)), w: d.w, h: G.fine ? (lDrag.type === 'K-Divider' || lDrag.type === 'K-Spacer' ? 2 + Math.ceil(G.gap / 8) : lFineH(d.h)) : d.h };
  };
  return (
    <div ref={ref} className="relative select-none" style={{ height: bottom * cy }}
      onDragOver={(e) => { const p = dropPos(e); if (p) { e.preventDefault(); setDrop(p); } }} onDragLeave={() => setDrop(null)}
      onDrop={(e) => { const p = dropPos(e); setDrop(null); if (!p || !lDrag.type) return; e.preventDefault(); const nb = lNewBlock(lDrag.type, p, page); lDrag.type = null; commit(lSettle([...blocks, nb], nb.id, G.maxH)); setSel(nb.id); }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) setSel(null); }}>
      <div className="pointer-events-none absolute inset-0 flex" style={{ gap: L_GAP }} aria-hidden>{Array.from({ length: 12 }, (_, i) => <div key={i} className="h-full flex-1 border-x border-dashed border-[rgb(var(--accent)/0.22)] bg-[rgb(var(--accent)/0.035)]" />)}</div>
      {drop && <div className="absolute rounded-xl border-[1.5px] border-dashed border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)]" style={px(drop)} />}
      {live.map((b) => {
        const on = drag?.id === b.id;
        const p = b.pos.lg;
        const float: CSSProperties = on ? (drag!.mode === 'move' ? { ...px(drag!.o), transform: `translate(${drag!.dx}px, ${drag!.dy}px) rotate(-0.6deg)`, zIndex: 5 } : { ...px({ ...p }), zIndex: 5 }) : px(p);
        return (
          <Fragment key={b.id}>
            {on && <div className="absolute rounded-xl border-[1.5px] border-dashed border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)]" style={px(p)} />}
            <section className={cn('absolute flex flex-col overflow-hidden rounded-xl border bg-[rgb(var(--surface))]', !lOnTab(b, blocks, etab) && 'opacity-35', sel === b.id ? 'border-[rgb(var(--accent))] ring-[3px] ring-[rgb(var(--accent)/0.18)]' : 'border-[rgb(var(--line))]', on && 'opacity-95 shadow-2xl')} style={float} onClick={() => setSel(b.id)} aria-label={`Khối ${b.config.title || lType(b.type).label}`}>
              <div className="flex items-center gap-1.5 px-2 pt-2 text-[rgb(var(--muted))]">
                <button className="cursor-grab touch-none rounded p-0.5 hover:bg-[rgb(var(--ink)/0.06)] active:cursor-grabbing" onPointerDown={(e) => start(e, b, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label={`Kéo ${b.config.title}`}><GripVertical className="h-3.5 w-3.5" aria-hidden /></button>
                <span className="min-w-0 truncate text-[12.5px] font-medium text-[rgb(var(--fg))]">{b.config.title || lType(b.type).label}</span>
                {(health?.(b).length ?? 0) > 0 && <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[rgb(var(--warn)/0.18)] px-1 text-[10.5px] text-[rgb(var(--warn))]" title={health!(b).map((h) => `${h.label}: ${h.msg}`).join('\n')} data-health={health!(b).length}><AlertTriangle className="h-2.5 w-2.5" aria-hidden />{health!(b).length} trường</span>}
                {lIsCore(b.type) ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-[rgb(var(--line))] px-1 text-[10.5px]" title="Khối lõi: không xóa được"><Lock className="h-2.5 w-2.5" aria-hidden />lõi</span> : <span className="shrink-0 rounded border border-[rgb(var(--line))] px-1 font-mono text-[10.5px]">span {p.w}</span>}
                {(b.config.stages?.length || b.config.roles?.length) ? <span className="shrink-0 text-[10.5px] text-[rgb(var(--accent))]" title="Có điều kiện hiện">có điều kiện</span> : null}
                <span className="ml-auto flex shrink-0 gap-0.5">
                  <button className={cn('rounded p-1 hover:bg-[rgb(var(--ink)/0.06)]', sel === b.id && 'bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]')} onClick={(e) => { e.stopPropagation(); setSel(b.id); }} aria-label="Cài đặt khối"><Settings className="h-3.5 w-3.5" aria-hidden /></button>
                  {sel === b.id && lType(b.type).tier !== 'biz' && <button className="rounded p-1 hover:bg-[rgb(var(--ink)/0.06)]" onClick={(e) => { e.stopPropagation(); const c = { ...b, id: uid('lb'), pos: { ...b.pos, lg: { ...p, y: p.y + p.h } } }; commit(lSettle([...blocks, c], c.id, G.maxH)); setSel(c.id); }} aria-label="Nhân bản khối"><Copy className="h-3.5 w-3.5" aria-hidden /></button>}
                  {lIsCore(b.type) ? <span className="p-1" title="Khối lõi: không xóa được"><Lock className="h-3.5 w-3.5" aria-label="Khối lõi" /></span>
                    : sel === b.id && <button className="rounded p-1 hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--danger-fg))]" onClick={(e) => { e.stopPropagation(); commit(lSettle(blocks.filter((x) => x.id !== b.id), undefined, G.maxH)); setSel(null); }} aria-label="Xóa khối"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>}
                </span>
              </div>
              {(() => { const s = lSt(b.config, true, b.type === 'K-Divider'); return (
                <div className={cn('pointer-events-none min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-1', b.type === 'K-Text' && lToneCls(b.config), b.type === 'K-Text' && 'mx-2 mb-2 rounded-lg border', s.cls.includes('lst-box') && 'mx-2 mb-2', s.cls)} style={s.css}>
                  <div className="h-full" style={s.z ? { zoom: s.z } : undefined}>{page !== 'home' ? lSaleSample({ b, stage, cf }) : <LBlockBody b={b} rows={lHasData(b.type) ? rowsOf(b.config.ds) : []} />}</div>
                </div>
              ); })()}
              <button className="absolute bottom-0.5 right-0.5 h-4 w-4 cursor-se-resize touch-none" onPointerDown={(e) => start(e, b, 'resize')} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label={`Đổi kích thước ${b.config.title}`}>
                <span className={cn('absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-br border-b-2 border-r-2', sel === b.id ? 'border-[rgb(var(--accent))]' : 'border-[rgb(var(--muted))]')} />
              </button>
            </section>
          </Fragment>
        );
      })}
    </div>
  );
}

/** Danh sách sắp thứ tự + bật / tắt (trường của khối Thông tin, cột của bảng Hàng hóa); trường khóa luôn bật */
export function LFieldList({ all, c, onCfg, cfIds }: { all: { id: string; label: string; lock?: boolean }[]; c: LBlockCfg; onCfg: (p: Partial<LBlockCfg>) => void; cfIds: string[] }) {
  const ids = all.map((x) => x.id);
  const ord = [...(c.fields ?? []).filter((x) => ids.includes(x)), ...ids.filter((x) => !(c.fields ?? []).includes(x))];
  const off = c.off ?? [];
  const mv = (id: string, d: -1 | 1) => { const i = ord.indexOf(id); const j = i + d; if (j < 0 || j >= ord.length) return; const n = [...ord]; [n[i], n[j]] = [n[j], n[i]]; onCfg({ fields: n }); };
  return (
    <div className="space-y-1">{ord.map((id, i) => { const f = all.find((x) => x.id === id)!; const on = f.lock || !off.includes(id); return (
      <div key={id} className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--line)/0.7)] px-2 py-1 text-[13px]">
        <span className="min-w-0 flex-1 truncate">{f.label}{cfIds.includes(id) && <i className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))] align-middle" title="Trường tùy chỉnh" />}</span>
        <button className="rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-30" disabled={i === 0} onClick={() => mv(id, -1)} aria-label={`Đưa ${f.label} lên`}><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
        <button className="rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-30" disabled={i === ord.length - 1} onClick={() => mv(id, 1)} aria-label={`Đưa ${f.label} xuống`}><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>
        {f.lock ? <span className="inline-flex w-[74px] items-center justify-end gap-1 text-[11.5px] text-[rgb(var(--muted))]"><Lock className="h-3 w-3" aria-hidden />bắt buộc</span>
          : <label className="flex w-[74px] items-center justify-end gap-1.5 text-[11.5px] text-[rgb(var(--muted))]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={on} onChange={() => onCfg({ off: on ? [...off, id] : off.filter((x) => x !== id) })} aria-label={`Hiện ${f.label}`} />hiện</label>}
      </div>
    ); })}</div>
  );
}

/** v54.1 nhóm điều khiển có nhãn (không dùng thẻ label: bấm nhãn không chọn nhầm ô đầu) */
export function LFg({ label, children }: { label: string; children: ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">{label}</p>{children}</div>;
}

/** v54.1 chọn màu: Mặc định, màu đặc biệt (không nền, viền mảnh…), bảng màu hệ thống, màu tự chọn (#) */
export function LColorPick({ value, onChange, label, special }: { value?: string; onChange: (v: string | undefined) => void; label: string; special?: [string, string, string][] }) {
  const sw = 'relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-[rgb(var(--ink)/0.18)]';
  const ring = 'ring-2 ring-[rgb(var(--fg))] ring-offset-2 ring-offset-[rgb(var(--surface))]';
  const custom = lHex(value) ? value : '';
  const none = <i className="absolute left-1/2 top-[-2px] h-[calc(100%+4px)] w-px -translate-x-1/2 rotate-45 bg-[rgb(var(--danger-fg))]" aria-hidden />;
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
      <button type="button" role="radio" aria-checked={!value || value === 'auto'} aria-label="Mặc định" title="Mặc định" onClick={() => onChange(undefined)} className={cn(sw, 'grid place-items-center bg-[rgb(var(--surface))] text-[10.5px] font-medium text-[rgb(var(--muted))]', (!value || value === 'auto') && ring)}>A</button>
      {special?.map(([k, l, bg]) => <button key={k} type="button" role="radio" aria-checked={value === k} aria-label={l} title={l} onClick={() => onChange(k)} className={cn(sw, value === k && ring)} style={{ background: bg }}>{k === 'none' && none}</button>)}
      {Object.entries(L_TONE).map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={value === k} aria-label={t.label} title={t.label} onClick={() => onChange(k)} className={cn(sw, value === k && ring)} style={{ background: `rgb(var(${t.base}))` }} />)}
      <label className={cn(sw, 'grid cursor-pointer place-items-center border-dashed text-[11px] text-[rgb(var(--muted))]', custom && ring)} title="Màu tự chọn" style={custom ? { background: custom, borderStyle: 'solid' } : undefined}>{!custom && '#'}
        <input type="color" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" value={custom || '#ff8c00'} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: màu tự chọn`} />
      </label>
      {custom && <span className="font-mono text-[11.5px] text-[rgb(var(--muted))]">{custom}</span>}
    </div>
  );
}

/** v54.1 thẻ Kiểu của khối */
export function LStyleEditor({ b, onCfg }: { b: LBlock; onCfg: (c: Partial<LBlockCfg>) => void }) {
  const c = b.config; const s = c.st ?? {};
  const set = (p: Partial<LStyle>) => { const n: Record<string, unknown> = { ...s, ...p }; Object.keys(n).forEach((k) => { if (n[k] === undefined) delete n[k]; }); onCfg({ st: Object.keys(n).length ? (n as LStyle) : undefined }); };
  const isText = b.type === 'K-Text', isDiv = b.type === 'K-Divider', isSp = b.type === 'K-Spacer';
  const hasTitle = isDiv || lHasData(b.type) || lIsCore(b.type) || lType(b.type).tier === 'biz' || (isText && lFramed(c) && !c.hideTitle);
  const grp = (t: string, kids: ReactNode) => <section className="space-y-3 border-t border-[rgb(var(--line))] pt-3 first:border-t-0 first:pt-0"><h4 className="text-[12.5px] font-medium text-[rgb(var(--fg2))]">{t}</h4>{kids}</section>;
  const tint = !!s.bg && !['none', 'surface', 'sunken', 'auto'].includes(s.bg);
  const BG: [string, string, string][] = [['none', 'Không nền', 'rgb(var(--surface))'], ['surface', 'Nền thẻ', 'rgb(var(--surface))'], ['sunken', 'Nền chìm', 'rgb(var(--sunken))']];
  const BD: [string, string, string][] = [...(isDiv ? [] : [['none', 'Không viền', 'rgb(var(--surface))'] as [string, string, string]]), ['line', 'Mảnh (màu đường kẻ)', 'rgb(var(--line))'], ['strong', 'Đậm', 'rgb(var(--ink) / 0.3)']];
  return (
    <div className="space-y-4">
      {!isSp && !isDiv && grp('Chữ', <>
        <LFg label="Cỡ chữ">{isText
          ? <CbSeg label="Cỡ chữ" items={[['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn'], ['xl', 'Rất lớn']]} value={c.size ?? 'md'} onChange={(v) => onCfg({ size: v })} />
          : <CbSeg label="Cỡ chữ" items={[['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn'], ['xl', 'Rất lớn']]} value={s.fs ?? 'md'} onChange={(v) => set({ fs: v === 'md' ? undefined : v })} />}</LFg>
        <LFg label="Màu chữ"><LColorPick value={s.color} onChange={(v) => set({ color: v })} label="Màu chữ" /></LFg>
      </>)}
      {hasTitle && grp(isDiv ? 'Nhãn trên đường kẻ' : 'Tiêu đề khối', <>
        <LFg label="Cỡ"><CbSeg label="Cỡ tiêu đề" items={[['auto', 'Mặc định'], ['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn'], ['xl', 'Rất lớn']]} value={s.tSize ?? 'auto'} onChange={(v) => set({ tSize: v === 'auto' ? undefined : v })} /></LFg>
        <LFg label="Độ đậm"><CbSeg label="Độ đậm tiêu đề" items={[['auto', 'Mặc định'], ['normal', 'Thường'], ['medium', 'Vừa'], ['bold', 'Đậm']]} value={s.tW ?? 'auto'} onChange={(v) => set({ tW: v === 'auto' ? undefined : v })} /></LFg>
        <LFg label="Màu"><LColorPick value={s.tColor} onChange={(v) => set({ tColor: v })} label="Màu tiêu đề" /></LFg>
      </>)}
      {!isDiv && grp('Nền', <>
        <LFg label="Màu nền"><LColorPick value={s.bg} onChange={(v) => set({ bg: v })} label="Màu nền" special={BG} /></LFg>
        {tint && <LFg label="Độ đậm nền"><CbSeg label="Độ đậm nền" items={[['soft', 'Nhạt'], ['mid', 'Vừa'], ['solid', 'Đặc']]} value={s.bgA ?? 'soft'} onChange={(v) => set({ bgA: v === 'soft' ? undefined : v })} /></LFg>}
        {tint && s.bgA === 'solid' && !s.color && <p className="-mt-1 text-[12px] text-[rgb(var(--muted))]">Nền đặc: chữ tự đổi trắng / đen cho dễ đọc</p>}
      </>)}
      {grp(isDiv ? 'Đường kẻ' : 'Viền', <>
        <LFg label={isDiv ? 'Màu đường' : 'Màu viền'}><LColorPick value={s.bd} onChange={(v) => set({ bd: v })} label={isDiv ? 'Màu đường' : 'Màu viền'} special={BD} /></LFg>
        <div className="grid grid-cols-2 gap-3">
          <LFg label="Kiểu"><CbSeg label="Kiểu viền" items={[['solid', 'Liền'], ['dashed', 'Gạch'], ['dotted', 'Chấm']]} value={s.bdS ?? 'solid'} onChange={(v) => set({ bdS: v === 'solid' ? undefined : v })} /></LFg>
          <LFg label="Độ dày"><CbSeg label="Độ dày viền" items={[['1', '1'], ['2', '2'], ['3', '3']]} value={String(s.bdW ?? 1) as '1' | '2' | '3'} onChange={(v) => set({ bdW: v === '1' ? undefined : (Number(v) as 2 | 3) })} /></LFg>
        </div>
      </>)}
      {!isDiv && !isSp && grp('Góc và bóng', <>
        <LFg label="Bo góc"><CbSeg label="Bo góc" items={[['none', 'Vuông'], ['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn'], ['xl', 'Tròn']]} value={s.r ?? 'md'} onChange={(v) => set({ r: v === 'md' ? undefined : v })} /></LFg>
        <LFg label="Đổ bóng"><CbSeg label="Đổ bóng" items={[['none', 'Không'], ['sm', 'Nhẹ'], ['md', 'Vừa'], ['lg', 'Đậm']]} value={s.sh ?? 'none'} onChange={(v) => set({ sh: v === 'none' ? undefined : v })} /></LFg>
      </>)}
      {b.type === 'K-Chart-Line' && grp('Màu biểu đồ', <>
        <LFg label="Đường 1"><LColorPick value={c.colors?.[0]} onChange={(v) => onCfg({ colors: [v ?? '', c.colors?.[1] ?? ''] })} label="Màu đường 1" /></LFg>
        <LFg label="Đường 2"><LColorPick value={c.colors?.[1]} onChange={(v) => onCfg({ colors: [c.colors?.[0] ?? '', v ?? ''] })} label="Màu đường 2" /></LFg>
      </>)}
      {(b.type === 'K-Table-Compact' || b.type === 'K-SaleList') && grp('Bảng', <>
        <LFg label="Mật độ dòng"><CbSeg label="Mật độ dòng" items={[['sm', 'Gọn'], ['md', 'Vừa'], ['lg', 'Thoáng']]} value={c.dense ?? 'md'} onChange={(v) => onCfg({ dense: v === 'md' ? undefined : v })} /></LFg>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={!!c.zebra} onChange={(e) => onCfg({ zebra: e.target.checked || undefined })} />Sọc xen kẽ</label>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={b.type === 'K-SaleList' ? c.thBg !== false : !!c.thBg} onChange={(e) => onCfg({ thBg: e.target.checked })} />Tô nền dòng tiêu đề</label>
      </>)}
      {b.type === 'K-Tabs' && grp('Kiểu tab', <CbSeg label="Kiểu tab" items={[['line', 'Gạch chân'], ['pill', 'Khối'], ['chip', 'Viên']]} value={c.tabStyle ?? 'line'} onChange={(v) => onCfg({ tabStyle: v === 'line' ? undefined : v })} />)}
      <div className="flex items-start gap-3 border-t border-[rgb(var(--line))] pt-3">
        <p className="flex-1 text-[12px] text-[rgb(var(--muted))]">Màu trong bảng màu tự đổi theo giao diện sáng / tối. Màu tự chọn (#) giữ nguyên ở cả hai, nên chọn màu đủ tương phản.</p>
        <button type="button" className={cn(btnGhost, 'h-8 shrink-0 py-0 text-[12.5px]')} onClick={() => onCfg({ st: undefined, colors: undefined, zebra: undefined, dense: undefined, thBg: undefined, tabStyle: undefined, ...(isText ? { size: undefined } : {}) })}>Về mặc định</button>
      </div>
    </div>
  );
}

export function LBlockSettings({ b, onCfg, onBlock, onPos, page, cf, tabs, etab, setEtab, onFields, ext, fine }: { /** v57a phần thêm theo nhóm: nội dung khối chuyên ngành, khoảng cách & khung, thiết bị */ ext?: { c?: ReactNode; s?: ReactNode; v?: ReactNode }; /** v57a lưới 8px */ fine?: boolean; onFields?: () => void; b: LBlock; onCfg: (c: Partial<LBlockCfg>) => void; onBlock: (p: Partial<LBlock>) => void; onPos: (p: Partial<LPos>) => void; page: LPage; cf: CfDef[]; tabs: { id: string; label: string }[]; etab: string; setEtab: (t: string) => void }) {
  const c = b.config; const ds = L_DS[c.ds];
  const core = lIsCore(b.type);
  const data = lHasData(b.type);
  const taRef = useRef<HTMLTextAreaElement>(null);
  /** Chèn định dạng vào ô nội dung: bọc phần đang chọn, hoặc thêm tiền tố đầu dòng */
  const fmt = (kind: 'b' | 'i' | 'ul' | 'h' | 'a') => {
    const el = taRef.current; const v = c.text ?? ''; const s = el?.selectionStart ?? v.length, e = el?.selectionEnd ?? v.length; const sel = v.slice(s, e);
    let next = v;
    if (kind === 'b' || kind === 'i') { const m = kind === 'b' ? '**' : '*'; next = `${v.slice(0, s)}${m}${sel || 'chữ'}${m}${v.slice(e)}`; }
    else if (kind === 'a') next = `${v.slice(0, s)}[${sel || 'chữ'}](https://)${v.slice(e)}`;
    else { const ls = v.lastIndexOf('\n', s - 1) + 1; const pre = kind === 'ul' ? '- ' : '## '; next = v.slice(ls, ls + pre.length) === pre ? v.slice(0, ls) + v.slice(ls + pre.length) : `${v.slice(0, ls)}${pre}${v.slice(ls)}`; }
    onCfg({ text: next });
    requestAnimationFrame(() => el?.focus());
  };
  const [varOpen, setVarOpen] = useState(false);
  const [openBtn, setOpenBtn] = useState<string | null>(null);
  /** Chèn biến tự điền vào chỗ con trỏ trong ô nội dung */
  const insVar = (k: string) => { const el = taRef.current; const v = c.text ?? ''; const s = el?.selectionStart ?? v.length; onCfg({ text: `${v.slice(0, s)}{${k}}${v.slice(el?.selectionEnd ?? s)}` }); requestAnimationFrame(() => el?.focus()); };
  const L_BSTYLE: Record<LBtn['style'], string> = { icon: 'Chỉ icon', ghost: 'Viền', text: 'Chỉ chữ', primary: 'Nút chính' };
  const cfLine = cf.filter((d) => d.entity === 'sale' && d.scope === 'LINE' && d.status === 'ACTIVE' && d.where.info);
  const chk = (on: boolean, t: string, set: () => void) => <label key={t} className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={on} onChange={set} />{t}</label>;
  const num = (k: keyof LPos, label: string, max: number) => <Field label={label}><input className={inputCls} type="number" min={k === 'w' || k === 'h' ? 1 : k === 'x' ? 1 : 1} max={max} value={k === 'x' || k === 'y' ? b.pos.lg[k] + 1 : b.pos.lg[k]} onChange={(e) => { const n = Number(e.target.value) || 1; onPos({ [k]: k === 'x' || k === 'y' ? n - 1 : n }); }} /></Field>;
  const fieldSel = (label: string, v: string | undefined, set: (x: string) => void, none?: boolean) => (
    <Field label={label}><select className={inputCls} value={v ?? ''} onChange={(e) => set(e.target.value)}>{none && <option value="">Không</option>}{ds.fields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></Field>
  );
  const typeLabel = lType(b.type).label;
  const [sec, setSec] = useState<'c' | 's' | 'v'>('c');
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><Settings className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><h3 className="font-medium">Cài đặt khối</h3></div>
      <div className="flex items-center gap-2"><Code>{b.type}</Code><span className="text-[12.5px] text-[rgb(var(--muted))]">{typeLabel}</span>{core && <span className="inline-flex items-center gap-1 rounded border border-[rgb(var(--line))] px-1.5 text-[11.5px] text-[rgb(var(--muted))]"><Lock className="h-3 w-3" aria-hidden />Khối lõi</span>}</div>
      {core && <p className="flex gap-2 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[12.5px] text-[rgb(var(--fg2))]"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Khối lõi của luồng bán hàng: được di chuyển, đổi kích thước, ẩn trường không bắt buộc. Không xóa được, luôn hiện trên mọi thiết bị. Nút thao tác theo trạng thái đơn do luồng nghiệp vụ điều khiển</p>}
      <div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5" role="tablist" aria-label="Nhóm cài đặt">
        {([['c', 'Nội dung'], ['s', 'Kiểu'], ['v', 'Hiển thị']] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={sec === k} onClick={() => setSec(k)} className={cn('flex-1 rounded-md py-1.5 text-[13px]', sec === k ? 'bg-[rgb(var(--fg))] font-medium text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>{l}</button>)}
      </div>
      {sec === 's' && <>{ext?.s}<LStyleEditor b={b} onCfg={onCfg} /></>}
      {sec === 'c' && <>
      {b.type !== 'K-Icons' && <Field label={b.type === 'K-SaleList' ? 'Tên khối (chỉ trong màn thiết kế)' : 'Tiêu đề'}><input className={inputCls} value={c.title} onChange={(e) => onCfg({ title: e.target.value })} /></Field>}
      {ext?.c}
      {b.type === 'K-Text' && (
        <>
          <Field label="Kiểu">
            <div className="grid grid-cols-4 gap-1.5">{(Object.keys(L_KIND) as LTextKind[]).map((k) => <button key={k} type="button" aria-pressed={lKind(c) === k} onClick={() => onCfg({ kind: k, tone: undefined, frame: undefined })} className={cn('rounded-lg border px-2 py-1.5 text-left text-[12px] leading-tight', lKind(c) === k ? 'border-[rgb(var(--fg))] font-medium text-[rgb(var(--fg))] ring-1 ring-[rgb(var(--fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--fg2))]')}>{L_KIND[k]}</button>)}</div>
          </Field>
          <Field label="Nội dung">
            <div className="overflow-hidden rounded-lg border border-[rgb(var(--line))]">
              <div className="flex items-center gap-0.5 border-b border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.03)] p-1">{([['b', Bold, 'Đậm'], ['i', Italic, 'Nghiêng'], ['ul', List, 'Danh sách'], ['h', Heading2, 'Tiêu đề nhỏ'], ['a', Link2, 'Liên kết']] as const).map(([k, I, l]) => <button key={k} type="button" className="grid h-7 w-8 place-items-center rounded-md text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.06)]" onClick={() => fmt(k)} aria-label={l} title={l}><I className="h-4 w-4" aria-hidden /></button>)}
                <button type="button" className="ml-auto rounded-md px-2 py-1 font-mono text-[12px] text-[rgb(var(--accent-fg))] hover:bg-[rgb(var(--accent)/0.08)]" onClick={() => setVarOpen(!varOpen)} aria-expanded={varOpen}>{'{ }'} Chèn biến</button></div>
              <textarea ref={taRef} className="block min-h-[96px] w-full resize-y bg-transparent px-3 py-2 text-[13px] outline-none" value={c.text ?? ''} onChange={(e) => onCfg({ text: e.target.value })} aria-label="Nội dung khối text" />
            </div>
            {varOpen && <div className="mt-1.5 flex flex-wrap gap-1">{L_VAR_KEYS[page].map((k) => <button key={k} type="button" className="rounded border border-[rgb(var(--accent)/0.35)] bg-[rgb(var(--accent)/0.06)] px-1.5 font-mono text-[11.5px] text-[rgb(var(--accent-fg))]" onClick={() => insVar(k)}>{`{${k}}`}</button>)}</div>}
            <p className="mt-1.5 text-[12px] text-[rgb(var(--muted))]">**đậm**, *nghiêng*, dòng "- " là danh sách, "## " là tiêu đề nhỏ, [chữ](https://…) là liên kết, {'{biến}'} tự điền khi hiển thị. Không chèn mã, không chèn ảnh</p>
          </Field>
          {(lKind(c) === 'title' || lKind(c) === 'heading') && <Field label="Dòng phụ"><input className={inputCls} value={c.sub ?? ''} onChange={(e) => onCfg({ sub: e.target.value || undefined })} placeholder="VD: Cập nhật {giờ cập nhật} · còn {số ngày còn lại} ngày" /></Field>}
          <Field label="Căn"><CbSeg label="Căn" items={[['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']]} value={c.align ?? 'left'} onChange={(v) => onCfg({ align: v })} /></Field>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={lFramed(c)} onChange={(e) => onCfg({ frame: e.target.checked })} />Hiện khung (viền, nền)</label>
          {lFramed(c) && <label className="-mt-2 flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={!c.hideTitle} onChange={(e) => onCfg({ hideTitle: !e.target.checked })} />Hiện tiêu đề khối trong khung</label>}
        </>
      )}
      {(b.type === 'K-Button' || b.type === 'K-Icons') && (() => {
        const bs = c.buttons ?? [];
        const setBs = (n: LBtn[]) => onCfg({ buttons: n });
        const acts = (Object.keys(L_ACT) as LBtnAct[]).filter((a) => L_ACT[a].pages.includes(page));
        const mv = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= bs.length) return; const n = [...bs]; [n[i], n[j]] = [n[j], n[i]]; setBs(n); };
        return (
          <>
            <div className="flex items-center"><p className="text-[12px] text-[rgb(var(--muted))]">Các nút · theo thứ tự</p><button type="button" className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-[rgb(var(--accent-fg))] hover:underline" onClick={() => { const nb: LBtn = { id: uid('bt'), icon: 'Printer', label: 'Nút mới', style: 'ghost', act: 'print' }; setBs([...bs, nb]); setOpenBtn(nb.id); }}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm nút</button></div>
            <div className="space-y-1.5">{bs.map((x, i) => {
              const I = L_ICONSET[x.icon] ?? Info; const open = openBtn === x.id;
              const set = (p: Partial<LBtn>) => setBs(bs.map((y) => (y.id === x.id ? { ...y, ...p } : y)));
              return (
                <div key={x.id} className={cn('rounded-lg border', open ? 'border-[rgb(var(--fg))]' : 'border-[rgb(var(--line)/0.8)]')}>
                  <div className="flex items-center gap-1.5 px-2 py-1.5 text-[13px]">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpenBtn(open ? null : x.id)} aria-expanded={open}>
                      <span className="inline-flex min-w-0 max-w-[55%] items-center gap-1.5 rounded-md border border-[rgb(var(--line))] px-2 py-0.5"><I className="h-3.5 w-3.5 shrink-0" aria-hidden /><span className="truncate">{x.style === 'icon' ? 'icon' : x.label || L_ACT[x.act]?.label || '—'}</span></span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-[rgb(var(--muted))]">{L_BSTYLE[x.style]} · {L_ACT[x.act]?.label ?? x.act}</span>
                    </button>
                    <button type="button" className="rounded p-0.5 text-[rgb(var(--muted))] disabled:opacity-30" disabled={i === 0} onClick={() => mv(i, -1)} aria-label="Đưa nút lên"><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
                    <button type="button" className="rounded p-0.5 text-[rgb(var(--muted))] disabled:opacity-30" disabled={i === bs.length - 1} onClick={() => mv(i, 1)} aria-label="Đưa nút xuống"><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>
                    <button type="button" className="rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setBs(bs.filter((y) => y.id !== x.id))} aria-label="Bỏ nút"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                  </div>
                  {open && (
                    <div className="space-y-3 border-t border-[rgb(var(--line)/0.7)] p-2.5">
                      <Field label="Icon"><div className="grid grid-cols-8 gap-1">{Object.keys(L_ICONSET).map((k) => { const J = L_ICONSET[k]; return <button key={k} type="button" aria-pressed={x.icon === k} aria-label={`Icon ${k}`} title={k} onClick={() => set({ icon: k })} className={cn('grid h-7 place-items-center rounded-md border', x.icon === k ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'border-[rgb(var(--line)/0.6)] text-[rgb(var(--fg2))]')}><J className="h-3.5 w-3.5" aria-hidden /></button>; })}</div></Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Nhãn"><input className={inputCls} value={x.label} onChange={(e) => set({ label: e.target.value })} aria-label="Nhãn nút" /></Field>
                        <Field label="Kiểu nút"><select className={inputCls} value={x.style} onChange={(e) => set({ style: e.target.value as LBtn['style'] })} aria-label="Kiểu nút"><option value="icon">Chỉ icon</option><option value="ghost">Viền</option><option value="text">Chỉ chữ (nút phụ)</option><option value="primary">Nút chính</option></select></Field>
                      </div>
                      <LFg label="Màu nút"><LColorPick value={x.tone} onChange={(v) => set({ tone: v })} label="Màu nút" /></LFg>
                      <Field label="Hành động"><select className={inputCls} value={x.act} onChange={(e) => { const a = e.target.value as LBtnAct; set({ act: a, arg: undefined, icon: L_ACT[a].icon }); }} aria-label="Hành động">
                        <optgroup label="Chung · trang nào cũng có">{acts.filter((a) => L_ACT[a].pages.length === L_ALL_PAGES.length).map((a) => <option key={a} value={a}>{L_ACT[a].label}</option>)}</optgroup>
                        <optgroup label={`Riêng trang ${L_PAGES.find((p) => p.id === page)?.label ?? ''}`}>{acts.filter((a) => L_ACT[a].pages.length < L_ALL_PAGES.length).map((a) => <option key={a} value={a}>{L_ACT[a].label}</option>)}</optgroup>
                      </select></Field>
                      {L_ACT[x.act]?.arg === 'module' && <Field label="Trang mở"><select className={inputCls} value={x.arg ?? ''} onChange={(e) => set({ arg: e.target.value || undefined })} aria-label="Trang mở"><option value="">Chọn trang</option>{(Object.keys(MODULE_LABEL) as Module[]).map((m) => <option key={m} value={m}>{MODULE_LABEL[m]}</option>)}</select></Field>}
                      {L_ACT[x.act]?.arg === 'url' && <Field label="Liên kết (https://…)"><input className={inputCls} value={x.arg ?? ''} onChange={(e) => set({ arg: e.target.value.trim() || undefined })} placeholder="https://" aria-label="Liên kết" /></Field>}
                    </div>
                  )}
                </div>
              );
            })}</div>
            <Field label="Căn"><CbSeg label="Căn" items={[['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']]} value={c.align ?? 'right'} onChange={(v) => onCfg({ align: v })} /></Field>
            <p className="text-[12px] text-[rgb(var(--muted))]">Hành động chọn từ danh sách của trang nên không có nút bấm không làm gì; quyền vẫn kiểm ở nghiệp vụ (nút không có quyền tự ẩn hoặc mờ).{page === 'sale-detail' ? ' Khi có nút In / Thao tác khác ở đây, thanh trên không lặp lại' : ''}</p>
          </>
        );
      })()}
      {b.type === 'K-Filter' && (
        <>
          <Field label="Kỳ cho chọn"><div className="grid grid-cols-4 gap-1.5">{(['WEEK', 'MONTH', 'QUARTER', 'YEAR'] as DashPeriod[]).map((p) => { const cur = c.periods?.length ? c.periods : (['WEEK', 'MONTH', 'QUARTER', 'YEAR'] as DashPeriod[]); return chk(cur.includes(p), L_PER[p], () => { const n = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]; if (n.length) onCfg({ periods: (['WEEK', 'MONTH', 'QUARTER', 'YEAR'] as DashPeriod[]).filter((x) => n.includes(x)) }); }); })}</div></Field>
          {chk(c.showCompare !== false, 'Hiện "So với kỳ trước"', () => onCfg({ showCompare: c.showCompare === false }))}
          {chk(c.showDept !== false, 'Hiện lọc phòng ban', () => onCfg({ showDept: c.showDept === false }))}
          <Field label="Căn"><CbSeg label="Căn" items={[['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']]} value={c.align ?? 'right'} onChange={(v) => onCfg({ align: v })} /></Field>
          <p className="text-[12px] text-[rgb(var(--muted))]">Khối Chỉ số đặt kỳ "Theo Bộ lọc chung của trang" tính theo kỳ đang chọn. Khối dữ liệu đơn bán, lead, khách hàng tự lọc theo phòng. Quyền xem phòng như Tổng quan gốc: Trưởng phòng xem phòng mình, Sales xem số của mình</p>
        </>
      )}
      {b.type === 'K-Tabs' && (() => {
        const ts = c.tabs ?? [];
        const setTs = (n: { id: string; label: string }[]) => onCfg({ tabs: n });
        const mv = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= ts.length) return; const n = [...ts]; [n[i], n[j]] = [n[j], n[i]]; setTs(n); };
        return (
          <>
            <Field label="Các tab · ô tròn = tab đang thiết kế">
              <div className="space-y-1.5">{ts.map((t, i) => (
                <div key={t.id} className="flex items-center gap-1.5">
                  <input type="radio" name="l-etab" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={etab === t.id} onChange={() => setEtab(t.id)} aria-label={`Thiết kế tab ${t.label}`} />
                  <input className={inputCls} value={t.label} onChange={(e) => setTs(ts.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)))} aria-label={`Tên tab ${i + 1}`} />
                  <button type="button" className="rounded p-0.5 text-[rgb(var(--muted))] disabled:opacity-30" disabled={i === 0} onClick={() => mv(i, -1)} aria-label="Đưa tab lên"><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
                  <button type="button" className="rounded p-0.5 text-[rgb(var(--muted))] disabled:opacity-30" disabled={i === ts.length - 1} onClick={() => mv(i, 1)} aria-label="Đưa tab xuống"><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>
                  <button type="button" className="rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))] disabled:opacity-30" disabled={ts.length <= 1} onClick={() => setTs(ts.filter((x) => x.id !== t.id))} aria-label={`Bỏ tab ${t.label}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                </div>
              ))}</div>
              <button type="button" className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-[rgb(var(--accent-fg))] hover:underline" onClick={() => { const t = { id: uid('tb'), label: `Tab ${ts.length + 1}` }; setTs([...ts, t]); setEtab(t.id); }}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm tab</button>
            </Field>
            <p className="text-[12px] text-[rgb(var(--muted))]">Đặt khối vào tab ở mục "Thuộc tab" của từng khối; khối không thuộc tab nào hiện ở mọi tab. Tab không còn khối nào người xem thấy sẽ tự ẩn với người đó</p>
          </>
        );
      })()}
      {b.type === 'K-Divider' && chk(!c.hideTitle, 'Hiện tiêu đề làm nhãn trên đường kẻ', () => onCfg({ hideTitle: !c.hideTitle }))}
      {b.type === 'K-SaleList' && (() => {
        const head = cf.filter((d) => d.entity === 'sale' && d.scope === 'HEAD' && d.status === 'ACTIVE');
        const cfL = head.filter((d) => d.where.list);
        const all: SoColDef[] = [...SO_LIST_COLS, ...cfL.map((d): SoColDef => ({ id: `cf:${d.key}`, label: d.label, g: 'Trường tùy chỉnh', num: d.type === 'money' || d.type === 'number', sum: d.type === 'money' || d.type === 'number' }))];
        const cur = c.cols?.length ? c.cols : SO_LIST_COLS.filter((x) => x.def).map((x) => x.id);
        const tog = (k: 'hbOff' | 'fltOff' | 'sumOff', id: string) => { const l = c[k] ?? []; onCfg({ [k]: l.includes(id) ? l.filter((x) => x !== id) : [...l, id] }); };
        const sIn = c.sIn?.length ? c.sIn : SO_SEARCH_DEF;
        const grp = (t: string, kids: ReactNode) => <section className="space-y-2.5 rounded-lg border border-[rgb(var(--line)/0.8)] p-3"><h4 className="text-[12.5px] font-medium">{t}</h4>{kids}</section>;
        const two = 'grid grid-cols-2 gap-x-3 gap-y-1.5';
        const sums = all.filter((x) => x.sum && (x.lock || cur.includes(x.id)));
        return (
          <>
            <Field label="Nguồn dữ liệu"><select className={inputCls} value={c.src ?? 'sale'} onChange={() => onCfg({ src: 'sale' })} aria-label="Nguồn dữ liệu"><option value="sale">Đơn bán</option><option disabled>Khách hàng (bản sau)</option><option disabled>Lead (bản sau)</option><option disabled>Phiếu thu chi (bản sau)</option></select></Field>
            {grp('Đầu bảng', <>
              {chk(!c.hideHead, 'Hiện tiêu đề trang', () => onCfg({ hideHead: !c.hideHead || undefined }))}
              {!c.hideHead && <>
                <input className={inputCls} value={c.head ?? ''} placeholder="Quản lý đơn hàng" onChange={(e) => onCfg({ head: e.target.value || undefined })} aria-label="Tiêu đề trang" />
                <div className="flex flex-wrap gap-1">{L_VAR_KEYS['sale-list'].map((k) => <button key={k} type="button" className="rounded border border-[rgb(var(--accent)/0.35)] bg-[rgb(var(--accent)/0.06)] px-1.5 font-mono text-[11.5px] text-[rgb(var(--accent-fg))]" onClick={() => onCfg({ head: `${c.head || 'Quản lý đơn hàng'} {${k}}` })}>{`{${k}}`}</button>)}</div>
              </>}
              {chk(c.search !== false, 'Ô tìm kiếm', () => onCfg({ search: c.search === false ? undefined : false }))}
              {c.search !== false && <>
                <input className={inputCls} value={c.ph ?? ''} placeholder="Chữ gợi ý (trống: tự theo trường tìm)" onChange={(e) => onCfg({ ph: e.target.value || undefined })} aria-label="Chữ gợi ý ô tìm kiếm" />
                <p className="text-[12px] text-[rgb(var(--muted))]">Tìm theo</p>
                <div className={two}>{[...SO_SEARCH, ...head.filter((d) => d.type === 'text' || d.type === 'select').map((d) => ({ id: `cf:${d.key}`, label: d.label }))].map((x) => chk(sIn.includes(x.id), x.label, () => { const n = sIn.includes(x.id) ? sIn.filter((y) => y !== x.id) : [...sIn, x.id]; onCfg({ sIn: n.length ? n : undefined }); }))}</div>
              </>}
              {chk(!c.hidePer, 'Ô chọn kỳ', () => onCfg({ hidePer: !c.hidePer || undefined }))}
              <Field label={c.hidePer ? 'Kỳ cố định' : 'Kỳ mặc định'}><select className={inputCls} value={c.per0 ?? 'M'} onChange={(e) => onCfg({ per0: e.target.value === 'M' ? undefined : e.target.value })} aria-label="Kỳ mặc định">{SO_PERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <p className="text-[12px] text-[rgb(var(--muted))]">Nút đầu bảng</p>
              <div className={two}>{SO_HEAD_BTNS.map((x) => chk(!(c.hbOff ?? []).includes(x.id), x.label, () => tog('hbOff', x.id)))}</div>
            </>)}
            {grp('Tab trạng thái', <LFieldList all={SO_LIST_TABS} c={c} onCfg={onCfg} cfIds={[]} />)}
            {grp('Bộ lọc · trường được lọc', <div className={two}>{[...SO_FILTERS, ...head.filter((d) => d.where.filter && CF_FILTERABLE.includes(d.type)).map((d) => ({ id: `cf:${d.key}`, label: d.label }))].map((x) => chk(!(c.fltOff ?? []).includes(x.id), x.label, () => tog('fltOff', x.id)))}</div>)}
            {grp('Cột mặc định cho doanh nghiệp', <>
              {(['Thông tin', 'Tiến độ', 'Tiền', 'Khách hàng', 'Người tạo', 'Trường tùy chỉnh'] as SoColDef['g'][]).filter((g) => all.some((x) => x.g === g)).map((g) => (
                <div key={g}><p className="mb-1 text-[12px] text-[rgb(var(--muted))]">{g === 'Khách hàng' || g === 'Người tạo' ? `${g} ›` : g}</p>
                  <div className={two}>{all.filter((x) => x.g === g).map((x) => <label key={x.id} className={cn('flex items-center gap-2 text-[13px]', x.lock && 'text-[rgb(var(--muted))]')}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={!!x.lock || cur.includes(x.id)} disabled={x.lock} onChange={() => onCfg({ cols: cur.includes(x.id) ? cur.filter((y) => y !== x.id) : [...cur, x.id] })} />{x.label}</label>)}</div>
                </div>
              ))}
              <div className={two}>{chk(c.stt !== false, 'Cột STT', () => onCfg({ stt: c.stt === false ? undefined : false }))}{chk(c.pick !== false, 'Ô chọn dòng', () => onCfg({ pick: c.pick === false ? undefined : false }))}</div>
              <LFg label="Số dòng mỗi trang"><CbSeg label="Số dòng mỗi trang" items={[['20', '20'], ['50', '50'], ['100', '100']]} value={String(c.size0 ?? 20) as '20' | '50' | '100'} onChange={(v) => onCfg({ size0: v === '20' ? undefined : Number(v) })} /></LFg>
            </>)}
            {grp('Dòng tổng', <>
              {chk(c.sumRow !== false, 'Hiện dòng tổng dưới bảng', () => onCfg({ sumRow: c.sumRow === false ? undefined : false }))}
              {c.sumRow !== false && <><p className="text-[12px] text-[rgb(var(--muted))]">Cộng các cột (cột Số / Tiền đang bật)</p><div className={two}>{sums.map((x) => chk(!(c.sumOff ?? []).includes(x.id), x.label, () => tog('sumOff', x.id)))}</div></>}
            </>)}
            <p className="text-[12px] text-[rgb(var(--muted))]">Mỗi người vẫn tự đổi cột, kỳ, số dòng cho riêng mình; nút "Mặc định" trong Cột hiển thị trả về bộ cột này. Thao tác trên dòng (Sửa, Hủy, Xóa) vẫn theo quyền; trường lọc 3A tắt thì không áp điều kiện cũ người dùng đã lưu.</p>
          </>
        );
      })()}
      {b.type === 'K-RecordList' && (() => {
        // v55.3 khối Danh sách bản ghi: cột trường tùy chỉnh (chưa chỉnh: theo cờ "Danh sách"); cột gốc của bảng giữ nguyên
        const defs = cf.filter((d) => d.entity === (c.entity ?? 'customer') && d.scope === 'HEAD' && d.status === 'ACTIVE');
        const on = lListCols(defs, c).map((d) => `cf:${d.key}`);
        const all = [...on, ...defs.map((d) => `cf:${d.key}`).filter((k) => !on.includes(k))];
        const put = (ids: string[], vis: string[]) => onCfg({ fields: ids, off: ids.filter((k) => !vis.includes(k)) });
        const mv = (k: string, d: -1 | 1) => { const i = all.indexOf(k); const j = i + d; if (j < 0 || j >= all.length) return; const n = [...all]; [n[i], n[j]] = [n[j], n[i]]; put(n, on); };
        const lab = (k: string) => defs.find((d) => `cf:${d.key}` === k)?.label ?? k;
        return (
          <Field label="Cột trường tùy chỉnh trong bảng">
            {all.length ? <div className="space-y-1">{all.map((k, i) => (
              <div key={k} className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--line)/0.7)] px-2 py-1 text-[13px]" data-col={k}>
                <span className="min-w-0 flex-1 truncate">{lab(k)}</span>
                <button className="rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-30" disabled={i === 0} onClick={() => mv(k, -1)} aria-label={`Đưa cột ${lab(k)} lên`}><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
                <button className="rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-30" disabled={i === all.length - 1} onClick={() => mv(k, 1)} aria-label={`Đưa cột ${lab(k)} xuống`}><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>
                <label className="flex w-[60px] items-center justify-end gap-1.5 text-[11.5px] text-[rgb(var(--muted))]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={on.includes(k)} onChange={() => put(all, on.includes(k) ? on.filter((x) => x !== k) : [...on, k])} aria-label={`Hiện cột ${lab(k)}`} />hiện</label>
              </div>
            ))}</div> : <p className="text-[12.5px] text-[rgb(var(--muted))]">Chưa có trường tùy chỉnh cho {CF_ENTITY[c.entity ?? 'customer']}. Tạo ở tab Trường tùy chỉnh</p>}
            <p className="mt-1.5 text-[12px] text-[rgb(var(--muted))]">Cột trường tùy chỉnh thêm vào bảng thật của phân hệ, trước cột Thao tác. Mỗi ô một giá trị, đúng quy tắc bảng</p>
          </Field>
        );
      })()}
      {(b.type === 'K-RecordDetail' || b.type === 'K-RecordForm') && (
        <div className="space-y-2 rounded-lg border border-[rgb(var(--line))] p-3">
          <p className="text-[13px] font-medium">Bố cục trường</p>
          <p className="text-[12.5px] text-[rgb(var(--muted))]">{(c.sections ?? []).length} nhóm · {(c.sections ?? []).reduce((n, s) => n + s.fields.length, 0)} trường đã đặt. Kéo thả trường giữa các nhóm, chỉnh độ rộng, nhãn{b.type === 'K-RecordForm' ? ', gợi ý, chỉ đọc, bắt buộc' : ''} ở khung giữa</p>
          <button className={cn(btnPrimary, 'w-full justify-center')} onClick={onFields}><LayoutTemplate className="h-4 w-4" aria-hidden />Thiết kế bố cục trường</button>
        </div>
      )}
      {b.type === 'K-Order-Lines' && (
        <>
          <Field label="Cột của bảng Hàng hóa"><LFieldList all={[...SO_LINE_F, ...cfLine.map((d) => ({ id: `cf:${d.key}`, label: d.label }))]} c={c} onCfg={onCfg} cfIds={cfLine.map((d) => `cf:${d.key}`)} /></Field>
          <p className="flex gap-2 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[12.5px] text-[rgb(var(--fg2))]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Cột tính tiền (Đơn giá, CK, VAT, Thành tiền) là trường gốc nối với tổng đơn và bút toán. Tắt cột chỉ ẩn khỏi màn hình, không đổi cách tính tiền. Trường tùy chỉnh dòng hàng chỉ để ghi chú</p>
          <Field label="Trên điện thoại"><CbSeg label="Trên điện thoại" items={[['card', 'Dạng thẻ'], ['table', 'Bảng (cuộn ngang)']]} value={c.smView ?? 'card'} onChange={(v) => onCfg({ smView: v })} /></Field>
        </>
      )}
      {data && <Field label="Nguồn dữ liệu"><select className={inputCls} value={c.ds} onChange={(e) => { const d = e.target.value as LDataset; onCfg({ ds: d, field: L_DS[d].fields[1]?.id ?? 'count', series: [L_DS[d].fields[1]?.id ?? 'count'], filter: '', group: L_DS[d].dims[0].id, cols: [], sort: undefined }); }}>{(Object.keys(L_DS) as LDataset[]).map((k) => <option key={k} value={k}>{L_DS[k].label}</option>)}</select></Field>}
      {data && ds.filters.length > 1 && <Field label="Lọc"><select className={inputCls} value={c.filter ?? ''} onChange={(e) => onCfg({ filter: e.target.value })}>{ds.filters.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></Field>}
      {b.type === 'K-Stat-Simple' && (
        <>
          {fieldSel('Chỉ tiêu', c.field, (x) => onCfg({ field: x, agg: x === 'count' ? 'count' : c.agg === 'count' ? 'sum' : c.agg }))}
          <Field label="Cách tính"><CbSeg label="Cách tính" items={[['sum', 'Tổng'], ['count', 'Đếm'], ['avg', 'Trung bình']]} value={c.field === 'count' ? 'count' : c.agg ?? 'sum'} onChange={(v) => onCfg({ agg: v, field: v === 'count' ? 'count' : c.field === 'count' ? ds.fields[1]?.id ?? 'count' : c.field })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kỳ"><select className={inputCls} value={c.period ?? 'month'} onChange={(e) => onCfg({ period: e.target.value as LPeriod })}>{(Object.keys(L_PERIOD) as LPeriod[]).map((k) => <option key={k} value={k}>{L_PERIOD[k]}</option>)}</select></Field>
            <Field label="So sánh"><select className={inputCls} value={c.compare ? '1' : ''} onChange={(e) => onCfg({ compare: !!e.target.value })}><option value="1">Kỳ trước</option><option value="">Không</option></select></Field>
          </div>
        </>
      )}
      {b.type === 'K-Chart-Line' && (
        <>
          {fieldSel('Đường 1', c.series?.[0], (x) => onCfg({ series: [x, c.series?.[1] ?? ''] }))}
          {fieldSel('Đường 2', c.series?.[1], (x) => onCfg({ series: [c.series?.[0] ?? ds.fields[0].id, x] }), true)}
          <Field label="Khoảng thời gian"><CbSeg label="Số tháng" items={[['6', '6 tháng'], ['12', '12 tháng']]} value={String(c.months ?? 12) as '6' | '12'} onChange={(v) => onCfg({ months: Number(v) })} /></Field>
        </>
      )}
      {b.type === 'K-Table-Compact' && (
        <>
          <Field label="Kiểu bảng"><CbSeg label="Kiểu bảng" items={[['rows', 'Danh sách'], ['group', 'Nhóm theo']]} value={c.mode ?? 'rows'} onChange={(v) => onCfg({ mode: v })} /></Field>
          {(c.mode ?? 'rows') === 'group' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nhóm theo"><select className={inputCls} value={c.group ?? ds.dims[0].id} onChange={(e) => onCfg({ group: e.target.value })}>{ds.dims.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
              {fieldSel('Chỉ tiêu', c.field, (x) => onCfg({ field: x }))}
            </div>
          ) : (
            <Field label="Cột (tối đa 5)">
              <div className="flex flex-wrap gap-1.5">{[...ds.dims, ...ds.fields.filter((f) => f.id !== 'count')].map((x) => { const on = (c.cols ?? []).includes(x.id); return (
                <button key={x.id} type="button" className={cn('rounded-md border px-2 py-1 text-[12.5px]', on ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'border-[rgb(var(--line))] text-[rgb(var(--fg2))]')} disabled={!on && (c.cols ?? []).length >= 5} onClick={() => onCfg({ cols: on ? (c.cols ?? []).filter((y) => y !== x.id) : [...(c.cols ?? []), x.id] })}>{x.label}</button>
              ); })}</div>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(c.mode ?? 'rows') === 'rows' && <Field label="Sắp xếp"><select className={inputCls} value={c.sort ?? ''} onChange={(e) => onCfg({ sort: e.target.value || undefined })}><option value="">Mới nhất</option>{ds.fields.filter((f) => f.id !== 'count').map((f) => <option key={f.id} value={f.id}>{f.label} lớn nhất</option>)}</select></Field>}
            <Field label="Số dòng"><select className={inputCls} value={c.limit ?? 5} onChange={(e) => onCfg({ limit: Number(e.target.value) })}>{[5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
          </div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={!!c.stt} onChange={(e) => onCfg({ stt: e.target.checked })} />Cột STT</label>
          {(c.mode ?? 'rows') === 'rows' && <Field label="Trên điện thoại"><CbSeg label="Trên điện thoại" items={[['card', 'Dạng thẻ'], ['table', 'Bảng']]} value={c.smView ?? 'card'} onChange={(v) => onCfg({ smView: v })} /></Field>}
        </>
      )}
      {data && <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={c.open !== false} onChange={(e) => onCfg({ open: e.target.checked })} />Có nút mở {MODULE_LABEL[ds.module]}</label>}
      {data && <p className="flex gap-2 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[12.5px] text-[rgb(var(--fg2))]"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Người xem chỉ thấy số trong phạm vi dữ liệu của mình. Không có quyền {MODULE_LABEL[ds.module]}{ds.perm ? ' hoặc quyền quỹ' : ''} thì khối tự ẩn.</p>}
      </>}
      {sec === 'v' && <>
      {tabs.length > 0 && b.type !== 'K-Tabs' && <Field label="Thuộc tab"><select className={inputCls} value={c.tab && tabs.some((t) => t.id === c.tab) ? c.tab : ''} onChange={(e) => onCfg({ tab: e.target.value || undefined })} aria-label="Thuộc tab"><option value="">Mọi tab (luôn hiện)</option>{tabs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>}
      {!data && !core && page === 'sale-detail' && (
        <div className="border-t border-[rgb(var(--line))] pt-3">
          <p className="mb-2 text-[12px] text-[rgb(var(--muted))]">Hiện khi đơn ở trạng thái (không chọn = luôn hiện)</p>
          <div className="grid grid-cols-2 gap-1.5">{(Object.keys(L_STAGE) as LStage[]).map((s) => chk((c.stages ?? []).includes(s), L_STAGE[s], () => onCfg({ stages: (c.stages ?? []).includes(s) ? (c.stages ?? []).filter((x) => x !== s) : [...(c.stages ?? []), s] })))}</div>
        </div>
      )}
      {!data && !core && (
        <div className="border-t border-[rgb(var(--line))] pt-3">
          <p className="mb-2 text-[12px] text-[rgb(var(--muted))]">Hiện với vai trò (không chọn = mọi vai trò)</p>
          <div className="grid grid-cols-2 gap-1.5">{L_ROLES.map((r) => chk((c.roles ?? []).includes(r), ROLE_LABEL[r], () => onCfg({ roles: (c.roles ?? []).includes(r) ? (c.roles ?? []).filter((x) => x !== r) : [...(c.roles ?? []), r] })))}</div>
          {b.type === 'K-Order-Profit' && <p className="mt-2 text-[12px] text-[rgb(var(--muted))]">Ngoài điều kiện này, Lãi trên đơn chỉ hiện với người có quyền quản lý bán hàng, kế toán, Giám đốc</p>}
        </div>
      )}
      <div className="border-t border-[rgb(var(--line))] pt-3">
        <p className="mb-2 text-[12px] text-[rgb(var(--muted))]">Vị trí trên lưới 12 cột{fine ? ' · hàng 8px' : ''}</p>
        <div className="grid grid-cols-4 gap-2">{num('x', 'Cột', 12)}{num('y', 'Hàng', fine ? 999 : 99)}{num('w', 'Rộng', 12)}{num('h', 'Cao', fine ? 160 : 12)}</div>
      </div>
      {ext?.v}
      <Field label="Hiển thị trên">
        <div className="grid grid-cols-3 gap-2">{([['lg', 'Máy tính', Monitor], ['md', 'Tablet', Tablet], ['sm', 'Điện thoại', Smartphone]] as const).map(([k, l, I]) => (
          <button key={k} type="button" aria-pressed={b.show[k]} disabled={core} title={core ? 'Khối lõi luôn hiện' : undefined} className={cn('inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1.5 text-[12.5px]', b.show[k] ? 'border-[rgb(var(--fg))] text-[rgb(var(--fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))] line-through')} onClick={() => onBlock({ show: { ...b.show, [k]: !b.show[k] } })}><I className="h-3.5 w-3.5" aria-hidden />{l}</button>
        ))}</div>
      </Field>
      <Field label="Độ rộng trên điện thoại"><CbSeg label="Độ rộng trên điện thoại" items={[['12', 'Cả hàng'], ['6', '1/2'], ['4', '1/3'], ['3', '1/4']]} value={String(b.pos.sm.w || 12) as '12' | '6' | '4' | '3'} onChange={(v) => onBlock({ pos: { ...b.pos, sm: { ...b.pos.sm, w: Number(v) } } })} /></Field>
      </>}
    </div>
  );
}

/**
 * Màn thiết kế một trang (toàn màn hình, có URL riêng #/console/design/:page/:verId | new).
 *  - verId = id bản nháp: sửa bản nháp đó; id bản đã phát hành / bản cũ: lấy làm điểm bắt đầu (lưu thành bản nháp của trang);
 *    'new': mở bản nháp đang có, chưa có thì bắt đầu từ bản mới nhất (hoặc bố cục khởi tạo)
 *  - Mỗi trang chỉ một bản nháp. Tự lưu nháp sau 2 giây không thao tác; đóng tab khi còn thay đổi chưa lưu thì trình duyệt hỏi lại
 */
export function LayoutEditor({ page, verId, onClose, onNav }: { page: LPage; verId: string; onClose: (openPublish: boolean) => void; onNav: (verId: string) => void }) {
  const { platform, notify } = useApp();
  const who = usePlatformWho();
  const pg = L_PAGES.find((p) => p.id === page)!;
  // v56: bố cục riêng một doanh nghiệp (nhân bản mẫu ngành): bản nháp / lịch sử tách khỏi bố cục chung
  const [owner] = useState(() => lOwnerOf(verId, platform.layouts));
  const newId = owner ? `new@${owner}` : 'new';
  const vers = platform.layouts.filter((v) => v.page === page && (v.tenantId ?? null) === owner).sort((a, b) => b.version - a.version);
  const draft = vers.find((v) => v.status === 'DRAFT');
  const target = verId !== newId ? vers.find((v) => v.id === verId) : undefined;
  const live = platform.layoutAssigns.find((a) => a.page === page && (owner ? a.level === 'TENANT' && a.tenantId === owner : a.level === 'SYSTEM'));
  const liveVer = live ? platform.layouts.find((v) => v.id === live.verId) : undefined;
  const starter = () => (page === 'sale-detail' ? lStarterSale() : page === 'sale-list' ? lStarterList() : page === 'sale-form' ? lStarterForm() : L_PAGE_ENTITY[page] ? lStarterEntity(page) : lStarter());
  // Bản mở ra: bản nháp (đang có) ưu tiên — tránh ghi đè bản nháp bằng bản cũ; còn lại theo URL, rồi bản mới nhất
  const base = draft ?? target ?? vers[0];
  // v57a bố cục mới bắt đầu bằng lưới 8px; bố cục đã có giữ lưới đang dùng (cổ điển nếu chưa đặt)
  const grid0: LGrid | undefined = base ? base.grid : L_GRID_FINE;
  const init0 = lEnsureCore(page, lMigrate(page, base?.blocks ?? starter()));
  const init = base ? init0 : lToFine(init0);
  // URL luôn trỏ đúng bản đang sửa: có bản nháp thì /:idNháp; mở bản khác khi đã có nháp thì báo
  useEffect(() => {
    if (draft && verId !== draft.id) {
      if (target && target.id !== draft.id) notify(`${pg.label} đang có bản nháp v${draft.version}: mở bản nháp (Lịch sử phiên bản › Khôi phục để lấy bản cũ)`, 'orange');
      onNav(draft.id);
    } else if (!draft && verId !== newId && !target && verId !== draftRef.current) { notify('Không tìm thấy phiên bản này, mở bản mới nhất', 'orange'); onNav(newId); }
  }, [draft?.id, verId]); // eslint-disable-line react-hooks/exhaustive-deps
  const biz = page === 'sale-detail';
  const bizPage = pg.kind === 'BUSINESS';
  const [etab0, setEtab] = useState('');
  const [eperiod, setEperiod] = useState<DashPeriod>('MONTH');
  const [stage, setStage] = useState<LStage>('ISSUE');
  // v55.3: mọi đối tượng (khối bản ghi tự lọc theo entity của khối)
  const cfAll = platform.customFields;
  const [blocks, setBlocks0] = useState<LBlock[]>(init);
  const [grid, setGrid0] = useState<LGrid | undefined>(grid0);
  const G = lGridOf(grid);
  const snap = (bs: LBlock[], g: LGrid | undefined) => JSON.stringify([bs, g ?? null]);
  const [saved, setSaved] = useState(snap(init, base ? base.grid : undefined));
  /** đã có thao tác của người thiết kế (mở xem không tự tạo bản nháp) */
  const [touched, setTouched] = useState(false);
  const setBlocks = (n: LBlock[]) => { setTouched(true); setBlocks0(n); };
  const [past, setPast] = useState<LBlock[][]>([]);
  const [future, setFuture] = useState<LBlock[][]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [dev, setDev] = useState<LDevice>('lg');
  const [role, setRole] = useState<Role>('BOD');
  const [later, setLater] = useState(false);
  const smKey = (bs: LBlock[]) => [...bs].sort((p, q) => (p.pos.sm.order || 99) - (q.pos.sm.order || 99)).map((x) => x.id).join();
  const [smCustom, setSmCustom] = useState(() => smKey(init) !== smKey(lOrderSm(init)));
  const commit = (n: LBlock[], manualSm = false) => { if (manualSm) setSmCustom(true); const v = manualSm || smCustom ? n : lOrderSm(n); setPast((p) => [...p.slice(-40), blocks]); setFuture([]); setBlocks(v); };
  const undo = () => { const p = past[past.length - 1]; if (!p) return; setFuture((f) => [blocks, ...f]); setPast(past.slice(0, -1)); setBlocks(p); };
  const redo = () => { const f = future[0]; if (!f) return; setPast((p) => [...p, blocks]); setFuture(future.slice(1)); setBlocks(f); };
  const setGrid = (g: LGrid | undefined) => { setTouched(true); setGrid0(g); };
  const dirty = touched && snap(blocks, grid) !== saved;
  const nextNo = Math.max(0, ...vers.map((v) => v.version)) + 1;
  /** id bản nháp vừa tạo trong phiên (state nền tảng chưa kịp cập nhật thì vẫn ghi vào đúng bản, không tạo bản thứ hai) */
  const draftRef = useRef<string | null>(null);
  const loggedRef = useRef(false);
  const [autoAt, setAutoAt] = useState<number | null>(null);
  /** Lưu nháp. quiet: tự lưu (nhật ký nền tảng chỉ ghi lần đầu trong phiên); stay: còn ở màn thiết kế (URL chuyển sang id bản nháp mới) */
  const saveDraft = (quiet = false, stay = true): number => {
    const now = Date.now();
    const id = draft?.id ?? draftRef.current;
    if (id) platform.setLayouts((all) => all.map((v) => (v.id === id ? { ...v, blocks, grid, at: now, by: who } : v)));
    else { const nid = uid('lv'); draftRef.current = nid; platform.setLayouts((all) => [{ id: nid, schema: 1, page, version: nextNo, status: 'DRAFT', role: null, blocks, ...(grid ? { grid } : {}), by: who, at: now, ...(owner ? { tenantId: owner, fromIndustry: base?.fromIndustry } : {}) }, ...all]); if (stay) onNav(nid); }
    const no = draft?.version ?? nextNo;
    if (!quiet || !loggedRef.current) platform.log('LAYOUT_DRAFT', `${pg.label}${owner ? ` (riêng ${orgOf(owner).shortName})` : ''} v${no}: ${quiet ? 'tự lưu' : 'lưu'} nháp ${blocks.length} khối`, owner ?? undefined);
    loggedRef.current = true;
    setSaved(snap(blocks, grid));
    if (quiet) setAutoAt(now);
    return no;
  };
  // Tự lưu nháp sau 2 giây không thao tác
  useEffect(() => {
    if (!dirty) return;
    const t = window.setTimeout(() => saveDraft(true), 2000);
    return () => window.clearTimeout(t);
  }, [blocks, grid, dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  // Đóng tab / tải lại khi còn thay đổi chưa lưu: trình duyệt hỏi lại
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  // Rời màn thiết kế bằng nút Back của trình duyệt (đổi URL): lưu nốt phần chưa lưu
  const leaveRef = useRef<() => void>(() => undefined);
  leaveRef.current = () => { if (dirty) saveDraft(true, false); };
  useEffect(() => () => leaveRef.current(), []);
  const b = blocks.find((x) => x.id === sel);
  const setB = (patch: Partial<LBlock>) => b && setBlocks(blocks.map((x) => (x.id === b.id ? { ...x, ...patch } : x)));
  // Bố cục trường (nhóm, thứ tự, trường bỏ) đi qua lịch sử Hoàn tác / Làm lại
  const setCfg = (c: Partial<LBlockCfg>) => b && ('sections' in c || 'off' in c ? commit(blocks.map((x) => (x.id === b.id ? { ...x, config: { ...x.config, ...c } } : x))) : setB({ config: { ...b.config, ...c } }));
  // v55.2.1 chế độ thiết kế bố cục trường: trái = trường chưa đặt, giữa = khung trường, phải = Field Inspector
  const [fieldOf, setFieldOf] = useState<string | null>(null);
  // v55.3 Health Check: đối chiếu trường trong bố cục với trường thực tế của các doanh nghiệp được phát hành trang này
  // (riêng DN, theo mô hình, toàn hệ thống; chưa phát hành thì mọi DN đang hoạt động)
  const hOrgs = useMemo(() => {
    const as = platform.layoutAssigns.filter((a) => a.page === page);
    const ts = platform.tenants.filter((t) => t.status !== 'SUSPENDED');
    const prof = (id: string) => (orgOf(id).profile === 'MANUFACTURING' ? 'MFG' : 'TRADING');
    if (owner) return [orgOf(owner)];
    const ids = !as.length || as.some((a) => a.level === 'SYSTEM') ? ts.map((t) => t.id) : ts.filter((t) => as.some((a) => (a.level === 'TENANT' && a.tenantId === t.id) || (a.level === 'PROFILE' && a.profile === prof(t.id)))).map((t) => t.id);
    return ids.map((id) => orgOf(id));
  }, [platform.layoutAssigns, platform.tenants, page, owner]);
  const healthOf = (x: LBlock) => lHealthFull(x, cfAll, hOrgs);
  const fl = useFieldLayout(b, setCfg, cfAll, hOrgs);
  const fieldMode = !preview && !!fl && fieldOf === b?.id;
  const [blockPanel, setBlockPanel] = useState(false);
  const enterFields = () => { if (b) { setFieldOf(b.id); setBlockPanel(false); fl?.setSel(null); } };
  const setPos = (p: Partial<LPos>) => b && commit(lSettle(blocks.map((x) => (x.id === b.id ? { ...x, pos: { ...x.pos, lg: { ...x.pos.lg, ...p } } } : x)), b.id, G.maxH));
  const add = (t: LBlockType) => {
    const has = blocks.find((x) => x.type === t);
    if (has && lType(t).tier === 'biz') { setSel(has.id); return; }
    const nb = lNewBlock(t, { y: Math.max(0, ...blocks.map((x) => x.pos.lg.y + x.pos.lg.h)) }, page); nb.pos.sm.order = blocks.length + 1;
    // v57a lưới 8px: chiều cao mặc định đổi sang hàng 8px (Đường kẻ / Khoảng trống thấp 16px)
    if (G.fine) nb.pos.lg = { ...nb.pos.lg, h: t === 'K-Divider' || t === 'K-Spacer' ? 2 + Math.ceil(G.gap / 8) : lFineH(nb.pos.lg.h) };
    if (etab && lHasData(t)) nb.config = { ...nb.config, tab: etab };
    commit(lSettle([...blocks, nb], nb.id, G.maxH)); setSel(nb.id);
  };
  const libTypes = L_TYPES.filter((t) => t.pages.includes(page));
  const tabsCfg = lTabList(blocks);
  const etab = tabsCfg.some((t) => t.id === etab0) ? etab0 : tabsCfg[0]?.id ?? '';
  // v57b giá trị mẫu cho dữ liệu gắn {{…}} của Khung linh hoạt / Khung tự do
  const dctx = { ...lDesignCtx(page, etab, setEtab, eperiod, setEperiod), bind: lBindSample(cfAll) };
  const er = dashRange(eperiod, Date.now());
  const erange: DateRange = { from: iso(new Date(er.from)), to: iso(new Date(er.to - 864e5)) };
  const libIcon = (t: LBlockType) => ({ 'K-Stat-Simple': Hash, 'K-Chart-Line': TrendingUp, 'K-Table-Compact': Rows3, 'K-Text': StickyNote, 'K-Icons': LayoutGrid, 'K-Order-Info': FileText, 'K-RecordDetail': FileText, 'K-RecordForm': ListChecks, 'K-Order-Lines': Rows3, 'K-Order-Flow': ListChecks, 'K-Order-Pay': Wallet, 'K-Order-Profit': TrendingUp, 'K-Order-Debt': Scale, 'K-Order-Log': MessageSquare, 'K-Order-Ship': Truck, 'K-Order-Files': Paperclip, 'K-Button': LayoutGrid, 'K-Filter': Filter, 'K-Tabs': Columns3, 'K-Target': Target, 'K-Divider': Minus, 'K-Spacer': ArrowUpDown, 'K-SaleList': ShoppingBag, 'K-WorkflowHeader': ArrowUpDown, 'K-ChecklistTracker': ListChecks, 'K-StageBoard': Columns3, 'K-ResourceCalendar': CalendarDays, 'K-QuickPOS': ShoppingBag, 'K-FlexContainer': Columns3, 'K-FreeformBox': LayoutTemplate } as Record<LBlockType, typeof Hash>)[t] ?? Info;
  const sample = useMemo(() => new Map<LDataset, LRow[]>(), []);
  const rowsAs = (r: Role) => (ds: LDataset) => { if (!lRoleSees(r, ds)) return null; if (!sample.has(ds)) sample.set(ds, lRowsSample(ds)); return sample.get(ds)!; };
  const hiddenFor = (r: Role) => blocks.filter((x) => (bizPage ? !lSaleSampleShows(x, stage, r) : (lHasData(x.type) && !lRoleSees(r, x.config.ds)) || !lCondOk(x.config, null, r)));
  const sm = [...blocks].sort((p, q) => (p.pos.sm.order || 99) - (q.pos.sm.order || 99));
  const [dragSm, setDragSm] = useState<string | null>(null);
  const reorder = (from: string, to: string) => { if (from === to) return; const ids = sm.map((x) => x.id).filter((x) => x !== from); ids.splice(ids.indexOf(to), 0, from); commit(blocks.map((x) => ({ ...x, pos: { ...x.pos, sm: { ...x.pos.sm, order: ids.indexOf(x.id) + 1 } } })), true); };
  const back = () => { if (dirty) { const no = saveDraft(false, false); notify(`Đã lưu nháp ${pg.label} v${no}`, 'teal'); } onClose(false); };
  const iconBtn = 'grid h-9 w-9 place-items-center rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))] disabled:opacity-40';
  const devs: [LDevice, typeof Monitor, string][] = [['lg', Monitor, 'Máy tính'], ['md', Tablet, 'Máy tính bảng'], ['sm', Smartphone, 'Điện thoại']];
  const frameW = dev === 'sm' ? 390 : dev === 'md' ? 768 : undefined;
  const checks: { tone: 'ok' | 'warn' | 'info'; t: string }[] = [
    { tone: 'ok', t: 'Không hàng nào vượt 12 cột' },
    { tone: blocks.every((x) => x.config.title.trim()) ? 'ok' : 'warn', t: blocks.every((x) => x.config.title.trim()) ? 'Mọi khối đã có tiêu đề và nguồn dữ liệu' : 'Có khối chưa đặt tiêu đề' },
    { tone: 'ok', t: `Điện thoại: ${blocks.filter((x) => x.show.sm).length} khối, ${blocks.filter((x) => x.show.sm && (x.pos.sm.w || 12) < 12).length} khối xếp chung hàng` },
    { tone: 'ok', t: 'Máy tính bảng: lưới 6 cột, khối rộng hơn 6 tự co về 6' },
    ...blocks.flatMap((x) => healthOf(x).map((h) => ({ tone: 'warn' as const, t: `${x.config.title}: ${h.label} (${h.key}) — ${h.msg}` }))),
    ...(hiddenFor(role).length ? [{ tone: 'warn' as const, t: `${ROLE_LABEL[role]} không thấy ${hiddenFor(role).length} khối: ${hiddenFor(role).map((x) => x.config.title).join(', ')}` }] : []),
    bizPage ? { tone: 'ok' as const, t: `Đủ ${blocks.filter((x) => lIsCore(x.type)).length} khối lõi: ${L_TYPES.filter((x) => x.core && x.pages.includes(page)).map((x) => x.label).join(', ')}` } : { tone: 'info' as const, t: 'Khối lõi luồng nghiệp vụ: không áp dụng cho trang tổng hợp' },
    ...(biz ? [{ tone: 'ok' as const, t: 'Nút theo trạng thái đơn (Duyệt, Xuất kho, Thu tiền, Hóa đơn) giữ ở thanh trên, hiện theo quyền' }, { tone: 'info' as const, t: `Đơn mẫu ${L_STAGE[stage]}${stage === 'CANCEL' ? ': tự ẩn Trao đổi, Lãi, Công nợ và hiện Quy trình hủy' : ''}` }] : []),
  ];
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[rgb(var(--bg))]" role="dialog" aria-modal="true" aria-label={`Thiết kế ${pg.label}`}>
      <header className="flex h-[60px] shrink-0 items-center gap-2 border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4">
        <button className={btnGhost} onClick={back}><ChevronLeft className="h-4 w-4" aria-hidden />Quay lại</button>
        {!preview && <span className="text-[13px] text-[rgb(var(--muted))] max-lg:hidden">Thiết kế giao diện ›</span>}
        <span className="whitespace-nowrap font-medium">{pg.label}</span>
        {owner && <Chip tone="blue">Riêng {orgOf(owner).shortName}</Chip>}
        {preview && !biz ? (
          <div className="ml-2 flex items-center gap-2"><span className="whitespace-nowrap text-[12.5px] text-[rgb(var(--muted))]">Xem với vai trò</span>
            <div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label="Vai trò xem trước">{L_ROLES.map((r) => <button key={r} role="radio" aria-checked={role === r} className={cn('whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px]', role === r ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))]')} onClick={() => setRole(r)}>{ROLE_LABEL[r].split(' ')[0] === 'Nhân' ? 'Sales' : ROLE_LABEL[r].replace(' BOD', '')}</button>)}</div>
          </div>
        ) : preview ? null : <span className="whitespace-nowrap rounded-lg border border-[rgb(var(--line))] px-2.5 py-1 text-[12.5px] text-[rgb(var(--muted))]" title="Bản 1 dùng chung một bố cục cho mọi vai trò">Vai trò: Tất cả</span>}
        <Chip tone="orange">{preview ? 'Xem trước · dữ liệu mẫu' : draft || dirty ? `Nháp v${draft?.version ?? nextNo}${dirty ? ' · chưa lưu' : ''}` : `v${vers[0]?.version ?? 1}`}</Chip>
        {!preview && <span className="whitespace-nowrap text-[12px] text-[rgb(var(--muted))] max-xl:hidden" role="status" aria-live="polite">{dirty ? 'Tự lưu sau 2 giây' : autoAt ? `Đã tự lưu ${new Date(autoAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</span>}

        {liveVer && <span className="text-[12px] text-[rgb(var(--muted))] max-xl:hidden">đang phát hành v{liveVer.version}</span>}
        <div className="ml-auto flex items-center gap-2">
          {!preview && <><button className={iconBtn} disabled={!past.length} onClick={undo} aria-label="Hoàn tác" title="Hoàn tác"><Undo2 className="h-4 w-4" aria-hidden /></button><button className={iconBtn} disabled={!future.length} onClick={redo} aria-label="Làm lại" title="Làm lại"><Redo2 className="h-4 w-4" aria-hidden /></button></>}
          <div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label="Thiết bị">{devs.map(([k, I, l]) => <button key={k} role="radio" aria-checked={dev === k} aria-label={l} title={l} className={cn('grid h-7 w-8 place-items-center rounded-md', dev === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))]')} onClick={() => { setDev(k); if (k !== 'lg') setPreview(true); }}><I className="h-4 w-4" aria-hidden /></button>)}</div>
          <button className={preview ? cn(btnPrimary, 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]') : btnGhost} onClick={() => { setPreview(!preview); if (preview) setDev('lg'); }}><Eye className="h-4 w-4" aria-hidden />{preview ? 'Thoát xem trước' : 'Xem trước'}</button>
          <button className={btnGhost} disabled={!dirty} onClick={() => { const no = saveDraft(); notify(`Đã lưu nháp ${pg.label} v${no}`, 'teal'); }}>Lưu nháp</button>
          <button className={btnPrimary} onClick={() => { if (dirty || !(draft ?? draftRef.current)) saveDraft(false, false); onClose(true); }}><Rocket className="h-4 w-4" aria-hidden />Phát hành</button>
        </div>
      </header>
      {biz && (
        <div className="flex h-12 shrink-0 items-center gap-5 overflow-x-auto border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4">
          {preview && <div className="flex items-center gap-2"><span className="whitespace-nowrap text-[12.5px] text-[rgb(var(--muted))]">Xem với vai trò</span><div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label="Vai trò xem trước">{L_ROLES.map((r) => <button key={r} role="radio" aria-checked={role === r} className={cn('whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px]', role === r ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))]')} onClick={() => setRole(r)}>{ROLE_LABEL[r].split(' ')[0] === 'Nhân' ? 'Sales' : ROLE_LABEL[r].replace(' BOD', '')}</button>)}</div></div>}
          <div className="flex items-center gap-2"><span className="whitespace-nowrap text-[12.5px] text-[rgb(var(--muted))]">Đơn mẫu</span><div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label="Trạng thái đơn mẫu">{(Object.keys(L_STAGE) as LStage[]).map((s) => <button key={s} role="radio" aria-checked={stage === s} className={cn('whitespace-nowrap rounded-md px-2.5 py-1 text-[12.5px]', stage === s ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))]')} onClick={() => setStage(s)}>{L_STAGE[s]}</button>)}</div></div>
          <span className="ml-auto whitespace-nowrap text-[12px] text-[rgb(var(--muted))]">{preview ? 'Xem trước theo vai trò và trạng thái đơn' : 'Đơn mẫu chỉ để xem cách khối hiện theo trạng thái'}</span>
        </div>
      )}
      <div className={cn('grid min-h-0 flex-1', preview ? 'grid-cols-[1fr_380px]' : 'grid-cols-[260px_1fr_340px]')}>
        {fieldMode && fl && (
          <aside className="overflow-y-auto border-r border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4" aria-label="Trường dữ liệu">
            <LFieldPalette fl={fl} />
          </aside>
        )}
        {!preview && !fieldMode && (
          <aside className="overflow-y-auto border-r border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4" aria-label="Thư viện khối">
            <div className="mb-3 flex items-center"><h3 className="font-medium">Thư viện khối</h3><span className="ml-auto text-[12px] text-[rgb(var(--muted))]">{pg.label}</span></div>
            {([
              ['Khối hiển thị · dùng mọi trang', libTypes.filter((t) => t.tier === 'show')],
              ['Khối dữ liệu · chọn nguồn dữ liệu', libTypes.filter((t) => t.tier === 'data')],
              ['Khối nghiệp vụ · riêng trang này', libTypes.filter((t) => t.tier === 'biz')],
            ] as [string, LTypeDef[]][]).filter(([, ts]) => ts.length).map(([g, ts]) => (
              <div key={g} className="mb-2">
                <p className="mb-2 flex items-center gap-1.5 text-[12px] text-[rgb(var(--muted))]">{g.startsWith('Khối nghiệp vụ') && <Lock className="h-3 w-3" aria-hidden />}{g}</p>
                {ts.map((t) => { const I = libIcon(t.type); const on = blocks.some((x) => x.type === t.type); const uniq = t.tier === 'biz'; return (
                  <button key={t.type} draggable={!(uniq && on)} onDragStart={(e) => { lDrag.type = t.type; e.dataTransfer.setData('text/plain', t.type); e.dataTransfer.effectAllowed = 'copy'; }} onDragEnd={() => { lDrag.type = null; }} onClick={() => add(t.type)}
                    className={cn('mb-2 flex w-full items-center gap-3 rounded-lg border border-[rgb(var(--line))] px-2.5 py-2 text-left hover:border-[rgb(var(--ink)/0.25)]', t.core && 'bg-[rgb(var(--ink)/0.03)]')} title={t.desc}>
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgb(var(--ink)/0.05)] text-[rgb(var(--fg2))]"><I className="h-4 w-4" aria-hidden /></span>
                    <span className="min-w-0"><span className="block text-[13px] font-medium">{t.label}</span><span className="block truncate text-[11.5px] text-[rgb(var(--muted))]">{t.type}{uniq ? (on ? ' · trên trang' : '') : ` · span ${t.def.w}`}</span></span>
                    {t.core ? <Lock className="ml-auto h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-label="Khối lõi" /> : uniq && on ? <CheckIcon className="ml-auto h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-label="Đã có trên trang" /> : <GripVertical className="ml-auto h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />}
                  </button>
                ); })}
              </div>
            ))}
            {!libTypes.some((t) => t.tier === 'biz') && <p className="mb-2 flex gap-2 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[12px] text-[rgb(var(--fg2))]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Trang tổng hợp không có khối nghiệp vụ. Khối nghiệp vụ có ở Chi tiết đơn hàng, Quản lý đơn hàng</p>}
            {biz && <p className="mb-2 flex gap-2 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[12px] text-[rgb(var(--fg2))]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Khung Quy trình hủy và các nút theo trạng thái đơn do luồng nghiệp vụ điều khiển, không kéo thả</p>}
            <button className="mt-2 flex w-full items-center gap-1.5 border-t border-[rgb(var(--line))] pt-3 text-[13px] text-[rgb(var(--fg2))]" onClick={() => setLater(!later)} aria-expanded={later}><ChevronRight className={cn('h-4 w-4 transition-transform', later && 'rotate-90')} aria-hidden />Bản sau<span className="ml-auto text-[12px] text-[rgb(var(--muted))]">{L_LATER.length} khối</span></button>
            {later && <ul className="mt-2 space-y-1 text-[12.5px] text-[rgb(var(--muted))]">{L_LATER.map((x) => <li key={x} className="rounded border border-dashed border-[rgb(var(--line))] px-2 py-1">{x}</li>)}</ul>}
          </aside>
        )}
        <main className="min-w-0 overflow-y-auto p-5"><LPageC.Provider value={dctx}>
          {preview ? (
            <div className="mx-auto" style={{ maxWidth: frameW ?? 1400 }}>
              <p className="mb-3 text-center text-[12px] text-[rgb(var(--muted))]">{dev === 'sm' ? 'Điện thoại · 390 px · khối theo độ rộng 1/1, 1/2, 1/3, 1/4' : dev === 'md' ? 'Máy tính bảng · 768 px · 6 cột' : 'Máy tính · 12 cột'}</p>
              <div className={cn(dev === 'sm' && 'overflow-hidden rounded-[36px] border-[10px] border-[rgb(var(--fg))] bg-[rgb(var(--bg))] p-3 shadow-2xl', dev === 'md' && 'rounded-2xl border-[8px] border-[rgb(var(--fg)/0.85)] bg-[rgb(var(--bg))] p-4')}>
                {bizPage ? (
                  <div className={cn(dev !== 'lg' && 'text-[13px]')}>
                    {biz && <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-[12.5px] text-[rgb(var(--muted))]">Quản lý đơn hàng ›</span><span className="font-medium">DH201126-02</span><Chip tone={stage === 'DONE' ? 'teal' : stage === 'CANCEL' ? 'muted' : 'orange'}>{L_STAGE[stage]}</Chip>
                      <span className="ml-auto flex gap-1.5">{stage === 'APPROVAL' && <span className={cn(btnPrimary, 'pointer-events-none')}>Duyệt đơn</span>}{stage === 'ISSUE' && role === 'SALES_REP' && <span className={cn(btnPrimary, 'pointer-events-none')}>Yêu cầu xuất kho</span>}{(stage === 'ISSUE' || stage === 'PAY') && <span className={cn(btnGhost, 'pointer-events-none')}>{lRoleProfit(role) && role !== 'SALES_REP' ? 'Lập phiếu thu' : 'Báo đã nhận tiền'}</span>}</span></div>}
                    <LBusinessView blocks={blocks} narrow={dev !== 'lg'} dev={dev} grid={grid} node={(x) => (!lSaleSampleShows(x, stage, role) ? null : x.type === 'K-Text' ? <LTextBlock c={x.config} /> : lType(x.type).tier === 'show' || x.type === 'K-SaleList' || x.type === 'K-RecordList' ? lSaleSample({ b: x, stage, cf: cfAll }) : (
                      <section className="glass-card rounded-xl px-4 py-3"><h3 className="mb-2 text-[14px] font-medium">{x.type === 'K-Order-Flow' && stage === 'CANCEL' ? 'Quy trình hủy' : x.type === 'K-RecordDetail' && stage === 'CANCEL' ? 'Hủy đơn' : x.config.title}</h3>{lSaleSample({ b: x, stage, cf: cfAll, narrow: dev === 'sm' })}</section>
                    ))} />
                  </div>
                ) : <LayoutView blocks={blocks} rowsOf={rowsAs(role)} device={dev} role={role} range={erange} grid={grid} />}
              </div>
              {hiddenFor(role).length > 0 && <p className="mt-3 text-center text-[12px] text-[rgb(var(--muted))]">Đang xem như {ROLE_LABEL[role]}: {hiddenFor(role).length} khối không có quyền đã tự ẩn</p>}
            </div>
          ) : fieldMode && fl ? (
            <div className="mx-auto max-w-[1100px]">
              <div className="mb-3 flex items-center gap-2 text-[12.5px]">
                <button className={cn(btnGhost, btnSm)} onClick={() => setFieldOf(null)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden />Về lưới trang</button>
                <span className="text-[rgb(var(--muted))]">Bố cục trường › {fl.c.title}</span>
                <span className="ml-auto text-[rgb(var(--muted))]">Kéo trường giữa các nhóm · bấm trường để chỉnh ở cột phải · lưới 12 cột</span>
              </div>
              <LFieldCanvas fl={fl} />
            </div>
          ) : (
            <>
              <p className="mb-3 flex items-center gap-1.5 text-[12.5px] text-[rgb(var(--muted))]"><Info className="h-3.5 w-3.5" aria-hidden />{biz ? `Trang nghiệp vụ dùng chung cho mọi vai trò. Đơn mẫu ở trạng thái ${L_STAGE[stage]}; chiều cao thật theo nội dung` : 'Kéo khối bằng tay nắm, kéo góc phải dưới để đổi độ rộng 1–12 cột. Đang hiển thị dữ liệu mẫu'}<span className="ml-auto">Lưới 12 cột · {blocks.length} khối{biz ? ` · ${blocks.filter((x) => lIsCore(x.type)).length} lõi` : ''}</span></p>
              {tabsCfg.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]"><span className="text-[rgb(var(--muted))]">Đang thiết kế tab</span><div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label="Tab đang thiết kế">{tabsCfg.map((t) => <button key={t.id} role="radio" aria-checked={etab === t.id} className={cn('rounded-md px-2.5 py-1', etab === t.id ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))]')} onClick={() => setEtab(t.id)}>{t.label}</button>)}</div><span className="text-[rgb(var(--muted))]">khối của tab khác mờ đi; khối "Mọi tab" luôn hiện</span></div>}
              <LGridEditor blocks={blocks} commit={commit} sel={sel} setSel={setSel} page={page} stage={stage} cf={cfAll} etab={etab} health={healthOf} grid={grid} />
            </>
          )}
        </LPageC.Provider></main>
        <aside className="overflow-y-auto border-l border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4" aria-label={preview ? 'Kiểm tra trước khi phát hành' : 'Cài đặt khối'}>
          {preview ? (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4" aria-hidden />Kiểm tra trước khi phát hành</h3>
              <div className="space-y-2">{checks.map((x, i) => <p key={i} className="flex gap-2 text-[13px]"><span className={cn('mt-0.5 shrink-0', x.tone === 'ok' ? 'text-[rgb(var(--success-fg))]' : x.tone === 'warn' ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--muted))]')}>{x.tone === 'ok' ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : x.tone === 'warn' ? <AlertTriangle className="h-4 w-4" aria-hidden /> : <Info className="h-4 w-4" aria-hidden />}</span>{x.t}</p>)}</div>
              <div className="border-t border-[rgb(var(--line))] pt-3">
                <div className="mb-2 flex items-center"><p className="text-[13px] font-medium">Khối trên từng thiết bị</p><span className="ml-auto text-[12px] text-[rgb(var(--muted))]">kéo đổi thứ tự trên điện thoại</span></div>
                {sm.map((x, i) => { const hid = biz ? !lSaleSampleShows(x, stage, role) : (lHasData(x.type) && !lRoleSees(role, x.config.ds)) || !lCondOk(x.config, null, role); return (
                  <div key={x.id} draggable onDragStart={() => setDragSm(x.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragSm) reorder(dragSm, x.id); setDragSm(null); }}
                    className={cn('mb-1.5 flex items-center gap-2 rounded-lg border border-[rgb(var(--line))] px-2 py-1.5', hid && 'opacity-50')}>
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[rgb(var(--muted))]" aria-hidden />
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px]">{i + 1}. {x.config.title}</p><p className="text-[11.5px] text-[rgb(var(--muted))]">{({ 12: 'Cả hàng', 6: '1/2', 4: '1/3', 3: '1/4' } as Record<number, string>)[x.pos.sm.w || 12]}{hid ? ` · ẩn với ${ROLE_LABEL[role]}` : ''}</p></div>
                    {lIsCore(x.type) && <Lock className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--muted))]" aria-label="Khối lõi" />}
                    {devs.map(([k, I, l]) => <button key={k} disabled={lIsCore(x.type)} aria-pressed={x.show[k]} aria-label={`${x.config.title}: ${l}`} title={l} className={cn('grid h-7 w-7 place-items-center rounded-md border', x.show[k] ? 'border-[rgb(var(--fg))] text-[rgb(var(--fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))] opacity-60')} onClick={() => commit(blocks.map((y) => (y.id === x.id ? { ...y, show: { ...y.show, [k]: !y.show[k] } } : y)))}><I className="h-3.5 w-3.5" aria-hidden /></button>)}
                  </div>
                ); })}
              </div>
            </div>
          ) : fieldMode && fl && !blockPanel ? <LFieldInspector fl={fl} onBack={() => setBlockPanel(true)} />
          : b ? <LBlockSettings b={b} onCfg={setCfg} onBlock={setB} onPos={setPos} page={page} cf={cfAll} tabs={tabsCfg} etab={etab} setEtab={setEtab} onFields={enterFields} fine={G.fine}
              ext={{ c: <><LVerticalCfg b={b} onCfg={setCfg} cf={cfAll} /><LContainerCfg key={b.id} b={b} onCfg={setCfg} page={page} cf={cfAll} dctx={dctx} /></>, s: <LSpacingEditor b={b} onCfg={setCfg} />, v: <LDeviceExtra b={b} onCfg={setCfg} onBlock={setB} fine={G.fine} dash={!bizPage} /> }} /> : (
            <div className="space-y-4 text-[13px] text-[rgb(var(--fg2))]">
              <div className="space-y-2"><h3 className="font-medium text-[rgb(var(--fg))]">Cài đặt khối</h3><p>Bấm vào một khối để đổi tiêu đề, nguồn dữ liệu, khoảng cách, cách hiển thị trên từng thiết bị.</p><p className="text-[rgb(var(--muted))]">{blocks.length} khối · {blocks.filter((x) => x.show.sm).length} khối hiện trên điện thoại</p></div>
              <div className="border-t border-[rgb(var(--line))] pt-3 text-[rgb(var(--fg))]"><LPageGridEditor grid={grid} onGrid={setGrid} count={blocks.length} onFine={() => { commit(lToFine(blocks)); setGrid({ ...(grid ?? L_GRID_FINE), row: 8, gap: grid?.gap ?? 12 }); }} /></div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Bảng điều khiển nền tảng: chỉ số tổng hợp từ đăng ký bản quyền + thống kê dữ liệu từng doanh nghiệp (không hardcode số liệu) */
export function ConsoleOverview() {
  const { platform } = useApp();
  const rows = ORGS.map((o) => {
    const r = platform.tenants.find((x) => x.id === o.id) ?? defaultTenantReg(o);
    const st = tenantStats(o.id);
    const left = daysTo(r.contractEnd);
    const on = PROVISION_MODULES.filter((m) => r.modules[m]).length;
    const seatPct = r.seats ? st.activeUsers / r.seats : 0;
    const backupAge = r.lastBackupAt ? Math.floor((Date.now() - r.lastBackupAt) / 86400000) : null;
    return { o, r, st, left, on, seatPct, backupAge };
  });
  const active = rows.filter((x) => x.r.status === 'ACTIVE').length;
  const users = rows.reduce((s, x) => s + x.st.activeUsers, 0);
  const seats = rows.reduce((s, x) => s + x.r.seats, 0);
  const mods = rows.reduce((s, x) => s + x.on, 0);
  const expiring = rows.filter((x) => x.left <= 60).length;
  const alerts: { tone: Tone; tenant: Org; text: string; tab: ConsoleTab }[] = [];
  rows.forEach(({ o, r, st, left, seatPct, backupAge }) => {
    if (r.status === 'SUSPENDED') alerts.push({ tone: 'red', tenant: o, text: 'Đang tạm dừng: người dùng không đăng nhập được', tab: 'tenants' });
    if (left < 0) alerts.push({ tone: 'red', tenant: o, text: `Hợp đồng đã hết hạn ${-left} ngày`, tab: 'tenants' });
    else if (left <= 60) alerts.push({ tone: 'orange', tenant: o, text: `Hợp đồng còn ${left} ngày, cần gia hạn`, tab: 'tenants' });
    if (seatPct >= 0.9) alerts.push({ tone: 'orange', tenant: o, text: `Đã dùng ${Math.round(seatPct * 100)}% số ghế (${st.activeUsers}/${r.seats})`, tab: 'tenants' });
    if (st.version && st.version < DATA_VERSION) alerts.push({ tone: 'orange', tenant: o, text: `Dữ liệu phiên bản ${st.version}, mới nhất ${DATA_VERSION}`, tab: 'data' });
    if (backupAge === null || backupAge > 7) alerts.push({ tone: 'muted', tenant: o, text: backupAge === null ? 'Chưa có bản sao lưu' : `Sao lưu gần nhất ${backupAge} ngày trước`, tab: 'data' });
  });
  return (
    <div className="space-y-5">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Doanh nghiệp hoạt động" value={`${active} / ${rows.length}`} sub={rows.length - active ? `${rows.length - active} tạm dừng` : 'Tất cả hoạt động'} icon={Building2} color={active === rows.length ? C.teal : C.red} />
        <StatCard label="Người dùng kích hoạt" value={String(users)} sub={`${seats} ghế bản quyền, dùng ${pct(users, seats)}`} icon={Users} />
        <StatCard label="Module cấp phép" value={String(mods)} sub={`trên ${rows.length * PROVISION_MODULES.length} khả dụng`} icon={SlidersHorizontal} />
        <StatCard label="Hợp đồng sắp hết hạn" value={String(expiring)} sub="trong 60 ngày tới" icon={CalendarDays} color={expiring ? C.orange : C.teal} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Bản quyền theo doanh nghiệp" action={<button className={cn(btnGhost, btnSm)} onClick={() => platform.setConsoleTab('tenants')}>Quản lý doanh nghiệp<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>}>
          <ul className="divide-y divide-[rgb(var(--line))]">
            {rows.map(({ o, r, st, left, on, seatPct }) => (
              <li key={o.id} className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: o.color }} aria-hidden />
                  <div className="min-w-0"><p className="truncate font-semibold">{o.name}</p><p className="text-xs text-[rgb(var(--muted))]">{TENANT_PLAN[r.plan].label} · {on}/{PROVISION_MODULES.length} module · {st.customers} khách hàng</p></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs"><span className="text-[rgb(var(--muted))]">Ghế đã dùng</span><span className="tabular-nums">{st.activeUsers}/{r.seats}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><div className={cn('h-full rounded-full', seatPct >= 0.9 ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--secondary))]')} style={{ width: `${Math.min(100, Math.round(seatPct * 100))}%` }} /></div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <Chip tone={r.status !== 'ACTIVE' || left < 0 ? 'red' : left <= 60 ? 'orange' : 'teal'}>{r.status !== 'ACTIVE' ? 'Tạm dừng' : left < 0 ? 'Hết hạn' : `Còn ${left} ngày`}</Chip>
                  <button className={cn(btnGhost, btnSm)} onClick={() => platform.switchTenant(o.id)} aria-label={`Truy cập ${o.shortName}`}><LogIn className="h-3.5 w-3.5" aria-hidden /></button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={`Cần xử lý (${alerts.length})`}>
          {alerts.length ? (
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li key={i}><button className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => platform.setConsoleTab(a.tab)}>
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.tone === 'red' ? 'bg-[rgb(var(--danger))]' : a.tone === 'orange' ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--faint))]')} aria-hidden />
                  <span className="min-w-0"><b className="font-medium">{a.tenant.shortName}</b><span className="block text-xs text-[rgb(var(--muted))]">{a.text}</span></span>
                </button></li>
              ))}
            </ul>
          ) : <EmptyState compact art="inbox" text="Không có cảnh báo" hint="Tất cả doanh nghiệp đang ổn định." />}
        </Panel>
      </div>
      <Panel title="Hoạt động nền tảng gần đây" action={<button className={cn(btnGhost, btnSm)} onClick={() => platform.setConsoleTab('admins')}>Nhật ký đầy đủ<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>}>
        {platform.logs.length ? (
          <ul className="divide-y divide-[rgb(var(--line))] text-sm">
            {platform.logs.slice(0, 8).map((l) => <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2"><span className="min-w-0">{l.tenant ? <b className="font-medium">{orgOf(l.tenant).shortName}: </b> : null}{l.detail}</span><span className="text-xs text-[rgb(var(--muted))]">{l.by} · {new Date(l.at).toLocaleString('vi-VN')}</span></li>)}
          </ul>
        ) : <EmptyState compact art="doc" text="Chưa có hoạt động" hint="Thao tác cấp phép, sao lưu, nâng cấp sẽ được ghi tại đây." />}
      </Panel>
    </div>
  );
}

/** Đọc dữ liệu đã lưu của một doanh nghiệp (chỉ đọc). Chế độ cloud: dữ liệu nằm sau RLS từng tenant nên trả null. */
export function tenantSnapshot(org: string): AnyRec | null {
  if (CLOUD_ON) return null;
  try { const raw = storage.get(dataKey(org)); return raw ? ((JSON.parse(raw) as StoredData).data ?? null) as AnyRec : null; } catch { return null; }
}

/** User Management + Role & Permission toàn nền tảng (chỉ đọc; sửa trong Cài đặt của từng doanh nghiệp để giữ nhật ký & phân tách dữ liệu) */
export function ConsoleUsers() {
  const { platform } = useApp();
  const [q, setQ] = useSticky('ConsoleUsers.q', '');
  const [org, setOrg] = useSticky<string>('ConsoleUsers.org', 'ALL');
  const now = Date.now();
  const data = ORGS.map((o) => {
    const d = tenantSnapshot(o.id);
    const users = ((d?.users ?? []) as User[]);
    const perms = (d?.perms ?? INITIAL_PERMS) as Perms;
    const sec = { ...INITIAL_SECURITY, ...((d?.security ?? {}) as Partial<SecurityPolicy>) };
    return { o, users, perms, sec, st: tenantStats(o.id), loaded: !!d };
  });
  const t = q.trim().toLowerCase();
  const rows = data.filter((x) => org === 'ALL' || x.o.id === org).flatMap((x) => x.users.map((u) => ({ u, o: x.o })))
    .filter(({ u }) => !t || `${u.name} ${u.email} ${ROLE_LABEL[u.role]}`.toLowerCase().includes(t));
  const srt = useSort('ConsoleUsers', rows, { 0: (r) => r.u.name, 1: (r) => r.o.shortName, 2: (r) => ROLE_LABEL[r.u.role], 3: (r) => r.u.lastLoginAt ?? 0 });
  const paged = usePaged(srt.rows, 15);
  const status = (u: User) => (!u.active ? { tone: 'muted' as Tone, label: 'Ngừng' } : u.lockedUntil && u.lockedUntil > now ? { tone: 'red' as Tone, label: 'Đang khóa' } : u.mustChangePassword ? { tone: 'orange' as Tone, label: 'Chờ đổi mật khẩu' } : { tone: 'teal' as Tone, label: 'Hoạt động' });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.map(({ o, users, perms, sec, st, loaded }) => (
          <Panel key={o.id} title={o.name} action={<button className={cn(btnGhost, btnSm)} onClick={() => platform.switchTenant(o.id)}><LogIn className="h-3.5 w-3.5" aria-hidden />Quản lý trong DN</button>}>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {[['Tài khoản', String(loaded ? users.length : st.users)], ['Hoạt động', String(loaded ? users.filter((u) => u.active).length : st.activeUsers)], ['Đang khóa', loaded ? String(users.filter((u) => u.lockedUntil && u.lockedUntil > now).length) : '—'], ['Phiên tự thoát', `${sec.idleMinutes} phút`]].map(([k, v]) => (
                <div key={k} className="rounded bg-[rgb(var(--raised))] p-2.5"><dt className="text-[11px] text-[rgb(var(--muted))]">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
              ))}
            </dl>
            <h4 className="mb-1.5 mt-4 text-xs font-semibold text-[rgb(var(--muted))]">Vai trò → số phân hệ được truy cập</h4>
            <ul className="space-y-1.5">
              {ROLES.map((r) => {
                const n = MODULES.filter((m) => perms.modules?.[r]?.[m]).length;
                const cnt = users.filter((u) => u.role === r).length;
                return (
                  <li key={r} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                    <div className="min-w-0"><div className="flex justify-between gap-2"><span className="truncate">{ROLE_LABEL[r]}</span><span className="text-xs tabular-nums text-[rgb(var(--muted))]">{n}/{MODULES.length}</span></div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><div className="h-full rounded-full bg-[rgb(var(--secondary))]" style={{ width: `${Math.round((n / MODULES.length) * 100)}%` }} /></div></div>
                    <Chip>{loaded ? `${cnt} người` : '—'}</Chip>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-[rgb(var(--muted))]">Mật khẩu tối thiểu {sec.minPasswordLength} ký tự · khóa sau {sec.lockoutAttempts} lần sai ({sec.lockoutMinutes} phút) · phiên {sec.sessionDays} ngày{sec.roleSwitch ? ' · cho phép BOD xem thử vai trò' : ''}</p>
          </Panel>
        ))}
      </div>
      <Panel title={`Tài khoản toàn nền tảng (${rows.length})`}>
        {CLOUD_ON ? <EmptyState compact art="inbox" text="Danh sách tài khoản nằm trong dữ liệu riêng của từng doanh nghiệp" hint="Chế độ cloud tách dữ liệu bằng RLS; dùng “Quản lý trong DN” để xem và sửa." /> : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <SearchBox value={q} onChange={(v) => { setQ(v); paged.setPage(1); }} placeholder="Tìm tên, email, vai trò" />
              <select className={cn(inputBase, 'sm:w-56')} value={org} onChange={(e) => { setOrg(e.target.value); paged.setPage(1); }} aria-label="Doanh nghiệp">
                <option value="ALL">Mọi doanh nghiệp</option>{ORGS.map((o) => <option key={o.id} value={o.id}>{o.shortName}</option>)}
              </select>
            </div>
            {rows.length ? (
              <>
                <Table stt={Math.max(0, paged.from - 1)} head={['Họ tên', 'Doanh nghiệp', 'Vai trò', 'Đăng nhập gần nhất', 'Trạng thái']} minW={760} sort={srt.th}>
                  {paged.slice.map(({ u, o }) => { const s = status(u); return (
                    <tr key={`${o.id}-${u.id}`} className={rowCls}>
                      <td className={tdFirst}><p className="font-medium">{u.name}</p><p className="text-xs text-[rgb(var(--muted))]">{u.email}</p></td>
                      <td className={tdCls}>{o.shortName}</td>
                      <td className={tdCls}>{ROLE_LABEL[u.role]}</td>
                      <td className={cn(tdCls, 'text-xs text-[rgb(var(--muted))]')}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</td>
                      <td className={tdLast}><Chip tone={s.tone}>{s.label}</Chip></td>
                    </tr>
                  ); })}
                </Table>
                <Pagination paged={paged} unit="tài khoản" />
              </>
            ) : <EmptyState compact art="search" text="Không có tài khoản phù hợp" hint="Doanh nghiệp chưa nạp dữ liệu hoặc bộ lọc quá hẹp." />}
          </>
        )}
      </Panel>
    </div>
  );
}

export function ConsoleTenants() {
  const { platform, org, notify } = useApp();
  const [edit, setEdit] = useState<TenantReg | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [adding, setAdding] = useState(false);
  // v56: ngành & bộ mẫu ngành của doanh nghiệp (bảng trượt bên phải)
  const [ind, setInd] = useState<string | null>(null);
  const who = usePlatformWho();
  const indLabel = (r: TenantReg, o: Org) => industryProfilesEff(platform.industryProfiles).find((p) => p.id === tenantIndustry(r, o))?.label ?? '—';
  const linkOf = (id: string) => (typeof window !== 'undefined' ? `${window.location.origin}/${id}` : `/${id}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <p className="text-[13px] text-[rgb(var(--muted))]">{ORGS.length} doanh nghiệp · mỗi doanh nghiệp có đường dẫn đăng nhập và dữ liệu riêng</p>
        <button className={cn(btnPrimary, btnSm, 'lg:ml-auto')} onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm doanh nghiệp</button>
      </div>
      <Panel>
        <Table minW={1180} head={['Mã', 'Doanh nghiệp', 'Đường dẫn', 'Gói', 'Ngành', <span key="u" className="block text-right">Người dùng</span>, 'Hết hạn', 'Còn', <span key="m" className="block text-right">Module</span>, 'Dữ liệu', 'Trạng thái', '']}>
          {ORGS.map((o) => {
            const r = platform.tenants.find((x) => x.id === o.id) ?? defaultTenantReg(o);
            const st = tenantStats(o.id);
            const left = daysTo(r.contractEnd);
            const on = PROVISION_MODULES.filter((m) => r.modules[m]).length;
            return (
              <tr key={o.id} className={rowCls}>
                <td className={tdFirst}><Code>{o.id}</Code></td>
                <td className={tdCls}><span className="flex items-center gap-2"><OrgMark o={o} size={22} /><span className="font-medium">{o.shortName}</span></span></td>
                <td className={cn(tdCls, 'font-mono text-xs')}><a className="hover:underline" href={linkOf(o.id)} target="_blank" rel="noreferrer">/{o.id}</a></td>
                <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{TENANT_PLAN[r.plan].label}</td>
                <td className={tdCls}><button className="max-w-[170px] truncate text-left hover:underline" onClick={() => setInd(o.id)} title={r.industryApplied ? 'Đã áp dụng bộ mẫu ngành' : 'Chưa áp dụng bộ mẫu ngành'}>{indLabel(r, o)}{r.industryApplied ? '' : <span className="ml-1 text-[12px] text-[rgb(var(--muted))]">· chưa áp mẫu</span>}</button></td>
                <td className={cn(tdCls, 'text-right font-mono text-xs', st.activeUsers > r.seats && 'text-[rgb(var(--danger-fg))]')}>{st.activeUsers} / {r.seats}</td>
                <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(r.contractEnd)}</td>
                <td className={cn(tdCls, left < 0 ? 'text-[rgb(var(--danger-fg))]' : left <= 60 ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--fg2))]')}>{left < 0 ? `Quá ${-left} ngày` : `Còn ${left} ngày`}</td>
                <td className={cn(tdCls, 'text-right font-mono text-xs')}>{on} / {PROVISION_MODULES.length}</td>
                <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--muted))]')}>v{st.version || '—'} · {(st.size / 1024).toFixed(0)} KB</td>
                <td className={tdCls}><Chip tone={r.status === 'ACTIVE' ? 'teal' : 'red'}>{r.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}</Chip></td>
                <td className={cn(tdLast, 'text-right')}><span className="flex items-center justify-end gap-1">
                  <button className={cn(btnGhost, btnSm)} onClick={() => platform.switchTenant(o.id)}><LogIn className="h-3.5 w-3.5" aria-hidden />{org.id === o.id ? 'Đang mở' : 'Truy cập'}</button>
                  <RowMenu label={`Thao tác ${o.shortName}`} items={[
                    { label: 'Hợp đồng & gói', icon: Pencil, onClick: () => setEdit(r) },
                    { label: 'Ngành & mẫu ngành', icon: LayoutTemplate, onClick: () => setInd(o.id) },
                    { label: 'Cấp phép module', icon: SlidersHorizontal, onClick: () => platform.setConsoleTab('modules') },
                    { label: 'Sao chép đường dẫn', icon: Link2, onClick: () => navigator.clipboard?.writeText(linkOf(o.id)).then(() => notify('Đã sao chép đường dẫn', 'teal'), () => notify('Trình duyệt chặn sao chép', 'red')) },
                    { label: r.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt lại', icon: r.status === 'ACTIVE' ? XCircle : CheckCircle2, danger: r.status === 'ACTIVE', onClick: () => setConfirm({ title: r.status === 'ACTIVE' ? `Tạm dừng ${o.shortName}` : `Kích hoạt lại ${o.shortName}`, confirmLabel: r.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt', message: r.status === 'ACTIVE' ? `Người dùng ${o.shortName} sẽ không đăng nhập được cho tới khi kích hoạt lại. Dữ liệu giữ nguyên; kỹ thuật 3A vẫn truy cập hỗ trợ được.` : `Cho phép người dùng ${o.shortName} đăng nhập lại.`, onConfirm: () => platform.setTenantReg(o.id, { status: r.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }, r.status === 'ACTIVE' ? 'Tạm dừng doanh nghiệp' : 'Kích hoạt lại doanh nghiệp') }) },
                  ]} />
                </span></td>
              </tr>
            );
          })}
        </Table>
      </Panel>
      {edit && (
        <Modal title={`Hợp đồng & gói: ${orgOf(edit.id).shortName}`} onClose={() => setEdit(null)} footer={<><button className={btnGhost} onClick={() => setEdit(null)}>Hủy</button><button className={btnPrimary} onClick={() => { platform.setTenantReg(edit.id, { plan: edit.plan, seats: edit.seats, contractStart: edit.contractStart, contractEnd: edit.contractEnd, note: edit.note }, `Gói ${TENANT_PLAN[edit.plan].label}, ${edit.seats} người dùng, hạn ${fmtDate(edit.contractEnd)}`); setEdit(null); }}>Lưu</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gói bản quyền"><select className={inputCls} value={edit.plan} onChange={(e) => { const p = e.target.value as TenantPlan; setEdit({ ...edit, plan: p, seats: TENANT_PLAN[p].seats }); }}>{(Object.keys(TENANT_PLAN) as TenantPlan[]).map((p) => <option key={p} value={p}>{TENANT_PLAN[p].label} ({TENANT_PLAN[p].price})</option>)}</select></Field>
            <Field label="Số người dùng"><input className={inputCls} type="number" min={1} value={edit.seats} onChange={(e) => setEdit({ ...edit, seats: Math.max(1, Number(e.target.value) || 1) })} /></Field>
            <Field label="Bắt đầu hợp đồng"><input className={inputCls} type="date" value={edit.contractStart} onChange={(e) => setEdit({ ...edit, contractStart: e.target.value })} /></Field>
            <Field label="Hết hạn hợp đồng"><input className={inputCls} type="date" value={edit.contractEnd} onChange={(e) => setEdit({ ...edit, contractEnd: e.target.value })} /></Field>
            <Field label="Ghi chú" className="col-span-2"><input className={inputCls} value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {adding && <AddTenantModal onClose={() => setAdding(false)} onCreated={(id) => setInd(id)} />}
      {ind && <IndustrySheet key={ind} tenantId={ind} who={who} onClose={() => setInd(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

export function ConsoleModules() {
  const { platform } = useApp();
  const toggle = (id: string, m: Module, on: boolean) => {
    const r = platform.tenants.find((x) => x.id === id)!;
    platform.setTenantReg(id, { modules: { ...r.modules, [m]: on } }, `${on ? 'Bật' : 'Tắt'} module ${MODULE_LABEL[m]}`);
  };
  const preset = (id: string) => {
    const o = orgOf(id);
    platform.setTenantReg(id, { modules: defaultTenantReg(o).modules }, `Áp dụng gói chuẩn ${BUSINESS_PROFILE[o.profile].label}`);
  };
  const feature = (id: string, k: keyof TenantReg['features'], on: boolean) => {
    const r = platform.tenants.find((x) => x.id === id)!;
    platform.setTenantReg(id, { features: { ...r.features, [k]: on } }, `${on ? 'Bật' : 'Tắt'} tích hợp ${k}`);
  };
  const FEATURE_LABEL: Record<keyof TenantReg['features'], string> = { getfly: 'Tích hợp Getfly CRM', zns: 'Zalo ZNS', smtp: 'Email SMTP' };
  return (
    <Panel>
      <div className="-mx-5 overflow-x-auto">
        <table className="dt w-full min-w-[720px] text-sm">
          <thead className="text-xs text-[rgb(var(--muted))]">
            <tr className="border-b border-[rgb(var(--line))]">
              <th className="py-3 pl-5 pr-3 text-left font-medium">Module / tính năng</th>
              {ORGS.map((o) => (
                <th key={o.id} className="w-56 px-3 py-3 text-center font-medium">
                  <span className="flex items-center justify-center gap-1.5 text-sm text-[rgb(var(--fg))]"><i className="h-2 w-2 rounded-full" style={{ background: o.color }} />{o.shortName}</span>
                  <button className="mt-1 text-[11px] text-[rgb(var(--accent-fg))] hover:underline" onClick={() => preset(o.id)}>Gói chuẩn {BUSINESS_PROFILE[o.profile].label.toLowerCase()}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[rgb(var(--line)/0.6)] bg-[rgb(var(--raised)/0.4)]"><td className="py-2 pl-5 text-xs text-[rgb(var(--muted))]" colSpan={ORGS.length + 1}>Luôn bật: Tổng quan, Công việc, Cài đặt</td></tr>
            {MODULE_GROUP.map((g) => (
              <Fragment key={g.title}>
                <tr><td className="pb-1 pl-5 pt-4 text-[11px] font-semibold text-[rgb(var(--muted))]" colSpan={ORGS.length + 1}>{g.title}</td></tr>
                {g.list.map((m) => {
                  const Icon = MODULE_ICON[m];
                  return (
                    <tr key={m} className="border-b border-[rgb(var(--line)/0.6)] hover:bg-[rgb(var(--raised)/0.5)]">
                      <td className="py-2.5 pl-5 pr-3"><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><span><span className="block">{MODULE_LABEL[m]}</span><span className="block text-[11px] text-[rgb(var(--muted))]">{MODULE_DESC[m]}</span></span></span></td>
                      {ORGS.map((o) => { const r = platform.tenants.find((x) => x.id === o.id)!; const on = !!r.modules[m]; return <td key={o.id} className="px-3 py-2.5 text-center"><span className="inline-flex items-center gap-2"><Switch on={on} onChange={(v) => toggle(o.id, m, v)} label={`${MODULE_LABEL[m]} cho ${o.shortName}`} /><span className={cn('w-8 text-left text-xs', on ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}>{on ? 'Bật' : 'Tắt'}</span></span></td>; })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            <tr><td className="pb-1 pl-5 pt-4 text-[11px] font-semibold text-[rgb(var(--muted))]" colSpan={ORGS.length + 1}>Tích hợp</td></tr>
            {(Object.keys(FEATURE_LABEL) as (keyof TenantReg['features'])[]).map((k) => (
              <tr key={k} className="border-b border-[rgb(var(--line)/0.6)] hover:bg-[rgb(var(--raised)/0.5)]">
                <td className="py-2.5 pl-5 pr-3"><span className="flex items-center gap-2"><Plug className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />{FEATURE_LABEL[k]}</span></td>
                {ORGS.map((o) => { const r = platform.tenants.find((x) => x.id === o.id)!; const on = !!r.features[k]; return <td key={o.id} className="px-3 py-2.5 text-center"><span className="inline-flex items-center gap-2"><Switch on={on} onChange={(v) => feature(o.id, k, v)} label={`${FEATURE_LABEL[k]} cho ${o.shortName}`} /><span className={cn('w-8 text-left text-xs', on ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}>{on ? 'Bật' : 'Tắt'}</span></span></td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[rgb(var(--muted))]">Lưu ngay khi bấm. Doanh nghiệp đang mở cập nhật menu tức thì; doanh nghiệp còn lại áp dụng ở lần mở kế tiếp. Tắt module chỉ ẩn khỏi menu, không xóa dữ liệu.</p>
    </Panel>
  );
}

export function ConsoleData() {
  const { platform, notify } = useApp();
  const [backup, setBackup] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [, force] = useState(0);
  const doBackup = async () => {
    if (!backup) return;
    if (pass.length < 10) return notify('Mật khẩu bản sao lưu tối thiểu 10 ký tự', 'red');
    if (pass !== pass2) return notify('Nhập lại mật khẩu không khớp', 'red');
    setBusy(true);
    try { await platform.backupTenant(backup, pass); setBackup(null); setPass(''); setPass2(''); } catch (e) { notify(e instanceof Error ? e.message : 'Không sao lưu được', 'red'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {ORGS.map((o) => {
          const r = platform.tenants.find((x) => x.id === o.id)!;
          const st = tenantStats(o.id);
          const snaps = listSnapshots(o.id);
          const outdated = st.version > 0 && st.version < DATA_VERSION;
          return (
            <section key={o.id} className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5">
              <p className="flex items-center gap-2 font-semibold"><i className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />{o.name}</p>
              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Khóa lưu trữ</dt><dd className="font-mono text-xs">{dataKey(o.id)}</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Phiên bản dữ liệu</dt><dd className="flex items-center gap-2"><span className="font-semibold tabular-nums">v{st.version || '—'}</span>{st.version ? <Chip tone={outdated ? 'orange' : st.version > DATA_VERSION ? 'red' : 'teal'}>{outdated ? `Cần nâng cấp lên v${DATA_VERSION}` : st.version > DATA_VERSION ? 'Mới hơn app' : 'Mới nhất'}</Chip> : <Chip>Chưa có dữ liệu</Chip>}</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Dung lượng</dt><dd className="tabular-nums">{(st.size / 1024).toFixed(1)} KB</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Lưu gần nhất</dt><dd className="tabular-nums">{st.savedAt ? new Date(st.savedAt).toLocaleString('vi-VN') : '—'}</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Sao lưu gần nhất</dt><dd className={cn('tabular-nums', !r.lastBackupAt && 'text-[rgb(var(--accent-fg))]')}>{r.lastBackupAt ? new Date(r.lastBackupAt).toLocaleString('vi-VN') : 'Chưa sao lưu'}</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Nâng cấp gần nhất</dt><dd className="tabular-nums">{r.lastMigrationAt ? new Date(r.lastMigrationAt).toLocaleString('vi-VN') : '—'}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className={cn(btnGhost, btnSm)} disabled={!st.raw} onClick={() => setBackup(o.id)}><Download className="h-3.5 w-3.5" aria-hidden />Sao lưu độc lập</button>
                <button className={cn(btnPrimary, btnSm)} disabled={!st.raw || st.version > DATA_VERSION}
                  onClick={() => setConfirm({ title: `Nâng cấp dữ liệu ${o.shortName}`, confirmLabel: 'Nâng cấp', message: `Chạy nâng cấp cấu trúc dữ liệu ${o.shortName} từ v${st.version} lên v${DATA_VERSION}: chỉ bổ sung trường mới với giá trị mặc định, không xóa trường cũ. Hệ thống chụp snapshot trước khi ghi. Doanh nghiệp còn lại không bị ảnh hưởng.`, onConfirm: () => { platform.runMigration(o.id); force((x) => x + 1); } })}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />{outdated ? `Nâng cấp lên v${DATA_VERSION}` : 'Kiểm tra & bổ sung trường mới'}
                </button>
              </div>
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">Snapshot phục hồi ({snaps.length})</p>
                {snaps.length ? (
                  <ul className="space-y-1">
                    {snaps.map((x) => (
                      <li key={x.key} className="flex items-center justify-between gap-2 rounded bg-[rgb(var(--raised))] px-3 py-1.5 text-xs">
                        <span className="tabular-nums">{new Date(x.at).toLocaleString('vi-VN')} · v{x.version} · {x.reason}</span>
                        <button className="text-[rgb(var(--accent-fg))] hover:underline" onClick={() => setConfirm({ title: `Khôi phục ${o.shortName}`, confirmLabel: 'Khôi phục', message: `Khôi phục dữ liệu ${o.shortName} về lúc ${new Date(x.at).toLocaleString('vi-VN')}? Dữ liệu hiện tại được chụp lại trước.`, onConfirm: () => { platform.restoreTenantSnapshot(o.id, x.key); force((v) => v + 1); } })}>Khôi phục</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-[rgb(var(--muted))]">Chưa có snapshot. Snapshot tự chụp trước mỗi lần nâng cấp, nhập hoặc khôi phục.</p>}
              </div>
            </section>
          );
        })}
      </div>
      <Panel title="Nguyên tắc nâng cấp an toàn">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[rgb(var(--muted))]">
          <li>Mỗi doanh nghiệp một khóa lưu riêng (<span className="font-mono">3a:tenant:vassh</span>, <span className="font-mono">3a:tenant:alux</span>) kèm số phiên bản dữ liệu.</li>
          <li>Bước nâng cấp chỉ thêm hoặc đổi tên trường, giá trị mới lấy mặc định; không xóa dữ liệu người dùng.</li>
          <li>Trước khi nâng cấp, nhập hoặc khôi phục luôn chụp snapshot (giữ {SNAP_KEEP} bản gần nhất mỗi doanh nghiệp).</li>
          <li>Dữ liệu mới hơn bản app sẽ bị khóa ghi để không ghi đè, cho tới khi cập nhật app.</li>
        </ul>
      </Panel>
      {backup && (
        <Modal title={`Sao lưu mã hóa ${orgOf(backup).shortName}`} onClose={() => setBackup(null)} footer={<><button className={btnGhost} onClick={() => setBackup(null)}>Hủy</button><button className={btnPrimary} disabled={busy} onClick={() => void doBackup()}>{busy ? 'Đang mã hóa…' : 'Tải bản sao lưu'}</button></>}>
          <div className="space-y-3">
            <Field label="Mật khẩu bản sao lưu" hint="Tối thiểu 10 ký tự. Mất mật khẩu sẽ không mở được file."><input className={inputCls} type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
            <Field label="Nhập lại mật khẩu"><input className={inputCls} type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} /></Field>
            <p className="text-xs text-[rgb(var(--muted))]">File AES-256-GCM chỉ chứa dữ liệu {orgOf(backup).shortName}; nhập lại ở Cài đặt &gt; Dữ liệu & bảo mật của chính doanh nghiệp đó.</p>
          </div>
        </Modal>
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

export function ConsoleAdmins() {
  const { platform, notify, me } = useApp();
  const [form, setForm] = useState<{ name: string; email: string } | null>(null);
  if (CLOUD_ON) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel title="Tài khoản quản trị nền tảng" className="xl:col-span-3">
          <p className="text-sm text-[rgb(var(--muted))]">Chế độ máy chủ: tài khoản quản trị 3A quản lý trong Supabase.</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li>Supabase &gt; Authentication &gt; Users &gt; Add user: nhập email @{PLATFORM_DOMAIN}, mật khẩu, tick Auto Confirm.</li>
            <li>SQL Editor: <code className="rounded bg-[rgb(var(--bg))] px-1.5 py-0.5 text-xs text-[rgb(var(--accent-fg))]">insert into public.platform_admins (user_id, email) select id, email from auth.users where email = &apos;ten@{PLATFORM_DOMAIN}&apos;;</code></li>
            <li>Gỡ quyền: xóa dòng tương ứng trong bảng platform_admins.</li>
          </ol>
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">Đang đăng nhập: {me.email}</p>
        </Panel>
        <Panel title="Nhật ký nền tảng" className="xl:col-span-2">
          {platform.logs.length ? (
            <ul className="max-h-[420px] space-y-1.5 overflow-y-auto text-xs">
              {platform.logs.map((l) => <li key={l.id} className="rounded bg-[rgb(var(--raised))] px-3 py-2"><b>{l.tenant ? `${orgOf(l.tenant).shortName}: ` : ''}{l.detail}</b><p className="mt-0.5 text-[rgb(var(--muted))]">{l.by}, {new Date(l.at).toLocaleString('vi-VN')}</p></li>)}
            </ul>
          ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có thao tác.</p>}
        </Panel>
      </div>
    );
  }
  const add = () => {
    if (!form) return;
    const email = form.email.trim().toLowerCase();
    if (form.name.trim().length < 3 || !isPlatformEmail(email)) return notify(`Nhập họ tên và email @${PLATFORM_DOMAIN}`, 'red');
    if (platform.admins.some((a) => a.email === email)) return notify('Email đã có', 'red');
    platform.setAdmins((p) => [...p, { id: uid('pa'), name: form.name.trim(), email, role: 'BOD', active: true, approvalLimit: 1e13, mustChangePassword: true }]);
    platform.log('ADMIN_ADD', `Thêm quản trị ${email}`);
    notify(`Đã thêm ${email}, mật khẩu khởi tạo ${DEMO_PASSWORD} (bắt đổi khi đăng nhập)`, 'teal');
    setForm(null);
  };
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Panel title="Tài khoản quản trị nền tảng" className="xl:col-span-3" action={<button className={cn(btnPrimary, btnSm)} onClick={() => setForm({ name: '', email: '' })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm quản trị</button>}>
        <Table head={['Họ tên', 'Email', 'Đăng nhập gần nhất', 'Trạng thái', '']} minW={640}>
          {platform.admins.map((a) => (
            <tr key={a.id} className={rowCls}>
              <td className={tdFirst}>{a.name}{a.id === me.id && <span className="ml-1 text-xs text-[rgb(var(--muted))]">(bạn)</span>}</td>
              <td className={cn(tdCls, 'text-xs')}>{a.email}</td>
              <td className={cn(tdCls, 'whitespace-nowrap text-xs tabular-nums')}>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('vi-VN') : '—'}</td>
              <td className={tdCls}><Chip tone={a.active ? 'teal' : 'red'}>{a.active ? 'Hoạt động' : 'Đã khóa'}</Chip></td>
              <td className={tdLast}><span className="flex justify-end gap-1.5">
                <button className={cn(btnGhost, btnSm)} disabled={a.id === me.id} onClick={() => { platform.setAdmins((p) => p.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x))); platform.log('ADMIN_TOGGLE', `${a.active ? 'Khóa' : 'Mở'} ${a.email}`); }}>{a.active ? 'Khóa' : 'Mở khóa'}</button>
                <button className={cn(btnGhost, btnSm, 'whitespace-nowrap')} disabled={a.id === me.id} onClick={() => { platform.setAdmins((p) => p.map((x) => (x.id === a.id ? { ...x, passwordHash: undefined, salt: undefined, mustChangePassword: true, failedAttempts: 0, lockedUntil: undefined } : x))); platform.log('ADMIN_RESET', `Đặt lại mật khẩu ${a.email}`); notify(`Mật khẩu ${a.email} về ${DEMO_PASSWORD}, bắt đổi khi đăng nhập`, 'orange'); }}>Đặt lại mật khẩu</button>
              </span></td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title="Nhật ký nền tảng" className="xl:col-span-2">
        {platform.logs.length ? (
          <ul className="max-h-[420px] space-y-1.5 overflow-y-auto text-xs">
            {platform.logs.map((l) => <li key={l.id} className="rounded bg-[rgb(var(--raised))] px-3 py-2"><p className="flex justify-between gap-2"><b>{l.tenant ? `${orgOf(l.tenant).shortName}: ` : ''}{l.detail}</b></p><p className="mt-0.5 text-[rgb(var(--muted))]">{new Date(l.at).toLocaleString('vi-VN')}, {l.by}</p></li>)}
          </ul>
        ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có thao tác.</p>}
      </Panel>
      {form && (
        <Modal title="Thêm quản trị nền tảng" onClose={() => setForm(null)} footer={<><button className={btnGhost} onClick={() => setForm(null)}>Hủy</button><button className={btnPrimary} onClick={add}>Thêm</button></>}>
          <div className="space-y-3">
            <Field label="Họ tên"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email" hint={`Phải thuộc tên miền @${PLATFORM_DOMAIN}`}><input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={`ten@${PLATFORM_DOMAIN}`} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Bảng đơn giá m² / md & lịch thanh toán (mô hình xưởng) ----------------

export function PricingSettings() {
  const { priceItems, setPriceItems, mfgConfig, setMfgConfig, canDo, notify, audit } = useApp();
  const can = canDo('priceList.manage');
  const canCfg = canDo('settings.edit') || can;
  const [q, setQ] = useSticky('PricingSettings.q', '');
  const [cat, setCat] = useState('ALL');
  const [edit, setEdit] = useState<PriceItem | null>(null);
  const [cfg, setCfg] = useState<MfgConfig>(mfgConfig);
  const cats = Array.from(new Set(priceItems.map((p) => p.category))).sort();
  const t = q.trim().toLowerCase();
  const list = priceItems.filter((p) => (cat === 'ALL' || p.category === cat) && (!t || `${p.code} ${p.name}`.toLowerCase().includes(t)));
  const sumPct = cfg.schedule.reduce((s, x) => s + x.pct, 0);
  const saveItem = () => {
    if (!edit) return;
    if (edit.code.trim().length < 2 || edit.name.trim().length < 3) return notify('Nhập mã và tên hạng mục', 'red');
    if (edit.price <= 0) return notify('Nhập đơn giá bán', 'red');
    if (priceItems.some((p) => p.id !== edit.id && p.code.trim().toUpperCase() === edit.code.trim().toUpperCase())) return notify('Mã hạng mục đã tồn tại', 'red');
    const item = { ...edit, code: edit.code.trim().toUpperCase(), name: edit.name.trim(), category: edit.category.trim() || 'Khác' };
    setPriceItems((all) => (all.some((p) => p.id === item.id) ? all.map((p) => (p.id === item.id ? item : p)) : [...all, item]));
    audit('PRICE_ITEM_SAVE', `${item.code}: ${vnd(item.price)}/${PRICE_UNIT[item.unit].short}`);
    notify(`Đã lưu ${item.code}. Báo giá đã lưu trước đó giữ nguyên giá cũ.`, 'teal');
    setEdit(null);
  };
  const saveCfg = () => {
    if (sumPct !== 100) return notify(`Tổng các đợt thanh toán phải bằng 100% (đang ${sumPct}%)`, 'red');
    if (cfg.schedule.some((s) => !s.label.trim() || s.pct <= 0)) return notify('Mỗi đợt cần tên và tỷ lệ lớn hơn 0', 'red');
    setMfgConfig((c) => ({ ...c, schedule: cfg.schedule, vatPct: cfg.vatPct, quoteValidDays: cfg.quoteValidDays, warrantyMonths: cfg.warrantyMonths, submitHours: cfg.submitHours, productionDays: cfg.productionDays }));
    audit('MFG_CONFIG', `Lịch thanh toán ${cfg.schedule.map((s) => `${s.label} ${s.pct}%`).join(' / ')}`);
    notify('Đã lưu cấu hình. Áp dụng cho đơn tạo mới.', 'teal');
  };
  const setStage = (i: number, p: Partial<PayStage>) => setCfg((c) => ({ ...c, schedule: c.schedule.map((s, k) => (k === i ? { ...s, ...p } : s)) }));
  return (
    <div className="space-y-5">
      <Panel title="Lịch thanh toán mặc định & quy định thu tiền">
        <p className="mb-3 text-xs text-[rgb(var(--muted))]">Mặc định khi chốt đơn; kỹ thuật vẫn sửa được % từng đơn lúc chốt. Doanh số chỉ ghi nhận khi kế toán xác nhận phiếu thu.</p>
        <ul className="space-y-2">
          {cfg.schedule.map((s, i) => (
            <li key={s.id} className="grid grid-cols-12 items-center gap-2">
              <input className={cn(inputCls, 'col-span-12 sm:col-span-5')} value={s.label} disabled={!canCfg} onChange={(e) => setStage(i, { label: e.target.value })} aria-label="Tên đợt" />
              <div className="relative col-span-4 sm:col-span-2"><input className={cn(inputCls, 'pr-7 text-right tabular-nums')} type="number" min={1} max={100} value={s.pct} disabled={!canCfg} onChange={(e) => setStage(i, { pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} aria-label="Tỷ lệ" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--muted))]">%</span></div>
              <select className={cn(inputCls, 'col-span-6 sm:col-span-4')} value={s.trigger} disabled={!canCfg} onChange={(e) => setStage(i, { trigger: e.target.value as PayTrigger })} aria-label="Mốc thu">{(Object.keys(PAY_TRIGGER) as PayTrigger[]).map((k) => <option key={k} value={k}>{PAY_TRIGGER[k]}</option>)}</select>
              <button className={cn(btnGhost, btnSm, 'col-span-2 sm:col-span-1 justify-center')} disabled={!canCfg || cfg.schedule.length <= 1} onClick={() => setCfg((c) => ({ ...c, schedule: c.schedule.filter((_, k) => k !== i) }))} aria-label="Xóa đợt"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button className={cn(btnGhost, btnSm)} disabled={!canCfg || cfg.schedule.length >= 5} onClick={() => setCfg((c) => ({ ...c, schedule: [...c.schedule, { id: uid('ps'), label: 'Đợt giữa', pct: 0, trigger: 'DELIVERY' }] }))}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm đợt</button>
          <span className={cn('text-sm tabular-nums', sumPct === 100 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>Tổng {sumPct}%</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="VAT mặc định (%)"><input className={inputCls} type="number" min={0} max={10} value={cfg.vatPct} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, vatPct: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Field label="Hiệu lực báo giá (ngày)"><input className={inputCls} type="number" min={1} value={cfg.quoteValidDays} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, quoteValidDays: Math.max(1, Number(e.target.value) || 1) })} /></Field>
          <Field label="Bảo hành (tháng)"><input className={inputCls} type="number" min={0} value={cfg.warrantyMonths} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, warrantyMonths: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Field label="Hạn nộp tiền mặt (giờ)" hint="Quá hạn: báo đỏ ở Tổng quan và Trung tâm phê duyệt"><input className={inputCls} type="number" min={1} max={72} value={cfg.submitHours} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, submitHours: Math.max(1, Number(e.target.value) || 24) })} /></Field>
          <Field label="Số ngày sản xuất mặc định"><input className={inputCls} type="number" min={1} value={cfg.productionDays} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, productionDays: Math.max(1, Number(e.target.value) || 10) })} /></Field>
        </div>
        <div className="mt-3 flex gap-2"><button className={btnPrimary} disabled={!canCfg} onClick={saveCfg}>Lưu cấu hình</button><button className={btnGhost} onClick={() => setCfg(mfgConfig)}>Hoàn tác</button></div>
      </Panel>

      <Panel title={`Bảng đơn giá theo sản phẩm / vật liệu (${priceItems.length})`} action={<button className={cn(btnPrimary, btnSm)} disabled={!can} onClick={() => setEdit({ id: uid('pi'), code: '', name: '', category: cat !== 'ALL' ? cat : '', unit: 'M2', price: 0, cost: 0, minMeasure: 1, active: true })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm hạng mục</button>}>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden /><input className={cn(inputCls, 'pl-9')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã, tên" /></div>
          <select className={cn(inputBase, 'w-auto')} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Nhóm"><option value="ALL">Tất cả nhóm</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <button className={cn(btnGhost, btnSm)} onClick={() => downloadCsv(`bang-don-gia-${todayISO()}.csv`, [['Mã', 'Tên', 'Nhóm', 'ĐVT', 'Đơn giá', 'Giá vốn', 'Tối thiểu', 'Đang dùng'], ...priceItems.map((p) => [p.code, p.name, p.category, PRICE_UNIT[p.unit].short, p.price, p.cost, p.minMeasure ?? '', p.active ? 'Có' : 'Không'])])}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>
        </div>
        <Table head={['Hạng mục', 'Nhóm', 'ĐVT', 'Đơn giá bán', 'Giá vốn', 'GM', 'Tối thiểu / tấm', '']} minW={860}>
          {list.map((p) => {
            const gm = p.price ? ((p.price - p.cost) / p.price) * 100 : 0;
            return (
              <tr key={p.id} className={cn(rowCls, !p.active && 'opacity-50')}>
                <td className={tdFirst}><p className="font-medium">{p.name}</p><p className="text-xs text-[rgb(var(--muted))]">{p.code}{p.note ? `, ${p.note}` : ''}</p></td>
                <td className={cn(tdCls, 'text-xs')}>{p.category}</td>
                <td className={cn(tdCls, 'text-xs')}>{PRICE_UNIT[p.unit].short}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{vnd(p.price)}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums text-[rgb(var(--muted))]')}>{vnd(p.cost)}</td>
                <td className={cn(tdCls, 'tabular-nums', gm < 20 ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--success-fg))]')}>{gm.toFixed(0)}%</td>
                <td className={cn(tdCls, 'text-xs')}>{p.unit === 'M2' || p.unit === 'MD' ? `${p.minMeasure ?? 0} ${PRICE_UNIT[p.unit].short}` : '—'}</td>
                <td className={tdLast}><span className="flex gap-1.5">
                  <button className={cn(btnGhost, btnSm)} disabled={!can} onClick={() => setEdit(p)} aria-label={`Sửa ${p.code}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></button>
                  <button className={cn(btnGhost, btnSm)} disabled={!can} onClick={() => setPriceItems((all) => all.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)))}>{p.active ? 'Ngừng' : 'Dùng lại'}</button>
                </span></td>
              </tr>
            );
          })}
        </Table>
        {!list.length && <EmptyState text={<>Chưa có hạng mục.</>} art="box" />}
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">m²: rộng × cao (mm) / 1.000.000 × số lượng, mỗi tấm tính tối thiểu theo cột "Tối thiểu". md: chiều dài (m) × số lượng. Ngừng hạng mục không ảnh hưởng báo giá đã lưu.</p>
      </Panel>

      {edit && (
        <Modal title={priceItems.some((p) => p.id === edit.id) ? `Sửa ${edit.code}` : 'Thêm hạng mục đơn giá'} onClose={() => setEdit(null)} footer={<><button className={btnGhost} onClick={() => setEdit(null)}>Hủy</button><button className={btnPrimary} onClick={saveItem}>Lưu</button></>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Mã *"><input className={inputCls} value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="XF55-DI" /></Field>
            <Field label="Nhóm"><input className={inputCls} list="pi-cats" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="Cửa nhôm, Kính, Nội thất…" /><datalist id="pi-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field>
            <Field label="Tên hạng mục *" className="sm:col-span-2"><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Cửa đi nhôm Xingfa hệ 55, kính hộp" /></Field>
            <Field label="Đơn vị tính"><select className={inputCls} value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value as PriceUnit })}>{(Object.keys(PRICE_UNIT) as PriceUnit[]).map((u) => <option key={u} value={u}>{PRICE_UNIT[u].label}</option>)}</select></Field>
            {(edit.unit === 'M2' || edit.unit === 'MD') && <Field label={`Tối thiểu mỗi tấm (${PRICE_UNIT[edit.unit].short})`}><input className={inputCls} type="number" min={0} step={0.1} value={edit.minMeasure ?? 0} onChange={(e) => setEdit({ ...edit, minMeasure: Math.max(0, Number(e.target.value) || 0) })} /></Field>}
            <Field label={`Đơn giá bán / ${PRICE_UNIT[edit.unit].short} *`}><MoneyInput value={edit.price} onChange={(n) => setEdit({ ...edit, price: n })} /></Field>
            <Field label={`Giá vốn / ${PRICE_UNIT[edit.unit].short}`} hint="Chỉ dùng tính lãi gộp, không in ra báo giá"><MoneyInput value={edit.cost} onChange={(n) => setEdit({ ...edit, cost: n })} /></Field>
            <Field label="Ghi chú" className="sm:col-span-2"><input className={inputCls} value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value || undefined })} placeholder="Màu, phụ kiện kèm theo…" /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Đồng bộ 2 chiều trưởng phòng <-> thông tin nhân sự:
 * gán userId làm trưởng phòng `code` -> cập nhật vai trò / phòng của người mới,
 * hạ người cũ về Sales Rep và gỡ chức trưởng phòng cũ của người mới (nếu có).
 */
export function applyHead(code: DeptCode, userId: string | undefined, departments: Department[], users: User[]) {
  const dept = departments.find((d) => d.code === code);
  const oldHeadId = dept?.headId;
  const nextDepts = departments.map((d) => {
    if (d.code === code) return { ...d, headId: userId };
    if (userId && d.headId === userId) return { ...d, headId: undefined };
    return d;
  });
  const nextUsers = users.map((u) => {
    if (u.id === userId) return { ...u, dept: code, role: headRoleFor(u.role) };
    if (u.id === oldHeadId && oldHeadId !== userId && u.role === 'DEPT_HEAD') return { ...u, role: 'SALES_REP' as Role, approvalLimit: 0 };
    return u;
  });
  return { nextDepts, nextUsers };
}

export function DeptModal({ code, onClose }: { code?: string; onClose: () => void }) {
  const { departments, setDepartments, users, setUsers, leads, notify } = useApp();
  const existing = departments.find((d) => d.code === code);
  const [f, setF] = useState<Department>(existing ?? { code: '', name: '', short: '', slaMinutes: 120, receivesLeads: true, active: true });
  const [touched, setTouched] = useState(false);
  // Danh sách đầy đủ nhân sự đang hoạt động; người của phòng này lên đầu
  const candidates = users.filter((u) => u.active).sort((a, b) => Number(b.dept === f.code) - Number(a.dept === f.code) || a.name.localeCompare(b.name));
  const openLeads = existing ? leads.filter((l) => l.dept === existing.code && OPEN_STATUSES.includes(l.status)).length : 0;
  const newHead = users.find((u) => u.id === f.headId);
  const oldHead = users.find((u) => u.id === existing?.headId);
  const e: Partial<Record<keyof Department, string>> = {};
  if (!existing && !/^[A-Z][A-Z0-9_]{2,24}$/.test(f.code)) e.code = 'Mã viết hoa không dấu, 3–25 ký tự, VD: EMD_CENTRAL';
  else if (!existing && departments.some((d) => d.code === f.code)) e.code = 'Mã phòng ban đã tồn tại';
  if (f.name.trim().length < 3) e.name = 'Nhập tên phòng ban';
  if (!f.short.trim()) e.short = 'Nhập tên ngắn';
  if (f.slaMinutes < 15 || f.slaMinutes > 1440) e.slaMinutes = 'SLA từ 15 đến 1.440 phút';
  if (existing && !f.active && openLeads > 0) e.active = `Còn ${openLeads} lead đang xử lý, cần chuyển trước khi ngừng hoạt động`;
  const err = (k: keyof Department) => (touched ? e[k] : undefined);
  const set = <K extends keyof Department>(k: K, v: Department[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) return;
    const clean: Department = { ...f, name: f.name.trim(), short: f.short.trim(), headId: existing?.headId };
    const base = existing ? departments.map((d) => (d.code === existing.code ? clean : d)) : [...departments, clean];
    const { nextDepts, nextUsers } = f.headId !== existing?.headId ? applyHead(clean.code, f.headId, base, users) : { nextDepts: base, nextUsers: users };
    setDepartments(nextDepts);
    setUsers(nextUsers);
    notify(existing ? `Đã cập nhật ${clean.name}` : `Đã thêm ${clean.name}`, 'teal');
    onClose();
  };

  return (
    <Modal title={existing ? `Sửa ${existing.name}` : 'Thêm phòng ban'} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tên phòng ban *" error={err('name')} className="sm:col-span-2"><input className={inputCls} value={f.name} onChange={(ev) => set('name', ev.target.value)} placeholder="VD: Phòng EMD Miền Trung" /></Field>
        <Field label="Mã phòng ban *" error={err('code')} hint={existing ? 'Mã không đổi được sau khi tạo' : undefined}><input className={inputCls} disabled={!!existing} value={f.code} onChange={(ev) => set('code', ev.target.value.toUpperCase())} /></Field>
        <Field label="Tên ngắn *" error={err('short')}><input className={inputCls} value={f.short} onChange={(ev) => set('short', ev.target.value)} placeholder="EMD Trung" /></Field>
        <Field label="Trưởng phòng" className="sm:col-span-2" hint="Chọn bất kỳ nhân sự đang hoạt động; thông tin nhân sự được cập nhật tự động">
          <select className={inputCls} value={f.headId ?? ''} onChange={(ev) => set('headId', ev.target.value || undefined)}>
            <option value="">Chưa chỉ định</option>
            {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({ROLE_LABEL[u.role]}{u.dept ? `, ${departments.find((d) => d.code === u.dept)?.short ?? u.dept}` : ''})</option>)}
          </select>
        </Field>
        {f.headId !== existing?.headId && (newHead || oldHead) && (
          <div className="rounded bg-[rgb(var(--accent)/0.1)] p-3 text-xs text-[rgb(var(--accent-fg))] sm:col-span-2">
            {newHead && <p>{newHead.name} sẽ chuyển về {f.name || 'phòng này'} với vai trò {ROLE_LABEL[headRoleFor(newHead.role)]}.</p>}
            {oldHead && oldHead.role === 'DEPT_HEAD' && <p>{oldHead.name} thôi làm trưởng phòng, chuyển về Sales Rep.</p>}
          </div>
        )}
        <Field label="SLA tiếp nhận lead (phút)" error={err('slaMinutes')}><input className={inputCls} type="number" min={15} max={1440} value={f.slaMinutes} onChange={(ev) => set('slaMinutes', Number(ev.target.value))} /></Field>
        <div className="space-y-2 self-end pb-1">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.receivesLeads} onChange={(ev) => set('receivesLeads', ev.target.checked)} />Nhận lead từ Marketing</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.active} onChange={(ev) => set('active', ev.target.checked)} />Đang hoạt động</label>
          {err('active') && <p className="text-xs text-[rgb(var(--danger-fg))]">{err('active')}</p>}
        </div>
      </div>
    </Modal>
  );
}

export function UserModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const { users, setUsers, departments, setDepartments, me, notify, audit, canDo, org } = useApp();
  const [cloudBusy, setCloudBusy] = useState(false);
  const [issued, setIssued] = useState<{ email: string; pw: string } | null>(null);
  const existing = users.find((u) => u.id === id);
  const [f, setF] = useState<User>(existing ?? { id: '', name: '', email: '', phone: '', role: 'SALES_REP', dept: departments.find((d) => d.receivesLeads)?.code, active: true, approvalLimit: 0 });
  const wasHeadOf = existing ? departments.find((d) => d.headId === existing.id)?.code : undefined;
  const [isHead, setIsHead] = useState(!!wasHeadOf);
  const [touched, setTouched] = useState(false);
  const needsDept = f.role !== 'BOD';
  const e: Partial<Record<keyof User, string>> = {};
  if (f.name.trim().length < 3) e.name = 'Nhập họ tên';
  if (!EMAIL_RE.test(f.email)) e.email = 'Email chưa đúng định dạng';
  else if (users.some((u) => u.email.toLowerCase() === f.email.toLowerCase() && u.id !== f.id)) e.email = 'Email đã được dùng';
  if (needsDept && !f.dept) e.dept = 'Chọn phòng ban';
  if (existing && existing.id === me.id && !f.active) e.active = 'Không thể tự khóa tài khoản đang đăng nhập';
  const err = (k: keyof User) => (touched ? e[k] : undefined);
  const set = <K extends keyof User>(k: K, v: User[K]) => setF((p) => ({ ...p, [k]: v }));
  const deptOf = departments.find((d) => d.code === f.dept);
  const currentHead = deptOf?.headId && deptOf.headId !== f.id ? users.find((u) => u.id === deptOf.headId) : undefined;

  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) return;
    const uidNew = existing?.id ?? uid('u');
    let role = f.role;
    if (isHead && role === 'SALES_REP') role = 'DEPT_HEAD';
    if (!isHead && wasHeadOf && role === 'DEPT_HEAD') role = 'SALES_REP';
    const clean: User = { ...f, id: uidNew, role, name: f.name.trim(), email: f.email.trim().toLowerCase(), dept: needsDept ? f.dept : undefined, approvalLimit: role === 'DEPT_HEAD' || role === 'BOD' ? f.approvalLimit : 0 };
    let nextUsers = existing ? users.map((u) => (u.id === existing.id ? clean : u)) : [...users, clean];
    let nextDepts = departments.map((d) => (d.headId === uidNew && (!isHead || d.code !== clean.dept) ? { ...d, headId: undefined } : d));
    if (isHead && clean.dept) ({ nextDepts, nextUsers } = applyHead(clean.dept, uidNew, nextDepts, nextUsers));
    setUsers(nextUsers);
    setDepartments(nextDepts);
    if (existing && CLOUD_ON) {
      // Máy chủ: khóa tài khoản = thu hồi quyền đọc dữ liệu; đổi vai trò Giám đốc = đổi quyền cấp tài khoản
      if (existing.active && !clean.active) void cloud.revoke(clean.email, org.id).then(() => notify(`Đã khóa ${clean.name}, thu hồi quyền truy cập dữ liệu`, 'orange'), (er) => notify(cloudMessage(er), 'red'));
      else if (!existing.active && clean.active) notify(`Mở lại ${clean.name}: bấm "Đặt lại mật khẩu" để cấp lại quyền đăng nhập`, 'orange');
      else if (existing.role !== clean.role && clean.active) void cloud.provision(clean.email, org.id, null, clean.role === 'BOD', { role: clean.role, appUserId: clean.id }).catch((er) => { if (!/no_user/.test(String(er?.message))) notify(cloudMessage(er), 'red'); });
      if (existing.email.toLowerCase() !== clean.email) notify('Đã đổi email: bấm "Đặt lại mật khẩu" để tạo đăng nhập cho email mới', 'orange');
    }
    if (existing) { notify(`Đã cập nhật ${clean.name}`, 'teal'); onClose(); }
    else void issueTemp(uidNew, clean.email, 'CREATE', role);
  };

  /** Cấp mật khẩu tạm ngẫu nhiên (băm trước khi lưu), bắt đổi ở lần đăng nhập đầu */
  const issueTemp = async (id: string, email: string, why: 'CREATE' | 'RESET', roleNow?: Role) => {
    const pw = tempPassword();
    if (CLOUD_ON) {
      // Máy chủ: tạo / đặt lại tài khoản đăng nhập Supabase + gắn quyền vào doanh nghiệp
      const r = roleNow ?? users.find((u) => u.id === id)?.role;
      setCloudBusy(true);
      try { await cloud.provision(email, org.id, pw, r === 'BOD', r ? { role: r, appUserId: id } : undefined); }
      catch (er) { notify(cloudMessage(er), 'red'); if (why === 'CREATE') onClose(); return; }
      finally { setCloudBusy(false); }
      setUsers((p) => p.map((u) => (u.id === id ? { ...u, passwordHash: undefined, salt: undefined, mustChangePassword: true, failedAttempts: 0, lockedUntil: undefined, active: true } : u)));
      audit(why === 'CREATE' ? 'USER_CREATE' : 'PASSWORD_RESET', `${why === 'CREATE' ? 'Tạo tài khoản' : 'Đặt lại mật khẩu'} ${email}`, 'SECURITY');
      setIssued({ email, pw });
      return;
    }
    const h = await hashPassword(pw);
    setUsers((p) => p.map((u) => (u.id === id ? { ...u, passwordHash: h.hash, salt: h.salt, mustChangePassword: true, failedAttempts: 0, lockedUntil: undefined } : u)));
    audit(why === 'CREATE' ? 'USER_CREATE' : 'PASSWORD_RESET', `${why === 'CREATE' ? 'Tạo tài khoản' : 'Đặt lại mật khẩu'} ${email}`, 'SECURITY');
    setIssued({ email, pw });
  };
  if (issued) {
    return (
      <Modal title="Mật khẩu tạm" onClose={onClose} footer={<button className={btnPrimary} onClick={onClose}>Đã ghi lại</button>}>
        <p className="text-sm text-[rgb(var(--muted))]">Gửi mật khẩu này cho <b className="text-[rgb(var(--fg))]">{issued.email}</b> qua kênh riêng. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu. Mật khẩu chỉ hiện một lần.</p>
        <div className="mt-3 flex items-center gap-2 rounded border border-[rgb(var(--line))] bg-[rgb(var(--bg))] p-3">
          <code className="flex-1 select-all text-lg tracking-wider text-[rgb(var(--accent-fg))]">{issued.pw}</code>
          <button className={cn(btnGhost, btnSm)} onClick={() => navigator.clipboard?.writeText(issued.pw).then(() => notify('Đã sao chép', 'teal'))}><Copy className="h-3.5 w-3.5" aria-hidden />Sao chép</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={existing ? `Sửa nhân sự ${existing.name}` : 'Thêm nhân sự'} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button>{existing && canDo('security.manage') && <button className={cn(btnGhost, 'mr-auto')} disabled={cloudBusy} onClick={() => void issueTemp(existing.id, existing.email, 'RESET')}><KeyRound className="h-4 w-4" aria-hidden />{existing.lockedUntil && existing.lockedUntil > Date.now() ? 'Mở khóa & đặt lại mật khẩu' : 'Đặt lại mật khẩu'}</button>}<button className={btnPrimary} onClick={save}>Lưu</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Họ tên *" error={err('name')} className="sm:col-span-2"><input className={inputCls} value={f.name} onChange={(ev) => set('name', ev.target.value)} /></Field>
        <Field label="Email đăng nhập *" error={err('email')}><input className={inputCls} type="email" value={f.email} onChange={(ev) => set('email', ev.target.value)} /></Field>
        <Field label="Điện thoại (nhận Zalo ZNS)"><input type="tel" autoComplete="tel" className={inputCls} inputMode="tel" value={f.phone ?? ''} onChange={(ev) => set('phone', ev.target.value)} /></Field>
        <Field label="Chức danh"><input className={inputCls} placeholder="VD: Kế toán trưởng" value={f.title ?? ''} onChange={(ev) => set('title', ev.target.value || undefined)} /></Field>
        <Field label="Ngày sinh"><input className={inputCls} type="date" value={f.birthday ?? ''} onChange={(ev) => set('birthday', ev.target.value || undefined)} /></Field>
        <Field label="Vai trò">
          <select className={inputCls} value={f.role} onChange={(ev) => set('role', ev.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Phòng ban" error={err('dept')}>
          <select className={inputCls} disabled={!needsDept} value={needsDept ? f.dept ?? '' : ''} onChange={(ev) => set('dept', ev.target.value || undefined)}>
            <option value="">{needsDept ? 'Chọn phòng ban' : 'Ban Giám đốc'}</option>
            {departments.filter((d) => d.active).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </Field>
        {needsDept && f.dept && (
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" checked={isHead} onChange={(ev) => setIsHead(ev.target.checked)} />
            <span>Là trưởng phòng {deptOf?.name}{isHead && currentHead ? <span className="block text-xs text-[rgb(var(--accent-fg))]">Thay {currentHead.name}; người này sẽ chuyển về Sales Rep.</span> : null}</span>
          </label>
        )}
        {(f.role === 'DEPT_HEAD' || f.role === 'BOD' || isHead) && (
          <Field label="Hạn mức duyệt đề xuất MDF" hint="Vượt hạn mức sẽ chuyển lên Ban Giám đốc" className="sm:col-span-2"><MoneyInput value={f.approvalLimit} onChange={(n) => set('approvalLimit', n)} /></Field>
        )}
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.active} onChange={(ev) => set('active', ev.target.checked)} />Tài khoản đang hoạt động</label>
          {err('active') && <p className="mt-1 text-xs text-[rgb(var(--danger-fg))]">{err('active')}</p>}
        </div>
      </div>
    </Modal>
  );
}

