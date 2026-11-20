'use client';

import { type ReactNode, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Building2, Check as CheckIcon, Download, FileText, Lock, Pencil, Plus, Printer, RefreshCw, ShoppingBag, Trash2, Upload, Wallet, X, XCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { removeWithUndo } from '../../app/context';
import { useIntent } from '../../components/command-palette';
import { Pagination, usePaged } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Chip, Code, EmptyState, Field, FilePicker, Modal, MoneyInput, Panel, Table, Tabs, useSticky } from '../../components/ui';
import { bizMode, btnGhost, btnPrimary, btnSm, C, CASH_ACCOUNT, CASH_IN_CATS, CASH_OUT_CATS, CASH_SRC, cashEff, cashReversed, compact, esc, fmtDate, fmtN, inputCls, isCashReversal, iso, jobCustName, nextCode, noteFor, rangeBounds, readAsDataUrl, rowCls, saleOwed, salePaid, tdCls, tdFirst, tdLast, tipStyle, todayISO, uid, useApp, vnd } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import { saleTotals } from '../../lib/getfly';
import type { CashAccount, CashEntry, CashFile, CashLine, CashSub, CompanyInfo, ConfirmState, SalesOrder } from '../../lib/types';
import { cn } from '../../lib/utils';
import { cashLines, compressImage, jobActualCost } from '../../lib/workshop';
import { SearchBox } from '../alux/orders';
import { lastMonths } from '../alux/overview';
import { docShell, moneyToWordsVN, printHtml } from '../sales/templates';

export function cashVoucherHtml(e: CashEntry, company: CompanyInfo, by: string) {
  const title = e.kind === 'IN' ? 'PHIẾU THU' : e.kind === 'OUT' ? 'PHIẾU CHI' : 'PHIẾU CHUYỂN QUỸ';
  const head = e.kind === 'TRANSFER' ? `Từ: <b>${esc(CASH_ACCOUNT[e.account])}</b><br>Sang: <b>${esc(CASH_ACCOUNT[e.toAccount ?? 'BANK'])}</b>`
    : `${e.kind === 'IN' ? 'Người nộp' : 'Người nhận'}: <b>${esc(e.partner ?? '')}</b><br>Khoản mục: ${esc(e.category)}<br>Quỹ: ${esc(CASH_ACCOUNT[e.account])}`;
  return `<p><b>${esc(company.legalName)}</b><br>${esc(company.address)}</p><h1>${title}</h1><p class="c">Số ${esc(e.code)} · ngày ${fmtDate(e.date)}</p>
<p>${head}<br>Lý do: ${esc(e.note ?? '')}${e.ref && e.ref !== e.code ? `<br>Chứng từ gốc: ${esc(e.ref)}` : ''}${e.invNo ? `<br>Hóa đơn: ${esc(e.invNo)}${e.vatRate != null ? ` · thuế GTGT ${e.vatRate}%` : ''}` : ''}</p>
<p>Số tiền: <b>${fmtN(e.amount)} đ</b><br><b>Bằng chữ:</b> <i>${moneyToWordsVN(e.amount)}</i></p>
<table class="layout sign"><tr><td><b>${e.kind === 'IN' ? 'NGƯỜI NỘP TIỀN' : e.kind === 'OUT' ? 'NGƯỜI NHẬN TIỀN' : 'THỦ QUỸ'}</b><br>(Ký, ghi rõ họ tên)<br><br><br><br></td><td><b>NGƯỜI LẬP PHIẾU</b><br>(Ký, ghi rõ họ tên)<br><br><br>${esc(by)}</td></tr></table>`;
}

