import { createUserClient } from './supabase-user';
import { AiError, ROLES, type AiContext, type Role } from './types';

const TENANT_RE = /^[a-z0-9_-]{2,40}$/;

/**
 * Middleware ngữ cảnh: Request -> AiContext.
 * 1. Lấy JWT từ header Authorization (app gửi access_token của phiên Supabase, như apiPost hiện có).
 * 2. Supabase xác thực JWT (auth.getUser) — chữ ký, hạn dùng đều do Supabase kiểm.
 * 3. my_access(): user có thuộc doanh nghiệp không / có phải quản trị 3A.
 * 4. member_role(tenant): vai trò lưu ở members.role (Giám đốc gán khi tạo tài khoản).
 * Không tin bất kỳ "role" nào client tự gửi lên.
 */
export async function resolveAiContext(req: Request, tenant: string): Promise<AiContext> {
  if (!TENANT_RE.test(tenant)) throw new AiError('bad_request', 'tenant_invalid');
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) throw new AiError('unauthorized', 'missing_token', 401);
  const db = createUserClient(jwt);

  const { data: u, error: ue } = await db.auth.getUser(jwt);
  if (ue || !u?.user) throw new AiError('unauthorized', 'invalid_token', 401);

  const { data: access, error: ae } = await db.rpc('my_access');
  if (ae) throw new AiError('upstream', ae.message, 502);
  const rows = (access ?? []) as { tenant_id: string; platform: boolean; is_admin: boolean }[];
  const platformAdmin = rows.some((r) => r.platform);
  if (!platformAdmin && !rows.some((r) => r.tenant_id === tenant)) throw new AiError('forbidden', 'not_a_member', 403);

  let role: Role = 'SALES_REP';
  if (platformAdmin) role = 'BOD';
  else {
    const { data: r } = await db.rpc('member_role', { t: tenant });
    // Tài khoản cũ chưa gán vai trò: quản trị doanh nghiệp coi như BOD, còn lại quyền thấp nhất
    role = ROLES.includes(r as Role) ? (r as Role) : rows.find((x) => x.tenant_id === tenant)?.is_admin ? 'BOD' : 'SALES_REP';
  }
  return { userId: u.user.id, email: u.user.email ?? '', tenant, role, platformAdmin, jwt, locale: 'vi', now: new Date(), requestId: crypto.randomUUID() };
}
