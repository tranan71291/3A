'use client';

import { useEffect, useRef, useState } from 'react';
import { Banknote, CalendarDays, Camera, ClipboardCheck, Download, HardHat, MapPin, ShieldCheck, Upload } from 'lucide-react';
import { Pagination, usePaged } from '../../components/controls';
import { Drawer } from '../../components/drawer';
import { useInRange } from '../../components/filters';
import { Chip, EmptyState, Field, FilePicker, Modal, MoneyInput, Panel, StatCard, Table, useSticky } from '../../components/ui';
import { addMonthsISO, btnBase, btnGhost, btnPrimary, btnSm, C, compact, esc, fmtDate, fmtDT, inputCls, INSTALL_VIEW, installView, jobCustName, jobPhone, kpiGrid, nextCode, pad2, rowCls, tdCls, tdFirst, tdLast, todayISO, toLocal, uid, useApp, vnd } from '../../lib/core';
import type { CompanyInfo, InstallAcceptance, InstallJob, InstallRow, InstallView, Job, Receipt, WorkOrder } from '../../lib/types';
import { cn } from '../../lib/utils';
import { compressImage, jobMoney } from '../../lib/workshop';
import { InfoGrid, MiniStat, ReceiptModal, SearchBox, StagePills } from './orders';
import { docShell, moneyToWordsVN, printHtml } from '../sales/templates';
import { watermarkPhoto } from '../staff/staff';

export function InstallScheduleModal({ wo, ij, onClose }: { wo?: WorkOrder; ij?: InstallJob; onClose: () => void }) {
  const { installJobs, setInstallJobs, jobs, users, me, notify, audit, dispatch, customers } = useApp();
  const job = jobs.find((j) => j.id === (ij?.jobId ?? wo?.jobId));
  const start = new Date(Date.now() + 864e5); start.setHours(8, 0, 0, 0);
  const end = new Date(start); end.setHours(17, 0, 0, 0);
  const team0 = users.filter((u) => u.active && u.dept === 'LAP_DAT');
  const [f, setF] = useState({ from: ij?.from || toLocal(start), to: ij?.to || toLocal(end), leaderId: ij?.leaderId ?? team0[0]?.id ?? me.id, team: ij?.team ?? [], address: ij?.address ?? job?.siteAddress ?? '', note: ij?.note ?? '' });
  const [touched, setTouched] = useState(false);
  const errs: string[] = [];
  if (!f.from || !f.to || f.to <= f.from) errs.push('Giờ kết thúc phải sau giờ bắt đầu');
  if (f.address.trim().length < 5) errs.push('Nhập địa chỉ lắp đặt');
  const save = () => {
    setTouched(true);
    if (errs.length) return;
    if (ij) {
      setInstallJobs((all) => all.map((x) => (x.id === ij.id ? { ...x, ...f, address: f.address.trim(), note: f.note.trim() } : x)));
      notify('Đã đổi lịch lắp đặt', 'teal');
    } else {
      const code = nextCode(installJobs.map((x) => x.code), `LD-${new Date().getFullYear()}-`, 4);
      const n: InstallJob = { id: uid('ij'), code, title: `Lắp đặt ${job?.title ?? wo?.title ?? ''}`, workOrderId: wo?.id, jobId: job?.id, leadId: job?.leadId, customerId: job?.customerId ?? wo?.customerId, address: f.address.trim(), leaderId: f.leaderId, team: f.team, from: f.from, to: f.to, status: 'SCHEDULED', checkins: [], defects: [], note: f.note.trim(), createdAt: todayISO() };
      setInstallJobs((p) => [n, ...p]);
      const leader = users.find((u) => u.id === f.leaderId);
      if (leader && leader.id !== me.id) dispatch('APPROVAL_RESULT', { to: leader, title: `Lịch lắp đặt ${fmtDT(f.from)}`, body: `${job ? jobCustName(job, customers) : ''}, ${f.address.trim()}`, module: 'install' });
      audit('INSTALL_CREATE', `Hẹn lắp ${code} ${fmtDT(f.from)}`);
      notify(`Đã hẹn lắp đặt ${fmtDT(f.from)}, chuyển sang Lắp đặt`, 'teal');
    }
    onClose();
  };
  return (
    <Modal title={ij ? `Đổi lịch ${ij.code}` : 'Lên lịch lắp đặt'} onClose={onClose} wide footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>{ij ? 'Lưu lịch' : 'Hẹn lắp đặt'}</button></>}>
      {job && <p className="mb-4 rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm"><b>{jobCustName(job, customers)}</b>, {jobPhone(job, customers)}<span className="block text-xs text-[rgb(var(--muted))]">{job.title}</span></p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Bắt đầu lắp *"><input className={inputCls} type="datetime-local" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="Dự kiến xong *"><input className={inputCls} type="datetime-local" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Field label="Địa chỉ lắp đặt *" className="sm:col-span-2"><input className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="Đội trưởng (bàn giao, thu tiền)"><select className={inputCls} value={f.leaderId} onChange={(e) => setF({ ...f, leaderId: e.target.value })}>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Ghi chú"><input className={inputCls} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Giờ thi công, thang máy, bảo vệ tòa nhà..." /></Field>
      </div>
      <p className="mb-2 mt-4 text-xs font-medium text-[rgb(var(--muted))]">Thành viên đội lắp</p>
      <div className="flex flex-wrap gap-2">
        {(team0.length ? team0 : users.filter((u) => u.active)).filter((u) => u.id !== f.leaderId).map((u) => (
          <label key={u.id} className={cn('flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs', f.team.includes(u.id) ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))]')}>
            <input type="checkbox" className="sr-only" checked={f.team.includes(u.id)} onChange={() => setF({ ...f, team: f.team.includes(u.id) ? f.team.filter((x) => x !== u.id) : [...f.team, u.id] })} />{u.name}
          </label>
        ))}
      </div>
      {touched && errs.length > 0 && <ul className="mt-3 space-y-0.5 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
    </Modal>
  );
}

