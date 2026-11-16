'use client';

import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useEscClose, useOverlay } from './ui';
import { btnGhost } from '../lib/core';
import { cn } from '../lib/utils';

// =====================================================================
//  DRAWER DÙNG CHUNG
// =====================================================================

export function Drawer({ title, eyebrow, badge, onClose, children, footer, actions }: { title: string; eyebrow?: string; badge?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; actions?: ReactNode }) {
  const ov = useOverlay();
  useEscClose(ov.id, onClose);
  return (
    <div className={cn('fixed inset-0 z-50', !ov.top && 'invisible')} aria-hidden={!ov.top || undefined} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 motion-safe:animate-[fadeIn_.2s_ease-out]" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-2xl motion-safe:animate-[slideIn_.28s_cubic-bezier(.2,.8,.2,1)]">
        <header className="flex items-start justify-between gap-4 border-b border-[rgb(var(--line))] px-6 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {eyebrow && <span className="text-sm font-medium text-[rgb(var(--muted))]">{eyebrow}</span>}
              {badge}
            </div>
            <h2 className="mt-1 text-lg font-semibold leading-snug text-[rgb(var(--fg))]">{title}</h2>
            {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
          </div>
          <button className={cn(btnGhost, 'p-2')} onClick={onClose} aria-label="Đóng"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="border-t border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">{footer}</footer>}
      </aside>
    </div>
  );
}

