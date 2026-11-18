import { inScope, listRecords, scopeOf, whoAmI } from '../../core/records';
import type { SkillTool } from '../../core/types';
import { TOOL_SCHEMAS } from '../../tools/schema';
import { boqValue } from './customer360';

interface Lead { id: string; code: string; company: string; boqNote?: string; status: string; dept?: string; assignee?: string; boqValue?: number; boqItems?: { qty: number; price: number; discountPct: number }[]; quoteDeadline?: number; slaDeadline?: number }

/** get_sales_pipeline — thay tool get_pipeline của skill sales_pipeline cũ (đã gộp vào đây) */
export const getSalesPipeline: SkillTool<{ status?: string; limit?: number }> = {
  name: 'get_sales_pipeline',
  ...TOOL_SCHEMAS.get_sales_pipeline,
  async handler({ status, limit }, rt) {
    const { db, ctx, signal } = rt;
    const me = await whoAmI(db, ctx.tenant, signal);
    const scope = scopeOf(ctx, me, ['BOD', 'MKT_LEAD']);
    if (scope.kind === 'NONE') return { error: 'no_scope', message: scope.reason };
    let leads = (await listRecords<Lead>(db, ctx.tenant, 'leads', { signal })).filter((l) => inScope(scope, l.dept, l.assignee));
    leads = status ? leads.filter((l) => l.status === status) : leads.filter((l) => !['WON', 'LOST'].includes(l.status));
    const by: Record<string, { count: number; value: number }> = {};
    for (const l of leads) { const x = (by[l.status] ??= { count: 0, value: 0 }); x.count++; x.value += boqValue(l); }
    const now = ctx.now.getTime();
    return {
      scope: scope.kind === 'ALL' ? 'toàn công ty' : scope.kind === 'DEPT' ? `phòng ${scope.dept}` : 'của tôi',
      currency: 'VND', count: leads.length, total_value: leads.reduce((s, l) => s + boqValue(l), 0), by_status: by,
      top: leads.sort((a, b) => boqValue(b) - boqValue(a)).slice(0, limit ?? 5).map((l) => {
        const due = l.status === 'ACCEPTED' ? l.quoteDeadline : l.status === 'ASSIGNED' || l.status === 'ROUTED' ? l.slaDeadline : undefined;
        return { code: l.code, name: l.boqNote || l.company, company: l.company, status: l.status, value: boqValue(l), overdue_hours: due && due < now ? Math.round((now - due) / 3.6e6) : 0 };
      }),
    };
  },
};
