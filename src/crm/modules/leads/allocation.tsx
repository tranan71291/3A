'use client';

import { type DragEvent, type ReactNode, useState } from 'react';
import { ArrowRight, ChevronDown, Clock, Inbox, Lock, MapPin, Pencil, Phone, Trash2, Users, Wallet } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { RouteMenu } from '../../components/command-palette';
import { CommentButton } from '../../components/comments';
import { AgeBadge, Avatar, BulkBar, Pagination, RowMenu, usePaged, useSelection } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { ChipFilter, FilterBar, useInRange } from '../../components/filters';
import { QuoteTimer, Sla } from '../../components/sla';
import { Chip, Code, EmptyState, Modal, Panel, Table, useSticky, ViewSwitch } from '../../components/ui';
import { scoreLead } from '../../lib/business';
import { boqIsEstimate, boqTotal, btnGhost, btnPrimary, btnSm, C, compact, deptIcon, fmtDur, initials, inputCls, isAcceptLate, isQuoteOverdue, LEAD_STATUS, leadAgeH, leadDate, OPEN_STATUSES, overdueCls, REGION_LABEL, rowCls, SEGMENT_LABEL, segName, tdCls, tdFirst, tdLast, useApp } from '../../lib/core';
import type { ConfirmState, DeptCode, Lead, LeadStatus, MenuItem, Region } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  PHÂN BỔ PHÒNG BAN — kéo-thả, SLA đếm ngược
// =====================================================================

// =====================================================================
//  PHÂN LEAD 2 BƯỚC — B1: MKT phân về phòng ban | B2: Trưởng phòng chỉ định Sales
//  Sales tiếp nhận trong SLA 2 giờ, sau đó khảo sát & nộp báo giá trong 24 giờ
// =====================================================================

export function SlaTimer({ deadline, now }: { deadline: number; now: number | null }) {
  if (now == null) return <span className="text-xs text-[rgb(var(--muted))]">--:--</span>;
  const diff = deadline - now;
  if (diff < 0) return <Sla tone="over">Quá {fmtDur(diff)}</Sla>;
  return <Sla tone={diff < 30 * 6e4 ? 'tight' : 'ok'}>Còn {fmtDur(diff)}</Sla>;
}

export function AssignModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { users, leads, assignLead, dept } = useApp();
  const reps = users.filter((u) => u.active && u.role === 'SALES_REP' && u.dept === lead.dept);
  const load = (id: string) => leads.filter((x) => x.assignee === id && OPEN_STATUSES.includes(x.status)).length;
  const minLoad = Math.min(...reps.map((r) => load(r.id)));
  const [pick, setPick] = useState(reps.find((r) => load(r.id) === minLoad)?.id ?? '');
  const d = dept(lead.dept);

  return (
    <Modal
      title="Chỉ định Sales phụ trách"
      onClose={onClose}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>Hủy</button>
          <button className={btnPrimary} disabled={!pick} onClick={() => { assignLead(lead.id, pick); onClose(); }}>
            <Clock className="h-4 w-4" aria-hidden />Chỉ định và bắt đầu SLA {d?.slaMinutes ?? 120} phút
          </button>
        </>
      }
    >
      <div className="mb-4 rounded bg-[rgb(var(--raised))] p-3 text-sm">
        <p className="font-medium text-[rgb(var(--fg))]">{lead.company}</p>
        <p className="text-xs text-[rgb(var(--muted))]">{lead.code}, {lead.boqNote}{boqTotal(lead) ? `, ${boqIsEstimate(lead) ? 'ước tính' : 'BOQ'} ${compact(boqTotal(lead))}` : ''}</p>
        <p className="mt-1 text-xs text-[rgb(var(--muted))]">Phân về {d?.name}: {lead.routingReason}</p>
      </div>
      {reps.length === 0 ? (
        <p className="text-sm text-[rgb(var(--danger-fg))]">Phòng chưa có Sales đang hoạt động. Thêm nhân sự ở Cài đặt &gt; Phòng ban & Nhân sự.</p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-medium text-[rgb(var(--muted))]">Sales trực thuộc {d?.short}</legend>
          {reps.map((r) => (
            <label key={r.id} className={cn('flex cursor-pointer items-center gap-3 rounded border px-3 py-2.5', pick === r.id ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.05)]' : 'border-[rgb(var(--line))] hover:bg-[rgb(var(--raised))]')}>
              <input type="radio" name="rep" className="accent-[rgb(var(--accent))]" checked={pick === r.id} onChange={() => setPick(r.id)} />
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--raised))] text-xs font-semibold text-[rgb(var(--accent-fg))]">{initials(r.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-[rgb(var(--fg))]">{r.name}</span>
                <span className="block text-xs text-[rgb(var(--muted))]">{r.phone ?? r.email}</span>
              </span>
              <span className="text-right text-xs">
                <span className="block tabular-nums text-[rgb(var(--fg))]">{load(r.id)} lead đang xử lý</span>
                {load(r.id) === minLoad && reps.length > 1 && <span className="text-[rgb(var(--success-fg))]">Ít việc nhất</span>}
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </Modal>
  );
}

