// v56 Động cơ đa ngành: hồ sơ ngành có sẵn (thuật ngữ, trạng thái quy trình, loại tài nguyên, trường + bố cục mẫu),
// từ điển thuật ngữ useTerminology(), công thức an toàn, khoảng thời gian, kiểm tra trùng lịch tài nguyên, nhân bản mẫu ngành.
// 3A sửa hồ sơ ngành ở _platform/industryProfiles; bản 3A lưu thắng bản có sẵn trong code (cùng mã ngành).
import { useMemo } from 'react';
import { lOrderSm, uid, useApp } from './core';
import type { CfDef, CfTemplate, CfVal, IndustryCode, IndustryProfile, LayoutAssign, LayoutVer, LBlock, LBlockCfg, LBlockType, LFieldItem, LPage, LSection, Org, Resource, TenantReg } from './types';

// ---------------------------------------------------------------------
//  Thuật ngữ
// ---------------------------------------------------------------------
/** Khóa thuật ngữ dùng trong app; ngành không đặt khóa nào thì dùng nhãn mặc định (Phân phối thương mại) */
export const TERM_KEYS: { key: string; label: string; def: string }[] = [
  { key: 'module.sales', label: 'Tên phân hệ bán hàng (menu)', def: 'Bán hàng' },
  { key: 'sale', label: 'Một bản ghi bán', def: 'Đơn bán hàng' },
  { key: 'saleShort', label: 'Tên ngắn', def: 'Đơn hàng' },
  { key: 'saleList', label: 'Tiêu đề trang danh sách', def: 'Quản lý đơn hàng' },
  { key: 'newSale', label: 'Nút tạo mới', def: 'Lên đơn bán' },
  { key: 'createSale', label: 'Tiêu đề form tạo', def: 'Tạo đơn hàng' },
  { key: 'editSale', label: 'Tiêu đề form sửa', def: 'Sửa đơn hàng' },
  { key: 'customer', label: 'Khách hàng', def: 'Khách hàng' },
  { key: 'resource', label: 'Tài nguyên', def: 'Tài nguyên' },
];
const TERM_DEF: Record<string, string> = Object.fromEntries(TERM_KEYS.map((k) => [k.key, k.def]));

export const INDUSTRY_CODES: IndustryCode[] = ['trade', 'mfg_install', 'studio', 'car_rental', 'booking', 'canteen'];

// ---------------------------------------------------------------------
//  Bố cục mẫu: id cố định để seed SQL và bản trong code giống nhau
// ---------------------------------------------------------------------
const B = (id: string, type: LBlockType, x: number, y: number, w: number, h: number, config: LBlockCfg): LBlock => ({ id, type, pos: { lg: { x, y, w, h }, sm: { w: 12, order: 0 } }, show: { lg: true, md: true, sm: true }, config });
const F = (id: string, fieldKey: string, colSpan: number, extra: Partial<LFieldItem> = {}): LFieldItem => ({ id, fieldKey, colSpan, ...extra });
const S = (id: string, title: string, cols: LSection['cols'], fields: LFieldItem[]): LSection => ({ id, title, cols, fields });
/** Các khối nghiệp vụ còn lại của trang Chi tiết đơn (giống bố cục gốc), đặt dưới / cạnh khối Chi tiết bản ghi cao h */
const saleSide = (p: string, h: number): LBlock[] => [
  B(`${p}-lines`, 'K-Order-Lines', 0, h, 8, 5, { title: 'Hàng hóa & chứng từ', ds: 'sales' }),
  B(`${p}-log`, 'K-Order-Log', 0, h + 5, 8, 4, { title: 'Trao đổi & nhật ký', ds: 'sales' }),
  B(`${p}-flow`, 'K-Order-Flow', 8, 0, 4, 3, { title: 'Quy trình xử lý', ds: 'sales' }),
  B(`${p}-pay`, 'K-Order-Pay', 8, 3, 4, 4, { title: 'Thanh toán', ds: 'sales' }),
  B(`${p}-profit`, 'K-Order-Profit', 8, 7, 4, 3, { title: 'Lãi trên đơn', ds: 'sales' }),
  B(`${p}-debt`, 'K-Order-Debt', 8, 10, 4, 2, { title: 'Công nợ khách', ds: 'sales' }),
];

const tpl = (d: Partial<CfTemplate> & Pick<CfTemplate, 'key' | 'label' | 'type'>): CfTemplate => ({
  entity: 'sale', scope: 'HEAD', required: 'NONE', where: { form: true, info: true, list: false, filter: false }, ...d,
});

