'use client';

import { blockersOf, claimYear, compact, docGroupOf, findByTax, fmtDate, MST_RE, POP_LABEL, PROGRAM_REQUIRED, PROGRAM_SETTLEMENT, progYear, receivedReservedFor, REGION_LABEL, SEGMENT_PTS, shippedQty, SOURCE_PTS } from './core';
import type { Check, Claim, ClaimRules, Customer, Department, DeptCode, GeneratedDoc, Lead, PoAllocation, PoLine, PopType, Program, SegmentRules, Settlement, Tone, VendorPO } from './types';

/** Chấm điểm 0–100: BOQ 35 | Nhóm KH 20 | Nguồn 15 | Độ đầy đủ data 20 | KH hiện hữu 10 */
export function scoreLead(l: Lead, customers: Customer[]): number {
  const v = l.boqValue;
  const boq = v >= 5e9 ? 35 : v >= 1e9 ? 28 : v >= 2e8 ? 18 : v > 0 ? 8 : 0;
  const validMst = !!l.taxCode && MST_RE.test(l.taxCode);
  const data = (validMst ? 10 : 0) + (l.email ? 4 : 0) + (l.hasBoqFile ? 6 : l.boqNote ? 3 : 0);
  return Math.min(100, boq + (SEGMENT_PTS[l.segment] ?? 5) + SOURCE_PTS[l.source] + data + (findByTax(customers, l.taxCode) ? 10 : 0));
}

/** Phân luồng: KH hiện hữu -> phòng đang chăm sóc; còn lại theo nhóm khách hàng và khu vực (Bắc / Nam) */
export function decideDept(l: Lead, customers: Customer[], rules: SegmentRules, departments: Department[]): { code: DeptCode; reason: string; existing?: Customer } {
  const routable = departments.filter((d) => d.active && d.receivesLeads);
  const ok = (code: DeptCode) => routable.some((d) => d.code === code);
  const fallback = routable[0]?.code ?? departments[0]?.code ?? '';
  const ex = findByTax(customers, l.taxCode);
  if (ex && ok(ex.dept)) return { code: ex.dept, reason: 'Khách hàng hiện hữu, giữ phòng phụ trách', existing: ex };
  const def = rules[l.segment] ?? rules.OTHER;
  const target = def ? (l.region === 'NORTH' ? def.deptNorth : def.deptSouth) : '';
  return ok(target) ? { code: target, reason: `Nhóm ${def.name.toLowerCase()}, ${REGION_LABEL[l.region]}` } : { code: fallback, reason: 'Phòng mặc định' };
}

/** Đã tiêu (3M đã duyệt claim) và đang giữ chỗ của một năm, tính lại từ dữ liệu */
export function fundUsage(fy: number, programs: Program[], claims: Claim[]) {
  const spent = claims.filter((c) => claimYear(c, programs) === fy && (c.vendorApproved ?? 0) > 0).reduce((s, c) => s + (c.vendorApproved ?? 0), 0);
  const committed = programs.filter((p) => progYear(p) === fy && p.held > 0 && !['CLOSED', 'REJECTED', 'CANCELLED'].includes(p.status)).reduce((s, p) => s + p.held, 0);
  return { spent, committed };
}

export function roiRating(leverage: number | null): { label: string; tone: Tone } {
  if (leverage == null) return { label: 'Chưa có MDF', tone: 'muted' };
  if (leverage >= 10) return { label: 'Rất tốt', tone: 'teal' };
  if (leverage >= 5) return { label: 'Tốt', tone: 'teal' };
  if (leverage >= 2) return { label: 'Trung bình', tone: 'orange' };
  return { label: 'Kém', tone: 'red' };
}

