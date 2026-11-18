'use client';

import { type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Wallet } from 'lucide-react';
import { type Editor, type JSONContent } from '@tiptap/core';
import { createStudioStore, WS_TONES } from './core';
import { useDashData } from '../modules/dashboard/exec-dashboard';

// =====================================================================
//  TYPES
// =====================================================================

export type DeptCode = string;

export type Role = 'BOD' | 'MKT_LEAD' | 'DEPT_HEAD' | 'SALES_REP' | 'ACCOUNTANT';

export type Region = 'NORTH' | 'SOUTH';

export type GlobalFilter = { region: 'ALL' | Region; dept: string; brand: string };

/** Mã danh mục động — xem phần DANH MỤC CẤU HÌNH */
export type Segment = string;

export type Tier = string;

export type ProgramType = string;

export type PopType = string;

export type Source =
  | 'WEBSITE_FORM' | 'FACEBOOK_ADS' | 'GOOGLE_ADS' | 'ZALO_OA' | 'HOTLINE'
  | 'EXHIBITION' | 'TECH_SEMINAR' | 'REFERRAL' | 'VENDOR_REFERRAL';

/** NEW -> NURTURE | ROUTED (bước 1: MKT phân phòng) -> ASSIGNED (bước 2: TP chỉ định Sales, SLA 2h)
 *  -> ACCEPTED (khảo sát & lên báo giá, SLA 24h) -> QUOTED -> WON (Chốt đơn) | LOST (Trượt) */
export type LeadStatus = 'NEW' | 'NURTURE' | 'ROUTED' | 'ASSIGNED' | 'ACCEPTED' | 'QUOTED' | 'WON' | 'LOST';

export type LostReason = 'PRICE' | 'SCHEDULE' | 'TECHNICAL' | 'COMPETITOR';

export type ProgramStatus = 'PENDING_INTERNAL' | 'PENDING_VENDOR' | 'APPROVED' | 'CLAIMING' | 'CLOSED' | 'REJECTED' | 'CANCELLED';

export type Verification = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type Module = 'home' | 'contacts' | 'warehouse' | 'overview' | 'tasks' | 'leads' | 'customers' | 'jobs' | 'projects' | 'products' | 'supply' | 'claims' | 'production' | 'install' | 'inventory' | 'cashbook' | 'staff' | 'docs' | 'reports' | 'settings' | 'messages' | 'zalo' | 'marketing';

export type Action =
  | 'lead.create' | 'lead.route' | 'lead.assign' | 'lead.accept' | 'customer.edit' | 'docs.manage'
  | 'program.create' | 'program.approveInternal' | 'program.vendorDecision'
  | 'claim.uploadPop' | 'claim.verify' | 'claim.submit' | 'claim.accounting'
  | 'project.update' | 'price.request' | 'price.decide' | 'settings.edit'
  | 'mdf.margin' | 'po.manage' | 'stock.deliver' | 'stock.release'
  | 'price.viewCost' | 'contract.approve' | 'template.manage' | 'activity.approve'
  | 'quote.approve' | 'production.manage' | 'install.manage' | 'data.backup' | 'security.manage'
  | 'job.manage' | 'receipt.confirm' | 'priceList.manage' | 'stock.manage' | 'cash.manage' | 'feed.moderate' | 'feed.poll' | 'stock.voucher' | 'stock.approve' | 'zalo.reply' | 'zalo.assign' | 'mkt.manage';

export type Tone = 'muted' | 'orange' | 'teal' | 'red' | 'blue';

export type BoqStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';

export type FundCode = 'MDF' | 'CS';

/** Hình thức quyết toán với 3M: khoán theo hoạt động (giữ thặng dư) hoặc hoàn ứng theo chi phí thực tế (không giữ thặng dư) */
export type Settlement = 'LUMP_SUM' | 'ACTUAL_COST';

export type SurplusAllocation = 'COMPANY_PROFIT' | 'REINVEST';

/** Dòng đối soát 2 tầng: mức 3M duyệt cho hạng mục và chi phí thực trả nhà cung cấp */
export type CostLine = { id: string; item: string; supplier: string; approved: number; actual: number; invoiceNo?: string };

/** basePrice: giá bán lẻ; dealerPrice: giá đại lý; projectPrice: giá dự án M&E; costPrice: giá vốn nhập Hãng (chỉ TP / BOD xem) */
export type SkuItem = { sku: string; name: string; brand: string; category: string; unit: string; minStock: number; maxStock: number; leadTimeDays: number; stock: number; costPrice: number; basePrice: number; dealerPrice: number; projectPrice: number;
  /** v28: tồn tự do phân bổ ở các kho KHÔNG phải kho tổng; kho tổng = stock − tổng các kho khác (luôn khớp tổng cũ) */
  whStock?: Record<string, number>;
  /** v28: ngừng kinh doanh (ẩn khỏi danh mục, giữ lịch sử) */
  archived?: boolean;
  /** v28b: thông tin bổ sung (tùy chọn) */
  vatPct?: number; supplier?: string; origin?: string; image?: string;
  /** v29: tài liệu sản phẩm (catalogue, datasheet, CO/CQ) */
  docs?: ChatFile[] };

/** v28b: phiếu kho có duyệt (nhập / xuất / chuyển / kiểm kho) */
export type VoucherType = 'IN' | 'OUT' | 'TRANSFER' | 'COUNT';

export type VoucherStatus = 'PENDING' | 'DONE' | 'CANCELLED';

export type SvLine = { sku: string; qty: number; price?: number; system?: number; diff?: number };

export type StockVoucher = { id: string; code: string; type: VoucherType; status: VoucherStatus; date: string; whId: string; toWhId?: string; reason: string; partner?: string; ref?: string; note?: string; lines: SvLine[]; requestedBy?: string; approvedBy?: string; approvedAt?: number; cancelledBy?: string; cancelReason?: string; createdAt: number };

/** v28: danh mục kho (đa kho) */
export type WarehouseInfo = { id: string; code: string; name: string; address: string; managerId?: string; active: boolean; main?: boolean };

// ---------------- Bộ sinh báo giá & hợp đồng theo mẫu ----------------
export type TxType = 'DEALER' | 'PROJECT_ME' | 'SUPPLY_INSTALL' | 'RETAIL_CASH' | 'FACTORY' | 'EPC_SUB' | 'FRAMEWORK' | 'SAMPLE' | 'SERVICE' | 'TRADING';

export type PriceTier = 'BASE' | 'DEALER' | 'PROJECT' | 'BOQ';

export type DocTemplate = {
  id: string;
  kind: 'QUOTE' | 'CONTRACT';
  name: string;
  txType: TxType;
  /** Mẫu báo giá: mẫu hợp đồng đi kèm được gợi ý */
  pairId?: string;
  body: string;
  /** Mẫu hợp đồng: số ngày công nợ chuẩn; vượt mức này cần duyệt */
  standardCreditDays: number;
  defaultTier: PriceTier;
  defaultDelivery: string;
  system?: boolean;
  sourceFile?: { name: string; url: string };
  updatedAt: string;
};

/** price = đơn giá chốt; listPrice / discountPct để sửa chiết khấu trên màn soạn */
export type DocLine = { sku: string; name: string; unit: string; qty: number; price: number; listPrice?: number; discountPct?: number; /** v35: dòng do AI bóc tách từ ảnh / PDF */ ai?: boolean };

export type GuaranteeType = 'NONE' | 'PERFORMANCE' | 'ADVANCE' | 'WARRANTY';

export type ComposerForm = {
  txType: TxType;
  quoteTplId: string;
  contractTplId: string;
  tier: PriceTier;
  leadId?: string;
  customerId?: string;
  party: { name: string; taxCode: string; address: string; rep: string; repTitle: string; phone: string; email: string };
  items: DocLine[];
  vatPct: number;
  delivery: string;
  advancePct: number;
  guaranteeType: GuaranteeType;
  guaranteePct: number;
  warrantyMonths: number;
  creditDays: number;
  paymentMethod: string;
  validDays: number;
  note: string;
};

export type GenDocStatus = 'DRAFT' | 'ISSUED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';

export type GeneratedDoc = {
  id: string;
  quoteCode: string;
  contractCode: string;
  leadId?: string;
  customerId?: string;
  partyName: string;
  form: ComposerForm;
  total: number;
  /** Lý do cần duyệt (điều khoản công nợ đặc biệt...) */
  special: string[];
  status: GenDocStatus;
  /** Dấu vân tay nội dung lúc duyệt: sửa sau duyệt phải duyệt lại */
  fingerprint?: string;
  createdAt: string;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectNote?: string;
  quoteId?: string;
  submittedAt?: number;
  /** Nhóm phiên bản của cùng một hợp đồng và số phiên bản (v1, v2...) */
  groupId?: string;
  version?: number;
  exports: { kind: 'QUOTE' | 'CONTRACT'; format: 'PDF' | 'WORD'; at: string; by?: string }[];
};

export type ShipMode = 'SEA' | 'AIR' | 'ROAD';

export type ShipmentStatus = 'PLANNED' | 'IN_TRANSIT' | 'ARRIVED' | 'RECEIVED';

/** Giữ chỗ hàng cho dự án (lead) hoặc khách hàng; phần còn lại nhập tồn kho tự do */
export type PoAllocation = { kind: 'LEAD' | 'CUSTOMER'; refId: string; qty: number };

export type PoLine = { sku: string; qty: number; unitPrice: number; allocations: PoAllocation[] };

/** Phân bổ của một đợt được chốt lại tại thời điểm nhập kho (không tính lại về sau) */
export type AllocSnapshot = { sku: string; reserved: PoAllocation[]; free: number };

export type Shipment = { id: string; code: string; mode: ShipMode; docNo: string; etd?: string; eta: string; status: ShipmentStatus; receivedAt?: string; lines: { sku: string; qty: number }[]; allocSnapshot?: AllocSnapshot[] };

/**
 * Hàng giữ chỗ đang nằm trong kho cho một dự án / khách hàng.
 * HELD -> (xuất giao) DELIVERED | (dự án Trượt / yêu cầu trả) PENDING_RELEASE -> (TP/BOD xác nhận) RELEASED hoặc chuyển đích
 */
export type ReservationStatus = 'HELD' | 'PENDING_RELEASE' | 'DELIVERED' | 'RELEASED';

export type StockReservation = {
  id: string; sku: string; kind: PoAllocation['kind']; refId: string; qty: number; delivered: number;
  poId?: string; shipmentId?: string; receivedAt: string; status: ReservationStatus;
  releaseRequest?: { at: string; by?: string; reason: string };
};

export type StockMoveType = 'RECEIVE_FREE' | 'RECEIVE_RESERVED' | 'DELIVER' | 'RELEASE' | 'TRANSFER' | 'RESERVE_FROM_STOCK' | 'WH_TRANSFER' | 'ISSUE' | 'ADJUST';

export type StockMove = { id: string; at: string; sku: string; type: StockMoveType; qty: number; kind?: PoAllocation['kind']; refId?: string; poId?: string; by?: string; note: string; fromWh?: string; toWh?: string };

export type PoPurpose = 'PROJECT' | 'STOCK' | 'MIXED';

export type VendorPO = { id: string; code: string; vendor: string; orderDate: string; expectedDate: string; purpose: PoPurpose; note: string; lines: PoLine[]; shipments: Shipment[]; createdBy?: string; cancelled?: boolean };

export type QuoteStatus = 'SENT' | 'REVISED' | 'ACCEPTED' | 'REJECTED';

export type ApprovalLevel = 'AUTO' | 'HEAD' | 'BOD';

/** Trạng thái quan hệ khách hàng */
export type CustomerStatus = 'PROSPECT' | 'INTERESTED' | 'FOLLOW' | 'ACTIVE';

export type DateRange = { from: string; to: string };

export type Department = { code: DeptCode; name: string; short: string; slaMinutes: number; headId?: string; receivesLeads: boolean; active: boolean };

export type User = {
  id: string; name: string; email: string; phone?: string; role: Role; dept?: DeptCode; active: boolean; approvalLimit: number;
  /** v27: chức danh hiển thị ở Danh bạ, ngày sinh (YYYY-MM-DD) cho mục Sinh nhật trên Bàn làm việc; tùy chọn */
  title?: string; birthday?: string;
  /** v34: ảnh đại diện (JPEG nhỏ), chữ ký email / báo giá */
  avatar?: string; signature?: string;
  /** Mật khẩu băm PBKDF2-SHA256 (base64) + salt; chưa có thì dùng mật khẩu khởi tạo và băm ở lần đăng nhập đầu */
  passwordHash?: string;
  salt?: string;
  mustChangePassword?: boolean;
  failedAttempts?: number;
  lockedUntil?: number;
  lastLoginAt?: number;
  /** Lần thao tác gần nhất (nhịp 1 phút) để hiện trạng thái online / vắng / ngoại tuyến */
  lastActiveAt?: number;
  passwordChangedAt?: number;
};