// ---- Phân phối thương mại ----
const TRADE_CF: CfTemplate[] = [
  tpl({ key: 'tuyen_giao', label: 'Tuyến giao', type: 'select', options: ['Nội thành', 'Miền Đông', 'Miền Tây', 'Miền Trung', 'Miền Bắc'], where: { form: true, info: true, list: true, filter: true } }),
  tpl({ key: 'xe_giao', label: 'Xe giao hàng', type: 'resource_picker', resourceKind: 'xe_giao', rangeKey: 'khung_giao' }),
  tpl({ key: 'khung_giao', label: 'Khung giờ giao', type: 'datetime_range' }),
  tpl({ entity: 'customer', key: 'han_no_ngay', label: 'Thời hạn nợ', type: 'number', unit: 'ngày', where: { form: true, info: true, list: true, filter: false } }),
];
const TRADE_LAYOUTS: IndustryProfile['layoutTemplates'] = [
  { page: 'sale-list', blocks: [B('tr-sl', 'K-SaleList', 0, 0, 12, 8, { title: 'Danh sách đơn hàng', ds: 'sales' })] },
  { page: 'sale-detail', blocks: [
    B('tr-sd', 'K-RecordDetail', 0, 0, 8, 3, { title: 'Thông tin đơn hàng', ds: 'sales', entity: 'sale', sections: [
      S('tr-sd-s1', '', 4, [F('tr-sd-cus', 'customer', 6), F('tr-sd-code', 'code', 3), F('tr-sd-by', 'by', 3), F('tr-sd-wh', 'wh', 3, { labelOverride: 'Kho xuất' }), F('tr-sd-tg', 'cf:tuyen_giao', 3), F('tr-sd-or', 'origin', 3), F('tr-sd-inv', 'invNo', 3)]),
      S('tr-sd-s2', 'Giao hàng', 2, [F('tr-sd-xe', 'cf:xe_giao', 6), F('tr-sd-kg', 'cf:khung_giao', 6)]),
    ] }),
    ...saleSide('tr-sd', 3),
  ] },
  { page: 'sale-form', blocks: [B('tr-sf', 'K-RecordForm', 0, 0, 12, 4, { title: 'Giao hàng', ds: 'sales', entity: 'sale', sections: [
    S('tr-sf-s1', '', 3, [F('tr-sf-tg', 'cf:tuyen_giao', 4), F('tr-sf-xe', 'cf:xe_giao', 4), F('tr-sf-kg', 'cf:khung_giao', 4)]),
  ] })] },
  { page: 'customer-list', blocks: [B('tr-cl', 'K-RecordList', 0, 0, 12, 8, { title: 'Danh sách khách hàng', ds: 'customers', entity: 'customer' })] },
  { page: 'customer-detail', blocks: [
    B('tr-cd', 'K-RecordDetail', 0, 0, 12, 3, { title: 'Công nợ', ds: 'customers', entity: 'customer', sections: [
      S('tr-cd-s1', '', 3, [F('tr-cd-hm', 'creditLimit', 4, { labelOverride: 'Hạn mức nợ' }), F('tr-cd-debt', 'debt', 4), F('tr-cd-hn', 'cf:han_no_ngay', 4)]),
    ] }),
    B('tr-cf', 'K-RecordForm', 0, 3, 12, 4, { title: 'Thông tin thêm (form)', ds: 'customers', entity: 'customer', sections: [S('tr-cf-s1', '', 2, [F('tr-cf-hn', 'cf:han_no_ngay', 6)])] }),
  ] },
];

