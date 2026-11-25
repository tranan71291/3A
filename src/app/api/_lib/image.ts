/**
 * v56.0.1 Mô hình tạo ảnh (OpenAI Images) dùng chung cho /api/ai/image và /api/integrations.
 *  - 2 chế độ: 'fast' (mặc định, gpt-image-2.5-flare) và 'detail' (chi tiết cao / chỉnh sửa sâu, gpt-image-2.5-sunburst).
 *  - Ghi đè bằng biến môi trường: OPENAI_IMAGE_MODEL (nhanh), OPENAI_IMAGE_MODEL_DETAIL (chi tiết cao); theo doanh nghiệp: thêm __MA_DN.
 *  - Tên mô hình OpenAI đã ngừng (gpt-image-1, dall-e-2/3…) đặt trong biến môi trường tự đổi sang mô hình hiện hành, báo lại cho Cài đặt.
 *  - Kiểm tra mô hình còn dùng được: GET /v1/models/{id}, lưu kết quả 10 phút (không tạo ảnh, không tốn phí).
 */
import { envFor } from './server';

export type ImageMode = 'fast' | 'detail';

export const IMAGE_DEFAULT: Record<ImageMode, string> = { fast: 'gpt-image-2.5-flare', detail: 'gpt-image-2.5-sunburst' };

/** Mô hình OpenAI đã ngừng cung cấp (gpt-image-1 ngừng 23/10/2026) */
export const IMAGE_RETIRED = /^(gpt-image-1(\.5)?(-mini)?(-\d{4}-\d{2}-\d{2})?|dall-e-[23])$/;

export type ImageModelPick = { model: string; configured: string; retired: boolean };

export function imageModel(mode: ImageMode, tenant?: string): ImageModelPick {
  const configured = envFor(mode === 'detail' ? 'OPENAI_IMAGE_MODEL_DETAIL' : 'OPENAI_IMAGE_MODEL', tenant);
  const retired = !!configured && IMAGE_RETIRED.test(configured);
  return { model: configured && !retired ? configured : IMAGE_DEFAULT[mode], configured, retired };
}

export type ModelCheck = { id: string; ok: boolean; error?: string; at: number };
const cache = new Map<string, ModelCheck>();

/** Hỏi OpenAI mô hình có tồn tại / tài khoản có quyền dùng không. Lỗi mạng không lưu cache */
export async function checkImageModel(key: string, id: string): Promise<ModelCheck> {
  const ck = `${key.slice(-8)}|${id}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < 600_000) return hit;
  try {
    const r = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } });
    const d = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
    const res: ModelCheck = r.ok ? { id, ok: true, at: Date.now() } : { id, ok: false, error: imageErrCode(r.status, d.error?.message ?? ''), at: Date.now() };
    cache.set(ck, res);
    return res;
  } catch {
    return { id, ok: false, error: 'image_network', at: Date.now() };
  }
}

/** Mã lỗi ổn định (app dịch sang tiếng Việt) từ phản hồi OpenAI */
export function imageErrCode(status: number, msg: string): string {
  const m = msg.toLowerCase();
  if (/must be verified|verify your organization|organization verification/.test(m)) return 'image_org_unverified';
  if (/does not exist|not found|no longer available|shut down|deprecated|model_not_found/.test(m) || status === 404) return 'image_model_unavailable';
  if (/billing|quota|insufficient|exceeded your current/.test(m) || status === 402) return 'image_billing';
  if (/safety|moderation|content policy|rejected/.test(m)) return 'image_policy';
  if (status === 401) return 'image_key_invalid';
  if (status === 403) return 'image_forbidden';
  if (status === 429) return 'image_rate_limited';
  return msg ? `openai: ${msg.slice(0, 200)}` : `openai_${status}`;
}
