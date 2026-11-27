'use client';

// Bộ vẽ trang — trường dữ liệu: đọc định nghĩa, hiển thị giá trị, ô nhập, và bộ vẽ bố cục trường theo nhóm (Cấp 2)
// (V55.2: chuyển từ modules/messages/messenger.tsx; DynamicFieldRenderer dùng chung cho 3A xem trước và màn hình doanh nghiệp)
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Plus, X } from 'lucide-react';
import { Field, MoneyInput } from '../../components/ui';
import { cfDefsFor, cfEmpty, cfSample, cfWithLayout, fmtDate, fmtDT, inputCls, L_DETAIL_PAGE, L_FORM_PAGE, type LFieldAvail, lEntityAvail, lEntitySections, lFieldItem, useApp } from '../../lib/core';
import { cfCompute, checklistDone, mediaOf, rangeParse, rangeText, signatureOf } from '../../lib/industry';
import type { CfDef, CfEntity, CfVal, LFieldItem, LSection, User } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useMinW } from './engine';
import { useTenantLayout } from './tenant';
import { CF_RICH, type CfCtx, CfRichView, ChecklistInput, FormulaView, MediaInput, RangeInput, ResourcePicker, SignatureInput } from './vertical';

const CF_MULTI: CfDef['type'][] = ['datetime_range', 'checklist', 'media_gallery', 'signature'];

/** v56 Tên hiển thị của mã người dùng / mã tài nguyên (trường Người dùng, Chọn tài nguyên) */
export function useNameOf() {
  const { users, resources } = useApp();
  return useCallback((id: string) => users.find((u) => u.id === id)?.name ?? resources.find((r) => r.id === id)?.name ?? '', [users, resources]);
}

/** Trường tùy chỉnh của doanh nghiệp đang mở (gồm cả trường đã ngừng dùng để xem lại giá trị cũ) */
export function useSaleCf() {
  const { platform, org } = useApp();
  return useMemo(() => { const all = cfDefsFor(platform.customFields, org); return { all, head: all.filter((d) => d.scope === 'HEAD'), line: all.filter((d) => d.scope === 'LINE') }; }, [platform.customFields, org]);
}

/**
 * v55.2 Bố cục trường của form lên đơn đang áp dụng cho doanh nghiệp (trang "Form lên đơn bán"), các nhóm trường đã tính sẵn,
 * và định nghĩa trường đầu đơn đã áp yêu cầu bắt buộc theo bố cục (dùng cho kiểm tra khi lưu và khi duyệt).
 */
export function useSaleFormLayout() {
  return useEntityFormLayout('sale');
}

/** v55.3 Trường tùy chỉnh của doanh nghiệp đang mở theo đối tượng (gồm trường đã ngừng dùng để xem lại giá trị cũ) */
export function useEntityCf(entity: CfEntity) {
  const { platform, org } = useApp();
  return useMemo(() => cfDefsFor(platform.customFields, org, entity).filter((d) => d.scope === 'HEAD'), [platform.customFields, org, entity]);
}

/**
 * v55.3 Bố cục form của một đối tượng (đơn bán: trang "Form lên đơn bán"; khách hàng / lead: trang "Chi tiết / form";
 * sản phẩm: mặc định theo cờ "Form"), nhóm trường đã tính sẵn, định nghĩa trường đã áp bắt buộc theo bố cục.
 * Cùng quy tắc với hàm SQL validate_custom_fields (phía máy chủ).
 */
export function useEntityFormLayout(entity: CfEntity) {
  const lay = useTenantLayout(L_FORM_PAGE[entity]);
  const head = useEntityCf(entity);
  return useMemo(() => {
    const cfg = lay?.blocks.find((b) => b.type === 'K-RecordForm')?.config;
    const sections = lEntitySections(entity, 'form', cfg, head);
    const defs = cfWithLayout(head, cfg?.sections);
    const placed = sections.flatMap((s) => s.fields);
    /** Trường hiện trong form (kiểm tra "Khi lưu" chỉ xét các trường này, bỏ trường chỉ đọc) */
    const formDefs = defs.filter((d) => placed.some((f) => f.fieldKey === `cf:${d.key}` && !f.readOnly));
    return { sections, defs, formDefs, head, avail: lEntityAvail(entity, 'form', head), title: cfg?.title };
  }, [lay, head, entity]);
}

