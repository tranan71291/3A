'use client';

// =====================================================================
//  v58 MỤC KẾ TOÁN (nhóm Tài chính) — 5 tab:
//  Yêu cầu xuất hóa đơn · Bảng kê hóa đơn đầu ra · Sổ nhật ký & Sổ cái · Cân đối số phát sinh · Đối chiếu đơn hàng (Giao – Hóa đơn – Thu tiền)
//  Sổ đọc từ bút toán đã ghi (journalEntries), không tính lại từ đơn. Thao tác mở bảng trượt bên phải (1 lớp, không popup chồng popup).
// =====================================================================
import { type ReactNode, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Check as CheckIcon, Download, Eye, Filter, Lock, Paperclip, Pencil, Upload, X } from 'lucide-react';
import { Drawer } from '../../components/drawer';
import { StatusBar, StatusChecklist, stMatch, type StatusOpt } from '../../components/kit/status-filter';
import { Chip, Code, EmptyState, Field, Table, Tabs, useSort, useSticky } from '../../components/ui';
import { cloudMessage } from '../../lib/cloud';
import { ACCT_STD, acctName, ATTACH_PREFIX, btnGhost, btnPrimary, btnSm, cloud, CLOUD_ON, CloudError, downloadBlob, fmtDate, fmtN, inputCls, isoDay, openAttachment, readAsDataUrl, todayISO, uid, useApp } from '../../lib/core';
import { convertOpening, invoiceView, jOpenDate, ledger, RECON_FLAG, reconcile, REVENUE_AT, revenueAtOf, trialBalance, type ReconFlag } from '../../lib/accounting';
import { acctList } from '../../lib/getfly';
import { xlsxBlob } from '../../lib/csv';
import type { AcctConfig, InvoiceReq, InvReqStatus, JEntry, SaleFile } from '../../lib/types';
import { cn } from '../../lib/utils';
import { SearchBox } from '../alux/orders';
import { CbSeg } from '../finance/cashbook';
import { useOutside } from '../sales/orders';

type Tab = 'inv' | 'out' | 'gl' | 'tb' | 'recon';
const INV_ST: Record<InvReqStatus, { label: string; tone: 'orange' | 'teal' | 'muted' | 'red' }> = { PENDING: { label: 'Chờ xuất', tone: 'orange' }, ISSUED: { label: 'Đã xuất', tone: 'teal' }, REJECTED: { label: 'Trả lại', tone: 'muted' }, CANCELLED: { label: 'Đã hủy', tone: 'red' } };
const SRC_LABEL: Record<JEntry['src'], string> = { CE: 'Phiếu quỹ', SV: 'Phiếu kho bán', SVC: 'Giao hàng không qua kho', INV: 'Hóa đơn', REV: 'Bút toán đảo' };
const th = 'whitespace-nowrap px-3 py-2.5 text-left text-[12.5px] font-normal text-[rgb(var(--muted))]';
const td = 'px-3 py-2.5 align-middle';
const num = 'text-right tabular-nums';

