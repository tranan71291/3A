'use client';

import { ACCT_STD, boqIsEstimate, boqTotal, cashVat, isCashReversal, iso, latestQuote, lineNet, saleIssQ, saleLineNet, saleResOf, saleRetQ, whQty } from './core';
import type { Acct, AcctConfig, AcctEvent, AcctStd, CashEntry, CostAllocBy, GetflyOrderPayload, GetflyOrderRec, JLine, Lead, Quote, QuoteLine, SaleLineKind, SalesOrder, SaleStage, SaleStockData, SkuItem, StockVoucher } from './types';
import { stockOf } from './workshop';

/** Tiền hàng, chiết khấu, thuế theo từng mức, phí giao, tổng phải trả */
export function saleTotals(o: Pick<SalesOrder, 'lines' | 'shipFee'>) {
  const gross = o.lines.reduce((s, l) => s + Math.round(l.qty * l.price), 0);
  const net = o.lines.reduce((s, l) => s + saleLineNet(l), 0);
  const rates = Array.from(new Set(o.lines.map((l) => l.vat))).sort((a, b) => a - b);
  const groups = rates.map((r) => { const base = o.lines.filter((l) => l.vat === r).reduce((s, l) => s + saleLineNet(l), 0); return { rate: r, base, vat: Math.round((base * r) / 100) }; });
  const vat = groups.reduce((s, g) => s + g.vat, 0);
  const ship = o.shipFee ?? 0;
  return { gross, discount: gross - net, net, groups, vat, ship, grand: net + vat + ship };
}

/** Giá trị hàng trả lại (sau chiết khấu, gồm VAT) — trừ vào số phải thu */
export function saleReturned(o: SalesOrder) {
  return o.lines.reduce((s, l) => { const r = saleRetQ(o, l); return r && l.qty ? s + Math.round((saleLineNet(l) / l.qty) * r * (1 + l.vat / 100)) : s; }, 0);
}

/** Cấu hình mặc định theo thông tư (doanh nghiệp sửa được ở Cài đặt › Hệ thống tài khoản) */
export function acctDefaults(std: AcctStd, year: number, by?: string): AcctConfig {
  const t99 = std === 'TT99';
  const sell = t99 ? '6418' : '6421', sellSvc = t99 ? '6417' : '6421', adm = t99 ? '6428' : '6422', admSvc = t99 ? '6427' : '6422';
  return {
    std, year, chosenAt: Date.now(), chosenBy: by, custom: [],
    funds: { CASH: t99 ? '111' : '1111', BANK: t99 ? '112' : '1121' }, vatIn: '1331', vatOut: '33311',
    rules: {
      IN_SALE: { dr: '@FUND', cr: '131' }, IN_ADV_BACK: { dr: '@FUND', cr: '141' }, IN_OTHER: { dr: '@FUND', cr: '@CAT' },
      OUT_COST: { dr: '@CAT', cr: '@FUND' }, OUT_VENDOR: { dr: '331', cr: '@FUND' }, OUT_ADVANCE: { dr: '141', cr: '@FUND' }, OUT_REFUND: { dr: '131', cr: '@FUND' },
      TRANSFER: { dr: '@FUND_TO', cr: '@FUND' },
      SALE_REVENUE: { dr: '131', cr: t99 ? '511' : '5111' }, SALE_COGS: { dr: '632', cr: '156' }, SALE_RETURN: { dr: t99 ? '521' : '5111', cr: '131' }, SALE_RETURN_STOCK: { dr: '156', cr: '632' },
    },
    cats: {
      'Thu khác': '711', 'Bán phế liệu': '711', 'Thặng dư quỹ MDF': '711', 'Góp vốn / vay': t99 ? '4111' : '4111', 'Hoàn tiền nhà cung cấp': '331',
      'Thu tiền khách hàng': '131', 'Thu tiền bán hàng': '131', 'Hoàn tiền bán hàng': '131', 'Hủy phiếu thu bán hàng': '131', 'Hủy phiếu hoàn tiền bán hàng': '131', 'Hoàn ứng công tác': '141',
      'Vật tư, nguyên liệu': '152', 'Nhân công lắp đặt': '154', 'Vận chuyển': sellSvc, 'Lương, thưởng': '334', 'Mặt bằng, điện nước': admSvc, 'Marketing': sell,
      'Hoa hồng giới thiệu': sell, 'Hoa hồng': t99 ? '6411' : '6421', 'Bảo hành, sửa chữa': sell, 'Chi khác': '811', 'Phí ngân hàng': admSvc,
      'Tạm ứng công tác': '141', 'Tạm ứng nhân viên': '141', 'Công tác phí': adm, 'Chi phí triển khai sự kiện': sell,
    },
  };
}

