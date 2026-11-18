'use client';

import { useState } from 'react';
import { AlertTriangle, BadgePercent, CheckCircle2, Download, Eye, FileSpreadsheet, FileText, History, Link2, Paperclip, Pencil, Plus, RefreshCw, Send, Trash2, Upload, XCircle } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { CommentButton } from '../../components/comments';
import { Avatar, BulkBar, Fab, MobileRow, Pagination, RowMenu, usePaged, useSelection } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Drawer } from '../../components/drawer';
import { FilterBar, useInRange } from '../../components/filters';
import { QuoteTimer } from '../../components/sla';
import { Chip, EmptyState, Field, FilePicker, Modal, MoneyInput, Panel, Table, Tabs, useSort, useSticky, ViewSwitch } from '../../components/ui';
import { latestContracts } from '../../lib/business';
import { boqIsEstimate, boqTotal, btnBase, btnDanger, btnGhost, btnPrimary, btnSm, compact, fmtDate, inputBase, inputCls, iso, isoMs, isQuoteOverdue, lastQuoteOf, LEAD_STATUS, leadAt, leadDate, LOST_REASON, median, PP_STATUS, QUOTE_STATUS, quotesOfCustomer, REGION_LABEL, rowCls, segName, SOURCE_LABEL, stageLabel, STAGES, tdCls, tdFirst, tdLast, useApp, vnd } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import { projectValue, quoteTotals } from '../../lib/getfly';
import type { ConfirmState, Customer, Lead, LeadStatus, LostReason, MenuItem, Quote, Stage, Tone } from '../../lib/types';
import { cn } from '../../lib/utils';
import { BoqEditorModal } from './boq';
import { GeneratedDocList } from '../sales/contract';
import { ProjectFlow } from '../sales/sales-flow';
import { ActivityList } from '../staff/staff';
import { ReservedGoodsPanel } from '../supply/inventory';

export function PriceProtectionModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { setLeads, notify } = useApp();
  const [discount, setDiscount] = useState(lead.priceProtection?.discountPct ?? 5);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const err = touched && reason.trim().length < 10 ? 'Mô tả đối thủ, giá cạnh tranh hoặc lý do cần bảo vệ giá (tối thiểu 10 ký tự)' : undefined;
  const discErr = touched && (discount <= 0 || discount > 30) ? 'Mức giảm từ 1% đến 30%' : undefined;

  const submit = () => {
    setTouched(true);
    if (reason.trim().length < 10 || discount <= 0 || discount > 30) return;
    setLeads((p) => p.map((l) => (l.id === lead.id ? { ...l, priceProtection: { status: 'REQUESTED', discountPct: discount, reason: reason.trim() } } : l)));
    notify(`Đã gửi đề xuất bảo vệ giá ${discount}% cho ${lead.company}`, 'teal');
    onClose();
  };

  return (
    <Modal title="Đề xuất bảo vệ giá với Hãng" onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={submit}><BadgePercent className="h-4 w-4" aria-hidden />Gửi đề xuất</button></>}>
      <div className="space-y-4">
        <div className="rounded bg-[rgb(var(--raised))] p-3 text-sm">
          <p className="font-medium text-[rgb(var(--fg))]">{lead.boqNote}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{lead.company}, {boqIsEstimate(lead) ? 'ước tính' : 'BOQ'} {vnd(boqTotal(lead))}</p>
        </div>
        <Field label="Mức giá đặc biệt đề nghị (% giảm so với giá niêm yết)" error={discErr}>
          <input className={inputCls} type="number" min={1} max={30} step={0.5} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
        </Field>
        <p className="text-sm text-[rgb(var(--muted))]">Giá trị sau bảo vệ giá: <span className="tabular-nums text-[rgb(var(--fg))]">{vnd(boqTotal(lead) * (1 - discount / 100))}</span></p>
        <Field label="Lý do / đối thủ cạnh tranh" error={err}>
          <textarea className={cn(inputCls, 'min-h-24')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Chủ đầu tư nhận báo giá hãng khác thấp hơn 7%, chốt thầu ngày 20/10" />
        </Field>
      </div>
    </Modal>
  );
}

export function LostModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const { markLost } = useApp();
  const [reason, setReason] = useState<LostReason>('PRICE');
  const [note, setNote] = useState('');
  return (
    <Modal
      title={`Ghi nhận Trượt: ${lead.company}`}
      onClose={onClose}
      footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnDanger} onClick={() => { markLost(lead.id, reason, note.trim()); onClose(); }}>Xác nhận Trượt</button></>}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium text-[rgb(var(--muted))]">Lý do trượt</legend>
        {(Object.keys(LOST_REASON) as LostReason[]).map((r) => (
          <label key={r} className={cn('flex cursor-pointer items-center gap-3 rounded border px-3 py-2.5 text-sm', reason === r ? 'border-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.05)]' : 'border-[rgb(var(--line))] hover:bg-[rgb(var(--raised))]')}>
            <input type="radio" name="lost" className="accent-[rgb(var(--danger))]" checked={reason === r} onChange={() => setReason(r)} />
            {LOST_REASON[r]}
          </label>
        ))}
      </fieldset>
      <Field label="Ghi chú (đối thủ, mức giá, bài học)" className="mt-4">
        <textarea className={cn(inputCls, 'min-h-20')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Đối thủ chào thấp hơn 9%, tặng bảo trì 2 năm" />
      </Field>
    </Modal>
  );
}

export function projectStatus(l: Lead, now: number | null, quotes: Quote[]): { label: string; tone: Tone } {
  if (isQuoteOverdue(l, now)) return { label: 'Quá hạn báo giá', tone: 'red' };
  if (l.status === 'QUOTED' && l.priceProtection?.status === 'REQUESTED') return { label: 'Chờ 3M duyệt giá', tone: 'blue' };
  if (l.status === 'QUOTED') return { label: lastQuoteOf(l.id, quotes) ? 'Chờ khách phản hồi' : 'Đã gửi báo giá', tone: 'orange' };
  return LEAD_STATUS[l.status];
}

