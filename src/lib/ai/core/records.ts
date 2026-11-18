import type { UserDb } from './supabase-user';
import type { AiContext, Role } from './types';

/**
 * Lớp truy cập dữ liệu CRM dùng chung cho mọi Skill.
 *
 * 3A CRM lưu dữ liệu nghiệp vụ trong MỘT bảng `public.records` (tenant_id, coll, id, data jsonb, deleted):
 *   coll = 'customers' | 'leads' | 'quotes' | 'skus' | 'activities' | 'docs' | 'kb' | 'jobs' | ...  (mỗi bản ghi 1 dòng)
 *   coll = '$'  => dữ liệu nguyên khối (id = 'budgets', 'departments', 'company', ...)
 * Mọi hàm ở đây nhận `db` là client gắn JWT người dùng (createUserClient) => RLS tự giới hạn đúng doanh nghiệp.
 *
 * LƯU Ý PHÂN QUYỀN: RLS hiện tại của `records` tách theo DOANH NGHIỆP, chưa tách theo vai trò / phòng ban
 * (app web cũng lọc "khách của tôi", "lead của phòng" ở phía ứng dụng). Vì vậy Skill PHẢI tự lọc phạm vi bằng
 * `scopeOf()` dưới đây trước khi trả dữ liệu cho LLM.
 */

export interface Me {
  /** Mã nhân sự trong app (users.id), lấy từ members.app_user_id */
  appUserId: string | null;
  dept: string | null;
  name: string | null;
}

/** Phạm vi dữ liệu người hỏi được xem */
export type Scope = { kind: 'ALL' } | { kind: 'DEPT'; dept: string } | { kind: 'SELF'; userId: string } | { kind: 'NONE'; reason: string };

/** Ai đang hỏi (gọi 1 lần mỗi tool) */
export async function whoAmI(db: UserDb, tenant: string, signal: AbortSignal): Promise<Me> {
  const { data: appUser } = await db.rpc('member_app_user', { t: tenant });
  if (!appUser) return { appUserId: null, dept: null, name: null };
  const u = await getRecord<{ dept?: string; name?: string }>(db, tenant, 'users', String(appUser), signal);
  return { appUserId: String(appUser), dept: u?.dept || null, name: u?.name ?? null };
}

/**
 * Quy tắc phạm vi giống app web: BOD / Kế toán (và vai trò trong `wide`) xem toàn doanh nghiệp,
 * Trưởng phòng xem phòng mình, còn lại xem phần được giao cho mình.
 */
export function scopeOf(ctx: AiContext, me: Me, wide: readonly Role[] = ['BOD', 'ACCOUNTANT']): Scope {
  if (ctx.platformAdmin || wide.includes(ctx.role)) return { kind: 'ALL' };
  if (ctx.role === 'DEPT_HEAD') return me.dept ? { kind: 'DEPT', dept: me.dept } : { kind: 'NONE', reason: 'Tài khoản Trưởng phòng chưa gắn phòng ban (members.app_user_id / users.dept)' };
  return me.appUserId ? { kind: 'SELF', userId: me.appUserId } : { kind: 'NONE', reason: 'Tài khoản chưa liên kết hồ sơ nhân sự trong app' };
}
/** Bản ghi có thuộc phạm vi không (dept + người phụ trách của bản ghi) */
export const inScope = (s: Scope, dept: string | undefined | null, owner: string | undefined | null) =>
  s.kind === 'ALL' || (s.kind === 'DEPT' && dept === s.dept) || (s.kind === 'SELF' && owner === s.userId);

/** Bộ lọc thêm vào câu truy vấn PostgREST (VD .eq('data->>status', 'WON')) */
type Q = ReturnType<ReturnType<UserDb['from']>['select']>;
export type Filter = (q: Q) => Q;

/**
 * Đọc cả nhóm dữ liệu, phân trang 1.000 dòng / lần (giới hạn mặc định của PostgREST).
 * `columns` mặc định 'id, data'; có thể chọn trường JSON gọn: "id, name:data->>name, phone:data->>contactPhone".
 */
export async function listRecords<T = Record<string, unknown>>(
  db: UserDb, tenant: string, coll: string,
  opts: { signal: AbortSignal; filter?: Filter; columns?: string; max?: number },
): Promise<T[]> {
  const page = 1000, max = opts.max ?? 10_000;
  const out: T[] = [];
  for (let from = 0; from < max; from += page) {
    let q = db.from('records').select(opts.columns ?? 'id, data').eq('tenant_id', tenant).eq('coll', coll).eq('deleted', false) as Q;
    if (opts.filter) q = opts.filter(q);
    const { data, error } = await q.order('id').range(from, Math.min(from + page, max) - 1).abortSignal(opts.signal);
    if (error) throw new Error(`${coll}: ${error.message}`);
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    out.push(...(opts.columns ? (rows as T[]) : rows.map((r) => ({ ...(r.data as object), id: r.id } as T))));
    if (rows.length < page) break;
  }
  return out;
}

