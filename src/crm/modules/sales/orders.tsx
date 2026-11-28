'use client';

import { createContext, type CSSProperties, type KeyboardEvent as ReactKeyEvent, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowLeft, BadgeCheck, Banknote, Building2, CalendarDays, Check as CheckIcon, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Coins, Columns3, Download, Eye, FileText, Filter, Inbox, Lock, Mail, MoreVertical, Package, PackageMinus, Paperclip, Pencil, Plus, Printer, Receipt as ReceiptIcon, Search, Send, ShoppingCart, Trash2, Truck, Undo2, Upload, User as UserIcon, UserPlus, Users, Wallet, Warehouse, X, XCircle } from 'lucide-react';
import { TaxPortalLink, TaxResultCard, TaxStrip, taxTime, useTaxLookup, type TaxState } from '../../components/kit/tax-lookup';
import { AddNamePop } from '../../components/kit/add-name-pop';
import { TAX_FORMAT_HINT, taxKind, taxNorm, textSame } from '../../lib/taxcode';
import { apiPost, useServerStatus } from '../ai/ai-core';
import { removeWithUndo } from '../../app/context';
import { RowMenu } from '../../components/controls';
import { WorkflowStepper } from '../../components/kit/status';
import { StatusBar, StatusChecklist, stEffective, stMatch, type StatusOpt } from '../../components/kit/status-filter';
import { Drawer } from '../../components/drawer';
import { Chip, Code, EmptyState, Field, MoneyInput, useSticky, useUserPref } from '../../components/ui';
import { invoiceView } from '../../lib/accounting';
import { cloudMessage } from '../../lib/cloud';
import { ATTACH_PREFIX, attachPath, cloud, CLOUD_ON, CloudError, openAttachment, addDaysISO, bizMode, btnBase, btnGhost, btnPrimary, btnSm, CF_FILTERABLE, cfEmpty, cfMissing, cfSet, compact, custContacts, custEmail, custPhone, DECISION_LABEL, digits, EMAIL_RE, downloadBlob, esc, fmtDate, fmtN, fold, inputBase, inputCls, iso, lCondOk, lFieldOrder, lSaleAvail, lSaleSections, lFill, lIsCore, LPageC, lStageOf, lStarterSale, MAIN_WH, nextCode, overdueDays, PRICE_TIER, readAsDataUrl, REGION_LABEL, SALE_DELIVERY, SALE_F0, SALE_PAY, ROLE_LABEL, SALE_STAGE, SALE_STATUS, saleCashOf, saleDefaultsOf, saleOriginsOf, saleDue, saleGoodsBack, saleIssQ, saleIssued, saleLineNet, saleOwed, salePaid, saleRetQ, SEGMENT_LABEL, SO_LINE_F, SO_LIST_TABS, SO_SEARCH, SO_SEARCH_DEF, soGrid, soIco, soTd, soTh, soTime, TIER, tierPrice, todayISO, uid, useApp, wfNeeds, wfReasons, whQty, WO_STAGE } from '../../lib/core';
import { downloadCsv, xlsxBlob } from '../../lib/csv';
import { saleCostEst, saleDirectCost, saleHeld, saleNetRevenue, salePendingQ, saleReturned, saleStage, saleStock, saleTotals } from '../../lib/getfly';
import type { ApprovalDecision, CfVal, CompanyInfo, Customer, LBlock, LBlockCfg, LBlockType, LDevice, LIconAct, LPageCtx, PriceTier, SaleDelivery, SaleFile, SaleFilter, SaleInvBuyer, SaleInvItem, SaleLine, SaleLineKind, SaleNote, SalePay, SalePayExtra, SalePayment, SalePer, SalePick, SalesOrder, SaleStage, SaleStatus, SaleTab, SkuItem, SoStep, StockVoucher, User, VoucherStatus, WfSubject, WorkOrder } from '../../lib/types';
import { cn, wfApprovers, wfPath } from '../../lib/utils';
import { compressImage, stockOf } from '../../lib/workshop';
import { SearchBox } from '../alux/orders';
import { useArItems } from '../finance/ar-aging';
import { CfInput, cfText, DynamicFieldRenderer, lActCommonRun, lBindOrder, LBusinessView, lCommonNode, lVars, useMinW, useSaleCf, useSaleFormLayout, useNameOf, useSaleHeadDefs, useTenantLayout, VerticalBlock } from '../page-builder';
import { docPdfBlob, docShell, moneyToWordsVN, printHtml } from './templates';
import { cfCompute, resourceConflicts, useTerminology } from '../../lib/industry';
import { useApprovalQueue } from '../tasks/tasks';

/** Bản in phiếu bán hàng */
export function saleHtml(o: SalesOrder, company: CompanyInfo) {
  const t = saleTotals(o);
  const rows = o.lines.map((l, i) => `<tr><td class="c">${i + 1}</td><td>${esc(l.name)}${l.note ? `<br><span class="small">${esc(l.note)}</span>` : ''}</td><td class="c">${esc(l.unit)}</td><td class="r">${fmtN(l.qty)}</td><td class="r">${fmtN(l.price)}</td><td class="r">${l.discountPct ? `${l.discountPct}%` : ''}</td><td class="c">${l.vat}%</td><td class="r">${fmtN(saleLineNet(l))}</td></tr>`).join('');
  const tax = t.groups.filter((g) => g.rate > 0).map((g) => `<tr><td colspan="7" class="r">Thuế GTGT ${g.rate}%</td><td class="r">${fmtN(g.vat)}</td></tr>`).join('');
  return `<p><b>${esc(company.legalName)}</b><br>${esc(company.address)}${company.taxCode ? `<br>MST: ${esc(company.taxCode)}` : ''}${company.phone ? ` · ĐT: ${esc(company.phone)}` : ''}</p>
<h1>PHIẾU BÁN HÀNG</h1><p class="c">Số ${esc(o.code)} · ngày ${fmtDate(o.date)}</p>
<p>Khách hàng: <b>${esc(o.customer)}</b>${o.taxCode ? `<br>MST: ${esc(o.taxCode)}` : ''}${o.phone ? `<br>Điện thoại: ${esc(o.phone)}` : ''}${o.address ? `<br>Địa chỉ: ${esc(o.address)}` : ''}</p>
<table class="items"><thead><tr><th>STT</th><th>Hàng hóa</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>CK</th><th>VAT</th><th>Thành tiền</th></tr></thead><tbody>${rows}
<tr><td colspan="7" class="r">Cộng tiền hàng</td><td class="r">${fmtN(t.net)}</td></tr>${tax}${t.ship ? `<tr><td colspan="7" class="r">Phí giao hàng</td><td class="r">${fmtN(t.ship)}</td></tr>` : ''}
<tr><td colspan="7" class="r"><b>Tổng thanh toán</b></td><td class="r"><b>${fmtN(t.grand)}</b></td></tr></tbody></table>
<p><b>Bằng chữ:</b> <i>${moneyToWordsVN(t.grand)}</i></p>
<p>Thanh toán: ${SALE_PAY[o.pay]}${o.pay === 'CREDIT' ? `, hạn ${fmtDate(saleDue(o))}` : ''} · Giao nhận: ${SALE_DELIVERY[o.delivery]}${o.deliverAt ? `, ${fmtDate(o.deliverAt)}` : ''}</p>
<table class="layout sign"><tr><td><b>NGƯỜI MUA HÀNG</b><br>(Ký, ghi rõ họ tên)<br><br><br><br></td><td><b>NGƯỜI BÁN HÀNG</b><br>(Ký, ghi rõ họ tên)<br><br><br><br></td></tr></table>`;
}

/** v50: đóng khung nổi khi bấm ra ngoài */
export function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(close);
  cb.current = close;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb.current(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') cb.current(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return ref;
}

/**
 * v60: tải tệp của đơn (dùng ở form tạo đơn và chi tiết đơn).
 * Có máy chủ: tải ngay lên kho riêng tư 'crm-attach' (<doanh nghiệp>/sales/<mã đơn>/...), đơn chỉ giữ đường dẫn.
 * Chạy không máy chủ (dữ liệu trên máy): ảnh nén / tệp nhỏ giữ base64 như trước.
 */
export async function uploadSaleFiles(orgId: string, saleId: string, files: File[], by: string | undefined, notify: (m: string, tone?: 'teal' | 'red' | 'orange') => void): Promise<SaleFile[]> {
  const out: SaleFile[] = [];
  const maxMb = CLOUD_ON ? 10 : 2;
  for (const f of files) {
    const img = f.type.startsWith('image/');
    if (!img && f.size > maxMb * 1024 * 1024) { notify(`${f.name} lớn hơn ${maxMb} MB, chưa tải lên`, 'orange'); continue; }
    try {
      if (CLOUD_ON) {
        const blob: Blob = img ? await (await fetch(await compressImage(f, 1600))).blob() : f;
        const up = await cloud.uploadAttachment(orgId, `sales/${saleId}`, blob, img ? '' : f.name);
        out.push({ id: uid('sf'), name: f.name, url: `${ATTACH_PREFIX}${up.path}`, path: up.path, size: blob.size, type: up.mimeType, mimeType: up.mimeType, at: Date.now(), by });
        continue;
      }
      const url = img ? await compressImage(f, 1600) : await readAsDataUrl(f);
      out.push({ id: uid('sf'), name: f.name, url, size: img ? Math.round(url.length * 0.75) : f.size, type: f.type || 'application/octet-stream', at: Date.now(), by });
    } catch (e) { notify(e instanceof CloudError ? cloudMessage(e) : `Không đọc được ${f.name}`, 'red'); }
  }
  return out;
}

/** v60: dải đầu trang đơn hàng (tạo / chi tiết): biểu tượng, đường dẫn, tiêu đề + nút thao tác bên phải */
export function SoBand({ crumb, onCrumb, title, chips, children }: { crumb: string; onCrumb?: () => void; title?: ReactNode; chips?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-xl border-b border-[rgb(var(--secondary)/0.14)] bg-[rgb(var(--secondary)/0.06)] px-5 py-3" data-so-band>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[rgb(var(--navy))] text-white" aria-hidden><ShoppingCart className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <nav aria-label="Đường dẫn" className="text-[13px] text-[rgb(var(--secondary-fg))]">{onCrumb ? <button className="hover:underline" onClick={onCrumb}>{crumb}</button> : crumb}</nav>
        {(title || chips) && <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2">{title && <h1 className="truncate text-[19px] font-bold text-[rgb(var(--accent-fg))]" style={{ ...HB, fontFamily: "'Archivo','Be Vietnam Pro',system-ui,sans-serif" }}>{title}</h1>}{chips}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Thanh tiêu đề trang đơn hàng: đường dẫn + nút thao tác */
export function SoTop({ crumb: crumb0, title, onCrumb, chips, children }: { crumb?: string; title: ReactNode; onCrumb?: () => void; chips?: ReactNode; children?: ReactNode }) {
  // v56: đường dẫn "Quản lý đơn hàng" đổi theo thuật ngữ ngành (VD "Quản lý lệnh sản xuất & lắp đặt")
  const { t } = useTerminology();
  const crumb = crumb0?.replace(/^Quản lý đơn hàng/, t('saleList'));
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      {crumb && <button className="text-[14px] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={onCrumb}>{crumb} ›</button>}
      <h1 className="text-[19px] font-medium">{title}</h1>
      {chips}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** v60: trang chi tiết đơn là một phiếu liền: khối không có khung thẻ riêng; cột phải (side) tiêu đề chữ hoa nhỏ in đậm */
export const SoZoneC = createContext<'card' | 'main' | 'side'>('card');
export const soSideH = 'text-[12.5px] font-bold uppercase tracking-[0.03em]';
/** Kiểu chung h1, h2 của ứng dụng đặt font-weight 500 (ngoài lớp tiện ích) — tiêu đề in đậm của phiếu đặt trực tiếp */
export const HB = { fontWeight: 700 } as const;

export function SoCard({ title, sub, action, children, pad = true, className }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; pad?: boolean; className?: string }) {
  const zone = useContext(SoZoneC);
  if (zone !== 'card') return (
    <section className={cn('min-w-0', className)} data-so-sec>
      {(title || action) && <div className="mb-2.5 flex flex-wrap items-center gap-2">{title && <h2 className={zone === 'side' ? soSideH : 'text-[14.5px] font-bold'} style={HB}>{title}</h2>}{sub && <span className="text-[12.5px] text-[rgb(var(--muted))]">{sub}</span>}{action && <span className="ml-auto flex items-center gap-2">{action}</span>}</div>}
      {children}
    </section>
  );
  return (
    <section className={cn('glass-card min-w-0 rounded-xl', pad && 'p-5', className)}>
      {(title || action) && <div className={cn('flex flex-wrap items-center gap-2', pad ? 'mb-3' : 'px-5 pb-3 pt-4')}>{title && <h2 className="text-[15px] font-medium">{title}</h2>}{sub && <span className="text-[12.5px] text-[rgb(var(--muted))]">{sub}</span>}{action && <span className="ml-auto flex items-center gap-2">{action}</span>}</div>}
      {children}
    </section>
  );
}

export function SoInfo({ label, children, span = 1 }: { label: string; children: ReactNode; span?: 1 | 2 | 4 }) {
  return (
    <div className={cn('min-w-0', span === 2 && 'sm:col-span-2', span === 4 && 'sm:col-span-2 xl:col-span-4')}>
      <p className="mb-1 text-[12.5px] text-[rgb(var(--muted))]">{label}</p>
      <div className="flex min-h-7 min-w-0 items-center gap-1.5 truncate text-[14px]">{children}</div>
    </div>
  );
}

/** Tab gạch chân (Hàng hóa / Chứng từ liên quan) */
export function SoTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex h-12 items-stretch gap-6" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={cn('-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px] font-medium', value === t.id ? 'border-[rgb(var(--accent))] text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>
          {t.label}{t.count !== undefined && <span className="rounded-full bg-[rgb(var(--ink)/0.06)] px-1.5 text-[11px] font-normal tabular-nums text-[rgb(var(--fg2))]">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Dòng thời gian quy trình ở cột phải. v59: dùng WorkflowStepper dọc của bộ giao diện lõi (Xong / Đang làm / Vướng / Song song) */
export function SoFlow({ steps, label = 'Quy trình' }: { steps: SoStep[]; label?: string }) {
  return (
    <WorkflowStepper orientation="vertical" label={label}
      steps={steps.map((s, i) => ({ key: `${i}-${s.label}`, label: s.label, at: s.at, sub: s.sub, meta: s.chip, state: s.state === 'now' ? 'current' : s.state === 'side' ? 'parallel' : s.state }))} />
  );
}

export function SoKv({ label, children, big, tone }: { label: string; children: ReactNode; big?: boolean; tone?: 'warn' }) {
  return <div className={cn('flex items-baseline justify-between gap-3 py-1 text-[13.5px]', big && 'mt-1 border-t border-[rgb(var(--line))] pt-2')}><span className="text-[rgb(var(--muted))]">{label}</span><span className={cn('tabular-nums', big && 'text-[20px] font-medium', tone === 'warn' && 'font-medium text-[rgb(var(--accent-fg))]')}>{children}</span></div>;
}

export function SoBar({ parts }: { parts: { pct: number; cls: string }[] }) {
  return <div className="flex h-1.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.07)]">{parts.map((p, i) => <i key={i} className={p.cls} style={{ width: `${Math.max(0, Math.min(100, p.pct))}%` }} />)}</div>;
}

/** Công nợ khách: đang nợ (+ đơn đang lập) so với hạn mức, quá hạn */
export function SoDebt({ customerId, extra = 0, exceptId, box }: { customerId?: string; extra?: number; exceptId?: string; /** v60: khung gọn trong form tạo đơn (thay thẻ cột phải) */ box?: boolean }) {
  const { customers, salesOrders } = useApp();
  const ar = useArItems();
  const c = customers.find((x) => x.id === customerId);
  // v61: khách lẻ hoặc khách không có công nợ thì không hiện khối công nợ
  if (!c || !ar.some((x) => x.customerId === c.id && x.outstanding > 0)) return null;
  if (box) {
    const mine = c ? ar.filter((x) => x.customerId === c.id && x.outstanding > 0) : [];
    const owe = mine.reduce((s, x) => s + x.outstanding, 0);
    const odSum = mine.filter((x) => overdueDays(x.dueDate, todayISO()) > 0).reduce((s, x) => s + x.outstanding, 0);
    const lim = c?.creditLimit ?? 0;
    return (
      <div className="mt-4 rounded-xl border border-[rgb(var(--line))] px-4 py-3" data-so-debt>
        <div className="flex items-baseline justify-between gap-3 text-[13.5px]"><b className="font-bold">{extra ? 'Công nợ khách sau đơn' : 'Công nợ khách'}</b><b className="font-semibold tabular-nums">{!c ? '—' : `${compact(owe + extra)}${lim > 0 ? ` / ${compact(lim)}` : ''}`}</b></div>
        {c && lim > 0 && <div className="mt-2"><SoBar parts={[{ pct: (owe / lim) * 100, cls: 'bg-[rgb(var(--fg))]' }, { pct: (extra / lim) * 100, cls: 'bg-[rgb(var(--accent))]' }]} /></div>}
        <p className={cn('mt-1.5 text-[12px]', owe + extra > lim && lim > 0 ? 'font-medium text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')}>{!c ? 'Khách lẻ, không theo dõi công nợ' : `Đang nợ ${compact(owe)}${extra ? ` · đơn này ${compact(extra)}` : ''}${lim > 0 ? ` · hạn mức ${compact(lim)}${owe + extra > lim ? ` · vượt ${compact(owe + extra - lim)}` : ''}` : ''}${odSum > 0 ? ` · quá hạn ${compact(odSum)}` : ''}`}</p>
      </div>
    );
  }
  const mine = ar.filter((x) => x.customerId === c.id && x.outstanding > 0);
  const owe = mine.reduce((s, x) => s + x.outstanding, 0);
  const today = todayISO();
  const od = mine.filter((x) => overdueDays(x.dueDate, today) > 0);
  const odSum = od.reduce((s, x) => s + x.outstanding, 0);
  const odDays = Math.max(0, ...od.map((x) => overdueDays(x.dueDate, today)));
  const lim = c.creditLimit;
  const others = salesOrders.filter((o) => o.customerId === c.id && o.id !== exceptId && o.status !== 'CANCELLED').length;
  return (
    <SoCard title="Công nợ khách">
      <div className="flex items-baseline justify-between text-[13px]"><span className="text-[rgb(var(--muted))]">{extra ? 'Đang nợ + đơn này' : 'Đang nợ'}{lim > 0 ? ' / hạn mức' : ''}</span><span className="tabular-nums">{compact(owe + extra)}{lim > 0 ? ` / ${compact(lim)}` : ''}</span></div>
      {lim > 0 && <div className="mt-1.5"><SoBar parts={[{ pct: (owe / lim) * 100, cls: 'bg-[rgb(var(--fg))]' }, { pct: (extra / lim) * 100, cls: 'bg-[rgb(var(--accent)/0.55)]' }]} /></div>}
      <div className="mt-2">
        <SoKv label="Đang nợ">{fmtN(owe)}</SoKv>
        <SoKv label="Quá hạn" tone={odSum > 0 ? 'warn' : undefined}>{odSum > 0 ? `${fmtN(odSum)} · ${odDays} ngày` : '0'}</SoKv>
        {lim > 0 ? <SoKv label={extra ? 'Hạn mức còn lại sau đơn' : 'Hạn mức còn lại'} tone={owe + extra > lim ? 'warn' : undefined}>{fmtN(lim - owe - extra)}</SoKv> : <SoKv label="Đơn khác">{others}</SoKv>}
      </div>
    </SoCard>
  );
}

/** Các bước quy trình của đơn (dùng ở tạo đơn, chi tiết đơn) */
export function soSteps(o: SalesOrder, stage: SaleStage, vs: StockVoucher[], users: User[], draft?: { needs: boolean; reasons: string[] }): SoStep[] {
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const t = saleTotals(o);
  const due = t.grand - saleReturned(o);
  const paid = salePaid(o);
  const units = o.lines.filter((l) => l.kind !== 'FREE');
  const all = units.reduce((s, l) => s + l.qty, 0);
  const done = units.reduce((s, l) => s + saleIssQ(o, l), 0);
  const outs = vs.filter((v) => v.type === 'OUT' && v.status !== 'CANCELLED');
  const invDone = (o.invReqs ?? []).filter((r) => r.status === 'DONE');
  const invAmt = invDone.reduce((s, r) => s + r.amount, 0);
  if (draft) return [
    { label: 'Tạo đơn', at: 'đang soạn', sub: nm(o.by), state: 'now' },
    { label: 'Duyệt đơn', chip: draft.needs ? <Chip tone="orange">cần duyệt</Chip> : undefined, sub: draft.needs ? draft.reasons.join('; ') : 'người lên đơn bấm duyệt', state: 'todo' },
    { label: 'Thu tiền', sub: 'kế toán lập phiếu thu, ghi nhận doanh thu', state: 'todo' },
    { label: 'Yêu cầu xuất kho', state: 'todo' },
    { label: 'Kho xuất', sub: 'một phần hoặc toàn bộ', state: 'todo' },
    { label: 'Hoàn thành', state: 'todo' },
  ];
  const appr = o.approval;
  const cancelled = stage === 'CANCELLED';
  return [
    { label: 'Tạo đơn', at: soTime(o.createdAt), sub: nm(o.by), state: 'done' },
    { label: 'Duyệt đơn', at: appr?.decidedAt ? soTime(appr.decidedAt) : undefined, sub: !appr ? 'tự duyệt' : appr.status === 'PENDING' ? appr.reasons.join('; ') : `${nm(appr.decidedBy)}${appr.note ? ` · ${appr.note}` : ''}`, chip: appr?.status === 'PENDING' ? <Chip tone="orange">chờ duyệt</Chip> : appr?.status === 'REJECTED' ? <Chip tone="red">không duyệt</Chip> : undefined, state: stage === 'REJECTED' ? 'blocked' : stage === 'APPROVAL' ? 'now' : 'done' },
    { label: 'Xuất kho', chip: all > 0 && done > 0 && done < all ? <Chip tone="blue">{fmtN(done)} / {fmtN(all)}</Chip> : undefined, sub: outs.length ? outs.map((v) => `${v.code} ${v.status === 'DONE' ? 'đã xuất' : 'chờ kho'}`).join(' · ') : stage === 'READY' ? 'chưa gửi yêu cầu' : undefined, state: stage === 'DONE' || stage === 'SHIPPING' || (all > 0 && done >= all) ? 'done' : stage === 'READY' || stage === 'WAIT_WH' || stage === 'PARTIAL' ? 'now' : 'todo' },
    ...(o.invoice ? [{ label: 'Hóa đơn thuế', at: 'song song', sub: invDone.length ? `${invDone.map((r) => r.no).join(', ')} · ${compact(invAmt)} / ${compact(due)}` : (o.invReqs ?? []).some((r) => r.status === 'PENDING') ? 'chờ kế toán xuất' : 'chưa yêu cầu', state: invAmt >= due && due > 0 ? 'done' as const : 'side' as const }] : []),
    { label: 'Thanh toán', at: 'song song', sub: `đã thu ${compact(paid)} / ${compact(due)}${o.creditDays && o.issuedAt ? ` · hạn ${fmtDate(saleDue(o)).slice(0, 5)}` : ''}`, state: paid >= due && due > 0 ? 'done' : 'side' },
    { label: cancelled ? 'Đã hủy' : 'Hoàn thành', sub: cancelled ? o.cancelReason : stage === 'DONE' ? undefined : 'khi kho xuất đủ', state: stage === 'DONE' || cancelled ? 'done' : 'todo' },
  ];
}

/** v50: quyền thao tác trên đơn: người lên đơn với đơn của mình; Giám đốc / người có quyền "Bán hàng: sửa, hủy, xóa đơn" với mọi đơn */
export function useSaleRights() {
  const { me, canDo, stockVouchers, setStockVouchers, setSalesOrders, setSaleStatus, notify, postCash, users, dispatch, cashEntries, setInvoiceRequests } = useApp();
  const mgr = canDo('sale.manage');
  // v55.2: bắt buộc khi duyệt theo định nghĩa trường + yêu cầu đặt riêng trong bố cục Form lên đơn
  const headDefs = useSaleHeadDefs();
  const del = canDo('sale.delete');
  const docs = canDo('sale.docs');
  const own = (o: SalesOrder) => !!me && o.by === me.id;
  const issued = (o: SalesOrder) => o.lines.some((l) => saleIssQ(o, l) > 0);
  const pendOut = (o: SalesOrder) => stockVouchers.filter((v) => v.saleId === o.id && v.type === 'OUT' && v.status === 'PENDING');
  const decide = (o: SalesOrder, st: ApprovalDecision, note?: string) => setSalesOrders((all) => all.map((x) => (x.id === o.id && x.approval ? { ...x, approval: { ...x.approval, status: st, decidedBy: me?.id, decidedAt: Date.now(), note } } : x)));
  return {
    mgr,
    canEdit: (o: SalesOrder) => o.status === 'PENDING' && !issued(o) && !pendOut(o).length && (own(o) || mgr),
    canCancel: (o: SalesOrder) => o.status !== 'CANCELLED' && (own(o) || mgr),
    /** Đủ điều kiện hủy: hàng đã xuất nhập trả hết, tiền đã thu hoàn hết, không còn phiếu thu chờ */
    cancelReady: (o: SalesOrder) => saleGoodsBack(o) && salePaid(o) === 0 && o.payments.every((p) => p.confirmed),
    canDelete: (o: SalesOrder) => del && !issued(o) && !o.payments.some((p) => p.confirmed),
    delWhy: (o: SalesOrder) => (!del ? 'chưa có quyền xóa' : issued(o) ? 'đã xuất kho, dùng Hủy đơn' : o.payments.some((p) => p.confirmed) ? 'đã có phiếu thu, dùng Hủy đơn' : ''),
    canInfo: (o: SalesOrder) => o.status !== 'CANCELLED' && (own(o) || mgr || canDo('sale.info')),
    canDocs: () => docs,
    canSelf: (o: SalesOrder) => !!o.approval?.self && o.approval.status === 'PENDING' && o.status === 'PENDING' && ((own(o) && canDo('sale.approve')) || mgr),
    canVoidPay: () => docs,
    selfApprove: (o: SalesOrder) => { const miss = cfMissing(headDefs, o.cf, 'APPROVE'); if (miss.length) { notify(`${o.code} thiếu ${miss.map((d) => d.label).join(', ')}: cập nhật thông tin đơn trước khi duyệt`, 'red'); return; } decide(o, 'APPROVED'); notify(`Đã duyệt ${o.code}. Bấm Yêu cầu xuất kho khi cần giao hàng`, 'teal'); },
    selfReject: (o: SalesOrder, note: string) => { decide(o, 'REJECTED', note); setSaleStatus(o.id, 'CANCELLED', `Không duyệt: ${note}`); },
    cancelOrder: (o: SalesOrder, why: string) => {
      const ps = pendOut(o);
      if (ps.length) setStockVouchers((all) => all.map((v) => (ps.some((p) => p.id === v.id) ? { ...v, status: 'CANCELLED' as VoucherStatus, cancelledBy: me?.id, cancelReason: `Hủy đơn ${o.code}: ${why}` } : v)));
      if ((o.invReqs ?? []).some((r) => r.status === 'PENDING')) {
        setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, invReqs: (x.invReqs ?? []).map((r) => (r.status === 'PENDING' ? { ...r, status: 'REJECTED' as const, why: 'Đơn đã hủy', doneBy: me?.id, doneAt: Date.now() } : r)) } : x)));
        // v58: bảng yêu cầu xuất hóa đơn
        setInvoiceRequests((all) => all.map((r) => (r.saleId === o.id && r.status === 'PENDING' ? { ...r, status: 'REJECTED' as const, reason: 'Đơn đã hủy', decidedBy: me?.id, decidedAt: Date.now() } : r)));
      }
      setSaleStatus(o.id, 'CANCELLED', why);
      const u = users.find((x) => x.id === o.by);
      if (u && u.id !== me?.id) dispatch('APPROVAL_RESULT', { to: u, title: `Đơn ${o.code} đã hủy`, body: why, module: 'sales' });
    },
    remove: (o: SalesOrder) => {
      const ps = pendOut(o);
      if (ps.length) setStockVouchers((all) => all.map((v) => (ps.some((p) => p.id === v.id) ? { ...v, status: 'CANCELLED' as VoucherStatus, cancelledBy: me?.id, cancelReason: `Xóa đơn ${o.code}` } : v)));
      removeWithUndo(setSalesOrders, o, notify, `Đã xóa đơn ${o.code}${ps.length ? `, hủy ${ps.map((p) => p.code).join(', ')}` : ''}`);
    },
    /** Hủy phiếu thu: bỏ khỏi đơn; phiếu đã vào quỹ thì sinh phiếu đảo (giữ lịch sử sổ quỹ) */
    voidPay: (o: SalesOrder, p: SalePayment, code?: string) => {
      setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, payments: x.payments.filter((y) => y.id !== p.id) } : x)));
      const orig = saleCashOf(cashEntries, p.id);
      if (p.confirmed) postCash({ kind: p.refund ? 'IN' : 'OUT', account: p.method === 'CASH' ? 'CASH' : 'BANK', category: p.refund ? 'Hủy phiếu hoàn tiền bán hàng' : 'Hủy phiếu thu bán hàng', amount: Math.abs(p.amount), partner: o.customer, ref: orig?.code ?? o.code, note: `Hủy ${code ?? 'phiếu thu'} của đơn ${o.code}`, source: 'SALE', sourceId: `${p.id}-void`, reverses: orig?.id, saleId: o.id });
      notify(`Đã hủy ${code ?? 'phiếu thu'} của ${o.code}${p.confirmed ? ', đã sinh phiếu đảo trong sổ quỹ' : ''}`, 'orange');
    },
  };
}

export function SalesModule() {
  const ctx = useApp();
  const { salesOrders, openSale, setOpenSale, canDo } = ctx;
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [sub, setSub] = useState<{ kind: 'approve' | 'pay'; id: string; reject?: boolean } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const open = openSale ? salesOrders.find((o) => o.id === openSale) : undefined;
  useEffect(() => { window.scrollTo({ top: 0 }); }, [openSale, mode]);
  const { todo } = useApprovalQueue();
  if (open && !ctx.mySales.some((o) => o.id === open.id) && !todo.some((t) => t.refId === open.id) && !ctx.canDo('stock.approve') && ctx.me?.role !== 'BOD') return (
    <div className="glass-card mx-auto mt-10 max-w-md rounded-xl p-6 text-center"><Lock className="mx-auto h-6 w-6 text-[rgb(var(--muted))]" aria-hidden /><p className="mt-2 font-medium">Đơn {open.code} ngoài phạm vi xem của bạn</p><p className="mt-1 text-[13px] text-[rgb(var(--muted))]">Giám đốc cấp phạm vi ở Cài đặt › Phân quyền</p><button className={cn(btnGhost, 'mt-4')} onClick={() => setOpenSale(null)}>Về danh sách</button></div>
  );
  const editO = editId ? salesOrders.find((o) => o.id === editId) : undefined;
  if (editO) return <SaleForm key={editO.id} edit={editO} onDone={(id) => { setEditId(null); if (id) setOpenSale(id); }} />;
  // v58: Duyệt đơn / Thanh toán mở bảng trượt bên phải trên chính trang chi tiết đơn (không còn trang riêng)
  if (open) return (
    <>
      <SaleDetail key={`${open.id}${cancelId === open.id ? '-c' : ''}`} o={open} onBack={() => { setCancelId(null); setOpenSale(null); }} onApprove={(reject) => setSub({ kind: 'approve', id: open.id, reject })} onPay={() => setSub({ kind: 'pay', id: open.id })} onEdit={() => setEditId(open.id)} startCancel={cancelId === open.id} />
      {sub?.id === open.id && (sub.kind === 'approve'
        ? <SaleApprove o={open} rejectFirst={sub.reject} onBack={() => setSub(null)} onGo={(id) => { setOpenSale(id); setSub({ kind: 'approve', id }); }} />
        : <SalePayPage o={open} onBack={() => setSub(null)} />)}
    </>
  );
  if (mode === 'new') return <SaleForm onDone={(id) => { setMode('list'); if (id) setOpenSale(id); }} />;
  return <SaleListPage onNew={canDo('sale.create') ? () => setMode('new') : undefined} onEdit={(id) => setEditId(id)} onCancel={(id) => { setCancelId(id); setOpenSale(id); }} />;
}

/** v54: trang Quản lý đơn hàng theo bố cục 3A phát hành (chưa phát hành: giao diện gốc) */
export function SaleListPage(props: { onNew?: () => void; onEdit: (id: string) => void; onCancel: (id: string) => void }) {
  const lay = useTenantLayout('sale-list');
  const wide = useMinW(1280);
  const phone = !useMinW(640);
  const { role, go, org, me } = useApp();
  if (!lay) return <SaleList {...props} />;
  const dev: LDevice = wide ? 'lg' : phone ? 'sm' : 'md';
  const ctx: LPageCtx = {
    live: true, page: 'sale-list', period: 'MONTH', setPeriod: () => {}, dept: 'ALL', setDept: () => {}, tab: '', setTab: () => {}, openTargets: () => {},
    vars: lVars('MONTH', org.shortName || org.name, me?.name ?? ''),
    act: (b) => { if (b.act === 'new') props.onNew?.(); else lActCommonRun(b, (m) => go(m)); },
    can: (b) => b.act !== 'new' || !!props.onNew,
  };
  const node = (b: LBlock): ReactNode => {
    if (!lIsCore(b.type) && !lCondOk(b.config, null, role)) return null;
    if (b.type === 'K-SaleList') return <SaleList {...props} cfg={b.config} />;
    return lCommonNode(b, lay.grid) ?? <VerticalBlock b={b} />;
  };
  return <LPageC.Provider value={ctx}><LBusinessView blocks={lay.blocks} node={node} narrow={!wide} dev={dev} grid={lay.grid} /></LPageC.Provider>;
}

