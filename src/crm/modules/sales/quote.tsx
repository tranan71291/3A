'use client';

import { Fragment, type ReactNode, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Copy, Download, Eye, FileText, History, Info, Mail, Pencil, Plus, RefreshCw, Search, Send, ShieldCheck, Sparkles, Trash2, Upload, XCircle } from 'lucide-react';
import { Avatar, Pagination, RowMenu, usePaged } from '../../components/controls';
import { Collapse, ConfirmDialog } from '../../components/crud';
import { FilterBar, useInRange } from '../../components/filters';
import { Chip, Code, EmptyState, Field, FilePicker, Modal, Panel, StatCard, Table, Tabs, useOverlay, useSticky } from '../../components/ui';
import { latestContracts } from '../../lib/business';
import { APPROVAL_LEVEL, approvalReasons, btnBase, btnGhost, btnPrimary, btnSm, C, CHECK_DOT, compact, contractVersions, digits9, docGroupOf, docLineToQuote, esc, findByTax, fmtDate, fmtN, GENDOC_STATUS, GM_RULE, GUARANTEE_LABEL, guessTx, inputBase, inputCls, iso, latestQuote, nextCode, partyOf, PRICE_TIER, QUOTE_STATUS, quoteLineToDoc, rowCls, SAMPLE_FORM, tdCls, tdFirst, tdLast, TEMPLATE_FLAGS, TEMPLATE_VARS, tierPrice, todayISO, TX_TYPE, uid, useApp, wfNeeds, wfReasons } from '../../lib/core';
import type { ApprovalDecision, ApprovalLevel, CheckItem, ComposerForm, ComposerMode, ConfirmState, DocLine, DocTemplate, GenDocStatus, GeneratedDoc, GuaranteeType, Lead, PayMilestone, PriceTier, Quote, QuoteStatus, SkuItem, TxType, WfSubject } from '../../lib/types';
import { cn, wfPath } from '../../lib/utils';
import { apiPost, parseAiJson, useAi, useServerStatus } from '../ai/ai-core';
import { AiWriterSheet } from '../ai/copilot-plus';
import { DocsPage } from '../docs/docs';
import { SaleStockCard } from './orders';
import { learnDrafts, SmartQuoteGrid } from './smart-quote';
import { buildDocVars, ComposerShell, DocActionBar, docPdfBlob, docShell, docTotals, downloadWord, Fold, moneyToWordsVN, PartyFields, printHtml, quoteBody, readDocxParagraphs, renderTemplate, specialTermsOf, TermsFields } from './templates';
import { useHubItem } from '../tasks/tasks';

// =====================================================================
//  MÀN BÁO GIÁ — chỉ ghi khi bấm "Tạo báo giá" / "Lưu thay đổi"; xuất file sau khi đã lưu
// =====================================================================

