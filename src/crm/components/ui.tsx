'use client';

import { Children, Fragment, cloneElement, isValidElement, type Dispatch, type DragEvent, type ReactElement, type ReactNode, type SetStateAction, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Copy, Download, Printer, Sparkles, Wallet, X } from 'lucide-react';
import { btnGhost, btnSm, C, digits, esc, GRAD, inputCls, overlaySeq, overlayStack, overlaySubs, overlayTop, portal, stickySave, stickyStore, strHash, todayISO, useApp, VIEW_META } from '../lib/core';
import { downloadCsv } from '../lib/csv';
import type { SortState, SortVal, TableBulk, TableSort, Tone, ViewKind } from '../lib/types';
import { cn } from '../lib/utils';
import { docShell, printHtml } from '../modules/sales/templates';

/** v44: khối cài đặt: tiêu đề + phụ đề + nút nằm trên, nội dung trong thẻ (flush = bảng sát mép) */
export function SetBlock({ title, sub, action, children, flush, className }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-2 flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1 px-1">
        <h2 className="text-[15px] font-medium">{title}</h2>
        {sub && <span className="text-[12.5px] text-[rgb(var(--muted))]">{sub}</span>}
        {action && <span className="ml-auto flex items-center gap-2">{action}</span>}
      </div>
      <div className={cn('glass-card rounded-xl p-5', flush && 'pb-2')}>{children}</div>
    </section>
  );
}

/** v44: thẻ phụ ở cột phải (gợi ý, AI): tiêu đề có biểu tượng */
export function SideCard({ title, icon: Icon = Sparkles, sub, children }: { title: ReactNode; icon?: typeof Wallet; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="glass-card rounded-xl p-4">
      <p className="mb-1 flex items-start gap-2 text-[13.5px] font-medium"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="flex-1">{title}</span>{sub && <span className="text-xs font-normal text-[rgb(var(--muted))]">{sub}</span>}</p>
      {children}
    </section>
  );
}

/** v44: dòng trạng thái "đang áp dụng" (thay cho công tắc giả khi quy tắc là cố định của hệ thống) */
export function RuleRow({ title, detail, on = true, note }: { title: string; detail: string; on?: boolean; note?: string }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{title}</p><p className="text-xs text-[rgb(var(--muted))]">{detail}</p></div>
      <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11.5px]', on ? 'bg-[rgb(var(--success)/0.12)] text-[rgb(var(--success-fg))]' : 'bg-[rgb(var(--raised))] text-[rgb(var(--muted))]')}>{note ?? (on ? 'Đang áp dụng' : 'Tắt')}</span>
    </li>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('glass-card rounded-xl p-5', className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-[15px] font-medium text-[rgb(var(--fg))]">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Chip({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) {
  // v59: nhãn trạng thái nền pastel (cùng lớp .ui-tone-* với StatusBadge). Teal = đạt / xong, Cam = chờ / đang làm, Đỏ = quá hạn / lỗi, Xanh = đã gửi, Xám = trung tính
  const cls: Record<Tone, string> = { muted: 'ui-tone-neutral', orange: 'ui-tone-accent', teal: 'ui-tone-success', red: 'ui-tone-danger', blue: 'ui-tone-info' };
  return <span data-chip={tone} className={cn('inline-flex h-[22px] max-w-full items-center whitespace-nowrap rounded-[var(--radius-badge)] px-2 text-[12px] font-medium leading-none', cls[tone])}><span className="truncate">{children}</span></span>;
}

/** v40: mã chứng từ (LD-0005, BG-0001…) dạng thẻ mono xám, dùng thống nhất mọi bảng */
export function Code({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('code-chip', className)}>{children}</span>;
}

/**
 * Chuỗi theo tháng (cũ → mới) cho sparkline dưới KPI: đếm hoặc cộng giá trị theo tháng phát sinh.
 * `cumulative` = lũy kế (vd. tổng khách hàng). Mặc định 6 tháng tính đến tháng hiện tại.
 */
export function monthly<T>(items: T[], when: (x: T) => string | number | undefined, val: (x: T) => number = () => 1, n = 6, cumulative = false): number[] {
  const now = new Date();
  const keys = Array.from({ length: n }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1); return d.getFullYear() * 12 + d.getMonth(); });
  const out = keys.map(() => 0);
  let before = 0;
  for (const x of items) {
    const w = when(x);
    if (w === undefined || w === '') continue;
    const d = new Date(typeof w === 'number' ? w : w.length <= 10 ? `${w}T12:00:00` : w);
    if (Number.isNaN(d.getTime())) continue;
    const k = d.getFullYear() * 12 + d.getMonth();
    const i = keys.indexOf(k);
    if (i >= 0) out[i] += val(x);
    else if (k < keys[0]) before += val(x);
  }
  if (!cumulative) return out;
  let acc = before;
  return out.map((v) => (acc += v));
}

