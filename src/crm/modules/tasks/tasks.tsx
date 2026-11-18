'use client';

import { useState } from 'react';
import { CheckCircle2, Eye, Pencil, UserPlus, XCircle, Zap } from 'lucide-react';
import { Avatar, Pagination, RowMenu, usePaged, useSelection } from '../../components/controls';
import { ChipFilter, FilterBar } from '../../components/filters';
import { Sla } from '../../components/sla';
import { Chip, EmptyState, Field, Modal, Panel, Table, Tabs, useSticky, ViewSwitch } from '../../components/ui';
import { latestContracts } from '../../lib/business';
import { ACTIVITY_TYPE, btnBase, btnGhost, btnPrimary, btnSm, compact, CONTENT_STATUS, dayStart, DECISION_LABEL, EXPENSE_STATUS, fmtDate, fmtDT, groupOf, HS_CLICHES_DEFAULT, HUB_GROUP, HUB_KIND, HUB_SHORT, HUB_SLA, inputBase, inputCls, LEAVE_KIND, needsApproval, openContentReview, platformOfContent, POP_LABEL, progName, PROGRAM_STATUS, rowCls, SOURCE_LABEL, stCompanyOf, tdCls, tdFirst, tdLast, todayISO, useApp, vnd, wsPushVersion } from '../../lib/core';
import type { Activity, ApprovalDecision, ApprovalKind, DeptCode, GeneratedDoc, HubGroup, HubItem, Lead, MineItem, MktContent, Module, Receipt, StockReservation, User, Verification } from '../../lib/types';
import { cn } from '../../lib/utils';
import { advanceCash, expenseCash, receiptCash } from '../../lib/workshop';
import { contentToArticle, getPlatform } from '../marketing/content-studio';
import { wsMakeVersion } from '../marketing/content-workspace';
import { useContractApprover } from '../sales/contract';
import { useActivityApprover } from '../staff/staff';
import { DecideReleaseModal } from '../supply/inventory';

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
  const { me, role, canDo, users, leads, quotes, setQuotes, genDocs, setGenDocs, activities, setActivities, programs, setPrograms, setBudget, claims, setClaims,
    reservations, canRelease, customers, approvalLogs, logDecision, dispatch, notify, openComposer, openClaim, assignLead, setLeads, departments, userName,
    jobs, receipts, setReceipts, openJob, mfgConfig, audit } = app;
  const canApproveDoc = useContractApprover();
  const canApproveAct = useActivityApprover();
  const userOf = (id?: string) => users.find((u) => u.id === id);
  const tell = (to: string | undefined, title: string, body: string, module: Module = 'tasks') => { const u = userOf(to); if (u && u.id !== me.id) dispatch('APPROVAL_RESULT', { to: u, title, body, module }); };
  const done = (kind: ApprovalKind, refId: string, title: string, requesterId: string | undefined, decision: ApprovalDecision, note: string | undefined, amount: number | undefined, msg: string) => {
    logDecision({ kind, refId, title, requesterId, decision, note, amount });
    tell(requesterId, `${DECISION_LABEL[decision].label}: ${title}`, note ?? msg);
    notify(msg, decision === 'APPROVED' ? 'teal' : 'orange');
  };
  const leadOf = (id?: string) => leads.find((l) => l.id === id);
  const deptOfDoc = (d: GeneratedDoc) => leadOf(d.leadId)?.dept ?? customers.find((c) => c.id === d.customerId)?.dept;

  const todo: HubItem[] = [];

  // ---- Giá báo giá ----
  for (const q of quotes) {
    const a = q.approval;
    if (!a || a.status !== 'PENDING' || a.requestedBy === me.id) continue;
    const l = leadOf(q.leadId);
    const ok = canDo('quote.approve') && (a.level === 'BOD' ? role === 'BOD' : role === 'BOD' || (role === 'DEPT_HEAD' && l?.dept === me.dept));
    if (!ok) continue;
    const name = q.quoteForm?.party.name ?? l?.company ?? customers.find((c) => c.id === q.customerId)?.name ?? '';
    const title = `${q.code} v${q.version}: ${name}`;
    const set = (st: ApprovalDecision, note?: string) => setQuotes((p) => p.map((x) => (x.id === q.id ? { ...x, approval: { ...a, status: st, decidedBy: me.id, decidedAt: Date.now(), note } } : x)));
    todo.push({
      key: `q-${q.id}`, kind: 'QUOTE', refId: q.id, title, sub: `${compact(q.amount)} trước VAT${q.gmPct !== undefined && canDo('price.viewCost') ? `, GM ${q.gmPct.toFixed(1)}%` : ''}, cấp duyệt ${a.level === 'BOD' ? 'BOD' : 'Trưởng phòng'}`,
      reason: a.reasons.join('; '), requesterId: a.requestedBy, deptCode: l?.dept, requestedAt: a.requestedAt, slaMin: a.level === 'BOD' ? 240 : HUB_SLA.QUOTE, amount: q.amount,
      flagged: a.level === 'BOD' ? 'Cấp BOD' : undefined, nextStep: 'Mở khóa xuất PDF báo giá',
      approve: () => { set('APPROVED'); done('QUOTE', q.id, title, a.requestedBy, 'APPROVED', undefined, q.amount, `Đã duyệt giá ${q.code}. Báo giá được mở khóa xuất PDF.`); },
      reject: (n) => { set('REJECTED', n); done('QUOTE', q.id, title, a.requestedBy, 'REJECTED', n, q.amount, `Đã từ chối báo giá ${q.code}`); },
      needInfo: (n) => { set('NEED_INFO', n); done('QUOTE', q.id, title, a.requestedBy, 'NEED_INFO', n, q.amount, `Đã yêu cầu sửa báo giá ${q.code}`); },
      view: () => openComposer({ quoteId: q.id, leadId: q.leadId || undefined, mode: 'QUOTE' }),
    });
  }
  // ---- Hợp đồng ----
  for (const d of latestContracts(genDocs)) {
    if (d.status !== 'PENDING_APPROVAL' || !canApproveDoc(d) || d.createdBy === me.id && role !== 'BOD') continue;
    const title = `${d.contractCode} v${d.version ?? 1}: ${d.partyName}`;
    const set = (p: Partial<GeneratedDoc>) => setGenDocs((all) => all.map((x) => (x.id === d.id ? { ...x, ...p } : x)));
    todo.push({
      key: `c-${d.id}`, kind: 'CONTRACT', refId: d.id, title, sub: `${compact(d.total)} sau VAT`, reason: d.special.join('; '), requesterId: d.createdBy, deptCode: deptOfDoc(d),
      requestedAt: d.submittedAt ?? dayStart(d.createdAt), slaMin: HUB_SLA.CONTRACT, amount: d.total, nextStep: 'Hợp đồng có hiệu lực, xuất được PDF',
      approve: () => { set({ status: 'APPROVED', approvedBy: me.id, approvedAt: todayISO() }); done('CONTRACT', d.id, title, d.createdBy, 'APPROVED', undefined, d.total, `Đã duyệt hợp đồng ${d.contractCode}, có hiệu lực`); },
      reject: (n) => { set({ status: 'REJECTED', rejectNote: n }); done('CONTRACT', d.id, title, d.createdBy, 'REJECTED', n, d.total, `Đã từ chối hợp đồng ${d.contractCode}`); },
      view: () => openComposer({ docId: d.id, view: true }),
    });
  }
  // ---- Lịch công tác / nghỉ / giải trình ----
  for (const a of activities) {
    if (a.status !== 'PENDING_APPROVAL' || !canApproveAct(a)) continue;
    const owner = userOf(a.userId);
    const what = a.type === 'LEAVE' ? LEAVE_KIND[a.leaveKind ?? 'LEAVE'] : ACTIVITY_TYPE[a.type].label;
    const cust = customers.find((c) => c.id === a.customerId);
    const title = `${owner?.name ?? ''}: ${what}`;
    const set = (p: Partial<Activity>) => setActivities((all) => all.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
    todo.push({
      key: `a-${a.id}`, kind: 'ACTIVITY', refId: a.id, title,
      sub: `${fmtDT(a.from)} – ${fmtDT(a.to)}${cust ? `, gặp ${cust.name}` : ''}${a.location ? `, ${a.location}` : ''}${a.cost ? `, đề xuất ${compact(a.cost)}${a.advance ? ` (tạm ứng ${compact(a.advance)})` : ''}` : ''}`,
      reason: a.note ? `${a.type === 'LEAVE' ? 'Lý do' : 'Mục tiêu'}: ${a.note}` : undefined, requesterId: a.userId, deptCode: owner?.dept,
      requestedAt: a.submittedAt ?? dayStart(a.createdAt), slaMin: a.type === 'LEAVE' && a.leaveKind && a.leaveKind !== 'LEAVE' ? 120 : HUB_SLA.ACTIVITY, amount: a.cost || undefined,
      flagged: a.type === 'LEAVE' && a.from.slice(0, 10) <= todayISO() ? 'Trong ngày' : undefined,
      nextStep: a.type === 'LEAVE' ? 'Ghi nhận phép / công' : 'Xác nhận công tác, tính công',
      approve: () => { set({ status: 'APPROVED', approvedBy: me.id }); const adv = advanceCash(a, users); if (adv) app.postCash(adv); done('ACTIVITY', a.id, title, a.userId, 'APPROVED', undefined, a.cost, `Đã duyệt: ${title}. ${adv ? `Tự sinh phiếu chi tạm ứng ${compact(adv.amount)}.` : 'Đã xác nhận công.'}`); },
      reject: (n) => { set({ status: 'REJECTED', rejectNote: n }); done('ACTIVITY', a.id, title, a.userId, 'REJECTED', n, a.cost, `Đã từ chối: ${title}`); },
      needInfo: (n) => { set({ status: 'NEED_INFO', requestNote: n }); done('ACTIVITY', a.id, title, a.userId, 'NEED_INFO', n, a.cost, `Đã yêu cầu bổ sung: ${title}`); },
    });
  }
  // ---- Chứng từ chi phí công tác ----
  for (const a of activities) {
    const head = a.expenseStatus === 'SUBMITTED' && canApproveAct(a);
    const acc = a.expenseStatus === 'HEAD_APPROVED' && canDo('claim.accounting');
    if (!head && !acc) continue;
    const owner = userOf(a.userId);
    const total = (a.expenses ?? []).reduce((s, x) => s + x.amount, 0);
    const title = `${owner?.name ?? ''}: chi phí ${a.title}`;
    const set = (p: Partial<Activity>) => setActivities((all) => all.map((x) => (x.id === a.id ? { ...x, ...p } : x)));
    todo.push({
      key: `e-${a.id}`, kind: 'EXPENSE', refId: a.id, title, sub: `${(a.expenses ?? []).length} chứng từ: ${(a.expenses ?? []).map((x) => x.name).join(', ')}`, requesterId: a.userId, deptCode: owner?.dept,
      requestedAt: a.expenseSubmittedAt ?? dayStart(a.to), slaMin: HUB_SLA.EXPENSE, amount: total,
      approveLabel: acc ? 'Xác nhận thanh toán' : 'Duyệt chi', nextStep: acc ? 'Ghi nhận đã thanh toán' : 'Chuyển Kế toán thanh toán',
      approve: () => { set({ expenseStatus: acc ? 'PAID' : 'HEAD_APPROVED' }); if (acc) app.postCash(expenseCash(a, users, app.cashEntries)); done('EXPENSE', a.id, title, a.userId, 'APPROVED', undefined, total, acc ? `Đã thanh toán ${compact(total)}` : `Đã duyệt chi ${compact(total)}, chuyển Kế toán`); },
      reject: (n) => { set({ expenseStatus: 'REJECTED', expenseNote: n }); done('EXPENSE', a.id, title, a.userId, 'REJECTED', n, total, 'Đã từ chối chứng từ chi phí'); },
    });
  }
  // ---- Đề xuất chi quỹ MDF (tạm ứng sự kiện, POSM...) ----
  for (const p of programs) {
    if (p.status !== 'PENDING_INTERNAL' || !canDo('program.approveInternal') || !(role === 'BOD' || (me.dept === p.dept && me.approvalLimit >= p.held))) continue;
    const title = `${p.code}: ${p.title}`;
    todo.push({
      key: `p-${p.id}`, kind: 'PROGRAM', refId: p.id, title, sub: `${progName(p.type)}, giữ chỗ quỹ ${compact(p.held)} (đề xuất ${compact(p.requested)}, Hãng tài trợ ${p.sharePct}%), ${fmtDate(p.start)}`,
      requesterId: p.requestedBy, deptCode: p.dept, requestedAt: p.requestedAt ?? dayStart(p.start) - 14 * 864e5, slaMin: HUB_SLA.PROGRAM, amount: p.held,
      flagged: p.held >= 50e6 ? 'Trên 50 triệu' : undefined, nextStep: 'Gửi 3M duyệt Pre-Approval',
      approve: () => { setPrograms((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'PENDING_VENDOR', approvedBy: me.id } : x))); done('PROGRAM', p.id, title, p.requestedBy, 'APPROVED', undefined, p.held, `Đã duyệt nội bộ ${p.code}, chuyển gửi 3M`); },
      reject: (n) => { setBudget((b) => ({ ...b, committed: Math.max(0, b.committed - p.held) })); setPrograms((ps) => ps.map((x) => (x.id === p.id ? { ...x, held: 0, status: 'REJECTED' } : x))); done('PROGRAM', p.id, title, p.requestedBy, 'REJECTED', n, p.held, `Đã từ chối ${p.code}, nhả ${compact(p.held)} về quỹ`); },
    });
  }
  // ---- Claim: thẩm định POP / đối soát hóa đơn ----
  for (const c of claims) {
    const pendingProofs = c.proofs.filter((x) => x.verification === 'PENDING');
    const title = `${c.code}: ${c.programTitle}`;
    const prog = programs.find((x) => x.id === c.programId);
    if (!c.submitted && pendingProofs.length && canDo('claim.verify')) {
      const setP = (v: Verification) => setClaims((all) => all.map((x) => (x.id === c.id ? { ...x, proofs: x.proofs.map((pf) => (pf.verification === 'PENDING' ? { ...pf, verification: v } : pf)) } : x)));
      todo.push({
        key: `pop-${c.id}`, kind: 'CLAIM', refId: c.id, title, sub: `Thẩm định ${pendingProofs.length} chứng từ POP (${pendingProofs.map((x) => POP_LABEL[x.type] ?? x.type).join(', ')}), claim ${compact(c.claimed)}`,
        requesterId: prog?.requestedBy, deptCode: c.dept, requestedAt: Date.now() - (30 - Math.min(30, c.daysLeft)) * 864e5, slaMin: HUB_SLA.CLAIM, amount: c.claimed,
        flagged: c.daysLeft <= 5 ? `Còn ${c.daysLeft} ngày nộp 3M` : undefined, approveLabel: 'Đạt, nghiệm thu', nextStep: 'Hồ sơ sẵn sàng nộp 3M',
        approve: () => { setP('VERIFIED'); done('CLAIM', c.id, title, prog?.requestedBy, 'APPROVED', undefined, c.claimed, `Đã nghiệm thu POP ${c.code}`); },
        reject: (n) => { setP('REJECTED'); done('CLAIM', c.id, title, prog?.requestedBy, 'REJECTED', n, c.claimed, `Chứng từ ${c.code} không đạt, yêu cầu tải lại`); },
        view: () => openClaim(c.id),
      });
    } else if (c.submitted && !c.vatCheck && c.invoice && canDo('claim.accounting')) {
      todo.push({
        key: `vat-${c.id}`, kind: 'CLAIM', refId: c.id, title, sub: `Đối soát hóa đơn ${c.invoice.serial}-${c.invoice.number}, ${compact(c.invoice.amount)} so với claim ${compact(c.claimed)}`,
        requesterId: prog?.requestedBy, deptCode: c.dept, requestedAt: dayStart(c.invoice.date), slaMin: HUB_SLA.CLAIM, amount: c.invoice.amount,
        flagged: c.invoice.amount !== c.claimed ? 'Lệch số tiền' : undefined, approveLabel: 'Hóa đơn khớp', nextStep: 'Chờ 3M duyệt thanh toán / cấn trừ',
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

  // ---- v38.3: Nội dung marketing chờ duyệt (Content Studio, AI soạn từ Plan) — Giám đốc / Trưởng Marketing duyệt ----
  if (canDo('mkt.manage')) for (const c of app.contents) {
    if (c.status !== 'REVIEW' || c.aiJob?.status === 'QUEUED' || c.aiJob?.status === 'RUNNING') continue;
    const title = `Nội dung: ${c.title}`;
    const requester = c.submittedBy ?? c.aiJob?.by ?? c.ownerId;
    const setC = (p: Partial<MktContent>) => app.setContents((all) => all.map((x) => (x.id === c.id ? { ...x, ...p, updatedAt: Date.now() } : x)));
    const plat = getPlatform(c.platform ?? platformOfContent(c));
    todo.push({
      key: `ct-${c.id}`, kind: 'CONTENT', refId: c.id, title, sub: `${plat.label} · ${c.blocks?.length ?? 0} mục${c.aiJob?.status === 'DONE' ? ' · AI soạn' : ''}${c.settings?.focusKeyword ? ` · từ khóa "${String(c.settings.focusKeyword)}"` : ''}`,
      requesterId: requester, requestedAt: c.submittedAt ?? c.aiJob?.at ?? c.updatedAt, slaMin: HUB_SLA.CONTENT, nextStep: 'Lên lịch / đăng bài',
      approve: () => {
        setC({ status: 'APPROVED', approvedBy: me.id, approvedAt: Date.now(), reviewNote: undefined });
        const co = stCompanyOf(app.company);
        const v = wsMakeVersion(contentToArticle(c, co), co, c.id, 'APPROVED', me.name, app.hubCfg.ai.cliches?.length ? app.hubCfg.ai.cliches : HS_CLICHES_DEFAULT);
        if (v) app.setContentVersions((p) => wsPushVersion(p, v));
        done('CONTENT', c.id, title, requester, 'APPROVED', undefined, undefined, `Đã duyệt "${c.title}"`);
      },
      reject: (n) => { setC({ status: 'DRAFT', reviewNote: n }); done('CONTENT', c.id, title, requester, 'REJECTED', n, undefined, `Đã trả về "${c.title}"`); },
      needInfo: (n) => { setC({ status: 'DRAFT', reviewNote: n }); done('CONTENT', c.id, title, requester, 'NEED_INFO', n, undefined, `Đã yêu cầu sửa "${c.title}"`); },
      view: () => openContentReview(c.id),
    });
  }
  // ---- Phiếu thu: kế toán xác nhận tiền về (ghi nhận doanh số); người thu nộp tiền mặt ----
  for (const r of receipts) {
    const job = jobs.find((j) => j.id === r.jobId);
    const title = `${r.code}: ${vnd(r.amount)}${job ? `, ${job.code} ${job.title}` : ''}`;
    const patch = (p: Partial<Receipt>) => setReceipts((all) => all.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
    const how = r.method === 'CASH' ? 'tiền mặt' : 'chuyển khoản';
    if (r.status === 'SUBMITTED' && canDo('receipt.confirm') && r.collectedBy !== me.id) {
      todo.push({
        key: `rc-${r.id}`, kind: 'RECEIPT', refId: r.id, title, sub: `${how}, ${userName(r.collectedBy)} thu${r.note ? `, ${r.note}` : ''}`,
        requesterId: r.collectedBy, requestedAt: r.submittedAt ?? r.collectedAt, slaMin: HUB_SLA.RECEIPT, amount: r.amount,
        flagged: r.method === 'TRANSFER' ? 'Đối chiếu sao kê' : undefined, approveLabel: 'Xác nhận đã nhận', nextStep: 'Ghi nhận doanh số, giảm công nợ',
        approve: () => { patch({ status: 'CONFIRMED', confirmedBy: me.id, confirmedAt: Date.now() }); app.postCash(receiptCash(r, job, customers)); done('RECEIPT', r.id, title, r.collectedBy, 'APPROVED', undefined, r.amount, `Đã xác nhận ${r.code}, ghi nhận doanh số ${vnd(r.amount)}`); },
        reject: (n) => { patch({ status: 'REJECTED', rejectNote: n }); done('RECEIPT', r.id, title, r.collectedBy, 'REJECTED', n, r.amount, `Đã từ chối ${r.code}`); },
        view: job ? () => openJob(job.id) : undefined,
      });
    } else if (r.status === 'HOLDING' && r.collectedBy === me.id) {
      todo.push({
        key: `cash-${r.id}`, kind: 'CASH', refId: r.id, title, sub: `Bạn đang giữ ${vnd(r.amount)} tiền mặt, nộp về kế toán trong ${mfgConfig.submitHours} giờ`,
        requesterId: r.collectedBy, requestedAt: r.collectedAt, slaMin: mfgConfig.submitHours * 60, amount: r.amount, approveLabel: 'Đã nộp kế toán', nextStep: 'Kế toán đếm tiền và xác nhận',
        approve: () => { patch({ status: 'SUBMITTED', submittedAt: Date.now() }); audit('CASH_SUBMIT', `${r.code}: nộp ${vnd(r.amount)} về kế toán`); users.filter((u) => u.active && u.role === 'ACCOUNTANT').forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title: `Nhận tiền mặt ${r.code}: ${vnd(r.amount)}`, body: `${userName(r.collectedBy)} nộp tiền đơn ${job?.code ?? ''}`, module: 'tasks' })); notify(`Đã ghi nhận nộp ${vnd(r.amount)}, chờ kế toán xác nhận`, 'teal'); },
        view: job ? () => openJob(job.id) : undefined,
      });
    }
  }

  // ---- Tôi đã yêu cầu ----
  const lastLog = (refId: string) => approvalLogs.find((x) => x.refId === refId);
  const mine: MineItem[] = [
    ...quotes.filter((q) => q.approval?.requestedBy === me.id).map((q): MineItem => ({
      key: `q-${q.id}`, kind: 'QUOTE', title: `${q.code} v${q.version}: ${q.quoteForm?.party.name ?? leadOf(q.leadId)?.company ?? ''}`, sub: `${compact(q.amount)}. ${q.approval!.reasons.join('; ')}`,
      status: q.approval!.status, requestedAt: q.approval!.requestedAt, slaMin: q.approval!.level === 'BOD' ? 240 : HUB_SLA.QUOTE, deciderId: q.approval!.decidedBy, note: q.approval!.note,
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
  ];
  void departments;
  return { todo, mine };
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
  const [tab, setTab] = useSticky<'todo' | 'mine' | 'history'>('TasksModule.tab', 'todo');
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
        { id: 'todo', label: `Chờ tôi duyệt (${todo.length})` },
        { id: 'mine', label: `Tôi đã yêu cầu (${mine.filter((x) => x.status === 'PENDING').length})` },
        { id: 'history', label: 'Lịch sử đã xử lý' },
      ]} value={tab} onChange={(v) => { setTab(v); sel.clear(); }} />

      {/* Thanh công cụ: tìm kiếm, loại yêu cầu, phòng ban, ưu tiên, duyệt hàng loạt + tag lọc con */}
      <FilterBar q={q} onQ={setQ} placeholder="Tìm mã, khách hàng, lý do…" status={grp} onStatus={(v) => setGrp(v as 'ALL' | HubGroup)} statusLabel="Loại yêu cầu"
        statusOptions={(Object.keys(HUB_GROUP) as HubGroup[]).map((g) => ({ value: g, label: HUB_GROUP[g].label }))} extraActive={(who !== 'ALL' ? 1 : 0) + (prio !== 'ALL' ? 1 : 0)}
        actions={tab === 'todo' ? (<>
          <ViewSwitch value={view} onChange={setView} options={['table', 'board']} />
          <button className={cn(btnPrimary, 'py-2')} disabled={!sel.ids.length} onClick={bulkApprove} title={sel.ids.length ? `Duyệt ${sel.ids.length} yêu cầu đã chọn` : 'Tích chọn các dòng cần duyệt'}><Zap className="h-4 w-4" aria-hidden />Duyệt chọn{sel.ids.length ? ` (${sel.ids.length})` : ''}</button>
        </>) : undefined}
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

