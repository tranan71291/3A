'use client';

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Banknote, Building2, CalendarDays, Check as CheckIcon, ChevronDown, ChevronLeft, ChevronRight, Coins, Columns3, Download, Eye, FileText, Filter, Lock, MoreVertical, PackageMinus, Pencil, Plus, Printer, Receipt as ReceiptIcon, Search, Send, Trash2, Truck, Undo2, Users, Wallet, Warehouse, X, XCircle } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { RowMenu } from '../../components/controls';
import { Chip, Code, EmptyState, Field, MoneyInput, useSticky } from '../../components/ui';
import { addDaysISO, bizMode, btnBase, btnGhost, btnPrimary, btnSm, compact, DECISION_LABEL, digits, esc, fmtDate, fmtN, fold, inputBase, inputCls, iso, MAIN_WH, nextCode, overdueDays, PRICE_TIER, SALE_DELIVERY, SALE_F0, SALE_PAY, SALE_STAGE, SALE_STATUS, saleDue, saleIssQ, saleIssued, saleLineNet, salePaid, saleRetQ, soGrid, soIco, soTd, soTh, soTime, tierPrice, todayISO, uid, useApp, wfNeeds, wfReasons, whQty, WO_STAGE } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import { saleHeld, salePendingQ, saleReturned, saleStage, saleStock, saleTotals } from '../../lib/getfly';
import type { ApprovalDecision, CompanyInfo, Customer, PriceTier, SaleDelivery, SaleFilter, SaleLine, SaleLineKind, SaleNote, SalePay, SalePayExtra, SalePayment, SalePer, SalePick, SalesOrder, SaleStage, SaleStatus, SaleTab, SkuItem, SoStep, StockVoucher, User, VoucherStatus, WfSubject, WorkOrder } from '../../lib/types';
import { cn, wfApprovers, wfPath } from '../../lib/utils';
import { stockOf } from '../../lib/workshop';
import { SearchBox } from '../alux/orders';
import { useArItems } from '../finance/ar-aging';
import { docShell, moneyToWordsVN, printHtml } from './templates';
import { useApprovalQueue } from '../tasks/tasks';

