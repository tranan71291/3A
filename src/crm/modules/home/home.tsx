'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Bookmark, Cake, CheckCircle2, FolderOpen, House, Lightbulb, Megaphone, MessageSquare, Newspaper, Paperclip, Pencil, Pin, Plus, Send, Sparkles, ThumbsUp, Trash2, Trophy, Vote, Wallet, X, XCircle } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { PAvatar } from '../../app/header';
import { MentionComposer, MentionText } from '../../components/comments';
import { RowMenu } from '../../components/controls';
import { ConfirmDialog } from '../../components/crud';
import { Chip, EmptyState, FilePicker, useSticky } from '../../components/ui';
import { agoText, bizMode, boqTotal, btnGhost, btnPrimary, btnSm, canViewDoc, chatFileMax, compact, dmId, fmtDate, fmtSize, inputBase, inputCls, leadDate, POST_KIND, ROLE_LABEL, summarizeText, uid, useApp } from '../../lib/core';
import type { ChatFile, ConfirmState, FeedAuto, Post, PostKind } from '../../lib/types';
import { cn } from '../../lib/utils';
import { jobMoney } from '../../lib/workshop';
import { ExecBriefCard } from '../ai/copilot-plus';
import { WidgetCard } from '../dashboard/widget-board';
import { AssistantCommandBar, SocialHubWidget } from './social-hub';
import { ChatFiles } from '../messages/messenger';
import { useTaskCount } from '../tasks/tasks';

