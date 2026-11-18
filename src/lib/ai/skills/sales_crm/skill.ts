import type { SkillManifest } from '../../core/types';
import { getCustomer360 } from './customer360';
import { getSalesPipeline } from './pipeline';
import { createQuoteDraft, getProductInventory, getRecentOrders } from './scaffolds';

/** Skill Kinh doanh & Khách hàng (thay skill sales_pipeline cũ) */
const skill: SkillManifest = {
  id: 'sales_crm',
  name: 'Kinh doanh & khách hàng',
  version: '1.0.0',
  roles: ['BOD', 'DEPT_HEAD', 'SALES_REP', 'MKT_LEAD', 'ACCOUNTANT'],
  intents: {
    description: 'Tra cứu khách hàng (liên hệ, công nợ, doanh số), tồn kho và giá, đơn hàng gần đây, báo giá nháp, pipeline dự án',
    keywords: ['khach hang', 'khach', 'cong no', 'han muc', 'sdt', 'so dien thoai', 'mst', 'ton kho', 'gia ban', 'ma hang', 'don hang', 'bao gia', 'pipeline', 'lead', 'du an', 'sap chot', 'boq'],
    patterns: [/(thong tin|tra cuu|tim) .*(khach|cong ty)/, /(con|het) hang/, /(bao nhieu|may) (lead|du an)/],
  },
  prompt: `Bạn hỗ trợ đội kinh doanh tra cứu khách hàng và dự án.
- Câu hỏi về một khách hàng: gọi get_customer_360. Nếu kết quả "ambiguous", liệt kê ngắn các ứng viên và hỏi lại, không đoán.
- Công nợ: luôn nêu công nợ so với hạn mức; vượt hạn mức thì cảnh báo.
- Pipeline: gọi get_sales_pipeline; giá trị là tổng BOQ sau chiết khấu, trước VAT, không phải doanh thu đã chốt.
- Không đọc to số điện thoại / email trừ khi người dùng hỏi đúng thông tin đó.`,
  tools: [getCustomer360, getSalesPipeline, getProductInventory, getRecentOrders, createQuoteDraft],
};
export default skill;
