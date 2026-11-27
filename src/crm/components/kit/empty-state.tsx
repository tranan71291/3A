'use client';

import { type ReactNode, useId } from 'react';
import { Plus } from 'lucide-react';
import { BRAND, btnGhost, btnPrimary } from '../../lib/core';
import { cn } from '../../lib/utils';
import type { KitIcon, PageAction } from './page-header';

// =====================================================================
//  v59 EmptyState — trạng thái trống: minh họa nét mảnh (hoặc 1 biểu tượng) · câu nói rõ vì sao trống ·
//  tối đa 3 bước hướng dẫn ngắn · nút hành động ngay tại chỗ. Giữ nguyên API cũ (text, hint, art, action, onAction, compact).
// =====================================================================

export type EmptyKind = 'search' | 'box' | 'calendar' | 'doc' | 'ledger' | 'inbox';

/** Hình minh họa nét mảnh cho trạng thái trống (line-art, nét nhấn theo màu logo) */
export function EmptyArt({ kind }: { kind: EmptyKind }) {
  const gid = `eg${useId().replace(/:/g, '')}`;
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const accent = { fill: 'none', stroke: `url(#${gid})`, strokeWidth: 2, strokeLinecap: 'round' as const };
  const dot = { style: { fill: 'rgb(var(--secondary))' } };
  return (
    <svg viewBox="0 0 120 84" width="120" height="84" className="text-[rgb(var(--border))]" aria-hidden>
      <defs><linearGradient id={gid} x1="0" x2="1"><stop offset="0" stopColor={BRAND.o1} /><stop offset=".55" stopColor={BRAND.o2} /><stop offset="1" stopColor={BRAND.o3} /></linearGradient></defs>
      <path d="M14 74h92" {...stroke} strokeDasharray="2 5" />
      {kind === 'search' && <><rect x="26" y="14" width="50" height="46" rx="3" {...stroke} /><path d="M34 26h30M34 34h22M34 42h26" {...stroke} /><circle cx="78" cy="50" r="12" {...accent} /><path d="M87 59l10 10" {...accent} /><circle cx="78" cy="50" r="4" {...dot} opacity=".8" /></>}
      {kind === 'box' && <><path d="M30 34l30-14 30 14v28L60 76 30 62z" {...stroke} /><path d="M30 34l30 14 30-14M60 48v28" {...stroke} /><path d="M45 27l30 14" {...accent} /><circle cx="60" cy="48" r="3" {...dot} /></>}
      {kind === 'calendar' && <><rect x="28" y="18" width="64" height="52" rx="3" {...stroke} /><path d="M28 32h64M42 12v12M78 12v12" {...stroke} /><path d="M40 44h8M56 44h8M72 44h8M40 56h8M56 56h8" {...stroke} /><rect x="70" y="52" width="12" height="10" rx="2" {...accent} /></>}
      {kind === 'doc' && <><path d="M36 10h34l14 14v50H36z" {...stroke} /><path d="M70 10v14h14" {...stroke} /><path d="M44 38h30M44 46h30M44 54h18" {...stroke} /><path d="M44 30h16" {...accent} /><circle cx="78" cy="62" r="3" {...dot} /></>}
      {kind === 'ledger' && <><rect x="30" y="12" width="60" height="60" rx="3" {...stroke} /><path d="M40 26h40M40 36h40M40 46h40M40 56h24" {...stroke} /><path d="M66 56h14" {...accent} /><path d="M58 12v60" {...stroke} strokeDasharray="2 3" /></>}
      {kind === 'inbox' && <><path d="M24 44l12-26h48l12 26v24H24z" {...stroke} /><path d="M24 44h22l4 8h20l4-8h22" {...stroke} /><path d="M48 30h24" {...accent} /><circle cx="60" cy="38" r="3" {...dot} /></>}
    </svg>
  );
}

export function EmptyState({ text, hint, art, icon: Icon, steps, action, onAction, actionIcon: AIcon = Plus, secondary, compact }: {
  /** Câu chính: vì sao trống (vd "Chưa có đơn hàng trong tháng này") */
  text: ReactNode;
  /** Một câu gợi ý cách làm tiếp */
  hint?: ReactNode;
  art?: EmptyKind;
  /** Dùng 1 biểu tượng thay cho hình minh họa (trong thẻ nhỏ, bảng trượt) */
  icon?: KitIcon;
  /** Tối đa 3 bước ngắn, đánh số */
  steps?: string[];
  action?: string;
  onAction?: () => void;
  actionIcon?: KitIcon;
  secondary?: PageAction;
  compact?: boolean;
}) {
  return (
    <div data-empty className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-10')}>
      {Icon
        ? <span className="grid h-11 w-11 place-items-center rounded-full bg-[rgb(var(--ink)/0.05)] text-[rgb(var(--fg2))]" aria-hidden><Icon className="h-5 w-5" /></span>
        : !compact && <EmptyArt kind={art ?? 'box'} />}
      <div className="max-w-md space-y-1">
        <p className="text-[14.5px] font-medium leading-6 text-[rgb(var(--fg))] [text-wrap:balance]">{text}</p>
        {hint && <p className="text-[13px] leading-5 text-[rgb(var(--muted))] [text-wrap:pretty]">{hint}</p>}
      </div>
      {steps && steps.length > 0 && (
        <ol className="mt-1 w-full max-w-sm space-y-1.5 text-left">
          {steps.slice(0, 3).map((s, i) => (
            <li key={s} className="flex items-start gap-2.5 text-[13px] leading-5 text-[rgb(var(--fg2))]">
              <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[rgb(var(--border))] text-[11px] tabular-nums text-[rgb(var(--muted))]" aria-hidden>{i + 1}</span>{s}
            </li>
          ))}
        </ol>
      )}
      {((action && onAction) || secondary) && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {secondary && <button type="button" className={cn(btnGhost, 'py-2')} disabled={secondary.disabled} onClick={secondary.onClick}>{secondary.icon && <secondary.icon className="h-4 w-4" aria-hidden />}{secondary.label}</button>}
          {action && onAction && <button type="button" className={btnPrimary} onClick={onAction}><AIcon className="h-4 w-4" aria-hidden />{action}</button>}
        </div>
      )}
    </div>
  );
}
