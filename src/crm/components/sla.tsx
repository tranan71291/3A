'use client';

import { type ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { fmtDur } from '../lib/core';
import { cn } from '../lib/utils';

/** v40: hiển thị thời hạn thống nhất: mono + đồng hồ; đỏ = quá hạn, cam đậm = sắp hết */
export function Sla({ tone, children }: { tone: 'over' | 'tight' | 'ok'; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs tabular-nums', tone === 'over' ? 'text-[rgb(var(--danger-fg))]' : tone === 'tight' ? 'text-[rgb(var(--warn))]' : 'text-[rgb(var(--fg2))]')}><Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />{children}</span>;
}

export function QuoteTimer({ deadline, now }: { deadline?: number; now: number | null }) {
  if (!deadline || now == null) return <span className="text-xs text-[rgb(var(--muted))]">—</span>;
  const diff = deadline - now;
  if (diff < 0) {
    return <Sla tone="over">Quá hạn {Math.ceil(-diff / 3.6e6)} giờ</Sla>;
  }
  return <Sla tone={diff < 4 * 3.6e6 ? 'tight' : 'ok'}>Còn {fmtDur(diff)}</Sla>;
}