// ---- Sản xuất & lắp đặt ----
const MFG_STEPS = ['Khảo sát hiện trạng', 'Đo đạc kích thước', 'Gia công tại xưởng', 'Vận chuyển đến công trình', 'Lắp khung', 'Lắp kính và phụ kiện', 'Vệ sinh, bàn giao'];
const MFG_CF: CfTemplate[] = [
  tpl({ key: 'dia_chi_cong_trinh', label: 'Địa chỉ công trình', type: 'text', required: 'SAVE', where: { form: true, info: true, list: true, filter: false } }),
  tpl({ key: 'khoi_luong_m2', label: 'Khối lượng', type: 'number', unit: 'm²', where: { form: true, info: true, list: true, filter: false } }),
  tpl({ key: 'don_gia_lap_dat', label: 'Đơn giá lắp đặt / m²', type: 'money' }),
  tpl({ key: 'gia_tri_lap_dat', label: 'Giá trị lắp đặt', type: 'formula', formula: 'khoi_luong_m2 * don_gia_lap_dat', unit: 'đ' }),
  tpl({ key: 'lich_lap_dat', label: 'Lịch lắp đặt', type: 'datetime_range', where: { form: true, info: true, list: true, filter: false } }),
  tpl({ key: 'doi_lap_dat', label: 'Đội lắp đặt', type: 'resource_picker', resourceKind: 'doi_tho', rangeKey: 'lich_lap_dat', where: { form: true, info: true, list: true, filter: false } }),
  tpl({ key: 'checklist_ky_thuat', label: 'Checklist kỹ thuật', type: 'checklist', options: MFG_STEPS }),
  tpl({ key: 'anh_nghiem_thu', label: 'Ảnh nghiệm thu', type: 'media_gallery' }),
  tpl({ key: 'chu_ky_nghiem_thu', label: 'Chữ ký nghiệm thu', type: 'signature' }),
];
const MFG_LAYOUTS: IndustryProfile['layoutTemplates'] = [
  { page: 'sale-list', blocks: [B('mf-sl', 'K-SaleList', 0, 0, 12, 8, { title: 'Danh sách lệnh', ds: 'sales' })] },
  { page: 'sale-detail', blocks: [
    B('mf-sd', 'K-RecordDetail', 0, 0, 8, 7, { title: 'Thông tin lệnh', ds: 'sales', entity: 'sale', sections: [
      S('mf-sd-s1', '', 4, [F('mf-sd-cus', 'customer', 6), F('mf-sd-code', 'code', 2), F('mf-sd-by', 'by', 2), F('mf-sd-wh', 'wh', 2)]),
      S('mf-sd-s2', 'Công trình', 3, [F('mf-sd-dc', 'cf:dia_chi_cong_trinh', 12), F('mf-sd-kl', 'cf:khoi_luong_m2', 4), F('mf-sd-dg', 'cf:don_gia_lap_dat', 4), F('mf-sd-gt', 'cf:gia_tri_lap_dat', 4)]),
      S('mf-sd-s3', 'Lắp đặt', 2, [F('mf-sd-lich', 'cf:lich_lap_dat', 6), F('mf-sd-doi', 'cf:doi_lap_dat', 6)]),
      S('mf-sd-s4', 'Nghiệm thu', 1, [F('mf-sd-ck', 'cf:checklist_ky_thuat', 12), F('mf-sd-anh', 'cf:anh_nghiem_thu', 12), F('mf-sd-ky', 'cf:chu_ky_nghiem_thu', 12)]),
    ] }),
    ...saleSide('mf-sd', 7),
  ] },
  { page: 'sale-form', blocks: [B('mf-sf', 'K-RecordForm', 0, 0, 12, 6, { title: 'Công trình & lắp đặt', ds: 'sales', entity: 'sale', sections: [
    S('mf-sf-s1', 'Công trình', 3, [F('mf-sf-dc', 'cf:dia_chi_cong_trinh', 12, { placeholder: 'Số nhà, đường, phường / xã, tỉnh' }), F('mf-sf-kl', 'cf:khoi_luong_m2', 4), F('mf-sf-dg', 'cf:don_gia_lap_dat', 4), F('mf-sf-gt', 'cf:gia_tri_lap_dat', 4, { readOnly: true, helpText: 'Tự tính = Khối lượng × Đơn giá' })]),
    S('mf-sf-s2', 'Lắp đặt', 2, [F('mf-sf-lich', 'cf:lich_lap_dat', 6), F('mf-sf-doi', 'cf:doi_lap_dat', 6, { helpText: 'Hệ thống chặn đội đã có lịch trùng giờ' })]),
    S('mf-sf-s3', 'Nghiệm thu', 1, [F('mf-sf-ck', 'cf:checklist_ky_thuat', 12), F('mf-sf-anh', 'cf:anh_nghiem_thu', 12), F('mf-sf-ky', 'cf:chu_ky_nghiem_thu', 12)]),
  ] })] },
];