export function LeadCard({ l, now, action, onMenu, compact: small }: { l: Lead; now: number | null; action?: ReactNode; onMenu?: MenuItem[]; compact?: boolean }) {
  const { userName } = useApp();
  const late = isAcceptLate(l, now) || isQuoteOverdue(l, now);
  return (
    <article className={cn('rounded-md border bg-[rgb(var(--raised))] p-3', late ? overdueCls : 'border-[rgb(var(--line))]')}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium leading-snug text-[rgb(var(--fg))]">{l.company}</p>
        <AgeBadge hours={leadAgeH(l, now)} />
      </div>
      {!small && <p className="mt-0.5 line-clamp-2 text-xs text-[rgb(var(--muted))]">{l.boqNote}</p>}
      <div className="mt-2 space-y-0.5 text-xs text-[rgb(var(--muted))]">
        <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" aria-hidden />{l.province ?? REGION_LABEL[l.region]}</p>
        <p className="flex items-center gap-1.5"><Users className="h-3 w-3" aria-hidden />{l.assignee ? userName(l.assignee) : l.dept ? 'Chờ chỉ định' : 'MKT'}</p>
      </div>
      {l.status === 'ASSIGNED' && <div className="mt-2"><SlaTimer deadline={l.slaDeadline ?? 0} now={now} /></div>}
      {l.status === 'ACCEPTED' && <div className="mt-2"><QuoteTimer deadline={l.quoteDeadline} now={now} /></div>}
      {(action || onMenu) && (
        <div className="mt-2.5 flex items-center justify-end gap-1.5">
          {action}
          {onMenu && <RowMenu items={onMenu} />}
        </div>
      )}
    </article>
  );
}

