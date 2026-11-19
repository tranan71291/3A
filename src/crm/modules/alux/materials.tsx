'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ClipboardCheck, Download, Pencil, Plus, Trash2, Warehouse } from 'lucide-react';
import { Pagination, usePaged } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Chip, Code, EmptyState, Field, Modal, MoneyInput, Panel, StatCard, Table, Tabs, useSticky } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, C, compact, digits, fmtDate, inputCls, iso, jobCustName, kpiGrid, nextCode, rangeBounds, rowCls, STOCK_MOVE, tdCls, tdFirst, tdLast, todayISO, uid, useApp, vnd } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import type { CashAccount, ConfirmState, InvMove, InvMoveType, StockItem, VoucherLine } from '../../lib/types';
import { cn } from '../../lib/utils';
import { stockOf } from '../../lib/workshop';
import { SearchBox } from './orders';

export function StockVoucherModal({ type, preset, onClose }: { type: InvMoveType; preset?: { woId?: string; jobId?: string }; onClose: () => void }) {
  const { me, stockItems, setStockItems, stockMoves, setStockMoves, postCash, workOrders, jobs, customers, notify, audit, canDo } = useApp();
  const items = stockItems.filter((s) => s.active);
  const [date, setDate] = useState(todayISO());
  const [partner, setPartner] = useState('');
  const [woId, setWoId] = useState(preset?.woId ?? '');
  const [note, setNote] = useState('');
  const [paid, setPaid] = useState<'' | CashAccount>('');
  const [lines, setLines] = useState<VoucherLine[]>([{ key: uid('vl'), itemId: '', qty: 0, unitCost: 0 }]);
  const wo = workOrders.find((w) => w.id === woId);
  const jobId = wo?.jobId ?? preset?.jobId;
  const bal = (id: string) => stockOf(id, stockMoves);
  const setLine = (k: string, p: Partial<VoucherLine>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)));
  const pick = (k: string, id: string) => { const it = stockItems.find((s) => s.id === id); const b = bal(id); setLine(k, { itemId: id, unitCost: type === 'IN' ? it?.cost ?? 0 : Math.round(b.avg || it?.cost || 0), actual: type === 'ADJUST' ? b.qty : undefined }); };
  const valid = lines.filter((l) => l.itemId && (type === 'ADJUST' ? l.actual !== undefined : l.qty > 0));
  const total = valid.reduce((s, l) => s + (type === 'ADJUST' ? ((l.actual ?? 0) - bal(l.itemId).qty) * l.unitCost : l.qty * l.unitCost), 0);
  const save = () => {
    if (!valid.length) return notify('Chọn vật tư và nhập số lượng', 'red');
    if (type === 'OUT') {
      const over = valid.find((l) => l.qty > bal(l.itemId).qty);
      if (over) return notify(`Không đủ tồn: ${stockItems.find((s) => s.id === over.itemId)?.name} còn ${bal(over.itemId).qty}`, 'red');
    }
    if (type === 'IN' && partner.trim().length < 2) return notify('Nhập nhà cung cấp', 'red');
    const year = date.slice(0, 4);
    const code = nextCode(stockMoves.filter((m) => m.type === type).map((m) => m.code), `${STOCK_MOVE[type].prefix}-${year}-`, 4);
    const at = Date.now();
    const moves: InvMove[] = valid.map((l) => ({
      id: uid('sm'), code, type, date, itemId: l.itemId, qty: type === 'ADJUST' ? Math.round(((l.actual ?? 0) - bal(l.itemId).qty) * 1000) / 1000 : l.qty, unitCost: l.unitCost,
      partner: partner.trim() || undefined, woId: type === 'OUT' ? woId || undefined : undefined, jobId: type === 'OUT' ? jobId : undefined, note: note.trim() || undefined, by: me.id, at,
    })).filter((m) => m.qty !== 0);
    if (!moves.length) return notify('Số kiểm kê khớp tồn sổ sách, không cần điều chỉnh', 'orange');
    setStockMoves((p) => [...moves, ...p]);
    if (type === 'IN') {
      // Cập nhật giá nhập gần nhất vào danh mục
      const last = new Map(valid.map((l) => [l.itemId, l.unitCost]));
      setStockItems((all) => all.map((x) => (last.has(x.id) ? { ...x, cost: last.get(x.id) ?? x.cost } : x)));
      if (paid && canDo('cash.manage')) postCash({ kind: 'OUT', date, account: paid, category: 'Vật tư, nguyên liệu', amount: Math.round(total), partner: partner.trim(), ref: code, note: `Thanh toán ${code}`, source: 'STOCK', sourceId: code });
    }
    audit('STOCK_' + type, `${code}: ${moves.length} dòng, ${vnd(Math.abs(total))}`);
    notify(`Đã lập ${STOCK_MOVE[type].label.toLowerCase()} ${code}${paid && type === 'IN' ? ', kèm phiếu chi' : ''}`, 'teal');
    onClose();
  };
  const activeWo = workOrders.filter((w) => w.stage !== 'DONE' || w.id === woId);
  return (
    <Modal title={type === 'IN' ? 'Phiếu nhập kho' : type === 'OUT' ? 'Phiếu xuất kho' : 'Phiếu kiểm kê'} onClose={onClose} wide
      footer={<><span className="mr-auto self-center text-sm text-[rgb(var(--muted))]">{type === 'ADJUST' ? 'Chênh lệch' : 'Giá trị'} <b className="tabular-nums text-[rgb(var(--fg))]">{vnd(total)}</b></span><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu phiếu</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ngày"><input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {type === 'IN' && <Field label="Nhà cung cấp *"><input className={inputCls} value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="VD: Nhôm Xingfa Quảng Đông" /></Field>}
        {type === 'OUT' && (
          <Field label="Xuất cho lệnh sản xuất">
            <select className={inputCls} value={woId} onChange={(e) => setWoId(e.target.value)}>
              <option value="">Không gắn lệnh (bảo hành, dùng chung)</option>
              {activeWo.map((w) => { const j = jobs.find((x) => x.id === w.jobId); return <option key={w.id} value={w.id}>{w.code}: {j ? jobCustName(j, customers) : w.title}</option>; })}
            </select>
          </Field>
        )}
        {type === 'ADJUST' && <Field label="Người kiểm kê"><input className={inputCls} value={partner} onChange={(e) => setPartner(e.target.value)} placeholder={me.name} /></Field>}
      </div>
      <div className="mt-4">
        <div className="mb-1.5 hidden grid-cols-[1fr_96px_120px_32px] gap-2 px-1 text-xs text-[rgb(var(--muted))] sm:grid">
          <span>Vật tư</span><span className="text-right">{type === 'ADJUST' ? 'Tồn thực tế' : 'Số lượng'}</span><span className="text-right">{type === 'IN' ? 'Đơn giá nhập' : 'Giá bình quân'}</span><span />
        </div>
        <ul className="space-y-2">
          {lines.map((l) => {
            const it = stockItems.find((s) => s.id === l.itemId);
            const b = l.itemId ? bal(l.itemId) : null;
            return (
              <li key={l.key} className="rounded bg-[rgb(var(--raised))] p-2 sm:bg-transparent sm:p-0">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_96px_120px_32px] sm:items-center">
                  <select className={cn(inputCls, 'col-span-2 py-1.5 text-sm sm:col-span-1')} value={l.itemId} onChange={(e) => pick(l.key, e.target.value)} aria-label="Vật tư">
                    <option value="">Chọn vật tư…</option>
                    {Array.from(new Set(items.map((s) => s.category))).map((c) => <optgroup key={c} label={c}>{items.filter((s) => s.category === c).map((s) => <option key={s.id} value={s.id}>{s.code}: {s.name}</option>)}</optgroup>)}
                  </select>
                  {type === 'ADJUST'
                    ? <input className={cn(inputCls, 'py-1.5 text-right text-sm tabular-nums')} type="number" min={0} step="any" value={l.actual ?? ''} onChange={(e) => setLine(l.key, { actual: Number(e.target.value) })} aria-label="Tồn thực tế" />
                    : <input className={cn(inputCls, 'py-1.5 text-right text-sm tabular-nums')} type="number" min={0} step="any" value={l.qty || ''} onChange={(e) => setLine(l.key, { qty: Number(e.target.value) })} aria-label="Số lượng" />}
                  <input className={cn(inputCls, 'py-1.5 text-right text-sm tabular-nums')} inputMode="numeric" disabled={type === 'OUT'} value={l.unitCost ? l.unitCost.toLocaleString('vi-VN') : ''} onChange={(e) => setLine(l.key, { unitCost: digits(e.target.value) })} aria-label="Đơn giá" />
                  <button className="flex justify-center text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))] disabled:opacity-30" disabled={lines.length <= 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Xóa dòng"><Trash2 className="h-4 w-4" /></button>
                </div>
                {b && <p className="mt-1 px-1 text-[11px] text-[rgb(var(--muted))]">Tồn sổ sách {b.qty.toLocaleString('vi-VN')} {it?.unit}{type === 'ADJUST' && l.actual !== undefined ? `, chênh lệch ${(Math.round((l.actual - b.qty) * 1000) / 1000).toLocaleString('vi-VN')}` : ''}{type === 'OUT' && l.qty > b.qty ? ' — không đủ tồn' : ''}</p>}
              </li>
            );
          })}
        </ul>
        <button className={cn(btnGhost, btnSm, 'mt-2')} onClick={() => setLines((ls) => [...ls, { key: uid('vl'), itemId: '', qty: 0, unitCost: 0 }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm dòng</button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Ghi chú"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {type === 'IN' && canDo('cash.manage') && (
          <Field label="Thanh toán ngay cho NCC">
            <select className={inputCls} value={paid} onChange={(e) => setPaid(e.target.value as '' | CashAccount)}><option value="">Chưa thanh toán (ghi công nợ NCC)</option><option value="CASH">Đã trả, lập phiếu chi tiền mặt</option><option value="BANK">Đã trả, lập phiếu chi ngân hàng</option></select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function StockItemModal({ item, onClose }: { item?: StockItem; onClose: () => void }) {
  const { stockItems, setStockItems, notify } = useApp();
  const [f, setF] = useState<StockItem>(item ?? { id: uid('si'), code: '', name: '', category: '', unit: '', minStock: 0, cost: 0, active: true });
  const cats = Array.from(new Set(stockItems.map((s) => s.category)));
  const save = () => {
    if (f.code.trim().length < 2 || f.name.trim().length < 3 || !f.unit.trim()) return notify('Nhập mã, tên và đơn vị tính', 'red');
    if (stockItems.some((s) => s.id !== f.id && s.code.toUpperCase() === f.code.trim().toUpperCase())) return notify('Mã vật tư đã tồn tại', 'red');
    const x = { ...f, code: f.code.trim().toUpperCase(), name: f.name.trim(), category: f.category.trim() || 'Khác', unit: f.unit.trim() };
    setStockItems((all) => (all.some((s) => s.id === x.id) ? all.map((s) => (s.id === x.id ? x : s)) : [...all, x]));
    notify(`Đã lưu ${x.code}`, 'teal');
    onClose();
  };
  return (
    <Modal title={item ? `Sửa ${item.code}` : 'Thêm vật tư'} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mã *"><input className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="NH-XF55" /></Field>
        <Field label="Nhóm"><input className={inputCls} list="si-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /><datalist id="si-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label="Tên vật tư *" className="col-span-2"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Đơn vị tính *"><input className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="cây, m², tấm…" /></Field>
        <Field label="Tồn tối thiểu"><input className={inputCls} type="number" min={0} value={f.minStock} onChange={(e) => setF({ ...f, minStock: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Giá nhập tham khảo" className="col-span-2"><MoneyInput value={f.cost} onChange={(n) => setF({ ...f, cost: n })} /></Field>
      </div>
    </Modal>
  );
}

export function InventoryModule() {
  const { stockItems, setStockItems, stockMoves, setStockMoves, range, canDo, userName, jobs, workOrders, customers } = useApp();
  const [tab, setTab] = useSticky<'stock' | 'moves' | 'report' | 'items'>('InventoryModule.tab', 'stock');
  const [q, setQ] = useSticky('InventoryModule.q', '');
  const [voucher, setVoucher] = useState<InvMoveType | null>(null);
  const [edit, setEdit] = useState<StockItem | null | 'new'>(null);
  const [view, setView] = useSticky<string | null>('InventoryModule.view', null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const can = canDo('stock.manage');
  const { start, end } = rangeBounds(range);
  const fromISO = iso(new Date(start)), toISO = iso(new Date(end));
  const prevDay = iso(new Date(start - 864e5));
  const t = q.trim().toLowerCase();
  const match = (s: StockItem) => !t || `${s.code} ${s.name} ${s.category}`.toLowerCase().includes(t);
  const balances = stockItems.map((s) => ({ s, ...stockOf(s.id, stockMoves) }));
  const low = balances.filter((b) => b.s.active && b.qty < b.s.minStock);
  const inPeriod = stockMoves.filter((m) => m.date >= fromISO && m.date <= toISO);
  const val = (ms: InvMove[], tp: InvMoveType) => ms.filter((m) => m.type === tp).reduce((s, m) => s + m.qty * m.unitCost, 0);
  const vouchers = Array.from(new Set(stockMoves.map((m) => m.code))).map((code) => {
    const ms = stockMoves.filter((m) => m.code === code);
    return { code, ms, first: ms[0], value: ms.reduce((s, m) => s + m.qty * m.unitCost, 0) };
  }).filter((v) => v.first.date >= fromISO && v.first.date <= toISO && (!t || `${v.code} ${v.first.partner ?? ''}`.toLowerCase().includes(t))).sort((a, b) => b.first.date.localeCompare(a.first.date) || b.code.localeCompare(a.code));
  const report = stockItems.filter(match).map((s) => {
    const open = stockOf(s.id, stockMoves, prevDay);
    const ms = inPeriod.filter((m) => m.itemId === s.id);
    const inQ = ms.filter((m) => m.type === 'IN' || (m.type === 'ADJUST' && m.qty > 0)).reduce((x, m) => x + Math.abs(m.qty), 0);
    const inV = ms.filter((m) => m.type === 'IN' || (m.type === 'ADJUST' && m.qty > 0)).reduce((x, m) => x + Math.abs(m.qty) * m.unitCost, 0);
    const outQ = ms.filter((m) => m.type === 'OUT' || (m.type === 'ADJUST' && m.qty < 0)).reduce((x, m) => x + Math.abs(m.qty), 0);
    const outV = ms.filter((m) => m.type === 'OUT' || (m.type === 'ADJUST' && m.qty < 0)).reduce((x, m) => x + Math.abs(m.qty) * m.unitCost, 0);
    const close = stockOf(s.id, stockMoves, toISO);
    return { s, open, inQ, inV, outQ, outV, close };
  }).filter((r) => r.open.qty || r.inQ || r.outQ || r.close.qty);
  const pagedStock = usePaged(balances.filter((b) => match(b.s)), 20);
  const pagedV = usePaged(vouchers, 20);
  const n = (x: number) => x.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  const viewV = vouchers.find((v) => v.code === view) ?? (view ? { code: view, ms: stockMoves.filter((m) => m.code === view), first: stockMoves.find((m) => m.code === view)!, value: 0 } : null);
  const target = (m: InvMove) => { const w = workOrders.find((x) => x.id === m.woId); const j = jobs.find((x) => x.id === (m.jobId ?? w?.jobId)); return j ? `${w?.code ?? j.code}: ${jobCustName(j, customers)}` : m.partner ?? ''; };
  return (
    <div className="space-y-4">
      <Tabs tabs={[{ id: 'stock', label: 'Tồn kho' }, { id: 'moves', label: 'Phiếu nhập / xuất' }, { id: 'report', label: 'Nhập xuất tồn' }, { id: 'items', label: 'Danh mục' }]} value={tab} onChange={setTab} 
        aside={<>
          <button className={cn(btnGhost, btnSm, 'border-0')} disabled={!can} onClick={() => setVoucher('ADJUST')}><ClipboardCheck className="h-3.5 w-3.5" aria-hidden />Kiểm kê</button>
          <button className={cn(btnGhost, btnSm)} disabled={!can} onClick={() => setVoucher('IN')}><ArrowDown className="h-3.5 w-3.5" aria-hidden />Nhập kho</button>
          <button className={cn(btnPrimary, btnSm)} disabled={!can} onClick={() => setVoucher('OUT')}><ArrowUp className="h-3.5 w-3.5" aria-hidden />Xuất kho</button>
        </>} />
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Giá trị tồn kho" value={compact(balances.reduce((s, b) => s + b.value, 0))} icon={Warehouse} color={C.blue} sub={`${balances.filter((b) => b.qty > 0).length} mặt hàng còn tồn`} />
        <StatCard label="Dưới tồn tối thiểu" value={String(low.length)} icon={AlertTriangle} color={low.length ? C.red : C.teal} sub={low.slice(0, 2).map((b) => b.s.name).join(', ') || 'Đủ hàng'} />
        <StatCard label="Nhập trong kỳ" value={compact(val(inPeriod, 'IN'))} icon={ArrowDown} color={C.teal} sub={`${new Set(inPeriod.filter((m) => m.type === 'IN').map((m) => m.code)).size} phiếu nhập`} />
        <StatCard label="Xuất trong kỳ" value={compact(val(inPeriod, 'OUT'))} icon={ArrowUp} color={C.orange} sub={`${new Set(inPeriod.filter((m) => m.type === 'OUT').map((m) => m.code)).size} phiếu xuất`} />
      </div>
      <div className="tb40 flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchBox value={q} onChange={setQ} placeholder={tab === 'moves' ? 'Tìm số phiếu, nhà cung cấp' : 'Tìm mã, tên vật tư'} />
          {tab === 'report' && <button className={cn(btnGhost, btnSm)} onClick={() => downloadCsv(`nhap-xuat-ton-${fromISO}-${toISO}.csv`, [['Mã', 'Tên', 'ĐVT', 'Tồn đầu SL', 'Tồn đầu GT', 'Nhập SL', 'Nhập GT', 'Xuất SL', 'Xuất GT', 'Tồn cuối SL', 'Tồn cuối GT'], ...report.map((r) => [r.s.code, r.s.name, r.s.unit, r.open.qty, r.open.value, r.inQ, Math.round(r.inV), r.outQ, Math.round(r.outV), r.close.qty, r.close.value])])}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>}
          {tab === 'items' && <button className={cn(btnPrimary, btnSm)} disabled={!can} onClick={() => setEdit('new')}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm vật tư</button>}
        </div>
      <Panel>

        {tab === 'stock' && (
          <>
            <Table head={['STT', 'Mã', 'Tên vật tư', 'Nhóm', 'ĐVT', <span key="q" className="block text-right">Tồn</span>, <span key="m" className="block text-right">Tối thiểu</span>, 'Mức tồn', <span key="a" className="block text-right">Giá bình quân (đ)</span>, <span key="v" className="block text-right">Giá trị (đ)</span>]} minW={1120}>
              {pagedStock.slice.map((b, i) => (
                <tr key={b.s.id} className={cn(rowCls, !b.s.active && 'opacity-50')}>
                  <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{(pagedStock.page - 1) * 20 + i + 1}</td>
                  <td className={tdCls}><Code>{b.s.code}</Code></td>
                  <td className={tdCls}><span className="block max-w-[280px] truncate font-medium">{b.s.name}</span></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{b.s.category}</td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{b.s.unit}</td>
                  <td className={cn(tdCls, 'text-right font-medium tabular-nums', b.qty < b.s.minStock && 'text-[rgb(var(--danger-fg))]')}>{n(b.qty)}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{n(b.s.minStock)}</td>
                  <td className={tdCls}>{b.qty < b.s.minStock ? <Chip tone="red">Dưới tối thiểu</Chip> : <Chip tone="teal">Đủ</Chip>}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{b.avg ? Math.round(b.avg).toLocaleString('vi-VN') : '—'}</td>
                  <td className={cn(tdLast, 'text-right tabular-nums')}>{Math.round(b.value).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </Table>
            <Pagination paged={pagedStock} unit="vật tư" />
          </>
        )}

        {tab === 'moves' && (
          <>
            <Table head={['STT', 'Số phiếu', 'Loại', 'Ngày', 'Đối tượng', <span key="d" className="block text-right">Số dòng</span>, <span key="v" className="block text-right">Giá trị</span>, 'Người lập']} minW={980}>
              {pagedV.slice.map((v, i) => (
                <tr key={v.code} className={cn(rowCls, 'cursor-pointer')} onClick={() => setView(v.code)}>
                  <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{(pagedV.page - 1) * 20 + i + 1}</td>
                  <td className={tdCls}><Code>{v.code}</Code></td>
                  <td className={tdCls}><Chip tone={STOCK_MOVE[v.first.type].tone}>{STOCK_MOVE[v.first.type].label}</Chip></td>
                  <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(v.first.date)}</td>
                  <td className={tdCls}><span className="block max-w-[320px] truncate font-medium" title={target(v.first)}>{target(v.first) || '—'}</span></td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{v.ms.length}</td>
                  <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(Math.abs(v.value))}</td>
                  <td className={cn(tdLast, 'text-[rgb(var(--fg2))]')}>{userName(v.first.by)}</td>
                </tr>
              ))}
            </Table>
            {!vouchers.length && <EmptyState text={<>Chưa có phiếu trong kỳ.</>} art="ledger" />}
            <Pagination paged={pagedV} unit="phiếu" />
          </>
        )}

        {tab === 'report' && (
          <>
            <p className="mb-2 text-xs text-[rgb(var(--muted))]">Kỳ {fmtDate(fromISO)} – {fmtDate(toISO)} (đổi kỳ ở bộ chọn thời gian trên cùng). Giá trị tính theo giá bình quân gia quyền.</p>
            <Table head={['STT', 'Mã', 'Vật tư', 'ĐVT', <span key="a" className="block text-right">Tồn đầu</span>, <span key="b" className="block text-right">Nhập SL</span>, <span key="c" className="block text-right">Nhập GT</span>, <span key="d" className="block text-right">Xuất SL</span>, <span key="e" className="block text-right">Xuất GT</span>, <span key="f" className="block text-right">Tồn cuối</span>, <span key="g" className="block text-right">Giá trị cuối</span>]} minW={1240}>
              {report.map((r, i) => (
                <tr key={r.s.id} className={rowCls}>
                  <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{i + 1}</td>
                  <td className={tdCls}><Code>{r.s.code}</Code></td>
                  <td className={tdCls}><span className="block max-w-[260px] truncate font-medium">{r.s.name}</span></td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{r.s.unit}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')} title={compact(r.open.value)}>{n(r.open.qty)}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{n(r.inQ)}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{compact(r.inV)}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{n(r.outQ)}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{compact(r.outV)}</td>
                  <td className={cn(tdCls, 'text-right font-medium tabular-nums')}>{n(r.close.qty)}</td>
                  <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.close.value)}</td>
                </tr>
              ))}
              {report.length > 0 && (
                <tr className="border-t border-[rgb(var(--line))] font-semibold">
                  <td className={tdFirst} /><td className={tdCls}>Cộng</td><td className={tdCls} /><td className={tdCls} />
                  <td className={cn(tdCls, 'text-right tabular-nums')} title="Giá trị tồn đầu">{compact(report.reduce((s, r) => s + r.open.value, 0))}</td>
                  <td className={tdCls} />
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(report.reduce((s, r) => s + r.inV, 0))}</td>
                  <td className={tdCls} />
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(report.reduce((s, r) => s + r.outV, 0))}</td>
                  <td className={tdCls} />
                  <td className={cn(tdLast, 'whitespace-nowrap text-right tabular-nums')}>{compact(report.reduce((s, r) => s + r.close.value, 0))}</td>
                </tr>
              )}
            </Table>
            {!report.length && <EmptyState text={<>Không có phát sinh trong kỳ.</>} art="ledger" />}
          </>
        )}

        {tab === 'items' && (
          <Table head={['STT', 'Mã', 'Tên vật tư', 'Nhóm', 'ĐVT', 'Giá nhập tham khảo', 'Tối thiểu', '']} minW={900}>
            {stockItems.filter(match).map((s, i) => (
              <tr key={s.id} className={cn(rowCls, !s.active && 'opacity-50')}>
                <td className={cn(tdFirst, 'w-12 tabular-nums text-[rgb(var(--muted))]')}>{i + 1}</td>
                <td className={cn(tdCls, 'whitespace-nowrap font-mono text-xs')}>{s.code}</td>
                <td className={tdCls}>{s.name}</td>
                <td className={cn(tdCls, 'text-xs')}>{s.category}</td>
                <td className={cn(tdCls, 'text-xs')}>{s.unit}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{vnd(s.cost)}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{n(s.minStock)}</td>
                <td className={tdLast}><span className="flex justify-end gap-1.5">
                  <button className={cn(btnGhost, btnSm)} disabled={!can} onClick={() => setEdit(s)} aria-label={`Sửa ${s.code}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></button>
                  <button className={cn(btnGhost, btnSm, 'whitespace-nowrap')} disabled={!can} onClick={() => setStockItems((all) => all.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)))}>{s.active ? 'Ngừng' : 'Dùng lại'}</button>
                </span></td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
      {voucher && <StockVoucherModal type={voucher} onClose={() => setVoucher(null)} />}
      {edit && <StockItemModal item={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {viewV && viewV.first && (
        <Modal title={`${STOCK_MOVE[viewV.first.type].label} ${viewV.code}`} onClose={() => setView(null)}
          footer={<><button className={cn(btnGhost, 'mr-auto hover:text-[rgb(var(--danger-fg))]')} disabled={!can} onClick={() => setConfirm({ title: `Xóa phiếu ${viewV.code}`, message: 'Xóa phiếu sẽ tính lại tồn kho. Phiếu chi đã lập (nếu có) giữ nguyên, xóa riêng ở Thu chi.', onConfirm: () => { setStockMoves((p) => p.filter((m) => m.code !== viewV.code)); setView(null); } })}><Trash2 className="h-4 w-4" aria-hidden />Xóa phiếu</button><button className={btnGhost} onClick={() => setView(null)}>Đóng</button></>}>
          <p className="mb-3 text-sm text-[rgb(var(--muted))]">Ngày {fmtDate(viewV.first.date)}, {userName(viewV.first.by)}{target(viewV.first) ? `, ${target(viewV.first)}` : ''}{viewV.first.note ? `. ${viewV.first.note}` : ''}</p>
          <ul className="space-y-1.5">
            {viewV.ms.map((m) => { const it = stockItems.find((s) => s.id === m.itemId); return <li key={m.id} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm"><span>{it?.name ?? m.itemId}</span><span className="tabular-nums">{n(m.qty)} {it?.unit}</span><span className="tabular-nums text-[rgb(var(--muted))]">{compact(Math.abs(m.qty * m.unitCost))}</span></li>; })}
          </ul>
        </Modal>
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

