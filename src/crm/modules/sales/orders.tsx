'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check as CheckIcon, Coins, Download, Filter, Lock, Minus, PackageMinus, Plus, Printer, Receipt as ReceiptIcon, Send, Trash2, XCircle } from 'lucide-react';
import { Chip, Code, EmptyState, Field, MoneyInput, Panel, SetBlock, SideCard, Table, Tabs, useSticky } from '../../components/ui';
import { addDaysISO, bizMode, btnGhost, btnPrimary, btnSm, digits, esc, fmtDate, fmtN, fold, inputBase, inputCls, MAIN_WH, nextCode, overdueDays, PRICE_TIER, rowCls, SALE_DELIVERY, SALE_PAY, SALE_STAGE, SALE_STATUS, saleDay, saleDue, saleGoods, saleIssQ, saleIssued, saleLineNet, salePaid, saleRetQ, tdCls, tdFirst, tdLast, tierPrice, todayISO, uid, useApp, whQty } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import { saleHeld, salePendingQ, saleReturned, saleStage, saleStock, saleTotals } from '../../lib/getfly';
import type { CompanyInfo, Customer, PriceTier, SaleDelivery, SaleLine, SaleLineKind, SalePay, SalePer, SalePick, SalesOrder, SaleStatus, SaleTab, WorkOrder } from '../../lib/types';
import { cn } from '../../lib/utils';
import { stockOf } from '../../lib/workshop';
import { SearchBox } from '../alux/orders';
import { useArItems } from '../finance/ar-aging';
import { docShell, moneyToWordsVN, printHtml } from './templates';

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

export function SalesModule() {
  const ctx = useApp();
  const { salesOrders, openSale, setOpenSale, canDo } = ctx;
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const open = openSale ? salesOrders.find((o) => o.id === openSale) : undefined;
  if (open) return <SaleDetail o={open} onBack={() => setOpenSale(null)} />;
  if (mode === 'new') return <SaleForm onDone={(id) => { setMode('list'); if (id) setOpenSale(id); }} />;
  return <SaleList onNew={canDo('stock.voucher') || canDo('job.manage') ? () => setMode('new') : undefined} />;
}

