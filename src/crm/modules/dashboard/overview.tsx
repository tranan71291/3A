'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, Banknote, FileText, FolderKanban, Inbox, Sparkles, TrendingUp, X } from 'lucide-react';
import { MentionText } from '../../components/comments';
import { Avatar } from '../../components/controls';
import { Chip, EmptyState, monthly, StatCard } from '../../components/ui';
import { bizMode, boqTotal, btnGhost, btnSm, C, compact, holdingOverdue, isoMs, JOB_STAGE, jobCustName, kpiGrid, lastQuoteOf, LEAD_STATUS, leadAt, median, MODULE_LABEL, monthLabel, useApp, woLate } from '../../lib/core';
import type { Forecast, Insight, Lead, LeadStatus } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useMfgData } from '../alux/overview';

/** Lõi dự báo dùng chung cho thương mại (lead / BOQ) và xưởng (đơn công trình) */
export function buildForecast(o: { history: number[]; deals: { value: number; p: number; etaMs: number }[]; won: number; lost: number; cycleDays: number }): Forecast {
  const now = new Date();
  const hist = o.history;
  const runRate = hist.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const mean = hist.reduce((a, b) => a + b, 0) / (hist.length || 1);
  const sd = Math.sqrt(hist.reduce((a, b) => a + (b - mean) ** 2, 0) / (hist.length || 1));
  const months: Forecast['months'] = hist.map((v, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (hist.length - 1 - i), 1);
    return { key: `h${i}`, label: monthLabel(d), actual: v };
  });
  let next3 = 0; let low3 = 0; let high3 = 0;
  for (let k = 1; k <= 3; k++) {
    const start = new Date(now.getFullYear(), now.getMonth() + k, 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + k + 1, 1).getTime();
    const pipe = o.deals.filter((d) => d.etaMs >= start && d.etaMs < end).reduce((a, d) => a + d.value * d.p, 0);
    // Lead chưa phát sinh chỉ kịp chốt khi khoảng cách tới tháng đó dài hơn chu kỳ bán hàng
    const fresh = Math.max(0, Math.min(1, ((end - Date.now()) / 864e5 - o.cycleDays) / 30));
    const f = pipe + runRate * fresh;
    const band = Math.max(sd, f * 0.2);
    next3 += f; low3 += Math.max(0, f - band); high3 += f + band;
    months.push({ key: `f${k}`, label: monthLabel(new Date(start)), forecast: Math.round(f), pipeline: Math.round(pipe), low: Math.max(0, Math.round(f - band)), high: Math.round(f + band) });
  }
  const samples = o.won + o.lost;
  return {
    months, next3, low3, high3, runRate, cycleDays: o.cycleDays, openDeals: o.deals.length, samples,
    winRate: (o.won + 1) / (samples + 2),
    confidence: samples >= 15 && hist.filter((x) => x > 0).length >= 4 ? 'Cao' : samples >= 5 ? 'Trung bình' : 'Thấp',
  };
}