/** Khung ký tay điện tử (chuột / cảm ứng / bút), xuất ảnh PNG nền trắng */
export function SignaturePad({ label, signer, value, onChange }: { label: string; signer?: string; value?: string; onChange: (v?: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const setup = () => {
    const c = ref.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(r.width * dpr)) {
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
      const ctx = c.getContext('2d');
      if (ctx) { ctx.scale(dpr, dpr); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, r.width, r.height); }
    }
    return c.getContext('2d');
  };
  useEffect(() => { setup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pt = (e: { clientX: number; clientY: number }) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: { clientX: number; clientY: number; pointerId: number; currentTarget: HTMLCanvasElement }) => { setup(); drawing.current = true; lastPt.current = pt(e); e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e: { clientX: number; clientY: number }) => {
    if (!drawing.current || !lastPt.current) return;
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const p = pt(e);
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(lastPt.current.x, lastPt.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    lastPt.current = p;
  };
  const up = () => { if (!drawing.current) return; drawing.current = false; lastPt.current = null; onChange(ref.current?.toDataURL('image/png')); };
  const clear = () => { const c = ref.current; const ctx = c?.getContext('2d'); if (c && ctx) { const r = c.getBoundingClientRect(); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, r.width, r.height); } onChange(undefined); };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-xs font-medium text-[rgb(var(--muted))]">{label}</span><button type="button" className="text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={clear}>Ký lại</button></div>
      <div className={cn('relative overflow-hidden rounded border-2', value ? 'border-[rgb(var(--success))]' : 'border-dashed border-[rgb(var(--line))]')}>
        <canvas ref={ref} className="block h-36 w-full cursor-crosshair touch-none bg-white" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label={label} />
        {!value && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">Ký vào đây</span>}
      </div>
      {signer && <p className="mt-1 text-center text-xs text-[rgb(var(--muted))]">{signer}</p>}
    </div>
  );
}

export async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function AcceptanceModal({ ij, onClose }: { ij: InstallJob; onClose: () => void }) {
  const { me, jobs, workOrders, receipts, setReceipts, setInstallJobs, setWorkOrders, customers, users, dispatch, notify, audit, installJobs, mfgConfig } = useApp();
  const job = jobs.find((j) => j.id === ij.jobId);
  const wo = workOrders.find((w) => w.id === ij.workOrderId);
  const items = wo?.items.map((x) => x.name) ?? (job?.quotes.find((q) => q.version === job.wonVersion)?.lines.map((l) => `${l.location ? `${l.location}: ` : ''}${l.name}`) ?? []);
  const money = job ? jobMoney(job, receipts) : { value: 0, collected: 0, remaining: 0, confirmed: 0, pending: 0, receivable: 0 };
  const cust = customers.find((c) => c.id === (job?.customerId ?? ij.customerId));
  const [checked, setChecked] = useState<string[]>(items);
  const [note, setNote] = useState(ij.defects.filter((d) => !d.fixed).map((d) => d.text).join('; '));
  const [rep, setRep] = useState(job?.siteContact ?? cust?.name ?? '');
  const [repTitle, setRepTitle] = useState('Chủ nhà');
  const [repPhone, setRepPhone] = useState(job?.sitePhone ?? cust?.contactPhone ?? '');
  const [pay, setPay] = useState(money.remaining);
  const [method, setMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [photo, setPhoto] = useState<string | undefined>();
  const [months, setMonths] = useState(job?.warrantyMonths ?? mfgConfig.warrantyMonths);
  const [custSign, setCustSign] = useState<string | undefined>();
  const [staffSign, setStaffSign] = useState<string | undefined>();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const today = todayISO();
  const until = addMonthsISO(today, months);
  const debtAfter = Math.max(0, money.remaining - pay);
  const result: 'PASS' | 'PASS_WITH_NOTES' = note.trim() || checked.length < items.length ? 'PASS_WITH_NOTES' : 'PASS';
  const errs: string[] = [];
  if (rep.trim().length < 2) errs.push('Nhập người đại diện khách nhận bàn giao');
  if (!custSign) errs.push('Khách hàng chưa ký');
  if (!staffSign) errs.push('Đại diện công ty chưa ký');
  if (!agree) errs.push('Xác nhận khách đã đọc và đồng ý nội dung biên bản');
  if (pay > 0 && method === 'TRANSFER' && !photo) errs.push('Chuyển khoản: chụp màn hình giao dịch');
  if (pay > money.remaining) errs.push('Số tiền thu vượt số còn phải thu');
  const save = async () => {
    setTouched(true);
    if (errs.length) return notify(errs[0], 'red');
    setBusy(true);
    try {
      const docCode = nextCode(installJobs.map((x) => x.acceptance?.docCode ?? ''), `BBNT-${new Date().getFullYear()}-`, 4);
      const signedAt = Date.now();
      let receiptId: string | undefined;
      if (pay > 0 && job) {
        const r: Receipt = {
          id: uid('rc'), code: nextCode(receipts.map((x) => x.code), `PT-${new Date().getFullYear()}-`, 4), jobId: job.id, stageId: job.schedule.find((s) => s.trigger === 'ACCEPT')?.id, amount: pay, method,
          collectedBy: me.id, collectedAt: signedAt, photo, note: `Thu khi bàn giao, ${docCode}`, status: method === 'CASH' ? 'HOLDING' : 'SUBMITTED', submittedAt: method === 'CASH' ? undefined : signedAt,
        };
        receiptId = r.id;
        setReceipts((p) => [r, ...p]);
        users.filter((u) => u.active && u.role === 'ACCOUNTANT').forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title: `Thu khi bàn giao ${r.code}: ${vnd(pay)}`, body: `${jobCustName(job, customers)}, ${method === 'CASH' ? 'tiền mặt, nộp trong ngày' : 'chuyển khoản, chờ đối chiếu'}`, module: 'tasks' }));
      }
      const payload = { docCode, job: job?.code, install: ij.code, items: checked, note: note.trim(), rep: rep.trim(), pay, method, debtAfter, months, until, signedAt, by: me.id };
      const hash = await sha256Hex(JSON.stringify(payload) + (custSign ?? '').slice(-64) + (staffSign ?? '').slice(-64));
      const acc: InstallAcceptance = {
        at: new Date(signedAt).toISOString(), customerRep: rep.trim(), customerTitle: repTitle.trim(), customerPhone: repPhone.trim(), result, note: note.trim(), by: me.id,
        docCode, checked, customerSign: custSign, staffSign, signedAt, hash, paidAmount: pay, paidMethod: pay > 0 ? method : undefined, receiptId, debtAfter, warrantyMonths: months, warrantyUntil: until,
      };
      setInstallJobs((all) => all.map((x) => (x.id === ij.id ? { ...x, status: 'ACCEPTED', acceptance: acc } : x)));
      if (wo && wo.stage !== 'DONE') setWorkOrders((all) => all.map((w) => (w.id === wo.id ? { ...w, stage: 'DONE' } : w)));
      audit('INSTALL_ACCEPT', `${docCode}: nghiệm thu ${ij.code}, thu ${vnd(pay)}, bảo hành đến ${fmtDate(until)}`);
      notify(`Đã ký biên bản ${docCode}.${pay > 0 && method === 'CASH' ? ` Nộp ${vnd(pay)} về kế toán trong ngày.` : ''} Xuất PDF gửi khách.`, 'teal');
      onClose();
    } catch { notify('Không ký được biên bản, thử lại', 'red'); } finally { setBusy(false); }
  };
  const sec = 'rounded-md border border-[rgb(var(--line))] p-4';
  return (
    <Modal title="Nghiệm thu, bàn giao & thu tiền" onClose={onClose} wide
      footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={cn(btnBase, 'bg-[rgb(var(--success))] px-3.5 py-2 font-semibold text-[rgb(var(--on-accent))] hover:bg-[rgb(var(--success-fg))]')} disabled={busy} onClick={() => void save()}><ShieldCheck className="h-4 w-4" aria-hidden />{busy ? 'Đang ký...' : 'Ký & hoàn tất bàn giao'}</button></>}>
      <div className="space-y-4">
        <section className={sec}>
          <h3 className="mb-2 text-sm font-semibold">1. Hạng mục bàn giao</h3>
          <ul className="space-y-1.5">
            {items.map((x) => (
              <li key={x}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--success))]" checked={checked.includes(x)} onChange={() => setChecked((c) => (c.includes(x) ? c.filter((y) => y !== x) : [...c, x]))} />
                  <span className={checked.includes(x) ? '' : 'text-[rgb(var(--muted))] line-through'}>{x}</span>
                </label>
              </li>
            ))}
          </ul>
          <Field label="Tồn tại cần khắc phục (nếu có)" className="mt-3"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Bổ sung keo silicon góc cửa sổ phòng ngủ" /></Field>
          <p className="mt-2 text-xs"><Chip tone={result === 'PASS' ? 'teal' : 'orange'}>{result === 'PASS' ? 'Đạt yêu cầu' : 'Đạt, có tồn tại khắc phục'}</Chip></p>
        </section>

        <section className={sec}>
          <h3 className="mb-2 text-sm font-semibold">2. Thanh toán</h3>
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="Giá trị hợp đồng" value={compact(money.value)} />
            <MiniStat label="Đã thanh toán" value={compact(money.collected)} tone="teal" />
            <MiniStat label="Còn phải thu" value={compact(money.remaining)} tone={money.remaining ? 'red' : 'teal'} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Thu khi bàn giao"><MoneyInput value={pay} onChange={setPay} /></Field>
            <Field label="Hình thức">
              <div className="flex rounded bg-[rgb(var(--bg))] p-0.5" role="radiogroup" aria-label="Hình thức">
                {(['CASH', 'TRANSFER'] as const).map((m) => <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={cn('flex-1 rounded-md px-3 py-2 text-sm font-medium', method === m ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))]')}>{m === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</button>)}
              </div>
            </Field>
          </div>
          {pay > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <FilePicker accept="image/*" onFiles={(f) => compressImage(f[0], 1000).then(setPhoto).catch(() => notify('Không đọc được ảnh', 'red'))} className={cn(btnGhost, btnSm, 'inline-flex')}><Upload className="h-3.5 w-3.5" aria-hidden />{photo ? 'Đổi ảnh' : method === 'TRANSFER' ? 'Ảnh chuyển khoản *' : 'Ảnh tiền / phiếu (tùy chọn)'}</FilePicker>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo && <img src={photo} alt="Chứng từ" className="h-12 rounded object-cover" />}
            </div>
          )}
          <p className={cn('mt-2 text-xs', debtAfter ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--success-fg))]')}>{debtAfter ? `Sau bàn giao còn nợ ${vnd(debtAfter)}, ghi vào biên bản.` : 'Khách thanh toán đủ khi bàn giao.'}</p>
        </section>

        <section className={sec}>
          <h3 className="mb-2 text-sm font-semibold">3. Bảo hành</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Thời hạn (tháng)"><input className={inputCls} type="number" min={0} max={120} value={months} onChange={(e) => setMonths(Math.max(0, Number(e.target.value) || 0))} /></Field>
            <Field label="Từ ngày"><input className={inputCls} value={fmtDate(today)} disabled /></Field>
            <Field label="Đến ngày"><input className={inputCls} value={fmtDate(until)} disabled /></Field>
          </div>
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">Bảo hành có hiệu lực khi khách thanh toán đủ giá trị hợp đồng. Không bảo hành hư hỏng do tác động ngoại lực, tự ý tháo lắp, thiên tai.</p>
        </section>

        <section className={sec}>
          <h3 className="mb-2 text-sm font-semibold">4. Đại diện & ký điện tử</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Đại diện khách *"><input className={inputCls} value={rep} onChange={(e) => setRep(e.target.value)} /></Field>
            <Field label="Chức vụ / quan hệ"><input className={inputCls} value={repTitle} onChange={(e) => setRepTitle(e.target.value)} /></Field>
            <Field label="Số điện thoại"><input className={inputCls} inputMode="tel" value={repPhone} onChange={(e) => setRepPhone(e.target.value)} /></Field>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SignaturePad label="Chữ ký khách hàng *" signer={rep} value={custSign} onChange={setCustSign} />
            <SignaturePad label="Chữ ký đại diện công ty *" signer={me.name} value={staffSign} onChange={setStaffSign} />
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--success))]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Khách hàng đã kiểm tra, đọc và đồng ý nội dung nghiệm thu, thanh toán và điều kiện bảo hành.</span>
          </label>
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">Ký lúc lưu được đóng dấu thời gian và mã xác thực SHA-256 in trên biên bản để đối chiếu, chống sửa nội dung sau khi ký.</p>
        </section>
        {touched && errs.length > 0 && <ul className="space-y-0.5 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
      </div>
    </Modal>
  );
}

