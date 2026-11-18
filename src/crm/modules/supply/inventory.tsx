'use client';

import { useState } from 'react';
import { AlertTriangle, Package, Plus, Search, Truck, Warehouse } from 'lucide-react';
import { Pagination, usePaged } from '../../components/controls';
import { Chip, EmptyState, Field, Modal, Panel, StatCard, Table, useSticky } from '../../components/ui';
import { btnGhost, btnPrimary, btnSm, C, compact, fmtDate, inputCls, iso, kpiGrid, MOVE_LABEL, receivedReservedFor, RESERVATION_STATUS, rowCls, tdCls, tdFirst, tdLast, useApp } from '../../lib/core';
import type { PoAllocation, ReservationStatus, StockReservation } from '../../lib/types';
import { cn } from '../../lib/utils';
import { SkuPicker, useAllocName } from './purchase-orders';

// =====================================================================
//  KHO & GIỮ CHỖ: hàng giữ chỗ trong kho, xuất giao, giải phóng có xác nhận
// =====================================================================

/** Chọn đích giữ chỗ: dự án đang mở / đã chốt hoặc khách hàng */
export function TargetSelect({ kind, refId, onChange }: { kind: PoAllocation['kind']; refId: string; onChange: (kind: PoAllocation['kind'], refId: string) => void }) {
  const { leads, customers } = useApp();
  const projects = leads.filter((l) => ['ACCEPTED', 'QUOTED', 'WON'].includes(l.status));
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <select className={inputCls} value={kind} onChange={(e) => onChange(e.target.value as PoAllocation['kind'], '')} aria-label="Loại đích">
        <option value="LEAD">Dự án</option>
        <option value="CUSTOMER">Khách hàng / đại lý</option>
      </select>
      <select className={cn(inputCls, 'sm:col-span-2')} value={refId} onChange={(e) => onChange(kind, e.target.value)} aria-label="Đích giữ chỗ">
        <option value="">Chọn…</option>
        {kind === 'LEAD' ? projects.map((l) => <option key={l.id} value={l.id}>{l.company}: {l.boqNote}</option>) : customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}

export function DeliverModal({ r, onClose }: { r: StockReservation; onClose: () => void }) {
  const { deliverReservation, skus } = useApp();
  const allocName = useAllocName();
  const [qty, setQty] = useState(r.qty);
  const [note, setNote] = useState('');
  return (
    <Modal title="Xuất giao hàng giữ chỗ" onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} disabled={qty <= 0 || qty > r.qty || !note.trim()} onClick={() => { deliverReservation(r.id, qty, note.trim()); onClose(); }}><Truck className="h-4 w-4" aria-hidden />Xác nhận xuất</button></>}>
      <div className="space-y-4">
        <div className="rounded bg-[rgb(var(--raised))] p-3 text-sm">
          <p><span className="code-chip">{r.sku}</span> {skus.find((s) => s.sku === r.sku)?.name}</p>
          <p className="text-xs text-[rgb(var(--muted))]">Giữ cho {allocName(r)}, còn trong kho {r.qty.toLocaleString('vi-VN')}, đã giao {r.delivered.toLocaleString('vi-VN')}</p>
        </div>
        <Field label="Số lượng xuất"><input className={inputCls} type="number" min={1} max={r.qty} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
        <Field label="Chứng từ xuất *" hint="Số phiếu xuất kho, mã đơn Getfly hoặc biên bản giao hàng"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: PXK-0012, đơn DH18150" /></Field>
      </div>
    </Modal>
  );
}

export function RequestReleaseModal({ r, onClose }: { r: StockReservation; onClose: () => void }) {
  const { requestRelease } = useApp();
  const allocName = useAllocName();
  const [reason, setReason] = useState('');
  return (
    <Modal title="Yêu cầu trả về tồn tự do" onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} disabled={reason.trim().length < 5} onClick={() => { requestRelease(r.id, reason.trim()); onClose(); }}>Gửi yêu cầu</button></>}>
      <p className="mb-3 text-sm text-[rgb(var(--muted))]">{r.qty.toLocaleString('vi-VN')} {r.sku} đang giữ cho {allocName(r)}. Yêu cầu cần Trưởng phòng phụ trách hoặc Giám đốc xác nhận.</p>
      <Field label="Lý do *"><textarea className={cn(inputCls, 'min-h-20')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Khách đổi quy cách, hủy đơn…" /></Field>
    </Modal>
  );
}

