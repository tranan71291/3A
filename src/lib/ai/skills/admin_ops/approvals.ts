import type { SkillTool } from '../../core/types';
import { TOOL_SCHEMAS } from '../../tools/schema';

/**
 * get_pending_approvals — KHUNG CHỜ ĐIỀN LOGIC (`draft: true`).
 * Hàng chờ duyệt của app được TÍNH từ nhiều nhóm dữ liệu (xem useApprovalQueue trong app), không có bảng riêng:
 *   QUOTE    coll 'quotes'      data->'approval'->>'status' = 'PENDING' (level HEAD: Trưởng phòng của lead.dept; BOD: Giám đốc)
 *   CONTRACT coll 'genDocs'     status = 'PENDING_APPROVAL'
 *   ACTIVITY coll 'activities'  status = 'PENDING_APPROVAL' (công tác / nghỉ; Trưởng phòng cùng phòng người gửi)
 *   EXPENSE  coll 'activities'  expenseStatus = 'SUBMITTED' (tạm ứng / chi phí công tác)
 *   PROGRAM  coll 'programs'    status = 'PENDING_INTERNAL'
 *   CLAIM    coll 'claims'      (theo luật duyệt claim trong policy)
 *   STOCK    coll 'stockVouchers' status chờ duyệt; coll 'reservations' status = 'PENDING_RELEASE'
 * Người duyệt = approver_id hoặc chính người hỏi; quyền duyệt theo perms (coll '$', id 'perms') giống canDo() của app.
 * Nên chuyển logic useApprovalQueue sang một module dùng chung để app và AI không lệch nhau.
 */
export const getPendingApprovals: SkillTool<{ approver_id?: string; kind?: string }> = {
  name: 'get_pending_approvals', ...TOOL_SCHEMAS.get_pending_approvals, draft: true,
  async handler() { return { error: 'not_implemented' }; },
};
