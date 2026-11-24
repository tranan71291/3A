'use client';

// Bộ vẽ trang — các khối hiển thị dùng chung (chỉ số, biểu đồ, text, nút, bộ lọc, tab, mục tiêu, đường kẻ, bảng)
// (V55.2: chuyển từ modules/messages/messenger.tsx, giữ nguyên logic)
import { Fragment, type CSSProperties, type ReactNode, useContext, useState } from 'react';
import { AlertTriangle, Info, StickyNote, Target } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Code } from '../../components/ui';
import { btnGhost, btnPrimary, C, compact, inputCls, iso, L_ACT, L_DS, L_ICONSET, L_PER, L_PER_LOW, L_PERIOD, L_TS, L_TW, lAgg, lField, lFill, lFilter, lFmt, lFramed, lKind, LPageC, lPeriodLabel, lToneCls, tipStyle, useApp } from '../../lib/core';
import type { DashPeriod, DashScope, DateRange, DeptCode, LAgg, LBlock, LBlockCfg, LPageCtx, LRow } from '../../lib/types';
import { cn } from '../../lib/utils';
import { dashRange, useDashData } from '../dashboard/exec-dashboard';
import { useOutside } from '../sales/orders';
import { lBounds, lCol, lOnColor, lSt } from './engine';

export function LStat({ c, rows, range }: { c: LBlockCfg; rows: LRow[]; range?: DateRange }) {
  const ctxPer = useContext(LPageC)?.period;
  const fl = lField(c.ds, c.field);
  const agg: LAgg = fl.id === 'count' ? 'count' : c.agg ?? 'sum';
  const unit = agg === 'count' ? 'count' : fl.unit;
  const base = lFilter(rows, c.filter);
  const b = lBounds(c.period ?? 'month', range);
  const cur = lAgg(b ? base.filter((r) => r.date >= b.from && r.date <= b.to) : base, fl.id, agg);
  const prev = b ? lAgg(base.filter((r) => r.date >= b.pf && r.date <= b.pt), fl.id, agg) : 0;
  const pct = b && c.compare && prev ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null;
  const cmp = c.period === 'quarter' ? 'quý trước' : c.period === 'year' ? 'năm trước' : c.period === 'last30' ? '30 ngày trước đó' : c.period === 'inherit' ? 'kỳ trước' : 'tháng trước';
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-[24px] font-medium leading-tight tabular-nums">{lFmt(unit, cur)}</p>
      {pct !== null ? <p className="text-[12px]"><span className={pct >= 0 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]'}>{pct >= 0 ? '+' : '−'}{Math.abs(pct)}%</span> <span className="text-[rgb(var(--muted))]">so với {cmp}</span></p>
        : <p className="text-[12px] text-[rgb(var(--muted))]">{b ? (c.period === 'inherit' ? lPeriodLabel(ctxPer ?? 'MONTH') : L_PERIOD[c.period ?? 'month']) : 'Toàn bộ'}</p>}
    </div>
  );
}

