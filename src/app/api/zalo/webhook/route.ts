import { envFor, json, supabaseEnv, TENANT_RE } from '../../_lib/server';
import { userDetail, verifySignature } from '../../_lib/zalo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ZEvent = {
  app_id?: string; oa_id?: string; event_name?: string; timestamp?: string | number; user_id_by_app?: string;
  sender?: { id?: string }; recipient?: { id?: string }; follower?: { id?: string };
  message?: { msg_id?: string; text?: string; attachments?: { type?: string; payload?: { url?: string; thumbnail?: string; name?: string; description?: string } }[] };
  info?: { name?: string; phone?: string | number; address?: string; city?: string; district?: string };
};

const profiles = new Map<string, { at: number; name?: string; avatar?: string; phone?: string; address?: string }>();

/**
 * POST /api/zalo/webhook?tenant=<mã doanh nghiệp> — Zalo gọi về khi khách nhắn OA.
 * Xác thực chữ ký, chuẩn hóa thành hội thoại + tin nhắn rồi ghi vào Supabase qua hàm zalo_ingest (kiểm tra ZALO_INGEST_TOKEN),
 * các máy đang mở CRM tự kéo tin mới theo cơ chế đồng bộ sẵn có. Không dùng khóa service_role.
 */
export async function POST(req: Request) {
  const tenant = new URL(req.url).searchParams.get('tenant') ?? '';
  if (!TENANT_RE.test(tenant)) return json({ ok: false, error: 'tenant_invalid' }, 400);
  const raw = await req.text();
  if (raw.length > 200_000) return json({ ok: false }, 413);
  let ev: ZEvent;
  try { ev = JSON.parse(raw) as ZEvent; } catch { return json({ ok: false }, 400); }
  const ok = await verifySignature(tenant, req.headers.get('x-zevent-signature'), raw, String(ev.app_id ?? ''), String(ev.timestamp ?? ''));
  if (!ok) return json({ ok: false, error: 'bad_signature' }, 401);

  const name = String(ev.event_name ?? '');
  const fromOa = name.startsWith('oa_send_');
  const uid = String((fromOa ? ev.recipient?.id : ev.sender?.id) ?? ev.follower?.id ?? '');
  if (!/^\d{3,40}$/.test(uid)) return json({ ok: true, ignored: name });
  const at = Number(ev.timestamp) || Date.now();
  const att = ev.message?.attachments?.[0];
  const kind = name.includes('image') ? 'image' : name.includes('file') ? 'file' : name.includes('sticker') ? 'sticker' : name.includes('link') ? 'link'
    : name === 'follow' || name === 'unfollow' || name === 'user_submit_info' ? 'event' : 'text';
  const text = name === 'follow' ? 'Khách vừa quan tâm OA' : name === 'unfollow' ? 'Khách bỏ quan tâm OA'
    : name === 'user_submit_info' ? `Khách chia sẻ thông tin: ${[ev.info?.name, ev.info?.phone, ev.info?.address, ev.info?.district, ev.info?.city].filter(Boolean).join(', ')}`
    : String(ev.message?.text ?? att?.payload?.description ?? att?.payload?.name ?? '');

  let prof = profiles.get(uid);
  if (!prof || Date.now() - prof.at > 864e5) {
    const d = await userDetail(tenant, uid).catch(() => ({} as Awaited<ReturnType<typeof userDetail>>));
    prof = { at: Date.now(), ...d };
    profiles.set(uid, prof);
  }
  const conv = {
    id: `z_${uid}`, channel: 'ZALO', zaloUserId: uid, displayName: ev.info?.name || prof.name || `Khách Zalo ${uid.slice(-4)}`, avatar: prof.avatar,
    phone: ev.info?.phone ? String(ev.info.phone) : prof.phone, address: [ev.info?.address, ev.info?.district, ev.info?.city].filter(Boolean).join(', ') || prof.address,
    lastAt: at, lastText: text.slice(0, 160), status: 'OPEN', followed: name !== 'unfollow',
  };
  const msg = {
    id: `zm_${ev.message?.msg_id ?? `${uid}_${at}`}`, convId: conv.id, dir: fromOa ? 'OUT' : name.startsWith('user_send_') ? 'IN' : 'EVENT', kind,
    text: text.slice(0, 4000), url: att?.payload?.url, at, by: fromOa ? 'zalo-oa' : undefined, zaloMsgId: ev.message?.msg_id, status: 'SENT',
  };
  const sb = supabaseEnv();
  const token = envFor('ZALO_INGEST_TOKEN', tenant);
  if (!sb.url || !sb.key || !token) return json({ ok: true, stored: false, reason: 'cloud_not_configured' });
  const r = await fetch(`${sb.url}/rest/v1/rpc/zalo_ingest`, {
    method: 'POST', headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_tenant: tenant, p_token: token, p_conv: conv, p_msg: msg }),
  }).catch(() => null);
  return json({ ok: true, stored: !!r?.ok });
}

/** Một số cấu hình webhook kiểm tra URL bằng GET */
export async function GET() { return json({ ok: true, service: 'zalo-webhook' }); }
