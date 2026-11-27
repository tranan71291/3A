'use client';

import { type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { KitIcon } from './page-header';
import { kCard } from './tokens';

// =====================================================================
//  v59 StatKpiCard — thẻ chỉ số cho trang Tổng quan / báo cáo (không đặt trên đầu trang danh sách, theo v49)
//  Nhãn · số lớn (Archivo, tabular-nums) · thay đổi so với kỳ trước. Không sparkline, không trang trí.
// =====================================================================

export function StatKpiCard({ label, value, unit, icon: Icon, delta, deltaLabel = 'so với kỳ trước', lowerIsBetter, hint, tone, onClick, active }: {
  label: string;
  value: ReactNode;
  /** Đơn vị nhỏ sau số (đ, đơn, %) */
  unit?: string;
  icon?: KitIcon;
  /** % thay đổi; null / undefined = không so sánh */
  delta?: number | null;
  deltaLabel?: string;
  /** Chỉ số giảm là tốt (công nợ quá hạn, hủy đơn): đảo màu tăng / giảm */
  lowerIsBetter?: boolean;
  /** Dòng phụ khi không có so sánh */
  hint?: ReactNode;
  /** Số mang nghĩa cảnh báo (quá hạn, âm quỹ) */
  tone?: 'default' | 'danger' | 'accent';
  /** Bấm để lọc / mở chi tiết */
  onClick?: () => void;
  active?: boolean;
}) {
  const has = delta !== undefined && delta !== null && Number.isFinite(delta);
  const good = has && (lowerIsBetter ? delta! < 0 : delta! > 0);
  const flat = has && Math.abs(delta!) < 0.05;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[12.5px] leading-5 text-[rgb(var(--muted))]">{label}</p>
        {Icon && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgb(var(--ink)/0.05)] text-[rgb(var(--fg2))]" aria-hidden><Icon className="h-4 w-4" /></span>}
      </div>
      <p className={cn('font-archivo mt-1 flex min-w-0 items-baseline gap-1 text-[26px] font-semibold leading-8 ui-num', tone === 'danger' ? 'text-[rgb(var(--danger-fg))]' : tone === 'accent' ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--fg))]')}>
        <span className="truncate">{value}</span>{unit && <span className="shrink-0 font-sans text-[13px] font-normal text-[rgb(var(--muted))]">{unit}</span>}
      </p>
      {has ? (
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] leading-5">
          <span data-delta={flat ? 'flat' : good ? 'good' : 'bad'} className={cn('inline-flex shrink-0 items-center gap-0.5 font-medium ui-num', flat ? 'text-[rgb(var(--fg2))]' : good ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>
            {!flat && (delta! > 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />)}
            {delta! > 0 ? '+' : delta! < 0 ? '−' : ''}{Math.abs(delta!).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%
          </span>
          <span className="truncate text-[rgb(var(--muted))]">{deltaLabel}</span>
        </p>
      ) : hint ? <p className="mt-1 truncate text-[12px] leading-5 text-[rgb(var(--muted))]">{hint}</p> : null}
    </>
  );
  const cls = cn(kCard, 'flex min-w-0 flex-col p-4 text-left', active && 'border-[rgb(var(--fg)/0.35)]');
  return onClick
    ? <button type="button" data-kpi className={cn(cls, 'ui-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.5)]')} onClick={onClick} aria-pressed={active}>{body}</button>
    : <div data-kpi className={cls}>{body}</div>;
}
