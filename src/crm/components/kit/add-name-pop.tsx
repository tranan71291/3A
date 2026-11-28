'use client';

import { useEffect, useRef } from 'react';
import { btnGhost, btnPrimary, btnSm, inputCls } from '../../lib/core';
import { cn } from '../../lib/utils';

/**
 * v61 Ô thêm nhanh một mục danh mục (nguồn đơn hàng, nguồn khách...) mở ngay dưới nút "+":
 * không mở hộp thoại chồng; Enter = Lưu, Esc = Bỏ qua.
 */
export function AddNamePop({ title, value, onChange, onSave, onCancel, placeholder, className }: {
  title: string; value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; placeholder?: string; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className={cn('absolute right-0 top-full z-30 mt-1.5 w-[320px] max-w-[calc(100vw-32px)] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3.5 shadow-lg', className)} role="group" aria-label={title} data-add-pop>
      <p className="mb-2 text-[13.5px] font-semibold">{title}</p>
      <input ref={ref} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={title}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSave(); } else if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }} />
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className={cn(btnGhost, btnSm, 'border-transparent')} onClick={onCancel}>Bỏ qua</button>
        <button type="button" className={cn(btnPrimary, btnSm)} disabled={!value.trim()} onClick={onSave}>Lưu</button>
      </div>
    </div>
  );
}
