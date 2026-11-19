'use client';

import { type KeyboardEvent as RKeyboardEvent, useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Maximize2, Minimize2, PackagePlus, Plus, RefreshCw, ScanText, Sparkles, Trash2 } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { Pagination, usePaged } from '../../components/controls';
import { EmptyState, FilePicker, Table } from '../../components/ui';
import { AI_NAME, aiErrText, btnGhost, btnSm, catalogSkus, digits, fileB64, GM_RULE, HEAD_RULES, inputBase, isUnitWord, liveDrafts, netOf, nextCode, normKey, rowCls, shrinkImage, tdCls, tdLast, tierPrice, uid, useApp } from '../../lib/core';
import type { DocLine, DraftProduct, PasteRow, PriceTier, Quote, SkuItem, SmartCatalog, SmartSuggest } from '../../lib/types';
import { cn } from '../../lib/utils';
import { apiPost, useAi } from '../ai/ai-core';

/** Số kiểu Việt Nam / quốc tế: 1.250.000 · 1,5 · 1,234.5 · 12 */
export function parseVnNum(raw: string): number | null {
  const s = raw.replace(/\s|đ|vnđ|vnd/gi, '').trim();
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  let t = s;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');
  else if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Ô từ bộ nhớ tạm: ưu tiên dạng tab (Excel, Word đều có), sau đó bảng HTML, cuối cùng là từng dòng chữ */
export function clipboardCells(text: string, html = ''): string[][] {
  const clean = (r: string[][]) => r.map((x) => x.map((c) => c.replace(/\s+/g, ' ').trim())).filter((x) => x.some(Boolean));
  if (text.includes('\t')) return clean(text.replace(/\r/g, '').split('\n').map((l) => l.split('\t')));
  if (/<table/i.test(html) && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = clean(Array.from(doc.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('td,th')).map((c) => c.textContent ?? '')));
    if (rows.length) return rows;
  }
  return clean(text.replace(/\r/g, '').split('\n').map((l) => [l]));
}

/** "Magic paste": tự nhận cột Tên / ĐVT / SL / Đơn giá từ bảng dán vào (có hoặc không có dòng tiêu đề) */
export function mapPastedRows(cells: string[][]): PasteRow[] {
  if (!cells.length) return [];
  const width = Math.max(...cells.map((r) => r.length));
  if (width === 1) {
    // Danh sách chữ: "Cáp CV 2.5mm2 - 200 m" / "Aptomat 3P 63A x 4 cái"
    return cells.map(([l]) => {
      const m = l.match(/^(.*?)[\s:x×*-]+(\d[\d.,]*)\s*([\p{L}²³0-9]{1,10})?\s*$/u);
      if (m && m[1].trim().length >= 2) { const q = parseVnNum(m[2]); const u = m[3] ?? ''; if (q !== null && (!u || isUnitWord(u))) return { name: m[1].trim(), unit: u, qty: q }; }
      return { name: l.replace(/^\d+[.)]\s*/, '').trim(), unit: '', qty: 1 };
    }).filter((r) => r.name.length >= 2);
  }
  // 1) dòng tiêu đề (trong 3 dòng đầu)
  let headIdx = -1; let cols: Record<string, number> = {};
  for (let r = 0; r < Math.min(3, cells.length); r++) {
    const found: Record<string, number> = {};
    cells[r].forEach((c, i) => { const k = normKey(c); if (!k) return; const hit = HEAD_RULES.find(([, re]) => re.test(k)); if (hit && found[hit[0]] === undefined) found[hit[0]] = i; });
    if (Object.keys(found).length >= 2 && (found.name !== undefined || found.qty !== undefined)) { headIdx = r; cols = found; break; }
  }
  const body = cells.slice(headIdx + 1);
  // 2) không có tiêu đề: đoán theo dữ liệu từng cột
  if (headIdx < 0) {
    const stat = Array.from({ length: width }, (_, i) => {
      const vals = body.map((r) => r[i] ?? '').filter(Boolean);
      const nums = vals.map(parseVnNum).filter((x): x is number => x !== null);
      const sorted = [...nums].sort((a, b) => a - b);
      return {
        i, n: vals.length, numeric: vals.length ? nums.length / vals.length : 0, avgLen: vals.length ? vals.reduce((a, v) => a + v.length, 0) / vals.length : 0,
        unit: vals.length ? vals.filter(isUnitWord).length / vals.length : 0, median: sorted[Math.floor(sorted.length / 2)] ?? 0,
        stt: nums.length >= 2 && nums.every((x, j) => x === j + 1 || x === nums[0] + j),
      };
    });
    const text = stat.filter((s) => s.numeric < 0.5 && s.n > 0);
    const name = [...text].sort((a, b) => b.avgLen - a.avgLen)[0];
    if (name) cols.name = name.i;
    const unit = text.filter((s) => s.i !== name?.i).sort((a, b) => b.unit - a.unit || a.avgLen - b.avgLen)[0];
    if (unit && (unit.unit >= 0.5 || unit.avgLen <= 6)) cols.unit = unit.i;
    const nums = stat.filter((s) => s.numeric >= 0.6 && !(s.stt && s.i < (name?.i ?? 99)));
    const small = nums.filter((s) => s.median < 1000);
    const big = nums.filter((s) => s.median >= 1000);
    const qty = small.find((s) => s.i > (name?.i ?? -1)) ?? small[0] ?? (big.length > 2 ? big[0] : undefined);
    if (qty) cols.qty = qty.i;
    const price = big.filter((s) => s.i !== qty?.i)[0];
    if (price) cols.price = price.i;
    text.filter((s) => s.i !== name?.i && s.i !== cols.unit).forEach((s, k) => { cols[k === 0 ? 'code' : 'spec'] = s.i; });
  }
  const get = (r: string[], k: string) => (cols[k] !== undefined ? (r[cols[k]] ?? '').trim() : '');
  return body.map((r) => {
    let name = get(r, 'name');
    for (const extra of [get(r, 'code'), get(r, 'spec')]) if (extra && !normKey(name).includes(normKey(extra))) name = name ? `${name} ${extra}` : extra;
    const qty = parseVnNum(get(r, 'qty')) ?? 0;
    const price = parseVnNum(get(r, 'price'));
    return { name: name.trim(), unit: get(r, 'unit'), qty: qty > 0 ? qty : 1, ...(price && price > 0 ? { price } : {}) };
  }).filter((r) => r.name.length >= 2 && !/^(tong|cong|vat|thue|chiet khau|tong cong|thanh tien)\b/.test(normKey(r.name)));
}