/** Checklist kiểm toán Hãng theo cấu hình — BLOCKER chặn xuất Audit Pack */
export function auditClaim(c: Claim, rules: ClaimRules): Check[] {
  const out: Check[] = [];
  const usable = c.proofs.filter((p) => p.verification !== 'REJECTED');
  const of = (t: PopType) => usable.filter((p) => p.type === t);

  const required = PROGRAM_REQUIRED[c.programType] ?? [];
  out.push({ key: 'pre', label: 'Pre-Approval đã được 3M phê duyệt', severity: 'BLOCKER', passed: c.preApprovalApproved && !!c.preApprovalId, detail: c.preApprovalId || 'Chưa có mã' });
  for (const t of required) {
    const min = t === 'SITE_PHOTO' ? rules.minPhotos : 1;
    const n = of(t).length;
    out.push({ key: `doc-${t}`, label: t === 'SITE_PHOTO' ? `Tối thiểu ${min} ảnh hiện trường` : POP_LABEL[t] ?? t, severity: 'BLOCKER', passed: n >= min, detail: `Có ${n}/${min}` });
  }
  const photos = of('SITE_PHOTO');
  if (photos.length) {
    if (rules.requireWatermark) {
      const valid = photos.filter((p) => p.watermark && p.inWindow).length;
      out.push({ key: 'wm', label: 'Ảnh có watermark, chụp trong thời gian chương trình', severity: 'BLOCKER', passed: valid >= rules.minPhotos, detail: `${valid}/${photos.length} ảnh hợp lệ` });
    }
    const noGps = photos.filter((p) => !p.gps).length;
    out.push({ key: 'gps', label: 'Ảnh có tọa độ GPS', severity: rules.gpsBlocking ? 'BLOCKER' : 'WARNING', passed: noGps === 0, detail: noGps ? `${noGps} ảnh thiếu GPS` : 'Đầy đủ' });
  }
  out.push({
    key: 'vat', label: 'Thông tin hóa đơn GTGT hợp lệ', severity: 'BLOCKER',
    passed: !!c.invoice && MST_RE.test(c.invoice.supplierTax) && !!c.invoice.number,
    detail: c.invoice ? `${c.invoice.serial}-${c.invoice.number}, ngày ${fmtDate(c.invoice.date)}` : 'Chưa nhập số hóa đơn',
  });
  out.push({ key: 'amt', label: 'Số tiền claim không vượt phần Hãng đã duyệt', severity: 'BLOCKER', passed: c.claimed > 0 && c.claimed <= c.cap, detail: `${compact(c.claimed)} / trần ${compact(c.cap)}` });
  if (required.includes('ATTENDEE_SIGN_SHEET')) {
    const n = of('ATTENDEE_SIGN_SHEET').reduce((s, p) => s + (p.attendeeCount ?? 0), 0);
    const exp = c.expectedAttendees ?? 0;
    out.push({ key: 'att', label: 'Số khách ký tên đạt từ 50% kế hoạch', severity: 'WARNING', passed: !exp || n >= exp * 0.5, detail: `${n}/${exp} khách` });
  }
  // Hoàn ứng theo chi phí thực tế: không được claim vượt chi phí có hóa đơn
  const fin = claimFinance(c);
  if (fin.settlement === 'ACTUAL_COST' && fin.actualExecutionCost > 0) {
    out.push({ key: 'actual', label: 'Số claim không vượt chi phí thực tế có hóa đơn (hoàn ứng)', severity: 'BLOCKER', passed: c.claimed <= fin.actualExecutionCost, detail: `${compact(c.claimed)} / thực chi ${compact(fin.actualExecutionCost)}` });
  }
  const dup = usable.filter((p) => p.duplicateOf);
  out.push({ key: 'dup', label: 'Không trùng chứng từ với claim khác', severity: 'BLOCKER', passed: dup.length === 0, detail: dup.length ? dup.map((d) => `${d.name} đã nộp ở ${d.duplicateOf}`).join('; ') : 'Không phát hiện trùng' });
  const pending = usable.filter((p) => p.verification === 'PENDING').length;
  out.push({ key: 'ver', label: 'Chứng từ đã được xác minh nội bộ', severity: 'WARNING', passed: pending === 0, detail: pending ? `${pending} chứng từ chờ xác minh` : 'Hoàn tất' });
  out.push({ key: 'dl', label: 'Còn trong hạn nộp claim', severity: 'BLOCKER', passed: c.submitted || c.daysLeft >= 0, detail: `Còn ${c.daysLeft} ngày` });
  return out;
}

export function claimState(c: Claim, rules: ClaimRules): { label: string; tone: Tone } {
  if (c.offset) return { label: 'Đã cấn trừ công nợ', tone: 'teal' };
  if (c.creditNote) return { label: 'Đã nhận Credit Note', tone: 'teal' };
  if (c.vendorApproved != null) return { label: 'Hãng đã duyệt', tone: 'blue' };
  if (c.submitted) return { label: 'Đã nộp Hãng', tone: 'blue' };
  const b = blockersOf(c, rules);
  return b ? { label: `Thiếu ${b} điều kiện`, tone: 'orange' } : { label: 'Sẵn sàng nộp', tone: 'teal' };
}

// =====================================================================
//  THẶNG DƯ QUỸ MDF (chỉ hạng mục khoán theo hoạt động)
//  vendorApprovedBudget = mức 3M duyệt cho chương trình (cap)
//  actualExecutionCost  = tổng thực chi các nhà cung cấp
//  mdfMargin            = chênh lệch, chỉ ghi nhận khi khoán; hoàn ứng thì phần dư trả về quỹ
// =====================================================================

export function claimFinance(c: Claim) {
  const settlement: Settlement = PROGRAM_SETTLEMENT[c.programType] ?? 'ACTUAL_COST';
  const vendorApprovedBudget = c.cap;
  const actualExecutionCost = c.costLines?.length ? c.costLines.reduce((s, l) => s + l.actual, 0) : c.actualCost ?? 0;
  const hasActual = actualExecutionCost > 0;
  const gap = hasActual ? vendorApprovedBudget - actualExecutionCost : 0;
  const mdfMargin = settlement === 'LUMP_SUM' ? gap : 0;
  return {
    settlement,
    vendorApprovedBudget,
    actualExecutionCost,
    hasActual,
    mdfMargin,
    marginPct: vendorApprovedBudget > 0 && settlement === 'LUMP_SUM' ? (gap / vendorApprovedBudget) * 100 : 0,
    /** Hoàn ứng: phần 3M duyệt nhưng không chi, trả lại quỹ */
    returned: settlement === 'ACTUAL_COST' && gap > 0 ? gap : 0,
  };
}

