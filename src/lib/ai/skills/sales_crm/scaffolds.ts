import type { SkillTool } from '../../core/types';
import { TOOL_SCHEMAS } from '../../tools/schema';

/**
 * KHUNG CHỜ ĐIỀN LOGIC. `draft: true` => lõi chưa đưa tool cho AI. Viết xong truy vấn thì xóa dòng `draft: true`.
 * Mọi truy vấn: rt.db (đã gắn JWT người dùng) + bảng public.records; tự lọc phạm vi bằng scopeOf()/inScope() trong core/records.ts.
 */

/**
 * get_product_inventory
 * Đọc: records coll = 'skus' (id = mã hàng). Trường: sku, name, brand, category, unit, stock, whStock{khoId: sl},
 *      minStock, basePrice (giá lẻ), dealerPrice, projectPrice, costPrice (CHỈ trả khi role BOD / ACCOUNTANT), archived.
 *      records coll = 'reservations' (hàng giữ chỗ): sku, qty, delivered, status = 'HELD' | 'PENDING_RELEASE' => tồn tự do = stock − giữ chỗ.
 *      records coll = '$', id = 'warehouses' hoặc coll = 'warehouses' (tên kho).
 * Gợi ý: listRecords(..., 'skus', { columns: 'id, name:data->>name, brand:data->>brand' }) rồi so khớp fold() như get_customer_360.
 */
export const getProductInventory: SkillTool<{ product_keyword: string; limit?: number }> = {
  name: 'get_product_inventory', ...TOOL_SCHEMAS.get_product_inventory, draft: true,
  async handler() { return { error: 'not_implemented' }; },
};

/**
 * get_recent_orders
 * Thương mại (VASSH): records coll = 'leads' lọc data->>customerId = customer_id và data->>status = 'WON' (wonAt, wonAmount, wonQuoteId)
 *                     + coll = 'getflyOrders' (orderCode, customerId, orderDate, net) nếu đã đồng bộ Getfly.
 * Xưởng (ALUX):       records coll = 'jobs' lọc data->>customerId (wonAt, contractValue, code, title).
 * Kiểm phạm vi: đọc khách (coll 'customers') trước, inScope(scope, customer.dept, customer.amId).
 */
export const getRecentOrders: SkillTool<{ customer_id: string; limit?: number }> = {
  name: 'get_recent_orders', ...TOOL_SCHEMAS.get_recent_orders, draft: true,
  async handler() { return { error: 'not_implemented' }; },
};

/**
 * create_quote_draft  (GHI DỮ LIỆU — lõi bắt xác nhận)
 * Đọc giá: coll = 'skus' (basePrice / dealerPrice / projectPrice theo hạng khách: customers.tier), coll = 'customers'.
 * Ghi:     KHÔNG ghi vào coll 'quotes' (báo giá thật cần mã BG-YYYY-NNNN, phiên bản, duyệt GM%).
 *          Ghi vào coll MỚI 'aiQuoteDrafts' qua insertRecord(): { id, customerId, lines[{sku,name,unit,qty,listPrice,discountPct:0}], note, createdBy: me.appUserId, createdAt }
 *          => cần thêm 'aiQuoteDrafts' vào KEYED_COLLS của app và nút "Mở nháp từ AI" trong Báo giá thông minh.
 */
export const createQuoteDraft: SkillTool<{ customer_id: string; items: { sku: string; qty: number }[]; note?: string }> = {
  name: 'create_quote_draft', ...TOOL_SCHEMAS.create_quote_draft, draft: true,
  async handler() { return { error: 'not_implemented' }; },
};
