'use client';

import { AlertTriangle, CalendarDays, ChevronRight, Package, Pencil, Plus, Ship, Trash2, Warehouse, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useOutsideClose } from '../../app/header';
import { useIntent } from '../../components/command-palette';
import { CommentButton } from '../../components/comments';
import { Fab, Pagination, RowMenu, usePaged } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { FilterBar } from '../../components/filters';
import { Chip, Code, EmptyState, Field, Modal, Panel, StatCard, Table, Tabs, useSticky } from '../../components/ui';
import { poLineStats, poProgress, poState, shipmentAllocation } from '../../lib/business';
import { btnGhost, btnPrimary, btnSm, C, compact, daysBetween, digits, fmtDate, inputBase, inputCls, inRangeOf, iso, kpiGrid, PO_PURPOSE, receivedReservedFor, rowCls, SHIP_MODE, SHIPMENT_STATUS, tdCls, tdFirst, tdLast, todayISO, uid, useApp, vnd } from '../../lib/core';
import type { ConfirmState, MenuItem, PoAllocation, PoLine, PoPurpose, Shipment, ShipmentStatus, ShipMode, SkuItem, VendorPO } from '../../lib/types';
import { cn } from '../../lib/utils';
import { InventoryPage } from './inventory';

// =====================================================================
//  PHÂN HỆ: ĐẶT HÀNG HÃNG & LỊCH HÀNG VỀ (Vendor PO & Inbound Shipments)
//  - PO đặt trước 3–4 tháng, chia nhiều đợt hàng về (ETA, phương thức, BL/AWB)
//  - Phân bổ giữ chỗ cho dự án / khách hàng, phần còn lại nhập tồn kho tự do
//  - Danh mục SKU (Master SKU Catalog) dùng chung cho PO và bóc tách BOQ
// =====================================================================

export function SupplyModule() {
  const { reservations, canDo, setIntent } = useApp();
  const [tab, setTab] = useSticky<'po' | 'stock'>('SupplyModule.tab', 'po');
  const pending = reservations.filter((r) => r.status === 'PENDING_RELEASE').length;
  return (
    <div className="space-y-4">
      <Tabs tabs={[{ id: 'po', label: 'PO & hàng về' }, { id: 'stock', label: 'Kho & giữ chỗ', count: pending || undefined }]} value={tab} onChange={setTab}
        aside={canDo('po.manage') ? <button className={cn(btnPrimary, btnSm, 'max-lg:hidden')} onClick={() => { setTab('po'); setIntent('po.create'); }}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo PO</button> : undefined} />
      {tab === 'po' ? <POPage /> : <InventoryPage />}
    </div>
  );
}

/** Tên đích giữ chỗ (dự án hoặc khách hàng) */
export function useAllocName() {
  const { leads, customers } = useApp();
  return (a: PoAllocation) => (a.kind === 'LEAD' ? leads.find((l) => l.id === a.refId)?.company ?? 'Dự án đã xóa' : customers.find((c) => c.id === a.refId)?.name ?? 'Khách đã xóa');
}

export function BackorderBadge({ ordered, received }: { ordered: number; received: number }) {
  const owe = Math.max(0, ordered - received);
  if (!owe) return <Chip tone="teal">Đủ</Chip>;
  return <Chip tone={owe === ordered ? 'red' : 'orange'}>Nợ {owe.toLocaleString('vi-VN')}{owe === ordered ? ' (100%)' : ''}</Chip>;
}

