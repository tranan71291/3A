'use client';

// v57a Bộ vẽ trang — 5 khối chuyên ngành dùng hồ sơ ngành của doanh nghiệp (quy trình, loại tài nguyên) và dữ liệu thật của đơn bán:
//  K-WorkflowHeader (quy trình theo ngành), K-ChecklistTracker (tiến độ công đoạn) — trang Chi tiết đơn
//  K-StageBoard (bảng giai đoạn), K-ResourceCalendar (lịch tài nguyên), K-QuickPOS (bán nhanh tại quầy) — trang Quản lý đơn
// Bước quy trình ngành (`wf`) tách khỏi trạng thái kế toán / kho của đơn: chuyển bước không ghi doanh thu, không xuất kho.
// Studio xem trước bằng chính các khối này với dữ liệu mẫu (`sample`), không đọc dữ liệu doanh nghiệp, không ghi gì.
import { type ReactNode, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { btnGhost, btnPrimary, btnSm, fmtN, fold, inputCls, MAIN_WH, todayISO, uid, useApp } from '../../lib/core';
import { checklistDone, INDUSTRY_BUILTIN, rangeParse, useTerminology } from '../../lib/industry';
import { saleTotals } from '../../lib/getfly';
import type { CfDef, CfVal, IndustryProfile, LBlock, Resource, SaleLine, SalesOrder, SkuItem, Tone } from '../../lib/types';
import { cn } from '../../lib/utils';

type WfState = IndustryProfile['workflowStates'][number];
const TONE_DOT: Record<Tone, string> = { muted: 'rgb(var(--muted))', orange: 'rgb(var(--accent))', teal: 'rgb(var(--success))', red: 'rgb(var(--danger))', blue: 'rgb(var(--secondary))' };

/** Bước hiện tại của đơn: đã chuyển bước thì theo `wf`; chưa thì bước đầu (đơn hoàn thành = bước cuối) */
export const wfOf = (o: Pick<SalesOrder, 'wf' | 'status'>, states: WfState[]): string => (o.wf && states.some((s) => s.id === o.wf) ? o.wf : o.status === 'DONE' ? states[states.length - 1]?.id ?? '' : states[0]?.id ?? '');

/** Quyền chuyển bước: người lên đơn hoặc người quản lý bán hàng; đơn hủy không chuyển */
function useWfMove() {
  const { me, canDo, setSalesOrders, notify } = useApp();
  const can = (o: SalesOrder) => o.status !== 'CANCELLED' && (canDo('sale.manage') || (!!me && o.by === me.id));
  const move = (o: SalesOrder, to: string, states: WfState[]) => {
    if (!can(o)) { notify('Chỉ người lên đơn hoặc quản lý bán hàng được chuyển bước', 'red'); return; }
    const from = wfOf(o, states);
    if (from === to) return;
    setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, wf: to, wfLog: [...(x.wfLog ?? []), { from, to, by: me?.id, at: Date.now() }] } : x)));
    notify(`${o.code}: chuyển sang ${states.find((s) => s.id === to)?.label ?? to}`, 'teal');
  };
  return { can, move };
}

/** Hồ sơ ngành dùng cho khối: thật = ngành của doanh nghiệp; mẫu = Sản xuất & lắp đặt (nhiều bước, có đội thợ) */
function useProfile(sample?: boolean): IndustryProfile | undefined {
  const { profile } = useTerminology();
  return sample ? INDUSTRY_BUILTIN.find((p) => p.id === 'mfg_install') : profile;
}

