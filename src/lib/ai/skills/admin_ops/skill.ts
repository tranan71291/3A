import type { SkillManifest } from '../../core/types';
import { getPendingApprovals } from './approvals';
import { addCalendarEvent } from './calendar';
import { searchInternalDocuments } from './documents';
import { getRevenueReport } from './revenue';

/** Skill Quản trị, hành chính & điều hành: mọi vai trò dùng được, phạm vi số liệu do từng tool tự ép */
const skill: SkillManifest = {
  id: 'admin_ops',
  name: 'Điều hành & hành chính',
  version: '1.0.0',
  roles: ['BOD', 'MKT_LEAD', 'DEPT_HEAD', 'SALES_REP', 'ACCOUNTANT'],
  intents: {
    description: 'Tài liệu, quy chế, biểu mẫu nội bộ; báo cáo doanh thu, lợi nhuận; thêm lịch hẹn vào lịch công tác; việc chờ duyệt',
    keywords: ['tai lieu', 'quy che', 'quy dinh', 'bieu mau', 'chinh sach', 'doanh thu', 'loi nhuan', 'bao cao', 'lich', 'lich hen', 'cuoc hop', 'dat lich', 'cho duyet', 'phe duyet'],
    patterns: [/(them|tao|dat|len) (lich|cuoc hop|hen)/, /doanh (thu|so) .*(thang|quy|nam)/],
  },
  prompt: `Bạn hỗ trợ điều hành và hành chính.
- Doanh thu / lợi nhuận: gọi get_revenue_report. Luôn nói rõ phạm vi (toàn công ty / phòng / cá nhân), kỳ, và "trước VAT". Lợi nhuận gộp là ước tính: nêu tỷ lệ phủ GM%.
- Tài liệu / quy chế: gọi search_internal_documents rồi trả lời dựa trên đoạn trích, ghi tên tài liệu và phiên bản. Không có tài liệu khớp thì nói không tìm thấy.
- Lịch hẹn: gọi add_calendar_event chỉ khi người dùng đã nói rõ tiêu đề và thời gian; quy đổi "9h sáng mai" sang YYYY-MM-DDTHH:mm theo ngày hôm nay. Trùng lịch thì nhắc.`,
  tools: [getRevenueReport, searchInternalDocuments, addCalendarEvent, getPendingApprovals],
  knowledge: { namespaces: ['mdf_policy', 'vendor_3m', 'hr_policy', 'general'] },
};
export default skill;
