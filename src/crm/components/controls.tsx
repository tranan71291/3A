'use client';

import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronRight, MoreVertical, Plus, Wallet } from 'lucide-react';
import { useOutsideClose } from '../app/header';
import { periodRange } from './filters';
import { Field } from './ui';
import { AVATAR_COLORS, AVATARS, btnAccent, btnGhost, btnPrimary, btnSm, fmtDate, initials, inputCls, iso, PERIOD_LABEL, useApp } from '../lib/core';
import type { DateRange, MenuItem, Period } from '../lib/types';
import { cn } from '../lib/utils';

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const src = AVATARS.get(name);
  if (src) return <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} aria-hidden />;
  const h = [...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const bg = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[rgb(var(--fg))]" style={{ width: size, height: size, background: bg }} aria-hidden>
      {initials(name.replace(/^(Công ty|Cty|CP|TNHH|NPP|Đại lý)\s+/gi, ''))}
    </span>
  );
}

export function AgeBadge({ hours }: { hours: number }) {
  const h = Math.max(0, hours);
  const tone = h >= 48 ? 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))]' : h >= 8 ? 'bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent-fg))]' : 'bg-[rgb(var(--line))] text-[rgb(var(--muted))]';
  return <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums', tone)} title="Thời gian chờ">{h < 10 ? h.toFixed(1).replace('.', ',') : Math.round(h)}h</span>;
}

/** Bộ chọn khoảng ngày toàn cục (tiêu đề trang) */
/** compact = chỉ hiện icon lịch (dùng trên thanh header mobile) */
export function DateRangePicker({ compact: iconOnly }: { compact?: boolean } = {}) {
  const { range, setRange, budget } = useApp();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(range);
  const ref = useOutsideClose(open, () => setOpen(false));
  const today = new Date();
  const presets: [string, DateRange][] = [
    ['Tháng này', { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)) }],
    ['30 ngày qua', { from: iso(new Date(Date.now() - 29 * 864e5)), to: iso(today) }],
    ['Quý này', periodRange(`Q${Math.floor(today.getMonth() / 3) + 1}` as Period, today.getFullYear())],
  ];
  return (
    <div className="relative" ref={ref}>
      {iconOnly ? (
        <button className={cn(btnGhost, 'p-2')} onClick={() => { setDraft(range); setOpen((v) => !v); }} aria-expanded={open} aria-haspopup="dialog" aria-label={`Khoảng thời gian ${fmtDate(range.from)} - ${fmtDate(range.to)}`}>
          <CalendarDays className="h-5 w-5" aria-hidden />
        </button>
      ) : (
        <button className={cn(btnGhost, 'w-full justify-between gap-2 py-2 sm:w-auto')} onClick={() => { setDraft(range); setOpen((v) => !v); }} aria-expanded={open} aria-haspopup="dialog">
          <CalendarDays className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />
          <span className="tabular-nums">{fmtDate(range.from)} - {fmtDate(range.to)}</span>
          <ChevronDown className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />
        </button>
      )}
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(340px,calc(100vw-2rem))] rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4 shadow-2xl motion-safe:animate-[popIn_.15s_ease-out]" role="dialog" aria-label="Chọn khoảng thời gian">
          <div className="mb-2 flex rounded bg-[rgb(var(--bg))] p-0.5" role="radiogroup" aria-label="Năm / quý">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => {
              const r = periodRange(p, budget.fiscalYear);
              const on = r.from === range.from && r.to === range.to;
              return <button key={p} role="radio" aria-checked={on} className={cn('flex-1 rounded-md px-2 py-1.5 text-xs font-medium', on ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')} onClick={() => { setRange(r); setOpen(false); }}>{p === 'YEAR' ? budget.fiscalYear : PERIOD_LABEL[p]}</button>;
            })}
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {presets.map(([label, r]) => (
              <button key={label} className={cn(btnGhost, btnSm)} onClick={() => { setRange(r); setOpen(false); }}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Từ ngày"><input className={inputCls} type="date" value={draft.from} max={draft.to} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></Field>
            <Field label="Đến ngày"><input className={inputCls} type="date" value={draft.to} min={draft.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></Field>
          </div>
          <button className={cn(btnPrimary, 'mt-3 w-full')} disabled={!draft.from || !draft.to || draft.from > draft.to} onClick={() => { setRange(draft); setOpen(false); }}>Áp dụng</button>
        </div>
      )}
    </div>
  );
}