/** Hồ sơ ngành có sẵn trong code (dùng khi 3A chưa lưu bản riêng ở _platform/industryProfiles) */
export const INDUSTRY_BUILTIN: IndustryProfile[] = [
  {
    id: 'trade', label: 'Phân phối thương mại', desc: 'Bán buôn, đại lý, giao hàng theo tuyến, công nợ theo hạn mức', ready: true,
    terms: {},
    workflowStates: [{ id: 'quote', label: 'Báo giá', tone: 'muted' }, { id: 'approve', label: 'Chờ duyệt', tone: 'orange' }, { id: 'issue', label: 'Chờ xuất kho', tone: 'blue' }, { id: 'ship', label: 'Đang giao', tone: 'blue' }, { id: 'done', label: 'Hoàn thành', tone: 'teal' }],
    resourceKinds: [{ id: 'xe_giao', label: 'Xe giao hàng' }],
    cfTemplates: TRADE_CF, layoutTemplates: TRADE_LAYOUTS,
  },
  {
    id: 'mfg_install', label: 'Sản xuất & lắp đặt', desc: 'Gia công tại xưởng, lắp đặt tại công trình, nghiệm thu có ảnh và chữ ký', ready: true,
    terms: { 'module.sales': 'Lệnh SX & lắp đặt', sale: 'Lệnh sản xuất & lắp đặt', saleShort: 'Lệnh', saleList: 'Quản lý lệnh sản xuất & lắp đặt', newSale: 'Tạo lệnh', createSale: 'Tạo lệnh sản xuất & lắp đặt', editSale: 'Sửa lệnh', resource: 'Đội thợ' },
    workflowStates: [{ id: 'survey', label: 'Khảo sát', tone: 'muted' }, { id: 'quote', label: 'Thiết kế & báo giá', tone: 'muted' }, { id: 'make', label: 'Sản xuất', tone: 'blue' }, { id: 'install', label: 'Lắp đặt', tone: 'orange' }, { id: 'accept', label: 'Nghiệm thu', tone: 'orange' }, { id: 'done', label: 'Hoàn thành', tone: 'teal' }],
    resourceKinds: [{ id: 'doi_tho', label: 'Đội thợ lắp đặt' }, { id: 'xe_tai', label: 'Xe tải chở hàng' }],
    cfTemplates: MFG_CF, layoutTemplates: MFG_LAYOUTS,
  },
  {
    id: 'studio', label: 'Studio ảnh', desc: 'Lịch chụp theo phòng và nhiếp ảnh gia, hậu kỳ, giao ảnh', ready: false,
    terms: { 'module.sales': 'Lịch chụp', sale: 'Lịch chụp', saleShort: 'Lịch chụp', saleList: 'Quản lý lịch chụp', newSale: 'Đặt lịch chụp', createSale: 'Đặt lịch chụp', editSale: 'Sửa lịch chụp', resource: 'Phòng chụp' },
    workflowStates: [{ id: 'book', label: 'Đặt lịch', tone: 'muted' }, { id: 'shoot', label: 'Chụp', tone: 'blue' }, { id: 'edit', label: 'Hậu kỳ', tone: 'orange' }, { id: 'deliver', label: 'Giao ảnh', tone: 'teal' }],
    resourceKinds: [{ id: 'phong_chup', label: 'Phòng chụp' }, { id: 'nhiep_anh', label: 'Nhiếp ảnh gia' }],
    cfTemplates: [], layoutTemplates: [],
  },
  {
    id: 'car_rental', label: 'Thuê xe', desc: 'Hợp đồng thuê theo giờ / ngày, giao nhận xe, chống trùng lịch xe', ready: false,
    terms: { 'module.sales': 'Thuê xe', sale: 'Hợp đồng thuê xe', saleShort: 'Hợp đồng', saleList: 'Quản lý hợp đồng thuê xe', newSale: 'Lập hợp đồng', createSale: 'Lập hợp đồng thuê xe', editSale: 'Sửa hợp đồng', resource: 'Xe' },
    workflowStates: [{ id: 'book', label: 'Đặt xe', tone: 'muted' }, { id: 'handover', label: 'Giao xe', tone: 'blue' }, { id: 'renting', label: 'Đang thuê', tone: 'orange' }, { id: 'return', label: 'Nhận lại xe', tone: 'blue' }, { id: 'settle', label: 'Quyết toán', tone: 'teal' }],
    resourceKinds: [{ id: 'xe', label: 'Xe cho thuê' }],
    cfTemplates: [], layoutTemplates: [],
  },
  {
    id: 'booking', label: 'Đặt lịch dịch vụ', desc: 'Lịch hẹn theo nhân viên / phòng, xác nhận, phục vụ', ready: false,
    terms: { 'module.sales': 'Lịch hẹn', sale: 'Lịch hẹn', saleShort: 'Lịch hẹn', saleList: 'Quản lý lịch hẹn', newSale: 'Đặt lịch hẹn', createSale: 'Đặt lịch hẹn', editSale: 'Sửa lịch hẹn', resource: 'Nhân viên phục vụ' },
    workflowStates: [{ id: 'book', label: 'Đặt lịch', tone: 'muted' }, { id: 'confirm', label: 'Xác nhận', tone: 'blue' }, { id: 'serve', label: 'Đang phục vụ', tone: 'orange' }, { id: 'done', label: 'Hoàn thành', tone: 'teal' }],
    resourceKinds: [{ id: 'nhan_vien', label: 'Nhân viên phục vụ' }, { id: 'phong', label: 'Phòng / ghế' }],
    cfTemplates: [], layoutTemplates: [],
  },
  {
    id: 'canteen', label: 'Căng tin', desc: 'Bán suất ăn theo ca, chốt ca nhanh tại quầy', ready: false,
    terms: { 'module.sales': 'Bán suất', sale: 'Phiếu bán suất', saleShort: 'Phiếu', saleList: 'Quản lý phiếu bán suất', newSale: 'Bán suất', createSale: 'Lập phiếu bán suất', editSale: 'Sửa phiếu', resource: 'Quầy' },
    workflowStates: [{ id: 'open', label: 'Mở ca', tone: 'muted' }, { id: 'selling', label: 'Đang bán', tone: 'orange' }, { id: 'close', label: 'Chốt ca', tone: 'teal' }],
    resourceKinds: [{ id: 'quay', label: 'Quầy bán' }],
    cfTemplates: [], layoutTemplates: [],
  },
];