export function acctList(c: AcctConfig): Acct[] {
  const all: Acct[] = [...ACCT_STD[c.std].coa.map(([code, name]) => ({ code, name })), ...c.custom];
  const codes = new Set(all.map((a) => a.code));
  return all.map((a) => { let p: string | undefined; for (let n = a.code.length - 1; n >= 3; n--) if (codes.has(a.code.slice(0, n))) { p = a.code.slice(0, n); break; } return { ...a, parent: a.parent ?? p }; })
    .sort((x, y) => x.code.localeCompare(y.code));
}

/** Sự kiện kinh tế của một phiếu quỹ */
export function cashEvent(e: CashEntry): AcctEvent {
  if (e.kind === 'TRANSFER') return 'TRANSFER';
  if (e.kind === 'IN') return e.sub === 'ADV_BACK' ? 'IN_ADV_BACK' : (e.sub === 'CUSTOMER' || ((e.source === 'SALE' || e.source === 'RECEIPT') && !isCashReversal(e))) ? 'IN_SALE' : 'IN_OTHER';
  if (e.sub === 'VENDOR') return 'OUT_VENDOR';
  if (e.sub === 'ADVANCE' || e.source === 'ADVANCE') return 'OUT_ADVANCE';
  if (e.sub === 'REFUND') return 'OUT_REFUND';
  return 'OUT_COST';
}

/** Định khoản một phiếu quỹ theo quy tắc của doanh nghiệp; acctMissing = khoản mục chưa gán tài khoản */
export function cashJournal(e: CashEntry, c: AcctConfig): { lines: JLine[]; event: AcctEvent; missing?: string } {
  const ev = cashEvent(e);
  const r = c.rules[ev];
  let missing: string | undefined;
  const res = (t: string) => {
    if (t === '@FUND') return c.funds[e.account];
    if (t === '@FUND_TO') return c.funds[e.toAccount ?? 'BANK'];
    if (t === '@CAT') { const a = c.cats[e.category]; if (!a) missing = e.category; return a || (e.kind === 'IN' ? '711' : '811'); }
    return t;
  };
  const base = { date: e.date, ref: e.code, desc: e.note || e.category, src: 'CASH' as const, saleId: e.saleId };
  const vat = ev === 'OUT_COST' ? cashVat(e) : 0;
  const lines: JLine[] = [{ ...base, id: `${e.id}:1`, dr: res(r.dr), cr: res(r.cr), amount: e.amount - vat }];
  if (vat) lines.push({ ...base, id: `${e.id}:v`, dr: c.vatIn, cr: res(r.cr), amount: vat, desc: `Thuế GTGT đầu vào ${e.invNo ?? ''}`.trim() });
  return { lines, event: ev, missing };
}

