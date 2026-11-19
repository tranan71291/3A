'use client';

import { Fragment, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Avatar } from '../../components/controls';
import { EmptyState, Panel, useSticky } from '../../components/ui';
import { ACTION_LABEL, ACTION_MODULE, btnGhost, btnSm, DEFAULT_SCOPE, fold, INITIAL_PERMS, inputBase, inputCls, LOCKED, MODULE_DESC, MODULE_ICON, MODULE_LABEL, moduleEnabled, MODULES, NAV_GROUPS, ROLE_LABEL, ROLES, SCOPE_LABEL, useApp } from '../../lib/core';
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
        <p className="text-sm text-[rgb(var(--muted))]">{view === 'ROLE' ? 'Mỗi tài khoản nhận quyền theo vai trò. Bật / tắt phân hệ và từng thao tác bên trong, chọn phạm vi dữ liệu được xem.' : 'Cấp thêm hoặc chặn riêng một quyền cho từng tài khoản, ưu tiên hơn quyền của vai trò. Mọi thay đổi ghi nhật ký bảo mật.'}</p>
      </Panel>

      {view === 'ROLE' ? (
        <>
          <section className="glass-card overflow-hidden rounded-xl" aria-label="Ma trận phân quyền">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[rgb(var(--ink)/0.08)] text-[12px] text-[rgb(var(--muted))]">
                    <th className="px-4 py-2.5 text-left font-normal">Phân hệ</th>
                    {ROLES.map((r) => (
                      <th key={r} className="px-2 py-2 text-center font-normal">
                        <button type="button" onClick={() => setRole(r)} aria-pressed={role === r} className={cn('rounded-md px-2 py-1', role === r ? 'bg-[rgb(var(--raised))] text-[rgb(var(--fg))]' : 'hover:text-[rgb(var(--fg))]')}>
                          <span className="block font-medium">{ROLE_LABEL[r]}</span>
                          <span className="block font-mono text-[11px]">{users.filter((u) => u.role === r && u.active).length} tk · {SCOPE_LABEL[roleScope(r)].label}</span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.id}>
                      <tr><td colSpan={ROLES.length + 1} className="bg-[rgb(var(--sunken))] px-4 py-1.5 text-[12px] text-[rgb(var(--muted))]">{g.title}</td></tr>
                      {g.list.map((m) => (
                        <tr key={m} className="border-t border-[rgb(var(--ink)/0.06)]">
                          <td className="px-4 py-2"><span className="block font-medium">{MODULE_LABEL[m]}</span><span className="block max-w-[260px] truncate text-[12px] text-[rgb(var(--muted))]">{MODULE_DESC[m]}</span></td>
                          {ROLES.map((r) => {
                            const on = roleMod(r, m);
                            const acts = actsOf(m);
                            const n = acts.filter((x) => roleAct(r, x)).length;
                            return (
                              <td key={r} className={cn('px-2 py-2 text-center', role === r && 'bg-[rgb(var(--ink)/0.02)]')}>
                                <span className="inline-flex items-center gap-2">
                                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--fg))]" checked={on} disabled={!canEdit || LOCKED(r, m)} onChange={(e) => setMod(r, m, e.target.checked)} aria-label={`${ROLE_LABEL[r]} truy cập ${MODULE_LABEL[m]}`} />
                                  {acts.length > 0 && <button type="button" className={cn('font-mono text-[11.5px] hover:underline', on ? 'text-[rgb(var(--fg2))]' : 'text-[rgb(var(--faint))]')} onClick={() => { setRole(r); setTimeout(() => document.getElementById(`perm-${m}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }} title={`Xem ${acts.length} thao tác của ${ROLE_LABEL[r]}`}>{n}/{acts.length}</button>}
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
          <p className="text-xs text-[rgb(var(--muted))]">Ô tích = được truy cập phân hệ. Số = thao tác đang bật / tổng; bấm để sửa chi tiết vai trò đó bên dưới</p>
          <PermAiReview summary={ROLES.map((r) => `${ROLE_LABEL[r]} (${users.filter((u) => u.role === r && u.active).length} tài khoản, phạm vi ${SCOPE_LABEL[roleScope(r)].label}): ` + mods.map((m) => `${MODULE_LABEL[m]} ${roleMod(r, m) ? 'có' : 'không'}${actsOf(m).length ? ` [${actsOf(m).filter((x) => roleAct(r, x)).map((x) => ACTION_LABEL[x]).join('; ') || 'không thao tác'}]` : ''}`).join(', ')).join('\n')} />
          <h3 className="pt-2 text-[15px] font-medium">Chi tiết vai trò: {ROLE_LABEL[role]}</h3>
          <Panel title={`Phạm vi dữ liệu: ${ROLE_LABEL[role]}`}>
            <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Phạm vi dữ liệu">
              {(Object.keys(SCOPE_LABEL) as DataScope[]).map((sc) => (
                <button key={sc} role="radio" aria-checked={roleScope(role) === sc} disabled={!canEdit || role === 'BOD'} onClick={() => { setPerms((p) => ({ ...p, scope: { ...(p.scope ?? {}), [role]: sc } })); audit('PERM_CHANGE', `${ROLE_LABEL[role]}: phạm vi ${SCOPE_LABEL[sc].label}`, 'SECURITY'); }}
                  className={cn('rounded-md border px-3 py-2 text-left disabled:opacity-60', roleScope(role) === sc ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.06)]' : 'border-[rgb(var(--line))]')}>
                  <p className="text-sm font-medium">{SCOPE_LABEL[sc].label}</p><p className="text-[11px] text-[rgb(var(--muted))]">{SCOPE_LABEL[sc].hint}</p>
                </button>
              ))}
            </div>
          </Panel>
          {groups.map((g) => (
            <Panel key={g.id} title={g.title} action={canEdit && role !== 'BOD' ? (
              <div className="flex gap-1.5"><button className={cn(btnGhost, btnSm)} onClick={() => g.list.forEach((m) => { setMod(role, m, true); actsOf(m).forEach((a) => setAct(role, a, true)); })}>Cho phép tất cả</button><button className={cn(btnGhost, btnSm)} onClick={() => g.list.forEach((m) => { setMod(role, m, false); actsOf(m).forEach((a) => setAct(role, a, false)); })}>Tắt tất cả</button></div>
            ) : undefined}>
              <ul className="divide-y divide-[rgb(var(--line))]">
                {g.list.map((m) => { const Icon = MODULE_ICON[m]; const on = roleMod(role, m); return (
                  <li key={m} id={`perm-${m}`} className="scroll-mt-24 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--ink)/0.05)]"><Icon className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /></span>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{MODULE_LABEL[m]}</p><p className="truncate text-[11px] text-[rgb(var(--muted))]">{MODULE_DESC[m]}</p></div>
                      <span className="text-xs text-[rgb(var(--muted))]">Truy cập</span><Switch on={on} disabled={!canEdit || LOCKED(role, m)} onChange={(v) => setMod(role, m, v)} label={`${ROLE_LABEL[role]} truy cập ${MODULE_LABEL[m]}`} />
                    </div>
                    {actsOf(m).length > 0 && (
                      <div className={cn('mt-2 flex flex-wrap gap-1.5 pl-11', !on && 'opacity-40')}>
                        {actsOf(m).map((a) => { const v = roleAct(role, a); return (
                          <label key={a} className={cn('inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', v ? 'border-[rgb(var(--success)/0.5)] bg-[rgb(var(--success)/0.08)]' : 'border-[rgb(var(--line))]')}>
                            <input type="checkbox" className="h-3.5 w-3.5 accent-[rgb(var(--success))]" checked={v} disabled={!canEdit || !on || LOCKED(role, undefined, a)} onChange={(e) => setAct(role, a, e.target.checked)} />{ACTION_LABEL[a]}
                          </label>
                        ); })}
                      </div>
                    )}
                  </li>
                ); })}
              </ul>
            </Panel>
          ))}
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

