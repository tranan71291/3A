import { authorize, envFor, json, rateLimited, readJson } from '../../_lib/server';
import { fetchTaxInfo, TAX_CODE_RE, taxEnabled } from '../../_lib/tax';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * v60 POST /api/tax/lookup { tenant, code } — tra cứu dữ liệu đăng ký thuế theo mã số thuế.
 *  - Bắt buộc phiên đăng nhập là thành viên doanh nghiệp (authorize); không dùng service_role.
 *  - Chỉ trả về tên, địa chỉ, tình trạng (nếu nguồn có); khóa nguồn dữ liệu không bao giờ về trình duyệt.
 *  - Nguồn và khóa: xem _lib/tax.ts (TAX_LOOKUP_URL / TAX_LOOKUP_KEY / TAX_LOOKUP_CLIENT_ID / TAX_LOOKUP_DISABLED).
 */
type Body = { tenant?: string; code?: string };

export async function POST(req: Request) {
  const b = await readJson<Body>(req, 2_000);
  if (!b) return json({ ok: false, error: 'bad_request' }, 400);
  const tenant = String(b.tenant ?? '');
  const who = await authorize(req, tenant);
  if (who instanceof Response) return who;
  const code = String(b.code ?? '').replace(/[\s.]/g, '');
  if (!TAX_CODE_RE.test(code)) return json({ ok: false, error: 'format' }, 400);
  if (!taxEnabled(tenant)) return json({ ok: false, error: 'tax_not_configured' }, 503);
  if (rateLimited(`tax:${who.userId}`, Number(envFor('TAX_LOOKUP_RATE_PER_MIN', tenant) || 20))) return json({ ok: false, error: 'rate_limited' }, 429);
  const r = await fetchTaxInfo(code, tenant);
  return r.ok ? json({ ok: true, info: r.info }) : json({ ok: false, error: r.error }, r.status);
}