/**
 * Thẻ KPI phong cách "Data-Driven Minimalism": không nền khối, không viền; icon + tên chỉ số + số lớn,
 * phân cách bằng vạch dọc siêu mờ, sparkline xu hướng (cam = chỉ số chính, xanh dương = đối chiếu).
 * `highlight` = KPI quan trọng: số hiển thị bằng gradient cam → vàng của logo.
 */
export function StatCard({ label, value, sub, color = C.orange, delta, deltaLabel = 'so với kỳ trước', highlight }: { label: string; value: string; sub?: string; icon?: typeof Wallet; color?: string; delta?: number | null; deltaLabel?: string; spark?: number[]; highlight?: boolean }) {
  // v40: thẻ số gọn: nhãn viết thường, con số, một dòng phụ. Không icon, không sparkline; màu chỉ khi số mang nghĩa (đỏ / xanh)
  const tone = color === C.red ? 'text-[rgb(var(--danger-fg))]' : highlight ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--fg))]';
  // v59 (v49: không đặt dải KPI to trên trang danh sách): dòng tóm tắt gọn — số + nhãn cùng 1 dòng, dòng phụ bên dưới
  return (
    <div className="kpi flex min-w-0 flex-col gap-0.5 border-l border-[rgb(var(--ink)/0.08)] py-0.5 pl-4 pr-2">
      <p className="flex min-w-0 items-baseline gap-2"><span className={cn('font-archivo shrink-0 text-[19px] font-semibold leading-6 ui-num', tone)}>{value}</span><span className="min-w-0 truncate text-[12.5px] text-[rgb(var(--muted))]">{label}</span></p>
      {delta !== undefined && delta !== null && Number.isFinite(delta) ? (
        <p className={cn('truncate text-xs tabular-nums', delta >= 0 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>
          {delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(0)}% <span className="text-[rgb(var(--muted))]">{deltaLabel}</span>
        </p>
      ) : sub ? <p className="truncate text-xs text-[rgb(var(--muted))]">{sub}</p> : null}
    </div>
  );
}

/** Thanh tab; `aside` = nội dung nằm cùng hàng bên phải (vd. bộ lọc thời gian) */
export function Tabs<T extends string>({ tabs, value, onChange, variant = 'line', aside }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; variant?: 'line' | 'pill'; aside?: ReactNode }) {
  const side = aside ? <div className="flex shrink-0 items-center gap-2">{aside}</div> : null;
  if (variant === 'pill') {
    return (
      <div className="flex min-w-0 max-w-full items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--sunken))] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
              className={cn('whitespace-nowrap rounded px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]', value === t.id ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))] hover:bg-[rgb(var(--secondary)/0.15)] hover:text-[rgb(var(--fg))]')}>
              {t.label}{t.count !== undefined && <span className="ml-1.5 font-mono text-[11.5px] font-normal text-[rgb(var(--muted))]">{t.count}</span>}
            </button>
          ))}
        </div>
        {side}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 max-w-full items-center gap-3 border-b border-[rgb(var(--line))]">
      <div className="flex min-w-0 flex-1 gap-5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={value === t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-0.5 py-2.5 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.5)]',
              value === t.id ? 'border-[rgb(var(--fg))] text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]',
            )}
          >
            {t.label}{t.count !== undefined && <span className="ml-1.5 font-mono text-[11.5px] font-normal text-[rgb(var(--muted))]">{t.count}</span>}
          </button>
        ))}
      </div>
      {side && <div className="pb-1.5">{side}</div>}
    </div>
  );
}

export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-[rgb(var(--danger-fg))]">{error}</span> : hint ? <span className="mt-1 block text-xs text-[rgb(var(--muted))]">{hint}</span> : null}
    </label>
  );
}

/** Ô nhập tiền VNĐ — hiển thị có dấu chấm phân cách */
export function MoneyInput({ value, onChange, disabled, label }: { value: number; onChange: (n: number) => void; disabled?: boolean; label?: string }) {
  return (
    <div className="relative">
      <input
        className={cn(inputCls, 'pr-8 tabular-nums')}
        inputMode="numeric"
        disabled={disabled}
        aria-label={label}
        value={value ? new Intl.NumberFormat('vi-VN').format(value) : ''}
        onChange={(e) => onChange(digits(e.target.value))}
        placeholder="0"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[rgb(var(--muted))]">₫</span>
    </div>
  );
}

