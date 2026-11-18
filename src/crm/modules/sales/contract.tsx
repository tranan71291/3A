'use client';

import { Fragment, useRef, useState } from 'react';
import { AlertTriangle, Copy, Download, Eye, FileText, Pencil, Plus, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { Pagination, RowMenu, usePaged } from '../../components/controls';
import { Collapse, ConfirmDialog } from '../../components/crud';
import { FilterBar, useInRange } from '../../components/filters';
import { Chip, EmptyState, Field, FilePicker, Modal, Panel, Table, Tabs, useOverlay, useSticky } from '../../components/ui';
import { latestContracts } from '../../lib/business';
import { btnBase, btnGhost, btnPrimary, btnSm, compact, contractVersions, docGroupOf, esc, findByTax, fmtDate, fmtN, GENDOC_STATUS, guessTx, inputBase, inputCls, latestQuote, partyOf, PRICE_TIER, QUOTE_STATUS, quoteLineToDoc, rowCls, SAMPLE_FORM, secHead, tdCls, tdFirst, tdLast, TEMPLATE_FLAGS, TEMPLATE_VARS, todayISO, TX_TYPE, uid, useApp } from '../../lib/core';
import type { ComposerForm, ComposerMode, ConfirmState, DocTemplate, GenDocStatus, GeneratedDoc, PriceTier, Quote, QuoteStatus, TxType } from '../../lib/types';
import { cn } from '../../lib/utils';
import { AiWriterSheet } from '../ai/copilot-plus';
import { DocsPage } from '../docs/docs';
import { QuoteComposer } from './quote';
import { buildDocVars, ComposerShell, DocActionBar, docShell, docTotals, downloadWord, Fold, moneyToWordsVN, PartyFields, printHtml, quoteBody, readDocxParagraphs, renderTemplate, specialTermsOf, TermsFields } from './templates';

// =====================================================================
//  MÀN HỢP ĐỒNG — có phiên bản. Bản đã lưu chỉ xem; sửa = tạo phiên bản mới.
//  Có điều khoản đặc biệt: nút chính là "Gửi phê duyệt" (bản ghi ở trạng thái Chờ duyệt).
// =====================================================================

export function ContractComposer({ leadId, quoteId, docId, view, onClose }: { leadId?: string; quoteId?: string; docId?: string; view?: boolean; onClose: () => void }) {
  const { leads, customers, skus, company, users, me, role, docTemplates, genDocs, setGenDocs, quotes, notify, dispatch, canDo, openComposer, logDecision, winLead } = useApp();
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
      warrantyMonths: qf?.warrantyMonths ?? 12, creditDays: qf?.creditDays ?? ct?.standardCreditDays ?? TX_TYPE[tx].credit, paymentMethod: qf?.paymentMethod ?? 'Chuyển khoản', validDays: 30, note: '',
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
  const html = cTpl ? renderTemplate(cTpl.body, vars, flags) : '<p>Chưa chọn mẫu hợp đồng</p>';
  const docDept = baseLead?.dept ?? customer?.dept;
  const canApprove = canDo('contract.approve') && (role === 'BOD' || (role === 'DEPT_HEAD' && docDept === me.dept));
  const canEdit = canDo('project.update') || canDo('customer.edit');
  const canExport = !!shown && (shown.status === 'ISSUED' || shown.status === 'APPROVED');
  const canWinC = canExport && !!baseLead && !!baseId && baseLead.status === 'QUOTED' && canDo('project.update');
  const errs: string[] = [];
  if (!base) errs.push('Chọn báo giá làm căn cứ hợp đồng');
  if (form.party.name.trim().length < 3) errs.push('Nhập tên pháp nhân bên mua');
  if (!cTpl) errs.push('Chọn mẫu hợp đồng');

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
      dispatch('CONTRACT_APPROVAL', { lead: baseLead, title: `Hợp đồng chờ duyệt: ${form.party.name}`, body: `${code} v${rec.version}, ${compact(totals.grand)}. ${special.join('; ')}`, module: 'tasks' });
      notify(`Đã gửi phê duyệt hợp đồng ${code} v${rec.version}`, 'teal');
    } else notify(`Đã tạo hợp đồng ${code} v${rec.version}, có hiệu lực`, 'teal');
  };
  const decide = (ok: boolean) => {
    if (!shown) return;
    setGenDocs((all) => all.map((d) => (d.id === shown.id ? { ...d, ...(ok ? { status: 'APPROVED' as GenDocStatus, approvedBy: me.id, approvedAt: todayISO() } : { status: 'REJECTED' as GenDocStatus, rejectNote: 'Từ chối tại màn hợp đồng' }) } : d)));
    logDecision({ kind: 'CONTRACT', refId: shown.id, title: `${shown.contractCode} v${shown.version ?? 1}: ${shown.partyName}`, requesterId: shown.createdBy, decision: ok ? 'APPROVED' : 'REJECTED', amount: shown.total });
    notify(ok ? 'Đã duyệt hợp đồng' : 'Đã từ chối hợp đồng', ok ? 'teal' : 'orange');
  };
  const exportContract = (format: 'PDF' | 'WORD') => {
    if (!shown || !canExport) return;
    const file = `${code.replace(/\//g, '-')}${(shown.version ?? 1) > 1 ? `-v${shown.version}` : ''}`;
    const title = `Hợp đồng ${file}`;
    if (format === 'PDF') printHtml(docShell(title, html)); else downloadWord(file, title, html);
    setGenDocs((all) => all.map((d) => (d.id === shown.id ? { ...d, exports: [...d.exports, { kind: 'CONTRACT', format, at: todayISO(), by: me.id }] } : d)));
  };

  const left = (
    <>
      {special.length > 0 && !locked && (
        <div className="rounded-md border-2 border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.15)] p-4">
          <p className="flex items-center gap-2 font-semibold text-[rgb(var(--accent-fg))]"><AlertTriangle className="h-5 w-5" aria-hidden />Hợp đồng cần phê duyệt</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6 text-sm text-[rgb(var(--accent-fg))]">{special.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">Bấm "Gửi phê duyệt" ở cuối màn hình. Hoặc chỉnh điều khoản về mức chuẩn để tạo hợp đồng ngay.</p>
        </div>
      )}
      {locked && shown && (
        <div className={cn('rounded-md border p-3 text-sm', shown.status === 'PENDING_APPROVAL' ? 'border-[rgb(var(--accent)/0.6)] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent-fg))]' : shown.status === 'REJECTED' ? 'border-[rgb(var(--danger)/0.5)] bg-[rgb(var(--danger)/0.1)] text-[rgb(var(--danger-fg))]' : shown.status === 'SUPERSEDED' ? 'border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-[rgb(var(--muted))]' : 'border-[rgb(var(--success)/0.5)] bg-[rgb(var(--success)/0.1)] text-[rgb(var(--success-fg))]')}>
          <p className="font-semibold">Phiên bản v{shown.version ?? 1}: {GENDOC_STATUS[shown.status].label}</p>
          <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{shown.status === 'PENDING_APPROVAL' ? `Chờ duyệt: ${shown.special.join('; ')}` : shown.status === 'REJECTED' ? `Lý do: ${shown.rejectNote ?? '—'}. Bấm "Sửa, tạo phiên bản mới" để điều chỉnh.` : shown.status === 'SUPERSEDED' ? 'Đã có phiên bản mới hơn, bản này chỉ để tra cứu.' : 'Xuất PDF / Word ở cuối màn hình.'}</p>
        </div>
      )}
      <fieldset disabled={locked} className="min-w-0 space-y-4">
        <section>
          {secHead(1, 'Căn cứ & mẫu hợp đồng')}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {options.length ? (
              <Field label="Báo giá căn cứ">
                <select className={inputCls} value={baseId ?? ''} onChange={(e) => pickBase(e.target.value)}>
                  <option value="" disabled>Chọn báo giá...</option>
                  {options.map((q) => <option key={q.id} value={q.id}>{q.code} v{q.version}, {compact(q.amount)}{q.status === 'ACCEPTED' ? ' (khách đã chốt)' : ''}</option>)}
                </select>
              </Field>
            ) : <p className="rounded bg-[rgb(var(--accent)/0.1)] p-3 text-sm text-[rgb(var(--accent-fg))]">Chưa có báo giá có dòng hàng hóa để làm căn cứ.</p>}
            <Field label="Mẫu hợp đồng">
              <select className={inputCls} value={form.contractTplId} onChange={(e) => set('contractTplId', e.target.value)}>
                {docTemplates.filter((t) => t.kind === 'CONTRACT').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>
          {base && (
            <div className="mt-2 overflow-hidden rounded-md border border-[rgb(var(--line))]">
              <table className="w-full table-fixed text-xs">
                <colgroup><col /><col className="w-14" /><col className="w-[100px]" /></colgroup>
                <thead className="bg-[rgb(var(--raised))] text-[11px] text-[rgb(var(--muted))]"><tr><th className="px-2 py-1.5 text-left font-medium">Hàng hóa (kế thừa báo giá)</th><th className="px-2 text-right font-medium">SL</th><th className="px-2 text-right font-medium">Thành tiền</th></tr></thead>
                <tbody>
                  {form.items.map((l) => <tr key={l.sku} className="border-t border-[rgb(var(--line))]"><td className="truncate px-2 py-1.5" title={l.name}>{l.name}</td><td className="px-2 text-right tabular-nums">{l.qty.toLocaleString('vi-VN')}</td><td className="px-2 text-right tabular-nums">{(l.qty * l.price).toLocaleString('vi-VN')}</td></tr>)}
                </tbody>
                <tfoot><tr className="border-t border-[rgb(var(--line))] bg-[rgb(var(--raised)/0.6)] font-semibold"><td className="px-2 py-1.5" colSpan={2}>Tổng sau VAT {form.vatPct}%</td><td className="px-2 text-right tabular-nums text-[rgb(var(--accent-fg))]">{totals.grand.toLocaleString('vi-VN')}</td></tr></tfoot>
              </table>
              <p className="border-t border-[rgb(var(--line))] px-2 py-1.5 text-[11px] italic text-[rgb(var(--muted))]">{moneyToWordsVN(totals.grand)}</p>
            </div>
          )}
        </section>
        <section>
          {secHead(2, 'Bên mua')}
          <Fold title="Pháp nhân, đại diện ký" summary={[form.party.name, form.party.taxCode && `MST ${form.party.taxCode}`, form.party.rep].filter(Boolean).join(' · ') || 'Chưa có'} open={!form.party.name}>
            <PartyFields form={form} setParty={setParty} />
          </Fold>
        </section>
        <section>
          {secHead(3, 'Điều khoản thanh toán')}
          <TermsFields form={form} set={set} cTpl={cTpl} contract part="pay" />
          <div className="mt-2">
            <Fold title="Giao hàng, bảo hành, ghi chú" summary={`${form.delivery || 'Chưa nhập giao hàng'} · BH ${form.warrantyMonths} th`}>
              <TermsFields form={form} set={set} cTpl={cTpl} contract part="other" />
            </Fold>
          </div>
        </section>
      </fieldset>
      {!locked && errs.length > 0 && <ul className="space-y-0.5 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
    </>
  );

  return (
    <ComposerShell
      title={`${locked ? 'Hợp đồng' : src ? 'Sửa hợp đồng' : 'Tạo hợp đồng'} ${code} v${version}`}
      subtitle={`${form.party.name || 'Bên mua'}${base ? `, căn cứ báo giá ${base.code} v${base.version}` : ''}`}
      badge={shown ? <Chip tone={GENDOC_STATUS[shown.status].tone}>{GENDOC_STATUS[shown.status].label}</Chip> : undefined}
      left={left}
      html={html}
      onClose={onClose}
      footer={
        <DocActionBar
          status={<span className={cn('font-medium', !locked ? (errs.length ? 'text-[rgb(var(--danger-fg))]' : special.length ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]') : canExport ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--accent-fg))]')}>{!locked ? (errs.length ? `Còn thiếu: ${errs[0]}` : special.length ? `Cần duyệt: ${special[0]}${special.length > 1 ? ` (+${special.length - 1})` : ''}` : src ? `Gửi sẽ tạo v${nextVersion}, bản cũ chuyển "Đã thay thế"` : 'Điều khoản chuẩn: gửi là có hiệu lực ngay') : canExport ? 'Hợp đồng có hiệu lực' : shown?.status === 'PENDING_APPROVAL' ? 'Chờ phê duyệt, chưa xuất được' : 'Chỉ xem'}</span>}
          extra={<>
            {locked && shown?.status === 'PENDING_APPROVAL' && canApprove && (
              <>
                <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--success))] font-semibold text-[rgb(var(--on-accent))] hover:bg-[rgb(var(--success-fg))]')} onClick={() => decide(true)}>Duyệt</button>
                <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))]')} onClick={() => decide(false)}>Từ chối</button>
              </>
            )}
            {viewOnly && isLatest && canEdit && shown?.status !== 'PENDING_APPROVAL' && <button className={cn(btnGhost, btnSm)} onClick={() => { onClose(); openComposer({ docId: src!.id, mode: 'CONTRACT' }); }}><Pencil className="h-3.5 w-3.5" aria-hidden />Sửa, tạo phiên bản mới</button>}
          </>}
          pdf={{ onClick: () => exportContract('PDF'), disabled: !canExport, title: canExport ? 'In / lưu PDF' : 'Chỉ xuất hợp đồng có hiệu lực' }}
          word={{ onClick: () => exportContract('WORD'), disabled: !canExport, title: canExport ? 'Tải file Word (.doc)' : 'Chỉ xuất hợp đồng có hiệu lực' }}
          win={{ onClick: () => { if (baseLead && baseId) { winLead(baseLead.id, baseId); onClose(); } }, disabled: !canWinC, title: !baseLead ? 'Hợp đồng chưa gắn dự án' : baseLead.status === 'WON' ? 'Dự án đã chốt' : !canExport ? 'Hợp đồng phải có hiệu lực (đã duyệt) trước khi chốt' : `Chốt đơn theo báo giá ${base?.code ?? ''}` }}
          submit={{ onClick: create, disabled: locked || errs.length > 0, label: locked ? 'Đã gửi' : special.length ? undefined : src ? `Gửi v${nextVersion}` : undefined, title: locked ? 'Phiên bản đã lưu, chỉ xem' : special.length ? 'Gửi phê duyệt điều khoản đặc biệt' : 'Điều khoản chuẩn: tạo hợp đồng có hiệu lực ngay' }}
        />
      }
    />
  );
}

