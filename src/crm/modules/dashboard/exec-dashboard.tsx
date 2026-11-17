'use client';

import { type ReactNode, useState } from 'react';
import { Printer, Target } from 'lucide-react';
import { Chip, EmptyState, Field, MoneyInput, ProgressBar, SideSheet, Sparkline, Table, Tabs, useSticky } from '../../components/ui';
import { claimState, scoreLead } from '../../lib/business';
import { agoText, bizMode, boqTotal, BRAND, btnAccent, btnGhost, btnPrimary, btnSm, channelOfSource, compact, daysInMonth, deltaPct, inputCls, inScope, isoMs, KPI_CFG_DEFAULT, kpiId, kpiMonthKey, LEAD_STATUS, leadAt, LOST_REASON, median, MKT_CH, MQL_THRESHOLD, paceStatus, PROGRAM_LABEL, ROLE_LABEL, rowCls, salesFunnel, SOURCE_LABEL, splitUnit, ST_NONE, ST_OK, ST_SLOW, ST_WATCH, tdCls, tdFirst, tdLast, TONE_RGB, useApp } from '../../lib/core';
import type { DashData, DashPeriod, DashRange, DashScope, DashTab, DeptCode, KpiCfg, KpiStatus, KpiTarget, Lead, LostReason, MktChannel, User } from '../../lib/types';
import { cn } from '../../lib/utils';
import { mdfForecast, slaRisks } from '../ai/ai-core';
import { MfgOverview } from '../alux/overview';
import { useInsights } from './overview';
import { campaignStats } from '../marketing/marketing-hub';
import { useApprovalQueue } from '../tasks/tasks';

export function dashRange(p: DashPeriod, now: number): DashRange {
  const d = new Date(now);
  const y = d.getFullYear(), m = d.getMonth();
  let from: Date, to: Date, prevFrom: Date, label: string, tag: string, prevTag: string;
  if (p === 'WEEK') {
    const dow = (d.getDay() + 6) % 7;
    from = new Date(y, m, d.getDate() - dow); to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    prevFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate() - 7);
    label = 'Tuần này'; tag = 'Tuần'; prevTag = 'tuần trước';
  } else if (p === 'MONTH') {
    from = new Date(y, m, 1); to = new Date(y, m + 1, 1); prevFrom = new Date(y, m - 1, 1);
    label = `Tháng ${m + 1}`; tag = `T${m + 1}`; prevTag = `T${((m + 11) % 12) + 1}`;
  } else if (p === 'QUARTER') {
    const q = Math.floor(m / 3);
    from = new Date(y, q * 3, 1); to = new Date(y, q * 3 + 3, 1); prevFrom = new Date(y, q * 3 - 3, 1);
    label = `Quý ${q + 1}`; tag = `Q${q + 1}`; prevTag = `quý ${((q + 3) % 4) + 1}`;
  } else {
    from = new Date(y, 0, 1); to = new Date(y + 1, 0, 1); prevFrom = new Date(y - 1, 0, 1);
    label = `Năm ${y}`; tag = String(y); prevTag = String(y - 1);
  }
  const len = to.getTime() - from.getTime();
  const months: { key: string; share: number }[] = [];
  for (let c = new Date(from.getFullYear(), from.getMonth(), 1); c < to; c = new Date(c.getFullYear(), c.getMonth() + 1, 1)) {
    const key = kpiMonthKey(c.getTime());
    const ms = Math.max(c.getTime(), from.getTime()), me = Math.min(new Date(c.getFullYear(), c.getMonth() + 1, 1).getTime(), to.getTime());
    months.push({ key, share: (me - ms) / (daysInMonth(key) * 864e5) });
  }
  return { from: from.getTime(), to: to.getTime(), prevFrom: prevFrom.getTime(), prevTo: from.getTime(), label, tag, prevTag, months,
    elapsed: Math.min(1, Math.max(0, (now - from.getTime()) / len)), daysLeft: Math.max(0, Math.ceil((to.getTime() - now) / 864e5)) };
}

/** Dữ liệu dùng chung cho 4 tab: tính một lần cho kỳ + phạm vi đang chọn */
export function useDashData(period: DashPeriod, scope: DashScope) {
  const app = useApp();
  const { myLeads: leads, jobs, myCustomers: customers, kpiTargets, budget, claims, campaigns, cashEntries, company } = app;
  const now = app.now ?? Date.now();
  const r = dashRange(period, now);
  const mfg = bizMode(company) === 'MFG';
  const trade = bizMode(company) !== 'MFG';
  const between = (t: number, a: number, b: number) => Number.isFinite(t) && t >= a && t < b;
  const sl = leads.filter((l) => inScope(scope, l.dept, l.assignee));
  const sj = jobs.filter((j) => inScope(scope, j.dept, j.ownerId));
  const leadValue = (l: Lead) => l.wonAmount ?? boqTotal(l);
  const revenueIn = (a: number, b: number) =>
    sl.filter((l) => l.status === 'WON' && between(isoMs(l.wonAt), a, b)).reduce((s, l) => s + leadValue(l), 0)
    + sj.filter((j) => j.wonAt && !j.lostAt && between(isoMs(j.wonAt), a, b)).reduce((s, j) => s + (j.contractValue ?? 0), 0);
  const wonIn = (a: number, b: number) => sl.filter((l) => l.status === 'WON' && between(isoMs(l.wonAt), a, b)).length + sj.filter((j) => j.wonAt && between(isoMs(j.wonAt), a, b)).length;
  const lostIn = (a: number, b: number) => sl.filter((l) => l.status === 'LOST' && between(leadAt(l), a, b)).length + sj.filter((j) => j.lostAt && between(isoMs(j.lostAt), a, b)).length;
  const leadsIn = (a: number, b: number) => sl.filter((l) => between(leadAt(l), a, b)).length;

  const cfg = kpiTargets.find((k) => k.scope === 'CFG')?.cfg ?? KPI_CFG_DEFAULT;
  /** Chỉ tiêu của phạm vi trong kỳ (cộng các tháng, tuần thì chia theo ngày) */
  const targetOf = (f: (k: KpiTarget) => number | undefined, sc: DashScope = scope) => r.months.reduce((s, m) => {
    const rows = kpiTargets.filter((k) => k.month === m.key && (sc.userId ? k.scope === 'USER' && k.refId === sc.userId : k.scope === 'DEPT' && (sc.dept === 'ALL' || k.refId === sc.dept)));
    return s + rows.reduce((a, k) => a + (f(k) ?? 0), 0) * m.share;
  }, 0);
  const monthTarget = (key: string) => kpiTargets.filter((k) => k.month === key && (scope.userId ? k.scope === 'USER' && k.refId === scope.userId : k.scope === 'DEPT' && (scope.dept === 'ALL' || k.refId === scope.dept))).reduce((a, k) => a + k.revenue, 0);

  const revenue = revenueIn(r.from, r.to), revenuePrev = revenueIn(r.prevFrom, r.prevTo);
  const target = targetOf((k) => k.revenue);
  const open = sl.filter((l) => !['WON', 'LOST'].includes(l.status));
  const openJobs = sj.filter((j) => !j.wonAt && !j.lostAt);
  const pipeline = open.reduce((s, l) => s + boqTotal(l), 0) + openJobs.reduce((s, j) => s + (j.quotes.at(-1)?.total ?? 0), 0);
  const won = wonIn(r.from, r.to), lost = lostIn(r.from, r.to), wonPrev = wonIn(r.prevFrom, r.prevTo), lostPrev = lostIn(r.prevFrom, r.prevTo);
  const winRate = won + lost ? (won / (won + lost)) * 100 : null;
  const winRatePrev = wonPrev + lostPrev ? (wonPrev / (wonPrev + lostPrev)) * 100 : null;
  const cycles = sl.filter((l) => l.status === 'WON' && between(isoMs(l.wonAt), r.from, r.to)).map((l) => (isoMs(l.wonAt) - leadAt(l)) / 864e5).filter((x) => x > 0);
  const cycle = median(cycles);
  const nLeads = leadsIn(r.from, r.to), nLeadsPrev = leadsIn(r.prevFrom, r.prevTo);
  const leadTarget = targetOf((k) => k.leads);
  const debt = customers.filter((c) => inScope(scope, c.dept, c.amId)).reduce((s, c) => s + c.debt, 0);
  const overLimit = customers.filter((c) => inScope(scope, c.dept, c.amId) && c.creditLimit > 0 && c.debt > c.creditLimit);
  const mdfAvail = Math.max(0, budget.total - budget.spent - budget.committed);
  const mdfUsedPct = budget.total ? ((budget.spent + budget.committed) / budget.total) * 100 : 0;
  const fyStart = isoMs(budget.periodStart), fyEnd = isoMs(budget.periodEnd);
  const fyElapsed = fyEnd > fyStart ? Math.min(100, Math.max(0, ((now - fyStart) / (fyEnd - fyStart)) * 100)) : 0;
  const pendingReimb = claims.filter((c) => !c.creditNote).reduce((s, c) => s + (c.vendorApproved ?? Math.min(c.claimed, c.cap || c.claimed)), 0);
  const cashIn = (a: number, b: number) => cashEntries.filter((e) => e.kind === 'IN' && between(isoMs(e.date), a, b)).reduce((s, e) => s + e.amount, 0);
  const activeCamps = campaigns.filter((c) => isoMs(c.start) < r.to && isoMs(c.end) + 864e5 > r.from);
  const campStats = activeCamps.map((c) => ({ c, s: campaignStats(c, leads, jobs) }));
  const campSpent = activeCamps.reduce((s, c) => s + c.spent, 0);
  const campLeads = campStats.reduce((s, x) => s + x.s.leads, 0);
  return {
    r, now, mfg, trade, cfg, scope, sl, sj, open, openJobs, targetOf, monthTarget, revenueIn, leadsIn,
    revenue, revenuePrev, target, pipeline, won, lost, winRate, winRatePrev, cycle, nLeads, nLeadsPrev, leadTarget,
    debt, overLimit, mdfAvail, mdfUsedPct, fyElapsed, pendingReimb, cashNow: cashIn(r.from, r.to), cashPrev: cashIn(r.prevFrom, r.prevTo),
    campStats, campSpent, campLeads, cpl: campLeads ? campSpent / campLeads : null,
  };
}