export function useOverlay(): { top: boolean; id: number } {
  const [id] = useState(() => ++overlaySeq.n);
  const [, force] = useState(0);
  useEffect(() => {
    overlayStack.push(id);
    const f = () => force((x) => x + 1);
    overlaySubs.add(f);
    overlaySubs.forEach((g) => g());
    return () => {
      overlaySubs.delete(f);
      const i = overlayStack.indexOf(id);
      if (i >= 0) overlayStack.splice(i, 1);
      overlaySubs.forEach((g) => g());
    };
  }, [id]);
  return { top: overlayTop() === id || !overlayStack.includes(id), id };
}

/** Esc chỉ đóng lớp phủ trên cùng */
export function useEscClose(id: number, onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && overlayTop() === id) onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [id, onClose]);
}

export function useSticky<T>(key: string, init: T, force = false): [T, Dispatch<SetStateAction<T>>] {
  const [v, setV] = useState<T>(() => (!force && stickyStore.has(key) ? (stickyStore.get(key) as T) : init));
  useEffect(() => { stickyStore.set(key, v); stickySave(); }, [key, v]);
  return [v, setV];
}

/**
 * v55.1: tùy chọn "Lưu cho tôi" (cột, kỳ, số dòng…) lưu theo người dùng trong dữ liệu doanh nghiệp -> đồng bộ nhiều thiết bị.
 * Lần đầu dùng: lấy giá trị đang nhớ trong phiên (useSticky cũ, sessionStorage) chép sang để người dùng không mất lựa chọn.
 */
export function useUserPref<T>(key: string, init: T): [T, (x: T | ((prev: T) => T)) => void] {
  const { myPrefs, setMyPref, me } = useApp();
  const has = Object.prototype.hasOwnProperty.call(myPrefs, key);
  const legacy = stickyStore.has(key) ? (stickyStore.get(key) as T) : undefined;
  // giữ nguyên tham chiếu giá trị mặc định giữa các lần render (mảng / đối tượng mới mỗi lần làm hiệu ứng phụ chạy vòng lặp)
  const initRef = useRef(init);
  const v = has ? (myPrefs[key] as T) : legacy !== undefined ? legacy : initRef.current;
  const meId = me?.id;
  useEffect(() => { if (meId && !has && legacy !== undefined) setMyPref(key, legacy); }, [meId, has]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (x: T | ((prev: T) => T)) => setMyPref(key, typeof x === 'function' ? (x as (prev: T) => T)(v) : x);
  return [v, set];
}

/** Trạng thái đang tải (khung xương) */
export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Đang tải dữ liệu">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-md bg-[rgb(var(--ink)/0.06)]" />)}</div>
      <div className="glass-card space-y-3 rounded-md p-5">{Array.from({ length: rows }, (_, i) => <div key={i} className="h-9 animate-pulse rounded bg-[rgb(var(--ink)/0.05)]" />)}</div>
    </div>
  );
}

/** Khung trượt từ cạnh phải (bộ lọc, bình luận...); trên điện thoại là bottom sheet */
export function SideSheet({ title, sub, onClose, children, footer, width = 'sm:w-[400px]' }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: string }) {
  const ov = useOverlay();
  useEscClose(ov.id, onClose);
  return portal(
    <div className={cn('fixed inset-0 z-[62]', !ov.top && 'invisible')} aria-hidden={!ov.top || undefined} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 motion-safe:animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <aside className={cn('absolute inset-x-0 bottom-0 flex max-h-[88vh] w-full flex-col rounded-t-xl border-t border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-[var(--shadow-lg)] motion-safe:animate-[sheetUp_.22s_ease-out] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:rounded-none sm:border-l sm:border-t-0 sm:motion-safe:animate-[slideIn_.2s_ease-out]', width)}>
        <span className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[rgb(var(--ink)/0.2)] sm:hidden" aria-hidden />
        <header className="flex items-start justify-between gap-3 border-b border-[rgb(var(--ink)/0.06)] px-5 py-4">
          <div className="min-w-0"><h2 className="font-display text-base font-semibold">{title}</h2>{sub && <div className="mt-0.5 text-xs text-[rgb(var(--muted))]">{sub}</div>}</div>
          <button className={cn(btnGhost, 'p-1.5')} onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-[rgb(var(--ink)/0.06)] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">{footer}</footer>}
      </aside>
    </div>,
  );
}

