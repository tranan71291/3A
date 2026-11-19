'use client';

import { useState } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import { Modal } from '../../components/ui';
import { latestContracts } from '../../lib/business';
import { boqTotal, btnBase, btnGhost, btnPrimary, compact, fmtDate, GENDOC_STATUS, latestQuote, useApp, vnd } from '../../lib/core';
import { quoteTotals } from '../../lib/getfly';
import type { Lead, Quote } from '../../lib/types';
import { cn } from '../../lib/utils';

// =====================================================================
//  LUỒNG BÁN HÀNG MỘT NGUỒN DỮ LIỆU
//  BOQ (khối lượng kỹ thuật) -> Báo giá (dòng sản phẩm + giá + CK, có phiên bản)
//  -> Chốt đơn (chọn đúng 1 phiên bản báo giá) -> Đơn Getfly (lấy nguyên các dòng của phiên bản đó)
// =====================================================================

/** Chốt đơn: chọn phiên bản báo giá khách chấp nhận, xác nhận doanh số ghi nhận; sau đó tự soạn hợp đồng */
export function WinModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { leads, quotes, winLead, openComposer } = useApp();
  const lead = leads.find((l) => l.id === leadId);
  const list = quotes.filter((q) => q.leadId === leadId).sort((a, b) => b.version - a.version);
  /** Chỉ chốt theo báo giá có dòng hàng và đã qua duyệt giá (nếu cần duyệt) */
  const usable = (q: Quote) => q.lines.length > 0 && (!q.approval || q.approval.status === 'APPROVED');
  const [sel, setSel] = useState(() => (list.find((q) => q.status === 'SENT' && usable(q)) ?? list.find(usable))?.id ?? '');
  if (!lead) return null;
  const q = list.find((x) => x.id === sel);
  const t = q ? quoteTotals(q.lines, q.vatPct) : null;
  return (
    <Modal
      title={`Chốt đơn: ${lead.company}`}
      onClose={onClose}
      footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={cn(btnBase, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] px-3.5 py-2 font-medium text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)]')} disabled={!q} onClick={() => { winLead(lead.id, sel); onClose(); }}><CheckCircle2 className="h-4 w-4" aria-hidden />Xác nhận chốt đơn</button></>}
    >
      {!list.some((x) => x.lines.length) ? (
        <div className="space-y-3 text-sm">
          <p className="rounded bg-[rgb(var(--accent)/0.1)] p-3 text-[rgb(var(--accent-fg))]">Dự án chưa có báo giá có dòng sản phẩm. Cần tạo báo giá trước khi chốt đơn.</p>
          <button className={btnPrimary} onClick={() => { onClose(); openComposer({ leadId, mode: 'QUOTE' }); }}><FileText className="h-4 w-4" aria-hidden />Tạo báo giá ngay</button>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-medium text-[rgb(var(--muted))]">Phiên bản báo giá khách chốt</legend>
            {list.map((x) => (
              <label key={x.id} className={cn('flex cursor-pointer items-center gap-3 rounded border px-3 py-2.5 text-sm', !usable(x) && 'cursor-not-allowed opacity-50', sel === x.id ? 'border-[rgb(var(--success))] bg-[rgb(var(--success)/0.1)]' : 'border-[rgb(var(--line))] hover:bg-[rgb(var(--raised))]')}>
                <input type="radio" name="won-quote" className="accent-[rgb(var(--success))]" disabled={!usable(x)} checked={sel === x.id} onChange={() => setSel(x.id)} />
                <span className="min-w-0 flex-1"><b>{x.code}</b> <span className="text-[rgb(var(--muted))]">v{x.version}, {fmtDate(x.date)}, {x.lines.length} dòng{x.approval && x.approval.status !== 'APPROVED' ? (x.approval.status === 'PENDING' ? ', chờ duyệt giá' : ', bị từ chối giá') : ''}</span></span>
                <span className="tabular-nums">{compact(x.amount)}</span>
              </label>
            ))}
          </fieldset>
          {t && (
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded bg-[rgb(var(--raised))] p-3"><p className="text-xs text-[rgb(var(--muted))]">Doanh số trước VAT</p><p className="mt-1 font-semibold tabular-nums text-[rgb(var(--success-fg))]">{vnd(t.sub)}</p></div>
              <div className="rounded bg-[rgb(var(--raised))] p-3"><p className="text-xs text-[rgb(var(--muted))]">VAT {q?.vatPct}%</p><p className="mt-1 font-semibold tabular-nums">{vnd(t.vat)}</p></div>
              <div className="rounded bg-[rgb(var(--raised))] p-3"><p className="text-xs text-[rgb(var(--muted))]">Sau VAT</p><p className="mt-1 font-semibold tabular-nums">{vnd(t.gross)}</p></div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Sơ đồ dữ liệu của một dự án: BOQ -> Báo giá -> Chốt đơn -> Getfly */
export function ProjectFlow({ lead }: { lead: Lead }) {
  const { quotes, genDocs } = useApp();
  const lq = latestQuote(lead.id, quotes);
  const won = quotes.find((q) => q.id === lead.wonQuoteId);
  const contract = latestContracts(genDocs.filter((d) => d.leadId === lead.id))[0];
  const contractDone = !!contract && (contract.status === 'ISSUED' || contract.status === 'APPROVED');
  const steps: { title: string; value: string; done: boolean }[] = [
    { title: 'BOQ', value: lead.boqItems?.length ? `${lead.boqItems.length} dòng, ${compact(boqTotal(lead))}` : `Ước tính ${compact(lead.boqValue)}`, done: !!lead.boqItems?.length },
    { title: 'Báo giá', value: lq ? `${lq.code} v${lq.version}` : 'Chưa tạo', done: !!lq },
    { title: 'Chốt đơn', value: won ? compact(won.amount) : lead.status === 'LOST' ? 'Trượt' : 'Chưa chốt', done: !!won },
    { title: 'Hợp đồng', value: contract ? (contractDone ? contract.contractCode : `${GENDOC_STATUS[contract.status].label} ${contract.contractCode}`) : 'Chưa tạo', done: contractDone },
  ];
  return (
    <ol className="flex items-start" aria-label="Tiến độ dự án">
      {steps.map((s, i) => (
        <li key={s.title} className="flex min-w-0 flex-1 flex-col items-center text-center">
          <div className="flex w-full items-center">
            <span className={cn('h-0.5 flex-1', i === 0 ? 'opacity-0' : steps[i - 1].done ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--line))]')} />
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold', s.done ? 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] text-[rgb(var(--fg))]' : 'border border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-[rgb(var(--muted))]')}>{s.done ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : i + 1}</span>
            <span className={cn('h-0.5 flex-1', i === steps.length - 1 ? 'opacity-0' : s.done ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--line))]')} />
          </div>
          <p className={cn('mt-1 text-xs font-medium', s.done ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--fg))]')}>{s.title}</p>
          <p className="w-full truncate px-1 text-[11px] text-[rgb(var(--muted))]">{s.value}</p>
        </li>
      ))}
    </ol>
  );
}

