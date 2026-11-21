'use client';

import { Fragment, type CSSProperties, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Bell, Bot, ChevronDown, Clock, Download, ExternalLink, FileText, FolderKanban, Hash, Inbox, Info, MessageSquare, Paperclip, Pin, Plus, Reply, Search, SmilePlus, Sparkles, Star, StickyNote, Target, TrendingUp, Upload, Users, Users2, X } from 'lucide-react';
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PAvatar } from '../../app/header';
import { MentionComposer, MentionText, useDeepLinks } from '../../components/comments';
import { Avatar, MobileRow } from '../../components/controls';
import { claimDate } from '../../components/filters';
import { Chip, Code, EmptyState, Field, FilePicker, Modal, MoneyInput, monthly, Panel, ProgressBar, StatCard, Table, Tabs, useSticky } from '../../components/ui';
import { auditClaim, claimState, scoreLead } from '../../lib/business';
import { bizMode, blockersOf, boqTotal, btnGhost, btnPrimary, btnSm, C, cfDefsFor, cfEmpty, cfSample, chatFileMax, claimYear, CLOUD_ON, compact, deptIcon, dmId, downloadBlob, fmtDate, fmtN, fmtSize, fold, GRAD, inputBase, inputCls, isAcceptLate, isMktCustomer, iso, isQuoteOverdue, isTextFile, jobCustName, kpiGrid, L_ACT, L_DS, L_GAP, L_ICONSET, L_PER, L_PER_LOW, L_PERIOD, L_ROW, L_SAMPLE_CUST, L_SAMPLE_STAFF, L_SO_LINES, lAgg, lCondOk, lDeviceOf, LEAD_STATUS, leadAt, lEnsureCore, lField, lFieldOrder, lFill, lFilter, lFmt, lFramed, lHasData, lHit, lIsCore, lKind, lMigrate, LPageC, lPeriodLabel, lTabList, lToneCls, lType, MODULE_LABEL, MQL_THRESHOLD, OPEN_STATUSES, pct, PRESENCE_META, presenceOf, progName, PROGRAM_COLOR, PROGRAM_LABEL, PROGRAM_STATUS, QUICK_REACTIONS, REGION_LABEL, ROLE_LABEL, rowCls, SALE_STAGE, saleOwed, salePaid, SO_INFO_F, SO_LINE_F, SO_LIST_COLS, SO_LIST_TABS, SOURCE_LABEL, tdCls, tdFirst, tdLast, threadKey, tierInfo, tipStyle, todayISO, uid, useApp, vnd } from '../../lib/core';
import { xlsxBlob } from '../../lib/csv';
import { saleStage, saleTotals } from '../../lib/getfly';
import type { AppCtx, CfDef, CfVal, ChatChannel, ChatFile, Claim, CommentEntity, DashPeriod, DashScope, DateRange, DeptCode, LAgg, LayoutAssign, LayoutVer, LBlock, LBlockCfg, LBlockType, LBtn, LBtnAct, LDataset, LDevice, LeadStatus, LPage, LPageCtx, LPeriod, LPos, LRow, LStage, Module, ProgramType, Role, RowComment, StockVoucher, Thread, User, XlsxSheet } from '../../lib/types';
import { cn } from '../../lib/utils';
import { dashRange, ExecDashboard, KpiTargetSheet, useDashData } from '../dashboard/exec-dashboard';
import { CommandCenter } from '../dashboard/widget-board';
import { MarginBadge, MdfMarginPanel } from '../mdf/surplus';
import { TradingReports } from '../reports/reports';
import { useOutside } from '../sales/orders';

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
          <div className="min-w-0 flex-1">
            <h2 className="font-display truncate text-[17px] font-semibold">{sel.title}</h2>
            <p className="truncate text-[13px] text-[rgb(var(--muted))]">{isDm && dmOther ? `${PRESENCE_META[presenceOf(dmOther, me.id)].label} · ${ROLE_LABEL[dmOther.role]}` : group ? `${group.desc ? `${group.desc} · ` : ''}${group.members.length} thành viên` : `${sel.sub} · ${members.length} người`}</p>
          </div>
          <div className="relative hidden sm:block"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[rgb(var(--faint))]" aria-hidden /><input className={cn(inputBase, 'w-44 rounded-lg border-[rgb(var(--ink)/0.08)] py-1.5 pl-8 text-[13px]')} value={inThread} onChange={(e) => setInThread(e.target.value)} placeholder="Tìm trong kênh" aria-label="Tìm trong kênh" /></div>
          <button className={cn('flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium transition-colors', sumOpen ? 'bg-[rgb(var(--secondary)/0.15)] text-[rgb(var(--secondary-fg))]' : 'text-[rgb(var(--secondary-fg))] hover:bg-[rgb(var(--secondary)/0.1)]')} onClick={() => setSumOpen((v) => !v)} aria-expanded={sumOpen}><Sparkles className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">AI tóm tắt</span></button>
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

export function lDefaultCfg(type: LBlockType, page: LPage = 'home'): LBlockCfg {
  if (type === 'K-Stat-Simple') return { title: 'Doanh số tháng', ds: 'sales', field: 'revenue', agg: 'sum', period: 'month', compare: true, open: true };
  if (type === 'K-Chart-Line') return { title: 'Doanh số và doanh thu 12 tháng', ds: 'sales', series: ['revenue', 'paid'], months: 12, open: true };
  if (type === 'K-Table-Compact') return { title: 'Top 5 khách hàng', ds: 'sales', mode: 'group', group: 'customer', field: 'revenue', limit: 5, open: true };
  if (type === 'K-Text') return page === 'home' ? { title: 'Tiêu đề kỳ', ds: 'sales', kind: 'title', text: '{kỳ}', sub: 'Cập nhật {giờ cập nhật} · kỳ vọng {kỳ vọng %} · còn {số ngày còn lại} ngày' }
    : { title: 'Lưu ý', ds: 'sales', kind: 'note', text: page === 'sale-detail' ? '**Trước khi yêu cầu xuất kho**\n- Đơn giao nhà xe: ghi rõ tên nhà xe và số điện thoại ở Ghi chú\n- Đơn trên 50 triệu: gửi kèm PO hoặc hợp đồng' : 'Đơn **duyệt trước ngày 28** được tính vào doanh số tháng' };
  if (type === 'K-Button') {
    const bt = (act: LBtnAct, label: string, style: LBtn['style'], icon = L_ACT[act].icon): LBtn => ({ id: uid('bt'), icon, label, style, act });
    return { title: 'Nút trang', ds: 'sales', align: 'right', buttons: page === 'home' ? [bt('targets', 'Chỉ tiêu', 'ghost'), bt('print', 'PDF', 'ghost')]
      : page === 'sale-list' ? [bt('new', 'Lên đơn bán', 'primary')]
      : (['back', 'prev', 'next', 'print', 'download', 'upload', 'menu'] as LBtnAct[]).map((a) => bt(a, '', 'icon')) };
  }
  if (type === 'K-Filter') return { title: 'Bộ lọc chung', ds: 'sales', periods: ['WEEK', 'MONTH', 'QUARTER', 'YEAR'], showCompare: true, showDept: true, align: 'right' };
  if (type === 'K-Tabs') return { title: 'Tab trang', ds: 'sales', tabs: [{ id: uid('tb'), label: 'Tổng quan' }, { id: uid('tb'), label: 'Kinh doanh' }] };
  if (type === 'K-Divider') return { title: 'Đường kẻ', ds: 'sales', hideTitle: true };
  return { title: lType(type).label, ds: 'sales' };
}

export function lSettle(bs: LBlock[], movedId?: string): LBlock[] {
  const clamp = (p: LPos): LPos => { const w = Math.max(1, Math.min(12, p.w)); return { x: Math.max(0, Math.min(12 - w, p.x)), y: Math.max(0, p.y), w, h: Math.max(1, Math.min(12, p.h)) }; };
  const items = bs.map((b) => ({ ...b, pos: { ...b.pos, lg: clamp(b.pos.lg) } }));
  const moved = items.find((b) => b.id === movedId);
  const placed: LBlock[] = moved ? [moved] : [];
  items.filter((b) => b !== moved).sort((p, q) => p.pos.lg.y - q.pos.lg.y || p.pos.lg.x - q.pos.lg.x).forEach((b) => {
    let y = b.pos.lg.y;
    while (placed.some((o) => lHit({ ...b.pos.lg, y }, o.pos.lg))) y++;
    placed.push({ ...b, pos: { ...b.pos, lg: { ...b.pos.lg, y } } });
  });
  // dồn lên
  const out: LBlock[] = [];
  [...placed].sort((p, q) => p.pos.lg.y - q.pos.lg.y || p.pos.lg.x - q.pos.lg.x).forEach((b) => {
    let y = 0;
    while (out.some((o) => lHit({ ...b.pos.lg, y }, o.pos.lg))) y++;
    out.push({ ...b, pos: { ...b.pos, lg: { ...b.pos.lg, y } } });
  });
  return bs.map((b) => out.find((o) => o.id === b.id)!);
}