export function HomePage() {
  const app = useApp();
  const { me, users, userName, posts, setPosts, comments, addComment, canDo, canSee, notify, company, myLeads, jobs, receipts, installJobs, docs, go, presetQuery, org, departments, quotes } = app;
  const [filter, setFilter] = useSticky<'ALL' | PostKind | 'BIZ' | 'SAVED'>('HomePage.filter', 'ALL');
  const [tag, setTag] = useSticky<string>('HomePage.tag', '');
  const [kind, setKind] = useState<PostKind>('POST');
  const [text, setText] = useState('');
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [opts, setOpts] = useState<string[]>(['', '']);
  const [multi, setMulti] = useState(false);
  const [closes, setCloses] = useState('');
  const [composing, setComposing] = useState(presetQuery === 'compose');
  const [openCm, setOpenCm] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [sumOn, setSumOn] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const savedKey = `3a:saved-posts:${org.id}:${me?.id ?? 'x'}`;
  const [saved, setSaved] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem(savedKey) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const taskN = useTaskCount();
  const [hot, setHot] = useState<string | null>(null);
  const focusPost = (id: string) => { setFilter('ALL'); setTag(''); setHot(id); setTimeout(() => document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); setTimeout(() => setHot(null), 2500); };
  useEffect(() => { if (presetQuery === 'compose') composeRef.current?.focus(); }, [presetQuery]);
  if (!me) return null;
  const mod = canDo('feed.moderate');
  const canPoll = canDo('feed.poll');
  const mfg = bizMode(company) === 'MFG';
  const now = Date.now();
  const toggleSave = (id: string) => setSaved((p) => { const n = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]; try { localStorage.setItem(savedKey, JSON.stringify(n)); } catch { /* bỏ qua */ } notify(n.includes(id) ? 'Đã lưu bài viết' : 'Đã bỏ lưu', 'teal'); return n; });
  const patch = (id: string, fn: (p: Post) => Post) => setPosts((all) => all.map((p) => (p.id === id ? fn(p) : p)));
  const tagsOf = (t: string) => (t.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((x) => x.toLowerCase());

  // ---- Hoạt động kinh doanh tự động (đọc từ dữ liệu, không lưu thêm) ----
  const since = now - 30 * 864e5;
  const auto: FeedAuto[] = [];
  if (canSee('projects') || canSee('leads')) myLeads.filter((l) => l.wonAt && Date.parse(l.wonAt) > since).forEach((l) => auto.push({ id: `won-${l.id}`, at: Date.parse(l.wonAt!), icon: Trophy, tone: 'teal', text: <><b>{userName(l.assignee) || 'Phòng kinh doanh'}</b> chốt đơn <b>{l.company}</b>{l.wonAmount ? <> · {compact(l.wonAmount)}</> : null}</>, open: () => go('projects', l.code) }));
  if (canSee('jobs')) jobs.filter((j) => j.wonAt && Date.parse(j.wonAt) > since).forEach((j) => auto.push({ id: `jw-${j.id}`, at: Date.parse(j.wonAt!), icon: Trophy, tone: 'teal', text: <><b>{userName(j.ownerId) || 'Kỹ thuật'}</b> chốt đơn <b>{j.code}</b> · {j.title}{jobMoney(j, receipts).value ? <> · {compact(jobMoney(j, receipts).value)}</> : null}</>, open: () => go('jobs', j.code) }));
  if (canSee('install')) installJobs.filter((i) => i.acceptance && Date.parse(i.acceptance.at) > since).forEach((i) => auto.push({ id: `ia-${i.id}`, at: Date.parse(i.acceptance!.at), icon: CheckCircle2, tone: 'blue', text: <>Nghiệm thu bàn giao <b>{i.code}</b> · {i.title}</>, open: () => go('install') }));
  if (canSee('docs')) docs.filter((d) => canViewDoc(d, me) && Date.parse(d.updatedAt) > since).forEach((d) => auto.push({ id: `doc-${d.id}`, at: Date.parse(d.updatedAt), icon: FolderOpen, tone: 'muted', text: <>Tài liệu cập nhật <b>{d.title}</b> · bản {d.version}</>, open: () => go('docs', d.title) }));
  auto.sort((a, b) => b.at - a.at);

  const visible = posts.filter((p) => !p.hidden || mod || p.authorId === me.id);
  const allTags = Array.from(visible.reduce((m, p) => { tagsOf(p.text).forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)); return m; }, new Map<string, number>())).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const shown = visible
    .filter((p) => filter === 'ALL' || (filter === 'SAVED' ? saved.includes(p.id) : p.kind === filter))
    .filter((p) => !tag || tagsOf(p.text).includes(tag))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at - a.at);
  type Row = { t: 'post'; p: Post; at: number } | { t: 'auto'; a: FeedAuto; at: number };
  const rows: Row[] = filter === 'BIZ' ? auto.map((a) => ({ t: 'auto' as const, a, at: a.at }))
    : [...shown.map((p) => ({ t: 'post' as const, p, at: p.pinned ? Infinity : p.at })), ...(filter === 'ALL' && !tag ? auto.slice(0, 8).map((a) => ({ t: 'auto' as const, a, at: a.at })) : [])].sort((a, b) => b.at - a.at);

  const resetComposer = () => { setText(''); setFiles([]); setOpts(['', '']); setMulti(false); setCloses(''); setKind('POST'); setComposing(false); };
  const publish = () => {
    const t = text.trim();
    const options = opts.map((o) => o.trim()).filter(Boolean);
    if (kind === 'POLL' && options.length < 2) return notify('Bình chọn cần ít nhất 2 phương án', 'red');
    if (!t && !files.length) return notify('Nhập nội dung bài viết', 'red');
    const p: Post = { id: uid('ps'), kind, authorId: me.id, at: Date.now(), text: t, likes: [], ...(files.length ? { files } : {}), ...(kind === 'POLL' ? { poll: { options: options.map((o) => ({ id: uid('op'), text: o, votes: [] })), multi, ...(closes ? { closesAt: closes } : {}) } } : {}) };
    setPosts((all) => [p, ...all]);
    const mentions = users.filter((u) => u.id !== me.id && t.includes(`@${u.name}`)).map((u) => u.id);
    if (mentions.length) addComment({ entity: 'post', entityId: p.id, text: t.slice(0, 300), mentions, module: 'home' }, `bài đăng ${POST_KIND[kind].label.toLowerCase()}`);
    notify(kind === 'ANNOUNCE' ? 'Đã đăng thông báo' : 'Đã đăng bài', 'teal');
    resetComposer();
  };
  const vote = (p: Post, oid: string) => {
    if (!p.poll) return;
    if (p.poll.closesAt && p.poll.closesAt < new Date().toISOString().slice(0, 10)) return notify('Bình chọn đã kết thúc', 'orange');
    patch(p.id, (x) => ({ ...x, poll: { ...x.poll!, options: x.poll!.options.map((o) => {
      const has = o.votes.includes(me.id);
      if (o.id === oid) return { ...o, votes: has ? o.votes.filter((v) => v !== me.id) : [...o.votes, me.id] };
      return x.poll!.multi ? o : { ...o, votes: o.votes.filter((v) => v !== me.id) };
    }) } }));
  };
  const readFiles = (fs: File[]) => fs.forEach((f) => {
    if (f.size > chatFileMax()) return notify(`${f.name} vượt ${fmtSize(chatFileMax())}`, 'red');
    const r = new FileReader(); r.onload = () => setFiles((p) => [...p, { name: f.name, size: f.size, type: f.type || 'application/octet-stream', url: String(r.result) }]); r.readAsDataURL(f);
  });

  // ---- Widget bên phải ----
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const sales = new Map<string, number>();
  if (!mfg) myLeads.filter((l) => l.wonAt && Date.parse(l.wonAt) >= monthStart && l.assignee).forEach((l) => sales.set(l.assignee!, (sales.get(l.assignee!) ?? 0) + (l.wonAmount ?? boqTotal(l))));
  else jobs.filter((j) => j.wonAt && Date.parse(j.wonAt) >= monthStart && j.ownerId).forEach((j) => sales.set(j.ownerId!, (sales.get(j.ownerId!) ?? 0) + jobMoney(j, receipts).value));
  const topSales = [...sales.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const md = (iso: string) => iso.slice(5);
  const upcoming = users.filter((u) => u.active && u.birthday).map((u) => {
    const d = new Date(); const [, mm, dd] = u.birthday!.split('-').map(Number);
    let next = new Date(d.getFullYear(), mm - 1, dd); if (next.getTime() < new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) next = new Date(d.getFullYear() + 1, mm - 1, dd);
    return { u, days: Math.round((next.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5) };
  }).filter((x) => x.days <= 7).sort((a, b) => a.days - b.days);
  const myQuotes = quotes.filter((q) => q.createdBy === me.id && (q.createdAt ?? Date.parse(q.date)) >= monthStart);
  const myWon = mfg ? jobs.filter((j) => j.ownerId === me.id && j.wonAt && Date.parse(j.wonAt) >= monthStart).reduce((a, j) => a + jobMoney(j, receipts).value, 0)
    : myLeads.filter((l) => l.assignee === me.id && l.wonAt && Date.parse(l.wonAt) >= monthStart).reduce((a, l) => a + (l.wonAmount ?? boqTotal(l)), 0);
  const leads7 = myLeads.filter((l) => +leadDate(l) >= now - 7 * 864e5).length;
  const asOf = now;
  const navItems: { id: typeof filter; label: string; icon: typeof Wallet; n?: number }[] = [
    { id: 'ALL', label: 'Bảng tin', icon: House },
    { id: 'ANNOUNCE', label: 'Thông báo', icon: Megaphone, n: visible.filter((p) => p.kind === 'ANNOUNCE').length },
    { id: 'POST', label: 'Tin tức & chia sẻ', icon: Newspaper, n: visible.filter((p) => p.kind === 'POST').length },
    { id: 'IDEA', label: 'Sáng kiến', icon: Lightbulb, n: visible.filter((p) => p.kind === 'IDEA').length },
    { id: 'POLL', label: 'Bình chọn', icon: Vote, n: visible.filter((p) => p.kind === 'POLL').length },
    { id: 'BIZ', label: 'Hoạt động kinh doanh', icon: Trophy, n: auto.length },
    { id: 'SAVED', label: 'Đã lưu', icon: Bookmark, n: saved.filter((id) => visible.some((p) => p.id === id)).length },
  ];
  const kinds = (['POST', 'IDEA', ...(mod ? ['ANNOUNCE'] : []), ...(canPoll ? ['POLL'] : [])] as PostKind[]);

  const postCard = (p: Post) => {
    const au = users.find((u) => u.id === p.authorId) ?? (p.authorId === me.id ? me : undefined);
    const cms = comments.filter((c) => c.entity === 'post' && c.entityId === p.id && !(c.authorId === p.authorId && c.at - p.at < 2000 && c.text === p.text.slice(0, 300))).sort((a, b) => a.at - b.at);
    const liked = p.likes.includes(me.id);
    const mine = p.authorId === me.id;
    const long = p.text.length > 320;
    const total = p.poll ? new Set(p.poll.options.flatMap((o) => o.votes)).size : 0;
    const closed = !!p.poll?.closesAt && p.poll.closesAt < new Date().toISOString().slice(0, 10);
    const K = POST_KIND[p.kind];
    return (
      <article key={p.id} id={`post-${p.id}`} className={cn('scroll-mt-24 rounded-md border bg-[rgb(var(--surface))] p-4 transition-shadow sm:p-5', p.pinned ? 'border-[rgb(var(--accent)/0.5)]' : 'border-[rgb(var(--line))]', p.hidden && 'opacity-60', hot === p.id && 'ring-2 ring-[rgb(var(--accent))]')}>
        <header className="flex items-start gap-3">
          <PAvatar user={au} name={userName(p.authorId)} size={40} meId={me.id} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1"><b className="font-semibold">{mine ? me.name : userName(p.authorId)}</b><Chip tone={K.tone}>{K.label}</Chip>{p.pinned && <Chip tone="orange">Đã ghim</Chip>}{p.hidden && <Chip>Đã ẩn</Chip>}</p>
            <p className="text-xs text-[rgb(var(--muted))]">{au ? ROLE_LABEL[au.role] : ''}{au?.dept ? ` · ${departments.find((d) => d.code === au.dept)?.short ?? ''}` : ''} · {agoText(p.at)}{p.editedAt ? ' · đã sửa' : ''}</p>
          </div>
          {(mine || mod) && (
            <RowMenu label={`Thao tác bài của ${userName(p.authorId)}`} items={[
              ...(mine ? [{ label: 'Sửa bài', icon: Pencil, onClick: () => setEditing({ id: p.id, text: p.text }) }] : []),
              ...(mod ? [{ label: p.pinned ? 'Bỏ ghim' : 'Ghim lên đầu', icon: Pin, onClick: () => patch(p.id, (x) => ({ ...x, pinned: x.pinned ? undefined : { by: me.id, at: Date.now() } })) }] : []),
              ...(mod ? [{ label: p.hidden ? 'Hiện lại' : 'Ẩn khỏi bảng tin', icon: XCircle, onClick: () => patch(p.id, (x) => ({ ...x, hidden: x.hidden ? undefined : { by: me.id, at: Date.now() } })) }] : []),
              { label: 'Xóa bài', icon: Trash2, danger: true, onClick: () => setConfirm({ title: 'Xóa bài viết', message: 'Xóa bài viết này khỏi bảng tin?', confirmLabel: 'Xóa', onConfirm: () => removeWithUndo(setPosts, p, notify, 'Đã xóa bài viết') }) },
            ]} />
          )}
        </header>
        {editing?.id === p.id ? (
          <div className="mt-3 space-y-2">
            <textarea className={cn(inputCls, 'min-h-24')} value={editing.text} onChange={(e) => setEditing({ id: p.id, text: e.target.value })} aria-label="Nội dung bài viết" />
            <div className="flex justify-end gap-2"><button className={cn(btnGhost, btnSm)} onClick={() => setEditing(null)}>Hủy</button><button className={cn(btnPrimary, btnSm)} onClick={() => { patch(p.id, (x) => ({ ...x, text: editing.text.trim(), editedAt: Date.now() })); setEditing(null); notify('Đã lưu bài viết', 'teal'); }}>Lưu</button></div>
          </div>
        ) : p.text && (
          <div className="mt-3">
            {long && (
              <button className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--secondary-fg))]" onClick={() => setSumOn((s2) => (s2.includes(p.id) ? s2.filter((x) => x !== p.id) : [...s2, p.id]))} aria-expanded={sumOn.includes(p.id)}><Sparkles className="h-3.5 w-3.5" aria-hidden />Tóm tắt bài viết</button>
            )}
            {long && sumOn.includes(p.id) && <p className="mb-2 rounded-md border border-[rgb(var(--secondary)/0.35)] bg-[rgb(var(--secondary)/0.06)] px-3 py-2 text-sm text-[rgb(var(--fg2))]">{summarizeText(p.text)}</p>}
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[rgb(var(--fg2))]"><MentionText text={p.text} /></p>
          </div>
        )}
        {p.files?.length ? <div className="mt-3"><ChatFiles files={p.files} /></div> : null}
        {p.poll && (
          <div className="mt-3 space-y-2" role="group" aria-label="Phương án bình chọn">
            {p.poll.options.map((o) => {
              const n = o.votes.length; const pc = total ? Math.round((n / total) * 100) : 0; const on = o.votes.includes(me.id);
              return (
                <button key={o.id} disabled={closed} onClick={() => vote(p, o.id)} aria-pressed={on} className={cn('relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-default', on ? 'border-[rgb(var(--secondary)/0.7)]' : 'border-[rgb(var(--line))] hover:border-[rgb(var(--secondary)/0.5)]')}>
                  <span className="absolute inset-y-0 left-0 bg-[rgb(var(--secondary)/0.14)]" style={{ width: `${pc}%` }} aria-hidden />
                  <span className="relative flex items-center gap-2"><span className={cn('flex h-4 w-4 shrink-0 items-center justify-center border', p.poll!.multi ? 'rounded-sm' : 'rounded-full', on ? 'border-[rgb(var(--secondary))] bg-[rgb(var(--secondary))] text-white' : 'border-[rgb(var(--faint))]')}>{on && <CheckCircle2 className="h-3 w-3" aria-hidden />}</span><span className="flex-1">{o.text}</span><span className="text-xs tabular-nums text-[rgb(var(--muted))]">{n} · {pc}%</span></span>
                </button>
              );
            })}
            <p className="text-xs text-[rgb(var(--muted))]">{total} người đã bình chọn{p.poll.multi ? ' · chọn nhiều phương án' : ''}{p.poll.closesAt ? ` · ${closed ? 'đã kết thúc' : 'kết thúc'} ${fmtDate(p.poll.closesAt)}` : ''}</p>
          </div>
        )}
        <footer className="mt-3 flex items-center gap-1 border-t border-[rgb(var(--ink)/0.06)] pt-2 text-sm">
          <button className={cn('flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors hover:bg-[rgb(var(--ink)/0.05)]', liked ? 'text-[rgb(var(--secondary-fg))]' : 'text-[rgb(var(--muted))]')} onClick={() => patch(p.id, (x) => ({ ...x, likes: liked ? x.likes.filter((u) => u !== me.id) : [...x.likes, me.id] }))} aria-pressed={liked} title={p.likes.map((u) => (u === me.id ? 'Bạn' : userName(u))).join(', ')}><ThumbsUp className={cn('h-4 w-4', liked && 'fill-current')} aria-hidden />Thích{p.likes.length ? ` · ${p.likes.length}` : ''}</button>
          <button className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[rgb(var(--muted))] transition-colors hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => setOpenCm(openCm === p.id ? null : p.id)} aria-expanded={openCm === p.id}><MessageSquare className="h-4 w-4" aria-hidden />Bình luận{cms.length ? ` · ${cms.length}` : ''}</button>
          <button className={cn('ml-auto flex items-center gap-1.5 rounded px-2.5 py-1.5 transition-colors hover:bg-[rgb(var(--ink)/0.05)]', saved.includes(p.id) ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))]')} onClick={() => toggleSave(p.id)} aria-pressed={saved.includes(p.id)}><Bookmark className={cn('h-4 w-4', saved.includes(p.id) && 'fill-current')} aria-hidden /><span className="hidden sm:inline">Lưu</span></button>
        </footer>
        {openCm === p.id && (
          <div className="mt-2 space-y-3">
            {cms.map((c) => (
              <div key={c.id} className="flex gap-2.5"><PAvatar user={users.find((u) => u.id === c.authorId)} name={userName(c.authorId)} size={30} meId={me.id} /><div className="min-w-0 flex-1 rounded-lg bg-[rgb(var(--ink)/0.04)] px-3 py-2"><p className="text-xs"><b>{c.authorId === me.id ? 'Bạn' : userName(c.authorId)}</b> <span className="text-[rgb(var(--muted))]">{agoText(c.at)}</span></p><p className="whitespace-pre-wrap break-words text-sm text-[rgb(var(--fg2))]"><MentionText text={c.text} /></p></div></div>
            ))}
            <MentionComposer rows={1} placeholder="Viết bình luận, gõ @ để nhắc tên…" onSend={(t2, m) => addComment({ entity: 'post', entityId: p.id, text: t2, mentions: [...new Set([...m, ...(p.authorId !== me.id ? [p.authorId] : [])])], module: 'home' }, `bài viết của ${userName(p.authorId)}`)} />
          </div>
        )}
      </article>
    );
  };

  const tile = (n: ReactNode, label: string, run: () => void, sub?: string) => (
    <button className="min-w-0 rounded-md bg-[rgb(var(--ink)/0.04)] p-3 text-left hover:bg-[rgb(var(--ink)/0.07)]" onClick={run}><p className="truncate font-display text-xl font-bold tabular-nums">{n}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{label}</p>{sub && <p className="truncate text-[11px] text-[rgb(var(--faint))]">{sub}</p>}</button>
  );
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[210px_1fr] xl:grid-cols-[210px_1fr_340px] 2xl:grid-cols-[230px_1fr_380px]">
      {/* ---- Cột trái: hồ sơ + điều hướng bảng tin + hashtag ---- */}
      <aside className="space-y-4">
        <div className="flex items-center gap-3 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3">
          <PAvatar user={me} size={44} meId={me.id} />
          <div className="min-w-0"><p className="truncate font-semibold">{me.name}</p><p className="truncate text-xs text-[rgb(var(--muted))]">{me.title || ROLE_LABEL[me.role]}</p></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Bảng tin">
          {navItems.map((n) => (
            <button key={n.id} className={cn('flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors', filter === n.id && !tag ? 'bg-[rgb(var(--secondary)/0.12)] font-semibold text-[rgb(var(--secondary-fg))]' : 'text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)]')} onClick={() => { setFilter(n.id); setTag(''); }}>
              <n.icon className="h-4 w-4" aria-hidden /><span className="flex-1 whitespace-nowrap">{n.label}</span>{n.n ? <span className="text-xs tabular-nums text-[rgb(var(--muted))]">{n.n}</span> : null}
            </button>
          ))}
        </nav>
        {allTags.length > 0 && (
          <div className="hidden lg:block">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--faint))]">Hashtag</p>
            {allTags.map(([t, n]) => <button key={t} className={cn('block w-full rounded px-3 py-1 text-left text-sm', tag === t ? 'font-semibold text-[rgb(var(--secondary-fg))]' : 'text-[rgb(var(--secondary-fg))] hover:bg-[rgb(var(--ink)/0.05)]')} onClick={() => { setTag(tag === t ? '' : t); setFilter('ALL'); }}>{t} <span className="text-xs text-[rgb(var(--muted))]">· {n} bài</span></button>)}
          </div>
        )}
      </aside>

      {/* ---- Cột giữa: thanh lệnh trợ lý + soạn bài + luồng tin nội bộ ---- */}
      <div className="min-w-0 space-y-4">
        <AssistantCommandBar onPost={focusPost} />
        <section className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4">
          <div className="flex gap-3">
            <PAvatar user={me} size={40} meId={me.id} />
            <textarea ref={composeRef} rows={composing ? 3 : 1} className={cn(inputCls, 'resize-none')} placeholder="Bạn muốn chia sẻ điều gì? Gõ #hashtag, @tên đồng nghiệp" value={text} onFocus={() => setComposing(true)} onChange={(e) => setText(e.target.value)} aria-label="Nội dung bài đăng" />
          </div>
          {composing && (
            <div className="mt-3 space-y-3">
              {kind === 'POLL' && (
                <div className="space-y-2 rounded-md border border-[rgb(var(--line))] p-3">
                  {opts.map((o, i) => (
                    <div key={i} className="flex gap-2"><input className={inputCls} placeholder={`Phương án ${i + 1}`} value={o} onChange={(e) => setOpts((p) => p.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Phương án ${i + 1}`} />{opts.length > 2 && <button className={cn(btnGhost, 'px-2')} onClick={() => setOpts((p) => p.filter((_, j) => j !== i))} aria-label={`Bỏ phương án ${i + 1}`}><X className="h-4 w-4" aria-hidden /></button>}</div>
                  ))}
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {opts.length < 6 && <button className={cn(btnGhost, btnSm)} onClick={() => setOpts((p) => [...p, ''])}><Plus className="h-3.5 w-3.5" aria-hidden />Thêm phương án</button>}
                    <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={multi} onChange={(e) => setMulti(e.target.checked)} />Cho chọn nhiều</label>
                    <label className="flex items-center gap-2">Kết thúc <input type="date" className={cn(inputBase, 'py-1')} value={closes} onChange={(e) => setCloses(e.target.value)} aria-label="Ngày kết thúc bình chọn" /></label>
                  </div>
                </div>
              )}
              {files.length > 0 && <div className="flex flex-wrap gap-1.5">{files.map((f, i) => <span key={i} className="flex items-center gap-1.5 rounded-md border border-[rgb(var(--line))] px-2 py-1 text-xs">{f.name}<button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label={`Bỏ ${f.name}`}><X className="h-3 w-3" aria-hidden /></button></span>)}</div>}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Loại bài">
                  {kinds.map((k) => { const K = POST_KIND[k]; return <button key={k} role="radio" aria-checked={kind === k} className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium', kind === k ? 'border-[rgb(var(--secondary)/0.7)] bg-[rgb(var(--secondary)/0.12)] text-[rgb(var(--secondary-fg))]' : 'border-[rgb(var(--line))] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')} onClick={() => setKind(k)}><K.icon className="h-3.5 w-3.5" aria-hidden />{K.label}</button>; })}
                </div>
                <FilePicker multiple onFiles={readFiles} className={cn(btnGhost, btnSm)}><Paperclip className="h-3.5 w-3.5" aria-hidden />Đính kèm</FilePicker>
                <div className="ml-auto flex gap-2"><button className={cn(btnGhost, btnSm)} onClick={resetComposer}>Hủy</button><button className={cn(btnPrimary, btnSm)} onClick={publish}><Send className="h-3.5 w-3.5" aria-hidden />Đăng</button></div>
              </div>
            </div>
          )}
        </section>

        {upcoming.length > 0 && filter === 'ALL' && !tag && (
          <section className="flex items-center gap-3 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 py-3 text-sm">
            <Cake className="h-5 w-5 shrink-0 text-[rgb(var(--accent))]" aria-hidden />
            <p className="min-w-0 flex-1"><b>Sinh nhật:</b> {upcoming.map((x) => `${x.u.name} (${x.days === 0 ? 'hôm nay' : x.days === 1 ? 'ngày mai' : `${x.days} ngày nữa`})`).join(', ')}</p>
            {upcoming[0].days === 0 && upcoming[0].u.id !== me.id && <button className={cn(btnGhost, btnSm)} onClick={() => go('messages', dmId(me.id, upcoming[0].u.id))}>Gửi lời chúc</button>}
          </section>
        )}

        {tag && <p className="flex items-center gap-2 text-sm">Đang lọc <Chip tone="blue">{tag}</Chip><button className="text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setTag('')}>Bỏ lọc</button></p>}
        {rows.length ? rows.map((r) => r.t === 'post' ? postCard(r.p) : (
          <button key={r.a.id} onClick={r.a.open} className="flex w-full items-center gap-3 rounded-md border border-dashed border-[rgb(var(--line))] bg-[rgb(var(--surface)/0.6)] px-4 py-3 text-left text-sm transition-colors hover:border-[rgb(var(--secondary)/0.5)]">
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', r.a.tone === 'teal' ? 'bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success-fg))]' : r.a.tone === 'blue' ? 'bg-[rgb(var(--secondary)/0.15)] text-[rgb(var(--secondary-fg))]' : 'bg-[rgb(var(--ink)/0.06)] text-[rgb(var(--muted))]')}><r.a.icon className="h-4 w-4" aria-hidden /></span>
            <span className="min-w-0 flex-1 text-[rgb(var(--fg2))]">{r.a.text}</span>
            <span className="shrink-0 text-xs text-[rgb(var(--muted))]">{agoText(r.a.at)}</span>
          </button>
        )) : (
          <EmptyState art="inbox" text={filter === 'SAVED' ? 'Chưa lưu bài viết nào' : filter === 'BIZ' ? 'Chưa có hoạt động kinh doanh trong 30 ngày' : 'Bảng tin còn trống'} hint={filter === 'ALL' ? 'Hãy là người đầu tiên chia sẻ: thông báo, tin tức, sáng kiến cải tiến hoặc tạo bình chọn.' : undefined} action={filter === 'ALL' ? 'Viết bài đầu tiên' : undefined} onAction={() => { setComposing(true); composeRef.current?.focus(); }} />
        )}
      </div>

      {/* ---- Cột phải: bản tin điều hành, truyền thông đa kênh, việc của tôi & hiệu suất ---- */}
      <aside className="space-y-4 lg:col-span-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0 xl:col-span-1 xl:block xl:space-y-4">
        <ExecBriefCard />
        <SocialHubWidget />
        <WidgetCard title="Việc của tôi & hiệu suất" period="Tháng này" asOf={asOf}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {tile(taskN, 'Việc chờ xử lý', () => go('tasks'))}
            {canSee('leads') && tile(leads7, 'Lead mới 7 ngày', () => go('leads'))}
            {!mfg && tile(myQuotes.length, 'Báo giá đã tạo', () => go('docs'), myQuotes.length ? compact(myQuotes.reduce((x, q) => x + q.amount, 0)) : undefined)}
            {tile(compact(myWon), 'Doanh số đã chốt', () => go(mfg ? 'jobs' : 'projects'))}
          </div>
        </WidgetCard>
        {(canSee('projects') || canSee('jobs')) && (
          <WidgetCard title="Bán hàng xuất sắc" period="Tháng này" unit="VNĐ" asOf={asOf}>
            {topSales.length ? (
              <ol className="space-y-2">{topSales.map(([id, v], i) => <li key={id} className="flex items-center gap-3 text-sm"><span className={cn('w-5 text-center font-bold tabular-nums', i === 0 ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--muted))]')}>{i + 1}</span><PAvatar user={users.find((u) => u.id === id)} name={userName(id)} size={28} meId={me.id} /><span className="min-w-0 flex-1 truncate">{userName(id)}</span><b className="tabular-nums">{compact(v)}</b></li>)}</ol>
            ) : <p className="text-sm text-[rgb(var(--muted))]">Chưa có đơn chốt trong tháng.</p>}
          </WidgetCard>
        )}
        <WidgetCard title={<span className="flex items-center gap-2"><Cake className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />Sinh nhật</span>} period="7 ngày tới" asOf={asOf}>
          {upcoming.length ? <ul className="space-y-2">{upcoming.map((x) => <li key={x.u.id} className="flex items-center gap-3 text-sm"><PAvatar user={x.u} size={28} meId={me.id} /><span className="min-w-0 flex-1 truncate">{x.u.name}</span><span className="text-xs text-[rgb(var(--muted))]">{x.days === 0 ? 'Hôm nay' : `${md(x.u.birthday!).split('-').reverse().join('/')}`}</span></li>)}</ul>
            : <p className="text-sm text-[rgb(var(--muted))]">Không có sinh nhật trong 7 ngày tới. Thêm ngày sinh ở Cài đặt › Nhân sự.</p>}
        </WidgetCard>
      </aside>
      {confirm && <ConfirmDialog {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

