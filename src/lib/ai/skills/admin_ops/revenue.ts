import { getWhole, inScope, listRecords, rangeOf, scopeOf, whoAmI, type TimeRange } from '../../core/records';
import type { SkillTool } from '../../core/types';
import { TOOL_SCHEMAS } from '../../tools/schema';

interface Lead { id: string; company: string; customerId?: string; dept?: string; assignee?: string; status: string; wonAt?: string; wonAmount?: number; wonQuoteId?: string; boqValue?: number; boqItems?: { qty: number; price: number; discountPct: number }[] }
interface Job { id: string; customerId: string; dept?: string; ownerId?: string; wonAt?: string; lostAt?: string; contractValue?: number }
interface Quote { id: string; gmPct?: number }
interface Dept { code: string; name: string; short?: string }

const leadValue = (l: Lead) => l.wonAmount ?? (l.boqItems?.length ? Math.round(l.boqItems.reduce((s, i) => s + i.qty * i.price * (1 - i.discountPct / 100), 0)) : l.boqValue ?? 0);
/** Vai trò xem số TỔNG công ty (chỉnh tại đây nếu chính sách đổi) */
const TOTAL_ROLES = ['BOD', 'ACCOUNTANT'] as const;

/**
 * get_revenue_report — ĐỌC SỐ LIỆU TỔNG HỢP.
 * Doanh thu = dự án thương mại đã chốt (leads.status = WON, wonAt trong kỳ, wonAmount trước VAT)
 *           + đơn xưởng đã ký (jobs.wonAt trong kỳ, không bị hủy, contractValue).
 * Lợi nhuận gộp ước tính = doanh thu × GM% của báo giá thắng (quotes.gmPct); phần không có GM% báo rõ tỷ lệ phủ.
 * Phân quyền: RLS của records chỉ tách doanh nghiệp, nên phạm vi được ÉP TẠI ĐÂY:
 *   BOD / Kế toán: toàn công ty · Trưởng phòng: phòng mình · còn lại: dự án do chính mình phụ trách.
 * Lọc ngày bằng so sánh chuỗi ISO trên data->>wonAt (YYYY-MM-DD...), chạy phía Postgres.
 */
