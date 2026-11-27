'use client';

import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, Bot, ChevronDown, Clock, Download, ExternalLink, FileText, FolderKanban, Hash, Inbox, Info, MessageSquare, Paperclip, Pin, Plus, Reply, Search, SmilePlus, Sparkles, Star, Target, TrendingUp, Upload, Users, Users2, X } from 'lucide-react';
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PAvatar } from '../../app/header';
import { MentionComposer, MentionText, useDeepLinks } from '../../components/comments';
import { Avatar, MobileRow } from '../../components/controls';
import { claimDate } from '../../components/filters';
import { Chip, EmptyState, Field, FilePicker, Modal, monthly, Panel, ProgressBar, StatCard, Table, Tabs, useSticky } from '../../components/ui';
import { auditClaim, claimState, scoreLead } from '../../lib/business';
import { bizMode, blockersOf, boqTotal, btnGhost, btnPrimary, btnSm, C, chatFileMax, claimYear, CLOUD_ON, compact, deptIcon, dmId, fmtSize, fold, GRAD, inputBase, inputCls, isAcceptLate, isMktCustomer, isQuoteOverdue, isTextFile, jobCustName, kpiGrid, LEAD_STATUS, leadAt, MQL_THRESHOLD, OPEN_STATUSES, pct, PRESENCE_META, presenceOf, progName, PROGRAM_COLOR, PROGRAM_LABEL, PROGRAM_STATUS, QUICK_REACTIONS, REGION_LABEL, ROLE_LABEL, rowCls, SOURCE_LABEL, tdCls, tdFirst, tdLast, threadKey, tierInfo, uid, useApp, vnd } from '../../lib/core';
import type { ChatChannel, ChatFile, Claim, CommentEntity, LeadStatus, ProgramType, RowComment, Thread, User } from '../../lib/types';
import { cn } from '../../lib/utils';
import { ExecDashboard } from '../dashboard/exec-dashboard';
import { CommandCenter } from '../dashboard/widget-board';
import { MarginBadge, MdfMarginPanel } from '../mdf/surplus';
import { TradingReports } from '../reports/reports';
import { TenantLayoutPage, useTenantLayout } from '../page-builder';

/** Xem trước file ngay trong chat: ảnh, PDF, văn bản; định dạng khác thì tải xuống */
export function FilePreview({ f, onClose }: { f: ChatFile; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const img = f.type.startsWith('image/');
  const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  useEffect(() => {
    let obj: string | undefined;
    (async () => {
      try {
        const blob = await (await fetch(f.url)).blob();
        if (isTextFile(f)) setText((await blob.text()).slice(0, 200000));
        else { obj = URL.createObjectURL(pdf ? new Blob([blob], { type: 'application/pdf' }) : blob); setUrl(obj); }
      } catch { setUrl(f.url); }
    })();
    return () => { if (obj) URL.revokeObjectURL(obj); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.url]);
  return (
    <Modal title={f.name} onClose={onClose} wide footer={<><span className="mr-auto text-xs text-[rgb(var(--muted))]">{fmtSize(f.size)} · {f.type || 'không rõ định dạng'}</span><a className={btnGhost} href={f.url} download={f.name}><Download className="h-4 w-4" aria-hidden />Tải xuống</a><button className={btnPrimary} onClick={onClose}>Đóng</button></>}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url ?? f.url} alt={f.name} className="mx-auto max-h-[70vh] rounded object-contain" />
      ) : pdf ? (
        url ? <iframe title={f.name} src={url} className="h-[70vh] w-full rounded border border-[rgb(var(--ink)/0.1)] bg-white" /> : <p className="py-10 text-center text-sm text-[rgb(var(--muted))]">Đang mở PDF…</p>
      ) : text !== null ? (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded bg-[rgb(var(--sunken))] p-4 font-mono text-[13px] leading-relaxed text-[rgb(var(--fg2))]">{text}</pre>
      ) : (
        <EmptyState text={<>Chưa xem trước được định dạng này</>} hint={<>File Word, Excel, nén… hãy tải xuống để mở bằng ứng dụng tương ứng.</>} art="doc" />
      )}
    </Modal>
  );
}

export function ChatFiles({ files }: { files: ChatFile[] }) {
  const [view, setView] = useState<ChatFile | null>(null);
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {files.map((f, i) => f.type.startsWith('image/') ? (
        <button key={i} type="button" onClick={() => setView(f)} className="block overflow-hidden rounded-lg border border-[rgb(var(--ink)/0.1)] transition-opacity hover:opacity-90" title={`${f.name} · ${fmtSize(f.size)} · bấm để xem`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={f.name} className="h-36 max-w-[240px] object-cover" />
        </button>
      ) : (
        <button key={i} type="button" onClick={() => setView(f)} className="flex max-w-[280px] items-center gap-3 rounded-lg border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--ink)/0.03)] px-3 py-2.5 text-left transition-colors hover:border-[rgb(var(--secondary)/0.7)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--ink)/0.1)] text-[rgb(var(--muted))]"><FileText className="h-5 w-5" aria-hidden /></span>
          <span className="min-w-0"><span className="block truncate text-sm font-medium text-[rgb(var(--fg2))]">{f.name}</span><span className="block text-xs text-[rgb(var(--muted))]">{fmtSize(f.size)} · Xem trước</span></span>
        </button>
      ))}
      {view && <FilePreview f={view} onClose={() => setView(null)} />}
    </div>
  );
}

// =====================================================================
//  TIN NHẮN TOÀN MÀN HÌNH (trang Tin nhắn)
// =====================================================================
export function MessengerPage() {
  const { me } = useApp();
  return me ? <MessengerInner me={me} /> : null;
}

