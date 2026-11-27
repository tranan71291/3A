'use client';

import { type ReactNode } from 'react';
import { AlertTriangle, Check, Minus } from 'lucide-react';
import type { Tone } from '../../lib/types';
import { cn } from '../../lib/utils';
import type { KitIcon } from './page-header';

// =====================================================================
//  v59 StatusBadge — nhãn trạng thái nền pastel (màu token ở độ đậm 12–14%), chữ đậm tông cùng màu
//  Màu không bao giờ là tín hiệu duy nhất: luôn có chữ, có thể thêm chấm / biểu tượng.
// =====================================================================

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

/** Đổi tông cũ của Chip (muted / blue / teal / orange / red) sang tông mới */
export const TONE_OF: Record<Tone, StatusTone> = { muted: 'neutral', blue: 'info', teal: 'success', orange: 'accent', red: 'danger' };

/** Chữ = màu tông pha 20% màu chữ chính (--fg): đậm hơn ở nền sáng, sáng hơn ở nền tối → tương phản ≥ 4.5:1 ở cả 2 chế độ, không thêm màu mới */
/** Lớp màu khai báo trong THEME_CSS (.ui-tone-*) */
const TONE_CLS: Record<StatusTone, string> = {
  neutral: 'ui-tone-neutral', info: 'ui-tone-info', success: 'ui-tone-success', warning: 'ui-tone-warning', danger: 'ui-tone-danger', accent: 'ui-tone-accent',
};

export function StatusBadge({ tone = 'neutral', children, dot, icon: Icon, size = 'md', title }: {
  tone?: StatusTone | Tone;
  children: ReactNode;
  /** Chấm tròn trước chữ (trạng thái đang diễn ra) */
  dot?: boolean;
  icon?: KitIcon;
  size?: 'sm' | 'md';
  title?: string;
}) {
  const t: StatusTone = tone in TONE_OF ? TONE_OF[tone as Tone] : (tone as StatusTone);
  return (
    <span data-status={t} title={title}
      className={cn('inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-badge)] font-medium leading-none', size === 'sm' ? 'h-5 px-1.5 text-[11.5px]' : 'h-6 px-2 text-[12px]', TONE_CLS[t])}>
      {dot && !Icon && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

// =====================================================================
//  v59 WorkflowStepper — thanh tiến trình quy trình (ngang cho đầu trang / bảng trượt, dọc cho cột phải)
//  Xong = tròn đặc màu chữ + dấu ✓ · Đang làm = tròn cam có quầng · Chưa = tròn rỗng · Vướng = viền đỏ + ! · Bỏ qua = viền nét đứt
// =====================================================================

export type StepState = 'done' | 'current' | 'todo' | 'blocked' | 'skipped' | 'parallel';
/** `meta`: nhãn nhỏ cạnh tên bước (vd. "chờ duyệt", "bạn", "2 / 5") */
export type WorkflowStep = { key: string; label: string; sub?: ReactNode; at?: string; state: StepState; meta?: ReactNode };

const STATE_TEXT: Record<StepState, string> = { done: 'đã xong', current: 'đang thực hiện', todo: 'chưa thực hiện', blocked: 'đang vướng', skipped: 'bỏ qua', parallel: 'chạy song song, chưa xong' };

function Marker({ state, n }: { state: StepState; n: number }) {
  return (
    <span className={cn('relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-semibold tabular-nums',
      state === 'done' && 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--bg))]',
      state === 'current' && 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-[rgb(var(--on-accent))] shadow-[0_0_0_4px_rgb(var(--accent)/0.18)]',
      state === 'todo' && 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--muted))]',
      state === 'blocked' && 'border-[rgb(var(--danger))] bg-[rgb(var(--surface))] text-[rgb(var(--danger-fg))]',
      state === 'skipped' && 'border-dashed border-[rgb(var(--faint))] bg-[rgb(var(--surface))] text-[rgb(var(--faint))]',
      state === 'parallel' && 'border-dashed border-[rgb(var(--muted))] bg-[rgb(var(--surface))] text-[rgb(var(--muted))]')} aria-hidden>
      {state === 'done' ? <Check className="h-3.5 w-3.5" /> : state === 'blocked' ? <AlertTriangle className="h-3 w-3" /> : state === 'skipped' ? <Minus className="h-3 w-3" /> : n}
    </span>
  );
}

export function WorkflowStepper({ steps, orientation = 'horizontal', label = 'Tiến trình' }: { steps: WorkflowStep[]; orientation?: 'horizontal' | 'vertical'; label?: string }) {
  if (orientation === 'vertical') {
    return (
      <ol aria-label={label} data-stepper="vertical">
        {steps.map((s, i) => (
          <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} className="relative grid grid-cols-[24px_1fr] gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className={cn('absolute bottom-0 left-[11px] top-6 w-0.5', s.state === 'done' ? 'bg-[rgb(var(--fg))]' : 'bg-[rgb(var(--border))]')} aria-hidden />}
            <Marker state={s.state} n={i + 1} />
            <div className="min-w-0 pt-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13.5px] leading-5">
                <span className={cn(s.state === 'todo' || s.state === 'skipped' ? 'text-[rgb(var(--muted))]' : 'font-medium text-[rgb(var(--fg))]', s.state === 'blocked' && 'text-[rgb(var(--danger-fg))]')}>{s.label}</span>
                {s.at && <span className="text-[12px] text-[rgb(var(--muted))] ui-num">{s.at}</span>}
                {s.meta}
                <span className="sr-only">({STATE_TEXT[s.state]})</span>
              </p>
              {s.sub && <div className="mt-0.5 text-[12.5px] leading-5 text-[rgb(var(--muted))]">{s.sub}</div>}
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol aria-label={label} data-stepper="horizontal" className="flex w-full items-start">
      {steps.map((s, i) => (
        <li key={s.key} aria-current={s.state === 'current' ? 'step' : undefined} className="relative min-w-0 flex-1 last:flex-none">
          <div className="flex items-center">
            <Marker state={s.state} n={i + 1} />
            {i < steps.length - 1 && <span className={cn('mx-2 h-0.5 min-w-4 flex-1 rounded-full', s.state === 'done' ? 'bg-[rgb(var(--fg))]' : 'bg-[rgb(var(--border))]')} aria-hidden />}
          </div>
          <div className="mt-2 min-w-0 pr-3">
            <p className={cn('truncate text-[13px] leading-5', s.state === 'todo' || s.state === 'skipped' ? 'text-[rgb(var(--muted))]' : 'font-medium text-[rgb(var(--fg))]', s.state === 'blocked' && 'text-[rgb(var(--danger-fg))]')} title={s.label}>
              {s.label}<span className="sr-only"> ({STATE_TEXT[s.state]})</span>
            </p>
            {(s.at || s.sub) && <div className={cn('line-clamp-2 text-[12px] leading-[18px] ui-num', s.state === 'blocked' ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')}>{s.at ?? s.sub}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
