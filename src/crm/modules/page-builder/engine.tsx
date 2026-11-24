'use client';

// Bộ vẽ trang — phần lõi không giao diện: cấu hình mặc định, xếp lưới, dữ liệu thật / mẫu, kỳ, biến, kiểu dáng, xuất Excel
// (V55.2: chuyển từ modules/messages/messenger.tsx, giữ nguyên logic)
import { type CSSProperties, useEffect, useState } from 'react';
import { downloadBlob, fmtDate, iso, L_ACT, L_DS, L_FS, L_PERIOD, L_RAD, L_SAMPLE_CUST, L_SAMPLE_STAFF, L_SH, L_TONE, L_TS, L_TW, lAgg, lField, lFilter, lHasData, lHex, L_PAGE_ENTITY, lHit, lInfoSections, lPeriodLabel, lType, MODULE_LABEL, SALE_STAGE, saleOwed, salePaid, todayISO, uid } from '../../lib/core';
import { xlsxBlob } from '../../lib/csv';
import { saleStage, saleTotals } from '../../lib/getfly';
import type { AppCtx, DashPeriod, DateRange, LAgg, LBlock, LBlockCfg, LBlockType, LBtn, LBtnAct, LDataset, LPage, LPageCtx, LPeriod, LPos, LRow, Module, StockVoucher, XlsxSheet } from '../../lib/types';
import { dashRange } from '../dashboard/exec-dashboard';

export function lDefaultCfg(type: LBlockType, page: LPage = 'home'): LBlockCfg {
  if (type === 'K-Stat-Simple') return { title: 'Doanh số tháng', ds: 'sales', field: 'revenue', agg: 'sum', period: 'month', compare: true, open: true };
  if (type === 'K-Chart-Line') return { title: 'Doanh số và doanh thu 12 tháng', ds: 'sales', series: ['revenue', 'paid'], months: 12, open: true };
  if (type === 'K-Table-Compact') return { title: 'Top 5 khách hàng', ds: 'sales', mode: 'group', group: 'customer', field: 'revenue', limit: 5, open: true };
  if (type === 'K-Text') return page === 'home' ? { title: 'Tiêu đề kỳ', ds: 'sales', kind: 'title', text: '{kỳ}', sub: 'Cập nhật {giờ cập nhật} · kỳ vọng {kỳ vọng %} · còn {số ngày còn lại} ngày' }
    : { title: 'Lưu ý', ds: 'sales', kind: 'note', text: page === 'sale-detail' ? '**Trước khi yêu cầu xuất kho**\n- Đơn giao nhà xe: ghi rõ tên nhà xe và số điện thoại ở Ghi chú\n- Đơn trên 50 triệu: gửi kèm PO hoặc hợp đồng' : 'Đơn **duyệt trước ngày 28** được tính vào doanh số tháng' };
  if (type === 'K-Button') {
    const bt = (act: LBtnAct, label: string, style: LBtn['style'], icon = L_ACT[act].icon): LBtn => ({ id: uid('bt'), icon, label, style, act });
    return { title: 'Nút trang', ds: 'sales', align: 'right', buttons: page === 'home' ? [bt('targets', 'Chỉ tiêu', 'ghost'), bt('print', 'PDF', 'ghost')]
      : page === 'sale-list' ? [bt('new', 'Lên đơn bán', 'primary')]
      : (['back', 'prev', 'next', 'print', 'download', 'upload', 'menu'] as LBtnAct[]).map((a) => bt(a, '', 'icon')) };
  }
  if (type === 'K-Filter') return { title: 'Bộ lọc chung', ds: 'sales', periods: ['WEEK', 'MONTH', 'QUARTER', 'YEAR'], showCompare: true, showDept: true, align: 'right' };
  if (type === 'K-Tabs') return { title: 'Tab trang', ds: 'sales', tabs: [{ id: uid('tb'), label: 'Tổng quan' }, { id: uid('tb'), label: 'Kinh doanh' }] };
  if (type === 'K-Divider') return { title: 'Đường kẻ', ds: 'sales', hideTitle: true };
  // v55.2 khối bản ghi: Chi tiết lấy bộ trường gốc như giao diện cũ (4 cột); Form để trống, trường theo cờ "Form" tự vào nhóm "Thông tin thêm"
  // v55.3: khách hàng / lead: khối Chi tiết bắt đầu bằng trường tùy chỉnh theo cờ "Thông tin" (trường gốc 3A tự kéo thêm)
  const ent = L_PAGE_ENTITY[page] ?? 'sale';
  if (type === 'K-RecordDetail') return ent === 'sale' ? { title: 'Thông tin đơn hàng', ds: 'sales', entity: 'sale', sections: lInfoSections(uid('lb'), { title: '', ds: 'sales' }) } : { title: 'Thông tin thêm', ds: 'sales', entity: ent, sections: [] };
  if (type === 'K-RecordForm') return { title: ent === 'sale' ? 'Thông tin thêm' : 'Thông tin thêm (form)', ds: 'sales', entity: ent, sections: [] };
  if (type === 'K-RecordList') return { title: ent === 'lead' ? 'Danh sách lead' : 'Danh sách khách hàng', ds: ent === 'lead' ? 'leads' : 'customers', entity: ent };
  return { title: lType(type).label, ds: 'sales' };
}

