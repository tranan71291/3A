import type { AiContext, Role, SkillManifest, SkillTool } from './types';

/** Tên tool hợp lệ cho cả Claude và Gemini */
const TOOL_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;
export const SEP = '__';

export interface ResolvedTool { fullName: string; skill: SkillManifest; tool: SkillTool<any, any> }

/**
 * SkillRegistry — nơi duy nhất biết danh sách Skill.
 *  - Nạp danh sách từ skills/_generated.ts (sinh tự động bằng scripts/gen-skill-index.mjs khi build),
 *    nên thêm Skill = thêm thư mục, không sửa file lõi nào.
 *  - Kiểm tra bản kê khai khi khởi động (fail fast): trùng id, tên tool sai, tool không có quyền…
 *  - Lọc theo vai trò + doanh nghiệp + trạng thái bật. Lọc lần 2 ngay trước khi chạy tool (phòng thủ nhiều lớp).
 *  - Không giữ trạng thái theo người dùng: một instance dùng chung an toàn cho mọi request.
 */
export class SkillRegistry {
  private readonly skills = new Map<string, SkillManifest>();
  private readonly tools = new Map<string, ResolvedTool>();

  constructor(manifests: readonly SkillManifest[]) {
    for (const m of manifests) this.register(m);
  }

  private register(m: SkillManifest) {
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(m.id)) throw new Error(`skill_id_invalid:${m.id}`);
    if (this.skills.has(m.id)) throw new Error(`skill_duplicate:${m.id}`);
    if (!m.roles.length) throw new Error(`skill_without_roles:${m.id}`);
    for (const t of m.tools) {
      const full = `${m.id}${SEP}${t.name}`;
      if (!TOOL_NAME_RE.test(full)) throw new Error(`tool_name_invalid:${full}`);
      if (this.tools.has(full)) throw new Error(`tool_duplicate:${full}`);
      if (t.roles?.some((r) => !m.roles.includes(r))) throw new Error(`tool_role_wider_than_skill:${full}`);
      if (t.input.type !== 'object') throw new Error(`tool_input_not_object:${full}`);
      this.tools.set(full, { fullName: full, skill: m, tool: t });
    }
    this.skills.set(m.id, m);
  }

  /** Skill người dùng được phép dùng (chưa xét câu hỏi) */
  available(ctx: Pick<AiContext, 'role' | 'tenant'>): SkillManifest[] {
    return [...this.skills.values()].filter((s) => s.enabled !== false && allows(s.roles, ctx.role) && (!s.tenants || s.tenants.includes(ctx.tenant)));
  }

  /** Tool của các Skill đã chọn mà vai trò này được gọi */
  toolsFor(skills: readonly SkillManifest[], role: Role): ResolvedTool[] {
    return skills.flatMap((s) => s.tools.filter((t) => !t.draft && allows(t.roles ?? s.roles, role)).map((t) => this.tools.get(`${s.id}${SEP}${t.name}`)!));
  }

  /** Tra tool theo tên đầy đủ LLM gửi về; trả null nếu không tồn tại HOẶC vai trò không được dùng */
  resolve(fullName: string, ctx: Pick<AiContext, 'role' | 'tenant'>): ResolvedTool | null {
    const r = this.tools.get(fullName);
    if (!r) return null;
    const okSkill = r.skill.enabled !== false && allows(r.skill.roles, ctx.role) && (!r.skill.tenants || r.skill.tenants.includes(ctx.tenant));
    return okSkill && !r.tool.draft && allows(r.tool.roles ?? r.skill.roles, ctx.role) ? r : null;
  }

  get(id: string) { return this.skills.get(id); }
  list() { return [...this.skills.values()]; }
}

const allows = (roles: readonly Role[], role: Role) => roles.includes(role);
