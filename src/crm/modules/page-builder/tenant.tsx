'use client';

// Bộ vẽ trang — bố cục áp dụng cho doanh nghiệp đang mở và trang Tổng quan theo bố cục
// (V55.2: chuyển từ modules/messages/messenger.tsx, giữ nguyên logic)
import { type ReactNode, useMemo, useState } from 'react';
import { useSticky } from '../../components/ui';
import { iso, L_DS, lCondOk, lEnsureCore, lIsCore, lMigrate, LPageC, todayISO, useApp } from '../../lib/core';
import type { DashPeriod, DateRange, DeptCode, LayoutAssign, LayoutVer, LBlock, LBlockCfg, LDataset, LDevice, LPage, LPageCtx, LRow, Role } from '../../lib/types';
import { dashRange, KpiTargetSheet } from '../dashboard/exec-dashboard';
import { lActCommonRun, lExport, lRowsReal, lVars, useMinW } from './engine';
import { LayoutView, LBusinessView } from './views';
import { lCommonNode } from './blocks';

/** Bố cục áp dụng cho doanh nghiệp đang mở: riêng doanh nghiệp → mô hình → toàn hệ thống (vai trò cụ thể trước, chung sau) */
export function useTenantLayout(page: LPage | null): LayoutVer | null {
  const { platform, org, role } = useApp();
  const prof: 'TRADING' | 'MFG' = org.profile === 'MANUFACTURING' ? 'MFG' : 'TRADING';
  const as = platform.layoutAssigns.filter((x) => x.page === page);
  const pick = (lv: LayoutAssign['level'], r: Role | null) => as.find((x) => x.level === lv && (x.role ?? null) === r && (lv !== 'PROFILE' || x.profile === prof) && (lv !== 'TENANT' || x.tenantId === org.id));
  const a = pick('TENANT', role) ?? pick('TENANT', null) ?? pick('PROFILE', role) ?? pick('PROFILE', null) ?? pick('SYSTEM', role) ?? pick('SYSTEM', null);
  const v = a ? platform.layouts.find((x) => x.id === a.verId) : undefined;
  return page && v && v.blocks.length ? { ...v, blocks: lEnsureCore(page, lMigrate(page, v.blocks)) } : null;
}

export function TenantLayoutPage({ ver }: { ver: LayoutVer }) {
  const app = useApp();
  const { stockVouchers, canSee, canDo, go, range, role, me, org } = app;
  const [period, setPeriod] = useSticky<DashPeriod>('L.home.period', 'MONTH');
  const [deptPick, setDeptPick] = useSticky<DeptCode | 'ALL'>('L.home.dept', 'ALL');
  const [tab, setTab] = useSticky<string>('L.home.tab', '');
  const [sheet, setSheet] = useState(false);
  const lockDept = role !== 'BOD' && role !== 'ACCOUNTANT' && role !== 'MKT_LEAD';
  const dept: DeptCode | 'ALL' = role === 'SALES_REP' ? 'ALL' : lockDept ? me.dept ?? 'ALL' : deptPick;
  // Có Bộ lọc chung: khối đặt kỳ "Theo Bộ lọc chung" và lọc phòng theo bộ lọc; không có thì theo ô kỳ ở thanh trên cùng
  const hasF = ver.blocks.some((b) => b.type === 'K-Filter');
  const rr = dashRange(period, Date.now());
  const pr: DateRange | undefined = hasF ? { from: iso(new Date(rr.from)), to: iso(new Date(rr.to - 864e5)) } : range;
  const cache = useMemo(() => new Map<LDataset, LRow[]>(), [app.mySales, app.myLeads, app.myCustomers, app.cashEntries, app.programs, stockVouchers]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsOf = (ds: LDataset) => {
    const d = L_DS[ds];
    if (!canSee(d.module) || (d.perm && !canDo(d.perm))) return null;
    if (!cache.has(ds)) cache.set(ds, lRowsReal(ds, app, stockVouchers));
    const base = cache.get(ds) ?? [];
    return hasF && dept !== 'ALL' && (ds === 'sales' || ds === 'leads' || ds === 'customers') ? base.filter((x) => x.dp === dept) : base;
  };
  const ctx: LPageCtx = {
    live: true, page: 'home', period, setPeriod, dept, setDept: setDeptPick, tab, setTab, vars: lVars(period, org.shortName || org.name, me?.name ?? ''), openTargets: () => setSheet(true),
    act: (b) => { if (b.act === 'excel') lExport(ver.blocks, rowsOf, pr, `TongQuan_${todayISO()}.xlsx`); else if (b.act === 'targets') setSheet(true); else lActCommonRun(b, (m) => go(m)); },
    can: () => true,
  };
  return (
    <LPageC.Provider value={ctx}>
      <LayoutView blocks={ver.blocks} rowsOf={rowsOf} range={pr} onOpen={(m) => go(m)} role={role} grid={ver.grid} />
      {sheet && <KpiTargetSheet onClose={() => setSheet(false)} />}
    </LPageC.Provider>
  );
}

/**
 * v55.3 Trang danh sách khách hàng / lead theo bố cục 3A phát hành (chưa phát hành: giao diện gốc).
 * Khối Danh sách bản ghi = bảng thật của phân hệ (render nhận cấu hình khối); khối hiển thị (text, nút, đường kẻ) theo vai trò.
 */
export function EntityListPage({ page, render }: { page: LPage; render: (cfg?: LBlockCfg) => ReactNode }) {
  const lay = useTenantLayout(page);
  const wide = useMinW(1280);
  const phone = !useMinW(640);
  const { role, go, org, me } = useApp();
  if (!lay) return <>{render()}</>;
  const dev: LDevice = wide ? 'lg' : phone ? 'sm' : 'md';
  const ctx: LPageCtx = {
    live: true, page, period: 'MONTH', setPeriod: () => {}, dept: 'ALL', setDept: () => {}, tab: '', setTab: () => {}, openTargets: () => {},
    vars: lVars('MONTH', org.shortName || org.name, me?.name ?? ''), act: (b) => lActCommonRun(b, (m) => go(m)), can: () => true,
  };
  const node = (b: LBlock): ReactNode => {
    if (!lIsCore(b.type) && !lCondOk(b.config, null, role)) return null;
    if (b.type === 'K-RecordList') return render(b.config);
    return lCommonNode(b, lay.grid);
  };
  return <LPageC.Provider value={ctx}><LBusinessView blocks={lay.blocks} node={node} narrow={!wide} dev={dev} grid={lay.grid} /></LPageC.Provider>;
}
