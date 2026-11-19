'use client';

import { Fragment, useState } from 'react';
import { Lock, RefreshCw, Sparkles } from 'lucide-react';
import { Avatar } from '../../components/controls';
import { EmptyState, Panel, useSticky } from '../../components/ui';
import { ACTION_LABEL, ACTION_MODULE, btnGhost, btnSm, DEFAULT_SCOPE, fold, INITIAL_PERMS, inputBase, inputCls, LOCKED, MODULE_DESC, MODULE_LABEL, moduleEnabled, MODULES, NAV_GROUPS, ROLE_LABEL, ROLES, SCOPE_LABEL, useApp } from '../../lib/core';
import type { Action, DataScope, Module, Role, User, UserPerm } from '../../lib/types';
import { cn } from '../../lib/utils';
import { parseAiJson, useAi } from '../ai/ai-core';
import { Switch } from '../platform/console';

/** v42: AI rà soát phân quyền: chỉ gợi ý, không tự đổi quyền */
export function PermAiReview({ summary }: { summary: string }) {
  const ai = useAi('copilot');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ level: string; title: string; detail: string }[] | null>(null);
  const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true); setErr('');
    const r = await ai.ask({ maxTokens: 900, prompt: `Rà soát phân quyền CRM dưới đây theo nguyên tắc quyền tối thiểu và phân tách trách nhiệm (người lập không tự duyệt, kế toán đối soát, Giám đốc dự phòng). Chỉ nêu tối đa 5 điểm đáng chú ý nhất, dựa đúng dữ liệu. CHỈ trả về JSON: {"items":[{"level":"cao|vừa|thấp","title":"…","detail":"…"}]}\n\n${summary}` });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    const d = parseAiJson<{ items?: { level: string; title: string; detail: string }[] }>(r.text);
    setRes((d?.items ?? []).slice(0, 5));
  };
  const tone = (l: string) => (/cao/i.test(l) ? 'bg-[rgb(var(--danger))]' : /vừa/i.test(l) ? 'bg-[rgb(var(--accent))]' : 'bg-[rgb(var(--faint))]');
  return (
    <section className="glass-card rounded-xl p-4" aria-label="Rà soát phân quyền">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-[rgb(var(--fg2))]" aria-hidden /><b className="text-[14px] font-medium">Rà soát phân quyền</b>
        <span className="text-xs text-[rgb(var(--muted))]">{ai.available ? `${ai.label} đọc ma trận và gợi ý, không tự đổi quyền` : 'cần bật trợ lý AI ở Cài đặt › AI & trợ lý'}</span>
        <button className={cn(btnGhost, btnSm, 'ml-auto')} disabled={!ai.available || busy} onClick={() => void run()}>{busy ? <><RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />Đang rà soát…</> : res ? 'Rà soát lại' : 'Rà soát'}</button>
      </div>
      {err && <p className="mt-2 text-[13px] text-[rgb(var(--danger-fg))]">{err}</p>}
      {res && (res.length ? (
        <ul className="mt-2 divide-y divide-[rgb(var(--ink)/0.06)]">
          {res.map((x, i) => <li key={i} className="flex gap-2.5 py-2 text-[13px]"><span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', tone(x.level))} aria-hidden /><span><b className="block font-medium">{x.title}</b><span className="text-[12.5px] text-[rgb(var(--muted))]">{x.detail}</span></span></li>)}
        </ul>
      ) : <p className="mt-2 text-[13px] text-[rgb(var(--muted))]">Không thấy điểm cần chú ý</p>)}
    </section>
  );
}

/** Ô tích của trang Phân quyền: 16px, bo 4px; khóa = ổ khóa trên nền xám */
export function PermTick({ on, locked }: { on: boolean; locked?: boolean }) {
  if (locked) return <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-[rgb(var(--ink)/0.1)]"><Lock className="h-2.5 w-2.5 text-[rgb(var(--muted))]" aria-hidden /></span>;
  return on
    ? <span className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-[rgb(var(--fg))]"><svg viewBox="0 0 16 16" className="h-4 w-4 text-[rgb(var(--bg))]" aria-hidden><path d="M4.5 8.2l2.3 2.3 4.7-4.8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
    : <span className="block h-4 w-4 rounded-[4px] border-[1.5px] border-[rgb(var(--ink)/0.25)] bg-[rgb(var(--surface))]" />;
}

export function PermissionsSettings() {
  const { perms, setPerms, users, canDo, audit, company, me } = useApp();
  const canEdit = canDo('settings.edit');
  const [view, setView] = useSticky<'ROLE' | 'USER'>('Perm.view', 'ROLE');
  const [role, setRole] = useSticky<Role>('Perm.role', 'SALES_REP');
  const [uid0, setUid0] = useSticky<string>('Perm.user', '');
  const [q, setQ] = useState('');
  const mods = MODULES.filter((m) => moduleEnabled(company, m));
  const groups = NAV_GROUPS.map((g) => ({ ...g, list: g.list.filter((m) => mods.includes(m)) })).filter((g) => g.list.length);
  const actsOf = (m: Module) => (Object.keys(ACTION_LABEL) as Action[]).filter((a) => ACTION_MODULE[a] === m);
  const roleMod = (r: Role, m: Module) => perms.modules[r]?.[m] ?? INITIAL_PERMS.modules[r][m];
  const roleAct = (r: Role, a: Action) => (perms.actions[a] ?? INITIAL_PERMS.actions[a] ?? []).includes(r);
  const roleScope = (r: Role) => perms.scope?.[r] ?? DEFAULT_SCOPE[r];
  const setMod = (r: Role, m: Module, v: boolean) => { if (LOCKED(r, m)) return; setPerms((p) => ({ ...p, modules: { ...p.modules, [r]: { ...p.modules[r], [m]: v } } })); audit('PERM_CHANGE', `${ROLE_LABEL[r]}: ${v ? 'mở' : 'tắt'} phân hệ ${MODULE_LABEL[m]}`, 'SECURITY'); };
  const setAct = (r: Role, a: Action, v: boolean) => { if (LOCKED(r, undefined, a)) return; setPerms((p) => { const cur = p.actions[a] ?? INITIAL_PERMS.actions[a] ?? []; return { ...p, actions: { ...p.actions, [a]: v ? [...new Set([...cur, r])] : cur.filter((x) => x !== r) } }; }); audit('PERM_CHANGE', `${ROLE_LABEL[r]}: ${v ? 'cấp' : 'thu hồi'} "${ACTION_LABEL[a]}"`, 'SECURITY'); };
  const user = users.find((u) => u.id === uid0) ?? null;
  const up: UserPerm = (user && perms.users?.[user.id]) || {};
  const setUp = (fn: (x: UserPerm) => UserPerm, log: string) => { if (!user) return; setPerms((p) => ({ ...p, users: { ...(p.users ?? {}), [user.id]: fn(p.users?.[user.id] ?? {}) } })); audit('PERM_USER', `${user.name}: ${log}`, 'SECURITY'); };
  const overrides = (u: User) => { const x = perms.users?.[u.id]; return x ? Object.keys(x.modules ?? {}).length + Object.keys(x.actions ?? {}).length + (x.scope ? 1 : 0) : 0; };
  const Tri = ({ value, def, onChange, locked, label }: { value: boolean | undefined; def: boolean; onChange: (v: boolean | undefined) => void; locked?: boolean; label: string }) => (
    <div className="inline-flex shrink-0 rounded-md border border-[rgb(var(--line))] p-0.5 text-[11px]" role="radiogroup" aria-label={label}>
      {([[undefined, `Theo vai trò (${def ? 'có' : 'không'})`], [true, 'Cho phép'], [false, 'Chặn']] as const).map(([v, l]) => (
        <button key={String(v)} type="button" role="radio" aria-checked={value === v} disabled={!canEdit || locked} onClick={() => onChange(v)}
          className={cn('rounded px-2 py-1 font-medium disabled:opacity-50', value === v ? (v === undefined ? 'bg-[rgb(var(--ink)/0.08)] text-[rgb(var(--fg))]' : v ? 'bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success))]' : 'bg-[rgb(var(--danger)/0.12)] text-[rgb(var(--danger-fg))]') : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>{l}</button>
      ))}
    </div>
  );
  return (
    <div className="space-y-4">
      <Panel title="Phân quyền" action={
        <div className="flex rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--sunken))] p-0.5" role="tablist" aria-label="Kiểu phân quyền">
          {([['ROLE', 'Theo vai trò'], ['USER', 'Ngoại lệ từng tài khoản']] as const).map(([v, l]) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('rounded px-3 py-1.5 text-xs font-semibold', view === v ? 'bg-[rgb(var(--surface))] text-[rgb(var(--fg))] shadow-sm' : 'text-[rgb(var(--muted))]')}>{l}</button>)}
        </div>
      }>
        <p className="text-sm text-[rgb(var(--muted))]">{view === 'ROLE' ? 'Mỗi tài khoản nhận quyền theo vai trò. Bật / tắt phân hệ và từng thao tác, chọn phạm vi dữ liệu được xem' : 'Cấp thêm hoặc chặn riêng một quyền cho từng tài khoản, ưu tiên hơn quyền của vai trò. Mọi thay đổi ghi nhật ký bảo mật.'}</p>
      </Panel>

      {view === 'ROLE' ? (
        <>
          <section className="glass-card overflow-hidden rounded-xl" aria-label="Ma trận phân quyền">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed md:min-w-[860px] border-collapse text-[13px]">
                <colgroup><col className="w-[160px] md:w-[260px] 2xl:w-[300px]" />{ROLES.map((r) => <col key={r} />)}</colgroup>
                <thead>
                  <tr className="border-b border-[rgb(var(--ink)/0.08)]">
                    <th className="sticky left-0 z-10 bg-[rgb(var(--surface))] px-5 pb-3 pt-4 text-left align-bottom text-[12px] font-normal text-[rgb(var(--muted))]">Phân hệ</th>
                    {ROLES.map((r) => (
                      <th key={r} className={cn('relative p-0 align-bottom font-normal', role === r && 'bg-[rgb(var(--ink)/0.025)]')}>
                        {role === r && <span className="absolute inset-x-3 top-0 h-0.5 rounded-b-sm bg-[rgb(var(--accent))]" aria-hidden />}
                        <button type="button" onClick={() => setRole(r)} aria-pressed={role === r} className="block w-full px-2 pb-3 pt-4 text-center transition-colors hover:bg-[rgb(var(--ink)/0.03)]">
                          <span className="block truncate font-medium text-[rgb(var(--fg))]" title={ROLE_LABEL[r]}>{ROLE_LABEL[r]}</span>
                          <span className="mt-0.5 block truncate text-[11.5px] text-[rgb(var(--muted))]">{users.filter((u) => u.role === r && u.active).length} tài khoản</span>
                          <span className="block truncate text-[11.5px] text-[rgb(var(--muted))]" title={SCOPE_LABEL[roleScope(r)].hint}>{SCOPE_LABEL[roleScope(r)].label}</span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.id}>
                      {g.title ? <tr><td colSpan={ROLES.length + 1} className="h-9 px-5 pb-1 pt-3 align-bottom text-[12px] text-[rgb(var(--muted))]">{g.title}</td></tr> : <tr aria-hidden><td colSpan={ROLES.length + 1} className="h-3" /></tr>}
                      {g.list.map((m) => (
                        <tr key={m} className="border-t border-[rgb(var(--ink)/0.06)]">
                          <td className="sticky left-0 z-10 h-12 bg-[rgb(var(--surface))] px-5"><span className="block truncate font-medium">{MODULE_LABEL[m]}</span><span className="block truncate text-[12px] text-[rgb(var(--muted))]" title={MODULE_DESC[m]}>{MODULE_DESC[m]}</span></td>
                          {ROLES.map((r) => {
                            const on = roleMod(r, m);
                            const locked = LOCKED(r, m);
                            const acts = actsOf(m);
                            const n = acts.filter((x) => roleAct(r, x)).length;
                            return (
                              <td key={r} className={cn('h-12 px-2 text-center', role === r && 'bg-[rgb(var(--ink)/0.025)]')}>
                                <span className="inline-grid grid-cols-[16px_36px] items-center gap-2">
                                  <button type="button" role="checkbox" aria-checked={on} disabled={!canEdit || locked} onClick={() => setMod(r, m, !on)} title={locked ? 'Khóa, không đổi được' : undefined}
                                    aria-label={`${ROLE_LABEL[r]} truy cập ${MODULE_LABEL[m]}`} className="rounded-[4px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))] disabled:cursor-default"><PermTick on={on} locked={locked} /></button>
                                  {acts.length > 0
                                    ? <button type="button" className={cn('text-left font-mono text-[11.5px] tabular-nums hover:underline', !on || n === 0 ? 'text-[rgb(var(--faint))]' : n === acts.length ? 'font-medium text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg2))]')} onClick={() => { setRole(r); setTimeout(() => document.getElementById(`perm-${m}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }} title={`Xem ${acts.length} thao tác của ${ROLE_LABEL[r]}`}>{n}/{acts.length}</button>
                                    : <span aria-hidden />}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-[rgb(var(--muted))]">
            <span className="inline-flex items-center gap-1.5"><PermTick on />có truy cập</span>
            <span className="inline-flex items-center gap-1.5"><PermTick on={false} />không</span>
            <span className="inline-flex items-center gap-1.5"><PermTick on locked />khóa, không đổi được</span>
            <span className="inline-flex items-center gap-1.5"><span className="font-mono tabular-nums text-[rgb(var(--fg2))]">2/4</span>thao tác đang bật / tổng, bấm để sửa bên dưới</span>
          </p>
          <PermAiReview summary={ROLES.map((r) => `${ROLE_LABEL[r]} (${users.filter((u) => u.role === r && u.active).length} tài khoản, phạm vi ${SCOPE_LABEL[roleScope(r)].label}): ` + mods.map((m) => `${MODULE_LABEL[m]} ${roleMod(r, m) ? 'có' : 'không'}${actsOf(m).length ? ` [${actsOf(m).filter((x) => roleAct(r, x)).map((x) => ACTION_LABEL[x]).join('; ') || 'không thao tác'}]` : ''}`).join(', ')).join('\n')} />
          <h3 className="pt-2 text-[15px] font-medium">Chi tiết vai trò: {ROLE_LABEL[role]}</h3>
          <Panel title="Phạm vi dữ liệu">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label={`Phạm vi dữ liệu: ${ROLE_LABEL[role]}`}>
              {(Object.keys(SCOPE_LABEL) as DataScope[]).map((sc) => { const sel = roleScope(role) === sc; return (
                <button key={sc} type="button" role="radio" aria-checked={sel} disabled={!canEdit || role === 'BOD'} onClick={() => { setPerms((p) => ({ ...p, scope: { ...(p.scope ?? {}), [role]: sc } })); audit('PERM_CHANGE', `${ROLE_LABEL[role]}: phạm vi ${SCOPE_LABEL[sc].label}`, 'SECURITY'); }}
                  className={cn('flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors disabled:cursor-default', sel ? 'border-[rgb(var(--fg))]' : 'border-[rgb(var(--ink)/0.1)] hover:border-[rgb(var(--ink)/0.2)]', !sel && role === 'BOD' && 'opacity-60')}>
                  <span className={cn('mt-px h-4 w-4 shrink-0 rounded-full border-[1.5px]', sel ? 'border-[5px] border-[rgb(var(--fg))]' : 'border-[rgb(var(--ink)/0.25)]')} aria-hidden />
                  <span className="min-w-0"><span className="block text-[13px] font-medium">{SCOPE_LABEL[sc].label}</span><span className="block text-xs text-[rgb(var(--muted))]">{SCOPE_LABEL[sc].hint}</span></span>
                </button>
              ); })}
            </div>
          </Panel>
          <section className="glass-card overflow-hidden rounded-xl" aria-label={`Phân hệ và thao tác: ${ROLE_LABEL[role]}`}>
            {groups.map((g) => (
              <Fragment key={g.id}>
                <div className={cn('flex items-end gap-3 px-5 text-[12px] text-[rgb(var(--muted))]', g.title ? 'pb-1 pt-4' : 'pt-3')}>
                  <span>{g.title}</span>
                  {canEdit && role !== 'BOD' && (
                    <span className="ml-auto flex gap-3">
                      <button type="button" className="hover:text-[rgb(var(--fg))] hover:underline" onClick={() => g.list.forEach((m) => { setMod(role, m, true); actsOf(m).forEach((x) => setAct(role, x, true)); })}>Cho phép tất cả</button>
                      <button type="button" className="hover:text-[rgb(var(--fg))] hover:underline" onClick={() => g.list.forEach((m) => { setMod(role, m, false); actsOf(m).forEach((x) => setAct(role, x, false)); })}>Tắt tất cả</button>
                    </span>
                  )}
                </div>
                {g.list.map((m) => { const on = roleMod(role, m); const acts = actsOf(m); return (
                  <div key={m} id={`perm-${m}`} className="grid scroll-mt-24 grid-cols-[1fr_40px] gap-x-4 gap-y-2 border-t border-[rgb(var(--ink)/0.06)] px-5 py-3 md:grid-cols-[240px_1fr_40px]">
                    <div className="min-w-0"><p className="font-medium">{MODULE_LABEL[m]}</p><p className="text-xs text-[rgb(var(--muted))]">{MODULE_DESC[m]}</p></div>
                    <div className={cn('order-3 col-span-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 md:order-none md:col-span-1', !on && 'opacity-40')}>
                      {acts.map((x) => { const v = roleAct(role, x); const lk = LOCKED(role, undefined, x); return (
                        <button key={x} type="button" role="checkbox" aria-checked={v} disabled={!canEdit || !on || lk} onClick={() => setAct(role, x, !v)}
                          className="flex min-w-0 items-start gap-2 rounded-[4px] text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--accent))] disabled:cursor-default">
                          <span className="mt-px shrink-0"><PermTick on={v} locked={lk} /></span><span className="min-w-0">{ACTION_LABEL[x]}</span>
                        </button>
                      ); })}
                    </div>
                    <div className="justify-self-end pt-px"><Switch on={on} disabled={!canEdit || LOCKED(role, m)} onChange={(v) => setMod(role, m, v)} label={`${ROLE_LABEL[role]} truy cập ${MODULE_LABEL[m]}`} /></div>
                  </div>
                ); })}
              </Fragment>
            ))}
          </section>
        </>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr] [&>*]:min-w-0">
          <section className="glass-card rounded-md p-3">
            <input className={cn(inputCls, 'mb-2')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tài khoản…" aria-label="Tìm tài khoản" />
            <ul className="max-h-[70vh] space-y-0.5 overflow-y-auto">
              {users.filter((u) => !q || fold(`${u.name} ${u.email}`).includes(fold(q))).map((u) => (
                <li key={u.id}><button onClick={() => setUid0(u.id)} className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left', u.id === uid0 ? 'bg-[rgb(var(--secondary)/0.12)]' : 'hover:bg-[rgb(var(--ink)/0.04)]')}>
                  <Avatar name={u.name} size={30} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.name}</span><span className="block truncate text-[11px] text-[rgb(var(--muted))]">{ROLE_LABEL[u.role]}{!u.active ? ' · đã khóa' : ''}</span></span>
                  {overrides(u) > 0 && <span className="rounded-full bg-[rgb(var(--accent)/0.15)] px-1.5 text-[11px] font-semibold text-[rgb(var(--accent-fg))]">{overrides(u)}</span>}
                </button></li>
              ))}
            </ul>
          </section>
          {user ? (
            <section className="space-y-4">
              <Panel title={user.name} action={overrides(user) > 0 && canEdit ? <button className={cn(btnGhost, btnSm)} onClick={() => setUp(() => ({}), 'xóa mọi ngoại lệ')}>Xóa mọi ngoại lệ</button> : undefined}>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Avatar name={user.name} size={40} />
                  <div className="min-w-0 flex-1"><p className="text-[rgb(var(--muted))]">{user.email}</p><p>Vai trò <b>{ROLE_LABEL[user.role]}</b>{user.id === me.id ? ' (bạn)' : ''}</p></div>
                  <label className="flex items-center gap-2 text-xs">Phạm vi dữ liệu
                    <select className={cn(inputBase, 'h-9 py-0 text-xs')} value={up.scope ?? ''} disabled={!canEdit} onChange={(e) => setUp((x) => ({ ...x, scope: (e.target.value || undefined) as DataScope | undefined }), `phạm vi ${e.target.value ? SCOPE_LABEL[e.target.value as DataScope].label : 'theo vai trò'}`)}>
                      <option value="">Theo vai trò ({SCOPE_LABEL[roleScope(user.role)].label})</option>
                      {(Object.keys(SCOPE_LABEL) as DataScope[]).map((sc) => <option key={sc} value={sc}>{SCOPE_LABEL[sc].label}</option>)}
                    </select>
                  </label>
                </div>
              </Panel>
              {groups.map((g) => (
                <Panel key={g.id} title={g.title}>
                  <ul className="divide-y divide-[rgb(var(--line))]">
                    {g.list.map((m) => (
                      <li key={m} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2"><p className="min-w-0 flex-1 text-sm font-medium">{MODULE_LABEL[m]}</p>
                          <Tri value={up.modules?.[m]} def={roleMod(user.role, m)} locked={LOCKED(user.role, m)} label={`Truy cập ${MODULE_LABEL[m]}`} onChange={(v) => setUp((x) => { const n = { ...(x.modules ?? {}) }; if (v === undefined) delete n[m]; else n[m] = v; return { ...x, modules: n }; }, `${MODULE_LABEL[m]}: ${v === undefined ? 'theo vai trò' : v ? 'cho phép' : 'chặn'}`)} />
                        </div>
                        {actsOf(m).map((a) => (
                          <div key={a} className="mt-1.5 flex flex-wrap items-center gap-2 pl-4"><p className="min-w-0 flex-1 text-xs text-[rgb(var(--muted))]">{ACTION_LABEL[a]}</p>
                            <Tri value={up.actions?.[a]} def={roleAct(user.role, a)} locked={LOCKED(user.role, undefined, a)} label={ACTION_LABEL[a]} onChange={(v) => setUp((x) => { const n = { ...(x.actions ?? {}) }; if (v === undefined) delete n[a]; else n[a] = v; return { ...x, actions: n }; }, `${ACTION_LABEL[a]}: ${v === undefined ? 'theo vai trò' : v ? 'cho phép' : 'chặn'}`)} />
                          </div>
                        ))}
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </section>
          ) : <section className="glass-card flex items-center justify-center rounded-md p-10"><EmptyState art="search" text="Chọn một tài khoản" hint="Ngoại lệ dùng khi một người cần thêm hoặc bớt quyền so với vai trò, ví dụ Sales được duyệt giá hoặc Kế toán không xem Marketing." /></section>}
        </div>
      )}
      {!canEdit && <p className="text-xs text-[rgb(var(--muted))]">Chỉ Giám đốc được sửa phân quyền.</p>}
    </div>
  );
}

