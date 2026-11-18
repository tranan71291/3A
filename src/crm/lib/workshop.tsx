'use client';

import { CASH_ACCOUNT, compact, fmtDT, iso, JOB_LOST, jobCustName, lineAmount, lineCost, signedQty, vnd, WO_STAGE } from './core';
import type { Activity, CashDraft, CashEntry, CashLine, CashSource, Customer, InstallJob, InvMove, Job, JobLine, JobStage, PayTrigger, PriceItem, Receipt, User, WorkOrder } from './types';

/** Khối lượng tính tiền của 1 dòng: m² = rộng × cao (mm) / 1e6 × SL (áp tối thiểu / tấm), md = dài × SL, bộ / cái = SL */
export function lineMeasure(l: JobLine, minMeasure = 0) {
  if (l.unit === 'M2') return Math.round(Math.max((l.width * l.height) / 1e6, minMeasure) * l.qty * 100) / 100;
  if (l.unit === 'MD') return Math.round(Math.max(l.length, minMeasure) * l.qty * 100) / 100;
  return l.qty;
}

export function quoteTotalsOf(lines: JobLine[], vatPct: number, items: PriceItem[]) {
  const min = (l: JobLine) => items.find((p) => p.id === l.priceItemId)?.minMeasure ?? 0;
  const subtotal = lines.reduce((s, l) => s + lineAmount(l, min(l)), 0);
  const cost = lines.reduce((s, l) => s + lineCost(l, min(l)), 0);
  return { subtotal, vat: Math.round((subtotal * vatPct) / 100), total: subtotal + Math.round((subtotal * vatPct) / 100), cost };
}

export function jobMoney(job: Job, receipts: Receipt[]) {
  const mine = receipts.filter((r) => r.jobId === job.id && r.status !== 'REJECTED');
  const confirmed = mine.filter((r) => r.status === 'CONFIRMED').reduce((s, r) => s + r.amount, 0);
  const pending = mine.filter((r) => r.status !== 'CONFIRMED').reduce((s, r) => s + r.amount, 0);
  const value = job.contractValue ?? 0;
  return { value, confirmed, pending, collected: confirmed + pending, remaining: Math.max(0, value - confirmed - pending), receivable: Math.max(0, value - confirmed) };
}

export function jobStageOf(job: Job, wos: WorkOrder[], installs: InstallJob[], receipts: Receipt[]): JobStage {
  if (job.lostAt) return 'LOST';
  if (!job.wonAt) return job.quotes.length ? 'QUOTED' : 'SURVEY';
  if (installs.some((i) => i.jobId === job.id && i.status === 'ACCEPTED')) {
    const m = jobMoney(job, receipts);
    return m.confirmed >= m.value ? 'DONE' : 'WAIT_PAYMENT';
  }
  const wo = wos.find((w) => w.jobId === job.id);
  return wo?.stage === 'DONE' ? 'INSTALL' : 'PRODUCTION';
}

/** Trạng thái chi tiết hiển thị trong bảng (vd. "Đang sản xuất", "Đã hẹn lắp 12/10 08:00") */
export function jobDetailOf(job: Job, stage: JobStage, wos: WorkOrder[], installs: InstallJob[], receipts: Receipt[]) {
  const wo = wos.find((w) => w.jobId === job.id);
  const ins = installs.filter((i) => i.jobId === job.id).sort((a, b) => b.from.localeCompare(a.from))[0];
  const m = jobMoney(job, receipts);
  switch (stage) {
    case 'SURVEY': return job.appointmentAt ? `Hẹn khảo sát ${fmtDT(job.appointmentAt)}` : 'Chưa hẹn lịch khảo sát';
    case 'QUOTED': { const q = job.quotes[job.quotes.length - 1]; return `Báo giá v${q.version}: ${compact(q.total)}`; }
    case 'PRODUCTION': return wo ? WO_STAGE[wo.stage].label : 'Chờ sản xuất';
    case 'INSTALL': return ins ? (ins.status === 'IN_PROGRESS' ? 'Đang lắp đặt' : `Đã hẹn lắp ${fmtDT(ins.from)}`) : 'Sản xuất xong, chờ hẹn lắp';
    case 'WAIT_PAYMENT': return m.pending > 0 && m.remaining <= 0 ? `Chờ kế toán xác nhận ${compact(m.pending)}` : `Còn phải thu ${compact(m.remaining)}`;
    case 'DONE': return job.warrantyMonths ? `Bảo hành ${job.warrantyMonths} tháng` : 'Hoàn tất';
    default: return job.lostReason ? JOB_LOST[job.lostReason] : '';
  }
}

