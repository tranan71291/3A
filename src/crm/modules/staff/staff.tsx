'use client';

import { useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronRight, Clock, FileSpreadsheet, MapPin, Pencil, Plane, Plus, Receipt as ReceiptIcon, Send, Trash2, Upload, Users } from 'lucide-react';
import { useIntent } from '../../components/command-palette';
import { Fab } from '../../components/controls';
import { Drawer } from '../../components/drawer';
import { FilterBar, useInRange } from '../../components/filters';
import { Chip, EmptyState, Field, FilePicker, Modal, MoneyInput, Panel, StatCard, Table, Tabs, useSticky } from '../../components/ui';
import { actDays, ACTIVITY_STATUS, ACTIVITY_TYPE, btnBase, btnGhost, btnPrimary, btnSm, C, compact, DECISION_LABEL, digits, EXPENSE_STATUS, fmtDate, fmtDT, inputCls, kpiGrid, LEAVE_KIND, needsApproval, pad2, rowCls, tdCls, tdFirst, tdLast, todayISO, toLocal, TRANSPORTS, uid, useApp, vnd, WEEKDAY } from '../../lib/core';
import type { Activity, ActivityStatus, ActivityType, ApprovalDecision, LeaveKind } from '../../lib/types';
import { cn } from '../../lib/utils';
import { advanceCash, expenseCash } from '../../lib/workshop';

/** Phạm vi xem: BOD & Kế toán xem tất cả; Trưởng phòng / Trưởng MKT xem phòng mình; còn lại xem của mình */
export function useActivityScope() {
  const { me, role, users } = useApp();
  return role === 'BOD' || role === 'ACCOUNTANT' ? users.map((u) => u.id)
    : role === 'DEPT_HEAD' || role === 'MKT_LEAD' ? users.filter((u) => u.dept === me.dept || u.id === me.id).map((u) => u.id)
    : [me.id];
}

export function useActivityApprover() {
  const { me, role, users, canDo } = useApp();
  return (a: Activity) => {
    const owner = users.find((u) => u.id === a.userId);
    return canDo('activity.approve') && a.userId !== me.id && (role === 'BOD' || (role === 'DEPT_HEAD' && owner?.dept === me.dept));
  };
}

/** Đóng dấu watermark (thời gian, GPS, người chụp) lên ảnh hiện trường */
export async function watermarkPhoto(file: File, lines: string[]): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Không đọc được ảnh')); i.src = src; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    const g = c.getContext('2d');
    if (!g) throw new Error('Trình duyệt không hỗ trợ canvas');
    g.drawImage(img, 0, 0, c.width, c.height);
    const fs = Math.max(14, Math.round(c.width / 42));
    const padY = fs * 0.6;
    const h = lines.length * fs * 1.35 + padY * 2;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, c.height - h, c.width, h);
    g.fillStyle = '#ffffff';
    g.font = `${fs}px sans-serif`;
    lines.forEach((t, i) => g.fillText(t, padY, c.height - h + padY + fs * (i + 1)));
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(src);
  }
}

