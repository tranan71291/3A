'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Building2, Coins, Download, History, Pencil, Plus, RefreshCw, Trash2, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { removeWithUndo } from '../../app/context';
import { useIntent } from '../../components/command-palette';
import { Pagination, usePaged } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Chip, Code, EmptyState, Field, Modal, MoneyInput, Panel, StatCard, Table, Tabs, useSticky } from '../../components/ui';
import { bizMode, btnBase, btnGhost, btnPrimary, btnSm, C, CASH_ACCOUNT, CASH_IN_CATS, CASH_OUT_CATS, compact, fmtDate, inputCls, iso, jobCustName, kpiGrid, nextCode, rangeBounds, rowCls, tdCls, tdFirst, tdLast, tipStyle, todayISO, uid, useApp, vnd } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import type { CashAccount, CashEntry, CashLine, ConfirmState } from '../../lib/types';
import { cn } from '../../lib/utils';
import { cashLines, jobActualCost } from '../../lib/workshop';
import { SearchBox } from '../alux/orders';
import { lastMonths } from '../alux/overview';

// =====================================================================
//  PHÂN HỆ: THU CHI (sổ quỹ tiền mặt & ngân hàng)
//  Tiền thu khách hàng lấy tự động từ phiếu thu đơn hàng đã được kế toán xác nhận
// =====================================================================

