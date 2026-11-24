'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Mail, RefreshCw, Upload } from 'lucide-react';
import { Logo3A } from '../app/header';
import { Field, FilePicker, Modal } from '../components/ui';
import { BRAND, btnGhost, btnPrimary, btnSm, BUSINESS_PROFILE, CLOUD_ON, DATA_VERSION, defaultTenantReg, DEMO_PASSWORD, GRAD, INITIAL_COMPANY, inputCls, LOGIN_SLIDES, ORG_DEFAULTS, ORG_ID_RE, orgIdIssue, orgOf, ORGS, RESERVED_ORG_IDS, slugify, TENANT_KEEP_CONFIG, TENANT_PLAN, useApp } from './core';
import type { AnyRec, BusinessProfile, CompanyInfo, IndustryCode, Org, OrgChoices, TenantPlan, TenantReg } from './types';
import { industryProfilesEff } from './industry';
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

/** Nạp doanh nghiệp từ hồ sơ nền tảng vào danh mục đang dùng (VASSH, ALUX có sẵn; doanh nghiệp mới do 3A Platform tạo) */
export function registerOrgs(regs: TenantReg[]) {
  for (const r of regs) {
    if (!r?.org || r.org.id !== r.id || !ORG_ID_RE.test(r.id)) continue;
    const i = ORGS.findIndex((o) => o.id === r.id);
    if (i >= 0) ORGS[i] = { ...ORGS[i], ...r.org };
    else ORGS.push(r.org);
  }
}

/** Hồ sơ đầy đủ của mọi doanh nghiệp: giá trị mặc định + phần đã lưu (không xóa cấu hình cũ) */
export function regsFromStored(stored: TenantReg[]): TenantReg[] {
  registerOrgs(stored);
  return ORGS.map((o) => {
    const d = defaultTenantReg(o);
    const r = stored.find((x) => x.id === o.id);
    return r ? { ...d, ...r, modules: { ...d.modules, ...r.modules }, features: { ...d.features, ...(r.features ?? {}) } } : d;
  });
}

/** Cấu hình khởi tạo của một doanh nghiệp: VASSH / ALUX theo ORG_DEFAULTS; doanh nghiệp mới lấy mẫu theo loại hình, dữ liệu trống */
export function orgDefaults(org: string, base: AnyRec): AnyRec {
  if (ORG_DEFAULTS[org]) return ORG_DEFAULTS[org];
  const o = ORGS.find((x) => x.id === org);
  if (!o) return {};
  const tpl: AnyRec = o.profile === 'MANUFACTURING' ? ORG_DEFAULTS.alux : {};
  const blank = Object.fromEntries(Object.entries(base).filter(([k, v]) => Array.isArray(v) && !TENANT_KEEP_CONFIG.has(k)).map(([k]) => [k, []]));
  const company: CompanyInfo = {
    ...INITIAL_COMPANY, appName: `${o.shortName}-CRM`, legalName: o.name, shortName: o.shortName, taxCode: '', address: '', phone: '', email: o.adminEmail ?? '',
    website: o.domain ? `https://${o.domain}` : '', logo: o.logo, representative: o.adminName ?? '', representativeTitle: 'Giám đốc', bankAccount: '', bankName: '', stamp: undefined, profile: o.profile,
  };
  return {
    ...blank, ...tpl, company,
    users: [{ id: 'admin', name: o.adminName || `Quản trị ${o.shortName}`, email: (o.adminEmail || `admin@${o.domain}`).toLowerCase(), role: 'BOD', active: true, approvalLimit: 1_000_000_000, mustChangePassword: true }],
  };
}

/** Mã doanh nghiệp trong đường dẫn: crm.3agroup.vn/vassh -> 'vassh' */
export function pathOrgOf(): string | null {
  if (typeof window === 'undefined') return null;
  const seg = (window.location.pathname.split('/').filter(Boolean)[0] ?? '').toLowerCase();
  return ORG_ID_RE.test(seg) && !RESERVED_ORG_IDS.includes(seg) ? seg : null;
}

/** Đổi đường dẫn theo doanh nghiệp đang mở (không tải lại trang; bỏ qua khi chạy file .html tĩnh) */
export function setPathOrg(org: string | null) {
  if (typeof window === 'undefined' || /\.html?$/i.test(window.location.pathname)) return;
  const want = org ? `/${org}` : '/';
  if (window.location.pathname !== want) window.history.replaceState(window.history.state, '', want + window.location.search + window.location.hash);
}