export function DecideReleaseModal({ r, onClose }: { r: StockReservation; onClose: () => void }) {
  const { decideRelease, canRelease, userName, skus } = useApp();
  const allocName = useAllocName();
  const [decision, setDecision] = useState<'RELEASE' | 'TRANSFER' | 'KEEP'>('RELEASE');
  const [target, setTarget] = useState<{ kind: PoAllocation['kind']; refId: string }>({ kind: 'LEAD', refId: '' });
  const [note, setNote] = useState('');
  const allowed = canRelease(r);
  const opts: [typeof decision, string, string][] = [
    ['RELEASE', 'Trả về tồn tự do', 'Cộng vào tồn kho tự do để bán cho khách khác'],
    ['TRANSFER', 'Chuyển sang dự án / khách hàng khác', 'Giữ nguyên trong kho, đổi đích giữ chỗ'],
    ['KEEP', 'Giữ lại cho đích hiện tại', 'Từ chối yêu cầu, ví dụ dự án có thể mở lại'],
  ];
  return (
    <Modal
      title="Xác nhận giải phóng hàng giữ chỗ"
      onClose={onClose}
      footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} disabled={!allowed || (decision === 'TRANSFER' && !target.refId)} onClick={() => { decideRelease(r.id, decision, note.trim(), decision === 'TRANSFER' ? target : undefined); onClose(); }}>Xác nhận</button></>}
    >
      <div className="space-y-4">
        <div className="rounded bg-[rgb(var(--raised))] p-3 text-sm">
          <p><span className="code-chip">{r.sku}</span> {skus.find((s) => s.sku === r.sku)?.name}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{r.qty.toLocaleString('vi-VN')} đang giữ cho {allocName(r)}</p>
          {r.releaseRequest && <p className="mt-1 text-xs text-[rgb(var(--accent-fg))]">{r.releaseRequest.reason}{r.releaseRequest.by ? `, đề nghị bởi ${userName(r.releaseRequest.by)}` : ''}, {fmtDate(r.releaseRequest.at)}</p>}
        </div>
        {!allowed && <p className="rounded bg-[rgb(var(--danger)/0.1)] p-3 text-sm text-[rgb(var(--danger-fg))]">Bạn không có quyền xác nhận. Cần Trưởng phòng của phòng phụ trách hoặc Giám đốc (Cài đặt &gt; Phân quyền &gt; Xác nhận giải phóng hàng giữ chỗ).</p>}
        <fieldset className="space-y-2" disabled={!allowed}>
          {opts.map(([k, label, sub]) => (
            <label key={k} className={cn('flex cursor-pointer items-start gap-3 rounded border px-3 py-2.5', decision === k ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.05)]' : 'border-[rgb(var(--line))] hover:bg-[rgb(var(--raised))]')}>
              <input type="radio" name="decision" className="mt-1 accent-[rgb(var(--accent))]" checked={decision === k} onChange={() => setDecision(k)} />
              <span><span className="block text-sm">{label}</span><span className="block text-xs text-[rgb(var(--muted))]">{sub}</span></span>
            </label>
          ))}
        </fieldset>
        {decision === 'TRANSFER' && <TargetSelect kind={target.kind} refId={target.refId} onChange={(kind, refId) => setTarget({ kind, refId })} />}
        <Field label="Ghi chú"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function ReserveFromStockModal({ onClose, preset }: { onClose: () => void; preset?: { kind: PoAllocation['kind']; refId: string } }) {
  const { skus, reserveFromStock } = useApp();
  const [sku, setSku] = useState('');
  const [target, setTarget] = useState(preset ?? { kind: 'LEAD' as PoAllocation['kind'], refId: '' });
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState('');
  const k = skus.find((s) => s.sku === sku);
  const ok = !!k && qty > 0 && qty <= k.stock && !!target.refId;
  return (
    <Modal title="Giữ chỗ từ tồn tự do" onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} disabled={!ok} onClick={() => { reserveFromStock(sku, target.kind, target.refId, qty, note.trim() || 'Giữ chỗ từ tồn kho'); onClose(); }}>Giữ chỗ</button></>}>
      <div className="space-y-4">
        <Field label="Sản phẩm"><SkuPicker value={sku} onChange={setSku} exclude={skus.filter((s) => s.stock <= 0).map((s) => s.sku)} /></Field>
        {k && <p className="-mt-2 text-xs text-[rgb(var(--muted))]">Tồn tự do hiện có {k.stock.toLocaleString('vi-VN')} {k.unit}</p>}
        <TargetSelect kind={target.kind} refId={target.refId} onChange={(kind, refId) => setTarget({ kind, refId })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Số lượng"><input className={inputCls} type="number" min={1} max={k?.stock ?? 0} value={qty || ''} onChange={(e) => setQty(Number(e.target.value))} /></Field>
          <Field label="Ghi chú"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

export function ReservationActions({ r, onDeliver, onRequest, onDecide }: { r: StockReservation; onDeliver: () => void; onRequest: () => void; onDecide: () => void }) {
  const { canDo, canRelease } = useApp();
  if (r.status === 'HELD') {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button className={cn(btnPrimary, 'px-2.5 py-1 text-xs')} disabled={!canDo('stock.deliver') || r.qty <= 0} onClick={onDeliver}><Truck className="h-3.5 w-3.5" aria-hidden />Xuất giao</button>
        <button className={cn(btnGhost, btnSm)} disabled={!canDo('stock.deliver')} onClick={onRequest}>Trả về tồn</button>
      </div>
    );
  }
  if (r.status === 'PENDING_RELEASE') {
    return <button className={cn(btnGhost, btnSm, canRelease(r) && 'border-[rgb(var(--accent)/0.6)] text-[rgb(var(--accent-fg))]')} onClick={onDecide}>{canRelease(r) ? 'Xác nhận' : 'Xem yêu cầu'}</button>;
  }
  return <span className="text-xs text-[rgb(var(--muted))]">—</span>;
}