/** Thẻ KPI: số chính, so kỳ trước, thanh tiến độ có vạch kỳ vọng, trạng thái */
export function KpiTile({ label, tag, value, delta, deltaGood = 'up', deltaText, deltaPts, progress, marker, foot, status, spark, onClick }: {
  label: string; tag: string; value: string; delta?: number | null; /** delta là điểm phần trăm (tỷ lệ), không phải % thay đổi */ deltaPts?: boolean; deltaGood?: 'up' | 'down'; deltaText?: string; progress?: number; marker?: number; foot?: ReactNode; status: KpiStatus; spark?: number[]; onClick?: () => void;
}) {
  const [num, unit] = splitUnit(value);
  const good = delta == null ? null : deltaGood === 'up' ? delta >= 0 : delta <= 0;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cn('glass-card relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-md p-4 text-left', onClick && 'transition-shadow hover:shadow-[var(--shadow-md)]')}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: `rgb(${TONE_RGB[status.tone]})` }} aria-hidden />
      <div className="flex items-baseline justify-between gap-2"><p className="truncate text-[13px] font-semibold text-[rgb(var(--fg2))]">{label}</p><span className="shrink-0 text-[11px] text-[rgb(var(--faint))]">{tag}</span></div>
      <p className="font-display truncate text-[28px] font-extrabold leading-8 tracking-tight tabular-nums text-[rgb(var(--fg))]">{num}{unit && <span className="ml-1 text-base font-semibold text-[rgb(var(--muted))]">{unit}</span>}</p>
      <div className="min-h-[22px]">
        {deltaText ? <span className={cn('inline-flex rounded-sm px-1.5 py-0.5 text-xs font-semibold', status.tone === 'red' ? 'bg-[rgb(var(--danger)/0.12)] text-[rgb(var(--danger-fg))]' : 'bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent-fg))]')}>{deltaText}</span>
          : delta != null && Number.isFinite(delta) ? <span className={cn('inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums', good ? 'bg-[rgb(var(--success)/0.12)] text-[rgb(var(--success-fg))]' : 'bg-[rgb(var(--danger)/0.12)] text-[rgb(var(--danger-fg))]')}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString('vi-VN', { maximumFractionDigits: delta > -10 && delta < 10 ? 1 : 0 })}{deltaPts ? ' điểm' : '%'}</span>
            : <span className="text-xs text-[rgb(var(--faint))]">Chưa có kỳ trước</span>}
      </div>
      {progress !== undefined && (
        <div className="relative h-1.5 w-full rounded-full bg-[rgb(var(--line))]" role="img" aria-label={`Đạt ${Math.round(progress)}%${marker !== undefined ? `, kỳ vọng ${Math.round(marker)}%` : ''}`}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: `rgb(${TONE_RGB[status.tone]})` }} />
          {marker !== undefined && <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-[rgb(var(--fg))]" style={{ left: `calc(${Math.min(100, Math.max(0, marker))}% - 1px)` }} aria-hidden />}
        </div>
      )}
      {foot && <p className="truncate text-xs text-[rgb(var(--muted))]">{foot}</p>}
      {spark && spark.length > 1 && <Sparkline data={spark} color={BRAND.blueHi} height={20} />}
      <p className="mt-auto flex items-center gap-1.5 text-xs font-medium" style={{ color: status.tone === 'muted' ? 'rgb(var(--muted))' : `rgb(${TONE_RGB[status.tone]})` }}><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />{status.label}</p>
    </Tag>
  );
}

/** Khung tiêu đề + "Chi tiết →" dùng cho mọi khối */
export function DashPanel({ title, sub, more, onMore, children, className, badge }: { title: string; sub?: string; more?: string; onMore?: () => void; children: ReactNode; className?: string; badge?: number }) {
  return (
    <section className={cn('glass-card min-w-0 rounded-md p-5', className)}>
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="font-display text-[15px] font-bold tracking-tight">{title}</h2>
        {badge !== undefined && badge > 0 && <span className="rounded-full bg-[rgb(var(--danger)/0.15)] px-1.5 text-xs font-semibold text-[rgb(var(--danger-fg))]">{badge}</span>}
        {sub && <span className="truncate text-xs text-[rgb(var(--muted))]">{sub}</span>}
        {onMore && <button className="ml-auto shrink-0 text-xs font-semibold text-[rgb(var(--secondary-fg))] hover:underline" onClick={onMore}>{more ?? 'Chi tiết'} →</button>}
      </div>
      {children}
    </section>
  );
}

/** Thanh ngang có vạch chỉ tiêu và vạch kỳ vọng */
export function TargetBar({ label, value, target, expected, right, scale }: { label: string; value: number; target: number; expected: number; right?: ReactNode; /** Thang chung cho cả danh sách để các thanh so sánh được với nhau */ scale?: number }) {
  const max = Math.max(value, target, scale ?? 0) || 1;
  const st = paceStatus(value, target, expected);
  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
      <span className="truncate text-[rgb(var(--fg2))]">{label}</span>
      <div className="relative h-3 rounded-sm bg-[rgb(var(--ink)/0.05)]">
        <div className="h-full rounded-sm" style={{ width: `${(value / max) * 100}%`, background: `rgb(${TONE_RGB[target ? st.tone : 'orange']})` }} />
        {target > 0 && <span className="absolute -top-1 h-5 w-0.5 bg-[rgb(var(--fg))]" style={{ left: `${(target / max) * 100}%` }} title={`Chỉ tiêu ${compact(target)}`} aria-hidden />}
        {target > 0 && <span className="absolute top-0 h-3 w-px border-l border-dashed border-[rgb(var(--muted))]" style={{ left: `${((target * expected) / max) * 100}%` }} title="Kỳ vọng theo thời gian" aria-hidden />}
      </div>
      <span className="text-right font-num text-xs tabular-nums">{right ?? <>{compact(value)}{target > 0 && <span className="text-[rgb(var(--muted))]"> / {compact(target)}</span>}</>}</span>
    </div>
  );
}

/** Biểu đồ cột doanh thu 12 tháng + đường chỉ tiêu + cột dự báo (SVG thuần) */
export function RevenueKpiChart({ d }: { d: DashData }) {
  const { forecast } = useInsights();
  const nowD = new Date(d.now);
  const cols = Array.from({ length: 12 }, (_, i) => {
    const off = i - 9; // 9 tháng trước, tháng này, 2 tháng tới
    const m = new Date(nowD.getFullYear(), nowD.getMonth() + off, 1);
    const key = kpiMonthKey(m.getTime());
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
    const actual = off <= 0 ? d.revenueIn(m.getTime(), end) : 0;
    const fcRow = forecast.months.find((x) => x.key === key);
    const elapsedM = off === 0 ? Math.max(0.05, (d.now - m.getTime()) / (end - m.getTime())) : 1;
    const fc = off === 0 ? Math.max(actual, actual / elapsedM) : off > 0 ? fcRow?.forecast ?? 0 : 0;
    return { key, label: `T${m.getMonth() + 1}${m.getMonth() === 0 ? `/${String(m.getFullYear()).slice(2)}` : ''}`, actual, fc, target: d.monthTarget(key), off };
  });
  const max = Math.max(1, ...cols.map((c) => Math.max(c.actual, c.fc, c.target))) * 1.1;
  const W = 720, H = 220, L = 52, B = 24, cw = (W - L) / cols.length;
  const y = (v: number) => H - B - (v / max) * (H - B - 10);
  const tl = cols.filter((c) => c.target > 0);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-[rgb(var(--muted))]">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[rgb(var(--accent))]" />Thực tế</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-dashed border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.18)]" />Dự báo</span>
        <span className="flex items-center gap-1.5"><i className="h-0.5 w-4 bg-[rgb(var(--secondary))]" />Chỉ tiêu</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full" role="img" aria-label="Doanh thu theo tháng so với chỉ tiêu">
        {ticks.map((t) => <g key={t}><line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="rgb(var(--ink) / 0.06)" /><text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="rgb(var(--faint))">{t ? compact(t) : '0'}</text></g>)}
        {cols.map((c, i) => {
          const x = L + i * cw + cw * 0.2, w = cw * 0.6;
          return (
            <g key={c.key}>
              {c.fc > c.actual && <rect x={x} y={y(c.fc)} width={w} height={Math.max(0, y(c.actual) - y(c.fc))} rx="2" fill="rgb(var(--accent) / 0.18)" stroke="rgb(var(--accent))" strokeDasharray="3 3" />}
              {c.actual > 0 && <rect x={x} y={y(c.actual)} width={w} height={H - B - y(c.actual)} rx="2" fill="rgb(var(--accent))"><title>{`${c.label}: ${compact(c.actual)}${c.target ? ` / chỉ tiêu ${compact(c.target)}` : ''}`}</title></rect>}
              <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fontWeight={c.off === 0 ? 700 : 400} fill={c.off === 0 ? 'rgb(var(--fg))' : 'rgb(var(--muted))'}>{c.label}</text>
            </g>
          );
        })}
        {tl.length > 1 && <polyline fill="none" stroke="rgb(var(--secondary))" strokeWidth="2" points={tl.map((c) => `${L + cols.indexOf(c) * cw + cw / 2},${y(c.target)}`).join(' ')} />}
        {tl.length === 1 && <line x1={L + cols.indexOf(tl[0]) * cw + cw * 0.1} x2={L + cols.indexOf(tl[0]) * cw + cw * 0.9} y1={y(tl[0].target)} y2={y(tl[0].target)} stroke="rgb(var(--secondary))" strokeWidth="2" />}
      </svg>
      <p className="sr-only">{cols.map((c) => `${c.label}: ${compact(c.actual)}`).join(', ')}</p>
    </div>
  );
}