export function QuoteComposer({ leadId, customerId, quoteId, edit, reviseOf, onClose }: { leadId?: string; customerId?: string; quoteId?: string; edit?: boolean; reviseOf?: string; onClose: () => void }) {
  const { winDraftQuote, leads, myLeads, customers, skus, company, users, me, role, docTemplates, quotes, setQuotes, submitQuote, notify, canDo, getfly, openComposer, dispatch, logDecision, winLead, setDraftProducts, salesOrders, setOpenSale, go, wfDef, wfFirstApprovers } = useApp();
  const [wide, setWide] = useSticky('QuoteComposer.wide3', false);
  const editQuote = quotes.find((q) => q.id === quoteId);
  // v45: báo giá điều chỉnh từ một báo giá bất kỳ (kể cả không gắn dự án); báo giá nháp chưa chốt được sửa đè
  const reviseSrc = quotes.find((q) => q.id === reviseOf);
  const draftEdit = !!edit && !!editQuote?.draft && editQuote.status !== 'ACCEPTED';
  // Báo giá đã tạo chỉ xem; muốn thay đổi phải tạo báo giá điều chỉnh (phiên bản mới)
  const viewOnly = !!editQuote && !draftEdit;
  const year = new Date().getFullYear();
  const suggestQuote = (tx: TxType) => docTemplates.find((t) => t.kind === 'QUOTE' && t.txType === tx) ?? docTemplates.find((t) => t.kind === 'QUOTE');
  const itemsOfLead = (l?: Lead): DocLine[] => {
    if (!l) return [];
    const q = latestQuote(l.id, quotes);
    if (q) return q.lines.map(quoteLineToDoc);
    return (l.boqItems ?? []).map((i) => ({ sku: i.code, name: i.name, unit: i.unit, qty: i.qty, price: Math.round(i.price * (1 - i.discountPct / 100)), listPrice: i.price, discountPct: i.discountPct }));
  };
  const [initial] = useState<ComposerForm>(() => {
    const l = leads.find((x) => x.id === (editQuote?.leadId || reviseSrc?.leadId || leadId));
    const c = customers.find((x) => x.id === (editQuote?.customerId ?? reviseSrc?.customerId ?? customerId ?? l?.customerId)) ?? (l ? findByTax(customers, l.taxCode) : undefined);
    if (editQuote?.quoteForm) return { ...editQuote.quoteForm, items: editQuote.lines.map(quoteLineToDoc), vatPct: editQuote.vatPct };
    if (reviseSrc?.quoteForm) return { ...reviseSrc.quoteForm, items: reviseSrc.lines.map(quoteLineToDoc), vatPct: reviseSrc.vatPct, customHtml: undefined };
    const prev = l ? latestQuote(l.id, quotes) : undefined;
    const tpl = docTemplates.find((t) => t.id === (editQuote?.templateId ?? prev?.templateId)) ?? suggestQuote(guessTx(c?.segment ?? l?.segment));
    const tx = tpl?.txType ?? guessTx(c?.segment ?? l?.segment);
    const base = prev?.quoteForm;
    return {
      txType: tx, quoteTplId: tpl?.id ?? '', contractTplId: tpl?.pairId ?? '', tier: editQuote?.tier ?? prev?.tier ?? (l?.boqItems?.length ? 'BOQ' : TX_TYPE[tx].tier),
      leadId: l?.id, customerId: c?.id, party: base?.party ?? partyOf(c, l), items: editQuote ? editQuote.lines.map(quoteLineToDoc) : itemsOfLead(l), vatPct: editQuote?.vatPct ?? prev?.vatPct ?? (getfly.defaultVatPct || 10),
      delivery: base?.delivery ?? tpl?.defaultDelivery ?? TX_TYPE[tx].delivery, advancePct: base?.advancePct ?? 0, guaranteeType: 'NONE', guaranteePct: 0, warrantyMonths: base?.warrantyMonths ?? 0,
      creditDays: base?.creditDays ?? 0, paymentMethod: base?.paymentMethod ?? 'Chuyển khoản', validDays: 30, note: editQuote?.note ?? '',
    };
  });
  const [form, setForm] = useState<ComposerForm>(initial);
  const [savedId, setSavedId] = useState<string | undefined>(draftEdit ? undefined : editQuote?.id);
  const saved = quotes.find((q) => q.id === savedId);
  const lead = leads.find((x) => x.id === form.leadId);
  const rootKey = reviseSrc ? reviseSrc.rootId ?? reviseSrc.id : undefined;
  const versions = lead ? quotes.filter((q) => q.leadId === lead.id) : rootKey ? quotes.filter((q) => (q.rootId ?? q.id) === rootKey) : [];
  const [code] = useState(() => editQuote?.code ?? reviseSrc?.code ?? nextCode(quotes.map((q) => q.code), `BG-${year}-`, 4));
  const version = saved?.version ?? editQuote?.version ?? versions.reduce((m, x) => Math.max(m, x.version), 0) + 1;
  const locked = viewOnly || !!savedId;

  const set = <K extends keyof ComposerForm>(k: K, v: ComposerForm[K]) => setForm((p) => ({ ...p, [k]: v }));
  const setParty = (k: keyof ComposerForm['party'], v: string) => setForm((p) => ({ ...p, party: { ...p.party, [k]: v } }));

  const qTpl = docTemplates.find((t) => t.id === form.quoteTplId);
  const totals = docTotals(form);
  const seller = users.find((u) => u.id === lead?.assignee) ?? me;
  const { vars, flags } = buildDocVars(form, { company, quoteCode: code, contractCode: '', projectName: lead?.boqNote, projectCode: lead?.code, salesName: seller.name, salesPhone: seller.phone ?? company.phone, salesEmail: seller.email, skus });
  const html = form.customHtml ?? (qTpl ? renderTemplate(qTpl.body, vars, flags) : '<p>Chưa chọn mẫu báo giá</p>');
  const canSeeCost = canDo('price.viewCost');
  const costSum = form.items.reduce((a, l) => a + l.qty * (skus.find((s) => s.sku === l.sku)?.costPrice ?? 0), 0);
  const costKnown = form.items.length > 0 && form.items.every((l) => (skus.find((s) => s.sku === l.sku)?.costPrice ?? 0) > 0);
  const gm = costKnown && totals.sub > 0 ? ((totals.sub - costSum) / totals.sub) * 100 : null;
  // Khách lẻ: không pháp nhân (không MST), không công nợ, chưa có trong CRM -> báo giá nháp, không cần duyệt giá
  const retail = !lead && !form.customerId && !form.party.taxCode.trim() && form.creditDays === 0;
  /** v48: cần duyệt và các bước theo quy trình "Duyệt giá báo giá" (Cài đặt › Quy trình & phê duyệt) */
  const wfQ = wfDef('QUOTE');
  const wfQs: WfSubject = { requesterId: me.id, dept: lead?.dept ?? customers.find((c) => c.id === form.customerId)?.dept, amount: totals.sub, vals: { gm, amount: totals.sub, maxDisc: Math.max(0, ...form.items.map((l) => l.discountPct ?? 0)) } };
  const level: ApprovalLevel = retail || !wfQ ? 'AUTO' : !wfNeeds(wfQ, wfQs) ? 'AUTO' : wfPath(wfQ, wfQs).some((x) => x.who.kind === 'ROLE' && x.who.role === 'BOD') ? 'BOD' : 'HEAD';
  const reasons = retail || !wfQ || level === 'AUTO' ? [] : wfReasons(wfQ, wfQs).length ? wfReasons(wfQ, wfQs) : approvalReasons(gm, totals.sub);
  const errs: string[] = [];
  if (form.party.name.trim().length < 3) errs.push('Nhập tên khách hàng');
  if (!form.items.length) errs.push('Thêm ít nhất 1 dòng hàng hóa');
  const noName = form.items.map((l, i) => (!l.name.trim() ? i + 1 : 0)).filter(Boolean);
  const noPrice = form.items.map((l, i) => (l.qty <= 0 || l.price <= 0 ? i + 1 : 0)).filter(Boolean);
  if (noName.length) errs.push(`Dòng ${noName.slice(0, 5).join(', ')} chưa có tên hàng`);
  if (noPrice.length) errs.push(`Dòng ${noPrice.slice(0, 5).join(', ')}${noPrice.length > 5 ? '…' : ''} chưa có số lượng / đơn giá`);
  if (!qTpl) errs.push('Chọn mẫu báo giá');
  if (!lead && !form.customerId && !retail) errs.push('Khách chưa có trong CRM: chọn khách / dự án, hoặc bỏ MST và để công nợ 0 ngày để lưu báo giá nháp (khách lẻ)');

  const applyTier = (tier: PriceTier) => setForm((f) => ({ ...f, tier, items: tier === 'BOQ' ? (lead?.boqItems?.length ? lead.boqItems.map((i) => ({ sku: i.code, name: i.name, unit: i.unit, qty: i.qty, price: Math.round(i.price * (1 - i.discountPct / 100)), listPrice: i.price, discountPct: i.discountPct })) : f.items) : f.items.map((l) => { const k = skus.find((s) => s.sku === l.sku); if (!k) return l; const lp = tierPrice(k, tier); return { ...l, listPrice: lp, price: Math.round(lp * (1 - (l.discountPct ?? 0) / 100)) }; }) }));
  const pickProject = (id: string) => {
    const l = leads.find((x) => x.id === id);
    const c = customers.find((x) => x.id === l?.customerId) ?? (l ? findByTax(customers, l.taxCode) : undefined);
    setForm((f) => ({ ...f, leadId: l?.id, customerId: c?.id ?? f.customerId, party: l ? partyOf(c, l) : f.party, items: l ? itemsOfLead(l) : f.items }));
  };

  /** Tạo báo giá: ghi một phiên bản mới rồi khóa lại (không sửa đè) */
  const save = () => {
    if (locked) return;
    if (errs.length) return notify(errs[0], 'red');
    const q: Quote = {
      id: uid('q'), code, leadId: lead?.id ?? '', version, date: todayISO(), discountPct: 0, status: 'SENT', exports: [],
      lines: form.items.map(docLineToQuote), amount: totals.sub, vatPct: form.vatPct, tier: form.tier, templateId: form.quoteTplId, gmPct: gm ?? undefined, approvalLevel: level,
      validUntil: iso(new Date(Date.now() + form.validDays * 864e5)), note: form.note, customerId: form.customerId, quoteForm: form,
      createdBy: me.id, createdAt: Date.now(), draft: retail || undefined, rootId: rootKey,
      approval: level === 'AUTO' ? undefined : { status: 'PENDING', level, reasons, requestedAt: Date.now(), requestedBy: me.id },
    };
    if (draftEdit && editQuote) {
      // Báo giá nháp: lưu đè, giữ số và phiên bản
      const q2: Quote = { ...q, id: editQuote.id, createdAt: editQuote.createdAt ?? q.createdAt, rootId: editQuote.rootId, exports: editQuote.exports ?? [] };
      setQuotes((p) => p.map((x) => (x.id === editQuote.id ? q2 : x)));
      setDraftProducts((all) => learnDrafts(all, form.items, skus, { quote: `${code} v${version}`, customer: form.party.name, by: me.id }));
      setSavedId(editQuote.id);
      return notify(`Đã lưu thay đổi báo giá nháp ${code}`, 'teal');
    }
    setQuotes((p) => [q, ...p.map((x) => ((lead && x.leadId === lead.id) || (rootKey && (x.rootId ?? x.id) === rootKey)) && x.status === 'SENT' ? { ...x, status: 'REVISED' as QuoteStatus } : x)]);
    // Tự học: hàng gõ tự do + đơn giá vào danh mục nháp để lần sau gợi ý kèm giá bán gần nhất
    setDraftProducts((all) => learnDrafts(all, form.items, skus, { quote: `${code} v${version}`, customer: form.party.name, by: me.id }));
    if (lead?.status === 'ACCEPTED') submitQuote(lead.id);
    setSavedId(q.id);
    if (q.approval) {
      dispatch('QUOTE_APPROVAL', { lead, toAll: wfFirstApprovers('QUOTE', wfQs).filter((u) => u.id !== me.id), title: `Báo giá chờ duyệt: ${form.party.name}`, body: `${code} v${version}, ${compact(totals.sub)}. ${reasons.join('; ')}` });
      notify(`Đã tạo báo giá ${code} v${version}, gửi ${APPROVAL_LEVEL[level].label.replace('Cần ', '')}. Xuất PDF sau khi được duyệt.`, 'orange');
    } else notify(`Đã tạo báo giá ${code} v${version}: ${compact(totals.sub)} trước VAT`, 'teal');
  };
  const approval = saved?.approval;
  const exportLocked = !!approval && approval.status !== 'APPROVED';
  const canDecide = !!saved && approval?.status === 'PENDING' && approval.requestedBy !== me.id && canDo('quote.approve') && (approval.level === 'BOD' ? role === 'BOD' : role === 'BOD' || (role === 'DEPT_HEAD' && lead?.dept === me.dept));
  const decideQuote = (d: ApprovalDecision, note?: string) => {
    if (!saved || !approval) return;
    setQuotes((p) => p.map((x) => (x.id === saved.id ? { ...x, approval: { ...approval, status: d, decidedBy: me.id, decidedAt: Date.now(), note } } : x)));
    logDecision({ kind: 'QUOTE', refId: saved.id, title: `${saved.code} v${saved.version}: ${form.party.name}`, requesterId: approval.requestedBy, decision: d, note, amount: saved.amount });
    const req = users.find((u) => u.id === approval.requestedBy);
    dispatch('APPROVAL_RESULT', { to: req, title: `${d === 'APPROVED' ? 'Đã duyệt' : 'Từ chối'} báo giá ${saved.code}`, body: d === 'APPROVED' ? 'Đã mở khóa xuất PDF / Word.' : note ?? '' });
    notify(d === 'APPROVED' ? 'Đã duyệt giá, báo giá được mở khóa xuất file' : 'Đã từ chối báo giá', d === 'APPROVED' ? 'teal' : 'orange');
  };
  const exportQuote = (format: 'PDF' | 'WORD') => {
    if (!savedId) return notify('Bấm "Tạo báo giá" trước khi xuất file', 'orange');
    if (exportLocked) return notify('Báo giá đang chờ duyệt giá, chưa xuất được', 'orange');
    const title = `Báo giá ${code}`;
    if (format === 'PDF') printHtml(docShell(title, html)); else downloadWord(code, title, html);
    setQuotes((p) => p.map((x) => (x.id === savedId ? { ...x, exports: [...(x.exports ?? []), { format, at: todayISO(), by: me.id }] } : x)));
  };

  const projectOpts = myLeads.filter((l) => ['ACCEPTED', 'QUOTED', 'WON'].includes(l.status));
  const [stage, setStage] = useState<'edit' | 'send'>('edit');
  const [editParty, setEditParty0] = useState(!initial.party.name.trim());
  /** null = thu gọn sau khi chọn khách / dự án */
  const setEditParty = (v: boolean | null) => setEditParty0(v ?? false);
  const canSend = !!saved && !exportLocked;
  const sender = useQuoteSender({ form, code, version, total: totals.grand, sellerName: seller.name, html, onPdf: () => exportQuote('PDF'), onWord: () => exportQuote('WORD'), onClose });
  const tierSel = (
    <select className={cn(inputBase, 'w-auto py-1 text-[13px]')} value={form.tier} onChange={(e) => applyTier(e.target.value as PriceTier)} aria-label="Bảng giá">
      {(Object.keys(PRICE_TIER) as PriceTier[]).map((t) => <option key={t} value={t} disabled={t === 'BOQ' && !lead?.boqItems?.length}>{PRICE_TIER[t]}</option>)}
    </select>
  );
  const approvalBox = approval && (
    <div className={cn('rounded-[10px] border px-4 py-3 text-sm', approval.status === 'APPROVED' ? 'border-[rgb(var(--success)/0.4)] bg-[rgb(var(--success)/0.08)]' : approval.status === 'PENDING' ? 'border-[rgb(var(--accent)/0.5)] bg-[rgb(var(--accent)/0.08)]' : 'border-[rgb(var(--danger)/0.4)] bg-[rgb(var(--danger)/0.08)]')}>
      <p className="font-medium">{approval.status === 'PENDING' ? `Chờ ${approval.level === 'BOD' ? 'BOD' : 'Trưởng phòng'} duyệt giá` : approval.status === 'APPROVED' ? `Đã duyệt giá${approval.decidedBy ? `: ${users.find((u) => u.id === approval.decidedBy)?.name ?? ''}` : ''}` : approval.status === 'NEED_INFO' ? 'Được yêu cầu bổ sung' : 'Bị từ chối'}</p>
      <p className="text-xs text-[rgb(var(--muted))]">{approval.reasons.join('; ')}{approval.note ? `. Ghi chú: ${approval.note}` : ''}</p>
    </div>
  );
  const quoteSale = saved ? salesOrders.find((o) => o.quoteId === saved.id && o.status !== 'CANCELLED') : undefined;
  const editLeft = (
    <>
      {quoteSale && <SaleStockCard o={quoteSale} compact onOpen={() => { go('sales'); setOpenSale(quoteSale.id); onClose(); }} />}
      {approvalBox}
      {locked && <p className="rounded-[10px] border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 py-3 text-xs text-[rgb(var(--muted))]">Báo giá đã tạo chỉ xem và xuất lại. Muốn đổi giá, số lượng hoặc điều kiện, bấm "Báo giá điều chỉnh" để tạo phiên bản mới.</p>}
      <fieldset disabled={locked} className="min-w-0 space-y-3">
        <ComposerCard id="qc-1" n={1} title="Khách hàng" right={<button type="button" className={cn(btnGhost, btnSm)} aria-expanded={editParty} aria-controls="qc-1-body" onClick={() => setEditParty0(!editParty)} disabled={locked && !form.party.name}>{editParty ? 'Thu gọn' : locked ? 'Xem' : 'Mở'}<ChevronDown className={cn('h-3.5 w-3.5 transition-transform', editParty && 'rotate-180')} aria-hidden /></button>}>
          <div id="qc-1-body">
          {!editParty && !form.party.name.trim() ? (
            <button type="button" className="w-full rounded-lg border border-dashed border-[rgb(var(--ink)/0.16)] px-3 py-3 text-left text-[13px] text-[rgb(var(--muted))] hover:border-[rgb(var(--ink)/0.3)]" onClick={() => setEditParty0(true)}>Chưa có khách hàng: bấm để chọn khách CRM, dự án hoặc nhập khách lẻ</button>
          ) : !editParty ? (
            <div className="flex items-center gap-3">
              <Avatar name={form.party.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{form.party.name}</p>
                <p className="truncate text-[12.5px] text-[rgb(var(--muted))]">{[form.party.taxCode && `MST ${form.party.taxCode}`, form.party.address, form.party.phone].filter(Boolean).join(' · ') || 'Chưa có MST, địa chỉ'}{lead && <> · <span className="code-chip">{lead.code}</span> {lead.boqNote}</>}</p>
                {retail && <p className="mt-0.5 text-xs text-[rgb(var(--fg2))]">Báo giá nháp, khách lẻ: không cần duyệt giá; khi chốt sẽ tự thêm khách vào CRM</p>}
              </div>
              <div className="shrink-0 space-y-1 text-right text-[12.5px] text-[rgb(var(--muted))]">
                <p className="flex items-center justify-end gap-1.5">Bảng giá {tierSel}</p>
                <p className="flex items-center justify-end gap-1.5">VAT <select className={cn(inputBase, 'w-auto py-1 text-[13px]')} value={form.vatMode === 'LINE' ? 'LINE' : String(form.vatPct)} aria-label="Thuế suất VAT" onChange={(e) => { const v = e.target.value; if (v === 'LINE') setForm((f) => ({ ...f, vatMode: 'LINE' })); else setForm((f) => ({ ...f, vatMode: 'ALL', vatPct: Number(v), items: f.items.map(({ vat: _v, ...l }) => l) })); }}>{[0, 5, 8, 10].map((v) => <option key={v} value={v}>{v}%</option>)}<option value="LINE">Theo từng dòng</option></select></p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Khách hàng CRM">
                  <select className={inputCls} value={form.customerId ?? ''} onChange={(e) => { const c = customers.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, customerId: c?.id, party: c ? partyOf(c) : f.party })); if (c) setEditParty(null); }}>
                    <option value="">Khách mới / khách lẻ</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <Field label="Dự án">
                  <select className={inputCls} value={form.leadId ?? ''} disabled={!!savedId} onChange={(e) => { pickProject(e.target.value); setEditParty(null); }}>
                    <option value="">Không gắn dự án</option>
                    {projectOpts.map((l) => <option key={l.id} value={l.id}>{l.company}: {l.boqNote}</option>)}
                  </select>
                </Field>
              </div>
              <PartyFields form={form} setParty={setParty} />
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Bảng giá">{tierSel}</Field>
                <Field label="VAT"><select className={cn(inputBase, 'w-auto py-1 text-[13px]')} value={form.vatMode === 'LINE' ? 'LINE' : String(form.vatPct)} aria-label="Thuế suất VAT" onChange={(e) => { const v = e.target.value; if (v === 'LINE') setForm((f) => ({ ...f, vatMode: 'LINE' })); else setForm((f) => ({ ...f, vatMode: 'ALL', vatPct: Number(v), items: f.items.map(({ vat: _v, ...l }) => l) })); }}>{[0, 5, 8, 10].map((v) => <option key={v} value={v}>{v}%</option>)}<option value="LINE">Theo từng dòng</option></select></Field>
                {form.party.name.trim().length >= 3 && <button type="button" className={cn(btnGhost, btnSm, 'mb-1 ml-auto')} onClick={() => setEditParty(false)}>Xong</button>}
              </div>
              {retail && <p className="text-xs text-[rgb(var(--muted))]">Khách lẻ chưa có trong CRM (không MST, công nợ 0 ngày): lưu thành báo giá nháp, không cần duyệt giá; khi chốt sẽ tự thêm khách vào CRM.</p>}
            </div>
          )}
          </div>
        </ComposerCard>

        <ComposerCard id="qc-2" n={2} title="Hàng hóa" sub={`${form.items.length} dòng · ${PRICE_TIER[form.tier].toLowerCase()}`}>
          {!locked && <BuyTogether form={form} skus={skus} quotes={quotes} onAdd={(l) => set('items', [...form.items, l])} />}
          <SmartQuoteGrid items={form.items} onChange={(v) => set('items', v)} locked={locked} tier={form.tier === 'BOQ' ? TX_TYPE[form.txType].tier : form.tier} wide={wide} onWide={setWide} cust={{ id: form.customerId, name: form.party.name }} vatLine={form.vatMode === 'LINE'} vatPct={form.vatPct} />
          {(canSeeCost || level !== 'AUTO') && (
            <p className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-[rgb(var(--muted))]">
              {canSeeCost && <span>{gm !== null ? `Lãi gộp cả báo giá ${gm.toFixed(1)}%` : 'Có hàng chưa có giá vốn: chưa tính được lãi gộp'}</span>}
              {level !== 'AUTO' && <Chip tone={APPROVAL_LEVEL[level].tone}>{APPROVAL_LEVEL[level].label}</Chip>}
            </p>
          )}
        </ComposerCard>

        <ComposerCard id="qc-3" n={3} title="Điều khoản" right={
          <select className={cn(inputBase, 'w-auto max-w-[220px] py-1 text-[12.5px]')} value={form.quoteTplId} aria-label="Mẫu báo giá" onChange={(e) => { const t = docTemplates.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, quoteTplId: e.target.value, txType: t?.txType ?? f.txType, contractTplId: t?.pairId ?? f.contractTplId })); }}>
            {docTemplates.filter((t) => t.kind === 'QUOTE').map((t) => <option key={t.id} value={t.id}>theo mẫu "{t.name}"</option>)}
          </select>
        }>
          <TermsFields form={form} set={set} contract={false} part="pay" dense />
          <div className="mt-3">
            <Fold title="Giao hàng, bảo hành, ghi chú" summary={`${form.delivery || 'Chưa nhập giao hàng'} · BH ${form.warrantyMonths ? `${form.warrantyMonths} th` : 'theo tiêu chuẩn NSX'}`}>
              <TermsFields form={form} set={set} contract={false} part="other" />
            </Fold>
          </div>
        </ComposerCard>
      </fieldset>
      {errs.length > 0 && !locked && <ul className="space-y-0.5 px-1 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
      {!locked && <QuoteChecks form={form} skus={skus} canSeeCost={canSeeCost} retail={retail} onSubmit={errs.length ? undefined : save}
        onNote={(t) => { set('note', [form.note.trim(), t].filter(Boolean).join('\n')); notify('Đã thêm ghi chú giao hàng vào điều khoản', 'teal'); }}
        onEditParty={() => { setEditParty(true); document.getElementById('qc-1')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} />}
      {canSend && <button type="button" className={cn(btnGhost, 'w-full justify-center')} onClick={() => setStage('send')}><Send className="h-4 w-4" aria-hidden />Gửi khách</button>}
    </>
  );
  const left = stage === 'send' && canSend ? <>{sender.body}</> : editLeft;

  const canRevise = lead ? ['ACCEPTED', 'QUOTED'].includes(lead.status) : !!saved && saved.status !== 'ACCEPTED' && !saved.draft;
  const isDraftView = viewOnly && !!editQuote?.draft && editQuote.status !== 'ACCEPTED';
  const delDraft = () => {
    if (!editQuote) return;
    const root = editQuote.rootId ?? editQuote.id;
    const prev = quotes.filter((x) => (x.rootId ?? x.id) === root);
    setQuotes((p) => p.filter((x) => (x.rootId ?? x.id) !== root));
    notify(`Đã xóa báo giá nháp ${editQuote.code}`, 'orange', { label: 'Hoàn tác', run: () => setQuotes((p) => [...prev, ...p]) });
    onClose();
  };
  const draftQuote = saved?.draft && !lead;
  /** v46: báo giá cho khách có sẵn trong CRM (không dự án): ghi nhận chốt như báo giá nháp, tự tạo đơn bán */
  const custQuote = !lead && !!saved && !saved.draft && !!saved.customerId;
  const canWin = draftQuote ? saved?.status !== 'ACCEPTED' && canDo('customer.edit') : custQuote ? saved?.status !== 'ACCEPTED' && !exportLocked && (canDo('customer.edit') || canDo('project.update')) : !!savedId && !exportLocked && !!lead && lead.status === 'QUOTED' && canDo('project.update');
  const winHint = draftQuote ? (saved?.status === 'ACCEPTED' ? 'Đã ghi nhận chốt' : 'Ghi nhận chốt: tự thêm khách vào CRM, tạo đơn bán') : custQuote ? (saved?.status === 'ACCEPTED' ? 'Đã ghi nhận chốt' : exportLocked ? 'Chờ duyệt giá' : 'Ghi nhận chốt: tự tạo đơn bán, giữ hàng hoặc đề xuất mua') : !lead ? 'Gắn báo giá với dự án để chốt đơn' : lead.status === 'WON' ? 'Dự án đã chốt' : !savedId ? 'Gửi duyệt báo giá trước' : exportLocked ? 'Chờ duyệt giá' : !canDo('project.update') ? 'Không có quyền chốt đơn' : `Chốt đơn theo báo giá ${code} v${version}`;
  const winNow = () => {
    if (!canWin || !savedId) return;
    if (draftQuote || custQuote) { winDraftQuote(savedId); return; }
    if (!lead) return;
    winLead(lead.id, savedId);
    onClose();
  };
  const statusText = locked ? (exportLocked ? 'Đã gửi, chờ duyệt giá' : saved?.status === 'ACCEPTED' ? 'Đã chốt' : lead?.status === 'WON' ? 'Đơn đã chốt' : draftQuote ? 'Báo giá nháp, có thể xuất và gửi' : 'Đã duyệt, có thể xuất và gửi') : errs.length ? `Còn thiếu: ${errs[0]}` : retail ? 'Báo giá nháp: lưu là xuất được ngay' : level === 'AUTO' ? 'Giá trong ngưỡng: gửi là tự duyệt' : `${APPROVAL_LEVEL[level].label}: gửi để duyệt giá`;
  return (
    <ComposerShell
      title={`${locked ? 'Báo giá' : draftEdit ? 'Sửa báo giá' : reviseSrc ? 'Báo giá điều chỉnh' : 'Tạo báo giá'} ${code} · v${version}${draftQuote || (!locked && retail) ? ' · nháp' : ''}`}
      wide={wide}
      steps={[
        { label: 'Khách hàng', done: form.party.name.trim().length >= 3 && (!!lead || !!form.customerId || retail), onClick: () => { setStage('edit'); setTimeout(() => document.getElementById('qc-1')?.scrollIntoView({ behavior: 'smooth' }), 30); } },
        { label: 'Hàng hóa', done: form.items.length > 0 && !noName.length && !noPrice.length, onClick: () => { setStage('edit'); setTimeout(() => document.getElementById('qc-2')?.scrollIntoView({ behavior: 'smooth' }), 30); } },
        { label: 'Điều khoản', done: !!qTpl && !!savedId, onClick: () => { setStage('edit'); setTimeout(() => document.getElementById('qc-3')?.scrollIntoView({ behavior: 'smooth' }), 30); } },
        { label: 'Gửi khách', done: !!saved?.exports?.length, onClick: canSend ? () => setStage('send') : undefined },
      ]}
      subtitle={`${form.party.name || 'Khách hàng'}${lead ? ` · ${lead.code}` : ''}${approval?.status === 'APPROVED' ? ' · đã duyệt giá' : ''}`}
      badge={saved ? <Chip tone={QUOTE_STATUS[saved.status].tone}>{QUOTE_STATUS[saved.status].label}</Chip> : undefined}
      left={left}
      html={html}
      onClose={onClose}
      edit={{ enabled: !locked, customized: !!form.customHtml, onSave: (h) => set('customHtml', h), onReset: () => set('customHtml', undefined), kind: 'QUOTE' }}
      print={{ onClick: () => exportQuote('PDF'), disabled: !savedId || exportLocked, title: !savedId ? 'Lưu báo giá trước khi in' : exportLocked ? 'Chờ duyệt giá' : 'In / lưu PDF' }}
      share={{ name: `Báo giá ${code}${version > 1 ? ` v${version}` : ''}`, disabled: !savedId || exportLocked, title: !savedId ? 'Lưu báo giá trước khi chia sẻ' : exportLocked ? 'Chờ duyệt giá' : undefined }}
      footer={stage === 'send' && canSend ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px] text-[rgb(var(--muted))]">{approval?.status === 'APPROVED' ? `Đã được duyệt giá${approval.decidedAt ? ` ${new Date(approval.decidedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : ''}${approval.decidedBy ? ` · ${users.find((u) => u.id === approval.decidedBy)?.name ?? ''}` : ''}` : draftQuote ? 'Báo giá nháp, khách lẻ' : 'Giá trong ngưỡng, tự duyệt'}</span>
          <button type="button" className={btnGhost} onClick={() => setStage('edit')}>Quay lại</button>
          <button type="button" className={btnPrimary} onClick={sender.send} disabled={sender.disabled} title={sender.hint}><Send className="h-4 w-4" aria-hidden />{sender.label}</button>
        </>
      ) : (
        <DocActionBar
          totals={<DocTotals sub={totals.sub} vat={totals.vat} vatPct={totals.mixed ? -1 : form.vatPct} grand={totals.grand} gm={canSeeCost ? gm : undefined} />}
          status={<span className={cn('font-medium', locked ? 'text-[rgb(var(--success-fg))]' : errs.length ? 'text-[rgb(var(--danger-fg))]' : level === 'AUTO' ? 'text-[rgb(var(--muted))]' : 'text-[rgb(var(--accent-fg))]')}>{statusText}</span>}
          extra={<>
            {isDraftView && <button className={cn(btnGhost, btnSm)} onClick={() => { onClose(); openComposer({ quoteId: editQuote!.id, edit: true, mode: 'QUOTE' }); }}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa</button>}
            {isDraftView && <button className={cn(btnGhost, btnSm, 'hover:text-[rgb(var(--danger-fg))]')} onClick={delDraft}><Trash2 className="h-3.5 w-3.5" aria-hidden />Xóa</button>}
            {locked && canRevise && <button className={cn(btnGhost, btnSm)} onClick={() => { onClose(); openComposer(lead ? { leadId: lead.id, mode: 'QUOTE' } : { reviseOf: saved?.id ?? editQuote?.id, mode: 'QUOTE' }); }}><Pencil className="h-3.5 w-3.5" aria-hidden />Báo giá điều chỉnh</button>}
            {canDecide && (
              <>
                <button className={cn(btnBase, btnSm, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))]')} onClick={() => decideQuote('APPROVED')}>Duyệt giá</button>
                <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))]')} onClick={() => { const n = window.prompt('Lý do từ chối / yêu cầu sửa giá'); if (n && n.trim().length >= 3) decideQuote('REJECTED', n.trim()); }}>Từ chối</button>
              </>
            )}
            {canSend && <button className={cn(btnGhost, btnSm)} onClick={() => setStage('send')}><Send className="h-3.5 w-3.5" aria-hidden />Gửi khách</button>}
          </>}
          pdf={{ onClick: () => exportQuote('PDF'), disabled: !savedId || exportLocked, title: !savedId ? 'Lưu báo giá trước khi xuất' : exportLocked ? 'Chờ duyệt giá' : 'In / lưu PDF' }}
          word={{ onClick: () => exportQuote('WORD'), disabled: !savedId || exportLocked, title: !savedId ? 'Lưu báo giá trước khi xuất' : exportLocked ? 'Chờ duyệt giá' : 'Tải file Word (.doc)' }}
          win={{ onClick: winNow, disabled: !canWin, title: winHint, label: draftQuote || custQuote ? 'Ghi nhận chốt' : undefined }}
          submit={{ onClick: save, disabled: locked || errs.length > 0, label: locked ? 'Đã lưu' : retail ? 'Lưu báo giá nháp' : level === 'AUTO' ? 'Lưu báo giá' : 'Gửi duyệt giá', title: locked ? 'Muốn đổi giá hoặc điều kiện: tạo báo giá điều chỉnh' : errs[0] ?? (retail ? 'Khách lẻ: lưu và xuất được ngay, không cần duyệt giá' : level === 'AUTO' ? 'Lưu phiên bản, tự duyệt vì giá trong ngưỡng' : `Lưu phiên bản và gửi ${APPROVAL_LEVEL[level].label.replace('Cần ', '')}`) }}
        />
      )}
    />
  );
}

