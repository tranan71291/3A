'use client';

import { useState } from 'react';
import { BookUser, Copy, Download, ExternalLink, History, Mail, MessageSquare, Phone, Plus, Search, Star, Tag } from 'lucide-react';
import { PAvatar } from '../../app/header';
import { Pagination, usePaged } from '../../components/controls';
import { Chip, EmptyState, Tabs, useSticky } from '../../components/ui';
import { bizMode, btnGhost, btnPrimary, btnSm, contactKey, dmId, downloadText, fmtDate, fold, initials, inputBase, inputCls, PRESENCE_META, presenceOf, ROLE_LABEL, segName, uid, useApp, vcard } from '../../lib/core';
import type { ContactItem, ContactPrefs, DeptCode } from '../../lib/types';
import { cn } from '../../lib/utils';

/** Danh bạ: yêu thích / gần đây / nhãn lưu riêng từng người trên máy (tiện ích cá nhân, không đồng bộ) */
export function useContactPrefs(org: string, user: string) {
  const [p, setP] = useState<ContactPrefs>(() => { try { return { fav: [], recent: [], labels: [], ...JSON.parse(localStorage.getItem(contactKey(org, user)) ?? '{}') }; } catch { return { fav: [], recent: [], labels: [] }; } });
  const save = (fn: (x: ContactPrefs) => ContactPrefs) => setP((x) => { const n = fn(x); try { localStorage.setItem(contactKey(org, user), JSON.stringify(n)); } catch { /* bỏ qua */ } return n; });
  return { p, save };
}