export type PriceProtection = { status: 'REQUESTED' | 'APPROVED' | 'REJECTED'; discountPct: number; reason: string; ref?: string; validUntil?: string };

export type BoqItem = { code: string; name: string; unit: string; qty: number; price: number; discountPct: number };

export type Attachment = { name: string; url: string; size: number };

export type Lead = {
  id: string;
  code: string;
  company: string;
  contact: string;
  phone: string;
  taxCode?: string;
  email?: string;
  segment: Segment;
  source: Source;
  region: Region;
  /** Tỉnh / thành phố */
  province?: string;
  /** Giá trị ước tính MKT nhập khi tạo lead; khi đã bóc tách thì lấy tổng các dòng BOQ */
  boqValue: number;
  boqNote: string;
  hasBoqFile: boolean;
  boqFile?: { name: string; url: string };
  attachments?: Attachment[];
  boqStatus?: BoqStatus;
  boqItems?: BoqItem[];
  priceProtection?: PriceProtection;
  getflySync?: { status: 'QUEUED' | 'PENDING' | 'SYNCED' | 'FAILED'; orderCode?: string; accountCode?: string; error?: string; at?: number; quoteId?: string; payload?: GetflyOrderPayload };
  /** Phiên bản báo giá khách chấp nhận khi chốt đơn — nguồn duy nhất cho đơn Getfly */
  wonQuoteId?: string;
  /** Ngày chốt đơn và doanh số ghi nhận (trước VAT) */
  wonAt?: string;
  wonAmount?: number;
  receivedDaysAgo: number;
  status: LeadStatus;
  lostReason?: LostReason;
  lostNote?: string;
  routedAt?: number;
  quoteDeadline?: number;
  quoteEscalated?: boolean;
  slaAlerted?: boolean;
  score?: number;
  dept?: DeptCode;
  assignee?: string;
  routingReason?: string;
  slaDeadline?: number;
  slaMet?: boolean;
  customerId?: string;
  /** Đơn hàng công trình tạo từ lead (mô hình sản xuất) */
  jobId?: string;
};

export type Customer = {
  id: string;
  code: string;
  name: string;
  taxCode: string;
  segment: Segment;
  tier: Tier;
  region: Region;
  dept: DeptCode;
  amId?: string;
  /** Nguồn khách hàng — danh mục động, có cờ isMarketing để tính ROI Marketing */
  sourceId: string;
  status: CustomerStatus;
  /** Ngày trở thành khách hàng (ISO) */
  createdAt: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  creditLimit: number;
  debt: number;
  ytdRevenue: number;
  lastYearRevenue: number;
  getflyAccountId?: number;
  getflyAccountCode?: string;
  baseline?: { revenue: number; debt: number };
};

/** Dòng báo giá: giá niêm yết theo bảng giá, chiết khấu dòng, đơn giá chốt = niêm yết x (1 - CK) */
export type QuoteLine = { sku: string; name: string; unit: string; qty: number; listPrice: number; discountPct: number };

/** Payload tạo đơn Getfly API v3 (giống server action syncWonProjectToGetfly) */
export type GetflyOrderPayload = {
  order_info: { account_code: string; account_name: string; account_phone?: string; order_date: string; discount: number; discount_amount: number; vat: number; vat_amount: number; amount: number; source_name: string };
  products: { product_code: string; product_name: string; quantity: number; price: number; product_sale_off: number; cash_discount: number }[];
  terms: string[];
};

export type Quote = {
  id: string;
  code: string;
  leadId: string;
  version: number;
  date: string; // ISO
  /** Cộng tiền hàng trước VAT — luôn tính từ lines, không nhập tay */
  amount: number;
  lines: QuoteLine[];
  vatPct: number;
  tier?: PriceTier;
  /** Mẫu báo giá dùng khi tạo / xuất */
  templateId?: string;
  /** Báo giá cho khách không gắn dự án */
  customerId?: string;
  /** Toàn bộ nội dung đã soạn (pháp nhân, điều khoản) để mở lại / xuất lại đúng bản đã lưu */
  quoteForm?: ComposerForm;
  exports?: { format: 'PDF' | 'WORD'; at: string; by?: string }[];
  /** Biên lợi nhuận gộp và thẩm quyền duyệt theo GM% */
  gmPct?: number;
  approvalLevel?: ApprovalLevel;
  /** Yêu cầu duyệt giá (khi GM thấp / đơn lớn); xuất PDF chỉ khi đã duyệt */
  approval?: QuoteApproval;
  createdBy?: string;
  createdAt?: number;
  discountPct: number;
  validUntil: string;
  status: QuoteStatus;
  note: string;
  file?: { name: string; url: string };
};

export type GetflyOrderRec = {
  orderId: number;
  orderCode: string;
  customerId: string;
  orderDate: string;
  gross: number;
  vat: number;
  net: number;
  paid: number;
  approved: boolean;
  source: 'MDF_APP' | 'GETFLY';
  leadCode?: string;
  lines: number;
  products?: { code: string; name: string; qty: number; price: number }[];
};

export type GetflyConfig = {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
  taxCodeField: string;
  defaultVatPct: number;
  isActive: boolean;
  /** Mô phỏng: không gọi Getfly thật, dùng để thử luồng */
  demoMode?: boolean;
  lastTest?: { at: number; ok: boolean; message: string };
  lastFullSyncAt?: number;
};

export type GetflyLog = { id: string; at: number; direction: 'OUT' | 'IN'; title: string; ok: boolean; detail: string };

/**
 * Ngân sách Hãng theo từng năm tài chính (lưu lịch sử nhiều năm).
 * spent / committed hiển thị được tính lại từ chương trình & claim của năm đó (+ openingSpent nhập tay cho năm cũ).
 */
export type Budget = {
  /** Phân bổ theo hạng mục của năm này; thiếu thì lấy số mặc định của hạng mục */
  allocations?: Record<string, number>;
  /** Số đã tiêu ghi nhận ngoài hệ thống (năm trước khi dùng app) */
  openingSpent?: number;
  note?: string;
  /** false = năm chưa khai báo ngân sách (bản ghi tạm để giao diện không lỗi) */
  declared?: boolean;
  vendor: string;
  vendorCode: string;
  fiscalYear: number;
  mdfTotal: number;
  csTotal: number;
  total: number;
  spent: number;
  committed: number;
  periodStart: string;
  periodEnd: string;
};

export type ClaimRules = { minPhotos: number; requireWatermark: boolean; gpsBlocking: boolean };

export type Policy = { claimWindowDays: number; rules: ClaimRules };

/** Nhóm khách hàng (phân loại đại lý / nhà thầu) */
export type SegmentDef = { code: string; name: string; deptNorth: DeptCode; deptSouth: DeptCode; mdfEligible: boolean; points: number; system?: boolean };

export type SegmentRules = Record<Segment, SegmentDef>;

export type TierRule = { tier: Tier; name: string; minRevenue: number; mdfCap: number; tone: Tone };

/** Hạng mục ngân sách Hãng: số tiền phân bổ + chứng từ bắt buộc khi claim */
export type BudgetCategory = { code: string; name: string; fund: FundCode; amount: number; color: string; required: PopType[]; settlement: Settlement };

export type PopDocDef = { code: string; name: string; system?: boolean };

export type CustomerSource = { id: string; name: string; isMarketing: boolean };

/** Ngân sách Marketing nội bộ VASSH — tách riêng, không thuộc quỹ Hãng */
export type MktItem = { id: string; name: string; source: Source | ''; planned: number; spent: number };

// ---------------- Lịch công tác / hoạt động nhân sự ----------------
export type ActivityType = 'MEETING' | 'SURVEY' | 'TRIP' | 'LEAVE' | 'TRAINING' | 'EVENT' | 'OTHER';

export type ActivityStatus = 'PLANNED' | 'PENDING_APPROVAL' | 'NEED_INFO' | 'APPROVED' | 'REJECTED' | 'DONE' | 'CANCELLED';

/** Nghỉ / giải trình chấm công */
export type LeaveKind = 'LEAVE' | 'LATE' | 'EARLY' | 'NO_CHECKIN';

export type ExpenseStatus = 'SUBMITTED' | 'HEAD_APPROVED' | 'PAID' | 'REJECTED';

export type ActivityExpense = { id: string; name: string; amount: number; fileName: string; url: string };

export type ActivityCheckin = { at: string; lat: number; lng: number; accuracy?: number; simulated?: boolean; lateMinutes: number; photos: { name: string; url: string }[] };

export type Activity = {
  id: string;
  userId: string;
  type: ActivityType;
  title: string;
  from: string; // yyyy-mm-ddThh:mm
  to: string;
  location: string;
  customerId?: string;
  leadId?: string;
  programId?: string;
  /** Chi phí dự kiến */
  cost: number;
  /** Mục tiêu / ghi chú (với nghỉ: lý do cá nhân) */
  note: string;
  result?: string;
  nextAction?: string;
  status: ActivityStatus;
  approvedBy?: string;
  rejectNote?: string;
  /** Nội dung Trưởng phòng yêu cầu bổ sung */
  requestNote?: string;
  // Công tác ngoại tỉnh
  transport?: string;
  lodging?: string;
  advance?: number;
  // Nghỉ / giải trình
  leaveKind?: LeaveKind;
  checkin?: ActivityCheckin;
  expenses?: ActivityExpense[];
  expenseStatus?: ExpenseStatus;
  expenseNote?: string;
  /** Thời điểm gửi duyệt (tính SLA) */
  submittedAt?: number;
  expenseSubmittedAt?: number;
  createdAt: string;
  createdBy?: string;
};

/** Gói phân hệ theo mô hình kinh doanh: thương mại – phân phối, sản xuất – lắp đặt, hoặc dùng tất cả */
export type BusinessProfile = 'TRADING' | 'MANUFACTURING' | 'ALL' | 'CUSTOM';

export type CompanyInfo = { appName: string; legalName: string; shortName: string; taxCode: string; address: string; phone: string; email: string; website: string; logo?: string; representative: string; representativeTitle: string; bankAccount: string; bankName: string; stamp?: string; profile?: BusinessProfile; enabledModules?: Partial<Record<Module, boolean>> };

// ---------------- Trung tâm phê duyệt ----------------
export type ApprovalKind = 'QUOTE' | 'CONTRACT' | 'ACTIVITY' | 'EXPENSE' | 'PROGRAM' | 'CLAIM' | 'LEAD_ASSIGN' | 'STOCK' | 'RECEIPT' | 'CASH' | 'CONTENT';

export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'NEED_INFO';

/** Duyệt giá báo giá theo GM% / giá trị đơn */
export type QuoteApproval = { status: 'PENDING' | ApprovalDecision; level: 'HEAD' | 'BOD'; reasons: string[]; requestedAt: number; requestedBy?: string; decidedBy?: string; decidedAt?: number; note?: string };

/** Nhật ký quyết định (lịch sử đã xử lý) */
export type ApprovalLog = { id: string; kind: ApprovalKind; refId: string; title: string; requesterId?: string; deciderId: string; decision: ApprovalDecision; note?: string; at: number; amount?: number };

/** Nhật ký bảo mật & thao tác nhạy cảm */
export type AuditLevel = 'INFO' | 'WARN' | 'SECURITY';

export type AuditLog = { id: string; at: number; userId?: string; action: string; detail: string; level: AuditLevel };

export type SecurityPolicy = { minPasswordLength: number; lockoutAttempts: number; lockoutMinutes: number; idleMinutes: number; sessionDays: number; roleSwitch: boolean; forceChangeDefault: boolean };

// ---------------- Sản xuất (xưởng nội thất / nhôm kính) ----------------
/** Lệnh sản xuất rút gọn 3 trạng thái */
export type WoStage = 'WAITING' | 'IN_PROGRESS' | 'DONE';

export type WoItem = { id: string; name: string; spec: string; unit: string; qty: number; done: number };

export type WoMaterial = { id: string; name: string; unit: string; required: number; issued: number };

export type QcCheck = { key: string; label: string; passed?: boolean; note?: string };

export type WorkOrder = {
  id: string; code: string; title: string; leadId?: string; customerId?: string; contractId?: string; jobId?: string;
  stage: WoStage; priority: 'NORMAL' | 'URGENT'; startDate: string; dueDate: string; leaderId?: string;
  items: WoItem[]; materials: WoMaterial[]; qc: QcCheck[]; note: string;
  history: { stage: WoStage; at: number; by?: string; note?: string }[];
  createdAt: string; createdBy?: string; startedAt?: number; doneAt?: number;
  /** v26: bước thiết kế / bản vẽ triển khai trước khi cắt; tùy chọn, dữ liệu cũ không có vẫn hợp lệ */
  design?: { status: DesignStatus; by?: string; at?: number; note?: string };
};

export type DesignStatus = 'DRAFTING' | 'REVIEW' | 'APPROVED';