/** Bản in phiếu bán hàng */
export function saleHtml(o: SalesOrder, company: CompanyInfo) {
  const t = saleTotals(o);
  const rows = o.lines.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${esc(l.name)}${l.note ? `<br><span class="small">${esc(l.note)}</span>` : ''}</td><td class="c">${esc(l.unit)}</td><td class="r">${fmtN(l.qty)}</td><td class="r">${fmtN(l.price)}</td><td class="r">${l.discountPct ? `${l.discountPct}%` : ''}</td><td class="c">${l.vat}%</td><td class="r">${fmtN(saleLineNet(l))}</td></tr>`).join('');
  const tax = t.groups.filter((g) => g.rate > 0).map((g) => `<tr><td colspan="7" class="r">Thuế GTGT ${g.rate}%</td><td class="r">${fmtN(g.vat)}</td></tr>`).join('');
  return `<p><b>${esc(company.legalName)}</b><br>${esc(company.address)}${company.taxCode ? `<br>MST: ${esc(company.taxCode)}` : ''}${company.phone ? ` · ĐT: ${esc(company.phone)}` : ''}</p>
<h1>PHIẾU BÁN HÀNG</h1><p class="c">Số ${esc(o.code)} · ngày ${fmtDate(o.date)}</p>
<p>Khách hàng: <b>${esc(o.customer)}</b>${o.taxCode ? `<br>MST: ${esc(o.taxCode)}` : ''}${o.phone ? `<br>Điện thoại: ${esc(o.phone)}` : ''}${o.address ? `<br>Địa chỉ: ${esc(o.address)}` : ''}</p>
<table class="items"><thead><tr><th>STT</th><th>Hàng hóa</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>CK</th><th>VAT</th><th>Thành tiền</th></tr></thead><tbody>${rows}
<tr><td colspan="7" class="r">Cộng tiền hàng</td><td class="r">${fmtN(t.net)}</td></tr>${tax}${t.ship ? `<tr><td colspan="7" class="r">Phí giao hàng</td><td class="r">${fmtN(t.ship)}</td></tr>` : ''}
<tr><td colspan="7" class="r"><b>Tổng thanh toán</b></td><td class="r"><b>${fmtN(t.grand)}</b></td></tr></tbody></table>
<p><b>Bằng chữ:</b> <i>${moneyToWordsVN(t.grand)}</i></p>
<p>Thanh toán: ${SALE_PAY[o.pay]}${o.pay === 'CREDIT' ? `, hạn ${fmtDate(saleDue(o))}` : ''} · Giao nhận: ${SALE_DELIVERY[o.delivery]}${o.deliverAt ? `, ${fmtDate(o.deliverAt)}` : ''}</p>
<table class="layout sign"><tr><td><b>NGƯỜI MUA HÀNG</b><br>(Ký, ghi rõ họ tên)<br><br><br><br></td><td><b>NGƯỜI BÁN HÀNG</b><br>(Ký, ghi rõ họ tên)<br><br><br><br></td></tr></table>`;
}

/** v50: đóng khung nổi khi bấm ra ngoài */
export function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(close);
  cb.current = close;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb.current(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') cb.current(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return ref;
}

/** Thanh tiêu đề trang đơn hàng: đường dẫn + nút thao tác */
export function SoTop({ crumb, title, onCrumb, chips, children }: { crumb?: string; title: ReactNode; onCrumb?: () => void; chips?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      {crumb && <button className="text-[14px] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={onCrumb}>{crumb} ›</button>}
      <h1 className="text-[19px] font-medium">{title}</h1>
      {chips}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function SoCard({ title, sub, action, children, pad = true, className }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; pad?: boolean; className?: string }) {
  return (
    <section className={cn('glass-card min-w-0 rounded-xl', pad && 'p-5', className)}>
      {(title || action) && <div className={cn('flex flex-wrap items-center gap-2', pad ? 'mb-3' : 'px-5 pb-3 pt-4')}>{title && <h2 className="text-[15px] font-medium">{title}</h2>}{sub && <span className="text-[12.5px] text-[rgb(var(--muted))]">{sub}</span>}{action && <span className="ml-auto flex items-center gap-2">{action}</span>}</div>}
      {children}
    </section>
  );
}

export function SoInfo({ label, children, span = 1 }: { label: string; children: ReactNode; span?: 1 | 2 | 4 }) {
  return (
    <div className={cn('min-w-0', span === 2 && 'sm:col-span-2', span === 4 && 'sm:col-span-2 xl:col-span-4')}>
      <p className="mb-1 text-[12.5px] text-[rgb(var(--muted))]">{label}</p>
      <div className="flex min-h-7 min-w-0 items-center gap-1.5 truncate text-[14px]">{children}</div>
    </div>
  );
}

/** Tab gạch chân (Hàng hóa / Chứng từ liên quan) */
export function SoTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex h-12 items-stretch gap-6" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cn('-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px] font-medium', value === t.id ? 'border-[rgb(var(--accent))] text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>
          {t.label}{t.count !== undefined && <span className="rounded-full bg-[rgb(var(--ink)/0.06)] px-1.5 text-[11px] font-normal tabular-nums text-[rgb(var(--fg2))]">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Dòng thời gian quy trình ở cột phải */
export function SoFlow({ steps }: { steps: SoStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={i} className="relative grid grid-cols-[24px_1fr] gap-2.5 pb-3.5 last:pb-0">
          {i < steps.length - 1 && <span className={cn('absolute left-[11px] top-6 bottom-0 w-0.5', s.state === 'done' ? 'bg-[rgb(var(--fg))]' : 'bg-[rgb(var(--line))]')} aria-hidden />}
          <span className={cn('relative z-[1] grid h-6 w-6 place-items-center rounded-full border-2', s.state === 'done' ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : s.state === 'now' ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] shadow-[0_0_0_3px_rgb(var(--accent)/0.2)]' : s.state === 'side' ? 'border-dashed border-[rgb(var(--faint))] bg-[rgb(var(--surface))]' : 'border-[rgb(var(--line))] bg-[rgb(var(--surface))]')}>{s.state === 'done' && <CheckIcon className="h-3 w-3" aria-hidden />}</span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-1.5 text-[13.5px]"><span className={cn(s.state === 'todo' ? 'text-[rgb(var(--muted))]' : 'font-medium')}>{s.label}</span>{s.at && <span className="text-[12px] text-[rgb(var(--muted))]">{s.at}</span>}{s.chip}</p>
            {s.sub && <div className="text-[12.5px] text-[rgb(var(--muted))]">{s.sub}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SoKv({ label, children, big, tone }: { label: string; children: ReactNode; big?: boolean; tone?: 'warn' }) {
  return <div className={cn('flex items-baseline justify-between gap-3 py-1 text-[13.5px]', big && 'mt-1 border-t border-[rgb(var(--line))] pt-2')}><span className="text-[rgb(var(--muted))]">{label}</span><span className={cn('tabular-nums', big && 'text-[20px] font-medium', tone === 'warn' && 'font-medium text-[rgb(var(--accent-fg))]')}>{children}</span></div>;
}

export function SoBar({ parts }: { parts: { pct: number; cls: string }[] }) {
  return <div className="flex h-1.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.07)]">{parts.map((p, i) => <i key={i} className={p.cls} style={{ width: `${Math.max(0, Math.min(100, p.pct))}%` }} />)}</div>;
}

/** Công nợ khách: đang nợ (+ đơn đang lập) so với hạn mức, quá hạn */
export function SoDebt({ customerId, extra = 0, exceptId }: { customerId?: string; extra?: number; exceptId?: string }) {
  const { customers, salesOrders } = useApp();
  const ar = useArItems();
  const c = customers.find((x) => x.id === customerId);
  if (!c) return <SoCard title="Công nợ khách"><p className="text-[13px] text-[rgb(var(--muted))]">Khách lẻ, không theo dõi công nợ</p></SoCard>;
  const mine = ar.filter((x) => x.customerId === c.id && x.outstanding > 0);
  const owe = mine.reduce((s, x) => s + x.outstanding, 0);
  const today = todayISO();
  const od = mine.filter((x) => overdueDays(x.dueDate, today) > 0);
  const odSum = od.reduce((s, x) => s + x.outstanding, 0);
  const odDays = Math.max(0, ...od.map((x) => overdueDays(x.dueDate, today)));
  const lim = c.creditLimit;
  const others = salesOrders.filter((o) => o.customerId === c.id && o.id !== exceptId && o.status !== 'CANCELLED').length;
  return (
    <SoCard title="Công nợ khách">
      <div className="flex items-baseline justify-between text-[13px]"><span className="text-[rgb(var(--muted))]">{extra ? 'Đang nợ + đơn này' : 'Đang nợ'}{lim > 0 ? ' / hạn mức' : ''}</span><span className="tabular-nums">{compact(owe + extra)}{lim > 0 ? ` / ${compact(lim)}` : ''}</span></div>
      {lim > 0 && <div className="mt-1.5"><SoBar parts={[{ pct: (owe / lim) * 100, cls: 'bg-[rgb(var(--fg))]' }, { pct: (extra / lim) * 100, cls: 'bg-[rgb(var(--accent)/0.55)]' }]} /></div>}
      <div className="mt-2">
        <SoKv label="Đang nợ">{fmtN(owe)}</SoKv>
        <SoKv label="Quá hạn" tone={odSum > 0 ? 'warn' : undefined}>{odSum > 0 ? `${fmtN(odSum)} · ${odDays} ngày` : '0'}</SoKv>
        {lim > 0 ? <SoKv label={extra ? 'Hạn mức còn lại sau đơn' : 'Hạn mức còn lại'} tone={owe + extra > lim ? 'warn' : undefined}>{fmtN(lim - owe - extra)}</SoKv> : <SoKv label="Đơn khác">{others}</SoKv>}
      </div>
    </SoCard>
  );
}

/** Các bước quy trình của đơn (dùng ở tạo đơn, chi tiết đơn) */
export function soSteps(o: SalesOrder, stage: SaleStage, vs: StockVoucher[], users: User[], draft?: { needs: boolean; reasons: string[] }): SoStep[] {
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const t = saleTotals(o);
  const due = t.grand - saleReturned(o);
  const paid = salePaid(o);
  const units = o.lines.filter((l) => l.kind !== 'FREE');
  const all = units.reduce((s, l) => s + l.qty, 0);
  const done = units.reduce((s, l) => s + saleIssQ(o, l), 0);
  const outs = vs.filter((v) => v.type === 'OUT' && v.status !== 'CANCELLED');
  const invDone = (o.invReqs ?? []).filter((r) => r.status === 'DONE');
  const invAmt = invDone.reduce((s, r) => s + r.amount, 0);
  if (draft) return [
    { label: 'Tạo đơn', at: 'đang soạn', sub: nm(o.by), state: 'now' },
    { label: 'Duyệt đơn', chip: draft.needs ? <Chip tone="orange">cần duyệt</Chip> : undefined, sub: draft.needs ? draft.reasons.join('; ') : 'người lên đơn bấm duyệt', state: 'todo' },
    { label: 'Thu tiền', sub: 'kế toán lập phiếu thu, ghi nhận doanh thu', state: 'todo' },
    { label: 'Yêu cầu xuất kho', state: 'todo' },
    { label: 'Kho xuất', sub: 'một phần hoặc toàn bộ', state: 'todo' },
    { label: 'Hoàn thành', state: 'todo' },
  ];
  const appr = o.approval;
  const cancelled = stage === 'CANCELLED';
  return [
    { label: 'Tạo đơn', at: soTime(o.createdAt), sub: nm(o.by), state: 'done' },
    { label: 'Duyệt đơn', at: appr?.decidedAt ? soTime(appr.decidedAt) : undefined, sub: !appr ? 'tự duyệt' : appr.status === 'PENDING' ? appr.reasons.join('; ') : `${nm(appr.decidedBy)}${appr.note ? ` · ${appr.note}` : ''}`, chip: appr?.status === 'PENDING' ? <Chip tone="orange">chờ duyệt</Chip> : appr?.status === 'REJECTED' ? <Chip tone="red">không duyệt</Chip> : undefined, state: stage === 'APPROVAL' || stage === 'REJECTED' ? 'now' : 'done' },
    { label: 'Xuất kho', chip: all > 0 && done > 0 && done < all ? <Chip tone="blue">{fmtN(done)} / {fmtN(all)}</Chip> : undefined, sub: outs.length ? outs.map((v) => `${v.code} ${v.status === 'DONE' ? 'đã xuất' : 'chờ kho'}`).join(' · ') : stage === 'READY' ? 'chưa gửi yêu cầu' : undefined, state: stage === 'DONE' || stage === 'SHIPPING' || (all > 0 && done >= all) ? 'done' : stage === 'READY' || stage === 'WAIT_WH' || stage === 'PARTIAL' ? 'now' : 'todo' },
    ...(o.invoice ? [{ label: 'Hóa đơn thuế', at: 'song song', sub: invDone.length ? `${invDone.map((r) => r.no).join(', ')} · ${compact(invAmt)} / ${compact(due)}` : (o.invReqs ?? []).some((r) => r.status === 'PENDING') ? 'chờ kế toán xuất' : 'chưa yêu cầu', state: invAmt >= due && due > 0 ? 'done' as const : 'side' as const }] : []),
    { label: 'Thanh toán', at: 'song song', sub: `đã thu ${compact(paid)} / ${compact(due)}${o.creditDays && o.issuedAt ? ` · hạn ${fmtDate(saleDue(o)).slice(0, 5)}` : ''}`, state: paid >= due && due > 0 ? 'done' : 'side' },
    { label: cancelled ? 'Đã hủy' : 'Hoàn thành', sub: cancelled ? o.cancelReason : stage === 'DONE' ? undefined : 'khi kho xuất đủ', state: stage === 'DONE' || cancelled ? 'done' : 'todo' },
  ];
}

/** v50: quyền thao tác trên đơn: người lên đơn với đơn của mình; Giám đốc / người có quyền "Bán hàng: sửa, hủy, xóa đơn" với mọi đơn */
export function useSaleRights() {
  const { me, canDo, stockVouchers, setStockVouchers, setSalesOrders, setSaleStatus, notify, postCash, users, dispatch } = useApp();
  const mgr = me?.role === 'BOD' || canDo('sale.manage');
  const own = (o: SalesOrder) => !!me && o.by === me.id;
  const issued = (o: SalesOrder) => o.lines.some((l) => saleIssQ(o, l) > 0);
  const pendOut = (o: SalesOrder) => stockVouchers.filter((v) => v.saleId === o.id && v.type === 'OUT' && v.status === 'PENDING');
  const decide = (o: SalesOrder, st: ApprovalDecision, note?: string) => setSalesOrders((all) => all.map((x) => (x.id === o.id && x.approval ? { ...x, approval: { ...x.approval, status: st, decidedBy: me?.id, decidedAt: Date.now(), note } } : x)));
  return {
    mgr,
    canEdit: (o: SalesOrder) => o.status === 'PENDING' && !issued(o) && !pendOut(o).length && (own(o) || mgr),
    canCancel: (o: SalesOrder) => o.status === 'PENDING' && !issued(o) && (own(o) || mgr),
    canDelete: (o: SalesOrder) => o.status === 'CANCELLED' && mgr && !o.payments.length,
    canSelf: (o: SalesOrder) => !!o.approval?.self && o.approval.status === 'PENDING' && o.status === 'PENDING' && (own(o) || mgr),
    canVoidPay: () => mgr || canDo('cash.manage'),
    selfApprove: (o: SalesOrder) => { decide(o, 'APPROVED'); notify(`Đã duyệt ${o.code}. Bấm Yêu cầu xuất kho khi cần giao hàng`, 'teal'); },
    selfReject: (o: SalesOrder, note: string) => { decide(o, 'REJECTED', note); setSaleStatus(o.id, 'CANCELLED', `Không duyệt: ${note}`); },
    cancelOrder: (o: SalesOrder, why: string) => {
      const ps = pendOut(o);
      if (ps.length) setStockVouchers((all) => all.map((v) => (ps.some((p) => p.id === v.id) ? { ...v, status: 'CANCELLED' as VoucherStatus, cancelledBy: me?.id, cancelReason: `Hủy đơn ${o.code}: ${why}` } : v)));
      setSaleStatus(o.id, 'CANCELLED', why);
      const u = users.find((x) => x.id === o.by);
      if (u && u.id !== me?.id) dispatch('APPROVAL_RESULT', { to: u, title: `Đơn ${o.code} đã hủy`, body: why, module: 'sales' });
    },
    remove: (o: SalesOrder) => removeWithUndo(setSalesOrders, o, notify, `Đã xóa đơn ${o.code}`),
    /** Hủy phiếu thu: bỏ khỏi đơn; phiếu đã vào quỹ thì sinh phiếu đảo (giữ lịch sử sổ quỹ) */
    voidPay: (o: SalesOrder, p: SalePayment, code?: string) => {
      setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, payments: x.payments.filter((y) => y.id !== p.id) } : x)));
      if (p.confirmed) postCash({ kind: p.refund ? 'IN' : 'OUT', account: p.method === 'CASH' ? 'CASH' : 'BANK', category: p.refund ? 'Hủy phiếu hoàn tiền bán hàng' : 'Hủy phiếu thu bán hàng', amount: Math.abs(p.amount), partner: o.customer, ref: o.code, note: `Hủy ${code ?? 'phiếu thu'} của đơn ${o.code}`, source: 'SALE', sourceId: `${p.id}-void` });
      notify(`Đã hủy ${code ?? 'phiếu thu'} của ${o.code}${p.confirmed ? ', đã sinh phiếu đảo trong sổ quỹ' : ''}`, 'orange');
    },
  };
}

export function SalesModule() {
  const ctx = useApp();
  const { salesOrders, openSale, setOpenSale, canDo } = ctx;
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [sub, setSub] = useState<{ kind: 'approve' | 'pay'; id: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const open = openSale ? salesOrders.find((o) => o.id === openSale) : undefined;
  useEffect(() => { window.scrollTo({ top: 0 }); }, [openSale, sub, mode]);
  const editO = editId ? salesOrders.find((o) => o.id === editId) : undefined;
  if (editO) return <SaleForm key={editO.id} edit={editO} onDone={(id) => { setEditId(null); if (id) setOpenSale(id); }} />;
  if (open && sub?.id === open.id) return sub.kind === 'approve'
    ? <SaleApprove o={open} onBack={() => setSub(null)} onGo={(id) => { setOpenSale(id); setSub({ kind: 'approve', id }); }} />
    : <SalePayPage o={open} onBack={() => setSub(null)} />;
  if (open) return <SaleDetail key={`${open.id}${cancelId === open.id ? '-c' : ''}`} o={open} onBack={() => { setCancelId(null); setOpenSale(null); }} onApprove={() => setSub({ kind: 'approve', id: open.id })} onPay={() => setSub({ kind: 'pay', id: open.id })} onEdit={() => setEditId(open.id)} startCancel={cancelId === open.id} />;
  if (mode === 'new') return <SaleForm onDone={(id) => { setMode('list'); if (id) setOpenSale(id); }} />;
  return <SaleList onNew={canDo('stock.voucher') || canDo('job.manage') ? () => setMode('new') : undefined} onEdit={(id) => setEditId(id)} onCancel={(id) => { setCancelId(id); setOpenSale(id); }} />;
}

export function SaleList({ onNew, onEdit, onCancel }: { onNew?: () => void; onEdit: (id: string) => void; onCancel: (id: string) => void }) {
  const R = useSaleRights();
  const { salesOrders, setOpenSale, users, quotes, warehouses, stockVouchers, customers } = useApp();
  const [tab0, setTab] = useSticky<SaleTab>('Sales.tab50', 'ALL');
  const [per, setPer] = useSticky<SalePer>('Sales.per50', 'M');
  const [range, setRange] = useSticky<{ from: string; to: string }>('Sales.range50', { from: addDaysISO(todayISO(), -14), to: todayISO() });
  const [f, setF] = useSticky<SaleFilter>('Sales.f50', SALE_F0);
  const [cols, setCols] = useSticky<string[]>('Sales.cols50', []);
  const [size, setSize] = useSticky('Sales.size50', 20);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [pop, setPop] = useState<'' | 'per' | 'filter' | 'cols' | 'size'>('');
  const [draftF, setDraftF] = useState<SaleFilter>(f);
  const [draftR, setDraftR] = useState(range);
  const [draftC, setDraftC] = useState<string[]>([]);
  const [colQ, setColQ] = useState('');
  const [perC, setPerC] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const close = () => setPop('');
  const popRef = useOutside(pop === 'per' || pop === 'filter' || pop === 'cols', close);
  const sizeRef = useOutside(pop === 'size', close);
  const tabIds: SaleTab[] = ['ALL', 'APPROVAL', 'APPROVED', 'WAIT', 'UNPAID', 'PAID', 'DONE', 'CANCELLED'];
  const tab: SaleTab = tabIds.includes(tab0) ? tab0 : 'ALL';
  const today = todayISO();
  const mon = Number(today.slice(5, 7));
  const from = per === 'C' ? range.from : per === 'D' ? today : per === 'W' ? addDaysISO(today, -((new Date().getDay() + 6) % 7)) : per === 'M' ? `${today.slice(0, 8)}01` : per === 'Q' ? `${today.slice(0, 5)}${String(Math.floor((mon - 1) / 3) * 3 + 1).padStart(2, '0')}-01` : per === 'Y' ? `${today.slice(0, 5)}01-01` : '';
  const to = per === 'C' ? range.to : '';
  const stage = (o: SalesOrder) => saleStage(o, stockVouchers);
  const due = (o: SalesOrder) => saleTotals(o).grand - saleReturned(o);
  const leftOf = (o: SalesOrder) => (o.status === 'CANCELLED' ? 0 : due(o) - salePaid(o));
  const unitsOf = (o: SalesOrder) => { const ls = o.lines.filter((l) => l.kind !== 'FREE'); return { done: ls.reduce((s, l) => s + saleIssQ(o, l), 0), all: ls.reduce((s, l) => s + l.qty, 0) }; };
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const short = (id?: string) => nm(id).split(' ').slice(-1)[0] || '—';
  const inTab = (o: SalesOrder, t: SaleTab) => {
    const s = stage(o);
    switch (t) {
      case 'ALL': return true;
      case 'APPROVAL': return s === 'APPROVAL' || s === 'REJECTED';
      case 'APPROVED': return s === 'READY';
      case 'WAIT': return s === 'WAIT_WH' || s === 'PARTIAL';
      case 'UNPAID': return s !== 'CANCELLED' && s !== 'APPROVAL' && s !== 'REJECTED' && leftOf(o) > 0;
      case 'PAID': return s !== 'CANCELLED' && due(o) > 0 && leftOf(o) <= 0;
      case 'DONE': return s === 'DONE' || s === 'SHIPPING';
      case 'CANCELLED': return s === 'CANCELLED';
    }
  };
  const invOf = (o: SalesOrder) => { const r = o.invReqs ?? []; return !o.invoice && !r.length ? 'NO' : r.some((x) => x.status === 'DONE') ? 'DONE' : r.some((x) => x.status === 'PENDING') ? 'WAIT' : 'NONE'; };
  const overdueOf = (o: SalesOrder) => o.creditDays > 0 && !!o.issuedAt && leftOf(o) > 0 && saleDue(o) < today;
  const key = fold(q.trim());
  const day = (o: SalesOrder) => (f.dateBy === 'created' ? iso(new Date(o.createdAt)) : o.date);
  const base = salesOrders
    .filter((o) => (!from || day(o) >= from) && (!to || day(o) <= to))
    .filter((o) => {
      const u = unitsOf(o);
      const p = salePaid(o);
      const g = saleTotals(o).grand;
      return (!f.code || fold(o.code).includes(fold(f.code)))
        && (!f.origin || fold(o.origin ?? (o.source === 'QUOTE' ? 'Từ báo giá' : 'Tại quầy')).includes(fold(f.origin)))
        && (f.by === 'ALL' || o.by === f.by) && (!f.cust || fold(o.customer).includes(fold(f.cust))) && (f.wh === 'ALL' || o.whId === f.wh)
        && (f.issue === 'ALL' || (f.issue === 'NONE' ? u.done === 0 : f.issue === 'FULL' ? u.all > 0 && u.done >= u.all : u.done > 0 && u.done < u.all))
        && (f.pay === 'ALL' || o.pay === f.pay)
        && (f.paySt === 'ALL' || (f.paySt === 'PAID' ? leftOf(o) <= 0 && due(o) > 0 : f.paySt === 'UNPAID' ? p === 0 : p > 0 && leftOf(o) > 0))
        && (f.inv === 'ALL' || invOf(o) === f.inv)
        && (!f.rev || (f.revOp === 'GT' ? g > f.rev : g < f.rev)) && (!f.ret || saleReturned(o) > 0) && (!f.overdue || overdueOf(o));
    })
    .filter((o) => !key || fold(`${o.code} ${o.customer} ${o.phone ?? ''} ${o.lines.map((l) => `${l.ref ?? ''} ${l.name}`).join(' ')}`).includes(key));
  const rows = base.filter((o) => inTab(o, tab)).sort((a, b) => b.createdAt - a.createdAt);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const pg = Math.min(page, pages - 1);
  const view = rows.slice(pg * size, pg * size + size);
  useEffect(() => { setPage(0); setPicked([]); }, [tab, per, q, f, size, range]);
  const tabs: { id: SaleTab; label: string }[] = [{ id: 'ALL', label: 'Tất cả' }, { id: 'APPROVAL', label: 'Chờ duyệt' }, { id: 'APPROVED', label: 'Đã duyệt' }, { id: 'WAIT', label: 'Chờ xuất kho' }, { id: 'UNPAID', label: 'Chưa thanh toán' }, { id: 'PAID', label: 'Đã thanh toán' }, { id: 'DONE', label: 'Hoàn thành' }, { id: 'CANCELLED', label: 'Đã hủy' }];
  const sellers = Array.from(new Set(salesOrders.map((o) => o.by).filter((x): x is string => !!x)));
  const nF = (Object.keys(SALE_F0) as (keyof SaleFilter)[]).filter((k) => k !== 'revOp' && k !== 'dateBy' && f[k] !== SALE_F0[k]).length;
  const nDraft = (Object.keys(SALE_F0) as (keyof SaleFilter)[]).filter((k) => k !== 'revOp' && k !== 'dateBy' && draftF[k] !== SALE_F0[k]).length;
  type Col = { id: string; label: string; group: 'Thông tin' | 'Tiến độ' | 'Tiền'; lock?: boolean; def?: boolean; right?: boolean; sum?: (o: SalesOrder) => number; cell: (o: SalesOrder) => ReactNode };
  const money = (n: number, warn?: boolean) => <span className={cn('tabular-nums', warn && 'text-[rgb(var(--accent-fg))]')}>{fmtN(n)}</span>;
  const COLS: Col[] = [
    { id: 'date', label: 'Ngày', group: 'Thông tin', def: true, cell: (o) => <span className="tabular-nums">{fmtDate(o.date)}</span> },
    { id: 'code', label: 'Mã đơn', group: 'Thông tin', lock: true, cell: (o) => <span className="flex flex-col items-start gap-0.5"><Code>{o.code}</Code>{(cols.length ? cols : DEF).includes('seller') && <span className="text-[12.5px] text-[rgb(var(--muted))]">{short(o.by)}</span>}</span> },
    { id: 'seller', label: 'NV bán (dòng dưới mã đơn)', group: 'Thông tin', def: true, cell: () => null },
    { id: 'cust', label: 'Khách hàng', group: 'Thông tin', lock: true, cell: (o) => <span className="block max-w-[260px] truncate font-medium" title={o.customer}>{o.customer}</span> },
    { id: 'note', label: 'Ghi chú', group: 'Thông tin', def: true, cell: (o) => <span className="block max-w-[200px] truncate text-[rgb(var(--fg2))]" title={o.note}>{o.note || '—'}</span> },
    { id: 'origin', label: 'Nguồn đơn', group: 'Thông tin', cell: (o) => (o.quoteId ? <Code>{quotes.find((x) => x.id === o.quoteId)?.code ?? 'Báo giá'}</Code> : o.origin ?? 'Tại quầy') },
    { id: 'by', label: 'Người tạo', group: 'Thông tin', cell: (o) => nm(o.by) || '—' },
    { id: 'wh', label: 'Kho xuất', group: 'Thông tin', cell: (o) => warehouses.find((w) => w.id === o.whId)?.name ?? '—' },
    { id: 'status', label: 'Trạng thái', group: 'Tiến độ', lock: true, cell: (o) => { const s = stage(o); return <Chip tone={SALE_STAGE[s].tone}>{SALE_STAGE[s].label}</Chip>; } },
    { id: 'issue', label: 'Trạng thái xuất kho', group: 'Tiến độ', right: true, cell: (o) => { const u = unitsOf(o); return u.all ? <span className="tabular-nums">{fmtN(u.done)} / {fmtN(u.all)}</span> : '—'; } },
    { id: 'deliver', label: 'Ngày giao', group: 'Tiến độ', cell: (o) => (o.deliverAt ? <span className="tabular-nums">{fmtDate(o.deliverAt)}</span> : '—') },
    { id: 'gross', label: 'Doanh số', group: 'Tiền', def: true, right: true, sum: (o) => saleTotals(o).net, cell: (o) => money(saleTotals(o).net) },
    { id: 'vat', label: 'VAT', group: 'Tiền', def: true, right: true, sum: (o) => saleTotals(o).vat, cell: (o) => money(saleTotals(o).vat) },
    { id: 'grand', label: 'Tổng đơn', group: 'Tiền', def: true, right: true, sum: (o) => saleTotals(o).grand, cell: (o) => <span className="font-medium tabular-nums">{fmtN(saleTotals(o).grand)}</span> },
    { id: 'disc', label: 'Chiết khấu', group: 'Tiền', right: true, sum: (o) => saleTotals(o).discount, cell: (o) => money(saleTotals(o).discount) },
    { id: 'ret', label: 'Hàng trả lại', group: 'Tiền', right: true, sum: (o) => saleReturned(o), cell: (o) => (saleReturned(o) ? money(saleReturned(o)) : '—') },
    { id: 'paid', label: 'Doanh thu', group: 'Tiền', def: true, right: true, sum: (o) => salePaid(o), cell: (o) => money(salePaid(o)) },
    { id: 'wait', label: 'Chờ kế toán thu', group: 'Tiền', right: true, sum: (o) => salePaid(o, true) - salePaid(o), cell: (o) => (salePaid(o, true) - salePaid(o) ? money(salePaid(o, true) - salePaid(o)) : '—') },
    { id: 'left', label: 'Còn lại', group: 'Tiền', def: true, right: true, sum: (o) => Math.max(0, leftOf(o)), cell: (o) => money(Math.max(0, leftOf(o)), leftOf(o) > 0) },
    { id: 'dueAt', label: 'Hạn thanh toán', group: 'Tiền', cell: (o) => (o.creditDays && o.issuedAt ? <span className={cn('tabular-nums', overdueOf(o) && 'text-[rgb(var(--danger-fg))]')}>{fmtDate(saleDue(o))}</span> : '—') },
    { id: 'inv', label: 'Hóa đơn thuế', group: 'Tiến độ', def: true, cell: (o) => { const s = invOf(o); return s === 'NO' ? <span className="text-[rgb(var(--muted))]">Không lấy</span> : s === 'DONE' ? <span className="flex gap-1">{(o.invReqs ?? []).filter((r) => r.status === 'DONE').map((r) => <Code key={r.id}>{r.no}</Code>)}</span> : s === 'WAIT' ? <Chip tone="orange">Chờ xuất</Chip> : '—'; } },
  ];
  const DEF = COLS.filter((c) => c.def || c.lock).map((c) => c.id);
  const on = cols.length ? cols : DEF;
  const ORDER = ['date', 'code', 'cust', 'status', 'origin', 'by', 'wh', 'issue', 'deliver', 'gross', 'disc', 'vat', 'grand', 'paid', 'wait', 'left', 'ret', 'dueAt', 'note', 'inv'];
  const vis = ORDER.map((id) => COLS.find((c) => c.id === id)!).filter((c) => c.lock || on.includes(c.id));
  const sumOf = (fn: (o: SalesOrder) => number) => rows.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + fn(o), 0);
  const firstSum = vis.findIndex((c) => !!c.sum);
  const PER: [SalePer, string][] = [['ALL', 'Tất cả'], ['D', 'Hôm nay'], ['W', 'Tuần này'], ['M', 'Tháng này'], ['Q', 'Quý này'], ['Y', 'Năm nay'], ['C', 'Thời gian khác']];
  const perLabel = per === 'C' ? `${fmtDate(range.from).slice(0, 5)} – ${fmtDate(range.to)}` : PER.find((x) => x[0] === per)?.[1];
  const exportRows = (list: SalesOrder[]) => [vis.map((c) => c.label), ...list.map((o) => vis.map((c) => { return c.sum ? c.sum(o) : c.id === 'code' ? o.code : c.id === 'date' ? fmtDate(o.date) : c.id === 'cust' ? o.customer : c.id === 'status' ? SALE_STAGE[stage(o)].label : c.id === 'note' ? o.note ?? '' : c.id === 'inv' ? (o.invReqs ?? []).filter((r) => r.status === 'DONE').map((r) => r.no).join(', ') : c.id === 'by' ? nm(o.by) : c.id === 'wh' ? warehouses.find((w) => w.id === o.whId)?.name ?? '' : c.id === 'issue' ? `${unitsOf(o).done}/${unitsOf(o).all}` : c.id === 'origin' ? o.origin ?? '' : c.id === 'deliver' ? fmtDate(o.deliverAt) : c.id === 'dueAt' && o.issuedAt ? fmtDate(saleDue(o)) : ''; }))];
  const chosen = rows.filter((o) => picked.includes(o.id));
  const csv = () => downloadCsv(`don-hang-${today}.csv`, exportRows(chosen.length ? chosen : rows));
  const print = () => { const g = exportRows(chosen.length ? chosen : rows); printHtml(docShell('Danh sách đơn hàng', `<h1>Danh sách đơn hàng</h1><table class="items"><thead><tr>${g[0].map((h) => `<th>${esc(String(h))}</th>`).join('')}</tr></thead><tbody>${g.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`)); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (onNew && (e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); onNew(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onNew]);
  const sel = (v: string, set: (v: string) => void, opts: [string, string][], label: string) => <Field label={label}><select className={inputCls} value={v} onChange={(e) => set(e.target.value)}>{opts.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>;
  const allOn = view.length > 0 && view.every((o) => picked.includes(o.id));
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2" ref={popRef}>
        <h1 className="mr-2 text-[20px] font-medium">Quản lý đơn hàng</h1>
        <div className="order-last w-full min-w-0 lg:order-none lg:mx-auto lg:w-auto lg:max-w-[640px] lg:flex-1"><SearchBox value={q} onChange={setQ} placeholder="Tìm mã đơn, khách hàng, SĐT, mã hàng" /></div>
        <div className="relative ml-auto lg:ml-0">
          <button className={cn(btnGhost, 'h-9 min-w-[150px] justify-between gap-2', per === 'C' && 'border-[rgb(var(--accent))]')} onClick={() => { setDraftR(range); setPerC(per === 'C'); setPop(pop === 'per' ? '' : 'per'); }} aria-expanded={pop === 'per'}><CalendarDays className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><span className="flex-1 text-left">{perLabel}</span><ChevronDown className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /></button>
          {pop === 'per' && (
            <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1.5 shadow-xl">
              {PER.map(([k, t]) => <button key={k} className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] hover:bg-[rgb(var(--ink)/0.05)]', (k === 'C' ? perC : per === k && !perC) && 'bg-[rgb(var(--ink)/0.05)]')} onClick={() => { if (k === 'C') { setPerC(true); return; } setPer(k); setPop(''); }}>{t}{(k === 'C' ? perC : per === k && !perC) && <CheckIcon className="h-4 w-4" aria-hidden />}</button>)}
              {perC && (
                <div className="mt-1 space-y-2 border-t border-[rgb(var(--line))] p-2">
                  <Field label="Từ ngày"><input type="date" className={inputCls} value={draftR.from} max={draftR.to} onChange={(e) => setDraftR({ ...draftR, from: e.target.value })} /></Field>
                  <Field label="Đến ngày"><input type="date" className={inputCls} value={draftR.to} min={draftR.from} onChange={(e) => setDraftR({ ...draftR, to: e.target.value })} /></Field>
                  <button className={cn(btnBase, 'w-full justify-center bg-[rgb(var(--fg))] py-2 text-[rgb(var(--bg))]')} disabled={!draftR.from || !draftR.to || draftR.from > draftR.to} onClick={() => { setRange(draftR); setPer('C'); setPop(''); }}>Áp dụng</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex">
          <div className="relative">
            <button className={cn(soIco, 'relative rounded-r-none', (pop === 'filter' || nF > 0) && 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))] hover:bg-[rgb(var(--fg))]')} onClick={() => { setDraftF(f); setPop(pop === 'filter' ? '' : 'filter'); }} aria-label="Bộ lọc" title="Bộ lọc" aria-expanded={pop === 'filter'}><Filter className="h-4 w-4" aria-hidden />{nF > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[rgb(var(--accent))] px-1 text-[10px] text-[rgb(var(--on-accent))]">{nF}</span>}</button>
            {pop === 'filter' && (
              <div className="absolute right-0 top-full z-40 mt-1 w-[620px] max-w-[92vw] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5 shadow-xl max-sm:-right-24">
                <div className="mb-3 flex flex-wrap items-center gap-4 text-[14px]">
                  {([['date', 'Theo ngày đặt hàng'], ['created', 'Theo ngày tạo đơn']] as const).map(([k, t]) => <label key={k} className="flex items-center gap-2"><input type="radio" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={draftF.dateBy === k} onChange={() => setDraftF({ ...draftF, dateBy: k })} />{t}</label>)}
                  <span className="ml-auto text-[12.5px] text-[rgb(var(--muted))]">Kỳ: {perLabel}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Mã đơn hàng"><input className={inputCls} value={draftF.code} onChange={(e) => setDraftF({ ...draftF, code: e.target.value })} placeholder="Nhập mã" /></Field>
                  <Field label="Nguồn đơn hàng"><input className={inputCls} list="so-origins" value={draftF.origin} onChange={(e) => setDraftF({ ...draftF, origin: e.target.value })} placeholder="Tất cả" /></Field>
                  {sel(draftF.by, (v) => setDraftF({ ...draftF, by: v }), [['ALL', 'Tất cả'], ...sellers.map((id): [string, string] => [id, nm(id) || id])], 'Nhân viên bán')}
                  <Field label="Khách hàng"><input className={inputCls} list="so-custs" value={draftF.cust} onChange={(e) => setDraftF({ ...draftF, cust: e.target.value })} placeholder="Tìm khách hàng" /></Field>
                  {sel(draftF.wh, (v) => setDraftF({ ...draftF, wh: v }), [['ALL', 'Tất cả'], ...warehouses.map((w): [string, string] => [w.id, w.name])], 'Kho xuất')}
                  {sel(draftF.issue, (v) => setDraftF({ ...draftF, issue: v as SaleFilter['issue'] }), [['ALL', 'Tất cả'], ['NONE', 'Chưa xuất'], ['PART', 'Một phần'], ['FULL', 'Đã xuất đủ']], 'Trạng thái xuất kho')}
                  {sel(draftF.pay, (v) => setDraftF({ ...draftF, pay: v as SalePay | 'ALL' }), [['ALL', 'Tất cả'], ...(Object.keys(SALE_PAY) as SalePay[]).map((p): [string, string] => [p, SALE_PAY[p]])], 'Phương thức thanh toán')}
                  {sel(draftF.paySt, (v) => setDraftF({ ...draftF, paySt: v as SaleFilter['paySt'] }), [['ALL', 'Tất cả'], ['UNPAID', 'Chưa thu'], ['PART', 'Thu một phần'], ['PAID', 'Đã thu đủ']], 'Trạng thái thanh toán')}
                  {sel(draftF.inv, (v) => setDraftF({ ...draftF, inv: v as SaleFilter['inv'] }), [['ALL', 'Tất cả'], ['NONE', 'Chưa xuất'], ['WAIT', 'Chờ kế toán'], ['DONE', 'Đã xuất'], ['NO', 'Không lấy']], 'Hóa đơn thuế')}
                  <Field label="Doanh thu"><div className="flex gap-2"><select className={cn(inputBase, 'w-32')} value={draftF.revOp} onChange={(e) => setDraftF({ ...draftF, revOp: e.target.value as 'GT' | 'LT' })} aria-label="So sánh"><option value="GT">Lớn hơn</option><option value="LT">Nhỏ hơn</option></select><div className="min-w-0 flex-1"><MoneyInput value={draftF.rev} onChange={(v) => setDraftF({ ...draftF, rev: v })} /></div></div></Field>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={draftF.ret} onChange={(e) => setDraftF({ ...draftF, ret: e.target.checked })} />Có hàng trả lại</label>
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={draftF.overdue} onChange={(e) => setDraftF({ ...draftF, overdue: e.target.checked })} />Quá hạn thanh toán</label>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-[rgb(var(--line))] pt-4">
                  <span className="text-[13px] text-[rgb(var(--muted))]">Đang chọn {nDraft} điều kiện</span>
                  <button className="ml-auto px-3 py-2 text-[14px] hover:underline" onClick={() => { setDraftF(SALE_F0); setF(SALE_F0); }}>Xóa lọc</button>
                  <button className={btnGhost} onClick={() => setPop('')}>Đóng</button>
                  <button className={cn(btnBase, 'bg-[rgb(var(--fg))] px-4 py-2 text-[rgb(var(--bg))]')} onClick={() => { setF(draftF); setPop(''); }}><Search className="h-4 w-4" aria-hidden />Tìm kiếm</button>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button className={cn(soIco, '-ml-px rounded-l-none', pop === 'cols' && 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))] hover:bg-[rgb(var(--fg))]')} onClick={() => { setDraftC(on); setColQ(''); setPop(pop === 'cols' ? '' : 'cols'); }} aria-label="Cột hiển thị" title="Cột hiển thị" aria-expanded={pop === 'cols'}><Columns3 className="h-4 w-4" aria-hidden /></button>
            {pop === 'cols' && (
              <div className="absolute right-0 top-full z-40 mt-1 w-[720px] max-w-[92vw] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5 shadow-xl max-sm:-right-12">
                <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-medium">Cột hiển thị</h3><span className="text-[12.5px] tabular-nums text-[rgb(var(--muted))]">{COLS.filter((c) => c.lock || draftC.includes(c.id)).length} / {COLS.length}</span><div className="ml-auto w-48"><SearchBox value={colQ} onChange={setColQ} placeholder="Tìm cột" /></div></div>
                <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">
                  {(['Thông tin', 'Tiến độ', 'Tiền'] as const).map((g) => (
                    <div key={g}>
                      <p className="mb-1 text-[12.5px] text-[rgb(var(--muted))]">{g}</p>
                      {COLS.filter((c) => c.group === g && (!colQ || fold(c.label).includes(fold(colQ)))).map((c) => (
                        <label key={c.id} className={cn('flex items-center gap-2.5 rounded-md px-1 py-1.5 text-[14px]', !c.lock && 'hover:bg-[rgb(var(--ink)/0.04)]')}>
                          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={c.lock || draftC.includes(c.id)} disabled={c.lock} onChange={() => setDraftC((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} />
                          <span className="flex-1">{c.label}</span>{c.lock && <Lock className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-label="Cột cố định" />}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-[rgb(var(--line))] pt-4">
                  <span className="flex items-center gap-1.5 text-[13px] text-[rgb(var(--muted))]"><Lock className="h-3.5 w-3.5" aria-hidden />Cột cố định không ẩn được</span>
                  <button className={cn(btnGhost, 'ml-auto')} onClick={() => setDraftC(DEF)}>Mặc định</button>
                  <button className={cn(btnBase, 'bg-[rgb(var(--fg))] px-4 py-2 text-[rgb(var(--bg))]')} onClick={() => { setCols(draftC); setPop(''); }}>Lưu cho tôi</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex">
          <button className={cn(soIco, 'rounded-r-none')} onClick={csv} disabled={!rows.length} aria-label="Xuất Excel (CSV)" title={chosen.length ? `Xuất ${chosen.length} đơn đã chọn` : 'Xuất Excel (CSV)'}><Download className="h-4 w-4" aria-hidden /></button>
          <button className={cn(soIco, '-ml-px rounded-l-none')} onClick={print} disabled={!rows.length} aria-label="In danh sách" title={chosen.length ? `In ${chosen.length} đơn đã chọn` : 'In danh sách'}><Printer className="h-4 w-4" aria-hidden /></button>
        </div>
        {onNew && <button className={cn(btnPrimary, 'h-9')} onClick={onNew} title="Phím tắt N"><Plus className="h-4 w-4" aria-hidden />Lên đơn bán<kbd className="ml-1 rounded border border-current/40 px-1 font-mono text-[10px] opacity-70">N</kbd></button>}
        <datalist id="so-origins">{Array.from(new Set(['Tại quầy', 'Từ báo giá', ...salesOrders.map((o) => o.origin).filter((x): x is string => !!x)])).map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="so-custs">{customers.slice(0, 300).map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </div>
      <section className="glass-card overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center gap-x-6 border-b border-[rgb(var(--line))] px-5">
          <div className="-mb-px flex min-w-0 flex-1 gap-6 overflow-x-auto" role="tablist">
            {tabs.map((t) => { const n = base.filter((o) => inTab(o, t.id)).length; return (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn('flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px]', tab === t.id ? 'border-[rgb(var(--fg))] font-medium text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>{t.label}<span className="text-[12px] tabular-nums text-[rgb(var(--muted))]">{n}</span></button>
            ); })}
          </div>
          <div className="flex items-center gap-2 py-2">
            <span className="whitespace-nowrap text-[13px] tabular-nums text-[rgb(var(--muted))]">{rows.length ? `${pg * size + 1}–${Math.min(rows.length, pg * size + size)} trong ${rows.length} đơn` : '0 đơn'}</span>
            <div className="flex"><button className={cn(soIco, 'h-8 w-8 rounded-r-none')} disabled={pg === 0} onClick={() => setPage(pg - 1)} aria-label="Trang trước"><ChevronLeft className="h-4 w-4" aria-hidden /></button><button className={cn(soIco, '-ml-px h-8 w-8 rounded-l-none')} disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} aria-label="Trang sau"><ChevronRight className="h-4 w-4" aria-hidden /></button></div>
            <div className="relative" ref={sizeRef}>
              <button className={cn(btnGhost, 'h-8 gap-1.5 py-0')} onClick={() => setPop(pop === 'size' ? '' : 'size')} aria-expanded={pop === 'size'} aria-label="Số đơn mỗi trang">{size} / trang<ChevronDown className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /></button>
              {pop === 'size' && <div className="absolute right-0 top-full z-40 mt-1 w-32 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 shadow-xl">{[20, 50, 100].map((n) => <button key={n} className={cn('flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[13.5px] hover:bg-[rgb(var(--ink)/0.05)]', size === n && 'font-medium')} onClick={() => { setSize(n); setPop(''); }}>{n} / trang{size === n && <CheckIcon className="h-3.5 w-3.5" aria-hidden />}</button>)}</div>}
            </div>
          </div>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead><tr className="border-b border-[rgb(var(--line))]">
                <th className={cn(soTh, 'w-10 pl-5')}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={allOn} onChange={() => setPicked(allOn ? picked.filter((id) => !view.some((o) => o.id === id)) : Array.from(new Set([...picked, ...view.map((o) => o.id)])))} aria-label="Chọn cả trang" /></th>
                <th className={cn(soTh, 'w-8')}>#</th>
                {vis.map((c) => <th key={c.id} className={cn(soTh, c.right && 'text-right')}>{c.label}</th>)}
                <th className={cn(soTh, 'w-12 pr-5')}><span className="sr-only">Thao tác</span></th>
              </tr></thead>
              <tbody>
                {view.map((o, i) => { const pk = picked.includes(o.id); return (
                  <tr key={o.id} className={cn('cursor-pointer border-b border-[rgb(var(--ink)/0.06)] hover:bg-[rgb(var(--ink)/0.03)]', pk && 'bg-[rgb(var(--accent)/0.05)] shadow-[inset_3px_0_0_rgb(var(--accent))]')} onClick={() => setOpenSale(o.id)}>
                    <td className={cn(soTd, 'pl-5')} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={pk} onChange={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))} aria-label={`Chọn ${o.code}`} /></td>
                    <td className={cn(soTd, 'tabular-nums text-[rgb(var(--muted))]')}>{pg * size + i + 1}</td>
                    {vis.map((c) => <td key={c.id} className={cn(soTd, c.right && 'text-right')}>{c.cell(o)}</td>)}
                    <td className={cn(soTd, 'pr-5')} onClick={(e) => e.stopPropagation()}><RowMenu items={[{ label: 'Xem chi tiết', icon: Eye, onClick: () => setOpenSale(o.id) }, { label: 'Sửa đơn', icon: Pencil, disabled: !R.canEdit(o), onClick: () => onEdit(o.id) }, { label: 'Hủy đơn', icon: XCircle, disabled: !R.canCancel(o), onClick: () => onCancel(o.id) }, ...(R.canDelete(o) ? [{ label: 'Xóa đơn', icon: Trash2, danger: true, onClick: () => R.remove(o) }] : [])]} /></td>
                  </tr>
                ); })}
                <tr className="bg-[rgb(var(--ink)/0.03)] font-medium">
                  <td className={cn(soTd, 'pl-5')} colSpan={2 + Math.max(0, firstSum)}>Tổng {rows.length} đơn <span className="font-normal text-[rgb(var(--muted))]">· theo bộ lọc</span></td>
                  {firstSum >= 0 && vis.slice(firstSum).map((c) => <td key={c.id} className={cn(soTd, 'text-right tabular-nums', c.id === 'left' && 'text-[rgb(var(--accent-fg))]')}>{c.sum ? fmtN(sumOf(c.sum)) : ''}</td>)}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        ) : <EmptyState text={salesOrders.length ? 'Không có đơn khớp bộ lọc' : 'Chưa có đơn hàng'} art="box" action={!salesOrders.length && onNew ? 'Lên đơn bán' : undefined} onAction={onNew} />}
      </section>
    </div>
  );
}

export function SaleForm({ onDone, edit }: { onDone: (id?: string) => void; edit?: SalesOrder }) {
  const { skus, stockItems, stockMoves, priceItems, warehouses, customers, salesOrders, reservations, saveSale, me, notify, company, workOrders, setWorkOrders, mfgConfig } = useApp();
  const mfg = bizMode(company) === 'MFG';
  const main = warehouses.find((w) => w.main)?.id ?? MAIN_WH;
  const [lines, setLines] = useState<SaleLine[]>(edit?.lines ?? []);
  const [find, setFind] = useState('');
  const [custQ, setCustQ] = useState('');
  const [custId, setCustId] = useState<string | undefined>(edit?.customerId);
  const [walkName, setWalkName] = useState(edit && !edit.customerId ? edit.customer : '');
  const [phone, setPhone] = useState(edit?.phone ?? '');
  const [address, setAddress] = useState(edit?.address ?? '');
  const [tier, setTier] = useState<PriceTier>('BASE');
  const [pay, setPay] = useState<SalePay>(edit ? (edit.pay === 'PARTIAL' ? 'CREDIT' : edit.pay) : 'CASH');
  const [creditDays, setCreditDays] = useState(edit?.creditDays || 30);
  const [delivery, setDelivery] = useState<SaleDelivery>(edit?.delivery ?? 'PICKUP');
  const [whId, setWhId] = useState(edit?.whId ?? main);
  const [deliverAt, setDeliverAt] = useState(edit?.deliverAt ?? todayISO());
  const [invoice, setInvoice] = useState(edit?.invoice ?? false);
  const [shipFee, setShipFee] = useState(edit?.shipFee ?? 0);
  const [note, setNote] = useState(edit?.note ?? '');
  const { users, wfDef, openCustomerForm, wfFirstApprovers, dispatch } = useApp();
  const [code, setCode] = useState(edit?.code ?? '');
  const [origin, setOrigin] = useState(edit ? edit.origin ?? (edit.source === 'QUOTE' ? 'Từ báo giá' : 'Tại quầy') : 'Tại quầy');
  const [docRef, setDocRef] = useState(edit?.docRef ?? '');
  const [receiver, setReceiver] = useState(edit?.receiver ?? '');
  const [byId, setById] = useState(edit?.by ?? me?.id ?? '');
  const [custOpen, setCustOpen] = useState(false);
  const cust = customers.find((c) => c.id === custId);
  const draft: SalesOrder = { id: 'new', code: '', createdAt: 0, date: todayISO(), source: 'COUNTER', customerId: custId, customer: cust?.name ?? walkName, lines, pay, creditDays, payments: [], delivery, whId, invoice, status: 'PENDING', shipFee };
  const t = saleTotals(draft);
  const stock = saleStock(draft, { skus, warehouses, reservations, stockMoves, orders: salesOrders });
  const lastPrice = (kind: SaleLineKind, ref: string) => {
    const hit = salesOrders.filter((o) => o.status !== 'CANCELLED' && (!!custId ? o.customerId === custId : false)).sort((a, b) => b.createdAt - a.createdAt).flatMap((o) => o.lines).find((l) => l.kind === kind && l.ref === ref);
    return hit?.price;
  };
  const vatDef = mfgConfig.vatPct ?? 10;
  const catalog: SalePick[] = useMemo(() => {
    const k = fold(find.trim());
    if (!k) return [];
    const hit = (s: string) => fold(s).includes(k);
    if (mfg) {
      const its: SalePick[] = stockItems.filter((x) => x.active && hit(`${x.code} ${x.name}`)).map((x) => ({ kind: 'ITEM', ref: x.id, name: x.name, unit: x.unit, price: x.cost, vat: vatDef, sub: `${x.code} · tồn ${fmtN(stockOf(x.id, stockMoves).qty)} ${x.unit}` }));
      const mk: SalePick[] = priceItems.filter((x) => x.active && (x.unit === 'SET' || x.unit === 'PCS') && hit(`${x.code} ${x.name}`)).map((x) => ({ kind: 'MAKE', ref: x.id, name: x.name, unit: x.unit === 'SET' ? 'bộ' : 'cái', price: x.price, vat: vatDef, sub: `${x.code} · gia công tại xưởng` }));
      return [...its, ...mk].slice(0, 8);
    }
    return skus.filter((x) => !x.archived && hit(`${x.sku} ${x.name}`)).slice(0, 8).map((x) => {
      const free = Math.max(0, whQty(x, whId, warehouses) - saleHeld(salesOrders, 'SKU', x.sku));
      const lp = lastPrice('SKU', x.sku);
      return { kind: 'SKU' as const, ref: x.sku, name: x.name, unit: x.unit, price: lp ?? tierPrice(x, tier), vat: x.vatPct ?? vatDef, sub: `${x.sku} · tồn ${fmtN(free)} ${x.unit}${lp ? ` · giá đã bán cho khách này ${fmtN(lp)}đ` : ` · ${PRICE_TIER[tier].toLowerCase()}`}` };
    });
  }, [find, mfg, stockItems, stockMoves, priceItems, skus, whId, warehouses, salesOrders, tier, custId]); // eslint-disable-line react-hooks/exhaustive-deps
  const add = (p: SalePick) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.kind === p.kind && l.ref === p.ref && !!p.ref);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { id: uid('sl'), kind: p.kind, ref: p.ref, name: p.name, unit: p.unit, qty: 1, price: p.price, discountPct: 0, vat: p.vat }];
    });
    setFind('');
  };
  const upd = (id: string, patch: Partial<SaleLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const pickCust = (c: Customer) => {
    setCustId(c.id); setCustQ(''); setPhone(c.contactPhone); setAddress(c.address ?? ''); setInvoice(!!c.taxCode);
    const tr: PriceTier = /EPC|CONTRACT/.test(c.segment) ? 'PROJECT' : 'DEALER';
    setTier(tr);
    if (!mfg) setLines((ls) => ls.map((l) => (l.kind === 'SKU' ? { ...l, price: tierPrice(skus.find((k) => k.sku === l.ref), tr) || l.price } : l)));
  };
  const custHits = custQ.trim().length >= 2 ? customers.filter((c) => fold(`${c.name} ${c.code} ${c.contactPhone} ${c.taxCode}`).includes(fold(custQ.trim()))).slice(0, 6) : [];
  const name = cust?.name ?? walkName.trim();
  const errs: string[] = [];
  if (!lines.length) errs.push('Chưa có hàng hóa');
  if (lines.some((l) => !(l.qty > 0) || l.price < 0)) errs.push('Số lượng phải lớn hơn 0');
  if (lines.some((l) => !l.name.trim())) errs.push('Dòng hàng chưa có tên');
  if (!name) errs.push('Chọn khách trong CRM hoặc nhập tên khách lẻ');
  if (pay === 'CREDIT' && !cust) errs.push('Khách lẻ không ghi công nợ: chọn khách trong CRM');
  if (delivery !== 'PICKUP' && !address.trim()) errs.push('Nhập địa chỉ giao hàng');
  if (code.trim() && salesOrders.some((x) => x.code === code.trim() && x.id !== edit?.id)) errs.push(`Mã đơn ${code.trim()} đã có`);
  const short = stock.filter((x) => x.short > 0);
  const finish = () => {
    if (errs.length) return notify(errs[0], 'red');
    const base = { date: todayISO(), source: 'COUNTER' as const, customerId: cust?.id, customer: name, phone: phone.trim() || undefined, taxCode: cust?.taxCode || undefined, address: address.trim() || undefined,
      lines, pay, creditDays: pay === 'CREDIT' || pay === 'PARTIAL' ? creditDays : 0, payments: [], delivery, whId, deliverAt: delivery === 'PICKUP' ? undefined : deliverAt, invoice, shipFee: shipFee || undefined, note: note.trim() || undefined, status: 'PENDING' as SaleStatus, by: byId || me?.id,
      origin: origin.trim() || undefined, docRef: docRef.trim() || undefined, receiver: receiver.trim() || undefined, ...(code.trim() ? { code: code.trim() } : {}) };
    const now0 = Date.now();
    const approval: SalesOrder['approval'] = needs ? { status: 'PENDING', reasons, requestedAt: now0, requestedBy: me?.id } : { status: 'PENDING', reasons: ['Người lên đơn tự duyệt'], requestedAt: now0, requestedBy: me?.id, self: true };
    let rec = edit ? saveSale({ ...edit, ...base, source: edit.source, date: edit.date, payments: edit.payments, code: edit.code, approval }) : saveSale({ ...base, approval });
    const who = needs ? wfFirstApprovers('SALE', ws).filter((u) => u.id !== me?.id) : [];
    who.forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title: `Đơn bán chờ duyệt: ${name}`, body: `${rec.code} · ${fmtN(t.grand)} sau VAT. ${reasons.join('; ')}`, module: 'sales' }));
    const make = lines.filter((l) => l.kind === 'MAKE');
    if (make.length && me && !edit?.woId) {
      const wo: WorkOrder = {
        id: uid('wo'), code: nextCode(workOrders.map((w) => w.code), `LSX-${new Date().getFullYear()}-`, 4), title: `Đơn bán ${rec.code} (${name})`, customerId: cust?.id, stage: 'WAITING', priority: 'NORMAL',
        startDate: todayISO(), dueDate: addDaysISO(todayISO(), mfgConfig.productionDays || 7), items: make.map((l) => ({ id: uid('wi'), name: l.name, spec: l.note ?? '', unit: l.unit, qty: l.qty, done: 0 })),
        materials: [], qc: [], note: `Gia công cho đơn bán ${rec.code}`, history: [{ stage: 'WAITING', at: Date.now(), by: me.id, note: `Từ đơn bán ${rec.code}` }], createdAt: todayISO(), createdBy: me.id,
      };
      setWorkOrders((p) => [wo, ...p]);
      rec = saveSale({ ...rec, woId: wo.id });
    }
    notify(`Đã ${edit ? 'cập nhật' : 'lưu'} ${rec.code} (ghi nhận doanh số). ${needs ? `Chờ duyệt${who.length ? `: ${who.map((u) => u.name).join(', ')}` : ''}` : 'Bấm Duyệt đơn để xác nhận'}`, 'teal');
    onDone(rec.id);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F9') { e.preventDefault(); finish(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const cellIn = cn(inputBase, 'w-full min-w-0 px-2 py-1 text-right text-[13px] tabular-nums');
  const now = new Date();
  const pfx = `DH${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(2)}-`;
  const autoCode = nextCode(salesOrders.filter((x) => x.code.startsWith(pfx)).map((x) => x.code), pfx, 2);
  const wd = wfDef('SALE');
  const oweSO = salesOrders.filter((x) => !!custId && x.customerId === custId && saleIssued(x)).reduce((s, x) => s + saleTotals(x).grand - salePaid(x), 0);
  const credit = pay === 'CREDIT' || pay === 'PARTIAL';
  const ws: WfSubject = { requesterId: me?.id, dept: cust?.dept, amount: t.grand, vals: { maxDisc: Math.max(0, ...lines.map((l) => l.discountPct)), overLimit: cust && cust.creditLimit > 0 && credit ? Math.max(0, oweSO + t.grand - cust.creditLimit) : 0, amount: t.grand } };
  const needs = lines.length > 0 && wfNeeds(wd, ws);
  const reasons = needs && wd ? wfReasons(wd, ws) : [];
  const skuBy = (v: string) => { const k = fold(v.trim()); return k ? skus.find((x) => !x.archived && (fold(x.sku) === k || fold(x.name) === k)) : undefined; };
  const fromSku = (id: string, x: SkuItem) => { const lp = lastPrice('SKU', x.sku); upd(id, { kind: 'SKU', ref: x.sku, name: x.name, unit: x.unit, price: lp ?? tierPrice(x, tier), vat: x.vatPct ?? vatDef }); };
  const addRow = () => setLines((ls) => [...ls, { id: uid('sl'), kind: 'FREE', name: '', unit: 'cái', qty: 1, price: 0, discountPct: 0, vat: vatDef }]);
  const ckd = (l: SaleLine) => Math.round(l.qty * l.price) - saleLineNet(l);
  const sumQty = lines.reduce((s, l) => s + l.qty, 0);
  const DLV: Record<SaleDelivery, string> = { PICKUP: 'Tại quầy', DELIVER: 'Giao hàng', CARRIER: 'Chành xe' };
  const seg = (on: boolean) => cn('flex-1 whitespace-nowrap px-3 py-2 text-center text-[13.5px]', on ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]');
  const segBox = 'flex overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.12)] divide-x divide-[rgb(var(--ink)/0.08)]';
  const draftO: SalesOrder = { ...draft, by: byId || me?.id };
  return (
    <div>
      <SoTop crumb="Quản lý đơn hàng" onCrumb={() => onDone(edit?.id)} title={edit ? 'Sửa đơn hàng' : 'Tạo đơn hàng'} chips={<><Code>{code.trim() || autoCode}</Code><Chip>{edit ? 'Sửa xong phải duyệt lại' : 'Mới'}</Chip></>}>
        <button className={btnGhost} onClick={() => onDone(edit?.id)}>Hủy</button>
        <button className={btnPrimary} onClick={finish} title="Phím tắt F9"><Send className="h-4 w-4" aria-hidden />{edit ? 'Lưu thay đổi' : needs ? 'Lưu & gửi duyệt' : 'Lưu đơn'}<kbd className="ml-1 rounded border border-current/40 px-1 font-mono text-[10px] opacity-70">F9</kbd></button>
      </SoTop>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <SoCard title="Thông tin đơn hàng">
            <div className={soGrid}>
              <Field label="Khách hàng" className="sm:col-span-2">
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    {cust || walkName ? (
                      <div className={cn(inputBase, 'flex w-full items-center gap-2 border-[rgb(var(--accent))]')}>
                        <Building2 className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="min-w-0 truncate font-medium">{cust?.name ?? walkName}</span><span className="shrink-0 text-[12px] text-[rgb(var(--muted))]">{cust ? cust.code : 'khách lẻ'}</span>
                        <button className="ml-auto rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => { setCustId(undefined); setWalkName(''); setTier('BASE'); }} aria-label="Đổi khách"><X className="h-4 w-4" aria-hidden /></button>
                      </div>
                    ) : (
                      <input className={inputCls} value={custQ} onChange={(e) => { setCustQ(e.target.value); setCustOpen(true); }} onFocus={() => setCustOpen(true)} onBlur={() => setTimeout(() => setCustOpen(false), 150)} placeholder="Tên, mã, SĐT, MST khách hàng" aria-label="Khách hàng" />
                    )}
                    {!cust && !walkName && custOpen && custQ.trim().length >= 2 && (
                      <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-lg">
                        {custHits.map((c) => <li key={c.id}><button className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[13.5px] hover:bg-[rgb(var(--ink)/0.04)]" onMouseDown={(e) => e.preventDefault()} onClick={() => { pickCust(c); setCustOpen(false); }}><span className="truncate">{c.name}</span><span className="shrink-0 text-[12px] text-[rgb(var(--muted))]">{[c.code, c.contactPhone].filter(Boolean).join(' · ')}</span></button></li>)}
                        <li><button className="w-full px-3 py-2 text-left text-[13.5px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]" onMouseDown={(e) => e.preventDefault()} onClick={() => { setWalkName(custQ.trim()); setCustQ(''); setCustOpen(false); }}>Khách lẻ: <b className="font-medium">{custQ.trim()}</b></button></li>
                      </ul>
                    )}
                  </div>
                  <button className={soIco} onClick={() => openCustomerForm()} title="Thêm khách hàng mới" aria-label="Thêm khách hàng mới"><Plus className="h-4 w-4" aria-hidden /></button>
                </div>
              </Field>
              <Field label="Mã đơn hàng"><input className={cn(inputCls, 'font-mono')} value={code} disabled={!!edit} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={autoCode} aria-label="Mã đơn hàng" /></Field>
              <Field label="Nguồn đơn hàng"><input className={inputCls} list="so-origins-f" value={origin} onChange={(e) => setOrigin(e.target.value)} /></Field>
              <Field label="Người thực hiện"><select className={inputCls} value={byId} onChange={(e) => setById(e.target.value)}>{users.filter((u) => u.active || u.id === byId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
              {!mfg ? <Field label="Kho xuất"><select className={inputCls} value={whId} onChange={(e) => setWhId(e.target.value)}>{warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field> : <div />}
              <Field label="Nguồn chứng từ"><input className={inputCls} value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="PO, hợp đồng" /></Field>
              <Field label="Số hóa đơn thuế"><input className={inputCls} disabled placeholder="Kế toán nhập khi xuất hóa đơn" /></Field>
            </div>
            <datalist id="so-origins-f">{Array.from(new Set(['Tại quầy', 'Điện thoại', 'Zalo', 'Website', ...salesOrders.map((o) => o.origin).filter((x): x is string => !!x)])).map((x) => <option key={x} value={x} />)}</datalist>
          </SoCard>
          <SoCard pad={false} title={<>Hàng hóa <span className="text-[12.5px] font-normal text-[rgb(var(--muted))]">{lines.length} dòng</span></>} action={<>
            <div className="relative w-[300px] max-sm:w-[200px]">
              <input className={inputCls} value={find} onChange={(e) => setFind(e.target.value)} placeholder={mfg ? 'Tìm vật tư, sản phẩm gia công' : 'Quét mã vạch hoặc gõ tìm nhanh'} aria-label="Tìm hàng hóa" onKeyDown={(e) => { if (e.key === 'Enter' && catalog[0]) { e.preventDefault(); add(catalog[0]); } }} />
              {catalog.length > 0 && (
                <ul className="absolute right-0 top-full z-20 mt-1 w-[420px] max-w-[90vw] overflow-hidden rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-lg" role="listbox">
                  {catalog.map((p, i) => <li key={`${p.kind}:${p.ref}`} role="option" aria-selected={i === 0}><button className={cn('flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-[rgb(var(--ink)/0.04)]', i === 0 && 'bg-[rgb(var(--accent)/0.06)]')} onClick={() => add(p)}><span className="min-w-0 truncate">{p.name}</span><span className="shrink-0 text-[12px] text-[rgb(var(--muted))]">{p.sub}</span></button></li>)}
                </ul>
              )}
            </div>
            {!mfg && <select className={cn(inputBase, 'w-36')} value={tier} onChange={(e) => { const tr = e.target.value as PriceTier; setTier(tr); setLines((ls) => ls.map((l) => (l.kind === 'SKU' ? { ...l, price: tierPrice(skus.find((k) => k.sku === l.ref), tr) || l.price } : l))); }} aria-label="Bảng giá">{(['BASE', 'DEALER', 'PROJECT'] as PriceTier[]).map((x) => <option key={x} value={x}>{PRICE_TIER[x]}</option>)}</select>}
          </>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13.5px]">
                <thead><tr className="border-y border-[rgb(var(--line))]"><th className={cn(soTh, 'w-10 pl-5')}>#</th><th className={cn(soTh, 'w-[120px]')}>Mã sản phẩm</th><th className={soTh}>Tên sản phẩm</th><th className={cn(soTh, 'w-16')}>ĐVT</th><th className={cn(soTh, 'w-20 text-right')}>Tồn kho</th><th className={cn(soTh, 'w-20 text-right')}>Số lượng</th><th className={cn(soTh, 'w-28 text-right')}>Đơn giá</th><th className={cn(soTh, 'w-16 text-right')}>CK%</th><th className={cn(soTh, 'w-28 text-right')}>CK (đ)</th><th className={cn(soTh, 'w-20 text-right')}>VAT%</th><th className={cn(soTh, 'w-32 text-right')}>Thành tiền</th><th className={cn(soTh, 'w-10 pr-5')}><span className="sr-only">Xóa</span></th></tr></thead>
                <tbody>
                  {stock.map(({ l, short: s, track, res, free }, i) => (
                    <tr key={l.id} className="border-b border-[rgb(var(--ink)/0.06)]">
                      <td className={cn(soTd, 'pl-5 text-[rgb(var(--muted))]')}>{i + 1}</td>
                      <td className={soTd}>{l.kind === 'SKU' || l.kind === 'FREE' ? <input className={cn(inputBase, 'w-full min-w-0 px-2 py-1 font-mono text-[12.5px]')} list={mfg ? undefined : 'so-sku-codes'} value={l.ref ?? ''} onChange={(e) => { const x = mfg ? undefined : skuBy(e.target.value); if (x) fromSku(l.id, x); else upd(l.id, { kind: 'FREE', ref: e.target.value || undefined }); }} aria-label={`Mã sản phẩm dòng ${i + 1}`} /> : <Code>{l.ref ?? '—'}</Code>}</td>
                      <td className={soTd}>{l.kind === 'SKU' || l.kind === 'FREE' ? <input className={cn(inputBase, 'w-full min-w-[180px] px-2 py-1 text-[13.5px]')} list={mfg ? undefined : 'so-sku-names'} value={l.name} onChange={(e) => { const x = mfg ? undefined : skuBy(e.target.value); if (x && l.kind === 'FREE') fromSku(l.id, x); else upd(l.id, { name: e.target.value }); }} placeholder="Tên hàng hóa, dịch vụ" aria-label={`Tên sản phẩm dòng ${i + 1}`} title={l.name} /> : <span className="block max-w-[260px] truncate font-medium" title={l.name}>{l.name}</span>}</td>
                      <td className={cn(soTd, 'text-[rgb(var(--muted))]')}>{l.kind === 'FREE' ? <input className={cn(inputBase, 'w-14 px-2 py-1 text-[13px]')} value={l.unit} onChange={(e) => upd(l.id, { unit: e.target.value })} aria-label="Đơn vị tính" /> : l.unit}</td>
                      <td className={cn(soTd, 'text-right tabular-nums', s > 0 && 'text-[rgb(var(--accent-fg))]')} title={s > 0 ? `Thiếu ${fmtN(s)}` : undefined}>{track ? <span className="inline-flex items-center gap-1">{s > 0 && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}{fmtN(res + free)}</span> : '—'}</td>
                      <td className={soTd}><input className={cn(cellIn, s > 0 && 'border-[rgb(var(--danger))]')} inputMode="decimal" value={l.qty} onChange={(e) => upd(l.id, { qty: Math.max(0, Number(e.target.value.replace(',', '.')) || 0) })} aria-label={`Số lượng ${l.name}`} /></td>
                      <td className={soTd}><input className={cellIn} inputMode="numeric" value={l.price ? fmtN(l.price) : ''} onChange={(e) => upd(l.id, { price: digits(e.target.value) })} aria-label={`Đơn giá ${l.name}`} /></td>
                      <td className={soTd}><input className={cellIn} inputMode="decimal" value={l.discountPct || ''} onChange={(e) => upd(l.id, { discountPct: Math.min(100, Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) })} placeholder="0" aria-label={`Chiết khấu % ${l.name}`} /></td>
                      <td className={soTd}><input className={cellIn} inputMode="numeric" value={ckd(l) ? fmtN(ckd(l)) : ''} onChange={(e) => { const g = Math.round(l.qty * l.price); const v = Math.min(g, digits(e.target.value)); upd(l.id, { discountPct: g ? Math.round((v / g) * 10000) / 100 : 0 }); }} placeholder="0" aria-label={`Chiết khấu tiền ${l.name}`} /></td>
                      <td className={soTd}><select className={cn(inputBase, 'w-full px-1.5 py-1 text-right text-[13px]')} value={l.vat} onChange={(e) => upd(l.id, { vat: Number(e.target.value) })} aria-label={`VAT ${l.name}`}>{[0, 5, 8, 10].map((v) => <option key={v} value={v}>{v}</option>)}</select></td>
                      <td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(saleLineNet(l))}</td>
                      <td className={cn(soTd, 'pr-5 text-right')}><button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label={`Xóa dòng ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden /></button></td>
                    </tr>
                  ))}
                  <tr className="border-b border-[rgb(var(--ink)/0.06)]"><td /><td colSpan={11} className="py-2.5"><button className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[rgb(var(--accent-fg))] hover:underline" onClick={addRow}><Plus className="h-4 w-4" aria-hidden />Thêm sản phẩm</button></td></tr>
                  {lines.length > 0 && (
                    <tr className="bg-[rgb(var(--ink)/0.03)]">
                      <td /><td colSpan={4} className={cn(soTd, 'text-[rgb(var(--muted))]')}>Cộng {fmtN(sumQty)} đơn vị · {lines.length} mặt hàng</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(sumQty)}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.gross)}</td><td />
                      <td className={cn(soTd, 'text-right tabular-nums')}>{t.discount ? `−${fmtN(t.discount)}` : '0'}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.vat)}</td>
                      <td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(t.net)}</td><td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {(short.length > 0 || reasons.length > 0) && (
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-5 py-3">
                {short.map((x) => <Chip key={x.l.id} tone="orange">{x.l.ref ?? x.l.name} thiếu {fmtN(x.short)}</Chip>)}
                {reasons.map((r) => <Chip key={r} tone="orange">{r}</Chip>)}
              </div>
            )}
            {!mfg && <datalist id="so-sku-codes">{skus.filter((x) => !x.archived).slice(0, 500).map((x) => <option key={x.sku} value={x.sku}>{x.name}</option>)}</datalist>}
            {!mfg && <datalist id="so-sku-names">{skus.filter((x) => !x.archived).slice(0, 500).map((x) => <option key={x.sku} value={x.name}>{x.sku}</option>)}</datalist>}
          </SoCard>
          <SoCard title="Giao hàng & ghi chú">
            <div className="flex flex-wrap gap-2">
              <div className={cn(segBox, 'w-full sm:w-auto')} role="radiogroup" aria-label="Giao nhận">{(Object.keys(DLV) as SaleDelivery[]).map((d) => <button key={d} role="radio" aria-checked={delivery === d} className={seg(delivery === d)} onClick={() => setDelivery(d)}>{DLV[d]}</button>)}</div>
              <input className={cn(inputBase, 'min-w-[200px] flex-1')} value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="Người nhận" aria-label="Người nhận" />
              <input className={cn(inputBase, 'w-40')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại" inputMode="tel" aria-label="Số điện thoại" />
              {delivery !== 'PICKUP' && <input type="date" className={cn(inputBase, 'w-40')} value={deliverAt} onChange={(e) => setDeliverAt(e.target.value)} aria-label="Ngày giao" />}
            </div>
            {delivery !== 'PICKUP' && <input className={cn(inputCls, 'mt-2')} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Địa chỉ giao hàng" aria-label="Địa chỉ giao hàng" />}
            <input className={cn(inputCls, 'mt-2')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú cho kho / giao vận" aria-label="Ghi chú" />
          </SoCard>
        </div>
        <div className="space-y-4">
          <SoCard title="Quy trình xử lý">
            <SoFlow steps={soSteps(draftO, 'READY', [], users, { needs, reasons })} />
            <div className="mt-3 space-y-2 border-t border-[rgb(var(--line))] pt-3 text-[13px]">
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} />Khách lấy hóa đơn thuế</label>
            </div>
          </SoCard>
          <SoCard title="Thanh toán">
            <div className={segBox} role="radiogroup" aria-label="Thanh toán">
              {([['CASH', 'Tiền mặt'], ['BANK', 'Chuyển khoản'], ['CREDIT', 'Công nợ']] as [SalePay, string][]).map(([p, tx]) => <button key={p} role="radio" aria-checked={p === 'CREDIT' ? credit : pay === p} className={seg(p === 'CREDIT' ? credit : pay === p)} onClick={() => setPay(p)}>{tx}</button>)}
            </div>
            {credit && (
              <div className="mt-2"><Field label="Hạn trả (ngày)"><input className={inputCls} inputMode="numeric" value={creditDays} onChange={(e) => setCreditDays(digits(e.target.value))} /></Field></div>
            )}
            {delivery !== 'PICKUP' && <div className="mt-2"><Field label="Phí vận chuyển"><MoneyInput value={shipFee} onChange={setShipFee} /></Field></div>}
            <div className="mt-3 border-t border-[rgb(var(--line))] pt-2">
              <SoKv label="Tiền hàng">{fmtN(t.gross)}</SoKv>
              <SoKv label="Chiết khấu">{t.discount ? `−${fmtN(t.discount)}` : '0'}</SoKv>
              <SoKv label="Thuế GTGT">{fmtN(t.vat)}</SoKv>
              {t.ship > 0 && <SoKv label="Phí vận chuyển">{fmtN(t.ship)}</SoKv>}
              <SoKv label="Khách phải trả" big>{fmtN(t.grand)}</SoKv>
              <SoKv label="Doanh số ghi nhận">{fmtN(t.net)}</SoKv>
            </div>
          </SoCard>
          <SoDebt customerId={custId} extra={credit ? t.grand : 0} exceptId={edit?.id} />
        </div>
      </div>
    </div>
  );
}