/** Chữ trên nền màu: tối khi nền sáng, trắng khi nền tối */
export function inkOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#0F141E';
  const n = parseInt(m[1], 16);
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return l > 0.6 ? '#0F141E' : '#FFFFFF';
}

/** Logo doanh nghiệp, hoặc ô màu với chữ viết tắt khi chưa tải logo */
export function OrgMark({ o, size = 40 }: { o: Pick<Org, 'shortName' | 'color' | 'logo'>; size?: number }) {
  if (o.logo) return <img src={o.logo} alt="" style={{ height: size, width: size }} className="shrink-0 rounded-lg bg-white object-contain p-1" />;
  const ini = o.shortName.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?';
  return <span className="flex shrink-0 items-center justify-center rounded-lg font-display font-semibold" style={{ height: size, width: size, background: o.color, color: inkOn(o.color), fontSize: size * 0.38 }} aria-hidden>{ini}</span>;
}

/**
 * Trang đăng nhập: một ô email + mật khẩu (không lộ danh sách doanh nghiệp).
 * Vào bằng đường dẫn riêng (crm.3agroup.vn/vassh) thì hiện logo, màu của doanh nghiệp đó; đường dẫn chung hiện nhận diện 3A Group.
 * Tài khoản thuộc nhiều doanh nghiệp (hoặc quản trị 3A): chọn doanh nghiệp ngay sau khi đăng nhập.
 */