export function lSettle(bs: LBlock[], movedId?: string): LBlock[] {
  const clamp = (p: LPos): LPos => { const w = Math.max(1, Math.min(12, p.w)); return { x: Math.max(0, Math.min(12 - w, p.x)), y: Math.max(0, p.y), w, h: Math.max(1, Math.min(12, p.h)) }; };
  const items = bs.map((b) => ({ ...b, pos: { ...b.pos, lg: clamp(b.pos.lg) } }));
  const moved = items.find((b) => b.id === movedId);
  const placed: LBlock[] = moved ? [moved] : [];
  items.filter((b) => b !== moved).sort((p, q) => p.pos.lg.y - q.pos.lg.y || p.pos.lg.x - q.pos.lg.x).forEach((b) => {
    let y = b.pos.lg.y;
    while (placed.some((o) => lHit({ ...b.pos.lg, y }, o.pos.lg))) y++;
    placed.push({ ...b, pos: { ...b.pos, lg: { ...b.pos.lg, y } } });
  });
  // dồn lên
  const out: LBlock[] = [];
  [...placed].sort((p, q) => p.pos.lg.y - q.pos.lg.y || p.pos.lg.x - q.pos.lg.x).forEach((b) => {
    let y = 0;
    while (out.some((o) => lHit({ ...b.pos.lg, y }, o.pos.lg))) y++;
    out.push({ ...b, pos: { ...b.pos, lg: { ...b.pos.lg, y } } });
  });
  return bs.map((b) => out.find((o) => o.id === b.id)!);
}

// ---- dữ liệu thật của doanh nghiệp (đã lọc theo phạm vi xem của người dùng)
export function lRowsReal(ds: LDataset, a: AppCtx, stockVouchers: StockVoucher[]): LRow[] {
  const cd = new Map<string, string>(a.customers.map((c) => [c.id, String(c.dept)]));
  if (ds === 'sales') return a.mySales.filter((o) => o.status !== 'CANCELLED').map((o) => {
    const st = saleStage(o, stockVouchers);
    const owed = Math.max(0, saleOwed(o) - salePaid(o, true));
    return { date: o.date, dp: o.customerId ? cd.get(o.customerId) : undefined, v: { revenue: saleTotals(o).net, grand: saleTotals(o).grand, paid: salePaid(o), owed }, d: { code: o.code, customer: o.customer, by: a.userName(o.by ?? ''), stage: SALE_STAGE[st].label }, f: [st === 'APPROVAL' ? 'approval' : '', owed > 0 ? 'unpaid' : '', o.status === 'DONE' ? 'done' : ''] };
  });
  if (ds === 'leads') return a.myLeads.map((l) => ({ date: iso(new Date(Date.now() - (l.receivedDaysAgo ?? 0) * 864e5)), dp: l.dept, v: { value: l.boqValue ?? 0, won: l.wonAmount ?? 0 }, d: { company: l.company, source: String(l.source), status: String(l.status) }, f: [l.wonAt ? 'won' : l.lostReason ? '' : 'open'] }));
  if (ds === 'customers') return a.myCustomers.map((c) => ({ date: (c.createdAt ?? '').slice(0, 10), dp: String(c.dept), v: {}, d: { name: c.name, segment: String(c.segment) }, f: [] }));
  if (ds === 'cash') return a.cashEntries.filter((e) => e.kind !== 'TRANSFER').map((e) => ({ date: e.date, v: { in: e.kind === 'IN' ? e.amount : 0, out: e.kind === 'OUT' ? e.amount : 0 }, d: { code: e.code, category: e.category, partner: e.partner ?? '' }, f: [e.kind === 'IN' ? 'in' : 'out'] }));
  return a.programs.map((p) => ({ date: (p.start ?? '').slice(0, 10), v: { requested: p.requested ?? 0 }, d: { title: p.title, status: String(p.status) }, f: [] }));
}

