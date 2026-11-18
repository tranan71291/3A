'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { Field, Modal, MoneyInput } from '../../components/ui';
import { btnGhost, btnPrimary, C, compact, FUND_LABEL, inputCls, mdfOfCustomer, nextCode, progName, PROGRAM_BUDGET, PROGRAM_FUND, PROGRAM_LABEL, PROGRAM_REQUIRED, PROGRAM_TYPES, segName, tierInfo, todayISO, uid, useApp, usedByType, vnd } from '../../lib/core';
import type { FundCode, Program, ProgramForm } from '../../lib/types';

export function ProgramFormModal({ customerId, programId, onClose }: { customerId?: string; programId?: string; onClose: () => void }) {
  const { me, budget, setBudget, programs, setPrograms, claims, customers, departments, tierRules, segRules, users, notify, dispatch } = useApp();
  const existing = programs.find((p) => p.id === programId);
  const preset = customers.find((c) => c.id === (existing?.customerId ?? customerId));
  const [f, setF] = useState<ProgramForm>(existing
    ? { title: existing.title, type: existing.type, customerId: existing.customerId ?? '', dept: existing.dept, requested: existing.requested, sharePct: existing.sharePct, start: existing.start, end: existing.end, expectedLeads: existing.expectedLeads ?? 0 }
    : { title: '', type: PROGRAM_TYPES[0] ?? '', customerId: customerId ?? '', dept: preset?.dept ?? me.dept ?? departments[0]?.code ?? '', requested: 0, sharePct: 100, start: '', end: '', expectedLeads: 0 });
  const ownHeld = existing?.held ?? 0;
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof ProgramForm>(k: K, v: ProgramForm[K]) => setF((p) => ({ ...p, [k]: v }));

  // ---- Tính giữ chỗ & kiểm tra hạn mức ----
  const hold = Math.round((f.requested * f.sharePct) / 100);
  const available = budget.total - budget.spent - budget.committed + ownHeld;
  const typeCap = PROGRAM_BUDGET[f.type] ?? 0;
  const typeUsed = usedByType(f.type, claims, programs, budget.fiscalYear) - (existing && existing.type === f.type ? ownHeld : 0);
  const cust = customers.find((c) => c.id === f.customerId);
  const custCap = cust ? tierRules.find((r) => r.tier === cust.tier)?.mdfCap ?? 0 : 0;
  const custUsed = cust ? mdfOfCustomer(cust.id, claims, programs) - (existing && existing.customerId === cust.id ? ownHeld : 0) : 0;
  const head = users.find((u) => u.role === 'DEPT_HEAD' && u.dept === f.dept && u.active);
  const approver = head && head.approvalLimit >= hold ? `${head.name} (Trưởng phòng, hạn mức ${compact(head.approvalLimit)})` : 'Ban Giám đốc (vượt hạn mức Trưởng phòng)';
  const today = todayISO();

  const e: Partial<Record<keyof ProgramForm, string>> = {};
  if (f.title.trim().length < 5) e.title = 'Tên chương trình tối thiểu 5 ký tự';
  if (!f.type || !(f.type in PROGRAM_LABEL)) e.type = 'Chọn hạng mục';
  if (cust && !segRules[cust.segment]?.mdfEligible) e.customerId = `Nhóm ${segName(cust.segment)} không thuộc diện nhận quỹ (xem Cài đặt > Phân loại khách hàng)`;
  if (f.requested <= 0) e.requested = 'Nhập tổng chi phí dự kiến';
  else if (typeUsed + hold > typeCap) e.requested = `Vượt ngân sách hạng mục ${progName(f.type)} (còn ${compact(Math.max(0, typeCap - typeUsed))})`;
  else if (cust && custUsed + hold > custCap) e.requested = `Vượt hạn mức tài trợ hạng ${tierInfo(cust.tier).label} (còn ${compact(Math.max(0, custCap - custUsed))})`;
  else if (hold > available) e.requested = `Quỹ khả dụng chỉ còn ${compact(available)}`;
  if (f.sharePct < 1 || f.sharePct > 100) e.sharePct = 'Từ 1 đến 100%';
  if (!f.start) e.start = 'Chọn ngày bắt đầu';
  else if (f.start < today && !existing) e.start = 'Đề xuất phải lập trước khi chương trình diễn ra';
  else if (Number(f.start.slice(0, 4)) !== budget.fiscalYear) e.start = `Chương trình thuộc năm ${f.start.slice(0, 4)}: chuyển bộ lọc thời gian trên header sang năm đó để lập đề xuất`;
  if (budget.declared === false) e.title = `Chưa khai báo ngân sách năm ${budget.fiscalYear} (Cài đặt > Quỹ Hãng 3M)`;
  else if (f.start < budget.periodStart) e.start = `Phải nằm trong năm tài chính ${budget.fiscalYear}`;
  if (!f.end) e.end = 'Chọn ngày kết thúc';
  else if (f.start && f.end < f.start) e.end = 'Ngày kết thúc phải sau ngày bắt đầu';
  else if (f.end > budget.periodEnd) e.end = `Phải nằm trong năm tài chính ${budget.fiscalYear}`;
  const err = (k: keyof ProgramForm) => (touched ? e[k] : undefined);

  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) return;
    if (existing) {
      setPrograms((p) => p.map((x) => (x.id === existing.id ? { ...x, title: f.title.trim(), type: f.type, customerId: f.customerId || undefined, dept: f.dept, requested: f.requested, sharePct: f.sharePct, held: hold, start: f.start, end: f.end, expectedLeads: f.expectedLeads || undefined } : x)));
      setBudget((b) => ({ ...b, committed: Math.max(0, b.committed + hold - ownHeld) }));
      notify(`Đã cập nhật ${existing.code}, giữ chỗ ${compact(hold)}`, 'teal');
    } else {
      // Mã đề xuất nội bộ tự sinh; mã Pre-Approval do 3M cấp, nhập khi ghi nhận 3M duyệt
      const code = nextCode(programs.map((p) => p.code), `DX-${budget.fiscalYear}-`, 4);
      const program: Program = {
        id: uid('m'), code, title: f.title.trim(), type: f.type,
        customerId: f.customerId || undefined, dept: f.dept, requested: f.requested, sharePct: f.sharePct, held: hold,
        start: f.start, end: f.end, expectedLeads: f.expectedLeads || undefined, status: 'PENDING_INTERNAL', requestedBy: me.id, requestedAt: Date.now(),
      };
      setPrograms((p) => [program, ...p]);
      setBudget((b) => ({ ...b, committed: b.committed + hold }));
      dispatch('PROGRAM_APPROVAL', { toAll: users.filter((u) => u.active && (u.role === 'BOD' || (u.role === 'DEPT_HEAD' && u.dept === f.dept))), title: `Đề xuất chi quỹ chờ duyệt: ${program.title}`, body: `${code}, giữ chỗ ${compact(hold)}` });
      notify(`Đã tạo đề xuất ${code}, giữ chỗ ${compact(hold)}. Chờ duyệt nội bộ rồi gửi 3M cấp mã Pre-Approval.`, 'teal');
    }
    onClose();
  };

  const rows: [string, string, string][] = [
    ['Phần Hãng tài trợ (giữ chỗ)', vnd(hold), hold > 0 ? C.orange : C.muted],
    [`${FUND_LABEL[PROGRAM_FUND[f.type] ?? 'MDF']}: ${progName(f.type)}`, `${compact(typeUsed + hold)} / ${compact(typeCap)}`, typeUsed + hold > typeCap ? C.red : C.text],
    ...(cust ? [[`Hạn mức hạng ${tierInfo(cust.tier).label}`, `${compact(custUsed + hold)} / ${compact(custCap)}`, custUsed + hold > custCap ? C.red : C.text] as [string, string, string]] : []),
    ['Quỹ khả dụng sau giữ chỗ', vnd(available - hold), available - hold < 0 ? C.red : C.teal],
  ];

  return (
    <Modal
      title={existing ? `Sửa đề xuất ${existing.code}` : 'Đề xuất chương trình quỹ 3M'}
      onClose={onClose}
      wide
      footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}><Lock className="h-4 w-4" aria-hidden />{existing ? 'Lưu thay đổi' : 'Gửi đề xuất và giữ chỗ'}</button></>}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-3">
          <Field label="Tên chương trình *" error={err('title')} className="sm:col-span-2"><input className={inputCls} value={f.title} onChange={(ev) => set('title', ev.target.value)} placeholder="VD: Hội thảo giải pháp đầu cáp co nguội Hải Phòng" /></Field>
          <Field label="Hạng mục ngân sách" error={err('type')}>
            <select className={inputCls} value={f.type} onChange={(ev) => set('type', ev.target.value)}>
              {(['MDF', 'CS'] as FundCode[]).map((fund) => (
                <optgroup key={fund} label={FUND_LABEL[fund]}>
                  {PROGRAM_TYPES.filter((t) => PROGRAM_FUND[t] === fund).map((t) => <option key={t} value={t}>{progName(t)}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Phòng ban">
            <select className={inputCls} value={f.dept} onChange={(ev) => set('dept', ev.target.value)}>
              {departments.filter((d) => d.active).map((d) => <option key={d.code} value={d.code}>{d.short}</option>)}
            </select>
          </Field>
          <Field label="Khách hàng hưởng lợi" error={err('customerId')} className="sm:col-span-2">
            <select className={inputCls} value={f.customerId} onChange={(ev) => { const c = customers.find((x) => x.id === ev.target.value); setF((p) => ({ ...p, customerId: ev.target.value, dept: c?.dept ?? p.dept })); }}>
              <option value="">Hoạt động chung, không gắn khách hàng</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({tierInfo(c.tier).label})</option>)}
            </select>
          </Field>
          <Field label="Tổng chi phí dự kiến *" error={err('requested')}><MoneyInput value={f.requested} onChange={(n) => set('requested', n)} /></Field>
          <Field label="Hãng tài trợ (%)" error={err('sharePct')}><input className={inputCls} type="number" min={1} max={100} value={f.sharePct} onChange={(ev) => set('sharePct', Number(ev.target.value))} /></Field>
          <Field label="Ngày bắt đầu *" error={err('start')}><input className={inputCls} type="date" value={f.start} min={today} onChange={(ev) => set('start', ev.target.value)} /></Field>
          <Field label="Ngày kết thúc *" error={err('end')}><input className={inputCls} type="date" value={f.end} min={f.start || today} onChange={(ev) => set('end', ev.target.value)} /></Field>
          {(PROGRAM_REQUIRED[f.type] ?? []).includes('ATTENDEE_SIGN_SHEET') && <Field label="Số người tham dự dự kiến"><input className={inputCls} type="number" min={0} value={f.expectedLeads || ''} onChange={(ev) => set('expectedLeads', Number(ev.target.value))} /></Field>}
        </div>

        <div className="space-y-3 rounded-md bg-[rgb(var(--raised))] p-4 text-sm md:col-span-2">
          <p className="font-medium text-[rgb(var(--fg))]">Kiểm tra hạn mức</p>
          {rows.map(([k, v, col]) => (
            <div key={k}><p className="text-xs text-[rgb(var(--muted))]">{k}</p><p className="font-medium tabular-nums" style={{ color: col }}>{v}</p></div>
          ))}
          <div className="border-t border-[rgb(var(--line))] pt-3 text-xs text-[rgb(var(--muted))]">
            <p className="mb-1 text-[rgb(var(--fg))]">Người duyệt nội bộ</p>
            {hold > 0 ? approver : 'Nhập chi phí để xác định người duyệt.'}
          </div>
        </div>
      </div>
    </Modal>
  );
}

