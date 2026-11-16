'use client';

import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Clock, EyeOff, GripVertical, Plus, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { bizMode, btnGhost, btnPrimary, btnSm, hhmm, rangeText, SIZE_CLS, SIZE_LABEL, useApp } from '../../lib/core';
import type { WidgetDef, WidgetPref } from '../../lib/types';
import { cn } from '../../lib/utils';
import { AlertsWidget, ForecastWidget, FunnelWidget, KpiWidget, MentionsWidget } from './overview';
import { MdfOverview } from '../messages/messenger';

/** Khung widget dùng chung cho mọi bảng điều khiển */
export function WidgetCard({ title, period, unit, asOf, onReload, action, children, className, edit }: { title: ReactNode; period?: string; unit?: string; asOf?: number; onReload?: () => void; action?: ReactNode; children: ReactNode; className?: string; edit?: ReactNode }) {
  const { range } = useApp();
  const per = period === 'range' ? rangeText(range) : period;
  return (
    <section className={cn('glass-card flex min-w-0 flex-col rounded-md p-5', className)}>
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display mr-auto text-[15px] font-bold tracking-tight">{title}</h2>
          {action}
          {edit}
        </div>
        {(per || unit) && <p className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-[rgb(var(--muted))]">{per && <span>Kỳ: {per}</span>}{unit && <span>ĐVT: {unit}</span>}</p>}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
      {asOf !== undefined && (
        <footer className="mt-4 flex items-center gap-1.5 border-t border-[rgb(var(--ink)/0.06)] pt-2.5 text-[11px] text-[rgb(var(--muted))]">
          <Clock className="h-3 w-3" aria-hidden />Số liệu tính đến {hhmm(asOf)}
          {onReload && <button className="ml-1 font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={onReload}>Tải lại</button>}
        </footer>
      )}
    </section>
  );
}

export function WidgetBoard({ widgets, storeKey, canEdit }: { widgets: WidgetDef[]; storeKey: string; canEdit: boolean }) {
  const defaults: WidgetPref[] = widgets.map((w) => ({ id: w.id, size: w.size }));
  const [prefs, setPrefs] = useState<WidgetPref[]>(defaults);
  const [edit, setEdit] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [ver, setVer] = useState<Record<string, number>>({});
  const [asOf, setAsOf] = useState<Record<string, number>>({});
  const born = useRef(Date.now());
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storeKey) ?? 'null') as WidgetPref[] | null;
      if (Array.isArray(v)) setPrefs([...v.filter((p) => widgets.some((w) => w.id === p.id)), ...defaults.filter((d) => !v.some((p) => p.id === d.id))]);
    } catch { /* bỏ qua */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);
  const save = (next: WidgetPref[]) => { setPrefs(next); try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* bỏ qua */ } };
  const move = (from: string, to: string) => {
    if (from === to) return;
    const a = [...prefs];
    const i = a.findIndex((p) => p.id === from);
    const [x] = a.splice(i, 1);
    a.splice(a.findIndex((p) => p.id === to), 0, x);
    save(a);
  };
  const shift = (id: string, d: -1 | 1) => {
    const vis = prefs.filter((p) => !p.hidden);
    const i = vis.findIndex((p) => p.id === id);
    const j = vis[i + d];
    if (j) move(id, j.id);
  };
  const visible = prefs.filter((p) => !p.hidden);
  const hidden = prefs.filter((p) => p.hidden);
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {edit && <p className="mr-auto text-xs text-[rgb(var(--muted))]">Kéo thẻ để sắp xếp (hoặc dùng mũi tên), chọn kích thước, ẩn widget không cần. Lưu riêng cho bạn trên trình duyệt này.</p>}
          {edit && hidden.length > 0 && hidden.map((p) => (
            <button key={p.id} className={cn(btnGhost, btnSm, 'border-dashed')} onClick={() => save(prefs.map((x) => (x.id === p.id ? { ...x, hidden: false } : x)))}><Plus className="h-3.5 w-3.5" aria-hidden />{widgets.find((w) => w.id === p.id)?.title}</button>
          ))}
          {edit && <button className={cn(btnGhost, btnSm)} onClick={() => save(defaults)}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Mặc định</button>}
          <button className={cn(edit ? btnPrimary : btnGhost, btnSm, !edit && 'ml-auto')} onClick={() => setEdit((v) => !v)} aria-pressed={edit}><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />{edit ? 'Xong' : 'Tùy chỉnh bảng điều khiển'}</button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {visible.map((p, idx) => {
          const w = widgets.find((x) => x.id === p.id);
          if (!w) return null;
          return (
            <div
              key={p.id}
              className={cn('rounded-md transition-[outline-color,opacity,box-shadow]', SIZE_CLS[p.size], edit && 'outline-dashed outline-2 outline-[rgb(var(--secondary)/0.6)]', drag === p.id && 'opacity-40', over === p.id && drag !== p.id && 'shadow-[0_0_0_2px_#F28C33]')}
              draggable={edit}
              onDragStart={(e) => { setDrag(p.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); }}
              onDragOver={(e) => { if (!edit || !drag) return; e.preventDefault(); setOver(p.id); }}
              onDragLeave={() => setOver((o) => (o === p.id ? null : o))}
              onDrop={(e) => { e.preventDefault(); if (drag) move(drag, p.id); setDrag(null); setOver(null); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
              aria-label={w.title}
            >
              <WidgetCard className="h-full" title={<span className="flex items-center gap-2">{edit && <GripVertical className="h-4 w-4 cursor-grab text-[rgb(var(--secondary-fg))]" aria-hidden />}{w.title}</span>} period={w.period} unit={w.unit} asOf={asOf[p.id] ?? born.current}
                onReload={() => { setVer((v) => ({ ...v, [p.id]: (v[p.id] ?? 0) + 1 })); setAsOf((a) => ({ ...a, [p.id]: Date.now() })); }}
                edit={edit ? (
                  <div className="flex items-center gap-1">
                    <button className="rounded p-1 text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] disabled:opacity-30" disabled={idx === 0} onClick={() => shift(p.id, -1)} aria-label={`Đưa ${w.title} lên trước`}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button className="rounded p-1 text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] disabled:opacity-30" disabled={idx === visible.length - 1} onClick={() => shift(p.id, 1)} aria-label={`Đưa ${w.title} ra sau`}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <div className="flex rounded border border-[rgb(var(--ink)/0.1)] p-0.5" role="radiogroup" aria-label="Kích thước">
                      {([4, 6, 8, 12] as const).map((z) => <button key={z} role="radio" aria-checked={p.size === z} className={cn('rounded-sm px-1.5 py-0.5 text-[10px] font-semibold', p.size === z ? 'g-brand text-[rgb(var(--on-accent))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')} onClick={() => save(prefs.map((x) => (x.id === p.id ? { ...x, size: z } : x)))}>{SIZE_LABEL[z]}</button>)}
                    </div>
                    <button className="rounded p-1 text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] hover:text-[rgb(var(--fg))]" onClick={() => save(prefs.map((x) => (x.id === p.id ? { ...x, hidden: true } : x)))} aria-label={`Ẩn ${w.title}`}><EyeOff className="h-3.5 w-3.5" /></button>
                  </div>
                ) : undefined}>
                <Fragment key={ver[p.id] ?? 0}>{w.node}</Fragment>
              </WidgetCard>
            </div>
          );
        })}
      </div>
      {!visible.length && <EmptyState text={<>Bạn đã ẩn hết widget</>} hint={<>Bấm các nút “+” phía trên để hiện lại, hoặc khôi phục bố cục mặc định.</>} art="box" action="Khôi phục mặc định" onAction={() => save(defaults)} />}
    </div>
  );
}