export function ContractComposer({ leadId, quoteId, docId, view, onClose }: { leadId?: string; quoteId?: string; docId?: string; view?: boolean; onClose: () => void }) {
  const { leads, customers, skus, company, users, me, role, docTemplates, genDocs, setGenDocs, quotes, notify, dispatch, canDo, openComposer, logDecision, winLead, wfFirstApprovers } = useApp();
  const lead0 = leads.find((x) => x.id === leadId);
  const baseId0 = genDocs.find((d) => d.id === docId)?.quoteId ?? quoteId ?? lead0?.wonQuoteId ?? (lead0 ? latestQuote(lead0.id, quotes)?.id : undefined);
  // Nguồn: bản được chỉ định, hoặc bản mới nhất đã có của báo giá này (tránh tạo trùng nhóm hợp đồng)
  const src = genDocs.find((d) => d.id === docId) ?? latestContracts(genDocs).find((d) => d.quoteId === baseId0);
  const viewOnly = !!view && !!src;
  const group = src ? docGroupOf(src) : undefined;
  const nextVersion = group ? Math.max(...genDocs.filter((d) => docGroupOf(d) === group).map((d) => d.version ?? 1)) + 1 : 1;
  const isLatest = !src || latestContracts(genDocs).some((d) => d.id === src.id);

  const [baseId, setBaseId] = useState<string | undefined>(src?.quoteId ?? baseId0);
  const base = quotes.find((q) => q.id === baseId);
  const baseLead = leads.find((l) => l.id === base?.leadId) ?? lead0 ?? leads.find((l) => l.id === src?.leadId);
  const options = quotes.filter((q) => q.lines.length && (baseLead ? q.leadId === baseLead.id : true));

  const formFromQuote = (q?: Quote): ComposerForm => {
    const l = leads.find((x) => x.id === q?.leadId) ?? lead0;
    const c = customers.find((x) => x.id === (q?.customerId ?? l?.customerId)) ?? (l ? findByTax(customers, l.taxCode) : undefined);
    const qt = docTemplates.find((t) => t.id === q?.templateId);
    const tx = qt?.txType ?? guessTx(c?.segment ?? l?.segment);
    const ct = docTemplates.find((t) => t.id === qt?.pairId) ?? docTemplates.find((t) => t.kind === 'CONTRACT' && t.txType === tx) ?? docTemplates.find((t) => t.kind === 'CONTRACT');
    const qf = q?.quoteForm;
    const project = tx === 'PROJECT_ME' || tx === 'EPC_SUB' || tx === 'SUPPLY_INSTALL';
    return {
      txType: tx, quoteTplId: q?.templateId ?? '', contractTplId: ct?.id ?? '', tier: q?.tier ?? 'PROJECT', leadId: l?.id, customerId: c?.id ?? q?.customerId,
      party: qf?.party ?? partyOf(c, l), items: (q?.lines ?? []).map(quoteLineToDoc), vatPct: q?.vatPct ?? 10,
      delivery: qf?.delivery ?? ct?.defaultDelivery ?? TX_TYPE[tx].delivery, advancePct: qf?.advancePct || (project ? 30 : 0), guaranteeType: project ? 'PERFORMANCE' : 'NONE', guaranteePct: project ? 10 : 0,
      warrantyMonths: qf?.warrantyMonths ?? 0, creditDays: qf?.creditDays ?? ct?.standardCreditDays ?? TX_TYPE[tx].credit, paymentMethod: qf?.paymentMethod ?? 'Chuyển khoản', validDays: 30, note: '',
    };
  };
  const [form, setForm] = useState<ComposerForm>(() => src?.form ?? formFromQuote(quotes.find((q) => q.id === baseId0)));
  const [savedId, setSavedId] = useState<string | undefined>(undefined);
  const shown = genDocs.find((d) => d.id === (savedId ?? (viewOnly ? src?.id : undefined)));
  const locked = viewOnly || !!savedId;
  const [code] = useState(() => src?.contractCode ?? `${String(Math.max(0, ...genDocs.map((d) => Number(d.contractCode.match(/^(\d+)/)?.[1] ?? 0))) + 1).padStart(4, '0')}/${new Date().getFullYear()}/HĐ-${company.shortName || 'CTY'}`);
  const version = shown?.version ?? (src && !viewOnly ? nextVersion : src?.version ?? 1);
  const set = <K extends keyof ComposerForm>(k: K, v: ComposerForm[K]) => setForm((p) => ({ ...p, [k]: v }));
  const setParty = (k: keyof ComposerForm['party'], v: string) => setForm((p) => ({ ...p, party: { ...p.party, [k]: v } }));

  const customer = customers.find((x) => x.id === form.customerId);
  const cTpl = docTemplates.find((t) => t.id === form.contractTplId);
  const totals = docTotals(form);
  const special = specialTermsOf(form, cTpl, customer, skus);
  const seller = users.find((u) => u.id === baseLead?.assignee) ?? me;
  const { vars, flags } = buildDocVars(form, { company, quoteCode: base?.code ?? '', contractCode: version > 1 ? `${code} (v${version})` : code, projectName: baseLead?.boqNote, projectCode: baseLead?.code, salesName: seller.name, salesPhone: seller.phone ?? company.phone, salesEmail: seller.email, skus });
  const html = form.customHtml ?? withMilestones(cTpl ? renderTemplate(cTpl.body, vars, flags) : '<p>Chưa chọn mẫu hợp đồng</p>', form.milestones, totals.grand, form.latePenaltyPct);
  const docDept = baseLead?.dept ?? customer?.dept;
  const canApprove = canDo('contract.approve') && (role === 'BOD' || (role === 'DEPT_HEAD' && docDept === me.dept));
  const canEdit = canDo('project.update') || canDo('customer.edit');
  const canExport = !!shown && (shown.status === 'ISSUED' || shown.status === 'APPROVED');
  const canWinC = canExport && !!baseLead && !!baseId && baseLead.status === 'QUOTED' && canDo('project.update');
  const errs: string[] = [];
  if (!base) errs.push('Chọn báo giá làm căn cứ hợp đồng');
  if (form.party.name.trim().length < 3) errs.push('Nhập tên pháp nhân bên mua');
  if (!cTpl) errs.push('Chọn mẫu hợp đồng');
  const msSum = (form.milestones ?? []).reduce((t, m) => t + (Number(m.pct) || 0), 0);
  if (form.milestones?.length && Math.round(msSum) !== 100) errs.push(`Các đợt thanh toán cộng ${msSum}%, cần đúng 100%`);

  const pickBase = (id: string) => {
    const q = quotes.find((x) => x.id === id);
    setBaseId(id);
    if (q) setForm((f) => ({ ...f, items: q.lines.map(quoteLineToDoc), vatPct: q.vatPct, quoteTplId: q.templateId ?? f.quoteTplId }));
  };

  /** Tạo phiên bản: không có điều khoản đặc biệt -> hiệu lực; có -> chờ duyệt và gửi thông báo */
  const create = () => {
    if (locked) return;
    if (errs.length) return notify(errs[0], 'red');
    const needApproval = special.length > 0;
    const id = uid('gd');
    const rec: GeneratedDoc = {
      id, groupId: group ?? id, version: src ? nextVersion : 1, quoteCode: base?.code ?? '', contractCode: code, leadId: baseLead?.id, customerId: form.customerId, partyName: form.party.name,
      form, total: totals.grand, special, status: needApproval ? 'PENDING_APPROVAL' : 'ISSUED', fingerprint: JSON.stringify(form), createdAt: todayISO(), createdBy: me.id, quoteId: baseId, exports: [], submittedAt: needApproval ? Date.now() : undefined,
    };
    setGenDocs((all) => [rec, ...all.map((d) => (group && docGroupOf(d) === group && d.status !== 'SUPERSEDED' ? { ...d, status: 'SUPERSEDED' as GenDocStatus } : d))]);
    setSavedId(id);
    if (needApproval) {
      dispatch('CONTRACT_APPROVAL', { lead: baseLead, toAll: wfFirstApprovers('CONTRACT', { requesterId: me.id, dept: baseLead?.dept ?? customers.find((c) => c.id === form.customerId)?.dept, amount: totals.grand, vals: { amount: totals.grand, special: special.length } }).filter((u) => u.id !== me.id), title: `Hợp đồng chờ duyệt: ${form.party.name}`, body: `${code} v${rec.version}, ${compact(totals.grand)}. ${special.join('; ')}`, module: 'tasks' });
      notify(`Đã gửi phê duyệt hợp đồng ${code} v${rec.version}`, 'teal');
    } else notify(`Đã tạo hợp đồng ${code} v${rec.version}, có hiệu lực`, 'teal');
  };
  const decideDoc = (id: string, ok: boolean, note?: string) => {
    const d0 = genDocs.find((d) => d.id === id);
    if (!d0) return;
    setGenDocs((all) => all.map((d) => (d.id === id ? { ...d, ...(ok ? { status: 'APPROVED' as GenDocStatus, approvedBy: me.id, approvedAt: todayISO() } : { status: 'REJECTED' as GenDocStatus, rejectNote: note || 'Từ chối tại màn hợp đồng' }) } : d)));
    logDecision({ kind: 'CONTRACT', refId: id, title: `${d0.contractCode} v${d0.version ?? 1}: ${d0.partyName}`, requesterId: d0.createdBy, decision: ok ? 'APPROVED' : 'REJECTED', amount: d0.total, note: note || undefined });
    notify(ok ? 'Đã duyệt hợp đồng' : 'Đã từ chối hợp đồng', ok ? 'teal' : 'orange');
  };
  const decide = (ok: boolean) => {
    if (!shown) return;
    decideDoc(shown.id, ok);
    return;
    notify(ok ? 'Đã duyệt hợp đồng' : 'Đã từ chối hợp đồng', ok ? 'teal' : 'orange');
  };
  const exportContract = (format: 'PDF' | 'WORD') => {
    if (!shown || !canExport) return;
    const file = `${code.replace(/\//g, '-')}${(shown.version ?? 1) > 1 ? `-v${shown.version}` : ''}`;
    const title = `Hợp đồng ${file}`;
    if (format === 'PDF') printHtml(docShell(title, html)); else downloadWord(file, title, html);
    setGenDocs((all) => all.map((d) => (d.id === shown.id ? { ...d, exports: [...d.exports, { kind: 'CONTRACT', format, at: todayISO(), by: me.id }] } : d)));
  };

  const [mode, setMode] = useState<'edit' | 'compare'>('edit');
  const [pickBase0, setPickBase0] = useState(!base);
  const versionsN = group ? genDocs.filter((d) => docGroupOf(d) === group).length : 0;
  const msN = form.milestones?.length ?? 0;
  const pIn = (k: keyof ComposerForm['party'], label: string, cls?: string) => <Field label={label} className={cls}><input className={inputCls} value={form.party[k] ?? ''} onChange={(e) => setParty(k, e.target.value)} /></Field>;
  const statusBox = locked && shown && (
    <div className={cn('rounded-[10px] border px-4 py-3 text-sm', shown.status === 'PENDING_APPROVAL' ? 'border-[rgb(var(--accent)/0.5)] bg-[rgb(var(--accent)/0.08)]' : shown.status === 'REJECTED' ? 'border-[rgb(var(--danger)/0.4)] bg-[rgb(var(--danger)/0.08)]' : 'border-[rgb(var(--success)/0.4)] bg-[rgb(var(--success)/0.08)]')}>
      <p className="font-medium">Phiên bản v{shown.version ?? 1}: {GENDOC_STATUS[shown.status].label}</p>
      <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{shown.status === 'PENDING_APPROVAL' ? `Chờ duyệt: ${shown.special.join('; ')}` : shown.status === 'REJECTED' ? `Lý do: ${shown.rejectNote ?? '—'}. Bấm "Sửa, tạo phiên bản mới" để chỉnh và gửi lại.` : 'Đã có hiệu lực, xuất được PDF / Word.'}</p>
    </div>
  );
  const editLeft = (
    <>
      {special.length > 0 && !locked && (
        <div className="rounded-[10px] border border-[rgb(var(--accent)/0.6)] bg-[rgb(var(--accent)/0.08)] px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--accent-fg))]"><AlertTriangle className="h-4 w-4" aria-hidden />Hợp đồng có điều khoản cần phê duyệt</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6 text-[13px] text-[rgb(var(--fg2))]">{special.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
      {statusBox}
      <fieldset disabled={locked} className="min-w-0 space-y-3">
        <ComposerCard id="ct-1" n={1} title="Căn cứ" right={
          <select className={cn(inputBase, 'w-auto max-w-[220px] py-1 text-[12.5px]')} value={form.contractTplId} onChange={(e) => set('contractTplId', e.target.value)} aria-label="Mẫu hợp đồng">
            {docTemplates.filter((t) => t.kind === 'CONTRACT').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        }>
          {base && !pickBase0 ? (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--raised))]"><FileText className="h-4 w-4 text-[rgb(var(--fg2))]" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate"><span className="code-chip">{base.code}</span> <span className="font-medium">v{base.version}</span> <span className="text-[13px] text-[rgb(var(--muted))]">· {QUOTE_STATUS[base.status].label.toLowerCase()} {new Date(base.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}</span></p>
                  <p className="truncate text-[12.5px] text-[rgb(var(--muted))]">{form.items.length} dòng hàng · {totals.grand.toLocaleString('vi-VN')} đ gồm VAT · tạm ứng {form.advancePct}%, công nợ {form.creditDays} ngày</p>
                </div>
                {!locked && options.length > 1 && <button type="button" className={cn(btnGhost, btnSm)} onClick={() => setPickBase0(true)}>Đổi báo giá</button>}
              </div>
              <div className="mt-3">
                <Fold title="Hàng hóa kế thừa báo giá" summary={`${form.items.length} dòng · ${moneyToWordsVN(totals.grand)}`}>
                  <table className="w-full table-fixed text-xs">
                    <colgroup><col /><col className="w-14" /><col className="w-[110px]" /></colgroup>
                    <tbody>{form.items.map((l) => <tr key={l.sku + l.name} className="border-b border-[rgb(var(--line))] last:border-0"><td className="truncate py-1.5 pr-2" title={l.name}>{l.name}</td><td className="text-right tabular-nums">{l.qty.toLocaleString('vi-VN')}</td><td className="text-right tabular-nums">{Math.round(l.qty * l.price).toLocaleString('vi-VN')}</td></tr>)}</tbody>
                  </table>
                </Fold>
              </div>
            </>
          ) : options.length ? (
            <Field label="Báo giá căn cứ">
              <select className={inputCls} value={baseId ?? ''} onChange={(e) => { pickBase(e.target.value); setPickBase0(false); }}>
                <option value="" disabled>Chọn báo giá…</option>
                {options.map((q) => <option key={q.id} value={q.id}>{q.code} v{q.version}, {compact(q.amount)}{q.status === 'ACCEPTED' ? ' (khách đã chốt)' : ''}</option>)}
              </select>
            </Field>
          ) : <p className="rounded-lg bg-[rgb(var(--raised))] px-3 py-2.5 text-[13px] text-[rgb(var(--fg2))]">Chưa có báo giá có dòng hàng hóa để làm căn cứ.</p>}
        </ComposerCard>

        <ComposerCard id="ct-2" n={2} title="Bên mua" right={<>
          {customer && <span className="flex items-center gap-1.5 text-xs text-[rgb(var(--muted))]"><span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--success))]" aria-hidden />Lấy từ CRM</span>}
          {(customer || baseLead) && !locked && <button type="button" className={cn(btnGhost, btnSm)} title="Điền lại pháp nhân, MST, địa chỉ, người đại diện từ hồ sơ khách hàng" onClick={() => setForm((f) => ({ ...f, party: { ...partyOf(customer, baseLead), authDoc: f.party.authDoc } }))}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Lấy lại</button>}
        </>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {pIn('name', 'Tên pháp nhân *', 'sm:col-span-2')}{pIn('taxCode', 'Mã số thuế')}
            {pIn('address', 'Địa chỉ', 'sm:col-span-2')}{pIn('phone', 'Điện thoại')}
            {pIn('rep', 'Người đại diện')}{pIn('repTitle', 'Chức vụ')}{pIn('authDoc', 'Giấy ủy quyền')}
          </div>
        </ComposerCard>

        <ComposerCard id="ct-3" n={3} title="Thanh toán theo đợt" right={!locked && msN > 0 ? <button type="button" className={cn(btnGhost, btnSm)} onClick={() => set('milestones', [...(form.milestones ?? []), { label: `Đợt ${msN + 1}`, pct: Math.max(0, 100 - (form.milestones ?? []).reduce((t, m) => t + (Number(m.pct) || 0), 0)), cond: '' }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm đợt</button> : undefined}>
          <MilestonesField form={form} set={set} grand={totals.grand} locked={locked} />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Bảo lãnh">
              <select className={inputCls} value={form.guaranteeType} onChange={(e) => set('guaranteeType', e.target.value as GuaranteeType)}>
                {(Object.keys(GUARANTEE_LABEL) as GuaranteeType[]).map((g) => <option key={g} value={g}>{GUARANTEE_LABEL[g]}</option>)}
              </select>
            </Field>
            <Field label="Phạt chậm thanh toán"><span className="relative block"><input className={cn(inputCls, 'pr-14 tabular-nums')} type="number" min={0} step={0.01} value={form.latePenaltyPct ?? ''} placeholder="0" onChange={(e) => set('latePenaltyPct', e.target.value === '' ? undefined : Number(e.target.value))} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--muted))]">%/ngày</span></span></Field>
            <Field label="Bảo hành"><span className="relative block"><input className={cn(inputCls, 'pr-14 tabular-nums')} type="number" min={0} value={form.warrantyMonths || ''} placeholder="Theo tiêu chuẩn NSX" onChange={(e) => set('warrantyMonths', Math.max(0, Number(e.target.value) || 0))} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--muted))]">tháng</span></span></Field>
          </div>
          <div className="mt-3">
            <Fold title="Tạm ứng, công nợ, giao hàng, ghi chú" summary={`tạm ứng ${form.advancePct}% · công nợ ${form.creditDays} ngày`}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tạm ứng (%)"><input className={inputCls} type="number" min={0} max={100} value={form.advancePct} onChange={(e) => set('advancePct', Number(e.target.value))} /></Field>
                <Field label="Công nợ (ngày)" hint={`Chuẩn của mẫu: ${cTpl?.standardCreditDays ?? 0} ngày`}><input className={inputCls} type="number" min={0} value={form.creditDays} onChange={(e) => set('creditDays', Number(e.target.value))} /></Field>
                {form.guaranteeType !== 'NONE' && <Field label="Giá trị bảo lãnh (%)"><input className={inputCls} type="number" min={0} max={100} value={form.guaranteePct} onChange={(e) => set('guaranteePct', Number(e.target.value))} /></Field>}
                <Field label="Hình thức thanh toán"><input className={inputCls} value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)} /></Field>
                <Field label="Tiến độ / địa điểm giao hàng" className="col-span-2"><input className={inputCls} value={form.delivery} onChange={(e) => set('delivery', e.target.value)} /></Field>
                <Field label="Ghi chú" className="col-span-2"><textarea className={cn(inputCls, 'min-h-16')} value={form.note} onChange={(e) => set('note', e.target.value)} /></Field>
              </div>
            </Fold>
          </div>
        </ComposerCard>
      </fieldset>
      {!locked && errs.length > 0 && <ul className="space-y-0.5 px-1 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
      <ContractAiReview html={html} special={special} />
    </>
  );
  const restore = (id: string) => { onClose(); openComposer({ docId: id, mode: 'CONTRACT' }); };
  const left = mode === 'compare' && group
    ? <ContractVersionDiff key={shown?.id ?? src?.id} group={group} currentId={shown?.id ?? src?.id} canApprove={canApprove} onDecide={decideDoc} onRestore={canEdit ? restore : undefined} />
    : editLeft;
  const fileBase = `${code.replace(/\//g, '-')}${version > 1 ? `-v${version}` : ''}`;

  return (
    <ComposerShell
      title={`${locked ? 'Hợp đồng' : src ? 'Sửa hợp đồng' : 'Tạo hợp đồng'} ${code} · v${version}`}
      subtitle={mode === 'compare' ? `So sánh phiên bản${shown ? ` · ${GENDOC_STATUS[shown.status].label.toLowerCase()}` : ''}` : `${form.party.name || 'Bên mua'}${base ? ` · căn cứ ${base.code} v${base.version}` : ''}`}
      outline
      steps={[
        { label: 'Căn cứ', done: !!base && !!cTpl, onClick: () => { setMode('edit'); setTimeout(() => document.getElementById('ct-1')?.scrollIntoView({ behavior: 'smooth' }), 30); } },
        { label: 'Bên mua', done: form.party.name.trim().length >= 3 && !!form.party.taxCode.trim(), onClick: () => { setMode('edit'); setTimeout(() => document.getElementById('ct-2')?.scrollIntoView({ behavior: 'smooth' }), 30); } },
        { label: 'Điều khoản', done: !!base && !!form.delivery && !errs.some((x) => x.startsWith('Các đợt')) && (locked || !special.length), onClick: () => { setMode('edit'); setTimeout(() => document.getElementById('ct-3')?.scrollIntoView({ behavior: 'smooth' }), 30); } },
        { label: 'Trình ký', done: canExport, onClick: versionsN > 1 ? () => setMode('compare') : undefined },
      ]}
      badge={shown ? <Chip tone={GENDOC_STATUS[shown.status].tone}>{GENDOC_STATUS[shown.status].label}</Chip> : undefined}
      left={left}
      html={html}
      onClose={onClose}
      edit={{ enabled: !locked, customized: !!form.customHtml, onSave: (h) => set('customHtml', h), onReset: () => set('customHtml', undefined), kind: 'CONTRACT' }}
      print={{ onClick: () => exportContract('PDF'), disabled: !canExport, title: canExport ? 'In / lưu PDF' : 'Chỉ in hợp đồng có hiệu lực' }}
      share={{ name: `Hợp đồng ${fileBase}`, disabled: !canExport, title: canExport ? undefined : 'Chỉ chia sẻ hợp đồng có hiệu lực' }}
      footer={mode === 'compare' ? (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px] text-[rgb(var(--muted))]">{shown ? `v${shown.version ?? 1} ${GENDOC_STATUS[shown.status].label.toLowerCase()}${shown.submittedAt ? ` · gửi lúc ${new Date(shown.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Đang soạn phiên bản mới'}</span>
          <button type="button" className={btnGhost} onClick={() => setMode('edit')}><Eye className="h-4 w-4" aria-hidden />Xem bản đầy đủ</button>
        </>
      ) : (
        <DocActionBar
          totals={<span className="text-[13px] text-[rgb(var(--fg2))]">Giá trị <b className="font-mono font-medium text-[rgb(var(--fg))]">{totals.grand.toLocaleString('vi-VN')} đ</b>{msN ? ` · ${msN} đợt thanh toán` : ''}{special.length && !locked ? ` · ${special.length} điều khoản cần duyệt` : ''}</span>}
          status={!locked && errs.length ? <span className="font-medium text-[rgb(var(--danger-fg))]">Còn thiếu: {errs[0]}</span> : locked ? <span className={cn('font-medium', canExport ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--accent-fg))]')}>{canExport ? 'Có hiệu lực, xuất được file' : shown ? GENDOC_STATUS[shown.status].label : ''}</span> : <span />}
          extra={<>
            {locked && shown?.status === 'PENDING_APPROVAL' && canApprove && (
              <>
                <button className={cn(btnBase, btnSm, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => (versionsN > 1 ? setMode('compare') : decide(true))}>Duyệt</button>
                <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))]')} onClick={() => (versionsN > 1 ? setMode('compare') : decide(false))}>Từ chối</button>
              </>
            )}
            {viewOnly && isLatest && canEdit && shown?.status !== 'PENDING_APPROVAL' && <button className={cn(btnGhost, btnSm)} onClick={() => { onClose(); openComposer({ docId: src!.id, mode: 'CONTRACT' }); }}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa, tạo phiên bản mới</button>}
            {versionsN > 1 && <button className={cn(btnGhost, btnSm)} onClick={() => setMode('compare')}><History className="h-3.5 w-3.5" aria-hidden />So sánh phiên bản</button>}
          </>}
          pdf={{ onClick: () => exportContract('PDF'), disabled: !canExport, title: canExport ? 'In / lưu PDF' : 'Chỉ xuất hợp đồng có hiệu lực' }}
          word={{ onClick: () => exportContract('WORD'), disabled: !canExport, title: canExport ? 'Tải file Word (.doc)' : 'Chỉ xuất hợp đồng có hiệu lực' }}
          win={{ onClick: () => { if (baseLead && baseId) { winLead(baseLead.id, baseId); onClose(); } }, disabled: !canWinC, title: !baseLead ? 'Hợp đồng chưa gắn dự án' : baseLead.status === 'WON' ? 'Dự án đã chốt' : !canExport ? 'Hợp đồng cần có hiệu lực trước' : 'Chốt đơn theo báo giá căn cứ' }}
          submit={{ onClick: create, disabled: locked || errs.length > 0, label: locked ? 'Đã trình' : special.length ? 'Trình duyệt' : src ? `Trình ký v${nextVersion}` : 'Trình ký', title: locked ? 'Phiên bản đã lưu, chỉ xem' : errs[0] ?? (special.length ? `Lưu và gửi duyệt: ${special.join('; ')}` : 'Lưu phiên bản, có hiệu lực ngay') }}
        />
      )}
    />
  );
}

