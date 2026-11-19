'use client';

import { useState } from 'react';
import { BookUser, Copy, Download, ExternalLink, Eye, History, LayoutGrid, Mail, MessageSquare, Phone, Rows3, Search, Star, Tag } from 'lucide-react';
import { PAvatar } from '../../app/header';
import { Avatar, Pagination, RowMenu, usePaged } from '../../components/controls';
import { Chip, EmptyState, Panel, Table, Tabs, useSticky } from '../../components/ui';
import { bizMode, btnGhost, btnPrimary, btnSm, contactKey, dmId, downloadText, fmtDate, fold, initials, inputBase, inputCls, PRESENCE_META, presenceOf, ROLE_LABEL, rowCls, segName, tdCls, tdFirst, tdLast, uid, useApp, vcard } from '../../lib/core';
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
  const [layout, setLayout] = useSticky<'list' | 'card'>('ContactsPage.layout', 'list');
  const [labelOpen, setLabelOpen] = useState(false);
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
  const chips = [...views.map((v) => ({ id: v.id, label: v.id === 'all' ? 'Tất cả' : v.id === 'recent' ? 'Gần đây' : 'Yêu thích', n: v.n })), ...p.labels.map((l) => ({ id: l.id, label: l.name, n: base.filter((c) => l.ids.includes(c.key)).length }))];
  const seg = (on: boolean) => cn('flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px]', on ? 'bg-[rgb(var(--raised))] font-medium text-[rgb(var(--fg))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]');
  return (
    <div className="space-y-4">
      {seeCust ? <Tabs tabs={[{ id: 'staff' as const, label: 'Nội bộ', count: staff.length }, { id: 'customer' as const, label: 'Khách hàng', count: cust.length }]} value={tab} onChange={(t) => { setTab(t); setGrp('ALL'); paged.setPage(1); }}
        aside={<button className={cn(btnGhost, btnSm)} onClick={() => setLabelOpen((v) => !v)} aria-expanded={labelOpen}><Tag className="h-3.5 w-3.5" aria-hidden />Nhãn</button>} /> : null}
      {labelOpen && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-[rgb(var(--muted))]">Nhãn của bạn:</span>
          {p.labels.length ? p.labels.map((l) => <span key={l.id} className="rounded-md border border-[rgb(var(--line))] px-2 py-0.5">{l.name}</span>) : <span className="text-[rgb(var(--faint))]">chưa có</span>}
          <input className={cn(inputBase, 'w-48 py-1 text-[13px]')} placeholder="Tên nhãn mới, Enter để tạo" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLabel()} aria-label="Tạo nhãn mới" />
        </div>
      )}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:w-[280px] lg:flex-none"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--faint))]" aria-hidden /><input className={cn(inputCls, 'bg-[rgb(var(--surface))] py-1.5 pl-9 text-[13.5px]')} placeholder="Tìm tên, chức danh, số điện thoại, email" value={q} onChange={(e) => { setQ(e.target.value); paged.setPage(1); }} aria-label="Tìm liên hệ" /></div>
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Lọc nhanh">
            {chips.map((c) => <button key={c.id} type="button" aria-pressed={view === c.id} onClick={() => { setView(c.id); paged.setPage(1); }} className={cn('flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[13px]', view === c.id ? 'border-[rgb(var(--ink)/0.14)] bg-[rgb(var(--surface))] font-medium shadow-sm' : 'border-transparent text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>{c.label}<span className="font-mono text-[11.5px] font-normal text-[rgb(var(--muted))]">{c.n}</span></button>)}
          </div>
          <select className={cn(inputBase, 'py-1.5 text-[13px] lg:w-48')} value={grp} onChange={(e) => { setGrp(e.target.value); paged.setPage(1); }} aria-label={tab === 'staff' ? 'Phòng ban' : 'Nhóm khách hàng'}>
            <option value="ALL">{tab === 'staff' ? 'Mọi phòng ban' : 'Mọi nhóm khách'}</option>{groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <div className="flex shrink-0 rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label="Kiểu xem">
            <button role="radio" aria-checked={layout === 'list'} onClick={() => setLayout('list')} className={seg(layout === 'list')}><Rows3 className="h-3.5 w-3.5" aria-hidden />Danh sách</button>
            <button role="radio" aria-checked={layout === 'card'} onClick={() => setLayout('card')} className={seg(layout === 'card')}><LayoutGrid className="h-3.5 w-3.5" aria-hidden />Thẻ</button>
          </div>
        </div>
        {list.length && layout === 'list' ? (
          <Panel>
            <Table stt={Math.max(0, paged.from - 1)} minW={980} head={['Họ tên', 'Chức danh', tab === 'staff' ? 'Phòng ban' : 'Công ty', 'Điện thoại', 'Email', ...(tab === 'staff' ? ['Ngày sinh', 'Trạng thái'] : []), '']}>
              {paged.slice.map((c) => {
                const self = c.user?.id === me?.id;
                const fav = p.fav.includes(c.key);
                return (
                  <tr key={c.key} className={rowCls}>
                    <td className={tdFirst}><span className="flex items-center gap-2">{c.user ? <PAvatar user={c.user} size={24} meId={me?.id} /> : <Avatar name={c.name} size={24} />}<span className="block max-w-[200px] truncate font-medium">{c.name}</span>{self && <span className="text-xs text-[rgb(var(--muted))]">(bạn)</span>}{fav && <Star className="h-3.5 w-3.5 shrink-0 fill-current text-[rgb(var(--accent))]" aria-label="Yêu thích" />}</span></td>
                    <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[180px] truncate">{c.title}</span></td>
                    <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}><span className="block max-w-[180px] truncate">{tab === 'staff' ? c.group : c.org}</span></td>
                    <td className={cn(tdCls, 'font-mono text-xs')}>{c.phone ? <a className="hover:underline" href={`tel:${c.phone.replace(/\s/g, '')}`} onClick={() => touch(c.key)}>{c.phone}</a> : '—'}</td>
                    <td className={cn(tdCls, 'text-[rgb(var(--fg2))]')}>{c.email ? <a className="block max-w-[200px] truncate hover:underline" href={`mailto:${c.email}`} onClick={() => touch(c.key)}>{c.email}</a> : '—'}</td>
                    {tab === 'staff' && <td className={cn(tdCls, 'font-mono text-xs text-[rgb(var(--fg2))]')}>{c.user?.birthday ? fmtDate(c.user.birthday) : '—'}</td>}
                    {tab === 'staff' && <td className={tdCls}><Chip tone={presenceOf(c.user, me?.id) === 'online' ? 'teal' : presenceOf(c.user, me?.id) === 'away' ? 'orange' : 'muted'}>{PRESENCE_META[presenceOf(c.user, me?.id)].label}</Chip></td>}
                    <td className={cn(tdLast, 'text-right')}><span className="flex items-center justify-end gap-1">
                      {c.kind === 'staff' && !self && me && <button className={cn(btnGhost, 'h-7 w-7 border-0 p-0')} onClick={() => { touch(c.key); go('messages', dmId(me.id, c.user!.id)); }} aria-label={`Chat với ${c.name}`} title="Chat"><MessageSquare className="h-4 w-4" aria-hidden /></button>}
                      {c.phone && <a className={cn(btnGhost, 'h-7 w-7 border-0 p-0')} href={`tel:${c.phone.replace(/\s/g, '')}`} onClick={() => touch(c.key)} aria-label={`Gọi ${c.name}`} title="Gọi"><Phone className="h-4 w-4" aria-hidden /></a>}
                      <RowMenu label={`Thao tác ${c.name}`} items={[
                        { label: fav ? 'Bỏ yêu thích' : 'Yêu thích', icon: Star, onClick: () => toggleFav(c.key) },
                        ...(c.kind === 'customer' && c.customer ? [{ label: 'Mở hồ sơ khách hàng', icon: Eye, onClick: () => { touch(c.key); if (bizMode(company) === 'MFG') go('customers', c.customer!.code); else { go('customers'); openCustomer(c.customer!.id); } } }] : []),
                        ...(c.email ? [{ label: 'Gửi email', icon: Mail, onClick: () => { touch(c.key); window.location.href = `mailto:${c.email}`; } }] : []),
                        ...((c.phone || c.email) ? [{ label: 'Sao chép liên hệ', icon: Copy, onClick: () => copy(c.phone || c.email || '') }] : []),
                        { label: 'Tải vCard', icon: Download, onClick: () => { touch(c.key); downloadText(`${c.name}.vcf`, vcard(c), 'text/vcard'); } },
                        ...p.labels.map((l) => ({ label: `${l.ids.includes(c.key) ? 'Bỏ nhãn' : 'Gắn nhãn'} ${l.name}`, icon: Tag, onClick: () => toggleLabel(l.id, c.key) })),
                      ]} />
                    </span></td>
                  </tr>
                );
              })}
            </Table>
            <Pagination paged={paged} unit="liên hệ" />
          </Panel>
        ) : null}
        {list.length && layout === 'list' ? null : list.length ? (
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
        {list.length > 12 && layout === 'card' && <Pagination paged={paged} unit="liên hệ" />}
      </div>
    </div>
  );
}

