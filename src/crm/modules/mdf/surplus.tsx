'use client';

import { useState } from 'react';
import { Pencil, PiggyBank, Scale, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Chip, Field, MoneyInput, Panel, ProgressBar, StatCard } from '../../components/ui';
import { claimFinance, marginSummary } from '../../lib/business';
import { btnGhost, btnPrimary, btnSm, C, compact, digits, inputCls, SETTLEMENT_LABEL, SURPLUS_LABEL, uid, useApp, vnd } from '../../lib/core';
import type { Claim, CostLine, SurplusAllocation } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  THẶNG DƯ QUỸ MDF — đối soát 2 tầng (mức 3M duyệt vs thực chi nhà cung cấp)
//  Chỉ vai trò có quyền 'mdf.margin' (mặc định BOD, Kế toán) xem được số thực chi.
// =====================================================================

export function MarginBadge({ c }: { c: Claim }) {
  const f = claimFinance(c);
  if (!f.hasActual) return <span className="text-xs text-[rgb(var(--muted))]">Chưa nhập thực chi</span>;
  if (f.settlement === 'ACTUAL_COST') return f.returned > 0 ? <Chip>Hoàn quỹ {compact(f.returned)}</Chip> : <span className="text-xs text-[rgb(var(--muted))]">Hoàn ứng đủ</span>;
  if (f.mdfMargin < 0) return <Chip tone="red">Vượt duyệt {compact(-f.mdfMargin)}</Chip>;
  return <Chip tone="teal">Thặng dư Quỹ: +{compact(f.mdfMargin)} ({f.marginPct.toFixed(1).replace('.', ',')}%)</Chip>;
}