/** Mở đúng màn: báo giá hoặc hợp đồng */
export function DocComposerModal({ mode = 'QUOTE', leadId, customerId, docId, quoteId, view, onClose }: { mode?: ComposerMode; leadId?: string; customerId?: string; docId?: string; quoteId?: string; view?: boolean; onClose: () => void }) {
  return mode === 'CONTRACT' || docId
    ? <ContractComposer leadId={leadId} quoteId={quoteId} docId={docId} view={view} onClose={onClose} />
    : <QuoteComposer leadId={leadId} customerId={customerId} quoteId={quoteId} onClose={onClose} />;
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
  const { genDocs, setGenDocs, openComposer, me, notify, userName, logDecision } = useApp();
  const canApprove = useContractApprover();
  const [open, setOpen] = useState<string | null>(null);
  const list = latestContracts(genDocs.filter((d) => (!leadId || d.leadId === leadId) && (!customerId || d.customerId === customerId)))
    .sort((a, b) => Number(b.status === 'PENDING_APPROVAL') - Number(a.status === 'PENDING_APPROVAL') || b.createdAt.localeCompare(a.createdAt));
  const decide = (d: GeneratedDoc, ok: boolean) => {
    setGenDocs((all) => all.map((x) => (x.id === d.id ? { ...x, ...(ok ? { status: 'APPROVED' as GenDocStatus, approvedBy: me.id, approvedAt: todayISO() } : { status: 'REJECTED' as GenDocStatus, rejectNote: 'Từ chối từ danh sách hợp đồng' }) } : x)));
    logDecision({ kind: 'CONTRACT', refId: d.id, title: `${d.contractCode} v${d.version ?? 1}: ${d.partyName}`, requesterId: d.createdBy, decision: ok ? 'APPROVED' : 'REJECTED', amount: d.total });
    notify(ok ? `Đã duyệt ${d.contractCode}` : `Đã từ chối ${d.contractCode}`, ok ? 'teal' : 'orange');
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
                  <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--success))] font-semibold text-[rgb(var(--on-accent))]')} onClick={() => decide(d, true)}>Duyệt</button>
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
                <option value="">Chọn biến...</option>
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
          <input className={cn(inputCls, 'border-[rgb(var(--line))] bg-[rgb(var(--bg))] py-2 pl-9')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mẫu theo tên hoặc loại giao dịch..." aria-label="Tìm mẫu" />
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
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">Tiêu đề viết dạng {'<h3 class="art">Tên điều</h3>'} được tự đánh số "Điều 1, Điều 2..." theo các khối đang hiện.</p>
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
  const { quotes, genDocs, setGenDocs, leads, customers, openComposer, canDo, me, notify, logDecision } = useApp();
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
  for (const x of quotes) { const k = x.leadId || `c:${x.customerId ?? x.id}`; groups.set(k, [...(groups.get(k) ?? []), x]); }
  const quoteRows = Array.from(groups.entries()).map(([key, xs]) => {
    const versions = [...xs].sort((a, b) => b.version - a.version);
    return { key, latest: versions[0], versions, lead: leads.find((l) => l.id === versions[0].leadId) };
  });
  const qFiltered = quoteRows.filter((r) => inR(r.latest.date) && (st === 'ALL' || r.latest.status === st) && (!t || [r.latest.code, nameOfQuote(r.latest), r.lead?.code ?? ''].some((v) => v.toLowerCase().includes(t))))
    .sort((a, b) => b.latest.date.localeCompare(a.latest.date));

  // ---- Hợp đồng: phiên bản mới nhất mỗi hợp đồng ----
  const contracts = latestContracts(genDocs);
  const cFiltered = contracts.filter((d) => inR(d.createdAt) && (st === 'ALL' || d.status === st) && (!t || [d.contractCode, d.partyName, d.quoteCode].some((v) => v.toLowerCase().includes(t))))
    .sort((a, b) => Number(b.status === 'PENDING_APPROVAL') - Number(a.status === 'PENDING_APPROVAL') || b.createdAt.localeCompare(a.createdAt));

  const qPaged = usePaged(qFiltered, 12);
  const cPaged = usePaged(cFiltered, 12);
  const decide = (d: GeneratedDoc, ok: boolean) => {
    setGenDocs((all) => all.map((x) => (x.id === d.id ? { ...x, ...(ok ? { status: 'APPROVED' as GenDocStatus, approvedBy: me.id, approvedAt: todayISO() } : { status: 'REJECTED' as GenDocStatus, rejectNote: 'Từ chối từ danh sách' }) } : x)));
    logDecision({ kind: 'CONTRACT', refId: d.id, title: `${d.contractCode} v${d.version ?? 1}: ${d.partyName}`, requesterId: d.createdBy, decision: ok ? 'APPROVED' : 'REJECTED', amount: d.total });
    notify(ok ? `Đã duyệt ${d.contractCode}` : `Đã từ chối ${d.contractCode}`, ok ? 'teal' : 'orange');
  };
  const statusOpts = view === 'QUOTE'
    ? (Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((s) => ({ value: s, label: QUOTE_STATUS[s].label }))
    : (['PENDING_APPROVAL', 'ISSUED', 'APPROVED', 'REJECTED'] as GenDocStatus[]).map((s) => ({ value: s, label: GENDOC_STATUS[s].label }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded bg-[rgb(var(--surface))] p-1" role="radiogroup" aria-label="Loại văn bản">
          {([['QUOTE', `Báo giá (${quoteRows.length})`], ['CONTRACT', `Hợp đồng (${contracts.length})`]] as const).map(([k, label]) => (
            <button key={k} role="radio" aria-checked={view === k} onClick={() => { setView(k); setSt('ALL'); setOpen(null); }} className={cn('rounded-md px-4 py-2 text-sm font-medium', view === k ? 'bg-[rgb(var(--surface))] font-semibold text-[rgb(var(--fg))] shadow-sm ring-1 ring-[rgb(var(--line))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>{label}</button>
          ))}
        </div>
        {view === 'QUOTE' && <button className={cn(btnPrimary, btnSm, 'ml-auto')} disabled={!(canDo('project.update') || canDo('customer.edit'))} onClick={() => openComposer({ mode: 'QUOTE' })}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo báo giá</button>}
        {view === 'CONTRACT' && <button className={cn(btnPrimary, btnSm, 'ml-auto')} disabled={!(canDo('project.update') || canDo('customer.edit'))} onClick={() => openComposer({ mode: 'CONTRACT' })}><Plus className="h-3.5 w-3.5" aria-hidden />Tạo hợp đồng</button>}
      </div>

      <FilterBar q={q} onQ={setQ} placeholder={view === 'QUOTE' ? 'Tìm mã báo giá, khách hàng, mã dự án...' : 'Tìm số hợp đồng, bên mua, báo giá căn cứ...'} status={st} onStatus={setSt} statusOptions={statusOpts} />

      <Panel title={view === 'QUOTE' ? `${qFiltered.length} bộ báo giá` : `${cFiltered.length} hợp đồng`}>
        {view === 'QUOTE' ? (
          <>
            <Table stt={Math.max(0, qPaged.from - 1)} head={['Khách hàng / dự án', 'Báo giá mới nhất', 'Ngày', 'Trước VAT', 'Trạng thái', '']} minW={760}>
              {qPaged.slice.map((r) => (
                <Fragment key={r.key}>
                  <tr className={rowCls}>
                    <td className={tdFirst}><p className="max-w-[280px] truncate font-medium text-[rgb(var(--fg))]">{nameOfQuote(r.latest)}</p><p className="text-xs text-[rgb(var(--muted))]">{r.lead ? r.lead.code : 'Không gắn dự án'}</p></td>
                    <td className={tdCls}><b>{r.latest.code}</b> <span className="text-xs text-[rgb(var(--muted))]">v{r.latest.version}</span>{r.versions.length > 1 && <button className="ml-2 text-xs text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setOpen(open === r.key ? null : r.key)}>{open === r.key ? 'ẩn' : `${r.versions.length} phiên bản`}</button>}</td>
                    <td className={cn(tdCls, 'tabular-nums')}>{fmtDate(r.latest.date)}</td>
                    <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(r.latest.amount)}</td>
                    <td className={tdCls}><Chip tone={QUOTE_STATUS[r.latest.status].tone}>{QUOTE_STATUS[r.latest.status].label}</Chip></td>
                    <td className={cn(tdLast, 'text-right')}><div className="flex justify-end gap-1.5"><button className={cn(btnGhost, btnSm)} onClick={() => setMailFor(r.latest)} title="Soạn email gửi báo giá bằng AI"><Sparkles className="h-3.5 w-3.5 text-[rgb(var(--accent))]" aria-hidden />Soạn email</button><button className={cn(btnGhost, btnSm)} onClick={() => openComposer({ quoteId: r.latest.id, mode: 'QUOTE' })}><Eye className="h-3.5 w-3.5" aria-hidden />Xem</button></div></td>
                  </tr>
                  {open === r.key && r.versions.slice(1).map((v) => (
                    <tr key={v.id} data-sub className="bg-[rgb(var(--sunken))] text-xs text-[rgb(var(--muted))]">
                      <td className={tdFirst} />
                      <td className={tdCls}>{v.code} v{v.version}</td>
                      <td className={cn(tdCls, 'tabular-nums')}>{fmtDate(v.date)}</td>
                      <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(v.amount)}</td>
                      <td className={tdCls}><Chip tone={QUOTE_STATUS[v.status].tone}>{QUOTE_STATUS[v.status].label}</Chip></td>
                      <td className={cn(tdLast, 'text-right')}><button className="text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => openComposer({ quoteId: v.id, mode: 'QUOTE' })}>Xem</button></td>
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
            <Table stt={Math.max(0, cPaged.from - 1)} head={['Số hợp đồng', 'Bên mua', 'Căn cứ báo giá', 'Giá trị', 'Trạng thái', '']} minW={820}>
              {cPaged.slice.map((d) => {
                const versions = contractVersions(genDocs, docGroupOf(d));
                return (
                  <Fragment key={d.id}>
                    <tr className={rowCls}>
                      <td className={tdFirst}><b>{d.contractCode}</b> <span className="text-xs text-[rgb(var(--muted))]">v{d.version ?? 1}</span>{versions.length > 1 && <button className="ml-2 text-xs text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? 'ẩn' : `${versions.length} phiên bản`}</button>}<p className="text-xs text-[rgb(var(--muted))]">{fmtDate(d.createdAt)}</p></td>
                      <td className={tdCls}><p className="max-w-[240px] truncate">{d.partyName}</p></td>
                      <td className={cn(tdCls, 'text-xs')}>{d.quoteCode || '—'}</td>
                      <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(d.total)}</td>
                      <td className={tdCls}><Chip tone={GENDOC_STATUS[d.status].tone}>{GENDOC_STATUS[d.status].label}</Chip>{d.status === 'PENDING_APPROVAL' && <p className="mt-1 max-w-[220px] truncate text-[11px] text-[rgb(var(--accent-fg))]">{d.special[0]}</p>}</td>
                      <td className={cn(tdLast, 'whitespace-nowrap text-right')}>
                        <button className={cn(btnGhost, btnSm, 'mr-1')} onClick={() => openComposer({ docId: d.id, view: true })}><Eye className="h-3.5 w-3.5" aria-hidden />Xem</button>
                        {d.status === 'PENDING_APPROVAL' && canApprove(d) && (
                          <>
                            <button className={cn(btnBase, btnSm, 'mr-1 bg-[rgb(var(--success))] font-semibold text-[rgb(var(--on-accent))]')} onClick={() => decide(d, true)}>Duyệt</button>
                            <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))]')} onClick={() => decide(d, false)}>Từ chối</button>
                          </>
                        )}
                      </td>
                    </tr>
                    {open === d.id && versions.slice(1).map((v) => (
                      <tr key={v.id} className="bg-[rgb(var(--sunken))] text-xs text-[rgb(var(--muted))]">
                        <td className={tdFirst}>v{v.version ?? 1}, {fmtDate(v.createdAt)}</td>
                        <td className={tdCls} />
                        <td className={tdCls}>{v.quoteCode}</td>
                        <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(v.total)}</td>
                        <td className={tdCls}><Chip tone={GENDOC_STATUS[v.status].tone}>{GENDOC_STATUS[v.status].label}</Chip></td>
                        <td className={cn(tdLast, 'text-right')}><button className="text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => openComposer({ docId: v.id, view: true })}>Xem</button></td>
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