/** Hồ sơ ngành hiệu lực: bản 3A lưu ở _platform thắng bản có sẵn cùng mã; giữ thứ tự 6 ngành chuẩn */
export const industryProfilesEff = (saved: IndustryProfile[]): IndustryProfile[] => {
  const out = INDUSTRY_BUILTIN.map((b) => saved.find((s) => s.id === b.id) ?? b);
  return [...out, ...saved.filter((s) => !INDUSTRY_BUILTIN.some((b) => b.id === s.id))];
};

/** Ngành của doanh nghiệp: hồ sơ doanh nghiệp đặt; chưa đặt thì theo mô hình (Xưởng = Sản xuất & lắp đặt) */
export const tenantIndustry = (reg: TenantReg | undefined, org: Pick<Org, 'profile'>): IndustryCode => reg?.industry ?? (org.profile === 'MANUFACTURING' ? 'mfg_install' : 'trade');

/** Từ điển thuật ngữ của một ngành: t(key) trả nhãn theo ngành, không có thì nhãn mặc định (hoặc fallback truyền vào) */
export const termsOf = (p: IndustryProfile | undefined) => (key: string, fallback?: string): string => p?.terms[key]?.trim() || fallback || TERM_DEF[key] || key;

/**
 * Hook từ điển thuật ngữ: đọc ngành của doanh nghiệp đang mở và hồ sơ ngành (_platform/industryProfiles + bản có sẵn).
 * VD t('sale') = 'Đơn bán hàng' (thương mại) / 'Lệnh sản xuất & lắp đặt' (ALUX) / 'Hợp đồng thuê xe'.
 */
export function useTerminology() {
  const { platform, org } = useApp();
  const reg = platform.tenants.find((x) => x.id === org.id);
  const code = tenantIndustry(reg, org);
  return useMemo(() => {
    const profile = industryProfilesEff(platform.industryProfiles).find((p) => p.id === code);
    return { code, profile, t: termsOf(profile) };
  }, [platform.industryProfiles, code]);
}

