import { envFor } from './server';

export type SocialItem = { id: string; title: string; url: string; thumb?: string; at: number };

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const tag = (x: string, name: string) => decode(x.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? '');
const attr = (x: string, name: string, a: string, extra = '') => decode(x.match(new RegExp(`<${name}\\b[^>]*${extra}[^>]*\\b${a}="([^"]+)"`))?.[1] ?? '');

/** Phân tích RSS kênh YouTube (Atom) */
export function parseYoutubeRss(xml: string): SocialItem[] {
  return xml.split('<entry>').slice(1).map((e) => {
    const id = tag(e, 'yt:videoId');
    return { id, title: tag(e, 'title'), url: attr(e, 'link', 'href', 'rel="alternate"') || (id ? `https://www.youtube.com/watch?v=${id}` : ''), thumb: attr(e, 'media:thumbnail', 'url') || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined), at: Date.parse(tag(e, 'published')) || 0 };
  }).filter((x) => x.id && x.title).slice(0, 15);
}

export async function youtubeFeed(ref: string, f: typeof fetch): Promise<SocialItem[] | string> {
  if (!/^UC[\w-]{10,40}$/.test(ref)) return 'ref_invalid';
  const r = await f(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(ref)}`).catch(() => null);
  if (!r || !r.ok) return 'upstream';
  return parseYoutubeRss(await r.text());
}

export async function facebookFeed(tenant: string, ref: string, f: typeof fetch): Promise<SocialItem[] | string> {
  const token = envFor('FACEBOOK_PAGE_ACCESS_TOKEN', tenant);
  if (!token) return 'facebook_not_configured';
  const page = ref || envFor('FACEBOOK_PAGE_ID', tenant);
  if (!/^[\w.-]{2,80}$/.test(page)) return 'ref_invalid';
  const ver = envFor('FACEBOOK_GRAPH_VERSION', tenant) || 'v25.0';
  const q = new URLSearchParams({ fields: 'id,message,full_picture,permalink_url,created_time', limit: '10', access_token: token });
  const r = await f(`https://graph.facebook.com/${encodeURIComponent(ver)}/${encodeURIComponent(page)}/posts?${q}`).catch(() => null);
  if (!r || !r.ok) return 'upstream';
  const d = (await r.json().catch(() => ({}))) as { data?: { id: string; message?: string; full_picture?: string; permalink_url?: string; created_time?: string }[] };
  return (d.data ?? []).map((p) => {
    const first = (p.message ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
    return { id: p.id, title: first.length > 140 ? `${first.slice(0, 137)}…` : first || 'Bài viết trên Fanpage', url: p.permalink_url ?? `https://www.facebook.com/${p.id}`, thumb: p.full_picture, at: Date.parse(p.created_time ?? '') || 0 };
  });
}