export function SaleList({ onNew }: { onNew?: () => void }) {
  const { salesOrders, setOpenSale, users, quotes, warehouses, company, setSaleStatus, stockVouchers } = useApp();
  const [tab0, setTab] = useSticky<SaleTab>('Sales.tab49', 'ALL');
  const [per, setPer] = useSticky<SalePer>('Sales.per49', 'M');
  const [pay, setPay] = useSticky<SalePay | 'ALL'>('Sales.pay49', 'ALL');
  const [by, setBy] = useSticky('Sales.by49', 'ALL');
  const [wh, setWh] = useSticky('Sales.wh49', 'ALL');
  const [q, setQ] = useState('');
  const [fOpen, setFOpen] = useState(false);
  const tabIds: SaleTab[] = ['ALL', 'APPROVAL', 'WAIT', 'PARTIAL', 'DONE', 'UNPAID', 'INV', 'CANCELLED'];
  const tab: SaleTab = tabIds.includes(tab0) ? tab0 : 'ALL';
  const today = todayISO();
  const mon = Number(today.slice(5, 7));
  const from = per === 'D' ? today : per === 'W' ? addDaysISO(today, -((new Date().getDay() + 6) % 7)) : per === 'M' ? `${today.slice(0, 8)}01` : per === 'Q' ? `${today.slice(0, 5)}${String(Math.floor((mon - 1) / 3) * 3 + 1).padStart(2, '0')}-01` : per === 'Y' ? `${today.slice(0, 5)}01-01` : '';
  const stage = (o: SalesOrder) => saleStage(o, stockVouchers);
  const leftOf = (o: SalesOrder) => saleTotals(o).grand - saleReturned(o) - salePaid(o);
  const units = (o: SalesOrder) => { const ls = o.lines.filter((l) => l.kind !== 'FREE'); return { done: ls.reduce((s, l) => s + saleIssQ(o, l), 0), all: ls.reduce((s, l) => s + l.qty, 0) }; };
  const inTab = (o: SalesOrder, t: SaleTab) => {
    const s = stage(o);
    switch (t) {
      case 'ALL': return true;
      case 'APPROVAL': return s === 'APPROVAL' || s === 'REJECTED';
      case 'WAIT': return s === 'READY' || s === 'WAIT_WH';
      case 'PARTIAL': return s === 'PARTIAL';
      case 'DONE': return s === 'DONE' || s === 'SHIPPING';
      case 'CANCELLED': return s === 'CANCELLED';
      case 'UNPAID': return s !== 'CANCELLED' && saleIssued(o) && leftOf(o) > 0;
      case 'INV': return (o.invReqs ?? []).some((r) => r.status === 'PENDING');
    }
  };
  const key = fold(q.trim());
  const base = salesOrders
    .filter((o) => !from || o.date >= from)
    .filter((o) => (pay === 'ALL' || o.pay === pay) && (by === 'ALL' || o.by === by) && (wh === 'ALL' || o.whId === wh))
    .filter((o) => !key || fold(`${o.code} ${o.customer} ${o.phone ?? ''} ${o.lines.map((l) => `${l.ref ?? ''} ${l.name}`).join(' ')}`).includes(key));
  const rows = base.filter((o) => inTab(o, tab)).sort((a, b) => b.createdAt - a.createdAt);
  const tabs: { id: SaleTab; label: string; count?: number }[] = ([['ALL', 'Tất cả'], ['APPROVAL', 'Chờ duyệt'], ['WAIT', 'Chờ xuất kho'], ['PARTIAL', 'Xuất một phần'], ['DONE', 'Hoàn thành'], ['UNPAID', 'Chưa thu đủ'], ['INV', 'Chờ xuất HĐ'], ['CANCELLED', 'Đã hủy']] as [SaleTab, string][])
    .map(([id, label]) => ({ id, label, count: base.filter((o) => inTab(o, id)).length }));
  const nF = [pay, by, wh].filter((x) => x !== 'ALL').length;
  const sellers = Array.from(new Set(salesOrders.map((o) => o.by).filter((x): x is string => !!x)));
  const sum = (f: (o: SalesOrder) => number) => rows.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + f(o), 0);
  const csv = () => downloadCsv(`don-ban-${today}.csv`, [['Mã đơn', 'Ngày', 'NV bán', 'Khách hàng', 'Trạng thái', 'Đã xuất', 'Tổng SL', 'Tổng sau VAT', 'Hàng trả lại', 'Đã thu', 'Còn lại', 'Nguồn', 'Thanh toán', 'Kho xuất'],
    ...rows.map((o) => { const t = saleTotals(o); const u = units(o); return [o.code, o.date, users.find((x) => x.id === o.by)?.name ?? '', o.customer, SALE_STAGE[stage(o)].label, u.done, u.all, t.grand, saleReturned(o), salePaid(o), leftOf(o), o.source === 'QUOTE' ? quotes.find((x) => x.id === o.quoteId)?.code ?? 'Báo giá' : 'Tại quầy', SALE_PAY[o.pay], warehouses.find((w) => w.id === o.whId)?.code ?? '']; })]);
  const segCls = (on: boolean) => cn('rounded-md px-2 py-1.5 text-center text-[13px]', on ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)]');
  const PER: [SalePer, string][] = [['D', 'Hôm nay'], ['W', 'Tuần này'], ['M', 'Tháng này'], ['Q', 'Quý này'], ['Y', 'Năm nay'], ['ALL', 'Tất cả']];
  return (
    <div className="space-y-3">
      <Tabs tabs={tabs} value={tab} onChange={setTab} aside={onNew && <button className={cn(btnPrimary, btnSm)} onClick={onNew}><Plus className="h-3.5 w-3.5" aria-hidden />Lên đơn bán</button>} />
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="flex overflow-x-auto rounded-lg bg-[rgb(var(--ink)/0.05)] p-0.5" role="radiogroup" aria-label="Thời gian">
          {PER.map(([k, t]) => <button key={k} role="radio" aria-checked={per === k} className={cn(segCls(per === k), 'whitespace-nowrap px-3')} onClick={() => setPer(k)}>{t}</button>)}
        </div>
        {from && <span className="text-[12.5px] tabular-nums text-[rgb(var(--muted))]">từ {fmtDate(from)}</span>}
        <div className="flex items-center gap-2 lg:ml-auto">
          <div className="min-w-0 flex-1 lg:w-[300px] lg:flex-none"><SearchBox value={q} onChange={setQ} placeholder="Mã đơn, khách, SĐT, mã hàng" /></div>
          <div className="relative">
            <button className={cn(btnGhost, btnSm, 'relative px-2.5')} onClick={() => setFOpen((v) => !v)} aria-label="Bộ lọc" aria-expanded={fOpen} title="Bộ lọc"><Filter className="h-4 w-4" aria-hidden />{nF > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[rgb(var(--fg))] px-1 text-[10px] text-[rgb(var(--bg))]">{nF}</span>}</button>
            {fOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-[280px] space-y-2 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 shadow-lg">
                <Field label="Thanh toán"><select className={inputCls} value={pay} onChange={(e) => setPay(e.target.value as SalePay | 'ALL')}><option value="ALL">Mọi hình thức</option>{(Object.keys(SALE_PAY) as SalePay[]).map((p) => <option key={p} value={p}>{SALE_PAY[p]}</option>)}</select></Field>
                <Field label="NV bán"><select className={inputCls} value={by} onChange={(e) => setBy(e.target.value)}><option value="ALL">Tất cả</option>{sellers.map((id) => <option key={id} value={id}>{users.find((u) => u.id === id)?.name ?? id}</option>)}</select></Field>
                <Field label="Kho xuất"><select className={inputCls} value={wh} onChange={(e) => setWh(e.target.value)}><option value="ALL">Mọi kho</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></Field>
                <div className="flex justify-between pt-1"><button className={cn(btnGhost, btnSm)} onClick={() => { setPay('ALL'); setBy('ALL'); setWh('ALL'); }}>Xóa lọc</button><button className={cn(btnPrimary, btnSm)} onClick={() => setFOpen(false)}>Xong</button></div>
              </div>
            )}
          </div>
          <button className={cn(btnGhost, btnSm, 'px-2.5')} onClick={csv} disabled={!rows.length} aria-label="Xuất CSV" title="Xuất CSV"><Download className="h-4 w-4" aria-hidden /></button>
        </div>
      </div>
      <Panel>
        <Table id="sales-orders49" title="Đơn bán" head={['Mã đơn', 'Ngày', 'NV bán', 'Khách hàng', 'Trạng thái', <span key="x" className="block text-right">Đã xuất</span>, <span key="t" className="block text-right">Tổng sau VAT</span>, <span key="p" className="block text-right">Đã thu</span>, <span key="l" className="block text-right">Còn lại</span>, 'Nguồn', 'Hàng hóa', 'Thanh toán', 'Kho xuất', 'Hẹn giao', 'Hạn công nợ', 'Hóa đơn', <span key="r" className="block text-right">Hàng trả lại</span>]} optional={[9, 10, 11, 12, 13, 14, 15, 16]} minW={1000}
          bulk={[
            { label: 'In phiếu bán hàng', icon: Printer, run: (ks) => { const os = rows.filter((o) => ks.includes(o.id)); printHtml(docShell(`Phiếu bán hàng (${os.length})`, os.map((o) => saleHtml(o, company)).join('<div style="page-break-after:always"></div>'))); } },
            { label: 'Hủy đơn chưa xuất kho', icon: XCircle, danger: true, run: (ks) => rows.filter((o) => ks.includes(o.id) && o.status === 'PENDING' && !saleIssued(o)).forEach((o) => setSaleStatus(o.id, 'CANCELLED', 'Hủy hàng loạt từ danh sách')) },
          ]}>
          {rows.map((o) => {
            const s = stage(o);
            const u = units(o);
            const left = leftOf(o);
            const qc = o.quoteId ? quotes.find((x) => x.id === o.quoteId)?.code : undefined;
            const inv = o.invReqs ?? [];
            return (
              <tr key={o.id} className={cn(rowCls, 'cursor-pointer hover:bg-[rgb(var(--ink)/0.03)]')} onClick={() => setOpenSale(o.id)}>
                <td className={tdFirst}><Code>{o.code}</Code></td>
                <td className={cn(tdCls, 'whitespace-nowrap tabular-nums text-[rgb(var(--fg2))]')}>{fmtDate(o.date)}</td>
                <td className={cn(tdCls, 'whitespace-nowrap')}>{users.find((x) => x.id === o.by)?.name ?? '—'}</td>
                <td className={tdCls}><span className="block max-w-[220px] truncate font-medium" title={o.customer}>{o.customer}</span></td>
                <td className={cn(tdCls, 'whitespace-nowrap')}><Chip tone={SALE_STAGE[s].tone}>{s === 'DONE' && o.delivery === 'PICKUP' && !o.issuedQ ? 'Đã lấy tại cửa hàng' : SALE_STAGE[s].label}</Chip></td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{u.all ? `${fmtN(u.done)} / ${fmtN(u.all)}` : '—'}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{fmtN(saleTotals(o).grand)}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{fmtN(salePaid(o))}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums', left > 0 && saleIssued(o) && o.status !== 'CANCELLED' && 'text-[rgb(var(--accent-fg))]')}>{o.status === 'CANCELLED' ? '—' : fmtN(Math.max(0, left))}</td>
                <td className={cn(tdCls, 'whitespace-nowrap')}>{o.source === 'QUOTE' ? <Code>{qc ?? 'Báo giá'}</Code> : <span className="text-[rgb(var(--muted))]">Tại quầy</span>}</td>
                <td className={cn(tdCls, 'text-[rgb(var(--muted))]')}><span className="block max-w-[240px] truncate" title={saleGoods(o)}>{saleGoods(o)}</span></td>
                <td className={cn(tdCls, 'whitespace-nowrap')}>{SALE_PAY[o.pay]}</td>
                <td className={cn(tdCls, 'whitespace-nowrap')}>{warehouses.find((w) => w.id === o.whId)?.code ?? '—'}</td>
                <td className={cn(tdCls, 'whitespace-nowrap tabular-nums')}>{o.deliverAt ? fmtDate(o.deliverAt) : '—'}</td>
                <td className={cn(tdCls, 'whitespace-nowrap tabular-nums')}>{o.creditDays ? (o.issuedAt ? fmtDate(saleDue(o)) : `${o.creditDays} ngày`) : '—'}</td>
                <td className={cn(tdCls, 'whitespace-nowrap')}>{inv.some((r) => r.status === 'PENDING') ? <Chip tone="orange">Chờ kế toán</Chip> : inv.some((r) => r.status === 'DONE') ? inv.filter((r) => r.status === 'DONE').map((r) => r.no).join(', ') : o.invoice ? <span className="text-[rgb(var(--muted))]">Chưa yêu cầu</span> : '—'}</td>
                <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums')}>{saleReturned(o) ? fmtN(saleReturned(o)) : '—'}</td>
              </tr>
            );
          })}
        </Table>
        {rows.length > 0 && <p className="border-t border-[rgb(var(--line))] px-4 py-2.5 text-right text-[12.5px] tabular-nums text-[rgb(var(--fg2))]">{rows.length} đơn · tổng {fmtN(sum((o) => saleTotals(o).grand))} · đã thu {fmtN(sum((o) => salePaid(o)))} · còn lại <span className="font-medium text-[rgb(var(--fg))]">{fmtN(sum((o) => (saleIssued(o) ? Math.max(0, leftOf(o)) : 0)))}</span></p>}
        {!rows.length && <EmptyState text={salesOrders.length ? 'Không có đơn khớp bộ lọc.' : 'Chưa có đơn bán.'} hint={salesOrders.length ? 'Thử đổi thời gian, tab hoặc bộ lọc.' : 'Lên đơn bán tại quầy, hoặc ghi nhận chốt một báo giá để CRM tự tạo đơn.'} art="box" action={!salesOrders.length && onNew ? 'Lên đơn bán' : undefined} onAction={onNew} />}
      </Panel>
    </div>
  );
}

