'use client';

import { useState } from 'react';
import { FileText, Paperclip, X } from 'lucide-react';
import { Field, FilePicker, Modal, MoneyInput } from '../../components/ui';
import { scoreLead } from '../../lib/business';
import { btnGhost, btnPrimary, cfMissing, cfSet, EMAIL_RE, inputCls, MST_RE, nextCode, QUOTE_SLA_MS, REGION_LABEL, SEGMENT_LABEL, segName, SOURCE_LABEL, uid, useApp } from '../../lib/core';
import type { CfVal, DeptCode, Lead, LeadForm, Region, Source } from '../../lib/types';
import { EntityCfForm, useEntityFormLayout } from '../page-builder';
import { cn } from '../../lib/utils';

export function validateLead(f: LeadForm, leads: Lead[], selfId?: string): Partial<Record<keyof LeadForm, string>> {
  const e: Partial<Record<keyof LeadForm, string>> = {};
  if (f.company.trim().length < 3) e.company = 'Nhập tên công ty';
  if (!f.contact.trim()) e.contact = 'Nhập người liên hệ';
  if (f.phone.replace(/\D/g, '').length < 9) e.phone = 'Số điện thoại chưa đúng';
  if (f.taxCode && !MST_RE.test(f.taxCode.trim())) e.taxCode = 'MST gồm 10 số hoặc 13 số (dạng 0123456789-001)';
  else if (f.taxCode) {
    const dup = leads.find((l) => l.id !== selfId && l.taxCode === f.taxCode.trim() && !['WON', 'LOST'].includes(l.status));
    if (dup) e.taxCode = `Trùng MST với lead ${dup.code} đang mở`;
  }
  if (f.email && !EMAIL_RE.test(f.email)) e.email = 'Email chưa đúng định dạng';
  if (!(f.segment in SEGMENT_LABEL)) e.segment = 'Chọn nhóm khách hàng';
  return e;
}

export function formToLead(f: LeadForm, code: string): Lead {
  return {
    id: uid('l'), code, company: f.company.trim(), contact: f.contact.trim(), phone: f.phone.trim(),
    taxCode: f.taxCode.trim() || undefined, email: f.email.trim() || undefined, segment: f.segment, source: f.source, region: f.region, province: f.province.trim() || undefined,
    boqValue: f.boqValue, boqNote: f.boqNote.trim(), attachments: f.attachments, hasBoqFile: f.attachments.length > 0,
    boqFile: f.attachments[0] ? { name: f.attachments[0].name, url: f.attachments[0].url } : undefined,
    receivedDaysAgo: 0, status: 'NEW',
  };
}