export function ActivityFormModal({ activity, preset, onClose }: { activity?: Activity; preset?: Partial<Activity>; onClose: () => void }) {
  const { me, role, users, customers, leads, programs, setActivities, notify, dispatch, departments } = useApp();
  const scope = useActivityScope();
  const canPickUser = role === 'BOD' || role === 'DEPT_HEAD' || role === 'MKT_LEAD';
  const defaultsFor = (type: ActivityType, kind?: LeaveKind) => {
    const d = new Date();
    if (type === 'LEAVE') {
      const day = new Date(d); if (kind === 'LEAVE') day.setDate(day.getDate() + 1);
      const at = (h: number, m = 0) => { const x = new Date(day); x.setHours(h, m, 0, 0); return toLocal(x); };
      return kind === 'LATE' ? { from: at(8), to: at(9) } : kind === 'EARLY' ? { from: at(16), to: at(17, 30) } : kind === 'NO_CHECKIN' ? { from: at(8), to: at(8, 15) } : { from: at(8), to: at(17, 30) };
    }
    if (type === 'TRIP') { const a = new Date(d); a.setDate(a.getDate() + 1); a.setHours(7, 0, 0, 0); const b = new Date(a); b.setDate(b.getDate() + 1); b.setHours(18, 0, 0, 0); return { from: toLocal(a), to: toLocal(b) }; }
    const a = new Date(d); a.setDate(a.getDate() + 1); a.setHours(9, 0, 0, 0); const b = new Date(a); b.setHours(type === 'SURVEY' ? 12 : 10, 30, 0, 0);
    return { from: toLocal(a), to: toLocal(b) };
  };
  const [f, setF] = useState<Activity>(() => activity ?? {
    id: uid('act'), userId: me.id, type: 'MEETING', title: '', ...defaultsFor('MEETING'), location: '', cost: 0, note: '', status: 'PLANNED', createdAt: todayISO(), createdBy: me.id, ...preset,
  });
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof Activity>(k: K, v: Activity[K]) => setF((p) => ({ ...p, [k]: v }));
  const changeType = (type: ActivityType) => setF((p) => ({
    ...p, type, ...(activity ? {} : defaultsFor(type, type === 'LEAVE' ? p.leaveKind ?? 'LEAVE' : undefined)),
    leaveKind: type === 'LEAVE' ? p.leaveKind ?? 'LEAVE' : undefined,
    ...(type === 'LEAVE' ? { customerId: undefined, leadId: undefined, programId: undefined, cost: 0, location: '' } : {}),
  }));
  const owner = users.find((u) => u.id === f.userId);
  const cust = customers.find((c) => c.id === f.customerId);
  const projects = leads.filter((l) => ['ROUTED', 'ASSIGNED', 'ACCEPTED', 'QUOTED', 'WON'].includes(l.status));
  const isLeave = f.type === 'LEAVE';
  const e: Record<string, string> = {};
  if (!f.from || !f.to || f.to <= f.from) e.to = 'Thời gian kết thúc phải sau bắt đầu';
  if (f.type === 'MEETING' && !f.customerId) e.customerId = 'Gặp khách hàng: bắt buộc chọn khách hàng trong CRM';
  if (f.type === 'SURVEY' && !f.leadId) e.leadId = 'Khảo sát / nghiệm thu: bắt buộc chọn dự án';
  if (f.type === 'TRIP' && !f.location.trim()) e.location = 'Nhập nơi công tác';
  if (f.type === 'TRIP' && !f.transport) e.transport = 'Chọn phương tiện';
  if (isLeave && f.note.trim().length < 5) e.note = 'Nhập lý do cá nhân (tối thiểu 5 ký tự)';
  if (f.cost < 0 || (f.advance ?? 0) < 0) e.cost = 'Không âm';
  if ((f.advance ?? 0) > f.cost && f.cost > 0) e.advance = 'Tạm ứng không vượt chi phí dự kiến';
  const err = (k: string) => (touched ? e[k] : undefined);

  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) return notify(Object.values(e)[0], 'red');
    const approval = needsApproval(f);
    const byApprover = canPickUser && f.userId !== me.id;
    const keep = activity && !['PENDING_APPROVAL', 'NEED_INFO', 'REJECTED'].includes(activity.status) && !(approval && activity.status === 'PLANNED');
    const status: ActivityStatus = keep ? activity!.status : approval ? (byApprover ? 'APPROVED' : 'PENDING_APPROVAL') : 'PLANNED';
    const title = f.title.trim() || (isLeave ? `${LEAVE_KIND[f.leaveKind ?? 'LEAVE']}` : `${ACTIVITY_TYPE[f.type].label}${cust ? `: ${cust.name}` : ''}`);
    const clean: Activity = { ...f, title, location: f.location.trim(), note: f.note.trim(), status, approvedBy: status === 'APPROVED' && byApprover ? me.id : f.approvedBy, rejectNote: status === 'PENDING_APPROVAL' ? undefined : f.rejectNote, requestNote: status === 'PENDING_APPROVAL' ? undefined : f.requestNote, submittedAt: status === 'PENDING_APPROVAL' ? Date.now() : f.submittedAt };
    setActivities((all) => (all.some((x) => x.id === clean.id) ? all.map((x) => (x.id === clean.id ? clean : x)) : [clean, ...all]));
    if (status === 'PENDING_APPROVAL') {
      const head = users.find((u) => u.id === departments.find((d) => d.code === owner?.dept)?.headId && u.id !== f.userId);
      dispatch('ACTIVITY_APPROVAL', { to: head, title: `${isLeave ? LEAVE_KIND[f.leaveKind ?? 'LEAVE'] : ACTIVITY_TYPE[f.type].label} chờ duyệt: ${owner?.name ?? ''}`, body: `${title}, ${fmtDT(f.from)} – ${fmtDT(f.to)}${f.cost ? `, chi phí ${compact(f.cost)}` : ''}`, module: 'staff' });
      notify(activity?.status === 'NEED_INFO' ? 'Đã bổ sung và gửi lại để duyệt' : 'Đã gửi đề nghị, chờ Trưởng phòng / Giám đốc duyệt', 'teal');
    } else notify(activity ? 'Đã cập nhật lịch' : 'Đã thêm vào lịch công tác', 'teal');
    onClose();
  };

  return (
    <Modal title={activity ? 'Sửa lịch công tác' : 'Thêm lịch công tác'} onClose={onClose} wide footer={<><span className="mr-auto self-center text-xs text-[rgb(var(--muted))]">{needsApproval(f) ? 'Cần Trưởng phòng / Giám đốc duyệt' : 'Không cần duyệt'}</span><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>{needsApproval(f) && !(activity && activity.status === 'APPROVED') ? 'Gửi đề nghị' : 'Lưu lịch'}</button></>}>
      {activity?.status === 'NEED_INFO' && activity.requestNote && <p className="mb-3 rounded bg-[rgb(var(--accent)/0.1)] p-3 text-sm text-[rgb(var(--accent-fg))]">Trưởng phòng yêu cầu bổ sung: {activity.requestNote}</p>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Cột trái: lịch trình */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted))]">Lịch trình</p>
          <Field label="Loại công việc">
            <select className={inputCls} value={f.type} onChange={(ev) => changeType(ev.target.value as ActivityType)}>
              {(Object.keys(ACTIVITY_TYPE) as ActivityType[]).map((t) => <option key={t} value={t}>{ACTIVITY_TYPE[t].label}</option>)}
            </select>
          </Field>
          {isLeave && (
            <Field label="Hình thức">
              <select className={inputCls} value={f.leaveKind ?? 'LEAVE'} onChange={(ev) => { const k = ev.target.value as LeaveKind; setF((p) => ({ ...p, leaveKind: k, ...(activity ? {} : defaultsFor('LEAVE', k)) })); }}>
                {(Object.keys(LEAVE_KIND) as LeaveKind[]).map((k) => <option key={k} value={k}>{LEAVE_KIND[k]}</option>)}
              </select>
            </Field>
          )}
          <Field label="Nhân sự">
            <select className={inputCls} disabled={!canPickUser} value={f.userId} onChange={(ev) => set('userId', ev.target.value)}>
              {users.filter((u) => u.active && scope.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bắt đầu"><input className={inputCls} type="datetime-local" value={f.from} onChange={(ev) => set('from', ev.target.value)} /></Field>
            <Field label="Kết thúc" error={err('to')}><input className={inputCls} type="datetime-local" value={f.to} onChange={(ev) => set('to', ev.target.value)} /></Field>
          </div>
          <Field label="Tiêu đề" hint="Để trống sẽ tự đặt theo loại và khách hàng"><input className={inputCls} value={f.title} onChange={(ev) => set('title', ev.target.value)} /></Field>
        </div>

        {/* Cột phải: liên kết, chi phí, mục tiêu */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--muted))]">{isLeave ? 'Lý do' : 'Liên kết & chi phí'}</p>
          {isLeave ? (
            <Field label="Lý do cá nhân *" error={err('note')} hint="Dùng để đối soát trừ phép / trừ công"><textarea className={cn(inputCls, 'min-h-28')} value={f.note} onChange={(ev) => set('note', ev.target.value)} placeholder={f.leaveKind === 'LATE' ? 'VD: Đưa con đi khám, đến văn phòng lúc 9h15' : f.leaveKind === 'NO_CHECKIN' ? 'VD: Máy chấm công lỗi, có mặt từ 7h55' : 'VD: Việc gia đình'} /></Field>
          ) : (
            <>
              <Field label={f.type === 'MEETING' ? 'Khách hàng *' : 'Khách hàng'} error={err('customerId')}>
                <select className={inputCls} value={f.customerId ?? ''} onChange={(ev) => { const c = customers.find((x) => x.id === ev.target.value); setF((p) => ({ ...p, customerId: c?.id, location: p.location || c?.address || '' })); }}>
                  <option value="" disabled={f.type === 'MEETING'}>{f.type === 'MEETING' ? 'Chọn khách hàng trong CRM...' : 'Không gắn khách hàng'}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label={f.type === 'SURVEY' ? 'Dự án M&E *' : 'Dự án'} error={err('leadId')}>
                <select className={inputCls} value={f.leadId ?? ''} onChange={(ev) => { const l = leads.find((x) => x.id === ev.target.value); setF((p) => ({ ...p, leadId: l?.id, customerId: p.customerId ?? l?.customerId, location: p.location || l?.province || '' })); }}>
                  <option value="" disabled={f.type === 'SURVEY'}>{f.type === 'SURVEY' ? 'Chọn dự án...' : 'Không gắn dự án'}</option>
                  {projects.map((l) => <option key={l.id} value={l.id}>{l.company}: {l.boqNote}</option>)}
                </select>
              </Field>
              <Field label="Chương trình quỹ MDF (nếu có)">
                <select className={inputCls} value={f.programId ?? ''} onChange={(ev) => set('programId', ev.target.value || undefined)}>
                  <option value="">Không thuộc chương trình</option>
                  {programs.filter((p) => !['REJECTED', 'CANCELLED'].includes(p.status)).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </Field>
              <Field label={f.type === 'TRIP' ? 'Nơi công tác *' : 'Địa điểm'} error={err('location')}><input className={inputCls} value={f.location} onChange={(ev) => set('location', ev.target.value)} /></Field>
              {f.type === 'TRIP' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phương tiện *" error={err('transport')}>
                    <select className={inputCls} value={f.transport ?? ''} onChange={(ev) => set('transport', ev.target.value)}>
                      <option value="">Chọn...</option>
                      {TRANSPORTS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Nơi lưu trú"><input className={inputCls} value={f.lodging ?? ''} onChange={(ev) => set('lodging', ev.target.value)} placeholder="Khách sạn / nhà nghỉ" /></Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Dự toán chi phí" error={err('cost')}><MoneyInput value={f.cost} onChange={(n) => set('cost', n)} /></Field>
                {f.type === 'TRIP' && <Field label="Tạm ứng công tác phí" error={err('advance')}><MoneyInput value={f.advance ?? 0} onChange={(n) => set('advance', n)} /></Field>}
              </div>
              <Field label="Mục tiêu"><textarea className={cn(inputCls, 'min-h-16')} value={f.note} onChange={(ev) => set('note', ev.target.value)} placeholder={f.type === 'SURVEY' ? 'VD: Khảo sát tuyến cáp, đo khoảng cách tủ RMU' : 'VD: Trình bày giải pháp đầu cáp, chốt lịch khảo sát'} /></Field>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Ngăn chi tiết: check-in hiện trường, kết quả & việc tiếp theo, chứng từ chi phí, duyệt */
export function ActivityDrawer({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (a: Activity) => void }) {
  const { activities, setActivities, users, customers, leads, programs, me, canDo, notify, openCustomer, go, postCash, cashEntries } = useApp();
  const canApprove = useActivityApprover();
  const a = activities.find((x) => x.id === id);
  const [result, setResult] = useState(a?.result ?? '');
  const [next, setNext] = useState(a?.nextAction ?? '');
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState<{ name: string; amount: number }>({ name: '', amount: 0 });
  if (!a) return null;
  const patch = (p: Partial<Activity>) => setActivities((all) => all.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
  const t = ACTIVITY_TYPE[a.type];
  const owner = users.find((u) => u.id === a.userId);
  const cust = customers.find((c) => c.id === a.customerId);
  const lead = leads.find((l) => l.id === a.leadId);
  const prog = programs.find((p) => p.id === a.programId);
  const mine = a.userId === me.id || a.createdBy === me.id;
  const isLeave = a.type === 'LEAVE';
  const active = ['PLANNED', 'APPROVED', 'DONE'].includes(a.status);
  const expTotal = (a.expenses ?? []).reduce((s, x) => s + x.amount, 0);

  const doCheckin = (files: File[]) => {
    setBusy(true);
    const finish = (lat: number, lng: number, accuracy: number | undefined, simulated: boolean) => {
      const at = new Date();
      const lateMinutes = Math.max(0, Math.round((at.getTime() - new Date(a.from).getTime()) / 60000) - 15);
      const lines = [`${owner?.name ?? ''} ${pad2(at.getHours())}:${pad2(at.getMinutes())} ${pad2(at.getDate())}/${pad2(at.getMonth() + 1)}/${at.getFullYear()}`, `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}${simulated ? ' (mô phỏng)' : ''}`, a.location || cust?.name || ''];
      Promise.all(files.map(async (f) => ({ name: f.name, url: await watermarkPhoto(f, lines.filter(Boolean)) })))
        .then((photos) => {
          patch({ checkin: { at: at.toISOString(), lat, lng, accuracy, simulated, lateMinutes, photos: [...(a.checkin?.photos ?? []), ...photos] } });
          notify(`Đã check-in${lateMinutes > 0 ? `, trễ ${lateMinutes} phút so với lịch` : ''}${photos.length ? `, ${photos.length} ảnh có watermark` : ''}`, lateMinutes > 0 ? 'orange' : 'teal');
        })
        .catch((err) => notify(err instanceof Error ? err.message : 'Không xử lý được ảnh', 'red'))
        .finally(() => setBusy(false));
    };
    // Lấy GPS thật nếu trình duyệt cho phép, không thì mô phỏng quanh TP.HCM
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => finish(p.coords.latitude, p.coords.longitude, p.coords.accuracy, false),
        () => finish(10.7769 + Math.random() * 0.02, 106.7009 + Math.random() * 0.02, undefined, true),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    } else finish(10.7769, 106.7009, undefined, true);
  };
  const addExpense = (files: File[]) => {
    const file = files[0];
    if (!exp.name.trim() || exp.amount <= 0) return notify('Nhập nội dung và số tiền trước khi tải hóa đơn / vé', 'red');
    if (file.size > 10 * 1024 * 1024) return notify('File tối đa 10 MB', 'red');
    patch({ expenses: [...(a.expenses ?? []), { id: uid('ex'), name: exp.name.trim(), amount: exp.amount, fileName: file.name, url: URL.createObjectURL(file) }], expenseStatus: undefined });
    setExp({ name: '', amount: 0 });
  };

  return (
    <Drawer title={a.title} eyebrow={`${isLeave ? LEAVE_KIND[a.leaveKind ?? 'LEAVE'] : t.label}, ${owner?.name ?? ''}`} badge={<Chip tone={ACTIVITY_STATUS[a.status].tone}>{ACTIVITY_STATUS[a.status].label}</Chip>} onClose={onClose}
      actions={(mine || canApprove(a)) && !['DONE', 'CANCELLED'].includes(a.status) ? <button className={cn(btnGhost, btnSm)} onClick={() => onEdit(a)}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa</button> : undefined}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {[
          ['Thời gian', `${fmtDT(a.from)} – ${fmtDT(a.to)}${a.type === 'TRIP' || isLeave ? ` (${actDays(a)} ngày)` : ''}`],
          ['Địa điểm', a.location || '—'],
          ...(a.type === 'TRIP' ? [['Phương tiện', a.transport ?? '—'], ['Lưu trú', a.lodging || '—'], ['Tạm ứng', a.advance ? vnd(a.advance) : '—']] : []),
          ...(!isLeave ? [['Dự toán chi phí', a.cost ? vnd(a.cost) : '—']] : []),
        ].map(([k, v]) => <div key={k}><dt className="text-xs text-[rgb(var(--muted))]">{k}</dt><dd className="mt-0.5">{v}</dd></div>)}
      </dl>
      {(cust || lead || prog) && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {cust && <button className="rounded-md bg-[rgb(var(--success)/0.1)] px-2 py-1 text-[rgb(var(--success-fg))] hover:underline" onClick={() => openCustomer(cust.id)}>Khách hàng: {cust.name}</button>}
          {lead && <button className="rounded-md bg-[rgb(var(--secondary)/0.1)] px-2 py-1 text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => go('projects', lead.code)}>Dự án: {lead.code}</button>}
          {prog && <button className="rounded-md bg-[rgb(var(--accent)/0.1)] px-2 py-1 text-[rgb(var(--accent-fg))] hover:underline" onClick={() => go('claims')}>Chương trình: {prog.title}</button>}
        </div>
      )}
      {a.note && <p className="rounded bg-[rgb(var(--raised))] p-3 text-sm"><span className="text-xs text-[rgb(var(--muted))]">{isLeave ? 'Lý do cá nhân' : 'Mục tiêu'}: </span>{a.note}</p>}
      {a.requestNote && a.status === 'NEED_INFO' && <p className="rounded bg-[rgb(var(--accent)/0.1)] p-3 text-sm text-[rgb(var(--accent-fg))]">Yêu cầu bổ sung: {a.requestNote}</p>}
      {a.rejectNote && <p className="rounded bg-[rgb(var(--danger)/0.1)] p-3 text-sm text-[rgb(var(--danger-fg))]">Từ chối: {a.rejectNote}</p>}

      {!isLeave && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Check-in hiện trường</h3>
          {a.checkin ? (
            <div className="space-y-2 text-sm">
              <p>Đã check-in lúc {fmtDT(a.checkin.at)}, GPS {a.checkin.lat.toFixed(5)}, {a.checkin.lng.toFixed(5)}{a.checkin.accuracy ? ` (±${Math.round(a.checkin.accuracy)} m)` : ''}{a.checkin.simulated ? ' (mô phỏng)' : ''}{a.checkin.lateMinutes > 0 ? <span className="text-[rgb(var(--accent-fg))]">, trễ {a.checkin.lateMinutes} phút</span> : <span className="text-[rgb(var(--success-fg))]">, đúng giờ</span>}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.checkin.photos.length > 0 && <div className="grid grid-cols-3 gap-2">{a.checkin.photos.map((p) => <a key={p.url} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.name} className="aspect-square w-full rounded object-cover" /></a>)}</div>}
            </div>
          ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa check-in.</p>}
          {mine && active && (
            <FilePicker accept="image/*" multiple disabled={busy} onFiles={doCheckin} className={cn(btnPrimary, btnSm, 'mt-2 inline-flex')}>
              <MapPin className="h-3.5 w-3.5" aria-hidden />{busy ? 'Đang lấy vị trí...' : a.checkin ? 'Thêm ảnh hiện trường' : 'Check-in hiện trường (chụp ảnh)'}
            </FilePicker>
          )}
          {mine && active && !a.checkin && <button className={cn(btnGhost, btnSm, 'ml-2 mt-2')} disabled={busy} onClick={() => doCheckin([])}>Check-in không ảnh</button>}
        </section>
      )}

      {!isLeave && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Kết quả buổi làm việc & Next Action</h3>
          <div className="space-y-2">
            <textarea className={cn(inputCls, 'min-h-16')} disabled={!mine} value={result} onChange={(e) => setResult(e.target.value)} placeholder="Kết quả: khách đồng ý khảo sát, cần báo giá trong tuần..." />
            <input className={inputCls} disabled={!mine} value={next} onChange={(e) => setNext(e.target.value)} placeholder="Việc tiếp theo: gửi báo giá v2 trước thứ 6" />
            {mine && (
              <div className="flex flex-wrap gap-2">
                <button className={cn(btnGhost, btnSm)} onClick={() => { patch({ result: result.trim() || undefined, nextAction: next.trim() || undefined }); notify('Đã lưu vào lịch sử chăm sóc khách hàng / dự án', 'teal'); }}>Lưu kết quả</button>
                {active && a.status !== 'DONE' && <button className={cn(btnPrimary, btnSm)} onClick={() => { patch({ status: 'DONE', result: result.trim() || undefined, nextAction: next.trim() || undefined }); notify('Đã hoàn thành, kết quả lưu vào lịch sử chăm sóc', 'teal'); }}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Hoàn thành</button>}
              </div>
            )}
          </div>
        </section>
      )}

      {!isLeave && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Chi phí phát sinh {expTotal ? `(${compact(expTotal)})` : ''}</h3>
            {a.expenseStatus && <Chip tone={EXPENSE_STATUS[a.expenseStatus].tone}>{EXPENSE_STATUS[a.expenseStatus].label}</Chip>}
          </div>
          <ul className="space-y-1.5">
            {(a.expenses ?? []).map((x) => (
              <li key={x.id} className="flex items-center gap-2 rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm">
                <ReceiptIcon className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
                <a href={x.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[rgb(var(--secondary-fg))] hover:underline">{x.name}</a>
                <span className="tabular-nums">{vnd(x.amount)}</span>
                {mine && !a.expenseStatus && <button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => patch({ expenses: (a.expenses ?? []).filter((y) => y.id !== x.id) })} aria-label="Xóa chứng từ"><Trash2 className="h-3.5 w-3.5" /></button>}
              </li>
            ))}
          </ul>
          {a.expenseNote && <p className="mt-1 text-xs text-[rgb(var(--danger-fg))]">{a.expenseNote}</p>}
          {mine && (!a.expenseStatus || a.expenseStatus === 'REJECTED') && (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]">
              <input className={cn(inputCls, 'py-1.5 text-xs')} value={exp.name} onChange={(e) => setExp({ ...exp, name: e.target.value })} placeholder="Nội dung: vé xe, khách sạn, tiếp khách..." />
              <input className={cn(inputCls, 'py-1.5 text-xs tabular-nums')} inputMode="numeric" value={exp.amount ? exp.amount.toLocaleString('vi-VN') : ''} onChange={(e) => setExp({ ...exp, amount: digits(e.target.value) })} placeholder="Số tiền" />
              <FilePicker accept="image/*,.pdf" onFiles={addExpense} className={cn(btnGhost, btnSm, 'inline-flex justify-center')}><Upload className="h-3.5 w-3.5" aria-hidden />Tải hóa đơn / vé</FilePicker>
            </div>
          )}
          {mine && (a.expenses?.length ?? 0) > 0 && (!a.expenseStatus || a.expenseStatus === 'REJECTED') && (
            <button className={cn(btnPrimary, btnSm, 'mt-2')} onClick={() => { patch({ expenseStatus: 'SUBMITTED', expenseNote: undefined, expenseSubmittedAt: Date.now() }); notify('Đã gửi chứng từ chi phí, chờ Trưởng phòng duyệt', 'teal'); }}><Send className="h-3.5 w-3.5" aria-hidden />Gửi duyệt thanh toán</button>
          )}
          {a.expenseStatus === 'SUBMITTED' && canApprove(a) && (
            <div className="mt-2 flex gap-2">
              <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--success))] font-semibold text-[rgb(var(--on-accent))]')} onClick={() => patch({ expenseStatus: 'HEAD_APPROVED' })}>Duyệt chi</button>
              <button className={cn(btnGhost, btnSm, 'text-[rgb(var(--danger-fg))]')} onClick={() => patch({ expenseStatus: 'REJECTED', expenseNote: 'Trưởng phòng từ chối chi phí' })}>Từ chối</button>
            </div>
          )}
          {a.expenseStatus === 'HEAD_APPROVED' && canDo('claim.accounting') && (
            <div className="mt-2 flex gap-2">
              <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--success))] font-semibold text-[rgb(var(--on-accent))]')} onClick={() => { patch({ expenseStatus: 'PAID' }); postCash(expenseCash(a, users, cashEntries)); notify('Đã thanh toán, tự sinh phiếu quyết toán công tác phí vào sổ quỹ', 'teal'); }}>Kế toán xác nhận thanh toán</button>
              <button className={cn(btnGhost, btnSm, 'text-[rgb(var(--danger-fg))]')} onClick={() => patch({ expenseStatus: 'REJECTED', expenseNote: 'Kế toán từ chối: chứng từ chưa hợp lệ' })}>Từ chối</button>
            </div>
          )}
        </section>
      )}
    </Drawer>
  );
}

