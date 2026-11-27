'use client';

// v57b Khung linh hoạt (xếp hàng / cột) và Khung tự do (đặt theo khổ thiết kế, neo cạnh) — phần tử con có gắn dữ liệu.
// Cùng một bộ vẽ cho màn hình vận hành của doanh nghiệp và xem trước trong 3A Studio.
// Giá trị gắn ({{customer.name}}, {{order.code}}, {{order.total}}, {{cf.<mã>}}) đi ra dạng chữ thường (không qua định dạng, không chèn mã).
import { type CSSProperties, useContext, useEffect, useRef, useState } from 'react';
import { btnGhost, btnPrimary, cfSample, fmtDate, fmtN, L_ACT, lFill, LPageC, todayISO } from '../../lib/core';
import { saleTotals } from '../../lib/getfly';
import type { CfDef, LBlock, LBlockCfg, LBtn, LElem, LFlex, LPage, SalesOrder } from '../../lib/types';
import { cn } from '../../lib/utils';
import { lCol, lOnColor } from './engine';

export type LBox = { x: number; y: number; w: number; h: number };
export const L_FLEX_DEF: LFlex = { dir: 'row', gap: 12, align: 'center', justify: 'start', wrap: true };
export const L_CANVAS_DEF = { w: 720, h: 160, snap: true };
export const L_ELEM_MAX = 24;
export const L_ELEM_KIND: Record<LElem['kind'], string> = { text: 'Chữ', badge: 'Nhãn', button: 'Nút', image: 'Ảnh', divider: 'Đường kẻ' };

/** Trường gắn dữ liệu của trang đơn hàng (num: chữ số đều) */
export const L_BIND: { key: string; label: string; num?: boolean }[] = [
  { key: 'customer.name', label: 'Tên khách hàng' }, { key: 'customer.phone', label: 'Điện thoại khách', num: true },
  { key: 'customer.address', label: 'Địa chỉ khách' }, { key: 'customer.taxCode', label: 'Mã số thuế', num: true },
  { key: 'order.code', label: 'Mã đơn', num: true }, { key: 'order.date', label: 'Ngày đơn' }, { key: 'order.total', label: 'Tổng phải trả', num: true },
  { key: 'order.paid', label: 'Đã thu', num: true }, { key: 'order.left', label: 'Còn phải thu', num: true }, { key: 'order.status', label: 'Trạng thái đơn' },
  { key: 'order.seller', label: 'Người lên đơn' }, { key: 'order.deliverAt', label: 'Ngày giao' },
];

/** Trường gắn được trên trang (chỉ trang chi tiết đơn có đơn để gắn); trường tùy chỉnh đầu đơn đang dùng → cf.<mã> */
export const lBindKeys = (page: LPage, cf: CfDef[]): { key: string; label: string; num?: boolean }[] =>
  page === 'sale-detail' ? [...L_BIND, ...cf.filter((d) => d.entity === 'sale' && d.scope === 'HEAD' && d.status === 'ACTIVE').map((d) => ({ key: `cf.${d.key}`, label: d.label, num: d.type === 'money' || d.type === 'number' || d.type === 'formula' }))] : [];

const BIND_RE = /\{\{\s*((?:customer|order|cf)\.[A-Za-z0-9_-]{1,40})\s*\}\}/g;

/** Thay {{…}} bằng giá trị gắn. Thiếu giá trị: màn vận hành hiện "—", màn thiết kế giữ nguyên mã để 3A thấy chỗ chưa gắn */
export const lBindFill = (s: string, bind: Record<string, string> | undefined, live: boolean): string =>
  s.replace(BIND_RE, (m, k: string) => { const v = bind?.[k]; return v !== undefined && v !== '' ? v : live ? '—' : m; });

/** Mã trường gắn có trong chuỗi */
export const lBindRefs = (s: string): string[] => Array.from(s.matchAll(BIND_RE), (m) => m[1]);

const vnd = (n: number) => `${fmtN(Math.round(n))} ₫`;

