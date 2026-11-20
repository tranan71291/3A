'use client';

import { AlertTriangle, ArrowLeftRight, AtSign, Banknote, Bell, BookUser, Boxes, Briefcase, Building2, CalendarDays, CalendarRange, ClipboardCheck, ClipboardList, Clock, Coins, Columns3, Copy, Database, Download, Factory, FileCheck2, FileText, FolderOpen, HardHat, House, Inbox, LayoutDashboard, Lightbulb, Megaphone, MessageCircle, MessagesSquare, Newspaper, Package, PackageMinus, PackagePlus, Plane, Receipt as ReceiptIcon, RefreshCw, Rows3, Ruler, Settings, ShieldCheck, Ship, ShoppingBag, SlidersHorizontal, Sparkles, SquarePlay, Target, ThumbsUp, Truck, Users, Vote, Wallet, Warehouse, XCircle, Zap } from 'lucide-react';
import { Component, Fragment, createContext, memo, type ReactNode, useContext, useDeferredValue, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { type JSONContent } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { claimDate } from '../components/filters';
import { auditClaim } from './business';
import { canon, cloudMessage, statsOf, withFileUrls } from './cloud';
import type { Action, Activity, ActivityStatus, ActivityType, AgingScheme, AiJob, AiMsg, AiQuotaCfg, AnyRec, AppCtx, ApprovalDecision, ApprovalKind, ApprovalLevel, ArBucketDef, AudBase, AudField, AudOp, AutoChannel, AutoSubject, AutoTrigger, BannerSize, BannerSpec, Budget, BudgetCategory, BusinessProfile, CampaignStatus, CashAccount, Channel, ChatFile, CheckItem, Claim, ClaimRules, CloudAccess, CloudRow, CloudSession, CommissionRow, CompanyInfo, ComposerForm, ConsoleTab, ContactItem, ContentBlock, ContentStatus, ContentTemplate, ContentVariantCfg, ContentVersion, ContentVersionKind, Customer, CustomerForm, CustomerSource, CustomerStatus, DashScope, DataScope, DateRange, Department, DeptCode, DesignStatus, DocCategory, DocItem, DocLine, DocVisibility, EmailConfig, EmailProvider, ExpenseStatus, FieldDef, FundCode, GenDocStatus, GeneratedDoc, GetflyConfig, GetflyOrderRec, GlobalFilter, GuaranteeType, HookEvent, HubCfg, HubGroup, ImgFeat, InstallJob, InstallView, InvMove, InvMoveType, Job, JobLine, JobLostReason, JobStage, KbItem, KpiCfg, KpiStatus, KpiTarget, Lead, LeadStatus, LeaveKind, LostReason, MenuItem, MfgConfig, MktChannel, MktContent, MktContentType, MktItem, MktTab, Module, NoticeKind, NotifyEvent, Org, PasteRow, PayTrigger, Period, Perms, PlatformStrategy, PoAllocation, Policy, PopDocDef, PopType, PoPurpose, Post, PostFeeling, PostKind, Presence, PriceProtection, PriceTier, PriceUnit, Program, ProgramStatus, ProgramType, Quote, QuoteLine, QuoteStatus, ReactId, Receipt, ReceiptStatus, Region, RemoteBatch, RemoteChange, ReservationStatus, RevenueBand, Role, SaleDelivery, SaleFilter, SaleLine, SalePay, SalesOrder, SaleStage, SaleStatus, SecurityPolicy, Segment, SegmentDef, SeoRule, ServerStatus, Settlement, ShipmentStatus, ShipMode, SkuFilter, SkuItem, SmartCatalog, SocialCfg, SocialChannel, SocialItem, Source, Stage, StArticle, StCompany, StockLevel, StockMove, StockMoveType, StockReservation, StockVoucher, StSection, StSettings, StStepId, StudioState, StudioStore, SurplusAllocation, SyncInfo, TaskStatus, TenantPlan, TenantReg, Tier, TierRule, Tone, TxType, User, VariantGroup, VendorPO, ViewKind, VoucherStatus, VoucherType, VsKind, WarehouseInfo, WfCond, WfCtx, WfDef, WfField, WfFieldType, WfOp, WfPolicy, WfRun, WfRunStatus, WfStep, WfSubject, WfWho, WfWhoKind, WidgetPref, WorkOrder, WoStage, WriterPreset, WsGhost, WsImage, WsMarks, ZaloConv, ZaloConvStatus, ZaloLinkKind, ZnsConfig } from './types';
import { cn, syncCatalog } from './utils';
import { jobMoney, lineMeasure } from './workshop';
import { CounterInput, getPlatform, scoreArticle, socialStrategy, stBriefText, stClip, stCreate, TagInput, useStudio, useStudioActions, useStudioApi } from '../modules/marketing/content-studio';
import { useContentExport, vGroups, vPicked, vWords, wsDocHtml, wsDocToSections, wsInline } from '../modules/marketing/content-workspace';

// =====================================================================
//  DESIGN TOKENS & HELPERS
// =====================================================================

/**
 * BẢNG MÀU 3A GROUP — đo từ logo (dải ruy-băng tam giác + điểm giao chìm xanh dương).
 * Đổi nhận diện: sửa BRAND + C ở đây và class .g-brand trong <style> của DashboardApp.
 *  - Gradient chính (nút chính, thanh tiến độ, KPI nổi bật): #E8562A → #F28C33 → #F6B533
 *  - Accent xanh dương đậm (hover, nút phụ, link, màu tương phản biểu đồ): #0B5FB8, chữ / đường: #6FA8F0
 *  - Nền Midnight: #0F141E, sidebar #0B1019, thẻ #151C29, nổi #1C2534, viền #263044
 */
export const BRAND = { o1: '#E8572A', o2: '#F28C28', o3: '#F6A93B', blue: '#2563EB', blueHi: '#60A5FA', navy: '#172B49' } as const;

/** Biểu tượng tam giác 3A Group (cắt từ logo gốc, nền trong suốt) */
export const LOGO_3A = 'data:image/png;base64,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';

/**
 * DESIGN SYSTEM v26 (Master Prompt): Primary Navy #172B49 · Secondary Blue #2563EB · Accent Orange #F28C28 · Success #10B981
 * Nền sáng #F5F7FA · Nền tối #101827. Mọi màu giao diện dùng token dạng kênh RGB: class `bg-[rgb(var(--surface))]`,
 * có độ trong suốt `bg-[rgb(var(--accent)/0.15)]`. Đổi chế độ: <html class="light">. Thêm màu mới: thêm token ở đây.
 */
export const THEME_CSS = `
:root{
  --bg:11 13 20; --sunken:7 8 13; --surface:17 20 28; --raised:26 30 40; --line:40 45 58;
  --fg:238 240 245; --fg2:163 169 184; --muted:127 135 154; --faint:98 106 124; --ink:255 255 255;
  --primary:242 140 40; --on-primary:27 18 5; --navy:19 34 59;
  --secondary:96 140 230; --secondary-fg:147 180 245;
  --accent:242 140 40; --accent-fg:246 169 59; --on-accent:27 18 5;
  --success:76 195 138; --success-fg:76 195 138; --danger:229 72 77; --danger-fg:239 107 111; --warn:224 160 70;
  --radius-sm:4px; --radius:8px; --radius-lg:12px;
  --ease:cubic-bezier(.22,1,.36,1);
  --shadow-sm:none; --shadow:0 8px 24px rgba(0,0,0,.35); --shadow-lg:0 20px 50px rgba(0,0,0,.45);
  color-scheme:dark;
}
.light{
  --bg:245 246 248; --sunken:255 255 255; --surface:255 255 255; --raised:238 240 244; --line:228 231 236;
  --fg:17 24 39; --fg2:75 85 101; --muted:107 116 135; --faint:146 153 168; --ink:17 24 39;
  --primary:242 140 40; --on-primary:27 18 5;
  --secondary:37 99 235; --secondary-fg:29 78 216; --accent-fg:180 87 15; --success:22 163 74; --success-fg:21 128 61; --danger:220 38 38; --danger-fg:196 43 43; --warn:180 83 9;
  --shadow-sm:0 1px 2px rgba(17,24,39,.04); --shadow:0 6px 20px rgba(17,24,39,.08); --shadow-lg:0 20px 50px rgba(17,24,39,.14);
  color-scheme:light;
}
body{background:rgb(var(--bg));color:rgb(var(--fg))}
/* v40: menu trái nền navy 3A (#13223b) ở nền sáng, gần đen ở nền tối */
.side-dark{
  --sunken:19 34 59; --surface:26 44 73; --raised:32 52 84; --line:43 60 88;
  --fg:232 236 243; --fg2:201 209 222; --muted:141 153 174; --faint:120 132 154; --ink:255 255 255;
  --secondary-fg:147 197 253; --accent-fg:246 169 59;
  color:rgb(var(--fg)); color-scheme:dark;
}
:root:not(.light) .side-dark{ --sunken:7 8 13; --surface:17 20 28; --raised:26 30 40; --line:34 38 50; }

div.kpi-row{background:rgb(var(--surface));border:1px solid rgb(var(--line));border-radius:var(--radius-lg);padding:12px 16px}

`;

/** Gradient thương hiệu dùng trong style inline (thanh tiến độ, biểu đồ) */
export const GRAD = `linear-gradient(90deg, ${BRAND.o1}, ${BRAND.o2} 55%, ${BRAND.o3})`;

/** Màu dùng trong style inline và biểu đồ (giá trị CSS theo token để đổi theo chế độ sáng / tối) */
export const C = {
  bg: 'rgb(var(--bg))',
  surface: 'rgb(var(--surface))',
  card: 'rgb(var(--raised))',
  line: 'rgba(148,163,184,.28)',
  text: 'rgb(var(--fg))',
  muted: '#94A3B8',
  orange: '#F28C28',
  teal: '#10B981',
  red: '#EF4444',
  blue: '#2563EB',
  sand: '#F5B042',
} as const;

/**
 * Ghép class Tailwind và gỡ class xung đột (class sau thắng), giống tailwind-merge rút gọn:
 * tránh lỗi inputCls có w-full / py-2 / text-sm mà truyền thêm w-auto / py-1 / text-xs không có tác dụng.
 */
export const TW_GROUPS: [RegExp, string, string[]?][] = [
  [/^w-/, 'w'], [/^h-/, 'h'], [/^min-w-/, 'minw'], [/^max-w-/, 'maxw'], [/^min-h-/, 'minh'], [/^max-h-/, 'maxh'],
  [/^p-/, 'p', ['px', 'py', 'pt', 'pb', 'pl', 'pr']], [/^px-/, 'px', ['pl', 'pr']], [/^py-/, 'py', ['pt', 'pb']], [/^pt-/, 'pt'], [/^pb-/, 'pb'], [/^pl-/, 'pl'], [/^pr-/, 'pr'],
  [/^text-(xs|sm|base|lg|xl|[2-9]xl|\[\d)/, 'fs'], [/^text-(left|center|right|justify)$/, 'ta'], [/^text-/, 'tc'],
  [/^font-(thin|light|normal|medium|semibold|bold|extrabold|black)$/, 'fw'],
  [/^(bg-(?!gradient)|g-brand$)/, 'bg'], [/^rounded(-(none|sm|md|lg|xl|2xl|3xl|full))?$/, 'rounded'], [/^border-(\[#|\[rgb|transparent|white|black)/, 'bc'], [/^shadow(-|$)/, 'shadow'],
  [/^(block|inline-block|inline|flex|inline-flex|grid|hidden)$/, 'display'], [/^justify-(start|end|center|between|around|evenly)$/, 'justify'], [/^items-/, 'items'],
];

export const vnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';

export const compact = (n: number) =>
  Math.abs(n) >= 1e9
    ? (n / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ'
    : (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';

export const pct = (a: number, b: number) =>
  (b ? ((a / b) * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '0') + '%';

export const fmtDate = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '');

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** v28 — Kho tổng mặc định: nhận phần tồn chưa phân bổ cho kho khác */
export const MAIN_WH = 'WH-MAIN';

export const INITIAL_WAREHOUSES: WarehouseInfo[] = [{ id: MAIN_WH, code: 'KHO-TONG', name: 'Kho Tổng', address: '', active: true, main: true }];

/** Tồn tự do của SKU tại một kho (kho tổng = tổng − các kho khác, không âm) */
export const whQty = (s: SkuItem, whId: string, whs: WarehouseInfo[]) => {
  const main = whs.find((w) => w.main)?.id ?? MAIN_WH;
  if (whId !== main) return Math.max(0, s.whStock?.[whId] ?? 0);
  return Math.max(0, s.stock - Object.entries(s.whStock ?? {}).reduce((a, [k, v]) => a + (k === main ? 0 : Math.max(0, v)), 0));
};

export const uid = (p: string) => `${p}${Math.random().toString(36).slice(2, 9)}`;

export const MST_RE = /^\d{10}(-\d{3})?$/;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const digits = (v: string) => Number(v.replace(/[^\d]/g, '') || 0);

export const initials = (name: string) => name.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase();

/** Sinh mã kế tiếp theo hậu tố số: LD-2026-0418, KH-000108... */
export const nextCode = (codes: string[], prefix: string, pad: number) => {
  const max = codes.reduce((m, c) => Math.max(m, Number(c.match(/(\d+)$/)?.[1] ?? 0)), 0);
  return `${prefix}${String(max + 1).padStart(pad, '0')}`;
};

export const GF_ALL: GlobalFilter = { region: 'ALL', dept: 'ALL', brand: 'ALL' };

export const gfCount = (f: GlobalFilter) => [f.region !== 'ALL', f.dept !== 'ALL', f.brand !== 'ALL'].filter(Boolean).length;

// =====================================================================
//  NHÃN CỐ ĐỊNH
// =====================================================================

export const ROLES: Role[] = ['BOD', 'MKT_LEAD', 'DEPT_HEAD', 'SALES_REP', 'ACCOUNTANT'];

export const ROLE_LABEL: Record<Role, string> = {
  BOD: 'Giám đốc BOD',
  MKT_LEAD: 'Trưởng MKT',
  DEPT_HEAD: 'Trưởng phòng',
  SALES_REP: 'Nhân viên KD / Kỹ thuật',
  ACCOUNTANT: 'Kế toán',
};

export const ROLE_DESC: Record<Role, string> = {
  BOD: 'Toàn quyền cấu hình, duyệt chi quỹ, xem toàn bộ lead, doanh thu và ROI',
  MKT_LEAD: 'Nhập lead, phân lead về phòng ban, quản lý chương trình 3M, nộp claim POP',
  DEPT_HEAD: 'Chỉ thấy lead của phòng mình, chỉ định Sales, duyệt đề xuất quỹ theo hạn mức',
  SALES_REP: 'Chỉ thấy lead được giao, cập nhật BOQ, báo giá, tải ảnh nghiệm thu',
  ACCOUNTANT: 'Đối soát hóa đơn VAT, Credit Note và cấn trừ công nợ Hãng',
};

export const MODULES: Module[] = ['home', 'overview', 'tasks', 'sales', 'leads', 'customers', 'projects', 'products', 'warehouse', 'supply', 'claims', 'jobs', 'production', 'install', 'inventory', 'cashbook', 'staff', 'docs', 'reports', 'settings', 'messages', 'contacts', 'zalo', 'marketing'];

export const MODULE_LABEL: Record<Module, string> = {
  home: 'Bàn làm việc',
  contacts: 'Danh bạ',
  warehouse: 'Kho hàng',
  overview: 'Tổng quan',
  tasks: 'Công việc',
  leads: 'Phân lead',
  customers: 'Khách hàng',
  projects: 'Dự án & BOQ',
  products: 'Sản phẩm',
  messages: 'Tin nhắn',
  zalo: 'Zalo Hub',
  marketing: 'Auto Content',
  sales: 'Bán hàng',
  supply: 'Đặt hàng & Hàng về',
  claims: 'MDF/CS',
  jobs: 'Đơn hàng công trình',
  production: 'Sản xuất',
  install: 'Lắp đặt & Nghiệm thu',
  inventory: 'Nhập xuất tồn',
  cashbook: 'Thu chi',
  staff: 'Lịch công tác',
  docs: 'Tài liệu',
  reports: 'Tài chính',
  settings: 'Cài đặt',
};

/** Nhãn ngắn cho thanh điều hướng dưới (mobile) */
export const MODULE_SHORT: Partial<Record<Module, string>> = { sales: 'Bán hàng', zalo: 'Zalo', marketing: 'Auto Content', home: 'Bàn làm việc', contacts: 'Danh bạ', warehouse: 'Kho', tasks: 'Công việc', leads: 'Lead', customers: 'Khách hàng', projects: 'Dự án', messages: 'Tin nhắn', products: 'Sản phẩm', supply: 'Đặt hàng', claims: 'MDF/CS', jobs: 'Đơn hàng', production: 'Sản xuất', install: 'Lắp đặt', inventory: 'Vật tư', cashbook: 'Thu chi', staff: 'Lịch công tác', reports: 'Công nợ', docs: 'Tài liệu', settings: 'Cài đặt', overview: 'Tổng quan' };

export const MODULE_DESC: Record<Module, string> = {
  home: 'Bảng tin nội bộ: thông báo, tin tức, sáng kiến, bình chọn, sinh nhật và việc của tôi hôm nay',
  contacts: 'Danh bạ nhân sự nội bộ và người liên hệ của khách hàng: gọi, email, chat, vCard',
  warehouse: 'Tồn kho đa kho, phiếu nhập / xuất / chuyển / kiểm kho có duyệt, thẻ kho, bảng xuất nhập tồn',
  overview: 'Burn-rate quỹ 3M và hồ sơ hoàn ứng cần xử lý',
  tasks: 'Việc cần bạn xử lý: duyệt hợp đồng, công tác, chi phí, giải phóng hàng, chỉ định lead',
  leads: 'Lead MKT đưa về, phân phòng ban và chỉ định Sales 2 bước',
  customers: 'Customer 360, lịch sử báo giá, đơn hàng Getfly và MDF ROI',
  projects: 'Cơ hội, bóc tách BOQ, báo giá và kết quả Chốt đơn / Trượt',
  messages: 'Chat nhóm dự án, tin nhắn trực tiếp, gửi file và tra cứu lịch sử trao đổi',
  zalo: 'Chat với khách qua Zalo OA và ZNS ngay trong CRM, tự liên kết hội thoại với khách hàng, đơn hàng, dự án',
  marketing: 'Plan (lịch chiến dịch & nội dung cho AI viết), Content Studio AI, Image (ảnh AI chuẩn SEO, banner), Budget (ngân sách & ROI), Automation (ZNS / Zalo / SMS / Messenger theo phân khúc)',
  products: 'Danh mục SKU dùng chung cho bóc tách BOQ, báo giá và đặt hàng Hãng',
  sales: 'Lên đơn bán trực tiếp và đơn tự tạo khi chốt báo giá: giữ hàng, xuất kho, thu tiền hoặc ghi công nợ, đề xuất mua phần thiếu',
  supply: 'PO đặt Hãng trước 3–4 tháng, các đợt hàng về, phân bổ giữ chỗ cho dự án',
  jobs: 'Đơn chờ khảo sát, tạo báo giá m² / md, nhận cọc chuyển sản xuất, theo dõi đến khi thu đủ tiền',
  production: 'Lệnh sản xuất 3 trạng thái: chờ sản xuất, đang sản xuất, đã hoàn thành rồi hẹn lắp đặt',
  install: 'Lịch lắp đặt, nghiệm thu bàn giao, ký điện tử, thu tiền và phiếu bảo hành',
  inventory: 'Danh mục vật tư, phiếu nhập, xuất cho lệnh sản xuất, kiểm kê và báo cáo nhập xuất tồn',
  cashbook: 'Sổ thu chi quỹ tiền mặt và ngân hàng, gắn chi phí theo đơn hàng',
  staff: 'Gặp khách, công tác, nghỉ việc riêng gắn với khách hàng, dự án, chương trình',
  claims: 'Kế hoạch quỹ MDF / CS, thẩm định POP và claim tiền Hãng',
  docs: 'Quy chế, chính sách hoa hồng và tài liệu kỹ thuật theo phân quyền',
  reports: 'Công nợ & tuổi nợ, quyết toán quỹ MDF, quyết toán hoa hồng, lãi gộp đơn hàng',
  settings: 'Doanh nghiệp, phòng ban, quỹ Hãng, ngân sách Marketing, Getfly, Email, Zalo ZNS',
};

export const MODULE_ICON: Record<Module, typeof Wallet> = {
  home: House,
  contacts: BookUser,
  warehouse: Boxes,
  overview: LayoutDashboard,
  tasks: ClipboardCheck,
  leads: Inbox,
  customers: Users,
  projects: Target,
  products: Package,
  messages: MessagesSquare,
  zalo: MessageCircle,
  marketing: Sparkles,
  sales: ShoppingBag,
  supply: Ship,
  claims: Briefcase,
  jobs: Ruler,
  production: Factory,
  install: HardHat,
  inventory: Warehouse,
  cashbook: Coins,
  staff: CalendarDays,
  docs: FolderOpen,
  reports: Banknote,
  settings: Settings,
};

export const ACTION_LABEL: Record<Action, string> = {
  'lead.create': 'Thêm / sửa / xóa lead',
  'lead.route': 'Phân lead về phòng ban (bước 1)',
  'lead.assign': 'Chỉ định Sales (bước 2)',
  'lead.accept': 'Tiếp nhận lead',
  'customer.edit': 'Thêm / sửa / xóa khách hàng',
  'docs.manage': 'Tải lên / sửa / xóa tài liệu',
  'program.create': 'Lập / sửa / xóa đề xuất chương trình',
  'program.approveInternal': 'Duyệt đề xuất nội bộ (theo hạn mức)',
  'program.vendorDecision': 'Ghi nhận 3M duyệt Pre-Approval',
  'claim.uploadPop': 'Tải chứng từ POP',
  'claim.verify': 'Xác minh chứng từ',
  'claim.submit': 'Xuất Audit Pack và nộp Hãng',
  'claim.accounting': 'Đối soát VAT, Credit Note, cấn trừ',
  'project.update': 'Cập nhật dự án, BOQ, báo giá',
  'price.request': 'Đề xuất bảo vệ giá',
  'price.decide': 'Ghi nhận Hãng duyệt bảo vệ giá',
  'settings.edit': 'Sửa cấu hình hệ thống',
  'mdf.margin': 'Xem thặng dư lợi nhuận quỹ MDF',
  'po.manage': 'Tạo / sửa PO, đợt hàng về, danh mục SKU',
  'stock.deliver': 'Xuất giao hàng giữ chỗ, yêu cầu trả về tồn',
  'stock.release': 'Xác nhận giải phóng hàng giữ chỗ (dự án Trượt)',
  'price.viewCost': 'Xem giá vốn nhập Hãng và lãi gộp',
  'contract.approve': 'Duyệt hợp đồng có điều khoản công nợ đặc biệt',
  'template.manage': 'Quản lý mẫu báo giá & hợp đồng',
  'activity.approve': 'Duyệt đi công tác / nghỉ việc riêng',
  'quote.approve': 'Duyệt giá & chiết khấu báo giá (GM thấp, đơn lớn)',
  'production.manage': 'Quản lý lệnh sản xuất, chuyển công đoạn, QC',
  'install.manage': 'Quản lý lắp đặt, ký biên bản nghiệm thu',
  'data.backup': 'Sao lưu / khôi phục dữ liệu',
  'security.manage': 'Quản trị bảo mật, xem nhật ký hệ thống',
  'job.manage': 'Khảo sát, báo giá, chốt đơn công trình, thu tiền',
  'receipt.confirm': 'Kế toán xác nhận tiền thu (ghi nhận doanh số)',
  'priceList.manage': 'Quản lý bảng đơn giá sản phẩm / vật liệu',
  'feed.moderate': 'Bảng tin: đăng thông báo, ghim / ẩn / xóa bài của người khác',
  'feed.poll': 'Bảng tin: tạo bình chọn',
  'stock.voucher': 'Kho hàng: lập phiếu nhập / xuất / chuyển / kiểm kho',
  'stock.approve': 'Kho hàng: duyệt phiếu kho (thủ kho của kho đó cũng được duyệt)',
  'zalo.reply': 'Zalo Hub: trả lời khách, gửi ZNS',
  'zalo.assign': 'Zalo Hub: phân công hội thoại cho nhân viên khác',
  'mkt.manage': 'Marketing Hub: chiến dịch, nội dung, phân khúc, kịch bản tự động',
  'stock.manage': 'Lập phiếu nhập / xuất / kiểm kê kho vật tư',
  'cash.manage': 'Lập phiếu thu / chi, chuyển quỹ',
  'sale.manage': 'Bán hàng: sửa hàng hóa, hủy đơn của người khác (trước khi xuất kho)',
  'sale.info': 'Bán hàng: cập nhật thông tin đơn của người khác (cả đơn đã hoàn thành, không đổi hàng hóa)',
  'sale.delete': 'Bán hàng: xóa đơn đã hủy',
  'sale.docs': 'Bán hàng: sửa / hủy chứng từ liên quan của đơn (phiếu kho, phiếu thu, hóa đơn); người khác chỉ xem',
};

export const SOURCE_LABEL: Record<Source, string> = {
  WEBSITE_FORM: 'Website',
  FACEBOOK_ADS: 'Facebook Ads',
  GOOGLE_ADS: 'Google Ads',
  ZALO_OA: 'Zalo OA',
  HOTLINE: 'Hotline',
  EXHIBITION: 'Triển lãm',
  TECH_SEMINAR: 'Hội thảo kỹ thuật',
  REFERRAL: 'Giới thiệu',
  VENDOR_REFERRAL: '3M chuyển',
};

export const REGION_LABEL: Record<Region, string> = { NORTH: 'Miền Bắc', SOUTH: 'Miền Nam' };

export const CUSTOMER_STATUS: Record<CustomerStatus, { label: string; tone: Tone }> = {
  PROSPECT: { label: 'Tiềm năng', tone: 'muted' },
  INTERESTED: { label: 'Quan tâm', tone: 'red' },
  FOLLOW: { label: 'Theo dõi', tone: 'blue' },
  ACTIVE: { label: 'Đang hợp tác', tone: 'teal' },
};

export const FUND_LABEL: Record<FundCode, string> = { MDF: 'Ngân sách MDF', CS: 'Ngân sách CS' };

export const SETTLEMENT_LABEL: Record<Settlement, string> = { LUMP_SUM: 'Khoán theo hoạt động', ACTUAL_COST: 'Hoàn ứng theo chi phí thực tế' };

export const SURPLUS_LABEL: Record<SurplusAllocation, string> = { COMPANY_PROFIT: 'Ghi nhận Lợi nhuận Công ty', REINVEST: 'Chuyển vào Quỹ Tái đầu tư Thị trường' };

export const SHIP_MODE: Record<ShipMode, { label: string; icon: typeof Wallet }> = { SEA: { label: 'Đường biển / Cont', icon: Ship }, AIR: { label: 'Đường bay', icon: Plane }, ROAD: { label: 'Đường bộ', icon: Truck } };

export const SHIPMENT_STATUS: Record<ShipmentStatus, { label: string; tone: Tone }> = {
  PLANNED: { label: 'Chờ xuất', tone: 'muted' },
  IN_TRANSIT: { label: 'Đang vận chuyển', tone: 'blue' },
  ARRIVED: { label: 'Đã cập cảng', tone: 'orange' },
  RECEIVED: { label: 'Đã nhập kho', tone: 'teal' },
};

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; tone: Tone }> = {
  HELD: { label: 'Đang giữ trong kho', tone: 'blue' },
  PENDING_RELEASE: { label: 'Chờ xác nhận giải phóng', tone: 'orange' },
  DELIVERED: { label: 'Đã giao hết', tone: 'teal' },
  RELEASED: { label: 'Đã trả về tồn tự do', tone: 'muted' },
};

export const MOVE_LABEL: Record<StockMoveType, string> = {
  RECEIVE_FREE: 'Nhập kho tồn tự do',
  RECEIVE_RESERVED: 'Nhập kho giữ chỗ',
  DELIVER: 'Xuất giao',
  RELEASE: 'Giải phóng về tồn tự do',
  TRANSFER: 'Chuyển giữ chỗ',
  RESERVE_FROM_STOCK: 'Giữ chỗ từ tồn tự do',
  WH_TRANSFER: 'Điều chuyển giữa các kho',
  ISSUE: 'Xuất kho',
  ADJUST: 'Điều chỉnh kiểm kho',
};

export const PO_PURPOSE: Record<PoPurpose, string> = { PROJECT: 'Hàng dự án / đại lý', STOCK: 'Nhập tồn kho', MIXED: 'Dự án + tồn kho' };

export const UNITS = ['Bộ', 'Cuộn', 'Cái', 'Tuýp', 'Hộp', 'Mét', 'Chai'];

export const ACTIVITY_TYPE: Record<ActivityType, { label: string; color: string; approval: boolean }> = {
  MEETING: { label: 'Gặp khách hàng', color: '#00B894', approval: false },
  SURVEY: { label: 'Khảo sát / Nghiệm thu công trình', color: '#06B6D4', approval: false },
  TRIP: { label: 'Đi công tác ngoại tỉnh / Hãng', color: '#1F74D4', approval: true },
  LEAVE: { label: 'Nghỉ việc riêng / Đi muộn có lý do', color: '#EF4444', approval: true },
  TRAINING: { label: 'Đào tạo / hội thảo', color: '#8B5CF6', approval: false },
  EVENT: { label: 'Sự kiện chương trình', color: '#F28C33', approval: false },
  OTHER: { label: 'Khác', color: '#94A3B8', approval: false },
};

export const LEAVE_KIND: Record<LeaveKind, string> = { LEAVE: 'Nghỉ việc riêng', LATE: 'Đi muộn có lý do', EARLY: 'Về sớm có lý do', NO_CHECKIN: 'Giải trình không chấm công' };

export const ACTIVITY_STATUS: Record<ActivityStatus, { label: string; tone: Tone }> = {
  PLANNED: { label: 'Đã lên lịch', tone: 'blue' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', tone: 'orange' },
  NEED_INFO: { label: 'Cần bổ sung', tone: 'orange' },
  APPROVED: { label: 'Đã duyệt', tone: 'teal' },
  REJECTED: { label: 'Từ chối', tone: 'red' },
  DONE: { label: 'Hoàn thành', tone: 'teal' },
  CANCELLED: { label: 'Đã hủy', tone: 'muted' },
};

export const EXPENSE_STATUS: Record<ExpenseStatus, { label: string; tone: Tone }> = {
  SUBMITTED: { label: 'Chờ Trưởng phòng duyệt chi', tone: 'orange' },
  HEAD_APPROVED: { label: 'Chờ Kế toán thanh toán', tone: 'blue' },
  PAID: { label: 'Đã thanh toán', tone: 'teal' },
  REJECTED: { label: 'Chi phí bị từ chối', tone: 'red' },
};

export const TRANSPORTS = ['Xe công ty', 'Xe cá nhân', 'Máy bay', 'Tàu / xe khách', 'Taxi / Grab'];

export const TX_TYPE: Record<TxType, { label: string; tier: PriceTier; credit: number; delivery: string }> = {
  DEALER: { label: 'Đại lý phân phối', tier: 'DEALER', credit: 30, delivery: 'Giao tại kho Bên A trong 3–5 ngày làm việc kể từ khi xác nhận đơn hàng' },
  PROJECT_ME: { label: 'Dự án M&E', tier: 'PROJECT', credit: 45, delivery: 'Giao theo tiến độ thi công, mỗi đợt thông báo trước 7 ngày' },
  SUPPLY_INSTALL: { label: 'Cung cấp & Lắp đặt', tier: 'PROJECT', credit: 30, delivery: 'Cung cấp vật tư và hoàn thành lắp đặt trong 30 ngày kể từ ngày nhận mặt bằng' },
  RETAIL_CASH: { label: 'Bán lẻ thanh toán ngay', tier: 'BASE', credit: 0, delivery: 'Giao ngay khi thanh toán hoặc trong 1–2 ngày làm việc' },
  FACTORY: { label: 'Nhà máy / người dùng cuối', tier: 'BASE', credit: 30, delivery: 'Giao tại kho nhà máy Bên A trong 5–7 ngày làm việc' },
  EPC_SUB: { label: 'Thầu phụ cho Tổng thầu EPC', tier: 'PROJECT', credit: 60, delivery: 'Giao theo tiến độ hợp đồng chính giữa Tổng thầu và Chủ đầu tư' },
  FRAMEWORK: { label: 'Hợp đồng nguyên tắc năm', tier: 'DEALER', credit: 30, delivery: 'Giao theo từng đơn đặt hàng cụ thể trong thời hạn hợp đồng' },
  SAMPLE: { label: 'Mẫu thử nghiệm (Field Test)', tier: 'PROJECT', credit: 15, delivery: 'Giao mẫu trong 7 ngày làm việc, kèm hướng dẫn thử nghiệm' },
  SERVICE: { label: 'Bảo trì & dịch vụ kỹ thuật', tier: 'BASE', credit: 30, delivery: 'Thực hiện theo lịch bảo trì đã thống nhất' },
  TRADING: { label: 'Bán buôn cho công ty thương mại', tier: 'DEALER', credit: 30, delivery: 'Giao tại kho Bên B, Bên A tự vận chuyển' },
};

export const PRICE_TIER: Record<PriceTier, string> = { BASE: 'Giá bán lẻ', DEALER: 'Giá đại lý', PROJECT: 'Giá dự án M&E', BOQ: 'Theo BOQ đã duyệt' };

export const GUARANTEE_LABEL: Record<GuaranteeType, string> = { NONE: 'Không yêu cầu', PERFORMANCE: 'Bảo lãnh thực hiện hợp đồng', ADVANCE: 'Bảo lãnh hoàn trả tạm ứng', WARRANTY: 'Bảo lãnh bảo hành' };

export const GENDOC_STATUS: Record<GenDocStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Nháp', tone: 'muted' },
  ISSUED: { label: 'Hiệu lực', tone: 'teal' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', tone: 'orange' },
  APPROVED: { label: 'Đã duyệt, hiệu lực', tone: 'teal' },
  REJECTED: { label: 'Bị từ chối', tone: 'red' },
  SUPERSEDED: { label: 'Đã thay thế', tone: 'muted' },
};

export const LEAD_STATUS: Record<LeadStatus, { label: string; tone: Tone }> = {
  NEW: { label: 'Mới', tone: 'orange' },
  NURTURE: { label: 'Nuôi dưỡng', tone: 'muted' },
  ROUTED: { label: 'Chờ TP giao việc', tone: 'orange' },
  ASSIGNED: { label: 'Chờ Sales tiếp nhận', tone: 'orange' },
  ACCEPTED: { label: 'Khảo sát & báo giá', tone: 'blue' },
  QUOTED: { label: 'Đã gửi báo giá', tone: 'orange' },
  WON: { label: 'Chốt đơn', tone: 'teal' },
  LOST: { label: 'Trượt', tone: 'red' },
};

export const LOST_REASON: Record<LostReason, string> = {
  PRICE: 'Giá cao',
  SCHEDULE: 'Chậm tiến độ',
  TECHNICAL: 'Trượt kỹ thuật',
  COMPETITOR: 'Đối thủ cạnh tranh',
};

/** Thẩm quyền duyệt báo giá theo biên lợi nhuận gộp (GM%) */
/** GM dưới 25% cần Trưởng phòng; dưới 15% hoặc đơn trên 1 tỷ cần BOD */
export const GM_RULE = { head: 25, bod: 15, bigDeal: 1e9 };

export const APPROVAL_LEVEL: Record<ApprovalLevel, { label: string; tone: Tone }> = {
  AUTO: { label: 'Tự động duyệt', tone: 'teal' },
  HEAD: { label: 'Cần Trưởng phòng duyệt', tone: 'orange' },
  BOD: { label: 'Cần BOD duyệt', tone: 'red' },
};

/** Lý do cần duyệt giá (hiển thị cho người duyệt) */
export const approvalReasons = (gm: number | null, amount: number): string[] => [
  ...(gm === null ? ['Thiếu giá vốn một số SKU, chưa tính được GM'] : gm < GM_RULE.bod ? [`GM ${gm.toFixed(1)}% dưới ${GM_RULE.bod}%`] : gm < GM_RULE.head ? [`GM ${gm.toFixed(1)}% dưới ${GM_RULE.head}%`] : []),
  ...(amount > GM_RULE.bigDeal ? [`Đơn ${compact(amount)} trên 1 tỷ`] : []),
];

// ---------------- v48: QUY TRÌNH & PHÊ DUYỆT (bộ máy) ----------------
export const WF_POLICY: WfPolicy = { noSelf: true, soleBodSelf: true, bodOverride: true, escalate: true, leaveDelegate: true };

export const WF_WHO_LABEL: Record<WfWhoKind, string> = { DEPT_HEAD: 'Trưởng phòng của khách / dự án', MANAGER: 'Quản lý trực tiếp của người gửi', ROLE: 'Theo vai trò', USER: 'Người cụ thể', WH_MANAGER: 'Thủ kho của kho / người duyệt phiếu kho' };

export const WF_OP_LABEL: Record<WfOp, string> = { lt: 'nhỏ hơn', gt: 'lớn hơn', eq: 'bằng', ne: 'khác', empty: 'chưa có' };

/** Trường dùng trong điều kiện của từng quy trình có sẵn */
export const WF_FIELDS: Record<string, { id: string; label: string; unit?: string }[]> = {
  QUOTE: [{ id: 'gm', label: 'Lãi gộp', unit: '%' }, { id: 'amount', label: 'Giá trị trước VAT', unit: 'đ' }, { id: 'maxDisc', label: 'Chiết khấu dòng lớn nhất', unit: '%' }],
  CONTRACT: [{ id: 'amount', label: 'Giá trị sau VAT', unit: 'đ' }, { id: 'special', label: 'Số điều khoản đặc biệt' }],
  ACTIVITY: [{ id: 'amount', label: 'Chi phí đề xuất', unit: 'đ' }, { id: 'days', label: 'Số ngày' }],
  EXPENSE: [{ id: 'amount', label: 'Tổng chứng từ', unit: 'đ' }],
  PROGRAM: [{ id: 'amount', label: 'Giữ chỗ quỹ', unit: 'đ' }],
  CLAIM: [{ id: 'amount', label: 'Giá trị claim', unit: 'đ' }],
  VOUCHER: [{ id: 'amount', label: 'Giá trị phiếu', unit: 'đ' }],
  SALE: [{ id: 'maxDisc', label: 'Chiết khấu dòng lớn nhất', unit: '%' }, { id: 'overLimit', label: 'Vượt hạn mức nợ', unit: 'đ' }, { id: 'amount', label: 'Tổng đơn', unit: 'đ' }],
  SALE_PAY: [{ id: 'amount', label: 'Số tiền', unit: 'đ' }],
  CONTENT: [],
  JOB_QUOTE: [{ id: 'gm', label: 'Lãi gộp dự toán', unit: '%' }, { id: 'amount', label: 'Giá trị', unit: 'đ' }],
  DESIGN: [],
  RECEIPT: [{ id: 'amount', label: 'Số tiền', unit: 'đ' }],
};

export const wfStep = (id: string, name: string, who: WfWho, slaMin: number, extra: Partial<WfStep> = {}): WfStep => ({ id, name, who, slaMin, allowNeedInfo: true, ...extra });

export const BOD_WHO: WfWho = { kind: 'ROLE', role: 'BOD' };

/** 13 quy trình có sẵn, giữ đúng cách duyệt của các bản trước (thêm bước Giám đốc có điều kiện cho báo giá, hợp đồng lớn) */
export const WF_DEFAULTS: WfDef[] = [
  { key: 'QUOTE', name: 'Duyệt giá báo giá', group: 'Bán hàng', builtin: true, enabled: true, version: 1,
    trigger: [{ field: 'gm', op: 'lt', value: 25 }, { field: 'gm', op: 'empty' }, { field: 'amount', op: 'gt', value: 1e9 }], skipText: 'Báo giá nháp khách lẻ (không MST, công nợ 0 ngày)',
    steps: [wfStep('q1', 'Trưởng phòng duyệt', { kind: 'DEPT_HEAD' }, 240, { perm: 'quote.approve' }), wfStep('q2', 'Giám đốc duyệt', BOD_WHO, 240, { when: [{ field: 'gm', op: 'lt', value: 15 }, { field: 'amount', op: 'gt', value: 1e9 }] })] },
  { key: 'CONTRACT', name: 'Duyệt hợp đồng', group: 'Bán hàng', builtin: true, lockEnable: true, enabled: true, version: 1, trigger: [], triggerText: 'Có điều khoản khác mẫu (điều khoản đặc biệt)',
    steps: [wfStep('c1', 'Trưởng phòng duyệt', { kind: 'DEPT_HEAD' }, 480, { perm: 'contract.approve' }), wfStep('c2', 'Giám đốc duyệt', BOD_WHO, 480, { when: [{ field: 'amount', op: 'gt', value: 2e9 }] })] },
  { key: 'SALE', name: 'Đơn bán: giảm giá, vượt hạn mức nợ', group: 'Bán hàng', builtin: true, enabled: true, version: 1, mode: 'TRADING',
    trigger: [{ field: 'maxDisc', op: 'gt', value: 10 }, { field: 'overLimit', op: 'gt', value: 0 }], skipText: 'Đơn tự tạo từ báo giá đã duyệt',
    steps: [wfStep('s1', 'Trưởng phòng duyệt', { kind: 'DEPT_HEAD' }, 120)] },
  { key: 'SALE_PAY', name: 'Xác nhận tiền thu đơn bán', group: 'Tài chính', builtin: true, lockSteps: true, lockEnable: true, enabled: true, version: 1, trigger: [], triggerText: 'Tiền do người không có quyền quỹ ghi nhận',
    steps: [wfStep('p1', 'Kế toán xác nhận', { kind: 'ROLE', role: 'ACCOUNTANT' }, 240, { perm: 'receipt.confirm', allowNeedInfo: false })] },
  { key: 'ACTIVITY', name: 'Công tác / nghỉ / giải trình công', group: 'Nhân sự & công tác', builtin: true, lockEnable: true, enabled: true, version: 1, trigger: [], triggerText: 'Công tác, nghỉ, giải trình; gặp khách / khảo sát có chi phí',
    steps: [wfStep('a1', 'Quản lý trực tiếp duyệt', { kind: 'MANAGER' }, 240, { perm: 'activity.approve' })] },
  { key: 'EXPENSE', name: 'Chi phí công tác', group: 'Nhân sự & công tác', builtin: true, lockSteps: true, lockEnable: true, enabled: true, version: 1, trigger: [], triggerText: 'Mọi chứng từ chi phí',
    steps: [wfStep('e1', 'Trưởng phòng duyệt chi', { kind: 'MANAGER' }, 1440, { perm: 'activity.approve', allowNeedInfo: false }), wfStep('e2', 'Kế toán thanh toán', { kind: 'ROLE', role: 'ACCOUNTANT' }, 1440, { perm: 'claim.accounting', allowNeedInfo: false })] },
  { key: 'PROGRAM', name: 'Đề xuất chi quỹ MDF', group: 'Quỹ Hãng', builtin: true, lockEnable: true, enabled: true, version: 1, mode: 'TRADING', trigger: [], triggerText: 'Mọi đề xuất (sau khi duyệt nội bộ: chờ 3M Pre-Approval)',
    steps: [wfStep('m1', 'Trưởng phòng trong hạn mức', { kind: 'DEPT_HEAD' }, 1440, { perm: 'program.approveInternal', userLimit: true, allowNeedInfo: false })] },
  { key: 'CLAIM', name: 'Thẩm định POP và đối soát hóa đơn', group: 'Quỹ Hãng', builtin: true, lockSteps: true, lockEnable: true, enabled: true, version: 1, mode: 'TRADING', trigger: [], triggerText: 'Có chứng từ POP mới / hóa đơn claim',
    steps: [wfStep('k1', 'Thẩm định POP (khác người đề xuất)', { kind: 'ROLE', role: 'MKT_LEAD' }, 2880, { perm: 'claim.verify', allowNeedInfo: false }), wfStep('k2', 'Kế toán đối soát hóa đơn', { kind: 'ROLE', role: 'ACCOUNTANT' }, 2880, { perm: 'claim.accounting', allowNeedInfo: false })] },
  { key: 'VOUCHER', name: 'Phiếu kho (nhập, xuất, chuyển, kiểm)', group: 'Kho', builtin: true, lockEnable: true, enabled: true, version: 1, mode: 'TRADING', trigger: [], triggerText: 'Mọi phiếu lập bởi người không có quyền duyệt',
    steps: [wfStep('v1', 'Thủ kho / Kế toán duyệt', { kind: 'WH_MANAGER' }, 240, { allowNeedInfo: false })] },
  { key: 'CONTENT', name: 'Nội dung marketing', group: 'Marketing', builtin: true, lockEnable: true, enabled: true, version: 1, trigger: [], triggerText: 'Bài gửi duyệt từ Content Studio',
    steps: [wfStep('n1', 'Trưởng MKT duyệt (khác người viết)', { kind: 'ROLE', role: 'MKT_LEAD' }, 1440, { perm: 'mkt.manage' })] },
  { key: 'JOB_QUOTE', name: 'Báo giá xưởng lãi gộp thấp', group: 'Xưởng', builtin: true, enabled: true, version: 1, mode: 'MFG',
    trigger: [{ field: 'gm', op: 'lt', value: 25 }],
    steps: [wfStep('j1', 'Trưởng phòng duyệt', { kind: 'DEPT_HEAD' }, 240, { perm: 'quote.approve' }), wfStep('j2', 'Giám đốc duyệt', BOD_WHO, 240, { when: [{ field: 'gm', op: 'lt', value: 15 }] })] },
  { key: 'DESIGN', name: 'Duyệt bản vẽ triển khai', group: 'Xưởng', builtin: true, lockEnable: true, enabled: true, version: 1, mode: 'MFG', trigger: [], triggerText: 'Bản vẽ gửi duyệt trước khi cắt',
    steps: [wfStep('d1', 'Quản lý sản xuất duyệt', { kind: 'ROLE', role: 'DEPT_HEAD' }, 480, { perm: 'production.manage' })] },
  { key: 'RECEIPT', name: 'Xác nhận tiền thu đơn hàng', group: 'Tài chính', builtin: true, lockSteps: true, lockEnable: true, enabled: true, version: 1, mode: 'MFG', trigger: [], triggerText: 'Phiếu thu nộp về kế toán',
    steps: [wfStep('r1', 'Kế toán xác nhận', { kind: 'ROLE', role: 'ACCOUNTANT' }, 240, { perm: 'receipt.confirm', allowNeedInfo: false })] },
];

export const wfCondOk = (c: WfCond, s: WfSubject) => {
  const v = s.vals[c.field];
  if (c.op === 'empty') return v === null || v === undefined || v === '';
  if (v === null || v === undefined || v === '') return false;
  if (c.op === 'lt') return Number(v) < Number(c.value);
  if (c.op === 'gt') return Number(v) > Number(c.value);
  if (c.op === 'eq') return String(v) === String(c.value);
  return String(v) !== String(c.value);
};

export const wfNeeds = (d: WfDef | undefined, s: WfSubject) => !!d && d.enabled && (!d.trigger.length || d.trigger.some((c) => wfCondOk(c, s)));

export const wfFieldLabel = (d: WfDef, id: string) => (WF_FIELDS[d.key] ?? []).find((f) => f.id === id)?.label ?? d.form?.find((f) => f.id === id)?.label ?? id;

export const wfCondText = (d: WfDef, c: WfCond) => {
  const f = (WF_FIELDS[d.key] ?? []).find((x) => x.id === c.field);
  const val = c.op === 'empty' ? '' : f?.unit === 'đ' || d.form?.find((x) => x.id === c.field)?.type === 'MONEY' ? compact(Number(c.value)) : `${c.value}${f?.unit === '%' ? '%' : ''}`;
  return c.op === 'empty' ? `${wfFieldLabel(d, c.field)} chưa có` : `${wfFieldLabel(d, c.field)} ${c.op === 'lt' ? '<' : c.op === 'gt' ? '>' : c.op === 'eq' ? '=' : '≠'} ${val}`;
};

/** Lý do cần duyệt: các điều kiện khớp */
export const wfReasons = (d: WfDef, s: WfSubject) => d.trigger.filter((c) => wfCondOk(c, s)).map((c) => wfCondText(d, c));

export const wfHasPerm = (u: User, a: Action, c: WfCtx) => c.perms.users?.[u.id]?.actions?.[a] ?? (c.perms.actions[a] ?? INITIAL_PERMS.actions[a] ?? []).includes(u.role);

export const wfHeadOf = (dept: string | undefined, c: WfCtx) => { const d = c.departments.find((x) => x.code === dept); return c.users.find((u) => u.id === d?.headId && u.active); };

export const wfBods = (c: WfCtx) => c.users.filter((u) => u.active && u.role === 'BOD');

export const wfDayOf = (t: number) => iso(new Date(t));

export const wfOnLeave = (u: User, c: WfCtx) => c.activities.some((a) => a.userId === u.id && a.type === 'LEAVE' && a.status === 'APPROVED' && (a.leaveKind ?? 'LEAVE') === 'LEAVE' && Date.parse(a.from) <= c.now && Date.parse(a.to) >= c.now);

export const wfDelegateOf = (u: User, c: WfCtx) => { const day = wfDayOf(c.now); const d = c.delegations.find((x) => x.fromId === u.id && x.from <= day && x.to >= day); return d ? c.users.find((x) => x.id === d.toId && x.active) : undefined; };

export const wfOverdue = (step: WfStep, startedAt: number, now: number) => now > startedAt + step.slaMin * 60_000;

/** Mẫu đề nghị dựng sẵn */
export const wfF = (id: string, label: string, type: WfFieldType, required = false, options?: string[]): WfField => ({ id, label, type, required, options });

export const WF_TEMPLATES: Omit<WfDef, 'key' | 'version' | 'enabled'>[] = [
  { name: 'Đề nghị mua tài sản', group: 'Hành chính & tài sản', desc: 'Mua máy tính, thiết bị, dụng cụ', prefix: 'TS', after: ['NOTIFY', 'CASH_OUT'], trigger: [],
    form: [wfF('title', 'Tiêu đề đề nghị', 'TEXT', true), wfF('item', 'Tài sản cần mua', 'LONG', true), wfF('amount', 'Số tiền dự kiến', 'MONEY', true), wfF('vendor', 'Nhà cung cấp đề xuất', 'TEXT'), wfF('need', 'Ngày cần có', 'DATE'), wfF('quote', 'Báo giá nhà cung cấp', 'FILE', true)],
    steps: [wfStep('t1', 'Trưởng phòng duyệt', { kind: 'MANAGER' }, 480), wfStep('t2', 'Giám đốc duyệt', BOD_WHO, 1440, { when: [{ field: 'amount', op: 'gt', value: 20e6 }] }), wfStep('t3', 'Kế toán chi tiền', { kind: 'ROLE', role: 'ACCOUNTANT' }, 1440)] },
  { name: 'Đề nghị tạm ứng', group: 'Tài chính', desc: 'Tạm ứng công tác, mua hàng', prefix: 'TU', after: ['NOTIFY', 'CASH_OUT'], trigger: [],
    form: [wfF('title', 'Nội dung tạm ứng', 'TEXT', true), wfF('amount', 'Số tiền', 'MONEY', true), wfF('back', 'Ngày hoàn ứng', 'DATE', true), wfF('note', 'Ghi chú', 'LONG')],
    steps: [wfStep('t1', 'Trưởng phòng duyệt', { kind: 'MANAGER' }, 480), wfStep('t2', 'Kế toán chi tiền', { kind: 'ROLE', role: 'ACCOUNTANT' }, 1440)] },
  { name: 'Đề nghị thanh toán nhà cung cấp', group: 'Tài chính', desc: 'Thanh toán hóa đơn đầu vào', prefix: 'TT', after: ['NOTIFY', 'CASH_OUT'], trigger: [],
    form: [wfF('title', 'Nội dung thanh toán', 'TEXT', true), wfF('vendor', 'Nhà cung cấp', 'TEXT', true), wfF('amount', 'Số tiền', 'MONEY', true), wfF('invoice', 'Hóa đơn / chứng từ', 'FILE', true), wfF('due', 'Hạn thanh toán', 'DATE')],
    steps: [wfStep('t1', 'Người phụ trách xác nhận', { kind: 'MANAGER' }, 480), wfStep('t2', 'Kế toán kiểm tra', { kind: 'ROLE', role: 'ACCOUNTANT' }, 1440), wfStep('t3', 'Giám đốc duyệt chi', BOD_WHO, 1440, { when: [{ field: 'amount', op: 'gt', value: 50e6 }] })] },
  { name: 'Đề nghị cấp văn phòng phẩm', group: 'Hành chính & tài sản', desc: 'Giấy, mực, dụng cụ văn phòng', prefix: 'VP', after: ['NOTIFY'], trigger: [],
    form: [wfF('title', 'Cần cấp', 'TEXT', true), wfF('list', 'Danh sách, số lượng', 'LONG', true), wfF('amount', 'Giá trị ước tính', 'MONEY')],
    steps: [wfStep('t1', 'Quản lý trực tiếp duyệt', { kind: 'MANAGER' }, 480)] },
  { name: 'Đề nghị tuyển dụng', group: 'Nhân sự', desc: 'Bổ sung nhân sự', prefix: 'TD', after: ['NOTIFY'], trigger: [],
    form: [wfF('title', 'Vị trí cần tuyển', 'TEXT', true), wfF('qty', 'Số lượng', 'NUMBER', true), wfF('reason', 'Lý do', 'LONG', true), wfF('salary', 'Mức lương dự kiến', 'MONEY'), wfF('start', 'Ngày cần nhận việc', 'DATE')],
    steps: [wfStep('t1', 'Trưởng phòng đề xuất', { kind: 'MANAGER' }, 1440), wfStep('t2', 'Giám đốc duyệt', BOD_WHO, 2880)] },
];

export const WF_FIELD_TYPE: Record<WfFieldType, string> = { TEXT: 'Chữ ngắn', LONG: 'Chữ dài', NUMBER: 'Số', MONEY: 'Số tiền', DATE: 'Ngày', SELECT: 'Chọn 1', MULTI: 'Chọn nhiều', FILE: 'File / ảnh', USER: 'Người trong công ty', LINK: 'Khách hàng / dự án' };

/** Giá trị trường số của đề nghị tự tạo dùng cho điều kiện */
export const wfFormVals = (d: WfDef, form: Record<string, string>) => Object.fromEntries((d.form ?? []).map((f) => [f.id, f.type === 'NUMBER' || f.type === 'MONEY' ? (form[f.id] ? Number(form[f.id]) : null) : form[f.id] ?? null]));

export const wfAmountOf = (d: WfDef, form: Record<string, string>) => { const f = (d.form ?? []).find((x) => x.type === 'MONEY'); return f && form[f.id] ? Number(form[f.id]) : undefined; };

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; tone: Tone }> = {
  SENT: { label: 'Đã gửi', tone: 'orange' },
  REVISED: { label: 'Đã điều chỉnh', tone: 'muted' },
  ACCEPTED: { label: 'Khách chấp nhận', tone: 'teal' },
  REJECTED: { label: 'Khách từ chối', tone: 'red' },
};

export const PROGRAM_STATUS: Record<ProgramStatus, { label: string; tone: Tone }> = {
  PENDING_INTERNAL: { label: 'Chờ duyệt nội bộ', tone: 'orange' },
  PENDING_VENDOR: { label: 'Chờ 3M duyệt', tone: 'orange' },
  APPROVED: { label: '3M đã duyệt', tone: 'teal' },
  CLAIMING: { label: 'Đang làm claim', tone: 'blue' },
  CLOSED: { label: 'Đã quyết toán', tone: 'teal' },
  REJECTED: { label: 'Bị từ chối', tone: 'red' },
  CANCELLED: { label: 'Đã hủy', tone: 'muted' },
};

export const PP_STATUS: Record<PriceProtection['status'], { label: string; tone: Tone }> = {
  REQUESTED: { label: 'Chờ 3M duyệt giá', tone: 'orange' },
  APPROVED: { label: '3M đã bảo vệ giá', tone: 'teal' },
  REJECTED: { label: '3M từ chối', tone: 'red' },
};

export const TONES: Tone[] = ['blue', 'orange', 'teal', 'muted', 'red'];

export const deptIcon = (code?: DeptCode): typeof Wallet =>
  code?.startsWith('EMD') ? Zap : code === 'FACTORY_SALES' ? Building2 : code === 'MARKETING' ? Megaphone : code === 'ACCOUNTING' ? ReceiptIcon : Briefcase;

export const OPEN_STATUSES: LeadStatus[] = ['ROUTED', 'ASSIGNED', 'ACCEPTED', 'QUOTED'];

export const QUOTE_SLA_MS = 24 * 3600_000;

export const DEMO_PASSWORD = '123456';

// =====================================================================
//  DANH MỤC CẤU HÌNH ĐỘNG (bảng tra cứu)
//  Chỉ được ghi bởi syncCatalog(); mọi nơi khác chỉ đọc.
// =====================================================================

export const SEGMENT_LABEL: Record<Segment, string> = {};

export const SEGMENT_PTS: Record<Segment, number> = {};

export const TIER: Record<Tier, { label: string; tone: Tone }> = {};

export const TIERS: Tier[] = [];

export const PROGRAM_TYPES: ProgramType[] = [];

export const PROGRAM_LABEL: Record<ProgramType, string> = {};

export const PROGRAM_COLOR: Record<ProgramType, string> = {};

export const PROGRAM_FUND: Record<ProgramType, FundCode> = {};

export const PROGRAM_BUDGET: Record<ProgramType, number> = {};

export const PROGRAM_REQUIRED: Record<ProgramType, PopType[]> = {};

export const PROGRAM_SETTLEMENT: Record<ProgramType, Settlement> = {};

export const POP_TYPES: PopType[] = [];

export const POP_LABEL: Record<PopType, string> = {};

export const CUSTOMER_SOURCE: Record<string, CustomerSource> = {};

export const tierInfo = (t: Tier) => TIER[t] ?? { label: t, tone: 'muted' as Tone };

export const segName = (s: Segment) => SEGMENT_LABEL[s] ?? s;

export const progName = (t: ProgramType) => PROGRAM_LABEL[t] ?? t;

export const isMktCustomer = (c: Customer) => !!CUSTOMER_SOURCE[c.sourceId]?.isMarketing;

// =====================================================================
//  DỮ LIỆU KHỞI TẠO — chỉ cấu hình nghiệp vụ, không có dữ liệu mẫu
//  (lead, khách hàng, dự án, quỹ, PO, kho... bắt đầu rỗng)
// =====================================================================

export const INITIAL_COMPANY: CompanyInfo = {
  appName: 'VASSH-CRM',
  legalName: 'VASSH',
  shortName: 'VASSH',
  taxCode: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  representative: '',
  representativeTitle: 'Giám đốc',
  bankAccount: '',
  bankName: '',
};

export const INITIAL_DEPARTMENTS: Department[] = [
  { code: 'FACTORY_SALES', name: 'Phòng Kinh doanh Nhà máy', short: 'KD Nhà máy', slaMinutes: 120, receivesLeads: true, active: true },
  { code: 'EMD_NORTH', name: 'Phòng EMD Miền Bắc', short: 'EMD Bắc', slaMinutes: 120, receivesLeads: true, active: true },
  { code: 'EMD_SOUTH', name: 'Phòng EMD Miền Nam', short: 'EMD Nam', slaMinutes: 120, receivesLeads: true, active: true },
  { code: 'GENERAL', name: 'Phòng Tổng Hợp', short: 'Tổng hợp', slaMinutes: 240, receivesLeads: false, active: true },
  { code: 'MARKETING', name: 'Phòng Marketing', short: 'Marketing', slaMinutes: 240, receivesLeads: false, active: true },
  { code: 'ACCOUNTING', name: 'Phòng Kế toán', short: 'Kế toán', slaMinutes: 240, receivesLeads: false, active: true },
];

/** Chỉ có 1 tài khoản quản trị để đăng nhập lần đầu; nhân sự khác thêm ở Cài đặt > Phòng ban & Nhân sự */
export const INITIAL_USERS: User[] = [
  { id: 'admin', name: 'Quản trị hệ thống', email: 'admin@vassh.vn', role: 'BOD', active: true, approvalLimit: 1_500_000_000 },
];

/** Tài khoản đại diện khi chuyển nhanh vai trò trên header */
export const ROLE_PERSONA: Record<Role, string> = { BOD: 'admin', MKT_LEAD: '', DEPT_HEAD: '', SALES_REP: '', ACCOUNTANT: '' };

export const allModules = (v: boolean) => Object.fromEntries(MODULES.map((m) => [m, v])) as Record<Module, boolean>;

export const INITIAL_PERMS: Perms = {
  modules: {
    BOD: allModules(true),
    MKT_LEAD: { ...allModules(true), cashbook: false, inventory: false, warehouse: false, sales: false },
    DEPT_HEAD: { ...allModules(true), settings: false },
    SALES_REP: { ...allModules(true), reports: false, settings: false, cashbook: false, marketing: false },
    ACCOUNTANT: { ...allModules(true), leads: false, zalo: false, marketing: false },
  },
  actions: {
    'lead.create': ['BOD', 'MKT_LEAD'],
    'lead.route': ['BOD', 'MKT_LEAD'],
    'lead.assign': ['BOD', 'DEPT_HEAD'],
    'lead.accept': ['BOD', 'DEPT_HEAD', 'SALES_REP'],
    'customer.edit': ['BOD', 'MKT_LEAD', 'DEPT_HEAD'],
    'docs.manage': ['BOD', 'MKT_LEAD'],
    'program.create': ['BOD', 'MKT_LEAD', 'DEPT_HEAD'],
    'program.approveInternal': ['BOD', 'DEPT_HEAD'],
    'program.vendorDecision': ['BOD', 'MKT_LEAD'],
    'claim.uploadPop': ['BOD', 'MKT_LEAD', 'DEPT_HEAD', 'SALES_REP'],
    'claim.verify': ['BOD', 'MKT_LEAD', 'ACCOUNTANT'],
    'claim.submit': ['BOD', 'MKT_LEAD'],
    'claim.accounting': ['BOD', 'ACCOUNTANT'],
    'project.update': ['BOD', 'DEPT_HEAD', 'SALES_REP'],
    'price.request': ['BOD', 'DEPT_HEAD', 'SALES_REP'],
    'price.decide': ['BOD', 'MKT_LEAD'],
    'settings.edit': ['BOD'],
    'feed.moderate': ['BOD', 'MKT_LEAD'],
    'feed.poll': ['BOD', 'MKT_LEAD', 'DEPT_HEAD'],
    'stock.voucher': ['BOD', 'DEPT_HEAD', 'SALES_REP', 'ACCOUNTANT'],
    'stock.approve': ['BOD', 'ACCOUNTANT'],
    'zalo.reply': ['BOD', 'MKT_LEAD', 'DEPT_HEAD', 'SALES_REP'],
    'zalo.assign': ['BOD', 'MKT_LEAD', 'DEPT_HEAD'],
    'mkt.manage': ['BOD', 'MKT_LEAD'],
    'mdf.margin': ['BOD', 'ACCOUNTANT'],
    'po.manage': ['BOD', 'DEPT_HEAD', 'ACCOUNTANT'],
    'stock.deliver': ['BOD', 'DEPT_HEAD', 'ACCOUNTANT'],
    'stock.release': ['BOD', 'DEPT_HEAD'],
    'price.viewCost': ['BOD', 'DEPT_HEAD'],
    'contract.approve': ['BOD', 'DEPT_HEAD'],
    'template.manage': ['BOD', 'MKT_LEAD'],
    'activity.approve': ['BOD', 'DEPT_HEAD'],
    'quote.approve': ['BOD', 'DEPT_HEAD'],
    'production.manage': ['BOD', 'DEPT_HEAD'],
    'install.manage': ['BOD', 'DEPT_HEAD', 'SALES_REP'],
    'data.backup': ['BOD'],
    'security.manage': ['BOD'],
    'job.manage': ['BOD', 'DEPT_HEAD', 'SALES_REP'],
    'receipt.confirm': ['BOD', 'ACCOUNTANT'],
    'priceList.manage': ['BOD', 'DEPT_HEAD'],
    'stock.manage': ['BOD', 'DEPT_HEAD', 'ACCOUNTANT'],
    'cash.manage': ['BOD', 'ACCOUNTANT'],
    'sale.manage': ['BOD', 'DEPT_HEAD'],
    'sale.info': ['BOD', 'DEPT_HEAD', 'ACCOUNTANT'],
    'sale.delete': ['BOD'],
    'sale.docs': ['BOD', 'ACCOUNTANT'],
  },
};

export const INITIAL_SEGMENTS: SegmentDef[] = [
  { code: 'EPC_CONTRACTOR', name: 'Tổng thầu / Nhà thầu M&E', deptNorth: 'EMD_NORTH', deptSouth: 'EMD_SOUTH', mdfEligible: true, points: 20 },
  { code: 'DEALER_L1', name: 'Đại lý phân phối cấp 1', deptNorth: 'EMD_NORTH', deptSouth: 'EMD_SOUTH', mdfEligible: true, points: 18 },
  { code: 'DEALER_L2', name: 'Đại lý phân phối cấp 2', deptNorth: 'EMD_NORTH', deptSouth: 'EMD_SOUTH', mdfEligible: true, points: 14 },
  { code: 'INVESTOR_OWNER', name: 'Chủ đầu tư', deptNorth: 'EMD_NORTH', deptSouth: 'EMD_SOUTH', mdfEligible: true, points: 20 },
  { code: 'CONSULTANT', name: 'Tư vấn thiết kế', deptNorth: 'EMD_NORTH', deptSouth: 'EMD_SOUTH', mdfEligible: false, points: 16 },
  { code: 'RETAILER', name: 'Cửa hàng vật tư điện', deptNorth: 'EMD_NORTH', deptSouth: 'EMD_SOUTH', mdfEligible: true, points: 10 },
  { code: 'WORKSHOP', name: 'Xưởng cơ điện & nhôm kính', deptNorth: 'FACTORY_SALES', deptSouth: 'FACTORY_SALES', mdfEligible: true, points: 12 },
  { code: 'FACTORY_END_USER', name: 'Nhà máy / người dùng cuối', deptNorth: 'FACTORY_SALES', deptSouth: 'FACTORY_SALES', mdfEligible: false, points: 15 },
  { code: 'OTHER', name: 'Khác', deptNorth: 'FACTORY_SALES', deptSouth: 'FACTORY_SALES', mdfEligible: false, points: 5, system: true },
];

export const INITIAL_TIER_RULES: TierRule[] = [
  { tier: 'DIAMOND', name: 'Diamond', minRevenue: 1_000_000_000, mdfCap: 200_000_000, tone: 'blue' },
  { tier: 'GOLD', name: 'Gold', minRevenue: 500_000_000, mdfCap: 120_000_000, tone: 'orange' },
  { tier: 'SILVER', name: 'Silver', minRevenue: 200_000_000, mdfCap: 60_000_000, tone: 'muted' },
  { tier: 'NEW', name: 'Mới', minRevenue: 0, mdfCap: 20_000_000, tone: 'muted' },
];

export const INITIAL_POP_DOCS: PopDocDef[] = [
  { code: 'SITE_PHOTO', name: 'Ảnh hiện trường (watermark)', system: true },
  { code: 'VAT_INVOICE', name: 'Hóa đơn GTGT', system: true },
  { code: 'ATTENDEE_SIGN_SHEET', name: 'Danh sách khách ký tên', system: true },
  { code: 'ACCEPTANCE_MINUTES', name: 'Biên bản nghiệm thu' },
  { code: 'SAMPLE_HANDOVER_MINUTES', name: 'Biên bản bàn giao mẫu' },
  { code: 'FABRICATION_CONTRACT', name: 'Hợp đồng gia công' },
  { code: 'DIGITAL_REPORT', name: 'Báo cáo kết quả Digital' },
  { code: 'DESIGN_DELIVERY', name: 'Biên bản bàn giao thiết kế / in ấn' },
  { code: 'GIFT_RECEIPT_LIST', name: 'Danh sách ký nhận quà tặng' },
];

export const INITIAL_CATEGORIES: BudgetCategory[] = [
  { code: 'TECH_SEMINAR', name: 'Hội thảo / Hội nghị', fund: 'MDF', amount: 350_000_000, color: C.orange, required: ['SITE_PHOTO', 'VAT_INVOICE', 'ATTENDEE_SIGN_SHEET'], settlement: 'LUMP_SUM' },
  { code: 'TECH_TRAINING', name: 'Đào tạo kỹ thuật', fund: 'MDF', amount: 130_000_000, color: C.blue, required: ['SITE_PHOTO', 'VAT_INVOICE', 'ATTENDEE_SIGN_SHEET'], settlement: 'LUMP_SUM' },
  { code: 'EXHIBITION', name: 'Triển lãm', fund: 'MDF', amount: 100_000_000, color: '#A78BFA', required: ['SITE_PHOTO', 'VAT_INVOICE', 'ACCEPTANCE_MINUTES'], settlement: 'ACTUAL_COST' },
  { code: 'POSM_SIGNAGE', name: 'Biển hiệu & kệ trưng bày', fund: 'MDF', amount: 300_000_000, color: C.teal, required: ['SITE_PHOTO', 'VAT_INVOICE', 'FABRICATION_CONTRACT', 'ACCEPTANCE_MINUTES'], settlement: 'LUMP_SUM' },
  { code: 'PROJECT_SAMPLE', name: 'Mẫu thử nghiệm (Field Test)', fund: 'MDF', amount: 140_000_000, color: C.sand, required: ['SITE_PHOTO', 'VAT_INVOICE', 'SAMPLE_HANDOVER_MINUTES'], settlement: 'ACTUAL_COST' },
  { code: 'DIGITAL', name: 'Digital Marketing', fund: 'MDF', amount: 100_000_000, color: '#60A5FA', required: ['VAT_INVOICE', 'DIGITAL_REPORT'], settlement: 'ACTUAL_COST' },
  { code: 'WEB_DESIGN', name: 'Thiết kế web', fund: 'MDF', amount: 40_000_000, color: '#F472B6', required: ['VAT_INVOICE', 'DESIGN_DELIVERY'], settlement: 'ACTUAL_COST' },
  { code: 'PRINTING', name: 'In ấn', fund: 'MDF', amount: 40_000_000, color: '#94A3B8', required: ['VAT_INVOICE', 'DESIGN_DELIVERY'], settlement: 'ACTUAL_COST' },
  { code: 'GIFT_END_USER', name: 'Quà tặng End user', fund: 'CS', amount: 180_000_000, color: '#34D399', required: ['VAT_INVOICE', 'GIFT_RECEIPT_LIST'], settlement: 'ACTUAL_COST' },
  { code: 'GIFT_DEALER', name: 'Quà tặng Dealer', fund: 'CS', amount: 120_000_000, color: '#FBBF24', required: ['VAT_INVOICE', 'GIFT_RECEIPT_LIST'], settlement: 'ACTUAL_COST' },
];

export const INITIAL_SOURCES: CustomerSource[] = [
  { id: 'MKT_DIGITAL', name: 'Marketing: Digital (Ads, Website, Zalo)', isMarketing: true },
  { id: 'MKT_EVENT', name: 'Marketing: Hội thảo, triển lãm', isMarketing: true },
  { id: 'SELF', name: 'Sales tự khai thác', isMarketing: false },
  { id: 'REFERRAL', name: 'Giới thiệu / đối tác', isMarketing: false },
  { id: 'VENDOR', name: '3M chuyển khách', isMarketing: false },
];

/** Ngân sách Marketing nội bộ năm — gắn kênh để tính CPL và ROI từng kênh */
export const INITIAL_MKT_ITEMS: MktItem[] = [];

export const INITIAL_GETFLY_ORDERS: GetflyOrderRec[] = [];

export const INITIAL_GETFLY: GetflyConfig = {
  baseUrl: '',
  apiKey: '',
  webhookSecret: '',
  taxCodeField: 'ma_so_thue',
  defaultVatPct: 10,
  isActive: false,
};

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_BUDGET: Budget = {
  vendor: 'Công Ty TNHH 3M Việt Nam',
  vendorCode: '3MVN',
  fiscalYear: 2026,
  mdfTotal: 1_200_000_000,
  csTotal: 300_000_000,
  total: 1_500_000_000,
  spent: 0,
  committed: 0,
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
};

export const INITIAL_POLICY: Policy = { claimWindowDays: 60, rules: { minPhotos: 3, requireWatermark: true, gpsBlocking: false } };

export const INITIAL_PROGRAMS: Program[] = [];

export const INITIAL_CLAIMS: Claim[] = [];

// Nạp danh mục mặc định để các hàm tra cứu dùng được ngay từ lần render đầu
syncCatalog({ segments: INITIAL_SEGMENTS, tiers: INITIAL_TIER_RULES, categories: INITIAL_CATEGORIES, popDocs: INITIAL_POP_DOCS, sources: INITIAL_SOURCES });

// ---------------- Danh mục SKU & PO đặt Hãng ----------------

export const INITIAL_SKUS: SkuItem[] = [];

// =====================================================================
//  LOGIC NGHIỆP VỤ (mô phỏng Server Actions ở Phần 2)
// =====================================================================

export const MQL_THRESHOLD = 30;

export const SOURCE_PTS: Record<Source, number> = { VENDOR_REFERRAL: 15, REFERRAL: 15, TECH_SEMINAR: 12, EXHIBITION: 12, HOTLINE: 10, ZALO_OA: 8, WEBSITE_FORM: 8, GOOGLE_ADS: 6, FACEBOOK_ADS: 5 };

export const findByTax = (customers: Customer[], tax?: string) => (tax ? customers.find((c) => c.taxCode === tax.trim()) : undefined);

export const tierFor = (revenue: number, rules: TierRule[]): Tier => {
  const sorted = [...rules].sort((a, b) => b.minRevenue - a.minRevenue);
  return sorted.find((r) => revenue >= r.minRevenue)?.tier ?? sorted[sorted.length - 1]?.tier ?? '';
};

/** MDF khách đã nhận trong năm = claim + phần đang giữ chỗ chưa làm claim */
export const mdfOfCustomer = (id: string, claims: Claim[], programs: Program[]) =>
  claims.filter((c) => c.customerId === id).reduce((s, c) => s + c.claimed, 0) +
  programs.filter((p) => p.customerId === id && p.held > 0 && p.status !== 'CLAIMING').reduce((s, p) => s + p.held, 0);

/** Mức sử dụng quỹ theo nhóm chương trình (so với tỷ lệ phân bổ) */
/** Năm tài chính của chương trình (theo ngày bắt đầu) và của claim (theo chương trình, không có thì theo kỳ claim) */
export const progYear = (p: Program) => Number((p.start || new Date().toISOString()).slice(0, 4));

export const claimYear = (c: Claim, programs: Program[]) => {
  const p = programs.find((x) => x.id === c.programId);
  return p ? progYear(p) : claimDate(c)?.getFullYear() ?? new Date().getFullYear();
};

/** Đã dùng theo hạng mục trong một năm tài chính */
export const usedByType = (t: ProgramType, claims: Claim[], programs: Program[], fy: number) =>
  claims.filter((c) => c.programType === t && claimYear(c, programs) === fy).reduce((s, c) => s + c.claimed, 0) +
  programs.filter((p) => p.type === t && progYear(p) === fy && p.held > 0 && p.status !== 'CLAIMING').reduce((s, p) => s + p.held, 0);

export const blockersOf = (c: Claim, rules: ClaimRules) => auditClaim(c, rules).filter((i) => i.severity === 'BLOCKER' && !i.passed).length;

// =====================================================================
//  GETFLY — tính toán dùng chung (khớp src/lib/getfly/mapping.ts)
// =====================================================================

/** BOQ -> tổng đơn: chiết khấu dòng -> chiết khấu đơn (bảo vệ giá) -> VAT */
// ---------------- Báo giá -> chốt đơn -> đơn Getfly ----------------

export const lineNet = (l: QuoteLine) => Math.round(l.listPrice * (1 - l.discountPct / 100));

// ---------------- v46: đơn bán ----------------
export const SALE_STATUS: Record<SaleStatus, { label: string; tone: Tone }> = { PENDING: { label: 'Chờ xuất kho', tone: 'orange' }, SHIPPING: { label: 'Đang giao', tone: 'blue' }, DONE: { label: 'Hoàn thành', tone: 'teal' }, CANCELLED: { label: 'Đã hủy', tone: 'muted' } };

export const SALE_PAY: Record<SalePay, string> = { CASH: 'Tiền mặt', BANK: 'Chuyển khoản', PARTIAL: 'Trả một phần', CREDIT: 'Công nợ' };

export const SALE_DELIVERY: Record<SaleDelivery, string> = { PICKUP: 'Lấy tại cửa hàng', DELIVER: 'Giao hàng', CARRIER: 'Gửi xe / chành' };

export const saleLineNet = (l: SaleLine) => Math.round(l.qty * l.price * (1 - l.discountPct / 100));

export const salePaid = (o: SalesOrder, all = false) => o.payments.filter((p) => all || p.confirmed).reduce((s, p) => s + p.amount, 0);

/** Đơn đã xuất kho (đang giao / hoàn thành) mới phát sinh công nợ */
export const saleIssued = (o: SalesOrder) => o.status === 'SHIPPING' || o.status === 'DONE' || (o.status === 'PENDING' && Object.values(o.issuedQ ?? {}).some((q) => q > 0));

/** v49: số đã xuất của một dòng (đơn cũ đã xuất kho coi như xuất đủ) */
export const saleIssQ = (o: Pick<SalesOrder, 'status' | 'issuedQ'>, l: SaleLine) => o.issuedQ?.[l.id] ?? (o.status === 'SHIPPING' || o.status === 'DONE' ? l.qty : 0);

export const saleRetQ = (o: Pick<SalesOrder, 'returnedQ'>, l: SaleLine) => o.returnedQ?.[l.id] ?? 0;

export const SALE_STAGE: Record<SaleStage, { label: string; tone: Tone }> = {
  APPROVAL: { label: 'Chờ duyệt', tone: 'orange' }, REJECTED: { label: 'Không duyệt', tone: 'red' }, READY: { label: 'Đã duyệt', tone: 'blue' }, WAIT_WH: { label: 'Chờ xuất kho', tone: 'orange' },
  PARTIAL: { label: 'Xuất một phần', tone: 'blue' }, SHIPPING: { label: 'Đang giao', tone: 'blue' }, DONE: { label: 'Hoàn thành', tone: 'teal' }, CANCELLED: { label: 'Đã hủy', tone: 'muted' },
};

/** Hàng giữ chỗ (đã về theo phiếu đặt hàng) cho đúng khách / dự án của đơn */
export const saleResOf = (o: Pick<SalesOrder, 'customerId' | 'leadId'>, sku: string, res: StockReservation[]) =>
  res.filter((r) => r.sku === sku && r.status === 'HELD' && r.qty > 0 && ((r.kind === 'CUSTOMER' && !!o.customerId && r.refId === o.customerId) || (r.kind === 'LEAD' && !!o.leadId && r.refId === o.leadId)));

/** Báo giá mới nhất có dòng sản phẩm của dự án */
export const latestQuote = (leadId: string, quotes: Quote[]) => quotes.filter((q) => q.leadId === leadId && q.lines.length).sort((a, b) => b.version - a.version)[0];

export const paymentLabel = (o: GetflyOrderRec): { label: string; tone: Tone } =>
  o.paid >= o.gross ? { label: 'Đã thanh toán', tone: 'teal' } : o.paid > 0 ? { label: 'Thanh toán một phần', tone: 'orange' } : { label: 'Chưa thanh toán', tone: 'red' };

/** Giá trị BOQ: có dòng bóc tách -> tổng sau chiết khấu dòng; chưa có -> ước tính MKT nhập khi tạo lead */
export const boqTotal = (l: Lead) =>
  l.boqItems?.length ? Math.round(l.boqItems.reduce((s, i) => s + i.qty * i.price * (1 - i.discountPct / 100), 0)) : l.boqValue;

export const boqIsEstimate = (l: Lead) => !l.boqItems?.length;

/** Báo giá của các lead thuộc một khách hàng (theo customerId hoặc MST) */
export const quotesOfCustomer = (c: Customer, quotes: Quote[], leads: Lead[]) => {
  const ids = new Set(leads.filter((l) => l.customerId === c.id || (!!l.taxCode && l.taxCode === c.taxCode)).map((l) => l.id));
  return quotes.filter((q) => ids.has(q.leadId) || q.customerId === c.id).sort((a, b) => b.date.localeCompare(a.date) || b.version - a.version);
};

// =====================================================================
//  PO ĐẶT HÃNG & ĐỢT HÀNG VỀ
// =====================================================================

export const shippedQty = (po: VendorPO, sku: string, statuses: ShipmentStatus[]) =>
  po.shipments.filter((s) => statuses.includes(s.status)).reduce((a, s) => a + (s.lines.find((x) => x.sku === sku)?.qty ?? 0), 0);

/** Số đã nhập kho giữ chỗ cho một đích (từ snapshot các đợt đã nhập) */
export const receivedReservedFor = (po: VendorPO, sku: string, kind: PoAllocation['kind'], refId: string) =>
  po.shipments.reduce((a, s) => a + (s.allocSnapshot?.find((x) => x.sku === sku)?.reserved.filter((r) => r.kind === kind && r.refId === refId).reduce((b, r) => b + r.qty, 0) ?? 0), 0);

/** Tồn giữ chỗ đang trong kho của một SKU (chưa giao, chưa giải phóng) */
export const reservedInStock = (sku: string, rs: StockReservation[]) =>
  rs.filter((r) => r.sku === sku && (r.status === 'HELD' || r.status === 'PENDING_RELEASE')).reduce((a, r) => a + r.qty, 0);

/** Hợp đồng: phiên bản mới nhất của mỗi nhóm (bỏ bản đã bị thay thế) */
export const docGroupOf = (d: GeneratedDoc) => d.groupId ?? d.id;

export const contractVersions = (docs: GeneratedDoc[], g: string) => docs.filter((d) => docGroupOf(d) === g).sort((a, b) => (b.version ?? 1) - (a.version ?? 1));

// ---------------- Excel .xlsx tối giản (không cần thư viện ngoài) ----------------
// Ghi: gói zip STORE (không nén) chứa workbook + worksheet chuỗi nội tuyến; Excel / Google Sheets / LibreOffice mở được.
// Đọc: giải nén zip bằng DecompressionStream('deflate-raw') có sẵn trong trình duyệt, đọc sheet đầu tiên.
export const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();

export const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export const colName = (i: number) => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

export const downloadBlob = (name: string, blob: Blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); };

export const Ctx = createContext<AppCtx | null>(null);

export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp phải dùng bên trong DashboardApp');
  return v;
};

// =====================================================================
//  UI PRIMITIVES
// =====================================================================

export const btnBase =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,border-color,filter] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.6)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg))] disabled:cursor-not-allowed disabled:opacity-40';