/** Nút duyệt nhanh: Duyệt hợp lệ / Yêu cầu bổ sung / Từ chối */
export function ApprovalButtons({ a }: { a: Activity }) {
  const { setActivities, me, notify, logDecision, users, dispatch, postCash } = useApp();
  const record = (d: ApprovalDecision, note?: string) => {
    logDecision({ kind: 'ACTIVITY', refId: a.id, title: a.title, requesterId: a.userId, decision: d, note, amount: a.cost || undefined });
    const req = users.find((u) => u.id === a.userId);
    if (req && req.id !== me.id) dispatch('APPROVAL_RESULT', { to: req, title: `${DECISION_LABEL[d].label}: ${a.title}`, body: note ?? 'Đã được duyệt', module: 'staff' });
  };
  const [mode, setMode] = useState<'need' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const patch = (p: Partial<Activity>) => setActivities((all) => all.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-1.5">
        <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--success))] font-semibold text-[rgb(var(--on-accent))] hover:bg-[rgb(var(--success-fg))]')} onClick={() => { patch({ status: 'APPROVED', approvedBy: me.id }); record('APPROVED'); const adv = advanceCash(a, users); if (adv) postCash(adv); notify(adv ? `Đã duyệt, tự sinh phiếu chi tạm ứng ${vnd(adv.amount)}` : 'Đã duyệt', 'teal'); }}>Duyệt hợp lệ</button>
        <button className={cn(btnGhost, btnSm)} onClick={() => setMode(mode === 'need' ? null : 'need')}>Yêu cầu bổ sung</button>
        <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--danger)/0.25)]')} onClick={() => setMode(mode === 'reject' ? null : 'reject')}>Từ chối</button>
      </div>
      {mode && (
        <div className="flex gap-2">
          <input className={cn(inputCls, 'py-1.5 text-xs')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'need' ? 'Cần bổ sung gì?' : 'Lý do từ chối'} />
          <button className={cn(btnPrimary, 'px-2.5 py-1 text-xs')} disabled={note.trim().length < 3} onClick={() => { patch(mode === 'need' ? { status: 'NEED_INFO', requestNote: note.trim() } : { status: 'REJECTED', rejectNote: note.trim() }); record(mode === 'need' ? 'NEED_INFO' : 'REJECTED', note.trim()); setMode(null); setNote(''); notify(mode === 'need' ? 'Đã yêu cầu bổ sung' : 'Đã từ chối', 'orange'); }}>Gửi</button>
        </div>
      )}
    </div>
  );
}