/** Hàng giữ chỗ của một dự án / khách hàng: trong kho, đang về, đã giao */
export function ReservedGoodsPanel({ kind, refId }: { kind: PoAllocation['kind']; refId: string }) {
  const { reservations, pos, skus, canDo } = useApp();
  const [deliver, setDeliver] = useState<StockReservation | null>(null);
  const [request, setRequest] = useState<StockReservation | null>(null);
  const [decide, setDecide] = useState<StockReservation | null>(null);
  const [reserve, setReserve] = useState(false);
  const mine = reservations.filter((r) => r.kind === kind && r.refId === refId && r.status !== 'RELEASED');
  const incoming = pos.filter((p) => !p.cancelled).flatMap((p) => p.lines.flatMap((l) => l.allocations.filter((a) => a.kind === kind && a.refId === refId).map((a) => ({ po: p, sku: l.sku, qty: a.qty - receivedReservedFor(p, l.sku, kind, refId) })))).filter((x) => x.qty > 0);
  const unit = (sku: string) => skus.find((s) => s.sku === sku)?.unit ?? '';
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Warehouse className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Hàng giữ chỗ</h3>
        <button className={cn(btnGhost, btnSm)} disabled={!canDo('stock.deliver')} onClick={() => setReserve(true)}><Plus className="h-3.5 w-3.5" aria-hidden />Giữ từ tồn</button>
      </div>
      {!mine.length && !incoming.length && <p className="text-sm text-[rgb(var(--muted))]">Chưa có hàng giữ chỗ.</p>}
      <ul className="space-y-2">
        {mine.map((r) => (
          <li key={r.id} className="rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span><span className="code-chip">{r.sku}</span> <span className="text-xs text-[rgb(var(--muted))]">trong kho</span> <b className="tabular-nums">{r.qty.toLocaleString('vi-VN')}</b> {unit(r.sku)}{r.delivered > 0 && <span className="text-xs text-[rgb(var(--success-fg))]">, đã giao {r.delivered.toLocaleString('vi-VN')}</span>}</span>
              <Chip tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Chip>
            </div>
            <div className="mt-2"><ReservationActions r={r} onDeliver={() => setDeliver(r)} onRequest={() => setRequest(r)} onDecide={() => setDecide(r)} /></div>
          </li>
        ))}
        {incoming.map((x) => (
          <li key={x.po.id + x.sku} className="flex items-center justify-between gap-2 rounded border border-dashed border-[rgb(var(--line))] px-3 py-2 text-sm">
            <span><span className="code-chip">{x.sku}</span> <span className="text-xs text-[rgb(var(--muted))]">đang về theo {x.po.code}</span> <b className="tabular-nums">{x.qty.toLocaleString('vi-VN')}</b> {unit(x.sku)}</span>
            <Chip tone="blue">Chưa về kho</Chip>
          </li>
        ))}
      </ul>
      {deliver && <DeliverModal r={deliver} onClose={() => setDeliver(null)} />}
      {request && <RequestReleaseModal r={request} onClose={() => setRequest(null)} />}
      {decide && <DecideReleaseModal r={decide} onClose={() => setDecide(null)} />}
      {reserve && <ReserveFromStockModal preset={{ kind, refId }} onClose={() => setReserve(false)} />}
    </section>
  );
}