// ---- dữ liệu thật của doanh nghiệp (đã lọc theo phạm vi xem của người dùng)
export function lRowsReal(ds: LDataset, a: AppCtx, stockVouchers: StockVoucher[]): LRow[] {
  const cd = new Map<string, string>(a.customers.map((c) => [c.id, String(c.dept)]));
  if (ds === 'sales') return a.mySales.filter((o) => o.status !== 'CANCELLED').map((o) => {
    const st = saleStage(o, stockVouchers);
    const owed = Math.max(0, saleOwed(o) - salePaid(o, true));
    return { date: o.date, dp: o.customerId ? cd.get(o.customerId) : undefined, v: { revenue: saleTotals(o).net, grand: saleTotals(o).grand, paid: salePaid(o), owed }, d: { code: o.code, customer: o.customer, by: a.userName(o.by ?? ''), stage: SALE_STAGE[st].label }, f: [st === 'APPROVAL' ? 'approval' : '', owed > 0 ? 'unpaid' : '', o.status === 'DONE' ? 'done' : ''] };
  });
  if (ds === 'leads') return a.myLeads.map((l) => ({ date: iso(new Date(Date.now() - (l.receivedDaysAgo ?? 0) * 864e5)), dp: l.dept, v: { value: l.boqValue ?? 0, won: l.wonAmount ?? 0 }, d: { company: l.company, source: String(l.source), status: String(l.status) }, f: [l.wonAt ? 'won' : l.lostReason ? '' : 'open'] }));
  if (ds === 'customers') return a.myCustomers.map((c) => ({ date: (c.createdAt ?? '').slice(0, 10), dp: String(c.dept), v: {}, d: { name: c.name, segment: String(c.segment) }, f: [] }));
  if (ds === 'cash') return a.cashEntries.filter((e) => e.kind !== 'TRANSFER').map((e) => ({ date: e.date, v: { in: e.kind === 'IN' ? e.amount : 0, out: e.kind === 'OUT' ? e.amount : 0 }, d: { code: e.code, category: e.category, partner: e.partner ?? '' }, f: [e.kind === 'IN' ? 'in' : 'out'] }));
  return a.programs.map((p) => ({ date: (p.start ?? '').slice(0, 10), v: { requested: p.requested ?? 0 }, d: { title: p.title, status: String(p.status) }, f: [] }));
}

export function lRowsSample(ds: LDataset): LRow[] {
  let s = 7 + ds.length * 13;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const today = new Date();
  const day = (back: number) => iso(new Date(today.getTime() - back * 864e5));
  const out: LRow[] = [];
  for (let i = 0; i < 140; i++) {
    const back = Math.floor(rnd() * 360);
    const grow = 1 + (360 - back) / 360;
    if (ds === 'sales') { const rev = Math.round((8 + rnd() * 60) * grow) * 1e6; const paid = rnd() > 0.35 ? Math.round(rev * 1.08) : 0; const st = i % 9 === 0 ? 'approval' : rnd() > 0.5 ? 'done' : ''; out.push({ date: day(back), v: { revenue: rev, grand: Math.round(rev * 1.08), paid, owed: Math.round(rev * 1.08) - paid }, d: { code: `DH${String(100 + i)}`, customer: L_SAMPLE_CUST[Math.floor(rnd() * L_SAMPLE_CUST.length)], by: L_SAMPLE_STAFF[i % 3], stage: st === 'approval' ? 'Chờ duyệt' : st === 'done' ? 'Hoàn thành' : 'Chờ xuất kho' }, f: [st, paid ? '' : 'unpaid'] }); }
    else if (ds === 'leads') out.push({ date: day(back), v: { value: Math.round(20 + rnd() * 400) * 1e6, won: rnd() > 0.7 ? Math.round(20 + rnd() * 200) * 1e6 : 0 }, d: { company: L_SAMPLE_CUST[i % L_SAMPLE_CUST.length], source: ['Website', 'Zalo', 'Hội thảo'][i % 3], status: 'Đang xử lý' }, f: [i % 4 === 0 ? 'won' : 'open'] });
    else if (ds === 'customers') out.push({ date: day(back), v: {}, d: { name: `${L_SAMPLE_CUST[i % L_SAMPLE_CUST.length]} ${i}`, segment: ['Dự án', 'Thương mại', 'Đại lý'][i % 3] }, f: [] });
    else if (ds === 'cash') { const inn = rnd() > 0.45; const amt = Math.round(1 + rnd() * 40) * 1e6; out.push({ date: day(back), v: { in: inn ? amt : 0, out: inn ? 0 : amt }, d: { code: `${inn ? 'PTQ' : 'PCQ'}-${i}`, category: inn ? 'Thu tiền bán hàng' : 'Vận chuyển', partner: L_SAMPLE_CUST[i % L_SAMPLE_CUST.length] }, f: [inn ? 'in' : 'out'] }); }
    else if (i < 24) out.push({ date: day(back), v: { requested: Math.round(20 + rnd() * 180) * 1e6 }, d: { title: `Hội thảo 3M ${i + 1}`, status: 'Đã duyệt' }, f: [] });
  }
  return out;
}

/** Khoảng ngày của kỳ và kỳ liền trước */
export function lBounds(p: LPeriod, range?: DateRange): { from: string; to: string; pf: string; pt: string } | null {
  const t = new Date(); const y = t.getFullYear(), m = t.getMonth();
  const d = (x: Date) => iso(x);
  if (p === 'all') return null;
  if (p === 'month') return { from: d(new Date(y, m, 1)), to: d(new Date(y, m + 1, 0)), pf: d(new Date(y, m - 1, 1)), pt: d(new Date(y, m, 0)) };
  if (p === 'quarter') { const q = Math.floor(m / 3) * 3; return { from: d(new Date(y, q, 1)), to: d(new Date(y, q + 3, 0)), pf: d(new Date(y, q - 3, 1)), pt: d(new Date(y, q, 0)) }; }
  if (p === 'year') return { from: `${y}-01-01`, to: `${y}-12-31`, pf: `${y - 1}-01-01`, pt: `${y - 1}-12-31` };
  if (p === 'last30') return { from: d(new Date(t.getTime() - 29 * 864e5)), to: d(t), pf: d(new Date(t.getTime() - 59 * 864e5)), pt: d(new Date(t.getTime() - 30 * 864e5)) };
  const r = range ?? { from: d(new Date(y, m, 1)), to: d(t) };
  const len = Math.max(1, Math.round((new Date(r.to).getTime() - new Date(r.from).getTime()) / 864e5) + 1);
  return { from: r.from, to: r.to, pf: d(new Date(new Date(r.from).getTime() - len * 864e5)), pt: d(new Date(new Date(r.from).getTime() - 864e5)) };
}

export function LStat({ c, rows, range }: { c: LBlockCfg; rows: LRow[]; range?: DateRange }) {
  const ctxPer = useContext(LPageC)?.period;
  const fl = lField(c.ds, c.field);
  const agg: LAgg = fl.id === 'count' ? 'count' : c.agg ?? 'sum';
  const unit = agg === 'count' ? 'count' : fl.unit;
  const base = lFilter(rows, c.filter);
  const b = lBounds(c.period ?? 'month', range);
  const cur = lAgg(b ? base.filter((r) => r.date >= b.from && r.date <= b.to) : base, fl.id, agg);
  const prev = b ? lAgg(base.filter((r) => r.date >= b.pf && r.date <= b.pt), fl.id, agg) : 0;
  const pct = b && c.compare && prev ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null;
  const cmp = c.period === 'quarter' ? 'quý trước' : c.period === 'year' ? 'năm trước' : c.period === 'last30' ? '30 ngày trước đó' : c.period === 'inherit' ? 'kỳ trước' : 'tháng trước';
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-[24px] font-medium leading-tight tabular-nums">{lFmt(unit, cur)}</p>
      {pct !== null ? <p className="text-[12px]"><span className={pct >= 0 ? 'text-[rgb(var(--success-fg))]' : 'text-[rgb(var(--danger-fg))]'}>{pct >= 0 ? '+' : '−'}{Math.abs(pct)}%</span> <span className="text-[rgb(var(--muted))]">so với {cmp}</span></p>
        : <p className="text-[12px] text-[rgb(var(--muted))]">{b ? (c.period === 'inherit' ? lPeriodLabel(ctxPer ?? 'MONTH') : L_PERIOD[c.period ?? 'month']) : 'Toàn bộ'}</p>}
    </div>
  );
}

