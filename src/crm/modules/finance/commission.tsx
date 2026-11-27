'use client';

import { useState } from 'react';
import { BadgePercent, Banknote, CheckCircle2, Clock } from 'lucide-react';
import { Pagination, usePaged } from '../../components/controls';
import { useInRange } from '../../components/filters';
import { Chip, EmptyState, Field, Modal, Panel, StatCard, Table } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, C, CASH_ACCOUNT, COMMISSION_STATUS, compact, inputCls, jobCustName, kpiGrid, rowCls, tdCls, tdFirst, tdLast, useApp, vnd, wonQuoteOf } from '../../lib/core';
import type { CashAccount, CommissionRow, InstallJob, Job, MfgConfig, Receipt } from '../../lib/types';
import { cn } from '../../lib/utils';
import { StagePills } from '../alux/orders';

export function commissionRows(jobs: Job[], receipts: Receipt[], installs: InstallJob[], cfg: MfgConfig): CommissionRow[] {
  return jobs.filter((j) => j.wonAt && !j.lostAt && j.contractValue).map((j) => {
    const q = wonQuoteOf(j);
    const base = q ? q.subtotal : Math.round((j.contractValue ?? 0) / (1 + j.vatPct / 100));
    const conf = receipts.filter((r) => r.jobId === j.id && r.status === 'CONFIRMED');
    const confirmed = conf.reduce((s, r) => s + r.amount, 0);
    const pctPaid = j.contractValue ? Math.min(100, (confirmed / j.contractValue) * 100) : 0;
    const crew = Array.from(new Set(installs.filter((i) => i.jobId === j.id && i.status === 'ACCEPTED').flatMap((i) => [i.leaderId, ...i.team]).filter((x): x is string => !!x)));
    const lines = j.commission?.lines ?? [
      ...(j.ownerId ? [{ userId: j.ownerId, role: 'SALES' as const, amount: Math.round((base * cfg.salesCommissionPct) / 100) }] : []),
      ...crew.map((u) => ({ userId: u, role: 'INSTALL' as const, amount: Math.round((base * cfg.installCommissionPct) / 100 / crew.length) })),
    ];
    const full = confirmed >= (j.contractValue ?? 0);
    const fullAt = full ? Math.max(...conf.map((r) => r.confirmedAt ?? 0)) : undefined;
    return { j, base: j.commission?.base ?? base, confirmed, pctPaid, status: j.commission ? 'PAID' : full ? 'READY' : 'WAIT', lines, total: lines.reduce((s, l) => s + l.amount, 0), fullAt };
  });
}

