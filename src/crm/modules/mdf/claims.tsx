'use client';

import { AlertTriangle, Camera, CheckCircle2, Clock, Download, FileCheck2, FileText, MapPin, Pencil, Plus, Receipt as ReceiptIcon, Scale, ShieldCheck, Trash2, Upload, XCircle } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/crud';
import { Drawer } from '../../components/drawer';
import { ChipFilter, claimDate, FilterBar, stMatch, useInRange } from '../../components/filters';
import { Chip, EmptyState, Field, FilePicker, Modal, MoneyInput, Panel, ProgressBar, StatCard, Table, Tabs, useSticky } from '../../components/ui';
import { auditClaim, claimState } from '../../lib/business';
import { blockersOf, btnBase, btnGhost, btnPrimary, btnSm, C, claimYear, compact, esc, fmtDate, FUND_LABEL, inputCls, kpiGrid, MST_RE, nextCode, POP_LABEL, POP_TYPES, progName, PROGRAM_BUDGET, PROGRAM_COLOR, PROGRAM_FUND, PROGRAM_STATUS, PROGRAM_TYPES, progYear, rowCls, tdCls, tdFirst, tdLast, todayISO, uid, useApp, usedByType, vnd } from '../../lib/core';
import { sha256 } from '../../lib/csv';
import type { Budget, Check, Claim, ConfirmState, FundCode, InvoiceDraft, PopType, Program, ProgramStatus, Proof, Verification } from '../../lib/types';
import { cn } from '../../lib/utils';
import { VendorApprovalModal } from './pre-approval';
import { MdfSettlementPanel } from './settlement';
import { ClaimFinancePanel } from './surplus';
import { BudgetStrip, ClaimTable } from '../messages/messenger';
import { useHubItem } from '../tasks/tasks';

/** v59: nhóm tình trạng hồ sơ claim cho bộ lọc 2 lớp */
type ClaimView = 'open' | 'blocked' | 'ready' | 'submitted';

// =====================================================================
//  PHÂN HỆ 3: HỒ SƠ CLAIM & POP
//  Tab: Chương trình & Pre-Approval | Hồ sơ claim | Đối soát & Credit Note
// =====================================================================

export function ClaimsModule() {
  const { role, canDo, openProgramForm } = useApp();
  const [tab, setTab] = useSticky<'programs' | 'claims' | 'accounting'>('ClaimsModule.tab', role === 'ACCOUNTANT' ? 'accounting' : 'claims');
  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { id: 'claims', label: 'Claim & POP' },
          { id: 'programs', label: 'Kế hoạch quỹ' },
          { id: 'accounting', label: 'Đối soát' },
        ]}
        value={tab}
        onChange={setTab}
        aside={tab === 'programs' && canDo('program.create') ? <button className={cn(btnPrimary, btnSm, 'max-lg:hidden')} onClick={() => openProgramForm()}><Plus className="h-3.5 w-3.5" aria-hidden />Đề xuất chương trình</button> : undefined}
 />
      {tab === 'programs' && <ProgramsTab />}
      {tab === 'claims' && <ClaimsTab />}
      {tab === 'accounting' && <AccountingTab />}
    </div>
  );
}