export function lRowsSample(ds: LDataset): LRow[] {
  let s = 7 + ds.length * 13;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const today = new Date();
  const day = (back: number) => iso(new Date(today.getTime() - back * 864e5));
  const out: LRow[] = [];
  for (let i = 0; i < 140; i++) {
    const back = Math.floor(rnd() * 360);
    const grow = 1 + (360 - back) / 360;
    if (ds === 'sales') { const rev = Math.round((8 + rnd() * 60) * grow) * 1e6; const paid = rnd() > 0.35 ? Math.round(rev * 1.08) : 0; const st = i % 9 === 0 ? 'approval' : rnd() > 0.5 ? 'done' : ''; out.push({ date: day(back), v: { revenue: rev, grand: Math.round(rev * 1.08), paid, owed: Math.round(rev * 1.08) - paid }, d: { code: `DH${String(100 + i)}`, customer: L_SAMPLE_CUST[Math.floor(rnd() * L_SAMPLE_CUST.length)], by: L_SAMPLE_STAFF[i % 3], stage: st === 'approval' ? 'Chờ duyệt' : st === 'done' ? 'Hoàn thành' : 'Chờ xuất kho' }, f: [st, paid ? '' : 'unpaid'] }); }
    else if (ds === 'leads') out.push({ date: day(back), v: { value: Math.round(20 + rnd() * 400) * 1e6, won: rnd() > 0.7 ? Math.round(20 + rnd() * 200) * 1e6 : 0 }, d: { company: L_SAMPLE_CUST[i % L_SAMPLE_CUST.length], source: ['Website', 'Zalo', 'Hội thảo'][i % 3], status: 'Đang xử lý' }, f: [i % 4 === 0 ? 'won' : 'open'] });
    else if (ds === 'customers') out.push({ date: day(back), v: {}, d: { name: `${L_SAMPLE_CUST[i % L_SAMPLE_CUST.length]} ${i}`, segment: ['Dự án', 'Thương mại', 'Đại lý'][i % 3] }, f: [] });
    else if (ds === 'cash') { const inn = rnd() > 0.45; const amt = Math.round(1 + rnd() * 40) * 1e6; out.push({ date: day(back), v: { in: inn ? amt : 0, out: inn ? 0 : amt }, d: { code: `${inn ? 'PTQ' : 'PCQ'}-${i}`, category: inn ? 'Thu tiền bán hàng' : 'Vận chuyển', partner: L_SAMPLE_CUST[i % L_SAMPLE_CUST.length] }, f: [inn ? 'in' : 'out'] }); }
    else if (i < 24) out.push({ date: day(back), v: { requested: Math.round(20 + rnd() * 180) * 1e6 }, d: { title: `Hội thảo 3M ${i + 1}`, status: 'Đã duyệt' }, f: [] });
  }
  return out;
}

/** Khoảng ngày của kỳ và kỳ liền trước */
export function lBounds(p: LPeriod, range?: DateRange): { from: string; to: string; pf: string; pt: string } | null {
  const t = new Date(); const y = t.getFullYear(), m = t.getMonth();
  const d = (x: Date) => iso(x);
  if (p === 'all') return null;
  if (p === 'month') return { from: d(new Date(y, m, 1)), to: d(new Date(y, m + 1, 0)), pf: d(new Date(y, m - 1, 1)), pt: d(new Date(y, m, 0)) };
  if (p === 'quarter') { const q = Math.floor(m / 3) * 3; return { from: d(new Date(y, q, 1)), to: d(new Date(y, q + 3, 0)), pf: d(new Date(y, q - 3, 1)), pt: d(new Date(y, q, 0)) }; }
  if (p === 'year') return { from: `${y}-01-01`, to: `${y}-12-31`, pf: `${y - 1}-01-01`, pt: `${y - 1}-12-31` };
  if (p === 'last30') return { from: d(new Date(t.getTime() - 29 * 864e5)), to: d(t), pf: d(new Date(t.getTime() - 59 * 864e5)), pt: d(new Date(t.getTime() - 30 * 864e5)) };
  const r = range ?? { from: d(new Date(y, m, 1)), to: d(t) };
  const len = Math.max(1, Math.round((new Date(r.to).getTime() - new Date(r.from).getTime()) / 864e5) + 1);
  return { from: r.from, to: r.to, pf: d(new Date(new Date(r.from).getTime() - len * 864e5)), pt: d(new Date(new Date(r.from).getTime() - 864e5)) };
}

