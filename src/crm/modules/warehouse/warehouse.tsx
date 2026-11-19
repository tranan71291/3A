'use client';

import { Fragment, useState } from 'react';
import { AlertTriangle, ArrowRight, Boxes, CheckCircle2, ClipboardCheck, Download, PackageMinus, PackagePlus, Plus, Printer, RefreshCw, Search, Warehouse, X } from 'lucide-react';
import { useIntent } from '../../components/command-palette';
import { Pagination, usePaged } from '../../components/controls';
import { useInRange } from '../../components/filters';
import { Chip, Code, EmptyState, Field, Modal, Panel, StatCard, Table, Tabs, useSort, useSticky } from '../../components/ui';
import { addWh, btnDanger, btnGhost, btnPrimary, btnSm, C, compact, downloadBlob, esc, fmtDate, fold, inputBase, inputCls, kpiGrid, MAIN_WH, MOVE_LABEL, moveEffect, nextVoucherCode, rangeText, reservedInStock, rowCls, tdCls, tdFirst, tdLast, todayISO, uid, useApp, V_STATUS, VOUCHER_META, vStatusLabel, whQty } from '../../lib/core';
import { xlsxBlob } from '../../lib/csv';
import type { SkuItem, StockMove, StockVoucher, SvLine, VoucherStatus, VoucherType, WarehouseInfo, WhTab } from '../../lib/types';
import { cn } from '../../lib/utils';
import { docShell, printHtml } from '../sales/templates';
import { WarehouseSettings } from '../settings/security-data';

/** Áp (sign = 1) hoặc hoàn (sign = -1) một phiếu: trả về danh mục mới + bút toán thẻ kho, hoặc lỗi thiếu tồn */
export function applyVoucher(v: StockVoucher, sign: 1 | -1, skus: SkuItem[], whs: WarehouseInfo[], by?: string): { skus: SkuItem[]; moves: Omit<StockMove, 'id'>[]; error?: string } {
  const main = whs.find((w) => w.main)?.id ?? MAIN_WH;
  let next = skus.slice(); const moves: Omit<StockMove, 'id'>[] = []; const at = todayISO();
  const touch = (sku: string, wh: string, d: number) => {
    const i = next.findIndex((x) => x.sku === sku); if (i < 0) return `Không còn SKU ${sku}`;
    if (d < 0 && whQty(next[i], wh, whs) + d < 0) return `${sku}: ${whs.find((w) => w.id === wh)?.code} chỉ còn ${whQty(next[i], wh, whs)}, không đủ ${-d}`;
    next = next.map((x, j) => (j === i ? addWh(x, wh, d, main) : x)); return '';
  };
  for (const l of v.lines) {
    const note = `${v.code}${sign < 0 ? ' (hủy)' : ''} · ${v.reason}${v.partner ? ` · ${v.partner}` : ''}`;
    if (v.type === 'IN') { const e = touch(l.sku, v.whId, sign * l.qty); if (e) return { skus, moves: [], error: e }; moves.push({ at, sku: l.sku, type: 'RECEIVE_FREE', qty: sign * l.qty, toWh: v.whId, refId: v.id, by, note }); }
    if (v.type === 'OUT') { const e = touch(l.sku, v.whId, -sign * l.qty); if (e) return { skus, moves: [], error: e }; moves.push({ at, sku: l.sku, type: 'ISSUE', qty: sign * l.qty, fromWh: v.whId, refId: v.id, by, note }); }
    if (v.type === 'TRANSFER' && v.toWhId) {
      const [a, b] = sign > 0 ? [v.whId, v.toWhId] : [v.toWhId, v.whId];
      const e = touch(l.sku, a, -l.qty) || touch(l.sku, b, l.qty); if (e) return { skus, moves: [], error: e };
      moves.push({ at, sku: l.sku, type: 'WH_TRANSFER', qty: l.qty, fromWh: a, toWh: b, refId: v.id, by, note });
    }
    if (v.type === 'COUNT') {
      const i = next.findIndex((x) => x.sku === l.sku); if (i < 0) continue;
      const diff = sign > 0 ? l.qty - whQty(next[i], v.whId, whs) : -(l.diff ?? 0);
      if (diff) { const e = touch(l.sku, v.whId, diff); if (e) return { skus, moves: [], error: e }; moves.push({ at, sku: l.sku, type: 'ADJUST', qty: diff, toWh: v.whId, refId: v.id, by, note }); }
      l.diff = sign > 0 ? diff : 0;
    }
  }
  return { skus: next, moves };
}

export function useWarehouseData() {
  const { warehouses, reservations, stockVouchers, me, canDo } = useApp();
  const main = warehouses.find((w) => w.main)?.id ?? MAIN_WH;
  const reserved = (sku: string) => reservedInStock(sku, reservations);
  /** Tồn thực tế tại kho (gồm hàng giữ chỗ ở kho tổng) */
  const actual = (s: SkuItem, wh: string | 'ALL') => (wh === 'ALL' ? s.stock + reserved(s.sku) : whQty(s, wh, warehouses) + (wh === main ? reserved(s.sku) : 0));
  /** Đang chờ xuất / chờ chuyển đi khỏi kho */
  const pendingOut = (sku: string, wh: string | 'ALL') => stockVouchers.filter((v) => v.status === 'PENDING' && (v.type === 'OUT' || (v.type === 'TRANSFER' && wh !== 'ALL')) && (wh === 'ALL' || v.whId === wh)).reduce((a, v) => a + v.lines.filter((l) => l.sku === sku).reduce((b, l) => b + l.qty, 0), 0);
  /** Khả dụng = tồn tự do − đang chờ xuất */
  const available = (s: SkuItem, wh: string | 'ALL') => Math.max(0, (wh === 'ALL' ? s.stock : whQty(s, wh, warehouses)) - pendingOut(s.sku, wh));
  const canApprove = (v: StockVoucher) => canDo('stock.approve') || [v.whId, v.toWhId].some((id) => warehouses.find((w) => w.id === id)?.managerId === me?.id);
  return { main, reserved, actual, available, pendingOut, canApprove };
}

