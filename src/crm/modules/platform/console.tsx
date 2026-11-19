'use client';

import { Building2, CalendarDays, CheckCircle2, ChevronRight, Copy, Download, KeyRound, Link2, LogIn, Pencil, Plug, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, Users, XCircle } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Pagination, RowMenu, usePaged } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Chip, Code, EmptyState, Field, Modal, MoneyInput, Panel, StatCard, Table, Tabs, useSort, useSticky } from '../../components/ui';
import { cloudMessage } from '../../lib/cloud';
import { btnGhost, btnPrimary, btnSm, BUSINESS_PROFILE, C, cloud, CLOUD_ON, CONSOLE_TABS, DATA_VERSION, dataKey, daysTo, defaultTenantReg, DEMO_PASSWORD, EMAIL_RE, fmtDate, headRoleFor, INITIAL_PERMS, INITIAL_SECURITY, inputBase, inputCls, isPlatformEmail, kpiGrid, MODULE_DESC, MODULE_GROUP, MODULE_ICON, MODULE_LABEL, MODULES, OPEN_STATUSES, orgOf, ORGS, PAY_TRIGGER, pct, PLATFORM_DOMAIN, PRICE_UNIT, PROVISION_MODULES, ROLE_LABEL, ROLES, rowCls, SNAP_KEEP, storage, tdCls, tdFirst, tdLast, tempPassword, TENANT_PLAN, todayISO, uid, useApp, vnd } from '../../lib/core';
import { downloadCsv } from '../../lib/csv';
import { AddTenantModal, OrgMark } from '../../lib/modules';
import { hashPassword } from '../../lib/security';
import { listSnapshots, tenantStats } from '../../lib/storage';
import type { AnyRec, ConfirmState, ConsoleTab, Department, DeptCode, MfgConfig, Module, Org, PayStage, PayTrigger, Perms, PriceItem, PriceUnit, Role, SecurityPolicy, StoredData, TenantPlan, TenantReg, Tone, User } from '../../lib/types';
import { cn } from '../../lib/utils';
import { SearchBox } from '../alux/orders';

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40', on ? 'bg-[rgb(var(--success))]' : 'bg-[rgb(var(--line))]')}>
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export function PlatformConsole() {
  const { platform } = useApp();
  const tab = platform.consoleTab;
  const meta = CONSOLE_TABS.find((t) => t.id === tab)!;
  return (
    <div className="space-y-5">
      <div className="lg:hidden"><Tabs tabs={CONSOLE_TABS.map((t) => ({ id: t.id, label: t.label }))} value={tab} onChange={platform.setConsoleTab} /></div>
      <p className="sr-only">{meta.desc}</p>
      {tab === 'overview' && <ConsoleOverview />}
      {tab === 'tenants' && <ConsoleTenants />}
      {tab === 'modules' && <ConsoleModules />}
      {tab === 'users' && <ConsoleUsers />}
      {tab === 'data' && <ConsoleData />}
      {tab === 'admins' && <ConsoleAdmins />}
    </div>
  );
}

/** Bảng điều khiển nền tảng: chỉ số tổng hợp từ đăng ký bản quyền + thống kê dữ liệu từng doanh nghiệp (không hardcode số liệu) */
export function ConsoleOverview() {
  const { platform } = useApp();
  const rows = ORGS.map((o) => {
    const r = platform.tenants.find((x) => x.id === o.id) ?? defaultTenantReg(o);
    const st = tenantStats(o.id);
    const left = daysTo(r.contractEnd);
    const on = PROVISION_MODULES.filter((m) => r.modules[m]).length;
    const seatPct = r.seats ? st.activeUsers / r.seats : 0;
    const backupAge = r.lastBackupAt ? Math.floor((Date.now() - r.lastBackupAt) / 86400000) : null;
    return { o, r, st, left, on, seatPct, backupAge };
  });
  const active = rows.filter((x) => x.r.status === 'ACTIVE').length;
  const users = rows.reduce((s, x) => s + x.st.activeUsers, 0);
  const seats = rows.reduce((s, x) => s + x.r.seats, 0);
  const mods = rows.reduce((s, x) => s + x.on, 0);
  const expiring = rows.filter((x) => x.left <= 60).length;
  const alerts: { tone: Tone; tenant: Org; text: string; tab: ConsoleTab }[] = [];
  rows.forEach(({ o, r, st, left, seatPct, backupAge }) => {
    if (r.status === 'SUSPENDED') alerts.push({ tone: 'red', tenant: o, text: 'Đang tạm dừng: người dùng không đăng nhập được', tab: 'tenants' });
    if (left < 0) alerts.push({ tone: 'red', tenant: o, text: `Hợp đồng đã hết hạn ${-left} ngày`, tab: 'tenants' });
    else if (left <= 60) alerts.push({ tone: 'orange', tenant: o, text: `Hợp đồng còn ${left} ngày, cần gia hạn`, tab: 'tenants' });
    if (seatPct >= 0.9) alerts.push({ tone: 'orange', tenant: o, text: `Đã dùng ${Math.round(seatPct * 100)}% số ghế (${st.activeUsers}/${r.seats})`, tab: 'tenants' });
    if (st.version && st.version < DATA_VERSION) alerts.push({ tone: 'orange', tenant: o, text: `Dữ liệu phiên bản ${st.version}, mới nhất ${DATA_VERSION}`, tab: 'data' });
    if (backupAge === null || backupAge > 7) alerts.push({ tone: 'muted', tenant: o, text: backupAge === null ? 'Chưa có bản sao lưu' : `Sao lưu gần nhất ${backupAge} ngày trước`, tab: 'data' });
  });
  return (
    <div className="space-y-5">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Doanh nghiệp hoạt động" value={`${active} / ${rows.length}`} sub={rows.length - active ? `${rows.length - active} tạm dừng` : 'Tất cả hoạt động'} icon={Building2} color={active === rows.length ? C.teal : C.red} />
        <StatCard label="Người dùng kích hoạt" value={String(users)} sub={`${seats} ghế bản quyền, dùng ${pct(users, seats)}`} icon={Users} />
        <StatCard label="Module cấp phép" value={String(mods)} sub={`trên ${rows.length * PROVISION_MODULES.length} khả dụng`} icon={SlidersHorizontal} />
        <StatCard label="Hợp đồng sắp hết hạn" value={String(expiring)} sub="trong 60 ngày tới" icon={CalendarDays} color={expiring ? C.orange : C.teal} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Bản quyền theo doanh nghiệp" action={<button className={cn(btnGhost, btnSm)} onClick={() => platform.setConsoleTab('tenants')}>Quản lý doanh nghiệp<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>}>
          <ul className="divide-y divide-[rgb(var(--line))]">
            {rows.map(({ o, r, st, left, on, seatPct }) => (
              <li key={o.id} className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: o.color }} aria-hidden />
                  <div className="min-w-0"><p className="truncate font-semibold">{o.name}</p><p className="text-xs text-[rgb(var(--muted))]">{TENANT_PLAN[r.plan].label} · {on}/{PROVISION_MODULES.length} module · {st.customers} khách hàng</p></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs"><span className="text-[rgb(var(--muted))]">Ghế đã dùng</span><span className="tabular-nums">{st.activeUsers}/{r.seats}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><div className={cn('h-full rounded-full', seatPct >= 0.9 ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--secondary))]')} style={{ width: `${Math.min(100, Math.round(seatPct * 100))}%` }} /></div>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <Chip tone={r.status !== 'ACTIVE' || left < 0 ? 'red' : left <= 60 ? 'orange' : 'teal'}>{r.status !== 'ACTIVE' ? 'Tạm dừng' : left < 0 ? 'Hết hạn' : `Còn ${left} ngày`}</Chip>
                  <button className={cn(btnGhost, btnSm)} onClick={() => platform.switchTenant(o.id)} aria-label={`Truy cập ${o.shortName}`}><LogIn className="h-3.5 w-3.5" aria-hidden /></button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={`Cần xử lý (${alerts.length})`}>
          {alerts.length ? (
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li key={i}><button className="flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => platform.setConsoleTab(a.tab)}>
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', a.tone === 'red' ? 'bg-[rgb(var(--danger))]' : a.tone === 'orange' ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--faint))]')} aria-hidden />
                  <span className="min-w-0"><b className="font-medium">{a.tenant.shortName}</b><span className="block text-xs text-[rgb(var(--muted))]">{a.text}</span></span>
                </button></li>
              ))}
            </ul>
          ) : <EmptyState compact art="inbox" text="Không có cảnh báo" hint="Tất cả doanh nghiệp đang ổn định." />}
        </Panel>
      </div>
      <Panel title="Hoạt động nền tảng gần đây" action={<button className={cn(btnGhost, btnSm)} onClick={() => platform.setConsoleTab('admins')}>Nhật ký đầy đủ<ChevronRight className="h-3.5 w-3.5" aria-hidden /></button>}>
        {platform.logs.length ? (
          <ul className="divide-y divide-[rgb(var(--line))] text-sm">
            {platform.logs.slice(0, 8).map((l) => <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2"><span className="min-w-0">{l.tenant ? <b className="font-medium">{orgOf(l.tenant).shortName}: </b> : null}{l.detail}</span><span className="text-xs text-[rgb(var(--muted))]">{l.by} · {new Date(l.at).toLocaleString('vi-VN')}</span></li>)}
          </ul>
        ) : <EmptyState compact art="doc" text="Chưa có hoạt động" hint="Thao tác cấp phép, sao lưu, nâng cấp sẽ được ghi tại đây." />}
      </Panel>
    </div>
  );
}

