import { authorize, json, rateLimited, readJson } from '../../_lib/server';
import { callAi, type AiProvider } from '../../_lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const SYSTEM = `Bạn là công cụ bóc tách dữ liệu cho báo giá vật tư điện công nghiệp.
Đọc tài liệu (ảnh chụp, bản scan, viết tay, PDF dự toán / BOQ / phiếu yêu cầu) và CHỈ trả về một đối tượng JSON, không thêm chữ nào khác:
{"items":[{"name":"...","unit":"...","qty":0,"price":null}]}
Quy tắc:
- Mỗi dòng hàng hóa / vật tư là một phần tử. Giữ nguyên tên hàng và quy cách như trong tài liệu (mã, model, kích thước, dòng điện, số cực, hãng), không dịch, không tự thêm.
- Gộp các cột mô tả, mã hiệu, quy cách, hãng của cùng một dòng vào "name".
- "unit": đơn vị tính như trong tài liệu (cái, bộ, m, cuộn, tủ…); không có thì để chuỗi rỗng.
- "qty": số lượng dạng số. Số kiểu Việt Nam: 1.000 = 1000, 2,5 = 2.5. Không đọc rõ thì để 1.
- "price": chỉ điền khi tài liệu có cột đơn giá cho dòng đó, ngược lại null.
- Bỏ qua dòng tiêu đề, dòng nhóm / hạng mục không có số lượng, dòng tổng cộng, VAT, chữ ký, ghi chú.
- Tối đa 300 dòng. Không có bảng vật tư thì trả về {"items":[]}.`;

type Item = { name: string; unit: string; qty: number; price: number | null };

/** Số từ AI: số thật, hoặc chuỗi kiểu Việt Nam (1.500 = 1500; 2,5 = 2.5) */
function num(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/\s|đ|vnđ|vnd/gi, '');
  if (!/^-?[\d.,]+$/.test(s)) return NaN;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  if (s.includes(',') && s.includes('.')) return Number(s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''));
  return Number(s.replace(',', '.'));
}

function parseItems(text: string): Item[] {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = m ? m[1] : text.slice(Math.max(0, text.indexOf('{')), text.lastIndexOf('}') + 1);
  let d: unknown;
  try { d = JSON.parse(body); } catch { return []; }
  const arr = Array.isArray(d) ? d : Array.isArray((d as { items?: unknown })?.items) ? (d as { items: unknown[] }).items : [];
  return arr.slice(0, 300).map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    const qty = num(o.qty);
    const price = o.price === null || o.price === undefined || o.price === '' ? null : num(o.price);
    return { name: String(o.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 300), unit: String(o.unit ?? '').trim().slice(0, 20), qty: Number.isFinite(qty) && qty > 0 ? qty : 1, price: price !== null && Number.isFinite(price) && price > 0 ? price : null };
  }).filter((x) => x.name.length >= 2);
}

/** POST /api/ai/extract — bóc tách ảnh / PDF danh sách vật tư thành dòng báo giá (Claude: ảnh + PDF; OpenAI: ảnh) */
export async function POST(req: Request) {
  const body = await readJson<{ tenant: string; provider?: AiProvider | 'AUTO'; file?: { mediaType: string; data: string } }>(req, 12_000_000);
  if (!body?.file || !TYPES.includes(body.file.mediaType) || typeof body.file.data !== 'string' || !body.file.data || body.file.data.length > 11_500_000) return json({ ok: false, error: 'bad_request' }, 400);
  const who = await authorize(req, String(body.tenant ?? ''));
  if (who instanceof Response) return who;
  if (rateLimited(`extract:${who.userId}`, Number(process.env.AI_EXTRACT_RATE_PER_MIN ?? 6))) return json({ ok: false, error: 'rate_limited' }, 429);
  const provider = body.provider === 'ANTHROPIC' || body.provider === 'OPENAI' ? body.provider : 'AUTO';
  const r = await callAi({ provider, system: SYSTEM, image: body.file, maxTokens: 4096, messages: [{ role: 'user', content: 'Bóc tách bảng vật tư trong tài liệu đính kèm theo đúng định dạng JSON đã yêu cầu.' }] }, body.tenant);
  if (!r.ok) return json(r, r.status ?? 502);
  const items = parseItems(r.text);
  if (!items.length) return json({ ok: false, error: 'no_items', provider: r.provider, model: r.model }, 422);
  return json({ ok: true, items, provider: r.provider, model: r.model });
}