/** Giá trị gắn của một đơn bán (màn chi tiết đơn) */
export function lBindOrder(o: SalesOrder, x: { status: string; paid: number; left: number; seller?: string; cf: Record<string, string> }): Record<string, string> {
  const t = saleTotals(o);
  const r: Record<string, string> = {
    'customer.name': o.customer, 'customer.phone': o.phone ?? '', 'customer.address': o.address ?? '', 'customer.taxCode': o.taxCode ?? '',
    'order.code': o.code, 'order.date': fmtDate(o.date), 'order.total': vnd(t.grand), 'order.paid': vnd(x.paid), 'order.left': vnd(Math.max(0, x.left)),
    'order.status': x.status, 'order.seller': x.seller ?? '', 'order.deliverAt': o.deliverAt ? fmtDate(o.deliverAt) : '',
  };
  Object.entries(x.cf).forEach(([k, v]) => { r[`cf.${k}`] = v; });
  return r;
}

/** Giá trị mẫu cho 3A Studio (đơn DH201126-02) */
export function lBindSample(cf: CfDef[]): Record<string, string> {
  const r: Record<string, string> = {
    'customer.name': 'NPP Hoàng Phát', 'customer.phone': '0903 112 245', 'customer.address': 'Lô C5, KCN Tân Bình', 'customer.taxCode': '0312 456 789',
    'order.code': 'DH201126-02', 'order.date': fmtDate(todayISO()), 'order.total': vnd(48_600_000), 'order.paid': vnd(20_000_000), 'order.left': vnd(28_600_000),
    'order.status': 'Chờ xuất kho', 'order.seller': 'Trần Quốc Bảo', 'order.deliverAt': fmtDate(todayISO()),
  };
  cf.filter((d) => d.entity === 'sale' && d.scope === 'HEAD').forEach((d) => { r[`cf.${d.key}`] = cfSample(d); });
  return r;
}

/** Vị trí phần tử trong Khung tự do theo neo cạnh: trái / phải / giữa giữ nguyên độ rộng, giãn 2 bên thì co giãn theo khung */
export function lPinCss(e: LElem, cv: { w: number; h: number }): CSSProperties {
  const b = e.box ?? { x: 0, y: 0, w: 120, h: 24 };
  const p = e.pin ?? { h: 'left', v: 'top' };
  const s: CSSProperties = {};
  const tf: string[] = [];
  if (p.h === 'right') { s.right = cv.w - b.x - b.w; s.width = b.w; }
  else if (p.h === 'stretch') { s.left = b.x; s.right = cv.w - b.x - b.w; }
  else if (p.h === 'center') { s.left = `calc(50% + ${b.x + b.w / 2 - cv.w / 2}px)`; s.width = b.w; tf.push('translateX(-50%)'); }
  else { s.left = b.x; s.width = b.w; }
  if (p.v === 'bottom') { s.bottom = cv.h - b.y - b.h; s.height = b.h; }
  else if (p.v === 'stretch') { s.top = b.y; s.bottom = cv.h - b.y - b.h; }
  else if (p.v === 'center') { s.top = `calc(50% + ${b.y + b.h / 2 - cv.h / 2}px)`; s.height = b.h; tf.push('translateY(-50%)'); }
  else { s.top = b.y; s.height = b.h; }
  if (tf.length) s.transform = tf.join(' ');
  return s;
}

/**
 * Hít lưới + đường gióng khi kéo / đổi cỡ phần tử trên khổ thiết kế.
 * Kéo: mép trái / giữa / mép phải (và trên / giữa / dưới) hít vào mép, tâm của khung và của phần tử khác trong ngưỡng th; không trúng thì hít lưới 8px.
 * Đổi cỡ: chỉ mép phải / mép dưới hít. Trả về hộp mới và vị trí các đường gióng cần vẽ.
 */
