'use client';

import { useState } from 'react';
import { ExternalLink, Link2, Plug } from 'lucide-react';
import { Chip, Field } from '../../components/ui';
import { roiRating } from '../../lib/business';
import { compact, fmtDate, inputCls, mdfOfCustomer, paymentLabel, useApp, vnd } from '../../lib/core';
import type { Customer } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  GETFLY: TAB "LỊCH SỬ ĐƠN HÀNG GETFLY" TRONG THẺ KHÁCH HÀNG 360
// =====================================================================

export function GetflyOrdersPanel({ customer: c }: { customer: Customer }) {
  const { getflyOrders, claims, programs, budget, getfly } = useApp();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [band, setBand] = useState<'ALL' | 'LT200' | '200_1000' | 'GT1000'>('ALL');
  const all = getflyOrders.filter((o) => o.customerId === c.id).sort((a, b) => b.orderDate.localeCompare(a.orderDate));

  if (!c.getflyAccountId) {
    return (
      <div className="rounded-md border border-dashed border-[rgb(var(--line))] p-6 text-center text-sm text-[rgb(var(--muted))]">
        <Plug className="mx-auto mb-2 h-6 w-6 text-[rgb(var(--muted))]" aria-hidden />
        Khách hàng chưa liên kết Getfly. Liên kết tự động khi dự án chốt đơn được đồng bộ, hoặc khi webhook đơn hàng khớp MST / số điện thoại.
      </div>
    );
  }

  const bandOk = (v: number) => band === 'ALL' || (band === 'LT200' && v < 200e6) || (band === '200_1000' && v >= 200e6 && v <= 1e9) || (band === 'GT1000' && v > 1e9);
  const orders = all.filter((o) => (!from || o.orderDate >= from) && (!to || o.orderDate <= to) && (!q.trim() || o.orderCode.toLowerCase().includes(q.trim().toLowerCase())) && bandOk(o.gross));
  // Doanh thu Getfly = tổng đơn đã duyệt (chưa VAT) trong năm tài chính -> dùng tính đòn bẩy
  const gfRevenue = all.filter((o) => o.approved && o.orderDate.startsWith(String(budget.fiscalYear))).reduce((s, o) => s + o.net, 0);
  const debt = all.filter((o) => o.approved).reduce((s, o) => s + Math.max(0, o.gross - o.paid), 0);
  const mdf = mdfOfCustomer(c.id, claims, programs);
  const roi = mdf ? gfRevenue / mdf : null;
  const r = roiRating(roi);
  const orderUrl = (id: number) => `${getfly.baseUrl.replace(/\/+$/, '')}/orders/view/${id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Chip tone="teal"><Link2 className="h-3 w-3" aria-hidden />Getfly {c.getflyAccountCode}</Chip>
        <span className="text-[rgb(var(--muted))]">account_id {c.getflyAccountId}</span>
      </div>

      <section className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-4">
        <p className="text-xs text-[rgb(var(--muted))]">MDF ROI = Doanh thu Getfly / Quỹ MDF tài trợ</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <p className="text-2xl font-semibold tabular-nums text-[rgb(var(--fg))]">{roi ? `${roi.toFixed(1)} lần` : '—'}</p>
          <Chip tone={r.tone}>{r.label}</Chip>
        </div>
        <p className="mt-1 text-sm tabular-nums text-[rgb(var(--muted))]">{vnd(gfRevenue)} / {mdf ? vnd(mdf) : 'chưa nhận MDF'}</p>
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div><p className="text-xs text-[rgb(var(--muted))]">Số đơn</p><p className="tabular-nums">{all.length}</p></div>
          <div><p className="text-xs text-[rgb(var(--muted))]">Chờ duyệt</p><p className="tabular-nums">{all.filter((o) => !o.approved).length}</p></div>
          <div><p className="text-xs text-[rgb(var(--muted))]">Công nợ Getfly</p><p className={cn('tabular-nums', debt > c.creditLimit && 'text-[rgb(var(--danger-fg))]')}>{compact(debt)}</p></div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Từ ngày"><input className={cn(inputCls, 'py-1.5')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Đến ngày"><input className={cn(inputCls, 'py-1.5')} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Mã đơn"><input className={cn(inputCls, 'py-1.5')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="DH18..." /></Field>
        <Field label="Giá trị đơn">
          <select className={cn(inputCls, 'py-1.5')} value={band} onChange={(e) => setBand(e.target.value as typeof band)}>
            <option value="ALL">Mọi giá trị</option>
            <option value="LT200">Dưới 200 triệu</option>
            <option value="200_1000">200 triệu – 1 tỷ</option>
            <option value="GT1000">Trên 1 tỷ</option>
          </select>
        </Field>
      </div>

      <div className="-mx-6 overflow-x-auto">
        <table className="dt w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-[rgb(var(--muted))]">
            <tr className="border-b border-[rgb(var(--line))]">
              <th className="py-2 pl-6 pr-3 font-medium">Mã đơn hàng</th>
              <th className="px-3 py-2 font-medium">Ngày</th>
              <th className="px-3 py-2 text-right font-medium">Giá trị (gồm VAT)</th>
              <th className="px-3 py-2 text-right font-medium">Còn nợ</th>
              <th className="py-2 pl-3 pr-6 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const pay = paymentLabel(o);
              return (
                <tr key={o.orderId} className="border-b border-[rgb(var(--line)/0.6)]">
                  <td className="py-2.5 pl-6 pr-3">
                    <a href={orderUrl(o.orderId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[rgb(var(--secondary-fg))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]" title="Mở đơn trên Getfly CRM (tab mới)">
                      {o.orderCode}<ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                    <p className="text-xs text-[rgb(var(--muted))]">{o.source === 'MDF_APP' ? `Từ dự án ${o.leadCode}` : 'Tạo trên Getfly'}, {o.lines} dòng</p>
                    {o.products?.length ? <p className="max-w-[320px] text-[11px] text-[rgb(var(--muted))]">{o.products.map((p) => `${p.code} x${p.qty.toLocaleString('vi-VN')}`).join(', ')}</p> : null}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{fmtDate(o.orderDate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{vnd(o.gross)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{vnd(Math.max(0, o.gross - o.paid))}</td>
                  <td className="py-2.5 pl-3 pr-6">
                    <div className="flex flex-wrap gap-1">
                      <Chip tone={o.approved ? 'blue' : 'orange'}>{o.approved ? 'Đã duyệt' : 'Chờ duyệt'}</Chip>
                      <Chip tone={pay.tone}>{pay.label}</Chip>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!orders.length && <p className="text-center text-sm text-[rgb(var(--muted))]">{all.length ? 'Không có đơn khớp bộ lọc.' : 'Chưa có đơn hàng nào.'}</p>}
    </div>
  );
}