// ---------------- dữ liệu mẫu (Studio) ----------------
const sOrder = (n: number, cust: string, wf: string, total: number, cf: Record<string, CfVal> = {}): SalesOrder => ({ id: `wf-s${n}`, code: `LSX-0${n}`, createdAt: 0, date: todayISO(), source: 'COUNTER', customer: cust, lines: [{ id: 'l', kind: 'SKU', ref: 'S', name: 'Mẫu', unit: 'bộ', qty: 1, price: total, discountPct: 0, vat: 0 }], pay: 'CASH', creditDays: 0, payments: [], delivery: 'PICKUP', whId: MAIN_WH, invoice: false, status: 'PENDING', wf, cf } as SalesOrder);
const dayAt = (d: number, h: number) => { const t = new Date(); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + d); return `${t.toISOString().slice(0, 10)}T${String(h).padStart(2, '0')}:00`; };
// tạo khi dùng (không tạo lúc nạp module: core / page-builder nạp vòng nhau)
let sCache: SalesOrder[] | null = null;
const sOrders = (): SalesOrder[] => (sCache ??= [
  sOrder(1, 'Căn hộ Vinhomes C2-1205', 'survey', 38e6), sOrder(2, 'Nhà phố Thảo Điền', 'make', 126e6, { doi: 'r1', lich: `${dayAt(1, 8)}/${dayAt(1, 17)}` }),
  sOrder(3, 'Showroom Q7', 'install', 84e6, { doi: 'r2', lich: `${dayAt(2, 8)}/${dayAt(3, 12)}` }), sOrder(4, 'Văn phòng Landmark', 'install', 210e6, { doi: 'r1', lich: `${dayAt(3, 13)}/${dayAt(3, 18)}` }),
  sOrder(5, 'Biệt thự Đảo Kim Cương', 'accept', 315e6), sOrder(6, 'Quán cà phê Lê Lợi', 'quote', 22e6),
]);
const S_RES: Resource[] = [{ id: 'r1', kind: 'doi_tho', name: 'Đội lắp đặt số 1', active: true, at: 0 }, { id: 'r2', kind: 'doi_tho', name: 'Đội lắp đặt số 2', active: true, at: 0 }];
const S_CK: CfDef = { id: 'ck', entity: 'sale', scope: 'HEAD', key: 'ck', label: 'Checklist kỹ thuật', type: 'checklist', options: ['Khảo sát hiện trạng', 'Đo đạc kích thước', 'Gia công tại xưởng', 'Lắp khung', 'Vệ sinh, bàn giao'], required: 'NONE', levels: { sys: true, tr: false, mfg: false, tenants: [] }, where: { form: true, info: true, list: false, filter: false }, status: 'ACTIVE', order: 1, at: 0, by: '' } as CfDef;
const S_SKUS = [['ALU-55', 'Cửa nhôm hệ 55', 2.45e6], ['ALU-93', 'Cửa trượt hệ 93', 3.1e6], ['KINH-8', 'Kính cường lực 8mm', 450e3], ['PK-TAY', 'Tay nắm inox', 180e3], ['PK-BL', 'Bản lề 3D', 95e3], ['RON', 'Ron cao su EPDM', 25e3]].map(([sku, name, p]) => ({ sku, name, unit: 'cái', basePrice: p, vatPct: 8 }) as SkuItem);

