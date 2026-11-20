'use client';

import { CalendarDays, CheckCircle2, Factory, Package, PenTool, Pencil, Trash2, Warehouse } from 'lucide-react';
import { useState } from 'react';
import { removeWithUndo } from '../../app/context';
import { Pagination, RowMenu, usePaged } from '../../components/controls';
import { Drawer } from '../../components/drawer';
import { useInRange } from '../../components/filters';
import { Sla } from '../../components/sla';
import { Chip, Code, EmptyState, Field, Panel, StatCard, Table, useSticky } from '../../components/ui';
import { btnBase, btnGhost, btnPrimary, btnSm, C, DESIGN_STATUS, DESIGN_STEPS, fmtDate, fmtDT, inputCls, jobCustName, kpiGrid, rowCls, tdCls, tdFirst, tdLast, useApp, WO_STAGE, WO_STAGES, woLate } from '../../lib/core';
import type { DesignStatus, WorkOrder, WoStage } from '../../lib/types';
import { cn } from '../../lib/utils';
import { InstallScheduleModal } from './install';
import { StockVoucherModal } from './materials';
import { InfoGrid, SearchBox, StagePills } from './orders';

/** Chuyển trạng thái lệnh sản xuất, ghi lịch sử, báo người liên quan */
export function useWoActions() {
  const { me, setWorkOrders, jobs, users, dispatch, notify, audit, customers } = useApp();
  return (w: WorkOrder, to: WoStage) => {
    const now = Date.now();
    setWorkOrders((all) => all.map((x) => (x.id === w.id ? { ...x, stage: to, startedAt: to === 'IN_PROGRESS' ? now : x.startedAt, doneAt: to === 'DONE' ? now : x.doneAt, items: to === 'DONE' ? x.items.map((i) => ({ ...i, done: i.qty })) : x.items, history: [...x.history, { stage: to, at: now, by: me.id }] } : x)));
    audit('WO_STAGE', `${w.code}: ${WO_STAGE[to].label}`);
    if (to === 'DONE') {
      const j = jobs.find((x) => x.id === w.jobId);
      const to2 = users.filter((u) => u.active && (u.id === j?.ownerId || (u.dept === 'LAP_DAT' && u.role === 'DEPT_HEAD')));
      to2.forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title: `Sản xuất xong: ${j ? jobCustName(j, customers) : w.title}`, body: `${w.code} đã hoàn thành, hẹn lịch lắp đặt với khách.`, module: 'install' }));
      notify(`${w.code} đã hoàn thành. Hẹn lịch lắp đặt để chuyển sang Lắp đặt.`, 'teal');
    } else notify(`${w.code}: ${WO_STAGE[to].label}`, 'teal');
  };
}

export function WoActionButton({ w, onSchedule }: { w: WorkOrder; onSchedule: (w: WorkOrder) => void }) {
  const { canDo, installJobs } = useApp();
  const move = useWoActions();
  const ins = installJobs.find((i) => i.workOrderId === w.id);
  if (w.stage === 'WAITING') return <button className={cn(btnGhost, btnSm, 'whitespace-nowrap')} disabled={!canDo('production.manage')} onClick={(e) => { e.stopPropagation(); move(w, 'IN_PROGRESS'); }}><Factory className="h-3.5 w-3.5" aria-hidden />Bắt đầu sản xuất</button>;
  if (w.stage === 'IN_PROGRESS') return <button className={cn(btnBase, btnSm, 'whitespace-nowrap border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)]')} disabled={!canDo('production.manage')} onClick={(e) => { e.stopPropagation(); move(w, 'DONE'); }}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Xác nhận hoàn thành</button>;
  if (ins) return <span className="whitespace-nowrap text-xs text-[rgb(var(--success-fg))]">{ins.status === 'ACCEPTED' ? 'Đã lắp đặt' : `Hẹn lắp ${ins.from ? fmtDT(ins.from) : ''}`}</span>;
  return <button className={cn(btnPrimary, btnSm, 'whitespace-nowrap')} disabled={!canDo('install.manage') && !canDo('production.manage')} onClick={(e) => { e.stopPropagation(); onSchedule(w); }}><CalendarDays className="h-3.5 w-3.5" aria-hidden />Lên lịch lắp đặt</button>;
}