export function ActivityRowCard({ a, onOpen }: { a: Activity; onOpen: () => void }) {
  const { users, customers, leads } = useApp();
  const t = ACTIVITY_TYPE[a.type];
  const cust = customers.find((c) => c.id === a.customerId);
  const lead = leads.find((l) => l.id === a.leadId);
  return (
    <button className="w-full rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 text-left hover:border-[rgb(var(--muted)/0.4)]" style={{ borderLeft: `3px solid ${t.color}` }} onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium text-[rgb(var(--fg))]">{a.title}</p>
        <Chip tone={ACTIVITY_STATUS[a.status].tone}>{ACTIVITY_STATUS[a.status].label}</Chip>
      </div>
      <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{users.find((u) => u.id === a.userId)?.name}, {fmtDT(a.from)} – {fmtDT(a.to)}</p>
      <p className="mt-0.5 truncate text-xs text-[rgb(var(--muted))]">{a.type === 'LEAVE' ? LEAVE_KIND[a.leaveKind ?? 'LEAVE'] : cust?.name ?? lead?.company ?? a.location ?? ''}{a.checkin ? ', đã check-in' : ''}{a.cost ? `, ${compact(a.cost)}` : ''}</p>
      {a.result && <p className="mt-1 truncate text-xs text-[rgb(var(--success-fg))]">Kết quả: {a.result}</p>}
      {a.nextAction && <p className="truncate text-xs text-[rgb(var(--accent-fg))]">Tiếp theo: {a.nextAction}</p>}
    </button>
  );
}

