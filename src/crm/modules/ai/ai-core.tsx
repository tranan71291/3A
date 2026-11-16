'use client';

import { useEffect, useState } from 'react';
import { AI_NAME, aiErrText, bizMode, boqTotal, cloud, CLOUD_ON, compact, digits9, fold, givenName, LEAD_STATUS, maskPii, MDF_REIMBURSE_LAG_DAYS, placeChunks, SERVER0, serverCache, useApp } from '../../lib/core';
import type { AiAnswer, AiCall, AnyRec, AppCtx, Budget, Claim, Customer, HubCfg, JobStage, KbItem, KbRule, Lead, LinkHit, MdfMonth, Program, ServerStatus, SlaRisk, ZaloConv, ZaloMsg } from '../../lib/types';
import { jobStageOf } from '../../lib/workshop';

export async function fetchServerStatus(tenant: string, force = false): Promise<ServerStatus> {
  if (!force && serverCache.tenant === tenant && serverCache.value.checked && Date.now() - serverCache.at < 300_000) return serverCache.value;
  if (serverCache.inflight && serverCache.tenant === tenant && !force) return serverCache.inflight;
  serverCache.tenant = tenant;
  serverCache.inflight = (async () => {
    try {
      if (typeof location !== 'undefined' && location.protocol === 'file:') throw new Error('static');
      const r = await fetch(`/api/integrations?tenant=${encodeURIComponent(tenant)}`, { cache: 'no-store' });
      const d = r.ok && (r.headers.get('content-type') ?? '').includes('json') ? ((await r.json()) as Partial<ServerStatus>) : null;
      serverCache.value = d ? { ...SERVER0, ...d, checked: true, reachable: true } : { ...SERVER0, checked: true };
    } catch { serverCache.value = { ...SERVER0, checked: true }; }
    serverCache.at = Date.now(); serverCache.inflight = null;
    return serverCache.value;
  })();
  return serverCache.inflight;
}

export function useServerStatus(): [ServerStatus, () => void] {
  const { org } = useApp();
  const [s, setS] = useState<ServerStatus>(serverCache.tenant === org.id ? serverCache.value : SERVER0);
  const [tick, setTick] = useState(0);
  useEffect(() => { let live = true; void fetchServerStatus(org.id, tick > 0).then((v) => { if (live) setS(v); }); return () => { live = false; }; }, [org.id, tick]);
  return [s, () => setTick((t) => t + 1)];
}

/** Gọi route máy chủ kèm phiên đăng nhập Supabase (nếu có) */
export async function apiPost<T>(path: string, body: AnyRec): Promise<T & { ok: boolean; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (CLOUD_ON && cloud.session?.access_token) headers.Authorization = `Bearer ${cloud.session.access_token}`;
  try {
    const r = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    const d = (await r.json().catch(() => ({ ok: false, error: `http_${r.status}` }))) as T & { ok: boolean; error?: string };
    return d;
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'network' } as T & { ok: boolean; error?: string }; }
}