/**
 * BUTTON (Design System v26) — mỗi màn hình chỉ 1 nút Primary.
 * - btnPrimary: hành động chính (Navy ở nền sáng, Blue ở nền tối)
 * - btnAccent: hành động thương hiệu nổi bật (cam), dùng tiết kiệm
 * - btnGhost: hành động phụ (viền mảnh)
 * - btnDanger: hành động nguy hiểm (luôn đi kèm xác nhận)
 */
export const btnPrimary = cn(btnBase, 'bg-[rgb(var(--accent))] px-3.5 py-2 font-medium text-[rgb(var(--on-accent))] hover:brightness-105');

export const btnAccent = cn(btnBase, 'bg-[rgb(var(--accent))] px-3.5 py-2 font-medium text-[rgb(var(--on-accent))] hover:brightness-105');

export const btnGhost = cn(btnBase, 'border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] px-3 py-1.5 text-[rgb(var(--fg))] hover:bg-[rgb(var(--ink)/0.04)]');

export const btnDanger = cn(btnBase, 'bg-[rgb(var(--danger))] px-3.5 py-2 font-semibold text-white hover:bg-[rgb(var(--danger)/0.88)]');

export const btnSm = 'px-2.5 py-1 text-xs';

/** Ô nhập không cố định chiều rộng (dùng khi cần w-auto / w-16 / flex-1...) */
export const inputBase =
  'rounded-lg border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--sunken))] px-3 py-2 text-sm max-md:min-h-11 max-md:text-base text-[rgb(var(--fg))] placeholder:text-[rgb(var(--muted)/0.7)] focus:border-[rgb(var(--fg)/0.5)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--fg)/0.12)] disabled:opacity-50 [&>option]:bg-[rgb(var(--surface))]';