export function SaleList({ onNew, onEdit, onCancel, cfg }: { onNew?: () => void; onEdit: (id: string) => void; onCancel: (id: string) => void; cfg?: LBlockCfg }) {
  const R = useSaleRights();
  const { mySales: salesOrders, setOpenSale, users, quotes, warehouses, stockVouchers, customers, departments } = useApp();
  const pctx = useContext(LPageC);
  const { t: term } = useTerminology();
  /** v54.1: nút đầu bảng, trường lọc 3A cho hiện */
  const hb = (k: string) => !(cfg?.hbOff ?? []).includes(k);
  const fOff = cfg?.fltOff ?? [];
  const fo = (k: string) => !fOff.includes(k);
  const onNewB = hb('new') ? onNew : undefined;
  const [tab0, setTab] = useSticky<SaleTab>('Sales.tab50', 'ALL');
  /** v59 lọc 2 lớp: trạng thái chọn nhiều trong phễu (loại trừ với chọn nhanh ở thanh trạng thái) */
  const [tabM0, setTabM] = useSticky<SaleTab[]>('Sales.tabM59', []);
  const [draftM, setDraftM] = useState<SaleTab[]>([]);
  // v55.1: kỳ, khoảng ngày, cột, số dòng là tùy chọn "Lưu cho tôi" -> lưu theo người dùng, đồng bộ nhiều thiết bị
  const [perU, setPer] = useUserPref<SalePer>('Sales.per50', (cfg?.per0 as SalePer | undefined) ?? 'M');
  const per: SalePer = cfg?.hidePer ? (cfg.per0 as SalePer | undefined) ?? 'M' : perU;
  const [range, setRange] = useUserPref<{ from: string; to: string }>('Sales.range50', { from: addDaysISO(todayISO(), -14), to: todayISO() });
  const [fU, setF] = useSticky<SaleFilter>('Sales.f50', SALE_F0);
  // trường lọc 3A tắt thì không áp điều kiện cũ người dùng đã lưu
  const fKey = fOff.join('|');
  const f: SaleFilter = useMemo(() => (fOff.length ? { ...fU, ...Object.fromEntries(fOff.filter((k) => k in SALE_F0).map((k) => [k, SALE_F0[k as keyof SaleFilter]])), ...(fOff.includes('rev') ? { revOp: SALE_F0.revOp } : {}) } : fU), [fU, fKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [cols, setCols] = useUserPref<string[]>('Sales.cols50', []);
  const [size, setSize] = useUserPref<number>('Sales.size50', cfg?.size0 ?? 20);
  const [page, setPage] = useState(0);
  const [q, setQ] = useState('');
  const [pop, setPop] = useState<'' | 'per' | 'filter' | 'cols' | 'size'>('');
  const [draftF, setDraftF] = useState<SaleFilter>(f);
  const [draftR, setDraftR] = useState(range);
  const [draftC, setDraftC] = useState<string[]>([]);
  const [colQ, setColQ] = useState('');
  const [perC, setPerC] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const cfd = useSaleCf();
  const cfL = cfd.head.filter((d) => d.where.list);
  const cfFl = cfd.head.filter((d) => d.status === 'ACTIVE' && d.where.filter && CF_FILTERABLE.includes(d.type) && fo(`cf:${d.key}`));
  const [cff, setCff] = useSticky<Record<string, string>>('Sales.cf53', {});
  const [draftCf, setDraftCf] = useState<Record<string, string>>(cff);
  const cfHit = (o: SalesOrder) => cfFl.every((d) => { const want = cff[d.key]; if (!want) return true; const v = o.cf?.[d.key]; if (d.type === 'check') return want === 'Y' ? v === true : v !== true; if (d.type === 'text') return fold(String(v ?? '')).includes(fold(want)); return String(v ?? '') === want; });
  const close = () => setPop('');
  const popRef = useOutside(pop === 'per' || pop === 'filter' || pop === 'cols', close);
  const sizeRef = useOutside(pop === 'size', close);
  const tabIds: SaleTab[] = ['ALL', 'APPROVAL', 'APPROVED', 'WAIT', 'UNPAID', 'PAID', 'DONE', 'CANCELLED'];
  const tab: SaleTab = tabIds.includes(tab0) && !(cfg?.off ?? []).includes(tab0) ? tab0 : 'ALL';
  const tabM = (Array.isArray(tabM0) ? tabM0 : []).filter((t) => t !== 'ALL' && tabIds.includes(t) && !(cfg?.off ?? []).includes(t));
  const today = todayISO();
  const mon = Number(today.slice(5, 7));
  const from = per === 'C' ? range.from : per === 'D' ? today : per === 'W' ? addDaysISO(today, -((new Date().getDay() + 6) % 7)) : per === 'M' ? `${today.slice(0, 8)}01` : per === 'Q' ? `${today.slice(0, 5)}${String(Math.floor((mon - 1) / 3) * 3 + 1).padStart(2, '0')}-01` : per === 'Y' ? `${today.slice(0, 5)}01-01` : '';
  const to = per === 'C' ? range.to : '';
  const stage = (o: SalesOrder) => saleStage(o, stockVouchers);
  const due = (o: SalesOrder) => saleTotals(o).grand - saleReturned(o);
  const leftOf = (o: SalesOrder) => (o.status === 'CANCELLED' ? 0 : due(o) - salePaid(o));
  const unitsOf = (o: SalesOrder) => { const ls = o.lines.filter((l) => l.kind !== 'FREE'); return { done: ls.reduce((s, l) => s + saleIssQ(o, l), 0), all: ls.reduce((s, l) => s + l.qty, 0) }; };
  const nameOf = useNameOf();
  const nm = (id?: string) => (id ? nameOf(id) : '');
  const short = (id?: string) => (users.find((u) => u.id === id)?.name ?? '').split(' ').slice(-1)[0] || '—';
  const inTab = (o: SalesOrder, t: SaleTab) => {
    const s = stage(o);
    switch (t) {
      case 'ALL': return true;
      case 'APPROVAL': return s === 'APPROVAL' || s === 'REJECTED';
      case 'APPROVED': return s === 'READY';
      case 'WAIT': return s === 'WAIT_WH' || s === 'PARTIAL';
      case 'UNPAID': return s !== 'CANCELLED' && s !== 'APPROVAL' && s !== 'REJECTED' && leftOf(o) > 0;
      case 'PAID': return s !== 'CANCELLED' && due(o) > 0 && leftOf(o) <= 0;
      case 'DONE': return s === 'DONE' || s === 'SHIPPING';
      case 'CANCELLED': return s === 'CANCELLED';
    }
  };
  const invOf = (o: SalesOrder) => { const r = o.invReqs ?? []; return !o.invoice && !r.length ? 'NO' : r.some((x) => x.status === 'DONE') ? 'DONE' : r.some((x) => x.status === 'PENDING') ? 'WAIT' : 'NONE'; };
  const overdueOf = (o: SalesOrder) => o.creditDays > 0 && !!o.issuedAt && leftOf(o) > 0 && saleDue(o) < today;
  const key = fold(q.trim());
  const custOf = (o: SalesOrder) => (o.customerId ? customers.find((c) => c.id === o.customerId) : undefined);
  const sIn = cfg?.sIn?.length ? cfg.sIn : SO_SEARCH_DEF;
  const hay = (o: SalesOrder) => sIn.map((k) => (k === 'code' ? o.code : k === 'cust' ? o.customer : k === 'phone' ? o.phone ?? '' : k === 'sku' ? o.lines.map((l) => `${l.ref ?? ''} ${l.name}`).join(' ') : k === 'note' ? o.note ?? '' : k === 'by' ? nm(o.by) : k === 'tax' ? custOf(o)?.taxCode ?? '' : k.startsWith('cf:') ? String(o.cf?.[k.slice(3)] ?? '') : '')).join(' ');
  const ph = cfg?.ph || (cfg?.sIn?.length ? `Tìm ${sIn.map((k) => SO_SEARCH.find((x) => x.id === k)?.s ?? cfd.head.find((d) => `cf:${d.key}` === k)?.label.toLowerCase()).filter(Boolean).join(', ')}` : 'Tìm mã đơn, khách hàng, SĐT, mã hàng');
  const day = (o: SalesOrder) => (f.dateBy === 'created' ? iso(new Date(o.createdAt)) : o.date);
  const base = salesOrders
    .filter((o) => (!from || day(o) >= from) && (!to || day(o) <= to))
    .filter((o) => {
      const u = unitsOf(o);
      const p = salePaid(o);
      const g = saleTotals(o).grand;
      return (!f.code || fold(o.code).includes(fold(f.code)))
        && (!f.origin || fold(o.origin ?? (o.source === 'QUOTE' ? 'Từ báo giá' : 'Tại quầy')).includes(fold(f.origin)))
        && (f.by === 'ALL' || o.by === f.by) && (!f.cust || fold(o.customer).includes(fold(f.cust))) && (f.wh === 'ALL' || o.whId === f.wh)
        && (f.issue === 'ALL' || (f.issue === 'NONE' ? u.done === 0 : f.issue === 'FULL' ? u.all > 0 && u.done >= u.all : u.done > 0 && u.done < u.all))
        && (f.pay === 'ALL' || o.pay === f.pay)
        && (f.paySt === 'ALL' || (f.paySt === 'PAID' ? leftOf(o) <= 0 && due(o) > 0 : f.paySt === 'UNPAID' ? p === 0 : p > 0 && leftOf(o) > 0))
        && (f.inv === 'ALL' || invOf(o) === f.inv)
        && (!f.rev || (f.revOp === 'GT' ? g > f.rev : g < f.rev)) && (!f.ret || saleReturned(o) > 0) && (!f.overdue || overdueOf(o));
    })
    .filter((o) => !key || fold(hay(o)).includes(key))
    .filter(cfHit);
  const rows = base.filter((o) => stMatch(tab, tabM, (t) => inTab(o, t))).sort((a, b) => b.createdAt - a.createdAt);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const pg = Math.min(page, pages - 1);
  const view = rows.slice(pg * size, pg * size + size);
  const tabMKey = tabM.join('|');
  useEffect(() => { setPage(0); setPicked([]); }, [tab, tabMKey, per, q, f, size, range, cff]);
  const tabs: { id: SaleTab; label: string; short?: string }[] = [{ id: 'ALL', label: 'Tất cả' }, { id: 'APPROVAL', label: 'Chờ duyệt' }, { id: 'APPROVED', label: 'Đã duyệt' }, { id: 'WAIT', label: 'Chờ xuất kho' }, { id: 'UNPAID', label: 'Chưa thanh toán', short: 'Chưa thu' }, { id: 'PAID', label: 'Đã thanh toán', short: 'Đã thu' }, { id: 'DONE', label: 'Hoàn thành' }, { id: 'CANCELLED', label: 'Đã hủy' }];
  // trạng thái theo thứ tự 3A cấu hình (Tất cả luôn đứng đầu thanh lọc nhanh)
  const stOpts: StatusOpt<SaleTab>[] = (cfg ? lFieldOrder(SO_LIST_TABS, cfg).map((id) => tabs.find((t) => t.id === id)).filter((t): t is (typeof tabs)[number] => !!t) : tabs)
    .filter((t) => t.id !== 'ALL').map((t) => ({ value: t.id, label: t.label, short: t.short, count: base.filter((o) => inTab(o, t.id)).length }));
  const eff0 = stEffective(tab, tabM, stOpts);
  const stDirty = draftM.join('|') !== eff0.join('|');
  const sellers = Array.from(new Set(salesOrders.map((o) => o.by).filter((x): x is string => !!x)));
  const nF = (Object.keys(SALE_F0) as (keyof SaleFilter)[]).filter((k) => k !== 'revOp' && k !== 'dateBy' && f[k] !== SALE_F0[k]).length + cfFl.filter((d) => cff[d.key]).length + tabM.length;
  const nDraft = (Object.keys(SALE_F0) as (keyof SaleFilter)[]).filter((k) => k !== 'revOp' && k !== 'dateBy' && draftF[k] !== SALE_F0[k]).length + cfFl.filter((d) => draftCf[d.key]).length + (stDirty ? draftM.length : tabM.length);
  type Col = { id: string; label: string; group: 'Thông tin' | 'Tiến độ' | 'Tiền' | 'Khách hàng' | 'Người tạo' | 'Trường tùy chỉnh'; lock?: boolean; def?: boolean; right?: boolean; sum?: (o: SalesOrder) => number; cell: (o: SalesOrder) => ReactNode; /** chữ khi xuất Excel / in */ txt?: (o: SalesOrder) => string };
  const deptName = (d?: string) => { const x = departments.find((y) => y.code === d); return x ? x.short || x.name : ''; };
  const userOf = (id?: string) => users.find((u) => u.id === id);
  const tcol = (id: string, label: string, group: Col['group'], fn: (o: SalesOrder) => string): Col => ({ id, label, group, cell: (o) => { const t = fn(o); return t ? <span className="block max-w-[200px] truncate" title={t}>{t}</span> : '—'; }, txt: fn });
  const money = (n: number, warn?: boolean) => <span className={cn('tabular-nums', warn && 'text-[rgb(var(--accent-fg))]')}>{fmtN(n)}</span>;
  const COLS: Col[] = [
    { id: 'date', label: 'Ngày', group: 'Thông tin', def: true, cell: (o) => <span className="tabular-nums">{fmtDate(o.date)}</span> },
    { id: 'code', label: 'Mã đơn', group: 'Thông tin', lock: true, cell: (o) => <span className="flex flex-col items-start gap-0.5"><Code>{o.code}</Code>{(cols.length ? cols : DEF).includes('seller') && <span className="text-[12.5px] text-[rgb(var(--muted))]">{short(o.by)}</span>}</span> },
    { id: 'seller', label: 'NV bán (dòng dưới mã đơn)', group: 'Thông tin', def: true, cell: () => null },
    { id: 'cust', label: 'Khách hàng', group: 'Thông tin', lock: true, cell: (o) => <span className="block max-w-[260px] truncate font-medium" title={o.customer}>{o.customer}</span> },
    // v59 Lô C: Ghi chú ẩn sẵn (bật trong Cột hiển thị) để bảng vừa khung 1440px, không cuộn ngang (v49)
    { id: 'note', label: 'Ghi chú', group: 'Thông tin', cell: (o) => <span className="block max-w-[200px] truncate text-[rgb(var(--fg2))]" title={o.note}>{o.note || '—'}</span> },
    { id: 'origin', label: 'Nguồn đơn', group: 'Thông tin', cell: (o) => (o.quoteId ? <Code>{quotes.find((x) => x.id === o.quoteId)?.code ?? 'Báo giá'}</Code> : o.origin ?? 'Tại quầy') },
    { id: 'by', label: 'Người tạo', group: 'Thông tin', cell: (o) => nm(o.by) || '—' },
    { id: 'wh', label: 'Kho xuất', group: 'Thông tin', cell: (o) => warehouses.find((w) => w.id === o.whId)?.name ?? '—' },
    { id: 'status', label: 'Trạng thái', group: 'Tiến độ', lock: true, cell: (o) => { const s = stage(o); return <Chip tone={SALE_STAGE[s].tone}>{SALE_STAGE[s].label}</Chip>; } },
    { id: 'issue', label: 'Trạng thái xuất kho', group: 'Tiến độ', right: true, cell: (o) => { const u = unitsOf(o); return u.all ? <span className="tabular-nums">{fmtN(u.done)} / {fmtN(u.all)}</span> : '—'; } },
    { id: 'deliver', label: 'Ngày giao', group: 'Tiến độ', cell: (o) => (o.deliverAt ? <span className="tabular-nums">{fmtDate(o.deliverAt)}</span> : '—') },
    { id: 'gross', label: 'Doanh số', group: 'Tiền', def: true, right: true, sum: (o) => saleTotals(o).net, cell: (o) => money(saleTotals(o).net) },
    { id: 'vat', label: 'VAT', group: 'Tiền', def: true, right: true, sum: (o) => saleTotals(o).vat, cell: (o) => money(saleTotals(o).vat) },
    { id: 'grand', label: 'Tổng đơn', group: 'Tiền', def: true, right: true, sum: (o) => saleTotals(o).grand, cell: (o) => <span className="font-medium tabular-nums">{fmtN(saleTotals(o).grand)}</span> },
    { id: 'disc', label: 'Chiết khấu', group: 'Tiền', right: true, sum: (o) => saleTotals(o).discount, cell: (o) => money(saleTotals(o).discount) },
    { id: 'ret', label: 'Hàng trả lại', group: 'Tiền', right: true, sum: (o) => saleReturned(o), cell: (o) => (saleReturned(o) ? money(saleReturned(o)) : '—') },
    { id: 'paid', label: 'Doanh thu', group: 'Tiền', def: true, right: true, sum: (o) => salePaid(o), cell: (o) => money(salePaid(o)) },
    { id: 'wait', label: 'Chờ kế toán thu', group: 'Tiền', right: true, sum: (o) => salePaid(o, true) - salePaid(o), cell: (o) => (salePaid(o, true) - salePaid(o) ? money(salePaid(o, true) - salePaid(o)) : '—') },
    { id: 'left', label: 'Còn lại', group: 'Tiền', def: true, right: true, sum: (o) => Math.max(0, leftOf(o)), cell: (o) => money(Math.max(0, leftOf(o)), leftOf(o) > 0) },
    { id: 'dueAt', label: 'Hạn thanh toán', group: 'Tiền', cell: (o) => (o.creditDays && o.issuedAt ? <span className={cn('tabular-nums', overdueOf(o) && 'text-[rgb(var(--danger-fg))]')}>{fmtDate(saleDue(o))}</span> : '—') },
    { id: 'inv', label: 'Hóa đơn thuế', group: 'Tiến độ', def: true, cell: (o) => { const s = invOf(o); return s === 'NO' ? <span className="text-[rgb(var(--muted))]">Không lấy</span> : s === 'DONE' ? <span className="flex gap-1">{(o.invReqs ?? []).filter((r) => r.status === 'DONE').map((r) => <Code key={r.id}>{r.no}</Code>)}</span> : s === 'WAIT' ? <Chip tone="orange">Chờ xuất</Chip> : '—'; } },
    tcol('kh_code', 'Mã khách hàng', 'Khách hàng', (o) => custOf(o)?.code ?? ''),
    tcol('kh_tax', 'MST', 'Khách hàng', (o) => custOf(o)?.taxCode ?? ''),
    tcol('kh_phone', 'SĐT khách', 'Khách hàng', (o) => o.phone || custOf(o)?.contactPhone || ''),
    tcol('kh_dept', 'Phòng ban phụ trách', 'Khách hàng', (o) => deptName(custOf(o)?.dept)),
    tcol('kh_region', 'Khu vực', 'Khách hàng', (o) => { const c = custOf(o); return c ? REGION_LABEL[c.region] ?? '' : ''; }),
    tcol('kh_seg', 'Phân khúc', 'Khách hàng', (o) => { const c = custOf(o); return c ? SEGMENT_LABEL[c.segment] ?? c.segment : ''; }),
    tcol('kh_tier', 'Hạng khách', 'Khách hàng', (o) => { const c = custOf(o); return c ? TIER[c.tier]?.label ?? c.tier : ''; }),
    tcol('kh_am', 'NV phụ trách khách', 'Khách hàng', (o) => nm(custOf(o)?.amId)),
    { id: 'kh_limit', label: 'Hạn mức công nợ', group: 'Khách hàng', right: true, cell: (o) => (custOf(o) ? money(custOf(o)!.creditLimit) : '—'), txt: (o) => String(custOf(o)?.creditLimit ?? '') },
    { id: 'kh_debt', label: 'Công nợ khách hiện tại', group: 'Khách hàng', right: true, cell: (o) => (custOf(o) ? money(custOf(o)!.debt) : '—'), txt: (o) => String(custOf(o)?.debt ?? '') },
    tcol('u_dept', 'Phòng ban người tạo', 'Người tạo', (o) => deptName(userOf(o.by)?.dept)),
    tcol('u_title', 'Chức danh người tạo', 'Người tạo', (o) => userOf(o.by)?.title ?? ''),
    ...cfL.map((d): Col => ({ id: `cf:${d.key}`, label: d.label, group: 'Trường tùy chỉnh', right: d.type === 'money' || d.type === 'number', sum: d.type === 'money' || d.type === 'number' ? (o) => Number(o.cf?.[d.key]) || 0 : undefined, cell: (o) => { const t = cfText(d, o.cf?.[d.key], nm); return t ? <span className={cn('block max-w-[200px] truncate', (d.type === 'money' || d.type === 'number') && 'tabular-nums')} title={t}>{t}</span> : '—'; } })),
  ];
  // v54: 3A đặt bộ cột mặc định cho doanh nghiệp (khối Danh sách đơn hàng); người dùng vẫn tự lưu cột riêng
  const DEF = cfg?.cols?.length ? [...COLS.filter((c) => c.lock).map((c) => c.id), ...cfg.cols.filter((id) => COLS.some((c) => c.id === id && !c.lock))] : COLS.filter((c) => c.def || c.lock).map((c) => c.id);
  const on = cols.length ? cols : DEF;
  const ORDER = ['date', 'code', 'cust', 'kh_code', 'kh_tax', 'kh_phone', 'kh_dept', 'kh_region', 'kh_seg', 'kh_tier', 'kh_am', 'status', 'origin', 'by', 'u_dept', 'u_title', 'wh', 'issue', 'deliver', 'gross', 'disc', 'vat', 'grand', 'paid', 'wait', 'left', 'ret', 'dueAt', 'kh_limit', 'kh_debt', 'note', 'inv', ...cfL.map((d) => `cf:${d.key}`)];
  const vis = ORDER.map((id) => COLS.find((c) => c.id === id)!).filter((c) => c.lock || on.includes(c.id));
  const sumOf = (fn: (o: SalesOrder) => number) => rows.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + fn(o), 0);
  const sumOff = cfg?.sumOff ?? [];
  const sumOn = cfg?.sumRow !== false;
  const firstSum = vis.findIndex((c) => !!c.sum && !sumOff.includes(c.id));
  const PER: [SalePer, string][] = [['ALL', 'Tất cả'], ['D', 'Hôm nay'], ['W', 'Tuần này'], ['M', 'Tháng này'], ['Q', 'Quý này'], ['Y', 'Năm nay'], ['C', 'Thời gian khác']];
  const perLabel = per === 'C' ? `${fmtDate(range.from).slice(0, 5)} – ${fmtDate(range.to)}` : PER.find((x) => x[0] === per)?.[1];
  const exportRows = (list: SalesOrder[]) => [vis.map((c) => c.label), ...list.map((o) => vis.map((c) => { if (c.txt) return c.txt(o); if (c.id.startsWith('cf:')) { const d = cfL.find((x) => `cf:${x.key}` === c.id); return d ? cfText(d, o.cf?.[d.key], nm) : ''; } return c.sum ? c.sum(o) : c.id === 'code' ? o.code : c.id === 'date' ? fmtDate(o.date) : c.id === 'cust' ? o.customer : c.id === 'status' ? SALE_STAGE[stage(o)].label : c.id === 'note' ? o.note ?? '' : c.id === 'inv' ? (o.invReqs ?? []).filter((r) => r.status === 'DONE').map((r) => r.no).join(', ') : c.id === 'by' ? nm(o.by) : c.id === 'wh' ? warehouses.find((w) => w.id === o.whId)?.name ?? '' : c.id === 'issue' ? `${unitsOf(o).done}/${unitsOf(o).all}` : c.id === 'origin' ? o.origin ?? '' : c.id === 'deliver' ? fmtDate(o.deliverAt) : c.id === 'dueAt' && o.issuedAt ? fmtDate(saleDue(o)) : ''; }))];
  const chosen = rows.filter((o) => picked.includes(o.id));
  const csv = () => downloadCsv(`don-hang-${today}.csv`, exportRows(chosen.length ? chosen : rows));
  const print = () => { const g = exportRows(chosen.length ? chosen : rows); printHtml(docShell('Danh sách đơn hàng', `<h1>Danh sách đơn hàng</h1><table class="items"><thead><tr>${g[0].map((h) => `<th>${esc(String(h))}</th>`).join('')}</tr></thead><tbody>${g.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`)); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { const t = e.target as HTMLElement; if (onNewB && (e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); onNewB(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onNewB]);
  const sel = (v: string, set: (v: string) => void, opts: [string, string][], label: string) => <Field label={label}><select className={inputCls} value={v} onChange={(e) => set(e.target.value)}>{opts.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></Field>;
  const allOn = view.length > 0 && view.every((o) => picked.includes(o.id));
  const sttOn = cfg?.stt !== false, pickOn = cfg?.pick !== false;
  const dcls = cfg?.dense === 'sm' ? 'l-dn-sm' : cfg?.dense === 'lg' ? 'l-dn-lg' : '';
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2" ref={popRef}>
        {!cfg?.hideHead && <h1 className="mr-2 text-[20px] font-medium">{lFill(cfg?.head || term('saleList'), pctx?.vars)}</h1>}
        {cfg?.search !== false ? <div className="order-last w-full min-w-0 lg:order-none lg:mx-auto lg:w-auto lg:max-w-[640px] lg:flex-1"><SearchBox value={q} onChange={setQ} placeholder={ph} /></div> : <div className="hidden flex-1 lg:block" />}
        {!cfg?.hidePer && <div className="relative ml-auto lg:ml-0">
          <button className={cn(btnGhost, 'h-9 min-w-[150px] justify-between gap-2', per === 'C' && 'border-[rgb(var(--accent))]')} onClick={() => { setDraftR(range); setPerC(per === 'C'); setPop(pop === 'per' ? '' : 'per'); }} aria-expanded={pop === 'per'}><CalendarDays className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><span className="flex-1 text-left">{perLabel}</span><ChevronDown className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /></button>
          {pop === 'per' && (
            <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1.5 shadow-xl">
              {PER.map(([k, t]) => <button key={k} className={cn('flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] hover:bg-[rgb(var(--ink)/0.05)]', (k === 'C' ? perC : per === k && !perC) && 'bg-[rgb(var(--ink)/0.05)]')} onClick={() => { if (k === 'C') { setPerC(true); return; } setPer(k); setPop(''); }}>{t}{(k === 'C' ? perC : per === k && !perC) && <CheckIcon className="h-4 w-4" aria-hidden />}</button>)}
              {perC && (
                <div className="mt-1 space-y-2 border-t border-[rgb(var(--line))] p-2">
                  <Field label="Từ ngày"><input type="date" className={inputCls} value={draftR.from} max={draftR.to} onChange={(e) => setDraftR({ ...draftR, from: e.target.value })} /></Field>
                  <Field label="Đến ngày"><input type="date" className={inputCls} value={draftR.to} min={draftR.from} onChange={(e) => setDraftR({ ...draftR, to: e.target.value })} /></Field>
                  <button className={cn(btnBase, 'w-full justify-center bg-[rgb(var(--fg))] py-2 text-[rgb(var(--bg))]')} disabled={!draftR.from || !draftR.to || draftR.from > draftR.to} onClick={() => { setRange(draftR); setPer('C'); setPop(''); }}>Áp dụng</button>
                </div>
              )}
            </div>
          )}
        </div>}
        <div className="flex">
          {hb('filter') && <div className="relative">
            <button className={cn(soIco, 'relative', hb('cols') && 'rounded-r-none', (pop === 'filter' || nF > 0) && 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))] hover:bg-[rgb(var(--fg))]')} onClick={() => { setDraftF(f); setDraftCf(cff); setDraftM(eff0); setPop(pop === 'filter' ? '' : 'filter'); }} aria-label={nF ? `Bộ lọc, ${nF} đang bật` : 'Bộ lọc'} title="Bộ lọc" aria-expanded={pop === 'filter'} data-filter-btn><Filter className="h-4 w-4" aria-hidden />{nF > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[rgb(var(--accent))] px-1 text-[10px] text-[rgb(var(--on-accent))]">{nF}</span>}</button>
            {pop === 'filter' && (
              <div className="absolute right-0 top-full z-40 mt-1 w-[620px] max-w-[92vw] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5 shadow-xl max-sm:-right-24">
                <div className="mb-3 flex flex-wrap items-center gap-4 text-[14px]">
                  {fo('dateBy') && ([['date', 'Theo ngày đặt hàng'], ['created', 'Theo ngày tạo đơn']] as const).map(([k, t]) => <label key={k} className="flex items-center gap-2"><input type="radio" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={draftF.dateBy === k} onChange={() => setDraftF({ ...draftF, dateBy: k })} />{t}</label>)}
                  <span className="ml-auto text-[12.5px] text-[rgb(var(--muted))]">Kỳ: {perLabel}</span>
                </div>
                <div className="mb-4 border-b border-[rgb(var(--line))] pb-3">
                  <StatusChecklist options={stOpts} value="ALL" onChange={() => {}} multi={draftM} onMulti={setDraftM} label="Trạng thái đơn" columns={2} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {fo('code') && <Field label="Mã đơn hàng"><input className={inputCls} value={draftF.code} onChange={(e) => setDraftF({ ...draftF, code: e.target.value })} placeholder="Nhập mã" /></Field>}
                  {fo('origin') && <Field label="Nguồn đơn hàng"><input className={inputCls} list="so-origins" value={draftF.origin} onChange={(e) => setDraftF({ ...draftF, origin: e.target.value })} placeholder="Tất cả" /></Field>}
                  {fo('by') && sel(draftF.by, (v) => setDraftF({ ...draftF, by: v }), [['ALL', 'Tất cả'], ...sellers.map((id): [string, string] => [id, nm(id) || id])], 'Nhân viên bán')}
                  {fo('cust') && <Field label="Khách hàng"><input className={inputCls} list="so-custs" value={draftF.cust} onChange={(e) => setDraftF({ ...draftF, cust: e.target.value })} placeholder="Tìm khách hàng" /></Field>}
                  {fo('wh') && sel(draftF.wh, (v) => setDraftF({ ...draftF, wh: v }), [['ALL', 'Tất cả'], ...warehouses.map((w): [string, string] => [w.id, w.name])], 'Kho xuất')}
                  {fo('issue') && sel(draftF.issue, (v) => setDraftF({ ...draftF, issue: v as SaleFilter['issue'] }), [['ALL', 'Tất cả'], ['NONE', 'Chưa xuất'], ['PART', 'Một phần'], ['FULL', 'Đã xuất đủ']], 'Trạng thái xuất kho')}
                  {fo('pay') && sel(draftF.pay, (v) => setDraftF({ ...draftF, pay: v as SalePay | 'ALL' }), [['ALL', 'Tất cả'], ...(Object.keys(SALE_PAY) as SalePay[]).map((p): [string, string] => [p, SALE_PAY[p]])], 'Phương thức thanh toán')}
                  {fo('paySt') && sel(draftF.paySt, (v) => setDraftF({ ...draftF, paySt: v as SaleFilter['paySt'] }), [['ALL', 'Tất cả'], ['UNPAID', 'Chưa thu'], ['PART', 'Thu một phần'], ['PAID', 'Đã thu đủ']], 'Trạng thái thanh toán')}
                  {fo('inv') && sel(draftF.inv, (v) => setDraftF({ ...draftF, inv: v as SaleFilter['inv'] }), [['ALL', 'Tất cả'], ['NONE', 'Chưa xuất'], ['WAIT', 'Chờ kế toán'], ['DONE', 'Đã xuất'], ['NO', 'Không lấy']], 'Hóa đơn thuế')}
                  {fo('rev') && <Field label="Doanh thu"><div className="flex gap-2"><select className={cn(inputBase, 'w-32')} value={draftF.revOp} onChange={(e) => setDraftF({ ...draftF, revOp: e.target.value as 'GT' | 'LT' })} aria-label="So sánh"><option value="GT">Lớn hơn</option><option value="LT">Nhỏ hơn</option></select><div className="min-w-0 flex-1"><MoneyInput value={draftF.rev} onChange={(v) => setDraftF({ ...draftF, rev: v })} /></div></div></Field>}
                </div>
                {cfFl.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[rgb(var(--line))] pt-3 sm:grid-cols-2">
                    <p className="text-[12.5px] text-[rgb(var(--muted))] sm:col-span-2">Trường tùy chỉnh</p>
                    {cfFl.map((d) => <Field key={d.id} label={d.label}>{d.type === 'text'
                      ? <input className={inputCls} value={draftCf[d.key] ?? ''} onChange={(e) => setDraftCf({ ...draftCf, [d.key]: e.target.value })} placeholder="Chứa chữ" />
                      : <select className={inputCls} value={draftCf[d.key] ?? ''} onChange={(e) => setDraftCf({ ...draftCf, [d.key]: e.target.value })}><option value="">Tất cả</option>{d.type === 'check' ? <><option value="Y">Có</option><option value="N">Không</option></> : d.type === 'user' ? users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.name}</option>) : (d.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}</select>}</Field>)}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
                  {fo('ret') && <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={draftF.ret} onChange={(e) => setDraftF({ ...draftF, ret: e.target.checked })} />Có hàng trả lại</label>}
                  {fo('overdue') && <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={draftF.overdue} onChange={(e) => setDraftF({ ...draftF, overdue: e.target.checked })} />Quá hạn thanh toán</label>}
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-[rgb(var(--line))] pt-4">
                  <span className="text-[13px] text-[rgb(var(--muted))]">Đang chọn {nDraft} điều kiện</span>
                  <button className="ml-auto px-3 py-2 text-[14px] hover:underline" onClick={() => { setDraftF(SALE_F0); setF(SALE_F0); setDraftCf({}); setCff({}); setDraftM([]); setTabM([]); setTab('ALL'); }}>Xóa lọc</button>
                  <button className={btnGhost} onClick={() => setPop('')}>Đóng</button>
                  <button className={cn(btnBase, 'bg-[rgb(var(--fg))] px-4 py-2 text-[rgb(var(--bg))]')} onClick={() => { setF(draftF); setCff(Object.fromEntries(Object.entries(draftCf).filter(([, v]) => v))); if (stDirty) { setTabM(draftM); setTab('ALL'); } setPop(''); }}><Search className="h-4 w-4" aria-hidden />Tìm kiếm</button>
                </div>
              </div>
            )}
          </div>}
          {hb('cols') && <div className="relative">
            <button className={cn(soIco, hb('filter') && '-ml-px rounded-l-none', pop === 'cols' && 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))] hover:bg-[rgb(var(--fg))]')} onClick={() => { setDraftC(on); setColQ(''); setPop(pop === 'cols' ? '' : 'cols'); }} aria-label="Cột hiển thị" title="Cột hiển thị" aria-expanded={pop === 'cols'}><Columns3 className="h-4 w-4" aria-hidden /></button>
            {pop === 'cols' && (
              <div className={cn('absolute right-0 top-full z-40 mt-1 max-w-[92vw] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5 shadow-xl max-sm:-right-12', 'w-[860px]')}>
                <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="text-[16px] font-medium">Cột hiển thị</h3><span className="text-[12.5px] tabular-nums text-[rgb(var(--muted))]">{COLS.filter((c) => c.lock || draftC.includes(c.id)).length} / {COLS.length}</span><div className="ml-auto w-48"><SearchBox value={colQ} onChange={setColQ} placeholder="Tìm cột" /></div></div>
                <div className={cn('grid grid-cols-1 gap-x-6', 'gap-y-3 sm:grid-cols-3')}>
                  {((cfL.length ? ['Thông tin', 'Tiến độ', 'Tiền', 'Khách hàng', 'Người tạo', 'Trường tùy chỉnh'] : ['Thông tin', 'Tiến độ', 'Tiền', 'Khách hàng', 'Người tạo']) as Col['group'][]).map((g) => (
                    <div key={g}>
                      <p className="mb-1 text-[12.5px] text-[rgb(var(--muted))]">{g}</p>
                      {COLS.filter((c) => c.group === g && (!colQ || fold(c.label).includes(fold(colQ)))).map((c) => (
                        <label key={c.id} className={cn('flex items-center gap-2.5 rounded-md px-1 py-1.5 text-[14px]', !c.lock && 'hover:bg-[rgb(var(--ink)/0.04)]')}>
                          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={c.lock || draftC.includes(c.id)} disabled={c.lock} onChange={() => setDraftC((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} />
                          <span className="flex-1">{c.label}</span>{c.lock && <Lock className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-label="Cột cố định" />}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-[rgb(var(--line))] pt-4">
                  <span className="flex items-center gap-1.5 text-[13px] text-[rgb(var(--muted))]"><Lock className="h-3.5 w-3.5" aria-hidden />Cột cố định không ẩn được</span>
                  <button className={cn(btnGhost, 'ml-auto')} onClick={() => setDraftC(DEF)}>Mặc định</button>
                  <button className={cn(btnBase, 'bg-[rgb(var(--fg))] px-4 py-2 text-[rgb(var(--bg))]')} onClick={() => { setCols(draftC); setPop(''); }}>Lưu cho tôi</button>
                </div>
              </div>
            )}
          </div>}
        </div>
        <div className="flex">
          {hb('excel') && <button className={cn(soIco, hb('print') && 'rounded-r-none')} onClick={csv} disabled={!rows.length} aria-label="Xuất Excel (CSV)" title={chosen.length ? `Xuất ${chosen.length} đơn đã chọn` : 'Xuất Excel (CSV)'}><Download className="h-4 w-4" aria-hidden /></button>}
          {hb('print') && <button className={cn(soIco, hb('excel') && '-ml-px rounded-l-none')} onClick={print} disabled={!rows.length} aria-label="In danh sách" title={chosen.length ? `In ${chosen.length} đơn đã chọn` : 'In danh sách'}><Printer className="h-4 w-4" aria-hidden /></button>}
        </div>
        {onNewB && <button className={cn(btnPrimary, 'h-9')} onClick={onNewB} title="Phím tắt N"><Plus className="h-4 w-4" aria-hidden />{term('newSale')}<kbd className="ml-1 rounded border border-current/40 px-1 font-mono text-[10px] opacity-70">N</kbd></button>}
        <datalist id="so-origins">{Array.from(new Set(['Tại quầy', 'Từ báo giá', ...salesOrders.map((o) => o.origin).filter((x): x is string => !!x)])).map((x) => <option key={x} value={x} />)}</datalist>
        <datalist id="so-custs">{customers.slice(0, 300).map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </div>
      <section className="glass-card overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center gap-x-6 border-b border-[rgb(var(--line))] px-5">
          {/* v59 lọc 2 lớp: Tất cả + tối đa 5 trạng thái chính, còn lại trong Thêm ▾; chọn nhiều nằm trong phễu Bộ lọc ở trên */}
          <div className="min-w-0 flex-1 py-2.5" data-sale-status>
            <StatusBar<SaleTab> options={stOpts} value={tab} onChange={(v) => setTab(v)} multi={tabM} onMulti={setTabM} label="Trạng thái đơn" total={base.length} funnel={false} />
          </div>
          <div className="flex items-center gap-2 py-2">
            <span className="whitespace-nowrap text-[13px] tabular-nums text-[rgb(var(--muted))]">{rows.length ? `${pg * size + 1}–${Math.min(rows.length, pg * size + size)} trong ${rows.length} đơn` : '0 đơn'}</span>
            <div className="flex"><button className={cn(soIco, 'h-8 w-8 rounded-r-none')} disabled={pg === 0} onClick={() => setPage(pg - 1)} aria-label="Trang trước"><ChevronLeft className="h-4 w-4" aria-hidden /></button><button className={cn(soIco, '-ml-px h-8 w-8 rounded-l-none')} disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} aria-label="Trang sau"><ChevronRight className="h-4 w-4" aria-hidden /></button></div>
            <div className="relative" ref={sizeRef}>
              <button className={cn(btnGhost, 'h-8 gap-1.5 py-0')} onClick={() => setPop(pop === 'size' ? '' : 'size')} aria-expanded={pop === 'size'} aria-label="Số đơn mỗi trang">{size} / trang<ChevronDown className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /></button>
              {pop === 'size' && <div className="absolute right-0 top-full z-40 mt-1 w-32 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 shadow-xl">{[20, 50, 100].map((n) => <button key={n} className={cn('flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left text-[13.5px] hover:bg-[rgb(var(--ink)/0.05)]', size === n && 'font-medium')} onClick={() => { setSize(n); setPop(''); }}>{n} / trang{size === n && <CheckIcon className="h-3.5 w-3.5" aria-hidden />}</button>)}</div>}
            </div>
          </div>
        </div>
        {rows.length ? (
          // relative: nhãn ẩn (sr-only, position absolute) ở cột cuối không thoát khỏi khung cuộn làm trang tràn ngang trên điện thoại
          <div className="relative overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead><tr className={cn('border-b border-[rgb(var(--line))]', cfg?.thBg === false && 'l-th-none')}>
                {pickOn && <th className={cn(soTh, 'w-10 pl-5')}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={allOn} onChange={() => setPicked(allOn ? picked.filter((id) => !view.some((o) => o.id === id)) : Array.from(new Set([...picked, ...view.map((o) => o.id)])))} aria-label="Chọn cả trang" /></th>}
                {sttOn && <th className={cn(soTh, 'w-8', !pickOn && 'pl-5')}>#</th>}
                {vis.map((c) => <th key={c.id} className={cn(soTh, c.right && 'text-right')}>{c.label}</th>)}
                <th className={cn(soTh, 'w-12 pr-5')}><span className="sr-only">Thao tác</span></th>
              </tr></thead>
              <tbody>
                {view.map((o, i) => { const pk = picked.includes(o.id); return (
                  <tr key={o.id} className={cn('cursor-pointer border-b border-[rgb(var(--ink)/0.06)] hover:bg-[rgb(var(--ink)/0.03)]', dcls, cfg?.zebra && i % 2 === 1 && 'bg-[rgb(var(--ink)/0.025)]', pk && 'bg-[rgb(var(--accent)/0.05)] shadow-[inset_3px_0_0_rgb(var(--accent))]')} onClick={() => setOpenSale(o.id)}>
                    {pickOn && <td className={cn(soTd, 'pl-5')} onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={pk} onChange={() => setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))} aria-label={`Chọn ${o.code}`} /></td>}
                    {sttOn && <td className={cn(soTd, 'tabular-nums text-[rgb(var(--muted))]', !pickOn && 'pl-5')}>{pg * size + i + 1}</td>}
                    {vis.map((c) => <td key={c.id} className={cn(soTd, c.right && 'text-right')}>{c.cell(o)}</td>)}
                    <td className={cn(soTd, 'pr-5')} onClick={(e) => e.stopPropagation()}><RowMenu items={[{ label: 'Xem chi tiết', icon: Eye, onClick: () => setOpenSale(o.id) }, { label: 'Sửa đơn', icon: Pencil, disabled: !R.canEdit(o), onClick: () => onEdit(o.id) }, { label: 'Hủy đơn', icon: XCircle, disabled: !R.canCancel(o), onClick: () => onCancel(o.id) }, { label: R.canDelete(o) ? 'Xóa đơn' : `Xóa đơn (${R.delWhy(o)})`, icon: Trash2, danger: true, disabled: !R.canDelete(o), onClick: () => R.remove(o) }]} /></td>
                  </tr>
                ); })}
                {sumOn && <tr className="bg-[rgb(var(--ink)/0.03)] font-medium">
                  <td className={cn(soTd, 'pl-5')} colSpan={(pickOn ? 1 : 0) + (sttOn ? 1 : 0) + Math.max(1, firstSum)}>Tổng {rows.length} đơn <span className="font-normal text-[rgb(var(--muted))]">· theo bộ lọc</span></td>
                  {firstSum >= 0 && vis.slice(Math.max(1, firstSum)).map((c) => <td key={c.id} className={cn(soTd, 'text-right tabular-nums', c.id === 'left' && 'text-[rgb(var(--accent-fg))]')}>{c.sum && !sumOff.includes(c.id) ? fmtN(sumOf(c.sum)) : ''}</td>)}
                  {firstSum < 0 && <td colSpan={Math.max(0, vis.length - 1)} />}
                  <td />
                </tr>}
              </tbody>
            </table>
          </div>
        ) : <EmptyState text={salesOrders.length ? 'Không có đơn khớp bộ lọc' : 'Chưa có đơn hàng'} art="box" action={!salesOrders.length && onNewB ? term('newSale') : undefined} onAction={onNewB} />}
      </section>
    </div>
  );
}

export function SaleForm({ onDone, edit }: { onDone: (id?: string) => void; edit?: SalesOrder }) {
  const { skus, stockItems, stockMoves, priceItems, warehouses, customers, salesOrders, reservations, saveSale, me, notify, company, workOrders, setWorkOrders, mfgConfig } = useApp();
  const mfg = bizMode(company) === 'MFG';
  const main = warehouses.find((w) => w.main)?.id ?? MAIN_WH;
  // v61: giá trị điền sẵn cho đơn mới theo Cài đặt › Bán hàng (đơn đang sửa giữ nguyên dữ liệu của đơn)
  const sd = saleDefaultsOf(mfgConfig, warehouses);
  const [lines, setLines] = useState<SaleLine[]>(edit?.lines ?? []);
  const [find, setFind] = useState('');
  const [custQ, setCustQ] = useState('');
  const [custId, setCustId] = useState<string | undefined>(edit?.customerId);
  const [walkName, setWalkName] = useState(edit && !edit.customerId ? edit.customer : '');
  const [phone, setPhone] = useState(edit?.phone ?? '');
  // v61: liên hệ của khách ghi trên đơn (điền sẵn từ hồ sơ, sửa được cho riêng đơn); điện thoại người nhận tách khỏi điện thoại khách
  const [email, setEmail] = useState(edit?.email ?? '');
  const [contact, setContact] = useState(edit?.contact ?? '');
  const [recvPhone, setRecvPhone] = useState(edit ? edit.recvPhone ?? edit.phone ?? '' : '');
  const [saveProfile, setSaveProfile] = useState(false);
  const [address, setAddress] = useState(edit?.address ?? '');
  const [tier, setTier] = useState<PriceTier>('BASE');
  const [pay, setPay] = useState<SalePay>(edit ? (edit.pay === 'PARTIAL' ? 'CREDIT' : edit.pay) : sd.pay);
  const [creditDays, setCreditDays] = useState(edit?.creditDays || sd.creditDays);
  const [delivery, setDelivery] = useState<SaleDelivery>(edit?.delivery ?? sd.delivery);
  const [whId, setWhId] = useState(edit?.whId ?? (sd.whId || main));
  const [deliverAt, setDeliverAt] = useState(edit?.deliverAt ?? todayISO());
  const [invoice, setInvoice] = useState(edit?.invoice ?? sd.invoice);
  const [shipFee, setShipFee] = useState(edit?.shipFee ?? 0);
  const [note, setNote] = useState(edit?.note ?? '');
  const { users, wfDef, openCustomerForm, wfFirstApprovers, dispatch, audit } = useApp();
  const [code, setCode] = useState(edit?.code ?? '');
  // v55.2: trường "Thông tin thêm" theo bố cục Form lên đơn bán (3A thiết kế), mặc định theo cờ "Form" của trường
  const fl = useSaleFormLayout();
  const cfd = useSaleCf();
  const cfForm = fl.formDefs;
  const [cfv, setCfv] = useState<Record<string, CfVal>>(edit?.cf ?? {});
  // v56: thuật ngữ ngành, tên người dùng / tài nguyên, kiểm tra trùng lịch tài nguyên trước khi lưu
  const { t: term } = useTerminology();
  const nameOf = useNameOf();
  const { resources } = useApp();
  const resErrs = resourceConflicts(cfd.head, cfv, salesOrders.map((x) => ({ id: x.id, code: x.code, cf: x.cf, cancelled: x.status === 'CANCELLED' })), resources, edit?.id);
  const [origin, setOrigin] = useState(edit ? edit.origin ?? (edit.source === 'QUOTE' ? 'Từ báo giá' : 'Tại quầy') : sd.origin);
  const [docRef, setDocRef] = useState(edit?.docRef ?? '');
  const [receiver, setReceiver] = useState(edit?.receiver ?? '');
  const [byId, setById] = useState(edit?.by ?? me?.id ?? '');
  // v61: phòng ban của đơn (trống = theo người thực hiện); đổi người thực hiện / phòng ban cần quyền quản lý đơn
  const [deptSel, setDeptSel] = useState(edit?.dept ?? '');
  const [custOpen, setCustOpen] = useState(false);
  const cust = customers.find((c) => c.id === custId);
  // v60: khách lẻ vẫn ghi được mã số thuế (xuất hóa đơn); tra cứu mã số thuế; tệp chọn trước khi lưu (tải lên khi đã có mã đơn)
  const { setCustomers, canDo, org, setSalesOrders, departments, setMfgConfig } = useApp();
  const canAssign = canDo('sale.manage');
  // v61: nguồn đơn hàng theo danh mục ở Cài đặt › Bán hàng, thêm nhanh bằng nút + ngay trên form
  const [srcNew, setSrcNew] = useState<string | null>(null);
  // bảng chọn sản phẩm mở ở ô tìm phía trên ('top') hoặc ở ô Mã / Tên của từng dòng (id dòng: chọn = thay hàng của dòng đó)
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [rowQ, setRowQ] = useState('');
  const [pickPos, setPickPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const pickOpen = pickFor === 'top';
  const setPickOpen = (v: boolean) => setPickFor((cur) => (v ? 'top' : cur === 'top' ? null : cur));
  const [pickPage, setPickPage] = useState(0);
  const [srv] = useServerStatus();
  const [walkTax, setWalkTax] = useState(edit && !edit.customerId ? edit.taxCode ?? '' : '');
  const tax = useTaxLookup();
  const [pendFiles, setPendFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const canCustEdit = canDo('customer.edit');
  const custMain = cust ? custContacts(cust).find((x) => x.primary) ?? custContacts(cust)[0] : undefined;
  // v61: liên hệ trên đơn khác hồ sơ khách → hiện ô tích "Cập nhật vào hồ sơ khách" (người có quyền sửa khách)
  const profDiff = !!cust && (phone.trim() !== custPhone(cust) || email.trim() !== custEmail(cust) || (!!contact.trim() && fold(contact.trim()) !== fold(custMain?.name ?? '')));
  const taxOf = cust ? cust.taxCode : walkTax;
  const taxShown: TaxState = tax.code && tax.code === taxNorm(taxOf) ? tax : cust?.taxInfo && taxNorm(cust.taxInfo.taxCode) === taxNorm(cust.taxCode) ? { busy: false, code: cust.taxInfo.taxCode, info: cust.taxInfo } : { busy: false };
  const lookupCust = async (c: Customer, force = false) => {
    const info = await tax.run(c.taxCode, force);
    if (info && canCustEdit) setCustomers((all) => all.map((x) => (x.id === c.id ? { ...x, taxInfo: info } : x)));
  };
  // Gõ đúng định dạng mã số thuế mà chưa có trong danh bạ: tự tra dữ liệu đăng ký thuế (chờ 450 ms sau phím cuối)
  const qTax = !cust && !walkName && taxKind(custQ) && !customers.some((c) => taxNorm(c.taxCode) === taxNorm(custQ)) ? taxNorm(custQ) : '';
  useEffect(() => {
    if (!qTax) return;
    const h = window.setTimeout(() => { void tax.run(qTax); }, 450);
    return () => window.clearTimeout(h);
  }, [qTax]); // eslint-disable-line react-hooks/exhaustive-deps
  const useTaxAddress = (v: string) => {
    if (cust && canCustEdit) setCustomers((all) => all.map((x) => (x.id === cust.id ? { ...x, address: v, ...(tax.info ? { taxInfo: tax.info } : {}) } : x)));
    if (!address.trim() || (cust && address.trim() === (cust.address ?? '').trim())) setAddress(v);
    notify(cust && canCustEdit ? `Đã cập nhật địa chỉ ${cust.name} theo dữ liệu thuế` : 'Đã dùng địa chỉ theo dữ liệu thuế cho đơn này', 'teal');
  };
  // v60: nhận tại quầy thì không tính phí vận chuyển (kể cả khi đã gõ phí rồi đổi lại "Tại quầy")
  const fee = delivery === 'PICKUP' ? 0 : shipFee;
  const draft: SalesOrder = { id: 'new', code: '', createdAt: 0, date: todayISO(), source: 'COUNTER', customerId: custId, customer: cust?.name ?? walkName, lines, pay, creditDays, payments: [], delivery, whId, invoice, status: 'PENDING', shipFee: fee };
  const t = saleTotals(draft);
  const stock = saleStock(draft, { skus, warehouses, reservations, stockMoves, orders: salesOrders });
  const lastPrice = (kind: SaleLineKind, ref: string) => {
    const hit = salesOrders.filter((o) => o.status !== 'CANCELLED' && (!!custId ? o.customerId === custId : false)).sort((a, b) => b.createdAt - a.createdAt).flatMap((o) => o.lines).find((l) => l.kind === kind && l.ref === ref);
    return hit?.price;
  };
  const vatDef = mfgConfig.vatPct ?? 10;
  // v61: bảng chọn sản phẩm (ảnh, mã - tên (ĐVT), nhóm, hãng, đơn giá, tồn) mở khi bấm vào ô tìm, lật trang 5 mã / trang
  const pickQ = pickFor && pickFor !== 'top' ? rowQ : find;
  const catalog: SalePick[] = useMemo(() => {
    const k = fold(pickQ.trim());
    const hit = (s: string) => !k || fold(s).includes(k);
    if (mfg) {
      const its: SalePick[] = stockItems.filter((x) => x.active && hit(`${x.code} ${x.name}`)).map((x) => ({ kind: 'ITEM', ref: x.id, name: x.name, unit: x.unit, price: x.cost, vat: vatDef, sub: `${x.code} · tồn ${fmtN(stockOf(x.id, stockMoves).qty)} ${x.unit}`, group: 'Vật tư', stock: `${fmtN(stockOf(x.id, stockMoves).qty)} ${x.unit}` }));
      const mk: SalePick[] = priceItems.filter((x) => x.active && (x.unit === 'SET' || x.unit === 'PCS') && hit(`${x.code} ${x.name}`)).map((x) => ({ kind: 'MAKE', ref: x.id, name: x.name, unit: x.unit === 'SET' ? 'bộ' : 'cái', price: x.price, vat: vatDef, sub: `${x.code} · gia công tại xưởng`, group: 'Gia công tại xưởng' }));
      return [...its, ...mk];
    }
    return skus.filter((x) => !x.archived && hit(`${x.sku} ${x.name} ${x.brand} ${x.category}`)).map((x) => {
      const free = Math.max(0, whQty(x, whId, warehouses) - saleHeld(salesOrders, 'SKU', x.sku));
      const lp = lastPrice('SKU', x.sku);
      return { kind: 'SKU' as const, ref: x.sku, name: x.name, unit: x.unit, price: lp ?? tierPrice(x, tier), vat: x.vatPct ?? vatDef, sub: `${x.sku} · tồn ${fmtN(free)} ${x.unit}${lp ? ` · giá đã bán cho khách này ${fmtN(lp)}đ` : ` · ${PRICE_TIER[tier].toLowerCase()}`}`,
        img: x.image, group: x.category, brand: x.brand, stock: `${fmtN(free)} ${x.unit}`, last: !!lp };
    });
  }, [pickQ, mfg, stockItems, stockMoves, priceItems, skus, whId, warehouses, salesOrders, tier, custId]); // eslint-disable-line react-hooks/exhaustive-deps
  const PICK_N = 5;
  const pickMax = Math.max(0, Math.ceil(catalog.length / PICK_N) - 1);
  const pickAt = Math.min(pickPage, pickMax);
  const pickRows = catalog.slice(pickAt * PICK_N, pickAt * PICK_N + PICK_N);
  const add = (p: SalePick) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.kind === p.kind && l.ref === p.ref && !!p.ref);
      if (i >= 0) return ls.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { id: uid('sl'), kind: p.kind, ref: p.ref, name: p.name, unit: p.unit, qty: 1, price: p.price, discountPct: 0, vat: p.vat }];
    });
    setFind('');
  };
  const upd = (id: string, patch: Partial<SaleLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const pickCust = (c: Customer) => {
    // v61: điền sẵn điện thoại / email / người liên hệ từ hồ sơ khách (sửa được cho riêng đơn); người nhận + điện thoại người nhận theo liên hệ chính
    const pm = custContacts(c).find((x) => x.primary) ?? custContacts(c)[0];
    setCustId(c.id); setCustQ(''); setPhone(custPhone(c)); setEmail(custEmail(c)); setContact(pm?.name ?? c.contactName ?? ''); setSaveProfile(false);
    // v61: ô Xuất hóa đơn thuế theo Cài đặt › Bán hàng (tích sẵn mọi đơn / tự tích khi khách có MST)
    setAddress(c.address ?? ''); setInvoice(sd.invoice || (sd.invoiceTax && !!c.taxCode));
    if (!receiver.trim() && (pm?.name || c.contactName)) setReceiver(pm?.name || c.contactName);
    if (!recvPhone.trim() && (pm?.phone || c.contactPhone)) setRecvPhone(pm?.phone || c.contactPhone);
    // v60: tra lại mã số thuế khi chưa tra hoặc lần tra gần nhất quá 30 ngày (máy chủ bật tra cứu)
    tax.reset();
    if (srv.tax && taxKind(c.taxCode) && !(c.taxInfo && taxNorm(c.taxInfo.taxCode) === taxNorm(c.taxCode) && Date.now() - c.taxInfo.at < 30 * 86_400_000)) void lookupCust(c);
    const tr: PriceTier = /EPC|CONTRACT/.test(c.segment) ? 'PROJECT' : 'DEALER';
    setTier(tr);
    if (!mfg) setLines((ls) => ls.map((l) => (l.kind === 'SKU' ? { ...l, price: tierPrice(skus.find((k) => k.sku === l.ref), tr) || l.price } : l)));
  };
  const custHits = custQ.trim().length >= 2 ? customers.filter((c) => fold(`${c.name} ${c.code} ${c.contactPhone} ${c.phone ?? ''} ${c.taxCode}`).includes(fold(custQ.trim()))).slice(0, 6) : [];
  const name = cust?.name ?? walkName.trim();
  const errs: string[] = [];
  if (!lines.length) errs.push('Chưa có hàng hóa');
  if (lines.some((l) => !(l.qty > 0) || l.price < 0)) errs.push('Số lượng phải lớn hơn 0');
  if (lines.some((l) => !l.name.trim())) errs.push('Dòng hàng chưa có tên');
  if (!name) errs.push('Chọn khách trong CRM hoặc nhập tên khách lẻ');
  if (pay === 'CREDIT' && !cust) errs.push('Khách lẻ không ghi công nợ: chọn khách trong CRM');
  if (delivery !== 'PICKUP' && !address.trim()) errs.push('Nhập địa chỉ giao hàng');
  if (email.trim() && !EMAIL_RE.test(email.trim())) errs.push('Email khách chưa đúng định dạng');
  if (code.trim() && salesOrders.some((x) => x.code === code.trim() && x.id !== edit?.id)) errs.push(`Mã đơn ${code.trim()} đã có`);
  cfMissing(cfForm, cfv, 'SAVE').forEach((d) => errs.push(`${d.type === 'check' ? 'Cần tích' : 'Nhập'} ${d.label}`));
  errs.push(...resErrs);
  const short = stock.filter((x) => x.short > 0);
  const finish = () => {
    if (errs.length) return notify(errs[0], 'red');
    const base = { date: todayISO(), source: 'COUNTER' as const, customerId: cust?.id, customer: name, phone: phone.trim() || undefined, taxCode: cust?.taxCode || taxNorm(walkTax) || undefined, address: address.trim() || undefined,
      lines, pay, creditDays: pay === 'CREDIT' || pay === 'PARTIAL' ? creditDays : 0, payments: [], delivery, whId, deliverAt: delivery === 'PICKUP' ? undefined : deliverAt, invoice, shipFee: fee || undefined, note: note.trim() || undefined, status: 'PENDING' as SaleStatus, by: byId || me?.id,
      origin: origin.trim() || undefined, docRef: docRef.trim() || undefined, receiver: receiver.trim() || undefined, ...(code.trim() ? { code: code.trim() } : {}),
      email: email.trim() || undefined, contact: contact.trim() || undefined, recvPhone: recvPhone.trim() || undefined, dept: deptSel || users.find((u) => u.id === (byId || me?.id))?.dept || undefined,
      cf: (() => { const c = cfCompute(cfd.head, cfv); return Object.keys(c).length ? c : undefined; })() };
    // v61: tích "Cập nhật vào hồ sơ khách" (người có quyền sửa khách): ghi điện thoại, email nhận hóa đơn, người liên hệ chính
    if (saveProfile && cust && canCustEdit && profDiff) {
      setCustomers((all) => all.map((c) => {
        if (c.id !== cust.id) return c;
        const nm0 = contact.trim();
        const list = custContacts(c);
        const hit = list.find((x) => fold(x.name) === fold(nm0));
        const next = !nm0 ? list : hit ? list.map((x) => ({ ...x, primary: x.id === hit.id })) : [{ id: uid('ct'), name: nm0, mail: true, primary: true }, ...list.map((x) => ({ ...x, primary: false }))];
        const pm = next.find((x) => x.primary);
        return { ...c, phone: phone.trim() || c.phone, invoiceEmail: email.trim() || c.invoiceEmail, contacts: next, contactName: pm?.name ?? c.contactName, contactTitle: pm ? pm.title ?? '' : c.contactTitle, contactPhone: pm ? pm.phone ?? '' : c.contactPhone, contactEmail: pm ? pm.email ?? '' : c.contactEmail };
      }));
    }
    const now0 = Date.now();
    const approval: SalesOrder['approval'] = needs ? { status: 'PENDING', reasons, requestedAt: now0, requestedBy: me?.id } : { status: 'PENDING', reasons: ['Người lên đơn tự duyệt'], requestedAt: now0, requestedBy: me?.id, self: true };
    let rec = edit ? saveSale({ ...edit, ...base, source: edit.source, date: edit.date, payments: edit.payments, code: edit.code, approval }) : saveSale({ ...base, approval });
    const who = needs ? wfFirstApprovers('SALE', ws).filter((u) => u.id !== me?.id) : [];
    who.forEach((u) => dispatch('APPROVAL_RESULT', { to: u, title: `Đơn bán chờ duyệt: ${name}`, body: `${rec.code} · ${fmtN(t.grand)} sau VAT. ${reasons.join('; ')}`, module: 'sales' }));
    const make = lines.filter((l) => l.kind === 'MAKE');
    if (make.length && me && !edit?.woId) {
      const wo: WorkOrder = {
        id: uid('wo'), code: nextCode(workOrders.map((w) => w.code), `LSX-${new Date().getFullYear()}-`, 4), title: `Đơn bán ${rec.code} (${name})`, customerId: cust?.id, stage: 'WAITING', priority: 'NORMAL',
        startDate: todayISO(), dueDate: addDaysISO(todayISO(), mfgConfig.productionDays || 7), items: make.map((l) => ({ id: uid('wi'), name: l.name, spec: l.note ?? '', unit: l.unit, qty: l.qty, done: 0 })),
        materials: [], qc: [], note: `Gia công cho đơn bán ${rec.code}`, history: [{ stage: 'WAITING', at: Date.now(), by: me.id, note: `Từ đơn bán ${rec.code}` }], createdAt: todayISO(), createdBy: me.id,
      };
      setWorkOrders((p) => [wo, ...p]);
      rec = saveSale({ ...rec, woId: wo.id });
    }
    notify(`Đã ${edit ? 'cập nhật' : 'lưu'} ${rec.code} (ghi nhận doanh số). ${needs ? `Chờ duyệt${who.length ? `: ${who.map((u) => u.name).join(', ')}` : ''}` : 'Bấm Duyệt đơn để xác nhận'}`, 'teal');
    // v60: tệp chọn ở form tải lên sau khi đơn có mã (kho riêng tư theo doanh nghiệp / đơn); lỗi tệp không chặn lưu đơn
    if (pendFiles.length) {
      const saleId = rec.id;
      const room = 10 - (rec.files ?? []).length;
      void uploadSaleFiles(org.id, saleId, pendFiles.slice(0, Math.max(0, room)), me?.id, notify).then((out) => {
        if (out.length) setSalesOrders((all) => all.map((x) => (x.id === saleId ? { ...x, files: [...(x.files ?? []), ...out], notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: `Tải lên ${out.map((f) => f.name).join(', ')}` }] } : x)));
      });
    }
    onDone(rec.id);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F9') { e.preventDefault(); finish(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const cellIn = cn(inputBase, 'w-full min-w-0 px-2 py-1 text-right text-[13px] tabular-nums');
  const now = new Date();
  const pfx = `DH${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(2)}-`;
  const autoCode = nextCode(salesOrders.filter((x) => x.code.startsWith(pfx)).map((x) => x.code), pfx, 2);
  const wd = wfDef('SALE');
  const oweSO = salesOrders.filter((x) => !!custId && x.customerId === custId && saleIssued(x)).reduce((s, x) => s + saleTotals(x).grand - salePaid(x), 0);
  const credit = pay === 'CREDIT' || pay === 'PARTIAL';
  const ws: WfSubject = { requesterId: me?.id, dept: cust?.dept, amount: t.grand, vals: { maxDisc: Math.max(0, ...lines.map((l) => l.discountPct)), overLimit: cust && cust.creditLimit > 0 && credit ? Math.max(0, oweSO + t.grand - cust.creditLimit) : 0, amount: t.grand } };
  const needs = lines.length > 0 && wfNeeds(wd, ws);
  const reasons = needs && wd ? wfReasons(wd, ws) : [];
  const skuBy = (v: string) => { const k = fold(v.trim()); return k ? skus.find((x) => !x.archived && (fold(x.sku) === k || fold(x.name) === k)) : undefined; };
  const fromSku = (id: string, x: SkuItem) => { const lp = lastPrice('SKU', x.sku); upd(id, { kind: 'SKU', ref: x.sku, name: x.name, unit: x.unit, price: lp ?? tierPrice(x, tier), vat: x.vatPct ?? vatDef }); };
  // v61: "Thêm sản phẩm" thêm dòng trống và mở luôn bảng chọn ở ô Tên của dòng mới
  const addRow = () => {
    const n = lines.length + 1;
    setLines((ls) => [...ls, { id: uid('sl'), kind: 'FREE', name: '', unit: 'cái', qty: 1, price: 0, discountPct: 0, vat: vatDef }]);
    requestAnimationFrame(() => (document.querySelector(`input[aria-label="Tên sản phẩm dòng ${n}"]`) as HTMLInputElement | null)?.focus());
  };
  // v61: bảng chọn ở ô Mã / Tên của dòng: vẽ qua portal theo vị trí ô (bảng có khung cuộn ngang nên không đặt bên trong), cuộn trang thì bám theo ô
  const pickAnchor = useRef<HTMLElement | null>(null);
  const placePick = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const w = Math.min(680, window.innerWidth - 32);
    const left = Math.max(16, Math.min(r.left, window.innerWidth - w - 16));
    // không đủ chỗ phía dưới ô (bảng cao ~430px) mà phía trên đủ thì mở lên trên
    const up = r.bottom + 440 > window.innerHeight && r.top - 440 > 56;
    setPickPos(up ? { left, bottom: window.innerHeight - r.top + 4, width: w } : { left, top: r.bottom + 4, width: w });
  };
  const openRowPick = (id: string, el: HTMLElement) => { pickAnchor.current = el; placePick(el); setRowQ(''); setPickPage(0); setPickFor(id); };
  // rời ô: đóng bảng chọn trừ khi con trỏ chuyển sang ô Mã / Tên khác của cùng dòng
  const closeRowPick = (id: string) => setTimeout(() => { if ((document.activeElement as HTMLElement | null)?.dataset.pickRow === id) return; setPickFor((v) => (v === id ? null : v)); }, 150);
  useEffect(() => {
    if (!pickFor || pickFor === 'top') return;
    const h = () => { const el = pickAnchor.current; if (el?.isConnected) placePick(el); else setPickFor(null); };
    window.addEventListener('scroll', h, true); window.addEventListener('resize', h);
    return () => { window.removeEventListener('scroll', h, true); window.removeEventListener('resize', h); };
  }, [pickFor]);
  const fromPick = (id: string, p: SalePick) => { upd(id, { kind: p.kind, ref: p.ref, name: p.name, unit: p.unit, price: p.price, vat: p.vat }); setPickFor(null); };
  const ckd = (l: SaleLine) => Math.round(l.qty * l.price) - saleLineNet(l);
  const sumQty = lines.reduce((s, l) => s + l.qty, 0);
  const DLV: Record<SaleDelivery, string> = { PICKUP: 'Tại kho', DELIVER: 'Giao tận nơi', CARRIER: 'Chành xe' };
  // v60 bố cục mới (theo ảnh đã duyệt 27/11): dải đầu trang + 2 cột Thông tin khách hàng / Thông tin đơn hàng, bảng Sản phẩm toàn chiều ngang,
  // Thông tin giao hàng + khung Thông tin thanh toán. Logic lưu, duyệt, kiểm tra giữ nguyên.
  const secH = 'mb-3.5 flex items-center gap-2 text-[14.5px] font-bold';
  const iconH = 'h-[18px] w-[18px] shrink-0 text-[rgb(var(--secondary-fg))]';
  const dv = (label: string, v: ReactNode, k?: string) => <div className="min-w-0" data-so-dv={k}><p className="text-[12.5px] text-[rgb(var(--fg2))]">{label}</p><div className="mt-0.5 flex min-h-6 min-w-0 items-center gap-2 text-[14px] font-semibold">{v || <span className="font-normal text-[rgb(var(--muted))]">—</span>}</div></div>;
  const byUser = users.find((u) => u.id === byId);
  const deptName = departments.find((d) => d.code === byUser?.dept)?.name ?? byUser?.dept ?? '';
  const originList = saleOriginsOf(mfgConfig);
  const originOpts = Array.from(new Set([...originList.filter((x) => x.active).map((x) => x.name), ...(origin ? [origin] : [])]));
  const addOrigin = () => {
    const nm0 = (srcNew ?? '').trim();
    if (!nm0) return;
    const hit = originList.find((x) => fold(x.name) === fold(nm0));
    if (hit) {
      if (!hit.active) { setMfgConfig((c) => ({ ...c, saleOrigins: saleOriginsOf(c).map((x) => (x.id === hit.id ? { ...x, active: true } : x)) })); audit('SALE_SETTINGS', `Dùng lại nguồn đơn hàng ${hit.name} (từ form tạo đơn)`); }
      setOrigin(hit.name); setSrcNew(null); return;
    }
    setMfgConfig((c) => ({ ...c, saleOrigins: [...saleOriginsOf(c), { id: uid('src'), name: nm0, active: true }] }));
    audit('SALE_SETTINGS', `Thêm nguồn đơn hàng ${nm0} (từ form tạo đơn)`);
    setOrigin(nm0); setSrcNew(null);
    notify(`Đã thêm nguồn đơn hàng ${nm0}`, 'teal');
  };
  const addFree = (nm0: string) => { setLines((ls) => [...ls, { id: uid('sl'), kind: 'FREE', name: nm0.trim(), unit: 'cái', qty: 1, price: 0, discountPct: 0, vat: vatDef }]); setFind(''); setPickOpen(false); };
  // v61 bảng chọn sản phẩm dùng chung cho ô tìm phía trên và ô Mã / Tên của từng dòng
  const pickPanel = (q: string, onPick: (p: SalePick) => void, onNew: () => void, cls: string, style?: CSSProperties) => (
    <div className={cn('w-[680px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-lg', cls)} style={style} onMouseDown={(e) => e.preventDefault()} data-sku-picker>
      <div className="flex items-center gap-2 border-b border-[rgb(var(--line))] px-3 py-2">
        <span className="text-[12.5px] tabular-nums text-[rgb(var(--muted))]">{catalog.length ? `${pickAt * PICK_N + 1} - ${Math.min(catalog.length, pickAt * PICK_N + PICK_N)} / ${catalog.length}` : '0 kết quả'}</span>
        <span className="ml-auto" />
        <button type="button" className={cn(soIco, 'h-8 w-8')} disabled={pickAt === 0} onClick={() => setPickPage(pickAt - 1)} aria-label="Trang trước"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
        <button type="button" className={cn(soIco, 'h-8 w-8')} disabled={pickAt >= pickMax} onClick={() => setPickPage(pickAt + 1)} aria-label="Trang sau"><ChevronRight className="h-4 w-4" aria-hidden /></button>
        <button type="button" className={cn(btnPrimary, btnSm, 'h-8 px-3 text-[13px]')} onClick={onNew} title="Thêm dòng hàng ngoài danh mục (tên vừa gõ)"><Plus className="h-4 w-4" aria-hidden />Thêm mới</button>
      </div>
      <div className="grid grid-cols-[64px_1fr_112px_96px] gap-3 bg-[rgb(var(--ink)/0.035)] px-3 py-1.5 text-[12px] font-semibold text-[rgb(var(--fg2))]"><span>Ảnh</span><span>Sản phẩm</span><span className="text-right">Đơn giá</span><span className="text-right">Tồn</span></div>
      <ul role="listbox" aria-label="Chọn sản phẩm">
        {pickRows.map((p, i) => (
          <li key={`${p.kind}:${p.ref}`} role="option" aria-selected={i === 0 && pickAt === 0}>
            <button type="button" className={cn('grid w-full grid-cols-[64px_1fr_112px_96px] items-center gap-3 border-t border-[rgb(var(--ink)/0.06)] px-3 py-2 text-left hover:bg-[rgb(var(--secondary)/0.06)]', i === 0 && pickAt === 0 && !!q.trim() && 'bg-[rgb(var(--accent)/0.06)]')} onClick={() => onPick(p)}>
              {p.img ? <img src={p.img} alt="" className="h-12 w-12 rounded-md border border-[rgb(var(--line))] object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-md border border-dashed border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.03)] text-[rgb(var(--faint))]" aria-hidden><Package className="h-5 w-5" /></span>}
              <span className="min-w-0">
                <b className="block truncate text-[13.5px] font-semibold">{p.ref && p.kind === 'SKU' ? `${p.ref} - ` : ''}{p.name} <span className="font-normal text-[rgb(var(--muted))]">({p.unit})</span></b>
                <span className="mt-0.5 flex min-w-0 gap-4 text-[12px] text-[rgb(var(--fg2))]"><span className="truncate"><span className="text-[rgb(var(--muted))]">Nhóm:</span> {p.group || '—'}</span><span className="truncate"><span className="text-[rgb(var(--muted))]">Hãng:</span> {p.brand || '—'}</span></span>
              </span>
              <span className="text-right text-[13px] font-semibold tabular-nums">{fmtN(p.price)}{p.last && <span className="block text-[11px] font-normal text-[rgb(var(--secondary-fg))]">giá đã bán</span>}</span>
              <span className="text-right text-[13px] tabular-nums text-[rgb(var(--fg2))]">{p.stock ?? '—'}</span>
            </button>
          </li>
        ))}
        {!pickRows.length && <li className="border-t border-[rgb(var(--ink)/0.06)] px-3 py-5 text-center text-[13px] text-[rgb(var(--muted))]">Không thấy hàng khớp “{q.trim()}”. Bấm Thêm mới để ghi dòng hàng ngoài danh mục</li>}
      </ul>
    </div>
  );
  // gõ trong ô Mã / Tên của dòng: lọc bảng chọn; khớp đúng mã / tên thì điền luôn (quét mã vạch)
  const rowKeys = (id: string) => (e: ReactKeyEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pickFor === id && rowQ.trim() && catalog[0]) { e.preventDefault(); fromPick(id, catalog[0]); }
    else if (e.key === 'Escape' && pickFor === id) { e.stopPropagation(); setPickFor(null); }
  };
  const walk = !cust && !!walkName;
  const vatRates = Array.from(new Set(lines.filter((l) => l.qty > 0).map((l) => l.vat)));
  const discPct = t.gross ? Math.round((t.discount / t.gross) * 10000) / 100 : 0;
  const roCls = cn(inputBase, 'w-full bg-[rgb(var(--ink)/0.035)] text-right tabular-nums text-[rgb(var(--fg))]');
  const custSec = (
    <section aria-label="Thông tin khách hàng" className="relative min-w-0">
      {/* v61: tích "Xuất hóa đơn thuế" (và "Lưu liên hệ vào hồ sơ" khi liên hệ trên đơn khác hồ sơ) nằm cùng hàng tiêu đề, không chiếm hàng riêng */}
      <div className="mb-3.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <h2 className="flex items-center gap-2 text-[14.5px] font-bold" style={HB}><UserIcon className={iconH} aria-hidden />Thông tin khách hàng</h2>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]" data-cust-flags>
          {cust && canCustEdit && profDiff && <label className="flex items-center gap-2 text-[rgb(var(--fg2))]" data-save-profile><input type="checkbox" className="h-4 w-4 shrink-0 accent-[rgb(var(--fg))]" checked={saveProfile} onChange={(e) => setSaveProfile(e.target.checked)} />Lưu liên hệ vào hồ sơ</label>}
          <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 shrink-0 accent-[rgb(var(--fg))]" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} aria-label="Yêu cầu xuất hóa đơn thuế" /><span className="font-semibold">Xuất hóa đơn thuế</span></label>
        </div>
      </div>
      <Field label="Tìm khách hàng">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            {cust || walkName ? (
              <div className={cn(inputBase, 'flex w-full items-center gap-2 border-[rgb(var(--accent))]')}>
                <Building2 className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="min-w-0 truncate font-semibold">{cust?.name ?? walkName}</span><span className="shrink-0 text-[12px] text-[rgb(var(--muted))]">{cust ? cust.code : 'khách lẻ'}</span>
                <button className="ml-auto rounded p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => { setCustId(undefined); setWalkName(''); setWalkTax(''); setPhone(''); setEmail(''); setContact(''); setSaveProfile(false); setTier('BASE'); tax.reset(); }} aria-label="Đổi khách"><X className="h-4 w-4" aria-hidden /></button>
              </div>
            ) : (
              <input className={inputCls} value={custQ} onChange={(e) => { setCustQ(e.target.value); setCustOpen(true); }} onFocus={() => setCustOpen(true)} onBlur={() => setTimeout(() => setCustOpen(false), 150)} placeholder="Tên, mã, SĐT, MST khách hàng" aria-label="Khách hàng" />
            )}
            {!cust && !walkName && custOpen && custQ.trim().length >= 2 && (
              <ul className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden sm:min-w-[640px] sm:max-w-[88vw] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-lg" data-cust-menu>
                <li className="flex flex-wrap gap-x-3 px-3 pb-1 pt-2 text-[12px] text-[rgb(var(--muted))]">Trong danh bạ khách hàng<span className="ml-auto">{TAX_FORMAT_HINT}</span></li>
                {custHits.map((c) => <li key={c.id}><button className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-[13.5px] hover:bg-[rgb(var(--ink)/0.04)]" onMouseDown={(e) => e.preventDefault()} onClick={() => { pickCust(c); setCustOpen(false); }}><span className="truncate font-medium">{c.name}</span><span className="shrink-0 text-[12px] text-[rgb(var(--muted))]">{[c.code, c.taxCode, c.contactPhone].filter(Boolean).join(' · ')}</span></button></li>)}
                {!custHits.length && <li className="px-3 py-1.5 text-[13.5px] text-[rgb(var(--fg2))]">{qTax ? 'Chưa có khách hàng nào dùng mã số thuế này' : 'Không thấy khách phù hợp'}</li>}
                {qTax && (
                  <li className="border-t border-[rgb(var(--line))] px-3 pb-3 pt-2" data-tax-lookup>
                    <p className="mb-1.5 text-[12px] text-[rgb(var(--muted))]">Dữ liệu đăng ký thuế{tax.info && tax.code === qTax ? ` · tra lúc ${taxTime(tax.info.at)}` : ''}</p>
                    {tax.code === qTax && tax.info ? (
                      <>
                        <TaxResultCard info={tax.info} />
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <TaxPortalLink className="text-[13px]" />
                          <span className="ml-auto" />
                          <button className={cn(btnGhost, btnSm)} onMouseDown={(e) => e.preventDefault()} onClick={() => { const i = tax.info!; setWalkName(i.name); setWalkTax(i.taxCode); if (i.address) setAddress(i.address); setInvoice(true); setCustQ(''); setCustOpen(false); }}>Chỉ điền vào đơn</button>
                          <button className={cn(btnPrimary, btnSm)} onMouseDown={(e) => e.preventDefault()} onClick={() => { const i = tax.info!; setCustOpen(false); openCustomerForm(undefined, { quick: true, prefill: { name: i.name, taxCode: i.taxCode, address: i.address ?? '', taxInfo: i }, onSaved: (c) => { pickCust(c); setCustQ(''); } }); }}><UserPlus className="h-4 w-4" aria-hidden />Tạo khách &amp; dùng cho đơn</button>
                        </div>
                      </>
                    ) : <TaxStrip st={tax.code === qTax ? tax : { busy: true }} />}
                  </li>
                )}
                <li className="border-t border-[rgb(var(--line))]"><button className="w-full px-3 py-2 text-left text-[13.5px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]" onMouseDown={(e) => e.preventDefault()} onClick={() => { setWalkName(custQ.trim()); setCustQ(''); setCustOpen(false); }}>Khách lẻ: <b className="font-medium">{custQ.trim()}</b></button></li>
              </ul>
            )}
          </div>
          <button className={soIco} onClick={() => openCustomerForm(undefined, { quick: true, onSaved: (c) => pickCust(c) })} title="Thêm nhanh khách hàng" aria-label="Thêm khách hàng mới"><Plus className="h-4 w-4" aria-hidden /></button>
        </div>
      </Field>
      {cust && taxKind(cust.taxCode) && (taxShown.info || taxShown.busy || taxShown.err
        ? <TaxStrip st={taxShown} name={cust.name} address={cust.address} onRefresh={() => void lookupCust(cust, true)} onUseName={canCustEdit ? (v) => { setCustomers((all) => all.map((x) => (x.id === cust.id ? { ...x, name: v } : x))); notify(`Đã đổi tên khách hàng theo dữ liệu thuế`, 'teal'); } : undefined} onUseAddress={canCustEdit ? useTaxAddress : undefined} />
        : <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => void lookupCust(cust)}><Search className="h-3.5 w-3.5" aria-hidden />Tra cứu mã số thuế {cust.taxCode}</button>)}
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        {dv('Tên khách hàng', cust?.name ?? walkName, 'name')}
        {walk ? (
          <Field label="Mã số thuế (khách lẻ)">
            <div className="flex gap-2"><input className={cn(inputCls, 'font-mono')} value={walkTax} onChange={(e) => setWalkTax(e.target.value)} placeholder="Không bắt buộc" aria-label="Mã số thuế khách lẻ" /><button type="button" className={cn(btnGhost, 'shrink-0 px-2.5')} disabled={!taxKind(walkTax) || tax.busy} onClick={() => void tax.run(walkTax, true)} aria-label="Tra cứu mã số thuế khách lẻ"><Search className="h-4 w-4" aria-hidden /></button></div>
          </Field>
        ) : dv('Mã số thuế', cust?.taxCode ? <span className="font-mono text-[13px] font-medium">{cust.taxCode}{taxShown.info && textSame(taxShown.info.name, cust.name) && <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-[rgb(var(--success)/0.12)] px-1.5 py-0.5 font-sans text-[11px] font-medium text-[rgb(var(--success-fg))]"><BadgeCheck className="h-3 w-3" aria-hidden />Khớp</span>}</span> : '', 'tax')}
        <div className="col-span-2">{dv('Địa chỉ', cust ? cust.address : walk ? address : '', 'addr')}</div>
      </div>
      {walk && taxKind(walkTax) && <TaxStrip st={tax.code === taxNorm(walkTax) ? tax : { busy: false }} name={walkName} address={address} onUseName={(v) => setWalkName(v)} onUseAddress={(v) => setAddress(v)} />}
      {/* v61: liên hệ nhập thẳng trên đơn (khách trong danh bạ điền sẵn từ hồ sơ, sửa được cho riêng đơn) */}
      <div className="mt-3.5 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        <Field label="Người liên hệ">
          <input className={inputCls} value={contact} list="so-cust-contacts" onChange={(e) => { const v = e.target.value; setContact(v); const hit = cust ? custContacts(cust).find((x) => x.name === v) : undefined; if (hit) { if (hit.phone && !phone.trim()) setPhone(hit.phone); if (hit.email && !email.trim()) setEmail(hit.email); } }} placeholder="Họ tên người liên hệ" aria-label="Người liên hệ" />
        </Field>
        <Field label="Điện thoại"><input type="tel" inputMode="tel" className={cn(inputCls, 'tabular-nums')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại khách" aria-label="Điện thoại khách" /></Field>
        <Field label="Email nhận hóa đơn"><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email nhận hóa đơn" aria-label="Email khách" /></Field>
        <Field label="Nguồn chứng từ (Số PO / hợp đồng…)"><input className={inputCls} value={docRef} onChange={(e) => setDocRef(e.target.value)} placeholder="PO, hợp đồng" aria-label="Nguồn chứng từ" /></Field>
        {cust && <datalist id="so-cust-contacts">{custContacts(cust).map((x) => <option key={x.id} value={x.name}>{[x.title, x.phone].filter(Boolean).join(' · ')}</option>)}</datalist>}
      </div>
    </section>
  );
  const orderSec = (
    <section aria-label="Thông tin đơn hàng" className="min-w-0">
      <h2 className={secH} style={HB}><ClipboardList className={iconH} aria-hidden />Thông tin đơn hàng</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Mã đơn hàng"><input className={cn(inputCls, 'font-mono')} value={code} disabled={!!edit} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={autoCode} aria-label="Mã đơn hàng" /></Field>
        <Field label="Ngày đặt hàng"><input className={roCls.replace('text-right', 'text-left')} readOnly value={fmtDate(edit?.date ?? todayISO())} aria-label="Ngày đặt hàng" /></Field>
        {/* v61: mặc định theo tài khoản lên đơn; người có quyền quản lý đơn (sale.manage) chuyển được cho người / phòng ban khác */}
        <Field label="Người thực hiện *"><select className={inputCls} value={byId} disabled={!canAssign} title={canAssign ? undefined : 'Cần quyền quản lý đơn để chuyển cho người khác'} onChange={(e) => { setById(e.target.value); setDeptSel(''); }} aria-label="Người thực hiện">{users.filter((u) => u.active || u.id === byId).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Phòng ban"><select className={inputCls} value={deptSel || byUser?.dept || ''} disabled={!canAssign} onChange={(e) => setDeptSel(e.target.value === byUser?.dept ? '' : e.target.value)} aria-label="Phòng ban">{!(deptSel || byUser?.dept) && <option value="">—</option>}{departments.filter((d) => d.active || d.code === (deptSel || byUser?.dept)).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}{!!(deptSel || byUser?.dept) && !departments.some((d) => d.code === (deptSel || byUser?.dept)) && <option value={deptSel || byUser?.dept}>{deptName || deptSel}</option>}</select></Field>
        {!mfg && <Field label="Kho xuất *"><select className={inputCls} value={whId} onChange={(e) => setWhId(e.target.value)} aria-label="Kho xuất">{warehouses.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>}
        {/* v61: nguồn đơn hàng chọn trong danh mục (Cài đặt › Bán hàng); nút + thêm nhanh ngay tại đây */}
        <div className="relative min-w-0">
          <Field label="Nguồn đơn hàng">
            <div className="flex gap-2">
              <select className={inputCls} value={origin} onChange={(e) => setOrigin(e.target.value)} aria-label="Nguồn đơn hàng">
                {!origin && <option value="">Chọn nguồn</option>}
                {originOpts.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
              <button type="button" className={cn(soIco, 'h-[38px] w-[38px]')} onClick={() => setSrcNew((v) => (v === null ? '' : null))} aria-label="Thêm nguồn đơn hàng" aria-expanded={srcNew !== null} title="Thêm nguồn đơn hàng"><Plus className="h-4 w-4" aria-hidden /></button>
            </div>
          </Field>
          {srcNew !== null && <AddNamePop title="Thêm nguồn" value={srcNew} onChange={setSrcNew} onCancel={() => setSrcNew(null)} onSave={addOrigin} placeholder="VD: Hội chợ, Facebook" />}
        </div>
        <Field label="Tài liệu liên quan" className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-2" data-pend-files>
            <button type="button" className={cn(btnGhost, btnSm)} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" aria-hidden />Thêm tài liệu</button>
            <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { const fs: File[] = e.target.files ? Array.from(e.target.files) : []; const room = 10 - (edit?.files ?? []).length - pendFiles.length; if (fs.length > room) notify('Mỗi đơn tối đa 10 tệp', 'orange'); setPendFiles((p) => [...p, ...fs.slice(0, Math.max(0, room))]); e.target.value = ''; }} aria-label="Chọn tài liệu liên quan" />
            {(edit?.files ?? []).map((f) => <span key={f.id} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] px-2.5 text-[13px]"><Paperclip className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /><span className="max-w-[180px] truncate">{f.name}</span></span>)}
            {pendFiles.map((f, i) => <span key={`${f.name}-${i}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] px-2.5 text-[13px]"><FileText className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /><span className="max-w-[180px] truncate">{f.name}</span><span className="text-[12px] tabular-nums text-[rgb(var(--muted))]">{Math.max(1, Math.round(f.size / 1024))} KB</span><button type="button" className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setPendFiles((p) => p.filter((_, j) => j !== i))} aria-label={`Bỏ ${f.name}`}><X className="h-3.5 w-3.5" aria-hidden /></button></span>)}
          </div>
        </Field>
      </div>
      {/* v61: chỉ hiện khi khách đang có công nợ */}
      <SoDebt customerId={custId} extra={credit ? t.grand : 0} exceptId={edit?.id} box />
    </section>
  );
  return (
    <div className="glass-card min-w-0 rounded-xl" data-sale-form>
      <SoBand crumb={`${term('saleList')} \\ ${edit ? term('editSale') : term('createSale')}`} onCrumb={() => onDone(edit?.id)} chips={edit ? <><Code>{edit.code}</Code><Chip>Sửa xong phải duyệt lại</Chip></> : undefined}>
        <button className={btnGhost} onClick={() => onDone(edit?.id)}><ArrowLeft className="h-4 w-4" aria-hidden />Quay lại</button>
        <button className={btnPrimary} onClick={finish} title="Phím tắt F9"><Send className="h-4 w-4" aria-hidden />{edit ? 'Lưu thay đổi' : needs ? 'Lưu & gửi duyệt' : 'Lưu đơn'}<kbd className="ml-1 rounded border border-current/40 px-1 font-mono text-[10px] opacity-70">F9</kbd></button>
      </SoBand>
      <div className="grid grid-cols-1 gap-x-9 gap-y-7 px-6 pb-2 pt-5 max-sm:px-4 xl:grid-cols-2">{custSec}{orderSec}</div>
      <div className="min-w-0 space-y-4 px-6 pt-5 max-sm:px-4">
          <SoCard pad={false} className="!rounded-xl !border-[rgb(var(--line))] !shadow-none" title={<span className="flex items-center gap-2 font-bold"><Package className={iconH} aria-hidden />Sản phẩm <span className="text-[12.5px] font-normal text-[rgb(var(--muted))]">{lines.length} dòng</span></span>} action={<>
            <div className="relative w-[300px] max-sm:w-[168px]">
              <input className={inputCls} value={find} onFocus={() => setPickOpen(true)} onBlur={() => setTimeout(() => setPickOpen(false), 150)} onChange={(e) => { setFind(e.target.value); setPickPage(0); setPickOpen(true); }} placeholder={mfg ? 'Tìm vật tư, sản phẩm gia công' : 'Quét mã vạch hoặc gõ tìm nhanh'} aria-label="Tìm hàng hóa" aria-expanded={pickOpen}
                onKeyDown={(e) => { if (e.key === 'Enter' && catalog[0] && find.trim()) { e.preventDefault(); add(catalog[0]); } else if (e.key === 'Escape') setPickOpen(false); }} />
              {/* v61 bảng chọn sản phẩm: ảnh, mã - tên (ĐVT), nhóm, hãng, đơn giá, tồn; lật trang; Thêm mới = dòng hàng ngoài danh mục */}
              {pickOpen && pickPanel(find, (p) => { add(p); setPickFor(null); }, () => addFree(find), 'absolute right-0 top-full z-30 mt-1')}
            </div>
            {!mfg && <select className={cn(inputBase, 'w-36 max-sm:w-28')} value={tier} onChange={(e) => { const tr = e.target.value as PriceTier; setTier(tr); setLines((ls) => ls.map((l) => (l.kind === 'SKU' ? { ...l, price: tierPrice(skus.find((k) => k.sku === l.ref), tr) || l.price } : l))); }} aria-label="Bảng giá">{(['BASE', 'DEALER', 'PROJECT'] as PriceTier[]).map((x) => <option key={x} value={x}>{PRICE_TIER[x]}</option>)}</select>}
          </>}>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13.5px]">
                <thead><tr className="border-y border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.035)] [&>th]:font-semibold [&>th]:text-[rgb(var(--fg))]"><th className={cn(soTh, 'w-10 pl-5')}>#</th><th className={cn(soTh, 'w-[150px]')}>Mã sản phẩm</th><th className={soTh}>Tên sản phẩm</th><th className={cn(soTh, 'w-16')}>ĐVT</th><th className={cn(soTh, 'w-20 text-right')}>Tồn kho</th><th className={cn(soTh, 'w-20 text-right')}>Số lượng</th><th className={cn(soTh, 'w-28 text-right')}>Đơn giá</th><th className={cn(soTh, 'w-16 text-right')}>CK%</th><th className={cn(soTh, 'w-24 text-right')}>CK (đ)</th><th className={cn(soTh, 'w-20 text-right')}>VAT%</th><th className={cn(soTh, 'w-28 text-right')}>Thành tiền</th><th className={cn(soTh, 'w-10 pr-5')}><span className="sr-only">Xóa</span></th></tr></thead>
                <tbody>
                  {stock.map(({ l, short: s, track, res, free }, i) => (
                    <tr key={l.id} className="border-b border-[rgb(var(--ink)/0.06)]">
                      <td className={cn(soTd, 'pl-5 text-[rgb(var(--muted))]')}>{i + 1}</td>
                      <td className={soTd}>{l.kind === 'SKU' || l.kind === 'FREE' ? <input className={cn(inputBase, 'w-full min-w-0 px-2 py-1 font-mono text-[12.5px]')} value={l.ref ?? ''} onFocus={(e) => openRowPick(l.id, e.currentTarget)} onBlur={() => closeRowPick(l.id)} onKeyDown={rowKeys(l.id)} onChange={(e) => { if (pickFor !== l.id) openRowPick(l.id, e.currentTarget); setRowQ(e.target.value); setPickPage(0); const x = mfg ? undefined : skuBy(e.target.value); if (x) fromSku(l.id, x); else upd(l.id, { kind: 'FREE', ref: e.target.value || undefined }); }} aria-label={`Mã sản phẩm dòng ${i + 1}`} aria-expanded={pickFor === l.id} data-pick-row={l.id} /> : <Code>{l.ref ?? '—'}</Code>}</td>
                      <td className={soTd}>{l.kind === 'SKU' || l.kind === 'FREE' ? <input className={cn(inputBase, 'w-full min-w-[180px] px-2 py-1 text-[13.5px]')} value={l.name} onFocus={(e) => openRowPick(l.id, e.currentTarget)} onBlur={() => closeRowPick(l.id)} onKeyDown={rowKeys(l.id)} onChange={(e) => { if (pickFor !== l.id) openRowPick(l.id, e.currentTarget); setRowQ(e.target.value); setPickPage(0); const x = mfg ? undefined : skuBy(e.target.value); if (x && l.kind === 'FREE') fromSku(l.id, x); else upd(l.id, { name: e.target.value }); }} placeholder="Gõ tên hoặc chọn trong danh mục" aria-label={`Tên sản phẩm dòng ${i + 1}`} aria-expanded={pickFor === l.id} data-pick-row={l.id} title={l.name} /> : <span className="block max-w-[260px] truncate font-medium" title={l.name}>{l.name}</span>}</td>
                      <td className={cn(soTd, 'text-[rgb(var(--muted))]')}>{l.kind === 'FREE' ? <input className={cn(inputBase, 'w-14 px-2 py-1 text-[13px]')} value={l.unit} onChange={(e) => upd(l.id, { unit: e.target.value })} aria-label="Đơn vị tính" /> : l.unit}</td>
                      <td className={cn(soTd, 'text-right tabular-nums', s > 0 && 'text-[rgb(var(--accent-fg))]')} title={s > 0 ? `Thiếu ${fmtN(s)}` : undefined}>{track ? <span className="inline-flex items-center gap-1">{s > 0 && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}{fmtN(res + free)}</span> : '—'}</td>
                      <td className={soTd}><input className={cn(cellIn, s > 0 && 'border-[rgb(var(--danger))]')} inputMode="decimal" value={l.qty} onChange={(e) => upd(l.id, { qty: Math.max(0, Number(e.target.value.replace(',', '.')) || 0) })} aria-label={`Số lượng ${l.name}`} /></td>
                      <td className={soTd}><input className={cellIn} inputMode="numeric" value={l.price ? fmtN(l.price) : ''} onChange={(e) => upd(l.id, { price: digits(e.target.value) })} aria-label={`Đơn giá ${l.name}`} /></td>
                      <td className={soTd}><input className={cellIn} inputMode="decimal" value={l.discountPct || ''} onChange={(e) => upd(l.id, { discountPct: Math.min(100, Math.max(0, Number(e.target.value.replace(',', '.')) || 0)) })} placeholder="0" aria-label={`Chiết khấu % ${l.name}`} /></td>
                      <td className={soTd}><input className={cellIn} inputMode="numeric" value={ckd(l) ? fmtN(ckd(l)) : ''} onChange={(e) => { const g = Math.round(l.qty * l.price); const v = Math.min(g, digits(e.target.value)); upd(l.id, { discountPct: g ? Math.round((v / g) * 10000) / 100 : 0 }); }} placeholder="0" aria-label={`Chiết khấu tiền ${l.name}`} /></td>
                      <td className={soTd}><select className={cn(inputBase, 'w-full px-1.5 py-1 text-right text-[13px]')} value={l.vat} onChange={(e) => upd(l.id, { vat: Number(e.target.value) })} aria-label={`VAT ${l.name}`}>{[0, 5, 8, 10].map((v) => <option key={v} value={v}>{v}</option>)}</select></td>
                      <td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(saleLineNet(l))}</td>
                      <td className={cn(soTd, 'pr-5 text-right')}><button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))} aria-label={`Xóa dòng ${i + 1}`}><Trash2 className="h-4 w-4" aria-hidden /></button></td>
                    </tr>
                  ))}
                  <tr className="border-b border-[rgb(var(--ink)/0.06)]"><td /><td colSpan={11} className="py-2.5"><button className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[rgb(var(--accent-fg))] hover:underline" onClick={addRow}><Plus className="h-4 w-4" aria-hidden />Thêm sản phẩm</button></td></tr>
                  {lines.length > 0 && (
                    <tr className="bg-[rgb(var(--ink)/0.03)]">
                      <td /><td colSpan={4} className={cn(soTd, 'text-[rgb(var(--muted))]')}>Cộng {fmtN(sumQty)} đơn vị · {lines.length} mặt hàng</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(sumQty)}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.gross)}</td><td />
                      <td className={cn(soTd, 'text-right tabular-nums')}>{t.discount ? `−${fmtN(t.discount)}` : '0'}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.vat)}</td>
                      <td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(t.net)}</td><td />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {(short.length > 0 || reasons.length > 0) && (
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-5 py-3">
                {short.map((x) => <Chip key={x.l.id} tone="orange">{x.l.ref ?? x.l.name} thiếu {fmtN(x.short)}</Chip>)}
                {reasons.map((r) => <Chip key={r} tone="orange">{r}</Chip>)}
              </div>
            )}
            {pickFor && pickFor !== 'top' && pickPos && lines.some((l) => l.id === pickFor) && createPortal(pickPanel(rowQ, (p) => fromPick(pickFor, p), () => { upd(pickFor, { kind: 'FREE', name: rowQ.trim() || lines.find((l) => l.id === pickFor)?.name || '' }); setPickFor(null); }, 'fixed z-[60]', { left: pickPos.left, top: pickPos.top, bottom: pickPos.bottom, width: pickPos.width }), document.body)}
          </SoCard>
      </div>
      <div className="grid grid-cols-1 gap-x-9 gap-y-7 px-6 pb-6 pt-6 max-sm:px-4 xl:grid-cols-2">
        <section aria-label="Thông tin giao hàng" className="min-w-0">
          <h2 className={secH} style={HB}><Truck className={iconH} aria-hidden />Thông tin giao hàng</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2" role="radiogroup" aria-label="Giao nhận">
            {(Object.keys(DLV) as SaleDelivery[]).map((d) => (
              <button key={d} type="button" role="radio" aria-checked={delivery === d} onClick={() => setDelivery(d)} className="inline-flex items-center gap-2 text-[13.5px]">
                <span className={cn('grid h-4 w-4 place-items-center rounded-full border-[1.5px]', delivery === d ? 'border-[rgb(var(--secondary))]' : 'border-[rgb(var(--ink)/0.35)]')} aria-hidden>{delivery === d && <i className="h-2 w-2 rounded-full bg-[rgb(var(--secondary))]" />}</span>{DLV[d]}
              </button>
            ))}
          </div>
          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Người nhận"><input className={inputCls} value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="Tên người nhận" aria-label="Người nhận" /></Field>
            <Field label="Điện thoại người nhận"><input type="tel" className={cn(inputCls, 'tabular-nums')} value={recvPhone} onChange={(e) => setRecvPhone(e.target.value)} placeholder="Số điện thoại người nhận" inputMode="tel" aria-label="Điện thoại người nhận" /></Field>
            {delivery !== 'PICKUP' && <Field label="Ngày giao dự kiến"><input type="date" className={inputCls} value={deliverAt} onChange={(e) => setDeliverAt(e.target.value)} aria-label="Ngày giao" /></Field>}
            {delivery !== 'PICKUP' && <Field label="Địa chỉ giao hàng" className="sm:col-span-2"><input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Số nhà, đường, phường / xã, tỉnh / thành phố" aria-label="Địa chỉ giao hàng" /></Field>}
            <Field label="Ghi chú cho kho / giao vận" className="sm:col-span-2"><textarea className={cn(inputCls, 'min-h-[64px] resize-y')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Giờ giao, gọi trước, gửi nhà xe…" aria-label="Ghi chú" /></Field>
          </div>
        </section>
        <section aria-label="Thông tin thanh toán" className="min-w-0 rounded-xl border border-[rgb(var(--secondary)/0.16)] bg-[rgb(var(--secondary)/0.05)] p-5" data-so-paybox>
          <h2 className={secH} style={HB}><Wallet className={iconH} aria-hidden />Thông tin thanh toán</h2>
          {/* v61: một lưới 3 cột cho mọi dòng (nhãn | % | số tiền): ô nhập thẳng mép trái / phải, nhãn không kèm ghi chú */}
          <div className="grid grid-cols-[1fr_88px_184px] items-center gap-x-2.5 gap-y-2.5 text-[13.5px] max-sm:grid-cols-[1fr_68px_128px] max-sm:gap-x-2" data-pay-grid>
            <b className="font-bold">Tổng tiền hàng</b><input className={cn(roCls, 'col-span-2 font-semibold')} readOnly value={fmtN(t.gross)} aria-label="Tổng tiền hàng" />
            <b className="font-bold">Phương thức thanh toán</b>
            <select className={cn(inputCls, 'col-span-2')} value={credit ? 'CREDIT' : pay} onChange={(e) => setPay(e.target.value as SalePay)} aria-label="Thanh toán"><option value="CASH">Tiền mặt</option><option value="BANK">Chuyển khoản</option><option value="CREDIT">Công nợ</option></select>
            {credit && <><b className="font-bold">Số ngày công nợ</b><div className="relative col-span-2"><input className={cn(inputCls, 'pr-14 text-right tabular-nums')} inputMode="numeric" value={creditDays} onChange={(e) => setCreditDays(digits(e.target.value))} aria-label="Hạn trả (ngày)" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-[rgb(var(--muted))]">ngày</span></div></>}
            <b className="font-bold">Chiết khấu</b><input className={roCls} readOnly value={`${String(discPct).replace('.', ',')} %`} aria-label="Chiết khấu phần trăm" /><input className={roCls} readOnly value={t.discount ? fmtN(t.discount) : '0'} aria-label="Chiết khấu" />
            <b className="font-bold">Phí vận chuyển</b><span aria-hidden /><MoneyInput value={fee} onChange={setShipFee} disabled={delivery === 'PICKUP'} label="Phí vận chuyển" />
            <b className="font-bold">Thuế VAT</b><input className={roCls} readOnly value={vatRates.length > 1 ? 'nhiều mức' : `${vatRates[0] ?? 0} %`} aria-label="Thuế suất" /><input className={roCls} readOnly value={fmtN(t.vat)} aria-label="Thuế VAT" />
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-[rgb(var(--secondary)/0.2)] pt-3.5"><b className="text-[15px] font-bold">Tổng cộng</b><b className="font-archivo text-[24px] font-bold tabular-nums text-[rgb(var(--accent-fg))]" data-so-grand>{fmtN(t.grand)}</b></div>
          {needs && <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-[rgb(var(--accent-fg))]" data-so-needs><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />Cần duyệt: {reasons.join('; ')}</p>}
        </section>
      </div>
      {fl.sections.length > 0 && (
        <section className="border-t border-[rgb(var(--line))] px-6 py-5" aria-label={fl.title || 'Thông tin thêm'}>
          <h2 className={secH} style={HB}><ClipboardList className={iconH} aria-hidden />{fl.title || 'Thông tin thêm'}</h2>
          <DynamicFieldRenderer mode="edit" sections={fl.sections} avail={lSaleAvail('form', cfd.head)} required={fl.defs} vals={cfv} onChange={(k, v) => setCfv((p) => cfSet(p, k, v))} users={users} nameOf={nameOf} recordId={edit?.id} />
        </section>
      )}
    </div>
  );
}

/** Bảng tồn từng dòng + các bước CRM đã làm; dùng ở chi tiết đơn và ở báo giá đã chốt */
/** v58: bảng trượt Giao hàng — hàng còn phải giao, tồn khả dụng, lịch sử phiếu xuất / nhập trả; gửi yêu cầu xuất kho (hoặc lệnh sản xuất với hàng gia công) */
export function SaleIssueDrawer({ o, onClose, view }: { o: SalesOrder; onClose: () => void; /** v60: chỉ xem (mở từ nút Thông tin xuất hàng khi đơn chưa đủ điều kiện gửi kho) */ view?: boolean }) {
  const { stockVouchers, requestSaleIssue, users } = useApp();
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const pq = salePendingQ(o, stockVouchers);
  const vs = stockVouchers.filter((v) => v.saleId === o.id || (!v.saleId && v.ref === o.code)).sort((a, b) => b.createdAt - a.createdAt);
  const make = o.lines.some((l) => l.kind === 'MAKE') && !o.lines.some((l) => l.kind === 'SKU' && !!l.ref);
  const rows = o.lines.filter((l) => l.kind !== 'FREE').map((l) => ({ l, iss: saleIssQ(o, l), pend: pq[l.id] ?? 0, rest: Math.max(0, l.qty - saleIssQ(o, l) - (pq[l.id] ?? 0)) }));
  const rest = rows.reduce((s, r) => s + r.rest, 0);
  const send = () => { if (requestSaleIssue(o.id)) onClose(); };
  return (
    <Drawer size="lg" title={view ? `Thông tin xuất hàng · ${o.code}` : `${make ? 'Lệnh sản xuất' : 'Yêu cầu xuất kho'} · ${o.code}`} eyebrow="Giao hàng" onClose={onClose}
      footer={<div className="flex flex-wrap items-center justify-end gap-2" data-issue-actions><span className="mr-auto text-[13px] tabular-nums text-[rgb(var(--muted))]">Còn phải giao {fmtN(rest)}{view && o.approval?.status === 'PENDING' ? ' · gửi kho sau khi đơn được duyệt' : ''}</span><button className={btnGhost} onClick={onClose}>Đóng</button>{!view && <button className={btnPrimary} disabled={!rest} onClick={send}><PackageMinus className="h-4 w-4" aria-hidden />{make ? 'Gửi lệnh sản xuất' : 'Gửi yêu cầu xuất kho'}</button>}</div>}>
      <section>
        <p className="mb-2 text-[14px] font-medium">Hàng còn phải giao</p>
        <table className="w-full text-[13.5px]">
          <thead><tr className="border-b border-[rgb(var(--line))]"><th className={cn(soTh, 'pl-0')}>Hàng hóa</th><th className={cn(soTh, 'text-right')}>Đặt</th><th className={cn(soTh, 'text-right')}>Đã xuất</th><th className={cn(soTh, 'text-right')}>Chờ kho</th><th className={cn(soTh, 'text-right')}>Còn lại</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.l.id} className="border-b border-[rgb(var(--ink)/0.06)]"><td className={cn(soTd, 'pl-0')}><span className="block max-w-[360px] truncate" title={r.l.name}>{r.l.name}</span></td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(r.l.qty)}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(r.iss)}</td><td className={cn(soTd, 'text-right tabular-nums')}>{r.pend ? fmtN(r.pend) : '—'}</td><td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(r.rest)}</td></tr>)}</tbody>
        </table>
      </section>
      {rest > 0 && !make && <SaleStockCard o={o} />}
      <section>
        <p className="mb-2 text-[14px] font-medium">Lịch sử giao hàng</p>
        {vs.length ? <ul className="space-y-1.5">{vs.map((v) => (
          <li key={v.id} className="flex items-center gap-2 text-[13.5px]"><Code>{v.code}</Code><span>{v.type === 'IN' ? 'Nhập trả' : 'Phiếu xuất'}</span><span className="tabular-nums text-[rgb(var(--fg2))]">{fmtDate(v.date)}</span><span className="tabular-nums">{fmtN(v.lines.reduce((s, l) => s + l.qty, 0))}</span><span className="ml-auto text-[12.5px] text-[rgb(var(--muted))]">{nm(v.approvedBy ?? v.requestedBy)}</span><Chip tone={v.status === 'PENDING' ? 'orange' : v.status === 'DONE' ? 'teal' : 'muted'}>{v.status === 'PENDING' ? 'Chờ kho' : v.status === 'DONE' ? (v.type === 'IN' ? 'Đã nhập' : 'Đã xuất') : 'Đã hủy'}</Chip></li>
        ))}</ul> : <p className="text-[13px] text-[rgb(var(--muted))]">Chưa có phiếu xuất</p>}
      </section>
    </Drawer>
  );
}

export function SaleStockCard({ o, compact: small, onOpen }: { o: SalesOrder; compact?: boolean; onOpen?: () => void }) {
  const { skus, warehouses, reservations, stockMoves, salesOrders, pos, workOrders, purchaseForSale, splitSale, company, canDo } = useApp();
  const mfg = bizMode(company) === 'MFG';
  const st = saleStock(o, { skus, warehouses, reservations, stockMoves, orders: salesOrders });
  const short = st.filter((x) => x.short > 0);
  const wh = warehouses.find((w) => w.id === o.whId);
  const myPos = pos.filter((p) => o.poIds?.includes(p.id));
  const wo = o.woId ? workOrders.find((w) => w.id === o.woId) : undefined;
  const open = o.status === 'PENDING';
  return (
    <section className="glass-card rounded-xl p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-[14px] font-medium">{small ? 'Đơn bán tự tạo khi chốt' : 'Hàng hóa và tồn kho'}</h3>
        <span className="text-[12.5px] text-[rgb(var(--muted))]">{small ? <><Code>{o.code}</Code> · {SALE_STATUS[o.status].label}</> : wh ? `${wh.name}` : ''}</span>
        {onOpen && <button className={cn(btnGhost, btnSm, 'ml-auto')} onClick={onOpen}>Xem đơn bán</button>}
      </div>
      {/* v60: điện thoại cuộn trong khung (nhãn Xử lý không xuống dòng), không làm tràn ngang trang */}
      <div className="overflow-x-auto">
      <table className="mt-2 w-full text-[13px]">
        <thead><tr className="border-b border-[rgb(var(--line))] text-left text-[12px] text-[rgb(var(--muted))]"><th className="py-1.5 font-normal">Hàng hóa</th><th className="text-right font-normal">Cần</th><th className="text-right font-normal">{mfg ? 'Tồn' : `Tồn ${wh?.code ?? ''}`}</th><th className="pl-3 font-normal">Xử lý</th></tr></thead>
        <tbody>
          {st.map((x) => (
            <tr key={x.l.id} className="border-b border-[rgb(var(--ink)/0.05)]">
              <td className="py-1.5"><span className="block max-w-[220px] truncate max-sm:max-w-[140px]">{x.l.name}</span></td>
              <td className="text-right tabular-nums">{fmtN(x.l.qty)}</td>
              <td className="text-right tabular-nums">{x.track ? fmtN(x.free + x.res) : '—'}</td>
              <td className="pl-3">{o.status !== 'PENDING' ? <Chip tone="muted">{saleIssued(o) ? 'Đã xuất' : 'Đã hủy'}</Chip> : x.l.kind === 'MAKE' ? <Chip tone="blue">{wo ? `${wo.code} · ${wo.stage === 'DONE' ? 'xong' : 'đang làm'}` : 'Gia công'}</Chip> : !x.track ? <Chip tone="muted">Không trừ kho</Chip> : x.short > 0 ? <Chip tone="orange">Thiếu {fmtN(x.short)}</Chip> : <Chip tone="teal">Đủ · giữ {fmtN(x.l.qty)}{x.res ? `, ${fmtN(Math.min(x.res, x.l.qty))} hàng về theo PO` : ''}</Chip>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {open && short.length > 0 && (
        <div className="mt-3 rounded-lg bg-[rgb(var(--accent)/0.08)] px-3 py-2.5 text-[13px]">
          <p>Thiếu {short.map((x) => `${fmtN(x.short)} ${x.l.unit} ${x.l.name}`).join(', ')}.{myPos.length ? ` Đã đặt ${myPos.map((p) => p.code).join(', ')}, hàng về tự giữ cho đơn.` : ''}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {!mfg && !myPos.length && <button className={cn(btnPrimary, btnSm)} onClick={() => purchaseForSale(o.id)} disabled={!canDo('po.manage')} title={canDo('po.manage') ? 'Lập phiếu đặt hàng nhà cung cấp cho phần thiếu' : 'Cần quyền Đặt hàng Hãng'}>Tạo phiếu đặt hàng</button>}
            {st.some((x) => x.have > 0 && x.track) && <button className={cn(btnGhost, btnSm)} onClick={() => splitSale(o.id)}>Giao trước phần có sẵn</button>}
          </div>
        </div>
      )}
      {small && (
        <ol className="mt-3 space-y-2 text-[13px]">
          <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--ok)/0.15)] text-[11px] text-[rgb(var(--ok-fg))]">1</span><span>Tạo đơn bán {o.code}, lấy nguyên giá, chiết khấu, VAT, hạn thanh toán từ báo giá</span></li>
          <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--ok)/0.15)] text-[11px] text-[rgb(var(--ok-fg))]">2</span><span>Giữ hàng cho {st.filter((x) => x.track && !x.short).length} mã đủ tồn; trừ tồn thật khi bấm Xuất kho, hủy đơn thì nhả hàng</span></li>
          {short.length > 0 && <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--accent)/0.15)] text-[11px] text-[rgb(var(--accent-fg))]">3</span><span>Đề xuất mua {short.length} mã thiếu{myPos.length ? `: đã lập ${myPos.map((p) => p.code).join(', ')}` : ''}</span></li>}
          <li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[rgb(var(--ink)/0.08)] text-[11px]">{short.length ? 4 : 3}</span><span>Ghi công nợ phải thu {fmtN(saleTotals(o).grand)} khi xuất kho{o.creditDays ? `, hạn ${o.creditDays} ngày` : ''}</span></li>
        </ol>
      )}
    </section>
  );
}

/** v51: phiếu yêu cầu xuất hóa đơn: thông tin người mua kế thừa từ khách hàng, hàng hóa kế thừa từ đơn (đổi được tên trên hóa đơn) */
export function SaleInvoiceForm({ o, onClose }: { o: SalesOrder; onClose: () => void }) {
  const { customers, setCustomers, requestSaleInvoice, notify } = useApp();
  const cust = customers.find((c) => c.id === o.customerId);
  const prev = (o.invReqs ?? []).filter((r) => r.status !== 'REJECTED');
  const usedQ = (id: string) => prev.reduce((s, r) => s + (r.items ?? []).filter((x) => x.lineId === id).reduce((a, x) => a + x.qty, 0), 0);
  // v61: email / người liên hệ ghi trên đơn được ưu tiên (khách lẻ chỉ có trên đơn), trống thì theo hồ sơ khách
  const init: SaleInvBuyer = { name: cust?.name ?? o.customer, taxCode: o.taxCode || cust?.taxCode || '', address: cust?.address || o.address || '', email: o.email || cust?.invoiceEmail || cust?.contactEmail || '', buyerName: o.contact || cust?.contactName || o.receiver || '' };
  const [b, setB] = useState<SaleInvBuyer>(init);
  // v60: loại người mua (tổ chức: MST 10 / 10-3 số; hộ kinh doanh, cá nhân: số định danh 12 số; không có MST) + tra cứu dữ liệu đăng ký thuế
  type BuyerKind = 'ORG' | 'PERSON' | 'NONE';
  const [kind, setKind] = useState<BuyerKind>(() => (init.noTax ? 'NONE' : taxKind(init.taxCode) === 'PERSON' ? 'PERSON' : 'ORG'));
  const tax = useTaxLookup();
  const taxOk = (v?: string) => (kind === 'PERSON' ? taxKind(v) === 'PERSON' : taxKind(v) === 'ORG' || taxKind(v) === 'BRANCH');
  const [rows, setRows] = useState(() => o.lines.map((l) => { const left = Math.max(0, l.qty - usedQ(l.id)); return { l, on: left > 0, qty: left, max: left, name: l.name }; }));
  const [note, setNote] = useState('');
  const [keep, setKeep] = useState(!!cust && (!cust.taxCode || !cust.address || !(cust.invoiceEmail || cust.contactEmail)));
  const unit = (l: SaleLine) => (l.qty ? saleLineNet(l) / l.qty : 0);
  const items = rows.filter((r) => r.on && r.qty > 0).map((r): SaleInvItem => ({ lineId: r.l.id, name: r.name.trim() || r.l.name, unit: r.l.unit, qty: r.qty, amount: Math.round(unit(r.l) * r.qty), vat: r.l.vat }));
  const net = items.reduce((s, x) => s + x.amount, 0);
  const vat = items.reduce((s, x) => s + Math.round((x.amount * x.vat) / 100), 0);
  const miss = { name: !b.name.trim(), taxCode: kind !== 'NONE' && !taxOk(b.taxCode), address: !b.address.trim(), email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim()) };
  const bad = Object.values(miss).some(Boolean) || !items.length || rows.some((r) => r.on && (r.qty > r.max || !r.name.trim()));
  // "Lấy từ hồ sơ khách hàng / đơn hàng" chỉ hiện khi ô còn đúng giá trị ban đầu (đã sửa hoặc dùng dữ liệu thuế thì thôi)
  const auto = (k: keyof typeof miss) => { const v0 = (init as Record<string, unknown>)[k]; return !!v0 && !miss[k] && String(v0).trim() === String((b as Record<string, unknown>)[k] ?? '').trim(); };
  const send = () => {
    if (bad) return notify('Điền đủ thông tin xuất hóa đơn và chọn hàng hóa', 'red');
    const buyer: SaleInvBuyer = { ...b, noTax: kind === 'NONE' || undefined, name: b.name.trim(), taxCode: kind === 'NONE' ? undefined : taxNorm(b.taxCode), address: b.address.trim(), email: b.email.trim(), buyerName: b.buyerName?.trim() || undefined };
    requestSaleInvoice(o.id, net + vat, note, { buyer, items });
    // chỉ lưu kết quả tra vào hồ sơ khách khi đúng mã số thuế của khách (người mua trên hóa đơn có thể khác khách đặt hàng)
    const snapOf = (c: Customer) => (tax.info && tax.info.taxCode === buyer.taxCode && taxNorm(c.taxCode || buyer.taxCode) === buyer.taxCode ? { taxInfo: tax.info } : {});
    if (keep && cust) setCustomers((all) => all.map((c) => (c.id === cust.id ? { ...c, taxCode: c.taxCode || buyer.taxCode || '', address: c.address || buyer.address, invoiceEmail: buyer.email, ...snapOf(c) } : c)));
    onClose();
  };
  const fld = (k: keyof typeof miss, label: string, el: ReactNode) => (
    <Field label={label} className={k === 'name' || k === 'address' ? 'sm:col-span-2' : undefined}>
      <div className={cn('rounded-lg', miss[k] && 'ring-1 ring-[rgb(var(--danger))]')}>{el}</div>
      {miss[k] ? <p className="mt-1 text-[12px] text-[rgb(var(--danger-fg))]">Bắt buộc{k === 'taxCode' ? (kind === 'PERSON' ? ': số định danh 12 số' : ': 10 số, chi nhánh 10-3 số') : k === 'email' ? ': email hợp lệ' : ''}</p> : auto(k) ? <p className="mt-1 text-[12px] text-[rgb(var(--muted))]">{cust && !((k as string) === 'email' && o.email) && !((k as string) === 'buyerName' && o.contact) ? 'Lấy từ hồ sơ khách hàng' : 'Lấy từ đơn hàng'}</p> : null}
    </Field>
  );
  return (
    <Drawer size="lg" title={`Yêu cầu xuất hóa đơn · ${o.code}`} eyebrow={o.customer} onClose={onClose} footer={<div className="flex flex-wrap items-center justify-end gap-2" data-invreq-actions>
      <span className="mr-auto text-[13px] tabular-nums text-[rgb(var(--muted))]">Tiền hàng {fmtN(net)} · VAT {fmtN(vat)} · <b className="font-medium text-[rgb(var(--fg))]">Tổng {fmtN(net + vat)}</b></span>
      <button className={btnGhost} onClick={onClose}>Hủy</button>
      <button className={btnPrimary} disabled={bad} onClick={send}><Send className="h-4 w-4" aria-hidden />Gửi kế toán</button>
    </div>}>
      <div className="space-y-5">
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[14px] font-bold">Người mua</p>
            <div className="flex overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.12)] text-[13px] divide-x divide-[rgb(var(--ink)/0.08)]" role="radiogroup" aria-label="Loại người mua">
              {([['ORG', 'Tổ chức'], ['PERSON', 'Hộ KD, cá nhân'], ['NONE', 'Không có MST']] as [BuyerKind, string][]).map(([k, tx]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={cn('whitespace-nowrap px-3 py-1.5', kind === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => { setKind(k); setB({ ...b, noTax: k === 'NONE' }); tax.reset(); }}>{tx}</button>)}
            </div>
            {cust && <label className="ml-auto flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={keep} onChange={(e) => setKeep(e.target.checked)} />Lưu vào hồ sơ khách hàng</label>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            {kind !== 'NONE' && fld('taxCode', kind === 'PERSON' ? 'Số định danh cá nhân' : 'Mã số thuế', (
              <div className="flex gap-2"><input className={cn(inputCls, 'font-mono')} value={b.taxCode ?? ''} onChange={(e) => setB({ ...b, taxCode: e.target.value })} placeholder={kind === 'PERSON' ? '12 số' : '0312345678'} aria-label={kind === 'PERSON' ? 'Số định danh cá nhân' : 'Mã số thuế'} /><button type="button" className={cn(btnGhost, 'shrink-0 px-2.5')} disabled={!taxOk(b.taxCode) || tax.busy} onClick={() => void tax.run(b.taxCode ?? '', true)} aria-label="Tra cứu mã số thuế" title="Tra cứu dữ liệu đăng ký thuế"><Search className="h-4 w-4" aria-hidden /></button></div>
            ))}
            {fld('name', kind === 'ORG' ? 'Tên đơn vị' : 'Tên người mua / hộ kinh doanh', <input className={inputCls} value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} aria-label="Tên đơn vị / người mua" />)}
            <Field label="Người mua hàng"><input className={inputCls} value={b.buyerName ?? ''} onChange={(e) => setB({ ...b, buyerName: e.target.value })} /></Field>
            {kind !== 'NONE' && (tax.busy || tax.info || tax.err) && <div className="sm:col-span-4"><TaxStrip st={tax} name={b.name} address={b.address} onUseName={(v) => setB((p) => ({ ...p, name: v }))} onUseAddress={(v) => setB((p) => ({ ...p, address: v }))} /></div>}
            {fld('address', 'Địa chỉ', <input className={inputCls} value={b.address} onChange={(e) => setB({ ...b, address: e.target.value })} aria-label="Địa chỉ người mua" />)}
            {fld('email', 'Email nhận hóa đơn', <input className={inputCls} type="email" value={b.email} onChange={(e) => setB({ ...b, email: e.target.value })} />)}
          </div>
          <p className="mt-2 text-[12px] text-[rgb(var(--muted))]">{TAX_FORMAT_HINT}</p>
        </section>
        <section>
          <p className="mb-2 text-[14px] font-medium">Hàng hóa trên hóa đơn</p>
          <div className="overflow-x-auto rounded-lg border border-[rgb(var(--line))]">
            <table className="w-full min-w-[620px] text-[13.5px]">
              <thead><tr className="border-b border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.03)] text-left text-[12.5px] text-[rgb(var(--muted))]"><th className="w-10 py-2 pl-3" /><th className="font-normal">Mã</th><th className="font-normal">Tên hàng trên hóa đơn</th><th className="font-normal">ĐVT</th><th className="text-right font-normal">Còn xuất HĐ</th><th className="w-20 text-right font-normal">Số lượng</th><th className="text-right font-normal">VAT%</th><th className="pr-3 text-right font-normal">Thành tiền</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={r.l.id} className={cn('border-b border-[rgb(var(--ink)/0.06)]', !r.on && 'text-[rgb(var(--muted))]')}>
                  <td className="py-2 pl-3"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={r.on} disabled={!r.max} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} aria-label={`Chọn ${r.l.name}`} /></td>
                  <td className="whitespace-nowrap pr-2">{r.l.ref ? <Code>{r.l.ref}</Code> : '—'}</td>
                  <td className="py-1.5 pr-2"><input className={cn(inputBase, 'w-full min-w-[180px] py-1', r.name !== r.l.name && 'border-[rgb(var(--accent))]')} value={r.name} disabled={!r.on} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label={`Tên trên hóa đơn dòng ${i + 1}`} title={r.name !== r.l.name ? `Tên trên đơn: ${r.l.name}` : undefined} /></td>
                  <td className="whitespace-nowrap pr-2">{r.l.unit}</td>
                  <td className="pr-2 text-right tabular-nums">{fmtN(r.max)}</td>
                  <td className="py-1.5 pr-2"><input className={cn(inputBase, 'w-full py-1 text-right tabular-nums', r.qty > r.max && 'border-[rgb(var(--danger))]')} inputMode="decimal" value={r.qty} disabled={!r.on} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, qty: Math.max(0, Number(e.target.value.replace(',', '.')) || 0) } : x)))} aria-label={`Số lượng xuất hóa đơn dòng ${i + 1}`} /></td>
                  <td className="pr-2 text-right tabular-nums">{r.l.vat}</td>
                  <td className="pr-3 text-right font-medium tabular-nums">{r.on ? fmtN(Math.round(unit(r.l) * r.qty)) : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
        <Field label="Ghi chú cho kế toán"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ngày xuất, gộp hóa đơn…" /></Field>
      </div>
    </Drawer>
  );
}

/**
 * v60: gửi email phiếu bán hàng (PDF đính kèm) cho khách từ trang chi tiết đơn.
 * Máy chủ có SMTP: gửi qua /api/email/send (khóa chỉ ở máy chủ); chưa cấu hình: mở ứng dụng email của người dùng (mailto, không đính kèm được).
 */
export function SaleMailDrawer({ o, onClose }: { o: SalesOrder; onClose: () => void }) {
  const { customers, company, me, org, notify, addMsgLog, setSalesOrders } = useApp();
  const [srv] = useServerStatus();
  const cust = customers.find((c) => c.id === o.customerId);
  const t = saleTotals(o);
  const seller = company.shortName || company.legalName;
  const [to, setTo] = useState(o.email || cust?.invoiceEmail || cust?.contactEmail || ''); // v61: email ghi trên đơn trước
  const [cc, setCc] = useState(me?.email ?? '');
  const [subject, setSubject] = useState(`Đơn hàng ${o.code} - ${seller}`);
  const [body, setBody] = useState(`Kính gửi Quý ${o.customer},\n\n${seller} xin gửi phiếu bán hàng số ${o.code}, tổng giá trị ${fmtN(t.grand)} đ (đã gồm VAT).\nĐiều kiện thanh toán: ${SALE_PAY[o.pay]}${o.creditDays ? ` ${o.creditDays} ngày` : ''}. Giao nhận: ${SALE_DELIVERY[o.delivery]}${o.deliverAt ? ` ngày ${fmtDate(o.deliverAt)}` : ''}.\n\nTrân trọng,\n${me?.name ?? ''}\n${seller}`);
  const [busy, setBusy] = useState(false);
  const okTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const send = async () => {
    if (!okTo) return notify('Nhập email người nhận', 'orange');
    if (!srv.email) {
      window.location.href = `mailto:${encodeURIComponent(to.trim())}?${cc ? `cc=${encodeURIComponent(cc)}&` : ''}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
      addMsgLog({ channel: 'EMAIL', to: to.trim(), subject, ok: true, detail: 'Mở bằng ứng dụng email của người dùng (mailto), chưa xác nhận đã gửi' });
      // nhật ký đơn: ghi rõ là mở ứng dụng email trên máy, phần mềm không xác nhận được đã gửi
      setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: `Mở ứng dụng email trên máy để gửi phiếu bán hàng tới ${to.trim()} (chưa xác nhận đã gửi)` }] } : x)));
      return onClose();
    }
    setBusy(true);
    const pdf = await (async () => { const blob = await docPdfBlob(`Phiếu bán hàng ${o.code}`, saleHtml(o, company)); const buf = new Uint8Array(await blob.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(bin); })().catch(() => null);
    if (!pdf) { setBusy(false); return notify('Không tạo được file PDF để đính kèm', 'red'); }
    const r = await apiPost<{ id?: string }>('/api/email/send', { tenant: org.id, to: to.trim(), cc, subject, text: body, attachments: [{ filename: `${o.code}.pdf`, contentType: 'application/pdf', base64: pdf }] });
    setBusy(false);
    addMsgLog({ channel: 'EMAIL', to: to.trim(), subject, ok: r.ok, detail: r.ok ? `Đã gửi kèm ${o.code}.pdf` : `Lỗi: ${r.error ?? 'không rõ'}` });
    if (!r.ok) return notify(`Gửi email chưa được: ${r.error === 'smtp_not_configured' ? 'máy chủ chưa cấu hình SMTP' : r.error ?? 'lỗi máy chủ'}`, 'red');
    setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: `Gửi email phiếu bán hàng tới ${to.trim()}` }] } : x)));
    notify(`Đã gửi phiếu bán hàng ${o.code} tới ${to.trim()}`, 'teal');
    onClose();
  };
  return (
    <Drawer size="lg" title={`Gửi email · ${o.code}`} eyebrow={o.customer} onClose={onClose} footer={<div className="flex flex-wrap items-center justify-end gap-2" data-mail-actions>
      <span className="mr-auto text-[12.5px] text-[rgb(var(--muted))]">{srv.email ? `Đính kèm ${o.code}.pdf (phiếu bán hàng)` : 'Máy chủ chưa cấu hình gửi email: mở ứng dụng email trên máy, đính kèm tay'}</span>
      <button className={btnGhost} onClick={onClose}>Hủy</button>
      <button className={btnPrimary} disabled={!okTo || busy} onClick={() => void send()}><Send className="h-4 w-4" aria-hidden />{busy ? 'Đang gửi…' : 'Gửi email'}</button>
    </div>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Người nhận"><input className={inputCls} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="ketoan@khachhang.vn" aria-label="Email người nhận" /></Field>
        <Field label="CC"><input className={inputCls} value={cc} onChange={(e) => setCc(e.target.value)} aria-label="CC" /></Field>
        <Field label="Tiêu đề" className="sm:col-span-2"><input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Nội dung" className="sm:col-span-2"><textarea className={cn(inputCls, 'min-h-[200px] resize-y')} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      </div>
    </Drawer>
  );
}

/** v50.2: bản xem (file) của chứng từ liên quan: phiếu kho, phiếu thu, yêu cầu hóa đơn, đặt hàng, lệnh sản xuất */
export function soVoucherHtml(v: StockVoucher, skus: SkuItem[], wh: string, nm: (id?: string) => string, company: CompanyInfo) {
  const rows = v.lines.map((l, i) => { const s = skus.find((x) => x.sku === l.sku); return `<tr><td class="c">${i + 1}</td><td>${esc(l.sku)}</td><td>${esc(s?.name ?? '')}</td><td class="c">${esc(s?.unit ?? '')}</td>${l.req != null ? `<td class="r">${fmtN(l.req)}</td>` : ''}<td class="r">${fmtN(l.qty)}</td></tr>`; }).join('');
  const req = v.lines.some((l) => l.req != null);
  const title = v.type === 'IN' ? 'PHIẾU NHẬP KHO' : v.type === 'OUT' ? 'PHIẾU XUẤT KHO' : 'PHIẾU KHO';
  return `<p><b>${esc(company.legalName)}</b><br>${esc(company.address)}</p><h1>${title}</h1><p class="c">Số ${esc(v.code)} · ngày ${fmtDate(v.date)} · ${v.status === 'PENDING' ? 'chờ duyệt' : v.status === 'DONE' ? 'đã duyệt' : 'đã hủy'}</p>
<p>Kho: ${esc(wh)}<br>Lý do: ${esc(v.reason)}${v.partner ? `<br>Đối tác: ${esc(v.partner)}` : ''}${v.ref ? `<br>Chứng từ gốc: ${esc(v.ref)}` : ''}${v.note ? `<br>Diễn giải: ${esc(v.note)}` : ''}${v.cancelReason ? `<br>Lý do hủy: ${esc(v.cancelReason)}` : ''}</p>
<table class="items"><thead><tr><th>STT</th><th>Mã hàng</th><th>Tên hàng</th><th>ĐVT</th>${req ? '<th>Yêu cầu</th>' : ''}<th>${v.type === 'OUT' ? 'Thực xuất' : 'Số lượng'}</th></tr></thead><tbody>${rows}</tbody></table>
<table class="layout sign"><tr><td>Người lập<br><br><br>${esc(nm(v.requestedBy))}</td><td>Người duyệt<br><br><br>${esc(nm(v.approvedBy))}</td></tr></table>`;
}

export function soInfoHtml(title: string, code: string, rows: [string, string][], company: CompanyInfo) {
  return `<p><b>${esc(company.legalName)}</b></p><h1>${esc(title)}</h1><p class="c">Số ${esc(code)}</p><table class="items"><tbody>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
}

/** v50: bản in phiếu thu / phiếu chi của đơn */
export function soReceiptHtml(o: SalesOrder, p: Pick<SalePayment, 'amount' | 'method' | 'refund' | 'payer' | 'note' | 'date' | 'at'>, code: string, company: CompanyInfo, by: string) {
  const amt = Math.abs(p.amount);
  const day = p.date ?? iso(new Date(p.at));
  return `<p><b>${esc(company.legalName)}</b><br>${esc(company.address)}</p><h1>${p.refund ? 'PHIẾU CHI' : 'PHIẾU THU'}</h1><p class="c">Số ${esc(code)} · ngày ${fmtDate(day)}</p>
<p>${p.refund ? 'Người nhận' : 'Người nộp'}: <b>${esc(p.payer || o.customer)}</b><br>Khách hàng: ${esc(o.customer)}<br>Lý do: ${esc(p.note || `${p.refund ? 'Hoàn tiền' : 'Thu tiền'} đơn hàng ${o.code}`)}<br>Hình thức: ${p.method === 'CASH' ? 'Tiền mặt' : `Chuyển khoản${company.bankAccount ? ` · ${esc(company.bankName)} ${esc(company.bankAccount)}` : ''}`}</p>
<p>Số tiền: <b>${fmtN(amt)} đ</b><br><b>Bằng chữ:</b> <i>${moneyToWordsVN(amt)}</i></p>
<table class="layout sign"><tr><td><b>${p.refund ? 'NGƯỜI NHẬN TIỀN' : 'NGƯỜI NỘP TIỀN'}</b><br>(Ký, ghi rõ họ tên)<br><br><br><br></td><td><b>NGƯỜI LẬP PHIẾU</b><br>(Ký, ghi rõ họ tên)<br><br><br>${esc(by)}</td></tr></table>`;
}

/** v50: trang Ghi thu của đơn (trang riêng) */
export function SalePayPage({ o, onBack }: { o: SalesOrder; onBack: () => void }) {
  const { addSalePayment, confirmSalePayment, users, me, company, canDo, cashEntries } = useApp();
  const t = saleTotals(o);
  const ret = saleReturned(o);
  const due = saleOwed(o);
  const paidAll = salePaid(o, true);
  const left = due - paidAll;
  const canCash = canDo('cash.manage') || canDo('receipt.confirm');
  const invDone = (o.invReqs ?? []).filter((r) => r.status === 'DONE');
  const R = useSaleRights();
  const [voidId, setVoidId] = useState<string | null>(null);
  const [kind, setKind] = useState<'IN' | 'REFUND'>(left < 0 ? 'REFUND' : 'IN');
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<'CASH' | 'BANK'>('BANK');
  const [amt, setAmt] = useState(Math.abs(left));
  const [payer, setPayer] = useState(o.receiver || o.customer);
  const [invNo, setInvNo] = useState(invDone[invDone.length - 1]?.no ?? '');
  const [note, setNote] = useState('');
  const max = kind === 'IN' ? Math.max(0, left) : Math.max(0, -left);
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const pfx = `${kind === 'IN' ? 'PTQ' : 'PCQ'}-${date.slice(0, 4)}-`;
  const code = canCash ? nextCode(cashEntries.filter((x) => x.code.startsWith(pfx)).map((x) => x.code), pfx, 4) : 'Chờ kế toán';
  const after = paidAll + (kind === 'IN' ? amt : -amt);
  const errs: string[] = [];
  if (!(amt > 0)) errs.push('Nhập số tiền');
  else if (amt > max) errs.push(kind === 'IN' ? `Vượt số còn phải thu ${fmtN(max)}` : `Chỉ hoàn tối đa số khách trả thừa ${fmtN(max)}`);
  if (date > todayISO()) errs.push('Ngày thu không được sau hôm nay');
  if (o.status === 'CANCELLED' && kind === 'IN') errs.push('Đơn đã hủy');
  const save = (print: boolean) => {
    if (errs.length) return;
    const extra: SalePayExtra = { date, payer: payer.trim() || undefined, note: note.trim() || undefined, invNo: invNo || undefined, refund: kind === 'REFUND' || undefined };
    addSalePayment(o.id, amt, method, undefined, extra);
    if (print) printHtml(docShell(`${kind === 'IN' ? 'Phiếu thu' : 'Phiếu chi'} ${o.code}`, soReceiptHtml(o, { amount: amt, method, at: Date.now(), ...extra }, code, company, me?.name ?? '')));
    onBack();
  };
  const seg = (on: boolean) => cn('flex flex-1 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 text-[13.5px]', on ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]');
  const segBox = 'flex overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.12)] divide-x divide-[rgb(var(--ink)/0.08)]';
  const cashCode = (pid: string) => saleCashOf(cashEntries, pid)?.code;
  // v58: bảng trượt bên phải (thay trang riêng): Khách trả / Hoàn tiền, lịch sử thu chi của đơn
  return (
    <Drawer size="xl" title={kind === 'REFUND' ? 'Hoàn tiền' : canCash ? 'Lập phiếu thu' : 'Báo đã nhận tiền'} eyebrow={`Thanh toán · ${o.code}`} badge={<><Code>{code}</Code><Chip>Nháp</Chip></>} onClose={onBack}
      footer={<div className="flex flex-wrap items-center justify-end gap-2" data-pay-actions>
        {errs.length > 0 && amt > 0 && <span className="mr-auto text-[13px] text-[rgb(var(--danger-fg))]">{errs[0]}</span>}
        <button className={btnGhost} onClick={onBack}>Hủy</button>
        <button className={btnGhost} disabled={errs.length > 0} onClick={() => save(true)}><Printer className="h-4 w-4" aria-hidden />Lưu & in phiếu</button>
        <button className={btnPrimary} disabled={errs.length > 0} onClick={() => save(false)}><CheckIcon className="h-4 w-4" aria-hidden />Lưu</button>
      </div>}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <SoCard title={kind === 'IN' ? 'Thông tin phiếu thu' : 'Thông tin phiếu chi'}>
            <div className={soGrid}>
              <Field label="Loại phiếu" className="sm:col-span-2"><div className={segBox} role="radiogroup" aria-label="Loại phiếu">
                <button role="radio" aria-checked={kind === 'IN'} className={seg(kind === 'IN')} onClick={() => { setKind('IN'); setAmt(Math.max(0, left)); }}><Coins className="h-4 w-4" aria-hidden />Khách trả</button>
                <button role="radio" aria-checked={kind === 'REFUND'} className={seg(kind === 'REFUND')} disabled={left >= 0} title={left >= 0 ? 'Chỉ hoàn khi khách trả thừa' : undefined} onClick={() => { setKind('REFUND'); setAmt(Math.max(0, -left)); }}><Undo2 className="h-4 w-4" aria-hidden />Hoàn tiền cho khách</button>
              </div></Field>
              <Field label="Mã phiếu"><input className={cn(inputCls, 'font-mono')} value={code} readOnly aria-label="Mã phiếu" /></Field>
              <Field label="Ngày thu"><input type="date" className={inputCls} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Hình thức" className="sm:col-span-2"><div className={segBox} role="radiogroup" aria-label="Hình thức">
                <button role="radio" aria-checked={method === 'CASH'} className={seg(method === 'CASH')} onClick={() => setMethod('CASH')}><Banknote className="h-4 w-4" aria-hidden />Tiền mặt</button>
                <button role="radio" aria-checked={method === 'BANK'} className={seg(method === 'BANK')} onClick={() => setMethod('BANK')}><Building2 className="h-4 w-4" aria-hidden />Chuyển khoản</button>
              </div></Field>
              <Field label={kind === 'IN' ? 'Tài khoản nhận' : 'Tài khoản chi'}><input className={inputCls} readOnly value={method === 'CASH' ? 'Quỹ tiền mặt' : [company.bankName, company.bankAccount].filter(Boolean).join(' · ') || 'Tài khoản ngân hàng'} aria-label="Tài khoản" /></Field>
              <Field label={kind === 'IN' ? 'Người nộp' : 'Người nhận'}><input className={inputCls} value={payer} onChange={(e) => setPayer(e.target.value)} /></Field>
              <Field label="Số tiền" className="sm:col-span-2">
                <div className="flex items-center gap-2">
                  <input className={cn(inputBase, 'min-w-0 flex-1 border-[rgb(var(--accent))] py-2 text-right text-[22px] font-medium tabular-nums')} inputMode="numeric" value={amt ? fmtN(amt) : ''} onChange={(e) => setAmt(digits(e.target.value))} aria-label="Số tiền" />
                  {kind === 'IN' && <><button className={cn(btnGhost, btnSm)} onClick={() => setAmt(Math.max(0, left))}>Thu đủ</button><button className={cn(btnGhost, btnSm)} onClick={() => setAmt(Math.round(Math.max(0, left) / 2))}>50%</button></>}
                </div>
              </Field>
              <Field label="Gắn hóa đơn thuế"><select className={inputCls} value={invNo} onChange={(e) => setInvNo(e.target.value)}><option value="">Không gắn</option>{invDone.map((r) => <option key={r.id} value={r.no}>{r.no} · {fmtN(r.amount)}</option>)}</select></Field>
              <Field label="Người lập"><input className={inputCls} readOnly value={me?.name ?? ''} /></Field>
              <Field label="Ghi chú" className="sm:col-span-2 xl:col-span-4"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === 'IN' ? `Thu tiền đơn hàng ${o.code}` : `Hoàn tiền đơn hàng ${o.code}`} /></Field>
            </div>
          </SoCard>
          <SoCard pad={false} title={<>Lịch sử thu chi của đơn <span className="text-[12.5px] font-normal text-[rgb(var(--muted))]">{o.payments.length}</span></>}>
            {o.payments.length || ret > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-[13.5px]">
                  <thead><tr className="border-y border-[rgb(var(--line))]"><th className={cn(soTh, 'pl-5')}>Mã phiếu</th><th className={soTh}>Ngày</th><th className={soTh}>Loại</th><th className={soTh}>Hình thức</th><th className={cn(soTh, 'text-right')}>Số tiền</th><th className={soTh}>Người lập</th><th className={soTh}>Người xác nhận</th><th className={soTh}>Trạng thái</th><th className={cn(soTh, 'w-10 pr-5')} /></tr></thead>
                  <tbody>
                    {o.payments.map((p) => (
                      <tr key={p.id} className="border-b border-[rgb(var(--ink)/0.06)]">
                        <td className={cn(soTd, 'pl-5')}>{cashCode(p.id) ? <Code>{cashCode(p.id)}</Code> : '—'}</td>
                        <td className={cn(soTd, 'tabular-nums text-[rgb(var(--fg2))]')}>{fmtDate(p.date ?? iso(new Date(p.at)))}</td>
                        <td className={soTd}>{p.refund ? 'Hoàn tiền' : 'Khách trả'}</td>
                        <td className={soTd}>{p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</td>
                        <td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(p.amount)}</td>
                        <td className={soTd}>{nm(p.by) || '—'}</td>
                        <td className={soTd}>{nm(p.confirmedBy) || '—'}</td>
                        <td className={soTd}><span className="flex items-center gap-1.5">{p.confirmed ? <Chip tone="teal">Đã xác nhận</Chip> : canCash ? <button className={cn(btnGhost, btnSm)} onClick={() => confirmSalePayment(o.id, p.id)}>Xác nhận</button> : <Chip tone="orange">Chờ kế toán</Chip>}{(R.canVoidPay() || (!p.confirmed && p.by === me?.id)) && (voidId === p.id ? <><button className={cn(btnGhost, btnSm, 'text-[rgb(var(--danger-fg))]')} onClick={() => { R.voidPay(o, p, cashCode(p.id)); setVoidId(null); }}>Xác nhận hủy</button><button className={cn(btnGhost, btnSm)} onClick={() => setVoidId(null)}>Thôi</button></> : <button className={cn(btnGhost, btnSm)} onClick={() => setVoidId(p.id)}>Hủy</button>)}</span></td>
                        <td className={cn(soTd, 'pr-5')}><button className="rounded p-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => printHtml(docShell(`${p.refund ? 'Phiếu chi' : 'Phiếu thu'} ${o.code}`, soReceiptHtml(o, p, cashCode(p.id) ?? o.code, company, nm(p.by))))} aria-label="In phiếu" title="In phiếu"><Printer className="h-4 w-4" aria-hidden /></button></td>
                      </tr>
                    ))}
                    {ret > 0 && <tr className="border-b border-[rgb(var(--ink)/0.06)] text-[rgb(var(--fg2))]"><td className={cn(soTd, 'pl-5')}>—</td><td className={soTd} /><td className={soTd}>Giảm trừ trả hàng</td><td className={soTd}>Trừ vào phải thu</td><td className={cn(soTd, 'text-right tabular-nums')}>−{fmtN(ret)}</td><td className={soTd} colSpan={4} /></tr>}
                    <tr className="bg-[rgb(var(--ink)/0.03)]"><td colSpan={4} className={cn(soTd, 'pl-5 text-[rgb(var(--muted))]')}>Đã thu sau phiếu này</td><td className={cn(soTd, 'text-right font-medium tabular-nums')}>{fmtN(after)}</td><td colSpan={4} className={cn(soTd, 'text-[rgb(var(--muted))]')}>phải thu {fmtN(due)}</td></tr>
                  </tbody>
                </table>
              </div>
            ) : <p className="px-5 pb-5 text-[13.5px] text-[rgb(var(--muted))]">Chưa có phiếu thu</p>}
          </SoCard>
        </div>
        <div className="space-y-4">
          <SoCard title="Đơn hàng" action={<Code>{o.code}</Code>}>
            <p className="font-medium">{o.customer}</p>
            <p className="text-[12.5px] text-[rgb(var(--muted))]">{[nm(o.by), SALE_PAY[o.pay] + (o.creditDays ? ` ${o.creditDays} ngày` : ''), o.creditDays && o.issuedAt ? `hạn ${fmtDate(saleDue(o))}` : ''].filter(Boolean).join(' · ')}</p>
            <div className="mt-3">
              <SoKv label="Tổng sau VAT">{fmtN(t.grand)}</SoKv>
              {ret > 0 && <SoKv label="Hàng trả lại">−{fmtN(ret)}</SoKv>}
              <SoKv label="Thực tế phải thu" big>{fmtN(due)}</SoKv>
              <SoKv label="Đã thu / báo nhận">{fmtN(paidAll)}</SoKv>
              <SoKv label="Phiếu này">{kind === 'IN' ? fmtN(amt) : `−${fmtN(amt)}`}</SoKv>
              <SoKv label="Còn lại sau phiếu" tone={due - after > 0 ? 'warn' : undefined}>{fmtN(due - after)}</SoKv>
            </div>
            {due > 0 && <div className="mt-2"><SoBar parts={[{ pct: (paidAll / due) * 100, cls: 'bg-[rgb(var(--fg))]' }, { pct: ((after - paidAll) / due) * 100, cls: 'bg-[rgb(var(--accent)/0.55)]' }]} /></div>}
          </SoCard>
          <SoCard title="Quy trình thu">
            <SoFlow steps={[
              { label: 'Lập phiếu', at: 'đang soạn', sub: me?.name, state: 'now' },
              { label: 'Kế toán xác nhận', sub: canCash ? 'bạn là kế toán: xác nhận khi lưu' : 'đối chiếu sổ quỹ / sao kê', state: 'todo' },
              { label: 'Ghi nhận doanh thu', sub: 'giảm phải thu đơn và công nợ khách', state: 'todo' },
            ]} />
          </SoCard>
          <SoDebt customerId={o.customerId} exceptId={o.id} />
        </div>
      </div>
    </Drawer>
  );
}

/** v50: trang Duyệt đơn bán (trang riêng, không phải bảng trượt) */
export function SaleApprove({ o, onBack, onGo, rejectFirst }: { o: SalesOrder; onBack: () => void; onGo: (id: string) => void; /** v60: mở từ nút Từ chối trên đầu trang — đưa con trỏ vào ô ý kiến */ rejectFirst?: boolean }) {
  const app = useApp();
  const { users, warehouses, skus, reservations, stockMoves, salesOrders, customers, wfRuns, wfDef, stockVouchers, quotes, notify } = app;
  const { todo } = useApprovalQueue();
  const ar = useArItems();
  const queue = todo.filter((x) => x.kind === 'SALE');
  const item = queue.find((x) => x.key === `so-${o.id}`);
  const idx = item ? queue.indexOf(item) : -1;
  const R = useSaleRights();
  const self = !item && R.canSelf(o);
  const can = !!item || self;
  const [seen, setSeen] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setSeen([]); setNote(''); }, [o.id]);
  useEffect(() => { if (rejectFirst) window.setTimeout(() => noteRef.current?.focus(), 120); }, [rejectFirst, o.id]);
  const stage = saleStage(o, stockVouchers);
  const t = saleTotals(o);
  const cust = customers.find((c) => c.id === o.customerId);
  const nm = (id?: string) => users.find((u) => u.id === id)?.name ?? '';
  const stock = saleStock(o, { skus, warehouses, reservations, stockMoves, orders: salesOrders });
  const short = stock.filter((x) => x.short > 0);
  const credit = o.pay === 'CREDIT' || o.pay === 'PARTIAL';
  const mine = ar.filter((x) => !!cust && x.customerId === cust.id && x.outstanding > 0);
  const owe = mine.reduce((s, x) => s + x.outstanding, 0);
  const today = todayISO();
  const od = mine.filter((x) => overdueDays(x.dueDate, today) > 0);
  const odSum = od.reduce((s, x) => s + x.outstanding, 0);
  const lim = cust?.creditLimit ?? 0;
  const costOf = (l: SaleLine) => (l.kind === 'SKU' ? skus.find((k) => k.sku === l.ref)?.costPrice ?? 0 : 0);
  const priced = o.lines.filter((l) => costOf(l) > 0 && l.qty > 0);
  const rev = priced.reduce((s, l) => s + saleLineNet(l), 0);
  const cost = priced.reduce((s, l) => s + costOf(l) * l.qty, 0);
  const gm = rev > 0 ? ((rev - cost) / rev) * 100 : null;
  const lineGm = priced.map((l) => ({ l, m: ((saleLineNet(l) / l.qty - costOf(l)) / (saleLineNet(l) / l.qty || 1)) * 100 })).sort((a, b) => a.m - b.m);
  const below = lineGm.filter((x) => x.m < 0);
  const maxDisc = Math.max(0, ...o.lines.map((l) => l.discountPct));
  const reasons = o.approval?.self ? [] : o.approval?.reasons ?? [];
  const DLV: Record<SaleDelivery, string> = { PICKUP: 'Tại kho', DELIVER: 'Giao hàng', CARRIER: 'Chành xe' };
  type Check = { id: string; label: string; bad: boolean; result: string; detail: string; act: string };
  const checks: Check[] = [
    { id: 'rule', label: 'Điều kiện cần duyệt', bad: reasons.length > 0, result: reasons.length ? `${reasons.length} điều kiện` : 'Không có', detail: reasons.join('; ') || 'Đơn trong ngưỡng', act: reasons.length ? 'Theo quy trình Đơn bán' : '—' },
    { id: 'disc', label: 'Giá & chiết khấu', bad: false, result: maxDisc ? `CK tới ${maxDisc}%` : 'Không CK', detail: maxDisc ? `${o.lines.filter((l) => l.discountPct === maxDisc).map((l) => l.ref ?? l.name).join(', ')} · tổng CK ${fmtN(t.discount)}` : `Theo ${quotes.find((x) => x.id === o.quoteId)?.code ?? 'bảng giá'}`, act: '—' },
    { id: 'stock', label: 'Tồn kho khả dụng', bad: short.length > 0, result: short.length ? `Thiếu ${fmtN(short.reduce((s, x) => s + x.short, 0))}` : 'Đủ hàng', detail: short.length ? short.map((x) => `${x.l.ref ?? x.l.name} có ${fmtN(x.have)} / ${fmtN(x.l.qty)}`).join(' · ') : `${stock.filter((x) => x.track).length} / ${o.lines.length} dòng theo dõi tồn đủ`, act: short.length ? 'Giữ chỗ phần có, phần thiếu chờ hàng' : '—' },
    { id: 'debt', label: 'Hạn mức công nợ', bad: !!cust && ((lim > 0 && credit && owe + t.grand > lim) || odSum > 0), result: !cust ? 'Khách lẻ' : odSum > 0 ? 'Có quá hạn' : lim > 0 && credit && owe + t.grand > lim ? 'Vượt hạn mức' : 'Trong hạn mức', detail: !cust ? '—' : `${compact(owe)} đang nợ${credit ? ` + ${compact(t.grand)} đơn này` : ''}${lim > 0 ? ` / ${compact(lim)}` : ''}`, act: odSum > 0 ? `${od.length} khoản quá hạn · ${compact(odSum)}` : '—' },
    { id: 'ship', label: 'Điều khoản giao hàng', bad: o.delivery !== 'PICKUP' && !o.address, result: o.delivery !== 'PICKUP' && !o.address ? 'Thiếu địa chỉ' : 'Đạt', detail: [DLV[o.delivery], o.deliverAt && fmtDate(o.deliverAt), o.address, o.receiver].filter(Boolean).join(' · '), act: '—' },
    { id: 'gm', label: 'Giá bán so với giá vốn', bad: below.length > 0, result: gm === null ? 'Chưa có giá vốn' : below.length ? `${below.length} dòng dưới giá vốn` : 'Đạt', detail: gm === null ? '—' : `Lãi gộp ${gm.toFixed(1).replace('.', ',')}%${lineGm[0] ? ` · thấp nhất ${lineGm[0].l.ref ?? lineGm[0].l.name} ${lineGm[0].m.toFixed(1).replace('.', ',')}%` : ''}`, act: below.length ? 'Xem lại đơn giá' : '—' },
  ];
  const flagged = checks.filter((c) => c.bad);
  const ready = flagged.every((c) => seen.includes(c.id));
  // ---- quy trình duyệt nhiều bước
  const s: WfSubject = { requesterId: o.approval?.requestedBy ?? o.by, dept: cust?.dept, amount: t.grand, vals: { amount: t.grand, maxDisc } };
  const run = wfRuns.filter((r) => r.key === 'SALE' && r.refId === o.id).sort((a, b) => b.startedAt - a.startedAt)[0];
  const def = wfDef('SALE');
  const steps = o.approval?.self ? [] : run?.steps ?? (def ? wfPath(def, s) : []);
  const wctx = app.wfCtx();
  const cur = run ? run.decisions.filter((d) => d.decision === 'APPROVED').length : 0;
  const flow: SoStep[] = [
    { label: 'Gửi duyệt', at: o.approval ? soTime(o.approval.requestedAt) : soTime(o.createdAt), sub: nm(o.approval?.requestedBy ?? o.by), state: 'done' },
    ...steps.map((st, i): SoStep => {
      const d = run?.decisions.filter((x) => x.step === i).slice(-1)[0];
      const done = d?.decision === 'APPROVED' || (o.approval?.status === 'APPROVED' && !run);
      const now = !done && i === cur && o.approval?.status === 'PENDING';
      return { label: `Bước ${i + 1} · ${st.name}`, at: d ? soTime(d.at) : undefined, chip: now && item ? <Chip tone="orange">bạn</Chip> : d?.decision === 'REJECTED' ? <Chip tone="red">từ chối</Chip> : undefined, sub: d ? `${nm(d.by)}${d.note ? ` · ${d.note}` : ''}` : wfApprovers(st, s, wctx).map((x) => x.u.name).join(', '), state: done ? 'done' : d?.decision === 'REJECTED' ? 'blocked' : now ? 'now' : 'todo' };
    }),
    ...(o.approval?.self ? [{ label: 'Duyệt đơn', at: o.approval.decidedAt ? soTime(o.approval.decidedAt) : undefined, sub: o.approval.decidedBy ? nm(o.approval.decidedBy) : 'người lên đơn hoặc quản lý', chip: self ? <Chip tone="orange">bạn</Chip> : undefined, state: o.approval.status === 'APPROVED' ? 'done' as const : 'now' as const }] : []),
    { label: 'Yêu cầu xuất kho', sub: 'sau khi duyệt đủ', state: o.approval?.status === 'APPROVED' ? 'done' : 'todo' },
  ];
  // ---- CRM 3A phân tích: thói quen trả tiền của khách
  const since = addDaysISO(today, -183);
  const hist = cust ? salesOrders.filter((x) => x.customerId === cust.id && x.id !== o.id && x.creditDays > 0 && x.issuedAt && x.date >= since && x.payments.some((p) => p.confirmed)) : [];
  const lates = hist.map((x) => { const last = Math.max(...x.payments.filter((p) => p.confirmed).map((p) => p.confirmedAt ?? p.at)); return overdueDays(saleDue(x), iso(new Date(last))); });
  const avgLate = lates.length ? Math.round(lates.reduce((a, b) => a + Math.max(0, b), 0) / lates.length) : null;
  const tip = !cust ? null : avgLate === null ? 'Chưa có lịch sử thanh toán công nợ trong 6 tháng' : avgLate > 0 ? `Khách trả chậm trung bình ${avgLate} ngày trong 6 tháng (${lates.length} đơn).${credit ? ' Nên nhắc thu trước hạn 3 ngày.' : ''}` : `Khách trả đúng hạn ${lates.length} đơn gần nhất trong 6 tháng.`;
  const act = (kind: 'ok' | 'no' | 'info') => {
    if (!can) return;
    if (kind === 'ok') { if (!ready) return notify('Đánh dấu đã xem các điểm cần lưu ý trước khi duyệt', 'red'); if (item) item.approve?.(); else R.selfApprove(o); }
    else {
      if (note.trim().length < 3) { noteRef.current?.focus(); return notify('Nhập ý kiến duyệt', 'red'); }
      if (kind === 'no') { if (item) item.reject?.(note.trim()); else R.selfReject(o, note.trim()); }
      else if (item?.needInfo) item.needInfo(note.trim());
      else {
        app.setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, notes: [...(x.notes ?? []), { id: uid('sn'), by: app.me?.id, at: Date.now(), text: `Yêu cầu bổ sung: ${note.trim()}` }] } : x)));
        const u = users.find((x) => x.id === (o.approval?.requestedBy ?? o.by));
        if (u && u.id !== app.me?.id) app.dispatch('APPROVAL_RESULT', { to: u, title: `Yêu cầu bổ sung: ${o.code}`, body: note.trim(), module: 'sales' });
        notify(`Đã gửi yêu cầu bổ sung cho ${nm(u?.id) || 'người lên đơn'}`, 'teal');
        setNote('');
        return;
      }
    }
    if (!item) return onBack();
    const next = queue.filter((x) => x.key !== item.key)[Math.min(idx, queue.length - 2)];
    if (next) onGo(next.refId); else onBack();
  };
  // v58: bảng trượt bên phải (thay trang riêng); nút thao tác ở chân bảng
  return (
    <Drawer size="xl" title={`Duyệt đơn · ${o.code}`} eyebrow={o.customer} onClose={onBack}
      badge={o.approval?.status === 'PENDING' ? <Chip tone="orange">Chờ duyệt{steps.length > 1 ? ` · bước ${Math.min(cur + 1, steps.length)} / ${steps.length}` : ''}</Chip> : <Chip tone={SALE_STAGE[stage].tone}>{o.approval ? DECISION_LABEL[o.approval.status as ApprovalDecision]?.label ?? SALE_STAGE[stage].label : 'Tự duyệt'}</Chip>}
      footer={<div className="flex flex-wrap items-center justify-end gap-2" data-approve-actions>
        {item && queue.length > 0 && (
          <span className="mr-auto flex items-center gap-1.5 text-[13px] text-[rgb(var(--muted))]">
            <button className={cn(soIco, 'h-8 w-8')} disabled={idx <= 0} onClick={() => onGo(queue[idx - 1].refId)} aria-label="Đơn trước"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
            <span className="tabular-nums">{idx + 1} / {queue.length} đơn chờ bạn duyệt</span>
            <button className={cn(soIco, 'h-8 w-8')} disabled={idx >= queue.length - 1} onClick={() => onGo(queue[idx + 1].refId)} aria-label="Đơn sau"><ChevronRight className="h-4 w-4" aria-hidden /></button>
          </span>
        )}
        {can ? <>
          <button className={cn(btnGhost, 'text-[rgb(var(--danger-fg))]')} onClick={() => act('no')}><X className="h-4 w-4" aria-hidden />Từ chối</button>
          {<button className={btnGhost} onClick={() => act('info')}><Undo2 className="h-4 w-4" aria-hidden />Yêu cầu bổ sung</button>}
          <button className={cn(btnPrimary, !ready && 'opacity-60')} onClick={() => act('ok')} title={ready ? undefined : 'Đánh dấu đã xem các điểm cần lưu ý'}><CheckIcon className="h-4 w-4" aria-hidden />{cur + 1 < steps.length ? 'Duyệt, chuyển bước sau' : 'Duyệt & giữ chỗ'}</button>
        </> : <><span className="mr-auto text-[12.5px] text-[rgb(var(--muted))]">{R.canSelf(o) || item ? '' : o.by === app.me?.id ? 'Đơn của bạn: người duyệt khác xử lý (không tự duyệt)' : 'Bạn không ở bước duyệt này'}</span><button className={btnGhost} onClick={onBack}>Về đơn hàng</button></>}
      </div>}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <SoCard title="Thông tin đơn hàng">
            <div className={soGrid}>
              <SoInfo label="Khách hàng" span={2}><Building2 className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="truncate">{o.customer}</span>{cust && <span className="truncate text-[12.5px] text-[rgb(var(--muted))]">{cust.code}</span>}</SoInfo>
              <SoInfo label="Mã đơn hàng"><Code>{o.code}</Code></SoInfo>
              <SoInfo label="Nguồn đơn hàng">{o.quoteId ? <>Từ báo giá <Code>{quotes.find((x) => x.id === o.quoteId)?.code ?? ''}</Code></> : o.origin ?? 'Tại quầy'}</SoInfo>
              <SoInfo label="Người thực hiện"><Users className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />{nm(o.by) || '—'}</SoInfo>
              <SoInfo label="Kho xuất"><Warehouse className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />{warehouses.find((w) => w.id === o.whId)?.name ?? '—'}</SoInfo>
              <SoInfo label="Nguồn chứng từ"><FileText className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />{o.docRef || '—'}</SoInfo>
              <SoInfo label="Giao hàng"><Truck className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden /><span className="truncate">{[DLV[o.delivery], o.deliverAt && fmtDate(o.deliverAt).slice(0, 5), o.address].filter(Boolean).join(' · ')}</span></SoInfo>
            </div>
          </SoCard>
          <SoCard pad={false} title={<>Hàng hóa <span className="text-[12.5px] font-normal text-[rgb(var(--muted))]">{o.lines.length}</span></>} action={<span className="text-[12.5px] tabular-nums text-[rgb(var(--muted))]">{fmtN(o.lines.reduce((s, l) => s + l.qty, 0))} đơn vị{gm !== null ? ` · lãi gộp ${gm.toFixed(1).replace('.', ',')}%` : ''}</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-[13.5px]">
                <thead><tr className="border-y border-[rgb(var(--line))]"><th className={cn(soTh, 'w-10 pl-5')}>#</th><th className={soTh}>Mã sản phẩm</th><th className={soTh}>Tên sản phẩm</th><th className={soTh}>ĐVT</th><th className={cn(soTh, 'text-right')}>Khả dụng</th><th className={cn(soTh, 'text-right')}>Số lượng</th><th className={cn(soTh, 'text-right')}>Đơn giá</th><th className={cn(soTh, 'text-right')}>CK%</th><th className={cn(soTh, 'text-right')}>CK (đ)</th><th className={cn(soTh, 'text-right')}>VAT%</th><th className={cn(soTh, 'pr-5 text-right')}>Thành tiền</th></tr></thead>
                <tbody>
                  {stock.map(({ l, short: sh, track, res, free }, i) => (
                    <tr key={l.id} className="border-b border-[rgb(var(--ink)/0.06)]">
                      <td className={cn(soTd, 'pl-5 text-[rgb(var(--muted))]')}>{i + 1}</td>
                      <td className={soTd}>{l.ref ? <Code>{l.ref}</Code> : '—'}</td>
                      <td className={soTd}><span className="block max-w-[220px] truncate font-medium" title={l.name}>{l.name}</span></td>
                      <td className={cn(soTd, 'text-[rgb(var(--muted))]')}>{l.unit}</td>
                      <td className={cn(soTd, 'text-right tabular-nums', sh > 0 && 'font-medium text-[rgb(var(--accent-fg))]')}>{track ? <span className="inline-flex items-center gap-1">{sh > 0 && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}{fmtN(res + free)}</span> : '—'}</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(l.qty)}</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(l.price)}</td>
                      <td className={cn(soTd, 'text-right tabular-nums', reasons.length > 0 && l.discountPct > 0 && l.discountPct === maxDisc && 'font-medium text-[rgb(var(--accent-fg))]')}>{l.discountPct || 0}</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(Math.round(l.qty * l.price) - saleLineNet(l))}</td>
                      <td className={cn(soTd, 'text-right tabular-nums')}>{l.vat}</td>
                      <td className={cn(soTd, 'pr-5 text-right font-medium tabular-nums')}>{fmtN(saleLineNet(l))}</td>
                    </tr>
                  ))}
                  <tr className="bg-[rgb(var(--ink)/0.03)]"><td /><td colSpan={4} className={cn(soTd, 'text-[rgb(var(--muted))]')}>Cộng {o.lines.length} mặt hàng</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(o.lines.reduce((a, l) => a + l.qty, 0))}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.gross)}</td><td /><td className={cn(soTd, 'text-right tabular-nums')}>{t.discount ? `−${fmtN(t.discount)}` : '0'}</td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(t.vat)}</td><td className={cn(soTd, 'pr-5 text-right font-medium tabular-nums')}>{fmtN(t.net)}</td></tr>
                </tbody>
              </table>
            </div>
          </SoCard>
          <SoCard pad={false} title="Kiểm tra trước khi duyệt" sub={flagged.length ? `${flagged.length} điểm cần xem · đã xem ${flagged.filter((c) => seen.includes(c.id)).length} / ${flagged.length}` : undefined}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13.5px]">
                <thead><tr className="border-y border-[rgb(var(--line))]"><th className={cn(soTh, 'w-12 pl-5')} /><th className={soTh}>Hạng mục</th><th className={soTh}>Kết quả</th><th className={soTh}>Chi tiết</th><th className={cn(soTh, 'pr-5')}>Hướng xử lý</th></tr></thead>
                <tbody>{checks.map((c) => (
                  <tr key={c.id} className="border-b border-[rgb(var(--ink)/0.06)] last:border-0">
                    <td className={cn(soTd, 'pl-5')}>{c.bad ? <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={seen.includes(c.id)} onChange={() => setSeen((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} aria-label={`Đã xem ${c.label}`} disabled={!can} /> : <CheckIcon className="h-4 w-4 text-[rgb(var(--success-fg))]" aria-hidden />}</td>
                    <td className={cn(soTd, 'font-medium')}>{c.label}</td>
                    <td className={soTd}><Chip tone={c.bad ? 'orange' : 'teal'}>{c.result}</Chip></td>
                    <td className={soTd}><span className="block max-w-[420px] truncate" title={c.detail}>{c.detail}</span></td>
                    <td className={cn(soTd, 'pr-5 text-[rgb(var(--fg2))]')}>{c.act}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </SoCard>
          {can && (
            <SoCard title="Ý kiến duyệt">
              <textarea ref={noteRef} className={cn(inputCls, 'min-h-[88px]')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bắt buộc khi từ chối hoặc yêu cầu bổ sung" aria-label="Ý kiến duyệt" />
            </SoCard>
          )}
        </div>
        <div className="space-y-4">
          <SoCard title="Quy trình duyệt"><SoFlow steps={flow} /></SoCard>
          {tip && <section className="glass-card rounded-xl p-4"><p className="flex items-center gap-2 text-[13.5px] font-medium"><span className="h-2 w-2 rounded-sm bg-[rgb(var(--accent))]" aria-hidden />CRM 3A phân tích</p><p className="mt-1.5 text-[13.5px] leading-relaxed text-[rgb(var(--fg2))]">{tip}</p></section>}
          <SoCard title="Thanh toán" action={<span className="text-[12.5px] text-[rgb(var(--muted))]">{SALE_PAY[o.pay]}{o.creditDays ? ` ${o.creditDays} ngày` : ''}</span>}>
            <SoKv label="Tiền hàng">{fmtN(t.gross)}</SoKv>
            <SoKv label="Chiết khấu">{t.discount ? `−${fmtN(t.discount)}` : '0'}</SoKv>
            <SoKv label="Thuế GTGT">{fmtN(t.vat)}</SoKv>
            {t.ship > 0 && <SoKv label="Phí vận chuyển">{fmtN(t.ship)}</SoKv>}
            <SoKv label="Khách phải trả" big>{fmtN(t.grand)}</SoKv>
            <SoKv label="Trả trước">{fmtN(salePaid(o, true))}</SoKv>
          </SoCard>
          <SoDebt customerId={o.customerId} extra={credit ? t.grand - salePaid(o, true) : 0} exceptId={o.id} />
        </div>
      </div>
    </Drawer>
  );
}

/** v51.2: hủy đơn đã có chứng từ: nhập trả đủ hàng, hoàn đủ tiền rồi mới hủy; đơn đóng lại, giữ toàn bộ chứng từ */
export function SaleCancelCard({ o, why, setWhy }: { o: SalesOrder; why: string; setWhy: (v: string | null) => void }) {
  const R = useSaleRights();
  const { stockVouchers, requestSaleReturn, addSalePayment, confirmSalePayment, canDo } = useApp();
  const canCash = canDo('cash.manage') || canDo('receipt.confirm');
  const [method, setMethod] = useState<'CASH' | 'BANK'>('BANK');
  const goods = o.lines.filter((l) => l.kind === 'SKU' && l.ref);
  const iss = goods.reduce((s, l) => s + saleIssQ(o, l), 0);
  const back = goods.reduce((s, l) => s + Math.min(saleRetQ(o, l), saleIssQ(o, l)), 0);
  const mine = stockVouchers.filter((v) => v.saleId === o.id);
  const retPend = mine.filter((v) => v.type === 'IN' && v.status === 'PENDING');
  const retDone = mine.filter((v) => v.type === 'IN' && v.status === 'DONE');
  const outPend = mine.filter((v) => v.type === 'OUT' && v.status === 'PENDING');
  const paidIn = o.payments.filter((p) => p.confirmed && !p.refund).reduce((s, p) => s + p.amount, 0);
  const refunded = Math.abs(o.payments.filter((p) => p.confirmed && p.refund).reduce((s, p) => s + p.amount, 0));
  const net = salePaid(o);
  const waitP = o.payments.filter((p) => !p.confirmed);
  const invDone = (o.invReqs ?? []).filter((r) => r.status === 'DONE');
  const invPend = (o.invReqs ?? []).filter((r) => r.status === 'PENDING');
  const goodsOk = saleGoodsBack(o);
  const moneyOk = net === 0 && !waitP.length;
  const todo = [goodsOk, moneyOk].filter((x) => !x).length;
  const ready = R.cancelReady(o);
  const muted = 'text-[13px] text-[rgb(var(--muted))]';
  type Row = { ok: boolean; warn?: boolean; t: string; sub: string; st: ReactNode; act?: ReactNode };
  const rows: Row[] = [
    { ok: goodsOk, t: 'Hàng đã xuất', sub: iss ? `${fmtN(iss)} đơn vị` : 'Chưa xuất kho',
      st: iss ? <span className="inline-flex flex-wrap items-center gap-1.5">Đã nhập trả {fmtN(back)} / {fmtN(iss)}{retDone.map((v) => <Code key={v.id}>{v.code}</Code>)}</span> : 'Không cần nhập trả',
      act: goodsOk ? undefined : retPend.length ? <span className={muted}>Chờ kho duyệt {retPend.map((v) => v.code).join(', ')}</span>
        : <button className={btnPrimary} onClick={() => requestSaleReturn(o.id)}><Undo2 className="h-4 w-4" aria-hidden />Lập phiếu nhập trả</button> },
    { ok: moneyOk, t: 'Tiền khách đã trả', sub: paidIn ? fmtN(paidIn) : 'Chưa thu', st: paidIn || refunded ? `Đã hoàn ${fmtN(refunded)} / ${fmtN(paidIn)}` : 'Không cần hoàn tiền',
      act: waitP.length ? (canCash ? <button className={btnGhost} onClick={() => waitP.forEach((p) => confirmSalePayment(o.id, p.id))}>Xác nhận {waitP.length} phiếu chờ</button> : <span className={muted}>{waitP.length} phiếu chờ kế toán xác nhận</span>)
        : net > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5 text-[12.5px]" role="radiogroup" aria-label="Hình thức hoàn">
              {([['CASH', 'Tiền mặt'], ['BANK', 'Chuyển khoản']] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={method === k} className={cn('rounded-md px-2.5 py-1', method === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]' : 'text-[rgb(var(--fg2))]')} onClick={() => setMethod(k)}>{l}</button>)}
            </div>
            <button className={btnPrimary} onClick={() => addSalePayment(o.id, net, method, o, { refund: true, payer: o.customer, note: `Hoàn tiền hủy đơn ${o.code}`, date: todayISO() })}><Plus className="h-4 w-4" aria-hidden />{canCash ? 'Lập phiếu chi hoàn tiền' : 'Đề nghị hoàn tiền'}</button>
          </div>)
        : net < 0 ? <span className="text-[13px] text-[rgb(var(--danger-fg))]">Đã hoàn thừa {fmtN(-net)}</span> : undefined },
    { ok: true, warn: invDone.length > 0, t: 'Hóa đơn thuế', sub: invDone.length ? invDone.map((r) => r.no).join(', ') : 'Chưa xuất',
      st: invDone.length ? 'Kế toán lập hóa đơn điều chỉnh giảm' : invPend.length ? `${invPend.length} yêu cầu chờ, trả lại khi hủy` : 'Không cần điều chỉnh' },
    { ok: true, t: 'Phiếu xuất chờ kho', sub: String(outPend.length), st: outPend.length ? `Hủy kèm ${outPend.map((v) => v.code).join(', ')}` : 'Không còn phiếu chờ' },
  ];
  return (
    <div className="glass-card mb-4 rounded-xl border border-[rgb(var(--accent)/0.4)] p-5">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold">Hủy đơn hàng</h3>
        <span className={cn(muted, 'max-sm:hidden')}>{iss || paidIn ? 'Đơn đã có chứng từ: hủy để đóng đơn, giữ lịch sử, không xóa' : 'Đơn chưa xuất kho, chưa thu tiền'}</span>
        <button className={cn(btnGhost, 'ml-auto p-1.5')} onClick={() => setWhy(null)} aria-label="Đóng"><X className="h-4 w-4" aria-hidden /></button>
      </div>
      <div className="mt-3">
        {rows.map((r) => (
          <div key={r.t} className="grid grid-cols-1 items-center gap-2 border-t border-[rgb(var(--line)/0.6)] py-3 first:border-t-0 sm:grid-cols-[28px_200px_1fr_auto] sm:gap-3">
            <span className={cn('grid h-6 w-6 place-items-center rounded-full', !r.ok ? 'border-2 border-[rgb(var(--accent))] text-[rgb(var(--accent))]' : r.warn ? 'bg-[rgb(var(--accent))] text-white' : 'bg-[rgb(var(--fg))] text-[rgb(var(--surface))]')} aria-label={r.ok ? 'Đạt' : 'Chưa đạt'}>{r.ok ? <CheckIcon className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}</span>
            <div><p className="font-medium">{r.t}</p><p className="text-[12.5px] text-[rgb(var(--muted))]">{r.sub}</p></div>
            <div className="text-[13.5px] text-[rgb(var(--fg2))]">{r.st}</div>
            <div className="sm:justify-self-end">{r.act}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className={cn(inputBase, 'min-w-[240px] flex-1')} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Lý do hủy đơn" aria-label="Lý do hủy" />
        <button className={btnGhost} onClick={() => setWhy(null)}>Thôi</button>
        <button className={cn(btnPrimary, 'bg-[rgb(var(--danger))]')} disabled={!ready || why.trim().length < 3} onClick={() => { R.cancelOrder(o, why.trim()); setWhy(null); }}><XCircle className="h-4 w-4" aria-hidden />Hủy đơn</button>
      </div>
      <p className={cn(muted, 'mt-2')}>{ready ? 'Đủ điều kiện hủy. Đơn đóng lại, toàn bộ chứng từ được giữ' : `Còn ${todo} việc trước khi hủy`}</p>
    </div>
  );
}

export function SaleDetail({ o, onBack, onApprove, onPay, onEdit, startCancel }: { o: SalesOrder; onBack: () => void; /** v60: reject = mở bảng duyệt ở ô ý kiến để từ chối */ onApprove: (reject?: boolean) => void; onPay: () => void; onEdit: () => void; startCancel?: boolean }) {
  const R = useSaleRights();
  const { quotes, openComposer, setSaleStatus, confirmSalePayment, users, company, canDo, pos, stockVouchers, workOrders, go, warehouses, me, setSalesOrders, cashEntries } = useApp();
  const { todo } = useApprovalQueue();
  const myTurn = todo.some((x) => x.key === `so-${o.id}`);
  // v61: địa điểm giao / nhận: nhận tại kho → tên kho + địa chỉ kho; giao đi → địa chỉ trên đơn
  const shipAddrOf = (x: SalesOrder) => { if (x.delivery !== 'PICKUP') return x.address || '—'; const w = warehouses.find((k) => k.id === x.whId); return w ? `${w.name}${w.address ? ` · ${w.address}` : ''}` : 'Tại kho'; };
  const t = saleTotals(o);
  const ret = saleReturned(o);
  const due = saleOwed(o);
  const paid = salePaid(o);
  const pend = salePaid(o, true) - paid;
  const left = due - salePaid(o, true);
  const [docF, setDocF] = useState<'ALL' | 'WH' | 'CASH' | 'INV'>('ALL');
  const [logF, setLogF] = useState<'ALL' | 'NOTE' | 'SYS'>('ALL');
  const [msg, setMsg] = useState('');
  const [more, setMore] = useState(false);
  const moreRef = useOutside(more, () => setMore(false));
  const [cancel, setCancel] = useState<string | null>(startCancel ? '' : null);
  // v58: thẻ cột trái "Trao đổi" / "Chứng từ & Bút toán" (hủy đơn mở sẵn Chứng từ)
  const [tab, setTab] = useState<'log' | 'docs'>(startCancel ? 'docs' : 'log');
  useEffect(() => { if (cancel !== null) setTab('docs'); }, [cancel !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  const [inv, setInv] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  // v60: gửi email phiếu bán hàng, menu In, thuật ngữ ngành cho tiêu đề phiếu
  const [mail, setMail] = useState(false);
  const [prOpen, setPrOpen] = useState(false);
  const prRef = useOutside(prOpen, () => setPrOpen(false));
  // v61: thêm người liên quan (ô chọn nhân sự mở ngay dưới nút +)
  const [wOpen, setWOpen] = useState(false);
  const [wq, setWq] = useState('');
  const { dispatch } = useApp();
  const { t: term } = useTerminology();
  const { journalEntries, invoiceRequests, mfgConfig } = useApp();
  const myInv = invoiceView(invoiceRequests.filter((r) => r.saleId === o.id), [o]);
  const invPend = myInv.filter((r) => r.status === 'PENDING');
  const q = o.quoteId ? quotes.find((x) => x.id === o.quoteId) : undefined;
  const stage = saleStage(o, stockVouchers);
  const pq = salePendingQ(o, stockVouchers);
  const canCash = canDo('cash.manage') || canDo('receipt.confirm');
  const vs = stockVouchers.filter((v) => v.saleId === o.id || (!v.saleId && v.ref === o.code)).sort((a, b) => a.createdAt - b.createdAt);
  const wo = o.woId ? workOrders.find((w) => w.id === o.woId) : undefined;
  const remain = o.lines.reduce((s, l) => s + Math.max(0, l.qty - saleIssQ(o, l) - (pq[l.id] ?? 0)), 0);
  const issuedAny = o.lines.some((l) => saleIssQ(o, l) > 0);
  const invAsked = (o.invReqs ?? []).filter((r) => r.status !== 'REJECTED').reduce((s, r) => s + r.amount, 0);
  const invDone = (o.invReqs ?? []).filter((r) => r.status === 'DONE');
  const canReq = o.status === 'PENDING' && stage !== 'APPROVAL' && stage !== 'REJECTED' && remain > 0;
  const canInv = o.status !== 'CANCELLED' && due - invAsked > 0 && stage !== 'APPROVAL' && stage !== 'REJECTED';
  const nameOf = useNameOf();
  const nm = (id?: string) => (id ? nameOf(id) : '');
  // v57b dữ liệu gắn vào Khung linh hoạt / Khung tự do
  const bindDefs = useSaleHeadDefs();
  const { skus } = useApp();
  const [view, setView] = useState<string | null>(null);
  type Info = { origin: string; docRef: string; by: string; receiver: string; phone: string; address: string; deliverAt: string; note: string; invoice: boolean; cf: Record<string, CfVal>; lcf: Record<string, Record<string, CfVal>>;
    /** v61 */ recvPhone: string; email: string; contact: string };
  const [info, setInfo] = useState<Info | null>(null);
  const { notify, mySales, setOpenSale, org, resources, salesOrders: salesOrdersAll, customers, departments, wfDef, wfRuns, wfCtx, wfFirstApprovers } = useApp();
  // v60: người có quyền duyệt bước đang chờ / người duyệt phiếu xuất kho (hiện ở Quy trình xử lý đơn hàng)
  const apprWho: User[] = (() => {
    const a = o.approval;
    if (stage !== 'APPROVAL' || !a || a.self || a.status !== 'PENDING') return [];
    const cu = customers.find((c) => c.id === o.customerId);
    const ws: WfSubject = { requesterId: a.requestedBy ?? o.by, dept: cu?.dept, amount: t.grand, vals: { amount: t.grand, maxDisc: Math.max(0, ...o.lines.map((l) => l.discountPct)) } };
    const run = wfRuns.filter((r) => r.key === 'SALE' && r.refId === o.id).sort((x, y) => y.startedAt - x.startedAt)[0];
    const def = wfDef('SALE');
    const steps = run?.steps ?? (def ? wfPath(def, ws) : []);
    const cur = run ? run.decisions.filter((d) => d.decision === 'APPROVED').length : 0;
    return steps[cur] ? wfApprovers(steps[cur], ws, wfCtx()).map((x) => x.u) : [];
  })();
  const stockWho: User[] = issuedAny || o.status !== 'PENDING' ? [] : wfFirstApprovers('VOUCHER', { requesterId: o.by, whId: o.whId, amount: t.net, vals: { amount: t.net } });
  const cfd = useSaleCf();
  const fl = useSaleFormLayout();
  const cfHeadForm = fl.formDefs;
  const cfLineForm = cfd.line.filter((d) => d.status === 'ACTIVE' && d.where.form);
  const startInfo = () => setInfo({ origin: o.origin ?? (o.source === 'QUOTE' ? 'Từ báo giá' : 'Tại quầy'), docRef: o.docRef ?? '', by: o.by ?? '', receiver: o.receiver ?? '', phone: o.phone ?? '', address: o.address ?? '', deliverAt: o.deliverAt ?? '', note: o.note ?? '', invoice: o.invoice,
    recvPhone: o.recvPhone ?? o.phone ?? '', email: o.email ?? '', contact: o.contact ?? '',
    cf: o.cf ?? {}, lcf: Object.fromEntries(o.lines.map((l) => [l.id, l.cf ?? {}])) });
  const saveInfo = () => {
    if (!info) return;
    const miss = cfMissing(cfHeadForm, info.cf, 'SAVE');
    if (miss.length) return notify(`${miss[0].type === 'check' ? 'Cần tích' : 'Nhập'} ${miss[0].label}`, 'red');
    // v56: chặn chọn tài nguyên (đội thợ, xe…) đã có lịch trùng giờ ở bản ghi khác; trường công thức tính lại
    const clash = resourceConflicts(cfd.head, info.cf, salesOrdersAll.map((x) => ({ id: x.id, code: x.code, cf: x.cf, cancelled: x.status === 'CANCELLED' })), resources, o.id);
    if (clash.length) return notify(clash[0], 'red');
    if (info.email.trim() && !EMAIL_RE.test(info.email.trim())) return notify('Email khách chưa đúng định dạng', 'red');
    const cfNew = cfCompute(cfd.head, info.cf);
    setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, origin: info.origin.trim() || undefined, docRef: info.docRef.trim() || undefined, by: info.by || x.by, receiver: info.receiver.trim() || undefined, phone: info.phone.trim() || undefined, address: info.address.trim() || undefined, deliverAt: info.deliverAt || undefined, note: info.note.trim() || undefined, invoice: info.invoice,
      recvPhone: info.recvPhone.trim() || undefined, email: info.email.trim() || undefined, contact: info.contact.trim() || undefined,
      cf: Object.keys(cfNew).length ? cfNew : undefined, lines: x.lines.map((l) => { const v = info.lcf[l.id]; return v ? { ...l, cf: Object.keys(v).length ? v : undefined } : l; }),
      notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: 'Cập nhật thông tin đơn (không đổi hàng hóa, giá)' }] } : x)));
    setInfo(null);
  };
  const goods = o.lines.filter((l) => l.kind !== 'FREE');
  const sumQ = (f: (l: SaleLine) => number) => goods.reduce((s, l) => s + f(l), 0);
  const ord = sumQ((l) => l.qty), iss = sumQ((l) => saleIssQ(o, l)), rq = sumQ((l) => saleRetQ(o, l));
  const ckd = (l: SaleLine) => Math.round(l.qty * l.price) - saleLineNet(l);
  const cashCode = (pid: string) => saleCashOf(cashEntries, pid)?.code;
  type Doc = { key: string; g: 'WH' | 'CASH' | 'INV' | 'OTHER'; code: string; type: ReactNode; date: string; qty?: number; amt?: number; note?: string; who?: string; st: ReactNode; open?: () => void };
  const docs: Doc[] = [
    ...vs.map((v): Doc => ({ key: v.id, g: 'WH', code: v.code, type: <span className="inline-flex items-center gap-1.5">{v.type === 'IN' ? <Undo2 className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /> : <PackageMinus className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />}{v.type === 'IN' ? 'Nhập trả' : 'Phiếu xuất'}</span>, date: v.date, qty: v.lines.reduce((s, l) => s + l.qty, 0), note: v.note, who: nm(v.approvedBy) || undefined, st: <Chip tone={v.status === 'PENDING' ? 'orange' : v.status === 'DONE' ? 'teal' : 'muted'}>{v.status === 'PENDING' ? 'Chờ kho' : v.status === 'DONE' ? (v.type === 'IN' ? 'Đã nhập' : 'Đã xuất') : 'Đã hủy'}</Chip>, open: () => go('warehouse') })),
    ...o.payments.map((p): Doc => ({ key: p.id, g: 'CASH', code: cashCode(p.id) ?? 'Phiếu thu', type: <span className="inline-flex items-center gap-1.5"><Banknote className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />{p.refund ? 'Phiếu chi' : 'Phiếu thu'}</span>, date: p.date ?? iso(new Date(p.at)), amt: p.amount, note: p.note ?? (p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'), who: nm(p.confirmedBy ?? p.by) || undefined, st: <Chip tone={p.confirmed ? 'teal' : 'orange'}>{p.confirmed ? 'Đã xác nhận' : 'Chờ kế toán'}</Chip>, open: onPay })),
    ...(o.invReqs ?? []).map((r): Doc => ({ key: r.id, g: 'INV', code: r.no ?? 'Yêu cầu HĐ', type: <span className="inline-flex items-center gap-1.5"><ReceiptIcon className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Hóa đơn thuế</span>, date: iso(new Date(r.doneAt ?? r.at)), amt: r.amount, note: r.why ?? r.note, who: nm(r.doneBy ?? r.by) || undefined, st: <Chip tone={r.status === 'DONE' ? 'teal' : r.status === 'PENDING' ? 'orange' : 'muted'}>{r.status === 'DONE' ? 'Đã xuất' : r.status === 'PENDING' ? 'Chờ kế toán' : 'Trả lại'}</Chip> })),
    ...(o.issueRefs ?? []).filter((r) => r.startsWith('PX-') && !vs.some((v) => v.code === r)).map((r): Doc => ({ key: r, g: 'WH', code: r, type: 'Xuất vật tư', date: o.issuedAt ? iso(new Date(o.issuedAt)) : o.date, st: <Chip tone="teal">Đã xuất</Chip>, open: () => go('inventory') })),
    ...pos.filter((p) => o.poIds?.includes(p.id)).map((p): Doc => ({ key: p.id, g: 'OTHER', code: p.code, type: 'Đặt hàng NCC', date: p.orderDate, note: p.vendor, st: <Chip tone="blue">Dự kiến {fmtDate(p.expectedDate)}</Chip>, open: () => go('supply') })),
    ...(cancel !== null && salePaid(o) > 0 ? [{ key: 'need-refund', g: 'CASH' as const, code: '—', type: <span className="inline-flex items-center gap-1.5"><Banknote className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Phiếu chi hoàn tiền</span>, date: todayISO(), amt: salePaid(o), note: 'Hoàn tiền khách để hủy đơn', st: <Chip tone="orange">Cần lập</Chip> }] : []),
    ...(wo ? [{ key: wo.id, g: 'OTHER' as const, code: wo.code, type: 'Lệnh sản xuất', date: wo.startDate, note: wo.title, st: <Chip tone={WO_STAGE[wo.stage].tone}>{WO_STAGE[wo.stage].label}</Chip>, open: () => go('production') }] : []),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const docsV = docs.filter((d) => docF === 'ALL' || d.g === docF);
  const notes = o.notes ?? [];
  const sys: { at: number; icon: typeof Wallet; text: ReactNode }[] = [
    { at: o.createdAt, icon: FileText, text: <>{nm(o.by) || 'Hệ thống'} tạo đơn{q ? <> từ <Code>{q.code}</Code></> : ''}</> },
    ...(o.approval?.decidedAt ? [{ at: o.approval.decidedAt, icon: CheckIcon, text: <>{nm(o.approval.decidedBy)} {o.approval.status === 'APPROVED' ? 'duyệt đơn' : o.approval.status === 'REJECTED' ? 'từ chối đơn' : 'yêu cầu bổ sung'}{o.approval.note ? ` · ${o.approval.note}` : ''}</> }] : []),
    ...vs.filter((v) => v.status === 'DONE').map((v) => ({ at: v.approvedAt ?? v.createdAt, icon: v.type === 'IN' ? Undo2 : PackageMinus, text: <>{nm(v.approvedBy) || 'Kho'} {v.type === 'IN' ? 'nhập trả' : 'xuất kho'} <Code>{v.code}</Code> · {fmtN(v.lines.reduce((s, l) => s + l.qty, 0))}</> })),
    ...o.payments.filter((p) => p.confirmed).map((p) => ({ at: p.confirmedAt ?? p.at, icon: Banknote, text: <>{nm(p.confirmedBy)} xác nhận {p.refund ? 'hoàn' : 'thu'} {fmtN(Math.abs(p.amount))} · {p.method === 'CASH' ? 'tiền mặt' : 'chuyển khoản'}</> })),
    ...invDone.map((r) => ({ at: r.doneAt ?? r.at, icon: ReceiptIcon, text: <>{nm(r.doneBy)} xuất hóa đơn <Code>{r.no}</Code> · {fmtN(r.amount)}</> })),
  ];
  type Feed = { at: number; note?: SaleNote; s?: (typeof sys)[number] };
  const feed: Feed[] = [...(logF !== 'SYS' ? notes.map((n): Feed => ({ at: n.at, note: n })) : []), ...(logF !== 'NOTE' ? sys.map((x): Feed => ({ at: x.at, s: x })) : [])].sort((a, b) => b.at - a.at);
  const send = () => { const tx = msg.trim(); if (!tx) return; setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: tx }] } : x))); setMsg(''); };
  // ---------------- v53: bố cục do 3A phát hành, trường tùy chỉnh, nút biểu tượng, tệp đính kèm
  const lay = useTenantLayout('sale-detail');
  const starter = useMemo(() => lStarterSale(), []);
  const blocks = lay?.blocks ?? starter;
  const wide = useMinW(1280);
  const phone = !useMinW(640);
  const dev: LDevice = wide ? 'lg' : phone ? 'sm' : 'md';
  const blkOf = (t: LBlockType) => blocks.find((b) => b.type === t);
  const lstage = lStageOf(o, stage, cancel !== null);
  const myRole = me?.role ?? null;
  const iconOn = (a: LIconAct) => blocks.some((b) => (b.type === 'K-Icons' || b.type === 'K-Button') && b.show[dev] && lCondOk(b.config, lstage, myRole) && (b.type === 'K-Icons' ? b.config.icons ?? [] : (b.config.buttons ?? []).map((x) => x.act)).includes(a));
  const cfHeadInfo = cfd.head.filter((d) => d.where.info && (d.status === 'ACTIVE' || !cfEmpty(o.cf?.[d.key])));
  const cfLineCols = cfd.line.filter((d) => d.where.info && (d.status === 'ACTIVE' || o.lines.some((l) => !cfEmpty(l.cf?.[d.key]))));
  const needAp = stage === 'APPROVAL' ? cfMissing(fl.defs, o.cf, 'APPROVE') : [];
  const seq = [...mySales].sort((a, b) => b.createdAt - a.createdAt);
  const at = seq.findIndex((x) => x.id === o.id);
  const prevO = at > 0 ? seq[at - 1] : undefined;
  const nextO = at >= 0 ? seq[at + 1] : undefined;
  const upRef = useRef<HTMLInputElement>(null);
  const [upBusy, setUpBusy] = useState(false);
  const canUp = o.status !== 'CANCELLED' && (R.canInfo(o) || R.canDocs());
  const addFiles = async (list: FileList | null) => {
    if (!list || !list.length) return;
    const room = 10 - (o.files ?? []).length;
    if (room <= 0) { notify('Mỗi đơn tối đa 10 tệp', 'orange'); return; }
    setUpBusy(true);
    try {
      // v55.1 / v60: tải lên kho riêng tư theo doanh nghiệp / đơn (hàm dùng chung với form tạo đơn)
      const out = await uploadSaleFiles(org.id, o.id, Array.from(list).slice(0, room), me?.id, notify);
      if (out.length) {
        setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, files: [...(x.files ?? []), ...out], notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: `Tải lên ${out.map((f) => f.name).join(', ')}` }] } : x)));
        notify(`Đã tải lên ${out.length} tệp cho ${o.code}`, 'teal');
      }
    } catch (e) { notify(e instanceof CloudError ? cloudMessage(e) : 'Không đọc được tệp', 'red'); } finally { setUpBusy(false); if (upRef.current) upRef.current.value = ''; }
  };
  const delFile = (f: SaleFile) => {
    setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, files: (x.files ?? []).filter((y) => y.id !== f.id), notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: `Bỏ tệp ${f.name}` }] } : x)));
    // v55.1: xóa luôn trong kho riêng tư (cùng nội dung tải 2 lần trong một đơn dùng chung một tệp -> chỉ xóa khi không còn tệp nào trỏ tới)
    const p = attachPath(f);
    if (CLOUD_ON && p && !(o.files ?? []).some((y) => y.id !== f.id && attachPath(y) === p)) void cloud.removeAttachment(p).catch(() => notify(`Chưa xóa được ${f.name} trong kho tệp`, 'orange'));
  };
  const openFile = (f: SaleFile, mode: 'view' | 'download') => { void openAttachment(f, mode).catch((e) => notify(cloudMessage(e), 'red')); };
  const lineCfg = blkOf('K-Order-Lines')?.config;
  const lineIds = lFieldOrder([...SO_LINE_F, ...cfLineCols.map((d) => ({ id: `cf:${d.key}`, label: d.label }))], lineCfg);
  const download = () => {
    const lc = cfLineCols;
    downloadBlob(`DonHang_${o.code}.xlsx`, xlsxBlob([
      { name: 'Thong tin', widths: [26, 48], rows: [['Mã đơn', o.code], ['Ngày', fmtDate(o.date)], ['Khách hàng', o.customer], ['Mã số thuế', o.taxCode ?? ''], ['Trạng thái', SALE_STAGE[stage].label], ['Người thực hiện', nm(o.by)], ['Kho xuất', warehouses.find((w) => w.id === o.whId)?.name ?? ''], ['Nguồn chứng từ', o.docRef ?? ''],
        ...cfHeadInfo.map((d) => [d.label, cfText(d, o.cf?.[d.key], nm)]), ['Tiền hàng', t.net], ['Thuế GTGT', t.vat], ['Tổng đơn', t.grand], ['Đã thu', paid], ['Còn lại', Math.max(0, left)]] },
      { name: 'Hang hoa', widths: [6, 16, 40, 8, 10, 14, 8, 14, 8, 16, ...lc.map(() => 18)], rows: [['STT', 'Mã sản phẩm', 'Tên sản phẩm', 'ĐVT', 'Số lượng', 'Đơn giá', 'CK%', 'CK (đ)', 'VAT%', 'Thành tiền', ...lc.map((d) => d.label)],
        ...o.lines.map((l, i) => [i + 1, l.ref ?? '', l.name, l.unit, l.qty, l.price, l.discountPct || 0, ckd(l), l.vat, saleLineNet(l), ...lc.map((d) => cfText(d, l.cf?.[d.key], nm))]),
        ['', '', `Cộng ${o.lines.length} mặt hàng`, '', o.lines.reduce((s, l) => s + l.qty, 0), '', '', t.discount, '', t.net]] },
    ]));
  };
  const onIcon = (a: LIconAct) => {
    if (a === 'back') onBack();
    else if (a === 'prev' && prevO) setOpenSale(prevO.id);
    else if (a === 'next' && nextO) setOpenSale(nextO.id);
    else if (a === 'print') printHtml(docShell(`Phiếu bán hàng ${o.code}`, saleHtml(o, company)));
    else if (a === 'download') download();
    else if (a === 'upload') upRef.current?.click();
  };
  const menuItem = 'block w-full rounded-md px-3 py-2 text-left hover:bg-[rgb(var(--ink)/0.05)] disabled:opacity-40';
  // v58: một nút hành động chính đổi theo bước của đơn; các thao tác khác vào menu ⋯
  const makeLines = o.lines.some((l) => l.kind === 'MAKE');
  const hasStock = o.lines.some((l) => l.kind === 'SKU' && !!l.ref);
  const canPayNow = cancel === null && o.status !== 'CANCELLED' && stage !== 'APPROVAL' && stage !== 'REJECTED';
  type Act = { id: string; label: string; icon: typeof Coins; run: () => void; ghost?: boolean };
  const acts: Act[] = [
    ...(stage === 'APPROVAL' ? [{ id: 'approve', label: myTurn || R.canSelf(o) ? 'Duyệt đơn' : 'Xem duyệt', icon: CheckIcon, run: () => onApprove(), ghost: !(myTurn || R.canSelf(o)) }] : []),
    ...(cancel === null && canReq ? [{ id: 'issue', label: makeLines && !hasStock ? 'Lệnh sản xuất' : 'Yêu cầu xuất kho', icon: PackageMinus, run: () => setIssueOpen(true) }] : []),
    ...(o.status === 'CANCELLED' && left < 0 ? [{ id: 'refund', label: `Hoàn tiền khách ${fmtN(-left)}`, icon: Coins, run: onPay }] : []),
    ...(canPayNow && issuedAny && left > 0 ? [{ id: 'pay', label: canCash ? 'Ghi thu' : 'Báo đã nhận tiền', icon: Coins, run: onPay }] : []),
    ...(cancel === null && canInv && o.invoice && issuedAny ? [{ id: 'inv', label: 'Yêu cầu xuất hóa đơn', icon: ReceiptIcon, run: () => setInv(true) }] : []),
  ];
  const primary = acts[0];
  const extra: Act[] = [
    ...acts.slice(1),
    ...(canPayNow && !acts.some((a) => a.id === 'pay') ? [{ id: 'pay', label: canCash ? 'Lập phiếu thu' : 'Báo đã nhận tiền', icon: Coins, run: onPay }] : []),
    ...(cancel === null && canInv && !acts.some((a) => a.id === 'inv') ? [{ id: 'inv', label: 'Yêu cầu xuất hóa đơn', icon: ReceiptIcon, run: () => setInv(true) }] : []),
  ];
  const moreItems = (
    <>
      {extra.map((a) => <button key={a.id} className={menuItem} data-menu-act={a.id} onClick={() => { setMore(false); a.run(); }}>{a.label}</button>)}
      {!iconOn('print') && <button className={menuItem} onClick={() => { setMore(false); printHtml(docShell(`Phiếu bán hàng ${o.code}`, saleHtml(o, company))); }}>In phiếu bán hàng</button>}
      {q && <button className={menuItem} onClick={() => { setMore(false); openComposer({ quoteId: q.id, view: true, mode: 'QUOTE' }); }}>Mở báo giá {q.code}</button>}
      <button className={menuItem} disabled={!R.canEdit(o)} onClick={() => { setMore(false); onEdit(); }}>Sửa đơn</button>
      {o.status === 'SHIPPING' && <button className={menuItem} onClick={() => { setMore(false); setSaleStatus(o.id, 'DONE'); }}>Đã giao xong</button>}
      <button className={cn(menuItem, 'text-[rgb(var(--danger-fg))]')} disabled={!R.canCancel(o)} onClick={() => { setMore(false); setCancel(''); }}>Hủy đơn</button>
      <button className={cn(menuItem, 'text-[rgb(var(--danger-fg))]')} disabled={!R.canDelete(o)} title={R.delWhy(o) || undefined} onClick={() => { setMore(false); R.remove(o); onBack(); }}>Xóa đơn{R.canDelete(o) ? '' : <span className="block text-[11.5px]">{R.delWhy(o)}</span>}</button>
    </>
  );
  const ini = (id?: string) => (nm(id) || '?').split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();
  // v60: tiêu đề phiếu theo thuật ngữ ngành ("Đơn bán hàng" mặc định đọc là ĐƠN HÀNG BÁN như mẫu Getfly)
  const docT = term('sale') === 'Đơn bán hàng' ? 'Đơn hàng bán' : term('sale');
  const canReject = stage === 'APPROVAL' && cancel === null && (myTurn || R.canSelf(o));
  return (
    <div className="glass-card min-w-0 rounded-xl" data-sale-detail>
      <SoBand crumb={`${term('saleList')} / Chi tiết đơn hàng`} onCrumb={onBack} title={`${o.code} · ${SALE_STAGE[stage].label}`} chips={issuedAny && o.status !== 'CANCELLED' ? <span className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-2 py-0.5 text-[12px] text-[rgb(var(--fg2))]"><Lock className="h-3 w-3" aria-hidden />Đã khóa hàng hóa</span> : undefined}>
        {cancel === null && R.canCancel(o) && o.status !== 'CANCELLED' && stage !== 'APPROVAL' && <button className={cn(btnGhost, 'border-transparent bg-transparent text-[rgb(var(--fg2))]')} onClick={() => setCancel('')} data-head-act="cancel">Hủy đơn</button>}
        <button className={btnGhost} onClick={() => setMail(true)} data-head-act="mail"><Mail className="h-4 w-4" aria-hidden />Gửi email</button>
        {canPayNow && primary?.id !== 'pay' && <button className={btnGhost} onClick={onPay} data-head-act="pay"><Wallet className="h-4 w-4" aria-hidden />Thanh toán</button>}
        {!iconOn('print') && <div className="relative" ref={prRef}>
          <button className={btnGhost} onClick={() => setPrOpen((v) => !v)} aria-expanded={prOpen} aria-haspopup="menu" data-head-act="print"><Printer className="h-4 w-4" aria-hidden />In<ChevronDown className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /></button>
          {prOpen && (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 text-[13.5px] shadow-xl" role="menu">
              <button role="menuitem" className={menuItem} onClick={() => { setPrOpen(false); printHtml(docShell(`Phiếu bán hàng ${o.code}`, saleHtml(o, company))); }}>In phiếu bán hàng</button>
              <button role="menuitem" className={menuItem} onClick={() => { setPrOpen(false); download(); }}>Tải Excel đơn hàng</button>
            </div>
          )}
        </div>}
        {canReject && <button className={cn(btnGhost, 'text-[rgb(var(--danger-fg))]')} onClick={() => onApprove(true)} data-head-act="reject">Từ chối</button>}
        {!iconOn('menu') && <div className="relative" ref={moreRef}>
          <button className={soIco} onClick={() => setMore((v) => !v)} aria-label="Thao tác khác" aria-expanded={more}><MoreVertical className="h-4 w-4" aria-hidden /></button>
          {more && (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 text-[13.5px] shadow-xl" data-more-menu>{moreItems}</div>
          )}
        </div>}
        <input ref={upRef} type="file" multiple className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { void addFiles(e.target.files); }} aria-label="Chọn tệp đính kèm" />
        {primary && <button className={primary.ghost ? btnGhost : btnPrimary} onClick={primary.run} data-primary-act={primary.id}><primary.icon className="h-4 w-4" aria-hidden />{primary.label}</button>}
      </SoBand>
      {inv && <SaleInvoiceForm o={o} onClose={() => setInv(false)} />}
      {mail && <SaleMailDrawer o={o} onClose={() => setMail(false)} />}
      {issueOpen && <SaleIssueDrawer o={o} view={!(cancel === null && canReq)} onClose={() => setIssueOpen(false)} />}
      {view && (() => {
        const d = docs.find((x) => x.key === view);
        if (!d) return null;
        const v = vs.find((x) => x.id === view);
        const p = o.payments.find((x) => x.id === view);
        const r = (o.invReqs ?? []).find((x) => x.id === view);
        const po = pos.find((x) => x.id === view);
        const html = v ? soVoucherHtml(v, skus, warehouses.find((w) => w.id === v.whId)?.name ?? '', nm, company)
          : p ? soReceiptHtml(o, p, d.code, company, nm(p.by))
          : r ? soInfoHtml('YÊU CẦU XUẤT HÓA ĐƠN', r.no ?? '—', [['Đơn hàng', o.code], ['Khách hàng', `${o.customer}${o.taxCode ? ` · MST ${o.taxCode}` : ''}`], ['Số tiền', `${fmtN(r.amount)} đ`], ['Người yêu cầu', nm(r.by)], ['Ngày yêu cầu', soTime(r.at)], ['Trạng thái', r.status === 'DONE' ? `Đã xuất ${r.no}` : r.status === 'PENDING' ? 'Chờ kế toán' : `Trả lại: ${r.why ?? ''}`], ['Ghi chú', r.note ?? ''], ...(r.buyer ? [['Người mua', r.buyer.name], ['Mã số thuế', r.buyer.noTax ? 'Không có' : r.buyer.taxCode ?? ''], ['Địa chỉ', r.buyer.address], ['Email nhận hóa đơn', r.buyer.email]] as [string, string][] : []), ...(r.items ?? []).map((x): [string, string] => [`${x.name} (${x.unit})`, `${fmtN(x.qty)} × · ${fmtN(x.amount)} đ · VAT ${x.vat}%`])], company)
          : po ? soInfoHtml('ĐẶT HÀNG NHÀ CUNG CẤP', po.code, [['Nhà cung cấp', po.vendor], ['Ngày đặt', fmtDate(po.orderDate)], ['Dự kiến về', fmtDate(po.expectedDate)], ['Số dòng', String(po.lines.length)]], company)
          : soInfoHtml(String(d.code), d.code, [['Loại', typeof d.type === 'string' ? d.type : ''], ['Ngày', fmtDate(d.date)], ['Ghi chú', d.note ?? '']], company);
        const doc = docShell(d.code, html);
        return (
          <Drawer size="lg" title={`Chứng từ ${d.code}`} eyebrow={o.code} onClose={() => setView(null)} footer={<div className="flex flex-wrap items-center justify-end gap-2">
            <button className={cn(btnGhost, 'mr-auto')} onClick={() => printHtml(doc)}><Printer className="h-4 w-4" aria-hidden />In / lưu PDF</button>
            <button className={btnGhost} onClick={() => setView(null)}>Đóng</button>
            {R.canDocs() && d.open && <button className={btnPrimary} onClick={() => { setView(null); d.open?.(); }}><Pencil className="h-4 w-4" aria-hidden />Sửa chứng từ</button>}
          </div>}>
            <iframe title={`Chứng từ ${d.code}`} srcDoc={doc} className="h-[70vh] w-full rounded-lg border border-[rgb(var(--line))] bg-white" />
          </Drawer>
        );
      })()}
      {(() => {
        const iconCls = 'h-4 w-4 shrink-0 text-[rgb(var(--muted))]';
        // v55.2: khối Chi tiết bản ghi — nhóm trường, độ rộng, nhãn theo bố cục 3A; cùng bộ vẽ với màn xem trước
        const infoCfg = blkOf('K-RecordDetail')?.config;
        const infoSecs = lSaleSections('detail', infoCfg, cfd.head);
        // v60: bố cục có ô Mã số thuế riêng thì ô Khách hàng chỉ ghi tên (mỗi ô một thông tin); bố cục cũ giữ cách ghi gộp như trước
        const sheetKeys = new Set(infoSecs.flatMap((s) => s.fields.map((f) => f.fieldKey)));
        const custRec = customers.find((c) => c.id === o.customerId);
        const taxMatch = custRec?.taxInfo && custRec.taxInfo.taxCode === taxNorm(o.taxCode) && textSame(custRec.taxInfo.name, o.customer);
        const infoValue = (id: string): ReactNode => {
          if (id === 'customer') return sheetKeys.has('taxCode')
            ? <span className="truncate font-medium text-[rgb(var(--secondary-fg))]">{o.customer}</span>
            : <><Building2 className={iconCls} aria-hidden /><span className="truncate">{o.customer}</span><span className="truncate text-[12.5px] text-[rgb(var(--muted))]">{[o.taxCode && `MST ${o.taxCode}`, o.phone].filter(Boolean).join(' · ')}</span></>;
          if (id === 'taxCode') return o.taxCode ? <><span className="font-mono text-[12.5px]">{o.taxCode}</span>{taxMatch && <span className="inline-flex items-center gap-1 rounded-md bg-[rgb(var(--success)/0.12)] px-1.5 py-0.5 text-[11px] font-medium text-[rgb(var(--success-fg))]" title={`Tra lúc ${new Date(custRec!.taxInfo!.at).toLocaleString('vi-VN')}`}><BadgeCheck className="h-3 w-3" aria-hidden />Khớp dữ liệu thuế</span>}</> : '—';
          if (id === 'address') return <span className="truncate" title={custRec?.address || o.address}>{custRec?.address || o.address || '—'}</span>;
          // v61: liên hệ ghi trên đơn trước, trống thì theo hồ sơ khách; điện thoại người nhận riêng (đơn cũ chưa tách thì dùng điện thoại trên đơn)
          if (id === 'phone') return <span className="tabular-nums">{o.phone || custPhone(custRec) || '—'}</span>;
          if (id === 'email') return <span className="truncate">{o.email || custEmail(custRec) || '—'}</span>;
          if (id === 'contact') return <span className="truncate">{o.contact || custRec?.contactName || '—'}</span>;
          if (id === 'receiver') return o.receiver || '—';
          if (id === 'recvPhone') return <span className="tabular-nums">{o.recvPhone ?? o.phone ?? '—'}</span>;
          // v61: nhận tại kho → ghi rõ kho và địa chỉ kho (không lặp lại chữ "Nhận tại kho" của ô Giao nhận)
          if (id === 'shipAddr') { const a = shipAddrOf(o); return <span className="truncate" title={a}>{a}</span>; }
          if (id === 'delivery') return SALE_DELIVERY[o.delivery];
          if (id === 'date') return <span className="tabular-nums">{fmtDate(o.date)}{o.createdAt ? ` ${new Date(o.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>;
          if (id === 'dept') { const dc = o.dept ?? users.find((x) => x.id === o.by)?.dept; return departments.find((d) => d.code === dc)?.name ?? dc ?? '—'; }
          if (id === 'pay') return `${SALE_PAY[o.pay]}${o.creditDays ? ` ${o.creditDays} ngày` : ''}`;
          if (id === 'code') return <Code>{o.code}</Code>;
          if (id === 'origin') return q ? <button className="hover:underline" onClick={() => openComposer({ quoteId: q.id, view: true, mode: 'QUOTE' })}>Từ báo giá <Code>{q.code}</Code></button> : o.origin ?? 'Tại quầy';
          if (id === 'by') return <><Users className={iconCls} aria-hidden />{nm(o.by) || '—'}</>;
          if (id === 'wh') return <><Warehouse className={iconCls} aria-hidden />{warehouses.find((w) => w.id === o.whId)?.name ?? '—'}</>;
          if (id === 'docRef') return <><FileText className={iconCls} aria-hidden />{o.docRef || '—'}</>;
          if (id === 'invNo') return invDone.length ? <>{invDone.map((r) => <Code key={r.id}>{r.no}</Code>)}{due - invDone.reduce((s, r) => s + r.amount, 0) > 0 && <span className="text-[12.5px] text-[rgb(var(--muted))]">còn {compact(due - invDone.reduce((s, r) => s + r.amount, 0))}</span>}</> : o.invoice ? '—' : <span className="text-[rgb(var(--muted))]">Không lấy</span>;
          return '—';
        };
        const infoCard = info ? (
          <SoCard title="Cập nhật thông tin đơn hàng" action={<><button className={btnGhost} onClick={() => setInfo(null)}>Thôi</button><button className={btnPrimary} onClick={saveInfo}><CheckIcon className="h-4 w-4" aria-hidden />Lưu</button></>}>
            <div className={soGrid}>
              <Field label="Nguồn đơn hàng"><input className={inputCls} value={info.origin} onChange={(e) => setInfo({ ...info, origin: e.target.value })} /></Field>
              <Field label="Nguồn chứng từ"><input className={inputCls} value={info.docRef} onChange={(e) => setInfo({ ...info, docRef: e.target.value })} placeholder="PO, hợp đồng" /></Field>
              <Field label="Người thực hiện"><select className={inputCls} value={info.by} onChange={(e) => setInfo({ ...info, by: e.target.value })}>{users.filter((u) => u.active || u.id === info.by).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
              <Field label="Hóa đơn thuế"><label className="flex h-[38px] items-center gap-2 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={info.invoice} onChange={(e) => setInfo({ ...info, invoice: e.target.checked })} />Khách lấy hóa đơn</label></Field>
              <Field label="Người liên hệ"><input className={inputCls} value={info.contact} onChange={(e) => setInfo({ ...info, contact: e.target.value })} /></Field>
              <Field label="Điện thoại khách"><input type="tel" className={inputCls} value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></Field>
              <Field label="Email nhận hóa đơn"><input type="email" className={inputCls} value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></Field>
              <Field label="Người nhận"><input className={inputCls} value={info.receiver} onChange={(e) => setInfo({ ...info, receiver: e.target.value })} /></Field>
              <Field label="Điện thoại người nhận"><input type="tel" className={inputCls} value={info.recvPhone} onChange={(e) => setInfo({ ...info, recvPhone: e.target.value })} /></Field>
              <Field label="Ngày giao"><input type="date" className={inputCls} value={info.deliverAt} onChange={(e) => setInfo({ ...info, deliverAt: e.target.value })} /></Field>
              <Field label="Địa chỉ giao"><input className={inputCls} value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></Field>
              <Field label="Ghi chú" className="sm:col-span-2 xl:col-span-4"><input className={inputCls} value={info.note} onChange={(e) => setInfo({ ...info, note: e.target.value })} /></Field>
            </div>
            {fl.sections.length > 0 && (
              <div className="mt-4 border-t border-[rgb(var(--line))] pt-3">
                <p className="mb-2 text-[13.5px] font-medium">{fl.title || 'Thông tin thêm'}</p>
                <DynamicFieldRenderer mode="edit" sections={fl.sections} avail={lSaleAvail('form', cfd.head)} required={fl.defs} vals={info.cf} onChange={(k, v) => setInfo((p) => (p ? { ...p, cf: cfSet(p.cf, k, v) } : p))} users={users} nameOf={nm} recordId={o.id} />
              </div>
            )}
            {cfLineForm.length > 0 && (
              <div className="mt-4 border-t border-[rgb(var(--line))] pt-3">
                <p className="mb-2 text-[13.5px] font-medium">Thông tin thêm trên dòng hàng</p>
                <div className="overflow-x-auto"><table className="w-full text-[13px]"><thead><tr><th className={soTh}>Hàng hóa</th>{cfLineForm.map((d) => <th key={d.id} className={soTh}>{d.label}</th>)}</tr></thead>
                  <tbody>{o.lines.map((l) => <tr key={l.id} className="border-b border-[rgb(var(--ink)/0.06)]"><td className={cn(soTd, 'max-w-[240px] truncate')} title={l.name}>{l.name}</td>{cfLineForm.map((d) => <td key={d.id} className="min-w-[170px] px-2 py-1.5"><CfInput d={d} v={info.lcf[l.id]?.[d.key]} set={(v) => setInfo({ ...info, lcf: { ...info.lcf, [l.id]: cfSet(info.lcf[l.id], d.key, v) } })} users={users} /></td>)}</tr>)}</tbody></table></div>
              </div>
            )}
          </SoCard>
        ) : (
          <section className="min-w-0" data-so-sheet>
            <h2 className="text-center text-[21px] font-bold uppercase tracking-[0.02em]" style={{ ...HB, fontFamily: "'Archivo','Be Vietnam Pro',system-ui,sans-serif" }}>{docT} · {o.code}</h2>
            {(needAp.length > 0 || R.canInfo(o) || (infoCfg?.title && infoCfg.title !== 'Thông tin đơn hàng')) && (
              <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                {infoCfg?.title && infoCfg.title !== 'Thông tin đơn hàng' && <p className="mr-auto text-[14px] font-bold">{infoCfg.title}</p>}
                {needAp.length > 0 && <Chip tone="orange">Thiếu {needAp.map((d) => d.label).join(', ')} để duyệt</Chip>}
                {R.canInfo(o) && <button className={cn(btnGhost, btnSm)} onClick={startInfo}><Pencil className="h-3.5 w-3.5" aria-hidden />Cập nhật thông tin</button>}
              </div>
            )}
            <div className="mt-3"><DynamicFieldRenderer mode="view" look="sheet" sections={infoSecs} avail={lSaleAvail('detail', cfd.head)} vals={o.cf} builtin={infoValue} nameOf={nm} /></div>
          </section>
        );
        // v60: cột Đã xuất / Trả lại / Còn lại chỉ hiện khi đơn đã có phiếu kho (đơn chờ duyệt, đã duyệt chưa xuất gọn bảng, không cuộn ngang)
        const shipCols = issuedAny || vs.some((v) => v.status !== 'CANCELLED') || o.status === 'CANCELLED';
        type LCol = { h: ReactNode; right?: boolean; td: (l: SaleLine, i: number) => ReactNode; tot?: ReactNode; cls?: string };
        const LCOL: Record<string, LCol> = {
          stt: { h: '#', td: (_l, i) => <span className="text-[rgb(var(--muted))]">{i + 1}</span>, cls: 'w-10' },
          ref: { h: 'Mã hàng', td: (l) => (l.ref ? <Code>{l.ref}</Code> : '—') },
          // tên hàng nhận phần rộng còn lại của bảng và tự cắt "…" (bảng luôn vừa khung, không cuộn ngang ở 1440px)
          name: { h: 'Tên hàng', td: (l) => <span className="block truncate font-medium" title={l.name}>{l.name}</span>, tot: <span className="text-[rgb(var(--muted))]">Cộng {o.lines.length} mặt hàng</span>, cls: 'w-full max-w-0 min-w-[140px]' },
          unit: { h: 'ĐVT', td: (l) => <span className="text-[rgb(var(--muted))]">{l.unit}</span> },
          qty: { h: 'SL', right: true, td: (l) => fmtN(l.qty), tot: fmtN(o.lines.reduce((s, l) => s + l.qty, 0)) },
          price: { h: 'Đơn giá', right: true, td: (l) => fmtN(l.price) },
          ckPct: { h: 'CK%', right: true, td: (l) => l.discountPct || 0 },
          ckAmt: { h: 'CK (đ)', right: true, td: (l) => fmtN(ckd(l)), tot: fmtN(t.discount) },
          vat: { h: 'VAT%', right: true, td: (l) => l.vat, tot: fmtN(t.vat) },
          net: { h: 'Thành tiền', right: true, td: (l) => <span className="font-medium">{fmtN(saleLineNet(l))}</span>, tot: <span className="font-medium">{fmtN(t.net)}</span> },
          iss: { h: 'Đã xuất', right: true, td: (l) => (l.kind === 'FREE' ? '—' : fmtN(saleIssQ(o, l))), tot: fmtN(iss), cls: 'border-l border-[rgb(var(--line))]' },
          ret: { h: 'Trả lại', right: true, td: (l) => { const r = saleRetQ(o, l); return r ? fmtN(r) : '—'; }, tot: fmtN(rq) },
          rest: { h: 'Còn lại', right: true, td: (l) => { const rest = l.kind === 'FREE' ? 0 : Math.max(0, l.qty - saleIssQ(o, l)); return <span className={cn(rest > 0 && o.status !== 'CANCELLED' && 'font-medium text-[rgb(var(--accent-fg))]')}>{rest || '—'}</span>; }, tot: <span className="font-medium text-[rgb(var(--accent-fg))]">{fmtN(Math.max(0, ord - iss))}</span> },
        };
        cfLineCols.forEach((d) => { LCOL[`cf:${d.key}`] = { h: d.label, right: d.type === 'money' || d.type === 'number', td: (l) => { const tx = cfText(d, l.cf?.[d.key], nm); return tx ? <span className="block max-w-[200px] truncate" title={tx}>{tx}</span> : '—'; } }; });
        // v60 khi có cột giao hàng: bỏ cột CK (đ) (đã có CK% và dòng tổng chiết khấu), cột Trả lại chỉ hiện khi có hàng trả
        const ids = lineIds.filter((id) => LCOL[id] && (shipCols ? !(id === 'ckAmt' || (id === 'ret' && !rq)) : !['iss', 'ret', 'rest'].includes(id)));
        const edge = (i: number) => cn(i === 0 && 'pl-3', i === ids.length - 1 && 'pr-3');
        const cards = phone && lineCfg?.smView !== 'table';
        const goodsView = cards ? (
          <ul className="px-4">
            {o.lines.map((l, i) => (
              <li key={l.id} className="flex gap-3 border-b border-[rgb(var(--ink)/0.06)] py-2.5 text-[13.5px]">
                {ids.includes('stt') && <span className="w-5 shrink-0 tabular-nums text-[rgb(var(--muted))]">{i + 1}</span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="truncate text-[12px] text-[rgb(var(--muted))]">{l.ref && <><Code>{l.ref}</Code> </>}{fmtN(l.qty)} {l.unit} × {fmtN(l.price)}{l.discountPct ? ` · CK ${l.discountPct}%` : ''}{cfLineCols.map((d) => { const v = cfText(d, l.cf?.[d.key], nm); return v ? ` · ${d.label} ${v}` : ''; }).join('')}</p>
                  {stage !== 'APPROVAL' && l.kind !== 'FREE' && <p className="text-[12px] text-[rgb(var(--muted))]">Đã xuất {fmtN(saleIssQ(o, l))} / {fmtN(l.qty)}</p>}
                </div>
                <span className="shrink-0 font-medium tabular-nums">{fmtN(saleLineNet(l))}</span>
              </li>
            ))}
            <li className="flex justify-between py-2.5 text-[13px]"><span className="text-[rgb(var(--muted))]">Cộng {o.lines.length} mặt hàng</span><span className="font-medium tabular-nums">{fmtN(t.net)}</span></li>
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className={cn('w-full text-[13.5px]', ids.length > 12 && 'min-w-[1000px]')}>
              <thead><tr className="border-b border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.035)] [&>th]:font-semibold [&>th]:text-[rgb(var(--fg))]">{ids.map((id, i) => <th key={id} className={cn(soTh, LCOL[id].right && 'text-right', LCOL[id].cls, edge(i))}>{LCOL[id].h}</th>)}</tr></thead>
              <tbody>
                {o.lines.map((l, i) => <tr key={l.id} className="border-b border-[rgb(var(--ink)/0.06)]">{ids.map((id, j) => <td key={id} className={cn(soTd, LCOL[id].right && 'text-right tabular-nums', LCOL[id].cls, edge(j))}>{LCOL[id].td(l, i)}</td>)}</tr>)}
                {shipCols && <tr className="bg-[rgb(var(--ink)/0.03)]">{ids.map((id, j) => <td key={id} className={cn(soTd, LCOL[id].right && 'text-right tabular-nums', LCOL[id].cls, edge(j))}>{LCOL[id].tot ?? null}</td>)}</tr>}
              </tbody>
            </table>
          </div>
        );
        const hasFiles = blocks.some((b) => b.type === 'K-Order-Files');
        const filesCard = (
          <SoCard title={blkOf('K-Order-Files')?.config.title && blkOf('K-Order-Files')?.config.title !== 'Tệp đính kèm' ? blkOf('K-Order-Files')?.config.title : 'Tài liệu liên quan'} action={canUp ? <button className={cn(btnGhost, btnSm)} disabled={upBusy} onClick={() => upRef.current?.click()}><Upload className="h-3.5 w-3.5" aria-hidden />{upBusy ? 'Đang tải' : 'Tải lên'}</button> : undefined}>
            {(o.files ?? []).length ? (
              <ul className="space-y-2" data-so-files>{(o.files ?? []).map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 text-[13px]">
                  <button type="button" onClick={() => openFile(f, 'view')} className="grid h-11 w-9 shrink-0 place-items-center rounded-md border border-[rgb(var(--line))] text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--ink)/0.04)]" aria-label={`Mở ${f.name}`}><FileText className="h-[18px] w-[18px]" aria-hidden /></button>
                  <div className="min-w-0 flex-1"><button type="button" onClick={() => openFile(f, 'view')} className="block max-w-full truncate text-left font-semibold hover:underline" title={`Mở ${f.name}`}>{f.name}</button><span className="text-[12px] tabular-nums text-[rgb(var(--muted))]">{Math.max(1, Math.round(f.size / 1024))} KB{f.by ? ` · ${nm(f.by)}` : ''}</span></div>
                  <button type="button" className="text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => openFile(f, 'download')} aria-label={`Tải ${f.name}`}><Download className="h-3.5 w-3.5" aria-hidden /></button>{canUp && <button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => delFile(f)} aria-label={`Bỏ ${f.name}`}><X className="h-3.5 w-3.5" aria-hidden /></button>}
                </li>
              ))}</ul>
            ) : null}
          </SoCard>
        );
        // v60: dòng tổng dưới bảng hàng hóa (nhãn đậm, như phiếu đơn hàng)
        const totRow = (k: ReactNode, v: ReactNode, key: string) => <div key={key} className="flex items-baseline justify-between gap-3 border-t border-[rgb(var(--ink)/0.06)] px-3 py-2 text-[13.5px]"><b className="font-semibold">{k}</b><span className="tabular-nums">{v}</span></div>;
        const linesNode = (
          <>
            <section className="min-w-0" data-so-lines>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h3 className="text-[14.5px] font-bold">Hàng hóa <span className="text-[12.5px] font-normal tabular-nums text-[rgb(var(--muted))]">{o.lines.length}</span></h3>
                <span className="ml-auto text-[12.5px] tabular-nums text-[rgb(var(--muted))] max-sm:hidden">{fmtN(ord)} đặt{shipCols ? ` · ${fmtN(iss)} đã xuất${rq ? ` · ${fmtN(rq)} trả lại` : ''} · ${fmtN(Math.max(0, ord - iss))} còn phải xuất` : ''}</span>
              </div>
              <div className="overflow-hidden rounded-lg border border-[rgb(var(--line))]">
                {goodsView}
                <div data-so-totals>
                  {totRow('Tổng tiền hàng', <b className="font-semibold">{fmtN(t.gross)}</b>, 'g')}
                  {totRow('Chiết khấu theo dòng', t.discount ? `−${fmtN(t.discount)}` : <span className="text-[rgb(var(--muted))]">0</span>, 'd')}
                  {totRow('Phí vận chuyển', t.ship ? fmtN(t.ship) : <span className="text-[rgb(var(--muted))]">0</span>, 's')}
                  {t.groups.filter((g) => g.rate > 0).map((g) => totRow(`Thuế VAT ${g.rate}%`, fmtN(g.vat), `v${g.rate}`))}
                  {ret > 0 && totRow('Hàng trả lại', `−${fmtN(ret)}`, 'r')}
                  <div className="flex items-baseline justify-between gap-3 border-t border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.025)] px-3 py-2.5"><b className="text-[14.5px] font-bold">{ret > 0 ? 'Thực tế phải thu' : 'Tổng cộng'}</b><b className="font-archivo text-[19px] font-bold tabular-nums text-[rgb(var(--accent-fg))]" data-so-grand>{fmtN(ret > 0 ? due : t.grand)}</b></div>
                </div>
              </div>
              {vs.some((v) => v.type === 'OUT' && v.status === 'PENDING') && <div className="flex flex-wrap gap-3 pt-3">{vs.filter((v) => v.type === 'OUT' && v.status === 'PENDING').map((v) => <Chip key={v.id} tone="orange">{v.code} chờ kho duyệt · {fmtN(v.lines.reduce((s, l) => s + l.qty, 0))}</Chip>)}</div>}
            </section>
            {o.status === 'PENDING' && remain > 0 && stage !== 'APPROVAL' && <SaleStockCard o={o} />}
            {!hasFiles && (o.files ?? []).length > 0 && filesCard}
          </>
        );
        // v58: bút toán đã ghi sổ của đơn (phiếu kho, hàng không qua kho, hóa đơn, phiếu thu gắn đơn) và bút toán đảo
        // phiếu thu lập trước bản này chưa gắn saleId: nhận theo khoản thu của đơn
        const myCe = new Set(o.payments.map((p) => saleCashOf(cashEntries, p.id)?.id).filter((x): x is string => !!x));
        const myJ = journalEntries.filter((e) => e.saleId === o.id || ((e.src === 'CE' || e.src === 'REV') && !!e.srcId && myCe.has(e.srcId))).sort((a, b) => a.date.localeCompare(b.date) || a.postedAt - b.postedAt);
        const docsTab = (
          <div data-docs-tab>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-medium">Chứng từ</p>
              <div className="ml-auto flex overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.12)] py-0 text-[12.5px] divide-x divide-[rgb(var(--ink)/0.08)]">
                {([['ALL', 'Tất cả'], ['WH', 'Kho'], ['CASH', 'Thu chi'], ['INV', 'Hóa đơn']] as const).map(([k, tx]) => <button key={k} className={cn('px-3 py-1.5', docF === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => setDocF(k)}>{tx} {k === 'ALL' ? docs.length : docs.filter((d) => d.g === k).length}</button>)}
              </div>
            </div>
            {docsV.length ? (
              <table className="w-full text-[13px]">
                <thead><tr className="border-b border-[rgb(var(--line))]"><th className={cn(soTh, 'pl-0')}>Mã chứng từ</th><th className={soTh}>Loại</th><th className={soTh}>Ngày</th><th className={cn(soTh, 'text-right')}>Giá trị</th><th className={soTh}>Người xử lý</th><th className={soTh}>Trạng thái</th></tr></thead>
                <tbody>{docsV.map((d) => (
                  <tr key={d.key} className="cursor-pointer border-b border-[rgb(var(--ink)/0.06)] hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => setView(d.key)}>
                    <td className={cn(soTd, 'pl-0')}><Code>{d.code}</Code></td><td className={soTd}>{d.type}</td><td className={cn(soTd, 'tabular-nums text-[rgb(var(--fg2))]')}>{fmtDate(d.date)}</td>
                    <td className={cn(soTd, 'text-right tabular-nums')}>{d.amt !== undefined ? fmtN(d.amt) : d.qty !== undefined ? `${fmtN(d.qty)} đv` : '—'}</td><td className={soTd}><span className="block max-w-[140px] truncate">{d.who ?? '—'}</span></td><td className={soTd}>{d.st}</td>
                  </tr>))}</tbody>
              </table>
            ) : <p className="py-3 text-[13px] text-[rgb(var(--muted))]">Chưa có chứng từ</p>}
            <p className="mb-2 mt-5 text-[13px] font-medium">Bút toán đã ghi sổ <span className="font-normal text-[rgb(var(--muted))]">{myJ.length}</span></p>
            {myJ.length ? (
              <table className="w-full text-[13px]" data-sale-journal>
                <thead><tr className="border-b border-[rgb(var(--line))]"><th className={cn(soTh, 'pl-0')}>Ngày</th><th className={soTh}>Chứng từ</th><th className={soTh}>Diễn giải</th><th className={soTh}>Nợ</th><th className={soTh}>Có</th><th className={cn(soTh, 'text-right')}>Số tiền</th></tr></thead>
                <tbody>{myJ.flatMap((e) => e.lines.map((l, i) => (
                  <tr key={`${e.id}-${i}`} className={cn(i === e.lines.length - 1 && 'border-b border-[rgb(var(--ink)/0.08)]', e.reversedBy && 'text-[rgb(var(--muted))]')}>
                    <td className={cn(soTd, 'pl-0 tabular-nums')}>{i === 0 ? fmtDate(e.date) : ''}</td><td className={soTd}>{i === 0 ? <span className="inline-flex items-center gap-1.5"><Code>{e.ref}</Code>{e.src === 'REV' ? <Chip tone="red">đảo</Chip> : e.reversedBy ? <Chip>đã đảo</Chip> : null}</span> : ''}</td>
                    <td className={soTd}><span className="block max-w-[220px] truncate" title={l.desc ?? e.desc}>{l.desc ?? e.desc}</span></td><td className={soTd}><Code>{l.dr}</Code></td><td className={soTd}><Code>{l.cr}</Code></td><td className={cn(soTd, 'text-right tabular-nums')}>{fmtN(l.amount)}</td>
                  </tr>)))}</tbody>
              </table>
            ) : <p className="text-[13px] text-[rgb(var(--muted))]">{mfgConfig.acct?.journalSince ? 'Chưa có bút toán: ghi khi kho duyệt phiếu xuất, kế toán xác nhận thu hoặc xuất hóa đơn' : 'Kế toán chưa bắt đầu ghi sổ (mục Kế toán)'}</p>}
          </div>
        );
        const logCard = (
          <SoCard title={<SoTabs tabs={[{ id: 'log', label: 'Trao đổi', count: notes.length }, { id: 'docs', label: 'Chứng từ & Bút toán', count: docs.length }]} value={tab} onChange={setTab} />} action={tab === 'log' ?
            <div className="flex overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.12)] text-[12.5px] divide-x divide-[rgb(var(--ink)/0.08)]">
              {([['ALL', 'Tất cả'], ['NOTE', 'Trao đổi'], ['SYS', 'Hệ thống']] as const).map(([k, tx]) => <button key={k} className={cn('px-3 py-1.5', logF === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => setLogF(k)}>{tx}</button>)}
            </div> : undefined}>
            {tab === 'docs' ? docsTab : <>
            {/* v60: khung soạn trao đổi + dòng sự kiện trên nền xám nhạt, mỗi sự kiện một thẻ (mới nhất ở trên) */}
            <div className="rounded-lg border border-[rgb(var(--line))]" data-so-compose>
              <textarea className="block min-h-[64px] w-full resize-y rounded-t-lg bg-transparent px-3 py-2.5 text-[13.5px] outline-none placeholder:text-[rgb(var(--faint))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent)/0.3)]" value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} placeholder="Viết trao đổi · Ctrl+Enter để gửi" aria-label="Viết trao đổi" />
              <div className="flex items-center gap-2 border-t border-[rgb(var(--line))] px-2.5 py-1.5">
                <span className="text-[12px] text-[rgb(var(--muted))]">{ini(me?.id)} · {me?.name}</span>
                <button className={cn(btnGhost, btnSm, 'ml-auto')} disabled={!msg.trim()} onClick={send} aria-label="Gửi"><Send className="h-3.5 w-3.5" aria-hidden />Gửi</button>
              </div>
            </div>
            <ul className="mt-3 space-y-2 rounded-lg bg-[rgb(var(--ink)/0.03)] p-2.5" data-so-feed>
              {feed.map((x, i) => x.note ? (
                <li key={x.note.id} className="flex gap-2.5 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 py-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[rgb(var(--ink)/0.06)] text-[11px] font-semibold">{ini(x.note.by)}</span><div className="min-w-0 text-[13.5px]"><p><span className="font-semibold text-[rgb(var(--secondary-fg))]">{nm(x.note.by) || '—'}</span> <span className="text-[12px] text-[rgb(var(--muted))]">· {soTime(x.note.at)}</span></p><p className="mt-0.5 whitespace-pre-wrap">{x.note.text}</p></div></li>
              ) : x.s ? (
                <li key={`s${i}`} className="flex items-center gap-2.5 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 py-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[rgb(var(--ink)/0.05)] text-[rgb(var(--muted))]"><x.s.icon className="h-3.5 w-3.5" aria-hidden /></span><p className="min-w-0 text-[13.5px] text-[rgb(var(--fg2))]">{x.s.text} <span className="text-[12px] text-[rgb(var(--muted))]">· {soTime(x.s.at)}</span></p></li>
              ) : null)}
              {!feed.length && <li className="py-3 text-center text-[13px] text-[rgb(var(--muted))]">Chưa có trao đổi</li>}
            </ul>
            </>}
          </SoCard>
        );
        const money = (k: string, v: ReactNode, key?: string, strong?: boolean) => <div key={key ?? k} className={cn('flex items-baseline justify-between gap-3 py-[3px] text-[13px]', strong && 'mt-1 border-t border-[rgb(var(--line))] pt-1.5')}><span className={strong ? 'font-bold text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg2))]'}>{k}</span><b className={cn('font-semibold tabular-nums text-[rgb(var(--accent-fg))]', strong && 'text-[14px]')}>{v}</b></div>;
        const payNode = (
          <>
            <SoCard title="Thanh toán" action={<span className="text-[12px] text-[rgb(var(--muted))]">{SALE_PAY[o.pay]}{o.creditDays ? ` ${o.creditDays} ngày` : ''}</span>}>
              {/* v60: số tiền tô màu nhấn như phiếu đơn hàng; nhãn thường, giá trị đậm */}
              <div data-so-money>
                {money('Tiền hàng sau CK', fmtN(t.net))}
                {t.groups.filter((g) => g.rate > 0).map((g) => money(`Thuế GTGT ${g.rate}%`, fmtN(g.vat), `v${g.rate}`))}
                {t.ship > 0 && money('Phí vận chuyển', fmtN(t.ship))}
                {money('Tổng phải thu', fmtN(t.grand))}
                {money('Hàng trả lại', ret > 0 ? `−${fmtN(ret)}` : '0')}
                {money('Đã thanh toán', fmtN(paid))}
                {pend > 0 && money('Chờ xác nhận', fmtN(pend))}
                {left < 0 ? money('Khách trả thừa', fmtN(-left), 'over', true) : money('Còn lại', fmtN(left), 'left', true)}
              </div>
              {due > 0 && <div className="mt-2"><SoBar parts={[{ pct: (paid / due) * 100, cls: 'bg-[rgb(var(--fg))]' }, { pct: (pend / due) * 100, cls: 'bg-[rgb(var(--accent)/0.55)]' }]} /></div>}
              {/* v61: bỏ tóm tắt hóa đơn ở khối Thanh toán (trạng thái hóa đơn xem ở bước "Hóa đơn thuế" của quy trình) */}
              <p className={cn(soSideH, 'mb-2 mt-5')}>Lịch sử thanh toán</p>
              <div className="overflow-hidden rounded-lg border border-[rgb(var(--line))] text-[12.5px]" data-so-payhist>
                <div className="grid grid-cols-[56px_1fr_auto] gap-2 bg-[rgb(var(--ink)/0.035)] px-2.5 py-1.5 font-semibold"><span>Ngày</span><span className="text-right">Số tiền</span><span>Trạng thái</span></div>
                {o.payments.length ? o.payments.map((p) => (
                  <div key={p.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-2 border-t border-[rgb(var(--ink)/0.06)] px-2.5 py-1.5" title={p.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}>
                    <span className="tabular-nums">{fmtDate(p.date ?? iso(new Date(p.at))).slice(0, 5)}</span>
                    <span className="text-right font-semibold tabular-nums">{fmtN(p.amount)}</span>
                    {p.confirmed ? <Chip tone="teal">Đã xác nhận</Chip> : canCash ? <button className={cn(btnGhost, btnSm)} onClick={() => confirmSalePayment(o.id, p.id)}>Xác nhận</button> : <Chip tone="orange">Chờ</Chip>}
                  </div>
                )) : <div className="flex flex-col items-center gap-1 border-t border-[rgb(var(--ink)/0.06)] px-2.5 py-4 text-[rgb(var(--muted))]"><Inbox className="h-5 w-5" aria-hidden />Chưa có phiếu thu</div>}
              </div>
            </SoCard>
          </>
        );
        // v58: người liên quan theo từng bước (lên đơn, duyệt, kho, kế toán thu / hóa đơn)
        const people: [string, string | undefined][] = [
          ['Người lên đơn', o.by], ['Người duyệt', o.approval?.decidedBy], ['Thủ kho', vs.find((v) => v.status === 'DONE')?.approvedBy],
          ['Kế toán xác nhận thu', o.payments.find((p) => p.confirmed)?.confirmedBy], ['Kế toán xuất hóa đơn', myInv.find((r) => r.status === 'ISSUED')?.decidedBy],
        ];
        // v60 cột phải theo mẫu phiếu: nút nhanh, quy trình dọc kèm người đã làm / người có quyền ở bước đang chờ, người liên quan dạng chip
        // v61: nút + thêm người theo dõi đơn (người được thêm thấy đơn trong danh sách của mình, nhận thông báo); bỏ được người đã thêm
        const watchers = o.watchers ?? [];
        const canWatch = cancel === null && (o.by === me?.id || canDo('sale.manage') || R.canInfo(o) || watchers.includes(me?.id ?? ''));
        const inOrder = new Set([...people.map(([, id]) => id).filter((x): x is string => !!x), ...watchers]);
        const wCands = users.filter((u) => u.active && u.id !== me?.id && !inOrder.has(u.id) && (!wq.trim() || fold(`${u.name} ${u.title ?? ''} ${u.email}`).includes(fold(wq.trim())))).slice(0, 8);
        const addWatcher = (u: User) => {
          setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, watchers: [...(x.watchers ?? []), u.id], notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: `Thêm ${u.name} vào người liên quan` }] } : x)));
          dispatch('APPROVAL_RESULT', { to: u, title: `${me?.name ?? 'Đồng nghiệp'} thêm bạn vào đơn ${o.code}`, body: `${o.customer} · ${fmtN(t.grand)} đ`, module: 'sales' });
          setWq(''); setWOpen(false);
        };
        const dropWatcher = (id: string) => setSalesOrders((all) => all.map((x) => (x.id === o.id ? { ...x, watchers: (x.watchers ?? []).filter((w) => w !== id), notes: [...(x.notes ?? []), { id: uid('sn'), by: me?.id, at: Date.now(), text: `Bỏ ${nm(id)} khỏi người liên quan` }] } : x)));
        const avCls = 'grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[rgb(var(--ink)/0.07)] text-[10px] font-semibold';
        const peopleNode = (
          <div className="relative mt-5 border-t border-[rgb(var(--line))] pt-4" data-people>
            <div className="mb-2 flex items-center gap-2">
              <p className={soSideH}>Người liên quan</p>
              {canWatch && <button type="button" className={cn(soIco, 'ml-auto h-7 w-7')} onClick={() => setWOpen((v) => !v)} aria-label="Thêm người liên quan" aria-expanded={wOpen} title="Thêm người liên quan"><Plus className="h-4 w-4" aria-hidden /></button>}
            </div>
            {/* v61: mỗi người một dòng: tên + vai trò trên đơn (người được thêm ghi "Theo dõi", bỏ được) */}
            <ul className="space-y-1">
              {people.filter(([, id]) => !!id).map(([k, id]) => (
                <li key={k} className="flex items-center gap-2 py-0.5 text-[13px]" title={`${nm(id)} · ${k}`}><span className={avCls}>{ini(id)}</span><span className="min-w-0 flex-1 truncate">{nm(id)}</span><span className="shrink-0 text-[12px] text-[rgb(var(--muted))]">{k}</span></li>
              ))}
              {watchers.map((id) => (
                <li key={`w-${id}`} className="flex items-center gap-2 py-0.5 text-[13px]" title={`${nm(id)} · được thêm theo dõi đơn`} data-watcher={id}><span className={avCls}>{ini(id)}</span><span className="min-w-0 flex-1 truncate">{nm(id)}</span><span className="shrink-0 text-[12px] text-[rgb(var(--muted))]">Theo dõi</span>
                  {canWatch ? <button type="button" className="rounded-full p-0.5 text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => dropWatcher(id)} aria-label={`Bỏ ${nm(id)} khỏi người liên quan`}><X className="h-3 w-3" aria-hidden /></button> : null}
                </li>
              ))}
            </ul>
            {wOpen && (
              <div className="absolute right-0 top-[calc(100%-4px)] z-30 w-[280px] max-w-[calc(100vw-32px)] rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 shadow-lg" role="group" aria-label="Thêm người liên quan" data-watch-pop>
                <p className="mb-2 text-[13.5px] font-semibold">Thêm người liên quan</p>
                <input className={inputCls} value={wq} onChange={(e) => setWq(e.target.value)} placeholder="Tìm nhân sự" aria-label="Tìm nhân sự" autoFocus onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setWOpen(false); } else if (e.key === 'Enter' && wCands[0]) { e.preventDefault(); addWatcher(wCands[0]); } }} />
                <ul className="mt-2 max-h-[240px] overflow-y-auto">
                  {wCands.map((u) => (
                    <li key={u.id}><button type="button" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-[rgb(var(--ink)/0.04)]" onClick={() => addWatcher(u)}><span className={avCls}>{ini(u.id)}</span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{u.name}</span><span className="block truncate text-[11.5px] text-[rgb(var(--muted))]">{u.title || ROLE_LABEL[u.role] || u.role}</span></span></button></li>
                  ))}
                  {!wCands.length && <li className="px-2 py-2 text-[12.5px] text-[rgb(var(--muted))]">Không thấy nhân sự phù hợp</li>}
                </ul>
              </div>
            )}
          </div>
        );
        const inits = (name: string) => name.split(' ').filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();
        const stack = (us: User[]) => (us.length ? <span className="flex items-center">{us.slice(0, 3).map((u, i) => <span key={u.id} className={cn('grid h-6 w-6 place-items-center rounded-full border-2 border-[rgb(var(--surface))] bg-[rgb(var(--ink)/0.08)] text-[10px] font-semibold', i > 0 && '-ml-1.5')} title={u.name}>{inits(u.name)}</span>)}{us.length > 3 && <span className="-ml-1.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-[rgb(var(--surface))] bg-[rgb(var(--ink)/0.05)] px-1 text-[10px]">+{us.length - 3}</span>}</span> : <span className="text-[rgb(var(--muted))]">—</span>);
        const who = (id?: string) => (id ? <span className="flex min-w-0 items-center gap-1.5"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[rgb(var(--ink)/0.07)] text-[10px] font-semibold">{ini(id)}</span><span className="truncate">{nm(id)}</span></span> : <span className="text-[rgb(var(--muted))]">—</span>);
        const since = (at: number) => { const m = Math.max(1, Math.round((Date.now() - at) / 60000)); return m < 60 ? `${m} phút` : m < 1440 ? `${Math.round(m / 60)} giờ` : `${Math.round(m / 1440)} ngày`; };
        const outDone = vs.find((v) => v.type === 'OUT' && v.status === 'DONE');
        const invBy = myInv.find((r) => r.status === 'ISSUED')?.decidedBy;
        const rowsOf = (label: string): [string, ReactNode][] => {
          const a = o.approval;
          if (label === 'Tạo đơn') return [['Ngày tạo', <span key="t" className="tabular-nums">{soTime(o.createdAt)}</span>], ['Người tạo', who(o.by)]];
          if (label === 'Duyệt đơn') {
            if (stage === 'APPROVAL' && a) return a.self ? [['Trạng thái', <span key="s" className="font-semibold text-[rgb(var(--accent-fg))]">Chờ người lên đơn bấm duyệt</span>], ['Quyền duyệt', who(o.by)]] : [['Trạng thái', <span key="s" className="font-semibold text-[rgb(var(--accent-fg))]">Chờ duyệt · {since(a.requestedAt)}</span>], ['Lý do', a.reasons.join('; ') || '—'], ['Quyền duyệt', stack(apprWho)]];
            if (a?.decidedAt) return [[a.status === 'REJECTED' ? 'Người từ chối' : 'Người duyệt', who(a.decidedBy)], ['Thời gian', <span key="t" className="tabular-nums">{soTime(a.decidedAt)}</span>], ...(a.note ? [['Ý kiến', a.note] as [string, ReactNode]] : [])];
            return [['Trạng thái', a?.self ? 'Người lên đơn tự duyệt' : 'Trong ngưỡng, không cần duyệt']];
          }
          if (label === 'Xuất kho') return [...(outDone ? [['Người xuất kho', who(outDone.approvedBy)] as [string, ReactNode]] : []), ...(!issuedAny && cancel === null && o.status === 'PENDING' ? [['Quyền xuất', stack(stockWho)] as [string, ReactNode]] : [])];
          // v61: yêu cầu chờ kế toán hiện ở bước này (thay tóm tắt hóa đơn đã bỏ ở khối Thanh toán)
          if (label === 'Hóa đơn thuế') return [...(invBy ? [['Người xuất', who(invBy)] as [string, ReactNode]] : []),
            ...(invPend.length ? [['Yêu cầu', <span key="r" className="flex flex-wrap items-center gap-1.5"><Chip tone="orange">{invPend.length} chờ kế toán</Chip>{canCash && <button className="text-[12.5px] font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => go('accounting')}>Mở Kế toán</button>}</span>] as [string, ReactNode]] : [])];
          if (label === 'Thanh toán') return [['Điều khoản', `${SALE_PAY[o.pay]}${o.creditDays ? ` ${o.creditDays} ngày` : ''}`]];
          return [];
        };
        const flowSteps = soSteps(o, stage, vs, users);
        const flowList = (
          <ol className="relative" data-so-flow>
            {flowSteps.map((s, i) => {
              const done = s.state === 'done', now = s.state === 'now', blk = s.state === 'blocked', side = s.state === 'side';
              const rows = rowsOf(s.label);
              return (
                <li key={`${i}-${s.label}`} className="relative pb-4 pl-9 last:pb-0" data-step-state={s.state}>
                  {i < flowSteps.length - 1 && <span className={cn('absolute bottom-1 left-[12px] top-7 w-0.5', done ? 'bg-[rgb(var(--fg))]' : 'bg-[rgb(var(--line))]')} aria-hidden />}
                  <span className={cn('absolute left-0 top-0 grid h-[26px] w-[26px] place-items-center rounded-full border-2 text-[11px] font-semibold', done ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : now ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] text-[rgb(var(--on-accent))] ring-4 ring-[rgb(var(--accent)/0.2)]' : blk ? 'border-[rgb(var(--danger))] bg-[rgb(var(--surface))] text-[rgb(var(--danger-fg))]' : 'border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-[rgb(var(--muted))]')} aria-hidden>{done ? <CheckIcon className="h-3.5 w-3.5" /> : blk ? <XCircle className="h-3.5 w-3.5" /> : i + 1}</span>
                  <p className={cn('flex min-h-[26px] flex-wrap items-center gap-1.5 text-[13.5px]', done || now || blk ? 'font-bold' : 'font-semibold text-[rgb(var(--muted))]')}>{s.label === 'Tạo đơn' ? 'Tạo đơn hàng' : s.label === 'Duyệt đơn' ? 'Duyệt đơn hàng' : s.label}{side && <span className="rounded-md bg-[rgb(var(--ink)/0.06)] px-1.5 py-0.5 text-[11px] font-medium text-[rgb(var(--fg2))]">song song</span>}{s.chip}<span className="sr-only">{done ? ' · xong' : now ? ' · đang làm' : blk ? ' · vướng' : side ? ' · song song' : ' · chưa tới'}</span></p>
                  {s.sub && !rows.some(([k]) => k === 'Lý do' || k === 'Ý kiến') && s.label !== 'Tạo đơn' && <p className="text-[12.5px] text-[rgb(var(--fg2))]">{s.sub}</p>}
                  {rows.length > 0 && <dl className="mt-1 grid grid-cols-[84px_1fr] items-center gap-x-2 gap-y-1.5 text-[12.5px]">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-[rgb(var(--muted))]">{k}</dt><dd className="min-w-0">{v}</dd></div>)}</dl>}
                </li>
              );
            })}
          </ol>
        );
        const quick = (
          <div className="mb-5 grid grid-cols-2 gap-2" data-so-quick>
            <button type="button" className="flex flex-col items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] px-2 py-2.5 text-center text-[12.5px] font-medium text-[rgb(var(--secondary-fg))] hover:bg-[rgb(var(--ink)/0.03)]" onClick={() => setIssueOpen(true)}><Truck className="h-[18px] w-[18px]" aria-hidden />Thông tin xuất hàng</button>
            <button type="button" className="flex flex-col items-center gap-1.5 rounded-lg border border-[rgb(var(--line))] px-2 py-2.5 text-center text-[12.5px] font-medium text-[rgb(var(--secondary-fg))] hover:bg-[rgb(var(--ink)/0.03)] disabled:cursor-not-allowed disabled:text-[rgb(var(--faint))] disabled:hover:bg-transparent" disabled={!(cancel === null && canInv && o.invoice)} title={!o.invoice ? 'Khách không lấy hóa đơn' : !canInv ? 'Đơn chưa duyệt hoặc đã yêu cầu đủ hóa đơn' : undefined} onClick={() => setInv(true)}><ReceiptIcon className="h-[18px] w-[18px]" aria-hidden />Yêu cầu hóa đơn</button>
          </div>
        );
        const flowNode = cancel === null ? <>{quick}<SoCard title="Quy trình xử lý đơn hàng">{flowList}{peopleNode}</SoCard></> : (() => { const st = [{ t: 'Nhập trả đủ hàng', ok: saleGoodsBack(o) }, { t: 'Hoàn tiền cho khách', ok: salePaid(o) === 0 && o.payments.every((p) => p.confirmed) }, { t: 'Hủy đơn, giữ chứng từ', ok: false }]; const cur = st.findIndex((x) => !x.ok); return (
          <SoCard title="Quy trình hủy">
            {st.map((x, i) => (
              <div key={x.t} className="flex items-center gap-2.5 py-1.5 text-[13.5px]">
                <span className={cn('h-[18px] w-[18px] rounded-full border-2', x.ok ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))]' : i === cur ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] ring-[3px] ring-[rgb(var(--accent)/0.2)]' : 'border-[rgb(var(--line))]')} aria-hidden />
                <span className={cn(!x.ok && i !== cur && 'text-[rgb(var(--muted))]')}>{x.t}</span>
              </div>
            ))}
          </SoCard>
        ); })();
        const profitNode = (canDo('sale.manage') || canCash || me?.role === 'BOD') && o.status !== 'CANCELLED' && cancel === null ? (() => { const rev = saleNetRevenue(o), cogs = saleCostEst(o, skus), gross = rev - cogs, dc = saleDirectCost(o, cashEntries); return (
          <SoCard title="Lãi trên đơn" action={<span className="text-[12.5px] text-[rgb(var(--muted))]">tạm tính</span>}>
            <SoKv label="Doanh thu thuần">{fmtN(rev)}</SoKv>
            <SoKv label="Giá vốn tạm tính">−{fmtN(cogs)}</SoKv>
            <SoKv label="Lãi gộp chuẩn" big>{fmtN(gross)}</SoKv>
            <SoKv label="Chi phí gắn vào đơn">−{fmtN(dc)}</SoKv>
            <SoKv label="Lãi ước tính" big tone={gross - dc < 0 ? 'warn' : undefined}>{fmtN(gross - dc)}</SoKv>
          </SoCard>
        ); })() : null;
        // v60: Điều khoản đơn hàng + Các thông tin bổ trợ (nhãn đậm "Nhãn: giá trị", mỗi dòng một thông tin)
        const kb = (k: string, v: ReactNode) => <p key={k} className="truncate py-0.5 text-[13.5px]"><b className="font-semibold">{k}:</b> {v}</p>;
        const shipTitle = blkOf('K-Order-Ship')?.config.title;
        const shipNode = (
          <SoCard title={shipTitle && shipTitle !== 'Giao hàng & ghi chú' ? shipTitle : 'Điều khoản đơn hàng'}>
            <div data-so-terms>
              {kb('Giao nhận', SALE_DELIVERY[o.delivery])}
              {o.delivery !== 'PICKUP' && kb('Thời gian giao hàng', o.deliverAt ? fmtDate(o.deliverAt) : '—')}
              {kb(o.delivery === 'PICKUP' ? 'Địa điểm nhận hàng' : 'Địa chỉ giao hàng', shipAddrOf(o))}
              {o.receiver && kb('Người nhận', o.receiver)}
              {(o.recvPhone ?? o.phone) && kb('Điện thoại người nhận', <span className="tabular-nums">{o.recvPhone ?? o.phone}</span>)}
              {o.note && kb('Ghi chú', o.note)}
            </div>
            <p className="mb-1 mt-4 text-[14px] font-bold">Các thông tin bổ trợ</p>
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2" data-so-extra>
              {kb('Nguồn đơn hàng', q ? `Từ báo giá ${q.code}` : o.origin ?? 'Tại quầy')}
              {kb('Nguồn chứng từ', o.docRef || '—')}
              {kb('Tổng số lượng sản phẩm', <span className="tabular-nums">{fmtN(o.lines.reduce((s, l) => s + l.qty, 0))}</span>)}
              {kb('Hóa đơn thuế', o.invoice ? (invDone.length ? `Đã xuất ${invDone.map((r) => r.no).join(', ')}` : 'Khách lấy hóa đơn') : 'Khách không lấy')}
              {kb('Hạn thanh toán', o.creditDays ? `${o.creditDays} ngày sau khi giao${o.issuedAt ? ` · ${fmtDate(saleDue(o))}` : ''}` : SALE_PAY[o.pay])}
              {kb('Mã số thuế khách', o.taxCode || '—')}
            </div>
          </SoCard>
        );
        // v60: khối cột phải (x ≥ 7, rộng ≤ 6) vẽ kiểu cột phải của phiếu; điện thoại / máy tính bảng dùng kiểu thường
        const zoneOf = (b: LBlock): 'main' | 'side' => (wide && b.pos.lg.x >= 6 && b.pos.lg.w <= 6 ? 'side' : 'main');
        const node = (b: LBlock): ReactNode => { const n = node0(b); return n === null || n === undefined ? n : <SoZoneC.Provider value={zoneOf(b)}>{n}</SoZoneC.Provider>; };
        const node0 = (b: LBlock): ReactNode => {
          if (!lIsCore(b.type) && !lCondOk(b.config, lstage, myRole)) return null;
          switch (b.type) {
            case 'K-RecordDetail': return cancel !== null ? <SaleCancelCard o={o} why={cancel} setWhy={setCancel} /> : infoCard;
            case 'K-Order-Lines': return linesNode;
            case 'K-Order-Flow': return flowNode;
            case 'K-Order-Pay': return payNode;
            case 'K-Order-Profit': return profitNode;
            case 'K-Order-Debt': return cancel === null ? <SoDebt customerId={o.customerId} exceptId={o.id} /> : null;
            case 'K-Order-Log': return logCard;
            case 'K-Order-Ship': return shipNode;
            case 'K-Order-Files': return filesCard;
            default: return lCommonNode(b, lay?.grid) ?? (cancel === null ? <VerticalBlock b={b} order={o} /> : null);
          }
        };
        const sctx: LPageCtx = {
          live: true, page: 'sale-detail', period: 'MONTH', setPeriod: () => {}, dept: 'ALL', setDept: () => {}, tab: '', setTab: () => {}, openTargets: () => {},
          vars: lVars('MONTH', org.shortName || org.name, me?.name ?? '', { 'mã đơn': o.code, 'khách hàng': o.customer, 'trạng thái đơn': SALE_STAGE[stage].label }),
          bind: lBindOrder(o, { status: SALE_STAGE[stage].label, paid, left, seller: nm(o.by), cf: Object.fromEntries(bindDefs.map((d) => [d.key, cfText(d, o.cf?.[d.key], nameOf)])) }),
          act: (x) => { if (['back', 'prev', 'next', 'print', 'download', 'upload'].includes(x.act)) onIcon(x.act as LIconAct); else lActCommonRun(x, (m) => go(m)); },
          can: (x) => x.act !== 'upload' || canUp,
          off: (x) => (x.act === 'prev' && !prevO) || (x.act === 'next' && !nextO) || (x.act === 'upload' && upBusy),
          menu: moreItems,
        };
        return <div className="px-5 pb-6 pt-5 max-sm:px-3"><LPageC.Provider value={sctx}><LBusinessView blocks={blocks} node={node} narrow={!wide} dev={dev} grid={lay?.grid} sticky split /></LPageC.Provider></div>;
      })()}
    </div>
  );
}

