'use client';

import { BOD_WHO, CUSTOMER_SOURCE, POP_LABEL, POP_TYPES, PROGRAM_BUDGET, PROGRAM_COLOR, PROGRAM_FUND, PROGRAM_LABEL, PROGRAM_REQUIRED, PROGRAM_SETTLEMENT, PROGRAM_TYPES, SEGMENT_LABEL, SEGMENT_PTS, TIER, TIERS, TW_GROUPS, WF_DEFAULTS, wfBods, wfCondOk, wfDelegateOf, wfHasPerm, wfHeadOf, wfOnLeave, wfOverdue, wfStep } from './core';
import type { Catalog, Lead, Quote, StockMove, StockReservation, User, VendorPO, WfCtx, WfDef, WfStep, WfSubject } from './types';

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

/** Quy trình đã lưu đè lên mặc định (giữ quy trình có sẵn mới thêm ở bản sau), cộng quy trình tự tạo */
export function wfMerge(saved: WfDef[]): WfDef[] {
  return [...WF_DEFAULTS.map((d) => { const s = saved.find((x) => x.key === d.key); return s ? { ...d, ...s, builtin: true, lockSteps: d.lockSteps, lockEnable: d.lockEnable, mode: d.mode, triggerText: d.triggerText, skipText: d.skipText } : d; }), ...saved.filter((x) => !WF_DEFAULTS.some((d) => d.key === x.key))];
}

/** Các bước của một yêu cầu: bỏ bước có điều kiện không khớp; vượt hạn mức bước cuối thì thêm Giám đốc */
export function wfPath(d: WfDef, s: WfSubject): WfStep[] {
  const path = d.steps.filter((st) => !st.when?.length || st.when.some((c) => wfCondOk(c, s)));
  const last = path[path.length - 1];
  if (last?.limit && (s.amount ?? 0) > last.limit && !(last.who.kind === 'ROLE' && last.who.role === 'BOD')) path.push(wfStep('over', 'Giám đốc (vượt hạn mức)', BOD_WHO, last.slaMin));
  return path.length ? path : [wfStep('bod', 'Giám đốc duyệt', BOD_WHO, 240)];
}

/** Người duyệt gốc của bước (chưa xét ủy quyền); không có ai thì Giám đốc */
export function wfBase(step: WfStep, s: WfSubject, c: WfCtx): User[] {
  const req = c.users.find((u) => u.id === s.requesterId);
  let out: User[] = [];
  if (step.who.kind === 'DEPT_HEAD') { const h = wfHeadOf(s.dept ?? req?.dept, c); out = h ? [h] : []; }
  else if (step.who.kind === 'MANAGER') { const h = wfHeadOf(req?.dept, c); out = h ? [h] : []; }
  else if (step.who.kind === 'ROLE') out = c.users.filter((u) => u.active && u.role === step.who.role);
  else if (step.who.kind === 'USER') out = c.users.filter((u) => u.active && u.id === step.who.userId);
  else { const m = c.warehouses.find((w) => w.id === s.whId)?.managerId; out = c.users.filter((u) => u.active && (u.id === m || wfHasPerm(u, 'stock.approve', c))); }
  if (step.perm && step.who.kind !== 'USER') out = out.filter((u) => wfHasPerm(u, step.perm!, c));
  if (step.userLimit && s.amount) out = out.filter((u) => u.role === 'BOD' || u.approvalLimit >= s.amount!);
  if (c.policy.noSelf) out = out.filter((u) => u.id !== s.requesterId);
  return out.length ? out : wfBods(c);
}

/** Người duyệt thực tế: người được ủy quyền thay người vắng; người nghỉ phép cả ngày thì cấp trên / Giám đốc thay */
export function wfApprovers(step: WfStep, s: WfSubject, c: WfCtx): { u: User; onBehalf?: User }[] {
  const out: { u: User; onBehalf?: User }[] = [];
  for (const u of wfBase(step, s, c)) {
    const d = wfDelegateOf(u, c);
    if (d) { out.push({ u: d, onBehalf: u }); continue; }
    if (c.policy.leaveDelegate && wfOnLeave(u, c)) {
      const h = wfHeadOf(u.dept, c);
      const alt = h && h.id !== u.id && !wfOnLeave(h, c) ? [h] : wfBods(c).filter((b) => b.id !== u.id);
      alt.forEach((a) => out.push({ u: a, onBehalf: u }));
      continue;
    }
    out.push({ u });
  }
  return out.filter((x, i) => out.findIndex((y) => y.u.id === x.u.id) === i);
}

/** Người đang đăng nhập có duyệt được bước này không (và duyệt thay ai, có phải tự duyệt, đã chuyển cấp trên chưa) */
export function wfCan(step: WfStep, s: WfSubject, c: WfCtx, startedAt: number): { ok: boolean; onBehalf?: string; self?: boolean; escalated: boolean; who: User[] } {
  const me = c.me;
  const list = wfApprovers(step, s, c);
  const escalated = c.policy.escalate && step.overdue !== 'REMIND' && wfOverdue(step, startedAt, c.now);
  const who = list.map((x) => x.u);
  if (!me) return { ok: false, escalated, who };
  const self = me.id === s.requesterId;
  if (self && c.policy.noSelf && !(me.role === 'BOD' && c.policy.soleBodSelf && wfBods(c).length === 1)) return { ok: false, escalated, who };
  const hit = list.find((x) => x.u.id === me.id);
  if (hit) return { ok: true, onBehalf: hit.onBehalf?.id, self, escalated, who };
  if (escalated && list.some((x) => x.u.dept && wfHeadOf(x.u.dept, c)?.id === me.id)) return { ok: true, self, escalated, who };
  if (me.role === 'BOD' && (c.policy.bodOverride || escalated)) return { ok: true, self, escalated, who };
  return { ok: false, escalated, who };
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