/** Số tiền phải thu tới mốc hiện tại theo lịch thanh toán */
export function dueByStage(job: Job, stage: JobStage) {
  const reached: PayTrigger[] = ['SIGN', ...(['INSTALL', 'WAIT_PAYMENT', 'DONE'].includes(stage) ? ['DELIVERY' as PayTrigger] : []), ...(['WAIT_PAYMENT', 'DONE'].includes(stage) ? ['ACCEPT' as PayTrigger] : [])];
  const pct = job.schedule.filter((s) => reached.includes(s.trigger)).reduce((s, x) => s + x.pct, 0);
  return Math.round(((job.contractValue ?? 0) * pct) / 100);
}

/** Tồn và giá bình quân của 1 vật tư đến hết ngày `until` (ISO, bỏ trống = tới nay) */
export function stockOf(itemId: string, moves: InvMove[], until?: string) {
  let qty = 0, value = 0;
  for (const m of [...moves].filter((x) => x.itemId === itemId && (!until || x.date <= until)).sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at)) {
    const avg = qty > 0 ? value / qty : m.unitCost;
    if (m.type === 'IN') { qty += m.qty; value += m.qty * m.unitCost; }
    else { const d = signedQty(m); qty += d; value += d * (m.type === 'ADJUST' && d > 0 ? m.unitCost || avg : avg); }
    if (qty <= 0) { value = 0; }
  }
  return { qty: Math.round(qty * 1000) / 1000, value: Math.max(0, Math.round(value)), avg: qty > 0 ? value / qty : 0 };
}

/** Phiếu thu quỹ tự sinh khi kế toán xác nhận tiền khách hàng */
export function receiptCash(r: Receipt, job: Job | undefined, customers: Customer[]): CashDraft {
  return {
    kind: 'IN', account: r.method === 'CASH' ? 'CASH' : 'BANK', category: 'Thu tiền khách hàng', amount: r.amount, partner: job ? jobCustName(job, customers) : undefined,
    jobId: r.jobId, ref: r.code, note: job ? `${job.code} ${job.title}` : r.note, source: 'RECEIPT', sourceId: r.id,
  };
}

/** Phiếu chi tạm ứng công tác tự sinh khi lịch công tác có tạm ứng được duyệt */
export function advanceCash(a: Activity, users: User[]): CashDraft | null {
  if (a.type !== 'TRIP' || !(a.advance && a.advance > 0)) return null;
  return {
    kind: 'OUT', account: 'CASH', category: 'Tạm ứng công tác', amount: a.advance, partner: users.find((u) => u.id === a.userId)?.name,
    ref: a.title, note: `Tạm ứng${a.location ? ` đi ${a.location}` : ''}, quyết toán khi nộp chứng từ`, source: 'ADVANCE', sourceId: a.id,
  };
}

/** Quyết toán công tác phí khi kế toán xác nhận thanh toán: trừ phần đã tạm ứng (nếu đã chi); tạm ứng thừa thì sinh phiếu thu hoàn ứng */
export function expenseCash(a: Activity, users: User[], entries: CashEntry[] = []): CashDraft {
  const total = (a.expenses ?? []).reduce((s, x) => s + x.amount, 0);
  const adv = entries.filter((e) => e.source === 'ADVANCE' && e.sourceId === a.id).reduce((s, e) => s + e.amount, 0);
  const net = total - adv;
  return {
    kind: net >= 0 ? 'OUT' : 'IN', account: 'CASH', category: net >= 0 ? (a.programId ? 'Chi phí triển khai sự kiện' : 'Công tác phí') : 'Hoàn ứng công tác', amount: Math.abs(net), partner: users.find((u) => u.id === a.userId)?.name,
    ref: a.title, note: `${(a.expenses ?? []).map((x) => x.name).join(', ')}${adv ? `. Chứng từ ${vnd(total)}, đã tạm ứng ${vnd(adv)}` : ''}`, source: 'EXPENSE', sourceId: a.id,
  };
}

