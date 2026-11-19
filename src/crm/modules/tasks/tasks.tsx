'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, Pencil, UserPlus, XCircle } from 'lucide-react';
import { Avatar, Pagination, RowMenu, usePaged, useSelection } from '../../components/controls';
import { ChipFilter, FilterBar } from '../../components/filters';
import { Sla } from '../../components/sla';
import { Chip, EmptyState, Field, Modal, Panel, Table, Tabs, useSticky, ViewSwitch } from '../../components/ui';
import { latestContracts } from '../../lib/business';
import { ACTIVITY_TYPE, btnBase, btnGhost, btnPrimary, btnSm, compact, CONTENT_STATUS, dayStart, DECISION_LABEL, EXPENSE_STATUS, fmtDate, fmtDT, fmtN, groupOf, HS_CLICHES_DEFAULT, HUB_GROUP, HUB_KIND, HUB_SHORT, HUB_SLA, inputBase, inputCls, jobCustName, LEAVE_KIND, needsApproval, openContentReview, platformOfContent, POP_LABEL, progName, PROGRAM_STATUS, rowCls, SALE_PAY, saleGoods, SOURCE_LABEL, stCompanyOf, tdCls, tdFirst, tdLast, todayISO, useApp, vnd, VOUCHER_META, WF_DEFAULTS, wfFormVals, wsPushVersion } from '../../lib/core';
import { saleTotals } from '../../lib/getfly';
import type { Activity, ApprovalDecision, ApprovalKind, DeptCode, DesignStatus, GeneratedDoc, HubGroup, HubItem, Lead, MineItem, MktContent, Module, Receipt, SaleStatus, StockReservation, User, Verification, WfSubject } from '../../lib/types';
import { cn, wfCan, wfPath } from '../../lib/utils';
import { advanceCash, expenseCash, receiptCash } from '../../lib/workshop';
import { contentToArticle, getPlatform } from '../marketing/content-studio';
import { wsMakeVersion } from '../marketing/content-workspace';
import { DecideReleaseModal } from '../supply/inventory';
import { RequestsPanel } from './requests';

export function slaInfo(requestedAt: number, slaMin: number, now: number) {
  const deadline = requestedAt + slaMin * 60_000;
  const left = deadline - now;
  const abs = Math.abs(left);
  const d = Math.floor(abs / 864e5), h = Math.floor((abs % 864e5) / 3.6e6), m = Math.max(1, Math.round((abs % 3.6e6) / 60_000));
  const span = d ? `${d} ngày${h ? ` ${h} giờ` : ''}` : h ? `${h} giờ${m && m < 60 ? ` ${m} phút` : ''}` : `${m} phút`;
  const ratio = left / (slaMin * 60_000);
  return { text: left >= 0 ? `Còn ${span}` : `Quá ${span}`, overdue: left < 0, tight: left >= 0 && ratio < 0.25, deadline };
}