/** Biên bản nghiệm thu, bàn giao, thanh toán & xác nhận bảo hành (in PDF) */
export function acceptanceHtml(i: InstallJob, job: Job | undefined, company: CompanyInfo, custName: string, staff: string, prevPaid: number) {
  const a = i.acceptance!;
  const items = (a.checked ?? []).map((x, k) => `<tr><td class="c">${k + 1}</td><td>${esc(x)}</td><td class="c">Đạt</td></tr>`).join('') || '<tr><td colspan="3" class="c">Theo hợp đồng</td></tr>';
  const value = job?.contractValue ?? 0;
  const sig = (src?: string) => (src ? `<img src="${src}" alt="Chữ ký" style="height:70px;max-width:220px;object-fit:contain">` : '<br><br><br>');
  const t = new Date(a.signedAt ?? Date.parse(a.at));
  return `<table class="layout"><tr><td><b>${esc(company.legalName)}</b><br>${esc(company.address)}<br>ĐT: ${esc(company.phone)}</td><td class="r">Số: <b>${esc(a.docCode ?? i.code)}</b><br>Ngày: ${t.toLocaleDateString('vi-VN')}</td></tr></table>
<h1>BIÊN BẢN NGHIỆM THU, BÀN GIAO,<br>THANH TOÁN VÀ XÁC NHẬN BẢO HÀNH</h1>
<p>Công trình: <b>${esc(job?.title ?? i.title)}</b>${job ? ` (đơn ${esc(job.code)})` : ''}<br>Địa chỉ: ${esc(i.address)}<br>Thời gian: ${t.toLocaleString('vi-VN')}</p>
<p><b>BÊN A (KHÁCH HÀNG):</b> ${esc(custName)}<br>Đại diện: ${esc(a.customerRep)}${a.customerTitle ? `, ${esc(a.customerTitle)}` : ''}${a.customerPhone ? `, ĐT ${esc(a.customerPhone)}` : ''}</p>
<p><b>BÊN B (ĐƠN VỊ THI CÔNG):</b> ${esc(company.legalName)}<br>Đại diện: ${esc(staff)}</p>
<h3>1. Hạng mục nghiệm thu, bàn giao</h3>
<table class="items"><thead><tr><th>STT</th><th>Hạng mục</th><th>Kết quả</th></tr></thead><tbody>${items}</tbody></table>
<p>Kết luận: ${a.result === 'PASS' ? 'Đạt yêu cầu, Bên A đồng ý nghiệm thu và nhận bàn giao đưa vào sử dụng.' : 'Đạt yêu cầu, Bên A đồng ý nghiệm thu; Bên B khắc phục tồn tại sau.'}${a.note ? `<br>Tồn tại: ${esc(a.note)}` : ''}</p>
<h3>2. Thanh toán</h3>
<table class="items"><tbody>
<tr><td>Giá trị hợp đồng</td><td class="r">${value.toLocaleString('vi-VN')} đ</td></tr>
<tr><td>Đã thanh toán trước bàn giao</td><td class="r">${prevPaid.toLocaleString('vi-VN')} đ</td></tr>
<tr><td>Thanh toán khi bàn giao${a.paidMethod ? ` (${a.paidMethod === 'CASH' ? 'tiền mặt' : 'chuyển khoản'})` : ''}</td><td class="r">${(a.paidAmount ?? 0).toLocaleString('vi-VN')} đ</td></tr>
<tr><td><b>Còn lại</b></td><td class="r"><b>${(a.debtAfter ?? 0).toLocaleString('vi-VN')} đ</b></td></tr></tbody></table>
${a.debtAfter ? `<p>Bên A cam kết thanh toán số còn lại ${moneyToWordsVN(a.debtAfter).toLowerCase()} theo thỏa thuận.</p>` : '<p>Bên A đã thanh toán đủ giá trị hợp đồng.</p>'}
<h3>3. Xác nhận bảo hành</h3>
<p>Thời hạn bảo hành <b>${a.warrantyMonths ?? job?.warrantyMonths ?? 0} tháng</b>, từ ${t.toLocaleDateString('vi-VN')} đến <b>${a.warrantyUntil ? fmtDate(a.warrantyUntil) : ''}</b>. Bảo hành có hiệu lực khi Bên A thanh toán đủ. Không áp dụng cho hư hỏng do tác động ngoại lực, tự ý tháo lắp, sửa chữa hoặc thiên tai.${company.phone ? ` Liên hệ bảo hành: ${esc(company.phone)}.` : ''}</p>
<table class="layout sign"><tr><td><b>ĐẠI DIỆN BÊN A</b><br>(ký điện tử)<br>${sig(a.customerSign)}<br><b>${esc(a.customerRep)}</b></td><td><b>ĐẠI DIỆN BÊN B</b><br>(ký điện tử)<br>${sig(a.staffSign)}<br><b>${esc(staff)}</b></td></tr></table>
<p class="small" style="font-size:9pt;color:#555;margin-top:12px">Ký điện tử lúc ${t.toLocaleString('vi-VN')}. Mã xác thực: ${esc((a.hash ?? '').slice(0, 32).toUpperCase())}</p>`;
}

