import type { UserDb } from '../../core/supabase-user';

/**
 * Lớp đọc dữ liệu riêng của Skill MDF. Đọc bảng public.records (mô hình dữ liệu hiện có của 3A CRM):
 *  - budgets  : bản ghi nguyên khối  coll = '$', id = 'budgets'  (mảng ngân sách theo năm)
 *  - programs : mỗi đề xuất 1 dòng   coll = 'programs'
 *  - claims   : mỗi hồ sơ 1 dòng     coll = 'claims'
 * Truy vấn chạy bằng client gắn JWT người dùng => RLS tự giới hạn đúng doanh nghiệp họ thuộc về.
 * Skill khác không import file này: đổi cấu trúc dữ liệu MDF chỉ sửa ở đây.
 */
export interface Budget { vendor: string; vendorCode: string; fiscalYear: number; mdfTotal: number; csTotal: number; total: number; spent: number; committed: number; periodStart: string; periodEnd: string; allocations?: Record<string, number>; declared?: boolean }
export interface Program { id: string; code: string; title: string; type: string; dept: string; requested: number; sharePct: number; held: number; start: string; end: string; status: string; customerId?: string; claimId?: string }
export interface Claim { id: string; code: string; programTitle: string; programType: string; dept: string; claimed: number; cap: number; daysLeft: number; submitted: boolean; vendorApproved?: number; creditNote?: { amount: number }; invoice: unknown | null }

async function rows<T>(db: UserDb, tenant: string, coll: string, signal: AbortSignal): Promise<T[]> {
  const { data, error } = await db.from('records').select('data').eq('tenant_id', tenant).eq('coll', coll).eq('deleted', false).abortSignal(signal).limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { data: unknown }) => r.data as T);
}

export async function loadBudgets(db: UserDb, tenant: string, signal: AbortSignal): Promise<Budget[]> {
  const { data, error } = await db.from('records').select('data').eq('tenant_id', tenant).eq('coll', '$').eq('id', 'budgets').abortSignal(signal).maybeSingle();
  if (error) throw new Error(error.message);
  return Array.isArray((data as { data?: unknown } | null)?.data) ? ((data as { data: Budget[] }).data) : [];
}
export const loadPrograms = (db: UserDb, tenant: string, signal: AbortSignal) => rows<Program>(db, tenant, 'programs', signal);
export const loadClaims = (db: UserDb, tenant: string, signal: AbortSignal) => rows<Claim>(db, tenant, 'claims', signal);

/** Phòng ban của người đang hỏi (members.app_user_id -> hồ sơ nhân sự) để Trưởng phòng chỉ thấy phòng mình */
export async function myDept(db: UserDb, tenant: string, signal: AbortSignal): Promise<string | null> {
  const { data: appUser } = await db.rpc('member_app_user', { t: tenant });
  if (!appUser) return null;
  const { data } = await db.from('records').select('data').eq('tenant_id', tenant).eq('coll', 'users').eq('id', String(appUser)).abortSignal(signal).maybeSingle();
  return ((data as { data?: { dept?: string } } | null)?.data?.dept) ?? null;
}
