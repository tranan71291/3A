import { aiStatus } from '../_lib/ai';
import { envFor, json, supabaseEnv, TENANT_RE } from '../_lib/server';
import { zaloStatus } from '../_lib/zalo';
import { imageModel } from '../_lib/image';
import { taxEnabled } from '../_lib/tax';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/integrations?tenant=vassh — chỉ trả về đã cấu hình hay chưa (true/false), không lộ khóa */
export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get('tenant') ?? '';
  const tenant = TENANT_RE.test(t) ? t : undefined;
  const sb = supabaseEnv();
  return json({
    ok: true,
    ai: aiStatus(tenant),
    // v56.0.1: mô hình ảnh hiện hành (tên đã ngừng trong biến môi trường tự đổi); images = có khóa (Cài đặt kiểm tra mô hình riêng)
    models: { anthropic: envFor('ANTHROPIC_MODEL', tenant) || 'claude-sonnet-5-5', openai: envFor('OPENAI_MODEL', tenant) || 'gpt-4o-mini', image: imageModel('fast', tenant).model, imageDetail: imageModel('detail', tenant).model },
    images: !!envFor('OPENAI_API_KEY', tenant),
    zalo: zaloStatus(tenant),
    cloud: !!(sb.url && sb.key),
    email: !!(envFor('SMTP_HOST', tenant) && envFor('SMTP_USER', tenant) && envFor('SMTP_PASS', tenant)),
    social: { facebook: !!envFor('FACEBOOK_PAGE_ACCESS_TOKEN', tenant), zalo: zaloStatus(tenant).oa, youtube: true },
    // v60: tra cứu mã số thuế (nguồn mặc định không cần khóa; TAX_LOOKUP_DISABLED=1 để tắt)
    tax: taxEnabled(tenant),
  });
}
