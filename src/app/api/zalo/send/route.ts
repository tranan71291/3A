import { authorize, json, rateLimited, readJson } from '../../_lib/server';
import { sendImage, sendText } from '../../_lib/zalo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/zalo/send — nhân viên trả lời khách qua Zalo OA ngay trong CRM */
export async function POST(req: Request) {
  const b = await readJson<{ tenant: string; userId: string; text?: string; imageUrl?: string }>(req, 100_000);
  if (!b || !/^\d{3,40}$/.test(String(b.userId ?? '')) || (!b.text?.trim() && !b.imageUrl)) return json({ ok: false, error: 'bad_request' }, 400);
  const who = await authorize(req, String(b.tenant ?? ''));
  if (who instanceof Response) return who;
  if (rateLimited(`zalo:${who.userId}`, 60)) return json({ ok: false, error: 'rate_limited' }, 429);
  const r = b.imageUrl && /^https:\/\//.test(b.imageUrl) ? await sendImage(b.tenant, b.userId, b.imageUrl, b.text ?? '') : await sendText(b.tenant, b.userId, b.text ?? '');
  return r.error === 0 ? json({ ok: true, msgId: (r.data as { message_id?: string } | undefined)?.message_id }) : json({ ok: false, error: r.message ?? 'zalo_failed', code: r.error }, 502);
}