/** Đọc dữ liệu đã lưu của một doanh nghiệp (chỉ đọc). Chế độ cloud: dữ liệu nằm sau RLS từng tenant nên trả null. */
export function tenantSnapshot(org: string): AnyRec | null {
  if (CLOUD_ON) return null;
  try { const raw = storage.get(dataKey(org)); return raw ? ((JSON.parse(raw) as StoredData).data ?? null) as AnyRec : null; } catch { return null; }
}

/** User Management + Role & Permission toàn nền tảng (chỉ đọc; sửa trong Cài đặt của từng doanh nghiệp để giữ nhật ký & phân tách dữ liệu) */
export function ConsoleUsers() {
  const { platform } = useApp();
  const [q, setQ] = useSticky('ConsoleUsers.q', '');
  const [org, setOrg] = useSticky<string>('ConsoleUsers.org', 'ALL');
  const now = Date.now();
  const data = ORGS.map((o) => {
    const d = tenantSnapshot(o.id);
    const users = ((d?.users ?? []) as User[]);
    const perms = (d?.perms ?? INITIAL_PERMS) as Perms;
    const sec = { ...INITIAL_SECURITY, ...((d?.security ?? {}) as Partial<SecurityPolicy>) };
    return { o, users, perms, sec, st: tenantStats(o.id), loaded: !!d };
  });
  const t = q.trim().toLowerCase();
  const rows = data.filter((x) => org === 'ALL' || x.o.id === org).flatMap((x) => x.users.map((u) => ({ u, o: x.o })))
    .filter(({ u }) => !t || `${u.name} ${u.email} ${ROLE_LABEL[u.role]}`.toLowerCase().includes(t));
  const srt = useSort('ConsoleUsers', rows, { 0: (r) => r.u.name, 1: (r) => r.o.shortName, 2: (r) => ROLE_LABEL[r.u.role], 3: (r) => r.u.lastLoginAt ?? 0 });
  const paged = usePaged(srt.rows, 15);
  const status = (u: User) => (!u.active ? { tone: 'muted' as Tone, label: 'Ngừng' } : u.lockedUntil && u.lockedUntil > now ? { tone: 'red' as Tone, label: 'Đang khóa' } : u.mustChangePassword ? { tone: 'orange' as Tone, label: 'Chờ đổi mật khẩu' } : { tone: 'teal' as Tone, label: 'Hoạt động' });
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data.map(({ o, users, perms, sec, st, loaded }) => (
          <Panel key={o.id} title={o.name} action={<button className={cn(btnGhost, btnSm)} onClick={() => platform.switchTenant(o.id)}><LogIn className="h-3.5 w-3.5" aria-hidden />Quản lý trong DN</button>}>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {[['Tài khoản', String(loaded ? users.length : st.users)], ['Hoạt động', String(loaded ? users.filter((u) => u.active).length : st.activeUsers)], ['Đang khóa', loaded ? String(users.filter((u) => u.lockedUntil && u.lockedUntil > now).length) : '—'], ['Phiên tự thoát', `${sec.idleMinutes} phút`]].map(([k, v]) => (
                <div key={k} className="rounded bg-[rgb(var(--raised))] p-2.5"><dt className="text-[11px] text-[rgb(var(--muted))]">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
              ))}
            </dl>
            <h4 className="mb-1.5 mt-4 text-xs font-semibold text-[rgb(var(--muted))]">Vai trò → số phân hệ được truy cập</h4>
            <ul className="space-y-1.5">
              {ROLES.map((r) => {
                const n = MODULES.filter((m) => perms.modules?.[r]?.[m]).length;
                const cnt = users.filter((u) => u.role === r).length;
                return (
                  <li key={r} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                    <div className="min-w-0"><div className="flex justify-between gap-2"><span className="truncate">{ROLE_LABEL[r]}</span><span className="text-xs tabular-nums text-[rgb(var(--muted))]">{n}/{MODULES.length}</span></div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[rgb(var(--ink)/0.08)]"><div className="h-full rounded-full bg-[rgb(var(--secondary))]" style={{ width: `${Math.round((n / MODULES.length) * 100)}%` }} /></div></div>
                    <Chip>{loaded ? `${cnt} người` : '—'}</Chip>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-[rgb(var(--muted))]">Mật khẩu tối thiểu {sec.minPasswordLength} ký tự · khóa sau {sec.lockoutAttempts} lần sai ({sec.lockoutMinutes} phút) · phiên {sec.sessionDays} ngày{sec.roleSwitch ? ' · cho phép BOD xem thử vai trò' : ''}</p>
          </Panel>
        ))}
      </div>
      <Panel title={`Tài khoản toàn nền tảng (${rows.length})`}>
        {CLOUD_ON ? <EmptyState compact art="inbox" text="Danh sách tài khoản nằm trong dữ liệu riêng của từng doanh nghiệp" hint="Chế độ cloud tách dữ liệu bằng RLS; dùng “Quản lý trong DN” để xem và sửa." /> : (
          <>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <SearchBox value={q} onChange={(v) => { setQ(v); paged.setPage(1); }} placeholder="Tìm tên, email, vai trò" />
              <select className={cn(inputBase, 'sm:w-56')} value={org} onChange={(e) => { setOrg(e.target.value); paged.setPage(1); }} aria-label="Doanh nghiệp">
                <option value="ALL">Mọi doanh nghiệp</option>{ORGS.map((o) => <option key={o.id} value={o.id}>{o.shortName}</option>)}
              </select>
            </div>
            {rows.length ? (
              <>
                <Table stt={Math.max(0, paged.from - 1)} head={['Họ tên', 'Doanh nghiệp', 'Vai trò', 'Đăng nhập gần nhất', 'Trạng thái']} minW={760} sort={srt.th}>
                  {paged.slice.map(({ u, o }) => { const s = status(u); return (
                    <tr key={`${o.id}-${u.id}`} className={rowCls}>
                      <td className={tdFirst}><p className="font-medium">{u.name}</p><p className="text-xs text-[rgb(var(--muted))]">{u.email}</p></td>
                      <td className={tdCls}>{o.shortName}</td>
                      <td className={tdCls}>{ROLE_LABEL[u.role]}</td>
                      <td className={cn(tdCls, 'text-xs text-[rgb(var(--muted))]')}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</td>
                      <td className={tdLast}><Chip tone={s.tone}>{s.label}</Chip></td>
                    </tr>
                  ); })}
                </Table>
                <Pagination paged={paged} unit="tài khoản" />
              </>
            ) : <EmptyState compact art="search" text="Không có tài khoản phù hợp" hint="Doanh nghiệp chưa nạp dữ liệu hoặc bộ lọc quá hẹp." />}
          </>
        )}
      </Panel>
    </div>
  );
}

export function ConsoleTenants() {
  const { platform, org, notify } = useApp();
  const [edit, setEdit] = useState<TenantReg | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [adding, setAdding] = useState(false);
  const linkOf = (id: string) => (typeof window !== 'undefined' ? `${window.location.origin}/${id}` : `/${id}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <p className="text-[13px] text-[rgb(var(--muted))]">{ORGS.length} doanh nghiệp · mỗi doanh nghiệp có đường dẫn đăng nhập và dữ liệu riêng</p>
        <button className={cn(btnPrimary, btnSm, 'lg:ml-auto')} onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm doanh nghiệp</button>
      </div>
      <Panel>
        <Table minW={1100} head={['Mã', 'Doanh nghiệp', 'Đường dẫn', 'Gói', <span key="u" className="block text-right">Người dùng</span>, 'Hết hạn', 'Còn', <span key="m" className="block text-right">Module</span>, 'Dữ liệu', 'Trạng thái', '']}>
          {ORGS.map((o) => {
            const r = platform.tenants.find((x) => x.id === o.id) ?? defaultTenantReg(o);
            const st = tenantStats(o.id);
            const left = daysTo(r.contractEnd);
            const on = PROVISION_MODULES.filter((m) => r.modules[m]).length;
            return (
              <tr key={o.id} className={rowCls}>
                <td className={tdFirst}><Code>{o.id}</Code></td>
                <td className={tdCls}><span className="flex items-center gap-2"><OrgMark o={o} size={22} /><span className="font-medium">{o.shortName}</span></span></td>
                <td className={cn(tdCls, 'font-mono text-xs')}><a className="hover:underline" href={linkOf(o.id)} target="_blank" rel="noreferrer">/{o.id}</a></td>
                <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{TENANT_PLAN[r.plan].label}</td>
                <td className={cn(tdCls, 'text-right font-mono text-xs', st.activeUsers > r.seats && 'text-[rgb(var(--danger-fg))]')}>{st.activeUsers} / {r.seats}</td>
                <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{fmtDate(r.contractEnd)}</td>
                <td className={cn(tdCls, left < 0 ? 'text-[rgb(var(--danger-fg))]' : left <= 60 ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--fg2))]')}>{left < 0 ? `Quá ${-left} ngày` : `Còn ${left} ngày`}</td>
                <td className={cn(tdCls, 'text-right font-mono text-xs')}>{on} / {PROVISION_MODULES.length}</td>
                <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--muted))]')}>v{st.version || '—'} · {(st.size / 1024).toFixed(0)} KB</td>
                <td className={tdCls}><Chip tone={r.status === 'ACTIVE' ? 'teal' : 'red'}>{r.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm dừng'}</Chip></td>
                <td className={cn(tdLast, 'text-right')}><span className="flex items-center justify-end gap-1">
                  <button className={cn(btnGhost, btnSm)} onClick={() => platform.switchTenant(o.id)}><LogIn className="h-3.5 w-3.5" aria-hidden />{org.id === o.id ? 'Đang mở' : 'Truy cập'}</button>
                  <RowMenu label={`Thao tác ${o.shortName}`} items={[
                    { label: 'Hợp đồng & gói', icon: Pencil, onClick: () => setEdit(r) },
                    { label: 'Cấp phép module', icon: SlidersHorizontal, onClick: () => platform.setConsoleTab('modules') },
                    { label: 'Sao chép đường dẫn', icon: Link2, onClick: () => navigator.clipboard?.writeText(linkOf(o.id)).then(() => notify('Đã sao chép đường dẫn', 'teal'), () => notify('Trình duyệt chặn sao chép', 'red')) },
                    { label: r.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt lại', icon: r.status === 'ACTIVE' ? XCircle : CheckCircle2, danger: r.status === 'ACTIVE', onClick: () => setConfirm({ title: r.status === 'ACTIVE' ? `Tạm dừng ${o.shortName}` : `Kích hoạt lại ${o.shortName}`, confirmLabel: r.status === 'ACTIVE' ? 'Tạm dừng' : 'Kích hoạt', message: r.status === 'ACTIVE' ? `Người dùng ${o.shortName} sẽ không đăng nhập được cho tới khi kích hoạt lại. Dữ liệu giữ nguyên; kỹ thuật 3A vẫn truy cập hỗ trợ được.` : `Cho phép người dùng ${o.shortName} đăng nhập lại.`, onConfirm: () => platform.setTenantReg(o.id, { status: r.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }, r.status === 'ACTIVE' ? 'Tạm dừng doanh nghiệp' : 'Kích hoạt lại doanh nghiệp') }) },
                  ]} />
                </span></td>
              </tr>
            );
          })}
        </Table>
      </Panel>
      {edit && (
        <Modal title={`Hợp đồng & gói: ${orgOf(edit.id).shortName}`} onClose={() => setEdit(null)} footer={<><button className={btnGhost} onClick={() => setEdit(null)}>Hủy</button><button className={btnPrimary} onClick={() => { platform.setTenantReg(edit.id, { plan: edit.plan, seats: edit.seats, contractStart: edit.contractStart, contractEnd: edit.contractEnd, note: edit.note }, `Gói ${TENANT_PLAN[edit.plan].label}, ${edit.seats} người dùng, hạn ${fmtDate(edit.contractEnd)}`); setEdit(null); }}>Lưu</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gói bản quyền"><select className={inputCls} value={edit.plan} onChange={(e) => { const p = e.target.value as TenantPlan; setEdit({ ...edit, plan: p, seats: TENANT_PLAN[p].seats }); }}>{(Object.keys(TENANT_PLAN) as TenantPlan[]).map((p) => <option key={p} value={p}>{TENANT_PLAN[p].label} ({TENANT_PLAN[p].price})</option>)}</select></Field>
            <Field label="Số người dùng"><input className={inputCls} type="number" min={1} value={edit.seats} onChange={(e) => setEdit({ ...edit, seats: Math.max(1, Number(e.target.value) || 1) })} /></Field>
            <Field label="Bắt đầu hợp đồng"><input className={inputCls} type="date" value={edit.contractStart} onChange={(e) => setEdit({ ...edit, contractStart: e.target.value })} /></Field>
            <Field label="Hết hạn hợp đồng"><input className={inputCls} type="date" value={edit.contractEnd} onChange={(e) => setEdit({ ...edit, contractEnd: e.target.value })} /></Field>
            <Field label="Ghi chú" className="col-span-2"><input className={inputCls} value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {adding && <AddTenantModal onClose={() => setAdding(false)} />}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

export function ConsoleModules() {
  const { platform } = useApp();
  const toggle = (id: string, m: Module, on: boolean) => {
    const r = platform.tenants.find((x) => x.id === id)!;
    platform.setTenantReg(id, { modules: { ...r.modules, [m]: on } }, `${on ? 'Bật' : 'Tắt'} module ${MODULE_LABEL[m]}`);
  };
  const preset = (id: string) => {
    const o = orgOf(id);
    platform.setTenantReg(id, { modules: defaultTenantReg(o).modules }, `Áp dụng gói chuẩn ${BUSINESS_PROFILE[o.profile].label}`);
  };
  const feature = (id: string, k: keyof TenantReg['features'], on: boolean) => {
    const r = platform.tenants.find((x) => x.id === id)!;
    platform.setTenantReg(id, { features: { ...r.features, [k]: on } }, `${on ? 'Bật' : 'Tắt'} tích hợp ${k}`);
  };
  const FEATURE_LABEL: Record<keyof TenantReg['features'], string> = { getfly: 'Tích hợp Getfly CRM', zns: 'Zalo ZNS', smtp: 'Email SMTP' };
  return (
    <Panel>
      <div className="-mx-5 overflow-x-auto">
        <table className="dt w-full min-w-[720px] text-sm">
          <thead className="text-xs text-[rgb(var(--muted))]">
            <tr className="border-b border-[rgb(var(--line))]">
              <th className="py-3 pl-5 pr-3 text-left font-medium">Module / tính năng</th>
              {ORGS.map((o) => (
                <th key={o.id} className="w-56 px-3 py-3 text-center font-medium">
                  <span className="flex items-center justify-center gap-1.5 text-sm text-[rgb(var(--fg))]"><i className="h-2 w-2 rounded-full" style={{ background: o.color }} />{o.shortName}</span>
                  <button className="mt-1 text-[11px] text-[rgb(var(--accent-fg))] hover:underline" onClick={() => preset(o.id)}>Gói chuẩn {BUSINESS_PROFILE[o.profile].label.toLowerCase()}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[rgb(var(--line)/0.6)] bg-[rgb(var(--raised)/0.4)]"><td className="py-2 pl-5 text-xs text-[rgb(var(--muted))]" colSpan={ORGS.length + 1}>Luôn bật: Tổng quan, Công việc, Cài đặt</td></tr>
            {MODULE_GROUP.map((g) => (
              <Fragment key={g.title}>
                <tr><td className="pb-1 pl-5 pt-4 text-[11px] font-semibold text-[rgb(var(--muted))]" colSpan={ORGS.length + 1}>{g.title}</td></tr>
                {g.list.map((m) => {
                  const Icon = MODULE_ICON[m];
                  return (
                    <tr key={m} className="border-b border-[rgb(var(--line)/0.6)] hover:bg-[rgb(var(--raised)/0.5)]">
                      <td className="py-2.5 pl-5 pr-3"><span className="flex items-center gap-2"><Icon className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><span><span className="block">{MODULE_LABEL[m]}</span><span className="block text-[11px] text-[rgb(var(--muted))]">{MODULE_DESC[m]}</span></span></span></td>
                      {ORGS.map((o) => { const r = platform.tenants.find((x) => x.id === o.id)!; const on = !!r.modules[m]; return <td key={o.id} className="px-3 py-2.5 text-center"><span className="inline-flex items-center gap-2"><Switch on={on} onChange={(v) => toggle(o.id, m, v)} label={`${MODULE_LABEL[m]} cho ${o.shortName}`} /><span className={cn('w-8 text-left text-xs', on ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}>{on ? 'Bật' : 'Tắt'}</span></span></td>; })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
            <tr><td className="pb-1 pl-5 pt-4 text-[11px] font-semibold text-[rgb(var(--muted))]" colSpan={ORGS.length + 1}>Tích hợp</td></tr>
            {(Object.keys(FEATURE_LABEL) as (keyof TenantReg['features'])[]).map((k) => (
              <tr key={k} className="border-b border-[rgb(var(--line)/0.6)] hover:bg-[rgb(var(--raised)/0.5)]">
                <td className="py-2.5 pl-5 pr-3"><span className="flex items-center gap-2"><Plug className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />{FEATURE_LABEL[k]}</span></td>
                {ORGS.map((o) => { const r = platform.tenants.find((x) => x.id === o.id)!; const on = !!r.features[k]; return <td key={o.id} className="px-3 py-2.5 text-center"><span className="inline-flex items-center gap-2"><Switch on={on} onChange={(v) => feature(o.id, k, v)} label={`${FEATURE_LABEL[k]} cho ${o.shortName}`} /><span className={cn('w-8 text-left text-xs', on ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--muted))]')}>{on ? 'Bật' : 'Tắt'}</span></span></td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[rgb(var(--muted))]">Lưu ngay khi bấm. Doanh nghiệp đang mở cập nhật menu tức thì; doanh nghiệp còn lại áp dụng ở lần mở kế tiếp. Tắt module chỉ ẩn khỏi menu, không xóa dữ liệu.</p>
    </Panel>
  );
}

export function ConsoleData() {
  const { platform, notify } = useApp();
  const [backup, setBackup] = useState<string | null>(null);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [, force] = useState(0);
  const doBackup = async () => {
    if (!backup) return;
    if (pass.length < 10) return notify('Mật khẩu bản sao lưu tối thiểu 10 ký tự', 'red');
    if (pass !== pass2) return notify('Nhập lại mật khẩu không khớp', 'red');
    setBusy(true);
    try { await platform.backupTenant(backup, pass); setBackup(null); setPass(''); setPass2(''); } catch (e) { notify(e instanceof Error ? e.message : 'Không sao lưu được', 'red'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {ORGS.map((o) => {
          const r = platform.tenants.find((x) => x.id === o.id)!;
          const st = tenantStats(o.id);
          const snaps = listSnapshots(o.id);
          const outdated = st.version > 0 && st.version < DATA_VERSION;
          return (
            <section key={o.id} className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-5">
              <p className="flex items-center gap-2 font-semibold"><i className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />{o.name}</p>
              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Khóa lưu trữ</dt><dd className="font-mono text-xs">{dataKey(o.id)}</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Phiên bản dữ liệu</dt><dd className="flex items-center gap-2"><span className="font-semibold tabular-nums">v{st.version || '—'}</span>{st.version ? <Chip tone={outdated ? 'orange' : st.version > DATA_VERSION ? 'red' : 'teal'}>{outdated ? `Cần nâng cấp lên v${DATA_VERSION}` : st.version > DATA_VERSION ? 'Mới hơn app' : 'Mới nhất'}</Chip> : <Chip>Chưa có dữ liệu</Chip>}</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Dung lượng</dt><dd className="tabular-nums">{(st.size / 1024).toFixed(1)} KB</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Lưu gần nhất</dt><dd className="tabular-nums">{st.savedAt ? new Date(st.savedAt).toLocaleString('vi-VN') : '—'}</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Sao lưu gần nhất</dt><dd className={cn('tabular-nums', !r.lastBackupAt && 'text-[rgb(var(--accent-fg))]')}>{r.lastBackupAt ? new Date(r.lastBackupAt).toLocaleString('vi-VN') : 'Chưa sao lưu'}</dd></div>
                <div><dt className="text-[11px] text-[rgb(var(--muted))]">Nâng cấp gần nhất</dt><dd className="tabular-nums">{r.lastMigrationAt ? new Date(r.lastMigrationAt).toLocaleString('vi-VN') : '—'}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className={cn(btnGhost, btnSm)} disabled={!st.raw} onClick={() => setBackup(o.id)}><Download className="h-3.5 w-3.5" aria-hidden />Sao lưu độc lập</button>
                <button className={cn(btnPrimary, btnSm)} disabled={!st.raw || st.version > DATA_VERSION}
                  onClick={() => setConfirm({ title: `Nâng cấp dữ liệu ${o.shortName}`, confirmLabel: 'Nâng cấp', message: `Chạy nâng cấp cấu trúc dữ liệu ${o.shortName} từ v${st.version} lên v${DATA_VERSION}: chỉ bổ sung trường mới với giá trị mặc định, không xóa trường cũ. Hệ thống chụp snapshot trước khi ghi. Doanh nghiệp còn lại không bị ảnh hưởng.`, onConfirm: () => { platform.runMigration(o.id); force((x) => x + 1); } })}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />{outdated ? `Nâng cấp lên v${DATA_VERSION}` : 'Kiểm tra & bổ sung trường mới'}
                </button>
              </div>
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">Snapshot phục hồi ({snaps.length})</p>
                {snaps.length ? (
                  <ul className="space-y-1">
                    {snaps.map((x) => (
                      <li key={x.key} className="flex items-center justify-between gap-2 rounded bg-[rgb(var(--raised))] px-3 py-1.5 text-xs">
                        <span className="tabular-nums">{new Date(x.at).toLocaleString('vi-VN')} · v{x.version} · {x.reason}</span>
                        <button className="text-[rgb(var(--accent-fg))] hover:underline" onClick={() => setConfirm({ title: `Khôi phục ${o.shortName}`, confirmLabel: 'Khôi phục', message: `Khôi phục dữ liệu ${o.shortName} về lúc ${new Date(x.at).toLocaleString('vi-VN')}? Dữ liệu hiện tại được chụp lại trước.`, onConfirm: () => { platform.restoreTenantSnapshot(o.id, x.key); force((v) => v + 1); } })}>Khôi phục</button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-xs text-[rgb(var(--muted))]">Chưa có snapshot. Snapshot tự chụp trước mỗi lần nâng cấp, nhập hoặc khôi phục.</p>}
              </div>
            </section>
          );
        })}
      </div>
      <Panel title="Nguyên tắc nâng cấp an toàn">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[rgb(var(--muted))]">
          <li>Mỗi doanh nghiệp một khóa lưu riêng (<span className="font-mono">3a:tenant:vassh</span>, <span className="font-mono">3a:tenant:alux</span>) kèm số phiên bản dữ liệu.</li>
          <li>Bước nâng cấp chỉ thêm hoặc đổi tên trường, giá trị mới lấy mặc định; không xóa dữ liệu người dùng.</li>
          <li>Trước khi nâng cấp, nhập hoặc khôi phục luôn chụp snapshot (giữ {SNAP_KEEP} bản gần nhất mỗi doanh nghiệp).</li>
          <li>Dữ liệu mới hơn bản app sẽ bị khóa ghi để không ghi đè, cho tới khi cập nhật app.</li>
        </ul>
      </Panel>
      {backup && (
        <Modal title={`Sao lưu mã hóa ${orgOf(backup).shortName}`} onClose={() => setBackup(null)} footer={<><button className={btnGhost} onClick={() => setBackup(null)}>Hủy</button><button className={btnPrimary} disabled={busy} onClick={() => void doBackup()}>{busy ? 'Đang mã hóa…' : 'Tải bản sao lưu'}</button></>}>
          <div className="space-y-3">
            <Field label="Mật khẩu bản sao lưu" hint="Tối thiểu 10 ký tự. Mất mật khẩu sẽ không mở được file."><input className={inputCls} type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
            <Field label="Nhập lại mật khẩu"><input className={inputCls} type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} /></Field>
            <p className="text-xs text-[rgb(var(--muted))]">File AES-256-GCM chỉ chứa dữ liệu {orgOf(backup).shortName}; nhập lại ở Cài đặt &gt; Dữ liệu & bảo mật của chính doanh nghiệp đó.</p>
          </div>
        </Modal>
      )}
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

export function ConsoleAdmins() {
  const { platform, notify, me } = useApp();
  const [form, setForm] = useState<{ name: string; email: string } | null>(null);
  if (CLOUD_ON) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel title="Tài khoản quản trị nền tảng" className="xl:col-span-3">
          <p className="text-sm text-[rgb(var(--muted))]">Chế độ máy chủ: tài khoản quản trị 3A quản lý trong Supabase.</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li>Supabase &gt; Authentication &gt; Users &gt; Add user: nhập email @{PLATFORM_DOMAIN}, mật khẩu, tick Auto Confirm.</li>
            <li>SQL Editor: <code className="rounded bg-[rgb(var(--bg))] px-1.5 py-0.5 text-xs text-[rgb(var(--accent-fg))]">insert into public.platform_admins (user_id, email) select id, email from auth.users where email = &apos;ten@{PLATFORM_DOMAIN}&apos;;</code></li>
            <li>Gỡ quyền: xóa dòng tương ứng trong bảng platform_admins.</li>
          </ol>
          <p className="mt-3 text-xs text-[rgb(var(--muted))]">Đang đăng nhập: {me.email}</p>
        </Panel>
        <Panel title="Nhật ký nền tảng" className="xl:col-span-2">
          {platform.logs.length ? (
            <ul className="max-h-[420px] space-y-1.5 overflow-y-auto text-xs">
              {platform.logs.map((l) => <li key={l.id} className="rounded bg-[rgb(var(--raised))] px-3 py-2"><b>{l.tenant ? `${orgOf(l.tenant).shortName}: ` : ''}{l.detail}</b><p className="mt-0.5 text-[rgb(var(--muted))]">{l.by}, {new Date(l.at).toLocaleString('vi-VN')}</p></li>)}
            </ul>
          ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có thao tác.</p>}
        </Panel>
      </div>
    );
  }
  const add = () => {
    if (!form) return;
    const email = form.email.trim().toLowerCase();
    if (form.name.trim().length < 3 || !isPlatformEmail(email)) return notify(`Nhập họ tên và email @${PLATFORM_DOMAIN}`, 'red');
    if (platform.admins.some((a) => a.email === email)) return notify('Email đã có', 'red');
    platform.setAdmins((p) => [...p, { id: uid('pa'), name: form.name.trim(), email, role: 'BOD', active: true, approvalLimit: 1e13, mustChangePassword: true }]);
    platform.log('ADMIN_ADD', `Thêm quản trị ${email}`);
    notify(`Đã thêm ${email}, mật khẩu khởi tạo ${DEMO_PASSWORD} (bắt đổi khi đăng nhập)`, 'teal');
    setForm(null);
  };
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Panel title="Tài khoản quản trị nền tảng" className="xl:col-span-3" action={<button className={cn(btnPrimary, btnSm)} onClick={() => setForm({ name: '', email: '' })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm quản trị</button>}>
        <Table head={['Họ tên', 'Email', 'Đăng nhập gần nhất', 'Trạng thái', '']} minW={640}>
          {platform.admins.map((a) => (
            <tr key={a.id} className={rowCls}>
              <td className={tdFirst}>{a.name}{a.id === me.id && <span className="ml-1 text-xs text-[rgb(var(--muted))]">(bạn)</span>}</td>
              <td className={cn(tdCls, 'text-xs')}>{a.email}</td>
              <td className={cn(tdCls, 'whitespace-nowrap text-xs tabular-nums')}>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString('vi-VN') : '—'}</td>
              <td className={tdCls}><Chip tone={a.active ? 'teal' : 'red'}>{a.active ? 'Hoạt động' : 'Đã khóa'}</Chip></td>
              <td className={tdLast}><span className="flex justify-end gap-1.5">
                <button className={cn(btnGhost, btnSm)} disabled={a.id === me.id} onClick={() => { platform.setAdmins((p) => p.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x))); platform.log('ADMIN_TOGGLE', `${a.active ? 'Khóa' : 'Mở'} ${a.email}`); }}>{a.active ? 'Khóa' : 'Mở khóa'}</button>
                <button className={cn(btnGhost, btnSm, 'whitespace-nowrap')} disabled={a.id === me.id} onClick={() => { platform.setAdmins((p) => p.map((x) => (x.id === a.id ? { ...x, passwordHash: undefined, salt: undefined, mustChangePassword: true, failedAttempts: 0, lockedUntil: undefined } : x))); platform.log('ADMIN_RESET', `Đặt lại mật khẩu ${a.email}`); notify(`Mật khẩu ${a.email} về ${DEMO_PASSWORD}, bắt đổi khi đăng nhập`, 'orange'); }}>Đặt lại mật khẩu</button>
              </span></td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title="Nhật ký nền tảng" className="xl:col-span-2">
        {platform.logs.length ? (
          <ul className="max-h-[420px] space-y-1.5 overflow-y-auto text-xs">
            {platform.logs.map((l) => <li key={l.id} className="rounded bg-[rgb(var(--raised))] px-3 py-2"><p className="flex justify-between gap-2"><b>{l.tenant ? `${orgOf(l.tenant).shortName}: ` : ''}{l.detail}</b></p><p className="mt-0.5 text-[rgb(var(--muted))]">{new Date(l.at).toLocaleString('vi-VN')}, {l.by}</p></li>)}
          </ul>
        ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có thao tác.</p>}
      </Panel>
      {form && (
        <Modal title="Thêm quản trị nền tảng" onClose={() => setForm(null)} footer={<><button className={btnGhost} onClick={() => setForm(null)}>Hủy</button><button className={btnPrimary} onClick={add}>Thêm</button></>}>
          <div className="space-y-3">
            <Field label="Họ tên"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email" hint={`Phải thuộc tên miền @${PLATFORM_DOMAIN}`}><input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={`ten@${PLATFORM_DOMAIN}`} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Bảng đơn giá m² / md & lịch thanh toán (mô hình xưởng) ----------------

export function PricingSettings() {
  const { priceItems, setPriceItems, mfgConfig, setMfgConfig, canDo, notify, audit } = useApp();
  const can = canDo('priceList.manage');
  const canCfg = canDo('settings.edit') || can;
  const [q, setQ] = useSticky('PricingSettings.q', '');
  const [cat, setCat] = useState('ALL');
  const [edit, setEdit] = useState<PriceItem | null>(null);
  const [cfg, setCfg] = useState<MfgConfig>(mfgConfig);
  const cats = Array.from(new Set(priceItems.map((p) => p.category))).sort();
  const t = q.trim().toLowerCase();
  const list = priceItems.filter((p) => (cat === 'ALL' || p.category === cat) && (!t || `${p.code} ${p.name}`.toLowerCase().includes(t)));
  const sumPct = cfg.schedule.reduce((s, x) => s + x.pct, 0);
  const saveItem = () => {
    if (!edit) return;
    if (edit.code.trim().length < 2 || edit.name.trim().length < 3) return notify('Nhập mã và tên hạng mục', 'red');
    if (edit.price <= 0) return notify('Nhập đơn giá bán', 'red');
    if (priceItems.some((p) => p.id !== edit.id && p.code.trim().toUpperCase() === edit.code.trim().toUpperCase())) return notify('Mã hạng mục đã tồn tại', 'red');
    const item = { ...edit, code: edit.code.trim().toUpperCase(), name: edit.name.trim(), category: edit.category.trim() || 'Khác' };
    setPriceItems((all) => (all.some((p) => p.id === item.id) ? all.map((p) => (p.id === item.id ? item : p)) : [...all, item]));
    audit('PRICE_ITEM_SAVE', `${item.code}: ${vnd(item.price)}/${PRICE_UNIT[item.unit].short}`);
    notify(`Đã lưu ${item.code}. Báo giá đã lưu trước đó giữ nguyên giá cũ.`, 'teal');
    setEdit(null);
  };
  const saveCfg = () => {
    if (sumPct !== 100) return notify(`Tổng các đợt thanh toán phải bằng 100% (đang ${sumPct}%)`, 'red');
    if (cfg.schedule.some((s) => !s.label.trim() || s.pct <= 0)) return notify('Mỗi đợt cần tên và tỷ lệ lớn hơn 0', 'red');
    setMfgConfig((c) => ({ ...c, schedule: cfg.schedule, vatPct: cfg.vatPct, quoteValidDays: cfg.quoteValidDays, warrantyMonths: cfg.warrantyMonths, submitHours: cfg.submitHours, productionDays: cfg.productionDays }));
    audit('MFG_CONFIG', `Lịch thanh toán ${cfg.schedule.map((s) => `${s.label} ${s.pct}%`).join(' / ')}`);
    notify('Đã lưu cấu hình. Áp dụng cho đơn tạo mới.', 'teal');
  };
  const setStage = (i: number, p: Partial<PayStage>) => setCfg((c) => ({ ...c, schedule: c.schedule.map((s, k) => (k === i ? { ...s, ...p } : s)) }));
  return (
    <div className="space-y-5">
      <Panel title="Lịch thanh toán mặc định & quy định thu tiền">
        <p className="mb-3 text-xs text-[rgb(var(--muted))]">Mặc định khi chốt đơn; kỹ thuật vẫn sửa được % từng đơn lúc chốt. Doanh số chỉ ghi nhận khi kế toán xác nhận phiếu thu.</p>
        <ul className="space-y-2">
          {cfg.schedule.map((s, i) => (
            <li key={s.id} className="grid grid-cols-12 items-center gap-2">
              <input className={cn(inputCls, 'col-span-12 sm:col-span-5')} value={s.label} disabled={!canCfg} onChange={(e) => setStage(i, { label: e.target.value })} aria-label="Tên đợt" />
              <div className="relative col-span-4 sm:col-span-2"><input className={cn(inputCls, 'pr-7 text-right tabular-nums')} type="number" min={1} max={100} value={s.pct} disabled={!canCfg} onChange={(e) => setStage(i, { pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} aria-label="Tỷ lệ" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--muted))]">%</span></div>
              <select className={cn(inputCls, 'col-span-6 sm:col-span-4')} value={s.trigger} disabled={!canCfg} onChange={(e) => setStage(i, { trigger: e.target.value as PayTrigger })} aria-label="Mốc thu">{(Object.keys(PAY_TRIGGER) as PayTrigger[]).map((k) => <option key={k} value={k}>{PAY_TRIGGER[k]}</option>)}</select>
              <button className={cn(btnGhost, btnSm, 'col-span-2 sm:col-span-1 justify-center')} disabled={!canCfg || cfg.schedule.length <= 1} onClick={() => setCfg((c) => ({ ...c, schedule: c.schedule.filter((_, k) => k !== i) }))} aria-label="Xóa đợt"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button className={cn(btnGhost, btnSm)} disabled={!canCfg || cfg.schedule.length >= 5} onClick={() => setCfg((c) => ({ ...c, schedule: [...c.schedule, { id: uid('ps'), label: 'Đợt giữa', pct: 0, trigger: 'DELIVERY' }] }))}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm đợt</button>
          <span className={cn('text-sm tabular-nums', sumPct === 100 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>Tổng {sumPct}%</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Field label="VAT mặc định (%)"><input className={inputCls} type="number" min={0} max={10} value={cfg.vatPct} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, vatPct: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Field label="Hiệu lực báo giá (ngày)"><input className={inputCls} type="number" min={1} value={cfg.quoteValidDays} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, quoteValidDays: Math.max(1, Number(e.target.value) || 1) })} /></Field>
          <Field label="Bảo hành (tháng)"><input className={inputCls} type="number" min={0} value={cfg.warrantyMonths} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, warrantyMonths: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          <Field label="Hạn nộp tiền mặt (giờ)" hint="Quá hạn: báo đỏ ở Tổng quan và Trung tâm phê duyệt"><input className={inputCls} type="number" min={1} max={72} value={cfg.submitHours} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, submitHours: Math.max(1, Number(e.target.value) || 24) })} /></Field>
          <Field label="Số ngày sản xuất mặc định"><input className={inputCls} type="number" min={1} value={cfg.productionDays} disabled={!canCfg} onChange={(e) => setCfg({ ...cfg, productionDays: Math.max(1, Number(e.target.value) || 10) })} /></Field>
        </div>
        <div className="mt-3 flex gap-2"><button className={btnPrimary} disabled={!canCfg} onClick={saveCfg}>Lưu cấu hình</button><button className={btnGhost} onClick={() => setCfg(mfgConfig)}>Hoàn tác</button></div>
      </Panel>

      <Panel title={`Bảng đơn giá theo sản phẩm / vật liệu (${priceItems.length})`} action={<button className={cn(btnPrimary, btnSm)} disabled={!can} onClick={() => setEdit({ id: uid('pi'), code: '', name: '', category: cat !== 'ALL' ? cat : '', unit: 'M2', price: 0, cost: 0, minMeasure: 1, active: true })}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm hạng mục</button>}>
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--muted))]" aria-hidden /><input className={cn(inputCls, 'pl-9')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm mã, tên" /></div>
          <select className={cn(inputBase, 'w-auto')} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Nhóm"><option value="ALL">Tất cả nhóm</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          <button className={cn(btnGhost, btnSm)} onClick={() => downloadCsv(`bang-don-gia-${todayISO()}.csv`, [['Mã', 'Tên', 'Nhóm', 'ĐVT', 'Đơn giá', 'Giá vốn', 'Tối thiểu', 'Đang dùng'], ...priceItems.map((p) => [p.code, p.name, p.category, PRICE_UNIT[p.unit].short, p.price, p.cost, p.minMeasure ?? '', p.active ? 'Có' : 'Không'])])}><Download className="h-3.5 w-3.5" aria-hidden />Xuất CSV</button>
        </div>
        <Table head={['Hạng mục', 'Nhóm', 'ĐVT', 'Đơn giá bán', 'Giá vốn', 'GM', 'Tối thiểu / tấm', '']} minW={860}>
          {list.map((p) => {
            const gm = p.price ? ((p.price - p.cost) / p.price) * 100 : 0;
            return (
              <tr key={p.id} className={cn(rowCls, !p.active && 'opacity-50')}>
                <td className={tdFirst}><p className="font-medium">{p.name}</p><p className="text-xs text-[rgb(var(--muted))]">{p.code}{p.note ? `, ${p.note}` : ''}</p></td>
                <td className={cn(tdCls, 'text-xs')}>{p.category}</td>
                <td className={cn(tdCls, 'text-xs')}>{PRICE_UNIT[p.unit].short}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{vnd(p.price)}</td>
                <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums text-[rgb(var(--muted))]')}>{vnd(p.cost)}</td>
                <td className={cn(tdCls, 'tabular-nums', gm < 20 ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--success-fg))]')}>{gm.toFixed(0)}%</td>
                <td className={cn(tdCls, 'text-xs')}>{p.unit === 'M2' || p.unit === 'MD' ? `${p.minMeasure ?? 0} ${PRICE_UNIT[p.unit].short}` : '—'}</td>
                <td className={tdLast}><span className="flex gap-1.5">
                  <button className={cn(btnGhost, btnSm)} disabled={!can} onClick={() => setEdit(p)} aria-label={`Sửa ${p.code}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></button>
                  <button className={cn(btnGhost, btnSm)} disabled={!can} onClick={() => setPriceItems((all) => all.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)))}>{p.active ? 'Ngừng' : 'Dùng lại'}</button>
                </span></td>
              </tr>
            );
          })}
        </Table>
        {!list.length && <EmptyState text={<>Chưa có hạng mục.</>} art="box" />}
        <p className="mt-3 text-xs text-[rgb(var(--muted))]">m²: rộng × cao (mm) / 1.000.000 × số lượng, mỗi tấm tính tối thiểu theo cột "Tối thiểu". md: chiều dài (m) × số lượng. Ngừng hạng mục không ảnh hưởng báo giá đã lưu.</p>
      </Panel>

      {edit && (
        <Modal title={priceItems.some((p) => p.id === edit.id) ? `Sửa ${edit.code}` : 'Thêm hạng mục đơn giá'} onClose={() => setEdit(null)} footer={<><button className={btnGhost} onClick={() => setEdit(null)}>Hủy</button><button className={btnPrimary} onClick={saveItem}>Lưu</button></>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Mã *"><input className={inputCls} value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} placeholder="XF55-DI" /></Field>
            <Field label="Nhóm"><input className={inputCls} list="pi-cats" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="Cửa nhôm, Kính, Nội thất…" /><datalist id="pi-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field>
            <Field label="Tên hạng mục *" className="sm:col-span-2"><input className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Cửa đi nhôm Xingfa hệ 55, kính hộp" /></Field>
            <Field label="Đơn vị tính"><select className={inputCls} value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value as PriceUnit })}>{(Object.keys(PRICE_UNIT) as PriceUnit[]).map((u) => <option key={u} value={u}>{PRICE_UNIT[u].label}</option>)}</select></Field>
            {(edit.unit === 'M2' || edit.unit === 'MD') && <Field label={`Tối thiểu mỗi tấm (${PRICE_UNIT[edit.unit].short})`}><input className={inputCls} type="number" min={0} step={0.1} value={edit.minMeasure ?? 0} onChange={(e) => setEdit({ ...edit, minMeasure: Math.max(0, Number(e.target.value) || 0) })} /></Field>}
            <Field label={`Đơn giá bán / ${PRICE_UNIT[edit.unit].short} *`}><MoneyInput value={edit.price} onChange={(n) => setEdit({ ...edit, price: n })} /></Field>
            <Field label={`Giá vốn / ${PRICE_UNIT[edit.unit].short}`} hint="Chỉ dùng tính lãi gộp, không in ra báo giá"><MoneyInput value={edit.cost} onChange={(n) => setEdit({ ...edit, cost: n })} /></Field>
            <Field label="Ghi chú" className="sm:col-span-2"><input className={inputCls} value={edit.note ?? ''} onChange={(e) => setEdit({ ...edit, note: e.target.value || undefined })} placeholder="Màu, phụ kiện kèm theo…" /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

