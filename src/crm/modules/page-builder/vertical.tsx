'use client';

// v56 Bộ vẽ trang — ô nhập và ô hiển thị của kiểu trường chuyên ngành: khoảng thời gian, chọn tài nguyên (chống trùng lịch),
// công thức, danh sách công đoạn, bộ ảnh (kho tệp riêng crm-attach), chữ ký (ảnh + SHA-256).
// Dùng chung cho 3A xem trước và màn hình doanh nghiệp qua DynamicFieldRenderer / CfInput.
import { type PointerEvent as RPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ImagePlus, Loader2, PenLine, RotateCcw, X } from 'lucide-react';
import { ATTACH_PREFIX, attachPath, cloud, CLOUD_ON, CloudError, fmtDT, fmtN, inputCls, openAttachment, subtle, useApp } from '../../lib/core';
import { cloudMessage } from '../../lib/cloud';
import { checklistDone, checkResourceAvailability, type MediaItem, mediaOf, rangeDuration, rangeIssue, rangeParse, rangeStr, rangeText, signatureOf, type SignatureVal } from '../../lib/industry';
import type { CfDef, CfVal } from '../../lib/types';
import { compressImage } from '../../lib/workshop';
import { cn } from '../../lib/utils';

/** Bối cảnh bản ghi cho ô nhập cần đọc trường khác (tài nguyên ↔ khoảng thời gian) và loại trừ chính bản ghi */
export type CfCtx = { vals?: Record<string, CfVal>; recordId?: string };

const sha256Hex = async (b: Blob) => Array.from(new Uint8Array(await subtle().digest('SHA-256', await b.arrayBuffer())), (x) => x.toString(16).padStart(2, '0')).join('');

/** Tải ảnh của trường lên kho tệp riêng của doanh nghiệp (có máy chủ); chạy trên máy (không máy chủ) giữ ảnh nén nhỏ trong bản ghi */
async function uploadCfImage(tenant: string, folder: string, blob: Blob, name: string): Promise<{ url: string; path?: string; size: number }> {
  if (CLOUD_ON) {
    const up = await cloud.uploadAttachment(tenant, folder, blob, name);
    return { url: `${ATTACH_PREFIX}${up.path}`, path: up.path, size: blob.size };
  }
  const url = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
  return { url, size: blob.size };
}

/** Ảnh ở kho riêng tư: tải có xác thực rồi hiện bằng đường dẫn tạm */
export function AttachImg({ item, className, alt }: { item: { url: string; path?: string }; className?: string; alt: string }) {
  const p = attachPath(item);
  const [src, setSrc] = useState<string | null>(p ? null : item.url);
  useEffect(() => {
    if (!p || !CLOUD_ON) return;
    let href = ''; let live = true;
    cloud.attachmentBlob(p).then((b) => { href = URL.createObjectURL(b); if (live) setSrc(href); }).catch(() => undefined);
    return () => { live = false; if (href) URL.revokeObjectURL(href); };
  }, [p]);
  return src ? <img src={src} alt={alt} className={className} /> : <span className={cn('flex items-center justify-center bg-[rgb(var(--ink)/0.05)] text-[11px] text-[rgb(var(--muted))]', className)}>{p && !CLOUD_ON ? 'Ảnh trên máy chủ' : '…'}</span>;
}