/** Nút "⋮" mở menu thao tác của một dòng / thẻ */
export function RowMenu({ items, label = 'Thao tác khác', text, icon: TIcon, primary, align = 'right' }: { items: MenuItem[]; label?: string; text?: string; icon?: typeof Wallet; primary?: boolean; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  /** Vị trí menu theo màn hình (fixed): không bị bảng có thanh cuộn cắt mất; gần đáy màn hình thì mở lên trên */
  const [pos, setPos] = useState<CSSProperties>({});
  const ref = useOutsideClose(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);
  const toggle = (e: { currentTarget: HTMLElement }) => {
    if (open) { setOpen(false); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const h = items.length * 37 + 10;
    const up = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0;
    const x = align === 'right' ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, r.left) };
    setPos({ position: 'fixed', ...x, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }), maxHeight: Math.max(160, up ? r.top - 16 : window.innerHeight - r.bottom - 16), overflowY: 'auto' });
    setOpen(true);
  };
  return (
    <div className="relative inline-block" ref={ref} onClick={(e) => e.stopPropagation()}>
      {text ? (
        <button className={cn(primary ? btnPrimary : btnGhost, primary ? 'px-2.5 py-1 text-xs' : btnSm)} onClick={toggle} aria-haspopup="menu" aria-expanded={open}>
          {TIcon && <TIcon className="h-3.5 w-3.5" aria-hidden />}{text}<ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : (
        <button className={cn(btnGhost, 'p-1.5')} onClick={toggle} aria-label={label} aria-haspopup="menu" aria-expanded={open}><MoreVertical className="h-4 w-4" /></button>
      )}
      {open && (
        <ul role="menu" style={pos} className="z-[60] min-w-[200px] rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] py-1 text-left shadow-2xl motion-safe:animate-[popIn_.12s_ease-out]">
          {items.map((it) => (
            <li key={it.label} role="none">
              <button role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }}
                className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40', it.danger ? 'text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--danger)/0.1)]' : 'text-[rgb(var(--fg))] hover:bg-[rgb(var(--raised))]')}>
                {it.icon && <it.icon className="h-4 w-4 shrink-0" aria-hidden />}{it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function usePaged<T>(rows: T[], size = 10) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(page, pages);
  return { page: p, pages, setPage, slice: rows.slice((p - 1) * size, p * size), from: rows.length ? (p - 1) * size + 1 : 0, to: Math.min(p * size, rows.length), total: rows.length };
}

export function Pagination({ paged, unit }: { paged: ReturnType<typeof usePaged>; unit: string }) {
  if (!paged.total) return null;
  const nums = Array.from({ length: paged.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === paged.pages || Math.abs(n - paged.page) <= 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
      <span className="text-[rgb(var(--muted))]">Hiển thị {paged.from} - {paged.to} trong tổng số {paged.total} {unit}</span>
      <div className="flex items-center gap-1">
        <button className={cn(btnGhost, 'h-8 w-8 p-0')} disabled={paged.page <= 1} onClick={() => paged.setPage(paged.page - 1)} aria-label="Trang trước"><ChevronRight className="h-4 w-4 rotate-180" /></button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-[rgb(var(--muted))]">…</span>}
            <button className={cn('h-8 min-w-[2rem] rounded px-2 text-sm font-medium tabular-nums', n === paged.page ? 'g-brand font-semibold text-[rgb(var(--on-accent))]' : 'border border-[rgb(var(--line))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--raised))]')} onClick={() => paged.setPage(n)} aria-current={n === paged.page ? 'page' : undefined}>{n}</button>
          </span>
        ))}
        <button className={cn(btnGhost, 'h-8 w-8 p-0')} disabled={paged.page >= paged.pages} onClick={() => paged.setPage(paged.page + 1)} aria-label="Trang sau"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/** Thanh thao tác hàng loạt khi có dòng được chọn */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null;
  return (
    <div className="sticky top-[4.5rem] z-20 flex flex-wrap items-center gap-2 rounded-md border border-[rgb(var(--accent)/0.5)] bg-[rgb(var(--raised))] px-4 py-2.5 shadow-xl motion-safe:animate-[popIn_.15s_ease-out]">
      <span className="text-sm font-medium">Đã chọn <b className="tabular-nums text-[rgb(var(--accent-fg))]">{count}</b></span>
      <div className="flex flex-1 flex-wrap gap-2">{children}</div>
      <button className={cn(btnGhost, btnSm)} onClick={onClear}>Bỏ chọn</button>
    </div>
  );
}

export function useSelection(ids: string[]) {
  const [sel, setSel] = useState<string[]>([]);
  const valid = sel.filter((x) => ids.includes(x));
  return {
    ids: valid,
    has: (id: string) => valid.includes(id),
    toggle: (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    allOn: ids.length > 0 && ids.every((x) => valid.includes(x)),
    toggleAll: () => setSel((p) => (ids.every((x) => p.includes(x)) ? p.filter((x) => !ids.includes(x)) : Array.from(new Set([...p, ...ids])))),
    clear: () => setSel([]),
  };
}

/** Nút nổi trên mobile (ẩn từ lg) — nằm trên thanh điều hướng dưới */
export function Fab({ label, icon: Icon = Plus, onClick, disabled }: { label: string; icon?: typeof Wallet; onClick: () => void; disabled?: boolean }) {
  return (
    <button className={cn(btnAccent, 'fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 h-14 w-14 rounded-full p-0 shadow-[var(--shadow-lg)] lg:hidden')} onClick={onClick} disabled={disabled} aria-label={label}>
      <Icon className="h-6 w-6" aria-hidden />
    </button>
  );
}

/** Thẻ dòng dữ liệu dùng cho danh sách trên mobile */
export function MobileRow({ title, sub, avatar, badge, value, status, onClick, menu }: { title: string; sub?: ReactNode; avatar?: string; badge?: ReactNode; value?: ReactNode; status?: ReactNode; onClick?: () => void; menu?: ReactNode }) {
  return (
    <article className="flex items-start gap-3 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3" onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}>
      {avatar && <Avatar name={avatar} size={40} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-[rgb(var(--fg))]">{title}</p>
          {badge}
        </div>
        {sub && <div className="mt-0.5 truncate text-xs text-[rgb(var(--muted))]">{sub}</div>}
        {(value || status) && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-base font-semibold tabular-nums">{value}</span>
            {status}
          </div>
        )}
      </div>
      {menu ?? (onClick && <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />)}
    </article>
  );
}

