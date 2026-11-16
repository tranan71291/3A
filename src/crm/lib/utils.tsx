'use client';

import { CUSTOMER_SOURCE, POP_LABEL, POP_TYPES, PROGRAM_BUDGET, PROGRAM_COLOR, PROGRAM_FUND, PROGRAM_LABEL, PROGRAM_REQUIRED, PROGRAM_SETTLEMENT, PROGRAM_TYPES, SEGMENT_LABEL, SEGMENT_PTS, TIER, TIERS, TW_GROUPS } from './core';
import type { Catalog, Lead, Quote, StockMove, StockReservation, VendorPO } from './types';

export function cn(...c: (string | false | null | undefined)[]) {
  const list = c.filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const cls = list[i];
    const k = cls.lastIndexOf(':');
    const variant = k >= 0 && !cls.startsWith('[') ? cls.slice(0, k + 1) : '';
    const base = (variant ? cls.slice(k + 1) : cls).replace(/^!/, '');
    const g = TW_GROUPS.find(([re]) => re.test(base));
    if (g) {
      const key = variant + g[1];
      if (seen.has(key)) continue;
      seen.add(key);
      g[2]?.forEach((x) => seen.add(variant + x));
    }
    out.push(cls);
  }
  return out.reverse().join(' ');
}

export function syncCatalog(c: Catalog) {
  const reset = <T,>(o: Record<string, T>) => Object.keys(o).forEach((k) => delete o[k]);
  [SEGMENT_LABEL, SEGMENT_PTS, TIER, PROGRAM_LABEL, PROGRAM_COLOR, PROGRAM_FUND, PROGRAM_BUDGET, PROGRAM_REQUIRED, PROGRAM_SETTLEMENT, POP_LABEL, CUSTOMER_SOURCE].forEach((o) => reset(o as Record<string, unknown>));
  c.segments.forEach((s) => { SEGMENT_LABEL[s.code] = s.name; SEGMENT_PTS[s.code] = s.points; });
  const tiers = [...c.tiers].sort((a, b) => b.minRevenue - a.minRevenue);
  TIERS.splice(0, TIERS.length, ...tiers.map((t) => t.tier));
  tiers.forEach((t) => { TIER[t.tier] = { label: t.name, tone: t.tone }; });
  PROGRAM_TYPES.splice(0, PROGRAM_TYPES.length, ...c.categories.map((x) => x.code));
  c.categories.forEach((x) => {
    PROGRAM_LABEL[x.code] = x.name;
    PROGRAM_COLOR[x.code] = x.color;
    PROGRAM_FUND[x.code] = x.fund;
    PROGRAM_BUDGET[x.code] = x.amount;
    PROGRAM_REQUIRED[x.code] = x.required;
    PROGRAM_SETTLEMENT[x.code] = x.settlement;
  });
  POP_TYPES.splice(0, POP_TYPES.length, ...c.popDocs.map((d) => d.code));
  c.popDocs.forEach((d) => { POP_LABEL[d.code] = d.name; });
  c.sources.forEach((s) => { CUSTOMER_SOURCE[s.id] = s; });
}

export function initialLeads(): Lead[] {
  return [];
}

export function initialQuotes(): Quote[] {
  return [];
}

export function initialPOs(): VendorPO[] {
  return [];
}

export function initialReservations(): StockReservation[] {
  return [];
}

export function initialMoves(): StockMove[] {
  return [];
}