/** Bảng tồn từng dòng + các bước CRM đã làm; dùng ở chi tiết đơn và ở báo giá đã chốt */
export function SaleStockCard({ o, compact: small, onOpen }: { o: SalesOrder; compact?: boolean; onOpen?: () => void }) {
  const { skus, warehouses, reservations, stockMoves, salesOrders, pos, workOrders, purchaseForSale, splitSale, company, canDo } = useApp();
  const mfg = bizMode(company) === 'MFG';
  const st = saleStock(o, { skus, warehouses, reservations, stockMoves, orders: salesOrders });
  const short = st.filter((x) => x.short > 0);
  const wh = warehouses.find((w) => w.id === o.whId);
  const myPos = pos.filter((p) => o.poIds?.includes(p.id));
  const wo = o.woId ? workOrders.find((w) => w.id === o.woId) : undefined;
  const open = o.status === 'PENDING';
  return (
    <section className="glass-card rounded-xl p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-[14px] font-medium">{small ? 'Đơn bán tự tạo khi chốt' : 'Hàng hóa và tồn kho'}</h3>
        <span className="text-[12.5px] text-[rgb(var(--muted))]">{small ? <><Code>{o.code}</Code> · {SALE_STATUS[o.status].label}</> : wh ? `${wh.name}` : ''}</span>
        {onOpen && <button className={cn(btnGhost, btnSm, 'ml-auto')} onClick={onOpen}>Xem đơn bán</button>}
      </div>
      <table className="mt-2 w-full text-[13px]">
        <thead><tr className="border-b border-[rgb(var(--line))] text-left text-[12px] text-[rgb(var(--muted))]"><th className="py-1.5 font-normal">Hàng hóa</th><th className="text-right font-normal">Cần</th><th className="text-right font-normal">{mfg ? 'Tồn' : `Tồn ${wh?.code ?? ''}`}</th><th className="pl-3 font-normal">Xử lý</th></tr></thead>
        <tbody>
          {st.map((x) => (
            <tr key={x.l.id} className="border-b border-[rgb(var(--ink)/0.05)]">
              <td className="py-1.5"><span className="block max-w-[220px] truncate">{x.l.name}</span></td>
              <td className="text-right tabular-nums">{fmtN(x.l.qty)}</td>
              <td className="text-right tabular-nums">{x.track ? fmtN(x.free + x.res) : '—'}</td>
              <td className="pl-3">{o.status !== 'PENDING' ? <Chip tone="muted">{saleIssued(o) ? 'Đã xuất' : 'Đã hủy'}</Chip> : x.l.kind === 'MAKE' ? <Chip tone="blue">{wo ? `${wo.code} · ${wo.stage === 'DONE' ? 'xong' : 'đang làm'}` : 'Gia công'}</Chip> : !x.track ? <Chip tone="muted">Không trừ kho</Chip> : x.short > 0 ? <Chip tone="orange">Thiếu {fmtN(x.short)}</Chip> : <Chip tone="teal">Đủ · giữ {fmtN(x.l.qty)}{x.res ? `, ${fmtN(Math.min(x.res, x.l.qty))} hàng về theo PO` : ''}</Chip>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && short.length > 0 && (
        <div className="mt-3 rounded-lg bg-[rgb(var(--accent)/0.08)] px-3 py-2.5 text-[13px]">
          <p>Thiếu {short.map((x) => `${fmtN(x.short)} ${x.l.unit} ${x.l.name}`).join(', ')}.{myPos.length ? ` Đã đặt ${myPos.map((p) => p.code).join(', ')}, hàng về tự giữ cho đơn.` : ''}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {!mfg && !myPos.length && <button className={cn(btnPrimary, btnSm)} onClick={() => purchaseForSale(o.id)} disabled={!canDo('po.manage')} title={canDo('po.manage') ? 'Lập phiếu đặt hàng nhà cung cấp cho phần thiếu' : 'Cần quyền Đặt hàng Hãng'}>Tạo phiếu đặt hàng</button>}
            {st.some((x) => x.have > 0 && x.track) && <button className={cn(btnGhost, btnSm)} onClick={() => splitSale(o.id)}>Giao trước phần có sẵn</button>}
          </div>
        </div>
      )}
      {small && (
        <ol className="mt-3 space-y-2 text-[13px]">
          <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--ok)/0.15)] text-[11px] text-[rgb(var(--ok-fg))]">1</span><span>Tạo đơn bán {o.code}, lấy nguyên giá, chiết khấu, VAT, hạn thanh toán từ báo giá</span></li>
          <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--ok)/0.15)] text-[11px] text-[rgb(var(--ok-fg))]">2</span><span>Giữ hàng cho {st.filter((x) => x.track && !x.short).length} mã đủ tồn; trừ tồn thật khi bấm Xuất kho, hủy đơn thì nhả hàng</span></li>
          {short.length > 0 && <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--accent)/0.15)] text-[11px] text-[rgb(var(--accent-fg))]">3</span><span>Đề xuất mua {short.length} mã thiếu{myPos.length ? `: đã lập ${myPos.map((p) => p.code).join(', ')}` : ''}</span></li>}
          <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--ink)/0.08)] text-[11px]">{short.length ? 4 : 3}</span><span>Ghi công nợ phải thu {fmtN(saleTotals(o).grand)} khi xuất kho{o.creditDays ? `, hạn ${o.creditDays} ngày` : ''}</span></li>
        </ol>
      )}
    </section>
  );
}