export const inputCls = `w-full ${inputBase}`;

/** Thời điểm nhận lead (dữ liệu lưu số ngày trước) */
export const leadAt = (l: { receivedDaysAgo: number; routedAt?: number }) => l.routedAt ?? Date.now() - l.receivedDaysAgo * 864e5;

/** Đưa lớp phủ ra thẳng <body>: không bị cha có transform / overflow (drawer, bảng cuộn) cắt mất (lỗi hộp Sửa khách hàng bị che) */
export const portal = (node: ReactNode) => (typeof document === 'undefined' ? node : createPortal(node, document.body));

/**
 * Ngăn xếp lớp phủ (Modal / Drawer / khung trượt / màn soạn toàn trang): chỉ lớp trên cùng hiển thị và nhận phím Esc,
 * các lớp bên dưới tạm ẩn — tránh "popup chồng popup". Đóng lớp trên cùng thì lớp dưới hiện lại đúng trạng thái cũ.
 */
export const overlaySeq = { n: 0 };

export const overlayStack: number[] = [];

export const overlaySubs = new Set<() => void>();

export const overlayTop = () => (overlayStack.length ? Math.max(...overlayStack) : 0);

/**
 * Giữ ngữ cảnh khi chuyển trang: tab / chế độ xem / ô tìm kiếm của từng phân hệ được nhớ trong phiên làm việc
 * (bộ nhớ + sessionStorage), quay lại phân hệ là thấy đúng chỗ đang làm. Xóa khi đăng xuất / đổi doanh nghiệp.
 */
export const STICKY_KEY = '3a:ui:sticky';

export const stickyStore: Map<string, unknown> = (() => {
  try { return new Map(Object.entries(JSON.parse(sessionStorage.getItem(STICKY_KEY) ?? '{}') as Record<string, unknown>)); } catch { return new Map(); }
})();

export let stickyTimer: number | undefined;

export const stickySave = () => {
  window.clearTimeout(stickyTimer);
  stickyTimer = window.setTimeout(() => { try { sessionStorage.setItem(STICKY_KEY, JSON.stringify(Object.fromEntries(stickyStore))); } catch { /* bỏ qua */ } }, 200);
};

export const stickyReset = () => { stickyStore.clear(); try { sessionStorage.removeItem(STICKY_KEY); } catch { /* bỏ qua */ } };

/** Bắt lỗi hiển thị trong từng phân hệ: không làm trắng cả app, cho phép thử lại */
export class ModuleBoundary extends Component<{ children: ReactNode; name: string; onHome: () => void }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error(`[${this.props.name}]`, err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="glass-card rounded-md p-8 text-center" role="alert">
        <XCircle className="mx-auto h-8 w-8 text-[rgb(var(--danger-fg))]" aria-hidden />
        <p className="mt-3 text-base font-semibold">Phân hệ {this.props.name} gặp lỗi khi hiển thị</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-[rgb(var(--muted))]">Dữ liệu không bị ảnh hưởng. Thử tải lại phân hệ; nếu lỗi lặp lại, gửi nội dung sau cho bộ phận kỹ thuật: <span className="font-mono">{this.state.err.message}</span></p>
        <div className="mt-4 flex justify-center gap-2">
          <button className={btnGhost} onClick={this.props.onHome}>Về Tổng quan</button>
          <button className={btnPrimary} onClick={() => this.setState({ err: null })}><RefreshCw className="h-4 w-4" aria-hidden />Thử lại</button>
        </div>
      </div>
    );
  }
}

export const VIEW_META: Record<ViewKind, { label: string; icon: typeof Wallet }> = {
  table: { label: 'Bảng', icon: Rows3 },
  board: { label: 'Kanban', icon: Columns3 },
  gantt: { label: 'Gantt', icon: CalendarRange },
};

export const strHash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

export const tdCls = 'px-3 py-2.5 align-middle';

export const tdFirst = 'pl-5 pr-3 py-2.5 align-middle';

export const tdLast = 'pl-3 pr-5 py-2.5 align-middle';

/** Dòng bảng: chỉ kẻ ngang mờ 10%, zebra rất nhẹ (class .dt trong <style>), hover ánh xanh dương */
export const rowCls = 'border-b border-[rgb(var(--ink)/0.06)]';

export const EVENT_LABEL: Record<NotifyEvent, string> = {
  LEAD_ROUTED: 'Lead mới chia về phòng (gửi Trưởng phòng)',
  LEAD_ASSIGNED: 'Được chỉ định lead (gửi Sales)',
  SLA_BREACH: 'Quá hạn SLA tiếp nhận 2 giờ',
  QUOTE_OVERDUE: 'Quá hạn báo giá 24 giờ (leo thang)',
  CLAIM_UPDATE: 'Cập nhật duyệt claim / Pre-Approval',
  STOCK_RELEASE: 'Chờ xác nhận giải phóng hàng giữ chỗ',
  CONTRACT_APPROVAL: 'Hợp đồng chờ duyệt điều khoản đặc biệt',
  ACTIVITY_APPROVAL: 'Đề nghị công tác / nghỉ việc riêng chờ duyệt',
  QUOTE_APPROVAL: 'Báo giá chờ duyệt giá & chiết khấu',
  PROGRAM_APPROVAL: 'Đề xuất chi quỹ MDF chờ duyệt nội bộ',
  APPROVAL_RESULT: 'Kết quả duyệt gửi người đề nghị',
  MONTHLY_REPORT: 'Email báo cáo tháng',
};

export const CHANNEL_LABEL: Record<Channel, string> = { INAPP: 'Trong ứng dụng', ZNS: 'Zalo ZNS', EMAIL: 'Email' };

export const INITIAL_NOTIFY_RULES: Record<NotifyEvent, Channel[]> = {
  LEAD_ROUTED: ['INAPP', 'ZNS', 'EMAIL'],
  LEAD_ASSIGNED: ['INAPP', 'ZNS'],
  SLA_BREACH: ['INAPP', 'ZNS'],
  QUOTE_OVERDUE: ['INAPP', 'ZNS', 'EMAIL'],
  CLAIM_UPDATE: ['INAPP', 'EMAIL'],
  STOCK_RELEASE: ['INAPP', 'EMAIL'],
  CONTRACT_APPROVAL: ['INAPP', 'EMAIL'],
  ACTIVITY_APPROVAL: ['INAPP', 'ZNS'],
  QUOTE_APPROVAL: ['INAPP', 'ZNS'],
  PROGRAM_APPROVAL: ['INAPP', 'EMAIL'],
  APPROVAL_RESULT: ['INAPP'],
  MONTHLY_REPORT: ['EMAIL'],
};

export const EMAIL_PRESET: Record<EmailProvider, { label: string; host: string; port: number; secure: boolean; username: string; hint: string }> = {
  RESEND: { label: 'Resend', host: 'smtp.resend.com', port: 465, secure: true, username: 'resend', hint: 'Mật khẩu là API Key Resend, tên miền gửi phải được xác thực' },
  SENDGRID: { label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: false, username: 'apikey', hint: 'Username cố định là "apikey", mật khẩu là API Key SendGrid' },
  GMAIL: { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 587, secure: false, username: '', hint: 'Dùng App Password 16 ký tự, không dùng mật khẩu đăng nhập' },
  SMTP: { label: 'SMTP tùy chỉnh', host: '', port: 587, secure: false, username: '', hint: 'Máy chủ mail nội bộ hoặc nhà cung cấp khác' },
};

export const INITIAL_EMAIL: EmailConfig = {
  enabled: false,
  provider: 'RESEND',
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  username: 'resend',
  password: '',
  fromName: 'VASSH-CRM',
  fromEmail: '',
  replyTo: '',
  reportRecipients: '',
  reportDay: 1,
};

export const INITIAL_ZNS: ZnsConfig = {
  enabled: false,
  appId: '',
  secretKey: '',
  oaId: '',
  templates: { LEAD_ROUTED: '', LEAD_ASSIGNED: '', QUOTE_OVERDUE: '' },
};

export const DOC_CATEGORY: Record<DocCategory, string> = {
  POLICY: 'Quy chế & Chính sách chung',
  MDF_RULES: 'Quy định Quỹ MDF Hãng',
  KPI: 'Chính sách Thưởng / KPI',
  PROFILE: 'Hồ sơ năng lực & Catalog',
};

/** Phạm vi hiển thị: Toàn công ty, Chỉ BOD & Kế toán, hoặc Chỉ một phòng ban */
export const docVisibility = (v: DocVisibility, departments: Department[]): { label: string; tone: Tone } =>
  v === 'ALL' ? { label: 'Toàn công ty', tone: 'teal' }
  : v === 'BOD_ACC' ? { label: 'Chỉ Ban Giám đốc & Kế toán', tone: 'red' }
  : { label: `Chỉ ${departments.find((d) => d.code === v)?.name ?? v}`, tone: 'blue' };

export const visibilityOptions = (departments: Department[]): DocVisibility[] => ['ALL', 'BOD_ACC', ...departments.filter((d) => d.active).map((d) => d.code)];

/** Quy tắc xem tài liệu theo vai trò / phòng ban */
export const canViewDoc = (d: DocItem, me: User) =>
  me.role === 'BOD' || d.visibility === 'ALL' || d.visibility === me.dept || (d.visibility === 'BOD_ACC' && me.role === 'ACCOUNTANT');

export const INITIAL_DOCS: DocItem[] = [];