/** Dải tổng ở chân màn soạn: Cộng tiền hàng · VAT · Tổng · Lãi gộp (chỉ người xem được giá vốn) */
export function DocTotals({ sub, vat, vatPct, grand, gm }: { sub: number; vat: number; vatPct: number; grand: number; gm?: number | null }) {
  const it = (l: string, v: string, cls?: string, wide?: boolean) => <span className={cn('whitespace-nowrap', wide && 'hidden 2xl:inline')}>{l}<b className={cn('ml-1.5 font-mono text-[13px] font-medium text-[rgb(var(--fg))]', cls)}>{v}</b></span>;
  return (
    <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[rgb(var(--fg2))] lg:w-auto">
      {it('Cộng tiền hàng', compact(sub), undefined, true)}
      {it(vatPct < 0 ? 'VAT' : `VAT ${vatPct}%`, compact(vat), undefined, true)}
      {it('Tổng', `${grand.toLocaleString('vi-VN')} đ`)}
      {gm !== undefined && it('Lãi gộp', gm === null ? (sub ? 'chưa đủ giá vốn' : '—') : `${gm.toFixed(1)}%`, gm === null ? 'font-sans' : gm < GM_RULE.bod ? 'text-[rgb(var(--danger-fg))]' : gm < GM_RULE.head ? 'text-[rgb(var(--accent-fg))]' : undefined)}
    </div>
  );
}

/** Thẻ một phần trong màn soạn: số thứ tự, tiêu đề, phụ đề, nút bên phải */
export function ComposerCard({ id, n, title, sub, right, children }: { id?: string; n?: number; title: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-xl border border-[rgb(var(--ink)/0.08)] bg-[rgb(var(--surface))] px-4 py-3.5">
      <div className="mb-3 flex min-h-7 items-center gap-2">
        {n !== undefined && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--fg))] font-mono text-[11px] font-medium text-[rgb(var(--bg))]">{n}</span>}
        <h3 className="text-sm font-medium">{title}</h3>
        {sub && <span className="truncate text-[12.5px] text-[rgb(var(--muted))]">{sub}</span>}
        {right && <span className="ml-auto flex shrink-0 items-center gap-1.5">{right}</span>}
      </div>
      {children}
    </section>
  );
}

/** Thường mua kèm: hàng hay đi cùng hàng đang báo trong các báo giá trước */
export function BuyTogether({ form, skus, quotes, onAdd }: { form: ComposerForm; skus: SkuItem[]; quotes: Quote[]; onAdd: (l: DocLine) => void }) {
  const have = new Set(form.items.map((l) => l.sku).filter(Boolean));
  if (!have.size) return null;
  const tier = form.tier === 'BOQ' ? TX_TYPE[form.txType].tier : form.tier;
  const pairs = new Map<string, { n: number; base: number; anchor: string; qty: number }>();
  const rel = quotes.filter((x) => x.lines.some((ln) => have.has(ln.sku)));
  rel.forEach((x) => {
    const anchor = x.lines.find((ln) => have.has(ln.sku))?.name ?? '';
    new Set(x.lines.map((ln) => ln.sku)).forEach((code) => {
      if (!code || have.has(code)) return;
      const p = pairs.get(code) ?? { n: 0, base: rel.length, anchor, qty: x.lines.find((ln) => ln.sku === code)?.qty ?? 1 };
      pairs.set(code, { ...p, n: p.n + 1 });
    });
  });
  const sugg = [...pairs.entries()].map(([code, p]) => ({ k: skus.find((s) => s.sku === code && !s.archived), ...p })).filter((x) => x.k && x.n >= 2 && x.n / x.base >= 0.3).sort((x, y) => y.n - x.n).slice(0, 1);
  if (!sugg.length) return null;
  return (
    <>
      {sugg.map(({ k, n, base, anchor, qty }) => (
        <div key={k!.sku} className="mb-3 flex items-center gap-3 rounded-[10px] border border-dashed border-[rgb(var(--ink)/0.16)] px-3 py-2.5 text-[13px] text-[rgb(var(--fg2))]">
          <Sparkles className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
          <span className="min-w-0 flex-1">Thường mua kèm {anchor}: <b className="font-medium text-[rgb(var(--fg))]">{k!.name}</b> · {n} / {base} báo giá tương tự</span>
          <button type="button" className={cn(btnGhost, btnSm)} onClick={() => { const p = tierPrice(k, tier); onAdd({ sku: k!.sku, name: k!.name, unit: k!.unit, qty, price: p, listPrice: p, discountPct: 0 }); }}>Thêm {qty.toLocaleString('vi-VN')} {k!.unit}</button>
        </div>
      ))}
    </>
  );
}

export function CheckList({ items }: { items: CheckItem[] }) {
  return (
    <ul className="divide-y divide-[rgb(var(--line))]">
      {items.map((x) => (
        <li key={x.title} className="flex items-start gap-3 py-2.5">
          <span className={cn('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', CHECK_DOT[x.tone])} aria-hidden />
          <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{x.title}</p><p className="text-xs text-[rgb(var(--muted))]">{x.detail}</p></div>
          {x.act}
        </li>
      ))}
    </ul>
  );
}

/** Kiểm tra trước khi gửi (tính tại chỗ, không cần AI) kèm nút xử lý ngay */
export function QuoteChecks({ form, skus, canSeeCost, retail, onSubmit, onNote, onEditParty }: { form: ComposerForm; skus: SkuItem[]; canSeeCost: boolean; retail: boolean; onSubmit?: () => void; onNote: (t: string) => void; onEditParty: () => void }) {
  const items: CheckItem[] = [];
  const act = (label: string, fn?: () => void) => fn && <button type="button" className={cn(btnGhost, btnSm, 'shrink-0')} onClick={fn}>{label}</button>;
  form.items.forEach((l, i) => {
    const k = skus.find((s) => s.sku === l.sku);
    if (!k) return;
    if (canSeeCost && !retail && k.costPrice > 0 && l.price > 0) {
      const g = ((l.price - k.costPrice) / l.price) * 100;
      if (g < GM_RULE.head) items.push({ tone: g < GM_RULE.bod ? 'red' : 'orange', title: `${l.name}: lãi gộp ${g.toFixed(1)}%`, detail: `dòng ${i + 1}, thấp hơn ngưỡng ${g < GM_RULE.bod ? GM_RULE.bod : GM_RULE.head}%; cấp duyệt tính theo lãi gộp cả báo giá`, act: items.some((x) => x.title.includes('lãi gộp')) ? undefined : act('Gửi duyệt', onSubmit) });
    }
    if (l.qty > k.stock) items.push({ tone: 'orange', title: `Tồn ${l.name}: ${k.stock.toLocaleString('vi-VN')}, báo ${l.qty.toLocaleString('vi-VN')}`, detail: `thiếu ${(l.qty - k.stock).toLocaleString('vi-VN')} ${l.unit}${k.leadTimeDays ? ` · thời gian về hàng khoảng ${k.leadTimeDays} ngày` : ''}`,
      act: act('Ghi chú giao', () => onNote(`Giao trước ${k.stock.toLocaleString('vi-VN')} ${l.unit} ${l.name}; ${(l.qty - k.stock).toLocaleString('vi-VN')} ${l.unit} còn lại giao khi hàng về${k.leadTimeDays ? ` (khoảng ${k.leadTimeDays} ngày)` : ''}.`)) });
  });
  const tax = form.party.taxCode.replace(/[\s.]/g, '');
  if (retail) items.push({ tone: 'teal', title: 'Khách lẻ, báo giá nháp', detail: 'không cần MST và duyệt giá; khi chốt sẽ tự thêm khách vào CRM' });
  else if (!tax) items.push({ tone: 'orange', title: 'Chưa có mã số thuế khách hàng', detail: 'cần khi xuất hóa đơn và làm hợp đồng', act: act('Nhập MST', onEditParty) });
  else if (!/^\d{10}(-?\d{3})?$/.test(tax)) items.push({ tone: 'red', title: `Mã số thuế "${form.party.taxCode}" sai định dạng`, detail: 'MST gồm 10 số, chi nhánh thêm 3 số', act: act('Sửa', onEditParty) });
  else items.push({ tone: 'teal', title: 'Mã số thuế đúng định dạng', detail: 'chỉ kiểm tra định dạng, chưa tra cứu tình trạng hoạt động' });
  if (!form.party.email && !form.party.phone) items.push({ tone: 'orange', title: 'Chưa có email hoặc điện thoại người nhận', detail: 'cần để gửi báo giá', act: act('Nhập', onEditParty) });
  if (!form.items.length) return null;
  return (
    <ComposerCard title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Kiểm tra trước khi gửi</span>} right={<span className="text-xs text-[rgb(var(--muted))]">tự chạy khi sửa</span>}>
      <div className="-mt-2"><CheckList items={items} /></div>
    </ComposerCard>
  );
}

