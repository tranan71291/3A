'use client';

// v57b 3A Studio — cấu hình Khung linh hoạt / Khung tự do: danh sách phần tử con, gắn dữ liệu {{…}},
// cách xếp (khung linh hoạt), khổ thiết kế + bảng trượt sắp xếp có hít lưới 8px, đường gióng và neo cạnh (khung tự do).
import { type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Braces, ChevronDown, ChevronRight, Image as ImageIcon, Minus, MousePointerClick, Move, Plus, Tag, Trash2, Type } from 'lucide-react';
import { Drawer } from '../../components/drawer';
import { Field } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, inputCls, L_ACT, L_TOKS, L_TONE, L_VAR_KEYS, LPageC, MODULE_LABEL, uid } from '../../lib/core';
import type { CfDef, LBlock, LBlockCfg, LBtnAct, LElem, LFlex, LPage, LPageCtx, LTok, Module } from '../../lib/types';
import { cn } from '../../lib/utils';
import { CbSeg } from '../finance/cashbook';
import { L_CANVAS_DEF, L_ELEM_KIND, L_ELEM_MAX, L_FLEX_DEF, lBindKeys, lBindRefs, LElemView, lPinCss, lSnapBox, type LBox } from '../page-builder';

const KIND_ICON: Record<LElem['kind'], typeof Type> = { text: Type, badge: Tag, button: MousePointerClick, image: ImageIcon, divider: Minus };

function Grp({ label, children }: { label: string; children: ReactNode }) {
  return <div role="group" aria-label={label}><span className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{label}</span>{children}</div>;
}

/** Phần tử mới: khung tự do đặt dưới phần tử thấp nhất (hít lưới 8px) */
function newElem(kind: LElem['kind'], els: LElem[], free: boolean, cv: { w: number; h: number }): LElem {
  const base: LElem = { id: uid('el'), kind, text: kind === 'text' ? 'Chữ mới' : kind === 'badge' ? 'Nhãn' : kind === 'button' ? 'Nút' : kind === 'image' ? '' : undefined };
  if (kind === 'button') { base.act = 'back'; base.btn = 'ghost'; }
  if (!free) return kind === 'divider' ? base : { ...base, ...(kind === 'text' ? { size: 'md' as const } : {}) };
  const size: Record<LElem['kind'], [number, number]> = { text: [240, 24], badge: [120, 24], button: [120, 32], image: [160, 96], divider: [cv.w - 32, 8] };
  const [w, h] = size[kind];
  const bottom = els.reduce((m, e) => Math.max(m, (e.box?.y ?? 0) + (e.box?.h ?? 0)), 0);
  const y = Math.min(Math.ceil((bottom + 8) / 8) * 8, Math.max(0, cv.h - h));
  return { ...base, box: { x: 16, y, w: Math.min(w, cv.w - 16), h }, pin: { h: kind === 'divider' ? 'stretch' : 'left', v: 'top' } };
}

