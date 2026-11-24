'use client';

import { type ReactNode, useState } from 'react';
import { ArrowLeftRight, Boxes, ChevronDown, Download, Eye, FileSpreadsheet, FileText, ImagePlus, Package, PackageMinus, PackagePlus, Paperclip, Pencil, Plus, RefreshCw, ScrollText, Search, SlidersHorizontal, Star, Trash2, Upload, X } from 'lucide-react';
import { useOutsideClose } from '../../app/header';
import { useIntent } from '../../components/command-palette';
import { Pagination, RowMenu, usePaged } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Drawer } from '../../components/drawer';
import { Chip, Code, EmptyState, Field, FilePicker, Modal, MoneyInput, Panel, SideSheet, Table, Tabs, useSort, useSticky } from '../../components/ui';
import { poLineStats } from '../../lib/business';
import { btnGhost, btnPrimary, btnSm, cfMissing, cfSet, chatFileMax, downloadBlob, fmtDate, fmtN, fmtSize, fold, inputBase, inputCls, MAIN_WH, MOVE_LABEL, reservedInStock, rowCls, shrinkImage, SKU_FILTER0, SKU_IMPORT_COLS, SKU_RE, stickyStore, STOCK_LEVEL, stockLevel, tdCls, tdFirst, tdLast, todayISO, UNITS, useApp, whQty } from '../../lib/core';
import { downloadCsv, parseCsv, readXlsx, xlsxBlob } from '../../lib/csv';
import type { ConfirmState, ImportRow, SkuFilter, SkuItem, StockLevel, StockMoveType, StockVoucher, VoucherType, WarehouseInfo } from '../../lib/types';
import { cn } from '../../lib/utils';
import { DraftCatalog } from '../sales/smart-quote';
import { useWarehouseData, VoucherModal } from '../warehouse/warehouse';
import { EntityCfDetail, EntityCfForm, useEntityFormLayout } from '../page-builder';