/** v55.3 Bố cục khối Chi tiết bản ghi của một đối tượng đang áp dụng cho doanh nghiệp */
export function useEntityDetailLayout(entity: CfEntity) {
  const lay = useTenantLayout(L_DETAIL_PAGE[entity]);
  const head = useEntityCf(entity);
  return useMemo(() => {
    const cfg = lay?.blocks.find((b) => b.type === 'K-RecordDetail')?.config;
    return { sections: lEntitySections(entity, 'detail', cfg, head), avail: lEntityAvail(entity, 'detail', head), title: cfg?.title, head };
  }, [lay, head, entity]);
}

/** v56.2 Trường gốc của Nhiệm vụ nội dung luôn có trên form (thông số kênh: kiểm tra bắt buộc của kênh trước khi giao AI dựa vào các ô này) */
export const CT_KEEP = ['seo', 'brand'];
export const CT_STEP_NAMES = ['Định hướng', 'Kịch bản nội dung', 'Cấu hình hình ảnh'] as const;

/**
 * v56.2 Bố cục 3 bước của bảng "Nhiệm vụ nội dung" (trang content-step-1/2/3 do 3A thiết kế và cấp phát):
 *  - trường khóa (Chủ đề, Kênh) luôn ở Bước 1; mỗi trường chỉ xuất hiện 1 lần (bước đặt trước giữ trường)
 *  - trường tùy chỉnh mới (cờ "Form") tự vào Bước 1, trừ khi 3A đã đặt ở Bước 2 / 3
 *  - Thông số kênh (CT_KEEP) chưa đặt ở đâu thì tự thêm cuối Bước 2
 * Trả thêm định nghĩa trường đã áp bắt buộc theo bố cục (kiểm tra trước khi giao AI), nhãn hiển thị và bước chứa từng trường.
 */
export function useContentTaskSteps() {
  const l1 = useTenantLayout('content-step-1');
  const l2 = useTenantLayout('content-step-2');
  const l3 = useTenantLayout('content-step-3');
  const head = useEntityCf('content_task');
  return useMemo(() => {
    const cfgs = [l1, l2, l3].map((l, i) => { const c = l?.blocks.find((b) => b.type === 'K-RecordForm')?.config; return { ...(c ?? { title: '', ds: 'sales' as const }), step: (i + 1) as 1 | 2 | 3 }; });
    const avail = lEntityAvail('content_task', 'form', head);
    const lock = new Set(avail.filter((a) => a.lock).map((a) => a.key));
    const raw = cfgs.map((c) => lEntitySections('content_task', 'form', c, head));
    const later = new Set(raw.slice(1).flatMap((ss) => ss.flatMap((s) => s.fields.map((f) => f.fieldKey))));
    const seen = new Set<string>();
    const steps: LSection[][] = raw.map((ss, i) => ss.map((s) => ({ ...s, fields: s.fields.filter((f) => {
      if (i === 0 && f.id.startsWith('auto-') && later.has(f.fieldKey) && !lock.has(f.fieldKey)) return false;
      if (i > 0 && lock.has(f.fieldKey)) return false;
      if (seen.has(f.fieldKey)) return false;
      seen.add(f.fieldKey);
      return true;
    }) })).filter((s) => s.fields.length));
    const miss = CT_KEEP.filter((k) => !seen.has(k));
    if (miss.length) {
      const s2 = steps[1];
      const last = s2[s2.length - 1];
      const add = miss.map((k) => lFieldItem(k, 12, `keep-${k}`));
      if (last) s2[s2.length - 1] = { ...last, fields: [...last.fields, ...add] }; else s2.push({ id: 'ct2-keep', title: '', cols: 1, fields: add });
    }
    const all = steps.flat();
    const defs = cfWithLayout(head, all);
    const placed = all.flatMap((s) => s.fields);
    const formDefs = defs.filter((d) => placed.some((f) => f.fieldKey === `cf:${d.key}` && !f.readOnly));
    const stepOf = (key: string) => steps.findIndex((ss) => ss.some((s) => s.fields.some((f) => f.fieldKey === key)));
    const labelOf = (key: string) => placed.find((f) => f.fieldKey === key)?.labelOverride?.trim() || avail.find((a) => a.key === key)?.label || key;
    const titles = cfgs.map((c, i) => c.title?.trim() || CT_STEP_NAMES[i]);
    return { steps, avail, defs, formDefs, head, stepOf, labelOf, titles };
  }, [l1, l2, l3, head]);
}