/** Thiết kế & bản vẽ triển khai: Đang vẽ → Chờ duyệt → Đã duyệt (ghi lịch sử, có Hoàn tác) */
export function DesignStep({ w, can, patch }: { w: WorkOrder; can: boolean; patch: (p: Partial<WorkOrder>) => void }) {
  const app = useApp();
  const { me, userName, notify } = app;
  const cur = w.design?.status;
  const idx = cur ? DESIGN_STEPS.indexOf(cur) : -1;
  const go = (status: DesignStatus) => {
    const prev = w.design;
    if (status === 'APPROVED' && prev?.status === 'REVIEW' && prev.by === me.id && (app.wfPolicy.noSelf && !(app.me?.role === 'BOD' && app.wfPolicy.soleBodSelf && app.users.filter((u) => u.active && u.role === 'BOD').length === 1))) return notify('Người gửi bản vẽ không tự duyệt: chờ người duyệt theo quy trình', 'orange');
    if (status === 'APPROVED' && prev?.status === 'REVIEW' && !app.wfFirstApprovers('DESIGN', { requesterId: prev.by, vals: {} }).some((u) => u.id === me.id) && me.role !== 'BOD') return notify('Bạn không phải người duyệt bản vẽ theo quy trình', 'orange');
    patch({ design: { ...w.design, status, by: me.id, at: Date.now() } });
    if (status === 'REVIEW') app.wfFirstApprovers('DESIGN', { requesterId: me.id, vals: {} }).filter((u) => u.id !== me.id).forEach((u) => app.dispatch('APPROVAL_RESULT', { to: u, title: `Bản vẽ chờ duyệt: ${w.code}`, body: w.title, module: 'tasks' }));
    notify(DESIGN_STATUS[status].label, 'teal', { label: 'Hoàn tác', run: () => patch({ design: prev }) });
  };
  return (
    <section className="rounded-md border border-[rgb(var(--line))] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <PenTool className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />
        <h3 className="text-sm font-semibold">Thiết kế & bản vẽ</h3>
        <span className="ml-auto">{cur ? <Chip tone={DESIGN_STATUS[cur].tone}>{DESIGN_STATUS[cur].label}</Chip> : <Chip>Chưa bắt đầu</Chip>}</span>
      </div>
      <ol className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Tiến độ thiết kế">
        {DESIGN_STEPS.map((s, i) => <li key={s} className={cn('h-1.5 rounded-full', i <= idx ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--ink)/0.1)]')} title={DESIGN_STATUS[s].label} />)}
      </ol>
      {w.design?.at && <p className="mt-2 text-xs text-[rgb(var(--muted))]">Cập nhật {new Date(w.design.at).toLocaleString('vi-VN')} bởi {userName(w.design.by)}</p>}
      {can && cur !== 'APPROVED' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={cn(btnPrimary, btnSm)} onClick={() => go(cur ? DESIGN_STEPS[idx + 1] : 'DRAFTING')}>{cur ? DESIGN_STATUS[cur].next : 'Bắt đầu triển khai bản vẽ'}</button>
          {cur === 'REVIEW' && <button className={cn(btnGhost, btnSm)} onClick={() => go('DRAFTING')}>Yêu cầu sửa</button>}
        </div>
      )}
    </section>
  );
}