export const PERIOD_LABEL: Record<Period, string> = { YEAR: 'Năm', Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4' };

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const rangeBounds = (r: DateRange) => ({ start: new Date(`${r.from}T00:00:00`).getTime(), end: new Date(`${r.to}T23:59:59`).getTime() });

export const inRangeOf = (r: DateRange) => (d: Date | string | null | undefined) => {
  if (!d) return true;
  const t = (typeof d === 'string' ? new Date(d.length === 10 ? `${d}T12:00:00` : d) : d).getTime();
  const { start, end } = rangeBounds(r);
  return t >= start && t <= end;
};

export const leadDate = (l: Lead) => new Date(Date.now() - l.receivedDaysAgo * 864e5);

// =====================================================================
//  ĐỒNG HỒ SLA TIẾP NHẬN (2h) & HẠN BÁO GIÁ (24h)
// =====================================================================

export const fmtDur = (ms: number) => {
  const a = Math.abs(ms);
  const h = Math.floor(a / 3.6e6);
  const m = Math.floor((a % 3.6e6) / 6e4);
  const s = Math.floor((a % 6e4) / 1000);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const isQuoteOverdue = (l: Lead, now: number | null) => l.status === 'ACCEPTED' && !!l.quoteDeadline && now != null && l.quoteDeadline < now;

export const isAcceptLate = (l: Lead, now: number | null) => l.status === 'ASSIGNED' && !!l.slaDeadline && now != null && l.slaDeadline < now;

// =====================================================================
//  THÀNH PHẦN GIAO DIỆN v5 (theo mockup): chọn khoảng ngày, menu thao tác,
//  phân trang, chọn hàng loạt, avatar, nút nổi mobile, bảng lệnh ⌘K
// =====================================================================

/** Ảnh đại diện nhân sự theo tên (cập nhật mỗi lần App vẽ lại) để mọi chỗ dùng Avatar đều hiện ảnh */
export const AVATARS = new Map<string, string>();

export const AVATAR_COLORS = ['#E8562A', '#1F74D4', '#10B981', '#8B5CF6', '#EF4444', '#F6B533', '#06B6D4', '#EC4899'];

/** Tuổi lead tính bằng giờ: từ lúc phân phòng, chưa phân thì từ lúc nhận */
export const leadAgeH = (l: Lead, now: number | null) => (l.routedAt && now ? (now - l.routedAt) / 3.6e6 : l.receivedDaysAgo * 24 + 7);

/** Bỏ dấu tiếng Việt để gõ "tao po" vẫn khớp "Tạo PO" */
export const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Hiểu câu lệnh tiếng Việt tự nhiên: bỏ động từ / hư từ, mọi từ còn lại phải xuất hiện trong lệnh. "tạo phiếu chi" → "Lập phiếu chi" */
export const NL_CREATE = new Set(['tao', 'them', 'lap', 'moi', 'nhap', 'mo', 'form', 'cho', 'toi', 'minh', 'giup', 'hay', 'mot', 'cai', 'de', 'xuat']);

export const NL_GO = new Set(['di', 'toi', 'den', 'chuyen', 'sang', 'mo', 'xem', 'vao', 'trang', 'phan', 'he', 'man', 'hinh']);

export const looksLikeQuestion = (q: string) => /\?|^(phan tich|du bao|goi y|vi sao|tai sao|bao nhieu|tom tat|rui ro|ai |nhung|liet ke|danh gia|so sanh|lam sao|co nen)/.test(fold(q).trim());

/** Lưới thẻ KPI: 2 cột trên mobile, thẻ lẻ cuối cùng trải rộng 2 cột */
export const kpiGrid = (lgCols: string) => cn('kpi-row grid grid-cols-2 gap-x-3 gap-y-5 py-1', lgCols, '[&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1');

export const COMPANY_AI_FIELDS: [keyof CompanyInfo, string][] = [['legalName', 'Tên pháp lý'], ['taxCode', 'Mã số thuế'], ['address', 'Địa chỉ trụ sở'], ['phone', 'Điện thoại'], ['email', 'Email'], ['website', 'Website'], ['representative', 'Người đại diện'], ['representativeTitle', 'Chức vụ'], ['bankAccount', 'Số tài khoản'], ['bankName', 'Ngân hàng, chi nhánh']];

export const median = (xs: number[]) => { const a = xs.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : NaN; };

export const monthLabel = (d: Date) => `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;

export const rangeText = (r: DateRange) => `${fmtDate(r.from)} – ${fmtDate(r.to)}`;

export const hhmm = (t: number) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export const SIZE_CLS: Record<WidgetPref['size'], string> = { 4: 'lg:col-span-4', 6: 'lg:col-span-6', 8: 'lg:col-span-8', 12: 'lg:col-span-12' };

export const SIZE_LABEL: Record<WidgetPref['size'], string> = { 4: '1/3', 6: '1/2', 8: '2/3', 12: 'Rộng' };

export const INITIAL_HUB_CFG: HubCfg = {
  ai: { enabled: true, provider: 'AUTO', anthropicModel: '', openaiModel: '', maskPii: true, features: { copilot: true, chat: true, visual: true, writer: true, brief: true, image: true, extract: true } },
  zalo: {
    oaName: '', oaId: '', autoLink: true, salesSeeAll: false, replyMinutes: 15,
    quickReplies: ['Dạ em chào {ten}, em là {nhanvien} bên {congty}. Em có thể hỗ trợ gì cho mình ạ?', 'Dạ em gửi {ten} báo giá chi tiết trong hôm nay ạ.', 'Dạ em cảm ơn {ten}, bên em sẽ liên hệ lại trong 15 phút ạ.'],
    znsTemplates: [],
  },
  brief: { enabled: true, hour: 7 },
  social: { title: '', facebookUrl: '', facebookPageId: '', zaloOaUrl: '', youtubeUrl: '', youtubeChannelId: '' },
};

/** Nguồn tham số ZNS: lấy tự động từ khách hàng / đơn hàng đang liên kết */
export const ZNS_SOURCES: Record<string, string> = {
  'customer.name': 'Tên khách hàng', 'customer.phone': 'SĐT khách hàng', 'customer.code': 'Mã khách hàng', 'order.code': 'Mã đơn / dự án',
  'order.title': 'Tên đơn / dự án', 'order.amount': 'Giá trị đơn', 'order.date': 'Ngày hẹn / ngày đơn', 'company.name': 'Tên công ty', 'staff.name': 'Nhân viên phụ trách', 'today': 'Ngày hôm nay',
};

export const SERVER0: ServerStatus = { checked: false, reachable: false, ai: { anthropic: false, openai: false }, images: false, models: { anthropic: '', openai: '' }, zalo: { oa: false, webhook: false }, cloud: false };

export const serverCache = { tenant: '', at: 0, value: SERVER0, inflight: null as Promise<ServerStatus> | null };

export const AI_ERR: Record<string, string> = {
  ai_not_configured: 'Máy chủ chưa có khóa API cho nhà cung cấp AI đã chọn', rate_limited: 'Gửi quá nhiều yêu cầu, thử lại sau 1 phút', unauthorized: 'Phiên đăng nhập hết hạn, đăng nhập lại',
  forbidden: 'Tài khoản không thuộc doanh nghiệp này', quota_exceeded: 'Đã dùng hết lượt AI hôm nay', not_allowed: 'Tài khoản chưa được bật tính năng này', auth_unavailable: 'Máy chủ chưa cấu hình xác thực (Supabase) cho API', zalo_not_configured: 'Máy chủ chưa cấu hình Zalo OA',
};

export const aiErrText = (e?: string) => (e && AI_ERR[e]) || e || 'Lỗi không xác định';

/** Che số điện thoại, email trước khi gửi dữ liệu cho nhà cung cấp AI */
export const maskPii = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]').replace(/(\+?84|0)(\s?\d){8,10}/g, (m) => `[SĐT …${m.replace(/\D/g, '').slice(-3)}]`);

export const AI_NAME: Record<'ANTHROPIC' | 'OPENAI', string> = { ANTHROPIC: 'Claude', OPENAI: 'OpenAI' };

export const DEALER_BONUS_TEMPLATE: KbItem = {
  id: 'kb-dealer-bonus', title: 'Chính sách thưởng tăng trưởng đại lý', tags: ['đại lý', 'thưởng', 'tăng trưởng', 'dealer'], updatedAt: 0,
  body: 'Đại lý đạt mức tăng trưởng doanh thu từ 7% trở lên so với cùng kỳ năm trước được thưởng 10.000.000đ cho mỗi 100.000.000đ doanh thu tăng thêm. Thưởng tính theo năm, chi bằng tiền hoặc cấn trừ công nợ, quyết toán trong tháng 1 năm sau.',
  rule: { kind: 'DEALER_GROWTH_BONUS', minGrowthPct: 7, stepRevenue: 100_000_000, bonusPerStep: 10_000_000, base: 'INCREASE' },
};

// ---------------------------------------------------------------------
//  Dự báo dòng tiền quỹ MDF (6 tháng) và rủi ro trễ SLA — tính tất định, AI chỉ diễn giải
// ---------------------------------------------------------------------
export const MDF_REIMBURSE_LAG_DAYS = 45;

/** Thay biến trong mẫu tin: {ten} {nhanvien} {congty} {ma} */
export const fillVars = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

export const ZLINK_LABEL: Record<ZaloLinkKind, string> = { customer: 'Khách hàng', lead: 'Lead / dự án', job: 'Đơn hàng', quote: 'Báo giá', po: 'PO' };

export const digits9 = (p?: string) => (p ?? '').replace(/\D/g, '').slice(-9);

export const HONORIFIC = /^(co|chu|anh|chi|bac|em|ong|ba|cau|di|thim|mo|o|a|c|cô|chú|anh|chị|bác|ông|bà)$/;

/** Tên gọi: bỏ danh xưng (Cô / Chú / Anh / Chị...) lấy tên riêng cuối */
export const givenName = (s: string) => { const w = fold(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((x) => x && !HONORIFIC.test(x)); return w[w.length - 1] ?? ''; };

/** Cụm địa danh trong địa chỉ: bỏ số nhà, ngõ / ngách / số / phường, giữ cụm ≥ 2 từ */
export const placeChunks = (addr: string) => fold(addr).split(/[,;-]/).map((p) => p.replace(/\b(so|ngo|ngach|hem|kiet|to|phuong|p|quan|q|huyen|xa|thi tran|tp|thanh pho|tinh|duong|d)\b\.?/g, ' ').replace(/[\d/]+/g, ' ').replace(/\s+/g, ' ').trim()).filter((p) => p.split(' ').length >= 2);

/** Phạm vi xem hội thoại: BOD / Marketing / Trưởng phòng thấy hết; nhân viên thấy hội thoại được giao hoặc chưa ai nhận */
export const canSeeConv = (c: ZaloConv, me: User, cfg: HubCfg) => ['BOD', 'MKT_LEAD', 'DEPT_HEAD'].includes(me.role) || cfg.zalo.salesSeeAll || !c.assignee || c.assignee === me.id;

export const VS_KIND: Record<VsKind, string> = { SKU: 'Sản phẩm', PRICE: 'Hạng mục báo giá', STOCK: 'Vật tư', JOB: 'Đơn hàng / dự án', LEAD: 'Dự án' };

export const featCache = new Map<string, ImgFeat | null>();

export const imgSim = (a: ImgFeat, b: ImgFeat) => {
  const ham = a.hash.reduce((s, v, i) => s + (v !== b.hash[i] ? 1 : 0), 0);
  const inter = a.hist.reduce((s, v, i) => s + Math.min(v, b.hist[i]), 0);
  return 0.55 * (1 - ham / 64) + 0.45 * inter;
};

export const readAsDataUrl = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });

// =====================================================================
//  AI COPILOT NÂNG CAO (v32): bản tin điều hành BOD, dự báo quỹ MDF, thưởng đại lý, @AI trong chat, soạn thảo nội dung
// =====================================================================

export const aiMsgText = (m: AiMsg) => [m.text, ...(m.kpis ?? []).map((k) => `• ${k.label}: ${k.value}`), ...(m.items ?? []).map((i) => `- ${i.title}${i.detail ? `: ${i.detail}` : ''}`), m.note ? `(${m.note})` : ''].filter(Boolean).join('\n');

export const WRITER: Record<WriterPreset, { label: string; brief: string; max?: number }> = {
  QUOTE_EMAIL: { label: 'Email gửi báo giá', brief: 'Email gửi báo giá cho khách: tiêu đề (dòng đầu "Tiêu đề: ..."), lời chào, tóm tắt báo giá, điều kiện chính, lời kêu gọi phản hồi, chữ ký.' },
  CARE_MSG: { label: 'Tin chăm sóc khách hàng', brief: 'Tin nhắn Zalo chăm sóc khách hàng: thân thiện, xưng em, 2-4 câu.', max: 600 },
  ZALO_OA: { label: 'Kịch bản tin Zalo OA', brief: 'Kịch bản tin truyền thông Zalo OA: tiêu đề ngắn, 3-5 câu nội dung, 1 nút kêu gọi hành động (ghi "Nút: ...").', max: 1000 },
  AD_POST: { label: 'Bài quảng cáo', brief: 'Bài quảng cáo mạng xã hội: câu mở thu hút, lợi ích chính dạng gạch đầu dòng, ưu đãi, kêu gọi hành động, 3-5 hashtag.' },
  PRESS: { label: 'Thông cáo báo chí', brief: 'Thông cáo báo chí: tiêu đề, sapo, 3-4 đoạn thân bài, trích dẫn lãnh đạo (để trống tên nếu chưa có), thông tin liên hệ.' },
  ZNS: { label: 'Nội dung ZNS / SMS', brief: 'Nội dung tin ZNS/SMS: tối đa 300 ký tự, không dấu chấm than thừa, có tên thương hiệu.', max: 300 },
};

export const WRITER_TONES = ['Thân thiện', 'Trang trọng', 'Ngắn gọn', 'Thuyết phục'];

// =====================================================================
//  ZALO HUB: chat đa kênh với khách hàng (Zalo OA + ZNS), 3 cột: hội thoại · khung chat · ngữ cảnh khách / đơn hàng
// =====================================================================

export const ZSTATUS: Record<ZaloConvStatus, { label: string; tone: Tone }> = { OPEN: { label: 'Đang mở', tone: 'orange' }, PENDING: { label: 'Chờ khách', tone: 'blue' }, CLOSED: { label: 'Đã xong', tone: 'teal' } };

export const zTime = (t: number) => { const d = new Date(t); const now = new Date(); return d.toDateString() === now.toDateString() ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }); };

export const MKT_CH: Record<MktChannel, { label: string; color: string; sources: Source[] }> = {
  ZALO_OA: { label: 'Zalo OA', color: '#0068FF', sources: ['ZALO_OA'] },
  ZNS: { label: 'Zalo ZNS', color: '#0EA5E9', sources: [] },
  SMS: { label: 'SMS', color: '#64748B', sources: [] },
  FACEBOOK: { label: 'Facebook', color: '#1877F2', sources: ['FACEBOOK_ADS'] },
  GOOGLE: { label: 'Google', color: '#EA4335', sources: ['GOOGLE_ADS'] },
  TIKTOK: { label: 'TikTok', color: '#111827', sources: [] },
  EMAIL: { label: 'Email', color: '#8B5CF6', sources: [] },
  EVENT: { label: 'Sự kiện / hội thảo', color: '#F59E0B', sources: ['EXHIBITION', 'TECH_SEMINAR'] },
  WEBSITE: { label: 'Website / SEO', color: '#10B981', sources: ['WEBSITE_FORM', 'HOTLINE'] },
};

export const CAMP_STATUS: Record<CampaignStatus, { label: string; tone: Tone }> = { PLANNED: { label: 'Kế hoạch', tone: 'muted' }, RUNNING: { label: 'Đang chạy', tone: 'teal' }, PAUSED: { label: 'Tạm dừng', tone: 'orange' }, DONE: { label: 'Đã kết thúc', tone: 'blue' } };

export const CONTENT_STATUS: Record<ContentStatus, { label: string; tone: Tone }> = { DRAFT: { label: 'Nháp', tone: 'muted' }, REVIEW: { label: 'Chờ duyệt', tone: 'orange' }, APPROVED: { label: 'Đã duyệt', tone: 'teal' }, PUBLISHED: { label: 'Đã đăng', tone: 'blue' } };

export const BANNER_SIZE: Record<BannerSize, { label: string; w: number; h: number }> = {
  FB: { label: 'Quảng cáo Facebook 1200×628', w: 1200, h: 628 }, SQUARE: { label: 'Vuông 1080×1080', w: 1080, h: 1080 }, STORY: { label: 'Story dọc 1080×1920', w: 1080, h: 1920 },
  ZALO: { label: 'Ảnh bìa 16:9 1280×720', w: 1280, h: 720 }, WEB: { label: 'Banner web 1920×600', w: 1920, h: 600 },
};

export const AUTO_TRIGGER: Record<AutoTrigger, { label: string; days?: string; mode?: 'TRADING' | 'MFG' }> = {
  LEAD_NEW: { label: 'Có lead mới', days: 'Lead nhận trong N ngày' }, QUOTE_NO_REPLY: { label: 'Báo giá chưa phản hồi', days: 'Sau N ngày gửi báo giá', mode: 'TRADING' },
  JOB_WON: { label: 'Khách vừa chốt đơn / đặt cọc', days: 'Chốt trong N ngày', mode: 'MFG' }, ZALO_FOLLOW: { label: 'Khách mới quan tâm Zalo OA' },
  INACTIVE_CUSTOMER: { label: 'Khách năm nay chưa mua lại' }, AUDIENCE: { label: 'Toàn bộ phân khúc (gửi 1 lần)' },
};

export const AUTO_CH: Record<AutoChannel, string> = { ZNS: 'Zalo ZNS', ZALO_OA: 'Tin Zalo OA', SMS: 'SMS', MESSENGER: 'Messenger (Fanpage)', EMAIL: 'Email' };

export const dayMs = 864e5;

export const isoDay = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const AUD_FIELDS: Record<AudBase, AudField[]> = {
  CUSTOMER: [
    { key: 'tier', label: 'Hạng khách', type: 'select', options: (a) => [...new Set(a.customers.map((c) => c.tier))].filter(Boolean).map((x) => [x, x]), get: (r) => (r as Customer).tier },
    { key: 'segment', label: 'Nhóm khách', type: 'select', options: (a) => a.segments.map((s) => [s.code, s.name]), get: (r) => (r as Customer).segment },
    { key: 'region', label: 'Miền', type: 'select', options: () => Object.entries(REGION_LABEL), get: (r) => (r as Customer).region },
    { key: 'status', label: 'Trạng thái', type: 'select', options: () => Object.entries(CUSTOMER_STATUS).map(([k, v]) => [k, v.label]), get: (r) => (r as Customer).status },
    { key: 'source', label: 'Nguồn khách', type: 'select', options: (a) => a.sources.map((s) => [s.id, s.name]), get: (r) => (r as Customer).sourceId },
    { key: 'address', label: 'Địa chỉ chứa', type: 'text', get: (r) => (r as Customer).address },
    { key: 'ytd', label: 'Doanh số năm nay (đ)', type: 'number', get: (r) => (r as Customer).ytdRevenue },
    { key: 'last', label: 'Doanh số năm trước (đ)', type: 'number', get: (r) => (r as Customer).lastYearRevenue },
    { key: 'growth', label: 'Tăng trưởng (%)', type: 'number', get: (r) => { const c = r as Customer; return c.lastYearRevenue ? Math.round(((c.ytdRevenue - c.lastYearRevenue) / c.lastYearRevenue) * 1000) / 10 : 0; } },
    { key: 'debt', label: 'Công nợ (đ)', type: 'number', get: (r) => (r as Customer).debt },
    { key: 'zalo', label: 'Đã kết nối Zalo', type: 'bool', get: (r, a) => a.zaloConvs.some((z) => (z.links ?? []).some((l) => l.kind === 'customer' && l.id === r.id)) },
  ],
  LEAD: [
    { key: 'status', label: 'Trạng thái', type: 'select', options: () => Object.entries(LEAD_STATUS).map(([k, v]) => [k, v.label]), get: (r) => (r as Lead).status },
    { key: 'source', label: 'Kênh nguồn', type: 'select', options: () => Object.entries(SOURCE_LABEL), get: (r) => (r as Lead).source },
    { key: 'segment', label: 'Nhóm khách', type: 'select', options: (a) => a.segments.map((s) => [s.code, s.name]), get: (r) => (r as Lead).segment },
    { key: 'region', label: 'Miền', type: 'select', options: () => Object.entries(REGION_LABEL), get: (r) => (r as Lead).region },
    { key: 'province', label: 'Tỉnh / thành chứa', type: 'text', get: (r) => (r as Lead).province ?? '' },
    { key: 'value', label: 'Giá trị dự án (đ)', type: 'number', get: (r) => boqTotal(r as Lead) },
    { key: 'days', label: 'Số ngày từ khi nhận', type: 'number', get: (r) => (r as Lead).receivedDaysAgo },
  ],
};

export const AUD_OPS: Record<AudField['type'], [AudOp, string][]> = { select: [['eq', 'là'], ['neq', 'không phải']], text: [['contains', 'chứa']], number: [['gte', '≥'], ['lte', '≤']], bool: [['eq', 'là']] };

export const subjectOf = (r: Customer | Lead, app: AppCtx): AutoSubject => {
  if ('company' in r) return { kind: 'lead', id: r.id, name: r.contact || r.company, phone: r.phone, customerId: r.customerId, zaloUserId: app.zaloConvs.find((z) => (z.links ?? []).some((l) => l.kind === 'lead' && l.id === r.id))?.zaloUserId };
  return { kind: 'customer', id: r.id, name: r.contactName || r.name, phone: r.contactPhone, customerId: r.id, zaloUserId: app.zaloConvs.find((z) => (z.links ?? []).some((l) => l.kind === 'customer' && l.id === r.id))?.zaloUserId };
};

export const BANNER_PRESETS: Omit<BannerSpec, 'id' | 'updatedAt' | 'name'>[] = [
  { size: 'FB', layout: 'LEFT', bg: '#0B1F3A', bg2: '#16325C', accent: '#F28C28', ink: '#FFFFFF', headline: 'Ưu đãi tháng này – giảm đến 15%', sub: 'Áp dụng cho đơn hàng dự án và đại lý. Số lượng có hạn.', cta: 'Nhận báo giá ngay', showLogo: true },
  { size: 'SQUARE', layout: 'CENTER', bg: '#FFF7ED', bg2: '#FFEDD5', accent: '#EA580C', ink: '#1F2937', headline: 'Ra mắt sản phẩm mới', sub: 'Bền hơn, đẹp hơn, lắp đặt nhanh hơn.', cta: 'Xem chi tiết', showLogo: true },
  { size: 'ZALO', layout: 'SPLIT', bg: '#0068FF', bg2: '#0052CC', accent: '#FFFFFF', ink: '#FFFFFF', headline: 'Hội thảo kỹ thuật miễn phí', sub: 'Giải pháp thi công đúng chuẩn, cập nhật tiêu chuẩn mới.', cta: 'Đăng ký tham dự', showLogo: true },
  { size: 'STORY', layout: 'CENTER', bg: '#111827', bg2: '#374151', accent: '#10B981', ink: '#FFFFFF', headline: 'Tuyển đại lý toàn quốc', sub: 'Chiết khấu hấp dẫn, thưởng tăng trưởng hằng năm, hỗ trợ marketing.', cta: 'Đăng ký làm đại lý', showLogo: true },
];

export const MKT_TABS: MktTab[] = ['calendar', 'content', 'image', 'roi', 'automation'];

/** Biên dịch khối thành Markdown (không kèm dữ liệu ảnh) để xem nhanh, sao chép, tìm kiếm */
export const blocksToMarkdown = (title: string, blocks: ContentBlock[], withImages = false) =>
  [`# ${title}`, ...blocks.flatMap((b) => [`${b.level === 2 ? '##' : '###'} ${b.heading}`, ...(withImages && b.image ? [`![${b.heading}](${b.image.url})`] : []), b.body].filter(Boolean))].join('\n\n');

export const esc2 = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export const blocksToHtml = (title: string, blocks: ContentBlock[]) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc2(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;line-height:1.65;color:#1f2937}img{max-width:100%;border-radius:8px;margin:8px 0}h1{font-size:2rem}h2{margin-top:2rem}</style></head><body><h1>${esc2(title)}</h1>${blocks.map((b) => `<h${b.level}>${esc2(b.heading)}</h${b.level}>${b.image ? `<img src="${b.image.url}" alt="${esc2(b.heading)}">` : ''}${b.body.split(/\n{2,}/).map((p) => `<p>${esc2(p).replace(/\n/g, '<br>')}</p>`).join('')}`).join('')}</body></html>`;

export const JOB_LABEL: Record<AiJob['status'], { label: string; tone: Tone }> = { QUEUED: { label: 'Chờ AI xử lý', tone: 'orange' }, RUNNING: { label: 'AI đang soạn', tone: 'orange' }, DONE: { label: 'AI đã soạn', tone: 'blue' }, FAILED: { label: 'AI lỗi', tone: 'red' } };

export const STUDIO_STEPS = ['Tiêu đề & phân tích', 'Dàn ý', 'Nội dung & hình ảnh', 'Xem trước & lưu'];

export const TASK_STATUS: Record<TaskStatus, { label: string; color: string; bg: string; fg: string }> = {
  PLAN: { label: 'Kế hoạch', color: '#94A3B8', bg: '#F1F5F9', fg: '#334155' },
  AI_QUEUED: { label: 'Chờ AI xử lý', color: '#EAB308', bg: '#FEF9C3', fg: '#713F12' },
  AI_DONE: { label: 'AI xong / chờ duyệt', color: '#2563EB', bg: '#DBEAFE', fg: '#1E3A8A' },
  APPROVED: { label: 'Đã duyệt', color: '#0D9488', bg: '#CCFBF1', fg: '#134E4A' },
  PUBLISHED: { label: 'Đã đăng', color: '#16A34A', bg: '#DCFCE7', fg: '#14532D' },
};

/** Danh sách kênh, khởi tạo khi dùng lần đầu */
export const ST_PLATFORM_CACHE: { list: PlatformStrategy[] | null } = { list: null };

// ---- studio/lib/text.ts ----

export const stFold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export const stripMd = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^[-*]\s+/gm, '').replace(/[#>`_]/g, '');

export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export const countOf = (hay: string, needle: string) => { const h = stFold(hay), n = stFold(needle).trim(); if (!n) return 0; let c = 0, i = h.indexOf(n); while (i >= 0) { c++; i = h.indexOf(n, i + n.length); } return c; };

export const stHas = (hay: string, needle: string) => countOf(hay, needle) > 0;

export const slugify = (s: string) => stFold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

/** Văn bản thuần của cả bài (để đếm từ, kiểm từ khóa) */
export const plainOf = (a: StArticle) => [a.title, a.sapo, ...a.sections.flatMap((s) => [s.title, stripMd(s.body)])].join('\n');

export const stStr = (v: unknown) => (typeof v === 'string' ? v : '');

export const stArr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

/** Hashtag không dấu, viết liền, chữ cái đầu mỗi từ viết hoa: "Băng keo 3M" -> #BangKeo3M */
export const toHashtag = (s: string) => `#${stFold(s).replace(/[^a-z0-9 ]/g, '').split(' ').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('')}`;

// ---- studio/seo/rules.ts ----

/** Bộ luật dựng sẵn để các kênh ghép lại; kênh mới có thể tự viết luật riêng */
export const stRules = {
  keywordIn(where: 'title' | 'sapo' | 'heading' | 'body', settingKey = 'focusKeyword', weight = 10): SeoRule {
    const label = { title: 'tiêu đề', sapo: 'đoạn mở đầu', heading: 'ít nhất 1 tiêu đề H2/H3', body: 'nội dung' }[where];
    return {
      id: `kw-${where}`, label: `Từ khóa chính có trong ${label}`, weight,
      check: ({ article, headings, plain }) => {
        const kw = stStr(article.settings[settingKey]).trim();
        if (!kw) return { status: 'fail', detail: 'Chưa nhập từ khóa chính' };
        const target = where === 'title' ? article.title : where === 'sapo' ? article.sapo.slice(0, 160) : where === 'heading' ? headings.join('\n') : plain;
        return stHas(target, kw) ? { status: 'pass', detail: `Có "${kw}"` } : { status: 'fail', detail: `Chưa có "${kw}"` };
      },
    };
  },
  wordsBetween(min: number, max: number, weight = 8): SeoRule {
    return { id: 'words', label: `Độ dài ${min}–${max} từ`, weight, check: ({ words }) => (words >= min && words <= max ? { status: 'pass', detail: `${words} từ` } : words >= min * 0.7 && words <= max * 1.2 ? { status: 'warn', detail: `${words} từ` } : { status: 'fail', detail: `${words} từ` }) };
  },
  charLimit(key: string, label: string, min: number, max: number, weight = 6): SeoRule {
    return { id: `len-${key}`, label: `${label} ${min}–${max} ký tự`, weight, check: ({ article }) => { const n = stStr(article.settings[key]).length; return n === 0 ? { status: 'fail', detail: 'Chưa có' } : n > max ? { status: 'fail', detail: `${n} ký tự, quá ${n - max}` } : n < min ? { status: 'warn', detail: `${n} ký tự, hơi ngắn` } : { status: 'pass', detail: `${n} ký tự` }; } };
  },
  textImageRatio(wordsPerImage: number, weight = 6): SeoRule {
    return { id: 'img-ratio', label: `Tỷ lệ chữ / ảnh (1 ảnh mỗi ${wordsPerImage} từ)`, weight, check: ({ words, images }) => { const need = Math.max(1, Math.floor(words / wordsPerImage)); return images >= need ? { status: 'pass', detail: `${images} ảnh / ${words} từ` } : images > 0 ? { status: 'warn', detail: `${images}/${need} ảnh` } : { status: 'fail', detail: 'Chưa có ảnh' }; } };
  },
  lsiCoverage(weight = 6): SeoRule {
    return { id: 'lsi', label: 'Phủ từ khóa LSI ≥ 50%', weight, check: ({ article, plain }) => { const l = (article.settings.lsiKeywords as string[] | undefined) ?? []; if (!l.length) return { status: 'warn', detail: 'Chưa nhập LSI' }; const hit = l.filter((k) => stHas(plain, k)).length; const p = hit / l.length; return { status: p >= 0.5 ? 'pass' : p > 0 ? 'warn' : 'fail', detail: `${hit}/${l.length} từ` }; } };
  },
  totalChars(max: number, weight = 8): SeoRule {
    return { id: 'total', label: `Toàn bài ≤ ${max} ký tự`, weight, check: ({ plain }) => (plain.length <= max ? { status: 'pass', detail: `${plain.length} ký tự` } : { status: 'fail', detail: `${plain.length} ký tự, quá ${plain.length - max}` }) };
  },
  /** v38.4: độ dài theo nhóm biến thể "Độ dài" của bài (mặc định 1.200–1.500 từ) */
  wordsByTarget(platform: string, weight = 10): SeoRule {
    return {
      id: 'words', label: 'Độ dài đúng mục tiêu đã chọn', weight,
      check: ({ article, words }) => {
        const t = vWords(article.settings, platform) || 1350;
        const min = Math.round(t * 0.8), max = Math.round(t * 1.35);
        return words >= min && words <= max ? { status: 'pass', detail: `${words} từ (mục tiêu ${min}–${max})` } : words >= min * 0.7 && words <= max * 1.2 ? { status: 'warn', detail: `${words} từ (mục tiêu ${min}–${max})` } : { status: 'fail', detail: `${words} từ (mục tiêu ${min}–${max})` };
      },
    };
  },
  /** v38: ảnh có alt, alt không trùng, ảnh đầu có từ khóa chính */
  imageAlt(weight = 6): SeoRule {
    return {
      id: 'img-alt', label: 'Ảnh có alt text riêng, ảnh đầu chứa từ khóa', weight,
      check: ({ imgs, article }) => {
        if (!imgs.length) return { status: 'warn', detail: 'Chưa có ảnh' };
        const miss = imgs.filter((i) => !i.alt.trim()).length;
        if (miss) return { status: 'fail', detail: `${miss} ảnh thiếu alt` };
        const dup = imgs.length - new Set(imgs.map((i) => stFold(i.alt).trim())).size;
        if (dup) return { status: 'warn', detail: `${dup} ảnh trùng alt` };
        const kw = stStr(article.settings.focusKeyword).trim();
        return kw && !stHas(imgs[0].alt, kw) ? { status: 'warn', detail: 'Alt ảnh đầu chưa có từ khóa' } : { status: 'pass', detail: `${imgs.length} ảnh đủ alt` };
      },
    };
  },
  filled(key: string, label: string, weight = 5): SeoRule {
    return { id: `stHas-${key}`, label, weight, check: ({ article }) => { const v = article.settings[key]; const ok = Array.isArray(v) ? v.length > 0 : !!v && String(v).trim() !== ''; return ok ? { status: 'pass', detail: 'Đã có' } : { status: 'fail', detail: 'Chưa có' }; } };
  },
};

// ---- studio/platforms/social-base.ts ----

/** Khung dùng chung cho kênh mạng xã hội (Facebook, Zalo…): không H2/H3, có hook, CTA, hashtag */
export const ST_HOOKS = [
  { value: 'AIDA', label: 'AIDA', hint: 'Chú ý → Quan tâm → Mong muốn → Hành động' },
  { value: 'PAS', label: 'PAS', hint: 'Vấn đề → Khuấy động → Giải pháp' },
] as const;

export const socialFields = (extra: readonly FieldDef[] = []): FieldDef[] => [
  { key: 'hook', label: 'Cấu trúc Hook', kind: 'select', required: true, options: ST_HOOKS },
  { key: 'tone', label: 'Giọng điệu', kind: 'select', options: [{ value: 'friendly', label: 'Thân thiện' }, { value: 'expert', label: 'Chuyên gia' }, { value: 'urgent', label: 'Khẩn trương (ưu đãi)' }] },
  { key: 'ctaText', label: 'Lời kêu gọi (CTA)', kind: 'text', required: true, placeholder: 'VD: Nhắn ngay để nhận báo giá trong 2 giờ', wide: true },
  { key: 'ctaPhone', label: 'Số điện thoại', kind: 'text', placeholder: '0909 xxx xxx' },
  { key: 'ctaLink', label: 'Liên kết', kind: 'text', placeholder: 'https://' },
  { key: 'hashtagRule', label: 'Quy tắc hashtag', kind: 'select', options: [{ value: 'brand_topic', label: 'Thương hiệu + chủ đề' }, { value: 'topic', label: 'Chỉ chủ đề' }, { value: 'none', label: 'Không dùng' }] },
  { key: 'hashtags', label: 'Hashtag cố định', kind: 'tags', placeholder: '#VASSH', showIf: (s) => s.hashtagRule !== 'none' },
  ...extra,
];

/** Tiêu đề mục -> dòng nổi bật trong chữ thuần (mạng xã hội không có H2/H3, không có markdown) */
export const titleLine = (t: string) => `▸ ${t.toLocaleUpperCase('vi')}`;

// ---- studio/platforms/website.ts ----

export const stEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const stMdToHtml = (md: string) => md.split(/\n{2,}/).map((p) => (/^[-*]\s/m.test(p) ? `<ul>${p.split('\n').map((l) => `<li>${stInline(l.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>` : `<p>${stInline(p)}</p>`)).join('\n');

export const stInline = (s: string) => stEsc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

/** v38: brief chung cho mọi kênh (thông điệp, sản phẩm, ưu đãi, ý bắt buộc, nguồn tham khảo) — nối vào prompt dàn ý / viết mục */
export const ST_BRIEF_FIELDS: readonly FieldDef[] = [
  { key: 'keyMessage', label: 'Thông điệp chính / USP', kind: 'textarea', maxLength: 400, placeholder: 'VD: Băng keo VHB thay vít, thi công nhanh hơn, không khoan khung nhôm' },
  { key: 'products', label: 'Sản phẩm / mã hàng cần nhắc tới', kind: 'tags', placeholder: 'VD: 3M VHB 4910 (Enter để thêm)' },
  { key: 'offer', label: 'Ưu đãi / khuyến mãi (nếu có)', kind: 'text', wide: true, placeholder: 'VD: Giảm 5% đơn từ 20 cuộn đến 31/12' },
  { key: 'mustInclude', label: 'Ý bắt buộc phải có', kind: 'tags', placeholder: 'VD: tiêu chuẩn IEC 60502 (Enter để thêm)' },
  { key: 'avoid', label: 'Không nhắc tới', kind: 'tags', placeholder: 'VD: tên đối thủ, giá cụ thể' },
  { key: 'references', label: 'Nguồn tham khảo (URL, tài liệu)', kind: 'tags', placeholder: 'https://… (Enter để thêm)' },
];

export const ST_INTENTS = [{ value: 'info', label: 'Thông tin', hint: 'hướng dẫn, giải thích' }, { value: 'compare', label: 'Cân nhắc', hint: 'so sánh, đánh giá, chọn mua' }, { value: 'buy', label: 'Giao dịch', hint: 'mua, báo giá, đặt hàng' }, { value: 'local', label: 'Địa phương', hint: 'nơi bán, đại lý gần' }] as const;

export const stOutlinePrompt = (p: PlatformStrategy, a: StArticle, c: StCompany) => p.outlinePrompt(a, c) + stBriefText(a.settings, p.id, 'outline');

export const stSectionPrompt = (p: PlatformStrategy, a: StArticle, id: string, c: StCompany) => p.sectionPrompt(a, id, c) + stBriefText(a.settings, p.id, 'section');

/** Số từ mỗi mục theo độ dài mục tiêu */
export const stPerSection = (a: StArticle) => { const t = vWords(a.settings, a.platform) || Number(stStr(a.settings.wordTarget)) || 0; if (!t) return '120–220 từ'; const per = Math.round((t * 1.25) / Math.max(1, a.sections.length)); return `khoảng ${Math.max(80, per - 40)}–${per + 40} từ`; };

/** Thông tin doanh nghiệp đưa vào prompt Studio */
export const stCompanyOf = (c: CompanyInfo): StCompany => ({ name: c.shortName || c.appName, address: c.address ?? '', phone: c.phone ?? '', website: c.website, sector: bizMode(c) === 'MFG' ? 'nội thất, cửa nhôm kính, lắp đặt công trình' : 'vật tư điện, phụ kiện cáp, băng keo và vật liệu 3M cho công trình' });

/** Kênh của nhiệm vụ / nội dung -> kênh Studio (PlatformStrategy) */
export const ST_OF_CHANNEL: Partial<Record<MktChannel, string>> = { WEBSITE: 'website', FACEBOOK: 'facebook', ZALO_OA: 'zalo', GOOGLE: 'google_maps' };

/** Website / Blog chuẩn SEO */
export const ST_P_WEBSITE: PlatformStrategy = {
  id: 'website',
  label: 'Website / Blog',
  description: 'Bài chuẩn SEO: H2/H3, meta title, meta description, từ khóa chính và LSI',
  order: 1,
  structure: { headings: true, maxSections: 12, sapoLabel: 'Sapo (đoạn mở đầu)', sapoMax: 300 },
  fields: [
    { key: 'focusKeyword', label: 'Focus Keyword', kind: 'text', required: true, placeholder: 'VD: băng keo VHB mặt dựng kính', help: 'AI đưa từ khóa vào tiêu đề, sapo và ít nhất 1 tiêu đề H2' },
    { key: 'lsiKeywords', label: 'LSI Keywords', kind: 'tags', placeholder: 'Enter để thêm', help: 'Từ khóa liên quan, AI rải vào các H2/H3 phù hợp' },
    { key: 'metaTitle', label: 'Meta Title', kind: 'counter', maxLength: 60, wide: true, suggest: (a, s) => stClip(a.title.toLowerCase().includes(stStr(s.focusKeyword).toLowerCase()) ? a.title : `${stStr(s.focusKeyword)}: ${a.title}`, 60) },
    { key: 'metaDescription', label: 'Meta Description', kind: 'counter', maxLength: 155, wide: true, suggest: (a) => stClip(a.sapo || a.sections.map((x) => x.body).join(' '), 155) },
    { key: 'slug', label: 'Đường dẫn (slug)', kind: 'text', suggest: (a) => slugify(a.title) },
    { key: 'searchIntent', label: 'Ý định tìm kiếm', kind: 'select', options: ST_INTENTS, help: 'Quyết định cách mở bài và lời kêu gọi' },
    { key: 'internalLinks', label: 'Liên kết nội bộ cần đặt', kind: 'tags', placeholder: '/san-pham/bang-keo-vhb (Enter để thêm)', help: 'Trang sản phẩm / bài liên quan trên website' },
  ],
  defaults: () => ({ focusKeyword: '', lsiKeywords: [], metaTitle: '', metaDescription: '', slug: '', searchIntent: 'info', internalLinks: [] }),
  validate: (s) => (stStr(s.focusKeyword).trim() ? [] : ['Nhập Focus Keyword']),
  outlinePrompt: (a) => [
    `Lập dàn ý bài blog chuẩn SEO tiếng Việt cho tiêu đề: "${a.title}".`,
    `Từ khóa chính: "${stStr(a.settings.focusKeyword)}" — bắt buộc xuất hiện trong ít nhất 1 tiêu đề H2.`,
    `Từ khóa LSI (rải vào các H2/H3 phù hợp, tự nhiên): ${stArr(a.settings.lsiKeywords).join(', ') || 'không có'}.`,
    'Trả JSON: {"sapo":"...","sections":[{"level":2,"title":"..."},{"level":3,"title":"..."}]}. 5–8 mục H2, mỗi H2 tối đa 3 H3.',
  ].join('\n'),
  sectionPrompt: (a, id) => { const s = a.sections.find((x) => x.id === id); return `Viết nội dung cho mục ${s?.level === 3 ? 'H3' : 'H2'} "${s?.title}" của bài "${a.title}". ${stPerSection(a)}, đoạn ngắn, có số liệu nếu được cung cấp, tự nhiên chứa từ khóa "${stStr(a.settings.focusKeyword)}" hoặc 1 từ LSI. Không lặp tiêu đề.`; },
  render: (a) => ({
    format: 'html',
    meta: { title: stStr(a.settings.metaTitle), description: stStr(a.settings.metaDescription) },
    body: a.doc ? [`<h1>${stEsc(a.title)}</h1>`, `<p class="sapo"><strong>${stEsc(a.sapo)}</strong></p>`, wsDocHtml(a.doc)].join('\n') : [`<h1>${stEsc(a.title)}</h1>`, `<p class="sapo"><strong>${stEsc(a.sapo)}</strong></p>`, ...a.sections.flatMap((s) => [`<h${s.level}>${stEsc(s.title)}</h${s.level}>`, ...(s.image ? [`<figure><img src="${stEsc(s.image.url)}" alt="${stEsc(s.image.alt)}"/></figure>`] : []), stMdToHtml(s.body)])].join('\n'),
  }),
  seoRules: [
    stRules.keywordIn('title', 'focusKeyword', 12), stRules.keywordIn('sapo', 'focusKeyword', 10), stRules.keywordIn('heading', 'focusKeyword', 10),
    stRules.wordsByTarget('website', 10), stRules.charLimit('metaTitle', 'Meta Title', 30, 60, 8), stRules.charLimit('metaDescription', 'Meta Description', 120, 155, 8),
    stRules.lsiCoverage(6), stRules.textImageRatio(350, 6), stRules.imageAlt(6),
  ],
  image: { aspect: 'landscape', hint: 'Ảnh ngang 3:2 cho bài blog, có thể chèn chữ ngắn' },
};

// ---- studio/platforms/facebook.ts ----

/** Facebook Fanpage */
export const ST_P_FACEBOOK = socialStrategy({ id: 'facebook', label: 'Facebook', description: 'Bài Fanpage: hook AIDA / PAS, CTA, hashtag, không H2/H3', order: 2, maxChars: 2000 });

// ---- studio/platforms/zalo.ts ----

/** Zalo OA: ngắn hơn Facebook, thêm nhãn nút bấm */
export const ST_P_ZALO = socialStrategy({
  id: 'zalo', label: 'Zalo OA', description: 'Tin bài Zalo OA: ngắn, CTA kèm nút bấm', order: 3, maxChars: 1000,
  extraFields: [{ key: 'buttonLabel', label: 'Nhãn nút', kind: 'text', maxLength: 30, placeholder: 'VD: Nhận báo giá' }],
});

// ---- studio/platforms/google-maps.ts ----

export const POST_TYPES = [{ value: 'update', label: 'Cập nhật' }, { value: 'event', label: 'Sự kiện' }, { value: 'offer', label: 'Ưu đãi' }] as const;

/** Bài đăng hồ sơ doanh nghiệp trên Google Maps: tối ưu 100 ký tự đầu + khối NAP */
export const ST_P_GMAPS: PlatformStrategy = {
  id: 'google_maps',
  label: 'Google Maps',
  description: 'Bài đăng Google Business Profile: loại bài, 100 ký tự đầu, NAP',
  order: 4,
  structure: { headings: false, maxSections: 3, sapoLabel: '100 ký tự đầu (hiện trên bản đồ)', sapoMax: 100, totalMax: 1500 },
  fields: [
    { key: 'postType', label: 'Loại bài đăng Maps', kind: 'select', required: true, options: POST_TYPES },
    { key: 'localKeyword', label: 'Từ khóa địa phương', kind: 'text', placeholder: 'VD: vật tư điện Tân Bình', help: 'Đưa vào 100 ký tự đầu' },
    { key: 'eventStart', label: 'Bắt đầu', kind: 'date', showIf: (s) => s.postType === 'event' || s.postType === 'offer' },
    { key: 'eventEnd', label: 'Kết thúc', kind: 'date', showIf: (s) => s.postType === 'event' || s.postType === 'offer' },
    { key: 'offerCode', label: 'Mã ưu đãi', kind: 'text', showIf: (s) => s.postType === 'offer' },
    { key: 'button', label: 'Nút hành động', kind: 'select', options: [{ value: 'CALL', label: 'Gọi ngay' }, { value: 'LEARN_MORE', label: 'Tìm hiểu thêm' }, { value: 'BOOK', label: 'Đặt lịch' }, { value: 'ORDER', label: 'Đặt hàng' }] },
    { key: 'nap', label: 'Khối NAP (tên, địa chỉ, điện thoại)', kind: 'nap', wide: true, help: 'Lấy từ Cài đặt › Thông tin doanh nghiệp, giữ thống nhất mọi nơi' },
  ],
  defaults: () => ({ postType: 'update', localKeyword: '', eventStart: '', eventEnd: '', offerCode: '', button: 'CALL', nap: true }),
  validate: (s) => [
    ...(s.postType === 'event' && (!stStr(s.eventStart) || !stStr(s.eventEnd)) ? ['Nhập ngày bắt đầu / kết thúc sự kiện'] : []),
    ...(s.postType === 'offer' && !stStr(s.eventEnd) ? ['Nhập ngày kết thúc ưu đãi'] : []),
  ],
  outlinePrompt: (a) => `Viết dàn ý bài đăng Google Maps loại "${POST_TYPES.find((p) => p.value === a.settings.postType)?.label}" cho "${a.title}". 100 ký tự đầu phải chứa "${stStr(a.settings.localKeyword)}" và lợi ích chính. Trả JSON {"sapo":"≤100 ký tự","sections":[{"level":2,"title":"..."}]} tối đa 3 ý.`,
  sectionPrompt: (a, id) => `Viết 1–2 câu cho ý "${a.sections.find((x) => x.id === id)?.title}", chữ thuần, không hashtag, không emoji (bài "${a.title}").`,
  render: (a, c) => ({
    format: 'text',
    body: [a.sapo, ...a.sections.map((s) => stripMd(s.body)),
      a.settings.postType !== 'update' && stStr(a.settings.eventStart) ? `Thời gian: ${stStr(a.settings.eventStart)} – ${stStr(a.settings.eventEnd)}` : '',
      stStr(a.settings.offerCode) ? `Mã ưu đãi: ${stStr(a.settings.offerCode)}` : '',
      a.settings.nap ? `${c.name}\n${c.address}\n${c.phone}` : ''].filter(Boolean).join('\n\n'),
  }),
  seoRules: [
    { id: 'first100', label: 'Từ khóa địa phương trong 100 ký tự đầu', weight: 14, check: ({ article }) => { const k = stStr(article.settings.localKeyword); if (!k) return { status: 'warn', detail: 'Chưa nhập từ khóa' }; return stHas(article.sapo.slice(0, 100), k) ? { status: 'pass', detail: 'Có' } : { status: 'fail', detail: 'Chưa có' }; } },
    { id: 'nap', label: 'Có khối NAP đầy đủ', weight: 10, check: ({ article, company }) => (article.settings.nap && company.address && company.phone ? { status: 'pass', detail: company.name } : { status: 'fail', detail: 'Thiếu địa chỉ / điện thoại công ty' }) },
    stRules.totalChars(1500, 10),
    stRules.filled('button', 'Có nút hành động', 6),
    stRules.textImageRatio(10_000, 6),
  ],
  image: { aspect: 'landscape', hint: 'Ảnh ngang 4:3, thật, không chèn chữ lớn' },
};

// ---- studio/image/brand.ts ----
/** Bộ nhận diện dùng cho ảnh AI. Đổi màu / logo ở đây, không sửa component. */
export const ST_BRAND = {
  navy: '#001d74',
  orange: '#ff8c00',
  name: 'VASSH',
  /** Câu bổ sung vào prompt khi bật "Ưu tiên màu thương hiệu" */
  palettePrompt: 'Bảng màu chủ đạo: xanh navy đậm #001d74 và cam #ff8c00, nền sáng sạch, phong cách ảnh thương mại B2B công nghiệp. Không chèn logo hay chữ thương hiệu.',
} as const;

export const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = src; });

export const stUid = () => Math.random().toString(36).slice(2, 10);

export const stTouch = (a: StArticle): StArticle => ({ ...a, updatedAt: Date.now() });

export const stNewArticle = (platform = 'website', company: StCompany): StArticle => ({
  id: stUid(), platform, title: '', sapo: '', sections: [], settings: getPlatform(platform).defaults(company), updatedAt: Date.now(),
});

export const createStudioStore = (company: StCompany, initial?: StArticle, step0: StStepId = 1) => stCreate<StudioState>()((set, get) => {
  /** Ghi lịch sử cho các thao tác cấu trúc (không ghi từng phím gõ) */
  const snap = () => ({ history: [...get().history.slice(-29), get().article] });
  const mapSection = (id: string, f: (s: StSection) => StSection) => set((st) => ({ article: stTouch({ ...st.article, sections: st.article.sections.map((s) => (s.id === id ? f(s) : s)) }) }));
  return {
    step: step0,
    article: initial ?? stNewArticle('website', company),
    company,
    activeSectionId: null,
    navAt: 0,
    busy: {},
    stash: {},
    history: [],

    setStep: (step) => set({ step }),
    setPlatform: (id) => set((st) => {
      if (id === st.article.platform) return {};
      const p = getPlatform(id);
      const stash = { ...st.stash, [st.article.platform]: st.article.settings };
      // Ưu tiên: cài đặt cũ của chính kênh đó > giá trị trùng khóa vừa nhập (VD ctaPhone Facebook -> Zalo) > mặc định
      const shared = Object.fromEntries(Object.entries(st.article.settings).filter(([k]) => p.fields.some((f) => f.key === k)));
      return { ...snap(), stash, article: stTouch({ ...st.article, platform: id, settings: { ...p.defaults(st.company), ...shared, ...(stash[id] ?? {}) } }) };
    }),
    setSetting: (key, v) => set((st) => ({ article: stTouch({ ...st.article, settings: { ...st.article.settings, [key]: v } }) })),
    setTitle: (title) => set((st) => ({ article: stTouch({ ...st.article, title }) })),
    setSapo: (sapo) => set((st) => ({ article: stTouch({ ...st.article, sapo }) })),
    setOutline: (rows) => set((st) => {
      const max = getPlatform(st.article.platform).structure.maxSections;
      return { ...snap(), article: stTouch({ ...st.article, sections: rows.slice(0, max).map((r) => ({ id: stUid(), level: r.level, title: r.title, body: '' })) }) };
    }),
    addSection: (after, level = 2) => set((st) => {
      const s: StSection = { id: stUid(), level, title: 'Mục mới', body: '' };
      const list = [...st.article.sections];
      const i = after ? list.findIndex((x) => x.id === after) + 1 : list.length;
      list.splice(i, 0, s);
      return { ...snap(), article: stTouch({ ...st.article, sections: list }), activeSectionId: s.id };
    }),
    removeSection: (id) => set((st) => ({ ...snap(), article: stTouch({ ...st.article, sections: st.article.sections.filter((s) => s.id !== id) }) })),
    moveSection: (id, to) => set((st) => {
      const list = [...st.article.sections];
      const from = list.findIndex((s) => s.id === id);
      if (from < 0) return {};
      const [s] = list.splice(from, 1);
      list.splice(Math.max(0, Math.min(to, list.length)), 0, s);
      return { ...snap(), article: stTouch({ ...st.article, sections: list }) };
    }),
    patchSection: (id, p) => mapSection(id, (s) => ({ ...s, ...p })),
    setImage: (id, image) => { set(snap()); mapSection(id, (s) => ({ ...s, image })); },
    setDoc: (doc) => set((st) => ({ article: stTouch({ ...st.article, doc, sections: wsDocToSections(doc, st.article.sections) }) })),
    setActive: (activeSectionId) => set({ activeSectionId }),
    focusSection: (id) => set({ activeSectionId: id, navAt: Date.now() }),
    setBusy: (id, kind) => set((st) => ({ busy: { ...st.busy, [id]: kind } })),
    undo: () => set((st) => (st.history.length ? { article: st.history[st.history.length - 1], history: st.history.slice(0, -1) } : {})),
  };
});

// ---- studio/store/context.tsx ----

/**
 * Mỗi Studio đang mở có store riêng (mở 2 bài song song không lẫn dữ liệu), cấp qua Context.
 * Component đọc bằng useStudio(selector): chỉ render lại khi lát cắt chọn thay đổi.
 */
export const StCtx = createContext<StudioStore | null>(null);

// ---- studio/steps/DynamicSettingsForm.tsx ----

export const input = 'w-full rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 py-2 text-sm focus:border-[rgb(var(--accent))] focus:outline-none';

/** Một trường: chỉ đăng ký đúng giá trị của nó => gõ trường này không render lại trường khác */
export const FieldRow = memo(function FieldRow({ field: f }: { field: FieldDef }) {
  const value = useStudio((s) => s.article.settings[f.key]);
  const company = useStudio((s) => s.company);
  const { setSetting } = useStudioActions();
  const api = useStudioApi();
  const set = (v: string | number | boolean | string[]) => setSetting(f.key, v);
  const suggest = f.suggest ? () => { const st = api.getState(); set(f.suggest!(st.article, st.article.settings)); } : undefined;
  const id = `fld-${f.key}`;

  return (
    <div className={f.wide || f.kind === 'textarea' || f.kind === 'tags' || f.kind === 'nap' ? 'md:col-span-2' : ''}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">{f.label}{f.required && <span className="text-[rgb(var(--danger-fg))]"> *</span>}</label>
        {suggest && <button type="button" onClick={suggest} className="text-xs font-medium text-[rgb(var(--secondary-fg))] hover:underline">Gợi ý tự động</button>}
      </div>
      {f.kind === 'select' ? (
        <select id={id} className={input} value={stStr(value)} onChange={(e) => set(e.target.value)}>
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}{o.hint ? ` — ${o.hint}` : ''}</option>)}
        </select>
      ) : f.kind === 'tags' ? (
        <TagInput id={id} value={stArr(value)} onChange={set} placeholder={f.placeholder} />
      ) : f.kind === 'counter' ? (
        <CounterInput id={id} value={stStr(value)} max={f.maxLength ?? 60} onChange={set} />
      ) : f.kind === 'textarea' ? (
        <textarea id={id} rows={3} className={input} value={stStr(value)} maxLength={f.maxLength} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
      ) : f.kind === 'toggle' ? (
        <input id={id} type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={!!value} onChange={(e) => set(e.target.checked)} />
      ) : f.kind === 'nap' ? (
        <label className="flex items-start gap-3 rounded-md border border-[rgb(var(--line))] p-3 text-sm">
          <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" checked={!!value} onChange={(e) => set(e.target.checked)} />
          <span><b>{company.name}</b><br />{company.address || <i className="text-[rgb(var(--danger-fg))]">Chưa có địa chỉ</i>}<br />{company.phone || <i className="text-[rgb(var(--danger-fg))]">Chưa có điện thoại</i>}</span>
        </label>
      ) : (
        <input id={id} type={f.kind === 'date' ? 'date' : 'text'} className={input} value={stStr(value)} maxLength={f.maxLength} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
      )}
      {f.help && <p className="mt-1 text-xs text-[rgb(var(--muted))]">{f.help}</p>}
    </div>
  );
});

// ---- studio/steps/OutlinePanel.tsx ----

/** Chuỗi khóa ổn định của dàn ý: chỉ đổi khi thêm / bớt / đổi tiêu đề / đổi cấp, KHÔNG đổi khi gõ nội dung */
export const outlineKey = (s: { article: { sections: { id: string; level: number; title: string; image?: unknown }[] } }) =>
  s.article.sections.map((x) => `${x.id}\u0001${x.level}\u0001${x.title}\u0001${x.image ? 1 : 0}`).join('\u0002');

/**
 * Cột trái của Bước 2 và Bước 3: danh sách H2 / H3 kéo thả để sắp xếp.
 * Bấm một mục => đánh dấu đang chọn + cuộn cột phải tới đúng mục đó.
 */
export const OutlinePanel = memo(function OutlinePanel({ headings = true }: { headings?: boolean }) {
  const key = useStudio(outlineKey);
  const active = useStudio((s) => s.activeSectionId);
  const { moveSection, focusSection, addSection, patchSection } = useStudioActions();
  const [drag, setDrag] = useState<{ id: string; over: number } | null>(null);
  const rows = key ? key.split('\u0002').map((r) => { const [id, level, title, img] = r.split('\u0001'); return { id, level: Number(level) as 2 | 3, title, img: img === '1' }; }) : [];

  const jump = (id: string) => {
    focusSection(id);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav aria-label="Dàn ý" className="flex h-full flex-col">
      <p className="px-3 pb-2 pt-3 text-xs font-semibold text-[rgb(var(--muted))]">Dàn ý · {rows.length} mục</p>
      <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2" onDragOver={(e) => e.preventDefault()}>
        {rows.map((r, i) => (
          <li key={r.id} draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ id: r.id, over: i }); }}
            onDragEnter={() => drag && setDrag({ ...drag, over: i })}
            onDragEnd={() => { if (drag) moveSection(drag.id, drag.over); setDrag(null); }}
            className={`group flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-sm ${r.level === 3 ? 'ml-4' : ''} ${active === r.id ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)]' : 'border-transparent hover:bg-[rgb(var(--ink)/0.04)]'} ${drag?.over === i && drag.id !== r.id ? 'border-t-2 border-t-[rgb(var(--accent))]' : ''}`}>
            <span className="cursor-grab select-none text-[rgb(var(--faint))]" aria-hidden>⋮⋮</span>
            {headings && (
              <button type="button" title="Đổi cấp H2 / H3" onClick={() => patchSection(r.id, { level: r.level === 2 ? 3 : 2 })}
                className="w-7 shrink-0 rounded bg-[rgb(var(--sunken))] text-[11px] font-semibold text-[rgb(var(--muted))]">H{r.level}</button>
            )}
            <button type="button" onClick={() => jump(r.id)} className="min-w-0 flex-1 truncate text-left" aria-current={active === r.id}>{r.title || 'Chưa đặt tiêu đề'}</button>
            {r.img && <span className="text-[11px] text-[rgb(var(--success-fg))]" title="Đã có ảnh">●</span>}
            <span className="sr-only">Kéo để đổi vị trí; hoặc dùng nút lên xuống</span>
            <button type="button" aria-label={`Đưa "${r.title}" lên`} disabled={i === 0} onClick={() => moveSection(r.id, i - 1)} className="hidden text-xs text-[rgb(var(--muted))] disabled:opacity-30 group-hover:block group-focus-within:block">↑</button>
            <button type="button" aria-label={`Đưa "${r.title}" xuống`} disabled={i === rows.length - 1} onClick={() => moveSection(r.id, i + 1)} className="hidden text-xs text-[rgb(var(--muted))] disabled:opacity-30 group-hover:block group-focus-within:block">↓</button>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => addSection(rows.at(-1)?.id ?? null)} className="m-2 rounded-md border border-dashed border-[rgb(var(--line))] py-1.5 text-sm text-[rgb(var(--muted))] hover:border-[rgb(var(--accent))]">+ Thêm mục</button>
    </nav>
  );
});

// ---- studio/sidebar/SeoSidebar.tsx ----

export const TONE = { pass: 'text-[rgb(var(--success-fg))]', warn: 'text-[rgb(var(--accent-fg))]', fail: 'text-[rgb(var(--danger-fg))]' } as const;

export const ICON = { pass: '✓', warn: '!', fail: '✕' } as const;

/**
 * Thanh điểm SEO ghim bên phải (Bước 3, 4). Lắng nghe bài viết nhưng chấm điểm trên bản "trì hoãn"
 * (useDeferredValue): khi người dùng gõ nhanh, React ưu tiên ô nhập, điểm SEO cập nhật ngay sau đó, không giật.
 * Luật chấm lấy từ strategy của kênh => Website chấm từ khóa / meta; Facebook chấm hook / CTA; Maps chấm 100 ký tự đầu / NAP.
 */
export const SeoSidebar = memo(function SeoSidebar() {
  const article = useStudio((s) => s.article);
  const company = useStudio((s) => s.company);
  const deferred = useDeferredValue(article);
  const p = getPlatform(deferred.platform);
  const report = useMemo(() => scoreArticle(deferred, p, company), [deferred, p, company]);
  const stale = deferred !== article;
  const color = report.score >= 80 ? 'rgb(var(--success))' : report.score >= 50 ? 'rgb(var(--accent))' : 'rgb(var(--danger))';
  const C = 2 * Math.PI * 34;

  return (
    <aside aria-label="Điểm SEO" className="sticky top-4 space-y-4 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4" aria-busy={stale}>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0" role="img" aria-label={`Điểm ${report.score}/100`}>
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgb(var(--sunken))" strokeWidth="8" />
          <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(report.score / 100) * C} ${C}`} transform="rotate(-90 40 40)" />
          <text x="40" y="46" textAnchor="middle" fontSize="20" fontWeight="700" fill="rgb(var(--fg))">{report.score}</text>
        </svg>
        <div>
          <p className="text-sm font-semibold">Điểm {p.label}</p>
          <p className="text-xs text-[rgb(var(--muted))]">{report.score >= 80 ? 'Sẵn sàng xuất bản' : report.score >= 50 ? 'Cần chỉnh thêm' : 'Chưa đạt'}</p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-[rgb(var(--sunken))] p-2"><dt className="text-[11px] text-[rgb(var(--muted))]">Số từ</dt><dd className="font-semibold tabular-nums">{report.words}</dd></div>
        <div className="rounded-md bg-[rgb(var(--sunken))] p-2"><dt className="text-[11px] text-[rgb(var(--muted))]">Ảnh</dt><dd className="font-semibold tabular-nums">{report.images}</dd></div>
        <div className="rounded-md bg-[rgb(var(--sunken))] p-2"><dt className="text-[11px] text-[rgb(var(--muted))]">Ký tự</dt><dd className="font-semibold tabular-nums">{report.chars}</dd></div>
      </dl>
      <ul className="space-y-2">
        {report.items.map((i) => (
          <li key={i.id} className="flex gap-2 text-sm">
            <span className={`w-4 shrink-0 text-center font-semibold ${TONE[i.status]}`} aria-hidden>{ICON[i.status]}</span>
            <span className="min-w-0"><span className="block leading-snug">{i.label}</span><span className={`block text-xs ${TONE[i.status]}`}>{i.detail}</span></span>
          </li>
        ))}
      </ul>
    </aside>
  );
});

// ---- studio/host: ghép Studio vào Marketing Hub › Content Studio ----

/** Kênh Studio ↔ loại nội dung + kênh Marketing của app */
export const ST_TO_MKT: Record<string, { type: MktContentType; channel: MktChannel }> = {
  website: { type: 'AD_POST', channel: 'WEBSITE' },
  facebook: { type: 'AD_POST', channel: 'FACEBOOK' },
  zalo: { type: 'ZALO_OA', channel: 'ZALO_OA' },
  'google-maps': { type: 'AD_POST', channel: 'GOOGLE' },
  google_maps: { type: 'AD_POST', channel: 'GOOGLE' },
};

/** Loại nội dung soạn bằng Studio mới; ZNS, email báo giá, tin chăm sóc vẫn dùng trình soạn cũ */
export const studioSupports = (c: MktContent) => c.type === 'AD_POST' || c.type === 'PRESS' || c.type === 'ZALO_OA';

export const platformOfContent = (c: MktContent) => c.platform ?? (c.channel === 'FACEBOOK' ? 'facebook' : c.channel === 'ZALO_OA' || c.type === 'ZALO_OA' ? 'zalo' : c.channel === 'GOOGLE' ? 'google_maps' : 'website');

/** v38: Bước 3 (Viết & ảnh) + Bước 4 (Hoàn thiện) gộp thành Workspace */
export const ST_STEPS: { id: StStepId; label: string }[] = [{ id: 1, label: 'Cài đặt' }, { id: 2, label: 'Dàn ý' }, { id: 3, label: 'Workspace' }];

export const INITIAL_AI_QUOTA: AiQuotaCfg = { ghost: { enabled: true, dailyLimit: 50, extraUsers: [], blockedUsers: [] } };

export const CV_MAX = 20;

export const CV_KIND: Record<ContentVersionKind, { label: string; tone: Tone }> = {
  AI_DRAFT: { label: 'AI viết', tone: 'blue' }, HUMANIZE: { label: 'Humanize', tone: 'teal' }, MANUAL: { label: 'Lưu tay', tone: 'muted' },
  REVIEW: { label: 'Gửi duyệt', tone: 'orange' }, APPROVED: { label: 'Đã duyệt', tone: 'teal' }, RESTORE: { label: 'Trước khôi phục', tone: 'muted' },
};

/** Cụm sáo thường gặp trong văn AI (sửa được ở Cài đặt › AI) */
export const HS_CLICHES_DEFAULT = [
  'bên cạnh đó', 'không chỉ ... mà còn', 'tóm lại', 'nhìn chung', 'có thể nói', 'đóng vai trò quan trọng', 'trong bối cảnh', 'hơn nữa', 'ngoài ra',
  'điều này cho thấy', 'một cách hiệu quả', 'đáng chú ý', 'không thể phủ nhận', 'giải pháp tối ưu', 'vô cùng quan trọng', 'hàng đầu', 'nâng tầm',
  'trải nghiệm tuyệt vời', 'đa dạng', 'tối ưu hóa', 'chính vì vậy', 'nói cách khác', 'cuối cùng nhưng không kém phần quan trọng',
];

export const WS_TONES = [{ value: 'talk', label: 'Giao tiếp' }, { value: 'expert', label: 'Chuyên gia' }, { value: 'sales', label: 'Bán hàng' }] as const;

// ---- workspace/doc.ts: chuyển đổi giữa dàn ý (sections) và tài liệu TipTap (doc JSON) ----

export const wsId = () => `b${Math.random().toString(36).slice(2, 10)}`;

export const WS_BLOCK_TYPES = ['heading', 'paragraph', 'bulletList', 'orderedList', 'blockquote', 'image', 'horizontalRule'];

export const wsPara = (s: string): JSONContent => { const c = wsInline(s.trim()); return c.length ? { type: 'paragraph', content: c } : { type: 'paragraph' }; };

export const wsText = (n: JSONContent): string => (n.type === 'text' ? n.text ?? '' : (n.content ?? []).map(wsText).join(n.type === 'bulletList' || n.type === 'orderedList' ? '\n' : ''));

export const wsInlineMd = (n: JSONContent): string => (n.type === 'text' ? (n.marks?.some((m) => m.type === 'bold') ? `**${n.text ?? ''}**` : n.text ?? '') : (n.content ?? []).map(wsInlineMd).join(''));

export const wsHeadKey = (d: JSONContent) => (d.content ?? []).filter((n) => n.type === 'heading').map((n) => `${n.attrs?.id}|${n.attrs?.level}|${wsText(n)}`).join('\n');

export const wsSecKey = (a: StArticle) => a.sections.map((s) => `${s.id}|${s.level}|${s.title}`).join('\n');

export const wsImages = (d: JSONContent | undefined): WsImage[] => (d?.content ?? []).filter((n) => n.type === 'image').map((n) => ({ src: String(n.attrs?.src ?? ''), alt: String(n.attrs?.alt ?? ''), caption: String(n.attrs?.caption ?? n.attrs?.title ?? ''), fileName: String(n.attrs?.fileName ?? '') }));

export const wsSafeHref = (h: string) => (/^(https?:|mailto:|tel:|\/)/i.test(h) ? h : '#');

export const wsWords = (t: string) => t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

export const wsSentences = (t: string) => t.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => wsWords(s).length > 0);

export const wsClamp = (x: number) => Math.max(0, Math.min(1, x));

export const WS_GHOST = new PluginKey<WsGhost>('ws-ghost');

export const WS_MARKS = new PluginKey<WsMarks>('ws-marks');

/** Người dùng có thuộc nhóm được bật gợi ý viết tiếp không (máy chủ kiểm lại y hệt, đây chỉ để ẩn / hiện giao diện) */
export const ghostEligible = (q: AiQuotaCfg, me: User | null, role: Role) =>
  !!me && q.ghost.enabled && !q.ghost.blockedUsers.includes(me.id) && (role === 'BOD' || role === 'MKT_LEAD' || me.dept === 'MARKETING' || q.ghost.extraUsers.includes(me.id));

export const GHOST_PREF = (uid0: string) => `3a:ghost-off:${uid0}`;

export const ghostPrefOff = (uid0: string) => { try { return localStorage.getItem(GHOST_PREF(uid0)) === '1'; } catch { return false; } };

/** Thêm mốc, giữ tối đa 20 mốc mỗi bài (bỏ mốc cũ nhất) */
export const wsPushVersion = (p: ContentVersion[], v: ContentVersion) => {
  const mine = p.filter((x) => x.contentId === v.contentId).sort((a, b) => b.at - a.at);
  const drop = new Set(mine.slice(CV_MAX - 1).map((x) => x.id));
  return [v, ...p.filter((x) => !drop.has(x.id))];
};

export const wsCleanAi = (s: string) => s.replace(/^```[a-z]*\n?|```$/g, '').replace(/^(đây là|dưới đây là)[^\n]*:\s*\n/i, '').trim().replace(/^"([\s\S]*)"$/, '$1');

export const WS_CSS = `
.ws-prose{outline:none;font-size:16.5px;line-height:1.75;color:rgb(var(--fg));padding-bottom:40vh}
.ws-prose h1{font-size:1.75em;font-weight:700;line-height:1.25;margin:.2em 0 .6em}
.ws-prose p.sapo{font-size:1.05em;color:rgb(var(--fg2))}
.ws-prose h2{font-size:1.45em;font-weight:700;line-height:1.3;margin:1.6em 0 .5em}
.ws-prose h3{font-size:1.18em;font-weight:650;line-height:1.35;margin:1.3em 0 .4em}
.ws-prose p{margin:.65em 0}
.ws-prose ul{list-style:disc;padding-left:1.4em;margin:.6em 0}
.ws-prose ol{list-style:decimal;padding-left:1.4em;margin:.6em 0}
.ws-prose li p{margin:.2em 0}
.ws-prose blockquote{border-left:3px solid rgb(var(--accent));padding-left:1em;color:rgb(var(--fg2));margin:1em 0}
.ws-prose hr{border:none;border-top:1px solid rgb(var(--line));margin:1.6em 0}
.ws-prose img{max-width:100%;height:auto;border-radius:8px;margin:1em 0;display:block}
.ws-prose img.ProseMirror-selectednode{outline:3px solid rgb(var(--accent))}
.ws-prose a{color:rgb(var(--secondary-fg));text-decoration:underline}
.ws-prose .ws-ghost{color:rgb(var(--faint));pointer-events:none}
.ws-prose .ws-weak{box-shadow:-4px 0 0 rgb(var(--accent)/.7);background:rgb(var(--accent)/.06);border-radius:2px}
.ws-prose .ws-hit{background:rgb(var(--secondary)/.12);border-radius:4px;box-shadow:0 0 0 4px rgb(var(--secondary)/.12)}
.ws-prose .ws-empty::before{content:attr(data-placeholder);color:rgb(var(--faint));float:left;height:0;pointer-events:none}
.ws-diff del{background:rgb(var(--danger)/.14);color:rgb(var(--danger-fg));text-decoration:line-through}
.ws-diff ins{background:rgb(var(--success)/.16);color:rgb(var(--success-fg));text-decoration:none}
`;

export const CONTENT_CFG0: ContentVariantCfg = { hidden: [], custom: [], defaults: {}, presets: [] };

export const VARIANT_GROUPS: VariantGroup[] = [
  { id: 'type', kind: 'text', label: 'Dạng bài', multi: false, hint: 'Chọn dạng bài sẽ tích sẵn các nhóm phù hợp', options: [
    { id: 'howto', label: 'Hướng dẫn từng bước', prompt: 'Dạng bài hướng dẫn từng bước: mỗi bước một mục, nói rõ dụng cụ, thao tác và lỗi hay gặp.', implies: { sections: ['s57'], extras: ['bullets', 'tldr'], proof: ['standard', 'specs'], cta: ['survey'], imgScene: ['crew', 'closeup'] } },
    { id: 'compare', label: 'So sánh / chọn mua', prompt: 'Dạng bài so sánh giúp người đọc chọn mua: tiêu chí rõ ràng, ưu nhược điểm khách quan, kết luận nên chọn loại nào cho trường hợp nào.', implies: { extras: ['table', 'faq'], proof: ['specs'], cta: ['quote'], imgScene: ['closeup'], imgStyle: ['studio'] } },
    { id: 'case', label: 'Case study công trình', prompt: 'Dạng case study: bối cảnh công trình, vấn đề, giải pháp đã dùng, kết quả đo được, lời khách hàng.', implies: { proof: ['project', 'beforeafter', 'testimonial'], cta: ['survey'], imgScene: ['site', 'crew'] } },
    { id: 'product', label: 'Giới thiệu sản phẩm', prompt: 'Dạng bài giới thiệu sản phẩm: vấn đề khách gặp, sản phẩm giải quyết thế nào, thông số chính, ứng dụng, cách đặt hàng.', implies: { proof: ['specs'], extras: ['table'], cta: ['quote', 'download'], imgScene: ['closeup'], imgStyle: ['studio'] } },
    { id: 'mistakes', label: 'Sai lầm thường gặp', prompt: 'Dạng bài chỉ ra các sai lầm thường gặp: mỗi sai lầm nêu hậu quả và cách làm đúng.', implies: { extras: ['bullets', 'faq'], depth: ['basic'], cta: ['zalo'] } },
    { id: 'news', label: 'Tin tức / chính sách', prompt: 'Dạng tin tức / thông báo chính sách: thông tin chính ở đoạn đầu, ngày hiệu lực, ai được áp dụng, liên hệ ở đâu.', implies: { length: ['w_short', 'fb_short', 'za_short'], sections: ['s34'], cta: ['zalo', 'hotline'] } },
    { id: 'promo', label: 'Khuyến mãi', prompt: 'Dạng bài khuyến mãi: ưu đãi cụ thể, điều kiện, thời hạn, cách nhận; tạo cảm giác cần hành động sớm nhưng không phóng đại.', implies: { tone: ['sales'], cta: ['zalo', 'hotline'], length: ['w_short', 'fb_short', 'za_short'], imgStyle: ['copyspace'] } },
  ] },
  { id: 'length', kind: 'text', label: 'Độ dài', multi: false, options: [
    { id: 'w_short', label: 'Ngắn 600–800', prompt: 'Độ dài toàn bài 600–800 từ.', words: 700, channels: ['website'] },
    { id: 'w_mid', label: 'Vừa 1.200–1.500', prompt: 'Độ dài toàn bài 1.200–1.500 từ.', words: 1350, channels: ['website'], def: true },
    { id: 'w_long', label: 'Dài 1.800–2.500', prompt: 'Độ dài toàn bài 1.800–2.500 từ, phân tích chuyên sâu.', words: 2100, channels: ['website'] },
    { id: 'fb_short', label: 'Ngắn ≤ 80 từ', prompt: 'Toàn bài tối đa 80 từ: 1 câu hook và lời kêu gọi.', words: 70, channels: ['facebook'] },
    { id: 'fb_mid', label: 'Vừa 120–200', prompt: 'Toàn bài 120–200 từ.', words: 160, channels: ['facebook'], def: true },
    { id: 'fb_long', label: 'Dài 300–500', prompt: 'Toàn bài 300–500 từ, kể chuyện có mở – thân – kết.', words: 400, channels: ['facebook'] },
    { id: 'za_short', label: '≤ 150 từ', prompt: 'Toàn bài tối đa 150 từ.', words: 130, channels: ['zalo'], def: true },
    { id: 'za_mid', label: '150–300 từ', prompt: 'Toàn bài 150–300 từ.', words: 220, channels: ['zalo'] },
    { id: 'gm_short', label: '≤ 750 ký tự', prompt: 'Toàn bài tối đa 750 ký tự.', words: 120, channels: ['google_maps'], def: true },
    { id: 'gm_long', label: '≤ 1.500 ký tự', prompt: 'Toàn bài tối đa 1.500 ký tự.', words: 240, channels: ['google_maps'] },
  ] },
  { id: 'tone', kind: 'text', label: 'Giọng văn', multi: false, options: [
    { id: 'engineer', label: 'Kỹ sư nói với kỹ sư', prompt: 'Giọng kỹ sư nói với kỹ sư: chính xác, dùng thuật ngữ đúng, không quảng cáo lộ liễu.', def: true },
    { id: 'investor', label: 'Tư vấn chủ đầu tư', prompt: 'Giọng tư vấn cho chủ đầu tư: tập trung chi phí vòng đời, rủi ro, độ bền, tiến độ.' },
    { id: 'dealer', label: 'Thân thiện với đại lý', prompt: 'Giọng thân thiện với đại lý: lợi ích kinh doanh, biên lợi nhuận, hỗ trợ bán hàng.' },
    { id: 'sales', label: 'Bán hàng, nhấn ưu đãi', prompt: 'Giọng bán hàng: nêu lợi ích cụ thể, nhấn ưu đãi, câu ngắn, có lời kêu gọi rõ.' },
  ] },
  { id: 'audience', kind: 'text', label: 'Đối tượng đọc', multi: false, options: [
    { id: 'mep', label: 'Nhà thầu M&E', prompt: 'Người đọc là nhà thầu cơ điện (M&E), quan tâm thi công nhanh, đúng tiêu chuẩn, dễ nghiệm thu.', def: true },
    { id: 'designer', label: 'Kỹ sư thiết kế', prompt: 'Người đọc là kỹ sư thiết kế, cần thông số và tiêu chuẩn để đưa vào hồ sơ thiết kế.' },
    { id: 'owner', label: 'Chủ đầu tư', prompt: 'Người đọc là chủ đầu tư, quan tâm hiệu quả đầu tư, độ bền, bảo hành.' },
    { id: 'dealer', label: 'Đại lý / nhà phân phối', prompt: 'Người đọc là đại lý, nhà phân phối vật tư.' },
    { id: 'homeowner', label: 'Chủ nhà / khách lẻ', prompt: 'Người đọc là chủ nhà, khách lẻ không chuyên kỹ thuật: giải thích dễ hiểu, gần gũi.' },
  ] },
  { id: 'proof', kind: 'text', label: 'Chứng cứ cần có', multi: true, options: [
    { id: 'standard', label: 'Dẫn tiêu chuẩn IEC / TCVN', prompt: 'Dẫn tiêu chuẩn liên quan (IEC, TCVN, ASTM…) đúng tên, không bịa số hiệu.' },
    { id: 'specs', label: 'Số liệu kỹ thuật', prompt: 'Có số liệu kỹ thuật cụ thể của sản phẩm (chỉ dùng số liệu được cung cấp hoặc ghi "theo datasheet").' },
    { id: 'table', label: 'Bảng thông số', prompt: 'Có một bảng thông số / so sánh dạng danh sách gạch đầu dòng rõ ràng.' },
    { id: 'project', label: 'Ví dụ công trình', prompt: 'Có ví dụ công trình thực tế (loại công trình, quy mô, khu vực), không nêu tên khách nếu chưa được phép.' },
    { id: 'testimonial', label: 'Ý kiến khách hàng', prompt: 'Có một trích dẫn ngắn ý kiến khách hàng (để trống tên, ghi "[Tên khách]" để biên tập viên điền).' },
    { id: 'beforeafter', label: 'Trước / sau', prompt: 'Mô tả hiện trạng trước và kết quả sau khi dùng giải pháp.' },
  ] },
  { id: 'sections', adv: true, kind: 'text', label: 'Số mục H2', multi: false, options: [
    { id: 'sauto', label: 'Tự động', prompt: '', def: true },
    { id: 's34', label: '3–4 mục', prompt: 'Dàn ý 3–4 mục H2.' },
    { id: 's57', label: '5–7 mục', prompt: 'Dàn ý 5–7 mục H2.' },
    { id: 's810', label: '8–10 mục', prompt: 'Dàn ý 8–10 mục H2.' },
  ] },
  { id: 'extras', adv: true, kind: 'text', label: 'Cấu trúc thêm', multi: true, options: [
    { id: 'faq', label: 'Mục FAQ', prompt: 'Mục cuối là "Câu hỏi thường gặp" gồm 3–5 câu hỏi ngắn người mua hay hỏi.', channels: ['website'], def: true },
    { id: 'table', label: 'Có bảng', prompt: 'Có ít nhất một bảng / danh sách so sánh.' },
    { id: 'bullets', label: 'Gạch đầu dòng', prompt: 'Dùng gạch đầu dòng cho các ý liệt kê.' },
    { id: 'tldr', label: 'Tóm tắt đầu bài', prompt: 'Mở bài bằng 2–3 câu tóm tắt ý chính cho người đọc vội.' },
  ] },
  { id: 'depth', adv: true, kind: 'text', label: 'Mức độ kỹ thuật', multi: false, options: [
    { id: 'basic', label: 'Phổ thông', prompt: 'Mức phổ thông: giải thích thuật ngữ khi dùng lần đầu.' },
    { id: 'pro', label: 'Chuyên ngành', prompt: 'Mức chuyên ngành: dùng thuật ngữ ngành, không giải thích khái niệm cơ bản.', def: true },
    { id: 'deep', label: 'Chuyên sâu', prompt: 'Mức chuyên sâu cho kỹ sư: cơ chế, tính toán, điều kiện áp dụng.' },
  ] },
  { id: 'cta', kind: 'text', label: 'Kết bài / CTA', multi: true, options: [
    { id: 'quote', label: 'Mời báo giá', prompt: 'Kết bài mời gửi yêu cầu báo giá.', def: true },
    { id: 'survey', label: 'Khảo sát miễn phí', prompt: 'Kết bài mời đặt lịch khảo sát công trình miễn phí.' },
    { id: 'zalo', label: 'Nhắn Zalo', prompt: 'Kết bài mời nhắn Zalo OA để được tư vấn.' },
    { id: 'hotline', label: 'Gọi hotline', prompt: 'Kết bài mời gọi hotline.' },
    { id: 'download', label: 'Tải catalogue', prompt: 'Kết bài mời tải catalogue / datasheet.' },
    { id: 'showroom', label: 'Đến showroom', prompt: 'Kết bài mời ghé showroom / kho xem hàng.' },
  ] },
  { id: 'address', adv: true, kind: 'text', label: 'Xưng hô', multi: false, options: [
    { id: 'ban', label: 'Bạn', prompt: 'Xưng hô với người đọc là "bạn".' },
    { id: 'anhchi', label: 'Anh/chị', prompt: 'Xưng hô với người đọc là "anh/chị".', def: true },
    { id: 'quykhach', label: 'Quý khách', prompt: 'Xưng hô với người đọc là "quý khách".' },
    { id: 'quycty', label: 'Quý công ty', prompt: 'Xưng hô với người đọc là "quý công ty".' },
  ] },
  { id: 'kwDensity', adv: true, kind: 'text', label: 'Mật độ từ khóa', multi: false, channels: ['website'], options: [
    { id: 'natural', label: 'Tự nhiên 0,5–1,5%', prompt: 'Từ khóa chính xuất hiện tự nhiên, mật độ 0,5–1,5%.', def: true },
    { id: 'strong', label: 'Nhấn 1,5–2%', prompt: 'Từ khóa chính mật độ 1,5–2%, không nhồi nhét.' },
  ] },
  { id: 'kwPlace', adv: true, kind: 'text', label: 'Vị trí từ khóa', multi: true, channels: ['website'], options: [
    { id: 'first', label: 'Ở câu đầu bài', prompt: 'Từ khóa chính có trong câu đầu tiên của bài.', def: true },
    { id: 'bold', label: 'In đậm lần đầu', prompt: 'In đậm từ khóa chính ở lần xuất hiện đầu tiên.' },
  ] },
  // ---- hình ảnh ----
  { id: 'imgCount', kind: 'image', label: 'Số lượng ảnh', multi: false, options: [
    { id: 'hero', label: '1 ảnh đại diện', prompt: '' },
    { id: 'perh2', label: '1 ảnh mỗi mục H2', prompt: '', def: true },
    { id: 'max3', label: 'Tối đa 3 ảnh', prompt: '' },
    { id: 'none', label: 'Không tạo ảnh', prompt: '' },
  ] },
  { id: 'imgAspect', kind: 'image', label: 'Khung hình', multi: false, options: [
    { id: 'auto', label: 'Theo kênh', prompt: '', def: true },
    { id: 'landscape', label: 'Ngang 16:9', prompt: '' },
    { id: 'square', label: 'Vuông 1:1', prompt: '' },
    { id: 'p45', label: 'Dọc 4:5', prompt: '' },
    { id: 'story', label: 'Dọc 9:16', prompt: '' },
  ] },
  { id: 'imgScene', kind: 'image', label: 'Bối cảnh', multi: true, options: [
    { id: 'site', label: 'Tại công trình', prompt: 'bối cảnh công trình thực tế tại Việt Nam' },
    { id: 'warehouse', label: 'Kho / showroom', prompt: 'trong kho hàng / showroom gọn gàng' },
    { id: 'closeup', label: 'Cận cảnh sản phẩm', prompt: 'cận cảnh sản phẩm, thấy rõ chi tiết' },
    { id: 'crew', label: 'Đội thi công', prompt: 'đội thi công mặc đồ bảo hộ đang thao tác' },
    { id: 'diagram', label: 'Sơ đồ kỹ thuật', prompt: 'sơ đồ / bản vẽ kỹ thuật đơn giản, nền sáng' },
    { id: 'home', label: 'Nhà ở hoàn thiện', prompt: 'không gian nhà ở hoàn thiện, ánh sáng ấm' },
  ] },
  { id: 'imgStyle', kind: 'image', label: 'Phong cách', multi: false, options: [
    { id: 'real', label: 'Ảnh chụp chân thực', prompt: 'ảnh chụp thương mại chân thực, ánh sáng tự nhiên', def: true },
    { id: 'studio', label: 'Studio nền trắng', prompt: 'ảnh studio nền trắng, đổ bóng nhẹ' },
    { id: 'copyspace', label: 'Chừa chỗ chèn chữ', prompt: 'bố cục chừa khoảng trống lớn một bên để chèn chữ làm banner' },
    { id: 'flat', label: 'Minh họa phẳng', prompt: 'minh họa phẳng dạng infographic, nét gọn' },
  ] },
  { id: 'imgColor', kind: 'image', label: 'Màu sắc', multi: false, options: [
    { id: 'brand', label: 'Màu thương hiệu', prompt: 'tông màu xanh navy và cam thương hiệu', def: true },
    { id: 'natural', label: 'Màu tự nhiên', prompt: 'màu sắc tự nhiên' },
    { id: 'light', label: 'Tông sáng', prompt: 'tông sáng, sạch' },
    { id: 'dark', label: 'Tông tối', prompt: 'tông tối sang trọng' },
  ] },
  { id: 'imgStamp', kind: 'image', label: 'Đóng dấu', multi: false, options: [
    { id: 'logo', label: 'Logo doanh nghiệp', prompt: '', def: true },
    { id: 'name', label: 'Tên doanh nghiệp', prompt: '' },
    { id: 'nostamp', label: 'Không đóng', prompt: '' },
  ] },
];

/** Biến thể cấu hình sẵn đọc lúc dựng prompt (cập nhật mỗi lần app render Marketing Hub / bộ xử lý nền) */
export const ST_VARIANT_CACHE: { cfg: ContentVariantCfg } = { cfg: CONTENT_CFG0 };

export const vKey = (g: string) => `v_${g}`;

export const vCfgOf = (c?: Partial<ContentVariantCfg> | null): ContentVariantCfg => ({ ...CONTENT_CFG0, ...(c ?? {}) });

/** Lựa chọn hình ảnh hiệu lực (1 giá trị) */
export const vImg = (s: StSettings, group: string, platform?: string, cfg = ST_VARIANT_CACHE.cfg) => { const g = vGroups(cfg, platform, 'image').find((x) => x.id === group); return g ? vPicked(g, s, cfg)[0] : undefined; };

export const vAspect = (s: StSettings, platform: string | undefined, fallback: 'landscape' | 'square' | 'portrait'): 'landscape' | 'square' | 'portrait' => {
  const a = vImg(s, 'imgAspect', platform);
  return a === 'landscape' ? 'landscape' : a === 'square' ? 'square' : a === 'p45' || a === 'story' ? 'portrait' : fallback;
};

// ---- workspace/review.tsx (v38.4): xem & duyệt nội dung ngay tại chỗ, không phải đi qua 3 bước Studio ----

export const MKT_OPEN_EVT = '3a:mkt-open';

export const MKT_REVIEW_EVT = '3a:content-review';

/** Mở khung "Xem & duyệt" (đặt ở khung app, dùng được từ Trung tâm phê duyệt, Plan, danh sách nội dung) */
export const openContentReview = (id: string) => window.dispatchEvent(new CustomEvent(MKT_REVIEW_EVT, { detail: id }));

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  { id: 'tpl_pr_seo', name: 'Bài PR kỹ thuật chuẩn SEO', desc: 'Chuyên ngành, dẫn tiêu chuẩn, bảng thông số, FAQ, mời báo giá', channels: ['website'],
    values: { type: ['product'], length: ['w_mid'], tone: ['engineer'], audience: ['mep'], proof: ['standard', 'specs', 'table'], cta: ['quote', 'download'], sections: ['s57'], extras: ['faq', 'table', 'tldr'], depth: ['pro'], kwDensity: ['natural'], kwPlace: ['first', 'bold'], imgCount: ['perh2'], imgScene: ['closeup', 'site'], imgStyle: ['real'], imgColor: ['brand'] } },
  { id: 'tpl_howto', name: 'Hướng dẫn thi công', desc: 'Từng bước, dụng cụ, lỗi hay gặp, mời khảo sát', channels: ['website'],
    values: { type: ['howto'], length: ['w_mid'], tone: ['engineer'], audience: ['mep'], proof: ['standard', 'specs'], cta: ['survey', 'zalo'], sections: ['s57'], extras: ['bullets', 'tldr', 'faq'], depth: ['pro'], imgCount: ['perh2'], imgScene: ['crew', 'closeup'], imgStyle: ['real'] } },
  { id: 'tpl_compare', name: 'So sánh / tư vấn chọn mua', desc: 'Tiêu chí rõ ràng, bảng so sánh, kết luận nên chọn gì', channels: ['website'],
    values: { type: ['compare'], length: ['w_long'], tone: ['investor'], audience: ['owner'], proof: ['specs', 'table'], cta: ['quote'], extras: ['table', 'faq'], depth: ['pro'], imgCount: ['max3'], imgScene: ['closeup'], imgStyle: ['studio'] } },
  { id: 'tpl_case_web', name: 'Case study công trình', desc: 'Bối cảnh, vấn đề, giải pháp, kết quả, lời khách', channels: ['website'],
    values: { type: ['case'], length: ['w_mid'], tone: ['investor'], audience: ['owner'], proof: ['project', 'beforeafter', 'testimonial'], cta: ['survey'], depth: ['pro'], imgCount: ['perh2'], imgScene: ['site', 'crew'], imgStyle: ['real'] } },
  { id: 'tpl_fb_promo', name: 'Khuyến mãi Fanpage', desc: 'Ngắn, nhấn ưu đãi, CTA nhắn Zalo / gọi', channels: ['facebook'],
    values: { type: ['promo'], length: ['fb_short'], tone: ['sales'], cta: ['zalo', 'hotline'], address: ['ban'], imgCount: ['hero'], imgAspect: ['square'], imgStyle: ['copyspace'], imgColor: ['brand'] } },
  { id: 'tpl_fb_story', name: 'Kể chuyện công trình', desc: 'Bài Fanpage dài vừa, có trước / sau và ảnh thi công', channels: ['facebook'],
    values: { type: ['case'], length: ['fb_long'], tone: ['investor'], proof: ['project', 'beforeafter'], cta: ['survey'], imgCount: ['max3'], imgAspect: ['p45'], imgScene: ['site', 'crew'] } },
  { id: 'tpl_fb_tip', name: 'Mẹo kỹ thuật nhanh', desc: 'Một mẹo / một sai lầm, dễ chia sẻ', channels: ['facebook'],
    values: { type: ['mistakes'], length: ['fb_mid'], tone: ['engineer'], depth: ['basic'], cta: ['zalo'], imgCount: ['hero'], imgAspect: ['square'], imgScene: ['closeup'] } },
  { id: 'tpl_zalo_news', name: 'Bản tin Zalo OA', desc: 'Thông báo ngắn, rõ ngày hiệu lực, nút nhắn tin', channels: ['zalo'],
    values: { type: ['news'], length: ['za_short'], address: ['anhchi'], cta: ['zalo', 'hotline'], imgCount: ['hero'], imgAspect: ['landscape'] } },
  { id: 'tpl_zalo_promo', name: 'Ưu đãi đại lý (Zalo)', desc: 'Giọng đại lý, ưu đãi + điều kiện + hạn', channels: ['zalo'],
    values: { type: ['promo'], length: ['za_mid'], tone: ['dealer'], audience: ['dealer'], cta: ['zalo'], imgCount: ['hero'], imgStyle: ['copyspace'] } },
  { id: 'tpl_maps', name: 'Bài Google Maps', desc: 'Từ khóa địa phương ở đầu, mời gọi / ghé showroom', channels: ['google_maps'],
    values: { type: ['news'], length: ['gm_short'], cta: ['hotline', 'showroom'], imgCount: ['hero'], imgAspect: ['landscape'], imgScene: ['warehouse'] } },
];

export const IMG_SIZES = [
  { id: 'fb', label: 'Bài Facebook', w: 1200, h: 630 }, { id: 'sq', label: 'Vuông (Facebook, Instagram)', w: 1080, h: 1080 },
  { id: 'p45', label: 'Dọc 4:5 (Facebook)', w: 1080, h: 1350 }, { id: 'story', label: 'Story / Reels 9:16', w: 1080, h: 1920 },
  { id: 'zalo', label: 'Ảnh bìa Zalo OA', w: 1280, h: 720 }, { id: 'blog', label: 'Ảnh bài website', w: 1200, h: 800 },
  { id: 'web', label: 'Banner website', w: 1920, h: 600 }, { id: 'product', label: 'Ảnh sản phẩm', w: 1000, h: 1000 },
  { id: 'gmaps', label: 'Google Maps', w: 1200, h: 900 }, { id: 'custom', label: 'Tùy chỉnh', w: 0, h: 0 },
] as const;

export const MKT_IMG_MAX = 200;

export const dataKb = (u: string) => Math.round(((u.length - u.indexOf(',') - 1) * 3) / 4 / 1024);

export const downloadData = (url: string, name: string) => { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };

/** Các mục menu xuất nội dung dùng chung */
export const contentExportItems = (c: MktContent, ex: ReturnType<typeof useContentExport>): MenuItem[] => [
  { label: 'Tải Word (.doc)', icon: FileText, onClick: () => ex(c, 'word') },
  { label: 'Tải PDF (in / lưu PDF)', icon: Download, onClick: () => ex(c, 'pdf') },
  { label: 'Tải HTML', icon: Download, onClick: () => ex(c, 'html') },
  { label: 'Sao chép nội dung', icon: Copy, onClick: () => ex(c, 'copy') },
];

/** Bản sao nháp của nội dung (không mang việc AI, nhiệm vụ, duyệt) */
export const cloneContent = (c: MktContent, by?: string): MktContent => ({
  ...c, id: uid('ct'), title: `${c.title} (bản sao)`, status: 'DRAFT', aiJob: undefined, taskId: undefined, submittedBy: undefined, submittedAt: undefined,
  reviewNote: undefined, approvedBy: undefined, approvedAt: undefined, ownerId: by ?? c.ownerId, updatedAt: Date.now(),
  settings: c.settings ? { ...c.settings, slug: c.settings.slug ? `${stStr(c.settings.slug)}-ban-sao` : c.settings.slug } : c.settings,
});

export const contentBusy = (c: MktContent) => c.aiJob?.status === 'QUEUED' || c.aiJob?.status === 'RUNNING';

/**
 * v36 — Copilot giao tiếp tự nhiên.
 * Lượt xã giao (chào, cảm ơn, hỏi "bạn là ai"…) không chạy bộ phân tích, không gửi số liệu, trả lời 1–2 câu.
 */
/** v37: nhớ trong phiên khi máy chủ chưa có route /api/chat để không gọi lại */
export const COPILOT_ROUTE = { missing: false };

export const SMALLTALK_RE = /^(xin chao|chao|hi|hello|hey|alo|cam on|thank|ok|oke|okay|vang|da|u|uh|tot|hay|tuyet|bye|tam biet|hen gap lai|chuc|ban oi|em oi|copilot oi|ban (la ai|ten gi|lam duoc gi|giup duoc gi|co the lam gi|co khoe khong))\b/;

export const BUSINESS_RE = /(sla|mdf|quy|doanh|cong no|du an|lead|claim|bao gia|khach|don hang|dong tien|ngan sach|tom tat|bao cao|thuong|dai ly|ton kho|kpi|chi phi|loi nhuan)/;

/** Phong cách trả lời gửi kèm system prompt (useAi đã thêm: tiếng Việt, không bịa số liệu) */
export const copilotStyle = (who: string) => `Bạn đang trò chuyện trong khung AI Copilot với ${who}.
Cách giao tiếp:
- Tự nhiên như một đồng nghiệp nắm số liệu: xưng "mình", gọi người dùng là "anh/chị". Không tự giới thiệu lại ở mỗi lượt.
- Độ dài tương xứng câu hỏi. Lời chào, cảm ơn, xã giao: 1–2 câu, không đưa số liệu, không liệt kê tính năng.
- Câu hỏi về số liệu: câu đầu trả lời thẳng (con số, kết luận); sau đó tối đa 4 gạch đầu dòng nếu thật cần. Không nhắc lại toàn bộ tổng quan.
- Câu hỏi mơ hồ: hỏi lại một câu ngắn thay vì đoán.
- Chỉ dùng số liệu trong "Dữ liệu CRM" và "Kết quả tính sẵn"; thiếu thì nói chưa có dữ liệu.
- Không kết thúc mọi câu trả lời bằng lời mời "Anh/chị muốn bắt đầu với việc gì?"; chỉ gợi ý bước tiếp khi thật hữu ích.
- Định dạng: Markdown nhẹ (**đậm**, gạch đầu dòng "- " mỗi ý một dòng). Không dùng bảng, tiêu đề, emoji.`;

/** Hiển thị Markdown nhẹ từ AI (đậm, gạch đầu dòng, danh sách số, xuống dòng) — không dùng HTML thô */
export const mdInline = (s: string): ReactNode[] => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((x, i) =>
  x.length > 4 && x.startsWith('**') && x.endsWith('**') ? <b key={i} className="font-semibold text-[rgb(var(--fg))]">{x.slice(2, -2)}</b>
    : x.length > 2 && x.startsWith('`') && x.endsWith('`') ? <code key={i} className="rounded bg-[rgb(var(--ink)/0.06)] px-1 text-[0.92em]">{x.slice(1, -1)}</code>
      : <Fragment key={i}>{x}</Fragment>);

/** Bỏ Markdown khi đăng vào kênh chat (khung chat hiển thị chữ thường) */
export const plainMd = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^\s*\*\s+/gm, '- ');

export const AI_STARTERS = ['Bản tin điều hành hôm nay', 'Dự báo dòng tiền quỹ MDF', 'Thưởng tăng trưởng đại lý năm nay', 'Tóm tắt việc cần làm hôm nay', 'Dự án nào có rủi ro trễ SLA?', 'Dự báo dòng tiền 3 tháng tới', 'Gợi ý chương trình kích cầu quỹ MDF', 'Khách nào sắp vượt hạn mức công nợ?'];

export const threadKey = (t: { entity: string; entityId: string }) => `${t.entity}:${t.entityId}`;

// =====================================================================
//  TIN NHẮN TOÀN MÀN HÌNH (Messenger kiểu Zalo / Slack)
//  Kênh chung + nhóm dự án / phòng ban + tin nhắn trực tiếp + kênh theo bản ghi; gửi file; tìm lịch sử
// =====================================================================

export const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export const dmId = (a: string, b: string) => `dm:${[a, b].sort().join(':')}`;

/** Giới hạn mỗi file: chạy máy chủ thì file đưa lên Storage; chạy trong trình duyệt bị giới hạn dung lượng lưu trữ */
export const chatFileMax = () => (CLOUD_ON ? 25 * 1048576 : 2 * 1048576);

export const isTextFile = (f: ChatFile) => /^text\/|json|csv|xml|markdown/.test(f.type) || /\.(txt|csv|md|json|log|xml)$/i.test(f.name);

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '✅'];

// =====================================================================
//  BÀN LÀM VIỆC — bảng tin nội bộ (thông báo, tin tức, sáng kiến, bình chọn) + hoạt động kinh doanh + widget
// =====================================================================
export const POST_KIND: Record<PostKind, { label: string; tone: Tone; icon: typeof Wallet }> = {
  POST: { label: 'Chia sẻ', tone: 'muted', icon: Newspaper },
  ANNOUNCE: { label: 'Thông báo', tone: 'orange', icon: Megaphone },
  IDEA: { label: 'Sáng kiến', tone: 'teal', icon: Lightbulb },
  POLL: { label: 'Bình chọn', tone: 'blue', icon: Vote },
};

/** "Tóm tắt bài viết": rút câu đầu + câu có số liệu (chạy trong trình duyệt) */
export const summarizeText = (t: string) => {
  const ss = t.replace(/\s+/g, ' ').split(/(?<=[.!?…])\s+/).filter((x) => x.length > 8);
  if (ss.length <= 2) return t;
  const pick = [ss[0], ...ss.slice(1).filter((x) => /\d/.test(x)).slice(0, 2)];
  return pick.join(' ');
};

export const agoText = (at: number) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'vừa xong' : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : new Date(at).toLocaleDateString('vi-VN'); };

export const FEELINGS: PostFeeling[] = [
  { emoji: '😊', label: 'vui vẻ', verb: 'feel' }, { emoji: '😄', label: 'hạnh phúc', verb: 'feel' }, { emoji: '😎', label: 'tuyệt', verb: 'feel' },
  { emoji: '🤩', label: 'hào hứng', verb: 'feel' }, { emoji: '🙏', label: 'biết ơn', verb: 'feel' }, { emoji: '💪', label: 'tự hào', verb: 'feel' },
  { emoji: '🥰', label: 'được yêu thương', verb: 'feel' }, { emoji: '😌', label: 'thư giãn', verb: 'feel' }, { emoji: '🔥', label: 'quyết tâm', verb: 'feel' },
  { emoji: '😴', label: 'mệt mỏi', verb: 'feel' }, { emoji: '🤔', label: 'suy tư', verb: 'feel' }, { emoji: '😢', label: 'buồn', verb: 'feel' },
  { emoji: '🎉', label: 'ăn mừng', verb: 'act' }, { emoji: '💼', label: 'làm việc', verb: 'act' }, { emoji: '🏗️', label: 'đi công trình', verb: 'act' },
  { emoji: '🤝', label: 'gặp khách hàng', verb: 'act' }, { emoji: '📋', label: 'họp', verb: 'act' }, { emoji: '✈️', label: 'đi công tác', verb: 'act' },
  { emoji: '🎓', label: 'học hỏi', verb: 'act' }, { emoji: '🍽️', label: 'ăn trưa cùng team', verb: 'act' }, { emoji: '🏆', label: 'nhận giải', verb: 'act' },
];

export const REACTS = [
  { id: 'like', emoji: '👍', label: 'Thích', color: '#1877F2' }, { id: 'love', emoji: '❤️', label: 'Yêu thích', color: '#F33E58' },
  { id: 'care', emoji: '🥰', label: 'Thương thương', color: '#F7B125' }, { id: 'haha', emoji: '😆', label: 'Haha', color: '#F7B125' },
  { id: 'wow', emoji: '😮', label: 'Wow', color: '#F7B125' }, { id: 'sad', emoji: '😢', label: 'Buồn', color: '#F7B125' },
] as const;

export const HOME_FOCUS_EVT = '3a:home-focus-post';

export const FB_ICON = { photo: '#45BD62', feel: '#F7B928', tag: '#1877F2', place: '#F5533D', poll: '#F57C1F', file: '#8A8D91' };

export const isMedia = (f: ChatFile) => f.type.startsWith('image/') || f.type.startsWith('video/');

export const reactOf = (p: Post, uid: string): ReactId | null => (p.likes.includes(uid) ? 'like' : ((Object.entries(p.reacts ?? {}).find(([, ids]) => ids.includes(uid))?.[0] as ReactId | undefined) ?? null));

export const reactTotal = (p: Post) => p.likes.length + Object.values(p.reacts ?? {}).reduce((a, ids) => a + ids.length, 0);

export const withReact = (p: Post, uid: string, r: ReactId | null): Post => {
  const reacts = Object.fromEntries(Object.entries(p.reacts ?? {}).map(([k, ids]) => [k, ids.filter((x) => x !== uid)]).filter(([, ids]) => ids.length));
  const likes = p.likes.filter((x) => x !== uid);
  if (r === 'like') likes.push(uid); else if (r) reacts[r] = [...(reacts[r] ?? []), uid];
  return { ...p, likes, reacts: Object.keys(reacts).length ? reacts : undefined };
};

export const firstName = (n: string) => n.trim().split(/\s+/).pop() ?? n;

/** Ghi nhận lượt xem khi bài hiện ≥ 50% trên màn hình 1 giây (mỗi người tính 1 lần, không tính tác giả) */
export const seenThisSession = new Set<string>();

export const SOCIAL0: SocialCfg = { title: '', facebookUrl: '', facebookPageId: '', zaloOaUrl: '', youtubeUrl: '', youtubeChannelId: '' };

export const SOCIAL_TAB: Record<SocialChannel, { label: string; icon: typeof Wallet; api: string }> = {
  FACEBOOK: { label: 'Fanpage', icon: ThumbsUp, api: 'facebook' },
  ZALO: { label: 'Zalo OA', icon: MessageCircle, api: 'zalo' },
  YOUTUBE: { label: 'YouTube', icon: SquarePlay, api: 'youtube' },
};

export const ytIdOf = (url: string) => url.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/)?.[1];

export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const safeUrl = (u: string) => (/^https?:\/\//i.test(u.trim()) ? u.trim() : '');

export const socialCache = new Map<string, { at: number; items: SocialItem[]; error?: string }>();

export const SOCIAL_ERR: Record<string, string> = { facebook_not_configured: 'Máy chủ chưa có FACEBOOK_PAGE_ACCESS_TOKEN', zalo_not_configured: 'Máy chủ chưa kết nối Zalo OA', ref_invalid: 'Mã kênh chưa đúng định dạng', upstream: 'Kênh không phản hồi, thử lại sau' };

export const contactKey = (org: string, user: string) => `3a:contacts:${org}:${user}`;

export const downloadText = (name: string, text: string, type = 'text/plain') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };

export const vcard = (c: ContactItem) => ['BEGIN:VCARD', 'VERSION:3.0', `FN:${c.name}`, `ORG:${c.org}`, c.title && `TITLE:${c.title}`, c.phone && `TEL;TYPE=CELL:${c.phone.replace(/\s/g, '')}`, c.email && `EMAIL:${c.email}`, 'END:VCARD'].filter(Boolean).join('\r\n');

export const KPI_CFG_DEFAULT: KpiCfg = { winRatePct: 30, cycleDays: 30, coverage: 3, cplMax: 500_000 };

export const kpiId = (scope: KpiTarget['scope'], refId: string, month: string) => `${scope}:${refId}:${month}`;

export const kpiMonthKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export const daysInMonth = (key: string) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };

export const inScope = (s: DashScope, dept?: DeptCode, owner?: string) => (s.userId ? owner === s.userId : s.dept === 'ALL' || dept === s.dept);

/** Tách "4,82 tỷ" thành số + đơn vị để hiển thị số lớn, đơn vị nhỏ */
export const splitUnit = (s: string) => { const i = s.lastIndexOf(' '); return i > 0 ? [s.slice(0, i), s.slice(i + 1)] as const : [s, ''] as const; };

export const deltaPct = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

export const ST_OK: KpiStatus = { label: 'Đạt', tone: 'teal' }, ST_WATCH: KpiStatus = { label: 'Theo dõi', tone: 'orange' }, ST_SLOW: KpiStatus = { label: 'Chậm', tone: 'red' }, ST_NONE: KpiStatus = { label: 'Chưa có chỉ tiêu', tone: 'muted' };

/** Đánh giá theo tiến độ kỳ: đạt nếu đi kịp % thời gian đã qua */
export const paceStatus = (actual: number, target: number, elapsed: number): KpiStatus => (!target ? ST_NONE : actual / target >= elapsed * 0.98 ? ST_OK : actual / target >= elapsed * 0.85 ? ST_WATCH : ST_SLOW);

export const TONE_RGB: Record<KpiStatus['tone'], string> = { teal: 'var(--success)', orange: 'var(--accent)', red: 'var(--danger)', muted: 'var(--line)' };

export const salesFunnel = (ls: Lead[]) => {
  const st = (xs: LeadStatus[]) => ls.filter((l) => xs.includes(l.status)).length;
  return [
    { label: 'Tiếp nhận', n: ls.length },
    { label: 'Phân bổ', n: st(['ROUTED', 'ASSIGNED', 'ACCEPTED', 'QUOTED', 'WON']) + ls.filter((l) => l.status === 'LOST' && (l.dept || l.assignee)).length },
    { label: 'Nhận việc', n: st(['ACCEPTED', 'QUOTED', 'WON']) },
    { label: 'Báo giá', n: st(['QUOTED', 'WON']) },
    { label: 'Chốt', n: st(['WON']) },
  ];
};

/** Kênh marketing của một lead (theo nguồn) */
export const channelOfSource = (src: Source): MktChannel | 'OTHER' => (Object.keys(MKT_CH) as MktChannel[]).find((ch) => MKT_CH[ch].sources.includes(src)) ?? 'OTHER';

export const overdueCls = 'shadow-[inset_3px_0_0_rgb(var(--danger))]';

export const EMPTY_CUSTOMER: CustomerForm = {
  name: '', taxCode: '', segment: 'OTHER', tier: 'NEW', region: 'SOUTH', dept: 'FACTORY_SALES', amId: undefined, sourceId: 'SELF', status: 'PROSPECT', createdAt: '',
  contactName: '', contactTitle: '', contactPhone: '', contactEmail: '', address: '',
  creditLimit: 0, debt: 0, ytdRevenue: 0, lastYearRevenue: 0,
};

export const REVENUE_BAND: Record<RevenueBand, { label: string; test: (n: number) => boolean }> = {
  ALL: { label: 'Mọi mức doanh số', test: () => true },
  GT1B: { label: 'Trên 1 tỷ', test: (n) => n > 1e9 },
  '500M_1B': { label: '500 triệu – 1 tỷ', test: (n) => n >= 500e6 && n <= 1e9 },
  '200M_500M': { label: '200 – 500 triệu', test: (n) => n >= 200e6 && n < 500e6 },
  LT200M: { label: 'Dưới 200 triệu', test: (n) => n < 200e6 },
};

export const STAGES: Stage[] = ['ACCEPTED', 'QUOTED', 'WON', 'LOST'];

export const stageLabel = (s: LeadStatus) => LEAD_STATUS[s].label;

/** Ngày gửi báo giá gần nhất của dự án */
export const lastQuoteOf = (leadId: string, quotes: Quote[]) => quotes.filter((q) => q.leadId === leadId).sort((a, b) => b.version - a.version)[0];

export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);

// =====================================================================
//  DANH MỤC SẢN PHẨM (Master SKU Catalog)
// =====================================================================

/** Thu nhỏ ảnh sản phẩm về cạnh dài 240px (JPEG) để lưu gọn trong dữ liệu */
export const shrinkImage = (file: File, max = 240) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82)); }; img.onerror = () => rej(new Error('Ảnh không hợp lệ')); img.src = String(r.result); };
  r.onerror = () => rej(new Error('Không đọc được ảnh')); r.readAsDataURL(file);
});

export const stockLevel = (qty: number, s: SkuItem): StockLevel => (qty <= 0 ? 'OUT' : qty < s.minStock ? 'LOW' : s.minStock > 0 && qty <= Math.ceil(s.minStock * 1.2) ? 'NEAR' : s.maxStock && qty > s.maxStock ? 'HIGH' : 'OK');

export const STOCK_LEVEL: Record<StockLevel, { label: string; tone: Tone; dot: string }> = {
  OUT: { label: 'Hết hàng', tone: 'red', dot: 'bg-[rgb(var(--danger))]' },
  OK: { label: 'Trong định mức', tone: 'teal', dot: 'bg-[rgb(var(--success))]' },
  NEAR: { label: 'Sắp chạm Min', tone: 'orange', dot: 'bg-[rgb(var(--warn))]' },
  LOW: { label: 'Dưới Min', tone: 'red', dot: 'bg-[rgb(var(--danger))]' },
  HIGH: { label: 'Vượt Max', tone: 'blue', dot: 'bg-[rgb(var(--secondary))]' },
};

/** Cột file Excel mẫu nhập danh mục sản phẩm (thứ tự cố định) */
export const SKU_IMPORT_COLS = ['SKU', 'Tên sản phẩm', 'Giá bán lẻ', 'Giá đại lý', 'Giá dự án', 'Tồn đầu kỳ', 'Mã kho', 'Lead-time', 'Đơn vị tính', 'Thương hiệu', 'Phân loại', 'Giá vốn', 'Min', 'Max', 'VAT (%)', 'Nhà cung cấp', 'Xuất xứ'] as const;

export const SKU_RE = /^[A-Z0-9][A-Z0-9._-]{2,39}$/;

export const fmtN = (n: number) => n.toLocaleString('vi-VN');

export const SKU_FILTER0: SkuFilter = { q: '', brand: '', cat: '', level: '', wh: '', supplier: '', origin: '', unit: '', priceMin: 0, priceMax: 0, leadMax: 0, hasDocs: false, hasImage: false, onOrder: false };

// =====================================================================
//  KHO HÀNG (VASSH) — tồn kho đa kho, phiếu nhập / xuất / chuyển / kiểm kho có duyệt, thẻ kho, xuất nhập tồn
// =====================================================================
export const VOUCHER_META: Record<VoucherType, { label: string; prefix: string; done: string; icon: typeof Wallet; reasons: string[] }> = {
  IN: { label: 'Phiếu nhập kho', prefix: 'NK', done: 'Đã nhập', icon: PackagePlus, reasons: ['Mua hàng (PO Hãng)', 'Khách trả hàng', 'Nhập điều chỉnh', 'Nhập khác'] },
  OUT: { label: 'Phiếu xuất kho', prefix: 'XK', done: 'Đã xuất', icon: PackageMinus, reasons: ['Xuất bán', 'Xuất dự án', 'Trả hàng nhà cung cấp', 'Xuất hủy / hao hụt', 'Xuất khác'] },
  TRANSFER: { label: 'Phiếu chuyển kho', prefix: 'CK', done: 'Đã chuyển', icon: ArrowLeftRight, reasons: ['Điều chuyển nội bộ', 'Cấp hàng dự án', 'Gom hàng về kho tổng'] },
  COUNT: { label: 'Phiếu kiểm kho', prefix: 'KK', done: 'Đã cân đối', icon: ClipboardList, reasons: ['Kiểm kê định kỳ', 'Kiểm kê đột xuất'] },
};

export const V_STATUS: Record<VoucherStatus, { label: string; tone: Tone }> = { PENDING: { label: 'Chờ duyệt', tone: 'orange' }, DONE: { label: 'Hoàn tất', tone: 'teal' }, CANCELLED: { label: 'Đã hủy', tone: 'muted' } };

export const vStatusLabel = (v: StockVoucher) => (v.status === 'DONE' ? VOUCHER_META[v.type].done : V_STATUS[v.status].label);

export const nextVoucherCode = (type: VoucherType, all: StockVoucher[]) => {
  const p = VOUCHER_META[type].prefix;
  const n = all.filter((v) => v.code.startsWith(p)).reduce((m, v) => Math.max(m, Number(v.code.slice(p.length)) || 0), 0);
  return `${p}${String(n + 1).padStart(6, '0')}`;
};

/** Cộng / trừ tồn tự do của một SKU tại một kho (kho tổng gánh phần chênh lệch tổng) */
export const addWh = (s: SkuItem, wh: string, d: number, main: string): SkuItem => {
  if (wh === main) return { ...s, stock: s.stock + d };
  const m = { ...(s.whStock ?? {}) }; m[wh] = (m[wh] ?? 0) + d; if (!m[wh]) delete m[wh];
  return { ...s, stock: s.stock + d, whStock: m };
};

/** Ảnh hưởng của một bút toán tới tồn THỰC TẾ (tự do + giữ chỗ) tại một kho; hàng giữ chỗ coi như ở kho tổng */
export const moveEffect = (m: StockMove, wh: string | 'ALL', main: string) => {
  const at = (w?: string) => (wh === 'ALL' ? true : (w ?? main) === wh);
  switch (m.type) {
    case 'RECEIVE_FREE': case 'ADJUST': return at(m.toWh) ? m.qty : 0;
    case 'RECEIVE_RESERVED': return at(main) ? m.qty : 0;
    case 'DELIVER': return at(main) ? -m.qty : 0;
    case 'ISSUE': return at(m.fromWh) ? -m.qty : 0;
    case 'WH_TRANSFER': return wh === 'ALL' ? 0 : (m.toWh === wh ? m.qty : 0) - ((m.fromWh ?? main) === wh ? m.qty : 0);
    default: return 0;
  }
};

// =====================================================================
//  BỘ SINH TỰ ĐỘNG BÁO GIÁ & HỢP ĐỒNG THEO MẪU (Document Template Engine)
//  Soạn trên app -> chọn cặp mẫu -> ghép biến (có điều kiện) -> xem trước & xuất
// =====================================================================

/** Biến hỗ trợ trong mẫu. Khối điều kiện: {{#if advance}}...{{/if}} (không lồng nhau) */
export const TEMPLATE_VARS: [string, string][] = [
  ['company_branches', 'Văn phòng / chi nhánh (đánh dấu in trên báo giá)'],
  ['doc_code', 'Số báo giá'],
  ['contract_code', 'Số hợp đồng'],
  ['doc_date', 'Ngày lập (dd/mm/yyyy)'],
  ['doc_date_long', 'Ngày lập dạng chữ: ngày 29 tháng 07 năm 2026'],
  ['doc_revision', 'Lần báo giá (1, 2, 3…)'],
  ['valid_until', 'Báo giá hiệu lực đến'],
  ['company_name', 'Tên pháp lý công ty bán'],
  ['company_tax_code', 'MST công ty bán'],
  ['company_address', 'Địa chỉ công ty bán'],
  ['company_phone', 'Điện thoại công ty bán'],
  ['company_rep', 'Người đại diện công ty bán'],
  ['company_rep_title', 'Chức vụ người đại diện'],
  ['company_bank', 'Số tài khoản, ngân hàng'],
  ['company_logo', 'Logo (ảnh)'],
  ['company_stamp', 'Mộc / chữ ký (ảnh)'],
  ['customer_name', 'Tên khách hàng (Bên mua)'],
  ['tax_code', 'MST khách hàng'],
  ['customer_address', 'Địa chỉ khách hàng'],
  ['customer_rep', 'Người đại diện khách hàng'],
  ['customer_rep_title', 'Chức vụ đại diện khách hàng'],
  ['customer_phone', 'Điện thoại khách hàng'],
  ['customer_email', 'Email khách hàng'],
  ['project_name', 'Tên dự án / nhu cầu'],
  ['project_code', 'Mã dự án'],
  ['items_table', 'Bảng hàng hóa (SKU, SL, đơn giá, thành tiền, VAT, tổng)'],
  ['items_table_full', 'Bảng hàng hóa đầy đủ: STT, mã hàng, hạng mục, hãng SX, đơn vị, SL, đơn giá, VAT, thành tiền, ghi chú'],
  ['subtotal', 'Cộng tiền hàng trước VAT'],
  ['vat_rate', 'Thuế suất VAT'],
  ['vat_amount', 'Tiền thuế VAT'],
  ['grand_total', 'Tổng cộng sau VAT'],
  ['grand_total_words', 'Tổng cộng bằng chữ'],
  ['delivery_terms', 'Tiến độ / địa điểm giao hàng'],
  ['advance_percent', 'Tỷ lệ tạm ứng'],
  ['advance_amount', 'Số tiền tạm ứng'],
  ['guarantee_terms', 'Nội dung bảo lãnh'],
  ['warranty_months', 'Thời hạn bảo hành (tháng)'],
  ['credit_days', 'Số ngày công nợ'],
  ['payment_method', 'Hình thức thanh toán'],
  ['note', 'Ghi chú thêm'],
  ['sales_name', 'Nhân viên phụ trách'],
  ['sales_phone', 'Điện thoại nhân viên phụ trách'],
  ['sales_email', 'Email nhân viên phụ trách'],
];

export const TEMPLATE_FLAGS: [string, string][] = [
  ['advance', 'Có tạm ứng'],
  ['credit', 'Có công nợ (số ngày > 0)'],
  ['no_credit', 'Thanh toán ngay, không công nợ'],
  ['guarantee', 'Có bảo lãnh'],
  ['warranty', 'Có bảo hành'],
  ['project', 'Có gắn dự án'],
  ['note', 'Có ghi chú'],
];

export const RAW_VARS = new Set(['items_table', 'items_table_full', 'company_stamp', 'company_logo']);

export const TX_CLAUSE: Record<TxType, { quote: string; contract: string }> = {
  DEALER: {
    quote: 'Giá đại lý áp dụng cho đơn hàng theo chính sách phân phối hiện hành; chiết khấu thưởng doanh số tính theo quý.',
    contract: 'Bên A được phân phối hàng hóa của Bên B tại khu vực đã thống nhất, cam kết trưng bày sản phẩm, tuân thủ giá bán khuyến nghị và không bán ra ngoài khu vực khi chưa có sự đồng ý của Bên B.',
  },
  PROJECT_ME: {
    quote: 'Đơn giá theo khối lượng BOQ của dự án; hàng hóa có đầy đủ CO, CQ khi giao.',
    contract: 'Hàng hóa được giao theo tiến độ thi công dự án và nghiệm thu theo khối lượng thực tế đối chiếu BOQ. Bên B cung cấp CO, CQ, catalogue và hỗ trợ kỹ thuật tại công trường khi Bên A yêu cầu.',
  },
  SUPPLY_INSTALL: {
    quote: 'Giá đã bao gồm vật tư, nhân công lắp đặt, thử nghiệm và nghiệm thu bàn giao.',
    contract: 'Phạm vi công việc gồm cung cấp vật tư, lắp đặt, thử nghiệm và nghiệm thu bàn giao. Bên B chịu trách nhiệm về an toàn lao động trong phạm vi thi công của mình.',
  },
  RETAIL_CASH: {
    quote: 'Thanh toán 100% khi nhận hàng. Đổi trả trong 7 ngày nếu hàng lỗi do nhà sản xuất.',
    contract: 'Bên A thanh toán toàn bộ giá trị khi nhận hàng. Hàng lỗi do nhà sản xuất được đổi mới trong 7 ngày kể từ ngày giao, còn nguyên bao bì.',
  },
  FACTORY: {
    quote: 'Giá giao tại kho nhà máy Bên mua; Bên bán hỗ trợ hướng dẫn sử dụng sản phẩm.',
    contract: 'Bên B giao hàng tại kho nhà máy Bên A và hướng dẫn sử dụng, bảo quản sản phẩm cho nhân sự kỹ thuật của Bên A.',
  },
  EPC_SUB: {
    quote: 'Tiến độ và điều kiện thanh toán theo nguyên tắc tương ứng với hợp đồng chính của Tổng thầu.',
    contract: 'Bên B cung cấp hàng hóa với tư cách nhà cung cấp cho Tổng thầu; tiến độ giao hàng, hồ sơ chất lượng và nghiệm thu tuân thủ yêu cầu của hợp đồng chính giữa Bên A và Chủ đầu tư mà Bên A đã thông báo bằng văn bản.',
  },
  FRAMEWORK: {
    quote: 'Bảng giá áp dụng cho các đơn đặt hàng trong thời hạn hợp đồng nguyên tắc.',
    contract: 'Hợp đồng này là hợp đồng nguyên tắc có hiệu lực 12 tháng. Mỗi lần mua hàng, Bên A gửi đơn đặt hàng; đơn đặt hàng được Bên B xác nhận là phụ lục không tách rời của hợp đồng.',
  },
  SAMPLE: {
    quote: 'Hàng mẫu phục vụ thử nghiệm thực tế; kết quả thử nghiệm được hai bên ghi nhận bằng biên bản.',
    contract: 'Hàng hóa là mẫu thử nghiệm. Hai bên phối hợp đánh giá kết quả trong thời gian thử nghiệm đã thống nhất và lập biên bản ghi nhận.',
  },
  SERVICE: {
    quote: 'Đơn giá dịch vụ theo từng lần bảo trì; vật tư thay thế báo giá riêng khi phát sinh.',
    contract: 'Bên B thực hiện bảo trì định kỳ theo lịch đã thống nhất, lập biên bản sau mỗi lần thực hiện. Vật tư thay thế phát sinh được báo giá và Bên A xác nhận trước khi thực hiện.',
  },
  TRADING: {
    quote: 'Giá bán buôn giao tại kho Bên bán; Bên mua tự tổ chức vận chuyển.',
    contract: 'Bên A mua hàng để kinh doanh thương mại, tự chịu trách nhiệm về hoạt động phân phối tiếp theo và cam kết không sử dụng thương hiệu của Bên B khi chưa được chấp thuận.',
  },
};

// ---------------- Đọc số tiền bằng chữ tiếng Việt ----------------

export const VN_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

// ---------------- Ghép biến ----------------

export const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} đ`;

export const tierPrice = (k: SkuItem | undefined, tier: PriceTier) => (!k ? 0 : tier === 'DEALER' ? k.dealerPrice || k.basePrice : tier === 'PROJECT' ? k.projectPrice || k.basePrice : k.basePrice);

/** v45: thuế suất của dòng (VAT theo dòng khi vatMode = LINE) */
export const lineVat = (f: ComposerForm, l: DocLine) => (f.vatMode === 'LINE' && l.vat !== undefined ? l.vat : f.vatPct);

/** Ghép biến: khối {{#if}} trước, sau đó {{biến}}; tiêu đề h3.art tự đánh số "Điều N." */
/** Biến bắt buộc của bên bán / bên mua: để trống thì hiện ô vàng có tên trường (không in ra khoảng trống "MST:") */
export const REQUIRED_VARS = new Set(['company_name', 'company_tax_code', 'company_address', 'company_phone', 'company_rep', 'company_bank', 'customer_name', 'tax_code', 'customer_address']);

export const varLabel = (k: string) => TEMPLATE_VARS.find(([v]) => v === k)?.[1] ?? k;

/** Thông tin pháp lý công ty bán còn thiếu (dùng cho cảnh báo trong khung soạn báo giá / hợp đồng) */
export const missingCompanyInfo = (c: CompanyInfo) => ([['taxCode', 'MST'], ['address', 'địa chỉ'], ['phone', 'điện thoại'], ['representative', 'người đại diện'], ['bankAccount', 'tài khoản ngân hàng']] as const).filter(([k]) => !String(c[k] ?? '').trim()).map(([, l]) => l);

export const DOC_CSS = `@page{size:A4;margin:18mm 16mm}
body{font-family:'Times New Roman',Times,serif;font-size:13pt;color:#111;line-height:1.45;margin:0;padding:16px 8px;background:#cfd3da}
.page{box-sizing:border-box;width:210mm;max-width:100%;min-height:297mm;margin:0 auto;padding:18mm 16mm;background:#fff;box-shadow:0 4px 18px rgba(0,0,0,.28);position:relative;z-index:0;--pl:16mm;--pt:18mm}
img[data-float]{position:absolute;height:auto;max-width:none}
h1{font-size:17pt;text-align:center;margin:18px 0 4px}h3{font-size:13pt;margin:14px 0 4px}
p{margin:6px 0}ul{margin:4px 0;padding-left:22px}
table.items{width:100%;border-collapse:collapse;font-size:11.5pt;margin:8px 0}
table.items th,table.items td{border:1px solid #333;padding:4px 6px}table.items th{background:#f1f1f1}
table.items-full{font-size:10pt}table.items-full th{background:#FFFF00;font-size:9pt}table.items-full tr.total td{background:#FFFF00}
table.layout{width:100%;border-collapse:collapse}table.layout td{vertical-align:top;padding:0}
.sign td{text-align:center;width:50%;padding-top:16px}
.r{text-align:right}.c{text-align:center}.small{font-size:10.5pt;color:#444}
.missing{background:#fde68a;color:#92400e;padding:0 2px}
@media (max-width:820px){.page{padding:10mm 8mm;min-height:0;--pl:8mm;--pt:10mm}}
@media print{body{background:#fff;padding:0}.page{width:auto;min-height:0;margin:0;padding:0;box-shadow:none;--pl:0px;--pt:0px}.missing{background:none;color:inherit}}`;

/** Dữ liệu mẫu để xem trước mẫu tài liệu khi chưa có khách thật */
export const SAMPLE_FORM: ComposerForm = {
  txType: 'PROJECT_ME', quoteTplId: '', contractTplId: '', tier: 'PROJECT',
  party: { name: 'Công ty CP Khách Hàng Mẫu', taxCode: '0100000000', address: '123 Đường Mẫu, Quận 1, TP.HCM', rep: 'Nguyễn Văn A', repTitle: 'Giám đốc', phone: '0900 000 000', email: 'mau@example.com' },
  items: [{ sku: 'SKU-MAU-01', name: 'Sản phẩm mẫu 1', unit: 'Bộ', qty: 10, price: 1_250_000 }, { sku: 'SKU-MAU-02', name: 'Sản phẩm mẫu 2', unit: 'Cuộn', qty: 100, price: 230_000 }],
  vatPct: 10, delivery: 'Giao theo tiến độ thi công', advancePct: 30, guaranteeType: 'PERFORMANCE', guaranteePct: 10, warrantyMonths: 12, creditDays: 45,
  paymentMethod: 'Chuyển khoản', validDays: 30, note: '',
};

export const guessTx = (seg?: Segment): TxType =>
  seg === 'DEALER_L1' || seg === 'DEALER_L2' ? 'DEALER' : seg === 'RETAILER' ? 'RETAIL_CASH' : seg === 'FACTORY_END_USER' || seg === 'WORKSHOP' ? 'FACTORY' : seg === 'EPC_CONTRACTOR' || seg === 'INVESTOR_OWNER' || seg === 'CONSULTANT' ? 'PROJECT_ME' : 'DEALER';

export const quoteLineToDoc = (x: QuoteLine): DocLine => ({ sku: x.sku, name: x.name, unit: x.unit, qty: x.qty, price: lineNet(x), listPrice: x.listPrice, discountPct: x.discountPct, ...(x.note ? { note: x.note } : {}), ...(x.vat !== undefined ? { vat: x.vat } : {}) });

export const docLineToQuote = (x: DocLine): QuoteLine => ({ sku: x.sku, name: x.name, unit: x.unit, qty: x.qty, listPrice: x.listPrice ?? x.price, discountPct: x.discountPct ?? 0, ...(x.note?.trim() ? { note: x.note.trim() } : {}), ...(x.vat !== undefined ? { vat: x.vat } : {}) });

export const partyOf = (c?: Customer, l?: Lead): ComposerForm['party'] => ({
  name: c?.name ?? l?.company ?? '', taxCode: c?.taxCode ?? l?.taxCode ?? '', address: c?.address ?? (l?.province ?? ''),
  rep: c?.contactName ?? l?.contact ?? '', repTitle: c?.contactTitle ?? '', phone: c?.contactPhone ?? l?.phone ?? '', email: c?.contactEmail ?? l?.email ?? '',
});

export const secHead = (n: number, title: string) => <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-xs font-semibold text-[rgb(var(--on-accent))]">{n}</span>{title}</h3>;

export const UNIT_WORDS = new Set(['cai', 'chiec', 'bo', 'm', 'met', 'md', 'm2', 'm3', 'cuon', 'kg', 'g', 'tan', 'hop', 'thung', 'cay', 'ong', 'tu', 'lo', 'goi', 'doi', 'cap', 'tam', 'thanh', 'soi', 'lit', 'l', 'set', 'pcs', 'pc', 'ea', 'roll', 'box', 'unit', 'he', 'he thong', 'diem', 'con', 'qua', 'vien', 'bao', 'can', 'lon', 'km', 'chai', 'to', 'quyen', 'ram', 'bich', 'khoi', 'ht', 'tb', 'thiet bi', 'mat', 'canh', 'o', 'cum', 'module', 'lot', 'gio', 'cong', 'ngay', 'thang', 'nam', 'lan', 'chuyen', 'xe']);

export const normKey = (s: string) => fold(s).replace(/[^a-z0-9]+/g, ' ').trim();

export const isUnitWord = (s: string) => { const k = normKey(s); return !!k && k.length <= 10 && UNIT_WORDS.has(k); };

export const HEAD_RULES: [keyof PasteRow | 'stt' | 'amount' | 'code' | 'spec', RegExp][] = [
  ['stt', /^(stt|tt|no|#|so tt)$/], ['amount', /(thanh tien|amount|total|tong tien)/], ['price', /(don gia|gia ban|gia|price)/],
  ['qty', /(so luong|^sl$|^sl |khoi luong|^kl$|qty|quantity)/], ['unit', /^(dvt|don vi|dv|unit|uom)/], ['code', /^(ma|code|model|ky hieu|part|p n)/],
  ['spec', /(quy cach|thong so|spec|hang sx|hang san xuat|xuat xu|nhan hieu|brand)/], ['name', /(ten|hang hoa|vat tu|mo ta|dien giai|description|item|san pham|thiet bi|noi dung)/],
];

export const catalogSkus = (c: SmartCatalog) => c.skus.filter((s) => !s.archived);

export const liveDrafts = (c: SmartCatalog) => c.drafts.filter((d) => !d.promotedSku);

export const netOf = (lp: number, disc: number) => Math.round(lp * (1 - disc / 100));

export const fileB64 = async (f: File) => (await readAsDataUrl(f)).split(',')[1] ?? '';

export const CHECK_DOT: Record<CheckItem['tone'], string> = { red: 'bg-[rgb(var(--danger))]', orange: 'bg-[rgb(var(--accent))]', teal: 'bg-[rgb(var(--success))]' };

// =====================================================================
//  PHÂN HỆ: LỊCH CÔNG TÁC NHÂN SỰ
//  Gặp khách (bắt buộc khách CRM), khảo sát / nghiệm thu (bắt buộc dự án), công tác ngoại tỉnh,
//  nghỉ việc riêng / đi muộn / giải trình chấm công; check-in hiện trường, kết quả, chi phí
// =====================================================================

export const actDays = (a: Activity) => Math.max(0.5, Math.round(((new Date(a.to).getTime() - new Date(a.from).getTime()) / 864e5) * 2) / 2);

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const toLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const fmtDT = (s: string) => { const d = new Date(s); return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`; };

export const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Cần duyệt: công tác, nghỉ / giải trình; gặp khách / khảo sát có đề xuất chi phí */
export const needsApproval = (a: Pick<Activity, 'type' | 'cost'>) => ACTIVITY_TYPE[a.type].approval || ((a.type === 'MEETING' || a.type === 'SURVEY') && a.cost > 0);

// =====================================================================
//  PHÂN HỆ: CÔNG VIỆC — gom mọi việc chờ người đang đăng nhập xử lý
//  (thông báo duyệt hợp đồng / công tác / giải phóng hàng đều dẫn vào đây)
// =====================================================================

// =====================================================================
//  PHÂN HỆ: SẢN XUẤT (3 trạng thái: chờ sản xuất -> đang sản xuất -> đã hoàn thành -> hẹn lắp đặt)
// =====================================================================

export const woLate = (w: WorkOrder) => w.stage !== 'DONE' && w.dueDate < todayISO();

export const INSTALL_VIEW: Record<InstallView, { label: string; tone: Tone }> = {
  WAIT: { label: 'Chờ hẹn lắp', tone: 'orange' },
  SCHEDULED: { label: 'Đã hẹn lắp', tone: 'blue' },
  IN_PROGRESS: { label: 'Đang lắp đặt', tone: 'orange' },
  WAIT_PAYMENT: { label: 'Đã nghiệm thu, chờ thu tiền', tone: 'red' },
  DONE: { label: 'Hoàn tất, bảo hành', tone: 'teal' },
};

export const installView = (i: InstallJob, job: Job | undefined, receipts: Receipt[]): InstallView => {
  if (i.status !== 'ACCEPTED') return i.status;
  if (!job) return 'DONE';
  const m = jobMoney(job, receipts);
  return m.confirmed >= m.value ? 'DONE' : 'WAIT_PAYMENT';
};

export const addMonthsISO = (iso10: string, months: number) => { const d = new Date(`${iso10}T12:00:00`); d.setMonth(d.getMonth() + months); return iso(d); };

export const phoneKey = (p?: string) => (p ?? '').replace(/\D/g, '');

export const jobCustName = (j: Job, customers: Customer[]) => j.siteContact || customers.find((c) => c.id === j.customerId)?.name || '—';

export const jobPhone = (j: Job, customers: Customer[]) => j.sitePhone || customers.find((c) => c.id === j.customerId)?.contactPhone || '';

/** Kỹ thuật / người khảo sát được giao đơn */
export const techUsers = (users: User[]) => users.filter((u) => u.active && (u.role === 'SALES_REP' || u.role === 'DEPT_HEAD') && u.dept !== 'ACCOUNTING');

// =====================================================================
//  TỔNG QUAN, KHÁCH HÀNG, BÁO CÁO RIÊNG CHO MÔ HÌNH XƯỞNG
//  Doanh số = tiền Kế toán đã xác nhận; công nợ = giá trị HĐ - đã xác nhận
// =====================================================================

export const DAY = 864e5;

export const isoMs = (iso?: string) => (iso ? Date.parse(iso.length === 10 ? `${iso}T12:00:00` : iso) : NaN);

export const spanDays = (a?: string | number, b?: string | number) => {
  const x = typeof a === 'number' ? a : isoMs(a), y = typeof b === 'number' ? b : isoMs(b);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.max(0, (y - x) / DAY) : null;
};

export const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

export const fmtDays = (d: number | null) => (d === null ? '—' : `${d.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ngày`);

export const monthKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };

export const tipStyle = { contentStyle: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text }, labelStyle: { color: C.muted } };

/** Báo giá được chốt (hoặc bản mới nhất) của đơn */
export const wonQuoteOf = (j: Job) => j.quotes.find((q) => q.version === j.wonVersion) ?? j.quotes[j.quotes.length - 1];

export const AGING: Record<AgingScheme, { label: string; basis: 'doc' | 'due'; note: string; buckets: ArBucketDef[] }> = {
  AGE_30_60: {
    label: 'Theo tuổi nợ: Trong hạn < 30 · Quá hạn 31–60 · Nợ xấu > 60 ngày', basis: 'doc', note: 'Tuổi nợ tính từ ngày chứng từ (ngày đơn hàng / mốc thanh toán).',
    buckets: [
      { id: 'CURRENT', label: 'Trong hạn (≤ 30 ngày)', short: 'Trong hạn', color: '#00B894', tone: 'teal', max: 30 },
      { id: 'OVER', label: 'Quá hạn (31–60 ngày)', short: '31–60 ngày', color: '#F28C33', tone: 'orange', max: 60 },
      { id: 'BAD', label: 'Nợ xấu (> 60 ngày)', short: '> 60 ngày', color: '#EF4444', tone: 'red', max: Infinity },
    ],
  },
  OVERDUE_15_30: {
    label: 'Theo ngày quá hạn: Trong hạn · 1–15 · 16–30 · > 30 ngày', basis: 'due', note: 'Số ngày quá hạn tính từ hạn thanh toán.',
    buckets: [
      { id: 'CURRENT', label: 'Trong hạn', short: 'Trong hạn', color: '#00B894', tone: 'teal', max: 0 },
      { id: 'D15', label: 'Quá hạn 1–15 ngày', short: '1–15 ngày', color: '#F9C25A', tone: 'orange', max: 15 },
      { id: 'D30', label: 'Quá hạn 16–30 ngày', short: '16–30 ngày', color: '#F28C33', tone: 'orange', max: 30 },
      { id: 'BAD', label: 'Nợ xấu > 30 ngày', short: '> 30 ngày', color: '#EF4444', tone: 'red', max: Infinity },
    ],
  },
};

export const addDaysISO = (d: string, n: number) => iso(new Date(Date.parse(`${d.slice(0, 10)}T12:00:00`) + n * 864e5));

export const overdueDays = (due: string, today: string) => Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${due}T12:00:00`)) / 864e5);

export const COMMISSION_STATUS: Record<CommissionRow['status'], { label: string; tone: Tone }> = {
  PAID: { label: 'Đã chi hoa hồng', tone: 'teal' },
  READY: { label: 'Đủ điều kiện, chờ chi', tone: 'orange' },
  WAIT: { label: 'Chưa thu đủ 100%', tone: 'muted' },
};

export const HUB_GROUP: Record<HubGroup, { label: string; color: string; kinds: ApprovalKind[] }> = {
  PRICE: { label: 'Giá & chiết khấu', color: '#F28C33', kinds: ['QUOTE', 'CONTRACT'] },
  WORK: { label: 'Công tác & giải trình công', color: '#1F74D4', kinds: ['ACTIVITY', 'EXPENSE'] },
  MDF: { label: 'Chi & claim quỹ MDF', color: '#8B5CF6', kinds: ['PROGRAM', 'CLAIM'] },
  LEAD: { label: 'Phân lead', color: '#00B894', kinds: ['LEAD_ASSIGN'] },
  CASH: { label: 'Thu tiền & nộp quỹ', color: '#EC4899', kinds: ['RECEIPT', 'CASH'] },
  STOCK: { label: 'Hàng giữ chỗ', color: '#F6B533', kinds: ['STOCK'] },
  MKT: { label: 'Nội dung marketing', color: '#0EA5E9', kinds: ['CONTENT'] },
  OPS: { label: 'Kho, đơn bán & xưởng', color: '#64748B', kinds: ['VOUCHER', 'SALE', 'SALE_PAY', 'JOB_QUOTE', 'DESIGN'] },
  REQ: { label: 'Đề nghị', color: '#14B8A6', kinds: ['REQUEST'] },
};

export const groupOf = (k: ApprovalKind) => (Object.keys(HUB_GROUP) as HubGroup[]).find((g) => HUB_GROUP[g].kinds.includes(k)) ?? 'STOCK';

export const HUB_KIND: Record<ApprovalKind, string> = {
  QUOTE: 'Duyệt giá báo giá', CONTRACT: 'Duyệt hợp đồng', ACTIVITY: 'Duyệt công tác / công', EXPENSE: 'Duyệt chi phí công tác',
  PROGRAM: 'Duyệt đề xuất chi quỹ', CLAIM: 'Nghiệm thu POP / hóa đơn', LEAD_ASSIGN: 'Chỉ định Sales', STOCK: 'Giải phóng hàng giữ chỗ',
  RECEIPT: 'Xác nhận tiền thu', CASH: 'Nộp tiền về kế toán', CONTENT: 'Duyệt nội dung marketing',
  VOUCHER: 'Duyệt phiếu kho', SALE: 'Duyệt đơn bán', SALE_PAY: 'Xác nhận tiền đơn bán', JOB_QUOTE: 'Duyệt báo giá xưởng', DESIGN: 'Duyệt bản vẽ', REQUEST: 'Duyệt đề nghị',
};

/** Nhãn ngắn cho cột "Phân loại" của bảng hợp nhất */
export const HUB_SHORT: Record<ApprovalKind, string> = {
  QUOTE: 'Duyệt báo giá', CONTRACT: 'Duyệt hợp đồng', ACTIVITY: 'Công tác / công', EXPENSE: 'Chi phí công tác', PROGRAM: 'Đề xuất quỹ',
  CLAIM: 'Claim / POP', LEAD_ASSIGN: 'Chỉ định Sales', STOCK: 'Hàng giữ chỗ', RECEIPT: 'Xác nhận thu', CASH: 'Nộp quỹ', CONTENT: 'Nội dung MKT',
  VOUCHER: 'Phiếu kho', SALE: 'Đơn bán', SALE_PAY: 'Tiền đơn bán', JOB_QUOTE: 'Báo giá xưởng', DESIGN: 'Bản vẽ', REQUEST: 'Đề nghị',
};

/** SLA xử lý (phút) theo loại yêu cầu */
export const HUB_SLA: Record<ApprovalKind, number> = { QUOTE: 120, CONTRACT: 480, ACTIVITY: 240, EXPENSE: 2880, PROGRAM: 1440, CLAIM: 2880, LEAD_ASSIGN: 60, STOCK: 1440, RECEIPT: 240, CASH: 1440, CONTENT: 1440, VOUCHER: 240, SALE: 120, SALE_PAY: 240, JOB_QUOTE: 240, DESIGN: 480, REQUEST: 1440 };

export const DECISION_LABEL: Record<ApprovalDecision, { label: string; tone: Tone }> = {
  APPROVED: { label: 'Đã duyệt', tone: 'teal' }, REJECTED: { label: 'Từ chối', tone: 'red' }, NEED_INFO: { label: 'Yêu cầu bổ sung', tone: 'orange' },
};

export const dayStart = (iso: string) => Date.parse(`${iso.slice(0, 10)}T08:00:00`);

// =====================================================================
// ĐỀ NGHỊ (v48): gửi đề nghị theo quy trình tự tạo, theo dõi, duyệt
// =====================================================================
export const RUN_STATUS: Record<WfRunStatus, { label: string; tone: Tone }> = { PENDING: { label: 'Chờ duyệt', tone: 'orange' }, APPROVED: { label: 'Đã duyệt', tone: 'teal' }, REJECTED: { label: 'Từ chối', tone: 'red' }, NEED_INFO: { label: 'Yêu cầu bổ sung', tone: 'blue' }, CANCELLED: { label: 'Đã rút', tone: 'muted' } };

export const runStep = (r: WfRun) => Math.min(r.decisions.filter((d) => d.decision === 'APPROVED').length, r.steps.length);

/** Giá trị hiển thị của một trường đề nghị */
export const runVal = (f: WfField, v: string | undefined, users: User[]) => (!v ? '—' : f.type === 'MONEY' ? vnd(Number(v)) : f.type === 'DATE' ? fmtDate(v) : f.type === 'USER' ? users.find((u) => u.id === v)?.name ?? v : f.type === 'MULTI' ? v.split('|').join(', ') : v);

// =====================================================================
//  DỮ LIỆU MẪU THEO YÊU CẦU — nạp / xóa bằng nút trong Cài đặt > Doanh nghiệp
//  Mọi bản ghi mẫu có id bắt đầu bằng "demo-" để xóa sạch khi không cần.
// =====================================================================

export const DEMO_PREFIX = 'demo-';

export const isDemo = (id?: string) => !!id && id.startsWith(DEMO_PREFIX);

export const DEMO_BUDGET_NOTE = '(Dữ liệu mẫu)';

export const ESC_MAP: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ESC_MAP[ch] ?? ch);

export const SALE_F0: SaleFilter = { dateBy: 'date', code: '', origin: '', by: 'ALL', cust: '', wh: 'ALL', issue: 'ALL', pay: 'ALL', paySt: 'ALL', inv: 'ALL', revOp: 'GT', rev: 0, ret: false, overdue: false };

export const saleGoods = (o: SalesOrder) => o.lines.map((l) => `${l.name} ×${fmtN(l.qty)}`).join(', ');

/** Hạn thanh toán: ngày xuất kho (hoặc ngày đơn) + số ngày công nợ */
export const saleDue = (o: SalesOrder) => addDaysISO(o.issuedAt ? iso(new Date(o.issuedAt)) : o.date, o.creditDays);

export const soTh = 'whitespace-nowrap bg-[rgb(var(--ink)/0.03)] px-2.5 py-2.5 text-left text-[12.5px] font-normal text-[rgb(var(--muted))]';

export const soTd = 'whitespace-nowrap px-2.5 py-2.5 align-middle';

export const soIco = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)] disabled:opacity-40';

export const soGrid = 'grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2 xl:grid-cols-4';

export const soTime = (t: number) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// =====================================================================
//  CÀI ĐẶT: DỮ LIỆU & BẢO MẬT
// =====================================================================

export const AUDIT_LABEL: Record<string, string> = {
  LOGIN: 'Đăng nhập', LOGIN_FAIL: 'Đăng nhập thất bại', ACCOUNT_LOCKED: 'Khóa tài khoản', LOGOUT: 'Đăng xuất', IDLE_LOGOUT: 'Tự đăng xuất',
  ROLE_SWITCH: 'Chuyển vai trò', PASSWORD_CHANGE: 'Đổi mật khẩu', PASSWORD_CHANGE_FAIL: 'Đổi mật khẩu thất bại', PASSWORD_RESET: 'Đặt lại mật khẩu', USER_CREATE: 'Tạo tài khoản',
  APPROVAL_APPROVED: 'Duyệt', APPROVAL_REJECTED: 'Từ chối', APPROVAL_NEED_INFO: 'Yêu cầu bổ sung',
  DATA_EXPORT: 'Sao lưu dữ liệu', DATA_IMPORT: 'Nhập dữ liệu', DATA_RESTORE: 'Khôi phục bản chụp', DATA_RESET: 'Xóa dữ liệu trên máy',
  SECURITY_POLICY: 'Đổi chính sách bảo mật', MODULES_PROFILE: 'Đổi gói phân hệ',
};

export const CONSOLE_TABS: { id: ConsoleTab; label: string; icon: typeof Wallet; desc: string }[] = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard, desc: 'Sức khỏe nền tảng: doanh nghiệp, người dùng, bản quyền, hợp đồng, cảnh báo' },
  { id: 'tenants', label: 'Doanh nghiệp', icon: Building2, desc: 'Gói bản quyền, hợp đồng, trạng thái, truy cập hỗ trợ' },
  { id: 'modules', label: 'Cấp phép module', icon: SlidersHorizontal, desc: 'Bật / tắt module theo hợp đồng từng doanh nghiệp' },
  { id: 'users', label: 'Người dùng & quyền', icon: Users, desc: 'Tài khoản, vai trò, phân quyền và chính sách bảo mật của từng doanh nghiệp' },
  { id: 'data', label: 'Dữ liệu & nâng cấp', icon: Database, desc: 'Khóa lưu, phiên bản dữ liệu, sao lưu, nâng cấp, snapshot' },
  { id: 'admins', label: 'Quản trị nền tảng', icon: ShieldCheck, desc: 'Tài khoản @3agroup.vn và nhật ký nền tảng' },
];

export const MODULE_GROUP: { title: string; list: Module[] }[] = [
  { title: 'Vận hành bán hàng', list: ['leads', 'customers', 'projects', 'jobs', 'staff'] },
  { title: 'Chuỗi cung ứng & xưởng', list: ['products', 'supply', 'production', 'install', 'inventory'] },
  { title: 'Kế toán tài chính', list: ['cashbook', 'claims', 'reports'] },
  { title: 'Hệ thống', list: ['docs'] },
];

export const daysTo = (iso10: string) => Math.ceil((Date.parse(`${iso10}T23:59:59`) - Date.now()) / 864e5);

// ---------------- Phòng ban & Nhân sự ----------------

/** Vai trò được làm trưởng phòng; Sales Rep tự nâng thành Trưởng phòng KD */
export const headRoleFor = (r: Role): Role => (r === 'SALES_REP' ? 'DEPT_HEAD' : r);

export const SCOPE_LABEL: Record<DataScope, { label: string; hint: string }> = {
  ALL: { label: 'Toàn doanh nghiệp', hint: 'Thấy mọi lead, dự án, khách hàng, đơn hàng' },
  DEPT: { label: 'Phòng ban của mình', hint: 'Chỉ dữ liệu của phòng mình' },
  OWN: { label: 'Chỉ của mình', hint: 'Lead được giao, khách mình phụ trách, đơn mình lên' },
  WON: { label: 'Chỉ đơn đã chốt', hint: 'Dùng cho kế toán: dự án đã chốt, mọi khách hàng' },
};

export const DEFAULT_SCOPE: Record<Role, DataScope> = { BOD: 'ALL', MKT_LEAD: 'ALL', DEPT_HEAD: 'DEPT', SALES_REP: 'OWN', ACCOUNTANT: 'WON' };

/** Thao tác thuộc phân hệ nào (để hiển thị gọn theo phân hệ) */
export const ACTION_MODULE: Record<Action, Module> = {
  'lead.create': 'leads', 'lead.route': 'leads', 'lead.assign': 'leads', 'lead.accept': 'leads', 'customer.edit': 'customers', 'docs.manage': 'docs',
  'program.create': 'claims', 'program.approveInternal': 'claims', 'program.vendorDecision': 'claims', 'claim.uploadPop': 'claims', 'claim.verify': 'claims', 'claim.submit': 'claims', 'claim.accounting': 'claims', 'mdf.margin': 'claims',
  'project.update': 'projects', 'price.request': 'projects', 'price.decide': 'projects', 'quote.approve': 'projects', 'contract.approve': 'projects', 'template.manage': 'projects',
  'settings.edit': 'settings', 'data.backup': 'settings', 'security.manage': 'settings',
  'po.manage': 'supply', 'stock.deliver': 'supply', 'stock.release': 'supply', 'price.viewCost': 'products', 'stock.voucher': 'warehouse', 'stock.approve': 'warehouse',
  'activity.approve': 'staff', 'production.manage': 'production', 'install.manage': 'install', 'job.manage': 'jobs', 'receipt.confirm': 'jobs', 'priceList.manage': 'jobs',
  'stock.manage': 'inventory', 'cash.manage': 'cashbook', 'sale.manage': 'sales', 'sale.info': 'sales', 'sale.delete': 'sales', 'sale.docs': 'sales', 'feed.moderate': 'home', 'feed.poll': 'home', 'zalo.reply': 'zalo', 'zalo.assign': 'zalo', 'mkt.manage': 'marketing',
};

export const LOCKED = (r: Role, m?: Module, a?: Action) => r === 'BOD' && (m === 'settings' || a === 'settings.edit');

/** Ô tích của trang Phân quyền: 16px, bo 4px; khóa = ổ khóa trên nền xám */
// =====================================================================
// QUY TRÌNH & PHÊ DUYỆT (v48): cài đặt quy trình, tạo quy trình mới
// =====================================================================
export const WF_SLA_OPTS: [number, string][] = [[60, '1 giờ'], [120, '2 giờ'], [240, '4 giờ'], [480, '8 giờ'], [1440, '1 ngày'], [2880, '2 ngày'], [4320, '3 ngày'], [10080, '7 ngày']];

export const wfSlaText = (m: number) => WF_SLA_OPTS.find(([v]) => v === m)?.[1] ?? (m % 1440 === 0 ? `${m / 1440} ngày` : m % 60 === 0 ? `${m / 60} giờ` : `${m} phút`);

export const wfWhoText = (w: WfWho, users: User[]) => (w.kind === 'ROLE' ? ROLE_LABEL[w.role ?? 'BOD'] : w.kind === 'USER' ? users.find((u) => u.id === w.userId)?.name ?? 'Chưa chọn người' : w.kind === 'DEPT_HEAD' ? 'Trưởng phòng' : w.kind === 'MANAGER' ? 'Quản lý trực tiếp' : 'Thủ kho / Kế toán');

export const HOOK_LABEL: Record<HookEvent, string> = {
  'order.created': 'Tạo đơn hàng mới',
  'order.approved': 'Duyệt đơn hàng',
  'order.updated': 'Sửa đơn / ghi nhận thanh toán công nợ',
};

export const FIELD_MAP: [string, string, string][] = [
  ['Khách hàng', 'Tên công ty', 'account.account_name'],
  ['Khách hàng', 'Mã số thuế', 'custom_fields[ma_so_thue] (trường tùy biến)'],
  ['Khách hàng', 'Số điện thoại', 'account.phone_office'],
  ['Khách hàng', 'Địa chỉ', 'account.billing_address_street'],
  ['Khách hàng', 'Người liên hệ', 'contacts[0].first_name, phone_home, email'],
  ['Khách hàng', 'Liên kết đối soát', 'account_id, account_code'],
  ['Đơn hàng', 'Mã khách Getfly', 'order_info.account_code'],
  ['Đơn hàng', 'Ngày chốt đơn', 'order_info.order_date (d/m/Y)'],
  ['Đơn hàng', 'Bảo vệ giá Hãng duyệt', 'order_info.discount, discount_amount'],
  ['Đơn hàng', 'Mã dự án VASSH-CRM', 'order_info.source_name, terms[]'],
  ['Đơn hàng', 'Dòng BOQ: mã, tên, SL, đơn giá', 'products[].product_code, product_name, quantity, price'],
  ['Đơn hàng', 'Chiết khấu dòng BOQ', 'products[].product_sale_off, cash_discount'],
  ['Chiều về', 'Doanh số ròng', 'order_info.amount trừ VAT các dòng'],
  ['Chiều về', 'Đã thanh toán / công nợ', 'payments[], payment_status'],
];

// =====================================================================
//  PHÂN HỆ 6: KHO TÀI LIỆU & QUY CHẾ NỘI BỘ (lọc theo phân quyền hiển thị)
// =====================================================================

export const slug = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');

// =====================================================================
//  CÀI ĐẶT: ZALO ZNS / OA + QUY TẮC THÔNG BÁO ĐA KÊNH
// =====================================================================

export const znsPhone = (p?: string) => {
  const d = (p ?? '').replace(/\D/g, '');
  return d.startsWith('0') ? '84' + d.slice(1) : d;
};

// =====================================================================
//  HEADER: CHUÔNG THÔNG BÁO & MENU TÀI KHOẢN
// =====================================================================

export const timeAgo = (at: number) => {
  const m = Math.floor((Date.now() - at) / 60_000);
  if (m < 1) return 'vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} giờ trước` : `${Math.floor(h / 24)} ngày trước`;
};

export const NOTICE_ICON: Record<NoticeKind, { icon: typeof Bell; color: string }> = {
  LEAD: { icon: Inbox, color: C.orange },
  SLA: { icon: Clock, color: C.red },
  QUOTE: { icon: AlertTriangle, color: C.red },
  CLAIM: { icon: FileCheck2, color: C.teal },
  STOCK: { icon: Warehouse, color: C.orange },
  DOC: { icon: FileText, color: C.blue },
  SYSTEM: { icon: RefreshCw, color: C.muted },
  MENTION: { icon: AtSign, color: BRAND.blueHi },
};

export const PRESENCE_META: Record<Presence, { label: string; color: string }> = { online: { label: 'Đang hoạt động', color: '#22C55E' }, away: { label: 'Vắng mặt', color: '#F6B533' }, offline: { label: 'Ngoại tuyến', color: '#64748B' } };

export const presenceOf = (u: Pick<User, 'id' | 'lastActiveAt' | 'lastLoginAt'> | undefined, meId?: string, now = Date.now()): Presence => {
  if (!u) return 'offline';
  if (u.id === meId) return 'online';
  const t = u.lastActiveAt ?? 0;
  return now - t < 3 * 60000 ? 'online' : now - t < 20 * 60000 ? 'away' : 'offline';
};

// =====================================================================
//  MÀN HÌNH ĐĂNG NHẬP
// =====================================================================

// =====================================================================
//  LÕI MÔ HÌNH XƯỞNG: bảng đơn giá m² / md, đơn hàng công trình, lịch thanh toán, phiếu thu
// =====================================================================

export const PRICE_UNIT: Record<PriceUnit, { label: string; short: string }> = {
  M2: { label: 'Mét vuông (rộng × cao)', short: 'm²' },
  MD: { label: 'Mét dài', short: 'md' },
  SET: { label: 'Bộ', short: 'bộ' },
  PCS: { label: 'Cái', short: 'cái' },
};

export const PAY_TRIGGER: Record<PayTrigger, string> = { SIGN: 'Khi chốt đơn (cọc)', DELIVERY: 'Khi giao hàng / bắt đầu lắp', ACCEPT: 'Khi lắp đặt, nghiệm thu' };

export const JOB_LOST: Record<JobLostReason, string> = { PRICE: 'Giá cao', COMPETITOR: 'Chọn đơn vị khác', POSTPONED: 'Khách hoãn công trình', NO_RESPONSE: 'Khách không phản hồi', OTHER: 'Khác' };

export const RECEIPT_STATUS: Record<ReceiptStatus, { label: string; tone: Tone }> = {
  HOLDING: { label: 'Nhân viên đang giữ', tone: 'orange' },
  SUBMITTED: { label: 'Chờ kế toán xác nhận', tone: 'blue' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'teal' },
  REJECTED: { label: 'Kế toán từ chối', tone: 'red' },
};

export const DEFAULT_MFG_CONFIG: MfgConfig = {
  schedule: [{ id: 'ps-coc', label: 'Đặt cọc', pct: 30, trigger: 'SIGN' }, { id: 'ps-nt', label: 'Lắp đặt, nghiệm thu', pct: 70, trigger: 'ACCEPT' }],
  vatPct: 0, quoteValidDays: 15, warrantyMonths: 24, submitHours: 24, productionDays: 10, openingCash: 0, openingBank: 0,
  creditDays: 30, dueDays: 3, salesCommissionPct: 3, installCommissionPct: 1.5, agingScheme: 'AGE_30_60',
};

export const lineAmount = (l: JobLine, minMeasure = 0) => Math.round(lineMeasure(l, minMeasure) * l.unitPrice * (1 - l.discountPct / 100));

export const lineCost = (l: JobLine, minMeasure = 0) => Math.round(lineMeasure(l, minMeasure) * l.unitCost);

export const lineDims = (l: JobLine) => (l.unit === 'M2' ? `${l.width} × ${l.height} mm` : l.unit === 'MD' ? `${l.length} m` : '');

export const JOB_STAGES: JobStage[] = ['SURVEY', 'QUOTED', 'PRODUCTION', 'INSTALL', 'WAIT_PAYMENT', 'DONE'];

export const JOB_STAGE: Record<JobStage, { label: string; short: string; color: string; tone: Tone }> = {
  SURVEY: { label: 'Đang chờ khảo sát', short: 'Chờ khảo sát', color: '#8B5CF6', tone: 'blue' },
  QUOTED: { label: 'Đã báo giá, chờ chốt', short: 'Đã báo giá', color: '#1F74D4', tone: 'blue' },
  PRODUCTION: { label: 'Sản xuất', short: 'Sản xuất', color: '#F28C33', tone: 'orange' },
  INSTALL: { label: 'Lắp đặt', short: 'Lắp đặt', color: '#06B6D4', tone: 'orange' },
  WAIT_PAYMENT: { label: 'Đã nghiệm thu, chờ thu tiền', short: 'Chờ thu tiền', color: '#EF4444', tone: 'red' },
  DONE: { label: 'Hoàn tất, đang bảo hành', short: 'Hoàn tất', color: '#00B894', tone: 'teal' },
  LOST: { label: 'Trượt', short: 'Trượt', color: '#94A3B8', tone: 'muted' },
};

export const WO_STAGES: WoStage[] = ['WAITING', 'IN_PROGRESS', 'DONE'];

export const DESIGN_STEPS: DesignStatus[] = ['DRAFTING', 'REVIEW', 'APPROVED'];

export const DESIGN_STATUS: Record<DesignStatus, { label: string; tone: Tone; next?: string }> = {
  DRAFTING: { label: 'Đang triển khai bản vẽ', tone: 'orange', next: 'Gửi duyệt bản vẽ' },
  REVIEW: { label: 'Chờ duyệt bản vẽ', tone: 'blue', next: 'Duyệt bản vẽ' },
  APPROVED: { label: 'Bản vẽ đã duyệt', tone: 'teal' },
};

export const WO_STAGE: Record<WoStage, { label: string; color: string; tone: Tone }> = {
  WAITING: { label: 'Chờ sản xuất', color: '#F6B533', tone: 'orange' },
  IN_PROGRESS: { label: 'Đang sản xuất', color: '#1F74D4', tone: 'blue' },
  DONE: { label: 'Đã hoàn thành', color: '#00B894', tone: 'teal' },
};

/** Cần chăm sóc: đã báo giá chưa chốt, hoặc đã trượt */
export const needsCare = (stage: JobStage) => stage === 'QUOTED' || stage === 'LOST';

// ---------------- Kho vật tư & thu chi: tính toán ----------------
export const STOCK_MOVE: Record<InvMoveType, { label: string; prefix: string; tone: Tone }> = {
  IN: { label: 'Nhập kho', prefix: 'PN', tone: 'teal' },
  OUT: { label: 'Xuất kho', prefix: 'PX', tone: 'orange' },
  ADJUST: { label: 'Kiểm kê', prefix: 'KK', tone: 'blue' },
};

export const signedQty = (m: InvMove) => (m.type === 'OUT' ? -m.qty : m.qty);

export const CASH_ACCOUNT: Record<CashAccount, string> = { CASH: 'Quỹ tiền mặt', BANK: 'Tài khoản ngân hàng' };

export const CASH_IN_CATS = ['Thu khác', 'Góp vốn / vay', 'Hoàn tiền nhà cung cấp', 'Bán phế liệu'];

export const CASH_OUT_CATS = ['Vật tư, nguyên liệu', 'Nhân công lắp đặt', 'Vận chuyển', 'Lương, thưởng', 'Mặt bằng, điện nước', 'Marketing', 'Hoa hồng giới thiệu', 'Bảo hành, sửa chữa', 'Chi khác'];

/** Phiếu tiền mặt giữ quá hạn nộp (mặc định trong ngày) */
export const holdingOverdue = (r: Receipt, now: number, hours: number) => r.status === 'HOLDING' && (now - r.collectedAt > hours * 3.6e6 || new Date(r.collectedAt).toDateString() !== new Date(now).toDateString() && new Date(now).getHours() >= 8);

// ---------------- Doanh nghiệp dùng chung hệ thống ----------------
export const ORGS: Org[] = [
  { id: 'vassh', name: 'VASSH – Phân phối & thương mại', shortName: 'VASSH', domain: 'vassh.vn', profile: 'TRADING', color: '#F28C33' },
  { id: 'alux', name: 'ALUX – Sản xuất & lắp đặt', shortName: 'ALUX', domain: 'alux.vn', profile: 'MANUFACTURING', color: '#2563EB' },
];

/* v39: ORGS là danh mục đang dùng — 2 doanh nghiệp có sẵn + các doanh nghiệp 3A Platform tạo thêm (registerOrgs nạp từ hồ sơ nền tảng) */
export const orgOf = (id: string) => ORGS.find((o) => o.id === id) ?? ORGS[0];

export const orgByEmail = (email: string) => ORGS.find((o) => email.trim().toLowerCase().endsWith(`@${o.domain}`));

/** Danh mục vật tư khởi tạo cho xưởng nhôm kính / nội thất */
/** Cấu hình khởi tạo riêng từng doanh nghiệp (chỉ dùng khi doanh nghiệp chưa có dữ liệu) */
export const ORG_DEFAULTS: Record<string, Record<string, unknown>> = {
  vassh: {},
  alux: {
    company: { ...INITIAL_COMPANY, appName: 'ALUX-CRM', legalName: 'Công ty TNHH ALUX', shortName: 'ALUX', profile: 'MANUFACTURING' },
    users: [{ id: 'admin', name: 'Quản trị ALUX', email: 'admin@alux.vn', role: 'BOD', active: true, approvalLimit: 1_000_000_000 }],
    departments: [
      { code: 'KY_THUAT', name: 'Phòng Kỹ thuật (khảo sát, báo giá)', short: 'Kỹ thuật', slaMinutes: 120, receivesLeads: true, active: true },
      { code: 'KINH_DOANH', name: 'Phòng Kinh doanh', short: 'Kinh doanh', slaMinutes: 120, receivesLeads: true, active: true },
      { code: 'XUONG', name: 'Xưởng sản xuất', short: 'Xưởng', slaMinutes: 480, receivesLeads: false, active: true },
      { code: 'LAP_DAT', name: 'Đội lắp đặt', short: 'Lắp đặt', slaMinutes: 480, receivesLeads: false, active: true },
      { code: 'MARKETING', name: 'Phòng Marketing', short: 'Marketing', slaMinutes: 240, receivesLeads: false, active: true },
      { code: 'ACCOUNTING', name: 'Phòng Kế toán', short: 'Kế toán', slaMinutes: 240, receivesLeads: false, active: true },
    ],
    segments: [
      { code: 'HOMEOWNER', name: 'Chủ nhà (nhà phố, biệt thự)', deptNorth: 'KY_THUAT', deptSouth: 'KY_THUAT', mdfEligible: false, points: 18 },
      { code: 'APARTMENT', name: 'Chủ căn hộ', deptNorth: 'KY_THUAT', deptSouth: 'KY_THUAT', mdfEligible: false, points: 14 },
      { code: 'INVESTOR', name: 'Chủ đầu tư / BQL dự án', deptNorth: 'KINH_DOANH', deptSouth: 'KINH_DOANH', mdfEligible: false, points: 20 },
      { code: 'CONTRACTOR', name: 'Nhà thầu xây dựng', deptNorth: 'KINH_DOANH', deptSouth: 'KINH_DOANH', mdfEligible: false, points: 16 },
      { code: 'ARCHITECT', name: 'Kiến trúc sư / đối tác giới thiệu', deptNorth: 'KINH_DOANH', deptSouth: 'KINH_DOANH', mdfEligible: false, points: 12 },
      { code: 'OTHER', name: 'Khác', deptNorth: 'KY_THUAT', deptSouth: 'KY_THUAT', mdfEligible: false, points: 5, system: true },
    ],
    sources: [
      { id: 'FB', name: 'Facebook / Zalo', isMarketing: true },
      { id: 'WEB', name: 'Website / Google', isMarketing: true },
      { id: 'SHOWROOM', name: 'Khách đến showroom', isMarketing: true },
      { id: 'REFERRAL', name: 'Người quen / KTS giới thiệu', isMarketing: false },
      { id: 'OLD', name: 'Khách cũ quay lại', isMarketing: false },
    ],
    budgets: [], priceItems: [], mfgConfig: DEFAULT_MFG_CONFIG, stockItems: [],
  },
};

// =====================================================================
//  DỮ LIỆU CÓ PHIÊN BẢN: lưu trên trình duyệt, tự nâng cấp khi đổi bản app,
//  chụp bản lưu trước mỗi lần nâng cấp / khôi phục để không mất dữ liệu
// =====================================================================

/** Tăng số này mỗi khi cấu trúc dữ liệu đổi, và thêm một bước vào MIGRATIONS */
export const DATA_VERSION = 30;

/** Dữ liệu bản trước khi tách doanh nghiệp (chuyển sang VASSH ở lần mở đầu) */
export const LEGACY_STORE_KEY = 'vassh-crm:data';

/** Khóa lưu tách biệt theo doanh nghiệp trên nền tảng 3A Group */
export const dataKey = (org: string) => `3a:tenant:${org}`;

/** Khóa của bản v18 */
export const v18DataKey = (org: string) => `3a:data:${org}`;

/** Khóa của bản trước (v16–v17), tự chép sang khóa mới ở lần mở đầu */
export const oldDataKey = (org: string) => `vassh-crm:data:${org}`;

export const snapPrefix = (org: string) => `3a:snapshot:${org}:`;

export const LAST_ORG_KEY = '3a:last-org';

/** Tùy chọn giao diện theo trình duyệt (sidebar thu gọn, nhóm menu gấp) — không phải dữ liệu nghiệp vụ */
export const UI_KEY = '3a:ui:shell';

/** Tài khoản quản trị nền tảng 3A Group (không thuộc dữ liệu doanh nghiệp nào) */
export const PLATFORM_KEY = '3a:platform';

export const PLATFORM_DOMAIN = '3agroup.vn';

export const isPlatformEmail = (e: string) => e.trim().toLowerCase().endsWith(`@${PLATFORM_DOMAIN}`);

export const INITIAL_PLATFORM_ADMINS: User[] = [
  { id: 'pa-master', name: 'Quản trị 3A Group', email: `admin@${PLATFORM_DOMAIN}`, role: 'BOD', active: true, approvalLimit: 1e13 },
  { id: 'pa-super', name: 'Super Admin 3A Group', email: `superadmin@${PLATFORM_DOMAIN}`, role: 'BOD', active: true, approvalLimit: 1e13 },
];

export const TENANT_PLAN: Record<TenantPlan, { label: string; seats: number; price: string }> = {
  STARTER: { label: 'Starter', seats: 10, price: '3 triệu / tháng' },
  BUSINESS: { label: 'Business', seats: 30, price: '8 triệu / tháng' },
  ENTERPRISE: { label: 'Enterprise', seats: 100, price: '20 triệu / tháng' },
};

/** 13 module nghiệp vụ cấp phép được (Tổng quan, Công việc, Cài đặt luôn bật) */
export const PROVISION_MODULES: Module[] = ['sales', 'leads', 'customers', 'projects', 'products', 'warehouse', 'supply', 'claims', 'jobs', 'production', 'install', 'inventory', 'cashbook', 'staff', 'docs', 'reports'];

export const defaultTenantReg = (o: Org): TenantReg => ({
  id: o.id, plan: o.id === 'vassh' ? 'ENTERPRISE' : 'BUSINESS', seats: o.id === 'vassh' ? 100 : 30,
  contractStart: '2026-01-01', contractEnd: o.id === 'vassh' ? '2027-06-30' : '2026-12-31', status: 'ACTIVE',
  modules: Object.fromEntries(PROVISION_MODULES.map((m) => [m, !BUSINESS_PROFILE[o.profile].off.includes(m)])),
  features: { getfly: o.profile === 'TRADING', zns: true, smtp: true },
});

export const SNAP_KEEP = 3;

 // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Bước nâng cấp: nhận dữ liệu bản v-1, trả về bản v. Quy tắc: chỉ THÊM / đổi tên trường,
 * không xóa dữ liệu người dùng; trường mới để trống sẽ được lấp bằng giá trị mặc định khi nạp.
 */
export const MIGRATIONS: Record<number, (d: AnyRec) => AnyRec> = {
  // Bản 15: gói phân hệ theo doanh nghiệp, báo giá có luồng duyệt giá, sản xuất & lắp đặt
  15: (d) => ({
    ...d,
    company: { profile: 'TRADING', ...(d.company ?? {}) },
    quotes: (d.quotes ?? []).map((q: AnyRec) => ({ createdAt: q.createdAt ?? Date.parse(`${q.date ?? todayISO()}T08:00:00`), ...q })),
    workOrders: d.workOrders ?? [],
    installJobs: d.installJobs ?? [],
    approvalLogs: d.approvalLogs ?? [],
    auditLogs: d.auditLogs ?? [],
  }),
  // Bản 16: xưởng sản xuất (đơn hàng công trình, phiếu thu, bảng đơn giá), dữ liệu tách theo doanh nghiệp
  16: (d) => ({ ...d, jobs: d.jobs ?? [], receipts: d.receipts ?? [] }),
  // Bản 17: quy trình xưởng rút gọn (lệnh SX 3 trạng thái, lắp đặt 3 trạng thái), kho vật tư, thu chi
  17: (d) => {
    const wo = (s: string): WoStage => (s === 'DESIGN' || s === 'WAITING' ? 'WAITING' : s === 'READY' || s === 'DELIVERED' || s === 'DONE' ? 'DONE' : 'IN_PROGRESS');
    return {
      ...d,
      workOrders: ((d.workOrders as AnyRec[] | undefined) ?? []).map((w) => ({ ...w, stage: wo(String(w.stage)), history: ((w.history as AnyRec[] | undefined) ?? []).map((h) => ({ ...h, stage: wo(String(h.stage)) })) })),
      installJobs: ((d.installJobs as AnyRec[] | undefined) ?? []).map((i) => ({ ...i, status: i.status === 'WAIT_ACCEPT' || i.status === 'DEFECT' ? 'IN_PROGRESS' : i.status })),
      stockItems: d.stockItems ?? [], stockMoves: d.stockMoves ?? [], cashEntries: d.cashEntries ?? [],
    };
  },
  // Bản 18: nền tảng 3A Group (khóa lưu 3a:data:<doanh nghiệp>), phiếu quỹ tự sinh, hoa hồng, quyết toán MDF
  18: (d) => ({ ...d, cashEntries: ((d.cashEntries as AnyRec[] | undefined) ?? []).map((e) => ({ source: 'MANUAL', ...e })) }),
  // Bản 19: khóa lưu 3a:tenant:<doanh nghiệp>, cấp phép module từ 3A Console, nhóm tuổi nợ <30 / 31–60 / >60 (chỉ thêm trường)
  19: (d) => (d.mfgConfig ? { ...d, mfgConfig: { agingScheme: 'AGE_30_60', ...(d.mfgConfig as AnyRec) } } : d),
  // Bản 20: bình luận / @nhắc tên theo từng dòng dữ liệu (chỉ thêm danh sách mới)
  20: (d) => ({ ...d, comments: d.comments ?? [] }),
  // Bản 21: nhóm chat cho trang Tin nhắn toàn màn hình (chỉ thêm danh sách mới)
  21: (d) => ({ ...d, channels: d.channels ?? [] }),
  // Bản 22 (v27): bảng tin nội bộ
  22: (d) => ({ ...d, posts: d.posts ?? [] }),
  // Bản 23 (v28): đa kho — tạo Kho Tổng; tồn hiện có thuộc Kho Tổng (không đổi số lượng)
  24: (d) => ({ ...d, stockVouchers: d.stockVouchers ?? [] }),
  // v32: Zalo Hub, Marketing Hub, kiến thức AI, bản tin điều hành (cấu hình mới bổ sung trường còn thiếu, không xóa dữ liệu)
  25: (d) => ({
    ...d,
    zaloConvs: d.zaloConvs ?? [],
    zaloMsgs: d.zaloMsgs ?? [],
    campaigns: d.campaigns ?? [],
    contents: d.contents ?? [],
    banners: d.banners ?? [],
    audiences: d.audiences ?? [],
    automations: d.automations ?? [],
    autoRuns: d.autoRuns ?? [],
    kb: d.kb ?? [],
    briefs: d.briefs ?? [],
    hubCfg: { ...INITIAL_HUB_CFG, ...(d.hubCfg as AnyRec ?? {}), ai: { ...INITIAL_HUB_CFG.ai, ...((d.hubCfg as AnyRec)?.ai as AnyRec ?? {}), features: { ...INITIAL_HUB_CFG.ai.features, ...(((d.hubCfg as AnyRec)?.ai as AnyRec)?.features as AnyRec ?? {}) } }, zalo: { ...INITIAL_HUB_CFG.zalo, ...((d.hubCfg as AnyRec)?.zalo as AnyRec ?? {}) }, brief: { ...INITIAL_HUB_CFG.brief, ...((d.hubCfg as AnyRec)?.brief as AnyRec ?? {}) } },
  }),
  // v33: nhiệm vụ nội dung trên lịch chiến dịch, bật tính năng tạo ảnh minh họa
  26: (d) => ({ ...d, mktTasks: d.mktTasks ?? [], hubCfg: d.hubCfg ? { ...(d.hubCfg as AnyRec), ai: { ...((d.hubCfg as AnyRec).ai as AnyRec), features: { image: true, ...(((d.hubCfg as AnyRec).ai as AnyRec)?.features as AnyRec ?? {}) } } } : d.hubCfg }),
  // v35: danh mục nháp (báo giá thông minh), bài truyền thông ghim trên Bàn làm việc, cấu hình kênh, bật bóc tách ảnh / PDF
  27: (d) => ({ ...d, draftProducts: d.draftProducts ?? [], socialPosts: d.socialPosts ?? [], hubCfg: d.hubCfg ? { ...(d.hubCfg as AnyRec), social: (d.hubCfg as AnyRec).social ?? { title: '', facebookUrl: '', facebookPageId: '', zaloOaUrl: '', youtubeUrl: '', youtubeChannelId: '' }, ai: { ...((d.hubCfg as AnyRec).ai as AnyRec), features: { extract: true, ...(((d.hubCfg as AnyRec).ai as AnyRec)?.features as AnyRec ?? {}) } } } : d.hubCfg }),
  // v37: chỉ tiêu KPI tháng (chỉ thêm nhóm dữ liệu mới)
  28: (d) => ({ ...d, kpiTargets: Array.isArray(d.kpiTargets) ? d.kpiTargets : [] }),
  // v38: lịch sử phiên bản nội dung, hạn mức AI (chỉ thêm nhóm dữ liệu mới; bài cũ chuyển sang doc khi mở lần đầu)
  29: (d) => ({ ...d, contentVersions: Array.isArray(d.contentVersions) ? d.contentVersions : [], aiQuota: d.aiQuota ?? INITIAL_AI_QUOTA }),
  // v38.6: thư viện ảnh marketing (chỉ thêm nhóm dữ liệu mới)
  30: (d) => ({ ...d, mktImages: Array.isArray(d.mktImages) ? d.mktImages : [] }),
  23: (d) => ({ ...d, warehouses: Array.isArray(d.warehouses) && d.warehouses.length ? d.warehouses : INITIAL_WAREHOUSES }),
};

export const storage = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, val: string): boolean { try { localStorage.setItem(key, val); return true; } catch { return false; } },
  del(key: string) { try { localStorage.removeItem(key); } catch { /* bỏ qua */ } },
  keys(): string[] { try { return Object.keys(localStorage); } catch { return []; } },
};