/** Lập / xem / duyệt phiếu kho */
export function VoucherModal({ type, voucher, preset, onClose }: { type: VoucherType; voucher?: StockVoucher; preset?: Partial<StockVoucher>; onClose: () => void }) {
  const app = useApp();
  const { skus, setSkus, warehouses, stockVouchers, setStockVouchers, addMoves, me, userName, notify, canDo, customers, pos, company } = app;
  const { canApprove: canApprove0 } = useWarehouseData();
  /** v48: không tự duyệt phiếu chờ của mình (Giám đốc duy nhất thì được); "Lập & duyệt" khi tự lập vẫn giữ */
  const canApprove = (v: StockVoucher) => canApprove0(v) && !(!!voucher && voucher.status === 'PENDING' && voucher.requestedBy === me?.id && (app.wfPolicy.noSelf && !(app.me?.role === 'BOD' && app.wfPolicy.soleBodSelf && app.users.filter((u) => u.active && u.role === 'BOD').length === 1)));
  const act = warehouses.filter((w) => w.active);
  const meta = VOUCHER_META[type];
  const ro = !!voucher && voucher.status !== 'PENDING';
  const [f, setF] = useState<StockVoucher>(() => voucher ? JSON.parse(JSON.stringify(voucher)) as StockVoucher : { id: '', code: nextVoucherCode(type, stockVouchers), type, status: 'PENDING', date: todayISO(), whId: act.find((w) => w.main)?.id ?? act[0]?.id ?? MAIN_WH, toWhId: type === 'TRANSFER' ? act.find((w) => !w.main)?.id : undefined, reason: meta.reasons[0], lines: [], requestedBy: me?.id, createdAt: Date.now(), ...preset, ...(type === 'TRANSFER' && preset?.whId && (!preset.toWhId || preset.toWhId === preset.whId) ? { toWhId: act.find((w) => w.id !== preset.whId)?.id } : {}) });
  const [pick, setPick] = useState('');
  const [cancelWhy, setCancelWhy] = useState('');
  const set = <K extends keyof StockVoucher>(k: K, v: StockVoucher[K]) => setF((p) => ({ ...p, [k]: v }));
  const setLine = (i: number, patch: Partial<SvLine>) => setF((p) => ({ ...p, lines: p.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const skuOf = (sku: string) => skus.find((s) => s.sku === sku);
  const addLine = (sku: string) => { const s = skuOf(sku); if (!s || f.lines.some((l) => l.sku === sku)) return; setF((p) => ({ ...p, lines: [...p.lines, { sku, qty: type === 'COUNT' ? whQty(s, p.whId, warehouses) : 1, price: type === 'IN' ? s.costPrice : s.basePrice, system: type === 'COUNT' ? whQty(s, p.whId, warehouses) : undefined }] })); setPick(''); };
  const loadAll = () => setF((p) => ({ ...p, lines: skus.filter((s) => !s.archived && whQty(s, p.whId, warehouses) > 0).map((s) => ({ sku: s.sku, qty: whQty(s, p.whId, warehouses), system: whQty(s, p.whId, warehouses) })) }));
  const errs: string[] = [];
  if (!f.lines.length) errs.push('Chưa có dòng hàng');
  if (f.lines.some((l) => !(l.qty >= 0) || (type !== 'COUNT' && l.qty <= 0) || !Number.isInteger(l.qty))) errs.push('Số lượng phải là số nguyên dương');
  if (type === 'TRANSFER' && (!f.toWhId || f.toWhId === f.whId)) errs.push('Chọn kho đến khác kho đi');
  if ((type === 'OUT' || type === 'TRANSFER') && !ro) f.lines.forEach((l) => { const s = skuOf(l.sku); if (s && l.qty > whQty(s, f.whId, warehouses)) errs.push(`${l.sku} vượt tồn kho (${whQty(s, f.whId, warehouses)})`); });
  const total = f.lines.reduce((a, l) => a + l.qty * (l.price ?? 0), 0);
  const persist = (v: StockVoucher) => setStockVouchers((all) => (all.some((x) => x.id === v.id) ? all.map((x) => (x.id === v.id ? v : x)) : [v, ...all]));
  const submit = () => {
    if (errs.length) return notify(errs[0], 'red');
    const v = { ...f, id: f.id || uid('sv') };
    persist(v);
    const amount = v.lines.reduce((s, l) => s + l.qty * (l.price ?? 0), 0);
    const who = app.wfFirstApprovers('VOUCHER', { requesterId: me?.id, whId: v.whId, amount, vals: { amount } }).filter((u) => u.id !== me?.id);
    who.forEach((u) => app.dispatch('APPROVAL_RESULT', { to: u, title: `Phiếu kho chờ duyệt: ${v.code}`, body: `${meta.label}, ${v.reason}${v.partner ? `, ${v.partner}` : ''}`, module: 'tasks' }));
    notify(`Đã lập ${v.code}, chờ ${who.length ? who.map((u) => u.name).join(', ') : 'Thủ kho / Kế toán'} duyệt`, 'teal');
    onClose();
  };
  const approve = () => {
    if (errs.length) return notify(errs[0], 'red');
    const v: StockVoucher = { ...f, id: f.id || uid('sv'), lines: f.lines.map((l) => ({ ...l })) };
    const r = applyVoucher(v, 1, skus, warehouses, me?.id);
    if (r.error) return notify(r.error, 'red');
    setSkus(r.skus); addMoves(r.moves);
    persist({ ...v, status: 'DONE', approvedBy: me?.id, approvedAt: Date.now() });
    notify(`${v.code}: ${meta.done.toLowerCase()}`, 'teal'); onClose();
  };
  const cancel = () => {
    if (cancelWhy.trim().length < 3) return notify('Nhập lý do hủy', 'red');
    if (f.status === 'DONE') {
      const r = applyVoucher(f, -1, skus, warehouses, me?.id);
      if (r.error) return notify(`Không hoàn được tồn: ${r.error}`, 'red');
      setSkus(r.skus); addMoves(r.moves);
    }
    persist({ ...f, status: 'CANCELLED', cancelledBy: me?.id, cancelReason: cancelWhy.trim() });
    notify(`Đã hủy ${f.code}${f.status === 'DONE' ? ', đã hoàn tồn kho' : ''}`, 'orange'); onClose();
  };
  const print = () => {
    const wh = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? '';
    const rows = f.lines.map((l, i) => { const s = skuOf(l.sku); return `<tr><td>${i + 1}</td><td>${esc(l.sku)}</td><td>${esc(s?.name ?? '')}</td><td>${esc(s?.unit ?? '')}</td>${type === 'COUNT' ? `<td class="r">${l.system ?? ''}</td>` : ''}<td class="r">${l.qty.toLocaleString('vi-VN')}</td>${type === 'COUNT' ? `<td class="r">${l.diff ?? l.qty - (l.system ?? 0)}</td>` : `<td class="r">${(l.price ?? 0).toLocaleString('vi-VN')}</td><td class="r">${(l.qty * (l.price ?? 0)).toLocaleString('vi-VN')}</td>`}</tr>`; }).join('');
    printHtml(docShell(`${f.code}`, `<h1>${esc(meta.label.toUpperCase())}</h1><p class="c">Số: <b>${esc(f.code)}</b> · Ngày ${fmtDate(f.date)}</p>
      <p><b>${esc(company.legalName || company.shortName)}</b></p>
      <p>${type === 'TRANSFER' ? `Kho đi: ${esc(wh(f.whId))} → Kho đến: ${esc(wh(f.toWhId))}` : `Kho: ${esc(wh(f.whId))}`}</p>
      <p>Lý do: ${esc(f.reason)}${f.partner ? ` · ${type === 'IN' ? 'Nhà cung cấp' : 'Khách hàng'}: ${esc(f.partner)}` : ''}${f.ref ? ` · Chứng từ gốc: ${esc(f.ref)}` : ''}</p>
      ${f.note ? `<p>Diễn giải: ${esc(f.note)}</p>` : ''}
      <table class="items"><thead><tr><th>STT</th><th>Mã hàng</th><th>Tên hàng</th><th>ĐVT</th>${type === 'COUNT' ? '<th>Sổ sách</th><th>Thực tế</th><th>Chênh lệch</th>' : '<th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th>'}</tr></thead><tbody>${rows}</tbody></table>
      ${type === 'COUNT' ? '' : `<p class="r"><b>Tổng cộng: ${total.toLocaleString('vi-VN')} đ</b></p>`}
      <table class="layout sign"><tr><td>Người lập<br><br><br>${esc(userName(f.requestedBy))}</td><td>Thủ kho<br><br><br>${esc(userName(warehouses.find((w) => w.id === f.whId)?.managerId))}</td><td>${type === 'IN' ? 'Người giao hàng' : 'Người nhận hàng'}<br><br><br></td><td>Người duyệt<br><br><br>${esc(userName(f.approvedBy))}</td></tr></table>`));
  };
  const partnerList = type === 'IN' ? Array.from(new Set(pos.map((p) => p.vendor))) : customers.map((c) => c.name);
  const canCreate = canDo('stock.voucher');
  const appr = canApprove(f);
  const V = V_STATUS[f.status];
  return (
    <Modal wide title={`${meta.label} ${f.code}`} onClose={onClose} footer={<>
      <button className={cn(btnGhost, 'mr-auto')} onClick={print}><Printer className="h-4 w-4" aria-hidden />In phiếu</button>
      <button className={btnGhost} onClick={onClose}>Đóng</button>
      {!ro && canCreate && <button className={btnGhost} onClick={submit}>{voucher ? 'Lưu' : 'Lập phiếu (chờ duyệt)'}</button>}
      {!ro && appr && <button className={btnPrimary} onClick={approve}><CheckCircle2 className="h-4 w-4" aria-hidden />{voucher ? 'Duyệt' : 'Lập & duyệt'}</button>}
    </>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm"><Chip tone={V.tone}>{vStatusLabel(f)}</Chip>{f.requestedBy && <span className="text-[rgb(var(--muted))]">Lập bởi {userName(f.requestedBy)}</span>}{f.approvedBy && <span className="text-[rgb(var(--muted))]">· duyệt bởi {userName(f.approvedBy)} {f.approvedAt ? new Date(f.approvedAt).toLocaleString('vi-VN') : ''}</span>}{f.cancelReason && <span className="text-[rgb(var(--danger-fg))]">· hủy: {f.cancelReason}</span>}</div>
        <fieldset disabled={ro} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Ngày chứng từ"><input type="date" className={inputCls} value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label={type === 'TRANSFER' ? 'Kho đi' : type === 'IN' ? 'Nhập tại kho' : type === 'OUT' ? 'Xuất tại kho' : 'Kho kiểm kê'}><select className={inputCls} value={f.whId} onChange={(e) => setF((p) => ({ ...p, whId: e.target.value, lines: type === 'COUNT' ? [] : p.lines }))}>{act.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></Field>
          {type === 'TRANSFER' ? <Field label="Kho đến"><select className={inputCls} value={f.toWhId ?? ''} onChange={(e) => set('toWhId', e.target.value)}>{act.filter((w) => w.id !== f.whId).map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select></Field>
            : <Field label="Loại phiếu"><select className={inputCls} value={f.reason} onChange={(e) => set('reason', e.target.value)}>{meta.reasons.map((r) => <option key={r}>{r}</option>)}</select></Field>}
          <Field label="Chứng từ gốc" hint={type === 'IN' ? 'Mã PO / hóa đơn' : 'Mã đơn hàng / dự án'}><input className={inputCls} value={f.ref ?? ''} onChange={(e) => set('ref', e.target.value || undefined)} placeholder={type === 'IN' ? 'VD: PO-0012' : 'VD: DH52163'} /></Field>
          {(type === 'IN' || type === 'OUT') && <Field label={type === 'IN' ? 'Nhà cung cấp' : 'Khách hàng'} className="sm:col-span-2"><input className={inputCls} list={`vp-${type}`} value={f.partner ?? ''} onChange={(e) => set('partner', e.target.value || undefined)} /><datalist id={`vp-${type}`}>{partnerList.map((p) => <option key={p} value={p} />)}</datalist></Field>}
          <Field label="Diễn giải" className={type === 'IN' || type === 'OUT' ? 'sm:col-span-2' : 'sm:col-span-4'}><input className={inputCls} value={f.note ?? ''} onChange={(e) => set('note', e.target.value || undefined)} /></Field>
        </fieldset>
        {!ro && (
          <div className="flex flex-wrap gap-2">
            <input className={cn(inputBase, 'min-w-0 flex-1')} list="vp-skus" value={pick} onChange={(e) => { setPick(e.target.value); const code = e.target.value.split(' · ')[0]; if (skuOf(code)) addLine(code); }} placeholder="Gõ mã SKU hoặc tên hàng để thêm dòng…" aria-label="Thêm hàng" />
            <datalist id="vp-skus">{skus.filter((s) => !s.archived).map((s) => <option key={s.sku} value={`${s.sku} · ${s.name}`} />)}</datalist>
            {type === 'COUNT' && <button className={cn(btnGhost, btnSm)} onClick={loadAll}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Nạp toàn bộ hàng trong kho</button>}
          </div>
        )}
        <div className="overflow-x-auto rounded-md border border-[rgb(var(--line))]">
          <table className="dt w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[rgb(var(--raised))] text-[11px] text-[rgb(var(--muted))]"><tr><th className="px-3 py-2">Mã / tên hàng</th><th className="px-3 py-2 text-right">{type === 'COUNT' ? 'Sổ sách' : 'Tồn kho đi/nhận'}</th><th className="px-3 py-2 text-right">{type === 'COUNT' ? 'Thực tế đếm' : 'Số lượng'}</th>{type === 'COUNT' ? <th className="px-3 py-2 text-right">Chênh lệch</th> : <><th className="px-3 py-2 text-right">Đơn giá</th><th className="px-3 py-2 text-right">Thành tiền</th></>}<th /></tr></thead>
            <tbody>
              {f.lines.map((l, i) => { const s = skuOf(l.sku); const sys = type === 'COUNT' ? (ro ? l.system ?? 0 : whQty(s ?? ({} as SkuItem), f.whId, warehouses)) : s ? whQty(s, f.whId, warehouses) : 0; const diff = ro && type === 'COUNT' ? l.diff ?? l.qty - sys : l.qty - sys; return (
                <tr key={l.sku} className="border-t border-[rgb(var(--line))]">
                  <td className="px-3 py-2"><p className="code-chip">{l.sku}</p><p className="max-w-[260px] truncate text-xs text-[rgb(var(--muted))]">{s?.name} · {s?.unit}</p></td>
                  <td className="px-3 py-2 text-right tabular-nums text-[rgb(var(--muted))]">{s ? sys.toLocaleString('vi-VN') : '—'}</td>
                  <td className="px-3 py-2 text-right"><input type="number" min={0} disabled={ro} className={cn(inputBase, 'w-24 py-1 text-right')} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} aria-label={`Số lượng ${l.sku}`} /></td>
                  {type === 'COUNT' ? <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', diff > 0 ? 'text-[rgb(var(--success-fg))]' : diff < 0 ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')}>{diff > 0 ? '+' : ''}{diff.toLocaleString('vi-VN')}</td>
                    : <><td className="px-3 py-2 text-right"><input type="number" min={0} disabled={ro} className={cn(inputBase, 'w-32 py-1 text-right')} value={l.price ?? 0} onChange={(e) => setLine(i, { price: Number(e.target.value) })} aria-label={`Đơn giá ${l.sku}`} /></td><td className="px-3 py-2 text-right tabular-nums">{(l.qty * (l.price ?? 0)).toLocaleString('vi-VN')}</td></>}
                  <td className="px-2 py-2 text-right">{!ro && <button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setF((p) => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }))} aria-label={`Bỏ ${l.sku}`}><X className="h-4 w-4" aria-hidden /></button>}</td>
                </tr>
              ); })}
              {!f.lines.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có dòng hàng. Gõ mã hoặc tên hàng ở ô phía trên.</td></tr>}
            </tbody>
            {type !== 'COUNT' && f.lines.length > 0 && <tfoot><tr className="border-t border-[rgb(var(--line))] font-semibold"><td className="px-3 py-2" colSpan={4}>Tổng cộng ({f.lines.reduce((a, l) => a + l.qty, 0).toLocaleString('vi-VN')} đơn vị)</td><td className="px-3 py-2 text-right tabular-nums">{total.toLocaleString('vi-VN')}</td><td /></tr></tfoot>}
          </table>
        </div>
        {!ro && errs.length > 0 && f.lines.length > 0 && <p className="text-sm text-[rgb(var(--danger-fg))]">{errs.join(' · ')}</p>}
        {voucher && voucher.status !== 'CANCELLED' && (appr || (voucher.status === 'PENDING' && voucher.requestedBy === me?.id)) && (
          <div className="flex flex-col gap-2 rounded-md border border-[rgb(var(--danger)/0.3)] p-3 sm:flex-row sm:items-center">
            <input className={cn(inputBase, 'flex-1')} value={cancelWhy} onChange={(e) => setCancelWhy(e.target.value)} placeholder={voucher.status === 'DONE' ? 'Lý do hủy (tồn kho sẽ được hoàn lại)' : 'Lý do hủy phiếu'} aria-label="Lý do hủy" />
            <button className={cn(btnDanger, btnSm)} onClick={cancel}>Hủy phiếu</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function VoucherList({ type }: { type: VoucherType }) {
  const { stockVouchers, warehouses, userName, canDo } = useApp();
  const { canApprove } = useWarehouseData();
  const inR = useInRange();
  const [q, setQ] = useSticky(`Voucher.${type}.q`, '');
  const [st, setSt] = useSticky<'ALL' | VoucherStatus>(`Voucher.${type}.st`, 'ALL');
  const [wh, setWh] = useSticky(`Voucher.${type}.wh`, 'ALL');
  const [open, setOpen] = useState<StockVoucher | 'new' | null>(null);
  const meta = VOUCHER_META[type];
  const whName = (id?: string) => warehouses.find((w) => w.id === id)?.name ?? '—';
  const t = fold(q.trim());
  const list = stockVouchers.filter((v) => v.type === type && inR(v.date)).filter((v) => (st === 'ALL' || v.status === st) && (wh === 'ALL' || v.whId === wh || v.toWhId === wh) && (!t || fold(`${v.code} ${v.partner ?? ''} ${v.ref ?? ''} ${v.note ?? ''} ${v.lines.map((l) => l.sku).join(' ')}`).includes(t))).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const srt = useSort(`Voucher40.${type}`, list, { 0: (v) => v.code, 2: (v) => v.date });
  const paged = usePaged(srt.rows, 15);
  const pend = stockVouchers.filter((v) => v.type === type && v.status === 'PENDING' && canApprove(v)).length;
  useIntent(`wh.new.${type}`, () => setOpen('new'));
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 lg:w-[280px] lg:flex-none"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--faint))]" aria-hidden /><input className={cn(inputCls, 'bg-[rgb(var(--surface))] py-1.5 pl-9 text-[13.5px]')} placeholder="Mã phiếu, mã hàng, đối tác, chứng từ gốc…" value={q} onChange={(e) => { setQ(e.target.value); paged.setPage(1); }} aria-label="Tìm phiếu" /></div>
        <select className={cn(inputBase, 'py-1.5 text-[13px] sm:w-44')} value={wh} onChange={(e) => { setWh(e.target.value); paged.setPage(1); }} aria-label="Kho">{[<option key="a" value="ALL">Mọi kho</option>, ...warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)]}</select>
        <select className={cn(inputBase, 'py-1.5 text-[13px] sm:w-40')} value={st} onChange={(e) => { setSt(e.target.value as typeof st); paged.setPage(1); }} aria-label="Trạng thái"><option value="ALL">Mọi trạng thái</option>{(Object.keys(V_STATUS) as VoucherStatus[]).map((k) => <option key={k} value={k}>{k === 'DONE' ? meta.done : V_STATUS[k].label}</option>)}</select>
        <button className={cn(btnGhost, btnSm, 'sm:ml-auto lg:hidden')} disabled={!canDo('stock.voucher') && !canDo('stock.approve')} onClick={() => setOpen('new')}><Plus className="h-3.5 w-3.5" aria-hidden />Lập {meta.label.toLowerCase()}</button>
      </div>
      {pend > 0 && <p className="flex items-center gap-2 text-sm text-[rgb(var(--fg2))]"><AlertTriangle className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />{pend} phiếu đang chờ bạn duyệt.<button className="font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setSt('PENDING')}>Xem</button></p>}
      <Panel>
        {list.length ? (
          <>
            <Table stt={Math.max(0, paged.from - 1)} head={['Mã phiếu', 'Chứng từ gốc', 'Ngày', type === 'TRANSFER' ? 'Kho đi → kho đến' : 'Kho', type === 'IN' ? 'Nhà cung cấp' : type === 'OUT' ? 'Khách hàng' : 'Diễn giải', 'Lý do', <span key="m" className="block text-right">Số mã</span>, <span key="q" className="block text-right">{type === 'COUNT' ? 'Lệch' : 'Số lượng'}</span>, 'Người lập', 'Trạng thái']} minW={1200} sort={srt.th}>
              {paged.slice.map((v) => (
                <tr key={v.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => setOpen(v)}>
                  <td className={tdFirst}><Code>{v.code}</Code></td>
                  <td className={tdCls}>{v.ref ? <Code>{v.ref}</Code> : <span className="text-[rgb(var(--faint))]">—</span>}</td>
                  <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(v.date)}</td>
                  <td className={tdCls}>{type === 'TRANSFER' ? <>{whName(v.whId)} <ArrowRight className="inline h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /> {whName(v.toWhId)}</> : whName(v.whId)}</td>
                  <td className={tdCls}><span className="block max-w-[240px] truncate font-medium" title={v.partner ?? v.note}>{v.partner ?? v.note ?? '—'}</span></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[180px] truncate">{v.reason || '—'}</span></td>
                  <td className={cn(tdCls, 'text-right tabular-nums')} title={v.lines.map((l) => l.sku).join(', ')}>{v.lines.length}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{v.lines.reduce((a, l) => a + (type === 'COUNT' ? Math.abs(l.diff ?? 0) : l.qty), 0).toLocaleString('vi-VN')}</td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{userName(v.requestedBy)}</td>
                  <td className={tdLast}><Chip tone={V_STATUS[v.status].tone}>{vStatusLabel(v)}</Chip></td>
                </tr>
              ))}
            </Table>
            <Pagination paged={paged} unit="phiếu" />
          </>
        ) : <EmptyState art="doc" text={`Chưa có ${meta.label.toLowerCase()} trong kỳ`} hint="Đổi kỳ dữ liệu trên thanh trên cùng hoặc lập phiếu mới." />}
      </Panel>
      {open && <VoucherModal type={type} voucher={open === 'new' ? undefined : open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Tồn kho dạng ma trận: tổng + từng kho đã chọn, mỗi kho Thực tế / Khả dụng */
export function StockMatrix() {
  const { skus, warehouses } = useApp();
  const { actual, available } = useWarehouseData();
  const [sel, setSel] = useSticky<string[]>('StockMatrix.wh', []);
  const [q, setQ] = useSticky('StockMatrix.q', '');
  const [only, setOnly] = useSticky<'ALL' | 'IN' | 'OUT'>('StockMatrix.only', 'IN');
  const whs = warehouses.filter((w) => sel.includes(w.id));
  const t = fold(q.trim());
  const list = skus.filter((s) => !s.archived && (!t || fold(`${s.sku} ${s.name} ${s.category}`).includes(t)) && (only === 'ALL' || (only === 'IN' ? actual(s, 'ALL') > 0 : actual(s, 'ALL') <= 0)));
  const paged = usePaged(list, 20);
  const n = (x: number) => <span className={cn('tabular-nums', !x && 'text-[rgb(var(--faint))]')}>{x.toLocaleString('vi-VN')}</span>;
  const th = 'border-b border-l border-[rgb(var(--line))] px-3 py-2 text-right font-semibold';
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--faint))]" aria-hidden /><input className={cn(inputCls, 'pl-9')} placeholder="Tìm mã, tên hàng, phân loại" value={q} onChange={(e) => { setQ(e.target.value); paged.setPage(1); }} aria-label="Tìm hàng" /></div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Chọn kho so sánh">
          {warehouses.filter((w) => w.active).map((w) => { const on = sel.includes(w.id); return <button key={w.id} aria-pressed={on} className={cn('rounded-full border px-3 py-1 text-xs font-medium transition-colors', on ? 'border-[rgb(var(--secondary)/0.7)] bg-[rgb(var(--secondary)/0.12)] text-[rgb(var(--secondary-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')} onClick={() => setSel((p) => (on ? p.filter((x) => x !== w.id) : [...p, w.id]))}>{w.code}</button>; })}
        </div>
        <Tabs variant="pill" tabs={[{ id: 'IN' as const, label: 'Còn hàng' }, { id: 'OUT' as const, label: 'Hết hàng' }, { id: 'ALL' as const, label: 'Tất cả' }]} value={only} onChange={(v) => { setOnly(v); paged.setPage(1); }} />
      </div>
      <div className="overflow-x-auto rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-[12.5px] text-[rgb(var(--muted))]">
            <tr><th rowSpan={2} className="border-b border-[rgb(var(--line))] px-3 py-2 text-left font-normal">Mã hàng</th><th rowSpan={2} className="border-b border-[rgb(var(--line))] px-3 py-2 text-left font-normal">Tên hàng</th><th rowSpan={2} className="border-b border-[rgb(var(--line))] px-3 py-2 text-left font-normal">ĐVT</th><th colSpan={2} className="border-b border-l border-[rgb(var(--line))] px-3 py-2 text-center font-normal text-[rgb(var(--fg))]">Tổng</th>{whs.map((w) => <th key={w.id} colSpan={2} className="border-b border-l border-[rgb(var(--line))] px-3 py-2 text-center font-normal">{w.name}</th>)}</tr>
            <tr><th className={th}>Thực tế</th><th className={th}>Khả dụng</th>{whs.map((w) => <Fragment key={w.id}><th className={th}>Thực tế</th><th className={th}>Khả dụng</th></Fragment>)}</tr>
          </thead>
          <tbody>
            {paged.slice.map((s) => (
              <tr key={s.sku} className="h-11 whitespace-nowrap border-b border-[rgb(var(--ink)/0.06)] hover:bg-[rgb(var(--ink)/0.03)]">
                <td className="px-3 py-2"><Code>{s.sku}</Code></td>
                <td className="px-3 py-2"><span className="block max-w-[320px] truncate font-medium" title={s.name}>{s.name}</span></td>
                <td className="px-3 py-2 text-[rgb(var(--fg2))]">{s.unit}</td>
                <td className="border-l border-[rgb(var(--line))] px-3 py-2 text-right font-medium tabular-nums">{n(actual(s, 'ALL'))}</td><td className="px-3 py-2 text-right">{n(available(s, 'ALL'))}</td>
                {whs.map((w) => <Fragment key={w.id}><td className="border-l border-[rgb(var(--line))] px-3 py-2 text-right">{n(actual(s, w.id))}</td><td className="px-3 py-2 text-right">{n(available(s, w.id))}</td></Fragment>)}
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5 + whs.length * 2} className="px-3 py-8 text-center text-sm text-[rgb(var(--muted))]">Không có mặt hàng phù hợp.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[rgb(var(--muted))]">Thực tế = tồn tự do + hàng giữ chỗ trong kho (giữ chỗ tính ở kho tổng). Khả dụng = tồn tự do − hàng đang chờ xuất / chờ chuyển. Bấm mã kho phía trên để thêm cột so sánh.</p>
      <Pagination paged={paged} unit="mặt hàng" />
    </div>
  );
}

/** Thẻ kho: lịch sử nhập / xuất của 1 mặt hàng tại 1 kho, có tồn lũy kế */
export function StockCard() {
  const { skus, warehouses, moves, userName } = useApp();
  const { main, actual } = useWarehouseData();
  const [sku, setSku] = useSticky('StockCard.sku', skus[0]?.sku ?? '');
  const [wh, setWh] = useSticky<string>('StockCard.wh', 'ALL');
  const s = skus.find((x) => x.sku === sku);
  const rows = moves.filter((m) => m.sku === sku).map((m) => ({ m, d: moveEffect(m, wh, main) })).filter((r) => r.d !== 0).sort((a, b) => a.m.at.localeCompare(b.m.at));
  const end = s ? actual(s, wh) : 0;
  let bal = end - rows.reduce((a, r) => a + r.d, 0);
  const opening = bal;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className={cn(inputBase, 'flex-1')} value={sku} onChange={(e) => setSku(e.target.value)} aria-label="Mặt hàng">{skus.map((x) => <option key={x.sku} value={x.sku}>{x.sku} · {x.name}</option>)}</select>
        <select className={cn(inputBase, 'sm:w-64')} value={wh} onChange={(e) => setWh(e.target.value)} aria-label="Kho"><option value="ALL">Tất cả các kho</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select>
      </div>
      <Panel title={s ? `Thẻ kho ${s.sku} · ${s.unit}` : 'Thẻ kho'}>
        <Table head={['Ngày', 'Chứng từ / diễn giải', 'Nghiệp vụ', 'Nhập', 'Xuất', 'Tồn', 'Người thực hiện']} minW={860}>
          <tr className={rowCls}><td className={tdFirst} /><td className={cn(tdCls, 'font-medium')}>Tồn đầu (trước bút toán đầu tiên được ghi)</td><td className={tdCls} /><td className={tdCls} /><td className={tdCls} /><td className={cn(tdCls, 'text-right font-semibold tabular-nums')}>{opening.toLocaleString('vi-VN')}</td><td className={tdLast} /></tr>
          {rows.map(({ m, d }, i) => { bal += d; return (
            <tr key={`${m.id}-${i}`} className={rowCls}>
              <td className={cn(tdFirst, 'whitespace-nowrap')}>{fmtDate(m.at)}</td>
              <td className={tdCls}><p className="max-w-[340px] truncate">{m.note}</p></td>
              <td className={cn(tdCls, 'text-xs')}>{MOVE_LABEL[m.type]}{m.type === 'WH_TRANSFER' ? ` (${warehouses.find((w) => w.id === m.fromWh)?.code} → ${warehouses.find((w) => w.id === m.toWh)?.code})` : ''}</td>
              <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--success-fg))]')}>{d > 0 ? d.toLocaleString('vi-VN') : ''}</td>
              <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--danger-fg))]')}>{d < 0 ? (-d).toLocaleString('vi-VN') : ''}</td>
              <td className={cn(tdCls, 'text-right font-semibold tabular-nums')}>{bal.toLocaleString('vi-VN')}</td>
              <td className={tdLast}>{userName(m.by)}</td>
            </tr>
          ); })}
        </Table>
        {!rows.length && <p className="py-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có phát sinh nhập / xuất cho mặt hàng này{wh !== 'ALL' ? ' tại kho đã chọn' : ''}.</p>}
      </Panel>
    </div>
  );
}

