import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client "đội lốt" người dùng đang đăng nhập.
 *  - Dùng khóa anon/publishable (công khai) + header Authorization: Bearer <JWT của user>.
 *  - PostgREST đọc JWT => auth.uid() = user => mọi policy RLS (tách doanh nghiệp, vai trò, tin nhắn riêng…) áp dụng y như trên app.
 *  - KHÔNG BAO GIỜ dùng SUPABASE_SERVICE_ROLE_KEY trong đường đi của AI: AI chỉ thấy đúng những gì người hỏi được thấy.
 *  - Mỗi request tạo client mới (không lưu phiên, không chia sẻ giữa người dùng).
 */
export type UserDb = SupabaseClient;

export function supabaseEnv() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !anon) throw new Error('supabase_not_configured');
  if (anon.startsWith('sb_secret_') || /service_role/.test(decodeJwtRole(anon))) throw new Error('refusing_service_role_key');
  return { url, anon };
}

export function createUserClient(jwt: string): UserDb {
  const { url, anon } = supabaseEnv();
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Đọc claim "role" của một JWT (chỉ để chặn nhầm khóa service_role, không dùng để xác thực) */
function decodeJwtRole(token: string): string {
  const part = token.split('.')[1];
  if (!part) return '';
  try { return String((JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { role?: string }).role ?? ''); } catch { return ''; }
}