export function POPage() {
  const { pos, setPos, skus, canDo, notify, userName, openCustomer, go, range, receiveShipment } = useApp();
  const allocName = useAllocName();
  const canEdit = canDo('po.manage');
  const today = todayISO();
  const in15 = iso(new Date(Date.now() + 15 * 864e5));
  const [q, setQ] = useSticky('POPage.q', '');
  const [st, setSt] = useState('ALL');
  const [purpose, setPurpose] = useState('ALL');
  const [open, setOpen] = useState<string[]>([]);
  const [poForm, setPoForm] = useState<{ id?: string } | null>(null);
  useIntent('po.create', () => setPoForm({}));
  const [shipForm, setShipForm] = useState<{ poId: string; shipmentId?: string } | null>(null);
  const [allocFor, setAllocFor] = useState<{ poId: string; sku: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const skuOf = (code: string) => skus.find((s) => s.sku === code);
  const inR = inRangeOf(range);

  const active = pos.filter((p) => !p.cancelled);
  const allShip = active.flatMap((p) => p.shipments.map((s) => ({ po: p, s })));
  const shipValue = (po: VendorPO, s: Shipment) => s.lines.reduce((a, l) => a + l.qty * (po.lines.find((x) => x.sku === l.sku)?.unitPrice ?? 0), 0);
  const transit = allShip.filter(({ s }) => s.status === 'IN_TRANSIT' || s.status === 'ARRIVED');
  const soon = allShip.filter(({ s }) => s.status !== 'RECEIVED' && s.eta >= today && s.eta <= in15);
  const late = allShip.filter(({ s }) => s.status !== 'RECEIVED' && s.eta < today);
  const oweValue = active.reduce((a, p) => a + p.lines.reduce((b, l) => b + poLineStats(p, l).backorder * l.unitPrice, 0), 0);

  const list = pos.filter((p) => {
    const t = q.trim().toLowerCase();
    const state = poState(p, today).label;
    return (!t || [p.code, p.vendor, p.note, ...p.lines.map((l) => l.sku), ...p.shipments.map((s) => s.docNo)].some((v) => v.toLowerCase().includes(t)))
      && (st === 'ALL' || state === st) && (purpose === 'ALL' || p.purpose === purpose) && inR(p.orderDate);
  }).sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  const paged = usePaged(list, 8);

  const patchPo = (id: string, fn: (p: VendorPO) => VendorPO) => setPos((all) => all.map((p) => (p.id === id ? fn(p) : p)));
  const setShipStatus = (po: VendorPO, s: Shipment, status: ShipmentStatus) => {
    // Nhập kho: chốt phân bổ đợt, phần giữ chỗ vào kho giữ chỗ, phần tự do cộng tồn
    if (status === 'RECEIVED') return receiveShipment(po.id, s.id);
    patchPo(po.id, (p) => ({ ...p, shipments: p.shipments.map((x) => (x.id === s.id ? { ...x, status } : x)) }));
    notify(`${po.code} ${s.code}: ${SHIPMENT_STATUS[status].label}`, 'teal');
  };
  const poMenu = (p: VendorPO): MenuItem[] => [
    { label: 'Thêm đợt hàng về', icon: Ship, onClick: () => setShipForm({ poId: p.id }), disabled: !canEdit || !!p.cancelled },
    { label: 'Sửa PO', icon: Pencil, onClick: () => setPoForm({ id: p.id }), disabled: !canEdit },
    { label: p.cancelled ? 'Mở lại PO' : 'Hủy PO', icon: XCircle, onClick: () => { patchPo(p.id, (x) => ({ ...x, cancelled: !x.cancelled })); notify(`${p.cancelled ? 'Đã mở lại' : 'Đã hủy'} ${p.code}`, 'orange'); }, disabled: !canEdit },
    {
      label: 'Xóa PO', icon: Trash2, danger: true, disabled: !canEdit,
      onClick: () => setConfirm({ title: 'Xóa PO', message: <>Xóa <b>{p.code}</b>?</>, blocked: p.shipments.some((s) => s.status === 'RECEIVED') ? 'PO đã có đợt hàng nhập kho, không thể xóa. Dùng Hủy PO để dừng các đợt còn lại.' : undefined, onConfirm: () => { setPos((all) => all.filter((x) => x.id !== p.id)); notify(`Đã xóa ${p.code}`, 'orange'); } }),
    },
  ];
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  const progressCell = (p: VendorPO) => {
    const g = poProgress(p);
    return (
      <div className="flex items-center gap-2" title={`${g.pct.toFixed(0)}% đã về${g.transit ? `, ${g.transitPct.toFixed(0)}% đang về` : ''}`}>
        <div className="flex h-1 w-20 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]">
          <div style={{ width: `${g.pct}%`, background: 'rgb(var(--fg2))' }} />
          <div style={{ width: `${g.transitPct}%`, background: 'rgb(var(--faint))' }} />
        </div>
        <span className="font-mono text-xs tabular-nums text-[rgb(var(--fg2))]">{g.pct.toFixed(0)}% / {g.transitPct.toFixed(0)}%</span>
      </div>
    );
  };

  const detail = (p: VendorPO) => (
    <div className="space-y-4 bg-[rgb(var(--sunken))] px-4 py-4 sm:px-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><Package className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Sản phẩm trong PO ({p.lines.length})</h4>
          <span className="text-xs text-[rgb(var(--muted))]">Đặt {fmtDate(p.orderDate)}, dự kiến về đủ {fmtDate(p.expectedDate)}{p.createdBy ? `, người lập ${userName(p.createdBy)}` : ''}</span>
        </div>
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="dt w-full min-w-[920px] text-sm">
            <thead className="text-xs text-[rgb(var(--muted))]">
              <tr className="border-b border-[rgb(var(--line))] text-left">
                <th className="py-2 pl-4 pr-2 font-medium sm:pl-5">Mã SKU</th>
                <th className="px-2 py-2 font-medium">Tên sản phẩm</th>
                <th className="px-2 py-2 text-right font-medium">Đặt</th>
                <th className="px-2 py-2 text-right font-medium">Đã về</th>
                <th className="px-2 py-2 text-right font-medium">Đang về</th>
                <th className="px-2 py-2 font-medium">Hãng còn nợ</th>
                <th className="px-2 py-2 font-medium">Phân bổ giữ chỗ</th>
                <th className="py-2 pl-2 pr-4 sm:pr-5" />
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l) => {
                const s = poLineStats(p, l);
                const k = skuOf(l.sku);
                return (
                  <tr key={l.sku} className="border-b border-[rgb(var(--line)/0.6)] align-top">
                    <td className="py-2.5 pl-4 pr-2 font-mono text-xs sm:pl-5">{l.sku}</td>
                    <td className="px-2 py-2.5"><p className="max-w-[240px]">{k?.name ?? 'SKU đã xóa khỏi danh mục'}</p><p className="text-xs text-[rgb(var(--muted))]">{k?.unit ?? ''}{k ? `, ${k.brand}` : ''}, {vnd(l.unitPrice)}</p></td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{s.ordered.toLocaleString('vi-VN')}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-[rgb(var(--success-fg))]">{s.received.toLocaleString('vi-VN')}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-[rgb(var(--secondary-fg))]">{s.transit ? s.transit.toLocaleString('vi-VN') : '—'}</td>
                    <td className="px-2 py-2.5"><BackorderBadge ordered={s.ordered} received={s.received} />{s.unscheduled > 0 && <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">{s.unscheduled.toLocaleString('vi-VN')} chưa có lịch giao</p>}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex max-w-[280px] flex-wrap gap-1">
                        {l.allocations.map((a) => (
                          <button key={a.kind + a.refId} className="rounded-md bg-[rgb(var(--accent)/0.1)] px-1.5 py-0.5 text-left text-[11px] text-[rgb(var(--accent-fg))] hover:underline" onClick={() => (a.kind === 'CUSTOMER' ? openCustomer(a.refId) : go('projects'))}>
                            {a.kind === 'LEAD' ? 'Dự án' : 'KH'} {allocName(a)}: {a.qty.toLocaleString('vi-VN')}
                          </button>
                        ))}
                        <span className="rounded-md bg-[rgb(var(--raised))] px-1.5 py-0.5 text-[11px] text-[rgb(var(--muted))]">Tồn tự do: {s.free.toLocaleString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pl-2 pr-4 sm:pr-5"><button className={cn(btnGhost, btnSm)} disabled={!canEdit} onClick={() => setAllocFor({ poId: p.id, sku: l.sku })}>Phân bổ</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><Ship className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Đợt hàng về ({p.shipments.length})</h4>
          <button className={cn(btnGhost, btnSm)} disabled={!canEdit || !!p.cancelled} onClick={() => setShipForm({ poId: p.id })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm đợt</button>
        </div>
        <div className="space-y-2">
          {[...p.shipments].sort((a, b) => a.eta.localeCompare(b.eta)).map((s) => {
            const M = SHIP_MODE[s.mode];
            const isLate = s.status !== 'RECEIVED' && s.eta < today;
            const left = daysBetween(today, s.eta);
            const next: ShipmentStatus | null = s.status === 'PLANNED' ? 'IN_TRANSIT' : s.status === 'IN_TRANSIT' ? 'ARRIVED' : s.status === 'ARRIVED' ? 'RECEIVED' : null;
            return (
              <div key={s.id} className={cn('rounded-md border p-3', isLate ? 'border-[rgb(var(--danger)/0.5)] bg-[rgb(var(--danger)/0.05)]' : 'border-[rgb(var(--line))] bg-[rgb(var(--surface))]')}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="font-medium">{s.code}</span>
                  <span className="flex items-center gap-1.5 text-xs text-[rgb(var(--muted))]"><M.icon className="h-3.5 w-3.5" aria-hidden />{M.label}</span>
                  <span className="font-mono text-xs text-[rgb(var(--muted))]">{s.mode === 'AIR' ? 'AWB' : 'BL'} {s.docNo || 'chưa có'}</span>
                  <span className="text-xs text-[rgb(var(--muted))]">{s.etd ? `ETD ${fmtDate(s.etd)}, ` : ''}ETA <b className={cn('tabular-nums', isLate ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--fg))]')}>{fmtDate(s.eta)}</b>{s.status !== 'RECEIVED' && <span className={isLate ? 'text-[rgb(var(--danger-fg))]' : ''}> ({isLate ? `trễ ${-left} ngày` : left === 0 ? 'hôm nay' : `còn ${left} ngày`})</span>}{s.receivedAt && `, nhập kho ${fmtDate(s.receivedAt)}`}</span>
                  <Chip tone={isLate ? 'red' : SHIPMENT_STATUS[s.status].tone}>{isLate ? 'Trễ ETA' : SHIPMENT_STATUS[s.status].label}</Chip>
                  <div className="ml-auto flex gap-1.5">
                    {next && <button className={cn(next === 'RECEIVED' ? btnPrimary : btnGhost, btnSm)} disabled={!canEdit} onClick={() => setShipStatus(p, s, next)}>{next === 'IN_TRANSIT' ? 'Đã xuất hàng' : next === 'ARRIVED' ? 'Đã cập cảng' : 'Nhập kho'}</button>}
                    <button className={cn(btnGhost, 'p-1.5')} disabled={!canEdit} onClick={() => setShipForm({ poId: p.id, shipmentId: s.id })} aria-label={`Sửa ${s.code}`}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className={cn(btnGhost, 'p-1.5 hover:text-[rgb(var(--danger-fg))]')} disabled={!canEdit || s.status === 'RECEIVED'} onClick={() => setConfirm({ title: 'Xóa đợt hàng', message: <>Xóa {s.code} của {p.code}?</>, onConfirm: () => patchPo(p.id, (x) => ({ ...x, shipments: x.shipments.filter((y) => y.id !== s.id) })) })} aria-label={`Xóa ${s.code}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <ul className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
                  {s.lines.map((l) => {
                    const al = shipmentAllocation(p, s.id, l.sku);
                    return (
                      <li key={l.sku} className="rounded bg-[rgb(var(--raised))] px-3 py-2 text-xs">
                        <p><span className="font-mono">{l.sku}</span> <b className="tabular-nums">{l.qty.toLocaleString('vi-VN')}</b> {skuOf(l.sku)?.unit ?? ''}</p>
                        <p className="mt-0.5 text-[rgb(var(--muted))]">
                          {al.reserved.map((r) => `Giữ cho ${allocName(r.a)}: ${r.qty.toLocaleString('vi-VN')}`).join('; ')}
                          {al.reserved.length > 0 && '; '}<span className="text-[rgb(var(--fg))]">Tồn tự do: {al.free.toLocaleString('vi-VN')}</span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {!p.shipments.length && <p className="text-sm text-[rgb(var(--muted))]">Chưa có lịch hàng về. Hãng còn nợ toàn bộ PO.</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Đang vận chuyển" value={compact(transit.reduce((a, x) => a + shipValue(x.po, x.s), 0))} icon={Ship} color={C.blue} sub={`${transit.length} lô: ${transit.filter((x) => x.s.mode === 'SEA').length} đường biển, ${transit.filter((x) => x.s.mode === 'AIR').length} đường bay`} />
        <StatCard label="Sắp về 15 ngày" value={String(soon.length)} icon={CalendarDays} color={C.orange} sub={soon.length ? `${compact(soon.reduce((a, x) => a + shipValue(x.po, x.s), 0))}, sớm nhất ${fmtDate([...soon].sort((a, b) => a.s.eta.localeCompare(b.s.eta))[0].s.eta)}` : 'Không có lô sắp về'} />
        <StatCard label="Trễ ETA" value={String(late.length)} icon={AlertTriangle} color={C.red} sub={late.length ? late.map((x) => `${x.po.code} ${x.s.code}`).join(', ') : 'Không có lô trễ'} />
        <StatCard label="Hãng còn nợ" value={compact(oweValue)} icon={Warehouse} color="#8B5CF6" sub="Giá trị chưa về kho của các PO" />
      </div>

      <FilterBar q={q} onQ={setQ} placeholder="Tìm mã PO, SKU, số BL / AWB…" status={st} onStatus={setSt} statusOptions={['Chờ hàng', 'Về một phần', 'Trễ ETA', 'Đã về đủ', 'Đã hủy'].map((x) => ({ value: x, label: x }))} extraActive={purpose !== 'ALL' ? 1 : 0}>
        <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label="Mục đích">
          <option value="ALL">Mọi mục đích</option>
          {(Object.keys(PO_PURPOSE) as PoPurpose[]).map((x) => <option key={x} value={x}>{PO_PURPOSE[x]}</option>)}
        </select>
      </FilterBar>

      <Panel>
        {/* Mobile */}
        <div className="space-y-2 md:hidden">
          {paged.slice.map((p) => {
            const stt = poState(p, today);
            return (
              <div key={p.id} className="overflow-hidden rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
                <button className="w-full p-3 text-left" onClick={() => toggle(p.id)} aria-expanded={open.includes(p.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="font-medium">{p.code}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{p.vendor}, đặt {fmtDate(p.orderDate)}</p></div>
                    <Chip tone={stt.tone}>{stt.label}</Chip>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">{progressCell(p)}<span className="font-semibold tabular-nums">{compact(poProgress(p).value)}</span></div>
                </button>
                {open.includes(p.id) && detail(p)}
              </div>
            );
          })}
        </div>
        {/* Desktop */}
        <div className="hidden md:block">
          <Table stt={Math.max(0, paged.from - 1)} head={['', 'Mã PO', 'Nhà cung cấp', 'Ngày đặt', 'Mục đích', <span key="s" className="block text-right">SKU</span>, <span key="v" className="block text-right">Giá trị</span>, 'Tiến độ hàng về', <span key="d" className="block text-right">Đợt</span>, 'Đợt tới', 'Trạng thái', 'Thao tác']} minW={1080}>
            {paged.slice.map((p) => {
              const stt = poState(p, today);
              const nextShip = [...p.shipments].filter((s) => s.status !== 'RECEIVED').sort((a, b) => a.eta.localeCompare(b.eta))[0];
              const isOpen = open.includes(p.id);
              return [
                <tr key={p.id} className={cn(rowCls, 'cursor-pointer', p.cancelled && 'opacity-50')} onClick={() => toggle(p.id)}>
                  <td className={cn(tdFirst, 'w-10')}><ChevronRight className={cn('h-4 w-4 text-[rgb(var(--muted))] transition-transform', isOpen && 'rotate-90 text-[rgb(var(--accent))]')} aria-hidden /></td>
                  <td className={tdCls}><Code>{p.code}</Code></td>
                  <td className={tdCls}><span className="block max-w-[220px] truncate font-medium">{p.vendor}</span></td>
                  <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')} title={`${daysBetween(p.orderDate, today)} ngày trước`}>{fmtDate(p.orderDate)}</td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{PO_PURPOSE[p.purpose]}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{p.lines.length}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(poProgress(p).value)}</td>
                  <td className={tdCls}>{progressCell(p)}</td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{p.shipments.length}</td>
                  <td className={cn(tdCls, 'font-mono text-xs', nextShip && nextShip.eta < today ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--fg2))]')}>{nextShip ? fmtDate(nextShip.eta) : '—'}</td>
                  <td className={tdCls}><Chip tone={stt.tone}>{stt.label}</Chip></td>
                  <td className={tdLast} onClick={(e) => e.stopPropagation()}><div className="flex items-center justify-end gap-1.5"><CommentButton entity="po" entityId={p.id} title={`${p.code} · ${p.vendor}`} module="supply" /><RowMenu items={poMenu(p)} /></div></td>
                </tr>,
                isOpen && <tr key={`${p.id}-d`}><td colSpan={13} className="p-0">{detail(p)}</td></tr>,
              ];
            })}
          </Table>
        </div>
        {!list.length && <EmptyState text={pos.length ? <>Không có PO khớp bộ lọc.</> : <>Chưa có PO đặt Hãng</>} hint={pos.length ? undefined : <>PO đặt trước 3–4 tháng, chia đợt hàng về và phân bổ giữ chỗ cho dự án.</>} art={pos.length ? 'search' : 'box'} action={pos.length ? undefined : 'Tạo PO ngay'} onAction={canEdit ? () => setPoForm({}) : undefined} />}
        <Pagination paged={paged} unit="PO" />
      </Panel>

      <Fab label="Tạo PO mới" onClick={() => setPoForm({})} disabled={!canEdit} />
      {poForm && <POFormModal id={poForm.id} onClose={() => setPoForm(null)} />}
      {shipForm && <ShipmentModal poId={shipForm.poId} shipmentId={shipForm.shipmentId} onClose={() => setShipForm(null)} />}
      {allocFor && <AllocationModal poId={allocFor.poId} sku={allocFor.sku} onClose={() => setAllocFor(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/** Ô chọn SKU có tìm kiếm theo mã, tên, thương hiệu */
export function SkuPicker({ value, onChange, exclude = [] }: { value: string; onChange: (sku: string) => void; exclude?: string[] }) {
  const { skus } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useOutsideClose(open, () => setOpen(false));
  const cur = skus.find((s) => s.sku === value);
  const t = q.trim().toLowerCase();
  const opts = skus.filter((s) => !exclude.includes(s.sku) && (!t || [s.sku, s.name, s.brand, s.category].some((v) => v.toLowerCase().includes(t)))).slice(0, 8);
  const pick = (s: SkuItem) => { onChange(s.sku); setOpen(false); setQ(''); };
  return (
    <div className="relative" ref={ref} data-picker>
      <input
        className={cn(inputCls, 'py-1.5 text-xs')}
        value={open ? q : cur ? `${cur.sku} – ${cur.name}` : ''}
        placeholder="Tìm mã SKU hoặc tên hàng…"
        onFocus={() => { setOpen(true); setQ(''); setHi(0); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !open) { e.preventDefault(); setOpen(true); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, opts.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === 'Enter' && opts[hi]) { e.preventDefault(); pick(opts[hi]); }
          if (e.key === 'Escape') setOpen(false);
        }}
        role="combobox"
        aria-expanded={open}
        aria-label="Chọn SKU"
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface))] py-1 shadow-2xl" role="listbox">
          {opts.map((s, i) => (
            <li key={s.sku} role="option" aria-selected={i === hi}>
              <button className={cn('w-full px-3 py-2 text-left text-xs', i === hi ? 'bg-[rgb(var(--accent)/0.1)]' : 'hover:bg-[rgb(var(--raised))]')} onMouseEnter={() => setHi(i)} onMouseDown={(e) => { e.preventDefault(); pick(s); }}>
                <span className="code-chip">{s.sku}</span> <span className="text-[rgb(var(--fg))]">{s.name}</span>
                <span className="block text-[rgb(var(--muted))]">{s.brand}, {s.category}, {s.unit}, lead-time {s.leadTimeDays} ngày, tồn {s.stock.toLocaleString('vi-VN')}</span>
              </button>
            </li>
          ))}
          {!opts.length && <li className="px-3 py-3 text-xs text-[rgb(var(--muted))]">Không có SKU phù hợp. Thêm ở phân hệ Sản phẩm.</li>}
        </ul>
      )}
    </div>
  );
}

export function POFormModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const { pos, setPos, skus, me, notify, budget, canDo } = useApp();
  const existing = pos.find((p) => p.id === id);
  const today = todayISO();
  const [vendor, setVendor] = useState(existing?.vendor ?? budget.vendor);
  const [orderDate, setOrderDate] = useState(existing?.orderDate ?? today);
  const [expectedDate, setExpectedDate] = useState(existing?.expectedDate ?? '');
  const [purpose, setPurpose] = useState<PoPurpose>(existing?.purpose ?? 'MIXED');
  const [note, setNote] = useState(existing?.note ?? '');
  const [lines, setLines] = useState<PoLine[]>(existing?.lines ?? [{ sku: '', qty: 0, unitPrice: 0, allocations: [] }]);
  const [touched, setTouched] = useState(false);
  const shippedOf = (sku: string) => existing ? existing.shipments.reduce((a, s) => a + (s.lines.find((x) => x.sku === sku)?.qty ?? 0), 0) : 0;
  const lead = Math.max(0, ...lines.map((l) => skus.find((s) => s.sku === l.sku)?.leadTimeDays ?? 0));
  const autoExpected = lead ? iso(new Date(new Date(`${orderDate}T12:00:00`).getTime() + lead * 864e5)) : '';
  const setLine = (i: number, p: Partial<PoLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const errs: string[] = [];
  const clean = lines.filter((l) => l.sku);
  if (vendor.trim().length < 2) errs.push('Nhập tên Hãng');
  if (!clean.length) errs.push('Chọn ít nhất 1 SKU');
  if (clean.some((l) => l.qty <= 0 || l.unitPrice <= 0)) errs.push('Số lượng và đơn giá phải lớn hơn 0');
  if (existing && clean.some((l) => l.qty < shippedOf(l.sku))) errs.push('Số lượng đặt không được nhỏ hơn số đã lên lịch giao');
  if (existing && existing.lines.some((l) => shippedOf(l.sku) > 0 && !clean.some((x) => x.sku === l.sku))) errs.push('Không xóa được SKU đã có đợt hàng');
  const total = clean.reduce((a, l) => a + l.qty * l.unitPrice, 0);

  const save = () => {
    setTouched(true);
    if (errs.length) return;
    const fixed = clean.map((l) => ({ ...l, allocations: l.allocations.filter((a) => a.qty > 0).slice(), qty: l.qty }));
    if (existing) {
      setPos((all) => all.map((p) => (p.id === existing.id ? { ...p, vendor: vendor.trim(), orderDate, expectedDate: expectedDate || autoExpected, purpose, note: note.trim(), lines: fixed } : p)));
      notify(`Đã cập nhật ${existing.code}`, 'teal');
    } else {
      const prefix = /hilti/i.test(vendor) ? 'HILTI' : budget.vendorCode;
      const seq = Math.max(0, ...pos.map((p) => Number(p.code.match(/(\d+)$/)?.[1] ?? 0))) + 1;
      const code = `PO-${prefix}-${orderDate.slice(0, 4)}-${String(seq).padStart(4, '0')}`;
      setPos((all) => [{ id: uid('po'), code, vendor: vendor.trim(), orderDate, expectedDate: expectedDate || autoExpected || orderDate, purpose, note: note.trim(), lines: fixed, shipments: [], createdBy: me.id }, ...all]);
      notify(`Đã tạo ${code}, ${compact(total)}. Thêm các đợt hàng về khi Hãng xác nhận lịch giao.`, 'teal');
    }
    onClose();
  };

  return (
    <Modal title={existing ? `Sửa ${existing.code}` : 'Tạo PO đặt Hãng'} onClose={onClose} wide footer={<><span className="mr-auto self-center text-sm tabular-nums">Tổng giá trị: <b>{vnd(total)}</b></span><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>{existing ? 'Lưu' : 'Tạo PO'}</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Hãng / nhà cung cấp" className="sm:col-span-2"><input className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} list="vendor-list" /></Field>
        <datalist id="vendor-list">{Array.from(new Set([budget.vendor, ...pos.map((p) => p.vendor)])).map((v) => <option key={v} value={v} />)}</datalist>
        <Field label="Ngày đặt"><input className={inputCls} type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></Field>
        <Field label="Dự kiến về đủ" hint={autoExpected ? `Theo lead-time dài nhất ${lead} ngày: ${fmtDate(autoExpected)}` : undefined}><input className={inputCls} type="date" value={expectedDate || autoExpected} onChange={(e) => setExpectedDate(e.target.value)} /></Field>
        <Field label="Mục đích" className="sm:col-span-2">
          <select className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value as PoPurpose)}>
            {(Object.keys(PO_PURPOSE) as PoPurpose[]).map((x) => <option key={x} value={x}>{PO_PURPOSE[x]}</option>)}
          </select>
        </Field>
        <Field label="Ghi chú" className="sm:col-span-2"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <h3 className="mb-2 mt-5 text-sm font-semibold">Sản phẩm đặt (chọn từ danh mục SKU)</h3>
      <div className="space-y-2">
        {lines.map((l, i) => {
          const k = skus.find((s) => s.sku === l.sku);
          const shipped = shippedOf(l.sku);
          return (
            <div key={i} className="grid grid-cols-12 items-start gap-2 rounded bg-[rgb(var(--raised))] p-2">
              <div className="col-span-12 sm:col-span-6">
                <SkuPicker value={l.sku} exclude={lines.filter((_, j) => j !== i).map((x) => x.sku)} onChange={(sku) => setLine(i, { sku, unitPrice: l.unitPrice || (canDo('price.viewCost') ? skus.find((s) => s.sku === sku)?.costPrice : 0) || 0 })} />
                {k && <p className="mt-1 text-[11px] text-[rgb(var(--muted))]">{k.unit}, tồn {k.stock.toLocaleString('vi-VN')} (min {k.minStock}, max {k.maxStock}){shipped ? `, đã lên lịch ${shipped}` : ''}</p>}
              </div>
              <input className={cn(inputCls, 'col-span-4 py-1.5 text-xs sm:col-span-2')} type="number" min={0} placeholder="SL" value={l.qty || ''} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} aria-label="Số lượng" />
              <input className={cn(inputCls, 'col-span-6 py-1.5 text-xs tabular-nums sm:col-span-3')} inputMode="numeric" placeholder="Đơn giá" value={l.unitPrice ? new Intl.NumberFormat('vi-VN').format(l.unitPrice) : ''} onChange={(e) => setLine(i, { unitPrice: digits(e.target.value) })} aria-label="Đơn giá" />
              <button className="col-span-2 flex justify-center pt-2 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))] disabled:opacity-40 sm:col-span-1" disabled={shipped > 0} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Xóa dòng"><Trash2 className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
      <button className={cn(btnGhost, btnSm, 'mt-2')} onClick={() => setLines((ls) => [...ls, { sku: '', qty: 0, unitPrice: 0, allocations: [] }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm SKU</button>
      {touched && errs.length > 0 && <ul className="mt-3 space-y-0.5 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
    </Modal>
  );
}

export function ShipmentModal({ poId, shipmentId, onClose }: { poId: string; shipmentId?: string; onClose: () => void }) {
  const { pos, setPos, skus, notify } = useApp();
  const po = pos.find((p) => p.id === poId)!;
  const existing = po.shipments.find((s) => s.id === shipmentId);
  const otherQty = (sku: string) => po.shipments.filter((s) => s.id !== shipmentId).reduce((a, s) => a + (s.lines.find((x) => x.sku === sku)?.qty ?? 0), 0);
  const [code, setCode] = useState(existing?.code ?? `Đợt ${po.shipments.length + 1}`);
  const [mode, setMode] = useState<ShipMode>(existing?.mode ?? 'SEA');
  const [docNo, setDocNo] = useState(existing?.docNo ?? '');
  const [etd, setEtd] = useState(existing?.etd ?? '');
  const [eta, setEta] = useState(existing?.eta ?? '');
  const [status, setStatus] = useState<ShipmentStatus>(existing?.status ?? 'PLANNED');
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(po.lines.map((l) => [l.sku, existing ? existing.lines.find((x) => x.sku === l.sku)?.qty ?? 0 : Math.max(0, l.qty - otherQty(l.sku))])));
  const [touched, setTouched] = useState(false);
  const errs: string[] = [];
  if (!eta) errs.push('Nhập ETA');
  if (etd && eta && etd > eta) errs.push('ETD phải trước ETA');
  if (status !== 'PLANNED' && !docNo.trim()) errs.push(`Nhập số ${mode === 'AIR' ? 'AWB' : 'vận đơn BL'} khi hàng đã xuất`);
  po.lines.forEach((l) => { if ((qty[l.sku] ?? 0) + otherQty(l.sku) > l.qty) errs.push(`${l.sku}: vượt số lượng đặt (còn ${l.qty - otherQty(l.sku)})`); });
  if (!Object.values(qty).some((v) => v > 0)) errs.push('Nhập số lượng ít nhất 1 SKU');

  const save = () => {
    setTouched(true);
    if (errs.length) return;
    const s: Shipment = { id: existing?.id ?? uid('s'), code: code.trim() || 'Đợt', mode, docNo: docNo.trim(), etd: etd || undefined, eta, status, receivedAt: existing?.receivedAt, lines: po.lines.filter((l) => (qty[l.sku] ?? 0) > 0).map((l) => ({ sku: l.sku, qty: qty[l.sku] })) };
    setPos((all) => all.map((p) => (p.id === po.id ? { ...p, shipments: existing ? p.shipments.map((x) => (x.id === s.id ? s : x)) : [...p.shipments, s] } : p)));
    notify(`${po.code}: ${existing ? 'đã cập nhật' : 'đã thêm'} ${s.code}, ETA ${fmtDate(eta)}`, 'teal');
    onClose();
  };

  return (
    <Modal title={`${existing ? 'Sửa' : 'Thêm'} đợt hàng về: ${po.code}`} onClose={onClose} wide footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu</button></>}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Tên đợt"><input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <Field label="Phương thức">
          <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value as ShipMode)}>
            {(Object.keys(SHIP_MODE) as ShipMode[]).map((m) => <option key={m} value={m}>{SHIP_MODE[m].label}</option>)}
          </select>
        </Field>
        <Field label={mode === 'AIR' ? 'Số AWB' : 'Số vận đơn (BL)'}><input className={cn(inputCls, 'font-mono')} value={docNo} onChange={(e) => setDocNo(e.target.value.toUpperCase())} /></Field>
        <Field label="ETD (ngày xuất)"><input className={inputCls} type="date" value={etd} onChange={(e) => setEtd(e.target.value)} /></Field>
        <Field label="ETA (dự kiến về) *"><input className={inputCls} type="date" value={eta} onChange={(e) => setEta(e.target.value)} /></Field>
        <Field label="Trạng thái">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)} disabled={existing?.status === 'RECEIVED'}>
            {(Object.keys(SHIPMENT_STATUS) as ShipmentStatus[]).filter((x) => x !== 'RECEIVED' || existing?.status === 'RECEIVED').map((x) => <option key={x} value={x}>{SHIPMENT_STATUS[x].label}</option>)}
          </select>
        </Field>
      </div>
      <p className="mt-2 text-xs text-[rgb(var(--muted))]">Nhập kho bằng nút "Nhập kho" ở danh sách đợt hàng để cộng phần tồn tự do vào tồn kho.</p>
      <h3 className="mb-2 mt-4 text-sm font-semibold">Số lượng trong đợt này</h3>
      <div className="space-y-2">
        {po.lines.map((l) => (
          <div key={l.sku} className="flex items-center gap-3 rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm">
            <div className="min-w-0 flex-1"><p className="code-chip">{l.sku}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{skus.find((s) => s.sku === l.sku)?.name}, đặt {l.qty}, các đợt khác {otherQty(l.sku)}</p></div>
            <input className={cn(inputBase, 'w-28 py-1.5 text-right text-xs tabular-nums')} type="number" min={0} max={l.qty - otherQty(l.sku)} value={qty[l.sku] ?? 0} onChange={(e) => setQty({ ...qty, [l.sku]: Number(e.target.value) })} aria-label={`Số lượng ${l.sku}`} />
          </div>
        ))}
      </div>
      {touched && errs.length > 0 && <ul className="mt-3 space-y-0.5 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
    </Modal>
  );
}

export function AllocationModal({ poId, sku, onClose }: { poId: string; sku: string; onClose: () => void }) {
  const { pos, setPos, leads, customers, skus, notify } = useApp();
  const po = pos.find((p) => p.id === poId)!;
  const line = po.lines.find((l) => l.sku === sku)!;
  const [rows, setRows] = useState<PoAllocation[]>(line.allocations);
  // Phần đã nhập kho theo từng đích bị khóa: chỉ sửa được phần chưa về
  const lockedOf = (kind: PoAllocation['kind'], refId: string) => receivedReservedFor(po, sku, kind, refId);
  const lockErr = line.allocations
    .filter((a) => lockedOf(a.kind, a.refId) > 0)
    .find((a) => (rows.find((r) => r.kind === a.kind && r.refId === a.refId)?.qty ?? 0) < lockedOf(a.kind, a.refId));
  const projects = leads.filter((l) => ['ACCEPTED', 'QUOTED', 'WON'].includes(l.status));
  const used = rows.reduce((a, r) => a + r.qty, 0);
  const over = used > line.qty;
  const dupKey = new Set<string>();
  const dup = rows.some((r) => { const k = r.kind + r.refId; if (dupKey.has(k)) return true; dupKey.add(k); return false; });
  const setRow = (i: number, p: Partial<PoAllocation>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const save = () => {
    if (over || dup || rows.some((r) => !r.refId || r.qty <= 0)) return notify('Kiểm tra lại phân bổ: chọn đích, số lượng > 0, không trùng và không vượt số đặt', 'red');
    if (lockErr) return notify(`Không giảm dưới số đã nhập kho giữ chỗ (${lockedOf(lockErr.kind, lockErr.refId)}). Phần đã về kho xử lý ở tab Kho & giữ chỗ.`, 'red');
    setPos((all) => all.map((p) => (p.id === po.id ? { ...p, lines: p.lines.map((l) => (l.sku === sku ? { ...l, allocations: rows } : l)) } : p)));
    notify(`Đã phân bổ ${sku}: giữ chỗ ${used}, tồn tự do ${line.qty - used}`, 'teal');
    onClose();
  };

  return (
    <Modal title={`Phân bổ giữ chỗ: ${sku}`} onClose={onClose} wide footer={<><span className={cn('mr-auto self-center text-sm tabular-nums', over && 'text-[rgb(var(--danger-fg))]')}>Giữ chỗ {used} / {line.qty}, tồn tự do {Math.max(0, line.qty - used)}</span><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu phân bổ</button></>}>
      <p className="mb-3 text-sm text-[rgb(var(--muted))]">{skus.find((s) => s.sku === sku)?.name}, PO {po.code}. Hàng về theo từng đợt được lấp vào các suất giữ chỗ theo thứ tự dưới đây; phần còn lại nhập tồn kho tự do.</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-12 items-center gap-2 rounded bg-[rgb(var(--raised))] p-2">
            <select className={cn(inputCls, 'col-span-4 py-1.5 text-xs sm:col-span-3')} value={r.kind} onChange={(e) => setRow(i, { kind: e.target.value as PoAllocation['kind'], refId: '' })} aria-label="Loại đích">
              <option value="LEAD">Dự án</option>
              <option value="CUSTOMER">Khách hàng / đại lý</option>
            </select>
            <select className={cn(inputCls, 'col-span-8 py-1.5 text-xs sm:col-span-6')} value={r.refId} onChange={(e) => setRow(i, { refId: e.target.value })} aria-label="Đích giữ chỗ">
              <option value="">Chọn…</option>
              {r.kind === 'LEAD' ? projects.map((l) => <option key={l.id} value={l.id}>{l.company}: {l.boqNote}</option>) : customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className={cn(inputCls, 'col-span-9 py-1.5 text-right text-xs tabular-nums sm:col-span-2')} type="number" min={lockedOf(r.kind, r.refId)} value={r.qty || ''} onChange={(e) => setRow(i, { qty: Number(e.target.value) })} aria-label="Số lượng giữ" />
            <button className="col-span-3 flex justify-center text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))] disabled:opacity-30 sm:col-span-1" disabled={lockedOf(r.kind, r.refId) > 0} title={lockedOf(r.kind, r.refId) > 0 ? 'Đã có hàng nhập kho cho đích này' : undefined} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Xóa dòng"><Trash2 className="h-4 w-4" /></button>
            {lockedOf(r.kind, r.refId) > 0 && <p className="col-span-12 text-[11px] text-[rgb(var(--accent-fg))]">Đã nhập kho giữ chỗ {lockedOf(r.kind, r.refId).toLocaleString('vi-VN')} (khóa), chỉ chỉnh được phần chưa về.</p>}
          </div>
        ))}
      </div>
      <button className={cn(btnGhost, btnSm, 'mt-2')} onClick={() => setRows((rs) => [...rs, { kind: 'LEAD', refId: '', qty: 0 }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm giữ chỗ</button>
      {dup && <p className="mt-2 text-xs text-[rgb(var(--danger-fg))]">Có đích giữ chỗ bị trùng.</p>}
    </Modal>
  );
}