/** Định khoản đơn bán theo phiếu kho đã duyệt: doanh thu + thuế, giá vốn tạm tính; hàng trả lại ghi giảm */
export function saleJournal(o: SalesOrder, vs: StockVoucher[], skus: SkuItem[], c: AcctConfig): JLine[] {
  const out: JLine[] = [];
  const cost = (sku: string) => skus.find((k) => k.sku === sku)?.costPrice ?? 0;
  vs.filter((v) => v.saleId === o.id && v.status === 'DONE' && (v.type === 'OUT' || v.type === 'IN')).forEach((v) => {
    let net = 0, vat = 0, cogs = 0;
    v.lines.forEach((l) => {
      const ol = o.lines.find((x) => x.id === l.lineId);
      if (!ol || !ol.qty) return;
      const n = Math.round((saleLineNet(ol) / ol.qty) * l.qty);
      net += n; vat += Math.round((n * ol.vat) / 100); cogs += Math.round(l.qty * cost(l.sku));
    });
    const d = v.approvedAt ? iso(new Date(v.approvedAt)) : v.date;
    const base = { date: d, ref: v.code, saleId: o.id, src: 'SALE' as const };
    if (v.type === 'OUT') {
      if (net) out.push({ ...base, id: `${v.id}:r`, dr: c.rules.SALE_REVENUE.dr, cr: c.rules.SALE_REVENUE.cr, amount: net, desc: `Doanh thu ${o.code}` });
      if (vat) out.push({ ...base, id: `${v.id}:t`, dr: c.rules.SALE_REVENUE.dr, cr: c.vatOut, amount: vat, desc: `Thuế GTGT đầu ra ${o.code}` });
      if (cogs) out.push({ ...base, id: `${v.id}:c`, dr: c.rules.SALE_COGS.dr, cr: c.rules.SALE_COGS.cr, amount: cogs, desc: `Giá vốn ${o.code} (tạm tính)` });
    } else {
      if (net) out.push({ ...base, id: `${v.id}:r`, dr: c.rules.SALE_RETURN.dr, cr: c.rules.SALE_RETURN.cr, amount: net, desc: `Hàng bán trả lại ${o.code}` });
      if (vat) out.push({ ...base, id: `${v.id}:t`, dr: c.vatOut, cr: c.rules.SALE_RETURN.cr, amount: vat, desc: `Thuế GTGT hàng trả lại ${o.code}` });
      if (cogs) out.push({ ...base, id: `${v.id}:c`, dr: c.rules.SALE_RETURN_STOCK.dr, cr: c.rules.SALE_RETURN_STOCK.cr, amount: cogs, desc: `Nhập lại kho ${o.code}` });
    }
  });
  return out;
}

// ---------------- Lãi trên đơn bán (v51.3) ----------------
/** Doanh thu thuần: sau chiết khấu, trừ hàng bán bị trả lại, chưa gồm thuế GTGT */
export function saleNetRevenue(o: SalesOrder) {
  if (o.status === 'CANCELLED') return 0;
  const ret = o.lines.reduce((s, l) => { const r = saleRetQ(o, l); return r && l.qty ? s + Math.round((saleLineNet(l) / l.qty) * r) : s; }, 0);
  return saleTotals(o).net - ret;
}

/** Giá vốn tạm tính: (đã xuất − trả lại; chưa xuất thì số đặt) × giá vốn hiện tại của mã hàng; dòng không quản lý kho không có giá vốn */
export function saleCostEst(o: SalesOrder, skus: SkuItem[]) {
  if (o.status === 'CANCELLED') return 0;
  return o.lines.reduce((s, l) => {
    if (l.kind !== 'SKU' || !l.ref) return s;
    const iss = saleIssQ(o, l);
    const q = iss > 0 ? iss - saleRetQ(o, l) : l.qty;
    return s + Math.max(0, q) * (skus.find((k) => k.sku === l.ref)?.costPrice ?? 0);
  }, 0);
}

/** Chi phí trực tiếp gắn vào đơn (chưa gồm thuế GTGT được khấu trừ): phiếu chi gắn đơn + phần phân bổ của phiếu chi nhiều đơn */
export function saleDirectCost(o: SalesOrder, entries: CashEntry[], exceptId?: string) {
  return entries.reduce((s, e) => {
    if (e.kind !== 'OUT' || e.source === 'SALE' || isCashReversal(e) || e.id === exceptId || !e.amount) return s;
    const netK = (e.amount - cashVat(e)) / e.amount;
    if (e.allocs?.length) { const a = e.allocs.find((x) => x.saleId === o.id); return a ? s + Math.round(a.amount * netK) : s; }
    return e.saleId === o.id ? s + Math.round(e.amount * netK) : s;
  }, 0);
}