export function AllocationPage() {
  const { myLeads: leads, setLeads, customers, now, routeLeads, acceptLead, canDo, routableDepts, me, role, openLeadForm, notify } = useApp();
  const inR = useInRange();
  const [q, setQ] = useSticky('AllocationPage.q', '');
  const [reg, setReg] = useState<'ALL' | Region>('ALL');
  const [seg, setSeg] = useSticky('AllocationPage.seg', 'ALL');
  const [st, setSt] = useState('ALL');
  const [dragOver, setDragOver] = useState<DeptCode | null>(null);
  const [assigning, setAssigning] = useState<Lead | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [openCol, setOpenCol] = useState<string>('INBOX');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [view, setView] = useSticky<'table' | 'board'>('AllocationPage.view', 'table');
  const { userName, dept: deptOf } = useApp();
  const canRoute = canDo('lead.route');
  const canAssignIn = (d?: DeptCode) => canDo('lead.assign') && (role === 'BOD' || me.dept === d);
  const canAcceptLead = (l: Lead) => canDo('lead.accept') && (role === 'BOD' || (role === 'DEPT_HEAD' && me.dept === l.dept) || l.assignee === me.id);

  const match = (l: Lead) => {
    const t = q.trim().toLowerCase();
    return (!t || [l.company, l.code, l.taxCode ?? '', l.phone].some((v) => v.toLowerCase().includes(t))) && (st === 'ALL' || l.status === st) && (reg === 'ALL' || l.region === reg) && (seg === 'ALL' || l.segment === seg) && inR(leadDate(l));
  };
  const scope = leads.filter((l) => inR(leadDate(l)));
  const total = scope.length;
  const atLeast = (arr: LeadStatus[]) => scope.filter((l) => arr.includes(l.status)).length;
  const steps: [string, number][] = [
    ['Phân về phòng ban', atLeast(['ROUTED', 'ASSIGNED', 'ACCEPTED', 'QUOTED', 'WON', 'LOST'])],
    ['Trưởng phòng chỉ định', atLeast(['ASSIGNED', 'ACCEPTED', 'QUOTED', 'WON', 'LOST'])],
    ['Sales tiếp nhận', atLeast(['ACCEPTED', 'QUOTED', 'WON', 'LOST'])],
    ['Khảo sát & báo giá', atLeast(['QUOTED', 'WON', 'LOST'])],
  ];
  const unrouted = leads.filter((l) => (l.status === 'NEW' || l.status === 'NURTURE') && match(l));
  const late = scope.filter((l) => isAcceptLate(l, now) || isQuoteOverdue(l, now)).length;
  const depts = role === 'BOD' || role === 'MKT_LEAD' ? routableDepts : routableDepts.filter((d) => d.code === me.dept);

  const onDrop = (e: DragEvent, code: DeptCode) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/plain');
    if (id && canRoute) routeLeads([id], code);
  };
  const menuFor = (l: Lead): MenuItem[] => [
    { label: 'Sửa thông tin lead', icon: Pencil, onClick: () => openLeadForm(false, l.id), disabled: !canDo('lead.create') },
    ...(l.status === 'NEW' ? [{ label: 'Chuyển nuôi dưỡng', icon: Clock, onClick: () => setLeads((p) => p.map((x) => (x.id === l.id ? { ...x, status: 'NURTURE' as LeadStatus } : x))), disabled: !canRoute }] : []),
    ...(l.status === 'NURTURE' ? [{ label: 'Đưa về chờ phân phòng', icon: Inbox, onClick: () => setLeads((p) => p.map((x) => (x.id === l.id ? { ...x, status: 'NEW' as LeadStatus } : x))), disabled: !canRoute }] : []),
    ...(['NEW', 'NURTURE', 'ROUTED'].includes(l.status) ? routableDepts.filter((d) => d.code !== l.dept).map((d) => ({ label: `Phân về ${d.short}`, icon: ArrowRight, onClick: () => routeLeads([l.id], d.code), disabled: !canRoute })) : []),
    ...(l.phone ? [{ label: `Gọi ${l.phone}`, icon: Phone, onClick: () => { window.location.href = `tel:${l.phone.replace(/\s/g, '')}`; } }] : []),
    { label: 'Xóa lead', icon: Trash2, danger: true, disabled: !canDo('lead.create'), onClick: () => setConfirm({ title: 'Xóa lead', message: <>Xóa lead <b>{l.code}</b> {l.company}?</>, onConfirm: () => removeWithUndo(setLeads, l, notify, `Đã xóa lead ${l.code}`) }) },
  ];
  const limit = (key: string, arr: Lead[], n = 4) => (expanded.includes(key) ? arr : arr.slice(0, n));
  const more = (key: string, arr: Lead[], n = 4) => arr.length > n && (
    <button className="w-full rounded py-2 text-center text-xs text-[rgb(var(--muted))] hover:bg-[rgb(var(--raised))] hover:text-[rgb(var(--fg))]" onClick={() => setExpanded((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]))}>
      {expanded.includes(key) ? 'Thu gọn' : `Xem thêm ${arr.length - n} lead`}
    </button>
  );

  /** Bảng hợp nhất: lead chờ phân phòng + lead đang xử lý trong các phòng */
  const flow = ['NEW', 'NURTURE', 'ROUTED', 'ASSIGNED', 'ACCEPTED'];
  const tableRows = [...unrouted, ...leads.filter((l) => !!l.dept && depts.some((d) => d.code === l.dept) && match(l) && ['ROUTED', 'ASSIGNED', 'ACCEPTED'].includes(l.status))]
    .sort((x, y) => Number(isAcceptLate(y, now) || isQuoteOverdue(y, now)) - Number(isAcceptLate(x, now) || isQuoteOverdue(x, now)) || flow.indexOf(x.status) - flow.indexOf(y.status) || leadAgeH(y, now) - leadAgeH(x, now));
  const paged = usePaged(tableRows, 10);
  const sel = useSelection(tableRows.filter((l) => ['NEW', 'NURTURE', 'ROUTED'].includes(l.status)).map((l) => l.id));
  const slaCell = (l: Lead) => l.status === 'ASSIGNED' ? <SlaTimer deadline={l.slaDeadline ?? 0} now={now} /> : l.status === 'ACCEPTED' ? <QuoteTimer deadline={l.quoteDeadline} now={now} /> : <AgeBadge hours={leadAgeH(l, now)} />;
  const actionCell = (l: Lead) => l.status === 'NEW' ? <RouteMenu lead={l} />
    : l.status === 'ROUTED' ? <button disabled={!canAssignIn(l.dept)} className={cn(btnGhost, btnSm)} onClick={() => setAssigning(l)}>Chỉ định</button>
    : l.status === 'ASSIGNED' ? <button disabled={!canAcceptLead(l)} className={cn(btnGhost, btnSm)} onClick={() => acceptLead(l.id)}>Tiếp nhận</button>
    : null;

  type Col = { key: string; title: string; icon: typeof Wallet; tint: string; count: number; body: ReactNode; drop?: DeptCode };
  const cols: Col[] = [
    ...(canRoute ? [{
      key: 'INBOX', title: 'MKT chờ phân phòng', icon: Inbox, tint: C.orange, count: unrouted.length,
      body: (
        <>
          {limit('INBOX', unrouted).map((l) => (
            <div key={l.id} draggable={canRoute} onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)} className={canRoute ? 'cursor-grab active:cursor-grabbing' : ''}>
              <LeadCard l={l} now={now} onMenu={menuFor(l)} action={
                l.status === 'NEW'
                  ? <RouteMenu lead={l} />
                  : <span className="text-[11px] text-[rgb(var(--muted))]">Điểm {l.score ?? scoreLead(l, customers)}, nuôi dưỡng</span>
              } />
            </div>
          ))}
          {more('INBOX', unrouted)}
          {!unrouted.length && <p className="py-6 text-center text-xs text-[rgb(var(--muted))]">Không có lead chờ phân phòng.</p>}
        </>
      ),
    }] : []),
    ...depts.map((d) => {
      const inDept = leads.filter((l) => l.dept === d.code && match(l) && ['ROUTED', 'ASSIGNED', 'ACCEPTED'].includes(l.status))
        .sort((a, b) => ['ROUTED', 'ASSIGNED', 'ACCEPTED'].indexOf(a.status) - ['ROUTED', 'ASSIGNED', 'ACCEPTED'].indexOf(b.status));
      return {
        key: d.code, title: d.name, icon: deptIcon(d.code), tint: d.code.startsWith('EMD') ? C.blue : C.teal, count: inDept.length, drop: d.code,
        body: (
          <>
            {limit(d.code, inDept).map((l) => (
              <div key={l.id} draggable={canRoute && l.status === 'ROUTED'} onDragStart={(e) => e.dataTransfer.setData('text/plain', l.id)}>
                <LeadCard l={l} now={now} onMenu={menuFor(l)} action={
                  l.status === 'ROUTED' ? <button disabled={!canAssignIn(l.dept)} className={cn(btnPrimary, 'px-2.5 py-1 text-xs')} onClick={() => setAssigning(l)}>Chỉ định</button>
                  : l.status === 'ASSIGNED' ? <button disabled={!canAcceptLead(l)} className={cn(btnGhost, btnSm)} onClick={() => acceptLead(l.id)}>Tiếp nhận</button>
                  : <span className="text-[11px] text-[rgb(var(--muted))]">Đang báo giá</span>
                } />
              </div>
            ))}
            {more(d.code, inDept)}
            {!inDept.length && <p className="rounded border border-dashed border-[rgb(var(--line))] px-3 py-6 text-center text-xs text-[rgb(var(--muted))]">{canRoute ? `Thả lead vào đây để phân về ${d.short}` : 'Không có lead'}</p>}
          </>
        ),
      };
    }),
  ];

  return (
    <div className="space-y-4">
      <ol className="kpi-strip grid grid-cols-2 lg:grid-cols-4" aria-label="Quy trình phân lead">
        {steps.map(([title, n], i) => (
          <li key={title} className="flex min-w-0 flex-col gap-1 px-4 py-3">
            <p className="flex items-baseline gap-2 text-[12.5px] text-[rgb(var(--muted))]"><span className="font-mono text-[11px] text-[rgb(var(--faint))]">{String(i + 1).padStart(2, '0')}</span><span className="truncate">{title}</span></p>
            <p className="text-[22px] font-medium leading-7 tabular-nums">{n}<span className="ml-1 text-xs font-normal text-[rgb(var(--muted))]">/ {total} lead</span></p>
            <div className="mt-1 h-1 rounded-full bg-[rgb(var(--ink)/0.08)]"><div className="h-full rounded-full" style={{ width: `${total ? (n / total) * 100 : 0}%`, background: i === 3 ? 'rgb(var(--accent))' : 'rgb(var(--fg) / 0.75)' }} /></div>
          </li>
        ))}
      </ol>
      {late > 0 && <p className="flex items-center gap-2 text-sm text-[rgb(var(--fg2))]"><Clock className="h-4 w-4 text-[rgb(var(--danger-fg))]" aria-hidden />{late} lead quá SLA (tiếp nhận 2 giờ hoặc báo giá 24 giờ), xếp đầu bảng</p>}

      <FilterBar q={q} onQ={setQ} placeholder="Tìm MST, tên khách hàng, mã lead…" status={st} onStatus={setSt} extraActive={(reg !== 'ALL' ? 1 : 0) + (seg !== 'ALL' ? 1 : 0)}
        actions={<>
          <ViewSwitch value={view} onChange={setView} options={['table', 'board']} />
        </>}
        chips={<ChipFilter value={st === 'ALL' ? 'ALL' : st as LeadStatus} onChange={(v) => setSt(v)} total={tableRows.length} options={(['NEW', 'ROUTED', 'ASSIGNED', 'ACCEPTED'] as LeadStatus[]).map((x) => ({ value: x, label: LEAD_STATUS[x].label, count: leads.filter((l) => l.status === x && inR(leadDate(l))).length, color: x === 'ACCEPTED' ? C.teal : C.orange }))} />}
        statusOptions={(['NEW', 'NURTURE', 'ROUTED', 'ASSIGNED', 'ACCEPTED'] as LeadStatus[]).map((s) => ({ value: s, label: LEAD_STATUS[s].label }))}>
        <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={reg} onChange={(e) => setReg(e.target.value as 'ALL' | Region)} aria-label="Khu vực">
          <option value="ALL">Tất cả khu vực</option>
          {(Object.keys(REGION_LABEL) as Region[]).map((r) => <option key={r} value={r}>{REGION_LABEL[r]}</option>)}
        </select>
        <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={seg} onChange={(e) => setSeg(e.target.value)} aria-label="Nhóm khách hàng">
          <option value="ALL">Tất cả nhóm khách</option>
          {Object.keys(SEGMENT_LABEL).map((s) => <option key={s} value={s}>{segName(s)}</option>)}
        </select>
      </FilterBar>

      {!canRoute && <p className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]"><Lock className="h-3.5 w-3.5" aria-hidden />Bạn đang xem lead {role === 'SALES_REP' ? 'được giao cho bạn' : 'của phòng mình'}. Toàn bộ lead chỉ Giám đốc và Marketing xem được.</p>}

      {view === 'table' && (
        <>
          <BulkBar count={sel.ids.length} onClear={sel.clear}>
            {routableDepts.map((d) => <button key={d.code} className={cn(btnGhost, btnSm)} disabled={!canRoute} onClick={() => { routeLeads(sel.ids, d.code); sel.clear(); }}><ArrowRight className="h-3.5 w-3.5" aria-hidden />Phân về {d.short}</button>)}
          </BulkBar>
          <Panel>
            <Table stt={Math.max(0, paged.from - 1)} minW={1000} head={[
              <input key="all" type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={sel.allOn} onChange={sel.toggleAll} aria-label="Chọn tất cả" disabled={!canRoute} />,
              'Mã', 'Khách hàng', 'Nhu cầu', 'Phòng', 'Phụ trách', <span key="v" className="block text-right">BOQ</span>, 'SLA', 'Trạng thái', <span key="a" className="block text-right">Thao tác</span>,
            ]}>
              {paged.slice.map((l) => {
                const late = isAcceptLate(l, now) || isQuoteOverdue(l, now);
                const canSel = ['NEW', 'NURTURE', 'ROUTED'].includes(l.status);
                return (
                  <tr key={l.id} className={cn(rowCls, sel.has(l.id) && 'bg-[rgb(var(--accent)/0.05)]')}>
                    <td className={cn(tdFirst, 'w-10', late && 'shadow-[inset_3px_0_0_rgb(var(--danger))]')}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" disabled={!canSel || !canRoute} checked={sel.has(l.id)} onChange={() => sel.toggle(l.id)} aria-label={`Chọn ${l.company}`} /></td>
                    <td className={tdCls}><Code>{l.code}</Code></td>
                    <td className={tdCls} title={`${l.province ?? REGION_LABEL[l.region]}${l.phone ? ` · ${l.phone}` : ''}`}><span className="block max-w-[240px] truncate font-medium">{l.company}</span></td>
                    <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[200px] truncate" title={l.boqNote}>{l.boqNote || (l.province ?? REGION_LABEL[l.region])}</span></td>
                    <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{l.dept ? deptOf(l.dept)?.short ?? l.dept : <span className="text-[rgb(var(--muted))]">MKT</span>}</td>
                    <td className={cn(tdCls, 'max-w-[170px]')}>{l.assignee ? <span className="flex items-center gap-2"><Avatar name={userName(l.assignee)} size={22} /><span className="truncate text-sm">{userName(l.assignee)}</span></span> : <span className="text-xs text-[rgb(var(--muted))]">{l.dept ? 'Chờ chỉ định' : '—'}</span>}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{boqTotal(l) ? compact(boqTotal(l)) : '—'}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>{slaCell(l)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap')}>{late ? <Chip tone="red">Quá hạn SLA</Chip> : <Chip tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Chip>}</td>
                    <td className={tdLast}><div className="flex items-center justify-end gap-1.5">{actionCell(l)}<CommentButton entity="lead" entityId={l.id} title={`${l.code} · ${l.company}`} module="leads" /><RowMenu items={menuFor(l)} /></div></td>
                  </tr>
                );
              })}
            </Table>
            {!tableRows.length && <EmptyState text={<>Không có lead khớp bộ lọc.</>} art="search" />}
            <Pagination paged={paged} unit="lead" />
          </Panel>
        </>
      )}

      {view === 'board' && <>
      {/* Desktop: bảng kanban */}
      <div className={cn('hidden gap-4 lg:grid', cols.length >= 4 ? 'lg:grid-cols-4' : cols.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>
        {cols.map((c) => (
          <section
            key={c.key}
            onDragOver={c.drop ? (e) => { e.preventDefault(); setDragOver(c.drop!); } : undefined}
            onDragLeave={c.drop ? () => setDragOver(null) : undefined}
            onDrop={c.drop ? (e) => onDrop(e, c.drop!) : undefined}
            className={cn('flex flex-col rounded-md border bg-[rgb(var(--surface))] p-3 transition-colors', dragOver && dragOver === c.drop ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.05)]' : 'border-[rgb(var(--line))]')}
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <span className="flex h-8 w-8 items-center justify-center rounded" style={{ background: `${c.tint}26`, color: c.tint }}><c.icon className="h-4 w-4" aria-hidden /></span>
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{c.title}</h3>
              <span className="rounded-md bg-[rgb(var(--raised))] px-2 py-0.5 text-xs font-semibold tabular-nums">{c.count}</span>
            </header>
            <div className="space-y-2.5">{c.body}</div>
          </section>
        ))}
      </div>

      {/* Mobile: từng cột dạng xếp gọn */}
      <div className="space-y-2 lg:hidden">
        {cols.map((c) => (
          <section key={c.key} className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
            <button className="flex w-full items-center gap-2 px-3 py-3 text-left" onClick={() => setOpenCol(openCol === c.key ? '' : c.key)} aria-expanded={openCol === c.key}>
              <span className="flex h-8 w-8 items-center justify-center rounded" style={{ background: `${c.tint}26`, color: c.tint }}><c.icon className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.title}</span>
              <span className="rounded-md bg-[rgb(var(--raised))] px-2 py-0.5 text-xs font-semibold tabular-nums text-[rgb(var(--accent-fg))]">{c.count}</span>
              <ChevronDown className={cn('h-4 w-4 text-[rgb(var(--muted))] transition-transform', openCol === c.key && 'rotate-180')} aria-hidden />
            </button>
            {openCol === c.key && <div className="space-y-2.5 border-t border-[rgb(var(--line))] p-3">{c.body}</div>}
          </section>
        ))}
      </div>

      </>}

      {assigning && <AssignModal lead={assigning} onClose={() => setAssigning(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