/** Lịch gặp & công tác của một khách hàng / dự án — chính là lịch sử chăm sóc */
export function ActivityList({ customerId, leadId }: { customerId?: string; leadId?: string }) {
  const { activities } = useApp();
  const scope = useActivityScope();
  const [form, setForm] = useState<{ a?: Activity } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const list = activities.filter((a) => scope.includes(a.userId) && ((customerId && a.customerId === customerId) || (leadId && a.leadId === leadId))).sort((a, b) => b.from.localeCompare(a.from));
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[rgb(var(--fg))]">Lịch sử chăm sóc & công tác</h3>
        <button className={cn(btnGhost, btnSm)} onClick={() => setForm({})}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm lịch</button>
      </div>
      <div className="space-y-2">{list.slice(0, 8).map((a) => <ActivityRowCard key={a.id} a={a} onOpen={() => setOpen(a.id)} />)}</div>
      {!list.length && <p className="text-sm text-[rgb(var(--muted))]">Chưa có lịch gặp hoặc công tác.</p>}
      {form && <ActivityFormModal activity={form.a} preset={{ customerId, leadId, type: leadId && !customerId ? 'SURVEY' : 'MEETING' }} onClose={() => setForm(null)} />}
      {open && <ActivityDrawer id={open} onClose={() => setOpen(null)} onEdit={(a) => { setOpen(null); setForm({ a }); }} />}
    </section>
  );
}

