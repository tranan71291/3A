import { authorize, json, rateLimited } from '../_lib/server';
import { facebookFeed, youtubeFeed, type SocialItem } from '../_lib/social';
import { listArticles } from '../_lib/zalo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/social?tenant=vassh&channel=youtube|facebook|zalo&ref=<mã kênh>
 * Bài / video mới nhất cho widget "Truyền thông đa kênh" ở Bàn làm việc. Bộ nhớ đệm 10 phút trên máy chủ.
 *  - YouTube: nguồn RSS công khai của kênh (ref = Channel ID dạng UC…), không cần khóa API.
 *  - Facebook: Graph API /{page-id}/posts, cần FACEBOOK_PAGE_ACCESS_TOKEN (Page access token); page id lấy từ ref
 *    hoặc FACEBOOK_PAGE_ID; phiên bản Graph API đặt bằng FACEBOOK_GRAPH_VERSION (mặc định v25.0).
 *  - Zalo OA: API Article (danh sách tin bài), dùng chung kết nối Zalo OA của Zalo Hub.
 */
const cache = new Map<string, { at: number; items: SocialItem[] }>();
const TTL = 10 * 60_000;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const tenant = u.searchParams.get('tenant') ?? '';
  const channel = u.searchParams.get('channel') ?? '';
  const ref = (u.searchParams.get('ref') ?? '').trim();
  if (!['youtube', 'facebook', 'zalo'].includes(channel)) return json({ ok: false, error: 'bad_request' }, 400);
  const who = await authorize(req, tenant);
  if (who instanceof Response) return who;
  if (rateLimited(`social:${who.userId}`, 30)) return json({ ok: false, error: 'rate_limited' }, 429);
  const key = `${tenant}|${channel}|${ref}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (u.searchParams.get('fresh') ? 60_000 : TTL)) return json({ ok: true, items: hit.items, cached: true });
  let res: SocialItem[] | string;
  if (channel === 'youtube') res = await youtubeFeed(ref, fetch);
  else if (channel === 'facebook') res = await facebookFeed(tenant, ref, fetch);
  else { const z = await listArticles(tenant, 10); res = z.ok ? z.items : z.error; }
  if (typeof res === 'string') return json({ ok: false, error: res }, res === 'ref_invalid' ? 400 : res.endsWith('not_configured') ? 503 : 502);
  cache.set(key, { at: Date.now(), items: res });
  return json({ ok: true, items: res });
}