/** Xây hàng đợi duyệt của người đang đăng nhập và danh sách yêu cầu họ đã gửi */
export function useApprovalQueue() {
  const app = useApp();
  const { me, users, leads, quotes, setQuotes, genDocs, setGenDocs, activities, setActivities, programs, setPrograms, setBudget, claims, setClaims,
    reservations, canRelease, customers, approvalLogs, logDecision, dispatch, notify, openComposer, openClaim, assignLead, setLeads, departments, userName,
    jobs, receipts, setReceipts, openJob, mfgConfig, audit, role, canDo } = app;
  const userOf = (id?: string) => users.find((u) => u.id === id);
  const tell = (to: string | undefined, title: string, body: string, module: Module = 'tasks') => { const u = userOf(to); if (u && u.id !== me.id) dispatch('APPROVAL_RESULT', { to: u, title, body, module }); };
  const done = (kind: ApprovalKind, refId: string, title: string, requesterId: string | undefined, decision: ApprovalDecision, note: string | undefined, amount: number | undefined, msg: string) => {
    logDecision({ kind, refId, title, requesterId, decision, note, amount });
    tell(requesterId, `${DECISION_LABEL[decision].label}: ${title}`, note ?? msg);
    notify(msg, decision === 'APPROVED' ? 'teal' : 'orange');
  };
  const leadOf = (id?: string) => leads.find((l) => l.id === id);
  const deptOfDoc = (d: GeneratedDoc) => leadOf(d.leadId)?.dept ?? customers.find((c) => c.id === d.customerId)?.dept;
  const wctx = app.wfCtx();
  /** Bước hiện tại của yêu cầu theo quy trình (fixed: quy trình có trạng thái nghiệp vụ riêng cho từng bước) */
  const flowOf = (key: string, refId: string, s: WfSubject, startedAt: number, fixed?: number) => {
    const def = app.wfDef(key);
    const run = fixed === undefined ? app.wfRuns.find((r) => r.key === key && r.refId === refId && r.status === 'PENDING') : undefined;
    const steps = run?.steps ?? (def ? wfPath(def, s) : []);
    const idx = fixed ?? (run ? run.decisions.filter((d) => d.decision === 'APPROVED').length : 0);
    const step = steps[Math.min(idx, steps.length - 1)];
    const at = run?.decisions[run.decisions.length - 1]?.at ?? startedAt;
    const can = step ? wfCan(step, s, wctx, at) : { ok: false, escalated: false, who: [] as User[], onBehalf: undefined as string | undefined, self: undefined as boolean | undefined };
    return { def, steps, idx, step, at, can, key, refId, s };
  };
  type Flow = ReturnType<typeof flowOf>;
  const stepSub = (f: Flow) => (f.steps.length > 1 ? ` · bước ${Math.min(f.idx, f.steps.length - 1) + 1}/${f.steps.length}: ${f.step?.name ?? ''}` : '');
  const flagOf = (f: Flow, other?: string) => (f.can.onBehalf ? `Duyệt thay ${userName(f.can.onBehalf)}` : f.can.escalated ? 'Quá hạn, đã chuyển cấp trên' : f.can.self ? 'Tự duyệt (Giám đốc duy nhất)' : other);
  /** Nút duyệt / từ chối / yêu cầu bổ sung đi qua bộ máy quy trình */
  const actsOf = (f: Flow, kind: ApprovalKind, title: string, final: () => void, reject: (n: string) => void, needInfo?: (n: string) => void) => {
    const base = { key: f.key, kind, refId: f.refId, title, subject: f.s, steps: f.steps, idx: Math.min(f.idx, f.steps.length - 1), onBehalf: f.can.onBehalf, self: f.can.self };
    return {
      approve: () => app.wfDecide({ ...base, decision: 'APPROVED', final }),
      reject: (n: string) => app.wfDecide({ ...base, decision: 'REJECTED', note: n, reject }),
      needInfo: needInfo && f.step?.allowNeedInfo !== false ? (n: string) => app.wfDecide({ ...base, decision: 'NEED_INFO', note: n, needInfo }) : undefined,
    };
  };

  const todo: HubItem[] = [];

  // ---- Giá báo giá (bản đã điều chỉnh thì rời hàng chờ) ----
  for (const q of quotes) {
    const a = q.approval;
    if (!a || a.status !== 'PENDING' || q.status === 'REVISED' || q.status === 'REJECTED') continue;
    const l = leadOf(q.leadId);
    const dept = l?.dept ?? customers.find((c) => c.id === q.customerId)?.dept;
    const s: WfSubject = { requesterId: a.requestedBy, dept, amount: q.amount, vals: { gm: q.gmPct ?? null, amount: q.amount, maxDisc: Math.max(0, ...q.lines.map((x) => x.discountPct)) } };
    const f = flowOf('QUOTE', q.id, s, a.requestedAt);
    if (!f.can.ok) continue;
    const name = q.quoteForm?.party.name ?? l?.company ?? customers.find((c) => c.id === q.customerId)?.name ?? '';
    const title = `${q.code} v${q.version}: ${name}`;
    const set = (st: ApprovalDecision, note?: string) => setQuotes((p) => p.map((x) => (x.id === q.id ? { ...x, approval: { ...a, status: st, decidedBy: me.id, decidedAt: Date.now(), note } } : x)));
    todo.push({
      key: `q-${q.id}`, kind: 'QUOTE', refId: q.id, title, sub: `${compact(q.amount)} trước VAT${q.gmPct !== undefined && canDo('price.viewCost') ? `, GM ${q.gmPct.toFixed(1)}%` : ''}${stepSub(f)}`,
      reason: a.reasons.join('; '), requesterId: a.requestedBy, deptCode: dept, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.QUOTE, amount: q.amount,
      flagged: flagOf(f, f.steps.some((x) => x.who.role === 'BOD') ? 'Cần Giám đốc' : undefined), nextStep: f.idx < f.steps.length - 1 ? `Chuyển ${f.steps[f.idx + 1].name}` : 'Mở khóa xuất PDF báo giá',
      ...actsOf(f, 'QUOTE', title,
        () => { set('APPROVED'); done('QUOTE', q.id, title, a.requestedBy, 'APPROVED', undefined, q.amount, `Đã duyệt giá ${q.code}. Báo giá được mở khóa xuất PDF.`); },
        (n) => { set('REJECTED', n); done('QUOTE', q.id, title, a.requestedBy, 'REJECTED', n, q.amount, `Đã từ chối báo giá ${q.code}`); },
        (n) => { set('NEED_INFO', n); done('QUOTE', q.id, title, a.requestedBy, 'NEED_INFO', n, q.amount, `Đã yêu cầu sửa báo giá ${q.code}`); }),
      view: () => openComposer({ quoteId: q.id, leadId: q.leadId || undefined, mode: 'QUOTE' }),
    });
  }
  // ---- Hợp đồng ----
  for (const d of latestContracts(genDocs)) {
    if (d.status !== 'PENDING_APPROVAL') continue;
    const s: WfSubject = { requesterId: d.createdBy, dept: deptOfDoc(d), amount: d.total, vals: { amount: d.total, special: d.special.length } };
    const f = flowOf('CONTRACT', d.id, s, d.submittedAt ?? dayStart(d.createdAt));
    if (!f.can.ok) continue;
    const title = `${d.contractCode} v${d.version ?? 1}: ${d.partyName}`;
    const set = (p: Partial<GeneratedDoc>) => setGenDocs((all) => all.map((x) => (x.id === d.id ? { ...x, ...p } : x)));
    todo.push({
      key: `c-${d.id}`, kind: 'CONTRACT', refId: d.id, title, sub: `${compact(d.total)} sau VAT${stepSub(f)}`, reason: d.special.join('; '), requesterId: d.createdBy, deptCode: deptOfDoc(d),
      requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.CONTRACT, amount: d.total, flagged: flagOf(f), nextStep: f.idx < f.steps.length - 1 ? `Chuyển ${f.steps[f.idx + 1].name}` : 'Hợp đồng có hiệu lực, xuất được PDF',
      ...actsOf(f, 'CONTRACT', title,
        () => { set({ status: 'APPROVED', approvedBy: me.id, approvedAt: todayISO() }); done('CONTRACT', d.id, title, d.createdBy, 'APPROVED', undefined, d.total, `Đã duyệt hợp đồng ${d.contractCode}, có hiệu lực`); },
        (n) => { set({ status: 'REJECTED', rejectNote: n }); done('CONTRACT', d.id, title, d.createdBy, 'REJECTED', n, d.total, `Đã từ chối hợp đồng ${d.contractCode}`); }),
      view: () => openComposer({ docId: d.id, view: true }),
    });
  }
  // ---- Lịch công tác / nghỉ / giải trình ----
  for (const a of activities) {
    if (a.status !== 'PENDING_APPROVAL') continue;
    const owner = userOf(a.userId);
    const days = Math.max(1, Math.ceil((Date.parse(a.to) - Date.parse(a.from)) / 864e5));
    const s: WfSubject = { requesterId: a.userId, dept: owner?.dept, amount: a.cost || undefined, vals: { amount: a.cost, days } };
    const f = flowOf('ACTIVITY', a.id, s, a.submittedAt ?? dayStart(a.createdAt));
    if (!f.can.ok) continue;
    const what = a.type === 'LEAVE' ? LEAVE_KIND[a.leaveKind ?? 'LEAVE'] : ACTIVITY_TYPE[a.type].label;
    const cust = customers.find((c) => c.id === a.customerId);
    const title = `${owner?.name ?? ''}: ${what}`;
    const set = (p: Partial<Activity>) => setActivities((all) => all.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
    todo.push({
      key: `a-${a.id}`, kind: 'ACTIVITY', refId: a.id, title,
      sub: `${fmtDT(a.from)} – ${fmtDT(a.to)}${cust ? `, gặp ${cust.name}` : ''}${a.location ? `, ${a.location}` : ''}${a.cost ? `, đề xuất ${compact(a.cost)}${a.advance ? ` (tạm ứng ${compact(a.advance)})` : ''}` : ''}${stepSub(f)}`,
      reason: a.note ? `${a.type === 'LEAVE' ? 'Lý do' : 'Mục tiêu'}: ${a.note}` : undefined, requesterId: a.userId, deptCode: owner?.dept,
      requestedAt: f.at, slaMin: a.type === 'LEAVE' && a.leaveKind && a.leaveKind !== 'LEAVE' ? 120 : f.step?.slaMin ?? HUB_SLA.ACTIVITY, amount: a.cost || undefined,
      flagged: flagOf(f, a.type === 'LEAVE' && a.from.slice(0, 10) <= todayISO() ? 'Trong ngày' : undefined),
      nextStep: a.type === 'LEAVE' ? 'Ghi nhận phép / công' : 'Xác nhận công tác, tính công',
      ...actsOf(f, 'ACTIVITY', title,
        () => { set({ status: 'APPROVED', approvedBy: me.id }); const adv = advanceCash(a, users); if (adv) app.postCash(adv); done('ACTIVITY', a.id, title, a.userId, 'APPROVED', undefined, a.cost, `Đã duyệt: ${title}. ${adv ? `Tự sinh phiếu chi tạm ứng ${compact(adv.amount)}.` : 'Đã xác nhận công.'}`); },
        (n) => { set({ status: 'REJECTED', rejectNote: n }); done('ACTIVITY', a.id, title, a.userId, 'REJECTED', n, a.cost, `Đã từ chối: ${title}`); },
        (n) => { set({ status: 'NEED_INFO', requestNote: n }); done('ACTIVITY', a.id, title, a.userId, 'NEED_INFO', n, a.cost, `Đã yêu cầu bổ sung: ${title}`); }),
    });
  }
  // ---- Chứng từ chi phí công tác: bước 1 Trưởng phòng, bước 2 Kế toán (trạng thái nghiệp vụ riêng) ----
  for (const a of activities) {
    if (a.expenseStatus !== 'SUBMITTED' && a.expenseStatus !== 'HEAD_APPROVED') continue;
    const owner = userOf(a.userId);
    const total = (a.expenses ?? []).reduce((s, x) => s + x.amount, 0);
    const s: WfSubject = { requesterId: a.userId, dept: owner?.dept, amount: total, vals: { amount: total } };
    const stage = a.expenseStatus === 'SUBMITTED' ? 0 : 1;
    const f = flowOf('EXPENSE', a.id, s, a.expenseSubmittedAt ?? dayStart(a.to), stage);
    if (!f.can.ok) continue;
    const acc = stage === 1;
    const title = `${owner?.name ?? ''}: chi phí ${a.title}`;
    const set = (p: Partial<Activity>) => setActivities((all) => all.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
    todo.push({
      key: `e-${a.id}`, kind: 'EXPENSE', refId: a.id, title, sub: `${(a.expenses ?? []).length} chứng từ: ${(a.expenses ?? []).map((x) => x.name).join(', ')} · ${f.step?.name ?? ''}`, requesterId: a.userId, deptCode: owner?.dept,
      requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.EXPENSE, amount: total, flagged: flagOf(f),
      approveLabel: acc ? 'Xác nhận thanh toán' : 'Duyệt chi', nextStep: acc ? 'Ghi nhận đã thanh toán' : 'Chuyển Kế toán thanh toán',
      approve: () => { set({ expenseStatus: acc ? 'PAID' : 'HEAD_APPROVED' }); if (acc) app.postCash(expenseCash(a, users, app.cashEntries)); done('EXPENSE', a.id, title, a.userId, 'APPROVED', f.can.onBehalf ? `Duyệt thay ${userName(f.can.onBehalf)}` : undefined, total, acc ? `Đã thanh toán ${compact(total)}` : `Đã duyệt chi ${compact(total)}, chuyển Kế toán`); },
      reject: (n) => { set({ expenseStatus: 'REJECTED', expenseNote: n }); done('EXPENSE', a.id, title, a.userId, 'REJECTED', n, total, 'Đã từ chối chứng từ chi phí'); },
    });
  }
  // ---- Đề xuất chi quỹ MDF ----
  for (const p of programs) {
    if (p.status !== 'PENDING_INTERNAL') continue;
    const s: WfSubject = { requesterId: p.requestedBy, dept: p.dept, amount: p.held, vals: { amount: p.held } };
    const f = flowOf('PROGRAM', p.id, s, p.requestedAt ?? dayStart(p.start) - 14 * 864e5);
    if (!f.can.ok) continue;
    const title = `${p.code}: ${p.title}`;
    todo.push({
      key: `p-${p.id}`, kind: 'PROGRAM', refId: p.id, title, sub: `${progName(p.type)}, giữ chỗ quỹ ${compact(p.held)} (đề xuất ${compact(p.requested)}, Hãng tài trợ ${p.sharePct}%), ${fmtDate(p.start)}${stepSub(f)}`,
      requesterId: p.requestedBy, deptCode: p.dept, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.PROGRAM, amount: p.held,
      flagged: flagOf(f, p.held >= 50e6 ? 'Trên 50 triệu' : undefined), nextStep: f.idx < f.steps.length - 1 ? `Chuyển ${f.steps[f.idx + 1].name}` : 'Gửi 3M duyệt Pre-Approval',
      ...actsOf(f, 'PROGRAM', title,
        () => { setPrograms((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'PENDING_VENDOR', approvedBy: me.id } : x))); done('PROGRAM', p.id, title, p.requestedBy, 'APPROVED', undefined, p.held, `Đã duyệt nội bộ ${p.code}, chuyển gửi 3M`); },
        (n) => { setBudget((b) => ({ ...b, committed: Math.max(0, b.committed - p.held) })); setPrograms((ps) => ps.map((x) => (x.id === p.id ? { ...x, held: 0, status: 'REJECTED' } : x))); done('PROGRAM', p.id, title, p.requestedBy, 'REJECTED', n, p.held, `Đã từ chối ${p.code}, nhả ${compact(p.held)} về quỹ`); }),
    });
  }
  // ---- Claim: bước 1 thẩm định POP (không phải người đề xuất), bước 2 Kế toán đối soát hóa đơn ----
  for (const c of claims) {
    const pendingProofs = c.proofs.filter((x) => x.verification === 'PENDING');
    const title = `${c.code}: ${c.programTitle}`;
    const prog = programs.find((x) => x.id === c.programId);
    const s: WfSubject = { requesterId: prog?.requestedBy, dept: c.dept, amount: c.claimed, vals: { amount: c.claimed } };
    if (!c.submitted && pendingProofs.length) {
      const f = flowOf('CLAIM', c.id, s, Date.now() - (30 - Math.min(30, c.daysLeft)) * 864e5, 0);
      if (!f.can.ok) continue;
      const setP = (v: Verification) => setClaims((all) => all.map((x) => (x.id === c.id ? { ...x, proofs: x.proofs.map((pf) => (pf.verification === 'PENDING' ? { ...pf, verification: v } : pf)) } : x)));
      todo.push({
        key: `pop-${c.id}`, kind: 'CLAIM', refId: c.id, title, sub: `Thẩm định ${pendingProofs.length} chứng từ POP (${pendingProofs.map((x) => POP_LABEL[x.type] ?? x.type).join(', ')}), claim ${compact(c.claimed)}`,
        requesterId: prog?.requestedBy, deptCode: c.dept, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.CLAIM, amount: c.claimed,
        flagged: flagOf(f, c.daysLeft <= 5 ? `Còn ${c.daysLeft} ngày nộp 3M` : undefined), approveLabel: 'Đạt, nghiệm thu', nextStep: 'Hồ sơ sẵn sàng nộp 3M',
        approve: () => { setP('VERIFIED'); done('CLAIM', c.id, title, prog?.requestedBy, 'APPROVED', undefined, c.claimed, `Đã nghiệm thu POP ${c.code}`); },
        reject: (n) => { setP('REJECTED'); done('CLAIM', c.id, title, prog?.requestedBy, 'REJECTED', n, c.claimed, `Chứng từ ${c.code} không đạt, yêu cầu tải lại`); },
        view: () => openClaim(c.id),
      });
    } else if (c.submitted && !c.vatCheck && c.invoice) {
      const f = flowOf('CLAIM', c.id, s, dayStart(c.invoice.date), 1);
      if (!f.can.ok) continue;
      todo.push({
        key: `vat-${c.id}`, kind: 'CLAIM', refId: c.id, title, sub: `Đối soát hóa đơn ${c.invoice.serial}-${c.invoice.number}, ${compact(c.invoice.amount)} so với claim ${compact(c.claimed)}`,
        requesterId: prog?.requestedBy, deptCode: c.dept, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.CLAIM, amount: c.invoice.amount,
        flagged: flagOf(f, c.invoice.amount !== c.claimed ? 'Lệch số tiền' : undefined), approveLabel: 'Hóa đơn khớp', nextStep: 'Chờ 3M duyệt thanh toán / cấn trừ',
        approve: () => { setClaims((all) => all.map((x) => (x.id === c.id ? { ...x, vatCheck: 'MATCHED' } : x))); done('CLAIM', c.id, title, prog?.requestedBy, 'APPROVED', 'Hóa đơn khớp', c.invoice?.amount, `${c.code}: hóa đơn khớp`); },
        reject: (n) => { setClaims((all) => all.map((x) => (x.id === c.id ? { ...x, vatCheck: 'MISMATCH', vatNote: n } : x))); done('CLAIM', c.id, title, prog?.requestedBy, 'REJECTED', n, c.invoice?.amount, `${c.code}: ghi nhận lệch hóa đơn`); },
        view: () => openClaim(c.id),
      });
    }
  }
  // ---- Phân lead: Trưởng phòng chỉ định Sales ----
  for (const l of leads) {
    if (l.status !== 'ROUTED' || !(role === 'BOD' || (role === 'DEPT_HEAD' && l.dept === me.dept)) || !canDo('lead.assign')) continue;
    const reps = users.filter((u) => u.active && u.role === 'SALES_REP' && u.dept === l.dept);
    const title = `${l.code}: ${l.company}`;
    todo.push({
      key: `l-${l.id}`, kind: 'LEAD_ASSIGN', refId: l.id, title, sub: `${l.boqNote}${l.boqValue ? `, BOQ ${compact(l.boqValue)}` : ''}, ${SOURCE_LABEL[l.source]}${l.score !== undefined ? `, điểm ${l.score}` : ''}`,
      deptCode: l.dept, requestedAt: l.routedAt ?? Date.now(), slaMin: HUB_SLA.LEAD_ASSIGN, amount: l.boqValue, flagged: (l.score ?? 0) >= 80 ? 'Lead nóng' : undefined,
      nextStep: 'Sales nhận lead, SLA tiếp nhận 2 giờ bắt đầu',
      custom: <AssignInline lead={l} reps={reps} onAssign={(rep) => { assignLead(l.id, rep); logDecision({ kind: 'LEAD_ASSIGN', refId: l.id, title, decision: 'APPROVED', note: `Giao ${userName(rep)}`, amount: l.boqValue }); }} />,
      pick: {
        label: 'Chỉ định',
        options: reps.map((u) => ({ u, n: leads.filter((x) => x.assignee === u.id && ['ASSIGNED', 'ACCEPTED', 'QUOTED'].includes(x.status)).length })).sort((a, b) => a.n - b.n).map(({ u, n }) => ({ id: u.id, label: `${u.name} (${n} việc)` })),
        onPick: (rep) => { assignLead(l.id, rep); logDecision({ kind: 'LEAD_ASSIGN', refId: l.id, title, decision: 'APPROVED', note: `Giao ${userName(rep)}`, amount: l.boqValue }); },
      },
      reject: (n) => {
        setLeads((all) => all.map((x) => (x.id === l.id ? { ...x, status: 'NEW', dept: undefined, routedAt: undefined, routingReason: `Trả về MKT: ${n}` } : x)));
        logDecision({ kind: 'LEAD_ASSIGN', refId: l.id, title, decision: 'REJECTED', note: n, amount: l.boqValue });
        const mkt = users.find((u) => u.role === 'MKT_LEAD' && u.active);
        tell(mkt?.id, `Lead trả về: ${l.company}`, n, 'leads');
        notify(`Đã trả ${l.code} về Marketing phân lại`, 'orange');
      },
    });
  }
  // ---- Giải phóng hàng giữ chỗ (mở hộp quyết định) ----
  for (const r of reservations) {
    if (r.status !== 'PENDING_RELEASE' || !canRelease(r)) continue;
    todo.push({
      key: `s-${r.id}`, kind: 'STOCK', refId: r.id, title: `${r.qty.toLocaleString('vi-VN')} ${r.sku} đang giữ chỗ`, sub: r.releaseRequest?.reason ?? 'Dự án trượt, chờ quyết định',
      requesterId: r.releaseRequest?.by, requestedAt: r.releaseRequest?.at ? Date.parse(r.releaseRequest.at) || Date.now() : Date.now(), slaMin: HUB_SLA.STOCK,
      custom: <ReleaseInline r={r} />,
    });
  }
  // ---- Nội dung marketing (người viết không tự duyệt) ----
  for (const c of app.contents) {
    if (c.status !== 'REVIEW' || c.aiJob?.status === 'QUEUED' || c.aiJob?.status === 'RUNNING') continue;
    const requester = c.submittedBy ?? c.aiJob?.by ?? c.ownerId;
    const s: WfSubject = { requesterId: requester, vals: {} };
    const f = flowOf('CONTENT', c.id, s, c.submittedAt ?? c.aiJob?.at ?? c.updatedAt);
    if (!f.can.ok) continue;
    const title = `Nội dung: ${c.title}`;
    const setC = (p: Partial<MktContent>) => app.setContents((all) => all.map((x) => (x.id === c.id ? { ...x, ...p, updatedAt: Date.now() } : x)));
    const plat = getPlatform(c.platform ?? platformOfContent(c));
    todo.push({
      key: `ct-${c.id}`, kind: 'CONTENT', refId: c.id, title, sub: `${plat.label} · ${c.blocks?.length ?? 0} mục${c.aiJob?.status === 'DONE' ? ' · AI soạn' : ''}${c.settings?.focusKeyword ? ` · từ khóa "${String(c.settings.focusKeyword)}"` : ''}${stepSub(f)}`,
      requesterId: requester, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.CONTENT, nextStep: 'Lên lịch / đăng bài', flagged: flagOf(f),
      ...actsOf(f, 'CONTENT', title,
        () => {
          setC({ status: 'APPROVED', approvedBy: me.id, approvedAt: Date.now(), reviewNote: undefined });
          const co = stCompanyOf(app.company);
          const v = wsMakeVersion(contentToArticle(c, co), co, c.id, 'APPROVED', me.name, app.hubCfg.ai.cliches?.length ? app.hubCfg.ai.cliches : HS_CLICHES_DEFAULT);
          if (v) app.setContentVersions((p) => wsPushVersion(p, v));
          done('CONTENT', c.id, title, requester, 'APPROVED', undefined, undefined, `Đã duyệt "${c.title}"`);
        },
        (n) => { setC({ status: 'DRAFT', reviewNote: n }); done('CONTENT', c.id, title, requester, 'REJECTED', n, undefined, `Đã trả về "${c.title}"`); },
        (n) => { setC({ status: 'DRAFT', reviewNote: n }); done('CONTENT', c.id, title, requester, 'NEED_INFO', n, undefined, `Đã yêu cầu sửa "${c.title}"`); }),
      view: () => openContentReview(c.id),
    });
  }
  // ---- Phiếu thu: kế toán xác nhận tiền về; người thu nộp tiền mặt ----
  for (const r of receipts) {
    const job = jobs.find((j) => j.id === r.jobId);
    const title = `${r.code}: ${vnd(r.amount)}${job ? `, ${job.code} ${job.title}` : ''}`;
    const patch = (p: Partial<Receipt>) => setReceipts((all) => all.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
    const how = r.method === 'CASH' ? 'tiền mặt' : 'chuyển khoản';
    if (r.status === 'SUBMITTED') {
      const f = flowOf('RECEIPT', r.id, { requesterId: r.collectedBy, amount: r.amount, vals: { amount: r.amount } }, r.submittedAt ?? r.collectedAt, 0);
      if (!f.can.ok) continue;
      todo.push({
        key: `rc-${r.id}`, kind: 'RECEIPT', refId: r.id, title, sub: `${how}, ${userName(r.collectedBy)} thu${r.note ? `, ${r.note}` : ''}`,
        requesterId: r.collectedBy, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.RECEIPT, amount: r.amount,
        flagged: flagOf(f, r.method === 'TRANSFER' ? 'Đối chiếu sao kê' : undefined), approveLabel: 'Xác nhận đã nhận', nextStep: 'Ghi nhận doanh số, giảm công nợ',
        approve: () => { patch({ status: 'CONFIRMED', confirmedBy: me.id, confirmedAt: Date.now() }); app.postCash(receiptCash(r, job, customers)); done('RECEIPT', r.id, title, r.collectedBy, 'APPROVED', undefined, r.amount, `Đã xác nhận ${r.code}, ghi nhận doanh số ${vnd(r.amount)}`); },
        reject: (n) => { patch({ status: 'REJECTED', rejectNote: n }); done('RECEIPT', r.id, title, r.collectedBy, 'REJECTED', n, r.amount, `Đã từ chối ${r.code}`); },
        view: job ? () => openJob(job.id) : undefined,
      });
    } else if (r.status === 'HOLDING' && r.collectedBy === me.id) {
      todo.push({
        key: `cash-${r.id}`, kind: 'CASH', refId: r.id, title, sub: `Bạn đang giữ ${vnd(r.amount)} tiền mặt, nộp về kế toán trong ${mfgConfig.submitHours} giờ`,
        requesterId: r.collectedBy, requestedAt: r.collectedAt, slaMin: mfgConfig.submitHours * 60, amount: r.amount, approveLabel: 'Đã nộp kế toán', nextStep: 'Kế toán đếm tiền và xác nhận',
        approve: () => { patch({ status: 'SUBMITTED', submittedAt: Date.now() }); audit('CASH_SUBMIT', `${r.code}: nộp ${vnd(r.amount)} về kế toán`); users.filter((u) => u.active && u.role === 'ACCOUNTANT').forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title: `Nhận tiền mặt ${r.code}: ${vnd(r.amount)}`, body: `${userName(r.collectedBy)} nộp tiền đơn ${job?.code ?? ''}`, module: 'tasks' })); notify('Đã báo kế toán nhận tiền', 'teal'); },
        view: job ? () => openJob(job.id) : undefined,
      });
    }
  }
  // ---- v48: Phiếu kho chờ duyệt ----
  for (const v of app.stockVouchers) {
    if (v.status !== 'PENDING') continue;
    const amount = v.lines.reduce((s, l) => s + l.qty * (l.price ?? 0), 0);
    const s: WfSubject = { requesterId: v.requestedBy, whId: v.whId, amount: amount || undefined, vals: { amount } };
    const f = flowOf('VOUCHER', v.id, s, v.createdAt);
    if (!f.can.ok) continue;
    const meta = VOUCHER_META[v.type];
    const title = `${v.code}: ${meta.label.toLowerCase()}, ${app.warehouses.find((w) => w.id === v.whId)?.name ?? ''}`;
    todo.push({
      key: `sv-${v.id}`, kind: 'VOUCHER', refId: v.id, title, sub: `${v.reason}${v.partner ? `, ${v.partner}` : ''} · ${v.lines.length} dòng: ${v.lines.slice(0, 3).map((l) => `${l.sku} ×${fmtN(l.qty)}`).join(', ')}${stepSub(f)}`,
      requesterId: v.requestedBy, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.VOUCHER, amount: amount || undefined, flagged: flagOf(f), nextStep: f.idx < f.steps.length - 1 ? `Chuyển ${f.steps[f.idx + 1].name}` : `${meta.done}, cập nhật tồn kho`,
      ...actsOf(f, 'VOUCHER', title,
        () => { if (app.approveVoucher(v.id)) done('VOUCHER', v.id, title, v.requestedBy, 'APPROVED', undefined, amount, `Đã duyệt ${v.code}, ${meta.done.toLowerCase()}`); },
        (n) => { app.setStockVouchers((all) => all.map((x) => (x.id === v.id ? { ...x, status: 'CANCELLED', cancelledBy: me.id, cancelReason: n } : x))); done('VOUCHER', v.id, title, v.requestedBy, 'REJECTED', n, amount, `Đã từ chối ${v.code}`); }),
      view: () => app.go('warehouse'),
    });
  }
  // ---- v48: Đơn bán: duyệt giảm giá / vượt hạn mức nợ; yêu cầu xuất kho; tiền thu chờ xác nhận ----
  for (const o of app.salesOrders) {
    if (o.status === 'CANCELLED') continue;
    const t = saleTotals(o).grand;
    const cust = customers.find((c) => c.id === o.customerId);
    const title = `${o.code}: ${o.customer}`;
    if (o.approval?.status === 'PENDING') {
      const s: WfSubject = { requesterId: o.approval.requestedBy ?? o.by, dept: cust?.dept, amount: t, vals: { amount: t, maxDisc: Math.max(0, ...o.lines.map((l) => l.discountPct)) } };
      const f = flowOf('SALE', o.id, s, o.approval.requestedAt);
      if (f.can.ok) {
        const ap = o.approval;
        const setA = (st: ApprovalDecision, n?: string) => app.setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, approval: { ...ap, status: st, decidedBy: me.id, decidedAt: Date.now(), note: n }, ...(st === 'REJECTED' ? { status: 'CANCELLED' as SaleStatus, cancelReason: `Không duyệt: ${n}`, cancelledAt: Date.now() } : {}) } : x)));
        todo.push({
          key: `so-${o.id}`, kind: 'SALE', refId: o.id, title, sub: `${fmtN(t)} sau VAT, ${SALE_PAY[o.pay]}${o.creditDays ? ` ${o.creditDays} ngày` : ''}${stepSub(f)}`, reason: ap.reasons.join('; '),
          requesterId: ap.requestedBy ?? o.by, deptCode: cust?.dept, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.SALE, amount: t, flagged: flagOf(f), nextStep: 'Cho phép xuất kho',
          ...actsOf(f, 'SALE', title,
            () => { setA('APPROVED'); done('SALE', o.id, title, ap.requestedBy ?? o.by, 'APPROVED', undefined, t, `Đã duyệt đơn bán ${o.code}, xuất kho được`); },
            (n) => { setA('REJECTED', n); done('SALE', o.id, title, ap.requestedBy ?? o.by, 'REJECTED', n, t, `Đã từ chối đơn bán ${o.code}, đơn đã hủy, nhả hàng giữ`); }),
          view: () => { app.go('sales'); app.setOpenSale(o.id); },
        });
      }
    }
    if (o.status === 'PENDING' && o.issueRequest && o.approval?.status !== 'PENDING') {
      const s: WfSubject = { requesterId: o.issueRequest.by, whId: o.whId, amount: t, vals: { amount: t } };
      const f = flowOf('VOUCHER', `issue-${o.id}`, s, o.issueRequest.at);
      if (f.can.ok) todo.push({
        key: `si-${o.id}`, kind: 'VOUCHER', refId: o.id, title: `Xuất kho ${title}`, sub: `${o.lines.length} dòng: ${saleGoods(o)}${stepSub(f)}`, requesterId: o.issueRequest.by, deptCode: cust?.dept,
        requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.VOUCHER, amount: t, flagged: flagOf(f), approveLabel: 'Duyệt xuất kho', nextStep: 'Lập phiếu xuất kho, trừ tồn',
        ...actsOf({ ...f, refId: `issue-${o.id}` }, 'VOUCHER', `Xuất kho ${title}`,
          () => { if (app.issueSale(o.id)) done('VOUCHER', o.id, `Xuất kho ${title}`, o.issueRequest?.by, 'APPROVED', undefined, t, `Đã duyệt xuất kho ${o.code}`); },
          (n) => { app.setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, issueRequest: undefined } : x))); done('VOUCHER', o.id, `Xuất kho ${title}`, o.issueRequest?.by, 'REJECTED', n, t, `Đã trả yêu cầu xuất kho ${o.code}`); }),
        view: () => { app.go('sales'); app.setOpenSale(o.id); },
      });
    }
    for (const p of o.payments.filter((x) => !x.confirmed)) {
      const s: WfSubject = { requesterId: p.by, amount: p.amount, vals: { amount: p.amount } };
      const f = flowOf('SALE_PAY', p.id, s, p.at, 0);
      if (!f.can.ok) continue;
      todo.push({
        key: `sp-${p.id}`, kind: 'SALE_PAY', refId: p.id, title: `${o.code}: ${vnd(p.amount)}`, sub: `${p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}, ${userName(p.by)} ghi nhận, khách ${o.customer}`, requesterId: p.by,
        requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.SALE_PAY, amount: p.amount, flagged: flagOf(f, p.method === 'BANK' ? 'Đối chiếu sao kê' : undefined), approveLabel: 'Xác nhận đã nhận', nextStep: 'Vào sổ quỹ, giảm công nợ',
        approve: () => { app.confirmSalePayment(o.id, p.id); logDecision({ kind: 'SALE_PAY', refId: p.id, title: `${o.code}: ${vnd(p.amount)}`, requesterId: p.by, decision: 'APPROVED', amount: p.amount }); tell(p.by, `Kế toán đã nhận ${vnd(p.amount)}`, `Đơn bán ${o.code}`, 'sales'); },
        reject: (n) => { app.setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, payments: x.payments.filter((y) => y.id !== p.id) } : x))); done('SALE_PAY', p.id, `${o.code}: ${vnd(p.amount)}`, p.by, 'REJECTED', n, p.amount, `Đã gỡ khoản ${vnd(p.amount)} khỏi ${o.code}`); },
        view: () => { app.go('sales'); app.setOpenSale(o.id); },
      });
    }
  }
  // ---- v48: Báo giá xưởng lãi gộp thấp ----
  for (const j of jobs) {
    const q = j.quotes[j.quotes.length - 1];
    const ap = q?.approval;
    if (!q || ap?.status !== 'PENDING') continue;
    const s: WfSubject = { requesterId: ap.requestedBy, dept: j.dept, amount: q.total, vals: { gm: ap.gm ?? null, amount: q.total } };
    const f = flowOf('JOB_QUOTE', q.id, s, ap.requestedAt);
    if (!f.can.ok) continue;
    const title = `${j.code} v${q.version}: ${jobCustName(j, customers)}`;
    const setQ = (st: ApprovalDecision, n?: string) => app.setJobs((all) => all.map((x) => (x.id === j.id ? { ...x, quotes: x.quotes.map((y) => (y.id === q.id ? { ...y, approval: { ...ap, status: st, decidedBy: me.id, decidedAt: Date.now(), note: n } } : y)) } : x)));
    todo.push({
      key: `jq-${q.id}`, kind: 'JOB_QUOTE', refId: q.id, title, sub: `${vnd(q.total)}${ap.gm !== undefined && canDo('price.viewCost') ? `, lãi gộp dự toán ${ap.gm.toFixed(1)}%` : ''}${stepSub(f)}`, reason: ap.reasons.join('; '),
      requesterId: ap.requestedBy, deptCode: j.dept, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.JOB_QUOTE, amount: q.total, flagged: flagOf(f), nextStep: 'Mở khóa in báo giá, nhận cọc',
      ...actsOf(f, 'JOB_QUOTE', title,
        () => { setQ('APPROVED'); done('JOB_QUOTE', q.id, title, ap.requestedBy, 'APPROVED', undefined, q.total, `Đã duyệt báo giá ${j.code} v${q.version}`); },
        (n) => { setQ('REJECTED', n); done('JOB_QUOTE', q.id, title, ap.requestedBy, 'REJECTED', n, q.total, `Đã từ chối báo giá ${j.code} v${q.version}`); },
        (n) => { setQ('NEED_INFO', n); done('JOB_QUOTE', q.id, title, ap.requestedBy, 'NEED_INFO', n, q.total, `Đã yêu cầu sửa báo giá ${j.code}`); }),
      view: () => openJob(j.id),
    });
  }
  // ---- v48: Bản vẽ triển khai chờ duyệt ----
  for (const w of app.workOrders) {
    if (w.design?.status !== 'REVIEW') continue;
    const s: WfSubject = { requesterId: w.design.by, vals: {} };
    const f = flowOf('DESIGN', w.id, s, w.design.at ?? Date.now());
    if (!f.can.ok) continue;
    const title = `${w.code}: bản vẽ ${w.title}`;
    const setD = (status: DesignStatus, n?: string) => app.setWorkOrders((all) => all.map((x) => (x.id === w.id ? { ...x, design: { ...x.design, status, by: me.id, at: Date.now(), note: n ?? x.design?.note } } : x)));
    todo.push({
      key: `dw-${w.id}`, kind: 'DESIGN', refId: w.id, title, sub: `${w.items.length} hạng mục, hạn ${fmtDate(w.dueDate)}${stepSub(f)}`, requesterId: w.design.by, requestedAt: f.at, slaMin: f.step?.slaMin ?? HUB_SLA.DESIGN, flagged: flagOf(f), nextStep: 'Cho phép cắt, sản xuất',
      ...actsOf(f, 'DESIGN', title,
        () => { setD('APPROVED'); done('DESIGN', w.id, title, w.design?.by, 'APPROVED', undefined, undefined, `Đã duyệt bản vẽ ${w.code}`); },
        (n) => { setD('DRAFTING', n); done('DESIGN', w.id, title, w.design?.by, 'REJECTED', n, undefined, `Đã trả bản vẽ ${w.code} về vẽ lại`); },
        (n) => { setD('DRAFTING', n); done('DESIGN', w.id, title, w.design?.by, 'NEED_INFO', n, undefined, `Đã yêu cầu sửa bản vẽ ${w.code}`); }),
      view: () => app.go('production'),
    });
  }
  // ---- v48: Đề nghị tự tạo ----
  for (const r of app.wfRuns) {
    if (r.status !== 'PENDING' || WF_DEFAULTS.some((d) => d.key === r.key)) continue;
    const def = app.wfDef(r.key);
    if (!def) continue;
    const s: WfSubject = { requesterId: r.requesterId, dept: r.dept, amount: r.amount, vals: wfFormVals(def, r.form ?? {}) };
    const idx = r.decisions.filter((d) => d.decision === 'APPROVED').length;
    const step = r.steps[Math.min(idx, r.steps.length - 1)];
    if (!step) continue;
    const at = r.decisions[r.decisions.length - 1]?.at ?? r.startedAt;
    const can = wfCan(step, s, wctx, at);
    if (!can.ok) continue;
    const f: Flow = { def, steps: r.steps, idx, step, at, can, key: r.key, refId: r.id, s };
    const title = `${r.code ?? ''}: ${r.title ?? def.name}`;
    todo.push({
      key: `wr-${r.id}`, kind: 'REQUEST', refId: r.id, title, sub: `${def.name}${r.amount ? `, ${vnd(r.amount)}` : ''}${stepSub(f)}`, requesterId: r.requesterId, deptCode: r.dept as DeptCode | undefined,
      requestedAt: at, slaMin: step.slaMin, amount: r.amount, flagged: flagOf(f), nextStep: idx < r.steps.length - 1 ? `Chuyển ${r.steps[idx + 1].name}` : 'Hoàn tất đề nghị',
      ...actsOf(f, 'REQUEST', title, () => app.wfFinishRequest(r.id), () => { tell(r.requesterId, `Từ chối: ${title}`, 'Xem lý do ở mục Đề nghị', 'tasks'); }, () => { tell(r.requesterId, `Yêu cầu bổ sung: ${title}`, 'Sửa và gửi lại ở mục Đề nghị', 'tasks'); }),
      view: () => app.openRequest(r.id),
    });
  }

  // ---- Tôi đã yêu cầu ----
  const lastLog = (refId: string) => approvalLogs.find((x) => x.refId === refId);
  const mine: MineItem[] = [
    ...quotes.filter((q) => q.approval?.requestedBy === me.id).map((q): MineItem => ({
      key: `q-${q.id}`, kind: 'QUOTE', title: `${q.code} v${q.version}: ${q.quoteForm?.party.name ?? leadOf(q.leadId)?.company ?? ''}`, sub: `${compact(q.amount)}. ${q.status === 'REVISED' && q.approval!.status === 'PENDING' ? 'Đã thay bằng bản điều chỉnh' : q.approval!.reasons.join('; ')}`,
      status: q.status === 'REVISED' && q.approval!.status === 'PENDING' ? 'NEED_INFO' : q.approval!.status, requestedAt: q.approval!.requestedAt, slaMin: q.approval!.level === 'BOD' ? 240 : HUB_SLA.QUOTE, deciderId: q.approval!.decidedBy, note: q.approval!.note,
      view: () => openComposer({ quoteId: q.id, leadId: q.leadId || undefined, mode: 'QUOTE' }),
    })),
    ...latestContracts(genDocs).filter((d) => d.createdBy === me.id && d.special.length).map((d): MineItem => ({
      key: `c-${d.id}`, kind: 'CONTRACT', title: `${d.contractCode} v${d.version ?? 1}: ${d.partyName}`, sub: d.special.join('; '),
      status: d.status === 'PENDING_APPROVAL' ? 'PENDING' : d.status === 'REJECTED' ? 'REJECTED' : 'APPROVED', requestedAt: d.submittedAt ?? dayStart(d.createdAt), slaMin: HUB_SLA.CONTRACT,
      deciderId: d.approvedBy ?? lastLog(d.id)?.deciderId, note: d.rejectNote, view: () => openComposer({ docId: d.id, view: true }),
    })),
    ...activities.filter((a) => a.userId === me.id && needsApproval(a) && ['PENDING_APPROVAL', 'NEED_INFO', 'APPROVED', 'REJECTED'].includes(a.status)).map((a): MineItem => ({
      key: `a-${a.id}`, kind: 'ACTIVITY', title: a.title, sub: `${fmtDT(a.from)} – ${fmtDT(a.to)}${a.cost ? `, ${compact(a.cost)}` : ''}`,
      status: a.status === 'PENDING_APPROVAL' ? 'PENDING' : a.status === 'NEED_INFO' ? 'NEED_INFO' : a.status === 'REJECTED' ? 'REJECTED' : 'APPROVED',
      requestedAt: a.submittedAt ?? dayStart(a.createdAt), slaMin: HUB_SLA.ACTIVITY, deciderId: a.approvedBy ?? lastLog(a.id)?.deciderId, note: a.requestNote ?? a.rejectNote,
    })),
    ...activities.filter((a) => a.userId === me.id && a.expenseStatus).map((a): MineItem => ({
      key: `e-${a.id}`, kind: 'EXPENSE', title: `Chi phí: ${a.title}`, sub: `${compact((a.expenses ?? []).reduce((s, x) => s + x.amount, 0))}, ${EXPENSE_STATUS[a.expenseStatus!].label.toLowerCase()}`,
      status: a.expenseStatus === 'SUBMITTED' || a.expenseStatus === 'HEAD_APPROVED' ? 'PENDING' : a.expenseStatus === 'REJECTED' ? 'REJECTED' : 'APPROVED',
      requestedAt: a.expenseSubmittedAt ?? dayStart(a.to), slaMin: HUB_SLA.EXPENSE, deciderId: lastLog(a.id)?.deciderId, note: a.expenseNote,
    })),
    ...programs.filter((p) => p.requestedBy === me.id).map((p): MineItem => ({
      key: `p-${p.id}`, kind: 'PROGRAM', title: `${p.code}: ${p.title}`, sub: `${compact(p.held)}, ${PROGRAM_STATUS[p.status].label}`,
      status: p.status === 'PENDING_INTERNAL' ? 'PENDING' : p.status === 'REJECTED' ? 'REJECTED' : 'APPROVED', requestedAt: p.requestedAt ?? dayStart(p.start) - 14 * 864e5, slaMin: HUB_SLA.PROGRAM,
      deciderId: p.approvedBy ?? lastLog(p.id)?.deciderId, note: lastLog(p.id)?.note,
    })),
    ...receipts.filter((r) => r.collectedBy === me.id && r.status !== 'HOLDING').map((r): MineItem => ({
      key: `rc-${r.id}`, kind: 'RECEIPT', title: `${r.code}: ${vnd(r.amount)}`, sub: `${jobs.find((j) => j.id === r.jobId)?.title ?? ''}, ${r.method === 'CASH' ? 'tiền mặt' : 'chuyển khoản'}`,
      status: r.status === 'SUBMITTED' ? 'PENDING' : r.status === 'REJECTED' ? 'REJECTED' : 'APPROVED', requestedAt: r.submittedAt ?? r.collectedAt, slaMin: HUB_SLA.RECEIPT,
      deciderId: r.confirmedBy ?? lastLog(r.id)?.deciderId, note: r.rejectNote, view: () => openJob(r.jobId),
    })),
    ...app.contents.filter((c) => c.submittedBy === me.id && (c.status !== 'DRAFT' || !!c.reviewNote)).map((c): MineItem => ({
      key: `ct-${c.id}`, kind: 'CONTENT', title: c.title, sub: `${getPlatform(c.platform ?? platformOfContent(c)).label} · ${CONTENT_STATUS[c.status].label}`,
      status: c.status === 'REVIEW' ? 'PENDING' : c.status === 'DRAFT' ? 'NEED_INFO' : 'APPROVED', requestedAt: c.submittedAt ?? c.updatedAt, slaMin: HUB_SLA.CONTENT,
      deciderId: c.approvedBy ?? lastLog(c.id)?.deciderId, note: c.reviewNote,
      view: () => openContentReview(c.id),
    })),
    ...app.stockVouchers.filter((v) => v.requestedBy === me.id && v.status !== 'DONE' || (v.requestedBy === me.id && v.status === 'DONE' && v.approvedBy !== me.id)).slice(0, 30).map((v): MineItem => ({
      key: `sv-${v.id}`, kind: 'VOUCHER', title: `${v.code}: ${VOUCHER_META[v.type].label.toLowerCase()}`, sub: `${v.reason} · ${v.lines.length} dòng`, status: v.status === 'PENDING' ? 'PENDING' : v.status === 'CANCELLED' ? 'REJECTED' : 'APPROVED',
      requestedAt: v.createdAt, slaMin: HUB_SLA.VOUCHER, deciderId: v.approvedBy ?? v.cancelledBy, note: v.cancelReason, view: () => app.go('warehouse'),
    })),
    ...app.salesOrders.filter((o) => o.approval && (o.approval.requestedBy ?? o.by) === me.id).map((o): MineItem => ({
      key: `so-${o.id}`, kind: 'SALE', title: `${o.code}: ${o.customer}`, sub: o.approval!.reasons.join('; '), status: o.approval!.status, requestedAt: o.approval!.requestedAt, slaMin: HUB_SLA.SALE,
      deciderId: o.approval!.decidedBy, note: o.approval!.note, view: () => { app.go('sales'); app.setOpenSale(o.id); },
    })),
    ...jobs.flatMap((j) => j.quotes.filter((q) => q.approval?.requestedBy === me.id).map((q): MineItem => ({
      key: `jq-${q.id}`, kind: 'JOB_QUOTE', title: `${j.code} v${q.version}: ${jobCustName(j, customers)}`, sub: q.approval!.reasons.join('; '), status: q.approval!.status, requestedAt: q.approval!.requestedAt, slaMin: HUB_SLA.JOB_QUOTE,
      deciderId: q.approval!.decidedBy, note: q.approval!.note, view: () => openJob(j.id),
    }))),
    ...app.wfRuns.filter((r) => r.requesterId === me.id && !WF_DEFAULTS.some((d) => d.key === r.key)).map((r): MineItem => ({
      key: `wr-${r.id}`, kind: 'REQUEST', title: `${r.code ?? ''}: ${r.title ?? ''}`, sub: `${app.wfDef(r.key)?.name ?? ''}${r.amount ? `, ${vnd(r.amount)}` : ''}`,
      status: r.status === 'PENDING' ? 'PENDING' : r.status === 'APPROVED' ? 'APPROVED' : r.status === 'NEED_INFO' ? 'NEED_INFO' : 'REJECTED', requestedAt: r.startedAt, slaMin: r.steps[0]?.slaMin ?? HUB_SLA.REQUEST,
      deciderId: r.decisions[r.decisions.length - 1]?.by, note: r.decisions[r.decisions.length - 1]?.note, view: () => app.openRequest(r.id),
    })),
  ];
  void departments;
  return { todo, mine };
}

