'use client';

import { useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { BulkBar, Fab, MobileRow, Pagination, RowMenu, usePaged, useSelection } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { FilterBar, useInRange } from '../../components/filters';
import { ImportModal } from '../../components/import-csv';
import { Chip, EmptyState, Panel, Table, useSort, useSticky } from '../../components/ui';
import { scoreLead } from '../../lib/business';
import { boqIsEstimate, boqTotal, btnBase, btnGhost, btnPrimary, btnSm, compact, digits, findByTax, inputBase, inputCls, LEAD_STATUS, leadDate, LOST_REASON, MQL_THRESHOLD, nextCode, REGION_LABEL, rowCls, SEGMENT_LABEL, segName, SOURCE_LABEL, tdCls, tdFirst, tdLast, useApp } from '../../lib/core';
import { downloadCsv, matchEnum } from '../../lib/csv';
import type { ConfirmState, ImportSpec, Lead, LeadForm, LeadStatus, Source } from '../../lib/types';
import { cn } from '../../lib/utils';
import { formToLead, LeadFormModal, validateLead } from './lead-form';

// =====================================================================
//  DATA MKT — danh sách lead, thêm mới, nhập từ CSV
// =====================================================================

export function DataMktPage() {
  const { leads: allLeads, myLeads: leads, setLeads, customers, notify, presetQuery, canDo, userName, dept, openWin } = useApp();
  const [q, setQ] = useSticky('DataMktPage.q', presetQuery, !!presetQuery);
  const [status, setStatus] = useState<string>('ALL');
  const [src, setSrc] = useState<'ALL' | Source>('ALL');
  const inR = useInRange();
  const [dp, setDp] = useState('ALL');
  const [modal, setModal] = useState<'add' | 'import' | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const canEdit = canDo('lead.create');

  const list = leads.filter((l) => {
    const t = q.trim().toLowerCase();
    const hit = !t || [l.company, l.code, l.taxCode ?? '', l.contact, l.phone].some((v) => v.toLowerCase().includes(t));
    return hit && (status === 'ALL' || l.status === status) && (src === 'ALL' || l.source === src) && (dp === 'ALL' || l.dept === dp) && inR(leadDate(l));
  });

  const srt = useSort('DataMktPage', list, { 1: (l) => l.code, 2: (l) => l.company, 5: (l) => l.boqValue, 6: (l) => l.score ?? scoreLead(l, customers), 7: (l) => l.status });
  const paged = usePaged(srt.rows, 12);
  const sel = useSelection(list.map((l) => l.id));
  const { routeLeads, routableDepts } = useApp();

  const importSpec: ImportSpec<LeadForm> = {
    title: 'Nhập lead từ file CSV',
    templateName: 'mau_nhap_lead.csv',
    headers: ['ten_cong_ty', 'nguoi_lien_he', 'so_dien_thoai', 'mst', 'email', 'phan_khuc', 'khu_vuc', 'nguon', 'gia_tri_uoc_tinh', 'nhu_cau'],
    sample: ['Công ty CP Cơ điện ABC', 'Nguyễn Văn A', '0903123456', '0312345678', 'a.nv@abc.vn', 'Tổng thầu / Nhà thầu M&E', 'Miền Nam', 'Google Ads', '1500000000', 'Đầu cáp co nguội 24kV cho trạm biến áp'],
    parseRow: (r) => {
      const segment = r.phan_khuc ? matchEnum(r.phan_khuc, SEGMENT_LABEL) : 'OTHER';
      if (!segment) return { ok: false, error: `Phân khúc "${r.phan_khuc}" không hợp lệ` };
      const source = r.nguon ? matchEnum(r.nguon, SOURCE_LABEL) : 'WEBSITE_FORM';
      if (!source) return { ok: false, error: `Nguồn "${r.nguon}" không hợp lệ` };
      const region = matchEnum(r.khu_vuc || 'Miền Nam', REGION_LABEL) ?? (/b[aắ]c/i.test(r.khu_vuc) ? 'NORTH' : /nam/i.test(r.khu_vuc) ? 'SOUTH' : undefined);
      if (!region) return { ok: false, error: `Khu vực "${r.khu_vuc}" không hợp lệ (Miền Bắc / Miền Nam)` };
      const form: LeadForm = { company: r.ten_cong_ty, contact: r.nguoi_lien_he, phone: r.so_dien_thoai, taxCode: r.mst, email: r.email, segment, source, region, province: '', boqValue: digits(r.gia_tri_uoc_tinh), boqNote: r.nhu_cau, attachments: [] };
      const e = validateLead(form, allLeads);
      const first = Object.values(e)[0];
      return first ? { ok: false, error: first } : { ok: true, item: form };
    },
    onImport: (items) => {
      const seen = new Set<string>();
      const codes = allLeads.map((l) => l.code);
      const created: Lead[] = [];
      for (const f of items) {
        if (f.taxCode && seen.has(f.taxCode)) continue; // trùng MST trong cùng file
        if (f.taxCode) seen.add(f.taxCode);
        const code = nextCode(codes, 'LD-2026-', 4);
        codes.push(code);
        created.push(formToLead(f, code));
      }
      setLeads((p) => [...created, ...p]);
      notify(`Đã nhập ${created.length} lead vào hộp chờ phân bổ`, 'teal');
    },
  };

  const exportCsv = () =>
    downloadCsv('danh_sach_lead.csv', [
      ['ma', 'cong_ty', 'nguoi_lien_he', 'so_dien_thoai', 'mst', 'phan_khuc', 'nguon', 'gia_tri_boq', 'diem', 'trang_thai', 'phong_ban', 'phu_trach'],
      ...list.map((l) => [l.code, l.company, l.contact, l.phone, l.taxCode ?? '', segName(l.segment), SOURCE_LABEL[l.source], boqTotal(l), l.score ?? scoreLead(l, customers), LEAD_STATUS[l.status].label, dept(l.dept)?.short ?? '', userName(l.assignee)]),
    ]);

  return (
    <div className="space-y-5">
      <FilterBar
        q={q} onQ={setQ} placeholder="Tìm MST, tên khách, mã lead, SĐT"
        dept={dp} onDept={setDp} status={status} onStatus={setStatus} extraActive={src !== 'ALL' ? 1 : 0}
        statusOptions={(Object.keys(LEAD_STATUS) as LeadStatus[]).map((s) => ({ value: s, label: LEAD_STATUS[s].label }))}
      >
        <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={src} onChange={(e) => setSrc(e.target.value as 'ALL' | Source)} aria-label="Lọc nguồn">
          <option value="ALL">Mọi nguồn</option>
          {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
        </select>
      </FilterBar>

      <BulkBar count={sel.ids.length} onClear={sel.clear}>
        <select className={cn(inputBase, 'w-auto py-1 text-xs')} disabled={!canDo('lead.route')} value="" onChange={(e) => { if (!e.target.value) return; const ids = allLeads.filter((l) => sel.has(l.id) && ['NEW', 'NURTURE', 'ROUTED'].includes(l.status)).map((l) => l.id); routeLeads(ids, e.target.value); sel.clear(); }} aria-label="Phân về phòng">
          <option value="">Phân về phòng...</option>
          {routableDepts.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
        <button className={cn(btnGhost, btnSm, 'hover:text-[rgb(var(--danger-fg))]')} disabled={!canEdit} onClick={() => {
          const ok = allLeads.filter((l) => sel.has(l.id) && l.status !== 'WON');
          setConfirm({ title: 'Xóa lead đã chọn', message: <>Xóa {ok.length} lead đã chọn? Lead đã chốt đơn được giữ lại.</>, blocked: ok.length ? undefined : 'Các lead đã chọn đều đã chốt đơn.', onConfirm: () => { setLeads((p) => p.filter((l) => !ok.some((x) => x.id === l.id))); sel.clear(); notify(`Đã xóa ${ok.length} lead`, 'orange'); } });
        }}><Trash2 className="h-3.5 w-3.5" aria-hidden />Xóa</button>
      </BulkBar>

      <Panel
        title={`${list.length} lead`}
        action={
          <div className="flex gap-2">
            <RowMenu text="Dữ liệu" icon={FileSpreadsheet} items={[{ label: 'Xuất CSV', icon: Download, onClick: exportCsv }, { label: 'Nhập từ file', icon: Upload, onClick: () => setModal('import'), disabled: !canEdit }]} />
            <button className={cn(btnPrimary, btnSm, 'max-lg:hidden')} disabled={!canEdit} onClick={() => setModal('add')}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm lead</button>
          </div>
        }
      >
        <div className="space-y-2 md:hidden">
          {paged.slice.map((l) => (
            <MobileRow key={l.id} avatar={l.company} title={l.company} sub={`${l.code}, ${l.phone}, ${l.province ?? REGION_LABEL[l.region]}`}
              badge={<Chip tone={(l.score ?? scoreLead(l, customers)) >= 80 ? 'red' : 'orange'}>{l.score ?? scoreLead(l, customers)}</Chip>}
              value={boqTotal(l) ? compact(boqTotal(l)) : '—'} status={<Chip tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Chip>}
              menu={<RowMenu items={[{ label: 'Sửa lead', icon: Pencil, onClick: () => setEditId(l.id), disabled: !canEdit }, ...(l.status === 'QUOTED' ? [{ label: 'Chốt đơn', icon: CheckCircle2, onClick: () => openWin(l.id), disabled: !canDo('project.update') }] : [])]} />} />
          ))}
        </div>
        <div className="hidden md:block">
        <Table stt={Math.max(0, paged.from - 1)} head={[<input key="all" type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={sel.allOn} onChange={sel.toggleAll} aria-label="Chọn tất cả" />, 'Mã lead', 'Công ty / liên hệ', 'MST', 'Nhóm / nguồn', 'Giá trị', 'Điểm', 'Trạng thái', 'Phòng ban / phụ trách', '']} minW={1000} sort={srt.th}>
          {paged.slice.map((l) => {
            const score = l.score ?? scoreLead(l, customers);
            return (
              <tr key={l.id} className={rowCls}>
                <td className={cn(tdFirst, 'w-10')}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={sel.has(l.id)} onChange={() => sel.toggle(l.id)} aria-label={`Chọn ${l.code}`} /></td>
                <td className={tdCls}><p className="font-medium text-[rgb(var(--fg))]">{l.code}</p><p className="text-xs text-[rgb(var(--muted))]">{l.receivedDaysAgo === 0 ? 'Hôm nay' : `${l.receivedDaysAgo} ngày trước`}</p></td>
                <td className={cn(tdCls, 'max-w-[230px]')}><p className="truncate text-[rgb(var(--fg))]" title={l.company}>{l.company}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{l.contact}, {l.phone}</p></td>
                <td className={cn(tdCls, 'tabular-nums')}>{l.taxCode ?? <span className="text-[rgb(var(--muted))]">Chưa có</span>}{findByTax(customers, l.taxCode) && <p><Chip tone="teal">Khách hiện hữu</Chip></p>}</td>
                <td className={tdCls}><p>{segName(l.segment)}</p><p className="text-xs text-[rgb(var(--muted))]">{SOURCE_LABEL[l.source]}, {REGION_LABEL[l.region]}</p></td>
                <td className={cn(tdCls, 'tabular-nums')}>{boqTotal(l) ? compact(boqTotal(l)) : '—'}<p className="text-xs text-[rgb(var(--muted))]">{boqIsEstimate(l) ? 'Ước tính' : 'Theo BOQ'}</p>{l.attachments?.length ? <p className="flex items-center gap-1 text-xs text-[rgb(var(--secondary-fg))]"><Paperclip className="h-3 w-3" aria-hidden />{l.attachments.length} file</p> : null}</td>
                <td className={tdCls}><Chip tone={score >= 80 ? 'red' : score >= MQL_THRESHOLD ? 'orange' : 'muted'}>{score}</Chip></td>
                <td className={tdCls}>
                  <Chip tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Chip>
                  {l.status === 'LOST' && l.lostReason && <p className="mt-1 text-xs text-[rgb(var(--danger-fg))]">{LOST_REASON[l.lostReason]}</p>}
                  {l.status === 'QUOTED' && <button disabled={!canDo('project.update')} className={cn(btnBase, btnSm, 'mt-1.5 flex bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success-fg))] hover:bg-[rgb(var(--success)/0.25)]')} onClick={() => openWin(l.id)}>Chốt đơn</button>}
                  {l.getflySync?.status === 'SYNCED' && <p className="mt-1 text-xs text-[rgb(var(--success-fg))]">Getfly {l.getflySync.orderCode}</p>}
                </td>
                <td className={tdCls}>{l.dept ? <><p>{dept(l.dept)?.short}</p><p className="text-xs text-[rgb(var(--muted))]">{userName(l.assignee)}</p></> : <span className="text-[rgb(var(--muted))]">Chưa phân bổ</span>}</td>
                <td className={cn(tdLast, 'whitespace-nowrap text-right')}>
                  <button className={cn(btnGhost, 'mr-1 p-1.5')} disabled={!canEdit} onClick={() => setEditId(l.id)} aria-label={`Sửa ${l.code}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button className={cn(btnGhost, 'p-1.5 hover:text-[rgb(var(--danger-fg))]')} disabled={!canEdit} onClick={() => setConfirm({
                    title: 'Xóa lead',
                    message: <>Xóa lead <b>{l.code}</b> {l.company}?</>,
                    blocked: l.status === 'WON' ? 'Lead đã chốt đơn và gắn khách hàng / đơn Getfly, không thể xóa.' : undefined,
                    onConfirm: () => removeWithUndo(setLeads, l, notify, `Đã xóa lead ${l.code}`),
                  })} aria-label={`Xóa ${l.code}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            );
          })}
        </Table>
        </div>
        {!list.length && <EmptyState text={<>Không có lead khớp bộ lọc.</>} art="search" />}
        <Pagination paged={paged} unit="lead" />
      </Panel>
      {canEdit && <Fab label="Thêm lead" onClick={() => setModal('add')} />}

      {modal === 'add' && <LeadFormModal onClose={() => setModal(null)} />}
      {editId && <LeadFormModal id={editId} onClose={() => setEditId(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
      {modal === 'import' && <ImportModal spec={importSpec} onClose={() => setModal(null)} />}
    </div>
  );
}