export function MessengerInner({ me }: { me: User }) {
  const CHAT_FILE_MAX = chatFileMax();
  const { comments, addComment, patchComment, channels, setChannels, users, userName, leads, customers, jobs, pos, chatSeen, markChatSeen, notify, role, presetQuery, askAi, org, company } = useApp();
  const links = useDeepLinks();
  const [ltab, setLtab] = useSticky<'all' | 'fav' | 'ai'>('Messenger.ltab', 'all');
  const favKey = `3a:chatfav:${org.id}:${me.id}`;
  const [favs, setFavs] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem(favKey) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });
  const toggleFavThread = (k: string) => setFavs((f) => { const n = f.includes(k) ? f.filter((x) => x !== k) : [...f, k]; try { localStorage.setItem(favKey, JSON.stringify(n)); } catch { /* bỏ qua */ } return n; });
  const [sumOpen, setSumOpen] = useState(false);
  const [notifAsk, setNotifAsk] = useState(() => { try { return typeof Notification !== 'undefined' && Notification.permission === 'default' && !localStorage.getItem('3a:ui:notif-dismissed'); } catch { return false; } });
  const [cur, setCur] = useState<Thread | null>(null);
  const [q, setQ] = useState('');
  const [inThread, setInThread] = useState('');
  const [side, setSide] = useState<'info' | 'none'>('info');
  const [threadOf, setThreadOf] = useState<string | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [pending, setPending] = useState<ChatFile[]>([]);
  const [replyPending, setReplyPending] = useState<ChatFile[]>([]);
  const [dragging, setDragging] = useState(0);
  const [pickReact, setPickReact] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState(false);
  const [newDm, setNewDm] = useState(false);
  const [gName, setGName] = useState('');
  const [gDesc, setGDesc] = useState('');
  const [gMembers, setGMembers] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const userById = (id: string) => users.find((u) => u.id === id) ?? (id === me.id ? me : undefined);
  const general: Thread = { entity: 'channel', entityId: 'general', title: 'Kênh chung', sub: 'Toàn doanh nghiệp', module: 'messages' };
  const wideOpen = useRef(false);
  useEffect(() => {
    if (wideOpen.current || cur || presetQuery) return;
    wideOpen.current = true;
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) setCur(general);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, presetQuery]);
  const myGroups = channels.filter((g) => g.members.includes(me.id) || g.createdBy === me.id);
  const groupThread = (g: ChatChannel): Thread => ({ entity: 'channel', entityId: g.id, title: g.name, sub: `${g.members.length} thành viên`, module: 'messages' });
  const dmThread = (u: User): Thread => ({ entity: 'channel', entityId: dmId(me.id, u.id), title: u.name, sub: ROLE_LABEL[u.role], module: 'messages' });
  const resolve = (entity: CommentEntity, id: string): Thread | null => {
    if (entity === 'channel') {
      if (id === 'general') return general;
      if (id.startsWith('dm:')) { const other = users.find((u) => u.id !== me.id && id.split(':').includes(u.id)); return other && id.split(':').includes(me.id) ? dmThread(other) : null; }
      const g = myGroups.find((x) => x.id === id); return g ? groupThread(g) : null;
    }
    if (entity === 'lead') { const l = leads.find((x) => x.id === id); return l ? { entity, entityId: id, title: l.company, sub: `${l.code} · Dự án`, module: 'projects', token: l.code } : null; }
    if (entity === 'customer') { const c = customers.find((x) => x.id === id); return c ? { entity, entityId: id, title: c.name, sub: `${c.code} · Khách hàng`, module: 'customers', token: c.code } : null; }
    if (entity === 'job') { const j = jobs.find((x) => x.id === id); return j ? { entity, entityId: id, title: jobCustName(j, customers), sub: `${j.code} · Đơn hàng`, module: 'jobs', token: j.code } : null; }
    const p = pos.find((x) => x.id === id); return p ? { entity, entityId: id, title: p.vendor, sub: `${p.code} · PO`, module: 'supply', token: p.code } : null;
  };
  const byThread = new Map<string, { th: Thread; list: RowComment[] }>();
  comments.forEach((c) => {
    const k = threadKey(c);
    const hit = byThread.get(k);
    if (hit) { hit.list.push(c); return; }
    const th = resolve(c.entity, c.entityId);
    if (th) byThread.set(k, { th, list: [c] });
  });
  const lastAt = (k: string) => { const l = byThread.get(k)?.list; return l?.length ? Math.max(...l.map((x) => x.at)) : 0; };
  const unread = (k: string) => (byThread.get(k)?.list ?? []).filter((c) => c.authorId !== me.id && c.at > (chatSeen[k] ?? 0)).length;
  const sel = cur ?? general;
  const selKey = threadKey(sel);
  const all = (byThread.get(selKey)?.list ?? []).slice().sort((a, b) => a.at - b.at);
  const roots = all.filter((c) => !c.parentId);
  const repliesOf = (id: string) => all.filter((c) => c.parentId === id);
  const pins = all.filter((c) => c.pinned).sort((a, b) => (b.pinned?.at ?? 0) - (a.pinned?.at ?? 0));
  const tq = fold(inThread.trim());
  const shown = tq ? roots.filter((c) => fold(`${c.text} ${(c.files ?? []).map((f) => f.name).join(' ')} ${repliesOf(c.id).map((r) => r.text).join(' ')}`).includes(tq)) : roots;
  const open = (th: Thread) => { setCur(th); setInThread(''); setPending([]); setThreadOf(null); setPinsOpen(false); markChatSeen(threadKey(th)); };
  useEffect(() => { if (cur) markChatSeen(selKey); endRef.current?.scrollIntoView({ block: 'end' }); setSumOpen(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selKey, roots.length]);
  // Mở thẳng tin nhắn trực tiếp từ Danh bạ (go('messages', 'dm:a:b'))
  useEffect(() => { if (presetQuery.startsWith('dm:')) { const th = resolve('channel', presetQuery); if (th) open(th); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [presetQuery]);

  const isDm = sel.entity === 'channel' && sel.entityId.startsWith('dm:');
  const group = sel.entity === 'channel' ? myGroups.find((g) => g.id === sel.entityId) : undefined;
  const dmOther = isDm ? users.find((u) => u.id !== me.id && sel.entityId.split(':').includes(u.id)) : undefined;
  const members = (isDm ? [me, dmOther].filter(Boolean) as User[] : group ? users.filter((u) => group.members.includes(u.id)) : users.filter((u) => u.active))
    .slice().sort((a, b) => ['online', 'away', 'offline'].indexOf(presenceOf(a, me.id)) - ['online', 'away', 'offline'].indexOf(presenceOf(b, me.id)));
  const files = all.flatMap((c) => (c.files ?? []).map((f) => ({ f, c })));
  const link = sel.token ? links.find((d) => d.token === sel.token) : undefined;
  const parent = threadOf ? all.find((c) => c.id === threadOf) : undefined;
  /** AI tóm tắt hội thoại: thống kê ngay trong trình duyệt, không gửi nội dung ra ngoài */
  const summary = (() => {
    const week = all.filter((c) => c.at > Date.now() - 7 * 864e5);
    const by = new Map<string, number>(); week.forEach((c) => by.set(c.authorId, (by.get(c.authorId) ?? 0) + 1));
    const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${id === me.id ? 'Bạn' : userName(id)} (${n})`);
    const openQ = roots.filter((c) => /\?\s*$/.test(c.text) && c.authorId !== me.id && !repliesOf(c.id).length && !all.some((x) => x.at > c.at && x.authorId === me.id)).slice(-3);
    const mine = all.filter((c) => c.mentions.includes(me.id) && c.authorId !== me.id).slice(-3);
    const tokens = Array.from(new Set(all.flatMap((c) => c.text.match(/#[\p{L}\p{N}_-]+/gu) ?? []))).slice(0, 6);
    return { total: all.length, week: week.length, top, openQ, mine, tokens, files: files.length, pins: pins.length, last: all[all.length - 1] };
  })();

  const readFiles = (fs: File[], into: (f: ChatFile) => void) => {
    fs.forEach((f) => {
      if (f.size > CHAT_FILE_MAX) { notify(`${f.name} vượt ${fmtSize(CHAT_FILE_MAX)}${CLOUD_ON ? '' : ' (bản chạy trên trình duyệt; bật máy chủ Supabase để gửi file lớn)'}`, 'red'); return; }
      const r = new FileReader();
      r.onload = () => into({ name: f.name, size: f.size, type: f.type || 'application/octet-stream', url: String(r.result) });
      r.readAsDataURL(f);
    });
  };
  const send = (text: string, mentions: string[], parentId?: string) => {
    const fl = parentId ? replyPending : pending;
    if (!text && !fl.length) return;
    const extra = [...(isDm && dmOther ? [dmOther.id] : []), ...(parentId ? [all.find((c) => c.id === parentId)?.authorId ?? ''] : [])].filter((x) => x && x !== me.id);
    addComment({ entity: sel.entity, entityId: sel.entityId, text, mentions: [...new Set([...mentions, ...extra])], module: sel.module, ...(fl.length ? { files: fl } : {}), ...(parentId ? { parentId } : {}) }, sel.title);
    if (parentId) setReplyPending([]); else setPending([]);
  };
  const react = (c: RowComment, emo: string) => patchComment(c.id, (x) => {
    const r = { ...(x.reactions ?? {}) };
    const who = r[emo] ?? [];
    r[emo] = who.includes(me.id) ? who.filter((u) => u !== me.id) : [...who, me.id];
    if (!r[emo].length) delete r[emo];
    return { ...x, reactions: r };
  });
  const togglePin = (c: RowComment) => { patchComment(c.id, (x) => ({ ...x, pinned: x.pinned ? undefined : { by: me.id, at: Date.now() } })); notify(c.pinned ? 'Đã bỏ ghim' : 'Đã ghim tin nhắn lên đầu kênh', 'teal'); };
  const jumpTo = (id: string) => { const el = document.getElementById(`msg-${id}`); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); el?.animate?.([{ backgroundColor: 'rgba(242,140,51,.18)' }, { backgroundColor: 'transparent' }], { duration: 1400 }); };
  const createGroup = () => {
    const name = gName.trim();
    if (name.length < 3) return notify('Đặt tên nhóm tối thiểu 3 ký tự', 'red');
    const g: ChatChannel = { id: uid('ch'), name, desc: gDesc.trim() || undefined, members: [...new Set([me.id, ...gMembers])], createdBy: me.id, at: Date.now() };
    setChannels((p) => [...p, g]);
    setNewGroup(false); setGName(''); setGDesc(''); setGMembers([]);
    open(groupThread(g));
    notify(`Đã tạo nhóm ${name}`, 'teal');
  };

  const gq = fold(q.trim());
  const hits = gq.length >= 2 ? [...byThread.values()].flatMap(({ th, list: l }) => l.filter((c) => fold(`${c.text} ${(c.files ?? []).map((f) => f.name).join(' ')}`).includes(gq)).map((c) => ({ th, c }))).sort((a, b) => b.c.at - a.c.at).slice(0, 30) : [];
  const recordThreads = [...byThread.entries()].filter(([, v]) => v.th.entity !== 'channel').sort((a, b) => lastAt(b[0]) - lastAt(a[0]));
  const dmUsers = users.filter((u) => u.active && u.id !== me.id).map((u) => ({ u, k: `channel:${dmId(me.id, u.id)}` })).filter(({ k }) => byThread.has(k)).sort((a, b) => lastAt(b.k) - lastAt(a.k));
  const tile = (icon: ReactNode) => <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--ink)/0.1)] text-[rgb(var(--muted))]">{icon}</span>;

  const item = (th: Thread, k: string, icon: ReactNode) => {
    const l = byThread.get(k)?.list ?? [];
    const last = l.length ? l.reduce((x, y) => (x.at > y.at ? x : y)) : undefined;
    const n = unread(k);
    const on = !!cur && k === selKey;
    return (
      <button key={k} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors', on ? 'bg-[rgb(var(--ink)/0.07)]' : 'hover:bg-[rgb(var(--ink)/0.04)]')} onClick={() => open(th)} aria-current={on || undefined}>
        {icon}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2"><span className={cn('truncate text-[15px]', n ? 'font-semibold text-[rgb(var(--fg))]' : 'font-semibold text-[rgb(var(--fg2))]')}>{th.title}</span>{last && <span className="ml-auto shrink-0 text-[11px] text-[rgb(var(--faint))]">{new Date(last.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>}</span>
          <span className={cn('mt-0.5 block truncate text-[13px]', n ? 'text-[rgb(var(--fg2))]' : 'text-[rgb(var(--faint))]')}>{last ? `${last.authorId === me.id ? 'Bạn' : userName(last.authorId).split(' ').slice(-1)[0]}: ${last.text || (last.files?.length ? `[${last.files.length} file]` : '')}` : th.sub}</span>
        </span>
        {n > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[rgb(var(--accent))] px-1.5 text-[11px] font-semibold text-[rgb(var(--on-accent))]">{n}</span>}
      </button>
    );
  };
  const sec = (title: string, action?: ReactNode) => <div className="flex items-center justify-between px-3 pb-2 pt-5"><p className="text-[11px] font-semibold text-[rgb(var(--faint))]">{title}</p>{action}</div>;
  const plus = (label: string, onClick: () => void) => <button className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--faint))] hover:bg-[rgb(var(--ink)/0.1)] hover:text-[rgb(var(--fg))]" onClick={onClick} aria-label={label} title={label}><Plus className="h-4 w-4" /></button>;

  /** Một tin nhắn: thanh thao tác khi rê chuột (thả cảm xúc, trả lời theo chủ đề, ghim), cảm xúc, số trả lời */
  const renderMsg = (c: RowComment, compactRow?: boolean, inPanel?: boolean) => {
    const mine = c.authorId === me.id;
    const reps = inPanel ? [] : repliesOf(c.id);
    const au = userById(c.authorId);
    return (
      <div key={c.id} id={inPanel ? undefined : `msg-${c.id}`} className={cn('group relative -mx-3 flex gap-3 rounded-lg px-3 py-1.5 transition-colors hover:bg-[rgb(var(--ink)/0.025)]', !compactRow && 'mt-3')}>
        {compactRow ? <span className="w-9 shrink-0" /> : <PAvatar user={au} name={userName(c.authorId)} size={36} meId={me.id} />}
        <div className="min-w-0 flex-1">
          {!compactRow && <p className="flex items-baseline gap-2"><b className="text-[15px] font-semibold text-[rgb(var(--fg))]">{mine ? 'Bạn' : userName(c.authorId)}</b><span className="text-xs text-[rgb(var(--faint))]">{new Date(c.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>{c.pinned && <span className="flex items-center gap-1 text-[11px] text-[rgb(var(--accent-fg))]"><Pin className="h-3 w-3" aria-hidden />Đã ghim</span>}</p>}
          {c.text && <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-[rgb(var(--fg2))]"><MentionText text={c.text} /></p>}
          {c.files?.length ? <ChatFiles files={c.files} /> : null}
          {c.reactions && Object.keys(c.reactions).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {Object.entries(c.reactions).map(([emo, who]) => (
                <button key={emo} onClick={() => react(c, emo)} title={who.map((u) => (u === me.id ? 'Bạn' : userName(u))).join(', ')}
                  className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] transition-colors', who.includes(me.id) ? 'border-[rgb(var(--secondary)/0.7)] bg-[rgb(var(--secondary)/0.2)] text-[rgb(var(--fg))]' : 'border-[rgb(var(--ink)/0.1)] text-[rgb(var(--fg2))] hover:border-[rgb(var(--ink)/0.25)]')}>
                  <span>{emo}</span><span className="font-num text-xs">{who.length}</span>
                </button>
              ))}
            </div>
          )}
          {reps.length > 0 && (
            <button className="mt-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] font-semibold text-[rgb(var(--secondary-fg))] hover:bg-[rgb(var(--secondary)/0.1)]" onClick={() => setThreadOf(c.id)}>
              <span className="flex -space-x-1.5">{[...new Set(reps.map((r) => r.authorId))].slice(0, 3).map((u) => <Avatar key={u} name={userName(u)} size={20} />)}</span>
              {reps.length} trả lời<span className="font-normal text-[rgb(var(--faint))]">· {new Date(reps[reps.length - 1].at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            </button>
          )}
        </div>
        {/* Thanh thao tác nổi */}
        <div className={cn('absolute -top-3 right-2 hidden items-center gap-0.5 rounded-md border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--raised))] p-0.5 shadow-lg group-hover:flex', pickReact === c.id && 'flex')}>
          {QUICK_REACTIONS.slice(0, 3).map((e) => <button key={e} className="flex h-7 w-7 items-center justify-center rounded text-[15px] hover:bg-[rgb(var(--ink)/0.1)]" onClick={() => react(c, e)} aria-label={`Thả ${e}`}>{e}</button>)}
          <div className="relative">
            <button className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] hover:text-[rgb(var(--fg))]" onClick={() => setPickReact(pickReact === c.id ? null : c.id)} aria-label="Thêm cảm xúc" title="Thêm cảm xúc"><SmilePlus className="h-4 w-4" /></button>
            {pickReact === c.id && <div className="absolute right-0 top-full z-10 mt-1 flex gap-0.5 rounded-md border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--raised))] p-1 shadow-xl">{QUICK_REACTIONS.map((e) => <button key={e} className="flex h-8 w-8 items-center justify-center rounded text-base hover:bg-[rgb(var(--ink)/0.1)]" onClick={() => { react(c, e); setPickReact(null); }}>{e}</button>)}</div>}
          </div>
          {!inPanel && <button className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] hover:text-[rgb(var(--fg))]" onClick={() => setThreadOf(c.id)} aria-label="Trả lời theo chủ đề" title="Trả lời theo chủ đề"><Reply className="h-4 w-4" /></button>}
          {!inPanel && <button className={cn('flex h-7 w-7 items-center justify-center rounded hover:bg-[rgb(var(--ink)/0.1)]', c.pinned ? 'text-[rgb(var(--accent-fg))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')} onClick={() => togglePin(c)} aria-label={c.pinned ? 'Bỏ ghim' : 'Ghim lên đầu kênh'} title={c.pinned ? 'Bỏ ghim' : 'Ghim lên đầu kênh'}><Pin className="h-4 w-4" /></button>}
        </div>
      </div>
    );
  };
  const pendingChips = (fl: ChatFile[], set: (f: ChatFile[]) => void) => fl.length > 0 && (
    <div className="mb-2 flex flex-wrap gap-1.5">{fl.map((f, i) => <span key={i} className="flex items-center gap-1.5 rounded-md border border-[rgb(var(--ink)/0.1)] bg-[rgb(var(--ink)/0.04)] py-1 pl-2.5 pr-1 text-xs"><Paperclip className="h-3 w-3 text-[rgb(var(--muted))]" aria-hidden />{f.name}<span className="text-[rgb(var(--faint))]">{fmtSize(f.size)}</span><button className="rounded p-0.5 hover:bg-[rgb(var(--ink)/0.1)]" onClick={() => set(fl.filter((_, j) => j !== i))} aria-label={`Bỏ ${f.name}`}><X className="h-3 w-3" /></button></span>)}</div>
  );
  const attachBtn = (onFiles: (f: File[]) => void) => <FilePicker multiple onFiles={onFiles} className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--faint))] transition-colors hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]"><span title="Gửi file (hoặc kéo thả vào khung chat)" className="flex"><Paperclip className="h-4 w-4" aria-label="Gửi file" /></span></FilePicker>;
  let lastDay = '';

  return (
    <div className="glass-card -mx-3 flex h-[calc(100vh-7.5rem)] min-h-[520px] overflow-hidden rounded-lg sm:mx-0">
      {/* ---------- Danh sách kênh ---------- */}
      <aside className={cn('flex w-full shrink-0 flex-col border-r border-[rgb(var(--ink)/0.06)] md:w-[320px]', cur && 'max-md:hidden')}>
        {notifAsk && (
          <div className="m-3 mb-0 rounded-md bg-[rgb(var(--secondary))] p-3 text-sm text-white">
            <div className="flex items-start gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><p className="flex-1"><b>Bật thông báo</b> để nhận tin nhắn mới khi đang mở tab khác.</p><button className="rounded p-0.5 hover:bg-white/15" onClick={() => { setNotifAsk(false); try { localStorage.setItem('3a:ui:notif-dismissed', '1'); } catch { /* bỏ qua */ } }} aria-label="Đóng"><X className="h-4 w-4" aria-hidden /></button></div>
            <button className="mt-2 rounded bg-white px-3 py-1 text-xs font-semibold text-[rgb(var(--secondary))]" onClick={() => { void Notification.requestPermission().then((p) => { setNotifAsk(false); notify(p === 'granted' ? 'Đã bật thông báo tin nhắn' : 'Trình duyệt chưa cho phép thông báo', p === 'granted' ? 'teal' : 'orange'); }); }}>Bật ngay</button>
          </div>
        )}
        <div className="px-4 pb-2 pt-4">
          <h2 className="font-display text-lg font-semibold">Tin nhắn</h2>
          <div className="mt-3 grid grid-cols-3 gap-1 rounded-md bg-[rgb(var(--ink)/0.04)] p-1" role="tablist" aria-label="Loại hội thoại">
            {([['all', 'Hội thoại', MessageSquare], ['fav', 'Ưa thích', Star], ['ai', 'Trợ lý AI', Sparkles]] as const).map(([id, label, Ic]) => (
              <button key={id} role="tab" aria-selected={ltab === id} className={cn('flex flex-col items-center gap-0.5 rounded py-1.5 text-[11px] font-medium transition-colors', ltab === id ? 'bg-[rgb(var(--surface))] text-[rgb(var(--secondary-fg))] shadow-[var(--shadow-sm)]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')} onClick={() => setLtab(id)}><Ic className="h-4 w-4" aria-hidden />{label}</button>
            ))}
          </div>
          <div className="relative mt-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--faint))]" aria-hidden /><input className={cn(inputCls, 'rounded-lg border-[rgb(var(--ink)/0.08)] py-2.5 pl-9 text-sm')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm trong lịch sử, tên file…" aria-label="Tìm lịch sử tin nhắn" /></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {ltab === 'ai' ? (
            <div className="space-y-2 px-2 pt-3">
              <p className="px-1 text-xs text-[rgb(var(--muted))]">Trợ lý phân tích trên dữ liệu doanh nghiệp. Chọn câu hỏi gợi ý, hoặc gõ <b>@AI câu hỏi</b> trong bất kỳ hội thoại nào để trợ lý trả lời ngay trong kênh.</p>
              {['Tóm tắt hôm nay', 'Lead sắp trễ SLA', 'Công nợ quá hạn', 'Dự báo doanh thu 3 tháng', 'Quỹ MDF còn lại'].map((q2) => (
                <button key={q2} className="flex w-full items-center gap-2.5 rounded-lg border border-[rgb(var(--line))] px-3 py-2.5 text-left text-sm hover:border-[rgb(var(--secondary)/0.6)]" onClick={() => askAi(q2)}><Bot className="h-4 w-4 text-[rgb(var(--secondary-fg))]" aria-hidden />{q2}</button>
              ))}
            </div>
          ) : ltab === 'fav' ? (
            <>
              {sec('Hội thoại ưa thích')}
              {[...byThread.entries()].filter(([k]) => favs.includes(k)).map(([k, v]) => item(v.th, k, tile(v.th.entityId.startsWith('dm:') ? <Users className="h-[18px] w-[18px]" aria-hidden /> : <Star className="h-[18px] w-[18px]" aria-hidden />)))}
              {favs.includes('channel:general') && !byThread.has('channel:general') && item(general, 'channel:general', tile(<Hash className="h-[18px] w-[18px]" aria-hidden />))}
              {!favs.length && <p className="px-3 py-8 text-center text-sm text-[rgb(var(--faint))]">Bấm ngôi sao trên đầu hội thoại để đưa vào Ưa thích.</p>}
            </>
          ) : gq.length >= 2 ? (
            <>
              {sec(`${hits.length} kết quả`)}
              {hits.map(({ th, c }) => (
                <button key={c.id} className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-[rgb(var(--ink)/0.04)]" onClick={() => { open(th); setInThread(q); setQ(''); }}>
                  <span className="flex items-center gap-2 text-xs text-[rgb(var(--faint))]"><b className="truncate text-[13px] text-[rgb(var(--fg2))]">{th.title}</b><span className="ml-auto shrink-0">{new Date(c.at).toLocaleDateString('vi-VN')}</span></span>
                  <span className="mt-0.5 line-clamp-2 text-sm text-[rgb(var(--fg2))]">{userName(c.authorId)}: {c.text || (c.files ?? []).map((f) => f.name).join(', ')}</span>
                </button>
              ))}
              {!hits.length && <p className="px-3 py-8 text-center text-sm text-[rgb(var(--faint))]">Không tìm thấy tin nhắn nào chứa “{q}”.</p>}
            </>
          ) : (
            <>
              {sec('Kênh & nhóm', plus('Tạo nhóm chat', () => { setNewGroup(true); setGMembers([]); }))}
              {item(general, 'channel:general', tile(<Hash className="h-[18px] w-[18px]" aria-hidden />))}
              {myGroups.slice().sort((a, b) => lastAt(`channel:${b.id}`) - lastAt(`channel:${a.id}`)).map((g) => item(groupThread(g), `channel:${g.id}`, tile(<Users2 className="h-[18px] w-[18px]" aria-hidden />)))}
              {sec('Tin nhắn trực tiếp', plus('Nhắn tin trực tiếp', () => setNewDm(true)))}
              {dmUsers.map(({ u, k }) => item(dmThread(u), k, <PAvatar user={u} size={40} meId={me.id} />))}
              {!dmUsers.length && <button className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-[rgb(var(--faint))] hover:bg-[rgb(var(--ink)/0.04)]" onClick={() => setNewDm(true)}>+ Bắt đầu trò chuyện với đồng nghiệp</button>}
              {recordThreads.length > 0 && sec('Theo dự án / đơn hàng')}
              {recordThreads.map(([k, v]) => item(v.th, k, tile(<MessageSquare className="h-[18px] w-[18px]" aria-hidden />)))}
            </>
          )}
        </div>
      </aside>

      {/* ---------- Hội thoại (kéo thả file vào bất kỳ đâu) ---------- */}
      <section className={cn('relative flex min-w-0 flex-1 flex-col', !cur && 'max-md:hidden')}
        onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging((d) => d + 1); } }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
        onDragLeave={() => setDragging((d) => Math.max(0, d - 1))}
        onDrop={(e) => { e.preventDefault(); setDragging(0); if (e.dataTransfer.files.length) readFiles(Array.from(e.dataTransfer.files), (f) => (threadOf ? setReplyPending((p) => [...p, f]) : setPending((p) => [...p, f]))); }}>
        {!cur && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-y-auto bg-[rgb(var(--surface))] p-6 text-center">
            <p className="font-display text-xl font-semibold">Xin chào {me.name} 👋</p>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">Trao đổi nhanh với đồng nghiệp, theo từng dự án, đơn hàng, ngay trong {company.shortName}.</p>
            <div className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { t: 'Nhắn tin đồng nghiệp', d: 'Tin nhắn trực tiếp 1-1, gửi file, ghim tin quan trọng.', i: Users, run: () => setNewDm(true) },
                { t: 'Tạo nhóm chat', d: 'Nhóm theo dự án, phòng ban; thêm thành viên tùy ý.', i: Users2, run: () => { setNewGroup(true); setGMembers([]); } },
                { t: 'Hỏi trợ lý AI', d: 'Phân tích SLA, doanh thu, công nợ, quỹ MDF trên dữ liệu trong app.', i: Sparkles, run: () => askAi() },
              ].map((c) => (
                <button key={c.t} className="rounded-lg border border-[rgb(var(--line))] p-4 text-left transition-colors hover:border-[rgb(var(--secondary)/0.6)] hover:bg-[rgb(var(--secondary)/0.05)]" onClick={c.run}>
                  <c.i className="h-5 w-5 text-[rgb(var(--secondary-fg))]" aria-hidden />
                  <p className="mt-2 text-sm font-semibold">{c.t}</p>
                  <p className="mt-1 text-xs text-[rgb(var(--muted))]">{c.d}</p>
                  <p className="mt-2 text-xs font-medium text-[rgb(var(--secondary-fg))]">Thử ngay →</p>
                </button>
              ))}
            </div>
            <button className={cn(btnPrimary, 'mt-6')} onClick={() => open(general)}><Hash className="h-4 w-4" aria-hidden />Mở Kênh chung</button>
          </div>
        )}
        {dragging > 0 && (
          <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--secondary))] bg-[rgb(var(--sunken)/0.85)] text-[rgb(var(--fg2))]">
            <Upload className="h-8 w-8 text-[rgb(var(--secondary-fg))]" aria-hidden /><p className="text-base font-semibold">Thả file để gửi vào {threadOf ? 'chủ đề' : sel.title}</p><p className="text-xs text-[rgb(var(--muted))]">Tối đa {fmtSize(CHAT_FILE_MAX)} mỗi file</p>
          </div>
        )}
        <header className="flex items-center gap-3 border-b border-[rgb(var(--ink)/0.06)] px-5 py-3.5">
          <button className="rounded p-1 text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] md:hidden" onClick={() => setCur(null)} aria-label="Danh sách kênh"><ArrowLeft className="h-4 w-4" /></button>
          {isDm && dmOther ? <PAvatar user={dmOther} size={40} meId={me.id} /> : tile(sel.entity === 'channel' ? (group ? <Users2 className="h-[18px] w-[18px]" /> : <Hash className="h-[18px] w-[18px]" />) : <MessageSquare className="h-[18px] w-[18px]" />)}
          {/* v59: tên kênh luôn đọc được (trước bị ô tìm + nút ép còn "Kê…") */}
          <div className="min-w-[150px] flex-1">
            <h2 className="font-display truncate text-[17px] font-semibold" title={sel.title}>{sel.title}</h2>
            <p className="truncate text-[13px] text-[rgb(var(--muted))]">{isDm && dmOther ? `${PRESENCE_META[presenceOf(dmOther, me.id)].label} · ${ROLE_LABEL[dmOther.role]}` : group ? `${group.desc ? `${group.desc} · ` : ''}${group.members.length} thành viên` : `${sel.sub} · ${members.length} người`}</p>
          </div>
          <div className="relative hidden sm:block"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[rgb(var(--faint))]" aria-hidden /><input className={cn(inputBase, 'w-32 rounded-lg border-[rgb(var(--ink)/0.08)] py-1.5 pl-8 text-[13px] 2xl:w-44')} value={inThread} onChange={(e) => setInThread(e.target.value)} placeholder="Tìm trong kênh" aria-label="Tìm trong kênh" /></div>
          <button className={cn('flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors', sumOpen ? 'bg-[rgb(var(--secondary)/0.15)] text-[rgb(var(--secondary-fg))]' : 'text-[rgb(var(--secondary-fg))] hover:bg-[rgb(var(--secondary)/0.1)]')} onClick={() => setSumOpen((v) => !v)} aria-expanded={sumOpen} aria-label="AI tóm tắt" title="AI tóm tắt"><Sparkles className="h-4 w-4" aria-hidden /><span className="hidden 2xl:inline">AI tóm tắt</span></button>
          <button className={cn('flex h-8 w-8 items-center justify-center rounded-md hover:bg-[rgb(var(--ink)/0.06)]', favs.includes(selKey) ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--muted))]')} onClick={() => toggleFavThread(selKey)} aria-pressed={favs.includes(selKey)} aria-label={favs.includes(selKey) ? 'Bỏ ưa thích' : 'Thêm vào ưa thích'}><Star className={cn('h-4 w-4', favs.includes(selKey) && 'fill-current')} aria-hidden /></button>
          {link && <button className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]" onClick={link.open} title={`Mở ${sel.token}`}><ExternalLink className="h-4 w-4" aria-hidden /><span className="hidden xl:inline">{sel.token}</span></button>}
          <button className={cn('hidden h-8 w-8 items-center justify-center rounded-md lg:flex', side === 'info' && !threadOf ? 'bg-[rgb(var(--ink)/0.08)] text-[rgb(var(--fg))]' : 'text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.06)] hover:text-[rgb(var(--fg))]')} onClick={() => { setThreadOf(null); setSide((v) => (v === 'info' && !threadOf ? 'none' : 'info')); }} aria-label="Thông tin kênh" title="Thông tin kênh"><Info className="h-[18px] w-[18px]" /></button>
        </header>
        {sumOpen && (
          <div className="border-b border-[rgb(var(--ink)/0.06)] bg-[rgb(var(--secondary)/0.06)] px-5 py-3 text-sm" aria-live="polite">
            <p className="mb-1.5 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-[rgb(var(--secondary-fg))]" aria-hidden />Tóm tắt {sel.title}</p>
            {summary.total ? (
              <ul className="list-disc space-y-1 pl-5 text-[rgb(var(--fg2))]">
                <li>{summary.total} tin, {summary.week} tin trong 7 ngày qua{summary.top.length ? `; trao đổi nhiều nhất: ${summary.top.join(', ')}` : ''}.</li>
                {summary.mine.length > 0 && <li>Nhắc tên bạn: {summary.mine.map((c) => `${userName(c.authorId)}: “${c.text.slice(0, 60)}”`).join(' · ')}</li>}
                {summary.openQ.length > 0 && <li>Câu hỏi chưa trả lời: {summary.openQ.map((c) => `“${c.text.slice(0, 70)}”`).join(' · ')}</li>}
                {summary.tokens.length > 0 && <li>Liên quan: {summary.tokens.join(', ')}</li>}
                {(summary.files > 0 || summary.pins > 0) && <li>{summary.files} file chia sẻ, {summary.pins} tin ghim.</li>}
                {summary.last && <li>Tin gần nhất {new Date(summary.last.at).toLocaleString('vi-VN')} bởi {summary.last.authorId === me.id ? 'bạn' : userName(summary.last.authorId)}.</li>}
              </ul>
            ) : <p className="text-[rgb(var(--muted))]">Chưa có tin nhắn để tóm tắt.</p>}
          </div>
        )}
        {pins.length > 0 && (
          <div className="border-b border-[rgb(var(--ink)/0.06)] px-5 py-2">
            <button className="flex w-full items-center gap-2 text-left text-[13px]" onClick={() => setPinsOpen((v) => !v)} aria-expanded={pinsOpen}>
              <Pin className="h-4 w-4 shrink-0 text-[rgb(var(--accent-fg))]" aria-hidden /><span className="min-w-0 flex-1 truncate text-[rgb(var(--fg2))]"><b className="text-[rgb(var(--fg))]">{userName(pins[0].authorId)}:</b> {pins[0].text || (pins[0].files ?? []).map((f) => f.name).join(', ')}</span>
              <span className="shrink-0 text-xs text-[rgb(var(--faint))]">{pins.length} tin ghim</span><ChevronDown className={cn('h-4 w-4 text-[rgb(var(--faint))] transition-transform', pinsOpen && 'rotate-180')} aria-hidden />
            </button>
            {pinsOpen && <ul className="mt-2 space-y-1">{pins.map((p) => <li key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-[rgb(var(--ink)/0.04)]"><button className="min-w-0 flex-1 truncate text-left text-[rgb(var(--fg2))]" onClick={() => (p.parentId ? setThreadOf(p.parentId) : jumpTo(p.id))}><b className="text-[rgb(var(--fg))]">{userName(p.authorId)}:</b> {p.text || (p.files ?? []).map((f) => f.name).join(', ')}</button><button className="shrink-0 text-xs text-[rgb(var(--faint))] hover:text-[rgb(var(--fg))]" onClick={() => togglePin(p)}>Bỏ ghim</button></li>)}</ul>}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tq && <p className="mb-3 rounded-md bg-[rgb(var(--accent)/0.1)] px-3 py-2 text-[13px] text-[rgb(var(--accent-fg))]">{shown.length} tin khớp “{inThread}” <button className="ml-2 underline" onClick={() => setInThread('')}>Bỏ lọc</button></p>}
          {!roots.length && <EmptyState text={<>Chưa có tin nhắn trong {sel.title}</>} hint={<>Gõ @ để gắn thẻ, # để chèn liên kết, hoặc kéo thả file vào đây để gửi.</>} art="inbox" />}
          {shown.map((c, i) => {
            const day = new Date(c.at).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
            const sepDay = day !== lastDay; lastDay = day;
            const prev = shown[i - 1];
            const compactRow = !sepDay && !!prev && prev.authorId === c.authorId && c.at - prev.at < 5 * 60000;
            return (
              <Fragment key={c.id}>
                {sepDay && <div className="flex items-center gap-3 py-3 text-xs font-medium text-[rgb(var(--faint))]"><span className="h-px flex-1 bg-[rgb(var(--ink)/0.06)]" />{day}<span className="h-px flex-1 bg-[rgb(var(--ink)/0.06)]" /></div>}
                {renderMsg(c, compactRow)}
              </Fragment>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="px-5 pb-4 pt-1">
          {pendingChips(pending, setPending)}
          <div className="mb-2 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <button className="shrink-0 rounded-full border border-[rgb(var(--line))] px-2.5 py-1 text-xs hover:border-[rgb(var(--secondary)/0.6)]" onClick={() => setSumOpen(true)}><b className="text-[rgb(var(--secondary-fg))]">@ai</b> tóm tắt hội thoại</button>
            {['Phân tích doanh thu', 'Công nợ quá hạn', 'Lead sắp trễ SLA'].map((q2) => <button key={q2} className="shrink-0 rounded-full border border-[rgb(var(--line))] px-2.5 py-1 text-xs hover:border-[rgb(var(--secondary)/0.6)]" onClick={() => askAi(q2)}><b className="text-[rgb(var(--secondary-fg))]">@ai</b> {q2.toLowerCase()}</button>)}
          </div>
          <MentionComposer rows={1} placeholder={`Nhắn tới ${sel.title}…`} canSendEmpty={pending.length > 0} onSend={(t, m) => send(t, m)} toolbar={attachBtn((fs) => readFiles(fs, (f) => setPending((p) => [...p, f])))} />
        </div>
      </section>

      {/* ---------- Cột phải: chủ đề (thread) hoặc thông tin kênh dạng accordion ---------- */}
      {parent ? (
        <aside className="hidden w-[340px] shrink-0 flex-col border-l border-[rgb(var(--ink)/0.06)] lg:flex">
          <div className="flex items-center gap-2 border-b border-[rgb(var(--ink)/0.06)] px-4 py-3.5"><Reply className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden /><div className="min-w-0 flex-1"><p className="font-display text-[15px] font-semibold">Chủ đề</p><p className="truncate text-xs text-[rgb(var(--faint))]">{sel.title}</p></div><button className="rounded p-1.5 text-[rgb(var(--muted))] hover:bg-[rgb(var(--ink)/0.1)] hover:text-[rgb(var(--fg))]" onClick={() => setThreadOf(null)} aria-label="Đóng chủ đề"><X className="h-4 w-4" /></button></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {renderMsg(parent, false, true)}
            <div className="my-3 flex items-center gap-3 text-xs text-[rgb(var(--faint))]"><span className="h-px flex-1 bg-[rgb(var(--ink)/0.06)]" />{repliesOf(parent.id).length} trả lời<span className="h-px flex-1 bg-[rgb(var(--ink)/0.06)]" /></div>
            {repliesOf(parent.id).map((r) => renderMsg(r, false, true))}
          </div>
          <div className="px-4 pb-4">{pendingChips(replyPending, setReplyPending)}<MentionComposer rows={1} placeholder="Trả lời trong chủ đề…" canSendEmpty={replyPending.length > 0} onSend={(t, m) => send(t, m, parent.id)} toolbar={attachBtn((fs) => readFiles(fs, (f) => setReplyPending((p) => [...p, f])))} /></div>
        </aside>
      ) : side === 'info' && cur && (
        <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-l border-[rgb(var(--ink)/0.06)] lg:flex">
          <details open className="group border-b border-[rgb(var(--ink)/0.06)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold hover:bg-[rgb(var(--ink)/0.02)]"><Users2 className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Thành viên<span className="text-[rgb(var(--faint))]">{members.length}</span><ChevronDown className="ml-auto h-4 w-4 text-[rgb(var(--faint))] transition-transform group-open:rotate-180" aria-hidden /></summary>
            <ul className="space-y-1 px-3 pb-4">{members.slice(0, 15).map((u) => <li key={u.id} className="flex items-center gap-3 rounded-md px-2 py-1.5"><PAvatar user={u} size={30} meId={me.id} /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{u.name}{u.id === me.id ? ' (bạn)' : ''}</span><span className="block truncate text-xs text-[rgb(var(--faint))]">{ROLE_LABEL[u.role]}</span></span></li>)}{members.length > 15 && <li className="px-2 text-xs text-[rgb(var(--faint))]">+{members.length - 15} người khác</li>}</ul>
            {group && (group.createdBy === me.id || role === 'BOD') && (
              <div className="px-5 pb-4"><select className={cn(inputCls, 'py-1.5 text-xs')} value="" onChange={(e) => { const id = e.target.value; if (id) setChannels((p) => p.map((x) => (x.id === group.id ? { ...x, members: [...new Set([...x.members, id])] } : x))); }} aria-label="Thêm thành viên">
                <option value="">+ Thêm thành viên…</option>{users.filter((u) => u.active && !group.members.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></div>
            )}
          </details>
          <details className="group border-b border-[rgb(var(--ink)/0.06)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold hover:bg-[rgb(var(--ink)/0.02)]"><Pin className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Tin đã ghim<span className="text-[rgb(var(--faint))]">{pins.length}</span><ChevronDown className="ml-auto h-4 w-4 text-[rgb(var(--faint))] transition-transform group-open:rotate-180" aria-hidden /></summary>
            <ul className="space-y-1 px-3 pb-4">{pins.map((p) => <li key={p.id}><button className="w-full rounded-md px-2 py-1.5 text-left text-[13px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)]" onClick={() => (p.parentId ? setThreadOf(p.parentId) : jumpTo(p.id))}><b>{userName(p.authorId)}:</b> {p.text || (p.files ?? []).map((f) => f.name).join(', ')}</button></li>)}{!pins.length && <li className="px-2 text-xs text-[rgb(var(--faint))]">Rê chuột vào tin nhắn và bấm biểu tượng ghim.</li>}</ul>
          </details>
          <details className="group border-b border-[rgb(var(--ink)/0.06)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold hover:bg-[rgb(var(--ink)/0.02)]"><Paperclip className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />File đã chia sẻ<span className="text-[rgb(var(--faint))]">{files.length}</span><ChevronDown className="ml-auto h-4 w-4 text-[rgb(var(--faint))] transition-transform group-open:rotate-180" aria-hidden /></summary>
            <div className="px-4 pb-4">{files.length ? <ChatFiles files={files.slice().reverse().slice(0, 20).map((x) => x.f)} /> : <p className="px-1 text-xs text-[rgb(var(--faint))]">Chưa có file.</p>}</div>
          </details>
          {link && <button className="mx-5 mt-4 flex items-center gap-2 text-[13px] text-[rgb(var(--secondary-fg))] hover:underline" onClick={link.open}><ExternalLink className="h-4 w-4" aria-hidden />Mở bản ghi {sel.token}</button>}
          {!CLOUD_ON && <p className="mt-auto px-5 pb-4 pt-6 text-[11px] leading-relaxed text-[rgb(var(--faint))]">File tối đa {fmtSize(CHAT_FILE_MAX)} khi chạy trong trình duyệt; bật máy chủ Supabase để gửi đến {fmtSize(25 * 1048576)}.</p>}
        </aside>
      )}

      {newGroup && (
        <Modal title="Tạo nhóm chat" onClose={() => setNewGroup(false)} footer={<><button className={btnGhost} onClick={() => setNewGroup(false)}>Hủy</button><button className={btnPrimary} onClick={createGroup}>Tạo nhóm</button></>}>
          <div className="space-y-3">
            <Field label="Tên nhóm"><input className={inputCls} value={gName} onChange={(e) => setGName(e.target.value)} placeholder="VD: Dự án KCN Phú Mỹ 3, Phòng EMD Nam…" autoFocus /></Field>
            <Field label="Mô tả (không bắt buộc)"><input className={inputCls} value={gDesc} onChange={(e) => setGDesc(e.target.value)} /></Field>
            <div>
              <p className="mb-1.5 text-xs font-medium text-[rgb(var(--muted))]">Thành viên ({gMembers.length} đã chọn)</p>
              <div className="max-h-60 space-y-1 overflow-y-auto rounded border border-[rgb(var(--ink)/0.08)] p-2">
                {users.filter((u) => u.active && u.id !== me.id).map((u) => (
                  <label key={u.id} className="flex items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-[rgb(var(--ink)/0.04)]">
                    <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={gMembers.includes(u.id)} onChange={(e) => setGMembers((p) => (e.target.checked ? [...p, u.id] : p.filter((x) => x !== u.id)))} />
                    <PAvatar user={u} size={24} meId={me.id} /><span className="flex-1">{u.name}</span><span className="text-[11px] text-[rgb(var(--muted))]">{ROLE_LABEL[u.role]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
      {newDm && (
        <Modal title="Nhắn tin trực tiếp" onClose={() => setNewDm(false)}>
          <ul className="space-y-1">
            {users.filter((u) => u.active && u.id !== me.id).map((u) => <li key={u.id}><button className="flex w-full items-center gap-3 rounded px-2 py-2 text-left hover:bg-[rgb(var(--ink)/0.05)]" onClick={() => { setNewDm(false); open(dmThread(u)); }}><PAvatar user={u} size={32} meId={me.id} /><span className="flex-1"><span className="block text-sm">{u.name}</span><span className="block text-xs text-[rgb(var(--muted))]">{ROLE_LABEL[u.role]} · {PRESENCE_META[presenceOf(u, me.id)].label}</span></span></button></li>)}
          </ul>
        </Modal>
      )}
    </div>
  );
}

export function OverviewPage() {
  const lay = useTenantLayout('home');
  return lay ? <TenantLayoutPage ver={lay} /> : <ExecDashboard />;
}

export function TradingOverview() {
  const { company } = useApp();
  const [tab, setTab] = useSticky<'board' | 'mkt' | 'cust' | 'mdf'>('TradingOverview.tab', bizMode(company) === 'TRADING' ? 'board' : 'mdf');
  return (
    <div className="space-y-5">
      <Tabs
        tabs={[
          ...(bizMode(company) === 'TRADING' ? [{ id: 'board' as const, label: 'Bảng điều khiển' }] : []),
          { id: 'mdf', label: 'Quỹ MDF & Marketing' },
          { id: 'mkt', label: 'Data MKT' },
          { id: 'cust', label: 'Khách & dự án' },
        ]}
        value={tab}
        onChange={setTab}
 />
      {tab === 'board' && <CommandCenter />}
      {tab === 'mkt' && <MktOverview />}
      {tab === 'cust' && <CustomerProjectOverview />}
      {tab === 'mdf' && <div className="space-y-5"><MdfOverview /><TradingReports embedded /></div>}
    </div>
  );
}

export function MktOverview() {
  const { myLeads: leads, customers, programs, claims, now, routeLeads, openCustomer, go, canDo, dept, routableDepts, policy } = useApp();
  const canRoute = canDo('lead.route');

  // ---- 1. Hàng thống kê nhanh ----
  const week = leads.filter((l) => l.receivedDaysAgo <= 7);
  const mqlWeek = week.filter((l) => (l.score ?? scoreLead(l, customers)) >= MQL_THRESHOLD).length;
  const slaDone = leads.filter((l) => l.slaMet !== undefined);
  const slaMet = slaDone.filter((l) => l.slaMet).length;
  const quoted = leads.filter((l) => l.status === 'QUOTED');
  const mktCustomers = customers.filter(isMktCustomer);
  const mktRevenue = mktCustomers.reduce((s, c) => s + c.ytdRevenue, 0);

  // ---- 2. Hộp thư lead chờ phân bổ ----
  const inbox = leads.filter((l) => l.status === 'NEW' || l.status === 'NURTURE').slice(0, 6);

  // ---- 3. Khách hàng kết nối chương trình Hãng ----
  const mdfCustomers = customers
    .map((c) => {
      const cClaims = claims.filter((x) => x.customerId === c.id);
      const cProgs = programs.filter((p) => p.customerId === c.id && p.held > 0);
      const amount = cClaims.reduce((s, x) => s + x.claimed, 0) + cProgs.reduce((s, p) => s + p.held, 0);
      const types = Array.from(new Set([...cClaims.map((x) => x.programType), ...cProgs.map((p) => p.type)]));
      const latest = [...cClaims].sort((a, b) => b.code.localeCompare(a.code))[0];
      const status = latest ? claimState(latest, policy.rules) : cProgs[0] ? PROGRAM_STATUS[cProgs[0].status] : null;
      return { c, amount, types, status };
    })
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="space-y-5">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="MQL tuần này" value={`${mqlWeek} lead`} highlight spark={monthly(leads, leadAt)} sub={`${week.length} lead nhận trong 7 ngày`} icon={Inbox} color={C.orange} />
        <StatCard label="Đúng SLA" value={pct(slaMet, slaDone.length)} sub={`${slaMet}/${slaDone.length} lead đã tiếp nhận`} icon={Clock} color={slaDone.length && slaMet / slaDone.length < 0.8 ? C.red : C.teal} />
        <StatCard label="Đang chào giá" value={`${quoted.length} dự án`} sub={`Giá trị BOQ ${compact(quoted.reduce((s, l) => s + boqTotal(l), 0))}`} icon={Target} />
        <StatCard label="Doanh thu MKT" value={compact(mktRevenue)} spark={monthly(leads, (l) => l.wonAt, (l) => l.wonAmount ?? 0)} sub={`${mktCustomers.length} khách hàng đến từ MKT`} icon={TrendingUp} color={C.teal} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Hộp thư lead chờ phân bổ"
          action={<button className={cn(btnGhost, btnSm)} onClick={() => go('leads')}>Mở bảng phân bổ</button>}
        >
          {inbox.length === 0 ? (
            <EmptyState text={<>Không còn lead chờ phân bổ</>} hint={<>Lead mới từ MKT sẽ hiện ở đây.</>} art="inbox" />
          ) : (
            <ul className="divide-y divide-[rgb(var(--line))]">
              {inbox.map((l) => {
                const score = l.score ?? scoreLead(l, customers);
                return (
                  <li key={l.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[rgb(var(--fg))]">{l.company}</p>
                        <p className="text-xs text-[rgb(var(--muted))]">{l.boqNote}</p>
                      </div>
                      <Chip tone={score >= 80 ? 'red' : score >= MQL_THRESHOLD ? 'orange' : 'muted'}>
                        {score} điểm{score >= 80 ? ', Hot' : ''}
                      </Chip>
                    </div>
                    <p className="mt-1 text-xs text-[rgb(var(--muted))]">Nguồn: {SOURCE_LABEL[l.source]}{l.boqValue > 0 && `, ước tính ${compact(l.boqValue)}`}, {REGION_LABEL[l.region]}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {routableDepts.map((rd) => (
                        <button key={rd.code} disabled={!canRoute} className={cn(btnGhost, btnSm)} onClick={() => routeLeads([l.id], rd.code)}>
                          {rd.short}
                        </button>
                      ))}
                    </div>
                    {l.status === 'NURTURE' && <p className="mt-1.5 text-xs text-[rgb(var(--muted))]">Điểm dưới {MQL_THRESHOLD}, đang giữ lại để MKT nuôi dưỡng.</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="xl:col-span-2" title="Tiến độ xử lý theo phòng ban">
          <ul className="space-y-3">
            {routableDepts.map(({ code }) => {
              const Icon = deptIcon(code);
              const list = leads.filter((l) => l.dept === code);
              const open = list.filter((l) => OPEN_STATUSES.includes(l.status)).length;
              const overdue = list.filter((l) => isAcceptLate(l, now) || isQuoteOverdue(l, now)).length;
              const q = list.filter((l) => l.status === 'QUOTED').length;
              const mdf = programs.filter((p) => p.dept === code && ['PENDING_INTERNAL', 'PENDING_VENDOR', 'APPROVED'].includes(p.status)).length;
              return (
                <li key={code} className="rounded bg-[rgb(var(--raised))] p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--fg))]"><Icon className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />{dept(code)?.name}</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[rgb(var(--muted))]">
                    <span><b className="font-semibold tabular-nums text-[rgb(var(--fg))]">{open}</b> lead đang xử lý</span>
                    <span><b className="font-semibold tabular-nums text-[rgb(var(--fg))]">{q}</b> đang chào giá</span>
                    <span><b className="font-semibold tabular-nums text-[rgb(var(--fg))]">{mdf}</b> đề xuất MDF</span>
                    <span className={overdue ? 'text-[rgb(var(--danger-fg))]' : ''}><b className="font-semibold tabular-nums">{overdue}</b> quá hạn SLA / báo giá</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Khách hàng kết nối chương trình Hãng" action={<button className={cn(btnGhost, btnSm)} onClick={() => go('customers')}>Xem tất cả khách hàng</button>}>
        <Table head={['Tên khách hàng', 'Phòng ban', 'Tài trợ MDF', 'Doanh số đạt (YTD)', 'Trạng thái claim']} minW={720}>
          {mdfCustomers.map(({ c, amount, types, status }) => (
            <tr key={c.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => openCustomer(c.id)}>
              <td className={tdFirst}>
                <p className="font-medium text-[rgb(var(--fg))]">{c.name}</p>
                <p className="text-xs text-[rgb(var(--muted))]">{c.code}</p>
              </td>
              <td className={tdCls}>{dept(c.dept)?.short}</td>
              <td className={tdCls}>
                <p className="tabular-nums text-[rgb(var(--fg))]">{compact(amount)}</p>
                <p className="text-xs text-[rgb(var(--muted))]">{types.map((t) => progName(t)).join(', ')}</p>
              </td>
              <td className={cn(tdCls, 'whitespace-nowrap text-right tabular-nums')}>{compact(c.ytdRevenue)}</td>
              <td className={tdLast}>{status && <Chip tone={status.tone}>{status.label}</Chip>}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}

export function CustomerProjectOverview() {
  const { customers, myLeads: leads, userName, dept, openCustomer, go } = useApp();
  const vip = customers.filter((c) => c.tier === 'DIAMOND' || c.tier === 'GOLD').length;
  const pipeline = leads.filter((l) => l.status === 'ACCEPTED' || l.status === 'QUOTED');
  const won = leads.filter((l) => l.status === 'WON').length;
  const lost = leads.filter((l) => l.status === 'LOST').length;
  const stages: LeadStatus[] = ['ACCEPTED', 'QUOTED', 'WON'];
  const maxVal = Math.max(1, ...stages.map((s) => leads.filter((l) => l.status === s).reduce((a, l) => a + boqTotal(l), 0)));
  const top = [...customers].sort((a, b) => b.ytdRevenue - a.ytdRevenue).slice(0, 6);

  return (
    <div className="space-y-5">
      <div className={kpiGrid('lg:grid-cols-4')}>
        <StatCard label="Khách chính thức" value={String(customers.length)} sub={`${vip} khách Diamond / Gold`} icon={Users} />
        <StatCard label="Pipeline đang mở" value={compact(pipeline.reduce((s, l) => s + boqTotal(l), 0))} highlight spark={monthly(pipeline, leadAt, (l) => boqTotal(l))} sub={`${pipeline.length} cơ hội đang khảo sát và báo giá`} icon={FolderKanban} color={C.orange} />
        <StatCard label="Tỷ lệ chốt đơn" value={pct(won, won + lost)} sub={`${won} chốt đơn, ${lost} trượt`} icon={Target} color={C.teal} />
        <StatCard label="Doanh số YTD" value={compact(customers.reduce((s, c) => s + c.ytdRevenue, 0))} sub="Tổng các khách hàng" icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Giá trị pipeline theo giai đoạn" action={<button className={cn(btnGhost, btnSm)} onClick={() => go('projects')}>Mở Dự án / BOM</button>}>
          <ul className="space-y-3">
            {stages.map((s) => {
              const list = leads.filter((l) => l.status === s);
              const val = list.reduce((a, l) => a + boqTotal(l), 0);
              return (
                <li key={s}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-[rgb(var(--muted))]">{LEAD_STATUS[s].label} ({list.length})</span>
                    <span className="tabular-nums text-[rgb(var(--fg))]">{compact(val)}</span>
                  </div>
                  <ProgressBar value={val} max={maxVal} tone={s === 'WON' ? C.teal : C.orange} />
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Khách hàng doanh số cao nhất" className="xl:col-span-2">
          <Table stt={false} head={['Khách hàng', 'Hạng', 'Phòng / phụ trách', 'Doanh số YTD', 'Công nợ / hạn mức']} minW={560}>
            {top.map((c) => {
              const growth = c.lastYearRevenue ? (c.ytdRevenue - c.lastYearRevenue) / c.lastYearRevenue : null;
              return (
                <tr key={c.id} className={cn(rowCls, 'cursor-pointer')} onClick={() => openCustomer(c.id)}>
                  <td className={tdFirst}><p className="font-medium text-[rgb(var(--fg))]">{c.name}</p><p className="text-xs text-[rgb(var(--muted))]">MST {c.taxCode}</p></td>
                  <td className={tdCls}><Chip tone={tierInfo(c.tier).tone}>{tierInfo(c.tier).label}</Chip></td>
                  <td className={tdCls}><p>{dept(c.dept)?.short}</p><p className="text-xs text-[rgb(var(--muted))]">{userName(c.amId)}</p></td>
                  <td className={tdCls}>
                    <p className="tabular-nums text-[rgb(var(--fg))]">{compact(c.ytdRevenue)}</p>
                    {growth !== null && <p className={cn('text-xs tabular-nums', growth >= 0 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]')}>{growth >= 0 ? '+' : ''}{(growth * 100).toFixed(0)}% so với năm trước</p>}
                  </td>
                  <td className={cn(tdLast, 'w-40')}>
                    <ProgressBar value={c.debt} max={c.creditLimit} />
                    <p className="mt-1 text-xs tabular-nums text-[rgb(var(--muted))]">{compact(c.debt)} / {compact(c.creditLimit)}</p>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      </div>
    </div>
  );
}

export function BudgetStrip() {
  const { budget } = useApp();
  const available = budget.total - budget.spent - budget.committed;
  return (
    <Panel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[rgb(var(--muted))]">Quỹ MDF + CS năm {budget.fiscalYear} của {budget.vendor}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-normal text-[rgb(var(--fg))] sm:text-4xl">
            {vnd(available)}<span className="ml-2 text-base font-normal text-[rgb(var(--muted))]">còn khả dụng</span>
          </p>
        </div>
        <p className="text-sm text-[rgb(var(--muted))]">Trần quỹ <span className="font-medium tabular-nums text-[rgb(var(--fg))]">{vnd(budget.total)}</span></p>
      </div>
      <div className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-[rgb(var(--raised))]" role="img" aria-label={`Đã tiêu ${pct(budget.spent, budget.total)}, đang giữ chỗ ${pct(budget.committed, budget.total)}`}>
        <div style={{ width: `${budget.total ? (budget.spent / budget.total) * 100 : 0}%`, background: GRAD }} />
        <div style={{ width: `${budget.total ? (budget.committed / budget.total) * 100 : 0}%`, background: `repeating-linear-gradient(-45deg, ${C.orange}66 0 6px, ${C.orange}26 6px 12px)` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[rgb(var(--muted))]">
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: C.orange }} />Đã tiêu {compact(budget.spent)}</span>
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: `${C.orange}66` }} />Đang giữ chỗ {compact(budget.committed)}</span>
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[rgb(var(--raised))] ring-1 ring-[rgb(var(--line))]" />Khả dụng {compact(available)}</span>
      </div>
    </Panel>
  );
}

export function MdfOverview() {
  const { budget, claims, programs, canDo } = useApp();
  // Giải ngân lũy kế theo tháng của năm đang xem (3M đã duyệt claim), so với kế hoạch chia đều
  const fy = budget.fiscalYear;
  const nowD = new Date();
  const lastMonth = fy < nowD.getFullYear() ? 12 : fy > nowD.getFullYear() ? 0 : nowD.getMonth() + 1;
  const monthOf = (c: Claim) => { const p = programs.find((x) => x.id === c.programId); const d = claimDate(c) ?? (p ? new Date(`${p.start}T12:00:00`) : null); return d ? d.getMonth() + 1 : 12; };
  const opening = budget.openingSpent ?? 0;
  const burn = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const cum = opening + claims.filter((c) => claimYear(c, programs) === fy && (c.vendorApproved ?? 0) > 0 && monthOf(c) <= m).reduce((a, c) => a + (c.vendorApproved ?? 0), 0);
    return { month: `T${m}`, actual: m <= lastMonth ? cum : null, plan: (budget.total / 12) * m };
  });
  const alloc = (Object.keys(PROGRAM_LABEL) as ProgramType[]).map((t) => ({
    name: progName(t),
    color: PROGRAM_COLOR[t],
    value:
      claims.filter((c) => c.programType === t).reduce((s, c) => s + c.claimed, 0) +
      programs.filter((p) => p.type === t && p.held > 0 && p.status !== 'CLAIMING').reduce((s, p) => s + p.held, 0),
  }));
  const totalAlloc = alloc.reduce((s, a) => s + a.value, 0);
  const pending = [...claims].filter((c) => !c.submitted).sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 5);

  return (
    <div className="space-y-5">
      <BudgetStrip />

      {canDo('mdf.margin') && <MdfMarginPanel />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Tốc độ giải ngân so với kế hoạch" className="xl:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burn} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis stroke={C.muted} tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => `${Number(v) / 1e6}tr`} width={56} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8, color: C.text }} labelStyle={{ color: C.muted }} formatter={(v, name) => [vnd(Number(v)), name === 'actual' ? 'Thực tế' : 'Kế hoạch']} />
                <Line type="monotone" dataKey="plan" stroke={C.muted} strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="actual" stroke={C.orange} strokeWidth={2.5} dot={{ r: 3, fill: C.orange }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-[rgb(var(--muted))]">
            {budget.declared === false ? `Chưa khai báo ngân sách năm ${budget.fiscalYear}. Vào Cài đặt > Quỹ Hãng 3M > Khai báo ngân sách năm mới.` : `Đến tháng ${Math.max(1, lastMonth)} đã giải ngân ${compact(budget.spent)}, ${budget.spent < (budget.total / 12) * Math.max(1, lastMonth) ? `chậm ${compact((budget.total / 12) * Math.max(1, lastMonth) - budget.spent)}` : `vượt ${compact(budget.spent - (budget.total / 12) * Math.max(1, lastMonth))}`} so với kế hoạch tuyến tính.`}
          </p>
        </Panel>

        <Panel title="Phân bổ theo hạng mục">
          <div className="relative h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={alloc} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                  {alloc.map((a) => <Cell key={a.name} fill={a.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 8 }} itemStyle={{ color: C.text }} formatter={(v) => vnd(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tabular-nums text-[rgb(var(--fg))]">{compact(totalAlloc)}</span>
              <span className="text-xs text-[rgb(var(--muted))]">đã phân bổ</span>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {alloc.map((a) => (
              <li key={a.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[rgb(var(--muted))]"><i className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />{a.name}</span>
                <span className="tabular-nums text-[rgb(var(--fg))]">{pct(a.value, totalAlloc)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="5 chiến dịch chờ claim hoàn ứng gấp nhất">
        <ClaimTable claims={pending} />
      </Panel>
    </div>
  );
}

export function ClaimTable({ claims }: { claims: Claim[] }) {
  const { openClaim, customers, policy, canDo } = useApp();
  const showMargin = canDo('mdf.margin');
  if (!claims.length) return <EmptyState text={<>Không có hồ sơ nào.</>} art="doc" />;
  return (
    <>
    <div className="space-y-2 md:hidden">
      {claims.map((c) => {
        const st = claimState(c, policy.rules);
        const checks = auditClaim(c, policy.rules);
        return (
          <MobileRow key={c.id} title={c.programTitle} sub={`${c.code}, ${c.submitted ? 'đã nộp' : `còn ${c.daysLeft} ngày`}, chứng từ ${checks.filter((x) => x.passed).length}/${checks.length}`}
            badge={<span className="shrink-0 text-xs text-[rgb(var(--muted))]">{progName(c.programType)}</span>} value={compact(c.claimed)} status={<Chip tone={st.tone}>{st.label}</Chip>} onClick={() => openClaim(c.id)} />
        );
      })}
    </div>
    <div className="hidden md:block">
    <Table head={['Mã claim', 'Chương trình', 'Số tiền claim', 'Chứng từ', 'Hạn nộp', ...(showMargin ? ['Thặng dư / hoàn quỹ'] : []), 'Trạng thái']} minW={showMargin ? 940 : 760}>
      {claims.map((c) => {
        const checks = auditClaim(c, policy.rules);
        const passed = checks.filter((i) => i.passed).length;
        const st = claimState(c, policy.rules);
        const cust = customers.find((k) => k.id === c.customerId);
        return (
          <tr
            key={c.id}
            tabIndex={0}
            onClick={() => openClaim(c.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openClaim(c.id); } }}
            className={cn(rowCls, 'cursor-pointer outline-none focus-visible:bg-[rgb(var(--raised))]')}
          >
            <td className={cn(tdFirst, 'font-medium text-[rgb(var(--fg))]')}>{c.code}</td>
            <td className={tdCls}>
              <p className="max-w-[300px] truncate text-[rgb(var(--fg))]">{c.programTitle}</p>
              <p className="text-xs text-[rgb(var(--muted))]">{progName(c.programType)}{cust ? `, ${cust.name}` : ''}</p>
            </td>
            <td className={cn(tdCls, 'text-right tabular-nums text-[rgb(var(--fg))]')}>{vnd(c.claimed)}</td>
            <td className={tdCls}>
              <div className="flex items-center gap-2">
                <div className="w-16"><ProgressBar value={passed} max={checks.length} tone={blockersOf(c, policy.rules) ? C.orange : C.teal} /></div>
                <span className="text-xs tabular-nums text-[rgb(var(--muted))]">{passed}/{checks.length}</span>
              </div>
            </td>
            <td className={tdCls}>
              {c.submitted ? <span className="text-[rgb(var(--muted))]">Đã nộp</span> : <span className={cn('tabular-nums', c.daysLeft <= 3 ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--fg))]')}>Còn {c.daysLeft} ngày</span>}
            </td>
            {showMargin && <td className={tdCls}><MarginBadge c={c} /></td>}
            <td className={tdLast}><Chip tone={st.tone}>{st.label}</Chip></td>
          </tr>
        );
      })}
    </Table>
    </div>
    </>
  );
}