export function lSnapBox(b: LBox, others: LBox[], cv: { w: number; h: number }, o: { snap: boolean; th: number; resize?: boolean }): { box: LBox; gx: number[]; gy: number[] } {
  const axis = (pos: number, size: number, cands: number[]): [number, number, number | null] => {
    const pts = o.resize ? [pos + size] : [pos, pos + size / 2, pos + size];
    let bd = Infinity, bg: number | null = null;
    for (const p of pts) for (const g of cands) { const d = g - p; if (Math.abs(d) <= o.th && Math.abs(d) < Math.abs(bd)) { bd = d; bg = g; } }
    if (bg !== null) return o.resize ? [pos, size + bd, bg] : [pos + bd, size, bg];
    if (o.snap) return o.resize ? [pos, Math.round((pos + size) / 8) * 8 - pos, null] : [Math.round(pos / 8) * 8, size, null];
    return [Math.round(pos), Math.round(size), null];
  };
  const cx = [0, cv.w / 2, cv.w, ...others.flatMap((x) => [x.x, x.x + x.w / 2, x.x + x.w])];
  const cy = [0, cv.h / 2, cv.h, ...others.flatMap((x) => [x.y, x.y + x.h / 2, x.y + x.h])];
  let [x, w, gx] = axis(b.x, b.w, cx);
  let [y, h, gy] = axis(b.y, b.h, cy);
  w = Math.max(16, Math.min(Math.round(w), cv.w)); h = Math.max(8, Math.min(Math.round(h), cv.h));
  x = Math.max(0, Math.min(Math.round(x), cv.w - w)); y = Math.max(0, Math.min(Math.round(y), cv.h - h));
  return { box: { x, y, w, h }, gx: gx === null ? [] : [gx], gy: gy === null ? [] : [gy] };
}

const TS = { sm: 'text-[12.5px] leading-5', md: 'text-[14px] leading-5', lg: 'text-[18px] leading-6', xl: 'text-[24px] leading-8' } as const;
const TW = { normal: 'font-normal', medium: 'font-medium', bold: 'font-semibold' } as const;

