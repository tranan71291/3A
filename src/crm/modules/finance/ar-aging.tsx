'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileText } from 'lucide-react';
import { ChipFilter } from '../../components/filters';
import { Chip, Code, EmptyState, Panel, Table } from '../../components/ui';
import { addDaysISO, AGING, bizMode, btnGhost, btnSm, compact, esc, fmtDate, iso, jobCustName, jobPhone, overdueDays, pct, rowCls, saleDue, saleIssued, salePaid, tdCls, tdFirst, tdLast, todayISO, useApp, vnd } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import { saleReturned, saleTotals } from '../../lib/getfly';
import type { ArBucketDef, ArItem, CompanyInfo, Customer, GeneratedDoc, GetflyOrderRec, InstallJob, Job, MfgConfig, PayTrigger, Receipt, SalesOrder } from '../../lib/types';
import { cn } from '../../lib/utils';
import { SearchBox } from '../alux/orders';
import { docShell, moneyToWordsVN, printHtml } from '../sales/templates';

/** Xưởng: mỗi đợt thanh toán đã đến mốc là 1 khoản phải thu; tiền kế toán đã xác nhận phân bổ lần lượt từ đợt đầu */
export function mfgArItems(jobs: Job[], receipts: Receipt[], installs: InstallJob[], customers: Customer[], cfg: MfgConfig): ArItem[] {
  const out: ArItem[] = [];
  const order: PayTrigger[] = ['SIGN', 'DELIVERY', 'ACCEPT'];
  for (const j of jobs) {
    if (!j.wonAt || j.lostAt || !j.contractValue) continue;
    const ins = installs.filter((i) => i.jobId === j.id);
    const firstInstall = ins.map((i) => i.from).filter(Boolean).sort()[0];
    const acc = ins.find((i) => i.acceptance)?.acceptance?.at;
    const dateOf = (t: PayTrigger) => (t === 'SIGN' ? j.wonAt : t === 'DELIVERY' ? firstInstall?.slice(0, 10) : acc?.slice(0, 10));
    const stages = [...j.schedule].sort((a, b) => order.indexOf(a.trigger) - order.indexOf(b.trigger));
    let left = receipts.filter((r) => r.jobId === j.id && r.status === 'CONFIRMED').reduce((s, r) => s + r.amount, 0);
    let allocated = 0;
    stages.forEach((s, k) => {
      // Đợt cọc tính theo số tiền cọc thực nhận lúc chốt (khách có thể cọc lệch tỷ lệ); phần chênh dồn về đợt cuối
      const deposit = s.trigger === 'SIGN' ? receipts.filter((r) => r.jobId === j.id && r.stageId === s.id && r.status !== 'REJECTED').reduce((x, r) => x + r.amount, 0) : 0;
      const amount = k === stages.length - 1 ? j.contractValue! - allocated : deposit > 0 ? Math.min(deposit, j.contractValue! - allocated) : Math.round((j.contractValue! * s.pct) / 100);
      allocated += amount;
      const paid = Math.min(amount, left);
      left -= paid;
      const d = dateOf(s.trigger);
      if (!d || amount - paid <= 0) return;
      const c = customers.find((x) => x.id === j.customerId);
      out.push({ key: `${j.id}-${s.id}`, customerId: j.customerId, customer: jobCustName(j, customers), phone: jobPhone(j, customers) || c?.contactPhone, docCode: j.code, docLabel: `${s.label} ${s.pct}%: ${j.title}`,
        docDate: d, dueDate: addDaysISO(d, cfg.dueDays), amount, paid, outstanding: amount - paid, jobId: j.id });
    });
  }
  return out;
}

/** Thương mại: đơn hàng đã duyệt còn nợ; số ngày công nợ lấy theo hợp đồng gần nhất của khách, không có thì theo cấu hình */
export function tradingArItems(orders: GetflyOrderRec[], customers: Customer[], docs: GeneratedDoc[], cfg: MfgConfig): ArItem[] {
  return orders.filter((o) => o.approved && o.gross > o.paid).map((o) => {
    const c = customers.find((x) => x.id === o.customerId);
    const contract = docs.filter((d) => d.customerId === o.customerId && d.status === 'APPROVED').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const days = contract?.form.creditDays ?? cfg.creditDays;
    return { key: o.orderCode, customerId: o.customerId, customer: c?.name ?? o.customerId, phone: c?.contactPhone, docCode: o.orderCode, docLabel: `Đơn hàng ${o.orderCode}, ${o.lines} dòng hàng (công nợ ${days} ngày)`,
      docDate: o.orderDate, dueDate: addDaysISO(o.orderDate, days), amount: o.gross, paid: o.paid, outstanding: o.gross - o.paid };
  });
}

