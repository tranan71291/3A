'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Building2, CheckCircle2, ChevronDown, ChevronRight, Eye, Factory, Globe, KeyRound, LogOut, Moon, RefreshCw, Settings, Sun, UserCog } from 'lucide-react';
import { Avatar } from '../components/controls';
import { EmptyState, Field, Modal } from '../components/ui';
import { cloudMessage } from '../lib/cloud';
import { BRAND, btnGhost, btnPrimary, cloud, CLOUD_ON, inputBase, inputCls, LOGO_3A, NOTICE_ICON, orgOf, ORGS, PRESENCE_META, presenceOf, ROLE_DESC, ROLE_LABEL, ROLES, timeAgo, useApp } from '../lib/core';
import { hashPassword, passwordIssues, verifyPassword } from '../lib/security';
import type { Role, SyncInfo, User } from '../lib/types';
import { cn } from '../lib/utils';
import { MyAccountSheet } from '../modules/settings/my-account';

export function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open, close]);
  return ref;
}

export function NotificationBell() {
  const { notices, markNoticeRead, go, ringKey } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const unread = notices.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button className={cn(btnGhost, 'relative p-2')} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="true" aria-label={`Thông báo, ${unread} chưa đọc`}>
        <Bell key={ringKey} className="h-4 w-4 motion-safe:animate-[ring_.9s_ease-in-out]" aria-hidden />
        {unread > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[rgb(var(--danger))] px-1 text-[11px] font-semibold text-white tabular-nums">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[380px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] shadow-2xl motion-safe:animate-[popIn_.15s_ease-out]">
          <div className="flex items-center justify-between border-b border-[rgb(var(--line))] px-4 py-3">
            <p className="text-sm font-semibold">Thông báo</p>
            <button className="text-xs text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))] disabled:opacity-40" disabled={!unread} onClick={() => markNoticeRead()}>Đánh dấu đã đọc tất cả</button>
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {notices.slice(0, 25).map((n) => {
              const I = NOTICE_ICON[n.kind];
              return (
                <li key={n.id}>
                  <button className={cn('flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[rgb(var(--raised))]', !n.read && 'bg-[rgb(var(--accent)/0.05)]')} onClick={() => { markNoticeRead(n.id); if (n.module) go(n.module); setOpen(false); }}>
                    <I.icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: I.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm', n.read ? 'text-[rgb(var(--muted))]' : 'font-medium text-[rgb(var(--fg))]')}>{n.title}</span>
                      <span className="block text-xs text-[rgb(var(--muted))]">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-[rgb(var(--muted)/0.8)]">{timeAgo(n.at)}{n.to ? `, tới ${n.to}` : ''}</span>
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--danger))]" aria-label="Chưa đọc" />}
                  </button>
                </li>
              );
            })}
            {!notices.length && <li className="list-none"><EmptyState text={<>Chưa có thông báo.</>} art="inbox" compact /></li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Đổi mật khẩu: kiểm tra mật khẩu hiện tại, chính sách độ mạnh, băm PBKDF2 trước khi lưu */
/** Bộ chọn doanh nghiệp nhanh cho tài khoản nền tảng 3A Group */
/** Trạng thái đồng bộ máy chủ trên header */
export function SyncChip({ info }: { info: SyncInfo }) {
  const ago = info.lastOk ? Math.max(0, Math.round((Date.now() - info.lastOk) / 1000)) : null;
  const tone = info.state === 'error' || info.state === 'offline' ? 'red' : info.state === 'syncing' || info.pending > 0 ? 'orange' : 'teal';
  const label = info.state === 'offline' ? 'Mất kết nối' : info.state === 'error' ? 'Lỗi đồng bộ' : info.state === 'syncing' ? 'Đang lưu…' : info.pending > 0 ? `Chờ lưu ${info.pending}` : 'Đã đồng bộ';
  const title = `${label}${info.error ? `: ${info.error}` : ''}${ago !== null ? `. Lần cuối ${ago < 60 ? `${ago} giây` : `${Math.round(ago / 60)} phút`} trước` : ''}${info.state === 'offline' || info.state === 'error' ? '. Thay đổi vẫn giữ trên máy và tự gửi lại khi có mạng; đừng đóng tab.' : ''}`;
  const color = tone === 'red' ? 'border-[rgb(var(--danger)/0.5)] text-[rgb(var(--danger-fg))]' : tone === 'orange' ? 'border-[rgb(var(--accent)/0.5)] text-[rgb(var(--accent-fg))]' : 'border-[rgb(var(--success)/0.4)] text-[rgb(var(--success-fg))]';
  return (
    <span className={cn('hidden items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1.5 text-xs font-medium sm:flex', color)} title={title} role="status" aria-label={title}>
      {info.state === 'syncing' ? <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden /> : tone === 'red' ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
      <span className="hidden xl:inline">{label}</span>
    </span>
  );
}

/** Biểu tượng tam giác 3A Group */
export function Logo3A({ size = 28 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={LOGO_3A} alt="3A Group" width={size} height={Math.round(size * 0.875)} className="shrink-0 object-contain" style={{ width: size, height: Math.round(size * 0.875) }} />;
}

/** Breadcrumb dạng dropdown cho quản trị 3A: 3A Group › [Console | VASSH | ALUX] ▾ */
export function TenantSwitcher({ orgId, consoleOn, onConsole, onSwitch, children }: { orgId: string; consoleOn: boolean; onConsole: () => void; onSwitch: (org: string) => void; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', key); };
  }, [open]);
  const items = [
    { id: '__console', label: '3A Platform Console', desc: 'Doanh nghiệp, cấp phép, dữ liệu', icon: Globe, color: BRAND.o2 },
    ...ORGS.map((o) => ({ id: o.id, label: `${o.shortName} Instance`, desc: o.name, icon: o.profile === 'MANUFACTURING' ? Factory : Building2, color: o.color })),
  ];
  const cur = consoleOn ? '__console' : orgId;
  const curItem = items.find((x) => x.id === cur) ?? items[0];
  return (
    <div ref={ref} className={cn('relative', !!children && 'min-w-0 flex-1')}>
      {children ? (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Đang ở: ${curItem.label}. Chuyển doanh nghiệp`}
          className={cn('-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5', open && 'bg-white/5')}>
          <span className="min-w-0 flex-1">{children}</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-[rgb(var(--muted))] transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      ) : (
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Đang ở: ${curItem.label}. Chuyển doanh nghiệp`}
        className={cn('flex items-center gap-1.5 rounded px-1.5 py-1 text-sm transition-colors hover:bg-[rgb(var(--secondary)/0.15)]', open && 'bg-[rgb(var(--secondary)/0.15)]')}>
        <Logo3A size={18} />
        <span className="hidden whitespace-nowrap text-[rgb(var(--muted))] xl:inline">3A Group</span>
        <ChevronRight className="hidden h-3.5 w-3.5 text-[rgb(var(--faint))] sm:block" aria-hidden />
        <span className="hidden font-semibold text-[rgb(var(--fg))] sm:inline">{consoleOn ? 'Console' : orgOf(orgId).shortName}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-[rgb(var(--muted))] transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      )}
      {open && (
        <ul role="listbox" aria-label="Chọn không gian làm việc" className="glass absolute left-0 top-full z-[60] mt-1.5 w-72 rounded-md border border-[rgb(var(--ink)/0.1)] p-1 shadow-2xl motion-safe:animate-[popIn_.14s_ease-out]">
          {items.map((it) => {
            const on = it.id === cur;
            const Icon = it.icon;
            return (
              <li key={it.id} role="option" aria-selected={on}>
                <button type="button" className={cn('flex w-full items-center gap-3 rounded px-2.5 py-2 text-left hover:bg-[rgb(var(--secondary)/0.2)]', on && 'bg-[rgb(var(--ink)/0.05)]')}
                  onClick={() => { setOpen(false); if (!on) { if (it.id === '__console') onConsole(); else onSwitch(it.id); } }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded" style={{ background: `${it.color}22`, color: it.color }}><Icon className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{it.label}</span><span className="block truncate text-xs text-[rgb(var(--muted))]">{it.desc}</span></span>
                  {on && <CheckCircle2 className="h-4 w-4 shrink-0 text-[rgb(var(--accent))]" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ChangePasswordModal({ forced, onClose }: { forced?: boolean; onClose: () => void }) {
  const { me, setUsers, security, audit, notify, logout, platform } = useApp();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const issues = passwordIssues(pw, security, me.email);
  const submit = async () => {
    setErr('');
    if (issues.length) return setErr(issues[0]);
    if (pw !== pw2) return setErr('Nhập lại mật khẩu mới không khớp');
    setBusy(true);
    try {
      if (CLOUD_ON) {
        // Máy chủ: kiểm tra mật khẩu hiện tại rồi đổi trên Supabase Auth; app không giữ mật khẩu
        if (!(await cloud.checkPassword(me.email, cur))) { audit('PASSWORD_CHANGE_FAIL', 'Sai mật khẩu hiện tại khi đổi mật khẩu', 'SECURITY'); setErr('Mật khẩu hiện tại không đúng'); return; }
        if (cur === pw) { setErr('Mật khẩu mới phải khác mật khẩu cũ'); return; }
        await cloud.updatePassword(pw);
        const updC = (p: User[]) => p.map((u) => (u.id === me.id ? { ...u, passwordHash: undefined, salt: undefined, mustChangePassword: false, passwordChangedAt: Date.now() } : u));
        if (platform.userId === me.id) platform.setAdmins(updC); else setUsers(updC);
        audit('PASSWORD_CHANGE', 'Đổi mật khẩu', 'SECURITY');
        notify('Đã đổi mật khẩu', 'teal');
        onClose();
        return;
      }
      if (!(await verifyPassword(me, cur))) { audit('PASSWORD_CHANGE_FAIL', 'Sai mật khẩu hiện tại khi đổi mật khẩu', 'SECURITY'); setErr('Mật khẩu hiện tại không đúng'); return; }
      if (cur === pw) { setErr('Mật khẩu mới phải khác mật khẩu cũ'); return; }
      const h = await hashPassword(pw);
      const upd = (p: User[]) => p.map((u) => (u.id === me.id ? { ...u, passwordHash: h.hash, salt: h.salt, mustChangePassword: false, passwordChangedAt: Date.now() } : u));
      if (platform.userId === me.id) platform.setAdmins(upd); else setUsers(upd);
      audit('PASSWORD_CHANGE', 'Đổi mật khẩu', 'SECURITY');
      notify('Đã đổi mật khẩu', 'teal');
      onClose();
    } catch (e) {
      setErr(CLOUD_ON ? cloudMessage(e) : e instanceof Error ? e.message : 'Không đổi được mật khẩu');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={forced ? 'Đổi mật khẩu trước khi tiếp tục' : 'Đổi mật khẩu'} onClose={forced ? logout : onClose} footer={<>{forced ? <button className={btnGhost} onClick={logout}>Đăng xuất</button> : <button className={btnGhost} onClick={onClose}>Hủy</button>}<button className={btnPrimary} disabled={busy} onClick={() => void submit()}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</button></>}>
      {forced && <p className="mb-3 rounded bg-[rgb(var(--accent)/0.1)] p-3 text-sm text-[rgb(var(--accent-fg))]">Tài khoản đang dùng mật khẩu tạm hoặc mật khẩu mặc định. Đặt mật khẩu riêng để tiếp tục.</p>}
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label="Mật khẩu hiện tại"><input className={inputCls} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label="Mật khẩu mới"><input className={inputCls} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Nhập lại mật khẩu mới"><input className={inputCls} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        <ul className="space-y-0.5 text-xs">
          {[`Tối thiểu ${security.minPasswordLength} ký tự`, 'Có cả chữ và số', 'Có ít nhất 1 chữ hoa', 'Không dùng mật khẩu phổ biến / mặc định', 'Không chứa tên email'].map((rule) => (
            <li key={rule} className={cn('flex items-center gap-1.5', pw && !issues.includes(rule) ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />{rule}</li>
          ))}
        </ul>
        {err && <p className="text-sm text-[rgb(var(--danger-fg))]" role="alert">{err}</p>}
        <button type="submit" className="hidden" aria-hidden />
      </form>
    </Modal>
  );
}

/** Avatar có chấm trạng thái */
export function PAvatar({ user, name, size = 32, meId }: { user?: Pick<User, 'id' | 'name' | 'lastActiveAt' | 'lastLoginAt'>; name?: string; size?: number; meId?: string }) {
  const p = presenceOf(user, meId);
  const dot = Math.max(8, Math.round(size * 0.3));
  return (
    <span className="relative inline-flex shrink-0 self-start" title={`${user?.name ?? name ?? ''} · ${PRESENCE_META[p].label}`}>
      <Avatar name={user?.name ?? name ?? '?'} size={size} />
      {user && <i className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[rgb(var(--bg))]" style={{ width: dot, height: dot, background: PRESENCE_META[p].color }} aria-label={PRESENCE_META[p].label} />}
    </span>
  );
}

/** Avatar + tên + chức danh; popover gọn: công ty, email, tài khoản, đổi mật khẩu, giao diện, vai trò xem thử, đăng xuất */
export function UserMenu({ theme, onTheme, roleSwitch }: { theme?: 'dark' | 'light'; onTheme?: () => void; roleSwitch?: { role: Role; onRole: (r: Role) => void } }) {
  const { me, role, dept, logout, loginAt, security, platform, org, company, go, canSee } = useApp();
  const isPlatform = platform.userId === me.id;
  const unit = isPlatform ? `3A Group Platform · ${org.shortName}` : dept(me.dept)?.short ?? 'Toàn công ty';
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const row = 'flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-[rgb(var(--fg2))] transition-colors hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]';
  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center rounded-full p-0.5 transition-shadow hover:ring-2 hover:ring-[rgb(var(--ink)/0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--secondary-fg))]" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="true" aria-label={`Tài khoản ${me.name} · ${ROLE_LABEL[role]}`} title={`${me.name} · ${ROLE_LABEL[role]}`}>
        <PAvatar user={me} size={34} meId={me.id} />
      </button>
      {open && (
        <div className="glass absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-[rgb(var(--ink)/0.1)] p-2 shadow-2xl motion-safe:animate-[popIn_.15s_ease-out]" role="menu">
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <PAvatar user={me} size={40} meId={me.id} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{me.name}</p>
              <p className="truncate text-xs text-[rgb(var(--muted))]">{me.email}</p>
              <p className="mt-0.5 truncate text-xs text-[rgb(var(--accent-fg))]" title={ROLE_DESC[role]}>{ROLE_LABEL[role]} · {isPlatform ? 'Quản trị 3A Group' : company.legalName || company.shortName}</p>
            </div>
          </div>
          <div className="border-t border-[rgb(var(--ink)/0.06)] py-1">
            {!isPlatform && <button className={row} role="menuitem" onClick={() => { setOpen(false); setAcctOpen(true); }}><UserCog className="h-4 w-4" aria-hidden />Tài khoản của tôi</button>}
            {canSee('settings') && <button className={row} role="menuitem" onClick={() => { setOpen(false); go('settings'); }}><Settings className="h-4 w-4" aria-hidden />Cài đặt hệ thống</button>}
            <button className={row} role="menuitem" onClick={() => { setOpen(false); setPwOpen(true); }}><KeyRound className="h-4 w-4" aria-hidden />Đổi mật khẩu</button>
            {onTheme && <button className={row} role="menuitem" onClick={onTheme}>{theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}<span className="flex-1">Giao diện {theme === 'dark' ? 'sáng' : 'tối'}</span><span className="text-[11px] text-[rgb(var(--faint))]">Đang: {theme === 'dark' ? 'Tối' : 'Sáng'}</span></button>}
            {roleSwitch && (
              <label className="flex items-center gap-3 px-3 py-2 text-sm text-[rgb(var(--fg2))]"><Eye className="h-4 w-4 shrink-0" aria-hidden /><span className="flex-1">Xem với vai trò</span>
                <select className={cn(inputBase, 'w-auto max-w-[130px] py-1 text-xs')} value={roleSwitch.role} onChange={(e) => roleSwitch.onRole(e.target.value as Role)} aria-label="Chuyển vai trò">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
              </label>
            )}
          </div>
          <p className="border-t border-[rgb(var(--ink)/0.06)] px-3 py-2 text-[11px] text-[rgb(var(--faint))]">{unit} · đăng nhập {loginAt ? new Date(loginAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'} · tự thoát sau {security.idleMinutes} phút</p>
          <div className="border-t border-[rgb(var(--ink)/0.06)] pt-1">
            <button className={cn(row, 'text-[rgb(var(--danger-fg))] hover:bg-[rgb(var(--danger)/0.1)] hover:text-[rgb(var(--danger-fg))]')} role="menuitem" onClick={logout}><LogOut className="h-4 w-4" aria-hidden />Đăng xuất</button>
          </div>
        </div>
      )}
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
      {acctOpen && <MyAccountSheet onClose={() => setAcctOpen(false)} onPassword={() => setPwOpen(true)} />}
    </div>
  );
}