// =====================================================================
//  BẢO MẬT PHÍA TRÌNH DUYỆT: băm mật khẩu, khóa đăng nhập, mã hóa bản sao lưu
//  (Production: xác thực phải chạy trên server — xem ghi chú ở cuối file / tài liệu)
// =====================================================================

export const INITIAL_SECURITY: SecurityPolicy = { minPasswordLength: 8, lockoutAttempts: 5, lockoutMinutes: 15, idleMinutes: 30, sessionDays: 7, roleSwitch: true, forceChangeDefault: true };

export const PBKDF2_ITER = 120_000;

export const te = new TextEncoder();

export const toB64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...Array.from(u.subarray(i, i + 0x8000))); return btoa(s); };

export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const subtle = () => {
  if (typeof crypto === 'undefined' || !crypto.subtle) throw new Error('Trình duyệt không hỗ trợ mã hóa (cần HTTPS hoặc localhost)');
  return crypto.subtle;
};

/** So sánh thời gian hằng, tránh lộ thông tin qua thời gian phản hồi */
export const safeEqual = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

export const tempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(r, (x) => chars[x % chars.length]).join('') + '9A';
};

// =====================================================================
//  GÓI PHÂN HỆ THEO MÔ HÌNH DOANH NGHIỆP
// =====================================================================