/** Trợ lý AI dùng chung: available = đã bật trong Cài đặt và máy chủ có khóa của nhà cung cấp đã chọn */
export function useAi(feature: keyof HubCfg['ai']['features']) {
  const { hubCfg, org, company } = useApp();
  const [srv] = useServerStatus();
  const c = hubCfg.ai;
  const prov: 'ANTHROPIC' | 'OPENAI' | null = c.provider === 'ANTHROPIC' ? (srv.ai.anthropic ? 'ANTHROPIC' : null) : c.provider === 'OPENAI' ? (srv.ai.openai ? 'OPENAI' : null) : srv.ai.anthropic ? 'ANTHROPIC' : srv.ai.openai ? 'OPENAI' : null;
  const available = c.enabled && c.features[feature] && !!prov;
  const label = prov ? AI_NAME[prov] : 'Phân tích cục bộ';
  const ask = async (a: AiCall): Promise<AiAnswer> => {
    if (!available || !prov) return { ok: false, error: 'offline' };
    const sys = `Bạn là trợ lý AI nội bộ của ${company.legalName || company.appName}. Luôn trả lời bằng tiếng Việt, ngắn gọn, đúng mực, dùng số liệu được cung cấp; không bịa số liệu, nếu thiếu dữ liệu thì nói rõ.${a.system ? `\n\n${a.system}` : ''}`;
    const m = (x: string) => (c.maskPii ? maskPii(x) : x);
    const r = await apiPost<{ text: string; provider: 'ANTHROPIC' | 'OPENAI'; model: string }>('/api/ai', {
      tenant: org.id, provider: prov, model: prov === 'ANTHROPIC' ? c.anthropicModel || undefined : c.openaiModel || undefined, system: m(sys), maxTokens: a.maxTokens ?? 1200, image: a.image,
      messages: [...(a.history ?? []).map((h) => ({ role: h.role, content: m(h.content) })), { role: 'user', content: m(a.prompt) }],
    });
    return r.ok ? { ok: true, text: r.text, provider: r.provider, model: r.model } : { ok: false, error: aiErrText(r.error) };
  };
  return { available, label, provider: prov, ask, srv };
}

/** Tách JSON đầu tiên trong câu trả lời của AI */
export function parseAiJson<T>(s: string): T | null {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = m ? m[1] : s.slice(Math.max(0, s.indexOf('{')), s.lastIndexOf('}') + 1);
  try { return JSON.parse(body) as T; } catch { return null; }
}

/** Thưởng tăng trưởng: đạt ngưỡng % thì thưởng theo từng bậc doanh thu tăng thêm */
export function dealerBonus(r: KbRule, last: number, cur: number) {
  const inc = cur - last;
  const growth = last > 0 ? (inc / last) * 100 : cur > 0 ? 100 : 0;
  const ok = growth >= r.minGrowthPct && inc > 0;
  const baseAmt = r.base === 'ABOVE_THRESHOLD' ? Math.max(0, cur - last * (1 + r.minGrowthPct / 100)) : inc;
  const steps = ok ? Math.floor(baseAmt / r.stepRevenue) : 0;
  const needFor7 = Math.max(0, Math.ceil(last * (1 + r.minGrowthPct / 100) - cur));
  const toNext = ok ? r.stepRevenue - (baseAmt % r.stepRevenue) : 0;
  return { inc, growth, ok, steps, bonus: steps * r.bonusPerStep, needFor7, toNext };
}