// ---------------- 1. Quy trình theo ngành ----------------
export function WorkflowHeader({ o, sample }: { o?: SalesOrder; sample?: boolean }) {
  const p = useProfile(sample);
  const { users } = useApp();
  const { can, move } = useWfMove();
  const states = p?.workflowStates ?? [];
  const ord = sample ? sOrders()[2] : o;
  if (!states.length || !ord) return <p className="text-[12.5px] text-[rgb(var(--muted))]">Ngành của doanh nghiệp chưa có quy trình</p>;
  const cur = wfOf(ord, states);
  const i = states.findIndex((s) => s.id === cur);
  const next = states[i + 1];
  const last = ord.wfLog?.[ord.wfLog.length - 1];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-wf-header>
      <ol className="flex min-w-0 flex-1 items-center gap-1.5" aria-label="Quy trình theo ngành">
        {states.map((s, k) => (
          <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1.5" aria-current={k === i ? 'step' : undefined}>
            <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-medium tabular-nums', k < i ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : k === i ? 'bg-[rgb(var(--accent))] text-[rgb(var(--on-accent))]' : 'border border-[rgb(var(--line))] text-[rgb(var(--muted))]')}>{k < i ? <Check className="h-3.5 w-3.5" aria-hidden /> : k + 1}</span>
            <span className={cn('truncate text-[12.5px]', k === i ? 'font-medium' : k < i ? 'text-[rgb(var(--fg2))]' : 'text-[rgb(var(--muted))]')}>{s.label}</span>
            {k < states.length - 1 && <span className={cn('h-px min-w-2 flex-1', k < i ? 'bg-[rgb(var(--fg))]' : 'bg-[rgb(var(--line))]')} aria-hidden />}
          </li>
        ))}
      </ol>
      <div className="flex shrink-0 items-center gap-2">
        {last && <span className="text-[12px] text-[rgb(var(--muted))]">{users.find((u) => u.id === last.by)?.name ?? '—'} · {new Date(last.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span>}
        {next && (sample || can(ord)) && <button type="button" className={cn(btnPrimary, btnSm)} disabled={sample} onClick={() => o && move(o, next.id, states)}>Chuyển sang {next.label}<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>}
      </div>
    </div>
  );
}

// ---------------- 2. Tiến độ công đoạn ----------------
export function ChecklistTracker({ b, o, sample }: { b: LBlock; o?: SalesOrder; sample?: boolean }) {
  const { platform, org, setSalesOrders, me, canDo } = useApp();
  const defs = sample ? [S_CK] : platform.customFields.filter((d) => d.entity === 'sale' && d.scope === 'HEAD' && d.type === 'checklist' && d.status === 'ACTIVE' && (d.levels.sys || d.levels.tenants.includes(org.id) || (org.profile === 'MANUFACTURING' ? d.levels.mfg : d.levels.tr)) && (!b.config.ckKeys?.length || b.config.ckKeys.includes(d.key)));
  const vals: Record<string, CfVal> = sample ? { ck: JSON.stringify(['Khảo sát hiện trạng', 'Đo đạc kích thước']) } : o?.cf ?? {};
  const edit = !sample && !!o && o.status !== 'CANCELLED' && (canDo('sale.manage') || o.by === me?.id);
  if (!defs.length) return <p className="text-[12.5px] text-[rgb(var(--muted))]">Chưa có trường Danh sách công đoạn cho đơn</p>;
  const toggle = (d: CfDef, item: string) => {
    if (!o) return;
    const done = checklistDone(vals[d.key]);
    const next = done.includes(item) ? done.filter((x) => x !== item) : [...done, item];
    setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, cf: { ...(x.cf ?? {}), [d.key]: JSON.stringify(next) } } : x)));
  };
  return (
    <div className="space-y-3" data-checklist-tracker>
      {defs.map((d) => {
        const items = d.options ?? [];
        const done = checklistDone(vals[d.key]).filter((x) => items.includes(x));
        const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;
        return (
          <div key={d.key}>
            <div className="mb-1 flex items-center gap-2 text-[12.5px]"><span className="min-w-0 flex-1 truncate font-medium">{d.label}</span><span className="font-mono tabular-nums text-[rgb(var(--muted))]">{done.length}/{items.length}</span></div>
            <div className="mb-2 h-1.5 rounded-full bg-[rgb(var(--ink)/0.07)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${d.label}: ${pct}%`}><div className="h-full rounded-full bg-[rgb(var(--fg))]" style={{ width: `${pct}%` }} /></div>
            <ul className="space-y-1">{items.map((it) => { const on = done.includes(it); return (
              <li key={it}><button type="button" disabled={!edit} onClick={() => toggle(d, it)} role="checkbox" aria-checked={on} className="flex w-full items-center gap-2 text-left text-[12.5px] disabled:cursor-default">
                <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded border', on ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'border-[rgb(var(--line))]')}>{on && <Check className="h-3 w-3" aria-hidden />}</span>
                <span className={cn(on && 'text-[rgb(var(--muted))] line-through')}>{it}</span>
              </button></li>
            ); })}</ul>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- 3. Bảng giai đoạn ----------------
export function StageBoard({ sample }: { sample?: boolean }) {
  const p = useProfile(sample);
  const { mySales, setOpenSale } = useApp();
  const { can, move } = useWfMove();
  const [over, setOver] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const states = p?.workflowStates ?? [];
  const orders = sample ? sOrders() : mySales.filter((o) => o.status !== 'CANCELLED').sort((a, b) => b.createdAt - a.createdAt).slice(0, 300);
  if (!states.length) return <p className="text-[12.5px] text-[rgb(var(--muted))]">Ngành của doanh nghiệp chưa có quy trình</p>;
  return (
    <div className="grid gap-3 overflow-x-auto pb-1" style={{ gridTemplateColumns: `repeat(${states.length}, minmax(180px, 1fr))` }} data-stage-board>
      {states.map((s) => {
        const list = orders.filter((o) => wfOf(o, states) === s.id);
        const sum = list.reduce((a, o) => a + saleTotals(o).grand, 0);
        return (
          <section key={s.id} aria-label={`Bước ${s.label}`} className={cn('flex min-w-0 flex-col rounded-xl border bg-[rgb(var(--ink)/0.025)] p-2', over === s.id ? 'border-[rgb(var(--accent))]' : 'border-[rgb(var(--line))]')}
            onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(s.id); } }} onDragLeave={() => setOver((x) => (x === s.id ? null : x))}
            onDrop={(e) => { e.preventDefault(); setOver(null); const o = orders.find((x) => x.id === dragId); setDragId(null); if (o && !sample) move(o, s.id, states); }}>
            <header className="mb-2 flex items-center gap-1.5 px-1 text-[12.5px]"><span className="h-2 w-2 rounded-full" style={{ background: TONE_DOT[s.tone] }} aria-hidden /><span className="min-w-0 flex-1 truncate font-medium">{s.label}</span><span className="font-mono tabular-nums text-[rgb(var(--muted))]">{list.length}</span></header>
            <p className="mb-2 px-1 font-mono text-[11px] tabular-nums text-[rgb(var(--muted))]">{fmtN(sum)}</p>
            <div className="space-y-1.5">{list.slice(0, 40).map((o) => (
              <button key={o.id} type="button" draggable={sample || can(o)} onDragStart={(e) => { setDragId(o.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', o.id); }} onDragEnd={() => setDragId(null)}
                onClick={() => !sample && setOpenSale(o.id)} className="block w-full rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-2.5 py-2 text-left hover:border-[rgb(var(--ink)/0.25)]" data-stage-card={o.code}>
                <span className="block font-mono text-[11.5px] text-[rgb(var(--muted))]">{o.code}</span>
                <span className="block truncate text-[13px] font-medium">{o.customer}</span>
                <span className="block text-right font-mono text-[12px] tabular-nums">{fmtN(saleTotals(o).grand)}</span>
              </button>
            ))}{list.length > 40 && <p className="px-1 text-[11.5px] text-[rgb(var(--muted))]">+{list.length - 40} đơn</p>}{!list.length && <p className="px-1 py-3 text-center text-[11.5px] text-[rgb(var(--muted))]">Trống</p>}</div>
          </section>
        );
      })}
    </div>
  );
}

// ---------------- 4. Lịch tài nguyên ----------------
export function ResourceCalendar({ b, sample }: { b: LBlock; sample?: boolean }) {
  const { platform, org, mySales, resources, setOpenSale } = useApp();
  const p = useProfile(sample);
  const [shift, setShift] = useState(0);
  const n = b.config.days ?? 7;
  const start = useMemo(() => { const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7) + shift * n); return t; }, [shift, n]);
  const days = Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const defs: CfDef[] = sample ? [{ key: 'doi', type: 'resource_picker', rangeKey: 'lich', resourceKind: 'doi_tho' } as CfDef]
    : platform.customFields.filter((d) => d.entity === 'sale' && d.type === 'resource_picker' && d.status === 'ACTIVE' && !!d.rangeKey && (d.levels.sys || d.levels.tenants.includes(org.id) || (org.profile === 'MANUFACTURING' ? d.levels.mfg : d.levels.tr)));
  const kinds = new Set(defs.map((d) => d.resourceKind).filter(Boolean));
  const res = (sample ? S_RES : resources.filter((r) => r.active)).filter((r) => (b.config.resKind ? r.kind === b.config.resKind : !kinds.size || kinds.has(r.kind)));
  const orders = sample ? sOrders() : mySales.filter((o) => o.status !== 'CANCELLED');
  const kindLabel = (k: string) => p?.resourceKinds.find((x) => x.id === k)?.label ?? k;
  if (!defs.length) return <p className="text-[12.5px] text-[rgb(var(--muted))]">Chưa có trường Chọn tài nguyên gắn Khoảng thời gian cho đơn</p>;
  if (!res.length) return <p className="text-[12.5px] text-[rgb(var(--muted))]">Chưa có tài nguyên (Cài đặt › Tài nguyên)</p>;
  const bookings = (r: Resource, d: Date) => {
    const a = new Date(d).getTime(), z = a + 864e5;
    return orders.flatMap((o) => defs.filter((df) => o.cf?.[df.key] === r.id).map((df) => ({ o, rg: rangeParse(o.cf?.[df.rangeKey!]) })))
      .filter((x) => x.rg && new Date(x.rg.from).getTime() < z && new Date(x.rg.to).getTime() > a);
  };
  const hm = (s: string) => s.slice(11, 16);
  return (
    <div data-resource-calendar>
      <div className="mb-2 flex items-center gap-2 text-[12.5px]">
        <button type="button" className={cn(btnGhost, 'h-7 w-7 p-0')} onClick={() => setShift(shift - 1)} aria-label="Tuần trước"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
        <span className="font-medium tabular-nums">{days[0].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – {days[n - 1].toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
        <button type="button" className={cn(btnGhost, 'h-7 w-7 p-0')} onClick={() => setShift(shift + 1)} aria-label="Tuần sau"><ChevronRight className="h-4 w-4" aria-hidden /></button>
        {shift !== 0 && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => setShift(0)}>Tuần này</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-[12px]">
          <thead><tr><th className="w-40 px-2 py-1.5 text-left font-normal text-[rgb(var(--muted))]">Tài nguyên</th>{days.map((d) => <th key={iso(d)} className={cn('px-1 py-1.5 text-left font-normal', iso(d) === todayISO() ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]} <span className="tabular-nums">{d.getDate()}</span></th>)}</tr></thead>
          <tbody>{res.map((r) => (
            <tr key={r.id} className="border-t border-[rgb(var(--line)/0.7)]">
              <td className="px-2 py-1.5 align-top"><span className="block truncate font-medium">{r.name}</span><span className="block truncate text-[11px] text-[rgb(var(--muted))]">{kindLabel(r.kind)}</span></td>
              {days.map((d) => { const bs = bookings(r, d); return (
                <td key={iso(d)} className={cn('px-1 py-1 align-top', iso(d) === todayISO() && 'bg-[rgb(var(--accent)/0.05)]')}>
                  {bs.map(({ o, rg }) => <button key={o.id} type="button" onClick={() => !sample && setOpenSale(o.id)} title={`${o.code} · ${o.customer}`} className="mb-0.5 block w-full truncate rounded border-l-2 border-[rgb(var(--secondary))] bg-[rgb(var(--secondary)/0.08)] px-1 py-0.5 text-left text-[11px]" data-booking={o.code}><span className="font-mono tabular-nums">{rg!.from.slice(0, 10) === iso(d) ? hm(rg!.from) : '…'}–{rg!.to.slice(0, 10) === iso(d) ? hm(rg!.to) : '…'}</span> {o.code}</button>)}
                </td>
              ); })}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- 5. Bán nhanh tại quầy ----------------
export function QuickPOS({ b, sample }: { b: LBlock; sample?: boolean }) {
  const { skus, customers, saveSale, me, notify, canDo, setOpenSale } = useApp();
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<{ sku: string; qty: number }[]>([]);
  const [custId, setCustId] = useState('');
  const list = (sample ? S_SKUS : skus.filter((x) => !x.archived)).filter((x) => !q.trim() || fold(`${x.sku} ${x.name}`).includes(fold(q.trim()))).slice(0, b.config.posItems ?? 12);
  const all = sample ? S_SKUS : skus;
  const lineOf = (c: { sku: string; qty: number }) => { const x = all.find((k) => k.sku === c.sku)!; return { x, net: Math.round(c.qty * x.basePrice), vat: Math.round(c.qty * x.basePrice * (x.vatPct ?? 8) / 100) }; };
  const total = cart.reduce((s, c) => { const l = lineOf(c); return s + l.net + l.vat; }, 0);
  const addOne = (sku: string, d = 1) => setCart((cs) => { const i = cs.findIndex((c) => c.sku === sku); if (i < 0) return d > 0 ? [...cs, { sku, qty: d }] : cs; return cs.map((c, j) => (j === i ? { ...c, qty: c.qty + d } : c)).filter((c) => c.qty > 0); });
  const cust = customers.find((c) => c.id === custId);
  const can = !sample && canDo('sale.create');
  const place = () => {
    if (!cart.length) return;
    const lines: SaleLine[] = cart.map((c) => { const x = all.find((k) => k.sku === c.sku)!; return { id: uid('sl'), kind: 'SKU', ref: x.sku, name: x.name, unit: x.unit, qty: c.qty, price: x.basePrice, discountPct: 0, vat: x.vatPct ?? 8 }; });
    // Đơn tại quầy theo giá niêm yết, không chiết khấu: đi qua luồng duyệt / xuất kho / thu tiền như đơn thường (không tự ghi thu)
    const o = saveSale({ date: todayISO(), source: 'COUNTER', customerId: cust?.id, customer: cust?.name ?? 'Khách lẻ', phone: cust?.contactPhone || undefined, taxCode: cust?.taxCode || undefined, lines, pay: 'CASH', creditDays: 0, payments: [], delivery: 'PICKUP', whId: MAIN_WH, invoice: !!cust?.taxCode, status: 'PENDING', by: me?.id, origin: 'Bán tại quầy',
      approval: { status: 'PENDING', reasons: ['Bán tại quầy, giá niêm yết'], requestedAt: Date.now(), requestedBy: me?.id, self: true } });
    setCart([]); setCustId('');
    notify(`Đã lên đơn ${o.code} tại quầy`, 'teal');
    setOpenSale(o.id);
  };
  const tile = (x: SkuItem): ReactNode => (
    <button key={x.sku} type="button" onClick={() => addOne(x.sku)} disabled={!sample && !can} className="flex min-h-[84px] flex-col items-start justify-between rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-2.5 text-left hover:border-[rgb(var(--ink)/0.3)] disabled:opacity-60" data-pos-tile={x.sku}>
      <span className="line-clamp-2 text-[12.5px] font-medium leading-snug">{x.name}</span>
      <span className="flex w-full items-end justify-between gap-2"><span className="truncate font-mono text-[11px] text-[rgb(var(--muted))]">{x.sku}</span><span className="font-mono text-[12px] tabular-nums">{fmtN(x.basePrice)}</span></span>
    </button>
  );
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_300px]" data-quick-pos>
      <div className="min-w-0">
        <div className="relative mb-2"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><input className={cn(inputCls, 'pl-8')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã hoặc tên hàng" aria-label="Tìm hàng bán nhanh" /></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">{list.map(tile)}</div>
        {!list.length && <p className="py-4 text-center text-[12.5px] text-[rgb(var(--muted))]">Không có mặt hàng</p>}
      </div>
      <aside className="flex min-w-0 flex-col rounded-xl border border-[rgb(var(--line))] p-3" aria-label="Giỏ hàng">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium"><ShoppingCart className="h-4 w-4" aria-hidden />Giỏ hàng<span className="ml-auto font-mono text-[12px] tabular-nums text-[rgb(var(--muted))]">{cart.reduce((s, c) => s + c.qty, 0)}</span></p>
        <select className={cn(inputCls, 'mb-2')} value={custId} onChange={(e) => setCustId(e.target.value)} aria-label="Khách hàng" disabled={sample}><option value="">Khách lẻ</option>{customers.slice(0, 300).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <ul className="min-h-[60px] flex-1 space-y-1.5">{cart.map((c) => { const l = lineOf(c); return (
          <li key={c.sku} className="flex items-center gap-1.5 text-[12.5px]">
            <span className="min-w-0 flex-1 truncate">{l.x.name}</span>
            <button type="button" className="grid h-6 w-6 place-items-center rounded border border-[rgb(var(--line))]" onClick={() => addOne(c.sku, -1)} aria-label={`Bớt ${l.x.name}`}>{c.qty === 1 ? <X className="h-3 w-3" aria-hidden /> : <Minus className="h-3 w-3" aria-hidden />}</button>
            <span className="w-6 text-center font-mono tabular-nums">{c.qty}</span>
            <button type="button" className="grid h-6 w-6 place-items-center rounded border border-[rgb(var(--line))]" onClick={() => addOne(c.sku)} aria-label={`Thêm ${l.x.name}`}><Plus className="h-3 w-3" aria-hidden /></button>
            <span className="w-20 text-right font-mono tabular-nums">{fmtN(l.net + l.vat)}</span>
          </li>
        ); })}{!cart.length && <li className="py-3 text-center text-[12px] text-[rgb(var(--muted))]">Bấm vào mặt hàng để thêm</li>}</ul>
        <div className="mt-2 flex items-baseline justify-between border-t border-[rgb(var(--line))] pt-2"><span className="text-[12.5px] text-[rgb(var(--muted))]">Tổng (gồm VAT)</span><span className="font-mono text-[16px] font-medium tabular-nums" data-pos-total>{fmtN(total)}</span></div>
        <button type="button" className={cn(btnPrimary, 'mt-2 w-full justify-center')} disabled={sample || !can || !cart.length} onClick={place}>Lên đơn tại quầy</button>
        {!sample && !can && <p className="mt-1 text-[11.5px] text-[rgb(var(--muted))]">Cần quyền lên đơn bán</p>}
      </aside>
    </div>
  );
}

/** v57a khối chuyên ngành trên màn hình doanh nghiệp / xem trước (null = không phải khối chuyên ngành) */
export function verticalBody(b: LBlock, order?: SalesOrder, sample?: boolean): ReactNode {
  return b.type === 'K-WorkflowHeader' ? <WorkflowHeader o={order} sample={sample} />
    : b.type === 'K-ChecklistTracker' ? <ChecklistTracker b={b} o={order} sample={sample} />
    : b.type === 'K-StageBoard' ? <StageBoard sample={sample} />
    : b.type === 'K-ResourceCalendar' ? <ResourceCalendar b={b} sample={sample} />
    : b.type === 'K-QuickPOS' ? <QuickPOS b={b} sample={sample} /> : null;
}

export function VerticalBlock({ b, order, sample }: { b: LBlock; order?: SalesOrder; sample?: boolean }) {
  const body = verticalBody(b, order, sample);
  if (!body) return null;
  // Quy trình theo ngành nằm gọn 1 dải (không tiêu đề); khối khác có tiêu đề trong thẻ
  if (b.type === 'K-WorkflowHeader') return <section className="glass-card rounded-xl px-4 py-3" aria-label={b.config.title}>{body}</section>;
  return <section className="glass-card rounded-xl px-4 py-3" aria-label={b.config.title}><h3 className="mb-2 text-[14px] font-medium">{b.config.title}</h3>{body}</section>;
}
