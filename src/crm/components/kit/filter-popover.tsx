'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Filter, X } from 'lucide-react';
import { useOutsideClose } from '../../app/header';
import { cn } from '../../lib/utils';
import { kCountBadge, kIconBtn, kPop } from './tokens';

// =====================================================================
//  v59 Bộ lọc chuẩn v49: nút icon phễu có số đếm, mở bảng nhỏ ngay dưới nút (không phải lớp phủ toàn màn hình);
//  nhãn bộ lọc đang áp dụng có × để bỏ. Dùng cho SmartDataTable và FilterBar của các module.
// =====================================================================

export type ActiveFilter = { key: string; label: string; onClear: () => void; /** chú thích đầy đủ khi nhãn rút gọn */ title?: string };

export function FilterPopover({ count, children, onReset, label = 'Bộ lọc', align = 'left', footer, width = 'w-80' }: {
  count: number;
  children: ReactNode;
  onReset?: () => void;
  label?: string;
  align?: 'left' | 'right';
  /** Nút thêm ở chân bảng lọc (Lọc nâng cao…) */
  footer?: ReactNode;
  /** Độ rộng bảng lọc (lớp Tailwind) */
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus({ preventScroll: true }); }, [open]);
  return (
    <div className="relative shrink-0" ref={ref}>
      <button type="button" data-filter-btn className={cn(kIconBtn, count > 0 && 'border-[rgb(var(--fg)/0.35)] text-[rgb(var(--fg))]')} onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog" aria-expanded={open} aria-label={count ? `${label}, ${count} đang bật` : label} title={label}>
        <Filter className="h-4 w-4" aria-hidden />
        {count > 0 && <span className={kCountBadge} data-filter-count={count} aria-hidden>{count}</span>}
      </button>
      {open && (
        <div ref={panel} role="dialog" aria-label={label} data-filter-panel onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } }}
          className={cn(kPop, 'absolute top-full z-40 mt-2 max-h-[75vh] max-w-[calc(100vw-2rem)] overflow-y-auto p-4 motion-safe:animate-[popIn_.15s_ease-out]', width, align === 'right' ? 'right-0' : 'left-0')}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[13.5px] font-medium">{label}</p>
            {onReset && count > 0 && <button type="button" className="text-[12.5px] text-[rgb(var(--secondary-fg))] hover:underline" onClick={onReset}>Đặt lại</button>}
          </div>
          <div className="space-y-3 [&_input:not([type=checkbox]):not([type=radio])]:w-full [&_select]:w-full">{children}</div>
          {footer && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--border))] pt-3">{footer}</div>}
        </div>
      )}
    </div>
  );
}

/** Nhãn bộ lọc đang áp dụng, bấm × để bỏ */
export function FilterChips({ items }: { items: ActiveFilter[] }) {
  if (!items.length) return null;
  return (
    <ul className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Bộ lọc đang áp dụng">
      {items.map((f) => (
        <li key={f.key} data-filter-tag className="inline-flex h-7 items-center gap-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--ink)/0.03)] pl-2.5 pr-1 text-[12.5px] text-[rgb(var(--fg2))]">
          <span className="max-w-[220px] truncate" title={f.title}>{f.label}</span>
          <button type="button" className="grid h-5 w-5 place-items-center rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.08)] hover:text-[rgb(var(--fg))]" onClick={f.onClear} aria-label={`Bỏ lọc ${f.label}`}><X className="h-3.5 w-3.5" aria-hidden /></button>
        </li>
      ))}
    </ul>
  );
}