/** v46: đơn bán đã xuất kho chưa thu đủ (tiền kế toán đã xác nhận) */
export function saleArItems(orders: SalesOrder[], customers: Customer[]): ArItem[] {
  return orders.filter((o) => saleIssued(o)).map((o) => ({ o, t: saleTotals(o).grand - saleReturned(o), paid: salePaid(o) })).filter((x) => x.t > x.paid).map(({ o, t, paid }) => {
    const c = customers.find((x) => x.id === o.customerId);
    return { key: o.code, customerId: o.customerId ?? `walk:${o.phone || o.code}`, customer: c?.name ?? o.customer, phone: c?.contactPhone ?? o.phone, docCode: o.code, docLabel: `Đơn bán ${o.code}, ${o.lines.length} dòng hàng${o.creditDays ? ` (công nợ ${o.creditDays} ngày)` : ''}`,
      docDate: o.issuedAt ? iso(new Date(o.issuedAt)) : o.date, dueDate: saleDue(o), amount: t, paid, outstanding: t - paid };
  });
}

export function useArItems() {
  const { jobs, receipts, installJobs, customers, mfgConfig, getflyOrders, genDocs, company, salesOrders } = useApp();
  const mode = bizMode(company);
  return [...(mode !== 'TRADING' ? mfgArItems(jobs, receipts, installJobs, customers, mfgConfig) : []), ...(mode !== 'MFG' ? tradingArItems(getflyOrders, customers, genDocs, mfgConfig) : []), ...saleArItems(salesOrders, customers)];
}

/** Biên bản đối chiếu công nợ (bản in) */
export function arReconHtml(company: CompanyInfo, customer: Customer | undefined, name: string, items: ArItem[], today: string) {
  const total = items.reduce((s, x) => s + x.outstanding, 0);
  const rows = items.map((x, i) => {
    const od = overdueDays(x.dueDate, today);
    return `<tr><td class="c">${i + 1}</td><td>${esc(x.docCode)}<br><span class="small">${esc(x.docLabel)}</span></td><td class="c">${fmtDate(x.docDate)}</td><td class="c">${fmtDate(x.dueDate)}</td><td class="r">${x.amount.toLocaleString('vi-VN')}</td><td class="r">${x.paid.toLocaleString('vi-VN')}</td><td class="r"><b>${x.outstanding.toLocaleString('vi-VN')}</b></td><td class="c">${od > 0 ? `${od} ngày` : 'Trong hạn'}</td></tr>`;
  }).join('');
  const d = new Date(`${today}T12:00:00`);
  return `<p class="c"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập – Tự do – Hạnh phúc</b></p>
<h1>BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ</h1><p class="c">Đến ngày ${fmtDate(today)}</p>
<p>Hôm nay, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}, chúng tôi gồm:</p>
<p><b>BÊN BÁN: ${esc(company.legalName)}</b><br>Địa chỉ: ${esc(company.address)}${company.taxCode ? `<br>MST: ${esc(company.taxCode)}` : ''}${company.phone ? `<br>Điện thoại: ${esc(company.phone)}` : ''}</p>
<p><b>BÊN MUA: ${esc(customer?.name ?? name)}</b>${customer?.address ? `<br>Địa chỉ: ${esc(customer.address)}` : ''}${customer?.taxCode ? `<br>MST: ${esc(customer.taxCode)}` : ''}${customer?.contactPhone ? `<br>Điện thoại: ${esc(customer.contactPhone)}` : ''}</p>
<p>Cùng đối chiếu các khoản công nợ chưa thanh toán như sau (đơn vị: đồng):</p>
<table class="items"><thead><tr><th>STT</th><th>Chứng từ</th><th>Ngày</th><th>Hạn thanh toán</th><th>Giá trị</th><th>Đã thanh toán</th><th>Còn nợ</th><th>Quá hạn</th></tr></thead><tbody>${rows}
<tr><td colspan="6" class="r"><b>Tổng còn nợ</b></td><td class="r"><b>${total.toLocaleString('vi-VN')}</b></td><td></td></tr></tbody></table>
<p><b>Bằng chữ:</b> <i>${moneyToWordsVN(total)}</i></p>
<p>Đề nghị Bên mua kiểm tra, xác nhận và phản hồi trong 07 ngày kể từ ngày nhận biên bản. Quá thời hạn trên không có phản hồi, hai bên thống nhất số liệu công nợ như trên. Biên bản lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.</p>
<table class="layout sign"><tr><td><b>ĐẠI DIỆN BÊN MUA</b><br>(Ký, ghi rõ họ tên, đóng dấu)<br><br><br><br></td><td><b>ĐẠI DIỆN BÊN BÁN</b><br>(Ký, ghi rõ họ tên, đóng dấu)<br><br><br><br><b>${esc(company.representative ?? '')}</b></td></tr></table>`;
}