/** v48: mục chờ duyệt của người đang đăng nhập (dùng cho nút duyệt nhanh ngoài Trung tâm phê duyệt, vẫn theo quy trình) */
export function useHubItem() {
  const { todo } = useApprovalQueue();
  return (kind: ApprovalKind, refId: string) => todo.find((x) => x.kind === kind && x.refId === refId);
}

/** Chọn Sales ngay trên thẻ để chỉ định lead */
export function AssignInline({ lead, reps, onAssign }: { lead: Lead; reps: User[]; onAssign: (repId: string) => void }) {
  const { leads } = useApp();
  const load = (id: string) => leads.filter((l) => l.assignee === id && ['ASSIGNED', 'ACCEPTED', 'QUOTED'].includes(l.status)).length;
  const sorted = [...reps].sort((a, b) => load(a.id) - load(b.id));
  const [rep, setRep] = useState(sorted[0]?.id ?? '');
  if (!reps.length) return <span className="text-xs text-[rgb(var(--danger-fg))]">Phòng chưa có Sales hoạt động</span>;
  return (
    <span className="flex items-center gap-1.5">
      <select className={cn(inputBase, 'w-auto max-w-[150px] py-1 text-xs')} value={rep} onChange={(e) => setRep(e.target.value)} aria-label={`Chọn Sales cho ${lead.code}`}>
        {sorted.map((u) => <option key={u.id} value={u.id}>{u.name} ({load(u.id)} việc)</option>)}
      </select>
      <button className={cn(btnBase, btnSm, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)]')} disabled={!rep} onClick={() => onAssign(rep)}><UserPlus className="h-3.5 w-3.5" aria-hidden />Chỉ định</button>
    </span>
  );
}