export function LLine({ c, rows }: { c: LBlockCfg; rows: LRow[] }) {
  const n = c.months ?? 12;
  const t = new Date();
  const base = lFilter(rows, c.filter);
  const ser = (c.series ?? ['revenue']).filter(Boolean).slice(0, 2);
  const data = Array.from({ length: n }, (_, i) => { const d = new Date(t.getFullYear(), t.getMonth() - (n - 1 - i), 1); const k = iso(d).slice(0, 7); const rs = base.filter((r) => r.date.slice(0, 7) === k);
    return { name: `T${d.getMonth() + 1}`, ...Object.fromEntries(ser.map((f) => [lField(c.ds, f).label, lAgg(rs, f, f === 'count' ? 'count' : 'sum')])) }; });
  const colors = [lCol(c.colors?.[0], 'solid') ?? C.orange, lCol(c.colors?.[1], 'solid') ?? C.muted];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-3 text-[12px] text-[rgb(var(--muted))]">{ser.map((f, i) => <span key={f} className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-3" style={{ background: colors[i] }} />{lField(c.ds, f).label}</span>)}</div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke={C.line} vertical={false} />
            <XAxis dataKey="name" stroke={C.muted} fontSize={11} />
            <YAxis stroke={C.muted} fontSize={11} width={56} tickFormatter={(v) => compact(Number(v))} />
            <Tooltip {...tipStyle} formatter={(v) => compact(Number(v))} />
            {ser.map((f, i) => <Line key={f} type="monotone" dataKey={lField(c.ds, f).label} stroke={colors[i]} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Định dạng gọn của khối text (không dùng HTML): **đậm**, *nghiêng*, [chữ](https://…) */
export function lInline(s: string, k: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0; let i = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={`${k}b${i++}`} className="font-semibold">{t.slice(2, -2)}</strong>);
    else if (t.startsWith('[')) out.push(<a key={`${k}a${i++}`} href={m[2]} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[rgb(var(--accent))]">{t.slice(1, t.indexOf(']('))}</a>);
    else out.push(<em key={`${k}i${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function LText({ c }: { c: LBlockCfg }) {
  const ctx = useContext(LPageC);
  const v = ctx?.vars;
  const k = lKind(c);
  const sz = c.size ?? 'md';
  const main = k === 'title' ? cn('font-medium', sz === 'xl' ? 'text-[32px] leading-10' : sz === 'lg' ? 'text-[26px] leading-8' : sz === 'sm' ? 'text-[18px] leading-6' : 'text-[22px] leading-7')
    : k === 'heading' ? cn('font-medium', sz === 'xl' ? 'text-[20px]' : sz === 'lg' ? 'text-[17px]' : sz === 'sm' ? 'text-[13.5px]' : 'text-[15px]')
    : k === 'label' ? 'text-[12px] font-medium text-[rgb(var(--muted))]'
    : k === 'quote' ? 'border-l-2 border-[rgb(var(--line))] pl-3 text-[13px] leading-relaxed text-[rgb(var(--fg2))]'
    : cn('leading-relaxed', sz === 'xl' ? 'text-[16.5px]' : sz === 'lg' ? 'text-[14.5px]' : sz === 'sm' ? 'text-[12.5px]' : 'text-[13px]', k === 'info' && 'text-[rgb(var(--fg2))]');
  const out: ReactNode[] = [];
  let ul: string[] = [];
  const flush = () => { if (ul.length) { const n = out.length; out.push(<ul key={`u${n}`} className="list-disc space-y-0.5 pl-5 text-left">{ul.map((x, i) => <li key={i}>{lInline(x, `l${n}-${i}`)}</li>)}</ul>); ul = []; } };
  lFill(c.text ?? '', v).split('\n').forEach((ln, i) => {
    const t = ln.trimEnd();
    if (/^\s*[-•]\s+/.test(t)) { ul.push(t.replace(/^\s*[-•]\s+/, '')); return; }
    flush();
    if (!t.trim()) return;
    out.push(t.startsWith('## ') ? <p key={i} className="text-[14px] font-medium">{lInline(t.slice(3), `h${i}`)}</p> : <p key={i}>{lInline(t, `p${i}`)}</p>);
  });
  flush();
  const I = k === 'info' ? Info : k === 'note' ? StickyNote : k === 'warn' ? AlertTriangle : null;
  return (
    <div className={cn('min-w-0', c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : '')}>
      <div className={cn(I && 'flex gap-2')}>
        {I && <I className={cn('mt-0.5 h-4 w-4 shrink-0', k === 'note' ? 'text-[rgb(var(--accent))]' : k === 'warn' ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')} aria-hidden />}
        <div className={cn('min-w-0 flex-1 space-y-1.5', main)}>{out.length ? out : <p className="text-[13px] text-[rgb(var(--muted))]">Chưa có nội dung</p>}</div>
      </div>
      {c.sub && <p className="mt-0.5 text-[12.5px] text-[rgb(var(--muted))]">{lInline(lFill(c.sub, v), 'sub')}</p>}
    </div>
  );
}

/** Khối text đặt trên trang: có khung thì thành thẻ (tiêu đề khối nếu không ẩn), không khung thì chữ nằm thẳng trên nền trang */
export function LTextBlock({ c, style, cls, st = true }: { c: LBlockCfg; style?: CSSProperties; cls?: string; st?: boolean }) {
  const f = lFramed(c);
  const s = st ? lSt(c, !f) : { cls: '', css: {} };
  return (
    <section style={{ ...style, ...s.css }} className={cn('min-w-0', f ? cn('glass-card rounded-xl px-4 py-3', lToneCls(c)) : 'flex flex-col justify-center', cls, s.cls)}>
      {f && !c.hideTitle && <h3 className="mb-1.5 text-[14px] font-medium">{c.title}</h3>}
      <LText c={c} />
    </section>
  );
}

/** Khối Nút / Icon */
export function LButtons({ c }: { c: LBlockCfg }) {
  const ctx = useContext(LPageC);
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const ico = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)] disabled:opacity-40';
  const list = (c.buttons ?? []).filter((b) => L_ACT[b.act] && (!ctx || ctx.can(b)));
  return (
    <div className={cn('flex h-full flex-wrap items-center gap-1.5', c.align === 'left' ? 'justify-start' : c.align === 'center' ? 'justify-center' : 'justify-end')}>
      {list.map((b) => {
        const I = L_ICONSET[b.icon] ?? L_ICONSET[L_ACT[b.act].icon] ?? Info;
        const name = b.label || L_ACT[b.act].label;
        const cls = b.style === 'primary' ? cn(btnPrimary, 'h-9') : b.style === 'ghost' ? cn(btnGhost, 'h-9') : b.style === 'text' ? 'inline-flex h-9 items-center rounded-lg px-2.5 text-[13.5px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)] hover:text-[rgb(var(--fg))] disabled:opacity-40' : ico;
        const inner = b.style === 'text' ? <>{b.label || L_ACT[b.act].label}</> : <><I className="h-4 w-4" aria-hidden />{b.style !== 'icon' && b.label}</>;
        const tone: CSSProperties | undefined = !b.tone ? undefined : b.style === 'primary' ? { background: lCol(b.tone, 'solid'), borderColor: lCol(b.tone, 'solid'), color: lOnColor(b.tone) } : b.style === 'text' ? { color: lCol(b.tone, 'text') } : { color: lCol(b.tone, 'text'), borderColor: lCol(b.tone, 'solid') };
        return b.act === 'menu' ? (
          <div key={b.id} className="relative" ref={ref}>
            <button className={cls} style={tone} disabled={!ctx?.menu} onClick={() => setOpen(!open)} aria-label={name} title={name} aria-expanded={open}>{inner}</button>
            {open && ctx?.menu && <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 text-left text-[13.5px] shadow-xl" onClick={() => setOpen(false)}>{ctx.menu}</div>}
          </div>
        ) : <button key={b.id} className={cls} style={tone} disabled={!!ctx?.off?.(b)} onClick={() => ctx?.act(b)} aria-label={name} title={name}>{inner}</button>;
      })}
    </div>
  );
}

/** Khối Bộ lọc chung: kỳ, so với kỳ trước, phòng ban (quyền xem phòng như trang Tổng quan gốc) */
export function LFilter({ c }: { c: LBlockCfg }) {
  const ctx = useContext(LPageC);
  const { departments, role, me } = useApp();
  const per = ctx?.period ?? 'MONTH';
  const r = dashRange(per, Date.now());
  const opts = c.periods?.length ? c.periods : (['WEEK', 'MONTH', 'QUARTER', 'YEAR'] as DashPeriod[]);
  const live = !!ctx?.live;
  const lockDept = live && role !== 'BOD' && role !== 'ACCOUNTANT' && role !== 'MKT_LEAD';
  return (
    <div className={cn('flex w-full flex-wrap items-center gap-2', c.align === 'left' ? 'justify-start' : c.align === 'center' ? 'justify-center' : 'justify-end')}>
      <div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label="Kỳ báo cáo">
        {opts.map((o) => <button key={o} role="radio" aria-checked={per === o} onClick={() => ctx?.setPeriod(o)} className={cn('rounded-md px-2.5 py-1 text-[13px]', per === o ? 'bg-[rgb(var(--raised))] font-medium text-[rgb(var(--fg))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>{L_PER[o]}</button>)}
      </div>
      {c.showCompare !== false && <span className="rounded-lg border border-[rgb(var(--line))] px-2.5 py-1 text-[13px] text-[rgb(var(--fg2))]">So với {r.prevTag}</span>}
      {c.showDept !== false && (live && role === 'SALES_REP' ? <span className="rounded-md border border-[rgb(var(--line))] px-2.5 py-1.5 text-sm">Của tôi</span> : (
        <select aria-label="Phòng ban" disabled={lockDept} className={cn(inputCls, 'h-8 w-auto py-0 text-[13px]')} value={ctx?.dept ?? 'ALL'} onChange={(e) => ctx?.setDept(e.target.value as DeptCode | 'ALL')}>
          {!lockDept && <option value="ALL">Mọi phòng</option>}
          {departments.filter((d) => d.active && (!lockDept || d.code === me?.dept)).map((d) => <option key={d.code} value={d.code}>{d.short || d.name}</option>)}
        </select>
      ))}
    </div>
  );
}

/** Khối Tab: thanh tab, chỉ hiện tab có khối người xem thấy */
export function LTabsBar({ tabs, cur, onChange, kind = 'line' }: { tabs: { id: string; label: string }[]; cur: string; onChange: (t: string) => void; kind?: LBlockCfg['tabStyle'] }) {
  if (kind === 'pill' || kind === 'chip') return (
    <div className="flex h-full items-center overflow-x-auto" role="tablist">
      <div className={cn('flex gap-1', kind === 'pill' && 'rounded-lg bg-[rgb(var(--ink)/0.05)] p-1')}>
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={cur === t.id} onClick={() => onChange(t.id)} className={cn('whitespace-nowrap px-3 py-1.5 text-[13.5px]', kind === 'pill' ? cn('rounded-md', cur === t.id ? 'bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]') : cn('rounded-full border', cur === t.id ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] font-medium text-[rgb(var(--bg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--fg2))] hover:border-[rgb(var(--ink)/0.3)]'))}>{t.label}</button>)}
      </div>
    </div>
  );
  return (
    <div className="flex h-full items-end gap-6 overflow-x-auto border-b border-[rgb(var(--line))]" role="tablist">
      {tabs.map((t) => <button key={t.id} role="tab" aria-selected={cur === t.id} onClick={() => onChange(t.id)} className={cn('-mb-px whitespace-nowrap border-b-2 pb-2 text-[14px]', cur === t.id ? 'border-[rgb(var(--fg))] font-medium text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>{t.label}</button>)}
    </div>
  );
}

export function LTargetView({ revenue, target, elapsed, canEdit, onOpen, per }: { revenue: number; target: number; elapsed: number; canEdit: boolean; onOpen: () => void; per: DashPeriod }) {
  if (!target) return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--fg2))]"><Target className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Chưa có chỉ tiêu {L_PER_LOW[per]}, các số đang so với kỳ trước
      <button className="font-medium text-[rgb(var(--accent-fg))] hover:underline" onClick={onOpen}>{canEdit ? 'Nhập chỉ tiêu' : 'Xem chỉ tiêu'}</button></p>
  );
  const pct = (revenue / target) * 100;
  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
      <span className="flex items-center gap-2"><Target className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Doanh thu <b className="font-medium tabular-nums">{compact(revenue)}</b> / chỉ tiêu <span className="tabular-nums">{compact(target)}</span></span>
      <div className="relative h-1.5 min-w-[160px] flex-1 rounded-full bg-[rgb(var(--ink)/0.08)]" role="img" aria-label={`Đạt ${Math.round(pct)}%, kỳ vọng ${Math.round(elapsed * 100)}%`}><div className="h-full rounded-full bg-[rgb(var(--fg))]" style={{ width: `${Math.min(100, pct)}%` }} /><i className="absolute -top-1 h-3.5 w-px bg-[rgb(var(--accent))]" style={{ left: `${Math.min(100, elapsed * 100)}%` }} /></div>
      <span className="tabular-nums text-[rgb(var(--fg2))]">đạt {Math.round(pct)}% · kỳ vọng {Math.round(elapsed * 100)}%</span>
      <button className="text-[rgb(var(--accent-fg))] hover:underline" onClick={onOpen}>Chỉ tiêu</button>
    </div>
  );
}

export function LTargetLive({ ctx }: { ctx: LPageCtx }) {
  const { role, me } = useApp();
  const lock = role !== 'BOD' && role !== 'ACCOUNTANT' && role !== 'MKT_LEAD';
  const scope: DashScope = role === 'SALES_REP' ? { dept: 'ALL', userId: me.id } : { dept: lock ? me.dept ?? 'ALL' : ctx.dept };
  const d = useDashData(ctx.period, scope);
  return <LTargetView revenue={d.revenue} target={d.target} elapsed={d.r.elapsed} canEdit={role === 'BOD' || role === 'DEPT_HEAD'} onOpen={ctx.openTargets} per={ctx.period} />;
}

/** Khối Tiến độ mục tiêu: dùng chỉ tiêu tháng sẵn có (Nhập chỉ tiêu), cùng cách tính với Tổng quan gốc */
export function LTarget() {
  const ctx = useContext(LPageC);
  if (ctx?.live) return <LTargetLive ctx={ctx} />;
  const per = ctx?.period ?? 'MONTH';
  return <LTargetView revenue={0} target={0} elapsed={dashRange(per, Date.now()).elapsed} canEdit onOpen={() => {}} per={per} />;
}

export function LDivider({ c }: { c: LBlockCfg }) {
  const s = c.st;
  const line: CSSProperties = { borderTopWidth: s?.bdW ?? 1, borderTopStyle: s?.bdS ?? 'solid', borderTopColor: s?.bd === 'strong' ? 'rgb(var(--ink) / 0.3)' : lCol(s?.bd, 'solid') ?? 'rgb(var(--line))' };
  return <div className="flex h-full items-center gap-3">{!c.hideTitle && c.title && <span className="whitespace-nowrap text-[12.5px] font-medium text-[rgb(var(--muted))]" style={{ fontSize: s?.tSize ? L_TS[s.tSize] : undefined, color: lCol(s?.tColor, 'text'), fontWeight: s?.tW ? Number(L_TW[s.tW]) : undefined }}>{c.title}</span>}<hr className="flex-1 border-0" style={line} /></div>;
}

/** Khối hiển thị dùng chung trên trang nghiệp vụ */
export function lCommonNode(b: LBlock): ReactNode {
  if (b.type === 'K-Text') return <LTextBlock c={b.config} st={false} />;
  if (b.type === 'K-Button' || b.type === 'K-Icons') return <LButtons c={b.config} />;
  if (b.type === 'K-Divider') return <LDivider c={b.config} />;
  if (b.type === 'K-Spacer') return <div style={{ height: Math.max(1, b.pos.lg.h) * 20 }} aria-hidden />;
  return null;
}

export function LTable({ c, rows, narrow }: { c: LBlockCfg; rows: LRow[]; narrow?: boolean }) {
  const ds = L_DS[c.ds];
  const pyc = c.dense === 'sm' ? 'l-dn-sm' : c.dense === 'lg' ? 'l-dn-lg' : '';
  const trc = (i: number) => cn('border-t border-[rgb(var(--line)/0.6)]', pyc, c.zebra && i % 2 === 1 && 'bg-[rgb(var(--ink)/0.03)]');
  const thc = cn('text-[rgb(var(--muted))]', c.thBg && 'l-th-bg');
  const base = lFilter(rows, c.filter);
  const lim = c.limit ?? 5;
  if ((c.mode ?? 'rows') === 'group') {
    const g = c.group ?? ds.dims[0].id;
    const fl = lField(c.ds, c.field);
    const m = new Map<string, LRow[]>();
    base.forEach((r) => { const k = r.d[g] || '—'; m.set(k, [...(m.get(k) ?? []), r]); });
    if (!base.length) return <p className="py-6 text-center text-[12.5px] text-[rgb(var(--muted))]">Chưa có dữ liệu</p>;
    const list = Array.from(m.entries()).map(([k, rs]) => ({ k, v: lAgg(rs, fl.id, fl.id === 'count' ? 'count' : 'sum') })).sort((a, b) => b.v - a.v).slice(0, lim);
    return (
      <table className="w-full text-[12.5px]"><thead><tr className={thc}>{c.stt && <th className="w-7 py-1 text-left font-normal">#</th>}<th className="py-1 text-left font-normal">{ds.dims.find((x) => x.id === g)?.label}</th><th className="py-1 text-right font-normal">{fl.label}</th></tr></thead>
        <tbody>{list.map((r, i) => <tr key={r.k} className={trc(i)}>{c.stt && <td className="py-1.5 tabular-nums text-[rgb(var(--muted))]">{i + 1}</td>}<td className="max-w-0 truncate py-1.5 pr-2">{r.k}</td><td className="py-1.5 text-right tabular-nums">{lFmt(fl.unit, r.v)}</td></tr>)}</tbody></table>
    );
  }
  if (!base.length) return <p className="py-6 text-center text-[12.5px] text-[rgb(var(--muted))]">Chưa có dữ liệu</p>;
  const cols = (c.cols?.length ? c.cols : [ds.dims[0].id, ds.fields[1]?.id ?? 'count']).slice(0, 5);
  const isNum = (id: string) => ds.fields.some((f) => f.id === id);
  const sorted = [...base].sort((a, b) => (c.sort ? (b.v[c.sort] ?? 0) - (a.v[c.sort] ?? 0) : b.date.localeCompare(a.date))).slice(0, lim);
  const lab = (id: string) => ds.dims.find((x) => x.id === id)?.label ?? ds.fields.find((x) => x.id === id)?.label ?? id;
  if (narrow && c.smView !== 'table') {
    const dims = cols.filter((x) => !isNum(x)), nums = cols.filter(isNum);
    const big = nums[nums.length - 1];
    const sub = [...dims.slice(2), ...nums.slice(0, -1)];
    return (
      <ul className="text-[12.5px]">{sorted.map((r, i) => (
        <li key={i} className="flex gap-3 border-t border-[rgb(var(--line)/0.6)] py-2 first:border-t-0">
          {c.stt && <span className="w-5 shrink-0 tabular-nums text-[rgb(var(--muted))]">{i + 1}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate">{dims.slice(0, 2).map((x, j) => (x === 'code' ? <Fragment key={x}><Code>{r.d[x]}</Code> </Fragment> : <span key={x} className={j ? '' : 'font-medium'}>{r.d[x]}</span>))}</p>
            {sub.length > 0 && <p className="truncate text-[11.5px] text-[rgb(var(--muted))]">{sub.map((x) => (isNum(x) ? `${lab(x)} ${lFmt(lField(c.ds, x).unit, r.v[x] ?? 0)}` : r.d[x])).join(' · ')}</p>}
          </div>
          {big && <div className="shrink-0 text-right"><p className="tabular-nums">{lFmt(lField(c.ds, big).unit, r.v[big] ?? 0)}</p><p className="text-[11px] text-[rgb(var(--muted))]">{lab(big)}</p></div>}
        </li>
      ))}</ul>
    );
  }
  return (
    <table className="w-full text-[12.5px]"><thead><tr className={thc}>{c.stt && <th className="w-7 py-1 text-left font-normal">#</th>}{cols.map((x) => <th key={x} className={cn('py-1 font-normal', isNum(x) ? 'text-right' : 'text-left')}>{lab(x)}</th>)}</tr></thead>
      <tbody>{sorted.map((r, i) => <tr key={i} className={trc(i)}>{c.stt && <td className="py-1.5 tabular-nums text-[rgb(var(--muted))]">{i + 1}</td>}{cols.map((x) => <td key={x} className={cn('max-w-0 truncate py-1.5 pr-2', isNum(x) && 'text-right tabular-nums')}>{isNum(x) ? lFmt(lField(c.ds, x).unit, r.v[x] ?? 0) : x === 'code' ? <Code>{r.d[x]}</Code> : r.d[x]}</td>)}</tr>)}</tbody></table>
  );
}

export function LBlockBody({ b, rows, range, narrow }: { b: LBlock; rows: LRow[]; range?: DateRange; narrow?: boolean }) {
  if (b.type === 'K-Stat-Simple') return <LStat c={b.config} rows={rows} range={range} />;
  if (b.type === 'K-Chart-Line') return <LLine c={b.config} rows={rows} />;
  if (b.type === 'K-Text') return <LText c={b.config} />;
  if (b.type === 'K-Icons' || b.type === 'K-Button') return <LButtons c={b.config} />;
  if (b.type === 'K-Filter') return <LFilter c={b.config} />;
  if (b.type === 'K-Tabs') return <LTabsBar tabs={b.config.tabs ?? []} cur={b.config.tabs?.[0]?.id ?? ''} onChange={() => {}} kind={b.config.tabStyle} />;
  if (b.type === 'K-Target') return <LTarget />;
  if (b.type === 'K-Divider') return <LDivider c={b.config} />;
  if (b.type === 'K-Spacer') return <div className="h-full rounded-md border border-dashed border-[rgb(var(--line))]" aria-hidden />;
  return <LTable c={b.config} rows={rows} narrow={narrow} />;
}