/** Phân hệ luôn bật (dùng chung) */
export const CORE_MODULES: Module[] = ['home', 'contacts', 'overview', 'tasks', 'messages', 'settings'];

export const BUSINESS_PROFILE: Record<BusinessProfile, { label: string; desc: string; off: Module[] }> = {
  TRADING: { label: 'Phân phối & thương mại', desc: 'VD: VASSH. Lead, khách hàng doanh nghiệp, dự án BOQ, đặt hàng Hãng, quỹ MDF', off: ['jobs', 'production', 'install', 'inventory'] },
  MANUFACTURING: { label: 'Sản xuất & lắp đặt', desc: 'VD: ALUX. Lead, khảo sát báo giá m² / md, cọc, xưởng, lắp đặt, thu tiền, kho, thu chi', off: ['projects', 'products', 'warehouse', 'supply', 'claims'] },
  ALL: { label: 'Dùng tất cả phân hệ', desc: 'Doanh nghiệp vừa thương mại vừa sản xuất', off: [] },
  CUSTOM: { label: 'Tùy chỉnh', desc: 'Tự bật / tắt từng phân hệ', off: [] },
};

export const moduleEnabled = (c: CompanyInfo, m: Module) => {
  if (CORE_MODULES.includes(m)) return true;
  // Cấp phép từ 3A Platform Console (nạp vào enabledModules khi mở doanh nghiệp) được ưu tiên
  if (c.enabledModules && m in c.enabledModules) return !!c.enabledModules[m];
  const p = c.profile ?? 'TRADING';
  if (p === 'CUSTOM') return true;
  return !BUSINESS_PROFILE[p].off.includes(m);
};