export function SaleForm({ onDone }: { onDone: (id?: string) => void }) {
  const { skus, stockItems, stockMoves, priceItems, warehouses, customers, salesOrders, reservations, saveSale, completeSale, me, notify, company, workOrders, setWorkOrders, mfgConfig } = useApp();
  const mfg = bizMode(company) === 'MFG';
  const main = warehouses.find((w) => w.main)?.id ?? MAIN_WH;
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [find, setFind] = useState('');
  const [custQ, setCustQ] = useState('');
  const [custId, setCustId] = useState<string | undefined>(undefined);
  const [walkName, setWalkName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tier, setTier] = useState<PriceTier>('BASE');
  const [pay, setPay] = useState<SalePay>('CASH');
  const [paidNow, setPaidNow] = useState(0);
  const [creditDays, setCreditDays] = useState(30);
  const [delivery, setDelivery] = useState<SaleDelivery>('PICKUP');
  const [whId, setWhId] = useState(main);
  const [deliverAt, setDeliverAt] = useState(todayISO());
  const [invoice, setInvoice] = useState(false);
  const [issueNow, setIssueNow] = useState(true);
  const [shipFee, setShipFee] = useState(0);
  const [note, setNote] = useState('');
  const cust = customers.find((c) => c.id === custId);
  const ar = useArItems().filter((x) => !!cust && x.customerId === cust.id);
  const owe = ar.reduce((s, x) => s + x.outstanding, 0);
  const overdue = ar.filter((x) => overdueDays(x.dueDate, todayISO()) > 0);
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
  if (pay === 'PARTIAL' && !(paidNow > 0 && paidNow < t.grand)) errs.push('Nhập số tiền khách trả trước (nhỏ hơn tổng)');
  if (delivery !== 'PICKUP' && !address.trim()) errs.push('Nhập địa chỉ giao hàng');
  const short = stock.filter((x) => x.short > 0);
  const finish = (complete: boolean) => {
    if (errs.length) return notify(errs[0], 'red');
    const base = { date: todayISO(), source: 'COUNTER' as const, customerId: cust?.id, customer: name, phone: phone.trim() || undefined, taxCode: cust?.taxCode || undefined, address: address.trim() || undefined,
      lines, pay, creditDays: pay === 'CREDIT' || pay === 'PARTIAL' ? creditDays : 0, payments: [], delivery, whId, deliverAt: delivery === 'PICKUP' ? undefined : deliverAt, invoice, shipFee: shipFee || undefined, note: note.trim() || undefined, status: 'PENDING' as SaleStatus, by: me?.id };
    let rec = saveSale(base);
    const make = lines.filter((l) => l.kind === 'MAKE');
    if (make.length && me) {
      const wo: WorkOrder = {
        id: uid('wo'), code: nextCode(workOrders.map((w) => w.code), `LSX-${new Date().getFullYear()}-`, 4), title: `Đơn bán ${rec.code} (${name})`, customerId: cust?.id, stage: 'WAITING', priority: 'NORMAL',
        startDate: todayISO(), dueDate: addDaysISO(todayISO(), mfgConfig.productionDays || 7), items: make.map((l) => ({ id: uid('wi'), name: l.name, spec: l.note ?? '', unit: l.unit, qty: l.qty, done: 0 })),
        materials: [], qc: [], note: `Gia công cho đơn bán ${rec.code}`, history: [{ stage: 'WAITING', at: Date.now(), by: me.id, note: `Từ đơn bán ${rec.code}` }], createdAt: todayISO(), createdBy: me.id,
      };
      setWorkOrders((p) => [wo, ...p]);
      rec = saveSale({ ...rec, woId: wo.id });
    }
    const id = rec.id;
    if (complete) {
      const amt = pay === 'CASH' || pay === 'BANK' ? t.grand : pay === 'PARTIAL' ? paidNow : 0;
      completeSale(rec, amt > 0 ? { amount: amt, method: pay === 'CASH' ? 'CASH' : 'BANK' } : null, issueNow && !make.length);
    } else notify(`Đã lưu tạm ${rec.code}, hàng đang được giữ`, 'teal');
    onDone(id);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F9') { e.preventDefault(); finish(true); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const segCls = (on: boolean) => cn('rounded-md px-2 py-1.5 text-center text-[13px]', on ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)]');
  const cellIn = cn(inputCls, 'px-2 py-1 text-right text-[13px] tabular-nums');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={cn(btnGhost, btnSm)} onClick={() => onDone()}><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Bán hàng</button>
        <h2 className="text-[17px] font-medium">Lên đơn bán</h2>
        <span className="ml-auto flex gap-2">
          <button className={btnGhost} onClick={() => finish(false)} disabled={!lines.length}>Lưu tạm</button>
          <button className={btnPrimary} onClick={() => finish(true)} title="Phím tắt F9">Hoàn tất đơn<kbd className="ml-1 rounded border border-white/40 px-1 font-mono text-[10px]">F9</kbd></button>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <section className="glass-card rounded-xl p-4">
            <div className="relative">
              <input className={inputCls} value={find} onChange={(e) => setFind(e.target.value)} placeholder={mfg ? 'Tìm vật tư, phụ kiện, sản phẩm gia công' : 'Tìm mã hàng, tên hàng hoặc quét mã vạch'} aria-label="Tìm hàng hóa"
                onKeyDown={(e) => { if (e.key === 'Enter' && catalog[0]) { e.preventDefault(); add(catalog[0]); } }} autoFocus />
              {catalog.length > 0 && (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-lg" role="listbox">
                  {catalog.map((p, i) => (
                    <li key={`${p.kind}:${p.ref}`} role="option" aria-selected={i === 0}>
                      <button className={cn('flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-[rgb(var(--ink)/0.04)]', i === 0 && 'bg-[rgb(var(--accent)/0.06)]')} onClick={() => add(p)}>
                        <span className="min-w-0 truncate">{p.name}{p.kind === 'MAKE' && <span className="ml-2"><Chip tone="blue">Gia công</Chip></span>}</span>
                        <span className="shrink-0 text-[12px] text-[rgb(var(--muted))]">{p.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="-mx-4 mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] table-fixed text-[13px]">
                <thead><tr className="border-b border-[rgb(var(--line))] text-left text-[12px] text-[rgb(var(--muted))]"><th className="py-2 pl-4 font-normal">Hàng hóa</th><th className="w-28 font-normal">Số lượng</th><th className="w-28 text-right font-normal">Đơn giá</th><th className="w-16 text-right font-normal">CK %</th><th className="w-20 pl-2 font-normal">VAT</th><th className="w-28 text-right font-normal">Thành tiền</th><th className="w-10 pr-4"><span className="sr-only">Xóa</span></th></tr></thead>
                <tbody>
                  {stock.map(({ l, short: s, track, have }) => (
                    <tr key={l.id} className="border-b border-[rgb(var(--ink)/0.06)]">
                      <td className="py-2 pl-4">
                        {l.kind === 'FREE' ? <input className={cn(inputCls, 'px-2 py-1 text-[13px]')} value={l.name} onChange={(e) => upd(l.id, { name: e.target.value })} placeholder="Tên hàng hóa, dịch vụ" aria-label="Tên dòng tự nhập" /> : <span>{l.name}</span>}
                        {l.kind === 'FREE' && <input className={cn(inputCls, 'mt-1 w-24 px-2 py-0.5 text-[12px]')} value={l.unit} onChange={(e) => upd(l.id, { unit: e.target.value })} placeholder="ĐVT" aria-label="Đơn vị tính" />}
                        <span className={cn('block text-[12px]', s > 0 ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')}>
                          {l.kind !== 'FREE' && `${l.unit} · `}{l.kind === 'MAKE' ? 'Gia công tại xưởng, tạo lệnh sản xuất khi hoàn tất' : !track ? 'Không trừ kho' : s > 0 ? `Có ${fmtN(have)}, thiếu ${fmtN(s)}${have ? ` · giao trước ${fmtN(have)}` : ''}` : `Đủ hàng ${mfg ? '' : warehouses.find((w) => w.id === whId)?.code ?? ''}`}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center rounded-md border border-[rgb(var(--line))]">
                          <button className="px-2 py-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => upd(l.id, { qty: Math.max(1, l.qty - 1) })} aria-label={`Giảm ${l.name}`}><Minus className="h-3 w-3" aria-hidden /></button>
                          <input className="w-12 border-x border-[rgb(var(--line))] bg-transparent py-1 text-center tabular-nums outline-none" inputMode="decimal" value={l.qty} onChange={(e) => upd(l.id, { qty: Math.max(0, Number(e.target.value.replace(',', '.')) || 0) })} aria-label={`Số lượng ${l.name}`} />
                          <button className="px-2 py-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => upd(l.id, { qty: l.qty + 1 })} aria-label={`Tăng ${l.name}`}><Plus className="h-3 w-3" aria-hidden /></button>
                        </span>
                      </td>
                      <td><input className={cellIn} inputMode="numeric" value={l.price ? fmtN(l.price) : ''} onChange={(e) => upd(l.id, { price: digits(e.target.value) })} aria-label={`Đơn giá ${l.name}`} /></td>
                      <td><input className={cellIn} inputMode="decimal" value={l.discountPct || ''} onChange={(e) => upd(l.id, { discountPct: Math.min(100, Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) })} placeholder="0" aria-label={`Chiết khấu ${l.name}`} /></td>
                      <td className="pl-2"><select className={cn(inputCls, 'px-1.5 py-1 text-[13px]')} value={l.vat} onChange={(e) => upd(l.id, { vat: Number(e.target.value) })} aria-label={`Thuế suất ${l.name}`}>{[0, 5, 8, 10].map((v) => <option key={v} value={v}>{v}%</option>)}</select></td>
                      <td className="truncate text-right tabular-nums">{fmtN(saleLineNet(l))}</td>
                      <td className="pr-4 text-right"><button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label={`Xóa ${l.name}`}><Trash2 className="h-3.5 w-3.5" aria-hidden /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button className={cn(btnGhost, btnSm)} onClick={() => setLines((ls) => [...ls, { id: uid('sl'), kind: 'FREE', name: '', unit: 'cái', qty: 1, price: 0, discountPct: 0, vat: vatDef }])}><Plus className="h-3.5 w-3.5" aria-hidden />Dòng tự nhập</button>
              {!lines.length && <span className="text-[12.5px] text-[rgb(var(--muted))]">Gõ tên hoặc mã hàng ở ô tìm, Enter để thêm dòng đầu tiên</span>}
              {short.length > 0 && <span className="ml-auto text-[12.5px] text-[rgb(var(--danger-fg))]">{short.length} mặt hàng thiếu: sau khi lưu, đề xuất mua hoặc giao trước phần có sẵn</span>}
            </div>
          </section>
          <SetBlock title="Giao nhận">
            <div className="grid grid-cols-3 rounded-lg bg-[rgb(var(--ink)/0.05)] p-0.5" role="radiogroup" aria-label="Hình thức giao nhận">
              {(Object.keys(SALE_DELIVERY) as SaleDelivery[]).map((d) => <button key={d} role="radio" aria-checked={delivery === d} className={segCls(delivery === d)} onClick={() => { setDelivery(d); if (d === 'PICKUP') setIssueNow(true); }}>{SALE_DELIVERY[d]}</button>)}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {!mfg && <Field label="Kho xuất"><select className={inputCls} value={whId} onChange={(e) => setWhId(e.target.value)}>{warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}
              {delivery !== 'PICKUP' && <Field label="Ngày giao"><input type="date" className={inputCls} value={deliverAt} onChange={(e) => setDeliverAt(e.target.value)} /></Field>}
              {delivery !== 'PICKUP' && <Field label="Phí giao hàng"><MoneyInput value={shipFee} onChange={setShipFee} /></Field>}
              {delivery !== 'PICKUP' && <Field label="Địa chỉ giao" className="sm:col-span-3"><input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường, tỉnh / thành" /></Field>}
            </div>
          </SetBlock>
        </div>
        <div className="space-y-4">
          <SetBlock title="Khách hàng">
            {cust ? (
              <div className="flex items-start justify-between gap-2 rounded-lg border border-[rgb(var(--line))] px-3 py-2.5">
                <div className="min-w-0"><p className="truncate font-medium">{cust.name}</p><p className="truncate text-[12px] text-[rgb(var(--muted))]">{[cust.code, cust.taxCode && `MST ${cust.taxCode}`, cust.contactPhone].filter(Boolean).join(' · ')}</p></div>
                <button className={cn(btnGhost, btnSm)} onClick={() => { setCustId(undefined); setTier('BASE'); }}>Đổi</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input className={inputCls} value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder="Tìm khách trong CRM: tên, mã, SĐT, MST" aria-label="Tìm khách hàng" />
                  {custHits.length > 0 && (
                    <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-lg">
                      {custHits.map((c) => <li key={c.id}><button className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[rgb(var(--ink)/0.04)]" onClick={() => pickCust(c)}>{c.name}<span className="block text-[12px] text-[rgb(var(--muted))]">{[c.code, c.contactPhone].filter(Boolean).join(' · ')}</span></button></li>)}
                    </ul>
                  )}
                </div>
                <p className="text-[12px] text-[rgb(var(--muted))]">Hoặc khách lẻ:</p>
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} value={walkName} onChange={(e) => setWalkName(e.target.value)} placeholder="Tên khách lẻ" aria-label="Tên khách lẻ" />
                  <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại" inputMode="tel" aria-label="Số điện thoại" />
                </div>
              </div>
            )}
            {cust && (owe > 0 || cust.creditLimit > 0) && (
              <p className={cn('mt-2 rounded-lg px-3 py-2 text-[12.5px]', overdue.length || (cust.creditLimit > 0 && owe + t.grand > cust.creditLimit) ? 'bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent-fg))]' : 'bg-[rgb(var(--ink)/0.04)] text-[rgb(var(--fg2))]')}>
                Đang nợ {fmtN(owe)}{cust.creditLimit > 0 ? ` / hạn mức ${fmtN(cust.creditLimit)}` : ''}{overdue.length ? ` · ${overdue.length} khoản quá hạn` : ''}{cust.creditLimit > 0 && owe + t.grand > cust.creditLimit ? ' · đơn này vượt hạn mức' : ''}
              </p>
            )}
            {!mfg && (
              <Field label="Bảng giá áp dụng" className="mt-3">
                <select className={inputCls} value={tier} onChange={(e) => { const tr = e.target.value as PriceTier; setTier(tr); setLines((ls) => ls.map((l) => (l.kind === 'SKU' ? { ...l, price: tierPrice(skus.find((k) => k.sku === l.ref), tr) || l.price } : l))); }}>
                  {(['BASE', 'DEALER', 'PROJECT'] as PriceTier[]).map((x) => <option key={x} value={x}>{PRICE_TIER[x]}</option>)}
                </select>
              </Field>
            )}
            <p className="mb-1.5 mt-3 text-[12.5px] text-[rgb(var(--muted))]">Thanh toán</p>
            <div className="grid grid-cols-4 rounded-lg bg-[rgb(var(--ink)/0.05)] p-0.5" role="radiogroup" aria-label="Hình thức thanh toán">
              {(Object.keys(SALE_PAY) as SalePay[]).map((p) => <button key={p} role="radio" aria-checked={pay === p} className={segCls(pay === p)} onClick={() => setPay(p)}>{SALE_PAY[p]}</button>)}
            </div>
            {(pay === 'PARTIAL' || pay === 'CREDIT') && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {pay === 'PARTIAL' && <Field label="Khách trả trước"><MoneyInput value={paidNow} onChange={setPaidNow} /></Field>}
                <Field label="Hạn trả (ngày)"><input className={inputCls} inputMode="numeric" value={creditDays} onChange={(e) => setCreditDays(digits(e.target.value))} /></Field>
                {pay === 'CREDIT' && <Field label="Đến ngày"><input className={inputCls} readOnly value={fmtDate(addDaysISO(todayISO(), creditDays))} /></Field>}
              </div>
            )}
            <label className="mt-3 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} />Xuất hóa đơn VAT</label>
            <label className="mt-1.5 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={issueNow} onChange={(e) => setIssueNow(e.target.checked)} />Gửi yêu cầu xuất kho ngay khi lưu (nếu không phải chờ duyệt)</label>
            <dl className="mt-4 space-y-1 text-[13px]">
              <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Tiền hàng</dt><dd className="tabular-nums">{fmtN(t.gross)}</dd></div>
              {t.discount > 0 && <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Chiết khấu</dt><dd className="tabular-nums">−{fmtN(t.discount)}</dd></div>}
              {t.groups.filter((g) => g.rate > 0).map((g) => <div key={g.rate} className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Thuế GTGT {g.rate}%</dt><dd className="tabular-nums">{fmtN(g.vat)}</dd></div>)}
              {t.ship > 0 && <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Phí giao hàng</dt><dd className="tabular-nums">{fmtN(t.ship)}</dd></div>}
              <div className="mt-2 flex items-baseline justify-between border-t border-[rgb(var(--line))] pt-2"><dt className="text-[15px] font-medium">Khách phải trả</dt><dd className="text-[18px] font-medium tabular-nums">{fmtN(t.grand)}</dd></div>
              {pay !== 'CASH' && pay !== 'BANK' && <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Ghi công nợ</dt><dd className="tabular-nums">{fmtN(t.grand - (pay === 'PARTIAL' ? paidNow : 0))}</dd></div>}
            </dl>
            <Field label="Ghi chú" className="mt-3"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú cho kho, giao hàng" /></Field>
            {errs.length > 0 && lines.length > 0 && <p className="mt-2 text-[12.5px] text-[rgb(var(--danger-fg))]">{errs[0]}</p>}
          </SetBlock>
          <SideCard title="Khi hoàn tất, CRM tự">
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-[rgb(var(--fg2))]">
              <li>Duyệt đơn theo quy trình "Đơn bán" (Cài đặt › Quy trình & phê duyệt); đơn trong ngưỡng thì tự duyệt</li>
              {issueNow && <li>{lines.some((l) => l.kind === 'MAKE') ? 'Tạo lệnh sản xuất cho hàng gia công, xuất kho khi xưởng làm xong' : mfg ? 'Trừ tồn vật tư, lập phiếu xuất' : `Lập phiếu xuất gửi ${warehouses.find((w) => w.id === whId)?.name ?? 'kho'}, kho duyệt một phần hoặc toàn bộ`}</li>}
              {!issueNow && <li>Giữ hàng cho đơn; bấm Yêu cầu xuất kho ở đơn khi cần giao</li>}
              <li>{pay === 'CASH' || pay === 'BANK' ? 'Ghi nhận tiền thu, tự sinh phiếu thu quỹ (Kế toán xác nhận nếu bạn không có quyền quỹ)' : pay === 'PARTIAL' ? 'Ghi nhận tiền trả trước, phần còn lại vào công nợ phải thu' : 'Ghi công nợ phải thu khi xuất kho'}</li>
              {short.length > 0 && <li>Báo {short.length} mặt hàng thiếu để đề xuất mua</li>}
              <li>Lưu giá đã bán để gợi ý cho lần bán sau</li>
            </ul>
          </SideCard>
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

export function SaleDetail({ o, onBack }: { o: SalesOrder; onBack: () => void }) {
  const { quotes, openComposer, requestSaleIssue, setSaleStatus, addSalePayment, confirmSalePayment, users, company, canDo, pos, stockVouchers, workOrders, go, requestSaleInvoice, decideSaleInvoice } = useApp();
  const t = saleTotals(o);
  const ret = saleReturned(o);
  const due = t.grand - ret;
  const paid = salePaid(o);
  const pend = salePaid(o, true) - paid;
  const left = due - salePaid(o, true);
  const [amt, setAmt] = useState(0);
  const [method, setMethod] = useState<'CASH' | 'BANK'>('BANK');
  const [cancel, setCancel] = useState<string | null>(null);
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
  const canReq = o.status !== 'CANCELLED' && stage !== 'APPROVAL' && stage !== 'REJECTED' && remain > 0 && o.status === 'PENDING';
  const steps: { label: string; sub: string; state: 'done' | 'now' | 'todo' }[] = [
    { label: 'Tạo đơn', sub: `${saleDay(o)}${o.by ? ` · ${users.find((u) => u.id === o.by)?.name ?? ''}` : ''}`, state: 'done' },
    { label: 'Duyệt đơn', sub: o.approval ? (o.approval.status === 'PENDING' ? 'chờ người duyệt' : o.approval.status === 'REJECTED' ? 'không duyệt' : `${users.find((u) => u.id === o.approval?.decidedBy)?.name ?? 'đã duyệt'}`) : 'tự duyệt', state: stage === 'APPROVAL' || stage === 'REJECTED' ? 'now' : 'done' },
    { label: 'Yêu cầu xuất kho', sub: vs.some((v) => v.type === 'OUT') ? vs.filter((v) => v.type === 'OUT').map((v) => v.code).join(', ') : 'chưa gửi', state: stage === 'READY' ? 'now' : stage === 'APPROVAL' || stage === 'REJECTED' ? 'todo' : 'done' },
    { label: 'Kho xuất', sub: stage === 'PARTIAL' ? 'một phần' : stage === 'WAIT_WH' ? 'chờ kho duyệt' : issuedAny || o.status !== 'PENDING' ? 'đã xuất' : '', state: stage === 'WAIT_WH' || stage === 'PARTIAL' ? 'now' : stage === 'DONE' || stage === 'SHIPPING' ? 'done' : 'todo' },
    { label: o.status === 'CANCELLED' ? 'Đã hủy' : 'Hoàn thành', sub: o.status === 'CANCELLED' ? o.cancelReason ?? '' : 'khi kho xuất đủ', state: stage === 'DONE' || stage === 'SHIPPING' || stage === 'CANCELLED' ? 'done' : 'todo' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className={cn(btnGhost, btnSm)} onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Bán hàng</button>
        <h2 className="text-[17px] font-medium">Đơn bán</h2><Code>{o.code}</Code><Chip tone={SALE_STAGE[stage].tone}>{SALE_STAGE[stage].label}</Chip>
        {q && <button className="text-[13px] text-[rgb(var(--accent-fg))] hover:underline" onClick={() => openComposer({ quoteId: q.id, view: true, mode: 'QUOTE' })}>từ {q.code}</button>}
        <span className="ml-auto flex flex-wrap gap-2">
          <button className={cn(btnGhost, 'px-2.5')} onClick={() => printHtml(docShell(`Phiếu bán hàng ${o.code}`, saleHtml(o, company)))} aria-label="In phiếu bán hàng" title="In phiếu bán hàng"><Printer className="h-4 w-4" aria-hidden /></button>
          {o.status === 'PENDING' && !issuedAny && <button className={btnGhost} onClick={() => setCancel('')}>Hủy đơn</button>}
          {o.status === 'SHIPPING' && <button className={btnGhost} onClick={() => setSaleStatus(o.id, 'DONE')}>Đã giao xong</button>}
          {o.status !== 'CANCELLED' && o.invoice !== false && due - invAsked > 0 && stage !== 'APPROVAL' && stage !== 'REJECTED' && <button className={btnGhost} onClick={() => setInv({ amount: Math.max(0, due - invAsked), note: '' })}><ReceiptIcon className="h-4 w-4" aria-hidden />Yêu cầu xuất hóa đơn</button>}
          {canReq && <button className={btnPrimary} onClick={() => requestSaleIssue(o.id)} title="Tạo phiếu xuất gửi kho duyệt"><PackageMinus className="h-4 w-4" aria-hidden />Yêu cầu xuất kho</button>}
        </span>
      </div>
      <div className="glass-card flex flex-wrap items-center gap-x-2 gap-y-3 rounded-xl px-4 py-3">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && <span className={cn('hidden h-0.5 w-6 rounded sm:block', s.state === 'todo' ? 'bg-[rgb(var(--line))]' : 'bg-[rgb(var(--fg)/0.6)]')} aria-hidden />}
            <div className="flex items-center gap-2">
              <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px]', s.state === 'done' ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : s.state === 'now' ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-white' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))]')}>{s.state === 'done' ? <CheckIcon className="h-3 w-3" aria-hidden /> : i + 1}</span>
              <div className="leading-tight"><p className={cn('text-[13px]', s.state === 'now' && 'font-medium', s.state === 'todo' && 'text-[rgb(var(--muted))]')}>{s.label}</p>{s.sub && <p className="text-[11.5px] text-[rgb(var(--muted))]">{s.sub}</p>}</div>
            </div>
          </Fragment>
        ))}
      </div>
      {o.approval && o.approval.status !== 'APPROVED' && <p className="rounded-lg bg-[rgb(var(--accent)/0.08)] px-4 py-2.5 text-[13px]">{o.approval.status === 'PENDING' ? 'Đơn chờ duyệt' : 'Đơn không được duyệt'}: {o.approval.reasons.join('; ')}{o.approval.note ? ` · ${o.approval.note}` : ''}. Người duyệt theo quy trình "Đơn bán" ở Cài đặt › Quy trình & phê duyệt; duyệt ở Công việc.</p>}
      {issuedAny && o.status !== 'CANCELLED' && <p className="flex items-center gap-2 rounded-lg border border-dashed border-[rgb(var(--line))] px-4 py-2.5 text-[13px] text-[rgb(var(--fg2))]"><Lock className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />Đã xuất kho: khóa hàng hóa, số lượng, giá; không hủy đơn. Hàng trả lại do kho lập phiếu nhập trả theo mã đơn này, đơn tự ghi số trả.</p>}
      {cancel !== null && (
        <div className="glass-card flex flex-wrap items-center gap-2 rounded-xl px-4 py-3">
          <input className={cn(inputBase, 'min-w-[240px] flex-1')} value={cancel} onChange={(e) => setCancel(e.target.value)} placeholder="Lý do hủy đơn" aria-label="Lý do hủy" autoFocus />
          <button className={btnGhost} onClick={() => setCancel(null)}>Thôi</button>
          <button className={cn(btnPrimary, 'bg-[rgb(var(--danger))]')} disabled={cancel.trim().length < 3} onClick={() => { setSaleStatus(o.id, 'CANCELLED', cancel.trim()); setCancel(null); }}>Hủy đơn</button>
        </div>
      )}
      {inv && (
        <div className="glass-card flex flex-wrap items-center gap-2 rounded-xl px-4 py-3">
          <span className="text-[13px] font-medium">Yêu cầu xuất hóa đơn</span>
          <div className="w-44"><MoneyInput value={inv.amount} onChange={(v) => setInv({ ...inv, amount: v })} /></div>
          <input className={cn(inputBase, 'min-w-[220px] flex-1')} value={inv.note} onChange={(e) => setInv({ ...inv, note: e.target.value })} placeholder="Ghi chú cho kế toán: gộp phiếu, ngày xuất, email nhận HĐ" aria-label="Ghi chú cho kế toán" />
          <button className={btnGhost} onClick={() => setInv(null)}>Thôi</button>
          <button className={btnPrimary} disabled={!(inv.amount > 0)} onClick={() => { requestSaleInvoice(o.id, inv.amount, inv.note); setInv(null); }}><Send className="h-4 w-4" aria-hidden />Gửi kế toán</button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          <SetBlock title="Hàng hóa" sub={`${o.lines.length} dòng${o.by ? ` · lên đơn bởi ${users.find((u) => u.id === o.by)?.name ?? ''}` : ''}`}>
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-[13px]">
                <thead><tr className="whitespace-nowrap border-b border-[rgb(var(--line))] text-left text-[12px] text-[rgb(var(--muted))]"><th className="py-2 pl-5 pr-2 font-normal">Mã hàng</th><th className="px-2 font-normal">Hàng hóa</th><th className="px-2 font-normal">ĐVT</th><th className="px-2 text-right font-normal">Đặt</th><th className="px-2 text-right font-normal">Đã xuất</th><th className="px-2 text-right font-normal">Chờ kho</th><th className="px-2 text-right font-normal">Còn lại</th><th className="px-2 text-right font-normal">Trả</th><th className="px-2 text-right font-normal">Đơn giá</th><th className="px-2 text-right font-normal">CK</th><th className="pl-2 pr-5 text-right font-normal">Thành tiền</th></tr></thead>
                <tbody>{o.lines.map((l) => { const iss = saleIssQ(o, l); const p = pq[l.id] ?? 0; const rest = Math.max(0, l.qty - iss - p); const r = saleRetQ(o, l); return (
                  <tr key={l.id} className="border-b border-[rgb(var(--ink)/0.05)]">
                    <td className="whitespace-nowrap py-2 pl-5 pr-2">{l.ref ? <Code>{l.ref}</Code> : <span className="text-[rgb(var(--muted))]">—</span>}</td>
                    <td className="px-2"><span className="block max-w-[220px] truncate" title={l.name}>{l.name}</span></td>
                    <td className="whitespace-nowrap px-2 text-[rgb(var(--muted))]">{l.unit}</td>
                    <td className="px-2 text-right tabular-nums">{fmtN(l.qty)}</td>
                    <td className="px-2 text-right tabular-nums">{fmtN(iss)}</td>
                    <td className="px-2 text-right tabular-nums">{p ? fmtN(p) : '—'}</td>
                    <td className={cn('px-2 text-right tabular-nums', rest > 0 && o.status !== 'CANCELLED' && 'text-[rgb(var(--accent-fg))]')}>{fmtN(rest)}</td>
                    <td className="px-2 text-right tabular-nums">{r ? fmtN(r) : '—'}</td>
                    <td className="px-2 text-right tabular-nums">{fmtN(l.price)}</td>
                    <td className="px-2 text-right tabular-nums">{l.discountPct ? `${l.discountPct}%` : '—'}</td>
                    <td className="whitespace-nowrap pl-2 pr-5 text-right tabular-nums">{fmtN(saleLineNet(l))}</td>
                  </tr>); })}</tbody>
              </table>
            </div>
            {o.note && <p className="mt-3 text-[12.5px] text-[rgb(var(--muted))]">{o.note}</p>}
          </SetBlock>
          {o.status === 'PENDING' && remain > 0 && <SaleStockCard o={o} />}
          <SetBlock title="Phiếu kho của đơn" sub="Tạo khi bấm Yêu cầu xuất kho; kho duyệt một phần hoặc toàn bộ. Phiếu nhập trả do kho lập theo mã đơn.">
            {vs.length ? (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[620px] text-[13px]">
                  <thead><tr className="border-b border-[rgb(var(--line))] text-left text-[12px] text-[rgb(var(--muted))]"><th className="py-2 pl-5 pr-2 font-normal">Mã phiếu</th><th className="px-2 font-normal">Loại</th><th className="px-2 font-normal">Ngày</th><th className="px-2 text-right font-normal">Số lượng</th><th className="px-2 font-normal">Trạng thái</th><th className="pl-2 pr-5 font-normal">Người duyệt</th></tr></thead>
                  <tbody>{vs.map((v) => (
                    <tr key={v.id} className="cursor-pointer border-b border-[rgb(var(--ink)/0.05)] hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => go('warehouse')}>
                      <td className="whitespace-nowrap py-2 pl-5 pr-2"><Code>{v.code}</Code></td>
                      <td className="whitespace-nowrap px-2">{v.type === 'IN' ? 'Nhập trả' : 'Xuất bán'}</td>
                      <td className="whitespace-nowrap px-2 tabular-nums text-[rgb(var(--fg2))]">{fmtDate(v.date)}</td>
                      <td className="px-2 text-right tabular-nums">{fmtN(v.lines.reduce((s, l) => s + l.qty, 0))}{v.status === 'PENDING' && v.type === 'OUT' ? '' : ''}</td>
                      <td className="whitespace-nowrap px-2"><Chip tone={v.status === 'PENDING' ? 'orange' : v.status === 'DONE' ? 'teal' : 'muted'}>{v.status === 'PENDING' ? 'Chờ kho duyệt' : v.status === 'DONE' ? (v.type === 'IN' ? 'Đã nhập' : 'Đã xuất') : 'Đã hủy'}</Chip></td>
                      <td className="whitespace-nowrap pl-2 pr-5">{v.approvedBy ? users.find((u) => u.id === v.approvedBy)?.name ?? '—' : '—'}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            ) : <p className="text-[13px] text-[rgb(var(--muted))]">{stage === 'APPROVAL' ? 'Đơn chờ duyệt, chưa gửi kho.' : 'Chưa có phiếu kho. Bấm Yêu cầu xuất kho để gửi kho.'}</p>}
          </SetBlock>
        </div>
        <div className="space-y-4">
          <SetBlock title="Khách hàng">
            <p className="font-medium">{o.customer}</p>
            <p className="text-[12.5px] text-[rgb(var(--muted))]">{[o.taxCode && `MST ${o.taxCode}`, o.phone].filter(Boolean).join(' · ') || (o.customerId ? 'Khách hàng trong CRM' : 'Khách lẻ')}</p>
            <p className="mt-2 text-[13px] text-[rgb(var(--fg2))]">{SALE_DELIVERY[o.delivery]}{o.deliverAt ? `, ${fmtDate(o.deliverAt)}` : ''}{o.address ? ` · ${o.address}` : ''}</p>
          </SetBlock>
          <SetBlock title="Thanh toán" sub={SALE_PAY[o.pay]}>
            <dl className="space-y-1 text-[13px]">
              <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Tiền hàng</dt><dd className="tabular-nums">{fmtN(t.net)}</dd></div>
              {t.groups.filter((g) => g.rate > 0).map((g) => <div key={g.rate} className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Thuế GTGT {g.rate}%</dt><dd className="tabular-nums">{fmtN(g.vat)}</dd></div>)}
              {t.ship > 0 && <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Phí giao hàng</dt><dd className="tabular-nums">{fmtN(t.ship)}</dd></div>}
              {ret > 0 && <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Hàng trả lại</dt><dd className="tabular-nums">−{fmtN(ret)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-[rgb(var(--line))] pt-2"><dt className="font-medium">Thực tế phải thu</dt><dd className="text-[17px] font-medium tabular-nums">{fmtN(due)}</dd></div>
              <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Đã thu (kế toán xác nhận)</dt><dd className="tabular-nums">{fmtN(paid)}</dd></div>
              {pend > 0 && <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Chờ xác nhận</dt><dd className="tabular-nums">{fmtN(pend)}</dd></div>}
              <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Còn phải thu</dt><dd className="font-medium tabular-nums">{fmtN(Math.max(0, left))}</dd></div>
              {left < 0 && <div className="flex justify-between text-[rgb(var(--accent-fg))]"><dt>Khách trả thừa (hoàn tiền ở Thu chi)</dt><dd className="tabular-nums">{fmtN(-left)}</dd></div>}
              {o.creditDays > 0 && <div className="flex justify-between"><dt className="text-[rgb(var(--muted))]">Hạn trả</dt><dd className="tabular-nums">{o.issuedAt ? fmtDate(saleDue(o)) : `${o.creditDays} ngày từ khi xuất kho`}</dd></div>}
            </dl>
            {o.payments.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-[rgb(var(--line))] pt-3 text-[12.5px]">
                {o.payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="tabular-nums">{new Date(p.at).toLocaleDateString('vi-VN')}</span><span className="text-[rgb(var(--muted))]">{p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
                    <span className="ml-auto tabular-nums">{fmtN(p.amount)}</span>
                    {p.confirmed ? <Chip tone="teal">Đã vào quỹ</Chip> : canCash ? <button className={cn(btnGhost, btnSm)} onClick={() => confirmSalePayment(o.id, p.id)}>Xác nhận</button> : <Chip tone="orange">Chờ kế toán</Chip>}
                  </li>
                ))}
              </ul>
            )}
            {o.status !== 'CANCELLED' && left > 0 && (
              <div className="mt-3 space-y-2 border-t border-[rgb(var(--line))] pt-3">
                <p className="text-[12px] text-[rgb(var(--muted))]">{canCash ? 'Ghi thu (kế toán): tự sinh phiếu thu quỹ' : 'Ghi nhận tiền khách trả, chờ kế toán xác nhận'}</p>
                <MoneyInput value={amt} onChange={setAmt} />
                <div className="flex gap-2">
                  <select className={cn(inputBase, 'min-w-0 flex-1')} value={method} onChange={(e) => setMethod(e.target.value as 'CASH' | 'BANK')} aria-label="Hình thức thu"><option value="BANK">Chuyển khoản</option><option value="CASH">Tiền mặt</option></select>
                  <button className={btnGhost} onClick={() => setAmt(Math.max(0, left))}>Đủ</button>
                  <button className={btnPrimary} disabled={!(amt > 0 && amt <= left)} onClick={() => { addSalePayment(o.id, amt, method); setAmt(0); }}><Coins className="h-4 w-4" aria-hidden />Ghi thu</button>
                </div>
              </div>
            )}
          </SetBlock>
          {((o.invReqs?.length ?? 0) > 0 || o.invoice) && (
            <SetBlock title="Hóa đơn" sub={o.invoice ? 'Khách lấy hóa đơn VAT' : undefined}>
              {(o.invReqs ?? []).length ? (
                <ul className="space-y-2 text-[13px]">
                  {(o.invReqs ?? []).map((r) => (
                    <li key={r.id} className="space-y-1.5">
                      <div className="flex items-center gap-2"><span className="tabular-nums">{new Date(r.at).toLocaleDateString('vi-VN')}</span><span className="tabular-nums">{fmtN(r.amount)}</span>
                        <span className="ml-auto">{r.status === 'PENDING' ? <Chip tone="orange">Chờ kế toán</Chip> : r.status === 'DONE' ? <Chip tone="teal">Đã xuất {r.no}</Chip> : <Chip tone="muted">Trả lại</Chip>}</span></div>
                      {r.note && <p className="text-[12px] text-[rgb(var(--muted))]">{r.note}</p>}
                      {r.why && <p className="text-[12px] text-[rgb(var(--danger-fg))]">{r.why}</p>}
                      {r.status === 'PENDING' && canCash && (
                        <div className="flex gap-2"><input className={cn(inputBase, 'min-w-0 flex-1 py-1 text-[13px]')} value={dec[r.id] ?? ''} onChange={(e) => setDec({ ...dec, [r.id]: e.target.value })} placeholder="Số hóa đơn, hoặc lý do trả lại" aria-label="Số hóa đơn hoặc lý do" />
                          <button className={cn(btnGhost, btnSm)} onClick={() => decideSaleInvoice(o.id, r.id, false, dec[r.id] ?? '')}>Trả lại</button>
                          <button className={cn(btnPrimary, btnSm)} onClick={() => decideSaleInvoice(o.id, r.id, true, dec[r.id] ?? '')}>Đã xuất</button></div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[13px] text-[rgb(var(--muted))]">Chưa gửi yêu cầu. NV kinh doanh bấm Yêu cầu xuất hóa đơn khi muốn xuất.</p>}
            </SetBlock>
          )}
          {((o.poIds?.length ?? 0) > 0 || wo || o.issueRefs?.some((r) => r.startsWith('PX-'))) && (
            <SideCard title="Chứng từ liên quan">
              <ul className="space-y-1.5 text-[13px]">
                {o.issueRefs?.filter((r) => r.startsWith('PX-')).map((r) => <li key={r}><button className="hover:underline" onClick={() => go('inventory')}><Code>{r}</Code> phiếu xuất vật tư</button></li>)}
                {pos.filter((p) => o.poIds?.includes(p.id)).map((p) => <li key={p.id}><button className="hover:underline" onClick={() => go('supply')}><Code>{p.code}</Code> đặt hàng {p.vendor}</button></li>)}
                {wo && <li><button className="hover:underline" onClick={() => go('production')}><Code>{wo.code}</Code> lệnh sản xuất</button></li>}
              </ul>
            </SideCard>
          )}
        </div>
      </div>
    </div>
  );
}