export async function getRecord<T = Record<string, unknown>>(db: UserDb, tenant: string, coll: string, id: string, signal: AbortSignal): Promise<(T & { id: string }) | null> {
  const { data, error } = await db.from('records').select('id, data').eq('tenant_id', tenant).eq('coll', coll).eq('id', id).eq('deleted', false).abortSignal(signal).maybeSingle();
  if (error) throw new Error(`${coll}/${id}: ${error.message}`);
  const r = data as { id: string; data: T } | null;
  return r ? { ...r.data, id: r.id } : null;
}

/** Dữ liệu nguyên khối (coll '$'): data chính là giá trị (mảng / đối tượng), VD id 'departments', 'budgets' */
export async function getWhole<T>(db: UserDb, tenant: string, id: string, signal: AbortSignal): Promise<T | null> {
  const { data, error } = await db.from('records').select('data').eq('tenant_id', tenant).eq('coll', '$').eq('id', id).abortSignal(signal).maybeSingle();
  if (error) throw new Error(`$/${id}: ${error.message}`);
  return ((data as { data?: T } | null)?.data ?? null);
}

/**
 * Ghi bản ghi mới. Trigger records_touch tự gắn seq / updated_by = auth.uid(), nên app web của mọi người
 * kéo được bản ghi này ở lần đồng bộ kế tiếp. Chính sách can_write của doanh nghiệp vẫn áp dụng.
 */
export async function insertRecord(db: UserDb, tenant: string, coll: string, id: string, data: Record<string, unknown>, signal: AbortSignal): Promise<void> {
  const { error } = await db.from('records').insert({ tenant_id: tenant, coll, id, data }).abortSignal(signal);
  if (error) throw new Error(error.code === '23505' ? 'duplicate_id' : error.message);
}

/** Bỏ dấu tiếng Việt, chữ thường: so khớp tên không phụ thuộc dấu (ILIKE của Postgres phân biệt dấu) */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
export const digits = (s: string) => s.replace(/\D/g, '');
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Ngày giờ địa phương (giờ Việt Nam) dạng app dùng: YYYY-MM-DD / YYYY-MM-DDTHH:mm */
const VN_OFFSET = 7 * 3600_000;
export const vnDate = (d: Date) => new Date(d.getTime() + VN_OFFSET).toISOString().slice(0, 10);
export const vnDateTime = (d: Date) => new Date(d.getTime() + VN_OFFSET).toISOString().slice(0, 16);

export type TimeRange = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_6_months' | 'last_12_months' | 'custom';
/** Khoảng ngày [from, to) theo giờ Việt Nam + kỳ liền trước cùng độ dài để so sánh */
export function rangeOf(r: TimeRange, now: Date, custom?: { from?: string; to?: string }): { from: string; to: string; prevFrom: string; prevTo: string; label: string } {
  const today = vnDate(now);
  const [y, m] = today.split('-').map(Number);
  const ymd = (yy: number, mm: number, dd = 1) => { const d = new Date(Date.UTC(yy, mm - 1, dd)); return d.toISOString().slice(0, 10); };
  let from: string, to: string, label: string, months = 0;
  const q = Math.floor((m - 1) / 3);
  switch (r) {
    case 'this_month': from = ymd(y, m); to = ymd(y, m + 1); label = `tháng ${m}/${y}`; months = 1; break;
    case 'last_month': from = ymd(y, m - 1); to = ymd(y, m); label = `tháng trước`; months = 1; break;
    case 'this_quarter': from = ymd(y, q * 3 + 1); to = ymd(y, q * 3 + 4); label = `quý ${q + 1}/${y}`; months = 3; break;
    case 'last_quarter': from = ymd(y, q * 3 - 2); to = ymd(y, q * 3 + 1); label = 'quý trước'; months = 3; break;
    case 'this_year': from = ymd(y, 1); to = ymd(y + 1, 1); label = `năm ${y}`; months = 12; break;
    case 'last_6_months': from = ymd(y, m - 5); to = ymd(y, m + 1); label = '6 tháng gần nhất'; months = 6; break;
    case 'last_12_months': from = ymd(y, m - 11); to = ymd(y, m + 1); label = '12 tháng gần nhất'; months = 12; break;
    case 'custom': {
      if (!custom?.from || !custom?.to) throw new Error('custom_range_needs_from_to');
      from = custom.from; to = ymd(Number(custom.to.slice(0, 4)), Number(custom.to.slice(5, 7)), Number(custom.to.slice(8, 10)) + 1);
      label = `${custom.from} đến ${custom.to}`; break;
    }
  }
  // Kỳ trước: lùi đúng số tháng lịch (tháng 11 so với tháng 10, quý 4 so với quý 3); khoảng tự chọn lùi cùng số ngày
  const prevFrom = months
    ? ymd(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - months)
    : new Date(Date.parse(from) - (Date.parse(to) - Date.parse(from))).toISOString().slice(0, 10);
  return { from, to, prevFrom, prevTo: from, label };
}
