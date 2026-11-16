'use client';

import { useState } from 'react';
import { Field, Modal, MoneyInput } from '../../components/ui';
import { btnGhost, btnPrimary, compact, inputCls, todayISO, useApp, vnd } from '../../lib/core';
import type { Program } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  HỒ SƠ MDF: GHI NHẬN 3M DUYỆT (nhập mã Pre-Approval do 3M cấp)
// =====================================================================

export function VendorApprovalModal({ program, onClose }: { program: Program; onClose: () => void }) {
  const { programs, claims, setPrograms, setBudget, notify, dispatch } = useApp();
  const [pa, setPa] = useState('');
  const [amount, setAmount] = useState(program.held);
  const [date, setDate] = useState(todayISO());
  const [touched, setTouched] = useState(false);
  const code = pa.trim().toUpperCase();
  const dup = programs.some((p) => p.id !== program.id && p.preApprovalId?.toUpperCase() === code) || claims.some((c) => c.preApprovalId.toUpperCase() === code);
  const e = { pa: !code ? 'Nhập mã Pre-Approval 3M cấp trong email / thư duyệt' : dup ? 'Mã này đã dùng cho chương trình khác' : '', amount: amount <= 0 || amount > program.held ? `Từ 1 đến ${vnd(program.held)}` : '' };

  const save = () => {
    setTouched(true);
    if (e.pa || e.amount) return;
    const release = program.held - amount;
    if (release > 0) setBudget((b) => ({ ...b, committed: Math.max(0, b.committed - release) }));
    setPrograms((ps) => ps.map((x) => (x.id === program.id ? { ...x, status: 'APPROVED', preApprovalId: code, held: amount, vendorApprovedAt: date } : x)));
    const msg = `3M duyệt ${program.title}: mã ${code}, ${vnd(amount)}${release > 0 ? `, nhả ${compact(release)} về quỹ` : ''}`;
    notify(msg, 'teal');
    dispatch('CLAIM_UPDATE', { title: '3M đã duyệt Pre-Approval', body: msg, module: 'claims' });
    onClose();
  };

  return (
    <Modal title="Ghi nhận 3M duyệt Pre-Approval" onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Xác nhận</button></>}>
      <div className="space-y-4">
        <div className="rounded bg-[rgb(var(--raised))] p-3 text-sm">
          <p className="font-medium">{program.title}</p>
          <p className="text-xs text-[rgb(var(--muted))]">Mã đề xuất nội bộ {program.code}, đang giữ chỗ {vnd(program.held)}</p>
        </div>
        <p className="text-xs text-[rgb(var(--muted))]">Mã Pre-Approval do 3M cấp sau khi duyệt đề xuất. Hồ sơ claim và Audit Pack dùng mã này để đối chiếu với 3M.</p>
        <Field label="Mã Pre-Approval (3M cấp) *" error={touched ? e.pa || undefined : undefined}><input className={cn(inputCls, 'font-mono')} value={pa} onChange={(ev) => setPa(ev.target.value)} placeholder="VD: 3M-MDF-26-0051" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Số tiền 3M duyệt" error={touched ? e.amount || undefined : undefined} hint="Thấp hơn giữ chỗ thì phần dư tự nhả về quỹ"><MoneyInput value={amount} onChange={setAmount} /></Field>
          <Field label="Ngày duyệt"><input className={inputCls} type="date" value={date} onChange={(ev) => setDate(ev.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