/** Biến tự điền theo trang (giá trị theo kỳ đang chọn, doanh nghiệp, người xem) */
export function lVars(p: DashPeriod, org: string, viewer: string, extra: Record<string, string> = {}): Record<string, string> {
  const now = Date.now(); const r = dashRange(p, now);
  return { 'kỳ': lPeriodLabel(p), 'kỳ trước': r.prevTag, 'giờ cập nhật': new Date(now).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), 'kỳ vọng %': `${Math.round(r.elapsed * 100)}%`, 'số ngày còn lại': String(r.daysLeft), 'ngày': fmtDate(todayISO()), 'tên doanh nghiệp': org, 'người xem': viewer, ...extra };
}

/** Ngữ cảnh của màn thiết kế / xem trước (dữ liệu mẫu, nút không chạy) */
export function lDesignCtx(page: LPage, tab: string, setTab: (t: string) => void, period: DashPeriod, setPeriod: (p: DashPeriod) => void): LPageCtx {
  return { live: false, page, period, setPeriod, dept: 'ALL', setDept: () => {}, tab, setTab, vars: lVars(period, 'VASSH', 'Trần Quốc Bảo', { 'mã đơn': 'DH201126-02', 'khách hàng': 'NPP Hoàng Phát', 'trạng thái đơn': 'Chờ xuất kho' }), act: () => {}, can: () => true, openTargets: () => {} };
}

/** Màu theo khóa bảng màu hoặc #mã: text (chữ), solid (đặc), tint (nhạt theo độ trong a) */
export function lCol(v: string | undefined, mode: 'text' | 'solid' | 'tint', a = 0.08): string | undefined {
  if (!v || v === 'auto') return undefined;
  if (lHex(v)) return mode === 'tint' ? `${v}${Math.round(a * 255).toString(16).padStart(2, '0')}` : v;
  const t = L_TONE[v];
  if (!t) return undefined;
  return mode === 'text' ? `rgb(var(${t.text}))` : mode === 'solid' ? `rgb(var(${t.base}))` : `rgb(var(${t.base}) / ${a})`;
}

/** Màu chữ đặt trên nền đặc */
export function lOnColor(v: string): string {
  if (lHex(v)) { const n = parseInt(v.slice(1), 16); const y = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return y > 0.6 ? '#1c1917' : '#ffffff'; }
  return v === 'fg' ? 'rgb(var(--bg))' : v === 'warn' ? '#1c1917' : '#ffffff';
}

