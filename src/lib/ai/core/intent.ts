import type { ChatTurn, SkillManifest } from './types';

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/**
 * Bộ định tuyến ý định (rẻ, chạy cục bộ, không gọi LLM):
 *  - Chấm điểm từ khóa + mẫu câu trên 1–2 câu hỏi gần nhất (giữ mạch hội thoại "còn quý sau thì sao?").
 *  - Chọn tối đa `max` Skill điểm cao nhất => system prompt và danh sách tool ngắn, LLM chọn tool chính xác hơn, rẻ hơn.
 *  - Không khớp Skill nào: đưa toàn bộ Skill được phép nhưng CHỈ kèm mô tả ngắn (không nạp prompt dài) — xem engine.
 */
export function routeIntents(history: readonly ChatTurn[], skills: readonly SkillManifest[], max = 3): { picked: SkillManifest[]; confident: boolean } {
  const users = history.filter((t) => t.role === 'user').slice(-2).map((t) => fold(t.content));
  if (!users.length) return { picked: [], confident: false };
  const scored = skills.map((s) => {
    let score = 0;
    users.forEach((u, i) => {
      const w = i === users.length - 1 ? 1 : 0.4; // câu mới nhất nặng hơn
      for (const k of s.intents.keywords) if (u.includes(k)) score += (k.includes(' ') ? 2 : 1) * w;
      for (const re of s.intents.patterns ?? []) if (re.test(u)) score += 3 * w;
    });
    return { s, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return { picked: scored.slice(0, max).map((x) => x.s), confident: scored.length > 0 && scored[0].score >= 1 };
}