/** Phân bổ một khoản cho nhiều đơn: theo doanh thu thuần, số lượng hàng, hoặc chia đều; làm tròn dồn vào đơn cuối */
export function allocCost(total: number, orders: SalesOrder[], by: CostAllocBy): { saleId: string; amount: number }[] {
  if (!orders.length) return [];
  const w = orders.map((o) => (by === 'EQUAL' ? 1 : by === 'QTY' ? o.lines.filter((l) => l.kind !== 'FREE').reduce((s, l) => s + l.qty, 0) : Math.max(0, saleNetRevenue(o))));
  const sum = w.reduce((s, x) => s + x, 0);
  const ww = sum > 0 ? w : orders.map(() => 1);
  const tot = sum > 0 ? sum : orders.length;
  let left = Math.round(total);
  return orders.map((o, i) => { const a = i === orders.length - 1 ? left : Math.round((total * ww[i]) / tot); left -= a; return { saleId: o.id, amount: a }; });
}

/** Số đang chờ kho duyệt theo dòng (phiếu xuất chờ duyệt của đơn) */
export function salePendingQ(o: SalesOrder, vs: StockVoucher[]) {
  const m: Record<string, number> = {};
  vs.filter((v) => v.saleId === o.id && v.type === 'OUT' && v.status === 'PENDING').forEach((v) => v.lines.forEach((l) => { if (l.lineId) m[l.lineId] = (m[l.lineId] ?? 0) + (l.req ?? l.qty); }));
  return m;
}

/** Giai đoạn của đơn để hiển thị: duyệt -> yêu cầu xuất kho -> kho xuất một phần / đủ */
export function saleStage(o: SalesOrder, vs: StockVoucher[]): SaleStage {
  if (o.status === 'CANCELLED') return 'CANCELLED';
  if (o.status === 'DONE') return 'DONE';
  if (o.status === 'SHIPPING') return 'SHIPPING';
  if (o.approval?.status === 'PENDING') return 'APPROVAL';
  if (o.approval?.status === 'REJECTED') return 'REJECTED';
  const iss = o.lines.some((l) => saleIssQ(o, l) > 0);
  if (iss) return 'PARTIAL';
  if (o.issueRequest || vs.some((v) => v.saleId === o.id && v.type === 'OUT' && v.status === 'PENDING')) return 'WAIT_WH';
  return 'READY';
}

/** Số lượng đang giữ cho các đơn bán chưa xuất kho (giữ mềm: chưa trừ tồn). before: chỉ tính đơn lên trước (đơn trước được ưu tiên hàng) */
export function saleHeld(orders: SalesOrder[], kind: SaleLineKind, ref: string, exceptId?: string, before = Infinity) {
  return orders.filter((o) => o.status === 'PENDING' && o.id !== exceptId && o.createdAt < before).reduce((s, o) => s + o.lines.filter((l) => l.kind === kind && l.ref === ref).reduce((a, l) => a + Math.max(0, l.qty - (o.issuedQ?.[l.id] ?? 0)), 0), 0);
}