export function InventoryPage() {
  const { reservations, moves, skus, pos, userName, canRelease, canDo } = useApp();
  const allocName = useAllocName();
  const [q, setQ] = useSticky('InventoryPage.q', '');
  const [st, setSt] = useState<string>('ACTIVE');
  const [deliver, setDeliver] = useState<StockReservation | null>(null);
  const [request, setRequest] = useState<StockReservation | null>(null);
  const [decide, setDecide] = useState<StockReservation | null>(null);
  const [reserve, setReserve] = useState(false);
  const price = (sku: string) => { const k = skus.find((s) => s.sku === sku); return (canDo('price.viewCost') ? k?.costPrice : k?.basePrice) ?? 0; };
  const pending = reservations.filter((r) => r.status === 'PENDING_RELEASE');
  const myPending = pending.filter(canRelease);
  const active = reservations.filter((r) => r.status === 'HELD' || r.status === 'PENDING_RELEASE');
  const since30 = iso(new Date(Date.now() - 30 * 864e5));
  const list = reservations.filter((r) => {
    const t = q.trim().toLowerCase();
    const name = allocName(r).toLowerCase();
    return (!t || r.sku.toLowerCase().includes(t) || name.includes(t)) && (st === 'ALL' || (st === 'ACTIVE' ? r.status === 'HELD' || r.status === 'PENDING_RELEASE' : r.status === st));
  }).sort((a, b) => Number(b.status === 'PENDING_RELEASE') - Number(a.status === 'PENDING_RELEASE') || b.receivedAt.localeCompare(a.receivedAt));
  const paged = usePaged(list, 12);
  const source = (r: StockReservation) => { const po = pos.find((p) => p.id === r.poId); return po ? `${po.code} ${po.shipments.find((s) => s.id === r.shipmentId)?.code ?? ''}` : 'Từ tồn tự do'; };

  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Tồn tự do" value={compact(skus.reduce((a, s) => a + s.stock * price(s.sku), 0))} icon={Package} color={C.teal} sub={`${skus.filter((s) => s.stock > 0).length} SKU còn hàng`} />
        <StatCard label="Hàng giữ chỗ" value={compact(active.reduce((a, r) => a + r.qty * price(r.sku), 0))} icon={Warehouse} color={C.blue} sub={`${active.length} suất giữ chỗ`} />
        <StatCard label="Chờ giải phóng" value={String(pending.length)} icon={AlertTriangle} color={C.orange} sub={myPending.length ? `${myPending.length} chờ bạn xác nhận` : 'Không có yêu cầu chờ bạn'} />
        <StatCard label="Xuất giao 30 ngày" value={compact(moves.filter((m) => m.type === 'DELIVER' && m.at >= since30).reduce((a, m) => a + m.qty * price(m.sku), 0))} icon={Truck} color="#8B5CF6" sub={`${moves.filter((m) => m.type === 'DELIVER' && m.at >= since30).length} lần xuất`} />
      </div>

      {pending.length > 0 && (
        <Panel title={`Chờ xác nhận giải phóng (${pending.length})`}>
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 rounded border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.05)] px-3 py-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-sm">
                  <p><span className="code-chip">{r.sku}</span> <b className="tabular-nums">{r.qty.toLocaleString('vi-VN')}</b> đang giữ cho <b>{allocName(r)}</b></p>
                  <p className="text-xs text-[rgb(var(--muted))]">{r.releaseRequest?.reason}{r.releaseRequest?.by ? `, đề nghị bởi ${userName(r.releaseRequest.by)}` : ''}{r.releaseRequest ? `, ${fmtDate(r.releaseRequest.at)}` : ''}</p>
                </div>
                <button className={cn(canRelease(r) ? btnPrimary : btnGhost, btnSm)} onClick={() => setDecide(r)}>{canRelease(r) ? 'Xác nhận' : 'Chờ TP / Giám đốc'}</button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden />
          <input className={cn(inputCls, 'border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 pl-9')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm SKU, dự án, khách hàng…" aria-label="Tìm hàng giữ chỗ" />
        </div>
        <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={st} onChange={(e) => setSt(e.target.value)} aria-label="Trạng thái">
          <option value="ACTIVE">Đang trong kho</option>
          <option value="ALL">Tất cả</option>
          {(Object.keys(RESERVATION_STATUS) as ReservationStatus[]).map((x) => <option key={x} value={x}>{RESERVATION_STATUS[x].label}</option>)}
        </select>
        <button className={cn(btnPrimary, 'justify-center py-2')} onClick={() => setReserve(true)}><Plus className="h-4 w-4" aria-hidden />Giữ chỗ từ tồn tự do</button>
      </div>

      <Panel title={`Hàng giữ chỗ (${list.length})`}>
        <div className="space-y-2 md:hidden">
          {paged.slice.map((r) => (
            <div key={r.id} className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3">
              <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{allocName(r)}</p><Chip tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Chip></div>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]"><span className="font-mono">{r.sku}</span>, trong kho {r.qty.toLocaleString('vi-VN')}, đã giao {r.delivered.toLocaleString('vi-VN')}</p>
              <div className="mt-2"><ReservationActions r={r} onDeliver={() => setDeliver(r)} onRequest={() => setRequest(r)} onDecide={() => setDecide(r)} /></div>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <Table stt={Math.max(0, paged.from - 1)} head={['SKU', 'Giữ cho', 'Nguồn', 'Ngày nhập', 'Còn trong kho', 'Đã giao', 'Trạng thái', 'Thao tác']} minW={1000}>
            {paged.slice.map((r) => (
              <tr key={r.id} className={rowCls}>
                <td className={tdFirst}><p className="code-chip">{r.sku}</p><p className="max-w-[220px] truncate text-xs text-[rgb(var(--muted))]">{skus.find((s) => s.sku === r.sku)?.name}</p></td>
                <td className={tdCls}><p>{allocName(r)}</p><p className="text-xs text-[rgb(var(--muted))]">{r.kind === 'LEAD' ? 'Dự án' : 'Khách hàng'}</p></td>
                <td className={cn(tdCls, 'text-xs')}>{source(r)}</td>
                <td className={cn(tdCls, 'tabular-nums')}>{fmtDate(r.receivedAt)}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{r.qty.toLocaleString('vi-VN')}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums text-[rgb(var(--success-fg))]')}>{r.delivered ? r.delivered.toLocaleString('vi-VN') : '—'}</td>
                <td className={tdCls}><Chip tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Chip></td>
                <td className={tdLast}><ReservationActions r={r} onDeliver={() => setDeliver(r)} onRequest={() => setRequest(r)} onDecide={() => setDecide(r)} /></td>
              </tr>
            ))}
          </Table>
        </div>
        {!list.length && <EmptyState text={<>Chưa có hàng giữ chỗ</>} hint={<>Hàng giữ chỗ phát sinh khi nhập kho đợt hàng có phân bổ, hoặc khi giữ chỗ từ tồn tự do.</>} art="ledger" />}
        <Pagination paged={paged} unit="suất giữ chỗ" />
      </Panel>

      <Panel title="Lịch sử xuất nhập kho">
        <Table head={['Ngày', 'Nghiệp vụ', 'SKU', 'Số lượng', 'Đích', 'Chứng từ / ghi chú', 'Người thực hiện']} minW={900}>
          {moves.slice(0, 30).map((m) => (
            <tr key={m.id} className={rowCls}>
              <td className={cn(tdFirst, 'tabular-nums')}>{fmtDate(m.at)}</td>
              <td className={tdCls}><Chip tone={m.type === 'DELIVER' ? 'teal' : m.type === 'RELEASE' ? 'orange' : m.type === 'TRANSFER' ? 'blue' : 'muted'}>{MOVE_LABEL[m.type]}</Chip></td>
              <td className={cn(tdCls, 'font-mono text-xs')}>{m.sku}</td>
              <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{m.type === 'DELIVER' ? '-' : '+'}{m.qty.toLocaleString('vi-VN')}</td>
              <td className={tdCls}>{m.refId && m.kind ? allocName({ kind: m.kind, refId: m.refId, qty: 0 }) : 'Tồn tự do'}</td>
              <td className={cn(tdCls, 'text-xs text-[rgb(var(--muted))]')}>{m.note}</td>
              <td className={tdLast}>{m.by ? userName(m.by) : '—'}</td>
            </tr>
          ))}
        </Table>
        {!moves.length && <EmptyState text={<>Chưa có giao dịch kho.</>} art="ledger" />}
      </Panel>

      {deliver && <DeliverModal r={deliver} onClose={() => setDeliver(null)} />}
      {request && <RequestReleaseModal r={request} onClose={() => setRequest(null)} />}
      {decide && <DecideReleaseModal r={decide} onClose={() => setDecide(null)} />}
      {reserve && <ReserveFromStockModal onClose={() => setReserve(false)} />}
    </div>
  );
}

