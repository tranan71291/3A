'use client';

// Bộ vẽ trang — khung hiển thị bố cục: trang tổng hợp (LayoutView), trang nghiệp vụ (LBusinessView), nội dung mẫu trang đơn hàng
// (V55.2: chuyển từ modules/messages/messenger.tsx, giữ nguyên logic)
import { Fragment, type CSSProperties, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { ArrowRight, Paperclip } from 'lucide-react';
import { Code } from '../../components/ui';
import { cfSample, cfWithLayout, fmtDate, fmtN, L_DS, L_GAP, L_ROW, L_SO_LINES, lBoxType, lCondOk, lDeviceOf, lFieldOrder, lHasData, lEntityAvail, lEntitySections, lIsCore, LPageC, lTabList, MODULE_LABEL, SO_LINE_F, todayISO } from '../../lib/core';
import type { CfDef, DateRange, LBlock, LDataset, LDevice, LRow, LStage, Module, Role } from '../../lib/types';
import { cn } from '../../lib/utils';
import { lBands, lSettle, lSt } from './engine';
import { LBlockBody, LButtons, LDivider, LFilter, LTabsBar, LTarget, LText, LTextBlock } from './blocks';
import { DynamicFieldRenderer } from './fields';
import { lBuiltinSample, SampleApp } from './sample';
import { TradingCustomersList } from '../customers/customer-360';
import { DataMktPage } from '../leads/data-mkt';
import { SaleList } from '../sales/orders';

/** Bộ hiển thị bố cục (doanh nghiệp xem, 3A xem trước): máy tính theo vị trí 12 cột; máy tính bảng 6 cột; điện thoại theo độ rộng khối 1/1, 1/2, 1/3, 1/4 */
export function LayoutView({ blocks, rowsOf, device, range, onOpen, role }: { blocks: LBlock[]; rowsOf: (ds: LDataset) => LRow[] | null; device?: LDevice; range?: DateRange; onOpen?: (m: Module) => void; role?: Role }) {
  const ctx = useContext(LPageC);
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1200);
  useEffect(() => { const el = ref.current; if (!el || device) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, [device]);
  const dev = device ?? lDeviceOf(w);
  const perm = blocks.filter((b) => b.show[dev] && (!lHasData(b.type) || rowsOf(b.config.ds) !== null) && lCondOk(b.config, null, role ?? null));
  // Tab: chỉ hiện tab có ít nhất một khối người xem thấy; khối không thuộc tab nào hiện ở mọi tab
  const tabIds = lTabList(blocks).map((t) => t.id);
  const tabList = lTabList(blocks).filter((t) => perm.some((b) => b.config.tab === t.id));
  const cur = tabList.find((t) => t.id === ctx?.tab)?.id ?? tabList[0]?.id ?? '';
  const vis = perm.filter((b) => !tabIds.length || !b.config.tab || !tabIds.includes(b.config.tab) || b.config.tab === cur);
  const lg = dev === 'lg' ? lSettle(vis) : vis;
  const ordered = dev === 'sm' ? [...vis].sort((a, b) => (a.pos.sm.order || 99) - (b.pos.sm.order || 99)) : [...lg].sort((a, b) => a.pos.lg.y - b.pos.lg.y || a.pos.lg.x - b.pos.lg.x);
  const style = (b: LBlock): CSSProperties => {
    const p = b.pos.lg;
    if (dev === 'lg') return { gridColumn: `${p.x + 1} / span ${p.w}`, gridRow: `${p.y + 1} / span ${p.h}` };
    if (dev === 'md') return { gridColumn: `span ${Math.min(6, Math.max(2, p.w))}`, gridRow: `span ${p.h}` };
    const one = ['K-Tabs', 'K-Filter', 'K-Button', 'K-Icons', 'K-Divider', 'K-Spacer', 'K-Target'].includes(b.type);
    return { gridColumn: `span ${b.pos.sm.w || 12}`, gridRow: `span ${b.type === 'K-Stat-Simple' ? 2 : one ? Math.min(p.h, 2) : Math.min(p.h, 5)}` };
  };
  return (
    <div ref={ref} className="grid" style={{ gridTemplateColumns: `repeat(${dev === 'md' ? 6 : 12}, minmax(0, 1fr))`, gridAutoRows: `${L_ROW}px`, gap: L_GAP, gridAutoFlow: dev === 'md' ? 'row dense' : 'row' }}>
      {ordered.map((b) => {
        const st = style(b);
        /** khối không có thẻ nền: kiểu đặt cho vùng khối, cỡ chữ cho phần trong */
        const wrap = (inner: ReactNode, cls = '', noBd = false) => { const s = lSt(b.config, true, noBd); return <div key={b.id} style={{ ...st, ...s.css }} className={cn('min-w-0', cls, s.cls)}><div className={cn('h-full min-w-0', cls)} style={s.z ? { zoom: s.z } : undefined}>{inner}</div></div>; };
        if (b.type === 'K-Tabs') return wrap(<LTabsBar tabs={tabList} cur={cur} onChange={(t) => ctx?.setTab(t)} kind={b.config.tabStyle} />);
        if (b.type === 'K-Icons' || b.type === 'K-Button') return wrap(<LButtons c={b.config} />);
        if (b.type === 'K-Filter') return wrap(<LFilter c={b.config} />, 'flex items-center');
        if (b.type === 'K-Target') return wrap(<LTarget />, 'flex items-center');
        if (b.type === 'K-Divider') return wrap(<LDivider c={b.config} />, '', true);
        if (b.type === 'K-Spacer') return wrap(null);
        if (b.type === 'K-Text') return <LTextBlock key={b.id} c={b.config} style={st} cls="overflow-y-auto" />;
        const rows = rowsOf(b.config.ds) ?? [];
        const ds = L_DS[b.config.ds];
        const s = lSt(b.config);
        const zs: CSSProperties | undefined = s.z ? { zoom: s.z } : undefined;
        return (
          <section key={b.id} style={{ ...st, ...s.css }} className={cn('glass-card flex min-w-0 flex-col overflow-hidden rounded-xl', s.cls)}>
            <div className="flex items-center gap-2 px-4 pt-3" style={zs}><h3 className="min-w-0 truncate text-[13px] font-medium">{b.config.title}</h3>
              {b.config.open !== false && onOpen && <button className="ml-auto shrink-0 text-[12px] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => onOpen(ds.module)} aria-label={`Mở ${MODULE_LABEL[ds.module]}`}><ArrowRight className="h-3.5 w-3.5" aria-hidden /></button>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-1" style={zs}><LBlockBody b={b} rows={rows} range={range} narrow={dev === 'sm'} /></div>
          </section>
        );
      })}
    </div>
  );
}

/** Hiển thị trang nghiệp vụ theo bố cục: máy tính theo dải / cột 12; màn hẹp xếp một cột theo thứ tự điện thoại */
export function LBusinessView({ blocks, node, narrow, dev }: { blocks: LBlock[]; node: (b: LBlock) => ReactNode; narrow: boolean; dev: LDevice }) {
  const styled = (b: LBlock, n: ReactNode): ReactNode => { if (!b.config.st) return n; const s = lSt(b.config, lBoxType(b), b.type === 'K-Divider'); return <div className={s.cls} style={{ ...s.css, ...(s.z ? { zoom: s.z } : {}) }}>{n}</div>; };
  const vis = blocks.filter((b) => lIsCore(b.type) || b.show[dev]).map((b) => ({ b, n: node(b) })).filter((x) => x.n !== null && x.n !== undefined && x.n !== false).map((x) => ({ b: x.b, n: styled(x.b, x.n) }));
  if (narrow) return <div className="space-y-4">{[...vis].sort((a, b) => (a.b.pos.sm.order || 99) - (b.b.pos.sm.order || 99)).map((x) => <Fragment key={x.b.id}>{x.n}</Fragment>)}</div>;
  const nodes = new Map(vis.map((x) => [x.b.id, x.n]));
  return (
    <div className="space-y-4">{lBands(vis.map((x) => x.b)).map((band, i) => (
      <div key={i} className="grid grid-cols-12 gap-4">{band.map((c, j) => <div key={j} className="min-w-0 space-y-4" style={{ gridColumn: `${c.x + 1} / span ${c.w}` }}>{c.items.map((b) => <Fragment key={b.id}>{nodes.get(b.id)}</Fragment>)}</div>)}</div>
    ))}</div>
  );
}

/** Nội dung mẫu của khối trang đơn hàng (đơn DH201126-02, theo trạng thái đơn và vai trò xem trước) */
export function lSaleSample({ b, stage, cf, narrow }: { b: LBlock; stage: LStage; cf: CfDef[]; narrow?: boolean }): ReactNode {
  const c = b.config;
  const kv = (k: string, v: ReactNode, big?: boolean) => <div key={k} className={cn('flex justify-between gap-3 py-0.5', big ? 'text-[14px] font-medium' : 'text-[12.5px]')}><span className="text-[rgb(var(--muted))]">{k}</span><span className="tabular-nums">{v}</span></div>;
  const net = L_SO_LINES.reduce((s, l) => s + Math.round(l.qty * l.price * (1 - l.ck / 100)), 0), vat = Math.round(net * 0.08), paid = stage === 'DONE' ? net + vat : stage === 'CANCEL' ? 2000000 : 0;
  // v55.2 khối Chi tiết / Form bản ghi: cùng bộ vẽ trường với màn hình doanh nghiệp, giá trị mẫu
  if (b.type === 'K-RecordDetail' || b.type === 'K-Order-Info') {
    const ent = c.entity ?? 'sale';
    if (stage === 'CANCEL' && ent === 'sale') return <div className="space-y-1 text-[12.5px]"><p className="text-[rgb(var(--muted))]">Lý do: khách đổi sang mã hàng khác. Cần nhập trả hàng đã xuất và hoàn tiền trước khi hủy</p></div>;
    const heads = cf.filter((d) => d.entity === ent && d.scope === 'HEAD' && d.status === 'ACTIVE');
    return <DynamicFieldRenderer sample mode="view" narrow={narrow} sections={lEntitySections(ent, 'detail', c, heads)} avail={lEntityAvail(ent, 'detail', heads)} builtin={(k) => (ent === 'sale' && k === 'code' ? <Code>DH201126-02</Code> : lBuiltinSample(ent, k))} />;
  }
  if (b.type === 'K-RecordForm') {
    const ent = c.entity ?? 'sale';
    const heads = cf.filter((d) => d.entity === ent && d.scope === 'HEAD');
    return <DynamicFieldRenderer sample mode="edit" narrow={narrow} sections={lEntitySections(ent, 'form', c, heads)} avail={lEntityAvail(ent, 'form', heads)} required={cfWithLayout(heads, c.sections)} builtin={(k) => lBuiltinSample(ent, k)} />;
  }
  // v55.3 khối Danh sách bản ghi: bảng thật của phân hệ (khách hàng / Data MKT) với dữ liệu mẫu
  if (b.type === 'K-RecordList') return <SampleApp>{(c.entity ?? 'customer') === 'lead' ? <DataMktPage cfg={c} /> : <TradingCustomersList cfg={c} />}</SampleApp>;
  if (b.type === 'K-Order-Lines') {
    const lc = cf.filter((d) => d.scope === 'LINE' && d.status === 'ACTIVE' && d.where.info);
    const all = [...SO_LINE_F, ...lc.map((d) => ({ id: `cf:${d.key}`, label: d.label }))];
    const ids = lFieldOrder(all, c);
    if (narrow && c.smView !== 'table') return <div className="text-[12.5px]"><p className="mb-1 text-[12px]"><span className="font-medium">Hàng hóa 2</span> <span className="text-[rgb(var(--muted))]">· Chứng từ 3</span></p>{L_SO_LINES.map((l, i) => <div key={l.ref} className="flex gap-2 border-t border-[rgb(var(--line)/0.6)] py-1.5">{ids.includes('stt') && <span className="w-4 text-[rgb(var(--muted))]">{i + 1}</span>}<div className="min-w-0 flex-1"><p className="truncate font-medium">{l.name}</p><p className="truncate text-[11.5px] text-[rgb(var(--muted))]"><Code>{l.ref}</Code> {fmtN(l.qty)} {l.unit} × {fmtN(l.price)}{l.ck ? ` · CK ${l.ck}%` : ''}{lc.map((d) => ` · ${d.label} ${cfSample(d)}`).join('')}</p></div><span className="tabular-nums">{fmtN(Math.round(l.qty * l.price * (1 - l.ck / 100)))}</span></div>)}</div>;
    const cell = (id: string, l: (typeof L_SO_LINES)[number], i: number): ReactNode => { const d = lc.find((x) => `cf:${x.key}` === id); if (d) return cfSample(d); return ({ stt: i + 1, ref: <Code>{l.ref}</Code>, name: l.name, unit: l.unit, qty: fmtN(l.qty), price: fmtN(l.price), ckPct: l.ck, ckAmt: fmtN(Math.round(l.qty * l.price * l.ck / 100)), vat: l.vat, net: fmtN(Math.round(l.qty * l.price * (1 - l.ck / 100))), iss: stage === 'APPROVAL' || stage === 'ISSUE' ? 0 : fmtN(l.qty), ret: '—', rest: stage === 'APPROVAL' || stage === 'ISSUE' ? fmtN(l.qty) : '—' } as Record<string, ReactNode>)[id]; };
    const right = (id: string) => !['ref', 'name', 'unit', 'stt'].includes(id) && !id.startsWith('cf:');
    return <div className="overflow-hidden"><p className="mb-1 text-[12px]"><span className="border-b-2 border-[rgb(var(--accent))] pb-0.5 font-medium">Hàng hóa 2</span> <span className="ml-3 text-[rgb(var(--muted))]">Chứng từ 3</span></p><table className="w-full text-[12px]"><thead><tr className="text-[rgb(var(--muted))]">{ids.map((id) => <th key={id} className={cn('whitespace-nowrap px-1.5 py-1 font-normal', right(id) ? 'text-right' : 'text-left')}>{id === 'stt' ? '#' : all.find((x) => x.id === id)?.label}</th>)}</tr></thead><tbody>{L_SO_LINES.map((l, i) => <tr key={l.ref} className="border-t border-[rgb(var(--line)/0.6)]">{ids.map((id) => <td key={id} className={cn('max-w-[220px] truncate whitespace-nowrap px-1.5 py-1.5', right(id) && 'text-right tabular-nums')}>{cell(id, l, i)}</td>)}</tr>)}</tbody></table></div>;
  }
  if (b.type === 'K-Order-Flow') {
    const st = stage === 'CANCEL' ? [['Nhập trả đủ hàng', 'ok'], ['Hoàn tiền cho khách', 'cur'], ['Hủy đơn, giữ chứng từ', '']] : [['Duyệt đơn', stage === 'APPROVAL' ? 'cur' : 'ok'], ['Xuất kho', stage === 'APPROVAL' ? '' : stage === 'ISSUE' ? 'cur' : 'ok'], ['Thu tiền', stage === 'PAY' ? 'cur' : stage === 'DONE' ? 'ok' : ''], ['Hoàn thành', stage === 'DONE' ? 'ok' : '']];
    return <div>{stage === 'CANCEL' && <p className="mb-1 text-[12px] text-[rgb(var(--muted))]">Quy trình hủy (theo luồng nghiệp vụ)</p>}{narrow && stage !== 'CANCEL' ? <p className="flex flex-wrap items-center gap-1.5 text-[12.5px]">{st.map(([t, s], i) => <Fragment key={t}>{i > 0 && <span className="text-[rgb(var(--muted))]">—</span>}<i className={cn('inline-block h-2.5 w-2.5 rounded-full border-2', s === 'ok' ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))]' : s === 'cur' ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]' : 'border-[rgb(var(--line))]')} /><span className={s === 'cur' ? 'font-medium' : s ? '' : 'text-[rgb(var(--muted))]'}>{t}</span></Fragment>)}</p>
      : st.map(([t, s]) => <p key={t} className="flex items-center gap-2 py-1 text-[12.5px]"><i className={cn('inline-block h-3 w-3 rounded-full border-2', s === 'ok' ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))]' : s === 'cur' ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] ring-2 ring-[rgb(var(--accent)/0.2)]' : 'border-[rgb(var(--line))]')} /><span className={s ? '' : 'text-[rgb(var(--muted))]'}>{t}</span></p>)}</div>;
  }
  if (b.type === 'K-Order-Pay') return <div>{kv('Tiền hàng', fmtN(net))}{kv('Thuế GTGT 8%', fmtN(vat))}{kv('Thực tế phải thu', fmtN(net + vat), true)}{kv('Doanh thu (kế toán đã thu)', fmtN(paid))}{kv(stage === 'CANCEL' ? 'Khách trả thừa' : 'Còn lại', fmtN(stage === 'CANCEL' ? paid : net + vat - paid))}</div>;
  if (b.type === 'K-Order-Profit') { const cogs = Math.round(net * 0.78); return <div>{kv('Doanh thu thuần', fmtN(net))}{kv('Giá vốn tạm tính', `−${fmtN(cogs)}`)}{kv('Lãi gộp chuẩn', fmtN(net - cogs), true)}{kv('Chi phí gắn vào đơn', '−250.000')}{kv('Lãi ước tính', fmtN(net - cogs - 250000), true)}</div>; }
  if (b.type === 'K-Order-Debt') return <div>{kv('Đang nợ / hạn mức', '124 tr / 500 tr')}<div className="my-1.5 h-1.5 rounded bg-[rgb(var(--ink)/0.06)]"><div className="h-full w-1/4 rounded bg-[rgb(var(--fg))]" /></div>{kv('Quá hạn', '0')}</div>;
  if (b.type === 'K-Order-Log') return <div className="space-y-2 text-[12.5px]"><p><span className="font-medium">Trần Quốc Bảo</span> <span className="text-[rgb(var(--muted))]">· 21:12</span><br />Khách cần giao trước 9h sáng thứ Hai</p><p className="text-[rgb(var(--fg2))]">Lê Thu Hà duyệt đơn <span className="text-[rgb(var(--muted))]">· 21:30</span></p></div>;
  if (b.type === 'K-Order-Ship') return <div>{kv('Giao nhận', 'Gửi xe / chành')}{kv('Người nhận', 'Anh Phát · 0903 112 245')}{kv('Ngày giao', fmtDate(todayISO()))}{kv('Địa chỉ', 'Lô C5, KCN Tân Bình')}</div>;
  if (b.type === 'K-Order-Files') return <div className="space-y-1 text-[12.5px]"><p className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden />PO-HP-1125.pdf <span className="text-[rgb(var(--muted))]">180 KB</span></p><p className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden />anh-giao-hang.jpg <span className="text-[rgb(var(--muted))]">240 KB</span></p></div>;
  if (b.type === 'K-Text') return <LText c={c} />;
  if (b.type === 'K-Icons' || b.type === 'K-Button') return <LButtons c={c} />;
  if (b.type === 'K-Divider') return <LDivider c={c} />;
  if (b.type === 'K-Spacer') return <div className="h-5" aria-hidden />;
  // v55.2.1: bảng Quản lý đơn hàng thật (SaleList) với đơn mẫu, không còn HTML mẫu vẽ tay
  if (b.type === 'K-SaleList') return <SampleApp><SaleList cfg={c} onNew={() => undefined} onEdit={() => undefined} onCancel={() => undefined} /></SampleApp>;
  return null;
}