/** Kiểu dáng của khối → lớp CSS + biến CSS (box = khối không có thẻ nền: nút, bộ lọc, chữ không khung) và hệ số cỡ chữ z */
export function lSt(c: LBlockCfg, box = false, noBd = false): { cls: string; css: CSSProperties; z?: number } {
  const s = c.st;
  if (!s) return { cls: '', css: {} };
  const v: Record<string, string> = {}; const k: string[] = [];
  const bgKey = s.bg && s.bg !== 'auto' ? s.bg : undefined;
  const bg = !bgKey ? undefined : bgKey === 'none' ? 'transparent' : bgKey === 'surface' ? 'rgb(var(--surface))' : bgKey === 'sunken' ? 'rgb(var(--sunken))' : lCol(bgKey, s.bgA === 'solid' ? 'solid' : 'tint', s.bgA === 'mid' ? 0.16 : 0.08);
  if (bg) { v['--lb-bg'] = bg; k.push('lst-bg'); }
  const solid = !!bg && s.bgA === 'solid' && !!bgKey && !['none', 'surface', 'sunken'].includes(bgKey);
  const col = lCol(s.color, 'text') ?? (solid ? lOnColor(bgKey!) : undefined);
  if (col) { v['--lb-c'] = col; k.push('lst-c'); }
  if (!noBd && ((s.bd && s.bd !== 'auto') || s.bdS || s.bdW)) {
    v['--lb-bd'] = !s.bd || s.bd === 'auto' || s.bd === 'line' ? 'rgb(var(--line))' : s.bd === 'none' ? 'transparent' : s.bd === 'strong' ? 'rgb(var(--ink) / 0.3)' : lCol(s.bd, 'solid') ?? 'rgb(var(--line))';
    v['--lb-bw'] = `${s.bdW ?? 1}px`; v['--lb-bs'] = s.bdS ?? 'solid'; k.push('lst-bd');
  }
  if (s.r) { v['--lb-r'] = L_RAD[s.r]; k.push('lst-r'); }
  if (s.sh) { v['--lb-sh'] = L_SH[s.sh]; k.push('lst-sh'); }
  if (s.tSize) { v['--lb-ts'] = L_TS[s.tSize]; k.push('lst-ts'); }
  const tc = lCol(s.tColor, 'text'); if (tc) { v['--lb-tc'] = tc; k.push('lst-tc'); }
  if (s.tW) { v['--lb-tw'] = L_TW[s.tW]; k.push('lst-tw'); }
  if (solid) k.push('lst-solid');
  if (box && (k.includes('lst-bg') || k.includes('lst-bd'))) k.push('lst-box');
  return { cls: k.join(' '), css: v as CSSProperties, z: s.fs && s.fs !== 'md' ? L_FS[s.fs] : undefined };
}