/** Kiểu vận hành để chọn trang Tổng quan / Khách hàng / Báo cáo phù hợp */
export const bizMode = (c: CompanyInfo): 'TRADING' | 'MFG' | 'BOTH' => {
  const mfg = moduleEnabled(c, 'jobs');
  const trade = moduleEnabled(c, 'claims') || moduleEnabled(c, 'projects') || moduleEnabled(c, 'supply');
  return mfg && trade ? 'BOTH' : mfg ? 'MFG' : 'TRADING';
};

export const LOGIN_SLIDES: { kind: 'lead' | 'mdf' | 'mfg' | 'center'; tag: string; title: string; desc: string; points: string[]; org?: string }[] = [
  { kind: 'center', tag: '3A Group Command Center', title: 'Một nền tảng điều hành cho cả tập đoàn', desc: 'Chỉ số, dự báo doanh thu, cảnh báo rủi ro và trao đổi nhóm trên cùng một màn hình.', points: ['Bộ lọc toàn cục theo chi nhánh, phòng ban, dòng sản phẩm', 'AI Copilot phân tích SLA, dòng tiền, quỹ MDF', 'Chat theo dự án, gắn thẻ @ và liên kết # tới số liệu'] },
  { kind: 'lead', tag: 'VASSH · Phân luồng lead', title: 'Lead Marketing về đúng phòng ban, đúng SLA', desc: 'Tự động chia lead MQL / SQL cho Dự án M&E, Kinh doanh thương mại, Kênh đại lý.', points: ['Tiếp nhận trong 2 giờ, báo giá trong 24 giờ', 'Cảnh báo trễ hạn theo tải nhân sự', 'Kanban, Gantt và bình luận ngay trên từng dòng'], org: 'vassh' },
  { kind: 'mdf', tag: 'VASSH · Quỹ MDF 3M', title: 'Vòng đời quỹ MDF từ ngân sách đến ROI', desc: 'Lập ngân sách, Pre-Approval, thu hồ sơ nghiệm thu (POP), claim hoàn quỹ và đo hiệu quả.', points: ['Theo dõi tốc độ giải ngân so với kế hoạch', 'Gợi ý chương trình kích cầu theo nhóm khách', 'Quyết toán thặng dư và công nợ tự động'], org: 'vassh' },
  { kind: 'mfg', tag: 'ALUX · Xưởng nhôm kính', title: 'Từ khảo sát đến bàn giao công trình', desc: 'Báo giá theo m² / md, nhận cọc chuyển sản xuất, lịch lắp đặt, nghiệm thu và thu tiền.', points: ['Lệnh sản xuất 3 trạng thái, cảnh báo trễ hạn', 'Thu tiền tại công trình, đối chiếu nộp quỹ', 'Kho vật tư và sổ thu chi theo đơn hàng'], org: 'alux' },
];

