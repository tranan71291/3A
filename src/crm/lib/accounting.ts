// =====================================================================
//  v58 LÕI KẾ TOÁN — tách từ lib/getfly.tsx (getfly.tsx export lại để không đổi đường import cũ)
//  - Bộ tài khoản, quy tắc định khoản (TT99 / TT133), định khoản phiếu quỹ và đơn bán: giữ nguyên như v51.3
//  - Ghi sổ thật: bút toán xác định theo nguồn (CE / SV / SVC / INV), lưu vào journalEntries, không sửa đè:
//    nguồn đổi -> bút toán đảo (REV:<id>) + bút toán ghi lại (<id>~2…); kỳ đã khóa -> ghi vào ngày đầu kỳ còn mở
//  - Doanh thu ON_DELIVERY (mặc định): ghi khi phiếu xuất kho bán được duyệt / hàng không qua kho được giao;
//    ON_INVOICE: ghi khi hóa đơn chuyển ISSUED, phiếu xuất chỉ ghi giá vốn
// =====================================================================
import { ACCT_STD, addDaysISO, cashVat, isCashReversal, iso, saleIssQ, saleLineNet, salePaid } from './core';
import { saleTotals } from './getfly';
import type { Acct, AcctConfig, AcctEvent, AcctStd, CashEntry, InvoiceReq, JEntry, JEntryLine, JLine, RevenueAt, SaleInvReq, SalesOrder, SkuItem, StockVoucher } from './types';

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

/** Giá trị một phiếu kho bán: tiền hàng sau chiết khấu, thuế, giá vốn tạm tính */
function voucherValue(o: SalesOrder, v: StockVoucher, skus: SkuItem[]) {
  const cost = (sku: string) => skus.find((k) => k.sku === sku)?.costPrice ?? 0;
  let net = 0, vat = 0, cogs = 0;
  v.lines.forEach((l) => {
    const ol = o.lines.find((x) => x.id === l.lineId);
    if (!ol || !ol.qty) return;
    const n = Math.round((saleLineNet(ol) / ol.qty) * l.qty);
    net += n; vat += Math.round((n * ol.vat) / 100); cogs += Math.round(l.qty * cost(l.sku));
  });
  return { net, vat, cogs };
}