export function LLine({ c, rows }: { c: LBlockCfg; rows: LRow[] }) {
  const n = c.months ?? 12;
  const t = new Date();
  const base = lFilter(rows, c.filter);
  const ser = (c.series ?? ['revenue']).filter(Boolean).slice(0, 2);
  const data = Array.from({ length: n }, (_, i) => { const d = new Date(t.getFullYear(), t.getMonth() - (n - 1 - i), 1); const k = iso(d).slice(0, 7); const rs = base.filter((r) => r.date.slice(0, 7) === k);
    return { name: `T${d.getMonth() + 1}`, ...Object.fromEntries(ser.map((f) => [lField(c.ds, f).label, lAgg(rs, f, f === 'count' ? 'count' : 'sum')])) }; });
  const colors = [C.orange, C.muted];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex gap-3 text-[12px] text-[rgb(var(--muted))]">{ser.map((f, i) => <span key={f} className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-3" style={{ background: colors[i] }} />{lField(c.ds, f).label}</span>)}</div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke={C.line} vertical={false} />
            <XAxis dataKey="name" stroke={C.muted} fontSize={11} />
            <YAxis stroke={C.muted} fontSize={11} width={56} tickFormatter={(v) => compact(Number(v))} />
            <Tooltip {...tipStyle} formatter={(v) => compact(Number(v))} />
            {ser.map((f, i) => <Line key={f} type="monotone" dataKey={lField(c.ds, f).label} stroke={colors[i]} strokeWidth={2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Định dạng gọn của khối text (không dùng HTML): **đậm**, *nghiêng*, [chữ](https://…) */
export function lInline(s: string, k: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  let last = 0; let i = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={`${k}b${i++}`} className="font-semibold">{t.slice(2, -2)}</strong>);
    else if (t.startsWith('[')) out.push(<a key={`${k}a${i++}`} href={m[2]} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[rgb(var(--accent))]">{t.slice(1, t.indexOf(']('))}</a>);
    else out.push(<em key={`${k}i${i++}`}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

/** Biến tự điền theo trang (giá trị theo kỳ đang chọn, doanh nghiệp, người xem) */
export function lVars(p: DashPeriod, org: string, viewer: string, extra: Record<string, string> = {}): Record<string, string> {
  const now = Date.now(); const r = dashRange(p, now);
  return { 'kỳ': lPeriodLabel(p), 'kỳ trước': r.prevTag, 'giờ cập nhật': new Date(now).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), 'kỳ vọng %': `${Math.round(r.elapsed * 100)}%`, 'số ngày còn lại': String(r.daysLeft), 'ngày': fmtDate(todayISO()), 'tên doanh nghiệp': org, 'người xem': viewer, ...extra };
}

/** Ngữ cảnh của màn thiết kế / xem trước (dữ liệu mẫu, nút không chạy) */
export function lDesignCtx(page: LPage, tab: string, setTab: (t: string) => void, period: DashPeriod, setPeriod: (p: DashPeriod) => void): LPageCtx {
  return { live: false, page, period, setPeriod, dept: 'ALL', setDept: () => {}, tab, setTab, vars: lVars(period, 'VASSH', 'Trần Quốc Bảo', { 'mã đơn': 'DH201126-02', 'khách hàng': 'NPP Hoàng Phát', 'trạng thái đơn': 'Chờ xuất kho' }), act: () => {}, can: () => true, openTargets: () => {} };
}

export function LText({ c }: { c: LBlockCfg }) {
  const ctx = useContext(LPageC);
  const v = ctx?.vars;
  const k = lKind(c);
  const sz = c.size ?? 'md';
  const main = k === 'title' ? cn('font-medium', sz === 'lg' ? 'text-[26px] leading-8' : sz === 'sm' ? 'text-[18px] leading-6' : 'text-[22px] leading-7')
    : k === 'heading' ? cn('font-medium', sz === 'lg' ? 'text-[17px]' : sz === 'sm' ? 'text-[13.5px]' : 'text-[15px]')
    : k === 'label' ? 'text-[12px] font-medium text-[rgb(var(--muted))]'
    : k === 'quote' ? 'border-l-2 border-[rgb(var(--line))] pl-3 text-[13px] leading-relaxed text-[rgb(var(--fg2))]'
    : cn('leading-relaxed', sz === 'lg' ? 'text-[14.5px]' : sz === 'sm' ? 'text-[12.5px]' : 'text-[13px]', k === 'info' && 'text-[rgb(var(--fg2))]');
  const out: ReactNode[] = [];
  let ul: string[] = [];
  const flush = () => { if (ul.length) { const n = out.length; out.push(<ul key={`u${n}`} className="list-disc space-y-0.5 pl-5 text-left">{ul.map((x, i) => <li key={i}>{lInline(x, `l${n}-${i}`)}</li>)}</ul>); ul = []; } };
  lFill(c.text ?? '', v).split('\n').forEach((ln, i) => {
    const t = ln.trimEnd();
    if (/^\s*[-•]\s+/.test(t)) { ul.push(t.replace(/^\s*[-•]\s+/, '')); return; }
    flush();
    if (!t.trim()) return;
    out.push(t.startsWith('## ') ? <p key={i} className="text-[14px] font-medium">{lInline(t.slice(3), `h${i}`)}</p> : <p key={i}>{lInline(t, `p${i}`)}</p>);
  });
  flush();
  const I = k === 'info' ? Info : k === 'note' ? StickyNote : k === 'warn' ? AlertTriangle : null;
  return (
    <div className={cn('min-w-0', c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : '')}>
      <div className={cn(I && 'flex gap-2')}>
        {I && <I className={cn('mt-0.5 h-4 w-4 shrink-0', k === 'note' ? 'text-[rgb(var(--accent))]' : k === 'warn' ? 'text-[rgb(var(--danger-fg))]' : 'text-[rgb(var(--muted))]')} aria-hidden />}
        <div className={cn('min-w-0 flex-1 space-y-1.5', main)}>{out.length ? out : <p className="text-[13px] text-[rgb(var(--muted))]">Chưa có nội dung</p>}</div>
      </div>
      {c.sub && <p className="mt-0.5 text-[12.5px] text-[rgb(var(--muted))]">{lInline(lFill(c.sub, v), 'sub')}</p>}
    </div>
  );
}

/** Khối text đặt trên trang: có khung thì thành thẻ (tiêu đề khối nếu không ẩn), không khung thì chữ nằm thẳng trên nền trang */
export function LTextBlock({ c, style, cls }: { c: LBlockCfg; style?: CSSProperties; cls?: string }) {
  const f = lFramed(c);
  return (
    <section style={style} className={cn('min-w-0', f ? cn('glass-card rounded-xl px-4 py-3', lToneCls(c)) : 'flex flex-col justify-center', cls)}>
      {f && !c.hideTitle && <h3 className="mb-1.5 text-[14px] font-medium">{c.title}</h3>}
      <LText c={c} />
    </section>
  );
}

/** Hành động chung (không phụ thuộc trang) */
export function lActCommonRun(b: LBtn, go: (m: Module) => void) {
  if (b.act === 'back') window.history.back();
  else if (b.act === 'go' && b.arg && Object.prototype.hasOwnProperty.call(MODULE_LABEL, b.arg)) go(b.arg as Module);
  else if (b.act === 'link' && /^https?:\/\//.test(b.arg ?? '')) window.open(b.arg, '_blank', 'noopener,noreferrer');
  else if (b.act === 'print') window.print();
}

/** Khối Nút / Icon */
export function LButtons({ c }: { c: LBlockCfg }) {
  const ctx = useContext(LPageC);
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  const ico = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[rgb(var(--ink)/0.12)] bg-[rgb(var(--surface))] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.04)] disabled:opacity-40';
  const list = (c.buttons ?? []).filter((b) => L_ACT[b.act] && (!ctx || ctx.can(b)));
  return (
    <div className={cn('flex h-full flex-wrap items-center gap-1.5', c.align === 'left' ? 'justify-start' : c.align === 'center' ? 'justify-center' : 'justify-end')}>
      {list.map((b) => {
        const I = L_ICONSET[b.icon] ?? L_ICONSET[L_ACT[b.act].icon] ?? Info;
        const name = b.label || L_ACT[b.act].label;
        const cls = b.style === 'primary' ? cn(btnPrimary, 'h-9') : b.style === 'ghost' ? cn(btnGhost, 'h-9') : b.style === 'text' ? 'inline-flex h-9 items-center rounded-lg px-2.5 text-[13.5px] text-[rgb(var(--fg2))] hover:bg-[rgb(var(--ink)/0.05)] hover:text-[rgb(var(--fg))] disabled:opacity-40' : ico;
        const inner = b.style === 'text' ? <>{b.label || L_ACT[b.act].label}</> : <><I className="h-4 w-4" aria-hidden />{b.style !== 'icon' && b.label}</>;
        return b.act === 'menu' ? (
          <div key={b.id} className="relative" ref={ref}>
            <button className={cls} disabled={!ctx?.menu} onClick={() => setOpen(!open)} aria-label={name} title={name} aria-expanded={open}>{inner}</button>
            {open && ctx?.menu && <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-1 text-left text-[13.5px] shadow-xl" onClick={() => setOpen(false)}>{ctx.menu}</div>}
          </div>
        ) : <button key={b.id} className={cls} disabled={!!ctx?.off?.(b)} onClick={() => ctx?.act(b)} aria-label={name} title={name}>{inner}</button>;
      })}
    </div>
  );
}

/** Khối Bộ lọc chung: kỳ, so với kỳ trước, phòng ban (quyền xem phòng như trang Tổng quan gốc) */
export function LFilter({ c }: { c: LBlockCfg }) {
  const ctx = useContext(LPageC);
  const { departments, role, me } = useApp();
  const per = ctx?.period ?? 'MONTH';
  const r = dashRange(per, Date.now());
  const opts = c.periods?.length ? c.periods : (['WEEK', 'MONTH', 'QUARTER', 'YEAR'] as DashPeriod[]);
  const live = !!ctx?.live;
  const lockDept = live && role !== 'BOD' && role !== 'ACCOUNTANT' && role !== 'MKT_LEAD';
  return (
    <div className={cn('flex w-full flex-wrap items-center gap-2', c.align === 'left' ? 'justify-start' : c.align === 'center' ? 'justify-center' : 'justify-end')}>
      <div className="flex rounded-lg border border-[rgb(var(--line))] p-0.5" role="radiogroup" aria-label="Kỳ báo cáo">
        {opts.map((o) => <button key={o} role="radio" aria-checked={per === o} onClick={() => ctx?.setPeriod(o)} className={cn('rounded-md px-2.5 py-1 text-[13px]', per === o ? 'bg-[rgb(var(--raised))] font-medium text-[rgb(var(--fg))]' : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]')}>{L_PER[o]}</button>)}
      </div>
      {c.showCompare !== false && <span className="rounded-lg border border-[rgb(var(--line))] px-2.5 py-1 text-[13px] text-[rgb(var(--fg2))]">So với {r.prevTag}</span>}
      {c.showDept !== false && (live && role === 'SALES_REP' ? <span className="rounded-md border border-[rgb(var(--line))] px-2.5 py-1.5 text-sm">Của tôi</span> : (
        <select aria-label="Phòng ban" disabled={lockDept} className={cn(inputCls, 'h-8 w-auto py-0 text-[13px]')} value={ctx?.dept ?? 'ALL'} onChange={(e) => ctx?.setDept(e.target.value as DeptCode | 'ALL')}>
          {!lockDept && <option value="ALL">Mọi phòng</option>}
          {departments.filter((d) => d.active && (!lockDept || d.code === me?.dept)).map((d) => <option key={d.code} value={d.code}>{d.short || d.name}</option>)}
        </select>
      ))}
    </div>
  );
}

/** Khối Tab: thanh tab, chỉ hiện tab có khối người xem thấy */
export function LTabsBar({ tabs, cur, onChange }: { tabs: { id: string; label: string }[]; cur: string; onChange: (t: string) => void }) {
  return (
    <div className="flex h-full items-end gap-6 overflow-x-auto border-b border-[rgb(var(--line))]" role="tablist">
      {tabs.map((t) => <button key={t.id} role="tab" aria-selected={cur === t.id} onClick={() => onChange(t.id)} className={cn('-mb-px whitespace-nowrap border-b-2 pb-2 text-[14px]', cur === t.id ? 'border-[rgb(var(--fg))] font-medium text-[rgb(var(--fg))]' : 'border-transparent text-[rgb(var(--fg2))] hover:text-[rgb(var(--fg))]')}>{t.label}</button>)}
    </div>
  );
}

export function LTargetView({ revenue, target, elapsed, canEdit, onOpen, per }: { revenue: number; target: number; elapsed: number; canEdit: boolean; onOpen: () => void; per: DashPeriod }) {
  if (!target) return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--fg2))]"><Target className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Chưa có chỉ tiêu {L_PER_LOW[per]}, các số đang so với kỳ trước
      <button className="font-medium text-[rgb(var(--accent-fg))] hover:underline" onClick={onOpen}>{canEdit ? 'Nhập chỉ tiêu' : 'Xem chỉ tiêu'}</button></p>
  );
  const pct = (revenue / target) * 100;
  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
      <span className="flex items-center gap-2"><Target className="h-4 w-4 text-[rgb(var(--muted))]" aria-hidden />Doanh thu <b className="font-medium tabular-nums">{compact(revenue)}</b> / chỉ tiêu <span className="tabular-nums">{compact(target)}</span></span>
      <div className="relative h-1.5 min-w-[160px] flex-1 rounded-full bg-[rgb(var(--ink)/0.08)]" role="img" aria-label={`Đạt ${Math.round(pct)}%, kỳ vọng ${Math.round(elapsed * 100)}%`}><div className="h-full rounded-full bg-[rgb(var(--fg))]" style={{ width: `${Math.min(100, pct)}%` }} /><i className="absolute -top-1 h-3.5 w-px bg-[rgb(var(--accent))]" style={{ left: `${Math.min(100, elapsed * 100)}%` }} /></div>
      <span className="tabular-nums text-[rgb(var(--fg2))]">đạt {Math.round(pct)}% · kỳ vọng {Math.round(elapsed * 100)}%</span>
      <button className="text-[rgb(var(--accent-fg))] hover:underline" onClick={onOpen}>Chỉ tiêu</button>
    </div>
  );
}

export function LTargetLive({ ctx }: { ctx: LPageCtx }) {
  const { role, me } = useApp();
  const lock = role !== 'BOD' && role !== 'ACCOUNTANT' && role !== 'MKT_LEAD';
  const scope: DashScope = role === 'SALES_REP' ? { dept: 'ALL', userId: me.id } : { dept: lock ? me.dept ?? 'ALL' : ctx.dept };
  const d = useDashData(ctx.period, scope);
  return <LTargetView revenue={d.revenue} target={d.target} elapsed={d.r.elapsed} canEdit={role === 'BOD' || role === 'DEPT_HEAD'} onOpen={ctx.openTargets} per={ctx.period} />;
}

/** Khối Tiến độ mục tiêu: dùng chỉ tiêu tháng sẵn có (Nhập chỉ tiêu), cùng cách tính với Tổng quan gốc */
export function LTarget() {
  const ctx = useContext(LPageC);
  if (ctx?.live) return <LTargetLive ctx={ctx} />;
  const per = ctx?.period ?? 'MONTH';
  return <LTargetView revenue={0} target={0} elapsed={dashRange(per, Date.now()).elapsed} canEdit onOpen={() => {}} per={per} />;
}

export function LDivider({ c }: { c: LBlockCfg }) {
  return <div className="flex h-full items-center gap-3">{!c.hideTitle && c.title && <span className="whitespace-nowrap text-[12.5px] font-medium text-[rgb(var(--muted))]">{c.title}</span>}<hr className="flex-1 border-[rgb(var(--line))]" /></div>;
}

/** Khối hiển thị dùng chung trên trang nghiệp vụ */
export function lCommonNode(b: LBlock): ReactNode {
  if (b.type === 'K-Text') return <LTextBlock c={b.config} />;
  if (b.type === 'K-Button' || b.type === 'K-Icons') return <LButtons c={b.config} />;
  if (b.type === 'K-Divider') return <LDivider c={b.config} />;
  if (b.type === 'K-Spacer') return <div style={{ height: Math.max(1, b.pos.lg.h) * 20 }} aria-hidden />;
  return null;
}

export function LTable({ c, rows, narrow }: { c: LBlockCfg; rows: LRow[]; narrow?: boolean }) {
  const ds = L_DS[c.ds];
  const base = lFilter(rows, c.filter);
  const lim = c.limit ?? 5;
  if ((c.mode ?? 'rows') === 'group') {
    const g = c.group ?? ds.dims[0].id;
    const fl = lField(c.ds, c.field);
    const m = new Map<string, LRow[]>();
    base.forEach((r) => { const k = r.d[g] || '—'; m.set(k, [...(m.get(k) ?? []), r]); });
    if (!base.length) return <p className="py-6 text-center text-[12.5px] text-[rgb(var(--muted))]">Chưa có dữ liệu</p>;
    const list = Array.from(m.entries()).map(([k, rs]) => ({ k, v: lAgg(rs, fl.id, fl.id === 'count' ? 'count' : 'sum') })).sort((a, b) => b.v - a.v).slice(0, lim);
    return (
      <table className="w-full text-[12.5px]"><thead><tr className="text-[rgb(var(--muted))]">{c.stt && <th className="w-7 py-1 text-left font-normal">#</th>}<th className="py-1 text-left font-normal">{ds.dims.find((x) => x.id === g)?.label}</th><th className="py-1 text-right font-normal">{fl.label}</th></tr></thead>
        <tbody>{list.map((r, i) => <tr key={r.k} className="border-t border-[rgb(var(--line)/0.6)]">{c.stt && <td className="py-1.5 tabular-nums text-[rgb(var(--muted))]">{i + 1}</td>}<td className="max-w-0 truncate py-1.5 pr-2">{r.k}</td><td className="py-1.5 text-right tabular-nums">{lFmt(fl.unit, r.v)}</td></tr>)}</tbody></table>
    );
  }
  if (!base.length) return <p className="py-6 text-center text-[12.5px] text-[rgb(var(--muted))]">Chưa có dữ liệu</p>;
  const cols = (c.cols?.length ? c.cols : [ds.dims[0].id, ds.fields[1]?.id ?? 'count']).slice(0, 5);
  const isNum = (id: string) => ds.fields.some((f) => f.id === id);
  const sorted = [...base].sort((a, b) => (c.sort ? (b.v[c.sort] ?? 0) - (a.v[c.sort] ?? 0) : b.date.localeCompare(a.date))).slice(0, lim);
  const lab = (id: string) => ds.dims.find((x) => x.id === id)?.label ?? ds.fields.find((x) => x.id === id)?.label ?? id;
  if (narrow && c.smView !== 'table') {
    const dims = cols.filter((x) => !isNum(x)), nums = cols.filter(isNum);
    const big = nums[nums.length - 1];
    const sub = [...dims.slice(2), ...nums.slice(0, -1)];
    return (
      <ul className="text-[12.5px]">{sorted.map((r, i) => (
        <li key={i} className="flex gap-3 border-t border-[rgb(var(--line)/0.6)] py-2 first:border-t-0">
          {c.stt && <span className="w-5 shrink-0 tabular-nums text-[rgb(var(--muted))]">{i + 1}</span>}
          <div className="min-w-0 flex-1">
            <p className="truncate">{dims.slice(0, 2).map((x, j) => (x === 'code' ? <Fragment key={x}><Code>{r.d[x]}</Code> </Fragment> : <span key={x} className={j ? '' : 'font-medium'}>{r.d[x]}</span>))}</p>
            {sub.length > 0 && <p className="truncate text-[11.5px] text-[rgb(var(--muted))]">{sub.map((x) => (isNum(x) ? `${lab(x)} ${lFmt(lField(c.ds, x).unit, r.v[x] ?? 0)}` : r.d[x])).join(' · ')}</p>}
          </div>
          {big && <div className="shrink-0 text-right"><p className="tabular-nums">{lFmt(lField(c.ds, big).unit, r.v[big] ?? 0)}</p><p className="text-[11px] text-[rgb(var(--muted))]">{lab(big)}</p></div>}
        </li>
      ))}</ul>
    );
  }
  return (
    <table className="w-full text-[12.5px]"><thead><tr className="text-[rgb(var(--muted))]">{c.stt && <th className="w-7 py-1 text-left font-normal">#</th>}{cols.map((x) => <th key={x} className={cn('py-1 font-normal', isNum(x) ? 'text-right' : 'text-left')}>{lab(x)}</th>)}</tr></thead>
      <tbody>{sorted.map((r, i) => <tr key={i} className="border-t border-[rgb(var(--line)/0.6)]">{c.stt && <td className="py-1.5 tabular-nums text-[rgb(var(--muted))]">{i + 1}</td>}{cols.map((x) => <td key={x} className={cn('max-w-0 truncate py-1.5 pr-2', isNum(x) && 'text-right tabular-nums')}>{isNum(x) ? lFmt(lField(c.ds, x).unit, r.v[x] ?? 0) : x === 'code' ? <Code>{r.d[x]}</Code> : r.d[x]}</td>)}</tr>)}</tbody></table>
  );
}

export function LBlockBody({ b, rows, range, narrow }: { b: LBlock; rows: LRow[]; range?: DateRange; narrow?: boolean }) {
  if (b.type === 'K-Stat-Simple') return <LStat c={b.config} rows={rows} range={range} />;
  if (b.type === 'K-Chart-Line') return <LLine c={b.config} rows={rows} />;
  if (b.type === 'K-Text') return <LText c={b.config} />;
  if (b.type === 'K-Icons' || b.type === 'K-Button') return <LButtons c={b.config} />;
  if (b.type === 'K-Filter') return <LFilter c={b.config} />;
  if (b.type === 'K-Tabs') return <LTabsBar tabs={b.config.tabs ?? []} cur={b.config.tabs?.[0]?.id ?? ''} onChange={() => {}} />;
  if (b.type === 'K-Target') return <LTarget />;
  if (b.type === 'K-Divider') return <LDivider c={b.config} />;
  if (b.type === 'K-Spacer') return <div className="h-full rounded-md border border-dashed border-[rgb(var(--line))]" aria-hidden />;
  return <LTable c={b.config} rows={rows} narrow={narrow} />;
}

/** Bộ hiển thị bố cục (doanh nghiệp xem, 3A xem trước): máy tính theo vị trí 12 cột; máy tính bảng 6 cột; điện thoại theo độ rộng khối 1/1, 1/2, 1/3, 1/4 */
export function LayoutView({ blocks, rowsOf, device, range, onOpen, role }: { blocks: LBlock[]; rowsOf: (ds: LDataset) => LRow[] | null; device?: LDevice; range?: DateRange; onOpen?: (m: Module) => void; role?: Role }) {
  const ctx = useContext(LPageC);
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(1200);
  useEffect(() => { const el = ref.current; if (!el || device) return; const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, [device]);
  const dev = device ?? lDeviceOf(w);
  const perm = blocks.filter((b) => b.show[dev] && (!lHasData(b.type) || rowsOf(b.config.ds) !== null) && lCondOk(b.config, null, role ?? null));
  // Tab: chỉ hiện tab có ít nhất một khối người xem thấy; khối không thuộc tab nào hiện ở mọi tab
  const tabIds = lTabList(blocks).map((t) => t.id);
  const tabList = lTabList(blocks).filter((t) => perm.some((b) => b.config.tab === t.id));
  const cur = tabList.find((t) => t.id === ctx?.tab)?.id ?? tabList[0]?.id ?? '';
  const vis = perm.filter((b) => !tabIds.length || !b.config.tab || !tabIds.includes(b.config.tab) || b.config.tab === cur);
  const lg = dev === 'lg' ? lSettle(vis) : vis;
  const ordered = dev === 'sm' ? [...vis].sort((a, b) => (a.pos.sm.order || 99) - (b.pos.sm.order || 99)) : [...lg].sort((a, b) => a.pos.lg.y - b.pos.lg.y || a.pos.lg.x - b.pos.lg.x);
  const style = (b: LBlock): CSSProperties => {
    const p = b.pos.lg;
    if (dev === 'lg') return { gridColumn: `${p.x + 1} / span ${p.w}`, gridRow: `${p.y + 1} / span ${p.h}` };
    if (dev === 'md') return { gridColumn: `span ${Math.min(6, Math.max(2, p.w))}`, gridRow: `span ${p.h}` };
    const one = ['K-Tabs', 'K-Filter', 'K-Button', 'K-Icons', 'K-Divider', 'K-Spacer', 'K-Target'].includes(b.type);
    return { gridColumn: `span ${b.pos.sm.w || 12}`, gridRow: `span ${b.type === 'K-Stat-Simple' ? 2 : one ? Math.min(p.h, 2) : Math.min(p.h, 5)}` };
  };
  return (
    <div ref={ref} className="grid" style={{ gridTemplateColumns: `repeat(${dev === 'md' ? 6 : 12}, minmax(0, 1fr))`, gridAutoRows: `${L_ROW}px`, gap: L_GAP, gridAutoFlow: dev === 'md' ? 'row dense' : 'row' }}>
      {ordered.map((b) => {
        const st = style(b);
        if (b.type === 'K-Tabs') return <div key={b.id} style={st} className="min-w-0"><LTabsBar tabs={tabList} cur={cur} onChange={(t) => ctx?.setTab(t)} /></div>;
        if (b.type === 'K-Icons' || b.type === 'K-Button') return <div key={b.id} style={st} className="min-w-0"><LButtons c={b.config} /></div>;
        if (b.type === 'K-Filter') return <div key={b.id} style={st} className="flex min-w-0 items-center"><LFilter c={b.config} /></div>;
        if (b.type === 'K-Target') return <div key={b.id} style={st} className="flex min-w-0 items-center"><LTarget /></div>;
        if (b.type === 'K-Divider') return <div key={b.id} style={st} className="min-w-0"><LDivider c={b.config} /></div>;
        if (b.type === 'K-Spacer') return <div key={b.id} style={st} aria-hidden />;
        if (b.type === 'K-Text') return <LTextBlock key={b.id} c={b.config} style={st} cls="overflow-y-auto" />;
        const rows = rowsOf(b.config.ds) ?? [];
        const ds = L_DS[b.config.ds];
        return (
          <section key={b.id} style={st} className="glass-card flex min-w-0 flex-col overflow-hidden rounded-xl">
            <div className="flex items-center gap-2 px-4 pt-3"><h3 className="min-w-0 truncate text-[13px] font-medium">{b.config.title}</h3>
              {b.config.open !== false && onOpen && <button className="ml-auto shrink-0 text-[12px] text-[rgb(var(--muted))] hover:text-[rgb(var(--fg))]" onClick={() => onOpen(ds.module)} aria-label={`Mở ${MODULE_LABEL[ds.module]}`}><ArrowRight className="h-3.5 w-3.5" aria-hidden /></button>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-1"><LBlockBody b={b} rows={rows} range={range} narrow={dev === 'sm'} /></div>
          </section>
        );
      })}
    </div>
  );
}

/** Màn hình rộng tối thiểu (theo media query, cập nhật khi đổi cỡ) */
export function useMinW(px: number) {
  const q = `(min-width: ${px}px)`;
  const [ok, setOk] = useState(() => typeof window === 'undefined' || !window.matchMedia ? true : window.matchMedia(q).matches);
  useEffect(() => { if (typeof window === 'undefined' || !window.matchMedia) return; const m = window.matchMedia(q); const h = () => setOk(m.matches); h(); m.addEventListener('change', h); return () => m.removeEventListener('change', h); }, [q]);
  return ok;
}

/** Chia khối thành các dải ngang; trong mỗi dải gom khối cùng vùng cột thành một cột xếp dọc (chiều cao theo nội dung) */
export function lBands(bs: LBlock[]): { x: number; w: number; items: LBlock[] }[][] {
  // khối rộng cả 12 cột tách dải; các khối khác trong cùng dải gom theo vùng cột chồng nhau
  const s = [...bs].sort((a, b) => a.pos.lg.y - b.pos.lg.y || a.pos.lg.x - b.pos.lg.x);
  const bands: LBlock[][] = [];
  let cur: LBlock[] = [];
  s.forEach((b) => { if (b.pos.lg.w >= 12) { if (cur.length) bands.push(cur); bands.push([b]); cur = []; } else cur.push(b); });
  if (cur.length) bands.push(cur);
  return bands.map((band) => {
    let cols: { x: number; w: number; items: LBlock[] }[] = [];
    [...band].sort((a, b) => a.pos.lg.x - b.pos.lg.x).forEach((b) => {
      const p = b.pos.lg;
      const hit = cols.filter((k) => p.x < k.x + k.w && k.x < p.x + p.w);
      if (!hit.length) { cols.push({ x: p.x, w: p.w, items: [b] }); return; }
      const x = Math.min(p.x, ...hit.map((k) => k.x)), r = Math.max(p.x + p.w, ...hit.map((k) => k.x + k.w));
      cols = [...cols.filter((k) => !hit.includes(k)), { x, w: r - x, items: [...hit.flatMap((k) => k.items), b] }];
    });
    return cols.sort((a, b) => a.x - b.x).map((k) => ({ ...k, items: k.items.sort((a, b) => a.pos.lg.y - b.pos.lg.y || a.pos.lg.x - b.pos.lg.x) }));
  });
}

/** Hiển thị trang nghiệp vụ theo bố cục: máy tính theo dải / cột 12; màn hẹp xếp một cột theo thứ tự điện thoại */
export function LBusinessView({ blocks, node, narrow, dev }: { blocks: LBlock[]; node: (b: LBlock) => ReactNode; narrow: boolean; dev: LDevice }) {
  const vis = blocks.filter((b) => lIsCore(b.type) || b.show[dev]).map((b) => ({ b, n: node(b) })).filter((x) => x.n !== null && x.n !== undefined && x.n !== false);
  if (narrow) return <div className="space-y-4">{[...vis].sort((a, b) => (a.b.pos.sm.order || 99) - (b.b.pos.sm.order || 99)).map((x) => <Fragment key={x.b.id}>{x.n}</Fragment>)}</div>;
  const nodes = new Map(vis.map((x) => [x.b.id, x.n]));
  return (
    <div className="space-y-4">{lBands(vis.map((x) => x.b)).map((band, i) => (
      <div key={i} className="grid grid-cols-12 gap-4">{band.map((c, j) => <div key={j} className="min-w-0 space-y-4" style={{ gridColumn: `${c.x + 1} / span ${c.w}` }}>{c.items.map((b) => <Fragment key={b.id}>{nodes.get(b.id)}</Fragment>)}</div>)}</div>
    ))}</div>
  );
}

/** Nội dung mẫu của khối trang đơn hàng (đơn DH201126-02, theo trạng thái đơn và vai trò xem trước) */
export function lSaleSample({ b, stage, cf, narrow }: { b: LBlock; stage: LStage; cf: CfDef[]; narrow?: boolean }): ReactNode {
  const c = b.config;
  const kv = (k: string, v: ReactNode, big?: boolean) => <div key={k} className={cn('flex justify-between gap-3 py-0.5', big ? 'text-[14px] font-medium' : 'text-[12.5px]')}><span className="text-[rgb(var(--muted))]">{k}</span><span className="tabular-nums">{v}</span></div>;
  const net = L_SO_LINES.reduce((s, l) => s + Math.round(l.qty * l.price * (1 - l.ck / 100)), 0), vat = Math.round(net * 0.08), paid = stage === 'DONE' ? net + vat : stage === 'CANCEL' ? 2000000 : 0;
  if (b.type === 'K-Order-Info') {
    if (stage === 'CANCEL') return <div className="space-y-1 text-[12.5px]"><p className="text-[rgb(var(--muted))]">Lý do: khách đổi sang mã hàng khác. Cần nhập trả hàng đã xuất và hoàn tiền trước khi hủy</p></div>;
    const heads = cf.filter((d) => d.scope === 'HEAD' && d.status === 'ACTIVE' && d.where.info);
    const all = [...SO_INFO_F, ...heads.map((d) => ({ id: `cf:${d.key}`, label: d.label }))];
    const val: Record<string, ReactNode> = { customer: 'NPP Hoàng Phát', code: <Code>DH201126-02</Code>, origin: 'Tại quầy', by: 'Trần Quốc Bảo', wh: 'Kho Tổng Hà Nội', docRef: 'PO-HP-1125', invNo: '—' };
    return <div className="grid gap-x-4 gap-y-2.5" style={{ gridTemplateColumns: `repeat(${narrow ? 2 : c.gridCols ?? 4}, minmax(0, 1fr))` }}>{lFieldOrder(all, c).map((id) => { const d = heads.find((x) => `cf:${x.key}` === id); return <div key={id} className="min-w-0"><p className="flex items-center gap-1 text-[11.5px] text-[rgb(var(--muted))]">{all.find((x) => x.id === id)?.label}{d && <i className="inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]" title="Trường tùy chỉnh" />}</p><p className="truncate text-[13px]">{d ? cfSample(d) : val[id]}</p></div>; })}</div>;
  }
  if (b.type === 'K-Order-Lines') {
    const lc = cf.filter((d) => d.scope === 'LINE' && d.status === 'ACTIVE' && d.where.info);
    const all = [...SO_LINE_F, ...lc.map((d) => ({ id: `cf:${d.key}`, label: d.label }))];
    const ids = lFieldOrder(all, c);
    if (narrow && c.smView !== 'table') return <div className="text-[12.5px]"><p className="mb-1 text-[12px]"><span className="font-medium">Hàng hóa 2</span> <span className="text-[rgb(var(--muted))]">· Chứng từ 3</span></p>{L_SO_LINES.map((l, i) => <div key={l.ref} className="flex gap-2 border-t border-[rgb(var(--line)/0.6)] py-1.5">{ids.includes('stt') && <span className="w-4 text-[rgb(var(--muted))]">{i + 1}</span>}<div className="min-w-0 flex-1"><p className="truncate font-medium">{l.name}</p><p className="truncate text-[11.5px] text-[rgb(var(--muted))]"><Code>{l.ref}</Code> {fmtN(l.qty)} {l.unit} × {fmtN(l.price)}{l.ck ? ` · CK ${l.ck}%` : ''}{lc.map((d) => ` · ${d.label} ${cfSample(d)}`).join('')}</p></div><span className="tabular-nums">{fmtN(Math.round(l.qty * l.price * (1 - l.ck / 100)))}</span></div>)}</div>;
    const cell = (id: string, l: (typeof L_SO_LINES)[number], i: number): ReactNode => { const d = lc.find((x) => `cf:${x.key}` === id); if (d) return cfSample(d); return ({ stt: i + 1, ref: <Code>{l.ref}</Code>, name: l.name, unit: l.unit, qty: fmtN(l.qty), price: fmtN(l.price), ckPct: l.ck, ckAmt: fmtN(Math.round(l.qty * l.price * l.ck / 100)), vat: l.vat, net: fmtN(Math.round(l.qty * l.price * (1 - l.ck / 100))), iss: stage === 'APPROVAL' || stage === 'ISSUE' ? 0 : fmtN(l.qty), ret: '—', rest: stage === 'APPROVAL' || stage === 'ISSUE' ? fmtN(l.qty) : '—' } as Record<string, ReactNode>)[id]; };
    const right = (id: string) => !['ref', 'name', 'unit', 'stt'].includes(id) && !id.startsWith('cf:');
    return <div className="overflow-hidden"><p className="mb-1 text-[12px]"><span className="border-b-2 border-[rgb(var(--accent))] pb-0.5 font-medium">Hàng hóa 2</span> <span className="ml-3 text-[rgb(var(--muted))]">Chứng từ 3</span></p><table className="w-full text-[12px]"><thead><tr className="text-[rgb(var(--muted))]">{ids.map((id) => <th key={id} className={cn('whitespace-nowrap px-1.5 py-1 font-normal', right(id) ? 'text-right' : 'text-left')}>{id === 'stt' ? '#' : all.find((x) => x.id === id)?.label}</th>)}</tr></thead><tbody>{L_SO_LINES.map((l, i) => <tr key={l.ref} className="border-t border-[rgb(var(--line)/0.6)]">{ids.map((id) => <td key={id} className={cn('max-w-[220px] truncate whitespace-nowrap px-1.5 py-1.5', right(id) && 'text-right tabular-nums')}>{cell(id, l, i)}</td>)}</tr>)}</tbody></table></div>;
  }
  if (b.type === 'K-Order-Flow') {
    const st = stage === 'CANCEL' ? [['Nhập trả đủ hàng', 'ok'], ['Hoàn tiền cho khách', 'cur'], ['Hủy đơn, giữ chứng từ', '']] : [['Duyệt đơn', stage === 'APPROVAL' ? 'cur' : 'ok'], ['Xuất kho', stage === 'APPROVAL' ? '' : stage === 'ISSUE' ? 'cur' : 'ok'], ['Thu tiền', stage === 'PAY' ? 'cur' : stage === 'DONE' ? 'ok' : ''], ['Hoàn thành', stage === 'DONE' ? 'ok' : '']];
    return <div>{stage === 'CANCEL' && <p className="mb-1 text-[12px] text-[rgb(var(--muted))]">Quy trình hủy (theo luồng nghiệp vụ)</p>}{narrow && stage !== 'CANCEL' ? <p className="flex flex-wrap items-center gap-1.5 text-[12.5px]">{st.map(([t, s], i) => <Fragment key={t}>{i > 0 && <span className="text-[rgb(var(--muted))]">—</span>}<i className={cn('inline-block h-2.5 w-2.5 rounded-full border-2', s === 'ok' ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))]' : s === 'cur' ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]' : 'border-[rgb(var(--line))]')} /><span className={s === 'cur' ? 'font-medium' : s ? '' : 'text-[rgb(var(--muted))]'}>{t}</span></Fragment>)}</p>
      : st.map(([t, s]) => <p key={t} className="flex items-center gap-2 py-1 text-[12.5px]"><i className={cn('inline-block h-3 w-3 rounded-full border-2', s === 'ok' ? 'border-[rgb(var(--fg))] bg-[rgb(var(--fg))]' : s === 'cur' ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))] ring-2 ring-[rgb(var(--accent)/0.2)]' : 'border-[rgb(var(--line))]')} /><span className={s ? '' : 'text-[rgb(var(--muted))]'}>{t}</span></p>)}</div>;
  }
  if (b.type === 'K-Order-Pay') return <div>{kv('Tiền hàng', fmtN(net))}{kv('Thuế GTGT 8%', fmtN(vat))}{kv('Thực tế phải thu', fmtN(net + vat), true)}{kv('Doanh thu (kế toán đã thu)', fmtN(paid))}{kv(stage === 'CANCEL' ? 'Khách trả thừa' : 'Còn lại', fmtN(stage === 'CANCEL' ? paid : net + vat - paid))}</div>;
  if (b.type === 'K-Order-Profit') { const cogs = Math.round(net * 0.78); return <div>{kv('Doanh thu thuần', fmtN(net))}{kv('Giá vốn tạm tính', `−${fmtN(cogs)}`)}{kv('Lãi gộp chuẩn', fmtN(net - cogs), true)}{kv('Chi phí gắn vào đơn', '−250.000')}{kv('Lãi ước tính', fmtN(net - cogs - 250000), true)}</div>; }
  if (b.type === 'K-Order-Debt') return <div>{kv('Đang nợ / hạn mức', '124 tr / 500 tr')}<div className="my-1.5 h-1.5 rounded bg-[rgb(var(--ink)/0.06)]"><div className="h-full w-1/4 rounded bg-[rgb(var(--fg))]" /></div>{kv('Quá hạn', '0')}</div>;
  if (b.type === 'K-Order-Log') return <div className="space-y-2 text-[12.5px]"><p><span className="font-medium">Trần Quốc Bảo</span> <span className="text-[rgb(var(--muted))]">· 21:12</span><br />Khách cần giao trước 9h sáng thứ Hai</p><p className="text-[rgb(var(--fg2))]">Lê Thu Hà duyệt đơn <span className="text-[rgb(var(--muted))]">· 21:30</span></p></div>;
  if (b.type === 'K-Order-Ship') return <div>{kv('Giao nhận', 'Gửi xe / chành')}{kv('Người nhận', 'Anh Phát · 0903 112 245')}{kv('Ngày giao', fmtDate(todayISO()))}{kv('Địa chỉ', 'Lô C5, KCN Tân Bình')}</div>;
  if (b.type === 'K-Order-Files') return <div className="space-y-1 text-[12.5px]"><p className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden />PO-HP-1125.pdf <span className="text-[rgb(var(--muted))]">180 KB</span></p><p className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5 text-[rgb(var(--muted))]" aria-hidden />anh-giao-hang.jpg <span className="text-[rgb(var(--muted))]">240 KB</span></p></div>;
  if (b.type === 'K-Text') return <LText c={c} />;
  if (b.type === 'K-Icons' || b.type === 'K-Button') return <LButtons c={c} />;
  if (b.type === 'K-Divider') return <LDivider c={c} />;
  if (b.type === 'K-Spacer') return <div className="h-5" aria-hidden />;
  if (b.type === 'K-SaleList') {
    const tabs = lFieldOrder(SO_LIST_TABS, c);
    const def = c.cols?.length ? SO_LIST_COLS.filter((x) => x.lock || c.cols!.includes(x.id)) : SO_LIST_COLS.filter((x) => x.lock || x.def);
    const cfc = cf.filter((d) => d.scope === 'HEAD' && d.where.list && c.cols?.includes(`cf:${d.key}`));
    const head = [...def.filter((x) => x.id !== 'seller').map((x) => x.label), ...cfc.map((d) => d.label)];
    const rows = [['20/11/2026', 'DH201126-04', 'Xưởng Nhôm kính Phú Quý', 'Chờ duyệt'], ['20/11/2026', 'DH201126-03', 'Cửa hàng Vật tư điện Phúc An', 'Chờ xuất kho'], ['20/11/2026', 'DH201126-02', 'NPP Hoàng Phát', 'Chờ xuất kho'], ['19/11/2026', 'DH191126-07', 'Tổng thầu Điện Thành', 'Hoàn thành']];
    const val = (h: string, r: string[], i: number) => (h === 'Ngày' ? r[0] : h === 'Mã đơn' ? <Code>{r[1]}</Code> : h === 'Khách hàng' ? r[2] : h === 'Trạng thái' ? r[3] : ['Doanh số', 'Tổng đơn', 'Doanh thu', 'Còn lại', 'VAT', 'Chiết khấu', 'Hàng trả lại', 'Chờ kế toán thu'].includes(h) ? fmtN([2160000, 8100000, 1425000, 3390000][i] * (h === 'VAT' ? 0.08 : h === 'Doanh thu' ? 0 : 1)) : cfc.some((d) => d.label === h) ? cfSample(cfc.find((d) => d.label === h)!) : '—');
    return (
      <div className="overflow-hidden text-[12px]">
        <div className="mb-2 flex items-center gap-2"><span className="text-[15px] font-medium">Quản lý đơn hàng</span><span className="ml-2 h-7 flex-1 rounded-md border border-[rgb(var(--line))] px-2 leading-7 text-[rgb(var(--muted))]">Tìm mã đơn, khách hàng</span><span className="rounded-md border border-[rgb(var(--line))] px-2 leading-7">Tháng này</span></div>
        <div className="flex gap-4 border-b border-[rgb(var(--line))] pb-1.5">{tabs.map((id, i) => <span key={id} className={i === 0 ? 'font-medium' : 'text-[rgb(var(--muted))]'}>{SO_LIST_TABS.find((x) => x.id === id)?.label}</span>)}</div>
        <table className="w-full"><thead><tr className="text-[rgb(var(--muted))]">{head.map((h) => <th key={h} className="whitespace-nowrap px-1.5 py-1 text-left font-normal">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={r[1]} className="border-t border-[rgb(var(--line)/0.6)]">{head.map((h) => <td key={h} className="max-w-[160px] truncate whitespace-nowrap px-1.5 py-1.5">{val(h, r, i)}</td>)}</tr>)}</tbody></table>
      </div>
    );
  }
  return null;
}

/** Bố cục áp dụng cho doanh nghiệp đang mở: riêng doanh nghiệp → mô hình → toàn hệ thống (vai trò cụ thể trước, chung sau) */
export function useTenantLayout(page: LPage): LayoutVer | null {
  const { platform, org, role } = useApp();
  const prof: 'TRADING' | 'MFG' = org.profile === 'MANUFACTURING' ? 'MFG' : 'TRADING';
  const as = platform.layoutAssigns.filter((x) => x.page === page);
  const pick = (lv: LayoutAssign['level'], r: Role | null) => as.find((x) => x.level === lv && (x.role ?? null) === r && (lv !== 'PROFILE' || x.profile === prof) && (lv !== 'TENANT' || x.tenantId === org.id));
  const a = pick('TENANT', role) ?? pick('TENANT', null) ?? pick('PROFILE', role) ?? pick('PROFILE', null) ?? pick('SYSTEM', role) ?? pick('SYSTEM', null);
  const v = a ? platform.layouts.find((x) => x.id === a.verId) : undefined;
  return v && v.blocks.length ? { ...v, blocks: lEnsureCore(page, lMigrate(page, v.blocks)) } : null;
}

export function TenantLayoutPage({ ver }: { ver: LayoutVer }) {
  const app = useApp();
  const { stockVouchers, canSee, canDo, go, range, role, me, org } = app;
  const [period, setPeriod] = useSticky<DashPeriod>('L.home.period', 'MONTH');
  const [deptPick, setDeptPick] = useSticky<DeptCode | 'ALL'>('L.home.dept', 'ALL');
  const [tab, setTab] = useSticky<string>('L.home.tab', '');
  const [sheet, setSheet] = useState(false);
  const lockDept = role !== 'BOD' && role !== 'ACCOUNTANT' && role !== 'MKT_LEAD';
  const dept: DeptCode | 'ALL' = role === 'SALES_REP' ? 'ALL' : lockDept ? me.dept ?? 'ALL' : deptPick;
  // Có Bộ lọc chung: khối đặt kỳ "Theo Bộ lọc chung" và lọc phòng theo bộ lọc; không có thì theo ô kỳ ở thanh trên cùng
  const hasF = ver.blocks.some((b) => b.type === 'K-Filter');
  const rr = dashRange(period, Date.now());
  const pr: DateRange | undefined = hasF ? { from: iso(new Date(rr.from)), to: iso(new Date(rr.to - 864e5)) } : range;
  const cache = useMemo(() => new Map<LDataset, LRow[]>(), [app.mySales, app.myLeads, app.myCustomers, app.cashEntries, app.programs, stockVouchers]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsOf = (ds: LDataset) => {
    const d = L_DS[ds];
    if (!canSee(d.module) || (d.perm && !canDo(d.perm))) return null;
    if (!cache.has(ds)) cache.set(ds, lRowsReal(ds, app, stockVouchers));
    const base = cache.get(ds) ?? [];
    return hasF && dept !== 'ALL' && (ds === 'sales' || ds === 'leads' || ds === 'customers') ? base.filter((x) => x.dp === dept) : base;
  };
  const ctx: LPageCtx = {
    live: true, page: 'home', period, setPeriod, dept, setDept: setDeptPick, tab, setTab, vars: lVars(period, org.shortName || org.name, me?.name ?? ''), openTargets: () => setSheet(true),
    act: (b) => { if (b.act === 'excel') lExport(ver.blocks, rowsOf, pr, `TongQuan_${todayISO()}.xlsx`); else if (b.act === 'targets') setSheet(true); else lActCommonRun(b, (m) => go(m)); },
    can: () => true,
  };
  return (
    <LPageC.Provider value={ctx}>
      <LayoutView blocks={ver.blocks} rowsOf={rowsOf} range={pr} onOpen={(m) => go(m)} role={role} />
      {sheet && <KpiTargetSheet onClose={() => setSheet(false)} />}
    </LPageC.Provider>
  );
}

/** Tải số liệu các khối của trang tổng hợp ra Excel: 1 sheet chỉ số + mỗi bảng / biểu đồ 1 sheet */
export function lExport(blocks: LBlock[], rowsOf: (ds: LDataset) => LRow[] | null, range: DateRange | undefined, file: string) {
  const sheets: XlsxSheet[] = [];
  const name = (t: string) => { let n = (t.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Khoi').slice(0, 28); let k = 2; while (sheets.some((s) => s.name === n)) n = `${n.slice(0, 26)}${k++}`; return n; };
  const stat: (string | number)[][] = [['Chỉ số', 'Giá trị', 'Kỳ']];
  [...blocks].sort((a, b) => a.pos.lg.y - b.pos.lg.y || a.pos.lg.x - b.pos.lg.x).forEach((b) => {
    if (!lHasData(b.type)) return;
    const rows = rowsOf(b.config.ds); if (!rows) return;
    const c = b.config; const ds = L_DS[c.ds]; const base = lFilter(rows, c.filter);
    if (b.type === 'K-Stat-Simple') {
      const fl = lField(c.ds, c.field); const agg: LAgg = fl.id === 'count' ? 'count' : c.agg ?? 'sum'; const bd = lBounds(c.period ?? 'month', range);
      stat.push([c.title, Math.round(lAgg(bd ? base.filter((r) => r.date >= bd.from && r.date <= bd.to) : base, fl.id, agg)), bd ? L_PERIOD[c.period ?? 'month'] : 'Toàn bộ']);
    } else if (b.type === 'K-Chart-Line') {
      const n = c.months ?? 12; const t = new Date(); const ser = (c.series ?? ['revenue']).filter(Boolean).slice(0, 2);
      sheets.push({ name: name(c.title), rows: [['Tháng', ...ser.map((f) => lField(c.ds, f).label)], ...Array.from({ length: n }, (_, i) => { const d = new Date(t.getFullYear(), t.getMonth() - (n - 1 - i), 1); const k = iso(d).slice(0, 7); const rs = base.filter((r) => r.date.slice(0, 7) === k); return [k, ...ser.map((f) => Math.round(lAgg(rs, f, f === 'count' ? 'count' : 'sum')))]; })] });
    } else if ((c.mode ?? 'rows') === 'group') {
      const g = c.group ?? ds.dims[0].id; const fl = lField(c.ds, c.field); const m = new Map<string, LRow[]>();
      base.forEach((r) => { const k = r.d[g] || '—'; m.set(k, [...(m.get(k) ?? []), r]); });
      sheets.push({ name: name(c.title), rows: [[ds.dims.find((x) => x.id === g)?.label ?? g, fl.label], ...Array.from(m.entries()).map(([k, rs]) => [k, Math.round(lAgg(rs, fl.id, fl.id === 'count' ? 'count' : 'sum'))] as (string | number)[]).sort((p, q) => Number(q[1]) - Number(p[1]))] });
    } else {
      const cols = (c.cols?.length ? c.cols : [ds.dims[0].id, ds.fields[1]?.id ?? 'count']).slice(0, 5);
      const isNum = (id: string) => ds.fields.some((f) => f.id === id);
      const lab = (id: string) => ds.dims.find((x) => x.id === id)?.label ?? ds.fields.find((x) => x.id === id)?.label ?? id;
      const sorted = [...base].sort((p, q) => (c.sort ? (q.v[c.sort] ?? 0) - (p.v[c.sort] ?? 0) : q.date.localeCompare(p.date)));
      sheets.push({ name: name(c.title), rows: [['STT', ...cols.map(lab)], ...sorted.map((r, i) => [i + 1, ...cols.map((x) => (isNum(x) ? Math.round(r.v[x] ?? 0) : r.d[x] ?? ''))])] });
    }
  });
  if (stat.length > 1) sheets.unshift({ name: 'Chi so', rows: stat, widths: [32, 18, 22] });
  if (!sheets.length) sheets.push({ name: 'Trong', rows: [['Không có khối dữ liệu']] });
  downloadBlob(file, xlsxBlob(sheets));
}

/** Trường tùy chỉnh của doanh nghiệp đang mở (gồm cả trường đã ngừng dùng để xem lại giá trị cũ) */
export function useSaleCf() {
  const { platform, org } = useApp();
  return useMemo(() => { const all = cfDefsFor(platform.customFields, org); return { all, head: all.filter((d) => d.scope === 'HEAD'), line: all.filter((d) => d.scope === 'LINE') }; }, [platform.customFields, org]);
}

/** Giá trị hiển thị (chuỗi rỗng = chưa nhập) */
export function cfText(d: CfDef, v: CfVal | undefined, nameOf: (id: string) => string): string {
  if (d.type === 'check') return v === true ? 'Có' : v === false ? 'Không' : '';
  if (cfEmpty(v)) return '';
  if (d.type === 'money' || d.type === 'number') return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  if (d.type === 'date') return fmtDate(String(v));
  if (d.type === 'user') return nameOf(String(v)) || '';
  return String(v);
}

/** Ô nhập theo kiểu trường */
export function CfInput({ d, v, set, users }: { d: CfDef; v: CfVal | undefined; set: (v: CfVal | undefined) => void; users: User[] }) {
  if (d.type === 'check') return <label className="flex h-[38px] items-center gap-2 text-[14px]"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={v === true} onChange={(e) => set(e.target.checked)} />{d.label}</label>;
  if (d.type === 'select') return <select className={inputCls} value={String(v ?? '')} onChange={(e) => set(e.target.value || undefined)} aria-label={d.label}><option value="">—</option>{(d.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}{!cfEmpty(v) && !(d.options ?? []).includes(String(v)) && <option value={String(v)}>{String(v)}</option>}</select>;
  if (d.type === 'user') return <select className={inputCls} value={String(v ?? '')} onChange={(e) => set(e.target.value || undefined)} aria-label={d.label}><option value="">—</option>{users.filter((u) => u.active || u.id === v).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>;
  if (d.type === 'money') return <MoneyInput value={Number(v ?? 0)} onChange={(n) => set(n || undefined)} />;
  if (d.type === 'number') return <input className={inputCls} type="number" step="any" value={cfEmpty(v) ? '' : String(v)} onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} aria-label={d.label} />;
  if (d.type === 'date') return <input className={inputCls} type="date" value={String(v ?? '')} onChange={(e) => set(e.target.value || undefined)} aria-label={d.label} />;
  return <input className={inputCls} value={String(v ?? '')} onChange={(e) => set(e.target.value || undefined)} aria-label={d.label} />;
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