export function ContactsPage() {
  const { me, users, departments, myCustomers, company, org, canSee, go, openCustomer, notify } = useApp();
  const { p, save } = useContactPrefs(org.id, me?.id ?? 'x');
  const [tab, setTab] = useSticky<'staff' | 'customer'>('ContactsPage.tab', 'staff');
  const [view, setView] = useSticky<string>('ContactsPage.view', 'all');
  const [q, setQ] = useSticky('ContactsPage.q', '');
  const [grp, setGrp] = useSticky('ContactsPage.grp', 'ALL');
  const [newLabel, setNewLabel] = useState('');
  const [labelFor, setLabelFor] = useState<string | null>(null);
  const seeCust = canSee('customers');
  const deptName = (d?: DeptCode) => departments.find((x) => x.code === d)?.name ?? 'Ban Giám đốc';
  const staff: ContactItem[] = users.filter((u) => u.active).map((u) => ({ key: `u:${u.id}`, kind: 'staff', name: u.name, title: u.title || ROLE_LABEL[u.role], org: company.shortName, phone: u.phone, email: u.email, extra: u.birthday ? `Sinh nhật ${fmtDate(u.birthday).slice(0, 5)}` : undefined, user: u, group: deptName(u.dept) }));
  const cust: ContactItem[] = seeCust ? myCustomers.filter((c) => c.contactName || c.contactPhone).map((c) => ({ key: `c:${c.id}`, kind: 'customer', name: c.contactName || c.name, title: c.contactTitle || 'Người liên hệ', org: c.name, phone: c.contactPhone, email: c.contactEmail, extra: c.code, customer: c, group: segName(c.segment) })) : [];
  const base = tab === 'staff' ? staff : cust;
  const groups = Array.from(new Set(base.map((c) => c.group))).sort((a, b) => a.localeCompare(b, 'vi'));
  const label = p.labels.find((l) => l.id === view);
  const fq = fold(q.trim());
  const list = base
    .filter((c) => view === 'all' || (view === 'fav' && p.fav.includes(c.key)) || (view === 'recent' && p.recent.includes(c.key)) || (label && label.ids.includes(c.key)))
    .filter((c) => grp === 'ALL' || c.group === grp)
    .filter((c) => !fq || fold(`${c.name} ${c.title} ${c.org} ${c.phone ?? ''} ${c.email ?? ''} ${c.extra ?? ''}`).includes(fq))
    .sort((a, b) => (view === 'recent' ? p.recent.indexOf(a.key) - p.recent.indexOf(b.key) : a.name.localeCompare(b.name, 'vi')));
  const paged = usePaged(list, 12);
  const touch = (k: string) => save((x) => ({ ...x, recent: [k, ...x.recent.filter((r) => r !== k)].slice(0, 20) }));
  const toggleFav = (k: string) => save((x) => ({ ...x, fav: x.fav.includes(k) ? x.fav.filter((f) => f !== k) : [...x.fav, k] }));
  const toggleLabel = (lid: string, k: string) => save((x) => ({ ...x, labels: x.labels.map((l) => (l.id === lid ? { ...l, ids: l.ids.includes(k) ? l.ids.filter((i) => i !== k) : [...l.ids, k] } : l)) }));
  const addLabel = () => { const n = newLabel.trim(); if (!n) return; save((x) => ({ ...x, labels: [...x.labels, { id: uid('lb'), name: n, ids: [] }] })); setNewLabel(''); notify(`Đã tạo nhãn ${n}`, 'teal'); };
  const copy = (t: string) => { void navigator.clipboard?.writeText(t).then(() => notify(`Đã sao chép ${t}`, 'teal'), () => notify('Trình duyệt chặn sao chép', 'red')); };
  const views = [{ id: 'all', label: 'Tất cả liên hệ', icon: BookUser, n: base.length }, { id: 'recent', label: 'Xem gần đây', icon: History, n: base.filter((c) => p.recent.includes(c.key)).length }, { id: 'fav', label: 'Yêu thích', icon: Star, n: base.filter((c) => p.fav.includes(c.key)).length }];
  const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-md border border-[rgb(var(--line))] text-[rgb(var(--muted))] transition-colors hover:border-[rgb(var(--secondary)/0.6)] hover:text-[rgb(var(--fg))]';
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-4">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Nhóm liên hệ">
          {views.map((v) => (
            <button key={v.id} className={cn('flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors', view === v.id ? 'bg-[rgb(var(--secondary)/0.12)] font-semibold text-[rgb(var(--secondary-fg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)]')} onClick={() => { setView(v.id); paged.setPage(1); }}>
              <v.icon className="h-4 w-4" aria-hidden /><span className="flex-1">{v.label}</span><span className="text-xs tabular-nums text-[rgb(var(--muted))]">{v.n}</span>
            </button>
          ))}
        </nav>
        <div>
          <p className="mb-1.5 px-3 text-[11px] font-semibold text-[rgb(var(--faint))]">Nhãn</p>
          <div className="flex flex-wrap gap-1 lg:flex-col">
            {p.labels.map((l) => <button key={l.id} className={cn('flex items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm', view === l.id ? 'bg-[rgb(var(--secondary)/0.12)] font-semibold text-[rgb(var(--secondary-fg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)]')} onClick={() => { setView(l.id); paged.setPage(1); }}><Tag className="h-3.5 w-3.5" aria-hidden /><span className="flex-1 truncate">{l.name}</span><span className="text-xs tabular-nums text-[rgb(var(--muted))]">{base.filter((c) => l.ids.includes(c.key)).length}</span></button>)}
          </div>
          <div className="mt-2 flex gap-1.5 px-1"><input className={cn(inputBase, 'min-w-0 flex-1 py-1.5 text-xs')} placeholder="Tạo nhãn mới" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLabel()} aria-label="Tên nhãn mới" /><button className={cn(btnGhost, btnSm)} onClick={addLabel} aria-label="Thêm nhãn"><Plus className="h-3.5 w-3.5" aria-hidden /></button></div>
        </div>
      </aside>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {seeCust && <Tabs variant="pill" tabs={[{ id: 'staff' as const, label: 'Nội bộ', count: staff.length }, { id: 'customer' as const, label: 'Khách hàng', count: cust.length }]} value={tab} onChange={(t) => { setTab(t); setGrp('ALL'); paged.setPage(1); }} />}
          <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--faint))]" aria-hidden /><input className={cn(inputCls, 'pl-9')} placeholder="Tìm tên, chức danh, công ty, số điện thoại, email" value={q} onChange={(e) => { setQ(e.target.value); paged.setPage(1); }} aria-label="Tìm liên hệ" /></div>
          <select className={cn(inputBase, 'sm:w-56')} value={grp} onChange={(e) => { setGrp(e.target.value); paged.setPage(1); }} aria-label={tab === 'staff' ? 'Phòng ban' : 'Nhóm khách hàng'}>
            <option value="ALL">{tab === 'staff' ? 'Tất cả phòng ban' : 'Tất cả nhóm khách hàng'}</option>{groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <p className="text-sm text-[rgb(var(--muted))]">{label ? `Nhãn ${label.name}` : views.find((v) => v.id === view)?.label} ({list.length})</p>
        {list.length ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {paged.slice.map((c) => {
              const fav = p.fav.includes(c.key);
              const self = c.user?.id === me?.id;
              return (
                <article key={c.key} className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4">
                  <div className="flex items-start gap-3">
                    {c.user ? <PAvatar user={c.user} size={48} meId={me?.id} /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--secondary)/0.15)] text-base font-semibold text-[rgb(var(--secondary-fg))]">{initials(c.name)}</span>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{c.name}{self && <span className="ml-1.5 text-xs font-normal text-[rgb(var(--muted))]">(bạn)</span>}</p>
                      <p className="truncate text-sm text-[rgb(var(--fg2))]">{c.title}</p>
                      <p className="truncate text-xs text-[rgb(var(--muted))]">{c.kind === 'staff' ? `${c.group} · ${c.org}` : `${c.org}${c.extra ? ` · ${c.extra}` : ''}`}</p>
                    </div>
                    <button className={cn(iconBtn, fav && 'border-[rgb(var(--accent)/0.6)] text-[rgb(var(--accent))]')} onClick={() => toggleFav(c.key)} aria-pressed={fav} aria-label={fav ? `Bỏ yêu thích ${c.name}` : `Yêu thích ${c.name}`}><Star className={cn('h-4 w-4', fav && 'fill-current')} aria-hidden /></button>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div className="min-w-0"><dt className="text-[11px] text-[rgb(var(--muted))]">Điện thoại</dt><dd className="truncate">{c.phone ? <a className="text-[rgb(var(--secondary-fg))] hover:underline" href={`tel:${c.phone.replace(/\s/g, '')}`} onClick={() => touch(c.key)}>{c.phone}</a> : '—'}</dd></div>
                    <div className="min-w-0"><dt className="text-[11px] text-[rgb(var(--muted))]">Email</dt><dd className="truncate">{c.email ? <a className="text-[rgb(var(--secondary-fg))] hover:underline" href={`mailto:${c.email}`} onClick={() => touch(c.key)}>{c.email}</a> : '—'}</dd></div>
                    {c.kind === 'staff' && <div className="min-w-0"><dt className="text-[11px] text-[rgb(var(--muted))]">Trạng thái</dt><dd>{PRESENCE_META[presenceOf(c.user, me?.id)].label}</dd></div>}
                    {c.kind === 'staff' && <div className="min-w-0"><dt className="text-[11px] text-[rgb(var(--muted))]">Ngày sinh</dt><dd>{c.user?.birthday ? fmtDate(c.user.birthday) : '—'}</dd></div>}
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[rgb(var(--ink)/0.06)] pt-3">
                    {c.kind === 'staff' && !self && me && <button className={cn(btnPrimary, btnSm)} onClick={() => { touch(c.key); go('messages', dmId(me.id, c.user!.id)); }}><MessageSquare className="h-3.5 w-3.5" aria-hidden />Chat</button>}
                    {c.kind === 'customer' && c.customer && <button className={cn(btnPrimary, btnSm)} onClick={() => { touch(c.key); if (bizMode(company) === 'MFG') go('customers', c.customer!.code); else { go('customers'); openCustomer(c.customer!.id); } }}><ExternalLink className="h-3.5 w-3.5" aria-hidden />Hồ sơ khách</button>}
                    {c.phone && <a className={iconBtn} href={`tel:${c.phone.replace(/\s/g, '')}`} onClick={() => touch(c.key)} aria-label={`Gọi ${c.name}`} title="Gọi"><Phone className="h-4 w-4" aria-hidden /></a>}
                    {c.email && <a className={iconBtn} href={`mailto:${c.email}`} onClick={() => touch(c.key)} aria-label={`Gửi email ${c.name}`} title="Email"><Mail className="h-4 w-4" aria-hidden /></a>}
                    {(c.phone || c.email) && <button className={iconBtn} onClick={() => copy(c.phone || c.email || '')} aria-label={`Sao chép liên hệ ${c.name}`} title="Sao chép"><Copy className="h-4 w-4" aria-hidden /></button>}
                    <button className={iconBtn} onClick={() => { touch(c.key); downloadText(`${c.name}.vcf`, vcard(c), 'text/vcard'); }} aria-label={`Tải vCard ${c.name}`} title="Lưu vào danh bạ điện thoại (vCard)"><Download className="h-4 w-4" aria-hidden /></button>
                    {p.labels.length > 0 && (
                      <div className="relative">
                        <button className={iconBtn} onClick={() => setLabelFor(labelFor === c.key ? null : c.key)} aria-expanded={labelFor === c.key} aria-label={`Gắn nhãn ${c.name}`} title="Gắn nhãn"><Tag className="h-4 w-4" aria-hidden /></button>
                        {labelFor === c.key && <div className="absolute right-0 top-9 z-20 w-48 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 shadow-[var(--shadow)]">{p.labels.map((l) => <label key={l.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[rgb(var(--ink)/0.05)]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={l.ids.includes(c.key)} onChange={() => toggleLabel(l.id, c.key)} />{l.name}</label>)}</div>}
                      </div>
                    )}
                    <span className="ml-auto flex flex-wrap gap-1">{p.labels.filter((l) => l.ids.includes(c.key)).map((l) => <Chip key={l.id} tone="blue">{l.name}</Chip>)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState art="search" text={view === 'fav' ? 'Chưa có liên hệ yêu thích' : view === 'recent' ? 'Chưa xem liên hệ nào gần đây' : 'Không có liên hệ phù hợp'} hint={view === 'fav' ? 'Bấm ngôi sao trên thẻ liên hệ để thêm vào đây.' : 'Thử bỏ bớt bộ lọc hoặc đổi từ khóa.'} />}
        {list.length > 12 && <Pagination paged={paged} unit="liên hệ" />}
      </div>
    </div>
  );
}

