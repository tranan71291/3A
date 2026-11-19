'use client';

import { type ReactNode, useState } from 'react';
import { ArrowRight, Banknote, CalendarDays, Camera, CheckCircle2, Download, Factory, FileText, Inbox, MapPin, MessageSquare, Pencil, Plus, Ruler, Search, Target, Trash2, Upload } from 'lucide-react';
import { useIntent } from '../../components/command-palette';
import { CommentButton } from '../../components/comments';
import { Fab, Pagination, usePaged } from '../../components/controls';
import { Drawer } from '../../components/drawer';
import { useInRange } from '../../components/filters';
import { Sla } from '../../components/sla';
import { Chip, Code, EmptyState, Field, FilePicker, Modal, MoneyInput, Panel, StatCard, Table, Tabs, useSort, useSticky } from '../../components/ui';
import { btnBase, btnGhost, btnPrimary, btnSm, C, compact, DESIGN_STATUS, digits, esc, fmtDate, fmtDT, holdingOverdue, inputCls, iso, JOB_LOST, JOB_STAGE, JOB_STAGES, jobCustName, jobPhone, kpiGrid, lineAmount, lineDims, needsCare, nextCode, PAY_TRIGGER, pct, phoneKey, PRICE_UNIT, RECEIPT_STATUS, rowCls, secHead, tdCls, tdFirst, tdLast, techUsers, todayISO, toLocal, uid, useApp, vnd, WO_STAGE } from '../../lib/core';
import type { CompanyInfo, Customer, InstallJob, Job, JobCare, JobFile, JobFilter, JobLine, JobLostReason, JobQuote, MfgConfig, PayStage, PriceItem, PriceUnit, Receipt, Tone, User, WorkOrder } from '../../lib/types';
import { cn } from '../../lib/utils';
import { compressImage, dueByStage, jobActualCost, jobDetailOf, jobMoney, jobStageOf, lineMeasure, quoteTotalsOf, receiptCash } from '../../lib/workshop';
import { InstallScheduleModal } from './install';
import { CommissionPanel } from '../finance/commission';
import { ComposerShell, DocActionBar, docShell, downloadWord, Fold, moneyToWordsVN, printHtml, useGridKeys } from '../sales/templates';

// =====================================================================
//  MÔ HÌNH XƯỞNG (quy trình rút gọn)
//  Thêm lead = đơn "Đang chờ khảo sát" -> Tạo báo giá -> Nhận cọc (tự tạo lệnh sản xuất)
//  -> Sản xuất: chờ / đang / hoàn thành -> Hẹn lắp đặt -> Nghiệm thu, bàn giao, ký điện tử, thu tiền, bảo hành
//  Doanh số ghi nhận khi Kế toán xác nhận đã nhận tiền.
// =====================================================================

/** Bộ dữ liệu suy ra cho từng đơn: giai đoạn, trạng thái chi tiết, tiền, lệnh SX, lắp đặt */
export function useJobInfo() {
  const { workOrders, installJobs, receipts } = useApp();
  return (j: Job) => {
    const stage = jobStageOf(j, workOrders, installJobs, receipts);
    return {
      stage, detail: jobDetailOf(j, stage, workOrders, installJobs, receipts), money: jobMoney(j, receipts),
      wo: workOrders.find((w) => w.jobId === j.id), installs: installJobs.filter((i) => i.jobId === j.id), due: dueByStage(j, stage),
    };
  };
}

/** Phạm vi xem đơn: BOD / Kế toán / MKT xem hết; Trưởng phòng xem phòng mình; nhân viên xem đơn mình phụ trách hoặc đội lắp */
export function useJobScope() {
  const { me, role, installJobs } = useApp();
  return (j: Job) => role === 'BOD' || role === 'ACCOUNTANT' || role === 'MKT_LEAD' || role === 'DEPT_HEAD' || j.ownerId === me.id || j.createdBy === me.id
    || installJobs.some((i) => i.jobId === j.id && (i.leaderId === me.id || i.team.includes(me.id)));
}

/** Lệnh sản xuất tạo tự động khi nhận cọc: hạng mục, kích thước lấy từ báo giá khách chốt */
export function buildWorkOrder(j: Job, q: JobQuote, custName: string, code: string, leaderId: string | undefined, by: string, days: number, note: string): WorkOrder {
  return {
    id: uid('wo'), code, title: `${j.title} (${custName})`, customerId: j.customerId, leadId: j.leadId, jobId: j.id, stage: 'WAITING', priority: 'NORMAL',
    startDate: todayISO(), dueDate: iso(new Date(Date.now() + days * 864e5)), leaderId,
    items: q.lines.map((l) => ({ id: uid('wi'), name: `${l.location ? `${l.location}: ` : ''}${l.name}`, spec: lineDims(l), unit: l.unit === 'MD' ? 'md' : l.unit === 'PCS' ? 'cái' : 'bộ', qty: l.unit === 'MD' ? Math.round(l.length * l.qty * 100) / 100 : l.qty, done: 0 })),
    materials: [], qc: [], note, history: [{ stage: 'WAITING', at: Date.now(), by, note: `Nhận cọc đơn ${j.code}` }], createdAt: todayISO(), createdBy: by,
  };
}

export function newCustomerRec(p: { name: string; phone: string; address: string; segment: string; sourceId: string; ownerId?: string; dept?: string; note?: string }, existing: Customer[]): Customer {
  return {
    id: uid('k'), code: nextCode(existing.map((c) => c.code), 'KH-', 6), name: p.name.trim(), taxCode: '', segment: p.segment, tier: '', region: 'SOUTH', dept: p.dept ?? '', amId: p.ownerId,
    sourceId: p.sourceId, status: 'PROSPECT', createdAt: todayISO(), contactName: p.name.trim(), contactTitle: p.note ?? '', contactPhone: p.phone.trim(), contactEmail: '', address: p.address.trim(),
    creditLimit: 0, debt: 0, ytdRevenue: 0, lastYearRevenue: 0,
  };
}

// ---------------- Phiếu thu ----------------

export function ReceiptModal({ job, amount, stageId, title, onClose, onSaved }: { job: Job; amount: number; stageId?: string; title: string; onClose: () => void; onSaved?: (r: Receipt) => void }) {
  const { me, receipts, setReceipts, notify, dispatch, users, audit, mfgConfig } = useApp();
  const [amt, setAmt] = useState(amount);
  const [method, setMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const save = () => {
    if (amt <= 0) return notify('Nhập số tiền thu', 'red');
    if (method === 'TRANSFER' && !photo) return notify('Chuyển khoản: chụp màn hình giao dịch để kế toán đối chiếu', 'red');
    const r: Receipt = {
      id: uid('rc'), code: nextCode(receipts.map((x) => x.code), `PT-${new Date().getFullYear()}-`, 4), jobId: job.id, stageId, amount: amt, method,
      collectedBy: me.id, collectedAt: Date.now(), photo, note: note.trim() || undefined,
      status: method === 'CASH' ? 'HOLDING' : 'SUBMITTED', submittedAt: method === 'CASH' ? undefined : Date.now(),
    };
    setReceipts((p) => [r, ...p]);
    audit('RECEIPT_CREATE', `${r.code}: thu ${vnd(amt)} ${method === 'CASH' ? 'tiền mặt' : 'chuyển khoản'} đơn ${job.code}`);
    const acc = users.filter((u) => u.active && u.role === 'ACCOUNTANT');
    if (method === 'TRANSFER') acc.forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title: `Chờ xác nhận ${r.code}: ${vnd(amt)}`, body: `Chuyển khoản đơn ${job.code} ${job.title}`, module: 'tasks' }));
    notify(method === 'CASH' ? `Đã lập ${r.code}. Nộp ${vnd(amt)} tiền mặt về kế toán trong ${mfgConfig.submitHours} giờ.` : `Đã lập ${r.code}, chờ kế toán đối chiếu sao kê.`, 'teal');
    onSaved?.(r);
    onClose();
  };
  return (
    <Modal title={title} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} disabled={busy} onClick={save}><Banknote className="h-4 w-4" aria-hidden />Lập phiếu thu</button></>}>
      <p className="mb-3 text-sm text-[rgb(var(--muted))]">{job.code}: {job.title}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Số tiền thu"><MoneyInput value={amt} onChange={setAmt} /></Field>
        <Field label="Hình thức">
          <div className="flex rounded bg-[rgb(var(--bg))] p-0.5" role="radiogroup" aria-label="Hình thức">
            {(['CASH', 'TRANSFER'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={cn('flex-1 rounded-md px-3 py-2 text-sm font-medium', method === m ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))]')}>{m === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</button>)}
          </div>
        </Field>
        <Field label="Ghi chú" className="sm:col-span-2"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Khách chuyển khoản Vietcombank, nội dung ALUX DH-0012" /></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <FilePicker accept="image/*" disabled={busy} onFiles={(f) => { setBusy(true); compressImage(f[0], 1000).then(setPhoto).catch(() => notify('Không đọc được ảnh', 'red')).finally(() => setBusy(false)); }} className={cn(btnGhost, btnSm, 'inline-flex')}><Upload className="h-3.5 w-3.5" aria-hidden />{photo ? 'Đổi ảnh' : method === 'TRANSFER' ? 'Ảnh chuyển khoản *' : 'Ảnh phiếu thu / tiền (tùy chọn)'}</FilePicker>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="Chứng từ" className="h-16 rounded-md object-cover" />}
      </div>
      <p className="mt-3 text-xs text-[rgb(var(--muted))]">{method === 'CASH' ? `Tiền mặt ghi "nhân viên đang giữ" đến khi nộp về kế toán (hạn ${mfgConfig.submitHours} giờ).` : 'Chuyển khoản chờ kế toán đối chiếu sao kê.'} Doanh số chỉ ghi nhận khi kế toán xác nhận.</p>
    </Modal>
  );
}

/** Thao tác trên phiếu thu: người thu nộp tiền, kế toán xác nhận / từ chối */
export function ReceiptActions({ r, job }: { r: Receipt; job?: Job }) {
  const { me, canDo, setReceipts, notify, logDecision, users, dispatch, audit, postCash, customers } = useApp();
  const patch = (p: Partial<Receipt>) => setReceipts((all) => all.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
  const title = `${r.code}: ${vnd(r.amount)}${job ? `, ${job.code}` : ''}`;
  const confirm = () => {
    patch({ status: 'CONFIRMED', confirmedBy: me.id, confirmedAt: Date.now(), submittedAt: r.submittedAt ?? Date.now() });
    postCash(receiptCash(r, job, customers));
    logDecision({ kind: 'RECEIPT', refId: r.id, title, requesterId: r.collectedBy, decision: 'APPROVED', amount: r.amount });
    notify(`Đã xác nhận ${r.code}, ghi nhận doanh số ${vnd(r.amount)}`, 'teal');
  };
  const reject = () => {
    const n = window.prompt('Lý do từ chối (sai số tiền, chưa thấy tiền về...)');
    if (!n || n.trim().length < 3) return;
    patch({ status: 'REJECTED', rejectNote: n.trim() });
    logDecision({ kind: 'RECEIPT', refId: r.id, title, requesterId: r.collectedBy, decision: 'REJECTED', note: n.trim(), amount: r.amount });
    const u = users.find((x) => x.id === r.collectedBy);
    if (u) dispatch('APPROVAL_RESULT', { to: u, title: `Kế toán từ chối ${r.code}`, body: n.trim(), module: 'jobs' });
  };
  return (
    <span className="flex flex-wrap gap-1.5">
      {r.status === 'HOLDING' && (r.collectedBy === me.id || canDo('receipt.confirm')) && (
        <button className={cn(btnGhost, btnSm)} onClick={() => { patch({ status: 'SUBMITTED', submittedAt: Date.now() }); audit('CASH_SUBMIT', `${r.code}: nộp ${vnd(r.amount)} về kế toán`); notify(`Đã ghi nhận nộp ${vnd(r.amount)}, chờ kế toán xác nhận`, 'teal'); }}>Đã nộp kế toán</button>
      )}
      {(r.status === 'SUBMITTED' || r.status === 'HOLDING') && canDo('receipt.confirm') && r.collectedBy !== me.id && (
        <>
          <button className={cn(btnBase, btnSm, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))]')} onClick={confirm}>Xác nhận đã nhận</button>
          <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))]')} onClick={reject}>Từ chối</button>
        </>
      )}
    </span>
  );
}

