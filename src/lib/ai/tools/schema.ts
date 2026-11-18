import type { JsonSchema } from '../core/types';

/**
 * Định nghĩa tham số tập trung cho 15 công cụ CRM.
 *
 * Vì sao JSON Schema thay vì Zod: lõi Copilot đang chạy gửi `input` này thẳng cho Claude (input_schema) và
 * Gemini (functionDeclarations), đồng thời dùng chính nó để kiểm tra tham số trước khi chạm DB (core/validate.ts).
 * Nếu sau này chuyển sang Vercel AI SDK: bọc bằng `jsonSchema(TOOL_SCHEMAS.x.input)` của gói `ai`, không phải viết lại.
 *
 * Quy ước: tên ngắn ở đây; lõi tự thêm tiền tố "<skillId>__" (VD sales_crm__get_customer_360).
 * `mutates: true` => lõi bắt người dùng bấm xác nhận trước khi chạy.
 */
export interface ToolSpec { readonly description: string; readonly input: JsonSchema & { type: 'object' }; readonly mutates?: boolean }

const obj = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema & { type: 'object' } => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const str = (description: string, maxLength = 200): JsonSchema => ({ type: 'string', description, maxLength });
const date = (description: string): JsonSchema => ({ type: 'string', format: 'date', description });
const int = (description: string, minimum: number, maximum: number): JsonSchema => ({ type: 'integer', description, minimum, maximum });
const oneOf = (description: string, values: readonly string[]): JsonSchema => ({ type: 'string', description, enum: values });

export const TIME_RANGES = ['this_month', 'last_month', 'this_quarter', 'last_quarter', 'this_year', 'last_6_months', 'last_12_months', 'custom'] as const;