/** Bảng xuất nhập tồn theo kỳ đang chọn (số lượng + giá trị) */
export function StockXnt() {
  const { skus, warehouses, moves, range, canDo } = useApp();
  const { main, actual } = useWarehouseData();
  const [wh, setWh] = useSticky<string>('Xnt.wh', 'ALL');
  const [q, setQ] = useSticky('Xnt.q', '');
  const [onlyMove, setOnlyMove] = useSticky('Xnt.only', false);
  const cost = canDo('price.viewCost');
  const price = (s: SkuItem) => (cost ? s.costPrice : s.basePrice);
  const t = fold(q.trim());
  const rows = skus.filter((s) => !t || fold(`${s.sku} ${s.name} ${s.category}`).includes(t)).map((s) => {
    const ms = moves.filter((m) => m.sku === s.sku);
    const after = ms.filter((m) => m.at > range.to).reduce((a, m) => a + moveEffect(m, wh, main), 0);
    const inP = ms.filter((m) => m.at >= range.from && m.at <= range.to).map((m) => moveEffect(m, wh, main));
    const nin = inP.filter((d) => d > 0).reduce((a, d) => a + d, 0); const nout = -inP.filter((d) => d < 0).reduce((a, d) => a + d, 0);
    const close = actual(s, wh) - after; const open = close - nin + nout;
    return { s, open, nin, nout, close };
  }).filter((r) => !onlyMove || r.nin || r.nout);
  const sum = (k: 'open' | 'nin' | 'nout' | 'close', v = false) => rows.reduce((a, r) => a + r[k] * (v ? price(r.s) : 1), 0);
  const exportX = () => downloadBlob(`XuatNhapTon_${range.from}_${range.to}.xlsx`, xlsxBlob([{ name: 'XuatNhapTon', widths: [16, 40, 8, 12, 14, 12, 14, 12, 14, 12, 14], rows: [['Mã hàng', 'Tên hàng', 'ĐVT', 'Tồn đầu', 'Giá trị đầu', 'Nhập', 'Giá trị nhập', 'Xuất', 'Giá trị xuất', 'Tồn cuối', 'Giá trị cuối'], ...rows.map((r) => [r.s.sku, r.s.name, r.s.unit, r.open, r.open * price(r.s), r.nin, r.nin * price(r.s), r.nout, r.nout * price(r.s), r.close, r.close * price(r.s)])] }]));
  const paged = usePaged(rows, 20);
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--faint))]" aria-hidden /><input className={cn(inputCls, 'pl-9')} placeholder="Tìm mã, tên hàng" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm hàng" /></div>
        <select className={cn(inputBase, 'sm:w-60')} value={wh} onChange={(e) => setWh(e.target.value)} aria-label="Kho"><option value="ALL">Tất cả các kho</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={onlyMove} onChange={(e) => setOnlyMove(e.target.checked)} />Chỉ hàng có phát sinh</label>
        <button className={btnGhost} onClick={exportX}><Download className="h-4 w-4" aria-hidden />Xuất Excel</button>
      </div>
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Tồn đầu kỳ" value={compact(sum('open', true))} sub={`${sum('open').toLocaleString('vi-VN')} đơn vị`} icon={Boxes} />
        <StatCard label="Nhập trong kỳ" value={compact(sum('nin', true))} sub={`${sum('nin').toLocaleString('vi-VN')} đơn vị`} icon={PackagePlus} color={C.teal} />
        <StatCard label="Xuất trong kỳ" value={compact(sum('nout', true))} sub={`${sum('nout').toLocaleString('vi-VN')} đơn vị`} icon={PackageMinus} color={C.orange} />
        <StatCard label="Tồn cuối kỳ" value={compact(sum('close', true))} sub={`${cost ? 'Theo giá vốn' : 'Theo giá bán lẻ'} · ${rangeText(range)}`} icon={Warehouse} color={C.blue} />
      </div>
      <Panel title={`Xuất nhập tồn ${rangeText(range)}`}>
        <Table stt={Math.max(0, paged.from - 1)} head={['Mã hàng', 'Tên hàng', 'ĐVT', 'Tồn đầu', 'Nhập', 'Xuất', 'Tồn cuối', 'Giá trị cuối kỳ']} minW={980}>
          {paged.slice.map((r) => (
            <tr key={r.s.sku} className={rowCls}>
              <td className={tdFirst}><Code>{r.s.sku}</Code></td>
              <td className={tdCls}><span className="block max-w-[320px] truncate font-medium" title={r.s.name}>{r.s.name}</span></td>
              <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{r.s.unit}</td>
              <td className={cn(tdCls, 'text-right tabular-nums')}>{r.open.toLocaleString('vi-VN')}</td>
              <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--success-fg))]')}>{r.nin ? r.nin.toLocaleString('vi-VN') : '—'}</td>
              <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--danger-fg))]')}>{r.nout ? r.nout.toLocaleString('vi-VN') : '—'}</td>
              <td className={cn(tdCls, 'text-right font-semibold tabular-nums')}>{r.close.toLocaleString('vi-VN')}</td>
              <td className={cn(tdLast, 'text-right tabular-nums')}>{(r.close * price(r.s)).toLocaleString('vi-VN')}</td>
            </tr>
          ))}
        </Table>
        <Pagination paged={paged} unit="mặt hàng" />
      </Panel>
      <p className="text-xs text-[rgb(var(--muted))]">Tính từ thẻ kho (phiếu nhập / xuất / chuyển / kiểm kho, hàng PO về, xuất giao giữ chỗ). Tồn cuối kỳ = tồn hiện tại − phát sinh sau kỳ.</p>
    </div>
  );
}