export function Modal({ title, onClose, children, footer, wide, xl, flush, head }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean; xl?: boolean; flush?: boolean; head?: ReactNode }) {
  const ov = useOverlay();
  useEscClose(ov.id, onClose);
  return portal(
    <div className={cn('fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:p-4', !ov.top && 'invisible')} aria-hidden={!ov.top || undefined} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 motion-safe:animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <div className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-2xl sm:rounded motion-safe:animate-[popIn_.18s_ease-out]', xl ? 'sm:max-w-[1120px]' : wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between gap-3 border-b border-[rgb(var(--line))] px-5 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-[rgb(var(--fg))]">{title}</h2>{head}</div>
          <button className={cn(btnGhost, 'p-1.5')} onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" /></button>
        </header>
        <div className={cn('flex-1 overflow-y-auto', !flush && 'px-5 py-4')}>{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 max-sm:[&>*]:flex-1 border-t border-[rgb(var(--line))] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:pb-4">{footer}</footer>}
      </div>
    </div>
  );
}

/** Vùng chọn / kéo-thả file từ máy tính */
export function FilePicker({ accept, multiple, onFiles, children, disabled, className }: { accept?: string; multiple?: boolean; onFiles: (f: File[]) => void; children: ReactNode; disabled?: boolean; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && ref.current?.click()}
      onKeyDown={(e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ref.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn('cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]', over && 'ring-2 ring-[rgb(var(--accent))]', disabled && 'cursor-not-allowed opacity-40', className)}
    >
      <input
        ref={ref}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
      {children}
    </div>
  );
}

/** v59: trạng thái trống chuyển sang bộ giao diện lõi (components/kit), giữ tên export cũ */
export { EmptyArt, EmptyState } from './kit/empty-state';

export function ViewSwitch<T extends ViewKind>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: T[] }) {
  return (
    <div className="flex shrink-0 rounded-md border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--sunken))] p-1" role="radiogroup" aria-label="Chế độ xem">
      {options.map((v) => {
        const M = VIEW_META[v];
        return (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} title={`Xem dạng ${M.label}`}
            className={cn('flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors', value === v ? 'bg-[rgb(var(--surface))] text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))] hover:bg-[rgb(var(--secondary)/0.2)] hover:text-[rgb(var(--fg))]')}>
            <M.icon className="h-3.5 w-3.5" aria-hidden />{M.label}
          </button>
        );
      })}
    </div>
  );
}

/** Sắp xếp theo cột: bấm 1 lần tăng dần, 2 lần giảm dần, 3 lần về thứ tự mặc định. Trạng thái giữ khi quay lại (useSticky). */
export function useSort<T>(key: string, rows: T[], spec: Record<number, (r: T) => SortVal>) {
  const [sort, setSort] = useSticky<SortState>(`sort.${key}`, null);
  const get = sort ? spec[sort.col] : undefined;
  const sorted = !sort || !get ? rows : [...rows].sort((a, b) => {
    const x = get(a), y = get(b);
    if (x == null || x === '') return y == null || y === '' ? 0 : 1;
    if (y == null || y === '') return -1;
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'vi', { numeric: true })) * sort.dir;
  });
  const th: TableSort = { sort, sortable: Object.keys(spec).map(Number), onSort: (col) => setSort((p) => (p?.col !== col ? { col, dir: 1 } : p.dir === 1 ? { col, dir: -1 } : null)) };
  return { rows: sorted, th };
}

/** Bảng dữ liệu dùng chung. Dưới md tự chuyển thành thẻ (card) xếp dọc, nhãn cột lấy từ tiêu đề; stack={false} để giữ cuộn ngang (bảng ma trận). */
/** Bảng dữ liệu dùng chung (chuẩn theo bảng Sản phẩm):
 *  - Cột STT tự thêm ở đầu (đếm bằng CSS counter, không cần sửa từng dòng); `stt` = số thứ tự bắt đầu (offset khi phân trang), `stt={false}` để tắt.
 *  - Cột cuối tiêu đề '' hoặc 'Thao tác' được chuẩn hóa thành “Thao tác”, căn phải. */
/** Chữ thuần của nội dung tiêu đề / ô (để đặt tên cột, xuất CSV) */
export function nodeText(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(nodeText).join('');
  if (isValidElement(n)) return nodeText((n.props as { children?: ReactNode }).children);
  return '';
}

/**
 * v48: bảng dùng chung. Ô tích chọn nhiều dòng + thanh thao tác (sao chép, xuất CSV, in, thao tác riêng), nút chọn cột hiển thị (nhớ theo trình duyệt).
 * Bảng đã có ô chọn riêng (cột đầu là ô tích) giữ nguyên cách chọn cũ. optional: cột thêm, mặc định ẩn.
 */