export function SkuModal({ sku, onClose }: { sku?: SkuItem; onClose: () => void }) {
  const { skus, setSkus, notify, canDo, warehouses, addMoves, me } = useApp();
  const canSeeCost = canDo('price.viewCost');
  const [f, setF] = useState<SkuItem>(sku ?? { sku: '', name: '', brand: '3M', category: '', unit: 'Cái', minStock: 0, maxStock: 0, leadTimeDays: 90, stock: 0, costPrice: 0, basePrice: 0, dealerPrice: 0, projectPrice: 0, vatPct: 8 });
  const [opening, setOpening] = useState(0);
  const [openWh, setOpenWh] = useState(warehouses.find((w) => w.main)?.id ?? MAIN_WH);
  const [more, setMore] = useState(!!sku);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof SkuItem>(k: K, v: SkuItem[K]) => setF((p) => ({ ...p, [k]: v }));
  const e: Partial<Record<keyof SkuItem | 'opening', string>> = {};
  if (!/^[A-Z0-9][A-Z0-9._-]{2,39}$/.test(f.sku)) e.sku = 'Mã viết hoa không dấu, 3–40 ký tự (chữ, số, - . _)';
  else if (!sku && skus.some((s) => s.sku === f.sku)) e.sku = 'Mã SKU đã tồn tại';
  if (f.name.trim().length < 3) e.name = 'Nhập tên sản phẩm';
  if (!f.brand.trim()) e.brand = 'Nhập thương hiệu';
  if (f.minStock < 0) e.minStock = 'Không âm';
  if (f.maxStock < f.minStock) e.maxStock = 'Max phải ≥ Min';
  if (f.leadTimeDays < 0 || f.leadTimeDays > 365) e.leadTimeDays = 'Từ 0 đến 365 ngày';
  if (f.basePrice <= 0) e.basePrice = 'Nhập giá bán lẻ';
  if (f.dealerPrice > f.basePrice) e.dealerPrice = 'Không cao hơn giá bán lẻ';
  if (f.projectPrice > f.basePrice) e.projectPrice = 'Không cao hơn giá bán lẻ';
  if (f.vatPct !== undefined && (f.vatPct < 0 || f.vatPct > 20)) e.vatPct = 'Từ 0 đến 20%';
  if (!sku && (opening < 0 || !Number.isInteger(opening))) e.opening = 'Số nguyên không âm';
  const err = (k: keyof SkuItem | 'opening') => (touched ? e[k] : undefined);
  const brands = Array.from(new Set(['3M', 'Hilti', ...skus.map((s) => s.brand)]));
  const list = (k: 'category' | 'supplier' | 'origin') => Array.from(new Set(skus.map((s) => s[k]).filter(Boolean) as string[]));
  const main = warehouses.find((w) => w.main)?.id ?? MAIN_WH;
  const bd = sku ? warehouses.map((w) => ({ w, n: whQty(sku, w.id, warehouses) })).filter((x) => x.n > 0) : [];
  const addDocs = (fs: File[]) => fs.forEach((file) => {
    if (file.size > chatFileMax()) return notify(`${file.name} vượt ${fmtSize(chatFileMax())}`, 'red');
    const r = new FileReader(); r.onload = () => setF((p) => ({ ...p, docs: [...(p.docs ?? []), { name: file.name, size: file.size, type: file.type || 'application/octet-stream', url: String(r.result) }] })); r.readAsDataURL(file);
  });
  // v55.3: trường tùy chỉnh sản phẩm (chưa có trang thiết kế: theo cờ "Form" của trường; cùng quy tắc kiểm tra với máy chủ)
  const fl = useEntityFormLayout('product');
  const cfMiss = cfMissing(fl.formDefs, f.cf, 'SAVE');
  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) { if (e.brand || e.vatPct) setMore(true); return; }
    if (cfMiss.length) return notify(`${cfMiss[0].type === 'check' ? 'Cần tích' : 'Nhập'} ${cfMiss[0].label}`, 'red');
    const clean: SkuItem = { ...f, cf: f.cf && Object.keys(f.cf).length ? f.cf : undefined, name: f.name.trim(), brand: f.brand.trim(), category: f.category.trim(), supplier: f.supplier?.trim() || undefined, origin: f.origin?.trim() || undefined, dealerPrice: f.dealerPrice || f.basePrice, projectPrice: f.projectPrice || f.basePrice };
    if (sku) setSkus((all) => all.map((s) => (s.sku === sku.sku ? { ...clean, stock: s.stock, whStock: s.whStock } : s)));
    else {
      const created: SkuItem = { ...clean, stock: opening, ...(opening && openWh !== main ? { whStock: { [openWh]: opening } } : {}) };
      setSkus((all) => [created, ...all]);
      if (opening) addMoves([{ at: todayISO(), sku: created.sku, type: 'RECEIVE_FREE', qty: opening, toWh: openWh, by: me?.id, note: 'Tồn đầu kỳ khi tạo sản phẩm' }]);
    }
    notify(sku ? `Đã cập nhật ${clean.sku}` : `Đã thêm sản phẩm ${clean.sku}`, 'teal');
    onClose();
  };
  const sec = (n: number, t: string, hint?: string) => <div className="col-span-full mt-1 flex items-center gap-2 border-b border-[rgb(var(--line))] pb-1.5"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--secondary)/0.15)] text-[11px] font-semibold text-[rgb(var(--secondary-fg))]">{n}</span><h3 className="text-xs font-semibold text-[rgb(var(--fg2))]">{t}</h3>{hint && <span className="ml-auto text-[11px] text-[rgb(var(--muted))]">{hint}</span>}</div>;
  const margin = (p: number) => (canSeeCost && p > 0 && f.costPrice > 0 ? <span className={cn('text-[11px]', p > f.costPrice ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>Lãi gộp {Math.round(((p - f.costPrice) / p) * 100)}%</span> : undefined);

  return (
    <Modal title={sku ? `Sửa sản phẩm ${sku.sku}` : 'Thêm sản phẩm mới'} onClose={onClose} wide footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>{sku ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</button></>}>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-6">
        {sec(1, 'Sản phẩm')}
        <Field label="Mã SKU *" error={err('sku')} className="sm:col-span-2" hint={sku ? 'Không đổi được sau khi tạo' : 'VD: 3M-SCOTCH-23'}><input className={cn(inputCls, 'font-mono')} disabled={!!sku} value={f.sku} onChange={(ev) => set('sku', ev.target.value.toUpperCase().replace(/\s/g, ''))} autoFocus={!sku} /></Field>
        <Field label="Tên sản phẩm *" error={err('name')} className="sm:col-span-3"><input className={inputCls} value={f.name} onChange={(ev) => set('name', ev.target.value)} placeholder="Băng keo cách điện cao áp Scotch 23, 19mm x 9,1m" /></Field>
        <Field label="Đơn vị tính" className="sm:col-span-1"><select className={inputCls} value={f.unit} onChange={(ev) => set('unit', ev.target.value)}>{Array.from(new Set([...UNITS, 'Cái', f.unit])).map((u) => <option key={u} value={u}>{u}</option>)}</select></Field>

        {sec(2, 'Giá bán', 'Đơn vị: đồng, chưa VAT')}
        <Field label="Giá bán lẻ *" error={err('basePrice')} className="sm:col-span-2"><MoneyInput value={f.basePrice} onChange={(n) => set('basePrice', n)} />{margin(f.basePrice)}</Field>
        <Field label="Giá đại lý" error={err('dealerPrice')} hint={f.dealerPrice ? undefined : 'Trống = theo giá bán lẻ'} className="sm:col-span-2"><MoneyInput value={f.dealerPrice} onChange={(n) => set('dealerPrice', n)} />{margin(f.dealerPrice || f.basePrice)}</Field>
        <Field label="Giá dự án" error={err('projectPrice')} hint={f.projectPrice ? undefined : 'Trống = theo giá bán lẻ'} className="sm:col-span-2"><MoneyInput value={f.projectPrice} onChange={(n) => set('projectPrice', n)} />{margin(f.projectPrice || f.basePrice)}</Field>

        {sec(3, 'Tồn kho & lead-time')}
        {sku ? (
          <div className="rounded-md bg-[rgb(var(--raised))] p-3 text-sm sm:col-span-2"><p className="text-xs text-[rgb(var(--muted))]">Tồn kho hiện tại</p><p className="font-semibold tabular-nums">{fmtN(sku.stock)} {sku.unit}</p>{bd.length > 1 && <p className="mt-0.5 text-[11px] text-[rgb(var(--muted))]">{bd.map((x) => `${x.w.code}: ${fmtN(x.n)}`).join(' · ')}</p>}<p className="mt-1 text-[11px] text-[rgb(var(--muted))]">Thay đổi qua phiếu nhập / xuất / kiểm kho.</p></div>
        ) : (
          <>
            <Field label="Tồn đầu kỳ" error={err('opening')} className="sm:col-span-1"><input className={inputCls} type="number" min={0} value={opening || ''} onChange={(ev) => setOpening(Number(ev.target.value))} placeholder="0" /></Field>
            <Field label="Tại kho" className="sm:col-span-1"><select className={inputCls} disabled={!opening} value={openWh} onChange={(ev) => setOpenWh(ev.target.value)}>{warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}</select></Field>
          </>
        )}
        <Field label="Lead-time (ngày)" error={err('leadTimeDays')} className="sm:col-span-2"><input className={inputCls} type="number" min={0} value={f.leadTimeDays} onChange={(ev) => set('leadTimeDays', Number(ev.target.value))} /></Field>
        <Field label="Min" error={err('minStock')} className="sm:col-span-1"><input className={inputCls} type="number" min={0} value={f.minStock} onChange={(ev) => set('minStock', Number(ev.target.value))} /></Field>
        <Field label="Max" error={err('maxStock')} className="sm:col-span-1"><input className={inputCls} type="number" min={0} value={f.maxStock} onChange={(ev) => set('maxStock', Number(ev.target.value))} /></Field>

        {sec(4, 'Tài liệu', 'Catalogue, datasheet, CO/CQ, hướng dẫn lắp đặt')}
        <div className="col-span-full space-y-2">
          {(f.docs ?? []).length > 0 && <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{f.docs!.map((d, i) => <li key={`${d.name}-${i}`} className="flex items-center gap-2 rounded-md border border-[rgb(var(--line))] px-3 py-1.5 text-sm"><FileText className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="min-w-0 flex-1 truncate">{d.name}</span><span className="text-xs text-[rgb(var(--muted))]">{fmtSize(d.size)}</span><button className="rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setF((p) => ({ ...p, docs: (p.docs ?? []).filter((_, j) => j !== i) }))} aria-label={`Bỏ ${d.name}`}><X className="h-4 w-4" aria-hidden /></button></li>)}</ul>}
          <FilePicker multiple onFiles={addDocs} className={cn(btnGhost, btnSm)}><Paperclip className="h-3.5 w-3.5" aria-hidden />Đính kèm tài liệu</FilePicker>
        </div>

        <button type="button" className="col-span-full mt-1 flex items-center gap-2 border-b border-[rgb(var(--line))] pb-1.5 text-left" onClick={() => setMore((v) => !v)} aria-expanded={more}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--secondary)/0.15)] text-[11px] font-semibold text-[rgb(var(--secondary-fg))]">5</span>
          <span className="text-xs font-semibold text-[rgb(var(--fg2))]">Thông tin bổ sung</span>
          <span className="text-[11px] text-[rgb(var(--muted))]">ảnh, thương hiệu, phân loại, nhà cung cấp, VAT{canSeeCost ? ', giá vốn' : ''}</span>
          <ChevronDown className={cn('ml-auto h-4 w-4 text-[rgb(var(--muted))] transition-transform', more && 'rotate-180')} aria-hidden />
        </button>
        {more && (
          <>
            <div className="flex flex-col items-center gap-2 sm:col-span-1 sm:row-span-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.image ? <img src={f.image} alt="Ảnh sản phẩm" className="h-24 w-24 rounded-md border border-[rgb(var(--line))] object-cover" /> : <span className="flex h-24 w-24 items-center justify-center rounded-md border border-dashed border-[rgb(var(--line))] text-[rgb(var(--muted))]"><Package className="h-7 w-7" aria-hidden /></span>}
              <div className="flex gap-1">
                <FilePicker accept="image/*" onFiles={(fs) => { const x = fs[0]; if (x) shrinkImage(x).then((u) => set('image', u), (er) => notify(er instanceof Error ? er.message : 'Lỗi ảnh', 'red')); }} className={cn(btnGhost, btnSm)}><ImagePlus className="h-3.5 w-3.5" aria-hidden />{f.image ? 'Đổi' : 'Ảnh'}</FilePicker>
                {f.image && <button className={cn(btnGhost, btnSm)} onClick={() => set('image', undefined)} aria-label="Bỏ ảnh"><X className="h-3.5 w-3.5" aria-hidden /></button>}
              </div>
            </div>
            <Field label="Thương hiệu *" error={err('brand')} className="sm:col-span-2"><input className={inputCls} list="sku-brands" value={f.brand} onChange={(ev) => set('brand', ev.target.value)} /></Field>
            <datalist id="sku-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
            <Field label="Phân loại / ngành hàng" className="sm:col-span-3"><input className={inputCls} list="sku-cats" value={f.category} onChange={(ev) => set('category', ev.target.value)} /></Field>
            <datalist id="sku-cats">{list('category').map((c) => <option key={c} value={c} />)}</datalist>
            <Field label="Nhà cung cấp" className="sm:col-span-2"><input className={inputCls} list="sku-sup" value={f.supplier ?? ''} onChange={(ev) => set('supplier', ev.target.value)} placeholder="VD: 3M Việt Nam" /></Field>
            <datalist id="sku-sup">{list('supplier').map((c) => <option key={c} value={c} />)}</datalist>
            <Field label="Xuất xứ" className="sm:col-span-1"><input className={inputCls} list="sku-origin" value={f.origin ?? ''} onChange={(ev) => set('origin', ev.target.value)} /></Field>
            <datalist id="sku-origin">{Array.from(new Set(['Mỹ', 'Singapore', 'Thái Lan', 'Trung Quốc', 'Nhật Bản', 'Việt Nam', ...list('origin')])).map((c) => <option key={c} value={c} />)}</datalist>
            <Field label="VAT" error={err('vatPct')} className="sm:col-span-1"><select className={inputCls} value={f.vatPct ?? ''} onChange={(ev) => set('vatPct', ev.target.value === '' ? undefined : Number(ev.target.value))}><option value="">—</option>{[0, 5, 8, 10].map((v) => <option key={v} value={v}>{v}%</option>)}</select></Field>
            {canSeeCost && <Field label="Giá vốn nhập Hãng" className="sm:col-span-1" hint="Chỉ người có quyền xem"><MoneyInput value={f.costPrice} onChange={(n) => set('costPrice', n)} /></Field>}
          </>
        )}
      </div>
      <div className="mt-4"><EntityCfForm entity="product" vals={f.cf} onChange={(k, v) => set('cf', cfSet(f.cf, k, v))} /></div>
    </Modal>
  );
}

export function downloadSkuTemplate(warehouses: WarehouseInfo[]) {
  const wh = warehouses.filter((w) => w.active);
  downloadBlob('Template_DanhMuc_SanPham.xlsx', xlsxBlob([
    { name: 'DanhMuc_SanPham', widths: [18, 46, 14, 14, 14, 12, 14, 10, 12, 14, 24, 14, 8, 8, 9, 22, 12], rows: [
      [...SKU_IMPORT_COLS],
      ['3M-SCOTCH-23', 'Băng keo cách điện cao áp Scotch 23, 19mm x 9,1m', 320000, 270000, 285000, 120, wh[0]?.code ?? 'KHO-TONG', 60, 'Cuộn', '3M', 'Băng keo điện', 230000, 200, 1500, 8, '3M Việt Nam', 'Mỹ'],
      ['3M-SCOTCH-23', '', '', '', '', wh[1] ? 40 : '', wh[1]?.code ?? '', '', '', '', '', '', '', '', '', '', ''],
    ] },
    { name: 'HuongDan', widths: [22, 90], rows: [
      ['Cột', 'Hướng dẫn'],
      ['SKU *', 'Mã viết hoa không dấu, 3–40 ký tự (chữ, số, - . _). Trùng SKU đã có: chọn Cập nhật hoặc Bỏ qua khi nhập.'],
      ['Tên sản phẩm *', 'Tên và quy cách, tối thiểu 3 ký tự'],
      ['Thương hiệu *', 'VD: 3M'],
      ['Đơn vị tính', 'VD: Bộ, Cuộn, Hộp, Tuýp. Trống = Cái'],
      ['Giá vốn / bán lẻ / đại lý / dự án', 'Số, đơn vị đồng, không âm. Để trống giá đại lý / dự án thì lấy theo giá bán lẻ'],
      ['Min / Max', 'Tồn an toàn tối thiểu / tối đa (Max ≥ Min)'],
      ['Lead-time', 'Số ngày đặt hàng Hãng, mặc định 90'],
      ['Mã kho', `Mã kho nhận tồn đầu kỳ (xem trang DanhMuc_Kho). Trống = ${wh.find((w) => w.main)?.code ?? 'kho tổng'}`],
      ['Tồn đầu kỳ', 'Chỉ áp dụng cho SKU mới. Một SKU có tồn ở nhiều kho: thêm dòng cùng SKU, chỉ ghi Mã kho + Tồn đầu kỳ'],
      ['VAT (%) / Nhà cung cấp / Xuất xứ', 'Không bắt buộc. VAT nhận 0, 5, 8, 10'],
    ] },
    { name: 'DanhMuc_Kho', widths: [14, 32, 40], rows: [['Mã kho', 'Tên kho', 'Địa chỉ'], ...wh.map((w) => [w.code, w.name, w.address])] },
  ]));
}

/** Nhập danh mục sản phẩm từ Excel / CSV: kiểm tra từng dòng, xem trước, chỉ ghi dòng hợp lệ */
export function SkuImportModal({ onClose }: { onClose: () => void }) {
  const { skus, setSkus, warehouses, notify, addMoves, me, canDo } = useApp();
  const canSeeCost = canDo('price.viewCost');
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'update' | 'skip'>('skip');
  const [busy, setBusy] = useState(false);
  const [showErr, setShowErr] = useState(false);
  const parse = (table: string[][]) => {
    const head = (table[0] ?? []).map((h) => fold(String(h).replace('*', '').trim()));
    const idx = (c: string) => head.indexOf(fold(c));
    const miss = ['SKU', 'Tên sản phẩm', 'Giá bán lẻ'].filter((c) => idx(c) < 0);
    if (miss.length) { notify(`File thiếu cột ${miss.join(', ')}. Hãy dùng file mẫu.`, 'red'); return; }
    const get = (r: string[], c: string) => { const i = idx(c); return i < 0 ? '' : String(r[i] ?? '').trim(); };
    const num = (r: string[], c: string, errs: string[], def?: number) => {
      const v = get(r, c); if (!v) return def;
      const n = Number(v.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) { errs.push(`${c} không hợp lệ (“${v}”)`); return def; } return n;
    };
    const seen = new Map<string, ImportRow>(); const out: ImportRow[] = [];
    table.slice(1).forEach((r, i) => {
      const errors: string[] = []; const warn: string[] = [];
      const sku = get(r, 'SKU').toUpperCase();
      const whCode = get(r, 'Mã kho') || get(r, 'Tên kho');
      const wh = whCode ? warehouses.find((w) => fold(w.code) === fold(whCode) || fold(w.name) === fold(whCode)) : warehouses.find((w) => w.main);
      if (whCode && !wh) errors.push(`Không có kho “${whCode}”`);
      else if (wh && !wh.active) errors.push(`Kho ${wh.code} đang tạm ngưng`);
      const open = num(r, 'Tồn đầu kỳ', errors, 0) ?? 0;
      if (!SKU_RE.test(sku)) errors.push(sku ? 'SKU sai định dạng' : 'Thiếu SKU');
      const first = seen.get(sku);
      if (first) {
        // Dòng phụ cùng SKU: chỉ để phân bổ tồn đầu kỳ cho kho khác
        if ((first.wh ?? '') === (wh?.id ?? '')) errors.push(`Trùng SKU và kho với dòng ${first.line}`);
        if (!open) warn.push('Dòng phụ không có tồn đầu kỳ');
        out.push({ line: i + 2, sku, data: first.data, wh: wh?.id, open, errors, warn, exists: first.exists, extra: true });
        return;
      }
      const name = get(r, 'Tên sản phẩm'); const unit = get(r, 'Đơn vị tính') || 'Cái'; const brand = get(r, 'Thương hiệu') || '3M';
      if (name.length < 3) errors.push('Thiếu tên sản phẩm');
      const base = num(r, 'Giá bán lẻ', errors, 0) ?? 0;
      const min = num(r, 'Min', errors, 0) ?? 0; const max = num(r, 'Max', errors, 0) ?? 0;
      if (max && max < min) errors.push('Max nhỏ hơn Min');
      const ex = skus.find((s) => s.sku === sku);
      const data: Partial<SkuItem> = { sku, name, brand, category: get(r, 'Phân loại'), unit, basePrice: base, dealerPrice: num(r, 'Giá đại lý', errors, base) ?? base, projectPrice: num(r, 'Giá dự án', errors, base) ?? base, minStock: min, maxStock: max, leadTimeDays: num(r, 'Lead-time', errors, 90) ?? 90 };
      const cost = num(r, 'Giá vốn', errors);
      if (cost !== undefined) data.costPrice = cost;
      const vat = num(r, 'VAT (%)', errors); if (vat !== undefined) { if (vat > 20) errors.push('VAT phải ≤ 20%'); else data.vatPct = vat; }
      const sup = get(r, 'Nhà cung cấp'); if (sup) data.supplier = sup;
      const org2 = get(r, 'Xuất xứ'); if (org2) data.origin = org2;
      if (ex) warn.push(open ? 'SKU đã có: bỏ qua tồn đầu kỳ' : 'SKU đã có trong danh mục');
      // Cập nhật SKU đã có: ô để trống thì giữ nguyên giá trị cũ
      if (ex) ([['Đơn vị tính', 'unit'], ['Thương hiệu', 'brand'], ['Phân loại', 'category'], ['Giá đại lý', 'dealerPrice'], ['Giá dự án', 'projectPrice'], ['Min', 'minStock'], ['Max', 'maxStock'], ['Lead-time', 'leadTimeDays']] as [string, keyof SkuItem][]).forEach(([c, k]) => { if (!get(r, c)) delete data[k]; });
      const row: ImportRow = { line: i + 2, sku, data, wh: wh?.id, open, errors, warn, exists: !!ex };
      if (SKU_RE.test(sku)) seen.set(sku, row);
      out.push(row);
    });
    setRows(out);
  };
  const onFile = async (fs: File[]) => {
    const f = fs[0]; if (!f) return;
    setBusy(true); setFileName(f.name);
    try { parse(/\.csv$/i.test(f.name) ? parseCsv(await f.text()) : await readXlsx(f)); }
    catch (e) { notify(e instanceof Error ? e.message : 'Không đọc được file', 'red'); }
    finally { setBusy(false); }
  };
  const valid = (rows ?? []).filter((r) => !r.errors.length && !(r.exists && mode === 'skip' && !r.extra) && !(r.extra && r.exists));
  const nNew = new Set(valid.filter((r) => !r.exists).map((r) => r.sku)).size;
  const nUpd = valid.filter((r) => r.exists && !r.extra).length;
  const nErr = (rows ?? []).filter((r) => r.errors.length).length;
  const commit = () => {
    if (!rows) return;
    const main = warehouses.find((w) => w.main)?.id ?? MAIN_WH;
    const created = new Map<string, SkuItem>();
    valid.filter((r) => !r.exists).forEach((r) => {
      const cur = created.get(r.sku) ?? ({ sku: r.sku, name: '', brand: '3M', category: '', unit: '', minStock: 0, maxStock: 0, leadTimeDays: 90, stock: 0, costPrice: 0, basePrice: 0, dealerPrice: 0, projectPrice: 0, ...r.data } as SkuItem);
      const wh = r.wh ?? main;
      cur.stock += r.open;
      if (r.open && wh !== main) cur.whStock = { ...(cur.whStock ?? {}), [wh]: (cur.whStock?.[wh] ?? 0) + r.open };
      created.set(r.sku, cur);
    });
    const upd = new Map(valid.filter((r) => r.exists && !r.extra).map((r) => [r.sku, r.data]));
    setSkus((all) => [...created.values(), ...all.map((s) => (upd.has(s.sku) ? { ...s, ...upd.get(s.sku), ...(canSeeCost ? {} : { costPrice: s.costPrice }) } : s))]);
    const at = todayISO();
    addMoves(valid.filter((r) => !r.exists && r.open > 0).map((r) => ({ at, sku: r.sku, type: 'RECEIVE_FREE' as StockMoveType, qty: r.open, by: me?.id, toWh: r.wh ?? main, note: `Tồn đầu kỳ nhập từ ${fileName}` })));
    notify(`Đã nhập ${nNew} SKU mới${nUpd ? `, cập nhật ${nUpd} SKU` : ''}${nErr ? `, bỏ qua ${nErr} dòng lỗi` : ''}`, 'teal');
    onClose();
  };
  const whName = (id?: string) => warehouses.find((w) => w.id === id)?.code ?? '';
  const shown = (rows ?? []).filter((r) => !showErr || r.errors.length);
  return (
    <Modal wide title="Nhập danh mục sản phẩm từ Excel" onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button>{rows && <button className={btnPrimary} disabled={!valid.length} onClick={commit}><Upload className="h-4 w-4" aria-hidden />Nhập {valid.length} dòng hợp lệ</button>}</>}>
      <div className="space-y-4">
        <ol className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <li className="rounded-md border border-[rgb(var(--line))] p-3"><p className="font-semibold">1. Tải file mẫu</p><p className="mt-0.5 text-xs text-[rgb(var(--muted))]">Có sẵn cột, ví dụ và danh mục mã kho.</p><button className={cn(btnGhost, btnSm, 'mt-2')} onClick={() => downloadSkuTemplate(warehouses)}><Download className="h-3.5 w-3.5" aria-hidden />Template_DanhMuc_SanPham.xlsx</button></li>
          <li className="rounded-md border border-[rgb(var(--line))] p-3"><p className="font-semibold">2. Chọn file đã điền</p><p className="mt-0.5 text-xs text-[rgb(var(--muted))]">.xlsx hoặc .csv, dòng đầu là tiêu đề cột.</p><FilePicker accept=".xlsx,.csv" onFiles={(f) => void onFile(f)} className={cn(btnPrimary, btnSm, 'mt-2')}><FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />{busy ? 'Đang đọc…' : fileName ? 'Chọn file khác' : 'Chọn file'}</FilePicker></li>
          <li className="rounded-md border border-[rgb(var(--line))] p-3"><p className="font-semibold">3. Kiểm tra & xác nhận</p><p className="mt-0.5 text-xs text-[rgb(var(--muted))]">Dòng lỗi được tô đỏ và không ghi vào danh mục.</p></li>
        </ol>
        {rows && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{fileName}:</span>
              <Chip tone="teal">{nNew} SKU mới</Chip>
              {rows.some((r) => r.exists && !r.extra) && <Chip tone="blue">{rows.filter((r) => r.exists && !r.extra).length} SKU đã có</Chip>}
              <Chip tone={nErr ? 'red' : 'muted'}>{nErr} dòng lỗi</Chip>
              {nErr > 0 && <label className="ml-1 flex items-center gap-1.5 text-xs"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={showErr} onChange={(e) => setShowErr(e.target.checked)} />Chỉ xem dòng lỗi</label>}
              {rows.some((r) => r.exists && !r.extra) && (
                <select className={cn(inputBase, 'ml-auto py-1 text-xs')} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Xử lý SKU đã có">
                  <option value="skip">SKU đã có: bỏ qua</option>
                  <option value="update">SKU đã có: cập nhật tên, giá, Min/Max (giữ nguyên tồn)</option>
                </select>
              )}
            </div>
            <div className="max-h-[50vh] overflow-auto rounded-md border border-[rgb(var(--line))]">
              <table className="w-full min-w-[880px] text-left text-xs">
                <thead className="sticky top-0 bg-[rgb(var(--raised))] text-[11px] text-[rgb(var(--muted))]"><tr><th className="px-3 py-2">Dòng</th><th className="min-w-[220px] px-3 py-2">Kết quả</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Tên / ĐVT</th><th className="px-3 py-2 text-right">Bán lẻ / Đại lý / Dự án</th><th className="px-3 py-2 text-right">Min / Max</th><th className="px-3 py-2">Kho · tồn đầu</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.line} className={cn('border-t border-[rgb(var(--line))]', r.errors.length ? 'bg-[rgb(var(--danger)/0.08)]' : r.exists && !r.extra ? 'bg-[rgb(var(--secondary)/0.05)]' : '')}>
                      <td className="px-3 py-2 tabular-nums text-[rgb(var(--muted))]">{r.line}</td>
                      <td className="px-3 py-2 font-medium">{r.errors.length ? <span className="text-[rgb(var(--danger-fg))]">{r.errors.join('; ')}</span> : r.warn.length ? <span className="text-[rgb(var(--accent-fg))]">{r.warn.join('; ')}</span> : <span className="text-[rgb(var(--success-fg))]">Hợp lệ</span>}</td>
                      <td className="px-3 py-2 font-mono text-[rgb(var(--accent-fg))]">{r.sku || '—'}</td>
                      <td className="max-w-[240px] px-3 py-2">{r.extra ? <span className="text-[rgb(var(--muted))]">↳ thêm tồn cho kho khác</span> : <><p className="truncate">{r.data.name}</p><p className="text-[rgb(var(--muted))]">{r.data.brand} · {r.data.unit}</p></>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.extra ? '' : `${fmtN(r.data.basePrice ?? 0)} / ${fmtN(r.data.dealerPrice ?? 0)} / ${fmtN(r.data.projectPrice ?? 0)}`}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.extra ? '' : `${r.data.minStock} / ${r.data.maxStock}`}</td>
                      <td className="whitespace-nowrap px-3 py-2">{whName(r.wh)}{r.open ? ` · ${fmtN(r.open)}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Chi tiết tồn theo kho; điều chuyển lập phiếu chuyển kho (có duyệt) */
export function WhTransferModal({ s, onClose, onTransfer, onCard }: { s: SkuItem; onClose: () => void; onTransfer: (from: string) => void; onCard: () => void }) {
  const { warehouses, canDo } = useApp();
  const { actual, available } = useWarehouseData();
  const rows = warehouses.map((w) => ({ w, act: actual(s, w.id), free: whQty(s, w.id, warehouses), av: available(s, w.id) })).filter((r) => r.w.active || r.act);
  const can = canDo('stock.voucher') || canDo('stock.approve');
  return (
    <Modal title={`Tồn kho ${s.sku}`} onClose={onClose} footer={<><button className={cn(btnGhost, 'mr-auto')} onClick={onCard}><ScrollText className="h-4 w-4" aria-hidden />Thẻ kho</button><button className={btnGhost} onClick={onClose}>Đóng</button>{can && <button className={btnPrimary} onClick={() => onTransfer(rows.find((r) => r.free > 0)?.w.id ?? warehouses[0]?.id)}><ArrowLeftRight className="h-4 w-4" aria-hidden />Lập phiếu chuyển kho</button>}</>}>
      <p className="mb-3 text-sm">{s.name} · {s.unit}</p>
      <table className="dt w-full text-sm">
        <thead className="text-[11px] text-[rgb(var(--muted))]"><tr className="border-b border-[rgb(var(--line))]"><th className="py-2 text-left">Kho</th><th className="py-2 text-right">Thực tế</th><th className="py-2 text-right">Tự do</th><th className="py-2 text-right">Khả dụng</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.w.id} className="border-b border-[rgb(var(--ink)/0.06)]"><td className="py-2">{r.w.name} <span className="text-xs text-[rgb(var(--muted))]">{r.w.code}{r.w.main ? ' · kho tổng' : ''}{!r.w.active ? ' · tạm ngưng' : ''}</span></td><td className="py-2 text-right tabular-nums">{fmtN(r.act)}</td><td className="py-2 text-right tabular-nums">{fmtN(r.free)}</td><td className="py-2 text-right font-semibold tabular-nums">{fmtN(r.av)}</td></tr>)}
          <tr className="font-semibold"><td className="py-2">Tổng</td><td className="py-2 text-right tabular-nums">{fmtN(actual(s, 'ALL'))}</td><td className="py-2 text-right tabular-nums">{fmtN(s.stock)}</td><td className="py-2 text-right tabular-nums">{fmtN(available(s, 'ALL'))}</td></tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs text-[rgb(var(--muted))]">Thực tế gồm hàng giữ chỗ cho dự án (nằm ở kho tổng). Khả dụng = tự do − hàng đang chờ xuất / chờ chuyển.</p>
    </Modal>
  );
}

/** Chi tiết sản phẩm (khung phải): thông tin, giá & lãi gộp, tồn theo kho, tài liệu, phát sinh gần đây */
export function SkuDetail({ sku, onClose, onEdit, onStock, onCard }: { sku: string; onClose: () => void; onEdit: () => void; onStock: () => void; onCard: () => void }) {
  const { skus, setSkus, warehouses, canDo, moves, userName, notify, pos } = useApp();
  const { actual, available, reserved } = useWarehouseData();
  const s = skus.find((x) => x.sku === sku);
  if (!s) return null;
  const canEdit = canDo('po.manage');
  const cost = canDo('price.viewCost');
  const onOrder = pos.filter((p) => !p.cancelled).reduce((a, p) => a + p.lines.filter((l) => l.sku === s.sku).reduce((b, l) => b + poLineStats(p, l).backorder, 0), 0);
  const L = STOCK_LEVEL[stockLevel(s.stock, s)];
  const gm = (pr: number) => (cost && pr > 0 && s.costPrice > 0 ? `${Math.round(((pr - s.costPrice) / pr) * 100)}%` : '');
  const recent = moves.filter((m) => m.sku === s.sku).slice(0, 8);
  const addDocs = (fs: File[]) => fs.forEach((f) => {
    if (f.size > chatFileMax()) return notify(`${f.name} vượt ${fmtSize(chatFileMax())}`, 'red');
    const r = new FileReader(); r.onload = () => setSkus((all) => all.map((x) => (x.sku === s.sku ? { ...x, docs: [...(x.docs ?? []), { name: f.name, size: f.size, type: f.type || 'application/octet-stream', url: String(r.result) }] } : x))); r.readAsDataURL(f);
  });
  const row = (k: string, v: ReactNode) => <div className="flex justify-between gap-3 border-b border-[rgb(var(--ink)/0.06)] py-1.5 text-sm"><dt className="text-[rgb(var(--muted))]">{k}</dt><dd className="text-right">{v}</dd></div>;
  return (
    <Drawer title={s.name} eyebrow={s.sku} badge={<Chip tone={L.tone}>{L.label}</Chip>} onClose={onClose}
      actions={<>{canEdit && <button className={cn(btnPrimary, btnSm)} onClick={onEdit}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa</button>}<button className={cn(btnGhost, btnSm)} onClick={onStock}><Boxes className="h-3.5 w-3.5" aria-hidden />Tồn theo kho</button><button className={cn(btnGhost, btnSm)} onClick={onCard}><ScrollText className="h-3.5 w-3.5" aria-hidden />Thẻ kho</button></>}>
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {s.image ? <img src={s.image} alt={s.name} className="h-24 w-24 shrink-0 rounded-md border border-[rgb(var(--line))] object-cover" /> : <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-[rgb(var(--line))] text-[rgb(var(--muted))]"><Package className="h-8 w-8" aria-hidden /></span>}
        <dl className="min-w-0 flex-1">
          {row('Thương hiệu', `${s.brand}${s.origin ? ` · ${s.origin}` : ''}`)}
          {row('Phân loại', s.category || '—')}
          {row('Đơn vị tính', s.unit)}
          {row('Nhà cung cấp', s.supplier || '—')}
          {row('VAT', s.vatPct !== undefined ? `${s.vatPct}%` : '—')}
        </dl>
      </div>
      {/* v55.3 trường tùy chỉnh sản phẩm (cờ "Thông tin") */}
      <EntityCfDetail entity="product" vals={s.cf} />
      <section>
        <h3 className="mb-2 text-sm font-semibold">Giá bán</h3>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {([['Bán lẻ', s.basePrice], ['Đại lý', s.dealerPrice || s.basePrice], ['Dự án', s.projectPrice || s.basePrice]] as const).map(([k, v]) => <div key={k} className="rounded-md bg-[rgb(var(--raised))] p-3"><p className="text-xs text-[rgb(var(--muted))]">{k}</p><p className="font-semibold tabular-nums">{fmtN(v)}</p>{gm(v) && <p className="text-[11px] text-[rgb(var(--success-fg))]">Lãi gộp {gm(v)}</p>}</div>)}
        </div>
        {cost && <p className="mt-2 text-xs text-[rgb(var(--muted))]">Giá vốn {fmtN(s.costPrice)}</p>}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Tồn kho</h3>
        <table className="dt w-full text-sm">
          <thead className="text-[11px] text-[rgb(var(--muted))]"><tr className="border-b border-[rgb(var(--line))]"><th className="py-1.5 text-left">Kho</th><th className="py-1.5 text-right">Thực tế</th><th className="py-1.5 text-right">Khả dụng</th></tr></thead>
          <tbody>
            {warehouses.filter((w) => w.active || actual(s, w.id)).map((w) => <tr key={w.id} className="border-b border-[rgb(var(--ink)/0.06)]"><td className="py-1.5">{w.name}</td><td className="py-1.5 text-right tabular-nums">{fmtN(actual(s, w.id))}</td><td className="py-1.5 text-right tabular-nums">{fmtN(available(s, w.id))}</td></tr>)}
            <tr className="font-semibold"><td className="py-1.5">Tổng</td><td className="py-1.5 text-right tabular-nums">{fmtN(actual(s, 'ALL'))}</td><td className="py-1.5 text-right tabular-nums">{fmtN(available(s, 'ALL'))}</td></tr>
          </tbody>
        </table>
        <dl className="mt-2">{row('Giữ chỗ cho dự án', fmtN(reserved(s.sku)))}{row('Đang đặt Hãng', onOrder ? fmtN(onOrder) : '—')}{row('Định mức Min / Max', `${fmtN(s.minStock)} / ${fmtN(s.maxStock)}`)}{row('Lead-time', `${s.leadTimeDays} ngày`)}</dl>
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Tài liệu ({s.docs?.length ?? 0})</h3>{canEdit && <FilePicker multiple onFiles={addDocs} className={cn(btnGhost, btnSm)}><Paperclip className="h-3.5 w-3.5" aria-hidden />Thêm tài liệu</FilePicker>}</div>
        {s.docs?.length ? (
          <ul className="space-y-1.5">{s.docs.map((d, i) => (
            <li key={`${d.name}-${i}`} className="flex items-center gap-2 rounded-md border border-[rgb(var(--line))] px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
              <a className="min-w-0 flex-1 truncate text-[rgb(var(--secondary-fg))] hover:underline" href={d.url} download={d.name} target="_blank" rel="noreferrer">{d.name}</a>
              <span className="text-xs text-[rgb(var(--muted))]">{fmtSize(d.size)}</span>
              {canEdit && <button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setSkus((all) => all.map((x) => (x.sku === s.sku ? { ...x, docs: (x.docs ?? []).filter((_, j) => j !== i) } : x)))} aria-label={`Xóa ${d.name}`}><X className="h-4 w-4" aria-hidden /></button>}
            </li>
          ))}</ul>
        ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có catalogue, datasheet, chứng nhận CO/CQ.</p>}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Phát sinh gần đây</h3>
        {recent.length ? <ul className="space-y-1 text-sm">{recent.map((m) => <li key={m.id} className="flex justify-between gap-2"><span className="min-w-0 truncate">{fmtDate(m.at)} · {MOVE_LABEL[m.type]} <span className="text-[rgb(var(--muted))]">{m.note}</span></span><span className="shrink-0 tabular-nums">{fmtN(m.qty)}</span></li>)}</ul> : <p className="text-sm text-[rgb(var(--muted))]">Chưa có phát sinh nhập / xuất.</p>}
        {recent[0]?.by && <p className="mt-1 text-xs text-[rgb(var(--muted))]">Gần nhất bởi {userName(recent[0].by)}</p>}
      </section>
    </Drawer>
  );
}

export function SkuCatalog() {
  const { skus, setSkus, pos, canDo, notify, reservations, warehouses, org, me, go, draftProducts } = useApp();
  const canEdit = canDo('po.manage');
  const canSeeCost = canDo('price.viewCost');
  const canVoucher = canDo('stock.voucher') || canDo('stock.approve');
  const [f, setFilter] = useSticky<SkuFilter>('SkuCatalog.f', SKU_FILTER0);
  const [view, setView] = useSticky<'ALL' | 'IN' | 'OUT' | 'ARCH' | 'DRAFT'>('SkuCatalog.view', 'ALL');
  const [modal, setModal] = useState<{ sku?: SkuItem } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [voucher, setVoucher] = useState<{ type: VoucherType; preset: Partial<StockVoucher> } | null>(null);
  const [transfer, setTransfer] = useState<SkuItem | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draft, setDraft] = useState<SkuFilter>(f);
  const [expOpen, setExpOpen] = useState(false);
  const expRef = useOutsideClose(expOpen, () => setExpOpen(false));
  const [savedOpen, setSavedOpen] = useState(false);
  const savedRef = useOutsideClose(savedOpen, () => setSavedOpen(false));
  const [filterName, setFilterName] = useState('');
  const savedKey = `3a:skufilters2:${org.id}:${me?.id ?? 'x'}`;
  const [saved, setSaved] = useState<{ name: string; f: SkuFilter }[]>(() => { try { const v = JSON.parse(localStorage.getItem(savedKey) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const persistSaved = (n: typeof saved) => { setSaved(n); try { localStorage.setItem(savedKey, JSON.stringify(n)); } catch { /* bỏ qua */ } };
  useIntent('sku.create', () => setModal({}));
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const set = <K extends keyof SkuFilter>(k: K, v: SkuFilter[K]) => { setFilter((p) => ({ ...p, [k]: v })); paged.setPage(1); };
  const curWh = warehouses.find((w) => w.id === f.wh);
  const qtyOf = (s: SkuItem) => (curWh ? whQty(s, curWh.id, warehouses) : s.stock);
  const onOrder = (sku: string) => pos.filter((p) => !p.cancelled).reduce((a, p) => a + p.lines.filter((l) => l.sku === sku).reduce((b, l) => b + poLineStats(p, l).backorder, 0), 0);
  const res = (s: SkuItem) => reservedInStock(s.sku, reservations);
  const level = (s: SkuItem) => stockLevel(s.stock, s);
  const base = skus.filter((s) => (view === 'ARCH' ? s.archived : !s.archived));
  const match = (s: SkuItem) => {
    const t = fold(f.q.trim());
    return (!t || fold(`${s.sku} ${s.name} ${s.category} ${s.brand} ${s.supplier ?? ''}`).includes(t))
      && (!f.brand || s.brand === f.brand) && (!f.cat || s.category === f.cat) && (!f.level || level(s) === f.level)
      && (!curWh || whQty(s, curWh.id, warehouses) > 0 || view === 'OUT')
      && (!f.supplier || s.supplier === f.supplier) && (!f.origin || s.origin === f.origin) && (!f.unit || s.unit === f.unit)
      && (!f.priceMin || s.basePrice >= f.priceMin) && (!f.priceMax || s.basePrice <= f.priceMax) && (!f.leadMax || s.leadTimeDays <= f.leadMax)
      && (!f.hasDocs || !!s.docs?.length) && (!f.hasImage || !!s.image) && (!f.onOrder || onOrder(s.sku) > 0);
  };
  const pool = base.filter(match);
  const list = pool.filter((s) => (view !== 'IN' || qtyOf(s) > 0) && (view !== 'OUT' || qtyOf(s) <= 0));
  const srt = useSort('SkuCatalog40', list, { 1: (s) => s.sku, 2: (s) => s.name, 3: (s) => s.brand ?? '', 5: (s) => s.basePrice, 6: (s) => s.dealerPrice || s.basePrice, 7: (s) => s.projectPrice || s.basePrice, 8: (s) => qtyOf(s), 10: (s) => s.leadTimeDays, 11: (s) => onOrder(s.sku) });
  const paged = usePaged(srt.rows, 20);
  const opts = (k: 'category' | 'unit' | 'supplier' | 'origin' | 'brand') => Array.from(new Set(skus.map((s) => s[k]).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'vi'));
  const askDelete = (s: SkuItem) => {
    const blocked = pos.some((p) => p.lines.some((l) => l.sku === s.sku)) ? 'SKU đang có trong PO đặt Hãng' : res(s) > 0 ? 'SKU đang có hàng giữ chỗ trong kho' : s.stock > 0 ? 'SKU còn tồn kho' : '';
    setConfirm(blocked ? {
      title: 'Ngừng kinh doanh sản phẩm', confirmLabel: 'Lưu trữ', message: <>{blocked} nên không xóa được <b>{s.sku}</b>. Chuyển sang <b>Lưu trữ</b>: ẩn khỏi danh mục, giữ nguyên lịch sử PO, giữ chỗ và tồn kho.</>,
      onConfirm: () => { setSkus((all) => all.map((x) => (x.sku === s.sku ? { ...x, archived: true } : x))); notify(`Đã lưu trữ ${s.sku}`, 'orange', { label: 'Hoàn tác', run: () => setSkus((all) => all.map((x) => (x.sku === s.sku ? { ...x, archived: false } : x))) }); },
    } : {
      title: 'Xóa sản phẩm', message: <>Xóa <b>{s.sku}</b> {s.name} khỏi danh mục?</>, confirmLabel: 'Xóa',
      onConfirm: () => { let idx = -1; setSkus((all) => { idx = all.findIndex((x) => x.sku === s.sku); return all.filter((x) => x.sku !== s.sku); }); notify(`Đã xóa ${s.sku}`, 'orange', { label: 'Hoàn tác', run: () => setSkus((all) => (all.some((x) => x.sku === s.sku) ? all : [...all.slice(0, Math.max(0, idx)), s, ...all.slice(Math.max(0, idx))])) }); },
    });
  };
  const exportRows = (items: SkuItem[]) => {
    const act = warehouses.filter((w) => w.active || items.some((s) => whQty(s, w.id, warehouses)));
    const head = ['STT', 'SKU', 'Tên sản phẩm', 'Giá bán lẻ', 'Giá đại lý', 'Giá dự án', 'Tồn kho', 'Lead-time', 'Tài liệu', 'Thương hiệu', 'Phân loại', 'Đơn vị tính', ...(canSeeCost ? ['Giá vốn'] : []), 'VAT (%)', 'Nhà cung cấp', 'Xuất xứ', 'Min', 'Max', 'Giữ chỗ', 'Đang đặt', 'Tình trạng', ...act.map((w) => `Tồn ${w.code}`), 'Trạng thái'];
    return [head, ...items.map((s, i) => [i + 1, s.sku, s.name, s.basePrice, s.dealerPrice || s.basePrice, s.projectPrice || s.basePrice, s.stock, s.leadTimeDays, (s.docs ?? []).map((d) => d.name).join('; '), s.brand, s.category, s.unit, ...(canSeeCost ? [s.costPrice] : []), s.vatPct ?? '', s.supplier ?? '', s.origin ?? '', s.minStock, s.maxStock, res(s), onOrder(s.sku), STOCK_LEVEL[level(s)].label, ...act.map((w) => whQty(s, w.id, warehouses)), s.archived ? 'Lưu trữ' : 'Đang kinh doanh'])];
  };
  const doExport = (scope: 'filter' | 'all', fmt: 'xlsx' | 'csv') => {
    const items = scope === 'filter' ? srt.rows : skus;
    const stamp = todayISO().replace(/-/g, '');
    const rows = exportRows(items);
    if (fmt === 'csv') downloadCsv(`DanhMuc_SanPham_${stamp}.csv`, rows as (string | number)[][]);
    else downloadBlob(`DanhMuc_SanPham_${stamp}.xlsx`, xlsxBlob([{ name: 'DanhMuc_SanPham', rows, widths: rows[0].map((h, i) => (i === 2 ? 46 : i === 0 ? 6 : String(h).length > 10 ? 14 : 11)) }]));
    setExpOpen(false);
    notify(`Đã xuất ${items.length} sản phẩm (${scope === 'filter' ? 'theo bộ lọc' : 'toàn bộ'})`, 'teal');
  };
  // Nhãn các điều kiện đang lọc (chip có nút ×)
  const chips: { k: keyof SkuFilter; label: string }[] = [];
  if (f.q.trim()) chips.push({ k: 'q', label: `Từ khóa: ${f.q.trim()}` });
  if (f.wh) chips.push({ k: 'wh', label: `Kho: ${curWh?.code ?? f.wh}` });
  if (f.brand) chips.push({ k: 'brand', label: `Thương hiệu: ${f.brand}` });
  if (f.cat) chips.push({ k: 'cat', label: `Phân loại: ${f.cat}` });
  if (f.level) chips.push({ k: 'level', label: `Tình trạng: ${STOCK_LEVEL[f.level].label}` });
  if (f.supplier) chips.push({ k: 'supplier', label: `NCC: ${f.supplier}` });
  if (f.origin) chips.push({ k: 'origin', label: `Xuất xứ: ${f.origin}` });
  if (f.unit) chips.push({ k: 'unit', label: `ĐVT: ${f.unit}` });
  if (f.priceMin) chips.push({ k: 'priceMin', label: `Giá lẻ ≥ ${fmtN(f.priceMin)}` });
  if (f.priceMax) chips.push({ k: 'priceMax', label: `Giá lẻ ≤ ${fmtN(f.priceMax)}` });
  if (f.leadMax) chips.push({ k: 'leadMax', label: `Lead-time ≤ ${f.leadMax} ngày` });
  if (f.hasDocs) chips.push({ k: 'hasDocs', label: 'Có tài liệu' });
  if (f.hasImage) chips.push({ k: 'hasImage', label: 'Có ảnh' });
  if (f.onOrder) chips.push({ k: 'onOrder', label: 'Đang đặt Hãng' });
  const moreN = ['supplier', 'origin', 'unit', 'priceMin', 'priceMax', 'leadMax', 'hasDocs', 'hasImage', 'onOrder'].filter((k) => !!f[k as keyof SkuFilter]).length;
  const sel = cn(inputBase, 'h-8 max-w-[160px] py-0 pr-8 text-[13px]');
  const levelCell = (s: SkuItem) => { const L = STOCK_LEVEL[level(s)]; const r = res(s); return <Chip tone={L.tone}>{L.label}{!curWh && r ? ` · giữ ${fmtN(r)}` : ''}</Chip>; };

  const viewTabs = <Tabs tabs={[{ id: 'ALL' as const, label: 'Tất cả', count: pool.length }, { id: 'IN' as const, label: 'Còn hàng', count: pool.filter((s) => qtyOf(s) > 0).length }, { id: 'OUT' as const, label: 'Hết hàng', count: pool.filter((s) => qtyOf(s) <= 0).length }, { id: 'ARCH' as const, label: 'Lưu trữ', count: skus.filter((s) => s.archived).length }, { id: 'DRAFT' as const, label: 'Danh mục nháp', count: draftProducts.filter((d) => !d.promotedSku).length }]} value={view} onChange={(v) => { setView(v); paged.setPage(1); }} />;
  if (view === 'DRAFT') return <div className="space-y-4">{viewTabs}<DraftCatalog /></div>;
  return (
    <div className="space-y-4">

      {/* Hàng tab + hành động chính (phía trên bên phải bảng) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:border-b lg:border-[rgb(var(--line))]">
        <div className="min-w-0 flex-1">{viewTabs}</div>
        <div className="flex flex-wrap gap-2 lg:pb-1.5">
          <button className={cn(btnGhost, btnSm, 'border-0')} disabled={!canEdit} onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" aria-hidden />Nhập Excel</button>
          <div className="relative" ref={expRef}>
            <button className={cn(btnGhost, btnSm, 'border-0')} onClick={() => setExpOpen((v) => !v)} aria-expanded={expOpen} aria-haspopup="menu"><Download className="h-4 w-4" aria-hidden />Xuất Excel<ChevronDown className="h-3.5 w-3.5" aria-hidden /></button>
            {expOpen && (
              <div className="absolute right-0 top-11 z-30 w-64 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 shadow-[var(--shadow-lg)]" role="menu">
                {([['filter', `Theo bộ lọc hiện tại (${list.length})`], ['all', `Toàn bộ danh mục (${skus.length})`]] as const).map(([sc, label]) => (
                  <div key={sc} className="px-2 py-1.5"><p className="text-xs font-semibold text-[rgb(var(--muted))]">{label}</p>
                    <div className="mt-1 flex gap-1"><button role="menuitem" className={cn(btnGhost, btnSm, 'flex-1')} onClick={() => doExport(sc, 'xlsx')}>Excel (.xlsx)</button><button role="menuitem" className={cn(btnGhost, btnSm, 'flex-1')} onClick={() => doExport(sc, 'csv')}>CSV</button></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button className={cn(btnPrimary, btnSm)} disabled={!canEdit} onClick={() => setModal({})}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm sản phẩm</button>
        </div>
      </div>

      {/* Bộ lọc */}
      <section aria-label="Bộ lọc sản phẩm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:w-[280px] lg:flex-none"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden /><input className={cn(inputCls, 'h-8 bg-[rgb(var(--surface))] py-0 pl-9 text-[13.5px]')} value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Tìm SKU, tên sản phẩm, phân loại, nhà cung cấp…" aria-label="Tìm sản phẩm" /></div>
          <div className="hidden flex-wrap gap-2 lg:flex lg:flex-1">
            <select className={sel} value={f.wh} onChange={(e) => set('wh', e.target.value)} aria-label="Kho"><option value="">Tất cả kho</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select>
            <select className={sel} value={f.brand} onChange={(e) => set('brand', e.target.value)} aria-label="Thương hiệu"><option value="">Thương hiệu</option>{opts('brand').map((o) => <option key={o} value={o}>{o}</option>)}</select>
            <select className={sel} value={f.cat} onChange={(e) => set('cat', e.target.value)} aria-label="Phân loại"><option value="">Phân loại</option>{opts('category').map((o) => <option key={o} value={o}>{o}</option>)}</select>
            <select className={sel} value={f.level} onChange={(e) => set('level', e.target.value as SkuFilter['level'])} aria-label="Tình trạng tồn"><option value="">Tình trạng tồn</option>{(Object.keys(STOCK_LEVEL) as StockLevel[]).map((k) => <option key={k} value={k}>{STOCK_LEVEL[k].label}</option>)}</select>
          </div>
          <div className="flex gap-2">
            <button className={cn(btnGhost, 'h-8 flex-1 text-[13px] lg:flex-none')} onClick={() => { setDraft(f); setMoreOpen(true); }}><SlidersHorizontal className="h-4 w-4" aria-hidden /><span className="lg:hidden">Bộ lọc</span><span className="hidden lg:inline">Bộ lọc</span>{(moreN || chips.length) > 0 && <span className="rounded-full bg-[rgb(var(--accent))] px-1.5 text-[11px] font-semibold text-[rgb(var(--on-accent))]"><span className="lg:hidden">{chips.length}</span><span className="hidden lg:inline">{moreN || ''}</span></span>}</button>
            <div className="relative" ref={savedRef}>
              <button className={cn(btnGhost, 'h-8 text-[13px]')} onClick={() => setSavedOpen((v) => !v)} aria-expanded={savedOpen} aria-haspopup="menu" title="Bộ lọc đã lưu"><Star className="h-4 w-4" aria-hidden /><span className="sr-only">Bộ lọc của tôi</span><ChevronDown className="h-3.5 w-3.5" aria-hidden /></button>
              {savedOpen && (
                <div className="absolute right-0 top-11 z-30 w-72 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-2 shadow-[var(--shadow-lg)]" role="menu">
                  {saved.length ? saved.map((x, i) => (
                    <div key={x.name} className="flex items-center gap-1"><button role="menuitem" className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => { setFilter(x.f); setSavedOpen(false); paged.setPage(1); }}>{x.name}</button><button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => persistSaved(saved.filter((_, j) => j !== i))} aria-label={`Xóa bộ lọc ${x.name}`}><X className="h-3.5 w-3.5" aria-hidden /></button></div>
                  )) : <p className="px-2 py-1.5 text-sm text-[rgb(var(--muted))]">Chưa có bộ lọc đã lưu.</p>}
                  <div className="mt-2 flex gap-1.5 border-t border-[rgb(var(--line))] pt-2"><input className={cn(inputBase, 'min-w-0 flex-1 py-1.5 text-sm')} value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="Tên bộ lọc hiện tại" aria-label="Tên bộ lọc" /><button className={cn(btnPrimary, btnSm)} disabled={!filterName.trim() || !chips.length} onClick={() => { persistSaved([...saved.filter((x) => x.name !== filterName.trim()), { name: filterName.trim(), f }]); setFilterName(''); notify('Đã lưu bộ lọc', 'teal'); }}>Lưu</button></div>
                </div>
              )}
            </div>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[rgb(var(--ink)/0.06)] pt-2.5">
            <span className="text-xs text-[rgb(var(--muted))]">Đang lọc:</span>
            {chips.map((c) => <span key={c.k} className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--secondary)/0.12)] py-0.5 pl-2.5 pr-1 text-xs font-medium text-[rgb(var(--secondary-fg))]">{c.label}<button className="rounded-full p-0.5 hover:bg-[rgb(var(--secondary)/0.2)]" onClick={() => set(c.k, SKU_FILTER0[c.k] as never)} aria-label={`Bỏ ${c.label}`}><X className="h-3 w-3" aria-hidden /></button></span>)}
            <button className="ml-1 text-xs font-medium text-[rgb(var(--danger-fg))] hover:underline" onClick={() => { setFilter(SKU_FILTER0); paged.setPage(1); }}>Xóa tất cả</button>
            <span className="ml-auto text-xs text-[rgb(var(--muted))]">{list.length} / {base.length} sản phẩm</span>
          </div>
        )}
      </section>

      <Panel>
        <Table head={['STT', 'SKU', 'Tên sản phẩm', 'Hãng', 'ĐVT', <span key="p1" className="block text-right">Giá bán lẻ</span>, <span key="p2" className="block text-right">Giá đại lý</span>, <span key="p3" className="block text-right">Giá dự án</span>, <span key="st" className="block text-right">Tồn</span>, 'Mức tồn', 'Lead-time', <span key="oo" className="block text-right">Đang về</span>, 'Tài liệu', <span key="a" className="block text-right">Thao tác</span>]} minW={1000} sort={srt.th}>
          {paged.slice.map((s, i) => (
            <tr key={s.sku} className={cn(rowCls, 'cursor-pointer', s.archived && 'opacity-60')} onClick={() => setDetail(s.sku)}>
              <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{(paged.page - 1) * 20 + i + 1}</td>
              <td className={tdCls}><Code>{s.sku}</Code></td>
              <td className={tdCls}><button className="block max-w-[280px] truncate text-left font-medium hover:underline 2xl:max-w-[420px]" title={s.name} onClick={(e) => { e.stopPropagation(); setDetail(s.sku); }}>{s.name}</button></td>
              <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{s.brand || '—'}</td>
              <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{s.unit}</td>
              <td className={cn(tdCls, 'text-right font-medium tabular-nums')}>{fmtN(s.basePrice)}</td>
              <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{fmtN(s.dealerPrice || s.basePrice)}</td>
              <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{fmtN(s.projectPrice || s.basePrice)}</td>
              <td className={cn(tdCls, 'text-right')}><button className="font-medium tabular-nums hover:underline" onClick={(e) => { e.stopPropagation(); setTransfer(s); }} title="Tồn theo từng kho">{fmtN(qtyOf(s))}</button></td>
              <td className={tdCls}>{s.archived ? <Chip>Lưu trữ</Chip> : levelCell(s)}</td>
              <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{s.leadTimeDays} ngày</td>
              <td className={cn(tdCls, 'text-right tabular-nums')}>{onOrder(s.sku) > 0 ? fmtN(onOrder(s.sku)) : <span className="text-[rgb(var(--faint))]">—</span>}</td>
              <td className={tdCls}>{s.docs?.length ? <button className="inline-flex items-center gap-1 text-[13px] text-[rgb(var(--fg2))] hover:underline" onClick={(e) => { e.stopPropagation(); setDetail(s.sku); }} title={s.docs.map((d) => d.name).join('\n')}><Paperclip className="h-3.5 w-3.5" aria-hidden />{s.docs.length}</button> : <span className="text-[rgb(var(--faint))]">—</span>}</td>
              <td className={tdLast} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end">
                  <RowMenu label={`Thao tác ${s.sku}`} items={[
                    { label: 'Xem chi tiết', icon: Eye, onClick: () => setDetail(s.sku) },
                    { label: 'Sửa', icon: Pencil, disabled: !canEdit, onClick: () => setModal({ sku: s }) },
                    { label: 'Lập phiếu nhập kho', icon: PackagePlus, disabled: !canVoucher || s.archived, onClick: () => setVoucher({ type: 'IN', preset: { whId: curWh?.id ?? warehouses.find((w) => w.main)?.id, lines: [{ sku: s.sku, qty: 1, price: s.costPrice }], reason: 'Mua hàng (PO Hãng)' } }) },
                    { label: 'Lập phiếu xuất kho', icon: PackageMinus, disabled: !canVoucher || s.archived, onClick: () => setVoucher({ type: 'OUT', preset: { whId: curWh?.id ?? warehouses.find((w) => w.main)?.id, lines: [{ sku: s.sku, qty: 1, price: s.basePrice }] } }) },
                    { label: 'Tồn theo kho', icon: Boxes, onClick: () => setTransfer(s) },
                    { label: 'Thẻ kho', icon: ScrollText, onClick: () => { stickyStore.set('WarehouseModule.tab', 'card'); stickyStore.set('StockCard.sku', s.sku); go('warehouse'); } },
                    s.archived ? { label: 'Khôi phục', icon: RefreshCw, disabled: !canEdit, onClick: () => { setSkus((all) => all.map((x) => (x.sku === s.sku ? { ...x, archived: false } : x))); notify(`Đã khôi phục ${s.sku}`, 'teal'); } }
                      : { label: 'Xóa / lưu trữ', icon: Trash2, danger: true, disabled: !canEdit, onClick: () => askDelete(s) },
                  ]} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {!list.length && <EmptyState text={skus.length ? <>Không có sản phẩm khớp bộ lọc.</> : <>Danh mục sản phẩm đang trống</>} hint={skus.length ? <>Bỏ bớt điều kiện lọc hoặc đổi tab.</> : <>Thêm từng SKU hoặc nhập hàng loạt từ file Excel mẫu.</>} art="box" action={skus.length ? (chips.length ? 'Xóa bộ lọc' : undefined) : canEdit ? 'Nhập Excel' : undefined} onAction={() => (skus.length ? setFilter(SKU_FILTER0) : setImportOpen(true))} />}
        <Pagination paged={paged} unit="sản phẩm" />
      </Panel>

      {modal && <SkuModal sku={modal.sku} onClose={() => setModal(null)} />}
      {importOpen && <SkuImportModal onClose={() => setImportOpen(false)} />}
      {voucher && <VoucherModal type={voucher.type} preset={voucher.preset} onClose={() => setVoucher(null)} />}
      {detail && <SkuDetail sku={detail} onClose={() => setDetail(null)} onEdit={() => { const s = skus.find((x) => x.sku === detail); setDetail(null); if (s) setModal({ sku: s }); }} onStock={() => { const s = skus.find((x) => x.sku === detail); setDetail(null); if (s) setTransfer(s); }} onCard={() => { stickyStore.set('WarehouseModule.tab', 'card'); stickyStore.set('StockCard.sku', detail); setDetail(null); go('warehouse'); }} />}
      {transfer && <WhTransferModal s={skus.find((x) => x.sku === transfer.sku) ?? transfer} onClose={() => setTransfer(null)} onCard={() => { stickyStore.set('WarehouseModule.tab', 'card'); stickyStore.set('StockCard.sku', transfer.sku); setTransfer(null); go('warehouse'); }} onTransfer={(from) => { const t = transfer; setTransfer(null); setVoucher({ type: 'TRANSFER', preset: { whId: from, lines: [{ sku: t.sku, qty: 1 }] } }); }} />}
      {moreOpen && (
        <SideSheet title="Bộ lọc sản phẩm" sub="Kết hợp nhiều điều kiện; lưu lại để dùng nhanh" onClose={() => setMoreOpen(false)} footer={<><button className={btnGhost} onClick={() => setDraft(SKU_FILTER0)}>Xóa lọc</button><button className={btnPrimary} onClick={() => { setFilter(draft); setMoreOpen(false); paged.setPage(1); }}>Áp dụng</button></>}>
          <div className="space-y-5">
            <fieldset className="space-y-3"><legend className="mb-1 text-xs font-semibold text-[rgb(var(--muted))]">Phân loại hàng</legend>
              <Field label="Kho"><select className={inputCls} value={draft.wh} onChange={(e) => setDraft({ ...draft, wh: e.target.value })}><option value="">Tất cả kho</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Thương hiệu"><select className={inputCls} value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })}><option value="">Tất cả</option>{opts('brand').map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="Phân loại"><select className={inputCls} value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })}><option value="">Tất cả</option>{opts('category').map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="Nhà cung cấp"><select className={inputCls} value={draft.supplier} onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}><option value="">Tất cả</option>{opts('supplier').map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="Xuất xứ"><select className={inputCls} value={draft.origin} onChange={(e) => setDraft({ ...draft, origin: e.target.value })}><option value="">Tất cả</option>{opts('origin').map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="Đơn vị tính"><select className={inputCls} value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })}><option value="">Tất cả</option>{opts('unit').map((o) => <option key={o} value={o}>{o}</option>)}</select></Field>
                <Field label="Tình trạng tồn"><select className={inputCls} value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as SkuFilter['level'] })}><option value="">Tất cả</option>{(Object.keys(STOCK_LEVEL) as StockLevel[]).map((k) => <option key={k} value={k}>{STOCK_LEVEL[k].label}</option>)}</select></Field>
              </div>
            </fieldset>
            <fieldset className="space-y-3"><legend className="mb-1 text-xs font-semibold text-[rgb(var(--muted))]">Giá & cung ứng</legend>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giá bán lẻ từ"><MoneyInput value={draft.priceMin} onChange={(n) => setDraft({ ...draft, priceMin: n })} /></Field>
                <Field label="đến"><MoneyInput value={draft.priceMax} onChange={(n) => setDraft({ ...draft, priceMax: n })} /></Field>
                <Field label="Lead-time tối đa (ngày)"><input type="number" min={0} className={inputCls} value={draft.leadMax || ''} onChange={(e) => setDraft({ ...draft, leadMax: Number(e.target.value) })} /></Field>
              </div>
              {([['onOrder', 'Đang có PO đặt Hãng'], ['hasDocs', 'Có tài liệu (catalogue, datasheet, CO/CQ)'], ['hasImage', 'Có ảnh sản phẩm']] as const).map(([k, label]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} />{label}</label>)}
            </fieldset>
            <p className="text-xs text-[rgb(var(--muted))]">Lưu bộ lọc để dùng lại: nút ★ Bộ lọc của tôi cạnh ô tìm kiếm.</p>
          </div>
        </SideSheet>
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