/** Giá bán gần nhất của một mã hàng (báo giá mới nhất có mã đó) */
export function lastSkuSale(sku: string, quotes: Quote[]) {
  let best: { price: number; discountPct: number; at: number; code: string } | null = null;
  for (const q of quotes) {
    const l = q.lines.find((x) => x.sku === sku);
    const at = q.createdAt ?? Date.parse(q.date);
    if (l && (!best || at > best.at)) best = { price: l.listPrice, discountPct: l.discountPct, at, code: q.code };
  }
  return best;
}

/** Khớp chính xác (bỏ dấu, bỏ ký tự đặc biệt) với mã / tên trong danh mục hoặc danh mục nháp */
export function exactMatch(name: string, c: SmartCatalog): { sku?: SkuItem; draft?: DraftProduct } {
  const k = normKey(name);
  if (!k) return {};
  const sku = catalogSkus(c).find((s) => normKey(s.name) === k || normKey(s.sku) === k);
  if (sku) return { sku };
  const draft = liveDrafts(c).find((d) => d.key === k);
  return draft ? { draft } : {};
}

/** Gợi ý khi gõ: mọi từ khóa đều có trong tên / mã (hoặc khớp ≥ 60% số từ), ưu tiên khớp đầu tên và hàng hay dùng */
export function smartSuggest(q: string, c: SmartCatalog, limit = 8): SmartSuggest[] {
  const toks = normKey(q).split(' ').filter(Boolean);
  if (!toks.length || normKey(q).length < 2) return [];
  const score = (hay: string) => {
    const hit = toks.filter((t) => hay.includes(t)).length;
    if (hit === toks.length) return 100 + (hay.startsWith(toks[0]) ? 15 : 0) - Math.min(20, hay.length / 8);
    return hit / toks.length >= 0.6 ? 50 * (hit / toks.length) : 0;
  };
  const out: (SmartSuggest & { s: number })[] = [];
  for (const k of catalogSkus(c)) {
    const s = score(normKey(`${k.sku} ${k.name}`));
    if (!s) continue;
    const last = lastSkuSale(k.sku, c.quotes);
    out.push({ s: s + 5, kind: 'SKU', key: `s:${k.sku}`, name: k.name, unit: k.unit, sku: k.sku, price: tierPrice(k, c.tier), sub: `${k.sku} · Danh mục${last ? ` · bán gần nhất ${last.price.toLocaleString('vi-VN')}đ (${new Date(last.at).toLocaleDateString('vi-VN')})` : ''}` });
  }
  for (const d of liveDrafts(c)) {
    const s = score(d.key);
    if (!s) continue;
    out.push({ s: s + Math.min(10, d.uses), kind: 'DRAFT', key: `d:${d.id}`, name: d.name, unit: d.unit, price: d.lastPrice, discountPct: d.lastDiscountPct, sub: `Nháp · bán gần nhất ${new Date(d.lastAt).toLocaleDateString('vi-VN')}${d.lastCustomer ? ` cho ${d.lastCustomer}` : ''}${d.lastQuote ? ` · ${d.lastQuote}` : ''} · ${d.uses} lần` });
  }
  return out.sort((a, b) => b.s - a.s).slice(0, limit).map(({ s: _s, ...x }) => x);
}

