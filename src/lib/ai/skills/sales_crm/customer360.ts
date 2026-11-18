import { digits, fold, getRecord, inScope, listRecords, scopeOf, whoAmI } from '../../core/records';
import type { SkillTool } from '../../core/types';
import { TOOL_SCHEMAS } from '../../tools/schema';

/** Trường cần dùng của khách hàng (bản ghi records coll = 'customers', khớp type Customer của app) */
interface Customer {
  id: string; code: string; name: string; taxCode: string; segment: string; tier: string; region: string; dept: string; amId?: string; status: string;
  contactName: string; contactTitle: string; contactPhone: string; contactEmail: string; address: string;
  creditLimit: number; debt: number; ytdRevenue: number; lastYearRevenue: number; createdAt: string;
}
interface Lead { id: string; code: string; company: string; boqNote?: string; status: string; dept?: string; assignee?: string; boqValue?: number; boqItems?: { qty: number; price: number; discountPct: number }[]; wonAmount?: number; wonAt?: string }
interface Quote { id: string; code: string; version: number; date: string; amount: number; status: string; leadId?: string; customerId?: string }
type Light = { id: string; code: string | null; name: string | null; phone: string | null; tax: string | null; dept: string | null; amId: string | null };

export const boqValue = (l: Lead) => (l.boqItems?.length ? Math.round(l.boqItems.reduce((s, i) => s + i.qty * i.price * (1 - i.discountPct / 100), 0)) : l.boqValue ?? 0);

/**
 * get_customer_360 — TÌM KIẾM.
 * 1) Đọc danh sách gọn (chỉ id, mã, tên, SĐT, MST, phòng, người phụ trách) => so khớp KHÔNG DẤU trong Node
 *    (ILIKE của Postgres phân biệt dấu: "dien thanh" không khớp "Điện Thành"; SĐT có thể lưu kèm dấu cách).
 * 2) Lọc theo phạm vi (Sales: khách mình phụ trách, Trưởng phòng: khách của phòng, BOD/Kế toán/MKT: tất cả).
 * 3) Một kết quả rõ ràng => đọc chi tiết + dự án + báo giá; nhiều kết quả => trả danh sách để AI hỏi lại.
 */
export const getCustomer360: SkillTool<{ search_query: string }> = {
  name: 'get_customer_360',
  ...TOOL_SCHEMAS.get_customer_360,
  timeoutMs: 15_000,
  async handler({ search_query }, rt) {
    const { db, ctx, signal } = rt;
    const me = await whoAmI(db, ctx.tenant, signal);
    const scope = scopeOf(ctx, me, ['BOD', 'ACCOUNTANT', 'MKT_LEAD']);
    if (scope.kind === 'NONE') return { found: false, error: 'no_scope', message: scope.reason };

    const q = fold(search_query), d = digits(search_query);
    if (q.length < 2 && d.length < 4) return { found: false, message: 'Từ khóa quá ngắn' };
    const list = await listRecords<Light>(db, ctx.tenant, 'customers', {
      signal, columns: 'id, code:data->>code, name:data->>name, phone:data->>contactPhone, tax:data->>taxCode, dept:data->>dept, amId:data->>amId',
    });
    const scored = list
      .filter((c) => inScope(scope, c.dept, c.amId))
      .map((c) => {
        const name = fold(c.name ?? ''), code = fold(c.code ?? ''), phone = digits(c.phone ?? ''), tax = digits(c.tax ?? '');
        let s = 0;
        if (code && code === q) s = 100;
        else if (d.length >= 6 && (phone.endsWith(d) || tax === d)) s = 95;
        else if (name === q) s = 90;
        else if (name.startsWith(q)) s = 70;
        else if (q.length >= 3 && name.includes(q)) s = 50;
        else if (q.split(/\s+/).filter((w) => w.length > 1).every((w) => name.includes(w))) s = 40;
        return { c, s };
      })
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);

    if (!scored.length) return { found: false, message: `Không tìm thấy khách hàng khớp "${search_query}" trong phạm vi được xem` };
    const top = scored[0];
    const clear = scored.length === 1 || top.s >= 90 || top.s - scored[1].s >= 30;
    if (!clear) return { found: false, ambiguous: true, candidates: scored.slice(0, 5).map(({ c }) => ({ id: c.id, code: c.code, name: c.name, phone_last4: (c.phone ?? '').replace(/\D/g, '').slice(-4) })) };

    const c = await getRecord<Customer>(db, ctx.tenant, 'customers', top.c.id, signal);
    if (!c) return { found: false, message: 'Khách hàng vừa bị xóa' };
    const [leads, am] = await Promise.all([
      listRecords<Lead>(db, ctx.tenant, 'leads', { signal, filter: (x) => x.eq('data->>customerId', c.id), max: 2000 }),
      c.amId ? getRecord<{ name?: string }>(db, ctx.tenant, 'users', c.amId, signal) : Promise.resolve(null),
    ]);
    const leadIds = leads.map((l) => l.id);
    const quotes = await listRecords<Quote>(db, ctx.tenant, 'quotes', {
      signal, max: 2000,
      filter: (x) => (leadIds.length ? x.or(`data->>customerId.eq.${c.id},data->>leadId.in.(${leadIds.slice(0, 200).map((i) => `"${i}"`).join(',')})`) : x.eq('data->>customerId', c.id)),
    });
    const open = leads.filter((l) => !['WON', 'LOST'].includes(l.status));
    const growth = c.lastYearRevenue ? Math.round(((c.ytdRevenue - c.lastYearRevenue) / c.lastYearRevenue) * 1000) / 10 : null;
    return {
      found: true,
      customer: {
        id: c.id, code: c.code, name: c.name, tax_code: c.taxCode, tier: c.tier, segment: c.segment, region: c.region, dept: c.dept, status: c.status,
        account_manager: am?.name ?? null, customer_since: c.createdAt,
        contact: { name: c.contactName, title: c.contactTitle, phone: c.contactPhone, email: c.contactEmail },
        address: c.address,
      },
      finance: {
        currency: 'VND', debt: c.debt, credit_limit: c.creditLimit,
        debt_used_pct: c.creditLimit ? Math.round((c.debt / c.creditLimit) * 1000) / 10 : null,
        over_limit: c.creditLimit > 0 && c.debt > c.creditLimit,
        revenue_ytd: c.ytdRevenue, revenue_last_year: c.lastYearRevenue, growth_pct: growth,
      },
      projects: {
        open_count: open.length, open_value: open.reduce((s, l) => s + boqValue(l), 0),
        won_count: leads.filter((l) => l.status === 'WON').length,
        top_open: open.sort((a, b) => boqValue(b) - boqValue(a)).slice(0, 3).map((l) => ({ code: l.code, name: l.boqNote || l.company, status: l.status, value: boqValue(l) })),
      },
      recent_quotes: quotes.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map((x) => ({ code: `${x.code} v${x.version}`, date: x.date.slice(0, 10), amount_before_vat: x.amount, status: x.status })),
      other_matches: scored.length > 1 ? scored.length - 1 : 0,
    };
  },
};