/** v50: bản in phiếu thu / phiếu chi của đơn */
export function soReceiptHtml(o: SalesOrder, p: Pick<SalePayment, 'amount' | 'method' | 'refund' | 'payer' | 'note' | 'date' | 'at'>, code: string, company: CompanyInfo, by: string) {
  const amt = Math.abs(p.amount);
  const day = p.date ?? iso(new Date(p.at));
  return `<p><b>${esc(company.legalName)}</b><br>${esc(company.address)}</p><h1>${p.refund ? 'PHIẾU CHI' : 'PHIẾU THU'}</h1><p class="c">Số ${esc(code)} · ngày ${fmtDate(day)}</p>
<p>${p.refund ? 'Người nhận' : 'Người nộp'}: <b>${esc(p.payer || o.customer)}</b><br>Khách hàng: ${esc(o.customer)}<br>Lý do: ${esc(p.note || `${p.refund ? 'Hoàn tiền' : 'Thu tiền'} đơn hàng ${o.code}`)}<br>Hình thức: ${p.method === 'CASH' ? 'Tiền mặt' : `Chuyển khoản${company.bankAccount ? ` · ${esc(company.bankName)} ${esc(company.bankAccount)}` : ''}`}</p>
<p>Số tiền: <b>${fmtN(amt)} đ</b><br><b>Bằng chữ:</b> <i>${moneyToWordsVN(amt)}</i></p>
<table class="layout sign"><tr><td><b>${p.refund ? 'NGƯỜI NHẬN TIỀN' : 'NGƯỜI NỘP TIỀN'}</b><br>(Ký, ghi rõ họ tên)<br><br><br><br></td><td><b>NGƯỜI LẬP PHIẾU</b><br>(Ký, ghi rõ họ tên)<br><br><br>${esc(by)}</td></tr></table>`;
}

