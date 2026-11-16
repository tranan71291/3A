'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, Building2, Copy, ExternalLink, FileText, ImagePlus, LayoutGrid, Link2, List, ListChecks, Mail, Megaphone, MessageCircle, MessageSquare, Newspaper, Pin, Plus, RefreshCw, Share2, Sparkles, Target, ThumbsUp, Trash2, TrendingUp, Wallet } from 'lucide-react';
import { removeWithUndo } from '../../app/context';
import { useOutsideClose } from '../../app/header';
import { RowMenu } from '../../components/controls';
import { FilePicker, useSticky } from '../../components/ui';
import { agoText, btnGhost, btnPrimary, btnSm, cloud, CLOUD_ON, compact, dmId, fmtDate, fold, inputCls, ROLE_LABEL, safeUrl, shrinkImage, SOCIAL_ERR, SOCIAL_TAB, SOCIAL0, socialCache, uid, useApp, ytIdOf, ytThumb } from '../../lib/core';
import type { SocialCfg, SocialChannel, SocialItem } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useServerStatus } from '../ai/ai-core';
import { useTaskCount } from '../tasks/tasks';

/** GET route máy chủ kèm phiên Supabase */
export async function apiGet<T>(path: string): Promise<T & { ok: boolean; error?: string }> {
  const headers: Record<string, string> = {};
  if (CLOUD_ON && cloud.session?.access_token) headers.Authorization = `Bearer ${cloud.session.access_token}`;
  try {
    const r = await fetch(path, { headers, cache: 'no-store' });
    return (await r.json().catch(() => ({ ok: false, error: `http_${r.status}` }))) as T & { ok: boolean; error?: string };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'network' } as T & { ok: boolean; error?: string }; }
}

/** Luồng bài mới nhất từ máy chủ (bộ nhớ đệm 5 phút trên trình duyệt, 10 phút trên máy chủ) */
export function useSocialFeed(ch: SocialChannel, cfg: SocialCfg) {
  const { org } = useApp();
  const [srv] = useServerStatus();
  const ref = ch === 'YOUTUBE' ? cfg.youtubeChannelId : ch === 'FACEBOOK' ? cfg.facebookPageId : '';
  const ready = srv.reachable && (ch === 'YOUTUBE' ? !!ref : ch === 'FACEBOOK' ? !!srv.social?.facebook : !!srv.zalo.oa);
  const key = `${org.id}|${ch}|${ref}`;
  const [st, setSt] = useState<{ items: SocialItem[]; loading: boolean; error?: string }>(() => ({ items: socialCache.get(key)?.items ?? [], loading: false }));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    if (!ready) { setSt({ items: [], loading: false }); return; }
    const c = socialCache.get(key);
    if (c && tick === 0 && Date.now() - c.at < 300_000) { setSt({ items: c.items, loading: false, error: c.error }); return; }
    setSt((s) => ({ ...s, loading: true }));
    void apiGet<{ items: { id: string; title: string; url: string; thumb?: string; at: number }[] }>(`/api/social?tenant=${encodeURIComponent(org.id)}&channel=${SOCIAL_TAB[ch].api}&ref=${encodeURIComponent(ref)}${tick ? '&fresh=1' : ''}`).then((r) => {
      const items: SocialItem[] = r.ok ? (r.items ?? []).map((x) => ({ id: `${ch}-${x.id}`, channel: ch, title: x.title, url: safeUrl(x.url), thumb: x.thumb ? safeUrl(x.thumb) : undefined, at: x.at || 0 })) : [];
      socialCache.set(key, { at: Date.now(), items, error: r.ok ? undefined : r.error });
      if (live) setSt({ items, loading: false, error: r.ok ? undefined : r.error });
    });
    return () => { live = false; };
  }, [key, ready, tick]);
  return { ...st, ready, reload: () => setTick((t) => t + 1) };
}

