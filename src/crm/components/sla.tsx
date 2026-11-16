'use client';

import { AlertTriangle, Clock } from 'lucide-react';
import { Chip } from './ui';
import { fmtDur } from '../lib/core';

export function QuoteTimer({ deadline, now }: { deadline?: number; now: number | null }) {
  if (!deadline || now == null) return <span className="text-xs text-[rgb(var(--muted))]">—</span>;
  const diff = deadline - now;
  if (diff < 0) {
    return <Chip tone="red"><AlertTriangle className="h-3 w-3" aria-hidden />QUÁ HẠN BÁO GIÁ {Math.ceil(-diff / 3.6e6)}h</Chip>;
  }
  return <Chip tone={diff < 4 * 3.6e6 ? 'orange' : 'muted'}><Clock className="h-3 w-3" aria-hidden />Báo giá còn {fmtDur(diff)}</Chip>;
}