/** Hành động chung (không phụ thuộc trang) */
export function lActCommonRun(b: LBtn, go: (m: Module) => void) {
  if (b.act === 'back') window.history.back();
  else if (b.act === 'go' && b.arg && Object.prototype.hasOwnProperty.call(MODULE_LABEL, b.arg)) go(b.arg as Module);
  else if (b.act === 'link' && /^https?:\/\//.test(b.arg ?? '')) window.open(b.arg, '_blank', 'noopener,noreferrer');
  else if (b.act === 'print') window.print();
}

/** Màn hình rộng tối thiểu (theo media query, cập nhật khi đổi cỡ) */
export function useMinW(px: number) {
  const q = `(min-width: ${px}px)`;
  const [ok, setOk] = useState(() => typeof window === 'undefined' || !window.matchMedia ? true : window.matchMedia(q).matches);
  useEffect(() => { if (typeof window === 'undefined' || !window.matchMedia) return; const m = window.matchMedia(q); const h = () => setOk(m.matches); h(); m.addEventListener('change', h); return () => m.removeEventListener('change', h); }, [q]);
  return ok;
}

/** Chia khối thành các dải ngang; trong mỗi dải gom khối cùng vùng cột thành một cột xếp dọc (chiều cao theo nội dung) */
export function lBands(bs: LBlock[]): { x: number; w: number; items: LBlock[] }[][] {
  // khối rộng cả 12 cột tách dải; các khối khác trong cùng dải gom theo vùng cột chồng nhau
  const s = [...bs].sort((a, b) => a.pos.lg.y - b.pos.lg.y || a.pos.lg.x - b.pos.lg.x);
  const bands: LBlock[][] = [];
  let cur: LBlock[] = [];
  s.forEach((b) => { if (b.pos.lg.w >= 12) { if (cur.length) bands.push(cur); bands.push([b]); cur = []; } else cur.push(b); });
  if (cur.length) bands.push(cur);
  return bands.map((band) => {
    let cols: { x: number; w: number; items: LBlock[] }[] = [];
    [...band].sort((a, b) => a.pos.lg.x - b.pos.lg.x).forEach((b) => {
      const p = b.pos.lg;
      const hit = cols.filter((k) => p.x < k.x + k.w && k.x < p.x + p.w);
      if (!hit.length) { cols.push({ x: p.x, w: p.w, items: [b] }); return; }
      const x = Math.min(p.x, ...hit.map((k) => k.x)), r = Math.max(p.x + p.w, ...hit.map((k) => k.x + k.w));
      cols = [...cols.filter((k) => !hit.includes(k)), { x, w: r - x, items: [...hit.flatMap((k) => k.items), b] }];
    });
    return cols.sort((a, b) => a.x - b.x).map((k) => ({ ...k, items: k.items.sort((a, b) => a.pos.lg.y - b.pos.lg.y || a.pos.lg.x - b.pos.lg.x) }));
  });
}

/** Tải số liệu các khối của trang tổng hợp ra Excel: 1 sheet chỉ số + mỗi bảng / biểu đồ 1 sheet */
export function lExport(blocks: LBlock[], rowsOf: (ds: LDataset) => LRow[] | null, range: DateRange | undefined, file: string) {
  const sheets: XlsxSheet[] = [];
  const name = (t: string) => { let n = (t.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Khoi').slice(0, 28); let k = 2; while (sheets.some((s) => s.name === n)) n = `${n.slice(0, 26)}${k++}`; return n; };
  const stat: (string | number)[][] = [['Chỉ số', 'Giá trị', 'Kỳ']];
  [...blocks].sort((a, b) => a.pos.lg.y - b.pos.lg.y || a.pos.lg.x - b.pos.lg.x).forEach((b) => {
    if (!lHasData(b.type)) return;
    const rows = rowsOf(b.config.ds); if (!rows) return;
    const c = b.config; const ds = L_DS[c.ds]; const base = lFilter(rows, c.filter);
    if (b.type === 'K-Stat-Simple') {
      const fl = lField(c.ds, c.field); const agg: LAgg = fl.id === 'count' ? 'count' : c.agg ?? 'sum'; const bd = lBounds(c.period ?? 'month', range);
      stat.push([c.title, Math.round(lAgg(bd ? base.filter((r) => r.date >= bd.from && r.date <= bd.to) : base, fl.id, agg)), bd ? L_PERIOD[c.period ?? 'month'] : 'Toàn bộ']);
    } else if (b.type === 'K-Chart-Line') {
      const n = c.months ?? 12; const t = new Date(); const ser = (c.series ?? ['revenue']).filter(Boolean).slice(0, 2);
      sheets.push({ name: name(c.title), rows: [['Tháng', ...ser.map((f) => lField(c.ds, f).label)], ...Array.from({ length: n }, (_, i) => { const d = new Date(t.getFullYear(), t.getMonth() - (n - 1 - i), 1); const k = iso(d).slice(0, 7); const rs = base.filter((r) => r.date.slice(0, 7) === k); return [k, ...ser.map((f) => Math.round(lAgg(rs, f, f === 'count' ? 'count' : 'sum')))]; })] });
    } else if ((c.mode ?? 'rows') === 'group') {
      const g = c.group ?? ds.dims[0].id; const fl = lField(c.ds, c.field); const m = new Map<string, LRow[]>();
      base.forEach((r) => { const k = r.d[g] || '—'; m.set(k, [...(m.get(k) ?? []), r]); });
      sheets.push({ name: name(c.title), rows: [[ds.dims.find((x) => x.id === g)?.label ?? g, fl.label], ...Array.from(m.entries()).map(([k, rs]) => [k, Math.round(lAgg(rs, fl.id, fl.id === 'count' ? 'count' : 'sum'))] as (string | number)[]).sort((p, q) => Number(q[1]) - Number(p[1]))] });
    } else {
      const cols = (c.cols?.length ? c.cols : [ds.dims[0].id, ds.fields[1]?.id ?? 'count']).slice(0, 5);
      const isNum = (id: string) => ds.fields.some((f) => f.id === id);
      const lab = (id: string) => ds.dims.find((x) => x.id === id)?.label ?? ds.fields.find((x) => x.id === id)?.label ?? id;
      const sorted = [...base].sort((p, q) => (c.sort ? (q.v[c.sort] ?? 0) - (p.v[c.sort] ?? 0) : q.date.localeCompare(p.date)));
      sheets.push({ name: name(c.title), rows: [['STT', ...cols.map(lab)], ...sorted.map((r, i) => [i + 1, ...cols.map((x) => (isNum(x) ? Math.round(r.v[x] ?? 0) : r.d[x] ?? ''))])] });
    }
  });
  if (stat.length > 1) sheets.unshift({ name: 'Chi so', rows: stat, widths: [32, 18, 22] });
  if (!sheets.length) sheets.push({ name: 'Trong', rows: [['Không có khối dữ liệu']] });
  downloadBlob(file, xlsxBlob(sheets));
}