/** Đọc số tiền trong câu: "1,2 tỷ", "850tr", "300 triệu" */
export function parseMoneyVi(s: string): number[] {
  const out: number[] = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(tỷ|ty|tỉ|tr|triệu|trieu|m\b|k\b|nghìn|ngàn)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const unit = (m[2] ?? '').toLowerCase();
    if (!unit && m[1].length < 5) continue;
    const n = Number(m[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
    out.push(n * (/^(tỷ|ty|tỉ)$/.test(unit) ? 1e9 : /^(tr|triệu|trieu|m)$/.test(unit) ? 1e6 : /^(k|nghìn|ngàn)$/.test(unit) ? 1e3 : 1));
  }
  return out;
}

export function mdfForecast(budget: Budget, programs: Program[], claims: Claim[], now: number) {
  const day = 864e5;
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now); d.setDate(1); d.setMonth(d.getMonth() + i); return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}` }; });
  const mk = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const events: { at: number; out: number; inflow: number; what: string }[] = [];
  claims.filter((c) => !c.creditNote).forEach((c) => {
    const amt = c.vendorApproved ?? Math.min(c.claimed, c.cap || c.claimed);
    const submitAt = c.submitted ? now : now + Math.max(0, c.daysLeft) * day;
    events.push({ at: submitAt + MDF_REIMBURSE_LAG_DAYS * day, out: 0, inflow: amt, what: `Hoàn quỹ claim ${c.code}` });
  });
  programs.filter((p) => ['APPROVED', 'CLAIMING'].includes(p.status) && !p.claimId).forEach((p) => {
    const share = Math.round(p.requested * (p.sharePct / 100));
    const end = new Date(p.end).getTime() || now;
    events.push({ at: Math.max(now, end), out: share, inflow: 0, what: `Triển khai ${p.code}` });
    events.push({ at: Math.max(now, end) + (30 + MDF_REIMBURSE_LAG_DAYS) * day, out: 0, inflow: share, what: `Hoàn quỹ ${p.code}` });
  });
  const remaining = Math.max(0, budget.total - budget.spent - budget.committed);
  let pending = claims.filter((c) => !c.creditNote).reduce((s, c) => s + (c.vendorApproved ?? Math.min(c.claimed, c.cap || c.claimed)), 0);
  let balance = remaining;
  const rows: MdfMonth[] = months.map((m) => {
    const ev = events.filter((e) => mk(e.at) === m.key);
    const out = ev.reduce((s, e) => s + e.out, 0);
    const inflow = ev.reduce((s, e) => s + e.inflow, 0);
    pending = Math.max(0, pending + out - inflow);
    balance -= out;
    return { ...m, out, inflow, pendingEnd: pending, balanceEnd: balance };
  });
  const late = claims.filter((c) => !c.submitted && c.daysLeft <= 7);
  const periodEnd = new Date(budget.periodEnd).getTime();
  const daysToEnd = periodEnd ? Math.round((periodEnd - now) / day) : null;
  return { rows, remaining, pendingNow: claims.filter((c) => !c.creditNote).reduce((s, c) => s + (c.vendorApproved ?? Math.min(c.claimed, c.cap || c.claimed)), 0), late, daysToEnd, usedPct: budget.total ? ((budget.spent + budget.committed) / budget.total) * 100 : 0, events };
}

/** Điểm rủi ro trễ SLA 0-100: thời gian còn lại so với hạn, tải việc của người phụ trách, giá trị dự án */
export function slaRisks(leads: Lead[], now: number): SlaRisk[] {
  const open = leads.filter((l) => ['ROUTED', 'ASSIGNED', 'ACCEPTED', 'QUOTED'].includes(l.status));
  const load = new Map<string, number>();
  open.forEach((l) => { if (l.assignee) load.set(l.assignee, (load.get(l.assignee) ?? 0) + 1); });
  return open.map((l) => {
    const dl = l.status === 'ASSIGNED' || l.status === 'ROUTED' ? l.slaDeadline : l.status === 'ACCEPTED' ? l.quoteDeadline : undefined;
    const dueIn = dl ? (dl - now) / 3.6e6 : null;
    const reasons: string[] = [];
    let score = 0;
    if (dueIn != null) {
      if (dueIn < 0) { score += 60; reasons.push(`Đã quá hạn ${Math.round(-dueIn)} giờ`); }
      else if (dueIn < 4) { score += 45; reasons.push(`Còn ${Math.max(1, Math.round(dueIn))} giờ đến hạn`); }
      else if (dueIn < 12) { score += 25; reasons.push(`Còn ${Math.round(dueIn)} giờ đến hạn`); }
    }
    const ld = l.assignee ? load.get(l.assignee) ?? 0 : 0;
    if (!l.assignee && l.status !== 'ROUTED') { score += 15; reasons.push('Chưa có người phụ trách'); }
    if (ld >= 4) { score += 15; reasons.push(`Người phụ trách đang giữ ${ld} việc`); }
    if (boqTotal(l) >= 1e9) { score += 10; reasons.push('Dự án giá trị lớn (≥ 1 tỷ)'); }
    if (l.status === 'QUOTED' && l.receivedDaysAgo > 20) { score += 15; reasons.push(`Báo giá chưa chốt sau ${l.receivedDaysAgo} ngày`); }
    return { lead: l, score: Math.min(100, score), reasons, dueIn };
  }).filter((r) => r.score >= 25).sort((a, b) => b.score - a.score);
}

/** Dữ liệu tóm tắt gửi kèm câu hỏi cho AI (gọn, không gồm thông tin liên hệ chi tiết) */
export function buildAiContext(app: AppCtx, now: number): string {
  const { company, myLeads: leads, myCustomers: customers, budget, programs, claims, jobs, receipts, workOrders, installJobs } = app;
  const mode = bizMode(company);
  const lines: string[] = [`Hôm nay: ${new Date(now).toLocaleDateString('vi-VN')}. Doanh nghiệp: ${company.legalName || company.appName} (mô hình ${mode === 'MFG' ? 'xưởng sản xuất & lắp đặt' : 'phân phối thương mại'}).`];
  if (mode !== 'MFG') {
    const open = leads.filter((l) => !['WON', 'LOST'].includes(l.status));
    lines.push(`Lead / dự án đang mở: ${open.length}, giá trị ${compact(open.reduce((s, l) => s + boqTotal(l), 0))}. Đã chốt: ${leads.filter((l) => l.status === 'WON').length}, trượt: ${leads.filter((l) => l.status === 'LOST').length}.`);
    const risks = slaRisks(leads, now).slice(0, 8);
    if (risks.length) lines.push(`Rủi ro SLA cao nhất: ${risks.map((r) => `${r.lead.code} ${r.lead.company} (điểm ${r.score}: ${r.reasons.join('; ')})`).join(' | ')}`);
    lines.push(`Quỹ MDF ${budget.vendor} năm ${budget.fiscalYear}: tổng ${compact(budget.total)}, đã chi ${compact(budget.spent)}, cam kết ${compact(budget.committed)}, còn ${compact(Math.max(0, budget.total - budget.spent - budget.committed))}. Claim chưa hoàn: ${claims.filter((c) => !c.creditNote).length}. Chương trình đang chạy: ${programs.filter((p) => ['APPROVED', 'CLAIMING'].includes(p.status)).length}.`);
  }
  if (mode !== 'TRADING') {
    const live = jobs.filter((j) => !j.lostAt);
    const st = (s: JobStage) => live.filter((j) => jobStageOf(j, workOrders, installJobs, receipts) === s).length;
    lines.push(`Đơn hàng công trình: chờ khảo sát ${st('SURVEY')}, đã báo giá ${st('QUOTED')}, đang sản xuất ${st('PRODUCTION')}, chờ lắp ${st('INSTALL')}, chờ thu tiền ${st('WAIT_PAYMENT')}.`);
  }
  const debt = customers.filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 5);
  if (debt.length) lines.push(`Công nợ lớn: ${debt.map((c) => `${c.name} ${compact(c.debt)}/${compact(c.creditLimit)}`).join('; ')}.`);
  const top = [...customers].sort((a, b) => b.ytdRevenue - a.ytdRevenue).slice(0, 5);
  if (top.length) lines.push(`Doanh số YTD cao nhất: ${top.map((c) => `${c.name} ${compact(c.ytdRevenue)} (năm trước ${compact(c.lastYearRevenue)})`).join('; ')}.`);
  return lines.join('\n');
}

/** Kiến thức chính sách liên quan đến câu hỏi (tìm theo từ khóa) */
export function kbFor(kb: KbItem[], q: string, n = 4): KbItem[] {
  const t = fold(q);
  return kb.map((k) => ({ k, s: [...k.tags, ...k.title.split(/\s+/)].filter((w) => w.length > 2 && t.includes(fold(w))).length })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.k);
}

export function suggestLinks(conv: ZaloConv, msgs: ZaloMsg[], app: Pick<AppCtx, 'customers' | 'leads' | 'jobs' | 'quotes' | 'pos'>): LinkHit[] {
  const { customers, leads, jobs, quotes, pos } = app;
  const text = fold([conv.displayName, conv.address ?? '', ...msgs.filter((m) => m.dir === 'IN').map((m) => m.text)].join(' \n '));
  const p9 = digits9(conv.phone) || (text.match(/(?:\+?84|0)\d{9}/)?.[0] ? digits9(text.match(/(?:\+?84|0)\d{9}/)?.[0]) : '');
  const gname = givenName(conv.displayName);
  const nameTokens = new Set([gname, ...(text.match(/\b(?:co|chu|anh|chi|bac|ong|ba)\s+([a-z]+)/g) ?? []).map((x) => x.split(/\s+/)[1])].filter((x) => x.length >= 2));
  const out: LinkHit[] = [];
  const add = (h: LinkHit) => { const ex = out.find((x) => x.kind === h.kind && x.id === h.id); if (ex) { if (h.score > ex.score) Object.assign(ex, h); } else out.push(h); };
  customers.forEach((c) => {
    if (p9 && digits9(c.contactPhone) === p9) return add({ kind: 'customer', id: c.id, label: c.name, sub: `${c.code} · ${c.contactPhone}`, score: 100, why: 'Trùng số điện thoại' });
    if (fold(text).includes(fold(c.code))) return add({ kind: 'customer', id: c.id, label: c.name, sub: c.code, score: 90, why: `Khách nhắc mã ${c.code}` });
    const nm = nameTokens.has(givenName(c.contactName || c.name)) || nameTokens.has(givenName(c.name));
    const place = placeChunks(c.address).find((p) => text.includes(p));
    if (nm && place) add({ kind: 'customer', id: c.id, label: c.name, sub: `${c.code} · ${c.address}`, score: 75, why: `Trùng tên và địa chỉ (${place})` });
    else if (nm) add({ kind: 'customer', id: c.id, label: c.name, sub: `${c.code} · ${c.address}`, score: 35, why: 'Trùng tên gọi' });
  });
  leads.forEach((l) => {
    if (p9 && digits9(l.phone) === p9) add({ kind: 'lead', id: l.id, label: l.company, sub: `${l.code} · ${LEAD_STATUS[l.status].label}`, score: 95, why: 'Trùng số điện thoại' });
    else if (text.includes(fold(l.code))) add({ kind: 'lead', id: l.id, label: l.company, sub: l.code, score: 90, why: `Khách nhắc mã ${l.code}` });
  });
  jobs.forEach((j) => {
    const c = customers.find((x) => x.id === j.customerId);
    if (text.includes(fold(j.code))) return add({ kind: 'job', id: j.id, label: j.title, sub: j.code, score: 92, why: `Khách nhắc mã ${j.code}` });
    if (p9 && (digits9(j.sitePhone) === p9 || digits9(c?.contactPhone) === p9)) return add({ kind: 'job', id: j.id, label: j.title, sub: `${j.code} · ${j.siteAddress}`, score: 90, why: 'Trùng số điện thoại công trình' });
    const place = placeChunks(j.siteAddress).find((p) => text.includes(p));
    const nm = nameTokens.has(givenName(j.siteContact || c?.name || ''));
    if (place && nm) add({ kind: 'job', id: j.id, label: j.title, sub: `${j.code} · ${j.siteAddress}`, score: 78, why: `Trùng tên và địa chỉ công trình (${place})` });
  });
  quotes.forEach((q) => { if (text.includes(fold(q.code))) add({ kind: 'quote', id: q.id, label: `Báo giá ${q.code}`, sub: compact(q.amount), score: 90, why: `Khách nhắc mã ${q.code}` }); });
  pos.forEach((p) => { if (text.includes(fold(p.code))) add({ kind: 'po', id: p.id, label: p.code, sub: p.vendor, score: 85, why: `Nhắc mã ${p.code}` }); });
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

/** Khách hàng chính của hội thoại: liên kết trực tiếp, hoặc suy ra từ đơn / lead đã liên kết */
export function convCustomer(conv: ZaloConv, app: Pick<AppCtx, 'customers' | 'leads' | 'jobs'>): Customer | undefined {
  const links = conv.links ?? [];
  const id = links.find((l) => l.kind === 'customer')?.id
    ?? app.jobs.find((j) => links.some((l) => l.kind === 'job' && l.id === j.id))?.customerId
    ?? app.leads.find((x) => links.some((l) => l.kind === 'lead' && l.id === x.id))?.customerId;
  return app.customers.find((c) => c.id === id);
}