export function useInsights(): { forecast: Forecast; alerts: Insight[] } {
  const app = useApp();
  const { company, myLeads: leads, quotes, users, departments, budget, programs, claims, customers, skus, now, workOrders, receipts, mfgConfig, userName } = app;
  const { rows } = useMfgData();
  const t = now ?? Date.now();
  const mfg = bizMode(company) === 'MFG';
  const alerts: Insight[] = [];
  let forecast: Forecast;

  if (!mfg) {
    // ---------- Dự báo: thương mại ----------
    const won = leads.filter((l) => l.status === 'WON' && l.wonAt);
    const lost = leads.filter((l) => l.status === 'LOST');
    const rate = (won.length + 1) / (won.length + lost.length + 2);
    const cyc = median(won.map((l) => (isoMs(l.wonAt) - leadAt(l)) / 864e5).filter((x) => x > 0));
    const cycleDays = Number.isFinite(cyc) ? Math.max(7, cyc) : 45;
    const P: Partial<Record<LeadStatus, number>> = { QUOTED: Math.min(0.9, rate * 1.25), ACCEPTED: rate * 0.75, ASSIGNED: rate * 0.45, ROUTED: rate * 0.35, NEW: rate * 0.25, NURTURE: rate * 0.12 };
    const deals = leads.filter((l) => P[l.status] !== undefined).map((l) => {
      const age = (t - leadAt(l)) / 864e5;
      const lq = lastQuoteOf(l.id, quotes);
      const value = lq?.amount ?? boqTotal(l);
      const remain = l.status === 'QUOTED' ? Math.max(7, cycleDays * 0.35) : Math.max(10, cycleDays - age);
      return { value, p: P[l.status] ?? 0, etaMs: t + remain * 864e5 };
    }).filter((d) => d.value > 0);
    forecast = buildForecast({ history: monthly(won, (l) => l.wonAt, (l) => l.wonAmount ?? boqTotal(l)), deals, won: won.length, lost: lost.length, cycleDays });

    // ---------- Cảnh báo: SLA theo tải nhân sự ----------
    const open = leads.filter((l) => ['ASSIGNED', 'ACCEPTED', 'QUOTED'].includes(l.status));
    departments.filter((d) => d.active && d.receivesLeads).forEach((d) => {
      const reps = users.filter((u) => u.active && u.dept === d.code && (u.role === 'SALES_REP' || u.role === 'DEPT_HEAD'));
      const inDept = open.filter((l) => l.dept === d.code);
      const risk = inDept.filter((l) => (l.status === 'ASSIGNED' && l.slaDeadline && l.slaDeadline - t < 2 * 3.6e6) || (l.status === 'ACCEPTED' && l.quoteDeadline && l.quoteDeadline - t < 12 * 3.6e6));
      const waiting = leads.filter((l) => l.dept === d.code && l.status === 'ROUTED');
      const load = reps.length ? (inDept.length + waiting.length) / reps.length : inDept.length + waiting.length;
      if (risk.length || (waiting.length && !reps.length)) {
        const overdue = risk.filter((l) => (l.status === 'ASSIGNED' ? l.slaDeadline! < t : l.quoteDeadline! < t)).length;
        alerts.push({ id: `sla-${d.code}`, tone: overdue ? 'red' : 'orange', title: `Có ${risk.length || waiting.length} dự án khả năng cao trễ SLA ở ${d.short}`, detail: `${overdue ? `${overdue} đã quá hạn. ` : ''}Tải trung bình ${load.toFixed(1).replace('.', ',')} việc / người (${reps.length} nhân sự)${reps.length < 2 ? ', thiếu nhân sự dự phòng' : ''}.`, go: 'projects', goLabel: 'Xem dự án' });
      }
    });
    // Nhân sự ôm quá nhiều việc
    const byRep = new Map<string, number>();
    open.forEach((l) => { if (l.assignee) byRep.set(l.assignee, (byRep.get(l.assignee) ?? 0) + 1); });
    const avg = byRep.size ? [...byRep.values()].reduce((a, b) => a + b, 0) / byRep.size : 0;
    [...byRep.entries()].filter(([, n]) => n >= 4 && n > avg * 1.5).forEach(([id, n]) => alerts.push({ id: `load-${id}`, tone: 'orange', title: `${userName(id)} đang xử lý ${n} dự án`, detail: `Cao hơn ${Math.round((n / avg - 1) * 100)}% mức trung bình của nhóm (${avg.toFixed(1).replace('.', ',')}). Cân nhắc chia lại để không trễ báo giá.`, go: 'projects', goLabel: 'Phân lại' }));

    // ---------- Cảnh báo: chi phí MDF bất thường ----------
    const spendSeries = monthly([...programs.map((p) => ({ at: p.start, v: p.held || p.requested })), ...claims.filter((c) => c.invoice).map((c) => ({ at: c.invoice!.date, v: c.actualCost ?? c.invoice!.amount }))], (x) => x.at, (x) => x.v, 4);
    const cur = spendSeries[3];
    const base = (spendSeries[0] + spendSeries[1] + spendSeries[2]) / 3;
    if (base > 0 && cur > base * 1.2) alerts.push({ id: 'mdf-spike', tone: 'orange', title: `Chi phí MDF tháng này đang tăng bất thường ${Math.round((cur / base - 1) * 100)}%`, detail: `${compact(cur)} so với trung bình ${compact(base)} / tháng của 3 tháng trước. Rà soát các chương trình mới giữ chỗ.`, go: 'claims', goLabel: 'Xem hồ sơ MDF' });
    // Tốc độ giải ngân so với thời gian trong năm tài chính
    if (budget.total > 0 && new Date(t).getFullYear() === budget.fiscalYear) {
      const yStart = new Date(budget.fiscalYear, 0, 1).getTime();
      const elapsed = (t - yStart) / (365 * 864e5);
      const used = (budget.spent + budget.committed) / budget.total;
      if (used > elapsed + 0.15) alerts.push({ id: 'mdf-fast', tone: 'orange', title: `Quỹ 3M giải ngân nhanh hơn kế hoạch`, detail: `Đã dùng + giữ chỗ ${Math.round(used * 100)}% quỹ khi năm mới qua ${Math.round(elapsed * 100)}%.`, go: 'claims', goLabel: 'Xem quỹ' });
      else if (elapsed > 0.5 && used < elapsed - 0.3) alerts.push({ id: 'mdf-slow', tone: 'blue', title: `Quỹ 3M đang giải ngân chậm`, detail: `Mới dùng ${Math.round(used * 100)}% quỹ khi năm đã qua ${Math.round(elapsed * 100)}%: nguy cơ không dùng hết ngân sách Hãng cấp.`, go: 'claims', goLabel: 'Lập chương trình' });
    }
    // Claim sắp hết hạn nộp Hãng
    const due = claims.filter((c) => !c.submitted && c.daysLeft <= 7);
    if (due.length) alerts.push({ id: 'claim-due', tone: due.some((c) => c.daysLeft <= 2) ? 'red' : 'orange', title: `${due.length} hồ sơ claim sắp hết hạn nộp Hãng`, detail: due.slice(0, 3).map((c) => `${c.code} (còn ${c.daysLeft} ngày)`).join(', '), go: 'claims', goLabel: 'Nộp hồ sơ' });
    // Tồn kho dưới định mức
    const low = skus.filter((x) => x.stock < x.minStock);
    if (low.length) alerts.push({ id: 'stock-low', tone: 'orange', title: `${low.length} SKU dưới tồn tối thiểu`, detail: `${low.slice(0, 3).map((x) => x.sku).join(', ')}${low.length > 3 ? '…' : ''}. Lead-time đặt Hãng ${Math.max(...low.map((x) => x.leadTimeDays))} ngày, nên lập PO sớm.`, go: 'supply', goLabel: 'Tạo PO' });
    // Pipeline tháng tới mỏng so với nhịp doanh số
    const nextM = forecast.months.find((m) => m.key === 'f1');
    if (nextM && forecast.runRate > 0 && (nextM.forecast ?? 0) < forecast.runRate * 0.7) alerts.push({ id: 'pipe-thin', tone: 'blue', title: 'Pipeline tháng tới mỏng', detail: `Dự báo ${compact(nextM.forecast ?? 0)}, thấp hơn 30% nhịp trung bình ${compact(forecast.runRate)} / tháng. Đẩy nhanh báo giá các dự án đang khảo sát.`, go: 'leads', goLabel: 'Xem lead' });
  } else {
    // ---------- Dự báo: xưởng ----------
    const won = rows.filter((r) => r.j.wonAt);
    const lost = rows.filter((r) => r.j.lostAt && !r.j.wonAt);
    const rate = (won.length + 1) / (won.length + lost.length + 2);
    const cyc = median(won.map((r) => (isoMs(r.j.wonAt) - isoMs(r.j.createdAt)) / 864e5).filter((x) => x > 0));
    const cycleDays = Number.isFinite(cyc) ? Math.max(5, cyc) : 21;
    const deals = rows.filter((r) => !r.j.wonAt && !r.j.lostAt).map((r) => {
      const q = r.j.quotes[r.j.quotes.length - 1]?.total ?? 0;
      const age = (t - isoMs(r.j.createdAt)) / 864e5;
      return { value: q, p: q ? Math.min(0.9, rate * 1.2) : rate * 0.4, etaMs: t + Math.max(5, cycleDays - age) * 864e5 };
    }).filter((d) => d.value > 0);
    forecast = buildForecast({ history: monthly(won, (r) => r.j.wonAt, (r) => r.money.value), deals, won: won.length, lost: lost.length, cycleDays });
    const lateHold = receipts.filter((r) => holdingOverdue(r, t, mfgConfig.submitHours));
    if (lateHold.length) alerts.push({ id: 'hold', tone: 'red', title: `${lateHold.length} khoản tiền mặt chưa nộp quỹ đúng hạn`, detail: `Tổng ${compact(lateHold.reduce((a, r) => a + r.amount, 0))}, quá ${mfgConfig.submitHours} giờ kể từ lúc thu.`, go: 'tasks', goLabel: 'Đối chiếu' });
    const late = workOrders.filter(woLate);
    if (late.length) alerts.push({ id: 'wo-late', tone: 'orange', title: `${late.length} lệnh sản xuất trễ hạn`, detail: 'Có nguy cơ lùi lịch lắp đặt đã hẹn với khách.', go: 'production', goLabel: 'Xem xưởng' });
    const missSurvey = rows.filter((r) => r.stage === 'SURVEY' && r.j.appointmentAt && isoMs(r.j.appointmentAt) < t - 3.6e6);
    if (missSurvey.length) alerts.push({ id: 'survey', tone: 'orange', title: `${missSurvey.length} lịch khảo sát đã quá giờ hẹn chưa cập nhật`, detail: 'Nhắc kỹ thuật check-in, chụp ảnh hiện trạng để kịp báo giá.', go: 'leads', goLabel: 'Xem lead' });
    const wait = rows.filter((r) => r.stage === 'WAIT_PAYMENT');
    if (wait.length) alerts.push({ id: 'pay', tone: 'red', title: `${wait.length} công trình đã nghiệm thu chưa thu đủ tiền`, detail: `Còn ${compact(wait.reduce((a, r) => a + (r.money.remaining || r.money.receivable), 0))} phải thu.`, go: 'jobs', goLabel: 'Thu tiền' });
  }
  // ---------- Công nợ (dùng chung) ----------
  const over = customers.filter((c) => c.creditLimit > 0 && c.debt > c.creditLimit * 0.9);
  if (over.length) alerts.push({ id: 'debt', tone: over.some((c) => c.debt > c.creditLimit) ? 'red' : 'orange', title: `${over.length} khách sát / vượt hạn mức công nợ`, detail: over.slice(0, 3).map((c) => `${c.name} ${Math.round((c.debt / c.creditLimit) * 100)}%`).join(', '), go: 'reports', goLabel: 'Xem công nợ' });
  const order = { red: 0, orange: 1, blue: 2 };
  return { forecast, alerts: alerts.sort((a, b) => order[a.tone] - order[b.tone]) };
}