/**
 * Đồng bộ 2 chiều trưởng phòng <-> thông tin nhân sự:
 * gán userId làm trưởng phòng `code` -> cập nhật vai trò / phòng của người mới,
 * hạ người cũ về Sales Rep và gỡ chức trưởng phòng cũ của người mới (nếu có).
 */
export function applyHead(code: DeptCode, userId: string | undefined, departments: Department[], users: User[]) {
  const dept = departments.find((d) => d.code === code);
  const oldHeadId = dept?.headId;
  const nextDepts = departments.map((d) => {
    if (d.code === code) return { ...d, headId: userId };
    if (userId && d.headId === userId) return { ...d, headId: undefined };
    return d;
  });
  const nextUsers = users.map((u) => {
    if (u.id === userId) return { ...u, dept: code, role: headRoleFor(u.role) };
    if (u.id === oldHeadId && oldHeadId !== userId && u.role === 'DEPT_HEAD') return { ...u, role: 'SALES_REP' as Role, approvalLimit: 0 };
    return u;
  });
  return { nextDepts, nextUsers };
}

export function DeptModal({ code, onClose }: { code?: string; onClose: () => void }) {
  const { departments, setDepartments, users, setUsers, leads, notify } = useApp();
  const existing = departments.find((d) => d.code === code);
  const [f, setF] = useState<Department>(existing ?? { code: '', name: '', short: '', slaMinutes: 120, receivesLeads: true, active: true });
  const [touched, setTouched] = useState(false);
  // Danh sách đầy đủ nhân sự đang hoạt động; người của phòng này lên đầu
  const candidates = users.filter((u) => u.active).sort((a, b) => Number(b.dept === f.code) - Number(a.dept === f.code) || a.name.localeCompare(b.name));
  const openLeads = existing ? leads.filter((l) => l.dept === existing.code && OPEN_STATUSES.includes(l.status)).length : 0;
  const newHead = users.find((u) => u.id === f.headId);
  const oldHead = users.find((u) => u.id === existing?.headId);
  const e: Partial<Record<keyof Department, string>> = {};
  if (!existing && !/^[A-Z][A-Z0-9_]{2,24}$/.test(f.code)) e.code = 'Mã viết hoa không dấu, 3–25 ký tự, VD: EMD_CENTRAL';
  else if (!existing && departments.some((d) => d.code === f.code)) e.code = 'Mã phòng ban đã tồn tại';
  if (f.name.trim().length < 3) e.name = 'Nhập tên phòng ban';
  if (!f.short.trim()) e.short = 'Nhập tên ngắn';
  if (f.slaMinutes < 15 || f.slaMinutes > 1440) e.slaMinutes = 'SLA từ 15 đến 1.440 phút';
  if (existing && !f.active && openLeads > 0) e.active = `Còn ${openLeads} lead đang xử lý, cần chuyển trước khi ngừng hoạt động`;
  const err = (k: keyof Department) => (touched ? e[k] : undefined);
  const set = <K extends keyof Department>(k: K, v: Department[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) return;
    const clean: Department = { ...f, name: f.name.trim(), short: f.short.trim(), headId: existing?.headId };
    const base = existing ? departments.map((d) => (d.code === existing.code ? clean : d)) : [...departments, clean];
    const { nextDepts, nextUsers } = f.headId !== existing?.headId ? applyHead(clean.code, f.headId, base, users) : { nextDepts: base, nextUsers: users };
    setDepartments(nextDepts);
    setUsers(nextUsers);
    notify(existing ? `Đã cập nhật ${clean.name}` : `Đã thêm ${clean.name}`, 'teal');
    onClose();
  };

  return (
    <Modal title={existing ? `Sửa ${existing.name}` : 'Thêm phòng ban'} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button><button className={btnPrimary} onClick={save}>Lưu</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tên phòng ban *" error={err('name')} className="sm:col-span-2"><input className={inputCls} value={f.name} onChange={(ev) => set('name', ev.target.value)} placeholder="VD: Phòng EMD Miền Trung" /></Field>
        <Field label="Mã phòng ban *" error={err('code')} hint={existing ? 'Mã không đổi được sau khi tạo' : undefined}><input className={inputCls} disabled={!!existing} value={f.code} onChange={(ev) => set('code', ev.target.value.toUpperCase())} /></Field>
        <Field label="Tên ngắn *" error={err('short')}><input className={inputCls} value={f.short} onChange={(ev) => set('short', ev.target.value)} placeholder="EMD Trung" /></Field>
        <Field label="Trưởng phòng" className="sm:col-span-2" hint="Chọn bất kỳ nhân sự đang hoạt động; thông tin nhân sự được cập nhật tự động">
          <select className={inputCls} value={f.headId ?? ''} onChange={(ev) => set('headId', ev.target.value || undefined)}>
            <option value="">Chưa chỉ định</option>
            {candidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({ROLE_LABEL[u.role]}{u.dept ? `, ${departments.find((d) => d.code === u.dept)?.short ?? u.dept}` : ''})</option>)}
          </select>
        </Field>
        {f.headId !== existing?.headId && (newHead || oldHead) && (
          <div className="rounded bg-[rgb(var(--accent)/0.1)] p-3 text-xs text-[rgb(var(--accent-fg))] sm:col-span-2">
            {newHead && <p>{newHead.name} sẽ chuyển về {f.name || 'phòng này'} với vai trò {ROLE_LABEL[headRoleFor(newHead.role)]}.</p>}
            {oldHead && oldHead.role === 'DEPT_HEAD' && <p>{oldHead.name} thôi làm trưởng phòng, chuyển về Sales Rep.</p>}
          </div>
        )}
        <Field label="SLA tiếp nhận lead (phút)" error={err('slaMinutes')}><input className={inputCls} type="number" min={15} max={1440} value={f.slaMinutes} onChange={(ev) => set('slaMinutes', Number(ev.target.value))} /></Field>
        <div className="space-y-2 self-end pb-1">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.receivesLeads} onChange={(ev) => set('receivesLeads', ev.target.checked)} />Nhận lead từ Marketing</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.active} onChange={(ev) => set('active', ev.target.checked)} />Đang hoạt động</label>
          {err('active') && <p className="text-xs text-[rgb(var(--danger-fg))]">{err('active')}</p>}
        </div>
      </div>
    </Modal>
  );
}