// ---------------- Đơn hàng công trình (mô hình xưởng sản xuất – lắp đặt) ----------------
/** Đơn vị tính bảng đơn giá: m² (rộng × cao), mét dài, bộ, cái */
export type PriceUnit = 'M2' | 'MD' | 'SET' | 'PCS';

export type PriceItem = { id: string; code: string; name: string; category: string; unit: PriceUnit; price: number; cost: number; minMeasure?: number; note?: string; active: boolean };

/** Dòng khảo sát / báo giá: kích thước mm, chiều dài m */
export type JobLine = { id: string; priceItemId?: string; name: string; location: string; unit: PriceUnit; width: number; height: number; length: number; qty: number; unitPrice: number; unitCost: number; discountPct: number; note?: string };

export type JobQuote = { id: string; version: number; at: string; by?: string; lines: JobLine[]; subtotal: number; vatPct: number; total: number; cost: number; note?: string };

/** Đợt thanh toán: mốc kích hoạt khi chốt (cọc), khi giao / lắp đặt, khi nghiệm thu */
export type PayTrigger = 'SIGN' | 'DELIVERY' | 'ACCEPT';

export type PayStage = { id: string; label: string; pct: number; trigger: PayTrigger };

export type JobLostReason = 'PRICE' | 'COMPETITOR' | 'POSTPONED' | 'NO_RESPONSE' | 'OTHER';

export type JobFile = { id: string; name: string; url: string; kind: 'DRAWING' | 'PHOTO'; at: string; by?: string };

export type Job = {
  id: string; code: string; title: string; customerId: string; leadId?: string; ownerId?: string; dept?: DeptCode;
  siteAddress: string; siteContact?: string; sitePhone?: string;
  /** Bản nháp đang khảo sát; mỗi lần "Lưu báo giá" chụp thành 1 phiên bản */
  draft: JobLine[]; vatPct: number; quotes: JobQuote[]; files: JobFile[];
  surveyCheckins: { at: string; lat: number; lng: number; simulated?: boolean; by?: string }[];
  schedule: PayStage[];
  wonAt?: string; wonVersion?: number; contractValue?: number;
  lostAt?: string; lostReason?: JobLostReason; lostNote?: string;
  warrantyMonths: number; note: string; createdAt: string; createdBy?: string;
  /** Thời gian hẹn khảo sát (yyyy-MM-ddTHH:mm) */
  appointmentAt?: string;
  /** Nhật ký chăm sóc khi báo giá chưa chốt hoặc đã trượt */
  care?: JobCare[];
  commission?: JobCommission;
};

export type JobCare = { id: string; at: number; by?: string; note: string; nextAt?: string };

/** Phiếu thu: tiền mặt đang giữ -> đã nộp -> kế toán xác nhận (mới ghi nhận doanh số) */
export type ReceiptStatus = 'HOLDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';

export type Receipt = {
  id: string; code: string; jobId: string; stageId?: string; amount: number; method: 'CASH' | 'TRANSFER';
  collectedBy: string; collectedAt: number; photo?: string; note?: string;
  status: ReceiptStatus; submittedAt?: number; confirmedBy?: string; confirmedAt?: number; rejectNote?: string;
};

export type MfgConfig = { schedule: PayStage[]; vatPct: number; quoteValidDays: number; warrantyMonths: number; submitHours: number; productionDays: number; openingCash: number; openingBank: number; creditDays: number; dueDays: number; salesCommissionPct: number; installCommissionPct: number; agingScheme?: AgingScheme };

/** Cách phân nhóm tuổi nợ: theo tuổi chứng từ (<30 / 31–60 / >60 ngày) hoặc theo số ngày quá hạn (1–15 / 16–30 / >30) */
export type AgingScheme = 'AGE_30_60' | 'OVERDUE_15_30';

// ---------------- Kho vật tư: nhập xuất tồn ----------------
export type StockItem = { id: string; code: string; name: string; category: string; unit: string; minStock: number; cost: number; active: boolean; note?: string };

/** IN nhập kho, OUT xuất kho (cho lệnh sản xuất / đơn hàng), ADJUST kiểm kê (+/-) */
export type InvMoveType = 'IN' | 'OUT' | 'ADJUST';

export type InvMove = { id: string; code: string; type: InvMoveType; date: string; itemId: string; qty: number; unitCost: number; partner?: string; jobId?: string; woId?: string; note?: string; by?: string; at: number };

// ---------------- Thu chi ----------------
export type CashAccount = 'CASH' | 'BANK';

/** Phiếu thu / chi / chuyển quỹ (tiền thu khách đã xác nhận lấy tự động từ phiếu thu đơn hàng) */
export type CashSource = 'MANUAL' | 'RECEIPT' | 'EXPENSE' | 'ADVANCE' | 'STOCK' | 'MDF_SURPLUS' | 'COMMISSION';

export type CashEntry = {
  id: string; code: string; kind: 'IN' | 'OUT' | 'TRANSFER'; date: string; account: CashAccount; toAccount?: CashAccount; category: string; amount: number;
  partner?: string; jobId?: string; ref?: string; note?: string; by?: string; at: number;
  /** Phiếu tự sinh: nguồn nghiệp vụ và mã bản ghi gốc (chống sinh trùng) */
  source?: CashSource; sourceId?: string; claimId?: string;
};

/** Hoa hồng đã quyết toán của 1 đơn (chỉ khi kế toán đã xác nhận thu đủ 100%) */
export type JobCommission = { paidAt: number; by: string; base: number; lines: { userId: string; role: 'SALES' | 'INSTALL'; amount: number }[] };

/** Doanh nghiệp dùng chung hệ thống, dữ liệu tách riêng */
export type Org = { id: string; name: string; shortName: string; domain: string; profile: BusinessProfile; color: string };

// ---------------- Lắp đặt & nghiệm thu ----------------
export type InstallStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'ACCEPTED';

export type InstallDefect = { id: string; text: string; fixed: boolean; at: number };

/** Biên bản nghiệm thu, bàn giao, thanh toán & bảo hành, ký điện tử 2 bên */
export type InstallAcceptance = {
  at: string; customerRep: string; customerTitle: string; customerPhone?: string; result: 'PASS' | 'PASS_WITH_NOTES'; note: string; by?: string;
  docCode?: string; checked?: string[]; customerSign?: string; staffSign?: string; signedAt?: number; hash?: string;
  paidAmount?: number; paidMethod?: 'CASH' | 'TRANSFER'; receiptId?: string; debtAfter?: number; warrantyMonths?: number; warrantyUntil?: string;
};

export type InstallJob = {
  id: string; code: string; title: string; workOrderId?: string; leadId?: string; customerId?: string; jobId?: string;
  address: string; leaderId?: string; team: string[]; from: string; to: string; status: InstallStatus;
  checkins: { at: string; lat: number; lng: number; simulated?: boolean; photos: { name: string; url: string }[] }[];
  defects: InstallDefect[];
  acceptance?: InstallAcceptance;
  note: string; createdAt: string;
};

export type Program = {
  id: string;
  /** Mã đề xuất nội bộ, hệ thống tự sinh khi lập */
  code: string;
  /** Mã Pre-Approval do 3M cấp — nhập khi ghi nhận Hãng duyệt */
  preApprovalId?: string;
  title: string;
  type: ProgramType;
  customerId?: string;
  dept: DeptCode;
  requested: number;
  sharePct: number;
  held: number;
  start: string;
  end: string;
  expectedLeads?: number;
  status: ProgramStatus;
  requestedBy?: string;
  requestedAt?: number;
  approvedBy?: string;
  vendorApprovedAt?: string;
  claimId?: string;
};

export type Proof = {
  id: string;
  type: PopType;
  name: string;
  verification: Verification;
  watermark?: boolean;
  inWindow?: boolean;
  gps?: string;
  capturedAt?: string;
  attendeeCount?: number;
  duplicateOf?: string;
  hue?: number;
  url?: string;
  size?: number;
  checksum?: string;
  uploaded?: boolean;
};

export type Claim = {
  id: string;
  code: string;
  preApprovalId: string;
  preApprovalApproved: boolean;
  programId?: string;
  programTitle: string;
  programType: ProgramType;
  customerId?: string;
  dept: DeptCode;
  period: string;
  expectedAttendees?: number;
  claimed: number;
  cap: number;
  invoice: { serial: string; number: string; date: string; supplierTax: string; amount: number } | null;
  daysLeft: number;
  submitted: boolean;
  vatCheck?: 'MATCHED' | 'MISMATCH';
  vatNote?: string;
  vendorApproved?: number;
  creditNote?: { number: string; date: string; amount: number };
  offset?: boolean;
  /** Chi phí thực tế triển khai — tổng costLines nếu có, không thì dùng actualCost */
  actualCost?: number;
  costLines?: CostLine[];
  /** Phân bổ thặng dư (chỉ với hạng mục khoán theo hoạt động) */
  surplusAllocation?: SurplusAllocation;
  /** Credit Note cấn trừ vào PO nhập khẩu nào */
  offsetPoId?: string;
  /** Phiếu thu nội bộ đã hạch toán thặng dư quỹ */
  surplusEntryId?: string;
  proofs: Proof[];
};

export type Check = { key: string; label: string; severity: 'BLOCKER' | 'WARNING'; passed: boolean; detail: string };

export type Perms = { modules: Record<Role, Record<Module, boolean>>; actions: Record<Action, Role[]>; /** v34: phạm vi dữ liệu theo vai trò, ngoại lệ từng tài khoản */ scope?: Partial<Record<Role, DataScope>>; users?: Record<string, UserPerm> };

export type Catalog = { segments: SegmentDef[]; tiers: TierRule[]; categories: BudgetCategory[]; popDocs: PopDocDef[]; sources: CustomerSource[] };

export type XlsxSheet = { name: string; rows: (string | number | null | undefined)[][]; widths?: number[] };

// =====================================================================
//  APP CONTEXT
// =====================================================================

/** Toast chuẩn: 3 sắc thái + hành động kèm theo (vd. Hoàn tác) */
export type ToastT = { msg: string; tone: 'teal' | 'orange' | 'red'; action?: { label: string; run: () => void }; id?: number };

export type CashDraft = Omit<CashEntry, 'id' | 'code' | 'at' | 'by' | 'date'> & { date?: string; by?: string };

