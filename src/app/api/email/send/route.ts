import nodemailer from 'nodemailer';
import { authorize, envFor, json, rateLimited, readJson } from '../../_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/email/send — gửi email từ máy chủ SMTP của doanh nghiệp (báo giá kèm PDF).
 * Biến môi trường (thêm hậu tố __<MÃ_DOANH_NGHIỆP> để mỗi doanh nghiệp dùng máy chủ riêng):
 *  SMTP_HOST, SMTP_PORT (mặc định 465), SMTP_USER, SMTP_PASS, SMTP_FROM (vd: "VASSH <sales@vassh.vn>"), SMTP_SECURE (0 = STARTTLS cổng 587)
 * Mật khẩu chỉ nằm trên máy chủ, không lưu trong dữ liệu CRM.
 */
type Att = { filename: string; contentType?: string; base64: string };
export async function POST(req: Request) {
  const b = await readJson<{ tenant: string; to: string; cc?: string; subject: string; text: string; attachments?: Att[] }>(req, 12_000_000);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const list = (v?: string) => (v ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  if (!b || !list(b.to).length || !list(b.to).every((x) => emailRe.test(x)) || !list(b.cc).every((x) => emailRe.test(x)) || !String(b.subject ?? '').trim()) return json({ ok: false, error: 'bad_request' }, 400);
  const who = await authorize(req, String(b.tenant ?? ''));
  if (who instanceof Response) return who;
  if (rateLimited(`email:${who.userId}`, 20)) return json({ ok: false, error: 'rate_limited' }, 429);
  const host = envFor('SMTP_HOST', b.tenant), user = envFor('SMTP_USER', b.tenant), pass = envFor('SMTP_PASS', b.tenant);
  if (!host || !user || !pass) return json({ ok: false, error: 'smtp_not_configured' }, 503);
  const port = Number(envFor('SMTP_PORT', b.tenant)) || 465;
  const secure = envFor('SMTP_SECURE', b.tenant) ? envFor('SMTP_SECURE', b.tenant) !== '0' : port === 465;
  const atts = (b.attachments ?? []).slice(0, 5).filter((a) => a.filename && a.base64).map((a) => ({ filename: String(a.filename).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120), content: Buffer.from(a.base64, 'base64'), contentType: a.contentType || 'application/octet-stream' }));
  if (atts.reduce((s, a) => s + a.content.length, 0) > 8_000_000) return json({ ok: false, error: 'attachments_too_large' }, 413);
  try {
    const tr = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    const info = await tr.sendMail({ from: envFor('SMTP_FROM', b.tenant) || user, to: list(b.to), cc: list(b.cc), replyTo: who.local ? undefined : who.email || undefined, subject: String(b.subject).slice(0, 300), text: String(b.text ?? '').slice(0, 20_000), attachments: atts });
    return json({ ok: true, id: info.messageId });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'smtp_failed' }, 502);
  }
}
