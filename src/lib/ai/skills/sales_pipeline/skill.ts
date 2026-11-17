import type { SkillManifest, SkillTool } from '../../core/types';

/**
 * Skill thứ hai, độc lập hoàn toàn với marketing_mdf (không import chéo).
 * Nhân viên KD chỉ thấy lead được giao; Trưởng phòng thấy phòng mình; BOD thấy tất cả.
 */
interface Lead { code: string; company: string; status: string; dept?: string; assignee?: string; boqItems?: { qty: number; price: number; discountPct: number }[] }
const value = (l: Lead) => (l.boqItems ?? []).reduce((s, i) => s + i.qty * i.price * (1 - i.discountPct / 100), 0);

const getPipeline: SkillTool<{ status?: string }> = {
  name: 'get_pipeline',
  description: 'Tổng hợp lead / dự án đang mở theo trạng thái và giá trị BOQ, trong phạm vi người hỏi được xem.',
  input: { type: 'object', properties: { status: { type: 'string', enum: ['NEW', 'ROUTED', 'ACCEPTED', 'QUOTED', 'WON', 'LOST'], description: 'Lọc trạng thái (tùy chọn)' } } },
  async handler({ status }, rt) {
    const { data, error } = await rt.db.from('records').select('data').eq('tenant_id', rt.ctx.tenant).eq('coll', 'leads').eq('deleted', false).abortSignal(rt.signal).limit(3000);
    if (error) throw new Error(error.message);
    let leads = (data ?? []).map((r: { data: unknown }) => r.data as Lead);
    if (rt.ctx.role !== 'BOD') {
      const { data: me } = await rt.db.rpc('member_app_user', { t: rt.ctx.tenant });
      if (rt.ctx.role === 'SALES_REP') leads = leads.filter((l) => l.assignee === me);
      else {
        const { data: u } = await rt.db.from('records').select('data').eq('tenant_id', rt.ctx.tenant).eq('coll', 'users').eq('id', String(me)).maybeSingle();
        const dept = (u as { data?: { dept?: string } } | null)?.data?.dept;
        leads = dept ? leads.filter((l) => l.dept === dept) : [];
      }
    }
    if (status) leads = leads.filter((l) => l.status === status);
    const by = new Map<string, { count: number; value: number }>();
    for (const l of leads) { const x = by.get(l.status) ?? { count: 0, value: 0 }; x.count++; x.value += value(l); by.set(l.status, x); }
    return { count: leads.length, by_status: Object.fromEntries(by), top: leads.sort((a, b) => value(b) - value(a)).slice(0, 5).map((l) => ({ code: l.code, company: l.company, status: l.status, value: Math.round(value(l)) })) };
  },
};

const skill: SkillManifest = {
  id: 'sales_pipeline',
  name: 'Pipeline bán hàng',
  version: '1.0.0',
  roles: ['BOD', 'DEPT_HEAD', 'SALES_REP'],
  intents: {
    description: 'Lead, dự án, pipeline, giá trị đang chào giá, dự án sắp chốt',
    keywords: ['pipeline', 'lead', 'du an', 'bao gia', 'sap chot', 'chot don', 'boq'],
    patterns: [/(bao nhieu|may) (lead|du an)/],
  },
  prompt: 'Bạn hỗ trợ theo dõi pipeline bán hàng. Gọi get_pipeline để lấy số liệu; giá trị là tổng BOQ sau chiết khấu, trước VAT. Không suy ra doanh thu đã chốt từ pipeline.',
  tools: [getPipeline],
};
export default skill;