export function ClaimFinancePanel({ claim }: { claim: Claim }) {
  const { setClaims, canDo, notify } = useApp();
  const canSee = canDo('mdf.margin');
  const canEdit = (canDo('claim.accounting') || canDo('claim.submit')) && canSee;
  const f = claimFinance(claim);
  const [draft, setDraft] = useState<CostLine>({ id: '', item: '', supplier: '', approved: 0, actual: 0, invoiceNo: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const update = (p: Partial<Claim>) => setClaims((all) => all.map((c) => (c.id === claim.id ? { ...c, ...p } : c)));
  const lines = claim.costLines ?? [];
  const sumApproved = lines.reduce((s, l) => s + l.approved, 0);

  // Sales Rep: chỉ thấy ngân sách danh nghĩa
  if (!canSee) {
    return (
      <section className="rounded-md border border-[rgb(var(--line))] p-4">
        <h3 className="mb-2 text-sm font-semibold">Ngân sách chương trình</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-xs text-[rgb(var(--muted))]">3M duyệt</p><p className="mt-0.5 font-semibold tabular-nums">{vnd(f.vendorApprovedBudget)}</p></div>
          <div><p className="text-xs text-[rgb(var(--muted))]">Số claim</p><p className="mt-0.5 font-semibold tabular-nums">{vnd(claim.claimed)}</p></div>
        </div>
      </section>
    );
  }

  const saveLine = () => {
    if (draft.item.trim().length < 3 || !draft.supplier.trim() || draft.approved < 0 || draft.actual <= 0) return notify('Nhập hạng mục, nhà cung cấp và chi phí thực tế', 'red');
    const line = { ...draft, id: editingId ?? uid('cl'), item: draft.item.trim(), supplier: draft.supplier.trim() };
    update({ costLines: editingId ? lines.map((l) => (l.id === editingId ? line : l)) : [...lines, line] });
    setDraft({ id: '', item: '', supplier: '', approved: 0, actual: 0, invoiceNo: '' });
    setEditingId(null);
  };

  return (
    <section className="rounded-md border border-[rgb(var(--line))] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Scale className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Đối soát chi phí 2 tầng</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={f.settlement === 'LUMP_SUM' ? 'orange' : 'blue'}>{SETTLEMENT_LABEL[f.settlement]}</Chip>
          <MarginBadge c={claim} />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded bg-[rgb(var(--raised))] p-2.5"><p className="text-[11px] text-[rgb(var(--muted))]">3M duyệt (nộp claim)</p><p className="font-semibold tabular-nums">{compact(f.vendorApprovedBudget)}</p></div>
        <div className="rounded bg-[rgb(var(--raised))] p-2.5"><p className="text-[11px] text-[rgb(var(--muted))]">Thực chi triển khai</p><p className="font-semibold tabular-nums">{f.hasActual ? compact(f.actualExecutionCost) : '—'}</p></div>
        <div className="rounded bg-[rgb(var(--raised))] p-2.5">
          <p className="text-[11px] text-[rgb(var(--muted))]">{f.settlement === 'LUMP_SUM' ? 'Thặng dư quỹ' : 'Hoàn lại quỹ'}</p>
          <p className={cn('font-semibold tabular-nums', f.settlement === 'LUMP_SUM' ? (f.mdfMargin >= 0 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]') : 'text-[rgb(var(--fg))]')}>{f.hasActual ? compact(f.settlement === 'LUMP_SUM' ? f.mdfMargin : f.returned) : '—'}</p>
        </div>
      </div>

      <div className="-mx-4 overflow-x-auto">
        <table className="dt w-full min-w-[620px] text-sm">
          <thead className="text-xs text-[rgb(var(--muted))]">
            <tr className="border-b border-[rgb(var(--line))] text-left">
              <th className="py-2 pl-4 pr-2 font-medium">Hạng mục chi</th>
              <th className="px-2 py-2 font-medium">Nhà cung cấp</th>
              <th className="px-2 py-2 text-right font-medium">Mức 3M duyệt</th>
              <th className="px-2 py-2 text-right font-medium">Thực chi NCC</th>
              <th className="px-2 py-2 text-right font-medium">Chênh lệch</th>
              <th className="py-2 pl-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-[rgb(var(--line)/0.6)]">
                <td className="py-2 pl-4 pr-2">{l.item}{l.invoiceNo && <span className="block text-[11px] text-[rgb(var(--muted))]">HĐ {l.invoiceNo}</span>}</td>
                <td className="px-2 py-2 text-[rgb(var(--muted))]">{l.supplier}</td>
                <td className="px-2 py-2 text-right tabular-nums">{compact(l.approved)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{compact(l.actual)}</td>
                <td className={cn('px-2 py-2 text-right tabular-nums', l.approved - l.actual >= 0 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>{l.approved - l.actual >= 0 ? '+' : ''}{compact(l.approved - l.actual)}</td>
                <td className="whitespace-nowrap py-2 pl-2 pr-4 text-right">
                  <button className="mr-2 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-40" disabled={!canEdit} onClick={() => { setDraft(l); setEditingId(l.id); }} aria-label={`Sửa ${l.item}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))] disabled:opacity-40" disabled={!canEdit} onClick={() => update({ costLines: lines.filter((x) => x.id !== l.id) })} aria-label={`Xóa ${l.item}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
            {lines.length > 0 && (
              <tr className="font-semibold">
                <td className="py-2 pl-4 pr-2" colSpan={2}>Tổng cộng</td>
                <td className={cn('px-2 py-2 text-right tabular-nums', sumApproved !== f.vendorApprovedBudget && 'text-[rgb(var(--accent-fg))]')} title={sumApproved !== f.vendorApprovedBudget ? `Khác mức 3M duyệt ${vnd(f.vendorApprovedBudget)}` : undefined}>{compact(sumApproved)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{compact(f.actualExecutionCost)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-[rgb(var(--success-fg))]">{compact(sumApproved - f.actualExecutionCost)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!lines.length && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Field label="Chi phí thực tế tổng (chưa tách theo nhà cung cấp)" className="min-w-[220px] flex-1"><MoneyInput disabled={!canEdit} value={claim.actualCost ?? 0} onChange={(n) => update({ actualCost: n })} /></Field>
        </div>
      )}
      {canEdit && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded bg-[rgb(var(--raised))] p-3 sm:grid-cols-6">
          <input className={cn(inputCls, 'col-span-2 py-1.5 text-xs')} placeholder="Hạng mục chi" value={draft.item} onChange={(e) => setDraft({ ...draft, item: e.target.value })} />
          <input className={cn(inputCls, 'py-1.5 text-xs')} placeholder="Nhà cung cấp" value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })} />
          <input className={cn(inputCls, 'py-1.5 text-xs tabular-nums')} inputMode="numeric" placeholder="Mức 3M duyệt" value={draft.approved ? new Intl.NumberFormat('vi-VN').format(draft.approved) : ''} onChange={(e) => setDraft({ ...draft, approved: digits(e.target.value) })} />
          <input className={cn(inputCls, 'py-1.5 text-xs tabular-nums')} inputMode="numeric" placeholder="Thực chi" value={draft.actual ? new Intl.NumberFormat('vi-VN').format(draft.actual) : ''} onChange={(e) => setDraft({ ...draft, actual: digits(e.target.value) })} />
          <div className="flex gap-1">
            <input className={cn(inputCls, 'min-w-0 py-1.5 text-xs')} placeholder="Số HĐ" value={draft.invoiceNo ?? ''} onChange={(e) => setDraft({ ...draft, invoiceNo: e.target.value })} />
            <button className={cn(btnPrimary, 'px-2 py-1 text-xs')} onClick={saveLine}>{editingId ? 'Lưu' : 'Thêm'}</button>
          </div>
        </div>
      )}

      {f.settlement === 'LUMP_SUM' && f.mdfMargin > 0 && (
        <fieldset className="mt-4">
          <legend className="mb-2 text-xs font-medium text-[rgb(var(--muted))]">Phân bổ thặng dư {compact(f.mdfMargin)}</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(SURPLUS_LABEL) as SurplusAllocation[]).map((k) => (
              <label key={k} className={cn('flex cursor-pointer items-center gap-2 rounded border px-3 py-2.5 text-sm', claim.surplusAllocation === k ? 'border-[rgb(var(--success))] bg-[rgb(var(--success)/0.1)]' : 'border-[rgb(var(--line))] hover:bg-[rgb(var(--raised))]', !canEdit && 'cursor-not-allowed opacity-60')}>
                <input type="radio" name={`surplus-${claim.id}`} className="accent-[rgb(var(--success))]" disabled={!canEdit} checked={claim.surplusAllocation === k} onChange={() => { update({ surplusAllocation: k }); notify(`Thặng dư ${claim.code}: ${SURPLUS_LABEL[k]}`, 'teal'); }} />
                {SURPLUS_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {f.settlement === 'ACTUAL_COST' && (
        <div className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
          <p>Hạng mục hoàn ứng theo chi phí thực tế: số claim tối đa bằng chi phí có hóa đơn, phần 3M duyệt chưa chi trả về quỹ, không ghi nhận lợi nhuận. Đổi hình thức quyết toán ở Cài đặt &gt; Quỹ Hãng 3M nếu hợp đồng với 3M là khoán.</p>
          {f.hasActual && claim.claimed > f.actualExecutionCost && !claim.submitted && (
            <button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => { update({ claimed: f.actualExecutionCost }); notify(`Đã điều chỉnh số claim ${claim.code} bằng thực chi ${compact(f.actualExecutionCost)}`, 'teal'); }}>Điều chỉnh số claim bằng thực chi</button>
          )}
        </div>
      )}
    </section>
  );
}

/** KPI "Lợi nhuận ròng từ Quỹ MDF" và biểu đồ cơ cấu: 3M cấp -> thực chi -> thặng dư giữ lại */
export function MdfMarginPanel() {
  const { claims } = useApp();
  const m = marginSummary(claims);
  const data = [
    { name: 'Tổng 3M duyệt', value: m.approved, color: C.blue },
    { name: 'Thực chi sự kiện', value: m.actual, color: C.orange },
    { name: 'Thặng dư giữ lại', value: m.margin, color: C.teal },
    { name: 'Hoàn lại quỹ', value: m.returned, color: C.muted },
  ];
  const tooltip = { contentStyle: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text }, labelStyle: { color: C.muted } };
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-3">
        <StatCard label="Lợi nhuận quỹ" value={compact(m.margin)} icon={PiggyBank} color={C.teal} sub={`Biên thặng dư ${m.pct.toFixed(1).replace('.', ',')}% trên mức 3M duyệt, từ đầu năm`} />
        <div className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4 text-sm">
          <p className="mb-2 text-xs font-medium text-[rgb(var(--muted))]">Phân bổ thặng dư</p>
          {[
            [SURPLUS_LABEL.COMPANY_PROFIT, m.profit, C.teal],
            [SURPLUS_LABEL.REINVEST, m.reinvest, C.blue],
            ['Chờ phân bổ', m.pending, C.orange],
          ].map(([k, v, col]) => (
            <div key={k as string} className="mb-2 last:mb-0">
              <div className="mb-1 flex justify-between gap-2"><span className="text-[rgb(var(--muted))]">{k}</span><span className="tabular-nums">{compact(v as number)}</span></div>
              <ProgressBar value={v as number} max={m.margin || 1} tone={col as string} />
            </div>
          ))}
        </div>
      </div>
      <Panel title="Cơ cấu quỹ: 3M duyệt, thực chi, thặng dư" className="xl:col-span-2">
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={C.line} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => compact(Number(v))} />
              <YAxis type="category" dataKey="name" stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} width={120} />
              <Tooltip {...tooltip} formatter={(v) => vnd(Number(v))} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--muted))]">Chỉ tính hồ sơ đã nhập thực chi. Thặng dư chỉ phát sinh ở hạng mục khoán theo hoạt động; hạng mục hoàn ứng theo chi phí thực tế trả phần dư về quỹ.</p>
      </Panel>
    </div>
  );
}

