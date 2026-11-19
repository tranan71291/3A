'use client';

import { useState } from 'react';
import { Coins, Eye, Inbox, Megaphone, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Chip, Panel, ProgressBar, StatCard, Table, Tabs, useSticky } from '../../components/ui';
import { roiRating } from '../../lib/business';
import { bizMode, boqTotal, btnGhost, btnSm, C, compact, isAcceptLate, isMktCustomer, kpiGrid, LOST_REASON, mdfOfCustomer, pct, progName, PROGRAM_COLOR, PROGRAM_TYPES, rowCls, tdCls, tdFirst, tdLast, tierInfo, useApp, vnd } from '../../lib/core';
import { MonthlyReportModal } from '../../lib/monthly-email';
import type { Customer, LeadStatus, LostReason, ReportView } from '../../lib/types';
import { cn } from '../../lib/utils';
import { MfgReports } from '../alux/overview';
import { ArAgingPanel } from '../finance/ar-aging';
import { CommissionPanel } from '../finance/commission';
import { MdfSettlementReport } from '../mdf/settlement';
import { MdfMarginPanel } from '../mdf/surplus';
import { MarketingMetrics } from '../settings/settings';

// =====================================================================
// PHÂN HỆ 6: BÁO CÁO (tiếp)
// =====================================================================
export function ReportsPage() {
  const { company, canDo, role } = useApp();
  const mode = bizMode(company);
  const finance = canDo('cash.manage') || canDo('receipt.confirm') || canDo('claim.accounting') || role === 'BOD';
  // Tài chính: công nợ, quyết toán; chỉ số Marketing & quỹ MDF đã gộp vào Tổng quan
  const tabs: { id: ReportView; label: string }[] = [
    ...(finance ? [{ id: 'aging' as const, label: 'Công nợ & tuổi nợ' }] : []),
    ...(finance && mode !== 'MFG' ? [{ id: 'mdf' as const, label: 'Quyết toán quỹ MDF' }] : []),
    ...(finance && mode !== 'TRADING' ? [{ id: 'commission' as const, label: 'Quyết toán hoa hồng' }] : []),
    ...(mode !== 'TRADING' ? [{ id: 'mfg' as const, label: 'Lãi gộp đơn hàng' }] : []),
  ];
  const [view, setView] = useSticky<ReportView>('ReportsPage.view', tabs[0]?.id ?? 'aging');
  if (!tabs.length) return <Panel><p className="py-10 text-center text-sm text-[rgb(var(--muted))]">Phân hệ Tài chính dành cho Kế toán và Ban Giám đốc. Chỉ số Marketing & quỹ MDF xem ở Tổng quan.</p></Panel>;
  const cur = tabs.some((t) => t.id === view) ? view : tabs[0].id;
  return (
    <div className="space-y-5">
      <Tabs tabs={tabs} value={cur} onChange={setView} />
      {cur === 'mfg' && <MfgReports />}
      {cur === 'aging' && <ArAgingPanel />}
      {cur === 'commission' && <CommissionPanel />}
      {cur === 'mdf' && <MdfSettlementReport />}
    </div>
  );
}

