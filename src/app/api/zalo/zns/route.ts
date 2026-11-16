import { authorize, json, rateLimited, readJson } from '../../_lib/server';
import { sendZns } from '../../_lib/zalo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/zalo/zns — gửi tin ZNS theo mẫu đã được Zalo duyệt (template_id + tham số) */
export async function POST(req: Request) {
  const b = await readJson<{ tenant: string; phone: string; templateId: string; data: Record<string, string>; trackingId: string }>(req, 50_000);
  if (!b || !/^[\d\s+.-]{9,16}$/.test(String(b.phone ?? '')) || !/^\w{1,32}$/.test(String(b.templateId ?? ''))) return json({ ok: false, error: 'bad_request' }, 400);
  const who = await authorize(req, String(b.tenant ?? ''));
  if (who instanceof Response) return who;
  if (rateLimited(`zns:${who.userId}`, 120)) return json({ ok: false, error: 'rate_limited' }, 429);
  const data = Object.fromEntries(Object.entries(b.data ?? {}).slice(0, 20).map(([k, v]) => [k.slice(0, 40), String(v).slice(0, 200)]));
  const r = await sendZns(b.tenant, b.phone, b.templateId, data, String(b.trackingId ?? Date.now()));
  return r.error === 0 ? json({ ok: true, msgId: (r.data as { msg_id?: string } | undefined)?.msg_id }) : json({ ok: false, error: r.message ?? 'zns_failed', code: r.error }, 502);
}