/** Từng dòng: giữ chỗ sẵn, tồn tự do (đã trừ phần các đơn khác đang giữ), số có thể giao, số thiếu */
export function saleStock(o: Pick<SalesOrder, 'id' | 'lines' | 'whId' | 'customerId' | 'leadId' | 'createdAt'> & { issuedQ?: Record<string, number> }, d: SaleStockData) {
  const since = o.createdAt || Infinity;
  const used = new Map<string, number>();
  return o.lines.map((l0) => {
    /** v49: chỉ tính phần chưa xuất của dòng */
    const l = { ...l0, qty: Math.max(0, l0.qty - (o.issuedQ?.[l0.id] ?? 0)) };
    const key = `${l.kind}:${l.ref ?? ''}`;
    const before = used.get(key) ?? 0;
    used.set(key, before + l.qty);
    if (l.kind === 'SKU' && l.ref) {
      const k = d.skus.find((x) => x.sku === l.ref);
      const res = saleResOf(o, l.ref, d.reservations).reduce((s, r) => s + r.qty, 0);
      const free = k ? Math.max(0, whQty(k, o.whId, d.warehouses) - saleHeld(d.orders, 'SKU', l.ref, o.id, since)) : 0;
      const have = Math.max(0, Math.min(l.qty, res + free - before));
      return { l, track: true, res, free, have, short: l.qty - have };
    }
    if (l.kind === 'ITEM' && l.ref) {
      const free = Math.max(0, stockOf(l.ref, d.stockMoves).qty - saleHeld(d.orders, 'ITEM', l.ref, o.id, since));
      const have = Math.max(0, Math.min(l.qty, free - before));
      return { l, track: true, res: 0, free, have, short: l.qty - have };
    }
    return { l, track: false, res: 0, free: 0, have: l.qty, short: 0 };
  });
}

export function quoteTotals(lines: QuoteLine[], vatPct: number) {
  const sub = lines.reduce((a, l) => a + l.qty * lineNet(l), 0);
  const by = new Map<number, number>();
  lines.forEach((l) => { const r = l.vat ?? vatPct; by.set(r, (by.get(r) ?? 0) + l.qty * lineNet(l)); });
  const vat = [...by.entries()].reduce((a, [r, b]) => a + Math.round((b * r) / 100), 0);
  return { sub, vat, gross: sub + vat };
}

/** Giá trị dự án: báo giá đã chốt -> báo giá mới nhất -> BOQ -> ước tính MKT */
export function projectValue(l: Lead, quotes: Quote[]): { value: number; source: string } {
  const won = quotes.find((q) => q.id === l.wonQuoteId);
  if (won) return { value: won.amount, source: `Chốt theo ${won.code}` };
  const lq = latestQuote(l.id, quotes);
  if (lq) return { value: lq.amount, source: `Báo giá lần ${lq.version}` };
  return { value: boqTotal(l), source: boqIsEstimate(l) ? 'Ước tính MKT' : 'Theo BOQ' };
}

/** Dựng đơn Getfly từ ĐÚNG phiên bản báo giá đã chốt (cùng công thức với server) */
export function buildGetflyPayload(lead: Lead, quote: Quote, account: { code: string; name: string; phone?: string }, appName: string, orderDate: string) {
  let sub = 0;
  const products = quote.lines.map((l) => {
    const gross = l.qty * l.listPrice;
    const cash = Math.round((gross * l.discountPct) / 100);
    sub += gross - cash;
    return { product_code: l.sku, product_name: l.name, quantity: l.qty, price: l.listPrice, product_sale_off: l.discountPct, cash_discount: cash };
  });
  const vat = Math.round((sub * quote.vatPct) / 100);
  const payload: GetflyOrderPayload = {
    order_info: { account_code: account.code, account_name: account.name, account_phone: account.phone?.replace(/\D/g, '') || undefined, order_date: orderDate.split('-').reverse().join('/'), discount: 0, discount_amount: 0, vat: quote.vatPct, vat_amount: vat, amount: sub + vat, source_name: `${appName} ${lead.code}` },
    products,
    terms: [`Mã dự án ${appName}: ${lead.code}`, `Theo báo giá ${quote.code} (lần ${quote.version})`, ...(lead.boqNote ? [`Dự án: ${lead.boqNote}`] : [])],
  };
  return { payload, totals: { sub, vat, gross: sub + vat } };
}

/** Doanh số lũy kế năm TC & công nợ từ đơn Getfly đã được tính doanh số */
export function financialsFromOrders(customerId: string, orders: GetflyOrderRec[], fiscalYear: number) {
  const mine = orders.filter((o) => o.customerId === customerId && o.approved);
  return {
    ytd: mine.filter((o) => o.orderDate.startsWith(String(fiscalYear))).reduce((s, o) => s + o.net, 0),
    debt: mine.reduce((s, o) => s + Math.max(0, o.gross - o.paid), 0),
  };
}