export function ReceiptList({ job }: { job: Job }) {
  const { receipts, userName, now, mfgConfig } = useApp();
  const list = receipts.filter((r) => r.jobId === job.id).sort((a, b) => b.collectedAt - a.collectedAt);
  if (!list.length) return <p className="text-sm text-[rgb(var(--muted))]">Chưa có phiếu thu.</p>;
  return (
    <ul className="space-y-2">
      {list.map((r) => {
        const late = holdingOverdue(r, now ?? Date.now(), mfgConfig.submitHours);
        return (
          <li key={r.id} className={cn('rounded border bg-[rgb(var(--raised))] p-3 text-sm', late ? 'border-[rgb(var(--danger)/0.6)]' : 'border-transparent')}>
            <div className="flex flex-wrap items-center gap-2">
              <b className="tabular-nums">{vnd(r.amount)}</b>
              <span className="text-xs text-[rgb(var(--muted))]">{r.code}, {r.method === 'CASH' ? 'tiền mặt' : 'chuyển khoản'}, {userName(r.collectedBy)} thu {new Date(r.collectedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>
              <span className="ml-auto"><Chip tone={late ? 'red' : RECEIPT_STATUS[r.status].tone}>{late ? 'Quá hạn nộp' : RECEIPT_STATUS[r.status].label}</Chip></span>
            </div>
            {r.note && <p className="mt-1 text-xs text-[rgb(var(--muted))]">{r.note}</p>}
            {r.rejectNote && <p className="mt-1 text-xs text-[rgb(var(--danger-fg))]">Từ chối: {r.rejectNote}</p>}
            {r.status === 'CONFIRMED' && <p className="mt-1 text-xs text-[rgb(var(--success-fg))]">Kế toán {userName(r.confirmedBy)} xác nhận {r.confirmedAt ? new Date(r.confirmedAt).toLocaleString('vi-VN') : ''}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.photo && <a href={r.photo} target="_blank" rel="noreferrer"><img src={r.photo} alt="Chứng từ" className="h-10 rounded object-cover" /></a>}
              <ReceiptActions r={r} job={job} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------- Tạo đơn hàng ----------------

// ---------------- Báo giá in (PDF) ----------------

export function jobQuoteHtml(job: Job, q: JobQuote, company: CompanyInfo, cust: Customer | undefined, owner: User | undefined, cfg: MfgConfig) {
  const rows = q.lines.map((l, i) => `<tr><td class="c">${i + 1}</td><td><b>${esc(l.name)}</b>${l.location ? `<br><span class="small">${esc(l.location)}</span>` : ''}</td><td class="c">${esc(lineDims(l))}</td><td class="r">${l.qty}</td><td class="r">${lineMeasure(l).toLocaleString('vi-VN')} ${PRICE_UNIT[l.unit].short}</td><td class="r">${Math.round(l.unitPrice * (1 - l.discountPct / 100)).toLocaleString('vi-VN')}</td><td class="r">${lineAmount(l).toLocaleString('vi-VN')}</td></tr>`).join('');
  const pay = job.schedule.map((s) => `<li>${esc(s.label)}: ${s.pct}% (${Math.round((q.total * s.pct) / 100).toLocaleString('vi-VN')} đ), ${PAY_TRIGGER[s.trigger].toLowerCase()}</li>`).join('');
  const valid = new Date(Date.parse(q.at) + cfg.quoteValidDays * 864e5);
  return `<table class="layout"><tr><td><b>${esc(company.legalName)}</b><br>${esc(company.address)}<br>ĐT: ${esc(company.phone)}</td><td class="r">Số: <b>${esc(job.code)}-BG${q.version}</b><br>Ngày: ${fmtDate(q.at.slice(0, 10))}</td></tr></table>
<h1>BÁO GIÁ THI CÔNG</h1>
<p>Kính gửi: <b>${esc(cust?.name ?? job.siteContact ?? '')}</b>, ĐT ${esc(job.sitePhone ?? cust?.contactPhone ?? '')}<br>Công trình: ${esc(job.title)}<br>Địa chỉ: ${esc(job.siteAddress)}</p>
<table class="items"><thead><tr><th>STT</th><th>Hạng mục</th><th>Kích thước</th><th>SL</th><th>Khối lượng</th><th>Đơn giá (đ)</th><th>Thành tiền (đ)</th></tr></thead><tbody>${rows}
<tr><td colspan="6" class="r">Cộng</td><td class="r">${q.subtotal.toLocaleString('vi-VN')}</td></tr>
${q.vatPct ? `<tr><td colspan="6" class="r">VAT ${q.vatPct}%</td><td class="r">${(q.total - q.subtotal).toLocaleString('vi-VN')}</td></tr>` : ''}
<tr><td colspan="6" class="r"><b>Tổng cộng${q.vatPct ? '' : ' (chưa gồm VAT)'}</b></td><td class="r"><b>${q.total.toLocaleString('vi-VN')}</b></td></tr></tbody></table>
<p><b>Bằng chữ:</b> <i>${moneyToWordsVN(q.total)}</i></p>
<h3>Thanh toán</h3><ul>${pay}</ul>
<p>Bảo hành ${job.warrantyMonths} tháng. Khối lượng m² tính theo kích thước thực tế, tối thiểu theo quy định từng hạng mục. Báo giá có hiệu lực đến ${valid.toLocaleDateString('vi-VN')}.</p>
${q.note ? `<p>Ghi chú: ${esc(q.note)}</p>` : ''}
<table class="layout sign"><tr><td><b>KHÁCH HÀNG XÁC NHẬN</b><br><br><br><br></td><td><b>NGƯỜI LẬP BÁO GIÁ</b><br><br><br><br><b>${esc(owner?.name ?? '')}</b><br>${esc(owner?.phone ?? '')}</td></tr></table>`;
}

/** Ô thông tin dạng nhãn trên / giá trị dưới, dùng chung trong ngăn chi tiết */
export function InfoGrid({ rows }: { rows: [string, ReactNode, boolean?][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {rows.map(([k, v, wide]) => (
        <div key={k} className={cn('min-w-0', wide && 'sm:col-span-2')}>
          <dt className="text-xs text-[rgb(var(--muted))]">{k}</dt>
          <dd className="mt-0.5 break-words text-[rgb(var(--fg))]">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Ô số liệu nhỏ (giá trị HĐ, đã thu...) */
export function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'teal' | 'orange' | 'red' }) {
  return (
    <div className="rounded bg-[rgb(var(--raised))] p-2.5">
      <p className="text-[11px] text-[rgb(var(--muted))]">{label}</p>
      <p className={cn('mt-0.5 font-semibold tabular-nums', tone === 'teal' && 'text-[rgb(var(--success-fg))]', tone === 'orange' && 'text-[rgb(var(--accent-fg))]', tone === 'red' && 'text-[rgb(var(--danger-fg))]')}>{value}</p>
    </div>
  );
}

/** Thanh chọn trạng thái dạng viên, có số đếm */
export function StagePills<T extends string>({ items, value, onChange }: { items: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="tablist">
      {items.map((s) => (
        <button key={s.id} role="tab" aria-selected={value === s.id} onClick={() => onChange(s.id)}
          className={cn('flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[13px]', value === s.id ? 'border-[rgb(var(--ink)/0.14)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] shadow-sm' : 'border-transparent text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>
          {s.label}{s.count !== undefined && <span className="font-mono text-[11.5px] font-normal text-[rgb(var(--muted))]">{s.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Ô tìm kiếm dùng chung */
export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden />
      <input className={cn(inputCls, 'bg-[rgb(var(--surface))] py-1.5 pl-9 text-[13.5px]')} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

// ---------------- Thêm lead (bước 1) = tạo đơn chờ khảo sát ----------------

export function MfgLeadForm({ job, onClose }: { job?: Job; onClose: () => void }) {
  const { me, customers, setCustomers, jobs, setJobs, users, segments, sources, mfgConfig, notify, openJob, audit, dispatch } = useApp();
  const cust0 = customers.find((c) => c.id === job?.customerId);
  const techs = techUsers(users);
  const defAt = (() => { const d = new Date(Date.now() + 864e5); d.setHours(9, 0, 0, 0); return toLocal(d); })();
  const [f, setF] = useState({
    name: job?.siteContact ?? cust0?.name ?? '', phone: job?.sitePhone ?? cust0?.contactPhone ?? '', address: job?.siteAddress ?? '', title: job?.title ?? '',
    appointmentAt: job?.appointmentAt ?? defAt, ownerId: job?.ownerId ?? (techs.some((u) => u.id === me.id) ? me.id : techs[0]?.id ?? ''),
    sourceId: cust0?.sourceId ?? sources[0]?.id ?? '', segment: cust0?.segment ?? segments[0]?.code ?? 'OTHER', note: job?.note ?? '',
  });
  const [touched, setTouched] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const match = !job && phoneKey(f.phone).length >= 9 ? customers.find((c) => phoneKey(c.contactPhone) === phoneKey(f.phone)) : undefined;
  const matchJobs = match ? jobs.filter((j) => j.customerId === match.id).length : 0;
  const errs: Record<string, string> = {};
  if (f.name.trim().length < 2) errs.name = 'Nhập tên khách hàng';
  if (phoneKey(f.phone).length < 9) errs.phone = 'Số điện thoại chưa đúng';
  if (f.address.trim().length < 5) errs.address = 'Nhập địa chỉ công trình';
  if (f.title.trim().length < 3) errs.title = 'Nhập hạng mục cần làm';
  if (!f.appointmentAt) errs.appointmentAt = 'Chọn ngày giờ hẹn khảo sát';
  const err = (k: string) => (touched ? errs[k] : undefined);
  const save = () => {
    setTouched(true);
    if (Object.keys(errs).length) return;
    const owner = users.find((u) => u.id === f.ownerId);
    if (job) {
      setJobs((all) => all.map((x) => (x.id === job.id ? { ...x, siteContact: f.name.trim(), sitePhone: f.phone.trim(), siteAddress: f.address.trim(), title: f.title.trim(), appointmentAt: f.appointmentAt, ownerId: f.ownerId, dept: owner?.dept ?? x.dept, note: f.note.trim() } : x)));
      setCustomers((all) => all.map((c) => (c.id === job.customerId ? { ...c, sourceId: f.sourceId, segment: f.segment } : c)));
      notify('Đã cập nhật thông tin đơn', 'teal');
      onClose();
      return;
    }
    let c = match;
    if (!c) {
      c = { ...newCustomerRec({ name: f.name, phone: f.phone, address: f.address, segment: f.segment, sourceId: f.sourceId, ownerId: f.ownerId, dept: owner?.dept }, customers), contactTitle: '' };
      const nc = c;
      setCustomers((p) => [...p, nc]);
    }
    const id = uid('jb');
    const nj: Job = {
      id, code: nextCode(jobs.map((j) => j.code), `DH-${new Date().getFullYear()}-`, 4), title: f.title.trim(), customerId: c.id, ownerId: f.ownerId, dept: owner?.dept,
      siteAddress: f.address.trim(), siteContact: f.name.trim(), sitePhone: f.phone.trim(), appointmentAt: f.appointmentAt,
      draft: [], vatPct: mfgConfig.vatPct, quotes: [], files: [], surveyCheckins: [], schedule: mfgConfig.schedule.map((x) => ({ ...x })),
      warrantyMonths: mfgConfig.warrantyMonths, note: f.note.trim(), createdAt: todayISO(), createdBy: me.id, care: [],
    };
    setJobs((p) => [nj, ...p]);
    if (owner && owner.id !== me.id) dispatch('APPROVAL_RESULT', { to: owner, title: `Lịch khảo sát mới: ${f.name.trim()}`, body: `${fmtDT(f.appointmentAt)}, ${f.address.trim()}. Hạng mục: ${f.title.trim()}`, module: 'jobs' });
    audit('LEAD_CREATE', `Lead ${f.name.trim()} ${f.phone.trim()} -> ${nj.code} chờ khảo sát`);
    notify(`Đã thêm lead, chuyển "Đang chờ khảo sát" (${nj.code}), giao ${owner?.name ?? 'kỹ thuật'}`, 'teal');
    onClose();
    openJob(id);
  };
  return (
    <Modal title={job ? `Sửa thông tin ${job.code}` : 'Thêm lead'} onClose={onClose} wide
      footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>{job ? 'Lưu' : 'Thêm lead, chuyển khảo sát'}</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tên khách hàng *" error={err('name')}><input className={inputCls} value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="VD: Anh Nguyễn Văn A" autoFocus /></Field>
        <Field label="Số điện thoại *" error={err('phone')} hint={match ? `Khách cũ: ${match.name}, ${matchJobs} đơn trước. Đơn mới gắn vào khách này.` : undefined}>
          <input type="tel" autoComplete="tel" className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="09xx xxx xxx" />
        </Field>
        <Field label="Địa chỉ công trình *" error={err('address')} className="sm:col-span-2"><input className={inputCls} value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Số nhà, đường, phường, quận" /></Field>
        <Field label="Hạng mục *" error={err('title')} className="sm:col-span-2"><input className={inputCls} value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="VD: Cửa nhôm Xingfa, lan can kính, tủ bếp" /></Field>
        <Field label="Thời gian hẹn khảo sát *" error={err('appointmentAt')}><input className={inputCls} type="datetime-local" value={f.appointmentAt} onChange={(e) => set({ appointmentAt: e.target.value })} /></Field>
        <Field label="Kỹ thuật khảo sát">
          <select className={inputCls} value={f.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>{techs.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        </Field>
        <Field label="Nguồn khách">
          <select className={inputCls} value={f.sourceId} onChange={(e) => set({ sourceId: e.target.value })}>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </Field>
        <Field label="Loại khách">
          <select className={inputCls} value={f.segment} onChange={(e) => set({ segment: e.target.value })}>{segments.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select>
        </Field>
        <Field label="Ghi chú" className="sm:col-span-2"><input className={inputCls} value={f.note} onChange={(e) => set({ note: e.target.value })} placeholder="Người giới thiệu, yêu cầu riêng của khách…" /></Field>
      </div>
      {!job && <p className="mt-4 rounded bg-[rgb(var(--raised))] px-3 py-2 text-xs text-[rgb(var(--muted))]">Lưu xong, lead vào ngay Đơn hàng công trình với trạng thái "Đang chờ khảo sát" và báo cho kỹ thuật được giao.</p>}
    </Modal>
  );
}

// ---------------- Chăm sóc: báo giá chưa chốt / trượt ----------------

export function CareModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { me, setJobs, userName, notify, customers } = useApp();
  const [note, setNote] = useState('');
  const [nextAt, setNextAt] = useState(iso(new Date(Date.now() + 3 * 864e5)));
  const logs = [...(job.care ?? [])].sort((a, b) => b.at - a.at);
  const save = () => {
    if (note.trim().length < 3) return notify('Nhập nội dung chăm sóc', 'red');
    const c: JobCare = { id: uid('cr'), at: Date.now(), by: me.id, note: note.trim(), nextAt: nextAt || undefined };
    setJobs((all) => all.map((x) => (x.id === job.id ? { ...x, care: [...(x.care ?? []), c] } : x)));
    notify('Đã ghi nhận chăm sóc', 'teal');
    onClose();
  };
  return (
    <Modal title={`Chăm sóc: ${jobCustName(job, customers)}`} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Đóng</button><button className={btnPrimary} onClick={save}>Lưu chăm sóc</button></>}>
      <div className="space-y-3">
        <Field label="Nội dung trao đổi *"><textarea className={cn(inputCls, 'min-h-20')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Khách đang so giá, hẹn gửi thêm mẫu màu nhôm vân gỗ" /></Field>
        <Field label="Hẹn chăm sóc tiếp"><input className={inputCls} type="date" value={nextAt} onChange={(e) => setNextAt(e.target.value)} /></Field>
        {logs.length > 0 && (
          <ul className="space-y-1.5 border-t border-[rgb(var(--line))] pt-3">
            {logs.map((c) => <li key={c.id} className="rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm"><p>{c.note}</p><p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{userName(c.by)}, {new Date(c.at).toLocaleString('vi-VN')}{c.nextAt ? `, hẹn lại ${fmtDate(c.nextAt)}` : ''}</p></li>)}
          </ul>
        )}
      </div>
    </Modal>
  );
}

// ---------------- Khảo sát & tạo báo giá ----------------

/** Báo giá xưởng dạng Split-View: trái 38% đo đạc / hạng mục (bàn phím Tab, Enter), phải 62% bản A4 xem trước trực tiếp */
export function QuoteEditorModal({ job, onClose, onWin }: { job: Job; onClose: () => void; onWin?: () => void }) {
  const { me, setJobs, priceItems, canDo, notify, audit, company, customers, users, mfgConfig, dispatch } = useApp();
  const last = job.quotes[job.quotes.length - 1];
  const [lines, setLines] = useState<JobLine[]>(job.draft.length ? job.draft : last ? last.lines.map((l) => ({ ...l, id: uid('jl') })) : []);
  const [vatPct, setVatPct] = useState(job.draft.length || !last ? job.vatPct : last.vatPct);
  const [note, setNote] = useState(job.draft.length || !last ? '' : last.note ?? '');
  const [busy, setBusy] = useState(false);
  /** Bản đã lưu trong phiên này + chữ ký nội dung: không đổi gì thì xuất / chốt dùng lại, không sinh phiên bản trùng */
  const [saved, setSaved] = useState<{ q: JobQuote; nj: Job; sig: string } | null>(null);
  const grid = useGridKeys();
  const t = quoteTotalsOf(lines, vatPct, priceItems);
  const canSeeCost = canDo('price.viewCost');
  const gm = t.subtotal ? ((t.subtotal - t.cost) / t.subtotal) * 100 : null;
  const sig = JSON.stringify([lines.map(({ id: _id, ...x }) => x), vatPct, note.trim()]);
  const current = saved && saved.sig === sig ? saved : null;
  const nextV = (last?.version ?? 0) + 1;
  const cust = customers.find((c) => c.id === job.customerId);
  const owner = users.find((u) => u.id === job.ownerId);
  const patch = (p: Partial<Job>) => setJobs((all) => all.map((x) => (x.id === job.id ? { ...x, ...p } : x)));
  const setLine = (i: number, p: Partial<JobLine>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...p } : l)));
  const addLine = (pi?: PriceItem) => {
    setLines((ls) => [...ls, { id: uid('jl'), priceItemId: pi?.id, name: pi?.name ?? '', location: '', unit: pi?.unit ?? 'M2', width: 0, height: 0, length: 0, qty: 1, unitPrice: pi?.price ?? 0, unitCost: pi?.cost ?? 0, discountPct: 0 }]);
    grid.focusCell(lines.length, pi ? 1 : 0);
  };
  const close = () => { if (!current) patch({ draft: lines, vatPct }); onClose(); };
  const checkin = () => {
    setBusy(true);
    const done = (lat: number, lng: number, simulated: boolean) => { patch({ surveyCheckins: [...job.surveyCheckins, { at: new Date().toISOString(), lat, lng, simulated, by: me.id }] }); notify('Đã check-in khảo sát tại công trình', 'teal'); setBusy(false); };
    if (typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => done(p.coords.latitude, p.coords.longitude, false), () => done(10.79 + Math.random() * 0.02, 106.7 + Math.random() * 0.02, true), { timeout: 8000 });
    else done(10.79, 106.7, true);
  };
  const addFiles = async (files: File[], kind: JobFile['kind']) => {
    setBusy(true);
    try {
      const out: JobFile[] = [];
      for (const f of files) out.push({ id: uid('jf'), name: f.name, url: f.type.startsWith('image/') ? await compressImage(f, 1600) : URL.createObjectURL(f), kind, at: new Date().toISOString(), by: me.id });
      patch({ files: [...job.files, ...out] });
      notify(`Đã thêm ${out.length} ${kind === 'DRAWING' ? 'bản vẽ' : 'ảnh'}`, 'teal');
    } catch { notify('Không đọc được file', 'red'); } finally { setBusy(false); }
  };
  const bad = lines.find((l) => !l.name.trim() || l.qty <= 0 || l.unitPrice <= 0 || (l.unit === 'M2' && (l.width <= 0 || l.height <= 0)) || (l.unit === 'MD' && l.length <= 0));
  const err = !lines.length ? 'Thêm ít nhất một hạng mục' : bad ? `Dòng "${bad.name || 'chưa đặt tên'}": thiếu kích thước, số lượng hoặc đơn giá` : '';
  /** Lưu phiên bản mới (chỉ khi nội dung đổi so với bản vừa lưu) */
  const persist = (): { q: JobQuote; nj: Job } | null => {
    if (current) return current;
    if (err) { notify(err, 'red'); return null; }
    const q: JobQuote = { id: uid('jq'), version: nextV, at: new Date().toISOString(), by: me.id, lines: lines.map((l) => ({ ...l })), subtotal: t.subtotal, vatPct, total: t.total, cost: t.cost, note: note.trim() || undefined };
    const nj = { ...job, quotes: [...job.quotes, q], draft: [], vatPct };
    patch({ quotes: nj.quotes, draft: [], vatPct });
    audit('JOB_QUOTE', `${job.code} báo giá v${nextV}: ${vnd(t.total)}`);
    setSaved({ q, nj, sig });
    return { q, nj };
  };
  const exportAs = (format: 'PDF' | 'WORD') => {
    const r = persist();
    if (!r) return;
    const title = `Báo giá ${job.code} v${r.q.version}`;
    const body = jobQuoteHtml(r.nj, r.q, company, cust, owner, mfgConfig);
    if (format === 'PDF') printHtml(docShell(title, body)); else downloadWord(`${job.code}-BG${r.q.version}`, title, body);
    notify(`${format === 'PDF' ? 'Đã mở hộp thoại in PDF' : 'Đã tải file Word'}: báo giá v${r.q.version}`, 'teal');
  };
  const lowMargin = gm !== null && gm < 25;
  const submit = () => {
    const r = persist();
    if (!r) return;
    if (lowMargin) {
      const to = users.filter((u) => u.active && (u.role === 'BOD' || (u.role === 'DEPT_HEAD' && u.dept === owner?.dept)));
      dispatch('QUOTE_APPROVAL', { toAll: to, module: 'jobs', title: `Báo giá cần xem lại giá: ${jobCustName(job, customers)}`, body: `${job.code} v${r.q.version}, ${vnd(r.q.total)}, lãi gộp dự toán ${gm!.toFixed(1)}% (dưới 25%)` });
      notify(`Đã lưu báo giá v${r.q.version} và gửi Giám đốc xem lại (lãi gộp ${gm!.toFixed(1)}%)`, 'orange');
    } else notify(`Đã lưu báo giá v${r.q.version}: ${vnd(r.q.total)}. Đơn chuyển "Đã báo giá".`, 'teal');
    onClose();
  };
  const win = () => { if (!persist()) return; onClose(); onWin?.(); };
  const cats = Array.from(new Set(priceItems.filter((p) => p.active).map((p) => p.category)));
  const previewQ: JobQuote = current?.q ?? { id: 'preview', version: nextV, at: new Date().toISOString(), by: me.id, lines, subtotal: t.subtotal, vatPct, total: t.total, cost: t.cost, note: note.trim() || undefined };
  const html = jobQuoteHtml({ ...job, vatPct }, previewQ, company, cust, owner, mfgConfig);
  const cell = 'w-full rounded-md border border-transparent bg-[rgb(var(--bg))] px-1.5 py-1 text-xs tabular-nums text-[rgb(var(--fg))] [appearance:textfield] focus:border-[rgb(var(--accent))] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none';
  const num = cn(cell, 'text-right');

  const left = (
    <>
      <section className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3">
        <p className="truncate text-sm"><b>{jobCustName(job, customers)}</b> <span className="text-[rgb(var(--muted))]">{job.siteAddress}</span></p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className={cn(btnGhost, btnSm)} disabled={busy} onClick={checkin}><MapPin className="h-3.5 w-3.5" aria-hidden />Check-in</button>
          <FilePicker accept="image/*" multiple disabled={busy} onFiles={(f) => void addFiles(f, 'PHOTO')} className={cn(btnGhost, btnSm, 'inline-flex')}><Camera className="h-3.5 w-3.5" aria-hidden />Ảnh hiện trạng</FilePicker>
          <FilePicker accept="image/*,.pdf,.dwg" multiple disabled={busy} onFiles={(f) => void addFiles(f, 'DRAWING')} className={cn(btnGhost, btnSm, 'inline-flex')}><Ruler className="h-3.5 w-3.5" aria-hidden />Bản vẽ</FilePicker>
          <span className="ml-auto text-[11px] text-[rgb(var(--muted))]">{job.surveyCheckins.length} check-in, {job.files.filter((x) => x.kind === 'PHOTO').length} ảnh, {job.files.filter((x) => x.kind === 'DRAWING').length} bản vẽ</span>
        </div>
      </section>

      <section>
        {secHead(1, `Hạng mục đo đạc (${lines.length})`)}
        <div ref={grid.ref} onKeyDown={grid.onKeyDown} className="rounded-md border border-[rgb(var(--line))]">
          <table className="w-full table-fixed text-xs">
            <colgroup><col className="w-6" /><col /><col className="w-[104px]" /><col className="w-11" /><col className="w-11" /><col className="w-[86px]" /><col className="w-6" /></colgroup>
            <thead className="bg-[rgb(var(--raised))] text-[11px] text-[rgb(var(--muted))]">
              <tr><th className="rounded-tl-xl py-1.5" /><th className="px-1 text-left font-medium">Hạng mục / vị trí</th><th className="px-1 text-right font-medium">Rộng × cao / dài</th><th className="px-1 text-right font-medium">SL</th><th className="px-1 text-right font-medium">CK%</th><th className="px-2 text-right font-medium">Thành tiền</th><th className="rounded-tr-xl" /></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                const pi = priceItems.find((p) => p.id === l.priceItemId);
                const small = !!pi?.minMeasure && l.unit === 'M2' && l.width > 0 && (l.width * l.height) / 1e6 < pi.minMeasure;
                return (
                  <tr key={l.id} className="border-t border-[rgb(var(--line))] align-top hover:bg-[rgb(var(--raised)/0.6)]">
                    <td className="py-2 text-center text-[11px] tabular-nums text-[rgb(var(--muted))]">{i + 1}</td>
                    <td className="space-y-1 px-1 py-1.5">
                      <input data-r={i} data-c={0} className={cell} value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} aria-label="Tên hạng mục" placeholder="Tên hạng mục" />
                      <input data-r={i} data-c={1} className={cn(cell, 'text-[rgb(var(--muted))]')} value={l.location} onChange={(e) => setLine(i, { location: e.target.value })} aria-label="Vị trí" placeholder="Vị trí, VD: cửa chính tầng 1" />
                      {!pi && (
                        <div className="grid grid-cols-2 gap-1">
                          <select className={cell} value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value as PriceUnit })} aria-label="Đơn vị">{(Object.keys(PRICE_UNIT) as PriceUnit[]).map((u) => <option key={u} value={u}>{PRICE_UNIT[u].short}</option>)}</select>
                          <input data-r={i} data-c={6} className={num} inputMode="numeric" value={l.unitPrice ? l.unitPrice.toLocaleString('vi-VN') : ''} onChange={(e) => setLine(i, { unitPrice: digits(e.target.value) })} aria-label="Đơn giá" placeholder="Đơn giá" />
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-1.5">
                      {l.unit === 'M2' ? (
                        <div className="grid grid-cols-2 gap-1">
                          <input data-r={i} data-c={2} className={num} type="number" min={0} value={l.width || ''} onChange={(e) => setLine(i, { width: Number(e.target.value) })} aria-label="Rộng (mm)" placeholder="R mm" />
                          <input data-r={i} data-c={3} className={num} type="number" min={0} value={l.height || ''} onChange={(e) => setLine(i, { height: Number(e.target.value) })} aria-label="Cao (mm)" placeholder="C mm" />
                        </div>
                      ) : l.unit === 'MD' ? (
                        <input data-r={i} data-c={2} className={num} type="number" min={0} step={0.1} value={l.length || ''} onChange={(e) => setLine(i, { length: Number(e.target.value) })} aria-label="Dài (m)" placeholder="Dài m" />
                      ) : <p className="py-1 text-right text-[rgb(var(--muted))]">—</p>}
                      <p className={cn('mt-0.5 text-right text-[11px] tabular-nums', small ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{lineMeasure(l, pi?.minMeasure).toLocaleString('vi-VN')} {PRICE_UNIT[l.unit].short}{small ? ' (tối thiểu)' : ''}</p>
                    </td>
                    <td className="px-1 py-1.5"><input data-r={i} data-c={4} className={num} type="number" min={0} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} aria-label="Số lượng" /></td>
                    <td className="px-1 py-1.5"><input data-r={i} data-c={5} className={num} type="number" min={0} max={100} value={l.discountPct} onChange={(e) => setLine(i, { discountPct: Number(e.target.value) })} aria-label="Chiết khấu %" /></td>
                    <td className="px-2 py-1.5 text-right tabular-nums"><p className="font-medium text-[rgb(var(--fg))]">{lineAmount(l, pi?.minMeasure).toLocaleString('vi-VN')}</p><p className="text-[11px] text-[rgb(var(--muted))]">{l.unitPrice.toLocaleString('vi-VN')}/{PRICE_UNIT[l.unit].short}</p></td>
                    <td className="py-1.5 text-center"><button tabIndex={-1} className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))} aria-label="Xóa dòng"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                );
              })}
              {!lines.length && <tr><td colSpan={7} className="px-3 py-4 text-center text-[rgb(var(--muted))]">Chọn hạng mục từ bảng giá rồi nhập kích thước đo thực tế.</td></tr>}
            </tbody>
          </table>
          <div className="border-t border-[rgb(var(--line))] p-2" data-picker>
            <select className={cn(inputCls, 'py-1.5 text-xs')} value="" onChange={(e) => { const p = priceItems.find((x) => x.id === e.target.value); if (p) addLine(p); else if (e.target.value === 'free') addLine(); }} aria-label="Thêm hạng mục">
              <option value="">+ Thêm hạng mục từ bảng giá (Enter để mở)</option>
              {cats.map((cat) => <optgroup key={cat} label={cat}>{priceItems.filter((p) => p.active && p.category === cat).map((p) => <option key={p.id} value={p.id}>{p.name} ({compact(p.price)}/{PRICE_UNIT[p.unit].short})</option>)}</optgroup>)}
              <option value="free">Hạng mục ngoài bảng giá</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-px rounded-b-xl border-t border-[rgb(var(--line))] bg-[rgb(var(--line))] text-xs tabular-nums">
            <p className="bg-[rgb(var(--surface))] px-2 py-1.5 text-right"><span className="block text-[11px] text-[rgb(var(--muted))]">Cộng</span>{t.subtotal.toLocaleString('vi-VN')}</p>
            <label className="flex flex-col items-end bg-[rgb(var(--surface))] px-2 py-1.5"><span className="flex items-center gap-1 text-[11px] text-[rgb(var(--muted))]">VAT<input className="w-9 rounded border border-[rgb(var(--line))] bg-[rgb(var(--bg))] px-1 text-right text-[11px]" type="number" min={0} max={10} value={vatPct} onChange={(e) => setVatPct(Number(e.target.value))} aria-label="VAT %" />%</span>{t.vat.toLocaleString('vi-VN')}</label>
            <p className="bg-[rgb(var(--surface))] px-2 py-1.5 text-right font-semibold text-[rgb(var(--accent-fg))]"><span className="block text-[11px] font-normal text-[rgb(var(--muted))]">Tổng cộng (đ)</span>{t.total.toLocaleString('vi-VN')}</p>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[rgb(var(--muted))]">
          <span className="hidden lg:inline"><kbd className="rounded border border-[rgb(var(--line))] px-1">Tab</kbd> sang ô kế, <kbd className="rounded border border-[rgb(var(--line))] px-1">Enter</kbd> xuống dòng / thêm hạng mục</span>
          {canSeeCost && gm !== null && <span className={cn('ml-auto', lowMargin && 'text-[rgb(var(--accent-fg))]')}>Lãi gộp dự toán {vnd(t.subtotal - t.cost)} ({gm.toFixed(1)}%)</span>}
        </div>
      </section>

      <section>
        {secHead(2, 'Điều khoản thanh toán')}
        <ul className="space-y-1 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 text-xs">
          {job.schedule.map((st) => <li key={st.id} className="flex justify-between gap-2"><span>{st.label} <span className="text-[rgb(var(--muted))]">({PAY_TRIGGER[st.trigger].toLowerCase()})</span></span><span className="tabular-nums">{st.pct}% · {Math.round((t.total * st.pct) / 100).toLocaleString('vi-VN')} đ</span></li>)}
          <li className="pt-1 text-[11px] text-[rgb(var(--muted))]">Hiệu lực {mfgConfig.quoteValidDays} ngày, bảo hành {job.warrantyMonths ?? mfgConfig.warrantyMonths} tháng. Sửa lịch thanh toán khi nhận cọc.</li>
        </ul>
        <div className="mt-2"><Fold title="Ghi chú trên báo giá" summary={note.trim() || 'Màu nhôm, loại kính, thời gian thi công…'} open={!!note}>
          <textarea className={cn(inputCls, 'min-h-[72px] text-sm')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Màu nhôm, loại kính, thời gian thi công dự kiến…" />
        </Fold></div>
      </section>
    </>
  );

  return (
    <ComposerShell
      title={current ? `Báo giá ${job.code} v${current.q.version}` : last ? `Sửa báo giá ${job.code}: lập bản v${nextV}` : `Tạo báo giá ${job.code}`}
      subtitle={`${jobCustName(job, customers)} · ${job.title}`}
      badge={current ? <Chip tone="teal">Đã lưu v{current.q.version}</Chip> : job.draft.length ? <Chip tone="orange">Nháp</Chip> : undefined}
      left={left}
      html={html}
      onClose={close}
      footer={
        <DocActionBar
          status={<span className={cn('font-medium', err ? 'text-[rgb(var(--danger-fg))]' : current ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}>{err ? err : current ? `Đã lưu v${current.q.version}, ${vnd(current.q.total)}` : `Đóng để lưu nháp. Xuất file / gửi sẽ lưu bản v${nextV}`}</span>}
          pdf={{ onClick: () => exportAs('PDF'), disabled: !!err, title: current ? 'In / lưu PDF' : `Lưu bản v${nextV} rồi in PDF` }}
          word={{ onClick: () => exportAs('WORD'), disabled: !!err, title: current ? 'Tải file Word (.doc)' : `Lưu bản v${nextV} rồi tải Word` }}
          win={{ onClick: win, disabled: !!err || !onWin, title: onWin ? 'Lưu báo giá rồi nhận cọc & chuyển sản xuất' : 'Không có quyền chốt đơn' }}
          submit={{ onClick: submit, disabled: !!err, title: lowMargin ? 'Lãi gộp dưới 25%: lưu và gửi Giám đốc xem lại giá' : 'Lưu phiên bản, đơn chuyển "Đã báo giá"' }}
        />
      }
    />
  );
}

// ---------------- Nhận cọc & chuyển sản xuất ----------------

export function DepositModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { me, setJobs, setCustomers, receipts, setReceipts, workOrders, setWorkOrders, notify, audit, users, dispatch, mfgConfig, customers } = useApp();
  const [ver, setVer] = useState(job.quotes[job.quotes.length - 1]?.version ?? 0);
  const q = job.quotes.find((x) => x.version === ver);
  const [schedule, setSchedule] = useState<PayStage[]>(job.schedule.map((x) => ({ ...x })));
  const sum = schedule.reduce((s, x) => s + x.pct, 0);
  const depositPct = schedule.filter((s) => s.trigger === 'SIGN').reduce((s, x) => s + x.pct, 0);
  const total = q?.total ?? 0;
  const [amt, setAmt] = useState(Math.round((total * depositPct) / 100));
  const [method, setMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [photo, setPhoto] = useState<string | undefined>();
  const [days, setDays] = useState(mfgConfig.productionDays);
  const [woNote, setWoNote] = useState('');
  const [busy, setBusy] = useState(false);
  const xuong = users.filter((u) => u.active && u.dept === 'XUONG');
  const [leader, setLeader] = useState(xuong.find((u) => u.role === 'DEPT_HEAD')?.id ?? xuong[0]?.id ?? '');
  const setStage = (i: number, p: Partial<PayStage>) => setSchedule((xs) => xs.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const errs: string[] = [];
  if (!q) errs.push('Chưa có báo giá');
  if (sum !== 100) errs.push(`Tổng các đợt thanh toán phải bằng 100% (đang ${sum}%)`);
  if (amt <= 0) errs.push('Nhập số tiền cọc đã nhận');
  if (method === 'TRANSFER' && !photo) errs.push('Chuyển khoản: chụp màn hình giao dịch');
  const save = () => {
    if (errs.length || !q) return notify(errs[0], 'red');
    const at = todayISO();
    const nj: Job = { ...job, wonAt: at, wonVersion: q.version, contractValue: q.total, schedule };
    setJobs((all) => all.map((j) => (j.id === job.id ? nj : j)));
    const r: Receipt = {
      id: uid('rc'), code: nextCode(receipts.map((x) => x.code), `PT-${new Date().getFullYear()}-`, 4), jobId: job.id, stageId: schedule.find((s) => s.trigger === 'SIGN')?.id,
      amount: amt, method, collectedBy: me.id, collectedAt: Date.now(), photo, note: `Cọc ${job.code}`,
      status: method === 'CASH' ? 'HOLDING' : 'SUBMITTED', submittedAt: method === 'CASH' ? undefined : Date.now(),
    };
    setReceipts((p) => [r, ...p]);
    const custName = jobCustName(job, customers);
    const wo = buildWorkOrder(nj, q, custName, nextCode(workOrders.map((w) => w.code), `LSX-${new Date().getFullYear()}-`, 4), leader || undefined, me.id, days, woNote.trim());
    setWorkOrders((p) => [wo, ...p]);
    setCustomers((p) => p.map((c) => (c.id === job.customerId ? { ...c, status: 'ACTIVE' } : c)));
    users.filter((u) => u.active && (u.role === 'ACCOUNTANT' || u.id === leader)).forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title: u.role === 'ACCOUNTANT' ? `Tiền cọc ${job.code}: ${vnd(amt)}` : `Lệnh sản xuất mới ${wo.code}`, body: `${custName}, ${job.title}. Hạn xưởng ${fmtDate(wo.dueDate)}.`, module: u.role === 'ACCOUNTANT' ? 'tasks' : 'production' }));
    audit('JOB_WON', `${job.code} chốt ${vnd(q.total)}, cọc ${vnd(amt)}, tạo ${wo.code}`);
    notify(`Đã nhận cọc, chuyển sản xuất (${wo.code}). ${method === 'CASH' ? `Nộp ${vnd(amt)} về kế toán trong ${mfgConfig.submitHours} giờ.` : 'Chờ kế toán đối chiếu chuyển khoản.'}`, 'teal');
    onClose();
  };
  return (
    <Modal title={`Nhận cọc & chuyển sản xuất: ${job.code}`} onClose={onClose} wide
      footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={cn(btnBase, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] px-3.5 py-2 font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)]')} disabled={busy} onClick={save}><CheckCircle2 className="h-4 w-4" aria-hidden />Nhận cọc, chuyển sản xuất</button></>}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Báo giá khách chốt">
            <select className={inputCls} value={ver} onChange={(e) => { const v = Number(e.target.value); setVer(v); setAmt(Math.round(((job.quotes.find((x) => x.version === v)?.total ?? 0) * depositPct) / 100)); }}>
              {[...job.quotes].reverse().map((x) => <option key={x.version} value={x.version}>Báo giá v{x.version}: {vnd(x.total)}</option>)}
            </select>
          </Field>
          <div>
            <p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">Lịch thanh toán của đơn</p>
            <ul className="space-y-2">
              {schedule.map((s, i) => (
                <li key={s.id} className="grid grid-cols-[1fr_88px_32px] items-center gap-2">
                  <input className={cn(inputCls, 'py-1.5 text-sm')} value={s.label} onChange={(e) => setStage(i, { label: e.target.value })} aria-label="Tên đợt" />
                  <div className="relative"><input className={cn(inputCls, 'py-1.5 pr-6 text-right text-sm tabular-nums')} type="number" min={0} max={100} value={s.pct} onChange={(e) => { const v = Number(e.target.value); setStage(i, { pct: v }); if (s.trigger === 'SIGN') setAmt(Math.round((total * v) / 100)); }} aria-label="Tỷ lệ" /><span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--muted))]">%</span></div>
                  <button className="flex justify-center text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))] disabled:opacity-30" disabled={schedule.length <= 1} onClick={() => setSchedule((xs) => xs.filter((_, k) => k !== i))} aria-label="Xóa đợt"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between">
              <button className={cn(btnGhost, btnSm)} onClick={() => setSchedule((xs) => [...xs, { id: uid('ps'), label: 'Đợt giữa', pct: 0, trigger: 'DELIVERY' }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm đợt</button>
              <span className={cn('text-xs tabular-nums', sum === 100 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>Tổng {sum}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Số ngày sản xuất"><input className={inputCls} type="number" min={1} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} /></Field>
            <Field label="Phụ trách xưởng"><select className={inputCls} value={leader} onChange={(e) => setLeader(e.target.value)}><option value="">Chưa giao</option>{(xuong.length ? xuong : users.filter((u) => u.active)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
            <Field label="Ghi chú cho xưởng" className="col-span-2"><input className={inputCls} value={woNote} onChange={(e) => setWoNote(e.target.value)} placeholder="Màu sơn, ưu tiên hạng mục…" /></Field>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-1 rounded-md border border-[rgb(var(--line))] p-3 text-sm">
            <p className="flex justify-between"><span className="text-[rgb(var(--muted))]">Giá trị hợp đồng</span><b className="tabular-nums">{vnd(total)}</b></p>
            {schedule.map((s) => <p key={s.id} className="flex justify-between text-xs"><span className="text-[rgb(var(--muted))]">{s.label} {s.pct}%</span><span className="tabular-nums">{vnd((total * s.pct) / 100)}</span></p>)}
          </div>
          <Field label="Tiền cọc nhận được"><MoneyInput value={amt} onChange={setAmt} /></Field>
          <div className="flex rounded bg-[rgb(var(--bg))] p-0.5" role="radiogroup" aria-label="Hình thức">
            {(['CASH', 'TRANSFER'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={cn('flex-1 rounded-md px-3 py-2 text-sm font-medium', method === m ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))]')}>{m === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FilePicker accept="image/*" disabled={busy} onFiles={(f) => { setBusy(true); compressImage(f[0], 1000).then(setPhoto).catch(() => notify('Không đọc được ảnh', 'red')).finally(() => setBusy(false)); }} className={cn(btnGhost, btnSm, 'inline-flex')}><Upload className="h-3.5 w-3.5" aria-hidden />{photo ? 'Đổi ảnh' : method === 'TRANSFER' ? 'Ảnh chuyển khoản *' : 'Ảnh phiếu cọc (tùy chọn)'}</FilePicker>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo && <img src={photo} alt="Chứng từ cọc" className="h-14 rounded object-cover" />}
          </div>
          {amt > 0 && amt < Math.round((total * depositPct) / 100) && <p className="text-xs text-[rgb(var(--accent-fg))]">Cọc thấp hơn {depositPct}% ({vnd((total * depositPct) / 100)}).</p>}
          <p className="text-xs text-[rgb(var(--muted))]">Lưu xong: tự tạo lệnh sản xuất trạng thái "Chờ sản xuất" và báo xưởng. Doanh số ghi nhận khi kế toán xác nhận tiền.</p>
        </div>
      </div>
      {errs.length > 0 && <ul className="mt-3 space-y-0.5 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
    </Modal>
  );
}

// ---------------- Ngăn chi tiết đơn hàng ----------------

/** Dòng thời gian thi công: gom mốc từ đơn, báo giá, thiết kế, lệnh SX, lắp đặt, nghiệm thu (chỉ đọc, không thêm dữ liệu) */
export function JobTimeline({ j, wo, installs }: { j: Job; wo?: WorkOrder; installs: InstallJob[] }) {
  const ev: { at: number; label: string; tone: Tone }[] = [];
  const t = (s?: string | number) => (s == null ? NaN : typeof s === 'number' ? s : Date.parse(s));
  ev.push({ at: t(j.createdAt), label: 'Tiếp nhận đơn', tone: 'muted' });
  j.quotes.forEach((q) => ev.push({ at: t(q.at), label: `Gửi báo giá v${q.version}`, tone: 'blue' }));
  if (j.wonAt) ev.push({ at: t(j.wonAt), label: 'Chốt đơn, nhận cọc', tone: 'teal' });
  if (wo?.design?.at) ev.push({ at: wo.design.at, label: DESIGN_STATUS[wo.design.status].label, tone: DESIGN_STATUS[wo.design.status].tone });
  wo?.history.forEach((h) => ev.push({ at: h.at, label: `Xưởng: ${WO_STAGE[h.stage]?.label ?? h.stage}`, tone: 'orange' }));
  installs.forEach((i) => {
    if (i.from) ev.push({ at: t(i.from), label: `Lịch lắp đặt ${i.code}`, tone: 'blue' });
    i.checkins.forEach((c) => ev.push({ at: t(c.at), label: `Check-in công trình (${c.photos.length} ảnh)`, tone: 'muted' }));
    if (i.acceptance) ev.push({ at: t(i.acceptance.at), label: 'Nghiệm thu, bàn giao', tone: 'teal' });
  });
  const list = ev.filter((e) => Number.isFinite(e.at)).sort((a, b) => a.at - b.at);
  const dot: Record<Tone, string> = { muted: 'bg-[rgb(var(--faint))]', blue: 'bg-[rgb(var(--secondary))]', orange: 'bg-[rgb(var(--accent))]', teal: 'bg-[rgb(var(--success))]', red: 'bg-[rgb(var(--danger))]' };
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">Dòng thời gian thi công</h3>
      <ol className="relative ml-1.5 space-y-2.5 border-l border-[rgb(var(--line))] pl-4">
        {list.map((e, i) => (
          <li key={i} className="relative text-sm">
            <span className={cn('absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-[rgb(var(--surface))]', dot[e.tone])} aria-hidden />
            <span>{e.label}</span><span className="ml-2 text-xs text-[rgb(var(--muted))]">{new Date(e.at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function JobDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { jobs, setJobs, customers, users, canDo, company, mfgConfig, audit, userName, go, sources, stockMoves, cashEntries, workOrders, stockItems } = useApp();
  const info = useJobInfo();
  const j = jobs.find((x) => x.id === id);
  const [tab, setTab] = useState<'quote' | 'pay' | 'progress' | 'care'>('quote');
  const [modal, setModal] = useState<'quote' | 'deposit' | 'edit' | 'care' | 'lost' | 'schedule' | null>(null);
  const [collect, setCollect] = useState<number | null>(null);
  const [lost, setLost] = useState<{ reason: JobLostReason; note: string }>({ reason: 'PRICE', note: '' });
  if (!j) return null;
  const { stage, detail, money, wo, installs, due } = info(j);
  const cust = customers.find((c) => c.id === j.customerId);
  const owner = users.find((u) => u.id === j.ownerId);
  const can = canDo('job.manage');
  const patch = (p: Partial<Job>) => setJobs((all) => all.map((x) => (x.id === j.id ? { ...x, ...p } : x)));
  const stepIdx = stage === 'LOST' ? -1 : JOB_STAGES.indexOf(stage);
  const remaining = Math.max(0, money.value - money.collected);
  const printQuote = (q: JobQuote) => printHtml(docShell(`Báo giá ${j.code} v${q.version}`, jobQuoteHtml(j, q, company, cust, owner, mfgConfig)));
  const accepted = installs.find((i) => i.acceptance);
  const cost = jobActualCost(j, stockMoves, cashEntries, workOrders);
  const lateSurvey = stage === 'SURVEY' && j.appointmentAt && j.appointmentAt < toLocal(new Date());
  const scheduled = installs.find((i) => i.status !== 'ACCEPTED');
  const care = [...(j.care ?? [])].sort((a, b) => b.at - a.at);

  const actions = (
    <>
      {stage === 'SURVEY' && can && <button className={cn(btnPrimary, btnSm)} onClick={() => setModal('quote')}><FileText className="h-3.5 w-3.5" aria-hidden />Tạo báo giá</button>}
      {stage === 'QUOTED' && can && <button className={cn(btnBase, btnSm, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => setModal('deposit')}><Banknote className="h-3.5 w-3.5" aria-hidden />Nhận cọc & chuyển sản xuất</button>}
      {stage === 'QUOTED' && can && <button className={cn(btnGhost, btnSm)} onClick={() => setModal('quote')}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa báo giá</button>}
      {stage === 'INSTALL' && !scheduled && canDo('install.manage') && <button className={cn(btnPrimary, btnSm)} onClick={() => setModal('schedule')}><CalendarDays className="h-3.5 w-3.5" aria-hidden />Hẹn lắp đặt</button>}
      {j.wonAt && remaining > 0 && can && <button className={cn(btnGhost, btnSm)} onClick={() => setCollect(Math.max(0, due - money.collected) || remaining)}><Banknote className="h-3.5 w-3.5" aria-hidden />Thu tiền</button>}
      {(stage === 'QUOTED' || stage === 'LOST') && <button className={cn(btnGhost, btnSm)} onClick={() => setModal('care')}><MessageSquare className="h-3.5 w-3.5" aria-hidden />Ghi chăm sóc</button>}
      {(stage === 'SURVEY' || stage === 'QUOTED') && can && <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))]')} onClick={() => setModal('lost')}>Trượt</button>}
      {stage === 'LOST' && can && <button className={cn(btnGhost, btnSm)} onClick={() => { patch({ lostAt: undefined, lostReason: undefined, lostNote: undefined }); audit('JOB_REOPEN', `${j.code} mở lại`); }}>Mở lại đơn</button>}
    </>
  );

  return (
    <Drawer title={jobCustName(j, customers)} eyebrow={`${j.code} · ${j.title}`} badge={<Chip tone={JOB_STAGE[stage].tone}>{JOB_STAGE[stage].label}</Chip>} onClose={onClose} actions={actions}>
      <ol className="grid grid-cols-6" aria-label="Tiến độ đơn hàng">
        {JOB_STAGES.map((s, i) => {
          const done = i < stepIdx || stage === 'DONE';
          return (
            <li key={s} className="flex flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : i <= stepIdx ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--line))]')} />
                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', done ? 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] text-[rgb(var(--fg))]' : i === stepIdx ? 'g-brand font-semibold text-[rgb(var(--on-accent))]' : 'border border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-[rgb(var(--muted))]')}>{done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : i + 1}</span>
                <span className={cn('h-0.5 flex-1', i === JOB_STAGES.length - 1 ? 'opacity-0' : i < stepIdx ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--line))]')} />
              </div>
              <p className={cn('mt-1 px-0.5 text-[11px] leading-tight', i === stepIdx ? 'font-semibold text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{JOB_STAGE[s].short}</p>
            </li>
          );
        })}
      </ol>
      {j.lostAt && <p className="rounded bg-[rgb(var(--danger)/0.1)] p-3 text-sm text-[rgb(var(--danger-fg))]">Trượt ngày {fmtDate(j.lostAt)}: {JOB_LOST[j.lostReason ?? 'OTHER']}{j.lostNote ? `. ${j.lostNote}` : ''}</p>}
      <p className={cn('rounded px-3 py-2 text-sm', lateSurvey ? 'bg-[rgb(var(--danger)/0.1)] text-[rgb(var(--danger-fg))]' : 'bg-[rgb(var(--raised))] text-[rgb(var(--fg))]')}>{lateSurvey ? 'Quá giờ hẹn khảo sát. ' : ''}{detail}</p>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Thông tin khách hàng</h3>
          {can && !j.lostAt && <button className={cn(btnGhost, btnSm)} onClick={() => setModal('edit')}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa</button>}
        </div>
        <InfoGrid rows={[
          ['Khách hàng', jobCustName(j, customers)],
          ['Số điện thoại', jobPhone(j, customers) ? <a className="text-[rgb(var(--accent-fg))] hover:underline" href={`tel:${phoneKey(jobPhone(j, customers))}`}>{jobPhone(j, customers)}</a> : ''],
          ['Địa chỉ', j.siteAddress, true],
          ['Thời gian hẹn khảo sát', j.appointmentAt ? fmtDT(j.appointmentAt) : ''],
          ['Kỹ thuật khảo sát', owner?.name ?? ''],
          ['Hạng mục', j.title, true],
          ['Nguồn khách', sources.find((s) => s.id === cust?.sourceId)?.name ?? ''],
          ['Ghi chú', j.note],
        ]} />
      </section>

      {(j.wonAt || j.quotes.length > 0) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label={j.wonAt ? 'Giá trị hợp đồng' : 'Báo giá mới nhất'} value={compact(money.value || (j.quotes[j.quotes.length - 1]?.total ?? 0))} />
          <MiniStat label="Đã xác nhận thu" value={compact(money.confirmed)} tone="teal" />
          <MiniStat label="Chờ nộp / xác nhận" value={compact(money.pending)} tone="orange" />
          <MiniStat label="Còn phải thu" value={compact(remaining)} tone={remaining && stage === 'WAIT_PAYMENT' ? 'red' : undefined} />
        </div>
      )}

      <Tabs tabs={[{ id: 'quote', label: 'Báo giá', count: j.quotes.length || undefined }, { id: 'pay', label: 'Thanh toán' }, { id: 'progress', label: 'Sản xuất & lắp đặt' }, { id: 'care', label: 'Chăm sóc', count: care.length || undefined }]} value={tab} onChange={setTab} />

      {tab === 'quote' && (
        <div className="space-y-4">
          {!j.quotes.length ? (
            <div className="rounded-md border border-dashed border-[rgb(var(--line))] p-5 text-center">
              <p className="text-sm text-[rgb(var(--muted))]">Chưa có báo giá. Kỹ thuật khảo sát, đo đạc rồi bấm "Tạo báo giá".</p>
              {can && !j.lostAt && <button className={cn(btnPrimary, btnSm, 'mt-3')} onClick={() => setModal('quote')}><FileText className="h-3.5 w-3.5" aria-hidden />Tạo báo giá{j.draft.length ? ` (nháp ${j.draft.length} dòng)` : ''}</button>}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {[...j.quotes].reverse().map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-[rgb(var(--raised))] px-3 py-2.5 text-sm">
                  <b>v{q.version}</b>
                  <span className="text-xs text-[rgb(var(--muted))]">{new Date(q.at).toLocaleDateString('vi-VN')}, {q.lines.length} hạng mục, {userName(q.by)}</span>
                  {q.version === j.wonVersion && <Chip tone="teal">Khách chốt</Chip>}
                  <span className="ml-auto font-semibold tabular-nums">{vnd(q.total)}</span>
                  <button className={cn(btnGhost, btnSm)} onClick={() => printQuote(q)}><Download className="h-3.5 w-3.5" aria-hidden />PDF</button>
                </li>
              ))}
            </ul>
          )}
          {j.files.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-[rgb(var(--muted))]">Ảnh khảo sát & bản vẽ</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {j.files.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded border border-[rgb(var(--line))] bg-[rgb(var(--raised))]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {f.url.startsWith('data:image') ? <img src={f.url} alt={f.name} className="aspect-square w-full object-cover" /> : <span className="flex aspect-square flex-col items-center justify-center p-2 text-center text-[11px] text-[rgb(var(--muted))]"><FileText className="mb-1 h-5 w-5" aria-hidden />{f.name}</span>}
                    <span className={cn('absolute left-1 top-1 rounded px-1.5 py-0.5 text-[11px] font-semibold', f.kind === 'DRAWING' ? 'g-brand font-semibold text-[rgb(var(--on-accent))]' : 'bg-black/60 text-white')}>{f.kind === 'DRAWING' ? 'Bản vẽ' : 'Ảnh'}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {j.surveyCheckins.length > 0 && <p className="text-xs text-[rgb(var(--muted))]">Check-in: {j.surveyCheckins.map((c) => `${userName(c.by)} ${new Date(c.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}${c.simulated ? ' (GPS mô phỏng)' : ''}`).join('; ')}</p>}
        </div>
      )}

      {tab === 'pay' && (
        <div className="space-y-5">
          {!j.wonAt ? <p className="rounded bg-[rgb(var(--raised))] p-3 text-sm text-[rgb(var(--muted))]">Chưa nhận cọc. Khách đồng ý báo giá thì bấm "Nhận cọc & chuyển sản xuất" (mặc định cọc {j.schedule.filter((s) => s.trigger === 'SIGN').reduce((s, x) => s + x.pct, 0)}%).</p> : (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Lịch thanh toán</h3>
              <ul className="space-y-1.5">
                {j.schedule.map((s) => {
                  const reached = dueByStage({ ...j, schedule: [s] }, stage) > 0;
                  return (
                    <li key={s.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm">
                      <span className="min-w-0"><b className="font-medium">{s.label} {s.pct}%</b><span className="block text-xs text-[rgb(var(--muted))]">{PAY_TRIGGER[s.trigger]}</span></span>
                      <span className="tabular-nums">{vnd((money.value * s.pct) / 100)}</span>
                      <Chip tone={reached ? 'orange' : 'muted'}>{reached ? 'Đến hạn' : 'Chưa đến'}</Chip>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Phiếu thu</h3>
            <ReceiptList job={j} />
          </section>
        </div>
      )}

      {tab === 'progress' && (
        <div className="space-y-5">
          <JobTimeline j={j} wo={wo} installs={installs} />
          {!j.wonAt ? <p className="rounded bg-[rgb(var(--raised))] p-3 text-sm text-[rgb(var(--muted))]">Nhận cọc xong, lệnh sản xuất được tạo tự động.</p> : (
            <>
              <section>
                <h3 className="mb-2 text-sm font-semibold">Sản xuất</h3>
                {wo ? (
                  <button className="grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-3 text-left text-sm hover:border-[rgb(var(--muted)/0.4)]" onClick={() => { onClose(); go('production'); }}>
                    <span className="min-w-0"><b className="code-chip">{wo.code}</b><span className="block text-xs text-[rgb(var(--muted))]">Hạn {fmtDate(wo.dueDate)}, phụ trách {userName(wo.leaderId)}, {wo.items.length} hạng mục</span></span>
                    <Chip tone={WO_STAGE[wo.stage].tone}>{WO_STAGE[wo.stage].label}</Chip>
                  </button>
                ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có lệnh sản xuất.</p>}
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold">Lắp đặt & nghiệm thu</h3>
                {installs.length ? (
                  <ul className="space-y-1.5">
                    {installs.map((i) => (
                      <li key={i.id}>
                        <button className="grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded bg-[rgb(var(--raised))] px-3 py-2 text-left text-sm" onClick={() => { onClose(); go('install'); }}>
                          <span><b className="code-chip">{i.code}</b> <span className="text-xs text-[rgb(var(--muted))]">{i.from ? fmtDT(i.from) : ''}, {userName(i.leaderId)}</span></span>
                          <Chip tone={i.status === 'ACCEPTED' ? 'teal' : i.status === 'IN_PROGRESS' ? 'orange' : 'blue'}>{i.status === 'ACCEPTED' ? 'Đã nghiệm thu' : i.status === 'IN_PROGRESS' ? 'Đang lắp' : 'Đã hẹn lắp'}</Chip>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-[rgb(var(--muted))]">{wo?.stage === 'DONE' ? 'Xưởng đã hoàn thành, hẹn lịch lắp đặt với khách.' : 'Chờ xưởng hoàn thành.'}</p>}
                {accepted?.acceptance && <p className="mt-2 rounded bg-[rgb(var(--success)/0.1)] p-3 text-sm text-[rgb(var(--success-fg))]">Nghiệm thu {fmtDate(accepted.acceptance.at.slice(0, 10))}, bảo hành {accepted.acceptance.warrantyMonths ?? j.warrantyMonths} tháng{accepted.acceptance.warrantyUntil ? ` đến ${fmtDate(accepted.acceptance.warrantyUntil)}` : ''}{stage === 'DONE' ? '' : ' (hiệu lực khi thanh toán đủ)'}.</p>}
              </section>
              {(cost.total > 0 || canDo('price.viewCost')) && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Chi phí thực tế</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <MiniStat label="Vật tư xuất kho" value={compact(cost.material)} />
                    <MiniStat label="Chi phí khác" value={compact(cost.other)} />
                    <MiniStat label="Lãi gộp thực tế" value={money.value ? pct(money.value - cost.total, money.value) : '—'} tone={money.value && (money.value - cost.total) / money.value < 0.2 ? 'red' : 'teal'} />
                  </div>
                  {stockMoves.filter((m) => m.type === 'OUT' && (m.jobId === j.id || m.woId === wo?.id)).length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-[rgb(var(--muted))]">
                      {stockMoves.filter((m) => m.type === 'OUT' && (m.jobId === j.id || m.woId === wo?.id)).map((m) => <li key={m.id} className="flex justify-between gap-2"><span>{m.code}: {stockItems.find((s) => s.id === m.itemId)?.name ?? m.itemId} × {m.qty}</span><span className="tabular-nums">{vnd(m.qty * m.unitCost)}</span></li>)}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'care' && (
        <div className="space-y-3">
          <button className={cn(btnGhost, btnSm)} onClick={() => setModal('care')}><Plus className="h-3.5 w-3.5" aria-hidden />Ghi chăm sóc</button>
          {care.length ? (
            <ul className="space-y-1.5">
              {care.map((c) => <li key={c.id} className="rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm"><p>{c.note}</p><p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{userName(c.by)}, {new Date(c.at).toLocaleString('vi-VN')}{c.nextAt ? `, hẹn lại ${fmtDate(c.nextAt)}` : ''}</p></li>)}
            </ul>
          ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có lần chăm sóc nào.</p>}
        </div>
      )}

      {modal === 'quote' && <QuoteEditorModal job={j} onClose={() => setModal(null)} onWin={() => setModal('deposit')} />}
      {modal === 'deposit' && <DepositModal job={j} onClose={() => setModal(null)} />}
      {modal === 'edit' && <MfgLeadForm job={j} onClose={() => setModal(null)} />}
      {modal === 'care' && <CareModal job={j} onClose={() => setModal(null)} />}
      {modal === 'schedule' && wo && <InstallScheduleModal wo={wo} onClose={() => setModal(null)} />}
      {collect !== null && <ReceiptModal job={j} amount={collect} title={`Thu tiền: ${j.code}`} onClose={() => setCollect(null)} />}
      {modal === 'lost' && (
        <Modal title={`Trượt: ${j.code}`} onClose={() => setModal(null)} footer={<><button className={btnGhost} onClick={() => setModal(null)}>Hủy</button><button className={cn(btnBase, 'bg-[rgb(var(--danger))] px-3.5 py-2 font-semibold text-white')} onClick={() => { patch({ lostAt: todayISO(), lostReason: lost.reason, lostNote: lost.note.trim() || undefined }); audit('JOB_LOST', `${j.code} trượt: ${JOB_LOST[lost.reason]}`); setModal(null); }}>Xác nhận trượt</button></>}>
          <div className="space-y-3">
            <Field label="Lý do"><select className={inputCls} value={lost.reason} onChange={(e) => setLost({ ...lost, reason: e.target.value as JobLostReason })}>{(Object.keys(JOB_LOST) as JobLostReason[]).map((r) => <option key={r} value={r}>{JOB_LOST[r]}</option>)}</select></Field>
            <Field label="Ghi chú"><input className={inputCls} value={lost.note} onChange={(e) => setLost({ ...lost, note: e.target.value })} placeholder="VD: Khách chọn đơn vị rẻ hơn 15%" /></Field>
            <p className="text-xs text-[rgb(var(--muted))]">Đơn trượt chuyển sang danh sách "Cần theo dõi, chăm sóc" ở Phân lead.</p>
          </div>
        </Modal>
      )}
    </Drawer>
  );
}

export function JobsModule() {
  const { canDo, role, setIntent } = useApp();
  const [tab, setTab] = useSticky<'jobs' | 'commission'>('JobsModule.tab', 'jobs');
  const finance = canDo('cash.manage') || canDo('receipt.confirm') || role === 'BOD';
  return (
    <div className="space-y-5">
      <Tabs tabs={[{ id: 'jobs', label: 'Đơn hàng' }, { id: 'commission', label: finance ? 'Quyết toán hoa hồng' : 'Hoa hồng của tôi' }]} value={tab} onChange={setTab}
        aside={canDo('job.manage') || canDo('lead.create') ? <button className={cn(btnPrimary, btnSm, 'max-lg:hidden')} onClick={() => { setTab('jobs'); setIntent('job.create'); }}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm đơn</button> : undefined} />
      {tab === 'jobs' ? <JobsList /> : <CommissionPanel />}
    </div>
  );
}

export function JobsList() {
  const { jobs, customers, canDo, openJob, receipts, userName } = useApp();
  const info = useJobInfo();
  const inScope = useJobScope();
  const inR = useInRange();
  const [q, setQ] = useSticky('JobsList.q', '');
  const [st, setSt] = useState<JobFilter>('SURVEY');
  const [form, setForm] = useState(false);
  useIntent('job.create', () => setForm(true));
  const nowLocal = toLocal(new Date());
  const t = q.trim().toLowerCase();
  const rows = jobs.filter(inScope).map((j) => ({ j, ...info(j) }));
  const count = (f: JobFilter) => rows.filter((r) => (f === 'ALL' ? true : f === 'ACTIVE' ? !['DONE', 'LOST'].includes(r.stage) : r.stage === f)).length;
  const list = rows
    .filter((r) => (st === 'ALL' || (st === 'ACTIVE' ? !['DONE', 'LOST'].includes(r.stage) : r.stage === st)) && (!['DONE', 'LOST'].includes(r.stage) || inR(r.j.wonAt ?? r.j.lostAt ?? r.j.createdAt)))
    .filter((r) => !t || `${r.j.code} ${r.j.title} ${r.j.siteAddress} ${jobCustName(r.j, customers)} ${jobPhone(r.j, customers)}`.toLowerCase().includes(t))
    .sort((a, b) => (a.stage === 'SURVEY' && b.stage === 'SURVEY' ? (a.j.appointmentAt ?? '').localeCompare(b.j.appointmentAt ?? '') : JOB_STAGES.indexOf(a.stage) - JOB_STAGES.indexOf(b.stage) || b.j.createdAt.localeCompare(a.j.createdAt)));
  const srt = useSort('Jobs40', list, { 1: (r) => r.j.code, 2: (r) => jobCustName(r.j, customers), 7: (r) => r.j.appointmentAt });
  const paged = usePaged(srt.rows, 20);
  const startIdx = (paged.page - 1) * 20;
  const today = todayISO();
  const holding = receipts.filter((r) => r.status !== 'CONFIRMED' && r.status !== 'REJECTED');
  const pills: { id: JobFilter; label: string; count: number }[] = [
    { id: 'SURVEY', label: 'Chờ khảo sát', count: count('SURVEY') }, { id: 'QUOTED', label: 'Đã báo giá', count: count('QUOTED') },
    { id: 'PRODUCTION', label: 'Sản xuất', count: count('PRODUCTION') }, { id: 'INSTALL', label: 'Lắp đặt', count: count('INSTALL') },
    { id: 'WAIT_PAYMENT', label: 'Chờ thu tiền', count: count('WAIT_PAYMENT') }, { id: 'DONE', label: 'Hoàn tất', count: count('DONE') },
    { id: 'LOST', label: 'Trượt', count: count('LOST') }, { id: 'ACTIVE', label: 'Đang xử lý', count: count('ACTIVE') }, { id: 'ALL', label: 'Tất cả', count: count('ALL') },
  ];
  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Chờ khảo sát" value={String(count('SURVEY'))} icon={Ruler} color={C.blue} sub={`${rows.filter((r) => r.stage === 'SURVEY' && r.j.appointmentAt?.slice(0, 10) === today).length} lịch hẹn hôm nay`} />
        <StatCard label="Đã báo giá, chờ chốt" value={String(count('QUOTED'))} icon={FileText} color="#8B5CF6" sub={compact(rows.filter((r) => r.stage === 'QUOTED').reduce((s, r) => s + (r.j.quotes[r.j.quotes.length - 1]?.total ?? 0), 0))} />
        <StatCard label="Sản xuất & lắp đặt" value={String(count('PRODUCTION') + count('INSTALL'))} icon={Factory} color={C.orange} sub={`${count('PRODUCTION')} sản xuất, ${count('INSTALL')} lắp đặt`} />
        <StatCard label="Còn phải thu" value={compact(rows.filter((r) => r.j.wonAt && !r.j.lostAt).reduce((s, r) => s + r.money.receivable, 0))} icon={Banknote} color={C.red} sub={`${holding.length} phiếu chờ nộp / xác nhận`} />
      </div>
      <div className="tb40 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Tìm tên, số điện thoại, địa chỉ, mã đơn" />
        <div className="min-w-0 flex-1"><StagePills items={pills} value={st} onChange={(v) => { setSt(v); paged.setPage(1); }} /></div>
      </div>
      <Panel>
        <div className="space-y-2 md:hidden">
          {paged.slice.map(({ j, stage, detail }, i) => (
            <button key={j.id} className="w-full rounded bg-[rgb(var(--raised))] p-3 text-left" onClick={() => openJob(j.id)}>
              <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{startIdx + i + 1}. {jobCustName(j, customers)}</p><Chip tone={JOB_STAGE[stage].tone}>{JOB_STAGE[stage].short}</Chip></div>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{jobPhone(j, customers)}, {j.siteAddress}</p>
              <p className="mt-0.5 text-xs">{j.title}</p>
              <p className={cn('mt-1 text-xs', stage === 'SURVEY' && j.appointmentAt && j.appointmentAt < nowLocal ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--accent-fg))]')}>{stage === 'SURVEY' ? (j.appointmentAt ? `Hẹn ${fmtDT(j.appointmentAt)}` : 'Chưa hẹn') : detail}</p>
            </button>
          ))}
        </div>
        <div className="hidden md:block">
          <Table head={['STT', 'Mã đơn', 'Khách hàng', 'Điện thoại', 'Địa chỉ', 'Hạng mục', 'Phụ trách', 'Hẹn khảo sát', 'Trạng thái', 'Tiến độ', '']} minW={1360} sort={srt.th}>
            {paged.slice.map(({ j, stage, detail }, i) => {
              const late = stage === 'SURVEY' && j.appointmentAt && j.appointmentAt < nowLocal;
              return (
                <tr key={j.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => openJob(j.id)}>
                  <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{startIdx + i + 1}</td>
                  <td className={cn(tdCls, late && 'shadow-[inset_3px_0_0_rgb(var(--danger))]')}><Code>{j.code}</Code></td>
                  <td className={tdCls}><span className="block max-w-[220px] truncate font-medium">{jobCustName(j, customers)}</span></td>
                  <td className={cn(tdCls, 'tabular-nums')}>{jobPhone(j, customers)}</td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[220px] truncate" title={j.siteAddress}>{j.siteAddress}</span></td>
                  <td className={tdCls}><span className="block max-w-[220px] truncate" title={j.title}>{j.title}</span></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{j.ownerId ? userName(j.ownerId) : '—'}</td>
                  <td className={tdCls}>{j.appointmentAt ? (late ? <Sla tone="over">{fmtDT(j.appointmentAt)} · quá hẹn</Sla> : <span className="font-mono text-xs text-[rgb(var(--fg2))]">{fmtDT(j.appointmentAt)}</span>) : '—'}</td>
                  <td className={tdCls}><Chip tone={JOB_STAGE[stage].tone}>{JOB_STAGE[stage].label}</Chip></td>
                  <td className={cn(tdCls, 'text-[13px] text-[rgb(var(--muted))]')}><span className="block max-w-[200px] truncate">{stage === 'SURVEY' ? '—' : detail || '—'}</span></td>
                  <td className={tdLast}><div className="flex justify-end"><span onClick={(e) => e.stopPropagation()}><CommentButton entity="job" entityId={j.id} title={`${j.code} · ${jobCustName(j, customers)}`} module="jobs" /></span></div></td>
                </tr>
              );
            })}
          </Table>
        </div>
        {!list.length && <EmptyState text={<>Không có đơn ở trạng thái này.</>} art="box" />}
        <Pagination paged={paged} unit="đơn" />
      </Panel>
      <Fab label="Thêm lead" onClick={() => setForm(true)} disabled={!canDo('job.manage') && !canDo('lead.create')} />
      {form && <MfgLeadForm onClose={() => setForm(false)} />}
    </div>
  );
}

// ---------------- Phân lead (mô hình xưởng): 2 bước + danh sách chăm sóc ----------------

export function MfgLeadsPage() {
  const { jobs, customers, sources, userName, openJob, canDo, receipts, workOrders, installJobs } = useApp();
  const inR = useInRange();
  const inScope = useJobScope();
  const [tab, setTab] = useSticky<'new' | 'care'>('MfgLeadsPage.tab', 'new');
  const [q, setQ] = useSticky('MfgLeadsPage.q', '');
  const [form, setForm] = useState(false);
  useIntent('job.create', () => setForm(true));
  const [careFor, setCareFor] = useState<Job | null>(null);
  const t = q.trim().toLowerCase();
  const today = todayISO();
  const rows = jobs.filter(inScope).map((j) => ({ j, stage: jobStageOf(j, workOrders, installJobs, receipts), cust: customers.find((c) => c.id === j.customerId) }));
  const match = (r: (typeof rows)[number]) => !t || `${jobCustName(r.j, customers)} ${jobPhone(r.j, customers)} ${r.j.siteAddress} ${r.j.title}`.toLowerCase().includes(t);
  const fresh = rows.filter((r) => inR(r.j.createdAt) || r.stage === 'SURVEY');
  const newList = fresh.filter(match).sort((a, b) => b.j.createdAt.localeCompare(a.j.createdAt) || b.j.code.localeCompare(a.j.code));
  const careRows = rows.filter((r) => needsCare(r.stage)).map((r) => {
    const logs = [...(r.j.care ?? [])].sort((a, b) => b.at - a.at);
    const lastQ = r.j.quotes[r.j.quotes.length - 1];
    const days = lastQ ? Math.floor((Date.now() - Date.parse(lastQ.at)) / 864e5) : 0;
    return { ...r, last: logs[0], next: logs[0]?.nextAt, lastQ, days };
  });
  const careList = careRows.filter(match).sort((a, b) => (a.next ?? '0').localeCompare(b.next ?? '0'));
  const won = rows.filter((r) => r.j.wonAt && inR(r.j.wonAt)).length;
  const quotedIn = rows.filter((r) => r.j.quotes.length && inR(r.j.quotes[0].at)).length;
  const pagedNew = usePaged(newList, 20);
  const pagedCare = usePaged(careList, 20);
  const srcName = (id?: string) => sources.find((s) => s.id === id)?.name ?? '—';
  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Lead mới trong kỳ" value={String(rows.filter((r) => inR(r.j.createdAt)).length)} icon={Inbox} color="#8B5CF6" />
        <StatCard label="Đang chờ khảo sát" value={String(rows.filter((r) => r.stage === 'SURVEY').length)} icon={Ruler} color={C.blue} sub={`${rows.filter((r) => r.stage === 'SURVEY' && r.j.appointmentAt?.slice(0, 10) === today).length} lịch hẹn hôm nay`} />
        <StatCard label="Cần chăm sóc" value={String(careRows.length)} icon={MessageSquare} color={C.orange} sub={`${careRows.filter((r) => r.next && r.next <= today).length} đến hẹn chăm sóc`} />
        <StatCard label="Tỷ lệ chốt (kỳ)" value={pct(won, quotedIn)} icon={Target} color={C.teal} sub={`${won} chốt / ${quotedIn} báo giá`} />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 py-3 text-sm text-[rgb(var(--muted))]">
        <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-xs font-semibold text-[rgb(var(--on-accent))]">1</span>Thêm lead: tên, SĐT, địa chỉ, hạng mục, giờ hẹn</span>
        <ArrowRight className="h-4 w-4 max-sm:hidden" aria-hidden />
        <span className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] text-xs font-medium text-[rgb(var(--fg))]">2</span>Tự chuyển "Đang chờ khảo sát", kỹ thuật nhận lịch</span>
      </div>
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Tabs variant="pill" tabs={[{ id: 'new', label: 'Lead & lịch khảo sát', count: newList.length }, { id: 'care', label: 'Cần theo dõi, chăm sóc', count: careRows.length }]} value={tab} onChange={setTab} />
          <SearchBox value={q} onChange={setQ} placeholder="Tìm tên, SĐT, địa chỉ" />
          <button className={cn(btnPrimary, 'max-md:hidden')} disabled={!canDo('job.manage') && !canDo('lead.create')} onClick={() => setForm(true)}><Plus className="h-4 w-4" aria-hidden />Thêm lead</button>
        </div>
        {tab === 'new' ? (
          <>
            <Table head={['STT', 'Khách hàng', 'Số điện thoại', 'Địa chỉ', 'Hạng mục', 'Thời gian hẹn', 'Kỹ thuật', 'Trạng thái']} minW={1080}>
              {pagedNew.slice.map((r, i) => (
                <tr key={r.j.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => openJob(r.j.id)}>
                  <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{(pagedNew.page - 1) * 20 + i + 1}</td>
                  <td className={tdCls}><p className="font-medium">{jobCustName(r.j, customers)}</p><p className="text-xs text-[rgb(var(--muted))]">{srcName(r.cust?.sourceId)}</p></td>
                  <td className={cn(tdCls, 'whitespace-nowrap tabular-nums')}>{jobPhone(r.j, customers)}</td>
                  <td className={cn(tdCls, 'max-w-[220px]')}><p className="line-clamp-2 text-xs">{r.j.siteAddress}</p></td>
                  <td className={cn(tdCls, 'max-w-[200px]')}><p className="line-clamp-2 text-xs">{r.j.title}</p></td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-xs tabular-nums')}>{r.j.appointmentAt ? fmtDT(r.j.appointmentAt) : '—'}</td>
                  <td className={cn(tdCls, 'text-xs')}>{userName(r.j.ownerId)}</td>
                  <td className={tdLast}><Chip tone={JOB_STAGE[r.stage].tone}>{JOB_STAGE[r.stage].short}</Chip></td>
                </tr>
              ))}
            </Table>
            {!newList.length && <EmptyState text={<>Chưa có lead nào</>} hint={<>Lead mới từ MKT hoặc do kỹ thuật tự nhập sẽ hiện ở đây kèm lịch khảo sát.</>} art="inbox" action="Tạo lead ngay" onAction={() => setForm(true)} />}
            <Pagination paged={pagedNew} unit="lead" />
          </>
        ) : (
          <>
            <Table head={['STT', 'Khách hàng', 'Số điện thoại', 'Hạng mục', 'Báo giá', 'Tình trạng', 'Chăm sóc gần nhất', 'Hẹn lại', '']} minW={1120}>
              {pagedCare.slice.map((r, i) => (
                <tr key={r.j.id} className={rowCls}>
                  <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{(pagedCare.page - 1) * 20 + i + 1}</td>
                  <td className={tdCls}><button className="text-left font-medium hover:text-[rgb(var(--accent-fg))]" onClick={() => openJob(r.j.id)}>{jobCustName(r.j, customers)}</button><p className="text-xs text-[rgb(var(--muted))]">{r.j.code}</p></td>
                  <td className={cn(tdCls, 'whitespace-nowrap tabular-nums')}>{jobPhone(r.j, customers)}</td>
                  <td className={cn(tdCls, 'max-w-[200px]')}><p className="line-clamp-2 text-xs">{r.j.title}</p></td>
                  <td className={cn(tdCls, 'text-right tabular-nums whitespace-nowrap')}>{r.lastQ ? compact(r.lastQ.total) : '—'}</td>
                  <td className={cn(tdCls, 'text-xs')}>{r.stage === 'LOST' ? <span className="text-[rgb(var(--danger-fg))]">Trượt: {JOB_LOST[r.j.lostReason ?? 'OTHER']}</span> : <span className={r.days > 7 ? 'text-[rgb(var(--accent-fg))]' : ''}>Báo giá {r.days} ngày chưa chốt</span>}</td>
                  <td className={cn(tdCls, 'max-w-[220px] text-xs')}>{r.last ? <><p className="line-clamp-2">{r.last.note}</p><p className="text-[rgb(var(--muted))]">{new Date(r.last.at).toLocaleDateString('vi-VN')}</p></> : <span className="text-[rgb(var(--muted))]">Chưa chăm sóc</span>}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-xs tabular-nums', r.next && r.next <= today && 'text-[rgb(var(--danger-fg))]')}>{r.next ? fmtDate(r.next) : '—'}</td>
                  <td className={tdLast}><button className={cn(btnGhost, btnSm, 'whitespace-nowrap')} onClick={() => setCareFor(r.j)}><MessageSquare className="h-3.5 w-3.5" aria-hidden />Chăm sóc</button></td>
                </tr>
              ))}
            </Table>
            {!careList.length && <EmptyState text={<>Không có khách cần chăm sóc.</>} art="box" />}
            <Pagination paged={pagedCare} unit="khách" />
          </>
        )}
      </Panel>
      <Fab label="Thêm lead" onClick={() => setForm(true)} disabled={!canDo('job.manage') && !canDo('lead.create')} />
      {form && <MfgLeadForm onClose={() => setForm(false)} />}
      {careFor && <CareModal job={careFor} onClose={() => setCareFor(null)} />}
    </div>
  );
}