export function CommissionPanel() {
  const { jobs, setJobs, receipts, installJobs, mfgConfig, customers, userName, canDo, role, me, postCash, audit, notify, openJob } = useApp();
  const inR = useInRange();
  const [st, setSt] = useState<'ALL' | CommissionRow['status']>('READY');
  const [pay, setPay] = useState<CommissionRow[] | null>(null);
  const [account, setAccount] = useState<CashAccount>('BANK');
  const canPay = canDo('cash.manage');
  const seeAll = canPay || role === 'BOD' || role === 'ACCOUNTANT';
  const all = commissionRows(jobs, receipts, installJobs, mfgConfig).filter((r) => seeAll || r.lines.some((l) => l.userId === me.id))
    .map((r) => (seeAll ? r : { ...r, lines: r.lines.filter((l) => l.userId === me.id), total: r.lines.filter((l) => l.userId === me.id).reduce((s, l) => s + l.amount, 0) }));
  const rows = all.filter((r) => (st === 'ALL' || r.status === st) && (r.status !== 'PAID' || inR(new Date(r.j.commission!.paidAt))));
  const sum = (s: CommissionRow['status']) => all.filter((r) => r.status === s && (s !== 'PAID' || inR(new Date(r.j.commission!.paidAt)))).reduce((x, r) => x + r.total, 0);
  const paged = usePaged(rows, 20);
  const doPay = () => {
    if (!pay) return;
    const at = Date.now();
    for (const r of pay) {
      setJobs((all2) => all2.map((j) => (j.id === r.j.id ? { ...j, commission: { paidAt: at, by: me.id, base: r.base, lines: r.lines } } : j)));
      r.lines.forEach((l) => postCash({ kind: 'OUT', account, category: 'Hoa hồng', amount: l.amount, partner: userName(l.userId), jobId: r.j.id, ref: r.j.code, note: `Hoa hồng ${l.role === 'SALES' ? 'sales / kỹ thuật' : 'lắp đặt'} đơn ${r.j.code}`, source: 'COMMISSION', sourceId: `${r.j.id}:${l.userId}:${l.role}` }));
      audit('COMMISSION_PAY', `${r.j.code}: chi hoa hồng ${vnd(r.total)} cho ${r.lines.length} người`, 'WARN');
    }
    notify(`Đã quyết toán hoa hồng ${pay.length} đơn, tự sinh ${pay.reduce((s, r) => s + r.lines.length, 0)} phiếu chi vào sổ quỹ`, 'teal');
    setPay(null);
  };
  const ready = all.filter((r) => r.status === 'READY');
  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Đủ điều kiện, chờ chi" value={compact(sum('READY'))} icon={Banknote} color={C.orange} sub={`${ready.length} đơn đã thu đủ 100%`} />
        <StatCard label="Đã chi trong kỳ" value={compact(sum('PAID'))} icon={CheckCircle2} color={C.teal} />
        <StatCard label="Chưa đủ điều kiện" value={compact(sum('WAIT'))} icon={Clock} color={C.muted} sub="Chờ khách thanh toán đủ" />
        <StatCard label="Tỷ lệ hoa hồng" value={`${mfgConfig.salesCommissionPct}% + ${mfgConfig.installCommissionPct}%`} icon={BadgePercent} sub="Sales / kỹ thuật + đội lắp, trên giá trị trước VAT" />
      </div>
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StagePills items={[{ id: 'READY' as const, label: 'Chờ chi', count: ready.length }, { id: 'WAIT' as const, label: 'Chưa đủ điều kiện', short: 'Chưa đủ ĐK', count: all.filter((r) => r.status === 'WAIT').length }, { id: 'PAID' as const, label: 'Đã chi', count: all.filter((r) => r.status === 'PAID').length }, { id: 'ALL' as const, label: 'Tất cả', count: all.length }]} value={st} onChange={(v) => { setSt(v); paged.setPage(1); }} />
          {canPay && ready.length > 0 && <button className={cn(btnPrimary, btnSm, 'ml-auto')} onClick={() => setPay(ready)}><Banknote className="h-3.5 w-3.5" aria-hidden />Quyết toán tất cả ({ready.length} đơn, {compact(ready.reduce((s, r) => s + r.total, 0))})</button>}
        </div>
        <Table head={['STT', 'Đơn hàng', <span key="b" className="block text-right">Giá trị tính HH</span>, 'Đã xác nhận thu', 'Người nhận', <span key="t" className="block text-right">Tổng hoa hồng</span>, 'Trạng thái', '']} minW={1120}>
          {paged.slice.map((r, i) => (
            <tr key={r.j.id} className={rowCls}>
              <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{(paged.page - 1) * 20 + i + 1}</td>
              <td className={cn(tdCls, 'max-w-[220px]')}><button className="max-w-full text-left hover:text-[rgb(var(--accent-fg))]" onClick={() => openJob(r.j.id)}><p className="truncate font-medium">{jobCustName(r.j, customers)}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{r.j.code}, {r.j.title}</p></button></td>
              <td className={cn(tdCls, 'text-right tabular-nums')}>{r.base.toLocaleString('vi-VN')}</td>
              <td className={cn(tdCls, 'min-w-[120px]')}>
                <div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgb(var(--raised))]"><div className="h-full rounded-full" style={{ width: `${r.pctPaid}%`, background: r.pctPaid >= 100 ? C.teal : C.orange }} /></div><span className="text-xs tabular-nums">{r.pctPaid.toFixed(0)}%</span></div>
                {r.fullAt ? <p className="mt-0.5 text-[11px] text-[rgb(var(--muted))]">Thu đủ {new Date(r.fullAt).toLocaleDateString('vi-VN')}</p> : null}
              </td>
              <td className={cn(tdCls, 'min-w-[220px] text-xs')}>
                {r.lines.length ? r.lines.map((l) => <p key={`${l.userId}${l.role}`} className="flex justify-between gap-3"><span className="whitespace-nowrap">{userName(l.userId)} <span className="text-[rgb(var(--muted))]">({l.role === 'SALES' ? 'sales' : 'lắp đặt'})</span></span><span className="whitespace-nowrap tabular-nums">{compact(l.amount)}</span></p>) : <span className="text-[rgb(var(--muted))]">Chưa có người nhận (chưa nghiệm thu)</span>}
              </td>
              <td className={cn(tdCls, 'text-right font-semibold tabular-nums')}>{r.total.toLocaleString('vi-VN')}</td>
              <td className={cn(tdCls, 'whitespace-nowrap')}><Chip tone={COMMISSION_STATUS[r.status].tone}>{COMMISSION_STATUS[r.status].label}</Chip>{r.status === 'PAID' && <p className="mt-0.5 text-[11px] text-[rgb(var(--muted))]">{new Date(r.j.commission!.paidAt).toLocaleDateString('vi-VN')}, {userName(r.j.commission!.by)}</p>}</td>
              <td className={tdLast}>{r.status === 'READY' && canPay && <button className={cn(btnGhost, btnSm, 'whitespace-nowrap')} onClick={() => setPay([r])}>Chi hoa hồng</button>}</td>
            </tr>
          ))}
        </Table>
        {!rows.length && <EmptyState text={<>Không có đơn ở trạng thái này.</>} art="box" />}
        <Pagination paged={paged} unit="đơn" />
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">Hoa hồng chỉ đủ điều kiện khi kế toán đã xác nhận thu đủ 100% giá trị hợp đồng. Đổi tỷ lệ ở Cài đặt &gt; Kế toán & công nợ; đơn đã quyết toán giữ nguyên số đã chi.</p>
      </Panel>
      {pay && (
        <Modal title={`Quyết toán hoa hồng ${pay.length} đơn`} onClose={() => setPay(null)} footer={<><button className={btnGhost} onClick={() => setPay(null)}>Hủy</button><button className={btnPrimary} onClick={doPay}>Xác nhận chi {vnd(pay.reduce((s, r) => s + r.total, 0))}</button></>}>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto">
            {pay.map((r) => <li key={r.j.id} className="rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm"><p className="flex justify-between gap-2"><b>{r.j.code}</b><span className="tabular-nums">{vnd(r.total)}</span></p><p className="text-xs text-[rgb(var(--muted))]">{r.lines.map((l) => `${userName(l.userId)} ${compact(l.amount)}`).join(', ')}</p></li>)}
          </ul>
          <Field label="Chi từ" className="mt-4"><select className={inputCls} value={account} onChange={(e) => setAccount(e.target.value as CashAccount)}>{(Object.keys(CASH_ACCOUNT) as CashAccount[]).map((a) => <option key={a} value={a}>{CASH_ACCOUNT[a]}</option>)}</select></Field>
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">Mỗi người nhận một phiếu chi "Hoa hồng" tự sinh trong sổ quỹ, gắn vào chi phí của đơn.</p>
        </Modal>
      )}
    </div>
  );
}

