'use client';

import { type ReactNode, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Field, SideSheet } from './ui';
import { btnGhost, btnPrimary, inputCls, inRangeOf, iso, useApp } from '../lib/core';
import type { Claim, DateRange, Opt, Period } from '../lib/types';
import { cn } from '../lib/utils';

export function periodRange(p: Period, fy: number): DateRange {
  if (p === 'YEAR') return { from: `${fy}-01-01`, to: `${fy}-12-31` };
  const q = Number(p[1]) - 1;
  return { from: iso(new Date(fy, q * 3, 1)), to: iso(new Date(fy, q * 3 + 3, 0)) };
}

export function useInRange() {
  const { range } = useApp();
  return inRangeOf(range);
}

/** "12/09 – 12/09/2026" -> ngày kết thúc chương trình */
export function claimDate(c: Claim): Date | null {
  const m = c.period.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}

/**
 * Thanh lọc dùng chung. Khoảng thời gian chọn ở tiêu đề trang (DateRangePicker).
 * Mobile: chỉ hiện ô tìm kiếm + nút "Lọc" (có số bộ lọc đang bật), bấm để mở các ô chọn.
 */
export function FilterBar({
  q, onQ, placeholder, dept, onDept, status, onStatus, statusOptions, statusLabel = 'Tất cả trạng thái', children, onAdvanced, advancedCount = 0, extraActive = 0, actions, chips,
}: {
  q: string; onQ: (v: string) => void; placeholder: string;
  dept?: string; onDept?: (v: string) => void; status?: string; onStatus?: (v: string) => void; statusOptions?: Opt[]; statusLabel?: string; children?: ReactNode;
  onAdvanced?: () => void; advancedCount?: number; extraActive?: number;
  /** Nút thao tác ở cuối hàng (vd. ⚡ Duyệt chọn, + Thêm mới) */
  actions?: ReactNode;
  /** Hàng tag lọc nhanh bên dưới (ChipFilter) */
  chips?: ReactNode;
}) {
  const { departments } = useApp();
  const [open, setOpen] = useState(false);
  const active = (onDept && dept && dept !== 'ALL' ? 1 : 0) + (onStatus && status && status !== 'ALL' ? 1 : 0) + advancedCount + extraActive;
  const hasFilters = !!onDept || !!onStatus || !!children || !!onAdvanced;
  const sel = cn(inputCls, 'w-full py-2.5');
  // Thanh công cụ tối giản: [Tìm kiếm ........][Bộ lọc (n)][thao tác]; mọi ô lọc nằm trong khung trượt cạnh phải
  return (
    <div className="space-y-2">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex min-w-[200px] flex-1 gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden />
          <input className={cn(inputCls, 'bg-[rgb(var(--surface))] py-2 pl-9')} value={q} onChange={(e) => onQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        </div>
        {hasFilters && (
          <button className={cn(btnGhost, 'relative shrink-0 px-3.5 py-2', active > 0 && 'border-[rgb(var(--fg)/0.4)] font-medium')} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Bộ lọc${active ? `, ${active} đang bật` : ''}`}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden /><span>Bộ lọc{active > 0 ? ` (${active})` : ''}</span>
          </button>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}
    </div>
    {chips && <div>{chips}</div>}
    {open && (
      <SideSheet title="Bộ lọc" sub={active ? `${active} điều kiện đang áp dụng, kết quả cập nhật ngay` : 'Chọn điều kiện, kết quả cập nhật ngay'} onClose={() => setOpen(false)}
        footer={<>
          {(onDept || onStatus) && <button className={cn(btnGhost, 'mr-auto')} onClick={() => { onDept?.('ALL'); onStatus?.('ALL'); }}><X className="h-4 w-4" aria-hidden />Xóa phòng ban / trạng thái</button>}
          <button className={btnPrimary} onClick={() => setOpen(false)}>Xem kết quả</button>
        </>}>
        <div className="space-y-4 [&_select]:w-full [&_select]:max-w-none [&_input]:max-w-none [&>div>*]:w-full">
          {onDept && (
            <Field label="Phòng ban">
              <select className={sel} value={dept} onChange={(e) => onDept(e.target.value)}>
                <option value="ALL">Tất cả phòng ban</option>
                {departments.filter((d) => d.active).map((d) => <option key={d.code} value={d.code}>{d.short}</option>)}
              </select>
            </Field>
          )}
          {onStatus && statusOptions && (
            <Field label="Trạng thái">
              <select className={sel} value={status} onChange={(e) => onStatus(e.target.value)}>
                <option value="ALL">{statusLabel}</option>
                {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          )}
          {children && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">Điều kiện khác</p>
              <div className="flex flex-col gap-3">{children}</div>
            </div>
          )}
          {onAdvanced && (
            <button className={cn(btnGhost, 'w-full justify-center py-2.5')} onClick={() => { setOpen(false); onAdvanced(); }}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden />Lọc nâng cao{advancedCount > 0 && <span className="rounded-full g-brand px-1.5 text-[11px] font-semibold text-[rgb(var(--on-accent))]">{advancedCount}</span>}
            </button>
          )}
        </div>
      </SideSheet>
    )}
    </div>
  );
}

/** Tag lọc nhanh: (• Tất cả 9) (• Báo giá 2) (• Công tác 5)... — bấm lại để bỏ lọc */
export function ChipFilter<T extends string>({ options, value, onChange, allLabel = 'Tất cả', total }: { options: { value: T; label: string; count?: number; color?: string }[]; value: T | 'ALL'; onChange: (v: T | 'ALL') => void; allLabel?: string; total?: number }) {
  const chip = (on: boolean, label: string, count: number | undefined, color: string | undefined, onClick: () => void, key: string) => (
    <button key={key} type="button" onClick={onClick} aria-pressed={on}
      className={cn('flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[13px] transition-colors', on ? 'border-[rgb(var(--ink)/0.14)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] shadow-sm' : 'border-transparent text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>
      {color && <i className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}{label}{count !== undefined && <span className="font-mono text-[11.5px] font-normal text-[rgb(var(--muted))]">{count}</span>}
    </button>
  );
  return (
    <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Lọc nhanh">
      {chip(value === 'ALL', allLabel, total, undefined, () => onChange('ALL'), '__all')}
      {options.map((o) => chip(value === o.value, o.label, o.count, o.color, () => onChange(value === o.value ? 'ALL' : o.value), o.value))}
    </div>
  );
}

