'use client';

import { type Dispatch, type DragEvent, type ReactNode, type SetStateAction, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Wallet, X } from 'lucide-react';
import { BRAND, btnGhost, btnPrimary, C, digits, GRAD, inputCls, overlaySeq, overlayStack, overlaySubs, overlayTop, portal, stickySave, stickyStore, VIEW_META } from '../lib/core';
import type { SortState, SortVal, TableSort, Tone, ViewKind } from '../lib/types';
import { cn } from '../lib/utils';

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
  // v40: trạng thái = chấm màu + chữ (không ô nền màu). Teal = đạt / xong, Cam = chờ / đang làm, Đỏ = quá hạn / lỗi, Xanh = đã gửi
  const dot: Record<Tone, string> = { muted: 'bg-[rgb(var(--faint))]', orange: 'bg-[rgb(var(--accent))]', teal: 'bg-[rgb(var(--success))]', red: 'bg-[rgb(var(--danger))]', blue: 'bg-[rgb(var(--secondary))]' };
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]', tone === 'red' ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--fg2))]')}><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot[tone])} aria-hidden />{children}</span>;
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
  return (
    <div className="kpi flex min-w-0 flex-col gap-0.5 border-l border-[rgb(var(--ink)/0.08)] py-0.5 pl-4 pr-2">
      <p className="min-w-0 truncate text-[12.5px] text-[rgb(var(--muted))]">{label}</p>
      <p className={cn('truncate text-[22px] font-medium leading-7 tabular-nums', tone)}>{value}</p>
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
  const side = aside ? <div className="hidden shrink-0 lg:block">{aside}</div> : null;
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
      <div className="flex min-w-0 flex-1 gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={value === t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-1 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.5)]',
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
export function MoneyInput({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="relative">
      <input
        className={cn(inputCls, 'pr-8 tabular-nums')}
        inputMode="numeric"
        disabled={disabled}
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

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ov = useOverlay();
  useEscClose(ov.id, onClose);
  return portal(
    <div className={cn('fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:p-4', !ov.top && 'invisible')} aria-hidden={!ov.top || undefined} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 motion-safe:animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <div className={cn('relative flex max-h-[92vh] w-full flex-col rounded-t-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-2xl sm:rounded motion-safe:animate-[popIn_.18s_ease-out]', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <header className="flex items-center justify-between gap-3 border-b border-[rgb(var(--line))] px-5 py-4">
          <h2 className="text-base font-semibold text-[rgb(var(--fg))]">{title}</h2>
          <button className={cn(btnGhost, 'p-1.5')} onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
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

/** Hình minh họa nét mảnh cho trạng thái trống (line-art, theo màu thương hiệu) */
export function EmptyArt({ kind }: { kind: 'search' | 'box' | 'calendar' | 'doc' | 'ledger' | 'inbox' }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const accent = { fill: 'none', stroke: 'url(#emptyGrad)', strokeWidth: 2, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="0 0 120 84" width="120" height="84" className="text-[rgb(var(--line))]" aria-hidden>
      <defs><linearGradient id="emptyGrad" x1="0" x2="1"><stop offset="0" stopColor={BRAND.o1} /><stop offset=".55" stopColor={BRAND.o2} /><stop offset="1" stopColor={BRAND.o3} /></linearGradient></defs>
      <path d="M14 74h92" {...stroke} strokeDasharray="2 5" />
      {kind === 'search' && <><rect x="26" y="14" width="50" height="46" rx="3" {...stroke} /><path d="M34 26h30M34 34h22M34 42h26" {...stroke} /><circle cx="78" cy="50" r="12" {...accent} /><path d="M87 59l10 10" {...accent} /><circle cx="78" cy="50" r="4" fill={BRAND.blue} opacity=".8" /></>}
      {kind === 'box' && <><path d="M30 34l30-14 30 14v28L60 76 30 62z" {...stroke} /><path d="M30 34l30 14 30-14M60 48v28" {...stroke} /><path d="M45 27l30 14" {...accent} /><circle cx="60" cy="48" r="3" fill={BRAND.blue} /></>}
      {kind === 'calendar' && <><rect x="28" y="18" width="64" height="52" rx="3" {...stroke} /><path d="M28 32h64M42 12v12M78 12v12" {...stroke} /><path d="M40 44h8M56 44h8M72 44h8M40 56h8M56 56h8" {...stroke} /><rect x="70" y="52" width="12" height="10" rx="2" {...accent} /></>}
      {kind === 'doc' && <><path d="M36 10h34l14 14v50H36z" {...stroke} /><path d="M70 10v14h14" {...stroke} /><path d="M44 38h30M44 46h30M44 54h18" {...stroke} /><path d="M44 30h16" {...accent} /><circle cx="78" cy="62" r="3" fill={BRAND.blue} /></>}
      {kind === 'ledger' && <><rect x="30" y="12" width="60" height="60" rx="3" {...stroke} /><path d="M40 26h40M40 36h40M40 46h40M40 56h24" {...stroke} /><path d="M66 56h14" {...accent} /><path d="M58 12v60" {...stroke} strokeDasharray="2 3" /></>}
      {kind === 'inbox' && <><path d="M24 44l12-26h48l12 26v24H24z" {...stroke} /><path d="M24 44h22l4 8h20l4-8h22" {...stroke} /><path d="M48 30h24" {...accent} /><circle cx="60" cy="38" r="3" fill={BRAND.blue} /></>}
    </svg>
  );
}

/** Trạng thái trống: minh họa + thông điệp rõ ràng + nút hành động (nếu có) */
export function EmptyState({ text, hint, art, action, onAction, compact }: { text: ReactNode; hint?: ReactNode; art?: 'search' | 'box' | 'calendar' | 'doc' | 'ledger' | 'inbox'; action?: string; onAction?: () => void; compact?: boolean }) {
  const kind = art ?? 'box';
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-10')}>
      {!compact && <EmptyArt kind={kind} />}
      <p className="max-w-md text-sm font-medium text-[rgb(var(--fg2))]">{text}</p>
      {hint && <p className="max-w-md text-xs text-[rgb(var(--muted))]">{hint}</p>}
      {action && onAction && <button className={cn(btnPrimary, 'mt-1')} onClick={onAction}><Plus className="h-4 w-4" aria-hidden />{action}</button>}
    </div>
  );
}

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
export function Table({ head, children, minW = 760, right, sort, stack = true, stt = 0 }: { head: ReactNode[]; children: ReactNode; minW?: number; right?: number[]; sort?: TableSort; stack?: boolean; stt?: number | false }) {
  const showStt = stt !== false && stack && head[0] !== 'STT';
  const lastH = head[head.length - 1];
  const actCol = head.length > 1 && (lastH === '' || lastH === 'Thao tác');
  const ref = useRef<HTMLTableElement>(null);
  const [auto, setAuto] = useState<number[]>([]);
  useEffect(() => {
    const t = ref.current;
    if (t && stack) {
      const labels = [...(t.tHead?.rows[0]?.cells ?? [])].slice(showStt ? 1 : 0).map((c) => (c.textContent ?? '').trim());
      [...(t.tBodies[0]?.rows ?? [])].forEach((r) => { if (r.cells.length === labels.length) [...r.cells].forEach((c, i) => { if (c.getAttribute('data-label') !== labels[i]) c.setAttribute('data-label', labels[i]); }); });
    }
    const rows = ref.current?.tBodies[0]?.rows;
    const row = rows ? [...rows].find((r) => r.cells.length === head.length) : undefined;
    if (!row) return;
    const r = [...row.cells].flatMap((c, i) => (c.classList.contains('text-right') ? [i] : []));
    setAuto((p) => (p.join() === r.join() ? p : r));
  });
  const alignR = right ?? auto;
  return (
    <div className={cn('-mx-5 overflow-x-auto', stack && 'max-md:mx-0 max-md:overflow-visible')}>
      <table ref={ref} className={cn('dt w-full text-left text-[13.5px]', stack && 'dt-cards', showStt && 'dt-stt', actCol && 'dt-act')} style={{ minWidth: minW + (showStt ? 56 : 0) }}>
        <thead className="text-[12.5px] text-[rgb(var(--muted))]">
          <tr className="border-b border-[rgb(var(--ink)/0.1)]">
            {showStt && <th className="w-14 whitespace-nowrap py-2.5 pl-5 pr-3 font-normal">STT</th>}
            {head.map((h0, i) => {
              const h = actCol && i === head.length - 1 ? 'Thao tác' : h0;
              const can = sort?.sortable.includes(i);
              const on = can && sort?.sort?.col === i ? sort.sort.dir : 0;
              const Ico = on === 1 ? ArrowUp : on === -1 ? ArrowDown : ArrowUpDown;
              return (
                <th key={i} aria-sort={on === 1 ? 'ascending' : on === -1 ? 'descending' : undefined} className={cn('whitespace-nowrap py-2.5 font-normal', i === 0 && !showStt ? 'pl-5 pr-3' : i === head.length - 1 ? 'pl-3 pr-5' : 'px-3', (alignR.includes(i) || (actCol && i === head.length - 1)) && 'text-right')}>
                  {can ? <button type="button" onClick={() => sort!.onSort(i)} className={cn('group inline-flex items-center gap-1 hover:text-[rgb(var(--fg))]', on !== 0 && 'text-[rgb(var(--fg))]', alignR.includes(i) && 'flex-row-reverse')}>{h}<Ico className={cn('h-3 w-3', on ? 'opacity-100' : 'opacity-40 group-hover:opacity-80')} aria-hidden /></button> : h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody style={showStt ? { counterReset: `stt ${stt || 0}` } : undefined}>{children}</tbody>
      </table>
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

