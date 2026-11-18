'use client';

import { type ReactNode, useState } from 'react';
import { Chip, EmptyState, Field, Panel, Table } from '../../components/ui';
import { claimFinance } from '../../lib/business';
import { btnPrimary, btnSm, CASH_ACCOUNT, compact, fmtDate, inputCls, rowCls, SURPLUS_LABEL, tdCls, tdFirst, tdLast, useApp, vnd } from '../../lib/core';
import type { CashAccount, Claim } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  QUYẾT TOÁN QUỸ MDF (VASSH): 3M duyệt -> hóa đơn VAT đầu vào -> Credit Note -> cấn trừ PO; hạch toán thặng dư vào sổ quỹ
// =====================================================================

export function MdfSettlementPanel({ claim }: { claim: Claim }) {
  const { setClaims, pos, canDo, postCash, audit, notify, cashEntries } = useApp();
  const [account, setAccount] = useState<CashAccount>('BANK');
  const f = claimFinance(claim);
  const can = canDo('claim.accounting');
  const update = (p: Partial<Claim>) => setClaims((all) => all.map((c) => (c.id === claim.id ? { ...c, ...p } : c)));
  const po = pos.find((p) => p.id === claim.offsetPoId);
  const posted = cashEntries.find((e) => e.id === claim.surplusEntryId || (e.source === 'MDF_SURPLUS' && e.sourceId === claim.id));
  const surplus = f.settlement === 'LUMP_SUM' ? Math.max(0, f.mdfMargin) : 0;
  const steps: { label: string; value: ReactNode; done: boolean; note?: string }[] = [
    { label: 'Tiền Hãng duyệt', value: claim.vendorApproved != null ? vnd(claim.vendorApproved) : 'Chưa duyệt', done: claim.vendorApproved != null, note: `Claim ${vnd(claim.claimed)}` },
    { label: 'Hóa đơn VAT đầu vào', value: claim.invoice ? vnd(claim.invoice.amount) : 'Chưa có', done: !!claim.invoice, note: claim.invoice ? `${claim.invoice.serial}-${claim.invoice.number}, ${claim.vatCheck === 'MATCHED' ? 'khớp' : claim.vatCheck === 'MISMATCH' ? 'lệch' : 'chưa đối soát'}` : undefined },
    { label: 'Credit Note từ 3M', value: claim.creditNote ? vnd(claim.creditNote.amount) : 'Chưa nhận', done: !!claim.creditNote, note: claim.creditNote ? `Số ${claim.creditNote.number}, ${fmtDate(claim.creditNote.date)}` : undefined },
    { label: 'Cấn trừ PO nhập khẩu', value: po ? po.code : claim.offset ? 'Đã cấn trừ' : 'Chưa cấn trừ', done: !!po || !!claim.offset, note: po ? `${po.vendor}, đặt ${fmtDate(po.orderDate)}` : undefined },
  ];
  const postSurplus = () => {
    if (surplus <= 0) return;
    const sourceId = claim.id;
    postCash({ kind: 'IN', account, category: 'Thặng dư quỹ MDF', amount: surplus, partner: '3M Việt Nam', ref: claim.code, note: `Thặng dư ${claim.code} (${SURPLUS_LABEL[claim.surplusAllocation ?? 'COMPANY_PROFIT'] ?? ''})`, source: 'MDF_SURPLUS', sourceId, claimId: claim.id });
    audit('MDF_SURPLUS_POST', `${claim.code}: hạch toán thặng dư ${vnd(surplus)} vào sổ quỹ`, 'WARN');
    notify(`Đã hạch toán thặng dư ${vnd(surplus)} vào sổ quỹ ${CASH_ACCOUNT[account].toLowerCase()}`, 'teal');
  };
  return (
    <section className="rounded-md border border-[rgb(var(--line))] p-4">
      <h3 className="mb-3 text-sm font-semibold">Quyết toán dòng tiền quỹ MDF</h3>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.label} className={cn('rounded border p-2.5', s.done ? 'border-[rgb(var(--success)/0.4)] bg-[rgb(var(--success)/0.05)]' : 'border-[rgb(var(--line))] bg-[rgb(var(--raised))]')}>
            <p className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--muted))]"><span className={cn('flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-semibold', s.done ? 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] text-[rgb(var(--fg))]' : 'bg-[rgb(var(--line))] text-[rgb(var(--muted))]')}>{i + 1}</span>{s.label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{s.value}</p>
            {s.note && <p className="mt-0.5 text-[11px] text-[rgb(var(--muted))]">{s.note}</p>}
          </li>
        ))}
      </ol>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Credit Note cấn trừ vào PO">
          <select className={inputCls} disabled={!can || !claim.creditNote} value={claim.offsetPoId ?? ''} onChange={(e) => { update({ offsetPoId: e.target.value || undefined, offset: !!e.target.value || claim.offset }); if (e.target.value) audit('MDF_OFFSET_PO', `${claim.code}: cấn trừ vào PO ${pos.find((p) => p.id === e.target.value)?.code}`); }}>
            <option value="">{claim.creditNote ? 'Chọn PO nhập khẩu…' : 'Chờ nhận Credit Note'}</option>
            {pos.filter((p) => !p.cancelled).map((p) => <option key={p.id} value={p.id}>{p.code}: {p.vendor}, {fmtDate(p.orderDate)}</option>)}
          </select>
        </Field>
        {canDo('mdf.margin') && (
          <div className="rounded bg-[rgb(var(--raised))] p-3 text-sm">
            <p className="flex justify-between"><span className="text-[rgb(var(--muted))]">Thặng dư quỹ (MDF Profit Margin)</span><b className={cn('tabular-nums', surplus ? 'text-[rgb(var(--success-fg))]' : '')}>{f.hasActual ? vnd(surplus) : 'Chưa nhập thực chi'}</b></p>
            {posted ? <p className="mt-1 text-xs text-[rgb(var(--success-fg))]">Đã hạch toán vào sổ quỹ: {posted.code}, {fmtDate(posted.date)}</p>
              : surplus > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select className={cn(inputCls, 'w-auto py-1 text-xs')} value={account} onChange={(e) => setAccount(e.target.value as CashAccount)} aria-label="Sổ quỹ">{(Object.keys(CASH_ACCOUNT) as CashAccount[]).map((a) => <option key={a} value={a}>{CASH_ACCOUNT[a]}</option>)}</select>
                  <button className={cn(btnPrimary, btnSm)} disabled={!can || !claim.creditNote} title={!claim.creditNote ? 'Hạch toán sau khi nhận Credit Note' : undefined} onClick={postSurplus}>Hạch toán vào sổ quỹ</button>
                </div>
              )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Bảng tổng hợp quyết toán MDF toàn bộ claim (báo cáo kế toán VASSH) */
export function MdfSettlementReport() {
  const { claims, pos, cashEntries, openClaim, canDo } = useApp();
  const rows = claims.filter((c) => c.submitted || c.vendorApproved != null || c.creditNote);
  const seeMargin = canDo('mdf.margin');
  const sum = (fn: (c: Claim) => number) => rows.reduce((s, c) => s + fn(c), 0);
  const surplusOf = (c: Claim) => { const f = claimFinance(c); return f.settlement === 'LUMP_SUM' ? Math.max(0, f.mdfMargin) : 0; };
  const R = (x: ReactNode) => <span className="block text-right">{x}</span>;
  return (
    <Panel title="Đối soát quỹ MDF & thặng dư (MDF Arbitrage)" action={<p className="text-xs text-[rgb(var(--muted))]">Mức 3M duyệt → Thực chi NCC (HĐ VAT) → Thặng dư giữ lại → Credit Note → Cấn trừ PO → Sổ quỹ</p>}>
      <Table head={['Claim / chương trình', R('Mức 3M duyệt'), R('Thực chi NCC (HĐ VAT)'), ...(seeMargin ? [R('Thặng dư giữ lại')] : []), 'Credit Note', 'Cấn trừ vào PO', ...(seeMargin ? ['Sổ quỹ'] : [])]} minW={1080}>
        {rows.map((c) => {
          const f = claimFinance(c);
          const posted = cashEntries.find((e) => e.source === 'MDF_SURPLUS' && e.sourceId === c.id);
          const approved = c.vendorApproved ?? f.vendorApprovedBudget;
          const po = pos.find((p) => p.id === c.offsetPoId);
          const surplus = surplusOf(c);
          return (
            <tr key={c.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => openClaim(c.id)}>
              <td className={tdFirst}><p className="code-chip">{c.code}</p><p className="max-w-[240px] truncate text-xs text-[rgb(var(--muted))]">{c.programTitle}</p></td>
              <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{approved ? approved.toLocaleString('vi-VN') : '—'}<span className="block text-[11px] text-[rgb(var(--muted))]">{f.settlement === 'LUMP_SUM' ? 'Khoán trọn gói' : 'Theo thực chi'}</span></td>
              <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{f.hasActual ? f.actualExecutionCost.toLocaleString('vi-VN') : '—'}{c.invoice && <span className={cn('block text-[11px]', c.vatCheck === 'MISMATCH' ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')}>HĐ VAT {c.invoice.amount.toLocaleString('vi-VN')}{c.vatCheck === 'MISMATCH' ? ' · lệch' : ''}</span>}</td>
              {seeMargin && <td className={cn(tdCls, 'whitespace-nowrap text-right font-semibold tabular-nums', surplus > 0 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}>{surplus > 0 ? surplus.toLocaleString('vi-VN') : '—'}{surplus > 0 && approved > 0 && <span className="block text-[11px] font-normal">{((surplus / approved) * 100).toFixed(1)}%</span>}</td>}
              <td className={cn(tdCls, 'whitespace-nowrap text-xs')}>{c.creditNote ? <><Chip tone="teal">Đã nhận {compact(c.creditNote.amount)}</Chip><span className="mt-0.5 block text-[11px] text-[rgb(var(--muted))]">{c.creditNote.number}</span></> : <Chip tone="orange">Chờ Credit Note</Chip>}</td>
              <td className={cn(tdCls, 'whitespace-nowrap text-xs')}>{c.offset || po ? <Chip tone="teal">{po?.code ?? 'Đã cấn trừ'}</Chip> : c.creditNote ? <Chip tone="orange">Chưa cấn trừ</Chip> : <span className="text-[rgb(var(--muted))]">—</span>}</td>
              {seeMargin && <td className={cn(tdLast, 'whitespace-nowrap text-xs')}>{posted ? <Chip tone="teal">{posted.code}</Chip> : surplus > 0 ? <Chip tone="orange">Chưa hạch toán</Chip> : '—'}</td>}
            </tr>
          );
        })}
        {rows.length > 0 && (
          <tr className="border-t border-[rgb(var(--line))] font-semibold">
            <td className={tdFirst}>Cộng {rows.length} claim</td>
            <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{sum((c) => c.vendorApproved ?? claimFinance(c).vendorApprovedBudget).toLocaleString('vi-VN')}</td>
            <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{sum((c) => claimFinance(c).actualExecutionCost).toLocaleString('vi-VN')}</td>
            {seeMargin && <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums text-[rgb(var(--success-fg))]')}>{sum(surplusOf).toLocaleString('vi-VN')}</td>}
            <td className={cn(tdCls, 'whitespace-nowrap text-xs tabular-nums')}>{compact(sum((c) => c.creditNote?.amount ?? 0))}</td>
            <td className={tdCls} />
            {seeMargin && <td className={tdLast} />}
          </tr>
        )}
      </Table>
      {!rows.length && <EmptyState text={<>Chưa có claim đã nộp Hãng.</>} art="doc" />}
    </Panel>
  );
}