export function CashEntryModal({ kind, entry, onClose, onDelete }: { kind: CashEntry['kind']; entry?: CashEntry; onClose: () => void; onDelete?: () => void }) {
  const { me, cashEntries, setCashEntries, jobs, customers, notify, audit } = useApp();
  const [f, setF] = useState<CashEntry>(entry ?? { id: uid('ce'), code: '', kind, date: todayISO(), account: 'CASH', toAccount: 'BANK', category: kind === 'IN' ? CASH_IN_CATS[0] : kind === 'OUT' ? CASH_OUT_CATS[0] : 'Chuyển quỹ', amount: 0, by: me.id, at: Date.now() });
  const cats = f.kind === 'IN' ? CASH_IN_CATS : CASH_OUT_CATS;
  const activeJobs = jobs.filter((j) => j.wonAt && !j.lostAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const save = () => {
    if (f.amount <= 0) return notify('Nhập số tiền', 'red');
    if (f.kind === 'TRANSFER' && f.account === f.toAccount) return notify('Chọn hai quỹ khác nhau', 'red');
    const prefix = f.kind === 'IN' ? 'PTQ' : f.kind === 'OUT' ? 'PCQ' : 'CQ';
    const x: CashEntry = { ...f, source: f.source ?? 'MANUAL', code: f.code || nextCode(cashEntries.filter((e) => e.code.startsWith(`${prefix}-`)).map((e) => e.code), `${prefix}-${f.date.slice(0, 4)}-`, 4), partner: f.partner?.trim() || undefined, note: f.note?.trim() || undefined };
    setCashEntries((all) => (all.some((e) => e.id === x.id) ? all.map((e) => (e.id === x.id ? x : e)) : [x, ...all]));
    audit('CASH_' + x.kind, `${x.code}: ${vnd(x.amount)} ${x.category}`);
    notify(`Đã lưu ${x.code}`, 'teal');
    onClose();
  };
  const title = f.kind === 'IN' ? 'Phiếu thu' : f.kind === 'OUT' ? 'Phiếu chi' : 'Chuyển quỹ';
  return (
    <Modal title={entry ? `Sửa ${entry.code}` : title} onClose={onClose} footer={<>{entry && onDelete && <button className={cn(btnGhost, 'mr-auto hover:text-[rgb(var(--danger-fg))]')} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden />Xóa phiếu</button>}<button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày"><input className={inputCls} type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Số tiền *"><MoneyInput value={f.amount} onChange={(n) => setF({ ...f, amount: n })} /></Field>
        <Field label={f.kind === 'TRANSFER' ? 'Từ quỹ' : 'Quỹ'}><select className={inputCls} value={f.account} onChange={(e) => setF({ ...f, account: e.target.value as CashAccount })}>{(Object.keys(CASH_ACCOUNT) as CashAccount[]).map((a) => <option key={a} value={a}>{CASH_ACCOUNT[a]}</option>)}</select></Field>
        {f.kind === 'TRANSFER'
          ? <Field label="Sang quỹ"><select className={inputCls} value={f.toAccount} onChange={(e) => setF({ ...f, toAccount: e.target.value as CashAccount })}>{(Object.keys(CASH_ACCOUNT) as CashAccount[]).map((a) => <option key={a} value={a}>{CASH_ACCOUNT[a]}</option>)}</select></Field>
          : <Field label="Khoản mục"><select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>}
        {f.kind !== 'TRANSFER' && <Field label={f.kind === 'IN' ? 'Người nộp' : 'Người nhận / NCC'} className="col-span-2"><input className={inputCls} value={f.partner ?? ''} onChange={(e) => setF({ ...f, partner: e.target.value })} /></Field>}
        {f.kind === 'OUT' && (
          <Field label="Tính vào chi phí đơn hàng" className="col-span-2">
            <select className={inputCls} value={f.jobId ?? ''} onChange={(e) => setF({ ...f, jobId: e.target.value || undefined })}>
              <option value="">Chi phí chung</option>
              {activeJobs.map((j) => <option key={j.id} value={j.id}>{j.code}: {jobCustName(j, customers)}, {j.title}</option>)}
            </select>
          </Field>
        )}
        <Field label="Diễn giải" className="col-span-2"><input className={inputCls} value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function CashbookModule() {
  const { cashEntries, setCashEntries, receipts, jobs, customers, mfgConfig, setMfgConfig, range, canDo, openJob, stockMoves, workOrders, activities, users, company, audit, notify } = useApp();
  const mode = bizMode(company);
  const [acc, setAcc] = useState<'ALL' | CashAccount>('CASH');
  const [tab, setTab] = useSticky<'book' | 'summary'>('CashbookModule.tab', 'book');
  const [kind, setKind] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [cat, setCat] = useState('ALL');
  const [partner, setPartner] = useState('ALL');
  const [q, setQ] = useSticky('CashbookModule.q', '');
  const [modal, setModal] = useState<{ kind: CashEntry['kind']; entry?: CashEntry } | null>(null);
  useIntent('cash.in', () => setModal({ kind: 'IN' }));
  useIntent('cash.out', () => setModal({ kind: 'OUT' }));
  const [opening, setOpening] = useState<{ cash: number; bank: number } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const can = canDo('cash.manage');
  const { start, end } = rangeBounds(range);
  const fromISO = iso(new Date(start)), toISO = iso(new Date(end));
  const prevISO = iso(new Date(start - 864e5));
  const all = cashLines(cashEntries, receipts, jobs, customers, activities, users);
  const openOf = (a: CashAccount) => (a === 'CASH' ? mfgConfig.openingCash : mfgConfig.openingBank);
  const balance = (a: 'ALL' | CashAccount, until?: string): number => (a === 'ALL' ? balance('CASH', until) + balance('BANK', until)
    : openOf(a) + all.filter((l) => l.account === a && (!until || l.date <= until)).reduce((s, l) => s + (l.kind === 'IN' ? l.amount : -l.amount), 0));
  const inAcc = (l: CashLine) => (acc === 'ALL' ? l.category !== 'Chuyển quỹ' : l.account === acc);
  const period = all.filter((l) => l.date >= fromISO && l.date <= toISO && inAcc(l)).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const openBal = balance(acc, prevISO);
  const sumIn = period.filter((l) => l.kind === 'IN').reduce((s, l) => s + l.amount, 0);
  const sumOut = period.filter((l) => l.kind === 'OUT').reduce((s, l) => s + l.amount, 0);
  const running = new Map<string, number>();
  period.reduce((b, l) => { const nb = b + (l.kind === 'IN' ? l.amount : -l.amount); running.set(l.id, nb); return nb; }, openBal);
  const cats = Array.from(new Set(period.map((l) => l.category))).sort();
  const partners = Array.from(new Set(period.map((l) => l.partner).filter((x): x is string => !!x))).sort();
  const t = q.trim().toLowerCase();
  const list = period.filter((l) => (kind === 'ALL' || l.kind === kind) && (cat === 'ALL' || l.category === cat) && (partner === 'ALL' || l.partner === partner)
    && (!t || `${l.code} ${l.category} ${l.partner ?? ''} ${l.note ?? ''} ${l.ref ?? ''}`.toLowerCase().includes(t)));
  const paged = usePaged(list, 25);
  const filtered = kind !== 'ALL' || cat !== 'ALL' || partner !== 'ALL' || !!t;
  const months = lastMonths(6).map((m) => ({
    name: m.label,
    Thu: all.filter((l) => inAcc(l) && l.kind === 'IN' && l.date.slice(0, 7) === m.key).reduce((s, l) => s + l.amount, 0),
    Chi: all.filter((l) => inAcc(l) && l.kind === 'OUT' && l.date.slice(0, 7) === m.key).reduce((s, l) => s + l.amount, 0),
  }));
  const byCat = Array.from(new Set(period.map((l) => `${l.kind}|${l.category}`))).map((k) => { const [kd, c] = k.split('|'); return { kd, c, v: period.filter((l) => l.kind === kd && l.category === c).reduce((s, l) => s + l.amount, 0), n: period.filter((l) => l.kind === kd && l.category === c).length }; })
    .sort((a, b) => (a.kd === b.kd ? b.v - a.v : a.kd === 'IN' ? -1 : 1));
  const jobRows = mode === 'TRADING' ? [] : jobs.filter((j) => j.wonAt && !j.lostAt).map((j) => {
    const thu = receipts.filter((r) => r.jobId === j.id && r.status === 'CONFIRMED').reduce((s, r) => s + r.amount, 0);
    const c = jobActualCost(j, stockMoves, cashEntries, workOrders);
    return { j, thu, ...c, net: thu - c.total };
  }).filter((r) => r.thu || r.total).sort((a, b) => b.thu - a.thu);
  const entryOf = (l: CashLine) => cashEntries.find((e) => e.id === l.entryId);
  const accLabel = acc === 'ALL' ? 'hai sổ' : CASH_ACCOUNT[acc].toLowerCase();
  const saveOpening = () => {
    if (!opening) return;
    setMfgConfig((c) => ({ ...c, openingCash: opening.cash, openingBank: opening.bank }));
    audit('CASH_OPENING', `Số dư đầu: tiền mặt ${vnd(opening.cash)}, ngân hàng ${vnd(opening.bank)}`, 'WARN');
    notify('Đã cập nhật số dư đầu', 'teal');
    setOpening(null);
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label="Sổ quỹ">
        {([['CASH', 'Quỹ tiền mặt', Wallet], ['BANK', 'Tài khoản ngân hàng', Building2], ['ALL', 'Tổng hợp 2 sổ', Coins]] as const).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={acc === k} onClick={() => { setAcc(k); paged.setPage(1); }}
            className={cn('flex items-center gap-3 rounded-md border p-3 text-left transition-colors', acc === k ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)]' : 'border-[rgb(var(--line))] bg-[rgb(var(--surface))] hover:bg-[rgb(var(--raised))]')}>
            <Icon className={cn('h-5 w-5 shrink-0', acc === k ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--muted))]')} aria-hidden />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-[rgb(var(--muted))]">Số dư hiện tại</span></span>
            <b className="tabular-nums">{compact(balance(k))}</b>
          </button>
        ))}
      </div>
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Số dư đầu kỳ" value={compact(openBal)} icon={History} color={C.blue} sub={`Ngày ${fmtDate(fromISO)}, ${accLabel}`} />
        <StatCard label="Tổng thu" value={compact(sumIn)} icon={ArrowDown} color={C.teal} sub={`${period.filter((l) => l.kind === 'IN').length} phiếu, tự sinh ${compact(period.filter((l) => l.kind === 'IN' && l.auto).reduce((s, l) => s + l.amount, 0))}`} />
        <StatCard label="Tổng chi" value={compact(sumOut)} icon={ArrowUp} color={C.red} sub={`${period.filter((l) => l.kind === 'OUT').length} phiếu trong kỳ`} />
        <StatCard label="Số dư cuối kỳ" value={compact(openBal + sumIn - sumOut)} icon={Wallet} color={openBal + sumIn - sumOut < 0 ? C.red : C.orange} sub={`Thu − chi trong kỳ ${compact(sumIn - sumOut)}`} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs variant="pill" tabs={[{ id: 'book', label: 'Sổ chi tiết' }, { id: 'summary', label: mode === 'TRADING' ? 'Tổng hợp' : 'Tổng hợp & theo đơn hàng' }]} value={tab} onChange={setTab} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button className={cn(btnBase, btnSm, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))]')} disabled={!can} onClick={() => setModal({ kind: 'IN' })}><Plus className="h-3.5 w-3.5" aria-hidden />Phiếu thu</button>
          <button className={cn(btnPrimary, btnSm)} disabled={!can} onClick={() => setModal({ kind: 'OUT' })}><Plus className="h-3.5 w-3.5" aria-hidden />Phiếu chi</button>
          <button className={cn(btnGhost, btnSm)} disabled={!can} onClick={() => setModal({ kind: 'TRANSFER' })}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Chuyển quỹ</button>
          <button className={cn(btnGhost, btnSm)} disabled={!can} onClick={() => setOpening({ cash: mfgConfig.openingCash, bank: mfgConfig.openingBank })}><Pencil className="h-3.5 w-3.5" aria-hidden />Số dư đầu</button>
        </div>
      </div>
      {tab === 'book' ? (
        <Panel>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_150px_200px_200px_auto]">
            <SearchBox value={q} onChange={(v) => { setQ(v); paged.setPage(1); }} placeholder="Tìm số phiếu, diễn giải, chứng từ gốc" />
            <select className={inputCls} value={kind} onChange={(e) => { setKind(e.target.value as 'ALL' | 'IN' | 'OUT'); paged.setPage(1); }} aria-label="Loại"><option value="ALL">Thu và chi</option><option value="IN">Chỉ thu</option><option value="OUT">Chỉ chi</option></select>
            <select className={inputCls} value={cat} onChange={(e) => { setCat(e.target.value); paged.setPage(1); }} aria-label="Khoản mục"><option value="ALL">Mọi khoản mục</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <select className={inputCls} value={partner} onChange={(e) => { setPartner(e.target.value); paged.setPage(1); }} aria-label="Đối tượng"><option value="ALL">Mọi đối tượng nộp / nhận</option>{partners.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <button className={cn(btnGhost, 'justify-center')} onClick={() => downloadCsv(`so-quy-${acc}-${fromISO}-${toISO}.csv`, [['Ngày', 'Số phiếu', 'Sổ', 'Khoản mục', 'Đối tượng', 'Diễn giải', 'Chứng từ gốc', 'Thu', 'Chi', 'Tồn'], ...list.map((l) => [l.date, l.code, CASH_ACCOUNT[l.account], l.category, l.partner ?? '', l.note ?? '', l.ref ?? '', l.kind === 'IN' ? l.amount : '', l.kind === 'OUT' ? l.amount : '', acc === 'ALL' ? '' : running.get(l.id) ?? ''])])}><Download className="h-4 w-4" aria-hidden />CSV</button>
          </div>
          <Table head={['STT', 'Ngày', 'Số phiếu', 'Khoản mục', 'Diễn giải', 'Đối tượng', ...(acc === 'ALL' ? ['Sổ'] : []), <span key="t" className="block text-right">Thu</span>, <span key="c" className="block text-right">Chi</span>, ...(acc === 'ALL' ? [] : [<span key="b" className="block text-right">Tồn</span>])]} minW={1040}>
            {paged.page === 1 && !filtered && (
              <tr className="border-b border-[rgb(var(--line)/0.6)] bg-[rgb(var(--raised)/0.5)]">
                <td className={tdFirst} /><td className={cn(tdCls, 'font-mono text-xs')}>{fmtDate(fromISO)}</td><td className={tdCls} />
                {acc === 'ALL'
                  ? <td className={cn(tdLast, 'font-medium')} colSpan={6}>Số dư đầu kỳ hai sổ: <span className="tabular-nums">{openBal.toLocaleString('vi-VN')}</span></td>
                  : <><td className={cn(tdCls, 'font-medium')} colSpan={5}>Số dư đầu kỳ</td><td className={cn(tdLast, 'text-right font-semibold tabular-nums')}>{openBal.toLocaleString('vi-VN')}</td></>}
              </tr>
            )}
            {paged.slice.map((l, i) => {
              const e = entryOf(l);
              const editable = !!e && can && (!e.source || e.source === 'MANUAL');
              return (
                <tr key={l.id} className={cn(rowCls, (editable || l.jobId) && 'cursor-pointer')} onClick={() => (editable && e ? setModal({ kind: e.kind, entry: e }) : l.jobId && openJob(l.jobId))}>
                  <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{(paged.page - 1) * 25 + i + 1}</td>
                  <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(l.date)}</td>
                  <td className={tdCls} title={l.auto ? `Phiếu tự sinh${l.ref && l.ref !== l.code ? ` từ ${l.ref}` : ''}` : undefined}><Code>{l.code}</Code>{l.auto && <span className="ml-1.5 text-[11px] text-[rgb(var(--muted))]">tự sinh</span>}</td>
                  <td className={tdCls}><span className="font-medium">{l.category}</span></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[260px] truncate" title={l.note}>{l.note || '—'}</span></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[200px] truncate" title={l.partner}>{l.partner ?? '—'}</span></td>
                  {acc === 'ALL' && <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{l.account === 'CASH' ? 'Tiền mặt' : 'Ngân hàng'}</td>}
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums text-[rgb(var(--success-fg))]')}>{l.kind === 'IN' ? l.amount.toLocaleString('vi-VN') : ''}</td>
                  <td className={cn(acc === 'ALL' ? tdLast : tdCls, 'whitespace-nowrap text-right tabular-nums text-[rgb(var(--danger-fg))]')}>{l.kind === 'OUT' ? l.amount.toLocaleString('vi-VN') : ''}</td>
                  {acc !== 'ALL' && <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums', (running.get(l.id) ?? 0) < 0 && 'text-[rgb(var(--danger-fg))]')}>{(running.get(l.id) ?? 0).toLocaleString('vi-VN')}</td>}
                </tr>
              );
            })}
            {list.length > 0 && (
              <tr className="border-t border-[rgb(var(--line))] font-semibold">
                <td className={tdFirst} colSpan={acc === 'ALL' ? 7 : 6}>{filtered ? 'Cộng các dòng đang lọc' : 'Cộng phát sinh trong kỳ'}</td>
                <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--success-fg))]')}>{list.filter((l) => l.kind === 'IN').reduce((s, l) => s + l.amount, 0).toLocaleString('vi-VN')}</td>
                <td className={cn(acc === 'ALL' ? tdLast : tdCls, 'text-right tabular-nums text-[rgb(var(--danger-fg))]')}>{list.filter((l) => l.kind === 'OUT').reduce((s, l) => s + l.amount, 0).toLocaleString('vi-VN')}</td>
                {acc !== 'ALL' && <td className={cn(tdLast, 'text-right tabular-nums')}>{filtered ? '' : (openBal + sumIn - sumOut).toLocaleString('vi-VN')}</td>}
              </tr>
            )}
          </Table>
          {!list.length && <EmptyState text={<>Không có phát sinh trong kỳ.</>} art="ledger" />}
          <Pagination paged={paged} unit="dòng" />
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">Phiếu tự sinh: thu tiền khách khi kế toán xác nhận phiếu thu, chi công tác phí / triển khai sự kiện khi kế toán xác nhận thanh toán, hoa hồng khi quyết toán, thặng dư quỹ MDF khi hạch toán. Phiếu tự sinh không sửa trực tiếp, điều chỉnh bằng phiếu thu / chi bù.</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title={`Thu chi 6 tháng (${accLabel})`}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="name" stroke={C.muted} fontSize={12} />
                  <YAxis stroke={C.muted} fontSize={11} tickFormatter={(v) => compact(Number(v))} width={64} />
                  <Tooltip {...tipStyle} formatter={(v) => vnd(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Thu" fill={C.teal} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Chi" fill={C.red} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Theo khoản mục (trong kỳ)">
            <Table head={['Khoản mục', 'Loại', 'Số phiếu', <span key="v" className="block text-right">Số tiền</span>]} minW={460}>
              {byCat.map((r) => (
                <tr key={`${r.kd}${r.c}`} className={rowCls}>
                  <td className={tdFirst}>{r.c}</td>
                  <td className={tdCls}><Chip tone={r.kd === 'IN' ? 'teal' : 'red'}>{r.kd === 'IN' ? 'Thu' : 'Chi'}</Chip></td>
                  <td className={cn(tdCls, 'tabular-nums')}>{r.n}</td>
                  <td className={cn(tdLast, 'text-right tabular-nums')}>{vnd(r.v)}</td>
                </tr>
              ))}
            </Table>
          </Panel>
          {jobRows.length > 0 && (
            <Panel title="Dòng tiền theo đơn hàng" className="xl:col-span-2">
              <Table head={['STT', 'Đơn hàng', 'Giá trị HĐ', 'Đã thu (xác nhận)', 'Vật tư xuất kho', 'Chi phí khác', 'Chênh lệch thu - chi']} minW={980}>
                {jobRows.map((r, i) => (
                  <tr key={r.j.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => openJob(r.j.id)}>
                    <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{i + 1}</td>
                    <td className={tdCls}><p className="font-medium">{jobCustName(r.j, customers)}</p><p className="text-xs text-[rgb(var(--muted))]">{r.j.code}, {r.j.title}</p></td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.j.contractValue ?? 0)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums text-[rgb(var(--success-fg))]')}>{compact(r.thu)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.material)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.other)}</td>
                    <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums font-semibold', r.net < 0 ? 'text-[rgb(var(--danger-fg))]' : '')}>{compact(r.net)}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}
        </div>
      )}
      {modal && <CashEntryModal kind={modal.kind} entry={modal.entry} onClose={() => setModal(null)} onDelete={modal.entry ? () => setConfirm({ title: `Xóa ${modal.entry!.code}`, message: 'Xóa phiếu này khỏi sổ quỹ?', onConfirm: () => { removeWithUndo(setCashEntries, modal.entry!, notify, `Đã xóa phiếu ${modal.entry!.code}`); setModal(null); } }) : undefined} />}
      {opening && (
        <Modal title="Số dư đầu sổ quỹ" onClose={() => setOpening(null)} footer={<><button className={btnGhost} onClick={() => setOpening(null)}>Hủy</button><button className={btnPrimary} onClick={saveOpening}>Lưu</button></>}>
          <div className="space-y-3">
            <Field label="Quỹ tiền mặt"><MoneyInput value={opening.cash} onChange={(n) => setOpening({ ...opening, cash: n })} /></Field>
            <Field label="Tài khoản ngân hàng"><MoneyInput value={opening.bank} onChange={(n) => setOpening({ ...opening, bank: n })} /></Field>
            <p className="text-xs text-[rgb(var(--muted))]">Số dư tại ngày bắt đầu dùng sổ; số dư đầu từng kỳ hệ thống tự tính từ đây.</p>
          </div>
        </Modal>
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

