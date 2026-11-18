'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Chip, Field, useSticky } from '../../components/ui';
import { APPROVAL_LEVEL, approvalOf, approvalReasons, btnBase, btnGhost, btnSm, compact, docLineToQuote, findByTax, guessTx, inputBase, inputCls, iso, latestQuote, nextCode, partyOf, PRICE_TIER, QUOTE_STATUS, quoteLineToDoc, secHead, tierPrice, todayISO, TX_TYPE, uid, useApp } from '../../lib/core';
import type { ApprovalDecision, ComposerForm, DocLine, Lead, PriceTier, Quote, QuoteStatus, TxType, User } from '../../lib/types';
import { cn } from '../../lib/utils';
import { learnDrafts, SmartQuoteGrid } from './smart-quote';
import { buildDocVars, ComposerShell, DocActionBar, docShell, docTotals, downloadWord, Fold, PartyFields, printHtml, renderTemplate, TermsFields } from './templates';

// =====================================================================
//  MÀN BÁO GIÁ — chỉ ghi khi bấm "Tạo báo giá" / "Lưu thay đổi"; xuất file sau khi đã lưu
// =====================================================================

export function QuoteComposer({ leadId, customerId, quoteId, onClose }: { leadId?: string; customerId?: string; quoteId?: string; onClose: () => void }) {
  const { leads, myLeads, customers, skus, company, users, me, role, docTemplates, quotes, setQuotes, submitQuote, notify, canDo, getfly, openComposer, dispatch, departments, logDecision, winLead, setDraftProducts } = useApp();
  const [wide, setWide] = useSticky('QuoteComposer.wide2', true);
  const editQuote = quotes.find((q) => q.id === quoteId);
  // Báo giá đã tạo chỉ xem; muốn thay đổi phải tạo báo giá điều chỉnh (phiên bản mới)
  const viewOnly = !!editQuote;
  const year = new Date().getFullYear();
  const suggestQuote = (tx: TxType) => docTemplates.find((t) => t.kind === 'QUOTE' && t.txType === tx) ?? docTemplates.find((t) => t.kind === 'QUOTE');
  const itemsOfLead = (l?: Lead): DocLine[] => {
    if (!l) return [];
    const q = latestQuote(l.id, quotes);
    if (q) return q.lines.map(quoteLineToDoc);
    return (l.boqItems ?? []).map((i) => ({ sku: i.code, name: i.name, unit: i.unit, qty: i.qty, price: Math.round(i.price * (1 - i.discountPct / 100)), listPrice: i.price, discountPct: i.discountPct }));
  };
  const [initial] = useState<ComposerForm>(() => {
    const l = leads.find((x) => x.id === (editQuote?.leadId || leadId));
    const c = customers.find((x) => x.id === (editQuote?.customerId ?? customerId ?? l?.customerId)) ?? (l ? findByTax(customers, l.taxCode) : undefined);
    if (editQuote?.quoteForm) return { ...editQuote.quoteForm, items: editQuote.lines.map(quoteLineToDoc), vatPct: editQuote.vatPct };
    const prev = l ? latestQuote(l.id, quotes) : undefined;
    const tpl = docTemplates.find((t) => t.id === (editQuote?.templateId ?? prev?.templateId)) ?? suggestQuote(guessTx(c?.segment ?? l?.segment));
    const tx = tpl?.txType ?? guessTx(c?.segment ?? l?.segment);
    const base = prev?.quoteForm;
    return {
      txType: tx, quoteTplId: tpl?.id ?? '', contractTplId: tpl?.pairId ?? '', tier: editQuote?.tier ?? prev?.tier ?? (l?.boqItems?.length ? 'BOQ' : TX_TYPE[tx].tier),
      leadId: l?.id, customerId: c?.id, party: base?.party ?? partyOf(c, l), items: editQuote ? editQuote.lines.map(quoteLineToDoc) : itemsOfLead(l), vatPct: editQuote?.vatPct ?? prev?.vatPct ?? (getfly.defaultVatPct || 10),
      delivery: base?.delivery ?? tpl?.defaultDelivery ?? TX_TYPE[tx].delivery, advancePct: base?.advancePct ?? 0, guaranteeType: 'NONE', guaranteePct: 0, warrantyMonths: base?.warrantyMonths ?? 12,
      creditDays: base?.creditDays ?? TX_TYPE[tx].credit, paymentMethod: base?.paymentMethod ?? 'Chuyển khoản', validDays: 30, note: editQuote?.note ?? '',
    };
  });
  const [form, setForm] = useState<ComposerForm>(initial);
  const [savedId, setSavedId] = useState<string | undefined>(editQuote?.id);
  const saved = quotes.find((q) => q.id === savedId);
  const lead = leads.find((x) => x.id === form.leadId);
  const versions = lead ? quotes.filter((q) => q.leadId === lead.id) : [];
  const [code] = useState(() => editQuote?.code ?? nextCode(quotes.map((q) => q.code), `BG-${year}-`, 4));
  const version = saved?.version ?? editQuote?.version ?? versions.reduce((m, x) => Math.max(m, x.version), 0) + 1;
  const locked = viewOnly || !!savedId;

  const set = <K extends keyof ComposerForm>(k: K, v: ComposerForm[K]) => setForm((p) => ({ ...p, [k]: v }));
  const setParty = (k: keyof ComposerForm['party'], v: string) => setForm((p) => ({ ...p, party: { ...p.party, [k]: v } }));

  const qTpl = docTemplates.find((t) => t.id === form.quoteTplId);
  const totals = docTotals(form);
  const seller = users.find((u) => u.id === lead?.assignee) ?? me;
  const { vars, flags } = buildDocVars(form, { company, quoteCode: code, contractCode: '', projectName: lead?.boqNote, projectCode: lead?.code, salesName: seller.name, salesPhone: seller.phone ?? company.phone, salesEmail: seller.email, skus });
  const html = qTpl ? renderTemplate(qTpl.body, vars, flags) : '<p>Chưa chọn mẫu báo giá</p>';
  const canSeeCost = canDo('price.viewCost');
  const costSum = form.items.reduce((a, l) => a + l.qty * (skus.find((s) => s.sku === l.sku)?.costPrice ?? 0), 0);
  const costKnown = form.items.length > 0 && form.items.every((l) => (skus.find((s) => s.sku === l.sku)?.costPrice ?? 0) > 0);
  const gm = costKnown && totals.sub > 0 ? ((totals.sub - costSum) / totals.sub) * 100 : null;
  const level = approvalOf(gm, totals.sub);
  const reasons = approvalReasons(gm, totals.sub);
  const errs: string[] = [];
  if (form.party.name.trim().length < 3) errs.push('Nhập tên khách hàng');
  if (!form.items.length) errs.push('Thêm ít nhất 1 dòng hàng hóa');
  const noName = form.items.map((l, i) => (!l.name.trim() ? i + 1 : 0)).filter(Boolean);
  const noPrice = form.items.map((l, i) => (l.qty <= 0 || l.price <= 0 ? i + 1 : 0)).filter(Boolean);
  if (noName.length) errs.push(`Dòng ${noName.slice(0, 5).join(', ')} chưa có tên hàng`);
  if (noPrice.length) errs.push(`Dòng ${noPrice.slice(0, 5).join(', ')}${noPrice.length > 5 ? '…' : ''} chưa có số lượng / đơn giá`);
  if (!qTpl) errs.push('Chọn mẫu báo giá');
  if (!lead && !form.customerId) errs.push('Chọn dự án hoặc khách hàng trong CRM để lưu báo giá');

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
      createdBy: me.id, createdAt: Date.now(),
      approval: level === 'AUTO' ? undefined : { status: 'PENDING', level, reasons, requestedAt: Date.now(), requestedBy: me.id },
    };
    setQuotes((p) => [q, ...p.map((x) => (lead && x.leadId === lead.id && x.status === 'SENT' ? { ...x, status: 'REVISED' as QuoteStatus } : x))]);
    // Tự học: hàng gõ tự do + đơn giá vào danh mục nháp để lần sau gợi ý kèm giá bán gần nhất
    setDraftProducts((all) => learnDrafts(all, form.items, skus, { quote: `${code} v${version}`, customer: form.party.name, by: me.id }));
    if (lead?.status === 'ACCEPTED') submitQuote(lead.id);
    setSavedId(q.id);
    if (q.approval) {
      const head = users.find((u) => u.id === departments.find((d) => d.code === lead?.dept)?.headId && u.active);
      const bods = users.filter((u) => u.active && u.role === 'BOD');
      dispatch('QUOTE_APPROVAL', { lead, toAll: level === 'BOD' ? bods : [head, ...bods].filter((u): u is User => !!u), title: `Báo giá chờ duyệt: ${form.party.name}`, body: `${code} v${version}, ${compact(totals.sub)}. ${reasons.join('; ')}` });
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
  const left = (
    <>
      {approval && (
        <div className={cn('rounded-md border p-3 text-sm', approval.status === 'APPROVED' ? 'border-[rgb(var(--success)/0.5)] bg-[rgb(var(--success)/0.1)] text-[rgb(var(--success-fg))]' : approval.status === 'PENDING' ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--danger)/0.5)] bg-[rgb(var(--danger)/0.1)] text-[rgb(var(--danger-fg))]')}>
          <p className="font-semibold">{approval.status === 'PENDING' ? `Chờ ${approval.level === 'BOD' ? 'BOD' : 'Trưởng phòng'} duyệt giá` : approval.status === 'APPROVED' ? 'Đã duyệt giá' : approval.status === 'NEED_INFO' ? 'Được yêu cầu bổ sung' : 'Bị từ chối'}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{approval.reasons.join('; ')}{approval.note ? `. Ghi chú: ${approval.note}` : ''}</p>
        </div>
      )}
      {locked && <p className="rounded border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-3 text-xs text-[rgb(var(--muted))]">Báo giá đã tạo chỉ xem và xuất lại. Muốn thay đổi giá, số lượng hoặc điều kiện, bấm "Báo giá điều chỉnh" để tạo phiên bản mới.</p>}
      <fieldset disabled={locked} className="min-w-0 space-y-4">
        <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2 [&>*:first-child]:min-w-0">
          <Field label="Mẫu báo giá">
            <select className={inputCls} value={form.quoteTplId} onChange={(e) => { const t = docTemplates.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, quoteTplId: e.target.value, txType: t?.txType ?? f.txType, contractTplId: t?.pairId ?? f.contractTplId })); }}>
              {docTemplates.filter((t) => t.kind === 'QUOTE').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Bảng giá">
            <select className={cn(inputBase, 'w-auto max-w-[130px]')} value={form.tier} onChange={(e) => applyTier(e.target.value as PriceTier)}>
              {(Object.keys(PRICE_TIER) as PriceTier[]).map((t) => <option key={t} value={t} disabled={t === 'BOQ' && !lead?.boqItems?.length}>{PRICE_TIER[t]}</option>)}
            </select>
          </Field>
          <Field label="VAT %"><input className={cn(inputBase, 'w-16 text-right tabular-nums')} type="number" min={0} max={10} value={form.vatPct} onChange={(e) => set('vatPct', Number(e.target.value))} /></Field>
        </div>

        <section>
          {secHead(1, 'Khách hàng')}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Field label="Khách hàng CRM">
              <select className={inputCls} value={form.customerId ?? ''} onChange={(e) => { const c = customers.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, customerId: c?.id, party: c ? partyOf(c) : f.party })); }}>
                <option value="">Chọn khách hàng</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Dự án">
              <select className={inputCls} value={form.leadId ?? ''} disabled={!!savedId} onChange={(e) => pickProject(e.target.value)}>
                <option value="">Không gắn dự án</option>
                {projectOpts.map((l) => <option key={l.id} value={l.id}>{l.company}: {l.boqNote}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-2">
            <Fold title="Thông tin pháp nhân trên báo giá" summary={[form.party.name, form.party.taxCode && `MST ${form.party.taxCode}`, form.party.phone].filter(Boolean).join(' · ') || 'Chưa có'} open={!form.party.name}>
              <PartyFields form={form} setParty={setParty} />
            </Fold>
          </div>
        </section>

        <section>
          {secHead(2, `Hàng hóa (${form.items.length} dòng)`)}
          <SmartQuoteGrid items={form.items} onChange={(v) => set('items', v)} locked={locked} tier={form.tier === 'BOQ' ? TX_TYPE[form.txType].tier : form.tier} wide={wide} onWide={setWide} canSeeCost={canSeeCost} />
          <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--line))] text-xs tabular-nums">
            <p className="bg-[rgb(var(--surface))] px-2 py-1.5 text-right"><span className="block text-[10px] text-[rgb(var(--muted))]">Cộng tiền hàng</span>{totals.sub.toLocaleString('vi-VN')}</p>
            <p className="bg-[rgb(var(--surface))] px-2 py-1.5 text-right"><span className="block text-[10px] text-[rgb(var(--muted))]">VAT {form.vatPct}%</span>{totals.vat.toLocaleString('vi-VN')}</p>
            <p className="bg-[rgb(var(--surface))] px-2 py-1.5 text-right font-semibold text-[rgb(var(--accent-fg))]"><span className="block text-[10px] font-normal text-[rgb(var(--muted))]">Tổng cộng (đ)</span>{totals.grand.toLocaleString('vi-VN')}</p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[rgb(var(--muted))]">
            <span className="ml-auto">{canSeeCost ? (gm !== null ? `Biên gộp ${gm.toFixed(1)}%` : 'Có hàng chưa có giá vốn (hàng nháp / thiếu giá vốn): chưa tính được GM') : ''}</span>
            {level !== 'AUTO' && <Chip tone={APPROVAL_LEVEL[level].tone}>{APPROVAL_LEVEL[level].label}</Chip>}
          </div>
          {!locked && reasons.length > 0 && <p className="mt-1 text-[11px] text-[rgb(var(--accent-fg))]">{reasons.join('; ')}. Bấm "Gửi duyệt" để chuyển cấp duyệt giá.</p>}
        </section>

        <section>
          {secHead(3, 'Điều khoản thanh toán')}
          <TermsFields form={form} set={set} contract={false} part="pay" />
          <div className="mt-2">
            <Fold title="Giao hàng, bảo hành, ghi chú" summary={`${form.delivery || 'Chưa nhập giao hàng'} · BH ${form.warrantyMonths} th`}>
              <TermsFields form={form} set={set} contract={false} part="other" />
            </Fold>
          </div>
        </section>
      </fieldset>
      {errs.length > 0 && !locked && <ul className="space-y-0.5 text-xs text-[rgb(var(--danger-fg))]">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
    </>
  );

  const canRevise = !!lead && ['ACCEPTED', 'QUOTED'].includes(lead.status);
  const canWin = !!savedId && !exportLocked && !!lead && lead.status === 'QUOTED' && canDo('project.update');
  const winHint = !lead ? 'Gắn báo giá với dự án để chốt đơn' : lead.status === 'WON' ? 'Dự án đã chốt' : !savedId ? 'Gửi duyệt báo giá trước' : exportLocked ? 'Chờ duyệt giá' : !canDo('project.update') ? 'Không có quyền chốt đơn' : `Chốt đơn theo báo giá ${code} v${version}`;
  const winNow = () => {
    if (!canWin || !lead || !savedId) return;
    winLead(lead.id, savedId);
    onClose();
  };
  return (
    <ComposerShell
      title={`${locked ? 'Báo giá' : 'Tạo báo giá'} ${code} v${version}`}
      wide={wide}
      subtitle={`${form.party.name || 'Khách hàng'}${lead ? `, dự án ${lead.code}` : ''}`}
      badge={saved ? <Chip tone={QUOTE_STATUS[saved.status].tone}>{QUOTE_STATUS[saved.status].label}</Chip> : undefined}
      left={left}
      html={html}
      onClose={onClose}
      footer={
        <DocActionBar
          status={<span className={cn('font-medium', locked ? 'text-[rgb(var(--success-fg))]' : errs.length ? 'text-[rgb(var(--danger-fg))]' : level === 'AUTO' ? 'text-[rgb(var(--muted))]' : 'text-[rgb(var(--accent-fg))]')}>{locked ? (exportLocked ? 'Đã gửi, chờ duyệt giá' : lead?.status === 'WON' ? 'Đơn đã chốt' : 'Đã duyệt, xuất file / chốt đơn được') : errs.length ? `Còn thiếu: ${errs[0]}` : level === 'AUTO' ? `Giá trong ngưỡng: gửi là tự duyệt, tạo bản v${version}` : `${APPROVAL_LEVEL[level].label}: gửi để duyệt giá`}</span>}
          extra={<>
            {locked && canRevise && <button className={cn(btnGhost, btnSm)} onClick={() => { onClose(); openComposer({ leadId: lead!.id, mode: 'QUOTE' }); }}><Pencil className="h-3.5 w-3.5" aria-hidden />Báo giá điều chỉnh</button>}
            {canDecide && (
              <>
                <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--success))] font-semibold text-[rgb(var(--on-accent))]')} onClick={() => decideQuote('APPROVED')}>Duyệt giá</button>
                <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger-fg))]')} onClick={() => { const n = window.prompt('Lý do từ chối / yêu cầu sửa giá'); if (n && n.trim().length >= 3) decideQuote('REJECTED', n.trim()); }}>Từ chối</button>
              </>
            )}
          </>}
          pdf={{ onClick: () => exportQuote('PDF'), disabled: !savedId || exportLocked, title: !savedId ? 'Gửi duyệt (lưu phiên bản) trước khi xuất' : exportLocked ? 'Chờ duyệt giá' : 'In / lưu PDF' }}
          word={{ onClick: () => exportQuote('WORD'), disabled: !savedId || exportLocked, title: !savedId ? 'Gửi duyệt (lưu phiên bản) trước khi xuất' : exportLocked ? 'Chờ duyệt giá' : 'Tải file Word (.doc)' }}
          win={{ onClick: winNow, disabled: !canWin, title: winHint }}
          submit={{ onClick: save, disabled: locked || errs.length > 0, label: locked ? 'Đã gửi' : undefined, title: locked ? 'Muốn đổi giá hoặc điều kiện: tạo báo giá điều chỉnh' : errs[0] ?? (level === 'AUTO' ? 'Lưu phiên bản, tự duyệt vì giá trong ngưỡng' : `Lưu phiên bản và gửi ${APPROVAL_LEVEL[level].label.replace('Cần ', '')}`) }}
        />
      }
    />
  );
}