export function LoginScreen({ onLogin, idleOut, dataLocked, brand, choices, onPick, onCancelPick }: { onLogin: (email: string, password: string, remember: boolean) => Promise<string | null>; idleOut: number; dataLocked: number | null; brand: Org | null; choices: OrgChoices | null; onPick: (id: string) => Promise<string | null>; onCancelPick: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | false>(false);
  const [show, setShow] = useState(false);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const accent = brand?.color ?? BRAND.o2;
  const accentHi = brand?.color ?? BRAND.o3;
  const btnBg = brand ? `linear-gradient(100deg, ${brand.color}CC, ${brand.color})` : GRAD;
  const slides = brand ? LOGIN_SLIDES.filter((x) => x.kind === 'center' || (brand.profile === 'MANUFACTURING' ? x.kind === 'mfg' : brand.profile === 'TRADING' ? x.kind !== 'mfg' : true)) : LOGIN_SLIDES;
  useEffect(() => {
    if (paused || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) return;
    const t = window.setInterval(() => setSlide((x) => (x + 1) % slides.length), 6000);
    return () => window.clearInterval(t);
  }, [paused, slides.length]);
  const cur = slides[slide % slides.length] ?? slides[0];
  const submit = async () => {
    if (busy) return;
    setBusy('login'); setError('');
    const err = await onLogin(email, password, remember);
    setBusy(false);
    if (err) { setError(err); setPassword(''); }
  };
  const pick = async (id: string) => {
    if (busy) return;
    setBusy(id); setError('');
    const err = await onPick(id);
    setBusy(false);
    if (err) setError(err);
  };
  const field = 'peer h-12 w-full rounded-md border border-[rgb(var(--ink)/0.1)] bg-[#0B1220]/80 pl-11 pr-3 text-[15px] text-[rgb(var(--fg))] placeholder:text-[rgb(var(--faint))] transition-[border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/0.4)]';
  const brandBlock = (big: boolean) => brand
    ? <div className="flex items-center gap-3"><OrgMark o={brand} size={big ? 46 : 36} /><div className="min-w-0"><p className={cn('font-display font-semibold leading-tight tracking-normal', big ? 'text-2xl' : 'text-lg')}>{brand.shortName}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{brand.name}</p></div></div>
    : <div className="flex items-center gap-3"><Logo3A size={big ? 46 : 36} /><div className="min-w-0"><p className={cn('font-display font-semibold leading-tight tracking-normal', big ? 'text-2xl' : 'text-lg')}>3A GROUP</p><p className="truncate text-[11px] text-[rgb(var(--muted))]">Vietnam Joint Stock Company</p></div></div>;
  return (
    <div className="relative grid min-h-screen bg-[#070B12] text-[rgb(var(--fg))] lg:grid-cols-[5fr_7fr]" style={{ '--acc': accent } as CSSProperties}>
      <style>{`.login-field:focus{border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 25%,transparent)}.login-field:focus~.login-ico{color:var(--acc)}.login-btn{box-shadow:0 10px 30px -8px color-mix(in srgb,var(--acc) 70%,transparent)}.login-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}.login-btn:hover .login-arrow{transform:translateX(4px)}`}</style>
      {/* ---------- Trái: thẻ đăng nhập ---------- */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden px-5 py-10 sm:px-10">
        <div className="pointer-events-none absolute -left-40 top-1/4 h-[460px] w-[460px] rounded-full opacity-30 blur-[120px]" style={{ background: accent }} aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[320px] w-[320px] rounded-full opacity-15 blur-[100px]" style={{ background: accentHi }} aria-hidden />
        <div className="relative w-full max-w-[400px]">
          <div className="mb-6 lg:hidden">{brandBlock(false)}</div>
          {idleOut > 0 && <p className="mb-3 rounded-md border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.1)] px-4 py-3 text-sm text-[rgb(var(--accent-fg))]" role="status">Phiên làm việc đã tự đăng xuất sau {idleOut} phút không thao tác.</p>}
          {dataLocked && <p className="mb-3 rounded-md border border-[rgb(var(--danger)/0.4)] bg-[rgb(var(--danger)/0.1)] px-4 py-3 text-sm text-[rgb(var(--danger-fg))]" role="alert">Dữ liệu trên máy này thuộc phiên bản {dataLocked}, mới hơn bản app đang chạy ({DATA_VERSION}). App sẽ không ghi đè để tránh mất dữ liệu; hãy cập nhật file app mới nhất.</p>}
          <div className="rounded-xl p-px" style={{ background: `linear-gradient(140deg, ${accent}99, rgba(255,255,255,.08) 40%, rgba(255,255,255,.04) 60%, ${accentHi}55)` }}>
            {!choices ? (
              <form className="space-y-4 rounded-[11px] bg-[#111827]/85 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,.7)] backdrop-blur-xl" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                <h1 className="font-display text-xl font-semibold tracking-normal">Đăng nhập</h1>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-[rgb(var(--muted))]">Email công ty</span>
                  <span className="relative block">
                    <input className={cn(field, 'login-field')} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={brand?.domain ? `ten@${brand.domain}` : 'ten@congty.vn'} autoFocus />
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
                <button type="submit" disabled={!!busy || !email || !password} className="login-btn flex h-11 w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold transition-[transform,filter] duration-200 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: btnBg, color: brand ? inkOn(brand.color) : '#0F141E' }}>
                  {busy ? <><RefreshCw className="h-4 w-4 motion-safe:animate-spin" aria-hidden />Đang xác thực…</> : <>Đăng nhập<ArrowRight className="login-arrow h-4 w-4 transition-transform duration-200" aria-hidden /></>}
                </button>
                {CLOUD_ON && <p className="text-center text-[11px] text-[rgb(var(--muted))]">Quên mật khẩu: nhờ Giám đốc doanh nghiệp cấp lại.</p>}
              </form>
            ) : (
              <div className="space-y-3 rounded-[11px] bg-[#111827]/85 p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,.7)] backdrop-blur-xl">
                <div><h1 className="font-display text-xl font-semibold tracking-normal">Chọn doanh nghiệp</h1><p className="mt-1 truncate text-xs text-[rgb(var(--muted))]">Đăng nhập: {choices.email}</p></div>
                {choices.note && <p className="rounded-md border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.08)] px-3 py-2 text-xs text-[rgb(var(--accent-fg))]">{choices.note}</p>}
                <ul className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                  {choices.platform && (
                    <li><button type="button" disabled={!!busy} onClick={() => void pick('_console')} className="flex w-full items-center gap-3 rounded-lg border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--ink)/0.03)] p-3 text-left transition-colors hover:border-[color:var(--acc)] disabled:opacity-60">
                      <Logo3A size={36} /><span className="min-w-0 flex-1"><b className="block text-sm">3A Platform Console</b><span className="block truncate text-xs text-[rgb(var(--muted))]">Quản trị doanh nghiệp, cấp phép module, dữ liệu</span></span>{busy === '_console' ? <RefreshCw className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />}
                    </button></li>
                  )}
                  {choices.ids.map((id) => { const o = orgOf(id); return (
                    <li key={id}><button type="button" disabled={!!busy} onClick={() => void pick(id)} className="flex w-full items-center gap-3 rounded-lg border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--ink)/0.03)] p-3 text-left transition-colors hover:border-[color:var(--acc)] disabled:opacity-60">
                      <OrgMark o={o} size={36} /><span className="min-w-0 flex-1"><b className="block text-sm">{o.shortName}</b><span className="block truncate text-xs text-[rgb(var(--muted))]">{o.name} · {BUSINESS_PROFILE[o.profile]?.label ?? ''}</span></span>{busy === id ? <RefreshCw className="h-4 w-4 motion-safe:animate-spin" aria-hidden /> : <ArrowRight className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />}
                    </button></li>
                  ); })}
                </ul>
                {error && <p className="rounded-md border border-[rgb(var(--danger)/0.4)] bg-[rgb(var(--danger)/0.1)] px-3 py-2 text-sm text-[rgb(var(--danger-fg))]" role="alert">{error}</p>}
                <button type="button" className="w-full text-center text-xs font-medium text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] hover:underline" onClick={() => { setError(''); setPassword(''); onCancelPick(); }}>Đăng nhập bằng tài khoản khác</button>
              </div>
            )}
          </div>
          <p className="mt-8 text-center text-[11px] text-[rgb(var(--faint))]">© {new Date().getFullYear()} 3A Group Vietnam JSC · Kết nối được mã hóa</p>
        </div>
      </section>

      {/* ---------- Phải: nhận diện + giới thiệu ---------- */}
      <section className="relative hidden overflow-hidden border-l border-[rgb(var(--ink)/0.06)] lg:flex lg:flex-col" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carousel" aria-label={brand ? `Giới thiệu ${brand.shortName}` : 'Giới thiệu nền tảng 3A Group'}>
        <div className="absolute inset-0" style={{ background: `radial-gradient(800px 560px at 75% 15%, ${accent}2E, transparent 60%), radial-gradient(700px 500px at 10% 100%, ${BRAND.o1}1A, transparent 60%), linear-gradient(180deg, #0B1220, #070B12)` }} aria-hidden />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(circle at 60% 40%, black, transparent 75%)' }} aria-hidden />
        <div className="relative flex flex-1 flex-col justify-center px-12 py-12 xl:px-20">
          <div className="mb-10">{brandBlock(true)}</div>
          <div key={slide} className="motion-safe:animate-[popIn_.5s_ease-out]" role="group" aria-roledescription="slide" aria-label={`${slide + 1} / ${slides.length}: ${cur.title}`}>
            <h2 className="font-display max-w-xl text-4xl font-semibold leading-[1.12] tracking-normal xl:text-[44px]">{cur.title}</h2>
            <p className="mt-4 max-w-lg text-[15px] text-[rgb(var(--muted))]">{cur.desc}</p>
            <div className="mt-8"><LoginArt kind={cur.kind} accent={accent} /></div>
            <ul className="mt-8 grid max-w-2xl gap-3 xl:grid-cols-3">
              {cur.points.map((p) => <li key={p} className="rounded-lg border border-[rgb(var(--ink)/0.08)] bg-[rgb(var(--ink)/0.03)] px-4 py-3 text-sm text-[rgb(var(--fg2))] backdrop-blur"><CheckCircle2 className="mb-1.5 h-4 w-4" style={{ color: accentHi }} aria-hidden />{p}</li>)}
            </ul>
          </div>
        </div>
        <div className="relative flex items-center gap-3 px-12 pb-10 xl:px-20">
          {slides.map((x, i) => <button key={x.title} onClick={() => setSlide(i)} aria-label={`Xem ${x.title}`} aria-current={i === slide % slides.length} className="h-1.5 rounded-full transition-colors duration-300" style={{ width: i === slide % slides.length ? 36 : 12, background: i === slide % slides.length ? accentHi : 'rgba(255,255,255,.2)' }} />)}
          <span className="ml-auto text-xs text-[rgb(var(--faint))]">{paused ? 'Đang tạm dừng' : 'Tự chuyển sau 6 giây'}</span>
        </div>
      </section>
    </div>
  );
}

/** Thu nhỏ logo về ≤ 256px, giữ nền trong suốt (PNG) */
export function shrinkLogo(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('Không đọc được ảnh'));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => rej(new Error('Ảnh không hợp lệ'));
      img.onload = () => {
        const k = Math.min(1, 256 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/png'));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

/** 3A Platform Console › Doanh nghiệp: thêm doanh nghiệp mới (hồ sơ, đường dẫn, tài khoản quản trị đầu tiên) */
export function AddTenantModal({ onClose, onCreated }: { onClose: () => void; /** v56: tạo xong mở bảng Ngành & mẫu ngành để áp dụng bộ mẫu */ onCreated?: (id: string) => void }) {
  const { platform, notify } = useApp();
  const [f, setF] = useState({ name: '', shortName: '', id: '', domain: '', profile: 'TRADING' as BusinessProfile, color: '#2563EB', logo: '' as string, plan: 'BUSINESS' as TenantPlan, adminName: '', adminEmail: '', password: '', industry: '' as IndustryCode | '' });
  const profiles = industryProfilesEff(platform.industryProfiles);
  const indEff: IndustryCode = f.industry || (f.profile === 'MANUFACTURING' ? 'mfg_install' : 'trade');
  const [idTouched, setIdTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const id = f.id.trim().toLowerCase();
  const domain = f.domain.trim().toLowerCase().replace(/^@/, '');
  const mail = f.adminEmail.trim().toLowerCase();
  const issues: Record<string, string | null> = {
    name: f.name.trim() ? null : 'Nhập tên doanh nghiệp',
    shortName: f.shortName.trim() ? null : 'Nhập tên viết tắt',
    id: orgIdIssue(id),
    domain: /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? null : 'VD: congtya.vn',
    adminEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail) ? null : 'Email không hợp lệ',
    password: !CLOUD_ON || f.password.length >= 8 ? null : 'Tối thiểu 8 ký tự',
  };
  const ok = Object.values(issues).every((x) => !x);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/${id || 'ma-doanh-nghiep'}` : `/${id}`;
  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true); setErr('');
    const e = await platform.addTenant({ id, name: f.name.trim(), shortName: f.shortName.trim(), domain, profile: f.profile, color: f.color, logo: f.logo || undefined, adminName: f.adminName.trim() || undefined, adminEmail: mail }, f.plan, f.password);
    setBusy(false);
    if (e) { setErr(e); return; }
    platform.setTenantReg(id, { industry: indEff }, `Đặt ngành ${profiles.find((p) => p.id === indEff)?.label ?? indEff}`);
    notify(`Đã tạo ${f.shortName.trim()}. Gửi đường dẫn ${link} cho quản trị viên ${mail}`, 'teal');
    onClose();
    onCreated?.(id);
  };
  const showErr = (k: string) => (f[k as keyof typeof f] !== '' || k === 'id' ? issues[k] ?? undefined : undefined);
  return (
    <Modal title="Thêm doanh nghiệp" wide onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} disabled={!ok || busy} onClick={() => void submit()}>{busy ? 'Đang tạo…' : 'Tạo doanh nghiệp'}</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên doanh nghiệp" className="sm:col-span-2" error={showErr('name')}><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="VD: Công ty CP Cơ điện Phú Thành" /></Field>
        <Field label="Tên viết tắt" error={showErr('shortName')}><input className={inputCls} value={f.shortName} onChange={(e) => { set('shortName', e.target.value); if (!idTouched) set('id', slugify(e.target.value).slice(0, 30)); }} placeholder="VD: PHUTHANH" /></Field>
        <Field label="Mã đường dẫn" hint={`Đường dẫn đăng nhập: ${link}`} error={id || idTouched ? issues.id ?? undefined : undefined}><input className={cn(inputCls, 'font-mono')} value={f.id} onChange={(e) => { setIdTouched(true); set('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }} placeholder="phuthanh" /></Field>
        <Field label="Tên miền email" hint="Nhân viên đăng nhập bằng email @tên-miền này" error={showErr('domain')}><input className={inputCls} value={f.domain} onChange={(e) => set('domain', e.target.value)} placeholder="phuthanh.vn" /></Field>
        <Field label="Loại hình"><select className={inputCls} value={f.profile} onChange={(e) => set('profile', e.target.value as BusinessProfile)}>{(['TRADING', 'MANUFACTURING', 'ALL'] as BusinessProfile[]).map((p) => <option key={p} value={p}>{BUSINESS_PROFILE[p].label}</option>)}</select></Field>
        <Field label="Ngành nghề" hint="Thuật ngữ và bộ mẫu ngành; áp dụng bộ mẫu ở bước sau"><select className={inputCls} value={indEff} onChange={(e) => set('industry', e.target.value as IndustryCode)} aria-label="Ngành nghề">{profiles.map((p) => <option key={p.id} value={p.id}>{p.label}{p.ready ? '' : ' (hạ tầng)'}</option>)}</select></Field>
        <Field label="Gói bản quyền"><select className={inputCls} value={f.plan} onChange={(e) => set('plan', e.target.value as TenantPlan)}>{(Object.keys(TENANT_PLAN) as TenantPlan[]).map((p) => <option key={p} value={p}>{TENANT_PLAN[p].label} · {TENANT_PLAN[p].seats} người · {TENANT_PLAN[p].price}</option>)}</select></Field>
        <Field label="Màu thương hiệu"><div className="flex items-center gap-2"><input type="color" className="h-10 w-14 cursor-pointer rounded border border-[rgb(var(--line))] bg-transparent" value={f.color} onChange={(e) => set('color', e.target.value)} aria-label="Màu thương hiệu" /><input className={cn(inputCls, 'font-mono')} value={f.color} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set('color', e.target.value)} aria-label="Mã màu" /></div></Field>
        <Field label="Logo (PNG nền trong suốt)" className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <OrgMark o={{ shortName: f.shortName || '?', color: f.color, logo: f.logo || undefined }} size={44} />
            <FilePicker accept="image/png,image/jpeg,image/webp,image/svg+xml" onFiles={(fs) => { const x = fs[0]; if (x) void shrinkLogo(x).then((u) => set('logo', u)).catch((e2) => setErr(e2 instanceof Error ? e2.message : 'Ảnh không hợp lệ')); }} className={cn(btnGhost, btnSm)}><Upload className="h-3.5 w-3.5" aria-hidden />{f.logo ? 'Đổi logo' : 'Tải logo'}</FilePicker>
            {f.logo && <button className={cn(btnGhost, btnSm)} onClick={() => set('logo', '')}>Bỏ logo</button>}
          </div>
        </Field>
        <div className="sm:col-span-2 mt-1 border-t border-[rgb(var(--line))] pt-3 text-sm font-semibold">Quản trị viên đầu tiên (Giám đốc doanh nghiệp)</div>
        <Field label="Họ tên"><input className={inputCls} value={f.adminName} onChange={(e) => set('adminName', e.target.value)} placeholder="VD: Nguyễn Văn A" /></Field>
        <Field label="Email đăng nhập" error={showErr('adminEmail')}><input className={inputCls} type="email" value={f.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} placeholder={domain ? `giamdoc@${domain}` : 'giamdoc@congty.vn'} /></Field>
        {CLOUD_ON
          ? <Field label="Mật khẩu tạm" hint="Quản trị viên phải đổi ở lần đăng nhập đầu" error={showErr('password')}><input className={inputCls} type="text" autoComplete="off" value={f.password} onChange={(e) => set('password', e.target.value)} placeholder="≥ 8 ký tự" /></Field>
          : <p className="self-end text-xs text-[rgb(var(--muted))]">Chế độ lưu trên máy: mật khẩu khởi tạo {DEMO_PASSWORD}, bắt buộc đổi ở lần đăng nhập đầu.</p>}
      </div>
      {mail && domain && !mail.endsWith(`@${domain}`) && <p className="mt-3 text-xs text-[rgb(var(--accent-fg))]">Email quản trị không thuộc tên miền {domain}: vẫn tạo được, nhưng nên dùng email công ty.</p>}
      {err && <p className="mt-3 rounded-md border border-[rgb(var(--danger)/0.4)] bg-[rgb(var(--danger)/0.1)] px-3 py-2 text-sm text-[rgb(var(--danger-fg))]" role="alert">{err}</p>}
      <p className="mt-3 text-xs text-[rgb(var(--muted))]">Doanh nghiệp mới bắt đầu với dữ liệu trống (không có dữ liệu mẫu), phòng ban / nguồn lead / mẫu báo giá lấy theo loại hình. Module cấp phép theo loại hình, chỉnh lại ở mục Cấp phép module.</p>
    </Modal>
  );
}

