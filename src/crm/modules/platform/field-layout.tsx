'use client';

// 3A Studio — Cấp 2: bố cục từng trường trong khối Form / Chi tiết bản ghi.
//  - Trái: trường chưa đặt (kéo vào khung giữa hoặc bấm +)
//  - Giữa: khung bố cục vẽ bằng chính DynamicFieldRenderer (chế độ thiết kế): chọn trường, kéo thả giữa các nhóm, nút 1/3 · 1/2 · Cả dòng
//  - Phải: Field Inspector cho trường / nhóm đang chọn
// Chỉ sửa cấu hình khối (LBlockCfg.sections / off) trong bố cục _platform; không đụng định nghĩa trường (CfDef) và giá trị trong bản ghi.
import { useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, MousePointerClick, Plus, Trash2 } from 'lucide-react';
import { Field } from '../../components/ui';
import { cfWithLayout, inputCls, L_SEC_COLS, type LFieldAvail, lEntityAvail, lEntitySections, lFieldItem, lHealthFull, type LHealth, uid } from '../../lib/core';
import type { CfDef, CfEntity, LBlock, LBlockCfg, LFieldItem, LSection, Org } from '../../lib/types';
import { cn } from '../../lib/utils';
import { DynamicFieldRenderer, type FieldDesign, lBuiltinSample } from '../page-builder';

const SPANS: [number, string][] = [[12, 'Cả dòng (12)'], [9, '3/4 (9)'], [8, '2/3 (8)'], [6, '1/2 (6)'], [4, '1/3 (4)'], [3, '1/4 (3)'], [2, '1/6 (2)']];
const REQ: [string, string][] = [['', 'Theo định nghĩa trường'], ['NONE', 'Không bắt buộc'], ['SAVE', 'Bắt buộc khi lưu đơn'], ['APPROVE', 'Bắt buộc trước khi duyệt']];
const REQ_DEF: Record<CfDef['required'], string> = { NONE: 'không bắt buộc', SAVE: 'bắt buộc khi lưu', APPROVE: 'bắt buộc khi duyệt' };

/** Đang kéo: ô trường trong bố cục (nhóm, ô) hoặc trường chưa đặt (khóa) */
type Drag = { sec: string; id: string } | { key: string } | null;

export const lIsFieldBlock = (b?: LBlock) => b?.type === 'K-RecordDetail' || b?.type === 'K-RecordForm';

export type FieldLayout = NonNullable<ReturnType<typeof useFieldLayout>>;