/** Định khoản đơn bán theo phiếu kho đã duyệt: doanh thu + thuế, giá vốn tạm tính; hàng trả lại ghi giảm (sổ tính lúc xem, bản trước v58) */
export function saleJournal(o: SalesOrder, vs: StockVoucher[], skus: SkuItem[], c: AcctConfig): JLine[] {
  const out: JLine[] = [];
  vs.filter((v) => v.saleId === o.id && v.status === 'DONE' && (v.type === 'OUT' || v.type === 'IN')).forEach((v) => {
    const { net, vat, cogs } = voucherValue(o, v, skus);
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

// ---------------------------------------------------------------------
//  v58 ghi sổ thật
// ---------------------------------------------------------------------
export const revenueAtOf = (c: Pick<AcctConfig, 'revenueAt'> | null | undefined): RevenueAt => c?.revenueAt ?? 'ON_DELIVERY';
export const REVENUE_AT: Record<RevenueAt, { label: string; desc: string }> = {
  ON_DELIVERY: { label: 'Khi giao hàng (mặc định)', desc: 'Ghi doanh thu khi phiếu xuất kho bán được duyệt hoặc hàng không qua kho được giao. Hóa đơn chỉ để đối chiếu' },
  ON_INVOICE: { label: 'Khi xuất hóa đơn', desc: 'Cho ngành dịch vụ (Studio, Thuê xe, Đặt lịch): ghi doanh thu khi kế toán xuất hóa đơn; phiếu xuất kho chỉ ghi giá vốn' },
};

/** Phần gốc của mã bút toán (bỏ hậu tố lần ghi lại ~n) và lần ghi */
export const jBase = (id: string) => id.replace(/~\d+$/, '');
const jVer = (id: string) => { const m = /~(\d+)$/.exec(id); return m ? Number(m[1]) : 1; };

/** Kỳ của ngày (yyyy-mm) */
export const jPeriod = (d: string) => d.slice(0, 7);

/** Dấu của nội dung nguồn (ngày nguồn + các dòng): khác dấu = nguồn đã đổi, cần đảo + ghi lại */
const jSig = (date: string, lines: JEntryLine[]) => `${date}#${lines.map((l) => `${l.dr}>${l.cr}:${l.amount}`).sort().join('|')}`;

/** sigKey: dấu riêng của nguồn (phiếu kho: số lượng + doanh thu, không gồm giá vốn tạm tính — đổi giá vốn mã hàng không làm ghi lại phiếu đã ghi) */
const mkEntry = (p: Omit<JEntry, 'period' | 'total' | 'sig' | 'postedAt'>, sigKey?: string): JEntry | null => {
  const lines = p.lines.filter((l) => l.amount > 0 && !!l.dr && !!l.cr && l.dr !== l.cr).map((l) => ({ ...l, amount: Math.round(l.amount) }));
  if (!lines.length) return null;
  return { ...p, lines, period: jPeriod(p.date), total: lines.reduce((s, l) => s + l.amount, 0), sig: sigKey ?? jSig(p.date, lines), postedAt: 0 };
};

export type JSources = { cash: CashEntry[]; orders: SalesOrder[]; vouchers: StockVoucher[]; skus: SkuItem[]; invoices: InvoiceReq[] };

/** Hàng không qua kho (vật tư xưởng, gia công, dòng tự nhập): số đã giao */
const offStock = (l: SalesOrder['lines'][number]) => l.kind !== 'SKU' || !l.ref;

/** Bút toán đúng theo nguồn hiện tại (xác định, chạy lại nhiều lần cho cùng kết quả) */
export function expectedEntries(s: JSources, c: AcctConfig): JEntry[] {
  const out: JEntry[] = [];
  const push = (e: JEntry | null) => { if (e) out.push(e); };
  const ra = revenueAtOf(c);
  const R = c.rules;
  // 1. Phiếu quỹ
  s.cash.forEach((e) => {
    const j = cashJournal(e, c);
    push(mkEntry({ id: `CE:${e.id}`, date: e.date, event: j.event, src: 'CE', srcId: e.id, saleId: e.saleId, ref: e.code, desc: e.note || e.category, lines: j.lines.map((l) => ({ dr: l.dr, cr: l.cr, amount: l.amount, desc: l.desc })) }));
  });
  const byId = new Map(s.orders.map((o) => [o.id, o]));
  // 2. Phiếu kho bán đã duyệt (xuất bán / nhập hàng trả lại)
  s.vouchers.filter((v) => v.saleId && v.status === 'DONE' && (v.type === 'OUT' || v.type === 'IN')).forEach((v) => {
    const o = byId.get(v.saleId!); if (!o) return;
    const { net, vat, cogs } = voucherValue(o, v, s.skus);
    const date = v.approvedAt ? iso(new Date(v.approvedAt)) : v.date;
    const rev = ra === 'ON_DELIVERY';
    const lines: JEntryLine[] = v.type === 'OUT'
      ? [...(rev ? [{ dr: R.SALE_REVENUE.dr, cr: R.SALE_REVENUE.cr, amount: net, desc: `Doanh thu ${o.code}` }, { dr: R.SALE_REVENUE.dr, cr: c.vatOut, amount: vat, desc: `Thuế GTGT đầu ra ${o.code}` }] : []), { dr: R.SALE_COGS.dr, cr: R.SALE_COGS.cr, amount: cogs, desc: `Giá vốn ${o.code} (tạm tính)` }]
      : [...(rev ? [{ dr: R.SALE_RETURN.dr, cr: R.SALE_RETURN.cr, amount: net, desc: `Hàng bán trả lại ${o.code}` }, { dr: c.vatOut, cr: R.SALE_RETURN.cr, amount: vat, desc: `Thuế GTGT hàng trả lại ${o.code}` }] : []), { dr: R.SALE_RETURN_STOCK.dr, cr: R.SALE_RETURN_STOCK.cr, amount: cogs, desc: `Nhập lại kho ${o.code}` }];
    const key = `${date}#SV:${v.type}:${ra}#${v.lines.map((l) => `${l.lineId}:${l.qty}`).sort().join(',')}#${rev ? `${R.SALE_REVENUE.dr}/${R.SALE_REVENUE.cr}:${net}+${vat}` : ''}`;
    push(mkEntry({ id: `SV:${v.id}`, date, event: v.type === 'OUT' ? (rev ? 'SALE_REVENUE' : 'SALE_COGS') : (rev ? 'SALE_RETURN' : 'SALE_RETURN_STOCK'), src: 'SV', srcId: v.id, saleId: o.id, ref: v.code, desc: `${v.type === 'OUT' ? 'Xuất bán' : 'Nhập hàng trả lại'} ${o.code}`, lines }, key));
  });
  // 3. Hàng không qua kho đã giao (ON_DELIVERY): doanh thu khi giao / nghiệm thu
  if (ra === 'ON_DELIVERY') s.orders.filter((o) => o.status !== 'CANCELLED').forEach((o) => {
    const ls = o.lines.filter(offStock);
    const at = o.issuedAt ?? o.doneAt;
    if (!ls.length || !at) return;
    let net = 0, vat = 0;
    ls.forEach((l) => { const q = Math.min(l.qty, saleIssQ(o, l)); if (!l.qty || q <= 0) return; const n = Math.round((saleLineNet(l) / l.qty) * q); net += n; vat += Math.round((n * l.vat) / 100); });
    push(mkEntry({ id: `SVC:${o.id}`, date: iso(new Date(at)), event: 'SALE_REVENUE', src: 'SVC', srcId: o.id, saleId: o.id, ref: o.code, desc: `Doanh thu hàng không qua kho ${o.code}`, lines: [{ dr: R.SALE_REVENUE.dr, cr: R.SALE_REVENUE.cr, amount: net, desc: `Doanh thu ${o.code}` }, { dr: R.SALE_REVENUE.dr, cr: c.vatOut, amount: vat, desc: `Thuế GTGT đầu ra ${o.code}` }] }));
  });
  // 4. Hóa đơn đã xuất (ON_INVOICE): doanh thu + thuế theo hóa đơn
  if (ra === 'ON_INVOICE') s.invoices.filter((r) => r.status === 'ISSUED' && r.invoice).forEach((r) => {
    push(mkEntry({ id: `INV:${r.id}`, date: r.invoice!.date, event: 'SALE_REVENUE', src: 'INV', srcId: r.id, saleId: r.saleId, ref: r.invoice!.no, desc: `Hóa đơn ${r.invoice!.no} · ${r.saleCode}`, lines: [{ dr: R.SALE_REVENUE.dr, cr: R.SALE_REVENUE.cr, amount: r.amount, desc: `Doanh thu theo hóa đơn ${r.invoice!.no}` }, { dr: R.SALE_REVENUE.dr, cr: c.vatOut, amount: r.vat, desc: `Thuế GTGT đầu ra ${r.invoice!.no}` }] }));
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Ngày ghi được: không rơi vào kỳ đã khóa (khóa đến hết lockedUntil) */
export const jOpenDate = (d: string, lockedUntil?: string) => (lockedUntil && d <= lockedUntil ? addDaysISO(lockedUntil, 1) : d);

/**
 * So bút toán đã ghi với bút toán đúng theo nguồn: trả về bút toán cần thêm (mới / đảo / ghi lại) và bút toán cần đánh dấu đã đảo.
 * Không bao giờ sửa nội dung bút toán đã ghi. Nguồn trước ngày bắt đầu ghi sổ (since) nằm trong số dư đầu kỳ, không ghi lại.
 */
export function diffJournal(existing: JEntry[], expected: JEntry[], o: { since: string; lockedUntil?: string; by?: string; now: number }): { add: JEntry[]; mark: { id: string; reversedBy: string; reversedAt: number }[] } {
  const revOf = new Set(existing.filter((e) => e.src === 'REV' && e.reverses).map((e) => e.reverses!));
  const used = new Map<string, number>();
  const live = new Map<string, JEntry>();
  existing.forEach((e) => {
    if (e.src === 'REV') return;
    const b = jBase(e.id);
    used.set(b, Math.max(used.get(b) ?? 0, jVer(e.id)));
    if (e.reversedBy || revOf.has(e.id)) return;
    const cur = live.get(b);
    if (!cur || jVer(cur.id) < jVer(e.id)) live.set(b, e);
  });
  const exp = new Map(expected.filter((e) => e.date >= o.since).map((e) => [e.id, e]));
  const add: JEntry[] = [], mark: { id: string; reversedBy: string; reversedAt: number }[] = [];
  const keys = new Set([...live.keys(), ...exp.keys()]);
  keys.forEach((b) => {
    const L = live.get(b), X = exp.get(b);
    if (L && X && L.sig === X.sig) return;
    if (L) {
      const d = jOpenDate(L.date, o.lockedUntil);
      add.push({ id: `REV:${L.id}`, date: d, period: jPeriod(d), event: 'REVERSAL', src: 'REV', srcId: L.srcId, saleId: L.saleId, ref: L.ref, desc: `Đảo bút toán ${L.ref}: ${X ? 'chứng từ gốc đã sửa' : 'chứng từ gốc đã hủy / xóa'}`, lines: L.lines.map((l) => ({ ...l, dr: l.cr, cr: l.dr })), total: L.total, sig: `REV#${L.sig}`, postedBy: o.by, postedAt: o.now, reverses: L.id });
      mark.push({ id: L.id, reversedBy: `REV:${L.id}`, reversedAt: o.now });
    }
    if (X) {
      const v = used.has(b) ? (used.get(b) ?? 1) + 1 : 1;
      const d = jOpenDate(X.date, o.lockedUntil);
      add.push({ ...X, id: v > 1 ? `${b}~${v}` : b, date: d, period: jPeriod(d), postedBy: o.by, postedAt: o.now });
    }
  });
  return { add, mark };
}

/** Số dư theo tài khoản từ các dòng Nợ / Có (dương = dư Nợ) */
const addBal = (m: Map<string, number>, dr: string, cr: string, amount: number) => { m.set(dr, (m.get(dr) ?? 0) + amount); m.set(cr, (m.get(cr) ?? 0) - amount); };

/** Số dư đầu kỳ khi bắt đầu ghi sổ: tính từ sổ cũ (định khoản lúc xem, trước v58) cho các chứng từ trước ngày bắt đầu */
export function convertOpening(s: JSources, c: AcctConfig, since: string): Record<string, number> {
  const m = new Map<string, number>();
  s.cash.filter((e) => e.date < since).forEach((e) => cashJournal(e, c).lines.forEach((l) => l.amount > 0 && addBal(m, l.dr, l.cr, l.amount)));
  s.orders.forEach((o) => saleJournal(o, s.vouchers, s.skus, c).filter((l) => l.date < since).forEach((l) => l.amount > 0 && addBal(m, l.dr, l.cr, l.amount)));
  return Object.fromEntries(Array.from(m.entries()).filter(([, v]) => Math.round(v) !== 0).map(([k, v]) => [k, Math.round(v)]));
}

/** Tài khoản code thuộc nhánh acct (chính nó hoặc tài khoản chi tiết) */
export const inAcct = (code: string, acct: string) => code === acct || code.startsWith(acct);

export type TbRow = { code: string; open: number; dr: number; cr: number; close: number };

/** Cân đối số phát sinh: đầu kỳ (số dư đầu + phát sinh trước kỳ), phát sinh trong kỳ, cuối kỳ */
export function trialBalance(entries: JEntry[], opening: Record<string, number> | undefined, from: string, to: string): TbRow[] {
  const open = new Map<string, number>(Object.entries(opening ?? {}));
  const dr = new Map<string, number>(), cr = new Map<string, number>();
  entries.forEach((e) => e.lines.forEach((l) => {
    if (e.date < from) addBal(open, l.dr, l.cr, l.amount);
    else if (e.date <= to) { dr.set(l.dr, (dr.get(l.dr) ?? 0) + l.amount); cr.set(l.cr, (cr.get(l.cr) ?? 0) + l.amount); }
  }));
  const codes = Array.from(new Set([...open.keys(), ...dr.keys(), ...cr.keys()])).sort();
  return codes.map((code) => { const o = open.get(code) ?? 0, d = dr.get(code) ?? 0, k = cr.get(code) ?? 0; return { code, open: o, dr: d, cr: k, close: o + d - k }; }).filter((r) => r.open || r.dr || r.cr || r.close);
}

export type LedgerRow = { e: JEntry; l: JEntryLine; side: 'dr' | 'cr'; other: string; amount: number; bal: number };

/** Sổ cái một tài khoản (gồm tài khoản chi tiết): số dư đầu, từng dòng phát sinh với số dư lũy kế, số dư cuối */
export function ledger(entries: JEntry[], opening: Record<string, number> | undefined, acct: string, from: string, to: string): { open: number; rows: LedgerRow[]; dr: number; cr: number; close: number } {
  let open = Object.entries(opening ?? {}).filter(([k]) => inAcct(k, acct)).reduce((s, [, v]) => s + v, 0);
  const rows: LedgerRow[] = [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.postedAt - b.postedAt || a.id.localeCompare(b.id));
  sorted.forEach((e) => e.lines.forEach((l) => {
    const isDr = inAcct(l.dr, acct), isCr = inAcct(l.cr, acct);
    if (isDr === isCr) return;
    const v = isDr ? l.amount : -l.amount;
    if (e.date < from) { open += v; return; }
    if (e.date > to) return;
    rows.push({ e, l, side: isDr ? 'dr' : 'cr', other: isDr ? l.cr : l.dr, amount: l.amount, bal: 0 });
  }));
  let bal = open, dr = 0, cr = 0;
  rows.forEach((r) => { bal += r.side === 'dr' ? r.amount : -r.amount; r.bal = bal; if (r.side === 'dr') dr += r.amount; else cr += r.amount; });
  return { open, rows, dr, cr, close: bal };
}

// ---------------------------------------------------------------------
//  v58 yêu cầu xuất hóa đơn: bảng mới + đọc ngược phiếu cũ trong đơn
// ---------------------------------------------------------------------
/** Tiền hàng / thuế của phiếu yêu cầu cũ (bản cũ lưu tổng gồm thuế) */
export function invSplit(o: SalesOrder | undefined, r: Pick<SaleInvReq, 'amount' | 'items'>): { amount: number; vat: number; total: number } {
  if (r.items?.length) { const amount = r.items.reduce((s, x) => s + x.amount, 0); const vat = r.items.reduce((s, x) => s + Math.round((x.amount * x.vat) / 100), 0); return { amount, vat, total: amount + vat }; }
  const t = o ? saleTotals(o) : null;
  const vat = t && t.grand ? Math.round((r.amount * t.vat) / t.grand) : 0;
  return { amount: r.amount - vat, vat, total: r.amount };
}

/** Phiếu yêu cầu cũ (SalesOrder.invReqs) → bản ghi bảng mới (cùng id) */
export function invFromLegacy(o: SalesOrder, r: SaleInvReq, code: string): InvoiceReq {
  const sp = invSplit(o, r);
  return {
    id: r.id, code, saleId: o.id, saleCode: o.code, customerId: o.customerId, buyer: r.buyer, items: r.items, ...sp, note: r.note,
    status: r.status === 'DONE' ? 'ISSUED' : r.status, invoice: r.status === 'DONE' && r.no ? { no: r.no, date: iso(new Date(r.doneAt ?? r.at)) } : undefined,
    requestedBy: r.by, requestedAt: r.at, decidedBy: r.doneBy, decidedAt: r.doneAt, reason: r.why, legacy: true,
  };
}

/** Mã yêu cầu: YCHĐ-yymm-nnn theo tháng yêu cầu */
export function invCode(list: Pick<InvoiceReq, 'code'>[], at: number): string {
  const d = new Date(at);
  const pfx = `YCHĐ-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-`;
  const n = list.filter((x) => x.code.startsWith(pfx)).map((x) => Number(x.code.slice(pfx.length)) || 0).reduce((a, b) => Math.max(a, b), 0);
  return `${pfx}${String(n + 1).padStart(3, '0')}`;
}

/** Danh sách yêu cầu xuất hóa đơn đầy đủ: bảng mới + phiếu cũ chưa chuyển (đọc ngược) */
export function invoiceView(reqs: InvoiceReq[], orders: SalesOrder[]): InvoiceReq[] {
  const have = new Set(reqs.map((r) => r.id));
  const legacy: InvoiceReq[] = [];
  const codes: Pick<InvoiceReq, 'code'>[] = [...reqs];
  orders.forEach((o) => (o.invReqs ?? []).forEach((r) => { if (have.has(r.id)) return; const x = invFromLegacy(o, r, invCode(codes, r.at)); codes.push(x); legacy.push(x); }));
  return [...reqs, ...legacy].sort((a, b) => b.requestedAt - a.requestedAt);
}

// ---------------------------------------------------------------------
//  v58 đối chiếu 3 chiều: Đã giao ↔ Đã xuất hóa đơn ↔ Đã thu tiền (gồm thuế)
// ---------------------------------------------------------------------
export type ReconFlag = 'INV_BEFORE_DELIVERY' | 'DELIVERED_NO_INV' | 'PAID_OVER_INV';
export const RECON_FLAG: Record<ReconFlag, string> = { INV_BEFORE_DELIVERY: 'Hóa đơn trước giao', DELIVERED_NO_INV: 'Giao chưa hóa đơn', PAID_OVER_INV: 'Thu vượt hóa đơn' };
export type ReconRow = { o: SalesOrder; total: number; delivered: number; invoiced: number; paid: number; flags: ReconFlag[] };

export function reconcile(orders: SalesOrder[], vouchers: StockVoucher[], skus: SkuItem[], invoices: InvoiceReq[], tol = 1000): ReconRow[] {
  return orders.filter((o) => o.status !== 'CANCELLED').map((o) => {
    let delivered = 0;
    vouchers.filter((v) => v.saleId === o.id && v.status === 'DONE' && (v.type === 'OUT' || v.type === 'IN')).forEach((v) => { const x = voucherValue(o, v, skus); delivered += (v.type === 'OUT' ? 1 : -1) * (x.net + x.vat); });
    o.lines.filter(offStock).forEach((l) => { const q = Math.min(l.qty, saleIssQ(o, l)); if (!l.qty || q <= 0) return; const n = Math.round((saleLineNet(l) / l.qty) * q); delivered += n + Math.round((n * l.vat) / 100); });
    const invoiced = invoices.filter((r) => r.saleId === o.id && r.status === 'ISSUED').reduce((s, r) => s + r.total, 0);
    const paid = salePaid(o);
    const flags: ReconFlag[] = [];
    if (invoiced > delivered + tol) flags.push('INV_BEFORE_DELIVERY');
    if (o.invoice && delivered > invoiced + tol) flags.push('DELIVERED_NO_INV');
    if (o.invoice && paid > invoiced + tol) flags.push('PAID_OVER_INV');
    return { o, total: saleTotals(o).grand, delivered, invoiced, paid, flags };
  }).filter((r) => r.delivered || r.invoiced || r.paid);
}