export function WarehouseModule() {
  const { stockVouchers, warehouses, canDo, setIntent } = useApp();
  const [tab, setTab] = useSticky<WhTab>('WarehouseModule.tab', 'stock');
  const c = (t: VoucherType) => stockVouchers.filter((v) => v.type === t).length;
  const p = stockVouchers.filter((v) => v.status === 'PENDING').length;
  const vt = (['in', 'out', 'transfer', 'count'] as WhTab[]).includes(tab);
  return (
    <div className="space-y-4">
      <Tabs tabs={[
        { id: 'stock' as WhTab, label: 'Tồn kho' }, { id: 'in' as WhTab, label: 'Phiếu kho', count: stockVouchers.length }, { id: 'card' as WhTab, label: 'Thẻ kho' },
        { id: 'xnt' as WhTab, label: 'Xuất nhập tồn' }, { id: 'list' as WhTab, label: 'Danh mục kho', count: warehouses.length },
      ]} value={vt ? 'in' : tab} onChange={setTab}
        aside={(canDo('stock.voucher') || canDo('stock.approve')) ? <>
          <button className={cn(btnGhost, btnSm)} onClick={() => { setTab('count'); setIntent('wh.new.COUNT'); }}><ClipboardCheck className="h-3.5 w-3.5" aria-hidden />Kiểm kho</button>
          <button className={cn(btnPrimary, btnSm)} onClick={() => { const t = vt && tab !== 'count' ? tab : 'in'; setTab(t); setIntent(`wh.new.${({ in: 'IN', out: 'OUT', transfer: 'TRANSFER', count: 'COUNT' } as Record<string, string>)[t]}`); }}><Plus className="h-3.5 w-3.5" aria-hidden />Lập phiếu</button>
        </> : undefined} />
      {p > 0 && tab === 'stock' && <p className="flex items-center gap-2 text-sm text-[rgb(var(--fg2))]"><AlertTriangle className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />{p} phiếu kho đang chờ duyệt<button className="font-medium text-[rgb(var(--accent-fg))] hover:underline" onClick={() => setTab('in')}>Xem phiếu</button></p>}
      {vt && (
        <div className="flex rounded-lg bg-[rgb(var(--raised))] p-0.5 sm:w-fit" role="radiogroup" aria-label="Loại phiếu">
          {([['in', 'Nhập', 'IN'], ['out', 'Xuất', 'OUT'], ['transfer', 'Chuyển', 'TRANSFER'], ['count', 'Kiểm', 'COUNT']] as const).map(([id, label, t]) => (
            <button key={id} role="radio" aria-checked={tab === id} onClick={() => setTab(id)} className={cn('flex-1 rounded-md px-3.5 py-1.5 text-sm sm:flex-none', tab === id ? 'bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>{label}<span className="ml-1.5 font-mono text-[11.5px] text-[rgb(var(--muted))]">{c(t)}</span></button>
          ))}
        </div>
      )}
      {tab === 'stock' && <StockMatrix />}
      {tab === 'in' && <VoucherList type="IN" />}
      {tab === 'out' && <VoucherList type="OUT" />}
      {tab === 'transfer' && <VoucherList type="TRANSFER" />}
      {tab === 'count' && <VoucherList type="COUNT" />}
      {tab === 'card' && <StockCard />}
      {tab === 'xnt' && <StockXnt />}
      {tab === 'list' && <WarehouseSettings />}
    </div>
  );
}

