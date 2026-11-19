'use client';

import { boqIsEstimate, boqTotal, latestQuote, lineNet } from './core';
import type { GetflyOrderPayload, GetflyOrderRec, Lead, Quote, QuoteLine } from './types';

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

