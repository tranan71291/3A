'use client';

import { Fragment, useState } from 'react';
import { Check as CheckIcon, History, Lock, Minus, RefreshCw, Sparkles, Undo2 } from 'lucide-react';
import { Avatar } from '../../components/controls';
import { Chip, useSticky } from '../../components/ui';
import { ACTION_LABEL, ACTION_MODULE, btnGhost, btnPrimary, btnSm, DEFAULT_SCOPE, fold, INITIAL_PERMS, inputBase, LOCKED, MODULE_LABEL, moduleEnabled, MODULES, NAV_GROUPS, pActOf, PFEATS, pModOf, PTASKS, ROLE_LABEL, ROLES, SCOPE_LABEL, useApp } from '../../lib/core';
import type { Action, DataScope, PCtx, Perms, PFeat, PTask, Role, User, UserPerm } from '../../lib/types';
import { cn } from '../../lib/utils';
import { parseAiJson, useAi } from '../ai/ai-core';
import { SearchBox } from '../alux/orders';

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
        <span className="text-xs text-[rgb(var(--muted))]">{ai.available ? `${ai.label} đọc ma trận và gợi ý, không tự đổi quyền` : 'cần bật phân tích ở Cài đặt › AI & trợ lý'}</span>
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

/** Giá trị ô: on / một phần / có ngoại lệ tài khoản; null = không áp dụng */
export function pCell(P: Perms, c: PCtx, f: PFeat, t: PTask): { on: boolean; part: boolean; own: boolean } | null {
  const cell = t === 'access' && !f.sub ? 'MOD' : f.cells[t];
  if (!cell) return null;
  if (c.role === 'BOD') return { on: true, part: false, own: false };
  const up = c.uid ? P.users?.[c.uid] : undefined;
  if (cell === 'MOD') { const o = up?.modules?.[f.mod]; return { on: o ?? pModOf(P, c.role, f.mod), part: false, own: o !== undefined }; }
  const vs = cell.map((a) => up?.actions?.[a] ?? pActOf(P, c.role, a));
  const n = vs.filter(Boolean).length;
  return { on: n > 0, part: n > 0 && n < vs.length, own: cell.some((a) => up?.actions?.[a] !== undefined) };
}

export function pSet(P: Perms, c: PCtx, f: PFeat, t: PTask, v: boolean): Perms {
  const cell = t === 'access' && !f.sub ? 'MOD' : f.cells[t];
  if (!cell || c.role === 'BOD') return P;
  if (c.uid) {
    const up: UserPerm = { ...(P.users?.[c.uid] ?? {}) };
    if (cell === 'MOD') { const n = { ...(up.modules ?? {}) }; if (v === pModOf(P, c.role, f.mod)) delete n[f.mod]; else n[f.mod] = v; up.modules = n; }
    else { const n = { ...(up.actions ?? {}) }; cell.forEach((a) => { if (v === pActOf(P, c.role, a)) delete n[a]; else n[a] = v; }); up.actions = n; }
    return { ...P, users: { ...(P.users ?? {}), [c.uid]: up } };
  }
  if (cell === 'MOD') return { ...P, modules: { ...P.modules, [c.role]: { ...P.modules[c.role], [f.mod]: v } } };
  const acts = { ...P.actions };
  cell.forEach((a) => { const cur = acts[a] ?? INITIAL_PERMS.actions[a] ?? []; acts[a] = v ? Array.from(new Set([...cur, c.role])) : cur.filter((x) => x !== c.role); });
  return { ...P, actions: acts };
}

