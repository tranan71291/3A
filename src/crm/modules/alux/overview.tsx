'use client';

import { AlertTriangle, BadgePercent, Banknote, Clock, Download, FileCheck2, Search, TrendingUp, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { DateRangePicker, Fab, Pagination, usePaged } from '../../components/controls';
import { useInRange } from '../../components/filters';
import { Chip, EmptyState, Panel, StatCard, Table, Tabs, useSort, useSticky } from '../../components/ui';
import { avg, btnGhost, btnPrimary, btnSm, C, compact, DAY, fmtDate, fmtDays, fmtDT, gfCount, holdingOverdue, inputBase, inputCls, isoMs, JOB_LOST, JOB_STAGE, JOB_STAGES, jobCustName, kpiGrid, monthKey, pct, rowCls, segName, spanDays, tdCls, tdFirst, tdLast, tipStyle, todayISO, useApp, vnd, wonQuoteOf } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import type { JobLostReason, Tone } from '../../lib/types';
import { cn } from '../../lib/utils';
import { jobActualCost, jobMoney, jobStageOf } from '../../lib/workshop';
import { MfgLeadForm } from './orders';

export function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push({ key: monthKey(x.getTime()), label: `T${x.getMonth() + 1}` }); }
  return out;
}

/** Các con số dùng chung cho Tổng quan & Báo cáo xưởng */
export function useMfgData() {
  const { jobs: allJobs, receipts, workOrders, installJobs, now, gf, customers } = useApp();
  const inR = useInRange();
  const t = now ?? Date.now();
  // Bộ lọc toàn cục: phòng ban của đơn, miền theo khách hàng của đơn
  const jobs = gfCount(gf) ? allJobs.filter((j) => (gf.dept === 'ALL' || j.dept === gf.dept) && (gf.region === 'ALL' || customers.find((c) => c.id === j.customerId)?.region === gf.region)) : allJobs;
  const rows = jobs.map((j) => ({ j, stage: jobStageOf(j, workOrders, installJobs, receipts), money: jobMoney(j, receipts) }));
  const confirmedIn = receipts.filter((r) => r.status === 'CONFIRMED' && r.confirmedAt && inR(new Date(r.confirmedAt)));
  return { rows, inR, t, confirmedIn };
}

