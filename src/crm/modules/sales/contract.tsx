'use client';

import { Fragment, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Copy, Download, Eye, FileText, History, Mail, Package, Pencil, Plus, RefreshCw, Search, Send, ShieldCheck, Trash2, Upload, XCircle } from 'lucide-react';
import { Pagination, RowMenu, usePaged } from '../../components/controls';
import { Collapse, ConfirmDialog } from '../../components/crud';
import { FilterBar, useInRange } from '../../components/filters';
import { Chip, Code, EmptyState, Field, FilePicker, Modal, Panel, StatCard, Table, Tabs, useOverlay, useSticky } from '../../components/ui';
import { latestContracts } from '../../lib/business';
import { btnBase, btnGhost, btnPrimary, btnSm, C, CHECK_DOT, compact, contractVersions, docGroupOf, esc, findByTax, fmtDate, fmtN, GENDOC_STATUS, GM_RULE, guessTx, inputBase, inputCls, iso, latestQuote, partyOf, PRICE_TIER, QUOTE_STATUS, quoteLineToDoc, rowCls, SAMPLE_FORM, secHead, tdCls, tdFirst, tdLast, TEMPLATE_FLAGS, TEMPLATE_VARS, tierPrice, todayISO, TX_TYPE, uid, useApp } from '../../lib/core';
import type { CheckItem, ComposerForm, ComposerMode, ConfirmState, DocLine, DocTemplate, GenDocStatus, GeneratedDoc, PayMilestone, PriceTier, Quote, QuoteStatus, SkuItem, TxType } from '../../lib/types';
import { cn } from '../../lib/utils';
import { parseAiJson, useAi } from '../ai/ai-core';
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
  const html = withMilestones(cTpl ? renderTemplate(cTpl.body, vars, flags) : '<p>Chưa chọn mẫu hợp đồng</p>', form.milestones, totals.grand);
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
        <section id="ct-1" className="scroll-mt-4">
          {secHead(1, 'Căn cứ & mẫu hợp đồng')}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {options.length ? (
              <Field label="Báo giá căn cứ">
                <select className={inputCls} value={baseId ?? ''} onChange={(e) => pickBase(e.target.value)}>
                  <option value="" disabled>Chọn báo giá…</option>
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
        <section id="ct-2" className="scroll-mt-4">
          <div className="flex items-start justify-between gap-2">
            {secHead(2, 'Bên mua')}
            {(customer || baseLead) && !locked && <button type="button" className={cn(btnGhost, btnSm)} title="Điền lại pháp nhân, MST, địa chỉ, người đại diện từ hồ sơ khách hàng" onClick={() => setForm((f) => ({ ...f, party: partyOf(customer, baseLead) }))}><RefreshCw className="h-3.5 w-3.5" aria-hidden />Lấy lại từ CRM</button>}
          </div>
          <Fold title="Pháp nhân, đại diện ký" summary={[form.party.name, form.party.taxCode && `MST ${form.party.taxCode}`, form.party.rep].filter(Boolean).join(' · ') || 'Chưa có'} open={!form.party.name}>
            <PartyFields form={form} setParty={setParty} />
          </Fold>
        </section>
        <section id="ct-3" className="scroll-mt-4">
          {secHead(3, 'Điều khoản thanh toán')}
          <TermsFields form={form} set={set} cTpl={cTpl} contract part="pay" />
          <div className="mt-2">
            <Fold title="Giao hàng, bảo hành, ghi chú" summary={`${form.delivery || 'Chưa nhập giao hàng'} · BH ${form.warrantyMonths} th`}>
              <TermsFields form={form} set={set} cTpl={cTpl} contract part="other" />
            </Fold>
          </div>
          <MilestonesField form={form} set={set} grand={totals.grand} />
        </section>
      </fieldset>
      {!locked && errs.length > 0 && <ul className="space-y-0.5 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
      <ContractAiReview html={html} special={special} />
      {group && <div id="ct-4" className="scroll-mt-4"><ContractVersionDiff key={shown?.id ?? src?.id} group={group} currentId={shown?.id ?? src?.id} /></div>}
    </>
  );

  return (
    <ComposerShell
      title={`${locked ? 'Hợp đồng' : src ? 'Sửa hợp đồng' : 'Tạo hợp đồng'} ${code} v${version}`}
      subtitle={`${form.party.name || 'Bên mua'}${base ? `, căn cứ báo giá ${base.code} v${base.version}` : ''}`}
      outline
      steps={[
        { label: 'Căn cứ', done: !!base && !!cTpl, target: 'ct-1' },
        { label: 'Bên mua', done: form.party.name.trim().length >= 3 && !!form.party.taxCode.trim(), target: 'ct-2' },
        { label: 'Điều khoản', done: !!base && !!form.delivery && !errs.some((x) => x.startsWith('Các đợt')) && (locked || !special.length), target: 'ct-3' },
        { label: 'Trình ký', done: canExport, target: group ? 'ct-4' : undefined },
      ]}
      badge={shown ? <Chip tone={GENDOC_STATUS[shown.status].tone}>{GENDOC_STATUS[shown.status].label}</Chip> : undefined}
      left={left}
      html={html}
      onClose={onClose}
      footer={
        <DocActionBar
          totals={<DocTotals sub={totals.sub} vat={totals.vat} vatPct={form.vatPct} grand={totals.grand} />}
          status={<span className={cn('font-medium', !locked ? (errs.length ? 'text-[rgb(var(--danger-fg))]' : special.length ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]') : canExport ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--accent-fg))]')}>{!locked ? (errs.length ? `Còn thiếu: ${errs[0]}` : special.length ? `Cần duyệt: ${special[0]}${special.length > 1 ? ` (+${special.length - 1})` : ''}` : src ? `Gửi sẽ tạo v${nextVersion}, bản cũ chuyển "Đã thay thế"` : 'Điều khoản chuẩn: gửi là có hiệu lực ngay') : canExport ? 'Hợp đồng có hiệu lực' : shown?.status === 'PENDING_APPROVAL' ? 'Chờ phê duyệt, chưa xuất được' : 'Chỉ xem'}</span>}
          extra={<>
            {locked && shown?.status === 'PENDING_APPROVAL' && canApprove && (
              <>
                <button className={cn(btnBase, btnSm, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => decide(true)}>Duyệt</button>
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

/** Dải tổng ở chân màn soạn: Cộng tiền hàng · VAT · Tổng · Lãi gộp (chỉ người xem được giá vốn) */
export function DocTotals({ sub, vat, vatPct, grand, gm }: { sub: number; vat: number; vatPct: number; grand: number; gm?: number | null }) {
  const it = (l: string, v: string, cls?: string, wide?: boolean) => <span className={cn('whitespace-nowrap', wide && 'hidden 2xl:inline')}>{l}<b className={cn('ml-1.5 font-mono text-[13px] font-medium text-[rgb(var(--fg))]', cls)}>{v}</b></span>;
  return (
    <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[rgb(var(--fg2))] lg:w-auto">
      {it('Cộng tiền hàng', compact(sub), undefined, true)}
      {it(`VAT ${vatPct}%`, compact(vat), undefined, true)}
      {it('Tổng', `${grand.toLocaleString('vi-VN')} đ`)}
      {gm !== undefined && it('Lãi gộp', gm === null ? (sub ? 'chưa đủ giá vốn' : '—') : `${gm.toFixed(1)}%`, gm === null ? 'font-sans' : gm < GM_RULE.bod ? 'text-[rgb(var(--danger-fg))]' : gm < GM_RULE.head ? 'text-[rgb(var(--accent-fg))]' : undefined)}
    </div>
  );
}

export function CheckList({ items }: { items: CheckItem[] }) {
  return (
    <ul className="divide-y divide-[rgb(var(--line))]">
      {items.map((x) => (
        <li key={x.title} className="flex items-start gap-3 py-2">
          <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', CHECK_DOT[x.tone])} aria-hidden />
          <div className="min-w-0 flex-1"><p className="text-[13px] font-medium">{x.title}</p><p className="text-xs text-[rgb(var(--muted))]">{x.detail}</p></div>
          {x.act}
        </li>
      ))}
    </ul>
  );
}

/** Kiểm tra trước khi gửi (tính tại chỗ, không cần AI) + gợi ý "thường mua kèm" từ các báo giá đã có */
export function QuoteChecks({ form, skus, quotes, canSeeCost, onAdd }: { form: ComposerForm; skus: SkuItem[]; quotes: Quote[]; canSeeCost: boolean; onAdd: (l: DocLine) => void }) {
  const items: CheckItem[] = [];
  form.items.forEach((l, i) => {
    const k = skus.find((s) => s.sku === l.sku);
    if (!k) return;
    if (canSeeCost && k.costPrice > 0 && l.price > 0) {
      const g = ((l.price - k.costPrice) / l.price) * 100;
      if (g < GM_RULE.head) items.push({ tone: g < GM_RULE.bod ? 'red' : 'orange', title: `Dòng ${i + 1}: ${l.name}, lãi gộp ${g.toFixed(1)}%`, detail: `thấp hơn ngưỡng ${g < GM_RULE.bod ? GM_RULE.bod : GM_RULE.head}%; cấp duyệt tính theo lãi gộp cả báo giá` });
    }
    if (l.qty > k.stock) items.push({ tone: 'orange', title: `Tồn ${l.name}: ${k.stock.toLocaleString('vi-VN')}, báo ${l.qty.toLocaleString('vi-VN')}`, detail: `thiếu ${(l.qty - k.stock).toLocaleString('vi-VN')} ${l.unit}${k.leadTimeDays ? `, thời gian về hàng khoảng ${k.leadTimeDays} ngày` : ''}: ghi rõ tiến độ giao ở điều khoản` });
  });
  const tax = form.party.taxCode.replace(/[\s.]/g, '');
  if (!tax) items.push({ tone: 'orange', title: 'Chưa có mã số thuế khách hàng', detail: 'cần khi xuất hóa đơn và làm hợp đồng' });
  else if (!/^\d{10}(-?\d{3})?$/.test(tax)) items.push({ tone: 'red', title: `Mã số thuế "${form.party.taxCode}" sai định dạng`, detail: 'MST gồm 10 số, chi nhánh thêm 3 số' });
  else items.push({ tone: 'teal', title: 'Mã số thuế đúng định dạng', detail: 'chỉ kiểm tra định dạng, chưa tra cứu tình trạng hoạt động' });
  if (!form.party.email && !form.party.phone) items.push({ tone: 'orange', title: 'Chưa có email hoặc điện thoại người nhận', detail: 'nhập ở Thông tin pháp nhân để gửi báo giá' });

  // Thường mua kèm: hàng xuất hiện cùng hàng đang báo trong các báo giá trước
  const have = new Set(form.items.map((l) => l.sku).filter(Boolean));
  const tier = form.tier === 'BOQ' ? TX_TYPE[form.txType].tier : form.tier;
  const pairs = new Map<string, { n: number; base: number; anchor: string; qty: number }>();
  if (have.size) {
    const rel = quotes.filter((x) => x.lines.some((ln) => have.has(ln.sku)));
    rel.forEach((x) => {
      const anchor = x.lines.find((ln) => have.has(ln.sku))?.name ?? '';
      new Set(x.lines.map((ln) => ln.sku)).forEach((code) => {
        if (!code || have.has(code)) return;
        const p = pairs.get(code) ?? { n: 0, base: rel.length, anchor, qty: x.lines.find((ln) => ln.sku === code)?.qty ?? 1 };
        pairs.set(code, { ...p, n: p.n + 1 });
      });
    });
  }
  const sugg = [...pairs.entries()].map(([code, p]) => ({ k: skus.find((s) => s.sku === code && !s.archived), ...p })).filter((x) => x.k && x.n >= 2 && x.n / x.base >= 0.3).sort((x, y) => y.n - x.n).slice(0, 2);

  if (!form.items.length) return null;
  return (
    <section className="rounded-[10px] border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4" aria-label="Kiểm tra trước khi gửi">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Kiểm tra trước khi gửi<span className="ml-auto text-xs font-normal text-[rgb(var(--muted))]">tự chạy khi sửa</span></p>
      <CheckList items={items} />
      {sugg.length > 0 && (
        <div className="mt-2 space-y-2 border-t border-[rgb(var(--line))] pt-3">
          {sugg.map(({ k, n, base, anchor, qty }) => (
            <div key={k!.sku} className="flex items-center gap-3 rounded-lg border border-dashed border-[rgb(var(--line))] px-3 py-2 text-[13px]">
              <Package className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
              <span className="min-w-0 flex-1">Thường mua kèm {anchor}: <b className="font-medium">{k!.name}</b><span className="block text-xs text-[rgb(var(--muted))]">{n} / {base} báo giá có hàng này · {tierPrice(k, tier).toLocaleString('vi-VN')}đ / {k!.unit}</span></span>
              <button type="button" className={cn(btnGhost, btnSm)} onClick={() => { const p = tierPrice(k, tier); onAdd({ sku: k!.sku, name: k!.name, unit: k!.unit, qty, price: p, listPrice: p, discountPct: 0 }); }}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm {qty.toLocaleString('vi-VN')} {k!.unit}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Bước gửi khách: thư soạn sẵn (AI soạn khi đã bật), sao chép, mở ứng dụng email của người dùng, xuất PDF để đính kèm */
export function QuoteSendPanel({ form, code, version, total, sellerName, onPdf }: { form: ComposerForm; code: string; version: number; total: number; sellerName: string; onPdf: () => void }) {
  const { company, notify, addMsgLog } = useApp();
  const ai = useAi('writer');
  const seller = company.shortName || company.legalName;
  const greet = form.party.rep ? `Kính gửi ${form.party.repTitle ? `${form.party.repTitle} ` : ''}${form.party.rep},` : `Kính gửi Quý ${form.party.name},`;
  const plain = `${greet}\n\n${seller} xin gửi báo giá số ${code}${version > 1 ? ` (bản ${version})` : ''}, tổng giá trị ${total.toLocaleString('vi-VN')} đ (đã gồm VAT ${form.vatPct}%), hiệu lực ${form.validDays} ngày.\nĐiều kiện thanh toán: ${form.advancePct ? `tạm ứng ${form.advancePct}%, ` : ''}công nợ ${form.creditDays} ngày. Giao hàng: ${form.delivery || 'theo thỏa thuận'}.\n\nBáo giá chi tiết trong file PDF đính kèm. Rất mong nhận được phản hồi của Quý khách.\n\nTrân trọng,\n${sellerName}\n${seller}`;
  const [to, setTo] = useState(form.party.email);
  const [subject, setSubject] = useState(`Báo giá ${code} - ${seller}`);
  const [body, setBody] = useState(plain);
  const [busy, setBusy] = useState('');
  const draft = async (key: string, how: string) => {
    setBusy(key);
    const r = await ai.ask({ prompt: `Soạn thư điện tử gửi khách kèm báo giá, tiếng Việt, lịch sự, không bịa thông tin ngoài dữ liệu sau. ${how}\nKhách: ${form.party.name}${form.party.rep ? `, người nhận ${form.party.repTitle} ${form.party.rep}` : ''}\nBáo giá: ${code} v${version}, tổng ${total.toLocaleString('vi-VN')} đ gồm VAT ${form.vatPct}%, hiệu lực ${form.validDays} ngày\nHàng chính: ${form.items.slice(0, 5).map((l) => `${l.name} (${l.qty} ${l.unit})`).join('; ')}\nThanh toán: tạm ứng ${form.advancePct}%, công nợ ${form.creditDays} ngày. Giao hàng: ${form.delivery}\nNgười gửi: ${sellerName}, ${seller}\nChỉ trả về nội dung thư, không có tiêu đề.`, maxTokens: 700 });
    setBusy('');
    if (r.ok) setBody(r.text.trim()); else notify(r.error ?? 'AI chưa trả lời', 'orange');
  };
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
  return (
    <section className="rounded-[10px] border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4" aria-label="Gửi báo giá">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium"><Send className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Gửi khách
        {ai.available && <span className="ml-auto flex gap-1.5">
          {[['Soạn bằng AI', ''], ['Ngắn hơn', 'Viết ngắn gọn trong 4 câu.'], ['Trang trọng hơn', 'Văn phong trang trọng, phù hợp cơ quan nhà nước.']].map(([l, how]) => (
            <button key={l} type="button" className={cn(btnGhost, btnSm)} disabled={!!busy} onClick={() => void draft(l, how)}>{l === 'Soạn bằng AI' && <Bot className="h-3.5 w-3.5" aria-hidden />}{busy === l ? 'Đang soạn…' : l}</button>
          ))}
        </span>}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Đến"><input className={inputCls} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email người nhận" /></Field>
        <Field label="Tiêu đề"><input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      </div>
      <Field label="Nội dung" className="mt-2"><textarea className={cn(inputCls, 'min-h-[180px] leading-6')} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={cn(btnGhost, btnSm)} onClick={onPdf}><Download className="h-3.5 w-3.5" aria-hidden />Xuất PDF để đính kèm</button>
        <button type="button" className={cn(btnGhost, btnSm)} onClick={() => { void navigator.clipboard?.writeText(`${subject}\n\n${body}`).then(() => notify('Đã sao chép thư', 'teal')); }}><Copy className="h-3.5 w-3.5" aria-hidden />Sao chép (Zalo, email)</button>
        <a className={cn(btnPrimary, btnSm, 'ml-auto', !to && 'pointer-events-none opacity-50')} href={to ? mailto : undefined} aria-disabled={!to}
          onClick={() => addMsgLog({ channel: 'EMAIL', to, subject, ok: true, detail: 'Mở bằng ứng dụng email của người dùng (mailto), chưa xác nhận đã gửi' })}><Mail className="h-3.5 w-3.5" aria-hidden />Mở ứng dụng email</a>
      </div>
      <p className="mt-2 text-xs text-[rgb(var(--muted))]">Ứng dụng email trên máy bạn sẽ mở thư soạn sẵn; đính kèm file PDF vừa xuất rồi bấm gửi ở đó.</p>
    </section>
  );
}

/** Chèn bảng thanh toán theo đợt ngay sau đoạn "Điều N. … thanh toán" của mẫu; mẫu không có thì thêm cuối văn bản */
export function withMilestones(html: string, ms: PayMilestone[] | undefined, grand: number) {
  if (!ms?.length) return html;
  const cell = 'border:1px solid #333;padding:3px 6px';
  const rows = ms.map((m, i) => `<tr><td style="${cell}">${i + 1}. ${esc(m.label)}</td><td style="${cell};text-align:right">${m.pct}%</td><td style="${cell};text-align:right">${Math.round((grand * m.pct) / 100).toLocaleString('vi-VN')}</td><td style="${cell}">${esc(m.cond)}</td></tr>`).join('');
  const tb = `<p><b>Lịch thanh toán theo đợt</b></p><table style="width:100%;border-collapse:collapse;margin:4px 0 8px"><tr><th style="${cell}">Đợt</th><th style="${cell}">Tỷ lệ</th><th style="${cell}">Số tiền (đ)</th><th style="${cell}">Điều kiện</th></tr>${rows}</table>`;
  const m = /Điều\s+\d+\s*[.:]?\s*(?:<[^>]+>\s*)*[^<]{0,40}[Tt]hanh toán/.exec(html);
  if (m) {
    const end = html.indexOf('</p>', m.index);
    if (end > 0) return html.slice(0, end + 4) + tb + html.slice(end + 4);
  }
  return html + tb;
}

/** Thanh toán theo đợt: tùy chọn; tổng tỷ lệ phải đúng 100% */
export function MilestonesField({ form, set, grand }: { form: ComposerForm; set: <K extends keyof ComposerForm>(k: K, v: ComposerForm[K]) => void; grand: number }) {
  const ms = form.milestones ?? [];
  const sum = ms.reduce((t, m) => t + (Number(m.pct) || 0), 0);
  const put = (i: number, p: Partial<PayMilestone>) => set('milestones', ms.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const suggest = () => set('milestones', form.advancePct > 0
    ? [{ label: 'Tạm ứng', pct: form.advancePct, cond: 'Trong 5 ngày sau khi ký hợp đồng' }, { label: 'Giao hàng và nghiệm thu', pct: 100 - form.advancePct, cond: `Công nợ ${form.creditDays} ngày kể từ ngày nghiệm thu` }]
    : [{ label: 'Giao hàng và nghiệm thu', pct: 100, cond: `Công nợ ${form.creditDays} ngày kể từ ngày nghiệm thu` }]);
  return (
    <div className="mt-2 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
      <p className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold">Thanh toán theo đợt
        <span className={cn('text-xs font-normal', ms.length && Math.round(sum) !== 100 ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')}>{ms.length ? `${ms.length} đợt · cộng ${sum}%` : 'không bắt buộc'}</span>
        <span className="ml-auto flex gap-1.5">
          {!ms.length && <button type="button" className={cn(btnGhost, btnSm)} onClick={suggest}>Gợi ý theo tạm ứng</button>}
          <button type="button" className={cn(btnGhost, btnSm)} onClick={() => set('milestones', [...ms, { label: `Đợt ${ms.length + 1}`, pct: Math.max(0, 100 - sum), cond: '' }])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm đợt</button>
        </span>
      </p>
      {ms.length > 0 && (
        <table className="w-full border-t border-[rgb(var(--line))] text-[13px]">
          <thead className="text-xs text-[rgb(var(--muted))]"><tr><th className="px-3 py-1.5 text-left font-normal">Đợt</th><th className="w-20 px-1 text-right font-normal">Tỷ lệ %</th><th className="w-32 px-2 text-right font-normal">Số tiền (đ)</th><th className="px-2 text-left font-normal">Điều kiện</th><th className="w-8" /></tr></thead>
          <tbody>
            {ms.map((m, i) => (
              <tr key={i} className="border-t border-[rgb(var(--line))]">
                <td className="px-2 py-1"><input className={inputCls} value={m.label} onChange={(e) => put(i, { label: e.target.value })} aria-label={`Tên đợt ${i + 1}`} /></td>
                <td className="px-1 py-1"><input className={cn(inputCls, 'text-right tabular-nums')} type="number" min={0} max={100} value={m.pct} onChange={(e) => put(i, { pct: Number(e.target.value) })} aria-label={`Tỷ lệ đợt ${i + 1}`} /></td>
                <td className="px-2 py-1 text-right font-mono text-xs tabular-nums">{Math.round((grand * (Number(m.pct) || 0)) / 100).toLocaleString('vi-VN')}</td>
                <td className="px-2 py-1"><input className={inputCls} value={m.cond} onChange={(e) => put(i, { cond: e.target.value })} aria-label={`Điều kiện đợt ${i + 1}`} /></td>
                <td className="pr-2 text-center"><button type="button" className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => set('milestones', ms.filter((_, j) => j !== i))} aria-label={`Xóa đợt ${i + 1}`}><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
    <section className="rounded-[10px] border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4" aria-label="Rà soát hợp đồng">
      <div className="flex flex-wrap items-center gap-2">
        <Bot className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><p className="text-sm font-medium">Rà soát hợp đồng</p>
        <span className="text-xs text-[rgb(var(--muted))]">{ai.available ? `${ai.label} đọc bản xem trước và gợi ý, không tự sửa` : 'cần bật trợ lý AI ở Cài đặt › AI & trợ lý'}</span>
        <button type="button" className={cn(btnGhost, btnSm, 'ml-auto')} disabled={!ai.available || busy} onClick={() => void run()}>{busy ? <><RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />Đang rà soát…</> : res ? 'Rà soát lại' : 'Rà soát bằng AI'}</button>
      </div>
      {res && (res.length ? <div className="mt-2"><CheckList items={res} /></div> : <p className="mt-2 text-xs text-[rgb(var(--muted))]">AI không trả về gợi ý nào.</p>)}
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
export function ContractVersionDiff({ group, currentId }: { group: string; currentId?: string }) {
  const { genDocs, users, notify } = useApp();
  const ai = useAi('copilot');
  const vs = contractVersions(genDocs, group);
  const [aId, setA] = useState('');
  const [bId, setB] = useState('');
  const [sum, setSum] = useState('');
  const [busy, setBusy] = useState(false);
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
    <section className="rounded-[10px] border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4" aria-label="So sánh phiên bản">
      <div className="flex flex-wrap items-center gap-2">
        <History className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><p className="text-sm font-medium">So sánh phiên bản</p>
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          <select className={cn(inputBase, 'w-auto py-1 text-xs')} value={A.id} onChange={(e) => { setA(e.target.value); setSum(''); }} aria-label="Bản gốc">{vs.map((d) => <option key={d.id} value={d.id}>{label(d)}</option>)}</select>
          <ArrowRight className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden />
          <select className={cn(inputBase, 'w-auto py-1 text-xs')} value={B.id} onChange={(e) => { setB(e.target.value); setSum(''); }} aria-label="Bản so sánh">{vs.map((d) => <option key={d.id} value={d.id}>{label(d)}</option>)}</select>
        </span>
      </div>
      <p className="mt-1 text-xs text-[rgb(var(--muted))]">{diff.length} thay đổi{who ? ` · người tạo v${B.version ?? 1}: ${who}` : ''}{B.special.length ? ` · cần duyệt: ${B.special.join('; ')}` : ''}</p>
      {diff.length ? <div className="mt-1"><CheckList items={diff} /></div> : <p className="mt-2 text-xs text-[rgb(var(--muted))]">Hai phiên bản giống nhau về dữ liệu.</p>}
      {diff.length > 0 && (
        <div className="mt-2 rounded-lg bg-[rgb(var(--raised))] p-3">
          <div className="flex items-center gap-2 text-[13px] font-medium"><Bot className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Tóm tắt cho người duyệt
            <button type="button" className={cn(btnGhost, btnSm, 'ml-auto')} disabled={!ai.available || busy} title={ai.available ? '' : 'Cần bật trợ lý AI'} onClick={() => void summarize()}>{busy ? 'Đang tóm tắt…' : sum ? 'Tóm tắt lại' : 'Tóm tắt bằng AI'}</button>
          </div>
          {sum && <p className="mt-2 whitespace-pre-line text-[13px] leading-6">{sum}</p>}
        </div>
      )}
    </section>
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
                    <td className={tdFirst}><Code>{r.latest.code}</Code>{r.versions.length > 1 && <button className="ml-1.5 font-mono text-xs text-[rgb(var(--muted))] hover:underline" onClick={() => setOpen(open === r.key ? null : r.key)} aria-expanded={open === r.key} title="Phiên bản cũ">v{r.latest.version}</button>}</td>
                    <td className={tdCls}><button className="block max-w-[260px] truncate text-left font-medium hover:underline" title={nameOfQuote(r.latest)} onClick={() => openComposer({ quoteId: r.latest.id, mode: 'QUOTE' })}>{nameOfQuote(r.latest)}</button></td>
                    <td className={tdCls}>{r.lead ? <Code>{r.lead.code}</Code> : <span className="text-[rgb(var(--faint))]">—</span>}</td>
                    <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(r.latest.date)}</td>
                    <td className={cn(tdCls, 'font-mono text-xs', r.latest.validUntil && r.latest.validUntil < todayISO() && r.latest.status === 'SENT' ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--fg2))]')}>{r.latest.validUntil ? fmtDate(r.latest.validUntil) : '—'}</td>
                    <td className={cn(tdCls, 'text-right tabular-nums')}>{compact(r.latest.amount)}</td>
                    <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg2))]')}>{compact(Math.round(r.latest.amount * (1 + (r.latest.vatPct ?? 0) / 100)))}</td>
                    <td className={tdCls}><Chip tone={QUOTE_STATUS[r.latest.status].tone}>{QUOTE_STATUS[r.latest.status].label}</Chip></td>
                    <td className={cn(tdLast, 'text-right')}><div className="flex items-center justify-end gap-1">
                      <button className={cn(btnGhost, 'h-8 w-8 border-0 p-0')} onClick={() => setMailFor(r.latest)} title="Soạn email gửi báo giá bằng AI" aria-label={`Soạn email ${r.latest.code}`}><Mail className="h-4 w-4" aria-hidden /></button>
                      <button className={cn(btnGhost, 'h-8 w-8 border-0 p-0')} onClick={() => openComposer({ quoteId: r.latest.id, mode: 'QUOTE' })} title="Xem" aria-label={`Xem ${r.latest.code}`}><Eye className="h-4 w-4" aria-hidden /></button>
                      <RowMenu label={`Thao tác ${r.latest.code}`} items={[
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