/** Bước Gửi khách: kênh (Email / Zalo / Tải về), thư soạn sẵn (AI soạn khi đã bật), đính kèm. Trả về phần thân và nút gửi cho chân màn hình */
export function useQuoteSender({ form, code, version, total, sellerName, html, onPdf, onWord, onClose }: { form: ComposerForm; code: string; version: number; total: number; sellerName: string; html: string; onPdf: () => void; onWord: () => void; onClose: () => void }) {
  const { company, notify, addMsgLog, me, org, zaloConvs, setZaloMsgs, go, canDo } = useApp();
  const [srv] = useServerStatus();
  const ai = useAi('writer');
  const seller = company.shortName || company.legalName;
  const greet = form.party.rep ? `Kính gửi ${form.party.repTitle ? `${form.party.repTitle} ` : ''}${form.party.rep},` : `Kính gửi Quý ${form.party.name},`;
  const plain = `${greet}\n\n${seller} xin gửi báo giá số ${code}${version > 1 ? ` (bản ${version})` : ''}, tổng giá trị ${total.toLocaleString('vi-VN')} đ (đã gồm VAT), hiệu lực ${form.validDays} ngày.\nĐiều kiện thanh toán: ${form.advancePct ? `tạm ứng ${form.advancePct}%, ` : ''}${form.creditDays ? `công nợ ${form.creditDays} ngày` : 'thanh toán khi nhận hàng'}. Giao hàng: ${form.delivery || 'theo thỏa thuận'}.\n\nBáo giá chi tiết trong file đính kèm. Rất mong nhận được phản hồi của Quý khách.\n\nTrân trọng,\n${me.signature?.trim() || `${sellerName}${me.phone ? ` · ${me.phone}` : ''}\n${seller}`}`;
  const [ch, setCh] = useState<'EMAIL' | 'ZALO' | 'FILE'>('EMAIL');
  const [to, setTo] = useState(form.party.email);
  const [cc, setCc] = useState(me.email ?? '');
  const [phone, setPhone] = useState(form.party.phone);
  const [subject, setSubject] = useState(`Báo giá ${code} - ${seller}`);
  const [body, setBody] = useState(plain);
  const [busy, setBusy] = useState('');
  const [sending, setSending] = useState(false);
  const draft = async (key: string, how: string) => {
    setBusy(key);
    const r = await ai.ask({ prompt: `Soạn thư gửi khách kèm báo giá, tiếng Việt, lịch sự, không bịa thông tin ngoài dữ liệu sau. ${how}\nKhách: ${form.party.name}${form.party.rep ? `, người nhận ${form.party.repTitle} ${form.party.rep}` : ''}\nBáo giá: ${code} v${version}, tổng ${total.toLocaleString('vi-VN')} đ gồm VAT, hiệu lực ${form.validDays} ngày\nHàng chính: ${form.items.slice(0, 5).map((l) => `${l.name} (${l.qty} ${l.unit})`).join('; ')}\nThanh toán: tạm ứng ${form.advancePct}%, công nợ ${form.creditDays} ngày. Giao hàng: ${form.delivery}\nNgười gửi: ${sellerName}, ${seller}\nChỉ trả về nội dung thư, không có tiêu đề.`, maxTokens: 700 });
    setBusy('');
    if (r.ok) setBody(r.text.trim()); else notify(r.error, 'orange');
  };
  const p9 = digits9(phone);
  const conv = p9.length === 9 ? zaloConvs.find((c) => digits9(c.phone) === p9) : undefined;
  const oaReady = srv.zalo.oa && !!conv?.zaloUserId;
  const file = `${code}${version > 1 ? `-v${version}` : ''}`;
  const pdfB64 = async () => { const blob = await docPdfBlob(`Báo giá ${file}`, html); const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return { b64: btoa(bin), size: blob.size }; };
  const send = async () => {
    if (ch === 'FILE') return onPdf();
    if (ch === 'EMAIL') {
      if (!to) return notify('Nhập email người nhận', 'orange');
      if (!srv.email) {
        window.location.href = `mailto:${encodeURIComponent(to)}?${cc ? `cc=${encodeURIComponent(cc)}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
        addMsgLog({ channel: 'EMAIL', to, subject, ok: true, detail: 'Mở bằng ứng dụng email của người dùng (mailto), chưa xác nhận đã gửi' });
        return;
      }
      setSending(true);
      const pdf = await pdfB64().catch(() => null);
      if (!pdf) { setSending(false); return notify('Không tạo được file PDF để đính kèm', 'red'); }
      const r = await apiPost<{ id?: string }>('/api/email/send', { tenant: org.id, to, cc, subject, text: body, attachments: [{ filename: `${file}.pdf`, contentType: 'application/pdf', base64: pdf.b64 }] });
      setSending(false);
      addMsgLog({ channel: 'EMAIL', to, subject, ok: r.ok, detail: r.ok ? `Đã gửi kèm ${file}.pdf` : `Lỗi: ${r.error ?? 'không rõ'}` });
      if (!r.ok) return notify(`Gửi email chưa được: ${r.error === 'smtp_not_configured' ? 'máy chủ chưa cấu hình SMTP' : r.error ?? 'lỗi máy chủ'}`, 'red');
      notify(`Đã gửi báo giá ${code} tới ${to}`, 'teal');
      return onClose();
    }
    // Zalo
    if (oaReady && conv) {
      setSending(true);
      const pdf = await pdfB64().catch(() => null);
      const r = await apiPost<{ msgId?: string }>('/api/zalo/send-file', { tenant: org.id, userId: conv.zaloUserId, text: body, ...(pdf ? { filename: `${file}.pdf`, base64: pdf.b64 } : {}) });
      setSending(false);
      setZaloMsgs((all) => [...all, { id: uid('zm'), convId: conv.id, dir: 'OUT', kind: pdf ? 'file' : 'text', text: pdf ? `${body}\n[${file}.pdf]` : body, at: Date.now(), by: me.id, status: r.ok ? 'SENT' : 'FAILED', error: r.ok ? undefined : r.error }]);
      if (!r.ok) return notify(`Gửi qua Zalo OA chưa được: ${r.error ?? 'lỗi máy chủ'}`, 'red');
      notify(`Đã gửi báo giá ${code} qua Zalo OA tới ${conv.displayName}`, 'teal');
      return onClose();
    }
    void navigator.clipboard?.writeText(body).then(() => notify('Đã sao chép thư, dán vào khung chat Zalo rồi gửi kèm file', 'teal'));
    const d = phone.replace(/\D/g, '').replace(/^84/, '0');
    if (d.length >= 9) window.open(`https://zalo.me/${d}`, '_blank', 'noopener');
  };
  const seg = (v: typeof ch, l: string) => <button key={v} type="button" role="tab" aria-selected={ch === v} onClick={() => setCh(v)} className={cn('rounded-md px-3 py-1 text-[13px] transition-colors', ch === v ? 'bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>{l}</button>;
  const note = (t: ReactNode) => <p className="mt-2 flex items-start gap-1.5 text-xs text-[rgb(var(--muted))]"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span>{t}</span></p>;
  const bodyNode = (
    <>
      <ComposerCard title="Gửi báo giá" right={<div className="flex rounded-lg bg-[rgb(var(--raised))] p-0.5" role="tablist" aria-label="Kênh gửi">{seg('EMAIL', 'Email')}{seg('ZALO', 'Zalo')}{seg('FILE', 'Tải về')}</div>}>
        {ch === 'EMAIL' && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Đến"><input className={inputCls} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email người nhận" /></Field>
              <Field label="CC"><input className={inputCls} type="email" value={cc} onChange={(e) => setCc(e.target.value)} /></Field>
              <Field label="Tiêu đề" className="sm:col-span-2"><input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
            </div>
            {srv.email ? note('Gửi từ máy chủ email của doanh nghiệp, tự đính kèm file PDF báo giá.')
              : note(<>Máy chủ email chưa cấu hình nên sẽ mở ứng dụng email trên máy (đính kèm file thủ công). Quản trị viên khai báo SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM trên máy chủ{canDo('settings.edit') && <> · <button type="button" className="font-medium text-[rgb(var(--fg))] hover:underline" onClick={() => { onClose(); go('settings', 'email'); }}>Cài đặt › Email</button></>}</>)}
          </>
        )}
        {ch === 'ZALO' && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Số điện thoại khách"><input className={inputCls} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <div className="self-end pb-2 text-[13px]">{conv ? <span className="flex items-center gap-2"><Avatar name={conv.displayName} size={24} />{conv.displayName}<span className="text-xs text-[rgb(var(--muted))]">đã quan tâm OA</span></span> : <span className="text-xs text-[rgb(var(--muted))]">Chưa tìm thấy hội thoại Zalo OA với số này</span>}</div>
            </div>
            {oaReady ? note('Gửi qua Zalo OA của doanh nghiệp: thư và file PDF báo giá, lưu vào hội thoại Zalo trong CRM.')
              : note(!srv.zalo.oa ? 'Zalo OA chưa kết nối trên máy chủ: sẽ sao chép thư và mở Zalo cá nhân.' : 'Khách chưa nhắn hoặc quan tâm OA nên OA không gửi tin chủ động được: sẽ sao chép thư và mở Zalo cá nhân.')}
          </>
        )}
        {ch === 'FILE' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={cn(btnGhost, btnSm)} onClick={onPdf}><Download className="h-3.5 w-3.5" aria-hidden />{file}.pdf</button>
            <button type="button" className={cn(btnGhost, btnSm)} onClick={onWord}><FileText className="h-3.5 w-3.5" aria-hidden />{file}.doc</button>
          </div>
        )}
      </ComposerCard>
      {ch !== 'FILE' && (
        <ComposerCard title={<span className="flex items-center gap-2">{ai.available && <Sparkles className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />}Nội dung thư</span>} right={ai.available ? <>
          {([['Ngắn hơn', 'Viết ngắn gọn trong 4 câu.'], ['Trang trọng hơn', 'Văn phong trang trọng, phù hợp cơ quan nhà nước.'], ['Soạn lại', '']] as const).map(([l, how]) => (
            <button key={l} type="button" className={cn(btnGhost, btnSm)} disabled={!!busy} onClick={() => void draft(l, how)}>{l === 'Soạn lại' && <RefreshCw className={cn('h-3.5 w-3.5', busy === l && 'motion-safe:animate-spin')} aria-hidden />}{busy === l ? 'CRM 3A đang soạn…' : l}</button>
          ))}
        </> : undefined}>
          <textarea className={cn(inputCls, 'min-h-[220px] text-[13px] leading-6')} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Nội dung thư" />
        </ComposerCard>
      )}
      {ch !== 'FILE' && (
        <ComposerCard title="Đính kèm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] px-2.5 py-1 text-[13px]"><FileText className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden />{file}.pdf</span>
            <span className="text-xs text-[rgb(var(--muted))]">{(ch === 'EMAIL' && srv.email) || (ch === 'ZALO' && oaReady) ? 'tự tạo và đính kèm khi gửi' : <>đính kèm thủ công: <button type="button" className="font-medium text-[rgb(var(--fg))] hover:underline" onClick={onPdf}>tải PDF</button></>}</span>
          </div>
        </ComposerCard>
      )}
    </>
  );
  const label = sending ? 'CRM 3A đang gửi…' : ch === 'EMAIL' ? (srv.email ? 'Gửi báo giá' : 'Mở ứng dụng email') : ch === 'ZALO' ? (oaReady ? 'Gửi qua Zalo OA' : 'Mở Zalo') : 'Tải PDF';
  return { body: bodyNode, send: () => void send(), label, disabled: sending || (ch === 'EMAIL' && !to), hint: undefined as string | undefined };
}

/** Chèn bảng thanh toán theo đợt ngay sau đoạn "Điều N. … thanh toán" của mẫu; mẫu không có thì thêm cuối văn bản */
export function withMilestones(html: string, ms: PayMilestone[] | undefined, grand: number, penalty?: number) {
  const pen = penalty && penalty > 0 ? `<p>Bên mua chậm thanh toán chịu lãi ${String(penalty).replace('.', ',')}%/ngày trên số tiền chậm trả.</p>` : '';
  if (!ms?.length) {
    if (!pen) return html;
    const m0 = /Điều\s+\d+\s*[.:]?\s*(?:<[^>]+>\s*)*[^<]{0,40}[Tt]hanh toán/.exec(html);
    const e0 = m0 ? html.indexOf('</p>', m0.index) : -1;
    return e0 > 0 ? html.slice(0, e0 + 4) + pen + html.slice(e0 + 4) : html + pen;
  }
  const cell = 'border:1px solid #333;padding:3px 6px';
  const rows = ms.map((m, i) => `<tr><td style="${cell}">${i + 1}. ${esc(m.label)}</td><td style="${cell};text-align:right">${m.pct}%</td><td style="${cell};text-align:right">${Math.round((grand * m.pct) / 100).toLocaleString('vi-VN')}</td><td style="${cell}">${esc(m.cond)}</td></tr>`).join('');
  const tb = `<p><b>Lịch thanh toán theo đợt</b></p><table style="width:100%;border-collapse:collapse;margin:4px 0 8px"><tr><th style="${cell}">Đợt</th><th style="${cell}">Tỷ lệ</th><th style="${cell}">Số tiền (đ)</th><th style="${cell}">Điều kiện</th></tr>${rows}</table>${pen}`;
  const m = /Điều\s+\d+\s*[.:]?\s*(?:<[^>]+>\s*)*[^<]{0,40}[Tt]hanh toán/.exec(html);
  if (m) {
    const end = html.indexOf('</p>', m.index);
    if (end > 0) return html.slice(0, end + 4) + tb + html.slice(end + 4);
  }
  return html + tb;
}