// ---------------------------------------------------------------------
//  Công thức: + - * / ( ) trên mã các trường số / tiền / công thức khác. Không dùng eval.
// ---------------------------------------------------------------------
type Tok = { k: 'n'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };
const lex = (s: string): Tok[] | null => {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^\d+(?:[.,]\d+)?/.exec(s.slice(i));
    if (num) { out.push({ k: 'n', v: Number(num[0].replace(',', '.')) }); i += num[0].length; continue; }
    const id = /^[a-z][a-z0-9_]*/.exec(s.slice(i));
    if (id) { out.push({ k: 'id', v: id[0] }); i += id[0].length; continue; }
    if ('+-*/()'.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }
    return null;
  }
  return out;
};
/** Các mã trường dùng trong công thức (null = công thức sai cú pháp ký tự) */
export const formulaRefs = (f: string): string[] | null => { const t = lex(f); return t ? [...new Set(t.filter((x): x is { k: 'id'; v: string } => x.k === 'id').map((x) => x.v))] : null; };
/** Tính công thức; thiếu giá trị / chia 0 / sai cú pháp = null */
export const evalFormula = (f: string, val: (key: string) => number | null): number | null => {
  const t = lex(f);
  if (!t || !t.length) return null;
  let p = 0;
  const peek = () => t[p];
  const expr = (): number | null => {
    let a = term();
    while (a !== null && peek()?.k === 'op' && (peek()!.v === '+' || peek()!.v === '-')) { const o = t[p++].v; const b = term(); a = b === null ? null : o === '+' ? a + b : a - b; }
    return a;
  };
  const term = (): number | null => {
    let a = unary();
    while (a !== null && peek()?.k === 'op' && (peek()!.v === '*' || peek()!.v === '/')) { const o = t[p++].v; const b = unary(); a = b === null || (o === '/' && b === 0) ? null : o === '*' ? a * b : a / b; }
    return a;
  };
  const unary = (): number | null => {
    const x = peek();
    if (x?.k === 'op' && x.v === '-') { p++; const v = unary(); return v === null ? null : -v; }
    return atom();
  };
  const atom = (): number | null => {
    const x = t[p++];
    if (!x) return null;
    if (x.k === 'n') return x.v;
    if (x.k === 'id') return val(x.v);
    if (x.v === '(') { const v = expr(); if (t[p]?.k !== 'op' || t[p].v !== ')') return null; p++; return v; }
    return null;
  };
  const r = expr();
  return r === null || p !== t.length || !Number.isFinite(r) ? null : Math.round(r * 100) / 100;
};
/** Lỗi công thức khi 3A khai báo ('' = hợp lệ): ký tự lạ, trường không có / không phải số, tự tham chiếu */
export const formulaIssue = (f: string, self: string, defs: CfDef[]): string => {
  if (!f.trim()) return 'Nhập công thức, VD: khoi_luong_m2 * don_gia_lap_dat';
  const refs = formulaRefs(f);
  if (!refs) return 'Công thức chỉ gồm mã trường, số và + - * / ( )';
  if (refs.includes(self)) return 'Công thức không được dùng chính trường này';
  const bad = refs.filter((k) => !defs.some((d) => d.key === k && (d.type === 'number' || d.type === 'money' || d.type === 'formula')));
  if (bad.length) return `Không có trường số / tiền mã ${bad.join(', ')}`;
  return evalFormula(f, () => 1) === null ? 'Công thức sai cú pháp' : '';
};
/** Tính lại mọi trường công thức trong bộ giá trị (theo thứ tự, công thức dùng được kết quả công thức trước) */
export const cfCompute = (defs: CfDef[], vals: Record<string, CfVal> | undefined): Record<string, CfVal> => {
  const out = { ...(vals ?? {}) };
  const num = (k: string) => { const v = out[k]; return typeof v === 'number' && Number.isFinite(v) ? v : null; };
  for (let pass = 0; pass < 3; pass++) for (const d of defs) {
    if (d.type !== 'formula' || !d.formula) continue;
    const r = evalFormula(d.formula, num);
    if (r === null) delete out[d.key]; else out[d.key] = r;
  }
  return out;
};

// ---------------------------------------------------------------------
//  Khoảng thời gian "YYYY-MM-DDTHH:mm/YYYY-MM-DDTHH:mm"
// ---------------------------------------------------------------------
const DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export type DtRange = { from: string; to: string };
export const rangeParse = (v: CfVal | undefined): DtRange | null => {
  if (typeof v !== 'string') return null;
  const [from, to] = v.split('/');
  return from && to && DT_RE.test(from) && DT_RE.test(to) ? { from, to } : null;
};
export const rangeStr = (r: DtRange) => `${r.from}/${r.to}`;
const ms = (s: string) => new Date(s).getTime();
/** Lỗi khoảng thời gian ('' = hợp lệ) */
export const rangeIssue = (r: DtRange | null) => (!r ? 'Chọn đủ bắt đầu và kết thúc' : ms(r.to) <= ms(r.from) ? 'Kết thúc phải sau bắt đầu' : '');
/** Số giờ / ngày của khoảng thời gian: dưới 24 giờ hiện giờ, từ 24 giờ hiện ngày (+ giờ lẻ) */
export const rangeDuration = (r: DtRange | null): string => {
  if (!r) return '';
  const h = (ms(r.to) - ms(r.from)) / 36e5;
  if (!(h > 0)) return '';
  if (h < 24) return `${Math.round(h * 10) / 10} giờ`;
  const d = Math.floor(h / 24), rh = Math.round((h - d * 24) * 10) / 10;
  return rh ? `${d} ngày ${rh} giờ` : `${d} ngày`;
};
const dmy = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
export const rangeText = (r: DtRange | null): string => {
  if (!r) return '';
  const same = r.from.slice(0, 10) === r.to.slice(0, 10);
  return `${dmy(r.from)} ${r.from.slice(11)} – ${same ? '' : `${dmy(r.to)} `}${r.to.slice(11)} · ${rangeDuration(r)}`;
};
export const rangesOverlap = (a: DtRange, b: DtRange) => ms(a.from) < ms(b.to) && ms(b.from) < ms(a.to);