export type AppCtx = {
  /** Ghi phiếu thu / chi vào sổ quỹ (phiếu tự sinh có source + sourceId thì không ghi trùng) */
  postCash: (e: CashDraft) => void;
  /** Nền tảng 3A Group: tài khoản quản trị tối cao, chuyển nhanh doanh nghiệp */
  platform: {
    userId: string | null; admins: User[]; setAdmins: Dispatch<SetStateAction<User[]>>; switchTenant: (org: string) => void;
    tenants: TenantReg[]; setTenantReg: (id: string, patch: Partial<TenantReg>, logDetail?: string) => void; logs: PlatformLog[];
    consoleView: boolean; openConsole: (tab?: ConsoleTab) => void; consoleTab: ConsoleTab; setConsoleTab: (t: ConsoleTab) => void;
    runMigration: (org: string) => void; backupTenant: (org: string, pass: string) => Promise<void>; restoreTenantSnapshot: (org: string, key: string) => void;
    log: (action: string, detail: string, tenant?: string) => void;
  };
  me: User;
  role: Role;
  loginAt: number | null;
  switchRole: (r: Role) => void;
  logout: () => void;
  now: number | null;
  leads: Lead[];
  setLeads: Dispatch<SetStateAction<Lead[]>>;
  customers: Customer[];
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  departments: Department[];
  setDepartments: Dispatch<SetStateAction<Department[]>>;
  /** Ngân sách của năm tài chính đang xem (spent / committed đã tính lại từ dữ liệu) */
  budget: Budget;
  budgets: Budget[];
  setBudgets: Dispatch<SetStateAction<Budget[]>>;
  /** Đổi năm tài chính đang xem: quỹ, phân bổ, khoảng ngày lọc chuyển theo */
  setFiscalYear: (fy: number) => void;
  activities: Activity[];
  setActivities: Dispatch<SetStateAction<Activity[]>>;
  setBudget: Dispatch<SetStateAction<Budget>>;
  policy: Policy;
  setPolicy: Dispatch<SetStateAction<Policy>>;
  programs: Program[];
  setPrograms: Dispatch<SetStateAction<Program[]>>;
  claims: Claim[];
  setClaims: Dispatch<SetStateAction<Claim[]>>;
  perms: Perms;
  setPerms: Dispatch<SetStateAction<Perms>>;
  /** Lookup nhóm khách theo mã (suy ra từ segments) */
  segRules: SegmentRules;
  segments: SegmentDef[];
  setSegments: Dispatch<SetStateAction<SegmentDef[]>>;
  categories: BudgetCategory[];
  setCategories: Dispatch<SetStateAction<BudgetCategory[]>>;
  popDocs: PopDocDef[];
  setPopDocs: Dispatch<SetStateAction<PopDocDef[]>>;
  sources: CustomerSource[];
  setSources: Dispatch<SetStateAction<CustomerSource[]>>;
  mktItems: MktItem[];
  setMktItems: Dispatch<SetStateAction<MktItem[]>>;
  company: CompanyInfo;
  setCompany: Dispatch<SetStateAction<CompanyInfo>>;
  quotes: Quote[];
  setQuotes: Dispatch<SetStateAction<Quote[]>>;
  /** Lead theo phạm vi vai trò: BOD & Marketing thấy hết, Trưởng phòng thấy phòng mình, Sales thấy lead được giao */
  myLeads: Lead[];
  /** Bộ lọc ngữ cảnh toàn cục (cột trái): áp lên mọi danh sách lead / khách hàng / đơn xưởng đang hiển thị */
  gf: GlobalFilter;
  setGf: (f: GlobalFilter) => void;
  /** Khách hàng trong phạm vi: Sales chỉ thấy khách mình phụ trách, Trưởng phòng thấy khách của phòng */
  myCustomers: Customer[];
  skus: SkuItem[];
  setSkus: Dispatch<SetStateAction<SkuItem[]>>;
  warehouses: WarehouseInfo[];
  setWarehouses: Dispatch<SetStateAction<WarehouseInfo[]>>;
  stockVouchers: StockVoucher[];
  setStockVouchers: Dispatch<SetStateAction<StockVoucher[]>>;
  // ---- v32: Zalo Hub, Marketing Hub, AI ----
  zaloConvs: ZaloConv[];
  setZaloConvs: Dispatch<SetStateAction<ZaloConv[]>>;
  zaloMsgs: ZaloMsg[];
  setZaloMsgs: Dispatch<SetStateAction<ZaloMsg[]>>;
  campaigns: Campaign[];
  setCampaigns: Dispatch<SetStateAction<Campaign[]>>;
  contents: MktContent[];
  setContents: Dispatch<SetStateAction<MktContent[]>>;
  banners: BannerSpec[];
  setBanners: Dispatch<SetStateAction<BannerSpec[]>>;
  audiences: Audience[];
  setAudiences: Dispatch<SetStateAction<Audience[]>>;
  automations: Automation[];
  setAutomations: Dispatch<SetStateAction<Automation[]>>;
  autoRuns: AutoRun[];
  setAutoRuns: Dispatch<SetStateAction<AutoRun[]>>;
  kb: KbItem[];
  setKb: Dispatch<SetStateAction<KbItem[]>>;
  mktTasks: MktTask[];
  setMktTasks: Dispatch<SetStateAction<MktTask[]>>;
  briefs: Brief[];
  setBriefs: Dispatch<SetStateAction<Brief[]>>;
  draftProducts: DraftProduct[];
  setDraftProducts: Dispatch<SetStateAction<DraftProduct[]>>;
  socialPosts: SocialPost[];
  /** v37: chỉ tiêu KPI tháng (phòng ban, nhân viên) và ngưỡng đánh giá */
  kpiTargets: KpiTarget[];
  setKpiTargets: Dispatch<SetStateAction<KpiTarget[]>>;
  /** v38: lịch sử phiên bản nội dung (tối đa 20 mốc / bài) và hạn mức AI theo người */
  contentVersions: ContentVersion[];
  setContentVersions: Dispatch<SetStateAction<ContentVersion[]>>;
  /** v38.6: thư viện ảnh marketing (tab Image), tối đa 200 ảnh / doanh nghiệp */
  mktImages: MktImage[];
  setMktImages: Dispatch<SetStateAction<MktImage[]>>;
  aiQuota: AiQuotaCfg;
  setAiQuota: Dispatch<SetStateAction<AiQuotaCfg>>;
  setSocialPosts: Dispatch<SetStateAction<SocialPost[]>>;
  hubCfg: HubCfg;
  setHubCfg: Dispatch<SetStateAction<HubCfg>>;
  /** Tin nhắn của Trợ lý AI trong chat (tác giả 'ai-bot') */
  addBotComment: (c: Omit<RowComment, 'id' | 'at' | 'authorId'>) => void;
  pos: VendorPO[];
  setPos: Dispatch<SetStateAction<VendorPO[]>>;
  // ---- Kho: tồn tự do / hàng giữ chỗ ----
  reservations: StockReservation[];
  moves: StockMove[];
  addMoves: (m: Omit<StockMove, 'id'>[]) => void;
  receiveShipment: (poId: string, shipmentId: string) => void;
  deliverReservation: (id: string, qty: number, note: string) => void;
  requestRelease: (id: string, reason: string) => void;
  decideRelease: (id: string, decision: 'RELEASE' | 'KEEP' | 'TRANSFER', note: string, target?: { kind: PoAllocation['kind']; refId: string }) => void;
  reserveFromStock: (sku: string, kind: PoAllocation['kind'], refId: string, qty: number, note: string) => void;
  /** Trưởng phòng của phòng phụ trách đích giữ chỗ, hoặc Giám đốc */
  canRelease: (r: StockReservation) => boolean;
  reopenLead: (id: string) => void;
  // ---- Mẫu & văn bản báo giá / hợp đồng ----
  docTemplates: DocTemplate[];
  setDocTemplates: Dispatch<SetStateAction<DocTemplate[]>>;
  genDocs: GeneratedDoc[];
  setGenDocs: Dispatch<SetStateAction<GeneratedDoc[]>>;
  /** Màn soạn báo giá & hợp đồng: quoteId để sửa một báo giá, focus để mở sẵn tab xem trước */
  /** view = chỉ xem bản đã lưu; không có view với docId = tạo phiên bản mới từ bản đó */
  openComposer: (o: { leadId?: string; customerId?: string; docId?: string; quoteId?: string; mode?: 'QUOTE' | 'CONTRACT'; view?: boolean }) => void;
  /** Khoảng thời gian lọc toàn cục */
  range: DateRange;
  setRange: (r: DateRange) => void;
  openLeadForm: (asProject?: boolean, id?: string) => void;
  openPalette: () => void;
  /** Mở cột phải: hỏi trợ lý AI (thống kê trong app) hoặc chat nhanh */
  askAi: (q?: string) => void;
  openHub: (t: 'chat' | 'ai') => void;
  tierRules: TierRule[];
  setTierRules: Dispatch<SetStateAction<TierRule[]>>;
  notify: (msg: string, tone?: ToastT['tone'], action?: ToastT['action']) => void;
  go: (m: Module, query?: string) => void;
  /** Lệnh mở form tạo mới từ Spotlight (vd. 'po.create'); phân hệ đọc bằng useIntent */
  intent: string | null;
  setIntent: (v: string | null) => void;
  presetQuery: string;
  openClaim: (id: string) => void;
  openCustomer: (id: string) => void;
  openProgramForm: (customerId?: string, programId?: string) => void;
  openCustomerForm: (id?: string) => void;
  canSee: (m: Module) => boolean;
  /** Phân hệ được bật cho doanh nghiệp (gói Thương mại / Sản xuất) */
  moduleOn: (m: Module) => boolean;
  // ---- Trung tâm phê duyệt ----
  approvalLogs: ApprovalLog[];
  logDecision: (e: Omit<ApprovalLog, 'id' | 'at' | 'deciderId'>) => void;
  // ---- Bảo mật & dữ liệu ----
  auditLogs: AuditLog[];
  audit: (action: string, detail: string, level?: AuditLevel) => void;
  security: SecurityPolicy;
  setSecurity: Dispatch<SetStateAction<SecurityPolicy>>;
  dataInfo: { version: number; savedAt: number | null; bytes: number; snapshots: { key: string; version: number; at: number }[] };
  exportData: () => Record<string, unknown>;
  importData: (data: Record<string, unknown>, fromVersion: number) => void;
  restoreSnapshot: (key: string) => void;
  // ---- Sản xuất & lắp đặt ----
  org: Org;
  jobs: Job[];
  setJobs: Dispatch<SetStateAction<Job[]>>;
  receipts: Receipt[];
  setReceipts: Dispatch<SetStateAction<Receipt[]>>;
  stockItems: StockItem[];
  setStockItems: Dispatch<SetStateAction<StockItem[]>>;
  stockMoves: InvMove[];
  setStockMoves: Dispatch<SetStateAction<InvMove[]>>;
  cashEntries: CashEntry[];
  setCashEntries: Dispatch<SetStateAction<CashEntry[]>>;
  priceItems: PriceItem[];
  setPriceItems: Dispatch<SetStateAction<PriceItem[]>>;
  mfgConfig: MfgConfig;
  setMfgConfig: Dispatch<SetStateAction<MfgConfig>>;
  /** Mở đơn hàng công trình (ngăn chi tiết) */
  openJob: (id: string | null) => void;
  workOrders: WorkOrder[];
  setWorkOrders: Dispatch<SetStateAction<WorkOrder[]>>;
  installJobs: InstallJob[];
  setInstallJobs: Dispatch<SetStateAction<InstallJob[]>>;
  canDo: (a: Action) => boolean;
  userName: (id?: string) => string;
  dept: (code?: DeptCode) => Department | undefined;
  routableDepts: Department[];
  /** MKT phân lead về phòng ban (thủ công, không còn phân tự động) */
  routeLeads: (ids: string[], dept: DeptCode, base?: Lead[]) => void;
  getflyOrders: GetflyOrderRec[];
  setGetflyOrders: Dispatch<SetStateAction<GetflyOrderRec[]>>;
  getfly: GetflyConfig;
  setGetfly: Dispatch<SetStateAction<GetflyConfig>>;
  getflyLogs: GetflyLog[];
  addGetflyLog: (l: Omit<GetflyLog, 'id' | 'at'>) => void;
  winLead: (id: string, quoteId: string) => void;
  /** Mở hộp chọn phiên bản báo giá để chốt đơn */
  openWin: (leadId: string) => void;
  syncLeadToGetfly: (leadId: string) => void;
  recomputeLinked: (orders: GetflyOrderRec[], customerIds?: string[]) => void;
  // ---- Phân lead 2 bước, báo giá, Chốt đơn / Trượt ----
  assignLead: (leadId: string, repId: string) => void;
  submitQuote: (leadId: string) => void;
  markLost: (leadId: string, reason: LostReason, note: string) => void;
  // ---- Thông báo đa kênh ----
  notices: Notice[];
  markNoticeRead: (id?: string) => void;
  ringKey: number;
  dispatch: (event: NotifyEvent, p: { lead?: Lead; title?: string; body?: string; module?: Module; to?: User; toAll?: User[] }) => string[];
  msgLogs: MsgLog[];
  addMsgLog: (l: Omit<MsgLog, 'id' | 'at'>) => void;
  emailCfg: EmailConfig;
  setEmailCfg: Dispatch<SetStateAction<EmailConfig>>;
  zns: ZnsConfig;
  setZns: Dispatch<SetStateAction<ZnsConfig>>;
  notifyRules: Record<NotifyEvent, Channel[]>;
  setNotifyRules: Dispatch<SetStateAction<Record<NotifyEvent, Channel[]>>>;
  // ---- Tài liệu ----
  docs: DocItem[];
  /** Bình luận / @mention theo dòng */
  comments: RowComment[];
  patchComment: (id: string, fn: (c: RowComment) => RowComment) => void;
  channels: ChatChannel[];
  posts: Post[];
  setPosts: Dispatch<SetStateAction<Post[]>>;
  setChannels: Dispatch<SetStateAction<ChatChannel[]>>;
  /** Đánh dấu đã đọc theo kênh chat (lưu theo trình duyệt) */
  chatSeen: Record<string, number>;
  markChatSeen: (k: string) => void;
  addComment: (c: Omit<RowComment, 'id' | 'at' | 'authorId'>, title: string) => void;
  setDocs: Dispatch<SetStateAction<DocItem[]>>;
  acceptLead: (id: string) => void;
};

/** Chuyển chế độ xem (Bảng / Kanban / Gantt / Lịch): nút phân đoạn nổi bật có icon */
export type ViewKind = 'table' | 'board' | 'gantt';

/** Bảng dữ liệu: cột tiền / số lượng căn phải (td có text-right) thì tiêu đề cột tự căn phải theo, hoặc chỉ định qua `right` */
export type SortVal = string | number | undefined | null;

export type SortState = { col: number; dir: 1 | -1 } | null;

export type TableSort = { sort: SortState; sortable: number[]; onSort: (col: number) => void };

// =====================================================================
//  IMPORT CSV — dùng chung cho Lead và Khách hàng
// =====================================================================

export type ParseResult<T> = { ok: true; item: T } | { ok: false; error: string };

export type ImportSpec<T> = {
  title: string;
  templateName: string;
  headers: string[];
  sample: string[];
  parseRow: (r: Record<string, string>, line: number) => ParseResult<T>;
  onImport: (items: T[]) => void;
};