export function ReleaseInline({ r }: { r: StockReservation }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={cn(btnPrimary, btnSm)} onClick={() => setOpen(true)}>Quyết định</button>
      {open && <DecideReleaseModal r={r} onClose={() => setOpen(false)} />}
    </>
  );
}

export function SlaBadge({ requestedAt, slaMin, now }: { requestedAt: number; slaMin: number; now: number }) {
  const s = slaInfo(requestedAt, slaMin, now);
  return <Sla tone={s.overdue ? 'over' : s.tight ? 'tight' : 'ok'}>{s.text}</Sla>;
}

export function TasksModule() {
  const { me, role, users, userName, departments, approvalLogs, now: nowRaw, canDo } = useApp();
  const now = nowRaw ?? Date.now();
  const { todo, mine } = useApprovalQueue();
  const [tab, setTab] = useSticky<'todo' | 'mine' | 'history' | 'requests'>('TasksModule.tab', 'todo');
  const { reqOpen, wfRuns } = useApp();
  useEffect(() => { if (reqOpen) setTab('requests'); }, [reqOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useSticky<'table' | 'board'>('TasksModule.view', 'table');
  const [grp, setGrp] = useSticky<'ALL' | HubGroup>('TasksModule.grp', 'ALL');
  const [who, setWho] = useState('ALL');
  const [prio, setPrio] = useState<'ALL' | 'URGENT' | 'NORMAL'>('ALL');
  const [q, setQ] = useSticky('TasksModule.q', '');
  const [modal, setModal] = useState<{ item: HubItem; mode: 'REJECT' | 'NEED_INFO' } | null>(null);
  const [note, setNote] = useState('');
  const [busyKeys, setBusyKeys] = useState<string[]>([]);
  const t = q.trim().toLowerCase();
  const urgentOf = (x: HubItem) => { const s = slaInfo(x.requestedAt, x.slaMin, now); return s.overdue || s.tight || !!x.flagged; };
  const personMatch = (requesterId?: string, deptCode?: DeptCode) => who === 'ALL' || (who.startsWith('d:') ? deptCode === who.slice(2) || users.find((u) => u.id === requesterId)?.dept === who.slice(2) : requesterId === who);

  const todoList = todo.filter((x) => !busyKeys.includes(x.key) && (grp === 'ALL' || groupOf(x.kind) === grp) && personMatch(x.requesterId, x.deptCode) && (prio === 'ALL' || (prio === 'URGENT') === urgentOf(x)) && (!t || `${x.title} ${x.sub} ${x.reason ?? ''}`.toLowerCase().includes(t)))
    .sort((a, b) => Number(urgentOf(b)) - Number(urgentOf(a)) || slaInfo(a.requestedAt, a.slaMin, now).deadline - slaInfo(b.requestedAt, b.slaMin, now).deadline);
  const mineList = mine.filter((x) => (grp === 'ALL' || groupOf(x.kind) === grp) && (!t || `${x.title} ${x.sub}`.toLowerCase().includes(t)))
    .sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING') || b.requestedAt - a.requestedAt);
  const seeAllHistory = role === 'BOD' || role === 'ACCOUNTANT';
  const history = approvalLogs.filter((x) => (seeAllHistory || x.deciderId === me.id || x.requesterId === me.id) && (grp === 'ALL' || groupOf(x.kind) === grp) && personMatch(x.requesterId) && (!t || `${x.title} ${x.note ?? ''}`.toLowerCase().includes(t)));
  const histPaged = usePaged(history, 15);
  const todoPaged = usePaged(todoList, 10);
  const minePaged = usePaged(mineList, 10);
  const sel = useSelection(todoList.filter((x) => !!x.approve).map((x) => x.key));
  const bulkApprove = () => { todoList.filter((x) => sel.has(x.key) && x.approve).forEach(quick); sel.clear(); };
  const deptOf = (uid?: string, code?: DeptCode) => departments.find((d) => d.code === (code ?? users.find((u) => u.id === uid)?.dept))?.short;
  const person = (uid?: string, code?: DeptCode) => uid ? (
    <span className="flex min-w-0 items-center gap-2" title={deptOf(uid, code) ?? undefined}><Avatar name={userName(uid)} size={22} /><span className="block min-w-0 truncate text-sm">{userName(uid)}</span></span>
  ) : <span className="text-xs text-[rgb(var(--muted))]">Hệ thống</span>;
  const kindCell = (k: ApprovalKind) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-[rgb(var(--fg2))]" title={HUB_KIND[k]}><i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: HUB_GROUP[groupOf(k)].color }} />{HUB_SHORT[k]}</span>;
  const sentAt = (t0: number) => new Date(t0).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  const selCls = 'h-4 w-4 accent-[rgb(var(--accent))]';
  const counts = (Object.keys(HUB_GROUP) as HubGroup[]).map((g) => [g, todo.filter((x) => groupOf(x.kind) === g).length] as const);
  const people = users.filter((u) => u.active);

  /** Duyệt nhanh: ẩn thẻ ngay (lạc quan), rồi cập nhật dữ liệu */
  const quick = (x: HubItem) => { setBusyKeys((k) => [...k, x.key]); x.approve?.(); setTimeout(() => setBusyKeys((k) => k.filter((y) => y !== x.key)), 1500); };
  const submitModal = () => {
    if (!modal || note.trim().length < 5) return;
    setBusyKeys((k) => [...k, modal.item.key]);
    if (modal.mode === 'REJECT') modal.item.reject?.(note.trim()); else modal.item.needInfo?.(note.trim());
    setTimeout(() => setBusyKeys((k) => k.filter((y) => y !== modal.item.key)), 1500);
    setModal(null);
    setNote('');
  };

  return (
    <div className="space-y-4">
      {/* Thanh tab */}
      <Tabs tabs={[
        { id: 'todo', label: 'Chờ tôi duyệt', count: todo.length },
        { id: 'mine', label: 'Tôi yêu cầu', count: mine.filter((x) => x.status === 'PENDING').length },
        { id: 'history', label: 'Đã xử lý' },
        { id: 'requests', label: 'Đề nghị', count: wfRuns.filter((r) => r.requesterId === me.id && r.status === 'PENDING').length },
      ]} value={tab} onChange={(v) => { setTab(v); sel.clear(); }}
        aside={tab === 'todo' ? <button className={cn(sel.ids.length ? btnPrimary : btnGhost, btnSm)} disabled={!sel.ids.length} onClick={bulkApprove} title={sel.ids.length ? `Duyệt ${sel.ids.length} yêu cầu đã chọn` : 'Tích chọn các dòng cần duyệt'}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Duyệt chọn{sel.ids.length ? ` (${sel.ids.length})` : ''}</button> : undefined} />

      {tab === 'requests' && <RequestsPanel />}
      {tab !== 'requests' && <>
      {/* Thanh công cụ: tìm kiếm, loại yêu cầu, phòng ban, ưu tiên, duyệt hàng loạt + tag lọc con */}
      <FilterBar q={q} onQ={setQ} placeholder="Tìm mã, khách hàng, lý do…" status={grp} onStatus={(v) => setGrp(v as 'ALL' | HubGroup)} statusLabel="Loại yêu cầu"
        statusOptions={(Object.keys(HUB_GROUP) as HubGroup[]).map((g) => ({ value: g, label: HUB_GROUP[g].label }))} extraActive={(who !== 'ALL' ? 1 : 0) + (prio !== 'ALL' ? 1 : 0)}
        actions={tab === 'todo' ? <ViewSwitch value={view} onChange={setView} options={['table', 'board']} /> : undefined}
        chips={tab === 'todo' ? <ChipFilter value={grp} onChange={(v) => setGrp(v)} total={todo.length} options={counts.filter(([, n]) => n > 0).map(([g, n]) => ({ value: g, label: HUB_GROUP[g].label, count: n, color: HUB_GROUP[g].color }))} /> : undefined}>
        {tab !== 'mine' && (
          <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto sm:max-w-[200px]')} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Phòng ban / nhân sự">
            <option value="ALL">Phòng ban</option>
            <optgroup label="Phòng ban">{departments.filter((d) => d.active).map((d) => <option key={d.code} value={`d:${d.code}`}>{d.short}</option>)}</optgroup>
            <optgroup label="Nhân sự">{people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
          </select>
        )}
        {tab === 'todo' && (
          <select className={cn(inputCls, 'w-full border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 sm:w-auto')} value={prio} onChange={(e) => setPrio(e.target.value as 'ALL' | 'URGENT' | 'NORMAL')} aria-label="Độ ưu tiên">
            <option value="ALL">Độ ưu tiên</option><option value="URGENT">Khẩn cấp</option><option value="NORMAL">Bình thường</option>
          </select>
        )}
      </FilterBar>

      {/* Bảng thông tin hợp nhất */}
      {tab === 'todo' && view === 'board' && (
        <div className="-mx-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-3">
            {(Object.keys(HUB_GROUP) as HubGroup[]).filter((g) => grp === 'ALL' || g === grp).map((g) => {
              const items = todoList.filter((x) => groupOf(x.kind) === g);
              return (
                <section key={g} className="flex w-[300px] shrink-0 flex-col rounded-md border border-[rgb(var(--ink)/0.06)] bg-[rgb(var(--surface)/0.7)]" aria-label={HUB_GROUP[g].label}>
                  <header className="flex items-center gap-2 border-b border-[rgb(var(--ink)/0.06)] px-3 py-2.5">
                    <i className="h-2.5 w-2.5 rounded-full" style={{ background: HUB_GROUP[g].color }} />
                    <h3 className="font-display min-w-0 flex-1 truncate text-sm font-semibold">{HUB_GROUP[g].label}</h3>
                    <span className="font-num rounded-sm bg-[rgb(var(--ink)/0.06)] px-1.5 text-xs text-[rgb(var(--muted))]">{items.length}</span>
                  </header>
                  <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto p-2">
                    {items.map((x) => {
                      const s2 = slaInfo(x.requestedAt, x.slaMin, now);
                      return (
                        <article key={x.key} className={cn('rounded border bg-[rgb(var(--bg))] p-3', s2.overdue || urgentOf(x) ? 'border-[rgb(var(--danger)/0.5)]' : 'border-[rgb(var(--ink)/0.06)]')}>
                          <button className="block w-full text-left" onClick={x.view} disabled={!x.view}>
                            <p className="line-clamp-2 text-sm font-semibold text-[rgb(var(--fg))] hover:text-[rgb(var(--accent-fg))]">{x.title}</p>
                            <p className={cn('mt-0.5 line-clamp-2 text-xs', x.reason ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{x.reason ?? x.sub}</p>
                          </button>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {x.requesterId ? <span className="flex min-w-0 items-center gap-1.5 text-xs text-[rgb(var(--muted))]"><Avatar name={userName(x.requesterId)} size={20} /><span className="truncate">{userName(x.requesterId)}</span></span> : <span className="text-xs text-[rgb(var(--muted))]">Hệ thống</span>}
                            {x.amount ? <span className="font-num shrink-0 text-xs font-semibold text-[rgb(var(--fg))]">{compact(x.amount)}</span> : null}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <SlaBadge requestedAt={x.requestedAt} slaMin={x.slaMin} now={now} />
                            <div className="flex items-center gap-1">
                              {x.approve && <button className={cn(btnBase, 'whitespace-nowrap border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] px-2 py-1 text-xs font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => quick(x)}>{x.approveLabel ?? 'Duyệt'}</button>}
                              <RowMenu items={[
                                ...(x.view ? [{ label: 'Xem chi tiết', icon: Eye, onClick: x.view }] : []),
                                ...(x.needInfo ? [{ label: 'Yêu cầu sửa / bổ sung', icon: Pencil, onClick: () => { setModal({ item: x, mode: 'NEED_INFO' }); setNote(''); } }] : []),
                                ...(x.reject ? [{ label: x.kind === 'LEAD_ASSIGN' ? 'Trả về MKT' : 'Từ chối', icon: XCircle, danger: true, onClick: () => { setModal({ item: x, mode: 'REJECT' }); setNote(''); } }] : []),
                              ]} />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    {!items.length && <p className="rounded border border-dashed border-[rgb(var(--ink)/0.08)] px-3 py-6 text-center text-xs text-[rgb(var(--faint))]">Không có yêu cầu</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'todo' && view === 'table' && (
        <Panel>
          <Table stt={Math.max(0, todoPaged.from - 1)} minW={1000} head={[
            <input key="all" type="checkbox" className={selCls} checked={sel.allOn} onChange={sel.toggleAll} aria-label="Chọn tất cả" disabled={!todoList.some((x) => x.approve)} />,
            'Nội dung', <span key="m" className="block text-right">Số tiền</span>, 'Loại', 'Người đề nghị', 'Phòng', 'Gửi lúc', 'SLA', 'Lưu ý', <span key="act" className="block text-right">Thao tác</span>,
          ]}>
            {todoPaged.slice.map((x) => {
              const urgent = urgentOf(x);
              const s = slaInfo(x.requestedAt, x.slaMin, now);
              return (
                <tr key={x.key} className={cn(rowCls, sel.has(x.key) && 'bg-[rgb(var(--accent)/0.05)]')}>
                  <td className={cn(tdFirst, 'w-10')}><input type="checkbox" className={selCls} checked={sel.has(x.key)} onChange={() => sel.toggle(x.key)} disabled={!x.approve} aria-label={`Chọn ${x.title}`} /></td>
                  <td className={cn(tdCls, 'max-w-[340px]')}>
                    <button className="block max-w-full text-left" onClick={x.view} disabled={!x.view} title={[x.sub, x.reason].filter(Boolean).join('\n')}>
                      <span className="block truncate font-medium text-[rgb(var(--fg))] hover:underline">{x.title}</span>
                    </button>
                  </td>
                  <td className={cn(tdCls, 'text-right tabular-nums')}>{x.amount ? compact(x.amount) : <span className="text-[rgb(var(--faint))]">—</span>}</td>
                  <td className={tdCls}>{kindCell(x.kind)}</td>
                  <td className={cn(tdCls, 'max-w-[180px]')}>{person(x.requesterId, x.deptCode)}</td>
                  <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{x.requesterId ? deptOf(x.requesterId, x.deptCode) ?? '—' : '—'}</td>
                  <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--muted))]')}>{sentAt(x.requestedAt)}</td>
                  <td className={tdCls}><SlaBadge requestedAt={x.requestedAt} slaMin={x.slaMin} now={now} /></td>
                  <td className={cn(tdCls, 'text-[13px]', (s.overdue || urgent) && !x.flagged ? 'text-[rgb(var(--muted))]' : 'text-[rgb(var(--warn))]')}>{x.flagged ?? '—'}</td>
                  <td className={tdLast}>
                    <div className="flex items-center justify-end gap-1.5">
                      {x.pick ? <RowMenu text={x.pick.label} icon={UserPlus} items={x.pick.options.length ? x.pick.options.map((o) => ({ label: o.label, icon: UserPlus, onClick: () => { setBusyKeys((k) => [...k, x.key]); x.pick!.onPick(o.id); } })) : [{ label: 'Phòng chưa có Sales hoạt động', onClick: () => undefined, disabled: true }]} /> : x.custom}
                      {x.approve && <button className={cn(btnGhost, btnSm)} onClick={() => quick(x)} title={x.nextStep ? `Duyệt xong: ${x.nextStep.toLowerCase()}` : undefined}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />{x.approveLabel ?? 'Duyệt'}</button>}
                      <RowMenu items={[
                        ...(x.view ? [{ label: 'Xem chi tiết', icon: Eye, onClick: x.view }] : []),
                        ...(x.needInfo ? [{ label: 'Yêu cầu sửa / bổ sung', icon: Pencil, onClick: () => { setModal({ item: x, mode: 'NEED_INFO' }); setNote(''); } }] : []),
                        ...(x.reject ? [{ label: x.kind === 'LEAD_ASSIGN' ? 'Trả về MKT' : 'Từ chối', icon: XCircle, danger: true, onClick: () => { setModal({ item: x, mode: 'REJECT' }); setNote(''); } }] : []),
                      ]} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          {!todoList.length && <EmptyState text={todo.length ? <>Không có yêu cầu khớp bộ lọc.</> : <>Không có yêu cầu nào chờ bạn duyệt</>} hint={todo.length ? undefined : <>Báo giá, công tác, chi phí, quỹ MDF, phân lead và tiền thu cần bạn duyệt sẽ xuất hiện ở đây.</>} art={todo.length ? 'search' : 'inbox'} />}
          <Pagination paged={todoPaged} unit="yêu cầu" />
        </Panel>
      )}

      {tab === 'mine' && (
        <Panel>
          <Table stt={Math.max(0, minePaged.from - 1)} minW={1000} head={['Nội dung', 'Loại', 'Gửi lúc', 'SLA', 'Người xử lý', 'Kết quả', 'Ghi chú', <span key="act" className="block text-right">Thao tác</span>]}>
            {minePaged.slice.map((x) => (
              <tr key={x.key} className={rowCls}>
                <td className={cn(tdFirst, 'max-w-[360px]')}><span className="block truncate font-medium" title={x.sub}>{x.title}</span></td>
                <td className={tdCls}>{kindCell(x.kind)}</td>
                <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--muted))]')}>{sentAt(x.requestedAt)}</td>
                <td className={cn(tdCls, 'whitespace-nowrap')}>{x.status === 'PENDING' ? <SlaBadge requestedAt={x.requestedAt} slaMin={x.slaMin} now={now} /> : <span className="text-xs text-[rgb(var(--muted))]">—</span>}</td>
                <td className={cn(tdCls, 'max-w-[200px]')}>{x.deciderId ? person(x.deciderId) : <span className="text-xs text-[rgb(var(--muted))]">Chưa xử lý</span>}</td>
                <td className={tdCls}><Chip tone={x.status === 'PENDING' ? 'orange' : DECISION_LABEL[x.status].tone}>{x.status === 'PENDING' ? 'Đang chờ duyệt' : DECISION_LABEL[x.status].label}</Chip></td>
                <td className={cn(tdCls, 'text-[13px] text-[rgb(var(--muted))]')}><span className="block max-w-[220px] truncate" title={x.note}>{x.note && x.status !== 'PENDING' ? x.note : '—'}</span></td>
                <td className={cn(tdLast, 'text-right')}>{x.view && <button className={cn(btnGhost, btnSm)} onClick={x.view}><Eye className="h-3.5 w-3.5" aria-hidden />Xem</button>}</td>
              </tr>
            ))}
          </Table>
          {!mineList.length && <p className="py-10 text-center text-sm text-[rgb(var(--muted))]">Bạn chưa gửi yêu cầu duyệt nào.</p>}
          <Pagination paged={minePaged} unit="yêu cầu" />
        </Panel>
      )}

      {tab === 'history' && (
        <Panel>
          <Table stt={Math.max(0, histPaged.from - 1)} head={['Thời gian', 'Nội dung', 'Loại', 'Người đề nghị', 'Người xử lý', 'Giá trị', 'Kết quả', 'Ghi chú']} minW={1120} right={[5]}>
            {histPaged.slice.map((x) => (
              <tr key={x.id} className={rowCls}>
                <td className={cn(tdFirst, 'font-mono text-xs text-[rgb(var(--muted))]')}>{new Date(x.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</td>
                <td className={cn(tdCls, 'max-w-[300px]')}><p className="truncate font-medium">{x.title}</p></td>
                <td className={tdCls}>{kindCell(x.kind)}</td>
                <td className={cn(tdCls, 'max-w-[190px]')}>{person(x.requesterId)}</td>
                <td className={cn(tdCls, 'max-w-[190px]')}>{person(x.deciderId)}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{x.amount ? x.amount.toLocaleString('vi-VN') : '—'}</td>
                <td className={cn(tdCls, 'whitespace-nowrap')}><Chip tone={DECISION_LABEL[x.decision].tone}>{DECISION_LABEL[x.decision].label}</Chip></td>
                <td className={cn(tdLast, 'max-w-[240px] truncate text-xs text-[rgb(var(--muted))]')} title={x.note}>{x.note ?? '—'}</td>
              </tr>
            ))}
          </Table>
          {!history.length && <EmptyState text={<>Chưa có quyết định nào{seeAllHistory ? '' : ' liên quan đến bạn'}.</>} art="doc" />}
          <Pagination paged={histPaged} unit="quyết định" />
        </Panel>
      )}

      </>}
      {modal && (
        <Modal title={`${modal.mode === 'REJECT' ? (modal.item.kind === 'LEAD_ASSIGN' ? 'Trả lead về Marketing' : 'Từ chối') : 'Yêu cầu sửa / bổ sung'}: ${modal.item.title}`} onClose={() => setModal(null)}
          footer={<><button className={btnGhost} onClick={() => setModal(null)}>Hủy</button><button className={cn(btnBase, 'px-3.5 py-2 font-semibold', modal.mode === 'REJECT' ? 'bg-[rgb(var(--danger))] text-white' : 'g-brand font-semibold text-[rgb(var(--on-accent))]')} disabled={note.trim().length < 5} onClick={submitModal}>{modal.mode === 'REJECT' ? 'Xác nhận' : 'Gửi yêu cầu'}</button></>}>
          <p className="mb-2 text-sm text-[rgb(var(--muted))]">{modal.item.sub}</p>
          <Field label="Lý do (gửi thông báo cho người đề nghị) *" hint="Tối thiểu 5 ký tự"><textarea className={cn(inputCls, 'min-h-24')} autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder={modal.mode === 'REJECT' ? 'VD: GM quá thấp, đề nghị giảm chiết khấu dòng đầu cáp xuống 3%' : 'VD: Bổ sung dự toán chi phí tiếp khách chi tiết'} /></Field>
        </Modal>
      )}
      {!canDo('quote.approve') && !canDo('activity.approve') && tab === 'todo' && !todo.length && <p className="text-center text-xs text-[rgb(var(--muted))]">Vai trò của bạn chủ yếu gửi yêu cầu; theo dõi ở tab "Tôi đã yêu cầu".</p>}
    </div>
  );
}

// =====================================================================
// TRUNG TÂM PHÊ DUYỆT (tiếp)
// =====================================================================
/** Số việc chờ để hiện badge trên menu */
export function useTaskCount() {
  return useApprovalQueue().todo.length;
}

/** Badge số việc chờ trên menu (render bên trong Provider nên dùng được context) */
export function TaskBadge({ dot }: { dot?: boolean }) {
  const n = useTaskCount();
  if (!n) return null;
  return dot
    ? <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-[rgb(var(--accent))]" aria-label={`${n} việc cần xử lý`} />
    : <span className="min-w-[1.375rem] rounded-md bg-[rgb(var(--accent)/0.2)] px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-[rgb(var(--accent-fg))]">{n}</span>;
}