/** Chỉ số Marketing & ROI, hiển thị nối tiếp Quỹ MDF ở Tổng quan (gộp tab Marketing cũ của Báo cáo) */
export function TradingReports({ embedded }: { embedded?: boolean } = {}) {
  const { customers, claims, programs, myLeads: leads, departments, now, mktItems, canDo } = useApp();
  const [preview, setPreview] = useState(false);
  const mdfOf = (id: string) => mdfOfCustomer(id, claims, programs);

  // ---- Đối soát đóng góp: Data MKT vs Quỹ MDF ----
  const groups = {
    both: customers.filter((c) => isMktCustomer(c) && mdfOf(c.id) > 0),
    mktOnly: customers.filter((c) => isMktCustomer(c) && mdfOf(c.id) === 0),
    mdfOnly: customers.filter((c) => !isMktCustomer(c) && mdfOf(c.id) > 0),
    none: customers.filter((c) => !isMktCustomer(c) && mdfOf(c.id) === 0),
  };
  const sum = (l: Customer[]) => l.reduce((s, c) => s + c.ytdRevenue, 0);
  const mktRev = sum(customers.filter((c) => isMktCustomer(c)));
  const mdfCustomers = customers.filter((c) => mdfOf(c.id) > 0);
  const mdfRev = sum(mdfCustomers);
  const mdfGiven = mdfCustomers.reduce((s, c) => s + mdfOf(c.id), 0);
  const totalRev = sum(customers);

  const byDept = departments.filter((d) => d.active).map((d) => {
    const cs = customers.filter((c) => c.dept === d.code);
    return { name: d.short, 'Từ data MKT': sum(cs.filter((c) => isMktCustomer(c))), 'Khách nhận MDF': sum(cs.filter((c) => mdfOf(c.id) > 0)) };
  });

  // ---- ROI theo nhóm chương trình (doanh thu của khách hưởng lợi / MDF nhóm đó) ----
  const byType = PROGRAM_TYPES.map((t) => {
    const ids = new Set([...claims.filter((c) => c.programType === t && c.customerId).map((c) => c.customerId!), ...programs.filter((p) => p.type === t && p.customerId && p.held > 0).map((p) => p.customerId!)]);
    const spent = claims.filter((c) => c.programType === t && c.customerId).reduce((s, c) => s + c.claimed, 0) + programs.filter((p) => p.type === t && p.customerId && p.held > 0 && p.status !== 'CLAIMING').reduce((s, p) => s + p.held, 0);
    const rev = sum(customers.filter((c) => ids.has(c.id)));
    return { t, spent, rev, n: ids.size, lev: spent ? rev / spent : null };
  });

  // ---- Phễu chuyển đổi ----
  const cnt = (s: LeadStatus[]) => leads.filter((l) => s.includes(l.status)).length;
  const funnel: [string, number][] = [
    ['Tổng lead MKT', leads.length],
    ['Đã phân về phòng ban', cnt(['ROUTED', 'ASSIGNED', 'ACCEPTED', 'QUOTED', 'WON', 'LOST'])],
    ['Đã chỉ định Sales', cnt(['ASSIGNED', 'ACCEPTED', 'QUOTED', 'WON', 'LOST'])],
    ['Sales tiếp nhận', cnt(['ACCEPTED', 'QUOTED', 'WON', 'LOST'])],
    ['Đã gửi báo giá', cnt(['QUOTED', 'WON', 'LOST'])],
    ['Chốt đơn', cnt(['WON'])],
  ];

  const sla = departments.filter((d) => d.receivesLeads).map((d) => {
    const l = leads.filter((x) => x.dept === d.code);
    const late = l.filter((x) => x.slaMet === false || isAcceptLate(x, now)).length;
    return { name: d.short, 'Đúng SLA': l.filter((x) => x.slaMet === true).length, 'Trễ SLA': late };
  });

  const roiRows = mdfCustomers.map((c) => ({ c, mdf: mdfOf(c.id), lev: c.ytdRevenue / mdfOf(c.id) })).sort((a, b) => b.lev - a.lev);
  const tooltip = { contentStyle: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text }, labelStyle: { color: C.muted } };

  // ---- ROI Marketing vs ROI quỹ MDF ----
  const mktSpent = mktItems.reduce((s, i) => s + i.spent, 0);
  const roiMkt = mktSpent ? mktRev / mktSpent : null;
  const roiMdf = mdfGiven ? mdfRev / mdfGiven : null;
  const roiCompare = [
    { name: 'Marketing', 'Doanh số tạo ra': mktRev, 'Chi phí': mktSpent },
    { name: 'Quỹ 3M (MDF + CS)', 'Doanh số tạo ra': mdfRev, 'Chi phí': mdfGiven },
  ];
  const won = leads.filter((l) => l.status === 'WON');
  const lost = leads.filter((l) => l.status === 'LOST');
  const lostByReason = (Object.keys(LOST_REASON) as LostReason[]).map((r) => ({ r, n: lost.filter((l) => l.lostReason === r).length, v: lost.filter((l) => l.lostReason === r).reduce((s, l) => s + boqTotal(l), 0) }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(var(--line))] pt-5">
        <div>
          <h2 className="text-[15px] font-semibold text-[rgb(var(--fg))]">Marketing & hiệu quả quỹ</h2>
          <p className="text-xs text-[rgb(var(--muted))]">Email báo cáo tháng tự gửi Ban Giám đốc, MKT và Kế toán đầu mỗi tháng (cấu hình Email SMTP).</p>
        </div>
        <button className={cn(btnGhost, btnSm)} onClick={() => setPreview(true)}><Eye className="h-3.5 w-3.5" aria-hidden />Xem trước email báo cáo tháng</button>
      </div>

      {!embedded && canDo('mdf.margin') && <MdfMarginPanel />}

      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Doanh số khách nguồn MKT" value={compact(mktRev)} sub={`${pct(mktRev, totalRev)} tổng doanh số, chi MKT ${compact(mktSpent)}`} icon={Inbox} color={C.orange} />
        <StatCard label="ROI Marketing" value={roiMkt ? `${roiMkt.toFixed(1)} lần` : '—'} sub="Doanh số khách MKT / chi phí MKT" icon={Megaphone} color={C.orange} />
        <StatCard label="Doanh số khách nhận quỹ" value={compact(mdfRev)} sub={`${mdfCustomers.length} khách, quỹ đã cấp ${compact(mdfGiven)}`} icon={Coins} color={C.teal} />
        <StatCard label="ROI quỹ 3M" value={roiMdf ? `${roiMdf.toFixed(1)} lần` : '—'} sub="Doanh số khách nhận quỹ / quỹ đã cấp" icon={TrendingUp} color={C.teal} />
      </div>

      <MarketingMetrics leads={leads} mktRev={mktRev} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="ROI Marketing so với ROI quỹ Hãng 3M" className="xl:col-span-2">
          <div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roiCompare} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => compact(Number(v))} width={64} />
                  <Tooltip {...tooltip} formatter={(v) => vnd(Number(v))} cursor={{ fill: '#ffffff08' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                  <Bar dataKey="Doanh số tạo ra" fill={C.teal} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Chi phí" fill={C.orange} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">{roiMkt && roiMdf ? (roiMkt > roiMdf ? 'Mỗi đồng chi Marketing đang tạo doanh số cao hơn quỹ 3M.' : 'Mỗi đồng quỹ 3M đang tạo doanh số cao hơn chi phí Marketing.') : ''} Một khách có thể thuộc cả hai nhóm.</p>
          </div>
        </Panel>
        <Panel title="Chốt đơn và Trượt">
          <div className="flex items-end gap-6">
            <div><p className="text-xs text-[rgb(var(--muted))]">Chốt đơn</p><p className="text-2xl font-semibold tabular-nums text-[rgb(var(--success-fg))]">{won.length}</p><p className="text-xs tabular-nums text-[rgb(var(--muted))]">{compact(won.reduce((s, l) => s + boqTotal(l), 0))}</p></div>
            <div><p className="text-xs text-[rgb(var(--muted))]">Trượt</p><p className="text-2xl font-semibold tabular-nums text-[rgb(var(--danger-fg))]">{lost.length}</p><p className="text-xs tabular-nums text-[rgb(var(--muted))]">{compact(lost.reduce((s, l) => s + boqTotal(l), 0))}</p></div>
            <div><p className="text-xs text-[rgb(var(--muted))]">Tỷ lệ chốt</p><p className="text-2xl font-semibold tabular-nums">{pct(won.length, won.length + lost.length)}</p></div>
          </div>
          <p className="mb-2 mt-5 text-xs font-medium text-[rgb(var(--muted))]">Lý do trượt</p>
          <ul className="space-y-2.5">
            {lostByReason.map((x) => (
              <li key={x.r}>
                <div className="mb-1 flex justify-between text-sm"><span className="text-[rgb(var(--muted))]">{LOST_REASON[x.r]}</span><span className="tabular-nums">{x.n} dự án, {compact(x.v)}</span></div>
                <ProgressBar value={x.n} max={Math.max(1, lost.length)} tone={C.red} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Đóng góp doanh số theo phòng ban" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDept} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => compact(Number(v))} width={64} />
                <Tooltip {...tooltip} formatter={(v) => vnd(Number(v))} cursor={{ fill: '#ffffff08' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                <Bar dataKey="Từ data MKT" fill={C.orange} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Khách nhận MDF" fill={C.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Đối soát nguồn đóng góp">
          <ul className="space-y-3 text-sm">
            {([
              ['Vừa từ data MKT vừa nhận MDF', groups.both, C.sand],
              ['Chỉ từ data MKT', groups.mktOnly, C.orange],
              ['Chỉ nhận MDF', groups.mdfOnly, C.teal],
              ['Kinh doanh tự khai thác', groups.none, C.muted],
            ] as [string, Customer[], string][]).map(([label, l, col]) => (
              <li key={label}>
                <div className="mb-1 flex justify-between gap-2"><span className="text-[rgb(var(--muted))]">{label} ({l.length})</span><span className="tabular-nums text-[rgb(var(--fg))]">{compact(sum(l))}</span></div>
                <ProgressBar value={sum(l)} max={totalRev} tone={col} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[rgb(var(--muted))]">Nhóm giao thoa cho thấy data MKT và quỹ Hãng cùng tác động lên một khách hàng. Không cộng dồn hai nhóm để tránh tính trùng.</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="ROI theo nhóm chương trình MDF">
          <Table stt={false} head={['Nhóm chương trình', 'MDF gắn KH', 'Doanh thu hưởng lợi', 'ROI']} minW={520}>
            {byType.map((r) => {
              const rt = roiRating(r.lev);
              return (
                <tr key={r.t} className={rowCls}>
                  <td className={tdFirst}><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: PROGRAM_COLOR[r.t] }} />{progName(r.t)}</span></td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.spent)}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.rev)} <span className="text-xs text-[rgb(var(--muted))]">({r.n} KH)</span></td>
                  <td className={tdLast}>{r.lev ? <Chip tone={rt.tone}>{r.lev.toFixed(1)} lần</Chip> : <span className="text-[rgb(var(--muted))]">—</span>}</td>
                </tr>
              );
            })}
          </Table>
        </Panel>
        <Panel title="Phễu chuyển đổi data MKT">
          <ul className="space-y-2.5">
            {funnel.map(([label, n], i) => (
              <li key={label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-[rgb(var(--muted))]">{label}</span>
                  <span className="tabular-nums text-[rgb(var(--fg))]">{n}{i > 0 && <span className="ml-2 text-xs text-[rgb(var(--muted))]">{pct(n, funnel[i - 1][1])}</span>}</span>
                </div>
                <ProgressBar value={n} max={funnel[0][1]} tone={i === funnel.length - 1 ? C.teal : C.orange} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Tuân thủ SLA tiếp nhận">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sla} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltip} cursor={{ fill: '#ffffff08' }} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                <Bar dataKey="Đúng SLA" stackId="a" fill={C.teal} />
                <Bar dataKey="Trễ SLA" stackId="a" fill={C.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="MDF ROI theo khách hàng" className="xl:col-span-2">
          <Table head={['Khách hàng', 'Hạng', 'MDF đã cấp', 'Doanh thu mang lại', 'MDF ROI']} minW={600}>
            {roiRows.map(({ c, mdf, lev }) => {
              const r = roiRating(lev);
              return (
                <tr key={c.id} className={rowCls}>
                  <td className={tdFirst}><p className="text-[rgb(var(--fg))]">{c.name}</p><p className="text-xs text-[rgb(var(--muted))]">{isMktCustomer(c) ? 'Nguồn data MKT' : 'Tự khai thác'}</p></td>
                  <td className={tdCls}><Chip tone={tierInfo(c.tier).tone}>{tierInfo(c.tier).label}</Chip></td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(mdf)}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(c.ytdRevenue)}</td>
                  <td className={tdLast}><Chip tone={r.tone}>{lev.toFixed(1)} lần, {r.label.toLowerCase()}</Chip></td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      </div>
      {preview && <MonthlyReportModal onClose={() => setPreview(false)} />}
    </div>
  );
}