/** Thanh toán theo đợt: tùy chọn; tổng tỷ lệ phải đúng 100% */
export function MilestonesField({ form, set, grand, locked }: { form: ComposerForm; set: <K extends keyof ComposerForm>(k: K, v: ComposerForm[K]) => void; grand: number; locked?: boolean }) {
  const ms = form.milestones ?? [];
  const sum = ms.reduce((t, m) => t + (Number(m.pct) || 0), 0);
  const put = (i: number, p: Partial<PayMilestone>) => set('milestones', ms.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const suggest = () => set('milestones', form.advancePct > 0
    ? [{ label: 'Tạm ứng', pct: form.advancePct, cond: 'Trong 5 ngày sau khi ký hợp đồng' }, { label: 'Giao hàng và nghiệm thu', pct: 100 - form.advancePct, cond: `Công nợ ${form.creditDays} ngày kể từ ngày nghiệm thu` }]
    : [{ label: 'Giao hàng và nghiệm thu', pct: 100, cond: `Công nợ ${form.creditDays} ngày kể từ ngày nghiệm thu` }]);
  const cellIn = cn(inputBase, 'w-full border-transparent bg-transparent px-1.5 py-1 text-[13px] hover:border-[rgb(var(--line))] focus:border-[rgb(var(--line))]');
  if (!ms.length) return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-dashed border-[rgb(var(--ink)/0.16)] px-3 py-2.5 text-[13px] text-[rgb(var(--muted))]">
      Chưa chia đợt: thanh toán theo tạm ứng {form.advancePct}% và công nợ {form.creditDays} ngày
      {!locked && <button type="button" className={cn(btnGhost, btnSm, 'ml-auto')} onClick={suggest}>Chia đợt theo tạm ứng</button>}
    </div>
  );
  return (
    <div className="max-sm:overflow-x-auto">
      <table className="w-full min-w-[520px] text-[13px]">
        <thead className="border-b border-[rgb(var(--line))] text-xs text-[rgb(var(--muted))]"><tr><th className="py-1.5 pr-2 text-left font-normal">Đợt</th><th className="w-20 px-1 text-right font-normal">Tỷ lệ</th><th className="w-28 px-2 text-right font-normal">Số tiền (đ)</th><th className="px-2 text-left font-normal">Điều kiện</th><th className="w-7" /></tr></thead>
        <tbody>
          {ms.map((m, i) => (
            <tr key={i} className="border-b border-[rgb(var(--line))]">
              <td className="py-0.5 pr-2"><input className={cellIn} disabled={locked} value={m.label} onChange={(e) => put(i, { label: e.target.value })} aria-label={`Tên đợt ${i + 1}`} /></td>
              <td className="px-1"><span className="flex items-center"><input className={cn(cellIn, 'text-right tabular-nums')} disabled={locked} type="number" min={0} max={100} value={m.pct} onChange={(e) => put(i, { pct: Number(e.target.value) })} aria-label={`Tỷ lệ đợt ${i + 1}`} /><span className="text-[rgb(var(--muted))]">%</span></span></td>
              <td className="px-2 text-right font-mono text-xs tabular-nums">{Math.round((grand * (Number(m.pct) || 0)) / 100).toLocaleString('vi-VN')}</td>
              <td className="px-2"><input className={cn(cellIn, 'text-[rgb(var(--fg2))]')} disabled={locked} value={m.cond} onChange={(e) => put(i, { cond: e.target.value })} aria-label={`Điều kiện đợt ${i + 1}`} /></td>
              <td className="text-center">{!locked && <button type="button" className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => set('milestones', ms.filter((_, j) => j !== i))} aria-label={`Xóa đợt ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
            </tr>
          ))}
          <tr className="text-[rgb(var(--muted))]"><td className="py-2 pl-1.5">Cộng</td><td className={cn('px-1 text-right tabular-nums', Math.round(sum) !== 100 && 'text-[rgb(var(--danger-fg))]')}>{sum}%</td><td className="px-2 text-right font-mono text-xs tabular-nums text-[rgb(var(--fg))]">{Math.round((grand * sum) / 100).toLocaleString('vi-VN')}</td><td className="px-2 text-xs">{Math.round(sum) !== 100 ? 'tổng các đợt phải đúng 100%' : ''}</td><td /></tr>
        </tbody>
      </table>
    </div>
  );
}

/** AI rà soát nội dung hợp đồng: chỉ gợi ý, không tự sửa văn bản */
export function ContractAiReview({ html, special }: { html: string; special: string[] }) {
  const ai = useAi('copilot');
  const { notify } = useApp();
  const [res, setRes] = useState<CheckItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').slice(0, 12000);
    const r = await ai.ask({ maxTokens: 1200, prompt: `Rà soát hợp đồng mua bán dưới đây (luật Việt Nam) từ phía bên bán. Nêu tối đa 6 điểm: điều khoản còn thiếu hoặc mơ hồ (phạt vi phạm, nghiệm thu, bảo hành, giao hàng, thanh toán, tranh chấp), số liệu không khớp nhau, ô còn để trống. Chỉ nêu điều có căn cứ trong văn bản, không khẳng định thay luật sư.
Điều khoản đặc biệt hệ thống đã đánh dấu: ${special.join('; ') || 'không có'}
Trả JSON: {"items":[{"level":"risk|warn|ok","title":"...","detail":"..."}]}
Văn bản:
${text}` });
    setBusy(false);
    if (!r.ok) return notify(r.error, 'orange');
    const d = parseAiJson<{ items?: { level: string; title: string; detail: string }[] }>(r.text);
    setRes((d?.items ?? []).slice(0, 6).map((x) => ({ tone: x.level === 'risk' ? 'red' : x.level === 'ok' ? 'teal' : 'orange', title: x.title, detail: x.detail })));
  };
  return (
    <section className="rounded-xl border border-[rgb(var(--ink)/0.08)] bg-[rgb(var(--surface))] px-4 py-3.5" aria-label="Rà soát hợp đồng">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><p className="text-sm font-medium">Rà soát hợp đồng</p>
        <span className="text-xs text-[rgb(var(--muted))]">{ai.available ? 'CRM 3A đọc bản xem trước và gợi ý, không tự sửa' : 'cần bật phân tích ở Cài đặt › AI & trợ lý'}</span>
        <button type="button" className={cn(btnGhost, btnSm, 'ml-auto')} disabled={!ai.available || busy} onClick={() => void run()}>{busy ? <><RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />CRM 3A đang phân tích…</> : res ? 'Rà soát lại' : 'Rà soát'}</button>
      </div>
      {res && (res.length ? <div className="mt-2"><CheckList items={res} /></div> : <p className="mt-2 text-xs text-[rgb(var(--muted))]">Không có gợi ý nào.</p>)}
    </section>
  );
}

/** Danh sách khác nhau giữa hai bản form hợp đồng (dữ liệu đã lưu của từng phiên bản) */
export function formDiff(x: ComposerForm, y: ComposerForm): CheckItem[] {
  const out: CheckItem[] = [];
  const v = (s: string | number | undefined) => (s === undefined || s === '' ? 'trống' : String(s));
  const P: [keyof ComposerForm['party'], string][] = [['name', 'Tên bên mua'], ['taxCode', 'Mã số thuế'], ['address', 'Địa chỉ'], ['rep', 'Người đại diện'], ['repTitle', 'Chức vụ'], ['phone', 'Điện thoại'], ['email', 'Email']];
  P.forEach(([k, l]) => { if ((x.party[k] ?? '') !== (y.party[k] ?? '')) out.push({ tone: 'orange', title: `${l}: ${v(x.party[k])} → ${v(y.party[k])}`, detail: 'Bên mua' }); });
  const T: [keyof ComposerForm, string, string, boolean][] = [['advancePct', 'Tạm ứng', '%', false], ['creditDays', 'Công nợ', ' ngày', true], ['vatPct', 'VAT', '%', false], ['warrantyMonths', 'Bảo hành', ' tháng', false], ['guaranteePct', 'Bảo lãnh', '%', false], ['delivery', 'Giao hàng', '', false], ['paymentMethod', 'Hình thức thanh toán', '', false], ['note', 'Ghi chú', '', false]];
  T.forEach(([k, l, u, risk]) => { const a = x[k] as string | number; const b = y[k] as string | number; if (a !== b) out.push({ tone: risk && Number(b) > Number(a) ? 'red' : 'orange', title: `${l}: ${v(a)}${a !== '' ? u : ''} → ${v(b)}${b !== '' ? u : ''}`, detail: 'Điều khoản' }); });
  if (x.contractTplId !== y.contractTplId) out.push({ tone: 'orange', title: 'Đổi mẫu hợp đồng', detail: 'nội dung các điều theo mẫu mới' });
  const key = (l: DocLine) => l.sku || l.name;
  const xa = new Map(x.items.map((l) => [key(l), l]));
  const yb = new Map(y.items.map((l) => [key(l), l]));
  y.items.forEach((l) => { const o = xa.get(key(l)); if (!o) out.push({ tone: 'orange', title: `Thêm hàng: ${l.name}`, detail: `${l.qty} ${l.unit} × ${l.price.toLocaleString('vi-VN')}` }); else if (o.qty !== l.qty || o.price !== l.price) out.push({ tone: 'orange', title: `${l.name}: ${o.qty} × ${o.price.toLocaleString('vi-VN')} → ${l.qty} × ${l.price.toLocaleString('vi-VN')}`, detail: 'Hàng hóa' }); });
  x.items.forEach((l) => { if (!yb.has(key(l))) out.push({ tone: 'red', title: `Bỏ hàng: ${l.name}`, detail: `${l.qty} ${l.unit}` }); });
  const ms = (f: ComposerForm) => (f.milestones ?? []).map((m) => `${m.label} ${m.pct}%${m.cond ? ` (${m.cond})` : ''}`).join('; ');
  if (ms(x) !== ms(y)) out.push({ tone: 'orange', title: 'Lịch thanh toán theo đợt thay đổi', detail: `${ms(x) || 'không chia đợt'} → ${ms(y) || 'không chia đợt'}` });
  return out;
}

/** So sánh hai phiên bản của cùng hợp đồng + tóm tắt cho người duyệt bằng AI */
export function ContractVersionDiff({ group, currentId, canApprove, onDecide, onRestore }: { group: string; currentId?: string; canApprove?: boolean; onDecide?: (id: string, ok: boolean, note: string) => void; onRestore?: (id: string) => void }) {
  const { genDocs, users, notify } = useApp();
  const ai = useAi('copilot');
  const vs = contractVersions(genDocs, group);
  const [aId, setA] = useState('');
  const [bId, setB] = useState('');
  const [sum, setSum] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  if (vs.length < 2) return null;
  // Mặc định: bản đang mở so với bản liền trước
  const B = vs.find((d) => d.id === bId) ?? vs.find((d) => d.id === currentId) ?? vs[0];
  const A = vs.find((d) => d.id === aId) ?? vs.find((d) => (d.version ?? 1) < (B.version ?? 1)) ?? vs[vs.length - 1];
  const diff = formDiff(A.form, B.form);
  if (A.total !== B.total) diff.unshift({ tone: B.total < A.total ? 'red' : 'orange', title: `Giá trị: ${A.total.toLocaleString('vi-VN')} → ${B.total.toLocaleString('vi-VN')} đ`, detail: 'Tổng sau VAT' });
  const who = users.find((u) => u.id === B.createdBy)?.name;
  const label = (d: GeneratedDoc) => `v${d.version ?? 1} · ${new Date(d.createdAt).toLocaleDateString('vi-VN')} · ${GENDOC_STATUS[d.status].label}`;
  const summarize = async () => {
    setBusy(true);
    const r = await ai.ask({ maxTokens: 500, prompt: `Tóm tắt cho người duyệt (3-4 câu, tiếng Việt) thay đổi giữa hai phiên bản hợp đồng ${B.contractCode} với ${B.partyName}: nêu thay đổi chính, ảnh hưởng dòng tiền hoặc rủi ro nếu có. Không thêm thông tin ngoài danh sách.\nTừ v${A.version ?? 1} sang v${B.version ?? 1}:\n${diff.map((d) => `- ${d.title} (${d.detail})`).join('\n')}\nĐiều khoản đặc biệt của v${B.version ?? 1}: ${B.special.join('; ') || 'không'}` });
    setBusy(false);
    if (r.ok) setSum(r.text.trim()); else notify(r.error, 'orange');
  };
  return (
    <div className="space-y-3">
      <ComposerCard title="So sánh phiên bản" right={<>
        <select className={cn(inputBase, 'w-auto py-1 text-xs')} value={A.id} onChange={(e) => { setA(e.target.value); setSum(''); }} aria-label="Bản gốc">{vs.map((d) => <option key={d.id} value={d.id}>{label(d)}</option>)}</select>
        <ArrowRight className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden />
        <select className={cn(inputBase, 'w-auto py-1 text-xs')} value={B.id} onChange={(e) => { setB(e.target.value); setSum(''); }} aria-label="Bản so sánh">{vs.map((d) => <option key={d.id} value={d.id}>{label(d)}</option>)}</select>
      </>}>
        <p className="-mt-1 text-xs text-[rgb(var(--muted))]">{diff.length} thay đổi{who ? ` · người tạo v${B.version ?? 1}: ${who}` : ''}{B.special.length ? ` · cần duyệt: ${B.special.join('; ')}` : ''}</p>
      </ComposerCard>
      <ComposerCard title="Thay đổi" right={onRestore && A.id !== B.id ? <button type="button" className={cn(btnGhost, btnSm)} onClick={() => onRestore(A.id)} title={`Tạo phiên bản mới từ nội dung v${A.version ?? 1}`}><History className="h-3.5 w-3.5" aria-hidden />Khôi phục v{A.version ?? 1}</button> : undefined}>
        {diff.length ? <div className="-mt-2"><CheckList items={diff} /></div> : <p className="text-xs text-[rgb(var(--muted))]">Hai phiên bản giống nhau về dữ liệu.</p>}
      </ComposerCard>
      {diff.length > 0 && (
        <ComposerCard title={<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Tóm tắt cho người duyệt</span>} right={<button type="button" className={cn(btnGhost, btnSm)} disabled={!ai.available || busy} title={ai.available ? '' : 'Cần bật phân tích ở Cài đặt › AI & trợ lý'} onClick={() => void summarize()}>{busy ? 'CRM 3A đang phân tích…' : sum ? 'Tóm tắt lại' : 'Tóm tắt'}</button>}>
          {sum ? <p className="whitespace-pre-line text-[13px] leading-6 text-[rgb(var(--fg2))]">{sum}</p> : <p className="text-xs text-[rgb(var(--muted))]">{ai.available ? 'Tóm tắt thay đổi và ảnh hưởng dòng tiền cho người duyệt' : 'Bật phân tích ở Cài đặt › AI & trợ lý để dùng'}</p>}
        </ComposerCard>
      )}
      {B.status === 'PENDING_APPROVAL' && canApprove && onDecide && (
        <ComposerCard title="Duyệt điều khoản đặc biệt">
          <Field label="Ý kiến"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: đồng ý, yêu cầu bảo lãnh thanh toán 10%" /></Field>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={btnGhost} onClick={() => { if (note.trim().length < 3) return notify('Nhập lý do từ chối', 'orange'); onDecide(B.id, false, note.trim()); }}>Từ chối</button>
            <button type="button" className={btnPrimary} onClick={() => onDecide(B.id, true, note.trim())}><CheckCircle2 className="h-4 w-4" aria-hidden />Duyệt v{B.version ?? 1}</button>
          </div>
        </ComposerCard>
      )}
    </div>
  );
}

/** Mở đúng màn: báo giá hoặc hợp đồng */
export function DocComposerModal({ mode = 'QUOTE', leadId, customerId, docId, quoteId, view, edit, reviseOf, onClose }: { mode?: ComposerMode; leadId?: string; customerId?: string; docId?: string; quoteId?: string; view?: boolean; edit?: boolean; reviseOf?: string; onClose: () => void }) {
  return mode === 'CONTRACT' || docId
    ? <ContractComposer leadId={leadId} quoteId={quoteId} docId={docId} view={view} onClose={onClose} />
    : <QuoteComposer leadId={leadId} customerId={customerId} quoteId={quoteId} edit={edit} reviseOf={reviseOf} onClose={onClose} />;
}

// ---------------- Danh sách hợp đồng (bản mới nhất mỗi hợp đồng, xem lịch sử phiên bản) ----------------

export function useContractApprover() {
  const { canDo, role, me, leads, customers } = useApp();
  return (d: GeneratedDoc) => {
    const dp = leads.find((l) => l.id === d.leadId)?.dept ?? customers.find((c) => c.id === d.customerId)?.dept;
    return canDo('contract.approve') && (role === 'BOD' || (role === 'DEPT_HEAD' && dp === me.dept));
  };
}

/** Bản ghi hợp đồng: chỉ xem; duyệt nhanh nếu có quyền. Sửa bằng nút "Mở hợp đồng" ở đầu ngăn dự án */
export function GeneratedDocList({ leadId, customerId }: { leadId?: string; customerId?: string; compact?: boolean }) {
  const { genDocs, openComposer, notify, userName, go } = useApp();
  const canApprove = (d: GeneratedDoc) => !!hubOf('CONTRACT', d.id);
  const [open, setOpen] = useState<string | null>(null);
  const list = latestContracts(genDocs.filter((d) => (!leadId || d.leadId === leadId) && (!customerId || d.customerId === customerId)))
    .sort((a, b) => Number(b.status === 'PENDING_APPROVAL') - Number(a.status === 'PENDING_APPROVAL') || b.createdAt.localeCompare(a.createdAt));
  const hubOf = useHubItem();
  /** v48: duyệt theo quy trình (đúng người duyệt bước hiện tại); từ chối cần lý do nên mở Công việc */
  const decide = (d: GeneratedDoc, ok: boolean) => {
    const it = hubOf('CONTRACT', d.id);
    if (!it) return notify('Bạn không phải người duyệt bước hiện tại của hợp đồng này', 'orange');
    if (ok) it.approve?.(); else { go('tasks'); notify('Nhập lý do từ chối ở Công việc › Chờ tôi duyệt', 'teal'); }
  };
  if (!list.length) return <p className="text-sm text-[rgb(var(--muted))]">Chưa có hợp đồng.</p>;
  return (
    <ul className="divide-y divide-[rgb(var(--line))] rounded-md border border-[rgb(var(--line))]">
      {list.map((d) => {
        const versions = contractVersions(genDocs, docGroupOf(d));
        return (
          <li key={d.id} className="px-3 py-2.5 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1"><b>{d.contractCode}</b> <span className="text-xs text-[rgb(var(--muted))]">v{d.version ?? 1}, căn cứ {d.quoteCode || '—'}, {fmtDate(d.createdAt)}, {userName(d.createdBy)}</span></span>
              <span className="tabular-nums">{compact(d.total)}</span>
              <Chip tone={GENDOC_STATUS[d.status].tone}>{GENDOC_STATUS[d.status].label}</Chip>
            </div>
            {d.status === 'PENDING_APPROVAL' && <p className="mt-1 text-xs text-[rgb(var(--accent-fg))]">{d.special.join('; ')}</p>}
            {d.status === 'REJECTED' && d.rejectNote && <p className="mt-1 text-xs text-[rgb(var(--danger-fg))]">Từ chối: {d.rejectNote}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button className={cn(btnGhost, btnSm)} onClick={() => openComposer({ docId: d.id, view: true })}><Eye className="h-3.5 w-3.5" aria-hidden />Xem</button>
              {d.status === 'PENDING_APPROVAL' && canApprove(d) && (
                <>
                  <button className={cn(btnBase, btnSm, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))]')} onClick={() => decide(d, true)}>Duyệt</button>
                  <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))]')} onClick={() => decide(d, false)}>Từ chối</button>
                </>
              )}
              {versions.length > 1 && <button className="ml-auto text-xs text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? 'Ẩn' : `${versions.length} phiên bản`}</button>}
            </div>
            {open === d.id && (
              <ul className="mt-2 space-y-1 border-l-2 border-[rgb(var(--line))] pl-3">
                {versions.slice(1).map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                    <span className="flex-1">v{v.version ?? 1}, {fmtDate(v.createdAt)}, {compact(v.total)}</span>
                    <Chip tone={GENDOC_STATUS[v.status].tone}>{GENDOC_STATUS[v.status].label}</Chip>
                    <button className="text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => openComposer({ docId: v.id, view: true })}>Xem</button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------- Quản lý mẫu báo giá & hợp đồng ----------------

export function TemplateEditorModal({ tpl, draft, onClose }: { tpl?: DocTemplate; draft?: Partial<DocTemplate>; onClose: () => void }) {
  const ov = useOverlay();
  const { docTemplates, setDocTemplates, company, notify } = useApp();
  const [f, setF] = useState<DocTemplate>(() => tpl ?? {
    id: uid('tpl'), kind: 'QUOTE', name: '', txType: 'DEALER', body: quoteBody('Mẫu mới', 'Điều khoản riêng của mẫu.'), standardCreditDays: 30, defaultTier: 'BASE', defaultDelivery: TX_TYPE.DEALER.delivery, updatedAt: todayISO(), ...draft,
  });
  const [touched, setTouched] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof DocTemplate>(k: K, v: DocTemplate[K]) => setF((p) => ({ ...p, [k]: v }));
  const insert = (token: string) => {
    const el = area.current;
    if (!el) return set('body', f.body + token);
    const s = el.selectionStart, e = el.selectionEnd;
    set('body', f.body.slice(0, s) + token + f.body.slice(e));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + token.length; });
  };
  const sample = buildDocVars({ ...SAMPLE_FORM, txType: f.txType }, { company, quoteCode: 'BG-2026-0001', contractCode: '0001/2026/HĐ', projectName: 'Dự án mẫu', projectCode: 'LD-2026-0001', salesName: 'Nhân viên mẫu', salesPhone: '0900 000 000', salesEmail: 'nhanvien@congty.vn' });
  const unknown = Array.from(new Set(Array.from(f.body.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]).filter((k) => !TEMPLATE_VARS.some(([v]) => v === k))));
  const err = f.name.trim().length < 3 ? 'Nhập tên mẫu' : !f.body.trim() ? 'Nội dung mẫu trống' : '';
  const save = () => {
    setTouched(true);
    if (err) return;
    const clean = { ...f, name: f.name.trim(), updatedAt: todayISO(), pairId: f.kind === 'QUOTE' ? f.pairId : undefined };
    setDocTemplates((all) => (all.some((t) => t.id === clean.id) ? all.map((t) => (t.id === clean.id ? clean : t)) : [...all, clean]));
    notify(`Đã lưu mẫu ${clean.name}`, 'teal');
    onClose();
  };
  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col bg-[rgb(var(--bg))]', !ov.top && 'invisible')} aria-hidden={!ov.top || undefined} role="dialog" aria-modal="true" aria-label="Soạn mẫu tài liệu">
      <header className="flex items-center gap-3 border-b border-[rgb(var(--line))] px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-6">
        <FileText className="h-5 w-5 text-[rgb(var(--accent))]" aria-hidden />
        <p className="flex-1 truncate font-semibold">{tpl ? `Sửa mẫu: ${tpl.name}` : 'Thêm mẫu mới'}</p>
        <button className={btnGhost} onClick={onClose}>Hủy</button>
        <button className={btnPrimary} onClick={save}>Lưu mẫu</button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
        <div className="space-y-3 p-4 sm:p-6 lg:overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tên mẫu *" error={touched && err === 'Nhập tên mẫu' ? err : undefined} className="col-span-2"><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Loại mẫu">
              <select className={inputCls} value={f.kind} onChange={(e) => set('kind', e.target.value as DocTemplate['kind'])} disabled={!!tpl}>
                <option value="QUOTE">Báo giá</option>
                <option value="CONTRACT">Hợp đồng</option>
              </select>
            </Field>
            <Field label="Loại hình giao dịch">
              <select className={inputCls} value={f.txType} onChange={(e) => set('txType', e.target.value as TxType)}>
                {(Object.keys(TX_TYPE) as TxType[]).map((t) => <option key={t} value={t}>{TX_TYPE[t].label}</option>)}
              </select>
            </Field>
            {f.kind === 'QUOTE' ? (
              <Field label="Mẫu hợp đồng đi kèm" className="col-span-2">
                <select className={inputCls} value={f.pairId ?? ''} onChange={(e) => set('pairId', e.target.value || undefined)}>
                  <option value="">Không ghép cặp</option>
                  {docTemplates.filter((t) => t.kind === 'CONTRACT').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Công nợ chuẩn (ngày)" hint="Hợp đồng vượt mức này cần duyệt"><input className={inputCls} type="number" min={0} value={f.standardCreditDays} onChange={(e) => set('standardCreditDays', Number(e.target.value))} /></Field>
            )}
            <Field label="Bảng giá mặc định">
              <select className={inputCls} value={f.defaultTier} onChange={(e) => set('defaultTier', e.target.value as PriceTier)}>
                {(Object.keys(PRICE_TIER) as PriceTier[]).map((t) => <option key={t} value={t}>{PRICE_TIER[t]}</option>)}
              </select>
            </Field>
            <Field label="Tiến độ giao hàng mặc định" className="col-span-2"><input className={inputCls} value={f.defaultDelivery} onChange={(e) => set('defaultDelivery', e.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Chèn biến tại con trỏ">
              <select className={cn(inputBase, 'w-auto')} value="" onChange={(e) => e.target.value && insert(e.target.value)}>
                <option value="">Chọn biến…</option>
                <optgroup label="Biến">{TEMPLATE_VARS.map(([k, d]) => <option key={k} value={`{{${k}}}`}>{`{{${k}}}`}: {d}</option>)}</optgroup>
                <optgroup label="Khối điều kiện">{TEMPLATE_FLAGS.map(([k, d]) => <option key={k} value={`{{#if ${k}}}...{{/if}}`}>{`{{#if ${k}}}`}: {d}</option>)}</optgroup>
              </select>
            </Field>
            <button className={cn(btnGhost, btnSm)} onClick={() => insert('<h3 class="art">Tên điều khoản</h3>\n<p></p>')}>Chèn điều khoản tự đánh số</button>
          </div>
          <Field label="Nội dung mẫu (HTML + biến)" error={touched && err === 'Nội dung mẫu trống' ? err : undefined}>
            <textarea ref={area} className={cn(inputCls, 'min-h-[45vh] font-mono text-xs leading-relaxed')} value={f.body} onChange={(e) => set('body', e.target.value)} spellCheck={false} />
          </Field>
          {unknown.length > 0 && <p className="text-xs text-[rgb(var(--accent-fg))]">Biến không được hỗ trợ (sẽ hiện ô vàng): {unknown.map((k) => `{{${k}}}`).join(', ')}</p>}
          {f.sourceFile && <p className="text-xs text-[rgb(var(--muted))]">File Word gốc: <a className="text-[rgb(var(--secondary-fg))] hover:underline" href={f.sourceFile.url} download={f.sourceFile.name}>{f.sourceFile.name}</a></p>}
        </div>
        <div className="flex min-h-[60vh] flex-col border-[rgb(var(--line))] bg-[rgb(var(--sunken))] lg:min-h-0 lg:border-l">
          <p className="border-b border-[rgb(var(--line))] px-4 py-2 text-xs text-[rgb(var(--muted))]">Xem trước với dữ liệu mẫu</p>
          <iframe title="Xem trước mẫu" className="min-h-[55vh] w-full flex-1 bg-white" srcDoc={docShell('Xem trước mẫu', renderTemplate(f.body, sample.vars, sample.flags))} sandbox="allow-same-origin" />
        </div>
      </div>
    </div>
  );
}

export function TemplateManager() {
  const { docTemplates, setDocTemplates, company, canDo, notify } = useApp();
  const canEdit = canDo('template.manage');
  const [editing, setEditing] = useState<{ tpl?: DocTemplate; draft?: Partial<DocTemplate> } | null>(null);
  const [viewing, setViewing] = useState<DocTemplate | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const list = (kind: DocTemplate['kind']) => docTemplates.filter((x) => x.kind === kind && (!t || x.name.toLowerCase().includes(t) || TX_TYPE[x.txType].label.toLowerCase().includes(t)));
  const nameOf = (id?: string) => docTemplates.find((x) => x.id === id)?.name ?? '—';
  const sample = buildDocVars(SAMPLE_FORM, { company, quoteCode: 'BG-2026-0001', contractCode: '0001/2026/HĐ', projectName: 'Dự án mẫu', projectCode: 'LD-2026-0001', salesName: 'Nhân viên mẫu', salesPhone: '0900 000 000', salesEmail: 'nhanvien@congty.vn' });

  const importWord = async (files: File[]) => {
    const file = files[0];
    if (!/\.docx$/i.test(file.name)) return notify('Chọn file Word định dạng .docx', 'red');
    try {
      const paras = await readDocxParagraphs(file);
      const body = paras.map((p) => (p.trim() === '{{items_table}}' ? '{{items_table}}' : p.trim() ? `<p>${esc(p)}</p>` : '<p>&nbsp;</p>')).join('\n');
      const kind: DocTemplate['kind'] = /hợp đồng|hop dong|contract/i.test(file.name) ? 'CONTRACT' : 'QUOTE';
      setEditing({ draft: { name: file.name.replace(/\.docx$/i, ''), kind, body, sourceFile: { name: file.name, url: URL.createObjectURL(file) } } });
      notify(`Đã đọc ${paras.filter((p) => p.trim()).length} đoạn văn từ ${file.name}. Kiểm tra biến rồi lưu mẫu.`, 'teal');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không đọc được file Word', 'red');
    }
  };
  const duplicate = (x: DocTemplate) => setEditing({ draft: { ...x, id: uid('tpl'), name: `${x.name} (bản sao)`, system: false, sourceFile: undefined } });
  const askDelete = (x: DocTemplate) => setConfirm({
    title: 'Xóa mẫu', message: <>Xóa mẫu <b>{x.name}</b>?</>,
    blocked: x.system ? 'Mẫu hệ thống không xóa được; có thể sửa nội dung hoặc nhân bản.' : undefined,
    onConfirm: () => { setDocTemplates((all) => all.filter((y) => y.id !== x.id).map((y) => (y.pairId === x.id ? { ...y, pairId: undefined } : y))); notify(`Đã xóa mẫu ${x.name}`, 'orange'); },
  });
  const table = (kind: DocTemplate['kind']) => (
    <Table head={['Tên mẫu', 'Loại giao dịch', kind === 'QUOTE' ? 'Hợp đồng đi kèm' : 'Công nợ chuẩn', 'Nguồn', 'Cập nhật', '']} minW={820}>
      {list(kind).map((x) => (
        <tr key={x.id} className={rowCls}>
          <td className={tdFirst}><p className="font-medium text-[rgb(var(--fg))]">{x.name}</p></td>
          <td className={tdCls}>{TX_TYPE[x.txType].label}</td>
          <td className={cn(tdCls, 'text-xs')}>{kind === 'QUOTE' ? nameOf(x.pairId) : `${x.standardCreditDays} ngày`}</td>
          <td className={tdCls}><Chip tone={x.sourceFile ? 'blue' : x.system ? 'muted' : 'orange'}>{x.sourceFile ? 'Từ file Word' : x.system ? 'Hệ thống' : 'Tùy chỉnh'}</Chip></td>
          <td className={cn(tdCls, 'tabular-nums')}>{fmtDate(x.updatedAt)}</td>
          <td className={cn(tdLast, 'whitespace-nowrap text-right')}>
            <button className={cn(btnGhost, 'mr-1 p-1.5')} onClick={() => setViewing(x)} aria-label={`Xem ${x.name}`}><Eye className="h-3.5 w-3.5" /></button>
            <button className={cn(btnGhost, 'mr-1 p-1.5')} disabled={!canEdit} onClick={() => setEditing({ tpl: x })} aria-label={`Sửa ${x.name}`}><Pencil className="h-3.5 w-3.5" /></button>
            <RowMenu items={[
              { label: 'Nhân bản', icon: Copy, onClick: () => duplicate(x), disabled: !canEdit },
              ...(x.sourceFile ? [{ label: 'Tải file Word gốc', icon: Download, onClick: () => { const a = document.createElement('a'); a.href = x.sourceFile!.url; a.download = x.sourceFile!.name; a.click(); } }] : []),
              { label: 'Xóa mẫu', icon: Trash2, danger: true, onClick: () => askDelete(x), disabled: !canEdit },
            ]} />
          </td>
        </tr>
      ))}
    </Table>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden />
          <input className={cn(inputCls, 'border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 pl-9')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mẫu theo tên hoặc loại giao dịch…" aria-label="Tìm mẫu" />
        </div>
        <FilePicker accept=".docx" onFiles={importWord} disabled={!canEdit} className={cn(btnGhost, 'justify-center py-2')}><Upload className="h-4 w-4" aria-hidden />Tải lên file Word (.docx) mẫu</FilePicker>
        <button className={cn(btnPrimary, 'justify-center py-2')} disabled={!canEdit} onClick={() => setEditing({})}><Plus className="h-4 w-4" aria-hidden />Thêm mẫu mới</button>
      </div>

      <Collapse title="Biến mẫu được hỗ trợ" summary={`${TEMPLATE_VARS.length} biến, ${TEMPLATE_FLAGS.length} khối điều kiện`}>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {TEMPLATE_VARS.map(([k, d]) => (
            <button key={k} className="flex items-center justify-between gap-2 rounded bg-[rgb(var(--raised))] px-3 py-2 text-left text-xs hover:bg-[rgb(var(--line))]" onClick={() => navigator.clipboard?.writeText(`{{${k}}}`).then(() => notify(`Đã sao chép {{${k}}}`, 'teal'))}>
              <code className="text-[rgb(var(--accent-fg))]">{`{{${k}}}`}</code><span className="truncate text-[rgb(var(--muted))]">{d}</span>
            </button>
          ))}
        </div>
        <p className="mb-1.5 mt-4 text-xs font-medium text-[rgb(var(--muted))]">Khối điều kiện (hiện nội dung khi điều kiện đúng, không lồng nhau)</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {TEMPLATE_FLAGS.map(([k, d]) => (
            <button key={k} className="flex items-center justify-between gap-2 rounded bg-[rgb(var(--raised))] px-3 py-2 text-left text-xs hover:bg-[rgb(var(--line))]" onClick={() => navigator.clipboard?.writeText(`{{#if ${k}}}...{{/if}}`).then(() => notify('Đã sao chép khối điều kiện', 'teal'))}>
              <code className="text-[rgb(var(--secondary-fg))]">{`{{#if ${k}}}`}</code><span className="truncate text-[rgb(var(--muted))]">{d}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">Tiêu đề viết dạng {'<h3 class="art">Tên điều</h3>'} được tự đánh số "Điều 1, Điều 2…" theo các khối đang hiện.</p>
      </Collapse>

      <Panel title={`Mẫu báo giá (${list('QUOTE').length})`}>{table('QUOTE')}</Panel>
      <Panel title={`Mẫu hợp đồng (${list('CONTRACT').length})`}>{table('CONTRACT')}</Panel>

      {editing && <TemplateEditorModal tpl={editing.tpl} draft={editing.draft} onClose={() => setEditing(null)} />}
      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)} wide footer={<button className={btnPrimary} onClick={() => setViewing(null)}>Đóng</button>}>
          <iframe title="Xem trước mẫu" className="h-[65vh] w-full rounded border border-[rgb(var(--line))] bg-white" srcDoc={docShell(viewing.name, renderTemplate(viewing.body, sample.vars, sample.flags))} sandbox="allow-same-origin" />
        </Modal>
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/** Báo giá & Hợp đồng: hai bảng tách riêng, mỗi dòng là một bộ (phiên bản mới nhất), mở rộng để xem các phiên bản */
export function SalesDocsPanel() {
  const { quotes, setQuotes, genDocs, leads, customers, openComposer, canDo, notify, go } = useApp();
  const canApprove = useContractApprover();
  const inR = useInRange();
  const [view, setView] = useState<'QUOTE' | 'CONTRACT'>('QUOTE');
  const [q, setQ] = useState('');
  const [st, setSt] = useState('ALL');
  const [open, setOpen] = useState<string | null>(null);
  const [mailFor, setMailFor] = useState<Quote | null>(null);
  const t = q.trim().toLowerCase();
  const nameOfQuote = (x: Quote) => x.quoteForm?.party.name ?? customers.find((c) => c.id === x.customerId)?.name ?? leads.find((l) => l.id === x.leadId)?.company ?? '—';

  // ---- Báo giá: gom theo dự án (hoặc khách hàng nếu không gắn dự án) ----
  const groups = new Map<string, Quote[]>();
  for (const x of quotes) { const k = x.leadId || (x.customerId ? `c:${x.customerId}` : `r:${x.rootId ?? x.id}`); groups.set(k, [...(groups.get(k) ?? []), x]); }
  const quoteRows = Array.from(groups.entries()).map(([key, xs]) => {
    const versions = [...xs].sort((a, b) => b.version - a.version);
    return { key, latest: versions[0], versions, lead: leads.find((l) => l.id === versions[0].leadId) };
  });
  const qFiltered = quoteRows.filter((r) => inR(r.latest.date) && (st === 'ALL' || (st === 'DRAFT' ? !!r.latest.draft : r.latest.status === st)) && (!t || [r.latest.code, nameOfQuote(r.latest), r.lead?.code ?? ''].some((v) => v.toLowerCase().includes(t))))
    .sort((a, b) => b.latest.date.localeCompare(a.latest.date));

  // ---- Hợp đồng: phiên bản mới nhất mỗi hợp đồng ----
  const contracts = latestContracts(genDocs);
  const cFiltered = contracts.filter((d) => inR(d.createdAt) && (st === 'ALL' || d.status === st) && (!t || [d.contractCode, d.partyName, d.quoteCode].some((v) => v.toLowerCase().includes(t))))
    .sort((a, b) => Number(b.status === 'PENDING_APPROVAL') - Number(a.status === 'PENDING_APPROVAL') || b.createdAt.localeCompare(a.createdAt));

  const qPaged = usePaged(qFiltered, 12);
  const cPaged = usePaged(cFiltered, 12);
  const hubOf = useHubItem();
  /** v48: duyệt theo quy trình (đúng người duyệt bước hiện tại); từ chối cần lý do nên mở Công việc */
  const decide = (d: GeneratedDoc, ok: boolean) => {
    const it = hubOf('CONTRACT', d.id);
    if (!it) return notify('Bạn không phải người duyệt bước hiện tại của hợp đồng này', 'orange');
    if (ok) it.approve?.(); else { go('tasks'); notify('Nhập lý do từ chối ở Công việc › Chờ tôi duyệt', 'teal'); }
  };
  const statusOpts = view === 'QUOTE'
    ? [{ value: 'DRAFT', label: `Nháp, khách lẻ (${quoteRows.filter((r) => r.latest.draft).length})` }, ...(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((s) => ({ value: s, label: QUOTE_STATUS[s].label }))]
    : (['PENDING_APPROVAL', 'ISSUED', 'APPROVED', 'REJECTED'] as GenDocStatus[]).map((s) => ({ value: s, label: GENDOC_STATUS[s].label }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-[rgb(var(--raised))] p-0.5" role="radiogroup" aria-label="Loại văn bản">
          {([['QUOTE', `Báo giá (${quoteRows.length})`], ['CONTRACT', `Hợp đồng (${contracts.length})`]] as const).map(([k, label]) => (
            <button key={k} role="radio" aria-checked={view === k} onClick={() => { setView(k); setSt('ALL'); setOpen(null); }} className={cn('rounded-md px-3.5 py-1.5 text-sm', view === k ? 'bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>{label}</button>
          ))}
        </div>
        {view === 'QUOTE' && <button className={cn(btnPrimary, 'ml-auto')} disabled={!(canDo('project.update') || canDo('customer.edit'))} onClick={() => openComposer({ mode: 'QUOTE' })}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo báo giá</button>}
        {view === 'CONTRACT' && <button className={cn(btnPrimary, 'ml-auto')} disabled={!(canDo('project.update') || canDo('customer.edit'))} onClick={() => openComposer({ mode: 'CONTRACT' })}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo hợp đồng</button>}
      </div>

      {view === 'QUOTE' ? (
        <div className="kpi-row grid grid-cols-2 gap-y-3 lg:grid-cols-4">
          <StatCard label="Bộ báo giá" value={fmtN(quoteRows.length)} sub={`${quotes.length} phiên bản`} />
          <StatCard label="Đã gửi, chờ phản hồi" value={fmtN(quoteRows.filter((r) => r.latest.status === 'SENT').length)} sub={compact(quoteRows.filter((r) => r.latest.status === 'SENT').reduce((s, r) => s + r.latest.amount, 0)) + ' trước VAT'} />
          <StatCard label="Khách chấp nhận" value={fmtN(quoteRows.filter((r) => r.latest.status === 'ACCEPTED').length)} sub={compact(quoteRows.filter((r) => r.latest.status === 'ACCEPTED').reduce((s, r) => s + r.latest.amount, 0)) + ' trước VAT'} />
          <StatCard label="Hết hiệu lực trong 7 ngày" value={fmtN(quoteRows.filter((r) => r.latest.status === 'SENT' && r.latest.validUntil && r.latest.validUntil >= todayISO() && r.latest.validUntil <= iso(new Date(Date.now() + 7 * 864e5))).length)} sub="báo giá đang chờ khách" />
        </div>
      ) : (
        <div className="kpi-row grid grid-cols-2 gap-y-3 lg:grid-cols-4">
          <StatCard label="Hợp đồng hiệu lực" value={fmtN(contracts.filter((d) => d.status === 'ISSUED' || d.status === 'APPROVED').length)} sub={`${contracts.length} hợp đồng`} />
          <StatCard label="Giá trị hiệu lực" value={compact(contracts.filter((d) => d.status === 'ISSUED' || d.status === 'APPROVED').reduce((s, d) => s + d.total, 0))} sub="gồm VAT" />
          <StatCard label="Chờ duyệt" value={fmtN(contracts.filter((d) => d.status === 'PENDING_APPROVAL').length)} sub={compact(contracts.filter((d) => d.status === 'PENDING_APPROVAL').reduce((s, d) => s + d.total, 0))} color={contracts.some((d) => d.status === 'PENDING_APPROVAL') ? C.orange : C.text} />
          <StatCard label="Bị từ chối, cần sửa" value={fmtN(contracts.filter((d) => d.status === 'REJECTED').length)} sub="mở để sửa và gửi duyệt lại" color={contracts.some((d) => d.status === 'REJECTED') ? C.red : C.text} />
        </div>
      )}

      <FilterBar q={q} onQ={setQ} placeholder={view === 'QUOTE' ? 'Tìm mã báo giá, khách hàng, mã dự án' : 'Tìm số hợp đồng, bên mua, báo giá căn cứ'} status={st} onStatus={setSt} statusOptions={statusOpts} />

      <Panel title={view === 'QUOTE' ? `${qFiltered.length} bộ báo giá` : `${cFiltered.length} hợp đồng`}>
        {view === 'QUOTE' ? (
          <>
            <Table stt={Math.max(0, qPaged.from - 1)} head={['Mã', 'Khách hàng', 'Dự án', 'Ngày', 'Hiệu lực đến', <span key="a" className="block text-right">Trước VAT</span>, <span key="b" className="block text-right">Sau VAT</span>, 'Trạng thái', <span key="c" className="block text-right">Thao tác</span>]} minW={1040}>
              {qPaged.slice.map((r) => (
                <Fragment key={r.key}>
                  <tr className={rowCls}>
                    <td className={tdFirst}><Code>{r.latest.code}</Code>{r.latest.draft && <span className="ml-1.5 rounded bg-[rgb(var(--raised))] px-1.5 py-0.5 text-[11px] text-[rgb(var(--fg2))]">Nháp</span>}{r.versions.length > 1 && <button className="ml-1.5 font-mono text-xs text-[rgb(var(--muted))] hover:underline" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key} title="Phiên bản cũ">v{r.latest.version}</button>}</td>
                    <td className={tdCls}><button className="block max-w-[260px] truncate text-left font-medium hover:underline" title={nameOfQuote(r.latest)} onClick={() => openComposer({ quoteId: r.latest.id, mode: 'QUOTE' })}>{nameOfQuote(r.latest)}</button></td>
                    <td className={tdCls}>{r.lead ? <Code>{r.lead.code}</Code> : <span className="text-[rgb(var(--faint))]">—</span>}</td>
                    <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(r.latest.date)}</td>
                    <td className={cn(tdCls, 'font-mono text-xs', r.latest.validUntil && r.latest.validUntil < todayISO() && r.latest.status === 'SENT' ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--fg2))]')}>{r.latest.validUntil ? fmtDate(r.latest.validUntil) : '—'}</td>
                    <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(r.latest.amount)}</td>
                    <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{compact(Math.round(r.latest.amount * (1 + (r.latest.vatPct ?? 0) / 100)))}</td>
                    <td className={tdCls}><Chip tone={QUOTE_STATUS[r.latest.status].tone}>{QUOTE_STATUS[r.latest.status].label}</Chip></td>
                    <td className={cn(tdLast, 'text-right')}><div className="flex items-center justify-end gap-1">
                      <button className={cn(btnGhost, 'h-8 w-8 border-0 p-0')} onClick={() => setMailFor(r.latest)} title="Soạn email gửi báo giá" aria-label={`Soạn email ${r.latest.code}`}><Mail className="h-4 w-4" aria-hidden /></button>
                      <button className={cn(btnGhost, 'h-8 w-8 border-0 p-0')} onClick={() => openComposer({ quoteId: r.latest.id, mode: 'QUOTE' })} title="Xem" aria-label={`Xem ${r.latest.code}`}><Eye className="h-4 w-4" aria-hidden /></button>
                      <RowMenu label={`Thao tác ${r.latest.code}`} items={[
                        ...(r.latest.draft && r.latest.status !== 'ACCEPTED' ? [
                          { label: 'Sửa báo giá nháp', icon: Pencil, disabled: !(canDo('project.update') || canDo('customer.edit')), onClick: () => openComposer({ quoteId: r.latest.id, edit: true, mode: 'QUOTE' }) },
                          { label: 'Xóa báo giá nháp', icon: Trash2, disabled: !(canDo('project.update') || canDo('customer.edit')), onClick: () => { const root = r.latest.rootId ?? r.latest.id; const prev = quotes.filter((x) => (x.rootId ?? x.id) === root); setQuotes((p) => p.filter((x) => (x.rootId ?? x.id) !== root)); notify(`Đã xóa báo giá nháp ${r.latest.code}`, 'orange', { label: 'Hoàn tác', run: () => setQuotes((p) => [...prev, ...p]) }); } },
                        ] : []),
                        ...(r.latest.status !== 'ACCEPTED' ? [{ label: 'Báo giá điều chỉnh', icon: Copy, disabled: !(canDo('project.update') || canDo('customer.edit')), onClick: () => openComposer(r.lead ? { leadId: r.lead.id, mode: 'QUOTE' } : { reviseOf: r.latest.id, mode: 'QUOTE' }) }] : []),
                        { label: 'Tạo hợp đồng từ báo giá', icon: FileText, disabled: !(canDo('project.update') || canDo('customer.edit')), onClick: () => openComposer({ quoteId: r.latest.id, mode: 'CONTRACT' }) },
                        { label: r.versions.length > 1 ? (open === r.key ? 'Ẩn phiên bản cũ' : `Xem ${r.versions.length - 1} phiên bản cũ`) : 'Chỉ có 1 phiên bản', icon: History, disabled: r.versions.length < 2, onClick: () => setOpen(open === r.key ? null : r.key) },
                      ]} />
                    </div></td>
                  </tr>
                  {open === r.key && r.versions.slice(1).map((v) => (
                    <tr key={v.id} data-sub className="bg-[rgb(var(--sunken))] text-[13px] text-[rgb(var(--muted))]">
                      <td className={tdFirst}><Code>{v.code}</Code></td>
                      <td className={cn(tdCls, 'font-mono text-xs')}>v{v.version}</td>
                      <td className={tdCls} />
                      <td className={cn(tdCls, 'font-mono text-xs')}>{fmtDate(v.date)}</td>
                      <td className={cn(tdCls, 'font-mono text-xs')}>{v.validUntil ? fmtDate(v.validUntil) : '—'}</td>
                      <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(v.amount)}</td>
                      <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(Math.round(v.amount * (1 + (v.vatPct ?? 0) / 100)))}</td>
                      <td className={tdCls}><Chip tone={QUOTE_STATUS[v.status].tone}>{QUOTE_STATUS[v.status].label}</Chip></td>
                      <td className={cn(tdLast, 'text-right')}><button className="text-[rgb(var(--fg2))] hover:underline" onClick={() => openComposer({ quoteId: v.id, mode: 'QUOTE' })}>Xem</button></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </Table>
            {!qFiltered.length && <EmptyState text={<>Không có báo giá trong khoảng thời gian và bộ lọc này.</>} art="doc" />}
            <Pagination paged={qPaged} unit="bộ báo giá" />
          </>
        ) : (
          <>
            <Table stt={Math.max(0, cPaged.from - 1)} head={['Số hợp đồng', 'Bên mua', 'MST', 'Báo giá', 'Ngày lập', <span key="v" className="block text-right">Giá trị</span>, <span key="t" className="block text-right">Tạm ứng</span>, 'Công nợ', 'Trạng thái', <span key="a" className="block text-right">Thao tác</span>]} minW={1000}>
              {cPaged.slice.map((d) => {
                const versions = contractVersions(genDocs, docGroupOf(d));
                const f = d.form;
                return (
                  <Fragment key={d.id}>
                    <tr className={rowCls}>
                      <td className={cn(tdFirst, d.status === 'REJECTED' && 'shadow-[inset_3px_0_0_rgb(var(--danger))]')}><button className="hover:underline" onClick={() => openComposer({ docId: d.id, view: true })} title={`Phiên bản ${d.version ?? 1}`}><Code>{d.contractCode}</Code></button>{versions.length > 1 && <button className="ml-1.5 font-mono text-xs text-[rgb(var(--muted))] hover:underline" onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id} title="Phiên bản cũ">v{d.version ?? 1}</button>}</td>
                      <td className={tdCls}><span className="block max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap font-medium" title={d.partyName}>{d.partyName}</span></td>
                      <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{f?.party?.taxCode || '—'}</td>
                      <td className={tdCls}>{d.quoteCode ? <Code>{d.quoteCode}</Code> : <span className="text-[rgb(var(--faint))]">—</span>}</td>
                      <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(d.createdAt)}</td>
                      <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(d.total)}</td>
                      <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{f?.advancePct ? `${f.advancePct}%` : '—'}</td>
                      <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{f?.creditDays ? `${f.creditDays} ngày` : 'Thanh toán ngay'}</td>
                      <td className={tdCls} title={[d.status === 'REJECTED' ? `Lý do: ${d.rejectNote || 'không ghi'}` : d.special.length ? `Điều khoản đặc biệt: ${d.special.join('; ')}` : '', f?.warrantyMonths ? `Bảo hành ${f.warrantyMonths} tháng` : ''].filter(Boolean).join('\n') || undefined}><Chip tone={GENDOC_STATUS[d.status].tone}>{GENDOC_STATUS[d.status].label}</Chip></td>
                      <td className={cn(tdLast, 'whitespace-nowrap text-right')}><div className="flex items-center justify-end gap-1">
                        {d.status === 'PENDING_APPROVAL' && canApprove(d) && <button className={cn(btnGhost, btnSm)} onClick={() => decide(d, true)}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Duyệt</button>}
                        <RowMenu label={`Thao tác ${d.contractCode}`} items={[
                          { label: 'Xem, in, xuất Word / PDF', icon: Eye, onClick: () => openComposer({ docId: d.id, view: true }) },
                          { label: versions.length > 1 ? (open === d.id ? 'Ẩn phiên bản cũ' : `Xem ${versions.length - 1} phiên bản cũ`) : 'Chỉ có 1 phiên bản', icon: History, disabled: versions.length < 2, onClick: () => setOpen(open === d.id ? null : d.id) },
                          ...(d.status === 'PENDING_APPROVAL' && canApprove(d) ? [{ label: 'Từ chối', icon: XCircle, danger: true, onClick: () => decide(d, false) }] : []),
                        ]} />
                      </div></td>
                    </tr>
                    {open === d.id && versions.slice(1).map((v) => (
                      <tr key={v.id} data-sub className="bg-[rgb(var(--sunken))] text-[13px] text-[rgb(var(--muted))]">
                        <td className={tdFirst}><Code>{v.contractCode}</Code></td>
                        <td className={cn(tdCls, 'font-mono text-xs')}>v{v.version ?? 1}</td>
                        <td className={tdCls} />
                        <td className={tdCls}>{v.quoteCode ? <Code>{v.quoteCode}</Code> : '—'}</td>
                        <td className={cn(tdCls, 'font-mono text-xs')}>{fmtDate(v.createdAt)}</td>
                        <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(v.total)}</td>
                        <td className={tdCls} />
                        <td className={tdCls} />
                        <td className={tdCls}><Chip tone={GENDOC_STATUS[v.status].tone}>{GENDOC_STATUS[v.status].label}</Chip></td>
                        <td className={cn(tdLast, 'text-right')}><button className="text-[rgb(var(--fg2))] hover:underline" onClick={() => openComposer({ docId: v.id, view: true })}>Xem</button></td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </Table>
            {!cFiltered.length && <EmptyState text={<>Không có hợp đồng trong khoảng thời gian và bộ lọc này.</>} art="doc" />}
            <Pagination paged={cPaged} unit="hợp đồng" />
          </>
        )}
      </Panel>
      {mailFor && <AiWriterSheet preset="QUOTE_EMAIL" onClose={() => setMailFor(null)} context={[`Khách hàng: ${nameOfQuote(mailFor)}`, `Báo giá ${mailFor.code} phiên bản ${mailFor.version}, ngày ${fmtDate(mailFor.date)}, hiệu lực đến ${fmtDate(mailFor.validUntil)}`, `Giá trị trước VAT ${fmtN(mailFor.amount)}đ, VAT ${mailFor.vatPct}%`, `Hạng mục chính: ${mailFor.lines.slice(0, 6).map((l) => `${l.name} x${l.qty} ${l.unit}`).join('; ')}`].join('\n')} />}
    </div>
  );
}

/** Tab Tài liệu: thư viện, mẫu báo giá & hợp đồng, văn bản đã xuất */
export function DocsModule() {
  const { genDocs } = useApp();
  const [tab, setTab] = useSticky<'library' | 'templates' | 'generated'>('DocsModule.tab', 'library');
  const pending = genDocs.filter((d) => d.status === 'PENDING_APPROVAL').length;
  return (
    <div className="space-y-4">
      <Tabs tabs={[{ id: 'library', label: 'Kho tài liệu' }, { id: 'templates', label: 'Mẫu văn bản' }, { id: 'generated', label: pending ? `Báo giá & Hợp đồng (${pending})` : 'Báo giá & Hợp đồng' }]} value={tab} onChange={setTab} />
      {tab === 'library' && <DocsPage />}
      {tab === 'templates' && <TemplateManager />}
      {tab === 'generated' && <SalesDocsPanel />}
    </div>
  );
}

