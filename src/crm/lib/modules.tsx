'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Database, Eye, EyeOff, Factory, KeyRound, LogIn, Mail, RefreshCw } from 'lucide-react';
import { Logo3A } from '../app/header';
import { BRAND, BUSINESS_PROFILE, CLOUD_ON, DATA_VERSION, GRAD, LOGIN_SLIDES, orgByEmail, orgOf, ORGS, PLATFORM_DOMAIN } from './core';
import type { CompanyInfo, User } from './types';
import { cn } from './utils';

/** Minh họa line-art cho slider trang đăng nhập (không dùng ảnh giả lập dự án thật) */
export function LoginArt({ kind, accent }: { kind: 'lead' | 'mdf' | 'mfg' | 'center'; accent: string }) {
  const st = { fill: 'none', stroke: 'rgba(255,255,255,.22)', strokeWidth: 1.2 };
  const hi = { fill: 'none', stroke: 'url(#lgA)', strokeWidth: 2.2, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="0 0 420 260" className="h-auto w-full max-w-[460px]" aria-hidden>
      <defs>
        <linearGradient id="lgA" x1="0" x2="1"><stop offset="0" stopColor={BRAND.o1} /><stop offset=".55" stopColor={BRAND.o2} /><stop offset="1" stopColor={BRAND.o3} /></linearGradient>
        <linearGradient id="lgB" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={accent} stopOpacity=".35" /><stop offset="1" stopColor={accent} stopOpacity="0" /></linearGradient>
      </defs>
      {kind === 'lead' && <>
        <rect x="20" y="105" width="96" height="50" rx="6" {...st} /><text x="68" y="135" textAnchor="middle" fill="#CBD5E1" fontSize="12">Lead MKT</text>
        {[40, 120, 200].map((y, i) => <g key={y}><path d={`M116 130 C170 130 170 ${y + 25} 222 ${y + 25}`} {...hi} strokeDasharray="5 6"><animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.4s" repeatCount="indefinite" /></path>
          <rect x="222" y={y} width="176" height="50" rx="6" {...st} /><text x="236" y={y + 22} fill="#E2E8F0" fontSize="12">{['Dự án M&E', 'Kinh doanh thương mại', 'Kênh đại lý'][i]}</text><text x="236" y={y + 39} fill="#94A3B8" fontSize="10">Tiếp nhận ≤ 2 giờ</text><circle cx="384" cy={y + 25} r="6" fill="none" stroke={accent} strokeWidth="2" /></g>)}
      </>}
      {kind === 'mdf' && <>
        {['Ngân sách', 'Pre-Approval', 'POP', 'Claim', 'ROI'].map((l, i) => <g key={l}><circle cx={40 + i * 85} cy="80" r="18" fill={i < 3 ? 'url(#lgA)' : 'none'} stroke={i < 3 ? 'none' : 'rgba(255,255,255,.3)'} /><text x={40 + i * 85} y="85" textAnchor="middle" fill={i < 3 ? '#0F141E' : '#CBD5E1'} fontSize="12" fontWeight="700">{i + 1}</text><text x={40 + i * 85} y="122" textAnchor="middle" fill="#CBD5E1" fontSize="11">{l}</text>{i < 4 && <path d={`M${60 + i * 85} 80h45`} stroke="rgba(255,255,255,.25)" strokeWidth="1.5" />}</g>)}
        <path d="M30 230 L90 200 L150 210 L210 170 L270 180 L330 140 L390 150" {...hi} /><path d="M30 230 L90 200 L150 210 L210 170 L270 180 L330 140 L390 150 V245 H30Z" fill="url(#lgB)" />
      </>}
      {kind === 'mfg' && <>
        <rect x="40" y="30" width="140" height="190" rx="3" {...st} /><path d="M110 30v190M40 125h140" {...st} /><rect x="52" y="42" width="46" height="71" fill={`${accent}22`} /><rect x="122" y="137" width="46" height="71" fill={`${accent}22`} />
        {['Khảo sát & đo đạc', 'Báo giá m² / md', 'Sản xuất', 'Lắp đặt & nghiệm thu', 'Thu tiền & bảo hành'].map((l, i) => <g key={l}><circle cx="226" cy={44 + i * 42} r="7" fill={i < 3 ? accent : 'none'} stroke={accent} strokeWidth="2" /><text x="244" y={48 + i * 42} fill="#E2E8F0" fontSize="12">{l}</text>{i < 4 && <path d={`M226 ${52 + i * 42}v26`} stroke="rgba(255,255,255,.25)" />}</g>)}
      </>}
      {kind === 'center' && <>
        <rect x="20" y="20" width="380" height="220" rx="8" {...st} /><rect x="20" y="20" width="56" height="220" rx="8" fill="rgba(255,255,255,.04)" />
        {[0, 1, 2].map((i) => <g key={i}><rect x={92 + i * 102} y="36" width="92" height="52" rx="4" fill="rgba(255,255,255,.04)" /><rect x={100 + i * 102} y="46" width="40" height="6" rx="3" fill="rgba(255,255,255,.25)" /><rect x={100 + i * 102} y="60" width="60" height="12" rx="3" fill={i === 0 ? 'url(#lgA)' : 'rgba(255,255,255,.5)'} /></g>)}
        {[60, 90, 75, 120, 100, 150, 135].map((h, i) => <rect key={i} x={100 + i * 26} y={226 - h} width="16" height={h} rx="2" fill={i > 4 ? 'url(#lgA)' : accent} opacity={i > 4 ? 1 : 0.8} />)}
        <rect x="300" y="104" width="88" height="122" rx="4" fill="rgba(255,255,255,.04)" />{[0, 1, 2, 3].map((i) => <rect key={i} x="308" y={114 + i * 26} width={70 - i * 10} height="8" rx="4" fill={i === 0 ? '#EF4444' : 'rgba(255,255,255,.2)'} />)}
        {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx="48" cy={50 + i * 34} r="7" fill={i === 1 ? accent : 'rgba(255,255,255,.18)'} />)}
      </>}
    </svg>
  );
}