/**
 * Sổ quỹ = phiếu đã lập (kể cả phiếu tự sinh khi kế toán xác nhận thu tiền / thanh toán công tác phí)
 * + phần ghi nhận từ dữ liệu cũ chưa có phiếu (phiếu thu đã xác nhận, công tác phí đã thanh toán trước bản v18).
 */
export function cashLines(entries: CashEntry[], receipts: Receipt[], jobs: Job[], customers: Customer[], activities: Activity[] = [], users: User[] = []): CashLine[] {
  const out: CashLine[] = [];
  for (const e of entries) {
    const auto = !!e.source && e.source !== 'MANUAL';
    if (e.kind === 'TRANSFER') {
      out.push({ id: `${e.id}-o`, entryId: e.id, code: e.code, date: e.date, account: e.account, kind: 'OUT', category: 'Chuyển quỹ', amount: e.amount, note: `Sang ${CASH_ACCOUNT[e.toAccount ?? 'BANK']}${e.note ? `. ${e.note}` : ''}` });
      out.push({ id: `${e.id}-i`, entryId: e.id, code: e.code, date: e.date, account: e.toAccount ?? 'BANK', kind: 'IN', category: 'Chuyển quỹ', amount: e.amount, note: `Từ ${CASH_ACCOUNT[e.account]}${e.note ? `. ${e.note}` : ''}` });
    } else out.push({ id: e.id, entryId: e.id, code: e.code, date: e.date, account: e.account, kind: e.kind, category: e.category, amount: e.amount, partner: e.partner, jobId: e.jobId, note: e.note, ref: e.ref, auto, source: e.source });
  }
  const has = (src: CashSource, id: string) => entries.some((e) => e.source === src && e.sourceId === id);
  for (const r of receipts) {
    if (r.status !== 'CONFIRMED' || !r.confirmedAt || has('RECEIPT', r.id)) continue;
    const j = jobs.find((x) => x.id === r.jobId);
    out.push({ id: `rc-${r.id}`, code: r.code, date: iso(new Date(r.confirmedAt)), account: r.method === 'CASH' ? 'CASH' : 'BANK', kind: 'IN', category: 'Thu tiền khách hàng', amount: r.amount,
      partner: j ? jobCustName(j, customers) : undefined, jobId: r.jobId, note: j ? `${j.code} ${j.title}` : r.note, ref: r.code, auto: true, source: 'RECEIPT' });
  }
  for (const a of activities) {
    if (a.expenseStatus !== 'PAID' || has('EXPENSE', a.id)) continue;
    const total = (a.expenses ?? []).reduce((s, x) => s + x.amount, 0);
    if (!total) continue;
    out.push({ id: `ex-${a.id}`, code: `CTP-${a.id.slice(-5).toUpperCase()}`, date: iso(new Date(a.expenseSubmittedAt ?? Date.parse(a.to))), account: 'CASH', kind: 'OUT', category: a.programId ? 'Chi phí triển khai sự kiện' : 'Công tác phí', amount: total,
      partner: users.find((u) => u.id === a.userId)?.name, note: a.title, auto: true, source: 'EXPENSE' });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
}

/** Chi phí thực tế của đơn: vật tư xuất kho cho đơn / lệnh SX + phiếu chi gắn đơn */
export function jobActualCost(job: Job, moves: InvMove[], entries: CashEntry[], wos: WorkOrder[]) {
  const woIds = new Set(wos.filter((w) => w.jobId === job.id).map((w) => w.id));
  const material = moves.filter((m) => m.type === 'OUT' && (m.jobId === job.id || (m.woId && woIds.has(m.woId)))).reduce((s, m) => s + m.qty * m.unitCost, 0);
  const other = entries.filter((e) => e.kind === 'OUT' && e.jobId === job.id).reduce((s, e) => s + e.amount, 0);
  return { material: Math.round(material), other, total: Math.round(material) + other };
}

/** Nén ảnh (khảo sát, chuyển khoản, bản vẽ dạng ảnh) để lưu được trong dữ liệu */
export async function compressImage(file: File, maxSide = 1280): Promise<string> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Không đọc được ảnh')); i.src = src; });
    const k = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } finally { URL.revokeObjectURL(src); }
}