/** Dòng dán / AI -> dòng báo giá, tự gắn mã và giá nếu trùng danh mục hoặc danh mục nháp */
export function pasteToLine(p: PasteRow, c: SmartCatalog, ai = false): DocLine {
  const { sku, draft } = exactMatch(p.name, c);
  if (sku) { const lp = p.price ?? tierPrice(sku, c.tier); return { sku: sku.sku, name: sku.name, unit: p.unit || sku.unit, qty: p.qty, listPrice: lp, discountPct: 0, price: lp, ...(ai ? { ai } : {}) }; }
  if (draft) { const lp = p.price ?? draft.lastPrice; const dc = p.price ? 0 : draft.lastDiscountPct ?? 0; return { sku: '', name: draft.name, unit: p.unit || draft.unit, qty: p.qty, listPrice: lp, discountPct: dc, price: netOf(lp, dc), ...(ai ? { ai } : {}) }; }
  const lp = p.price ?? 0;
  return { sku: '', name: p.name, unit: p.unit || 'Cái', qty: p.qty, listPrice: lp, discountPct: 0, price: lp, ...(ai ? { ai } : {}) };
}

/** Ghi / cập nhật danh mục nháp từ các dòng gõ tự do của báo giá vừa tạo */
export function learnDrafts(all: DraftProduct[], lines: DocLine[], skus: SkuItem[], ctx: { quote: string; customer: string; by?: string }): DraftProduct[] {
  const next = [...all];
  const at = Date.now();
  for (const l of lines) {
    if (l.sku && skus.some((s) => s.sku === l.sku)) continue;
    const key = normKey(l.name);
    const price = l.listPrice ?? l.price;
    if (!key || price <= 0) continue;
    const rec = { price, at, quote: ctx.quote, customer: ctx.customer };
    const i = next.findIndex((d) => d.key === key);
    if (i >= 0) {
      const d = next[i];
      next[i] = { ...d, name: l.name.trim(), unit: l.unit || d.unit, lastPrice: price, lastDiscountPct: l.discountPct ?? 0, lastAt: at, lastBy: ctx.by, lastQuote: ctx.quote, lastCustomer: ctx.customer, uses: d.uses + 1, history: [rec, ...(d.history ?? [])].slice(0, 10) };
    } else next.unshift({ id: uid('dp'), key, name: l.name.trim(), unit: l.unit || 'Cái', lastPrice: price, lastDiscountPct: l.discountPct ?? 0, lastAt: at, lastBy: ctx.by, lastQuote: ctx.quote, lastCustomer: ctx.customer, uses: 1, history: [rec] });
  }
  return next;
}