export function Table({ head, children, minW = 760, right, sort, stack = true, stt = 0, select, bulk, id, title, optional, foot, colPick = true }: { head: ReactNode[]; children: ReactNode; minW?: number; right?: number[]; sort?: TableSort; stack?: boolean; stt?: number | false; select?: boolean; bulk?: TableBulk[]; id?: string; title?: string; optional?: number[]; /** v59: dòng tổng cuối bảng, mỗi ô đúng cột của nó (ẩn trên điện thoại) */ foot?: ReactNode[]; /** v61: false = bảng ma trận / bảng tra cứu cố định, không có nút chọn cột */ colPick?: boolean }) {
  const showStt = stt !== false && stack && head[0] !== 'STT';
  const lastH = head[head.length - 1];
  // v59: nhận cả tiêu đề dạng <span>Thao tác</span> (căn phải) là cột thao tác: không co, không ẩn, không xuất CSV
  const lastT = nodeText(lastH).trim();
  const actCol = head.length > 1 && (lastT === '' || lastT === 'Thao tác');
  const ownSel = isValidElement(head[0]) && (head[0] as ReactElement).type === 'input';
  const useSel = (select ?? true) && !ownSel && head.length > 1;
  const labels = head.map((h, i) => (actCol && i === head.length - 1 ? 'Thao tác' : nodeText(h).trim()));
  const tid = id ?? `t${strHash(labels.join('|'))}`;
  const ref = useRef<HTMLTableElement>(null);
  const [auto, setAuto] = useState<number[]>([]);
  const [hidden, setHidden0] = useState<number[]>(() => { try { const v = JSON.parse(localStorage.getItem(`3a:cols:${tid}`) ?? 'null'); return Array.isArray(v) ? v : optional ?? []; } catch { return optional ?? []; } });
  const setHidden = (v: number[]) => { setHidden0(v); try { localStorage.setItem(`3a:cols:${tid}`, JSON.stringify(v)); } catch { /* bỏ qua */ } };
  const [picked, setPicked] = useState<string[]>([]);
  const [colOpen, setColOpen] = useState(false);
  // ---- gắn ô chọn vào từng dòng
  const keys: string[] = [];
  let n0 = 0;
  const withSel = (node: ReactNode): ReactNode => Children.map(node, (ch) => {
    if (!isValidElement(ch)) return ch;
    if (ch.type === Fragment) return cloneElement(ch as ReactElement<{ children?: ReactNode }>, {}, withSel((ch.props as { children?: ReactNode }).children));
    if (ch.type !== 'tr') return ch;
    const k = String(ch.key ?? `r${n0}`);
    n0 += 1;
    keys.push(k);
    const on = picked.includes(k);
    const box = <td key="__sel" data-sel="" className="w-10 pl-5 pr-1 align-middle max-md:hidden" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={on} onChange={() => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))} aria-label="Chọn dòng" /></td>;
    return cloneElement(ch as ReactElement<{ children?: ReactNode; 'data-rk'?: string }>, { 'data-rk': k }, box, ...Children.toArray((ch.props as { children?: ReactNode }).children));
  });
  const body = useSel ? withSel(children) : children;
  const sel = picked.filter((k) => keys.includes(k));
  const allOn = keys.length > 0 && keys.every((k) => sel.includes(k));
  const off = useSel ? 1 : 0;
  useEffect(() => {
    const t = ref.current;
    if (t && stack) {
      const ls = [...(t.tHead?.rows[0]?.cells ?? [])].slice(showStt ? 1 : 0).map((c) => (c.textContent ?? '').trim());
      [...(t.tBodies[0]?.rows ?? [])].forEach((r) => { if (r.cells.length === ls.length) [...r.cells].forEach((c, i) => { if (c.getAttribute('data-label') !== ls[i]) c.setAttribute('data-label', ls[i]); }); });
    }
    const rows = ref.current?.tBodies[0]?.rows;
    const row = rows ? [...rows].find((r) => r.cells.length === head.length + off) : undefined;
    if (!row) return;
    const r = [...row.cells].slice(off).flatMap((c, i) => (c.classList.contains('text-right') ? [i] : []));
    setAuto((p) => (p.join() === r.join() ? p : r));
  });
  const alignR = right ?? auto;
  // ---- ẩn cột: tiêu đề có thêm ô STT thật; thân bảng STT là ::before (không tính nth-child)
  const vis = hidden.filter((i) => i < head.length && !(actCol && i === head.length - 1));
  const hideCss = vis.map((i) => `table[data-tid="${tid}"] > thead > tr > :nth-child(${i + 1 + (showStt ? 1 : 0) + off}), table[data-tid="${tid}"] > tfoot > tr > :nth-child(${i + 1 + (showStt ? 1 : 0) + off}), table[data-tid="${tid}"] > tbody > tr:not(:has(> td[colspan])) > :nth-child(${i + 1 + off}){display:none}`).join('');
  // ---- v59: bảng tự vừa khung (v49: không cuộn ngang ở màn ≥ 1200px). Khi tràn, các cột chữ dài (không phải cột số / thao tác)
  // co lại chia phần còn trống, chữ cắt "…", rê chuột xem đủ. Cột số, ngày, mã giữ nguyên độ rộng. Màn hẹp hơn giữ cuộn ngang như cũ.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ cols: number[]; px: number[]; w: number; adj?: number } | null>(null);
  const visKey = vis.join(',');
  useEffect(() => { setFit(null); }, [visKey, head.length]);
  useEffect(() => {
    const w = wrapRef.current, t = ref.current;
    if (!w || !t || !stack) return;
    if (window.innerWidth < 1200) { if (fit) setFit(null); return; }
    const rows = [...(t.tBodies[0]?.rows ?? [])].filter((r) => r.cells.length === head.length + off).slice(0, 40);
    if (fit) {
      if (w.clientWidth > fit.w + 160) { setFit(null); return; }
      // còn tràn vài px (làm tròn, mức tối thiểu): rút phần dư từ các cột còn rộng hơn 96px, tối đa 3 lần
      const over = w.scrollWidth - w.clientWidth;
      if (over > 1 && (fit.adj ?? 0) < 3 && fit.px.some((x) => x > 96)) {
        const room = fit.px.reduce((s, x) => s + Math.max(0, x - 96), 0);
        setFit({ ...fit, px: fit.px.map((x) => Math.max(96, x - Math.ceil(((x - 96) / Math.max(1, room)) * (over + 4)))), adj: (fit.adj ?? 0) + 1 });
        return;
      }
      fit.cols.forEach((i) => rows.forEach((r) => { const c = r.cells[i + off]; if (c && !c.title && c.scrollWidth > c.clientWidth + 1) c.title = (c.innerText ?? '').trim(); }));
      return;
    }
    if (w.scrollWidth <= w.clientWidth + 2) return;
    if (!rows.length) { setFit({ cols: [], px: [], w: w.clientWidth }); return; } // bảng trống: chỉ bỏ độ rộng tối thiểu
    // đo độ rộng thật khi bỏ độ rộng tối thiểu (minW): nếu vừa khung thì chỉ cần bỏ minW, không cắt chữ
    const prevMin = t.style.minWidth;
    t.style.minWidth = '0px';
    const tight = w.scrollWidth <= w.clientWidth + 2;
    const tw0 = t.getBoundingClientRect().width;
    if (tight) { t.style.minWidth = prevMin; setFit({ cols: [], px: [], w: w.clientWidth }); return; }
    // cột co được: chữ (không phải cột số, thao tác; không chứa nhãn trạng thái / ô nhập), rộng > 120px
    const right0 = right ?? auto;
    const natW = (i: number) => Math.max(...rows.map((r) => r.cells[i + off]?.getBoundingClientRect().width ?? 0));
    const cand = head.map((_, i) => i).filter((i) => !vis.includes(i) && !(actCol && i === head.length - 1) && !right0.includes(i)
      && !rows.some((r) => r.cells[i + off]?.querySelector('[data-chip],[data-status],[data-sla],input,select')) && natW(i) > 120);
    const need = cand.reduce((s, i) => s + natW(i), 0);
    const avail = w.clientWidth - (tw0 - need) - 4;
    // "mức trần chung": chỉ cột dài nhất bị cắt bớt về cùng 1 độ rộng (tối thiểu 120px); cột ngắn hơn mức trần giữ nguyên
    const nat = cand.map(natW);
    let cap = Math.max(...nat, 120);
    for (let k = 0; k < 40 && cap > 120; k += 1) { if (nat.reduce((s, x) => s + Math.min(x, cap), 0) <= avail) break; cap -= Math.max(4, Math.ceil((nat.reduce((s, x) => s + Math.min(x, cap), 0) - avail) / Math.max(1, nat.filter((x) => x >= cap).length))); }
    const px = nat.map((x) => Math.max(120, Math.min(x, Math.floor(cap))));
    t.style.minWidth = prevMin;
    setFit({ cols: cand, px, w: w.clientWidth });
  });
  const fitCss = fit ? fit.cols.map((i, k) => {
    const b = `table[data-tid="${tid}"] > tbody > tr:not(:has(> td[colspan])) > :nth-child(${i + 1 + off})`;
    const h = `table[data-tid="${tid}"] > thead > tr > :nth-child(${i + 1 + (showStt ? 1 : 0) + off})`;
    // v61: chữ nằm trong khối con (nút, đoạn, hàng flex ảnh + tên) cũng rút gọn bằng "…" thay vì bị cắt cụt
    return `${b},${h}{box-sizing:border-box;max-width:${fit.px[k]}px;overflow:hidden;text-overflow:ellipsis}${b} > *{max-width:100%;min-width:0}${b} > :not(.flex){overflow:hidden;text-overflow:ellipsis}${b} > * > .block{overflow:hidden;text-overflow:ellipsis}${b} > .flex > :last-child{min-width:0;overflow:hidden;text-overflow:ellipsis}${b} .truncate{max-width:100% !important}`;
  }).join('') : '';
  const css = hideCss + fitCss;
  // ---- thao tác hàng loạt: đọc chữ của các dòng đã chọn ngay trên bảng
  const grab = (): string[][] => {
    const t = ref.current;
    if (!t) return [];
    const cols = labels.map((_, i) => i).filter((i) => !vis.includes(i) && !(actCol && i === head.length - 1));
    const rows = [...(t.tBodies[0]?.rows ?? [])].filter((r) => sel.includes(r.getAttribute('data-rk') ?? '') && !r.querySelector('td[colspan]'));
    return [cols.map((i) => labels[i]), ...rows.map((r) => cols.map((i) => (r.cells[i + off]?.innerText ?? '').replace(/\s+/g, ' ').trim()))];
  };
  const copy = async () => { const g = grab(); try { await navigator.clipboard.writeText(g.map((r) => r.join('\t')).join('\n')); } catch { /* bỏ qua */ } };
  const csv = () => downloadCsv(`${(title ?? 'danh-sach').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-${todayISO()}.csv`, grab());
  const print = () => { const g = grab(); printHtml(docShell(title ?? 'Danh sách', `<h1>${esc(title ?? 'Danh sách')}</h1><table class="items"><thead><tr>${g[0].map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${g.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)); };
  const colBtn = 'inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.05)] hover:text-[rgb(var(--fg))]';
  const lastVis = Math.max(0, ...head.map((_, i) => i).filter((i) => !vis.includes(i)));
  const pick = head.length > 2 && colPick;
  return (
    <div className={cn('relative -mx-5', stack && 'max-md:mx-0')}>
      {css && <style>{css}</style>}
      {useSel && sel.length > 0 && (
        <div className="mx-5 mb-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-[rgb(var(--accent)/0.08)] px-3 py-1.5 text-[13px]" role="toolbar" aria-label="Thao tác với các dòng đã chọn">
          <span className="mr-1 font-medium">Đã chọn {sel.length}</span>
          {(bulk ?? []).map((b) => <button key={b.label} className={cn(btnGhost, btnSm, b.danger && 'text-[rgb(var(--danger-fg))]')} onClick={() => { b.run(sel); setPicked([]); }}>{b.icon && <b.icon className="h-3.5 w-3.5" aria-hidden />}{b.label}</button>)}
          <button className={cn(btnGhost, btnSm)} onClick={() => void copy()}><Copy className="h-3.5 w-3.5" aria-hidden />Sao chép</button>
          <button className={cn(btnGhost, btnSm)} onClick={csv}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>
          <button className={cn(btnGhost, btnSm)} onClick={print}><Printer className="h-3.5 w-3.5" aria-hidden />In</button>
          <button className={cn(btnGhost, btnSm, 'ml-auto')} onClick={() => setPicked([])}>Bỏ chọn</button>
        </div>
      )}
      {pick && (
        <div className="absolute right-3 z-[2] max-md:hidden" style={{ top: useSel && sel.length > 0 ? 50 : 6 }}>
          <button type="button" className={cn(colBtn, 'relative w-7 justify-center px-0')} onClick={() => setColOpen((v) => !v)} aria-expanded={colOpen} aria-label="Chọn cột hiển thị" title={vis.length ? `Chọn cột hiển thị (${head.length - vis.length - (actCol ? 1 : 0)}/${head.length - (actCol ? 1 : 0)} cột đang hiện)` : 'Chọn cột hiển thị'}><Columns3 className="h-3.5 w-3.5" aria-hidden />{vis.length ? <span data-cols-hidden={vis.length} className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" aria-hidden /> : null}</button>
          {colOpen && (
            <div className="absolute right-0 top-8 z-30 w-60 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-2 shadow-lg" onMouseLeave={() => setColOpen(false)}>
              <p className="px-1.5 pb-1 text-[12px] text-[rgb(var(--muted))]">Cột hiển thị{vis.length ? ` · ${vis.length} cột ẩn` : ''}</p>
              {labels.map((l, i) => (actCol && i === head.length - 1) || !l ? null : (
                <label key={i} className="flex items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-[rgb(var(--ink)/0.04)]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={!vis.includes(i)} disabled={!vis.includes(i) && head.length - vis.length - (actCol ? 1 : 0) <= 1} onChange={() => setHidden(vis.includes(i) ? vis.filter((x) => x !== i) : [...vis, i])} />{l}{optional?.includes(i) && <span className="ml-auto text-[11px] text-[rgb(var(--muted))]">thêm</span>}</label>
              ))}
              <div className="mt-1 flex gap-1 border-t border-[rgb(var(--line))] pt-1.5"><button className={cn(btnGhost, btnSm, 'flex-1 justify-center')} onClick={() => setHidden([])}>Hiện tất cả</button><button className={cn(btnGhost, btnSm, 'flex-1 justify-center')} onClick={() => setHidden(optional ?? [])}>Mặc định</button></div>
            </div>
          )}
        </div>
      )}
      <div ref={wrapRef} className={cn('overflow-x-auto', stack && 'max-md:overflow-visible')}>
      <table ref={ref} data-tid={tid} data-fit={fit ? fit.cols.join(',') || '-' : undefined} className={cn('dt w-full text-left text-[13.5px]', stack && 'dt-cards', showStt && 'dt-stt', actCol && 'dt-act')} style={{ minWidth: fit ? Math.min(minW + (showStt ? 56 : 0) + (useSel ? 40 : 0), fit.w) : minW + (showStt ? 56 : 0) + (useSel ? 40 : 0) }}>
        <thead className="text-[12.5px] text-[rgb(var(--muted))]">
          <tr className="border-b border-[rgb(var(--ink)/0.1)]">
            {showStt && <th className="w-14 whitespace-nowrap py-2.5 pl-5 pr-3 font-normal">STT</th>}
            {useSel && <th className="w-10 py-2.5 pl-5 pr-1 font-normal max-md:hidden"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={allOn} onChange={() => setPicked(allOn ? [] : keys)} aria-label="Chọn tất cả dòng" /></th>}
            {head.map((h0, i) => {
              // v61: cột thao tác ở cuối: tiêu đề "Thao tác" chỉ còn cho trình đọc màn hình, nút chọn cột nằm đúng chỗ tiêu đề
              // → cột thao tác không phải chừa thêm 52px, các cột chữ (tên, vai trò…) rộng hơn, ít bị rút gọn "…"
              const actHead = pick && actCol && i === head.length - 1 && lastVis === i;
              const h = actCol && i === head.length - 1 ? (actHead ? <span className="sr-only">Thao tác</span> : 'Thao tác') : h0;
              const can = sort?.sortable.includes(i);
              const on = can && sort?.sort?.col === i ? sort.sort.dir : 0;
              const Ico = on === 1 ? ArrowUp : on === -1 ? ArrowDown : ArrowUpDown;
              const padR = pick && i === lastVis && !actHead;
              return (
                <th key={i} aria-sort={on === 1 ? 'ascending' : on === -1 ? 'descending' : undefined}
                  // v59: chừa chỗ cho nút chọn cột nổi ở góc phải (quy tắc CSS th:last-child 16px từng đè pr-12 → nút che tên cột cuối)
                  style={padR ? { paddingRight: 52 } : actHead ? { minWidth: 56 } : undefined} className={cn('whitespace-nowrap py-2.5 font-normal', i === 0 && !showStt && !useSel ? 'pl-5 pr-3' : padR ? 'pl-3 pr-12' : 'px-3', (alignR.includes(i) || (actCol && i === head.length - 1)) && 'text-right')}>
                  {can ? <button type="button" onClick={() => sort!.onSort(i)} className={cn('group inline-flex items-center gap-1 hover:text-[rgb(var(--fg))]', on !== 0 && 'text-[rgb(var(--fg))]', alignR.includes(i) && 'flex-row-reverse')}>{h}<Ico className={cn('h-3 w-3', on ? 'opacity-100' : 'opacity-40 group-hover:opacity-80')} aria-hidden /></button> : h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody style={showStt ? { counterReset: `stt ${stt || 0}` } : undefined}>{body}</tbody>
        {foot && (
          <tfoot className="max-md:hidden">
            <tr data-table-foot className="border-t border-[rgb(var(--ink)/0.1)] text-[13.5px] font-medium">
              {showStt && <td className="py-2.5 pl-5 pr-3" />}
              {useSel && <td className="py-2.5 pl-5 pr-1" />}
              {head.map((_, i) => <td key={i} className={cn('whitespace-nowrap py-2.5', i === 0 && !showStt && !useSel ? 'pl-5 pr-3' : i === lastVis && pick && !(actCol && i === head.length - 1) ? 'pl-3 pr-12' : 'px-3', alignR.includes(i) && 'text-right tabular-nums')}>{foot[i] ?? null}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, tone }: { value: number; max: number; tone?: string }) {
  const p = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--line))]">
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: tone === C.orange || (!tone && p >= 70 && p < 90) ? GRAD : tone ?? (p >= 90 ? C.red : C.teal) }} />
    </div>
  );
}