/** Nút Sao chép liên kết + Chia sẻ nhanh (dùng chung cho cả 3 tab) */
export function SocialQuickActions({ it, compact }: { it: SocialItem; compact?: boolean }) {
  const { notify, setPosts, me, go, company } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const intro = `Dạ em gửi anh/chị ${SOCIAL_TAB[it.channel].label === 'YouTube' ? 'video' : 'bài viết'} "${it.title}" của ${company.shortName || company.appName}: ${it.url}`;
  const copy = async (text: string, msg: string) => { try { await navigator.clipboard.writeText(text); notify(msg, 'teal'); } catch { notify('Trình duyệt chặn sao chép, giữ chuột vào liên kết để sao chép', 'orange'); } };
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const enc = encodeURIComponent(it.url);
  const items: { label: string; icon: typeof Wallet; run: () => void }[] = [
    ...(canNative ? [{ label: 'Chia sẻ qua ứng dụng (Zalo, Messenger…)', icon: Share2, run: () => { void navigator.share({ title: it.title, text: it.title, url: it.url }).catch(() => undefined); } }] : []),
    { label: 'Sao chép kèm lời giới thiệu', icon: Copy, run: () => void copy(intro, 'Đã sao chép lời giới thiệu kèm liên kết') },
    { label: 'Gửi khách qua Zalo Hub', icon: MessageCircle, run: () => { void copy(intro, 'Đã sao chép, dán vào hội thoại Zalo của khách'); go('zalo'); } },
    { label: 'Chia sẻ lên Facebook', icon: ThumbsUp, run: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${enc}`, '_blank', 'noopener,width=640,height=560') },
    { label: 'Gửi email', icon: Mail, run: () => { location.href = `mailto:?subject=${encodeURIComponent(it.title)}&body=${encodeURIComponent(intro)}`; } },
    ...(me ? [{ label: 'Đăng lên Bảng tin nội bộ', icon: Newspaper, run: () => { setPosts((p) => [{ id: uid('ps'), kind: 'POST', authorId: me.id, at: Date.now(), text: `${it.title}\n${it.url}`, likes: [] }, ...p]); notify('Đã đăng lên Bảng tin', 'teal'); } }] : []),
  ];
  const btn = cn('flex items-center justify-center rounded-md text-[rgb(var(--muted))] transition-colors hover:bg-[rgb(var(--secondary)/0.12)] hover:text-[rgb(var(--secondary-fg))]', compact ? 'h-7 w-7' : 'h-8 w-8');
  return (
    <div className="relative flex shrink-0 items-center gap-0.5" ref={ref}>
      <button className={btn} onClick={() => void copy(it.url, 'Đã sao chép liên kết')} aria-label={`Sao chép liên kết: ${it.title}`} title="Sao chép liên kết"><Link2 className="h-4 w-4" aria-hidden /></button>
      <button className={cn(btn, open && 'bg-[rgb(var(--secondary)/0.12)] text-[rgb(var(--secondary-fg))]')} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label={`Chia sẻ: ${it.title}`} title="Chia sẻ nhanh"><Share2 className="h-4 w-4" aria-hidden /></button>
      {open && (
        <div className="absolute right-0 top-9 z-40 w-64 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 shadow-[var(--shadow-lg)]" role="menu">
          {items.map((m) => <button key={m.label} role="menuitem" className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => { setOpen(false); m.run(); }}><m.icon className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />{m.label}</button>)}
        </div>
      )}
    </div>
  );
}

export function SocialHubWidget() {
  const { hubCfg, socialPosts, setSocialPosts, canDo, notify, me, go, company } = useApp();
  const cfg = { ...SOCIAL0, ...(hubCfg.social ?? {}) };
  const [tab, setTab] = useSticky<SocialChannel>('SocialHub.tab', 'FACEBOOK');
  const [view, setView] = useSticky<'list' | 'grid'>('SocialHub.ytView', 'list');
  const [more, setMore] = useState(false);
  const [form, setForm] = useState<{ url: string; title: string; thumb: string; pinned: boolean } | null>(null);
  const feed = useSocialFeed(tab, cfg);
  const canManage = canDo('mkt.manage') || canDo('settings.edit');
  const pageUrl = tab === 'FACEBOOK' ? cfg.facebookUrl : tab === 'ZALO' ? cfg.zaloOaUrl : cfg.youtubeUrl;
  const manual: SocialItem[] = socialPosts.filter((p) => p.channel === tab).map((p) => ({ id: p.id, channel: p.channel, title: p.title, url: p.url, thumb: p.thumb, at: p.at, manual: p, pinned: p.pinned }));
  const seen = new Set(manual.map((m) => m.url));
  const all = [...manual, ...feed.items.filter((x) => !seen.has(x.url)).map((x) => ({ ...x, url: x.url || pageUrl }))]
    .filter((x) => x.url)
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at - a.at);
  const shown = more ? all : all.slice(0, tab === 'YOUTUBE' && view === 'grid' ? 6 : 5);
  const T = SOCIAL_TAB[tab];
  const save = () => {
    if (!form) return;
    const url = safeUrl(form.url);
    if (!url) return notify('Nhập liên kết bắt đầu bằng https://', 'red');
    const yid = tab === 'YOUTUBE' ? ytIdOf(url) : undefined;
    const title = form.title.trim() || (yid ? 'Video YouTube' : '');
    if (title.length < 3) return notify('Nhập tiêu đề ngắn gọn', 'red');
    setSocialPosts((p) => [{ id: uid('sp'), channel: tab, title, url, thumb: form.thumb || (yid ? ytThumb(yid) : undefined), at: Date.now(), by: me?.id, pinned: form.pinned || undefined }, ...p]);
    setForm(null);
    notify(`Đã thêm vào tab ${T.label}`, 'teal');
  };
  const card = (it: SocialItem) => {
    const thumb = it.thumb || (it.channel === 'YOUTUBE' && ytIdOf(it.url) ? ytThumb(ytIdOf(it.url)!) : '');
    const menu = it.manual && canManage ? (
      <RowMenu label={`Thao tác: ${it.title}`} items={[
        { label: it.pinned ? 'Bỏ ghim' : 'Ghim lên đầu', icon: Pin, onClick: () => setSocialPosts((p) => p.map((x) => (x.id === it.id ? { ...x, pinned: x.pinned ? undefined : true } : x))) },
        { label: 'Xóa khỏi danh sách', icon: Trash2, danger: true, onClick: () => removeWithUndo(setSocialPosts, it.manual!, notify, 'Đã xóa bài khỏi widget') },
      ]} />
    ) : null;
    const meta = <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[rgb(var(--muted))]">{it.pinned && <Pin className="h-3 w-3 text-[rgb(var(--accent))]" aria-label="Đã ghim" />}{it.at ? agoText(it.at) : T.label}{it.manual ? ' · Marketing ghim' : ''}</p>;
    if (tab === 'YOUTUBE' && view === 'grid') {
      return (
        <li key={it.id} className="min-w-0">
          <a href={it.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md bg-[rgb(var(--sunken))]">{thumb ? <img src={thumb} alt="" loading="lazy" className="aspect-video w-full object-cover" /> : <span className="flex aspect-video items-center justify-center"><T.icon className="h-6 w-6 text-[rgb(var(--faint))]" aria-hidden /></span>}</a>
          <div className="mt-1.5 flex items-start gap-1">
            <div className="min-w-0 flex-1"><a href={it.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-xs font-medium leading-snug hover:text-[rgb(var(--secondary-fg))]">{it.title}</a>{meta}</div>
          </div>
          <div className="mt-1 flex items-center justify-end gap-0.5">{menu}<SocialQuickActions it={it} compact /></div>
        </li>
      );
    }
    return (
      <li key={it.id} className="flex items-start gap-3 rounded-md p-1.5 transition-colors hover:bg-[rgb(var(--ink)/0.04)]">
        <a href={it.url} target="_blank" rel="noopener noreferrer" className="shrink-0 overflow-hidden rounded-md bg-[rgb(var(--sunken))]" tabIndex={-1} aria-hidden>
          {thumb ? <img src={thumb} alt="" loading="lazy" className="h-14 w-[88px] object-cover" /> : <span className="flex h-14 w-[88px] items-center justify-center"><T.icon className="h-5 w-5 text-[rgb(var(--faint))]" aria-hidden /></span>}
        </a>
        <div className="min-w-0 flex-1"><a href={it.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-[13px] font-medium leading-snug hover:text-[rgb(var(--secondary-fg))]">{it.title}</a>{meta}</div>
        <div className="flex flex-col items-end gap-0.5"><SocialQuickActions it={it} />{menu}</div>
      </li>
    );
  };
  return (
    <section className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))]" aria-label="Truyền thông đa kênh">
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <Megaphone className="h-4 w-4 text-[rgb(var(--accent))]" aria-hidden />
        <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{cfg.title || `Truyền thông ${company.shortName || company.appName} & 3A Group`}</h2>
        {tab === 'YOUTUBE' && (
          <div className="flex items-center rounded-md border border-[rgb(var(--line))] p-0.5">
            {([['list', List, 'Dạng danh sách'], ['grid', LayoutGrid, 'Dạng lưới']] as const).map(([v, I, l]) => <button key={v} className={cn('rounded p-1', view === v ? 'bg-[rgb(var(--sunken))] text-[rgb(var(--fg))]' : 'text-[rgb(var(--muted))]')} onClick={() => setView(v)} aria-pressed={view === v} aria-label={l} title={l}><I className="h-3.5 w-3.5" aria-hidden /></button>)}
          </div>
        )}
        {feed.ready && <button className={cn(btnGhost, 'p-1.5')} onClick={feed.reload} aria-label="Tải lại bài mới" title="Tải lại"><RefreshCw className={cn('h-3.5 w-3.5', feed.loading && 'motion-safe:animate-spin')} aria-hidden /></button>}
        {canManage && <button className={cn(btnGhost, 'p-1.5')} onClick={() => setForm(form ? null : { url: '', title: '', thumb: '', pinned: true })} aria-label={`Thêm bài vào tab ${T.label}`} title="Thêm / ghim bài"><Plus className="h-3.5 w-3.5" aria-hidden /></button>}
      </header>
      <div className="flex gap-1 border-b border-[rgb(var(--line))] px-3" role="tablist" aria-label="Kênh truyền thông">
        {(Object.keys(SOCIAL_TAB) as SocialChannel[]).map((c) => { const S = SOCIAL_TAB[c]; const on = tab === c; return (
          <button key={c} role="tab" aria-selected={on} className={cn('-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-sm transition-colors', on ? 'border-[rgb(var(--accent))] font-semibold text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')} onClick={() => { setTab(c); setMore(false); setForm(null); }}><S.icon className="h-4 w-4" aria-hidden />{S.label}</button>
        ); })}
      </div>
      <div className="p-3">
        {form && (
          <div className="mb-3 space-y-2 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--sunken))] p-3">
            <input className={inputCls} placeholder={tab === 'YOUTUBE' ? 'Liên kết video YouTube' : `Liên kết bài viết ${T.label}`} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} aria-label="Liên kết" />
            <input className={inputCls} placeholder="Tiêu đề ngắn gọn" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Tiêu đề" />
            {tab !== 'YOUTUBE' && <div className="flex items-center gap-2"><input className={inputCls} placeholder="Liên kết ảnh đại diện (tùy chọn)" value={form.thumb.startsWith('data:') ? 'Ảnh đã tải lên' : form.thumb} readOnly={form.thumb.startsWith('data:')} onChange={(e) => setForm({ ...form, thumb: safeUrl(e.target.value) || e.target.value })} aria-label="Ảnh đại diện" /><FilePicker accept="image/*" onFiles={async ([f]) => { if (f) { const u = await shrinkImage(f, 480); setForm((x) => (x ? { ...x, thumb: u } : x)); } }} className={cn(btnGhost, 'shrink-0 px-2.5')}><ImagePlus className="h-4 w-4" aria-hidden /></FilePicker></div>}
            <div className="flex items-center gap-2"><label className="flex items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />Ghim lên đầu</label><div className="ml-auto flex gap-2"><button className={cn(btnGhost, btnSm)} onClick={() => setForm(null)}>Hủy</button><button className={cn(btnPrimary, btnSm)} onClick={save}>Thêm</button></div></div>
          </div>
        )}
        {feed.loading && !all.length ? (
          <ul className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <li key={i} className="flex gap-3"><span className="h-14 w-[88px] animate-pulse rounded-md bg-[rgb(var(--sunken))]" /><span className="flex-1 space-y-2 pt-1"><span className="block h-3 w-4/5 animate-pulse rounded bg-[rgb(var(--sunken))]" /><span className="block h-3 w-2/5 animate-pulse rounded bg-[rgb(var(--sunken))]" /></span></li>)}</ul>
        ) : all.length ? (
          <ul className={tab === 'YOUTUBE' && view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-1'}>{shown.map(card)}</ul>
        ) : (
          <div className="px-1 py-4 text-center text-sm text-[rgb(var(--muted))]">
            <T.icon className="mx-auto mb-2 h-6 w-6 text-[rgb(var(--faint))]" aria-hidden />
            <p>{feed.error ? SOCIAL_ERR[feed.error] ?? 'Chưa tải được bài mới' : tab === 'YOUTUBE' && !cfg.youtubeChannelId ? 'Chưa khai báo kênh YouTube' : `Chưa có bài ${T.label}`}</p>
            <p className="mt-1 text-xs">{canManage ? 'Bấm + để ghim bài / video, hoặc khai báo kênh ở Cài đặt › AI, Zalo OA & ZNS.' : 'Marketing sẽ cập nhật bài mới tại đây.'}</p>
            {canDo('settings.edit') && !feed.ready && <button className={cn(btnGhost, btnSm, 'mt-3')} onClick={() => go('settings', 'hub')}>Khai báo kênh</button>}
          </div>
        )}
        {(all.length > shown.length || pageUrl) && (
          <div className="mt-2 flex items-center gap-2 border-t border-[rgb(var(--ink)/0.06)] pt-2 text-xs">
            {all.length > shown.length && <button className="font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setMore(true)}>Xem thêm {all.length - shown.length}</button>}
            {more && all.length > 5 && <button className="font-medium text-[rgb(var(--secondary-fg))] hover:underline" onClick={() => setMore(false)}>Thu gọn</button>}
            {pageUrl && <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]">Mở {T.label}<ExternalLink className="h-3 w-3" aria-hidden /></a>}
          </div>
        )}
      </div>
    </section>
  );
}

/** Thanh lệnh Trợ lý số: tìm nhanh bài viết, khách hàng, dự án, báo giá, đồng nghiệp; hỏi AI về số liệu */
export function AssistantCommandBar({ onPost }: { onPost: (id: string) => void }) {
  const { posts, myLeads, myCustomers, quotes, users, me, askAi, go, canSee, openCustomer, openComposer, comments, userName } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useOutsideClose(open, () => setOpen(false));
  const inputRef = useRef<HTMLInputElement>(null);
  const taskN = useTaskCount();
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  if (!me) return null;
  const now = Date.now();
  const todayPosts = posts.filter((p) => p.at > now - 864e5 && !p.hidden).length;
  const myMentions = comments.filter((c) => c.mentions.includes(me.id) && c.authorId !== me.id && c.at > now - 864e5).length;
  type Hit = { key: string; group: string; label: string; sub?: string; icon: typeof Wallet; run: () => void };
  const t = fold(q.trim());
  const hits: Hit[] = [];
  if (t.length >= 2) {
    const has = (s: string) => fold(s).includes(t);
    posts.filter((p) => !p.hidden && has(p.text)).slice(0, 4).forEach((p) => hits.push({ key: `p${p.id}`, group: 'Bảng tin', label: p.text.replace(/\s+/g, ' ').slice(0, 90), sub: `${userName(p.authorId)} · ${agoText(p.at)}`, icon: Newspaper, run: () => onPost(p.id) }));
    if (canSee('customers')) myCustomers.filter((c) => has(`${c.name} ${c.code} ${c.taxCode}`)).slice(0, 4).forEach((c) => hits.push({ key: `c${c.id}`, group: 'Khách hàng', label: c.name, sub: [c.code, c.taxCode && `MST ${c.taxCode}`].filter(Boolean).join(' · '), icon: Building2, run: () => openCustomer(c.id) }));
    if (canSee('projects') || canSee('leads')) myLeads.filter((l) => has(`${l.company} ${l.code} ${l.boqNote ?? ''}`)).slice(0, 4).forEach((l) => hits.push({ key: `l${l.id}`, group: 'Dự án / lead', label: `${l.code} · ${l.company}`, sub: l.boqNote, icon: Target, run: () => go(canSee('projects') ? 'projects' : 'leads', l.code) }));
    quotes.filter((x) => has(x.code) || x.lines.some((l) => has(l.name))).slice(0, 3).forEach((x) => hits.push({ key: `q${x.id}`, group: 'Báo giá', label: `${x.code} v${x.version}`, sub: `${fmtDate(x.date)} · ${compact(x.amount)}`, icon: FileText, run: () => openComposer({ quoteId: x.id, leadId: x.leadId || undefined, mode: 'QUOTE' }) }));
    users.filter((u) => u.active && u.id !== me.id && has(u.name)).slice(0, 3).forEach((u) => hits.push({ key: `u${u.id}`, group: 'Đồng nghiệp', label: u.name, sub: u.title || ROLE_LABEL[u.role], icon: MessageSquare, run: () => go('messages', dmId(me.id, u.id)) }));
  }
  if (q.trim()) hits.push({ key: 'ai', group: 'Trợ lý AI', label: `Hỏi trợ lý: “${q.trim()}”`, sub: 'Phân tích số liệu doanh thu, công nợ, SLA, quỹ MDF trên dữ liệu trong app', icon: Sparkles, run: () => askAi(q.trim()) });
  const quick: Hit[] = [
    { key: 'k1', group: 'Gợi ý', label: `Việc chờ tôi xử lý (${taskN})`, icon: ListChecks, run: () => go('tasks') },
    { key: 'k2', group: 'Gợi ý', label: 'Tóm tắt hôm nay', icon: Sparkles, run: () => askAi('Tóm tắt hôm nay') },
    { key: 'k3', group: 'Gợi ý', label: 'Doanh số tháng này của tôi', icon: TrendingUp, run: () => askAi('Doanh số tháng này của tôi') },
    { key: 'k4', group: 'Gợi ý', label: 'Dự án nào có rủi ro trễ SLA?', icon: AlertTriangle, run: () => askAi('Dự án nào có rủi ro trễ SLA?') },
  ];
  const list = q.trim() ? hits : quick;
  const run = (h?: Hit) => { if (!h) return; setOpen(false); setQ(''); h.run(); };
  return (
    <section className="relative rounded-md border border-[rgb(var(--accent)/0.45)] bg-[rgb(var(--surface))] p-3 shadow-[0_0_0_3px_rgb(var(--accent)/0.08)]" ref={boxRef} aria-label="Trợ lý số">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--accent)/0.14)]"><Sparkles className="h-[18px] w-[18px] text-[rgb(var(--accent))]" aria-hidden /></span>
        <input ref={inputRef} className="h-10 min-w-0 flex-1 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--bg))] px-3 text-sm text-[rgb(var(--fg))] placeholder:text-[rgb(var(--faint))] focus:border-[rgb(var(--accent))] focus:outline-none"
          placeholder="Hỏi trợ lý hoặc tìm nhanh: bài viết, khách hàng, báo giá, số liệu…" value={q} onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(list.length - 1, h + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); run(list[hi] ?? list[list.length - 1]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          role="combobox" aria-expanded={open} aria-controls="assist-results" aria-label="Hỏi trợ lý số" />
        <button className={cn(btnPrimary, 'h-10 shrink-0')} onClick={() => (q.trim() ? run(list[hi] ?? hits[hits.length - 1]) : askAi())}><Bot className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Hỏi trợ lý</span></button>
      </div>
      <p className="mt-2 px-0.5 text-xs text-[rgb(var(--muted))]">Chào {me.name}! Hôm nay có <b className="text-[rgb(var(--fg))]">{todayPosts}</b> bài mới, <b className="text-[rgb(var(--fg))]">{myMentions}</b> lượt nhắc tên bạn và <b className="text-[rgb(var(--fg))]">{taskN}</b> việc chờ xử lý. <span className="hidden md:inline">Nhấn <kbd className="rounded border border-[rgb(var(--line))] px-1">/</kbd> để gõ nhanh.</span></p>
      {open && list.length > 0 && (
        <ul id="assist-results" role="listbox" className="absolute left-3 right-3 top-[3.6rem] z-40 max-h-96 overflow-y-auto rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 shadow-[var(--shadow-lg)]">
          {list.map((h, i) => (
            <li key={h.key} role="option" aria-selected={hi === i}>
              {(i === 0 || list[i - 1].group !== h.group) && <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--faint))]">{h.group}</p>}
              <button className={cn('flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left', hi === i ? 'bg-[rgb(var(--secondary)/0.12)]' : 'hover:bg-[rgb(var(--ink)/0.05)]')} onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => run(h)}>
                <h.icon className="h-4 w-4 shrink-0 text-[rgb(var(--muted))]" aria-hidden />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm">{h.label}</span>{h.sub && <span className="block truncate text-xs text-[rgb(var(--muted))]">{h.sub}</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