export function ProgramsTab() {
  const { budget, setBudget, policy, programs, setPrograms, claims, setClaims, customers, canDo, notify, dept, userName, openProgramForm, openClaim, go } = useApp();
  const hubOf = useHubItem();
  const [showAll, setShowAll] = useState(false);
  const [approving, setApproving] = useState<Program | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [fund, setFund] = useState<FundCode>('MDF');
  // Chỉ chương trình của năm tài chính đang xem (theo bộ lọc thời gian trên header)
  const yearPrograms = programs.filter((p) => progYear(p) === budget.fiscalYear);
  const list = showAll ? yearPrograms : yearPrograms.filter((p) => !['REJECTED', 'CANCELLED', 'CLOSED'].includes(p.status));

  /** Người đang đăng nhập có đủ hạn mức duyệt nội bộ không */
  const release = (p: Program, status: ProgramStatus, msg: string) => {
    setBudget((b) => ({ ...b, committed: Math.max(0, b.committed - p.held) }));
    setPrograms((ps) => ps.map((x) => (x.id === p.id ? { ...x, held: 0, status } : x)));
    notify(`${msg}. Đã nhả ${compact(p.held)} về quỹ khả dụng`, 'orange');
  };

  const createClaim = (p: Program) => {
    const code = nextCode(claims.map((c) => c.code), 'CLM-2026-', 4);
    const deadline = new Date(p.end).getTime() + policy.claimWindowDays * 864e5;
    const claim: Claim = {
      id: uid('c'), code, preApprovalId: p.preApprovalId ?? '', preApprovalApproved: !!p.preApprovalId, programId: p.id,
      programTitle: p.title, programType: p.type, customerId: p.customerId, dept: p.dept,
      period: `${fmtDate(p.start)} – ${fmtDate(p.end)}`, expectedAttendees: p.expectedLeads,
      claimed: p.held, cap: p.held, invoice: null,
      daysLeft: Math.max(0, Math.ceil((deadline - Date.now()) / 864e5)), submitted: false, proofs: [],
    };
    setClaims((c) => [claim, ...c]);
    setPrograms((ps) => ps.map((x) => (x.id === p.id ? { ...x, status: 'CLAIMING', claimId: claim.id } : x)));
    notify(`Đã tạo hồ sơ ${code} theo mã ${p.preApprovalId}. Tải chứng từ POP lên để nộp 3M.`, 'teal');
    openClaim(claim.id);
  };

  return (
    <div className="space-y-5">
      <BudgetStrip />

      <div className="flex flex-wrap items-center gap-2">
        {(['MDF', 'CS'] as FundCode[]).map((fd) => {
          const cats = PROGRAM_TYPES.filter((t) => PROGRAM_FUND[t] === fd);
          const cap = cats.reduce((a, t) => a + (PROGRAM_BUDGET[t] ?? 0), 0);
          const used = cats.reduce((a, t) => a + usedByType(t, claims, programs, budget.fiscalYear), 0);
          return (
            <button key={fd} onClick={() => setFund(fd)} className={cn('rounded border px-3 py-2 text-left text-sm transition-colors', fund === fd ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.1)]' : 'border-[rgb(var(--line))] hover:bg-[rgb(var(--raised))]')}>
              <span className="block font-medium">{FUND_LABEL[fd]}</span>
              <span className="block text-xs tabular-nums text-[rgb(var(--muted))]">{compact(used)} / {compact(cap)}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PROGRAM_TYPES.filter((t) => PROGRAM_FUND[t] === fund).map((t) => {
          const cap = PROGRAM_BUDGET[t] ?? 0;
          const used = usedByType(t, claims, programs, budget.fiscalYear);
          return (
            <div key={t} className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-4">
              <p className="flex items-center gap-2 text-sm text-[rgb(var(--muted))]"><i className="h-2 w-2 rounded-full" style={{ background: PROGRAM_COLOR[t] }} />{progName(t)}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-[rgb(var(--fg))]">{compact(used)} <span className="text-sm font-normal text-[rgb(var(--muted))]">/ {compact(cap)}</span></p>
              <div className="mt-2"><ProgressBar value={used} max={cap} /></div>
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">Còn {compact(Math.max(0, cap - used))}</p>
            </div>
          );
        })}
      </div>

      <Panel
        title="Đề xuất chương trình và Pre-Approval 3M"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]"><input type="checkbox" className="accent-[rgb(var(--accent))]" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Hiện cả chương trình đã đóng</label>
          </div>
        }
      >
        <Table head={['Chương trình', 'Hạng mục', 'Khách hàng / phòng', 'Chi phí / phần 3M', 'Thời gian', 'Đề xuất / duyệt', 'Trạng thái', 'Thao tác']} minW={1260}>
          {list.map((p) => {
            const cust = customers.find((c) => c.id === p.customerId);
            const ok = !!hubOf('PROGRAM', p.id);
            return (
              <tr key={p.id} className={rowCls}>
                <td className={tdFirst}>
                  <p className="font-medium text-[rgb(var(--fg))]">{p.title}</p>
                  <p className="text-xs text-[rgb(var(--muted))]">Đề xuất {p.code}</p>
                  <p className={cn('text-xs', p.preApprovalId ? 'font-mono text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}>{p.preApprovalId ? `Pre-Approval ${p.preApprovalId}` : 'Chưa có mã Pre-Approval (3M cấp khi duyệt)'}</p>
                </td>
                <td className={tdCls}><span className="flex items-center gap-2"><i className="h-2 w-2 shrink-0 rounded-full" style={{ background: PROGRAM_COLOR[p.type] }} />{progName(p.type)}</span><span className="text-xs text-[rgb(var(--muted))]">{FUND_LABEL[PROGRAM_FUND[p.type] ?? 'MDF']}</span></td>
                <td className={tdCls}><p>{cust?.name ?? 'Hoạt động chung'}</p><p className="text-xs text-[rgb(var(--muted))]">{dept(p.dept)?.short}</p></td>
                <td className={tdCls}>
                  <p className="tabular-nums text-[rgb(var(--fg))]">{compact(p.requested)}</p>
                  <p className="text-xs tabular-nums text-[rgb(var(--muted))]">3M {p.sharePct}%{p.held > 0 ? `, giữ chỗ ${compact(p.held)}` : ''}</p>
                </td>
                <td className={cn(tdCls, 'text-xs tabular-nums')}>{fmtDate(p.start)}<br />{fmtDate(p.end)}</td>
                <td className={cn(tdCls, 'text-xs')}><p>{userName(p.requestedBy)}</p><p className="text-[rgb(var(--muted))]">{p.approvedBy ? `Duyệt: ${userName(p.approvedBy)}` : 'Chưa duyệt'}</p></td>
                <td className={tdCls}><Chip tone={PROGRAM_STATUS[p.status].tone}>{PROGRAM_STATUS[p.status].label}</Chip></td>
                <td className={tdLast}>
                  <div className="flex flex-wrap gap-1.5">
                    {p.status === 'PENDING_INTERNAL' && (
                      <>
                        <button className={cn(btnGhost, btnSm)} disabled={!ok} title={ok ? undefined : 'Bạn không phải người duyệt bước hiện tại (không tự duyệt đề xuất của mình)'} onClick={() => hubOf('PROGRAM', p.id)?.approve?.()}>Duyệt nội bộ</button>
                        <button className={cn(btnGhost, btnSm)} disabled={!ok} title="Nhập lý do ở Công việc" onClick={() => { go('tasks'); notify('Nhập lý do từ chối ở Công việc › Chờ tôi duyệt', 'teal'); }}>Từ chối</button>
                      </>
                    )}
                    {p.status === 'PENDING_VENDOR' && (
                      <>
                        <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success-fg))] hover:bg-[rgb(var(--success)/0.25)]')} disabled={!canDo('program.vendorDecision')} onClick={() => setApproving(p)}>3M đã duyệt (nhập mã)</button>
                        <button className={cn(btnGhost, btnSm)} disabled={!canDo('program.vendorDecision')} onClick={() => release(p, 'REJECTED', `3M từ chối ${p.code}`)}>3M từ chối</button>
                      </>
                    )}
                    {p.status === 'APPROVED' && (
                      <>
                        <button className={cn(btnBase, btnSm, 'bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent-fg))] hover:bg-[rgb(var(--accent)/0.25)]')} disabled={!canDo('claim.uploadPop')} onClick={() => createClaim(p)}><FileCheck2 className="h-3.5 w-3.5" aria-hidden />Tạo hồ sơ claim</button>
                        <button className={cn(btnGhost, btnSm)} disabled={!canDo('program.create')} onClick={() => release(p, 'CANCELLED', `Đã hủy ${p.code}`)}>Hủy</button>
                      </>
                    )}
                    {(p.status === 'CLAIMING' || p.status === 'CLOSED') && p.claimId && <button className={cn(btnGhost, btnSm)} onClick={() => openClaim(p.claimId!)}>Mở hồ sơ claim</button>}
                    <button className={cn(btnGhost, 'p-1.5')} disabled={!canDo('program.create') || p.status !== 'PENDING_INTERNAL'} title={p.status !== 'PENDING_INTERNAL' ? 'Chỉ sửa được khi chưa duyệt nội bộ' : undefined} onClick={() => openProgramForm(undefined, p.id)} aria-label={`Sửa ${p.code}`}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className={cn(btnGhost, 'p-1.5 hover:text-[rgb(var(--danger-fg))]')} disabled={!canDo('program.create')} onClick={() => setConfirm({
                      title: 'Xóa đề xuất chương trình',
                      message: <>Xóa <b>{p.code}</b> {p.title}?{p.held > 0 ? ` Phần giữ chỗ ${compact(p.held)} sẽ nhả về quỹ.` : ''}</>,
                      blocked: ['APPROVED', 'CLAIMING', 'CLOSED'].includes(p.status) ? 'Đề xuất đã được 3M duyệt hoặc đã làm claim. Dùng nút Hủy để nhả ngân sách, không xóa để giữ lịch sử đối soát.' : undefined,
                      onConfirm: () => { if (p.held > 0) setBudget((b) => ({ ...b, committed: Math.max(0, b.committed - p.held) })); setPrograms((ps) => ps.filter((x) => x.id !== p.id)); notify(`Đã xóa đề xuất ${p.code}`, 'orange'); },
                    })} aria-label={`Xóa ${p.code}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
        {!list.length && <EmptyState text={<>Chưa có chương trình quỹ nào</>} hint={<>Đề xuất chương trình để giữ chỗ ngân sách MDF / CS trước khi xin Pre-Approval của Hãng.</>} art="box" action="Đề xuất chương trình" onAction={canDo('program.create') ? () => openProgramForm() : undefined} />}
      </Panel>
      {approving && <VendorApprovalModal program={approving} onClose={() => setApproving(null)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

export function ClaimsTab() {
  const { claims: allClaims, programs, policy, customers, budget } = useApp();
  const claims = allClaims.filter((c) => claimYear(c, programs) === budget.fiscalYear);
  const [filter, setFilter] = useState<string>('open');
  const [stM, setStM] = useState<ClaimView[]>([]);
  const inR = useInRange();
  const [q, setQ] = useSticky('ClaimsTab.q', '');
  const [dp, setDp] = useState('ALL');
  const isView = (c: (typeof claims)[number], f: string) => (f === 'open' && !c.submitted) || (f === 'ready' && !c.submitted && blockersOf(c, policy.rules) === 0) || (f === 'blocked' && !c.submitted && blockersOf(c, policy.rules) > 0) || (f === 'submitted' && c.submitted);
  const list = claims
    .filter((c) => {
      const t = q.trim().toLowerCase();
      const cust = customers.find((k) => k.id === c.customerId);
      const hit = !t || [c.code, c.programTitle, c.preApprovalId, cust?.name ?? '', cust?.taxCode ?? ''].some((v) => v.toLowerCase().includes(t));
      const st = stMatch(filter as ClaimView | 'ALL', stM, (f) => isView(c, f));
      return hit && st && (dp === 'ALL' || c.dept === dp) && inR(claimDate(c));
    })
    .sort((a, b) => Number(a.submitted) - Number(b.submitted) || a.daysLeft - b.daysLeft);
  const blocked = claims.filter((c) => !c.submitted && blockersOf(c, policy.rules) > 0).length;

  return (
    <div className="space-y-5">
      <div className={kpiGrid('lg:grid-cols-3')}>
        <StatCard label="Đang làm" value={String(claims.filter((c) => !c.submitted).length)} sub={`${blocked} hồ sơ còn thiếu điều kiện`} icon={FileCheck2} color={C.orange} />
        <StatCard label="Sẵn sàng nộp" value={String(claims.filter((c) => !c.submitted && blockersOf(c, policy.rules) === 0).length)} sub="Đạt toàn bộ checklist bắt buộc" icon={ShieldCheck} color={C.teal} />
        <StatCard label="Chờ hoàn quỹ" value={compact(claims.filter((c) => c.submitted && !c.creditNote).reduce((s, c) => s + c.claimed, 0))} sub="Đã nộp, chưa nhận Credit Note" icon={ReceiptIcon} />
      </div>
      <FilterBar
        q={q} onQ={setQ} placeholder="Tìm mã claim, Pre-Approval, tên khách, MST"
        dept={dp} onDept={setDp} status={filter} onStatus={setFilter} statusLabel="Tất cả hồ sơ"
        statusOptions={[{ value: 'open', label: 'Đang làm' }, { value: 'blocked', label: 'Thiếu điều kiện' }, { value: 'ready', label: 'Sẵn sàng nộp' }, { value: 'submitted', label: 'Đã nộp Hãng' }]}
        chips={<ChipFilter value={filter === 'ALL' ? 'ALL' : (filter as ClaimView)} onChange={(v) => setFilter(v)} multi={stM} onMulti={setStM} label="Tình trạng hồ sơ" total={claims.length} options={[
          { value: 'open', label: 'Đang làm', count: claims.filter((c) => !c.submitted).length, color: C.orange },
          { value: 'blocked', label: 'Thiếu điều kiện', count: blocked, color: C.red },
          { value: 'ready', label: 'Sẵn sàng nộp', count: claims.filter((c) => !c.submitted && blockersOf(c, policy.rules) === 0).length, color: C.teal },
          { value: 'submitted', label: 'Đã nộp Hãng', count: claims.filter((c) => c.submitted).length, color: C.teal },
        ]} />}
      />
      <Panel title={`Hồ sơ claim và chứng từ POP (${list.length})`}>
        <ClaimTable claims={list} />
      </Panel>
    </div>
  );
}

// ---- Ô ảnh hiện trường: ảnh thật (tải lên) hoặc ảnh mô phỏng ----
export function PhotoTile({ p, onVerify, onRemove, canVerify }: { p: Proof; onVerify: (id: string, v: Verification) => void; onRemove?: (id: string) => void; canVerify: boolean }) {
  const h = p.hue ?? 30;
  const bad = !p.watermark || !p.inWindow || !!p.duplicateOf;
  return (
    <figure className={cn('overflow-hidden rounded border', p.verification === 'REJECTED' ? 'border-[rgb(var(--danger)/0.4)] opacity-50' : bad ? 'border-[rgb(var(--accent)/0.5)]' : 'border-[rgb(var(--line))]')}>
      <div className="relative aspect-[4/3]" style={{ background: `linear-gradient(160deg, hsl(${h} 22% 26%), hsl(${h + 40} 28% 12%))` }}>
        {p.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.url} alt={p.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-x-[12%] bottom-[18%] h-[38%] rounded-sm opacity-40" style={{ background: `hsl(${h} 20% 55%)` }} />
            <div className="absolute bottom-[18%] left-[30%] h-[52%] w-[16%] rounded-sm opacity-30" style={{ background: `hsl(${h + 20} 18% 70%)` }} />
            <Camera className="absolute right-2 top-2 h-4 w-4 text-[rgb(var(--fg)/0.4)]" aria-hidden />
          </>
        )}
        {onRemove && (
          <button className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1 text-[rgb(var(--fg)/0.8)] hover:text-[rgb(var(--fg))]" onClick={() => onRemove(p.id)} aria-label={`Xóa ${p.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {p.watermark ? (
          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[11px] leading-tight text-[rgb(var(--fg)/0.85)]">
            <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" aria-hidden />{p.gps ?? 'Chưa đọc được GPS'}</span>
            <span>{p.capturedAt}</span>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 bg-[rgb(var(--danger)/0.8)] px-2 py-1 text-[11px] font-medium text-white">Không có watermark</div>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 bg-[rgb(var(--raised))] px-2 py-1.5">
        <span className="truncate text-[11px] text-[rgb(var(--muted))]">{p.duplicateOf ? `Trùng ${p.duplicateOf}` : p.name}</span>
        <VerifyControl p={p} onVerify={onVerify} short canVerify={canVerify} />
      </div>
    </figure>
  );
}

export function VerifyControl({ p, onVerify, short, canVerify }: { p: Proof; onVerify: (id: string, v: Verification) => void; short?: boolean; canVerify: boolean }) {
  if (p.verification === 'VERIFIED') return <CheckCircle2 className="h-4 w-4 shrink-0 text-[rgb(var(--success))]" aria-label="Đã xác minh" />;
  if (p.verification === 'REJECTED')
    return <button disabled={!canVerify} className="text-[11px] text-[rgb(var(--muted))] hover:underline disabled:opacity-40" onClick={() => onVerify(p.id, 'PENDING')}>Khôi phục</button>;
  if (!canVerify) return <span className="shrink-0 text-[11px] text-[rgb(var(--accent-fg))]">Chờ xác minh</span>;
  return (
    <span className="flex shrink-0 gap-1">
      <button className={cn(btnBase, 'rounded-md bg-[rgb(var(--success)/0.15)] px-1.5 py-0.5 text-[11px] text-[rgb(var(--success-fg))] hover:bg-[rgb(var(--success)/0.25)]')} onClick={() => onVerify(p.id, 'VERIFIED')}>{short ? 'Duyệt' : 'Xác minh'}</button>
      <button className={cn(btnBase, 'rounded-md bg-[rgb(var(--danger)/0.15)] px-1.5 py-0.5 text-[11px] text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--danger)/0.25)]')} onClick={() => onVerify(p.id, 'REJECTED')}>Loại</button>
    </span>
  );
}

/** Mở bản in Audit Pack — người dùng chọn "Lưu dưới dạng PDF" (production: render PDF phía server) */
export function openAuditPack(c: Claim, checks: Check[], budget: Budget, customerName: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  const rows = (arr: [string, string][]) => arr.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(c.code)} Audit Pack</title>
  <style>body{font-family:'Be Vietnam Pro',Arial,sans-serif;color:#111;margin:40px;font-size:13px}h1{font-size:20px;margin:0 0 4px}
  h2{font-size:15px;margin:28px 0 8px;border-bottom:2px solid #F28C33;padding-bottom:4px}table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;vertical-align:top}th{width:34%;color:#555;font-weight:500}
  .ok{color:#00875f}.no{color:#c62828}.muted{color:#666}img{max-width:220px;margin:4px;border:1px solid #ddd}</style></head><body>
  <h1>Bộ hồ sơ claim ${esc(c.code)}</h1><p class="muted">Quỹ MDF ${budget.fiscalYear} của ${esc(budget.vendor)}. Xuất lúc ${new Date().toLocaleString('vi-VN')}</p>
  <h2>Thông tin chương trình</h2><table>${rows([
    ['Mã Pre-Approval', c.preApprovalId], ['Chương trình', c.programTitle], ['Nhóm', progName(c.programType)],
    ['Đơn vị hưởng lợi', customerName], ['Thời gian', c.period], ['Số tiền claim', vnd(c.claimed)], ['Trần Hãng duyệt', vnd(c.cap)],
    ['Hóa đơn GTGT', c.invoice ? `${c.invoice.serial}-${c.invoice.number}, ngày ${fmtDate(c.invoice.date)}, MST NCC ${c.invoice.supplierTax}, ${vnd(c.invoice.amount)}` : 'Không có'],
  ])}</table>
  <h2>Kết quả checklist kiểm toán</h2><table>${checks.map((i) => `<tr><th>${esc(i.label)}</th><td class="${i.passed ? 'ok' : 'no'}">${i.passed ? 'Đạt' : 'Chưa đạt'}: ${esc(i.detail)}</td></tr>`).join('')}</table>
  <h2>Danh mục chứng từ</h2><table>${c.proofs.filter((p) => p.verification !== 'REJECTED').map((p) => `<tr><th>${esc(POP_LABEL[p.type])}</th><td>${esc(p.name)}${p.gps ? ` (GPS ${esc(p.gps)}, ${esc(p.capturedAt ?? '')})` : ''}${p.url && p.type === 'SITE_PHOTO' ? `<br><img src="${p.url}">` : ''}</td></tr>`).join('')}</table>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
  return true;
}

export function ClaimDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { claims, setClaims, customers, budget, policy, canDo, notify, dept, setPrograms } = useApp();
  const claim = claims.find((c) => c.id === id);
  const [confirmDel, setConfirmDel] = useState(false);
  const [wm, setWm] = useState(true);
  const [docType, setDocType] = useState<PopType>('VAT_INVOICE');
  const [attendees, setAttendees] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inv, setInv] = useState<InvoiceDraft>({
    serial: claim?.invoice?.serial ?? '', number: claim?.invoice?.number ?? '', date: claim?.invoice?.date ?? '',
    supplierTax: claim?.invoice?.supplierTax ?? '', amount: claim?.invoice?.amount ?? claim?.claimed ?? 0, claimed: claim?.claimed ?? 0,
  });
  if (!claim) return null;

  const rules = policy.rules;
  const checks = auditClaim(claim, rules);
  const blockers = checks.filter((i) => i.severity === 'BLOCKER' && !i.passed);
  const warnings = checks.filter((i) => i.severity === 'WARNING' && !i.passed);
  const photos = claim.proofs.filter((p) => p.type === 'SITE_PHOTO');
  const docs = claim.proofs.filter((p) => p.type !== 'SITE_PHOTO');
  const cust = customers.find((c) => c.id === claim.customerId);
  const st = claimState(claim, rules);
  const canUpload = canDo('claim.uploadPop') && !claim.submitted;
  const canVerify = canDo('claim.verify') && !claim.submitted;
  const canEditInfo = (canDo('claim.uploadPop') || canDo('claim.accounting')) && !claim.submitted;

  const update = (fn: (c: Claim) => Claim) => setClaims((p) => p.map((c) => (c.id === id ? fn(c) : c)));
  const verify = (pid: string, v: Verification) => update((c) => ({ ...c, proofs: c.proofs.map((p) => (p.id === pid ? { ...p, verification: v } : p)) }));
  const remove = (pid: string) =>
    update((c) => {
      const p = c.proofs.find((x) => x.id === pid);
      if (p?.url) URL.revokeObjectURL(p.url);
      return { ...c, proofs: c.proofs.filter((x) => x.id !== pid) };
    });

  /** Tải file từ máy: tính SHA-256, phát hiện trùng với claim khác, tạo bản xem trước */
  const addFiles = async (files: File[], type: PopType) => {
    setBusy(true);
    const existing = claims.flatMap((c) => c.proofs.map((p) => ({ checksum: p.checksum, claimId: c.id, claimCode: c.code })));
    const added: Proof[] = [];
    let skipped = 0;
    let tooBig = 0;
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) { tooBig++; continue; }
      const checksum = await sha256(f);
      const hit = existing.find((p) => p.checksum === checksum);
      if ((hit && hit.claimId === id) || added.some((p) => p.checksum === checksum)) { skipped++; continue; }
      const isPhoto = type === 'SITE_PHOTO';
      added.push({
        id: uid('p'), type, name: f.name, verification: 'PENDING', url: URL.createObjectURL(f), size: f.size, checksum, uploaded: true,
        watermark: isPhoto ? wm : undefined, inWindow: isPhoto ? true : undefined,
        capturedAt: isPhoto ? new Date(f.lastModified).toLocaleString('vi-VN') : undefined,
        attendeeCount: type === 'ATTENDEE_SIGN_SHEET' ? attendees : undefined,
        duplicateOf: hit ? hit.claimCode : undefined, hue: (added.length * 53) % 360,
      });
    }
    update((c) => ({ ...c, proofs: [...c.proofs, ...added] }));
    setBusy(false);
    const dup = added.filter((p) => p.duplicateOf).length;
    const parts = [`Đã tải ${added.length} file`];
    if (skipped) parts.push(`bỏ qua ${skipped} file đã có trong hồ sơ`);
    if (tooBig) parts.push(`${tooBig} file vượt 20 MB`);
    if (dup) parts.push(`${dup} file trùng hồ sơ khác`);
    notify(parts.join(', '), dup || tooBig ? 'orange' : 'teal');
  };

  const saveInfo = () => {
    if (!inv.number || !inv.serial || !inv.date || !MST_RE.test(inv.supplierTax)) {
      notify('Nhập đủ ký hiệu, số, ngày hóa đơn và MST nhà cung cấp hợp lệ', 'red');
      return;
    }
    update((c) => ({ ...c, claimed: inv.claimed, invoice: { serial: inv.serial, number: inv.number, date: inv.date, supplierTax: inv.supplierTax, amount: inv.amount } }));
    setEditing(false);
    notify('Đã cập nhật thông tin hóa đơn và số tiền claim', 'teal');
  };

  const exportPack = () => {
    if (!openAuditPack(claim, checks, budget, cust?.name ?? 'Hoạt động chung')) {
      notify('Trình duyệt đã chặn cửa sổ mới. Cho phép pop-up rồi bấm xuất lại.', 'red');
      return;
    }
    if (!claim.submitted) {
      update((c) => ({ ...c, submitted: true }));
      notify(`Đã xuất bộ hồ sơ ${claim.code} và chuyển trạng thái Đã nộp Hãng`, 'teal');
    }
  };

  const setI = <K extends keyof InvoiceDraft>(k: K, v: InvoiceDraft[K]) => setInv((p) => ({ ...p, [k]: v }));
  const docTypes = POP_TYPES.filter((t) => t !== 'SITE_PHOTO');

  return (
    <Drawer
      title={claim.programTitle}
      eyebrow={claim.code}
      badge={<Chip tone={st.tone}>{st.label}</Chip>}
      onClose={onClose}
      actions={<button className={cn(btnGhost, btnSm, 'hover:text-[rgb(var(--danger-fg))]')} disabled={!canDo('claim.submit')} onClick={() => setConfirmDel(true)}><Trash2 className="h-3.5 w-3.5" aria-hidden />Xóa hồ sơ</button>}
      footer={
        <>
          {blockers.length > 0 && !claim.submitted && <p className="mb-3 text-xs text-[rgb(var(--danger-fg))]">Còn {blockers.length} điều kiện bắt buộc chưa đạt. Xử lý xong mới xuất được bộ hồ sơ.</p>}
          <button className={cn(btnPrimary, 'w-full py-2.5')} disabled={(blockers.length > 0 && !claim.submitted) || !canDo('claim.submit')} title={canDo('claim.submit') ? undefined : 'Vai trò của bạn không nộp hồ sơ Hãng'} onClick={exportPack}>
            <Download className="h-4 w-4" aria-hidden />
            {claim.submitted ? 'Xuất lại Bộ Hồ Sơ Claim PDF' : 'Xuất Bộ Hồ Sơ Claim PDF (Export Audit Pack)'}
          </button>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {[
          ['Pre-Approval', claim.preApprovalId],
          ['Nhóm chương trình', progName(claim.programType)],
          ['Đơn vị hưởng lợi', cust?.name ?? 'Hoạt động chung'],
          ['Phòng phụ trách', dept(claim.dept)?.name ?? ''],
          ['Thời gian', claim.period],
          ['Hạn nộp claim', claim.submitted ? 'Đã nộp' : `Còn ${claim.daysLeft} ngày`],
        ].map(([k, v]) => (
          <div key={k}><dt className="text-xs text-[rgb(var(--muted))]">{k}</dt><dd className="mt-0.5 text-[rgb(var(--fg))]">{v}</dd></div>
        ))}
      </dl>

      {/* Số tiền & hóa đơn */}
      <section className="rounded-md border border-[rgb(var(--line))] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--fg))]"><ReceiptIcon className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Số tiền và hóa đơn GTGT</h3>
          {canEditInfo && !editing && <button className={cn(btnGhost, btnSm)} onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" aria-hidden />Cập nhật</button>}
        </div>
        {editing ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Ký hiệu hóa đơn"><input className={inputCls} value={inv.serial} onChange={(e) => setI('serial', e.target.value.toUpperCase())} placeholder="1C26TAA" /></Field>
            <Field label="Số hóa đơn"><input className={inputCls} value={inv.number} onChange={(e) => setI('number', e.target.value)} placeholder="0001234" /></Field>
            <Field label="Ngày hóa đơn"><input className={inputCls} type="date" value={inv.date} onChange={(e) => setI('date', e.target.value)} /></Field>
            <Field label="MST nhà cung cấp"><input className={inputCls} value={inv.supplierTax} onChange={(e) => setI('supplierTax', e.target.value)} /></Field>
            <Field label="Giá trị hóa đơn"><MoneyInput value={inv.amount} onChange={(n) => setI('amount', n)} /></Field>
            <Field label="Số tiền claim" hint={`Trần ${vnd(claim.cap)}`}><MoneyInput value={inv.claimed} onChange={(n) => setI('claimed', n)} /></Field>
            <div className="flex gap-2 sm:col-span-2"><button className={btnPrimary} onClick={saveInfo}>Lưu</button><button className={btnGhost} onClick={() => setEditing(false)}>Hủy</button></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-[rgb(var(--muted))]">Số tiền claim</p>
              <p className={cn('mt-1 text-xl font-semibold tabular-nums', claim.claimed > claim.cap ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--fg))]')}>{vnd(claim.claimed)}</p>
              <p className="text-xs text-[rgb(var(--muted))]">Trần Hãng duyệt {vnd(claim.cap)}</p>
            </div>
            <div>
              <p className="text-xs text-[rgb(var(--muted))]">Hóa đơn GTGT</p>
              {claim.invoice ? (
                <>
                  <p className="mt-1 font-medium tabular-nums text-[rgb(var(--fg))]">{claim.invoice.serial}-{claim.invoice.number}</p>
                  <p className="text-xs text-[rgb(var(--muted))]">Ngày {fmtDate(claim.invoice.date)}, MST NCC {claim.invoice.supplierTax}, {compact(claim.invoice.amount)}</p>
                </>
              ) : <p className="mt-1 text-sm text-[rgb(var(--danger-fg))]">Chưa nhập thông tin hóa đơn</p>}
            </div>
          </div>
        )}
      </section>

      <ClaimFinancePanel claim={claim} />
      <MdfSettlementPanel claim={claim} />

      {/* Ảnh hiện trường */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[rgb(var(--fg))]">Ảnh hiện trường ({photos.length})</h3>
          <label className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
            <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={wm} onChange={(e) => setWm(e.target.checked)} disabled={!canUpload} />
            Ảnh tải lên đã có watermark GPS và thời gian
          </label>
        </div>
        <FilePicker accept="image/*" multiple disabled={!canUpload || busy} onFiles={(f) => addFiles(f, 'SITE_PHOTO')} className="mb-3 flex items-center justify-center gap-2 rounded border border-dashed border-[rgb(var(--line))] px-4 py-4 text-sm text-[rgb(var(--muted))] hover:border-[rgb(var(--accent)/0.6)] hover:text-[rgb(var(--fg))]">
          <Camera className="h-4 w-4" aria-hidden />{busy ? 'Đang xử lý file…' : 'Chọn ảnh từ máy tính hoặc kéo thả vào đây'}
        </FilePicker>
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => <PhotoTile key={p.id} p={p} onVerify={verify} onRemove={p.uploaded && canUpload ? remove : undefined} canVerify={canVerify} />)}
          </div>
        ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có ảnh hiện trường.</p>}
      </section>

      {/* Chứng từ khác */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-[rgb(var(--fg))]">Chứng từ đính kèm</h3>
        {canUpload && (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <Field label="Loại chứng từ" className="min-w-[200px] flex-1">
              <select className={inputCls} value={docType} onChange={(e) => setDocType(e.target.value as PopType)}>
                {docTypes.map((t) => <option key={t} value={t}>{POP_LABEL[t]}</option>)}
              </select>
            </Field>
            {docType === 'ATTENDEE_SIGN_SHEET' && (
              <Field label="Số người ký tên" className="w-32"><input className={inputCls} type="number" min={0} value={attendees || ''} onChange={(e) => setAttendees(Number(e.target.value))} /></Field>
            )}
            <FilePicker accept=".pdf,image/*,.xls,.xlsx,.doc,.docx" multiple disabled={busy} onFiles={(f) => addFiles(f, docType)} className={cn(btnGhost, 'py-2')}>
              <Upload className="h-4 w-4" aria-hidden />Tải file
            </FilePicker>
          </div>
        )}
        <ul className="divide-y divide-[rgb(var(--line))] rounded border border-[rgb(var(--line))]">
          {docs.map((p) => (
            <li key={p.id} className={cn('flex items-center gap-3 px-3 py-2.5', p.verification === 'REJECTED' && 'opacity-50')}>
              <FileText className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[rgb(var(--fg))]">{POP_LABEL[p.type]}{p.duplicateOf && <span className="ml-2 text-xs text-[rgb(var(--danger-fg))]">Trùng {p.duplicateOf}</span>}</p>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-[rgb(var(--secondary-fg))] hover:underline">{p.name}{p.attendeeCount != null && `, ${p.attendeeCount} người ký`}</a>
                ) : (
                  <p className="truncate text-xs text-[rgb(var(--muted))]">{p.name}{p.attendeeCount != null && `, ${p.attendeeCount} người ký`}</p>
                )}
              </div>
              <VerifyControl p={p} onVerify={verify} canVerify={canVerify} />
              {p.uploaded && canUpload && <button className="text-[rgb(var(--muted))] hover:text-[rgb(var(--danger-fg))]" onClick={() => remove(p.id)} aria-label={`Xóa ${p.name}`}><Trash2 className="h-4 w-4" /></button>}
            </li>
          ))}
          {!docs.length && <li className="list-none"><EmptyState text={<>Chưa có chứng từ nào.</>} art="doc" compact /></li>}
        </ul>
      </section>

      {/* Checklist */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--fg))]"><ShieldCheck className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Checklist kiểm toán Hãng</h3>
          <span className="text-xs text-[rgb(var(--muted))]">{blockers.length} lỗi chặn, {warnings.length} cảnh báo</span>
        </div>
        <ul className="space-y-2">
          {checks.map((i) => {
            const Icon = i.passed ? CheckCircle2 : i.severity === 'BLOCKER' ? XCircle : AlertTriangle;
            const color = i.passed ? C.teal : i.severity === 'BLOCKER' ? C.red : C.orange;
            return (
              <li key={i.key} className="flex items-start gap-3 rounded bg-[rgb(var(--raised))] px-3 py-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} aria-hidden />
                <div className="min-w-0 flex-1"><p className="text-sm text-[rgb(var(--fg))]">{i.label}</p><p className="text-xs text-[rgb(var(--muted))]">{i.detail}</p></div>
                {!i.passed && <span className="shrink-0 text-[11px]" style={{ color }}>{i.severity === 'BLOCKER' ? 'Bắt buộc' : 'Nên bổ sung'}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {claim.submitted && (
        <section className="rounded-md bg-[rgb(var(--raised))] p-4 text-sm">
          <h3 className="mb-2 font-semibold text-[rgb(var(--fg))]">Tiến độ hoàn quỹ</h3>
          <ul className="space-y-1 text-[rgb(var(--muted))]">
            <li>Đối soát VAT: <span className="text-[rgb(var(--fg))]">{claim.vatCheck === 'MATCHED' ? 'Khớp' : claim.vatCheck === 'MISMATCH' ? `Lệch${claim.vatNote ? `, ${claim.vatNote}` : ''}` : 'Chờ kế toán'}</span></li>
            <li>Hãng duyệt: <span className="text-[rgb(var(--fg))]">{claim.vendorApproved != null ? vnd(claim.vendorApproved) : 'Chưa có kết quả'}</span></li>
            <li>Credit Note: <span className="text-[rgb(var(--fg))]">{claim.creditNote ? `${claim.creditNote.number}, ${vnd(claim.creditNote.amount)}` : 'Chưa nhận'}</span></li>
            <li>Cấn trừ công nợ Hãng: <span className="text-[rgb(var(--fg))]">{claim.offset ? 'Đã cấn trừ' : 'Chưa'}</span></li>
          </ul>
        </section>
      )}
      {confirmDel && (
        <ConfirmDialog
          title="Xóa hồ sơ claim"
          message={<>Xóa hồ sơ <b>{claim.code}</b> và toàn bộ chứng từ đã tải? Chương trình quay về trạng thái 3M đã duyệt để lập hồ sơ mới.</>}
          blocked={claim.submitted ? 'Hồ sơ đã nộp 3M, không thể xóa. Theo dõi tiếp ở tab Đối soát.' : undefined}
          onConfirm={() => {
            claim.proofs.forEach((p) => p.url && p.uploaded && URL.revokeObjectURL(p.url));
            setClaims((p) => p.filter((c) => c.id !== claim.id));
            if (claim.programId) setPrograms((ps) => ps.map((x) => (x.id === claim.programId ? { ...x, status: 'APPROVED', claimId: undefined } : x)));
            notify(`Đã xóa hồ sơ ${claim.code}`, 'orange');
            onClose();
          }}
          onClose={() => setConfirmDel(false)}
        />
      )}
    </Drawer>
  );
}

// ---- Tab kế toán: đối soát VAT, Hãng duyệt, Credit Note, cấn trừ ----
export function AccountingTab() {
  const { claims, setClaims, programs, setPrograms, setBudget, budget, customers, canDo, notify, openClaim, dispatch } = useApp();
  const [modal, setModal] = useState<{ kind: 'approve' | 'cn' | 'mismatch'; claim: Claim } | null>(null);
  const [amount, setAmount] = useState(0);
  const [cnNumber, setCnNumber] = useState('');
  const [note, setNote] = useState('');
  const canAcc = canDo('claim.accounting');
  const yearClaims = claims.filter((c) => claimYear(c, programs) === budget.fiscalYear);
  const list = yearClaims.filter((c) => c.submitted).sort((a, b) => Number(!!a.offset) - Number(!!b.offset) || b.code.localeCompare(a.code));
  const update = (id: string, p: Partial<Claim>) => setClaims((all) => all.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const open = (kind: 'approve' | 'cn' | 'mismatch', c: Claim) => {
    setModal({ kind, claim: c });
    setAmount(kind === 'cn' ? c.vendorApproved ?? c.claimed : c.claimed);
    setCnNumber(nextCode(claims.map((x) => x.creditNote?.number ?? ''), 'CN-3MVN-2026-', 4));
    setNote('');
  };

  /** Hãng duyệt: quyết toán giữ chỗ -> đã tiêu (chỉ với claim gắn chương trình đang giữ chỗ) */
  const approve = () => {
    if (!modal) return;
    const c = modal.claim;
    if (amount <= 0 || amount > c.claimed) { notify('Số Hãng duyệt phải lớn hơn 0 và không vượt số claim', 'red'); return; }
    const prog = programs.find((p) => p.id === c.programId);
    if (prog && prog.held > 0) {
      setBudget((b) => ({ ...b, spent: b.spent + amount, committed: Math.max(0, b.committed - prog.held) }));
      setPrograms((ps) => ps.map((p) => (p.id === prog.id ? { ...p, held: 0, status: 'CLOSED' } : p)));
    }
    update(c.id, { vendorApproved: amount });
    dispatch('CLAIM_UPDATE', { title: 'Hãng đã duyệt claim', body: `${c.code} ${c.programTitle}: Hãng chấp thuận ${vnd(amount)}`, module: 'claims' });
    notify(`Đã ghi nhận Hãng duyệt ${vnd(amount)} cho ${c.code}${prog && prog.held > amount ? `, nhả ${compact(prog.held - amount)} về quỹ` : ''}`, 'teal');
    setModal(null);
  };

  const receiveCn = () => {
    if (!modal) return;
    if (!cnNumber.trim() || amount <= 0) { notify('Nhập số Credit Note và số tiền', 'red'); return; }
    update(modal.claim.id, { creditNote: { number: cnNumber.trim(), date: todayISO(), amount } });
    notify(`Đã ghi nhận Credit Note ${cnNumber} cho ${modal.claim.code}`, 'teal');
    setModal(null);
  };

  const pendingVat = list.filter((c) => !c.vatCheck).length;
  const pendingVendor = list.filter((c) => c.vendorApproved == null);
  const pendingCn = list.filter((c) => c.vendorApproved != null && !c.creditNote);
  const offsetTotal = list.filter((c) => c.offset).reduce((s, c) => s + (c.creditNote?.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      {!canAcc && <p className="rounded border border-[rgb(var(--line))] bg-[rgb(var(--raised))] px-4 py-3 text-sm text-[rgb(var(--muted))]">Bạn đang xem ở chế độ chỉ đọc. Thao tác đối soát dành cho Kế toán và Ban Giám đốc.</p>}
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Chờ đối soát" value={String(pendingVat)} sub="Hồ sơ đã nộp Hãng" icon={Scale} color={pendingVat ? C.orange : C.teal} />
        <StatCard label="Chờ Hãng duyệt" value={compact(pendingVendor.reduce((s, c) => s + c.claimed, 0))} sub={`${pendingVendor.length} hồ sơ`} icon={Clock} />
        <StatCard label="Chờ Credit Note" value={compact(pendingCn.reduce((s, c) => s + (c.vendorApproved ?? 0), 0))} sub={`${pendingCn.length} hồ sơ Hãng đã duyệt`} icon={ReceiptIcon} color={C.sand} />
        <StatCard label="Đã cấn trừ" value={compact(offsetTotal)} sub="Tổng Credit Note đã cấn trừ" icon={CheckCircle2} color={C.teal} />
      </div>

      <Panel title="Đối soát hoàn quỹ với Hãng">
        <Table head={['Hồ sơ', 'Hóa đơn GTGT', 'Đối soát VAT', 'Hãng duyệt', 'Credit Note', 'Cấn trừ công nợ']} minW={1100}>
          {list.map((c) => {
            const diff = c.invoice ? c.invoice.amount - c.claimed : 0;
            const cust = customers.find((k) => k.id === c.customerId);
            return (
              <tr key={c.id} className={rowCls}>
                <td className={tdFirst}>
                  <button className="text-left font-medium text-[rgb(var(--fg))] hover:underline" onClick={() => openClaim(c.id)}>{c.code}</button>
                  <p className="max-w-[240px] truncate text-xs text-[rgb(var(--muted))]">{c.programTitle}</p>
                  <p className="text-xs text-[rgb(var(--muted))]">{cust?.name ?? 'Hoạt động chung'}, claim {compact(c.claimed)}</p>
                </td>
                <td className={cn(tdCls, 'text-xs')}>
                  {c.invoice ? (
                    <>
                      <p className="text-[rgb(var(--fg))]">{c.invoice.serial}-{c.invoice.number}</p>
                      <p className="text-[rgb(var(--muted))]">MST {c.invoice.supplierTax}, {compact(c.invoice.amount)}</p>
                      {diff !== 0 && <p className="text-[rgb(var(--accent-fg))]">Chênh {diff > 0 ? '+' : ''}{compact(diff)} so với claim</p>}
                    </>
                  ) : <span className="text-[rgb(var(--danger-fg))]">Thiếu hóa đơn</span>}
                </td>
                <td className={tdCls}>
                  {c.vatCheck ? (
                    <Chip tone={c.vatCheck === 'MATCHED' ? 'teal' : 'red'}>{c.vatCheck === 'MATCHED' ? 'Khớp' : 'Lệch'}</Chip>
                  ) : (
                    <div className="flex gap-1">
                      <button disabled={!canAcc} className={cn(btnBase, 'rounded-md bg-[rgb(var(--success)/0.15)] px-2 py-1 text-xs text-[rgb(var(--success-fg))]')} onClick={() => { update(c.id, { vatCheck: 'MATCHED' }); notify(`${c.code}: hóa đơn khớp`, 'teal'); }}>Khớp</button>
                      <button disabled={!canAcc} className={cn(btnBase, 'rounded-md bg-[rgb(var(--danger)/0.15)] px-2 py-1 text-xs text-[rgb(var(--danger-fg))]')} onClick={() => open('mismatch', c)}>Lệch</button>
                    </div>
                  )}
                  {c.vatNote && <p className="mt-1 max-w-[180px] text-xs text-[rgb(var(--muted))]">{c.vatNote}</p>}
                </td>
                <td className={tdCls}>
                  {c.vendorApproved != null ? (
                    <p className="tabular-nums text-[rgb(var(--fg))]">{vnd(c.vendorApproved)}</p>
                  ) : (
                    <button disabled={!canAcc} className={cn(btnGhost, btnSm)} onClick={() => open('approve', c)}>Ghi nhận Hãng duyệt</button>
                  )}
                </td>
                <td className={tdCls}>
                  {c.creditNote ? (
                    <><p className="text-[rgb(var(--fg))]">{c.creditNote.number}</p><p className="text-xs text-[rgb(var(--muted))]">{fmtDate(c.creditNote.date)}, {compact(c.creditNote.amount)}</p></>
                  ) : (
                    <button disabled={!canAcc || c.vendorApproved == null || c.vatCheck !== 'MATCHED'} title={c.vatCheck !== 'MATCHED' ? 'Cần đối soát VAT khớp trước' : c.vendorApproved == null ? 'Chờ Hãng duyệt' : undefined} className={cn(btnGhost, btnSm)} onClick={() => open('cn', c)}>Nhận Credit Note</button>
                  )}
                </td>
                <td className={tdLast}>
                  {c.offset ? (
                    <Chip tone="teal">Đã cấn trừ</Chip>
                  ) : (
                    <button disabled={!canAcc || !c.creditNote} className={cn(btnBase, btnSm, 'bg-[rgb(var(--accent)/0.15)] text-[rgb(var(--accent-fg))] hover:bg-[rgb(var(--accent)/0.25)]')} onClick={() => { update(c.id, { offset: true }); notify(`Đã cấn trừ ${compact(c.creditNote?.amount ?? 0)} vào công nợ phải trả Hãng`, 'teal'); }}>Cấn trừ công nợ</button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
        {!list.length && <EmptyState text={<>Chưa có hồ sơ nào nộp Hãng.</>} art="doc" />}
      </Panel>

      {modal?.kind === 'approve' && (
        <Modal title={`Hãng duyệt ${modal.claim.code}`} onClose={() => setModal(null)} footer={<><button className={btnGhost} onClick={() => setModal(null)}>Hủy</button><button className={btnPrimary} onClick={approve}>Ghi nhận</button></>}>
          <Field label="Số tiền Hãng chấp thuận" hint={`Số claim ${vnd(modal.claim.claimed)}. Nếu thấp hơn giữ chỗ, phần chênh lệch tự nhả về quỹ.`}><MoneyInput value={amount} onChange={setAmount} /></Field>
        </Modal>
      )}
      {modal?.kind === 'cn' && (
        <Modal title={`Nhận Credit Note cho ${modal.claim.code}`} onClose={() => setModal(null)} footer={<><button className={btnGhost} onClick={() => setModal(null)}>Hủy</button><button className={btnPrimary} onClick={receiveCn}>Ghi nhận</button></>}>
          <div className="space-y-4">
            <Field label="Số Credit Note"><input className={inputCls} value={cnNumber} onChange={(e) => setCnNumber(e.target.value)} /></Field>
            <Field label="Giá trị Credit Note"><MoneyInput value={amount} onChange={setAmount} /></Field>
          </div>
        </Modal>
      )}
      {modal?.kind === 'mismatch' && (
        <Modal title={`Ghi nhận lệch hóa đơn ${modal.claim.code}`} onClose={() => setModal(null)} footer={<><button className={btnGhost} onClick={() => setModal(null)}>Hủy</button><button className={btnPrimary} onClick={() => { update(modal.claim.id, { vatCheck: 'MISMATCH', vatNote: note.trim() || 'Chưa ghi chú' }); notify(`${modal.claim.code}: đã ghi nhận lệch hóa đơn`, 'orange'); setModal(null); }}>Ghi nhận lệch</button></>}>
          <Field label="Nội dung chênh lệch"><textarea className={cn(inputCls, 'min-h-24')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Giá trị hóa đơn cao hơn claim 2 triệu, cần NCC xuất hóa đơn điều chỉnh" /></Field>
        </Modal>
      )}
    </div>
  );
}