/** Trang "Bảng điều khiển" đầu tiên của Tổng quan: KPI, dự báo, cảnh báo, phễu, trao đổi, + module chuyên sâu theo kiểu vận hành */
export function CommandCenter() {
  const { me, role, org, company, budget } = useApp();
  const orgId = org.id;
  const mfg = bizMode(company) === 'MFG';
  const widgets: WidgetDef[] = [
    { id: 'kpi', title: 'Chỉ số chính', node: <KpiWidget />, size: 12, period: 'range', unit: 'VNĐ (rút gọn tr / tỷ)' },
    { id: 'forecast', title: 'Dự báo doanh thu', node: <ForecastWidget />, size: 8, period: '6 tháng qua + 3 tháng tới', unit: 'VNĐ' },
    { id: 'alerts', title: 'Cảnh báo thông minh', node: <AlertsWidget />, size: 4, period: 'Hiện tại' },
    { id: 'funnel', title: 'Phễu chuyển đổi', node: <FunnelWidget />, size: 4, period: 'range', unit: 'Cơ hội' },
    { id: 'mentions', title: 'Trao đổi nhắc tên tôi', node: <MentionsWidget />, size: 8, period: 'Mới nhất' },
    ...(!mfg ? [{ id: 'mdf', title: 'Quỹ MDF 3M', node: <MdfOverview />, size: 12 as const, period: `Năm tài chính ${budget.fiscalYear}`, unit: 'VNĐ' }] : []),
  ];
  return <WidgetBoard widgets={widgets} storeKey={`3a:ui:board:${orgId}:${me?.id ?? 'x'}`} canEdit={role === 'BOD' || role === 'DEPT_HEAD' || role === 'MKT_LEAD'} />;
}