export const getRevenueReport: SkillTool<{ time_range: TimeRange; from?: string; to?: string }> = {
  name: 'get_revenue_report',
  ...TOOL_SCHEMAS.get_revenue_report,
  timeoutMs: 20_000,
  async handler({ time_range, from, to }, rt) {
    const { db, ctx, signal } = rt;
    const me = await whoAmI(db, ctx.tenant, signal);
    const scope = scopeOf(ctx, me, TOTAL_ROLES);
    if (scope.kind === 'NONE') return { error: 'no_scope', message: scope.reason };
    let r: ReturnType<typeof rangeOf>;
    try { r = rangeOf(time_range, ctx.now, { from, to }); } catch { return { error: 'invalid_input', message: 'time_range = custom cần from và to (YYYY-MM-DD)' }; }

    const load = (a: string, b: string) => Promise.all([
      listRecords<Lead>(db, ctx.tenant, 'leads', { signal, filter: (q) => q.eq('data->>status', 'WON').gte('data->>wonAt', a).lt('data->>wonAt', b) }),
      listRecords<Job>(db, ctx.tenant, 'jobs', { signal, filter: (q) => q.gte('data->>wonAt', a).lt('data->>wonAt', b) }),
    ]);
    const [[leads0, jobs0], [pLeads, pJobs], depts] = await Promise.all([
      load(r.from, r.to), load(r.prevFrom, r.prevTo),
      getWhole<Dept[]>(db, ctx.tenant, 'departments', signal).catch(() => null),
    ]);
    const leads = leads0.filter((l) => inScope(scope, l.dept, l.assignee));
    const jobs = jobs0.filter((j) => !j.lostAt && inScope(scope, j.dept, j.ownerId));
    const prev = pLeads.filter((l) => inScope(scope, l.dept, l.assignee)).reduce((s, l) => s + leadValue(l), 0)
      + pJobs.filter((j) => !j.lostAt && inScope(scope, j.dept, j.ownerId)).reduce((s, j) => s + (j.contractValue ?? 0), 0);

    const qIds = [...new Set(leads.map((l) => l.wonQuoteId).filter((x): x is string => !!x))].slice(0, 500);
    const quotes = qIds.length ? await listRecords<Quote>(db, ctx.tenant, 'quotes', { signal, filter: (q) => q.in('id', qIds) }) : [];
    const gm = new Map(quotes.filter((q) => typeof q.gmPct === 'number').map((q) => [q.id, q.gmPct as number]));

    type Row = { month: string; dept: string; customer: string; value: number; gp: number | null };
    const rows: Row[] = [
      ...leads.map((l) => { const v = leadValue(l), g = l.wonQuoteId ? gm.get(l.wonQuoteId) : undefined; return { month: (l.wonAt ?? '').slice(0, 7), dept: l.dept ?? '—', customer: l.company, value: v, gp: g === undefined ? null : Math.round((v * g) / 100) }; }),
      ...jobs.map((j) => ({ month: (j.wonAt ?? '').slice(0, 7), dept: j.dept ?? '—', customer: j.customerId, value: j.contractValue ?? 0, gp: null })),
    ];
    const revenue = rows.reduce((s, x) => s + x.value, 0);
    const withGp = rows.filter((x) => x.gp !== null);
    const sum = (key: 'month' | 'dept' | 'customer') => {
      const m = new Map<string, { revenue: number; deals: number }>();
      for (const x of rows) { const v = m.get(x[key]) ?? { revenue: 0, deals: 0 }; v.revenue += x.value; v.deals++; m.set(x[key], v); }
      return [...m.entries()].map(([k, v]) => ({ k, ...v }));
    };
    const custIds = [...new Set(jobs.map((j) => j.customerId).filter(Boolean))].slice(0, 500);
    const custs = custIds.length ? await listRecords<{ id: string; name: string | null }>(db, ctx.tenant, 'customers', { signal, columns: 'id, name:data->>name', filter: (q) => q.in('id', custIds) }) : [];
    const customerName = new Map(custs.map((c) => [c.id, c.name ?? c.id]));
    const deptName = new Map((Array.isArray(depts) ? depts : []).map((d) => [d.code, d.short || d.name]));
    return {
      scope: scope.kind === 'ALL' ? 'toàn công ty' : scope.kind === 'DEPT' ? `phòng ${deptName.get(scope.dept) ?? scope.dept}` : 'cá nhân',
      period: { label: r.label, from: r.from, to_exclusive: r.to }, currency: 'VND', basis: 'trước VAT, theo ngày chốt',
      revenue, deals: rows.length,
      previous_period: { from: r.prevFrom, revenue: prev, change_pct: prev ? Math.round(((revenue - prev) / prev) * 1000) / 10 : null },
      gross_profit_est: withGp.length ? withGp.reduce((s, x) => s + (x.gp ?? 0), 0) : null,
      gross_profit_coverage_pct: revenue ? Math.round((withGp.reduce((s, x) => s + x.value, 0) / revenue) * 1000) / 10 : 0,
      by_month: sum('month').sort((a, b) => a.k.localeCompare(b.k)).map(({ k, ...v }) => ({ month: k, ...v })),
      ...(scope.kind === 'SELF' ? {} : { by_dept: sum('dept').sort((a, b) => b.revenue - a.revenue).map(({ k, ...v }) => ({ dept: deptName.get(k) ?? k, ...v })) }),
      top_customers: sum('customer').sort((a, b) => b.revenue - a.revenue).slice(0, 5).map(({ k, ...v }) => ({ customer: customerName.get(k) ?? k, ...v })),
      note: 'Lợi nhuận gộp chỉ tính trên phần doanh thu có GM% báo giá; đơn xưởng chưa có giá vốn trong CRM.',
    };
  },
};