/** Nút phễu lọc có số đếm (v49): bộ lọc gom gọn, không bày tràn */
function FunnelBtn({ n, children }: { n: number; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <button className={cn(btnGhost, 'relative h-9 w-9 justify-center p-0', open && 'bg-[rgb(var(--ink)/0.05)]')} onClick={() => setOpen((v) => !v)} aria-label="Bộ lọc" aria-expanded={open} title="Bộ lọc">
        <Filter className="h-4 w-4" aria-hidden />{n > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[rgb(var(--accent))] px-1 text-[10.5px] font-medium tabular-nums text-white" data-filter-count={n}>{n}</span>}
      </button>
      {open && <div className="absolute left-0 top-full z-30 mt-1 w-[300px] space-y-3 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4 shadow-xl">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function AccountingModule() {
  const app = useApp();
  const { canDo, mfgConfig, go, range, invoiceRequests, salesOrders } = app;
  const cfg = mfgConfig.acct ?? null;
  const [tab, setTab] = useSticky<Tab>('Accounting.tab', 'inv');
  const reqs = useMemo(() => invoiceView(invoiceRequests, salesOrders), [invoiceRequests, salesOrders]);
  if (!canDo('acct.view') && !canDo('acct.post')) return (
    <div className="glass-card mx-auto mt-10 max-w-md rounded-xl p-6 text-center"><Lock className="mx-auto h-6 w-6 text-[rgb(var(--muted))]" aria-hidden /><p className="mt-2 font-medium">Chưa có quyền xem mục Kế toán</p><p className="mt-1 text-[13px] text-[rgb(var(--muted))]">Giám đốc cấp quyền ở Cài đặt › Phân quyền</p></div>
  );
  const pend = reqs.filter((r) => r.status === 'PENDING').length;
  return (
    <div className="space-y-4" data-accounting>
      <section className="glass-card flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl px-5 py-3 text-[13px]" aria-label="Chế độ kế toán">
        {cfg ? <>
          <span><span className="text-[rgb(var(--muted))]">Chế độ </span>{ACCT_STD[cfg.std].short} · năm {cfg.year}</span>
          <span data-revenue-at={revenueAtOf(cfg)}><span className="text-[rgb(var(--muted))]">Ghi doanh thu </span>{REVENUE_AT[revenueAtOf(cfg)].label.replace(' (mặc định)', '')}</span>
          <span><span className="text-[rgb(var(--muted))]">Ghi sổ từ </span>{cfg.journalSince ? fmtDate(cfg.journalSince) : 'chưa bắt đầu'}</span>
          <span><span className="text-[rgb(var(--muted))]">Khóa kỳ đến </span>{cfg.lockedUntil ? fmtDate(cfg.lockedUntil) : 'chưa khóa'}</span>
          <button className={cn(btnGhost, btnSm, 'ml-auto')} onClick={() => go('settings', 'coa')}>Hệ thống tài khoản</button>
        </> : <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[rgb(var(--warn))]" aria-hidden />Chưa chọn chế độ kế toán. Hóa đơn vẫn xử lý được; sổ sách cần chọn TT 99 hoặc TT 133 trước<button className={cn(btnPrimary, btnSm, 'ml-2')} onClick={() => go('settings', 'coa')}>Chọn chế độ</button></span>}
      </section>
      <section className="glass-card overflow-hidden rounded-xl">
        <div className="px-5"><Tabs tabs={[
          { id: 'inv', label: 'Yêu cầu xuất hóa đơn', count: pend || undefined },
          { id: 'out', label: 'Bảng kê hóa đơn đầu ra' },
          { id: 'gl', label: 'Sổ nhật ký & Sổ cái' },
          { id: 'tb', label: 'Cân đối số phát sinh' },
          { id: 'recon', label: 'Đối chiếu đơn hàng' },
        ]} value={tab} onChange={setTab} /></div>
        <div className="px-5 pb-5 pt-4">
          {tab === 'inv' && <InvoiceReqTab reqs={reqs} />}
          {tab === 'out' && <OutputTab reqs={reqs} from={range.from} to={range.to} />}
          {(tab === 'gl' || tab === 'tb') && (!cfg ? <EmptyState text="Chưa chọn chế độ kế toán" hint="Chọn TT 99 hoặc TT 133 ở Cài đặt › Hệ thống tài khoản" art="ledger" action="Chọn chế độ" onAction={() => go('settings', 'coa')} />
            : !cfg.journalSince ? <StartBooks cfg={cfg} />
            : tab === 'gl' ? <GlTab cfg={cfg} from={range.from} to={range.to} /> : <TbTab cfg={cfg} from={range.from} to={range.to} />)}
          {tab === 'recon' && <ReconTab reqs={reqs} from={range.from} to={range.to} />}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Bắt đầu ghi sổ: chọn ngày, số dư đầu kỳ chuyển từ sổ cũ (định khoản lúc xem, trước v58)
// ---------------------------------------------------------------------
function StartBooks({ cfg }: { cfg: AcctConfig }) {
  const { canDo, cashEntries, salesOrders, stockVouchers, skus, invoiceRequests, setMfgConfig, audit, notify, me } = useApp();
  const [since, setSince] = useState(todayISO());
  const bal = useMemo(() => convertOpening({ cash: cashEntries, orders: salesOrders, vouchers: stockVouchers, skus, invoices: invoiceRequests }, cfg, since), [cashEntries, salesOrders, stockVouchers, skus, invoiceRequests, cfg, since]);
  const can = canDo('acct.post');
  const start = () => {
    if (!can) return;
    if (since > todayISO()) return notify('Ngày bắt đầu không được sau hôm nay', 'red');
    setMfgConfig((c) => (c.acct ? { ...c, acct: { ...c.acct, journalSince: since, opening: { date: since, bal, source: 'CONVERT', by: me?.id, at: Date.now() } } } : c));
    audit('ACCT_START', `Bắt đầu ghi sổ từ ${fmtDate(since)}; số dư đầu kỳ chuyển từ sổ cũ ${Object.keys(bal).length} tài khoản`, 'WARN');
    notify(`Bắt đầu ghi sổ từ ${fmtDate(since)}`, 'teal');
  };
  const codes = Object.keys(bal).sort();
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]" data-start-books>
      <div>
        <p className="text-[14px] font-medium">Bắt đầu ghi sổ</p>
        <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-[rgb(var(--fg2))]">Từ ngày bắt đầu, mỗi phiếu quỹ, phiếu kho bán, hóa đơn được ghi thành bút toán lưu thật: không sửa đè, chứng từ gốc sửa / hủy thì tự sinh bút toán đảo và ghi lại. Chứng từ trước ngày này chuyển thành số dư đầu kỳ (tính theo sổ cũ), kế toán sửa được trước khi khóa kỳ.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Ghi sổ từ ngày"><input type="date" className={inputCls} value={since} max={todayISO()} onChange={(e) => setSince(e.target.value)} aria-label="Ghi sổ từ ngày" /></Field>
          <button className={btnPrimary} disabled={!can} onClick={start}><BookOpen className="h-4 w-4" aria-hidden />Bắt đầu ghi sổ</button>
          {!can && <span className="text-[12.5px] text-[rgb(var(--muted))]">Kế toán / Giám đốc bắt đầu</span>}
        </div>
      </div>
      <div className="rounded-lg border border-[rgb(var(--line))]">
        <p className="border-b border-[rgb(var(--line))] px-4 py-2.5 text-[13px] font-medium">Số dư đầu kỳ dự kiến <span className="font-normal text-[rgb(var(--muted))]">· {codes.length} tài khoản</span></p>
        {codes.length ? <table className="w-full text-[13px]"><thead><tr><th className={th}>Tài khoản</th><th className={cn(th, 'text-right')}>Dư Nợ</th><th className={cn(th, 'text-right')}>Dư Có</th></tr></thead>
          <tbody>{codes.map((k) => <tr key={k} className="border-t border-[rgb(var(--line)/0.6)]"><td className={td} title={acctName(cfg, k)}><Code>{k}</Code></td><td className={cn(td, num)}>{bal[k] > 0 ? fmtN(bal[k]) : ''}</td><td className={cn(td, num)}>{bal[k] < 0 ? fmtN(-bal[k]) : ''}</td></tr>)}</tbody></table>
          : <p className="px-4 py-4 text-[13px] text-[rgb(var(--muted))]">Không có chứng từ trước ngày này</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
//  1. Yêu cầu xuất hóa đơn
// ---------------------------------------------------------------------
function InvoiceReqTab({ reqs }: { reqs: InvoiceReq[] }) {
  const { users, range } = useApp();
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const [st, setSt] = useSticky<InvReqStatus | 'ALL'>('Accounting.invSt', 'PENDING');
  const [stM, setStM] = useState<InvReqStatus[]>([]);
  const [q, setQ] = useState('');
  const [by, setBy] = useState('ALL');
  const [inPeriod, setInPeriod] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const t = q.trim().toLowerCase();
  const from = new Date(`${range.from}T00:00:00`).getTime(), to = new Date(`${range.to}T23:59:59`).getTime();
  const base = reqs.filter((r) => (by === 'ALL' || r.requestedBy === by) && (!inPeriod || (r.requestedAt >= from && r.requestedAt <= to)) && (!t || `${r.code} ${r.saleCode} ${r.buyer?.name ?? ''} ${r.buyer?.taxCode ?? ''} ${r.invoice?.no ?? ''}`.toLowerCase().includes(t)));
  const rows0 = base.filter((r) => stMatch(st, stM, (s) => r.status === s));
  const { rows, th: sort } = useSort('acct-inv', rows0, { 0: (r) => r.code, 1: (r) => r.requestedAt, 5: (r) => r.amount, 7: (r) => r.total, 10: (r) => r.invoice?.no ?? '' });
  const people = Array.from(new Set(reqs.map((r) => r.requestedBy).filter(Boolean) as string[]));
  const cur = open ? reqs.find((r) => r.id === open) : undefined;
  // v59 lọc 2 lớp: thanh nhanh [Tất cả · Chờ xuất · Đã xuất · Trả lại · Đã hủy], phễu chọn nhiều
  const stOpts: StatusOpt<InvReqStatus>[] = (['PENDING', 'ISSUED', 'REJECTED', 'CANCELLED'] as const).map((k) => ({ value: k, label: INV_ST[k].label, count: base.filter((r) => r.status === k).length }));
  return (
    <div className="space-y-3" data-inv-tab>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] max-w-[420px] flex-1"><SearchBox value={q} onChange={setQ} placeholder="Tìm mã yêu cầu, đơn, người mua, MST, số hóa đơn" /></div>
        <FunnelBtn n={(by !== 'ALL' ? 1 : 0) + (inPeriod ? 1 : 0) + stM.length}>{(close) => <>
          <StatusChecklist options={stOpts} value={st} onChange={setSt} multi={stM} onMulti={setStM} label="Trạng thái yêu cầu" />
          <Field label="Người yêu cầu"><select className={inputCls} value={by} onChange={(e) => setBy(e.target.value)}><option value="ALL">Tất cả</option>{people.map((p) => <option key={p} value={p}>{nm(p) || p}</option>)}</select></Field>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={inPeriod} onChange={(e) => setInPeriod(e.target.checked)} />Chỉ yêu cầu trong kỳ đang chọn</label>
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => { setBy('ALL'); setInPeriod(false); setStM([]); }}>Đặt lại</button><button className={btnPrimary} onClick={close}>Xong</button></div>
        </>}</FunnelBtn>
        <StatusBar<InvReqStatus> options={stOpts} value={st} onChange={setSt} multi={stM} onMulti={setStM} label="Trạng thái yêu cầu" total={base.length} funnel={false} />
      </div>
      {rows.length ? (
        <Table id="acct-inv" title="Yêu cầu xuất hóa đơn" sort={sort} minW={1000} optional={[4, 6, 11]}
          head={['Mã yêu cầu', 'Ngày yêu cầu', 'Đơn hàng', 'Người mua', 'Mã số thuế', 'Tiền hàng', 'Thuế GTGT', 'Tổng tiền', 'Người yêu cầu', 'Trạng thái', 'Số hóa đơn', 'Ngày hóa đơn']}>
          {rows.map((r) => (
            <tr key={r.id} className="cursor-pointer border-b border-[rgb(var(--ink)/0.06)] hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => setOpen(r.id)} data-inv-row={r.id}>
              <td className={cn(td, 'pl-5')}><Code>{r.code}</Code></td>
              <td className={cn(td, 'tabular-nums text-[rgb(var(--fg2))]')}>{fmtDate(isoDay(r.requestedAt))}</td>
              <td className={td}><Code>{r.saleCode}</Code></td>
              <td className={td}><span className="block max-w-[220px] truncate" title={r.buyer?.name}>{r.buyer?.name ?? '—'}</span></td>
              <td className={cn(td, 'font-mono text-[12.5px]')}>{r.buyer?.noTax ? 'Không có' : r.buyer?.taxCode ?? '—'}</td>
              <td className={cn(td, num)}>{fmtN(r.amount)}</td>
              <td className={cn(td, num)}>{fmtN(r.vat)}</td>
              <td className={cn(td, num, 'font-medium')}>{fmtN(r.total)}</td>
              <td className={td}><span className="block max-w-[160px] truncate">{nm(r.requestedBy) || '—'}</span></td>
              <td className={td}><Chip tone={INV_ST[r.status].tone}>{INV_ST[r.status].label}</Chip></td>
              <td className={td}>{r.invoice?.no ? <Code>{r.invoice.no}</Code> : '—'}</td>
              <td className={cn(td, 'tabular-nums')}>{r.invoice?.date ? fmtDate(r.invoice.date) : '—'}</td>
            </tr>
          ))}
        </Table>
      ) : <EmptyState text={st === 'PENDING' ? 'Không có yêu cầu chờ xuất' : 'Không có yêu cầu'} art="inbox" compact />}
      {cur && <InvoiceDrawer key={cur.id} r={cur} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Bảng trượt xử lý một yêu cầu: thông tin người mua, hàng hóa; nhập số / ký hiệu / ngày, tải PDF / XML; Xuất hóa đơn / Trả lại; hủy hóa đơn đã xuất */
function InvoiceDrawer({ r, onClose }: { r: InvoiceReq; onClose: () => void }) {
  const { users, me, role, canDo, issueInvoice, cancelInvoice, setInvoiceRequests, org, notify, go, setOpenSale } = useApp();
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const can = canDo('acct.post') || canDo('cash.manage') || canDo('receipt.confirm');
  const self = !!me && r.requestedBy === me.id;
  const blockedSelf = self && role !== 'BOD';
  const [no, setNo] = useState('');
  const [series, setSeries] = useState('');
  const [form, setForm] = useState('');
  const [date, setDate] = useState(todayISO());
  const [lookup, setLookup] = useState('');
  const [files, setFiles] = useState<SaleFile[]>(r.files ?? []);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'' | 'reject' | 'cancel'>('');
  const [why, setWhy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      const out: SaleFile[] = [];
      for (const f of Array.from(list).slice(0, 4 - files.length)) {
        if (!/\.(pdf|xml)$/i.test(f.name)) { notify(`${f.name}: chỉ nhận PDF hoặc XML hóa đơn`, 'orange'); continue; }
        const max = CLOUD_ON ? 10 : 2;
        if (f.size > max * 1024 * 1024) { notify(`${f.name} lớn hơn ${max} MB`, 'orange'); continue; }
        if (CLOUD_ON) {
          // kho riêng tư crm-attach: <doanh nghiệp>/invoices/<mã yêu cầu>/<băm>.<đuôi>; yêu cầu chỉ giữ đường dẫn attach:
          const up = await cloud.uploadAttachment(org.id, `invoices/${r.id}`, f, f.name);
          out.push({ id: uid('if'), name: f.name, url: `${ATTACH_PREFIX}${up.path}`, path: up.path, size: f.size, type: up.mimeType, mimeType: up.mimeType, at: Date.now(), by: me?.id });
        } else out.push({ id: uid('if'), name: f.name, url: await readAsDataUrl(f), size: f.size, type: f.type || (f.name.endsWith('.xml') ? 'application/xml' : 'application/pdf'), at: Date.now(), by: me?.id });
      }
      if (out.length) {
        const next = [...files, ...out];
        setFiles(next);
        // hóa đơn đã xuất: bổ sung tệp lưu ngay (không đổi số / ngày hóa đơn)
        if (r.status === 'ISSUED') setInvoiceRequests((all) => (all.some((x) => x.id === r.id) ? all.map((x) => (x.id === r.id ? { ...x, files: next } : x)) : [{ ...r, files: next }, ...all]));
      }
    } catch (e) { notify(e instanceof CloudError ? cloudMessage(e) : 'Không đọc được tệp', 'red'); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const issue = () => { if (issueInvoice(r.id, true, { invoice: { no: no.trim(), series: series.trim() || undefined, form: form.trim() || undefined, date, lookupCode: lookup.trim() || undefined }, files })) onClose(); };
  const reject = () => { if (issueInvoice(r.id, false, { reason: why })) onClose(); };
  const cancel = () => { if (cancelInvoice(r.id, why)) onClose(); };
  const kv = (k: string, v: ReactNode) => <div className="flex justify-between gap-4 py-1 text-[13.5px]"><span className="shrink-0 text-[rgb(var(--muted))]">{k}</span><span className="min-w-0 text-right">{v}</span></div>;
  const pending = r.status === 'PENDING';
  return (
    <Drawer size="lg" title={`Yêu cầu xuất hóa đơn · ${r.saleCode}`} eyebrow={r.code} badge={<Chip tone={INV_ST[r.status].tone}>{INV_ST[r.status].label}</Chip>} onClose={onClose}
      actions={<button className={cn(btnGhost, btnSm)} onClick={() => { setOpenSale(r.saleId); go('sales'); }}><Eye className="h-3.5 w-3.5" aria-hidden />Mở đơn hàng</button>}
      footer={pending ? (
        mode === 'reject' ? <div className="flex flex-wrap items-center gap-2"><input className={cn(inputCls, 'min-w-[240px] flex-1')} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Lý do trả lại (bắt buộc)" aria-label="Lý do trả lại" autoFocus /><button className={btnGhost} onClick={() => setMode('')}>Thôi</button><button className={cn(btnPrimary, 'bg-[rgb(var(--danger))]')} disabled={!can || blockedSelf} onClick={reject}>Trả lại</button></div>
          : <div className="flex flex-wrap items-center justify-end gap-2">{blockedSelf ? <span className="mr-auto text-[12.5px] text-[rgb(var(--danger-fg))]" data-self-block>Yêu cầu của bạn: kế toán khác hoặc Giám đốc xử lý (không tự xuất)</span> : self ? <span className="mr-auto text-[12.5px] text-[rgb(var(--warn))]">Giám đốc tự xuất cho yêu cầu của mình: có ghi nhật ký</span> : !can ? <span className="mr-auto text-[12.5px] text-[rgb(var(--muted))]">Chỉ Kế toán xử lý</span> : null}
            <button className={btnGhost} disabled={!can || blockedSelf} onClick={() => setMode('reject')}><X className="h-4 w-4" aria-hidden />Trả lại</button>
            <button className={btnPrimary} disabled={!can || blockedSelf || !no.trim() || !date} onClick={issue}><CheckIcon className="h-4 w-4" aria-hidden />Xuất hóa đơn</button></div>
      ) : r.status === 'ISSUED' && can ? (
        mode === 'cancel' ? <div className="flex flex-wrap items-center gap-2"><input className={cn(inputCls, 'min-w-[240px] flex-1')} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Lý do hủy hóa đơn (bắt buộc)" aria-label="Lý do hủy hóa đơn" autoFocus /><button className={btnGhost} onClick={() => setMode('')}>Thôi</button><button className={btnPrimary} onClick={cancel}>Hủy hóa đơn</button></div>
          : <div className="flex justify-end"><button className={cn(btnGhost, 'text-[rgb(var(--danger-fg))]')} onClick={() => setMode('cancel')}>Hủy hóa đơn</button></div>
      ) : undefined}>
      <section>
        <p className="mb-1 text-[14px] font-medium">Người mua</p>
        {kv('Tên đơn vị / người mua', r.buyer?.name ?? '—')}
        {kv('Mã số thuế', <span className="font-mono">{r.buyer?.noTax ? 'Không có' : r.buyer?.taxCode ?? '—'}</span>)}
        {kv('Địa chỉ', r.buyer?.address ?? '—')}
        {kv('Email nhận hóa đơn', r.buyer?.email ?? '—')}
        {r.buyer?.buyerName && kv('Người mua hàng', r.buyer.buyerName)}
      </section>
      <section>
        <p className="mb-2 text-[14px] font-medium">Hàng hóa trên hóa đơn</p>
        {(r.items ?? []).length ? (
          <table className="w-full text-[13px]"><thead><tr className="border-b border-[rgb(var(--line))]"><th className={th}>Tên hàng</th><th className={th}>ĐVT</th><th className={cn(th, 'text-right')}>Số lượng</th><th className={cn(th, 'text-right')}>Thành tiền</th><th className={cn(th, 'text-right')}>VAT%</th></tr></thead>
            <tbody>{(r.items ?? []).map((x) => <tr key={x.lineId} className="border-b border-[rgb(var(--ink)/0.06)]"><td className={td}><span className="block max-w-[340px] truncate" title={x.name}>{x.name}</span></td><td className={td}>{x.unit}</td><td className={cn(td, num)}>{fmtN(x.qty)}</td><td className={cn(td, num)}>{fmtN(x.amount)}</td><td className={cn(td, num)}>{x.vat}</td></tr>)}</tbody></table>
        ) : <p className="text-[13px] text-[rgb(var(--muted))]">Yêu cầu bản cũ chưa có danh sách hàng: xuất theo đơn {r.saleCode}</p>}
        <div className="mt-2 ml-auto max-w-[320px]">{kv('Tiền hàng', <span className="tabular-nums">{fmtN(r.amount)}</span>)}{kv('Thuế GTGT', <span className="tabular-nums">{fmtN(r.vat)}</span>)}{kv('Tổng thanh toán', <span className="font-medium tabular-nums">{fmtN(r.total)}</span>)}</div>
      </section>
      <section>
        {kv('Người yêu cầu', `${nm(r.requestedBy) || '—'} · ${new Date(r.requestedAt).toLocaleString('vi-VN')}`)}
        {r.note && kv('Ghi chú cho kế toán', r.note)}
        {r.decidedBy && kv(r.status === 'REJECTED' ? 'Người trả lại' : 'Người xuất', `${nm(r.decidedBy)}${r.decidedAt ? ` · ${new Date(r.decidedAt).toLocaleString('vi-VN')}` : ''}`)}
        {r.reason && kv(r.status === 'CANCELLED' ? 'Lý do hủy' : 'Lý do trả lại', r.reason)}
        {r.selfLog && kv('Ghi nhật ký', r.selfLog)}
      </section>
      {pending && can && !blockedSelf ? (
        <section data-issue-form>
          <p className="mb-2 text-[14px] font-medium">Thông tin hóa đơn đã xuất</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Số hóa đơn"><input className={cn(inputCls, 'font-mono')} value={no} onChange={(e) => setNo(e.target.value)} placeholder="0000123" aria-label="Số hóa đơn" /></Field>
            <Field label="Ký hiệu"><input className={cn(inputCls, 'font-mono')} value={series} onChange={(e) => setSeries(e.target.value)} placeholder="1C26TAA" aria-label="Ký hiệu hóa đơn" /></Field>
            <Field label="Ngày hóa đơn"><input type="date" className={inputCls} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} aria-label="Ngày hóa đơn" /></Field>
            <Field label="Mẫu số"><input className={inputCls} value={form} onChange={(e) => setForm(e.target.value)} placeholder="1" aria-label="Mẫu số" /></Field>
            <Field label="Mã tra cứu" className="sm:col-span-2"><input className={cn(inputCls, 'font-mono')} value={lookup} onChange={(e) => setLookup(e.target.value)} aria-label="Mã tra cứu" /></Field>
          </div>
        </section>
      ) : r.invoice ? (
        <section>
          <p className="mb-1 text-[14px] font-medium">Hóa đơn</p>
          {kv('Số hóa đơn', <Code>{r.invoice.no}</Code>)}{r.invoice.series && kv('Ký hiệu', <Code>{r.invoice.series}</Code>)}{kv('Ngày hóa đơn', fmtDate(r.invoice.date))}{r.invoice.form && kv('Mẫu số', r.invoice.form)}{r.invoice.lookupCode && kv('Mã tra cứu', <span className="font-mono">{r.invoice.lookupCode}</span>)}
        </section>
      ) : null}
      {(pending || r.status === 'ISSUED') && (
        <section data-invoice-files>
          <div className="mb-2 flex items-center gap-2"><p className="text-[14px] font-medium">Tệp hóa đơn (PDF / XML)</p>{can && !blockedSelf && files.length < 4 && <button className={cn(btnGhost, btnSm, 'ml-auto')} disabled={busy} onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" aria-hidden />{busy ? 'Đang tải' : 'Tải lên'}</button>}</div>
          <input ref={fileRef} type="file" multiple accept=".pdf,.xml,application/pdf,application/xml,text/xml" className="hidden" onChange={(e) => { void addFiles(e.target.files); }} aria-label="Chọn tệp hóa đơn" />
          {files.length ? <ul className="space-y-1.5">{files.map((f) => <li key={f.id} className="flex items-center gap-2 text-[13.5px]" data-invoice-file={f.name}><Paperclip className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => { void openAttachment(f, 'view').catch((e) => notify(cloudMessage(e), 'red')); }}>{f.name}</button><span className="text-[12px] tabular-nums text-[rgb(var(--muted))]">{Math.max(1, Math.round(f.size / 1024))} KB</span><button type="button" className="text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => { void openAttachment(f, 'download').catch((e) => notify(cloudMessage(e), 'red')); }} aria-label={`Tải ${f.name}`}><Download className="h-3.5 w-3.5" aria-hidden /></button>{pending && can && <button type="button" className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setFiles(files.filter((x) => x.id !== f.id))} aria-label={`Bỏ ${f.name}`}><X className="h-3.5 w-3.5" aria-hidden /></button>}</li>)}</ul>
            : <p className="text-[13px] text-[rgb(var(--muted))]">Chưa có tệp. Tải bản PDF và XML hóa đơn điện tử (tối đa 4 tệp){CLOUD_ON ? ', lưu ở kho tệp riêng của doanh nghiệp' : ''}</p>}
        </section>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------
//  2. Bảng kê hóa đơn đầu ra (kê khai thuế GTGT): theo kỳ, tách theo thuế suất
// ---------------------------------------------------------------------
type OutRow = { r: InvoiceReq; rate: number; base: number; vat: number };
function OutputTab({ reqs, from, to }: { reqs: InvoiceReq[]; from: string; to: string }) {
  const rows: OutRow[] = [];
  reqs.filter((r) => (r.status === 'ISSUED' || r.status === 'CANCELLED') && r.invoice && r.invoice.date >= from && r.invoice.date <= to).forEach((r) => {
    const cancelled = r.status === 'CANCELLED';
    const by = new Map<number, number>();
    if (r.items?.length) r.items.forEach((x) => by.set(x.vat, (by.get(x.vat) ?? 0) + x.amount));
    else by.set(r.amount ? Math.round((r.vat / r.amount) * 100) : 0, r.amount);
    by.forEach((base, rate) => rows.push({ r, rate, base: cancelled ? 0 : base, vat: cancelled ? 0 : Math.round((base * rate) / 100) }));
  });
  rows.sort((a, b) => a.rate - b.rate || (a.r.invoice!.date).localeCompare(b.r.invoice!.date) || a.r.invoice!.no.localeCompare(b.r.invoice!.no));
  const rates = Array.from(new Set(rows.map((x) => x.rate))).sort((a, b) => a - b);
  const sum = (rs: OutRow[]) => ({ base: rs.reduce((s, x) => s + x.base, 0), vat: rs.reduce((s, x) => s + x.vat, 0) });
  const all = sum(rows);
  const excel = () => downloadBlob(`BangKe_HoaDonDauRa_${from}_${to}.xlsx`, xlsxBlob([{ name: 'Bang ke', widths: [6, 12, 14, 12, 40, 16, 18, 10, 16, 20], rows: [['STT', 'Ký hiệu', 'Số hóa đơn', 'Ngày', 'Người mua', 'Mã số thuế', 'Doanh thu chưa thuế', 'Thuế suất', 'Thuế GTGT', 'Ghi chú'], ...rows.map((x, i) => [i + 1, x.r.invoice!.series ?? '', x.r.invoice!.no, fmtDate(x.r.invoice!.date), x.r.buyer?.name ?? '', x.r.buyer?.noTax ? '' : x.r.buyer?.taxCode ?? '', x.base, `${x.rate}%`, x.vat, x.r.status === 'CANCELLED' ? 'Hóa đơn đã hủy' : '']), ['', '', '', '', 'Tổng cộng', '', all.base, '', all.vat, '']] }]));
  return (
    <div className="space-y-3" data-out-tab>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {rates.map((r) => { const s = sum(rows.filter((x) => x.rate === r)); return <p key={r} className="text-[13px]" data-rate={r}><span className="text-[rgb(var(--muted))]">Thuế suất {r}%: </span><span className="tabular-nums">{fmtN(s.base)}</span><span className="text-[rgb(var(--muted))]"> · thuế </span><span className="tabular-nums">{fmtN(s.vat)}</span></p>; })}
        <p className="text-[13px] font-medium"><span className="font-normal text-[rgb(var(--muted))]">Tổng: </span><span className="tabular-nums" data-out-total>{fmtN(all.base)}</span><span className="font-normal text-[rgb(var(--muted))]"> · thuế </span><span className="tabular-nums" data-out-vat>{fmtN(all.vat)}</span></p>
        <button className={cn(btnGhost, 'ml-auto')} disabled={!rows.length} onClick={excel}><Download className="h-4 w-4" aria-hidden />Xuất Excel</button>
      </div>
      {rows.length ? (
        <Table id="acct-out" title="Bảng kê hóa đơn đầu ra" minW={980} head={['Ký hiệu', 'Số hóa đơn', 'Ngày hóa đơn', 'Người mua', 'Mã số thuế', 'Doanh thu chưa thuế', 'Thuế suất', 'Thuế GTGT', 'Ghi chú']}>
          {rows.map((x) => (
            <tr key={`${x.r.id}-${x.rate}`} className={cn('border-b border-[rgb(var(--ink)/0.06)]', x.r.status === 'CANCELLED' && 'text-[rgb(var(--muted))]')}>
              <td className={cn(td, 'pl-5 font-mono text-[12.5px]')}>{x.r.invoice!.series ?? '—'}</td>
              <td className={td}><Code>{x.r.invoice!.no}</Code></td>
              <td className={cn(td, 'tabular-nums')}>{fmtDate(x.r.invoice!.date)}</td>
              <td className={td}><span className="block max-w-[260px] truncate" title={x.r.buyer?.name}>{x.r.buyer?.name ?? '—'}</span></td>
              <td className={cn(td, 'font-mono text-[12.5px]')}>{x.r.buyer?.noTax ? '—' : x.r.buyer?.taxCode ?? '—'}</td>
              <td className={cn(td, num)}>{fmtN(x.base)}</td>
              <td className={cn(td, num)}>{x.rate}%</td>
              <td className={cn(td, num)}>{fmtN(x.vat)}</td>
              <td className={td}>{x.r.status === 'CANCELLED' ? <Chip tone="red">Đã hủy</Chip> : '—'}</td>
            </tr>
          ))}
        </Table>
      ) : <EmptyState text="Chưa có hóa đơn đầu ra trong kỳ" hint="Đổi kỳ ở góc trên bên phải" art="doc" compact />}
    </div>
  );
}

// ---------------------------------------------------------------------
//  3. Sổ nhật ký & Sổ cái (đọc từ bút toán đã ghi)
// ---------------------------------------------------------------------
function useOpenSrc() {
  const { go, setOpenSale } = useApp();
  return (e: JEntry) => { if (e.src === 'CE' || (e.src === 'REV' && e.reverses?.startsWith('CE:'))) go('cashbook'); else if (e.saleId) { setOpenSale(e.saleId); go('sales'); } };
}

function GlTab({ cfg, from, to }: { cfg: AcctConfig; from: string; to: string }) {
  const { journalEntries } = useApp();
  const [view, setView] = useSticky<'journal' | 'ledger'>('Accounting.gl', 'journal');
  const [src, setSrc] = useState<JEntry['src'] | 'ALL'>('ALL');
  const [acct, setAcct] = useSticky('Accounting.acct', '131');
  const [q, setQ] = useState('');
  const open = useOpenSrc();
  const list = acctList(cfg);
  const used = Array.from(new Set(journalEntries.flatMap((e) => e.lines.flatMap((l) => [l.dr, l.cr])))).sort();
  const parents = Array.from(new Set(used.flatMap((c) => list.filter((a) => c.startsWith(a.code)).map((a) => a.code)))).sort();
  const t = q.trim().toLowerCase();
  if (view === 'ledger') {
    const L = ledger(journalEntries, cfg.opening?.bal, acct, from, to);
    const side = (v: number) => (v >= 0 ? `Nợ ${fmtN(v)}` : `Có ${fmtN(-v)}`);
    return (
      <div className="space-y-3" data-ledger>
        <div className="flex flex-wrap items-center gap-2">
          <CbSeg label="Sổ" items={[['journal', 'Sổ nhật ký chung'], ['ledger', 'Sổ cái']]} value={view} onChange={setView} />
          <select className={cn(inputCls, 'max-w-[360px]')} value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="Tài khoản">{parents.concat(parents.includes(acct) ? [] : [acct]).map((c) => <option key={c} value={c}>{c} · {acctName(cfg, c)}</option>)}</select>
        </div>
        <table className="w-full text-[13.5px]">
          <thead><tr className="border-b border-[rgb(var(--line))]"><th className={cn(th, 'pl-0')}>Ngày</th><th className={th}>Số chứng từ</th><th className={th}>Diễn giải</th><th className={th}>TK đối ứng</th><th className={cn(th, 'text-right')}>Nợ</th><th className={cn(th, 'text-right')}>Có</th><th className={cn(th, 'text-right')}>Số dư</th></tr></thead>
          <tbody>
            <tr className="bg-[rgb(var(--ink)/0.03)]"><td className={cn(td, 'pl-0')} colSpan={6}>Số dư đầu kỳ ({fmtDate(from)})</td><td className={cn(td, num)} data-ledger-open>{side(L.open)}</td></tr>
            {L.rows.map((x, i) => (
              <tr key={`${x.e.id}-${i}`} className="cursor-pointer border-b border-[rgb(var(--ink)/0.06)] hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => open(x.e)}>
                <td className={cn(td, 'pl-0 tabular-nums')}>{fmtDate(x.e.date)}</td><td className={td}><Code>{x.e.ref}</Code></td><td className={td}><span className="block max-w-[320px] truncate" title={x.l.desc ?? x.e.desc}>{x.l.desc ?? x.e.desc}</span></td>
                <td className={td}><Code>{x.other}</Code></td><td className={cn(td, num)}>{x.side === 'dr' ? fmtN(x.amount) : ''}</td><td className={cn(td, num)}>{x.side === 'cr' ? fmtN(x.amount) : ''}</td><td className={cn(td, num)}>{side(x.bal)}</td>
              </tr>
            ))}
            <tr className="border-t border-[rgb(var(--line))] font-medium"><td className={cn(td, 'pl-0')} colSpan={4}>Cộng phát sinh</td><td className={cn(td, num)} data-ledger-dr>{fmtN(L.dr)}</td><td className={cn(td, num)} data-ledger-cr>{fmtN(L.cr)}</td><td /></tr>
            <tr className="bg-[rgb(var(--ink)/0.03)] font-medium"><td className={cn(td, 'pl-0')} colSpan={6}>Số dư cuối kỳ ({fmtDate(to)})</td><td className={cn(td, num)} data-ledger-close>{side(L.close)}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }
  const es = journalEntries.filter((e) => e.date >= from && e.date <= to && (src === 'ALL' || e.src === src) && (!t || `${e.ref} ${e.desc} ${e.lines.map((l) => `${l.dr} ${l.cr}`).join(' ')}`.toLowerCase().includes(t)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.postedAt - b.postedAt || a.id.localeCompare(b.id));
  const tot = es.reduce((s, e) => s + e.total, 0);
  return (
    <div className="space-y-3" data-journal>
      <div className="flex flex-wrap items-center gap-2">
        <CbSeg label="Sổ" items={[['journal', 'Sổ nhật ký chung'], ['ledger', 'Sổ cái']]} value={view} onChange={setView} />
        <div className="min-w-[220px] max-w-[380px] flex-1"><SearchBox value={q} onChange={setQ} placeholder="Tìm số chứng từ, diễn giải, tài khoản" /></div>
        <FunnelBtn n={src !== 'ALL' ? 1 : 0}>{(close) => <>
          <Field label="Nguồn bút toán"><select className={inputCls} value={src} onChange={(e) => setSrc(e.target.value as JEntry['src'] | 'ALL')}><option value="ALL">Tất cả</option>{(Object.keys(SRC_LABEL) as JEntry['src'][]).map((k) => <option key={k} value={k}>{SRC_LABEL[k]}</option>)}</select></Field>
          <div className="flex justify-end gap-2"><button className={btnGhost} onClick={() => setSrc('ALL')}>Đặt lại</button><button className={btnPrimary} onClick={close}>Xong</button></div>
        </>}</FunnelBtn>
        <span className="ml-auto text-[12.5px] tabular-nums text-[rgb(var(--muted))]">{es.length} bút toán · {fmtN(tot)}</span>
      </div>
      {es.length ? (
        <table className="w-full text-[13.5px]">
          <thead><tr className="border-b border-[rgb(var(--line))]"><th className={cn(th, 'pl-0')}>Ngày</th><th className={th}>Số chứng từ</th><th className={th}>Diễn giải</th><th className={th}>TK Nợ</th><th className={th}>TK Có</th><th className={cn(th, 'text-right')}>Số tiền</th><th className={th}>Nguồn</th></tr></thead>
          <tbody>{es.flatMap((e) => e.lines.map((l, i) => (
            <tr key={`${e.id}-${i}`} className={cn('cursor-pointer hover:bg-[rgb(var(--ink)/0.03)]', i === e.lines.length - 1 ? 'border-b border-[rgb(var(--ink)/0.08)]' : '', e.reversedBy && 'text-[rgb(var(--muted))]')} onClick={() => open(e)} data-jentry={e.id}>
              <td className={cn(td, 'pl-0 tabular-nums')}>{i === 0 ? fmtDate(e.date) : ''}</td>
              <td className={td}>{i === 0 ? <Code>{e.ref}</Code> : ''}</td>
              <td className={td}><span className="block max-w-[340px] truncate" title={l.desc ?? e.desc}>{l.desc ?? e.desc}</span></td>
              <td className={td}><Code>{l.dr}</Code></td><td className={td}><Code>{l.cr}</Code></td>
              <td className={cn(td, num)}>{fmtN(l.amount)}</td>
              <td className={td}>{i === 0 ? (e.src === 'REV' ? <Chip tone="red">Bút toán đảo</Chip> : e.reversedBy ? <Chip>Đã đảo</Chip> : <span className="text-[12.5px] text-[rgb(var(--fg2))]">{SRC_LABEL[e.src]}</span>) : ''}</td>
            </tr>
          )))}</tbody>
        </table>
      ) : <EmptyState text="Chưa có bút toán trong kỳ" hint={`Ghi sổ từ ${fmtDate(cfg.journalSince ?? from)}`} art="ledger" compact />}
    </div>
  );
}

// ---------------------------------------------------------------------
//  4. Cân đối số phát sinh + khóa kỳ + số dư đầu kỳ
// ---------------------------------------------------------------------
function TbTab({ cfg, from, to }: { cfg: AcctConfig; from: string; to: string }) {
  const { journalEntries, canDo, setMfgConfig, audit, notify, role, me } = useApp();
  const rows = trialBalance(journalEntries, cfg.opening?.bal, from, to);
  const can = canDo('acct.post');
  const [lock, setLock] = useState(cfg.lockedUntil ?? to);
  const [editOpen, setEditOpen] = useState(false);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  const T = { od: sum((r) => Math.max(0, r.open)), oc: sum((r) => Math.max(0, -r.open)), dr: sum((r) => r.dr), cr: sum((r) => r.cr), cd: sum((r) => Math.max(0, r.close)), cc: sum((r) => Math.max(0, -r.close)) };
  const ok = T.dr === T.cr && T.od === T.oc;
  const doLock = () => {
    if (!can) return;
    if (lock > todayISO()) return notify('Không khóa kỳ tương lai', 'red');
    if (cfg.lockedUntil && lock < cfg.lockedUntil && role !== 'BOD') return notify('Chỉ Giám đốc mở lại kỳ đã khóa', 'red');
    setMfgConfig((c) => (c.acct ? { ...c, acct: { ...c.acct, lockedUntil: lock } } : c));
    audit('ACCT_LOCK', cfg.lockedUntil && lock < cfg.lockedUntil ? `Mở lại kỳ: khóa lùi từ ${fmtDate(cfg.lockedUntil)} về ${fmtDate(lock)}` : `Khóa kỳ đến hết ${fmtDate(lock)}`, 'WARN');
    notify(`Đã khóa kỳ đến hết ${fmtDate(lock)}`, 'teal');
  };
  const name = (c: string) => acctName(cfg, c) || '—';
  return (
    <div className="space-y-4" data-tb>
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-[13px]"><span className="text-[rgb(var(--muted))]">Kỳ </span>{fmtDate(from)} – {fmtDate(to)}</p>
        <Chip tone={ok ? 'teal' : 'red'}>{ok ? 'Cân: tổng Nợ = tổng Có' : `Lệch ${fmtN(Math.abs(T.dr - T.cr))}`}</Chip>
        <div className="ml-auto flex flex-wrap items-end gap-2" data-lock>
          <Field label={cfg.lockedUntil ? `Đang khóa đến ${fmtDate(cfg.lockedUntil)}` : 'Khóa kỳ đến ngày'}><input type="date" className={inputCls} value={lock} max={todayISO()} onChange={(e) => setLock(e.target.value)} aria-label="Khóa kỳ đến ngày" disabled={!can} /></Field>
          <button className={btnGhost} disabled={!can || lock === cfg.lockedUntil} onClick={doLock}><Lock className="h-4 w-4" aria-hidden />Khóa kỳ</button>
          <button className={btnGhost} disabled={!can || (!!cfg.lockedUntil && cfg.lockedUntil >= (cfg.journalSince ?? ''))} title={cfg.lockedUntil && cfg.lockedUntil >= (cfg.journalSince ?? '') ? 'Đã khóa kỳ: không sửa số dư đầu kỳ' : undefined} onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" aria-hidden />Số dư đầu kỳ</button>
        </div>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13.5px]">
            <thead>
              <tr className="border-b border-[rgb(var(--line)/0.6)]"><th className={cn(th, 'pl-0')} rowSpan={2}>Số hiệu TK</th><th className={th} rowSpan={2}>Tên tài khoản</th><th className={cn(th, 'text-center')} colSpan={2}>Số dư đầu kỳ</th><th className={cn(th, 'text-center')} colSpan={2}>Phát sinh trong kỳ</th><th className={cn(th, 'text-center')} colSpan={2}>Số dư cuối kỳ</th></tr>
              <tr className="border-b border-[rgb(var(--line))]">{['Nợ', 'Có', 'Nợ', 'Có', 'Nợ', 'Có'].map((x, i) => <th key={i} className={cn(th, 'text-right')}>{x}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-b border-[rgb(var(--ink)/0.06)]" data-tb-row={r.code}>
                  <td className={cn(td, 'pl-0')}><Code>{r.code}</Code></td><td className={td}><span className="block max-w-[260px] truncate" title={name(r.code)}>{name(r.code)}</span></td>
                  <td className={cn(td, num)}>{r.open > 0 ? fmtN(r.open) : ''}</td><td className={cn(td, num)}>{r.open < 0 ? fmtN(-r.open) : ''}</td>
                  <td className={cn(td, num)}>{r.dr ? fmtN(r.dr) : ''}</td><td className={cn(td, num)}>{r.cr ? fmtN(r.cr) : ''}</td>
                  <td className={cn(td, num)}>{r.close > 0 ? fmtN(r.close) : ''}</td><td className={cn(td, num)}>{r.close < 0 ? fmtN(-r.close) : ''}</td>
                </tr>
              ))}
              <tr className="bg-[rgb(var(--ink)/0.03)] font-medium" data-tb-total><td className={cn(td, 'pl-0')} colSpan={2}>Tổng cộng</td><td className={cn(td, num)}>{fmtN(T.od)}</td><td className={cn(td, num)}>{fmtN(T.oc)}</td><td className={cn(td, num)}>{fmtN(T.dr)}</td><td className={cn(td, num)}>{fmtN(T.cr)}</td><td className={cn(td, num)}>{fmtN(T.cd)}</td><td className={cn(td, num)}>{fmtN(T.cc)}</td></tr>
            </tbody>
          </table>
        </div>
      ) : <EmptyState text="Chưa có số liệu trong kỳ" art="ledger" compact />}
      <p className="text-[12.5px] text-[rgb(var(--muted))]">Số liệu lấy từ bút toán đã ghi sổ và số dư đầu kỳ ngày {fmtDate(cfg.opening?.date ?? cfg.journalSince ?? from)}{cfg.opening ? ` (${cfg.opening.source === 'CONVERT' ? 'chuyển từ sổ cũ' : 'kế toán nhập'})` : ''}. Chứng từ phát sinh trong kỳ đã khóa được ghi vào ngày đầu kỳ còn mở ({fmtDate(jOpenDate(cfg.lockedUntil ?? from, cfg.lockedUntil))}).</p>
      {editOpen && <OpeningDrawer cfg={cfg} onClose={() => setEditOpen(false)} onSave={(bal) => { setMfgConfig((c) => (c.acct ? { ...c, acct: { ...c.acct, opening: { date: cfg.journalSince ?? todayISO(), bal, source: 'MANUAL', by: me?.id, at: Date.now() } } } : c)); audit('ACCT_OPENING', `Sửa số dư đầu kỳ ${Object.keys(bal).length} tài khoản`, 'WARN'); notify('Đã lưu số dư đầu kỳ', 'teal'); setEditOpen(false); }} />}
    </div>
  );
}

/** Bảng trượt sửa số dư đầu kỳ: tổng dư Nợ phải bằng tổng dư Có */
function OpeningDrawer({ cfg, onClose, onSave }: { cfg: AcctConfig; onClose: () => void; onSave: (bal: Record<string, number>) => void }) {
  const list = acctList(cfg).filter((a) => !acctList(cfg).some((x) => x.parent === a.code));
  const [bal, setBal] = useState<Record<string, number>>({ ...(cfg.opening?.bal ?? {}) });
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const dr = Object.values(bal).filter((v) => v > 0).reduce((s, v) => s + v, 0), cr = Object.values(bal).filter((v) => v < 0).reduce((s, v) => s - v, 0);
  const set = (code: string, side: 'dr' | 'cr', v: number) => setBal((b) => { const n = { ...b }; const val = side === 'dr' ? v : -v; if (!v) { if ((side === 'dr' && (n[code] ?? 0) > 0) || (side === 'cr' && (n[code] ?? 0) < 0)) delete n[code]; } else n[code] = val; return n; });
  const shown = list.filter((a) => !t || `${a.code} ${a.name}`.toLowerCase().includes(t) || bal[a.code]);
  return (
    <Drawer size="lg" title="Số dư đầu kỳ" eyebrow={`Ngày ${fmtDate(cfg.journalSince ?? todayISO())}`} onClose={onClose}
      footer={<div className="flex items-center gap-3"><span className={cn('mr-auto text-[13px] tabular-nums', dr !== cr && 'text-[rgb(var(--danger-fg))]')}>Dư Nợ {fmtN(dr)} · Dư Có {fmtN(cr)}{dr !== cr ? ` · lệch ${fmtN(Math.abs(dr - cr))}` : ''}</span><button className={btnGhost} onClick={onClose}>Thôi</button><button className={btnPrimary} disabled={dr !== cr} onClick={() => onSave(bal)}><CheckIcon className="h-4 w-4" aria-hidden />Lưu</button></div>}>
      <SearchBox value={q} onChange={setQ} placeholder="Tìm tài khoản" />
      <table className="w-full text-[13.5px]"><thead><tr className="border-b border-[rgb(var(--line))]"><th className={cn(th, 'pl-0')}>Tài khoản</th><th className={cn(th, 'w-40 text-right')}>Dư Nợ</th><th className={cn(th, 'w-40 text-right')}>Dư Có</th></tr></thead>
        <tbody>{shown.map((a) => <tr key={a.code} className="border-b border-[rgb(var(--ink)/0.06)]"><td className={cn(td, 'pl-0')}><Code>{a.code}</Code> <span className="text-[rgb(var(--fg2))]">{a.name}</span></td>
          <td className="py-1.5 pl-2"><input className={cn(inputCls, 'text-right tabular-nums')} inputMode="numeric" value={(bal[a.code] ?? 0) > 0 ? fmtN(bal[a.code]) : ''} onChange={(e) => set(a.code, 'dr', Number(e.target.value.replace(/\D/g, '')) || 0)} aria-label={`Dư Nợ ${a.code}`} /></td>
          <td className="py-1.5 pl-2"><input className={cn(inputCls, 'text-right tabular-nums')} inputMode="numeric" value={(bal[a.code] ?? 0) < 0 ? fmtN(-bal[a.code]) : ''} onChange={(e) => set(a.code, 'cr', Number(e.target.value.replace(/\D/g, '')) || 0)} aria-label={`Dư Có ${a.code}`} /></td></tr>)}</tbody></table>
    </Drawer>
  );
}

// ---------------------------------------------------------------------
//  5. Đối chiếu đơn hàng: Đã giao ↔ Đã xuất hóa đơn ↔ Đã thu tiền
// ---------------------------------------------------------------------
function ReconTab({ reqs, from, to }: { reqs: InvoiceReq[]; from: string; to: string }) {
  const { salesOrders, stockVouchers, skus, setOpenSale, go } = useApp();
  const [flag, setFlag] = useSticky<ReconFlag | 'ALL' | 'ANY'>('Accounting.flag', 'ALL');
  const [q, setQ] = useState('');
  const all = useMemo(() => reconcile(salesOrders.filter((o) => o.date >= from && o.date <= to), stockVouchers, skus, reqs), [salesOrders, stockVouchers, skus, reqs, from, to]);
  const t = q.trim().toLowerCase();
  const base = all.filter((r) => !t || `${r.o.code} ${r.o.customer}`.toLowerCase().includes(t));
  const rows0 = base.filter((r) => flag === 'ALL' || (flag === 'ANY' ? r.flags.length > 0 : r.flags.includes(flag)));
  const { rows, th: sort } = useSort('acct-recon', rows0, { 0: (r) => r.o.code, 1: (r) => r.o.date, 3: (r) => r.total, 4: (r) => r.delivered, 5: (r) => r.invoiced, 6: (r) => r.paid, 7: (r) => r.delivered - r.invoiced, 8: (r) => r.invoiced - r.paid });
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
  return (
    <div className="space-y-3" data-recon>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] max-w-[360px] flex-1"><SearchBox value={q} onChange={setQ} placeholder="Tìm mã đơn, khách hàng" /></div>
        {/* v59: cùng kiểu thanh lọc nhanh toàn CRM (Tất cả luôn đầu) */}
        <StatusBar<ReconFlag | 'ANY'> label="Cảnh báo đối chiếu" value={flag} onChange={setFlag} total={base.length} funnel={false}
          options={[{ value: 'ANY', label: 'Có cảnh báo', count: base.filter((r) => r.flags.length).length }, ...(['DELIVERED_NO_INV', 'INV_BEFORE_DELIVERY', 'PAID_OVER_INV'] as const).map((k) => ({ value: k, label: RECON_FLAG[k], count: base.filter((r) => r.flags.includes(k)).length }))]} />
      </div>
      {rows.length ? (
        <Table id="acct-recon" title="Đối chiếu đơn hàng" sort={sort} minW={1080} optional={[1]}
          head={['Đơn hàng', 'Ngày đơn', 'Khách hàng', 'Tổng đơn', 'Đã giao', 'Đã xuất hóa đơn', 'Đã thu', 'Giao − Hóa đơn', 'Hóa đơn − Thu', 'Cảnh báo']}>
          {rows.map((r) => (
            <tr key={r.o.id} className="cursor-pointer border-b border-[rgb(var(--ink)/0.06)] hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => { setOpenSale(r.o.id); go('sales'); }} data-recon-row={r.o.code}>
              <td className={cn(td, 'pl-5')}><Code>{r.o.code}</Code></td>
              <td className={cn(td, 'tabular-nums')}>{fmtDate(r.o.date)}</td>
              <td className={td}><span className="block max-w-[220px] truncate" title={r.o.customer}>{r.o.customer}</span></td>
              <td className={cn(td, num)}>{fmtN(r.total)}</td>
              <td className={cn(td, num)}>{fmtN(r.delivered)}</td>
              <td className={cn(td, num)}>{fmtN(r.invoiced)}</td>
              <td className={cn(td, num)}>{fmtN(r.paid)}</td>
              <td className={cn(td, num, Math.abs(r.delivered - r.invoiced) > 1000 && r.o.invoice && 'text-[rgb(var(--accent-fg))]')}>{fmtN(r.delivered - r.invoiced)}</td>
              <td className={cn(td, num)}>{fmtN(r.invoiced - r.paid)}</td>
              <td className={td}>{r.flags.length ? <span className="flex flex-wrap gap-1">{r.flags.map((f) => <Chip key={f} tone="orange">{RECON_FLAG[f]}</Chip>)}</span> : <span className="text-[rgb(var(--muted))]">—</span>}</td>
            </tr>
          ))}
          <tr className="bg-[rgb(var(--ink)/0.03)] font-medium"><td className={cn(td, 'pl-5')} colSpan={3}>Cộng {rows.length} đơn</td><td className={cn(td, num)}>{fmtN(sum((r) => r.total))}</td><td className={cn(td, num)}>{fmtN(sum((r) => r.delivered))}</td><td className={cn(td, num)}>{fmtN(sum((r) => r.invoiced))}</td><td className={cn(td, num)}>{fmtN(sum((r) => r.paid))}</td><td className={cn(td, num)}>{fmtN(sum((r) => r.delivered - r.invoiced))}</td><td className={cn(td, num)}>{fmtN(sum((r) => r.invoiced - r.paid))}</td><td /></tr>
        </Table>
      ) : <EmptyState text="Không có đơn cần đối chiếu trong kỳ" art="search" compact />}
      <p className="text-[12.5px] text-[rgb(var(--muted))]">Số đã giao, đã xuất hóa đơn, đã thu đều gồm thuế GTGT. Đã giao = phiếu xuất kho bán đã duyệt trừ hàng trả lại, cộng hàng không qua kho đã giao. Cảnh báo "Giao chưa hóa đơn" và "Thu vượt hóa đơn" chỉ xét đơn khách lấy hóa đơn.</p>
    </div>
  );
}