export function StaffModule() {
  const { activities, users, dept, customers, leads, canDo } = useApp();
  const scope = useActivityScope();
  const canApprove = useActivityApprover();
  const inR = useInRange();
  const [tab, setTab] = useSticky<'list' | 'approval' | 'summary'>('StaffModule.tab', 'list');
  const [view, setView] = useSticky<'table' | 'calendar'>('StaffModule.view', 'table');
  const [q, setQ] = useSticky('StaffModule.q', '');
  const [who, setWho] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [form, setForm] = useState<{ a?: Activity } | null>(null);
  useIntent('staff.create', () => setForm({}));
  const [open, setOpen] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; });
  const mine = activities.filter((a) => scope.includes(a.userId));
  const pending = mine.filter((a) => a.status === 'PENDING_APPROVAL' && canApprove(a));
  const pendingExp = mine.filter((a) => (a.expenseStatus === 'SUBMITTED' && canApprove(a)) || (a.expenseStatus === 'HEAD_APPROVED' && canDo('claim.accounting')));
  const match = (a: Activity) => {
    const t = q.trim().toLowerCase();
    return (!t || [a.title, a.note, a.location, customers.find((c) => c.id === a.customerId)?.name ?? ''].some((v) => v.toLowerCase().includes(t))) && (who === 'ALL' || a.userId === who) && (type === 'ALL' || a.type === type);
  };
  const list = mine.filter((a) => match(a) && inR(a.from.slice(0, 10))).sort((a, b) => a.from.localeCompare(b.from));
  const live = list.filter((a) => !['CANCELLED', 'REJECTED'].includes(a.status));
  const people = users.filter((u) => scope.includes(u.id) && u.active);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const dayKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const meetings = live.filter((a) => a.type === 'MEETING' || a.type === 'SURVEY');
  const trips = live.filter((a) => a.type === 'TRIP' && ['APPROVED', 'DONE'].includes(a.status));
  const leaves = live.filter((a) => a.type === 'LEAVE' && a.status === 'APPROVED');
  const waiting = pending.length + pendingExp.length;

  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Gặp khách hàng" value={String(meetings.length)} icon={Users} color={C.teal} sub={`${meetings.filter((a) => a.status === 'DONE').length} cuộc đã hoàn thành`} />
        <StatCard label="Ngày công tác" value={String(trips.reduce((s, a) => s + actDays(a), 0))} icon={Plane} color={C.blue} sub={`Chi phí ${compact(trips.reduce((s, a) => s + a.cost, 0))}`} />
        <StatCard label="Nghỉ & việc riêng" value={String(leaves.filter((a) => (a.leaveKind ?? 'LEAVE') === 'LEAVE').reduce((s, a) => s + actDays(a), 0))} icon={CalendarDays} color={C.red} sub={`${leaves.filter((a) => a.leaveKind && a.leaveKind !== 'LEAVE').length} lần đi muộn / giải trình`} />
        <StatCard label="Chờ duyệt" value={String(mine.filter((a) => a.status === 'PENDING_APPROVAL').length + pendingExp.length)} icon={Clock} color={C.orange} sub={waiting ? `${waiting} cần bạn duyệt` : 'Không có việc chờ bạn'} />
      </div>

      <Tabs tabs={[{ id: 'list', label: 'Lịch' }, { id: 'approval', label: waiting ? `Chờ duyệt (${waiting})` : 'Chờ duyệt' }, { id: 'summary', label: 'Tổng hợp' }]} value={tab} onChange={setTab} />

      <FilterBar q={q} onQ={setQ} placeholder="Tìm tiêu đề, khách hàng, địa điểm..." status={type} onStatus={setType} statusLabel="Mọi loại" statusOptions={(Object.keys(ACTIVITY_TYPE) as ActivityType[]).map((t) => ({ value: t, label: ACTIVITY_TYPE[t].label }))} extraActive={who !== 'ALL' ? 1 : 0}>
        <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Nhân sự">
          <option value="ALL">Tất cả nhân sự</option>
          {people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </FilterBar>

      {tab === 'list' && (
        <Panel
          title={view === 'table' ? `${list.length} lịch trong khoảng đang lọc` : `Tuần ${fmtDate(dayKey(days[0]))} – ${fmtDate(dayKey(days[6]))}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded bg-[rgb(var(--bg))] p-0.5" role="radiogroup" aria-label="Kiểu xem">
                <button role="radio" aria-checked={view === 'table'} onClick={() => setView('table')} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium', view === 'table' ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))]')}><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />Dạng bảng</button>
                <button role="radio" aria-checked={view === 'calendar'} onClick={() => setView('calendar')} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium', view === 'calendar' ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))]')}><CalendarDays className="h-3.5 w-3.5" aria-hidden />Lịch tuần</button>
              </div>
              <button className={cn(btnPrimary, btnSm, 'max-lg:hidden')} onClick={() => setForm({})}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm lịch</button>
            </div>
          }
        >
          {view === 'table' ? (
            <>
              <div className="space-y-2 md:hidden">{list.map((a) => <ActivityRowCard key={a.id} a={a} onOpen={() => setOpen(a.id)} />)}</div>
              <div className="hidden md:block">
                <Table head={['Thời gian', 'Nhân sự', 'Loại', 'Nội dung / khách hàng', 'Chi phí', 'Check-in', 'Trạng thái']} minW={980}>
                  {list.map((a) => {
                    const cust = customers.find((c) => c.id === a.customerId);
                    const lead = leads.find((l) => l.id === a.leadId);
                    return (
                      <tr key={a.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => setOpen(a.id)}>
                        <td className={cn(tdFirst, 'whitespace-nowrap tabular-nums')}>{fmtDT(a.from)}<p className="text-xs text-[rgb(var(--muted))]">đến {fmtDT(a.to)}</p></td>
                        <td className={tdCls}>{users.find((u) => u.id === a.userId)?.name}</td>
                        <td className={tdCls}><span className="flex items-center gap-1.5 text-xs"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: ACTIVITY_TYPE[a.type].color }} />{a.type === 'LEAVE' ? LEAVE_KIND[a.leaveKind ?? 'LEAVE'] : ACTIVITY_TYPE[a.type].label}</span></td>
                        <td className={tdCls}><p className="max-w-[280px] truncate">{a.title}</p><p className="max-w-[280px] truncate text-xs text-[rgb(var(--muted))]">{cust?.name ?? lead?.company ?? a.location}</p></td>
                        <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{a.cost ? compact(a.cost) : '—'}{a.expenseStatus && <p className="text-[11px] text-[rgb(var(--muted))]">{EXPENSE_STATUS[a.expenseStatus].label}</p>}</td>
                        <td className={tdCls}>{a.checkin ? <Chip tone={a.checkin.lateMinutes > 0 ? 'orange' : 'teal'}>{a.checkin.lateMinutes > 0 ? `Trễ ${a.checkin.lateMinutes} phút` : 'Đúng giờ'}</Chip> : <span className="text-xs text-[rgb(var(--muted))]">—</span>}</td>
                        <td className={tdLast}><Chip tone={ACTIVITY_STATUS[a.status].tone}>{ACTIVITY_STATUS[a.status].label}</Chip></td>
                      </tr>
                    );
                  })}
                </Table>
              </div>
              {!list.length && <EmptyState text={<>Chưa có lịch trong khoảng thời gian này.</>} hint={<>Lên lịch gặp khách, công tác hoặc nghỉ để quản lý duyệt và theo dõi chi phí.</>} art="calendar" action="Thêm lịch ngay" onAction={() => setForm({})} />}
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <button className={cn(btnGhost, btnSm)} onClick={() => setWeekStart((d) => new Date(d.getTime() - 7 * 864e5))} aria-label="Tuần trước"><ChevronRight className="h-4 w-4 rotate-180" /></button>
                <button className={cn(btnGhost, btnSm)} onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); setWeekStart(d); }}>Tuần này</button>
                <button className={cn(btnGhost, btnSm)} onClick={() => setWeekStart((d) => new Date(d.getTime() + 7 * 864e5))} aria-label="Tuần sau"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {days.map((d) => {
                  const k = dayKey(d);
                  const items = mine.filter((a) => match(a) && a.from.slice(0, 10) <= k && a.to.slice(0, 10) >= k).sort((a, b) => a.from.localeCompare(b.from));
                  const today = k === todayISO();
                  return (
                    <div key={k} className={cn('min-h-[120px] rounded-md border p-2', today ? 'border-[rgb(var(--accent)/0.6)] bg-[rgb(var(--accent)/0.05)]' : 'border-[rgb(var(--line))] bg-[rgb(var(--sunken))]')}>
                      <p className={cn('mb-2 text-xs font-semibold', today ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{WEEKDAY[d.getDay()]} {pad2(d.getDate())}/{pad2(d.getMonth() + 1)}</p>
                      <div className="space-y-1.5">
                        {items.map((a) => (
                          <button key={a.id} className="w-full rounded-md px-2 py-1.5 text-left text-[11px] leading-tight hover:brightness-125" style={{ background: `${ACTIVITY_TYPE[a.type].color}22`, borderLeft: `3px solid ${ACTIVITY_TYPE[a.type].color}` }} onClick={() => setOpen(a.id)}>
                            <span className="block tabular-nums text-[rgb(var(--muted))]">{a.from.slice(11, 16)}</span>
                            <span className="block truncate text-[rgb(var(--fg))]">{a.title}</span>
                            <span className="block truncate text-[rgb(var(--muted))]">{users.find((u) => u.id === a.userId)?.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      )}

      {tab === 'approval' && (
        <>
          <Panel title={`Đề nghị chờ bạn duyệt (${pending.length})`}>
            <ul className="space-y-2">
              {pending.map((a) => {
                const cust = customers.find((c) => c.id === a.customerId);
                const lead = leads.find((l) => l.id === a.leadId);
                return (
                  <li key={a.id} className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3" style={{ borderLeft: `3px solid ${ACTIVITY_TYPE[a.type].color}` }}>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
                      <button className="min-w-0 text-left" onClick={() => setOpen(a.id)}>
                        <p className="text-sm font-medium">{users.find((u) => u.id === a.userId)?.name}: {a.type === 'LEAVE' ? LEAVE_KIND[a.leaveKind ?? 'LEAVE'] : ACTIVITY_TYPE[a.type].label}</p>
                        <p className="text-xs text-[rgb(var(--muted))]">{fmtDT(a.from)} – {fmtDT(a.to)}{a.type === 'TRIP' || a.type === 'LEAVE' ? ` (${actDays(a)} ngày)` : ''}{cust ? `, gặp ${cust.name}` : lead ? `, dự án ${lead.company}` : ''}{a.location ? `, ${a.location}` : ''}</p>
                        <p className="mt-1 text-xs">{a.type === 'LEAVE' ? 'Lý do' : 'Mục tiêu'}: <span className="text-[rgb(var(--muted))]">{a.note || '—'}</span></p>
                        {(a.cost > 0 || (a.advance ?? 0) > 0) && <p className="text-xs tabular-nums">Chi phí đề xuất <b>{vnd(a.cost)}</b>{a.advance ? `, tạm ứng ${vnd(a.advance)}` : ''}{a.transport ? `, ${a.transport}` : ''}</p>}
                      </button>
                      <ApprovalButtons a={a} />
                    </div>
                  </li>
                );
              })}
            </ul>
            {!pending.length && <EmptyState text={<>Không có đề nghị chờ duyệt.</>} art="inbox" />}
          </Panel>
          <Panel title={`Chứng từ chi phí chờ duyệt (${pendingExp.length})`}>
            <ul className="space-y-2">
              {pendingExp.map((a) => (
                <li key={a.id}>
                  <button className="flex w-full flex-wrap items-center gap-3 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 text-left" onClick={() => setOpen(a.id)}>
                    <ReceiptIcon className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />
                    <span className="min-w-0 flex-1 text-sm">{users.find((u) => u.id === a.userId)?.name}: {a.title}<span className="block text-xs text-[rgb(var(--muted))]">{(a.expenses ?? []).length} chứng từ</span></span>
                    <span className="tabular-nums">{vnd((a.expenses ?? []).reduce((s, x) => s + x.amount, 0))}</span>
                    {a.expenseStatus && <Chip tone={EXPENSE_STATUS[a.expenseStatus].tone}>{EXPENSE_STATUS[a.expenseStatus].label}</Chip>}
                  </button>
                </li>
              ))}
            </ul>
            {!pendingExp.length && <EmptyState text={<>Không có chứng từ chờ duyệt.</>} art="doc" />}
          </Panel>
        </>
      )}

      {tab === 'summary' && (
        <Panel title="Tổng hợp theo nhân sự (khoảng thời gian đang lọc)">
          <Table head={['Nhân sự', 'Phòng ban', 'Gặp khách', 'Khách đã gặp', 'Ngày công tác', 'Ngày nghỉ', 'Đi muộn / giải trình', 'Chi phí']} minW={860}>
            {people.map((u) => {
              const xs = live.filter((a) => a.userId === u.id);
              return (
                <tr key={u.id} className={rowCls}>
                  <td className={tdFirst}>{u.name}</td>
                  <td className={tdCls}>{dept(u.dept)?.short ?? 'Ban Giám đốc'}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{xs.filter((a) => a.type === 'MEETING' || a.type === 'SURVEY').length}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{new Set(xs.filter((a) => a.customerId).map((a) => a.customerId)).size}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{xs.filter((a) => a.type === 'TRIP' && ['APPROVED', 'DONE'].includes(a.status)).reduce((s, a) => s + actDays(a), 0)}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{xs.filter((a) => a.type === 'LEAVE' && a.status === 'APPROVED' && (a.leaveKind ?? 'LEAVE') === 'LEAVE').reduce((s, a) => s + actDays(a), 0)}</td>
                  <td className={cn(tdCls, 'tabular-nums')}>{xs.filter((a) => a.type === 'LEAVE' && a.leaveKind && a.leaveKind !== 'LEAVE').length}</td>
                  <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums')}>{compact(xs.reduce((s, a) => s + a.cost, 0))}</td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      )}
      <Fab label="Thêm lịch công tác" onClick={() => setForm({})} />
      {form && <ActivityFormModal activity={form.a} onClose={() => setForm(null)} />}
      {open && <ActivityDrawer id={open} onClose={() => setOpen(null)} onEdit={(a) => { setOpen(null); setForm({ a }); }} />}
    </div>
  );
}

