/**
 * v60 Mã số thuế: kiểm tra định dạng + tra cứu dữ liệu đăng ký thuế qua máy chủ (route /api/tax/lookup).
 *  - Tổ chức: 10 số; đơn vị phụ thuộc / chi nhánh: 10 số + "-" + 3 số.
 *  - Từ 01/7/2025 cá nhân, hộ kinh doanh dùng số định danh cá nhân 12 số làm mã số thuế.
 *  - Trình duyệt không gọi thẳng nguồn dữ liệu: máy chủ giữ khóa (nếu có), xác thực phiên đăng nhập, giới hạn số lần tra.
 *  - Kết quả tra chỉ là gợi ý: người dùng bấm mới ghi vào khách hàng / đơn.
 */
import { cloud, CLOUD_ON, fold } from './core';
import type { TaxInfo } from './types';

export type TaxKind = 'ORG' | 'BRANCH' | 'PERSON';

/** Trang tra cứu thông tin người nộp thuế của Cục Thuế (người dùng tự đối chiếu) */
export const TAX_PORTAL_URL = 'https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp';

/** Bỏ khoảng trắng, dấu chấm; giữ dấu "-" của mã chi nhánh */
export const taxNorm = (s?: string) => (s ?? '').replace(/[\s.]/g, '').trim();

export function taxKind(s?: string): TaxKind | null {
  const v = taxNorm(s);
  if (/^\d{10}$/.test(v)) return 'ORG';
  if (/^\d{10}-\d{3}$/.test(v)) return 'BRANCH';
  if (/^\d{12}$/.test(v)) return 'PERSON';
  return null;
}

export const TAX_KIND_LABEL: Record<TaxKind, string> = { ORG: 'MST tổ chức', BRANCH: 'MST chi nhánh', PERSON: 'Số định danh cá nhân' };
export const TAX_FORMAT_HINT = 'MST 10 số, chi nhánh 10-3 số; cá nhân, hộ kinh doanh dùng số định danh 12 số';

/** So sánh tên / địa chỉ không phân biệt hoa thường, dấu, khoảng trắng, dấu câu, cách viết "Phường" / "P." */
export function textSame(a?: string, b?: string): boolean {
  const n = (x?: string) => fold(x ?? '')
    .replace(/\b(p|phuong)\b\.?/g, 'phuong').replace(/\b(q|quan)\b\.?/g, 'quan').replace(/\b(tp|thanh pho)\b\.?/g, 'tp')
    .replace(/\b(cong ty|cty)\b/g, 'cty').replace(/\b(tnhh|trach nhiem huu han)\b/g, 'tnhh').replace(/\b(cp|co phan)\b/g, 'cp')
    .replace(/[^a-z0-9]/g, '');
  return !!n(a) && n(a) === n(b);
}

export type TaxResult = { ok: true; info: TaxInfo } | { ok: false; error: 'format' | 'not_found' | 'offline' | 'rate_limited' | 'unauthorized' | 'tax_not_configured' | 'upstream' | string };

/** Bộ nhớ đệm trong phiên (10 phút) để không gọi lại cùng một mã */
const cache = new Map<string, { at: number; r: TaxResult }>();
const TTL = 10 * 60 * 1000;

export async function taxLookup(tenant: string, code: string, force = false): Promise<TaxResult> {
  const v = taxNorm(code);
  if (!taxKind(v)) return { ok: false, error: 'format' };
  const hit = cache.get(v);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.r;
  if (typeof location !== 'undefined' && location.protocol === 'file:') return { ok: false, error: 'offline' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (CLOUD_ON && cloud.session?.access_token) headers.Authorization = `Bearer ${cloud.session.access_token}`;
  let r: TaxResult;
  try {
    const res = await fetch('/api/tax/lookup', { method: 'POST', headers, body: JSON.stringify({ tenant, code: v }) });
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return { ok: false, error: 'offline' };
    const d = (await res.json()) as { ok: boolean; info?: TaxInfo; error?: string };
    r = d.ok && d.info ? { ok: true, info: d.info } : { ok: false, error: d.error ?? `http_${res.status}` };
  } catch { return { ok: false, error: 'offline' }; }
  // Không giữ lỗi tạm thời (mạng, giới hạn) trong bộ đệm
  if (r.ok || r.error === 'not_found') cache.set(v, { at: Date.now(), r });
  return r;
}

export const TAX_ERR: Record<string, string> = {
  format: 'Mã số thuế chưa đúng định dạng',
  not_found: 'Không tìm thấy mã số thuế trong dữ liệu đăng ký thuế',
  offline: 'Tra cứu cần kết nối máy chủ: mở trang Cục Thuế để đối chiếu',
  rate_limited: 'Tra cứu quá nhiều lần trong một phút, thử lại sau ít phút',
  unauthorized: 'Phiên đăng nhập hết hạn, đăng nhập lại để tra cứu',
  forbidden: 'Tài khoản không thuộc doanh nghiệp này',
  tax_not_configured: 'Doanh nghiệp chưa bật tra cứu mã số thuế trên máy chủ',
  upstream: 'Nguồn dữ liệu thuế đang bận, thử lại sau',
};
export const taxErrText = (e: string) => TAX_ERR[e] ?? `Chưa tra được (${e})`;

/** Xóa bộ đệm (kiểm thử) */
export const taxCacheClear = () => cache.clear();