export function ArAgingPanel() {
  const { customers, company, openJob, audit, mfgConfig } = useApp();
  const sch = AGING[mfgConfig.agingScheme ?? 'AGE_30_60'];
  const bks = sch.buckets.map((b) => b.id);
  const bkm = Object.fromEntries(sch.buckets.map((b) => [b.id, b])) as Record<string, ArBucketDef>;
  const bucketOf = (n: number) => sch.buckets.find((b) => n <= b.max) ?? sch.buckets[sch.buckets.length - 1];
  const worst = bks[bks.length - 1];
  const items = useArItems();
  const today = todayISO();
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<string>('ALL');
  const [open, setOpen] = useState<string | null>(null);
  const withAge = items.map((x) => { const d = overdueDays(x.dueDate, today); const age = sch.basis === 'doc' ? Math.max(0, overdueDays(x.docDate, today)) : d; return { ...x, days: d, age, bucket: bucketOf(age).id }; });
  const total = (b?: string) => withAge.filter((x) => !b || x.bucket === b).reduce((s, x) => s + x.outstanding, 0);
  const byCust = Array.from(new Set(withAge.map((x) => x.customerId))).map((id) => {
    const xs = withAge.filter((x) => x.customerId === id);
    const sums = Object.fromEntries(bks.map((b) => [b, xs.filter((x) => x.bucket === b).reduce((s, x) => s + x.outstanding, 0)])) as Record<string, number>;
    return { id, name: xs[0].customer, phone: xs[0].phone, xs, sums, total: xs.reduce((s, x) => s + x.outstanding, 0), maxDays: Math.max(...xs.map((x) => x.days)), maxAge: Math.max(...xs.map((x) => x.age)) };
  }).filter((r) => (!q.trim() || `${r.name} ${r.phone ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())) && (bucket === 'ALL' || r.sums[bucket] > 0))
    .sort((a, b) => b.sums[worst] - a.sums[worst] || b.maxAge - a.maxAge || b.total - a.total);
  const print = (r: (typeof byCust)[number]) => {
    const cust = customers.find((c) => c.id === r.id);
    printHtml(docShell(`Đối chiếu công nợ ${r.name}`, arReconHtml(company, cust, r.name, r.xs, today)));
    audit('AR_RECON_PRINT', `In biên bản đối chiếu công nợ ${r.name}: ${vnd(r.total)}`);
  };
  const grand = total();
  return (
    <div className="space-y-4">
      <section className="glass-card rounded-xl px-5 py-4">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-[15px] font-medium">Tuổi nợ</span><span className="text-[13px] text-[rgb(var(--muted))]">Tổng phải thu <b className="font-medium tabular-nums text-[rgb(var(--fg))]">{compact(grand)}</b> · {withAge.length} khoản · {new Set(withAge.map((x) => x.customerId)).size} khách</span></p>
        <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[rgb(var(--raised))]" aria-label="Cơ cấu tuổi nợ">
          {grand > 0 && bks.map((b) => <div key={b} style={{ width: `${(total(b) / grand) * 100}%`, background: bkm[b].color }} title={`${bkm[b].label}: ${vnd(total(b))}`} />)}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          {bks.map((b) => <span key={b} className="flex items-center gap-1.5 text-[rgb(var(--fg2))]"><i className="h-2 w-2 rounded-sm" style={{ background: bkm[b].color }} />{bkm[b].label}<b className="font-medium tabular-nums text-[rgb(var(--fg))]">{compact(total(b))}</b><span className="font-mono text-[12px] text-[rgb(var(--muted))]">{pct(total(b), grand)}</span></span>)}
        </div>
      </section>
      <div className="tb40 flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchBox value={q} onChange={setQ} placeholder="Tìm khách hàng, số điện thoại" />
          <ChipFilter total={new Set(withAge.map((x) => x.customerId)).size} value={bucket as never} onChange={(v) => setBucket(v as never)} options={bks.map((b) => ({ value: b, label: bkm[b].label, color: bkm[b].color, count: new Set(withAge.filter((x) => x.bucket === b).map((x) => x.customerId)).size }))} />
          <button className={cn(btnGhost, btnSm, 'border-0 lg:ml-auto')} onClick={() => downloadCsv(`tuoi-no-${today}.csv`, [['Khách hàng', 'SĐT', 'Chứng từ', 'Diễn giải', 'Ngày', 'Hạn', 'Giá trị', 'Đã thu', 'Còn nợ', 'Tuổi nợ (ngày)', 'Quá hạn (ngày)', 'Nhóm'], ...withAge.map((x) => [x.customer, x.phone ?? '', x.docCode, x.docLabel, x.docDate, x.dueDate, x.amount, x.paid, x.outstanding, x.age, Math.max(0, x.days), bkm[x.bucket].label])])}><Download className="h-3.5 w-3.5" aria-hidden />CSV</button>
      </div>
      <Panel>
        <Table head={['Khách hàng', 'Điện thoại', <span key="k" className="block text-right">Khoản</span>, <span key="t" className="block text-right">Tổng còn nợ</span>, ...bks.map((b) => <span key={b} className="block text-right">{bkm[b].short}</span>), sch.basis === 'doc' ? 'Tuổi nợ lớn nhất' : 'Quá hạn lâu nhất', '']} minW={1180}>
          {byCust.map((r) => (
            <Fragment key={r.id}>
              <tr className={cn(rowCls, 'cursor-pointer')} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <td className={tdFirst}><span className="flex items-center gap-1.5 font-medium">{open === r.id ? <ChevronDown className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />}<span className="block max-w-[240px] truncate">{r.name}</span></span></td>
                <td className={cn(tdCls, 'tabular-nums text-[rgb(var(--fg2))]')}>{r.phone || '—'}</td>
                <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{r.xs.length}</td>
                <td className={cn(tdCls, 'text-right font-medium tabular-nums')}>{r.total.toLocaleString('vi-VN')}</td>
                {bks.map((b) => <td key={b} className={cn(tdCls, 'text-right tabular-nums')} style={{ color: r.sums[b] && b !== bks[0] ? bkm[b].color : undefined }}>{r.sums[b] ? r.sums[b].toLocaleString('vi-VN') : '—'}</td>)}
                <td className={tdCls}>{sch.basis === 'doc' ? <Chip tone={bucketOf(r.maxAge).tone}>{r.maxAge} ngày{r.maxDays > 0 ? ` · quá ${r.maxDays}` : ''}</Chip> : r.maxDays > 0 ? <Chip tone={bucketOf(r.maxDays).tone}>{r.maxDays} ngày</Chip> : <Chip tone="teal">Trong hạn</Chip>}</td>
                <td className={tdLast}><button className={cn(btnGhost, btnSm)} onClick={(e) => { e.stopPropagation(); print(r); }} title="In biên bản đối chiếu công nợ"><FileText className="h-3.5 w-3.5" aria-hidden />Đối chiếu</button></td>
              </tr>
              {open === r.id && r.xs.map((x) => (
                <tr key={x.key} className="border-b border-[rgb(var(--line)/0.4)] bg-[rgb(var(--raised)/0.4)] text-xs">
                  <td className={cn(tdFirst, 'pl-10')}><button className="flex items-center gap-2 text-left hover:underline" onClick={() => x.jobId && openJob(x.jobId)} title={x.docLabel}><Code>{x.docCode}</Code><span className="max-w-[180px] truncate text-[rgb(var(--muted))]">{x.docLabel}</span></button></td>
                  <td className={cn(tdCls, 'font-mono text-[rgb(var(--muted))]')} colSpan={2}>{fmtDate(x.docDate)} · hạn {fmtDate(x.dueDate)}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums')} title={`trên ${x.amount.toLocaleString('vi-VN')}`}>{x.outstanding.toLocaleString('vi-VN')}</td>
                  <td className={tdCls} colSpan={bks.length} />
                  <td className={tdCls}><Chip tone={bkm[x.bucket].tone}>{sch.basis === 'doc' ? `${x.age} ngày tuổi` : ''}{sch.basis === 'doc' ? ', ' : ''}{x.days > 0 ? `quá hạn ${x.days} ngày` : x.days === 0 ? 'đến hạn hôm nay' : `còn ${-x.days} ngày`}</Chip></td>
                  <td className={tdLast} />
                </tr>
              ))}
            </Fragment>
          ))}
        </Table>
        {!byCust.length && <EmptyState text={<>Không có công nợ {bucket === 'ALL' ? '' : `nhóm "${bkm[bucket].label}"`}.</>} art="ledger" />}
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">{sch.label}. {sch.note} Đổi cách nhóm ở Cài đặt › Kế toán & công nợ. Chỉ tính tiền kế toán đã xác nhận. {bizMode(company) !== 'TRADING' ? 'Khoản phải thu phát sinh khi đơn đến mốc thanh toán (cọc, giao / lắp, nghiệm thu), hạn = ngày mốc + số ngày thanh toán trong Cài đặt.' : 'Hạn = ngày đơn hàng + số ngày công nợ trên hợp đồng của khách (không có thì theo cấu hình).'}</p>
      </Panel>
    </div>
  );
}