/** v55.3 Phần "Thông tin thêm" trong form của khách hàng / lead / sản phẩm (cùng DynamicFieldRenderer) */
export function EntityCfForm({ entity, vals, onChange, title = 'Thông tin thêm', recordId }: { entity: CfEntity; vals?: Record<string, CfVal>; onChange: (key: string, v: CfVal | undefined) => void; title?: string; recordId?: string }) {
  const fl = useEntityFormLayout(entity);
  const { users } = useApp();
  const nameOf = useNameOf();
  if (!fl.sections.length) return null;
  return (
    <div className="border-t border-[rgb(var(--line))] pt-3" data-entity-form={entity}>
      <p className="mb-2 text-[13.5px] font-medium">{fl.title || title}</p>
      <DynamicFieldRenderer mode="edit" sections={fl.sections} avail={fl.avail} required={fl.defs} vals={vals} onChange={onChange} users={users} nameOf={nameOf} recordId={recordId} />
    </div>
  );
}

/** v55.3 Khối Chi tiết bản ghi (trường tùy chỉnh + trường gốc 3A đặt thêm) trên màn chi tiết khách hàng / lead / sản phẩm */
export function EntityCfDetail({ entity, vals, builtin, className }: { entity: CfEntity; vals?: Record<string, CfVal>; builtin?: (key: string) => ReactNode; className?: string }) {
  const dl = useEntityDetailLayout(entity);
  const nameOf = useNameOf();
  if (!dl.sections.length) return null;
  return (
    <section className={cn('rounded-md border border-[rgb(var(--line))] p-4', className)} data-entity-detail={entity}>
      <h3 className="mb-3 text-[14px] font-medium">{dl.title || 'Thông tin thêm'}</h3>
      <DynamicFieldRenderer mode="view" sections={dl.sections} avail={dl.avail} vals={vals} builtin={builtin} nameOf={nameOf} />
    </section>
  );
}

/** Định nghĩa trường đầu đơn có áp bắt buộc theo bố cục form (kiểm tra khi duyệt đơn) */
export function useSaleHeadDefs() {
  return useSaleFormLayout().defs;
}

/** Giá trị hiển thị (chuỗi rỗng = chưa nhập) */
export function cfText(d: CfDef, v: CfVal | undefined, nameOf: (id: string) => string): string {
  if (d.type === 'check') return v === true ? 'Có' : v === false ? 'Không' : '';
  if (cfEmpty(v)) return '';
  if (d.type === 'money' || d.type === 'number' || d.type === 'formula') return `${Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}${d.unit && d.type !== 'money' ? ` ${d.unit}` : ''}`;
  if (d.type === 'date') return fmtDate(String(v));
  if (d.type === 'user') return nameOf(String(v)) || '';
  // v56 kiểu chuyên ngành
  if (d.type === 'resource_picker') return nameOf(String(v)) || String(v);
  if (d.type === 'datetime_range') return rangeText(rangeParse(v)) || String(v);
  if (d.type === 'checklist') { const steps = d.options ?? []; return `${checklistDone(v).filter((x) => steps.includes(x)).length}/${steps.length} công đoạn`; }
  if (d.type === 'media_gallery') { const n = mediaOf(v).length; return n ? `${n} ảnh` : ''; }
  if (d.type === 'signature') { const s = signatureOf(v); return s ? `Đã ký ${fmtDT(new Date(s.at).toISOString())}` : ''; }
  return String(v);
}