// =====================================================================
//  THÔNG BÁO ĐA KÊNH, EMAIL SMTP, ZALO ZNS, KHO TÀI LIỆU — kiểu & dữ liệu mẫu
// =====================================================================

export type Channel = 'INAPP' | 'ZNS' | 'EMAIL';

export type NotifyEvent = 'LEAD_ROUTED' | 'LEAD_ASSIGNED' | 'SLA_BREACH' | 'QUOTE_OVERDUE' | 'CLAIM_UPDATE' | 'STOCK_RELEASE' | 'CONTRACT_APPROVAL' | 'ACTIVITY_APPROVAL' | 'QUOTE_APPROVAL' | 'PROGRAM_APPROVAL' | 'APPROVAL_RESULT' | 'MONTHLY_REPORT';

export type NoticeKind = 'LEAD' | 'SLA' | 'QUOTE' | 'CLAIM' | 'STOCK' | 'DOC' | 'SYSTEM' | 'MENTION';

/** Bình luận theo từng dòng dữ liệu (lead, dự án, khách hàng, đơn xưởng...) kèm @nhắc tên đồng nghiệp */
export type CommentEntity = 'lead' | 'customer' | 'job' | 'po' | 'channel' | 'post';

/** v27 — Bảng tin nội bộ (Bàn làm việc). Bình luận dùng chung RowComment (entity 'post') */
export type PostKind = 'POST' | 'ANNOUNCE' | 'IDEA' | 'POLL';

export type PollOption = { id: string; text: string; votes: string[] };

export type Post = {
  id: string; kind: PostKind; authorId: string; at: number; text: string; files?: ChatFile[];
  likes: string[]; pinned?: { by: string; at: number }; hidden?: { by: string; at: number }; editedAt?: number;
  poll?: { options: PollOption[]; multi: boolean; closesAt?: string };
};

export type ChatFile = { name: string; url: string; size: number; type: string };

export type RowComment = {
  id: string; entity: CommentEntity; entityId: string; text: string; authorId: string; at: number; mentions: string[]; module: Module; files?: ChatFile[];
  /** Trả lời trong chủ đề (thread) của tin gốc */
  parentId?: string;
  /** Phản ứng nhanh: emoji -> danh sách người thả */
  reactions?: Record<string, string[]>;
  /** Tin được ghim lên đầu kênh */
  pinned?: { by: string; at: number };
};

/** Nhóm chat (kênh dự án / phòng ban). Tin nhắn trực tiếp không cần bản ghi: mã kênh dm:<id1>:<id2> */
export type ChatChannel = { id: string; name: string; desc?: string; members: string[]; createdBy: string; at: number };

export type Notice = { id: string; at: number; kind: NoticeKind; title: string; body: string; read: boolean; module?: Module; to?: string };

export type MsgLog = { id: string; at: number; channel: 'ZNS' | 'EMAIL'; to: string; subject: string; ok: boolean; detail: string };

export type EmailProvider = 'RESEND' | 'SENDGRID' | 'GMAIL' | 'SMTP';

export type EmailConfig = {
  enabled: boolean;
  provider: EmailProvider;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  reportRecipients: string;
  reportDay: number;
};

export type ZnsTemplateKey = 'LEAD_ROUTED' | 'LEAD_ASSIGNED' | 'QUOTE_OVERDUE';

export type ZnsConfig = { enabled: boolean; appId: string; secretKey: string; oaId: string; templates: Record<ZnsTemplateKey, string> };

export type DocCategory = 'POLICY' | 'MDF_RULES' | 'KPI' | 'PROFILE';

/** 'ALL' | 'BOD_ACC' | mã phòng ban (chỉ phòng đó xem) */
export type DocVisibility = string;

export type DocItem = {
  id: string;
  title: string;
  category: DocCategory;
  visibility: DocVisibility;
  ownerId: string;
  updatedAt: string; // ISO Y-m-d
  version: string;
  format: 'PDF' | 'DOCX' | 'XLSX' | 'PPTX';
  sizeKb: number;
  summary: string;
  tags: string[];
  url?: string;
};

// =====================================================================
//  KHOẢNG THỜI GIAN TOÀN CỤC & THANH BỘ LỌC DÙNG CHUNG
//  Bộ chọn ngày trên tiêu đề trang và các nút Năm / Q1–Q4 cùng ghi vào ctx.range
// =====================================================================

export type Period = 'YEAR' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type Opt = { value: string; label: string };

// =====================================================================
//  CỘNG TÁC THEO NGỮ CẢNH: bình luận + @nhắc tên ngay trên từng dòng bảng
// =====================================================================

/** Liên kết sâu trong chat: #MÃ (dự án, khách hàng, đơn xưởng, PO, claim) hoặc #Báo-cáo — bấm là mở đúng số liệu */
export type DeepLink = { token: string; label: string; sub: string; open: () => void };

export type MenuItem = { label: string; icon?: typeof Wallet; onClick: () => void; danger?: boolean; disabled?: boolean };

// =====================================================================
//  BẢNG LỆNH ⌘K / Ctrl+K — tìm nhanh và thao tác nhanh
// =====================================================================

export type PaletteItem = { id: string; group: string; label: string; sub?: string; icon: typeof Wallet; run: () => void; keys?: string; cmd?: boolean };

export type ConfirmState = { title: string; message: ReactNode; blocked?: string; confirmLabel?: string; onConfirm: () => void };

export type FieldSpec = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'money' | 'select' | 'checkbox' | 'color' | 'multi';
  options?: Opt[];
  hint?: string;
  wide?: boolean;
};

// =====================================================================
//  LEAD: THÊM / SỬA (kèm tải file nhu cầu)
// =====================================================================

export type LeadForm = { company: string; contact: string; phone: string; taxCode: string; email: string; segment: Segment; source: Source; region: Region; province: string; boqValue: number; boqNote: string; attachments: Attachment[] };

// =====================================================================
//  TỔNG QUAN — 3 tab theo sơ đồ: Data MKT | Khách hàng & Dự án | Quỹ MDF
// =====================================================================

// =====================================================================
//  PHÂN TÍCH DỰ ĐOÁN (thống kê trong app, không gửi dữ liệu ra ngoài)
//  - Dự báo doanh thu 3 tháng: pipeline có trọng số theo tỷ lệ chốt lịch sử + phần doanh số từ lead chưa phát sinh
//  - Cảnh báo thông minh: rủi ro trễ SLA theo tải nhân sự, chi phí MDF bất thường, công nợ, tồn kho, hạn nộp claim...
// =====================================================================

export type Insight = { id: string; tone: 'red' | 'orange' | 'blue'; title: string; detail: string; go?: Module; goLabel?: string };

export type Forecast = {
  months: { key: string; label: string; actual?: number; forecast?: number; pipeline?: number; low?: number; high?: number }[];
  next3: number; low3: number; high3: number; winRate: number; cycleDays: number; runRate: number; openDeals: number; samples: number;
  confidence: 'Thấp' | 'Trung bình' | 'Cao';
};

// =====================================================================
//  BẢNG ĐIỀU KHIỂN CÁ NHÂN HÓA: kéo-thả sắp xếp, ẩn / hiện, đổi kích thước widget (lưu theo người dùng)
// =====================================================================

/** Widget chuẩn: tiêu đề · kỳ dữ liệu · ĐVT · "Số liệu tính đến … · Tải lại" (period 'range' = theo kỳ đang chọn trên header) */
export type WidgetDef = { id: string; title: string; node: ReactNode; size: 4 | 6 | 8 | 12; period?: string; unit?: string };

export type WidgetPref = { id: string; size: 4 | 6 | 8 | 12; hidden?: boolean };

// =====================================================================
//  AI & TÍCH HỢP MÁY CHỦ (v32): cấu hình, gọi route /api, ngữ cảnh dữ liệu, kiến thức chính sách
//  - Khóa API (Claude, OpenAI, Zalo OA, ZNS) chỉ nằm ở biến môi trường máy chủ; trình duyệt chỉ biết đã cấu hình hay chưa.
//  - Không có máy chủ / chưa cấu hình: mọi tính năng chạy chế độ mô phỏng hoặc bộ phân tích cục bộ, ghi rõ trên giao diện.
// =====================================================================

export type AiProviderPref = 'AUTO' | 'ANTHROPIC' | 'OPENAI';

export type ZnsTpl = { id: string; name: string; templateId: string; params: { key: string; source: string }[] };

export type HubCfg = {
  ai: { enabled: boolean; provider: AiProviderPref; anthropicModel: string; openaiModel: string; maskPii: boolean; features: { copilot: boolean; chat: boolean; visual: boolean; writer: boolean; brief: boolean; image: boolean; extract: boolean };
    /** v38: cụm sáo dùng để chấm Human Score (trống = danh sách mặc định) */
    cliches?: string[] };
  /** v38.2: biến thể nội dung / hình ảnh (ẩn, thêm, mặc định, bộ cài sẵn) */
  content?: Partial<ContentVariantCfg>;
  zalo: { oaName: string; oaId: string; autoLink: boolean; salesSeeAll: boolean; replyMinutes: number; quickReplies: string[]; znsTemplates: ZnsTpl[] };
  brief: { enabled: boolean; hour: number };
  /** v35: kênh truyền thông hiển thị ở Bàn làm việc */
  social?: SocialCfg;
};

export type ServerStatus = { checked: boolean; reachable: boolean; ai: { anthropic: boolean; openai: boolean }; images: boolean; models: { anthropic: string; openai: string; image?: string }; zalo: { oa: boolean; webhook: boolean }; cloud: boolean; social?: { facebook: boolean; zalo: boolean; youtube: boolean } };

export type AiCall = { system?: string; prompt: string; history?: { role: 'user' | 'assistant'; content: string }[]; image?: { mediaType: string; data: string }; maxTokens?: number };

export type AiAnswer = { ok: true; text: string; provider: 'ANTHROPIC' | 'OPENAI'; model: string } | { ok: false; error: string };

// ---------------------------------------------------------------------
//  Kiến thức cho AI: quy định, chính sách (có thể kèm quy tắc tính toán)
// ---------------------------------------------------------------------
export type KbRule = { kind: 'DEALER_GROWTH_BONUS'; minGrowthPct: number; stepRevenue: number; bonusPerStep: number; base: 'INCREASE' | 'ABOVE_THRESHOLD' };

export type KbItem = { id: string; title: string; body: string; tags: string[]; rule?: KbRule; updatedAt: number; updatedBy?: string };

export type MdfMonth = { key: string; label: string; out: number; inflow: number; pendingEnd: number; balanceEnd: number };

export type SlaRisk = { lead: Lead; score: number; reasons: string[]; dueIn: number | null };

// ---------------------------------------------------------------------
//  Liên kết hội thoại với khách hàng / đơn hàng / dự án
// ---------------------------------------------------------------------
export type ZaloLinkKind = 'customer' | 'lead' | 'job' | 'quote' | 'po';

export type ZaloLink = { kind: ZaloLinkKind; id: string; auto?: boolean };

export type ZaloConvStatus = 'OPEN' | 'PENDING' | 'CLOSED';

export type ZaloConv = {
  id: string; channel: 'ZALO'; zaloUserId: string; displayName: string; avatar?: string; phone?: string; address?: string;
  lastAt: number; lastText?: string; unread?: number; status: ZaloConvStatus; followed?: boolean; assignee?: string;
  tags?: string[]; links?: ZaloLink[]; createdAt?: number; demo?: boolean; firstReplyAt?: number;
};

export type ZaloMsg = {
  id: string; convId: string; dir: 'IN' | 'OUT' | 'NOTE' | 'EVENT'; kind: 'text' | 'image' | 'file' | 'sticker' | 'link' | 'event' | 'zns';
  text: string; url?: string; at: number; by?: string; status?: 'SENT' | 'FAILED' | 'DEMO' | 'SENDING'; error?: string; zaloMsgId?: string; ai?: boolean;
};

export type LinkHit = { kind: ZaloLinkKind; id: string; label: string; sub: string; score: number; why: string };

// =====================================================================
//  TÌM KIẾM BẰNG HÌNH ẢNH (Visual Reverse Search): ảnh mẫu tủ bếp, bản vẽ CAD / SketchUp (xuất ảnh), phụ kiện 3M
//  - Cục bộ: so khớp ảnh với ảnh sản phẩm / ảnh công trình đã lưu (dHash + biểu đồ màu) và tên file.
//  - Có AI: gửi ảnh + danh mục (SKU, hạng mục báo giá, vật tư, đơn hàng) để AI nhận diện và đối chiếu.
// =====================================================================

export type VsKind = 'SKU' | 'PRICE' | 'STOCK' | 'JOB' | 'LEAD';

export type VsHit = { kind: VsKind; id: string; code: string; name: string; sub?: string; score: number; why: string; img?: string };

export type ImgFeat = { hash: boolean[]; hist: number[] };