/** v50: trang Ghi thu của đơn (trang riêng) */
export function SalePayPage({ o, onBack }: { o: SalesOrder; onBack: () => void }) {
  const { addSalePayment, confirmSalePayment, users, me, company, canDo, cashEntries } = useApp();
  const t = saleTotals(o);
  const ret = saleReturned(o);
  const due = t.grand - ret;
  const paidAll = salePaid(o, true);
  const left = due - paidAll;
  const canCash = canDo('cash.manage') || canDo('receipt.confirm');
  const invDone = (o.invReqs ?? []).filter((r) => r.status === 'DONE');
  const R = useSaleRights();
  const [voidId, setVoidId] = useState<string | null>(null);
  const [kind, setKind] = useState<'IN' | 'REFUND'>(left < 0 ? 'REFUND' : 'IN');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<'CASH' | 'BANK'>('BANK');
  const [amt, setAmt] = useState(Math.abs(left));
  const [payer, setPayer] = useState(o.receiver || o.customer);
  const [invNo, setInvNo] = useState(invDone[invDone.length - 1]?.no ?? '');
  const [note, setNote] = useState('');
  const max = kind === 'IN' ? Math.max(0, left) : Math.max(0, -left);
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const pfx = `${kind === 'IN' ? 'PTQ' : 'PCQ'}-${date.slice(0, 4)}-`;
  const code = canCash ? nextCode(cashEntries.filter((x) => x.code.startsWith(pfx)).map((x) => x.code), pfx, 4) : 'Chờ kế toán';
  const after = paidAll + (kind === 'IN' ? amt : -amt);
  const errs: string[] = [];
  if (!(amt > 0)) errs.push('Nhập số tiền');
  else if (amt > max) errs.push(kind === 'IN' ? `Vượt số còn phải thu ${fmtN(max)}` : `Chỉ hoàn tối đa số khách trả thừa ${fmtN(max)}`);
  if (date > todayISO()) errs.push('Ngày thu không được sau hôm nay');
  if (o.status === 'CANCELLED' && kind === 'IN') errs.push('Đơn đã hủy');
  const save = (print: boolean) => {
    if (errs.length) return;
    const extra: SalePayExtra = { date, payer: payer.trim() || undefined, note: note.trim() || undefined, invNo: invNo || undefined, refund: kind === 'REFUND' || undefined };
    addSalePayment(o.id, amt, method, undefined, extra);
    if (print) printHtml(docShell(`${kind === 'IN' ? 'Phiếu thu' : 'Phiếu chi'} ${o.code}`, soReceiptHtml(o, { amount: amt, method, at: Date.now(), ...extra }, code, company, me?.name ?? '')));
    onBack();
  };
  const seg = (on: boolean) => cn('flex flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 text-[13.5px]', on ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]');
  const segBox = 'flex overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.12)] divide-x divide-[rgb(var(--ink)/0.08)]';
  const cashCode = (pid: string) => cashEntries.find((e) => e.source === 'SALE' && e.sourceId === pid)?.code;
  return (
    <div>
      <SoTop crumb={`Quản lý đơn hàng › ${o.code}`} onCrumb={onBack} title={kind === 'REFUND' ? 'Hoàn tiền' : canCash ? 'Lập phiếu thu' : 'Báo đã nhận tiền'} chips={<><Code>{code}</Code><Chip>Nháp</Chip></>}>
        {errs.length > 0 && amt > 0 && <span className="text-[13px] text-[rgb(var(--danger-fg))]">{errs[0]}</span>}
        <button className={btnGhost} onClick={onBack}>Hủy</button>
        <button className={btnGhost} disabled={errs.length > 0} onClick={() => save(true)}><Printer className="h-4 w-4" aria-hidden />Lưu & in phiếu</button>
        <button className={btnPrimary} disabled={errs.length > 0} onClick={() => save(false)}><CheckIcon className="h-4 w-4" aria-hidden />Lưu</button>
      </SoTop>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <SoCard title={kind === 'IN' ? 'Thông tin phiếu thu' : 'Thông tin phiếu chi'}>
            <div className={soGrid}>
              <Field label="Loại phiếu" className="sm:col-span-2"><div className={segBox} role="radiogroup" aria-label="Loại phiếu">
                <button role="radio" aria-checked={kind === 'IN'} className={seg(kind === 'IN')} onClick={() => { setKind('IN'); setAmt(Math.max(0, left)); }}><Coins className="h-4 w-4" aria-hidden />Khách trả</button>
                <button role="radio" aria-checked={kind === 'REFUND'} className={seg(kind === 'REFUND')} disabled={left >= 0} title={left >= 0 ? 'Chỉ hoàn khi khách trả thừa' : undefined} onClick={() => { setKind('REFUND'); setAmt(Math.max(0, -left)); }}><Undo2 className="h-4 w-4" aria-hidden />Hoàn tiền cho khách</button>
              </div></Field>
              <Field label="Mã phiếu"><input className={cn(inputCls, 'font-mono')} value={code} readOnly aria-label="Mã phiếu" /></Field>
              <Field label="Ngày thu"><input type="date" className={inputCls} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Hình thức" className="sm:col-span-2"><div className={segBox} role="radiogroup" aria-label="Hình thức">
                <button role="radio" aria-checked={method === 'CASH'} className={seg(method === 'CASH')} onClick={() => setMethod('CASH')}><Banknote className="h-4 w-4" aria-hidden />Tiền mặt</button>
                <button role="radio" aria-checked={method === 'BANK'} className={seg(method === 'BANK')} onClick={() => setMethod('BANK')}><Building2 className="h-4 w-4" aria-hidden />Chuyển khoản</button>
              </div></Field>
              <Field label={kind === 'IN' ? 'Tài khoản nhận' : 'Tài khoản chi'}><input className={inputCls} readOnly value={method === 'CASH' ? 'Quỹ tiền mặt' : [company.bankName, company.bankAccount].filter(Boolean).join(' · ') || 'Tài khoản ngân hàng'} aria-label="Tài khoản" /></Field>
              <Field label={kind === 'IN' ? 'Người nộp' : 'Người nhận'}><input className={inputCls} value={payer} onChange={(e) => setPayer(e.target.value)} /></Field>
              <Field label="Số tiền" className="sm:col-span-2">
                <div className="flex items-center gap-2">
                  <input className={cn(inputBase, 'min-w-0 flex-1 border-[rgb(var(--accent))] py-2 text-right text-[22px] font-medium tabular-nums')} inputMode="numeric" value={amt ? fmtN(amt) : ''} onChange={(e) => setAmt(digits(e.target.value))} aria-label="Số tiền" />
                  {kind === 'IN' && <><button className={cn(btnGhost, btnSm)} onClick={() => setAmt(Math.max(0, left))}>Thu đủ</button><button className={cn(btnGhost, btnSm)} onClick={() => setAmt(Math.round(Math.max(0, left) / 2))}>50%</button></>}
                </div>
              </Field>
              <Field label="Gắn hóa đơn thuế"><select className={inputCls} value={invNo} onChange={(e) => setInvNo(e.target.value)}><option value="">Không gắn</option>{invDone.map((r) => <option key={r.id} value={r.no}>{r.no} · {fmtN(r.amount)}</option>)}</select></Field>
              <Field label="Người lập"><input className={inputCls} readOnly value={me?.name ?? ''} /></Field>
              <Field label="Ghi chú" className="sm:col-span-2 xl:col-span-4"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'IN' ? `Thu tiền đơn hàng ${o.code}` : `Hoàn tiền đơn hàng ${o.code}`} /></Field>
            </div>
          </SoCard>
          <SoCard pad={false} title={<>Lịch sử thu chi của đơn <span className="text-[12.5px] font-normal text-[rgb(var(--muted))]">{o.payments.length}</span></>}>
            {o.payments.length || ret > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-[13.5px]">
                  <thead><tr className="border-y border-[rgb(var(--line))]"><th className={cn(soTh, 'pl-5')}>Mã phiếu</th><th className={soTh}>Ngày</th><th className={soTh}>Loại</th><th className={soTh}>Hình thức</th><th className={cn(soTh, 'text-right')}>Số tiền</th><th className={soTh}>Người lập</th><th className={soTh}>Người xác nhận</th><th className={soTh}>Trạng thái</th><th className={cn(soTh, 'w-10 pr-5')} /></tr></thead>
                  <tbody>
                    {o.payments.map((p) => (
                      <tr key={p.id} className="border-b border-[rgb(var(--ink)/0.06)]">
                        <td className={cn(soTd, 'pl-5')}>{cashCode(p.id) ? <Code>{cashCode(p.id)}</Code> : '—'}</td>
                        <td className={cn(soTd, 'tabular-nums text-[rgb(var(--fg2))]')}>{fmtDate(p.date ?? iso(new Date(p.at)))}</td>
                        <td className={soTd}>{p.refund ? 'Hoàn tiền' : 'Khách trả'}</td>
                        <td className={soTd}>{p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</td>
                        <td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(p.amount)}</td>
                        <td className={soTd}>{nm(p.by) || '—'}</td>
                        <td className={soTd}>{nm(p.confirmedBy) || '—'}</td>
                        <td className={soTd}><span className="flex items-center gap-1.5">{p.confirmed ? <Chip tone="teal">Đã xác nhận</Chip> : canCash ? <button className={cn(btnGhost, btnSm)} onClick={() => confirmSalePayment(o.id, p.id)}>Xác nhận</button> : <Chip tone="orange">Chờ kế toán</Chip>}{(R.canVoidPay() || (!p.confirmed && p.by === me?.id)) && (voidId === p.id ? <><button className={cn(btnGhost, btnSm, 'text-[rgb(var(--danger-fg))]')} onClick={() => { R.voidPay(o, p, cashCode(p.id)); setVoidId(null); }}>Xác nhận hủy</button><button className={cn(btnGhost, btnSm)} onClick={() => setVoidId(null)}>Thôi</button></> : <button className={cn(btnGhost, btnSm)} onClick={() => setVoidId(p.id)}>Hủy</button>)}</span></td>
                        <td className={cn(soTd, 'pr-5')}><button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => printHtml(docShell(`${p.refund ? 'Phiếu chi' : 'Phiếu thu'} ${o.code}`, soReceiptHtml(o, p, cashCode(p.id) ?? o.code, company, nm(p.by))))} aria-label="In phiếu" title="In phiếu"><Printer className="h-4 w-4" aria-hidden /></button></td>
                      </tr>
                    ))}
                    {ret > 0 && <tr className="border-b border-[rgb(var(--ink)/0.06)] text-[rgb(var(--fg2))]"><td className={cn(soTd, 'pl-5')}>—</td><td className={soTd} /><td className={soTd}>Giảm trừ trả hàng</td><td className={soTd}>Trừ vào phải thu</td><td className={cn(soTd, 'text-right tabular-nums')}>−{fmtN(ret)}</td><td className={soTd} colSpan={4} /></tr>}
                    <tr className="bg-[rgb(var(--ink)/0.03)]"><td colSpan={4} className={cn(soTd, 'pl-5 text-[rgb(var(--muted))]')}>Đã thu sau phiếu này</td><td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(after)}</td><td colSpan={4} className={cn(soTd, 'text-[rgb(var(--muted))]')}>phải thu {fmtN(due)}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : <p className="px-5 pb-5 text-[13.5px] text-[rgb(var(--muted))]">Chưa có phiếu thu</p>}
          </SoCard>
        </div>
        <div className="space-y-4">
          <SoCard title="Đơn hàng" action={<Code>{o.code}</Code>}>
            <p className="font-medium">{o.customer}</p>
            <p className="text-[12.5px] text-[rgb(var(--muted))]">{[nm(o.by), SALE_PAY[o.pay] + (o.creditDays ? ` ${o.creditDays} ngày` : ''), o.creditDays && o.issuedAt ? `hạn ${fmtDate(saleDue(o))}` : ''].filter(Boolean).join(' · ')}</p>
            <div className="mt-3">
              <SoKv label="Tổng sau VAT">{fmtN(t.grand)}</SoKv>
              {ret > 0 && <SoKv label="Hàng trả lại">−{fmtN(ret)}</SoKv>}
              <SoKv label="Thực tế phải thu" big>{fmtN(due)}</SoKv>
              <SoKv label="Đã thu / báo nhận">{fmtN(paidAll)}</SoKv>
              <SoKv label="Phiếu này">{kind === 'IN' ? fmtN(amt) : `−${fmtN(amt)}`}</SoKv>
              <SoKv label="Còn lại sau phiếu" tone={due - after > 0 ? 'warn' : undefined}>{fmtN(due - after)}</SoKv>
            </div>
            {due > 0 && <div className="mt-2"><SoBar parts={[{ pct: (paidAll / due) * 100, cls: 'bg-[rgb(var(--fg))]' }, { pct: ((after - paidAll) / due) * 100, cls: 'bg-[rgb(var(--accent)/0.55)]' }]} /></div>}
          </SoCard>
          <SoCard title="Quy trình thu">
            <SoFlow steps={[
              { label: 'Lập phiếu', at: 'đang soạn', sub: me?.name, state: 'now' },
              { label: 'Kế toán xác nhận', sub: canCash ? 'bạn là kế toán: xác nhận khi lưu' : 'đối chiếu sổ quỹ / sao kê', state: 'todo' },
              { label: 'Ghi nhận doanh thu', sub: 'giảm phải thu đơn và công nợ khách', state: 'todo' },
            ]} />
          </SoCard>
          <SoDebt customerId={o.customerId} exceptId={o.id} />
        </div>
      </div>
    </div>
  );
}