export function CbSeg<T extends string>({ items, value, onChange, label, locked }: { items: [T, string][]; value: T; onChange: (v: T) => void; label: string; locked?: boolean }) {
  return (
    <div className="flex w-full overflow-x-auto rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label={label}>
      {items.map(([k, l]) => (
        <button key={k} type="button" role="radio" aria-checked={value === k} disabled={locked && value !== k} onClick={() => onChange(k)}
          className={cn('flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] disabled:opacity-40', value === k ? 'bg-[rgb(var(--fg))] font-medium text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>{l}</button>
      ))}
    </div>
  );
}

export function CbKv({ a, b, tot, warn }: { a: ReactNode; b: ReactNode; tot?: boolean; warn?: boolean }) {
  return <div className={cn('flex items-baseline justify-between gap-3 py-1 text-[13px]', tot && 'mt-1 border-t border-[rgb(var(--line))] pt-2 font-medium')}><span className="text-[rgb(var(--muted))]">{a}</span><span className={cn('text-right tabular-nums', warn && 'text-[rgb(var(--danger-fg))]')}>{b}</span></div>;
}

export function CbBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return <div><p className="mb-1 text-[12px] text-[rgb(var(--muted))]">{title}</p>{children}</div>;
}

export function CbFiles({ files, onRemove }: { files: CashFile[]; onRemove?: (i: number) => void }) {
  return <>{files.map((x, i) => (
    <span key={`${x.name}${i}`} className="inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] px-2.5 py-1.5 text-[12.5px]">
      <FileText className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
      <a href={x.url} target="_blank" rel="noreferrer" download={x.name} className="truncate hover:underline">{x.name}</a>
      {onRemove && <button type="button" className="text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => onRemove(i)} aria-label={`Bỏ ${x.name}`}><X className="h-3.5 w-3.5" aria-hidden /></button>}
    </span>
  ))}</>;
}

/** v51.2: phiếu thu / phiếu chi / chuyển quỹ: nhập liệu bên trái, kết quả (công nợ, quỹ trước / sau) bên phải */
export function CashEntryModal({ kind, entry, onClose, onAgain, onDelete, bal }: { kind: CashEntry['kind']; entry?: CashEntry; onClose: () => void; onAgain?: () => void; onDelete?: () => void; bal: (a: CashAccount) => number }) {
  const { me, cashEntries, setCashEntries, jobs, customers, notify, audit, mySales, users, pos, saleCashMulti, company } = useApp();
  const hasSales = mySales.length > 0;
  const [f, setF] = useState<CashEntry>(entry ?? { id: uid('ce'), code: '', kind, date: todayISO(), account: 'CASH', toAccount: 'BANK', category: kind === 'IN' ? CASH_IN_CATS[0] : kind === 'OUT' ? CASH_OUT_CATS[0] : 'Chuyển quỹ', amount: 0, by: me.id, at: Date.now(),
    sub: kind === 'IN' ? (hasSales ? 'CUSTOMER' : 'OTHER') : kind === 'OUT' ? 'COST' : undefined });
  const set = (p: Partial<CashEntry>) => setF((x) => ({ ...x, ...p }));
  const sub: CashSub = f.sub ?? (f.kind === 'IN' ? 'OTHER' : 'COST');
  const [cust, setCust] = useState('');
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [hasInv, setHasInv] = useState(!!entry?.invNo);
  const [fee, setFee] = useState(0);
  const [print, setPrint] = useState(false);
  const saleMode = sub === 'CUSTOMER' || sub === 'REFUND';
  const owe = (o: SalesOrder) => saleOwed(o) - salePaid(o, true);
  const extra = (o: SalesOrder) => Math.max(0, Math.min(-owe(o), salePaid(o)));
  const cap = (o: SalesOrder) => (sub === 'REFUND' ? extra(o) : owe(o));
  const pool = !saleMode ? [] : sub === 'REFUND' ? mySales.filter((o) => extra(o) > 0) : mySales.filter((o) => o.status !== 'CANCELLED' && owe(o) > 0);
  const custList = Array.from(new Set(pool.map((o) => o.customer))).sort();
  const rowsO = pool.filter((o) => o.customer === cust).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const custOwe = rowsO.reduce((s, o) => s + cap(o), 0);
  const allocSum = rowsO.reduce((s, o) => s + (alloc[o.id] ?? 0), 0);
  const amount = saleMode ? allocSum : f.amount;
  const spread = (total: number) => { let r = Math.max(0, Math.round(total)); const m: Record<string, number> = {}; rowsO.forEach((o) => { const v = Math.min(cap(o), r); m[o.id] = v; r -= v; }); setAlloc(m); };
  const pickCust = (name: string) => { setCust(name); setAlloc({}); set({ partner: name }); };
  const setSub = (k: CashSub) => { setCust(''); setAlloc({}); set({ sub: k, partner: '', saleId: undefined, jobId: undefined, category: k === 'OTHER' ? CASH_IN_CATS[0] : k === 'ADVANCE' ? 'Tạm ứng công tác' : k === 'COST' || k === 'VENDOR' ? CASH_OUT_CATS[0] : f.category }); };
  const sales = mySales.filter((o) => o.status !== 'CANCELLED').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);
  const activeJobs = jobs.filter((j) => j.wonAt && !j.lostAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const costSale = f.saleId ? mySales.find((o) => o.id === f.saleId) : undefined;
  const costJob = f.jobId ? jobs.find((j) => j.id === f.jobId) : undefined;
  const costOf = (pick: (x: CashEntry) => boolean) => cashEntries.filter((x) => x.kind === 'OUT' && pick(x) && x.source !== 'SALE' && !isCashReversal(x) && x.id !== f.id).reduce((s, x) => s + x.amount, 0);
  const vendors = Array.from(new Set(pos.map((p) => p.vendor))).sort();
  const staff = users.filter((u) => u.active);
  const prefix = f.kind === 'IN' ? 'PTQ' : f.kind === 'OUT' ? 'PCQ' : 'CQ';
  const code = f.code || nextCode(cashEntries.filter((e) => e.code.startsWith(`${prefix}-`)).map((e) => e.code), `${prefix}-${f.date.slice(0, 4)}-`, 4);
  const now = (a: CashAccount) => bal(a) - (entry ? cashEff(entry, a) : 0);
  const after = (a: CashAccount) => now(a) + cashEff({ ...f, amount }, a) - (f.kind === 'TRANSFER' && fee > 0 && f.account === a ? fee : 0);
  const vat = hasInv && f.vatRate ? Math.round((amount * f.vatRate) / (100 + f.vatRate)) : 0;
  const addFiles = async (fs: File[]) => {
    const out: CashFile[] = [];
    for (const file of fs.slice(0, 4)) {
      if (file.type.startsWith('image/')) out.push({ name: file.name, url: await compressImage(file) });
      else if (file.type === 'application/pdf' && file.size <= 1024 * 1024) out.push({ name: file.name, url: await readAsDataUrl(file) });
      else notify(`${file.name}: chỉ nhận ảnh hoặc PDF tối đa 1 MB`, 'red');
    }
    setF((x) => ({ ...x, files: [...(x.files ?? []), ...out].slice(0, 6) }));
  };
  const save = (again: boolean) => {
    if (amount <= 0) return notify(saleMode ? 'Nhập số tiền cho ít nhất một đơn' : 'Nhập số tiền', 'red');
    if (f.kind === 'TRANSFER' && f.account === f.toAccount) return notify('Chọn hai quỹ khác nhau', 'red');
    if ((sub === 'VENDOR' || sub === 'ADVANCE') && f.kind === 'OUT' && !f.partner?.trim()) return notify(sub === 'VENDOR' ? 'Nhập nhà cung cấp' : 'Chọn nhân viên nhận tạm ứng', 'red');
    let doc: CashEntry;
    if (saleMode) {
      if (!cust) return notify('Chọn khách hàng', 'red');
      if (rowsO.some((o) => (alloc[o.id] ?? 0) > cap(o))) return notify(sub === 'REFUND' ? 'Số hoàn vượt số khách trả thừa của đơn' : 'Số thu vượt số còn phải thu của đơn', 'red');
      const picked = rowsO.filter((o) => (alloc[o.id] ?? 0) > 0);
      if (!saleCashMulti(picked.map((o) => ({ id: o.id, amount: alloc[o.id] })), f.account, { date: f.date, payer: f.partner?.trim() || cust, note: f.note?.trim() || undefined, refund: sub === 'REFUND' || undefined, files: f.files })) return;
      const codes = picked.map((o) => o.code).join(', ');
      doc = { ...f, code, amount, partner: f.partner?.trim() || cust, ref: codes, category: sub === 'REFUND' ? 'Hoàn tiền bán hàng' : 'Thu tiền bán hàng', note: f.note?.trim() || `${sub === 'REFUND' ? 'Hoàn tiền' : 'Thu tiền'} đơn hàng ${codes}` };
      notify(`Đã lưu ${code} cho ${picked.length} đơn`, 'teal');
    } else {
      const x: CashEntry = { ...f, amount, source: f.source ?? 'MANUAL', code, partner: f.partner?.trim() || undefined, note: f.note?.trim() || undefined, invNo: hasInv ? f.invNo?.trim() || undefined : undefined, vatRate: hasInv ? f.vatRate : undefined };
      const feeE: CashEntry | null = f.kind === 'TRANSFER' && fee > 0 ? { id: uid('ce'), code: '', kind: 'OUT', date: f.date, account: f.account, category: 'Chi khác', amount: fee, note: `Phí chuyển quỹ ${code}`, ref: code, by: me.id, at: Date.now(), source: 'MANUAL', sub: 'COST' } : null;
      setCashEntries((all) => {
        const base = all.some((e) => e.id === x.id) ? all.map((e) => (e.id === x.id ? x : e)) : [x, ...all];
        if (!feeE) return base;
        return [{ ...feeE, code: nextCode(base.filter((e) => e.code.startsWith('PCQ-')).map((e) => e.code), `PCQ-${f.date.slice(0, 4)}-`, 4) }, ...base];
      });
      audit('CASH_' + x.kind, `${x.code}: ${vnd(x.amount)} ${x.category}`);
      notify(`Đã lưu ${x.code}${feeE ? ', kèm phiếu chi phí chuyển' : ''}`, 'teal');
      doc = x;
    }
    if (print) printHtml(docShell(code, cashVoucherHtml(doc, company, me.name)));
    if (again && onAgain) onAgain(); else onClose();
  };
  const title = f.kind === 'IN' ? 'Phiếu thu' : f.kind === 'OUT' ? 'Phiếu chi' : 'Chuyển quỹ';
  const words = amount > 0 ? <p className="mt-1 text-[12px] text-[rgb(var(--muted))]">{moneyToWordsVN(amount)}</p> : null;
  const accSeg = (label: string) => <Field label={label}><CbSeg label={label} items={[['CASH', 'Tiền mặt'], ['BANK', 'Ngân hàng']]} value={f.account} onChange={(v) => set({ account: v })} /></Field>;
  const dateF = <Field label="Ngày chứng từ"><input className={inputCls} type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>;
  const noteF = <Field label="Diễn giải"><input className={inputCls} value={f.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder={saleMode && rowsO.length ? `${sub === 'REFUND' ? 'Hoàn tiền' : 'Thu tiền'} đơn hàng ${rowsO.filter((o) => (alloc[o.id] ?? 0) > 0).map((o) => o.code).join(', ')}` : undefined} /></Field>;
  const filesF = (
    <Field label="Chứng từ kèm theo">
      <div className="flex flex-wrap items-center gap-2">
        <CbFiles files={f.files ?? []} onRemove={(i) => set({ files: (f.files ?? []).filter((_, j) => j !== i) })} />
        <FilePicker accept="image/*,application/pdf" multiple onFiles={(fs) => { void addFiles(fs); }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[rgb(var(--ink)/0.2)] px-3 py-1.5 text-[12.5px] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]"><Upload className="h-3.5 w-3.5" aria-hidden />Ảnh, ủy nhiệm chi, hóa đơn</FilePicker>
      </div>
    </Field>
  );
  const fundBox = (a: CashAccount) => (
    <CbBox title={CASH_ACCOUNT[a]}>
      <CbKv a="Tồn hiện tại" b={fmtN(now(a))} />
      <CbKv a={f.kind === 'OUT' ? 'Sau khi chi' : 'Sau khi lưu'} b={fmtN(after(a))} tot warn={after(a) < 0} />
      {after(a) < 0 && <p className="text-[12px] text-[rgb(var(--danger-fg))]">Quỹ âm sau khi lưu, kiểm tra số dư</p>}
    </CbBox>
  );
  const fund = (a: CashAccount, to: boolean) => (
    <div className={cn('rounded-xl border p-4', to ? 'border-[rgb(var(--accent)/0.5)] bg-[rgb(var(--accent)/0.05)]' : 'border-[rgb(var(--line))]')}>
      <p className="text-[12px] text-[rgb(var(--muted))]">{to ? 'Sang quỹ' : 'Từ quỹ'}</p>
      <div className="mt-2 flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[rgb(var(--ink)/0.05)] text-[rgb(var(--fg2))]">{a === 'CASH' ? <Wallet className="h-4 w-4" aria-hidden /> : <Building2 className="h-4 w-4" aria-hidden />}</span><p className="font-medium">{CASH_ACCOUNT[a]}</p></div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--line)/0.6)] pt-2.5 text-[13px]"><span className="text-[rgb(var(--muted))]">Số dư</span><span className="tabular-nums">{fmtN(now(a))}</span><ArrowRight className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /><b className={cn('font-medium tabular-nums', after(a) < 0 && 'text-[rgb(var(--danger-fg))]')}>{fmtN(after(a))}</b></div>
    </div>
  );
  const left = f.kind === 'TRANSFER' ? (
    <>
      <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_40px_1fr]">
        {fund(f.account, false)}
        <button type="button" className="mx-auto grid h-9 w-9 place-items-center rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]" onClick={() => set({ account: f.toAccount ?? 'BANK', toAccount: f.account })} aria-label="Đổi chiều chuyển quỹ" title="Đổi chiều"><ArrowLeftRight className="h-4 w-4" aria-hidden /></button>
        {fund(f.toAccount ?? 'BANK', true)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Số tiền *"><MoneyInput value={f.amount} onChange={(n) => set({ amount: n })} />{words}</Field>
        {dateF}
        <Field label="Người thực hiện"><input className={inputCls} list="cb-staff" value={f.partner ?? ''} onChange={(e) => set({ partner: e.target.value })} /></Field>
        <Field label="Phí chuyển" hint="Có phí thì lập thêm phiếu chi từ quỹ nguồn"><MoneyInput value={fee} onChange={setFee} disabled={!!entry} /></Field>
      </div>
      {noteF}
    </>
  ) : f.kind === 'IN' ? (
    <>
      {!entry && hasSales && <Field label="Loại thu"><CbSeg label="Loại thu" items={[['CUSTOMER', 'Thu tiền khách hàng'], ['OTHER', 'Thu khác']]} value={sub} onChange={setSub} /></Field>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{dateF}{accSeg('Quỹ nhận')}</div>
      {sub === 'CUSTOMER' ? null : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Khoản mục"><select className={inputCls} value={f.category} onChange={(e) => set({ category: e.target.value })}>{Array.from(new Set([...CASH_IN_CATS, f.category])).map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Người nộp"><input className={inputCls} value={f.partner ?? ''} onChange={(e) => set({ partner: e.target.value })} /></Field>
          <Field label="Số tiền *" className="sm:col-span-2"><MoneyInput value={f.amount} onChange={(n) => set({ amount: n })} />{words}</Field>
        </div>
      )}
    </>
  ) : (
    <>
      {!entry && <Field label="Loại chi"><CbSeg label="Loại chi" items={[['COST', 'Chi phí'], ['VENDOR', 'Trả nhà cung cấp'], ['ADVANCE', 'Tạm ứng'], ...(hasSales ? [['REFUND', 'Hoàn tiền khách'] as [CashSub, string]] : [])]} value={sub} onChange={setSub} /></Field>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{dateF}{accSeg('Quỹ chi')}</div>
      {sub !== 'REFUND' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sub !== 'ADVANCE' && <Field label="Khoản mục *"><select className={inputCls} value={f.category} onChange={(e) => set({ category: e.target.value })}>{Array.from(new Set([...CASH_OUT_CATS, f.category])).map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>}
          {sub !== 'ADVANCE' && (
            <Field label="Tính vào chi phí của">
              <select className={inputCls} value={f.saleId ? `S:${f.saleId}` : f.jobId ? `J:${f.jobId}` : ''} onChange={(e) => { const v = e.target.value; set({ saleId: v.startsWith('S:') ? v.slice(2) : undefined, jobId: v.startsWith('J:') ? v.slice(2) : undefined }); }}>
                <option value="">Chi phí chung</option>
                {sales.length > 0 && <optgroup label="Đơn bán">{sales.map((o) => <option key={o.id} value={`S:${o.id}`}>{o.code} · {o.customer}</option>)}</optgroup>}
                {activeJobs.length > 0 && <optgroup label="Đơn hàng xưởng">{activeJobs.map((j) => <option key={j.id} value={`J:${j.id}`}>{j.code} · {jobCustName(j, customers)}</option>)}</optgroup>}
              </select>
            </Field>
          )}
          {sub === 'ADVANCE'
            ? <Field label="Nhân viên nhận *" className="sm:col-span-2"><select className={inputCls} value={f.partner ?? ''} onChange={(e) => set({ partner: e.target.value })}><option value="">Chọn nhân viên</option>{staff.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}</select></Field>
            : <Field label={sub === 'VENDOR' ? 'Nhà cung cấp *' : 'Người nhận'} className="sm:col-span-2"><input className={inputCls} list={sub === 'VENDOR' ? 'cb-vendor' : undefined} value={f.partner ?? ''} onChange={(e) => set({ partner: e.target.value })} /></Field>}
          <Field label="Số tiền *"><MoneyInput value={f.amount} onChange={(n) => set({ amount: n })} />{words}</Field>
          {sub !== 'ADVANCE' && <Field label="Hóa đơn đầu vào"><CbSeg label="Hóa đơn đầu vào" items={[['Y', 'Có hóa đơn'], ['N', 'Không có']]} value={hasInv ? 'Y' : 'N'} onChange={(v) => { setHasInv(v === 'Y'); if (v === 'Y' && f.vatRate == null) set({ vatRate: 8 }); }} /></Field>}
        </div>
      )}
      {hasInv && sub !== 'REFUND' && sub !== 'ADVANCE' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Số hóa đơn"><input className={inputCls} value={f.invNo ?? ''} onChange={(e) => set({ invNo: e.target.value })} /></Field>
          <Field label="Thuế suất"><select className={inputCls} value={f.vatRate ?? 8} onChange={(e) => set({ vatRate: Number(e.target.value) })}>{[0, 5, 8, 10].map((r) => <option key={r} value={r}>{r}%</option>)}</select></Field>
          <Field label="Tiền thuế"><div className={cn(inputCls, 'flex items-center gap-2 bg-[rgb(var(--ink)/0.03)] tabular-nums')}>{fmtN(vat)}<Lock className="ml-auto h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /></div></Field>
        </div>
      )}
    </>
  );
  const saleBlock = saleMode && (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Khách hàng *"><input className={inputCls} list="cb-cust" value={cust} onChange={(e) => pickCust(e.target.value)} placeholder={custList.length ? `${custList.length} khách ${sub === 'REFUND' ? 'đang trả thừa' : 'còn nợ'}` : 'Không có khách phù hợp'} /></Field>
        <Field label={sub === 'REFUND' ? 'Người nhận' : 'Người nộp'}><input className={inputCls} value={f.partner ?? ''} onChange={(e) => set({ partner: e.target.value })} /></Field>
      </div>
      <div>
        <div className="mb-1.5 flex items-center"><p className="text-[13px] font-medium">{sub === 'REFUND' ? 'Hoàn tiền cho đơn' : 'Thu cho đơn hàng'}</p>{rowsO.length > 1 && <button type="button" className="ml-auto text-[12.5px] text-[rgb(var(--accent))] hover:underline" onClick={() => spread(amount || custOwe)}>Phân bổ cho đơn cũ trước</button>}</div>
        {!cust ? <p className="rounded-lg border border-dashed border-[rgb(var(--line))] px-3 py-4 text-center text-[13px] text-[rgb(var(--muted))]">Chọn khách hàng để hiện các đơn {sub === 'REFUND' ? 'trả thừa' : 'còn phải thu'}</p>
          : !rowsO.length ? <p className="rounded-lg border border-dashed border-[rgb(var(--line))] px-3 py-4 text-center text-[13px] text-[rgb(var(--muted))]">Khách không có đơn {sub === 'REFUND' ? 'trả thừa' : 'còn phải thu'} trong phạm vi bạn xem</p>
          : (
            <div className="overflow-x-auto rounded-lg border border-[rgb(var(--line))]">
              <table className="w-full min-w-[620px] text-[13px]">
                <thead><tr className="bg-[rgb(var(--ink)/0.03)] text-left text-[12px] text-[rgb(var(--muted))]"><th className="w-10 px-3 py-2 font-normal" /><th className="px-2 py-2 font-normal">Mã đơn</th><th className="px-2 py-2 font-normal">Ngày</th><th className="px-2 py-2 text-right font-normal">Tổng đơn</th><th className="px-2 py-2 text-right font-normal">Đã thu</th><th className="px-2 py-2 text-right font-normal">{sub === 'REFUND' ? 'Trả thừa' : 'Còn phải thu'}</th><th className="px-3 py-2 text-right font-normal">{sub === 'REFUND' ? 'Hoàn lần này' : 'Thu lần này'}</th></tr></thead>
                <tbody>{rowsO.map((o) => { const v = alloc[o.id] ?? 0; return (
                  <tr key={o.id} className="border-t border-[rgb(var(--line)/0.6)]">
                    <td className="px-3 py-1.5"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={v > 0} onChange={(e) => setAlloc({ ...alloc, [o.id]: e.target.checked ? cap(o) : 0 })} aria-label={`Chọn ${o.code}`} /></td>
                    <td className="px-2 py-1.5"><Code>{o.code}</Code>{o.status === 'CANCELLED' && <span className="ml-1.5 text-[11.5px] text-[rgb(var(--muted))]">đã hủy</span>}</td>
                    <td className="px-2 py-1.5 tabular-nums text-[rgb(var(--fg2))]">{fmtDate(o.date)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtN(saleTotals(o).grand)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-[rgb(var(--fg2))]">{fmtN(salePaid(o, true))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmtN(cap(o))}</td>
                    <td className="px-3 py-1.5"><div className="ml-auto w-36"><MoneyInput value={v} onChange={(n) => setAlloc({ ...alloc, [o.id]: n })} /></div></td>
                  </tr>
                ); })}</tbody>
              </table>
            </div>
          )}
      </div>
      <Field label={sub === 'REFUND' ? 'Số tiền hoàn' : 'Số tiền'}><MoneyInput value={amount} onChange={spread} disabled={!rowsO.length} />{words}</Field>
    </>
  );
  const right = (
    <>
      {f.kind === 'TRANSFER' ? (
        <>
          <CbBox title="Ghi vào sổ">
            <CbKv a={CASH_ACCOUNT[f.account]} b={<span className="text-[rgb(var(--danger-fg))]">−{fmtN(amount)}</span>} />
            <CbKv a={CASH_ACCOUNT[f.toAccount ?? 'BANK']} b={<span className="text-[rgb(var(--success-fg))]">+{fmtN(amount)}</span>} />
            {fee > 0 && <CbKv a="Phí chuyển (phiếu chi riêng)" b={`−${fmtN(fee)}`} />}
            <p className="mt-1 text-[12px] text-[rgb(var(--muted))]">Một phiếu {code}, hiện ở cả hai sổ</p>
          </CbBox>
          <CbBox title="Tổng tiền của doanh nghiệp">
            <CbKv a="Trước" b={fmtN(now('CASH') + now('BANK'))} />
            <CbKv a="Sau" b={fmtN(after('CASH') + after('BANK'))} tot />
            <p className="mt-1 text-[12px] text-[rgb(var(--muted))]">Chuyển quỹ không tính vào thu, chi trong kỳ</p>
          </CbBox>
        </>
      ) : (
        <>
          {saleMode && cust && (
            <CbBox title={sub === 'REFUND' ? 'Khách trả thừa' : 'Công nợ khách hàng'}>
              <CbKv a={sub === 'REFUND' ? 'Đang trả thừa' : 'Đang phải thu'} b={fmtN(custOwe)} />
              <CbKv a={sub === 'REFUND' ? 'Hoàn lần này' : 'Thu lần này'} b={`−${fmtN(amount)}`} />
              <CbKv a={sub === 'REFUND' ? 'Còn trả thừa' : 'Còn phải thu'} b={fmtN(custOwe - amount)} tot warn={custOwe - amount < 0} />
            </CbBox>
          )}
          {fundBox(f.account)}
          {costSale && (
            <CbBox title={<>Đơn hàng <Code>{costSale.code}</Code></>}>
              <CbKv a="Doanh số" b={fmtN(saleTotals(costSale).net)} />
              <CbKv a="Chi phí đã tính" b={`${fmtN(costOf((x) => x.saleId === costSale.id))} → ${fmtN(costOf((x) => x.saleId === costSale.id) + amount - vat)}`} tot />
            </CbBox>
          )}
          {costJob && (
            <CbBox title={<>Đơn hàng <Code>{costJob.code}</Code></>}>
              <CbKv a="Giá trị hợp đồng" b={fmtN(costJob.contractValue ?? 0)} />
              <CbKv a="Chi phí khác đã tính" b={`${fmtN(costOf((x) => x.jobId === costJob.id))} → ${fmtN(costOf((x) => x.jobId === costJob.id) + amount)}`} tot />
            </CbBox>
          )}
          {saleMode && rowsO.some((o) => (alloc[o.id] ?? 0) > 0) && <p className="border-l-2 border-[rgb(var(--accent))] pl-3 text-[12.5px] text-[rgb(var(--fg2))]">{sub === 'REFUND' ? 'Số đã thu của đơn giảm tương ứng ngay khi lưu' : 'Các đơn ghi nhận doanh thu ngay khi lưu'}</p>}
        </>
      )}
    </>
  );
  return (
    <Modal xl flush title={entry ? `Sửa ${title.toLowerCase()}` : title} head={<><Code>{code}</Code>{!entry && <span className="text-[12px] text-[rgb(var(--muted))]">số tự động</span>}</>} onClose={onClose} footer={<>
      <label className="mr-auto inline-flex items-center gap-2 text-[13px] text-[rgb(var(--fg2))]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={print} onChange={(e) => setPrint(e.target.checked)} />{f.kind === 'TRANSFER' ? 'In phiếu chuyển quỹ' : 'In phiếu sau khi lưu'}</label>
      {entry && onDelete && <button className={cn(btnGhost, 'hover:text-[rgb(var(--danger-fg))]')} onClick={onDelete}><Trash2 className="h-4 w-4" aria-hidden />Xóa phiếu</button>}
      <button className={btnGhost} onClick={onClose}>Hủy</button>
      {!entry && onAgain && <button className={btnGhost} onClick={() => save(true)}>Lưu và thêm mới</button>}
      <button className={btnPrimary} onClick={() => save(false)}><CheckIcon className="h-4 w-4" aria-hidden />{entry ? 'Lưu' : `Lưu ${title.toLowerCase()}`}</button>
    </>}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 p-5">
          {left}
          {saleBlock}
          {noteFor(f.kind) && noteF}
          {filesF}
        </div>
        <div className="space-y-5 border-t border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.025)] p-5 lg:border-l lg:border-t-0">{right}</div>
      </div>
      <datalist id="cb-cust">{custList.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="cb-vendor">{vendors.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="cb-staff">{staff.map((u) => <option key={u.id} value={u.name} />)}</datalist>
    </Modal>
  );
}

/** v51.2: xem phiếu (phiếu tự sinh / phiếu đảo): chứng từ gốc, sửa ngày và diễn giải, hủy phiếu thu / chi đơn hàng bằng phiếu đảo */
export function CashViewModal({ e, onClose }: { e: CashEntry; onClose: () => void }) {
  const { cashEntries, setCashEntries, salesOrders, setSalesOrders, postCash, company, users, canDo, go, setOpenSale, openJob, notify, audit } = useApp();
  const can = canDo('cash.manage');
  const rev = cashReversed(cashEntries, e);
  const isRev = isCashReversal(e);
  const remain = e.amount - rev;
  const orig = isRev ? cashEntries.find((x) => x.id === e.reverses || (!e.reverses && x.source === 'SALE' && `${x.sourceId}-void` === e.sourceId)) : undefined;
  const revs = cashEntries.filter((r) => r.id !== e.id && (r.reverses === e.id || (!r.reverses && e.source === 'SALE' && !!e.sourceId && r.sourceId === `${e.sourceId}-void`)));
  const [date, setDate] = useState(e.date);
  const [note, setNote] = useState(e.note ?? '');
  const [why, setWhy] = useState('');
  const pids = e.payIds ?? (e.sourceId && !isRev ? [e.sourceId] : []);
  const refCodes = (e.ref ?? '').split(/,\s*/).filter(Boolean);
  const orders = e.source === 'SALE' ? salesOrders.filter((o) => refCodes.includes(o.code) || o.payments.some((p) => pids.includes(p.id)) || o.id === e.saleId) : [];
  const canVoid = can && e.source === 'SALE' && !isRev && remain > 0 && e.kind !== 'TRANSFER';
  const revPre = e.kind === 'IN' ? 'PCQ' : 'PTQ';
  const revCode = nextCode(cashEntries.filter((x) => x.code.startsWith(`${revPre}-`)).map((x) => x.code), `${revPre}-${todayISO().slice(0, 4)}-`, 4);
  const html = docShell(e.code, cashVoucherHtml(e, company, users.find((u) => u.id === e.by)?.name ?? ''));
  const status = isRev ? <Chip tone="red">Phiếu đảo</Chip> : rev >= e.amount ? <Chip tone="red">Đã hủy</Chip> : rev > 0 ? <Chip tone="orange">Hủy một phần</Chip> : <Chip tone="teal">Hiệu lực</Chip>;
  const auto = !!e.source && e.source !== 'MANUAL';
  const dirty = date !== e.date || note !== (e.note ?? '');
  const saveEdit = () => {
    setCashEntries((all) => all.map((x) => (x.id === e.id ? { ...x, date, note: note.trim() || undefined } : x)));
    if (e.source === 'SALE' && pids.length) setSalesOrders((all) => all.map((o) => (o.payments.some((p) => pids.includes(p.id)) ? { ...o, payments: o.payments.map((p) => (pids.includes(p.id) ? { ...p, date } : p)) } : o)));
    audit('CASH_EDIT', `${e.code}: ngày ${fmtDate(date)}, diễn giải "${note.trim()}"`);
    notify(`Đã lưu ${e.code}`, 'teal');
    onClose();
  };
  const doVoid = () => {
    if (why.trim().length < 3) return notify('Nhập lý do hủy', 'red');
    setSalesOrders((all) => all.map((o) => (o.payments.some((p) => pids.includes(p.id)) ? { ...o, payments: o.payments.filter((p) => !pids.includes(p.id)) } : o)));
    postCash({ kind: e.kind === 'IN' ? 'OUT' : 'IN', account: e.account, category: e.kind === 'IN' ? 'Hủy phiếu thu bán hàng' : 'Hủy phiếu hoàn tiền bán hàng', amount: remain, partner: e.partner, ref: e.code, note: `Hủy ${e.code}: ${why.trim()}`, source: 'SALE', sourceId: `${e.id}-void`, reverses: e.id, saleId: e.saleId });
    audit('CASH_VOID', `Hủy ${e.code} (${fmtN(remain)}): ${why.trim()}`, 'WARN');
    notify(`Đã hủy ${e.code}, sinh phiếu đảo ${revCode}`, 'orange');
    onClose();
  };
  const openSrc = (o: SalesOrder) => { onClose(); go('sales'); setOpenSale(o.id); };
  const paidOn = (o: SalesOrder) => o.payments.filter((p) => pids.includes(p.id)).reduce((s, p) => s + p.amount, 0);
  return (
    <Modal xl flush title={e.kind === 'IN' ? 'Phiếu thu' : e.kind === 'OUT' ? 'Phiếu chi' : 'Chuyển quỹ'} head={<><Code>{e.code}</Code>{status}{auto && <span className="rounded-md border border-[rgb(var(--line))] px-2 py-0.5 text-[12px] text-[rgb(var(--fg2))]">{isRev ? 'Phiếu đảo' : `Tự sinh · ${CASH_SRC[e.source ?? 'MANUAL']}`}</span>}</>} onClose={onClose} footer={<>
      <button className={cn(btnGhost, 'mr-auto')} onClick={() => printHtml(html)}><Printer className="h-4 w-4" aria-hidden />In / lưu PDF</button>
      <button className={btnGhost} onClick={onClose}>Đóng</button>
      {can && <button className={btnPrimary} disabled={!dirty} onClick={saveEdit}><CheckIcon className="h-4 w-4" aria-hidden />Lưu ngày, diễn giải</button>}
    </>}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        <div className="bg-[rgb(var(--ink)/0.04)] p-5"><iframe title={`Bản xem ${e.code}`} srcDoc={html} className="h-[460px] w-full rounded-lg border border-[rgb(var(--line))] bg-white" /></div>
        <div className="space-y-4 p-5">
          {(orders.length > 0 || e.jobId || orig || (e.ref && auto)) && (
            <div className="rounded-xl border border-[rgb(var(--line))] p-3.5">
              <p className="text-[12px] text-[rgb(var(--muted))]">Chứng từ gốc</p>
              {orig && <div className="mt-2 flex items-center gap-2"><p className="text-[13.5px]">Phiếu bị đảo <Code>{orig.code}</Code></p></div>}
              {orders.map((o) => (
                <div key={o.id} className="mt-2 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
                  <div className="min-w-0"><p className="text-[13.5px] font-medium">Đơn hàng <Code>{o.code}</Code></p><p className="truncate text-[12px] text-[rgb(var(--muted))]">{o.customer} · đã thu {fmtN(salePaid(o))} / {fmtN(saleOwed(o))}</p></div>
                  <button className={cn(btnGhost, btnSm, 'ml-auto shrink-0')} onClick={() => openSrc(o)}><ArrowRight className="h-3.5 w-3.5" aria-hidden />Mở</button>
                </div>
              ))}
              {e.jobId && <div className="mt-2 flex items-center gap-2"><p className="text-[13.5px]">Đơn hàng xưởng</p><button className={cn(btnGhost, btnSm, 'ml-auto')} onClick={() => { onClose(); openJob(e.jobId!); }}><ArrowRight className="h-3.5 w-3.5" aria-hidden />Mở</button></div>}
              {!orders.length && !e.jobId && !orig && e.ref && <p className="mt-1.5 text-[13.5px]">{CASH_SRC[e.source ?? 'MANUAL']} · {e.ref}</p>}
            </div>
          )}
          <div>
            <p className="text-[12px] text-[rgb(var(--muted))]">Thông tin phiếu</p>
            <CbKv a="Số tiền" b={<span className="inline-flex items-center gap-1.5">{fmtN(e.amount)}<Lock className="h-3 w-3 text-[rgb(var(--muted))]" aria-hidden /></span>} />
            <CbKv a="Quỹ" b={<span className="inline-flex items-center gap-1.5">{e.kind === 'TRANSFER' ? `${CASH_ACCOUNT[e.account]} → ${CASH_ACCOUNT[e.toAccount ?? 'BANK']}` : CASH_ACCOUNT[e.account]}<Lock className="h-3 w-3 text-[rgb(var(--muted))]" aria-hidden /></span>} />
            {e.partner && <CbKv a={e.kind === 'IN' ? 'Người nộp' : 'Người nhận'} b={e.partner} />}
            <CbKv a="Khoản mục" b={e.category} />
            {e.invNo && <CbKv a="Hóa đơn" b={`${e.invNo}${e.vatRate != null ? ` · ${e.vatRate}%` : ''}`} />}
          </div>
          <Field label="Ngày chứng từ"><input className={inputCls} type="date" value={date} disabled={!can} onChange={(x) => setDate(x.target.value)} /></Field>
          <Field label="Diễn giải"><input className={inputCls} value={note} disabled={!can} onChange={(x) => setNote(x.target.value)} /></Field>
          {e.files && e.files.length > 0 && <div className="flex flex-wrap gap-2"><CbFiles files={e.files} /></div>}
          {auto && <p className="text-[12px] text-[rgb(var(--muted))]">Số tiền, quỹ theo chứng từ gốc: muốn đổi thì hủy phiếu và lập lại</p>}
          {revs.length > 0 && <p className="text-[13px] text-[rgb(var(--fg2))]">Đã đảo bằng {revs.map((r) => <Code key={r.id} className="mx-0.5">{r.code}</Code>)} · {fmtN(rev)}</p>}
          {canVoid ? (
            <div className="rounded-xl border border-[rgb(var(--danger)/0.35)] bg-[rgb(var(--danger)/0.04)] p-3.5">
              <p className="font-medium">Hủy phiếu</p>
              <input className={cn(inputCls, 'mt-2')} value={why} onChange={(x) => setWhy(x.target.value)} placeholder="Lý do hủy" aria-label="Lý do hủy phiếu" />
              <div className="mt-2.5 space-y-1 text-[12.5px] text-[rgb(var(--fg2))]">
                <p>Sinh phiếu đảo <Code>{revCode}</Code> {e.kind === 'IN' ? '−' : '+'}{fmtN(remain)} vào {CASH_ACCOUNT[e.account].toLowerCase()}</p>
                {orders.filter((o) => paidOn(o) !== 0).map((o) => <p key={o.id}>Đơn <Code>{o.code}</Code>: đã thu {fmtN(salePaid(o))} → {fmtN(salePaid(o) - paidOn(o))}</p>)}
              </div>
              <button className={cn(btnPrimary, 'mt-3 w-full justify-center bg-[rgb(var(--danger))]')} disabled={why.trim().length < 3} onClick={doVoid}><XCircle className="h-4 w-4" aria-hidden />Hủy {e.kind === 'IN' ? 'phiếu thu' : 'phiếu chi'}</button>
            </div>
          ) : auto && !isRev && remain > 0 && e.source !== 'SALE' ? (
            <p className="rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[12.5px] text-[rgb(var(--fg2))]">Phiếu tự sinh từ {CASH_SRC[e.source ?? 'MANUAL'].toLowerCase()}: hủy ở chứng từ gốc để sổ quỹ và nghiệp vụ khớp nhau</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

export function CashbookModule() {
  const { cashEntries, setCashEntries, receipts, jobs, customers, mfgConfig, setMfgConfig, range, canDo, openJob, stockMoves, workOrders, activities, users, company, audit, notify } = useApp();
  const mode = bizMode(company);
  const [acc, setAcc] = useState<'ALL' | CashAccount>('CASH');
  const [tab, setTab] = useSticky<'book' | 'summary'>('CashbookModule.tab', 'book');
  const [kind, setKind] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [cat, setCat] = useState('ALL');
  const [partner, setPartner] = useState('ALL');
  const [q, setQ] = useSticky('CashbookModule.q', '');
  const [modal, setModal] = useState<{ kind: CashEntry['kind']; entry?: CashEntry; k?: number } | null>(null);
  const [view, setView] = useState<CashEntry | null>(null);
  useIntent('cash.in', () => setModal({ kind: 'IN' }));
  useIntent('cash.out', () => setModal({ kind: 'OUT' }));
  const [opening, setOpening] = useState<{ cash: number; bank: number } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const can = canDo('cash.manage');
  const { start, end } = rangeBounds(range);
  const fromISO = iso(new Date(start)), toISO = iso(new Date(end));
  const prevISO = iso(new Date(start - 864e5));
  const all = cashLines(cashEntries, receipts, jobs, customers, activities, users);
  const openOf = (a: CashAccount) => (a === 'CASH' ? mfgConfig.openingCash : mfgConfig.openingBank);
  const balance = (a: 'ALL' | CashAccount, until?: string): number => (a === 'ALL' ? balance('CASH', until) + balance('BANK', until)
    : openOf(a) + all.filter((l) => l.account === a && (!until || l.date <= until)).reduce((s, l) => s + (l.kind === 'IN' ? l.amount : -l.amount), 0));
  const inAcc = (l: CashLine) => (acc === 'ALL' ? l.category !== 'Chuyển quỹ' : l.account === acc);
  const period = all.filter((l) => l.date >= fromISO && l.date <= toISO && inAcc(l)).sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
  const openBal = balance(acc, prevISO);
  const sumIn = period.filter((l) => l.kind === 'IN').reduce((s, l) => s + l.amount, 0);
  const sumOut = period.filter((l) => l.kind === 'OUT').reduce((s, l) => s + l.amount, 0);
  const running = new Map<string, number>();
  period.reduce((b, l) => { const nb = b + (l.kind === 'IN' ? l.amount : -l.amount); running.set(l.id, nb); return nb; }, openBal);
  const cats = Array.from(new Set(period.map((l) => l.category))).sort();
  const partners = Array.from(new Set(period.map((l) => l.partner).filter((x): x is string => !!x))).sort();
  const t = q.trim().toLowerCase();
  const list = period.filter((l) => (kind === 'ALL' || l.kind === kind) && (cat === 'ALL' || l.category === cat) && (partner === 'ALL' || l.partner === partner)
    && (!t || `${l.code} ${l.category} ${l.partner ?? ''} ${l.note ?? ''} ${l.ref ?? ''}`.toLowerCase().includes(t)));
  const paged = usePaged(list, 25);
  const filtered = kind !== 'ALL' || cat !== 'ALL' || partner !== 'ALL' || !!t;
  const months = lastMonths(6).map((m) => ({
    name: m.label,
    Thu: all.filter((l) => inAcc(l) && l.kind === 'IN' && l.date.slice(0, 7) === m.key).reduce((s, l) => s + l.amount, 0),
    Chi: all.filter((l) => inAcc(l) && l.kind === 'OUT' && l.date.slice(0, 7) === m.key).reduce((s, l) => s + l.amount, 0),
  }));
  const byCat = Array.from(new Set(period.map((l) => `${l.kind}|${l.category}`))).map((k) => { const [kd, c] = k.split('|'); return { kd, c, v: period.filter((l) => l.kind === kd && l.category === c).reduce((s, l) => s + l.amount, 0), n: period.filter((l) => l.kind === kd && l.category === c).length }; })
    .sort((a, b) => (a.kd === b.kd ? b.v - a.v : a.kd === 'IN' ? -1 : 1));
  const jobRows = mode === 'TRADING' ? [] : jobs.filter((j) => j.wonAt && !j.lostAt).map((j) => {
    const thu = receipts.filter((r) => r.jobId === j.id && r.status === 'CONFIRMED').reduce((s, r) => s + r.amount, 0);
    const c = jobActualCost(j, stockMoves, cashEntries, workOrders);
    return { j, thu, ...c, net: thu - c.total };
  }).filter((r) => r.thu || r.total).sort((a, b) => b.thu - a.thu);
  const entryOf = (l: CashLine) => cashEntries.find((e) => e.id === l.entryId);
  const accLabel = acc === 'ALL' ? 'hai sổ' : CASH_ACCOUNT[acc].toLowerCase();
  const saveOpening = () => {
    if (!opening) return;
    setMfgConfig((c) => ({ ...c, openingCash: opening.cash, openingBank: opening.bank }));
    audit('CASH_OPENING', `Số dư đầu: tiền mặt ${vnd(opening.cash)}, ngân hàng ${vnd(opening.bank)}`, 'WARN');
    notify('Đã cập nhật số dư đầu', 'teal');
    setOpening(null);
  };
  return (
    <div className="space-y-4">
      <Tabs tabs={[{ id: 'book', label: 'Sổ chi tiết' }, { id: 'summary', label: mode === 'TRADING' ? 'Tổng hợp' : 'Tổng hợp & theo đơn hàng' }]} value={tab} onChange={setTab}
        aside={<>
          <button className={cn(btnGhost, btnSm, 'border-0')} disabled={!can} onClick={() => setModal({ kind: 'TRANSFER' })}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Chuyển quỹ</button>
          <button className={cn(btnGhost, btnSm, 'border-0')} disabled={!can} onClick={() => setOpening({ cash: mfgConfig.openingCash, bank: mfgConfig.openingBank })}><Pencil className="h-3.5 w-3.5" aria-hidden />Số dư đầu</button>
          <button className={cn(btnGhost, btnSm)} disabled={!can} onClick={() => setModal({ kind: 'IN' })}><Plus className="h-3.5 w-3.5" aria-hidden />Phiếu thu</button>
          <button className={cn(btnPrimary, btnSm)} disabled={!can} onClick={() => setModal({ kind: 'OUT' })}><Plus className="h-3.5 w-3.5" aria-hidden />Phiếu chi</button>
        </>} />
      <div className="flex w-fit max-w-full overflow-x-auto rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-0.5" role="radiogroup" aria-label="Sổ quỹ">
        {([['CASH', 'Tiền mặt'], ['BANK', 'Ngân hàng'], ['ALL', 'Cả 2 sổ']] as const).map(([k, label]) => (
          <button key={k} role="radio" aria-checked={acc === k} onClick={() => { setAcc(k); paged.setPage(1); }}
            className={cn('flex items-baseline gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px]', acc === k ? 'bg-[rgb(var(--raised))] font-medium text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>
            {label}<span className="font-mono text-[12px] text-[rgb(var(--muted))]">{compact(balance(k))}</span>
          </button>
        ))}
      </div>
      <div className="glass-card flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl px-5 py-4">
        {([['Đầu kỳ', openBal, ''], ['+', 0, 'op'], ['Thu', sumIn, `${period.filter((l) => l.kind === 'IN').length} phiếu`], ['−', 0, 'op'], ['Chi', sumOut, `${period.filter((l) => l.kind === 'OUT').length} phiếu`], ['=', 0, 'op']] as [string, number, string][]).map(([k, v, s], i) => (s === 'op'
          ? <span key={i} className="text-lg text-[rgb(var(--muted))]" aria-hidden>{k}</span>
          : <div key={i}><p className="text-[12px] text-[rgb(var(--muted))]">{k}</p><p className="text-base font-medium tabular-nums">{v.toLocaleString('vi-VN')}</p>{s && <p className="text-[11.5px] text-[rgb(var(--muted))]">{s}</p>}</div>))}
        <div><p className="text-[12px] text-[rgb(var(--muted))]">Cuối kỳ</p><p className={cn('text-xl font-medium tabular-nums', openBal + sumIn - sumOut < 0 && 'text-[rgb(var(--danger-fg))]')}>{(openBal + sumIn - sumOut).toLocaleString('vi-VN')}</p></div>
        <span className="ml-auto text-[12px] text-[rgb(var(--muted))]">{fmtDate(fromISO)} – {fmtDate(toISO)} · {accLabel}</span>
      </div>
      {tab === 'book' ? (
        <>
          <div className="tb40 flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchBox value={q} onChange={(v) => { setQ(v); paged.setPage(1); }} placeholder="Tìm số phiếu, diễn giải, chứng từ gốc" />
            <select className={cn(inputCls, 'py-1.5 text-[13px] lg:w-36')} value={kind} onChange={(e) => { setKind(e.target.value as 'ALL' | 'IN' | 'OUT'); paged.setPage(1); }} aria-label="Loại"><option value="ALL">Thu và chi</option><option value="IN">Chỉ thu</option><option value="OUT">Chỉ chi</option></select>
            <select className={cn(inputCls, 'py-1.5 text-[13px] lg:w-44')} value={cat} onChange={(e) => { setCat(e.target.value); paged.setPage(1); }} aria-label="Khoản mục"><option value="ALL">Mọi khoản mục</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <select className={cn(inputCls, 'py-1.5 text-[13px] lg:w-48')} value={partner} onChange={(e) => { setPartner(e.target.value); paged.setPage(1); }} aria-label="Đối tượng"><option value="ALL">Mọi đối tượng nộp / nhận</option>{partners.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <button className={cn(btnGhost, btnSm, 'justify-center border-0 lg:ml-auto')} onClick={() => downloadCsv(`so-quy-${acc}-${fromISO}-${toISO}.csv`, [['Ngày', 'Số phiếu', 'Sổ', 'Khoản mục', 'Đối tượng', 'Diễn giải', 'Chứng từ gốc', 'Thu', 'Chi', 'Tồn'], ...list.map((l) => [l.date, l.code, CASH_ACCOUNT[l.account], l.category, l.partner ?? '', l.note ?? '', l.ref ?? '', l.kind === 'IN' ? l.amount : '', l.kind === 'OUT' ? l.amount : '', acc === 'ALL' ? '' : running.get(l.id) ?? ''])])}><Download className="h-4 w-4" aria-hidden />CSV</button>
          </div>
          <Panel>
          <Table head={['Ngày', 'Số phiếu', 'Nguồn', 'Khoản mục', 'Diễn giải', 'Đối tượng', ...(acc === 'ALL' ? ['Sổ'] : []), <span key="t" className="block text-right">Thu</span>, <span key="c" className="block text-right">Chi</span>, 'Trạng thái', ...(acc === 'ALL' ? [] : [<span key="b" className="block text-right">Tồn</span>])]} minW={1040} stt={false} select={false}>
            {paged.page === 1 && !filtered && (
              <tr className="border-b border-[rgb(var(--line)/0.6)] bg-[rgb(var(--raised)/0.5)]">
                <td className={cn(tdFirst, 'font-mono text-xs')}>{fmtDate(fromISO)}</td>
                {acc === 'ALL'
                  ? <td className={cn(tdLast, 'font-medium')} colSpan={9}>Số dư đầu kỳ hai sổ: <span className="tabular-nums">{openBal.toLocaleString('vi-VN')}</span></td>
                  : <><td className={cn(tdCls, 'font-medium')} colSpan={8}>Số dư đầu kỳ</td><td className={cn(tdLast, 'text-right font-semibold tabular-nums')}>{openBal.toLocaleString('vi-VN')}</td></>}
              </tr>
            )}
            {paged.slice.map((l) => {
              const e = entryOf(l);
              const manual = !!e && (!e.source || e.source === 'MANUAL') && !isCashReversal(e);
              const isRev = !!e && isCashReversal(e);
              const rv = e && !isRev ? cashReversed(cashEntries, e) : 0;
              const dead = !!e && rv >= e.amount && rv > 0;
              const src = e?.kind === 'TRANSFER' ? 'Chuyển quỹ' : isRev ? 'Phiếu đảo' : CASH_SRC[l.source ?? 'MANUAL'];
              const srcRef = isRev ? e?.ref : l.source === 'SALE' ? l.ref : l.auto && l.ref !== l.code ? l.ref : undefined;
              return (
                <tr key={l.id} className={cn(rowCls, (e || l.jobId) && 'cursor-pointer hover:bg-[rgb(var(--ink)/0.03)]', dead && 'text-[rgb(var(--muted))]')} onClick={() => { if (!e) { if (l.jobId) openJob(l.jobId); return; } if (manual && can) setModal({ kind: e.kind, entry: e }); else setView(e); }}>
                  <td className={cn(tdFirst, 'whitespace-nowrap font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(l.date)}</td>
                  <td className={tdCls}><Code className={dead ? 'line-through' : undefined}>{l.code}</Code></td>
                  <td className={tdCls}><span className="inline-flex max-w-[170px] items-center gap-1.5"><span className={cn('whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11.5px]', isRev ? 'border-[rgb(var(--danger)/0.3)] text-[rgb(var(--danger-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--fg2))]')}>{src}</span>{srcRef && <span className="truncate font-mono text-[11.5px] text-[rgb(var(--muted))]" title={srcRef}>{srcRef}</span>}</span></td>
                  <td className={tdCls}><span className="font-medium">{l.category}</span></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[170px] truncate" title={l.note}>{l.note || '—'}</span></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[150px] truncate" title={l.partner}>{l.partner ?? '—'}</span></td>
                  {acc === 'ALL' && <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{l.account === 'CASH' ? 'Tiền mặt' : 'Ngân hàng'}</td>}
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums', !dead && 'text-[rgb(var(--success-fg))]')}>{l.kind === 'IN' ? l.amount.toLocaleString('vi-VN') : ''}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums', !dead && 'text-[rgb(var(--danger-fg))]')}>{l.kind === 'OUT' ? l.amount.toLocaleString('vi-VN') : ''}</td>
                  <td className={acc === 'ALL' ? tdLast : tdCls}>{isRev ? <Chip tone="muted">Phiếu đảo</Chip> : dead ? <Chip tone="red">Đã hủy</Chip> : rv > 0 ? <Chip tone="orange">Hủy một phần</Chip> : <Chip tone="teal">Hiệu lực</Chip>}</td>
                  {acc !== 'ALL' && <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums', (running.get(l.id) ?? 0) < 0 && 'text-[rgb(var(--danger-fg))]')}>{(running.get(l.id) ?? 0).toLocaleString('vi-VN')}</td>}
                </tr>
              );
            })}
            {list.length > 0 && (
              <tr className="border-t border-[rgb(var(--line))] font-semibold">
                <td className={tdFirst} colSpan={acc === 'ALL' ? 7 : 6}>{filtered ? 'Cộng các dòng đang lọc' : 'Cộng phát sinh trong kỳ'}</td>
                <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--success-fg))]')}>{list.filter((l) => l.kind === 'IN').reduce((s, l) => s + l.amount, 0).toLocaleString('vi-VN')}</td>
                <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--danger-fg))]')}>{list.filter((l) => l.kind === 'OUT').reduce((s, l) => s + l.amount, 0).toLocaleString('vi-VN')}</td>
                <td className={acc === 'ALL' ? tdLast : tdCls} />
                {acc !== 'ALL' && <td className={cn(tdLast, 'text-right tabular-nums')}>{filtered ? '' : (openBal + sumIn - sumOut).toLocaleString('vi-VN')}</td>}
              </tr>
            )}
          </Table>
          {!list.length && <EmptyState text={<>Không có phát sinh trong kỳ.</>} art="ledger" />}
          <Pagination paged={paged} unit="dòng" />
        </Panel>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title={`Thu chi 6 tháng (${accLabel})`}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid stroke={C.line} vertical={false} />
                  <XAxis dataKey="name" stroke={C.muted} fontSize={12} />
                  <YAxis stroke={C.muted} fontSize={11} tickFormatter={(v) => compact(Number(v))} width={64} />
                  <Tooltip {...tipStyle} formatter={(v) => vnd(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Thu" fill={C.teal} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Chi" fill={C.red} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Theo khoản mục (trong kỳ)">
            <Table head={['Khoản mục', 'Loại', 'Số phiếu', <span key="v" className="block text-right">Số tiền</span>]} minW={460}>
              {byCat.map((r) => (
                <tr key={`${r.kd}${r.c}`} className={rowCls}>
                  <td className={tdFirst}>{r.c}</td>
                  <td className={tdCls}><Chip tone={r.kd === 'IN' ? 'teal' : 'red'}>{r.kd === 'IN' ? 'Thu' : 'Chi'}</Chip></td>
                  <td className={cn(tdCls, 'tabular-nums')}>{r.n}</td>
                  <td className={cn(tdLast, 'text-right tabular-nums')}>{vnd(r.v)}</td>
                </tr>
              ))}
            </Table>
          </Panel>
          {jobRows.length > 0 && (
            <Panel title="Dòng tiền theo đơn hàng" className="xl:col-span-2">
              <Table head={['STT', 'Đơn hàng', 'Giá trị HĐ', 'Đã thu (xác nhận)', 'Vật tư xuất kho', 'Chi phí khác', 'Chênh lệch thu - chi']} minW={980}>
                {jobRows.map((r, i) => (
                  <tr key={r.j.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => openJob(r.j.id)}>
                    <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{i + 1}</td>
                    <td className={tdCls}><p className="font-medium">{jobCustName(r.j, customers)}</p><p className="text-xs text-[rgb(var(--muted))]">{r.j.code}, {r.j.title}</p></td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.j.contractValue ?? 0)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums text-[rgb(var(--success-fg))]')}>{compact(r.thu)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.material)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.other)}</td>
                    <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums font-semibold', r.net < 0 ? 'text-[rgb(var(--danger-fg))]' : '')}>{compact(r.net)}</td>
                  </tr>
                ))}
              </Table>
            </Panel>
          )}
        </div>
      )}
      {view && <CashViewModal e={view} onClose={() => setView(null)} />}
      {modal && <CashEntryModal key={modal.k ?? 0} kind={modal.kind} entry={modal.entry} bal={(a) => balance(a)} onClose={() => setModal(null)} onAgain={() => setModal({ kind: modal.kind, k: Date.now() })} onDelete={modal.entry ? () => setConfirm({ title: `Xóa ${modal.entry!.code}`, message: 'Xóa phiếu này khỏi sổ quỹ?', onConfirm: () => { removeWithUndo(setCashEntries, modal.entry!, notify, `Đã xóa phiếu ${modal.entry!.code}`); setModal(null); } }) : undefined} />}
      {opening && (
        <Modal title="Số dư đầu sổ quỹ" onClose={() => setOpening(null)} footer={<><button className={btnGhost} onClick={() => setOpening(null)}>Hủy</button><button className={btnPrimary} onClick={saveOpening}>Lưu</button></>}>
          <div className="space-y-3">
            <Field label="Quỹ tiền mặt"><MoneyInput value={opening.cash} onChange={(n) => setOpening({ ...opening, cash: n })} /></Field>
            <Field label="Tài khoản ngân hàng"><MoneyInput value={opening.bank} onChange={(n) => setOpening({ ...opening, bank: n })} /></Field>
            <p className="text-xs text-[rgb(var(--muted))]">Số dư tại ngày bắt đầu dùng sổ; số dư đầu từng kỳ hệ thống tự tính từ đây.</p>
          </div>
        </Modal>
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