/** Phễu ngang: số lượng + % rơi giữa các bước */
export function FunnelBars({ steps, compactView }: { steps: { label: string; n: number }[]; compactView?: boolean }) {
  const max = Math.max(1, steps[0]?.n ?? 1);
  return (
    <ul className={cn('space-y-1.5', compactView && 'space-y-1')}>
      {steps.map((s, i) => {
        const prev = steps[i - 1]?.n;
        const last = i === steps.length - 1;
        return (
          <li key={s.label} className="grid grid-cols-[84px_1fr_auto] items-center gap-2 text-sm">
            <span className="truncate text-[rgb(var(--fg2))]">{s.label}</span>
            <div className="h-5 rounded-sm bg-[rgb(var(--ink)/0.04)]"><div className="h-full rounded-sm" style={{ width: `${Math.max(2, (s.n / max) * 100)}%`, background: last ? 'rgb(var(--success))' : 'rgb(var(--accent) / 0.55)' }} /></div>
            <span className="w-16 text-right font-num text-xs tabular-nums"><b>{s.n}</b>{!compactView && prev ? <span className="ml-1 text-[rgb(var(--muted))]">{Math.round((s.n / prev) * 100)}%</span> : null}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Thanh lọc: kỳ, phòng ban, chỉ tiêu, kỳ vọng tiến độ */
export function DashFilterBar({ period, setPeriod, scope, setScope, r, onTargets }: { period: DashPeriod; setPeriod: (p: DashPeriod) => void; scope: DashScope; setScope: (s: DashScope) => void; r: DashRange; onTargets: () => void }) {
  const { departments, role, me } = useApp();
  const now = new Date();
  const opts: { id: DashPeriod; label: string }[] = [{ id: 'WEEK', label: 'Tuần' }, { id: 'MONTH', label: `Tháng ${now.getMonth() + 1}` }, { id: 'QUARTER', label: `Quý ${Math.floor(now.getMonth() / 3) + 1}` }, { id: 'YEAR', label: `Năm ${now.getFullYear()}` }];
  const lockDept = role !== 'BOD' && role !== 'ACCOUNTANT' && role !== 'MKT_LEAD';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-md bg-[rgb(var(--ink)/0.05)] p-0.5" role="radiogroup" aria-label="Kỳ báo cáo">
        {opts.map((o) => <button key={o.id} role="radio" aria-checked={period === o.id} onClick={() => setPeriod(o.id)} className={cn('rounded px-3 py-1.5 text-sm', period === o.id ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>{o.label}</button>)}
      </div>
      <span className="rounded-md border border-[rgb(var(--line))] px-2.5 py-1.5 text-sm text-[rgb(var(--muted))]">So với {r.prevTag}</span>
      {role === 'SALES_REP' ? <span className="rounded-md border border-[rgb(var(--line))] px-2.5 py-1.5 text-sm">Của tôi</span> : (
        <select aria-label="Phòng ban" disabled={lockDept} className={cn(inputCls, 'h-9 w-auto py-0 text-sm')} value={scope.dept} onChange={(e) => setScope({ dept: e.target.value as DeptCode | 'ALL' })}>
          {!lockDept && <option value="ALL">Mọi phòng</option>}
          {departments.filter((d) => d.active && (!lockDept || d.code === me.dept)).map((d) => <option key={d.code} value={d.code}>{d.short || d.name}</option>)}
        </select>
      )}
      <button className={cn(btnGhost, 'h-9')} onClick={onTargets}><Target className="h-4 w-4" aria-hidden />Chỉ tiêu</button>
      <span className="ml-auto text-xs text-[rgb(var(--muted))]">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · kỳ vọng {Math.round(r.elapsed * 100)}% · còn {r.daysLeft} ngày</span>
      <button className={cn(btnGhost, 'h-9')} onClick={() => window.print()} title="In hoặc lưu PDF"><Printer className="h-4 w-4" aria-hidden />PDF</button>
    </div>
  );
}

/** Trang Tổng quan v37 */
export function ExecDashboard() {
  const { role, me, company, kpiTargets } = useApp();
  const [tab, setTab] = useSticky<DashTab>('Exec.tab', 'all');
  const [period, setPeriod] = useSticky<DashPeriod>('Exec.period', 'MONTH');
  const [deptPick, setDeptPick] = useSticky<DeptCode | 'ALL'>('Exec.dept', 'ALL');
  const [sheet, setSheet] = useState(false);
  const lockDept = role !== 'BOD' && role !== 'ACCOUNTANT' && role !== 'MKT_LEAD';
  const scope: DashScope = role === 'SALES_REP' ? { dept: 'ALL', userId: me.id } : { dept: lockDept ? me.dept ?? 'ALL' : deptPick };
  const d = useDashData(period, scope);
  const mode = bizMode(company);
  const tabs: { id: DashTab; label: string }[] = [{ id: 'all', label: 'Tổng Quan' }, { id: 'sales', label: 'Kinh doanh' }, { id: 'mkt', label: 'Marketing' }, { id: 'fin', label: 'Tài chính' }, ...(mode !== 'TRADING' ? [{ id: 'mfg' as const, label: 'Xưởng & công trình' }] : [])];
  const noTargets = !kpiTargets.some((k) => k.scope !== 'CFG');
  return (
    <div className="space-y-5">
      <Tabs tabs={tabs} value={tabs.some((t) => t.id === tab) ? tab : 'all'} onChange={setTab} />
      {tab !== 'mfg' && <DashFilterBar period={period} setPeriod={setPeriod} scope={scope} setScope={(s) => setDeptPick(s.dept)} r={d.r} onTargets={() => setSheet(true)} />}
      {tab !== 'mfg' && noTargets && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-[rgb(var(--accent)/0.5)] bg-[rgb(var(--accent)/0.05)] px-4 py-3 text-sm">
          <Target className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />
          <span className="flex-1">Chưa có chỉ tiêu tháng: thẻ KPI chỉ so với kỳ trước. {role === 'BOD' ? 'Giám đốc nhập chỉ tiêu phòng ban, Trưởng phòng nhập chỉ tiêu nhân viên.' : 'Giám đốc nhập chỉ tiêu phòng ban trước.'}</span>
          <button className={cn(btnAccent, btnSm)} onClick={() => setSheet(true)}>{role === 'BOD' || role === 'DEPT_HEAD' ? 'Nhập chỉ tiêu' : 'Xem chỉ tiêu'}</button>
        </div>
      )}
      {(tabs.some((t) => t.id === tab) ? tab : 'all') === 'all' && <DashOverviewTab d={d} setTab={setTab} />}
      {tab === 'sales' && <DashSalesTab d={d} />}
      {tab === 'mkt' && <DashMktTab d={d} />}
      {tab === 'fin' && <DashFinTab d={d} />}
      {tab === 'mfg' && mode !== 'TRADING' && <MfgOverview />}
      {sheet && <KpiTargetSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

export function useKpiTiles(d: DashData) {
  const { role, go } = useApp();
  const { r } = d;
  const rev: KpiStatus = paceStatus(d.revenue, d.target, r.elapsed);
  const need = Math.max(1, d.target - d.revenue);
  const cover = d.target ? d.pipeline / need : null;
  const tiles = {
    revenue: <KpiTile key="rev" label="Doanh thu" tag={r.tag} value={compact(d.revenue)} delta={deltaPct(d.revenue, d.revenuePrev)} progress={d.target ? (d.revenue / d.target) * 100 : undefined} marker={d.target ? r.elapsed * 100 : undefined}
      foot={d.target ? <><b className="text-[rgb(var(--fg))]">{Math.round((d.revenue / d.target) * 100)}%</b> chỉ tiêu {compact(d.target)}</> : `${d.won} dự án chốt`} status={rev} onClick={() => go('reports')} />,
    pipeline: <KpiTile key="pipe" label="Pipeline" tag={r.tag} value={compact(d.pipeline)} progress={cover != null ? Math.min(100, (cover / d.cfg.coverage) * 100) : undefined} marker={cover != null ? 100 : undefined}
      foot={cover != null ? <>Phủ <b className="text-[rgb(var(--fg))]">{cover.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</b> / {d.cfg.coverage} lần phần còn thiếu</> : `${d.open.length + d.openJobs.length} dự án đang mở`}
      status={cover == null ? ST_NONE : cover >= d.cfg.coverage ? ST_OK : cover >= d.cfg.coverage / 2 ? ST_WATCH : ST_SLOW} onClick={() => go('projects')} />,
    winRate: <KpiTile key="wr" label="Tỷ lệ chốt" tag={r.tag} value={d.winRate == null ? '—' : `${Math.round(d.winRate)} %`} delta={d.winRate != null && d.winRatePrev != null ? d.winRate - d.winRatePrev : null} deltaPts
      progress={d.winRate ?? undefined} marker={d.cfg.winRatePct} foot={<>{d.won} thắng · {d.lost} trượt · ngưỡng {d.cfg.winRatePct}%</>}
      status={d.winRate == null ? { label: 'Chưa có dự án kết thúc', tone: 'muted' } : d.winRate >= d.cfg.winRatePct ? ST_OK : d.winRate >= d.cfg.winRatePct * 0.8 ? ST_WATCH : ST_SLOW} />,
    leads: <KpiTile key="ld" label="Lead" tag={r.tag} value={String(d.nLeads)} delta={deltaPct(d.nLeads, d.nLeadsPrev)} progress={d.leadTarget ? (d.nLeads / d.leadTarget) * 100 : undefined} marker={d.leadTarget ? r.elapsed * 100 : undefined}
      foot={d.leadTarget ? <><b className="text-[rgb(var(--fg))]">{Math.round((d.nLeads / d.leadTarget) * 100)}%</b> chỉ tiêu {Math.round(d.leadTarget)}</> : 'Lead nhận trong kỳ'} status={paceStatus(d.nLeads, d.leadTarget, r.elapsed)} onClick={() => go('leads')} />,
    cycle: <KpiTile key="cy" label="Chu kỳ chốt" tag={r.tag} value={Number.isFinite(d.cycle) ? `${Math.round(d.cycle)} ngày` : '—'} progress={Number.isFinite(d.cycle) ? Math.min(100, (d.cycle / (d.cfg.cycleDays * 1.5)) * 100) : undefined} marker={(1 / 1.5) * 100}
      foot={<>Mục tiêu ≤ {d.cfg.cycleDays} ngày</>} status={!Number.isFinite(d.cycle) ? { label: 'Chưa có dự án chốt', tone: 'muted' } : d.cycle <= d.cfg.cycleDays ? ST_OK : d.cycle <= d.cfg.cycleDays * 1.2 ? ST_WATCH : ST_SLOW} />,
    mdf: <KpiTile key="mdf" label="Quỹ Hãng"  tag={String(new Date(d.now).getFullYear())} value={compact(d.mdfAvail)} deltaText={d.fyElapsed - d.mdfUsedPct > 5 ? `Chậm ${Math.round(d.fyElapsed - d.mdfUsedPct)} điểm` : undefined}
      progress={d.mdfUsedPct} marker={d.fyElapsed} foot={<>Đã dùng <b className="text-[rgb(var(--fg))]">{Math.round(d.mdfUsedPct)}%</b> · thời gian {Math.round(d.fyElapsed)}%</>}
      status={d.fyElapsed - d.mdfUsedPct > 15 ? ST_SLOW : d.fyElapsed - d.mdfUsedPct > 5 ? ST_WATCH : ST_OK} onClick={() => go('claims')} />,
    debt: <KpiTile key="debt" label="Công nợ" tag="Hiện tại" value={compact(d.debt)} foot={d.overLimit.length ? <><b className="text-[rgb(var(--danger-fg))]">{d.overLimit.length}</b> khách vượt hạn mức</> : 'Không khách nào vượt hạn mức'}
      status={d.overLimit.length ? { label: 'Vượt hạn mức', tone: 'red' } : { label: 'Trong hạn mức', tone: 'teal' }} onClick={() => go(role === 'SALES_REP' ? 'customers' : 'reports')} />,
    cash: <KpiTile key="cash" label="Tiền thu" tag={r.tag} value={compact(d.cashNow)} delta={deltaPct(d.cashNow, d.cashPrev)} foot="Phiếu thu trong sổ quỹ" status={d.cashPrev && d.cashNow < d.cashPrev * r.elapsed * 0.85 ? ST_WATCH : ST_OK} onClick={() => go('cashbook')} />,
    reimb: <KpiTile key="reimb" label="Chờ Hãng hoàn" tag="Hiện tại" value={compact(d.pendingReimb)} foot="Claim chưa có credit note" status={d.pendingReimb > d.mdfAvail && d.mdfAvail > 0 ? ST_WATCH : ST_OK} onClick={() => go('claims')} />,
  };
  return tiles;
}

export function DashOverviewTab({ d, setTab }: { d: DashData; setTab: (t: DashTab) => void }) {
  const app = useApp();
  const { go, users, me } = app;
  const T = useKpiTiles(d);
  const { todo } = useApprovalQueue();
  const { alerts } = useInsights();
  const remain = Math.max(0, d.target - d.revenue);
  const projected = d.r.elapsed > 0.05 ? d.revenue / d.r.elapsed : null;
  const risks = slaRisks(d.sl, d.now);
  const weeks = Array.from({ length: 8 }, (_, i) => { const end = d.now - (7 - i) * 7 * 864e5; return d.leadsIn(end - 7 * 864e5, end); });
  const claimsDue = app.claims.filter((c) => !c.submitted && c.daysLeft >= 0 && c.daysLeft <= 14);
  const closing = [...d.open.filter((l) => l.status === 'QUOTED' || l.status === 'ACCEPTED')].sort((a, b) => boqTotal(b) - boqTotal(a)).slice(0, 6);
  const depts = app.departments.filter((x) => x.active && (d.scope.dept === 'ALL' || x.code === d.scope.dept) && (x.receivesLeads || d.targetOf((k) => k.revenue, { dept: x.code }) > 0));
  const deptRev = (code: DeptCode) => d.sl.filter((l) => l.dept === code && l.status === 'WON' && isoMs(l.wonAt) >= d.r.from && isoMs(l.wonAt) < d.r.to).reduce((s, l) => s + (l.wonAmount ?? boqTotal(l)), 0) + d.sj.filter((j) => j.dept === code && j.wonAt && isoMs(j.wonAt) >= d.r.from && isoMs(j.wonAt) < d.r.to).reduce((s, j) => s + (j.contractValue ?? 0), 0);
  const firstTiles = [T.revenue, T.pipeline, T.winRate, T.leads, d.trade ? T.mdf : T.cash, T.debt];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{firstTiles}</div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <DashPanel className="xl:col-span-2" title="Doanh thu & chỉ tiêu" sub="theo tháng" onMore={() => setTab('sales')}>
          <RevenueKpiChart d={d} />
          <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-[rgb(var(--line))] pt-3">
            <div><dt className="text-xs text-[rgb(var(--muted))]">Còn thiếu</dt><dd className="font-display text-lg font-bold tabular-nums">{d.target ? compact(remain) : '—'}</dd></div>
            <div><dt className="text-xs text-[rgb(var(--muted))]">Cần mỗi ngày</dt><dd className="font-display text-lg font-bold tabular-nums">{d.target && d.r.daysLeft ? compact(remain / d.r.daysLeft) : '—'}</dd></div>
            <div><dt className="text-xs text-[rgb(var(--muted))]">Dự báo cuối kỳ</dt><dd className="font-display text-lg font-bold tabular-nums text-[rgb(var(--accent-fg))]">{projected != null ? <>{compact(projected)}{d.target ? ` · ${Math.round((projected / d.target) * 100)}%` : ''}</> : '—'}</dd></div>
          </dl>
        </DashPanel>
        <DashPanel title="Cần duyệt" badge={todo.length} more="Tất cả" onMore={() => go('tasks')} className="border border-[rgb(var(--accent)/0.35)]">
          {todo.length === 0 && alerts.length === 0 ? <EmptyState text={<>Không có việc chờ duyệt</>} hint={<>Yêu cầu duyệt giá, hợp đồng, chi quỹ sẽ hiện ở đây.</>} art="inbox" compact /> : (
            <ul className="divide-y divide-[rgb(var(--line))]">
              {todo.slice(0, 5).map((t) => (
                <li key={t.key} className="flex items-start gap-3 py-2.5 first:pt-0">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', Date.now() - t.requestedAt > t.slaMin * 6e4 ? 'bg-[rgb(var(--danger))]' : 'bg-[rgb(var(--accent))]')} aria-hidden />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.title}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{t.sub}{t.amount ? ` · ${compact(t.amount)}` : ''} · chờ {agoText(t.requestedAt)}</p></div>
                  <button className={cn(btnGhost, btnSm, 'shrink-0')} onClick={() => go('tasks')}>{t.approveLabel ?? 'Xử lý'}</button>
                </li>
              ))}
              {todo.length < 5 && alerts.slice(0, 5 - todo.length).map((a) => (
                <li key={a.id} className="flex items-start gap-3 py-2.5 first:pt-0">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.tone === 'red' ? 'bg-[rgb(var(--danger))]' : 'bg-[rgb(var(--accent))]')} aria-hidden />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.title}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{a.detail}</p></div>
                  {a.go && <button className={cn(btnGhost, btnSm, 'shrink-0')} onClick={() => go(a.go!)}>{a.goLabel ?? 'Xem'}</button>}
                </li>
              ))}
            </ul>
          )}
        </DashPanel>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <DashPanel title="Kinh doanh" onMore={() => setTab('sales')}>
          <FunnelBars steps={salesFunnel(d.sl.filter((l) => leadAt(l) >= d.r.from - 90 * 864e5))} compactView />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[rgb(var(--line))] pt-3 text-sm">
            <div><p className={cn('font-display text-lg font-bold', risks.length ? 'text-[rgb(var(--danger-fg))]' : '')}>{risks.length}</p><p className="text-xs text-[rgb(var(--muted))]">Rủi ro SLA</p></div>
            <div><p className="font-display text-lg font-bold">{Number.isFinite(d.cycle) ? `${Math.round(d.cycle)} ngày` : '—'}</p><p className="text-xs text-[rgb(var(--muted))]">Chu kỳ chốt</p></div>
          </div>
        </DashPanel>
        <DashPanel title="Marketing" onMore={() => setTab('mkt')}>
          <MiniBars data={weeks} labels={weeks.map((_, i) => (i === 7 ? 'Tuần này' : i === 0 ? '8 tuần trước' : ''))} />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[rgb(var(--line))] pt-3 text-sm">
            <div><p className="font-display text-lg font-bold">{d.cpl != null ? compact(d.cpl) : '—'}</p><p className="text-xs text-[rgb(var(--muted))]">Chi phí / lead</p></div>
            <div><p className="font-display text-lg font-bold">{d.sl.filter((l) => l.status === 'NEW' || l.status === 'NURTURE').length}</p><p className="text-xs text-[rgb(var(--muted))]">Chờ phân bổ</p></div>
          </div>
        </DashPanel>
        <DashPanel title="Tài chính" onMore={() => setTab('fin')}>
          {d.trade ? (
            <div className="flex items-center gap-4">
              <DashGauge pct={d.mdfUsedPct} mark={d.fyElapsed} />
              <div><p className="font-display text-2xl font-bold tabular-nums">{compact(d.mdfAvail)}</p><p className="text-xs text-[rgb(var(--muted))]">Quỹ Hãng còn lại · đã dùng {Math.round(d.mdfUsedPct)}%</p></div>
            </div>
          ) : <div><p className="font-display text-2xl font-bold tabular-nums">{compact(d.cashNow)}</p><p className="text-xs text-[rgb(var(--muted))]">Tiền thu {d.r.label.toLowerCase()}</p></div>}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[rgb(var(--line))] pt-3 text-sm">
            <div><p className={cn('font-display text-lg font-bold', claimsDue.length ? 'text-[rgb(var(--accent-fg))]' : '')}>{claimsDue.length} · {compact(claimsDue.reduce((s, c) => s + c.claimed, 0))}</p><p className="text-xs text-[rgb(var(--muted))]">Claim hạn ≤ 14 ngày</p></div>
            <div><p className={cn('font-display text-lg font-bold', d.overLimit.length ? 'text-[rgb(var(--danger-fg))]' : '')}>{d.overLimit.length}</p><p className="text-xs text-[rgb(var(--muted))]">Khách vượt hạn mức</p></div>
          </div>
        </DashPanel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <DashPanel className="xl:col-span-2" title={d.scope.userId ? 'Chỉ tiêu của tôi' : 'Doanh số phòng ban'} sub="vạch đen = chỉ tiêu · vạch đứt = kỳ vọng" more="Báo cáo" onMore={() => go('reports')}>
          {d.scope.userId ? <TargetBar label={me.name} value={d.revenue} target={d.target} expected={d.r.elapsed} /> : depts.length ? (
            <div className="space-y-3">{(() => { const sc = Math.max(0, ...depts.map((x) => Math.max(deptRev(x.code), d.targetOf((k) => k.revenue, { dept: x.code })))); return depts.map((x) => <TargetBar key={x.code} label={x.short || x.name} value={deptRev(x.code)} target={d.targetOf((k) => k.revenue, { dept: x.code })} expected={d.r.elapsed} scale={sc} />); })()}</div>
          ) : <EmptyState text={<>Chưa có phòng kinh doanh</>} hint={<>Khai báo phòng ban ở Cài đặt.</>} compact />}
        </DashPanel>
        <DashPanel className="xl:col-span-3" title="Sắp chốt" more="Dự án" onMore={() => go('projects')}>
          {closing.length ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="text-left text-xs text-[rgb(var(--muted))]"><th className="px-5 pb-2 font-medium">Dự án</th><th className="px-3 pb-2 font-medium">Phụ trách</th><th className="px-3 pb-2 text-right font-medium">Giá trị</th><th className="px-5 pb-2 text-right font-medium">Giai đoạn</th></tr></thead>
                <tbody>{closing.map((l) => (
                  <tr key={l.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => go('projects', l.code)}>
                    <td className="max-w-[240px] truncate px-5 py-2.5 font-medium">{l.boqNote || l.company}<span className="block truncate text-xs font-normal text-[rgb(var(--muted))]">{l.company}</span></td>
                    <td className="px-3 py-2.5">{users.find((u) => u.id === l.assignee)?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right font-num tabular-nums">{compact(boqTotal(l))}</td>
                    <td className="px-5 py-2.5 text-right"><Chip tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Chip></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState text={<>Chưa có dự án đang chào giá</>} hint={<>Dự án đã nhận việc hoặc đã báo giá sẽ hiện ở đây.</>} art="doc" compact />}
        </DashPanel>
      </div>
    </div>
  );
}

/** Cột nhỏ (lead theo tuần): cột cuối tô màu nhấn */
export function MiniBars({ data, labels }: { data: number[]; labels?: string[] }) {
  const max = Math.max(1, ...data);
  return (
    <div>
      <div className="flex h-20 items-end gap-1.5" role="img" aria-label={`Lead theo tuần: ${data.join(', ')}`}>
        {data.map((v, i) => <div key={i} className="flex-1 rounded-t-sm" title={String(v)} style={{ height: `${Math.max(4, (v / max) * 100)}%`, background: i === data.length - 1 ? 'rgb(var(--accent))' : 'rgb(var(--ink) / 0.14)' }} />)}
      </div>
      {labels && <div className="mt-1 flex justify-between text-[10px] text-[rgb(var(--faint))]"><span>{labels[0]}</span><span>{labels[labels.length - 1]}</span></div>}
    </div>
  );
}

/** Đồng hồ nửa vòng: % đã dùng + vạch % thời gian */
export function DashGauge({ pct: p, mark }: { pct: number; mark?: number }) {
  const R = 34, C2 = Math.PI * R;
  const v = Math.min(100, Math.max(0, p));
  const ang = (a: number) => Math.PI * (1 - a / 100);
  return (
    <svg viewBox="0 0 84 50" className="h-[54px] w-[90px] shrink-0" role="img" aria-label={`Đã dùng ${Math.round(v)}%`}>
      <path d={`M 8 44 A ${R} ${R} 0 0 1 76 44`} fill="none" stroke="rgb(var(--line))" strokeWidth="8" strokeLinecap="round" />
      <path d={`M 8 44 A ${R} ${R} 0 0 1 76 44`} fill="none" stroke="rgb(var(--accent))" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(v / 100) * C2} ${C2}`} />
      {mark !== undefined && <line x1={42 + (R - 7) * Math.cos(ang(mark))} y1={44 - (R - 7) * Math.sin(ang(mark))} x2={42 + (R + 7) * Math.cos(ang(mark))} y2={44 - (R + 7) * Math.sin(ang(mark))} stroke="rgb(var(--fg))" strokeWidth="2" />}
      <text x="42" y="45" textAnchor="middle" fontSize="13" fontWeight="700" fill="rgb(var(--fg))">{Math.round(v)}%</text>
    </svg>
  );
}

export function DashSalesTab({ d }: { d: DashData }) {
  const app = useApp();
  const { departments, users, role, me, go, myCustomers } = app;
  const T = useKpiTiles(d);
  const inR = (t: number) => t >= d.r.from && t < d.r.to;
  const risks = slaRisks(d.sl, d.now).slice(0, 5);
  const lostR = d.sl.filter((l) => l.status === 'LOST' && inR(leadAt(l)));
  const reasons = (Object.keys(LOST_REASON) as LostReason[]).map((k): { k: LostReason | 'OTHER'; n: number } => ({ k, n: lostR.filter((l) => l.lostReason === k).length })).concat([{ k: 'OTHER', n: lostR.filter((l) => !l.lostReason).length }]).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const depts = departments.filter((x) => x.active && x.receivesLeads && (d.scope.dept === 'ALL' || x.code === d.scope.dept));
  const deptRow = (code: DeptCode) => {
    const ls = d.sl.filter((l) => l.dept === code);
    const w = ls.filter((l) => l.status === 'WON' && inR(isoMs(l.wonAt)));
    const lo = ls.filter((l) => l.status === 'LOST' && inR(leadAt(l))).length;
    return { rev: w.reduce((s, l) => s + (l.wonAmount ?? boqTotal(l)), 0), won: w.length, lost: lo, target: d.targetOf((k) => k.revenue, { dept: code }) };
  };
  const staff = role === 'SALES_REP' ? users.filter((u) => u.id === me.id) : users.filter((u) => u.active && u.dept && (d.scope.dept === 'ALL' ? true : u.dept === d.scope.dept) && ['SALES_REP', 'DEPT_HEAD'].includes(u.role));
  const staffRow = (u: User) => {
    const ls = d.sl.filter((l) => l.assignee === u.id);
    const rev = ls.filter((l) => l.status === 'WON' && inR(isoMs(l.wonAt))).reduce((s, l) => s + (l.wonAmount ?? boqTotal(l)), 0);
    return { rev, open: ls.filter((l) => !['WON', 'LOST'].includes(l.status)).length, target: d.targetOf((k) => k.revenue, { dept: 'ALL', userId: u.id }) };
  };
  const top = [...myCustomers].filter((c) => inScope(d.scope, c.dept, c.amId)).sort((a, b) => b.ytdRevenue - a.ytdRevenue).slice(0, 5);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[T.revenue, T.pipeline, T.winRate, T.cycle]}</div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DashPanel title="Phễu bán hàng" sub="lead nhận 90 ngày gần nhất" more="Dự án" onMore={() => go('projects')}>
          <FunnelBars steps={salesFunnel(d.sl.filter((l) => leadAt(l) >= d.now - 90 * 864e5))} />
        </DashPanel>
        <DashPanel title="Lý do trượt" sub={`${lostR.length} dự án · ${d.r.label.toLowerCase()}`}>
          {reasons.length ? <div className="space-y-2">{reasons.map((x) => <TargetBar key={x.k} label={x.k === 'OTHER' ? 'Khác' : LOST_REASON[x.k as LostReason]} value={x.n} target={0} expected={0} scale={reasons[0]?.n} right={<>{x.n} · {Math.round((x.n / lostR.length) * 100)}%</>} />)}</div>
            : <EmptyState text={<>Không có dự án trượt trong kỳ</>} compact />}
        </DashPanel>
      </div>
      {role !== 'SALES_REP' && (
        <DashPanel title="Doanh số phòng ban" sub={d.r.label} more="Báo cáo" onMore={() => go('reports')}>
          <Table head={['Phòng', <span key="t" className="block text-right">Chỉ tiêu</span>, <span key="a" className="block text-right">Thực tế</span>, <span key="p" className="block text-right">% đạt</span>, <span key="w" className="block text-right">Thắng</span>, <span key="l" className="block text-right">Trượt</span>, <span key="r" className="block text-right">Tỷ lệ chốt</span>]} minW={640} stt={false}>
            {depts.map((x) => { const r = deptRow(x.code); const st = paceStatus(r.rev, r.target, d.r.elapsed); return (
              <tr key={x.code} className={rowCls}>
                <td className={tdFirst}>{x.name}</td>
                <td className={cn(tdCls, 'text-right font-num tabular-nums')}>{r.target ? compact(r.target) : <span className="text-[rgb(var(--faint))]">—</span>}</td>
                <td className={cn(tdCls, 'text-right font-num tabular-nums')}>{compact(r.rev)}</td>
                <td className={cn(tdCls, 'text-right')}>{r.target ? <Chip tone={st.tone === 'muted' ? 'muted' : st.tone}>{Math.round((r.rev / r.target) * 100)}%</Chip> : '—'}</td>
                <td className={cn(tdCls, 'text-right tabular-nums')}>{r.won}</td>
                <td className={cn(tdCls, 'text-right tabular-nums')}>{r.lost}</td>
                <td className={cn(tdLast, 'text-right tabular-nums')}>{r.won + r.lost ? `${Math.round((r.won / (r.won + r.lost)) * 100)}%` : '—'}</td>
              </tr>
            ); })}
          </Table>
        </DashPanel>
      )}
      <DashPanel title={role === 'SALES_REP' ? 'Chỉ tiêu của tôi' : 'Chỉ tiêu nhân viên'} sub={`${d.r.label} · do Trưởng phòng nhập`}>
        {staff.length ? (
          <Table head={['Nhân viên', 'Phòng', <span key="t" className="block text-right">Chỉ tiêu</span>, <span key="a" className="block text-right">Thực tế</span>, 'Tiến độ', <span key="o" className="block text-right">Đang mở</span>]} minW={680} stt={false}>
            {staff.map((u) => { const r = staffRow(u); const st = paceStatus(r.rev, r.target, d.r.elapsed); return (
              <tr key={u.id} className={rowCls}>
                <td className={tdFirst}>{u.name}<span className="block text-xs text-[rgb(var(--muted))]">{ROLE_LABEL[u.role]}</span></td>
                <td className={tdCls}>{departments.find((x) => x.code === u.dept)?.short ?? '—'}</td>
                <td className={cn(tdCls, 'text-right font-num tabular-nums')}>{r.target ? compact(r.target) : <span className="text-[rgb(var(--faint))]">Chưa giao</span>}</td>
                <td className={cn(tdCls, 'text-right font-num tabular-nums')}>{compact(r.rev)}</td>
                <td className={cn(tdCls, 'w-48')}>{r.target ? <div className="flex items-center gap-2"><div className="h-1.5 flex-1 rounded-full bg-[rgb(var(--line))]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (r.rev / r.target) * 100)}%`, background: `rgb(${TONE_RGB[st.tone]})` }} /></div><span className="w-10 text-right text-xs tabular-nums">{Math.round((r.rev / r.target) * 100)}%</span></div> : '—'}</td>
                <td className={cn(tdLast, 'text-right tabular-nums')}>{r.open}</td>
              </tr>
            ); })}
          </Table>
        ) : <EmptyState text={<>Chưa có nhân viên kinh doanh trong phạm vi</>} compact />}
      </DashPanel>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DashPanel title="Rủi ro SLA" badge={risks.length} more="Phân lead" onMore={() => go('leads')}>
          {risks.length ? <ul className="divide-y divide-[rgb(var(--line))]">{risks.map((x) => (
            <li key={x.lead.id} className="flex items-start gap-3 py-2.5 first:pt-0"><span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', x.score >= 60 ? 'bg-[rgb(var(--danger))]' : 'bg-[rgb(var(--accent))]')} aria-hidden />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{x.lead.company}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{x.reasons.join(' · ')}</p></div>
              <span className="shrink-0 text-xs text-[rgb(var(--muted))]">{departments.find((z) => z.code === x.lead.dept)?.short ?? ''}</span></li>
          ))}</ul> : <EmptyState text={<>Không có dự án nguy cơ trễ SLA</>} compact />}
        </DashPanel>
        <DashPanel title="Khách doanh số cao" sub={`năm ${new Date(d.now).getFullYear()}`} more="Khách hàng" onMore={() => go('customers')}>
          {top.length ? <ul className="divide-y divide-[rgb(var(--line))]">{top.map((c) => { const g = deltaPct(c.ytdRevenue, c.lastYearRevenue); return (
            <li key={c.id} className="flex items-center gap-3 py-2 first:pt-0"><button className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline" onClick={() => app.openCustomer(c.id)}>{c.name}</button><span className="text-xs text-[rgb(var(--muted))]">{c.tier}</span>
              <span className="w-20 text-right font-num text-sm tabular-nums">{compact(c.ytdRevenue)}</span>
              <span className={cn('w-14 text-right text-xs tabular-nums', g == null ? 'text-[rgb(var(--faint))]' : g >= 0 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>{g == null ? 'Mới' : `${g >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(g))}%`}</span></li>
          ); })}</ul> : <EmptyState text={<>Chưa có doanh số khách hàng</>} compact />}
        </DashPanel>
      </div>
    </div>
  );
}

export function DashMktTab({ d }: { d: DashData }) {
  const app = useApp();
  const { departments, go, myCustomers } = app;
  const T = useKpiTiles(d);
  const inR = (l: Lead) => leadAt(l) >= d.r.from && leadAt(l) < d.r.to;
  const ls = d.sl.filter(inR);
  const mql = ls.filter((l) => (l.score ?? scoreLead(l, myCustomers)) >= MQL_THRESHOLD).length;
  const sql = ls.filter((l) => !['NEW', 'NURTURE'].includes(l.status)).length;
  const mqlPrev = (() => { const p = d.sl.filter((l) => leadAt(l) >= d.r.prevFrom && leadAt(l) < d.r.prevTo); return p.length ? (p.filter((l) => (l.score ?? scoreLead(l, myCustomers)) >= MQL_THRESHOLD).length / p.length) * 100 : null; })();
  const mqlRate = ls.length ? (mql / ls.length) * 100 : null;
  const year = new Date(d.now).getFullYear();
  const yc = app.campaigns.filter((c) => c.start.startsWith(String(year)) || c.end.startsWith(String(year)));
  const ys = yc.map((c) => campaignStats(c, app.leads, app.jobs));
  const ySpent = yc.reduce((s, c) => s + c.spent, 0), yRev = ys.reduce((s, x) => s + x.revenue, 0);
  const roi = ySpent ? yRev / ySpent : null;
  // Lead theo tuần, theo kênh
  const weeks = Array.from({ length: 8 }, (_, i) => { const end = d.now - (7 - i) * 7 * 864e5; return { from: end - 7 * 864e5, to: end }; });
  const chans = [...new Set(d.sl.map((l) => channelOfSource(l.source)))].slice(0, 5);
  const chColor = (ch: MktChannel | 'OTHER') => (ch === 'OTHER' ? '#94A3B8' : MKT_CH[ch].color);
  const series = weeks.map((w) => chans.map((ch) => d.sl.filter((l) => channelOfSource(l.source) === ch && leadAt(l) >= w.from && leadAt(l) < w.to).length));
  const wmax = Math.max(1, ...series.map((s) => s.reduce((a, b) => a + b, 0)));
  // Hiệu quả theo kênh (chi phí chiến dịch chia đều cho các kênh của chiến dịch)
  const byCh = new Map<MktChannel, { cost: number; leads: number; won: number; rev: number }>();
  d.campStats.forEach(({ c, s }) => c.channels.forEach((ch) => { const v = byCh.get(ch) ?? { cost: 0, leads: 0, won: 0, rev: 0 }; const k = c.channels.length || 1; byCh.set(ch, { cost: v.cost + c.spent / k, leads: v.leads + s.leads / k, won: v.won + s.won / k, rev: v.rev + s.revenue / k }); }));
  const chRows = [...byCh.entries()].sort((a, b) => b[1].rev - a[1].rev);
  const slaDepts = departments.filter((x) => x.active && x.receivesLeads).map((x) => { const done = d.sl.filter((l) => l.dept === x.code && l.slaMet !== undefined && inR(l)); return { x, met: done.filter((l) => l.slaMet).length, n: done.length }; }).filter((r) => r.n > 0);
  const slaAll = slaDepts.reduce((s, r) => s + r.met, 0), slaN = slaDepts.reduce((s, r) => s + r.n, 0);
  const inbox = d.sl.filter((l) => l.status === 'NEW' || l.status === 'NURTURE').sort((a, b) => leadAt(a) - leadAt(b)).slice(0, 5);
  const running = app.campaigns.filter((c) => c.status === 'RUNNING');
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {T.leads}
        <KpiTile label="Tỷ lệ MQL" tag={d.r.tag} value={mqlRate == null ? '—' : `${Math.round(mqlRate)} %`} delta={mqlRate != null && mqlPrev != null ? mqlRate - mqlPrev : null} deltaPts foot={<>{mql}/{ls.length} lead đạt ≥ {MQL_THRESHOLD} điểm</>} status={mqlRate == null ? { label: 'Chưa có lead', tone: 'muted' } : mqlRate >= 50 ? ST_OK : ST_WATCH} onClick={() => go('leads')} />
        <KpiTile label="Chi phí / lead" tag={d.r.tag} value={d.cpl != null ? compact(d.cpl) : '—'} progress={d.cpl != null ? Math.min(100, (d.cpl / d.cfg.cplMax) * 100) : undefined} marker={d.cpl != null ? 100 * (1 / 1) : undefined} foot={<>Trần {compact(d.cfg.cplMax)} · {Math.round(d.campLeads)} lead chiến dịch</>} status={d.cpl == null ? { label: 'Chưa có chiến dịch', tone: 'muted' } : d.cpl <= d.cfg.cplMax ? ST_OK : ST_SLOW} onClick={() => go('marketing')} />
        <KpiTile label="ROI" tag={String(year)} value={roi != null ? `${roi.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} lần` : '—'} foot={<>Doanh thu {compact(yRev)} / chi {compact(ySpent)}</>} status={roi == null ? { label: 'Chưa có chi phí', tone: 'muted' } : roi >= 1 ? ST_OK : ST_SLOW} onClick={() => go('marketing')} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <DashPanel className="xl:col-span-3" title="Lead theo tuần" sub="theo kênh nguồn" more="Phân lead" onMore={() => go('leads')}>
          <div className="mb-2 flex flex-wrap gap-3 text-xs text-[rgb(var(--muted))]">{chans.map((ch) => <span key={ch} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: chColor(ch) }} />{ch === 'OTHER' ? 'Khác' : MKT_CH[ch].label}</span>)}</div>
          <div className="flex h-40 items-end gap-2" role="img" aria-label="Lead theo tuần theo kênh">
            {series.map((s, i) => (
              <div key={i} className="flex flex-1 flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${(s.reduce((a, b) => a + b, 0) / wmax) * 100}%` }} title={`${s.reduce((a, b) => a + b, 0)} lead`}>
                {s.map((n, k) => n > 0 && <div key={k} style={{ flexGrow: n, background: chColor(chans[k]) }} />)}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[rgb(var(--faint))]"><span>8 tuần trước</span><span>Tuần này</span></div>
        </DashPanel>
        <DashPanel className="xl:col-span-2" title="Phễu data MKT" sub={d.r.label}>
          <FunnelBars steps={[{ label: 'Lead', n: ls.length }, { label: 'MQL', n: mql }, { label: 'SQL', n: sql }, { label: 'Báo giá', n: ls.filter((l) => l.status === 'QUOTED' || l.status === 'WON').length }, { label: 'Chốt', n: ls.filter((l) => l.status === 'WON').length }]} />
        </DashPanel>
      </div>
      <DashPanel title="Hiệu quả theo kênh" sub="chiến dịch chạy trong kỳ" more="Chiến dịch" onMore={() => go('marketing')}>
        {chRows.length ? (
          <Table head={['Kênh', <span key="c" className="block text-right">Chi phí</span>, <span key="l" className="block text-right">Lead</span>, <span key="p" className="block text-right">CPL</span>, <span key="w" className="block text-right">Chốt</span>, <span key="r" className="block text-right">Doanh thu</span>, <span key="o" className="block text-right">ROI</span>]} minW={680} stt={false}>
            {chRows.map(([ch, v]) => (
              <tr key={ch} className={rowCls}>
                <td className={tdFirst}><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: MKT_CH[ch].color }} />{MKT_CH[ch].label}</span></td>
                <td className={cn(tdCls, 'text-right font-num tabular-nums')}>{compact(v.cost)}</td>
                <td className={cn(tdCls, 'text-right tabular-nums')}>{Math.round(v.leads)}</td>
                <td className={cn(tdCls, 'text-right font-num tabular-nums', v.leads && v.cost / v.leads > d.cfg.cplMax ? 'text-[rgb(var(--danger-fg))]' : '')}>{v.leads ? compact(v.cost / v.leads) : '—'}</td>
                <td className={cn(tdCls, 'text-right tabular-nums')}>{Math.round(v.won)}</td>
                <td className={cn(tdCls, 'text-right font-num tabular-nums')}>{compact(v.rev)}</td>
                <td className={cn(tdLast, 'text-right tabular-nums')}>{v.cost ? `${(v.rev / v.cost).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} lần` : '—'}</td>
              </tr>
            ))}
          </Table>
        ) : <EmptyState text={<>Chưa có chiến dịch trong kỳ</>} hint={<>Tạo chiến dịch ở Marketing Hub để đo chi phí và ROI theo kênh.</>} art="calendar" compact />}
      </DashPanel>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <DashPanel title="SLA tiếp nhận" sub={slaN ? `${Math.round((slaAll / slaN) * 100)}% đúng hạn` : 'chưa có lead tiếp nhận'}>
          {slaDepts.length ? <div className="space-y-2">{slaDepts.map((r) => <TargetBar key={r.x.code} label={r.x.short || r.x.name} value={r.met} target={0} expected={0} scale={Math.max(...slaDepts.map((z) => z.n))} right={<span className={r.met / r.n < 0.8 ? 'text-[rgb(var(--danger-fg))]' : ''}>{Math.round((r.met / r.n) * 100)}% · {r.met}/{r.n}</span>} />)}</div> : <EmptyState text={<>Chưa có lead đã tiếp nhận</>} compact />}
        </DashPanel>
        <DashPanel title="Chờ phân bổ" badge={inbox.length} more="Phân lead" onMore={() => go('leads')}>
          {inbox.length ? <ul className="divide-y divide-[rgb(var(--line))]">{inbox.map((l) => { const h = (d.now - leadAt(l)) / 3.6e6; return (
            <li key={l.id} className="flex items-center gap-3 py-2 first:pt-0"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{l.company}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{SOURCE_LABEL[l.source]}</p></div><span className={cn('shrink-0 text-xs tabular-nums', h > 24 ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')}>{h < 24 ? `${Math.max(1, Math.round(h))} giờ` : `${Math.round(h / 24)} ngày`}</span></li>
          ); })}</ul> : <EmptyState text={<>Không còn lead chờ phân bổ</>} compact />}
        </DashPanel>
        <DashPanel title="Chiến dịch đang chạy" sub="ngân sách đã dùng" more="Chiến dịch" onMore={() => go('marketing')}>
          {running.length ? <div className="space-y-3">{running.slice(0, 5).map((c) => <div key={c.id}><div className="mb-1 flex justify-between gap-2 text-sm"><span className="truncate">{c.name}</span><span className="shrink-0 font-num text-xs tabular-nums text-[rgb(var(--muted))]">{compact(c.spent)} / {compact(c.budget)}</span></div><ProgressBar value={c.spent} max={c.budget || 1} /></div>)}</div> : <EmptyState text={<>Không có chiến dịch đang chạy</>} compact />}
        </DashPanel>
      </div>
    </div>
  );
}

export function DashFinTab({ d }: { d: DashData }) {
  const app = useApp();
  const { go, cashEntries, budget, programs, claims, myCustomers } = app;
  const T = useKpiTiles(d);
  const f = mdfForecast(budget, programs, claims, d.now);
  const due = claims.filter((c) => !c.submitted && c.daysLeft >= 0 && c.daysLeft <= 14).sort((a, b) => a.daysLeft - b.daysLeft);
  const overdue = claims.filter((c) => !c.submitted && c.daysLeft < 0).length;
  const months = Array.from({ length: 6 }, (_, i) => { const m = new Date(new Date(d.now).getFullYear(), new Date(d.now).getMonth() - 5 + i, 1); return { label: `T${m.getMonth() + 1}`, from: m.getTime(), to: new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime() }; });
  const flows = months.map((m) => ({ ...m, inn: cashEntries.filter((e) => e.kind === 'IN' && isoMs(e.date) >= m.from && isoMs(e.date) < m.to).reduce((s, e) => s + e.amount, 0), out: cashEntries.filter((e) => e.kind === 'OUT' && isoMs(e.date) >= m.from && isoMs(e.date) < m.to).reduce((s, e) => s + e.amount, 0) }));
  const fmax = Math.max(1, ...flows.map((x) => Math.max(x.inn, x.out)));
  const net = flows.reduce((s, x) => s + x.inn - x.out, 0);
  const over = myCustomers.filter((c) => inScope(d.scope, c.dept, c.amId) && c.creditLimit > 0 && c.debt > c.creditLimit).sort((a, b) => b.debt - b.creditLimit - (a.debt - a.creditLimit));
  const roiByType = [...new Set(programs.map((p) => p.type))].map((t) => { const ps = programs.filter((p) => p.type === t && p.held > 0); return { t, spent: ps.reduce((s, p) => s + p.held, 0), n: ps.length }; }).filter((x) => x.spent > 0).sort((a, b) => b.spent - a.spent);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{d.trade ? [T.mdf, T.reimb, T.cash, T.debt] : [T.cash, T.debt, T.revenue, T.pipeline]}</div>
      {d.trade && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <DashPanel className="xl:col-span-3" title="Dòng tiền quỹ Hãng" sub="6 tháng tới · chi ra và Hãng hoàn về" more="Hồ sơ MDF" onMore={() => go('claims')}>
            <div className="space-y-2">{f.rows.map((r) => <div key={r.key} className="grid grid-cols-[48px_1fr_1fr_90px] items-center gap-2 text-xs">
              <span className="text-[rgb(var(--muted))]">{r.label}</span>
              <div className="flex h-3 justify-end rounded-sm bg-[rgb(var(--ink)/0.04)]"><div className="h-full rounded-sm bg-[rgb(var(--danger)/0.7)]" style={{ width: `${(r.out / Math.max(1, ...f.rows.map((x) => Math.max(x.out, x.inflow)))) * 100}%` }} title={`Chi ${compact(r.out)}`} /></div>
              <div className="h-3 rounded-sm bg-[rgb(var(--ink)/0.04)]"><div className="h-full rounded-sm bg-[rgb(var(--success)/0.75)]" style={{ width: `${(r.inflow / Math.max(1, ...f.rows.map((x) => Math.max(x.out, x.inflow)))) * 100}%` }} title={`Hoàn ${compact(r.inflow)}`} /></div>
              <span className={cn('text-right font-num tabular-nums', r.balanceEnd < 0 ? 'text-[rgb(var(--danger-fg))]' : '')}>{compact(r.balanceEnd)}</span>
            </div>)}</div>
            <div className="mt-2 grid grid-cols-[48px_1fr_1fr_90px] gap-2 text-[10px] text-[rgb(var(--faint))]"><span /><span className="text-right">Chi ra</span><span>Hãng hoàn</span><span className="text-right">Quỹ khả dụng</span></div>
          </DashPanel>
          <DashPanel className="xl:col-span-2" title="Claim sắp hạn" badge={due.length} more="Hồ sơ MDF" onMore={() => go('claims')}>
            {due.length ? <ul className="divide-y divide-[rgb(var(--line))]">{due.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2 first:pt-0"><button className="min-w-0 flex-1 text-left" onClick={() => app.openClaim(c.id)}><p className="truncate text-sm font-medium">{c.programTitle}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{c.code} · {compact(c.claimed)} · {claimState(c, app.policy.rules).label}</p></button><Chip tone={c.daysLeft <= 7 ? 'red' : 'orange'}>{c.daysLeft} ngày</Chip></li>
            ))}</ul> : <EmptyState text={<>Không có claim đến hạn trong 14 ngày</>} compact />}
            <p className={cn('mt-3 text-xs', overdue ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--success-fg))]')}>{overdue ? `${overdue} claim đã quá hạn nộp` : '✓ Không claim quá hạn'}</p>
          </DashPanel>
        </div>
      )}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <DashPanel title="Thu chi 6 tháng" sub={`ròng ${net >= 0 ? '+' : ''}${compact(net)}`} more="Thu chi" onMore={() => go('cashbook')}>
          {flows.some((x) => x.inn || x.out) ? (
            <>
              <div className="flex h-40 items-end gap-3" role="img" aria-label="Thu và chi theo tháng">
                {flows.map((x) => <div key={x.label} className="flex flex-1 items-end justify-center gap-1" style={{ height: '100%' }}>
                  <div className="w-1/3 rounded-t-sm bg-[rgb(var(--success))]" style={{ height: `${Math.max(2, (x.inn / fmax) * 100)}%` }} title={`Thu ${compact(x.inn)}`} />
                  <div className="w-1/3 rounded-t-sm bg-[rgb(var(--danger)/0.75)]" style={{ height: `${Math.max(2, (x.out / fmax) * 100)}%` }} title={`Chi ${compact(x.out)}`} />
                </div>)}
              </div>
              <div className="mt-1 flex gap-3 text-[10px] text-[rgb(var(--faint))]">{flows.map((x) => <span key={x.label} className="flex-1 text-center">{x.label}</span>)}</div>
            </>
          ) : <EmptyState text={<>Chưa có phiếu thu chi</>} hint={<>Ghi thu chi ở mục Thu chi để theo dõi dòng tiền.</>} art="ledger" compact />}
        </DashPanel>
        <DashPanel title="Vượt hạn mức" badge={over.length} more="Khách hàng" onMore={() => go('customers')}>
          {over.length ? (
            <Table head={['Khách', <span key="d" className="block text-right">Nợ</span>, <span key="h" className="block text-right">Hạn mức</span>, <span key="v" className="block text-right">Vượt</span>]} minW={420} stt={false}>
              {over.slice(0, 6).map((c) => <tr key={c.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => app.openCustomer(c.id)}><td className={tdFirst}>{c.name}</td><td className={cn(tdCls, 'text-right font-num tabular-nums')}>{compact(c.debt)}</td><td className={cn(tdCls, 'text-right font-num tabular-nums')}>{compact(c.creditLimit)}</td><td className={cn(tdLast, 'text-right font-num tabular-nums text-[rgb(var(--danger-fg))]')}>{compact(c.debt - c.creditLimit)}</td></tr>)}
            </Table>
          ) : <EmptyState text={<>Không khách nào vượt hạn mức</>} compact />}
        </DashPanel>
      </div>
      {d.trade && roiByType.length > 0 && (
        <DashPanel title="Chi quỹ theo loại chương trình" sub="đã giữ / đã chi" more="Chương trình" onMore={() => go('claims')}>
          <div className="space-y-2">{roiByType.map((x) => <TargetBar key={x.t} label={PROGRAM_LABEL[x.t] ?? x.t} value={x.spent} target={0} expected={0} scale={roiByType[0]?.spent} right={<>{compact(x.spent)} · {x.n} CT</>} />)}</div>
        </DashPanel>
      )}
    </div>
  );
}