export function MfgOverview() {
  const { receipts, installJobs, workOrders, mfgConfig, openJob, go, userName, customers, me, role } = useApp();
  const { rows, inR, t, confirmedIn } = useMfgData();
  const revenue = confirmedIn.reduce((s, r) => s + r.amount, 0);
  const won = rows.filter((r) => r.j.wonAt && inR(r.j.wonAt));
  const wonValue = won.reduce((s, r) => s + r.money.value, 0);
  const live = rows.filter((r) => r.j.wonAt && !r.j.lostAt);
  const receivable = live.reduce((s, r) => s + r.money.receivable, 0);
  const holding = receipts.filter((r) => r.status === 'HOLDING');
  const lateHold = holding.filter((r) => holdingOverdue(r, t, mfgConfig.submitHours));
  const submitted = receipts.filter((r) => r.status === 'SUBMITTED');
  const pipeline = rows.filter((r) => r.stage === 'QUOTED').reduce((s, r) => s + (r.j.quotes[r.j.quotes.length - 1]?.total ?? 0), 0);

  // Phễu trong kỳ: lead -> khảo sát -> báo giá -> chốt
  const jobsIn = rows.filter((r) => inR(r.j.createdAt));
  const funnel: [string, number, string][] = [
    ['Lead mới', jobsIn.length, '#8B5CF6'],
    ['Đã khảo sát', jobsIn.filter((r) => r.j.quotes.length || r.j.surveyCheckins.length || r.j.files.length).length, C.blue],
    ['Đã báo giá', jobsIn.filter((r) => r.j.quotes.length).length, '#06B6D4'],
    ['Chốt, nhận cọc', jobsIn.filter((r) => r.j.wonAt).length, C.teal],
  ];
  const fMax = Math.max(1, ...funnel.map((f) => f[1]));

  // Doanh số 6 tháng: tiền đã xác nhận và giá trị HĐ ký mới
  const months = lastMonths(6).map((m) => ({
    name: m.label,
    'Đã thu (xác nhận)': receipts.filter((r) => r.status === 'CONFIRMED' && r.confirmedAt && monthKey(r.confirmedAt) === m.key).reduce((s, r) => s + r.amount, 0),
    'HĐ ký mới': rows.filter((r) => r.j.wonAt && monthKey(isoMs(r.j.wonAt)) === m.key).reduce((s, r) => s + r.money.value, 0),
  }));
  const stageData = JOB_STAGES.filter((s) => s !== 'DONE').map((s) => ({ name: JOB_STAGE[s].short, n: rows.filter((r) => r.stage === s).length, color: JOB_STAGE[s].color }));

  // Việc cần xử lý / đơn bị kẹt
  type Stuck = { key: string; jobId?: string; title: string; why: string; tone: Tone };
  const stuck: Stuck[] = [];
  lateHold.forEach((r) => { const j = rows.find((x) => x.j.id === r.jobId)?.j; stuck.push({ key: `h${r.id}`, jobId: r.jobId, title: `${userName(r.collectedBy)} giữ ${vnd(r.amount)} tiền mặt`, why: `${r.code}${j ? `, ${j.code}` : ''}: quá hạn nộp kế toán`, tone: 'red' }); });
  rows.forEach(({ j, stage, money }) => {
    const name = jobCustName(j, customers);
    if (stage === 'WAIT_PAYMENT') stuck.push({ key: `p${j.id}`, jobId: j.id, title: name, why: `Đã nghiệm thu, còn ${compact(money.remaining || money.receivable)} chưa thu / chưa xác nhận`, tone: 'red' });
    const wo = workOrders.find((w) => w.jobId === j.id);
    if (stage === 'PRODUCTION' && wo?.stage === 'WAITING' && (spanDays(j.wonAt, t) ?? 0) > 2) stuck.push({ key: `w${j.id}`, jobId: j.id, title: name, why: `Đã cọc ${Math.floor(spanDays(j.wonAt, t) ?? 0)} ngày, xưởng chưa bắt đầu`, tone: 'orange' });
    if (stage === 'INSTALL' && !installJobs.some((i) => i.jobId === j.id)) stuck.push({ key: `i${j.id}`, jobId: j.id, title: name, why: 'Sản xuất xong, chưa hẹn lịch lắp đặt', tone: 'orange' });
    if (stage === 'QUOTED') { const last = j.quotes[j.quotes.length - 1]; const d = spanDays(last?.at, t) ?? 0; if (d > mfgConfig.quoteValidDays) stuck.push({ key: `q${j.id}`, jobId: j.id, title: name, why: `Báo giá ${Math.floor(d)} ngày chưa chốt (hiệu lực ${mfgConfig.quoteValidDays} ngày)`, tone: 'muted' }); }
    if (stage === 'SURVEY' && j.appointmentAt && isoMs(j.appointmentAt) < t - DAY) stuck.push({ key: `s${j.id}`, jobId: j.id, title: name, why: `Hẹn khảo sát ${fmtDT(j.appointmentAt)}, chưa có báo giá`, tone: 'orange' });
  });
  workOrders.filter((w) => w.jobId && w.stage !== 'DONE' && w.dueDate < todayISO()).forEach((w) => stuck.push({ key: `o${w.id}`, jobId: w.jobId, title: w.title, why: `${w.code} trễ hạn sản xuất (${fmtDate(w.dueDate)})`, tone: 'red' }));

  const week = installJobs.filter((i) => i.status !== 'ACCEPTED' && isoMs(i.from) <= t + 7 * DAY && isoMs(i.to) >= t - DAY).sort((a, b) => a.from.localeCompare(b.from));
  const myHolding = holding.filter((r) => r.collectedBy === me.id);

  return (
    <div className="space-y-5">
      <div className="hidden items-center justify-between gap-3 lg:flex"><p className="text-sm text-[rgb(var(--muted))]">Số liệu theo kỳ đang chọn</p><DateRangePicker /></div>
      {myHolding.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.1)] p-3 text-sm">
          <Banknote className="h-5 w-5 text-[rgb(var(--accent))]" aria-hidden />
          <span className="flex-1">Bạn đang giữ <b>{vnd(myHolding.reduce((s, r) => s + r.amount, 0))}</b> tiền mặt ({myHolding.length} phiếu). Nộp về kế toán trong ngày rồi bấm "Đã nộp" ở Trung tâm phê duyệt.</span>
          <button className={cn(btnPrimary, btnSm)} onClick={() => go('tasks')}>Mở việc của tôi</button>
        </div>
      )}
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Doanh số đã thu (kỳ)" value={compact(revenue)} icon={TrendingUp} color={C.teal} sub={`${confirmedIn.length} phiếu kế toán đã xác nhận`} />
        <StatCard label="Hợp đồng ký mới" value={compact(wonValue)} icon={FileCheck2} color={C.orange} sub={`${won.length} đơn chốt trong kỳ, đang chào ${compact(pipeline)}`} />
        <StatCard label="Còn phải thu" value={compact(receivable)} icon={Wallet} color={C.red} sub={`${live.filter((r) => r.money.receivable > 0).length} đơn còn công nợ`} />
        <StatCard label="Tiền đang ở nhân viên" value={compact(holding.reduce((s, r) => s + r.amount, 0) + submitted.reduce((s, r) => s + r.amount, 0))} icon={Banknote} color={lateHold.length ? C.red : C.sand}
          sub={lateHold.length ? `${lateHold.length} phiếu quá hạn nộp` : `${holding.length} đang giữ, ${submitted.length} chờ kế toán xác nhận`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Panel className="xl:col-span-3" title="Doanh số đã thu và hợp đồng ký mới, 6 tháng">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke={C.line} vertical={false} />
                <XAxis dataKey="name" stroke={C.muted} fontSize={12} />
                <YAxis stroke={C.muted} fontSize={11} tickFormatter={(v) => compact(Number(v))} width={64} />
                <Tooltip {...tipStyle} formatter={(v) => vnd(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="HĐ ký mới" fill={C.orange} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Đã thu (xác nhận)" fill={C.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="xl:col-span-2" title="Phễu trong kỳ">
          <ul className="space-y-3">
            {funnel.map(([label, n, color], i) => (
              <li key={label}>
                <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-[rgb(var(--muted))]">{n}{i > 0 && funnel[i - 1][1] ? ` (${pct(n, funnel[i - 1][1])})` : ''}</span></div>
                <div className="h-2.5 rounded-full bg-[rgb(var(--raised))]"><div className="h-full rounded-full" style={{ width: `${(n / fMax) * 100}%`, background: color }} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[rgb(var(--muted))]">Tỷ lệ chốt trên đơn đã báo giá: <b className="text-[rgb(var(--fg))]">{pct(funnel[3][1], funnel[2][1])}</b></p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Đơn hàng theo giai đoạn" action={<button className={cn(btnGhost, btnSm)} onClick={() => go('jobs')}>Mở đơn hàng</button>}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" stroke={C.muted} fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke={C.muted} fontSize={12} width={78} />
                <Tooltip {...tipStyle} formatter={(v) => [`${v} đơn`, 'Số đơn']} />
                <Bar dataKey="n" radius={[0, 4, 4, 0]}>{stageData.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title={`Cần xử lý (${stuck.length})`}>
          {!stuck.length ? <EmptyState text={<>Không có đơn bị kẹt.</>} art="box" /> : (
            <ul className="max-h-60 divide-y divide-[rgb(var(--line))] overflow-y-auto">
              {stuck.slice(0, 12).map((s) => (
                <li key={s.key}>
                  <button className="flex w-full items-start gap-2 py-2 text-left" onClick={() => s.jobId && openJob(s.jobId)}>
                    <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', s.tone === 'red' ? 'text-[rgb(var(--danger-fg))]' : s.tone === 'orange' ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')} aria-hidden />
                    <span className="min-w-0"><span className="block truncate text-sm">{s.title}</span><span className="block text-xs text-[rgb(var(--muted))]">{s.why}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Lịch lắp đặt 7 ngày tới" action={<button className={cn(btnGhost, btnSm)} onClick={() => go('install')}>Mở lắp đặt</button>}>
        {!week.length ? <EmptyState text={<>Chưa có lịch lắp đặt.</>} art="calendar" /> : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {week.map((i) => {
              const j = rows.find((r) => r.j.id === i.jobId);
              return (
                <li key={i.id} className="rounded bg-[rgb(var(--raised))] p-3 text-sm">
                  <div className="flex items-start justify-between gap-2"><b className="min-w-0 truncate">{i.title}</b><Chip tone={i.status === 'IN_PROGRESS' ? 'orange' : 'blue'}>{i.status === 'IN_PROGRESS' ? 'Đang lắp' : 'Đã hẹn'}</Chip></div>
                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">{fmtDT(i.from)}, {userName(i.leaderId)}{i.team.length ? ` +${i.team.length}` : ''}, {i.address}</p>
                  {j && j.money.remaining > 0 && <p className="mt-1 text-xs text-[rgb(var(--accent-fg))]">Thu khi bàn giao: {vnd(j.money.remaining)}{customers.find((c) => c.id === j.j.customerId) ? `, ${customers.find((c) => c.id === j.j.customerId)!.contactPhone}` : ''}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {role === 'BOD' && <p className="text-center text-xs text-[rgb(var(--muted))]">Doanh số chỉ tính tiền Kế toán đã xác nhận. Tiền nhân viên đang giữ hoặc chờ đối chiếu không tính vào doanh số.</p>}
    </div>
  );
}

export function MfgCustomersPage() {
  return <MfgCustomersList />;
}

export function MfgCustomersList() {
  const { myCustomers: customers, jobs, receipts, workOrders, installJobs, sources, userName, openJob, canDo } = useApp();
  const [q, setQ] = useSticky('MfgCustomersList.q', '');
  const [seg, setSeg] = useSticky('MfgCustomersList.seg', 'ALL');
  const [form, setForm] = useState(false);
  const t = q.trim().toLowerCase();
  const rows = customers.map((c) => {
    const js = jobs.filter((j) => j.customerId === c.id);
    const money = js.map((j) => jobMoney(j, receipts));
    const lastJob = [...js].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return {
      c, js, lastJob, value: money.reduce((s, m) => s + m.value, 0), confirmed: money.reduce((s, m) => s + m.confirmed, 0), receivable: money.reduce((s, m) => s + m.receivable, 0),
      active: js.filter((j) => !['DONE', 'LOST'].includes(jobStageOf(j, workOrders, installJobs, receipts))).length,
    };
  }).filter((r) => (seg === 'ALL' || r.c.segment === seg) && (!t || `${r.c.code} ${r.c.name} ${r.c.contactPhone} ${r.c.address}`.toLowerCase().includes(t)))
    .sort((a, b) => b.value - a.value || b.c.createdAt.localeCompare(a.c.createdAt));
  const srt = useSort('MfgCustomersList', rows, { 0: (r) => r.c.name, 3: (r) => r.js.length, 4: (r) => r.value, 5: (r) => r.confirmed, 6: (r) => r.receivable });
  const paged = usePaged(srt.rows, 15);
  const segs = Array.from(new Set(customers.map((c) => c.segment)));
  const srcName = (id: string) => sources.find((s) => s.id === id)?.name ?? '—';
  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden /><input className={cn(inputCls, 'pl-9')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, số điện thoại, địa chỉ" /></div>
          <select className={cn(inputBase, 'w-auto')} value={seg} onChange={(e) => setSeg(e.target.value)} aria-label="Loại khách"><option value="ALL">Tất cả loại khách</option>{segs.map((s) => <option key={s} value={s}>{segName(s)}</option>)}</select>
          
          <button className={cn(btnGhost, btnSm)} onClick={() => downloadCsv(`khach-hang-${todayISO()}.csv`, [['Mã', 'Tên', 'SĐT', 'Địa chỉ', 'Loại', 'Nguồn', 'Số đơn', 'Giá trị HĐ', 'Đã thu', 'Còn phải thu'], ...rows.map((r) => [r.c.code, r.c.name, r.c.contactPhone, r.c.address, segName(r.c.segment), srcName(r.c.sourceId), r.js.length, r.value, r.confirmed, r.receivable])])}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>
        </div>
        <div className="space-y-2 md:hidden">
          {paged.slice.map((r) => (
            <button key={r.c.id} className="w-full rounded bg-[rgb(var(--raised))] p-3 text-left" onClick={() => r.lastJob && openJob(r.lastJob.id)}>
              <p className="text-sm font-medium">{r.c.name}</p>
              <p className="text-xs text-[rgb(var(--muted))]">{r.c.contactPhone}, {segName(r.c.segment)}, {r.js.length} đơn</p>
              {r.value > 0 && <p className="mt-1 flex justify-between text-xs tabular-nums"><span>{compact(r.value)}</span><span className={r.receivable ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--success-fg))]'}>Còn {compact(r.receivable)}</span></p>}
            </button>
          ))}
        </div>
        <div className="hidden md:block">
          <Table stt={Math.max(0, paged.from - 1)} head={['Khách hàng', 'Loại / nguồn', 'Phụ trách', 'Đơn', 'Giá trị HĐ', 'Đã thu', 'Còn phải thu']} minW={900} sort={srt.th}>
            {paged.slice.map((r) => (
              <tr key={r.c.id} className={cn(rowCls, r.lastJob && 'cursor-pointer')} onClick={() => r.lastJob && openJob(r.lastJob.id)}>
                <td className={tdFirst}><p className="font-medium">{r.c.name}</p><p className="max-w-[280px] truncate text-xs text-[rgb(var(--muted))]">{r.c.code}, {r.c.contactPhone}, {r.c.address}</p></td>
                <td className={cn(tdCls, 'text-xs')}>{segName(r.c.segment)}<p className="text-[rgb(var(--muted))]">{srcName(r.c.sourceId)}</p></td>
                <td className={cn(tdCls, 'text-xs')}>{userName(r.c.amId)}</td>
                <td className={cn(tdCls, 'tabular-nums')}>{r.js.length}{r.active > 0 && <span className="text-xs text-[rgb(var(--accent-fg))]"> ({r.active} đang chạy)</span>}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{r.value ? compact(r.value) : '—'}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{r.confirmed ? compact(r.confirmed) : '—'}</td>
                <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums', r.receivable ? 'text-[rgb(var(--danger-fg))]' : '')}>{r.value ? compact(r.receivable) : '—'}</td>
              </tr>
            ))}
          </Table>
        </div>
        {!rows.length && <EmptyState text={<>Chưa có khách hàng</>} hint={<>Khách được tạo khi kỹ thuật lập đơn khảo sát.</>} art="box" />}
        <Pagination paged={paged} unit="khách" />
      </Panel>
      <Fab label="Khách mới + đơn khảo sát" onClick={() => setForm(true)} disabled={!canDo('job.manage')} />
      {form && <MfgLeadForm onClose={() => setForm(false)} />}
    </div>
  );
}

export function MfgReports() {
  const { users, sources, customers, receipts, installJobs, workOrders, mfgConfig, openJob, stockMoves, cashEntries } = useApp();
  const { rows, inR, t } = useMfgData();
  const [tab, setTab] = useSticky<'margin' | 'people' | 'source' | 'cycle'>('MfgReports.tab', 'margin');

  // ---- Lãi gộp theo đơn (giá vốn theo bảng đơn giá ở bản báo giá đã chốt) ----
  const wonRows = rows.filter((r) => r.j.wonAt && !r.j.lostAt && inR(r.j.wonAt)).map((r) => {
    const q = wonQuoteOf(r.j);
    const cost = q?.cost ?? 0;
    const value = r.money.value || q?.total || 0;
    const base = q && q.vatPct ? value / (1 + q.vatPct / 100) : value;
    const actual = jobActualCost(r.j, stockMoves, cashEntries, workOrders);
    return { ...r, cost, actual, value, base, gm: base - cost, gmPct: base ? ((base - cost) / base) * 100 : 0, realPct: actual.total && base ? ((base - actual.total) / base) * 100 : null };
  }).sort((a, b) => a.gmPct - b.gmPct);
  const totV = wonRows.reduce((s, r) => s + r.value, 0), totGm = wonRows.reduce((s, r) => s + r.gm, 0);

  // ---- Hiệu suất kỹ thuật / kinh doanh và đội lắp ----
  const owners = users.filter((u) => rows.some((r) => r.j.ownerId === u.id));
  const people = owners.map((u) => {
    const mine = rows.filter((r) => r.j.ownerId === u.id && inR(r.j.createdAt));
    const quoted = mine.filter((r) => r.j.quotes.length).length;
    const wonN = mine.filter((r) => r.j.wonAt).length;
    const value = rows.filter((r) => r.j.ownerId === u.id && r.j.wonAt && inR(r.j.wonAt)).reduce((s, r) => s + r.money.value, 0);
    return { u, surveys: mine.length, quoted, wonN, rate: quoted ? (wonN / quoted) * 100 : 0, value, lead: avg(mine.map((r) => spanDays(r.j.createdAt, r.j.quotes[0]?.at))) };
  }).sort((a, b) => b.value - a.value);
  const leaders = users.filter((u) => installJobs.some((i) => i.leaderId === u.id) || receipts.some((r) => r.collectedBy === u.id && rows.find((x) => x.j.id === r.jobId)?.j.ownerId !== u.id)).map((u) => {
    const ins = installJobs.filter((i) => i.leaderId === u.id && i.acceptance && inR(i.acceptance.at));
    const col = receipts.filter((r) => r.collectedBy === u.id && inR(new Date(r.collectedAt)) && r.status !== 'REJECTED');
    const late = receipts.filter((r) => r.collectedBy === u.id && holdingOverdue(r, t, mfgConfig.submitHours));
    return { u, accepted: ins.length, defects: ins.reduce((s, i) => s + i.defects.length, 0), collected: col.reduce((s, r) => s + r.amount, 0), late: late.reduce((s, r) => s + r.amount, 0) };
  });

  // ---- Theo nguồn khách ----
  const bySource = sources.map((s) => {
    const cs = new Set(customers.filter((c) => c.sourceId === s.id).map((c) => c.id));
    const js = rows.filter((r) => cs.has(r.j.customerId) && inR(r.j.createdAt));
    const w = js.filter((r) => r.j.wonAt);
    return { name: s.name, jobs: js.length, won: w.length, value: w.reduce((x, r) => x + r.money.value, 0), rate: js.length ? (w.length / js.length) * 100 : 0 };
  }).filter((x) => x.jobs);

  // ---- Thời gian chu trình ----
  const cyc = rows.filter((r) => inR(r.j.createdAt) || (r.j.wonAt && inR(r.j.wonAt)));
  const woOf = (id: string) => workOrders.find((w) => w.jobId === id);
  const readyAt = (id: string) => woOf(id)?.doneAt ?? woOf(id)?.history.find((h) => h.stage === 'DONE')?.at;
  const accAt = (id: string) => installJobs.find((i) => i.jobId === id && i.acceptance)?.acceptance?.at;
  const paidAt = (id: string) => { const rs = receipts.filter((r) => r.jobId === id && r.status === 'CONFIRMED' && r.confirmedAt); return rs.length ? Math.max(...rs.map((r) => r.confirmedAt!)) : undefined; };
  const cycles: [string, number | null, string][] = [
    ['Tạo đơn → báo giá đầu', avg(cyc.map((r) => spanDays(r.j.createdAt, r.j.quotes[0]?.at))), 'Kỹ thuật khảo sát, đo đạc, lên bản vẽ'],
    ['Báo giá → chốt cọc', avg(cyc.filter((r) => r.j.wonAt).map((r) => spanDays(r.j.quotes[0]?.at, r.j.wonAt))), 'Thời gian khách cân nhắc'],
    ['Chốt → sản xuất xong', avg(cyc.filter((r) => r.j.wonAt && readyAt(r.j.id)).map((r) => spanDays(r.j.wonAt, readyAt(r.j.id)))), 'Xưởng sản xuất'],
    ['Xong SX → nghiệm thu', avg(cyc.filter((r) => readyAt(r.j.id) && accAt(r.j.id)).map((r) => spanDays(readyAt(r.j.id), accAt(r.j.id)))), 'Lắp đặt, xử lý tồn tại'],
    ['Nghiệm thu → thu đủ', avg(cyc.filter((r) => r.stage === 'DONE' && accAt(r.j.id)).map((r) => spanDays(accAt(r.j.id), paidAt(r.j.id)))), 'Thu tiền còn lại, kế toán xác nhận'],
  ];
  const lost = rows.filter((r) => r.j.lostAt && inR(r.j.lostAt));
  const lostData = (Object.keys(JOB_LOST) as JobLostReason[]).map((k, i) => ({ name: JOB_LOST[k], value: lost.filter((r) => r.j.lostReason === k).length, color: ['#EF4444', '#F6B533', '#1F74D4', '#94A3B8', '#8B5CF6'][i] })).filter((x) => x.value);

  const exportCsv = () => {
    if (tab === 'margin') downloadCsv(`lai-gop-don-${todayISO()}.csv`, [['Mã đơn', 'Công trình', 'Ngày chốt', 'Giá trị HĐ', 'Giá vốn', 'Lãi gộp', 'GM %', 'Đã thu xác nhận'], ...wonRows.map((r) => [r.j.code, r.j.title, r.j.wonAt ?? '', r.value, r.cost, Math.round(r.gm), r.gmPct.toFixed(1), r.money.confirmed])]);
    else if (tab === 'people') downloadCsv(`hieu-suat-${todayISO()}.csv`, [['Nhân sự', 'Khảo sát', 'Báo giá', 'Chốt', 'Tỷ lệ chốt %', 'Giá trị chốt'], ...people.map((p) => [p.u.name, p.surveys, p.quoted, p.wonN, p.rate.toFixed(1), p.value])]);
    else if (tab === 'source') downloadCsv(`theo-nguon-${todayISO()}.csv`, [['Nguồn', 'Đơn', 'Chốt', 'Tỷ lệ %', 'Giá trị'], ...bySource.map((s) => [s.name, s.jobs, s.won, s.rate.toFixed(1), s.value])]);
    else downloadCsv(`chu-trinh-${todayISO()}.csv`, [['Chặng', 'Trung bình (ngày)'], ...cycles.map((c) => [c[0], c[1] === null ? '' : c[1].toFixed(1)])]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs tabs={[{ id: 'margin', label: 'Lãi gộp theo đơn' }, { id: 'people', label: 'Hiệu suất nhân sự' }, { id: 'source', label: 'Theo nguồn khách' }, { id: 'cycle', label: 'Chu trình & lý do trượt' }]} value={tab} onChange={setTab} />
        <button className={cn(btnGhost, btnSm)} onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>
      </div>

      {tab === 'margin' && (
        <>
          <div className={kpiGrid('lg:grid-cols-3')}>
            <StatCard label="Giá trị đơn chốt trong kỳ" value={compact(totV)} icon={FileCheck2} sub={`${wonRows.length} đơn`} />
            <StatCard label="Lãi gộp ước tính" value={compact(totGm)} icon={TrendingUp} color={C.teal} sub="Theo giá vốn trong bảng đơn giá" />
            <StatCard label="GM bình quân" value={pct(totGm, wonRows.reduce((s, r) => s + r.base, 0))} icon={BadgePercent} color={C.orange} sub={`${wonRows.filter((r) => r.gmPct < 20).length} đơn GM dưới 20%`} />
          </div>
          <Panel title="Đơn chốt trong kỳ (GM thấp ở trên)">
            <Table head={['Khách hàng / hạng mục', 'Ngày chốt', 'Giá trị HĐ', 'Giá vốn dự toán', 'Lãi gộp', 'GM dự toán', 'Chi phí thực tế', 'GM thực tế', 'Đã thu']} minW={1080}>
              {wonRows.map((r) => (
                <tr key={r.j.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => openJob(r.j.id)}>
                  <td className={tdFirst}><p className="font-medium">{jobCustName(r.j, customers)}</p><p className="max-w-[240px] truncate text-xs text-[rgb(var(--muted))]">{r.j.code}, {r.j.title}</p></td>
                  <td className={cn(tdCls, 'text-xs')}>{fmtDate(r.j.wonAt)}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.value)}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.cost)}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.gm)}</td>
                  <td className={cn(tdCls, 'tabular-nums', r.gmPct < 20 ? 'text-[rgb(var(--danger-fg))]' : r.gmPct < 28 ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--success-fg))]')}>{r.gmPct.toFixed(1)}%</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{r.actual.total ? compact(r.actual.total) : '—'}</td>
                  <td className={cn(tdCls, 'tabular-nums', r.realPct !== null && r.realPct < r.gmPct - 5 ? 'text-[rgb(var(--danger-fg))]' : '')}>{r.realPct === null ? '—' : `${r.realPct.toFixed(1)}%`}</td>
                  <td className={cn(tdLast, 'tabular-nums')}>{pct(r.money.confirmed, r.value)}</td>
                </tr>
              ))}
            </Table>
            {!wonRows.length && <EmptyState text={<>Chưa có đơn chốt trong kỳ đã chọn.</>} art="box" />}
          </Panel>
        </>
      )}

      {tab === 'people' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel title="Kỹ thuật / kinh doanh: khảo sát đến chốt">
            <Table head={['Nhân sự', 'Khảo sát', 'Báo giá', 'Chốt', 'Tỷ lệ chốt', 'Giá trị chốt', 'Ra báo giá']} minW={640}>
              {people.map((p) => (
                <tr key={p.u.id} className={rowCls}>
                  <td className={tdFirst}>{p.u.name}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{p.surveys}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{p.quoted}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{p.wonN}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{p.rate.toFixed(0)}%</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(p.value)}</td>
                  <td className={cn(tdLast, 'text-xs')}>{fmtDays(p.lead)}</td>
                </tr>
              ))}
            </Table>
          </Panel>
          <Panel title="Đội lắp đặt: nghiệm thu và thu tiền">
            <Table head={['Đội trưởng / người thu', 'Nghiệm thu', 'Lỗi ghi nhận', 'Tiền đã thu', 'Quá hạn nộp']} minW={560}>
              {leaders.map((p) => (
                <tr key={p.u.id} className={rowCls}>
                  <td className={tdFirst}>{p.u.name}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{p.accepted}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{p.defects}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(p.collected)}</td>
                  <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums', p.late ? 'text-[rgb(var(--danger-fg))]' : '')}>{p.late ? compact(p.late) : '—'}</td>
                </tr>
              ))}
            </Table>
          </Panel>
        </div>
      )}

      {tab === 'source' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel title="Giá trị chốt theo nguồn khách">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySource} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="name" stroke={C.muted} fontSize={11} />
                  <YAxis stroke={C.muted} fontSize={11} tickFormatter={(v) => compact(Number(v))} width={64} />
                  <Tooltip {...tipStyle} formatter={(v) => vnd(Number(v))} />
                  <Bar dataKey="value" name="Giá trị chốt" fill={C.orange} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title={`Tỷ lệ chốt theo nguồn (${rows.filter((r) => inR(r.j.createdAt)).length} lead trong kỳ)`}>
            <Table head={['Nguồn', 'Đơn khảo sát', 'Chốt', 'Tỷ lệ', 'Giá trị']} minW={480}>
              {bySource.map((s) => (
                <tr key={s.name} className={rowCls}>
                  <td className={tdFirst}>{s.name}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{s.jobs}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{s.won}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{s.rate.toFixed(0)}%</td>
                  <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums')}>{compact(s.value)}</td>
                </tr>
              ))}
            </Table>
          </Panel>
        </div>
      )}

      {tab === 'cycle' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <Panel className="xl:col-span-3" title="Thời gian trung bình từng chặng">
            <ul className="space-y-3">
              {cycles.map(([label, d, hint]) => (
                <li key={label} className="flex items-center gap-3">
                  <Clock className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block text-sm">{label}</span><span className="block text-xs text-[rgb(var(--muted))]">{hint}</span></span>
                  <b className="tabular-nums">{fmtDays(d)}</b>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[rgb(var(--muted))]">Tổng chu trình trung bình: <b className="text-[rgb(var(--fg))]">{fmtDays(cycles.reduce<number | null>((s, c) => (c[1] === null ? s : (s ?? 0) + c[1]), null))}</b></p>
          </Panel>
          <Panel className="xl:col-span-2" title={`Lý do trượt (${lost.length} đơn)`}>
            {!lostData.length ? <EmptyState text={<>Không có đơn trượt trong kỳ.</>} art="box" /> : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={lostData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>{lostData.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie>
                    <Tooltip {...tipStyle} formatter={(v) => `${v} đơn`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