export function InstallDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { installJobs, setInstallJobs, users, userName, me, canDo, notify, company, jobs, receipts, customers, openJob } = useApp();
  const i = installJobs.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'accept' | 'reschedule' | 'collect' | null>(null);
  if (!i) return null;
  const job = jobs.find((j) => j.id === i.jobId);
  const view = installView(i, job, receipts);
  const can = canDo('install.manage');
  const money = job ? jobMoney(job, receipts) : null;
  const custName = job ? jobCustName(job, customers) : customers.find((c) => c.id === i.customerId)?.name ?? 'Khách hàng';
  const patch = (p: Partial<InstallJob>) => setInstallJobs((all) => all.map((x) => (x.id === i.id ? { ...x, ...p } : x)));
  const a = i.acceptance;
  const prevPaid = money ? Math.max(0, money.collected - (a?.paidAmount ?? 0)) : 0;
  const print = () => printHtml(docShell(`Biên bản ${a?.docCode ?? i.code}`, acceptanceHtml(i, job, company, custName, userName(a?.by ?? i.leaderId), prevPaid)));
  const checkin = (files: File[]) => {
    setBusy(true);
    const finish = (lat: number, lng: number, simulated: boolean) => {
      const at = new Date();
      const lines = [`${me.name} ${pad2(at.getHours())}:${pad2(at.getMinutes())} ${pad2(at.getDate())}/${pad2(at.getMonth() + 1)}/${at.getFullYear()}`, `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}${simulated ? ' (mô phỏng)' : ''}`, i.code];
      Promise.all(files.map(async (f) => ({ name: f.name, url: await watermarkPhoto(f, lines) })))
        .then((photos) => { patch({ checkins: [...i.checkins, { at: at.toISOString(), lat, lng, simulated, photos }], status: i.status === 'SCHEDULED' ? 'IN_PROGRESS' : i.status }); notify(`Đã check-in công trình${photos.length ? `, ${photos.length} ảnh có watermark` : ''}`, 'teal'); })
        .catch((e) => notify(e instanceof Error ? e.message : 'Không xử lý được ảnh', 'red'))
        .finally(() => setBusy(false));
    };
    if (typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => finish(p.coords.latitude, p.coords.longitude, false), () => finish(10.79 + Math.random() * 0.02, 106.68 + Math.random() * 0.02, true), { timeout: 8000 });
    else finish(10.79, 106.68, true);
  };
  return (
    <Drawer title={custName} eyebrow={`${i.code}${job ? ` · ${job.code}` : ''}`} badge={<Chip tone={INSTALL_VIEW[view].tone}>{INSTALL_VIEW[view].label}</Chip>} onClose={onClose}
      actions={<>
        {i.status !== 'ACCEPTED' && can && <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--success))] font-semibold text-[rgb(var(--on-accent))] hover:bg-[rgb(var(--success-fg))]')} onClick={() => setModal('accept')}><ClipboardCheck className="h-3.5 w-3.5" aria-hidden />Nghiệm thu, bàn giao & thu tiền</button>}
        {i.status !== 'ACCEPTED' && can && <button className={cn(btnGhost, btnSm)} onClick={() => setModal('reschedule')}><CalendarDays className="h-3.5 w-3.5" aria-hidden />Đổi lịch</button>}
        {a && <button className={cn(btnPrimary, btnSm)} onClick={print}><Download className="h-3.5 w-3.5" aria-hidden />Biên bản PDF</button>}
        {a && money && money.remaining > 0 && (can || canDo('job.manage')) && <button className={cn(btnGhost, btnSm)} onClick={() => setModal('collect')}><Banknote className="h-3.5 w-3.5" aria-hidden />Thu tiền còn lại</button>}
        {job && <button className={cn(btnGhost, btnSm)} onClick={() => { onClose(); openJob(job.id); }}>Mở đơn</button>}
      </>}>
      <InfoGrid rows={[
        ['Khách hàng', custName],
        ['Số điện thoại', job ? jobPhone(job, customers) : ''],
        ['Địa chỉ', i.address, true],
        ['Thời gian lắp đặt', i.from ? `${fmtDT(i.from)} – ${fmtDT(i.to)}` : ''],
        ['Đội trưởng', userName(i.leaderId)],
        ['Thành viên', i.team.map((x) => users.find((u) => u.id === x)?.name).filter(Boolean).join(', ')],
        ['Hạng mục', job?.title ?? i.title],
        ['Ghi chú', i.note],
      ]} />
      {money && (
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Giá trị hợp đồng" value={compact(money.value)} />
          <MiniStat label="Đã thu" value={compact(money.collected)} tone="teal" />
          <MiniStat label="Còn phải thu" value={compact(money.remaining)} tone={money.remaining ? 'red' : 'teal'} />
        </div>
      )}
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Check-in công trình ({i.checkins.length})</h3>
          {can && i.status !== 'ACCEPTED' && <FilePicker accept="image/*" multiple disabled={busy} onFiles={checkin} className={cn(btnGhost, btnSm, 'inline-flex')}><Camera className="h-3.5 w-3.5" aria-hidden />{busy ? 'Đang lấy vị trí...' : 'Check-in & chụp ảnh'}</FilePicker>}
        </div>
        {i.checkins.length ? (
          <ul className="space-y-2">
            {i.checkins.map((c, k) => (
              <li key={k} className="rounded bg-[rgb(var(--raised))] p-2.5 text-xs">
                <p>{new Date(c.at).toLocaleString('vi-VN')}, GPS {c.lat.toFixed(5)}, {c.lng.toFixed(5)}{c.simulated ? ' (mô phỏng)' : ''}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.photos.length > 0 && <div className="mt-2 grid grid-cols-4 gap-1.5">{c.photos.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.name} className="aspect-square w-full rounded object-cover" /></a>)}</div>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-[rgb(var(--muted))]">Đến công trình, check-in để chuyển "Đang lắp đặt".</p>}
      </section>
      {a && (
        <section className="rounded-md border border-[rgb(var(--success)/0.4)] bg-[rgb(var(--success)/0.05)] p-4">
          <h3 className="text-sm font-semibold text-[rgb(var(--success-fg))]">Biên bản {a.docCode}: {a.result === 'PASS' ? 'Đạt' : 'Đạt, có tồn tại'}</h3>
          <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-[rgb(var(--muted))]">Ký lúc</dt><dd>{new Date(a.signedAt ?? Date.parse(a.at)).toLocaleString('vi-VN')}</dd></div>
            <div><dt className="text-xs text-[rgb(var(--muted))]">Đại diện khách</dt><dd>{a.customerRep}{a.customerTitle ? `, ${a.customerTitle}` : ''}</dd></div>
            <div><dt className="text-xs text-[rgb(var(--muted))]">Thu khi bàn giao</dt><dd className="tabular-nums">{vnd(a.paidAmount ?? 0)}{a.paidMethod ? `, ${a.paidMethod === 'CASH' ? 'tiền mặt' : 'chuyển khoản'}` : ''}</dd></div>
            <div><dt className="text-xs text-[rgb(var(--muted))]">Bảo hành</dt><dd>{a.warrantyMonths ?? 0} tháng, đến {a.warrantyUntil ? fmtDate(a.warrantyUntil) : '—'}</dd></div>
          </dl>
          {a.note && <p className="mt-2 text-xs text-[rgb(var(--accent-fg))]">Tồn tại: {a.note}</p>}
          {(a.customerSign || a.staffSign) && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {[['Khách hàng', a.customerSign], ['Công ty', a.staffSign]].map(([k, v]) => <div key={k} className="rounded bg-white p-1.5"><p className="text-[10px] text-slate-500">{k}</p>{v && <img src={v} alt={`Chữ ký ${k}`} className="h-14 w-full object-contain" />}</div>)}
            </div>
          )}
          {a.hash && <p className="mt-2 break-all font-mono text-[10px] text-[rgb(var(--muted))]">Mã xác thực {a.hash.slice(0, 32).toUpperCase()}</p>}
        </section>
      )}
      {modal === 'accept' && <AcceptanceModal ij={i} onClose={() => setModal(null)} />}
      {modal === 'reschedule' && <InstallScheduleModal ij={i} onClose={() => setModal(null)} />}
      {modal === 'collect' && job && money && <ReceiptModal job={job} amount={money.remaining} stageId={job.schedule.find((s) => s.trigger === 'ACCEPT')?.id} title="Thu tiền còn lại" onClose={() => setModal(null)} />}
    </Drawer>
  );
}