/**
 * Nhập chỉ tiêu tháng (ngăn bên phải, không chồng popup):
 *  - Giám đốc: chỉ tiêu phòng ban (doanh thu, lead, số dự án chốt) và ngưỡng đánh giá.
 *  - Trưởng phòng: chỉ tiêu từng nhân viên phòng mình. Giám đốc xem và sửa được khi phòng chưa có trưởng phòng.
 *  - Nhân viên: xem chỉ tiêu của mình.
 * Máy chủ kiểm lại quyền theo id bản ghi (supabase-v37.sql).
 */
export function KpiTargetSheet({ onClose }: { onClose: () => void }) {
  const { kpiTargets, setKpiTargets, departments, users, role, me, notify, audit, company } = useApp();
  const [month, setMonth] = useState(() => kpiMonthKey(Date.now()));
  const isBod = role === 'BOD';
  const canDept = isBod;
  const canUser = (u: User) => isBod || (role === 'DEPT_HEAD' && !!me.dept && u.dept === me.dept && u.id !== me.id);
  const get = (scope: 'DEPT' | 'USER', refId: string, m = month) => kpiTargets.find((k) => k.id === kpiId(scope, refId, m));
  const [draft, setDraft] = useState<Record<string, KpiTarget>>({});
  const [cfg, setCfg] = useState<KpiCfg>(() => kpiTargets.find((k) => k.scope === 'CFG')?.cfg ?? KPI_CFG_DEFAULT);
  const val = (scope: 'DEPT' | 'USER', refId: string): KpiTarget => draft[kpiId(scope, refId, month)] ?? get(scope, refId) ?? { id: kpiId(scope, refId, month), scope, refId, month, revenue: 0 };
  const edit = (scope: 'DEPT' | 'USER', refId: string, patch: Partial<KpiTarget>) => { const v = { ...val(scope, refId), ...patch }; setDraft((p) => ({ ...p, [v.id]: v })); };
  const depts = departments.filter((x) => x.active);
  const visibleDepts = isBod || role === 'ACCOUNTANT' || role === 'MKT_LEAD' ? depts : depts.filter((x) => x.code === me.dept);
  const staffOf = (code: DeptCode) => users.filter((u) => u.active && u.dept === code && (role !== 'SALES_REP' || u.id === me.id) && u.role !== 'BOD');
  const prevMonth = (() => { const [y, mm] = month.split('-').map(Number); return kpiMonthKey(new Date(y, mm - 2, 1).getTime()); })();
  const copyPrev = () => {
    const rows = kpiTargets.filter((k) => k.month === prevMonth && ((k.scope === 'DEPT' && canDept) || (k.scope === 'USER' && canUser(users.find((u) => u.id === k.refId) ?? me))));
    if (!rows.length) return notify('Tháng trước chưa có chỉ tiêu để sao chép', 'orange');
    setDraft((p) => ({ ...p, ...Object.fromEntries(rows.map((k) => { const v = { ...k, id: kpiId(k.scope, k.refId, month), month }; return [v.id, v]; })) }));
    notify(`Đã chép ${rows.length} chỉ tiêu từ tháng trước, bấm Lưu để áp dụng`, 'teal');
  };
  const dirty = Object.keys(draft).length > 0 || (isBod && JSON.stringify(cfg) !== JSON.stringify(kpiTargets.find((k) => k.scope === 'CFG')?.cfg ?? KPI_CFG_DEFAULT));
  const save = () => {
    // Kiểm quyền phía giao diện (máy chủ kiểm lại bằng RLS)
    const rows = Object.values(draft).filter((k) => (k.scope === 'DEPT' ? canDept : canUser(users.find((u) => u.id === k.refId) ?? me)));
    const stamp = { by: me.id, at: Date.now() };
    const cfgRow: KpiTarget[] = isBod ? [{ id: kpiId('CFG', 'company', '*'), scope: 'CFG', refId: 'company', month: '*', revenue: 0, cfg, ...stamp }] : [];
    const all = [...rows.map((k) => ({ ...k, ...stamp })), ...cfgRow];
    setKpiTargets((p) => [...p.filter((k) => !all.some((x) => x.id === k.id)), ...all]);
    audit('KPI_TARGET', `Cập nhật ${rows.length} chỉ tiêu tháng ${month.split('-').reverse().join('/')}${cfgRow.length ? ' và ngưỡng đánh giá' : ''}`);
    notify('Đã lưu chỉ tiêu', 'teal');
    setDraft({});
  };
  const sumStaff = (code: DeptCode) => staffOf(code).reduce((s, u) => s + val('USER', u.id).revenue, 0);
  return (
    <SideSheet title="Chỉ tiêu KPI" sub={`${company.shortName || company.appName} · ${isBod ? 'Giám đốc giao chỉ tiêu phòng ban' : role === 'DEPT_HEAD' ? 'Trưởng phòng giao chỉ tiêu nhân viên' : 'Chế độ xem'}`} onClose={onClose} width="sm:w-[640px]"
      footer={<><button className={btnGhost} onClick={onClose}>Đóng</button>{(isBod || role === 'DEPT_HEAD') && <button className={btnPrimary} disabled={!dirty} onClick={save}>Lưu chỉ tiêu</button>}</>}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Tháng"><input type="month" className={cn(inputCls, 'w-44')} value={month} onChange={(e) => { if (e.target.value) { setMonth(e.target.value); setDraft({}); } }} /></Field>
          {(isBod || role === 'DEPT_HEAD') && <button className={cn(btnGhost, 'mb-0.5')} onClick={copyPrev}>Chép từ tháng trước</button>}
        </div>

        <section>
          <h3 className="mb-1 text-sm font-semibold">Chỉ tiêu phòng ban</h3>
          <p className="mb-3 text-xs text-[rgb(var(--muted))]">{canDept ? 'Giám đốc nhập. Doanh thu trước VAT; lead dùng cho phòng Marketing.' : 'Do Giám đốc giao.'}</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
            <thead><tr className="text-left text-xs text-[rgb(var(--muted))]"><th className="pb-2 pr-3 font-medium">Phòng</th><th className="pb-2 pr-3 font-medium">Doanh thu (đ)</th><th className="w-24 pb-2 pr-3 font-medium">Lead</th><th className="w-24 pb-2 font-medium">Dự án chốt</th></tr></thead>
            <tbody>{visibleDepts.map((x) => { const v = val('DEPT', x.code); return (
              <tr key={x.code} className="border-t border-[rgb(var(--line))]">
                <td className="py-2 pr-3">{x.short || x.name}</td>
                <td className="py-2 pr-3"><MoneyInput value={v.revenue} disabled={!canDept} onChange={(n) => edit('DEPT', x.code, { revenue: n })} /></td>
                <td className="py-2 pr-3"><input type="number" min={0} disabled={!canDept} aria-label={`Lead ${x.name}`} className={inputCls} value={v.leads ?? ''} onChange={(e) => edit('DEPT', x.code, { leads: Number(e.target.value) || undefined })} /></td>
                <td className="py-2"><input type="number" min={0} disabled={!canDept} aria-label={`Dự án chốt ${x.name}`} className={inputCls} value={v.deals ?? ''} onChange={(e) => edit('DEPT', x.code, { deals: Number(e.target.value) || undefined })} /></td>
              </tr>
            ); })}</tbody>
          </table></div>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">Chỉ tiêu nhân viên</h3>
          <p className="mb-3 text-xs text-[rgb(var(--muted))]">{role === 'DEPT_HEAD' ? 'Trưởng phòng giao cho nhân viên phòng mình.' : isBod ? 'Trưởng phòng nhập; Giám đốc sửa được khi cần.' : 'Do Trưởng phòng giao.'}</p>
          <div className="space-y-4">
            {visibleDepts.map((x) => { const st = staffOf(x.code); if (!st.length) return null; const dt = val('DEPT', x.code).revenue; const sum = sumStaff(x.code); return (
              <div key={x.code} className="rounded-md border border-[rgb(var(--line))] p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold">{x.name}</p>
                  {role !== 'SALES_REP' && <p className={cn('text-xs tabular-nums', dt && sum < dt ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>Tổng nhân viên {compact(sum)}{dt ? ` / phòng ${compact(dt)}${sum < dt ? ` · thiếu ${compact(dt - sum)}` : ''}` : ''}</p>}
                </div>
                <table className="w-full text-sm"><tbody>{st.map((u) => { const v = val('USER', u.id); const ok = canUser(u); return (
                  <tr key={u.id} className="border-t border-[rgb(var(--line))] first:border-0">
                    <td className="py-1.5 pr-3">{u.name}<span className="block text-xs text-[rgb(var(--muted))]">{ROLE_LABEL[u.role]}</span></td>
                    <td className="w-56 py-1.5 pr-3"><MoneyInput value={v.revenue} disabled={!ok} onChange={(n) => edit('USER', u.id, { revenue: n })} /></td>
                    <td className="w-24 py-1.5"><input type="number" min={0} disabled={!ok} aria-label={`Dự án chốt ${u.name}`} placeholder="Dự án" className={inputCls} value={v.deals ?? ''} onChange={(e) => edit('USER', u.id, { deals: Number(e.target.value) || undefined })} /></td>
                  </tr>
                ); })}</tbody></table>
              </div>
            ); })}
          </div>
        </section>

        {isBod && (
          <section>
            <h3 className="mb-3 text-sm font-semibold">Ngưỡng đánh giá</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tỷ lệ chốt tối thiểu (%)"><input type="number" min={1} max={100} className={inputCls} value={cfg.winRatePct} onChange={(e) => setCfg((c) => ({ ...c, winRatePct: Number(e.target.value) || KPI_CFG_DEFAULT.winRatePct }))} /></Field>
              <Field label="Chu kỳ chốt mục tiêu (ngày)"><input type="number" min={1} className={inputCls} value={cfg.cycleDays} onChange={(e) => setCfg((c) => ({ ...c, cycleDays: Number(e.target.value) || KPI_CFG_DEFAULT.cycleDays }))} /></Field>
              <Field label="Pipeline phủ (lần phần còn thiếu)"><input type="number" min={1} step={0.5} className={inputCls} value={cfg.coverage} onChange={(e) => setCfg((c) => ({ ...c, coverage: Number(e.target.value) || KPI_CFG_DEFAULT.coverage }))} /></Field>
              <Field label="Chi phí / lead tối đa (đ)"><MoneyInput value={cfg.cplMax} onChange={(n) => setCfg((c) => ({ ...c, cplMax: n || KPI_CFG_DEFAULT.cplMax }))} /></Field>
            </div>
          </section>
        )}
      </div>
    </SideSheet>
  );
}