// =====================================================================
//  v39: NHIỀU DOANH NGHIỆP TRÊN NỀN TẢNG 3A — danh mục doanh nghiệp lưu trong hồ sơ nền tảng (không ghi cứng),
//  đường dẫn riêng crm.3agroup.vn/<mã>, đăng nhập một ô, chọn doanh nghiệp sau khi đăng nhập
// =====================================================================

/** Mã đường dẫn không dùng được (trùng thư mục hệ thống / route máy chủ) */
export const RESERVED_ORG_IDS = ['api', 'platform', 'admin', 'login', 'logout', 'console', 'static', 'public', 'assets', 'app', 'auth', 'www', 'crm', 'next', 'favicon'];

export const ORG_ID_RE = /^[a-z0-9][a-z0-9-]{1,29}$/;

export const orgIdIssue = (id: string): string | null => (!ORG_ID_RE.test(id) ? '2–30 ký tự: chữ thường không dấu, số, dấu gạch ngang' : RESERVED_ORG_IDS.includes(id) ? 'Mã này trùng đường dẫn hệ thống' : ORGS.some((o) => o.id === id) ? 'Mã đã có doanh nghiệp dùng' : null);

/** Nhóm dữ liệu cấu hình (giữ mẫu khởi tạo); mọi nhóm dữ liệu nghiệp vụ khác của doanh nghiệp mới để trống, không mang dữ liệu demo */
export const TENANT_KEEP_CONFIG = new Set(['departments', 'segments', 'categories', 'sources', 'popDocs', 'mktItems', 'warehouses', 'tierRules', 'docTemplates']);

// =====================================================================
//  ĐỒNG BỘ ĐÁM MÂY (SUPABASE) — dùng chung dữ liệu cho nhiều người
//  Bật khi khai báo NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (Vercel > Settings > Environment Variables).
//  Không khai báo: app chạy như cũ, dữ liệu lưu trong trình duyệt.
//
//  - Đăng nhập bằng Supabase Auth; quyền vào doanh nghiệp nào do bảng members + Row Level Security quyết định.
//  - Mỗi bản ghi (lead, khách, báo giá, phiếu thu...) là 1 dòng trong bảng records; app chỉ gửi dòng thay đổi,
//    máy khác kéo phần mới mỗi vài giây (theo số thứ tự thay đổi seq).
//  - Ảnh / file đính kèm đưa lên Storage (bucket crm-files), trong dữ liệu chỉ giữ đường dẫn.
//  - Hai người sửa cùng 1 bản ghi: bản lưu sau thắng; sửa khác bản ghi thì không ảnh hưởng nhau.
// =====================================================================

// Next.js thay process.env.NEXT_PUBLIC_* bằng giá trị lúc build; bọc try để môi trường khác không lỗi
export const CLOUD_ENV = (() => { try { return { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }; } catch { return { url: '', key: '' }; } })();

export const CLOUD_URL = (CLOUD_ENV.url || '').trim().replace(/\/+$/, '');

export const CLOUD_KEY = (CLOUD_ENV.key || '').trim();

export const CLOUD_ON = !!(CLOUD_URL && CLOUD_KEY);

export const CLOUD_SESSION_KEY = '3a:cloud-session';

export const CLOUD_BUCKET = 'crm-files';

export const PLATFORM_TENANT = '_platform';

/** Khóa bí mật tích hợp: không bao giờ gửi lên máy chủ hay đưa vào sao lưu */
export const SECRET_FIELDS: Record<string, string[]> = { getfly: ['apiKey', 'webhookSecret'], emailCfg: ['password'], zns: ['secretKey'] };

export const secretless = (k: string, v: unknown): unknown => (SECRET_FIELDS[k] && v && typeof v === 'object' ? { ...(v as AnyRec), ...Object.fromEntries(SECRET_FIELDS[k].map((f) => [f, ''])) } : v);

export const secretKeep = (k: string, v: unknown): AnyRec => (SECRET_FIELDS[k] && v && typeof v === 'object' ? Object.fromEntries(SECRET_FIELDS[k].map((f) => [f, (v as AnyRec)[f]]).filter(([, x]) => x)) : {});

export class CloudError extends Error {
  status: number;
  code?: string;
  constructor(msg: string, status: number, code?: string) { super(msg); this.status = status; this.code = code; }
}

/** Ứng dụng khách Supabase tối giản (gọi thẳng REST API, không cần cài thêm thư viện) */
export const cloud = {
  session: null as CloudSession | null,
  remember: true,
  refreshing: null as Promise<void> | null,
  loadSession(): CloudSession | null {
    try {
      const raw = localStorage.getItem(CLOUD_SESSION_KEY) ?? sessionStorage.getItem(CLOUD_SESSION_KEY);
      this.remember = !!localStorage.getItem(CLOUD_SESSION_KEY);
      this.session = raw ? (JSON.parse(raw) as CloudSession) : null;
    } catch { this.session = null; }
    return this.session;
  },
  saveSession(s: CloudSession | null) {
    this.session = s;
    try {
      localStorage.removeItem(CLOUD_SESSION_KEY); sessionStorage.removeItem(CLOUD_SESSION_KEY);
      if (s) (this.remember ? localStorage : sessionStorage).setItem(CLOUD_SESSION_KEY, JSON.stringify(s));
    } catch { /* bỏ qua */ }
  },
  async raw(path: string, init: RequestInit & { token?: string | null } = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set('apikey', CLOUD_KEY);
    const t = init.token === undefined ? this.session?.access_token : init.token;
    headers.set('Authorization', `Bearer ${t || CLOUD_KEY}`);
    if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return fetch(`${CLOUD_URL}${path}`, { ...init, headers });
  },
  async json<T>(res: Response): Promise<T> {
    const txt = await res.text();
    let body: AnyRec = {};
    try { body = txt ? JSON.parse(txt) : {}; } catch { body = { message: txt }; }
    if (!res.ok) throw new CloudError(String(body.message ?? body.msg ?? body.error_description ?? body.error ?? `HTTP ${res.status}`), res.status, body.code ?? body.error_code);
    return body as T;
  },
  async tokenRequest(grant: 'password' | 'refresh_token', body: AnyRec): Promise<CloudSession> {
    const res = await this.raw(`/auth/v1/token?grant_type=${grant}`, { method: 'POST', body: JSON.stringify(body), token: null });
    const s = await this.json<AnyRec>(res);
    return { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at ?? Math.floor(Date.now() / 1000) + (s.expires_in ?? 3600), user: { id: s.user?.id, email: String(s.user?.email ?? '').toLowerCase() } };
  },
  async signIn(email: string, password: string, remember: boolean) {
    this.remember = remember;
    this.saveSession(await this.tokenRequest('password', { email: email.trim().toLowerCase(), password }));
    return this.session!;
  },
  /** Kiểm tra mật khẩu mà không đổi phiên đang dùng */
  async checkPassword(email: string, password: string): Promise<boolean> {
    try { await this.tokenRequest('password', { email: email.trim().toLowerCase(), password }); return true; }
    catch (e) { if (e instanceof CloudError && e.status < 500) return false; throw e; }
  },
  async refresh() {
    if (!this.session) return;
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try { this.saveSession(await this.tokenRequest('refresh_token', { refresh_token: this.session!.refresh_token })); }
        catch (e) { if (e instanceof CloudError && e.status >= 400 && e.status < 500) this.saveSession(null); throw e; }
        finally { this.refreshing = null; }
      })();
    }
    return this.refreshing;
  },
  /** Gọi API có xác thực; tự gia hạn phiên khi sắp hết hạn hoặc bị từ chối 401 */
  async authed(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.session) throw new CloudError('Phiên đăng nhập đã hết, vui lòng đăng nhập lại', 401);
    if (this.session.expires_at * 1000 - Date.now() < 60_000) await this.refresh();
    let res = await this.raw(path, init);
    if (res.status === 401 && this.session) { await this.refresh(); res = await this.raw(path, init); }
    return res;
  },
  async signOut() {
    const t = this.session?.access_token;
    this.saveSession(null);
    if (t) { try { await this.raw('/auth/v1/logout', { method: 'POST', token: t }); } catch { /* bỏ qua */ } }
  },
  async updatePassword(password: string) {
    await this.json(await this.authed('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password }) }));
  },
  async rpc<T>(fn: string, args: AnyRec = {}): Promise<T> {
    return this.json<T>(await this.authed(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }));
  },
  async access(): Promise<CloudAccess[]> { return this.rpc<CloudAccess[]>('my_access'); },
  /** v39: nhận diện công khai của doanh nghiệp theo mã đường dẫn (chưa cần đăng nhập; cần SQL v39) */
  async brand(id: string): Promise<Org | null> {
    try {
      const res = await this.raw('/rest/v1/rpc/tenant_brand', { method: 'POST', body: JSON.stringify({ p_id: id }), token: null });
      if (!res.ok) return null;
      const j = (await res.json()) as Partial<Org> | null;
      return j && j.shortName ? { id, name: j.name ?? j.shortName, shortName: j.shortName, domain: j.domain ?? '', profile: (j.profile as BusinessProfile) ?? 'TRADING', color: j.color ?? BRAND.o2, logo: j.logo ?? undefined } : null;
    } catch { return null; }
  },
  /**
   * Tạo / cấp lại tài khoản đăng nhập cho nhân sự: đăng ký email + mật khẩu tạm (không đổi phiên của người đang thao tác),
   * rồi gắn vào doanh nghiệp. Tài khoản đã tồn tại thì chỉ đặt lại mật khẩu tạm.
   */
  async provision(email: string, tenant: string, password: string | null, admin: boolean, profile?: { role: Role; appUserId: string }) {
    const e = email.trim().toLowerCase();
    if (password) {
      const res = await this.raw('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: e, password }), token: null });
      if (!res.ok && res.status !== 422 && res.status !== 400) await this.json(res);
    }
    await this.rpc('provision_member', { p_email: e, p_tenant: tenant, p_password: password, p_admin: admin });
    // v26: gắn vai trò + mã nhân sự để RLS kiểm quyền ở máy chủ. CSDL chưa chạy SQL v26 thì bỏ qua (giữ tương thích).
    if (profile) await this.rpc('set_member_profile', { p_email: e, p_tenant: tenant, p_role: profile.role, p_app_user_id: profile.appUserId }).catch(() => undefined);
  },
  async revoke(email: string, tenant: string) { await this.rpc('revoke_member', { p_email: email.trim().toLowerCase(), p_tenant: tenant }); },
  async select(tenant: string, afterSeq: number): Promise<CloudRow[]> {
    const out: CloudRow[] = [];
    let cursor = afterSeq;
    for (;;) {
      const p = new URLSearchParams({ select: 'tenant_id,coll,id,data,rank,deleted,seq', tenant_id: `eq.${tenant}`, seq: `gt.${cursor}`, order: 'seq.asc', limit: '1000' });
      const rows = await this.json<CloudRow[]>(await this.authed(`/rest/v1/records?${p.toString()}`));
      out.push(...rows);
      if (rows.length < 1000) return out;
      cursor = rows[rows.length - 1].seq ?? cursor;
    }
  },
  async upsert(rows: CloudRow[]) {
    for (let i = 0; i < rows.length;) {
      // gói ~800 KB mỗi lần gửi
      let size = 0; let j = i;
      while (j < rows.length && (j === i || size < 800_000) && j - i < 500) { size += JSON.stringify(rows[j].data).length; j++; }
      const res = await this.authed('/rest/v1/records', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, j).map(({ seq: _s, ...r }) => r)) });
      if (!res.ok) await this.json(res);
      i = j;
    }
  },
  publicUrl(path: string) { return `${CLOUD_URL}/storage/v1/object/public/${CLOUD_BUCKET}/${path}`; },
  async upload(tenant: string, blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const hash = Array.from(new Uint8Array(await subtle().digest('SHA-256', buf)), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
    const type = blob.type || 'application/octet-stream';
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' } as Record<string, string>)[type] ?? 'bin';
    const path = `${tenant}/${hash}.${ext}`;
    const res = await this.authed(`/storage/v1/object/${CLOUD_BUCKET}/${path}`, { method: 'POST', headers: { 'Content-Type': type, 'x-upsert': 'false', 'cache-control': '31536000' }, body: blob });
    if (!res.ok) {
      const txt = await res.text();
      if (!/Duplicate|already exists|409/i.test(txt)) throw new CloudError(`Không tải được file lên: ${txt.slice(0, 160)}`, res.status);
    }
    return this.publicUrl(path);
  },
};

// ---------------------------------------------------------------------
//  So sánh dữ liệu: chuỗi JSON chuẩn hóa (khóa sắp xếp) và thay file nhúng bằng đường dẫn đã tải lên
// ---------------------------------------------------------------------

/** Chuỗi là file nhúng cần đưa lên Storage (ảnh base64 lớn hoặc blob: tạm của trình duyệt) */
export const isEmbeddedFile = (s: string) => (s.startsWith('data:') && s.length > 2048) || s.startsWith('blob:');

/** Bản đồ file nhúng -> đường dẫn Storage (dùng chung, sống trong phiên) */
export const fileUrlMap = new Map<string, string>();

export const canonCache = new WeakMap<object, { json: string; files: string[] }>();

/** Nhóm dữ liệu lưu theo từng bản ghi (khóa = trường định danh); nhóm khác lưu nguyên khối */
export const KEYED_COLLS: Record<string, string> = {
  leads: 'id', customers: 'id', users: 'id', activities: 'id', programs: 'id', claims: 'id', quotes: 'id', pos: 'id', reservations: 'id', moves: 'id',
  genDocs: 'id', comments: 'id', contentVersions: 'id', mktImages: 'id', channels: 'id', posts: 'id', warehouses: 'id', stockVouchers: 'id', zaloConvs: 'id', zaloMsgs: 'id', campaigns: 'id', contents: 'id', banners: 'id', audiences: 'id', automations: 'id', autoRuns: 'id', kb: 'id', mktTasks: 'id', briefs: 'id', draftProducts: 'id', socialPosts: 'id', kpiTargets: 'id', getflyOrders: 'orderCode', notices: 'id', docs: 'id', approvalLogs: 'id', auditLogs: 'id', workOrders: 'id', installJobs: 'id', jobs: 'id',
  receipts: 'id', stockItems: 'id', stockMoves: 'id', cashEntries: 'id', priceItems: 'id', docTemplates: 'id', skus: 'sku', mktItems: 'id',
  // nền tảng 3A
  tenants: 'id', logs: 'id',
};

export const WHOLE = '$';

export const META = '$meta';

export const rowKey = (coll: string, id: string) => `${coll}\u0001${id}`;

/**
 * Bộ đồng bộ một doanh nghiệp: so dữ liệu trên máy với bản đã đồng bộ (base) theo từng bản ghi,
 * gửi phần đổi; kéo phần mới theo seq và báo cho app áp vào state.
 */
export class TenantSync {
  tenant: string;
  base = new Map<string, string>();
  ranks = new Map<string, number>();
  cursor = 0;
  version = 0;
  readOnly = false;
  private latest: AnyRec | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pullTimer: ReturnType<typeof setTimeout> | null = null;
  private busy: Promise<void> | null = null;
  private stopped = false;
  private failures = 0;
  info: SyncInfo = { state: 'idle', pending: 0, lastOk: null };
  onInfo: (i: SyncInfo) => void = () => undefined;
  onRemote: (b: RemoteBatch) => void = () => undefined;
  constructor(tenant: string) { this.tenant = tenant; }

  private setInfo(p: Partial<SyncInfo>) { this.info = { ...this.info, ...p }; this.onInfo(this.info); }

  /** Tải toàn bộ dữ liệu doanh nghiệp: trả về { data, version } để app nâng cấp / nạp */
  async load(): Promise<{ data: AnyRec; version: number; rows: number }> {
    const rows = await cloud.select(this.tenant, 0);
    const data: AnyRec = {};
    const lists: Record<string, { rank: number; id: string; value: unknown }[]> = {};
    for (const r of rows) {
      this.cursor = Math.max(this.cursor, r.seq ?? 0);
      if (r.deleted) continue;
      const key = rowKey(r.coll, r.id);
      this.base.set(key, canon(r.data).json);
      this.ranks.set(key, r.rank);
      if (r.coll === META) { if (r.id === 'version') this.version = Number((r.data as AnyRec)?.v ?? 0); continue; }
      if (r.coll === WHOLE) { data[r.id] = r.data; continue; }
      (lists[r.coll] ??= []).push({ rank: r.rank, id: r.id, value: r.data });
    }
    for (const [coll, xs] of Object.entries(lists)) data[coll] = xs.sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1)).map((x) => x.value);
    this.setInfo({ state: 'idle', lastOk: Date.now(), pending: 0 });
    return { data, version: this.version, rows: rows.length };
  }

  /** Dữ liệu trên máy -> danh sách dòng (giữ thứ tự trong mảng để tính rank cho bản ghi mới) */
  private flatten(data: AnyRec) {
    const out = new Map<string, { coll: string; id: string; value: unknown; order?: { list: string[]; index: number } }>();
    for (const [k, v] of Object.entries(data)) {
      const keyField = KEYED_COLLS[k];
      if (keyField && Array.isArray(v)) {
        const list: string[] = [];
        v.forEach((item) => {
          const idv = item && typeof item === 'object' ? (item as AnyRec)[keyField] : undefined;
          if (idv === undefined || idv === null || idv === '') return;
          const id = String(idv);
          const key = rowKey(k, id);
          if (out.has(key)) return;
          list.push(key);
          out.set(key, { coll: k, id, value: item, order: { list, index: list.length - 1 } });
        });
      } else out.set(rowKey(WHOLE, k), { coll: WHOLE, id: k, value: v });
    }
    out.set(rowKey(META, 'version'), { coll: META, id: 'version', value: { v: DATA_VERSION } });
    return out;
  }

  private rankFor(key: string, order?: { list: string[]; index: number }): number {
    const known = this.ranks.get(key);
    if (known !== undefined) return known;
    if (!order) return 0;
    let prev: number | undefined; let next: number | undefined;
    for (let i = order.index - 1; i >= 0 && prev === undefined; i--) prev = this.ranks.get(order.list[i]);
    for (let i = order.index + 1; i < order.list.length && next === undefined; i++) next = this.ranks.get(order.list[i]);
    const r = prev !== undefined && next !== undefined ? (prev + next) / 2 : prev !== undefined ? prev + 1 : next !== undefined ? next - 1 : order.index;
    this.ranks.set(key, r);
    return r;
  }

  /** Số bản ghi trên máy chưa gửi */
  pendingCount(data: AnyRec | null = this.latest): number {
    if (!data) return 0;
    const flat = this.flatten(data);
    let n = 0;
    for (const [key, x] of flat) if (canon(x.value).json !== this.base.get(key)) n++;
    for (const key of this.base.keys()) if (!flat.has(key)) n++;
    return n;
  }

  /** Hẹn gửi dữ liệu mới nhất (gom nhiều thay đổi liên tiếp) */
  schedule(data: AnyRec) {
    if (this.stopped || this.readOnly) return;
    this.latest = data;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.run(); }, 700);
  }

  /** Gửi ngay phần còn chờ (trước khi đăng xuất / đổi doanh nghiệp) */
  async flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.busy) await this.busy.catch(() => undefined);
    await this.run().catch(() => undefined);
  }

  private async run(): Promise<void> {
    if (this.busy) { await this.busy.catch(() => undefined); }
    if (this.stopped || this.readOnly || !this.latest) return;
    const data = this.latest;
    const job = this.push(data);
    this.busy = job;
    try { await job; this.failures = 0; }
    catch (e) {
      this.failures++;
      const offline = /Failed to fetch|NetworkError|Load failed/i.test(String((e as Error)?.message));
      this.setInfo({ state: offline ? 'offline' : 'error', error: cloudMessage(e), pending: this.pendingCount(data) });
      // thử lại sau 3s, 6s, 12s... tối đa 60s
      if (!this.stopped) { if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => { this.timer = null; void this.run(); }, Math.min(60_000, 3000 * 2 ** Math.min(this.failures - 1, 5))); }
    } finally { if (this.busy === job) this.busy = null; }
  }

  private async push(data: AnyRec) {
    const flat = this.flatten(data);
    const changed: { key: string; coll: string; id: string; value: unknown; order?: { list: string[]; index: number } }[] = [];
    const files = new Set<string>();
    for (const [key, x] of flat) {
      const c = canon(x.value);
      if (c.json === this.base.get(key)) continue;
      c.files.forEach((f) => files.add(f));
      changed.push({ key, ...x });
    }
    const removed = [...this.base.keys()].filter((k) => !flat.has(k));
    if (!changed.length && !removed.length) { this.setInfo({ state: 'idle', pending: 0, lastOk: Date.now(), error: undefined }); return; }
    this.setInfo({ state: 'syncing', pending: changed.length + removed.length });
    // 1. Đưa file nhúng lên Storage
    for (const f of files) {
      if (fileUrlMap.has(f)) continue;
      let blob: Blob | null = null;
      try { blob = await (await fetch(f)).blob(); } catch { blob = null; }
      if (!blob) { fileUrlMap.set(f, ''); continue; } // blob: đã hết hạn từ phiên trước, bỏ qua
      fileUrlMap.set(f, await cloud.upload(this.tenant, blob));
    }
    // 2. Gửi bản ghi đổi + đánh dấu xóa
    const rows: CloudRow[] = [];
    const sent: [string, string][] = [];
    for (const x of changed) {
      const json = canon(x.value).json;
      rows.push({ tenant_id: this.tenant, coll: x.coll, id: x.id, data: withFileUrls(x.value), rank: this.rankFor(x.key, x.order), deleted: false });
      sent.push([x.key, json]);
    }
    for (const key of removed) {
      const [coll, id] = key.split('\u0001');
      rows.push({ tenant_id: this.tenant, coll, id, data: {}, rank: this.ranks.get(key) ?? 0, deleted: true });
    }
    await cloud.upsert(rows);
    for (const [key, json] of sent) this.base.set(key, json);
    for (const key of removed) { this.base.delete(key); this.ranks.delete(key); }
    const left = this.latest === data ? 0 : this.pendingCount();
    this.setInfo({ state: 'idle', pending: left, lastOk: Date.now(), error: undefined });
    tenantCloudStats[this.tenant] = { ...(tenantCloudStats[this.tenant] ?? statsOf(data)), ...statsOf(data), savedAt: Date.now() };
  }

  /** Kéo thay đổi của người khác (đọc lại một khoảng nhỏ phía trước để không sót giao dịch ghi chậm) */
  async pull() {
    if (this.stopped) return;
    const rows = await cloud.select(this.tenant, Math.max(0, this.cursor - 40));
    const batch: RemoteBatch = { keyed: {}, whole: {} };
    let n = 0;
    for (const r of rows) {
      this.cursor = Math.max(this.cursor, r.seq ?? 0);
      const key = rowKey(r.coll, r.id);
      const prevBase = this.base.get(key);
      if (r.deleted) {
        if (prevBase === undefined) continue;
        this.base.delete(key); this.ranks.delete(key);
        if (r.coll !== WHOLE && r.coll !== META) { (batch.keyed[r.coll] ??= []).push({ coll: r.coll, id: r.id, rank: r.rank, deleted: true, prevBase }); n++; }
        continue;
      }
      const json = canon(r.data).json;
      if (json === prevBase) continue;
      this.base.set(key, json);
      this.ranks.set(key, r.rank);
      if (r.coll === META) { const v = Number((r.data as AnyRec)?.v ?? 0); if (v > DATA_VERSION) this.readOnly = true; continue; }
      if (r.coll === WHOLE) batch.whole[r.id] = { value: r.data, prevBase };
      else (batch.keyed[r.coll] ??= []).push({ coll: r.coll, id: r.id, value: r.data, rank: r.rank, deleted: false, prevBase });
      n++;
    }
    if (n) this.onRemote(batch);
    if (this.info.state === 'offline' || this.info.state === 'error') { if (!this.timer) this.setInfo({ state: 'idle', error: undefined }); }
    else this.setInfo({ lastOk: Date.now() });
  }

  /** Kéo định kỳ: 5 giây khi đang mở tab, 60 giây khi tab ẩn */
  startPolling() {
    const tick = async () => {
      if (this.stopped) return;
      try { await this.pull(); } catch (e) { if (this.info.state !== 'error') this.setInfo({ state: /Failed to fetch|NetworkError|Load failed/i.test(String((e as Error)?.message)) ? 'offline' : 'error', error: cloudMessage(e) }); }
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (!this.stopped) this.pullTimer = setTimeout(() => void tick(), hidden ? 60_000 : 5_000);
    };
    this.pullTimer = setTimeout(() => void tick(), 5_000);
  }

  /** Áp dữ liệu nhận về vào 1 mảng trên máy (bản ghi đang sửa dở trên máy thì giữ bản trên máy) */
  mergeList(prev: AnyRec[], coll: string, changes: RemoteChange[]): AnyRec[] {
    const keyField = KEYED_COLLS[coll];
    let arr = prev.slice();
    for (const c of changes) {
      const idx = arr.findIndex((x) => x && String(x[keyField]) === c.id);
      const localDirty = idx >= 0 && c.prevBase !== undefined && canon(arr[idx]).json !== c.prevBase;
      if (localDirty) continue;
      if (c.deleted) { if (idx >= 0) arr = arr.filter((_, i) => i !== idx); continue; }
      if (idx >= 0) { arr[idx] = c.value as AnyRec; continue; }
      const at = arr.findIndex((x) => { const r = x ? this.ranks.get(rowKey(coll, String(x[keyField]))) : undefined; return r !== undefined && r > c.rank; });
      if (at < 0) arr.push(c.value as AnyRec); else arr.splice(at, 0, c.value as AnyRec);
    }
    return arr;
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.pullTimer) clearTimeout(this.pullTimer);
  }
}

/** Thông số dữ liệu từng doanh nghiệp cho 3A Console ở chế độ đám mây (cập nhật khi mở / đồng bộ) */
export const tenantCloudStats: Record<string, { size: number; version: number; savedAt: number; users: number; activeUsers: number; customers: number; records: number }> = {};

// =====================================================================
//  APP SHELL
// =====================================================================

export const SESSION_KEY = '3a:session';

/** Kênh lead -> nguồn khách hàng mặc định khi chốt đơn */
export const sourceFromChannel = (src: Source): string =>
  ({ GOOGLE_ADS: 'MKT_DIGITAL', FACEBOOK_ADS: 'MKT_DIGITAL', ZALO_OA: 'MKT_DIGITAL', WEBSITE_FORM: 'MKT_DIGITAL', HOTLINE: 'MKT_DIGITAL', TECH_SEMINAR: 'MKT_EVENT', EXHIBITION: 'MKT_EVENT', VENDOR_REFERRAL: 'VENDOR', REFERRAL: 'REFERRAL' } as Record<Source, string>)[src];

/** Trang có lọc theo khoảng thời gian, và trang mở đầu bằng thanh tab (bộ chọn ngày nằm cùng hàng tab) */
export const DATE_PAGES: Module[] = ['warehouse', 'overview', 'leads', 'customers', 'projects', 'supply', 'claims', 'jobs', 'production', 'install', 'inventory', 'cashbook', 'staff', 'reports'];

/** Nhóm menu sidebar: Vận hành bán hàng · Chuỗi cung ứng & xưởng · Kế toán tài chính · Hệ thống */
/** v40: Tổng quan đứng riêng trên cùng; 4 nhóm Làm việc · Bán hàng · Hàng hóa (Xưởng) · Tài chính; Tài liệu, Cài đặt ở cuối không tiêu đề */
export const NAV_GROUPS: { id: string; title: string; list: Module[] }[] = [
  { id: 'work', title: 'Làm việc', list: ['home', 'tasks', 'staff', 'messages', 'zalo', 'contacts'] },
  { id: 'sales', title: 'Bán hàng', list: ['sales', 'customers', 'projects', 'jobs', 'docs'] },
  { id: 'mkt', title: 'Marketing', list: ['leads', 'marketing', 'claims'] },
  { id: 'supply', title: 'Hàng hóa', list: ['products', 'warehouse', 'supply', 'production', 'install', 'inventory'] },
  { id: 'finance', title: 'Tài chính', list: ['cashbook', 'reports'] },
  { id: 'system', title: '', list: ['settings'] },
];

