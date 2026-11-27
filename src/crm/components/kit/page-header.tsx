'use client';

import { Fragment, type ReactNode } from 'react';
import { ChevronRight, type Wallet } from 'lucide-react';
import { RowMenu } from '../controls';
import { btnGhost, btnPrimary } from '../../lib/core';
import { cn } from '../../lib/utils';

// =====================================================================
//  v59 PageHeader — đầu trang: đường dẫn · tiêu đề (+ nhãn trạng thái) · 1 nút chính · nhóm nút phụ
//  Quy tắc: mỗi trang đúng 1 nút chính (primary). Nút phụ tối đa 2 nút hiện ra, phần còn lại vào menu ⋯.
// =====================================================================

/** Biểu tượng lucide (cùng kiểu với mọi nút trong hệ thống) */
export type KitIcon = typeof Wallet;

export type PageAction = {
  label: string;
  onClick: () => void;
  icon?: KitIcon;
  disabled?: boolean;
  /** Lý do khi nút bị khóa, hoặc gợi ý khi rê chuột */
  title?: string;
  danger?: boolean;
};

export type Crumb = { label: string; onClick?: () => void };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Đường dẫn" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-[12.5px] leading-5 text-[rgb(var(--muted))]">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />}
              <li className={cn('min-w-0', last ? 'truncate text-[rgb(var(--fg2))]' : 'shrink-0')} aria-current={last ? 'page' : undefined}>
                {c.onClick && !last
                  ? <button type="button" onClick={c.onClick} className="rounded hover:text-[rgb(var(--fg))] hover:underline hover:underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.5)]">{c.label}</button>
                  : c.label}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, crumbs, meta, sub, primary, secondary, aside, className }: {
  title: ReactNode;
  crumbs?: Crumb[];
  /** Nhãn cạnh tiêu đề (StatusBadge trạng thái, số bản ghi) */
  meta?: ReactNode;
  /** Một dòng mô tả dưới tiêu đề */
  sub?: ReactNode;
  /** Hành động chính duy nhất của trang */
  primary?: PageAction;
  /** Hành động phụ (viền mảnh). Quá 2 nút thì phần sau vào menu ⋯ */
  secondary?: PageAction[];
  /** Nội dung tự do bên phải, trước các nút (bộ chọn kỳ, chuyển chế độ xem) */
  aside?: ReactNode;
  className?: string;
}) {
  const sec = secondary ?? [];
  const shown = sec.length > 3 ? sec.slice(0, 2) : sec;
  const more = sec.length > 3 ? sec.slice(2) : [];
  return (
    <header className={cn('flex flex-col gap-1 pb-4', className)} data-page-header>
      {crumbs && <Breadcrumbs items={crumbs} />}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="font-archivo min-w-0 text-[20px] font-semibold leading-7 text-[rgb(var(--fg))] [text-wrap:balance]">{title}</h1>
            {meta}
          </div>
          {sub && <p className="mt-0.5 text-[13px] text-[rgb(var(--muted))]">{sub}</p>}
        </div>
        {(aside || sec.length > 0 || primary) && (
          <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
            {aside}
            {shown.map((a) => (
              <button key={a.label} type="button" className={cn(btnGhost, 'py-2', a.danger && 'text-[rgb(var(--danger-fg))]')} disabled={a.disabled} title={a.title} onClick={a.onClick}>
                {a.icon && <a.icon className="h-4 w-4" aria-hidden />}{a.label}
              </button>
            ))}
            {more.length > 0 && <RowMenu label="Thao tác khác" items={more.map((a) => ({ label: a.label, icon: a.icon, onClick: a.onClick, disabled: a.disabled, danger: a.danger }))} />}
            {primary && (
              <button type="button" data-page-primary className={cn(btnPrimary, 'max-sm:flex-1')} disabled={primary.disabled} title={primary.title} onClick={primary.onClick}>
                {primary.icon && <primary.icon className="h-4 w-4" aria-hidden />}{primary.label}
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