export function WorkOrderDrawer({ id, onClose, onSchedule }: { id: string; onClose: () => void; onSchedule: (w: WorkOrder) => void }) {
  const { workOrders, setWorkOrders, jobs, customers, userName, canDo, stockMoves, stockItems, users } = useApp();
  const [out, setOut] = useState(false);
  const w = workOrders.find((x) => x.id === id);
  if (!w) return null;
  const j = jobs.find((x) => x.id === w.jobId);
  const moves = stockMoves.filter((m) => m.type === 'OUT' && m.woId === w.id);
  const can = canDo('production.manage');
  const patch = (p: Partial<WorkOrder>) => setWorkOrders((all) => all.map((x) => (x.id === w.id ? { ...x, ...p } : x)));
  return (
    <Drawer title={j ? jobCustName(j, customers) : w.title} eyebrow={`${w.code}${j ? ` · ${j.code}` : ''}`} badge={<Chip tone={WO_STAGE[w.stage].tone}>{WO_STAGE[w.stage].label}</Chip>} onClose={onClose}
      actions={<><WoActionButton w={w} onSchedule={onSchedule} />{canDo('stock.manage') && <button className={cn(btnGhost, btnSm)} onClick={() => setOut(true)}><Warehouse className="h-3.5 w-3.5" aria-hidden />Xuất vật tư</button>}</>}>
      <ol className="grid grid-cols-3 gap-2" aria-label="Trạng thái sản xuất">
        {WO_STAGES.map((s, i) => {
          const cur = WO_STAGES.indexOf(w.stage);
          return <li key={s} className={cn('rounded border px-2 py-2 text-center text-xs font-medium', i < cur || w.stage === 'DONE' ? 'border-[rgb(var(--success)/0.4)] bg-[rgb(var(--success)/0.1)] text-[rgb(var(--success-fg))]' : i === cur ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))]')}>{WO_STAGE[s].label}</li>;
        })}
      </ol>
      <DesignStep w={w} can={can} patch={patch} />
      <InfoGrid rows={[
        ['Hạng mục', j?.title ?? w.title, true],
        ['Địa chỉ công trình', j?.siteAddress ?? '', true],
        ['Ngày nhận lệnh', fmtDate(w.startDate)],
        ['Hạn hoàn thành', <span className={woLate(w) ? 'text-[rgb(var(--danger-fg))]' : ''}>{fmtDate(w.dueDate)}{woLate(w) ? ' (trễ hạn)' : ''}</span>],
        ['Phụ trách xưởng', userName(w.leaderId)],
        ['Kỹ thuật đo đạc', userName(j?.ownerId)],
      ]} />
      {can && w.stage !== 'DONE' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Hạn hoàn thành"><input className={inputCls} type="date" value={w.dueDate} onChange={(e) => patch({ dueDate: e.target.value })} /></Field>
          <Field label="Phụ trách xưởng"><select className={inputCls} value={w.leaderId ?? ''} onChange={(e) => patch({ leaderId: e.target.value || undefined })}><option value="">Chưa giao</option>{users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        </div>
      )}
      <section>
        <h3 className="mb-2 text-sm font-semibold">Hạng mục sản xuất ({w.items.length})</h3>
        <Table head={['STT', 'Hạng mục', 'Kích thước', 'Số lượng']} minW={480}>
          {w.items.map((it, i) => (
            <tr key={it.id} className={rowCls}>
              <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{i + 1}</td>
              <td className={cn(tdCls, 'text-sm')}>{it.name}</td>
              <td className={cn(tdCls, 'whitespace-nowrap text-xs text-[rgb(var(--muted))]')}>{it.spec || '—'}</td>
              <td className={cn(tdLast, 'text-right tabular-nums whitespace-nowrap')}>{it.qty.toLocaleString('vi-VN')} {it.unit}</td>
            </tr>
          ))}
        </Table>
      </section>
      {j && j.files.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Bản vẽ & ảnh khảo sát</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {j.files.map((f) => (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border border-[rgb(var(--line))] bg-[rgb(var(--raised))]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.url.startsWith('data:image') ? <img src={f.url} alt={f.name} className="aspect-square w-full object-cover" /> : <span className="flex aspect-square items-center justify-center p-2 text-center text-[11px] text-[rgb(var(--muted))]">{f.name}</span>}
              </a>
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-2 text-sm font-semibold">Vật tư đã xuất ({moves.length})</h3>
        {moves.length ? (
          <ul className="space-y-1 text-sm">
            {moves.map((m) => { const it = stockItems.find((s) => s.id === m.itemId); return <li key={m.id} className="flex justify-between gap-2 rounded bg-[rgb(var(--raised))] px-3 py-1.5"><span>{it?.name ?? m.itemId} <span className="text-xs text-[rgb(var(--muted))]">{m.code}, {fmtDate(m.date)}</span></span><span className="whitespace-nowrap tabular-nums">{m.qty} {it?.unit}</span></li>; })}
          </ul>
        ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa xuất vật tư cho lệnh này.</p>}
      </section>
      <Field label="Ghi chú xưởng"><textarea className={cn(inputCls, 'min-h-16')} disabled={!can} value={w.note} onChange={(e) => patch({ note: e.target.value })} /></Field>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Lịch sử</h3>
        <ul className="space-y-1 text-xs text-[rgb(var(--muted))]">{[...w.history].reverse().map((h, i) => <li key={i}>{new Date(h.at).toLocaleString('vi-VN')}: {WO_STAGE[h.stage]?.label ?? h.stage}, {userName(h.by)}{h.note ? `. ${h.note}` : ''}</li>)}</ul>
      </section>
      {out && <StockVoucherModal type="OUT" preset={{ woId: w.id, jobId: w.jobId }} onClose={() => setOut(false)} />}
    </Drawer>
  );
}

export function ProductionModule() {
  const { workOrders, jobs, customers, installJobs, userName, setWorkOrders, canDo, notify, me } = useApp();
  const inR = useInRange();
  const [st, setSt] = useState<WoStage | 'ALL'>('WAITING');
  const [q, setQ] = useSticky('ProductionModule.q', '');
  const [open, setOpen] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<WorkOrder | null>(null);
  const t = q.trim().toLowerCase();
  const jobOf = (w: WorkOrder) => jobs.find((j) => j.id === w.jobId);
  const visible = workOrders.filter((w) => w.stage !== 'DONE' || !installJobs.some((i) => i.workOrderId === w.id && i.status === 'ACCEPTED') || inR(w.dueDate));
  const count = (s: WoStage) => visible.filter((w) => w.stage === s).length;
  const list = visible.filter((w) => (st === 'ALL' || w.stage === st) && (!t || `${w.code} ${w.title} ${jobOf(w)?.siteAddress ?? ''}`.toLowerCase().includes(t)))
    .sort((a, b) => WO_STAGES.indexOf(a.stage) - WO_STAGES.indexOf(b.stage) || a.dueDate.localeCompare(b.dueDate));
  const paged = usePaged(list, 20);
  const waitInstall = workOrders.filter((w) => w.stage === 'DONE' && !installJobs.some((i) => i.workOrderId === w.id)).length;
  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Chờ sản xuất" value={String(count('WAITING'))} icon={Package} color={C.sand} sub="Đã nhận cọc, chờ xưởng nhận" />
        <StatCard label="Đang sản xuất" value={String(count('IN_PROGRESS'))} icon={Factory} color={C.blue} sub={`${workOrders.filter(woLate).length} lệnh trễ hạn`} />
        <StatCard label="Hoàn thành, chờ hẹn lắp" value={String(waitInstall)} icon={CalendarDays} color={C.orange} />
        <StatCard label="Hoàn thành trong kỳ" value={String(workOrders.filter((w) => w.stage === 'DONE' && w.doneAt && inR(new Date(w.doneAt))).length)} icon={CheckCircle2} color={C.teal} />
      </div>
      <div className="tb40 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchBox value={q} onChange={setQ} placeholder="Tìm mã lệnh, khách hàng, địa chỉ" />
        <div className="min-w-0 flex-1"><StagePills items={[...WO_STAGES.map((s) => ({ id: s as WoStage | 'ALL', label: WO_STAGE[s].label, count: count(s) })), { id: 'ALL', label: 'Tất cả', count: visible.length }]} value={st} onChange={(v) => { setSt(v); paged.setPage(1); }} /></div>
      </div>
      <Panel>
        <div>
          <Table head={['STT', 'Lệnh SX', 'Khách hàng', 'Đội trưởng', 'Hạng mục', <span key="n" className="block text-right">Số mục</span>, 'Ngày nhận', 'Hạn xong', 'Trạng thái', 'Thiết kế', 'Thao tác']} minW={1320}>
            {paged.slice.map((w, i) => {
              const j = jobOf(w);
              return (
                <tr key={w.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => setOpen(w.id)}>
                  <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{(paged.page - 1) * 20 + i + 1}</td>
                  <td className={cn(tdCls, woLate(w) && 'shadow-[inset_3px_0_0_rgb(var(--danger))]')}><Code>{w.code}</Code></td>
                  <td className={tdCls}><span className="block max-w-[220px] truncate font-medium">{j ? jobCustName(j, customers) : customers.find((c) => c.id === w.customerId)?.name ?? '—'}</span></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{userName(w.leaderId)}</td>
                  <td className={tdCls}><span className="block max-w-[240px] truncate" title={j?.title ?? w.title}>{j?.title ?? w.title}</span></td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{w.items.length}</td>
                  <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(w.startDate)}</td>
                  <td className={tdCls}>{woLate(w) ? <Sla tone="over">{fmtDate(w.dueDate)} · trễ</Sla> : <span className="font-mono text-xs text-[rgb(var(--fg2))]">{fmtDate(w.dueDate)}</span>}</td>
                  <td className={tdCls}><Chip tone={WO_STAGE[w.stage].tone}>{WO_STAGE[w.stage].label}</Chip></td>
                  <td className={cn(tdCls, 'text-[13px] text-[rgb(var(--muted))]')}>{w.design && w.stage !== 'DONE' ? DESIGN_STATUS[w.design.status].label : '—'}</td>
                  <td className={tdLast}><div className="flex items-center justify-end gap-1"><WoActionButton w={w} onSchedule={setSchedule} /><span onClick={(e) => e.stopPropagation()}><RowMenu items={[{ label: 'Xem / sửa lệnh', icon: Pencil, onClick: () => setOpen(w.id) }, { label: 'Xóa lệnh', icon: Trash2, danger: true, disabled: !(me?.role === 'BOD' || canDo('production.delete')) || w.stage !== 'WAITING' || installJobs.some((i) => i.workOrderId === w.id), onClick: () => removeWithUndo(setWorkOrders, w, notify, `Đã xóa ${w.code}`) }]} /></span></div></td>
                </tr>
              );
            })}
          </Table>
        </div>
        {!list.length && <EmptyState text={<>Không có lệnh sản xuất</>} hint={<>Lệnh tự tạo khi đơn hàng nhận cọc.</>} art="box" />}
        <Pagination paged={paged} unit="lệnh" />
      </Panel>
      {open && <WorkOrderDrawer id={open} onClose={() => setOpen(null)} onSchedule={(w) => { setOpen(null); setSchedule(w); }} />}
      {schedule && <InstallScheduleModal wo={schedule} onClose={() => setSchedule(null)} />}
    </div>
  );
}

