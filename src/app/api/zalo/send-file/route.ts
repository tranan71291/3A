import { authorize, json, rateLimited, readJson } from '../../_lib/server';
import { sendFile, sendText } from '../../_lib/zalo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/zalo/send-file — gửi tin + file (PDF báo giá) qua Zalo OA cho người đã quan tâm / nhắn OA */
export async function POST(req: Request) {
  const b = await readJson<{ tenant: string; userId: string; text?: string; filename?: string; base64?: string }>(req, 8_000_000);
  if (!b || !/^\d{3,40}$/.test(String(b.userId ?? '')) || (!b.text?.trim() && !b.base64)) return json({ ok: false, error: 'bad_request' }, 400);
  const who = await authorize(req, String(b.tenant ?? ''));
  if (who instanceof Response) return who;
  if (rateLimited(`zalo:${who.userId}`, 30)) return json({ ok: false, error: 'rate_limited' }, 429);
  if (b.text?.trim()) {
    const t = await sendText(b.tenant, b.userId, b.text);
    if (t.error !== 0) return json({ ok: false, error: t.message ?? 'zalo_failed', code: t.error }, 502);
  }
  if (b.base64 && b.filename) {
    const buf = Buffer.from(b.base64, 'base64');
    if (buf.length > 5_000_000) return json({ ok: false, error: 'file_too_large_5mb' }, 413);
    const r = await sendFile(b.tenant, b.userId, String(b.filename).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120), buf);
    if (r.error !== 0) return json({ ok: false, error: r.message ?? 'zalo_file_failed', code: r.error }, 502);
  }
  return json({ ok: true });
}
