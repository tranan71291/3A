import { fold } from '../../core/records';
import type { SkillTool, ToolRuntime } from '../../core/types';
import { TOOL_SCHEMAS } from '../../tools/schema';
import { loadBudgets, loadClaims, loadPrograms, myDept, type Claim, type Program } from './data';

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const PROGRAM_STATUS = ['PENDING_INTERNAL', 'PENDING_VENDOR', 'APPROVED', 'CLAIMING', 'CLOSED', 'REJECTED', 'CANCELLED'] as const;

/** Tool 1 (check_mdf_budget): ngân sách quỹ Hãng của một năm — chỉ BOD, Trưởng MKT, Kế toán */
export const getMdfBudget: SkillTool<{ brand_name?: string; year?: number }> = {
  name: 'check_mdf_budget',
  ...TOOL_SCHEMAS.check_mdf_budget,
  roles: ['BOD', 'MKT_LEAD', 'ACCOUNTANT'],
  async handler({ brand_name, year: y }, rt) {
    const year = y ?? rt.ctx.now.getFullYear();
    const budgets = await loadBudgets(rt.db, rt.ctx.tenant, rt.signal);
    const brand = brand_name ? fold(brand_name) : '';
    const ofBrand = budgets.filter((x) => !brand || fold(`${x.vendor} ${x.vendorCode}`).includes(brand));
    if (brand && !ofBrand.length) return { found: false, message: `Chưa có quỹ của Hãng "${brand_name}"`, brands_available: [...new Set(budgets.map((x) => x.vendorCode || x.vendor))] };
    const b = ofBrand.find((x) => x.fiscalYear === year && x.declared !== false);
    if (!b) return { found: false, fiscal_year: year, message: 'Chưa khai báo ngân sách cho năm này', years_available: ofBrand.map((x) => x.fiscalYear) };
    const start = Date.parse(b.periodStart), end = Date.parse(b.periodEnd), now = rt.ctx.now.getTime();
    const timePct = end > start ? Math.min(100, Math.max(0, pct(now - start, end - start))) : 0;
    const used = b.spent + b.committed;
    return {
      found: true, vendor: b.vendor, fiscal_year: b.fiscalYear, currency: 'VND',
      total: b.total, mdf_total: b.mdfTotal, cs_total: b.csTotal, spent: b.spent, committed: b.committed,
      available: Math.max(0, b.total - used),
      used_pct: pct(used, b.total), time_elapsed_pct: timePct, pace_gap_points: Math.round((timePct - pct(used, b.total)) * 10) / 10,
      allocations: b.allocations ?? {},
    };
  },
};

/** Tool 2: danh sách đề xuất / chương trình — Trưởng phòng chỉ thấy phòng mình */
export const listMdfPrograms: SkillTool<{ status?: (typeof PROGRAM_STATUS)[number]; limit?: number }> = {
  name: 'list_mdf_programs',
  description: 'Liệt kê chương trình / đề xuất dùng quỹ Hãng, kèm số đề nghị, phần quỹ Hãng, trạng thái. Có thể lọc theo trạng thái.',
  input: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: PROGRAM_STATUS, description: 'Lọc trạng thái (tùy chọn)' },
      limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Số dòng tối đa, mặc định 10' },
    },
  },
  async handler({ status, limit }, rt) {
    let list = await loadPrograms(rt.db, rt.ctx.tenant, rt.signal);
    list = await scopeByDept(list, rt);
    if (status) list = list.filter((p) => p.status === status);
    list.sort((a, b) => b.start.localeCompare(a.start));
    return {
      count: list.length,
      total_vendor_share: list.reduce((s, p) => s + Math.round(p.requested * (p.sharePct / 100)), 0),
      items: list.slice(0, limit ?? 10).map((p) => ({ code: p.code, title: p.title, type: p.type, dept: p.dept, requested: p.requested, vendor_share: Math.round(p.requested * (p.sharePct / 100)), start: p.start, end: p.end, status: p.status })),
    };
  },
};

/** Tool 3: claim sắp hết hạn nộp + tiền chờ Hãng hoàn */
export const getClaimsDue: SkillTool<{ within_days?: number }> = {
  name: 'get_claims_due',
  description: 'Hồ sơ claim chưa nộp còn trong N ngày tới hạn, kèm chứng từ còn thiếu, và tổng tiền đang chờ Hãng hoàn.',
  input: { type: 'object', properties: { within_days: { type: 'integer', minimum: 1, maximum: 90, description: 'Mặc định 14 ngày' } } },
  async handler({ within_days }, rt) {
    const claims = await scopeByDept(await loadClaims(rt.db, rt.ctx.tenant, rt.signal), rt);
    const n = within_days ?? 14;
    const due = claims.filter((c) => !c.submitted && c.daysLeft <= n).sort((a, b) => a.daysLeft - b.daysLeft);
    const pending = claims.filter((c) => !c.creditNote).reduce((s, c) => s + (c.vendorApproved ?? Math.min(c.claimed, c.cap || c.claimed)), 0);
    return {
      within_days: n, pending_reimbursement: pending, overdue: due.filter((c) => c.daysLeft < 0).length,
      items: due.slice(0, 20).map((c: Claim) => ({ code: c.code, program: c.programTitle, dept: c.dept, claimed: c.claimed, days_left: c.daysLeft, missing_invoice: !c.invoice })),
    };
  },
};

/** Tool 4: tra quy định / chính sách quỹ trong kho kiến thức (namespace của Skill này) */
export const searchMdfPolicy: SkillTool<{ query: string }> = {
  name: 'search_mdf_policy',
  description: 'Tìm quy định quỹ MDF / CS, điều kiện claim, chứng từ bắt buộc trong tài liệu nội bộ và tài liệu Hãng. Trả về đoạn trích kèm tên tài liệu.',
  input: { type: 'object', properties: { query: { type: 'string', maxLength: 300, description: 'Câu hỏi hoặc từ khóa' } }, required: ['query'] },
  timeoutMs: 8000,
  async handler({ query }, rt) {
    const hits = await rt.kb.search(query, { limit: 5 });
    return { hits: hits.map((h) => ({ source: h.docTitle, excerpt: h.content.slice(0, 1200), score: Math.round(h.similarity * 100) / 100 })) };
  },
};

/** Trưởng phòng / nhân viên: chỉ dữ liệu phòng mình. BOD, MKT, Kế toán: toàn doanh nghiệp. */
async function scopeByDept<T extends Pick<Program, 'dept'>>(list: T[], rt: ToolRuntime): Promise<T[]> {
  if (['BOD', 'MKT_LEAD', 'ACCOUNTANT'].includes(rt.ctx.role)) return list;
  const dept = await myDept(rt.db, rt.ctx.tenant, rt.signal);
  return dept ? list.filter((x) => x.dept === dept) : [];
}