/** Một phần tử con: chữ, nhãn, nút (hành động chung của trang), ảnh (https), đường kẻ */
export function LElemView({ e }: { e: LElem }) {
  const ctx = useContext(LPageC);
  const txt = (s?: string) => lBindFill(lFill(s ?? '', ctx?.vars), ctx?.bind, !!ctx?.live);
  const al = e.align === 'center' ? 'text-center' : e.align === 'right' ? 'text-right' : '';
  if (e.kind === 'divider') return <hr className="w-full border-0 border-t border-[rgb(var(--line))]" style={e.tone ? { borderColor: lCol(e.tone, 'text') } : undefined} aria-hidden />;
  if (e.kind === 'image') {
    const ok = /^https:\/\/[^\s"'<>]+$/.test(e.url ?? '');
    return ok ? <img src={e.url} alt={txt(e.text)} className="h-full min-h-0 w-full rounded-md object-cover" loading="lazy" referrerPolicy="no-referrer" />
      : <div className="grid h-full min-h-[40px] w-full place-items-center rounded-md border border-dashed border-[rgb(var(--line))] text-[12px] text-[rgb(var(--muted))]">Chưa có ảnh</div>;
  }
  if (e.kind === 'button') {
    const act = e.act && L_ACT[e.act] && e.act !== 'menu' ? e.act : 'back';
    const b: LBtn = { id: e.id, icon: '', label: txt(e.text) || L_ACT[act].label, style: e.btn ?? 'primary', act, arg: e.arg, tone: e.tone };
    if (ctx && !ctx.can(b)) return null;
    const st = b.style;
    const cls = st === 'primary' ? cn(btnPrimary, 'h-9') : st === 'ghost' ? cn(btnGhost, 'h-9') : 'inline-flex h-9 items-center rounded-lg px-2.5 text-[13.5px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)] hover:text-[rgb(var(--fg))]';
    const tone: CSSProperties | undefined = !e.tone ? undefined : st === 'primary' ? { background: lCol(e.tone, 'solid'), borderColor: lCol(e.tone, 'solid'), color: lOnColor(e.tone) } : { color: lCol(e.tone, 'text') };
    return <div className={cn('flex w-full', e.align === 'center' ? 'justify-center' : e.align === 'right' ? 'justify-end' : '')}><button type="button" className={cn(cls, 'max-w-full truncate')} style={tone} disabled={!!ctx?.off?.(b)} onClick={() => ctx?.act(b)}>{b.label}</button></div>;
  }
  if (e.kind === 'badge') {
    const t = e.tone ?? 'fg2';
    return <div className={cn('flex w-full', e.align === 'center' ? 'justify-center' : e.align === 'right' ? 'justify-end' : '')}><span className="inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-[12px] font-medium" style={{ color: lCol(t, 'text'), background: lCol(t, 'tint', 0.12) }}>{txt(e.text)}</span></div>;
  }
  return <p className={cn('min-w-0 break-words', TS[e.size ?? 'md'], TW[e.weight ?? 'normal'], e.mono && 'font-mono tabular-nums', al)} style={e.tone ? { color: lCol(e.tone, 'text') } : undefined}>{txt(e.text) || ' '}</p>;
}

const AL: Record<LFlex['align'], string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
const JU: Record<LFlex['justify'], string> = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' };

const elemsOf = (c: LBlockCfg) => (c.elems ?? []).filter((e) => !!L_ELEM_KIND[e.kind]).slice(0, L_ELEM_MAX);

/** Khung linh hoạt: phần tử xếp theo hàng (tự xuống dòng) hoặc cột; phần tử "giãn" chiếm chỗ trống */
export function FlexBox({ c }: { c: LBlockCfg }) {
  const f = { ...L_FLEX_DEF, ...c.flex };
  const els = elemsOf(c);
  if (!els.length) return <p className="py-2 text-[12.5px] text-[rgb(var(--muted))]">Chưa có phần tử</p>;
  return (
    <div className={cn('flex h-full min-w-0', f.dir === 'col' && 'flex-col')} data-flex-box={f.dir} style={{ gap: f.gap, alignItems: AL[f.align], justifyContent: JU[f.justify], flexWrap: f.wrap ? 'wrap' : 'nowrap' }}>
      {els.map((e) => <div key={e.id} data-elem={e.id} className={cn('min-w-0', e.kind === 'divider' && 'w-full basis-full')} style={e.grow ? { flex: '1 1 0%' } : undefined}><LElemView e={e} /></div>)}
    </div>
  );
}

/** Khung tự do: đặt theo khổ thiết kế, neo cạnh khi khung rộng / hẹp hơn; khung hẹp (điện thoại) xếp thành cột theo thứ tự trên → dưới, trái → phải */
export function FreeBox({ c, fill }: { c: LBlockCfg; fill?: boolean }) {
  const cv = { ...L_CANVAS_DEF, ...c.canvas };
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const els = elemsOf(c);
  const stack = w !== null && w < Math.min(400, cv.w * 0.6);
  return (
    <div ref={ref} className={cn('min-w-0', fill && 'h-full')} data-free-box={stack ? 'stack' : 'free'}>
      {stack ? (
        <div className="flex flex-col gap-2">{[...els].sort((a, b) => (a.box?.y ?? 0) - (b.box?.y ?? 0) || (a.box?.x ?? 0) - (b.box?.x ?? 0)).map((e) => <div key={e.id} data-elem={e.id} className="min-w-0"><LElemView e={{ ...e, align: e.kind === 'text' ? undefined : e.align }} /></div>)}</div>
      ) : (
        <div className="relative min-w-0 overflow-hidden" style={{ height: fill ? '100%' : cv.h }}>
          {els.map((e) => <div key={e.id} data-elem={e.id} className={cn('absolute flex min-w-0 overflow-hidden', e.kind === 'text' ? 'items-start' : 'items-center')} style={lPinCss(e, cv)}><LElemView e={e} /></div>)}
        </div>
      )}
    </div>
  );
}

/** Khung chứa theo loại khối */
export function LContainer({ b, fill }: { b: LBlock; fill?: boolean }) {
  return b.type === 'K-FreeformBox' ? <FreeBox c={b.config} fill={fill} /> : <FlexBox c={b.config} />;
}
