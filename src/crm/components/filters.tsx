'use client';

import { Children, cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Field } from './ui';
import { FilterChips, FilterPopover, type ActiveFilter } from './kit/filter-popover';
import { StatusBar, StatusScope } from './kit/status-filter';
import { btnGhost, inputBase, inputCls, inRangeOf, iso, useApp } from '../lib/core';
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
  /** Bộ lọc trạng thái 2 lớp (ChipFilter / StatusBar): thanh nhanh ở hàng công cụ, danh sách đủ trong phễu */
  chips?: ReactNode;
}) {
  const { departments } = useApp();
  // v59 lọc 2 lớp: số trạng thái chọn trong phễu do bộ lọc trạng thái báo về, để hiện trên nút phễu và Đặt lại
  const [stN, setStN] = useState<Record<string, number>>({});
  const clears = useRef<Record<string, () => void>>({});
  const bar = useMemo(() => ({ mode: 'bar' as const, register: (k: string, n: number, clear: () => void) => { clears.current[k] = clear; setStN((p) => (p[k] === n ? p : { ...p, [k]: n })); } }), []);
  const panel = useMemo(() => ({ mode: 'panel' as const }), []);
  // các phân hệ truyền cùng 1 trạng thái qua cả status (ô chọn) lẫn chips: có chips thì chỉ dùng bộ lọc 2 lớp, không lặp ô chọn
  const stSel = chips ? undefined : onStatus;
  const nSt = Object.values(stN).reduce((s, x) => s + x, 0);
  const active = (onDept && dept && dept !== 'ALL' ? 1 : 0) + (stSel && status && status !== 'ALL' ? 1 : 0) + advancedCount + extraActive + nSt;
  const hasFilters = !!onDept || !!onStatus || !!children || !!onAdvanced || !!chips;
  const sel = cn(inputCls, 'w-full');
  const deptName = departments.find((d) => d.code === dept)?.short ?? dept;
  const stName = statusOptions?.find((o) => o.value === status)?.label ?? status;
  const tags: ActiveFilter[] = [
    ...(onDept && dept && dept !== 'ALL' ? [{ key: 'dept', label: `Phòng: ${deptName}`, onClear: () => onDept('ALL') }] : []),
    ...(stSel && status && status !== 'ALL' ? [{ key: 'st', label: `Trạng thái: ${stName}`, onClear: () => stSel('ALL') }] : []),
  ];
  const reset = tags.length || nSt ? () => { tags.forEach((t) => t.onClear()); Object.values(clears.current).forEach((f) => f()); } : undefined;
  // v59 (chuẩn v49): [Tìm kiếm][phễu (n)][Tất cả · trạng thái chính · Thêm ▾][thẻ đang lọc ×] … [thao tác]
  return (
    <div>
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className={cn('flex min-w-[200px] items-center gap-2', chips ? 'lg:contents' : 'flex-1')}>
        <div className={cn('relative', chips ? 'flex-1 lg:w-[240px] lg:flex-none xl:w-[280px]' : 'w-full lg:w-[280px] lg:flex-none')}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden />
          <input className={cn(inputBase, 'h-8 w-full bg-[rgb(var(--surface))] py-1 pl-9 text-[13.5px]')} value={q} onChange={(e) => onQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
        </div>
        {hasFilters && (
          <FilterPopover count={active} onReset={reset}
            footer={onAdvanced ? <button type="button" className={cn(btnGhost, 'w-full justify-center py-1.5 text-[13px]')} onClick={onAdvanced}><SlidersHorizontal className="h-4 w-4" aria-hidden />Lọc nâng cao{advancedCount > 0 && <span className="ml-1 tabular-nums text-[rgb(var(--accent-fg))]">{advancedCount}</span>}</button> : undefined}>
            {chips && <StatusScope.Provider value={panel}>{chips}</StatusScope.Provider>}
            {onDept && (
              <Field label="Phòng ban">
                <select className={sel} value={dept} onChange={(e) => onDept(e.target.value)}>
                  <option value="ALL">Tất cả phòng ban</option>
                  {departments.filter((d) => d.active).map((d) => <option key={d.code} value={d.code}>{d.short}</option>)}
                </select>
              </Field>
            )}
            {stSel && statusOptions && (
              <Field label="Trạng thái">
                <select className={sel} value={status} onChange={(e) => stSel(e.target.value)}>
                  <option value="ALL">{statusLabel}</option>
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            )}
            {children && <div className="flex flex-col gap-3">{labeled(children)}</div>}
          </FilterPopover>
        )}
        {!chips && <FilterChips items={tags} />}
      </div>
      {chips && (
        <StatusScope.Provider value={bar}>
          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-1">{chips}<FilterChips items={tags} /></div>
        </StatusScope.Provider>
      )}
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 lg:ml-auto">{actions}</div>}
    </div>
    </div>
  );
}

/** v59: ô chọn / ô nhập để trần trong bảng phễu → thêm nhãn (lấy từ aria-label) và rộng đủ khung, cho các ô lọc đồng đều */
function labeled(node: ReactNode): ReactNode {
  return Children.map(node, (ch) => {
    if (!isValidElement(ch)) return ch;
    if (ch.type === Fragment) return labeled((ch.props as { children?: ReactNode }).children);
    const pr = ch.props as { 'aria-label'?: string; type?: string };
    if ((ch.type === 'select' || ch.type === 'input') && pr['aria-label'] && pr.type !== 'checkbox' && pr.type !== 'radio') {
      return <Field label={pr['aria-label']}>{cloneElement(ch as ReactElement<{ className?: string }>, { className: cn(inputCls, 'w-full') })}</Field>;
    }
    return ch;
  });
}

/**
 * Lọc trạng thái / nhóm 2 lớp (v59, xem kit/status-filter): [Tất cả] + tối đa 5 trạng thái chính dạng nút bo tròn, phần còn lại
 * trong "Thêm ▾" (desktop) hoặc cuộn ngang (mobile); trong phễu có đủ trạng thái, chọn nhiều qua `multi` / `onMulti`.
 * `color` giữ cho tương thích, không còn hiện chấm màu.
 */
export function ChipFilter<T extends string>({ options, value, onChange, allLabel = 'Tất cả', total, label, multi, onMulti, main, funnel }: {
  options: { value: T; label: string; short?: string; count?: number; color?: string }[];
  value: T | 'ALL';
  onChange: (v: T | 'ALL') => void;
  allLabel?: string;
  total?: number;
  /** Tên bộ lọc trong phễu: Trạng thái (mặc định), Loại yêu cầu, Danh mục… */
  label?: string;
  multi?: readonly T[];
  onMulti?: (v: T[]) => void;
  main?: number | readonly T[];
  funnel?: 'auto' | boolean;
}) {
  return <StatusBar<T> options={options.map((o) => ({ value: o.value, label: o.label, short: o.short, count: o.count }))} value={value} onChange={onChange} allLabel={allLabel} total={total} label={label} multi={multi} onMulti={onMulti} main={main} funnel={funnel} />;
}

export { StatusBar, stMatch } from './kit/status-filter';