// ---------------- Khoảng thời gian ----------------
export function RangeInput({ d, v, set, disabled }: { d: CfDef; v: CfVal | undefined; set: (v: CfVal | undefined) => void; disabled?: boolean }) {
  const r0 = rangeParse(v);
  const [from, setFrom] = useState(r0?.from ?? '');
  const [to, setTo] = useState(r0?.to ?? '');
  useEffect(() => { const r = rangeParse(v); setFrom(r?.from ?? ''); setTo(r?.to ?? ''); }, [v]);
  const push = (f: string, t: string) => { setFrom(f); setTo(t); set(f && t ? rangeStr({ from: f, to: t }) : undefined); };
  const r = from && to ? { from, to } : null;
  const issue = from || to ? rangeIssue(r) : '';
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        <input type="datetime-local" className={inputCls} value={from} disabled={disabled} aria-label={`${d.label}: bắt đầu`} onChange={(e) => push(e.target.value, to && e.target.value && to <= e.target.value ? '' : to)} />
        <input type="datetime-local" className={inputCls} value={to} min={from || undefined} disabled={disabled} aria-label={`${d.label}: kết thúc`} onChange={(e) => push(from, e.target.value)} />
      </div>
      <p className={cn('text-[12px] tabular-nums', issue ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')} data-range-duration>{issue || (r ? `Thời lượng ${rangeDuration(r)}` : 'Chọn bắt đầu và kết thúc')}</p>
    </div>
  );
}

// ---------------- Chọn tài nguyên ----------------
/** Bản ghi cùng đối tượng để kiểm tra trùng lịch (đơn bán đã hủy không tính) */
function useCfRecords(d: CfDef) {
  const { salesOrders, customers, leads } = useApp();
  return useMemo(() => (d.entity === 'sale' ? salesOrders.map((o) => ({ id: o.id, code: o.code, cf: o.cf, cancelled: o.status === 'CANCELLED' }))
    : d.entity === 'customer' ? customers.map((c) => ({ id: c.id, code: c.name, cf: c.cf })) : d.entity === 'lead' ? leads.map((l) => ({ id: l.id, code: l.company, cf: l.cf })) : []), [d.entity, salesOrders, customers, leads]);
}

export function ResourcePicker({ d, v, set, disabled, ctx }: { d: CfDef; v: CfVal | undefined; set: (v: CfVal | undefined) => void; disabled?: boolean; ctx?: CfCtx }) {
  const { resources } = useApp();
  const recs = useCfRecords(d);
  const list = resources.filter((r) => (!d.resourceKind || r.kind === d.resourceKind) && (r.active || r.id === v));
  const range = d.rangeKey ? rangeParse(ctx?.vals?.[d.rangeKey]) : null;
  const busy = (id: string) => (range && d.rangeKey ? checkResourceAvailability(recs, { selfId: ctx?.recordId, resKey: d.key, rangeKey: d.rangeKey, resId: id, range }) : []);
  const hit = typeof v === 'string' && v ? busy(v) : [];
  return (
    <div className="space-y-1">
      <select className={inputCls} value={String(v ?? '')} disabled={disabled} onChange={(e) => set(e.target.value || undefined)} aria-label={d.label}>
        <option value="">{list.length ? '—' : 'Chưa có tài nguyên (Cài đặt > Tài nguyên)'}</option>
        {list.map((r) => { const b = busy(r.id).length > 0; return <option key={r.id} value={r.id}>{r.name}{r.code ? ` (${r.code})` : ''}{b ? ' · trùng lịch' : !r.active ? ' · ngừng dùng' : ''}</option>; })}
      </select>
      {hit.length > 0 && <p className="flex items-start gap-1 text-[12px] text-[rgb(var(--danger-fg))]" role="alert"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Đã có lịch {rangeText(hit[0].range)} ở {hit.map((h) => h.code).join(', ')}</p>}
      {!hit.length && d.rangeKey && !range && <p className="text-[12px] text-[rgb(var(--muted))]">Chọn thời gian để kiểm tra trùng lịch</p>}
    </div>
  );
}

// ---------------- Danh sách công đoạn ----------------
export function ChecklistInput({ d, v, set, disabled }: { d: CfDef; v: CfVal | undefined; set: (v: CfVal | undefined) => void; disabled?: boolean }) {
  const steps = d.options ?? [];
  const done = checklistDone(v);
  const tog = (s: string, on: boolean) => { const n = on ? [...new Set([...done, s])] : done.filter((x) => x !== s); set(n.length ? JSON.stringify(steps.filter((x) => n.includes(x))) : undefined); };
  return (
    <div className="rounded-lg border border-[rgb(var(--line))] px-3 py-2" role="group" aria-label={d.label}>
      <ChecklistBar done={done.filter((x) => steps.includes(x)).length} total={steps.length} />
      <ul className="mt-1.5 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {steps.map((s) => <li key={s}><label className="flex items-center gap-2 py-1 text-[13.5px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={done.includes(s)} disabled={disabled} onChange={(e) => tog(s, e.target.checked)} /><span className={cn(done.includes(s) && 'text-[rgb(var(--muted))] line-through')}>{s}</span></label></li>)}
        {!steps.length && <li className="py-1 text-[12.5px] text-[rgb(var(--muted))]">3A chưa khai báo công đoạn</li>}
      </ul>
    </div>
  );
}
export function ChecklistBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2" aria-label={`Hoàn thành ${done}/${total} công đoạn`}>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><div className="h-full rounded-full bg-[rgb(var(--success))]" style={{ width: `${pct}%` }} /></div>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-[rgb(var(--fg2))]">{done}/{total}</span>
    </div>
  );
}

