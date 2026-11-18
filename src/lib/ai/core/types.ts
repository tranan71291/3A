/**
 * Hợp đồng chung của AI Copilot. Lõi (engine, registry, provider) chỉ phụ thuộc file này;
 * mỗi Skill chỉ import từ đây và từ thư mục của chính nó => thêm / sửa / xóa Skill không chạm lõi.
 */
import type { UserDb } from './supabase-user';

/** Vai trò trong CRM (trùng members.role và type Role của app) */
export type Role = 'BOD' | 'MKT_LEAD' | 'DEPT_HEAD' | 'SALES_REP' | 'ACCOUNTANT';
export const ROLES: readonly Role[] = ['BOD', 'MKT_LEAD', 'DEPT_HEAD', 'SALES_REP', 'ACCOUNTANT'];

/** Ngữ cảnh một lượt hội thoại, dựng 1 lần ở middleware, chỉ đọc với Skill */
export interface AiContext {
  readonly userId: string;
  readonly email: string;
  readonly tenant: string;
  readonly role: Role;
  /** Quản trị 3A: xem được mọi doanh nghiệp, coi như BOD khi lọc Skill */
  readonly platformAdmin: boolean;
  /** JWT của chính người dùng: mọi truy vấn chạy dưới RLS của họ, không bao giờ service_role */
  readonly jwt: string;
  readonly locale: 'vi';
  readonly now: Date;
  readonly requestId: string;
}

/** JSON Schema rút gọn: đủ cho Claude input_schema, Gemini parameters và bộ kiểm tra đầu vào */
export type JsonSchema =
  | { type: 'object'; properties: Record<string, JsonSchema>; required?: string[]; description?: string }
  | { type: 'string'; description?: string; enum?: readonly string[]; maxLength?: number; format?: 'date' | 'date-time' }
  | { type: 'integer' | 'number'; description?: string; minimum?: number; maximum?: number }
  | { type: 'boolean'; description?: string }
  | { type: 'array'; items: JsonSchema; description?: string; maxItems?: number };

/** Dịch vụ lõi cấp cho handler; Skill không tự tạo client hay đọc biến môi trường bí mật */
export interface ToolRuntime {
  readonly ctx: AiContext;
  /** Supabase client gắn JWT người dùng (RLS áp dụng) */
  readonly db: UserDb;
  /** Tra cứu kho kiến thức, đã khóa vào các namespace Skill khai báo */
  readonly kb: KnowledgeSearch;
  readonly signal: AbortSignal;
  readonly log: (msg: string, extra?: Record<string, unknown>) => void;
}

export interface KnowledgeHit { chunkId: string; docTitle: string; namespace: string; content: string; similarity: number }
export interface KnowledgeSearch { search(query: string, opts?: { limit?: number; namespaces?: string[] }): Promise<KnowledgeHit[]> }

/** Một công cụ (function) mà LLM được gọi */
export interface SkillTool<I = Record<string, unknown>, O = unknown> {
  /** Tên ngắn trong Skill; lõi tự thêm tiền tố "<skillId>__" để không trùng giữa các Skill */
  readonly name: string;
  readonly description: string;
  readonly input: JsonSchema & { type: 'object' };
  /** Thu hẹp thêm theo vai trò ở mức tool (mặc định: theo Skill) */
  readonly roles?: readonly Role[];
  /** true = có ghi dữ liệu: lõi yêu cầu người dùng xác nhận trước khi chạy */
  readonly mutates?: boolean;
  readonly timeoutMs?: number;
  /** true = khung chưa viết xong logic: lõi không đưa cho LLM, không cho gọi (bỏ cờ khi đã điền truy vấn) */
  readonly draft?: boolean;
  readonly handler: (input: I, rt: ToolRuntime) => Promise<O>;
}

export interface SkillIntent {
  /** Từ khóa không dấu, viết thường: khớp là cộng điểm */
  readonly keywords: readonly string[];
  /** Mẫu câu (regex trên chuỗi đã bỏ dấu) */
  readonly patterns?: readonly RegExp[];
  /** Mô tả ngắn để LLM tự chọn khi bộ định tuyến không chắc */
  readonly description: string;
}

/** Bản kê khai một Skill: toàn bộ thứ Skill cần nằm trong thư mục của nó */
export interface SkillManifest {
  readonly id: string;              // snake_case, duy nhất, ổn định (dùng làm tiền tố tool)
  readonly name: string;            // tên hiển thị
  readonly version: string;         // semver, ghi vào nhật ký để truy vết câu trả lời
  readonly roles: readonly Role[];  // ai được dùng
  readonly intents: SkillIntent;
  readonly prompt: string;          // ngữ cảnh nghiệp vụ riêng, chỉ nạp khi Skill được chọn
  readonly tools: readonly SkillTool<any, any>[];
  /** Namespace kho kiến thức Skill được đọc */
  readonly knowledge?: { readonly namespaces: readonly string[] };
  /** Tắt theo doanh nghiệp (VD chỉ VASSH có quỹ 3M) */
  readonly tenants?: readonly string[];
  /** Ẩn tạm mà không xóa thư mục */
  readonly enabled?: boolean;
}

/** Tin nhắn hội thoại trung lập với nhà cung cấp */
export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export interface ToolCallTrace {
  tool: string; skill: string; ok: boolean; ms: number; error?: string;
}
export interface CopilotAnswer {
  text: string;
  skills: string[];
  tools: ToolCallTrace[];
  provider: string;
  model: string;
  usage?: { input?: number; output?: number };
  /** Thao tác ghi dữ liệu đang chờ người dùng bấm xác nhận (gửi lại lượt hỏi kèm confirmed = [tool]) */
  confirm?: { tool: string; input: Record<string, unknown> }[];
}

export class AiError extends Error {
  constructor(public code: 'unauthorized' | 'forbidden' | 'bad_request' | 'rate_limited' | 'not_configured' | 'upstream' | 'tool_failed', message: string, public status = 400) { super(message); }
}