/** Tổng hợp thặng dư toàn quỹ cho KPI và biểu đồ */
export function marginSummary(claims: Claim[]) {
  let approved = 0, actual = 0, margin = 0, returned = 0, profit = 0, reinvest = 0, pending = 0;
  for (const c of claims) {
    const f = claimFinance(c);
    if (!f.hasActual) continue;
    approved += f.vendorApprovedBudget;
    actual += Math.min(f.actualExecutionCost, f.vendorApprovedBudget);
    returned += f.returned;
    if (f.mdfMargin > 0) {
      margin += f.mdfMargin;
      if (c.surplusAllocation === 'COMPANY_PROFIT') profit += f.mdfMargin;
      else if (c.surplusAllocation === 'REINVEST') reinvest += f.mdfMargin;
      else pending += f.mdfMargin;
    }
  }
  return { approved, actual, margin, returned, profit, reinvest, pending, pct: approved ? (margin / approved) * 100 : 0 };
}

export function poLineStats(po: VendorPO, line: PoLine) {
  const received = shippedQty(po, line.sku, ['RECEIVED']);
  const transit = shippedQty(po, line.sku, ['IN_TRANSIT', 'ARRIVED']);
  const planned = shippedQty(po, line.sku, ['PLANNED']);
  const allocated = line.allocations.reduce((a, x) => a + x.qty, 0);
  return { ordered: line.qty, received, transit, planned, backorder: Math.max(0, line.qty - received), unscheduled: Math.max(0, line.qty - received - transit - planned), allocated, free: Math.max(0, line.qty - allocated) };
}

export function poProgress(po: VendorPO) {
  const ordered = po.lines.reduce((a, l) => a + l.qty, 0);
  const received = po.lines.reduce((a, l) => a + poLineStats(po, l).received, 0);
  const transit = po.lines.reduce((a, l) => a + poLineStats(po, l).transit, 0);
  const value = po.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  return { ordered, received, transit, value, pct: ordered ? (received / ordered) * 100 : 0, transitPct: ordered ? (transit / ordered) * 100 : 0 };
}

export function poState(po: VendorPO, today: string): { label: string; tone: Tone } {
  if (po.cancelled) return { label: 'Đã hủy', tone: 'muted' };
  const p = poProgress(po);
  if (p.received >= p.ordered) return { label: 'Đã về đủ', tone: 'teal' };
  if (po.shipments.some((s) => s.status !== 'RECEIVED' && s.eta < today)) return { label: 'Trễ ETA', tone: 'red' };
  if (p.received > 0) return { label: 'Về một phần', tone: 'orange' };
  return { label: 'Chờ hàng', tone: 'blue' };
}

/**
 * Phân bổ của từng đợt hàng.
 * Đợt đã nhập kho: lấy snapshot đã chốt. Đợt chưa về: lấp phần giữ chỗ còn thiếu theo thứ tự ETA,
 * phần còn lại của đợt nhập tồn kho tự do.
 */
export function shipmentAllocation(po: VendorPO, shipmentId: string, sku: string): { reserved: { a: PoAllocation; qty: number }[]; free: number } {
  const target = po.shipments.find((s) => s.id === shipmentId);
  const snap = target?.allocSnapshot?.find((x) => x.sku === sku);
  if (snap) return { reserved: snap.reserved.map((a) => ({ a, qty: a.qty })), free: snap.free };
  const line = po.lines.find((l) => l.sku === sku);
  if (!line || !target) return { reserved: [], free: 0 };
  const queue = line.allocations.map((a) => ({ a, left: Math.max(0, a.qty - receivedReservedFor(po, sku, a.kind, a.refId)) }));
  const pending = po.shipments.filter((s) => !s.allocSnapshot).sort((x, y) => x.eta.localeCompare(y.eta));
  for (const s of pending) {
    let qty = s.lines.find((x) => x.sku === sku)?.qty ?? 0;
    const reserved: { a: PoAllocation; qty: number }[] = [];
    for (const q of queue) {
      if (!qty) break;
      const take = Math.min(q.left, qty);
      if (take > 0) { reserved.push({ a: q.a, qty: take }); q.left -= take; qty -= take; }
    }
    if (s.id === shipmentId) return { reserved, free: qty };
  }
  return { reserved: [], free: 0 };
}

export function latestContracts(docs: GeneratedDoc[]) {
  const m = new Map<string, GeneratedDoc>();
  for (const d of docs) {
    const g = docGroupOf(d);
    const cur = m.get(g);
    if (!cur || (d.version ?? 1) > (cur.version ?? 1)) m.set(g, d);
  }
  return Array.from(m.values());
}

