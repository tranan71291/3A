import { envFor } from './server';

/**
 * v60 Tra cứu dữ liệu đăng ký thuế theo mã số thuế (dùng ở /api/tax/lookup).
 *  - Nguồn mặc định: API tra cứu doanh nghiệp của VietQR (không cần khóa).
 *  - Đổi nguồn theo doanh nghiệp bằng biến môi trường (hậu tố __<MÃ DOANH NGHIỆP> ghi đè cho riêng doanh nghiệp đó):
 *      TAX_LOOKUP_URL        mẫu địa chỉ, {code} thay bằng mã số thuế (VD cổng tra cứu của nhà cung cấp hóa đơn điện tử)
 *      TAX_LOOKUP_KEY        gửi ở header x-api-key (nếu nguồn yêu cầu)
 *      TAX_LOOKUP_CLIENT_ID  gửi ở header x-client-id (nếu nguồn yêu cầu)
 *      TAX_LOOKUP_DISABLED=1 tắt tra cứu; TAX_LOOKUP_RATE_PER_MIN số lần / người / phút (mặc định 20)
 */
export type TaxInfo = { taxCode: string; name: string; shortName?: string; intlName?: string; address?: string; status?: string; source: string; at: number };

export const TAX_DEFAULT_URL = 'https://api.vietqr.io/v2/business/{code}';
export const TAX_CODE_RE = /^(\d{10}(-\d{3})?|\d{12})$/;

export const taxEnabled = (tenant?: string) => envFor('TAX_LOOKUP_DISABLED', tenant) !== '1';

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** Đọc được nhiều dạng trả về: { code: '00', data: {...} } (VietQR), { data: {...} }, hoặc đối tượng phẳng */
export function pickTaxInfo(raw: unknown, code: string, source: string): TaxInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.code === 'string' && r.code !== '00' && r.data == null) return null;
  const d = (r.data && typeof r.data === 'object' ? r.data : r) as Record<string, unknown>;
  const name = str(d.name ?? d.companyName ?? d.ten ?? d.tenDoanhNghiep ?? d.ten_nnt);
  if (!name) return null;
  const address = str(d.address ?? d.diaChi ?? d.dia_chi ?? d.addressFull);
  const status = str(d.status ?? d.tinhTrang ?? d.tinh_trang ?? d.trangThai);
  const shortName = str(d.shortName ?? d.tenVietTat);
  const intlName = str(d.internationalName ?? d.tenQuocTe);
  return { taxCode: code, name, ...(shortName ? { shortName } : {}), ...(intlName ? { intlName } : {}), ...(address ? { address } : {}), ...(status ? { status } : {}), source, at: Date.now() };
}

export type TaxFetch = { ok: true; info: TaxInfo } | { ok: false; error: string; status: number };

/** Gọi nguồn dữ liệu (đã kiểm tra định dạng mã, quyền, tần suất ở route) */
export async function fetchTaxInfo(code: string, tenant: string): Promise<TaxFetch> {
  const tpl = envFor('TAX_LOOKUP_URL', tenant) || TAX_DEFAULT_URL;
  if (!/^https:\/\//.test(tpl) || !tpl.includes('{code}')) return { ok: false, error: 'tax_not_configured', status: 503 };
  const url = tpl.replace('{code}', encodeURIComponent(code));
  const source = tpl === TAX_DEFAULT_URL ? 'vietqr' : new URL(url).hostname;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = envFor('TAX_LOOKUP_KEY', tenant);
  const cid = envFor('TAX_LOOKUP_CLIENT_ID', tenant);
  if (key) headers['x-api-key'] = key;
  if (cid) headers['x-client-id'] = cid;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8_000);
  try {
    const r = await fetch(url, { headers, signal: ctl.signal, cache: 'no-store' });
    if (r.status === 404) return { ok: false, error: 'not_found', status: 404 };
    if (r.status === 429) return { ok: false, error: 'rate_limited', status: 429 };
    if (!r.ok) return { ok: false, error: 'upstream', status: 502 };
    const info = pickTaxInfo(await r.json().catch(() => null), code, source);
    return info ? { ok: true, info } : { ok: false, error: 'not_found', status: 404 };
  } catch {
    return { ok: false, error: 'upstream', status: 502 };
  } finally {
    clearTimeout(timer);
  }
}