export function InstallModule() {
  const { installJobs, workOrders, jobs, customers, receipts, canDo, userName } = useApp();
  const inR = useInRange();
  const [st, setSt] = useState<InstallView | 'ALL'>('ALL');
  const [q, setQ] = useSticky('InstallModule.q', '');
  const [open, setOpen] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<WorkOrder | null>(null);
  const t = q.trim().toLowerCase();
  const rows: InstallRow[] = [
    ...workOrders.filter((w) => w.stage === 'DONE' && w.jobId && !installJobs.some((i) => i.workOrderId === w.id)).map((w): InstallRow => ({ key: `w${w.id}`, view: 'WAIT' as InstallView, wo: w, job: jobs.find((j) => j.id === w.jobId), time: '' })),
    ...installJobs.map((i): InstallRow => { const job = jobs.find((j) => j.id === i.jobId); return { key: i.id, view: installView(i, job, receipts), ij: i, job, time: i.from }; }),
  ].filter((r) => r.view !== 'DONE' || inR(r.ij?.acceptance?.at ?? r.time));
  const count = (v: InstallView) => rows.filter((r) => r.view === v).length;
  const order: InstallView[] = ['WAIT', 'IN_PROGRESS', 'SCHEDULED', 'WAIT_PAYMENT', 'DONE'];
  const list = rows.filter((r) => (st === 'ALL' || r.view === st) && (!t || `${r.job ? jobCustName(r.job, customers) : ''} ${r.job ? jobPhone(r.job, customers) : ''} ${r.ij?.address ?? r.job?.siteAddress ?? ''}`.toLowerCase().includes(t)))
    .sort((a, b) => order.indexOf(a.view) - order.indexOf(b.view) || (a.view === 'DONE' ? b.time.localeCompare(a.time) : a.time.localeCompare(b.time)));
  const paged = usePaged(list, 20);
  const in7 = toLocal(new Date(Date.now() + 7 * 864e5));
  const nowL = toLocal(new Date());
  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Chờ hẹn lắp" value={String(count('WAIT'))} icon={CalendarDays} color={C.orange} sub="Xưởng đã hoàn thành" />
        <StatCard label="Lịch 7 ngày tới" value={String(installJobs.filter((i) => i.status === 'SCHEDULED' && i.from >= nowL.slice(0, 10) && i.from <= in7).length)} icon={HardHat} color={C.blue} sub={`${count('IN_PROGRESS')} đang lắp đặt`} />
        <StatCard label="Chờ thu tiền" value={String(count('WAIT_PAYMENT'))} icon={Banknote} color={C.red} sub={compact(rows.filter((r) => r.view === 'WAIT_PAYMENT' && r.job).reduce((s, r) => s + jobMoney(r.job!, receipts).receivable, 0))} />
        <StatCard label="Hoàn tất trong kỳ" value={String(count('DONE'))} icon={ShieldCheck} color={C.teal} sub="Đã thu đủ, đang bảo hành" />
      </div>
      <Panel>
        <div className="mb-3 flex flex-wrap items-center gap-2"><SearchBox value={q} onChange={setQ} placeholder="Tìm khách hàng, số điện thoại, địa chỉ" /></div>
        <StagePills items={[{ id: 'ALL' as InstallView | 'ALL', label: 'Tất cả', count: rows.length }, ...order.map((v) => ({ id: v as InstallView | 'ALL', label: INSTALL_VIEW[v].label, count: count(v) }))]} value={st} onChange={(v) => { setSt(v); paged.setPage(1); }} />
        <div className="mt-3 space-y-2 md:hidden">
          {paged.slice.map((r, i) => (
            <button key={r.key} className="w-full rounded bg-[rgb(var(--raised))] p-3 text-left" onClick={() => (r.ij ? setOpen(r.ij.id) : r.wo && setSchedule(r.wo))}>
              <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{(paged.page - 1) * 20 + i + 1}. {r.job ? jobCustName(r.job, customers) : '—'}</p><Chip tone={INSTALL_VIEW[r.view].tone}>{INSTALL_VIEW[r.view].label}</Chip></div>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{r.job ? jobPhone(r.job, customers) : ''}, {r.ij?.address ?? r.job?.siteAddress}</p>
              <p className="mt-1 text-xs text-[rgb(var(--accent-fg))]">{r.time ? fmtDT(r.time) : 'Bấm để hẹn lịch lắp'}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 hidden md:block">
          <Table head={['STT', 'Khách hàng', 'Số điện thoại', 'Địa chỉ', 'Thời gian lắp đặt', 'Trạng thái']} minW={960}>
            {paged.slice.map((r, i) => (
              <tr key={r.key} className={cn(rowCls, 'cursor-pointer')} onClick={() => (r.ij ? setOpen(r.ij.id) : r.wo && canDo('install.manage') && setSchedule(r.wo))}>
                <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{(paged.page - 1) * 20 + i + 1}</td>
                <td className={tdCls}><p className="font-medium">{r.job ? jobCustName(r.job, customers) : customers.find((c) => c.id === r.ij?.customerId)?.name ?? '—'}</p><p className="text-xs text-[rgb(var(--muted))]">{r.ij ? `${r.ij.code}, ${userName(r.ij.leaderId)}` : r.wo?.code}</p></td>
                <td className={cn(tdCls, 'whitespace-nowrap tabular-nums')}>{r.job ? jobPhone(r.job, customers) : ''}</td>
                <td className={cn(tdCls, 'max-w-[280px]')}><p className="line-clamp-2 text-xs">{r.ij?.address ?? r.job?.siteAddress}</p></td>
                <td className={cn(tdCls, 'whitespace-nowrap text-xs tabular-nums', r.ij?.status === 'SCHEDULED' && r.time < nowL && 'text-[rgb(var(--danger-fg))]')}>{r.time ? fmtDT(r.time) : '—'}</td>
                <td className={tdLast}>
                  {r.view === 'WAIT'
                    ? <button className={cn(btnPrimary, btnSm, 'whitespace-nowrap')} disabled={!canDo('install.manage')} onClick={(e) => { e.stopPropagation(); if (r.wo) setSchedule(r.wo); }}><CalendarDays className="h-3.5 w-3.5" aria-hidden />Lên lịch lắp đặt</button>
                    : <Chip tone={INSTALL_VIEW[r.view].tone}>{INSTALL_VIEW[r.view].label}</Chip>}
                </td>
              </tr>
            ))}
          </Table>
        </div>
        {!list.length && <EmptyState text={<>Không có lịch lắp đặt.</>} art="calendar" />}
        <Pagination paged={paged} unit="lịch" />
      </Panel>
      {open && <InstallDrawer id={open} onClose={() => setOpen(null)} />}
      {schedule && <InstallScheduleModal wo={schedule} onClose={() => setSchedule(null)} />}
    </div>
  );
}

