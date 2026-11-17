import { AnthropicProvider } from './anthropic';
import { GeminiProvider } from './gemini';
import type { LlmProvider } from './types';

/** Biến môi trường có thể thêm hậu tố __<MÃ_DOANH_NGHIỆP> (giống _lib/server.ts hiện có) */
export function envFor(name: string, tenant?: string): string {
  const t = tenant ? process.env[`${name}__${tenant.toUpperCase().replace(/-/g, '_')}`] : undefined;
  return (t ?? process.env[name] ?? '').trim();
}

/** Chọn nhà cung cấp theo cấu hình; không có khóa => null (route trả "not_configured") */
export function providerFor(tenant: string, pref: 'AUTO' | 'ANTHROPIC' | 'GEMINI' = 'AUTO'): LlmProvider | null {
  const ak = envFor('ANTHROPIC_API_KEY', tenant);
  const gk = envFor('GEMINI_API_KEY', tenant);
  const gm = envFor('GEMINI_MODEL', tenant);
  if ((pref === 'ANTHROPIC' || pref === 'AUTO') && ak) return new AnthropicProvider(ak, envFor('ANTHROPIC_MODEL', tenant) || 'claude-sonnet-5-5');
  if ((pref === 'GEMINI' || pref === 'AUTO') && gk && gm) return new GeminiProvider(gk, gm);
  return null;
}
