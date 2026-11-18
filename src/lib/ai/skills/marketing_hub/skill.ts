import type { SkillManifest, SkillTool } from '../../core/types';
import { TOOL_SCHEMAS } from '../../tools/schema';

/**
 * Skill Marketing Hub — KHUNG CHỜ ĐIỀN LOGIC (`draft: true` => chưa đưa cho AI; xóa cờ khi viết xong).
 * Truy vấn: rt.db (JWT người dùng) + public.records; phạm vi: scopeOf(ctx, me, ['BOD', 'MKT_LEAD']) trong core/records.ts.
 */

/**
 * get_campaign_roi
 * Đọc: coll = 'campaigns' (id, code, name, channels[], start, end, budget, spent, status, manualLeads, manualRevenue)
 *      coll = 'leads'     (source, receivedDaysAgo / routedAt => thời điểm nhận, status, wonAmount)
 *      coll = 'jobs'      (leadId, wonAt, contractValue) — mô hình xưởng
 * Logic giống campaignStats() của app: lead có nguồn thuộc kênh của chiến dịch, nhận trong [start, end + 30 ngày];
 *      CPL = spent / lead; ROI = (doanh thu − spent) / spent. Theo tháng: các chiến dịch có [start, end] giao với tháng.
 */
const getCampaignRoi: SkillTool<{ campaign_id?: string; month?: string }> = {
  name: 'get_campaign_roi', ...TOOL_SCHEMAS.get_campaign_roi, draft: true,
  async handler() { return { error: 'not_implemented' }; },
};

/**
 * get_content_tasks
 * Đọc: coll = 'mktTasks' (id, date, title, channel, contentType, status, ownerId, contentId, campaignId)
 *      coll = 'contents' (id, title, status DRAFT/REVIEW/APPROVED/PUBLISHED, aiJob.status) để suy trạng thái thực
 *      (giống taskStatusOf() của app). Lọc data->>date = ngày, data->>ownerId = assignee_id (SALES/nhân viên: chỉ của mình).
 */
const getContentTasks: SkillTool<{ status?: string; assignee_id?: string; date?: string }> = {
  name: 'get_content_tasks', ...TOOL_SCHEMAS.get_content_tasks, draft: true,
  async handler() { return { error: 'not_implemented' }; },
};

const skill: SkillManifest = {
  id: 'marketing_hub',
  name: 'Marketing Hub',
  version: '0.1.0',
  roles: ['BOD', 'MKT_LEAD'],
  intents: {
    description: 'Hiệu quả chiến dịch (chi phí, lead, CPL, ROI), nhiệm vụ nội dung SEO / Fanpage / Zalo',
    keywords: ['chien dich', 'roi', 'cpl', 'chi phi lead', 'content', 'bai viet', 'fanpage', 'seo', 'nhiem vu noi dung'],
  },
  prompt: 'Bạn hỗ trợ Marketing đo hiệu quả chiến dịch và theo dõi việc nội dung. CPL = chi phí / số lead; ROI = (doanh thu − chi phí) / chi phí.',
  tools: [getCampaignRoi, getContentTasks],
};
export default skill;