// ---------------------------------------------------------------------
//  Tài nguyên: kiểm tra trùng lịch
// ---------------------------------------------------------------------
export type ResConflict = { id: string; code: string; range: DtRange };
/**
 * checkResourceAvailability: tài nguyên `resId` đã có lịch trùng với `range` ở bản ghi khác chưa.
 * Xét các bản ghi cùng loại (VD đơn bán) có cùng trường chọn tài nguyên `resKey` = resId và trường thời gian `rangeKey` giao nhau;
 * bỏ chính bản ghi đang sửa và bản ghi đã hủy. Máy chủ (trigger records_cf_guard v56) kiểm tra lại cùng quy tắc.
 */
export function checkResourceAvailability(records: { id: string; code?: string; cf?: Record<string, CfVal>; cancelled?: boolean }[], o: { selfId?: string; resKey: string; rangeKey: string; resId: string; range: DtRange }): ResConflict[] {
  return records.flatMap((r) => {
    if (r.id === o.selfId || r.cancelled || r.cf?.[o.resKey] !== o.resId) return [];
    const rg = rangeParse(r.cf?.[o.rangeKey]);
    return rg && rangesOverlap(rg, o.range) ? [{ id: r.id, code: r.code ?? r.id, range: rg }] : [];
  });
}
/** Lỗi trùng lịch của mọi trường chọn tài nguyên trong bộ giá trị (danh sách thông báo) */
export function resourceConflicts(defs: CfDef[], vals: Record<string, CfVal> | undefined, records: Parameters<typeof checkResourceAvailability>[0], resources: Resource[], selfId?: string): string[] {
  return defs.filter((d) => d.status === 'ACTIVE' && d.type === 'resource_picker' && d.rangeKey).flatMap((d) => {
    const resId = vals?.[d.key];
    const range = rangeParse(vals?.[d.rangeKey!]);
    if (typeof resId !== 'string' || !resId || !range) return [];
    const hit = checkResourceAvailability(records, { selfId, resKey: d.key, rangeKey: d.rangeKey!, resId, range });
    if (!hit.length) return [];
    const nm = resources.find((x) => x.id === resId)?.name ?? resId;
    return [`${d.label}: ${nm} đã có lịch ${rangeText(hit[0].range)} (${hit.map((h) => h.code).join(', ')})`];
  });
}

// ---------------------------------------------------------------------
//  Checklist / ảnh / chữ ký: giá trị lưu là chuỗi JSON trong cf
// ---------------------------------------------------------------------
export const jsonOf = <T,>(v: CfVal | undefined, def: T): T => { if (typeof v !== 'string' || !v) return def; try { return JSON.parse(v) as T; } catch { return def; } };
export const checklistDone = (v: CfVal | undefined): string[] => { const x = jsonOf<unknown>(v, []); return Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : []; };
export type MediaItem = { name: string; url: string; path?: string; size?: number; at?: number; by?: string };
export const mediaOf = (v: CfVal | undefined): MediaItem[] => { const x = jsonOf<unknown>(v, []); return Array.isArray(x) ? x.filter((m): m is MediaItem => !!m && typeof (m as MediaItem).url === 'string') : []; };
export type SignatureVal = { url: string; path?: string; sha256: string; at: number; by?: string; name?: string };
export const signatureOf = (v: CfVal | undefined): SignatureVal | null => { const x = jsonOf<SignatureVal | null>(v, null); return x && typeof x.url === 'string' && typeof x.sha256 === 'string' ? x : null; };

// ---------------------------------------------------------------------
//  Nhân bản mẫu ngành cho doanh nghiệp (bản riêng: trường levels.tenants = [t], bố cục tenantId = t, áp dụng TENANT)
// ---------------------------------------------------------------------
/** Hai định nghĩa cùng đối tượng + mã có cùng áp dụng cho một doanh nghiệp nào đó không (cùng mã chỉ cho phép khi phạm vi riêng tách biệt) */
export const cfKeyClash = (a: Pick<CfDef, 'levels'>, b: Pick<CfDef, 'levels'>) => {
  const wide = (l: CfDef['levels']) => l.sys || l.tr || l.mfg;
  if (wide(a.levels) || wide(b.levels)) return true;
  return a.levels.tenants.some((t) => b.levels.tenants.includes(t));
};