// ---------------------------------------------------------------------
//  Bản tin điều hành mỗi sáng cho BOD
// ---------------------------------------------------------------------
export type Brief = { id: string; date: string; at: number; by?: string; provider?: string; auto?: boolean; text?: string; kpis: { label: string; value: string; tone?: 'red' | 'teal' }[]; sections: { title: string; items: string[] }[] };

// ---------------------------------------------------------------------
//  Soạn thảo bằng AI: email báo giá, tin chăm sóc, kịch bản Zalo OA, quảng cáo, thông cáo báo chí, ZNS
// ---------------------------------------------------------------------
export type WriterPreset = 'QUOTE_EMAIL' | 'CARE_MSG' | 'ZALO_OA' | 'AD_POST' | 'PRESS' | 'ZNS';

export type ZFilter = 'ALL' | 'UNREAD' | 'MINE' | 'UNASSIGNED' | 'CLOSED';

// =====================================================================
//  MARKETING HUB: lịch chiến dịch, ngân sách & ROI theo kênh, Content Studio (AI), thiết kế banner,
//  phân khúc khách hàng (micro-segmentation) và kịch bản tự động gửi Zalo ZNS / Zalo OA / SMS
// =====================================================================

export type MktChannel = 'ZALO_OA' | 'ZNS' | 'SMS' | 'FACEBOOK' | 'GOOGLE' | 'TIKTOK' | 'EMAIL' | 'EVENT' | 'WEBSITE';

export type CampaignStatus = 'PLANNED' | 'RUNNING' | 'PAUSED' | 'DONE';

export type Campaign = {
  id: string; code: string; name: string; channels: MktChannel[]; start: string; end: string; budget: number; spent: number; status: CampaignStatus;
  ownerId?: string; goal?: string; targetLeads?: number; audienceId?: string; manualLeads?: number; manualRevenue?: number; note?: string; createdAt: number;
  /** v33: yêu cầu nội dung / hình ảnh để giao AI ngay khi tạo chiến dịch */
  textPrompt?: string; imagePrompt?: string;
  /** v38.6: kênh AI soạn bài đầu tiên + thông số kênh / biến thể (giống Nhiệm vụ nội dung) */
  aiChannel?: MktChannel; settings?: Record<string, StSettingValue>;
};

export type MktContentType = 'AD_POST' | 'PRESS' | 'ZALO_OA' | 'ZNS' | 'QUOTE_EMAIL' | 'CARE_MSG';

export type ContentStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED';

export type MktContent = {
  id: string; title: string; type: MktContentType; campaignId?: string; body: string; status: ContentStatus; ownerId?: string; updatedAt: number; by?: string; approvedBy?: string;
  /** v33: Studio — kênh, prompt, dàn ý dạng khối kèm ảnh theo tiểu mục, kết quả phân tích tiêu đề, việc AI chạy nền, nhiệm vụ trên lịch */
  channel?: MktChannel; textPrompt?: string; imagePrompt?: string; tone?: string; blocks?: ContentBlock[]; titleReport?: TitleReport; aiJob?: AiJob; step?: number; taskId?: string;
  /** v37: Studio đa kênh — kênh xuất bản (website | facebook | zalo | google-maps), đoạn mở đầu, cài đặt riêng của kênh */
  platform?: string; sapo?: string; settings?: Record<string, StSettingValue>;
  /** v38: tài liệu TipTap của Workspace (blocks vẫn được ghi song song để bản cũ đọc được) */
  doc?: JSONContent;
  /** v38.3: người / lúc gửi duyệt, ghi chú trả về sửa, lúc duyệt */
  submittedBy?: string; submittedAt?: number; reviewNote?: string; approvedAt?: number;
};

export type BannerSize = 'FB' | 'SQUARE' | 'STORY' | 'ZALO' | 'WEB';

export type BannerSpec = {
  id: string; name: string; size: BannerSize; layout: 'LEFT' | 'CENTER' | 'SPLIT'; bg: string; bg2: string; accent: string; ink: string;
  headline: string; sub: string; cta: string; bgImage?: string; productImage?: string; showLogo: boolean; campaignId?: string; thumb?: string; updatedAt: number;
};

export type AudBase = 'CUSTOMER' | 'LEAD';

export type AudOp = 'eq' | 'neq' | 'contains' | 'gte' | 'lte';

export type AudRule = { field: string; op: AudOp; value: string };

export type Audience = { id: string; name: string; base: AudBase; match: 'ALL' | 'ANY'; rules: AudRule[]; createdAt: number };

export type AutoTrigger = 'LEAD_NEW' | 'QUOTE_NO_REPLY' | 'JOB_WON' | 'ZALO_FOLLOW' | 'INACTIVE_CUSTOMER' | 'AUDIENCE';

export type AutoChannel = 'ZNS' | 'ZALO_OA' | 'SMS' | 'MESSENGER' | 'EMAIL';

export type AutoStep = { id: string; wait: number; channel: AutoChannel; znsId?: string; text: string };

export type Automation = { id: string; name: string; active: boolean; dryRun: boolean; trigger: AutoTrigger; days: number; audienceId?: string; steps: AutoStep[]; createdAt: number; activatedAt?: number };

export type AutoSubject = { kind: 'customer' | 'lead' | 'job' | 'zalo'; id: string; name: string; phone?: string; zaloUserId?: string; customerId?: string };

export type AutoRun = { id: string; wfId: string; subject: AutoSubject; step: number; nextAt: number; status: 'ACTIVE' | 'DONE' | 'FAILED' | 'STOPPED'; startedAt: number; log: { at: number; step: number; channel: AutoChannel; ok: boolean; detail: string }[] };

// ---------------- Phân khúc khách hàng ----------------
export type AudField = { key: string; label: string; type: 'select' | 'number' | 'text' | 'bool'; options?: (app: AppCtx) => [string, string][]; get: (r: Customer | Lead, app: AppCtx) => string | number | boolean };

// ---------------- Trang Marketing Hub ----------------
export type MktTab = 'calendar' | 'content' | 'image' | 'roi' | 'automation';

// ---------------------------------------------------------------------
//  v33: AI CONTENT & VISUAL STUDIO — phân tích tiêu đề, dàn ý dạng khối kéo thả, viết từng phần, ảnh minh họa theo tiểu mục
// ---------------------------------------------------------------------
export type ContentImage = { url: string; prompt: string; by: string; at: number; alt?: string; referenceUrl?: string; strength?: number; brandPalette?: boolean; watermarked?: boolean; model?: string };

export type ContentBlock = { id: string; level: 2 | 3; heading: string; points: string; body: string; imagePrompt?: string; image?: ContentImage; imageHistory?: ContentImage[] };

export type TitleReport = { score: number; seo: { score: number; notes: string[] }; social: { score: number; notes: string[] }; tips: string[]; suggestions: string[]; by: string; at: number };