/** Ma trận chức năng × tác vụ cho một nhóm (hoặc một tài khoản) */
export function PermMatrix({ P, ctx, feats, onSet, canEdit, q }: { P: Perms; ctx: PCtx; feats: { title: string; rows: PFeat[] }[]; onSet: (f: PFeat, t: PTask, v: boolean) => void; canEdit: boolean; q: string }) {
  const k = fold(q.trim());
  const groups = feats.map((g) => ({ ...g, rows: g.rows.filter((f) => !k || fold(f.label).includes(k) || (f.sub ? false : g.rows.some((x) => x.sub && x.mod === f.mod && fold(x.label).includes(k)))) })).filter((g) => g.rows.length);
  const lockAll = ctx.role === 'BOD' || !canEdit;
  const colAll = (t: PTask) => { const cs = groups.flatMap((g) => g.rows.map((f) => pCell(P, ctx, f, t))).filter((x): x is NonNullable<typeof x> => !!x); return { on: cs.length > 0 && cs.every((x) => x.on && !x.part), some: cs.some((x) => x.on) }; };
  const box = (on: boolean, part: boolean, own: boolean, dis: boolean, label: string, click: () => void) => (
    <button type="button" role="checkbox" aria-checked={part ? 'mixed' : on} aria-label={label} disabled={dis} onClick={click}
      className={cn('inline-grid h-[18px] w-[18px] place-items-center rounded-[5px] border-[1.5px] transition-colors disabled:cursor-default', on ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'border-[rgb(var(--ink)/0.25)] bg-[rgb(var(--surface))]', own && 'ring-2 ring-[rgb(var(--accent)/0.5)] ring-offset-1 ring-offset-[rgb(var(--surface))]', dis && !on && 'opacity-40')}>
      {on && (part ? <Minus className="h-3 w-3" aria-hidden /> : <CheckIcon className="h-3 w-3" aria-hidden />)}
    </button>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] border-collapse text-[13.5px]">
        <thead><tr className="border-b border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.03)]">
          <th className="px-5 py-3 text-left text-[12.5px] font-normal text-[rgb(var(--muted))]">Chức năng</th>
          {PTASKS.map(([t, l]) => { const s = colAll(t); return (
            <th key={t} className="w-[78px] px-1 py-2 text-center text-[12.5px] font-normal text-[rgb(var(--muted))]"><div className="flex flex-col items-center gap-1.5">{box(s.on, !s.on && s.some, false, lockAll, `Bật / tắt cả cột ${l}`, () => groups.forEach((g) => g.rows.forEach((f) => { if (pCell(P, ctx, f, t)) onSet(f, t, !s.on); })))}<span>{l}</span></div></th>
          ); })}
        </tr></thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.title}>
              <tr><td colSpan={8} className="px-5 pb-1.5 pt-4 text-[12px] text-[rgb(var(--muted))]">{g.title}</td></tr>
              {g.rows.map((f) => {
                const acc = pCell(P, ctx, g.rows.find((x) => x.mod === f.mod && !x.sub) ?? f, 'access');
                const off = !!acc && !acc.on;
                return (
                  <tr key={f.id} className="border-t border-[rgb(var(--ink)/0.06)] hover:bg-[rgb(var(--ink)/0.02)]">
                    <td className={cn('h-10 whitespace-nowrap pr-3', f.sub ? 'pl-10' : 'pl-5')}>
                      {f.sub && <span className="mr-1.5 inline-block h-2.5 w-2 -translate-y-0.5 rounded-bl border-b border-l border-[rgb(var(--ink)/0.2)]" aria-hidden />}
                      <span className={cn(off && 'text-[rgb(var(--muted))]', !f.sub && 'font-medium')}>{f.label}</span>
                      {f.hint && <span className="ml-2 text-[12px] text-[rgb(var(--faint))]">{f.hint}</span>}
                    </td>
                    {PTASKS.map(([t, l]) => { const c = pCell(P, ctx, f, t); return c ? (
                      <td key={t} className="border-l border-[rgb(var(--ink)/0.04)] text-center">{box(c.on, c.part, c.own, lockAll || (off && t !== 'access') || (t === 'access' && !f.sub && LOCKED(ctx.role, f.mod)), `${f.label}: ${l}`, () => onSet(f, t, !c.on || c.part))}</td>
                    ) : <td key={t} className="border-l border-[rgb(var(--ink)/0.04)] bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(var(--ink)/0.035)_6px_7px)]" aria-label="Không áp dụng" />; })}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PermissionsSettings() {
  const { perms, setPerms, users, canDo, audit, company, auditLogs, userName } = useApp();
  const canEdit = canDo('settings.edit');
  const [view, setView] = useSticky<'MATRIX' | 'USERS' | 'LOG'>('Perm.view51', 'MATRIX');
  const [role, setRole] = useSticky<Role>('Perm.role', 'SALES_REP');
  const [uid, setUid] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Perms | null>(null);
  const P = draft ?? perms;
  const mods = MODULES.filter((m) => moduleEnabled(company, m));
  // nhóm chức năng theo nhóm menu; quyền chưa có ô nào thì thêm dòng riêng
  const used = new Set(PFEATS.flatMap((f) => Object.values(f.cells).flatMap((c) => (c === 'MOD' || !c ? [] : c))));
  const feats = NAV_GROUPS.map((g) => ({ title: g.title || 'Hệ thống', rows: g.list.filter((m) => mods.includes(m)).flatMap((m): PFeat[] => {
    const own = PFEATS.filter((f) => f.mod === m);
    const main: PFeat[] = own.some((f) => !f.sub) ? [] : [{ id: m, mod: m, label: MODULE_LABEL[m], cells: {} }];
    const extra = (Object.keys(ACTION_LABEL) as Action[]).filter((a) => ACTION_MODULE[a] === m && !used.has(a)).map((a): PFeat => ({ id: `x.${a}`, mod: m, sub: true, label: ACTION_LABEL[a], cells: { edit: [a] } }));
    return [...main, ...own, ...extra];
  }) })).filter((g) => g.rows.length);
  const allFeats = feats.flatMap((g) => g.rows);
  const ctx: PCtx = { role, uid: view === 'USERS' && uid ? uid : undefined };
  const scopeOf = (r: Role) => P.scope?.[r] ?? DEFAULT_SCOPE[r];
  const edit = (fn: (p: Perms) => Perms) => { if (!canEdit) return; setDraft((d) => fn(d ?? perms)); };
  // thay đổi chưa lưu (so với bản đang áp dụng)
  const changes: string[] = [];
  if (draft) {
    ROLES.forEach((r) => allFeats.forEach((f) => PTASKS.forEach(([t, l]) => { const a = pCell(perms, { role: r }, f, t); const b = pCell(draft, { role: r }, f, t); if (a && b && (a.on !== b.on || a.part !== b.part)) changes.push(`${ROLE_LABEL[r]} · ${f.label} · ${l} ${b.on ? 'bật' : 'tắt'}`); })));
    ROLES.forEach((r) => { if ((perms.scope?.[r] ?? DEFAULT_SCOPE[r]) !== (draft.scope?.[r] ?? DEFAULT_SCOPE[r])) changes.push(`${ROLE_LABEL[r]} · phạm vi ${SCOPE_LABEL[draft.scope?.[r] ?? DEFAULT_SCOPE[r]].label}`); });
    users.forEach((u) => { if (JSON.stringify(perms.users?.[u.id] ?? {}) !== JSON.stringify(draft.users?.[u.id] ?? {})) changes.push(`${u.name} · quyền riêng`); });
  }
  const save = () => { if (!draft) return; setPerms(draft); changes.slice(0, 40).forEach((c) => audit('PERM_CHANGE', c, 'SECURITY')); setDraft(null); };
  const members = users.filter((u) => u.role === role);
  const overrides = (u: User) => { const x = P.users?.[u.id]; return x ? Object.keys(x.modules ?? {}).length + Object.keys(x.actions ?? {}).length + (x.scope ? 1 : 0) : 0; };
  const user = uid ? users.find((u) => u.id === uid) : undefined;
  const TREE: [Role, number][] = [['BOD', 0], ['MKT_LEAD', 0], ['DEPT_HEAD', 0], ['SALES_REP', 1], ['ACCOUNTANT', 0]];
  const copyFrom = (src: Role) => edit((p) => {
    const acts = { ...p.actions };
    (Object.keys(ACTION_LABEL) as Action[]).forEach((a) => { const cur = acts[a] ?? INITIAL_PERMS.actions[a] ?? []; const on = (cur.includes(src)); acts[a] = on ? Array.from(new Set([...cur, role])) : cur.filter((x) => x !== role); });
    return { ...p, modules: { ...p.modules, [role]: { ...(p.modules[src] ?? INITIAL_PERMS.modules[src]) } }, actions: acts, scope: { ...(p.scope ?? {}), [role]: p.scope?.[src] ?? DEFAULT_SCOPE[src] } };
  });
  const seg = (on: boolean) => cn('whitespace-nowrap px-3 py-1.5 text-[13px]', on ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]');
  const tabCls = (on: boolean) => cn('-mb-px flex h-12 items-center gap-1.5 border-b-2 text-[14px] font-medium', on ? 'border-[rgb(var(--accent))] text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]');
  return (
    <div className="space-y-4 pb-16">
      <div className="grid gap-4 xl:grid-cols-[230px_1fr] [&>*]:min-w-0">
        <section className="glass-card h-fit rounded-xl py-2">
          <p className="px-4 pb-2 pt-2 text-[15px] font-medium">Nhóm quyền</p>
          {TREE.map(([r, lv]) => (
            <button key={r} onClick={() => { setRole(r); setUid(null); if (view === 'LOG') setView('MATRIX'); }} className={cn('relative flex h-9 w-full items-center gap-2 pr-4 text-left text-[13.5px]', lv ? 'pl-9' : 'pl-4', role === r && view !== 'LOG' ? 'bg-[rgb(var(--accent)/0.08)] font-medium shadow-[inset_2px_0_0_rgb(var(--accent))]' : 'hover:bg-[rgb(var(--ink)/0.03)]')}>
              {lv > 0 && <span className="absolute left-5 top-0 h-[18px] w-2.5 rounded-bl border-b border-l border-[rgb(var(--ink)/0.2)]" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{ROLE_LABEL[r]}</span>{r === 'BOD' && <Lock className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-label="Toàn quyền" />}<span className="text-[12px] tabular-nums text-[rgb(var(--muted))]">{users.filter((u) => u.role === r && u.active).length}</span>
            </button>
          ))}
          <div className="my-2 border-t border-[rgb(var(--line))]" />
          <button onClick={() => setView('USERS')} className="flex h-9 w-full items-center gap-2 px-4 text-left text-[13.5px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.03)]"><span className="flex-1">Ngoại lệ từng tài khoản</span><span className="text-[12px] tabular-nums text-[rgb(var(--muted))]">{users.filter((u) => overrides(u) > 0).length}</span></button>
          <button onClick={() => setView('LOG')} className={cn('flex h-9 w-full items-center gap-2 px-4 text-left text-[13.5px]', view === 'LOG' ? 'bg-[rgb(var(--accent)/0.08)] font-medium' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.03)]')}><span className="flex-1">Nhật ký thay đổi</span><History className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden /></button>
        </section>
        <div className="space-y-4">
          {view !== 'LOG' && (
            <section className="glass-card flex flex-wrap items-start gap-4 rounded-xl p-5">
              <div className="min-w-0">
                <h2 className="text-[18px] font-medium">{ROLE_LABEL[role]}</h2>
                <div className="mt-2 flex items-center gap-2"><span className="flex -space-x-1.5">{members.slice(0, 6).map((u) => <span key={u.id} className="rounded-full ring-2 ring-[rgb(var(--surface))]" title={u.name}><Avatar name={u.name} size={26} /></span>)}</span><span className="text-[12.5px] text-[rgb(var(--muted))]">{members.filter((u) => u.active).length} tài khoản{role === 'BOD' ? ' · luôn toàn quyền' : ''}</span></div>
              </div>
              <div className="ml-auto flex flex-col items-end gap-1.5">
                <p className="text-[12.5px] text-[rgb(var(--muted))]">Phạm vi dữ liệu</p>
                <div className="flex overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.12)] divide-x divide-[rgb(var(--ink)/0.08)]" role="radiogroup" aria-label="Phạm vi dữ liệu">
                  {(Object.keys(SCOPE_LABEL) as DataScope[]).map((sc) => <button key={sc} role="radio" aria-checked={scopeOf(role) === sc} title={SCOPE_LABEL[sc].hint} disabled={!canEdit || role === 'BOD'} className={seg(scopeOf(role) === sc)} onClick={() => edit((p) => ({ ...p, scope: { ...(p.scope ?? {}), [role]: sc } }))}>{SCOPE_LABEL[sc].label}</button>)}
                </div>
              </div>
            </section>
          )}
          <section className="glass-card min-w-0 overflow-hidden rounded-xl">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[rgb(var(--line))] px-5">
              <button className={tabCls(view === 'MATRIX')} onClick={() => setView('MATRIX')}>Ma trận quyền</button>
              <button className={tabCls(view === 'USERS')} onClick={() => setView('USERS')}>Người dùng <span className="rounded-full bg-[rgb(var(--ink)/0.06)] px-1.5 text-[11px] font-normal">{members.length}</span></button>
              <button className={tabCls(view === 'LOG')} onClick={() => setView('LOG')}>Nhật ký thay đổi</button>
              {view !== 'LOG' && (
                <div className="ml-auto flex items-center gap-2 py-2">
                  <div className="w-56"><SearchBox value={q} onChange={setQ} placeholder="Tìm chức năng" /></div>
                  {view === 'MATRIX' && role !== 'BOD' && canEdit && <select className={cn(inputBase, 'w-48')} value="" onChange={(e) => { if (e.target.value) copyFrom(e.target.value as Role); }} aria-label="Sao chép từ nhóm"><option value="">Sao chép từ nhóm…</option>{ROLES.filter((r) => r !== role && r !== 'BOD').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>}
                </div>
              )}
            </div>
            {view === 'MATRIX' && <PermMatrix P={P} ctx={ctx} feats={feats} canEdit={canEdit} q={q} onSet={(f, t, v) => edit((p) => pSet(p, { role }, f, t, v))} />}
            {view === 'USERS' && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-[13.5px]">
                    <thead><tr className="border-b border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.03)] text-left text-[12.5px] text-[rgb(var(--muted))]"><th className="py-2.5 pl-5 font-normal">Người dùng</th><th className="font-normal">Phạm vi dữ liệu</th><th className="font-normal">Quyền riêng</th><th className="font-normal">Trạng thái</th><th className="pr-5" /></tr></thead>
                    <tbody>{members.map((u) => { const n = overrides(u); const up = P.users?.[u.id] ?? {}; return (
                      <tr key={u.id} className={cn('cursor-pointer border-b border-[rgb(var(--ink)/0.06)]', uid === u.id ? 'bg-[rgb(var(--accent)/0.06)]' : 'hover:bg-[rgb(var(--ink)/0.02)]')} onClick={() => setUid(u.id)}>
                        <td className="py-2.5 pl-5"><span className="flex items-center gap-2.5"><Avatar name={u.name} size={28} /><span><span className="block font-medium">{u.name}</span><span className="block text-[12px] text-[rgb(var(--muted))]">{u.email}</span></span></span></td>
                        <td onClick={(e) => e.stopPropagation()}><select className={cn(inputBase, 'w-52 py-1')} value={up.scope ?? ''} disabled={!canEdit || role === 'BOD'} onChange={(e) => { const v = (e.target.value || undefined) as DataScope | undefined; edit((p) => ({ ...p, users: { ...(p.users ?? {}), [u.id]: { ...(p.users?.[u.id] ?? {}), scope: v } } })); }} aria-label={`Phạm vi của ${u.name}`}><option value="">Theo nhóm</option>{(Object.keys(SCOPE_LABEL) as DataScope[]).map((sc) => <option key={sc} value={sc}>{SCOPE_LABEL[sc].label}</option>)}</select></td>
                        <td>{n ? <span className="rounded-md border border-[rgb(var(--accent)/0.4)] px-2 py-0.5 text-[12px] text-[rgb(var(--accent-fg))]">{n} quyền riêng</span> : <span className="text-[rgb(var(--muted))]">Theo nhóm</span>}</td>
                        <td><Chip tone={u.active ? 'teal' : 'muted'}>{u.active ? 'Hoạt động' : 'Đã khóa'}</Chip></td>
                        <td className="pr-5 text-right">{n > 0 && canEdit && <button className={cn(btnGhost, btnSm)} onClick={(e) => { e.stopPropagation(); edit((p) => { const us = { ...(p.users ?? {}) }; delete us[u.id]; return { ...p, users: us }; }); }}><Undo2 className="h-3.5 w-3.5" aria-hidden />Đưa về theo nhóm</button>}</td>
                      </tr>
                    ); })}</tbody>
                  </table>
                  {!members.length && <p className="px-5 py-6 text-[13.5px] text-[rgb(var(--muted))]">Nhóm chưa có tài khoản</p>}
                </div>
                {user && (
                  <div className="border-t border-[rgb(var(--line))]">
                    <p className="flex flex-wrap items-center gap-2 px-5 pt-4 text-[14px]"><span className="font-medium">Quyền của {user.name}</span><span className="text-[12.5px] text-[rgb(var(--muted))]">ô viền cam là quyền riêng khác nhóm</span></p>
                    <PermMatrix P={P} ctx={ctx} feats={feats} canEdit={canEdit} q={q} onSet={(f, t, v) => edit((p) => pSet(p, { role, uid: user.id }, f, t, v))} />
                  </div>
                )}
              </>
            )}
            {view === 'LOG' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13.5px]">
                  <thead><tr className="border-b border-[rgb(var(--line))] bg-[rgb(var(--ink)/0.03)] text-left text-[12.5px] text-[rgb(var(--muted))]"><th className="py-2.5 pl-5 font-normal">Thời gian</th><th className="font-normal">Người thực hiện</th><th className="pr-5 font-normal">Thay đổi</th></tr></thead>
                  <tbody>{auditLogs.filter((x) => x.action.startsWith('PERM')).slice(0, 150).map((x) => (
                    <tr key={x.id} className="border-b border-[rgb(var(--ink)/0.06)]"><td className="whitespace-nowrap py-2.5 pl-5 tabular-nums text-[rgb(var(--fg2))]">{new Date(x.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</td><td>{x.userId ? userName(x.userId) : '—'}</td><td className="pr-5">{x.detail}</td></tr>
                  ))}</tbody>
                </table>
                {!auditLogs.some((x) => x.action.startsWith('PERM')) && <p className="px-5 py-6 text-[13.5px] text-[rgb(var(--muted))]">Chưa có thay đổi phân quyền</p>}
              </div>
            )}
          </section>
          {view === 'MATRIX' && <PermAiReview summary={ROLES.map((r) => `${ROLE_LABEL[r]} (phạm vi ${SCOPE_LABEL[scopeOf(r)].label}): ` + allFeats.map((f) => { const on = PTASKS.filter(([t]) => pCell(P, { role: r }, f, t)?.on).map(([, l]) => l); return on.length ? `${f.label} [${on.join(', ')}]` : ''; }).filter(Boolean).join('; ')).join('\n')} />}
          {!canEdit && <p className="text-xs text-[rgb(var(--muted))]">Chỉ Giám đốc được sửa phân quyền.</p>}
        </div>
      </div>
      {draft && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl bg-[rgb(var(--fg))] px-4 py-2.5 text-[13.5px] text-[rgb(var(--bg))] shadow-xl">
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent))]" aria-hidden /><b className="font-medium">{changes.length} thay đổi chưa lưu</b>
          <span className="min-w-0 flex-1 truncate opacity-60" title={changes.join('\n')}>{changes.slice(0, 3).join(' · ')}{changes.length > 3 ? ' …' : ''}</span>
          <button className="rounded-lg border border-white/25 px-3 py-1.5 hover:bg-white/10" onClick={() => setDraft(null)}>Bỏ thay đổi</button>
          <button className={btnPrimary} disabled={!changes.length} onClick={save}><CheckIcon className="h-4 w-4" aria-hidden />Lưu phân quyền</button>
        </div>
      )}
    </div>
  );
}