/** Widget: dự báo doanh thu 3 tháng tới (cột thực tế + cột dự báo có khoảng tin cậy) */
export function ForecastWidget() {
  const { forecast: f } = useInsights();
  const max = Math.max(1, ...f.months.map((m) => Math.max(m.actual ?? 0, m.high ?? 0)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">Dự báo 3 tháng tới</p>
          <p className="font-display g-brand-text text-3xl font-extrabold tabular-nums">{compact(f.next3)}</p>
          <p className="text-xs text-[rgb(var(--muted))]">Khoảng {compact(f.low3)} – {compact(f.high3)}</p>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
          <dt className="text-[rgb(var(--muted))]">Tỷ lệ chốt</dt><dt className="text-[rgb(var(--muted))]">Chu kỳ chốt</dt><dt className="text-[rgb(var(--muted))]">Độ tin cậy</dt>
          <dd className="font-num text-sm text-[rgb(var(--fg))]">{Math.round(f.winRate * 100)}%</dd><dd className="font-num text-sm text-[rgb(var(--fg))]">{Math.round(f.cycleDays)} ngày</dd>
          <dd><Chip tone={f.confidence === 'Cao' ? 'teal' : f.confidence === 'Trung bình' ? 'orange' : 'muted'}>{f.confidence}</Chip></dd>
        </dl>
      </div>
      <div className="flex h-44 gap-2" role="img" aria-label={`Doanh số 6 tháng qua và dự báo 3 tháng tới, tổng dự báo ${compact(f.next3)}`}>
        {f.months.map((m) => {
          const isF = m.forecast !== undefined;
          const v = isF ? m.forecast ?? 0 : m.actual ?? 0;
          return (
            <div key={m.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={isF ? `${m.label}: dự báo ${compact(v)} (từ pipeline ${compact(m.pipeline ?? 0)}, khoảng ${compact(m.low ?? 0)} – ${compact(m.high ?? 0)})` : `${m.label}: thực tế ${compact(v)}`}>
              <span className="font-num text-[10px] text-[rgb(var(--muted))]">{v ? compact(v).replace(' ', '') : ''}</span>
              <div className="relative flex min-h-0 w-full max-w-[44px] flex-1 items-end">
                {isF && <div className="absolute inset-x-0 rounded-sm border border-dashed border-[rgb(var(--accent)/0.5)]" style={{ bottom: `${((m.low ?? 0) / max) * 100}%`, height: `${(((m.high ?? 0) - (m.low ?? 0)) / max) * 100}%` }} />}
                <div className={cn('w-full rounded-t-sm', isF ? 'g-brand opacity-90' : 'bg-[rgb(var(--secondary))]')} style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />
              </div>
              <span className={cn('text-[11px]', isF ? 'font-semibold text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{m.label}</span>
            </div>
          );
        })}
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[rgb(var(--faint))]">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[rgb(var(--secondary))]" />Thực tế (chốt đơn)</span>
        <span className="flex items-center gap-1.5"><i className="g-brand h-2.5 w-2.5 rounded-sm" />Dự báo</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-dashed border-[rgb(var(--accent)/0.6)]" />Khoảng dao động</span>
        <span>Từ {f.openDeals} cơ hội đang mở × tỷ lệ chốt theo giai đoạn, cộng phần lead mới ước theo trung bình 3 tháng ({compact(f.runRate)}/tháng); {f.samples} đơn chốt / trượt làm mẫu.</span>
      </p>
    </div>
  );
}

/** Widget: cảnh báo thông minh */
export function AlertsWidget({ limit = 6 }: { limit?: number }) {
  const { go } = useApp();
  const { alerts } = useInsights();
  const [all, setAll] = useState(false);
  if (!alerts.length) return <EmptyState text={<>Không có rủi ro nổi bật</>} hint={<>Hệ thống theo dõi SLA, tải nhân sự, chi phí MDF, công nợ, tồn kho và hạn nộp claim.</>} art="inbox" compact />;
  const shown = all ? alerts : alerts.slice(0, limit);
  const tone = { red: 'border-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.07)]', orange: 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.06)]', blue: 'border-[rgb(var(--secondary))] bg-[rgb(var(--secondary)/0.08)]' };
  const icon = { red: 'text-[rgb(var(--danger-fg))]', orange: 'text-[rgb(var(--accent-fg))]', blue: 'text-[rgb(var(--secondary-fg))]' };
  return (
    <ul className="space-y-2">
      {shown.map((a) => (
        <li key={a.id} className={cn('flex items-start gap-3 rounded border-l-2 px-3 py-2.5', tone[a.tone])}>
          <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', icon[a.tone])} aria-hidden />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[rgb(var(--fg))]">{a.title}</p><p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{a.detail}</p></div>
          {a.go && <button className={cn(btnGhost, btnSm, 'shrink-0')} onClick={() => go(a.go!)}>{a.goLabel ?? 'Xem'}<ArrowRight className="h-3.5 w-3.5" aria-hidden /></button>}
        </li>
      ))}
      {alerts.length > limit && <li><button className="text-xs text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setAll((v) => !v)}>{all ? 'Thu gọn' : `Xem thêm ${alerts.length - limit} cảnh báo`}</button></li>}
    </ul>
  );
}

/** Widget: hàng KPI tổng (theo kiểu vận hành) */
export function KpiWidget() {
  const { company, myLeads: leads, customers, quotes } = useApp();
  const { rows } = useMfgData();
  const { forecast } = useInsights();
  if (bizMode(company) === 'MFG') {
    const won = rows.filter((r) => r.j.wonAt);
    return (
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="HĐ ký 6 tháng" value={compact(won.filter((r) => isoMs(r.j.wonAt) > Date.now() - 183 * 864e5).reduce((a, r) => a + r.money.value, 0))} icon={TrendingUp} color={C.orange} highlight spark={monthly(won, (r) => r.j.wonAt, (r) => r.money.value)} />
        <StatCard label="Lead mới" value={String(rows.filter((r) => isoMs(r.j.createdAt) > Date.now() - 30 * 864e5).length)} sub="30 ngày qua" icon={Inbox} color={C.blue} spark={monthly(rows, (r) => r.j.createdAt)} />
        <StatCard label="Còn phải thu" value={compact(rows.filter((r) => r.j.wonAt && !r.j.lostAt).reduce((a, r) => a + r.money.receivable, 0))} icon={Banknote} color={C.red} />
        <StatCard label="Dự báo 3 tháng" value={compact(forecast.next3)} sub={`Độ tin cậy ${forecast.confidence.toLowerCase()}`} icon={Sparkles} color={C.teal} />
      </div>
    );
  }
  const won = leads.filter((l) => l.status === 'WON' && l.wonAt);
  const open = leads.filter((l) => !['WON', 'LOST'].includes(l.status));
  return (
    <div className={kpiGrid('lg:grid-cols-4')}>
      <StatCard label="Doanh số chốt 6 tháng" value={compact(won.filter((l) => isoMs(l.wonAt) > Date.now() - 183 * 864e5).reduce((a, l) => a + (l.wonAmount ?? boqTotal(l)), 0))} icon={TrendingUp} color={C.orange} highlight spark={monthly(won, (l) => l.wonAt, (l) => l.wonAmount ?? boqTotal(l))} />
      <StatCard label="Pipeline đang mở" value={compact(open.reduce((a, l) => a + boqTotal(l), 0))} sub={`${open.length} cơ hội`} icon={FolderKanban} color={C.blue} spark={monthly(open, leadAt, (l) => boqTotal(l))} />
      <StatCard label="Báo giá đã gửi" value={compact(quotes.reduce((a, q) => a + q.amount, 0))} sub={`${quotes.length} phiên bản, ${customers.length} khách`} icon={FileText} color="#8B5CF6" spark={monthly(quotes, (q) => q.date, (q) => q.amount)} />
      <StatCard label="Dự báo 3 tháng" value={compact(forecast.next3)} sub={`Độ tin cậy ${forecast.confidence.toLowerCase()}`} icon={Sparkles} color={C.teal} />
    </div>
  );
}

/** Widget: phễu chuyển đổi tương tác — bấm một tầng để xem danh sách và mở nhanh từng hồ sơ */
export function FunnelWidget() {
  const { company, myLeads: leads, go, openJob, customers } = useApp();
  const { rows } = useMfgData();
  const [sel, setSel] = useState<number | null>(null);
  type Rec = { key: string; title: string; sub: string; value: number; open: () => void };
  const L = (xs: Lead[]): Rec[] => xs.map((l) => ({ key: l.id, title: l.company, sub: `${l.code} · ${LEAD_STATUS[l.status].label}`, value: boqTotal(l), open: () => go(['ACCEPTED', 'QUOTED', 'WON', 'LOST'].includes(l.status) ? 'projects' : 'leads', l.code) }));
  const J = (xs: typeof rows): Rec[] => xs.map((r) => ({ key: r.j.id, title: jobCustName(r.j, customers), sub: `${r.j.code} · ${JOB_STAGE[r.stage].label}`, value: r.money.value || (r.j.quotes[r.j.quotes.length - 1]?.total ?? 0), open: () => openJob(r.j.id) }));
  const steps: [string, Rec[]][] = bizMode(company) === 'MFG'
    ? [['Lead', J(rows)], ['Đã khảo sát', J(rows.filter((r) => r.j.quotes.length || r.j.surveyCheckins.length || r.j.files.length))], ['Đã báo giá', J(rows.filter((r) => r.j.quotes.length))], ['Chốt, nhận cọc', J(rows.filter((r) => r.j.wonAt))]]
    : [['Lead nhận', L(leads)], ['Đã phân phòng', L(leads.filter((l) => l.status !== 'NEW' && l.status !== 'NURTURE'))], ['Sales tiếp nhận', L(leads.filter((l) => ['ACCEPTED', 'QUOTED', 'WON', 'LOST'].includes(l.status)))], ['Đã báo giá', L(leads.filter((l) => ['QUOTED', 'WON', 'LOST'].includes(l.status)))], ['Chốt đơn', L(leads.filter((l) => l.status === 'WON'))]];
  const max = Math.max(1, steps[0][1].length);
  const cur = sel !== null ? steps[sel] : null;
  return (
    <div className="space-y-3">
      <ol className="space-y-1.5">
        {steps.map(([label, recs], i) => {
          const n = recs.length;
          const prev = i > 0 ? steps[i - 1][1].length : 0;
          return (
            <li key={label}>
              <button className={cn('group w-full rounded px-2 py-1.5 text-left transition-colors', sel === i ? 'bg-[rgb(var(--secondary)/0.2)] ring-1 ring-[rgb(var(--secondary)/0.6)]' : 'hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => setSel(sel === i ? null : i)} aria-expanded={sel === i} title={`${label}: ${n} — bấm để xem danh sách`}>
                <div className="mb-1 flex items-baseline justify-between text-xs"><span className="text-[rgb(var(--fg2))] group-hover:text-[rgb(var(--fg))]">{label}</span><span className="font-num text-[rgb(var(--fg))]">{n}{i > 0 && prev ? <span className="ml-2 text-[rgb(var(--muted))]">{Math.round((n / prev) * 100)}%</span> : null}</span></div>
                <div className="mx-auto h-2.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.05)]" style={{ width: `${100 - i * 6}%` }}><div className={cn('h-full rounded-full transition-[width] duration-500', i === steps.length - 1 ? 'g-brand' : 'bg-[rgb(var(--secondary))]')} style={{ width: `${(n / max) * 100}%` }} /></div>
              </button>
            </li>
          );
        })}
      </ol>
      {cur && (
        <div className="rounded border border-[rgb(var(--ink)/0.06)] bg-[rgb(var(--ink)/0.02)] p-2 motion-safe:animate-[popIn_.14s_ease-out]">
          <p className="mb-1 flex items-center justify-between px-1 text-[11px] text-[rgb(var(--muted))]"><span>{cur[0]} · {cur[1].length} hồ sơ · {compact(cur[1].reduce((a, r) => a + r.value, 0))}</span><button className="hover:text-[rgb(var(--fg))]" onClick={() => setSel(null)} aria-label="Đóng danh sách"><X className="h-3.5 w-3.5" /></button></p>
          <ul className="max-h-48 overflow-y-auto">
            {cur[1].slice(0, 30).map((r) => <li key={r.key}><button className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-[rgb(var(--secondary)/0.15)]" onClick={r.open}><span className="min-w-0 flex-1"><span className="block truncate text-[rgb(var(--fg2))]">{r.title}</span><span className="block truncate text-[10px] text-[rgb(var(--faint))]">{r.sub}</span></span><span className="font-num shrink-0 text-[rgb(var(--fg2))]">{r.value ? compact(r.value) : ''}</span></button></li>)}
            {!cur[1].length && <li className="px-1.5 py-2 text-xs text-[rgb(var(--faint))]">Không có hồ sơ ở tầng này.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Widget: bình luận nhắc tên tôi gần đây */
export function MentionsWidget() {
  const { comments, me, userName, go } = useApp();
  const mine = comments.filter((c) => me && (c.mentions.includes(me.id) || c.authorId === me.id)).sort((a, b) => b.at - a.at).slice(0, 6);
  if (!mine.length) return <EmptyState text={<>Chưa có trao đổi nào nhắc bạn</>} hint={<>Bấm biểu tượng bình luận trên dòng bảng (lead, dự án, khách hàng, PO, đơn xưởng) và gõ @ để nhắc đồng nghiệp.</>} art="inbox" compact />;
  return (
    <ul className="divide-y divide-[rgb(var(--ink)/0.06)]">
      {mine.map((c) => (
        <li key={c.id}>
          <div role="button" tabIndex={0} className="flex w-full cursor-pointer items-start gap-3 py-2.5 text-left hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => go(c.module)} onKeyDown={(e) => { if (e.key === 'Enter') go(c.module); }}>
            <Avatar name={userName(c.authorId)} size={28} />
            <span className="min-w-0 flex-1"><span className="block text-xs text-[rgb(var(--muted))]"><b className="text-[rgb(var(--fg))]">{userName(c.authorId)}</b> · {MODULE_LABEL[c.module]} · {new Date(c.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span><span className="line-clamp-2 text-sm text-[rgb(var(--fg2))]"><MentionText text={c.text} /></span></span>
          </div>
        </li>
      ))}
    </ul>
  );
}