/** Ô chữ có chèn biến trang {…} và gắn dữ liệu {{…}} */
function BindText({ label, value, onChange, page, cf }: { label: string; value: string; onChange: (v: string) => void; page: LPage; cf: CfDef[] }) {
  const [open, setOpen] = useState(false);
  const keys = lBindKeys(page, cf);
  const vars = L_VAR_KEYS[page] ?? [];
  const known = new Set(keys.map((k) => k.key));
  const bad = lBindRefs(value).filter((k) => !known.has(k));
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <input className={cn(inputCls, 'flex-1')} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <button type="button" className={cn(btnGhost, btnSm, 'h-9 shrink-0 font-mono')} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Gắn dữ liệu" title="Gắn dữ liệu"><Braces className="h-3.5 w-3.5" aria-hidden /></button>
      </div>
      {open && (
        <div className="mt-1.5 space-y-1.5 rounded-lg border border-[rgb(var(--line))] p-2" data-bind-picker>
          {keys.length ? <div className="flex flex-wrap gap-1">{keys.map((k) => <button key={k.key} type="button" className="rounded border border-[rgb(var(--line))] px-1.5 py-0.5 text-[11.5px] hover:bg-[rgb(var(--ink)/0.05)]" title={`{{${k.key}}}`} onClick={() => onChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}{{${k.key}}}`)}>{k.label}</button>)}</div>
            : <p className="text-[12px] text-[rgb(var(--muted))]">Trang này không có đơn để gắn dữ liệu. Dùng biến trang bên dưới</p>}
          {vars.length > 0 && <div className="flex flex-wrap gap-1 border-t border-[rgb(var(--line))] pt-1.5">{vars.map((k) => <button key={k} type="button" className="rounded px-1.5 py-0.5 font-mono text-[11.5px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => onChange(`${value}${value && !value.endsWith(' ') ? ' ' : ''}{${k}}`)}>{`{${k}}`}</button>)}</div>}
        </div>
      )}
      {bad.length > 0 && <p className="mt-1 text-[12px] text-[rgb(var(--danger-fg))]" data-bind-bad>Không có trường gắn: {bad.map((k) => `{{${k}}}`).join(', ')}</p>}
    </div>
  );
}

/** Thuộc tính một phần tử. free: thêm vị trí và neo cạnh (Khung tự do) */
export function ElemProps({ e, set, page, cf, free, cv }: { e: LElem; set: (p: Partial<LElem>) => void; page: LPage; cf: CfDef[]; free?: boolean; cv?: { w: number; h: number } }) {
  const acts = (Object.keys(L_ACT) as LBtnAct[]).filter((a) => a !== 'menu' && L_ACT[a].pages.includes(page));
  const box = e.box ?? { x: 0, y: 0, w: 120, h: 24 };
  const num = (k: keyof LBox, label: string) => (
    <Field label={label}><input className={inputCls} type="number" step={8} value={box[k]} aria-label={label} onChange={(ev) => {
      const v = Math.round(Number(ev.target.value) || 0);
      const c = cv ?? L_CANVAS_DEF;
      const nb = { ...box, [k]: v };
      nb.w = Math.max(16, Math.min(nb.w, c.w)); nb.h = Math.max(8, Math.min(nb.h, c.h)); nb.x = Math.max(0, Math.min(nb.x, c.w - nb.w)); nb.y = Math.max(0, Math.min(nb.y, c.h - nb.h));
      set({ box: nb });
    }} /></Field>
  );
  return (
    <div className="space-y-3" data-elem-props={e.id}>
      {e.kind !== 'divider' && <Field label={e.kind === 'image' ? 'Mô tả ảnh' : 'Nội dung'}><BindText label={e.kind === 'image' ? 'Mô tả ảnh' : 'Nội dung phần tử'} value={e.text ?? ''} onChange={(v) => set({ text: v })} page={page} cf={cf} /></Field>}
      {e.kind === 'image' && <Field label="Địa chỉ ảnh (https://…)"><input className={inputCls} value={e.url ?? ''} onChange={(ev) => set({ url: ev.target.value.trim() || undefined })} placeholder="https://" aria-label="Địa chỉ ảnh" /></Field>}
      {e.kind === 'text' && <>
        <Grp label="Cỡ chữ"><CbSeg label="Cỡ chữ" items={[['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn'], ['xl', 'Rất lớn']]} value={e.size ?? 'md'} onChange={(v) => set({ size: v })} /></Grp>
        <Grp label="Độ đậm"><CbSeg label="Độ đậm" items={[['normal', 'Thường'], ['medium', 'Vừa'], ['bold', 'Đậm']]} value={e.weight ?? 'normal'} onChange={(v) => set({ weight: v })} /></Grp>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={!!e.mono} onChange={(ev) => set({ mono: ev.target.checked || undefined })} />Chữ số đều (tiền, mã)</label>
      </>}
      {e.kind !== 'divider' && e.kind !== 'image' && <Grp label="Căn"><CbSeg label="Căn phần tử" items={[['left', 'Trái'], ['center', 'Giữa'], ['right', 'Phải']]} value={e.align ?? 'left'} onChange={(v) => set({ align: v === 'left' ? undefined : v })} /></Grp>}
      {e.kind === 'button' && <>
        <Field label="Hành động"><select className={inputCls} aria-label="Hành động nút" value={e.act ?? 'back'} onChange={(ev) => set({ act: ev.target.value as LBtnAct, arg: undefined })}>{acts.map((a) => <option key={a} value={a}>{L_ACT[a].label}</option>)}</select></Field>
        {L_ACT[e.act ?? 'back']?.arg === 'module' && <Field label="Trang mở"><select className={inputCls} aria-label="Trang mở" value={e.arg ?? ''} onChange={(ev) => set({ arg: ev.target.value || undefined })}><option value="">Chọn trang</option>{(Object.keys(MODULE_LABEL) as Module[]).map((m) => <option key={m} value={m}>{MODULE_LABEL[m]}</option>)}</select></Field>}
        {L_ACT[e.act ?? 'back']?.arg === 'url' && <Field label="Liên kết (https://…)"><input className={inputCls} value={e.arg ?? ''} onChange={(ev) => set({ arg: ev.target.value.trim() || undefined })} placeholder="https://" aria-label="Liên kết" /></Field>}
        <Grp label="Kiểu nút"><CbSeg label="Kiểu nút" items={[['primary', 'Chính'], ['ghost', 'Viền'], ['text', 'Chữ']]} value={e.btn ?? 'primary'} onChange={(v) => set({ btn: v })} /></Grp>
      </>}
      {e.kind !== 'image' && <Field label="Màu"><select className={inputCls} aria-label="Màu phần tử" value={e.tone ?? ''} onChange={(ev) => set({ tone: ev.target.value || undefined })}><option value="">Mặc định</option>{Object.entries(L_TONE).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select></Field>}
      {!free && e.kind !== 'divider' && <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={!!e.grow} onChange={(ev) => set({ grow: ev.target.checked || undefined })} />Giãn chiếm chỗ trống</label>}
      {free && <>
        <div className="grid grid-cols-4 gap-2">{num('x', 'X')}{num('y', 'Y')}{num('w', 'Rộng')}{num('h', 'Cao')}</div>
        <Grp label="Neo ngang khi khung co giãn"><CbSeg label="Neo ngang" items={[['left', 'Trái'], ['right', 'Phải'], ['center', 'Giữa'], ['stretch', 'Giãn 2 bên']]} value={e.pin?.h ?? 'left'} onChange={(v) => set({ pin: { h: v, v: e.pin?.v ?? 'top' } })} /></Grp>
        <Grp label="Neo dọc"><CbSeg label="Neo dọc" items={[['top', 'Trên'], ['bottom', 'Dưới'], ['center', 'Giữa'], ['stretch', 'Giãn 2 đầu']]} value={e.pin?.v ?? 'top'} onChange={(v) => set({ pin: { h: e.pin?.h ?? 'left', v } })} /></Grp>
      </>}
    </div>
  );
}

/** Danh sách phần tử: thêm, sắp thứ tự, sửa, xóa */
function ElemList({ els, onChange, page, cf, free, cv, open, setOpen }: { els: LElem[]; onChange: (n: LElem[]) => void; page: LPage; cf: CfDef[]; free: boolean; cv: { w: number; h: number }; open: string | null; setOpen: (id: string | null) => void }) {
  const mv = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= els.length) return; const n = [...els]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  const set = (id: string, p: Partial<LElem>) => onChange(els.map((x) => (x.id === id ? { ...x, ...p } : x)));
  return (
    <Grp label={`Phần tử (${els.length}/${L_ELEM_MAX})`}>
      <ul className="divide-y divide-[rgb(var(--line))] rounded-lg border border-[rgb(var(--line))]" data-elem-list>
        {els.map((e, i) => { const I = KIND_ICON[e.kind]; const on = open === e.id; return (
          <li key={e.id} data-elem-row={e.id}>
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px]" onClick={() => setOpen(on ? null : e.id)} aria-expanded={on} aria-label={`Sửa ${L_ELEM_KIND[e.kind]} ${e.text ?? ''}`.trim()}>
                {on ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--muted))]" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--muted))]" aria-hidden />}
                <I className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
                <span className="min-w-0 truncate">{e.kind === 'divider' ? 'Đường kẻ' : e.kind === 'image' ? (e.url ? 'Ảnh' : 'Ảnh (chưa có địa chỉ)') : e.text || L_ELEM_KIND[e.kind]}</span>
              </button>
              {!free && <><button type="button" className="rounded p-1 hover:bg-[rgb(var(--ink)/0.06)] disabled:opacity-30" disabled={i === 0} onClick={() => mv(i, -1)} aria-label="Đưa lên"><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
                <button type="button" className="rounded p-1 hover:bg-[rgb(var(--ink)/0.06)] disabled:opacity-30" disabled={i === els.length - 1} onClick={() => mv(i, 1)} aria-label="Đưa xuống"><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button></>}
              <button type="button" className="rounded p-1 hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--danger-fg))]" onClick={() => { onChange(els.filter((x) => x.id !== e.id)); if (on) setOpen(null); }} aria-label="Xóa phần tử"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
            {on && <div className="border-t border-[rgb(var(--line))] px-3 py-3"><ElemProps e={e} set={(p) => set(e.id, p)} page={page} cf={cf} free={free} cv={cv} /></div>}
          </li>
        ); })}
        {!els.length && <li className="px-3 py-3 text-[12.5px] text-[rgb(var(--muted))]">Chưa có phần tử</li>}
      </ul>
      <div className="mt-2 flex flex-wrap gap-1.5">{(Object.keys(L_ELEM_KIND) as LElem['kind'][]).map((k) => { const I = KIND_ICON[k]; return <button key={k} type="button" className={cn(btnGhost, btnSm, 'gap-1')} disabled={els.length >= L_ELEM_MAX} onClick={() => { const n = newElem(k, els, free, cv); onChange([...els, n]); setOpen(n.id); }}><Plus className="h-3 w-3" aria-hidden /><I className="h-3.5 w-3.5" aria-hidden />{L_ELEM_KIND[k]}</button>; })}</div>
    </Grp>
  );
}

/** Cấu hình Khung linh hoạt / Khung tự do trong nhóm "Nội dung" của Cài đặt khối */
export function LContainerCfg({ b, onCfg, page, cf, dctx }: { b: LBlock; onCfg: (c: Partial<LBlockCfg>) => void; page: LPage; cf: CfDef[]; dctx: LPageCtx }) {
  const c = b.config;
  const free = b.type === 'K-FreeformBox';
  const els = c.elems ?? [];
  const cv = { ...L_CANVAS_DEF, ...c.canvas };
  const [open, setOpen] = useState<string | null>(null);
  const [arrange, setArrange] = useState(false);
  if (b.type !== 'K-FlexContainer' && !free) return null;
  const f = { ...L_FLEX_DEF, ...c.flex };
  const setF = (p: Partial<LFlex>) => onCfg({ flex: { ...f, ...p } });
  return (
    <div className="space-y-4" data-container-cfg={b.type}>
      {!free ? <>
        <Grp label="Cách xếp"><CbSeg label="Cách xếp" items={[['row', 'Hàng ngang'], ['col', 'Cột dọc']]} value={f.dir} onChange={(v) => setF({ dir: v })} /></Grp>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Khoảng cách"><select className={inputCls} aria-label="Khoảng cách phần tử" value={f.gap} onChange={(e) => setF({ gap: Number(e.target.value) as LTok })}>{L_TOKS.map((t) => <option key={t} value={t}>{t} px</option>)}</select></Field>
          <Field label={f.dir === 'row' ? 'Căn dọc' : 'Căn ngang'}><select className={inputCls} aria-label="Căn phần tử" value={f.align} onChange={(e) => setF({ align: e.target.value as LFlex['align'] })}>{([['start', 'Đầu'], ['center', 'Giữa'], ['end', 'Cuối'], ['stretch', 'Giãn đủ']] as const).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
        <Grp label="Phân bố"><CbSeg label="Phân bố" items={[['start', 'Đầu'], ['center', 'Giữa'], ['end', 'Cuối'], ['between', 'Dàn đều']]} value={f.justify} onChange={(v) => setF({ justify: v })} /></Grp>
        {f.dir === 'row' && <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={!!f.wrap} onChange={(e) => setF({ wrap: e.target.checked })} />Xuống dòng khi hết chỗ</label>}
      </> : <>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Khổ thiết kế · rộng"><input className={inputCls} type="number" min={240} max={1440} step={8} value={cv.w} aria-label="Khổ rộng" onChange={(e) => onCfg({ canvas: { ...cv, w: Math.max(240, Math.min(1440, Math.round(Number(e.target.value) || 0))) } })} /></Field>
          <Field label="Cao"><input className={inputCls} type="number" min={40} max={800} step={8} value={cv.h} aria-label="Khổ cao" onChange={(e) => onCfg({ canvas: { ...cv, h: Math.max(40, Math.min(800, Math.round(Number(e.target.value) || 0))) } })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={cv.snap !== false} onChange={(e) => onCfg({ canvas: { ...cv, snap: e.target.checked } })} />Hít lưới 8px khi kéo</label>
        <button type="button" className={cn(btnPrimary, 'w-full justify-center')} onClick={() => setArrange(true)}><Move className="h-4 w-4" aria-hidden />Sắp xếp trên khung</button>
        <p className="text-[12px] text-[rgb(var(--muted))]">Khung hẹp hơn 60% khổ thiết kế (điện thoại) tự xếp phần tử thành cột, theo thứ tự trên xuống</p>
      </>}
      <ElemList els={els} onChange={(n) => onCfg({ elems: n })} page={page} cf={cf} free={free} cv={cv} open={open} setOpen={setOpen} />
      {arrange && free && <FreeformArrange b={b} onCfg={onCfg} page={page} cf={cf} dctx={dctx} onClose={() => setArrange(false)} />}
    </div>
  );
}

/** Bảng trượt sắp xếp Khung tự do: kéo / đổi cỡ phần tử, hít lưới 8px, đường gióng với mép / tâm khung và phần tử khác, phím mũi tên dịch 1px (Shift 8px) */
function FreeformArrange({ b, onCfg, page, cf, dctx, onClose }: { b: LBlock; onCfg: (c: Partial<LBlockCfg>) => void; page: LPage; cf: CfDef[]; dctx: LPageCtx; onClose: () => void }) {
  const c = b.config;
  const cv = { ...L_CANVAS_DEF, ...c.canvas };
  const [els, setEls] = useState<LElem[]>(c.elems ?? []);
  const dragging = useRef(false);
  const elsRef = useRef(els);
  elsRef.current = els;
  useEffect(() => { if (!dragging.current) setEls(c.elems ?? []); }, [c.elems]);
  const [sel, setSel] = useState<string | null>(els[0]?.id ?? null);
  const [guides, setGuides] = useState<{ gx: number[]; gy: number[] }>({ gx: [], gy: [] });
  const wrapRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(620);
  useEffect(() => { const el = wrapRef.current; if (!el) return; const ro = new ResizeObserver(() => setAvail(el.clientWidth)); ro.observe(el); setAvail(el.clientWidth); return () => ro.disconnect(); }, []);
  const k = Math.min(1, avail / cv.w);
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; sx: number; sy: number; b0: LBox } | null>(null);
  const save = (n: LElem[]) => { setEls(n); onCfg({ elems: n }); };
  const boxOf = (e: LElem): LBox => e.box ?? { x: 0, y: 0, w: 120, h: 24 };
  const down = (ev: RPointerEvent, e: LElem, mode: 'move' | 'resize') => {
    ev.stopPropagation(); ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    drag.current = { id: e.id, mode, sx: ev.clientX, sy: ev.clientY, b0: boxOf(e) }; dragging.current = true; setSel(e.id);
  };
  const move = (ev: RPointerEvent) => {
    const d = drag.current; if (!d) return;
    const dx = (ev.clientX - d.sx) / k, dy = (ev.clientY - d.sy) / k;
    const nb = d.mode === 'move' ? { ...d.b0, x: d.b0.x + dx, y: d.b0.y + dy } : { ...d.b0, w: d.b0.w + dx, h: d.b0.h + dy };
    const r = lSnapBox(nb, els.filter((x) => x.id !== d.id).map(boxOf), cv, { snap: cv.snap !== false, th: Math.max(3, 6 / k), resize: d.mode === 'resize' });
    setGuides({ gx: r.gx, gy: r.gy });
    setEls((xs) => xs.map((x) => (x.id === d.id ? { ...x, box: r.box } : x)));
  };
  const up = () => { if (!drag.current) return; drag.current = null; dragging.current = false; setGuides({ gx: [], gy: [] }); onCfg({ elems: elsRef.current }); };
  const key = (ev: RKeyboardEvent, e: LElem) => {
    const st = ev.shiftKey ? 8 : 1;
    const dd: Record<string, [number, number]> = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] };
    const m = dd[ev.key]; if (!m) return;
    ev.preventDefault();
    const bx = boxOf(e);
    const nb = { ...bx, x: Math.max(0, Math.min(cv.w - bx.w, bx.x + m[0])), y: Math.max(0, Math.min(cv.h - bx.h, bx.y + m[1])) };
    save(els.map((x) => (x.id === e.id ? { ...x, box: nb } : x)));
  };
  const cur = els.find((x) => x.id === sel);
  return (
    <Drawer title={`Sắp xếp ${c.title || 'Khung tự do'}`} eyebrow="Khung tự do" onClose={onClose}
      footer={<div className="flex items-center justify-between gap-3"><p className="text-[12px] text-[rgb(var(--muted))]">Kéo để di chuyển, kéo góc dưới phải để đổi cỡ. Mũi tên dịch 1px, Shift + mũi tên 8px</p><button type="button" className={cn(btnPrimary)} onClick={onClose}>Xong</button></div>}>
      <div className="flex flex-wrap gap-1.5">{(Object.keys(L_ELEM_KIND) as LElem['kind'][]).map((kd) => { const I = KIND_ICON[kd]; return <button key={kd} type="button" className={cn(btnGhost, btnSm, 'gap-1')} disabled={els.length >= L_ELEM_MAX} onClick={() => { const n = newElem(kd, els, true, cv); save([...els, n]); setSel(n.id); }}><Plus className="h-3 w-3" aria-hidden /><I className="h-3.5 w-3.5" aria-hidden />{L_ELEM_KIND[kd]}</button>; })}</div>
      <div ref={wrapRef} className="w-full">
        <p className="mb-1.5 text-[12px] tabular-nums text-[rgb(var(--muted))]">Khổ {cv.w} × {cv.h} px{k < 1 ? ` · thu nhỏ ${Math.round(k * 100)}%` : ''}</p>
        <LPageC.Provider value={dctx}>
          <div className="relative overflow-hidden rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))]" style={{ width: cv.w * k, height: cv.h * k, ...(cv.snap !== false ? { backgroundImage: 'radial-gradient(rgb(var(--ink) / 0.14) 1px, transparent 1px)', backgroundSize: `${8 * k}px ${8 * k}px` } : {}) }}
            data-free-canvas onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerDown={() => setSel(null)}>
            <div className="absolute left-0 top-0 origin-top-left" style={{ width: cv.w, height: cv.h, transform: `scale(${k})` }}>
              {els.map((e) => { const on = sel === e.id; return (
                <div key={e.id} role="button" tabIndex={0} aria-pressed={on} aria-label={`${L_ELEM_KIND[e.kind]} ${e.text ?? ''}`.trim()} data-canvas-elem={e.id}
                  className={cn('absolute flex cursor-move touch-none select-none overflow-hidden rounded-sm outline-none', e.kind === 'text' ? 'items-start' : 'items-center', on ? 'ring-2 ring-[rgb(var(--accent))]' : 'ring-1 ring-[rgb(var(--ink)/0.12)] hover:ring-[rgb(var(--ink)/0.3)] focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]')}
                  style={lPinCss({ ...e, pin: { h: 'left', v: 'top' } }, cv)} onPointerDown={(ev) => down(ev, e, 'move')} onKeyDown={(ev) => key(ev, e)} onFocus={() => setSel(e.id)}>
                  <div className="pointer-events-none w-full"><LElemView e={e} /></div>
                  {on && <span role="presentation" className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize rounded-tl-sm bg-[rgb(var(--accent))]" onPointerDown={(ev) => down(ev, e, 'resize')} data-resize-handle />}
                </div>
              ); })}
              {guides.gx.map((g) => <span key={`x${g}`} className="pointer-events-none absolute top-0 h-full w-px bg-[rgb(var(--accent))]" style={{ left: g }} data-guide="x" />)}
              {guides.gy.map((g) => <span key={`y${g}`} className="pointer-events-none absolute left-0 h-px w-full bg-[rgb(var(--accent))]" style={{ top: g }} data-guide="y" />)}
            </div>
          </div>
        </LPageC.Provider>
      </div>
      {cur ? <div className="rounded-lg border border-[rgb(var(--line))] p-3"><p className="mb-3 text-[13px] font-medium">{L_ELEM_KIND[cur.kind]}</p><ElemProps e={cur} set={(p) => save(els.map((x) => (x.id === cur.id ? { ...x, ...p } : x)))} page={page} cf={cf} free cv={cv} /></div>
        : <p className="text-[12.5px] text-[rgb(var(--muted))]">Chọn một phần tử trên khung để sửa</p>}
    </Drawer>
  );
}