/** Bảng tính dòng hàng của báo giá */
export function SmartQuoteGrid({ items, onChange, locked, tier, wide, onWide, canSeeCost }: { items: DocLine[]; onChange: (v: DocLine[]) => void; locked: boolean; tier: PriceTier; wide: boolean; onWide: (v: boolean) => void; canSeeCost: boolean }) {
  const { skus, quotes, draftProducts, notify, org } = useApp();
  const ai = useAi('extract');
  const ref = useRef<HTMLDivElement>(null);
  const [ac, setAc] = useState<{ r: number; i: number } | null>(null);
  const [flash, setFlash] = useState<{ from: number; n: number } | null>(null);
  const [busy, setBusy] = useState('');
  // Ô số đang gõ: giữ nguyên chuỗi (cho phép gõ "2," trước khi gõ phần thập phân)
  const [ed, setEd] = useState<{ r: number; c: number; v: string } | null>(null);
  const numText = (r: number, c: number, n: number, empty: boolean) => (ed && ed.r === r && ed.c === c ? ed.v : empty ? '' : String(n).replace('.', ','));
  const typeNum = (r: number, c: number, v: string, apply: (n: number) => void) => { setEd({ r, c, v }); const n = parseVnNum(v); if (n !== null) apply(n); else if (!v.trim()) apply(0); };
  const cat: SmartCatalog = { skus, drafts: draftProducts, quotes, tier };
  const blank: DocLine = { sku: '', name: '', unit: '', qty: 0, price: 0, listPrice: 0, discountPct: 0 };
  const rows = locked ? items : [...items, blank];
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 2600); return () => clearTimeout(t); }, [flash]);

  const focus = (r: number, c: number) => setTimeout(() => { const el = ref.current?.querySelector<HTMLInputElement>(`[data-r="${r}"][data-c="${c}"]`); el?.focus(); el?.select?.(); }, 0);
  const upd = (i: number, p: Partial<DocLine>) => {
    const cur = i < items.length ? items[i] : blank;
    const n: DocLine = { ...cur, ...p };
    if (p.name !== undefined && cur.sku) { const k = skus.find((s) => s.sku === cur.sku); if (!k || normKey(k.name) !== normKey(p.name)) n.sku = ''; }
    n.price = netOf(n.listPrice ?? n.price, n.discountPct ?? 0);
    if (i >= items.length) { if (!n.name.trim() && !n.qty && !n.listPrice) return; onChange([...items, { ...n, unit: n.unit || 'Cái', qty: n.qty || 1 }]); }
    else onChange(items.map((x, j) => (j === i ? n : x)));
  };
  const pick = (i: number, s: SmartSuggest) => {
    const cur = i < items.length ? items[i] : blank;
    const disc = s.kind === 'DRAFT' ? s.discountPct ?? cur.discountPct ?? 0 : cur.discountPct ?? 0;
    const n: DocLine = { ...cur, sku: s.sku ?? '', name: s.name, unit: s.unit || cur.unit || 'Cái', qty: cur.qty || 1, listPrice: s.price, discountPct: disc, price: netOf(s.price, disc) };
    onChange(i < items.length ? items.map((x, j) => (j === i ? n : x)) : [...items, n]);
    setAc(null);
    focus(i, 2);
  };
  /** Chèn các dòng đã nhận dạng tại vị trí r */
  const insert = (parsed: PasteRow[], r: number, fromAi = false, label = 'Đã dán') => {
    if (!parsed.length) return notify('Không nhận ra dòng hàng nào trong dữ liệu dán', 'orange');
    const lines = parsed.map((p) => pasteToLine(p, cat, fromAi));
    const at = Math.min(r, items.length);
    const after = items.slice(at).filter((x) => x.name.trim());
    onChange([...items.slice(0, at), ...lines, ...after]);
    setFlash({ from: at, n: lines.length });
    const inCat = lines.filter((l) => l.sku).length;
    const known = lines.filter((l) => !l.sku && (l.listPrice ?? 0) > 0).length;
    const need = lines.filter((l) => !(l.listPrice ?? 0)).length;
    notify(`${label} ${lines.length} dòng: ${inCat} khớp danh mục, ${known} có giá gần nhất / giá trong file, ${need} cần nhập đơn giá`, need ? 'orange' : 'teal');
    if (need) { const first = lines.findIndex((l) => !(l.listPrice ?? 0)); focus(at + first, 3); }
  };
  const onPaste = (e: { clipboardData: DataTransfer; target: EventTarget; preventDefault: () => void }) => {
    if (locked) return;
    const t = e.clipboardData.getData('text/plain');
    const h = e.clipboardData.getData('text/html');
    const multi = /\t/.test(t) || /\n\s*\S/.test(t.trim()) || /<table/i.test(h);
    if (!multi) return;
    e.preventDefault();
    const el = e.target as HTMLElement;
    const r = el.dataset.r !== undefined ? Number(el.dataset.r) : items.length;
    const c = el.dataset.c !== undefined ? Number(el.dataset.c) : 0;
    const cells = clipboardCells(t, h);
    // Dán 1 cột vào cột số (SL, đơn giá, CK): điền xuống như Excel
    if (cells.every((x) => x.length === 1) && c >= 2) {
      const vals = cells.map(([v]) => parseVnNum(v));
      onChange(items.map((x, j) => {
        const v = vals[j - r];
        if (j < r || v === undefined || v === null) return x;
        const n = { ...x, ...(c === 2 ? { qty: v } : c === 3 ? { listPrice: v } : { discountPct: v }) };
        return { ...n, price: netOf(n.listPrice ?? n.price, n.discountPct ?? 0) };
      }));
      return notify(`Đã điền ${Math.min(vals.length, items.length - r)} ô`, 'teal');
    }
    insert(mapPastedRows(cells), r);
  };
  const pasteButton = async () => {
    try {
      const t = await navigator.clipboard.readText();
      insert(mapPastedRows(clipboardCells(t)), items.length);
    } catch { notify('Trình duyệt chặn đọc bộ nhớ tạm: bấm vào bảng rồi nhấn Ctrl + V', 'orange'); }
  };
  const extract = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (!ai.available) return notify('Chưa bật AI bóc tách: khai báo ANTHROPIC_API_KEY (ảnh và PDF) hoặc OPENAI_API_KEY (ảnh) trên máy chủ, bật ở Cài đặt › AI, Zalo OA & ZNS', 'orange');
    let mediaType = f.type; let data = '';
    try {
      if (f.type === 'application/pdf') {
        if (ai.provider !== 'ANTHROPIC') return notify('Đọc PDF cần Claude (ANTHROPIC_API_KEY). Với OpenAI, chụp ảnh trang danh sách để tải lên.', 'orange');
        if (f.size > 3 * 1024 * 1024) return notify('PDF tối đa 3 MB (giới hạn gói tin của máy chủ). Tách bớt trang hoặc chụp ảnh trang danh sách.', 'red');
        data = await fileB64(f);
      } else if (f.type.startsWith('image/')) { const url = await shrinkImage(f, 2000); mediaType = 'image/jpeg'; data = url.split(',')[1] ?? ''; }
      else return notify('Chọn ảnh (JPG, PNG) hoặc file PDF', 'red');
    } catch { return notify('Không đọc được file', 'red'); }
    setBusy(`${ai.label} đang đọc ${f.name}…`);
    const r = await apiPost<{ items: { name: string; unit?: string; qty?: number; price?: number }[]; provider: 'ANTHROPIC' | 'OPENAI'; model: string }>('/api/ai/extract', { tenant: org.id, provider: ai.provider, file: { mediaType, data } });
    setBusy('');
    if (!r.ok) return notify(`Chưa bóc tách được: ${r.error === 'pdf_needs_claude' ? 'đọc PDF cần Claude' : r.error === 'no_items' ? 'không thấy bảng vật tư trong file' : aiErrText(r.error)}`, 'red');
    const parsed: PasteRow[] = (r.items ?? []).map((x) => ({ name: String(x.name ?? '').trim(), unit: String(x.unit ?? '').trim(), qty: Number(x.qty) > 0 ? Number(x.qty) : 1, ...(Number(x.price) > 0 ? { price: Number(x.price) } : {}) })).filter((x) => x.name.length >= 2);
    insert(parsed, items.length, true, `${AI_NAME[r.provider]} đọc được`);
  };

  const onKey = (e: RKeyboardEvent<HTMLInputElement>, r: number, c: number, sugg: SmartSuggest[]) => {
    const open = ac?.r === r && c === 0 && sugg.length > 0;
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); setAc({ r, i: (ac.i + (e.key === 'ArrowDown' ? 1 : -1) + sugg.length) % sugg.length }); return; }
    if (open && (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey && ac.i >= 0))) { if (ac.i >= 0) { e.preventDefault(); pick(r, sugg[ac.i]); return; } }
    if (e.key === 'Escape' && ac) { e.preventDefault(); setAc(null); return; }
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); setAc(null); focus(Math.min(r + 1, rows.length - 1), c); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAc(null); focus(Math.max(0, r - 1), c); }
  };

  const cell = 'w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs text-[rgb(var(--fg))] focus:border-[rgb(var(--accent))] focus:bg-[rgb(var(--bg))] focus:outline-none disabled:opacity-80';
  const num = cn(cell, 'text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none');
  const missing = items.filter((l) => !(l.listPrice ?? l.price)).length;
  const isNew = items.filter((l) => l.name.trim() && !l.sku && !exactMatch(l.name, cat).draft).length;
  return (
    <div className="space-y-2">
      {!locked && (
        <div className="flex flex-wrap items-center gap-2">
          <FilePicker accept="image/*,application/pdf" onFiles={(fs) => void extract(fs)} disabled={!!busy} className={cn(btnGhost, btnSm)}>
            {busy ? <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> : <ScanText className="h-3.5 w-3.5" aria-hidden />}{busy ? 'Đang đọc…' : 'Nhập từ ảnh / PDF'}
          </FilePicker>
          {typeof navigator !== 'undefined' && !!navigator.clipboard?.readText && <button className={cn(btnGhost, btnSm)} onClick={() => void pasteButton()}><ClipboardPaste className="h-3.5 w-3.5" aria-hidden />Dán từ Excel</button>}
          <button className={cn(btnGhost, btnSm, 'hidden lg:inline-flex')} onClick={() => onWide(!wide)} aria-pressed={wide}>{wide ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}{wide ? 'Thu gọn bảng' : 'Mở rộng bảng'}</button>
          {items.length > 0 && <button className={cn(btnGhost, btnSm, 'ml-auto hover:text-[rgb(var(--danger-fg))]')} onClick={() => { const prev = items; onChange([]); notify('Đã xóa hết dòng hàng', 'orange', { label: 'Hoàn tác', run: () => onChange(prev) }); }}><Trash2 className="h-3.5 w-3.5" aria-hidden />Xóa hết</button>}
        </div>
      )}
      {busy && <p className="flex items-center gap-2 rounded-md border border-[rgb(var(--secondary)/0.4)] bg-[rgb(var(--secondary)/0.08)] px-3 py-2 text-xs text-[rgb(var(--secondary-fg))]" role="status"><Sparkles className="h-3.5 w-3.5" aria-hidden />{busy} Các dòng sẽ tự thêm vào cuối bảng.</p>}
      <div ref={ref} onPaste={onPaste} className="-mx-1 overflow-x-auto px-1" aria-label="Bảng dòng hàng báo giá">
        <table className="w-full min-w-[640px] table-fixed text-xs">
          <colgroup><col className="w-7" /><col /><col className="w-[60px]" /><col className="w-[60px]" /><col className={wide ? 'w-[110px]' : 'w-[92px]'} /><col className="w-[48px]" /><col className={wide ? 'w-[120px]' : 'w-[96px]'} /><col className="w-[64px]" />{canSeeCost && <col className="w-[44px]" />}<col className="w-7" /></colgroup>
          <thead className="border-b border-[rgb(var(--line))] text-[11.5px] text-[rgb(var(--muted))]">
            <tr><th className="py-2 text-center font-normal">#</th><th className="px-2 text-left font-medium">Tên hàng / quy cách</th><th className="px-1 text-left font-medium">ĐVT</th><th className="px-1 text-right font-medium">SL</th><th className="px-1 text-right font-medium">Đơn giá</th><th className="px-1 text-right font-medium">CK %</th><th className="px-2 text-right font-medium">Thành tiền</th><th className="px-1 text-right font-medium">Kho</th>{canSeeCost && <th className="px-1 text-right font-medium">GM</th>}<th /></tr>
          </thead>
          <tbody>
            {rows.map((l, r) => {
              const ghost = r >= items.length;
              const k = l.sku ? skus.find((s) => s.sku === l.sku) : undefined;
              const dr = !k && l.name.trim() ? exactMatch(l.name, cat).draft : undefined;
              const sugg = ac?.r === r ? smartSuggest(l.name, cat) : [];
              const lineGm = k?.costPrice && l.price ? ((l.price - k.costPrice) / l.price) * 100 : null;
              const hot = flash && r >= flash.from && r < flash.from + flash.n;
              return (
                <tr key={r} className={cn('border-t border-[rgb(var(--line))] align-top', hot && 'bg-[rgb(var(--success)/0.1)]', ghost && 'bg-[rgb(var(--raised)/0.4)]')}>
                  <td className="py-2 text-center text-[11px] tabular-nums text-[rgb(var(--faint))]">{ghost ? <Plus className="mx-auto h-3 w-3" aria-hidden /> : r + 1}</td>
                  <td className="relative px-1 py-1">
                    <input data-r={r} data-c={0} disabled={locked} className={cell} value={l.name} placeholder={ghost ? 'Gõ tên hàng hoặc dán bảng từ Excel (Ctrl + V)' : ''} autoComplete="off"
                      onChange={(e) => { upd(r, { name: e.target.value }); setAc({ r, i: -1 }); }} onFocus={() => setAc(null)} onBlur={() => setTimeout(() => setAc((a) => (a?.r === r ? null : a)), 150)}
                      onKeyDown={(e) => onKey(e, r, 0, sugg)} aria-label={`Tên hàng dòng ${r + 1}`} aria-autocomplete="list" aria-expanded={sugg.length > 0} />
                    {!ghost && (
                      <p className="mt-0.5 flex items-center gap-1 truncate px-1.5 text-[11px] text-[rgb(var(--muted))]">
                        {l.ai && <span className="rounded bg-[rgb(var(--secondary)/0.15)] px-1 font-semibold text-[rgb(var(--secondary-fg))]">AI</span>}
                        {k ? <span className="truncate"><span className="code-chip">{k.sku}</span></span>
                          : dr ? <span className="truncate">Nháp · bán gần nhất {dr.lastPrice.toLocaleString('vi-VN')}đ, {new Date(dr.lastAt).toLocaleDateString('vi-VN')}</span>
                          : l.name.trim() ? <span className="truncate text-[rgb(var(--accent-fg))]">Mới · tự lưu vào danh mục nháp khi tạo báo giá</span> : null}
                      </p>
                    )}
                    {sugg.length > 0 && (
                      <ul className="absolute left-1 top-full z-40 mt-0.5 max-h-72 w-[26rem] min-w-[calc(100%-0.5rem)] overflow-y-auto rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 shadow-[var(--shadow-lg)] max-lg:static max-lg:w-auto" role="listbox" aria-label="Gợi ý hàng hóa">
                        {sugg.map((s, i) => (
                          <li key={s.key} role="option" aria-selected={ac?.i === i}>
                            <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); pick(r, s); }} className={cn('flex w-full items-start gap-2 rounded px-2 py-1.5 text-left', ac?.i === i ? 'bg-[rgb(var(--secondary)/0.12)]' : 'hover:bg-[rgb(var(--ink)/0.05)]')}>
                              <span className={cn('mt-0.5 shrink-0 rounded px-1 text-[11px] font-semibold', s.kind === 'SKU' ? 'bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success-fg))]' : 'bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent-fg))]')}>{s.kind === 'SKU' ? 'DM' : 'NHÁP'}</span>
                              <span className="min-w-0 flex-1"><span className="block truncate text-xs text-[rgb(var(--fg))]">{s.name}</span><span className="block truncate text-[11px] text-[rgb(var(--muted))]">{s.sub}</span></span>
                              <span className="shrink-0 text-right text-xs font-semibold tabular-nums">{s.price ? s.price.toLocaleString('vi-VN') : '—'}<span className="block text-[11px] font-normal text-[rgb(var(--muted))]">/{s.unit}</span></span>
                            </button>
                          </li>
                        ))}
                        <li className="px-2 pb-1 pt-1.5 text-[11px] text-[rgb(var(--faint))]">↑ ↓ chọn · Enter điền giá · Esc giữ tên đang gõ</li>
                      </ul>
                    )}
                  </td>
                  <td className="px-0.5 py-1"><input data-r={r} data-c={1} disabled={locked} className={cell} value={l.unit} onChange={(e) => upd(r, { unit: e.target.value })} onKeyDown={(e) => onKey(e, r, 1, [])} aria-label={`Đơn vị tính dòng ${r + 1}`} /></td>
                  <td className="px-0.5 py-1"><input data-r={r} data-c={2} disabled={locked} className={num} inputMode="decimal" value={numText(r, 2, l.qty, ghost && !l.qty)} onChange={(e) => typeNum(r, 2, e.target.value, (n) => upd(r, { qty: n }))} onBlur={() => setEd(null)} onKeyDown={(e) => onKey(e, r, 2, [])} aria-label={`Số lượng dòng ${r + 1}`} /></td>
                  <td className="px-0.5 py-1"><input data-r={r} data-c={3} disabled={locked} className={cn(num, !ghost && !(l.listPrice ?? l.price) && 'border-[rgb(var(--accent)/0.6)] bg-[rgb(var(--accent)/0.06)]')} inputMode="numeric" placeholder={ghost ? '' : 'Nhập giá'} value={(l.listPrice ?? l.price) ? (l.listPrice ?? l.price).toLocaleString('vi-VN') : ''} onChange={(e) => upd(r, { listPrice: digits(e.target.value) })} onKeyDown={(e) => onKey(e, r, 3, [])} aria-label={`Đơn giá dòng ${r + 1}`} /></td>
                  <td className="px-0.5 py-1"><input data-r={r} data-c={4} disabled={locked} className={num} inputMode="decimal" value={numText(r, 4, l.discountPct ?? 0, ghost)} onChange={(e) => typeNum(r, 4, e.target.value, (n) => upd(r, { discountPct: Math.min(100, Math.max(0, n)) }))} onBlur={() => setEd(null)} onKeyDown={(e) => onKey(e, r, 4, [])} aria-label={`Chiết khấu dòng ${r + 1}`} /></td>
                  <td className="px-2 py-2 text-right tabular-nums">{!ghost && <span className="font-medium text-[rgb(var(--fg))]">{Math.round(l.qty * l.price).toLocaleString('vi-VN')}</span>}</td>
                  <td className={cn('px-1 py-2 text-right text-[11px] tabular-nums', k && l.qty > k.stock ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')} title={k && l.qty > k.stock ? `Thiếu ${(l.qty - k.stock).toLocaleString('vi-VN')} ${l.unit}` : undefined}>{!ghost && (k ? `tồn ${k.stock.toLocaleString('vi-VN')}` : '—')}</td>
                  {canSeeCost && <td className={cn('px-1 py-2 text-right font-mono text-[11px] tabular-nums', lineGm !== null && lineGm < GM_RULE.bod ? 'text-[rgb(var(--danger-fg))]' : lineGm !== null && lineGm < GM_RULE.head ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--fg2))]')}>{!ghost && (lineGm !== null ? `${lineGm.toFixed(0)}%` : '—')}</td>}
                  <td className="py-1.5 pr-1 text-center">{!ghost && !locked && <button tabIndex={-1} className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => onChange(items.filter((_, j) => j !== r))} aria-label={`Xóa dòng ${r + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!locked && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[rgb(var(--muted))]">
          <span><kbd className="rounded border border-[rgb(var(--line))] px-1">Ctrl</kbd> + <kbd className="rounded border border-[rgb(var(--line))] px-1">V</kbd> dán bảng (Tên, ĐVT, SL, Đơn giá) từ Excel / Word, tự nhận cột</span>
          <span className="hidden lg:inline"><kbd className="rounded border border-[rgb(var(--line))] px-1">Enter</kbd> xuống dòng · <kbd className="rounded border border-[rgb(var(--line))] px-1">↑↓</kbd> chọn gợi ý</span>
          {isNew > 0 && <span className="text-[rgb(var(--accent-fg))]">{isNew} hàng mới sẽ vào danh mục nháp</span>}
          {missing > 0 && <span className="text-[rgb(var(--danger-fg))]">{missing} dòng chưa có đơn giá</span>}
        </p>
      )}
    </div>
  );
}

/** Danh mục nháp: vật tư học được từ báo giá, xem giá gần nhất, chuyển thành mã hàng chính thức */
export function DraftCatalog() {
  const { draftProducts, setDraftProducts, skus, setSkus, canDo, notify, userName } = useApp();
  const [q, setQ] = useState('');
  const canEdit = canDo('po.manage');
  const list = draftProducts.filter((d) => !d.promotedSku && (!q || d.key.includes(normKey(q)))).sort((a, b) => b.lastAt - a.lastAt);
  const paged = usePaged(list, 20);
  const promote = (d: DraftProduct) => {
    const code = nextCode(skus.map((s) => s.sku), 'VT-', 5);
    const s: SkuItem = { sku: code, name: d.name, brand: '', category: 'Vật tư từ báo giá', unit: d.unit || 'Cái', minStock: 0, maxStock: 0, leadTimeDays: 0, stock: 0, costPrice: 0, basePrice: d.lastPrice, dealerPrice: d.lastPrice, projectPrice: d.lastPrice, vatPct: 8 };
    setSkus((p) => [s, ...p]);
    setDraftProducts((p) => p.map((x) => (x.id === d.id ? { ...x, promotedSku: code } : x)));
    notify(`Đã tạo mã ${code} cho ${d.name}. Bổ sung giá vốn, nhóm hàng ở tab Tất cả.`, 'teal');
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-sm text-[rgb(var(--muted))]">Hàng Sales gõ tự do khi báo giá được tự lưu ở đây kèm giá bán gần nhất, để lần sau gõ là có gợi ý. Chuyển thành mã chính thức khi cần quản lý tồn kho.</p>
        <input className={cn(inputBase, 'w-64')} placeholder="Tìm tên vật tư" value={q} onChange={(e) => { setQ(e.target.value); paged.setPage(1); }} aria-label="Tìm trong danh mục nháp" />
      </div>
      {list.length ? (
        <>
          <Table stt={Math.max(0, paged.from - 1)} head={['Tên hàng / quy cách', 'ĐVT', <span key="p" className="block text-right">Giá bán gần nhất</span>, 'Lần cuối', <span key="u" className="block text-right">Số lần</span>, <span key="a" className="block text-right">Thao tác</span>]} minW={860}>
            {paged.slice.map((d) => (
              <tr key={d.id} className={rowCls}>
                <td className={tdCls}><p className="font-medium">{d.name}</p>{(d.history?.length ?? 0) > 1 && <p className="text-xs text-[rgb(var(--muted))]">Giá các lần: {d.history!.slice(0, 4).map((h) => h.price.toLocaleString('vi-VN')).join(' · ')}</p>}</td>
                <td className={tdCls}>{d.unit}</td>
                <td className={cn(tdCls, 'text-right font-num')}>{d.lastPrice.toLocaleString('vi-VN')}</td>
                <td className={tdCls}><p>{new Date(d.lastAt).toLocaleDateString('vi-VN')}{d.lastQuote ? ` · ${d.lastQuote}` : ''}</p><p className="text-xs text-[rgb(var(--muted))]">{d.lastCustomer ?? ''}{d.lastBy ? ` · ${userName(d.lastBy)}` : ''}</p></td>
                <td className={cn(tdCls, 'text-right tabular-nums')}>{d.uses}</td>
                <td className={cn(tdLast, 'text-right')}>
                  <div className="flex justify-end gap-1.5">
                    <button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => promote(d)}><PackagePlus className="h-3.5 w-3.5" aria-hidden />Tạo mã hàng</button>
                    <button className={cn(btnGhost, 'p-1.5 hover:text-[rgb(var(--danger-fg))]')} disabled={!canEdit} onClick={() => removeWithUndo(setDraftProducts, d, notify, `Đã xóa ${d.name} khỏi danh mục nháp`)} aria-label={`Xóa ${d.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination paged={paged} unit="vật tư" />
        </>
      ) : <EmptyState art="box" text={q ? 'Không có vật tư khớp' : 'Danh mục nháp đang trống'} hint={q ? undefined : 'Khi Sales tạo báo giá với tên hàng gõ tự do, vật tư và đơn giá được lưu ở đây.'} />}
    </div>
  );
}

