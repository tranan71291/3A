import { aiStatus } from '../_lib/ai';
import { envFor, json, supabaseEnv, TENANT_RE } from '../_lib/server';
import { zaloStatus } from '../_lib/zalo';

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
    models: { anthropic: envFor('ANTHROPIC_MODEL', tenant) || 'claude-sonnet-5-5', openai: envFor('OPENAI_MODEL', tenant) || 'gpt-4o-mini', image: envFor('OPENAI_IMAGE_MODEL', tenant) || 'gpt-image-1' },
    images: !!envFor('OPENAI_API_KEY', tenant),
    zalo: zaloStatus(tenant),
    cloud: !!(sb.url && sb.key),
    social: { facebook: !!envFor('FACEBOOK_PAGE_ACCESS_TOKEN', tenant), zalo: zaloStatus(tenant).oa, youtube: true },
  });
}
