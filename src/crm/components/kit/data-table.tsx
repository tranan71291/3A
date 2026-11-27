'use client';

import { type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Pagination, usePaged } from '../controls';
import { Table, useSort } from '../ui';
import { inputBase } from '../../lib/core';
import type { SortVal, TableBulk } from '../../lib/types';
import { cn } from '../../lib/utils';
import { EmptyState } from './empty-state';
import { FilterChips, FilterPopover, type ActiveFilter } from './filter-popover';
import { kCard } from './tokens';

// =====================================================================
//  v59 SmartDataTable — bảng chuẩn v49 dựng trên Table dùng chung:
//  - mỗi trường 1 cột, mỗi ô 1 dòng (chữ dài cắt "…", rê chuột xem đủ); không cuộn ngang ở 1440px: bớt cột bằng nút Columns3
//  - cột số / tiền: căn phải + tabular-nums; dòng tổng cuối bảng đúng cột
//  - bộ lọc gom vào nút phễu có số đếm, mở bảng nhỏ ngay dưới nút; nhãn bộ lọc đang bật có nút × để bỏ
//  - phân trang gọn ở chân bảng; trống thì hiện EmptyState có hướng dẫn
// =====================================================================

export type DataCol<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Cột số / tiền: căn phải, chữ số đều */
  numeric?: boolean;
  /** Cột thêm: mặc định ẩn, bật trong bộ chọn cột */
  optional?: boolean;
  /** Giá trị để sắp xếp (bỏ trống = không sắp xếp cột này) */
  sort?: (row: T) => SortVal;
  /** Chữ đầy đủ khi rê chuột (ô bị cắt "…") */
  title?: (row: T) => string | undefined;
  /** Lớp thêm cho ô (độ rộng tối đa, màu chữ phụ…) */
  className?: string;
};

export { FilterPopover, FilterChips, type ActiveFilter } from './filter-popover';

export function SmartDataTable<T>({
  id, title, rows, columns, rowKey, onRowClick, search, filter, toolbar, pageSize = 20, unit = 'dòng', empty, bulk, minW = 640, totals, select,
}: {
  /** Khóa ổn định: nhớ cột ẩn, sắp xếp */
  id: string;
  /** Tên bảng (xuất CSV, in) */
  title?: string;
  rows: T[];
  columns: DataCol<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  search?: { value: string; onChange: (v: string) => void; placeholder: string };
  filter?: { count: number; panel: ReactNode; active?: ActiveFilter[]; onReset?: () => void };
  /** Nút phụ bên phải thanh công cụ (Xuất Excel…) */
  toolbar?: ReactNode;
  pageSize?: number;
  /** Đơn vị đếm ở chân bảng: "đơn", "khách hàng" */
  unit?: string;
  /** Nội dung khi không có dòng (mặc định EmptyState theo bộ lọc) */
  empty?: ReactNode;
  bulk?: TableBulk[];
  minW?: number;
  /** Dòng tổng: theo key cột */
  totals?: Partial<Record<string, ReactNode>>;
  select?: boolean;
}) {
  const spec: Record<number, (r: T) => SortVal> = {};
  columns.forEach((c, i) => { if (c.sort) spec[i] = c.sort; });
  const { rows: sorted, th } = useSort(`sdt.${id}`, rows, spec);
  const paged = usePaged(sorted, pageSize);
  const right = columns.flatMap((c, i) => (c.numeric ? [i] : []));
  const optional = columns.flatMap((c, i) => (c.optional ? [i] : []));
  const filtered = (filter?.count ?? 0) > 0 || !!search?.value.trim();
  const hasBar = !!search || !!filter || !!toolbar;
  return (
    <section data-smart-table={id} className={cn(kCard, 'px-5 pb-3', hasBar ? 'pt-4' : 'pt-5')}>
      {hasBar && (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {search && (
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden />
                <input type="search" className={cn(inputBase, 'h-8 w-full py-1 pl-9 text-[13.5px]')} value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder} aria-label={search.placeholder} spellCheck={false} autoComplete="off" />
              </div>
            )}
            {filter && <FilterPopover count={filter.count} onReset={filter.onReset}>{filter.panel}</FilterPopover>}
            {filter?.active && <FilterChips items={filter.active} />}
          </div>
          {toolbar && <div className="flex shrink-0 items-center gap-2">{toolbar}</div>}
        </div>
      )}
      {rows.length === 0 ? (
        empty ?? (filtered
          ? <EmptyState compact art="search" text="Không có dòng nào khớp bộ lọc" hint="Thử bỏ bớt điều kiện lọc hoặc đổi từ khóa tìm kiếm." secondary={filter?.onReset ? { label: 'Xóa bộ lọc', onClick: () => { filter.onReset!(); search?.onChange(''); } } : undefined} />
          : <EmptyState compact text={`Chưa có ${unit}`} />)
      ) : (
        <>
          <Table id={`sdt-${id}`} title={title} head={columns.map((c) => c.label)} right={right} optional={optional} sort={th} minW={minW} stt={(paged.page - 1) * pageSize} bulk={bulk} select={select}
            foot={totals ? columns.map((c) => totals[c.key] ?? null) : undefined}>
            {paged.slice.map((r) => {
              const k = rowKey(r);
              return (
                <tr key={k} data-row={k} className={cn('border-b border-[rgb(var(--ink)/0.05)] last:border-0', onRowClick && 'cursor-pointer')}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(r); } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}>
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn('px-3 py-2.5', i === 0 && 'pl-5', c.numeric && 'text-right tabular-nums', c.className)} title={c.title?.(r)}>{c.render(r)}</td>
                  ))}
                </tr>
              );
            })}
          </Table>
          {paged.pages > 1 || paged.total > 10 ? <Pagination paged={paged} unit={unit} /> : <p className="pt-3 text-[13px] tabular-nums text-[rgb(var(--muted))]">{paged.total} {unit}</p>}
        </>
      )}
    </section>
  );
}