// ---------------- Bộ ảnh ----------------
export function MediaInput({ d, v, set, disabled, ctx }: { d: CfDef; v: CfVal | undefined; set: (v: CfVal | undefined) => void; disabled?: boolean; ctx?: CfCtx }) {
  const { org, me, notify } = useApp();
  const items = mediaOf(v);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const add = async (fl: FileList | null) => {
    if (!fl?.length) return;
    const room = 12 - items.length;
    if (room <= 0) { notify(`${d.label}: tối đa 12 ảnh`, 'orange'); return; }
    setBusy(true);
    try {
      const out: MediaItem[] = [];
      for (const f of Array.from(fl).slice(0, room)) {
        if (!f.type.startsWith('image/')) { notify(`${f.name} không phải ảnh`, 'orange'); continue; }
        const blob = await (await fetch(await compressImage(f, CLOUD_ON ? 1600 : 900))).blob();
        const up = await uploadCfImage(org.id, `cf/${d.entity}/${ctx?.recordId ?? 'new'}/${d.key}`, blob, '');
        out.push({ name: f.name, ...up, at: Date.now(), by: me?.id });
      }
      if (out.length) set(JSON.stringify([...items, ...out]));
    } catch (e) { notify(e instanceof CloudError ? cloudMessage(e) : 'Không tải được ảnh', 'red'); } finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };
  const del = (i: number) => { const n = items.filter((_, j) => j !== i); set(n.length ? JSON.stringify(n) : undefined); };
  return (
    <div className="space-y-2" aria-label={d.label} role="group">
      <MediaGrid items={items} onDel={disabled ? undefined : del} />
      {!disabled && <>
        <input ref={ref} type="file" accept="image/*" multiple className="hidden" aria-label={`Thêm ảnh ${d.label}`} onChange={(e) => void add(e.target.files)} />
        <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-[rgb(var(--line))] px-3 text-[13px] text-[rgb(var(--fg2))] hover:border-[rgb(var(--ink)/0.3)] disabled:opacity-60" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}{busy ? 'Đang tải ảnh' : 'Thêm ảnh'}
        </button>
      </>}
    </div>
  );
}
export function MediaGrid({ items, onDel }: { items: MediaItem[]; onDel?: (i: number) => void }) {
  if (!items.length) return onDel ? null : <span className="text-[rgb(var(--muted))]">—</span>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((m, i) => (
        <li key={`${m.url}-${i}`} className="relative">
          <button type="button" className="block overflow-hidden rounded-lg border border-[rgb(var(--line))]" onClick={() => void openAttachment(m)} aria-label={`Xem ảnh ${m.name}`}><AttachImg item={m} alt={m.name} className="h-16 w-16 object-cover" /></button>
          {onDel && <button type="button" className="absolute -right-1.5 -top-1.5 rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => onDel(i)} aria-label={`Bỏ ảnh ${m.name}`}><X className="h-3 w-3" aria-hidden /></button>}
        </li>
      ))}
    </ul>
  );
}

