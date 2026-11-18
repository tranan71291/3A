import type { SkillManifest, SkillTool } from '../../core/types';
import { TOOL_SCHEMAS } from '../../tools/schema';

/**
 * Skill Sản xuất & Kỹ thuật (xưởng ALUX) — KHUNG CHỜ ĐIỀN LOGIC.
 * Đang tắt cả Skill (`enabled: false`) vì chưa có tool nào chạy được; điền xong thì bỏ `draft: true` ở tool và `enabled: false`.
 */

/**
 * check_production_status
 * Đọc: coll = 'workOrders' (id, code, title, jobId, customerId, stage WAITING/IN_PROGRESS/DONE, priority, startDate, dueDate,
 *       items[{name, qty, done}], materials[], design.status, history[])
 *      coll = 'jobs' (id, code, title, customerId, wonAt, contractValue) và coll = 'customers' (name) để tìm theo tên khách.
 * Trả: công đoạn, % hoàn thành = Σdone / Σqty, trễ hạn bao nhiêu ngày so với dueDate.
 */
const checkProductionStatus: SkillTool<{ order_id?: string; customer_name?: string }> = {
  name: 'check_production_status', ...TOOL_SCHEMAS.check_production_status, draft: true,
  async handler() { return { error: 'not_implemented' }; },
};

/**
 * get_installation_schedule
 * Đọc: coll = 'installJobs' (id, code, title, address, leaderId, team[], from, to, status SCHEDULED/IN_PROGRESS/ACCEPTED,
 *       defects[{text, fixed}], acceptance) lọc data->>from < end_date + 1 và data->>to >= start_date.
 *      coll = 'users' để đổi leaderId / team thành tên.
 */
const getInstallationSchedule: SkillTool<{ start_date?: string; end_date?: string }> = {
  name: 'get_installation_schedule', ...TOOL_SCHEMAS.get_installation_schedule, draft: true,
  async handler() { return { error: 'not_implemented' }; },
};

/**
 * report_material_issue  (GHI DỮ LIỆU — lõi bắt xác nhận)
 * Đọc: coll = 'stockItems' (id, code, name, unit, cost) để kiểm product_id và tính giá trị hao hụt.
 * Ghi: coll MỚI 'materialIssues' qua insertRecord(): { id, itemId, jobId?, qty, description, by: me.appUserId, at, status: 'OPEN' }.
 *      KHÔNG tự tạo phiếu ADJUST trong 'stockMoves': kho kiểm tra rồi mới điều chỉnh tồn (cần màn hình duyệt trong app).
 */
const reportMaterialIssue: SkillTool<{ product_id: string; issue_description: string; quantity_lost: number; job_id?: string }> = {
  name: 'report_material_issue', ...TOOL_SCHEMAS.report_material_issue, draft: true,
  async handler() { return { error: 'not_implemented' }; },
};

const skill: SkillManifest = {
  id: 'alux_production',
  name: 'Sản xuất & lắp đặt',
  version: '0.1.0',
  roles: ['BOD', 'DEPT_HEAD', 'SALES_REP', 'ACCOUNTANT'],
  tenants: ['alux'],
  enabled: false,
  intents: {
    description: 'Tiến độ sản xuất đơn hàng xưởng, lịch lắp đặt / nghiệm thu, báo hao hụt vật tư',
    keywords: ['san xuat', 'tien do', 'xuong', 'lap dat', 'nghiem thu', 'cong trinh', 'hao hut', 'vat tu', 'tu bep', 'nhom kinh'],
  },
  prompt: 'Bạn hỗ trợ điều phối xưởng và đội lắp đặt. Báo tiến độ bằng % hoàn thành và số ngày trễ so với hạn.',
  tools: [checkProductionStatus, getInstallationSchedule, reportMaterialIssue],
};
export default skill;
