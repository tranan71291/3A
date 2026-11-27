'use client';

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useEscClose, useOverlay } from '../ui';
import { btnGhost, btnPrimary } from '../../lib/core';
import { cn } from '../../lib/utils';
import type { PageAction } from './page-header';

// =====================================================================
//  v59 SlideOverDrawer — bảng trượt bên phải chuẩn (thay popup giữa màn hình)
//  - Một ngăn xếp lớp (useOverlay): chỉ lớp trên cùng hiện, Esc đóng lớp trên cùng → không popup chồng popup
//  - Đầu bảng cố định, thân cuộn riêng (không kéo trang phía sau), chân dính đáy chứa nút hành động
//  - Bàn phím: mở thì đưa tiêu điểm vào bảng, Tab không thoát ra ngoài, đóng thì trả về nút đã mở
// =====================================================================

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';

/** sm 480 · md 672 · lg 896 · xl 1152 px */
const WIDTH: Record<DrawerSize, string> = { sm: 'max-w-[480px]', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' };

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function SlideOverDrawer({
  title, eyebrow, badge, description, onClose, children, footer, actions, size = 'md', primaryAction, secondaryActions, footerNote, bodyClassName,
}: {
  title: string;
  /** Dòng nhỏ phía trên tiêu đề (mã chứng từ, tên khách…) */
  eyebrow?: string;
  /** Nhãn trạng thái cạnh dòng nhỏ (StatusBadge) */
  badge?: ReactNode;
  /** Một câu mô tả dưới tiêu đề */
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Chân tùy biến (giữ cho mã cũ). Bảng mới dùng primaryAction / secondaryActions / footerNote. */
  footer?: ReactNode;
  /** Nút phụ ngay dưới tiêu đề (Mở đơn hàng, In…) */
  actions?: ReactNode;
  size?: DrawerSize;
  /** Nút chính ở chân, căn phải (1 nút) */
  primaryAction?: PageAction;
  /** Nút phụ ở chân, đứng trước nút chính */
  secondaryActions?: PageAction[];
  /** Ghi chú / tổng tiền ở chân, căn trái */
  footerNote?: ReactNode;
  bodyClassName?: string;
}) {
  const ov = useOverlay();
  useEscClose(ov.id, onClose);
  const panel = useRef<HTMLElement>(null);
  const hid = useId();
  // nút đã mở bảng: lấy lúc render đầu, trước khi ô autoFocus bên trong nhận tiêu điểm
  const [opener] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)));
  useEffect(() => {
    const p = panel.current;
    if (p && !p.contains(document.activeElement)) p.focus({ preventScroll: true });
    return () => { if (opener && opener !== document.body && document.contains(opener)) opener.focus({ preventScroll: true }); };
  }, [opener]);
  const trap = (e: KeyboardEvent) => {
    const p = panel.current;
    if (e.key !== 'Tab' || !p) return;
    const f = [...p.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === p)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const std = !footer && (primaryAction || secondaryActions?.length || footerNote);
  // render tại chỗ như Drawer cũ (không portal): khung cha có "bấm ra ngoài thì đóng" vẫn coi bảng trượt là bên trong
  return (
    <div className={cn('fixed inset-0 z-50', !ov.top && 'invisible')} aria-hidden={!ov.top || undefined} role="dialog" aria-modal="true" aria-label={title} aria-labelledby={hid}>
      <div className="absolute inset-0 bg-black/50 motion-safe:animate-[fadeIn_.2s_ease-out]" onClick={onClose} aria-hidden />
      <aside ref={panel} tabIndex={-1} onKeyDown={trap} data-drawer-size={size}
        className={cn('absolute inset-y-0 right-0 flex w-full flex-col outline-none', WIDTH[size], 'border-l border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-[var(--shadow-lg)] motion-safe:animate-[slideIn_.28s_cubic-bezier(.2,.8,.2,1)]')}>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[rgb(var(--border))] px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="min-w-0">
            {(eyebrow || badge) && (
              <div className="flex min-h-5 flex-wrap items-center gap-2">
                {eyebrow && <span className="truncate text-[13px] text-[rgb(var(--muted))]">{eyebrow}</span>}
                {badge}
              </div>
            )}
            <h2 id={hid} className="mt-0.5 text-[17px] font-semibold leading-6 text-[rgb(var(--fg))] [text-wrap:balance]">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-[rgb(var(--muted))]">{description}</p>}
            {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
          </div>
          <button type="button" className={cn(btnGhost, 'h-8 w-8 shrink-0 p-0')} onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" aria-hidden /></button>
        </header>
        <div className={cn('ui-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5', bodyClassName)}>{children}</div>
        {footer && <footer className="shrink-0 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">{footer}</footer>}
        {std && (
          <footer data-drawer-footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
            {footerNote && <div className="mr-auto min-w-0 text-[13px] text-[rgb(var(--muted))] ui-num">{footerNote}</div>}
            <div className={cn('flex flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>button]:flex-1', !footerNote && 'ml-auto')}>
              {secondaryActions?.map((a) => (
                <button key={a.label} type="button" className={cn(btnGhost, 'py-2', a.danger && 'text-[rgb(var(--danger-fg))]')} disabled={a.disabled} title={a.title} onClick={a.onClick}>{a.icon && <a.icon className="h-4 w-4" aria-hidden />}{a.label}</button>
              ))}
              {primaryAction && <button type="button" className={btnPrimary} disabled={primaryAction.disabled} title={primaryAction.title} onClick={primaryAction.onClick}>{primaryAction.icon && <primaryAction.icon className="h-4 w-4" aria-hidden />}{primaryAction.label}</button>}
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
