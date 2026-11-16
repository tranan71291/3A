'use client';

import { DEMO_PASSWORD, fromB64, PBKDF2_ITER, safeEqual, subtle, te, toB64 } from './core';
import type { AnyRec, EncryptedBackup, SecurityPolicy, User } from './types';

export async function pbkdf2(secret: string, salt: Uint8Array, bits = 256): Promise<Uint8Array> {
  const key = await subtle().importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITER }, key, bits));
}

export async function hashPassword(pw: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltB64 ? fromB64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  return { hash: toB64(await pbkdf2(pw, salt)), salt: toB64(salt) };
}

export async function verifyPassword(u: User, pw: string): Promise<boolean> {
  if (!u.passwordHash || !u.salt) return safeEqual(pw, DEMO_PASSWORD);
  return safeEqual((await hashPassword(pw, u.salt)).hash, u.passwordHash);
}

export function passwordIssues(pw: string, policy: SecurityPolicy, email = ''): string[] {
  const out: string[] = [];
  if (pw.length < policy.minPasswordLength) out.push(`Tối thiểu ${policy.minPasswordLength} ký tự`);
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) out.push('Có cả chữ và số');
  if (!/[A-Z]/.test(pw)) out.push('Có ít nhất 1 chữ hoa');
  if (pw === DEMO_PASSWORD || /^(.)\1+$/.test(pw) || ['12345678', 'password', 'matkhau123'].includes(pw.toLowerCase())) out.push('Không dùng mật khẩu phổ biến / mặc định');
  if (email && pw.toLowerCase().includes(email.split('@')[0].toLowerCase())) out.push('Không chứa tên email');
  return out;
}

export async function encryptBackup(obj: unknown, pass: string, v: number): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await subtle().importKey('raw', (await pbkdf2(pass, salt)) as BufferSource, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, te.encode(JSON.stringify(obj))));
  return { format: 'vassh-backup', v, enc: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter: PBKDF2_ITER, salt: toB64(salt), iv: toB64(iv), data: toB64(ct), exportedAt: Date.now() };
}

export async function decryptBackup(b: EncryptedBackup, pass: string): Promise<AnyRec> {
  const key = await subtle().importKey('raw', (await pbkdf2(pass, fromB64(b.salt))) as BufferSource, 'AES-GCM', false, ['decrypt']);
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(b.iv) as BufferSource }, key, fromB64(b.data) as BufferSource);
    return JSON.parse(new TextDecoder().decode(pt)) as AnyRec;
  } catch {
    throw new Error('Sai mật khẩu bản sao lưu hoặc file đã bị sửa');
  }
}