export type AiJob = { status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'; by: string; at: number; step?: string; error?: string; images?: boolean };

export type ImgAspect = 'landscape' | 'square' | 'portrait';

// ---------------------------------------------------------------------
//  v33: LỊCH CHIẾN DỊCH = BẢNG KẾ HOẠCH THỰC THI: nhiệm vụ nội dung theo ngày, giao cho AI, trạng thái màu
// ---------------------------------------------------------------------
export type TaskStatus = 'PLAN' | 'AI_QUEUED' | 'AI_DONE' | 'APPROVED' | 'PUBLISHED';

export type MktTask = { id: string; date: string; title: string; campaignId?: string; channel: MktChannel; contentType: MktContentType; textPrompt: string; imagePrompt: string; status: TaskStatus; ownerId?: string; contentId?: string; createdAt: number;
  /** v38: kênh Studio + thông số SEO / kênh + brief (giống Bước 1 của Content Studio), AI dùng khi soạn */
  platform?: string; settings?: StSettings };

export type CalView = 'calendar' | 'list' | 'board';

// =====================================================================
//  AI CONTENT STUDIO v37 — soạn bài đa kênh 4 bước (Strategy theo kênh), split-view, img2img, chấm SEO
//  Thêm kênh mới = thêm 1 hằng PlatformStrategy và đưa vào stPlatforms(); lõi Studio không đổi.
// =====================================================================

/** Store nhỏ thay Zustand (không thêm thư viện): component đăng ký đúng lát state qua selector */
export type StStore<T> = { getState: () => T; setState: (p: Partial<T> | ((s: T) => Partial<T>)) => void; subscribe: (l: () => void) => () => void };

// ---- studio/types.ts ----
/** Dữ liệu bài viết: trung lập với kênh. Kênh chỉ quyết định CÁCH dựng prompt, kiểm SEO và xuất bản. */
export type StSettingValue = string | number | boolean | string[] | null;

export type StSettings = Record<string, StSettingValue>;

export interface StImageAsset {
  url: string;               // data URL (đã thu nhỏ) hoặc URL Storage sau khi lưu
  prompt: string;
  alt: string;
  referenceUrl?: string;     // ảnh tham chiếu đã dùng (img2img)
  strength?: number;         // 0 = bám sát ảnh gốc, 1 = sáng tạo tự do
  brandPalette: boolean;
  watermarked: boolean;
  model?: string;
  createdAt: number;
}

export interface StSection {
  id: string;
  level: 2 | 3;
  title: string;
  body: string;              // Markdown nhẹ (đoạn, **đậm**, gạch đầu dòng) — Step 4 chuyển thành block editor
  image?: StImageAsset;
}

export interface StArticle {
  id: string;
  platform: string;          // id của PlatformStrategy
  title: string;
  sapo: string;              // đoạn mở đầu (Website: sapo; Facebook/Zalo: hook; Maps: 100 ký tự đầu)
  sections: StSection[];
  settings: StSettings;        // giá trị form động của kênh đang chọn
  updatedAt: number;
  /** v38: nội dung dạng tài liệu TipTap (nguồn chính ở Workspace); sections được suy ra từ doc */
  doc?: JSONContent;
}

export interface StCompany { name: string; address: string; phone: string; website?: string; hotline?: string; /** Lĩnh vực kinh doanh (đưa vào prompt), lấy từ cấu hình doanh nghiệp */ sector?: string }

export type StStepId = 1 | 2 | 3 | 4;

// ---- studio/platforms/types.ts ----

/**
 * Strategy cho một kênh phân phối. Lõi Studio (4 bước, store, editor, sidebar) chỉ gọi qua interface này.
 * Thêm kênh mới (LinkedIn, kịch bản TikTok…) = thêm 1 file trong platforms/ export default một PlatformStrategy.
 */
export interface PlatformStrategy {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly order: number;
  readonly structure: {
    /** false = không có H2/H3 khi xuất bản (Facebook, Zalo): tiêu đề mục thành dòng in đậm / IN HOA */
    headings: boolean;
    maxSections: number;
    sapoLabel: string;
    sapoMax?: number;
    /** Giới hạn độ dài toàn bài khi xuất bản (VD Google Maps) */
    totalMax?: number;
  };
  /** Schema form động ở Bước 1 */
  readonly fields: readonly FieldDef[];
  defaults(company: StCompany): StSettings;
  /** Lỗi chặn chuyển bước (trường bắt buộc…) */
  validate(s: StSettings): string[];
  /** Prompt sinh dàn ý (Bước 2) và nội dung từng mục (Bước 3) */
  outlinePrompt(a: StArticle, company: StCompany): string;
  sectionPrompt(a: StArticle, sectionId: string, company: StCompany): string;
  /** Xuất bản: HTML cho Website, chữ thuần cho mạng xã hội / Maps */
  render(a: StArticle, company: StCompany): RenderedPost;
  readonly seoRules: readonly SeoRule[];
  readonly image: { aspect: 'landscape' | 'square' | 'portrait'; hint: string };
}

export interface RenderedPost { format: 'html' | 'text'; body: string; meta?: { title?: string; description?: string } }

export type FieldKind = 'text' | 'textarea' | 'select' | 'tags' | 'counter' | 'toggle' | 'date' | 'nap';

export interface FieldDef {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly help?: string;
  readonly maxLength?: number;
  readonly options?: readonly { value: string; label: string; hint?: string }[];
  /** Sinh gợi ý tự động (meta title, meta description…) từ bài viết + cài đặt hiện tại */
  readonly suggest?: (a: StArticle, s: StSettings) => string;
  /** Hiện trường khi điều kiện đúng (VD ngày sự kiện chỉ khi loại bài Maps = Sự kiện) */
  readonly showIf?: (s: StSettings) => boolean;
  /** Chiếm cả hàng trong lưới 2 cột */
  readonly wide?: boolean;
}

export interface SeoInput { article: StArticle; plain: string; words: number; headings: string[]; images: number; company: StCompany; /** v38: ảnh trong tài liệu (alt, chú thích) */ imgs: { alt: string; caption: string }[] }

export interface SeoRule {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  check(x: SeoInput): { status: 'pass' | 'warn' | 'fail'; detail: string };
}

// ---- studio/seo/score.ts ----

export interface SeoItem { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string; weight: number }

export interface SeoReport { score: number; words: number; images: number; chars: number; items: SeoItem[] }

// ---- studio/lib/api.ts ----
/**
 * Cổng gọi AI của Studio. Studio không biết xác thực, tenant hay nhà cung cấp:
 * app truyền vào một StudioApi (dùng apiPost hiện có kèm JWT Supabase). Test thì truyền bản giả.
 */
export interface ImageRequest {
  prompt: string;
  aspect: 'landscape' | 'square' | 'portrait';
  /** Ảnh tham chiếu dạng data URL (JPEG đã thu nhỏ) */
  reference?: string;
  /** 0 = bám sát ảnh gốc (giữ bố cục, sản phẩm) … 1 = chỉ lấy cảm hứng */
  strength: number;
  brandPalette: boolean;
}

export interface StudioApi {
  text(req: { system: string; prompt: string; maxTokens?: number; kind?: 'outline' | 'section'; article?: StArticle; sectionId?: string }): Promise<string>;
  image(req: ImageRequest): Promise<{ dataUrl: string; model: string }>;
}

// ---- studio/store/studio-store.ts ----

/**
 * Store duy nhất của Studio (Zustand).
 *  - Trạng thái chia nhỏ theo id mục: component chỉ đăng ký đúng lát cắt nó cần (selector) => gõ ở mục 3 không render lại mục 1.
 *  - Mọi thay đổi đi qua action, không sửa trực tiếp => dễ undo / autosave / đồng bộ Supabase.
 *  - Không biết kênh nào cụ thể: đổi kênh = lấy defaults() của Strategy, giữ nguyên nội dung đã viết.
 */
export interface StudioState {
  step: StStepId;
  article: StArticle;
  company: StCompany;
  activeSectionId: string | null;
  /** Thời điểm người dùng bấm mục ở cột dàn ý: scroll-spy tạm ngừng để không ghi đè lựa chọn trong lúc cuộn mượt */
  navAt: number;
  /** Mục đang chờ AI viết / tạo ảnh (hiện trạng thái trên từng thẻ) */
  busy: Record<string, 'text' | 'image' | undefined>;
  /** Cài đặt đã nhập của từng kênh: đổi qua kênh khác rồi quay lại không mất dữ liệu */
  stash: Record<string, StSettings>;
  history: StArticle[];

  setStep(s: StStepId): void;
  setPlatform(id: string): void;
  setSetting(key: string, v: StSettingValue): void;
  setTitle(t: string): void;
  setSapo(t: string): void;
  setOutline(sections: Pick<StSection, 'level' | 'title'>[]): void;
  addSection(after: string | null, level?: 2 | 3): void;
  removeSection(id: string): void;
  moveSection(id: string, toIndex: number): void;
  patchSection(id: string, p: Partial<Omit<StSection, 'id'>>): void;
  setImage(id: string, img: StImageAsset | undefined): void;
  /** v38: Workspace ghi tài liệu; sections suy ra từ doc để kênh xuất bản / chấm SEO dùng tiếp */
  setDoc(doc: JSONContent): void;
  setActive(id: string | null): void;
  focusSection(id: string): void;
  setBusy(id: string, kind: 'text' | 'image' | undefined): void;
  undo(): void;
}

export type StudioStore = ReturnType<typeof createStudioStore>;

export type StudioActions = Pick<StudioState, 'setStep' | 'setPlatform' | 'setSetting' | 'setTitle' | 'setSapo' | 'setOutline' | 'addSection' | 'removeSection' | 'moveSection' | 'patchSection' | 'setImage' | 'setDoc' | 'setActive' | 'focusSection' | 'setBusy' | 'undo'>;

// =====================================================================
//  CONTENT WORKSPACE v38 — trình soạn khối TipTap thay Bước 3 + 4 của Content Studio:
//  thanh công cụ nổi, ghost text (Tab để nhận), gõ "/" chèn khối, Zen Mode, sidebar dính 4 tab
//  (SEO · Tự nhiên · LSI · Lịch sử), Human Score, Humanize / Viết lại / Chèn LSI dạng so sánh, ảnh chuẩn SEO
// =====================================================================

/** Mốc lịch sử của một nội dung (bản ghi riêng, nhóm contentVersions) */
export type ContentVersionKind = 'AI_DRAFT' | 'HUMANIZE' | 'MANUAL' | 'REVIEW' | 'APPROVED' | 'RESTORE';

export type ContentVersion = { id: string; contentId: string; kind: ContentVersionKind; title: string; doc: JSONContent; seoScore: number; humanScore: number; by: string; at: number; note?: string };

/** Hạn mức AI theo người (bản ghi nguyên khối '$'/aiQuota; chỉ Giám đốc / quản trị ghi được, máy chủ đọc để chặn) */
export type AiQuotaCfg = { ghost: { enabled: boolean; dailyLimit: number; extraUsers: string[]; blockedUsers: string[] } };

export type WsTone = (typeof WS_TONES)[number]['value'];

export type WsImage = { src: string; alt: string; caption: string; fileName: string };

/** Các khối cấp 1 kèm tiêu đề mục chứa nó (Human Score, LSI, so sánh phiên bản) */
export type WsBlock = { id: string; type: string; text: string; heading: string };

// ---- workspace/human.ts: điểm tự nhiên (ước lượng biên tập, KHÔNG phải máy dò AI) ----

export type HumanBlock = { id: string; heading: string; score: number; words: number; reasons: string[] };

export type HumanReport = { score: number; weakPct: number; scored: number; blocks: HumanBlock[]; metrics: { label: string; value: number; hint: string }[] };

// ---- workspace/diff.ts: so sánh theo từ, kiểm số liệu / mã / từ khóa bị mất ----

export type WsDiffPart = { t: 'eq' | 'del' | 'ins'; s: string };

// ---- workspace/extensions.ts: TipTap (mã id khối, ghost text, tô đoạn, chỗ trống) ----

export type WsGhost = { text: string; pos: number } | null;

export type WsMarks = { weak: string[]; hit: string[] };

// ---- workspace/Workspace.tsx ----

export type WsProposal = {
  kind: 'HUMANIZE' | 'REWRITE' | 'LSI'; label: string; mode: 'inline' | 'block';
  from: number; to: number; original: string; text: string | null; busy: boolean; error?: string; lost: string[]; top: number;
};

export type WsSlash = { from: number; to: number; query: string; top: number; left: number; idx: number } | null;

export type WsImagePanel = { from: number; to: number; top: number; heading: string; context: string } | null;

export type WsSlashItem = { id: string; label: string; hint: string; keys: string; run: (e: Editor, r: { from: number; to: number }) => void };

// ---- workspace/variants.ts (v38.2): biến thể nội dung & hình ảnh bấm chọn, mẫu brief, bộ cài sẵn, AI gợi ý ----

/**
 * Mỗi nhóm biến thể = một hàng ô bấm chọn; mỗi lựa chọn là 1 câu chỉ dẫn ngắn cho AI.
 * Lưu trong settings của nhiệm vụ / bài viết với khóa `v_<nhóm>` (mảng id). Chưa chọn = dùng mặc định.
 */
export type VariantKind = 'text' | 'image';

export type VariantOption = {
  id: string; label: string; prompt: string; def?: boolean;
  /** Chỉ hiện ở các kênh này (website | facebook | zalo | google_maps) */
  channels?: string[];
  /** Độ dài mục tiêu (nhóm Độ dài) để chia số từ mỗi mục */
  words?: number;
  /** Mẫu brief: chọn dạng bài thì tích sẵn các nhóm khác */
  implies?: Record<string, string[]>;
  custom?: boolean;
};

export type VariantGroup = { id: string; kind: VariantKind; label: string; multi: boolean; options: VariantOption[]; channels?: string[]; hint?: string; /** Ẩn sau "+ Hiện cài đặt nâng cao" */ adv?: boolean };

/** Cấu hình biến thể của doanh nghiệp (hubCfg.content): ẩn / thêm lựa chọn, đổi mặc định, bộ cài sẵn */
export type ContentVariantCfg = { hidden: string[]; custom: (VariantOption & { group: string })[]; defaults: Record<string, string[]>; presets: { id: string; name: string; values: Record<string, string[]> }[] };

export type MenuOption = { id: string; label: string; hint?: string; img?: string };

// ---------- Mẫu nhanh (template) ----------

export type ContentTemplate = { id: string; name: string; desc: string; channels?: string[]; values: Record<string, string[]> };

// ---------- Image: tạo ảnh AI theo ảnh tham chiếu, đúng kích thước, chuẩn SEO; thư viện ảnh; thiết kế banner ----------

export type MktImage = { id: string; url: string; w: number; h: number; kb: number; fileName: string; alt: string; caption: string; title: string; keyword: string; prompt: string; size: string; refSku?: string; createdAt: number; by?: string };

// =====================================================================
//  COMMUNICATION & AI HUB (cột phải): Chat nội bộ theo ngữ cảnh + AI Copilot
//  AI Copilot = bộ phân tích thống kê chạy ngay trong app; v32: khi bật AI (Claude / OpenAI qua /api/ai) thì AI diễn giải trên số liệu đã tính.
// =====================================================================

export type AiItem = { title: string; detail?: string; tone?: 'red' | 'orange' | 'blue' | 'teal'; action?: { label: string; run: () => void } };

export type AiMsg = { id: string; role: 'user' | 'ai'; text: string; kpis?: { label: string; value: string; tone?: 'red' | 'teal' }[]; items?: AiItem[]; chips?: string[]; note?: string;
  /** v36: đang chờ AI (hiện dấu đang gõ) · câu trả lời "chưa hiểu" của bộ phân tích cục bộ · chữ do AI viết */
  pending?: boolean; fallback?: boolean; ai?: boolean };

/** Khóa luồng chat: kênh chung hoặc theo bản ghi */
export type Thread = { entity: CommentEntity; entityId: string; title: string; sub?: string; module: Module; token?: string };

export type FeedAuto = { id: string; at: number; icon: typeof Wallet; tone: Tone; text: ReactNode; open?: () => void };

// =====================================================================
//  BÀN LÀM VIỆC — SOCIAL INTRANET: thanh lệnh trợ lý số, widget Truyền thông đa kênh
//  (Fanpage / Zalo OA / YouTube) có Sao chép liên kết + Chia sẻ nhanh trên mỗi thẻ
// =====================================================================
export type SocialChannel = 'FACEBOOK' | 'ZALO' | 'YOUTUBE';

/** Bài / video Marketing thêm tay (ghim tài liệu bán hàng, hoặc khi chưa kết nối API) */
export type SocialPost = { id: string; channel: SocialChannel; title: string; url: string; thumb?: string; at: number; by?: string; pinned?: boolean };

export type SocialItem = { id: string; channel: SocialChannel; title: string; url: string; thumb?: string; at: number; manual?: SocialPost; pinned?: boolean };

export type SocialCfg = { title: string; facebookUrl: string; facebookPageId: string; zaloOaUrl: string; youtubeUrl: string; youtubeChannelId: string };

// =====================================================================
//  DANH BẠ — nhân sự nội bộ + người liên hệ của khách hàng
// =====================================================================
export type ContactPrefs = { fav: string[]; recent: string[]; labels: { id: string; name: string; ids: string[] }[] };

export type ContactItem = { key: string; kind: 'staff' | 'customer'; name: string; title: string; org: string; phone?: string; email?: string; extra?: string; user?: User; customer?: Customer; group: string };

// =====================================================================
//  TỔNG QUAN ĐIỀU HÀNH v37 — 4 tab Tổng Quan · Kinh doanh · Marketing · Tài chính, KPI so chỉ tiêu
//  Chỉ tiêu tháng: Giám đốc nhập cho phòng ban, Trưởng phòng nhập cho nhân viên phòng mình (kiểm cả RLS máy chủ).
// =====================================================================

/** Chỉ tiêu tháng. id = `DEPT:<mã phòng>:<YYYY-MM>` | `USER:<id nhân viên>:<YYYY-MM>` | `CFG:company:*` (máy chủ kiểm quyền theo id) */
export type KpiTarget = { id: string; scope: 'DEPT' | 'USER' | 'CFG'; refId: string; month: string; revenue: number; leads?: number; deals?: number; by?: string; at?: number;
  /** Chỉ bản CFG: ngưỡng đánh giá */
  cfg?: KpiCfg };

export type KpiCfg = { winRatePct: number; cycleDays: number; coverage: number; cplMax: number };

export type DashPeriod = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export type DashRange = { from: number; to: number; prevFrom: number; prevTo: number; label: string; tag: string; prevTag: string; elapsed: number; daysLeft: number;
  /** Phần của từng tháng nằm trong kỳ (tuần cắt ngang tháng thì chia theo ngày) */
  months: { key: string; share: number }[] };

/** Phạm vi số liệu: cả công ty, một phòng, hoặc một nhân viên (Sales xem của mình) */
export type DashScope = { dept: DeptCode | 'ALL'; userId?: string };

export type DashData = ReturnType<typeof useDashData>;

export type KpiStatus = { label: string; tone: 'teal' | 'orange' | 'red' | 'muted' };

export type DashTab = 'all' | 'sales' | 'mkt' | 'fin' | 'mfg';

// =====================================================================
//  PHÂN HỆ 4: KHÁCH HÀNG 360 & LIÊN KẾT MDF
// =====================================================================

export type CustomerForm = Omit<Customer, 'id' | 'code'>;

export type RevenueBand = 'ALL' | 'GT1B' | '500M_1B' | '200M_500M' | 'LT200M';

// =====================================================================
//  PHÂN HỆ 5: DỰ ÁN & BÁO GIÁ BOQ
// =====================================================================

export type Stage = 'ACCEPTED' | 'QUOTED' | 'WON' | 'LOST';

// =====================================================================
//  ĐỀ XUẤT CHƯƠNG TRÌNH MDF (Pre-Approval) — kiểm tra 4 lớp hạn mức
// =====================================================================

export type ProgramForm = { title: string; type: ProgramType; customerId: string; dept: DeptCode; requested: number; sharePct: number; start: string; end: string; expectedLeads: number };

/** Mức tồn: dưới Min (đỏ), sắp chạm Min ≤ Min × 1,2 (vàng), trong định mức (xanh), vượt Max (cam) */
export type StockLevel = 'OUT' | 'LOW' | 'NEAR' | 'OK' | 'HIGH';

export type ImportRow = { line: number; sku: string; data: Partial<SkuItem>; wh?: string; open: number; errors: string[]; warn: string[]; exists: boolean; extra?: boolean };

/** Bộ lọc sản phẩm: lọc nhanh trên thanh + “Bộ lọc khác” + bộ lọc đã lưu */
export type SkuFilter = { q: string; brand: string; cat: string; level: '' | StockLevel; wh: string; supplier: string; origin: string; unit: string; priceMin: number; priceMax: number; leadMax: number; hasDocs: boolean; hasImage: boolean; onOrder: boolean };

export type WhTab = 'stock' | 'in' | 'out' | 'transfer' | 'count' | 'card' | 'xnt' | 'list';

export type DocContext = { company: CompanyInfo; quoteCode: string; contractCode: string; projectName?: string; projectCode?: string; salesName: string; salesPhone: string };

export type ComposerMode = 'QUOTE' | 'CONTRACT';

export type BarAct = { onClick: () => void; disabled?: boolean; title?: string; label?: string };

// =====================================================================
//  BÁO GIÁ THÔNG MINH (SMART QUOTE): bảng tính như Excel, dán bảng từ Excel / Word,
//  gõ tên hàng tự do (không cần danh mục trước), tự học "danh mục nháp" kèm giá bán gần nhất,
//  AI bóc tách ảnh chụp / PDF danh sách vật tư thành dòng báo giá
// =====================================================================

/** Vật tư chưa có trong danh mục chính thức: tự ghi khi tạo báo giá có dòng gõ tự do */
export type DraftProduct = {
  id: string; name: string; key: string; unit: string;
  lastPrice: number; lastDiscountPct?: number; lastAt: number; lastBy?: string; lastQuote?: string; lastCustomer?: string;
  uses: number; history?: { price: number; at: number; quote?: string; customer?: string }[];
  /** Đã chuyển thành mã hàng chính thức */
  promotedSku?: string;
};

export type PasteRow = { name: string; unit: string; qty: number; price?: number };

export type SmartSuggest = { kind: 'SKU' | 'DRAFT'; key: string; name: string; unit: string; price: number; discountPct?: number; sku?: string; sub: string };

export type SmartCatalog = { skus: SkuItem[]; drafts: DraftProduct[]; quotes: Quote[]; tier: PriceTier };

// =====================================================================
//  PHÂN HỆ: LẮP ĐẶT, NGHIỆM THU, BÀN GIAO & THU TIỀN
// =====================================================================

/** Trạng thái hiển thị của 1 lịch lắp đặt (kết hợp tiền thu của đơn) */
export type InstallView = 'WAIT' | 'SCHEDULED' | 'IN_PROGRESS' | 'WAIT_PAYMENT' | 'DONE';

export type InstallRow = { key: string; view: InstallView; job?: Job; ij?: InstallJob; wo?: WorkOrder; time: string };

// ---------------- Danh sách đơn hàng công trình ----------------

export type JobFilter = 'ACTIVE' | JobStage | 'ALL';

// =====================================================================
//  PHÂN HỆ: NHẬP XUẤT TỒN (kho vật tư xưởng)
//  Phiếu nhập (NCC) / xuất (cho lệnh sản xuất, đơn hàng) / kiểm kê; tồn theo giá bình quân
// =====================================================================

export type VoucherLine = { key: string; itemId: string; qty: number; unitCost: number; actual?: number };

// =====================================================================
//  CÔNG NỢ & TUỔI NỢ KHÁCH HÀNG (AR Aging) — dùng chung 2 mô hình
//  Xưởng: theo đợt thanh toán đã đến mốc của từng đơn (cọc, giao hàng, nghiệm thu)
//  Thương mại: theo đơn hàng đã duyệt chưa thanh toán đủ, hạn = ngày đơn + số ngày công nợ
// =====================================================================

export type ArItem = { key: string; customerId: string; customer: string; phone?: string; docCode: string; docLabel: string; docDate: string; dueDate: string; amount: number; paid: number; outstanding: number; jobId?: string };

export type ArBucketDef = { id: string; label: string; short: string; color: string; tone: Tone; max: number };

// =====================================================================
//  QUYẾT TOÁN HOA HỒNG (ALUX): chỉ tính khi kế toán đã xác nhận thu đủ 100% đơn hàng
//  Sales / kỹ thuật phụ trách: % giá trị trước VAT; đội lắp (đội trưởng + thành viên): % chia đều
// =====================================================================

export type CommissionRow = {
  j: Job; base: number; confirmed: number; pctPaid: number; status: 'PAID' | 'READY' | 'WAIT';
  lines: { userId: string; role: 'SALES' | 'INSTALL'; amount: number }[]; total: number; fullAt?: number;
};

// =====================================================================
//  TRUNG TÂM PHÊ DUYỆT & CÔNG VIỆC
//  Gom mọi yêu cầu duyệt: giá báo giá / hợp đồng, công tác & giải trình công,
//  chi & claim quỹ MDF, phân lead; duyệt nhanh ngay trên thẻ, đếm ngược SLA
// =====================================================================

export type HubGroup = 'PRICE' | 'WORK' | 'MDF' | 'LEAD' | 'CASH' | 'STOCK' | 'MKT';

export type HubItem = {
  key: string; kind: ApprovalKind; refId: string; title: string; sub: string; reason?: string;
  requesterId?: string; deptCode?: DeptCode; requestedAt: number; slaMin: number; amount?: number; flagged?: string;
  approveLabel?: string; nextStep?: string;
  approve?: () => void; reject?: (note: string) => void; needInfo?: (note: string) => void; view?: () => void;
  /** Thao tác riêng thay cho nút duyệt (vd. chọn Sales khi chỉ định lead) */
  custom?: ReactNode;
  /** Chọn nhanh 1 người / phương án ngay trong bảng (menu gọn thay cho ô chọn) */
  pick?: { label: string; options: { id: string; label: string }[]; onPick: (id: string) => void };
};

export type MineItem = { key: string; kind: ApprovalKind; title: string; sub: string; status: 'PENDING' | ApprovalDecision; requestedAt: number; slaMin: number; deciderId?: string; note?: string; view?: () => void };

export type InvoiceDraft = { serial: string; number: string; date: string; supplierTax: string; amount: number; claimed: number };

// =====================================================================
//  PHÂN HỆ 6: BÁO CÁO & PHÂN TÍCH ROI
// =====================================================================

export type ReportView = 'mfg' | 'trade' | 'aging' | 'commission' | 'mdf';

export type SettingsTab = 'perms' | 'hub' | 'platform' | 'company' | 'org' | 'fund' | 'mkt' | 'segments' | 'pricing' | 'accounting' | 'getfly' | 'email' | 'zns' | 'security' | 'warehouses';

// =====================================================================
//  3A PLATFORM CONSOLE — quản trị nền tảng: doanh nghiệp, cấp phép module, dữ liệu & nâng cấp an toàn
//  Chỉ tài khoản @3agroup.vn. Mỗi doanh nghiệp một khóa lưu riêng, thao tác trên bên này không chạm bên kia.
// =====================================================================

export type ConsoleTab = 'overview' | 'tenants' | 'modules' | 'users' | 'data' | 'admins';

// =====================================================================
//  PHÂN QUYỀN CHI TIẾT (v34): vai trò × phân hệ × thao tác, phạm vi dữ liệu, ngoại lệ từng tài khoản
// =====================================================================
export type DataScope = 'ALL' | 'DEPT' | 'OWN' | 'WON';

export type UserPerm = { scope?: DataScope; modules?: Partial<Record<Module, boolean>>; actions?: Partial<Record<Action, boolean>> };

// =====================================================================
//  GETFLY: TAB CÀI ĐẶT "CẤU HÌNH GETFLY API"
//  Bản demo mô phỏng phản hồi Getfly. Khi nối backend, thay các hàm dưới bằng:
//   Lưu -> saveGetflySettings | Kiểm tra -> testGetflyConnection | Đồng bộ -> syncAllRevenueFromGetfly
// =====================================================================

export type HookEvent = 'order.created' | 'order.approved' | 'order.updated';

// =====================================================================
//  EMAIL BÁO CÁO THÁNG — HTML dạng bảng, style inline (tương thích Gmail / Outlook)
// =====================================================================

export type ReportData = {
  monthLabel: string;
  vendor: string;
  leads30: number;
  slaRate: string;
  slaDetail: string;
  won: number;
  lost: number;
  winRate: string;
  topLost: string;
  gfMonth: number;
  gfYtd: number;
  mdfSpentPct: number;
  mdfCommitPct: number;
  mdfSpent: number;
  mdfTotal: number;
  quoteOverdue: number;
  claimsBlocked: number;
  claimsPending: number;
};

/** Trạng thái hoạt động: online (< 3 phút), away (< 20 phút), offline. Bản thân luôn online */
export type Presence = 'online' | 'away' | 'offline';

/** Giai đoạn đơn hàng (quy trình rút gọn): suy ra từ báo giá, cọc, lệnh sản xuất, lắp đặt, tiền đã thu */
export type JobStage = 'SURVEY' | 'QUOTED' | 'PRODUCTION' | 'INSTALL' | 'WAIT_PAYMENT' | 'DONE' | 'LOST';

/** Dòng sổ quỹ: phiếu thu / chi tự lập + tiền thu khách hàng đã được kế toán xác nhận */
export type CashLine = { id: string; code: string; date: string; account: CashAccount; kind: 'IN' | 'OUT'; category: string; amount: number; partner?: string; jobId?: string; note?: string; ref?: string; auto?: boolean; source?: CashSource; entryId?: string };

/** Hồ sơ doanh nghiệp trên nền tảng: gói bản quyền, hợp đồng, trạng thái, module được cấp phép */
export type TenantPlan = 'STARTER' | 'BUSINESS' | 'ENTERPRISE';

export type TenantReg = {
  id: string; plan: TenantPlan; seats: number; contractStart: string; contractEnd: string; status: 'ACTIVE' | 'SUSPENDED';
  /** Module được cấp phép theo hợp đồng; tắt là menu bên doanh nghiệp tự ẩn */
  modules: Partial<Record<Module, boolean>>;
  /** Tính năng tích hợp ngoài module */
  features: { getfly: boolean; zns: boolean; smtp: boolean };
  lastBackupAt?: number; lastMigrationAt?: number; note?: string;
};

export type PlatformLog = { id: string; at: number; by: string; tenant?: string; action: string; detail: string };

export type StoredData = { v: number; savedAt: number; data: Record<string, unknown> };

export type AnyRec = Record<string, any>;

export type EncryptedBackup = { format: 'vassh-backup'; v: number; enc: 'AES-GCM'; kdf: 'PBKDF2-SHA256'; iter: number; salt: string; iv: string; data: string; exportedAt: number };

export type CloudSession = { access_token: string; refresh_token: string; expires_at: number; user: { id: string; email: string } };

export type CloudRow = { tenant_id: string; coll: string; id: string; data: unknown; rank: number; deleted: boolean; seq?: number };

export type CloudAccess = { tenant_id: string; is_admin: boolean; platform: boolean };

export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

export type SyncInfo = { state: SyncState; pending: number; lastOk: number | null; error?: string };

export type RemoteChange = { coll: string; id: string; value?: unknown; rank: number; deleted: boolean; prevBase?: string };

export type RemoteBatch = { keyed: Record<string, RemoteChange[]>; whole: Record<string, { value: unknown; prevBase?: string }> };