/** Trạng thái + thao tác bố cục trường của khối đang chọn (null khi khối không phải Form / Chi tiết) */
export function useFieldLayout(b: LBlock | undefined, onCfg: (p: Partial<LBlockCfg>) => void, cf: CfDef[], orgs: Org[] = []) {
  const [drag, setDrag] = useState<Drag>(null);
  const [sel, setSel] = useState<string | null>(null);
  if (!b || !lIsFieldBlock(b)) return null;
  const kind: 'detail' | 'form' = b.type === 'K-RecordForm' ? 'form' : 'detail';
  const c = b.config;
  const entity: CfEntity = c.entity ?? 'sale';
  const head = cf.filter((d) => d.scope === 'HEAD' && d.entity === entity);
  // v55.3 Health Check: trường trong bố cục đã xóa / ngừng dùng / không áp dụng cho DN được phát hành -> giữ ô, cảnh báo vàng
  const health = lHealthFull(b, cf, orgs);
  const avail0 = lEntityAvail(entity, kind, head);
  const extra: LFieldAvail[] = health.filter((h) => !avail0.some((a) => a.key === h.key)).map((h) => ({ key: h.key, label: h.label, missing: true }));
  const avail = [...avail0, ...extra];
  const warn = (k: string) => health.filter((h) => h.key === k).map((h) => h.msg).join('; ');
  const s0 = lEntitySections(entity, kind, c, head, true, extra);
  const secs: LSection[] = s0.length ? s0 : [{ id: 'auto-s', title: '', cols: 2, fields: [] }];
  const eff = cfWithLayout(head, secs);
  const off = c.off ?? [];
  const placed = new Set(secs.flatMap((s) => s.fields.map((f) => f.fieldKey)));
  const rest = avail.filter((a) => !placed.has(a.key));
  const aOf = (k: string) => avail.find((a) => a.key === k);
  /** Không bỏ được: trường gốc khóa, trường bắt buộc của form (bỏ thì không lưu được đơn) */
  const fixed = (k: string) => { const a = aOf(k); if (a?.lock) return 'Trường gốc bắt buộc'; if (kind === 'form' && a?.cf) { const d = eff.find((x) => x.key === a.cf!.key); if (d && d.required !== 'NONE' && d.where.form) return 'Trường bắt buộc'; } return ''; };
  const save = (n: LSection[], offN = off) => onCfg({ sections: n, off: offN.length ? offN : undefined });
  const setSec = (id: string, p: Partial<LSection>) => save(secs.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const setItem = (sid: string, fid: string, p: Partial<LFieldItem>) => save(secs.map((s) => (s.id !== sid ? s : { ...s, fields: s.fields.map((f) => (f.id === fid ? { ...f, ...p } : f)) })));
  const unitOf = (sid: string) => 12 / (secs.find((s) => s.id === sid)?.cols ?? 2);
  /** Đặt trường vào nhóm `to`, trước ô `before` (không có = cuối nhóm) */
  const place = (d: NonNullable<Drag>, to: string, before?: string) => {
    let item: LFieldItem | undefined;
    let n = secs.map((s) => ({ ...s, fields: [...s.fields] }));
    if ('key' in d) item = lFieldItem(d.key, unitOf(to));
    else { if (d.id === before) return; const s = n.find((x) => x.id === d.sec); const i = s?.fields.findIndex((f) => f.id === d.id) ?? -1; if (!s || i < 0) return; [item] = s.fields.splice(i, 1); }
    if (!item) return;
    n = n.map((s) => { if (s.id !== to) return s; const f = [...s.fields]; const j = before ? f.findIndex((x) => x.id === before) : -1; f.splice(j < 0 ? f.length : j, 0, item!); return { ...s, fields: f }; });
    save(n, off.filter((k) => k !== item!.fieldKey));
    setSel(item.id);
  };
  const remove = (sid: string, fid: string) => {
    const f = secs.find((s) => s.id === sid)?.fields.find((x) => x.id === fid);
    if (!f || fixed(f.fieldKey)) return;
    save(secs.map((s) => (s.id === sid ? { ...s, fields: s.fields.filter((x) => x.id !== fid) } : s)), [...off.filter((k) => k !== f.fieldKey), f.fieldKey]);
    setSel(null);
  };
  const move = (sid: string, fid: string, dir: -1 | 1) => save(secs.map((s) => { if (s.id !== sid) return s; const i = s.fields.findIndex((x) => x.id === fid); const j = i + dir; if (i < 0 || j < 0 || j >= s.fields.length) return s; const f = [...s.fields]; [f[i], f[j]] = [f[j], f[i]]; return { ...s, fields: f }; }));
  const moveSec = (id: string, dir: -1 | 1) => { const i = secs.findIndex((s) => s.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= secs.length) return; const n = [...secs]; [n[i], n[j]] = [n[j], n[i]]; save(n); };
  const canDelSec = (s: LSection) => secs.length > 1 && !s.fields.some((f) => fixed(f.fieldKey));
  const delSec = (s: LSection) => { if (!canDelSec(s)) return; save(secs.filter((x) => x.id !== s.id), [...off, ...s.fields.map((f) => f.fieldKey).filter((k) => !off.includes(k))]); setSel(null); };
  const addSec = () => { const id = uid('ls'); save([...secs, { id, title: 'Nhóm mới', cols: 2, fields: [] }]); setSel(`s:${id}`); };
  const design: FieldDesign = {
    sel, onSelect: setSel, dragging: !!drag,
    onDragStart: (d) => setDrag(d), onDragEnd: () => setDrag(null),
    onDrop: (sec, before) => { if (drag) place(drag, sec, before); setDrag(null); },
    onSpan: (sid, fid, n) => setItem(sid, fid, { colSpan: n }), onRemove: remove, fixed,
    onSecTitle: (sid, t) => setSec(sid, { title: t }), onAddSection: addSec, warn,
  };
  const selSec = sel?.startsWith('s:') ? secs.find((s) => s.id === sel.slice(2)) : secs.find((s) => s.fields.some((f) => f.id === sel));
  const selItem = sel && !sel.startsWith('s:') ? selSec?.fields.find((f) => f.id === sel) : undefined;
  return { b, kind, c, entity, health, warn, head, avail, secs, eff, rest, aOf, fixed, design, drag, setDrag, place, remove, move, moveSec, canDelSec, delSec, setSec, setItem, selSec, selItem, setSel };
}

/** Khung giữa: khối Form / Chi tiết vẽ bằng chính DynamicFieldRenderer ở chế độ thiết kế */
export function LFieldCanvas({ fl, narrow }: { fl: FieldLayout; narrow?: boolean }) {
  return (
    <section className="glass-card rounded-xl px-4 py-3" aria-label={`Bố cục trường ${fl.c.title}`} onClick={() => fl.setSel(null)}>
      <h3 className="mb-3 text-[14px] font-medium">{fl.c.title}</h3>
      {fl.health.length > 0 && <LHealthNote items={fl.health} className="mb-3" />}
      <DynamicFieldRenderer sample mode={fl.kind === 'form' ? 'edit' : 'view'} narrow={narrow} sections={fl.secs} avail={fl.avail} required={fl.eff} builtin={(k) => lBuiltinSample(fl.entity, k)} design={fl.design} />
    </section>
  );
}

/** Cột trái: trường chưa đặt */
export function LFieldPalette({ fl }: { fl: FieldLayout }) {
  const last = fl.secs[fl.secs.length - 1];
  return (
    <div aria-label="Trường chưa đặt">
      <div className="mb-3 flex items-center"><h3 className="font-medium">Trường dữ liệu</h3><span className="ml-auto text-[12px] text-[rgb(var(--muted))]">{fl.rest.length} chưa đặt</span></div>
      {fl.rest.length ? (
        <ul className="space-y-1.5">{fl.rest.map((a) => (
          <li key={a.key} draggable data-avail={a.key} onDragStart={(e) => { fl.setDrag({ key: a.key }); e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', a.key); }} onDragEnd={() => fl.setDrag(null)}
            className="flex cursor-grab items-center gap-2 rounded-lg border border-[rgb(var(--line))] px-2.5 py-2 text-[13px] hover:border-[rgb(var(--ink)/0.25)]">
            <GripVertical className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{a.label}{a.cf && <i className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))] align-middle" title="Trường tùy chỉnh" />}{a.cf?.status === 'OFF' && <span className="ml-1 text-[11px] text-[rgb(var(--muted))]">ngừng dùng</span>}</span>
            <button className="rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => fl.place({ key: a.key }, (fl.selSec ?? last).id)} aria-label={`Thêm ${a.label} vào bố cục`}><Plus className="h-3.5 w-3.5" aria-hidden /></button>
          </li>
        ))}</ul>
      ) : <p className="text-[12.5px] text-[rgb(var(--muted))]">Mọi trường đã có trong bố cục</p>}
      <p className="mt-3 text-[12px] text-[rgb(var(--muted))]">{fl.kind === 'form' ? 'Trường tùy chỉnh đầu đơn đang dùng. Trường mới tạo có cờ "Form" tự vào nhóm cuối' : 'Trường gốc của đơn và trường tùy chỉnh đầu đơn. Trường mới tạo có cờ "Thông tin" tự vào nhóm cuối'}. Bỏ trường chỉ ẩn khỏi {fl.kind === 'form' ? 'form' : 'khối'}, giá trị đã nhập trong đơn giữ nguyên</p>
    </div>
  );
}

/** Cột phải: Field Inspector (trường đang chọn) hoặc cài đặt nhóm đang chọn */
export function LFieldInspector({ fl, onBack }: { fl: FieldLayout; onBack: () => void }) {
  const ib = 'rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-30';
  const s = fl.selSec; const f = fl.selItem;
  const head = <div className="mb-3 flex items-center gap-2"><h3 className="font-medium">{f ? 'Thuộc tính trường' : s ? 'Nhóm trường' : 'Bố cục trường'}</h3><button className="ml-auto text-[12.5px] text-[rgb(var(--accent-fg))] hover:underline" onClick={onBack}>Cài đặt khối</button></div>;
  if (f && s) {
    const a: LFieldAvail | undefined = fl.aOf(f.fieldKey); const d = a?.cf; const r = d ? fl.eff.find((x) => x.key === d.key)?.required : undefined; const fx = fl.fixed(f.fieldKey);
    const i = s.fields.findIndex((x) => x.id === f.id);
    return (
      <div className="space-y-3" aria-label="Field Inspector">
        {head}
        <div className="rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-[12.5px]"><p className="font-medium">{a?.label ?? f.fieldKey}</p><p className="font-mono text-[11.5px] text-[rgb(var(--muted))]">{f.fieldKey}{d ? ` · ${d.type}` : ' · trường gốc'}{d ? ` · ${REQ_DEF[d.required]}` : ''}</p></div>
        <Field label="Nhãn hiển thị (labelOverride)"><input className={inputCls} value={f.labelOverride ?? ''} placeholder={a?.label} onChange={(e) => fl.setItem(s.id, f.id, { labelOverride: e.target.value || undefined })} /></Field>
        <div>
          <p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">Độ rộng</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Độ rộng nhanh">{([[4, '1/3 dòng'], [6, '1/2 dòng'], [12, 'Cả dòng']] as const).map(([n, l]) => <button key={n} role="radio" aria-checked={f.colSpan === n} className={cn('flex-1 rounded-md border px-2 py-1.5 text-[12.5px]', f.colSpan === n ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'border-[rgb(var(--line))] text-[rgb(var(--fg2))]')} onClick={() => fl.setItem(s.id, f.id, { colSpan: n })}>{l}</button>)}</div>
          <select className={cn(inputCls, 'mt-1.5')} aria-label="Độ rộng (cột)" value={f.colSpan} onChange={(e) => fl.setItem(s.id, f.id, { colSpan: Number(e.target.value) })}>{[...SPANS, ...(SPANS.some(([n]) => n === f.colSpan) ? [] : [[f.colSpan, `${f.colSpan}/12`] as [number, string]])].map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select>
        </div>
        {fl.kind === 'form' && d && <Field label="Gợi ý trong ô (placeholder)"><input className={inputCls} value={f.placeholder ?? ''} onChange={(e) => fl.setItem(s.id, f.id, { placeholder: e.target.value || undefined })} placeholder="VD: Ghi số xe, tên nhà xe" /></Field>}
        <Field label="Chú thích dưới ô"><input className={inputCls} value={f.helpText ?? ''} onChange={(e) => fl.setItem(s.id, f.id, { helpText: e.target.value || undefined })} /></Field>
        {fl.kind === 'form' && d && <>
          <Field label="Bắt buộc (requiredOverride)"><select className={inputCls} value={f.requiredOverride ?? ''} onChange={(e) => fl.setItem(s.id, f.id, { requiredOverride: (e.target.value || undefined) as LFieldItem['requiredOverride'] })}>{REQ.map(([k, l]) => <option key={k} value={k}>{k ? l : `${l} (${REQ_DEF[d.required]})`}</option>)}</select></Field>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={!!f.readOnly} onChange={(e) => fl.setItem(s.id, f.id, { readOnly: e.target.checked || undefined })} />Chỉ đọc (readOnly): hiện giá trị, không cho sửa</label>
          {f.readOnly && r === 'SAVE' && <p className="flex gap-2 rounded-lg bg-[rgb(var(--accent)/0.08)] px-3 py-2 text-[12.5px]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[rgb(var(--accent))]" aria-hidden />Chỉ đọc nhưng bắt buộc khi lưu: form bỏ qua kiểm tra trường chỉ đọc</p>}
        </>}
        {fl.kind === 'detail' && <p className="text-[12px] text-[rgb(var(--muted))]">Khối Chi tiết chỉ hiển thị; gợi ý nhập, chỉ đọc, bắt buộc đặt ở trang Form lên đơn bán</p>}
        <Field label="Nhóm"><select className={inputCls} value={s.id} onChange={(e) => fl.place({ sec: s.id, id: f.id }, e.target.value)}>{fl.secs.map((x, xi) => <option key={x.id} value={x.id}>{x.title || `Nhóm ${xi + 1}`}</option>)}</select></Field>
        <div className="flex items-center gap-1 border-t border-[rgb(var(--line))] pt-3">
          <button className={ib} disabled={i <= 0} onClick={() => fl.move(s.id, f.id, -1)} aria-label="Đưa trường lên"><ArrowUp className="h-4 w-4" aria-hidden /></button>
          <button className={ib} disabled={i >= s.fields.length - 1} onClick={() => fl.move(s.id, f.id, 1)} aria-label="Đưa trường xuống"><ArrowDown className="h-4 w-4" aria-hidden /></button>
          <button className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--danger)/0.08)] disabled:opacity-40" disabled={!!fx} title={fx || undefined} onClick={() => fl.remove(s.id, f.id)}><Trash2 className="h-3.5 w-3.5" aria-hidden />Bỏ khỏi bố cục</button>
        </div>
      </div>
    );
  }
  if (s) {
    const si = fl.secs.findIndex((x) => x.id === s.id);
    return (
      <div className="space-y-3" aria-label="Field Inspector">
        {head}
        <Field label="Tiêu đề nhóm"><input className={inputCls} value={s.title} placeholder="Nhóm không tiêu đề" onChange={(e) => fl.setSec(s.id, { title: e.target.value })} /></Field>
        <div><p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">Số cột (trường mới thả vào rộng 12 / số cột)</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Số cột nhóm">{L_SEC_COLS.map((n) => <button key={n} role="radio" aria-checked={s.cols === n} className={cn('flex-1 rounded-md border py-1.5 text-[12.5px]', s.cols === n ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'border-[rgb(var(--line))] text-[rgb(var(--fg2))]')} onClick={() => fl.setSec(s.id, { cols: n, fields: s.fields.map((x) => ({ ...x, colSpan: x.colSpan === 12 / s.cols ? 12 / n : x.colSpan })) })}>{n}</button>)}</div></div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={!!s.collapsedByDefault} disabled={!s.title} onChange={(e) => fl.setSec(s.id, { collapsedByDefault: e.target.checked || undefined })} />Thu gọn sẵn (nhóm có tiêu đề)</label>
        <div className="flex items-center gap-1 border-t border-[rgb(var(--line))] pt-3">
          <button className={ib} disabled={si <= 0} onClick={() => fl.moveSec(s.id, -1)} aria-label="Đưa nhóm lên"><ArrowUp className="h-4 w-4" aria-hidden /></button>
          <button className={ib} disabled={si >= fl.secs.length - 1} onClick={() => fl.moveSec(s.id, 1)} aria-label="Đưa nhóm xuống"><ArrowDown className="h-4 w-4" aria-hidden /></button>
          <button className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--danger)/0.08)] disabled:opacity-40" disabled={!fl.canDelSec(s)} title={fl.canDelSec(s) ? undefined : 'Nhóm duy nhất hoặc có trường bắt buộc: chuyển trường sang nhóm khác trước'} onClick={() => fl.delSec(s)}><Trash2 className="h-3.5 w-3.5" aria-hidden />Xóa nhóm</button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 text-[13px] text-[rgb(var(--fg2))]" aria-label="Field Inspector">
      {head}
      <p className="flex gap-2"><MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />Bấm một trường ở khung giữa để chỉnh nhãn, gợi ý, chỉ đọc, bắt buộc; bấm tiêu đề nhóm để chỉnh nhóm.</p>
      <p className="text-[rgb(var(--muted))]">{fl.secs.length} nhóm · {fl.secs.reduce((n, x) => n + x.fields.length, 0)} trường · {fl.rest.length} trường chưa đặt</p>
    </div>
  );
}

/** v55.3 Health Check: cảnh báo vàng trường không hợp lệ trong bố cục (đã xóa / ngừng dùng / không áp dụng cho DN) */
export function LHealthNote({ items, className }: { items: LHealth[]; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-[rgb(var(--warn)/0.5)] bg-[rgb(var(--warn)/0.12)] px-3 py-2 text-[12.5px]', className)} role="status" aria-label="Cảnh báo cấu hình trường">
      <p className="mb-1 flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5 text-[rgb(var(--warn))]" aria-hidden />{items.length} trường cần xử lý</p>
      <ul className="space-y-0.5">{items.map((h, i) => <li key={`${h.key}-${i}`}><span className="font-medium">{h.label}</span> <span className="font-mono text-[11.5px] text-[rgb(var(--muted))]">{h.key}</span>: {h.msg}</li>)}</ul>
    </div>
  );
}