/** Ô nhập theo kiểu trường. ctx: giá trị các trường khác của bản ghi + mã bản ghi (tài nguyên kiểm tra trùng lịch, ảnh / chữ ký theo bản ghi) */
export function CfInput({ d, v, set, users, placeholder, disabled, ctx }: { d: CfDef; v: CfVal | undefined; set: (v: CfVal | undefined) => void; users: User[]; placeholder?: string; disabled?: boolean; ctx?: CfCtx }) {
  const ph = placeholder || undefined;
  if (d.type === 'datetime_range') return <RangeInput d={d} v={v} set={set} disabled={disabled} />;
  if (d.type === 'resource_picker') return <ResourcePicker d={d} v={v} set={set} disabled={disabled} ctx={ctx} />;
  if (d.type === 'formula') return <FormulaView d={d} v={v} />;
  if (d.type === 'checklist') return <ChecklistInput d={d} v={v} set={set} disabled={disabled} />;
  if (d.type === 'media_gallery') return <MediaInput d={d} v={v} set={set} disabled={disabled} ctx={ctx} />;
  if (d.type === 'signature') return <SignatureInput d={d} v={v} set={set} disabled={disabled} ctx={ctx} />;
  if (d.type === 'check') return <label className="flex h-[38px] items-center gap-2 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={v === true} disabled={disabled} onChange={(e) => set(e.target.checked)} />{d.label}</label>;
  if (d.type === 'select') return <select className={inputCls} value={String(v ?? '')} disabled={disabled} onChange={(e) => set(e.target.value || undefined)} aria-label={d.label}><option value="">{ph ?? '—'}</option>{(d.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}{!cfEmpty(v) && !(d.options ?? []).includes(String(v)) && <option value={String(v)}>{String(v)}</option>}</select>;
  if (d.type === 'user') return <select className={inputCls} value={String(v ?? '')} disabled={disabled} onChange={(e) => set(e.target.value || undefined)} aria-label={d.label}><option value="">{ph ?? '—'}</option>{users.filter((u) => u.active || u.id === v).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>;
  if (d.type === 'money') return <MoneyInput value={Number(v ?? 0)} disabled={disabled} onChange={(n) => set(n || undefined)} />;
  if (d.type === 'number') return <input className={inputCls} type="number" step="any" placeholder={ph} disabled={disabled} value={cfEmpty(v) ? '' : String(v)} onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} aria-label={d.label} />;
  if (d.type === 'date') return <input className={inputCls} type="date" disabled={disabled} value={String(v ?? '')} onChange={(e) => set(e.target.value || undefined)} aria-label={d.label} />;
  return <input className={inputCls} placeholder={ph} disabled={disabled} value={String(v ?? '')} onChange={(e) => set(e.target.value || undefined)} aria-label={d.label} />;
}

/** v55.2.1 Điều khiển chế độ thiết kế của DynamicFieldRenderer (3A Studio). sel: id ô trường đang chọn hoặc 's:<id nhóm>' */
export type FieldDesign = {
  sel: string | null; onSelect: (id: string | null) => void;
  dragging: boolean; onDragStart: (d: { sec: string; id: string }) => void; onDragEnd: () => void;
  /** thả thứ đang kéo vào nhóm `sec`, trước ô `before` (không có = cuối nhóm) */
  onDrop: (sec: string, before?: string) => void;
  onSpan: (sec: string, id: string, n: number) => void; onRemove: (sec: string, id: string) => void;
  /** lý do trường không bỏ được ('' = bỏ được) */
  fixed: (key: string) => string;
  onSecTitle: (sec: string, title: string) => void; onAddSection: () => void;
  /** v55.3 Health Check: cảnh báo của trường ('' = hợp lệ) */
  warn?: (key: string) => string;
};

/** Độ rộng ô theo màn: rộng theo colSpan; vừa tối thiểu nửa hàng; hẹp cả hàng */
function useSpan(narrow?: boolean) {
  const wide = useMinW(1280);
  const mid = useMinW(640);
  return (n: number) => (narrow || !mid ? 12 : wide ? n : Math.max(6, n));
}

/**
 * Bộ vẽ bố cục trường (Cấp 2) dùng chung: 3A xem trước (sample) và màn hình vận hành của doanh nghiệp.
 *  - mode 'view': khối Chi tiết bản ghi; trường gốc vẽ bằng `builtin`, trường tùy chỉnh theo giá trị bản ghi
 *  - mode 'edit': khối Form; chỉ trường tùy chỉnh; chỉ đọc, gợi ý nhập, chú thích, dấu * theo bắt buộc (đã áp bố cục)
 * Bỏ trường khỏi bố cục chỉ ẩn ô; giá trị cf[fieldKey] trong bản ghi giữ nguyên.
 */
export function DynamicFieldRenderer({ sections, avail, mode, vals, onChange, users = [], nameOf = () => '', builtin, bare, sample, narrow, required, design, recordId, look }: {
  /** v56 mã bản ghi đang sửa (kiểm tra trùng lịch tài nguyên bỏ chính bản ghi; thư mục ảnh / chữ ký) */
  recordId?: string;
  /** v60 (chỉ mode 'view'): 'sheet' = bảng thông tin có kẻ ô, nhãn in đậm "Nhãn: giá trị" (trang chi tiết đơn hàng); mặc định nhãn nhỏ trên giá trị */
  look?: 'sheet';
  sections: LSection[]; avail: LFieldAvail[]; mode: 'view' | 'edit';
  vals?: Record<string, CfVal>; onChange?: (key: string, v: CfVal | undefined) => void;
  /** Trường gốc: mode 'view' = giá trị; mode 'edit' (v56.2) = ô nhập do màn hình nghiệp vụ vẽ (nhận nhãn đã áp bố cục) */
  users?: User[]; nameOf?: (id: string) => string; builtin?: (key: string, label?: string) => ReactNode;
  /** v56.2 trường gốc tự vẽ tiêu đề (không thêm nhãn phía trên) */
  bare?: string[];
  /** Màn thiết kế / xem trước: giá trị mẫu, không đọc dữ liệu doanh nghiệp */
  sample?: boolean; narrow?: boolean;
  /** Định nghĩa đã áp bắt buộc theo bố cục (form) */
  required?: CfDef[];
  /** v55.2.1 3A Studio: cùng bộ vẽ, thêm chọn trường, kéo thả giữa các nhóm, nút độ rộng nhanh */
  design?: FieldDesign;
}) {
  const span = useSpan(narrow);
  const sheet = look === 'sheet' && mode === 'view' && !design;
  const [shut, setShut] = useState<Record<string, boolean>>(() => Object.fromEntries(sections.filter((s) => s.title && s.collapsedByDefault).map((s) => [s.id, true])));
  const [over, setOver] = useState<string | null>(null);
  const req = (d: CfDef) => (required?.find((x) => x.key === d.key) ?? d).required;
  // v56 trường công thức tự tính khi các trường số đổi (form thật; màn thiết kế / xem trước không ghi)
  const allCf = useMemo(() => avail.map((a) => a.cf).filter((d): d is CfDef => !!d), [avail]);
  const live = mode === 'edit' && !sample && !design && !!onChange;
  useEffect(() => {
    if (!live || !allCf.some((d) => d.type === 'formula')) return;
    const nx = cfCompute(allCf, vals);
    allCf.filter((d) => d.type === 'formula' && nx[d.key] !== vals?.[d.key]).forEach((d) => onChange?.(d.key, nx[d.key]));
  }, [live, allCf, vals, onChange]);
  const cell = (f: LFieldItem, body: ReactNode, sid = '') => {
    const st = { gridColumn: `span ${span(f.colSpan)} / span ${span(f.colSpan)}` };
    if (!design) return <div key={f.id} className="min-w-0" style={st} data-field={f.fieldKey}>{body}</div>;
    const on = design.sel === f.id;
    const fx = design.fixed(f.fieldKey);
    const name = f.labelOverride?.trim() || avail.find((a) => a.key === f.fieldKey)?.label || f.fieldKey;
    const w = design.warn?.(f.fieldKey) ?? '';
    return (
      <div key={f.id} style={st} data-field={f.fieldKey} data-warn={w ? 'true' : undefined} draggable title={w || undefined}
        className={cn('relative min-w-0 cursor-grab rounded-lg border p-2', w && 'border-[rgb(var(--warn))] bg-[rgb(var(--warn)/0.1)]', on ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.05)] ring-2 ring-[rgb(var(--accent)/0.25)]' : !w && 'border-dashed border-[rgb(var(--line))] hover:border-[rgb(var(--ink)/0.3)]', over === f.id && 'border-l-4 border-l-[rgb(var(--accent))]')}
        onClick={(e) => { e.stopPropagation(); design.onSelect(f.id); }}
        onDragStart={(e) => { e.stopPropagation(); design.onDragStart({ sec: sid, id: f.id }); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', f.fieldKey); }}
        onDragEnd={() => { setOver(null); design.onDragEnd(); }}
        onDragOver={(e) => { if (design.dragging) { e.preventDefault(); e.stopPropagation(); setOver(f.id); } }}
        onDragLeave={() => setOver((o) => (o === f.id ? null : o))}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(null); design.onDrop(sid, f.id); }}>
        <div className="pointer-events-none">{body}</div>
        {w && <p className="mt-1 flex items-start gap-1 text-[11.5px] text-[rgb(var(--warn))]"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />{w}</p>}
        <div className={cn('mt-1.5 items-center gap-1', on ? 'flex' : 'hidden')} role="group" aria-label={`Độ rộng ${name}`}>
          {([[4, '1/3'], [6, '1/2'], [12, 'Cả dòng']] as const).map(([n, l]) => <button key={n} type="button" aria-pressed={f.colSpan === n} className={cn('rounded px-1.5 py-0.5 text-[11.5px]', f.colSpan === n ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'border border-[rgb(var(--line))] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)]')} onClick={(e) => { e.stopPropagation(); design.onSpan(sid, f.id, n); }}>{l}</button>)}
          <span className="ml-auto font-mono text-[11px] tabular-nums text-[rgb(var(--muted))]">{f.colSpan}/12</span>
          {fx ? <span className="text-[11px] text-[rgb(var(--muted))]" title={fx}>khóa</span> : <button type="button" className="rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" aria-label={`Bỏ ${name} khỏi bố cục`} onClick={(e) => { e.stopPropagation(); design.onRemove(sid, f.id); }}><X className="h-3.5 w-3.5" aria-hidden /></button>}
        </div>
      </div>
    );
  };
  const rendered = sections.map((s) => {
    const items = s.fields.map((f) => {
      const a = avail.find((x) => x.key === f.fieldKey);
      if (!a) return null;
      const label = f.labelOverride?.trim() || a.label;
      if (a.missing) return design ? cell(f, <><p className="mb-1 text-[12.5px] text-[rgb(var(--muted))]">{label}</p><div className="flex min-h-7 items-center text-[14px] text-[rgb(var(--muted))]">—</div></>, s.id) : null;
      const d = a.cf;
      if (mode === 'view' && sheet) {
        // v60 bảng thông tin: mỗi ô một trường, nhãn đậm + giá trị trên một dòng; trường nhiều nội dung (ảnh, danh sách tích, chữ ký) xuống dòng trong ô
        if (!d) return cell(f, <div className="flex min-h-[38px] min-w-0 items-center gap-1.5 bg-[rgb(var(--surface))] px-3 py-2 text-[13.5px]"><b className="shrink-0 font-semibold">{label}:</b><span className="flex min-w-0 items-center gap-1.5 truncate">{builtin?.(f.fieldKey) ?? '—'}</span></div>, s.id);
        const tx = sample ? cfSample(d) : cfText(d, vals?.[d.key], nameOf);
        if (!sample && d.status !== 'ACTIVE' && !tx) return null;
        const rich = !sample && CF_RICH.includes(d.type) ? <CfRichView d={d} v={vals?.[d.key]} /> : null;
        return cell(f, rich
          ? <div className="min-w-0 bg-[rgb(var(--surface))] px-3 py-2 text-[13.5px]" data-cf-view={d.type}><b className="mb-1 block font-semibold">{label}:</b>{rich}</div>
          : <div className="flex min-h-[38px] min-w-0 items-center gap-1.5 bg-[rgb(var(--surface))] px-3 py-2 text-[13.5px]"><b className="shrink-0 font-semibold">{label}:</b>{tx ? <span className={cn('min-w-0 truncate', (d.type === 'number' || d.type === 'money' || d.type === 'formula') && 'tabular-nums')} title={tx}>{tx}</span> : <span className="text-[rgb(var(--muted))]">—</span>}{sample && <i className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--accent))]" title="Trường tùy chỉnh" />}</div>, s.id);
      }
      if (mode === 'view') {
        if (!d) return cell(f, <><p className="mb-1 text-[12.5px] text-[rgb(var(--muted))]">{label}</p><div className="flex min-h-7 min-w-0 items-center gap-1.5 truncate text-[14px]">{builtin?.(f.fieldKey) ?? '—'}</div></>, s.id);
        const tx = sample ? cfSample(d) : cfText(d, vals?.[d.key], nameOf);
        if (!sample && d.status !== 'ACTIVE' && !tx) return null;
        const rich = !sample && CF_RICH.includes(d.type) ? <CfRichView d={d} v={vals?.[d.key]} /> : null;
        return cell(f, <><p className="mb-1 flex items-center gap-1 text-[12.5px] text-[rgb(var(--muted))]">{label}{sample && <i className="inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" title="Trường tùy chỉnh" />}</p>{rich ? <div className="min-h-7 min-w-0 text-[14px]" data-cf-view={d.type}>{rich}</div> : <div className="flex min-h-7 min-w-0 items-center gap-1.5 truncate text-[14px]">{tx ? <span className={cn('truncate', (d.type === 'number' || d.type === 'money' || d.type === 'formula') && 'tabular-nums')} title={tx}>{tx}</span> : <span className="text-[rgb(var(--muted))]">—</span>}</div>}{f.helpText && <p className="mt-0.5 truncate text-[11.5px] text-[rgb(var(--muted))]">{f.helpText}</p>}</>, s.id);
      }
      if (!d) {
        // v56.2 trường gốc trong khối Form (Nhiệm vụ nội dung): ô nhập do màn hình nghiệp vụ vẽ qua `builtin`; Studio / xem trước vẽ giá trị mẫu.
        // Không bọc <label>: ô gốc có thể gồm nhiều điều khiển (chip, thẻ thu gọn, chọn ảnh)
        if (!builtin) return null;
        const node = builtin(f.fieldKey, label);
        if (node === null || node === undefined || node === false) return null;
        const lock = a.lock ? ' *' : '';
        // bare: ô gốc tự vẽ tiêu đề (thẻ thu gọn, thanh chip) — nhận nhãn đã đổi tên qua tham số thứ 2 của `builtin`
        if (!sample && bare?.includes(f.fieldKey)) return cell(f, <div data-builtin={f.fieldKey}>{node}{f.helpText && <span className="mt-1 block text-xs text-[rgb(var(--muted))]">{f.helpText}</span>}</div>, s.id);
        return cell(f, <div data-builtin={f.fieldKey}><span className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{label}{lock}</span>{sample ? <div className="flex min-h-[38px] items-center rounded-lg border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--sunken))] px-3 py-2 text-[13px] text-[rgb(var(--fg2))]">{node}</div> : node}{f.helpText && <span className="mt-1 block text-xs text-[rgb(var(--muted))]">{f.helpText}</span>}</div>, s.id);
      }
      const r = req(d);
      const v = vals?.[d.key];
      const ro = !!f.readOnly;
      const dl = { ...d, label };
      const input = ro
        ? (!sample && CF_RICH.includes(d.type) ? <CfRichView d={dl} v={v} /> : d.type === 'formula' && !sample ? <CfInput d={dl} v={v} set={() => undefined} users={users} /> : <input className={inputCls} disabled value={sample ? cfSample(d) : cfText(d, v, nameOf) || '—'} aria-label={label} readOnly />)
        : <CfInput d={dl} v={sample ? undefined : v} set={(x) => onChange?.(d.key, x)} users={users} placeholder={f.placeholder} disabled={sample} ctx={{ vals, recordId }} />;
      const lab = `${label}${r !== 'NONE' ? ' *' : ''}${ro ? ' (chỉ đọc)' : ''}`;
      // v56: ô nhiều điều khiển (2 ô giờ, danh sách tích, ảnh, khung ký) không bọc trong <label> — tránh bấm nhầm kích hoạt điều khiển đầu tiên
      if (CF_MULTI.includes(d.type)) return cell(f, <div><span className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{lab}</span>{input}{f.helpText && <span className="mt-1 block text-xs text-[rgb(var(--muted))]">{f.helpText}</span>}</div>, s.id);
      return cell(f, <Field label={lab} hint={f.helpText}>{input}</Field>, s.id);
    }).filter(Boolean);
    return { s, items };
  }).filter((x) => design || x.items.length);
  if (design) return (
    <div className="space-y-3" aria-label="Khung bố cục trường">
      {rendered.map(({ s, items }, i) => {
        const on = design.sel === `s:${s.id}`;
        return (
          <section key={s.id} aria-label={`Nhóm ${s.title || i + 1}`} data-section={s.id} onClick={(e) => { e.stopPropagation(); design.onSelect(`s:${s.id}`); }}
            className={cn('rounded-xl border p-3', on ? 'border-[rgb(var(--accent))]' : 'border-[rgb(var(--line))]', over === `s:${s.id}` && 'bg-[rgb(var(--accent)/0.05)]')}
            onDragOver={(e) => { if (design.dragging) { e.preventDefault(); setOver(`s:${s.id}`); } }} onDragLeave={() => setOver((o) => (o === `s:${s.id}` ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); design.onDrop(s.id); }}>
            <div className="mb-2 flex items-center gap-2">
              <input className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[13.5px] font-medium outline-none hover:bg-[rgb(var(--ink)/0.04)] focus:bg-[rgb(var(--ink)/0.04)]" value={s.title} placeholder="Nhóm không tiêu đề" aria-label={`Tiêu đề nhóm ${i + 1}`} onClick={(e) => e.stopPropagation()} onChange={(e) => design.onSecTitle(s.id, e.target.value)} />
              <span className="shrink-0 text-[11.5px] text-[rgb(var(--muted))]">{s.cols} cột · {s.fields.length} trường{s.collapsedByDefault ? ' · thu gọn sẵn' : ''}</span>
            </div>
            <div className="grid grid-cols-12 gap-x-3 gap-y-3">{items}{!items.length && <p className="col-span-12 rounded-lg border border-dashed border-[rgb(var(--line))] py-4 text-center text-[12.5px] text-[rgb(var(--muted))]">Kéo trường vào đây</p>}</div>
          </section>
        );
      })}
      <button type="button" className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[rgb(var(--line))] py-2 text-[13px] text-[rgb(var(--fg2))] hover:border-[rgb(var(--ink)/0.3)]" onClick={design.onAddSection}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm nhóm trường</button>
    </div>
  );
  if (!rendered.length) return sample ? <p className="py-3 text-[12.5px] text-[rgb(var(--muted))]">Chưa có trường nào trong khối</p> : null;
  const appr = mode === 'edit' ? sections.flatMap((s) => s.fields).map((f) => avail.find((a) => a.key === f.fieldKey)).filter((a): a is LFieldAvail => !!a?.cf && req(a.cf) === 'APPROVE') : [];
  return (
    <div className="space-y-4">
      {rendered.map(({ s, items }, i) => {
        const closed = !!s.title && !!shut[s.id];
        return (
          <section key={s.id} className={cn(i > 0 && s.title && 'border-t border-[rgb(var(--line))] pt-3')} aria-label={s.title || undefined} data-section={s.id}>
            {s.title && (
              <button type="button" className="mb-2 flex w-full items-center gap-1.5 text-left text-[13.5px] font-medium" aria-expanded={!closed} onClick={() => setShut((p) => ({ ...p, [s.id]: !closed }))}>
                <ChevronDown className={cn('h-4 w-4 text-[rgb(var(--muted))] transition-transform', closed && '-rotate-90')} aria-hidden />{s.title}
              </button>
            )}
            {!closed && (sheet ? (() => {
              // ô trống (trường không vừa phần còn lại của hàng nên xuống dòng, hoặc cuối bảng) tô nền thường để đường kẻ không thành mảng xám
              const shown = new Set(items.map((el) => (el && typeof el === 'object' && 'key' in el ? String(el.key) : '')));
              const vis = s.fields.filter((f) => shown.has(f.id));
              const pad = (n: number, k: string) => <div key={k} className="bg-[rgb(var(--surface))]" style={{ gridColumn: `span ${n} / span ${n}` }} aria-hidden />;
              const out: ReactNode[] = [];
              let cur = 0;
              vis.forEach((f, i) => {
                const w = Math.min(12, span(f.colSpan));
                if (cur && cur + w > 12) { out.push(pad(12 - cur, `pad-${f.id}`)); cur = 0; }
                out.push(items[i]);
                cur = (cur + w) % 12;
              });
              if (cur) out.push(pad(12 - cur, 'pad-end'));
              return <div className="grid grid-cols-12 gap-px overflow-hidden rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--line))]" data-sheet>{out}</div>;
            })() : <div className="grid grid-cols-12 gap-x-4 gap-y-3.5">{items}</div>)}
          </section>
        );
      })}
      {appr.length > 0 && <p className="text-[12.5px] text-[rgb(var(--muted))]">* {appr.map((a) => sections.flatMap((s) => s.fields).find((f) => f.fieldKey === a.key)?.labelOverride?.trim() || a.label).join(', ')}: bắt buộc trước khi duyệt đơn</p>}
    </div>
  );
}