export type ClonePlan = {
  fields: CfDef[]; skipped: { key: string; label: string; why: string }[];
  layouts: LayoutVer[]; assigns: LayoutAssign[]; replaced: LayoutAssign[];
};
/** Kế hoạch áp dụng bộ mẫu ngành (chưa ghi gì): trường mới, trường bỏ qua (đã có), bố cục + nơi áp dụng mới, nơi áp dụng riêng cũ bị thay */
export function planIndustryClone(p: IndustryProfile, tenant: string, all: { cf: CfDef[]; layouts: LayoutVer[]; assigns: LayoutAssign[] }, who: string, now = Date.now()): ClonePlan {
  const skipped: ClonePlan['skipped'] = [];
  const order0 = Math.max(0, ...all.cf.map((d) => d.order));
  const fields: CfDef[] = [];
  p.cfTemplates.forEach((t, i) => {
    const levels = { sys: false, tr: false, mfg: false, tenants: [tenant] };
    const same = all.cf.filter((d) => d.entity === t.entity && d.key === t.key);
    if (same.some((d) => d.levels.tenants.includes(tenant) || d.levels.sys)) { skipped.push({ key: t.key, label: t.label, why: 'đã có trường cùng mã cho doanh nghiệp' }); return; }
    if (same.some((d) => cfKeyClash(d, { levels }))) { skipped.push({ key: t.key, label: t.label, why: 'trùng mã với trường theo mô hình' }); return; }
    fields.push({ ...t, options: t.options ? [...t.options] : undefined, id: uid('cf'), levels, status: 'ACTIVE', order: order0 + i + 1, at: now, by: who, fromIndustry: p.id });
  });
  const layouts: LayoutVer[] = [];
  const assigns: LayoutAssign[] = [];
  const replaced: LayoutAssign[] = [];
  for (const lt of p.layoutTemplates) {
    const n = Math.max(0, ...all.layouts.filter((v) => v.page === lt.page && v.tenantId === tenant).map((v) => v.version)) + 1;
    const ver: LayoutVer = { id: uid('lv'), schema: 1, page: lt.page, version: n, status: 'PUBLISHED', role: null, blocks: lOrderSm(JSON.parse(JSON.stringify(lt.blocks)) as LBlock[]), note: `Mẫu ngành ${p.label}`, by: who, at: now, publishedAt: now, publishedBy: who, tenantId: tenant, fromIndustry: p.id };
    layouts.push(ver);
    const id = `${lt.page}|TENANT||${tenant}|`;
    const old = all.assigns.find((a) => a.id === id);
    if (old) replaced.push(old);
    assigns.push({ id, page: lt.page, level: 'TENANT', profile: null, tenantId: tenant, role: null, verId: ver.id, at: now, by: who });
  }
  return { fields, skipped, layouts, assigns, replaced };
}

/**
 * Áp dụng bộ mẫu ngành cho doanh nghiệp (3A Console): sao chép trường mẫu thành trường riêng (levels.tenants = [t]),
 * bố cục mẫu thành bố cục riêng đã phát hành (tenantId = t) + nơi áp dụng "Riêng doanh nghiệp", ghi ngành vào hồ sơ doanh nghiệp.
 * Không xóa trường / bố cục nào; trường cùng mã đã có thì bỏ qua (áp dụng lại nhiều lần an toàn).
 */
export function useApplyIndustry() {
  const { platform } = useApp();
  return (code: IndustryCode, tenant: string, who: string): ClonePlan | null => {
    const p = industryProfilesEff(platform.industryProfiles).find((x) => x.id === code);
    if (!p) return null;
    const plan = planIndustryClone(p, tenant, { cf: platform.customFields, layouts: platform.layouts, assigns: platform.layoutAssigns }, who);
    if (plan.fields.length) platform.setCustomFields((all) => [...all, ...plan.fields]);
    if (plan.layouts.length) platform.setLayouts((all) => [...plan.layouts, ...all]);
    if (plan.assigns.length) platform.setLayoutAssigns((all) => [...all.filter((a) => !plan.assigns.some((b) => b.id === a.id)), ...plan.assigns]);
    platform.setTenantReg(tenant, { industry: code, industryApplied: { code, at: Date.now(), by: who, fields: plan.fields.length, layouts: plan.layouts.length } },
      `Áp dụng bộ mẫu ngành ${p.label}: ${plan.fields.length} trường mới${plan.skipped.length ? ` (bỏ qua ${plan.skipped.length} trường đã có)` : ''}, ${plan.layouts.length} bố cục riêng`);
    return plan;
  };
}

/** Trang có bố cục mẫu của một ngành */
export const industryPages = (p: IndustryProfile): LPage[] => p.layoutTemplates.map((l) => l.page);