export function ProjectDrawer({ id, onClose, onBoq, onLost, onPP, onEdit }: { id: string; onClose: () => void; onBoq: (l: Lead) => void; onLost: (l: Lead) => void; onPP: (l: Lead) => void; onEdit: (l: Lead) => void }) {
  const { leads, setLeads, quotes, genDocs, userName, dept, now, canDo, openWin, openCustomer, notify, reopenLead, openComposer, skus } = useApp();
  const [tab, setTab] = useState<'quote' | 'contract' | 'progress'>('quote');
  const l = leads.find((x) => x.id === id);
  if (!l) return null;
  const st = projectStatus(l, now, quotes);
  const qs = quotes.filter((q) => q.leadId === l.id).sort((a, b) => b.version - a.version);
  const canEdit = canDo('project.update');
  const patch = (p: Partial<Lead>) => setLeads((all) => all.map((x) => (x.id === l.id ? { ...x, ...p } : x)));
  const pp = l.priceProtection;
  const won = quotes.find((q) => q.id === l.wonQuoteId);
  const wonT = won ? quoteTotals(won.lines, won.vatPct) : null;
  const contracts = genDocs.filter((d) => d.leadId === l.id);
  const latestC = latestContracts(contracts)[0];
  const pv = projectValue(l, quotes);

  return (
    <Drawer
      title={l.company}
      eyebrow={`${l.code}, ${dept(l.dept)?.short ?? ''}, ${userName(l.assignee)}`}
      badge={<Chip tone={st.tone}>{st.label}</Chip>}
      onClose={onClose}
      actions={
        <>
          {['ACCEPTED', 'QUOTED'].includes(l.status) && <button className={cn(btnPrimary, btnSm)} disabled={!canEdit} onClick={() => openComposer({ leadId: l.id, mode: 'QUOTE' })}><FileText className="h-3.5 w-3.5" aria-hidden />{qs.length ? 'Báo giá điều chỉnh' : 'Tạo báo giá'}</button>}
          {l.status === 'QUOTED' && (
            <>
              <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success-fg))] hover:bg-[rgb(var(--success)/0.25)]')} disabled={!canEdit} onClick={() => openWin(l.id)}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Chốt đơn</button>
              <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--danger)/0.25)]')} disabled={!canEdit} onClick={() => onLost(l)}>Trượt</button>
            </>
          )}
          {l.status === 'WON' && <button className={cn(btnPrimary, btnSm)} disabled={!canEdit} onClick={() => openComposer(latestC ? { docId: latestC.id, view: true } : { leadId: l.id, quoteId: l.wonQuoteId, mode: 'CONTRACT' })}><FileText className="h-3.5 w-3.5" aria-hidden />{latestC ? 'Mở hợp đồng' : 'Tạo hợp đồng'}</button>}
          {l.status === 'LOST' && <button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => reopenLead(l.id)}>Mở lại</button>}
          <button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => onEdit(l)}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa</button>
        </>
      }
    >
      <ProjectFlow lead={l} />
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded bg-[rgb(var(--raised))] p-2.5"><p className="text-[11px] text-[rgb(var(--muted))]">Giá trị dự án</p><p className="font-semibold tabular-nums">{compact(pv.value)}</p><p className="truncate text-[10px] text-[rgb(var(--muted))]">{pv.source}</p></div>
        <div className="rounded bg-[rgb(var(--raised))] p-2.5"><p className="text-[11px] text-[rgb(var(--muted))]">Hạn báo giá</p><div className="mt-0.5">{l.status === 'ACCEPTED' ? <QuoteTimer deadline={l.quoteDeadline} now={now} /> : <span className="text-xs">{qs[0] ? `Đã gửi ${fmtDate(qs[0].date)}` : '—'}</span>}</div></div>
        <div className="rounded bg-[rgb(var(--raised))] p-2.5"><p className="text-[11px] text-[rgb(var(--muted))]">Liên hệ</p><p className="truncate text-xs">{l.contact}</p><p className="truncate text-[10px] text-[rgb(var(--muted))]">{l.phone}</p></div>
      </div>

      <Tabs tabs={[{ id: 'quote', label: 'Báo giá & BOQ' }, { id: 'contract', label: 'Hợp đồng & Doanh số' }, { id: 'progress', label: 'Tiến độ & Công tác' }]} value={tab} onChange={setTab} />

      {tab === 'quote' && (
        <div className="space-y-5">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Bóc tách BOQ {l.boqItems?.length ? `(${compact(boqTotal(l))})` : ''}</h3>
              <button className={cn(btnGhost, btnSm)} disabled={!canEdit || l.status === 'WON' || l.status === 'LOST'} onClick={() => onBoq(l)}><Pencil className="h-3.5 w-3.5" aria-hidden />{l.boqItems?.length ? 'Sửa BOQ' : 'Bóc tách BOQ'}</button>
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {l.boqFile ? (
                <a href={l.boqFile.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-[rgb(var(--secondary-fg))] hover:underline"><FileText className="h-3.5 w-3.5" aria-hidden />{l.boqFile.name}</a>
              ) : (
                <FilePicker accept=".pdf,.xls,.xlsx,.csv,.dwg,.jpg,.jpeg,.png" disabled={!canEdit} onFiles={(f) => { patch({ hasBoqFile: true, boqFile: { name: f[0].name, url: URL.createObjectURL(f[0]) } }); notify(`Đã đính kèm ${f[0].name}`, 'teal'); }} className={cn(btnGhost, btnSm, 'inline-flex')}><Upload className="h-3.5 w-3.5" aria-hidden />Tải file BOQ</FilePicker>
              )}
            </div>
            {l.boqItems?.length ? (
              <ul className="divide-y divide-[rgb(var(--line))] rounded border border-[rgb(var(--line))] text-sm">
                {l.boqItems.map((it) => (
                  <li key={it.code} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="min-w-0"><span className="block truncate">{it.name}</span><span className="text-xs text-[rgb(var(--muted))]">{it.code}, {it.qty} {it.unit} x {vnd(it.price)}{!skus.some((s) => s.sku === it.code) ? ', chưa có trong danh mục' : ''}</span></span>
                    <span className="shrink-0 tabular-nums">{compact(it.qty * it.price * (1 - it.discountPct / 100))}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa bóc tách. Giá trị đang dùng số ước tính {compact(l.boqValue)}.</p>}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Phiên bản báo giá ({qs.length})</h3>
            {qs.length ? (
              <ul className="space-y-2">
                {qs.map((q) => (
                  <li key={q.id} className="rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><b>{q.code}</b> <span className="text-xs text-[rgb(var(--muted))]">v{q.version}, {fmtDate(q.date)}, {q.lines.length} dòng</span></span>
                      <span className="flex items-center gap-2"><span className="tabular-nums">{compact(q.amount)}</span><Chip tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Chip></span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {q.approval && <Chip tone={q.approval.status === 'APPROVED' ? 'teal' : q.approval.status === 'PENDING' ? 'orange' : 'red'}>{q.approval.status === 'APPROVED' ? 'Đã duyệt giá' : q.approval.status === 'PENDING' ? `Chờ ${q.approval.level === 'BOD' ? 'BOD' : 'TP'} duyệt giá` : q.approval.status === 'NEED_INFO' ? 'Yêu cầu sửa giá' : 'Từ chối giá'}</Chip>}
                      {canDo('price.viewCost') && q.gmPct !== undefined && <span className="text-xs tabular-nums text-[rgb(var(--muted))]">GM {q.gmPct.toFixed(1)}%</span>}
                      <button className={cn(btnGhost, btnSm, 'ml-auto')} onClick={() => openComposer({ leadId: l.id, quoteId: q.id, mode: 'QUOTE' })}><Eye className="h-3.5 w-3.5" aria-hidden />Xem</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có báo giá. Bấm "Tạo báo giá": dòng hàng lấy từ BOQ, sửa giá / chiết khấu, xem trước A4 rồi xuất.</p>}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Bảo vệ giá 3M</h3>
              {!pp && ['ACCEPTED', 'QUOTED'].includes(l.status) && <button className={cn(btnGhost, btnSm)} disabled={!canDo('price.request')} onClick={() => onPP(l)}><BadgePercent className="h-3.5 w-3.5" aria-hidden />Đề xuất</button>}
            </div>
            {pp ? (
              <div className="rounded bg-[rgb(var(--raised))] p-3 text-sm">
                <div className="flex items-center justify-between gap-2"><span>Giảm {pp.discountPct}%{pp.ref ? `, mã ${pp.ref}` : ''}</span><Chip tone={PP_STATUS[pp.status].tone}>{PP_STATUS[pp.status].label}</Chip></div>
                <p className="mt-1 text-xs text-[rgb(var(--muted))]">{pp.reason}</p>
              </div>
            ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa đề xuất.</p>}
          </section>
        </div>
      )}

      {tab === 'contract' && (
        <div className="space-y-5">
          {l.status === 'WON' && won && wonT ? (
            <section className="rounded-md border border-[rgb(var(--success)/0.4)] bg-[rgb(var(--success)/0.05)] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--success-fg))]"><CheckCircle2 className="h-4 w-4" aria-hidden />Đã chốt đơn theo {won.code} v{won.version}{l.wonAt ? `, ngày ${fmtDate(l.wonAt)}` : ''}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-xs text-[rgb(var(--muted))]">Doanh số trước VAT</p><p className="font-semibold tabular-nums">{vnd(wonT.sub)}</p></div>
                <div><p className="text-xs text-[rgb(var(--muted))]">VAT</p><p className="font-semibold tabular-nums">{vnd(wonT.vat)}</p></div>
                <div><p className="text-xs text-[rgb(var(--muted))]">Sau VAT</p><p className="font-semibold tabular-nums">{vnd(wonT.gross)}</p></div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs">
                {l.getflySync?.status === 'SYNCED' ? <Chip tone="teal"><Link2 className="h-3 w-3" aria-hidden />Getfly {l.getflySync.orderCode}</Chip> : <Chip tone="teal"><RefreshCw className="h-3 w-3" aria-hidden />Đã kích hoạt đồng bộ Getfly CRM</Chip>}
                <span className="text-[rgb(var(--muted))]">{l.getflySync?.status === 'SYNCED' ? 'Đơn đã có trên Getfly' : 'Gửi tự động khi tích hợp được bật'}</span>
              </div>
              {l.customerId && <button className={cn(btnGhost, btnSm, 'mt-3')} onClick={() => openCustomer(l.customerId!)}>Xem khách hàng</button>}
            </section>
          ) : l.status === 'LOST' ? (
            <p className="rounded bg-[rgb(var(--danger)/0.1)] p-3 text-sm text-[rgb(var(--danger-fg))]">Trượt{l.lostReason ? `: ${LOST_REASON[l.lostReason]}` : ''}{l.lostNote ? `. ${l.lostNote}` : ''}</p>
          ) : (
            <p className="rounded bg-[rgb(var(--raised))] p-3 text-sm text-[rgb(var(--muted))]">Chưa chốt đơn. Khi chốt, chọn phiên bản báo giá; doanh số được ghi nhận và hợp đồng tự soạn từ báo giá đó.</p>
          )}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Hợp đồng</h3>
              {l.status === 'WON' && !contracts.length && <button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => openComposer({ leadId: l.id, quoteId: l.wonQuoteId, mode: 'CONTRACT' })}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo hợp đồng</button>}
            </div>
            <GeneratedDocList leadId={l.id} compact />
          </section>
        </div>
      )}

      {tab === 'progress' && (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Nhu cầu', l.boqNote || '—'],
              ['Khu vực', `${l.province ? `${l.province}, ` : ''}${REGION_LABEL[l.region]}`],
              ['Nhóm khách hàng', segName(l.segment)],
              ['Kênh nguồn', SOURCE_LABEL[l.source]],
            ].map(([k, v]) => <div key={k}><dt className="text-xs text-[rgb(var(--muted))]">{k}</dt><dd className="mt-0.5 break-words">{v}</dd></div>)}
          </dl>
          {(l.attachments?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {l.attachments!.map((a) => <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-[rgb(var(--raised))] px-2 py-1 text-xs text-[rgb(var(--secondary-fg))]"><Paperclip className="h-3 w-3" aria-hidden />{a.name}</a>)}
            </div>
          )}
          <ActivityList leadId={l.id} customerId={l.customerId} />
          <ReservedGoodsPanel kind="LEAD" refId={l.id} />
        </div>
      )}
    </Drawer>
  );
}

/** Pipeline bán hàng theo giai đoạn: số cơ hội + tổng giá trị mỗi cột; bấm thẻ mở hồ sơ dự án */
export function PipelineBoard({ list, onOpen }: { list: Lead[]; onOpen: (id: string) => void }) {
  const { userName, now } = useApp();
  const total = list.reduce((s, l) => s + boqTotal(l), 0);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {STAGES.map((s) => {
        const items = list.filter((l) => l.status === s);
        const sum = items.reduce((t, l) => t + boqTotal(l), 0);
        return (
          <section key={s} className="flex min-w-0 flex-col rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
            <header className="border-b border-[rgb(var(--line))] px-3 py-2.5">
              <div className="flex items-center gap-2"><Chip tone={LEAD_STATUS[s].tone}>{LEAD_STATUS[s].label}</Chip><span className="ml-auto text-xs tabular-nums text-[rgb(var(--muted))]">{items.length} cơ hội</span></div>
              <p className="mt-1.5 text-lg font-semibold tabular-nums">{compact(sum)}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><div className="h-full rounded-full bg-[rgb(var(--secondary))]" style={{ width: `${total ? Math.round((sum / total) * 100) : 0}%` }} /></div>
            </header>
            <div className="max-h-[520px] space-y-2 overflow-y-auto p-2">
              {items.length ? items.map((l) => {
                const late = isQuoteOverdue(l, now);
                return (
                  <button key={l.id} type="button" onClick={() => onOpen(l.id)} className="block w-full rounded border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-2.5 text-left transition-colors hover:border-[rgb(var(--secondary)/0.6)]">
                    <p className="truncate text-sm font-medium">{l.company}</p>
                    <p className="truncate text-xs text-[rgb(var(--muted))]">{l.code} · {userName(l.assignee) || 'Chưa giao'}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2"><span className="text-sm font-semibold tabular-nums">{compact(boqTotal(l))}</span>{late && <Chip tone="red">Trễ báo giá</Chip>}</div>
                  </button>
                );
              }) : <p className="px-2 py-6 text-center text-xs text-[rgb(var(--muted))]">Không có cơ hội</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Gantt dự án: thanh từ ngày nhận → ngày chốt (hoặc ngày dự kiến theo chu kỳ chốt lịch sử), mốc gửi báo giá, hạn báo giá, vạch hôm nay */
export function ProjectGantt({ list, onOpen }: { list: Lead[]; onOpen: (id: string) => void }) {
  const { quotes, userName, now } = useApp();
  const t = now ?? Date.now();
  const DAY = 864e5;
  const wonDays = list.filter((l) => l.status === 'WON' && l.wonAt).map((l) => (isoMs(l.wonAt) - leadAt(l)) / DAY).filter((x) => x > 0);
  const cycle = Number.isFinite(median(wonDays)) ? Math.max(14, median(wonDays)) : 45;
  const rows = list.slice(0, 60).map((l) => {
    const start = leadAt(l);
    const qs = quotes.filter((q) => q.leadId === l.id).map((q) => q.createdAt ?? isoMs(q.date)).filter(Number.isFinite);
    const end = l.status === 'WON' && l.wonAt ? isoMs(l.wonAt) : l.status === 'LOST' ? Math.max(start + 3 * DAY, ...qs, start) : Math.max(start + cycle * DAY, l.quoteDeadline ?? 0, t + 3 * DAY);
    return { l, start, end, qs, planned: l.status !== 'WON' && l.status !== 'LOST' };
  });
  if (!rows.length) return <EmptyState text={<>Không có dự án để vẽ Gantt</>} hint={<>Bỏ bớt bộ lọc hoặc đổi khoảng thời gian.</>} art="calendar" />;
  const min = Math.min(...rows.map((r) => r.start), t - 7 * DAY);
  const max = Math.max(...rows.map((r) => r.end), t + 14 * DAY);
  const d0 = new Date(min); d0.setDate(1); d0.setHours(0, 0, 0, 0);
  const from = d0.getTime();
  const days = Math.ceil((max - from) / DAY) + 3;
  const PX = days > 240 ? 4 : days > 120 ? 6 : 10;
  const width = days * PX;
  const x = (ms: number) => ((ms - from) / DAY) * PX;
  const months: { label: string; left: number }[] = [];
  for (let m = new Date(from); m.getTime() < from + days * DAY; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) months.push({ label: `T${m.getMonth() + 1}/${m.getFullYear()}`, left: x(m.getTime()) });
  const bar = (l: Lead) => (l.status === 'WON' ? 'bg-[rgb(var(--success))]' : l.status === 'LOST' ? 'bg-[rgb(var(--danger)/0.7)]' : l.status === 'QUOTED' ? 'g-brand' : l.status === 'ACCEPTED' ? 'bg-[rgb(var(--secondary))]' : 'bg-[rgb(var(--faint))]');
  return (
    <section className="rounded-md border border-[rgb(var(--ink)/0.06)] bg-[rgb(var(--surface)/0.8)]">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[rgb(var(--ink)/0.06)] px-5 py-4">
        <h2 className="font-display mr-auto text-[15px] font-bold">Tiến độ dự án (Gantt) · {rows.length}{list.length > rows.length ? ` / ${list.length}` : ''}</h2>
        {[['bg-[rgb(var(--secondary))]', 'Đang bóc BOQ / khảo sát'], ['g-brand', 'Đã gửi báo giá'], ['bg-[rgb(var(--success))]', 'Chốt đơn'], ['bg-[rgb(var(--danger)/0.7)]', 'Trượt']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--muted))]"><i className={cn('h-2.5 w-4 rounded-sm', c)} />{l}</span>)}
        <span className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--muted))]"><i className="h-2.5 w-2.5 rotate-45 bg-[rgb(var(--warn))]" />Gửi báo giá</span>
        <span className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--muted))]"><i className="h-2.5 w-4 rounded-sm border border-dashed border-[rgb(var(--muted))]" />Dự kiến (chu kỳ {Math.round(cycle)} ngày)</span>
      </header>
      <div className="flex">
        <div className="w-[220px] shrink-0 border-r border-[rgb(var(--ink)/0.06)]">
          <div className="h-9 border-b border-[rgb(var(--ink)/0.06)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--muted)/0.8)]">Dự án</div>
          {rows.map(({ l }) => (
            <button key={l.id} className="flex h-12 w-full flex-col justify-center border-b border-[rgb(var(--ink)/0.04)] px-4 text-left hover:bg-[rgb(var(--secondary)/0.1)]" onClick={() => onOpen(l.id)}>
              <span className="truncate text-sm font-medium">{l.company}</span>
              <span className="truncate text-[11px] text-[rgb(var(--muted))]">{l.code} · {userName(l.assignee) || 'Chưa giao'}</span>
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width, minWidth: '100%' }}>
            <div className="relative h-9 border-b border-[rgb(var(--ink)/0.06)]">
              {months.map((m) => <span key={m.label} className="absolute top-0 h-full border-l border-[rgb(var(--ink)/0.06)] pl-2 pt-2.5 text-[11px] font-semibold text-[rgb(var(--muted))]" style={{ left: m.left }}>{m.label}</span>)}
            </div>
            {months.map((m) => <span key={`g${m.label}`} className="pointer-events-none absolute bottom-0 top-9 border-l border-[rgb(var(--ink)/0.04)]" style={{ left: m.left }} aria-hidden />)}
            <span className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-[rgb(var(--secondary-fg))]" style={{ left: x(t) }} aria-hidden><span className="absolute -top-0 left-1 whitespace-nowrap rounded-sm bg-[rgb(var(--secondary))] px-1 text-[10px] font-semibold text-white">Hôm nay</span></span>
            {rows.map(({ l, start, end, qs, planned }) => {
              const realEnd = planned ? Math.min(end, t) : end;
              return (
                <div key={l.id} className="relative h-12 border-b border-[rgb(var(--ink)/0.04)]">
                  <button className={cn('absolute top-3.5 h-5 rounded-sm opacity-90 hover:opacity-100', bar(l))} style={{ left: x(start), width: Math.max(6, x(realEnd) - x(start)) }} onClick={() => onOpen(l.id)}
                    title={`${l.company}: nhận ${fmtDate(iso(new Date(start)))}${l.wonAt ? `, chốt ${fmtDate(l.wonAt)}` : planned ? `, dự kiến chốt ${fmtDate(iso(new Date(end)))}` : ''} · ${compact(boqTotal(l))}`}
                    aria-label={`${l.company}, ${LEAD_STATUS[l.status].label}`}>
                    <span className="block truncate px-1.5 text-[10px] font-semibold leading-5 text-[rgb(var(--on-accent))] mix-blend-normal">{x(realEnd) - x(start) > 60 ? compact(boqTotal(l)) : ''}</span>
                  </button>
                  {planned && end > realEnd && <span className="absolute top-3.5 h-5 rounded-sm border border-dashed border-[rgb(var(--muted)/0.6)]" style={{ left: x(realEnd), width: Math.max(4, x(end) - x(realEnd)) }} aria-hidden />}
                  {qs.map((q, i) => <i key={i} className="absolute top-[22px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-[rgb(var(--bg))] bg-[rgb(var(--warn))]" style={{ left: x(q) }} title={`Gửi báo giá ${new Date(q).toLocaleDateString('vi-VN')}`} />)}
                  {l.status === 'ACCEPTED' && l.quoteDeadline && <i className={cn('absolute top-2.5 h-7 w-0.5 rounded', l.quoteDeadline < t ? 'bg-[rgb(var(--danger))]' : 'bg-[rgb(var(--accent-fg))]')} style={{ left: x(l.quoteDeadline) }} title={`Hạn báo giá ${new Date(l.quoteDeadline).toLocaleString('vi-VN')}`} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProjectsPage() {
  const { leads: allLeads, myLeads: leads, setLeads, notify, canDo, userName, dept, openWin, now, quotes, setQuotes, users, openLeadForm, reopenLead, reservations, openComposer, genDocs } = useApp();
  const inR = useInRange();
  const [stage, setStage] = useSticky<'ALL' | Stage>('ProjectsPage.stage', 'ALL');
  const [q, setQ] = useSticky('ProjectsPage.q', '');
  const [dp, setDp] = useState('ALL');
  const [owner, setOwner] = useState('ALL');
  const [adv, setAdv] = useState({ min: 0, max: 0, boq: 'ALL', pp: false });
  const [advOpen, setAdvOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [ppLead, setPpLead] = useState<Lead | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [boqLead, setBoqLead] = useState<Lead | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [view, setView] = useSticky<'table' | 'board' | 'gantt'>('ProjectsPage.view', 'table');
  const canEdit = canDo('project.update');
  const advCount = [adv.min > 0, adv.max > 0, adv.boq !== 'ALL', adv.pp].filter(Boolean).length;

  const isOpp = (l: Lead) => (STAGES as LeadStatus[]).includes(l.status);
  const opp = leads.filter((l) => {
    const t = q.trim().toLowerCase();
    const v = boqTotal(l);
    return isOpp(l)
      && (!t || [l.company, l.code, l.taxCode ?? '', l.boqNote, l.getflySync?.orderCode ?? ''].some((x) => x.toLowerCase().includes(t)))
      && (dp === 'ALL' || l.dept === dp) && (owner === 'ALL' || l.assignee === owner) && inR(leadDate(l))
      && (!adv.min || v >= adv.min) && (!adv.max || v <= adv.max) && (adv.boq === 'ALL' || (l.boqStatus ?? 'NOT_STARTED') === adv.boq) && (!adv.pp || !!l.priceProtection);
  });
  const list = (stage === 'ALL' ? opp : opp.filter((l) => l.status === stage)).sort((a, b) => Number(isQuoteOverdue(b, now)) - Number(isQuoteOverdue(a, now)) || a.receivedDaysAgo - b.receivedDaysAgo);
  const srt = useSort('ProjectsPage', list, { 1: (l) => l.company, 3: (l) => l.boqValue, 4: (l) => l.quoteDeadline });
  const paged = usePaged(srt.rows, 10);
  const sel = useSelection(list.map((l) => l.id));
  const overdue = opp.filter((l) => isQuoteOverdue(l, now));
  const ppPending = opp.filter((l) => l.priceProtection?.status === 'REQUESTED').length;

  // ---- KPI ----
  const owners = users.filter((u) => u.active && leads.some((l) => l.assignee === u.id && isOpp(l)));

  const askDelete = (l: Lead) => setConfirm({
    title: 'Xóa dự án',
    message: <>Xóa dự án <b>{l.company}</b>: {l.boqNote}? Báo giá liên quan cũng bị xóa.</>,
    blocked: l.status === 'WON' ? 'Dự án đã chốt đơn, gắn khách hàng và đơn Getfly. Không thể xóa.' : reservations.some((r) => r.kind === 'LEAD' && r.refId === l.id && (r.status === 'HELD' || r.status === 'PENDING_RELEASE')) ? 'Dự án còn hàng giữ chỗ trong kho. Giải phóng hoặc chuyển giữ chỗ trước khi xóa.' : undefined,
    onConfirm: () => { const qs = quotes.filter((x) => x.leadId === l.id); setQuotes((p) => p.filter((x) => x.leadId !== l.id)); removeWithUndo(setLeads, l, notify, `Đã xóa dự án ${l.code}`, () => setQuotes((p) => [...p, ...qs.filter((x) => !p.some((y) => y.id === x.id))])); },
  });
  const menuFor = (l: Lead): MenuItem[] => [
    { label: 'Xem chi tiết', icon: Eye, onClick: () => setViewId(l.id) },
    ...(l.status === 'WON' ? [{ label: 'Hợp đồng', icon: FileText, onClick: () => { const d = genDocs.find((x) => x.leadId === l.id); openComposer(d ? { docId: d.id } : { leadId: l.id, quoteId: l.wonQuoteId, mode: 'CONTRACT' }); }, disabled: !canEdit }] : []),
    { label: l.boqItems?.length ? 'Sửa dòng BOQ' : 'Bóc tách BOQ', icon: FileSpreadsheet, onClick: () => setBoqLead(l), disabled: !canEdit || l.status === 'WON' || l.status === 'LOST' },
    ...(l.status === 'ACCEPTED' ? [{ label: 'Tạo báo giá', icon: FileText, onClick: () => openComposer({ leadId: l.id, mode: 'QUOTE' }), disabled: !canEdit }] : []),
    ...(l.status === 'QUOTED' ? [
      { label: 'Báo giá điều chỉnh', icon: Send, onClick: () => openComposer({ leadId: l.id, mode: 'QUOTE' }), disabled: !canEdit },
      { label: 'Chốt đơn', icon: CheckCircle2, onClick: () => openWin(l.id), disabled: !canEdit },
      { label: 'Trượt', icon: XCircle, onClick: () => setLostLead(l), disabled: !canEdit },
    ] : []),
    ...(!l.priceProtection && ['ACCEPTED', 'QUOTED'].includes(l.status) ? [{ label: 'Đề xuất bảo vệ giá 3M', icon: BadgePercent, onClick: () => setPpLead(l), disabled: !canDo('price.request') }] : []),
    ...(l.status === 'LOST' ? [{ label: 'Mở lại', icon: RefreshCw, onClick: () => reopenLead(l.id), disabled: !canEdit }] : []),
    { label: 'Xóa dự án', icon: Trash2, onClick: () => askDelete(l), danger: true, disabled: !canDo('lead.create') },
  ];
  const exportRows = (rows: Lead[]) => downloadCsv('du_an_boq.csv', [
    ['ma', 'khach_hang', 'du_an', 'phong_ban', 'phu_trach', 'gia_tri', 'nguon_gia_tri', 'trang_thai', 'bao_gia_gan_nhat'],
    ...rows.map((l) => [l.code, l.company, l.boqNote, dept(l.dept)?.short ?? '', userName(l.assignee), boqTotal(l), boqIsEstimate(l) ? 'Ước tính' : 'BOQ', LEAD_STATUS[l.status].label, lastQuoteOf(l.id, quotes)?.code ?? '']),
  ]);
  const quoteCell = (l: Lead) => {
    const lq = lastQuoteOf(l.id, quotes);
    return lq ? <span className="flex items-center gap-1.5 text-xs text-[rgb(var(--fg))]"><Send className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden />Đã gửi {fmtDate(lq.date).slice(0, 5)}<span className="text-[rgb(var(--muted))]">(lần {lq.version})</span></span> : <span className="flex items-center gap-1.5 text-xs text-[rgb(var(--danger-fg))]"><XCircle className="h-3.5 w-3.5" aria-hidden />Chưa gửi</span>;
  };

  return (
    <div className="space-y-4">
      <FilterBar
        q={q} onQ={setQ} placeholder="Tìm dự án, khách hàng, mã dự án, mã đơn Getfly..."
        dept={dp} onDept={setDp} status={stage} onStatus={(v) => setStage(v as 'ALL' | Stage)}
        statusOptions={STAGES.map((s) => ({ value: s, label: stageLabel(s) }))}
        onAdvanced={() => setAdvOpen(true)} advancedCount={advCount} extraActive={owner !== 'ALL' ? 1 : 0}
        actions={<><ViewSwitch value={view} onChange={setView} options={['table', 'board', 'gantt']} /></>}
      >
        <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Phụ trách">
          <option value="ALL">Tất cả phụ trách</option>
          {owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </FilterBar>

      {(overdue.length > 0 || ppPending > 0) && (
        <div className="flex flex-col gap-2 rounded-md border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.1)] px-4 py-3 sm:flex-row sm:items-center">
          <AlertTriangle className="hidden h-5 w-5 shrink-0 text-[rgb(var(--accent-fg))] sm:block" aria-hidden />
          <p className="flex-1 text-sm text-[rgb(var(--accent-fg))]">
            {overdue.length > 0 && <span className="text-[rgb(var(--danger-fg))]">{overdue.length} dự án quá hạn nộp báo giá 24 giờ, đã leo thang tới Trưởng phòng. </span>}
            {ppPending > 0 && <span>{ppPending} đề xuất bảo vệ giá đang chờ 3M phản hồi.</span>}
          </p>
          <div className="flex gap-2">
            <button className={cn(btnPrimary, btnSm, 'max-lg:hidden')} disabled={!canEdit} onClick={() => openLeadForm(true)}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo dự án mới</button>
          </div>
        </div>
      )}

      <BulkBar count={sel.ids.length} onClear={sel.clear}>
        <button className={cn(btnGhost, btnSm)} onClick={() => exportRows(allLeads.filter((l) => sel.has(l.id)))}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>
        <select className={cn(inputBase, 'w-auto py-1 text-xs')} disabled={!canDo('lead.assign') && !canEdit} value="" onChange={(e) => { const u = users.find((x) => x.id === e.target.value); if (!u) return; setLeads((p) => p.map((l) => (sel.has(l.id) ? { ...l, assignee: u.id, dept: u.dept ?? l.dept } : l))); notify(`Đã giao ${sel.ids.length} dự án cho ${u.name}`, 'teal'); sel.clear(); }} aria-label="Giao phụ trách">
          <option value="">Giao phụ trách...</option>
          {users.filter((u) => u.active && (u.role === 'SALES_REP' || u.role === 'DEPT_HEAD')).map((u) => <option key={u.id} value={u.id}>{u.name} ({dept(u.dept)?.short})</option>)}
        </select>
      </BulkBar>

      {view === 'board' ? <PipelineBoard list={opp} onOpen={setViewId} /> : view === 'gantt' ? <ProjectGantt list={list} onOpen={setViewId} /> : (
      <Panel
        title={`Danh sách dự án & BOQ (${list.length})`}
        action={
          <div className="flex gap-2">
            <RowMenu text="Thao tác" icon={FileSpreadsheet} items={[{ label: 'Xuất CSV', icon: Download, onClick: () => exportRows(list) }]} />
            {!(overdue.length > 0 || ppPending > 0) && <button className={cn(btnPrimary, btnSm, 'max-lg:hidden')} disabled={!canEdit} onClick={() => openLeadForm(true)}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo dự án mới</button>}
          </div>
        }
      >
        <div className="space-y-2 md:hidden">
          {paged.slice.map((l) => {
            const st = projectStatus(l, now, quotes);
            return (
              <MobileRow key={l.id} avatar={l.company} title={l.company} sub={`${l.code}, ${REGION_LABEL[l.region]}`} badge={quoteCell(l)} value={compact(projectValue(l, quotes).value)} status={<Chip tone={st.tone}>{st.label}</Chip>} onClick={() => setViewId(l.id)} />
            );
          })}
        </div>
        <div className="hidden md:block">
          <Table stt={Math.max(0, paged.from - 1)} head={[<input key="all" type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={sel.allOn} onChange={sel.toggleAll} aria-label="Chọn tất cả" />, 'Khách hàng / Dự án', 'Phòng ban / Phụ trách', 'Giá trị dự án', 'Hạn báo giá', 'Báo giá', 'Trạng thái', <span key="a" className="block text-right">Thao tác</span>]} minW={1000} sort={srt.th}>
            {paged.slice.map((l) => {
              const late = isQuoteOverdue(l, now);
              const st = projectStatus(l, now, quotes);
              return (
                <tr key={l.id} className={cn(rowCls, 'cursor-pointer', late && 'bg-[rgb(var(--danger)/0.05)]', sel.has(l.id) && 'bg-[rgb(var(--accent)/0.05)]')} onClick={() => setViewId(l.id)}>
                  <td className={cn(tdFirst, 'w-10', late && 'border-l-2 border-l-[rgb(var(--danger))] motion-safe:animate-[blinkBorder_1.2s_ease-in-out_infinite]')} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={sel.has(l.id)} onChange={() => sel.toggle(l.id)} aria-label={`Chọn ${l.company}`} /></td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-2">
                      <Avatar name={l.company} size={28} />
                      <div className="min-w-0">
                        <p className="max-w-[190px] truncate font-medium text-[rgb(var(--fg))]" title={l.boqNote}>{l.company}</p>
                        <p className="max-w-[190px] truncate text-xs text-[rgb(var(--muted))]"><span className="font-mono text-[rgb(var(--accent-fg))]">{l.code}</span> · {l.boqNote || (l.province ?? REGION_LABEL[l.region])}</p>
                      </div>
                    </div>
                  </td>
                  <td className={tdCls}><p>{dept(l.dept)?.short}</p><p className="text-xs text-[rgb(var(--muted))]">{userName(l.assignee)}</p></td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{(() => { const pv = projectValue(l, quotes); return <><p className="text-[rgb(var(--fg))]">{compact(pv.value)}</p><p className={cn('text-[11px]', pv.source === 'Ước tính MKT' ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{pv.source}</p></>; })()}</td>
                  <td className={tdCls}>{l.status === 'ACCEPTED' ? <QuoteTimer deadline={l.quoteDeadline} now={now} /> : <span className="text-xs text-[rgb(var(--muted))]">{l.quoteDeadline ? fmtDate(iso(new Date(l.quoteDeadline))) : '—'}</span>}</td>
                  <td className={tdCls}>{quoteCell(l)}</td>
                  <td className={tdCls}><Chip tone={st.tone}>{st.label}</Chip></td>
                  <td className={cn(tdLast, 'whitespace-nowrap text-right')} onClick={(e) => e.stopPropagation()}>
                    <span className="mr-1 inline-block align-middle"><CommentButton entity="lead" entityId={l.id} title={`${l.code} · ${l.company}`} module="projects" /></span>
                    <button className={cn(btnGhost, 'mr-1 p-1.5')} disabled={!canEdit} onClick={() => openLeadForm(false, l.id)} aria-label={`Sửa ${l.company}`}><Pencil className="h-4 w-4" /></button>
                    <RowMenu items={menuFor(l)} />
                  </td>
                </tr>
              );
            })}
          </Table>
        </div>
        {!list.length && (
          <div className="py-8 text-center text-sm text-[rgb(var(--muted))]">
            <p>Chưa có dự án khớp bộ lọc. Lead được Sales tiếp nhận hoặc dự án Sales tự tạo sẽ hiện ở đây.</p>
          </div>
        )}
        <Pagination paged={paged} unit="dự án" />
      </Panel>
      )}

      <Fab label="Tạo dự án mới" onClick={() => openLeadForm(true)} disabled={!canEdit} />
      {viewId && <ProjectDrawer id={viewId} onClose={() => setViewId(null)} onBoq={setBoqLead} onLost={setLostLead} onPP={setPpLead} onEdit={(l) => openLeadForm(false, l.id)} />}
      {ppLead && <PriceProtectionModal lead={ppLead} onClose={() => setPpLead(null)} />}
      {boqLead && <BoqEditorModal lead={allLeads.find((x) => x.id === boqLead.id) ?? boqLead} onClose={() => setBoqLead(null)} />}
      {lostLead && <LostModal lead={lostLead} onClose={() => setLostLead(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
      {advOpen && (
        <Modal title="Bộ lọc nâng cao" onClose={() => setAdvOpen(false)} footer={<><button className={btnGhost} onClick={() => setAdv({ min: 0, max: 0, boq: 'ALL', pp: false })}>Xóa bộ lọc</button><button className={btnPrimary} onClick={() => setAdvOpen(false)}>Áp dụng</button></>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Giá trị từ"><MoneyInput value={adv.min} onChange={(n) => setAdv({ ...adv, min: n })} /></Field>
            <Field label="Giá trị đến"><MoneyInput value={adv.max} onChange={(n) => setAdv({ ...adv, max: n })} /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={adv.pp} onChange={(e) => setAdv({ ...adv, pp: e.target.checked })} />Chỉ dự án có đề xuất bảo vệ giá</label>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---- Lịch sử báo giá trong Khách hàng 360 ----
export function QuoteHistory({ customer: c }: { customer: Customer }) {
  const { quotes, setQuotes, leads, canDo, notify, openComposer } = useApp();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const list = quotesOfCustomer(c, quotes, leads);
  const accepted = list.filter((q) => q.status === 'ACCEPTED');
  const canEdit = canDo('project.update');
  if (!list.length) return <p className="rounded-md border border-dashed border-[rgb(var(--line))] p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có báo giá nào cho khách hàng này.</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="rounded bg-[rgb(var(--raised))] p-3"><p className="text-xs text-[rgb(var(--muted))]">Số báo giá</p><p className="mt-1 text-lg font-semibold tabular-nums">{list.length}</p></div>
        <div className="rounded bg-[rgb(var(--raised))] p-3"><p className="text-xs text-[rgb(var(--muted))]">Được chấp nhận</p><p className="mt-1 text-lg font-semibold tabular-nums text-[rgb(var(--success-fg))]">{accepted.length}</p></div>
        <div className="rounded bg-[rgb(var(--raised))] p-3"><p className="text-xs text-[rgb(var(--muted))]">Giá trị chấp nhận</p><p className="mt-1 text-lg font-semibold tabular-nums">{compact(accepted.reduce((s, q) => s + q.amount, 0))}</p></div>
      </div>
      <ul className="divide-y divide-[rgb(var(--line))] rounded border border-[rgb(var(--line))]">
        {list.map((q) => {
          const l = leads.find((x) => x.id === q.leadId);
          return (
            <li key={q.id} className="flex flex-wrap items-start gap-3 px-3 py-3">
              <History className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm"><b>{q.code}</b> <span className="text-[rgb(var(--muted))]">lần {q.version}, {fmtDate(q.date)}</span></p>
                <p className="truncate text-xs text-[rgb(var(--muted))]">{l?.boqNote ?? 'Dự án đã xóa'}</p>
                <p className="text-xs text-[rgb(var(--muted))]">Hiệu lực đến {fmtDate(q.validUntil)}{q.discountPct ? `, chiết khấu ${q.discountPct}%` : ''}{q.note ? `. ${q.note}` : ''}</p>
                {q.file && <a href={q.file.url} target="_blank" rel="noreferrer" className="text-xs text-[rgb(var(--secondary-fg))] hover:underline">{q.file.name}</a>}
              </div>
              <div className="text-right">
                <p className="tabular-nums">{vnd(q.amount)}</p>
                <Chip tone={QUOTE_STATUS[q.status].tone}>{QUOTE_STATUS[q.status].label}</Chip>
              </div>
              <div className="flex gap-1">
                <button className={cn(btnGhost, 'p-1.5')} onClick={() => openComposer({ leadId: l?.id, quoteId: q.id, mode: 'QUOTE' })} aria-label={`Xem ${q.code}`}><Eye className="h-3.5 w-3.5" /></button>
                <button className={cn(btnGhost, 'p-1.5 hover:text-[rgb(var(--danger-fg))]')} disabled={!canEdit} onClick={() => setConfirm({ title: 'Xóa báo giá', message: <>Xóa báo giá <b>{q.code}</b>?</>, blocked: q.status === 'ACCEPTED' ? 'Báo giá đã được khách chấp nhận và gắn với đơn hàng, không thể xóa.' : undefined, onConfirm: () => { setQuotes((p) => p.filter((x) => x.id !== q.id)); notify(`Đã xóa ${q.code}`, 'orange'); } })} aria-label={`Xóa ${q.code}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </li>
          );
        })}
      </ul>
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