/** Trang đăng nhập dạng chia đôi: form kính mờ phát sáng theo màu doanh nghiệp + slider giới thiệu 3A Group */
export function LoginScreen({ company, onLogin, idleOut, dataLocked, orgId, onOrg, platformHint }: { users: User[]; company: CompanyInfo; onLogin: (email: string, password: string, remember: boolean) => Promise<string | null>; idleOut: number; dataLocked: number | null; orgId: string; onOrg: (org: string) => void; platformHint?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  // Gợi ý tài khoản demo chỉ hiện khi còn tài khoản dùng mật khẩu khởi tạo
  // Màu phát sáng theo phân nhánh: cam VASSH, xanh dương ALUX
  const accent = orgId === 'alux' ? BRAND.blue : BRAND.o2;
  const accentHi = orgId === 'alux' ? BRAND.blueHi : BRAND.o3;
  const slides = [...LOGIN_SLIDES.filter((x) => x.org === orgId), ...LOGIN_SLIDES.filter((x) => x.org !== orgId)];
  useEffect(() => { setSlide(0); }, [orgId]);
  useEffect(() => {
    if (paused || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) return;
    const t = window.setInterval(() => setSlide((x) => (x + 1) % slides.length), 6000);
    return () => window.clearInterval(t);
  }, [paused, slides.length]);
  const cur = slides[slide] ?? slides[0];

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const err = await onLogin(email, password, remember);
    setBusy(false);
    if (err) { setError(err); setPassword(''); }
  };
  const field = 'peer h-12 w-full rounded-md border border-[rgb(var(--ink)/0.1)] bg-[#070B12]/70 pl-11 pr-3 text-[15px] text-[rgb(var(--fg))] placeholder:text-[rgb(var(--faint))] transition-[border-color,box-shadow] focus:outline-none';
  const focusRing = { '--acc': accent } as CSSProperties;

  return (
    <div className="relative grid min-h-screen bg-[#070B12] text-[rgb(var(--fg))] lg:grid-cols-[5fr_7fr]" style={focusRing}>
      <style>{`.login-field:focus{border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 25%,transparent)}.login-field:focus~.login-ico{color:var(--acc)}.login-btn{box-shadow:0 10px 30px -8px color-mix(in srgb,var(--acc) 70%,transparent)}.login-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 16px 40px -8px color-mix(in srgb,var(--acc) 85%,transparent);filter:brightness(1.08)}.login-btn:active:not(:disabled){transform:translateY(0) scale(.99)}.login-btn:hover .login-arrow{transform:translateX(4px)}`}</style>
      {/* ---------- Bên trái: form ---------- */}
      <section className="relative flex flex-col justify-center overflow-hidden px-5 py-10 sm:px-10">
        <div className="pointer-events-none absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full opacity-40 blur-[110px] transition-colors duration-700" style={{ background: accent }} aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[320px] w-[320px] rounded-full opacity-20 blur-[100px]" style={{ background: accentHi }} aria-hidden />
        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="mb-7 flex items-center gap-3">
            <Logo3A size={40} />
            <div className="min-w-0">
              <p className="font-display text-xl font-extrabold tracking-tight">3A GROUP</p>
              <p className="truncate text-xs text-[rgb(var(--muted))]">Enterprise Command Center · {company.appName}</p>
            </div>
          </div>
          {idleOut > 0 && <p className="mb-3 rounded-md border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.1)] px-4 py-3 text-sm text-[rgb(var(--accent-fg))]" role="status">Phiên làm việc đã tự đăng xuất sau {idleOut} phút không thao tác.</p>}
          {dataLocked && <p className="mb-3 rounded-md border border-[rgb(var(--danger)/0.4)] bg-[rgb(var(--danger)/0.1)] px-4 py-3 text-sm text-[rgb(var(--danger-fg))]" role="alert">Dữ liệu trên máy này thuộc phiên bản {dataLocked}, mới hơn bản app đang chạy ({DATA_VERSION}). App sẽ không ghi đè để tránh mất dữ liệu; hãy cập nhật file app mới nhất.</p>}

          {/* Thẻ kính mờ, viền sáng chuyển màu theo doanh nghiệp đang chọn */}
          <div className="rounded-xl p-px transition-[background] duration-500" style={{ background: `linear-gradient(140deg, ${accent}AA, rgba(255,255,255,.08) 40%, rgba(255,255,255,.04) 60%, ${accentHi}66)` }}>
            <form className="space-y-5 rounded-[11px] bg-[#0D131F]/80 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,.7)] backdrop-blur-xl sm:p-7" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight">Đăng nhập</h1>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">Chọn phân nhánh và đăng nhập bằng tài khoản công ty.</p>
              </div>
              <div role="radiogroup" aria-label="Phân nhánh doanh nghiệp" className="grid grid-cols-2 gap-2.5">
                {ORGS.map((o) => {
                  const on = orgId === o.id;
                  const c = o.id === 'alux' ? BRAND.blue : BRAND.o2;
                  const Icon = o.profile === 'MANUFACTURING' ? Factory : Building2;
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => { onOrg(o.id); setError(''); }}
                      className="rounded-lg p-px text-left transition-[background,transform] duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ink)/0.4)]"
                      style={{ background: on ? (o.id === 'alux' ? `linear-gradient(135deg, ${BRAND.blueHi}, ${BRAND.blue})` : `linear-gradient(135deg, ${BRAND.o1}, ${BRAND.o2}, ${BRAND.o3})`) : 'rgba(255,255,255,.08)' }}>
                      <span className={cn('flex h-full items-center gap-3 rounded-[7px] px-3 py-3 transition-colors duration-300', on ? 'bg-[#0D131F]/85' : 'bg-[rgb(var(--sunken))]')}>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors duration-300" style={{ background: on ? c : `${c}1F`, color: on ? '#0F141E' : c }}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
                        <span className="min-w-0"><span className="block text-sm font-bold">{o.shortName}</span><span className="block truncate text-[11px] text-[rgb(var(--muted))]">{BUSINESS_PROFILE[o.profile].label}</span></span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">Email công ty</span>
                <span className="relative block">
                  <input className={cn(field, 'login-field')} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => { const o = orgByEmail(email); if (o) onOrg(o.id); }} placeholder={`ten@${orgOf(orgId).domain}`} />
                  <Mail className="login-ico pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[rgb(var(--faint))] transition-colors" aria-hidden />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">Mật khẩu</span>
                <span className="relative block">
                  <input className={cn(field, 'login-field pr-12')} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  <KeyRound className="login-ico pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[rgb(var(--faint))] transition-colors" aria-hidden />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] hover:text-[rgb(var(--fg))]" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-sm text-[rgb(var(--fg2))]"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: accent }} checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span>Ghi nhớ đăng nhập trên máy này<span className="block text-xs text-[rgb(var(--faint))]">Không chọn khi dùng máy chung</span></span></label>
              {error && <p className="rounded-md border border-[rgb(var(--danger)/0.4)] bg-[rgb(var(--danger)/0.1)] px-3 py-2 text-sm text-[rgb(var(--danger-fg))]" role="alert">{error}</p>}
              <button type="submit" disabled={busy || !email || !password}
                className="login-btn flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-bold text-[rgb(var(--on-accent))] transition-[transform,box-shadow,filter] duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: orgId === 'alux' ? `linear-gradient(100deg, ${BRAND.blueHi}, ${BRAND.blue})` : GRAD, color: orgId === 'alux' ? '#fff' : '#0F141E' }}>
                {busy ? <><RefreshCw className="h-4 w-4 motion-safe:animate-spin" aria-hidden />Đang xác thực...</> : <><LogIn className="h-4 w-4" aria-hidden />Đăng nhập<ArrowRight className="login-arrow h-4 w-4 transition-transform duration-200" aria-hidden /></>}
              </button>
              {CLOUD_ON && <p className="flex items-center justify-center gap-1.5 text-[11px] text-[rgb(var(--muted))]"><Database className="h-3 w-3" aria-hidden />Dữ liệu lưu trên máy chủ, dùng chung cho cả công ty. Quên mật khẩu: nhờ Giám đốc cấp lại.</p>}
            </form>
          </div>

          {platformHint && (
            <button type="button" className="mt-4 flex w-full items-center gap-3 rounded-lg border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--ink)/0.03)] p-3.5 text-left backdrop-blur hover:border-[rgb(var(--accent)/0.5)] hover:bg-[rgb(var(--accent)/0.05)]" onClick={() => { setEmail(`admin@${PLATFORM_DOMAIN}`); setPassword(''); setError(''); }}>
              <Logo3A size={28} />
              <span className="min-w-0 text-sm"><b className="block">3A Platform Console (Super Admin)</b><span className="text-xs text-[rgb(var(--muted))]">admin@{PLATFORM_DOMAIN}: quản trị doanh nghiệp, cấp phép module, dữ liệu</span></span>
            </button>
          )}
          <p className="mt-8 text-center text-[11px] text-[rgb(var(--faint))]">© {new Date().getFullYear()} 3A Group Vietnam JSC · Kết nối được mã hóa</p>
        </div>
      </section>

      {/* ---------- Bên phải: slider giới thiệu ---------- */}
      <section className="relative hidden overflow-hidden border-l border-[rgb(var(--ink)/0.06)] lg:flex lg:flex-col" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel" aria-label="Giới thiệu nền tảng 3A Group">
        <div className="absolute inset-0 transition-[background] duration-700" style={{ background: `radial-gradient(900px 600px at 70% 20%, ${accent}33, transparent 60%), radial-gradient(700px 500px at 10% 100%, ${BRAND.o1}22, transparent 60%), linear-gradient(180deg, #0B1220, #070B12)` }} aria-hidden />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(circle at 60% 40%, black, transparent 75%)' }} aria-hidden />
        <div className="relative flex flex-1 flex-col justify-center px-12 py-12 xl:px-20">
          <div key={`${orgId}-${slide}`} className="motion-safe:animate-[popIn_.5s_ease-out]" role="group" aria-roledescription="slide" aria-label={`${slide + 1} / ${slides.length}: ${cur.title}`}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--ink)/0.04)] px-3 py-1 text-xs font-semibold" style={{ color: accentHi }}><i className="h-1.5 w-1.5 rounded-full" style={{ background: accentHi }} />{cur.tag}</span>
            <h2 className="font-display mt-5 max-w-xl text-4xl font-extrabold leading-[1.1] tracking-tight xl:text-5xl">{cur.title}</h2>
            <p className="mt-4 max-w-lg text-base text-[rgb(var(--muted))]">{cur.desc}</p>
            <div className="mt-8"><LoginArt kind={cur.kind} accent={accent} /></div>
            <ul className="mt-8 grid max-w-2xl gap-3 xl:grid-cols-3">
              {cur.points.map((p) => <li key={p} className="rounded-lg border border-[rgb(var(--ink)/0.08)] bg-[rgb(var(--ink)/0.03)] px-4 py-3 text-sm text-[rgb(var(--fg2))] backdrop-blur"><CheckCircle2 className="mb-1.5 h-4 w-4" style={{ color: accentHi }} aria-hidden />{p}</li>)}
            </ul>
          </div>
        </div>
        <div className="relative flex items-center gap-3 px-12 pb-10 xl:px-20">
          {slides.map((x, i) => <button key={x.title} onClick={() => setSlide(i)} aria-label={`Xem ${x.title}`} aria-current={i === slide} className="h-1.5 rounded-full transition-all duration-300" style={{ width: i === slide ? 36 : 12, background: i === slide ? accentHi : 'rgba(255,255,255,.2)' }} />)}
          <span className="ml-auto text-xs text-[rgb(var(--faint))]">{paused ? 'Đang tạm dừng' : 'Tự chuyển sau 6 giây'}</span>
        </div>
      </section>
    </div>
  );
}