export function UserModal({ id, onClose }: { id?: string; onClose: () => void }) {
  const { users, setUsers, departments, setDepartments, me, notify, audit, canDo, org } = useApp();
  const [cloudBusy, setCloudBusy] = useState(false);
  const [issued, setIssued] = useState<{ email: string; pw: string } | null>(null);
  const existing = users.find((u) => u.id === id);
  const [f, setF] = useState<User>(existing ?? { id: '', name: '', email: '', phone: '', role: 'SALES_REP', dept: departments.find((d) => d.receivesLeads)?.code, active: true, approvalLimit: 0 });
  const wasHeadOf = existing ? departments.find((d) => d.headId === existing.id)?.code : undefined;
  const [isHead, setIsHead] = useState(!!wasHeadOf);
  const [touched, setTouched] = useState(false);
  const needsDept = f.role !== 'BOD';
  const e: Partial<Record<keyof User, string>> = {};
  if (f.name.trim().length < 3) e.name = 'Nhập họ tên';
  if (!EMAIL_RE.test(f.email)) e.email = 'Email chưa đúng định dạng';
  else if (users.some((u) => u.email.toLowerCase() === f.email.toLowerCase() && u.id !== f.id)) e.email = 'Email đã được dùng';
  if (needsDept && !f.dept) e.dept = 'Chọn phòng ban';
  if (existing && existing.id === me.id && !f.active) e.active = 'Không thể tự khóa tài khoản đang đăng nhập';
  const err = (k: keyof User) => (touched ? e[k] : undefined);
  const set = <K extends keyof User>(k: K, v: User[K]) => setF((p) => ({ ...p, [k]: v }));
  const deptOf = departments.find((d) => d.code === f.dept);
  const currentHead = deptOf?.headId && deptOf.headId !== f.id ? users.find((u) => u.id === deptOf.headId) : undefined;

  const save = () => {
    setTouched(true);
    if (Object.keys(e).length) return;
    const uidNew = existing?.id ?? uid('u');
    let role = f.role;
    if (isHead && role === 'SALES_REP') role = 'DEPT_HEAD';
    if (!isHead && wasHeadOf && role === 'DEPT_HEAD') role = 'SALES_REP';
    const clean: User = { ...f, id: uidNew, role, name: f.name.trim(), email: f.email.trim().toLowerCase(), dept: needsDept ? f.dept : undefined, approvalLimit: role === 'DEPT_HEAD' || role === 'BOD' ? f.approvalLimit : 0 };
    let nextUsers = existing ? users.map((u) => (u.id === existing.id ? clean : u)) : [...users, clean];
    let nextDepts = departments.map((d) => (d.headId === uidNew && (!isHead || d.code !== clean.dept) ? { ...d, headId: undefined } : d));
    if (isHead && clean.dept) ({ nextDepts, nextUsers } = applyHead(clean.dept, uidNew, nextDepts, nextUsers));
    setUsers(nextUsers);
    setDepartments(nextDepts);
    if (existing && CLOUD_ON) {
      // Máy chủ: khóa tài khoản = thu hồi quyền đọc dữ liệu; đổi vai trò Giám đốc = đổi quyền cấp tài khoản
      if (existing.active && !clean.active) void cloud.revoke(clean.email, org.id).then(() => notify(`Đã khóa ${clean.name}, thu hồi quyền truy cập dữ liệu`, 'orange'), (er) => notify(cloudMessage(er), 'red'));
      else if (!existing.active && clean.active) notify(`Mở lại ${clean.name}: bấm "Đặt lại mật khẩu" để cấp lại quyền đăng nhập`, 'orange');
      else if (existing.role !== clean.role && clean.active) void cloud.provision(clean.email, org.id, null, clean.role === 'BOD', { role: clean.role, appUserId: clean.id }).catch((er) => { if (!/no_user/.test(String(er?.message))) notify(cloudMessage(er), 'red'); });
      if (existing.email.toLowerCase() !== clean.email) notify('Đã đổi email: bấm "Đặt lại mật khẩu" để tạo đăng nhập cho email mới', 'orange');
    }
    if (existing) { notify(`Đã cập nhật ${clean.name}`, 'teal'); onClose(); }
    else void issueTemp(uidNew, clean.email, 'CREATE', role);
  };

  /** Cấp mật khẩu tạm ngẫu nhiên (băm trước khi lưu), bắt đổi ở lần đăng nhập đầu */
  const issueTemp = async (id: string, email: string, why: 'CREATE' | 'RESET', roleNow?: Role) => {
    const pw = tempPassword();
    if (CLOUD_ON) {
      // Máy chủ: tạo / đặt lại tài khoản đăng nhập Supabase + gắn quyền vào doanh nghiệp
      const r = roleNow ?? users.find((u) => u.id === id)?.role;
      setCloudBusy(true);
      try { await cloud.provision(email, org.id, pw, r === 'BOD', r ? { role: r, appUserId: id } : undefined); }
      catch (er) { notify(cloudMessage(er), 'red'); if (why === 'CREATE') onClose(); return; }
      finally { setCloudBusy(false); }
      setUsers((p) => p.map((u) => (u.id === id ? { ...u, passwordHash: undefined, salt: undefined, mustChangePassword: true, failedAttempts: 0, lockedUntil: undefined, active: true } : u)));
      audit(why === 'CREATE' ? 'USER_CREATE' : 'PASSWORD_RESET', `${why === 'CREATE' ? 'Tạo tài khoản' : 'Đặt lại mật khẩu'} ${email}`, 'SECURITY');
      setIssued({ email, pw });
      return;
    }
    const h = await hashPassword(pw);
    setUsers((p) => p.map((u) => (u.id === id ? { ...u, passwordHash: h.hash, salt: h.salt, mustChangePassword: true, failedAttempts: 0, lockedUntil: undefined } : u)));
    audit(why === 'CREATE' ? 'USER_CREATE' : 'PASSWORD_RESET', `${why === 'CREATE' ? 'Tạo tài khoản' : 'Đặt lại mật khẩu'} ${email}`, 'SECURITY');
    setIssued({ email, pw });
  };
  if (issued) {
    return (
      <Modal title="Mật khẩu tạm" onClose={onClose} footer={<button className={btnPrimary} onClick={onClose}>Đã ghi lại</button>}>
        <p className="text-sm text-[rgb(var(--muted))]">Gửi mật khẩu này cho <b className="text-[rgb(var(--fg))]">{issued.email}</b> qua kênh riêng. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu. Mật khẩu chỉ hiện một lần.</p>
        <div className="mt-3 flex items-center gap-2 rounded border border-[rgb(var(--line))] bg-[rgb(var(--bg))] p-3">
          <code className="flex-1 select-all text-lg tracking-wider text-[rgb(var(--accent-fg))]">{issued.pw}</code>
          <button className={cn(btnGhost, btnSm)} onClick={() => navigator.clipboard?.writeText(issued.pw).then(() => notify('Đã sao chép', 'teal'))}><Copy className="h-3.5 w-3.5" aria-hidden />Sao chép</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={existing ? `Sửa nhân sự ${existing.name}` : 'Thêm nhân sự'} onClose={onClose} footer={<><button className={btnGhost} onClick={onClose}>Hủy</button>{existing && canDo('security.manage') && <button className={cn(btnGhost, 'mr-auto')} disabled={cloudBusy} onClick={() => void issueTemp(existing.id, existing.email, 'RESET')}><KeyRound className="h-4 w-4" aria-hidden />{existing.lockedUntil && existing.lockedUntil > Date.now() ? 'Mở khóa & đặt lại mật khẩu' : 'Đặt lại mật khẩu'}</button>}<button className={btnPrimary} onClick={save}>Lưu</button></>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Họ tên *" error={err('name')} className="sm:col-span-2"><input className={inputCls} value={f.name} onChange={(ev) => set('name', ev.target.value)} /></Field>
        <Field label="Email đăng nhập *" error={err('email')}><input className={inputCls} type="email" value={f.email} onChange={(ev) => set('email', ev.target.value)} /></Field>
        <Field label="Điện thoại (nhận Zalo ZNS)"><input type="tel" autoComplete="tel" className={inputCls} inputMode="tel" value={f.phone ?? ''} onChange={(ev) => set('phone', ev.target.value)} /></Field>
        <Field label="Chức danh"><input className={inputCls} placeholder="VD: Kế toán trưởng" value={f.title ?? ''} onChange={(ev) => set('title', ev.target.value || undefined)} /></Field>
        <Field label="Ngày sinh"><input className={inputCls} type="date" value={f.birthday ?? ''} onChange={(ev) => set('birthday', ev.target.value || undefined)} /></Field>
        <Field label="Vai trò">
          <select className={inputCls} value={f.role} onChange={(ev) => set('role', ev.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </Field>
        <Field label="Phòng ban" error={err('dept')}>
          <select className={inputCls} disabled={!needsDept} value={needsDept ? f.dept ?? '' : ''} onChange={(ev) => set('dept', ev.target.value || undefined)}>
            <option value="">{needsDept ? 'Chọn phòng ban' : 'Ban Giám đốc'}</option>
            {departments.filter((d) => d.active).map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </Field>
        {needsDept && f.dept && (
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]" checked={isHead} onChange={(ev) => setIsHead(ev.target.checked)} />
            <span>Là trưởng phòng {deptOf?.name}{isHead && currentHead ? <span className="block text-xs text-[rgb(var(--accent-fg))]">Thay {currentHead.name}; người này sẽ chuyển về Sales Rep.</span> : null}</span>
          </label>
        )}
        {(f.role === 'DEPT_HEAD' || f.role === 'BOD' || isHead) && (
          <Field label="Hạn mức duyệt đề xuất MDF" hint="Vượt hạn mức sẽ chuyển lên Ban Giám đốc" className="sm:col-span-2"><MoneyInput value={f.approvalLimit} onChange={(n) => set('approvalLimit', n)} /></Field>
        )}
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={f.active} onChange={(ev) => set('active', ev.target.checked)} />Tài khoản đang hoạt động</label>
          {err('active') && <p className="mt-1 text-xs text-[rgb(var(--danger-fg))]">{err('active')}</p>}
        </div>
      </div>
    </Modal>
  );
}