export function LeadFormModal({ id, asProject, onClose }: { id?: string; asProject?: boolean; onClose: () => void }) {
  const { leads, setLeads, notify, me, users, routableDepts, customers } = useApp();
  /** Dự án do Sales tự khai thác: bỏ qua bước phân lead, vào thẳng khảo sát & báo giá */
  const [pDept, setPDept] = useState<DeptCode>(me.dept && routableDepts.some((d) => d.code === me.dept) ? me.dept : routableDepts[0]?.code ?? '');
  const [pRep, setPRep] = useState<string>(me.role === 'SALES_REP' ? me.id : '');
  const [pCust, setPCust] = useState('');
  const reps = users.filter((u) => u.active && u.dept === pDept && (u.role === 'SALES_REP' || u.role === 'DEPT_HEAD'));
  const existing = leads.find((l) => l.id === id);
  const [f, setF] = useState<LeadForm>(() =>
    existing
      ? { company: existing.company, contact: existing.contact, phone: existing.phone, taxCode: existing.taxCode ?? '', email: existing.email ?? '', segment: existing.segment, source: existing.source, region: existing.region, province: existing.province ?? '', boqValue: existing.boqValue, boqNote: existing.boqNote, attachments: existing.attachments ?? [] }
      : { company: '', contact: '', phone: '', taxCode: '', email: '', segment: 'OTHER', source: 'WEBSITE_FORM', region: 'SOUTH', province: '', boqValue: 0, boqNote: '', attachments: [] },
  );
  const [touched, setTouched] = useState(false);
  const errors = validateLead(f, leads, id);
  const set = <K extends keyof LeadForm>(k: K, v: LeadForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const err = (k: keyof LeadForm) => (touched ? errors[k] : undefined);
  // v55.3: trường tùy chỉnh lead theo bố cục form 3A (cùng quy tắc kiểm tra với máy chủ)
  const fl = useEntityFormLayout('lead');
  const [cfv, setCfv] = useState<Record<string, CfVal>>(existing?.cf ?? {});
  const cfMiss = cfMissing(fl.formDefs, cfv, 'SAVE');
  const cfOut = Object.keys(cfv).length ? cfv : undefined;

  const addFiles = (files: File[]) => {
    const ok = files.filter((x) => x.size <= 20 * 1024 * 1024);
    if (ok.length < files.length) notify('Bỏ qua file vượt 20 MB', 'orange');
    set('attachments', [...f.attachments, ...ok.map((x) => ({ name: x.name, url: URL.createObjectURL(x), size: x.size }))]);
  };
  const removeFile = (i: number) => {
    URL.revokeObjectURL(f.attachments[i].url);
    set('attachments', f.attachments.filter((_, j) => j !== i));
  };

  const save = () => {
    setTouched(true);
    if (Object.keys(errors).length) return;
    if (cfMiss.length) return notify(`${cfMiss[0].type === 'check' ? 'Cần tích' : 'Nhập'} ${cfMiss[0].label}`, 'red');
    if (existing) {
      setLeads((p) => p.map((l) => (l.id === existing.id ? {
        ...l, cf: cfOut, company: f.company.trim(), contact: f.contact.trim(), phone: f.phone.trim(), taxCode: f.taxCode.trim() || undefined, email: f.email.trim() || undefined,
        segment: f.segment, source: f.source, region: f.region, province: f.province.trim() || undefined, boqValue: f.boqValue, boqNote: f.boqNote.trim(), attachments: f.attachments,
        hasBoqFile: f.attachments.length > 0 || l.hasBoqFile, boqFile: l.boqFile ?? (f.attachments[0] ? { name: f.attachments[0].name, url: f.attachments[0].url } : undefined),
      } : l)));
      notify(`Đã cập nhật ${existing.code}`, 'teal');
    } else if (asProject) {
      if (!pDept || !pRep) return notify('Chọn phòng ban và người phụ trách dự án', 'red');
      const base = formToLead(f, nextCode(leads.map((l) => l.code), 'LD-2026-', 4));
      const now = Date.now();
      const lead: Lead = { ...base, cf: cfOut, status: 'ACCEPTED', dept: pDept, assignee: pRep, routedAt: now, slaMet: true, quoteDeadline: now + QUOTE_SLA_MS, boqStatus: 'NOT_STARTED', routingReason: 'Sales tự khai thác', score: scoreLead(base, customers), customerId: pCust || undefined };
      setLeads((p) => [lead, ...p]);
      notify(`Đã tạo dự án ${lead.code}. Hạn nộp BOQ và báo giá: 24 giờ.`, 'teal');
    } else {
      const lead: Lead = { ...formToLead(f, nextCode(leads.map((l) => l.code), 'LD-2026-', 4)), cf: cfOut };
      setLeads((p) => [lead, ...p]);
      notify(`Đã thêm lead ${lead.code}, chờ Marketing phân phòng ban`, 'teal');
    }
    onClose();
  };

  return (
    <Modal
      title={existing ? `Sửa ${existing.code}` : asProject ? 'Tạo dự án mới' : 'Thêm lead mới'}
      onClose={onClose}
      wide
      footer={
        existing || asProject ? (
          <><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>{existing ? 'Lưu thay đổi' : 'Tạo dự án'}</button></>
        ) : (
          <><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu lead</button></>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {asProject && !existing && (
          <>
            <p className="rounded bg-[rgb(var(--raised))] p-3 text-xs text-[rgb(var(--muted))] sm:col-span-2">Dự án Sales tự khai thác không qua bước phân lead của Marketing; vào thẳng giai đoạn khảo sát và báo giá (SLA 24 giờ).</p>
            <Field label="Khách hàng có sẵn trong CRM" className="sm:col-span-2" hint="Chọn để tự điền pháp nhân, MST, liên hệ; để trống nếu là khách mới">
              <select className={inputCls} value={pCust} onChange={(e) => {
                const c = customers.find((x) => x.id === e.target.value);
                setPCust(e.target.value);
                if (c) setF((p) => ({ ...p, company: c.name, taxCode: c.taxCode, contact: c.contactName, phone: c.contactPhone, email: c.contactEmail, segment: c.segment, region: c.region }));
              }}>
                <option value="">Khách hàng mới</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} (MST {c.taxCode})</option>)}
              </select>
            </Field>
            <Field label="Phòng ban">
              <select className={inputCls} value={pDept} onChange={(e) => { setPDept(e.target.value); setPRep(''); }}>
                {routableDepts.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Người phụ trách">
              <select className={inputCls} value={pRep} onChange={(e) => setPRep(e.target.value)}>
                <option value="">Chọn nhân sự</option>
                {reps.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Tên công ty *" error={err('company')} className="sm:col-span-2"><input className={inputCls} value={f.company} onChange={(e) => set('company', e.target.value)} /></Field>
        <Field label="Người liên hệ *" error={err('contact')}><input className={inputCls} value={f.contact} onChange={(e) => set('contact', e.target.value)} /></Field>
        <Field label="Số điện thoại *" error={err('phone')}><input type="tel" autoComplete="tel" className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Mã số thuế" error={err('taxCode')} hint="Dùng nhận diện khách hàng hiện hữu"><input className={inputCls} value={f.taxCode} onChange={(e) => set('taxCode', e.target.value)} /></Field>
        <Field label="Email" error={err('email')}><input className={inputCls} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Nhóm khách hàng" error={err('segment')}>
          <select className={inputCls} value={f.segment} onChange={(e) => set('segment', e.target.value)}>
            {Object.keys(SEGMENT_LABEL).map((s) => <option key={s} value={s}>{segName(s)}</option>)}
          </select>
        </Field>
        <Field label="Khu vực" hint="Quyết định phòng EMD Bắc / Nam khi phân lead">
          <select className={inputCls} value={f.region} onChange={(e) => set('region', e.target.value as Region)}>
            {(Object.keys(REGION_LABEL) as Region[]).map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Tỉnh / thành phố"><input className={inputCls} value={f.province} onChange={(e) => set('province', e.target.value)} placeholder="VD: Hà Nội" /></Field>
        <Field label="Kênh nguồn lead">
          <select className={inputCls} value={f.source} onChange={(e) => set('source', e.target.value as Source)}>
            {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Giá trị ước tính" hint="MKT nhập ước tính; giá trị chính thức lấy từ BOQ bóc tách"><MoneyInput value={f.boqValue} onChange={(n) => set('boqValue', n)} /></Field>
        <Field label="Nhu cầu" className="sm:col-span-2"><textarea className={cn(inputCls, 'min-h-20')} value={f.boqNote} onChange={(e) => set('boqNote', e.target.value)} placeholder="VD: Đầu cáp co nguội 24kV cho trạm biến áp 2 x 1.000 kVA" /></Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">File nhu cầu (BOQ, bản vẽ, hồ sơ mời thầu)</p>
          <FilePicker accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.dwg,.jpg,.jpeg,.png,.zip" multiple onFiles={addFiles} className="flex items-center justify-center gap-2 rounded border border-dashed border-[rgb(var(--line))] px-4 py-4 text-sm text-[rgb(var(--muted))] hover:border-[rgb(var(--accent)/0.6)] hover:text-[rgb(var(--fg))]">
            <Paperclip className="h-4 w-4" aria-hidden />Chọn hoặc kéo thả file (tối đa 20 MB / file)
          </FilePicker>
          {f.attachments.length > 0 && (
            <ul className="mt-2 space-y-1">
              {f.attachments.map((a, i) => (
                <li key={a.url} className="flex items-center gap-2 rounded bg-[rgb(var(--raised))] px-3 py-1.5 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
                  <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[rgb(var(--secondary-fg))] hover:underline">{a.name}</a>
                  <span className="text-xs text-[rgb(var(--muted))]">{Math.max(1, Math.round(a.size / 1024))} KB</span>
                  <button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => removeFile(i)} aria-label={`Bỏ ${a.name}`}><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-4"><EntityCfForm entity="lead" vals={cfv} onChange={(k, v) => setCfv((p) => cfSet(p, k, v))} /></div>
    </Modal>
  );
}