export const TOOL_SCHEMAS = {
  // ---------------- Phần 1: Kinh doanh & khách hàng ----------------
  get_customer_360: {
    description: 'Tra cứu toàn bộ thông tin một khách hàng theo tên, mã khách, mã số thuế hoặc số điện thoại: liên hệ, địa chỉ, hạng, công nợ so với hạn mức, doanh số năm nay, dự án đang mở, báo giá gần nhất. Trả danh sách ứng viên nếu có nhiều khách trùng.',
    input: obj({ search_query: str('Tên, mã khách, MST hoặc SĐT (có thể thiếu dấu)', 100) }, ['search_query']),
  },
  get_product_inventory: {
    description: 'Kiểm tra tồn kho và giá bán của mã hàng theo từ khóa (VD "Băng keo Scotch 23 3M", "Cáp Nexans"): tồn tổng, tồn theo kho, hàng đang giữ chỗ, giá bán lẻ / đại lý / dự án.',
    input: obj({ product_keyword: str('Tên hoặc mã hàng', 100), limit: int('Số mã tối đa, mặc định 5', 1, 10) }, ['product_keyword']),
  },
  get_recent_orders: {
    description: 'Lấy 5 đơn hàng / báo giá đã chốt gần nhất của một khách hàng (dùng customer_id lấy từ get_customer_360).',
    input: obj({ customer_id: str('Mã bản ghi khách hàng (id)', 60), limit: int('Mặc định 5', 1, 20) }, ['customer_id']),
  },
  create_quote_draft: {
    description: 'Tạo NHÁP báo giá cho khách hàng từ danh sách mã hàng và số lượng; giá lấy theo bảng giá hiện hành. Nháp chưa gửi khách, nhân viên mở trong Báo giá thông minh để hoàn thiện. Chỉ gọi khi người dùng yêu cầu rõ.',
    input: obj({
      customer_id: str('Mã bản ghi khách hàng (id)', 60),
      items: { type: 'array', maxItems: 50, description: 'Dòng hàng', items: obj({ sku: str('Mã hàng', 60), qty: { type: 'number', minimum: 0.01, maximum: 1_000_000, description: 'Số lượng' } }, ['sku', 'qty']) },
      note: str('Ghi chú cho báo giá', 500),
    }, ['customer_id', 'items']),
    mutates: true,
  },
  get_sales_pipeline: {
    description: 'Liệt kê lead / dự án đang theo đuổi trong phạm vi người hỏi (nhân viên: của mình; trưởng phòng: phòng mình; giám đốc: toàn công ty), tổng giá trị theo trạng thái và các dự án lớn nhất.',
    input: obj({ status: oneOf('Lọc trạng thái (tùy chọn)', ['NEW', 'ROUTED', 'ASSIGNED', 'ACCEPTED', 'QUOTED', 'WON', 'LOST']), limit: int('Số dự án liệt kê, mặc định 5', 1, 20) }),
  },

  // ---------------- Phần 2: Marketing & quỹ Hãng ----------------
  check_mdf_budget: {
    description: 'Tra cứu ngân sách quỹ Hãng (MDF + CS) của một năm: tổng, đã chi, đã cam kết, còn khả dụng, % đã dùng so với % thời gian đã qua, phân bổ theo hạng mục.',
    input: obj({ brand_name: str('Tên / mã Hãng (VD 3M). Bỏ trống = Hãng đang khai báo', 40), year: int('Năm quỹ, bỏ trống = năm hiện tại', 2020, 2100) }),
  },
  get_campaign_roi: {
    description: 'Báo cáo hiệu quả chiến dịch marketing: đã chi, số lead, CPL (chi phí / lead), số chốt, doanh thu, ROI. Theo một chiến dịch hoặc mọi chiến dịch chạy trong một tháng.',
    input: obj({ campaign_id: str('Mã chiến dịch (id hoặc code)', 60), month: { type: 'string', maxLength: 7, description: 'Tháng YYYY-MM (khi không có campaign_id)' } }),
  },
  get_content_tasks: {
    description: 'Danh sách nhiệm vụ nội dung (bài SEO, Fanpage, Zalo OA) theo trạng thái và người phụ trách, mặc định các việc đến hạn hôm nay.',
    input: obj({ status: oneOf('Trạng thái', ['PLAN', 'AI_QUEUED', 'AI_DONE', 'PUBLISHED']), assignee_id: str('Mã nhân sự phụ trách (bỏ trống = tất cả trong phạm vi)', 60), date: date('Ngày (YYYY-MM-DD), mặc định hôm nay') }),
  },

  // ---------------- Phần 3: Sản xuất & kỹ thuật (xưởng ALUX) ----------------
  check_production_status: {
    description: 'Tiến độ sản xuất của đơn hàng xưởng (tủ bếp nhôm kính, vách nhôm tổ ong…): công đoạn, % hoàn thành từng hạng mục, hạn giao, vật tư đã xuất.',
    input: obj({ order_id: str('Mã đơn / lệnh sản xuất', 60), customer_name: str('Tên khách (khi không có mã)', 100) }),
  },
  get_installation_schedule: {
    description: 'Lịch lắp đặt và nghiệm thu tại công trình trong khoảng ngày: đội, địa chỉ, trạng thái, lỗi tồn.',
    input: obj({ start_date: date('Từ ngày (YYYY-MM-DD), mặc định đầu tuần'), end_date: date('Đến ngày (YYYY-MM-DD), mặc định cuối tuần') }),
  },
  report_material_issue: {
    description: 'Ghi nhận báo cáo hao hụt / lỗi vật tư tại công trình để kho kiểm tra và điều chỉnh. Chỉ gọi khi người dùng yêu cầu rõ.',
    input: obj({ product_id: str('Mã vật tư', 60), issue_description: str('Mô tả lỗi / hao hụt', 1000), quantity_lost: { type: 'number', minimum: 0, maximum: 1_000_000, description: 'Số lượng hao hụt (theo đơn vị của vật tư)' }, job_id: str('Mã đơn / công trình (tùy chọn)', 60) }, ['product_id', 'issue_description', 'quantity_lost']),
    mutates: true,
  },

  // ---------------- Phần 4: Quản trị, hành chính & điều hành ----------------
  search_internal_documents: {
    description: 'Tìm tài liệu nội bộ: quy chế, chính sách, biểu mẫu, quy định quỹ MDF, KPI. Trả tên tài liệu, phiên bản, đoạn trích liên quan; chỉ tài liệu người hỏi được xem.',
    input: obj({ search_keyword: str('Từ khóa hoặc câu hỏi', 200), category: oneOf('Nhóm tài liệu (tùy chọn)', ['POLICY', 'MDF_RULES', 'KPI', 'PROFILE']), limit: int('Số kết quả, mặc định 5', 1, 10) }, ['search_keyword']),
  },
  get_revenue_report: {
    description: 'Báo cáo doanh thu đã chốt (trước VAT) và lợi nhuận gộp ước tính trong một khoảng thời gian, kèm so với kỳ trước, theo tháng / phòng / khách hàng. Giám đốc và Kế toán xem toàn công ty; Trưởng phòng xem phòng mình; nhân viên xem số của mình.',
    input: obj({ time_range: oneOf('Khoảng thời gian', TIME_RANGES), from: date('Từ ngày, khi time_range = custom'), to: date('Đến ngày (tính cả ngày này), khi time_range = custom') }, ['time_range']),
  },
  add_calendar_event: {
    description: 'Thêm lịch hẹn / sự kiện vào Lịch công tác CRM của chính người hỏi (họp, khảo sát, đào tạo, sự kiện). Không dùng cho đi công tác hay nghỉ phép (cần quy trình duyệt riêng). Chỉ gọi khi người dùng yêu cầu rõ.',
    input: obj({
      title: str('Tiêu đề', 120),
      time: { type: 'string', format: 'date-time', maxLength: 16, description: 'Bắt đầu, giờ Việt Nam, dạng YYYY-MM-DDTHH:mm' },
      duration_minutes: int('Thời lượng phút, mặc định 60', 15, 720),
      description: str('Nội dung / ghi chú', 1000),
      location: str('Địa điểm', 200),
      type: oneOf('Loại lịch, mặc định MEETING', ['MEETING', 'SURVEY', 'TRAINING', 'EVENT', 'OTHER']),
    }, ['title', 'time']),
    mutates: true,
  },
  get_pending_approvals: {
    description: 'Danh sách yêu cầu đang chờ người hỏi duyệt: giá báo giá, hợp đồng, công tác / nghỉ, tạm ứng, chi quỹ MDF, xuất kho.',
    input: obj({ approver_id: str('Mã nhân sự người duyệt, bỏ trống = chính người hỏi', 60), kind: oneOf('Loại yêu cầu (tùy chọn)', ['QUOTE', 'CONTRACT', 'ACTIVITY', 'EXPENSE', 'PROGRAM', 'CLAIM', 'STOCK']) }),
  },
} as const satisfies Record<string, ToolSpec>;

export type ToolName = keyof typeof TOOL_SCHEMAS;