// ---------------- Chữ ký ----------------
export function SignatureInput({ d, v, set, disabled, ctx }: { d: CfDef; v: CfVal | undefined; set: (v: CfVal | undefined) => void; disabled?: boolean; ctx?: CfCtx }) {
  const { org, me, notify } = useApp();
  const sig = signatureOf(v);
  const cv = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [inked, setInked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [redo, setRedo] = useState(false);
  const pt = (e: RPointerEvent<HTMLCanvasElement>) => { const c = e.currentTarget; const r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height] as const; };
  const down = (e: RPointerEvent<HTMLCanvasElement>) => { const g = e.currentTarget.getContext('2d'); if (!g) return; e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; const [x, y] = pt(e); g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1b2433'; g.beginPath(); g.moveTo(x, y); };
  const move = (e: RPointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const g = e.currentTarget.getContext('2d'); if (!g) return; const [x, y] = pt(e); g.lineTo(x, y); g.stroke(); setInked(true); };
  const clear = () => { const c = cv.current; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); setInked(false); };
  const confirm = async () => {
    const c = cv.current; if (!c || !inked) return;
    setBusy(true);
    try {
      const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Không lưu được chữ ký'))), 'image/png'));
      const sha256 = await sha256Hex(blob);
      const up = await uploadCfImage(org.id, `cf/${d.entity}/${ctx?.recordId ?? 'new'}/${d.key}`, blob, 'chu-ky.png');
      const val: SignatureVal = { url: up.url, path: up.path, sha256, at: Date.now(), by: me?.id, name: me?.name };
      set(JSON.stringify(val)); setRedo(false); clear();
    } catch (e) { notify(e instanceof CloudError ? cloudMessage(e) : 'Không lưu được chữ ký', 'red'); } finally { setBusy(false); }
  };
  if (sig && !redo) return (
    <div className="flex flex-wrap items-end gap-3">
      <SignatureView s={sig} />
      {!disabled && <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] px-2.5 text-[12.5px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]" onClick={() => setRedo(true)}><PenLine className="h-3.5 w-3.5" aria-hidden />Ký lại</button>}
    </div>
  );
  if (disabled) return <span className="text-[rgb(var(--muted))]">Chưa ký</span>;
  return (
    <div className="space-y-1.5">
      {/* nền giấy trắng cố định: chữ ký là chứng từ, giữ nguyên nét mực ở cả chế độ sáng / tối */}
      <canvas ref={cv} width={640} height={200} className="h-[120px] w-full max-w-[420px] touch-none rounded-lg border border-dashed border-[rgb(var(--line))] bg-[rgb(var(--sig-paper,255_255_255))]" aria-label={`Ký vào ${d.label}`}
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }} />
      <div className="flex items-center gap-2">
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[rgb(var(--fg))] px-3 text-[12.5px] text-[rgb(var(--surface))] disabled:opacity-50" disabled={!inked || busy} onClick={() => void confirm()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}Xác nhận chữ ký</button>
        <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] px-2.5 text-[12.5px] text-[rgb(var(--fg2))]" disabled={!inked || busy} onClick={clear}><RotateCcw className="h-3.5 w-3.5" aria-hidden />Xóa nét</button>
        {redo && <button type="button" className="text-[12.5px] text-[rgb(var(--muted))] underline" onClick={() => setRedo(false)}>Giữ chữ ký cũ</button>}
      </div>
    </div>
  );
}
export function SignatureView({ s }: { s: SignatureVal }) {
  return (
    <figure className="space-y-1" data-signature>
      <AttachImg item={s} alt="Chữ ký" className="h-16 w-auto max-w-[220px] rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--sig-paper,255_255_255))] object-contain" />
      <figcaption className="text-[11.5px] text-[rgb(var(--muted))]">{s.name ? `${s.name} · ` : ''}{fmtDT(new Date(s.at).toISOString())} · <span className="font-mono" title={`SHA-256 ${s.sha256}`}>SHA-256 {s.sha256.slice(0, 12)}…</span></figcaption>
    </figure>
  );
}

// ---------------- Công thức ----------------
export function FormulaView({ d, v }: { d: CfDef; v: CfVal | undefined }) {
  const n = typeof v === 'number' ? v : null;
  return <input className={cn(inputCls, 'text-right font-mono tabular-nums')} disabled readOnly value={n === null ? '—' : `${fmtN(n)}${d.unit ? ` ${d.unit}` : ''}`} aria-label={d.label} title={d.formula ? `= ${d.formula}` : undefined} />;
}

/** Ô hiển thị giàu (khối Chi tiết bản ghi) của kiểu chuyên ngành; null = dùng chữ thường */
export function CfRichView({ d, v }: { d: CfDef; v: CfVal | undefined }) {
  if (d.type === 'media_gallery') return <MediaGrid items={mediaOf(v)} />;
  if (d.type === 'signature') { const s = signatureOf(v); return s ? <SignatureView s={s} /> : <span className="text-[rgb(var(--muted))]">Chưa ký</span>; }
  if (d.type === 'checklist') { const steps = d.options ?? []; const done = checklistDone(v).filter((x) => steps.includes(x)); return <div className="w-full max-w-[360px]" title={done.join(', ')}><ChecklistBar done={done.length} total={steps.length} /></div>; }
  return null;
}
export const CF_RICH: CfDef['type'][] = ['media_gallery', 'signature', 'checklist'];