/** v50: trang Duyệt đơn bán (trang riêng, không phải bảng trượt) */
export function SaleApprove({ o, onBack, onGo }: { o: SalesOrder; onBack: () => void; onGo: (id: string) => void }) {
  const app = useApp();
  const { users, warehouses, skus, reservations, stockMoves, salesOrders, customers, wfRuns, wfDef, stockVouchers, quotes, notify } = app;
  const { todo } = useApprovalQueue();
  const ar = useArItems();
  const queue = todo.filter((x) => x.kind === 'SALE');
  const item = queue.find((x) => x.key === `so-${o.id}`);
  const idx = item ? queue.indexOf(item) : -1;
  const R = useSaleRights();
  const self = !item && R.canSelf(o);
  const can = !!item || self;
  const [seen, setSeen] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setSeen([]); setNote(''); }, [o.id]);
  const stage = saleStage(o, stockVouchers);
  const t = saleTotals(o);
  const cust = customers.find((c) => c.id === o.customerId);
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const stock = saleStock(o, { skus, warehouses, reservations, stockMoves, orders: salesOrders });
  const short = stock.filter((x) => x.short > 0);
  const credit = o.pay === 'CREDIT' || o.pay === 'PARTIAL';
  const mine = ar.filter((x) => !!cust && x.customerId === cust.id && x.outstanding > 0);
  const owe = mine.reduce((s, x) => s + x.outstanding, 0);
  const today = todayISO();
  const od = mine.filter((x) => overdueDays(x.dueDate, today) > 0);
  const odSum = od.reduce((s, x) => s + x.outstanding, 0);
  const lim = cust?.creditLimit ?? 0;
  const costOf = (l: SaleLine) => (l.kind === 'SKU' ? skus.find((k) => k.sku === l.ref)?.costPrice ?? 0 : 0);
  const priced = o.lines.filter((l) => costOf(l) > 0 && l.qty > 0);
  const rev = priced.reduce((s, l) => s + saleLineNet(l), 0);
  const cost = priced.reduce((s, l) => s + costOf(l) * l.qty, 0);
  const gm = rev > 0 ? ((rev - cost) / rev) * 100 : null;
  const lineGm = priced.map((l) => ({ l, m: ((saleLineNet(l) / l.qty - costOf(l)) / (saleLineNet(l) / l.qty || 1)) * 100 })).sort((a, b) => a.m - b.m);
  const below = lineGm.filter((x) => x.m < 0);
  const maxDisc = Math.max(0, ...o.lines.map((l) => l.discountPct));
  const reasons = o.approval?.self ? [] : o.approval?.reasons ?? [];
  const DLV: Record<SaleDelivery, string> = { PICKUP: 'Tại quầy', DELIVER: 'Giao hàng', CARRIER: 'Chành xe' };
  type Check = { id: string; label: string; bad: boolean; result: string; detail: string; act: string };
  const checks: Check[] = [
    { id: 'rule', label: 'Điều kiện cần duyệt', bad: reasons.length > 0, result: reasons.length ? `${reasons.length} điều kiện` : 'Không có', detail: reasons.join('; ') || 'Đơn trong ngưỡng', act: reasons.length ? 'Theo quy trình Đơn bán' : '—' },
    { id: 'disc', label: 'Giá & chiết khấu', bad: false, result: maxDisc ? `CK tới ${maxDisc}%` : 'Không CK', detail: maxDisc ? `${o.lines.filter((l) => l.discountPct === maxDisc).map((l) => l.ref ?? l.name).join(', ')} · tổng CK ${fmtN(t.discount)}` : `Theo ${quotes.find((x) => x.id === o.quoteId)?.code ?? 'bảng giá'}`, act: '—' },
    { id: 'stock', label: 'Tồn kho khả dụng', bad: short.length > 0, result: short.length ? `Thiếu ${fmtN(short.reduce((s, x) => s + x.short, 0))}` : 'Đủ hàng', detail: short.length ? short.map((x) => `${x.l.ref ?? x.l.name} có ${fmtN(x.have)} / ${fmtN(x.l.qty)}`).join(' · ') : `${stock.filter((x) => x.track).length} / ${o.lines.length} dòng theo dõi tồn đủ`, act: short.length ? 'Giữ chỗ phần có, phần thiếu chờ hàng' : '—' },
    { id: 'debt', label: 'Hạn mức công nợ', bad: !!cust && ((lim > 0 && credit && owe + t.grand > lim) || odSum > 0), result: !cust ? 'Khách lẻ' : odSum > 0 ? 'Có quá hạn' : lim > 0 && credit && owe + t.grand > lim ? 'Vượt hạn mức' : 'Trong hạn mức', detail: !cust ? '—' : `${compact(owe)} đang nợ${credit ? ` + ${compact(t.grand)} đơn này` : ''}${lim > 0 ? ` / ${compact(lim)}` : ''}`, act: odSum > 0 ? `${od.length} khoản quá hạn · ${compact(odSum)}` : '—' },
    { id: 'ship', label: 'Điều khoản giao hàng', bad: o.delivery !== 'PICKUP' && !o.address, result: o.delivery !== 'PICKUP' && !o.address ? 'Thiếu địa chỉ' : 'Đạt', detail: [DLV[o.delivery], o.deliverAt && fmtDate(o.deliverAt), o.address, o.receiver].filter(Boolean).join(' · '), act: '—' },
    { id: 'gm', label: 'Giá bán so với giá vốn', bad: below.length > 0, result: gm === null ? 'Chưa có giá vốn' : below.length ? `${below.length} dòng dưới giá vốn` : 'Đạt', detail: gm === null ? '—' : `Lãi gộp ${gm.toFixed(1).replace('.', ',')}%${lineGm[0] ? ` · thấp nhất ${lineGm[0].l.ref ?? lineGm[0].l.name} ${lineGm[0].m.toFixed(1).replace('.', ',')}%` : ''}`, act: below.length ? 'Xem lại đơn giá' : '—' },
  ];
  const flagged = checks.filter((c) => c.bad);
  const ready = flagged.every((c) => seen.includes(c.id));
  // ---- quy trình duyệt nhiều bước
  const s: WfSubject = { requesterId: o.approval?.requestedBy ?? o.by, dept: cust?.dept, amount: t.grand, vals: { amount: t.grand, maxDisc } };
  const run = wfRuns.filter((r) => r.key === 'SALE' && r.refId === o.id).sort((a, b) => b.startedAt - a.startedAt)[0];
  const def = wfDef('SALE');
  const steps = o.approval?.self ? [] : run?.steps ?? (def ? wfPath(def, s) : []);
  const wctx = app.wfCtx();
  const cur = run ? run.decisions.filter((d) => d.decision === 'APPROVED').length : 0;
  const flow: SoStep[] = [
    { label: 'Gửi duyệt', at: o.approval ? soTime(o.approval.requestedAt) : soTime(o.createdAt), sub: nm(o.approval?.requestedBy ?? o.by), state: 'done' },
    ...steps.map((st, i): SoStep => {
      const d = run?.decisions.filter((x) => x.step === i).slice(-1)[0];
      const done = d?.decision === 'APPROVED' || (o.approval?.status === 'APPROVED' && !run);
      const now = !done && i === cur && o.approval?.status === 'PENDING';
      return { label: `Bước ${i + 1} · ${st.name}`, at: d ? soTime(d.at) : undefined, chip: now && item ? <Chip tone="orange">bạn</Chip> : d?.decision === 'REJECTED' ? <Chip tone="red">từ chối</Chip> : undefined, sub: d ? `${nm(d.by)}${d.note ? ` · ${d.note}` : ''}` : wfApprovers(st, s, wctx).map((x) => x.u.name).join(', '), state: done ? 'done' : now ? 'now' : 'todo' };
    }),
    ...(o.approval?.self ? [{ label: 'Duyệt đơn', at: o.approval.decidedAt ? soTime(o.approval.decidedAt) : undefined, sub: o.approval.decidedBy ? nm(o.approval.decidedBy) : 'người lên đơn hoặc quản lý', chip: self ? <Chip tone="orange">bạn</Chip> : undefined, state: o.approval.status === 'APPROVED' ? 'done' as const : 'now' as const }] : []),
    { label: 'Yêu cầu xuất kho', sub: 'sau khi duyệt đủ', state: o.approval?.status === 'APPROVED' ? 'done' : 'todo' },
  ];
  // ---- CRM 3A phân tích: thói quen trả tiền của khách
  const since = addDaysISO(today, -183);
  const hist = cust ? salesOrders.filter((x) => x.customerId === cust.id && x.id !== o.id && x.creditDays > 0 && x.issuedAt && x.date >= since && x.payments.some((p) => p.confirmed)) : [];
  const lates = hist.map((x) => { const last = Math.max(...x.payments.filter((p) => p.confirmed).map((p) => p.confirmedAt ?? p.at)); return overdueDays(saleDue(x), iso(new Date(last))); });
  const avgLate = lates.length ? Math.round(lates.reduce((a, b) => a + Math.max(0, b), 0) / lates.length) : null;
  const tip = !cust ? null : avgLate === null ? 'Chưa có lịch sử thanh toán công nợ trong 6 tháng' : avgLate > 0 ? `Khách trả chậm trung bình ${avgLate} ngày trong 6 tháng (${lates.length} đơn).${credit ? ' Nên nhắc thu trước hạn 3 ngày.' : ''}` : `Khách trả đúng hạn ${lates.length} đơn gần nhất trong 6 tháng.`;
  const act = (kind: 'ok' | 'no' | 'info') => {
    if (!can) return;
    if (kind === 'ok') { if (!ready) return notify('Đánh dấu đã xem các điểm cần lưu ý trước khi duyệt', 'red'); if (item) item.approve?.(); else R.selfApprove(o); }
    else {
      if (note.trim().length < 3) { noteRef.current?.focus(); return notify('Nhập ý kiến duyệt', 'red'); }
      if (kind === 'no') { if (item) item.reject?.(note.trim()); else R.selfReject(o, note.trim()); }
      else if (item?.needInfo) item.needInfo(note.trim());
      else {
        app.setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, notes: [...(x.notes ?? []), { id: uid('sn'), by: app.me?.id, at: Date.now(), text: `Yêu cầu bổ sung: ${note.trim()}` }] } : x)));
        const u = users.find((x) => x.id === (o.approval?.requestedBy ?? o.by));
        if (u && u.id !== app.me?.id) app.dispatch('APPROVAL_RESULT', { to: u, title: `Yêu cầu bổ sung: ${o.code}`, body: note.trim(), module: 'sales' });
        notify(`Đã gửi yêu cầu bổ sung cho ${nm(u?.id) || 'người lên đơn'}`, 'teal');
        setNote('');
        return;
      }
    }
    if (!item) return onBack();
    const next = queue.filter((x) => x.key !== item.key)[Math.min(idx, queue.length - 2)];
    if (next) onGo(next.refId); else onBack();
  };
  return (
    <div>
      <SoTop crumb={`Quản lý đơn hàng › ${o.code}`} onCrumb={onBack} title="Duyệt đơn" chips={o.approval?.status === 'PENDING' ? <Chip tone="orange">Chờ duyệt{steps.length > 1 ? ` · bước ${Math.min(cur + 1, steps.length)} / ${steps.length}` : ''}</Chip> : <Chip tone={SALE_STAGE[stage].tone}>{o.approval ? DECISION_LABEL[o.approval.status as ApprovalDecision]?.label ?? SALE_STAGE[stage].label : 'Tự duyệt'}</Chip>}>
        {item && queue.length > 0 && (
          <span className="flex items-center gap-1.5 text-[13px] text-[rgb(var(--muted))]">
            <button className={cn(soIco, 'h-8 w-8')} disabled={idx <= 0} onClick={() => onGo(queue[idx - 1].refId)} aria-label="Đơn trước"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
            <span className="tabular-nums">{idx + 1} / {queue.length} đơn chờ bạn duyệt</span>
            <button className={cn(soIco, 'h-8 w-8')} disabled={idx >= queue.length - 1} onClick={() => onGo(queue[idx + 1].refId)} aria-label="Đơn sau"><ChevronRight className="h-4 w-4" aria-hidden /></button>
          </span>
        )}
        {can ? <>
          <button className={cn(btnGhost, 'text-[rgb(var(--danger-fg))]')} onClick={() => act('no')}><X className="h-4 w-4" aria-hidden />Từ chối</button>
          {<button className={btnGhost} onClick={() => act('info')}><Undo2 className="h-4 w-4" aria-hidden />Yêu cầu bổ sung</button>}
          <button className={cn(btnPrimary, !ready && 'opacity-60')} onClick={() => act('ok')} title={ready ? undefined : 'Đánh dấu đã xem các điểm cần lưu ý'}><CheckIcon className="h-4 w-4" aria-hidden />{cur + 1 < steps.length ? 'Duyệt, chuyển bước sau' : 'Duyệt & giữ chỗ'}</button>
        </> : <button className={btnGhost} onClick={onBack}>Về đơn hàng</button>}
      </SoTop>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <SoCard title="Thông tin đơn hàng">
            <div className={soGrid}>
              <SoInfo label="Khách hàng" span={2}><Building2 className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="truncate">{o.customer}</span>{cust && <span className="truncate text-[12.5px] text-[rgb(var(--muted))]">{cust.code}</span>}</SoInfo>
              <SoInfo label="Mã đơn hàng"><Code>{o.code}</Code></SoInfo>
              <SoInfo label="Nguồn đơn hàng">{o.quoteId ? <>Từ báo giá <Code>{quotes.find((x) => x.id === o.quoteId)?.code ?? ''}</Code></> : o.origin ?? 'Tại quầy'}</SoInfo>
              <SoInfo label="Người thực hiện"><Users className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />{nm(o.by) || '—'}</SoInfo>
              <SoInfo label="Kho xuất"><Warehouse className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />{warehouses.find((w) => w.id === o.whId)?.name ?? '—'}</SoInfo>
              <SoInfo label="Nguồn chứng từ"><FileText className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />{o.docRef || '—'}</SoInfo>
              <SoInfo label="Giao hàng"><Truck className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="truncate">{[DLV[o.delivery], o.deliverAt && fmtDate(o.deliverAt).slice(0, 5), o.address].filter(Boolean).join(' · ')}</span></SoInfo>
            </div>
          </SoCard>
          <SoCard pad={false} title={<>Hàng hóa <span className="text-[12.5px] font-normal text-[rgb(var(--muted))]">{o.lines.length}</span></>} action={<span className="text-[12.5px] tabular-nums text-[rgb(var(--muted))]">{fmtN(o.lines.reduce((s, l) => s + l.qty, 0))} đơn vị{gm !== null ? ` · lãi gộp ${gm.toFixed(1).replace('.', ',')}%` : ''}</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-[13.5px]">
                <thead><tr className="border-y border-[rgb(var(--line))]"><th className={cn(soTh, 'w-10 pl-5')}>#</th><th className={soTh}>Mã sản phẩm</th><th className={soTh}>Tên sản phẩm</th><th className={soTh}>ĐVT</th><th className={cn(soTh, 'text-right')}>Khả dụng</th><th className={cn(soTh, 'text-right')}>Số lượng</th><th className={cn(soTh, 'text-right')}>Đơn giá</th><th className={cn(soTh, 'text-right')}>CK%</th><th className={cn(soTh, 'text-right')}>CK (đ)</th><th className={cn(soTh, 'text-right')}>VAT%</th><th className={cn(soTh, 'pr-5 text-right')}>Thành tiền</th></tr></thead>
                <tbody>
                  {stock.map(({ l, short: sh, track, res, free }, i) => (
                    <tr key={l.id} className="border-b border-[rgb(var(--ink)/0.06)]">
                      <td className={cn(soTd, 'pl-5 text-[rgb(var(--muted))]')}>{i + 1}</td>
                      <td className={soTd}>{l.ref ? <Code>{l.ref}</Code> : '—'}</td>
                      <td className={soTd}><span className="block max-w-[220px] truncate font-medium" title={l.name}>{l.name}</span></td>
                      <td className={cn(soTd, 'text-[rgb(var(--muted))]')}>{l.unit}</td>
                      <td className={cn(soTd, 'text-right tabular-nums', sh > 0 && 'font-medium text-[rgb(var(--accent-fg))]')}>{track ? <span className="inline-flex items-center gap-1">{sh > 0 && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}{fmtN(res + free)}</span> : '—'}</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(l.qty)}</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(l.price)}</td>
                      <td className={cn(soTd, 'text-right tabular-nums', reasons.length > 0 && l.discountPct > 0 && l.discountPct === maxDisc && 'font-medium text-[rgb(var(--accent-fg))]')}>{l.discountPct || 0}</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(Math.round(l.qty * l.price) - saleLineNet(l))}</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{l.vat}</td>
                      <td className={cn(soTd, 'pr-5 text-right font-medium tabular-nums')}>{fmtN(saleLineNet(l))}</td>
                    </tr>
                  ))}
                  <tr className="bg-[rgb(var(--ink)/0.03)]"><td /><td colSpan={4} className={cn(soTd, 'text-[rgb(var(--muted))]')}>Cộng {o.lines.length} mặt hàng</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(o.lines.reduce((a, l) => a + l.qty, 0))}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.gross)}</td><td /><td className={cn(soTd, 'text-right tabular-nums')}>{t.discount ? `−${fmtN(t.discount)}` : '0'}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.vat)}</td><td className={cn(soTd, 'pr-5 text-right font-medium tabular-nums')}>{fmtN(t.net)}</td></tr>
                </tbody>
              </table>
            </div>
          </SoCard>
          <SoCard pad={false} title="Kiểm tra trước khi duyệt" sub={flagged.length ? `${flagged.length} điểm cần xem · đã xem ${flagged.filter((c) => seen.includes(c.id)).length} / ${flagged.length}` : undefined}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13.5px]">
                <thead><tr className="border-y border-[rgb(var(--line))]"><th className={cn(soTh, 'w-12 pl-5')} /><th className={soTh}>Hạng mục</th><th className={soTh}>Kết quả</th><th className={soTh}>Chi tiết</th><th className={cn(soTh, 'pr-5')}>Hướng xử lý</th></tr></thead>
                <tbody>{checks.map((c) => (
                  <tr key={c.id} className="border-b border-[rgb(var(--ink)/0.06)] last:border-0">
                    <td className={cn(soTd, 'pl-5')}>{c.bad ? <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={seen.includes(c.id)} onChange={() => setSeen((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} aria-label={`Đã xem ${c.label}`} disabled={!can} /> : <CheckIcon className="h-4 w-4 text-[rgb(var(--success-fg))]" aria-hidden />}</td>
                    <td className={cn(soTd, 'font-medium')}>{c.label}</td>
                    <td className={soTd}><Chip tone={c.bad ? 'orange' : 'teal'}>{c.result}</Chip></td>
                    <td className={soTd}><span className="block max-w-[420px] truncate" title={c.detail}>{c.detail}</span></td>
                    <td className={cn(soTd, 'pr-5 text-[rgb(var(--fg2))]')}>{c.act}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </SoCard>
          {can && (
            <SoCard title="Ý kiến duyệt">
              <textarea ref={noteRef} className={cn(inputCls, 'min-h-[88px]')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bắt buộc khi từ chối hoặc yêu cầu bổ sung" aria-label="Ý kiến duyệt" />
            </SoCard>
          )}
        </div>
        <div className="space-y-4">
          <SoCard title="Quy trình duyệt"><SoFlow steps={flow} /></SoCard>
          {tip && <section className="glass-card rounded-xl p-4"><p className="flex items-center gap-2 text-[13.5px] font-medium"><span className="h-2 w-2 rounded-sm bg-[rgb(var(--accent))]" aria-hidden />CRM 3A phân tích</p><p className="mt-1.5 text-[13.5px] leading-relaxed text-[rgb(var(--fg2))]">{tip}</p></section>}
          <SoCard title="Thanh toán" action={<span className="text-[12.5px] text-[rgb(var(--muted))]">{SALE_PAY[o.pay]}{o.creditDays ? ` ${o.creditDays} ngày` : ''}</span>}>
            <SoKv label="Tiền hàng">{fmtN(t.gross)}</SoKv>
            <SoKv label="Chiết khấu">{t.discount ? `−${fmtN(t.discount)}` : '0'}</SoKv>
            <SoKv label="Thuế GTGT">{fmtN(t.vat)}</SoKv>
            {t.ship > 0 && <SoKv label="Phí vận chuyển">{fmtN(t.ship)}</SoKv>}
            <SoKv label="Khách phải trả" big>{fmtN(t.grand)}</SoKv>
            <SoKv label="Trả trước">{fmtN(salePaid(o, true))}</SoKv>
          </SoCard>
          <SoDebt customerId={o.customerId} extra={credit ? t.grand - salePaid(o, true) : 0} exceptId={o.id} />
        </div>
      </div>
    </div>
  );
}

export function SaleDetail({ o, onBack, onApprove, onPay, onEdit, startCancel }: { o: SalesOrder; onBack: () => void; onApprove: () => void; onPay: () => void; onEdit: () => void; startCancel?: boolean }) {
  const R = useSaleRights();
  const { quotes, openComposer, requestSaleIssue, setSaleStatus, confirmSalePayment, users, company, canDo, pos, stockVouchers, workOrders, go, requestSaleInvoice, decideSaleInvoice, warehouses, me, setSalesOrders, cashEntries } = useApp();
  const { todo } = useApprovalQueue();
  const myTurn = todo.some((x) => x.key === `so-${o.id}`);
  const t = saleTotals(o);
  const ret = saleReturned(o);
  const due = t.grand - ret;
  const paid = salePaid(o);
  const pend = salePaid(o, true) - paid;
  const left = due - salePaid(o, true);
  const [tab, setTab] = useState<'goods' | 'docs'>('goods');
  const [docF, setDocF] = useState<'ALL' | 'WH' | 'CASH' | 'INV'>('ALL');
  const [logF, setLogF] = useState<'ALL' | 'NOTE' | 'SYS'>('ALL');
  const [msg, setMsg] = useState('');
  const [more, setMore] = useState(false);
  const moreRef = useOutside(more, () => setMore(false));
  const [cancel, setCancel] = useState<string | null>(startCancel ? '' : null);
  const [inv, setInv] = useState<{ amount: number; note: string } | null>(null);
  const [dec, setDec] = useState<Record<string, string>>({});
  const q = o.quoteId ? quotes.find((x) => x.id === o.quoteId) : undefined;
  const stage = saleStage(o, stockVouchers);
  const pq = salePendingQ(o, stockVouchers);
  const canCash = canDo('cash.manage') || canDo('receipt.confirm');
  const vs = stockVouchers.filter((v) => v.saleId === o.id || (!v.saleId && v.ref === o.code)).sort((a, b) => a.createdAt - b.createdAt);
  const wo = o.woId ? workOrders.find((w) => w.id === o.woId) : undefined;
  const remain = o.lines.reduce((s, l) => s + Math.max(0, l.qty - saleIssQ(o, l) - (pq[l.id] ?? 0)), 0);
  const issuedAny = o.lines.some((l) => saleIssQ(o, l) > 0);
  const invAsked = (o.invReqs ?? []).filter((r) => r.status !== 'REJECTED').reduce((s, r) => s + r.amount, 0);
  const invDone = (o.invReqs ?? []).filter((r) => r.status === 'DONE');
  const canReq = o.status === 'PENDING' && stage !== 'APPROVAL' && stage !== 'REJECTED' && remain > 0;
  const canInv = o.status !== 'CANCELLED' && o.invoice !== false && due - invAsked > 0 && stage !== 'APPROVAL' && stage !== 'REJECTED';
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const goods = o.lines.filter((l) => l.kind !== 'FREE');
  const sumQ = (f: (l: SaleLine) => number) => goods.reduce((s, l) => s + f(l), 0);
  const ord = sumQ((l) => l.qty), iss = sumQ((l) => saleIssQ(o, l)), rq = sumQ((l) => saleRetQ(o, l));
  const ckd = (l: SaleLine) => Math.round(l.qty * l.price) - saleLineNet(l);
  const cashCode = (pid: string) => cashEntries.find((e) => e.source === 'SALE' && e.sourceId === pid)?.code;
  type Doc = { key: string; g: 'WH' | 'CASH' | 'INV' | 'OTHER'; code: string; type: ReactNode; date: string; qty?: number; amt?: number; note?: string; who?: string; st: ReactNode; open?: () => void };
  const docs: Doc[] = [
    ...vs.map((v): Doc => ({ key: v.id, g: 'WH', code: v.code, type: <span className="inline-flex items-center gap-1.5">{v.type === 'IN' ? <Undo2 className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /> : <PackageMinus className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />}{v.type === 'IN' ? 'Nhập trả' : 'Phiếu xuất'}</span>, date: v.date, qty: v.lines.reduce((s, l) => s + l.qty, 0), note: v.note, who: nm(v.approvedBy) || undefined, st: <Chip tone={v.status === 'PENDING' ? 'orange' : v.status === 'DONE' ? 'teal' : 'muted'}>{v.status === 'PENDING' ? 'Chờ kho' : v.status === 'DONE' ? (v.type === 'IN' ? 'Đã nhập' : 'Đã xuất') : 'Đã hủy'}</Chip>, open: () => go('warehouse') })),
    ...o.payments.map((p): Doc => ({ key: p.id, g: 'CASH', code: cashCode(p.id) ?? 'Phiếu thu', type: <span className="inline-flex items-center gap-1.5"><Banknote className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />{p.refund ? 'Phiếu chi' : 'Phiếu thu'}</span>, date: p.date ?? iso(new Date(p.at)), amt: p.amount, note: p.note ?? (p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'), who: nm(p.confirmedBy ?? p.by) || undefined, st: <Chip tone={p.confirmed ? 'teal' : 'orange'}>{p.confirmed ? 'Đã xác nhận' : 'Chờ kế toán'}</Chip>, open: onPay })),
    ...(o.invReqs ?? []).map((r): Doc => ({ key: r.id, g: 'INV', code: r.no ?? 'Yêu cầu HĐ', type: <span className="inline-flex items-center gap-1.5"><ReceiptIcon className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Hóa đơn thuế</span>, date: iso(new Date(r.doneAt ?? r.at)), amt: r.amount, note: r.why ?? r.note, who: nm(r.doneBy ?? r.by) || undefined, st: <Chip tone={r.status === 'DONE' ? 'teal' : r.status === 'PENDING' ? 'orange' : 'muted'}>{r.status === 'DONE' ? 'Đã xuất' : r.status === 'PENDING' ? 'Chờ kế toán' : 'Trả lại'}</Chip> })),
    ...(o.issueRefs ?? []).filter((r) => r.startsWith('PX-') && !vs.some((v) => v.code === r)).map((r): Doc => ({ key: r, g: 'WH', code: r, type: 'Xuất vật tư', date: o.issuedAt ? iso(new Date(o.issuedAt)) : o.date, st: <Chip tone="teal">Đã xuất</Chip>, open: () => go('inventory') })),
    ...pos.filter((p) => o.poIds?.includes(p.id)).map((p): Doc => ({ key: p.id, g: 'OTHER', code: p.code, type: 'Đặt hàng NCC', date: p.orderDate, note: p.vendor, st: <Chip tone="blue">Dự kiến {fmtDate(p.expectedDate)}</Chip>, open: () => go('supply') })),
    ...(wo ? [{ key: wo.id, g: 'OTHER' as const, code: wo.code, type: 'Lệnh sản xuất', date: wo.startDate, note: wo.title, st: <Chip tone={WO_STAGE[wo.stage].tone}>{WO_STAGE[wo.stage].label}</Chip>, open: () => go('production') }] : []),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const docsV = docs.filter((d) => docF === 'ALL' || d.g === docF);
  const notes = o.notes ?? [];
  const sys: { at: number; icon: typeof Wallet; text: ReactNode }[] = [
    { at: o.createdAt, icon: FileText, text: <>{nm(o.by) || 'Hệ thống'} tạo đơn{q ? <> từ <Code>{q.code}</Code></> : ''}</> },
    ...(o.approval?.decidedAt ? [{ at: o.approval.decidedAt, icon: CheckIcon, text: <>{nm(o.approval.decidedBy)} {o.approval.status === 'APPROVED' ? 'duyệt đơn' : o.approval.status === 'REJECTED' ? 'từ chối đơn' : 'yêu cầu bổ sung'}{o.approval.note ? ` · ${o.approval.note}` : ''}</> }] : []),
    ...vs.filter((v) => v.status === 'DONE').map((v) => ({ at: v.approvedAt ?? v.createdAt, icon: v.type === 'IN' ? Undo2 : PackageMinus, text: <>{nm(v.approvedBy) || 'Kho'} {v.type === 'IN' ? 'nhập trả' : 'xuất kho'} <Code>{v.code}</Code> · {fmtN(v.lines.reduce((s, l) => s + l.qty, 0))}</> })),
    ...o.payments.filter((p) => p.confirmed).map((p) => ({ at: p.confirmedAt ?? p.at, icon: Banknote, text: <>{nm(p.confirmedBy)} xác nhận {p.refund ? 'hoàn' : 'thu'} {fmtN(Math.abs(p.amount))} · {p.method === 'CASH' ? 'tiền mặt' : 'chuyển khoản'}</> })),
    ...invDone.map((r) => ({ at: r.doneAt ?? r.at, icon: ReceiptIcon, text: <>{nm(r.doneBy)} xuất hóa đơn <Code>{r.no}</Code> · {fmtN(r.amount)}</> })),
  ];
  type Feed = { at: number; note?: SaleNote; s?: (typeof sys)[number] };
  const feed: Feed[] = [...(logF !== 'SYS' ? notes.map((n): Feed => ({ at: n.at, note: n })) : []), ...(logF !== 'NOTE' ? sys.map((x): Feed => ({ at: x.at, s: x })) : [])].sort((a, b) => b.at - a.at);
  const send = () => { const tx = msg.trim(); if (!tx) return; setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: tx }] } : x))); setMsg(''); };
  const ini = (id?: string) => (nm(id) || '?').split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div>
      <SoTop crumb="Quản lý đơn hàng" onCrumb={onBack} title={o.code} chips={<><Chip tone={SALE_STAGE[stage].tone}>{SALE_STAGE[stage].label}</Chip>{issuedAny && o.status !== 'CANCELLED' && <span className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--line))] px-2 py-0.5 text-[12px] text-[rgb(var(--fg2))]"><Lock className="h-3 w-3" aria-hidden />Đã khóa hàng hóa</span>}</>}>
        <div className="flex" ref={moreRef}>
          <button className={cn(soIco, 'rounded-r-none')} onClick={() => printHtml(docShell(`Phiếu bán hàng ${o.code}`, saleHtml(o, company)))} aria-label="In phiếu bán hàng" title="In phiếu bán hàng"><Printer className="h-4 w-4" aria-hidden /></button>
          <div className="relative">
            <button className={cn(soIco, '-ml-px rounded-l-none')} onClick={() => setMore((v) => !v)} aria-label="Thao tác khác" aria-expanded={more}><MoreVertical className="h-4 w-4" aria-hidden /></button>
            {more && (
              <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 text-[13.5px] shadow-xl">
                {q && <button className="block w-full rounded-md px-3 py-2 text-left hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => { setMore(false); openComposer({ quoteId: q.id, view: true, mode: 'QUOTE' }); }}>Mở báo giá {q.code}</button>}
                <button className="block w-full rounded-md px-3 py-2 text-left hover:bg-[rgb(var(--ink)/0.05)] disabled:opacity-40" disabled={!R.canEdit(o)} onClick={() => { setMore(false); onEdit(); }}>Sửa đơn</button>
                {o.status === 'SHIPPING' && <button className="block w-full rounded-md px-3 py-2 text-left hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => { setMore(false); setSaleStatus(o.id, 'DONE'); }}>Đã giao xong</button>}
                <button className="block w-full rounded-md px-3 py-2 text-left text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--ink)/0.05)] disabled:opacity-40" disabled={!R.canCancel(o)} onClick={() => { setMore(false); setCancel(''); }}>Hủy đơn</button>
                {R.canDelete(o) && <button className="block w-full rounded-md px-3 py-2 text-left text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => { setMore(false); R.remove(o); onBack(); }}>Xóa đơn</button>}
              </div>
            )}
          </div>
        </div>
        {o.status !== 'CANCELLED' && stage !== 'APPROVAL' && <button className={btnGhost} onClick={onPay}><Coins className="h-4 w-4" aria-hidden />{canCash ? 'Lập phiếu thu' : 'Báo đã nhận tiền'}</button>}
        {canReq && <button className={btnPrimary} onClick={() => requestSaleIssue(o.id)}><PackageMinus className="h-4 w-4" aria-hidden />Yêu cầu xuất kho</button>}
        {canInv && <button className={btnGhost} onClick={() => setInv({ amount: Math.max(0, due - invAsked), note: '' })}><ReceiptIcon className="h-4 w-4" aria-hidden />Yêu cầu xuất hóa đơn</button>}
        {stage === 'APPROVAL' && <button className={myTurn || R.canSelf(o) ? btnPrimary : btnGhost} onClick={onApprove}><CheckIcon className="h-4 w-4" aria-hidden />{myTurn || R.canSelf(o) ? 'Duyệt đơn' : 'Xem duyệt'}</button>}
      </SoTop>
      {cancel !== null && (
        <div className="glass-card mb-4 flex flex-wrap items-center gap-2 rounded-xl px-4 py-3">
          <input className={cn(inputBase, 'min-w-[240px] flex-1')} value={cancel} onChange={(e) => setCancel(e.target.value)} placeholder="Lý do hủy đơn" aria-label="Lý do hủy" autoFocus />
          <button className={btnGhost} onClick={() => setCancel(null)}>Thôi</button>
          <button className={cn(btnPrimary, 'bg-[rgb(var(--danger))]')} disabled={cancel.trim().length < 3} onClick={() => { R.cancelOrder(o, cancel.trim()); setCancel(null); }}>Hủy đơn</button>
        </div>
      )}
      {inv && (
        <div className="glass-card mb-4 flex flex-wrap items-center gap-2 rounded-xl px-4 py-3">
          <span className="text-[13.5px] font-medium">Yêu cầu xuất hóa đơn</span>
          <div className="w-44"><MoneyInput value={inv.amount} onChange={(v) => setInv({ ...inv, amount: v })} /></div>
          <input className={cn(inputBase, 'min-w-[220px] flex-1')} value={inv.note} onChange={(e) => setInv({ ...inv, note: e.target.value })} placeholder="Ghi chú cho kế toán" aria-label="Ghi chú cho kế toán" />
          <button className={btnGhost} onClick={() => setInv(null)}>Thôi</button>
          <button className={btnPrimary} disabled={!(inv.amount > 0)} onClick={() => { requestSaleInvoice(o.id, inv.amount, inv.note); setInv(null); }}><Send className="h-4 w-4" aria-hidden />Gửi kế toán</button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <SoCard title="Thông tin đơn hàng">
            <div className={soGrid}>
              <SoInfo label="Khách hàng" span={2}><Building2 className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="truncate">{o.customer}</span><span className="truncate text-[12.5px] text-[rgb(var(--muted))]">{[o.taxCode && `MST ${o.taxCode}`, o.phone].filter(Boolean).join(' · ')}</span></SoInfo>
              <SoInfo label="Mã đơn hàng"><Code>{o.code}</Code></SoInfo>
              <SoInfo label="Nguồn đơn hàng">{q ? <button className="hover:underline" onClick={() => openComposer({ quoteId: q.id, view: true, mode: 'QUOTE' })}>Từ báo giá <Code>{q.code}</Code></button> : o.origin ?? 'Tại quầy'}</SoInfo>
              <SoInfo label="Người thực hiện"><Users className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />{nm(o.by) || '—'}</SoInfo>
              <SoInfo label="Kho xuất"><Warehouse className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />{warehouses.find((w) => w.id === o.whId)?.name ?? '—'}</SoInfo>
              <SoInfo label="Nguồn chứng từ"><FileText className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />{o.docRef || '—'}</SoInfo>
              <SoInfo label="Số hóa đơn thuế">{invDone.length ? <>{invDone.map((r) => <Code key={r.id}>{r.no}</Code>)}{due - invDone.reduce((s, r) => s + r.amount, 0) > 0 && <span className="text-[12.5px] text-[rgb(var(--muted))]">còn {compact(due - invDone.reduce((s, r) => s + r.amount, 0))}</span>}</> : o.invoice ? '—' : <span className="text-[rgb(var(--muted))]">Không lấy</span>}</SoInfo>
            </div>
          </SoCard>
          <section className="glass-card min-w-0 overflow-hidden rounded-xl">
            <div className="flex flex-wrap items-center gap-3 border-b border-[rgb(var(--line))] px-5">
              <SoTabs tabs={[{ id: 'goods', label: 'Hàng hóa', count: o.lines.length }, { id: 'docs', label: 'Chứng từ liên quan', count: docs.length }]} value={tab} onChange={setTab} />
              {tab === 'goods' ? <span className="ml-auto py-2 text-[12.5px] tabular-nums text-[rgb(var(--muted))]">{fmtN(ord)} đặt · {fmtN(iss)} đã xuất{rq ? ` · ${fmtN(rq)} trả lại` : ''} · {fmtN(Math.max(0, ord - iss))} còn phải xuất</span> : (
                <div className="ml-auto flex overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.12)] py-0 text-[12.5px] divide-x divide-[rgb(var(--ink)/0.08)]">
                  {([['ALL', 'Tất cả'], ['WH', 'Kho'], ['CASH', 'Thu chi'], ['INV', 'Hóa đơn']] as const).map(([k, tx]) => <button key={k} className={cn('px-3 py-1.5', docF === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => setDocF(k)}>{tx} {k === 'ALL' ? docs.length : docs.filter((d) => d.g === k).length}</button>)}
                </div>
              )}
            </div>
            {tab === 'goods' ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-[13.5px]">
                  <thead><tr className="border-b border-[rgb(var(--line))]"><th className={cn(soTh, 'w-10 pl-5')}>#</th><th className={soTh}>Mã sản phẩm</th><th className={soTh}>Tên sản phẩm</th><th className={soTh}>ĐVT</th><th className={cn(soTh, 'text-right')}>Số lượng</th><th className={cn(soTh, 'text-right')}>Đơn giá</th><th className={cn(soTh, 'text-right')}>CK%</th><th className={cn(soTh, 'text-right')}>CK (đ)</th><th className={cn(soTh, 'text-right')}>VAT%</th><th className={cn(soTh, 'text-right')}>Thành tiền</th><th className={cn(soTh, 'border-l border-[rgb(var(--line))] text-right')}>Đã xuất</th><th className={cn(soTh, 'text-right')}>Trả lại</th><th className={cn(soTh, 'pr-5 text-right')}>Còn phải xuất</th></tr></thead>
                  <tbody>
                    {o.lines.map((l, i) => { const x = saleIssQ(o, l); const r = saleRetQ(o, l); const rest = l.kind === 'FREE' ? 0 : Math.max(0, l.qty - x); return (
                      <tr key={l.id} className="border-b border-[rgb(var(--ink)/0.06)]">
                        <td className={cn(soTd, 'pl-5 text-[rgb(var(--muted))]')}>{i + 1}</td>
                        <td className={soTd}>{l.ref ? <Code>{l.ref}</Code> : '—'}</td>
                        <td className={soTd}><span className="block max-w-[260px] truncate font-medium" title={l.name}>{l.name}</span></td>
                        <td className={cn(soTd, 'text-[rgb(var(--muted))]')}>{l.unit}</td>
                        <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(l.qty)}</td>
                        <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(l.price)}</td>
                        <td className={cn(soTd, 'text-right tabular-nums')}>{l.discountPct || 0}</td>
                        <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(ckd(l))}</td>
                        <td className={cn(soTd, 'text-right tabular-nums')}>{l.vat}</td>
                        <td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(saleLineNet(l))}</td>
                        <td className={cn(soTd, 'border-l border-[rgb(var(--line))] text-right tabular-nums')}>{l.kind === 'FREE' ? '—' : fmtN(x)}</td>
                        <td className={cn(soTd, 'text-right tabular-nums')}>{r ? fmtN(r) : '—'}</td>
                        <td className={cn(soTd, 'pr-5 text-right tabular-nums', rest > 0 && o.status !== 'CANCELLED' && 'font-medium text-[rgb(var(--accent-fg))]')}>{rest || '—'}</td>
                      </tr>); })}
                    <tr className="bg-[rgb(var(--ink)/0.03)]">
                      <td /><td colSpan={3} className={cn(soTd, 'text-[rgb(var(--muted))]')}>Cộng {o.lines.length} mặt hàng</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(o.lines.reduce((s, l) => s + l.qty, 0))}</td><td /><td />
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.discount)}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.vat)}</td>
                      <td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(t.net)}</td>
                      <td className={cn(soTd, 'border-l border-[rgb(var(--line))] text-right tabular-nums')}>{fmtN(iss)}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(rq)}</td>
                      <td className={cn(soTd, 'pr-5 text-right font-medium tabular-nums text-[rgb(var(--accent-fg))]')}>{fmtN(Math.max(0, ord - iss))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : docsV.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-[13.5px]">
                  <thead><tr className="border-b border-[rgb(var(--line))]"><th className={cn(soTh, 'pl-5')}>Mã chứng từ</th><th className={soTh}>Loại</th><th className={soTh}>Ngày</th><th className={cn(soTh, 'text-right')}>Số lượng</th><th className={cn(soTh, 'text-right')}>Giá trị</th><th className={soTh}>Ghi chú</th><th className={soTh}>Người xử lý</th><th className={soTh}>Trạng thái</th><th className={cn(soTh, 'w-8 pr-5')} /></tr></thead>
                  <tbody>{docsV.map((d) => (
                    <tr key={d.key} className={cn('border-b border-[rgb(var(--ink)/0.06)]', d.open && 'cursor-pointer hover:bg-[rgb(var(--ink)/0.03)]')} onClick={d.open}>
                      <td className={cn(soTd, 'pl-5')}><Code>{d.code}</Code></td><td className={soTd}>{d.type}</td><td className={cn(soTd, 'tabular-nums text-[rgb(var(--fg2))]')}>{fmtDate(d.date)}</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{d.qty !== undefined ? fmtN(d.qty) : '—'}</td><td className={cn(soTd, 'text-right tabular-nums')}>{d.amt !== undefined ? fmtN(d.amt) : '—'}</td>
                      <td className={soTd}><span className="block max-w-[220px] truncate text-[rgb(var(--fg2))]" title={d.note}>{d.note || '—'}</span></td><td className={soTd}>{d.who ?? '—'}</td><td className={soTd}>{d.st}</td>
                      <td className={cn(soTd, 'pr-5 text-[rgb(var(--muted))]')}>{d.open && <ChevronRight className="h-4 w-4" aria-hidden />}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            ) : <p className="px-5 py-6 text-[13.5px] text-[rgb(var(--muted))]">Chưa có chứng từ</p>}
            {vs.some((v) => v.type === 'OUT' && v.status === 'PENDING') && <div className="flex flex-wrap gap-3 px-5 py-3">{vs.filter((v) => v.type === 'OUT' && v.status === 'PENDING').map((v) => <Chip key={v.id} tone="orange">{v.code} chờ kho duyệt · {fmtN(v.lines.reduce((s, l) => s + l.qty, 0))}</Chip>)}</div>}
          </section>
          {tab === 'goods' && o.status === 'PENDING' && remain > 0 && stage !== 'APPROVAL' && <SaleStockCard o={o} />}
          <SoCard title="Trao đổi & nhật ký" action={
            <div className="flex overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.12)] text-[12.5px] divide-x divide-[rgb(var(--ink)/0.08)]">
              {([['ALL', 'Tất cả'], ['NOTE', 'Trao đổi'], ['SYS', 'Hệ thống']] as const).map(([k, tx]) => <button key={k} className={cn('px-3 py-1.5', logF === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => setLogF(k)}>{tx}</button>)}
            </div>}>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[rgb(var(--ink)/0.06)] text-[11px] font-medium">{ini(me?.id)}</span>
              <input className={cn(inputBase, 'min-w-0 flex-1')} value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Viết trao đổi" aria-label="Viết trao đổi" />
              <button className={cn(soIco, 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))] hover:bg-[rgb(var(--fg))]')} disabled={!msg.trim()} onClick={send} aria-label="Gửi"><Send className="h-4 w-4" aria-hidden /></button>
            </div>
            <ul className="mt-2">
              {feed.map((x, i) => x.note ? (
                <li key={x.note.id} className="grid grid-cols-[32px_1fr] gap-2.5 border-t border-[rgb(var(--ink)/0.06)] py-2.5 first:border-t-0"><span className="grid h-8 w-8 place-items-center rounded-full bg-[rgb(var(--ink)/0.06)] text-[11px] font-medium">{ini(x.note.by)}</span><div className="min-w-0 text-[13.5px]"><p><span className="font-medium">{nm(x.note.by) || '—'}</span> <span className="text-[12px] text-[rgb(var(--muted))]">· {soTime(x.note.at)}</span></p><p className="whitespace-pre-wrap">{x.note.text}</p></div></li>
              ) : x.s ? (
                <li key={`s${i}`} className="grid grid-cols-[32px_1fr] items-center gap-2.5 border-t border-[rgb(var(--ink)/0.06)] py-2.5 first:border-t-0"><span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-[rgb(var(--ink)/0.05)] text-[rgb(var(--muted))]"><x.s.icon className="h-3.5 w-3.5" aria-hidden /></span><p className="text-[13.5px] text-[rgb(var(--fg2))]">{x.s.text} <span className="text-[12px] text-[rgb(var(--muted))]">· {soTime(x.s.at)}</span></p></li>
              ) : null)}
            </ul>
          </SoCard>
        </div>
        <div className="space-y-4">
          <SoCard title="Quy trình xử lý"><SoFlow steps={soSteps(o, stage, vs, users)} /></SoCard>
          <SoCard title="Thanh toán" action={<span className="text-[12.5px] text-[rgb(var(--muted))]">{SALE_PAY[o.pay]}{o.creditDays ? ` ${o.creditDays} ngày` : ''}</span>}>
            <SoKv label="Tiền hàng">{fmtN(t.net)}</SoKv>
            {t.groups.filter((g) => g.rate > 0).map((g) => <SoKv key={g.rate} label={`Thuế GTGT ${g.rate}%`}>{fmtN(g.vat)}</SoKv>)}
            {t.ship > 0 && <SoKv label="Phí vận chuyển">{fmtN(t.ship)}</SoKv>}
            {ret > 0 && <SoKv label="Hàng trả lại">−{fmtN(ret)}</SoKv>}
            <SoKv label="Thực tế phải thu" big>{fmtN(due)}</SoKv>
            <SoKv label="Doanh thu (kế toán đã thu)">{fmtN(paid)}</SoKv>
            {pend > 0 && <SoKv label="Chờ xác nhận">{fmtN(pend)}</SoKv>}
            <SoKv label="Còn lại" tone={left > 0 ? 'warn' : undefined}>{fmtN(Math.max(0, left))}</SoKv>
            {due > 0 && <div className="mt-2"><SoBar parts={[{ pct: (paid / due) * 100, cls: 'bg-[rgb(var(--fg))]' }, { pct: (pend / due) * 100, cls: 'bg-[rgb(var(--accent)/0.55)]' }]} /></div>}
            {o.payments.length > 0 && (
              <div className="mt-3 border-t border-[rgb(var(--line))] pt-3">
                <p className="mb-1 text-[12.5px] text-[rgb(var(--muted))]">Lịch sử thu chi</p>
                {o.payments.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 py-1 text-[13px]">
                    <span className="tabular-nums">{fmtDate(p.date ?? iso(new Date(p.at))).slice(0, 5)}</span><span className="text-[rgb(var(--muted))]">{p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
                    <span className="ml-auto font-medium tabular-nums">{fmtN(p.amount)}</span>
                    {p.confirmed ? <Chip tone="teal">Đã xác nhận</Chip> : canCash ? <button className={cn(btnGhost, btnSm)} onClick={() => confirmSalePayment(o.id, p.id)}>Xác nhận</button> : <Chip tone="orange">Chờ</Chip>}
                  </div>
                ))}
              </div>
            )}
          </SoCard>
          {canCash && (o.invReqs ?? []).some((r) => r.status === 'PENDING') && (
            <SoCard title="Yêu cầu xuất hóa đơn">
              {(o.invReqs ?? []).filter((r) => r.status === 'PENDING').map((r) => (
                <div key={r.id} className="space-y-2 text-[13px]">
                  <div className="flex justify-between"><span className="text-[rgb(var(--muted))]">{nm(r.by)} · {soTime(r.at)}</span><span className="font-medium tabular-nums">{fmtN(r.amount)}</span></div>
                  {r.note && <p className="text-[rgb(var(--fg2))]">{r.note}</p>}
                  <input className={inputCls} value={dec[r.id] ?? ''} onChange={(e) => setDec({ ...dec, [r.id]: e.target.value })} placeholder="Số hóa đơn hoặc lý do trả lại" aria-label="Số hóa đơn hoặc lý do" />
                  <div className="flex gap-2"><button className={cn(btnGhost, 'flex-1 justify-center')} onClick={() => decideSaleInvoice(o.id, r.id, false, dec[r.id] ?? '')}>Trả lại</button><button className={cn(btnPrimary, 'flex-1 justify-center')} onClick={() => decideSaleInvoice(o.id, r.id, true, dec[r.id] ?? '')}>Đã xuất</button></div>
                </div>
              ))}
            </SoCard>
          )}
          <SoDebt customerId={o.customerId} exceptId={o.id} />
        </div>
      </div>
    </div>
  );
}

